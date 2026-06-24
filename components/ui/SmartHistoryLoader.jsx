import { useEffect, useMemo, useState } from 'react';

const LOADER_VARIANTS = {
  'quiz-history': {
    title: 'Preparing your quiz history...',
    subtitle: 'Collecting attempts, scores and review data',
    steps: [
      'Fetching quiz sessions',
      'Organizing results',
      'Preparing filters',
      'Checking weak areas',
      'Finalizing history view',
    ],
    accent: 'var(--ssc-teal)',
  },
  'saved-questions': {
    title: 'Preparing your saved revision bank...',
    subtitle: 'Gathering your saved questions for quick review',
    steps: [
      'Fetching saved questions',
      'Grouping by subject and topic',
      'Preparing revision filters',
      'Calculating saved counts',
      'Finalizing your revision list',
    ],
    accent: 'var(--ssc-orange)',
  },
  'repeated-mistakes': {
    title: 'Finding your repeated mistakes...',
    subtitle: 'Identifying weak questions you should revisit',
    steps: [
      'Scanning wrong attempts',
      'Detecting repeated mistakes',
      'Grouping weak areas',
      'Preparing practice-ready list',
      'Finalizing review set',
    ],
    accent: 'var(--ssc-danger)',
  },
  'coins-history': {
    title: 'Loading your coins journey...',
    subtitle: 'Checking earned coins, milestones and activity',
    steps: [
      'Fetching coin entries',
      'Calculating totals',
      'Preparing recent sessions',
      'Checking level progress',
      'Finalizing coin history',
    ],
    accent: 'var(--ssc-teal)',
  },
  'streak-history': {
    title: 'Checking your learning streak...',
    subtitle: 'Reviewing consistency, milestones and rewards',
    steps: [
      'Fetching streak activity',
      'Checking current streak',
      'Finding best streak',
      'Preparing milestone progress',
      'Finalizing streak history',
    ],
    accent: 'var(--ssc-violet)',
  },
  reports: {
    title: 'Building your performance report...',
    subtitle: 'Analyzing attempts, weak areas and patterns',
    steps: [
      'Fetching review data',
      'Organizing key metrics',
      'Checking weak areas',
      'Preparing recommendations',
      'Finalizing report view',
    ],
    accent: 'var(--ssc-teal)',
  },
  'subject-history': {
    title: 'Preparing subject history...',
    subtitle: 'Reviewing your subject-level performance',
    steps: [
      'Fetching subject attempts',
      'Organizing subject data',
      'Preparing subject filters',
      'Checking strong and weak topics',
      'Finalizing subject view',
    ],
    accent: 'var(--ssc-teal)',
  },
  'topic-history': {
    title: 'Preparing topic-wise review...',
    subtitle: 'Collecting topic attempts and weak points',
    steps: [
      'Fetching topic attempts',
      'Organizing topic trends',
      'Preparing topic filters',
      'Checking topic weak areas',
      'Finalizing topic review',
    ],
    accent: 'var(--ssc-orange)',
  },
  'review-session': {
    title: 'Preparing your quiz review...',
    subtitle: 'Loading question details and answer history',
    steps: [
      'Fetching session data',
      'Organizing review questions',
      'Building answer breakdown',
      'Checking weak areas',
      'Finalizing review summary',
    ],
    accent: 'var(--ssc-teal)',
  },
};

const TIPS = [
  { label: 'Revision Tip', copy: 'Review wrong questions first. They usually give the fastest improvement.' },
  { label: 'Smart Tip', copy: 'Repeated mistakes often indicate concept gaps. Revisit them before reattempting.' },
  { label: 'Exam Tip', copy: 'Skip if you are less than 60% sure on a question. Save time for stronger topics.' },
  { label: 'Feature Tip', copy: 'Use subject-wise and topic-wise filters for faster revision.' },
  { label: 'Motivation', copy: 'Small daily revision leads to strong recall.' },
];

function getFilterTitle(filter, subject, topic, timeRange, variant) {
  if (topic) {
    return `Preparing ${topic} review...`;
  }
  if (subject) {
    return `Preparing ${subject} history...`;
  }
  if (timeRange === '7d') {
    return 'Preparing your last 7 days activity...';
  }
  if (timeRange === '30d') {
    return 'Preparing your last 30 days activity...';
  }
  if (timeRange === 'custom') {
    return 'Preparing your custom history range...';
  }

  const filterMap = {
    correct: 'Preparing correct question review...',
    wrong: 'Preparing wrong answer review...',
    skipped: 'Preparing skipped question review...',
    saved: 'Preparing saved question review...',
    mistakes: 'Preparing repeated mistakes review...',
    repeated: 'Preparing repeated mistakes review...',
    'never_correct': 'Preparing never-correct question review...',
  };

  if (filter && filterMap[filter]) {
    return filterMap[filter];
  }

  return null;
}

