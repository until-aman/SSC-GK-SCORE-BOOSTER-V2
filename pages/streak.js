import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BackButton from '@/components/BackButton';
import { getISTDateString } from '@/lib/streak';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getUserProfile } from '@/lib/data/profileData';

const DAY_LABELS  = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MILESTONES = [
  { days: 3,  coins: 15,  label: '3-day',   color: '#f97316', floor: '#92400E' },
  { days: 7,  coins: 30,  label: '1-week',  color: '#f97316', floor: '#92400E' },
  { days: 14, coins: 60,  label: '2-week',  color: '#f59e0b', floor: '#78350F' },
  { days: 30, coins: 150, label: '1-month', color: '#eab308', floor: '#713F12' },
  { days: 90, coins: 500, label: '3-month', color: '#0EA5A4', floor: '#0D4F47' },
];

function getStreakDays(streakCount, lastAttemptDate) {
  const todayIST  = getISTDateString();
  const todayDate = new Date(todayIST + 'T00:00:00+05:30');
  const todayIdx  = (todayDate.getDay() + 6) % 7;
  const playedToday = lastAttemptDate === todayIST;
  const done = new Set();
  const base = playedToday ? todayIdx : todayIdx - 1;
  for (let i = 0; i < Math.min(streakCount, 7); i++) {
    const idx = base - i;
    if (idx >= 0) done.add(idx);
  }
  return { done, todayIdx, playedToday };
}

function buildMonthCells(year, month, streakCount, lastAttemptDate) {
  const todayIST = getISTDateString();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getDate();
  const startDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  const playedSet    = new Set();
  const milestoneSet = new Set();
  if (lastAttemptDate && streakCount > 0) {
    const last = new Date(lastAttemptDate + 'T00:00:00+05:30');
    for (let i = 0; i < streakCount; i++) {
      const d = new Date(last);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      playedSet.add(iso);
      const dayNum = streakCount - i;
      if ([3, 7, 14, 30, 90].includes(dayNum)) milestoneSet.add(iso);
    }
  }

  const cells = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells.push({
      day: d, dateStr,
      played:      playedSet.has(dateStr),
      isMilestone: milestoneSet.has(dateStr),
      isToday:     dateStr === todayIST,
      isFuture:    dateStr > todayIST,
    });
  }
  return cells;
}

