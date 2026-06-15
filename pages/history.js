import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import HistoryTopBar from '@/components/HistoryTopBar';
import Loader from '@/components/ui/Loader';

const ORANGE = '#FF6B16';
const ORANGE_DIM = 'rgba(255,107,22,0.15)';
const BG_CARD = 'var(--ssc-surface)';
const BG_DEEP = 'var(--ssc-surface-soft)';
const BORDER = 'var(--ssc-border-soft)';
const TEXT_PRI = 'var(--ssc-text-primary)';
const TEXT_SEC = 'var(--ssc-text-secondary)';
const TEXT_MUT = 'var(--ssc-text-muted)';

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#34A853" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.08 24.08 0 000 21.56l7.98-6.19z"/>
    <path fill="#FBBC05" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const ChevronSVG = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const historyFeatures = [
  {
    title: 'Quiz History',
    body: 'View all your quiz attempts and performance',
    route: '/history/quizzes',
    unlockTitle: 'Unlock Quiz History',
    unlockBody: 'Sign in to review your attempted quizzes and re-attempt mistakes.',
    unlockNote: 'Free • No payment • Saves progress across devices',
    iconColor: 'var(--ssc-teal)',
    iconBg: 'var(--ssc-teal-soft)',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </>
    ),
  },
  {
    title: 'Saved Questions',
    body: "Questions you've saved for later practice",
    route: '/history/saved',
    unlockTitle: 'Unlock Saved Questions',
    unlockBody: 'Sign in to revise your bookmarked questions across devices.',
    unlockNote: 'Free • Keeps your revision list safe',
    iconColor: ORANGE,
    iconBg: ORANGE_DIM,
    icon: (
      <>
        <path d="M6 4h12v17l-6-3-6 3V4z" />
      </>
    ),
  },
  {
    title: 'Repeated Mistakes',
    body: 'Focus on questions you get wrong repeatedly',
    route: '/history/mistakes',
    unlockTitle: 'Unlock Repeated Mistakes',
    unlockBody: 'Sign in to see questions you got wrong multiple times and practice them again.',
    unlockNote: 'Free • Helps you revise smarter',
    iconColor: 'var(--ssc-danger)',
    iconBg: 'var(--ssc-danger-soft)',
    icon: (
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      </>
    ),
  },
  {
    title: 'Coins History',
    body: 'Track your earned coins',
    isNew: true,
    route: '/history/coins',
    unlockTitle: 'Unlock Coins History',
    unlockBody: 'Sign in to track your rewards and quiz activity.',
    unlockNote: 'Free • Saves your rewards history',
    iconColor: 'var(--ssc-coin)',
    iconBg: 'rgba(246,179,49,0.14)',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v8" />
        <path d="M9 10.5A3 3 0 0 1 12 8h2" />
        <path d="M15 13.5A3 3 0 0 1 12 16h-2" />
      </>
    ),
  },
  {
    title: 'Streak History',
    body: 'Track your learning streak',
    isNew: true,
    route: '/streak',
    unlockTitle: 'Unlock Streak History',
    unlockBody: 'Sign in to track your daily practice consistency.',
    unlockNote: 'Free • Keeps your streak safe',
    iconColor: '#f97316',
    iconBg: 'rgba(249,115,22,0.12)',
    icon: (
      <>
        <path d="M8 14a4 4 0 1 0 8 0c0-3-4-4-2.5-9C10 7 8 10 8 14z" />
        <path d="M12 18a2 2 0 0 0 2-2c0-1.5-2-2-1.2-4.5C11 12.6 10 14 10 16a2 2 0 0 0 2 2z" />
      </>
    ),
  },
  {
    title: 'Reports',
    body: 'Detailed performance reports & insights',
    route: '/analysis',
    unlockTitle: 'Unlock Reports',
    unlockBody: 'Sign in to view your GK analysis, weak areas, and weekly reports.',
    unlockNote: 'Free • No payment • Uses your real practice data',
    iconColor: '#3B82F6',
    iconBg: 'rgba(59,130,246,0.12)',
    icon: (
      <>
        <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z" />
      </>
    ),
  },
];

function FeatureIcon({ children, iconColor, iconBg }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 13,
        background: iconBg || ORANGE_DIM,
        color: iconColor || ORANGE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  );
}

const HistoryHeaderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

