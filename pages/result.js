import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import CoinsToast from '@/components/CoinsToast';
import Confetti from '@/components/Confetti';

import GoogleSignInCard from '@/components/GoogleSignInCard';
import MentorMessage from '@/components/MentorMessage';
import Loader from '@/components/ui/Loader';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import SectionHeader from '@/components/ui/SectionHeader';
import RefreshStatus from '@/components/ui/RefreshStatus';
import { fetchWithClientCache, formatLastUpdated, patchCache, readCache, writeCache } from '@/lib/clientCache';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cachePolicy';
import { getUserCacheScope, buildUserScopedKey } from '@/lib/userCacheScope';
import { markMentorCacheStale } from '@/lib/data/mentorData';
import { markHistoryCachesStale } from '@/lib/data/historyClientData';
import { markAnalysisActivityStale } from '@/lib/data/analysisData';
import { patchUserProfileCache } from '@/lib/data/profileData';
import { getAIResultInsights, readAIInsightsCache } from '@/lib/data/aiData';
import { MENTOR_COPY, FEEDBACK_CHIPS } from '@/lib/mentorCopy';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

// ─── Display helper ───────────────────────────────────────────────────────────
const COLLECTION_DISPLAY_NAMES = { PYQ: 'SSC PYQ', Parmar: 'Parmar SSC' };
function getDisplaySubject(subject, collection) {
  if (!subject) return subject;
  if (subject === 'Mixed' && collection && collection !== 'general') {
    return COLLECTION_DISPLAY_NAMES[collection] || collection;
  }
  return subject;
}

/* ── Avatar — mirrors dashboard Avatar component exactly ── */
function ChampionAvatar({ imageUrl, name, size = 36 }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || '?').charAt(0).toUpperCase();
  if (imageUrl && !imgError) {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0 border-2 border-white/20"
        style={{ width: size, height: size }}
      >
        <img
          src={imageUrl}
          alt={name || 'avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  return (
    <div
      className="rounded-full bg-gradient-to-br from-blue-600 to-[#14B8A6] flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="font-display font-black text-white"
        style={{ fontSize: size * 0.42 }}
      >
        {initial}
      </span>
    </div>
  );
}


// Step 7: after a quiz, patch the ACCOUNT-SCOPED bootstrap cache that the
// Dashboard actually reads (`dashboard_bootstrap:u_<hash>`), so updated
// coins/level/streak appear without any extra API call. The previous unscoped
// `user_profile` write had no reader and the unscoped `dashboard_bootstrap`
// patch never reached the scoped key (Step 4) — both removed.
function patchProfileCaches(profileSnapshot, scope) {
  if (!profileSnapshot || !scope || scope === 'guest') return;
  try {
    patchCache(buildUserScopedKey(CACHE_KEYS.DASHBOARD_BOOTSTRAP, scope), data => ({
      ...(data || {}),
      profile: { ...(data?.profile || {}), ...profileSnapshot, isNewUser: false },
    }));
    // Step 12: also patch the shared profile cache (Profile/Streak/Onboarding)
    // via a safe merge so coins/level/streak/lastAttempt show with no profile GET.
    patchUserProfileCache(scope, { ...profileSnapshot, isNewUser: false });
  } catch {}
}

function patchGuestProfileCache() {
  try {
    const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
    const existing = readCache(CACHE_KEYS.GUEST_PROFILE);
    const next = {
      ...(existing?.data || {}),
      name: existing?.data?.name || 'Guest',
      playedToday: true,
      lastAttemptDate: today,
    };
    if (existing) patchCache(CACHE_KEYS.GUEST_PROFILE, () => next);
    else writeCache(CACHE_KEYS.GUEST_PROFILE, next);
  } catch {}
}

function getWeeklyPlayers(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.weeklyTop)) return data.weeklyTop;
  if (Array.isArray(data?.leaders)) return data.leaders;
  if (Array.isArray(data?.leaderboard?.weeklyTop)) return data.leaderboard.weeklyTop;
  return [];
}


function getQuizMode(result, subject) {
  if (result?.quizMode) return result.quizMode;
  if (result?.mode === 'daily' || subject === 'Daily Challenge') return 'dailychallenge';
  if (result?.mode === 'saved') return 'savedrevision';
  return 'normal';
}

function buildAttemptAnswers(result) {
  const questions = Array.isArray(result?.questions) ? result.questions : [];
  const answers = result?.answers || {};
  const answerTimes = result?.answerTimes || {};

  return questions.map((question, index) => {
    const questionId = question.questionId || question.id || `TEMP_${result?.subject || 'Quiz'}_${index + 1}`;
    const userAnswer = answers[question.id] ?? answers[questionId] ?? '';
    const isSkipped = !userAnswer || userAnswer === 'SKIPPED';
    const timeTakenSeconds = answerTimes[question.id] ?? answerTimes[questionId] ?? question.timeTakenSeconds ?? 0;
    return {
      questionId,
      userAnswer: isSkipped ? '' : userAnswer,
      correctAnswer: question.correctOption || '',
      isCorrect: !isSkipped && userAnswer === question.correctOption,
      isSkipped,
      timeTakenSeconds: Number(timeTakenSeconds) || 0,
    };
  });
}

function classifyPerformance(correctAnswers, incorrectAnswers, skipped, totalQuestions) {
  if (!totalQuestions || totalQuestions === 0) return 'AVERAGE';
  const correctRate = (correctAnswers / totalQuestions) * 100;
  const skippedRate = (skipped / totalQuestions) * 100;
  if (skippedRate >= 30) return 'LOW_CONFIDENCE';
  if (correctRate >= 80) return 'EXCELLENT';
  if (correctRate >= 65) return 'GOOD';
  if (correctRate >= 45) return 'AVERAGE';
  return 'WEAK';
}

function getResultCounts(result) {
  return {
    correctAnswers: Number(result?.correctAnswers ?? result?.correct ?? 0),
    incorrectAnswers: Number(result?.incorrectAnswers ?? result?.incorrect ?? 0),
    skipped: Number(result?.skipped ?? 0),
    totalQuestions: Number(result?.totalQuestions ?? 0),
  };
}

function readMentorReturnContext(result) {
  if (!result) return null;
  let cached = null;
  try {
    cached = JSON.parse(sessionStorage.getItem('ssc_mentor_return_context') || 'null');
  } catch {}

  const direct = result.sourceScreen === 'mentor_plan' || result.sourcePage === 'mentor'
    ? {
        sourcePage: result.sourcePage || 'mentor',
        sourceScreen: result.sourceScreen || 'mentor_plan',
        sourceTaskId: result.sourceTaskId || '',
        planId: result.planId || cached?.planId || '',
        returnUrl: result.returnUrl || '/mentor',
      }
    : null;

  if (direct?.sourceTaskId) return direct;
  if (cached?.sourceTaskId) return cached;
  return direct;
}

function isGuestMode() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(cookie => cookie.trim().startsWith('userMode=guest'));
}

function getMentorGuestSnapshotKey() {
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
  return `mentor_snapshot_v2:guest:${today}`;
}

