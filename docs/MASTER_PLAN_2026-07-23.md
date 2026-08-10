# MASTER PLAN — the whole road to done (2026-07-23)

> **SUPERSEDED AS A PLAN — DO NOT PLAN FROM THIS FILE.** Governing sequence is
> `docs/PUBLISH_ROADMAP_2026-08-05.md`. **PART 1 (Process Law L1–L10) IS STILL
> BINDING** and is now carried as registry rows `LAW-L1-*` … `LAW-L10-*`; it is
> the SEQUENCE below that is retired. This file carried no supersession marker
> until 2026-08-10.

This document supersedes V1_LAUNCH_DEFINITION.md as the governing sequence.
"Done" means: everything Sam and Claude have designed and agreed — built,
verified under the corrected process, and shipped. Launch is a milestone on
this road, not the destination. Sam places the launch line; the work order
below is dependency-driven either way.

Companion docs (still authoritative for their content):
DOGFOOD_FINDINGS_2026-07-23.md (groups E/F/G/X), GROUPD_EXECUTION_PLAN,
GROUPC_ACCESSIBILITY_OWNERSHIP_PLAN, STACK_PRIMITIVE_RETIREMENT_DIAGNOSIS,
JOURNAL_DESIGN_2026-07-23.md, POST_V1_ROADMAP.md (feature detail),
FINAL_QA_CHECKLIST.md (to be extended per Process Law below).

---

# PART 1 — PROCESS LAW (corrected; applies to ALL work from now on)

These exist because the 07-23 dogfood run proved the old scope was
structurally blind. Non-negotiable.

**L1 — Whole-app scope.** The test surface is the entire app as a new
athlete experiences it: cold install → onboarding → generation → weeks 1–4
→ season transitions → every visible control. The week-editing contract is
a SUBSET, not the surface.

**L2 — Mandatory NOT-COVERED section.** Every report, sweep, audit, and
checkpoint MUST end with an explicit "NOT COVERED" list naming the surfaces
it did not touch. A green report with no NOT-COVERED section is an invalid
report. "PASS" may never be said of the app — only of named surfaces.

**L3 — Cold-start passes.** Every device sweep and the final QA include a
NON-SEEDED pass: real onboarding, real generation, multiple weeks, at least
one season-mode change. Seeded harnesses are necessary, never sufficient.

**L4 — Device is arbiter.** Unchanged, now with L3 teeth.

**L5 — No dead affordances.** Every visible control either works or does
not exist. Enforced by a repo-wide sweep test where feasible; re-checked in
every cold-start pass.

**L6 — Honest actions.** Any tap that reports/implies success must
demonstrably do the thing (the false-Done class is a release blocker
wherever found). All program mutations route through the accepted-state
transaction owner. Facts record; constraints derive; the visible week is a
projection.

**L7 — Sam gates.** Programming/coaching content and product semantics are
Sam's sign-off. Terminals stop and ask; Claude (Cowork) frames decisions,
never makes them.

**L8 — Reporting calibration.** Estimates come with the previous item's
estimate-vs-actual. Phone builds only from clean checkpoints, stated in the
report.

**L9 — Checkpoint discipline.** Tests-first; staged commits; fresh session
for big units; escalation rule per CLAUDE.md. (Unchanged — these worked.)

**L10 — Sam's phone is the definition of done.** No athlete-facing fix is
"done" until Sam has verified it on his physical iPhone. Workflow: every
merged checkpoint gets a clean Release rebuild to Sam's phone; the fix's
report lists exactly what Sam should check and how; Sam's confirmation
closes the item. Terminals report "gates green, awaiting Sam device
acceptance" — never "done" — for athlete-facing work.

**L11 — The matrix before the phone.** **L12 — Verification strategy is
reviewed like code.** Both live in `AGENTS.md` under "PROCESS LAW — L11 and
L12", because they bind the review/orchestration seat (Cowork) as well as
implementing sessions, and that seat reads `AGENTS.md` rather than this
document. They are Process Law with the same force as L1–L10; the list does not
stop at L10.