const SHARED_STYLES = `
  .history-intro { margin-bottom: 20px; }
  .history-intro-title { font-size: 22px; font-weight: 900; color: ${TEXT_PRI}; margin: 0 0 4px; line-height: 1.2; }
  .history-intro-body { font-size: 13px; color: ${TEXT_SEC}; margin: 0; line-height: 1.5; }
  .history-list-card {
    background: ${BG_CARD};
    border: 1px solid ${BORDER};
    border-radius: 20px;
    padding: 4px 16px;
    box-shadow: var(--ssc-shadow-card);
  }
  .history-feature-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px solid ${BORDER};
    width: 100%;
    background: transparent;
    border-left: 0;
    border-right: 0;
    border-top: 0;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .history-feature-row:active { transform: scale(.99); }
  .history-feature-row:last-child { border-bottom: none; }
  .history-feature-title {
    display: block;
    font-size: 14px;
    font-weight: 900;
    color: ${TEXT_PRI};
    line-height: 1.3;
  }
  .history-feature-body {
    display: block;
    font-size: 12px;
    color: ${TEXT_SEC};
    margin-top: 3px;
    line-height: 1.4;
  }
`;

function HistoryGuestState() {
  const [lockedFeature, setLockedFeature] = useState(null);

  function handleSignIn(feature) {
    document.cookie = 'userMode=; path=/; max-age=0';
    signIn('google', { callbackUrl: feature?.route || '/history' });
  }

  return (
    <>
      <Head><title>History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
        <style>{`
          ${SHARED_STYLES}
          .history-google-btn {
            width: 100%;
            border: none;
            border-radius: 14px;
            padding: 14px 0;
            background: #fff;
            color: var(--ssc-text-primary);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-size: 15px;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
          }
          .history-google-btn:active { transform: scale(.98); }
          .history-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 80;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: var(--ssc-overlay);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }
          .history-modal-card {
            position: relative;
            width: min(100%, 360px);
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 20px;
            padding: 24px 20px 20px;
            text-align: center;
            box-shadow: var(--ssc-shadow-float);
          }
          .history-modal-close {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 34px;
            height: 34px;
            border-radius: 12px;
            border: 1px solid ${BORDER};
            background: ${BG_DEEP};
            color: ${TEXT_MUT};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            line-height: 1;
            cursor: pointer;
          }
          .history-modal-close:active { transform: scale(.96); }
          .history-modal-lock {
            width: 46px;
            height: 46px;
            border-radius: 14px;
            margin: 0 auto 14px;
            background: ${ORANGE_DIM};
            color: ${ORANGE};
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .history-guest-content {
            background: linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%);
            min-height: calc(100dvh - 58px);
            display: flex;
            flex-direction: column;
            padding: 22px 16px calc(94px + env(safe-area-inset-bottom));
            box-sizing: border-box;
          }
          .history-preview-shell {
            position: relative;
            height: 320px;
            margin-top: auto;
            overflow: hidden;
            border-radius: 18px;
            background: transparent;
            flex: 0 0 auto;
          }
          .history-preview-blur {
            filter: blur(6px);
            opacity: .4;
            pointer-events: none;
            user-select: none;
            padding: 4px;
          }
          .history-lock-card {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            pointer-events: none;
          }
          .history-preview-block {
            background: ${BG_CARD};
            border: 1px solid ${BORDER};
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
            box-shadow: var(--ssc-shadow-card);
          }
          @media (max-height: 700px) { .history-preview-shell { height: 260px; } }
        `}</style>

        <div
          className="sticky top-0 z-50 px-4 flex items-center justify-between"
          style={{
            height: '58px',
            background: 'rgba(255,255,255,0.94)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderBottom: '1px solid var(--ssc-border-soft)',
            borderRadius: '0 0 22px 22px',
            boxShadow: '0 10px 30px rgba(16,32,51,0.08)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[11px] flex items-center justify-center flex-shrink-0" style={{ background: ORANGE_DIM }}>
              <HistoryHeaderIcon />
            </div>
            <span className="font-display font-black text-[18px] tracking-wide leading-none whitespace-nowrap self-center" style={{ color: TEXT_PRI }}>
              History
            </span>
          </div>
        </div>

        <div className="history-guest-content">

          <div className="history-intro">
            <h2 className="history-intro-title font-display">Review &amp; Improve</h2>
            <p className="history-intro-body">Choose what you want to review today</p>
          </div>

          <section className="history-list-card mb-5">
            {historyFeatures.map(feature => (
              <button key={feature.title} type="button" className="history-feature-row" onClick={() => setLockedFeature(feature)}>
                <FeatureIcon iconColor={feature.iconColor} iconBg={feature.iconBg}>{feature.icon}</FeatureIcon>
                <div className="min-w-0 flex-1">
                  <span className="history-feature-title font-display">{feature.title}</span>
                  <span className="history-feature-body">{feature.body}</span>
                </div>
                {feature.isNew && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.22)', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>New</span>
                )}
                <ChevronSVG />
              </button>
            ))}
          </section>

          <section className="history-preview-shell">
            <div className="history-preview-blur">
              {[
                { title: 'Polity • Fundamental Rights', meta: '68% Accuracy', body: 'Review / Re-attempt', accent: ORANGE },
                { title: 'Saved Question', meta: 'Question preview', body: 'Saved for revision', accent: '#14B8A6' },
                { title: 'Repeated Mistake', meta: 'Wrong 3x', body: 'Practice now', accent: '#EF4444' },
                { title: 'Rewards', meta: 'Total Coins', body: 'Weekly rewards', accent: '#F59E0B' },
              ].map(({ title, meta, body, accent }) => (
                <div key={title} className="history-preview-block">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-display font-black text-[14px]" style={{ color: TEXT_PRI }}>{title}</p>
                      <p className="font-sans text-[11px] mt-1" style={{ color: TEXT_MUT }}>{meta}</p>
                    </div>
                    <div className="h-8 w-8 rounded-xl" style={{ background: `${accent}33` }} />
                  </div>
                  <p className="font-sans text-[12px] mt-3" style={{ color: TEXT_SEC }}>{body}</p>
                  <div className="h-2 w-2/3 rounded mt-3" style={{ background: 'var(--ssc-border-soft)' }} />
                </div>
              ))}
            </div>
            <div className="history-lock-card">
              <div className="text-center rounded-2xl px-6 py-[18px]" style={{ background: 'rgba(255,255,255,.94)', border: `1px solid ${BORDER}`, boxShadow: 'var(--ssc-shadow-float)' }}>
                <div className="w-[42px] h-[42px] rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: ORANGE_DIM }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <p className="font-display text-[15px] font-extrabold mb-1" style={{ color: TEXT_PRI }}>Your history is waiting</p>
                <p className="font-sans text-[12px]" style={{ color: TEXT_MUT }}>Sign in to unlock your quiz archive</p>
              </div>
            </div>
          </section>

        </div>
      </div>

      {lockedFeature && (
        <div className="history-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="history-unlock-title" onClick={() => setLockedFeature(null)}>
          <div className="history-modal-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="history-modal-close" aria-label="Close" onClick={() => setLockedFeature(null)}>
              &times;
            </button>
            <div className="history-modal-lock" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 id="history-unlock-title" className="font-display text-[19px] font-black leading-tight" style={{ color: TEXT_PRI }}>
              {lockedFeature.unlockTitle}
            </h2>
            <p className="font-sans text-[13px] leading-relaxed mt-3" style={{ color: TEXT_SEC }}>
              {lockedFeature.unlockBody}
            </p>
            <button className="history-google-btn mt-5" onClick={() => handleSignIn(lockedFeature)}>
              <GoogleSVG />
              Continue with Google
            </button>
            <p className="font-sans text-[11px] mt-3" style={{ color: TEXT_MUT }}>
              {lockedFeature.unlockNote}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function HistoryPage() {
  const { status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const isGuest = status === 'unauthenticated';

  useEffect(() => {
    if (status === 'loading') return;
    setLoading(false);
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen pb-24" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
        <Head><title>History - SSC GK Score Booster</title></Head>
        <HistoryTopBar title="History" badge="PRACTICE ARCHIVE" icon={<HistoryHeaderIcon />} />
        <main className="px-4 pt-5">
          <Loader card size="md" label="Loading history..." />
        </main>
      </div>
    );
  }

  if (isGuest) {
    return <HistoryGuestState />;
  }

  return (
    <>
      <Head><title>History - SSC GK Score Booster</title></Head>
      <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, var(--ssc-bg) 0%, var(--ssc-bg-alt) 100%)' }}>
        <style>{SHARED_STYLES}</style>

        <HistoryTopBar title="History" badge="PRACTICE ARCHIVE" icon={<HistoryHeaderIcon />} />

        <main className="px-4 pt-[22px]">
          <div className="history-intro">
            <h2 className="history-intro-title font-display">Review &amp; Improve</h2>
            <p className="history-intro-body">Choose what you want to review today</p>
          </div>

          <section className="history-list-card">
            {historyFeatures.map(feature => (
              <button key={feature.title} type="button" className="history-feature-row" onClick={() => router.push(feature.route)}>
                <FeatureIcon iconColor={feature.iconColor} iconBg={feature.iconBg}>{feature.icon}</FeatureIcon>
                <div className="min-w-0 flex-1">
                  <span className="history-feature-title font-display">{feature.title}</span>
                  <span className="history-feature-body">{feature.body}</span>
                </div>
                {feature.isNew && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ssc-teal)', background: 'var(--ssc-teal-soft)', border: '1px solid rgba(14,165,164,0.22)', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>New</span>
                )}
                <ChevronSVG />
              </button>
            ))}
          </section>
        </main>
      </div>
    </>
  );
}
