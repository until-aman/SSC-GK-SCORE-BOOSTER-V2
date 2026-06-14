import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import WhatsAppBell from '@/components/WhatsAppBell';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getAnalysisActivity, readAnalysisInterest, patchAnalysisInterestState, recordAnalysisInterest } from '@/lib/data/analysisData';

// ── Design tokens (match existing app) ──────────────────────────────────
const ORANGE     = 'var(--ssc-orange)';
const ORANGE_DIM = 'rgba(255,106,0,0.12)';
const TEAL       = 'var(--ssc-teal)';
const GOLD       = 'var(--ssc-coin)';
const GOLD_DIM   = 'rgba(246,179,49,0.16)';
const BG_CARD    = 'var(--ssc-surface)';
const BG_DEEP    = 'var(--ssc-surface-soft)';
const BORDER     = 'var(--ssc-border-soft)';
const TEXT_PRI   = 'var(--ssc-text-primary)';
const TEXT_SEC   = 'var(--ssc-text-secondary)';
const TEXT_MUT   = 'var(--ssc-text-muted)';
const SOFT_SHADOW = 'var(--ssc-shadow-card)';

const card = {
  background: BG_CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 'var(--ssc-radius-card)',
  padding: '18px 20px',
  marginBottom: 16,
  boxShadow: SOFT_SHADOW,
};

// ── Inline Google SVG (matches GoogleSignInCard.js) ─────────────────────
const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const BrainSVG = ({ size = 18, color = ORANGE }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
  </svg>
);