export default function StreakPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [calView, setCalView]         = useState('week');
  const [monthOffset, setMonthOffset] = useState(0);
  const [btnPress, setBtnPress]       = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.replace('/'); return; }
    getUserProfile({ scope: getUserCacheScope(session) })
      .then(res => { if (res?.data) setProfile(res.data); setLoading(false); })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router]);

  const StickyHeader = () => (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30,
      display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
      height: 56, background: 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--ssc-border-soft)',
    }}>
      <BackButton />
      <h1 className="font-display font-bold text-[18px] text-[var(--ssc-text-primary)] flex-1">Streak History</h1>
      <button
        type="button"
        className="w-9 h-9 flex items-center justify-center rounded-full"
        style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)' }}
        title="About streaks"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
    </div>
  );

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] pb-24">
        <StickyHeader />
        <div className="px-4 pt-5">
          <div className="skeleton h-36 rounded-3xl mb-4" />
          <div className="skeleton h-52 rounded-3xl" />
        </div>
      </div>
    );
  }

  const streakCount     = profile?.streakCount || 0;
  const lastAttemptDate = profile?.lastAttemptDate || '';
  const todayIST        = getISTDateString();
  const playedToday     = lastAttemptDate === todayIST;

  const { done, todayIdx } = getStreakDays(streakCount, lastAttemptDate);

  const nextMs       = MILESTONES.find(m => m.days > streakCount) || null;
  const prevMs       = [...MILESTONES].reverse().find(m => m.days <= streakCount) || null;
  const daysToNext   = nextMs ? nextMs.days - streakCount : 0;
  const progressBase = prevMs ? prevMs.days : 0;
  const progressEnd  = nextMs ? nextMs.days : streakCount || 1;
  const progress     = nextMs ? Math.max(4, ((streakCount - progressBase) / (progressEnd - progressBase)) * 100) : 100;

  const achievedMs   = MILESTONES.filter(m => m.days <= streakCount);
  const upcomingMs   = MILESTONES.filter(m => m.days > streakCount).slice(1);

  const today      = new Date();
  const viewDate   = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthCells = buildMonthCells(viewDate.getFullYear(), viewDate.getMonth(), streakCount, lastAttemptDate);
  const canGoNext  = monthOffset < 0;

  const ringR    = 26;
  const ringCirc = 2 * Math.PI * ringR;
  const ringDash = nextMs ? ringCirc - (progress / 100) * ringCirc : 0;

  return (
    <>
      <Head><title>Streak History — SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{`
        @keyframes streakPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.45); }
          50%      { box-shadow: 0 0 0 14px rgba(249,115,22,0); }
        }
        .streak-fire { animation: streakPulse 2s ease-in-out infinite; }
        @keyframes progFill { from { width: 4%; } }
        .prog-bar { animation: progFill 0.8s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes streakCtaPulse {
          0%, 100% {
            box-shadow: 0 4px 14px rgba(255,107,22,0.30);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 10px 28px rgba(255,107,22,0.48), 0 0 0 6px rgba(255,107,22,0.08);
            transform: scale(1.01);
          }
        }
      `}</style>

      <div className="min-h-screen bg-[var(--ssc-bg)]" style={{ paddingBottom: 'var(--ssc-bottom-nav-safe-padding, 178px)' }}>

        <StickyHeader />

        {/* Hero — 2-column: current streak + best streak */}
        <div className="mx-4 mt-4 rounded-3xl px-5 pt-5 pb-4" style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7E6 100%)',
          border: '1px solid rgba(246,179,49,0.34)',
          boxShadow: 'var(--ssc-shadow-card)',
        }}>
          <div style={{ display: 'flex', gap: 0 }}>
            {/* Current streak */}
            <div style={{ flex: 1, borderRight: '1px solid rgba(246,179,49,0.25)', paddingRight: 16 }}>
              <div
                className={playedToday ? 'streak-fire' : ''}
                style={{
                  width: 40, height: 40, borderRadius: 13, fontSize: 22, marginBottom: 8,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: playedToday
                    ? 'linear-gradient(145deg,#f97316,#ea580c)'
                    : 'rgba(249,115,22,0.10)',
                  border: playedToday ? 'none' : '1px solid rgba(249,115,22,0.22)',
                }}
              >🔥</div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ssc-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Current Streak
              </p>
              <p className="font-display font-black leading-none" style={{ fontSize: 36, color: 'var(--ssc-orange-deep)' }}>
                {streakCount}
              </p>
              <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', marginTop: 3 }}>Days</p>
            </div>

            {/* Best streak */}
            <div style={{ flex: 1, paddingLeft: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 13, fontSize: 22, marginBottom: 8,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(246,179,49,0.14)', border: '1px solid rgba(246,179,49,0.28)',
              }}>🏆</div>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ssc-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Best Streak
              </p>
              <p className="font-display font-black leading-none" style={{ fontSize: 36, color: 'var(--ssc-coin)' }}>
                {profile?.bestStreak || streakCount}
              </p>
              <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', marginTop: 3 }}>Days</p>
            </div>
          </div>

          <p style={{ fontSize: 13, color: 'var(--ssc-text-secondary)', marginTop: 14, lineHeight: 1.55 }}>
            {streakCount > 0
              ? (playedToday
                ? `Keep it up! You're on fire! 🔥`
                : `Don't break the chain! Play today to keep your ${streakCount}-day streak.`)
              : 'Start a quiz today to begin your streak! 💪'
            }
          </p>
        </div>

        {/* Activity card */}
        <div className="mx-4 mt-4" style={{
          background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
          borderRadius: 22, overflow: 'hidden', boxShadow: 'var(--ssc-shadow-card)',
        }}>
          {/* Header with week/month toggle */}
          <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p className="font-display font-bold text-base text-[var(--ssc-text-primary)]">Activity</p>
            <div style={{ display: 'flex', background: 'var(--ssc-surface-soft)', border: '1px solid var(--ssc-border-soft)', borderRadius: 20, padding: 3, gap: 2 }}>
              {['week', 'month'].map(v => (
                <button
                  key={v}
                  onClick={() => setCalView(v)}
                  style={{
                    padding: '4px 14px', borderRadius: 16, cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, fontFamily: 'inherit', textTransform: 'capitalize',
                    border: calView === v ? '1px solid rgba(14,165,164,0.24)' : '1px solid transparent',
                    background: calView === v ? 'var(--ssc-teal)' : 'transparent',
                    color: calView === v ? '#ffffff' : 'var(--ssc-text-secondary)',
                    transition: 'all 0.18s ease',
                  }}
                >{v}</button>
              ))}
            </div>
          </div>

          {/* Week view — check/cross icons */}
          {calView === 'week' && (
            <div style={{ padding: '14px 16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--ssc-text-secondary)', marginBottom: 3 }}>This Week</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span className="font-display font-black text-[var(--ssc-text-primary)]" style={{ fontSize: 24 }}>{done.size}</span>
                    <span style={{ fontSize: 12, color: 'var(--ssc-text-muted)' }}>/ 7 active days</span>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: playedToday ? 'var(--ssc-teal)' : 'var(--ssc-orange-deep)', marginBottom: 2 }}>
                  {playedToday ? '✓ Protected' : '⚡ Play today'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {DAY_LABELS.map((day, i) => {
                  const isDone      = done.has(i);
                  const isToday     = i === todayIdx;
                  const isTodayDone = isToday && playedToday;
                  const isTodayTodo = isToday && !playedToday;
                  const isMissed    = i < todayIdx && !isDone;

                  return (
                    <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: isToday ? 700 : 400,
                        color: isToday ? 'var(--ssc-orange-deep)' : 'var(--ssc-text-muted)',
                      }}>
                        {isToday ? 'Today' : day}
                      </span>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: (isDone || isTodayDone)
                          ? 'linear-gradient(145deg,var(--ssc-orange),var(--ssc-orange-deep))'
                          : isMissed ? 'rgba(239,68,68,0.08)' : 'transparent',
                        border: (isDone || isTodayDone) ? 'none'
                          : isTodayTodo ? '2px dashed rgba(249,115,22,0.60)'
                          : isMissed ? '1px solid rgba(239,68,68,0.25)'
                          : '1px solid var(--ssc-border-soft)',
                        boxShadow: isTodayDone ? '0 0 12px rgba(249,115,22,0.45)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        {(isDone || isTodayDone) && (
                          <span style={{ color: 'white', fontSize: 14, fontWeight: 900, lineHeight: 1 }}>✓</span>
                        )}
                        {isMissed && (
                          <span style={{ color: 'var(--ssc-danger)', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✗</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {nextMs && (
                <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', marginTop: 14, textAlign: 'center' }}>
                  Next reward in{' '}
                  <span style={{ color: nextMs.color, fontWeight: 700 }}>
                    {daysToNext} active day{daysToNext !== 1 ? 's' : ''}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* Month view — unchanged */}
          {calView === 'month' && (
            <div style={{ padding: '12px 14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button
                  onClick={() => setMonthOffset(o => o - 1)}
                  style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--ssc-surface-soft)', border: '1px solid var(--ssc-border-soft)', cursor: 'pointer', color: 'var(--ssc-text-secondary)', fontSize: 16 }}
                >‹</button>
                <span className="font-display font-bold text-sm text-[var(--ssc-text-primary)]">
                  {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
                </span>
                <button
                  onClick={() => canGoNext && setMonthOffset(o => o + 1)}
                  style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--ssc-surface-soft)', border: '1px solid var(--ssc-border-soft)', cursor: canGoNext ? 'pointer' : 'default', color: canGoNext ? 'var(--ssc-text-secondary)' : 'var(--ssc-disabled-text)', fontSize: 16 }}
                >›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 3 }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--ssc-text-muted)', fontWeight: 600 }}>{d}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
                {monthCells.map((cell, idx) => {
                  if (!cell) return <div key={`e${idx}`} />;
                  const isActive = cell.played && !cell.isFuture;
                  const cellBg = isActive
                    ? (cell.isToday ? 'rgba(249,115,22,0.26)' : 'rgba(249,115,22,0.16)')
                    : cell.isToday ? 'rgba(249,115,22,0.10)' : 'transparent';
                  const cellBorder = cell.isToday
                    ? '1px solid rgba(249,115,22,0.45)'
                    : (isActive && cell.isMilestone) ? '1px solid rgba(251,191,36,0.45)'
                    : '1px solid transparent';
                  const numColor = isActive
                    ? (cell.isToday ? '#ffffff' : '#fdba74')
                    : cell.isToday ? '#f97316'
                    : cell.isFuture ? 'var(--ssc-disabled-text)'
                    : 'var(--ssc-text-muted)';
                  return (
                    <div
                      key={cell.dateStr}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '5px 2px 4px', background: cellBg, border: cellBorder,
                        borderRadius: 7, opacity: cell.isFuture ? 0.45 : 1,
                      }}
                    >
                      <span style={{ fontSize: 11, lineHeight: 1, fontWeight: (isActive || cell.isToday) ? 700 : 400, color: numColor }}>
                        {cell.day}
                      </span>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', marginTop: 3, background: isActive ? '#f97316' : 'transparent' }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Protected / at-risk card */}
        <div className="mx-4 mt-4" style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
          background: playedToday ? 'rgba(20,184,166,0.06)' : 'rgba(249,115,22,0.06)',
          border: `1px solid ${playedToday ? 'rgba(20,184,166,0.22)' : 'rgba(249,115,22,0.22)'}`,
          borderRadius: 18, boxShadow: 'var(--ssc-shadow-card)',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: playedToday ? 'rgba(20,184,166,0.14)' : 'rgba(249,115,22,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {playedToday ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-orange-deep)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: playedToday ? 'var(--ssc-teal)' : 'var(--ssc-orange-deep)', marginBottom: 2 }}>
              {playedToday ? 'Your streak is protected' : 'Streak at risk!'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', lineHeight: 1.4 }}>
              {playedToday
                ? 'Keep it up! Practice again to extend your streak.'
                : 'Answer 1 more quiz today to keep your streak alive.'}
            </p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>

        {/* Streak Milestone card with circular ring */}
        {nextMs && (
          <div className="mx-4 mt-4" style={{
            background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
            borderRadius: 20, padding: '16px 18px', boxShadow: 'var(--ssc-shadow-card)',
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--ssc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
              Streak Milestone
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, color: 'var(--ssc-text-muted)', marginBottom: 4 }}>Next Milestone</p>
                <p className="font-display font-black" style={{ fontSize: 20, color: nextMs.color, marginBottom: 8 }}>
                  {nextMs.label} Streak
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${nextMs.color}14`, borderRadius: 99, padding: '4px 10px', marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>🪙</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: nextMs.color }}>Reward: {nextMs.coins} Coins</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--ssc-text-muted)' }}>
                  {daysToNext} more day{daysToNext !== 1 ? 's' : ''} to unlock
                </p>
              </div>
              {/* Circular ring */}
              <div style={{ position: 'relative', width: 70, height: 70, flexShrink: 0 }}>
                <svg width="70" height="70" viewBox="0 0 70 70">
                  <circle cx="35" cy="35" r={ringR} fill="none" stroke="var(--ssc-disabled-bg)" strokeWidth="6" />
                  <circle
                    cx="35" cy="35" r={ringR}
                    fill="none" stroke={nextMs.color} strokeWidth="6"
                    strokeDasharray={ringCirc} strokeDashoffset={ringDash}
                    strokeLinecap="round"
                    transform="rotate(-90 35 35)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: nextMs.color, lineHeight: 1 }}>{streakCount}/{nextMs.days}</span>
                  <span style={{ fontSize: 9, color: 'var(--ssc-text-muted)', marginTop: 2 }}>Days</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Rewards with status pills */}
        {(nextMs || upcomingMs.length > 0 || achievedMs.length > 0) && (
          <div className="mx-4 mt-4" style={{
            background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
            borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--ssc-shadow-card)',
          }}>
            <div style={{ padding: '14px 18px 5px' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ssc-text-primary)' }}>Upcoming Rewards</p>
            </div>

            {nextMs && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--ssc-border-soft)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🔥</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ssc-text-primary)' }}>{nextMs.days} Days Streak</p>
                  <p style={{ fontSize: 12, color: 'var(--ssc-text-muted)', marginTop: 1 }}>{nextMs.coins} Coins</p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--ssc-teal)',
                  background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.22)',
                  borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>In Progress</span>
              </div>
            )}

            {upcomingMs.map(m => (
              <div key={m.days} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--ssc-border-soft)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🏅</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ssc-text-secondary)' }}>{m.days} Days Streak</p>
                  <p style={{ fontSize: 12, color: 'var(--ssc-text-muted)', marginTop: 1 }}>{m.coins} Coins</p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--ssc-text-muted)',
                  background: 'var(--ssc-surface-soft)', border: '1px solid var(--ssc-border-soft)',
                  borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>Locked</span>
              </div>
            ))}

            {achievedMs.map(m => (
              <div key={m.days} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderTop: '1px solid var(--ssc-border-soft)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🏆</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ssc-text-secondary)' }}>{m.days} Days Streak</p>
                  <p style={{ fontSize: 12, color: 'var(--ssc-text-muted)', marginTop: 1 }}>{m.coins} Coins</p>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: m.color,
                  background: `${m.color}14`, border: `1px solid ${m.color}30`,
                  borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap',
                }}>✓ Earned</span>
              </div>
            ))}

            <div style={{ padding: '9px 16px', background: 'rgba(249,115,22,0.05)', borderTop: '1px solid rgba(249,115,22,0.10)' }}>
              <p style={{ fontSize: 11, color: 'rgba(249,115,22,0.58)' }}>
                💡 Bonus Coins are awarded automatically when you hit a milestone
              </p>
            </div>
          </div>
        )}

        {!nextMs && achievedMs.length === 0 && (
          <div className="mx-4 mt-4" style={{ padding: '18px', background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', borderRadius: 20, textAlign: 'center', boxShadow: 'var(--ssc-shadow-card)' }}>
            <p className="font-display font-bold text-sm" style={{ color: 'var(--ssc-teal)' }}>
              🏆 All milestones unlocked! Legend status.
            </p>
          </div>
        )}

      </div>

      {/* Sticky CTA — always visible */}
      <div style={{
        position: 'fixed', bottom: 82, left: 0, right: 0, zIndex: 40,
        padding: '12px 16px 10px',
        background: 'linear-gradient(to top, var(--ssc-bg) 70%, transparent)',
      }}>
        <button
          onPointerDown={() => setBtnPress(true)}
          onPointerUp={() => setBtnPress(false)}
          onPointerLeave={() => setBtnPress(false)}
          onClick={() => router.push('/quiz?mode=daily&sourceScreen=daily_challenge')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: 'calc(100% - 40px)', maxWidth: 390, margin: '0 auto',
            padding: '16px 0', borderRadius: 18, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 800, color: '#ffffff',
            background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)',
            boxShadow: btnPress ? '0 4px 12px rgba(255,107,22,0.22)' : '0 4px 14px rgba(255,107,22,0.30)',
            transform: btnPress ? 'scale(0.98)' : 'scale(1)',
            transition: 'transform 120ms ease, box-shadow 120ms ease',
            animation: btnPress ? 'none' : 'streakCtaPulse 2.4s ease-in-out infinite',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Play Quiz Now
        </button>
      </div>
    </>
  );
}