In short: L11 makes Sam's device the LAST instrument (the athlete-action matrix
— every door × every day-state × every route — must be green first, and all fix
work stops the moment two defects differ only by their combination coordinates).
L12 requires every boundary report to say what would catch the NEXT defect of
its class, and makes accepting fix-by-fix verification a reviewer's failure, not
just an implementer's.

---

# PART 2 — THE ROAD (dependency order)

## Phase 0 — finish what's in flight (branch diagnose/move-occupied-content-loss)
- 0.1 Severe-class scoped-regen fix (D1–D9) — Opus building now.
- 0.2 Door unification (day-card → week sheet, retire pick_wellbeing, R16)
      **incorporating X2**: max ~3 top-level options, russian-doll
      expansion, icon cleanup (Sam's design instruction).
- 0.3 Whole-branch device pass (move chain, both doors, sniffle,
      bed-ridden reduced+optional+clear, cooked actually reducing) → MERGE.
- 0.4 chore(brand) commit + E1 icon fix (wire new icon into the native
      ios/ AppIcon asset catalog) — then a clean phone rebuild for Sam.

## Phase 1 — trust everywhere (new, from dogfood F/G groups)
- 1.1 F1 catch-up prompt: every option does what it says (skip skips,
      missed marks missed, move moves — via the transaction owner);
      includes E6 signup-date accounting (pre-signup sessions display-only,
      never counted missed).
- 1.2 F5 game-day save/finish unresponsive; F4 game feedback copy.
- 1.3 F6 mid-session injury flow: "pause affected training" must visibly
      do what it claims (route to the injury/constraint owner) or the
      affordance is redesigned/removed.
- 1.4 G6 pre-season shift parse failure (client/server generation contract
      — diagnose schema drift, fix, add contract test both sides).
- 1.5 G5 off-season generation shape: no game day in off-season; correct
      off-season week structure (overlaps Phase 4 design — mechanical
      fixture/carryover bug fixed here, structure quality in Phase 4).
- 1.6 X1 dead-affordance sweep: HIDE busy/away flows (Sam's call — they
      return as designed features 5.4/5.5 later), sweep the whole app for
      any other control that does nothing (incl. G9 equipment change:
      fix it or hide it — diagnose first).

## Phase 2 — first-run experience (Group E)
- 2.1 ONE systemic keyboard/input convention (avoidance + accessory +
      dismiss behavior) applied to every input screen — fixes E3/E4/E7 as
      a class.
- 2.2 Layout polish: E2, E5 (and a pass over all onboarding screens at
      multiple device sizes).
- 2.3 Cold-start Maestro flow ADDED to the suite: install → onboarding →
      generated week visible → day 1 open. Runs in every sweep (L3).

## Phase 3 — accessibility + small sweep (already specified)
- 3.1 Group C per approved plan (invert pinned tests, label wire-through,
      static-scan invariant).
- 3.2 Group D per approved plan + Sam's decisions (feedback form
      message+email→Supabase, email fallback fix, safe-by-default error
      copy, ISO dates, swap-to-Rest, supersede stale 05-03 docs, remove
      debug alert dump, fix LLM-instruction strings leaking to UI,
      version footer).

## Phase 4 — programming quality pass (G1–G4 + off-season structure) **[SAM GATE]**
The most important remaining work. Sequence:
- 4.1 Design session with Sam (Journal-style): what weeks 2–3 must look
      like (density/progression across a block), session-ordering rules
      (no box squat + back squat bookends), swap-candidate rules
      (category/intent-respecting pools), off-season week structure,
      exercise cue/notes voice + authored source, repeat-week disposition
      (likely demote/hide — overlaps "apply to next week" prompts),
      anchor-ratio review, full-toggle methodology (pulled forward from
      old backlog).
