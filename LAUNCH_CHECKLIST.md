# Sentinel — Launch Test Checklist

Every item must pass before public release on Whop.

---

## 1. ONBOARDING

- [ ] Fresh install shows Welcome Screen → "Get Started"
- [ ] Trading Profile screen: select firm, account stage, account size
- [ ] Firm presets auto-populate reference limits (TopstepX/Apex/Tradeify)
- [ ] Personal Account flow works without presets
- [ ] My Trading Plan screen: pre-populated with conservative defaults
- [ ] Can edit all plan fields before saving
- [ ] After save → goes to Home (never shown again)
- [ ] Existing user migration: position_limits extracted into trading_plan

---

## 2. TRADING READINESS

- [ ] Shows once per day before locking (not after)
- [ ] Rest / Goal / Focus selections work
- [ ] Score calculates correctly (75+ = Ready, 50-74 = Recommended, 30-49 = Protected, <30 = Maximum)
- [ ] Recommendation Card shows specific numbers (Your Plan → Today's)
- [ ] "Apply Recommendation" saves to daily_session_plan and returns to Home
- [ ] "Keep My Plan" uses baseline and returns to Home
- [ ] "Skip for today" → status = 'skipped', no penalty, uses baseline
- [ ] "Take Today Off" (Maximum only) → full day block
- [ ] Does NOT re-appear after completion (same day)
- [ ] daily_session_plan row created in SQLite

---

## 3. HOME DASHBOARD (Unlocked)

- [ ] Today's Active Plan card shows correct values
- [ ] Protection Level badge displays (Ready/Recommended/Protected/Maximum)
- [ ] "Readiness not assessed" shows when skipped
- [ ] "Lock Session" button visible
- [ ] Lock confirmation dialog shows: values, duration, unlock time
- [ ] "Edit Trading Plan" navigates to Protection page
- [ ] Tightened banner appears when readiness suggested changes

---

## 4. LOCK FLOW

- [ ] Lock Session → confirmation → locks successfully
- [ ] Position limits broadcast to extension via WebSocket
- [ ] UI switches to locked dashboard immediately
- [ ] Day Rules apply correctly (tighten/block/override)
- [ ] Cannot lock if already locked
- [ ] Cannot lock with all limits at zero

---

## 5. LOCKED DASHBOARD

- [ ] Daily Mission displays
- [ ] Discipline Risk shows current level (updates every 30s)
- [ ] Tilt Meter renders
- [ ] Lock Status shows countdown timer (seconds tick down)
- [ ] Kill Switch button works (24hr block)
- [ ] Ghost Mode toggle works
- [ ] Floating Widget opens/closes
- [ ] Dev Unlock works (Ctrl+Shift+F12)

---

## 6. LOCK PERSISTENCE

- [ ] Close app while locked → reopen → still locked
- [ ] OS restart while locked → reopen → still locked
- [ ] Timer continues correctly after restart (not reset)
- [ ] Expired lock auto-resets on startup
- [ ] Lock state stored in SQLite (not localStorage)

---

## 7. UNLOCK FLOW

- [ ] Timer expiry → auto-reset → UI shows unlocked Home
- [ ] Trusted Person unlock: correct password → unlocks
- [ ] Trusted Person unlock: wrong password → fails + logged
- [ ] Early Unlock: request → cooldown timer → available after hours
- [ ] Dev Force Unlock: Ctrl+Shift+F12 → unlocks immediately
- [ ] After unlock: platform blocker deactivates, tray updates

---

## 8. EXTENSION — ORDER INTERCEPTION

### TopstepX (Fetch)
- [ ] Open order (Buy/Sell) → checked against limits
- [ ] Oversized order → blocked with overlay + sound
- [ ] Close/reduce order → ALWAYS allowed (never blocked)
- [ ] Cancel order → always allowed
- [ ] Modify stop/target → always allowed
- [ ] Session hours blocking works
- [ ] News event blocking works
- [ ] Symbol blocklist works

### Tradovate (WebSocket)
- [ ] WS order interception active (Socket#2: demo.tradovateapi.com)
- [ ] Oversized WS order blocked
- [ ] Close/reduce WS orders always allowed
- [ ] Market data socket (Socket#1) never intercepted

### General
- [ ] No exits ever blocked (CLOSE/REDUCE/CANCEL/MODIFY_PROTECTIVE)
- [ ] UNKNOWN orders → allowed (degrade protection, don't trap)
- [ ] String() wrapping prevents crashes on numeric fields
- [ ] Block overlay appears on prevented orders
- [ ] Block sound plays

---

## 9. EXTENSION — FALLBACK SAFETY

- [ ] Extension keeps blocking after desktop disconnects (emergency fallback)
- [ ] Extension loads last-known state from chrome.storage
- [ ] Full-screen bypass warning if extension disconnects while locked
- [ ] Platform blocker activates on extension disconnect

---

## 10. LOSS REACTION

- [ ] Does NOT trigger on single loss
- [ ] Triggers ONLY after 2+ verified consecutive losses
- [ ] Closing a position after overlay does NOT re-trigger
- [ ] Win resets the counter
- [ ] 60-second debounce between loss detections
- [ ] 30-second suppression after close/reduce orders
- [ ] 2-minute grace period after overlay dismissed
- [ ] Console shows debug logging for every state change

---

## 11. WIN STREAK PROTECTION

- [ ] Consecutive wins tracked correctly
- [ ] Loss resets win counter
- [ ] At threshold: reminder overlay shows
- [ ] At threshold: size reduction works (if enabled)
- [ ] At threshold: cooldown activates (if enabled)
- [ ] At threshold: "Take the win" suggestion shows (if enabled)
- [ ] At threshold: auto-lock fires (if enabled)
- [ ] Does not re-fire same streak (winStreakTriggered flag)
- [ ] Unlock resets all win streak state

---

## 12. PSYCHOLOGY COACH

- [ ] Cooldown after loss: blocks next order for configured seconds
- [ ] Escalating cooldown: doubles each consecutive loss (up to 4x)
- [ ] Max trades per day: blocks after limit reached
- [ ] Loss streak size reduction: halves contracts after 2+ losses
- [ ] One-way ratchet: size never goes back up
- [ ] Profit protection: locks after target hit
- [ ] Drawdown from high: locks after giving back configured amount

---

## 13. SESSION HOURS

- [ ] Orders blocked outside trading window
- [ ] Timezone conversion correct (ET/CT/MT/PT)
- [ ] Status indicator shows "inside/outside window"
- [ ] Extension enforces via TRL_SESSION_STATE

---

## 14. NEWS BLOCKER

- [ ] Events display in "Next 7 Days"
- [ ] Info panel (ⓘ) shows event details + market impact
- [ ] Orders blocked during configured window (X min before, Y min after)
- [ ] Desktop notification fires before event
- [ ] Custom events can be added/removed
- [ ] Blocking works even with news disabled (notification still works)

---

## 15. INSIGHTS PAGE

- [ ] Discipline Score ring renders correctly
- [ ] Score grades match (A+ through F)
- [ ] 7-day and 30-day averages calculate
- [ ] Streak counts consecutive 80+ days
- [ ] Violations list shows today's issues
- [ ] "Sentinel Protected You" stats display
- [ ] All theme colors applied correctly

---

## 16. SESSION REVIEW

- [ ] Timeline: today's events render chronologically
- [ ] Recovery: post-loss scoring works
- [ ] Temptations: blocked attempts grouped correctly
- [ ] Heatmap: weekday × hour grid renders
- [ ] Triggers: "Not enough data" until 20+ sessions
- [ ] Consistency: 6 factors calculate
- [ ] Effects: before/after comparison shows
- [ ] What If: scenarios generate per day

---

## 17. THEMES

- [ ] All 8 themes render correctly: Nebula, Aurora, Midnight, Hologram, Matrix, Luxe, Rosé, Arctic
- [ ] Time pickers visible on all dark themes
- [ ] Dropdowns readable on all themes
- [ ] Focus rings match theme color
- [ ] Toggle switches match theme
- [ ] No hardcoded cyan/purple remaining
- [ ] Lucide icons inherit theme colors

---

## 18. AUTO-UPDATER

- [ ] Checks on startup (5s delay)
- [ ] Checks every 30 minutes
- [ ] Downloads silently in background
- [ ] "Update ready" banner appears
- [ ] "Restart & Update" blocked while locked (shows error message)
- [ ] Auto-installs on quit (when unlocked)
- [ ] Database survives update (no data loss)

---

## 19. SETTINGS

- [ ] Cooldown hours configurable
- [ ] Start with Windows toggle works
- [ ] Minimize to tray works
- [ ] Trusted Person set/remove works
- [ ] Kill browser on bypass toggle works
- [ ] Theme switcher works (all 8 themes)
- [ ] Dev mode toggle (Ctrl+Shift+D)

---

## 20. PROTECTION PAGE

- [ ] Trading Profile card shows firm + plan summary
- [ ] "Edit Plan" opens inline editor
- [ ] Plan changes save to SQLite
- [ ] "Changes apply to next session" message clear
- [ ] Accordion sections: only one open at a time
- [ ] Smooth open/close animation
- [ ] All sections render their content correctly

---

## 21. INSTALLER & DISTRIBUTION

- [ ] Windows installer builds (.exe)
- [ ] Installer includes auto-updater config
- [ ] Fresh install → Welcome → Onboarding → Home
- [ ] Upgrade install preserves database + settings
- [ ] License activation screen works
- [ ] Valid license key activates correctly
- [ ] Invalid key shows error
- [ ] Extension .crx/.zip package available
- [ ] Extension installs from developer mode
- [ ] Extension pairs with desktop app via WebSocket

---

## 22. WHOP INTEGRATION

- [ ] Product page: $50/month, $400/year, $700 lifetime
- [ ] License key generation works
- [ ] Key delivery to customer after purchase
- [ ] 3-day trial flow
- [ ] Key validation on app startup
- [ ] Expired/revoked key blocks access

---

## 23. PERFORMANCE

- [ ] App starts in < 3 seconds
- [ ] No visible lag when switching tabs
- [ ] Lock/unlock response < 500ms
- [ ] Extension doesn't slow trading platform
- [ ] SQLite queries < 50ms
- [ ] No memory leaks on 8+ hour sessions
- [ ] CPU usage < 2% when idle (locked, no trading)

---

## 24. EDGE CASES

- [ ] Multiple browser tabs: extension works on all
- [ ] Multiple monitors: widget displays correctly
- [ ] System clock change while locked: timer adjusts
- [ ] Internet disconnection: lock persists, extension continues
- [ ] Database corruption recovery (app doesn't crash)
- [ ] Very long session (12+ hours): no degradation
- [ ] Rapid order attempts: no race conditions in blocking

---

## Sign-Off

| Area | Tester | Date | Status |
|------|--------|------|--------|
| Desktop App | | | |
| Browser Extension | | | |
| TopstepX Integration | | | |
| Tradovate Integration | | | |
| All Themes | | | |
| Installer | | | |
| Whop/License | | | |

---

*Last updated: 2026-07-22*
