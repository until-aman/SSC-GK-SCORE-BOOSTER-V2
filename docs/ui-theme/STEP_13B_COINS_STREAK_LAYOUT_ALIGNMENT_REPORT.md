# UI Step 13B — Coins History + Streak History Layout Alignment Report

**Branch:** `ui/step-13b-coins-streak-layout`
**Date:** 2026-06-15
**Files Changed:** `pages/history/coins.jsx`, `pages/streak.js`, `pages/history.js`

---

## Summary

Aligned Coins History, Streak History, and the History landing page to match the 3-frame preview. All changes are UI/layout polish only — no API routes, scoring logic, coins calculation, streak calculation, milestone/reward logic, or Mentor files were touched.

---

## `pages/history/coins.jsx` Changes

### 1. Sticky Header
- Replaced inline `px-4 pt-10` header with sticky (`position: sticky; top: 0; z-index: 30`) frosted-glass bar
- Swapped refresh button (SVG rotate icon) → info circle icon (presentational, no handler)
- Consistent with the preview's `←  Coins History  ⓘ` pattern

### 2. Hero Card Restructure
- Added left coin icon: 52×52 amber gradient square (`#FBBF24 → #F59E0B`) with coin SVG
- "TOTAL COINS" uppercase label above the large number
- Level badge updated: shield icon + "Level N LevelName" (e.g., "Level 3 Expert") using new `LEVEL_NUM` constant
- Added `pctText = Math.round(coinsBarWidth)` percentage shown between `thresh.min` and `thresh.max` ticks
- Added coins-to-next-level text inline (below number row)

### 3. How to Earn Coins — Icon Cards
- Removed: collapsible accordion table + `earnCoinsOpen` state
- Added: always-visible 2×2 grid of four icon cards using `EARN_CARDS` array:
  - 📝 Complete Quiz → +10
  - 🎯 Correct Answer → +2
  - 🌅 Daily First Quiz → +10
  - 🛡️ No Penalty → -0
- Values sourced directly from existing table (no invented data)
- Tip banner preserved below cards

### 4. Recent Sessions Header
- Removed `<span>last {sessions.length}</span>` counter
- Added `"View All →"` / `"Collapse ↑"` toggle button inline with section title
- Keeps existing `showAllSessions` toggle logic; only the visual presentation changed

### 5. CTA Button
- Label changed from `"Practice Now →"` → `"Start Practice"` with book SVG icon
- Route unchanged: `/dashboard`
- Pulse animation class unchanged: `coins-cta-pulse`

---

## `pages/streak.js` Changes

### 1. Header
- Removed `HistoryTopBar` component + import
- Added `StickyHeader` inner component: frosted-glass bar, `BackButton`, "Streak History" h1, info circle icon
- Applied to both loading state and main render (consistent)
- Removed `StreakHistoryIcon` constant (no longer needed)

### 2. Hero Card — 2-Column Layout
- Previous: single column with large streak count + status/best-streak pills
- New: left column (🔥 icon + Current Streak + large number) ÷ right column (🏆 icon + Best Streak + large number)
- Divider: `border-right: 1px solid rgba(246,179,49,0.25)`
- Motivational text line moved below both columns (one row, full width)
- Removed: inline progress bar from hero (milestone progress moved to dedicated card below)

### 3. Weekly Activity — Check/Cross Icons
- Removed: `LightningSVG` component (replaced by text symbols)
- Done days: orange gradient circle + white `✓` (fontWeight 900)
- Missed days (past, not played): faint red circle + red `✗`
- Today pending: dashed orange border circle (empty)
- Today completed: orange glow circle + `✓`
- Today's column label now shows `"Today"` instead of the day abbreviation (`Mo`–`Su`)
- Data logic (`getStreakDays`, `done` Set) unchanged

### 4. Protected / At-Risk Card
- New standalone card inserted below Activity card
- Protected state: teal border + teal shield-check SVG + "Your streak is protected"
- At-risk state: orange border + warning triangle SVG + "Streak at risk!"
- Helper text changes based on `playedToday`

### 5. Streak Milestone Card — Circular Ring
- Replaced: linear progress bar section in Milestone card
- Added: inline SVG circular ring (`r=26`, `strokeDasharray/strokeDashoffset`)
- Ring values computed before return: `ringR`, `ringCirc`, `ringDash`
- Center label: `"{streakCount}/{nextMs.days}"` + "Days" sub-label
- 0.8s ease-out transition on `stroke-dashoffset`

### 6. Upcoming Rewards — Status Pills
- All upcoming milestones now show a status pill:
  - `nextMs` → **"In Progress"** (teal pill)
  - `upcomingMs` → **"Locked"** (gray pill)
  - `achievedMs` → **"✓ Earned"** (colored pill matching milestone color)
- Reward rows use emoji icons: 🔥 (next), 🏅 (locked), 🏆 (earned)
- `achievedMs` now rendered inside the same "Upcoming Rewards" card (below locked items)

### 7. CTA
- Label changed from `"Protect Today's Streak →"` / `"Practice More →"` → **"Play Quiz Now"** with play triangle SVG
- Removed `showCTA` state + interaction useEffect (4-second reveal delay)
- CTA now always visible (no opacity/transform fade-in)
- Route unchanged: `/quiz?mode=daily&sourceScreen=daily_challenge`
- `btnPress` press-effect state kept

---

## `pages/history.js` Changes

### 1. Coins History Entry
- `body`: `'Track your earned and spent coins'` → `'Track your earned coins'`
- Added `isNew: true` flag

### 2. Streak History Entry
- `body`: `'View your daily streaks and achievements'` → `'Track your learning streak'`
- `iconColor`: `'var(--ssc-rank)'` (purple) → `'#f97316'` (orange/flame)
- `iconBg`: `'rgba(109,93,246,0.12)'` (purple tint) → `'rgba(249,115,22,0.12)'` (orange tint)
- Added `isNew: true` flag

### 3. "New" Pill
- Both rendering locations (guest modal list + logged-in list) updated:
  ```jsx
  {feature.isNew && (
    <span style={{ ...tealPillStyle }}>New</span>
  )}
  ```
- Purely presentational — no route or data changes

---

## Safety Constraints Verified

| Constraint | Status |
|---|---|
| `pages/api/**` not touched | ✅ |
| Mentor files not touched | ✅ |
| No new API routes | ✅ |
| No Google Sheets logic changed | ✅ |
| No fake data added | ✅ |
| Coins calculation logic unchanged | ✅ |
| Streak calculation logic unchanged | ✅ |
| Milestone/reward logic unchanged | ✅ |
| `getScoreHistory` response unchanged | ✅ |
| `getUserProfile` response unchanged | ✅ |
| No invented reward values | ✅ (EARN_CARDS uses existing table values) |

---

## Build Output

- `npm run lint` — 0 errors
- `npm run build` — Compiled successfully
