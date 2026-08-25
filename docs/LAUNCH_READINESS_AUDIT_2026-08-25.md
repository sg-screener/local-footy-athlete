# LFA LAUNCH-READINESS AUDIT — 2026-08-25

**Who ran it:** the `audit` seat (Claude Fable), driving the real app on the iPhone 17 Pro simulator.
**Build audited:** branch `codex/failure-only-state-export` at `44736494` (the newest tip; `main` has nothing this branch lacks). Dev build via Metro from this checkout.
**Starting point:** the app's data container was wiped to a true first-install state (backup kept), and the audit began at the onboarding welcome screen as a brand-new athlete. This app has no accounts and no server-side athlete state (no auth flow, no Supabase client imported, generation is fully local), so a local wipe genuinely is a fresh athlete — that stops being true the day accounts arrive.
**Evidence:** full screen recording (`01-onboarding.mp4`, covers the whole session), storage snapshots before/after each phase, and the app's own error output. All in the session scratchpad `audit/` folder; key items called out per finding.

The athlete tested: 22-ish male inside mid, in-season, game Saturday, team training Tue/Thu, 3 gym days requested (Mon/Wed/Fri), full gym, consistent experience, 7:45 2km, no injuries.

---

## WHAT ACTUALLY WORKS — worth saying first

- **Onboarding end-to-end works.** ~20 steps, no crash, profile stored exactly as answered, program generated in seconds.
- **The generated week obeyed the Bible for this profile.** Mon Strength / Tue TT / Wed Strength / Thu TT / Fri Rest / Sat Game / Sun Rest. G-1 protected (it refused to put gym on Friday even though the athlete asked for Friday). The two strength sessions together covered the full weekly pattern set — squat, hinge, single-leg knee + hip, all four push/pull slots, core — with squat/hinge and single-leg pairs correctly matched, in-season rep ranges, 6 rows per session, loads consistent with the profile.
- **Decisions persist.** Move a session, bin a session, add a Gunshow, log team training, kill the app completely — everything came back correct on relaunch, and next week was correctly untouched.
- **The G-1 guard speaks.** Adding a hard conditioning session the day before the game got a proper "Big session the day before your game… pick one" ask with legal alternatives.
- **Coach chat is genuinely good.** Asked "why is there no gym session on Friday?" — it answered with the athlete's actual live week (it even knew about a swap made minutes earlier) and explained G-1 correctly.
- **On a clean world, the health doors work end-to-end.** "Properly sick" recomposed the program, put a Coach Note in My Status with named limits, and "I'm good now" cleared it cleanly. A severity-7 hamstring declaration recorded an episode and an active constraint.

That last line is the key to everything below: those same doors are broken on any world where the athlete has edited their week.

---

## THE PROBLEMS, RANKED

### #1 — Once you edit your week, the app can no longer adjust it: sick, wrecked, bye and swap all fail
**Severity: Critical**

**What is happening:** After the athlete makes normal plan edits (move a session, bin a session, add an optional session), every feature that needs to rebuild the program starts refusing. Telling the app you're properly sick fails. Telling it you're pretty flat (fatigued) fails. Declaring a bye fails. Swapping an exercise on a moved session fails. The messages say "try again in a moment" — retrying never works.

**How I reproduced it:**
1. Fresh athlete, generated program.
2. Drag Wednesday's strength onto Thursday (a team night); bin Monday's session; add Friday's Gunshow. All work.
3. Tap Sick → "Properly sick" → "Couldn't log that just now — give it another go in a moment." Retry: same.
4. Tap Tired → "Pretty flat" → same failure, twice.
5. Edit week → "I have a bye" → "Couldn't update your week", with the app's own internal error reading **"Rebuild failed: Generated week refused (hard_day_permitted_maximum:6)"**.
6. Quick-swap Bulgarian Split Squats on the moved Thursday session → "Could not swap exercise", twice. The same swap on the (added, not moved) Friday Gunshow works instantly.
7. Control: on an identical world with the athlete's decisions removed, every one of these doors works perfectly.

**What should happen:** A sick athlete gets a lightened week. A bye removes the game and reshapes the week. A swap swaps.

**What actually happens:** Nothing changes, with copy promising a retry will help. The athlete's decisions are the poison: any world with plan edits refuses all further program-changing actions.