const CheckCircle = ({ color = TEAL, size = 18 }) => (
  <div style={{
    width: size, height: size, borderRadius: 99, flexShrink: 0,
    background: 'rgba(20,184,166,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </div>
);

// ── Status tiers (derived from accuracy — never say "Poor"/"Bad") ────────
function statusFor(acc) {
  if (acc >= 80) return { label: 'Strong',  color: 'var(--ssc-success)', bg: 'var(--ssc-success-soft)', impact: 'Helping score', up: true  };
  if (acc >= 65) return { label: 'Good',    color: 'var(--ssc-rank)', bg: 'var(--ssc-info-soft)', impact: 'Helping score', up: true  };
  if (acc >= 50) return { label: 'Improve', color: 'var(--ssc-warning)', bg: 'var(--ssc-warning-soft)', impact: 'Hurting score', up: false };
  return            { label: 'Focus',   color: 'var(--ssc-danger)', bg: 'var(--ssc-danger-soft)',  impact: 'Hurting score', up: false };
}

// ── Subject health + practice plan data (STATIC SAMPLE) ──────────────────
// Biology is the weakest (42%) and is the default-selected subject.
const SUBJECTS = [
  { name: 'Polity',           acc: 78, target: 88, need: 30, marks: '4–6',  focusTopics: ['Judiciary', 'Parliament'] },
  { name: 'Modern History',   acc: 61, target: 75, need: 60, marks: '6–9',  focusTopics: ['Freedom Struggle', 'Indian Natl. Congress'] },
  { name: 'Ancient History',  acc: 69, target: 80, need: 45, marks: '4–7',  focusTopics: ['Vedic Period', 'Mauryan Empire'] },
  { name: 'Medieval History', acc: 52, target: 68, need: 70, marks: '6–9',  focusTopics: ['Delhi Sultanate', 'Mughal Empire'] },
  { name: 'Biology',          acc: 42, target: 65, need: 80, marks: '8–12', focusTopics: ['Cell Biology', 'Genetics'] },
  { name: 'Chemistry',        acc: 48, target: 65, need: 75, marks: '7–10', focusTopics: ['Periodic Table', 'Chemical Bonding'] },
  { name: 'Physics',          acc: 55, target: 70, need: 65, marks: '6–8',  focusTopics: ['Laws of Motion', 'Electricity'] },
  { name: 'Geography',        acc: 74, target: 85, need: 35, marks: '4–6',  focusTopics: ['Indian Rivers', 'Climate'] },
  { name: 'Economy',          acc: 59, target: 72, need: 60, marks: '6–8',  focusTopics: ['Budget', 'Banking'] },
  { name: 'Static GK',        acc: 68, target: 80, need: 45, marks: '4–7',  focusTopics: ['Important Days', 'Awards'] },
];

// Default-selected subject = the WEAKEST (lowest accuracy) in sample data.
const WEAKEST_SUBJECT = SUBJECTS.reduce((min, s) => (s.acc < min.acc ? s : min), SUBJECTS[0]).name;

// ── Topic data (STATIC SAMPLE) ───────────────────────────────────────────
const TOPICS = [
  { subject: 'Polity',          name: 'Judiciary',            acc: 56, attempted: 38, tags: ['Improve Fast', 'High SSC Weightage'] },
  { subject: 'Biology',         name: 'Cell Biology',         acc: 44, attempted: 34, tags: ['Improve Fast', 'High SSC Weightage'] },
  { subject: 'Polity',          name: 'Directive Principles', acc: 52, attempted: 28, tags: ['Improve Fast'] },
  { subject: 'Modern History',  name: 'Indian Natl. Congress',acc: 58, attempted: 31, tags: ['Improve Fast', 'High SSC Weightage'] },
  { subject: 'Economy',         name: 'Budget & Fiscal',      acc: 54, attempted: 29, tags: ['Improve Fast', 'High SSC Weightage'] },
  { subject: 'Physics',         name: 'Laws of Motion',       acc: 53, attempted: 33, tags: ['Improve Fast'] },
  { subject: 'Polity',          name: 'Fundamental Rights',   acc: 48, attempted: 42, tags: ['Weak Topics', 'High SSC Weightage'] },
  { subject: 'Biology',         name: 'Genetics',             acc: 41, attempted: 26, tags: ['Weak Topics', 'High SSC Weightage'] },
  { subject: 'Chemistry',       name: 'Periodic Table',       acc: 35, attempted: 24, tags: ['Weak Topics'] },
  { subject: 'Medieval History',name: 'Delhi Sultanate',      acc: 44, attempted: 22, tags: ['Weak Topics'] },
  { subject: 'Biology',         name: 'Photosynthesis',       acc: 82, attempted: 45, tags: ['Strong Topics'] },
  { subject: 'Geography',       name: 'Indian Rivers',        acc: 76, attempted: 52, tags: ['Strong Topics', 'High SSC Weightage'] },
  { subject: 'Polity',          name: 'Indian Constitution',  acc: 79, attempted: 61, tags: ['Strong Topics', 'High SSC Weightage'] },
  { subject: 'Geography',       name: 'Climate of India',     acc: 71, attempted: 47, tags: ['Strong Topics', 'High SSC Weightage'] },
];

const FILTERS = ['Improve Fast', 'Weak Topics', 'Strong Topics', 'High SSC Weightage'];
const TAG_COLOR = {
  'Improve Fast':       { color: 'var(--ssc-warning)', bg: 'var(--ssc-warning-soft)' },
  'Weak Topics':        { color: 'var(--ssc-danger)', bg: 'var(--ssc-danger-soft)'  },
  'Strong Topics':      { color: 'var(--ssc-success)', bg: 'var(--ssc-success-soft)' },
  'High SSC Weightage': { color: 'var(--ssc-rank)', bg: 'var(--ssc-info-soft)' },
};

// ── Subject emoji icons ─────────────────────────────────────────────────
const SUBJECT_EMOJI = {
  'Polity':           '⚖️',
  'Modern History':   '📖',
  'Ancient History':  '🏛️',
  'Medieval History': '🏰',
  'Biology':          '🔬',
  'Chemistry':        '⚗️',
  'Physics':          '⚡',
  'Geography':        '🌍',
  'Economy':          '💰',
  'Static GK':        '📚',
};

// ── Helpers ──────────────────────────────────────────────────────────────
function fmtCompact(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (isNaN(then)) return '';
  const diff = Math.floor((Date.now() - then.getTime()) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} hr ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1)    return 'yesterday';
  if (days < 7)      return `${days} days ago`;
  if (days < 30)     return `${Math.floor(days / 7)} wk ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

// ── Main page ────────────────────────────────────────────────────────────
export default function AnalysisPage() {
  const { data: session, status } = useSession();
  const cacheScope = getUserCacheScope(session);
  const router = useRouter();

  // Real activity data (null = loading)
  const [activity, setActivity] = useState(null);

  // Gate / reveal
  const [revealed, setRevealed] = useState(false);

  // Preview interactions
  const [selectedSubject, setSelectedSubject] = useState(WEAKEST_SUBJECT);
  const [activeFilter,    setActiveFilter]    = useState('Improve Fast');
  const [showAllTopics,   setShowAllTopics]   = useState(false);

  // Interest CTA
  const [interestRecorded, setInterestRecorded] = useState(false);
  const [ctaLoading,       setCtaLoading]       = useState(false);
  const [ctaError,         setCtaError]         = useState('');
  const [showSignIn,       setShowSignIn]       = useState(false);
  const [lockedAnalysisFeature, setLockedAnalysisFeature] = useState(null);

  // 4-tab navigation inside revealed content
  const [activeView,    setActiveView]    = useState('dashboard');
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [weakTab,       setWeakTab]       = useState('subjects');

  const planRef       = useRef(null);
  const autoCallFired = useRef(false);

  // ── On mount: read the global reveal flag (UX only, not account-specific) ──
  useEffect(() => {
    try {
      if (localStorage.getItem('analysisRevealed') === 'true') setRevealed(true);
    } catch {}
  }, []);

  // ── Account-scoped, server-confirmed interest state (Step 10/4) ───────────
  useEffect(() => {
    if (status !== 'authenticated') { setInterestRecorded(false); return; }
    setInterestRecorded(readAnalysisInterest(cacheScope));
  }, [status, cacheScope]);

  // ── Real activity: logged-in only, cache-aware (Step 10) ──────────────────
  // Guests make ZERO network calls — the static premium sample renders directly.
  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    if (status !== 'authenticated') {
      if (process.env.NODE_ENV !== 'production') console.debug('[apidiag] {"kind":"analysis","event":"analysis-guest-static-preview"}');
      setActivity({ hasHistory: false, isGuest: true });
      return;
    }
    getAnalysisActivity({ scope: cacheScope })
      .then(res => { if (!cancelled) setActivity(res?.data || { hasHistory: false }); })
      .catch(() => { if (!cancelled) setActivity({ hasHistory: false }); });
    return () => { cancelled = true; };
  }, [status, cacheScope]);

  // ── Analytics: tab opened ──────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return;
    console.log('[Analytics] analysis_tab_opened', { userId: session?.user?.email ?? 'guest' });
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Interest recording ─────────────────────────────────────────────────
  const recordInterest = useCallback(async () => {
    if (interestRecorded || autoCallFired.current) return;
    autoCallFired.current = true;
    setCtaLoading(true);
    setCtaError('');
    try {
      // Idempotent POST (server checks email+collection; client guard + module
      // in-flight dedup prevent duplicate submits). NO activity refetch.
      const data = await recordAnalysisInterest({ collection: 'AI Analysis' });
      if (data.ok) {
        // Persist only a SERVER-CONFIRMED success into account-scoped state.
        patchAnalysisInterestState(cacheScope, true);
        setInterestRecorded(true);
        console.log('[Analytics] analysis_interest_recorded', { email: session?.user?.email });
      } else if (data.guestBlocked) {
        autoCallFired.current = false;
        setShowSignIn(true);
      } else {
        autoCallFired.current = false;
        setCtaError('Something went wrong. Try again.');
      }
    } catch {
      autoCallFired.current = false;
      setCtaError('Something went wrong. Try again.');
    } finally {
      setCtaLoading(false);
    }
  }, [interestRecorded, session, cacheScope]);

  // ── Auto-record after sign-in redirect ────────────────────────────────
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (interestRecorded) return;
    if (!router.isReady) return;
    if (router.query.autoRecord !== '1') return;
    recordInterest();
  }, [status, router.isReady, router.query.autoRecord, interestRecorded, recordInterest]);

  // ── Handlers ───────────────────────────────────────────────────────────
  function handleReveal() {
    setRevealed(true);
    try { localStorage.setItem('analysisRevealed', 'true'); } catch {}
    console.log('[Analytics] analysis_preview_revealed', { userId: session?.user?.email ?? 'guest' });
  }

  function selectSubject(name) {
    setSelectedSubject(name);
    console.log('[Analytics] analysis_subject_selected', { subject: name });
    setTimeout(() => planRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }

  function scrollToInterest() {
    console.log('[Analytics] analysis_detailed_locked_clicked');
    document.getElementById('interest-cta')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleCtaClick() {
    console.log('[Analytics] analysis_cta_clicked', { userState: session ? 'logged_in' : 'guest' });
    if (!session) {
      console.log('[Analytics] analysis_guest_signin_clicked');
      setShowSignIn(true);
      return;
    }
    recordInterest();
  }

  function handleSignInClick() {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl: '/analysis?autoRecord=1' });
  }

  const selected = SUBJECTS.find(s => s.name === selectedSubject) || SUBJECTS[0];
  const hasHistory = activity?.hasHistory;

  // Derived sample stats used across views
  const avgAccuracy = Math.round(SUBJECTS.reduce((s, x) => s + x.acc, 0) / SUBJECTS.length);
  const strongCount = SUBJECTS.filter(s => s.acc >= 65).length;

  // ── Signed-in gate: Analysis is for logged-in users only ───────────────
  if (status === 'loading') {
    return (
      <>
        <Head><title>AI GK Analysis — SSC GK Score Booster</title></Head>
        <style>{`@keyframes analSpin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ minHeight: '100vh', background: 'var(--ssc-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 99, border: `3px solid ${BORDER}`, borderTopColor: ORANGE, animation: 'analSpin 0.8s linear infinite' }} />
        </div>
      </>
    );
  }

  if (!session) {
    // lucide icon paths inlined (no new dependency) — BarChart2, Target, TrendingUp, Zap
    const LucideBarChart = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>);
    const LucideTarget   = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>);
    const LucideTrending = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>);
    const LucideZap      = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>);

    const benefits = [
      {
        Icon: LucideBarChart,
        title: 'Subject Health',
        unlockTitle: 'Unlock Subject Health',
        unlockBody: 'Sign in to see your strong and weak GK subjects based on your quiz history.',
        unlockNote: 'Free • No payment • Uses your real practice data',
      },
      {
        Icon: LucideTarget,
        title: 'Practice Plan',
        unlockTitle: 'Unlock Practice Plan',
        unlockBody: 'Sign in to get a focused practice plan based on your mistakes and skipped questions.',
        unlockNote: 'Free • No payment • Built from your quiz history',
      },
      {
        Icon: LucideTrending,
        title: 'Topic Intelligence',
        unlockTitle: 'Unlock Topic Intelligence',
        unlockBody: 'Sign in to discover weak topics, repeated mistakes, and high-priority revision areas.',
        unlockNote: 'Free • No payment • Helps you revise smarter',
      },
      {
        Icon: LucideZap,
        title: 'Marks Recovery',
        unlockTitle: 'Unlock Marks Recovery',
        unlockBody: 'Sign in to find where you are losing marks and which topics can improve your score fastest.',
        unlockNote: 'Free • No payment • Based on your actual attempts',
      },
    ];

    return (
      <>
        <Head><title>AI GK Analysis — SSC GK Score Booster</title></Head>

        {/* Section 1 — Header (same as logged-in) */}
        <div
          className="sticky top-0 z-50 px-4 flex items-center justify-between"
          style={{
            height: '58px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: `1px solid ${BORDER}`,
            borderRadius: '0 0 22px 22px',
            boxShadow: SOFT_SHADOW,
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] bg-orange-500/10 flex items-center justify-center flex-shrink-0">
              <BrainSVG size={18} color="#f97316" />
            </div>
            <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center" style={{ color: TEXT_PRI }}>
              AI GK Analysis
            </span>
            <span style={{ fontSize: 9, fontWeight: 800, color: GOLD, background: GOLD_DIM, border: `1px solid ${GOLD}40`, borderRadius: 99, padding: '3px 8px', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              PREMIUM INSIGHTS
            </span>
          </div>
        </div>

        <div style={{ minHeight: '100vh', background: 'var(--ssc-bg)', padding: '22px 16px 110px', boxSizing: 'border-box' }}>

          {/* Section 2 — Single stat strip */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: BG_DEEP, border: `1px solid ${BORDER}`, borderRadius: 99,
            padding: '9px 14px', marginBottom: 18, flexWrap: 'wrap',
          }}>
            <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
              <span style={{ fontWeight: 800, color: ORANGE }}>10</span> Subjects
            </span>
            <span style={{ color: TEXT_MUT }}>·</span>
            <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
              <span style={{ fontWeight: 800, color: ORANGE }}>40+</span> Topics
            </span>
            <span style={{ color: TEXT_MUT }}>·</span>
            <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
              <span style={{ fontWeight: 800, color: ORANGE }}>18–25</span> Marks Recoverable
            </span>
          </div>

          {/* Section 3 — Compact benefit list rows (one card, settings-menu style) */}
          <div style={{ ...card, padding: '4px 16px', marginBottom: 18 }}>
            {benefits.map(({ Icon, title }, i) => (
              <button key={title} type="button" onClick={() => setLockedAnalysisFeature(benefits[i])} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 0',
                width: '100%',
                background: 'transparent',
                borderLeft: 0,
                borderRight: 0,
                borderTop: 0,
                borderBottom: i < benefits.length - 1 ? `1px solid ${BORDER}` : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: ORANGE_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon />
                </div>
                <span className="font-display" style={{ flex: 1, fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>
                  {title}
                </span>
                <span style={{ fontSize: 16, color: TEXT_MUT, flexShrink: 0 }}>→</span>
              </button>
            ))}
          </div>

          {/* Section 4 — Blurred preview hero */}
          <div style={{ position: 'relative', height: 240, borderRadius: 18, overflow: 'hidden', marginBottom: 18 }}>
            {/* Blurred mockup layer */}
            <div style={{ filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none', userSelect: 'none', padding: 4 }}>
              {/* Subject health cards row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {[['#14B8A6', '78%'], ['#EF4444', '42%'], ['#F59E0B', '61%']].map(([c, v], i) => (
                  <div key={i} style={{ flex: 1, background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 10px' }}>
                    <div style={{ width: '70%', height: 9, background: 'rgba(221,232,240,0.85)', borderRadius: 4, marginBottom: 10 }} />
                    <div style={{ fontSize: 20, fontWeight: 900, color: c, lineHeight: 1, marginBottom: 8 }}>{v}</div>
                    <div style={{ width: 44, height: 14, background: c, opacity: 0.5, borderRadius: 99 }} />
                  </div>
                ))}
              </div>
              {/* Practice plan card */}
              <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px', marginBottom: 10 }}>
                <div style={{ width: '55%', height: 11, background: 'rgba(221,232,240,0.9)', borderRadius: 4, marginBottom: 12 }} />
                <div style={{ height: 9, background: BG_DEEP, borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ width: '42%', height: '100%', background: ORANGE, borderRadius: 99 }} />
                </div>
                <div style={{ width: '40%', height: 28, background: ORANGE, opacity: 0.5, borderRadius: 10 }} />
              </div>
              {/* Topic card partial */}
              <div style={{ background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px' }}>
                <div style={{ width: '45%', height: 10, background: 'rgba(221,232,240,0.9)', borderRadius: 4, marginBottom: 10 }} />
                <div style={{ width: '70%', height: 8, background: 'rgba(221,232,240,0.72)', borderRadius: 4 }} />
              </div>
            </div>

            {/* Centered overlay card */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{
                background: 'rgba(255,255,255,0.96)', border: `1px solid ${BORDER}`,
                borderRadius: 16, padding: '18px 24px', textAlign: 'center',
                boxShadow: SOFT_SHADOW,
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, margin: '0 auto 12px', background: ORANGE_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRI, marginBottom: 4 }}>
                  Your analysis is waiting
                </div>
                <div className="font-sans" style={{ fontSize: 12, color: TEXT_MUT }}>
                  Sign in to unlock your report
                </div>
              </div>
            </div>
          </div>

        </div>
        {lockedAnalysisFeature && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="analysis-unlock-title"
            onClick={() => setLockedAnalysisFeature(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              background: 'var(--ssc-overlay)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'relative',
                width: 'min(100%, 360px)',
                background: BG_CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 20,
                padding: '24px 20px 20px',
                textAlign: 'center',
                boxShadow: 'var(--ssc-shadow-float)',
              }}
            >
              <button
                type="button"
                aria-label="Close"
                onClick={() => setLockedAnalysisFeature(null)}
                style={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  width: 34,
                  height: 34,
                  borderRadius: 12,
                  border: `1px solid ${BORDER}`,
                  background: BG_DEEP,
                  color: TEXT_MUT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: 'pointer',
                }}
              >
                &times;
              </button>
              <div style={{ width: 46, height: 46, borderRadius: 14, margin: '0 auto 14px', background: ORANGE_DIM, color: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BrainSVG size={22} color={ORANGE} />
              </div>
              <h2 id="analysis-unlock-title" className="font-display" style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.2, color: TEXT_PRI, margin: 0 }}>
                {lockedAnalysisFeature.unlockTitle}
              </h2>
              <p className="font-sans" style={{ fontSize: 13, lineHeight: 1.6, color: TEXT_SEC, margin: '12px 0 0' }}>
                {lockedAnalysisFeature.unlockBody}
              </p>
              <button
                onClick={() => {
                  document.cookie = 'userMode=; path=/; max-age=0';
                  signIn('google', { callbackUrl: '/analysis' });
                }}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 14,
                  background: '#FFFFFF',
                  color: '#0F172A',
                  border: 'none',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 20,
                }}
              >
                <GoogleSVG />
                Continue with Google
              </button>
              <p className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, margin: '12px 0 0' }}>
                {lockedAnalysisFeature.unlockNote}
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Render (signed-in) ─────────────────────────────────────────────────
  return (
    <>
      <Head><title>AI GK Analysis — SSC GK Score Booster</title></Head>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .reveal { animation: fadeUp 300ms ease-out both; }
      `}</style>

      {/* ── Section 1: Header (sticky, matches dashboard) ──────────────── */}
      <div
        className="sticky top-0 z-50 px-4 flex items-center justify-between"
        style={{
          height: '58px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: `1px solid ${BORDER}`,
            borderRadius: '0 0 22px 22px',
            boxShadow: SOFT_SHADOW,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[11px] bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <BrainSVG size={18} color="#f97316" />
          </div>
          <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center" style={{ color: TEXT_PRI }}>
            AI GK Analysis
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, color: GOLD,
            background: GOLD_DIM, border: `1px solid ${GOLD}40`,
            borderRadius: 99, padding: '3px 8px', letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          }}>
            PREMIUM INSIGHTS
          </span>
        </div>
        <WhatsAppBell />
      </div>

      <div style={{ minHeight: '100vh', background: 'var(--ssc-bg)', padding: '20px 16px 100px', boxSizing: 'border-box' }}>

        {/* ── Section 2: Your Quiz Activity Card (REAL DATA) ──────────── */}
        {activity === null ? (
          <div style={{ ...card, textAlign: 'center', color: TEXT_MUT, fontSize: 13, padding: '32px 20px' }}>
            Loading your activity…
          </div>
        ) : !hasHistory ? (
          /* Zero-history users: empty state only. Nothing else on the page. */
          <div style={{ ...card, textAlign: 'center', padding: '28px 22px' }}>
            <div style={{ fontSize: 30, marginBottom: 12 }}>📊</div>
            <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: TEXT_PRI, marginBottom: 8 }}>
              You haven&apos;t attempted any quizzes yet.
            </div>
            <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 18 }}>
              Analysis gets better as you practice.
            </p>
            <button
              onClick={() => router.push('/subjects')}
              className="btn-daily-pulse"
              style={{
                width: '100%', padding: '14px 0', borderRadius: 14,
                background: ORANGE, color: '#fff', border: 'none',
                fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Start a Quiz →
            </button>
          </div>
        ) : (
          <>
            {/* Activity card */}
            <div style={{ ...card, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" style={{ width: 44, height: 44, borderRadius: 99, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 99, background: 'linear-gradient(135deg, #FF6B16, #E55E0E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="font-display" style={{ fontSize: 19, fontWeight: 900, color: '#fff' }}>
                        {(session?.user?.name || 'G').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRI }}>
                    Your GK Journey
                  </div>
                  <div className="font-sans" style={{ fontSize: 12, color: TEXT_MUT, marginTop: 2 }}>
                    {session?.user?.name || 'Learner'}
                  </div>
                </div>
              </div>

              {/* Real metric tiles */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { icon: '🏆', value: fmtCompact(activity.totalQuizzes),   label: 'Quizzes'   },
                  { icon: '🎯', value: fmtCompact(activity.totalQuestions), label: 'Questions' },
                  { icon: '🪙', value: fmtCompact(activity.coins),          label: 'Coins'     },
                ].map(({ icon, value, label }) => (
                  <div key={label} style={{ flex: 1, background: BG_DEEP, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 15, marginBottom: 3 }}>{icon}</div>
                    <div className="font-display" style={{ fontSize: 18, fontWeight: 900, color: TEXT_PRI, lineHeight: 1 }}>{value}</div>
                    <div className="font-sans" style={{ fontSize: 10, color: TEXT_MUT, marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Most practiced + last quiz */}
              <div style={{ height: 1, background: BORDER, margin: '14px 0 12px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activity.mostPracticed && (
                  <div className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
                    Most practiced: <span style={{ fontWeight: 700, color: TEXT_PRI }}>{activity.mostPracticed}</span>
                  </div>
                )}
                {activity.lastQuizAt && (
                  <div className="font-sans" style={{ fontSize: 12, color: TEXT_SEC }}>
                    Last quiz: <span style={{ fontWeight: 700, color: TEXT_PRI }}>{timeAgo(activity.lastQuizAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Section 3: Analysis Teaser + Single Gate ──────────── */}
            {!revealed && (
              <div style={{ ...card, position: 'relative', overflow: 'hidden' }}>
                <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: TEXT_PRI, marginBottom: 14, lineHeight: 1.3 }}>
                  What&apos;s holding your GK score back?
                </div>

                {/* Frosted preview behind */}
                <div style={{ filter: 'blur(5px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.5, marginBottom: 4 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ flex: 1, height: 64, background: BG_DEEP, borderRadius: 12, border: `1px solid ${BORDER}` }} />
                    ))}
                  </div>
                  <div style={{ height: 70, background: BG_DEEP, borderRadius: 12, border: `1px solid ${BORDER}` }} />
                </div>

                {/* CTA */}
                <button
                  onClick={handleReveal}
                  className="btn-daily-pulse"
                  style={{
                    width: '100%', padding: '14px 0', borderRadius: 14, marginTop: 14,
                    background: ORANGE, color: '#fff', border: 'none',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'transform 150ms ease',
                  }}
                  onPointerDown={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onPointerUp={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  onPointerLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  See My Analysis Preview →
                </button>
                <p className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, textAlign: 'center', marginTop: 10 }}>
                  Based on students with similar quiz history
                </p>
              </div>
            )}

            {/* ── Revealed: 4-Tab Analysis Layout ───────────────────── */}
            {revealed && (
              <>
                {/* Sample label */}
                <div className="reveal" style={{ animationDelay: '0ms', display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px', marginBottom: 12 }}>
                  <span style={{ fontSize: 13 }}>📋</span>
                  <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_SEC }}>
                    Sample Analysis
                  </span>
                  <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT }}>
                    · Based on ~700Q practice pattern
                  </span>
                </div>

                {/* Tab navigation */}
                <div className="reveal" style={{
                  animationDelay: '40ms',
                  display: 'flex', gap: 8, marginBottom: 16,
                  overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
                  paddingBottom: 2,
                }}>
                  {[
                    { key: 'dashboard', label: '📊 Dashboard' },
                    { key: 'subjects',  label: '📚 Subjects'  },
                    { key: 'topics',    label: '📋 Topics'    },
                    { key: 'weak',      label: '🎯 Weak Areas' },
                  ].map(({ key, label }) => {
                    const active = activeView === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveView(key)}
                        style={{
                          flexShrink: 0, padding: '8px 16px', borderRadius: 99,
                          border: `1px solid ${active ? ORANGE : BORDER}`,
                          background: active ? ORANGE : BG_CARD,
                          color: active ? '#fff' : TEXT_SEC,
                          fontSize: 12, fontWeight: active ? 700 : 500,
                          cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                          transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
                          boxShadow: active ? 'var(--ssc-shadow-cta)' : SOFT_SHADOW,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* ── DASHBOARD VIEW ─────────────────────────────────── */}
                {activeView === 'dashboard' && (
                  <div className="reveal" style={{ animationDelay: '80ms' }}>

                    {/* Performance Overview — 2×2 stats grid */}
                    <div style={{ marginBottom: 16 }}>
                      <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRI, marginBottom: 10, padding: '0 2px' }}>
                        Performance Overview
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { emoji: '📊', value: activity.totalQuizzes, label: 'Quizzes',    sub: 'Attempted', isReal: true  },
                          { emoji: '🎯', value: `${avgAccuracy}%`,     label: 'Avg Accuracy', sub: 'Sample ✱', isReal: false },
                          { emoji: '📝', value: fmtCompact(activity.totalQuestions), label: 'Questions', sub: 'Practiced', isReal: true },
                          { emoji: '⭐', value: `${strongCount}/${SUBJECTS.length}`, label: 'Strong',    sub: 'Subjects (Sample ✱)', isReal: false },
                        ].map(({ emoji, value, label, sub, isReal }) => (
                          <div key={label} style={{
                            background: BG_CARD, border: `1px solid ${BORDER}`,
                            borderRadius: 14, padding: '14px 12px', boxShadow: SOFT_SHADOW,
                          }}>
                            <div style={{ fontSize: 20, marginBottom: 6 }}>{emoji}</div>
                            <div className="font-display" style={{ fontSize: 22, fontWeight: 900, color: TEXT_PRI, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                            <div className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_SEC }}>{label}</div>
                            <div className="font-sans" style={{ fontSize: 10, color: isReal ? TEAL : TEXT_MUT, marginTop: 2, fontWeight: 600 }}>{sub}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Subject Accuracy Snapshot — horizontal bars */}
                    <div style={{ ...card, marginBottom: 16 }}>
                      <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRI, marginBottom: 14 }}>
                        Subject Accuracy Snapshot
                      </div>
                      {[...SUBJECTS].sort((a, b) => b.acc - a.acc).map(({ name, acc }) => {
                        const st = statusFor(acc);
                        return (
                          <div key={name} style={{ marginBottom: 11 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_PRI, maxWidth: '62%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {SUBJECT_EMOJI[name] || '📚'} {name}
                              </span>
                              <span className="font-display" style={{ fontSize: 12, fontWeight: 800, color: st.color }}>{acc}%</span>
                            </div>
                            <div style={{ height: 6, background: 'var(--ssc-disabled-bg)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: `${acc}%`, height: '100%', background: st.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Performance Distribution */}
                    {(() => {
                      const total = SUBJECTS.length;
                      const distRows = [
                        { label: 'Excellent (≥80%)', count: SUBJECTS.filter(s => s.acc >= 80).length, dot: 'var(--ssc-success)' },
                        { label: 'Good (65–79%)',    count: SUBJECTS.filter(s => s.acc >= 65 && s.acc < 80).length, dot: 'var(--ssc-rank)' },
                        { label: 'Average (50–64%)', count: SUBJECTS.filter(s => s.acc >= 50 && s.acc < 65).length, dot: 'var(--ssc-warning)' },
                        { label: 'Needs Work (<50%)',count: SUBJECTS.filter(s => s.acc < 50).length, dot: 'var(--ssc-danger)' },
                      ];
                      return (
                        <div style={{ ...card, marginBottom: 16 }}>
                          <div className="font-display" style={{ fontSize: 14, fontWeight: 700, color: TEXT_PRI, marginBottom: 14 }}>
                            Performance Distribution
                          </div>
                          {distRows.map(({ label, count, dot }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                              <div style={{ width: 10, height: 10, borderRadius: 99, background: dot, flexShrink: 0 }} />
                              <span className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, flex: 1 }}>{label}</span>
                              <span className="font-display" style={{ fontSize: 14, fontWeight: 800, color: dot }}>{count}</span>
                              <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, width: 32, textAlign: 'right' }}>
                                {Math.round(count / total * 100)}%
                              </span>
                            </div>
                          ))}
                          <div style={{ height: 7, background: 'var(--ssc-disabled-bg)', borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
                            <div style={{
                              height: '100%', borderRadius: 99,
                              background: `linear-gradient(to right,
                                var(--ssc-success) ${distRows[0].count / total * 100}%,
                                var(--ssc-rank) ${(distRows[0].count + distRows[1].count) / total * 100}%,
                                var(--ssc-warning) ${(distRows[0].count + distRows[1].count + distRows[2].count) / total * 100}%,
                                var(--ssc-danger) 100%)`,
                            }} />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Navigation Tiles — 2×2 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      {[
                        { key: 'subjects', emoji: '📚', label: 'Subject Analysis', desc: 'View all 10 subjects' },
                        { key: 'topics',   emoji: '📋', label: 'Topic Analysis',   desc: 'Drill into topics'   },
                        { key: 'weak',     emoji: '🎯', label: 'Weak Areas',       desc: 'Focus & recover marks' },
                        { key: 'practice', emoji: '▶️', label: 'Practice Now',     desc: selected.name         },
                      ].map(({ key, emoji, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => key === 'practice'
                            ? router.push(`/quiz-setup?subject=${encodeURIComponent(selected.name)}&count=25&sourceScreen=analysis`)
                            : setActiveView(key)
                          }
                          style={{
                            background: BG_CARD, border: `1px solid ${BORDER}`, borderRadius: 14,
                            padding: '14px 12px', cursor: 'pointer', fontFamily: 'inherit',
                            textAlign: 'left', boxShadow: SOFT_SHADOW,
                            transition: 'border-color 150ms ease, box-shadow 150ms ease',
                          }}
                          onPointerEnter={e => { e.currentTarget.style.borderColor = ORANGE; }}
                          onPointerLeave={e => { e.currentTarget.style.borderColor = BORDER; }}
                        >
                          <div style={{ fontSize: 22, marginBottom: 6 }}>{emoji}</div>
                          <div className="font-display" style={{ fontSize: 13, fontWeight: 800, color: TEXT_PRI, marginBottom: 3 }}>{label}</div>
                          <div className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── SUBJECT ANALYSIS VIEW ─────────────────────────── */}
                {activeView === 'subjects' && (
                  <div className="reveal" style={{ animationDelay: '80ms' }}>

                    {/* Filter chips */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {[
                        { key: 'All',    label: 'All Subjects'    },
                        { key: 'Strong', label: 'Strong Subjects' },
                        { key: 'Weak',   label: 'Weak Subjects'   },
                      ].map(({ key, label }) => {
                        const active = subjectFilter === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setSubjectFilter(key)}
                            style={{
                              flexShrink: 0, padding: '7px 16px', borderRadius: 99,
                              border: `1px solid ${active ? ORANGE : BORDER}`,
                              background: active ? ORANGE : BG_CARD,
                              color: active ? '#fff' : TEXT_SEC,
                              fontSize: 13, fontWeight: active ? 700 : 500,
                              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                              transition: 'all 150ms ease',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Overall performance card */}
                    {(() => {
                      const st = statusFor(avgAccuracy);
                      return (
                        <div style={{
                          ...card, marginBottom: 14,
                          background: `linear-gradient(135deg, ${st.bg}, #FFFFFF)`,
                          border: `1px solid ${st.color}30`,
                        }}>
                          <div className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUT, marginBottom: 8 }}>
                            Overall Performance
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="font-display" style={{ fontSize: 32, fontWeight: 900, color: st.color, lineHeight: 1 }}>
                              {avgAccuracy}%
                            </span>
                            <div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 99, padding: '3px 10px', border: `1px solid ${st.color}30` }}>
                                {st.label}
                              </span>
                              <div className="font-sans" style={{ fontSize: 10, color: TEXT_MUT, marginTop: 5 }}>
                                Sample · avg across {SUBJECTS.length} subjects
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Subject rows */}
                    {(() => {
                      const filtered = subjectFilter === 'Strong'
                        ? SUBJECTS.filter(s => s.acc >= 65)
                        : subjectFilter === 'Weak'
                          ? SUBJECTS.filter(s => s.acc < 65)
                          : SUBJECTS;
                      const sorted = [...filtered].sort((a, b) => b.acc - a.acc);
                      if (sorted.length === 0) {
                        return (
                          <div style={{ ...card, textAlign: 'center', color: TEXT_MUT, fontSize: 13, padding: '32px 20px' }}>
                            No subjects in this filter.
                          </div>
                        );
                      }
                      return sorted.map(({ name, acc, marks, focusTopics }) => {
                        const st = statusFor(acc);
                        const emoji = SUBJECT_EMOJI[name] || '📚';
                        return (
                          <div key={name} style={{ ...card, marginBottom: 10, padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {/* Subject icon chip */}
                              <div style={{
                                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                                background: `${st.color}18`,
                                border: `1px solid ${st.color}28`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                              }}>
                                {emoji}
                              </div>
                              {/* Name + progress bar */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI, marginBottom: 6 }}>{name}</div>
                                <div style={{ height: 6, background: 'var(--ssc-disabled-bg)', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ width: `${acc}%`, height: '100%', background: st.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                                </div>
                              </div>
                              {/* Accuracy + status */}
                              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 4 }}>
                                <div className="font-display" style={{ fontSize: 17, fontWeight: 900, color: st.color, lineHeight: 1, marginBottom: 4 }}>{acc}%</div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 99, padding: '2px 8px' }}>
                                  {st.label}
                                </span>
                              </div>
                              {/* Practice chevron */}
                              <button
                                onClick={() => router.push(`/quiz-setup?subject=${encodeURIComponent(name)}&count=25&sourceScreen=analysis`)}
                                style={{ background: 'none', border: 'none', color: TEXT_MUT, fontSize: 20, cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1, flexShrink: 0 }}
                                title={`Practice ${name}`}
                              >
                                ›
                              </button>
                            </div>
                            {/* Sub-info row */}
                            <div className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, marginTop: 8, paddingLeft: 48 }}>
                              Focus: {focusTopics.join(', ')} · Potential: <span style={{ color: ORANGE, fontWeight: 700 }}>{marks} marks</span>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* ── TOPIC ANALYSIS VIEW ───────────────────────────── */}
                {activeView === 'topics' && (
                  <div className="reveal" style={{ animationDelay: '80ms' }}>

                    {/* Subject selector — scrollable chips */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {SUBJECTS.map(s => {
                        const active = selectedSubject === s.name;
                        return (
                          <button
                            key={s.name}
                            onClick={() => selectSubject(s.name)}
                            style={{
                              flexShrink: 0, padding: '7px 13px', borderRadius: 99,
                              border: `1px solid ${active ? ORANGE : BORDER}`,
                              background: active ? ORANGE : BG_CARD,
                              color: active ? '#fff' : TEXT_SEC,
                              fontSize: 12, fontWeight: active ? 700 : 500,
                              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                              transition: 'all 150ms ease',
                            }}
                          >
                            {SUBJECT_EMOJI[s.name] || '📚'} {s.name}
                          </button>
                        );
                      })}
                    </div>

                    {/* Summary card for selected subject */}
                    {(() => {
                      const topics = TOPICS.filter(t => t.subject === selectedSubject);
                      const totalAtt = topics.reduce((s, t) => s + t.attempted, 0);
                      const totalCorrect = topics.reduce((s, t) => s + Math.round(t.attempted * t.acc / 100), 0);
                      const totalWrong = totalAtt - totalCorrect;
                      const subAvgAcc = topics.length
                        ? Math.round(topics.reduce((s, t) => s + t.acc, 0) / topics.length)
                        : 0;
                      const st = statusFor(subAvgAcc);
                      return (
                        <div style={{ ...card, marginBottom: 14, padding: '14px 16px' }}>
                          <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI, marginBottom: 12 }}>
                            {selectedSubject} — Topic Summary
                          </div>
                          {topics.length > 0 ? (
                            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                              {[
                                { label: 'Accuracy', value: `${subAvgAcc}%`, color: st.color },
                                { label: 'Correct',  value: totalCorrect,    color: 'var(--ssc-success)' },
                                { label: 'Wrong',    value: totalWrong,      color: 'var(--ssc-danger)'  },
                                { label: 'Topics',   value: topics.length,   color: TEXT_SEC },
                              ].map(({ label, value, color }) => (
                                <div key={label} style={{ textAlign: 'center' }}>
                                  <div className="font-display" style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                                  <div className="font-sans" style={{ fontSize: 10, color: TEXT_MUT, fontWeight: 600 }}>{label}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: TEXT_MUT, fontSize: 13, padding: '8px 0' }}>
                              No topic data in sample for this subject.
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Topic rows */}
                    {(() => {
                      const topics = TOPICS.filter(t => t.subject === selectedSubject);
                      if (topics.length === 0) {
                        return (
                          <div style={{ ...card, textAlign: 'center', padding: '24px 20px', color: TEXT_MUT, fontSize: 13 }}>
                            <div style={{ fontSize: 24, marginBottom: 10 }}>📋</div>
                            No topics in sample for <strong style={{ color: TEXT_PRI }}>{selectedSubject}</strong>.
                            <br />
                            <span style={{ fontSize: 12 }}>Select another subject above to explore topics.</span>
                          </div>
                        );
                      }
                      return topics.map(({ name, acc, attempted, tags }) => {
                        const st = statusFor(acc);
                        return (
                          <div key={name} style={{ ...card, marginBottom: 10, padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI, marginBottom: 2 }}>{name}</div>
                                <div className="font-sans" style={{ fontSize: 11, color: TEXT_MUT }}>{attempted} questions attempted</div>
                              </div>
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div className="font-display" style={{ fontSize: 17, fontWeight: 900, color: st.color, lineHeight: 1, marginBottom: 4 }}>{acc}%</div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 99, padding: '2px 8px' }}>
                                  {st.label}
                                </span>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 6, background: 'var(--ssc-disabled-bg)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                              <div style={{ width: `${acc}%`, height: '100%', background: st.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                            </div>
                            {/* Tags + practice button */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                                {tags.map(tag => (
                                  <span key={tag} style={{ fontSize: 10, fontWeight: 700, color: TAG_COLOR[tag].color, background: TAG_COLOR[tag].bg, borderRadius: 99, padding: '2px 8px' }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <button
                                onClick={() => router.push(`/quiz-setup?subject=${encodeURIComponent(selectedSubject)}&topic=${encodeURIComponent(name)}&count=25&sourceScreen=analysis`)}
                                style={{ flexShrink: 0, background: ORANGE, border: 'none', borderRadius: 99, padding: '6px 13px', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'opacity 150ms ease' }}
                                onPointerDown={e => { e.currentTarget.style.opacity = '0.8'; }}
                                onPointerUp={e => { e.currentTarget.style.opacity = '1'; }}
                                onPointerLeave={e => { e.currentTarget.style.opacity = '1'; }}
                              >
                                Practice 25Q →
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* ── WEAK AREAS VIEW ───────────────────────────────── */}
                {activeView === 'weak' && (
                  <div className="reveal" style={{ animationDelay: '80ms' }}>

                    {/* Sub-tabs: By Subject / By Topic / Mistakes */}
                    <div style={{
                      display: 'flex', gap: 0, background: BG_DEEP,
                      border: `1px solid ${BORDER}`, borderRadius: 12,
                      padding: 3, marginBottom: 14,
                    }}>
                      {[
                        { key: 'subjects', label: 'By Subject' },
                        { key: 'topics',   label: 'By Topic'   },
                        { key: 'mistakes', label: 'Mistakes'   },
                      ].map(({ key, label }) => {
                        const active = weakTab === key;
                        return (
                          <button
                            key={key}
                            onClick={() => setWeakTab(key)}
                            style={{
                              flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                              background: active ? BG_CARD : 'transparent',
                              color: active ? TEXT_PRI : TEXT_MUT,
                              fontSize: 12, fontWeight: active ? 800 : 500,
                              cursor: 'pointer', fontFamily: 'inherit',
                              boxShadow: active ? SOFT_SHADOW : 'none',
                              transition: 'all 150ms ease',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Focus card */}
                    <div style={{
                      background: 'var(--ssc-danger-soft)',
                      border: '1px solid rgba(239,68,68,0.22)',
                      borderLeft: '4px solid var(--ssc-danger)',
                      borderRadius: 14, padding: '14px 16px', marginBottom: 14,
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1, marginTop: 1 }}>🎯</span>
                      <div>
                        <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: 'var(--ssc-danger)', marginBottom: 4 }}>
                          Focus on Weak Areas
                        </div>
                        <div className="font-sans" style={{ fontSize: 12, color: TEXT_SEC, lineHeight: 1.4 }}>
                          Improving these areas can recover{' '}
                          <span style={{ fontWeight: 700, color: ORANGE }}>8–14 marks</span>{' '}
                          in your next SSC exam.
                        </div>
                      </div>
                    </div>

                    {/* By Subject tab */}
                    {weakTab === 'subjects' && (() => {
                      const weakSubjects = SUBJECTS.filter(s => s.acc < 65).sort((a, b) => a.acc - b.acc);
                      return (
                        <>
                          <div className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUT, marginBottom: 10, padding: '0 2px' }}>
                            {weakSubjects.length} Subjects Need Attention
                          </div>
                          {weakSubjects.map(({ name, acc, marks, focusTopics }) => {
                            const st = statusFor(acc);
                            const emoji = SUBJECT_EMOJI[name] || '📚';
                            return (
                              <div key={name} style={{ ...card, marginBottom: 10, padding: '14px 16px', border: `1px solid ${st.color}28` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                  <div style={{
                                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                    background: `${st.color}18`, border: `1px solid ${st.color}25`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                                  }}>
                                    {emoji}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>{name}</div>
                                    <div className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      Focus: {focusTopics.join(', ')}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div className="font-display" style={{ fontSize: 18, fontWeight: 900, color: st.color, lineHeight: 1, marginBottom: 4 }}>{acc}%</div>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 99, padding: '2px 7px' }}>{st.label}</span>
                                  </div>
                                </div>
                                <div style={{ height: 5, background: 'var(--ssc-disabled-bg)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                                  <div style={{ width: `${acc}%`, height: '100%', background: st.color, borderRadius: 99 }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span className="font-sans" style={{ fontSize: 11, color: TEXT_MUT }}>
                                    Potential: <span style={{ fontWeight: 700, color: ORANGE }}>{marks} marks</span>
                                  </span>
                                  <button
                                    onClick={() => router.push(`/quiz-setup?subject=${encodeURIComponent(name)}&count=25&sourceScreen=analysis`)}
                                    style={{ background: ORANGE, border: 'none', borderRadius: 99, padding: '5px 12px', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease' }}
                                    onPointerDown={e => { e.currentTarget.style.opacity = '0.8'; }}
                                    onPointerUp={e => { e.currentTarget.style.opacity = '1'; }}
                                    onPointerLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                  >
                                    Practice →
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* By Topic tab */}
                    {weakTab === 'topics' && (() => {
                      const weakTopics = TOPICS.filter(t => t.acc < 60).sort((a, b) => a.acc - b.acc);
                      return (
                        <>
                          <div className="font-sans" style={{ fontSize: 12, fontWeight: 700, color: TEXT_MUT, marginBottom: 10, padding: '0 2px' }}>
                            {weakTopics.length} Topics Need Attention
                          </div>
                          {weakTopics.map(({ subject, name, acc, attempted, tags }) => {
                            const st = statusFor(acc);
                            return (
                              <div key={name} style={{ ...card, marginBottom: 10, padding: '14px 16px', border: `1px solid ${st.color}28` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="font-display" style={{ fontSize: 14, fontWeight: 800, color: TEXT_PRI }}>{name}</div>
                                    <div className="font-sans" style={{ fontSize: 11, color: TEXT_MUT }}>{subject} · {attempted} attempted</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div className="font-display" style={{ fontSize: 17, fontWeight: 900, color: st.color, lineHeight: 1, marginBottom: 4 }}>{acc}%</div>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 99, padding: '2px 7px' }}>{st.label}</span>
                                  </div>
                                </div>
                                <div style={{ height: 5, background: 'var(--ssc-disabled-bg)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                                  <div style={{ width: `${acc}%`, height: '100%', background: st.color, borderRadius: 99 }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                                    {tags.slice(0, 1).map(tag => (
                                      <span key={tag} style={{ fontSize: 9, fontWeight: 700, color: TAG_COLOR[tag].color, background: TAG_COLOR[tag].bg, borderRadius: 99, padding: '2px 7px' }}>{tag}</span>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => router.push(`/quiz-setup?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(name)}&count=25&sourceScreen=analysis`)}
                                    style={{ flexShrink: 0, background: ORANGE, border: 'none', borderRadius: 99, padding: '5px 12px', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease' }}
                                    onPointerDown={e => { e.currentTarget.style.opacity = '0.8'; }}
                                    onPointerUp={e => { e.currentTarget.style.opacity = '1'; }}
                                    onPointerLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                  >
                                    Practice →
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Mistakes tab */}
                    {weakTab === 'mistakes' && (
                      <div style={{ ...card, textAlign: 'center', padding: '32px 20px' }}>
                        <div style={{ fontSize: 28, marginBottom: 12 }}>📝</div>
                        <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRI, marginBottom: 8 }}>
                          Mistake Review
                        </div>
                        <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 18 }}>
                          See the questions you got wrong and practice them again to lock in your understanding.
                        </p>
                        <button
                          onClick={() => router.push('/history/mistakes')}
                          style={{
                            padding: '12px 28px', borderRadius: 12, background: ORANGE,
                            border: 'none', color: '#fff', fontSize: 14, fontWeight: 800,
                            cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 150ms ease',
                          }}
                          onPointerDown={e => { e.currentTarget.style.opacity = '0.8'; }}
                          onPointerUp={e => { e.currentTarget.style.opacity = '1'; }}
                          onPointerLeave={e => { e.currentTarget.style.opacity = '1'; }}
                        >
                          Review Mistakes →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── AI Detailed Analysis — Locked Premium Card ─────── */}
                <div className="reveal" style={{ animationDelay: '160ms' }}>
                  <div style={{
                    background: 'linear-gradient(140deg, #FFFFFF 0%, #F8FEFD 100%)',
                    border: '1px solid rgba(14,165,164,0.28)',
                    borderRadius: 20, padding: '18px 18px 16px', marginBottom: 16,
                    boxShadow: SOFT_SHADOW, position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 99, background: 'rgba(20,184,166,0.08)', filter: 'blur(24px)', pointerEvents: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(20,184,166,0.2)' }}>
                        <BrainSVG size={17} color={TEAL} />
                      </div>
                      <span className="font-display" style={{ fontSize: 16, fontWeight: 900, color: TEXT_PRI, flex: 1 }}>AI Detailed Analysis</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: TEAL, background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 99, padding: '3px 10px', letterSpacing: '0.06em', flexShrink: 0 }}>PREMIUM AI</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
                      {['Practice Gap (You vs Top Learners)', 'Mistake Pattern Breakdown', '7-Day Focused Practice Plan'].map(item => (
                        <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <CheckCircle size={18} />
                          <span className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, fontWeight: 600 }}>{item}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={scrollToInterest}
                      style={{
                        width: '100%', padding: '13px 0', borderRadius: 12,
                        background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.4)',
                        color: TEAL, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'background 150ms ease',
                      }}
                      onPointerDown={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.25)'; }}
                      onPointerUp={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.15)'; }}
                      onPointerLeave={e => { e.currentTarget.style.background = 'rgba(20,184,166,0.15)'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      View Detailed Analysis →
                    </button>
                    <p className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, textAlign: 'center', marginTop: 10 }}>
                      Available when premium launches.
                    </p>
                  </div>
                </div>

                {/* ── Interest / Notify CTA Card ─────────────────────── */}
                <div id="interest-cta" className="reveal" style={{ animationDelay: '240ms' }}>
                  <div style={{ ...card, background: 'linear-gradient(160deg, #FFFFFF 0%, #F8FEFD 58%, #FFF7E6 100%)', border: `1px solid rgba(255,106,0,0.22)`, marginBottom: 16 }}>
                    {interestRecorded ? (
                      /* State B — recorded */
                      <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 99, margin: '0 auto 12px', background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div className="font-display" style={{ fontSize: 17, fontWeight: 800, color: TEAL, marginBottom: 6 }}>You&apos;re on the list.</div>
                        <p className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, lineHeight: 1.5, marginBottom: 16 }}>
                          We&apos;ll notify you when personalized AI analysis is ready for your quiz history.
                        </p>
                        <button disabled style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: 'var(--ssc-disabled-bg)', border: `1px solid ${BORDER}`, color: TEXT_MUT, fontSize: 15, fontWeight: 700, cursor: 'default', fontFamily: 'inherit' }}>
                          Interest Recorded ✓
                        </button>
                      </div>
                    ) : showSignIn ? (
                      /* State C — guest sign-in */
                      <div>
                        <div className="font-display" style={{ fontSize: 15, fontWeight: 800, color: TEXT_PRI, marginBottom: 10 }}>Sign in to join the interest list</div>
                        <button onClick={handleSignInClick} style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#FFFFFF', color: '#0F172A', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'inherit' }}>
                          <GoogleSVG />Sign in with Google
                        </button>
                        <button onClick={() => setShowSignIn(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUT, fontSize: 12, width: '100%', marginTop: 10, padding: '4px 0', fontFamily: 'inherit' }}>Maybe later</button>
                      </div>
                    ) : (
                      /* State A — default */
                      <div>
                        <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: TEXT_PRI, marginBottom: 14, lineHeight: 1.3 }}>
                          Want this for your own quiz history?
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
                          {['Weak topics identified', 'Strongest subjects ranked', 'Personalized practice plan'].map(item => (
                            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              <CheckCircle size={18} />
                              <span className="font-sans" style={{ fontSize: 13, color: TEXT_SEC, fontWeight: 600 }}>{item}</span>
                            </div>
                          ))}
                        </div>
                        {ctaError && (
                          <p className="font-sans" style={{ fontSize: 12, color: 'var(--ssc-danger)', marginBottom: 10 }}>{ctaError}</p>
                        )}
                        <button
                          onClick={handleCtaClick}
                          disabled={ctaLoading}
                          className={ctaLoading ? '' : 'btn-daily-pulse'}
                          style={{ width: '100%', padding: '15px 0', borderRadius: 14, background: ctaLoading ? 'rgba(255,107,22,0.5)' : ORANGE, color: '#fff', border: 'none', fontSize: 15, fontWeight: 800, cursor: ctaLoading ? 'default' : 'pointer', fontFamily: 'inherit' }}
                        >
                          {ctaLoading ? 'Recording…' : 'Notify Me When It’s Ready →'}
                        </button>
                        <p className="font-sans" style={{ fontSize: 11, color: TEXT_MUT, textAlign: 'center', marginTop: 10 }}>
                          No payment now. Only interest validation.
                        </p>
                        <p className="font-sans" style={{ fontSize: 11, color: TEAL, textAlign: 'center', marginTop: 4, fontWeight: 600 }}>
                          Be among the first to access it.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Disclaimer */}
                  <p className="font-sans" style={{ fontSize: 12, color: TEXT_MUT, lineHeight: 1.55, textAlign: 'center', padding: '0 8px' }}>
                    This is a sample analysis preview based on a representative practice pattern. Your actual analysis will be generated from your own quiz history when the premium feature launches. Marks improvement estimates are indicative, not guaranteed.
                  </p>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </>
  );
}