function completeGuestMentorTask(result, mentorContext) {
  if (typeof window === 'undefined' || !mentorContext?.sourceTaskId) return;
  try {
    const rawSnapshot = localStorage.getItem(getMentorGuestSnapshotKey());
    const rawPlan = localStorage.getItem('mentor_today_plan');
    const snapshot = rawSnapshot ? JSON.parse(rawSnapshot) : null;
    const planCache = rawPlan ? JSON.parse(rawPlan) : null;
    const plan = snapshot?.plan || planCache?.plan;
    if (!plan?.tasks?.length) return;
    const now = new Date().toISOString();
    const tasks = plan.tasks.map(task => task.taskId === mentorContext.sourceTaskId ? {
      ...task,
      status: 'completed',
      completedAt: now,
      lastQuizResult: {
        subject: result.subject || '',
        topic: result.topic || '',
        accuracy: result.accuracy || 0,
        completedAt: now,
      },
    } : task);
    const nextPlan = { ...plan, tasks };
    const nextSnapshot = snapshot ? {
      ...snapshot,
      plan: nextPlan,
      activeTasks: tasks.filter(task => task.status === 'active').slice(0, 3),
      completedToday: tasks.filter(task => task.status === 'completed'),
      deferredTasks: tasks.filter(task => task.status === 'snoozed'),
      lastSyncAt: now,
    } : null;
    localStorage.setItem('mentor_today_plan', JSON.stringify({ date: getMentorGuestSnapshotKey().split(':').pop(), plan: nextPlan }));
    if (nextSnapshot) localStorage.setItem(getMentorGuestSnapshotKey(), JSON.stringify(nextSnapshot));
  } catch {}
}

async function saveQuizSession(result, routeSessionId, scoreFields = {}) {
  if (!result) return null;

  const subject = result.subject || '';
  const payload = {
    clientSessionId: result.clientSessionId || result.sessionId || routeSessionId || crypto.randomUUID(),
    startedAt: result.startedAt || new Date().toISOString(),
    subject,
    topic: result.topic || '',
    sourceCollection: result.collection || '',
    quizMode: getQuizMode(result, subject),
    timeSpentSeconds: Number(result.timeSpentSeconds || 0),
    sourceScreen: result.sourceScreen || 'unknown',
    answers: buildAttemptAnswers(result),
    // Score fields for canonical persistence (same values formerly sent to /api/score).
    ...scoreFields,
  };

  const response = await fetch('/api/quiz-session/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(responseBody?.error?.message || 'Failed to save quiz session');
  }

  if (result.isRetry && result.parentSessionId) {
    await fetch('/api/history/retry-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSessionId: payload.clientSessionId,
        parentSessionId: result.parentSessionId,
        attemptNumber: result.attemptNumber || 2,
      }),
    }).catch(() => {});
  }

  return responseBody;
}


function ScoreCircle({ pct }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const color = pct >= 75 ? 'var(--ssc-success)' : pct >= 50 ? 'var(--ssc-teal)' : pct >= 30 ? 'var(--ssc-warning)' : 'var(--ssc-danger)';
  const dash = circ - (animPct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: 124, height: 124, flexShrink: 0 }}>
      <svg width="124" height="124" viewBox="0 0 124 124">
        <circle cx="62" cy="62" r={r} fill="none" stroke="var(--ssc-border-soft)" strokeWidth="10"/>
        <circle cx="62" cy="62" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={dash}
          strokeLinecap="round" transform="rotate(-90 62 62)"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontFamily: 'Nunito, sans-serif', fontWeight: 900, fontSize: 26, color, lineHeight: 1 }}>{Math.round(pct)}%</span>
        <span style={{ fontSize: 10, color: 'var(--ssc-text-muted)', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</span>
      </div>
    </div>
  );
}