function getFilterSubtitle(filter, subject, topic, timeRange, variant) {
  if (topic) {
    return `Collecting questions for ${topic} review.`;
  }
  if (subject) {
    return `Collecting attempts and progress for ${subject}.`;
  }
  if (timeRange === '7d') {
    return 'Collecting your activity from the last 7 days.';
  }
  if (timeRange === '30d') {
    return 'Collecting your activity from the last 30 days.';
  }
  if (timeRange === 'custom') {
    return 'Collecting your selected date range data.';
  }

  const subtitleMap = {
    correct: 'Collecting questions you answered correctly.',
    wrong: 'Finding mistakes you should review again.',
    skipped: 'Collecting questions you left unanswered.',
    saved: 'Gathering saved questions for quick review.',
    mistakes: 'Identifying repeated questions to revisit.',
    repeated: 'Identifying repeated questions to revisit.',
    'never_correct': 'Collecting the questions you never got right.',
  };

  if (filter && subtitleMap[filter]) {
    return subtitleMap[filter];
  }

  return null;
}

function selectTip(variant, filter, subject, topic, timeRange) {
  const seed = `${variant}-${filter || ''}-${subject || ''}-${topic || ''}-${timeRange || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return TIPS[Math.abs(hash) % TIPS.length];
}

export default function SmartHistoryLoader({
  variant = 'quiz-history',
  filter = 'all',
  subject = '',
  topic = '',
  timeRange = '',
  compact = false,
  delay = 280,
  className = '',
}) {
  const [showRich, setShowRich] = useState(false);

  useEffect(() => {
    setShowRich(false);
    const timer = window.setTimeout(() => setShowRich(true), delay);
    return () => window.clearTimeout(timer);
  }, [variant, filter, subject, topic, timeRange, delay]);

  const loader = useMemo(() => {
    const base = LOADER_VARIANTS[variant] || LOADER_VARIANTS['quiz-history'];
    const title = getFilterTitle(filter, subject, topic, timeRange, variant) || base.title;
    const subtitle = getFilterSubtitle(filter, subject, topic, timeRange, variant) || base.subtitle;
    const tip = selectTip(variant, filter, subject, topic, timeRange);
    const activeStep = Math.min(1, base.steps.length - 1);
    const progress = Math.max(20, Math.round(((activeStep + 1) / base.steps.length) * 100));
    return {
      title,
      subtitle,
      steps: base.steps,
      accent: base.accent,
      tip,
      activeStep,
      progress,
    };
  }, [variant, filter, subject, topic, timeRange]);

  if (!showRich) {
    return (
      <div className={`smart-history-loader ${compact ? 'compact' : ''} ${className}`.trim()}>
        <style>{styles}</style>
        <div className="shl-skeleton-grid">
          <div className="shl-skeleton-card">
            <div className="shl-skeleton-header" />
            <div className="shl-skeleton-line short" />
            <div className="shl-skeleton-line" />
            <div className="shl-skeleton-bar" />
            <div className="shl-skeleton-line" />
          </div>
          {!compact && (
            <>
              <div className="shl-skeleton-card">
                <div className="shl-skeleton-line" />
                <div className="shl-skeleton-line short" />
                <div className="shl-skeleton-step" />
                <div className="shl-skeleton-step" />
                <div className="shl-skeleton-step" />
              </div>
              <div className="shl-skeleton-card">
                <div className="shl-skeleton-line" />
                <div className="shl-skeleton-line short" />
                <div className="shl-skeleton-line" />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`smart-history-loader ${compact ? 'compact' : ''} ${className}`.trim()}>
      <style>{styles}</style>
      <div className="shl-main-card">
        <div className="shl-main-card-head">
          <div>
            <p className="shl-title">{loader.title}</p>
            <p className="shl-subtitle">{loader.subtitle}</p>
          </div>
          <div className="shl-progress-pill">
            <span>{`${loader.progress}%`}</span>
          </div>
        </div>

        <div className="shl-progress-track">
          <div className="shl-progress-fill" style={{ width: `${loader.progress}%`, background: loader.accent }} />
        </div>

        <div className="shl-card-row">
          <div className="shl-ring-wrap">
            <div className="shl-ring" style={{ borderColor: `${loader.accent} transparent transparent transparent` }} />
            <div className="shl-ring-center">{loader.progress}%</div>
          </div>
          <div>
            <p className="shl-meta-label">Checking history details</p>
            <p className="shl-meta-copy">A lightweight progress preview while we prepare your data.</p>
          </div>
        </div>
      </div>

      <div className="shl-step-card">
        <div className="shl-step-card-title">Processing steps</div>
        <div className="shl-step-list">
          {loader.steps.map((step, index) => (
            <div key={step} className={`shl-step-item ${index === loader.activeStep ? 'active' : ''}`}>
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="shl-tip-card">
          <div className="shl-tip-label">{loader.tip.label}</div>
          <p>{loader.tip.copy}</p>
        </div>
      )}

      {!compact && <div className="shl-footer">Lightweight, fast, and meaningful — keeps users engaged while we prepare your data.</div>}
    </div>
  );
}

const styles = `
.smart-history-loader{display:grid;gap:16px;}
.smart-history-loader.compact{gap:12px;}
.shl-skeleton-grid{display:grid;gap:14px;}
  .shl-skeleton-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:18px;padding:12px;box-shadow:var(--ssc-shadow-card)}
  .shl-skeleton-header{height:14px;width:56%;background:var(--ssc-border-soft);border-radius:999px; margin-bottom:10px;}
  .shl-skeleton-line{height:10px;width:100%;background:var(--ssc-border-soft);border-radius:999px;margin-top:10px;}
  .shl-skeleton-line.short{width:68%;}
  .shl-skeleton-bar{height:6px;width:100%;background:var(--ssc-border-soft);border-radius:999px;margin:12px 0;}
  .shl-skeleton-step{height:12px;width:100%;background:var(--ssc-border-soft);border-radius:999px;margin-top:10px;}