- 4.1a **Rep-max continuum table — Sam-authored. DESIGN MATERIAL, NOT A BUILD.**
      Nothing in the app today translates a logged load across a rep-scheme
      change. Verified read-only 2026-07-28: no e1RM, Epley, Brzycki or
      percent-of-max anywhere in `src/`. `applyDelta` multiplies weight by
      `weightMultiplier` and changes reps by `repsMinChange`/`repsMaxChange`
      **independently** — the two never inform each other. So an athlete who
      logs 100 kg × 3 and whose next block prescribes × 5 carries 100 kg
      straight across, at a rep count it was never true for.
      Sam's intended mechanism: a **Sam-authored table of % of max per rep
      count**. Translation is then logged load → implied max → the new rep
      count's % → **round DOWN** conservatively.
      Two things make it worth doing properly rather than quickly:
        - The app already owns exactly one load translation —
          `resolveSiblingPerformedWeight` converts a performed weight between
          pool siblings via `loadRatio`. Same shape, different axis
          (exercise↔exercise, not reps↔reps). Whatever the continuum table
          becomes should sit beside it, not invent a second idiom.
        - It is **provenance-ready by construction**: a Sam-authored table is
          `equality_bound` from day one — the strongest kind in the provenance
          lock — instead of arriving as another unauthored multiplier needing a
          ruling session later. See `docs/PROVENANCE_INVENTORY_2026-07-28.md`.
      **The load-ratio sheet's baked-in rep assumption is a known stopgap.**
      Every ratio in `EXERCISE_LOAD_MAP` bakes in a rep-range discount, which
      means it silently assumes ONE rep scheme — the ratio is a working weight,
      not a percentage, so it can only be right for the reps it was tuned
      against. When the continuum table lands, starting estimates become
      rep-aware (anchor → implied max → % for the prescribed reps), and at that
      point most per-exercise ratios become candidates to **collapse** into
      simpler relative-strength ratios plus the one table. That is a reduction
      in representations, not an addition: 77 tuned constants become N
      relative-strength ratios and one authored continuum.
      **Sam's 2026-07-28 rulings are therefore scoped as FIRST-SESSION VALUES,
      not permanent law** — they make today's estimates authored and honest;
      they are not a commitment to the per-exercise-ratio shape surviving 4.1a.
- 4.2 Decisions written into the Bible/rules kernel as invariants,
      tests-first (same discipline as §18 work).
- 4.3 Generation fixes to meet them; multi-week + all-season cold-start
      verification on device.