**Why this is a big problem:** These are the core promises of the app — "it adapts with you." An athlete who moves one session (completely normal in week one) permanently loses the sick/fatigue/bye/swap doors. They'll conclude the app is broken, because it is.

**What is probably causing it:** Every one of these doors rebuilds the week from scratch and then replays the athlete's stored decisions on top before validating the result. That replayed week is over-counting hard days (a week that visibly has ~3 hard days was refused for exceeding a permitted maximum of 6) — most likely the replay is stacking sessions the regenerated base already has, or counting a stacked double day as several hard days. The app's own safety gate then refuses the rebuilt week, and the whole transaction is (correctly) rolled back — so the athlete's report never lands.

**How I think we should fix it:** Fix the rebuild-and-replay path so replaying the athlete's decisions onto a regenerated week produces the same week they can already see (it derives that exact week on boot, so the correct logic exists — boot replay and door-transaction replay are disagreeing). Then make the refusal message honest whenever the gate does refuse.

**What else this may fix:** #3 (injuries vanishing), the bye door, the away door (same rebuild path, untested), fatigue/illness declarations, exercise swaps on moved sessions — six visible features, one pathway.

**Evidence:** recording ~11:17–11:55 and ~12:17–12:24 (clean-world control); the on-screen error naming `hard_day_permitted_maximum:6` from `rebuildForGameChange` (useHomeScreen.ts:965 / generateProgram.ts:809); storage snapshots `storage-before-full-reset` (edited world) vs `storage-final-clean-world`.

**Confidence: Confirmed** (reproduced repeatedly, with a clean-world control isolating the trigger).

---

### #2 — "Full reset" doesn't reset: the next athlete inherits the previous athlete's edits
**Severity: Critical**

**What is happening:** Profile → Danger zone → Full reset says it wipes everything and returns to onboarding. It leaves the athlete's decision history behind. A new athlete who onboards afterwards gets a normal-looking program — until the first time they close and reopen the app, when the OLD athlete's edits are silently applied to THEIR program.

