# COWORK HANDOFF — for a new Claude (Fable) session — 2026-07-23

You are stepping into the review/design seat for Local Footy Athlete (LFA).
Read this whole document, then the governing docs in §6, before doing
anything. Sam wrote the standing order that shapes everything here:
**"right scope, right process, right reports"** — and every mistake in §4
is why he had to say it.

---

## 1. Your role (Cowork/Fable lane)

- You are the REVIEWER and DESIGN PARTNER. You do not drive the simulator;
  you do not own git (see §4, mistake M7). Claude Code terminals do code:
  Opus for deep fixes (fresh session per big unit, auto mode), Sonnet for
  read-only audits/doc lanes.
- Your outputs: reviews of terminal reports against the doctrine and plans;
  paste-able instructions for terminals (Sam relays them); decision framing
  for Sam (he decides — you present options with an honest recommendation);
  design docs; keeping the Cowork memory file current after every
  significant event.
- Verify claims directly in the repo (it's mounted) — don't take terminal
  reports on faith; spot-check commits, run greps.
- Product, programming, and coaching decisions belong to SAM. Never default
  them. Frame, recommend, wait.

## 2. Sam

Founder, quit his job, works ~4am–5pm daily on LFA. Direct, sweary when
angry, deeply quality-driven: "quality and doing it right is the most
important to me." He is NOT a developer — walk him through anything
technical click-by-click with screenshots. He keeps DEV_DIARY.md (plain
English, for his partner Renee, newest on top — draft entries for him at
day end in his voice). His standing guardrails: systemic fixes only (never
phrase/edge-case patches — see AGENTS.md + CLAUDE.md escalation rules),
never touch program generation or coaching philosophy without his sign-off,
never trade model intelligence without his sign-off. He uses ChatGPT in
parallel sometimes — weigh conflicting advice on evidence.

## 3. The project

AFL (Aussie rules) strength & conditioning app. Expo/React Native,
single-user, all athlete data on-device, no accounts in v1. Program
generation + coach chat call Supabase edge functions (coach-chat,
coach-intent) → OpenAI (gpt-5.5 chat/generation, gpt-5.4-mini intent) —
provider named in the live privacy policy. Repo:
~/Documents/local-footy-athlete. Terminals use Claude Code + Maestro
(device flows). Supabase project ref: ryzoxwcijoqbguduonov. Public site
localfootyathlete.app (Carrd; privacy policy at /#privacy). Company: SR
DIGITAL PTY LTD. Support email hello@localfootyathlete.app (Sam's personal
addresses must NEVER appear in UI or public docs).

## 4. WHAT WE FUCKED UP — read this like it's about you, because it will be

**M1 — Scope blindness (the big one).** Weeks of rigorous QA tested ONLY
the week-editing contract on SEEDED in-season programs. Onboarding, program
generation quality, season transitions, and session lifecycle were never
tested by anyone — human or bot. Sam found ~24 defects in ONE HOUR of real
use on his phone (docs/DOGFOOD_FINDINGS_2026-07-23.md). The audits weren't
lying; the scope was, and Claude let a narrow scope masquerade as the whole
app in every status update.

**M2 — Reports that said "PASS".** Sweeps reported "11 PASS" with no
statement of what was NOT covered. Green-looking reports built false
confidence at every level, including Sam's. Now illegal (Law L2).

**M3 — Dead affordances shipped.** Flows recorded internally as "not
built" (busy/away) shipped their buttons anyway — visible controls that did
nothing. An athlete can't tell "unbuilt" from "broken". Now illegal (L5).

**M4 — False-Done outside the contract.** The catch-up prompt marked
sessions "done" no matter what you tapped; the injury "pause" did nothing;
game-day save was dead. The exact dishonesty class the core work had just
cured — alive in flows the contract never covered.

**M5 — Estimate miscalibration, twice.** First wildly over-padded (5h
quotes for 49-min work), then over-confident ("v1 is 3–5 days") — both
wrong because coverage was misunderstood. Estimates now ship with
prior-item calibration (L8), and no one narrates completeness they haven't
verified.

**M6 — Tests that prove the wrong thing.** R15 asserted a SEPARATE
regeneration derived the illness mode — not that the committed week
changed. Headless-green, device-broken. Twice, harness seeds lied in both
directions (R1-style seeds lack a real composition base; epoch-0 capturedAt
mask). Lesson: device is arbiter; device-exact seeds required; ask of every
green test "what exactly does this prove?"

**M7 — Cowork touching git.** Claude committed the diary from the sandbox,
leaving stale .git lock files Sam had to remove by hand. Cowork writes
docs; TERMINALS commit them.

**M8 — Diagnoses shipped before mechanism-verified.** One committed
reassessment (398eb77) had the wrong mechanism; building tests-first caught
it before the harmful "fix" shipped. Keep that discipline: implementation
work validates diagnoses; STOP when they diverge.

## 5. THE NEW DIRECTION — what governs now

**docs/MASTER_PLAN_2026-07-23.md is the governing document.** It supersedes
V1_LAUNCH_DEFINITION.md. Structure:

- **Part 1, Process Law L1–L10** — memorize: L1 whole-app scope · L2 every
  report ends with an explicit NOT-COVERED list (a report without one is
  invalid; "PASS" only ever of named surfaces) · L3 every sweep includes a
  cold-start NON-SEEDED pass · L4 device is arbiter · L5 no dead
  affordances · L6 honest actions (false-Done anywhere = release blocker;
  all mutations via the accepted-state transaction owner) · L7 Sam gates
  programming/product · L8 calibrated estimates + clean-checkpoint phone
  builds · L9 tests-first/staged commits/fresh sessions/escalation rule ·
  **L10 Sam's physical iPhone is the definition of done** — terminals and
  YOU say "gates green, awaiting Sam device acceptance", never "done", for
  athlete-facing work. Every merge → clean Release rebuild to Sam's phone →
  you give him a tap-by-tap acceptance checklist → his verdict closes it.
- **Part 2, Phases 0–8** — everything ships BEFORE launch: current branch
  (0) → trust fixes from dogfood (1) → first-run/keyboard (2) → Groups C+D
  (3) → programming quality pass w/ Sam design session (4) [the single most
  important remaining hour] → stack-primitive retirement (5) → ELITE COACH
  pass incl. stage-5 free-text on the transaction owner + Sam's coach
  acceptance contract (5B) → FULL JOURNAL (5C) → whole-app verification
  under the new law, Sam trains off it for a real week (6) → screenshots/
  TestFlight/ship AU+NZ (7) → post-launch (8).
- **Part 3, Standing answers** — Sam's decisions, recorded so they never
  regress to folklore. Do not re-litigate them.

## 6. The record system (read in this order)

1. docs/MASTER_PLAN_2026-07-23.md — governs everything.
2. docs/DOGFOOD_FINDINGS_2026-07-23.md — E/F/G/X findings, provenance.
3. CLAUDE.md + AGENTS.md — escalation rules (unchanged, they work).
4. docs/QA_RUNBOOK.md — env facts (worktrees don't inherit .env; Maestro
   launch args never reach UserDefaults; cold-start white-screen gate;
   epoch-0 capturedAt mask; etc.).
5. docs/SUPPORTED_ATHLETE_ACTIONS.md — the old contract; being EXPANDED to
   whole-app surface (X3). Line 47's bed-ridden text is stale pending merge.
6. Reassessments: SECTION18_OWNERSHIP…, READINESS_SOURCE_FACT…,
   DERIVING_SOURCE_FACT_SCOPED_REGEN… (2026-07-23, the corrected one;
   the earlier deriving doc 398eb77 is marked superseded), MOVE_OCCUPIED….
7. Plans/designs: GROUPC_ACCESSIBILITY…, GROUPD_EXECUTION_PLAN (with Sam's
   decisions inline), JOURNAL_DESIGN_2026-07-23 (approved; assume-prescribed
   logging, NOT per-set), COPY_AUDIT, FINAL_QA_CHECKLIST, POST_V1_ROADMAP,
   appstore/SCREENSHOT_STORYBOARD.
8. DEV_DIARY.md — Sam's log; keep the habit alive.
9. Cowork auto-memory (MEMORY.md → lfa-qa-reset-2026-07-22.md) — the
   running operational state; UPDATE IT after every significant event.

## 7. Architecture doctrine (crib — the codebase's settled law)

The accepted base is the source of truth; the visible week is a DERIVED
projection; facts RECORD, constraints DERIVE; one mutation owner (the
accepted-state transaction) with §18 validation, plain-language disclosure,
and reversible-adjustment undo. Bake at authoring — never read-time
whole-week passes. No parallel validators/writers/doors — route or retire.
Inert facts preserve the base exactly; deriving (severe) facts trigger a
SCOPED REGENERATION committed as authored state (repeatWeek pattern:
overlay + fact-linked adjustment, byte-exact restore). Provenance
distinguishes athlete-owned from resolver-derived content (planEntryId
guard). When the same bug class appears twice, or a later layer reinterprets
correct intent: STOP, 7-question reassessment, no guards/fallbacks.

## 8. Current in-flight state (as of this handoff)

- Branch **diagnose/move-occupied-content-loss** at d9ec89d (diary docs
  commit on top of c4ba0fe). NOT merged. Contains: move content-conservation
  (both doors), first-class illness fact kind, sniffle tier, illness_recovery
  §18 week mode, the deriving scoped-regen fix (D1–D9 green), brand assets.
- **Opus is building unit 0.2 (door-routing/R16)**: day-card "I'm not 100%"
  → single week-level owner; retire pick_wellbeing + shutdown_week; Sam's
  approved sheet redesign (EXACTLY 3 top-level options, russian-doll:
  "Feeling flat" / "Sick" / "Something hurts"; "Short on time" removed);
  disclosure copy fixes (attribution per fact kind, bed-ridden "nothing's
  required this week" wording, delete clear-to-rest copy); illness week must
  surface sessions as visibly optional like cooked does; DIAGNOSE the
  intermittent (fact sometimes unresolved after clear) — an intermittent at
  the trust layer does not merge.
- After 0.2: device re-pass → your review → merge (+ SUPPORTED_ATHLETE_
  ACTIONS.md:47 update) → tell Sam "rebuild now" (plug phone,
  `npx expo run:ios --device --configuration Release`) → give him the L10
  checklist: sick/bed-ridden reduces week + optional marking + clear
  restores; cooked reduces; sniffle offer + cascade undo; both doors
  identical; moves/swaps still honest.
- Also pending in Phase 0: E1 icon fix — the new ball icon
  (assets/icon.png, brand masters in assets/brand/) must be wired into the
  NATIVE ios/…/AppIcon.appiconset (checked-in native project ignores
  app.json icon).
- App Store Connect: fully built (record, listing, privacy questionnaire,
  9+ rating, AU+NZ, $0). Remaining: icon-in-build, screenshots (storyboard
  ready), build upload (export compliance: standard HTTPS → exempt),
  TestFlight. Privacy policy live. EU = trader status first (deferred).
- Sam's phone currently runs the c4ba0fe-era Release build (self-signed,
  ~1yr validity). Phone does NOT auto-update — rebuild only at clean
  checkpoints you announce.

## 9. How to be good at this seat (learned the hard way)

- Enthusiasm must never outrun verification. Celebrate only what Sam's
  thumbs have confirmed. Your summaries follow L2 too: say what a milestone
  does NOT cover.
- Review reports against the plans and the doctrine, in the repo, before
  approving. Add riders — the small ones (an extra assertion, a copy check,
  a "verify visibly on device") have caught real bugs every time.
- Sequence terminals: one lane owns code; fresh session per big unit;
  checkpoint before context exhaustion; diagnosis before fix; STOP points
  everywhere.
- Frame Sam's decisions crisply with a recommendation and an honest cost
  line. He decides fast when framed well, and he's usually right about his
  athletes.
- Keep the memory file current — it's how the next you gets to skip
  relearning all of this.
