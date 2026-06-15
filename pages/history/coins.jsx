import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import BackButton from '@/components/BackButton';
import GoogleSignInCard from '@/components/GoogleSignInCard';
import SessionRow from '@/components/SessionRow';
import Loader from '@/components/ui/Loader';
import { getUserCacheScope } from '@/lib/userCacheScope';
import { getScoreHistory } from '@/lib/data/historyClientData';

const LEVEL_THRESHOLDS = {
  Aspirant: { min: 0, max: 200, next: 'Scholar' },
  Scholar: { min: 200, max: 600, next: 'Expert' },
  Expert: { min: 600, max: 1500, next: 'Champion' },
  Champion: { min: 1500, max: 3000, next: 'Legend' },
  Legend: { min: 3000, max: 3000, next: null },
};

const LEVEL_NUM = { Aspirant: 1, Scholar: 2, Expert: 3, Champion: 4, Legend: 5 };

const EARN_CARDS = [
  { icon: '📝', label: 'Complete Quiz', sub: '5+ questions', value: '+10', color: 'var(--ssc-teal)' },
  { icon: '🎯', label: 'Correct Answer', sub: 'Per correct answer', value: '+2', color: 'var(--ssc-teal)' },
  { icon: '🌅', label: 'Daily First Quiz', sub: 'Bonus per first quiz', value: '+10', color: 'var(--ssc-orange-deep)' },
  { icon: '🛡️', label: 'No Penalty', sub: 'Wrong or skipped', value: '-0', color: 'var(--ssc-text-muted)' },
];

