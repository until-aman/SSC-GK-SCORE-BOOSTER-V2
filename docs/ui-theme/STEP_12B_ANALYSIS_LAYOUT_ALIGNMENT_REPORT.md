# UI Step 12B — Analysis + Insights Layout Alignment Report

**Branch:** `ui/step-12b-analysis-layout`
**Date:** 2026-06-14
**Files Changed:** `pages/analysis.jsx`

---

## Summary

Restructured the Analysis tab (`/analysis`) for logged-in users with quiz history to match a
4-screen preview mockup. The existing reveal-gate mechanic, all data-fetch logic, the Interest
CTA card, and the guest lock-gate are fully preserved. Only the UI layout of the *revealed*
analysis content was changed.

---

## Architecture: What Stayed

| Item | Status |
|---|---|
| `pages/api/**` | Not touched |
| Mentor files | Not touched |
| Google Sheets logic | Not touched |
| Scoring / coins logic | Not touched |
| Analysis fetch / cache logic (`getAnalysisActivity`, etc.) | Not touched |
| `readAnalysisInterest` / `patchAnalysisInterestState` / `recordAnalysisInterest` | Not touched |
| `getUserCacheScope` | Not touched |
| Guest view (lock gate + unlock modal) | Fully preserved |
| Zero-history empty state | Fully preserved |
| Activity card (real data: quizzes / questions / coins / mostPracticed / lastQuizAt) | Fully preserved |
| Reveal gate button ("See My Analysis Preview →") | Fully preserved |
| `handleReveal`, `selectSubject`, `scrollToInterest`, `handleCtaClick`, `handleSignInClick` | Fully preserved |
| Interest CTA card (3-state: default / recorded / guest sign-in) | Fully preserved |
| AI Detailed Analysis locked card | Fully preserved |
| Disclaimer paragraph | Fully preserved |
| SUBJECTS / TOPICS / FILTERS / TAG_COLOR static sample data | Fully preserved |
| `statusFor()` / `fmtCompact()` / `timeAgo()` helpers | Fully preserved |

---

## What Changed

### 1. New State Variables (3 added)

```js
const [activeView,    setActiveView]    = useState('dashboard'); // 'dashboard' | 'subjects' | 'topics' | 'weak'
const [subjectFilter, setSubjectFilter] = useState('All');       // 'All' | 'Strong' | 'Weak'
const [weakTab,       setWeakTab]       = useState('subjects');  // 'subjects' | 'topics' | 'mistakes'
```

### 2. New Derived Constants

```js
const avgAccuracy = Math.round(SUBJECTS.reduce((s, x) => s + x.acc, 0) / SUBJECTS.length); // ≈ 61%
const strongCount = SUBJECTS.filter(s => s.acc >= 65).length; // 4
```

### 3. `SUBJECT_EMOJI` Map (new module-level constant)

Maps each subject name to an emoji icon used in subject chips and list rows.

### 4. Revealed Content Replaced: Single Scroll → 4-Tab Layout

Old sections 4–10 (subject health carousel, practice plan hero, topic filter cards) were
replaced with a 4-tab layout. The tab nav renders immediately after the sample label strip
inside `{revealed && ...}`.

---

## Views Implemented

### Tab 1 — Dashboard (`activeView === 'dashboard'`)

**Performance Overview** (2×2 grid):

| Cell | Source | Value |
|---|---|---|
| Quizzes Attempted | REAL — `activity.totalQuizzes` | e.g. 14 |
| Avg Accuracy | SAMPLE — avg of `SUBJECTS[].acc` | 61% |
| Questions Practiced | REAL — `activity.totalQuestions` | e.g. 420 |
| Strong Subjects | SAMPLE — count where `acc ≥ 65` | 4/10 |

Real cells labelled "Practiced" or plain; sample cells labelled "Sample ✱" so users
understand the source distinction.

**Subject Accuracy Snapshot**: horizontal bars for all 10 SUBJECTS sorted by accuracy
(highest first), color-coded by `statusFor()`. Serves as a quick "score trend" analog.

**Performance Distribution**: 4-row legend (Excellent ≥80% / Good 65–79% / Average 50–64%
/ Needs Work <50%) with counts, percentages, and a single stacked gradient bar — all
derived from SUBJECTS.

**Quick Navigation Tiles** (2×2): tappable cards to switch to Subjects / Topics / Weak
Areas / Practice Now. Practice Now routes to `/quiz-setup` for the currently-selected
subject.

---