## Phase 5 — stack-primitive retirement (approved design)
- Per STACK_PRIMITIVE_RETIREMENT_DIAGNOSIS with Sam's Bin-then-Add = Swap
  semantics (invariant #13 rewritten first). Closes the §18 ledger.

## Phase 5B — ELITE COACH PASS (moved PRE-launch, Sam 2026-07-23)
Sam's bar: the coach chat is elite and does everything right before ship.
- 5B.1 **[SAM GATE]** Define "elite": Sam writes/dictates the coach
  acceptance list — the utterances a real athlete will send and exactly
  what the coach must do for each (edits, questions, refusals, tone).
  This list becomes the coach contract, tested like §18.
- 5B.2 Stage-5 free-text program editing rebuilt on the transaction owner
  (diagnosis already done: retire the parallel validator/writer, route
  approved {proposedSnapshot, diff} through the owner). No longer
  dev-gated off — this ships.
- 5B.3 Intent-classification quality pass against 5B.1's utterance set;
  plain-language refusal copy everywhere (incl. game-day wording via the
  coach door); fix third-person LLM-instruction leakage (from copy audit).
- 5B.4 Model/prompt tuning against the contract (provider/model choice is
  Sam's, per standing rule); coach behaviour suite green + cold-start
  coach flows in the device pass.
- 5B.5 Sam device acceptance per L10 against his own 5B.1 list.

## Phase 5C — JOURNAL, fully built PRE-launch (Sam 2026-07-23)
Per JOURNAL_DESIGN_2026-07-23.md, with Sam's structural clarification:
- 5C.1 **Journal TAB** ships in the launch build — the permanent home.
  Progressive data states are DESIGNED, not accidental: day one shows
  what exists (notes, logged sessions); trend surfaces (ACWR
  load-vs-normal, progressions, observation lines) appear automatically
  once enough weeks of data accrue, with honest "builds as you train"
  copy until then — never fake-empty, never broken-looking.
- 5C.2 **Monday card = a Monday pop-up** (local notification → card);
  its results persist into the Journal tab (the pop-up is a doorway,
  the tab is the record).
- 5C.3 Data capture from day one: per-set rep logger + post-game feel
  rating (the linchpin) — these feed everything above.
- 5C.4 Notes: freeform + optional tags + resurfacing, monthly review
  surfaces in-tab when data supports them.
- 5C.5 All record-only/projection per the design doc (never a mutation
  door, all on-device, no privacy change). Sam device acceptance per L10.

## Phase 5D — stored-state integrity (Sam-approved 2026-07-30)

Both units run BEFORE Phase 6's full verification pass. Each was triggered by a
shipped defect that every gate was green through, and both are about the same
thing: state that is already wrong, written or left behind by something nobody
owns.

- 5D.1 **STORED-STATE WRITERS AUDIT.** Enumerate every code path that can write
      or replace stored athlete data — compatibility mirrors, migrations,
      hydration repairs, sync, any store `setState` that replaces rather than
      merges. Each writer must PROVE two things: it only ever narrows toward the
      accepted truth, and it can never delete an answer the athlete gave. A
      writer with no owner, or one that cannot prove both, is retired rather
      than guarded.
      *Founding case:* the profile compatibility mirror replacing
      `onboardingData` whole with a stale accepted snapshot — on a real device
      that took 28 answers to 2, `seasonPhase` among them, and left generation
      refusing an answer the athlete had given months earlier. Pre-existing on
      main, reproducible with one ordinary profile edit, invisible to every
      suite because every fixture left the mirror inert. Law and first fix:
      `rules/profileMirrorNarrowing.ts`.

- 5D.2 **FAILURE-STATE SWEEP.** Fault-inject every transaction — kill it
      mid-flight — and assert the surviving state is whole and honest: rebuilds,
      phase shifts, fixture changes, onboarding completion, athlete
      move/swap/add/bin. "Honest" means the athlete is told what happened and
      no surface reports a success the state does not carry.
      *Founding case:* the season-phase skew — a phase shift whose profile write
      landed and whose rebuild failed, leaving the two disagreeing with nothing
      to disclose it. The disclosure-plus-repair card exists because that state
      was reachable and silent.

- 5D.3 **ON-DEVICE ACTION LOG** (Sam-approved 2026-07-30). Every mutating
      athlete action recorded as a typed event — timestamp, screen, door,
      arguments, resulting transaction id — in a rolling buffer (~200),
      included in Export stored state, zero network. Diagnosis reads the log
      instead of interviewing the athlete. It is also the post-launch support
      tool.
      *Founding case:* the G-1 add-optional investigation took FOUR seed
      reconstructions and ended on the question "what did you actually tap?".
      The answer — "Want to change something → Add optional session → Strength →
      Full Body" — explained every byte instantly, and a twenty-line log would
      have supplied it in one read.
      *Mostly wiring, not building:* `utils/athleteActionDiagnostics.ts` already
      emits this vocabulary. The gaps are that it is disabled on production
      builds, in-memory only, unbounded, and absent from the export.

- 5D.4 **DELOAD_LAW ROW CLASSIFICATION READS THE AUTHORED STRUCTURE**
      (Sam-approved 2026-07-30). `isConditioningExerciseRow` decides whether a
      row is conditioning from its NAME, by regex. The workout it belongs to
      already carries the authored answer — `conditioningBlock.options[]
      .exerciseIds` names those exact rows — and the classifier does not read
      it. The unit is for the classification to consult that structure, with the
      name heuristic left only where no structure exists. **The regex is not to
      be widened**; adding the missing words is what makes the next unmatched
      name a silent defect rather than a loud one.
      *Founding case:* the registry's own single-row conditioning templates —
      "Flush Out - 2min On / 1min Off" and "3 x 8min zone 2 Rower", where
      "Rower" does not match `\brow\b`. Both are classified as strength
      accessories, and the accessory trim (`floor(1 × 0.5) = 0`) deletes the
      only row, so the G-1 ask's route (c) would have published an empty day
      under a "Done."
      *Contained, not patched, in the G-1 landing unit:* a route is a smaller
      session, never no session — `placeSessionForRoute` returns null for an
      empty result and the landing funnel refuses in words already shipped.
      `g1LandingAskFlowTests` 26 asserts the classifier still empties that
      template, so it **goes red the moment this unit lands**. That is the
      signal to delete the containment, not a regression.
      *Class:* another **name-decides-identity** instance (Sam, 2026-07-30) —
      see PART 3. The same shape as intensity feeding identity and position
      feeding identity: a derived or incidental property standing in for
      authored truth.

## Phase 6 — full verification under the new law
- 6.1 Extend SUPPORTED_ATHLETE_ACTIONS.md to the whole-app surface (X3):
      first-run, generation, season transitions, session lifecycle.
- 6.2 Full sweep: seeded contract flows + cold-start pass (L3) + screen
      audits + dead-affordance check (L5), on device.
- 6.3 Sam dogfoods a full week for real (train off it). Renee's phone too.
- 6.4 Fix cycle until 6.2/6.3 are clean. Every report per L2.

## Phase 7 — ship logistics (mostly done, remainder)
- 7.1 Screenshots per SCREENSHOT_STORYBOARD (capture on the 6.x build).
- 7.2 Build upload (EAS/archive), export compliance (standard HTTPS →
      exempt), TestFlight internal → Sam + Renee + 2-3 clubmates for a
      real training week.
- 7.3 TestFlight feedback fix cycle → submit for review → LAUNCH (AU/NZ).

## Phase 8 — post-launch releases (already designed, unchanged)
- 8.1 v1.0.x: launch triage, feedback email-forward trigger, Apple-account
      email swap, illness constraint-type cleanup, coach dead-code.
- 8.2 Journal — MOVED PRE-LAUNCH (Phase 5C, Sam 2026-07-23).
- 8.3 Coach pass remainder: model reassessment, coach-readable journal
      (opt-in + privacy update) — stage-5 free-text itself MOVED
      PRE-LAUNCH (Phase 5B),
      preview-before-approve UX.
- 8.4 Features: 5.4 busy / 5.5 missed-session (the REAL versions of the
      hidden flows), female-friendly G-1 variant, StoreKit review prompts,
      EU expansion (trader status), monetisation decision (Schedule 2).

---

# PART 3 — STANDING ANSWERS (so nothing regresses to folklore)

- **A derived property never decides identity** (Sam's standing class). Whether
  a thing IS something is answered by the authored truth, never by a number that
  says how hard it is, a slot that says where it sits, or a string that says
  what it is called. Known instances, all the same defect in different clothes:
  - INTENSITY feeds identity — a deload's halved sets demoted a hinge lift to an
    accessory and the session left the week's count. Ruled and closed:
    `docs/READINESS_FAMILY_BOUNDARY_2026-07-27.md` ("intensity and prescribed
    volume must never feed identity"), one defect at five sites.
  - POSITION feeds identity — row order standing in for role. Queued from the
    power-row redesign.
  - NAME feeds identity (2026-07-30) — `isConditioningExerciseRow` deciding
    conditioning from a regex over the exercise name while the workout's own
    `conditioningBlock` names the rows outright. Queued as 5D.4.
  The fix is always the same shape: read the authored structure. **Widening the
  heuristic is not the fix** — it buys back the current case and hides the next
  one, because a heuristic that nearly always works is the hardest kind to catch
  being wrong.
- Gunshow: intentional brand voice, stays (2026-07-23).
- Feedback form: message + required email only; no star rating.
- Bed-ridden: illness_recovery week — minimums lifted, sessions optional +
  reduced, never "cleared to rest".
- Bin-then-Add = Swap semantics.
- Busy/away: hidden until designed properly (5.4/5.5).
- v1 auth: none; single-user on-device. Journal: PRE-LAUNCH (Phase 5C).
  Coach free-text: PRE-LAUNCH (Phase 5B). Provider: OpenAI/gpt-5.5 until
  Sam's post-launch review.
- Sick sheet mapping (Sam, 2026-07-23): TWO sub-options only — "Coming
  down with something" → minor (record + soften-today offer) and
  "Properly sick" → severe (illness_recovery week, "nothing will be
  required this week — gentle optional work if you're up to it").
  Bed-ridden is not a third button: the severe week self-scales; doing
  nothing is the athlete's choice, never an app-imposed mode.
- Logging model: assume-prescribed, edit-by-exception (3×10 done = 3×10,
  athlete edits weight only; NO per-set entry). Rep-range question
  (3×8–12 → 3×10) goes to the Phase 4 design session.