export default function CoinsHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coinsBarWidth, setCoinsBarWidth] = useState(0);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const isGuest = status === 'unauthenticated';

  const fetchHistory = useCallback(() => {
    setLoading(true);
    getScoreHistory({ scope: getUserCacheScope(session) })
      .then(res => {
        if (res?.data) setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (isGuest) {
      setLoading(false);
      return;
    }
    fetchHistory();
  }, [status, isGuest, fetchHistory]);

  useEffect(() => {
    if (!data) return;
    const level = data.level || 'Aspirant';
    const thresh = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
    const isMax = !thresh.next;
    const pct = isMax
      ? 100
      : Math.min(100, ((data.totalCoins - thresh.min) / (thresh.max - thresh.min)) * 100);
    const t = setTimeout(() => setCoinsBarWidth(pct), 300);
    return () => clearTimeout(t);
  }, [data]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[var(--ssc-bg)] px-4 pt-10">
        <div className="flex items-center gap-3 mb-6">
          <BackButton />
          <h1 className="font-display font-bold text-[20px] text-[var(--ssc-text-primary)]">Coins History</h1>
        </div>
        <Loader card size="md" label="Fetching your Coins history..." />
      </div>
    );
  }

  if (isGuest) {
    return (
      <>
        <Head><title>Coins History - SSC GK Score Booster</title></Head>
        <div className="min-h-screen bg-[var(--ssc-bg)] pb-10">
          <div className="px-4 pt-10 pb-4 flex items-center gap-3">
            <BackButton />
            <h1 className="font-display font-black text-xl text-[var(--ssc-text-primary)]">Coins History</h1>
          </div>
          <GoogleSignInCard
            className="mx-4 mt-8"
            title="Track Your Progress"
            subtitle="Login to save your Coins, track streaks, and see your full quiz history."
            buttonText="Sign in"
            callbackUrl="/dashboard"
          />
        </div>
      </>
    );
  }

  const level = data?.level || 'Aspirant';
  const totalCoins = data?.totalCoins || 0;
  const FILTER_FROM = new Date('2026-05-20T00:00:00+05:30').getTime();
  const sessions = (data?.sessions || []).filter(s => {
    if (!s.timestamp) return false;
    return new Date(s.timestamp).getTime() >= FILTER_FROM;
  });
  const thresh = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS.Aspirant;
  const nextLevel = thresh.next;
  const coinsToNext = nextLevel ? thresh.max - totalCoins : 0;
  const levelNum = LEVEL_NUM[level] || 1;
  const pctText = Math.round(coinsBarWidth);

  return (
    <>
      <Head><title>Coins History - SSC GK Score Booster</title></Head>
      <style suppressHydrationWarning>{`
        @keyframes coinsCtaPulse {
          0%, 100% {
            box-shadow: 0 4px 14px rgba(255,107,22,0.30);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 10px 28px rgba(255,107,22,0.48), 0 0 0 6px rgba(255,107,22,0.08);
            transform: scale(1.01);
          }
        }
        .coins-cta-pulse {
          animation: coinsCtaPulse 2.4s ease-in-out infinite;
        }
        .coins-cta-pulse:active {
          animation: none;
          transform: scale(0.98);
          box-shadow: 0 4px 12px rgba(255,107,22,0.22);
        }
      `}</style>
      <div className="min-h-screen bg-[var(--ssc-bg)]" style={{ paddingBottom: 'var(--ssc-bottom-nav-safe-padding, 150px)' }}>

        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
          height: 56, background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--ssc-border-soft)',
        }}>
          <BackButton />
          <h1 className="font-display font-bold text-[18px] text-[var(--ssc-text-primary)] flex-1">Coins History</h1>
          <button
            type="button"
            className="w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)' }}
            title="About coins"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </button>
        </div>

        {/* Hero card */}
        <div className="mx-4 mt-4 rounded-3xl px-5 py-5" style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7E6 100%)',
          border: '1px solid rgba(246,179,49,0.34)',
          boxShadow: 'var(--ssc-shadow-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            {/* Coin icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(145deg, #FBBF24, #F59E0B)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245,158,11,0.40)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v8" />
                <path d="M9 10.5A3 3 0 0 1 12 8h2" />
                <path d="M15 13.5A3 3 0 0 1 12 16h-2" />
              </svg>
            </div>

            {/* Right content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ssc-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Total Coins
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <p className="font-display font-black" style={{ fontSize: 36, color: 'var(--ssc-orange-deep)', lineHeight: 1 }}>
                  {totalCoins}
                </p>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.24)',
                  borderRadius: 99, padding: '3px 10px',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ssc-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ssc-teal)' }}>
                    Level {levelNum} {level}
                  </span>
                </div>
              </div>

              {nextLevel && (
                <p style={{ fontSize: 12, color: 'var(--ssc-text-secondary)', marginBottom: 8 }}>
                  {coinsToNext} coins to reach{' '}
                  <span style={{ fontWeight: 700, color: 'var(--ssc-text-primary)' }}>{nextLevel}</span>
                </p>
              )}

              {/* Progress bar */}
              <div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ssc-disabled-bg)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ background: 'linear-gradient(90deg, var(--ssc-orange), var(--ssc-coin))', width: `${coinsBarWidth}%` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {nextLevel ? (
                    <>
                      <span style={{ fontSize: 10, color: 'var(--ssc-text-muted)' }}>{thresh.min}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ssc-orange-deep)' }}>{pctText}%</span>
                      <span style={{ fontSize: 10, color: 'var(--ssc-text-muted)' }}>{thresh.max}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ssc-teal)' }}>🏆 Legend — Maximum level reached!</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How to Earn Coins — 4 icon cards */}
        <div className="mx-4 mt-4">
          <p className="font-display font-bold text-sm text-[var(--ssc-text-primary)] mb-3">
            How to Earn Coins ⚡
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {EARN_CARDS.map(card => (
              <div key={card.label} style={{
                background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)',
                borderRadius: 16, padding: '14px 14px 12px',
                boxShadow: 'var(--ssc-shadow-card)',
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{card.icon}</div>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--ssc-text-primary)', marginBottom: 2 }}>{card.label}</p>
                <p style={{ fontSize: 11, color: 'var(--ssc-text-muted)', marginBottom: 8 }}>{card.sub}</p>
                <p className="font-display font-black" style={{ fontSize: 18, color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 px-3 py-2 rounded-xl" style={{ background: 'var(--ssc-teal-soft)' }}>
            <p style={{ fontSize: 11, color: 'var(--ssc-teal)' }}>💡 Coins come from correct answers, accuracy, and completion bonuses.</p>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="mx-4 mt-4">
          {sessions.length === 0 ? (
            <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={{ background: 'var(--ssc-surface)', border: '1px solid var(--ssc-border-soft)', boxShadow: 'var(--ssc-shadow-card)' }}>
              <span className="text-4xl">🎯</span>
              <p className="font-display font-bold text-base text-[var(--ssc-text-primary)]">No quizzes yet</p>
              <p className="font-sans font-medium text-sm text-[var(--ssc-text-secondary)]">Complete a quiz to start earning Coins and building your history.</p>
              <button
                onClick={() => router.push('/dashboard')}
                className="text-white rounded-2xl py-3 px-6 font-display font-bold text-sm active:scale-[0.98] transition-transform"
                style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)', boxShadow: '0 4px 12px rgba(255,107,22,0.30)' }}
              >
                Play Now →
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p className="font-display font-bold text-base text-[var(--ssc-text-primary)]">Recent Sessions</p>
                {sessions.length > 3 && (
                  <button
                    onClick={() => setShowAllSessions(v => !v)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--ssc-teal)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showAllSessions ? 'Collapse ↑' : 'View All →'}
                  </button>
                )}
              </div>
              {(showAllSessions ? sessions : sessions.slice(0, 3)).map((s, i) => (
                <SessionRow key={`${s.timestamp}-${i}`} session={s} />
              ))}
            </>
          )}
        </div>

        {/* CTA */}
        <div className="mx-4 mt-5">
          <button
            onClick={() => router.push('/dashboard')}
            className="coins-cta-pulse w-full py-4 text-white rounded-2xl font-display font-bold text-base transition-transform flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #FF8A1F, #FF5A00)', boxShadow: '0 4px 14px rgba(255,107,22,0.30)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Start Practice
          </button>
        </div>

      </div>
    </>
  );
}