### Tab 2 — Subject Analysis (`activeView === 'subjects'`)

**Filter Chips**: All Subjects / Strong Subjects (acc ≥ 65) / Weak Subjects (acc < 65).

**Overall Performance Card**: avg accuracy from SUBJECTS + status pill in a gradient card.

**Subject Rows** (sorted by acc desc within filter):
- Subject emoji icon chip (from `SUBJECT_EMOJI`)
- Subject name
- Horizontal progress bar (color = `statusFor().color`)
- Accuracy % + status pill
- Practice chevron `›` → `/quiz-setup?subject=...`
- Sub-info line: focus topics + marks potential

---

### Tab 3 — Topic Analysis (`activeView === 'topics'`)

**Subject Selector**: scrollable pill chips for all 10 SUBJECTS. Clicking calls
`selectSubject(name)` (preserves analytics log). Active subject highlighted in orange.

**Summary Card**: dynamically computed from `TOPICS.filter(t => t.subject === selectedSubject)`:
- Accuracy: avg of matching topics
- Correct: sum of `Math.round(attempted × acc/100)` for matching topics
- Wrong: totalAttempted − totalCorrect
- Topics: count of matching topics

**Empty State**: when no topics exist in TOPICS for the selected subject (Medieval History,
Ancient History, Static GK, Economy*) shows a friendly message with instruction to pick
another subject.

**Topic Rows**: for each matching topic:
- Topic name + subject + attempted count
- Accuracy % + status pill
- Progress bar (color-coded)
- Tags (same TAG_COLOR mapping as before)
- "Practice 25Q →" button → `/quiz-setup?subject=...&topic=...`

---

### Tab 4 — Weak Areas (`activeView === 'weak'`)

**Sub-tabs**: By Subject / By Topic / Mistakes (segmented control style).

**Focus Card**: left-border danger card with emoji + headline + "8–14 marks recoverable" note.

**By Subject**: `SUBJECTS.filter(s => s.acc < 65)` sorted acc ascending (worst first):
- 6 subjects: Medieval History (52%), Biology (42%), Chemistry (48%), Physics (55%),
  Economy (59%), Modern History (61%)
- Each card: icon chip + name + focus topics + accuracy + status pill + progress bar +
  marks potential chip + "Practice →" button

**By Topic**: `TOPICS.filter(t => t.acc < 60)` sorted acc ascending:
- 9 topics across Polity, Biology, Chemistry, Medieval History, Economy, Physics
- Each card: name + subject + attempted + accuracy + status pill + progress bar +
  primary tag chip + "Practice →" button

**Mistakes**: static card with emoji + description + "Review Mistakes →" CTA routing to
`/history/mistakes`.

---

## Data Source Transparency

The page already had a "Sample Analysis · Based on ~700Q practice pattern" label. All
performance numbers shown in the 4 tabs come from the existing static SUBJECTS/TOPICS arrays,
which are marked sample data. Real numbers (quizzes, questions) are from `activity` and show
without the sample asterisk.

---

## Constraints Verified

| Constraint | Status |
|---|---|
| `pages/api/**` not touched | ✅ |
| Mentor files not touched | ✅ |
| No new API routes | ✅ |
| No Google Sheets logic changed | ✅ |
| No fake data added (existing sample data reused) | ✅ |
| Analysis fetch/calculation/premium/notify logic unchanged | ✅ |
| Interest CTA 3-state logic preserved | ✅ |
| Reveal gate UX preserved | ✅ |
| Guest lock-gate fully preserved | ✅ |
| Zero-history empty state preserved | ✅ |

---

## Build Output

- `npm run lint` — 0 errors, 2 pre-existing warnings (unrelated files)
- `npm run build` — ✓ Compiled successfully, all 26 static pages generated
- `/analysis` bundle: 15.4 kB (prev: same file, comparable)
- No regressions on `/result` (21.1 kB) or `/result/detailed` (9.1 kB)

---

## Known Gaps vs Preview (Future Work)

| Preview Feature | Status | Reason |
|---|---|---|
| Real per-subject accuracy breakdown | Future | API doesn't return per-subject data |
| Score trend line chart over time | Not implemented | No historical time-series data in API; replaced with Subject Accuracy Snapshot |
| Rank / "Top 28% Learners" | Not implemented | No ranking data in API |
| Date range filter on Dashboard | Not implemented | API doesn't support date-range filtering |
| Correct/Wrong/Skipped real counts | Approximated from sample | API only returns `totalQuestions`, not per-session breakdown |