export default function Result() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [result, setResult]                   = useState(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(sessionStorage.getItem('quizResult') || 'null'); } catch { return null; }
  });
  const [aiAnalysis, setAiAnalysis]           = useState(null);
  const [aiLoading, setAiLoading]             = useState(false);
  const [aiError, setAiError]                 = useState('');
  const [coinsResult, setCoinsResult]         = useState(null);
  const [savingCoins, setSavingCoins]         = useState(false);
  const [showCoinsToast, setShowCoinsToast]   = useState(false);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [topPerformers, setTopPerformers]     = useState([]);
  const [feedback, setFeedback]               = useState('');
  const [feedbackSent, setFeedbackSent]       = useState(false);
  const [showFeedbackToast, setShowFeedbackToast] = useState(false);
  const [feedbackType, setFeedbackType]       = useState('');
  const [copied, setCopied]                   = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [showConfetti, setShowConfetti]       = useState(false);
  const [champsSlide, setChampsSlide]         = useState(0);
  const [champsPaused, setChampsPaused]       = useState(false);
  const [leaderboardRefreshing, setLeaderboardRefreshing] = useState(false);
  const [leaderboardMsg, setLeaderboardMsg]   = useState('');
  const [weeklyUpdatedAt, setWeeklyUpdatedAt] = useState(null);
  const [feedbackChip, setFeedbackChip] = useState(null);
  const [chipSent, setChipSent] = useState(false);
  const scoreSavedRef = useRef(false);
  const landingConfettiShownRef = useRef(false);
  const leaderboardRefreshedAfterScoreRef = useRef(false);
  const mentorReturnSavedRef = useRef(false);



  async function loadWeeklyLeaderboard({ forceRefresh = false, background = false } = {}) {
    if (!background) setLeaderboardRefreshing(forceRefresh);
    try {
      const result = await fetchWithClientCache({
        key: CACHE_KEYS.WEEKLY_LEADERBOARD,
        url: '/api/leaderboard?scope=weekly',
        maxAgeMs: CACHE_TTL.THIRTY_MINUTES,
        forceRefresh,
        onCache(entry) {
          const players = getWeeklyPlayers(entry.data);
          if (players.length > 0) {
            setTopPerformers(players.slice(0, 5));
            setWeeklyUpdatedAt(entry.timestamp);
          }
        },
        onFresh(data) {
          const players = getWeeklyPlayers(data);
          if (players.length > 0) setTopPerformers(players.slice(0, 5));
        },
      });
      const players = getWeeklyPlayers(result.data);
      if (players.length > 0) {
        setTopPerformers(players.slice(0, 5));
      } else {
        setLeaderboardMsg('Showing last saved leaderboard');
      }
      setWeeklyUpdatedAt(result.timestamp || Date.now());
      if (result.stale) setLeaderboardMsg('Showing last saved leaderboard');
      else if (players.length > 0) setLeaderboardMsg('');
    } catch {
      const cached = readCache(CACHE_KEYS.WEEKLY_LEADERBOARD, CACHE_TTL.THIRTY_MINUTES);
      const players = getWeeklyPlayers(cached?.data);
      if (players.length > 0) {
        setTopPerformers(players.slice(0, 5));
        setWeeklyUpdatedAt(cached.timestamp);
      }
      if (cached?.timestamp) setWeeklyUpdatedAt(cached.timestamp);
      setLeaderboardMsg('Showing last saved leaderboard');
    } finally {
      if (!background) setLeaderboardRefreshing(false);
    }
  }

  // Fetch top performers from cache first; API only when cache is absent/stale.
  useEffect(() => {
    loadWeeklyLeaderboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance Weekly Champions carousel (mirrors dashboard behaviour)
  useEffect(() => {
    if (topPerformers.length < 2 || champsPaused) return;
    const t = setInterval(() => setChampsSlide(s => (s + 1) % Math.min(topPerformers.length, 3)), 4000);
    return () => clearInterval(t);
  }, [topPerformers.length, champsPaused]);

  useEffect(() => {
    if (!result || landingConfettiShownRef.current) return;
    landingConfettiShownRef.current = true;
    if ((result.accuracy ?? 0) >= 85) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3800);
      return () => clearTimeout(t);
    }
  }, [result]);

  // Save score (logged-in only, once)
  useEffect(() => {
    if (!router.isReady) return;
    if (status !== 'authenticated') return;
    if (scoreSavedRef.current) return;
    scoreSavedRef.current = true;

    const { correct, incorrect, skipped, total, score, subject, topic, sessionId } = router.query;
    if (!correct && !result) return;

    const resolvedSubject = subject || result?.subject || '';
    const resolvedTopic = topic || result?.topic || '';
    const resolvedSessionId = sessionId || result?.sessionId || result?.clientSessionId || crypto.randomUUID();

    // Score fields previously sent to /api/score — now part of the single
    // canonical completion request to /api/quiz-session/complete.
    const scoreFields = {
      correctAnswers:   Number(correct   || result?.correct          || 0),
      incorrectAnswers: Number(incorrect || result?.incorrect        || 0),
      skipped:          Number(skipped   || result?.skipped          || 0),
      totalQuestions:   Number(total     || result?.totalQuestions   || 0),
      rawScore:         Number(score     || result?.rawScore         || 0),
      subject:          resolvedSubject,
      topic:            resolvedTopic,
      sessionId:        resolvedSessionId,
      clientSessionId:  result?.clientSessionId || resolvedSessionId,
      quizMode:         getQuizMode(result, resolvedSubject),
      sourceCollection: result?.collection || '',
      startedAt:        result?.startedAt || '',
      timeSpentSeconds: Number(result?.timeSpentSeconds || 0),
      isDailyChallenge: resolvedSubject === 'Daily Challenge',
    };

    setSavingCoins(true);
    saveQuizSession(result, resolvedSessionId, scoreFields)
      .then(data => {
        setSavingCoins(false);
        if (data && (data.ok || data.success)) {
          setCoinsResult(data);
          patchProfileCaches(data.profileSnapshot, getUserCacheScope(session));
          // Step 9: this quiz added a new session → mark account-scoped History
          // landing/summary/subjects/score caches stale (no immediate refetch;
          // next History open renders cached data + one background refresh).
          markHistoryCachesStale(getUserCacheScope(session));
          // Step 10: this quiz changed the user's real activity → mark the
          // account-scoped Analysis activity cache stale (no immediate refetch;
          // next Analysis open renders cached + one background refresh).
          markAnalysisActivityStale(getUserCacheScope(session));
          if (!leaderboardRefreshedAfterScoreRef.current) {
            leaderboardRefreshedAfterScoreRef.current = true;
            loadWeeklyLeaderboard({ forceRefresh: true, background: true });
          }
          setShowCoinsToast(true);
          setTimeout(() => setShowCoinsToast(false), 4000);
          if (data.accuracy >= 85) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3500);
          }
        }
      })
      .catch(err => {
        console.warn('[result] quiz completion save failed:', err.message);
        setSavingCoins(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router.isReady, result]);

  useEffect(() => {
    if (!router.isReady || status !== 'authenticated' || !result) return;
    if (mentorReturnSavedRef.current) return;
    const mentorContext = readMentorReturnContext(result);
    if (!mentorContext?.sourceTaskId) return;
    mentorReturnSavedRef.current = true;
    const counts = getResultCounts(result);
    fetch('/api/mentor/quiz-return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: mentorContext.sourceTaskId,
        planId: mentorContext.planId || result.planId || '',
        quizSessionId: result.clientSessionId || result.sessionId || router.query.sessionId || '',
        subject: result.subject || router.query.subject || '',
        topic: result.topic || router.query.topic || '',
        correct: counts.correctAnswers,
        incorrect: counts.incorrectAnswers,
        skipped: counts.skipped,
        totalQuestions: counts.totalQuestions,
      }),
    })
      .then(() => {
        // Step 8: quiz-return changed Mentor task/topic state. Its response
        // carries no snapshot, so mark the scoped Mentor cache stale (do NOT
        // delete it, do NOT fetch a plan here). Next Mentor open renders the
        // cached plan instantly and background-refreshes once.
        markMentorCacheStale(getUserCacheScope(session));
      })
      .catch(err => {
        console.warn('[result] mentor return save failed:', err.message);
        mentorReturnSavedRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, router.isReady, router.query.sessionId, router.query.subject, router.query.topic, status]);

  useEffect(() => {
    if (!router.isReady || status !== 'unauthenticated' || !result || !isGuestMode()) return;
    if (mentorReturnSavedRef.current) return;
    const mentorContext = readMentorReturnContext(result);
    if (!mentorContext?.sourceTaskId) return;
    mentorReturnSavedRef.current = true;
    completeGuestMentorTask(result, mentorContext);
  }, [result, router.isReady, status]);

  useEffect(() => {
    if (!result || status !== 'unauthenticated') return;
    patchGuestProfileCache();
  }, [result, status]);

  useEffect(() => {
    if (!result || !router.isReady) return;
    // Read-only: show previously generated attempt insight without a Gemini call.
    const sessionId = router.query.sessionId || result.sessionId;
    const cached = readAIInsightsCache({ scope: getUserCacheScope(session), sessionId });
    if (cached) setAiAnalysis({ summary: cached });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, router.isReady, router.query.sessionId]);

  async function handleGenerateAIAnalysis() {
    if (!result || aiLoading) return;
    const sessionId = router.query.sessionId || result.sessionId;
    setAiLoading(true);
    setAiError('');
    try {
      // Attempt-scoped helper: cache-hit → no POST; else one POST (deduped),
      // cached for 24h keyed by account scope + stable session id.
      const { text, source } = await getAIResultInsights({
        scope: getUserCacheScope(session),
        sessionId,
        payload: {
          subject:          result.subject,
          topic:            result.topic,
          totalQuestions:   result.totalQuestions,
          correctAnswers:   result.correct,
          incorrectAnswers: result.incorrect,
          skipped:          result.skipped,
          rawScore:         result.rawScore,
          accuracy:         result.accuracy,
        },
      });
      if (source === 'fallback' || !text) throw new Error('AI unavailable');
      setAiAnalysis({ summary: text });
    } catch {
      setAiError("Couldn’t generate AI analysis. Try again.");
    } finally {
      setAiLoading(false);
    }
  }

  const isGuest    = status === 'unauthenticated';
  const isLoggedIn = status === 'authenticated';
  // Index of the current user in the top-performers list (−1 if not ranked)
  const userRankIdx = isLoggedIn
    ? topPerformers.findIndex(p => p.email === session?.user?.email)
    : -1;

  useEffect(() => {
    if (!result || result.rawScore <= 0) return;

    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ['#f97316', '#7B6FD8', '#0D9488', '#E11D48', '#D97706', '#ffffff', '#16a34a'];
    const TOTAL = 120;

    const pieces = Array.from({ length: TOTAL }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      speed: Math.random() * 3 + 2,
      drift: Math.random() * 2 - 1,
      spin: Math.random() * 4 - 2,
    }));

    let frame;
    const DURATION = 3000;
    const start = performance.now();

    function draw(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach(p => {
        p.y += p.speed;
        p.x += p.drift;
        p.rotation += p.spin;

        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = elapsed < DURATION ? 1 : Math.max(0, 1 - (elapsed - DURATION) / 800);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (elapsed < DURATION + 800) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    const timeout = setTimeout(() => {
      frame = requestAnimationFrame(draw);
    }, 600);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [result]);

  function handleContinue() {
    const mentorContext = readMentorReturnContext(result);
    if (mentorContext?.sourceTaskId) {
      router.push(mentorContext.returnUrl || '/mentor');
      return;
    }
    const subject = result?.subject || router.query.subject;
    const collection = result?.collection || router.query.collection || 'general';
    if (subject === 'Mixed') {
      router.push(`/quiz?subject=Mixed&topic=Mixed&count=25&collection=${collection}&sourceScreen=history`);
      return;
    }
    router.push('/dashboard');
  }

  function handleMentorPracticeMore() {
    const mentorContext = readMentorReturnContext(result);
    const subject = result?.subject || router.query.subject || '';
    const topic = result?.topic || router.query.topic || '';
    const params = new URLSearchParams({
      subject,
      topic,
      count: '25',
      sourcePage: 'mentor',
      sourceScreen: 'mentor_plan',
      sourceTaskId: mentorContext?.sourceTaskId || '',
      planId: mentorContext?.planId || '',
      returnUrl: mentorContext?.returnUrl || '/mentor',
    });
    if (mentorContext?.planId) {
      sessionStorage.setItem('ssc_mentor_return_context', JSON.stringify({
        ...mentorContext,
        subject,
        topic,
        questionCount: 25,
      }));
    }
    router.push(`/quiz?${params.toString()}`);
  }

  function handleShareWhatsApp() {
    const msg = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster-v2.vercel.app`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function handleCopy() {
    const text = `🏆 Just climbed the leaderboard with ${result.rawScore} marks on SSC GK Score Booster!\n\nJoin me — play free SSC GK quizzes & see if you can top the chart 👇\n\n🔗 https://ssc-gk-score-booster-v2.vercel.app`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  async function handleFeedbackSubmit() {
    const feedbackMessage = feedback.trim();
    if (feedbackMessage.length < 7) return;
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Feedback_pill: feedbackType,
          Feedback_message: feedbackMessage,
          subject: result?.subject || '',
          topic: result?.topic || '',
        }),
      });
    } catch {
      // silent fail — user still sees confirmation
    }
    setFeedbackSent(true);
    setFeedback('');
    setFeedbackType('');
    setShowFeedbackToast(true);
    setTimeout(() => setShowFeedbackToast(false), 3000);
  }

  if (!result) return (
    <div suppressHydrationWarning style={{ minHeight: '100vh', background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)', padding: '32px 16px 0' }}>
      <Head><title>Result — SSC GK Score Booster</title></Head>
      <div className="skeleton h-6 w-48 rounded-lg mx-auto mb-4" />
      <div className="skeleton h-56 rounded-3xl mb-4" />
      <div className="skeleton h-20 rounded-3xl mb-4" />
      <div className="skeleton h-40 rounded-3xl" />
    </div>
  );

  return (
    <div suppressHydrationWarning style={{ minHeight: '100vh', background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)', paddingBottom: 112 }}>
      <Head><title>Result — SSC GK Score Booster</title></Head>

      <canvas
        id="confetti-canvas"
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 999 }}
      />

      <Confetti active={showConfetti} intensity="grand" />

      {coinsResult && (
        <CoinsToast
          visible={showCoinsToast}
          coins={coinsResult.coins ?? 0}
          totalCoins={coinsResult.totalCoins ?? 0}
          level={coinsResult.level}
          streakCount={coinsResult.streakCount}
          isFirstQuizOfDay={coinsResult.isFirstQuizOfDay}
          streakMilestone={coinsResult.streakMilestone}
        />
      )}

      <style suppressHydrationWarning>{`
        @keyframes cardIn  { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes stripIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes proofFade { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        .card-in     { animation: cardIn  350ms cubic-bezier(0.22,1,0.36,1) both; }
        .coins-strip-in { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 100ms both; }
        .pyq-in      { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 160ms both; }
        .mentor-in   { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 220ms both; }
        .champs-in   { animation: stripIn 300ms cubic-bezier(0.22,1,0.36,1) 280ms both; }
        .champ-slide { animation: proofFade 0.30s ease both; }
        .btn-primary { transition: transform 140ms ease, box-shadow 140ms ease; }
        .btn-primary:hover { transform: translateY(-1px); }
        @keyframes btnPulse {
          0%, 100% { box-shadow: 0 8px 22px rgba(255,122,26,0.30); }
          50%       { box-shadow: 0 12px 32px rgba(255,122,26,0.55), 0 0 0 5px rgba(255,122,26,0.10); }
        }
        .btn-pulse { animation: btnPulse 2.2s ease-in-out infinite; }
      `}</style>

      {/* ── STICKY HEADER ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30, background: 'var(--ssc-surface)', borderBottom: '1px solid var(--ssc-border-soft)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(16,32,51,0.06)' }}>
        <button
          onClick={() => router.push('/dashboard')}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          aria-label="Back to Dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <h1 className="font-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ssc-text-primary)', margin: 0 }}>Quiz Result</h1>
        <button
          onClick={handleShareWhatsApp}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          aria-label="Share result"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>

      <div style={{ maxWidth: 430, margin: '0 auto', padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── HERO ── */}
        {(() => {
          const acc = result.accuracy ?? 0;
          const firstName = (status === 'authenticated' ? session?.user?.name : null)?.split(' ')[0] || null;
          let heroTitle;
          if (acc >= 85) heroTitle = firstName ? `Excellent, ${firstName}!` : 'Excellent Work!';
          else if (acc >= 65) heroTitle = firstName ? `Strong Score, ${firstName}!` : 'Strong Score!';
          else if (acc >= 45) heroTitle = firstName ? `Good Effort, ${firstName}!` : 'Good Effort!';
          else heroTitle = firstName ? `Keep Going, ${firstName}!` : 'Keep Going!';
          return (
            <div style={{ textAlign: 'center', padding: '12px 8px 0' }}>
              <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 8 }}>
                {acc >= 75 ? '🏆' : acc >= 50 ? '⭐' : '💪'}
              </div>
              <h2 className="font-display" style={{ fontSize: 22, fontWeight: 900, color: 'var(--ssc-text-primary)', margin: '0 0 4px' }}>
                {heroTitle} 🎉
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', margin: 0 }}>You completed the quiz</p>
            </div>
          );
        })()}

        {/* ── 1. RESULT SUMMARY CARD ── */}
        {(() => {
          const acc = result.accuracy ?? 0;
          const rawScore = result.rawScore ?? 0;
          const score = rawScore % 1 === 0 ? rawScore : Number(rawScore).toFixed(1);
          const answeredCount = (result.correct || 0) + (result.incorrect || 0);
          const scoreNum = Number(rawScore);
          const scoreColor = scoreNum < 0 ? 'var(--ssc-warning)' : scoreNum === 0 ? 'var(--ssc-text-secondary)' : 'var(--ssc-orange)';

          let statusLabel, statusBg, statusBorder, statusColor;
          if (acc <= 30) {
            statusLabel = 'Needs Revision';
            statusBg = 'var(--ssc-warning-soft)'; statusBorder = 'rgba(245,158,11,0.28)'; statusColor = 'var(--ssc-warning)';
          } else if (acc <= 50) {
            statusLabel = 'Keep Practicing';
            statusBg = 'var(--ssc-info-soft)'; statusBorder = 'rgba(37,99,235,0.20)'; statusColor = 'var(--ssc-info)';
          } else if (acc <= 70) {
            statusLabel = 'Good Attempt';
            statusBg = 'var(--ssc-teal-soft)'; statusBorder = 'rgba(14,165,164,0.26)'; statusColor = 'var(--ssc-teal)';
          } else if (acc <= 85) {
            statusLabel = 'Strong Score';
            statusBg = 'var(--ssc-success-soft)'; statusBorder = 'rgba(18,184,134,0.28)'; statusColor = 'var(--ssc-success)';
          } else {
            statusLabel = 'Excellent';
            statusBg = 'rgba(246,179,49,0.14)'; statusBorder = 'rgba(246,179,49,0.32)'; statusColor = '#B77900';
          }

          const cardLabel = result.isDailyChallenge ? 'Daily Challenge Result'
            : `${getDisplaySubject(result.subject, result.collection) || 'Quiz'} Result`;

          return (
            <div className="card-in" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', borderRadius: 28, padding: '20px', boxShadow: 'var(--ssc-shadow-card)' }}>
              {/* Score circle + fraction + status */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 18 }}>
                <ScoreCircle pct={acc} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ssc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>Your Score</p>
                  <p className="font-display" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ssc-text-primary)', lineHeight: 1, margin: '0 0 10px' }}>
                    {result.correct} <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ssc-text-muted)' }}>/ {result.totalQuestions || 0}</span>
                  </p>
                  <span style={{ background: statusBg, border: `1px solid ${statusBorder}`, color: statusColor, borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
                    {statusLabel}
                  </span>
                </div>
              </div>

              {/* Correct / Wrong / Skipped / Answered */}
              <div style={{ display: 'flex', justifyContent: 'space-around', paddingTop: 12, paddingBottom: 12, borderTop: '1px solid var(--ssc-border-soft)', borderBottom: '1px solid var(--ssc-border-soft)', marginBottom: 16 }}>
                {[
                  { val: result.correct,   label: 'Correct',  color: 'var(--ssc-success)' },
                  { val: result.incorrect, label: 'Wrong',    color: 'var(--ssc-danger)' },
                  { val: result.skipped,   label: 'Skipped',  color: 'var(--ssc-text-muted)' },
                  { val: answeredCount,    label: 'Answered', color: 'var(--ssc-teal)' },
                ].map(({ val, label, color: c }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <span className="t-stat-sm font-display" style={{ color: c }}>{val}</span>
                    <span className="t-stat-label" style={{ color: 'var(--ssc-text-secondary)' }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Side-by-side CTAs */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setLoadingDetailed(true); setTimeout(() => router.push('/result/detailed'), 100); }}
                  className="t-button-sm"
                  style={{
                    flex: 1, height: 50, borderRadius: 14, cursor: 'pointer',
                    background: 'var(--ssc-teal-soft)', color: 'var(--ssc-teal)',
                    border: '1px solid rgba(14,165,164,0.28)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transform: 'scale(1)', transition: 'transform 140ms ease, background 140ms ease',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                  onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.background = 'rgba(14,165,164,0.18)'; }}
                  onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--ssc-teal-soft)'; }}
                  onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--ssc-teal-soft)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  {loadingDetailed ? 'Loading...' : 'Review Mistakes'}
                </button>
                <button
                  className="btn-pulse t-button-sm"
                  onClick={handleContinue}
                  style={{
                    flex: 1, height: 50, borderRadius: 14, cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))',
                    color: '#FFFFFF', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transform: 'translateY(0)', transition: 'transform 140ms ease, box-shadow 140ms ease',
                    fontFamily: 'Nunito, sans-serif',
                  }}
                  onPointerEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 14px 28px rgba(174,80,15,0.40)'; }}
                  onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(174,80,15,0.15)'; }}
                  onPointerUp={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                  onPointerLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                  </svg>
                  Practice Again
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── 2. COINS + STREAK STRIP ── */}
        {readMentorReturnContext(result)?.sourceTaskId ? (
          <div className="mentor-in" style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(14,165,164,0.22)', borderRadius: 20, padding: 16, borderLeft: '4px solid var(--ssc-teal)', boxShadow: 'var(--ssc-shadow-card)' }}>
            <p className="t-stat-label" style={{ color: 'var(--ssc-teal)', marginBottom: 6 }}>Mentor Next Step</p>
            <p style={{ color: 'var(--ssc-text-primary)', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>
              Result Mentor plan mein save ho jayega.
            </p>
            <p style={{ color: 'var(--ssc-text-secondary)', fontSize: 12, lineHeight: 1.55, marginBottom: 12 }}>
              Ab aap Mentor tab par return kar sakte hain, same topic practice kar sakte hain, ya result review kar sakte hain.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => router.push(readMentorReturnContext(result)?.returnUrl || '/mentor')}
                className="t-button-sm"
                style={{ width: '100%', height: 44, borderRadius: 14, border: 'none', background: 'var(--ssc-teal)', color: '#FFFFFF', cursor: 'pointer' }}
              >
                Return to Mentor Tab
              </button>
              <button
                type="button"
                onClick={handleMentorPracticeMore}
                className="t-button-sm"
                style={{ width: '100%', height: 44, borderRadius: 14, border: '1px solid var(--ssc-border-soft)', background: 'var(--ssc-surface-soft)', color: 'var(--ssc-text-primary)', cursor: 'pointer' }}
              >
                Practice More
              </button>
              <button
                type="button"
                className="t-button-sm"
                style={{ width: '100%', height: 40, borderRadius: 14, border: '1px solid var(--ssc-border-soft)', background: 'transparent', color: 'var(--ssc-text-muted)', cursor: 'default' }}
              >
                Stay on Results
              </button>
            </div>
          </div>
        ) : null}

        {savingCoins && !coinsResult && (
          <div style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(14,165,164,0.22)', borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', gap: 10, borderLeft: '4px solid var(--ssc-teal)', boxShadow: 'var(--ssc-shadow-card)' }}>
            <Loader size="sm" />
            <span style={{ fontSize: 13, color: 'var(--ssc-teal)', fontWeight: 600 }}>Saving your Coins…</span>
          </div>
        )}
        {coinsResult && (
          <div className="coins-strip-in" style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(246,179,49,0.30)', borderRadius: 20, padding: '16px 18px', boxShadow: 'var(--ssc-shadow-card)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(246,179,49,0.14)', border: '1px solid rgba(246,179,49,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 22 }}>🪙</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ssc-text-primary)', margin: '0 0 2px' }}>+{coinsResult.coins ?? 0} Coins Earned</p>
              <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', margin: 0 }}>Current Balance: {coinsResult.totalCoins ?? 0} Coins</p>
            </div>
            <span style={{ fontSize: 26, flexShrink: 0 }}>🪙</span>
          </div>
        )}
        {coinsResult?.streakCount > 0 && (
          <div className="coins-strip-in" style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(245,158,11,0.22)', borderRadius: 20, padding: '14px 18px', boxShadow: 'var(--ssc-shadow-card)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--ssc-warning-soft)', border: '1px solid rgba(245,158,11,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 20 }}>🔥</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ssc-text-primary)', margin: '0 0 2px' }}>{coinsResult.streakCount} Day Streak</p>
              <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', margin: 0 }}>Keep it up! Your streak is active.</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        )}

        {/* ── 3. SSC PYQ PRACTICE CARD ── */}
        <div
          className="pyq-in"
          onClick={() => router.push('/subjects?collection=PYQ')}
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: 'var(--ssc-surface)',
            border: '1px solid rgba(255,106,0,0.18)',
            borderRadius: 24,
            padding: 20,
            cursor: 'pointer',
            boxShadow: 'var(--ssc-shadow-card)',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '82%',
              height: '100%',
              borderTop: '2px solid rgba(249,115,22,0.72)',
              borderRight: '2px solid rgba(249,115,22,0.72)',
              borderTopRightRadius: 24,
              pointerEvents: 'none',
            }}
          />
          <div style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 14, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: 999, padding: '3px 12px' }}>
            <span className="t-badge" style={{ color: 'var(--ssc-orange-deep)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Most Useful Next Step</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 16 }}>📚</span>
            </div>
            <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', margin: 0 }}>SSC PYQ Practice</p>
          </div>
          <p className="t-card-subtitle" style={{ color: 'var(--ssc-text-secondary)', marginBottom: 14 }}>
            Practice previous year SSC questions by subject.<br />
            Choose Polity, History, Science, Geography and more.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {["7,000+ Q's", 'Exam-level Practice', 'Subject-wise'].map(tag => (
              <span key={tag} className="t-badge" style={{ color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.18)', borderRadius: 999, padding: '3px 10px' }}>
                {tag}
              </span>
            ))}
          </div>
          <button
            className="btn-pulse t-button-lg"
            onClick={() => router.push('/subjects?collection=PYQ')}
            style={{
              width: '100%', height: 52, borderRadius: 18, cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))',
              color: '#FFFFFF', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translateY(0)', transition: 'transform 140ms ease, box-shadow 140ms ease',
              fontFamily: 'Nunito, sans-serif',
            }}
            onPointerEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 16px 32px rgba(255,122,26,0.45)'; }}
            onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(255,122,26,0.15)'; }}
            onPointerUp={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
            onPointerLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = ''; }}
          >
            Start PYQ Practice →
          </button>
        </div>

        {/* ── 4. AI MENTOR ── */}
        {(() => {
          const acc = result.accuracy ?? 0;
          const wrongCount = result.incorrect || 0;
          const tip = acc <= 30
            ? `Accuracy is low right now. Start with your ${wrongCount} wrong answer${wrongCount !== 1 ? 's' : ''} — that will improve your score faster than attempting random quizzes.`
            : acc <= 50
            ? 'Keep practicing. Focus on topics where you made mistakes before attempting new ones.'
            : acc <= 70
            ? 'Good base. Your next goal should be reducing negative marks by improving accuracy.'
            : 'Strong attempt. Now practice mixed quizzes daily to improve speed and consistency.';
          return (
            <div className="mentor-in" style={{ background: 'var(--ssc-surface)', border: '1px solid rgba(14,165,164,0.20)', borderRadius: 24, padding: 20, borderLeft: '4px solid var(--ssc-teal)', boxShadow: 'var(--ssc-shadow-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(20,184,166,0.65))' }}>
                  <path d="M9 18h6M10 22h4M12 2a7 7 0 017 7c0 2.6-1.4 4.9-3.5 6.2-.5.3-.5.8-.5 1.3V17H9v-.5c0-.5 0-1-.5-1.3A7 7 0 0112 2z"/>
                </svg>
                <p className="t-section-label" style={{ color: '#14B8A6', marginBottom: 0 }}>Smart Review Tip</p>
              </div>
              <p className="t-body" style={{ color: 'var(--ssc-text-secondary)', marginBottom: 14 }}>{tip}</p>
              {aiAnalysis?.summary ? (
                <div style={{ borderRadius: 12, border: '1px solid rgba(14,165,164,0.20)', background: 'var(--ssc-teal-soft)', padding: '12px 14px' }}>
                  <p className="t-body" style={{ color: 'var(--ssc-text-primary)' }}>{aiAnalysis.summary}</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateAIAnalysis}
                  disabled={aiLoading}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    cursor: aiLoading ? 'default' : 'pointer',
                    color: 'var(--ssc-teal)', fontSize: 13, fontWeight: 600,
                    opacity: aiLoading ? 0.5 : 1,
                  }}
                >
                  {aiLoading ? 'Generating analysis...' : 'Generate Analysis →'}
                </button>
              )}
              {aiError && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--ssc-danger)' }}>{aiError}</p>}
            </div>
          );
        })()}

        {/* ── Mentor Feedback Section ── */}
        {result && (() => {
          const counts = getResultCounts(result);
          const cat = classifyPerformance(
            counts.correctAnswers,
            counts.incorrectAnswers,
            counts.skipped,
            counts.totalQuestions
          );
          const mentorContext = readMentorReturnContext(result);
          const variant = cat === 'EXCELLENT' ? 'success' : cat === 'WEAK' ? 'strict' : 'info';
          return (
            <div className="mt-4 space-y-3">
              <MentorMessage message={MENTOR_COPY[`RESULT_${cat}`]} variant={variant} />

              {!chipSent ? (
                <div>
                  <p className="text-xs mb-2" style={{ color: 'var(--ssc-text-secondary)' }}>How did this feel?</p>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_CHIPS.map(chip => (
                      <button
                        key={chip}
                        onClick={async () => {
                          setFeedbackChip(chip);
                          setChipSent(true);
                          try {
                            await fetch('/api/mentor/task-feedback', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                subject: result.subject || '',
                                topic: result.topic || '',
                                quizSessionId: coinsResult?.sessionId || '',
                                feedbackChip: chip,
                                resultCategory: cat,
                                correctRate: counts.totalQuestions > 0
                                  ? (counts.correctAnswers / counts.totalQuestions) * 100 : 0,
                                wrongRate: counts.totalQuestions > 0
                                  ? (counts.incorrectAnswers / counts.totalQuestions) * 100 : 0,
                                skippedRate: counts.totalQuestions > 0
                                  ? (counts.skipped / counts.totalQuestions) * 100 : 0,
                                totalQuestions: counts.totalQuestions,
                                quizMode: result.quizMode || 'subject_topic',
                                sourceTaskId: mentorContext?.sourceTaskId || '',
                                sourcePage: mentorContext?.sourcePage || '',
                                mentorNextAction: cat === 'EXCELLENT' || cat === 'GOOD' ? 'spaced_revision' : 'revision_followup',
                                mentorActionSavedAt: new Date().toISOString(),
                              }),
                            });
                          } catch { /* silent — feedback is non-critical */ }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                          feedbackChip === chip
                            ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-teal-50'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--ssc-orange-deep)' }}>Feedback recorded. Plan is updating.</p>
              )}

              {(cat === 'WEAK' || cat === 'AVERAGE' || cat === 'LOW_CONFIDENCE') ? (
                <button
                  onClick={() => router.push('/history/mistakes')}
                  className="w-full py-3 rounded-2xl border text-sm font-semibold"
                  style={{ background: 'var(--ssc-danger-soft)', borderColor: 'rgba(239,68,68,0.28)', color: 'var(--ssc-danger)' }}
                >
                  Review Mistakes
                </button>
              ) : (
                <button
                  onClick={() => router.push('/mentor')}
                  className="w-full py-3 rounded-2xl text-white text-sm font-semibold"
                  style={{ background: 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))', boxShadow: 'var(--ssc-shadow-cta)' }}
                >
                  Next Task
                </button>
              )}
            </div>
          );
        })()}

        {/* ── 5. GUEST SIGN-IN NUDGE ── */}
        {isGuest && (
          <GoogleSignInCard
            title="Save your progress"
            subtitle="Login to save score, Coins, streak & rank."
            buttonText="Sign in"
            callbackUrl="/dashboard"
          />
        )}

        {/* ── 6. WEEKLY CHAMPIONS ── */}
        <div
          className="champs-in"
          role="button"
          tabIndex={0}
          onClick={() => router.push('/leaderboard')}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              router.push('/leaderboard');
            }
          }}
          style={{
            background: 'var(--ssc-surface)',
            border: '1px solid var(--ssc-border-soft)',
            borderRadius: 24,
            boxShadow: 'var(--ssc-shadow-card)',
            padding: 18,
            cursor: 'pointer',
            transition: 'transform 150ms ease',
          }}
          onPointerDown={e => { setChampsPaused(true); e.currentTarget.style.transform = 'scale(0.98)'; }}
          onPointerUp={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
          onPointerLeave={e => { setChampsPaused(false); e.currentTarget.style.transform = 'scale(1)'; }}
          onTouchStart={() => setChampsPaused(true)}
          onTouchEnd={() => setChampsPaused(false)}
          onTouchCancel={() => setChampsPaused(false)}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="t-card-title font-display" style={{ color: 'var(--ssc-text-primary)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>🔥</span>
                Weekly Champions
              </p>
            </div>
            <div className="flex items-center gap-3" style={{ paddingTop: 4 }}>
              <button
                onClick={e => {
                  e.stopPropagation();
                  router.push('/leaderboard');
                }}
                className="t-button-sm flex items-center gap-1 font-sans active:opacity-70"
                style={{ color: '#14B8A6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                View your rank
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

          {leaderboardRefreshing && topPerformers.length === 0 ? (
            <div className="py-4">
              <Loader card size="sm" label="Loading weekly champions..." />
            </div>
          ) : topPerformers.length === 0 ? (
            <p className="font-sans text-xs text-center py-4" style={{ color: 'var(--ssc-text-muted)' }}>
              Showing last saved leaderboard
            </p>
          ) : (
            <>
              {/* Full-width auto-advancing card */}
              {(() => {
                const idx = champsSlide % Math.min(topPerformers.length, 3);
                const player = topPerformers[idx];
                const isSelf = player.email === session?.user?.email;
                const cardTheme = [
                  { bg: 'rgba(255,184,0,0.08)',   border: 'rgba(255,184,0,0.24)'   },
                  { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.22)' },
                  { bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.20)'    },
                ][idx];
                return (
                  <div
                    key={idx}
                    className="champ-slide"
                    style={{
                      background: cardTheme.bg,
                      border: `1px solid ${cardTheme.border}`,
                      borderRadius: 18,
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    {/* Avatar with medal badge overlaid top-left */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <ChampionAvatar imageUrl={player.image || null} name={player.name} size={36} />
                      <span style={{ position: 'absolute', top: -4, left: -4, fontSize: 16, lineHeight: 1 }}>
                        {RANK_MEDALS[idx]}
                      </span>
                    </div>

                    {/* Name + level + coins */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <p className="font-display font-bold truncate"
                          style={{ fontSize: 15, color: isSelf ? 'var(--ssc-teal)' : 'var(--ssc-text-primary)', margin: 0 }}>
                          {(player.name || 'User').split(' ')[0]}
                        </p>
                        <span style={{
                          fontSize: 10, fontWeight: 700, flexShrink: 0,
                          color: '#facc15',
                          background: 'rgba(250,204,21,0.15)',
                          border: '1px solid rgba(250,204,21,0.3)',
                          borderRadius: 20, padding: '2px 8px',
                        }}>
                          ⭐ {player.level || 'Aspirant'}
                        </span>
                        {isSelf && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, flexShrink: 0,
                            background: 'rgba(20,184,166,0.15)', color: '#14B8A6',
                            border: '1px solid rgba(20,184,166,0.30)',
                            borderRadius: 20, padding: '2px 7px',
                          }}>You</span>
                        )}
                      </div>
                    </div>

                      {/* Coins */}
                    <p className="font-display font-bold"
                      style={{ fontSize: 17, color: '#FDBA3B', margin: 0, flexShrink: 0 }}>
                      {Math.round(player.totalScore || 0).toLocaleString()} Coins
                    </p>
                  </div>
                );
              })()}

              {(leaderboardMsg || leaderboardRefreshing || weeklyUpdatedAt) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <RefreshStatus
                    updatedAt={weeklyUpdatedAt}
                    isRefreshing={leaderboardRefreshing}
                    onRefresh={e => {
                      e.stopPropagation();
                      loadWeeklyLeaderboard({ forceRefresh: true });
                    }}
                    refreshText={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/>
                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                      </svg>
                    }
                  />
                </div>
              )}

              {/* Your rank row */}
              {isLoggedIn && (
                  <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--ssc-border-soft)' }}>
                  <div className="flex items-center gap-2">
                    <span className="font-sans text-xs" style={{ color: 'var(--ssc-text-secondary)' }}>Your Rank</span>
                    <span className="font-display font-black text-base" style={{ color: 'var(--ssc-text-primary)' }}>
                      {userRankIdx !== -1 ? `#${userRankIdx + 1}` : '—'}
                    </span>
                  </div>
                  <span className="text-xs font-semibold rounded-full px-3 py-1" style={{ background: 'rgba(20,184,166,0.12)', color: '#14B8A6', border: '1px solid rgba(20,184,166,0.25)' }}>
                    ✓ Active today
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── FEEDBACK CARD ── */}
        {feedbackSent ? (
          <div style={{ borderRadius: 20, padding: 20, background: 'var(--ssc-success-soft)', border: '1px solid rgba(18,184,134,0.18)', borderLeft: '4px solid var(--ssc-success)', boxSizing: 'border-box', boxShadow: 'var(--ssc-shadow-card)' }}>
            <p style={{ fontSize: 13, color: 'var(--ssc-success)', margin: 0, fontWeight: 600 }}>Thanks for your feedback! We'll look into it.</p>
          </div>
        ) : (
          <AppCard
            as="button"
            interactive
            onClick={() => setShowFeedbackSheet(true)}
            className="w-full"
            style={{ display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box', background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', borderLeft: '4px solid var(--ssc-orange)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', boxShadow: 'var(--ssc-shadow-card)' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,122,26,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF7A1A" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ssc-text-primary)', margin: '0 0 2px' }}>Help us improve the app</p>
              <p style={{ fontSize: 11, color: 'var(--ssc-text-secondary)', margin: 0, lineHeight: 1.4 }}>Tell us what to improve, add, or fix.</p>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ffb26b' }}>Share Feedback</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffb26b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </AppCard>
        )}

        {/* ── 7. SHARE RESULT ── */}
        <AppCard style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', borderLeft: '4px solid var(--ssc-teal)', boxShadow: 'var(--ssc-shadow-card)' }}>
          <SectionHeader
            title="Share your result"
            subtitle="Challenge friends to beat your score."
            titleClassName="text-[13px]"
            subtitleClassName="text-[12px] mb-3"
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <AppButton
              as="button"
              onClick={handleShareWhatsApp}
              className="justify-center"
              style={{
                flex: 1.5, height: 48, borderRadius: 12, cursor: 'pointer',
                background: 'var(--ssc-teal)', color: '#FFFFFF', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transform: 'scale(1)', transition: 'background 140ms ease, transform 140ms ease',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; e.currentTarget.style.background = '#0F9488'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--ssc-teal)'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--ssc-teal)'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Share on WhatsApp
            </AppButton>
            <AppButton
              as="button"
              variant="secondary"
              onClick={handleCopy}
              style={{
                flex: 0.8, height: 48, borderRadius: 12, cursor: 'pointer',
                background: copied ? 'var(--ssc-teal-soft)' : 'var(--ssc-surface-soft)',
                color: copied ? 'var(--ssc-teal)' : 'var(--ssc-text-primary)',
                border: `1px solid ${copied ? 'rgba(14,165,164,0.28)' : 'var(--ssc-border-soft)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transform: 'scale(1)', transition: 'background 200ms ease, transform 140ms ease',
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.98)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {copied ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied ✓</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#93A4BC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy Result</>
              )}
            </AppButton>
          </div>
        </AppCard>


      </div>

      {loadingDetailed && (
        <Loader fullScreen size="md" label="Loading detailed analysis…" />
      )}

      {/* ── FEEDBACK SUCCESS TOAST ── */}
      {showFeedbackToast && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--ssc-overlay)',
          animation: 'backdropIn 0.2s ease both',
        }}>
          <div style={{
            background: 'var(--ssc-surface)', border: '1px solid rgba(14,165,164,0.28)',
            borderRadius: 24, padding: '28px 32px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            boxShadow: 'var(--ssc-shadow-float)',
            animation: 'toastPop 0.28s cubic-bezier(0.34,1.56,0.64,1) both',
            maxWidth: 300, width: '80%',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ssc-text-primary)', textAlign: 'center' }}>Thanks for your feedback!</p>
            <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>We'll use it to improve your quiz experience.</p>
          </div>
          <style suppressHydrationWarning>{`@keyframes toastPop { from { opacity:0; transform:scale(0.88); } to { opacity:1; transform:scale(1); } }`}</style>
        </div>
      )}

      {/* ── FEEDBACK BOTTOM SHEET ── */}
      {showFeedbackSheet && (
        <>
          <style suppressHydrationWarning>{`
            @keyframes modalIn   { from { opacity:0; transform:translate(-50%,-50%) scale(0.94); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
            @keyframes backdropIn{ from { opacity: 0; } to { opacity: 1; } }
          `}</style>

          {/* Backdrop */}
          <div
            onClick={() => setShowFeedbackSheet(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 40,
              background: 'var(--ssc-overlay)',
              animation: 'backdropIn 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          />

          {/* Modal — centered on screen */}
          <div
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'calc(100% - 48px)', maxWidth: 360,
              zIndex: 50,
              background: 'var(--ssc-surface)',
              borderRadius: 24,
              boxShadow: 'var(--ssc-shadow-float)',
              animation: 'modalIn 0.25s cubic-bezier(0.22,1,0.36,1)',
              padding: '24px 20px',
            }}
          >
            <div style={{ padding: 0 }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Orange alert icon */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,122,26,0.12)',
                    border: '1.5px solid rgba(255,122,26,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF7A1A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                      <line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                  </div>
                  <p className="font-display font-black" style={{ fontSize: 18, color: 'var(--ssc-text-primary)' }}>Report a quiz issue</p>
                </div>
                <button
                  onClick={() => setShowFeedbackSheet(false)}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--ssc-surface-soft)',
                    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ssc-text-secondary)', cursor: 'pointer', flexShrink: 0,
                  }}
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              <p className="font-sans" style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
                Found a wrong answer, typo, or confusing explanation?
              </p>

              {/* Type chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {['Wrong answer', 'Typo', 'Explanation issue', 'App issue', 'Suggestion'].map(type => {
                  const active = feedbackType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFeedbackType(active ? '' : type)}
                      onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.96)'; }}
                      onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      onPointerLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                      style={{
                        padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: active ? 'rgba(255,106,0,0.12)' : 'var(--ssc-surface-soft)',
                        border: active ? '1px solid rgba(255,106,0,0.36)' : '1px solid var(--ssc-border-soft)',
                        color: active ? 'var(--ssc-orange-deep)' : 'var(--ssc-text-secondary)',
                        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease, transform 80ms ease',
                        transform: 'scale(1)',
                      }}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>

              {/* Textarea label + input — 16px font prevents iOS auto-zoom */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ssc-text-secondary)', marginBottom: 6 }}>
                Describe the issue
              </p>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder={
                  feedbackType === 'Wrong answer'      ? 'Which option seems correct and why?' :
                  feedbackType === 'Typo'              ? 'Where did you notice the typo?' :
                  feedbackType === 'Explanation issue' ? 'What part of the explanation felt confusing?' :
                  feedbackType === 'App issue'         ? 'What happened? E.g. button not working, screen stuck…' :
                  feedbackType === 'Suggestion'        ? 'What would you like to see improved?' :
                  'Option B seems correct, but app marked C.'
                }
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--ssc-surface-soft)',
                  border: '1px solid var(--ssc-border-soft)',
                  borderRadius: 16,
                  padding: '12px 14px',
                  fontSize: 16,
                  color: 'var(--ssc-text-primary)',
                  lineHeight: 1.55,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  height: 120,
                  marginBottom: 14,
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(14,165,164,0.45)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--ssc-border-soft)'; }}
              />
              <p style={{ fontSize: 11, color: 'var(--ssc-text-muted)', marginTop: -8, marginBottom: 14 }}>
                Minimum 7 characters
              </p>

              {/* Send button — full width, Cancel removed (X button handles close) */}
              {(() => {
                const ready = feedback.trim().length >= 7;
                return (
                  <button
                    onClick={async () => { await handleFeedbackSubmit(); setShowFeedbackSheet(false); }}
                    disabled={!ready}
                    style={{
                      width: '100%', minHeight: 52, borderRadius: 16,
                      background: ready ? 'linear-gradient(135deg, var(--ssc-orange), var(--ssc-orange-deep))' : 'var(--ssc-disabled-bg)',
                      border: ready ? 'none' : '1px solid var(--ssc-border-soft)',
                      color: ready ? '#FFFFFF' : 'var(--ssc-disabled-text)',
                      fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
                      boxShadow: ready ? '0 8px 22px rgba(255,106,0,0.18)' : 'none',
                      cursor: ready ? 'pointer' : 'not-allowed',
                      transition: 'background 150ms ease, box-shadow 150ms ease, color 150ms ease, border-color 150ms ease',
                    }}
                  >
                    {ready ? 'Send Feedback →' : 'Send Feedback'}
                  </button>
                );
              })()}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
