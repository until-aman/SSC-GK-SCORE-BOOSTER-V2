# UI Step 13B — Alignment Checklist

## Coins History (`pages/history/coins.jsx`)

### Header
- [x] Sticky frosted-glass header (position: sticky, top: 0, z-index: 30)
- [x] Back button
- [x] "Coins History" title
- [x] Info circle icon (presentational)

### Hero Card
- [x] Coin SVG icon (amber gradient square, 52×52)
- [x] "TOTAL COINS" uppercase label
- [x] Large coin count in orange
- [x] Level badge: shield icon + "Level N LevelName"
- [x] "N coins to reach NextLevel" text
- [x] Progress bar (animated via coinsBarWidth state)
- [x] Progress % shown between min/max ticks

### How to Earn Coins
- [x] Always visible (no accordion/collapse)
- [x] 2×2 grid of 4 icon cards
- [x] 📝 Complete Quiz → +10
- [x] 🎯 Correct Answer → +2
- [x] 🌅 Daily First Quiz → +10
- [x] 🛡️ No Penalty → -0
- [x] Tip banner below cards

### Recent Sessions
- [x] Section header with "View All →" / "Collapse ↑" toggle
- [x] Sessions rendered via SessionRow component
- [x] Empty state with "Play Now →" CTA

### CTA
- [x] "Start Practice" label with book SVG icon
- [x] Orange gradient button with pulse animation
- [x] Routes to /dashboard

### Logic Preservation
- [x] getScoreHistory unchanged
- [x] LEVEL_THRESHOLDS unchanged
- [x] coinsBarWidth animation (300ms delay) unchanged
- [x] FILTER_FROM date filter unchanged
- [x] showAllSessions toggle unchanged
- [x] Guest view unchanged
- [x] Loading state unchanged

---

## Streak History (`pages/streak.js`)

### Header
- [x] Sticky frosted-glass header (StickyHeader inner component)
- [x] Back button
- [x] "Streak History" title
- [x] Info circle icon (presentational)
- [x] Loading state uses same header

### Hero Card
- [x] Two-column layout (current streak | best streak)
- [x] Left: 🔥 icon + "CURRENT STREAK" label + large day count in orange
- [x] Right: 🏆 icon + "BEST STREAK" label + large day count in amber
- [x] Vertical divider between columns
- [x] Motivational text line below columns

### Weekly Activity
- [x] Done days: orange circle + white ✓ check
- [x] Missed days: faint red circle + red ✗ cross
- [x] Today pending: dashed orange border (empty)
- [x] Today completed: orange glow circle + ✓
- [x] Today's label shows "Today" (not day abbreviation)
- [x] This Week count + Protected/Play status
- [x] Week/Month toggle preserved

### Month View
- [x] Unchanged — month calendar grid preserved

### Protected / At-Risk Card
- [x] Standalone card below Activity section
- [x] Protected: teal border + shield-check icon + "Your streak is protected"
- [x] At-risk: orange border + warning triangle + "Streak at risk!"
- [x] Helper text adapts to playedToday state

### Streak Milestone Card
- [x] "STREAK MILESTONE" uppercase section label
- [x] "Next Milestone" sub-label
- [x] Milestone label + coin reward inline badge
- [x] "N more days to unlock" text
- [x] Circular SVG ring (r=26, strokeDasharray/strokeDashoffset)
- [x] Ring color matches nextMs.color
- [x] Center shows "{streakCount}/{nextMs.days} Days"
- [x] Smooth 0.8s transition on ring draw

### Upcoming Rewards
- [x] nextMs shown with "In Progress" teal pill
- [x] upcomingMs shown with "Locked" gray pill
- [x] achievedMs shown with "✓ Earned" colored pill
- [x] Emoji icons per row: 🔥 🏅 🏆
- [x] Tip banner at bottom

### CTA
- [x] "Play Quiz Now" label with play triangle SVG
- [x] Always visible (no 4-second interaction delay)
- [x] btnPress press-scale effect preserved
- [x] Routes to /quiz?mode=daily&sourceScreen=daily_challenge
- [x] Pulse animation

### Logic Preservation
- [x] getUserProfile unchanged
- [x] getStreakDays helper unchanged
- [x] buildMonthCells helper unchanged
- [x] MILESTONES data unchanged
- [x] nextMs / prevMs / daysToNext / progress calculations unchanged
- [x] achievedMs / upcomingMs calculations unchanged
- [x] monthOffset navigation unchanged

---

## History Landing (`pages/history.js`)

### Coins History Entry
- [x] body: "Track your earned coins"
- [x] isNew: true (New pill shown)
- [x] iconColor: var(--ssc-coin) (unchanged)
- [x] iconBg: rgba(246,179,49,0.14) (unchanged)

### Streak History Entry
- [x] body: "Track your learning streak"
- [x] isNew: true (New pill shown)
- [x] iconColor: #f97316 (orange/flame, was purple var(--ssc-rank))
- [x] iconBg: rgba(249,115,22,0.12) (orange tint, was purple tint)

### New Pill
- [x] Shown in guest view feature list
- [x] Shown in logged-in view feature list
- [x] Teal pill style (teal-soft background, teal border, teal text)
- [x] Purely presentational — no data/route changes

### Other Entries Preserved
- [x] Quiz History — unchanged
- [x] Saved Questions — unchanged
- [x] Repeated Mistakes — unchanged
- [x] Reports — unchanged

---

## Build Health
- [x] npm run lint — 0 errors
- [x] npm run build — compiled successfully
- [x] No Mentor files touched
- [x] No API routes added or modified
- [x] No fake data introduced
- [x] No coins/streak/milestone calculation logic changed
