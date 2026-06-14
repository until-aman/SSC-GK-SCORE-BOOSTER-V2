# UI Step 12B — Alignment Checklist

## Analysis Page (`pages/analysis.jsx`)

### State & Logic Preservation
- [x] Guest view unchanged (lock gate + benefit list + blurred hero + unlock modal)
- [x] Loading state unchanged (spinner)
- [x] Zero-history empty state unchanged (📊 + "Start a Quiz →")
- [x] Activity card unchanged (avatar + Quizzes/Questions/Coins tiles + mostPracticed + lastQuizAt)
- [x] Reveal gate unchanged ("What's holding your GK score back?" + blurred preview + CTA)
- [x] `handleReveal` persists `analysisRevealed` to localStorage
- [x] `selectSubject` analytics log preserved
- [x] `scrollToInterest` smooth-scroll preserved
- [x] `handleCtaClick` / `recordInterest` / `patchAnalysisInterestState` unchanged
- [x] Interest CTA 3-state (default / recorded / guest sign-in) unchanged
- [x] AI Detailed Analysis locked card unchanged
- [x] Disclaimer text unchanged
- [x] `#interest-cta` anchor id preserved for smooth scroll from locked card

### New Tab Navigation
- [x] 4-tab pill nav: 📊 Dashboard / 📚 Subjects / 📋 Topics / 🎯 Weak Areas
- [x] Active tab highlighted in orange, inactive in surface card style
- [x] Tab nav scrollable (overflowX: auto) for narrow screens
- [x] Tab nav shown only when `revealed === true`
- [x] `activeView` state resets to 'dashboard' on first reveal

### Dashboard Tab
- [x] Performance Overview 2×2 stat grid
  - [x] Quizzes Attempted — REAL (`activity.totalQuizzes`)
  - [x] Avg Accuracy — SAMPLE (avg of SUBJECTS.acc ≈ 61%) — labelled "Sample ✱"
  - [x] Questions Practiced — REAL (`activity.totalQuestions`)
  - [x] Strong Subjects — SAMPLE (count acc ≥ 65 = 4/10) — labelled "Sample ✱"
- [x] Subject Accuracy Snapshot — horizontal bars, all 10 subjects sorted by acc desc
  - [x] Bars color-coded by `statusFor(acc).color`
  - [x] Subject emoji prefix from `SUBJECT_EMOJI` map
- [x] Performance Distribution — 4-row legend (Excellent/Good/Average/Needs Work)
  - [x] Counts + percentage from SUBJECTS data
  - [x] Stacked gradient bar at bottom
- [x] Quick Nav 2×2 tiles (Subjects / Topics / Weak Areas / Practice Now)
  - [x] "Practice Now" routes to `/quiz-setup` for weakest/selected subject

### Subject Analysis Tab
- [x] Filter chips: All Subjects / Strong Subjects (≥65%) / Weak Subjects (<65%)
- [x] Overall Performance card (avg accuracy + status pill + "Sample" note)
- [x] Subject rows sorted by accuracy descending within filter
  - [x] Subject emoji icon chip (colored by status)
  - [x] Subject name
  - [x] Progress bar (color-coded by status)
  - [x] Accuracy % + status pill
  - [x] Practice chevron `›` → `/quiz-setup?subject=...`
  - [x] Sub-info: focus topics + marks potential
- [x] Empty state if filter yields no subjects

### Topic Analysis Tab
- [x] Subject selector — scrollable orange pills for all 10 SUBJECTS
- [x] Clicking subject chip calls `selectSubject(name)` (preserves analytics)
- [x] Summary card: Accuracy / Correct / Wrong / Topics (computed from matching TOPICS)
- [x] Empty state when no TOPICS entry for selected subject
- [x] Topic rows for matching topics:
  - [x] Topic name + subject + attempted count
  - [x] Accuracy % + status pill
  - [x] Progress bar (color-coded)
  - [x] Tags (TAG_COLOR system)
  - [x] "Practice 25Q →" button → `/quiz-setup?subject=...&topic=...`

### Weak Areas Tab
- [x] Sub-tabs: By Subject / By Topic / Mistakes (segmented control)
- [x] Focus Card: danger-styled left-border card with emoji + headline + marks estimate
- [x] By Subject: SUBJECTS where acc < 65 sorted ascending (worst first)
  - [x] Subject icon chip + name + focus topics
  - [x] Accuracy + status pill + progress bar
  - [x] Marks potential label + "Practice →" button
- [x] By Topic: TOPICS where acc < 60 sorted ascending
  - [x] Topic name + subject + attempted
  - [x] Accuracy + status pill + progress bar
  - [x] Primary tag chip + "Practice →" button
- [x] Mistakes: static card with "Review Mistakes →" → `/history/mistakes`

### New Data / Constants Added (no new fake data)
- [x] `SUBJECT_EMOJI` map (10 entries, emoji-only, module-level)
- [x] `avgAccuracy` constant (computed from existing SUBJECTS)
- [x] `strongCount` constant (computed from existing SUBJECTS)
- [x] No new external data sources, no new API calls, no new Sheet columns

### Safety Constraints
- [x] `pages/api/**` not touched
- [x] Mentor files not touched
- [x] No new API routes
- [x] No Google Sheets logic changed
- [x] No new fake data (reused existing sample arrays)
- [x] Analysis fetch/calculation/premium/notify logic unchanged
- [x] WhatsAppBell component preserved in header

### Build Health
- [x] `npm run lint` — 0 errors (2 pre-existing warnings in unrelated files)
- [x] `npm run build` — ✓ Compiled successfully, 26 static pages generated
- [x] `/analysis` bundle: 15.4 kB
- [x] No regressions on other pages