**How I reproduced it:**
1. On the edited world (moved session, binned Monday, added Gunshow, game moved to Sunday), ran Full reset → confirmed.
2. Checked storage: the decision ledger still holds all 6 old decisions (and exercise-rotation history also survives).
3. Onboarded a brand-new athlete. Their week looked correct: Mon Strength / Wed Strength / Sat Game.
4. Killed and relaunched the app once.
5. Their week is now: Mon Rest, Wed Rest, Thu "Strength + Team Training" (5 exercises — including the old athlete's exercise removal), Fri Gunshow, Sat Rest, game on Sunday. The new athlete did none of this.

**What should happen:** Full reset means gone. A new athlete starts from only their own answers.

**What actually happens:** A stranger's training decisions are replayed onto the new athlete's program, silently, on the first relaunch — and the two worlds (before/after first relaunch) disagree with each other.

**Why this is a big problem:** It's data leakage between athletes and silent program corruption. A shared phone, a re-onboard after a season, a support "just do a full reset" — all produce a wrong program that looks intentional. It also means "reset and try again" — the universal fix — makes things worse.

**What is probably causing it:** The reset's wipe list (resetCoach.ts) clears profile, program, calendar and coach stores but not `decision-ledger-store` or `block-selection-history-store`. Boot replay then does its job faithfully on stale decisions.

**How I think we should fix it:** One owner for "what a full reset clears" that provably clears every persisted store (the dev-only world reset already knows the full list). Belt-and-braces: stamp decisions with the program generation they belong to, so replay refuses decisions from a world that no longer exists.

**What else this may fix:** Any "my program changed by itself after reopening" report; possibly some of #1's over-counting if stale entries are ever replayed alongside fresh ones.

**Evidence:** storage dumps before/after reset showing the 6 surviving ledger entries; recording ~11:59–12:15 showing the clean week, the relaunch, and the transformed week.

**Confidence: Confirmed.**

---

### #3 — An injury report can disappear without a trace
**Severity: Critical**

**What is happening:** On an edited week (the state most real athletes will be in), declaring an injury — Injured → Lower body → Hamstring → 6-7/10 "Limiting" — closes the sheet and does absolutely nothing. No confirmation, no error, no injury recorded anywhere, no Coach Note, no program change. The athlete walks away believing the app is protecting their hamstring. It will keep prescribing heavy hinges and sprints.

**How I reproduced it:**
1. On the edited world: Injured → Lower body → Hamstring → 6-7/10. Sheet closes silently.
2. Checked storage: injury episodes empty, active constraints empty, no note.
3. On the clean-ledger world: identical taps → episode recorded (severity 7, active), constraint created.

**What should happen:** Per the app's own rules, a 6-7/10 injury must reduce risky work, add a Coach Note, and advise seeing a physio. At minimum, the athlete must see that the report landed — or that it didn't.

**What actually happens:** On edited worlds the report is swallowed whole. (Note: even on the clean world where it works, the sheet closes with no confirmation at all — success and total failure look identical.)

**Why this is a big problem:** This is the unsafe one. An injured athlete trusting the app gets a program that ignores the injury. It's also the same root as #1, but it deserves its own line because the failure mode is silence rather than an error.

**What is probably causing it:** Same rebuild-refusal as #1, but the injury flow discards the failed result instead of acknowledging it (the repo has a named rule that every tap must acknowledge its result — this door violates it).

**How I think we should fix it:** Fix #1's pathway, and make the injury sheet always confirm or always show the refusal — silence never.

**What else this may fix:** Trust in every "Not feeling 100%?" door.

**Evidence:** recording ~11:26–11:29 (edited world, empty storage after) and ~16:00 (clean world, episode recorded); storage dumps both sides.

**Confidence: Confirmed.**

---

### #4 — The Profile setup screen can't scroll, so half the editors are unreachable
**Severity: High**

**What is happening:** Profile → "Something changed? Tell the coach" opens "Review your setup". The page does not scroll. Everything below the fold — the program-setup editor with current phase, LFA days, team training days, usual game day, 2km time, and the "Update program" button itself — cannot be reached. The athlete cannot change their game day, team nights or season phase from Profile at all.

**How I reproduced it:** Opened the sheet, attempted three different scroll gestures (two speeds plus a slow drag) at different screen positions. The content is visibly clipped mid-row and never moves. The same gestures scroll every other screen in the app.

**What should happen:** Scroll; edit; update program.

**What actually happens:** The visible top half (player details, equipment) is editable; the rest is decoration.

**Why this is a big problem:** Changing game day / team nights is a core flow (it's even the thing NOW.md asks Sam to verify on his phone — he wouldn't be able to). The only other route to some of these is the week's fixture sheet, which doesn't cover team nights or phase.

**What is probably causing it:** The page's content is rendered inside the shared keyboard-aware scroll container (ProfileScreen.tsx `SetupUpdatePage`, ~line 1443), and that container's height is collapsing so it believes nothing overflows — the exact flex-height trap the repo's own Sheet component documents at length.

**How I think we should fix it:** Give the setup page's scroll container a definite height (the codebase already has the pattern and the warning comment); add a device check that the last control on the page can be reached.

**What else this may fix:** Any other sheet built on the same container that "fits exactly" today and clips on smaller phones.

**Evidence:** recording ~11:31–11:34; three identical screenshots after three scroll attempts.

**Confidence: Confirmed** (on iPhone 17 Pro simulator; other sizes untested but it's size-independent — the container never scrolls).

---

### #5 — Move the game to Sunday and next Monday still says "lift heavy"
**Severity: High**

**What is happening:** The Bible says the day after a game is rest/recovery only, and specifically that a Sunday game protects the following Monday. Moving this week's game from Saturday to Sunday correctly reshaped this week — but next week's Monday (the literal morning after the game) kept its full CORE strength session.

**How I reproduced it:**
1. Saturday game day → "Move or remove game day" → moved to Sunday 30 Aug. This week updated correctly (Sat became Rest).
2. Opened next week (31 Aug – 6 Sep): Monday 31 shows CORE Strength, 6 exercises, unchanged.

**What should happen:** Monday 31 becomes rest/recovery (G+1), and the rest of next week reshapes around it.

**What actually happens:** Next week is computed as if the Sunday game doesn't exist.

**Why this is a big problem:** It's a direct safety-rule violation the athlete can trigger with one normal action — and it's the exact class (a change in one week not reaching the next) that has bitten this repo before.

**What is probably causing it:** The game move is applied to the week being edited, but next week's derivation doesn't see the moved fixture — a cross-week boundary where the fixture change isn't in scope when the adjacent week is built.

**How I think we should fix it:** Make the fixture the single input both weeks derive from (the moved game is a dated fact; any week whose G+1/G-1 window touches it must re-derive), and add a test that moves a game to Sunday and asserts next Monday empties.

**What else this may fix:** Thursday-game school-footy cases and any end-of-week fixture whose protection spills into the following week.

**Evidence:** recording ~11:45–11:49; screenshots of both weeks after the move.

**Confidence: Confirmed.**

---

### #6 — The decision history re-uses IDs after every restart
**Severity: High (latent)**

**What is happening:** Every athlete action is stored as a numbered decision (dl-1, dl-2, …). The counter resets when the app restarts, so after one relaunch new decisions are saved with IDs that already exist. The audit world's ledger read: dl-1, dl-2, dl-3, dl-1, dl-2.

**How I reproduced it:** Made three edits, killed the app, relaunched, made two more edits, dumped `decision-ledger-store`.

**What should happen:** Every decision gets a unique ID forever — it's the thing undo, replay and audit all key on.

**What actually happens:** Duplicate IDs in an append-only history.

**Why this is a big problem:** Anything that looks a decision up by ID (undo the last decision, reversal entries, dedup during replay) can silently hit the wrong one. It may well be a contributor to #1's replay over-counting. Even if nothing reads IDs today, this is the kind of landmine that goes off two features later.

**What is probably causing it:** The ID is an in-memory counter while the entries themselves are persisted.

**How I think we should fix it:** Derive the next ID from what's actually stored (or use timestamps/UUIDs).

**What else this may fix:** Possibly parts of #1; future undo bugs.

**Evidence:** ledger dump in the audit notes (timestamps show the reset happening across the 10:57 relaunch).

**Confidence: Confirmed** (the duplication; its downstream damage is Unconfirmed).

---

### #7 — "Undo" is promised but can't be found
**Severity: Medium**

**What is happening:** Removing an exercise ends with "You can change or undo this in My Status." My Status then shows "0 ACTIVE — no modifiers currently impacting your program." The removal isn't there; there's nothing to undo. Separately, across every edit made in this audit (bin, drag-move, add, swap), no undo toast or undo affordance ever appeared — a wrong bin has no one-tap way back (the binned session can be re-added via the + menu, but that's a rebuild, not an undo).

**How I reproduced it:** Removed Band Pallof Press ("Today only", for Thursday) → opened Coach → My Status: 0 active.

**What should happen:** The place the app names is the place the undo lives.

**What actually happens:** The promise points at a screen that filters the removal out (possibly because it's scoped to a future day — either way the athlete can't find it).

**Why this is a big problem:** Athletes make mistakes; reversibility is what makes editing safe to try. A promised undo that isn't there reads as data loss.

**What is probably causing it:** My Status lists "active modifiers" (today-scoped), while scoped exercise removals live elsewhere; the copy was written for a surface that doesn't show them.

**How I think we should fix it:** Either show scoped removals/decisions in My Status, or point the copy at the real home; and put the undo toast back on the bin/move/drag actions.

**What else this may fix:** #8's copy cluster; athlete trust in experimenting.

**Evidence:** recording ~11:13 (removal + promise) and ~11:30 (My Status 0 active).

**Confidence: Confirmed.**

---

### #8 — The app says things that aren't true (small lies, everywhere it matters)
**Severity: Medium**

**What is happening:** A cluster of copy that misreports state, all found in one session:
- "Couldn't log that just now — give it another go in a moment" — for a failure that never resolves (#1).
- "Got it — logged how you're feeling. Your week's adjusted to match" — after a record-only tired report that adjusted nothing.
- The same sheet saying "There is no session to lighten today" and "Today is adjusted around how you said you're feeling," seconds apart, when neither adjustment existed.
- "Session removed. Your remaining sessions already cover this week's target" — after binning one of two strength sessions against a 2-per-week block target.
- "today only. Today only (2026-08-27)." — doubled phrase in the removal confirmation.

**Why this is a big problem:** Each one alone is small. Together they teach the athlete that the app's words don't track reality — which is fatal for an app whose whole pitch is "trust me with your training." The repo has a signed-copy law precisely because of this; several of these sentences claim outcomes the committed result didn't produce.

**How I think we should fix it:** Route these acknowledgments through the committed result (the ack module's own documentation says exactly this); audit success sentences that claim state changes.

**Evidence:** recordings/screenshots at each moment (~11:17–11:23, ~10:53).

**Confidence: Confirmed.**

---

### #9 — Logging team training: the form looks filled but Save is dead
**Severity: Medium**

**What is happening:** The club-training log shows "90" in the minutes box, styled like a value. It's a placeholder — the field is empty. With completion and effort answered, Save & Finish just sits there disabled, no message, no hint. Typing the same "90" that's already displayed brings it to life.

**How I reproduced it:** Log Session → Fully → slider to 7 → tap Save & Finish three times (nothing) → tap minutes, type 90 → Save works.

**Why this is a big problem:** Logging TT is a twice-a-week core action. A dead-looking Save on a form that looks complete is a "this app is broken" moment, and the repo's own laws ban dead affordances and unexplained disabled saves (the setup sheet already states its blocked reason — this form doesn't).

**What is probably causing it:** Placeholder styled like a value + a validity gate (`duration.valid`) with no visible reason (SessionFeedbackPanel.tsx ~299-308).

**How I think we should fix it:** Make the placeholder unmistakably a placeholder (or prefill it as a real default), and give the disabled Save a stated reason.

**Evidence:** recording ~10:47–10:52.

**Confidence: Confirmed.**

---

### #10 — A session moved onto a team night keeps team-night-unsafe exercises
**Severity: Medium**

**What is happening:** Dragging Wednesday's strength onto Thursday (team training night) kept the session's exact content — including heavy RDLs and Bulgarian split squats. The Bible's team-night rule is: same size, regular loads, but avoid high-soreness picks and heavy low-back/groin work — RDLs and rear-foot-elevated split squats are its named examples.

**How I reproduced it:** Drag on the Week board; opened Thursday's session; content identical to the Wednesday original.

**What should happen / what actually happens:** Two of the app's laws collide: moved content must be conserved (a hard-won rule here), but team-night selection should filter picks. The move conserves and never re-filters; the athlete lifts heavy RDLs before training with the team, two days before a game.

**Why this matters:** Soreness into team training and G-2. This needs Sam's ruling more than a bug fix: on an athlete-initiated move, does the team-night exercise filter re-run (with disclosure), or does conservation win?

**Evidence:** recording ~11:00–11:02; screenshots of both sessions.

**Confidence: Confirmed** (the behaviour; whether it's a defect is a ruling for Sam).

---

### #11 — Raw internal errors reach the screen
**Severity: Low (dev builds only, as far as observed)**

**What is happening:** The failed bye surfaced a developer toast — "[GameChange] Rebuild failed: Generated w…" — under the product alert, tappable through to a stack trace. Observed on the dev build; LogBox doesn't exist in Release, but every `logger.error` on this path is one build setting away from an athlete seeing internals.

**How I think we should fix it:** Covered by fixing #1/#8 — the product alert is the only voice; keep diagnostics in the log.

**Confidence: Confirmed on dev build; Release behaviour not tested.**

---

### #12 — A brand-new athlete's first week contains dead past days
**Severity: Low**

**What is happening:** Onboarding on a Tuesday produced a week whose Monday (yesterday — before the app was even installed) shows a full CORE strength session with "Start Session", no missed-session prompt, silently counting for nothing. The Tired/Sick/Injured chips also render on past days with "we'll adjust today" copy.

**Why it matters:** First-hour confusion ("am I already behind?"). Small, but it's the athlete's very first screen-full.

**How I think we should fix it:** Days before the program's generation anchor should present as not-applicable rather than as un-started obligations.

**Evidence:** recording ~10:41; screenshots.

**Confidence: Confirmed.**

---

## NOT COVERED (named, per L2)

- **The 4-week block changeover** (week 5 doesn't exist until the boundary; not testable without the dev clock, which this audit deliberately didn't touch).
- **The away/holiday flow** (same rebuild pathway as the bye — expect #1 applies, untested).
- **Bodyweight-only athlete** (R-083's removals + disclosure — registry already records it unenforced; not re-proven here).
- **Coach chat program mutations** (chat is read-only by construction; mutations blocked pending reassessment per the QA runbook).
- **Release build, physical iPhone, low-end devices.**
- **Multi-week logging history / Progress over time** (only one session was logged).
- Sam's note about server-side state is answered above: nothing server-side exists today; re-answer this the day accounts land.

---

## THE 5 THINGS I WOULD FIX FIRST

1. **The rebuild-and-replay pathway (#1)** — the transaction that regenerates the week and replays decisions must reproduce the week the athlete already sees.
2. **Full reset's wipe list + replay guard (#2)** — clear every store; refuse to replay decisions from a dead world.
3. **Ledger ID uniqueness (#6)** — one line of risk removal that protects undo/replay forever.
4. **The Profile setup scroll (#4)** — unblocks changing game day / team nights / phase at all.
5. **Cross-week fixture protection (#5)** — a moved game must protect the day after it, wherever that day lives.

## WHAT THOSE 5 FIXES MAY SOLVE

Fix 1 alone should revive six visible features: illness, fatigue ("pretty flat" and "totally cooked"), bye weeks, exercise swaps on moved sessions, the silently-vanishing injury reports (#3), and most likely the untested away flow. Fix 2 kills the "program changed by itself" class and makes reset a real support tool. Fix 3 de-mines undo and replay before anything else is built on them. Fix 4 restores a whole flow bundle (game day, team nights, phase, 2km). Fix 5 closes the family of "this week changed, next week didn't notice" safety holes. The copy fixes (#8) become mostly moot once #1 stops failing, but the ack-layer rule (say only what the committed result did) is still worth enforcing.

## LAUNCH VERDICT

**CLOSE — FIX THESE FIRST.**

The foundations are genuinely good: generation obeys the coaching rules, decisions persist perfectly across relaunches, and the coach chat is a real asset. But today, one normal edit locks an athlete out of every adjustment door, a sick or injured athlete's report can vanish silently, and a reset leaks one athlete's decisions into the next athlete's program. Most of that traces to one rebuild pathway plus one wipe list — a short, concentrated fix list, not a rebuild. Do not ship until #1–#3 are fixed and re-proven on an edited world; after that this is a beta-able app.

---

*Audit artifacts: session scratchpad `audit/` — `recordings/01-onboarding.mp4` (full session), `storage-after-onboarding/`, `storage-before-full-reset/`, `storage-final-clean-world/`, `app-data-backup-before-wipe/` (pre-audit state, restorable).*

---

# ADDENDUM — same day, after the fix session (late afternoon)

Sam ordered the #1 fix started while he drove the simulator checklist. Codex is
away; the `audit` seat did the work. Everything below is measured, not recalled.

## Finding #1 splits into TWO root causes — one is FIXED, one is diagnosed

**Root cause A — generation vetoed the athlete's own statement. FIXED, commit
`bf8aef53`.** The generator's `weekAcceptance: 'forward_decision'` option has
documented, Sam-approved behaviour ("publish the best achievable week instead
of throwing — it is not generation's place to veto a fact the athlete stated")
and was passed by both of its callers and read by NOTHING. Any sick/fatigue/bye
rebuild whose reduced week missed any contract clause threw, rolled the
athlete's fact back, and showed "give it another go in a moment" forever.
Proof, device-exact: the failing simulator world's storage snapshot was
hydrated headlessly through the app's own boot; "Pretty flat" and "Properly
sick" reproduced the exact refusal (`main_strength_required_minimum` /
`required_safe_patterns_present:squat` rollback), and with the fix both commit
("safely recomposed", fact + 7-day window created). New guard in the chain:
`test:forward-decision-acceptance` — born red, green with the fix; the default
strict path provably still refuses. Blast radius measured both arms in a
detached worktree at HEAD: every neighbouring suite's failures are
IDENTICAL with and without the fix.

**Root cause B — the plan-edit transaction contradicts the athlete's own
edits. DIAGNOSED, deliberately not patched.** The swap on a moved session
commits, then the transaction's §18 post-apply verification rejects the whole
candidate week: `Section 18 final-week rejection
(reduction_contradiction:main_strength:3)` — the candidate the transaction
re-derives RE-ADDS sessions the athlete removed/moved, which contradicts the
authorised-reduction records those same edits wrote, so the verifier
(correctly, by its own lights) rolls the swap back. The boot replay rebuilds
the athlete's week faithfully; the door transaction's internal re-derivation
does not — two rebuilders of one week, disagreeing. Fixing it means making
the transaction's candidate equal the week the athlete sees, which is the
composition-ownership seam item 68 already puts to Sam; per the stop-patching
law this is his architecture call, not a guard to bolt on. Until then: swap
works on added sessions and un-edited weeks; it refuses (honestly, nothing
corrupted) on moved sessions after a relaunch.

## New measured facts for the launch picture (all pre-existing at HEAD)

- **Three chain suites are DEAD at import** — `test:week-rebuild`,
  `test:fixture-mutation-transaction`, `test:game-local-rebuild` crash on
  `Cannot find module 'section18ProgramObservation'` (deleted by commit
  `3f97cc67` with its importers left behind). They report nothing and read as
  known-red.
- **The gender gate (R-130) has rotted a band of suites**: 13 red cells in
  `test:readiness-ownership`, 8 in `test:illness-recovery-mode` — every one
  failing with "I still need to know your gender", i.e. fixture athletes
  predating the required field. Same class the move-suite fix hit earlier.
- **`test:scenarios` fails 12 scenarios at HEAD; `test:accepted-state-transactions`
  reports failures=25 at HEAD** — identical before and after the fix.
- **`test:compile` is red at HEAD** on `src/utils/exerciseFilter.ts` (1 error
  over baseline), before any of this session's edits.

## Corrections to the main report

- #1's "How I think we should fix it" was half right: the boot-vs-door
  disagreement is real (root cause B), but the sick/flat/bye deaths were the
  simpler root cause A. The report's claim that one fix revives six doors
  holds for A's five (sick, flat, cooked-on-edited-worlds, illness, bye
  pending on-glass confirmation); the swap needs B.
- The bye's `hard_day_permitted_maximum:6` was generation refusing its own
  best week under A — the athlete-decision replay-stacking hypothesis was
  wrong for A (and right in spirit for B).

## Still owed

- On-glass confirmation of the fixed doors and the bye (Sam is driving the
  simulator checklist; Metro hot-reloads the fix, so checklist items 6–8 may
  now PASS — that is the fix landing, not the audit misfiring).
- Root cause B: Sam's direction (item 68 composition ownership) before code.
- Findings #2–#12 of the main report: untouched, still open.

---

# ADDENDUM 2 — 2026-08-26, overnight fix session (Sam testing deferred to morning)

Three more fixes landed overnight, on top of the four from yesterday. Every
one has a born-red guard and a both-arms blast-radius measurement; details in
the commit messages.

- **#4 FIXED and seen on glass — the un-scrollable screens.** The shared
  keyboard container wrapped every scrolling screen in a tap-to-dismiss layer
  that swallowed scroll gestures; it now exists only while a keyboard is up.
  The Profile setup page scrolls to its last control (the game-day editor and
  the Update button are reachable), and the same wrapper sat under the coach
  chat — Sam's 2026-08-09 "chat history is stuck" device report. Commit
  `6e838f37`.
- **#5 HALF-FIXED — the moved-game cross-week protection.** Root cause found
  and named: the scheduler's cross-week fixture window was fabricated as
  "usual game day ±7" (the ±7-invention pattern), so a game moved to Sunday
  was invisible to the following week. The scheduler now receives the REAL
  adjacent fixtures from the calendar (guard: three cells in
  weeklySchedulerTests, born red on the exact device shape — Monday now
  schedules NO strength after an adjacent Sunday game). Commit `c96be8cf`.
  **What remains, verified on glass 2026-08-26:** an ALREADY-PUBLISHED
  adjacent week is not re-authored when a game moves next door — the
  dependent-week repair is a minimal replan by design (it relocates displaced
  work; it does not re-plan days), so the stored Monday session survives the
  move. Every path that actually re-enters the scheduler (fresh generation,
  regeneration, availability/bye rebuilds, block rollover) is protected; the
  fixture-move-next-door path needs the week re-authored, which is the same
  composition-ownership seam as root cause B and is parked on the item-68
  decision with it.
- **Sighting for the dead-suite ledger:** `test:away-flow` now also dies at
  import (`validateWorkoutAgainstActiveConstraints is not a function`) — it
  was 49/0 at seat-inbox time.

Fix tally against the original report: #1 root A fixed · #2 fixed · #3 fixed
(same root as #1A) · #4 fixed · #5 half-fixed (generation side) · #6 fixed —
and the #6 fix is visible in production data (the fixture move minted a
unique `dl-2` on a relaunched world that would previously have re-minted
`dl-1`). Open: #1 root B (swap on relaunched moved sessions) and #5's
published-week half — both behind the item-68 composition-ownership decision;
plus findings #7-#12 (undo homes, copy honesty, club-log placeholder,
TT-night selection ruling, dev error leak, past-day rendering).