.shl-main-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:18px;padding:12px;box-shadow:var(--ssc-shadow-card);display:flex;flex-direction:column;gap:10px;}
.shl-main-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
.shl-title{margin:0;color:var(--ssc-text-primary);font-size:13px;font-weight:800;line-height:1.15;}
.shl-subtitle{margin:4px 0 0;color:var(--ssc-text-secondary);font-size:10px;line-height:1.3;}
.shl-progress-pill{min-width:56px;padding:5px 8px;border-radius:999px;background:rgba(14,165,164,0.08);color:var(--ssc-teal);font-size:11px;font-weight:800;text-align:center;}
.shl-progress-track{height:5px;background:var(--ssc-border-soft);border-radius:999px;overflow:hidden;}
.shl-progress-fill{height:100%;border-radius:999px;transition:width .28s ease;}
.shl-card-row{display:flex;align-items:center;gap:8px;}
.shl-ring-wrap{position:relative;width:54px;height:54px;display:flex;align-items:center;justify-content:center;}
.shl-ring{width:54px;height:54px;border-radius:50%;border:4px solid var(--ssc-teal);animation:shl-spin 1.1s linear infinite;transform:rotate(-90deg);box-sizing:border-box;}
.shl-ring-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--ssc-text-primary);font-size:11px;font-weight:800;}
.shl-meta-label{margin:0;color:var(--ssc-text-primary);font-size:11px;font-weight:800;}
.shl-meta-copy{margin:4px 0 0;color:var(--ssc-text-secondary);font-size:10px;line-height:1.3;}
.shl-step-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;padding:10px;box-shadow:var(--ssc-shadow-card);}
.shl-step-card-title{color:var(--ssc-text-primary);font-size:11px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;margin-bottom:10px;}
.shl-step-list{display:grid;gap:8px;}
.shl-step-item{display:flex;align-items:flex-start;gap:8px;padding:8px;border-radius:12px;background:var(--ssc-surface-soft);border:1px solid transparent;}
.shl-step-item.active{background:rgba(14,165,164,0.12);border-color:rgba(14,165,164,0.18);}
.shl-step-item span{width:20px;height:20px;flex-shrink:0;border-radius:999px;background:rgba(14,165,164,0.10);color:var(--ssc-teal);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;}
.shl-step-item.active span{background:var(--ssc-teal);color:white;}
.shl-step-item p{margin:0;color:var(--ssc-text-primary);font-size:11px;line-height:1.2;font-weight:800;}
.shl-tip-card{background:var(--ssc-surface);border:1px solid var(--ssc-border-soft);border-radius:16px;padding:10px;box-shadow:var(--ssc-shadow-card);}
.shl-tip-label{margin:0 0 6px;color:var(--ssc-teal);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;}
.shl-tip-card p{margin:0;color:var(--ssc-text-secondary);font-size:11px;line-height:1.25;}
.shl-footer{color:var(--ssc-text-secondary);font-size:10px;line-height:1.2;text-align:center;padding:0 4px;}
@keyframes shl-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
.smart-history-loader{max-width:760px;margin:0 auto}
@media(min-width:720px){
  .smart-history-loader{grid-template-columns:repeat(12,1fr);}
  .shl-main-card{grid-column:span 7;}
  .shl-step-card{grid-column:span 5;}
  .shl-tip-card{grid-column:span 7;}
  .shl-footer{grid-column:span 12;}
}
`;
