/**
 * THE LAW REGISTRY — provenance for RULES, the way `signedCopy` gave provenance
 * to WORDS.
 *
 * ## WHY THIS FILE EXISTS, IN SAM'S WORDS
 *
 * 2026-08-10, verbatim: *"how do we make sure all the laws we have written in the
 * past are held up now? it feels like i constantly give a fix and a law or
 * whatever and then believe you will remember and you never fucking do"*
 *
 * He is right, and the seat measured it rather than answering it with a promise:
 * **375 docs, 131 named ruling/law/boundary docs, 15 audits, 692
 * RULING/LAW/"Sam ruled"/"signed" markers across 193 source files, 16 laws in
 * AGENTS.md, 328 `test:*` scripts of which 175 are in the chain — and no mapping
 * from any law to the thing that holds it.**
 *
 * The July 2026 content-conservation invariant lived in a test header and an
 * audit doc and was **rediscovered twice**, most recently on 2026-08-10 when a
 * move onto a team night was caught **losing a row between the source day and
 * the drawn day** while reporting *"Done. Session moved."* That is a missing
 * mechanism, not a memory failure.
 *
 * **CORRECTED 2026-08-10:** this used to say the move was *"caught DELETING a
 * row"*. Not established. Five probes over every producer that can remove power
 * work counted ZERO on that run, and *"8 rows in, 7 out"* was counting the
 * PROJECTION, not storage — a count whose unit was never stated, which is
 * `LAW-count-names-instrument`'s founding case. The loss is real and
 * destination-dependent; the deletion is OPEN-UNKNOWN.
 *
 * ## WHAT A ROW MEANS, AND WHY THERE ARE ONLY TWO STATES
 *
 * `guarded` names the cell/tape/gate that FAILS when the law breaks.
 * `UNENFORCED` names, in one line, what a guard would take.
 *
 * There is deliberately **no third state**. "Important, everyone knows it,
 * nobody checks it" is the state that produced this week, and a union of two
 * makes it unrepresentable. A row whose guard is not in `test:bible` is
 * **`chainStatus: 'outside_chain'`** and counts as unguarded for reporting: a
 * check nobody runs is not a check.
 *
 * ## THIS FILE IS GATED, AND `UNENFORCED` IS RED.
 *
 * **CORRECTED 2026-08-10.** This header used to say the file was data only and
 * that the gate over it was deliberately not built. That was true for one pass
 * and is now false. `test:law-registry`
 * (`src/__tests__/lawRegistryGateTests.ts`) is in the `test:bible` chain and
 * **FAILS while any row below reads `UNENFORCED`**.
 *
 * **Sam, 2026-08-10, verbatim:** *"WHY CAN'T YOU JUST MAKE SURE EVERY FUCKING
 * RULE IS FOLLOWED FROM RIGHT NOW"*. The answer is that we can, and treating the
 * UNENFORCED rows as a backlog with a shrinking count was the seat scheduling a
 * principle he had already ruled. **The red does not mean the app broke: it
 * means the app has never been checked against these rules, and from now that
 * counts as failing.** A rule with nothing watching it is a rule not followed.
 *
 * There is no high-water mark, no grandfathering and no dated debt. The only
 * way a row clears is a real guard, in the chain, named here.
 *
 * ## SCOPE — BATCH 1 + THE BATCH 2 AUDIT AND SWEEP
 *
 * Batch 1 was (a) the AGENTS.md laws, (b) L-C1..L-C4, (c) the laws central to
 * the 2026-08-10 passes.
 *
 * **BATCH 2 (2026-08-10, item 000(A)) AUDITED EVERY BATCH-1 ROW AGAINST ITS
 * CITED SOURCE AND FOUND THE REGISTRY WRONG ON DAY ONE.** One row carried a
 * DIFFERENT LAW than its id named (`LAW-liveness`), and **four rows cited
 * sources that do not say what the row claims** — including one on a GUARDED
 * row. Then it swept for laws with no row at all and found **thirty**: the
 * whole of Process Law L1–L10, the north star itself, and every seat law in
 * the handoffs.
 *
 * **131 named ruling docs are still NOT harvested** and none of them should be
 * read as covered. The sweep started from the seat's list and did not stop at
 * it, but it is not exhaustive and does not claim to be.
 */

/** What holds a law, or the honest absence of it. Exactly two shapes. */
export type LawGuard =
  | {
      readonly state: 'guarded';
      /** The npm script, named cell, or NAMED PERSON that fails when the law breaks. */
      readonly by: string;
      /** Whether that guard is reached by `npm run test:bible`. */
      readonly chainStatus: 'in_chain' | 'outside_chain' | 'human';
      /** How this was verified, so the row is a receipt and not a belief. */
      readonly receipt: string;
      /**
       * THE NAMED HUMAN INSTRUMENT — Sam's ruling, 2026-08-10.
       *
       * Some laws have their SUBJECT outside the repo. `LAW-sam-chat-simplicity`
       * governs the shape of a chat reply, and chat never reaches a file, so no
       * script can ever see it. The row could have said `UNENFORCED` forever, or
       * "held by discipline" — **and "held by discipline" is the loophole Sam
       * banned this morning**, because it is `UNENFORCED` wearing a nicer word.
       *
       * So the guard is a PERSON, named: **Sam is the instrument, and him having
       * to pull the seat up on it IS the red.** Still two states, never a third
       * — the row is `guarded`, by a guard that happens not to be a script.
       *
       * **THIS IS NOT A GENERAL ESCAPE HATCH AND THE GATE ENFORCES THAT.** It is
       * allowed ONLY where the subject of the law is the conversation itself
       * (`HUMAN_GUARDABLE_LAW_IDS` below, one id today). Any other law reaching
       * for it is a re-wording failure, and `test:law-registry` reds on it.
       */
      readonly humanGuard?: 'Sam';
    }
  | {
      readonly state: 'UNENFORCED';
      /** One line: what building a guard would actually take. */
      readonly wouldTake: string;
      /** How the absence was verified. */
      readonly receipt: string;
    };

/**
 * THE ONLY LAWS A NAMED PERSON MAY GUARD.
 *
 * Sam, 2026-08-10: *"use this shape ONLY where the subject of the law is the
 * conversation itself — it is not a general escape hatch, and any other law
 * reaching for it is a re-wording failure."*
 *
 * One id, and adding a second is a decision somebody has to defend in this list
 * rather than a habit that spreads through the file. `test:law-registry` reds
 * when a row outside this set carries `humanGuard`.
 */
export const HUMAN_GUARDABLE_LAW_IDS: readonly string[] = ['LAW-sam-chat-simplicity'];

export interface LawRow {
  /** Stable id. Never renumbered — rows are retired, not reused. */
  readonly id: string;
  /** The law in ONE plain-English sentence. Sam must be able to read the list. */
  readonly law: string;
  /** Where it was ruled: file, doc, Bible line, or the date Sam said it. */
  readonly ruledAt: string;
  readonly guard: LawGuard;
}

/**
 * BATCH 1. Verified 2026-08-10 by reading `package.json`'s script list, the
 * `test:bible` chain string, and grepping the suites named in each receipt.
 */
export const LAW_REGISTRY: readonly LawRow[] = [
  // ── (a) THE AGENTS.md LAWS ────────────────────────────────────────────────
  {
    id: 'LAW-0-registry',
    // AUDITED 2026-08-10 (batch 2). The text used to end "...or an explicit
    // UNENFORCED row with a reason." Sam withdrew that clause the same day —
    // no new law may enter as UNENFORCED — and AGENTS.md no longer says it.
    law: 'No law is recorded anywhere without a registry row and a guard.',
    ruledAt: 'AGENTS.md "LAW ZERO" + "UNENFORCED IS RED"; Sam 2026-08-10',
    guard: {
      state: 'guarded',
      by: 'test:law-registry',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 on Sam\'s stop-the-line ruling. src/__tests__/lawRegistryGateTests.ts reds when a row is malformed, when a named guard is not a real script, when a chainStatus disagrees with package.json, when a guard sits outside test:bible, and — the stop cell — when ANY row reads UNENFORCED. Its liveness cell feeds each checker a fabricated bad row, including the real test:athlete-action-walker ghost the registry caught on its first read.',
    },
  },
  {
    id: 'LAW-every-authored-requirement-is-askable',
    law: 'Every piece of equipment an authored exercise requires must be a question the athlete can answer. Sam\'s signed requirement sheet is a source of the derived checklist, not a separate list beside it.',
    ruledAt: 'docs/RULINGS_REGISTRY.md R-083 (load is not availability) and the derived-checklist ruling recorded in src/rules/equipmentVocabulary.ts (Sam, 2026-07-31: what the athlete is asked IS what the library can require); mission "EQUIPMENT SCOPES AND AWAY/HOLIDAY PROGRAMMING", Sam 2026-08-17: "add Sandbag as an explicit askable equipment item ... no name whitelist or Full-Gym exception"',
    guard: {
      state: 'guarded',
      by: 'test:equipment-scopes',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-17 by seat `equip`. THE DEFECT: `EXERCISE_EQUIPMENT_REQUIREMENT["Bear Carry"] = [\'sandbag\']` is Sam\'s own answer, transcribed from his sheet where he wrote "sand bag / dead ball" — and `sandbag` was in no tag union, no label map, no icon record and no checklist. `exerciseIsAvailableWith` therefore asked every athlete for a thing none of them could own, and **Bear Carry was refused on every kit, forever, in silence.** ⚠ THE CAUSE IS AN AUTHORITY, NOT A MISSING ENTRY, AND THE FIX IS AIMED AT THE AUTHORITY. `deriveEquipmentVocabulary` derived the checklist from FIVE authored sources — `POOL_REGISTRY`, `STRENGTH_POOLS` via the LOAD classifier, `POWER_EXERCISE_POOL`, `DEFAULT_EXERCISES`, conditioning — and Sam\'s sheet was not one of them, so the both-directions gate whose entire job is "nothing authored may require an unaskable tag" could not see it. Worse, for `Bear Carry` the two authorities actively disagreed: the sheet says `sandbag`, `equipmentClassFor` says `dumbbell` because that is what you load it with, so the checklist asked about DUMBBELLS while availability asked for a SANDBAG. That is R-083\'s load-versus-availability conflation surviving inside the vocabulary module. THE SHEET IS NOW READ FIRST for any exercise it knows, and the load class answers only for names it does not. `STRENGTH_NAME_TO_TAG` — a one-row local override map for `Back Extension` — is DELETED and nothing moved: the sheet already carried that row, and the map was a per-name patch for exactly this general defect. An OR-group demands EVERY member, because either satisfies the row so the athlete must be asked about both. MEASURED, base vs after: the derived checklist gains EXACTLY `sandbag` and loses nothing (17 -> 18); `unmappableRequirements` stays 0 and `unclassifiedStrengthNames` stays 0; demand counts shift in the correcting direction as the sheet replaces the load class (bench 10 -> 22 because `Bulgarian Split Squats` really does need one, rack 1 -> 6 because `Back Squat` really does, bodyweight 59 -> 42). BEHAVIOUR, measured through the app\'s own oracle: commercial gym TRUE, the same kit minus the sandbag FALSE, dumbbells-only FALSE, and the control `Farmer Carry` still TRUE without a sandbag. NO NAME WHITELIST AND NO FULL-GYM EXCEPTION EXIST. Commercial = all askable, so the sandbag is pre-ticked there and on NO other preset; the signed club and home lists are untouched. THREE CELLS, EACH MUTATION-PROVEN with the tree restored byte-identical after each: a `Bear Carry` name exemption in the oracle reds [13]; making the sheet stop being a vocabulary source reds [14]; the home preset quietly gaining a sandbag reds [15]. `test:equipment-vocabulary` 84 -> 87 cells, all green. WORLD CENSUS UNCHANGED against base `6b617847`: `test:ladder-wide` 140 worlds / 40 refused / 0 deficient of 368 / kit-blocked 84, `test:scenarios` 62/3, `print:week` the same 2 refusals, `test:compile` 468 with the same 6 pre-existing failures. NOT COVERED: nothing has been seen on glass, so the new checklist row is source-verified rather than device-verified; and `Bear Carry` reaching a real generated week is not asserted — it is a carry-pool accessory and this row holds its LEGALITY, not its selection frequency.',
    },
  },
  {
    id: 'LAW-away-removes-the-club-not-the-athlete',
    law: 'A trip removes club training and fixtures inside its span and nothing else. The athlete\'s own sessions keep running, and the removal happens in the PLAN — no pass may delete a composed day to achieve it.',
    ruledAt: 'docs/RULINGS_REGISTRY.md R-018 ("if yes, follow same program") and R-020 ("yes clear team training and games while away"); mission "EQUIPMENT SCOPES AND AWAY/HOLIDAY PROGRAMMING", Sam 2026-08-17',
    guard: {
      state: 'guarded',
      by: 'test:equipment-scopes',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-17 by seat `equip`, and the opposite had SHIPPED. Measured on `6b617847` by `npm run trace:equipment-scopes` boundary B8 — a travel fact, a FULL 19-tag commercial gym, NO equipment change: `validateWorkoutAgainstActiveConstraints` collapsed Tuesday and Thursday to REST as "team-training only" while those days carried SIX of the athlete\'s own lifts (`Barbell Row`, `Lat Pulldown`, `Band Pull-Apart`, `Bench Press`, `DB Shoulder Press`, `Banded External Rotation`), and stripped `Back Squat`, `RDLs` and `Bulgarian Split Squats` off two more days. §18 then refused the week for training no squat, hinge, push or pull. **A trip with a full gym produced NO WEEK AT ALL** — and `test:away-flow` did not report it as a failure, it THREW, so the suite produced no cells. THE FIX IS THE ONE THAT PASS\'S OWN COMMENT NAMED AND DID NOT BUILD: *"the allocator must not mark a day `isTeamDay` inside a live travel span"*. `weeklySchedulerInputs.clubInputsAfterTravel` takes the club night and the fixture out of the facts the PLAN is built from, using the shared `awaySpans.ts` owner so the plan side and the read side cannot disagree about which days are inside a trip. `travel` and `equipment` were then REMOVED from `hardPostGenerationConstraints` — burn the boats — because the composer owns the kit per day and the scheduler owns the trip; every other schedule kind still runs there. AFTER: all nine trace boundaries publish, ZERO refusals, and `test:away-flow` runs at 47/2 instead of throwing. FIVE CELLS: [8] a trip with a full gym publishes; [9] non-vacuity, the control week really carries club anchors; [10] the club\'s work inside the span is gone; [10b] the SCHEDULER is told about no club night; [11] the athlete\'s own sessions survive; [12] a fixture OUTSIDE the span is untouched. ⚠ **[10b] EXISTS BECAUSE [10] SURVIVED THE MUTANT.** Disabling the plan-side removal left [10] green — the READ side hides club work from the projection whatever the plan did — so [10] holds a real athlete-visible property and NOTHING about this change. MUTATION-PROVEN, tree restored byte-identical after each: disabling the plan-side removal reds [10b]; restoring `travel` to the in-generation filter reds [8] and [11]. WORLD CENSUS UNCHANGED against base: `test:ladder-wide` 140 worlds, 40 refused, 0 deficient of 368; `test:scenarios` 62/3; `print:week` the same 2 refusals; `test:compile` 468 with the same 6 pre-existing failures. ⚠ NOT COVERED, AND LOCATED RATHER THAN GUESSED: `test:away-flow` [13f] and [13h] fail (they could not run at all before). [13h] reads `awayClub: 6` of 8 because there is a SECOND scheduler-input builder, `coachingInputsToSchedulerInputs` (`generateProgram.ts`), which takes `CoachingInputs` and hardcodes `unavailableDays: []` with no constraint awareness. Threading constraints into `buildInitialGeneratedCoachingPlan` needs its own unit and its callers updated; half-doing a generator change late is the documented way this repo loses a night. [13f] asserts `dropped > 0` and the away week now GAINS rows (11 -> 17) while dropping none, so its assertion is stale against the ruling rather than a regression — it is left red and named here rather than edited to match.',
    },
  },
  {
    id: 'LAW-temporary-equipment-never-permanent',
    law: 'A temporary equipment answer changes the row that ships and never the block selection that is recorded. The permanent profile decides the base; a dated removal decides only the days it covers.',
    ruledAt: 'docs/RULINGS_REGISTRY.md R-072 (three scopes, no fourth) and R-018/R-019 (away is a dated subtraction from the athlete\'s own list); the standing rulings of the mission "EQUIPMENT SCOPES AND AWAY/HOLIDAY PROGRAMMING", Sam 2026-08-17: "Temporary substitutions never become pins, exclusions or permanent rotation history"',
    guard: {
      state: 'guarded',
      by: 'test:equipment-scopes',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-17 by seat `equip`. ⚠ THE DEFECT WAS MEASURED BEFORE ANY CODE MOVED, by `npm run trace:equipment-scopes` driving the real `generateProgramLocally`: a five-day trip RECORDED `squat: Back Squat -> Goblet Squat`, `horizontal_pull: Barbell Row -> Single-Arm DB Row`, `horizontal_push: Bench Press -> Single-Arm DB Floor Press`, `single_leg_knee: Bulgarian Split Squats -> Cossack Squat`, `accessory_or_core: Ab Wheel -> Band Pallof Press`, and dropped `vertical_pull` outright — NINE slots recorded instead of ten. The cause was one line: `composeWeek` applied `inputs.kit` inside `legalUnder`, which fed BOTH `baseLegal` (recorded) and `legal` (shipped), and the file said so in its own words — "kit legality is a property of the week". True of a PERMANENT kit, false of a dated one, and a flat string list cannot tell them apart. THE FIX IS THE SPLIT: `kit` is the permanent answer and decides the record; `temporaryKitByDayOfWeek` is the dated answer and decides the row. The base returns on the return date by EXPIRY ALONE — no expiry code exists, because the day simply stops carrying an entry. It also gave `ComposedRow.substitutedFor` its first live path: the field had existed since the rotation merge with ZERO readers outside its own file and fired ZERO times in nine measured boundaries, because with kit in `baseLegal` there was never a base to substitute away from. SEVEN CELLS, and the CONTROLS are half of them — cell [6] changes the athlete PERMANENTLY and REQUIRES the record to move, cell [1] proves the removal reached the composer at all, so neither can pass on an app that has stopped reading equipment. MUTATION-PROVEN THREE WAYS: pointing `baseLegal` back at the dated kit (the original defect) reds 4 cells including non-vacuity; recording the SHIPPED row instead of the base reds [2]; restoring the skip that dropped a slot today\'s kit cannot fill reds [2] and [3]. Tree restored byte-identical after each. WORLD CENSUS UNCHANGED against base `6b617847`: `test:ladder-wide` 140 worlds, 40 refused, 0 deficient of 368 laddered days, kit-blocked census 84; `test:scenarios` 62/3 with the same three failures; `print:week` the same two refusals; `test:compile` 468 errors and the same 6 pre-existing gate failures, product scope unchanged at 35. ⚠ A "freshest first" substitute was tried and BACKED OUT the same day: it shipped an Intermediate athlete `Bodyweight Squat` on a dumbbells kit because `Goblet Squat` had lost its freshness, and cell [4] caught it. NOT COVERED: the session scope writes no fact by design (R-072) and is not held here; the in-generation travel filter still deletes the athlete\'s own lifts and refuses the week (docs/STATUS_EQUIP.md finding 4) and is the next slice.',
    },
  },
  {
    id: 'LAW-coach-no-phrase-handlers',
    law: 'Coach bugs are fixed at the typed intent/context/executor layer, never as phrase-by-phrase special cases.',
    ruledAt: 'AGENTS.md "Coach Intelligence Rules"; CLAUDE.md',
    guard: {
      state: 'guarded',
      by: 'test:coach-phrase-ratchet',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 by the `audit` seat, to the shape this row itself specified. `coachPhraseHandlerRatchetTests` counts text-literal branches per file across `src/utils/*coach*.ts` and reds when any file GROWS one, or when a NEW coach file arrives carrying them. Baseline at commit time: 626 branches across 31 files, heaviest `coachCommandRouter.ts` 112, `coachProgramEdit.ts` 110, `coachClarifierResume.ts` 94. ⚠ WHAT THE NUMBER IS, STATED BEFORE IT IS USED, because LAW-count-names-instrument was sighted FIVE times the day this was written and once inside a guard built that same morning: it counts `/…/.test(` sites and `.includes(\'…\')` sites of 4+ characters, comments stripped. It is NOT a count of "phrase handlers" — a date regex and an id-list `.includes` both land in it. THAT OVER-COUNTING IS CORRECT FOR A RATCHET AND WOULD BE FATAL FOR A THRESHOLD: the claim is never "there are N phrase handlers", it is "this file grew a new text-literal branch", which is true whatever the branch turns out to be, and a reviewer then decides. PER-FILE, NEVER A TOTAL — a total lets a deletion in one file pay for growth in another, which is how a ratchet silently stops ratcheting. THREE MUTANTS KILLED: adding a phrase special-case to a coach file reds it and NAMES the file and delta (`coachReplyComposer.ts: 5 -> 6`) — that mutant is the founding case, an agent fixing a coach bug the forbidden way; a whole NEW coach file carrying phrase branches reds TWO cells, because entering at "not in the baseline" would otherwise be invisible; and deleting the block-comment stripper reds its cell. ⚠ THE THIRD MUTANT IS THE FINDING: the first version of the comment cell tested ONLY `//`, so deleting the BLOCK stripper changed nothing and the stripper was real, correct and completely unheld — and that mutation had itself silently failed to apply on the first attempt (`sed` no-ops on this mount), so the "surviving mutant" was a DEAD INSTRUMENT and the gap was found only by verifying the probe was in. A cell was added for the second comment form. WHAT IT DOES NOT HOLD: it watches `src/utils/*coach*.ts` by FILENAME, so coach logic living in a file without `coach` in its name is outside it, and it cannot tell a legitimate new regex from a phrase special-case — it forces the increase to be declared with `--update` and defended in the commit, which is the reviewable-baseline shape the typecheck gate already proves here.',
    },
  },
  {
    id: 'LAW-coach-escalation',
    law: 'After the same class of coach bug twice, stop coding and produce an architecture reassessment before adding another resolver or guard.',
    ruledAt: 'AGENTS.md "Coach Architecture Escalation Rule"; CLAUDE.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Not mechanisable as a cell — it governs what a person does next. Its honest guard is a seat checklist item, and it should be marked PROCESS rather than left looking cell-able.',
      receipt: 'Process law; no script can observe "the same class twice".',
    },
  },
  {
    id: 'LAW-elegant-two-options',
    // WIDENED 2026-08-10 ON SAM'S STANDING RULING. It read "WHEN ASKED for the
    // most elegant solution..." — his words: *"EVERYTHING SHOULD BE DONE IN THE
    // MOST ELEGANT WAY."* The trigger clause is deleted and the SUBJECT widens
    // from code to the work. Founding case: the seat applied this law to code
    // all week and never to the process, which is how a dead simulator rig sat
    // unnoticed since 18 July and a 176-suite chain kept being paid in full for
    // one-line changes.
    law: 'Compare an incremental fix against an ownership redesign before coding — ALWAYS, not only when asked, and for PROCESS and instruments as well as code.',
    ruledAt: 'AGENTS.md "Elegant Solution Requirement"; CLAUDE.md; widened by Sam 2026-08-10',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 (Agent: laws) TO THE PRESCRIPTION IN THIS ROW ITSELF - a boundary-report field (options compared) checked by test:repo-law-guards, the same shape as the LOOP CHECK cell. THE SENTENCE OF THE LAW IS UNTOUCHED: this row warned that flipping on the strength of an edit to its own wording would be the reads-as-covered failure, so the gate was built and the wording left alone. FROM-HERE-FORWARD (cutoff 2026-08-13): only 3 of 59 existing reports carry the field, so a retroactive gate would red on 56 whose authors were never asked - the shape already refuted for LAW-L9-checkpoint-discipline. TWO reports written earlier on the cutoff day are named as debt rather than pushing the cutoff to tomorrow, which would have let the rest of the day through. BOTH DIRECTIONS: a silent in-scope report reds, AND a debt entry that gains the field must be struck - without that second cell the ratchet could never red, a failure this seat paid for earlier the same day. MUTATION-CHECKED both arms. WHAT IT CANNOT DO: it reads that two options were WEIGHED, never whether the weighing was good. That is a review question, not a cell.',
    },
  },
  {
    id: 'LAW-dedup-ungates',
    law: 'De-duplicating values can silently remove the gate that watched them, so a tidy-up must prove the gate still fires.',
    ruledAt: 'AGENTS.md "De-duplication can silently un-gate the values it tidies"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Mutation-testing as a standing gate rather than a per-pass habit; nothing currently proves a gate still fires after a refactor.',
      receipt: 'No test:* script named for de-duplication or gate-liveness.',
    },
  },
  {
    id: 'LAW-count-names-instrument',
    law: 'A number names the instrument\'s unit, not the domain noun — emit occurrences AND distinct.',
    // AUDITED 2026-08-10: ruledAt claimed "sighting 14". The cited section says
    // "Seat-endorsed 2026-08-07 at the THIRD sighting"; 14 is this terminal's
    // running tally, not something the ruling site records. Cite the site.
    ruledAt: 'AGENTS.md "A count names the instrument\'s unit, not the domain noun" (seat-endorsed 2026-08-07)',
    guard: {
      state: 'guarded',
      by: 'test:law-registry',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 (Agent: audit), on a live violation in this repo\'s own STANDING order. PARTIAL BY CONSTRUCTION, AND THE PRECEDENT IS LAW-no-completeness-claims: the general form — a lint over every report-emitting suite — is what `wouldTake` described and is NOT what shipped; this is the highest-value INSTANCE. THE FOUNDING CASE: docs/SEAT_INBOX.md item 13, re-read at every stop, says "the truth is `grep -c "state: \'UNENFORCED\'" src/rules/lawRegistry.ts`" and adds that the terminal miscounted twice, "both times one low". THE GREP IS ONE HIGH. It emits OCCURRENCES of a string; the domain noun is DISTINCT LAWS; they differ by exactly the `readonly state: \'UNENFORCED\'` line in the LawGuard union, which is a TYPE DECLARATION and not a law. So both "miscounts" were the data-derived instrument being RIGHT, and the standing instruction has been pointing every terminal at the wrong number. WHAT THE CELL HOLDS, and it is an IDENTITY not an inequality: occurrences - distinct === type-declaration lines (measured 28 - 27 === 1). An inequality would pass for any wrong reason and would red falsely the day the union is renamed; the identity says WHY they differ and reds the moment a NEW non-row occurrence appears, which is the only event that can make a future grep wrong in a NEW way. It also refuses to run vacuously: it asserts at least one UNENFORCED row exists, and asserts the union member still exists rather than silently asserting a difference with no cause. MUTATION-CHECKED BOTH WAYS: dropping the `+ typeDeclarations` accounting term REDS it, and adding a stray non-row `state: \'UNENFORCED\'` mention to lawRegistry.ts REDS it (that mutant restored, file verified byte-identical to HEAD). WHAT IT DOES NOT DO: it does not inspect how any OTHER suite reports its counts, so a report elsewhere printing one number without naming its instrument is still uncaught.',
    },
  },
  {
    // RENAMED FROM `LAW-anchor-smallest-declaration` BY THE 2026-08-10 AUDIT,
    // and the old id is RETIRED, never to be reused. The row carried a law the
    // cited section does not state: "smallest declaration" appears NOWHERE in
    // AGENTS.md (grep: one hit, and it is about clarifying questions). What the
    // section actually rules is below — prove the anchor was FOUND. The
    // smallest-declaration phrasing came from a boundary report, not a ruling,
    // and is now folded in as the practice the law implies rather than quoted
    // as if Sam had ruled it.
    id: 'LAW-anchor-must-be-found',
    law: 'Any assertion locating something in source by POSITION must prove every anchor was FOUND before claiming anything about their relationship.',
    ruledAt: 'AGENTS.md "The same law again — its subject is ANCHORING, not counting" (sighting 6, 2026-08-09)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'GUARDED 2026-08-13, ON THE HALF THAT IS DECIDABLE, AND THE LIMIT IS THE FIRST THING THIS RECEIPT SAYS. The row asked for TWO things: every positional anchor asserted FOUND before use, and character-window regexes ({0,N}) forbidden. ONLY THE FIRST IS HELD. WHY IT IS A DEFECT AND NOT A STYLE POINT: `indexOf` returns -1 on a miss and `slice(-1, ...)` silently yields a region measured from the END of the file, so the cell reads a real string, asserts something TRUE about the WRONG region, and goes green — `a-gate-passing-on-coordinates-it-never-builds`. The founding case did exactly that. MEASURED BEFORE BUILT: 335 `indexOf`-assigned anchors across the suites, of which 124 are fed into `slice`/`substring` with no found-check anywhere in their file, across 32 files; plus 194 `{0,N}` character-window regexes, which is why that half is NOT attempted here — banning them would red 194 places at once and it deserves its own unit. THE 124 ARE DATED, PER-FILE, SHRINK-ONLY DEBT. Per file rather than one total ON PURPOSE: a single ceiling would let a new unguarded anchor appear in one file while another removed one, which is the decay a ratchet exists to stop. A file absent from the list may never gain its first. Largest holder is `dayFirstTimelineTests` at 47. MUTATION-CHECKED THREE WAYS ON THE REAL TREE: a new unguarded anchor in a file already at its limit reds; a CLEAN file gaining its first reds; a repaired file left overstated reds the ratchet. Plus a liveness arm proving the checker accepts a guarded anchor, ignores an `indexOf` never used as a bound, ignores a commented-out one, and recognises all four guard spellings this repo writes. WHAT IT STILL CANNOT SEE, STATED RATHER THAN DISCOVERED LATER: the `{0,N}` half; a `match()` result indexed with no null check; an anchor that finds the WRONG occurrence rather than none; anchors outside the suites; and a receiver that is a string literal rather than a variable — the first mutation attempt SURVIVED for exactly that reason before being rewritten, and real code always anchors off a variable, but the blind spot is real.',
    },
  },
  {
    id: 'LAW-claim-needs-a-cell',
    // SCOPE LINE ADDED 2026-08-10 — the other half of the apparent clash with
    // LAW-sam-chat-simplicity. The INTENT is "every claim carries its status".
    // A token satisfies that for a script; plain words satisfy it for Sam. The
    // TOKEN requirement is repo-scoped; the plain-language requirement is his.
    law: 'A sentence saying the app does or does not do X is pinned by a named cell, or its status is stated — as the token OPEN-UNKNOWN / NOT ON GLASS in the REPO, and in PLAIN WORDS wherever Sam reads it.',
    ruledAt: 'AGENTS.md "A behaviour claim the owner can read is held by a CELL"; seat-ruled 2026-08-10',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 on the surface Sam actually reads. The general form is not mechanisable; the highest-value INSTANCE is: every `\u26a0` block in docs/NOW.md — the single status surface — must carry a named cell/tape/commit or say OPEN-UNKNOWN / NOT ON GLASS. **FIRST RUN: 10 blocks, FIVE bare, TWO of them written the same day by the author of this cell.** All five now carry one. A completeness-word gate was measured FIRST and REJECTED — the whole of docs/ yields two hits and both use \'exhaustive\' descriptively, and a cell that cannot fail is worse than no cell. PARTIAL by construction: it holds that a receipt is PRESENT, not that it is the right one, and it reads NOW.md only — a claim in a boundary report or in chat is not covered.',
    },
  },
  {
    id: 'LAW-not-covered-real-data-blocks',
    law: 'A NOT-COVERED item naming a shape of REAL data is a blocking gap, not a disclosure.',
    ruledAt: 'AGENTS.md "A NOT-COVERED item naming a shape of REAL data is a blocking gap"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate that reads boundary docs\' NOT-COVERED sections and fails when one names real-data shapes without an opened unit.',
      receipt: '21 suites PRINT their own NOT COVERED lines; none READS anyone else\'s. Founding case this week: the sixty-second boundary\'s own NOT-COVERED predicted the day shapes its fixtures could not hold, and nothing acted on it.',
    },
  },
  {
    id: 'LAW-instrumentation-alive',
    law: 'Instrumentation must be alive where the defects are — a dead or unrun instrument is not coverage.',
    ruledAt: 'AGENTS.md "Instrumentation must be alive where the defects are"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'GUARDED 2026-08-10, AND THE ROW SAT UNENFORCED UNTIL THE RIG ACTUALLY RAN — which is the law describing its own history. FOUNDING CASE: eight Maestro flows crashed on launch for 23 DAYS while every source-reading cell stayed green, because there is nothing wrong with a flow that does not run. A BLOCKED INSTRUMENT DOES NOT HIDE ZERO DEFECTS, IT HIDES AN UNKNOWN NUMBER: run one found THREE, each invisible until the one before it was fixed; run two found SIX more in the same staircase; NINE from an instrument carried as "dead, cost unknown" since 18 July. WHAT FINALLY ENFORCES IT: docs/GOLDEN_FLOW_RUN_RECEIPT.md, read by a cell that reds when a golden flow is missing from the table or when the newest recorded run is more than 7 DAYS old — seven because the founding case was 23, so the alarm fires three times over before that number is reachable again. The receipt also carries NOT RUN rows on purpose: five of ten flows have run, and a receipt that recorded only successes would make the rig look alive while half of it was dark, which is precisely this law\'s failure mode. WHAT IT CANNOT DO, STATED NOT IMPLIED: it cannot prove the receipt is HONEST — a row edited without a run defeats it, exactly as a LOOP CHECK line can be typed without the thinking. That is the same trust every process law here runs on, and the alternative is what left 23 days invisible. Two narrower cells hold beside it and neither would have caught the nine: test:repo-law-guards (no flow names a missing file, none is unreachable) and test:maestro-element-contract (every id a flow taps is a name product source can emit), which prints its own two limits.',
    },
  },
  {
    id: 'LAW-no-hand-built-fixtures',
    law: 'Hand-built state fixtures are deprecated for athlete-facing suites; reach the world by acting or by a device-exact seed.',
    ruledAt: 'AGENTS.md "Hand-built state fixtures are deprecated for athlete-facing suites"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'FOUNDING CASE, ADDED 2026-08-10 AND IT IS THE ROT SAM NAMED: every practice week in this repo was built from a profile THE APP WOULD HAVE REFUSED FROM A REAL PERSON — `DEV_E2E_STANDARD_PROFILE` carried no `twoKmTimeTrial`, a required always-visible onboarding answer, so every seeded world was an impossible athlete. No instrument could see it because none had ever got far enough in: the completeness gate lives on a screen no seeded run had ever reached. CENSUS, COUNTED NOT ESTIMATED: 21 of 332 test scripts consumed that profile (transitive import closure, so helper-reached suites are included; the list is in docs/TWO_KM_LEAD_AND_SEED_CENSUS_2026-08-10.md). AND THE OBVIOUS FOLLOW-UP WAS RUN AND REFUTED: generating with and without the field produces an IDENTICAL week — 4 conditioning-carrying workouts and 4 strength-and-conditioning days in both arms — so their green was never WRONG downstream; what it never covered was the completeness gate itself. The first version of that probe read ZERO in both arms and would have "refuted" from an instrument incapable of any other answer; the verdict stands on the corrected one only. ORIGINALLY GUARDED ON SAM\'S SECOND ASKING, and it should not have taken two: this row sat UNENFORCED and that is EXACTLY HOW THE ELEVEN SEEDS ROTTED — correct when written, drifted with nobody watching. His words: "I don\'t want to get 2 weeks down the line and realise that a fucking weekly template optimised for that and that alone - its happened before and if it happens again i\'ll fucking kill myself". TWO OF THE THREE CONDITIONS ARE HELD: no test world is built from a literal (measured — devE2ESeedRegistry.ts goes through generateProgramLocally and holds ZERO workout literals), and the world set RATCHETS — coverage may rise, never fall, so a world cannot be dropped to make a suite green. THE THIRD IS NOT HELD AND THIS ROW SAYS SO: the DRIFT check (does a world still match what the generator produces for that profile TODAY?) is the condition that would have caught the eleven the day they went stale. It needs a generator run per profile and ships with the first run-through, per the order\'s own sequencing — one flow is not green yet.',
    },
  },
  {
    id: 'LAW-L11-matrix-before-phone',
    law: 'The matrix comes before the phone — a defect class gets a written matrix before device time is spent on it.',
    ruledAt: 'AGENTS.md "L11 — The matrix before the phone"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A run-through over a MATRIX of worlds, gated per athlete-visible slice. NOT AFFORDABILITY-BLOCKED ANY MORE — see the receipt.',
      receipt: 'MEASURED 2026-08-10, and the measurement changes this row from unimplementable to merely unbuilt: a Maestro run costs 20-26s wall clock on an already-built simulator (3 runs), and the launch+marker half now completes in 11s. A matrix of ten worlds is under four minutes. THIS LAW WAS UNIMPLEMENTABLE FOR AS LONG AS EVERYONE BELIEVED THE INSTRUMENT COST FORTY MINUTES — the belief was never measured, and the rig had been carried as dead since 18 July without being re-run after its cause was fixed. Still UNENFORCED because no run-through completes yet: everything past the deep-link seed fails, and a matrix over an instrument that has never finished one pass is the 116-green-cells mistake. docs/MAESTRO_RIG_MEASURED_2026-08-10.md',
    },
  },
  {
    id: 'LAW-L12-verification-reviewed',
    law: 'Verification strategy is reviewed like code — how a claim is checked is itself subject to review.',
    ruledAt: 'AGENTS.md "L12 — Verification strategy is reviewed like code"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'PROCESS law, but its ANCHORING corollary is mechanisable — see LAW-anchor-smallest-declaration.',
      receipt: 'Process law.',
    },
  },
  {
    id: 'LAW-L13-walker-accumulated',
    law: 'The walker must reach ACCUMULATED state, not a freshly-built one.',
    ruledAt: 'AGENTS.md "L13 — The walker reaches ACCUMULATED state"',
    guard: {
      state: 'guarded',
      by: 'test:action-walker',
      chainStatus: 'in_chain',
      receipt: 'athleteActionWalkerTests.ts carries an explicit liveness check ("Did THIS walk ever fail to roll a block?", :323) and depth reporting; suites print their own DEPTH (L13) line. test:action-walker and test:action-walker:deep are both in the chain (test:action-walker:extended is NOT). NOTE: this row first named `test:athlete-action-walker`, which does not exist — caught by resolving the name rather than trusting it, which is the whole point of the row.',
    },
  },
  {
    id: 'LAW-L14-domain-purity',
    law: 'Domain rules are pure — a rules module takes explicit inputs and reaches no store.',
    ruledAt: 'AGENTS.md "L14 — Domain purity"',
    guard: {
      state: 'guarded',
      by: 'test:bible (bibleConformance/expectations/importBoundaryTests.ts)',
      chainStatus: 'in_chain',
      receipt: 'importBoundaryTests asserts import boundaries; coachTabSlice1Tests additionally asserts the coach screen\'s import list by name. PARTIAL: it gates imports, not store reads reached indirectly.',
    },
  },
  {
    id: 'LAW-L15-one-write-format',
    law: 'One write format — a superseded shape survives only as a lift, never as a second live writer.',
    ruledAt: 'AGENTS.md "L15 — One write format"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'GUARDED 2026-08-13, AND THE ROW GOT EXACTLY THE INSTRUMENT IT ASKED FOR: "a gate enumerating writers per stored shape and failing on a second live one". FOUR CELLS. (1) Every persisted store has ONE live writer — its own module. Ownership is DERIVED (the module that calls `create`), never listed, so renaming a store file cannot orphan the check. (2) The debt ratchets: a module may leave the list, nothing may join. (3) Every shape declared RETIRED FOR WRITING (L15) must NAME the suite that holds it — a retirement is a claim, and a claim with no cell is prose, so the NEXT retirement arrives with a guard instead of a comment. (4) A retired persist key never returns to the boot registry, because boot DELETES those envelopes and registering one would eat that store\'s state every launch. WHAT THE FIRST RUN MEASURED, AND IT IS WHY THE CELL IS WORTH HAVING: over 538 product files, TWELVE of the thirteen persisted stores have exactly one writer. `useProgramStore` has EIGHT `setState` occurrences — SIX of them across FIVE modules that do not own it (`acceptedStateTransaction`, `coachMutationTransaction`, `quiescentBoot`, `sessionOutcomeTransaction`, `planChangeProducer`). Both numbers are reported on purpose: five modules writing once and one module writing five times are different defects and must not read alike. THE FIVE ARE CARRIED AS DATED DEBT, NOT FIXED HERE — four are declared L12 transaction owners, and deciding whether a transaction owner is a second live writer or the store\'s real writer boundary is an architecture ruling, not a test edit. WHY AN ENUMERATION AND NOT A SPOT-CHECK: `motivationGoalsTests` [6] already held L15 for ONE shape by listing seven files BY HAND, so a new file writing the retired shape was invisible to it, and so was every other stored shape. SCOPE IS STORED SHAPES ONLY — a non-persisted store holds none, so `useRebuildNoticeStore` (six writes, all its own) is correctly out of reach; the persisted list is read from the boot registry, which `onboardingReliabilityTests` D1 pins as complete. MUTATION-CHECKED FIVE WAYS ON THE REAL TREE, each killing its own cell: a new module writing `useProgramStore`; a real debt entry deleted while its writer stands; a stale debt entry added; the `motivation` retirement stripped of its guard name; `auth-store` re-registered in the boot registry. Plus a liveness arm proving a READ is not counted as a write and that occurrences and modules do not collapse into one number. WHAT IT STILL CANNOT SEE: a second writer that goes through the store\'s own exported action rather than `setState`, a writer reaching storage under the store entirely, and whether the six declared writes AGREE about the shape they write — that last one is the architecture unit this debt is waiting on.',
    },
  },
  {
    id: 'LAW-test-worlds-are-generated-or-real',
    law: 'A test world is either GENERATED by the app\'s own generator from a profile, or a REAL DEVICE EXPORT. Never hand-authored.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, from Sam: "I don\'t want to use a practice week if it\'s not the most elegant way to ensure that all future builds actually help the app instead of just optimising for this one tiny week"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED, and the order\'s own premise is PARTLY REFUTED by the measurement: the order said the existing seeds "are hand-authored" and they are NOT — devE2ESeedRegistry.ts builds every world through generateProgramLocally(profile, …) and contains ZERO workouts/microcycles/exercises literals. So the cell PINS a property the repo already has rather than fixing a defect. WHAT HAS DRIFTED IS A DIFFERENT THING AND IS NOT FIXED HERE: Mixed days projecting a single strength part, no seed row with a power role, equipment-restriction-case failing to install — that is drift between a generated world and its PROJECTION, and calling it hand-authoring would have sent the fix at the wrong layer. Liveness both directions, including a comment describing the forbidden shape.',
    },
  },
  {
    id: 'LAW-seed-channel-is-first-class',
    law: 'A test-harness input arrives on its own named, validated, fail-closed channel — never smuggled as a second meaning on an existing field.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, Sam overruling a cheaper plan: "i dont care if it has to do 1 rebuild for 40 minutes - i care about the best solution long term"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED — the first draft of this row entered UNENFORCED and that was a DEFECT caught in the same pass: it broke LAW ZERO (no law enters unguarded from 2026-08-10) and pushed the unguarded count 36 -> 37, the one direction Sam ruled it may never move. WHAT THE CELL HOLDS: the key exists under its own name, the value is validated against a declared shape, a malformed value FAILS CLOSED rather than degrading to "no seed", and the metro-url key carries no seed meaning. RE-AIMED 2026-08-10 EVENING, PROPERTY UNCHANGED: fail-closed used to be spelled `fatalError` and is now a typed refusal plus a stop, because Sam ruled a dev diagnostic may not kill the app (see LAW-diagnostic-refuses-never-crashes). The cell now asserts the malformed branch RECORDS a refusal AND RETURNS — and a new liveness probe covers the failure mode the re-aim created, a refusal that carries on and seeds nothing quietly. WHAT IT DOES NOT HOLD, STATED NOT IMPLIED: it cannot prove the refusal FIRES — that needs a simulator launch with a bad value. IT NEEDS A NATIVE REBUILD BEFORE IT RUNS AT ALL — asked of Sam plainly, with the cost stated.',
    },
  },
  {
    id: 'LAW-removal-ships-with-its-replacement',
    law: 'A removal ships the same day its replacement does, never before.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, generalising Sam\'s binding line on the UI merge: "without destroying what i have now"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE IS A CALL THAT WENT RIGHT, which is why it became a rule rather than a fix: ruling 6 removes the season-phase box from the day screen, its new home on the coach page does not exist yet, and the box was LEFT IN PLACE — deleting it would have left Sam with no way to change season phase at all. WHAT THE CELL HOLDS: the UI merge plan\'s own REMOVAL LEDGER is parsed and every row must name where the behaviour went; an empty destination cell, a "TBD" or a dash reds, and so does the ledger section going missing. Liveness both directions including the placeholder case, because "TBD" is the shape this defect actually takes. WHAT IT DOES NOT HOLD, STATED NOT IMPLIED: it reads the PLAN, not the diff — it cannot see a removal that never got a ledger row at all, and it cannot prove the destination named is where the behaviour truly went. It catches the removal that has nowhere to land, which is the half that has actually bitten.',
    },
  },
  {
    id: 'LAW-week-list-one-card-shape',
    law: 'The week list uses her one card shape and visual hierarchy for all seven days; it starts fully collapsed while today is independently highlighted, Rest and Game Day are shorter status cards with vertically centred titles, and its chevron opens the whole flat session with no nested accordions.',
    ruledAt: 'docs/UI_PROTOTYPE_DIVERGENCE_2026-08-11.md "RESOLVED AND BUILT — 2026-08-11" + "SAM EYE PASS 2" + "SAM EYE PASS 3" + "SAM EYE PASS 4" + "SAM EYE PASS 5"',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + .maestro/golden/standard-program-week.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: slice 5 was reported as taking her weekly structure, but the selected/today coordinate still switched into the old hero card and carried Start Session plus the change door. EYE PASSES 2–5 CAUGHT THE GUARD WAS TOO SHALLOW: 18pt dates, badges with a hidden 24pt line box, an invented GAME badge, a zero-modifier visual world, nested component accordions, today starting open, and Rest/Game inheriting an empty training tier all still differed materially from the prototype. WHAT THE CELLS HOLD NOW: all seven rows call one WeekDayCardHeader selected by SCREEN SHAPE; date and compact badge proportions are pinned; Game Day adds no second badge; entering Week clears template-local expansion while Card highlight independently reads day.isToday; Rest and Game Day share one compact decision that shortens outer and inner spacing, centres their title block and omits the empty category reservation; the one DayTimeline call chooses interactive Today versus flat Week; the flat branch renders every section and numbered row with no inner interaction. WHAT THE TAPE HOLDS: it acts a real modifier and proves Program still carries no Coach Notes, enters Week, proves no timeline is visible before any day tap, compares collapsed card heads, opens Wednesday once into flat rows, then reaches and captures the compact Rest/Game states together. FIRST-RUN FINDINGS WERE NOT FIXED QUIETLY: off-screen assertion order, TODAY wrapping, XCUITest losing its UI, inherited badge line-height, an acted Monday left open, a guessed accessory id where the projection carried strength, the selected/open collision, and the absent compact status decision were each reported and the full tape rerun after correction. WHAT IT DOES NOT HOLD: Week → open → Today → Week again on a device, today itself being Rest or Game on a device, a multi-section flat session on the final coordinate, the two-modifier plural on a device, prior/next-week Completed treatment, the deferred team-training badge, Sam\'s physical iPhone.',
    },
  },
  {
    id: 'LAW-coach-status-is-a-real-destination',
    law: 'Coach keeps Renee\'s My Status doorway at zero; My Status is the only home for Coach Notes and season phase; phase review lets the athlete choose any different phase before the existing availability, team-training and game-day questions; Program carries none of that status UI.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "it should open the status.... not just the coaches tab - and it should always be there"; then: "when you tap my status from hers you can see that the season phase is also there too"; then, 2026-08-11: "allow them to select which season they go to" while keeping the team-training and usual-game-day questions, and "we no longer need coaches notes showing up on day page or weekly page". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3 + .maestro/golden/coach-my-status.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), EXPANDED WITH EACH EYE PASS. FOUNDING CASE: the status overlay existed, but Program only changed tabs, Coach deleted its doorway at zero, and the phase machine remained trapped in Program behind a status screen reported as built. THE NEXT FAILURE: Review silently preselected the fixed next phase instead of reviewing anything. WHAT THE CHAIN CELLS HOLD: Coach alone keeps the zero-state doorway; Program mounts neither status strip nor Coach Notes list; My Status mounts the extracted phase controller and atomic transaction; review renders all three phases, selects a target explicitly, refuses a no-change confirmation, then retains the availability → team days → In-season game-day branch. WHAT THE DEVICE FLOWS HOLD: zero-state Coach opens status; review shows all three choices; selecting Pre-season reaches availability and team-training questions; a real equipment modifier still renders no Coach Notes on either Program shape; populated My Status remains reachable from Coach and its collapsed modifier expands. WHAT IT DOES NOT HOLD: completing all three phase changes on a device, the still-unwired modifier actions, Sam\'s physical iPhone.',
    },
  },
  {
    id: 'LAW-coach-empty-state-is-one-greeting',
    law: 'The empty Coach conversation opens with Sam\'s G\'day greeting only: no automatic schedule-summary bubble and no Move a session starter chip. Session moves remain available through the typed coach proposal path.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "the coach only need the first text \"g\'day...\" not the second one or the option to move session". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice1 + test:coach-tab-slice3',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). TWO OPTIONS COMPARED: conditionally hide the existing opener and chip, or remove those two initial-content representations from the live screen while retaining the typed proposal owner. The second leaves one empty-state truth and no dead shortcut. WHAT THE CELLS HOLD: the signed greeting bubble is present; coachOpener, coach-tab-opener, coach-tab-chip-move and moveChipLabel are absent from the screen; the slice-3 proposal and accepted transaction doors remain independently guarded. FIRST RUN: the old slice-1 cells red because they still required exactly the second bubble Sam had just removed. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, wording of answers after the athlete sends a message, or the frozen legacy CoachScreen.',
    },
  },
  {
    id: 'LAW-profile-setup-is-not-status',
    law: 'Profile shows the athlete\'s onboarding-level equipment choice, keeps equipment editing one level inside its single setup-change door, and renders no Coach adjustments or active-modifier read model because My Status is their sole home.',
    ruledAt: 'docs/UI_PROTOTYPE_DIVERGENCE_2026-08-11.md "SAM EYE PASS 9 — PROFILE IS SETUP, NOT STATUS"',
    guard: {
      state: 'guarded',
      by: 'test:profile-reset-ui + test:equipment-vocabulary + .maestro/golden/profile-setup-equipment.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: Profile independently subscribed to four status stores, rebuilt the active Coach Notes list already owned by My Status, and rendered it as a second COACH ADJUSTMENTS section. The Equipment row separately expanded the onboarding preset into every seeded item and exposed Edit equipment beside the one setup-change door. WHAT THE CELLS HOLD: Profile imports no status stores or active-note selector, renders none of the section/copy/test ids, uses the dedicated onboarding-choice formatter, contains no direct equipment-edit control in its Program card, and mounts the existing equipment editor only through the setup sheet. The formatter pins Commercial gym, Club gym, Home gym and explicit Bodyweight only without falling back to an item list. FIRST DEVICE FINDING: the existing item editor was taller than the phone, auto-height and non-scrollable, so it opened with its title and first rows above the screen. The Profile cell now requires that full editor to use a flexible Sheet and ScrollView. WHAT THE TAPE HOLDS: the commercial-gym seed reaches Profile, shows only Commercial gym, has no Coach adjustments, opens the setup sheet, reaches its equipment door, sees the editor title at the top, then scrolls the real list through to Save. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone; profiles whose old data never stored a location; completing an equipment save on-device.',
    },
  },
  {
    id: 'LAW-phase-shift-days-wrap-four-three',
    law: 'Every seven-day selector in the season-phase shift sheet wraps as a centred row of four followed by a centred row of three, never six plus an orphaned seventh button.',
    ruledAt: 'docs/PHASE_SHIFT_DAY_GRID_BOUNDARY_2026-08-12.md "What Sam ordered" — Sam 2026-08-12 direct request: "maybe just make it 4 and 3" after the seven buttons rendered 6 + 1',
    guard: {
      state: 'guarded',
      by: 'test:profile-reset-ui',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. The guard proves HomeScreenV2 is the live Program screen, finds the complete phase-shift region, proves availability, team-training and usual-game-day all use the same wrapped grid and shared day-chip style, then pins the four-column basis and centred wrap. FIRST RUN: 170 existing checks passed and the new geometry cell red on the prior minimum-width-only style that produced 6 + 1. NOT COVERED: physical iPhone appearance and unusually narrow accessibility display modes.',
    },
  },
  {
    id: 'LAW-week-navigation-belongs-to-week',
    law: 'The accepted new Program template uses a large Day / Week shape toggle; Day renders no week-date navigation, Week renders one legible previous/range/next row directly below it with 40pt controls and 13pt range type, the row is equally spaced from the toggle above and week cards below, and changing or returning weeks leaves every session collapsed.',
    ruledAt: 'docs/UI_PROTOTYPE_DIVERGENCE_2026-08-11.md "SAM EYE PASS 6 — WEEK NAVIGATION BELONGS TO WEEK"; UPDATED by Sam, 2026-08-11 in this Codex task: the week range "needs to be equally spaced above and below".',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + .maestro/golden/standard-program-week.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), UPDATED WITH SAM\'S 2026-08-11 DAY / WEEK AND WEEK-NAV EYE PASSES. FOUNDING CASE: the accepted day template had no week browsing, but the implementation mounted a large previous/range/next bar before the shape toggle so both shapes inherited it. LATEST FINDINGS: after the Day / Week control was corrected, the row beneath it still used 28pt controls, 13pt chevrons and 11pt range type on the physical phone; after those sizes were corrected, the row still sat visibly closer to the toggle than the cards. WHAT THE CELLS HOLD: visible and accessibility copy both say Day / Week; the shared shell is 280pt wide, each half has a 44pt target, and the label is 15pt; the navigator is ordered after the toggle and before Week content, mounts only when !dayFirst, preserves previous/current/next stable doors, contains neither IconButton nor Badge, pins 40pt previous/current/next geometry, 17pt chevrons and 13/18pt range type, and uses the same spacing token above and below. The template has one local expandedWeekIdx; Day reads todayIdx directly; every date and shape transition clears local expansion. FIRST RUN: the old guard red because it explicitly required the rejected 28pt/11pt proportions, so it was rewritten to hold the accepted size rather than softened; the spacing addition first red on the unequal 8pt/16pt values. WHAT THE TAPE HOLDS: all navigator ids are absent on Day and present after Week is selected; previous and next move adjacent, return to this week, and leave detail collapsed. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, the old/classic template, adjacent-week Completed styling, or dynamic-type scaling.',
    },
  },
  {
    id: 'LAW-day-timeline-icon-is-marker',
    law: 'On the accepted new Today card, each component icon is its one timeline marker: no separate dot or connector rail; the main headline does not repeat the icon; there is no lime left rail; the owned mobility warm-up appears before every projected component (including conditioning when present); and the headline, counts, badge, session action and quiet change link follow Renee\'s hierarchy. The card fills the Day screen through 20pt internal padding, 52pt component rows, a 48pt primary action and balanced 14/20/12pt content spacing rather than empty minimum height; the status card beneath uses 24pt padding and 48pt controls, with a blue battery for Tired, Renee\'s purple map pin for Away, amber thermometer for Sick and red cross for Injured.',
    ruledAt: 'docs/UI_PROTOTYPE_DIVERGENCE_2026-08-11.md "SAM EYE PASS 7 — THE SESSION ICON IS THE MARKER" + "SAM EYE PASS 8 — THE DAY REVIEW FINISHES THE MATCH" + "SAM EYE PASS 11 — THE DAY CARD FILLS THE SCREEN"; UPDATED by Sam, 2026-08-11 in this Codex task: "i want the injured sick and away icons to match renees on day screen", then "can you make the tired icon on day screen blue".',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + .maestro/golden/day-card-dropdowns.yaml + .maestro/golden/standard-program-week.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), EXPANDED WITH SAM\'S NEXT EYE PASSES. FOUNDING CASE: the interactive day timeline drew a hollow node and connector rail, then a typed component icon beside them, so one component had two markers and its oversized heading/count started a full column too far right. THE NEXT GAPS: the card still kept a lime left rail Renee did not have, shrank its main title to 16pt, shouted the change link in lime, showed only projected strength while the session screen\'s owned mobility flow was absent, then remained visibly under-filled on Sam\'s phone because 44pt rows, 16pt padding, 8pt gaps and a 36pt action compressed the same three sections into roughly 275 logical points. TWO OPTIONS COMPARED FOR THE PROPORTION FINDING: add a blank minHeight, or enlarge the actual content rhythm. The second landed so sessions with different section counts grow honestly. WHAT THE CELLS HOLD: no duplicate marker or left rail survives; one timelineIconMarker wraps RowIcon and receives saved completion colour; the day headline region contains no duplicate RowIcon; eyebrow and 19pt title remain pinned; the selected card uses 20pt padding, a 14pt header gap, 52pt component rows, 20/12pt expanded spacing, a 48pt primary action and quiet note; the status card below uses 24pt padding, 48pt circles and 12/16pt labels, and its Tired/Away/Sick/Injured source regions pin the blue battery plus Renee\'s exact map-pin, thermometer and cross paths with their blue/purple/amber/red tints. Home asks selectMobilityPrehabFlow once per resolved day and renders that flow first plus every projected part. The flat Week branch consumes the same entries without nested furniture. WHAT THE TAPES HOLD: the standard route renders and captures Today before traversing Week; the dropdown route observes and opens mobility plus projected strength. FIRST-RUN FINDINGS: the marker cell first failed on timelineRail; the expanded cells first failed on the 8pt eyebrow, 16pt title, lime rail/link and absent mobility owner; the proportion update then red because the guard explicitly required the rejected 36pt button, and the guard was re-aimed to the accepted geometry rather than removed; the status-icon extension first red on all three prior glyphs, then the Tired-colour extension red on its prior amber stroke and tint. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone after this spacing pass, spoken VoiceOver order, exceptionally long translated headings, Today sessions with zero/one/five component rows on-device, the old/classic template.',
    },
  },
  {
    id: 'LAW-renee-typography-app-wide',
    law: 'Renee\'s compact prototype typography remains the shared type system for the main app, while onboarding alone retains its original larger type scale; both stay behind the shared Text owner so the exception cannot leak into other screens.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task first ruled "on all pages everywhere", then superseded that scope after seeing onboarding: "I want the old onboarding back the rest of the app is good". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:prototype-typography',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), UPDATED WITH SAM\'S ONBOARDING-ONLY SUPERSESSION. WHAT THE CELLS HOLD: the main shared variant owner still pins Renee\'s measured compact hierarchy and contains no Bebas family; onboarding\'s separate scale pins every original size and line height; one scoped owner wraps the complete onboarding navigator; shared Text reads that scope; AppTextInput keeps the system family; and a source census fails if any athlete-facing screen or ordinary component bypasses shared Text. FIRST-RUN FINDING FOR THE SUPERSESSION: the onboarding cell red because no onboarding scale or scope existed. WHAT IT DOES NOT HOLD: local per-screen size overrides that already predated the shared scale, icon typography inside third-party native controls, OS status-bar glyphs, Sam\'s physical iPhone, or final visual spacing on every onboarding step.',
    },
  },
  {
    id: 'LAW-profile-action-cards-share-type',
    law: 'Developer Tools, Support and Legal are one Profile action-card family and use the same shared title and description typography; no member falls back to the smaller primitive body/caption treatment.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "why are the developer tools and the legal boxes much smaller fonts then the other boxes?" This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:profile-reset-ui + .maestro/golden/day-readiness-profile-type.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: Support used the accepted 15/20 title and 13/19 description styles, while the visually equivalent Developer Tools and Legal cards independently selected the smaller shared body/caption variants. WHAT THE CELLS HOLD: all three affected source regions are first proved found; Developer Tools, Privacy and Terms each consume secondaryActionTitle and secondaryActionDescription and contain no primitive body/caption variant. WHAT THE TAPE HOLDS: the live Profile scroll photographs Developer Tools beside Support and then Legal below it, with the corrected matching scale visible. FIRST-RUN FINDING: all nine style/parity cells red on the old rows. WHAT IT DOES NOT HOLD: Danger Zone, legal-page body copy, Sam\'s physical iPhone, dynamic type accessibility scaling.',
    },
  },
  {
    id: 'LAW-day-readiness-doors-are-direct',
    law: 'The Day status row offers Tired and Sick as separate direct doors into one readiness owner: Tired offers exactly Bit tired today, Pretty flat and Totally cooked; Sick opens illness severity; pain is available only through Injured; the dead Time action, sleep/soreness detours and intermediate chooser do not exist.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "change the time button to tired"; "make the flat button its own thing"; Sick must remove flat and something hurts; then "Feeling flat ... should just be bit tired today, pretty flat and totally cooked". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + test:readiness-ownership + test:program-control-durable + .maestro/golden/day-readiness-profile-type.yaml',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), EXPANDED WITH SAM\'S NEXT MESSAGE. TWO OPTIONS COMPARED: duplicate flat and sick sheets, or pass a typed entry into the existing readiness owner. The second removes a decision and adds no mutation representation. For Pretty flat, reusing poor-sleep or soreness would store a reason the athlete did not give; the existing moderate fatigue level (`not_right`) gets its own typed `flat_today` route instead. WHAT THE CELLS HOLD: readinessEntry is one typed visibility/entry owner; Tired routes flat and Sick routes sick; the sheet receives that entry; top/readiness-bucket-flat/readiness-bucket-sick, Something hurts and onInjury are absent; the flat region contains exactly three SheetOptions with the three signed labels and typed actions; sleep/soreness rows and bucket are absent; R16 pins flat_today to today-only moderate fatigue; the dedicated Injured control still opens the guided injury flow; the dead Time label and handler are absent from both screen and hook. WHAT THE TAPE HOLDS: Tired opens straight to the three semantic option ids with sleep/sore/injury ids absent; Sick opens straight to the three illness ids with flat/injury absent; both states are photographed. FIRST-RUN FINDINGS: four chained cells red on the old Time handler, label and chooser; the extension then red on four old flat options and on flat_today falling through to low_energy until its moderate mapping existed; the wider durable guard then found the unreachable short-time handler still authored and exported by the hook, so that dead doorway was removed while the typed domain action stayed covered. The tape\'s first text assertion failed because SheetOption deliberately exposes its stable semantic id as the accessibility label; the screenshot showed all three rows, and the rerun used those ids rather than weakening presence. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, modal height on every device, or a new programming-content ruling about what moderate fatigue changes downstream.',
    },
  },
  {
    id: 'LAW-tired-severity-icon-ladder',
    law: 'The Day-screen Tired sheet uses a blue moon for Bit tired today, an amber half-full battery for Pretty flat, and a red skull-and-crossbones for Totally cooked.',
    ruledAt: 'docs/TIRED_ICON_LADDER_BOUNDARY_2026-08-12.md "What Sam ordered" — Sam 2026-08-12 direct request, with supplied skull-and-crossbones reference image',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline + test:approved-icons',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. The Day-screen cell first proves it found the live three-option Tired region, then pins each label to its ruled colour and semantic icon. It also pins the half battery and outlined skull-and-crossbones to the shared icon owner, while the approved-icon gate fails if the live Program screen bypasses that owner. FIRST RUN: the cell red on the prior amber moon before implementation. NOT COVERED: physical iPhone appearance at native font/icon rendering scale.',
    },
  },
  {
    id: 'LAW-profile-danger-zone-is-one-reset',
    law: 'Profile Danger Zone contains one readable Full reset action; the standalone Clear coach chat action does not exist, while Full reset still clears the complete app state through the canonical reset owner.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "danger zone has small text as well - clear coach chat does not need to be there any more = delete that part". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:profile-reset-ui',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). WHAT THE CELLS HOLD: the live Profile imports, handler, press log, label and stable control for the standalone clear-chat action are absent; Full reset remains after the Danger Zone anchor, invokes resetProgramAndOnboarding, and uses the same shared 15/20 title plus 13/19 description scale as the other Profile action cards. The reset utility remains tested independently because Full reset still clears coach history as one part of the whole reset. FIRST RUN: nine cells red on the old row and undersized primitive text. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone or a future account-level conversation-management surface.',
    },
  },
  {
    id: 'LAW-missed-session-prompt-reuses-owned-doors',
    law: 'The missed-session prompt offers exactly Did it, Skipped it and Move it forward: Did it opens the existing session survey without fabricated answers, Skipped it records a skipped outcome without deleting content, and Move it forward enters the existing move-session pathway without choosing a destination itself.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "it should only have 3 \"did it\" ... \"skipped it\" ... and move it forward". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:missed-signup',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). TWO OPTIONS COMPARED: relabel the four existing direct mutations, or make the prompt a router into the existing survey/move owners and retain one accepted skip transaction. The latter removes two hidden decisions and two mutation representations. WHAT THE CELLS HOLD: exactly three labelled stable controls; old labels and response tokens absent; Did it navigates DayWorkout with its owned feedback mode; the missed-session model cannot manufacture good/full; Skipped it commits completion skipped and contains no bin or move action; Move selects PlanChangeSheet\'s move entry, whose effect calls the same startMove function as the visible menu row. FIRST RUN: the old fourth chip, fabricated feedback, bin action and automatic rest-day move all red. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, every refusal branch in the move sheet, or the redesigned session checklist ruled immediately afterward.',
    },
  },
  {
    id: 'LAW-session-execution-checklist-owns-completion',
    law: 'A live session uses one shared collapsible section shell and the same vertically centred square checkbox for every exercise or unit. Mobility / Warm-up and Strength use the same exercise-card owner for numbering, sets and reps, form cues, performed-load controls and video; accessories and prehab are rows inside Strength, and Team Training expands to a plain checklist row labelled Club session rather than a second card. Checked rows visibly recede; those ticks are the sole completion evidence and persist with one whole-session 1-10 effort score. Mobility is prescribed with no optional wording; separately authored Optional Work remains no-penalty.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "each component of the session should be its own pop down"; exercises are checked as they are done; completion is derived from the ticks; the bottom feedback is 1-5, where 1 is very easy and 5 is very hard. UPDATED by Sam 2026-08-11 in this Codex task: "Don\'t make the mobility warm-up optional - just have it there and they can mark as skipped or not skipped - just like they would do with strength work - so remove optional wording"; and "in the session view under team training it says club/field session it should just say Club session". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:session-execution-checklist',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), UPDATED WITH SAM\'S 2026-08-11 MOBILITY, SHARED-SECTION, SQUARE-CHECKBOX, FULL-ROW-PARITY AND CLUB-SESSION COPY RULINGS. TWO OPTIONS COMPARED: keep styling the lightweight Mobility row until it resembled Strength, or delete that parallel renderer and adapt each derived movement into StrengthExerciseCard. The second removes the owner that produced both the circle/square drift and the missing prescription controls. WHAT THE CELLS HOLD: the pure plan groups accessory/prehab items into Strength while retaining stable item and component evidence; Mobility is wrapped by the same SessionExecutionSection, each movement uses the same ExecutionChecklistItem and StrengthExerciseCard as programmed strength, and its authored duration/per-side dose plus curated pool note are passed into that shared card; prescription, form-cue disclosure, load controls and video are therefore owned once. The shared execution row aligns its square checkbox to the centre of the complete card and carries no top-margin guess. Derived Mobility deliberately does not receive stored-workout swap/remove mutation callbacks; this prevents copied dead controls. Team Training is a plain exercise-card row and reads Club session through signed copy; all sections retain full/partial/skipped derivation; unticked mobility remains prescribed; Optional Work remains outside it. FIRST RUN: the session gate stopped because it read the deleted parallel component, the Mobility gate required that component, and the week gate explicitly required the rejected small dimensions; each was reported, then replaced with ownership and geometry cells. The copy extension then red on the old literal before the signed Club session entry landed. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, VoiceOver traversal order, a product decision that promotes derived Mobility into stored workout rows with swap/remove mutation rights, or analytics/recommendations consuming the evidence.',
    },
  },
  {
    id: 'LAW-completed-day-has-one-status',
    law: 'On the day screen, a completed session is communicated once by a tick and the words Session complete; it does not also render a competing Done badge beside the session-type badge.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "maybe session complete is enough and we remove the done badge" and "make the icon next to session complete a tick not a pulse". This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:session-execution-checklist',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). WHAT THE CELLS HOLD: the day-card badge region is found before it is read; that region contains no Done badge; the completed line still says Session complete; a Material Community check icon precedes it; and the old pulse path cannot precede it. The week list retains its compact Done state because it has no Session complete line and therefore no duplication. FIRST RUN: the screenshot showed the Done pill visually outweighing CORE while the card repeated the same state below. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone or the week-list completed marker, which this ruling did not remove.',
    },
  },
  {
    id: 'LAW-temporary-equipment-is-session-scoped',
    law: 'Temporary equipment changes live only inside the opened session: the control lists equipment that session actually uses from authored exercise requirements and conditioning metadata, never turns a strength movement named Row into a row erg, unavailable items are replaced for that session using equipment the athlete still has, the Day screen has no Equipment shortcut, and permanent equipment editing remains in Profile.',
    ruledAt: 'NOT STATED IN THE REPO — Sam, 2026-08-11 in this Codex task: "Equipment button should only live in the session template"; unticking a rower replaces it with work using equipment still available, while permanent changes continue through Profile. UPDATED after Sam found Barbell Row and Seated Cable Row displayed as Row erg and asked for the actual connection rather than another visual exception. This guarded registry row is the durable ruling site.',
    guard: {
      state: 'guarded',
      by: 'test:session-execution-checklist + test:profile-reset-ui + test:day-first-timeline',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). TWO OPTIONS COMPARED: move the existing whole-kit/current-week modifier sheet into the workout, or derive one checklist from the opened workout and commit one-day swaps through the existing typed exercise door. The second removes the duplicate temporary status representation and preserves Profile as the only permanent editor. FOR THE ROW COLLISION: add exclusions for Barbell Row and Cable Row, or let authored exercise requirements and conditioning metadata own the distinction; the latter removes the class instead of listing victims. WHAT THE CELLS HOLD: the requirement derivation names an exact row erg without a second vague cardio row; authored Barbell Row and Seated Cable Row keep barbell/cable and never gain modality:row; strength requirements remain attached to their exercise; a missing rower selects same-tier bike work only when a saved bike remains; no machine means no invented replacement; the opened-session icon mounts one requirement-driven sheet; every committed swap is today-only and creates no active modifier; both Program variants contain no temporary Equipment shortcut; the sheet does not expand the athlete\'s whole saved kit and points permanent edits to Profile. FIRST RUN: the old V2 fifth chip, classic quick action, current-week modifier writer and single-exercise picker were all live representations of the wrong scope; the new collision cell then red because the compatibility name detector classified both strength rows as a row erg. WHAT IT DOES NOT HOLD: Sam\'s physical iPhone, a session whose generated row has an unmappable equipment string, or atomic rollback if a later write in a multi-exercise swap fails after an earlier one commits.',
    },
  },
  {
    id: 'LAW-one-name-two-meanings',
    law: 'A name that covers more than one thing is measured apart BEFORE it is worked on — per strand, never per label.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "four sightings in one day is not a coincidence — give the class a name and a row… a name that covers more than one thing is measured apart BEFORE it is worked on, and the measurement is per strand, not per label"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUR SIGHTINGS IN ONE DAY, which is what made it a class rather than an anecdote: (1) the `source` label meaning both "a person did this" and "which door"; (2) the day name meaning both "what this day is" and "what survived a move"; (3) a count meaning both rows-on-screen and rows-stored; (4) the replay latch meaning both "we are replaying, disk is truth" and "we are installing, disk is not yet truth"; (5) the witness validation point meaning both "did the install write this" and "is the world like this now"; and (6) THE SHARPEST, WHICH WAS NOT IN THE CODE AT ALL: the word "knot" — one terminal\'s own shorthand — meant "one piece of surgery" and was several strands, and it cost a decision NOT TO START; and (7) `useHomeScreen` meaning both "the day screen\'s state" and "the app\'s rebuild owner" — measured apart in docs/REBUILD_NOTICE_OWNERSHIP_2026-08-10.md BEFORE any code moved, which is the whole discipline, and the measurement paid: the two paths that drive the notice turned out to drive THE SAME FOUR PIECES OF STATE, so one ownership move closed two rulings instead of one. Measuring it strand by strand found one already loose (`handleDismissCoachNote` is `useCallback(fn, [])` over a module-level function; it was never tangled, only behind the tangle). WHAT THE CELL HOLDS: this row must enumerate its sightings, and the count may only grow — the same ratchet every debt list here carries, so a fifth instance cannot be absorbed silently. WHAT IT CANNOT DO, STATED PLAINLY: no script can look at a NAME and know it covers two things. This is a process law and its real enforcement is the LOOP CHECK line — `LAW-second-wall` already requires an alternative on the table at sighting 2, and this class is what an alternative most often turns out to be. The row exists so the shape has somewhere to be counted.',
    },
  },
  {
    id: 'LAW-pictures-newer-than-code',
    law: 'A UI picture names the CODE it shows, in its filename and in a tracked manifest, and that commit must have touched source. An index may never pin itself to a docs-only commit.',
    ruledAt: 'docs/SEAT_INBOX.md item 12, 2026-08-12: "UI_STATE_2026-08-12.md:14 pins itself to a9c82856, a docs-only commit 14h48m after the newest screenshot — which is why the seat cited a stale UI location with confidence"',
    guard: {
      state: 'guarded',
      by: 'test:ui-picture-manifest',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO), AND IT RED ON ITS FIRST RUN — on the founding defect itself, which is reported here rather than fixed quietly. FOUNDING CASE, VERIFIED BY THE GATE not quoted from the order: `a9c82856` changed `docs/ATLAS_VERIFICATION_2026-08-12.md` and `docs/SEAT_INBOX.md` and NOTHING ELSE, and the picture index said its four surfaces "stand at" it. A SHA naming a commit that touched no code reads as provenance and carries none. WHY A TRACKED MANIFEST AT ALL: `artifacts/` is gitignored (`.gitignore:26`), so the shots do not survive a clone and every filesystem instinct for "is this current" — mtime, existence — dies with them. Provenance has to be committed, and it has to be in the FILENAME too so a loose PNG still says what it shows. WHAT THE CELLS HOLD: a `pinned` row names a commit git confirms touched `src/**.ts(x)`; its filename carries that SHA; the index carries no docs-only pin; a `STALE` row says what re-shooting would take. Cell [5] is liveness and runs the founding case AS A PROBE rather than trusting the header — `a9c82856` must still measure as docs-only, or three headers quoting it are wrong. `filesChangedBy` returns NULL when git cannot answer and null is never read as "touched no code", so a shallow clone produces no fabricated finding. MUTATION-CHECKED BOTH WAYS: restoring the index heading reds cell [3]; a row claiming `pinned: a9c82856` reds cell [1]. A SECOND DEFECT CAUGHT IN THIS CELL\'S OWN FIRST GREEN RUN: the index now EXPLAINS the pin it removed, quoting the old wording, and a whole-file regex read that explanation as the offence — `a-comment-is-not-a-shipped-string`, so the reader matches HEADINGS only, never prose about a heading. WHAT IT DOES NOT DO, BY ORDER: it does not re-shoot. All four rows are STALE and say so. Sam has more UI coming and fresh shots would restale immediately; the mechanism ships first and the pictures come once his UI settles.',
    },
  },
  {
    id: 'LAW-feature-has-two-states',
    law: 'A feature is `held` (naming the test that fails when it breaks) or `UNPROVEN` (naming what a proof would take). There is no third state, and a row also says whether an athlete can REACH it.',
    ruledAt: 'docs/HOW_WE_STOP_BELIEVING_THINGS_ARE_DONE_2026-08-12.md; ordered as docs/SEAT_INBOX.md item 11 — "Two states, no third... plus a `reachable` field laws do not need. Copy lawRegistry.ts exactly; do not design a second mechanism. Seed it honestly and let the number be ugly."',
    guard: {
      state: 'guarded',
      by: 'test:feature-registry',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). `rules/featureRegistry.ts` is `lawRegistry`\'s shape verbatim — same two-state union, same `chainStatus`, same receipt-per-row — because item 11 forbade a second mechanism, and a second answer to "is this thing real" is the disease. THE ONE FIELD LAWS DO NOT NEED IS `reachable`, and it is the point: a law is true or not, but a FEATURE can be built, tested and IMPOSSIBLE FOR AN ATHLETE TO GET TO, which is the state this repo keeps finding late (`canOverride` written nine times and read none; seven modifier controls behind a caption pointing at a page that no longer showed them). SEEDED HONESTLY: 9 rows, 7 held, 2 UNPROVEN, 3 BUILT-BUT-UNREACHABLE. WHAT THE CELLS HOLD: every row well-formed with a real receipt; every named guard is a script that EXISTS; every `in_chain` claim is checked against `package.json`\'s actual chain string, because a check nobody runs is not a check; the roster DECLARES ITS OWN INCOMPLETENESS, so an absent row is never read as an absent feature; and an `athlete_reachable` + `held` row must say in its receipt HOW IT WAS SEEN — glass, a flow, a screenshot — because `CLAUDE.md` rules that done means the athlete can see it and a green id proves presence, not placement. MUTATION-CHECKED THREE WAYS (a guard naming a script nobody wrote, a false `in_chain`, an athlete-facing row losing its how-it-was-seen) plus a liveness arm over `rowFaults`. A BUG IN THIS GATE\'S OWN FIRST CUT IS WORTH RECORDING: the in_chain cell filtered then read `FEATURE_REGISTRY[index].id`, and after a filter that index addresses a different row — it PASSED, because nothing was lying yet, and would have named the wrong feature the moment one did. WHAT IT DELIBERATELY DOES NOT DO: it does NOT red on `UNPROVEN`, unlike `test:law-registry` on `UNENFORCED`. Sam ruled an unguarded RULE is a rule not followed; an unproven FEATURE is simply unproven, and reding would mean a row could only be added after it was finished — the roster would fill with lies or stay empty.',
    },
  },
  {
    id: 'LAW-computed-must-be-consumed',
    law: 'A value the app computes on every assessment and no code reads is not a feature, it is a rule that was SWITCHED OFF. Either wire it or delete it.',
    ruledAt: 'docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md §4, proposed as "a noUnusedWrites-style gate over contract.* assignments" after nine findings of the same shape in one day; ordered as docs/SEAT_INBOX.md item 10',
    guard: {
      state: 'guarded',
      by: 'test:computed-must-be-consumed',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). THE FIRST RUN FOUND SIXTEEN, NOT TWO. §4 named two `contract.*` offenders (`unavoidableAnchorCausedExcess`, `achievedModerateDayCount`); measuring all 42 assigned `contract.*` fields found SIXTEEN written on every assessment and read by nothing — fourteen of them one module\'s entire achieved-ledger family. The doc\'s nine was a sample, not a census, which is `LAW-count-names-instrument` again and the reason the gate measures instead of encoding the list it was handed. WHAT IT HOLDS: a write is `contract[.path].field =`; a read is any `.field` occurrence that is not the left side of an assignment, anywhere in production. The unit is textual reads of a member NAME and it is deliberately generous — a field read once, by any object, passes — so a field this gate calls unconsumed is one nothing mentions at all, which is the form of the claim that cannot be argued with. The sixteen are declared as dated debt and the list MAY ONLY SHRINK: the gate reds when the set grows (a new rule switched off) AND when a declared field gains a reader without leaving the list, because a debt list that overstates itself is a number the next reader prices against. MUTATION-CHECKED THREE WAYS: a fabricated `contract.x.y =` with no reader reds cell [2]; dropping a real offender from the list reds cell [2]; a fictitious entry reds cell [3]. Cell [4] is liveness — the matcher is shown a plain write and a plain read and must see both, so [2] and [3] cannot be green because the detector went blind. WHAT IT DOES NOT HOLD, AND THIS IS STATED RATHER THAN IMPLIED: SIX OF §4\'s NINE ARE NOT `contract.*` AT ALL — a Set indexed `[0]` one line later, a decision list, a collapsed N-list, `canOverride` (closed separately by `LAW-warn-then-allow`). "Is this exported function ever called" needs a call graph; a gate believed to be general is worse than one known to be narrow.',
    },
  },
  {
    id: 'LAW-warn-then-allow',
    law: 'The app WARNS, RECORDS that it warned, and then does what the athlete asked. A refusal with no way through survives only where the action is physically impossible.',
    ruledAt: 'docs/SEAT_INBOX.md item 9, Sam 2026-08-12: "should give warnings but allow them to do whatever they want", and earlier "nothing so tight that ... the athlete can\'t choose to do whatever they want"',
    guard: {
      state: 'guarded',
      by: 'test:block-override',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: a `block` in `PlanChangeSheet` rendered its reasons and ONE button labelled `OK`. There was no way through, for any reason, ever — while the finding underneath it already carried the answer. `canOverride` had been WRITTEN IN NINE PLACES AND READ IN NONE (`weekStructureValidator`, `programEditRiskAssessment`, `planChangeProducer`), which is `CLAUDE.md`\'s own example of the dead-field defect: "a field with no reader is not half-built, it is dead weight that later code will trust". WHAT THE CELLS HOLD: `rules/blockOverride.mayOverrideBlock` is the ONE reader — every finding must allow it, because one physically-impossible reason among five is still impossible and offering to proceed would promise what the app cannot deliver; an EMPTY finding list is NOT an override, because `[].every()` is `true` and an inline check would have turned "we could not say why" into "go ahead" on exactly the path where the app already failed to explain itself; the sheet assigns its way through DIRECTLY from the rule; and the override is emitted on the athlete-action tape (`athlete_action_override_allowed`) with the reasons it overrode, BEFORE the change commits. MUTATION-CHECKED THREE WAYS, and the third one earned its cell: `override: false && mayOverrideBlock(...)` — the way through disabled for every athlete — left the first reader cell GREEN, because a source scan asks whether a word is present and "present" is not "running". Cell [3b] exists because of that miss. WHAT IT DOES NOT HOLD: item 9 also asks that four competing answers to "is this the athlete\'s will" collapse onto `resolverMayDisplace` (`projectVisibleWeek.ts:214-219`, `section18CraftTier.ts:217-232`). NOT DONE — those files are mid-flight with another agent in this shared checkout, and the STRING JOIN that breaks on a rename is untouched.',
    },
  },
  {
    id: 'LAW-rehydration-never-un-finishes',
    law: 'A rehydration may RESTORE state and may never take it away. Onboarding completion is monotonic within a process — only the athlete\'s own reset door may lower it.',
    ruledAt: 'docs/SEAT_INBOX.md item 2, 2026-08-12: "Rehydrating an EMPTY profile envelope does not merely fail to restore answers: profileStore\'s merge spreads ...persisted over the live state, so it flips isOnboardingComplete from true to false in memory. An empty envelope actively un-finishes a finished profile."',
    guard: {
      state: 'guarded',
      by: 'test:profile-rehydration-cannot-unfinish',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE: `profileStore`\'s merge returned `{ ...currentState, ...persisted, onboardingData: merged }`. It took real care over ONE field — `onboardingData` is spread so a missing answer cannot erase a live one — and then let every OTHER field take the disk\'s word, including `isOnboardingComplete`. THE ASYMMETRY WAS THE WHOLE BUG: someone saw the danger for the answers and did not see that the FLAG saying those answers exist carries it too. Reading back the 103-byte shell an interrupted wipe leaves flipped a finished profile to unfinished IN MEMORY, and that flag gates the app — a finished athlete is sent to the first-run flow with their program still sitting in the other stores, with nothing thrown and nothing logged. Found beside the L16 write-ordering fix (`fd4f68a2`), which fixed what WROTE the shell; this is what happens when one is READ, whatever wrote it. WHAT THE CELLS HOLD: the merge is a NAMED EXPORTED owner (it was an inline zustand callback, so no cell could reach the rule at all), a bare envelope cannot lower a live `true`, and — the non-vacuity arm — a real envelope still RAISES an unfinished live state and persisted answers still merge over live ones, so the guard cannot be satisfied by ignoring the disk. Mutation-checked BOTH directions. `||` and not `??`, because the bare envelope carries `false` rather than nothing and a nullish check would not see it. WHAT IT DOES NOT HOLD, STATED PLAINLY: it protects ONE field. A future field whose absence is destructive needs the same treatment and its own cell; this merge is not generally safe and the owner\'s header says so.',
    },
  },
  {
    id: 'LAW-never-disable-a-set-for-part-of-it',
    law: 'Never disable a whole set because part of it is blocked. Per control, per strand — and the notice retires itself as each is freed.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "dimming every button and sending Sam elsewhere for something he could do right there is the same fault mirrored… never disable a set because part of it is blocked"',
    guard: {
      state: 'guarded',
      by: 'test:my-status-modifiers',
      chainStatus: 'in_chain',
      receipt: 'GUARD MOVED 2026-08-12, LAW UNCHANGED, AND THE NEW CELL IS A STRONGER CLAIM. SEAT_INBOX item 8 made all eight modifier actions live on My Status, which DELETED the machinery the old cell read (`liveActionKinds`, `disabled={notYet}`, `note.actions.some(`) — and a cell anchored on deleted strings passes over nothing, which is the silent-green shape the anchoring law exists to catch. `test:my-status-modifiers` replaces it by asking the harder question: is the ROUTER total over the action vocabulary? It reads the eight kinds from `ACTIVE_PROGRAM_MODIFIER_ACTION_KINDS` (the type\'s own exported value, so the two cannot drift), requires every one to reach a door, pins each route against the branch `HomeScreenV2` always took, and has its own liveness probe feeding the router an unknown kind and requiring null. A ninth kind arriving with nowhere to go reds on the day it arrives. THE OLD CELL\'S FOUNDING CASE, PRESERVED: the coach status screen dimmed EVERY modifier control and captioned them "Change this on your program screen for now", because the actions needed an ownership extraction. That was right for most of them and WRONG for `dismiss_note`, which works — so the screen was telling the athlete to go elsewhere for something they could do right there. THE DEAD-AFFORDANCE LAW MIRRORED: a control that looks live but is not, and a control that looks dead but works, are the same defect pointing opposite ways. AND THE CAPTION WAS WORSE THAN OBSOLETE — measured 2026-08-12, `HomeScreenV2` had stopped rendering the modifier list at the UI merge, so "your program screen" had nothing on it and an athlete who followed the sentence found an empty room. WHAT IT STILL DOES NOT HOLD: it is scoped to the modifier vocabulary. A different screen inventing its own whole-set disable is not caught, and naming that is honest rather than pretending the cell is general. ORIGINAL RECEIPT: BORN GUARDED (LAW ZERO). FOUNDING CASE, AND IT WAS THIS TERMINAL\'S OWN CORRECTION BEING CORRECTED: the coach status screen dimmed EVERY modifier control and captioned them "Change this on your program screen for now", because the actions needed an ownership extraction. That was right for most of them and WRONG for `dismiss_note`, which works — so the screen was telling the athlete to go elsewhere for something they could do right there. THE DEAD-AFFORDANCE LAW MIRRORED: a control that looks live but is not, and a control that looks dead but works, are the same defect pointing opposite ways. WHAT THE CELL HOLDS: `ActiveModifiersSection`\'s not-yet flag is resolved PER ACTION against a list of live kinds, not per screen; the caption renders only on notes that still hold an inert action; and the disabled prop reads the per-action value. So freeing a strand lights it up and retires its own notice with no further edit. WHAT IT DOES NOT HOLD: it is scoped to the founding surface. A new screen inventing its own whole-set disable is not caught, and naming that is honest rather than pretending the cell is general.',
    },
  },
  {
    id: 'LAW-flows-photograph-what-they-touch',
    law: 'A flow proves presence, never layout. Every state a flow reaches is photographed, because only an eye catches a layout defect.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "the two layout bugs you found by eye are a finding, not a footnote… neither visible to any assertion… if the answer is \'only an eye\', then the screenshots are load-bearing and the flows must photograph every state they touch"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). TWO FOUNDING CASES IN ONE PASS, both real, both shipped past a GREEN flow: the coach status screen\'s close control rendered ON the status bar over the battery icon (it was an absolutely-positioned sibling outside the safe area of the screen it closed), and its title rendered at front-page size, swamping the one card beneath it. THE FLOW ASSERTING THAT SCREEN WAS GREEN THROUGH BOTH. That is not a gap in the assertions — it is the honest limit of the instrument: `assertVisible` answers "is this in the tree", and every layout defect is a question about WHERE, which no id can carry. WHAT THE CELL HOLDS: every flow under .maestro/golden that reaches a distinct surface takes at least one screenshot, and a flow that navigates to N surfaces without photographing any of them reds. WHAT IT CANNOT DO, AND THIS IS THE POINT OF THE ROW: it cannot check the PHOTOGRAPH. The screenshots are load-bearing and Sam\'s eye is the instrument that reads them — so the law is about making sure the evidence EXISTS to be looked at, and the boundary report must name which shots a reader should open. A rule that pretended a script could see the battery-icon overlap would be the vacuous-green defect wearing a new hat.',
    },
  },
  {
    id: 'LAW-no-silent-blank-screen',
    law: 'A blank screen must be impossible to reach silently. Whatever refused says what it was and offers a way out.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, Sam via the seat after losing time to a blank screen twice in one day: "a white screen must be impossible to reach silently"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE, REPRODUCED ON THE DEVICE AND FIXED THE SAME PASS: in __DEV__ the navigator mounts only after prepareDevE2EAppLaunch() resolves; it returned a bare `false` on any failure and App.tsx simply returned, so the app rendered a root with NOTHING in it — no error, no red box, no text, forever. A Maestro run leaves a dev clock receipt behind; the next PLAIN launch (the way Sam opens the app) reads a receipt with no matching checkpoint, restoreDevE2EClockBeforeHydration throws "clock receipt has no active checkpoint", and that is the white screen he hit at 19:22 after his rebuild. THE DIAGNOSIS WAS ISOLATED BY EXPERIMENT, NOT GUESSED: the SAME binary and the SAME world render fine under the harness launch and white under a plain one, which refuted both offered leads (a Metro URL mismatch — Metro answers on BOTH addresses — and the new native refusal path, which logs nothing on a plain launch). WHAT THE CELL HOLDS: App.tsx renders a named refusal surface, shows the REASON, and offers a one-tap clear; and the barrier is not read as a bare boolean again, which is the shape that made the reason unable to travel. Liveness probes all four directions including the exact pre-fix shape. WHAT THE CELL CANNOT DO, AND IT IS THE IMPORTANT HALF: every source-reading cell in this chain passed while the white screen was happening — there is nothing wrong with code that did not run. The real instrument is .maestro/golden/dev-launch-refusal-speaks.yaml, which seeds through the harness and then launches WITHOUT it, and is GREEN on the device.',
    },
  },
  {
    id: 'LAW-diagnostic-refuses-never-crashes',
    law: 'A development diagnostic refuses loudly and lets the app boot. It may never kill the process.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, Sam via the seat after the third crash of one shape in a day: "A DEV DIAGNOSTIC MUST NOT BE ABLE TO KILL THE APP… A crash is the least debuggable possible signal: it destroys the process before anything can report why."',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). CENSUS, MEASURED NOT ESTIMATED: DevE2ELaunchDiagnostic.swift held TEN hard fatalErrors on the launch path, every one reachable from didFinishLaunchingWithOptions — before a line of JavaScript, so nothing could report the reason and it had to be reconstructed from ~/Library/Logs/DiagnosticReports each time. THREE OF THE TEN EACH COST A DEBUGGING CYCLE: the missing launch purpose (read as "the rig is dead" for 23 days), the resolved-bundle trap behind the reload flows, and the metro url — which fired at 18:56:45 on 2026-08-10 because THIS TERMINAL ran `maestro test` without the runner, so the app was handed the literal string ${E2E_METRO_URL}. Every one of the three was an input mistake OUTSIDE the app. The count is now ZERO. WHAT THE CELLS HOLD: no fatalError/precondition/assertionFailure survives in ios/LocalFootyAthlete (comment-stripped, so a comment naming the ban is not the ban being broken); the Swift side exports launchRefusalCodes over the constants bridge measured to reach JS; devE2EEntry publishes them as e2e-explorer-launch-error-<code>, through the EXISTING channel rather than a second representation; and it publishes BEFORE the hydration that would otherwise raise a consequential marker first. Liveness both directions, including the comment false-positive and a refusal being misread as a crash. WHAT IT DOES NOT HOLD: no refusal has ever FIRED on a device under this change — it is native code and NEEDS THE REBUILD Sam already owes before it runs at all.',
    },
  },
  {
    id: 'LAW-hot-file-budget',
    law: 'A file re-read at every stop has a stated size budget, and going over it is a failure.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat relaying Sam\'s /usage: "126M tokens IN, 5k out, $68.95 for 1h43m… THEN GUARD BOTH, because this will grow back within a day otherwise"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE IS A BILL, NOT A SMELL: almost all of that 126M input was READING, and the two files re-read at every terminal stop were SEAT_INBOX.md at 353KB and NOW.md at 53KB. Both carried a line at the top saying what they were for — "the review seat writes here; terminal reads at every stop" and "overwrite at every checkpoint (pointer, not history)" — and both had quietly become history. Same shape as every other rot here: correct when written, nobody watching it drift. THE TRIM IS NOT THE FIX, THE ALARM IS: NOW.md went 53KB -> ~4KB and the inbox 353KB -> 43KB, and either would grow back within a day. BUDGETS AND WHY, since the order asked: NOW.md 24KB (a pointer whose job is links, ~6x its post-trim size), SEAT_INBOX.md 96KB (orders are longer and several are live at once, but it is a quarter of what the file reached). WHAT THE CELL HOLDS: both files exist, both are non-empty (a budget over a missing or empty file is a green that means nothing), and neither is over. Liveness probes the 53KB case, an inside-budget case, and the inclusive boundary. WHEN IT REDS THE ANSWER IS TO ARCHIVE VERBATIM TO A DATED FILE — never to delete, and never to raise the budget to match the file.',
    },
  },
  {
    id: 'LAW-durable-write-is-never-silent',
    law: 'A durable write that is dropped leaves a record naming the store and counting the drops. Storage may refuse; it may never refuse quietly.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, seat: "DO NOT LOSE ITEM 6 — THE SEEDED WORLD IS NOT DURABLE… it must not become a NOT-COVERED line that survives three passes"',
    guard: {
      state: 'guarded',
      by: 'test:durable-write-silence',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED (LAW ZERO). FOUNDING CASE, MEASURED: a seeded world ended with FOUR game days in memory and ONE on disk. `asyncStorageDurable` drops every durable write while the ledger replay latch is held — "THE BOOT DOES NOT WRITE", R1.3, deliberate — and the dev-E2E seed installs THROUGH that window, so three of the athlete\'s fixtures never reached storage and NOTHING RECORDED IT. Turning the harness\'s "calendar-storage did not converge" into that sentence took a hand-read of the simulator\'s AsyncStorage and a walk through three modules. WHAT THE CELL HOLDS: the latch still drops (asserted FIRST, so a future change that let the boot write again cannot pass by emptying the counter); every drop names its store; repeat drops on ONE store are counted rather than collapsed to a boolean — the founding case was three drops on one key; and liveness both ways, so a write made outside the latch is never recorded as dropped. WHAT IT DOES NOT HOLD, STATED NOT IMPLIED: it does NOT claim the drop is correct. Where the boundary between "boot may not write" and "an install must" belongs is an OWNERSHIP question, priced separately and deliberately unanswered — the stop-patching rule says name it rather than reach into boot. Six flows stay red behind that question.',
    },
  },
  {
    id: 'LAW-permission-is-granted-once',
    law: 'A permission recorded in the seat inbox stands until Sam withdraws it. Re-asking is a defect; the fix for a refused operation is to read the file and retry, never to ask again.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10 (seat, against LAW-seat-coordination): "asking twice for a permission already granted is the courier toll in a new coat"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED. FOUNDING CASE IS THIS TERMINAL, TWICE IN A ROW: Sam ruled two file operations, the tool refused them once, and instead of retrying the terminal put them back to him as blocked-on-Sam items in TWO consecutive reports. Both operations succeeded on the retry that should have happened immediately. The cell holds the checkable form — a blocked-on-Sam item is a DECISION, DEVICE TIME or a THING ONLY HE HAS, never a request for permission. Liveness both directions: a permission re-ask is caught, a genuine decision is not.',
    },
  },
  {
    id: 'LAW-sam-is-not-the-wire',
    law: 'Sam is never the relay. The seat reads the repo; what he is asked for is decisions, device testing, and things only he has — nothing else.',
    ruledAt: 'AGENTS.md "Seat coordination laws"; docs/SEAT_INBOX.md 2026-08-10 (Sam ruled the whole three-part process fix)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED. FOUNDING CASE: Sam spent 2026-08-10 pasting the seat\'s orders to the terminal and the terminal\'s reports back to the seat — he typed "check inbox" five times in one session. Seat→terminal was fixed by the hook reading by content (f168b48b); terminal→seat is fixed by the seat READING the repo, which it already has mounted. The cell holds the checkable half: no item in a blocked-on-Sam section may ask him to relay, paste, forward or route anything. Written into AGENTS.md as well as here BECAUSE IT MAKES THE SEAT SMALLER and is therefore the law most likely to be quietly dropped.',
    },
  },
  {
    id: 'LAW-label-names-the-door',
    law: 'A diagnostic label must distinguish the things a diagnosis needs to tell apart, and it is DERIVED from the one field that already knows — never passed in beside it as a second opinion.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10, from Sam: "well shouldn\'t it be labelled differently to prevent this issue from happening again? so we can diagnose whether the issue happened via tap or coach?" — LAW-count-names-instrument widened from numbers to labels by his question.',
    guard: {
      state: 'guarded',
      by: 'test:diagnostic-label-names-the-door',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED. 20 cells. FOUNDING CASE: `source: "tap"` was emitted by both the Program tab sheet and the coach change card because it was derived from `initiatedBy` (which answers "was a human involved?"), so the seat read Sam\'s `lastTransaction: "tap:move_session:..."` and told him his coach move came through the Program tab — wrong, and it cost a full pass. Cells hold the derivation, the CONTROL in the same run (the two doors must DIFFER, asserted as a difference), the summary/log agreement, and a regression cell banning the exact expression that caused it. NOT a general ban on reading `initiatedBy`: `sourceActor` is a different axis and correctly ignores the door.',
    },
  },
  {
    id: 'LAW-repair-names-its-kind',
    law: 'An event reporting that a repair ran names WHICH repair, and a violation list reported after selection says that it is post-selection.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-10 ("Measure that, do not assume it") — raised by Sam\'s coach export showing gatewayStatus "repaired" four times with rejectionCodes [].',
    guard: {
      state: 'guarded',
      by: 'test:diagnostic-label-names-the-door',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED, in the same suite as its sibling because it is the same disease. MEASURED: none of the four `repair_candidate_selected` emitters recorded `repair.kind`, while the gateway result carries typed kinds — the log was throwing them away, which is where "measure it, do not assume it" ran out of road on Sam\'s export. `rejectionCodes: []` beside four repairs is not a contradiction: the list is the SELECTED candidate\'s evaluation, i.e. AFTER repair, and nothing at the field said so.',
    },
  },
  {
    id: 'LAW-unreadable-world-resets-clean',
    law: 'A stored world the current code cannot read is RESET CLEAN and the athlete is told once, in plain words — never migrated, never silently served by an older set of rules.',
    ruledAt: 'docs/SEAT_INBOX.md item 1(c) 2026-08-10 (Sam: "kill it"), scoped verbatim: "an unreadable stored world resets and the athlete is told once, in plain words. No migration, no fallback, no second attempt to salvage."',
    guard: {
      state: 'guarded',
      by: 'test:unreadable-world-reset',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED, in the same commit as the law — no UNENFORCED window. 73 cells: readable passes through; seven unreadable shapes reset with a reason; ABSENT is a first run and tells nobody (the trap: an empty device must not be told its training was destroyed); the telling is derived from the fact, never counted; the door contains no migration/fallback/salvage word; the sentence is in the signed sheet and carries no jargon; and the deleted migration is structurally proven gone WITH the unrelated generator-recovery ruling that rode inside it proven surviving.',
    },
  },
  {
    id: 'LAW-L16-vertical-slice',
    law: 'Vertical slice first — ship a thin path end to end before widening it.',
    ruledAt: 'AGENTS.md "L16 — Vertical slice first"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'PROCESS law; seat checklist.',
      receipt: 'Process law.',
    },
  },
  {
    id: 'LAW-totals-or-red',
    law: 'A suite is born failing and only its own printed totals line clears it.',
    // AUDITED 2026-08-10: ruledAt cited `AGENTS.md "Test Standard"`. That
    // section says nothing about totals-or-red — grep for "totals" over
    // AGENTS.md returns ONE hit, in a different law's worked example. A row
    // citing a section that does not carry its law is exactly the misfiling
    // this audit exists to find, and it was on the registry's strongest row.
    ruledAt: 'src/__tests__/support/totalsOrRed.ts header, quoting Sam 2026-08-03: "TOTALS-OR-RED IS LAW for every suite in test:bible — exit code armed red at module top, cleared only by the printed totals line."',
    guard: {
      state: 'guarded',
      by: 'test:totals-or-red-law',
      chainStatus: 'in_chain',
      receipt: 'GREEN 4/4 as of 2026-08-13, and it was 1/3 that morning. 244 suites call armTotalsOrRed()/totalsPrinted() (was 175); the law has its own chain script which DERIVES the suite list from the test:bible chain string, so a suite cannot join the chain unenrolled. ⚠ THE 2026-08-13 PAYDOWN IS THE PROOF THAT DERIVATION WORKS: 40 suites sat in the chain UNARMED, 31 of them wired in that same day by the `audit` seat, and the law named every one. All 40 armed; the last five were red not because their promise chains needed process.exit(0) but because the arming pass had put the clear in the .catch() branch and left the success path with none. A guard that names its own paydown is the shape to copy. THE STRONGEST ROW IN THIS REGISTRY and the shape the others should copy.',
    },
  },
  {
    id: 'LAW-stop-needs-an-exit',
    law: 'STUCK ON AN ITEM IS NOT STUCK ON THE QUEUE: when an order cannot be resolved alone, it is MARKED `BLOCKED-BY: sam|other-agent|external` on its own head line and the terminal works the NEXT order in the same turn. A turn may end while the queue holds WORKABLE orders only on: a NEW decision written under `## AWAITING SAM` in that commit, or three turn-ends with no new commit at all. Otherwise the turn ends when nothing workable is left — every remaining item marked blocked, or the queue clear — so Sam\'s questions reach him in ONE batch. NO COMMIT SUBJECT IS AN EXIT: neither `docs(stop):` nor `docs(blocked):`.',
    ruledAt: 'docs/SEAT_INBOX.md item 0, Sam 2026-08-12: "why does it keep fuckign stopping if theres nothing for me to say" and "i want it to run through the list overnight as long as it can"; NARROWED TO ITS FINAL SHAPE by Sam 2026-08-13, verbatim: "batch — and when you\'re stuck on an item, move to the next item instead of stopping. Only stop when the whole list is blocked."',
    guard: {
      state: 'guarded',
      by: 'test:seat-inbox-hook',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12, AND THE OLD CELL WAS THE HOLE. `test:seat-inbox-hook` used to assert "a committed STOP report ALLOWS the turn to end" and it PASSED — so order 0 said "do not stop while this queue has items" for hours while this script held the door open, and the terminal stopped after nearly every unit. IT WAS NOT DISOBEDIENCE: a note in a file never beats a door in a script, and Sam was left as the restart button. The case is INVERTED rather than deleted so the exit\'s history stays legible. FOUR EXITS, 25 cells, FOUR MUTATIONS KILLED: re-opening `docs(stop):` reds the inversion; accepting ANY added inbox line reds the case that a line added ELSEWHERE must not open the AWAITING SAM exit; firing the no-progress breaker on the first turn-end reds five cells; and removing the counter reset reds the breaker case. THE SECOND MUTATION SURVIVED AT FIRST and its case was added because of it — "the line must be NEW" was enforced only by there being no diff at all, so a hook that allowed on any added line passed every cell. THE BREAKER IS MEASURED IN COMMITS, NOT TIME, on Sam\'s reasoning: a clock stops useful work as readily as useless work; a commit counter only fires when nothing is being produced. Its state is machine-local under `.claude/` because it is about this terminal\'s turns, not about the repo. ── REWRITTEN 2026-08-13, AND THE DOOR WAS THE WRONG LAYER ALL THREE TIMES. Item 29 shut the unqualified `docs(blocked):` exit and MEASURED ITSELF: 0 of the 18 blocked commits in the six hours before carried a qualifying `BLOCKED-BY:` line and 4 of 4 after did — the gate worked — yet the rate went UP, 3.0/hour to 7.4/hour, every one landing on Sam, whose symptom ("it works for like 5 min then stops and reports") was unchanged. THE DIAGNOSIS THE FIRST TWO ATTEMPTS MISSED: blocked on ONE ITEM is not blocked on the QUEUE; each of those four stopped with 22 live orders workable. Sam ruled the fix: mark the stuck item, work the next one, stop only when the whole list is blocked. SO EXIT 2 IS WITHDRAWN ENTIRELY — third withdrawal of one door (`docs(stop):` 2026-08-10, `docs(blocked):` 2026-08-12, the qualified body 2026-08-13), which is §8\'s second-wall shape and the alternative it demands: stop tightening the exit, change what COUNTS AS WORK. The replacement ships in the same commit and needs no new exit, no new state and no clock — a marked item is skipped by the same scan that already skips a parked one, so "the whole list is blocked" IS "the scan found nothing", which is EXIT 1. THE THREE OLD EXIT-2 CELLS ARE INVERTED, NOT DELETED, so all three withdrawals stay legible. 36 cells, THREE FRESH MUTATIONS KILLED, each by exactly the cell that should catch it: removing the marker skip (script still valid) reds ONLY "the whole list marked blocked ALLOWS"; widening the marker to any word reds ONLY "an INVENTED blocked category marks nothing"; and turning the skip\'s `continue` into a `break` reds ONLY "a marked-blocked item is walked PAST to the next order" — that last mutant is why the walk-past cell is not green-and-empty, since expecting `block` would otherwise pass whether or not the marker did anything. A marker in an item\'s BODY is also asserted NOT to silence its head, because column 0 is all the scan reads and "hidden from the scan" is this file\'s five-times-repeated class.',
    },
  },
  {
    id: 'LAW-inbox-order-is-content',
    law: 'An unprocessed seat order stops the terminal from ending its turn, and an order is identified by its CONTENT, never by its numbering.',
    ruledAt: 'Sam 2026-08-10 (item 000(B), the courier toll); scripts/seat-inbox-hook.sh',
    guard: {
      state: 'guarded',
      by: 'test:seat-inbox-hook',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. The hook matched `^1\\.` only, so every order the seat wrote as `00.`/`0.`/`000.` was INVISIBLE and the turn ended silently — Sam became the message bus and typed "check inbox" himself twice that day. SIGHTING 4 of the numbering-artefact class the hook\'s own comments already named twice. Rewritten to read content; **21 cells**, both directions; the six new must-block cases red when the old `^1\\.` scan is restored (mutation run 2026-08-10). The suite existed but was in NO chain — measured and enrolled in the same commit. **AND THE HOOK\'S OWN PROMISED EXIT DID NOT EXIST:** its block reason has always ended \'or a genuine STOP report is committed\' and NOTHING EVER LOOKED FOR ONE, so a terminal that committed a real stop was blocked exactly as hard as one that had done nothing. Same defect class as the numbering artefact — the reason text promising a mechanism the logic did not implement. Implemented narrowly: HEAD\'s subject must begin `docs(stop):`. Mutations: removing the exit reds 1 cell, widening it to any commit reds 3.',
    },
  },
  {
    id: 'LAW-seat-coordination',
    law: 'The seat writes orders in ## Unprocessed; terminal-owned blockers and holds live below it, never mixed in.',
    // AUDITED 2026-08-10: ruledAt cited AGENTS.md "Seat coordination laws" for
    // BOTH halves. That section states the SEAT INBOX half; the
    // "terminal-owned blockers and holds live below it" half appears only in
    // SEAT_INBOX.md's own prose (lines 495, 630) and nowhere in AGENTS.md.
    // Cited honestly rather than upgraded to a law it was never written as.
    ruledAt: 'AGENTS.md "Seat coordination laws" (SEAT INBOX half, Sam 2026-08-07); the terminal-owned-section half is convention recorded in docs/SEAT_INBOX.md only and has never been ruled into AGENTS.md',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. Reads docs/SEAT_INBOX.md STRUCTURE: exactly one `## Unprocessed`, it is the FIRST section, and a processed section exists below it. Violated and repaired by hand on 2026-08-10 (74070cf2) before this existed. NOT guarded by test:seat-inbox-hook, which reads the queue\'s CONTENT and says nothing about the document\'s shape. THE CHECKER WAS WRONG ON ITS OWN FIRST RUN — it trimmed lines and read an INDENTED QUOTATION of the law (SEAT_INBOX.md:317) as a second queue; a heading is only a heading at column 0, and that regression now has its own cell.',
    },
  },
  {
    id: 'LAW-definition-of-done',
    law: 'Finished means the athlete can see it: the proof is the visible Program flow, a UI change needs simulator proof, a persistence claim needs a relaunch, a generation change needs the full scenario report — and the only three words for a claim are WORKING, BUILT and WRITTEN.',
    ruledAt: 'docs/SEAT_INBOX.md item 0d(i), Sam 2026-08-12: CLAUDE.md "DOES NOT SAY WHAT COUNTS AS FINISHED. It governs how to TALK to Sam and nothing else." Written into CLAUDE.md "WHAT COUNTS AS FINISHED" the same day.',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12, AND THE ROW SAYS WHICH HALF. The cell holds what a script can see: the section exists in CLAUDE.md, it still offers all three words, the banned-words line is still there, and EVERY COMMAND IT NAMES IS REAL — a command table is the part of a doc that rots first, and a renamed script leaves the instruction looking exactly as authoritative as a true one. PARTIAL, stated rather than implied: the JUDGMENT half — is this proof really athlete-visible — is carried by lfa-verifier and scripts/completion-gate.sh, neither of which is a cell. Mutations 2026-08-12: renaming lfa:dev in package.json reds it (the doc goes stale), and replacing the banned-words line reds it. The placeholder `npm run test:<name>` is skipped deliberately — an early version read it as the script name `test:` and reddened on correct prose.',
    },
  },
  {
    id: 'LAW-moderate-day-advisory',
    law: 'The other half of Sam\'s shape is held: a week below the contract\'s preferred moderate-day minimum raises a finding — and that finding is ADVISORY, never blocking.',
    ruledAt: 'docs/SEAT_INBOX.md item 4, from LFA_PROGRAMMING_BIBLE.md:4808 ("4 hard days plus 1 moderate/easy day") and :4810 (advisory, never blocking); measured in docs/MODERATE_DAY_MEASUREMENT_2026-08-12.md',
    guard: {
      state: 'guarded',
      by: 'test:section18-v2',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. `achievedModerateDayCount` was written on every assessment and read by NOTHING — the hard half of the same sentence has had a range, a permitted maximum and two findings since Contract v2 shipped. Measured: 12 of 17 QA scenarios have ZERO moderate days and every in-season fixture week is among them. THE CELLS DRIVE THE CONTRACT NUMBER, NOT A WORLD: the first version asserted "a week with no moderate day" over a hand-built fixture that turned out to have TWO (days 3 and 5) — the fixture was wrong, not the rule, and that cell would have been asserting the fixture. Moving the contract minimum either side of the achieved count tests both directions and cannot be fooled by what a fixture classifies. MUTATIONS: making the branch unreachable reds two cells; making the severity `blocking` does not merely red a cell, it throws Section18WeekAcceptanceError and takes the suite down — which DEMONSTRATES the ruling rather than asserting it, because that is precisely the outage an advisory-only finding exists to prevent. `preferredModerateDayRange.max` is 7, meaning unbounded: the ruling gives a minimum and says nothing about a ceiling, and a max of 1 would make a two-moderate-day week a defect.',
    },
  },
  {
    id: 'LAW-stress-vocabulary-is-one-word',
    law: 'A session\'s stress level is `high | medium | low`. No producer may write a fourth word, and a cast may not be used to smuggle one past the compiler.',
    ruledAt: 'src/rules/weeklyExposureContract.ts:149 (the union); found 2026-08-12 while building seat item 4',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12, and the guard had to be widened TWICE before it could catch its own founding case. `section18OfferPlacement.ts:508` wrote `stressLevel: \'moderate\'` — outside the union — for as long as the file existed, cast `as never` two lines below so the compiler was blind by construction. The §18 ledger counts a moderate day by `=== \'medium\'`, so every offer that placer marked as the easier option was invisible to the count. THE SCAN IS A SOURCE SCAN BECAUSE A TYPE CANNOT REACH PAST A CAST. Correction 1: the first version matched `stressLevel:\\s*\'word\'` and MISSED THE FOUNDING CASE ITSELF, which is a ternary — it passed the mutation that put the bad word back. Correction 2: widened to the whole assignment, it then flagged `stressLevel: args.stress === \'hard\' ? \'high\' : \'medium\'` for the word it TESTS rather than the words it writes; comparison operands are now stripped. Both corrections have their own liveness probe. Mutation: restoring the founding case reds it; the real tree is green. THE FIX ITSELF CHANGED NOTHING MEASURABLE — all 17 QA scenarios are identical before and after, because that placer does not run in them. Said out loud rather than claimed as a win.',
    },
  },
  {
    id: 'LAW-preference-report',
    law: 'A rules-engine change must say what it did to Sam\'s PREFERENCES across all 17 scenarios, not only whether the weeks stayed legal — and a gain on one scenario bought with regressions across the rest is rejected as over-fitting.',
    ruledAt: 'docs/SEAT_INBOX.md item 5, Sam 2026-08-12 (his oldest fear): "I don\'t want to get 2 weeks down the line and realise that a weekly template optimised for that and that alone."',
    guard: {
      state: 'guarded',
      by: 'test:preference-shape',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. THE INSTRUMENT EXISTED AND THE QUESTION WAS NEVER PUT TO IT — the 17 scenarios answered "is this week legal" and never "is this a week Sam would write", which is how the 4-hard-plus-1-moderate finding sat unseen for months. Built on the EXISTING `LFA_HARD_DAY_PROBE` seam as the order required; no second flag. THE SCORE IS A COUNT OF RULED PREFERENCES, NOT AN INVENTED WEIGHTING: two axes today, each quoted at the code, and both read their thresholds from the contract (`preferredHardDayRange.max`, `permittedHardDayMaximum`) rather than hard-coding 4 and 5 — an off-season week whose preferred max is 2 is judged against ITS OWN number. A fifth hard day costs the preference and is NEVER a violation (stand-down A). THE SPLIT IS DELIBERATE: `test:qa` PRINTS the table and does not block, because it already carries 84 pre-existing failures and a verdict inside that exit code would be indistinguishable from them; this suite holds the rules and is green. 8 cells, each probed both directions, including: a hard failure is not also counted as a regression (one event, two names, and the blocking one must not be diluted); a broad gain with one cost is NOT over-fitting; and a scenario that VANISHES between runs is not a pass — dropping the failing week is the cheapest way to satisfy any set of preferences. TODAY\'S MEASUREMENT, committed as `scripts/preference-baseline.json`: 4 of 17 scenarios meet both preferences, 0 hard violations.',
    },
  },
  {
    id: 'LAW-team-night-load-is-read',
    law: 'A team night the athlete rated produces sRPE in the same unit as conditioning, and counts as a measured session. Both halves are stored; neither may be discarded.',
    ruledAt: 'docs/SEAT_INBOX.md item 6; measured in docs/EXPERIENCED_LOAD_MEASUREMENT_2026-08-12.md §6',
    guard: {
      state: 'guarded',
      by: 'test:journal-load',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. `TeamTrainingSessionOutcome` stores `effort` (1-10) AND `durationMinutes`, is written by the feedback panel and validated at the transaction boundary — and READ BY NOTHING. `journalLoad`\'s only sRPE reader took a `ConditioningPerformanceLog`. THIRD SIGHTING IN ONE DAY of a value computed and never consumed (`achievedModerateDayCount`, `canOverride`, this), which is the case for item 10\'s `LAW-computed-must-be-consumed`. THE ITEM\'S OWN PREMISE MOVED UNDER IT: the measurement that opened item 6 said conditioning stores both halves and strength stores none, and stopped there; re-measured after the 1-10 effort scale landed, THREE of four kinds have athlete-reported load and two of those three were being thrown away. Six cells: the product, both half-measurements refused, a non-team day, the carry into the session load, and the measured flag. Mutations: counting half a measurement reds two, dropping the team night from `measured` reds one. A GAME WAS DELIBERATELY NOT INCLUDED HERE and is now its own row — see LAW-game-load-is-full, ruled by Sam 2026-08-12 and guarded 2026-08-13.',
    },
  },
  {
    id: 'LAW-game-load-is-full',
    law: 'A game the athlete rated produces sRPE in the same unit as every other session — body RPE times minutes on the ground, counted FULL and never weighted — and counts as a measured session. Both halves are stored; a game missing either is UNMEASURED, never half-counted.',
    ruledAt: 'docs/SEAT_INBOX.md item 17, Sam 2026-08-12: "yes don\'t we do \'how long was your game?\' and multiply by game RPE for a score that counts toward load?"',
    guard: {
      state: 'guarded',
      by: 'test:journal-load',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-13, CLOSING THE QUESTION `LAW-team-night-load-is-read` LEFT OPEN — that row ends "A GAME IS DELIBERATELY NOT INCLUDED ... a coaching question nobody has ruled", and it is ruled now. FULL, NOT WEIGHTED, IS THE RULING AND NOT THIS FILE\'S CHOICE: Sam was given full / discounted / excluded and chose full, so no coefficient exists anywhere in the path and a cell asserts the product is exactly `bodyRpe x timeOnGroundMinutes`. Adding a weighting later is a Bible change, not a tweak. THE HALVES WERE ALREADY THERE: `SessionFeedbackPanel` collected the duration and the 1-10 body RPE, `parseGameSessionOutcome` validated both at the transaction boundary, and NOTHING read either — the same computed-and-unread shape as its team-night sibling. NINE CELLS: the product, the full-not-weighted pin, both half-measurements refused, a non-game day, the carry into the session load, the measured flag, a day carrying BOTH a game and a team night keeping two distinct numbers, and the PRODUCER — a source cell requiring `JournalScreen` actually hand the game to the load model, because a reader that stops at `deriveSessionLoad` recreates the exact defect item 10 exists to catch. MUTATION-CHECKED FOUR WAYS: half-counting a game with no minutes, a smuggled 0.5 discount, dropping the game from `measured`, and unwiring the producer each red their own cell. WHAT IT DOES NOT REACH, MEASURED NOT ASSUMED: `gameSRPE` stops at the session load and the `measured` flag, exactly as `teamTrainingSRPE` does — NEITHER is summed into `JournalLoadWeekTotals`, where only conditioning has a stream. So a rated game changes the week\'s MEASURED-session count and its own session row, and does not yet move a weekly load number. That gap belongs to item 6\'s open question about which measure "experienced load" SHOWS, and is Sam\'s.',
    },
  },
  {
    id: 'LAW-strength-load-is-actual-minutes',
    law: 'A strength session\'s experienced load is its 1-10 effort times the minutes it ACTUALLY took. Planned minutes are never substituted: a session missing either half is UNMEASURED.',
    ruledAt: 'docs/SEAT_INBOX.md item 18, Sam 2026-08-12: "i think do a for now and I will think of if thats good enough long term" — option (a), actual duration',
    guard: {
      state: 'guarded',
      by: 'test:journal-load',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-13, AND IT COMPLETES THE FOUR. With `LAW-game-load-is-full`, `LAW-team-night-load-is-read` and conditioning\'s existing cells, all four kinds of experienced load are now real functions — `conditioningSRPE`, `teamTrainingSRPE`, `gameSRPE`, `strengthSRPE` — which is the sentence item 6 had been reaching for since it was written, and a cell asserts it rather than announcing it. THE MEASURED GAP WAS ONE FIELD, NOT THREE: a strength session already asked "How hard was the session?" on the 1-10 slider and stored it as `difficulty`; ACTUAL MINUTES was the only missing half. OPTION (a) IS THE RULING AND (b) IS THE TRAP: Sam chose actual minutes over falling back to the planned value, so nothing back-fills `domain.ts`\'s planned number — that would make the column look complete when it is not, and the mutation that introduces a 60-minute default reds THREE cells. NOT SAVE-BLOCKING, ON PURPOSE: the ruling\'s own shape is that a session missing the answer is UNMEASURED, so a blank must not refuse the save and strand an athlete who did not time their lift. THE WORDS ARE SAM\'S: "Rough time in the gym", chosen by him 2026-08-13 from his own two existing lines, because the terminal does not invent athlete words; hours/minutes labels and the refusal are REUSED from the game copy rather than re-signed, so one word cannot disagree in three places. THE PERSISTENCE TRAP IS THE CELL THAT EARNS ITS KEEP: `buildSessionFeedbackPayload` REBUILDS its object, so a field it does not name is lost the moment the athlete edits an answer — the exact class that bit the team-night unit — so the field is asserted THROUGH the builder on the checklist path, plus absence-stays-absence and a zero-is-not-an-answer arm. MUTATION-CHECKED THREE WAYS: deleting the field from the payload builder, back-filling a default duration, and unwiring the journal producer each red their own cells. WHAT IT DOES NOT REACH: like its three siblings, `strengthSRPE` stops at the session load and the `measured` flag and is not summed into `JournalLoadWeekTotals`. No cell mounts the panel, so nothing here proves the athlete SEES the new input — that is a simulator pass, and Sam cannot device-test until he rebuilds his phone.',
    },
  },
  {
    id: 'LAW-shortfall-names-its-cause',
    law: 'A shortfall disclosure tells the athlete WHY the week is short and names the day belonging to that cause. A week squeezed by the club\'s fixture never says the athlete rested.',
    ruledAt: 'docs/SEAT_INBOX.md item 20 — Sam 2026-08-12 "yeah thats bad wording" plus his replacement sentence; fixture-only branch ruled by him 2026-08-13',
    guard: {
      state: 'guarded',
      by: 'test:shortfall-copy',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-13. ONE SENTENCE SERVED TWO CAUSES: `renderSection18Shortfall` had a single unconditional string, "Resting {day} means you\'ll miss {n} {type} session(s) this week", so a week the CLUB\'s draw squeezed blamed the athlete for it. Sam wrote the replacement himself and ruled FIXTURE-ONLY when asked whether it should cover both — the rest sentence survives untouched, digit and all, because it is honest when resting Friday is what he chose. THE ORDER DIAGNOSED ONE DEFECT AND MEASUREMENT FOUND THREE. The one production call site passed `date: weekStart`, so the sentence also named the WRONG DAY on every Monday-start week and ASSERTED A REST THAT MAY NEVER HAVE HAPPENED — confirmed by rendering it across three dates, not by reading. So `date` stopped meaning "the week" and became THE DAY BELONGING TO THE CAUSE: the game\'s day for `fixture`, the rested day for `athlete_rest`. `fits` is READ from the finding\'s own `actual` — Sam\'s sentence states what fits where the old one states what is missed — never by subtracting a target inside the renderer. THE ATHLETE\'S OWN CALENDAR MARKS ARE THE PRIMARY FACT, AND A REGRESSION TAUGHT ME THAT: a rest mark is `markedDays[date] === \'rest\'`, not a workout named Rest, so my first version read only the week\'s sessions, found no rested day and SILENCED the disclosure on exactly the case the accept-and-reduce ruling exists for. `acceptedStateTransactionTests` regression 3 caught it. The week\'s sessions remain the fallback for a fixture that arrived as a generated game. NO NEW PREDICATE: `classifyDaySessions` is asked what a game is, because two private copies of that test already exist and a third is the defect this repo keeps finding; `isoDateForWeekday` owns the dayOfWeek-to-date conversion. THIRTEEN CELLS, the copy equality-bound BOTH DIRECTIONS against `docs/SHORTFALL_DISCLOSURE_COPY_2026-07-29.md`, updated in the same commit. MUTATION-CHECKED SIX WAYS: restoring the week-start day, using Sam\'s sentence for both causes, reading `count` instead of `fits`, drifting the signed record, re-implementing the game predicate privately, and dropping the calendar marks each red their own cells. THE SIXTH CELL EXISTS BECAUSE A MUTATION SURVIVED WITHOUT IT — every pure cell stayed green while the wiring reverted, which is the reader-stops-at-the-rule class, so the TRANSACTION\'s own wiring is now asserted. WHAT IT DOES NOT HOLD: no cell mounts a surface, so nothing here proves the athlete SEES either sentence on a device; and a week with neither a game nor a rest mark now produces NO disclosure rather than one naming a day nobody chose — silence is the honest answer there, but it is a behaviour change and it is stated rather than implied.',
    },
  },
  {
    id: 'LAW-regate-carries-provenance',
    law: 'A week re-derived at commit time carries the provenance the proposal held — the still-valid records travel, the expired ones do not, and a day the re-derivation removed is never resurrected.',
    ruledAt: 'docs/FIXTURE_AUTHORITY_CENSUS_2026-08-12.md §11-§12; the same class as LAW-rename-carries-its-references, second sighting in one day',
    guard: {
      state: 'guarded',
      by: 'test:derived-repair-ownership + test:accepted-state-transactions',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12, AFTER FOUR ATTEMPTS AND TWO FULL MEASUREMENT PASSES. `canonicaliseAcceptedStateCandidate` re-gates every hydrated week and writes the gateway\'s re-derived day over the proposal\'s; the re-derivation carries no `derivedSessionProvenance`, so a cross-week dependency the proposal held was destroyed at commit time on every path that re-gates. MEASURED AT THE WRITE, BOTH ARMS: overlay Monday 2026-07-19 -> accepted Monday 2026-07-19 with the ±7 phantom present, and -> NONE without it. THE PHANTOM WAS THE ONLY THING HIDING IT. THE END-TO-END CELL is the fixture-move property, which fails without this carry once the phantom is gone; the two branches that property cannot reach have their own cells — a record whose fixture is gone must NOT travel, and a removed day must not be resurrected. VALIDITY IS ASKED, NEVER RE-ANSWERED: `buildDerivedSessionExpiryCandidates` owns it, and because candidates are ALTERNATIVES, a record any candidate would expire is not carried. TWO CORRECTIONS CAUGHT BY CELLS, NOT BY READING: the first filter keyed on `expiry.record.id`, a field that does not exist on a `DerivedSessionExpiry`, so NOTHING ever expired and a stale record travelled; and the first cell passed a two-field contract stub that died inside the expiry owner. Mutations: carrying nothing reds the cell AND the property; carrying everything reds the opposite-defect branch.',
    },
  },
  {
    id: 'LAW-no-invented-fixture',
    law: 'The craft tier reads the fixtures that exist; it never fabricates a neighbouring game at ±7 days, because the Section 17 kernel trusts what it is handed as real.',
    ruledAt: 'docs/SEAT_INBOX.md item 3, Sam 2026-08-12 ("kill the ±7 invention"); reproduced in docs/FIXTURE_AUTHORITY_CENSUS_2026-08-12.md',
    guard: {
      state: 'guarded',
      by: 'test:craft-tier',
      chainStatus: 'in_chain',
      receipt: 'LANDED 2026-08-12 ON THE FOURTH ATTEMPT, and only after the defect it was hiding was fixed (LAW-regate-carries-provenance). `section18CraftTier` fabricated `previousGameDate`/`nextGameDate` at ±7 days and `weekStructureValidator` trusts them as real: a Sunday-fixture week judged its Monday `g_plus1_hard_work`, a Monday-fixture week judged its Sunday `g1_not_light`, both against games that do not exist. The tier now reads a supplied `activeFixtureDates` — the authority the gateway already threads to the replan and the provenance rules — and falls back to ±7 ONLY with no authority, because an absent authority is not evidence of an absent fixture. 36/36 green, mutation-checked. SWEEP: 15 of 196 failures, IDENTICAL name for name to the HEAD baseline measured the same hour. The 17 QA scenarios are unchanged — no hard failures, no preference regressions, no improvements.',
    },
  },
  {
    id: 'LAW-rename-carries-its-references',
    law: 'A step that rewrites identities rewrites everything that points at them. Seed stabilisation may change ids; it may never change content.',
    ruledAt: 'src/dev/e2e/devE2ESeedRegistry.ts stabilizeMicrocycle header, 2026-08-12 — the founding case, measured rather than ruled: 23 of 23 seeded workouts carrying a conditioning block had lost it.',
    guard: {
      state: 'guarded',
      by: 'test:dev-e2e-seeds',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. FOUNDING CASE, AND IT WAS FOUND BY DRIVING A SEEDED APP, NOT BY READING CODE. `stabilizeMicrocycle` rewrites every exercise row id so a seed is reproducible; nothing rewrote `conditioningBlock.options[].exerciseIds`, so `conditioningIdsFromBlock` matched no row, the conditioning work was filed as strength, and `getSessionComponents` reported one component where the day had two. Measured: 23 of 23 seeded workouts with a block, EVERY seed — and the raw generated program measured CORRECT at the same time (4 of 4 blocks resolve), so no athlete was ever affected and no product code changed. THE FIRST READING OF THE SYMPTOM WAS WRONG and is withdrawn in the same commit: the day card was accused of not drawing what the day holds. THREE CELLS, one anti-vacuous (>= 20 seeded workouts must still carry a block, or "every id resolves" passes on nothing to resolve), one on the cause (ids resolve) and one on the consequence (the component survives) — asserting the id alone would pass on a classifier that had stopped reading the block. Mutation: dropping the rewrite while keeping the cells reds two of the three, and the anti-vacuous cell correctly stays green.',
    },
  },
  {
    id: 'LAW-generated-week-assembly',
    law: 'Adapter contributions are typed and enumerated. The composer day is always the base. No adapter field may overwrite a composer-owned field.',
    ruledAt: 'Sam, 2026-08-14, seat-drafted wording approved in the constrained-world authorisation; third sighting of the stripped-adapter class (docs/GENERATION_CORE_REBUILD_2026-08-14.md)',
    guard: {
      state: 'guarded',
      by: 'test:generated-week-assembly',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-14, AND IT IS THE THIRD SIGHTING OF ONE CLASS — which is why the guard is about the CLASS and not the field. The assembly step lost a different field each round and each fix was the field just noticed: (1) it copied ONE field and lost `speedBlock`, the app\'s only source of app sprint credit, and three sessions blamed an inert `section18Evidence` envelope for the resulting refusal; (2) it then took the adapter\'s WHOLE day as the base, and a day stripped of its lifts described itself as `Conditioning`/`optional_flush` — 12 worlds; (3) with identity pinned back the spread STILL decided which composer fields survived, so `composedGaps` — the typed record of what the athlete\'s kit cannot train — was dropped on every day that had an adapter counterpart. A SPREAD IS THE DEFECT: `adapterContributionFrom` now reads the adapter day down to 12 enumerated non-strength fields plus its non-strength rows, and `applyContribution` THROWS `AdapterOverreachError` if a contribution names any composer-owned key at all. MUTATION A: every one of the 10 composer-owned fields is attempted individually and all 10 are refused — catching `composedGaps` alone would have produced a fourth sighting with a fourth field. MUTATION B: dropping the adapter\'s `speedBlock` is visible in the assembled day, with a control asserting it IS carried when given, because without both halves the cell passes on a merge that never carried it. END-TO-END: typed kit gaps are traced composer -> materialiser -> assembly -> validated program -> BOOT REGENERATION and survive all five; the previous test stopped at materialisation, which is precisely the boundary where the loss did not happen. The 180-world sweep is unchanged at 120/60 with zero content differences, because this is a mechanism change and not a behaviour change.',
    },
  },
  {
    id: 'LAW-canonical-athlete-flows',
    law: 'There is a small permanent set of athlete flows — move a session, delete a session, preview and approve a repaired week, relaunch and prove persistence, clear or reverse an adjustment. A bug earns an assertion inside one of them, never a new throwaway flow.',
    ruledAt: 'docs/SEAT_INBOX.md item 0e(i), Sam 2026-08-12: "You do not need a brand-new temporary Maestro flow for every bug. Keep a handful of canonical athlete flows."',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12, AFTER A CENSUS THE ORDER DEMANDED FIRST. What the census found: `.maestro/` had a permanent flow for moving a GAME and NONE for moving a SESSION (action 1.5, the one an athlete does most); the deletion flow stopped at one part-scope; and the readiness flow opened both doors and pressed Cancel, so no flow had ever applied or reversed an adjustment. The explorer campaign covers session.move and session.delete but enters through `ExplorerActionIngressControl`, a 2x2px dev-only pressable whose `controlTestId` is a CLAIM about which real control corresponds — a different question from "the athlete\'s button works". Two flows built and green on the simulator (`session-move.yaml`, `readiness-adjust-and-clear.yaml`), one extended (`lower-body-deletion.yaml`, whole-day scope + relaunch). THE FIFTH HAS NO FILE ON PURPOSE: "preview and approve a repaired week" has no door — SUPPORTED_ATHLETE_ACTIONS 5.4 is DECIDED, NOT BUILT, and PlanChangeSheet applies then reports. The cell holds that every named flow is still on disk and that at most ONE canonical action is fileless, so the set cannot quietly drift back into a flow per bug. Mutation: hiding session-move.yaml reds it; the declared gap does not.',
    },
  },
  {
    id: 'LAW-memory-not-a-law-store',
    law: 'Auto memory holds environment and navigation — commands, env vars, which module owns what, simulator quirks. It never holds product law; that lives in the law registry or it does not exist.',
    ruledAt: 'docs/SEAT_INBOX.md item 0e(ii), Sam 2026-08-12, naming the trap: "i constantly give a fix and a law and believe you will remember and you never fucking do." Written into CLAUDE.md "WHAT COUNTS AS FINISHED".',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. PARTIAL BY CONSTRUCTION AND THE ROW SAYS SO: the memory store is machine-local and outside the repo, so no cell can read what is in it. What the cell holds is that the BAN and its destination are still written where every session reads them — the "NEVER product law" half and the registry pointer, both scoped to that paragraph. TWO CORRECTIONS DURING THE MUTATION RUN, both of the same family: the first version matched a HEADING (`/AUTO MEMORY/i`), so replacing the whole law with "Auto memory is handy." left it green; the second read the WHOLE SECTION for `lawRegistry.ts`, which the source-of-truth line four paragraphs up already names, so deleting the destination from the memory rule left it green too. Both are the vacuous-cell class this suite exists to catch, caught by mutating rather than by reading. Three mutations now kill it.',
    },
  },
  {
    id: 'LAW-one-startup-command',
    law: 'There is exactly ONE startup recipe — `npm run lfa:dev`, which is `scripts/qa-start.sh` — and it reaches a RUNNING app, not a booted simulator.',
    ruledAt: 'docs/SEAT_INBOX.md item 0d(ii), Sam 2026-08-12: the startup recipe "is rediscovered every session ... Do not leave several startup scripts or temporary variants behind — one."',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. The cell scans scripts/ for any OTHER file that starts the dev server (comments stripped — prose naming a command is not a use) and asserts npm run lfa:dev invokes the one script. Mutations: a fabricated scripts/tmp-rival-start.sh reds it; renaming lfa:dev reds it. SCOPE IS SCRIPT FILES, not npm scripts — `start`, `web` and `dev:coach-semantic-active` are one-line Expo passthroughs, not recipes, and a law that reddened on them would be switched off within a week. WHAT THE ORDER ASKED FOR THAT A CELL CANNOT HOLD: that the command reaches a running app. Proven by hand on 2026-08-12 — launched com.localfootyathlete.app on the booted simulator (pid 35161) and screenshotted the Profile screen.',
    },
  },

  // ── (b) THE COACH REBUILD LAWS ────────────────────────────────────────────
  {
    id: 'LAW-LC1-brain',
    law: 'The coach\'s knowledge IS the Bible plus Sam\'s recorded rules — it invents no coaching opinion of its own.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:21',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice2',
      chainStatus: 'in_chain',
      receipt: 'coachTabSlice1/2/3Tests all cite L-C1; slice 2 validates every reply against a frozen truth gate. PARTIAL: the gate is a PHRASE list, which cannot see an omission — see LAW-conservation.',
    },
  },
  {
    id: 'LAW-LC2-change-card',
    law: 'No coach mutation without the card — what changes, from what, to what and why, before the athlete\'s yes.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:32',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3',
      chainStatus: 'in_chain',
      receipt: 'coachProposal returns action and card together or neither, so "executable without a card" is unrepresentable; slice 3 asserts the pairing and that the card composes no string of its own.',
    },
  },
  {
    id: 'LAW-LC3-nike-bar',
    law: 'Interaction quality is a gate: no control hidden behind the keyboard, no dead tap zones.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:38',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3 section [6]',
      chainStatus: 'in_chain',
      receipt: 'SOURCE-ONLY, and the law is about GLASS. The .maestro/keyboard matrix that would measure it has NEVER EXECUTED. Treat this row as source-shape only until that flow runs.',
    },
  },
  {
    id: 'LAW-LC4-parity',
    law: 'The coach can do exactly what the athlete\'s own surfaces can do, and offers the same choices from the same owner.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:46; census docs/COACH_PARITY_CENSUS_2026-08-10.md',
    guard: {
      state: 'guarded',
      by: 'test:coach-tab-slice3 section [8]',
      chainStatus: 'in_chain',
      receipt: 'Added 2026-08-10 with census row 1: compares the coach\'s offered scope ids against the owner\'s list. Mutation-tested — blanking the owner read reds exactly four cells. COVERS ONE of 26 action types; the other 25 are UNENFORCED by construction.',
    },
  },

  // ── (c) THE LAWS CENTRAL TO THIS WEEK ─────────────────────────────────────
  {
    id: 'LAW-conservation',
    law: 'A pure Move or Swap conserves the multiset of athlete-owned session identities, and reporting success implies conservation.',
    ruledAt: 'src/__tests__/athleteMoveOccupiedContentLossTests.ts header; docs/audits/MOVE_OCCUPIED_CONTENT_LOSS_2026-07-23.md',
    guard: {
      state: 'guarded',
      by: 'test:athlete-move-occupied-content-loss',
      chainStatus: 'in_chain',
      receipt: 'CORRECTED 2026-08-10 BY PRICING, AND THE CORRECTION IS THE POINT OF THE REGISTRY. This row first read UNENFORCED, claiming the law had no door. It has one: `detectAthleteMoveContentLoss` (acceptedStateTransaction.ts:3338) runs on EVERY move including the absorb path, rolls back in-memory and throws `athlete_move_content_not_conserved`. The law is guarded AT SESSION IDENTITY and correctly passed the 2026-08-10 case — the surviving object was the combined day. See docs/CONSERVATION_POSTCONDITION_PRICING_2026-08-10.md. The row-level gap is NOT this law; it is LAW-attributed-content-change below.',
    },
  },
  {
    id: 'LAW-attributed-content-change',
    law: 'Content may only leave a session for a declared reason, and a change the athlete did not ask for is told to them.',
    ruledAt: 'Named 2026-08-10 by pricing the conservation order — docs/CONSERVATION_POSTCONDITION_PRICING_2026-08-10.md',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'RE-PRICED 2026-08-10 BY THE XS, AND THE ORDERED M WORK IS WITHDRAWN. Threading the canonicaliser\'s typed `actions` out through 73 call sites would NOT have caught the measured defect. What a guard would actually take is not yet known — the next probe is one line: read the destination day\'s STORED rows beside the projected ones.',
      receipt: 'THE ROW THE 2026-08-10 DEFECT ACTUALLY BELONGS TO. `power_removed` is typed and reasoned (workoutCanonicalisation.ts:526,573) with reasons like game_proximity_power_blocked:G-2, and NO athlete-facing surface reads it. BUT — MEASURED 2026-08-10, docs/POWER_REMOVAL_REASON_XS_2026-08-10.md — on the case that loses a row, NOT ONE PRODUCER FIRES: five probes (the §18 weekly budget, both canonicalisation pushes, both safety-finaliser pushes, the stack path, and a wrapper over the canonical entry itself) all counted ZERO. The row leaves WITHOUT PASSING THE CANONICAL OWNER. And the instrument that measured "8 rows in, 7 out" reads a PROJECTION, so whether the row was deleted at all is OPEN-UNKNOWN.',
    },
  },
  {
    id: 'LAW-do-not-lose-the-session',
    law: 'The Bible\'s Move rules: a session the athlete owns is never silently destroyed by a plan change.',
    // AUDITED 2026-08-10: ruledAt read "Training Bible, Move rules". THERE IS
    // NO SUCH SECTION. docs/LFA_PROGRAMMING_BIBLE.md carries move guidance as
    // prose bullets (moving game day, busy/away weeks) and no "Move rules"
    // heading exists in it. Second ghost citation found by this audit, after
    // LAW-totals-or-red's — and the first was on a GUARDED row.
    ruledAt: 'docs/LFA_PROGRAMMING_BIBLE.md move guidance (prose bullets, no "Move rules" heading); enforced in practice by docs/audits/MOVE_OCCUPIED_CONTENT_LOSS_2026-07-23.md',
    guard: {
      state: 'guarded',
      by: 'test:athlete-move-occupied-content-loss',
      chainStatus: 'in_chain',
      receipt: 'BOUND TO LAW-conservation\'s EXISTING GUARD 2026-08-11 because this row\'s subject is the athlete-owned SESSION identity, not every exercise row inside its projection. The suite runs the real move transaction and asserts both safe refusal at an occupied G-1 destination and a chained double-move in which the moved session identity survives exactly once and success is reported honestly. FIRST BINDING RUN: 2/2 invariants green. DISTINCTION KEPT RED: LAW-attributed-content-change separately governs exercise content leaving a surviving session without a declared reason or athlete-visible explanation; this guard does not claim that property.',
    },
  },
  {
    id: 'LAW-doc-truth',
    law: 'A "built" or "fixed" claim in any doc carries a code receipt, and a doc that outlives its subject is corrected.',
    // AUDITED 2026-08-10: ruledAt said "AGENTS.md doc-truth family", implying a
    // section. AGENTS.md mentions DOC-TRUTH exactly ONCE (line 297) and in
    // passing, inside another law. The ruling site is the seat handoff.
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_UNDO_COACH_ERA.md §2 "DOC-TRUTH LAW"; referenced once in AGENTS.md but never stated there',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A gate that resolves doc claims to named receipts — the same shape as test:copy-rulings-binding, which already does this for copy.',
      receipt: 'grep DOC-TRUTH across src/ returns ZERO files. Violated and repaired by hand this pass: the content-loss suite header still said "M2/M3/M4 are expected to FAIL" when the suite runs 2 cells, both PASS. — PRICED 2026-08-13 (item 13), SO NOBODY RE-DERIVES IT. The obvious gate is "every `test:<name>` and every `src/...` path a doc cites must exist". MEASURED over all 451 docs: 14 occurrences / 6 DISTINCT dead `test:` scripts, and 159 occurrences / 126 DISTINCT dead `src/` paths. **THE FIRST COUNT I TOOK WAS WRONG AND IS REPORTED WRONG-THEN-RIGHT RATHER THAN QUIETLY FIXED: 200/141, because the path regex alternated `(ts|tsx)` in that order and matched `.ts` inside `.tsx`, inventing 41 dead files that are alive.** THE GATE IS THEN REFUTED BY SCOPE, which is the finding: restricted to LIVING docs (the four standing files plus every doc the registry cites in `ruledAt` — 32 files) it is GREEN AND EMPTY — ZERO dead `test:` citations, and its only two dead paths are in `PUBLISH_ROADMAP_2026-08-05.md`, which names files it is proposing to BUILD, not claiming exist. **So every real violation sits in ARCHIVED docs, where the citation was true when written, and a gate forcing them green would rewrite history this repo deliberately keeps.** What is actually needed is narrower and is NOT a scan: a RENAME MAP, so that retiring a `test:` script either updates the docs that cite it or records the old name as retired — 6 distinct names is the whole standing debt. Until that exists this row stays UNENFORCED rather than wearing a gate that passes on 32 files and ignores 419.',
    },
  },
  {
    // ─────────────────────────────────────────────────────────────────────
    // RENAMED FROM `LAW-liveness` BY THE 2026-08-10 AUDIT. THE OLD ID IS
    // RETIRED AND MUST NEVER BE REUSED — it named one law and carried another.
    //
    // The seat caught this reading the twenty out to Sam: the row's text is the
    // GATE law, and `LAW-liveness` is the id of a DIFFERENT law — the terminal
    // one, now filed below as `LAW-terminal-is-stopped-after-a-report`, which
    // had NO ROW AT ALL. A registry that misfiles a law is worse than no
    // registry, because it reads as covered.
    //
    // AND THE CITATION WAS A GHOST TOO, which the seat did not catch and this
    // audit did: ruledAt read `AGENTS.md; memory law "A green gate is a claim"`.
    // **grep over AGENTS.md for "green gate is a claim" returns NOTHING.** The
    // law lives in this terminal's private memory index and in boundary reports
    // that cite it as ruled. Its nearest repo-side statement is L12, which is
    // adjacent but not the same claim. THIRD ghost citation of this audit.
    // ─────────────────────────────────────────────────────────────────────
    id: 'LAW-green-gate-is-a-claim',
    law: 'A green gate is a claim: a gate must be shown to fail when its subject breaks.',
    ruledAt: 'AGENTS.md "L12a — A GREEN GATE IS A CLAIM" — written down 2026-08-13, beside L12, whose other half it is. The row previously read "NOT STATED IN THE REPO … NEEDS A RULING SITE"; that precondition is now PAID.',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'STANDING MUTATION TESTING IN THE CHAIN — and the obvious cheap alternative is REFUTED, so nobody builds it twice. A per-suite "does this file carry a liveness arm" scan is satisfied by a COMMENT: the detector reads prose, so a suite could mention the word and pass while asserting nothing. That gate would BE the green-and-empty shape this law forbids, which makes it the one guard this law may not have. The honest mechanisation runs the chain, mutates a subject, and requires a named cell to die — infrastructure, not a cell, and it needs its own unit with a runtime budget.',
      receipt: 'MEASURED 2026-08-13: 21 of 200 chain suites contain any liveness or mutation arm. That is a real number rather than the earlier "one liveness check exists in the whole repo", which counted a narrower shape and predated a month of work. THE PRECONDITION IS PAID — the law now has a ruling site (AGENTS.md L12a) and can be audited against one; what remains is genuinely the hard half, and it is left UNENFORCED honestly rather than closed with a scan that could not fail. The law is nonetheless the most PRACTISED unenforced rule in the repo: every guard flipped on 2026-08-13 (L15 five mutations, LAW-game-load-is-full four, LAW-strength-load-is-actual-minutes three, LAW-shortfall-names-its-cause six, LAW-anchor-must-be-found three) was mutation-checked by hand, and one of those mutations SURVIVED and had to be told apart from a blind gate — which is the corollary now recorded in L12a.',
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // BATCH 2 — THE SWEEP FOR LAWS WITH NO ROW AT ALL (2026-08-10, item 000(A)).
  //
  // Sam: *"Report the new total and the new UNENFORCED count — the number
  // moving UP here is correct and expected, and is the last time it may."*
  //
  // Every row below was ruled somewhere and had NOTHING in this file. They are
  // grouped by where they were ruled, because that is what the audit read.
  // ══════════════════════════════════════════════════════════════════════════

  // ── THE LAW THE MISFILED ID WAS SUPPOSED TO NAME ──────────────────────────
  {
    id: 'LAW-terminal-is-stopped-after-a-report',
    law: 'Nobody claims a terminal is "working" without a commit or mtime receipt checked at the moment of speaking. (The turn-ending half of this law is SUPERSEDED — see below.)',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_UNDO_COACH_ERA.md §2 "LIVENESS LAW" (Sam-forced: "why would you fucking assume any are working"); restated docs/COWORK_SEAT_HANDOFF_2026-08-09_COACH_BUILD_ERA.md §0',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'AMENDED 2026-08-13, TWICE, AND BOTH HALVES OF THE OLD TEXT ARE NOW WRONG. (1) THE TURN-ENDING HALF IS SUPERSEDED BY SAM, verbatim: "when you\'re stuck on an item, move to the next item instead of stopping. Only stop when the whole list is blocked." A terminal no longer ends its turn at every report and is NOT stopped until someone types at it — the opposite is now the law (LAW-stop-needs-an-exit, rewritten the same day). Leaving that clause here would have made the registry contradict a live ruling, which is worse than leaving it unguarded. (2) THE PROPOSED GUARD FOR THE RECEIPT HALF IS REFUTED BY MEASUREMENT. This row said it was "guardable as a repo check over boundary reports and NOW.md". Scanned 2026-08-13 across NOW.md plus every BOUNDARY and STOP report — 75 files — for a claim that an agent is currently building/working/running: ZERO hits. A gate over that corpus would be GREEN AND EMPTY, passing on coordinates it never builds. AND THE SURFACE IS WRONG: the founding case was a claim made to Sam IN CHAT ("the terminal keeps building", twice, both windows idle 20 minutes). No repo test can read a chat message, so the place this law is actually broken is not gateable by this repo. WHAT WOULD ACTUALLY HOLD IT: a harness-level check at the moment of speaking, not a file scan — out of this repo\'s reach today. Recorded so nobody spends a pass building the vacuous version.',
      receipt: 'THE ROW THE SEAT CAUGHT MISSING. Born from the seat telling Sam "the terminal keeps building" twice while both windows had been idle for 20 minutes. Nothing in src/ or scripts/ reads a liveness receipt.',
    },
  },

  // ── THE NORTH STAR. IT HAD NO ROW, WHICH IS THE WORST ABSENCE ON THE SHEET ─
  {
    id: 'LAW-north-star',
    law: 'Store only decisions; derive everything else. New stored state that is not an input is presumed wrong.',
    ruledAt: 'docs/NORTH_STAR.md:11; CLAUDE.md requires it read FIRST',
    guard: {
      state: 'guarded',
      by: 'test:persisted-inputs-schema',
      chainStatus: 'in_chain',
      receipt: 'BOUND TO THE EXISTING DISK-LEVEL GUARD 2026-08-11. The suite generates a fresh install, flushes real storage writes, enumerates every dotted key that actually reaches disk, and requires each one to be classified as profile / fact / decision / result or carried on a dated shrink-only debt list. It is two-directional: an undeclared stored key reds, and a declaration whose key no longer exists reds so it cannot pre-bless a later reintroduction. FIRST BINDING RUN: 12 storage envelopes, 27 persisted keys; 12 declared inputs and 16 carried debt entries (13 coach-era, 2 transient, 1 unregistered); 8/8 cells green. WHAT IT DOES NOT CLAIM: the 16 debts are not inputs and remain red distance to the north-star property; the guard prevents silent growth and does not itself decide that a newly proposed classification is legitimate.',
    },
  },

  // ── PROCESS LAW L1–L10 (docs/MASTER_PLAN_2026-07-23.md PART 1) ────────────
  // Ten laws with the same force as L11–L16, and not one of them had a row.
  // Batch 1 harvested L11–L16 from AGENTS.md and stopped where AGENTS.md
  // stopped — AGENTS.md line 433 says L1–L10 live in the master plan, which
  // nobody followed. The registry inherited its predecessor's horizon.
  {
    id: 'LAW-L1-whole-app-scope',
    law: 'The test surface is the entire app as a new athlete meets it, not the unit under change.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L1',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Nothing mechanical scopes a sweep. Closest honest guard: require the walker (test:action-walker) to reach every athlete-facing door, which is the L13 shape one axis out.',
      receipt: 'No test:* script names whole-app scope. L13 is guarded and is a different claim (accumulated state, not full surface).',
    },
  },
  {
    id: 'LAW-L2-not-covered-section',
    law: 'Every report, sweep and audit carries a NOT-COVERED section; omitting it is itself a defect.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L2',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 over all 39 docs/*BOUNDARY*.md. Distinct from LAW-not-covered-real-data-blocks, which governs what a NOT-COVERED item MEANS; this one governs whether the section exists at all. FIRST RUN FOUND TWO REAL VIOLATIONS — R53_FIXTURE_BOOT_ORDER_BOUNDARY_2026-08-06.md and V3_BOUNDARY_BANKED_2026-08-07.md — carried as a NAMED, DATED exception list with a RATCHET cell: a doc leaves the list by gaining its section and nothing may join it.',
    },
  },
  {
    id: 'LAW-L3-cold-start',
    law: 'Every device sweep and the final QA include a cold-start pass.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L3',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A Maestro flow that kills and relaunches, in the rig that runs per sweep. Blocked today by the same simulator-binary blocker as everything else needing glass.',
      receipt: 'test:quiescent-boot and test:worn-world-boot are in the chain and cover BOOT logic in-process; neither is a cold start on a device.',
    },
  },
  {
    id: 'LAW-L4-device-is-arbiter',
    law: 'The device is the arbiter — a claim about athlete-facing behaviour is settled on the phone, not in a suite.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L4',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED ONTO THE DOC SURFACE AND GUARDED, Sam 2026-08-10. He ruled the re-wording himself: "nothing may be written as done/working for an athlete-visible behaviour without a device or simulator receipt". The literal law says a CELL is not the arbiter, so no cell could hold it; the doc form is what the law actually protects and it is checkable today. Held with LAW-L10-phone-is-done by one section — the two are the same rule from either end.',
    },
  },
  {
    id: 'LAW-L5-no-dead-affordances',
    law: 'Every visible control either works or does not ship.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L5',
    guard: {
      state: 'guarded',
      by: 'test:dead-affordances',
      chainStatus: 'in_chain',
      receipt: 'GUARDED 2026-08-12, ON ONE SHAPE OF THE LAW, AND THE LIMIT IS THE FIRST THING THIS RECEIPT SAYS. THE FULL INSTRUMENT IS STILL NOT BUILT: the old row asked for "a walker pass that taps every reachable control and asserts a state change or an explicit refusal", and that remains true and unbuilt. WHAT IS HELD IS THE DECIDABLE SHAPE — a control whose press PROVABLY does nothing (`onPress={() => {}}`, `onPress={undefined}`) and a control that is PERMANENTLY disabled (`disabled={true}`, a literal no state can re-enable). No intent, no heuristics: an empty arrow body is empty in every world. WHY THIS LAW, THIS DAY: two founding cases landed in one session. My Status shipped SEVEN controls that looked live and did nothing, under a caption pointing at a screen that no longer showed them; and a refused plan change shipped ONE button labelled `OK` while the finding underneath already said the athlete could proceed. Both are fixed (`8de98d3f`, `ca33206f`) and NEITHER was caught by anything. AN ALLOW-LIST, NOT A BAN, AND THE MEASUREMENT IS WHY: both `onPress={() => {}}` in the tree today are CORRECT — a Pressable wrapping modal content so a tap does not reach the dismiss layer behind it is a SHIELD, not an affordance, and a dev panel is not shipped. Banning the shape would force a worse workaround, so a no-op press must DECLARE ITSELF with a reason, and adding a line is a claim that has to survive being written next to the law it excepts. The list ratchets both ways: an undeclared inert press reds, and a declaration for a file that no longer has one reds too, because a stale exemption reads as precedent. `disabled={notYet}` — a VARIABLE — is deliberately allowed: that is the legitimate shape My Status used while its caption explained it. MUTATION-CHECKED THREE WAYS on a real screen: a dead press, a literal-disabled control, and a stale exemption each red their own cell, plus a liveness arm over both detectors in both directions. WHAT IT STILL CANNOT SEE: a control wired to a handler that silently returns, a control behind a condition that is never true, and anything about whether the state change the athlete expected actually happened — that last one is `LAW-L6-honest-actions`, still UNENFORCED.',
    },
  },
  {
    id: 'LAW-L6-honest-actions',
    law: 'Any tap that reports or implies success must have actually succeeded.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L6',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'This is the general form of the 2026-08-10 defect ("Done. Session moved." beside a deleted row) and of LAW-attributed-content-change. ONE structural check could hold both: every success message is derived FROM the applied transaction rather than composed beside it.',
      receipt: 'test:coach-failure-copy and the coach truth gate are in the chain and read a PHRASE list, which cannot see an omission. THE COLLAPSE CANDIDATE — see LAW-attributed-content-change and LAW-do-not-lose-the-session.',
    },
  },
  {
    id: 'LAW-L7-sam-gates',
    law: 'Programming and coaching content and product semantics are Sam\'s to gate, never the terminal\'s.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L7',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'The signed-copy registry is this law\'s mechanism for WORDS and it is already gated. The unguarded half is content and semantics — guardable the same way: a locked list with provenance, which test:locked-list and test:exercise-name-lock already do for exercise names.',
      receipt: 'PARTIAL by construction: test:signed-copy-extraction, test:copy-rulings-binding, test:locked-list and test:exercise-name-lock each gate one slice of Sam\'s authority. No row claimed the law itself.',
    },
  },
  {
    id: 'LAW-L8-reporting-calibration',
    law: 'Estimates come with the previous item\'s actual, so a forecast is calibrated rather than hoped.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L8',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 (Agent: laws) TO THE PRESCRIPTION IN THIS ROW ITSELF - a repo check over boundary reports, an estimate must appear beside a measured prior. IT NEEDS NO DEBT LIST AND THAT IS A MEASUREMENT, NOT LUCK: four reports in all of docs/ state an estimate and ALL FOUR already cite a measured prior, so the law is being FOLLOWED and the gate stops it lapsing. Every other ratchet in this suite carries dated debt because its law was being broken when the gate arrived; a debt list added here for symmetry would invent forgiveness nobody needs. SCOPE IS ALL OF docs/, not from-a-cutoff, for the same reason - there is nothing to grandfather, and a report enters scope only by CLAIMING an estimate, so one that forecasts nothing can never trip it. NON-VACUITY IS ASSERTED: the cell reds if NO report forecasts at all, because a world with no estimates would otherwise report a comfortable zero. MUTATION-CHECKED: neutering the measured-prior test reds a cell. WHAT IT CANNOT DO: it reads that a prior actual is PRESENT, never whether the forecast was calibrated against the right one.',
    },
  },
  {
    id: 'LAW-L9-checkpoint-discipline',
    law: 'Tests first; staged commits; a fresh session starts from the checkpoint file.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L9',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A repo check that docs/NOW.md moved in any commit range that touched src/ — the checkpoint half is the mechanisable one.',
      receipt: 'AGENTS.md "Seat coordination laws" states the NOW FILE rule and nothing reads it. NOW.md has drifted behind HEAD before.',
    },
  },
  {
    id: 'LAW-L10-phone-is-done',
    law: 'Sam\'s phone is the definition of done — no athlete-facing fix is finished until he has seen it.',
    ruledAt: 'AGENTS.md "PROCESS LAW — L1 to L10" (lifted verbatim 2026-08-10 from the retired docs/MASTER_PLAN PART 1), L10',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED AND GUARDED, Sam 2026-08-10, with LAW-L4-device-is-arbiter — one section holds both. A Sam-facing block in docs/NOW.md that claims an athlete-visible thing is done/fixed/working must carry a device or simulator receipt, or say NOT ON GLASS / UNSEEN. Its founding case is this week: three claims carried NOT-ON-GLASS only by the author\'s care.',
    },
  },

  // ── THE SEAT'S OWN LAWS (the handoffs). Every one had no row. ─────────────
  {
    id: 'LAW-do-as-instructed',
    law: 'When Sam gives an instruction, do it as given; push back ONCE, in one line, only if it will actually break something — then do as he said unless he changes it.',
    ruledAt: 'Sam 2026-08-10, from "why can\'t we ever be on the same page? seriously, tell me"; AGENTS.md "Seat coordination laws"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 WITH the law. Guards the only half that touches the repo: an ORDER in the inbox that re-scopes an instruction must QUOTE the words used. **Silent re-scoping is the defect; disagreeing out loud is allowed.** The measured pattern, all in one day: "it\'s a tweak" answered with why it was bigger; "delete them" answered with a banner plus a check; "every law guarded" answered with a ranked shortlist; "parity" answered with a kind-by-kind slice plan — four times an instruction came back re-shaped and each cost Sam a message to drag it back. THE CELL WAS TOO BROAD ON ITS FIRST RUN and flagged four blocks that were terminal REPORTS using "superseded" descriptively — the word, not the act — so it is scoped to orders, which is what the law says.',
    },
  },
  {
    id: 'LAW-one-plan',
    law: 'Exactly one document presents itself as the plan; every superseded plan says so in its opening lines, and no release gate sends a reader to a retired one.',
    ruledAt: 'Seat 2026-08-10 (item 1b), after Sam was told three different things were the plan; governing sequence is docs/PUBLISH_ROADMAP_2026-08-05.md',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 WITH the law, as LAW ZERO now requires of anything new. Two of three plan docs carried NO supersession marker — grep for "supersed" over V1_LAUNCH_DEFINITION returned nothing — and a retired plan that does not say so is indistinguishable from the live one. The marker must sit in the opening lines: one buried on line 40 is one nobody reads before planning from the file, and that has its own liveness probe. THE GATE FOUND A SECOND LIVE POINTER THE AUDIT MISSED — FINAL_QA_CHECKLIST.md:278, a checkbox line sending the reader to the superseded definition, beyond the one at :20 the order named.',
    },
  },
  {
    id: 'LAW-bible-first',
    law: 'No coaching question reaches Sam without grepping the Bible and the ruling docs first.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 ("well der - thats the whole point of a fkn bible")',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'HALF OF THIS IS NOW BUILT AND THE ROW MUST STOP SAYING OTHERWISE (desktop, 2026-08-13). The old text read "guardable ONCE a registry with a chain gate exists" — it exists: docs/RULINGS_REGISTRY.md, 77 rows, gated by test:ruling-registry [3], in chain, which GREPS the registry and reds when a question to Sam hits a ruling whose R-nnn it does not cite. STILL UNENFORCED, and the remaining gap is NARROWER AND DIFFERENT from what this row used to describe: the gate covers the RULING DOCS half only. The BIBLE half has no reader, and the registry\'s own header says its seeding is incomplete — so a Bible-answerable question with no row still reaches him unchallenged. What is left: extend the same matcher over the Bible, or finish the seeding so every Bible-answerable rule has a row.',
      receipt: 'AGENTS.md LAW ZERO names this law\'s failure as its own founding case (sighting 3 of law-rediscovered-instead-of-enforced). THE "no script reads it" HALF IS NOW FALSE: test:ruling-registry [3] reads it and BITES — measured first-hand on 2026-08-13, when it caught the desktop twice, once on a question left open under AWAITING SAM after Sam had already ruled it (R-075), and once on a matcher fault the desktop\'s own ruling had introduced. A gate that has caught its own author is a live gate, not a claim.',
    },
  },
  {
    id: 'LAW-rule-dont-ask',
    law: 'A question reaches Sam only when no recorded law, ruling, Bible line or ledger instinct answers it; if the laws answer even partially, rule it and cite the law.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 (Sam 2026-08-06)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED AND GUARDED, Sam 2026-08-10: "any question put to Sam carries a receipt that the Bible and ruling docs were searched first". The surface is the STOP reports\' blocked-on-Sam sections, which is where questions actually reach him. A blocking item with no cited doc, Bible line, registry id or verified-marker reds.',
    },
  },
  {
    id: 'LAW-batch-rule',
    law: 'Signings are held and handed over as ONE batch; the chain toll runs once per batch, never once per sentence.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 "BATCH RULE"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'REFUTED 2026-08-10: the row said \'the sheet is already machine-readable, so this is cheap\'. **`src/rules/signedCopy.ts` HAS NO BATCH FIELD — grep for `batch:` returns ZERO.** Batch numbers live in prose in the boundary reports, so a guard would first have to put them in the sheet. Not cheap, and priced honestly rather than left looking cheap.',
      receipt: 'test:signed-copy-extraction is in the chain and gates whether strings are signed, not whether signings were batched.',
    },
  },
  {
    id: 'LAW-visible-first',
    law: 'Every unit ends athlete-visible on Sam\'s phone; a slice that ships nothing he can see is not a slice.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 (standing direction Sam ruled); docs/SHELL_REBUILD_RULING_2026-08-05.md:25',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 to the shape this row\'s own `wouldTake` named: a unit\'s boundary report must say what the athlete can see, or say NOT-VISIBLE and why. THREE CELLS in `test:repo-law-guards` over 74 boundary/STOP reports. SAYING "NOT-VISIBLE" IS COMPLIANCE, NOT A LOOPHOLE — plenty of units are engine-only and the law itself offers that exit; what it forbids is SILENCE, a report that never raises the question. MEASURED BEFORE BUILDING: 64 of 74 already complied, so the ten that do not are DECLARED DEBT on the same ratchet as NOT-COVERED and LOOP CHECK — the list may only SHRINK, and a compliant file left in it reds. THREE MUTANTS KILLED: a checker that matches everything reds the liveness cell; dropping a real exception reds the main cell; declaring a COMPLIANT file as debt reds the ratchet. THE LIVENESS CELL RUNS BOTH WAYS — it requires a fabricated silent report to be CAUGHT and a fabricated NOT-VISIBLE report to PASS, because a checker that flagged everything would be as useless as one that flagged nothing. WHAT IT DOES NOT HOLD: it reads DOCS, not glass. It cannot tell whether the sentence a report names was ever true on a phone — that is `LAW-L11-matrix-before-phone`\'s job and it remains UNENFORCED. AND MY OWN MUTATION HARNESS LIED ONCE: it reported the third mutant SURVIVED; run directly, that mutant reds the ratchet cell. The instrument was wrong, not the cell — a-control-red-belongs-to-the-instrument. COLLAPSE CANDIDATE with LAW-L16-vertical-slice and LAW-L10-phone-is-done. No script reads any of the three.',
    },
  },
  {
    id: 'LAW-plain-coach-english',
    law: 'Everything said to Sam is plain coach English — a report that says "L-P6 invariant" says nothing he can act on.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'RE-WORDED AND GUARDED, Sam 2026-08-10, and his re-wording is better than the seat\'s: "it is APP WORDING, and wording already has a register" — signedCopy.ts. So the check is a jargon list over the athlete-facing SIGNED strings, not over chat. Every word the athlete reads already passes through one register; this makes that register refuse engineering vocabulary.',
    },
  },
  {
    id: 'LAW-sam-chat-simplicity',
    // RE-SCOPED 2026-08-10. It governed the SEAT's replies; Sam's process ruling
    // removed the seat from the relay, so the terminal now writes straight to
    // him. The row widens to ANYTHING anyone writes for Sam to read.
    // SCOPE LINE ADDED 2026-08-10, resolving an apparent clash with
    // LAW-claim-needs-a-cell. They were never for the same reader: this row is
    // SAM-SCOPED, that one is REPO-SCOPED. Plain words carry a claim's status
    // for a human exactly as a token does for a script, so neither weakens.
    law: 'SAM-SCOPED. Anything written for Sam to read is three parts at most — WHAT HAPPENED / WHAT\'S NEXT / WHAT TO SEND — with no jargon, file names, commit ids or test names, and status said in PLAIN WORDS ("not proven yet", "not seen on your phone") rather than in tags. The depth moves to the repo docs; it does not disappear.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_COACH_BUILD_ERA.md §0 "SAM CHAT RULE" (Sam-forced); CLAUDE.md "HOW TO WRITE TO SAM"; re-scoped 2026-08-10',
    guard: {
      state: 'guarded',
      by: 'Sam',
      chainStatus: 'human',
      humanGuard: 'Sam',
      receipt: 'TWO FOUNDING CASES, RECORDED SO THE ROW IS NOT READ AS THEORETICAL — both Sam, 2026-08-10, both the red firing: "what the fuck is this? i don\'t even know what some of that shit is", and "what do you even mean?" over the law list. THE NAMED HUMAN INSTRUMENT — Sam ruled this shape into existence 2026-08-10 for this row and, he said, for this row ONLY. Chat never reaches the repo, so no script can ever see it; "held by discipline" was the honest description and it is also the loophole he banned the same morning, being UNENFORCED wearing a nicer word. So: HE is the guard, named, and him having to pull the seat up on it IS the red. Two states preserved — guarded, by a guard that is not a script. The gate refuses this shape for any id outside HUMAN_GUARDABLE_LAW_IDS, so it cannot spread.',
    },
  },
  {
    id: 'LAW-judgment-ledger',
    law: 'When Sam repeats a product instinct, his recorded call is the default path — stop and take it.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §1 "JUDGMENT LEDGER"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A repo check that the judgment-ledger doc exists, is appended to when a strategic call is recorded, and is cited by any boundary report that overrides one.',
      receipt: 'PROCESS law. The ledger is a memory file, not a repo file — which is itself the finding: an instinct nobody can grep is an instinct that gets overruled by accident.',
    },
  },
  {
    id: 'LAW-mock-first',
    law: 'Any new surface is mocked and shown to Sam before it is built.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-09_UNDO_COACH_ERA.md §2 "MOCK-FIRST IS LAW"',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'A repo check: a commit adding a new screen/tab must be preceded by a mock artefact referenced in its unit doc. Mechanisable, and the founding case is expensive — the journal died after ten slices of surface outran design.',
      receipt: 'No script reads it. The undo toast and the coach tab both honoured it by hand.',
    },
  },
  {
    id: 'LAW-loop-check-line',
    law: 'Every seat order and boundary report OPENS with "LOOP CHECK: <shape> — sighting N — iterate or compress". No line, no valid order.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §6 "FORMAT LAW 2026-08-07" (Sam-forced)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. Every boundary report dated on or after the FORMAT LAW (2026-08-07) must open with a LOOP CHECK line. **ITS FIRST RUN IS AN INDICTMENT OF THE LAW IT GUARDS: of 27 reports written UNDER the law, 21 CARRY NO LINE.** The law was written on 2026-08-07 with the founding sentence \'reminders don\'t execute\', and then 78% of the reports written under it ignored it — which is the registry\'s whole thesis, arriving in the law that exists to prevent exactly this. The 21 are NAMED, DATED debt with a ratchet cell; reports predating the law are out of scope. Mutation: stripping the line from COMPOUND_BUCKET_BOUNDARY_2026-08-08.md reds this cell and only it.',
    },
  },
  {
    id: 'LAW-no-completeness-claims',
    law: 'Never assert completeness about work not yet measured; status is MEASURED-DONE (cite the run), ATTRIBUTED-NOT-FIXED (cite the doc), or OPEN-UNKNOWN.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §7 (Sam-forced, third sighting)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 (Agent: laws) TO THE PRESCRIPTION IN THIS ROW ITSELF, which asked for a vocabulary gate over reports and NOW.md forbidding completeness words unless beside a cited run. 60 reports scanned (every *BOUNDARY*.md plus NOW.md). A completeness phrase is legal ONLY when a run is cited within two lines - a test: script name or a pass/fail count - which is the MEASURED-DONE form the law names. 3 pre-existing violations are carried as DATED DEBT rather than forgiven by weakening the phrase list. MUTATION-CHECKED: neutering the phrase test reds a cell. LIVENESS: a bare claim reds, a cited claim passes, and the word final in ordinary prose is NOT pulled in - the list is phrases, not words. WHAT IT DOES NOT DO, and this row said so first: a phrase list cannot catch a completeness claim phrased a new way. That is a ceiling on what it proves, not a defect in it.',
    },
  },
  {
    id: 'LAW-second-wall',
    law: 'When the same SHAPE of wall is hit twice, an elegant alternative goes on the table before a third attempt down the same path.',
    ruledAt: 'docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §8 "SECOND-WALL LAW" (Sam-ordered)',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10 AS PART OF THE LOOP-CHECK COLLAPSE — three laws, one cell, which is the answer to Sam\'s \'49 guards is 49 more things to maintain\'. The row\'s own proposed re-wording is what shipped: the LOOP CHECK line already carries `sighting N`, so a report at N>=2 must state its DISPOSITION. **CORRECTED ON ITS FIRST RUN:** the cell demanded an alternative and flagged COACH_SLICE1_BOUNDARY, whose line reads \'sighting 2 — iterate, and it paid before any code was written\'. A LOOP CHECK reports repeated WALLS (compress) and practices that PAY (iterate); the FORMAT LAW\'s own template is \'iterate or compress\'. **A cell stricter than the law it guards produces reds nobody can act on and gets turned off.** PARTIAL by construction: it holds that a disposition is STATED, not that the alternative offered is a good one.',
    },
  },
  {
    id: 'LAW-loop-audit',
    law: 'Third sighting of any repeated ruling-shape, round-trip, toll or rediscovery is a mandatory compression proposal, never a fourth silent run.',
    ruledAt: 'docs/SEAT_LOOP_AUDIT_LAW_2026-08-07.md; AGENTS.md §1b reference; Sam 2026-08-07',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10, same cell as LAW-second-wall — the two differ only in what they count (N>=2 for a repeated wall, N>=3 for a repeated ruling-shape/toll/rediscovery) and both read the number the LOOP CHECK line already carries. PARTIAL by construction: the cell holds that a disposition is stated at a repeat sighting, not that the compression proposed is the right one. Its founding case was a ruling that took NINE stops to exist.',
    },
  },
  {
    id: 'LAW-sweep-not-serial',
    law: 'Probe a class by sweeping it, not by serialising one probe at a time.',
    ruledAt: 'Referenced as "the sweep rule" in docs/COWORK_SEAT_HANDOFF_2026-08-06_REBUILD_ERA.md §6; the instrument is scripts/sweep.sh. NO RULING DOC FOUND — this law is cited by its violations and never stated.',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'Write the law down first. A law whose only appearance in the repo is other laws referring to it cannot be guarded, and this audit could not find where it was ruled.',
      receipt: 'FOURTH GHOST CITATION OF THIS AUDIT, and the worst kind: §6 cites "the sweep rule" as already existing and describes its own violation of it. grep finds no statement of the rule anywhere.',
    },
  },
  {
    id: 'LAW-LR6-coach-pipeline-frozen',
    law: 'The beta coach pipeline and CoachScreen are FROZEN — no coach-pipeline work lands on them; UI-surface changes only.',
    ruledAt: 'src/navigation/AppNavigator.tsx:206 ("LR-6 HOLDS"); docs/LEGACY_RECKONING_CENSUS_2026-07-30.md; standing since 2026-07-30',
    guard: {
      state: 'guarded',
      by: 'test:coach-entry-surface',
      chainStatus: 'in_chain',
      receipt: 'REGISTERED 2026-08-10 BY THE DELETION CENSUS, AND IT IS ABOUT TO BE RETIRED — which is the point of registering it. coachEntrySurfaceContractTests section [3] asserts every pipeline symbol CoachScreen owned is still named there, so the suite\'s job is to FAIL when the frozen tree is cut. Sam ruled the cut on 2026-08-10 ("delete all the old coach shit then? obviously!!!"), which supersedes LR-6. **The row exists so the supersession is a RECORDED EVENT rather than a silent guard deletion.** grep LR-6 over this file returned ZERO before this row — a live standing rule with a chain gate and no row, which is LAW ZERO\'s blind spot from the other side: the registry finds laws with no guard, and nothing yet finds GUARDS WITH NO LAW. See docs/FROZEN_COACH_CUT_CENSUS_2026-08-10.md.',
    },
  },
  {
    id: 'LAW-census-before-retirement',
    law: 'Nothing is retired until it has been censused — you count what a deletion takes with it before deleting.',
    ruledAt: 'docs/COACH_REBUILD_KICKOFF_2026-08-09.md:101; practised in docs/LEGACY_RECKONING_* and the R5 deletion reckoning',
    guard: {
      state: 'guarded',
      by: 'test:census-hook',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13 by the `audit` seat, and its founding case was four hours old at the time. `b62add9f` is titled "test(away): THE +1 IS c69151d9, MEASURED" and its body ends "Comment only; no assertion changed." Its actual stat is 37 files changed, +698/-3421, with FIVE tracked files deleted — including `.githooks/pre-commit` and `verify-branch-before-commit.sh`, this guard\'s own siblings, plus `src/rules/sessionSlotCoverage.ts` (-207) and its 223-line suite. It stood on `main` for ELEVEN COMMITS. Nobody lied; the author believed it. NOTHING IN THIS REPO READ A COMMIT\'S SUMMARY OF ITSELF AGAINST ITS OWN STAT, so a plausible subject bought total trust while `git show --stat` would have refuted it in one second. `scripts/announce-deletions-before-commit.sh` now runs at EVERY commit via `core.hooksPath .githooks`, and prints the deleted file count, the file names and the lines removed — the census the law demands, taken automatically, in the one place the author is guaranteed to look at the one moment they can still act. IT ANNOUNCES AND NEVER REFUSES, AND THAT IS THE LOAD-BEARING DECISION: a legitimate deletion is COMMON here (archiving docs, retiring a dead module, removing a superseded suite), so a wall would refuse honest work several times a day and be disabled within the hour — at which point the law reads guarded and is not. Every path exits 0. FOURTEEN CELLS, and the must-STAY-QUIET half is the important one for a repo-wide hook: modify-only, add-only, empty stage and outside-a-repo are all silent, because a hook that shouts on every commit is one an annoyed agent removes. TWO MUTANTS KILLED: reading the WORKING tree instead of the staged tree reds 8 cells (including the shared-checkout cell that proves an unstaged deletion by ANOTHER session is not smeared onto your census), and counting FILES where it counts LINES reds 2 — LAW-count-names-instrument, sighted five times on the day this was written and once inside this very guard. EXTENDED THE SAME DAY, BECAUSE THE FIRST CUT WOULD NOT HAVE CAUGHT EITHER OF THE TWO WORST EVENTS OF 2026-08-13: in both the FILE SURVIVED and only its CONTENTS died. `b62add9f` removed 3,421 lines under "comment only", and a regex lookahead written by this seat deleted SIX ORDERS (720 lines) from `SEAT_INBOX.md`, which a DIFFERENT SEAT then swept into its own commit under an unrelated subject. THREE SEATS HAD AN ABSORPTION INCIDENT IN ONE DAY, every one from a read that went stale between looking and staging, so the shape is not "deletion" but A COMMIT WHOSE SIZE ITS AUTHOR WOULD NOT RECOGNISE. The hook now also announces per-file line loss in MODIFIED files above `LFA_CENSUS_LINE_FLOOR` (default 200). THE FLOOR IS DELIBERATELY HIGH: archiving a doc, retiring a suite and splitting a module all remove hundreds of lines legitimately and often, and a number low enough to catch every accident is one people learn to scroll past — a hook that is scrolled past is UNENFORCED wearing a green badge. NINETEEN CELLS; TWO FURTHER MUTANTS KILLED — watching deleted files instead of modified reds 3, and hard-coding the floor reds the cell proving it is read from the environment. WHAT IT DOES NOT HOLD: `core.hooksPath` is per-clone machine config, so the hook is TRACKED but its installation is not; and it censuses the DELETION, never the reachability — the founding CoachScreen.tsx save (40 modules / 41,220 lines unreachable, 46% over the name-scan estimate, 8 of them not named *coach*) still needs `test:legacy-census`, which remains the only thing measuring what a deletion takes with it TRANSITIVELY.',
    },
  },
  {
    id: 'LAW-standing-derivation',
    law: 'When measurement finds a stored representation feeding a computation, the ruling is pre-given: derive it and retire the stored copy — no seat round-trip.',
    ruledAt: 'docs/STANDING_DERIVATION_RULING_2026-08-07.md (Sam: "why can\'t we just tell it that if it\'s always the bug?")',
    guard: {
      state: 'UNENFORCED',
      wouldTake: 'This is LAW-north-star\'s operational half; the same persisted-key ratchet would hold both. Its three STOP conditions (classification uncertain, etc.) are what a guard must not flatten.',
      receipt: 'COLLAPSE CANDIDATE with LAW-north-star. Ordered into existence after the same ruling took NINE stops to be made — the loop-audit law\'s founding case.',
    },
  },
  {
    id: 'LAW-no-order-hidden-from-the-stop-hook',
    law: 'No seat order may be written where the stop hook cannot see it: the unprocessed region carries no `## ` heading before its terminator, so sub-headings are `###`.',
    ruledAt: 'docs/SEAT_INBOX.md 2026-08-12 ("SYSTEMIC FIX OWED (not yet built): a guard cell that reds when a `## ` heading between `## Unprocessed` and `## SAFE FOR A PARALLEL AGENT` contains order-shaped content"); scripts/seat-inbox-hook.sh header',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12, AND THE FOUNDING CASE WAS THE TERMINAL\'S OWN. `seat-inbox-hook.sh` bounds its scan at the next `## `, so a `## ` heading written INSIDE the unprocessed region truncates the scan and every order below it goes invisible — the turn ends silently and SAM BECOMES THE COURIER, a cost his own words already priced ("check inbox", typed twice on 2026-08-10). Repairing a concurrent-write corruption on 2026-08-12, this terminal re-homed the rescued block under a `## ` heading; masked only because orders sat above it. REPAIRING BY HAND A FILE THAT HAS A PARSER, WITHOUT READING THE PARSER, IS THE SAME CLASS OF MISTAKE AS THE CORRUPTION IT WAS FIXING. Sighting 5 of the class the hook\'s own comments catalogue twice ("the scan infers an order exists from an artefact") and THE FIRST WITH A GATE OVER THE FILE — every earlier fix was made inside the hook, which by construction cannot detect the heading that stops it reading. WHAT THE CELL HOLDS: non-vacuity FIRST (the hook\'s own scan must reach more than five order-shaped lines, or the bounds are wrong and every later assertion is empty), then zero `## ` headings inside the region. MUTATION-TESTED AGAINST THE REAL FILE: re-nesting `### THE MERGE\'S LEFTOVERS` back to `## ` reds it; restoring greens it. Liveness probes both directions plus a missing region, and caught a VACUOUS assertion in its own first draft — a probe searching for a phrase its fixture did not contain. WHAT IT DOES NOT HOLD: whether the orders are good, whether anyone acted on them, or the hook\'s own behaviour (that is `scripts/__tests__/seatInboxHookTests.sh`).',
    },
  },
  {
    id: 'LAW-fixture-projection-is-not-calendar-input',
    law: 'Recurring and one-off game fixtures persist once as Profile or decision-ledger inputs; Calendar persists calendar facts and never a derived game/noGame projection.',
    ruledAt: 'docs/CODEX_UI_SESSION_PERSISTENCE_BOUNDARY_2026-08-11.md §Options compared before implementation; docs/NORTH_STAR.md',
    guard: {
      state: 'guarded',
      by: 'test:calendar-ownership',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-11. Eight ownership cells pin the input-only Calendar selector at the store, accepted-transaction serializer and reload fingerprint. Its first run caught the second serializer after the store alone was fixed. Quiescent boot then proves the visible fixture returns by derivation, and `.maestro/golden/reload-standard-week.yaml` kills and relaunches the app before checking the visible Saturday Game Day card. NOT COVERED: legacy worlds whose only fixture record is an old Calendar game/noGame mirror.',
    },
  },
  {
    id: 'LAW-game-anchor-any-day-one-owner',
    law: 'A game may be on ANY day of the week, and exactly one predicate answers "which day is the athlete\'s game day" for every reader in the app.',
    ruledAt: 'Sam 2026-08-12 ("games should be able to be placed any day of the week - i can\'t know when every single club in aus is going to play a game so I want to be prepared for everything"); docs/HOW_TO_BUILD_THIS_APP_2026-08-12.md §5 item 1',
    guard: {
      state: 'guarded',
      by: 'test:game-anchor',
      chainStatus: 'in_chain',
      receipt: 'BUILT WITH THE RULING 2026-08-12, and the defect was the WRONG WEEK rather than a missing preference: `resolveEffectiveGameDay` answered `undefined` for any day outside Fri/Sat/Sun, so a midweek athlete got no G-1, no G-2 and no G+1 — the week was built as if there were no game. SIXTEEN copies of "is this a real game day?" existed — CORRECTED 2026-08-12, the first count said EIGHT (resolver allowlist, `profileSetupChange.storedGameDay`, `ProfileScreen.dayFromGameFields`, an inline expression in `useSeasonPhaseControl`, three `!== \'Varies\'` tests in `recoveryAddonBuilder`/`postGenerationConstraintValidation`/`generateProgram`, and an inline seven-name `includes` in `weekRebuild`); three of them already accepted all seven days, so the app could READ a Wednesday game and could not WRITE one. Fourteen cells: the owner reads all seven days; `usualGameDay` outranks the onboarding field; both pickers render from the canonical week (asserting the LOOP, not a count); fourteen named readers delegate; no code outside the owner parses the legacy value (comments stripped, so the history stays written down); and the checkers red on fabricated violations. MUTATION-TESTED TWICE: restoring the allowlist reds cell 5 naming all four silenced days, and pointing the boot re-seed back at one field reds the relaunch cell. NO DEVICE MIGRATION IS OWED and that is proven rather than assumed — the legacy `\'Varies\'` was never a day, means what `undefined` means, and parses to null at the owner. NOT COVERED: nothing ran on a device; N games in one week is untouched (`derivedWeekContract.ts:90` still collapses a fixture list to its first entry, §5 item 4).',
    },
  },
  {
    id: 'LAW-game-feedback-shared-outcome-door',
    law: 'Scheduled games and practice matches save one complete match result through the regular dated session-outcome transaction, use the shared 1-10 effort scale, and recording it does not change the program.',
    ruledAt: 'Sam 2026-08-11; docs/GAME_FEEDBACK_OWNERSHIP_REASSESSMENT_2026-08-11.md',
    guard: {
      state: 'guarded',
      by: 'test:game-feedback',
      chainStatus: 'in_chain',
      receipt: 'BUILT WITH THE RULING 2026-08-11; UPDATED WITH SAM\'S SAME-DAY SCALE CHANGE. The real accepted transaction is driven with a game-classified visible workout and a complete result (whole/part, time on ground, body effort — 1-5 then, 1-10 since 2026-08-12 — and a 1-5 feel, which is a DIFFERENT scale and did not move). UPDATED AGAIN 2026-08-12 WITH SAM\'S 1-10 SCALE AND SLIDER RULINGS. The suite asserts the effort SLIDER (the chips could not hold ten choices on one row), the exact anchors, and that the payload survives adapter, normalization and durable feedback publication unchanged; a non-game refuses it; an out-of-range 11 refuses (6 is now LEGAL and the cell that pinned it moved); no legacy standalone field is written; and program content, modifiers and injury state remain unchanged. The same UI component selects this path from the existing session taxonomy, whose Game category covers both scheduled and practice fixtures.',
    },
  },
  {
    id: 'LAW-team-training-measured-load',
    law: 'A performed Team Training component asks duration and its own 1-10 effort, and stores both on the same dated session result; a skipped component stores neither.',
    ruledAt: 'Sam 2026-08-11; docs/COPY_SHEET_RULINGS_2026-07-30.md §18-b-ii',
    guard: {
      state: 'guarded',
      by: 'test:session-execution-checklist + test:game-feedback',
      chainStatus: 'in_chain',
      receipt: 'BUILT WITH THE RULING 2026-08-11. The execution gate proves the questions appear only when Team Training was performed, both fields are required, effort is 1-10 (raised 2026-08-12), and the form builds one checklist result containing the measurement. The transaction gate then drives a real team-classified workout and proves the measurement survives the tap adapter, accepted transaction, dated feedback store and durable program envelope.',
    },
  },
  {
    id: 'LAW-program-navigation-saved-date-range',
    law: 'The Day/Week choice remains available and unchanged on every program week, and week navigation cannot leave the Monday-Sunday span containing the saved program start and end dates.',
    ruledAt: 'docs/PROGRAM_WEEK_NAVIGATION_BOUNDARY_2026-08-12.md "What Sam ordered" — Sam 2026-08-12 direct request: the toggle stays stuck for all weeks and navigation stops wherever the athlete\'s actual program starts and ends, without assuming a fixed block length',
    guard: {
      state: 'guarded',
      by: 'test:day-first-timeline',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-12. One cell proves the navigator mounts HomeScreenV2, finds the live toggle region, and fails if week position hides it or reinterprets the selected shape. A second executes one-day and uneven multi-week saved spans, clamps both edges, preserves an interior week and refuses invented weeks when no program exists. The live hook derives from currentProgram and exposes disabled edges to both arrows. NOT COVERED: physical iPhone acceptance.',
    },
  },
  {
    id: 'LAW-effective-text-line-box',
    law: 'Every athlete-facing text and input resolves its effective font size to a line box large enough to contain the iPhone system font, including local font-size overrides.',
    ruledAt: 'docs/CODEX_FEEDBACK_AND_TEXT_BOUNDARY_2026-08-11.md §Sam\'s orders; Sam physical-iPhone screenshot of clipped “Session feedback” heading',
    guard: {
      state: 'guarded',
      by: 'test:prototype-typography',
      chainStatus: 'in_chain',
      receipt: 'BUILT WITH THE PHYSICAL FINDING 2026-08-11. The gate first demonstrated its old three cells were green while a 22px local title inherited a 17px body line box. It now executes the shared minimum-line-box calculation, asserts both Text and AppTextInput flatten the caller style and apply the resolved line box last, and prints the occurrence/file census behind those two shared owners. The existing bypass census keeps every athlete-facing React Native Text behind the guarded owner.',
    },
  },

  // ── ENVIRONMENT LAWS (AGENTS.md), each learned from a real loss ───────────
  {
    id: 'LAW-verify-branch-before-commit',
    law: 'Run `git branch --show-current` immediately before every commit — the working tree is shared and branch state is mutable by another session.',
    ruledAt: 'AGENTS.md "Environment Facts / This working tree is SHARED with concurrent sessions"',
    guard: {
      state: 'guarded',
      by: 'test:verify-branch-hook',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13, and the row had said for weeks that it was "MECHANISABLE AND CHEAP — the one process law in the file with an obvious hook shape". It was. `scripts/verify-branch-before-commit.sh` runs as a real `pre-commit` hook via `core.hooksPath .githooks`, so `git branch --show-current` now runs at EVERY commit without anyone remembering to, and the answer lands in the commit output where the session and the transcript both see it. FOUNDING CASE 2026-07-28: ten commits of a fifteen-commit unit went to `main` while the session reported "branch …, unmerged" every turn — a belief about the branch survived ten commits of being wrong. FAIL-OPEN BY DESIGN, AND THAT IS THE LOAD-BEARING DECISION: this checkout is SHARED with concurrent sessions committing right now, so a hook that reds for an unforeseen reason would stop another agent\'s work with an error it did not cause. There is exactly ONE refusal — a DETACHED HEAD, where the commit lands on no branch at all and is reachable only by sha — with `LFA_ALLOW_DETACHED=1` as its exit, because a refusal with no exit is a trap. Every other path exits 0, including every path where the script cannot tell what is going on. NINE CELLS, and the must-NOT-refuse half is the important one for a repo-wide hook: outside a repo, a repo with no commits, and a dirty tree all pass through. FOUR MUTANTS KILLED: never refusing reds 2, printing a constant branch name reds 2, ignoring the escape hatch reds 1, and refusing on any empty branch reds 4. A FIFTH MUTANT SURVIVED AND CHANGED THE SCRIPT: I had written an unborn-HEAD escape on the reasoning that a fresh repo prints an empty branch, and deleting the whole block changed nothing — `git branch --show-current` prints the branch HEAD POINTS AT even when unborn, so `git init` prints `main` and that block was unreachable. Its cell was green because of the early return, not because of the code it named. The dead branch is deleted and the cell renamed to what actually makes it true — a-bind-can-be-green-and-empty, caught by mutating rather than by reading. WHAT IT DOES NOT HOLD: `core.hooksPath` is per-clone machine config, so the hook is TRACKED but its installation is not; a fresh clone gets the script and the cells, and must run the config line once.',
    },
  },
  {
    id: 'LAW-commit-before-mutation-testing',
    law: 'Commit before mutation-testing, and revert a mutation by copying the file back — never with `git checkout --` or `git stash`.',
    ruledAt: 'AGENTS.md "Environment Facts"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'GUARDED WITHOUT RE-WORDING, Sam 2026-08-10: "git proves this one outright." WHAT THE CELL HOLDS, STATED EXACTLY: no committed script, tape or tool in this repo reverts a file with `git checkout --` or `git stash` — the two mechanisms whose founding case lost an hour of unrelated wiring twice in one session on 2026-07-28. WHAT IT DOES NOT HOLD: a human typing either at a prompt. That half is loud rather than checked, and the row says so instead of implying the cell is wider than it is.',
    },
  },
  {
    id: 'LAW-no-secrets-committed',
    law: 'API keys and Supabase/OpenAI secrets are never exposed, repeated or committed — they belong in deployed secrets only.',
    ruledAt: 'AGENTS.md "Working Style"',
    guard: {
      state: 'guarded',
      by: 'test:repo-law-guards',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-10. Scans src/ and scripts/ plus app.json/eas.json for four credential shapes (OpenAI-style key, real-payload JWT, AWS access key id, and a named credential assigned a long literal). Patterns are BUILT FROM PIECES rather than written whole, so the scanner does not have to exclude itself — a self-exclusion is the hole a real key would sit in. GREEN on its first run. This law had the largest gap in the registry between the cost of a violation and the cost of its guard.',
    },
  },
  {
    id: 'LAW-away-is-an-equipment-answer',
    law: "Away has two halves and both are Sam's. (1) The athlete gives a leave date (bounded to the week on screen), a return date (unbounded), then says whether they have their normal kit; \"no\" writes a `missing_for_span` equipment fact over leave..return-1. (2) The trip itself is a span-shaped `travel` fact that marks NO date unavailable: while it is live, CLUB-BOUND work comes off — team training and fixtures — and every solo session stays exactly where it is, reshaped by the kit answer. Both lift themselves on the return date.",
    ruledAt: 'docs/SEAT_INBOX.md item 28 (Sam, 2026-08-13); docs/AWAY_FLOW_BOUNDARY_2026-08-13.md',
    guard: {
      state: 'guarded',
      by: 'test:away-flow',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13, both halves. 21 cells through the real durable executor and the real deriving seam on a TEN-DAY trip crossing two Sundays. [5b] reds if a schedule fact or `clear_days` returns to the away handler — the shape that used to take the athlete\'s sessions away and that would also have made the equipment answer vacuous. [2b]/[2c] red if the span stops reaching the days it names; [3] reds if the fact survives the return date. MUTATION-CHECKED FOUR WAYS: forcing a week scope reds [1b]/[2b]/[2c]; setting `until` to the return date reds [3]; disabling the travel rule reds [8]/[9]/[10] (the club work survives); widening it back to the old whole-day collapse reds [8]/[8b]/[11] (the athlete\'s own work dies). The pair is what proves the rule is the RIGHT width rather than merely present. Seen on the simulator end to end — week control, both dates, marked kit, "1 active modifier impacting program" / "Equipment restriction active - Exercises substituted" afterwards.',
    },
  },
  {
    id: 'LAW-christmas-break-is-two-questions',
    law: "The Christmas break is a dated NO-TEAM-TRAINING span the athlete states in two sittings, and the app never invents either end. Around 10 December a club athlete is asked when his last team training is, and the span opens the day after it with NO end. Around 3 January he is asked when team training goes back, and that answer closes the span the day before it. While the span is live the club night comes off every week it touches — and NOTHING ELSE does: his own sessions run, and a fixture he entered himself survives, because he is at home. That is the whole difference from `travel`, which deletes the game too.",
    ruledAt: 'docs/SEAT_INBOX.md item 31 part 5 (Sam, 2026-08-13): "it may be helpful to add a button for Christmas break and removing team training sessions from the app - maybe around the 10th of December … and then around the 3rd of Jan they should be ask when does team training go back? that way the app isn\'t guessing"; docs/CHRISTMAS_BREAK_BOUNDARY_2026-08-13.md',
    guard: {
      state: 'guarded',
      by: 'test:christmas-break',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13, 43 cells. The ask calendar is walked including the days the app must stay SILENT ([1b] the 9th, [1c] August, [1d] an off-season athlete, [3] a season already settled), because a rule that returns null for everything would otherwise pass every positive cell it has. Both answers go through the real durable executor: [4b] holds the OPEN end (`scope.kind === \'open\'`, `effectiveUntil === null`) that Sam\'s "isn\'t guessing" requires, and [5] COUNTS FACTS rather than observing effects — two overlapping breaks would look correct on every day they agree. MUTATION-CHECKED THREE WAYS: dropping the break from the club-day filter reds [7b] and [9]; letting `derivedWeekContract` read any schedule kind instead of only `travel` reds [8c]; removing the stable fact id reds [5]. [9b]/[9c] walk the WHOLE CHAIN — the stored fact, the constraints the app itself publishes from it, and a week generated from exactly those — because every other cell holds one link and none held the join, which is the shape a green-and-empty seam hides in. [8]-[8c] is a THREE-CELL DISCRIMINATOR at the week-identity seam — the fixture is there, a trip takes it, the break keeps it — and its first version was VACUOUS: it counted `workoutType: \'Game\'` rows out of the generator, where the NORMAL week has none either, so "a trip deletes the game" would have shipped green over a week that never had one. The non-vacuity control caught it. [7c] was likewise wrong first time: it asserted the row count was IDENTICAL across the break, borrowed from the away suite, and reddened on correct behaviour — 21 rows normally, 23 over the break, because a day that was "Strength + Team Training" becomes a full standalone strength day. NOT SEEN ON GLASS: the ask is date-gated to December and January and the simulator clock is August, so [10]-[10d] are SOURCE-PINNED cells naming the mount, the two questions in Sam\'s words, the December-only dismissal and the off-by-one — the athlete-visible proof is owed on a device with the clock moved.',
    },
  },
  {
    id: 'LAW-every-category-has-a-flavour',
    law: "Every member of the conditioning category vocabulary has a case in the map that turns a category into a flavour. A category the map has never heard of does not fail loudly — it returns `undefined` and the week is built from a hole. A known gap may exist ONLY as a named, dated entry on the debt list, and the list may never grow.",
    ruledAt: 'AGENTS.md "LAW ZERO" (a hazard with no guard is not recorded, only written down) applied to the category/flavour seam; the 4A label-honesty ruling this map already cites in `coachingEngine.ts` — Sam, 2026-07-08: "vo2 is HARD work and must not wear the tempo flavour — flavour/category/label/stress must agree"; measured 2026-08-13 in docs/SEAT_INBOX.md item 28-C1.',
    guard: {
      state: 'guarded',
      by: 'test:conditioning-templates',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-13, cell `[C12]` in `conditioningTemplateEqualityTests.ts`, 4 assertions, suite 91/91. FOUNDING CASE: `cod_decel` joined `OffseasonConditioningCategory` on 2026-08-13 and `categoryToFlavour` (`coachingEngine.ts`) was never extended — it declares `: CondFlavour`, covers FIVE of the SIX members, and so returns `undefined` at all seven of its call sites. Measured: forcing COD to be picked makes the generation run EXIT NON-ZERO, which is why item 28-C1\'s ranking fix CANNOT ship alone. THE CELL IS INERT ON OUTPUT — it reads source and changes no generated week, so it owes no scenario sweep, which is the only reason it could land in the same turn it was found. MUTATION-CHECKED THREE WAYS, each on a different assertion: adding a new member to the enum reds the "no NEW category is missing" cell; emptying the debt list reds the same cell (so `cod_decel` cannot be silently forgiven); and giving `cod_decel` a case WITHOUT removing it from the list reds the "debt cannot inflate" cell. AND TWO INSTRUMENT FAULTS WERE CAUGHT BY ITS OWN NON-VACUITY CELLS BEFORE IT SHIPPED: the category parse was unscoped and scraped every union in the policy file (13 values, including `gradual_reentry` and `cautious`), and `[a-z_]+` silently dropped `vo2` from the map side — so the first green would have compared junk against an incomplete list. WHY THE GAP IS DECLARED DEBT AND NOT FIXED: `CondFlavour` is `aerobic | tempo | high-intensity` and the return trip `flavourToCategory` (`sessionBuilder.ts:1132`) maps `high-intensity` back to `glycolytic`, so ANY mapping makes COD come back as a different category — which is what the 4A ruling forbids. The vocabulary cannot express COD without lying, and that is a design decision, not a missing case.',
    },
  },
  {
    id: 'LAW-mas-percent-names-a-pace',
    law: "A %MAS prescription the athlete reads is accompanied by the speed it means for THEM, derived from their own 2km time — or, when they have not tested, from Sam's default for their experience level and labelled as an estimate rather than as their number. The pace is DERIVED WHERE IT IS READ and never written into a program, so it cannot disagree with the time it came from. A row that prescribes no %MAS, and a profile with neither a time nor an experience level, both get NOTHING — the app does not invent a pace.",
    ruledAt: 'docs/STAGE_C_TIME_TRIAL_RULINGS_2026-07-29.md ruling 6 (Sam, 2026-07-29): "deriving per-athlete paces into the %MAS template rows [is] recorded as [an] explicit Stage B requirement[]"; the number is ruling 2, "MAS = 2km average speed x 1.00, no correction"; the skip ladder is ruling 3. Called in as census C2 by docs/RULINGS_NOT_IN_THE_APP_2026-08-13.md.',
    guard: {
      state: 'guarded',
      by: 'test:time-trial',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-13, 34 cells in [23]-[25] of src/__tests__/twoKmTimeTrialTests.ts. THE FOUNDING CASE IS CENSUS C2: `deriveMas` had ZERO production callers, `MAS_FROM_TIME_TRIAL_MULTIPLIER` and `TWO_KM_TIME_TRIAL_DEFAULTS` likewise, and `twoKmTimeTrial.ts:17` claimed "Everything downstream reads deriveMas" while nothing did — so an athlete ran a 2km, the app validated and stored it, and their card read the literal string "Intensity: 110% MAS". [25] IS THAT RECEIPT INVERTED and reds if the reader is deleted, if the day screen stops importing it, or if either conditioning row shape stops mounting it — a derivation with a caller no surface mounts is the same defect one layer up. NON-VACUITY FIRST IN [23]: the band parse is run over the REAL conditioning sheet and must find at least ten, or every refusal cell below it is passing over nothing. MUTATION-CHECKED FOUR WAYS: trying the point pattern before the range reds 10 cells (`90-100% MAS` would price as a flat 90 — the bottom of the athlete\'s own band handed back as the prescription); deleting the literal `MAS` token from both patterns reds 4 (a max-velocity sprint priced at 95% of a 2km pace); collapsing `DerivedMas.source` to always-measured reds 3 (Sam\'s default for an untested athlete presented with a measurement\'s confidence); and disabling the point-band branch reds 1. AND A CLAIM IN THE SOURCE WAS REFUTED BY THAT SAME RUN: the comment credited `\\b` and case-sensitivity with refusing `95-100% maximal`, and dropping `\\b`, adding `/i`, or both leaves all 144 green — `maximal` and `MAS` diverge at the third letter. The comment now says what was measured. WHAT IT DOES NOT HOLD: Q-001 (%MAS range-or-binary) stays OPEN and this unit did not answer it — a cell asserts `masCopy` still has no production consumer, because the pace derives from the percentage the card ALREADY shows, so Sam\'s answer moves it for free. **NOT SEEN ON GLASS, AND THE REASON IS MEASURED RATHER THAN AN EXCUSE: an in-season week WITH A CLUB PRESCRIBES NO %MAS AT ALL.** `generateProgramLocally` over `DEV_E2E_STANDARD_PROFILE` at 2026-07-13 yields **0 rows carrying a MAS band**; the same profile with the club removed yields **8** (in-season), **7** (pre-season) — `Bodyweight Conditioning Circuit`, `Intensity: 65-80% MAS`, rendering `Your pace: 9.8-12 km/h` off the seed\'s own 8:00. The club supplies the running, so `standard-in-season-week` — the only seeded world a golden flow can reach in one step — CANNOT show this line, and a flow over it would photograph a true negative and read as proof. Every seed is club-carrying or off-season-unbuilt. THREE HAND-DRIVEN ATTEMPTS DIED AT THE SAME DEV-HARNESS COLD-START GATE ("DevE2EClock reload mismatch"), which is the §8 SECOND-WALL count, so the glass proof is owed as a FLOW that drives the Away control to make a club-less week — not as more taps.',
    },
  },
  {
    id: 'LAW-rulings-are-machine-held',
    law: "A ruling Sam has made is held in `docs/RULINGS_REGISTRY.md` — his words verbatim, what it means, and the enforcer or the honest absence of one — and it is the ONE list. NO question may be put to him that re-asks a row on it. The check is not that an agent SAYS it grepped: the gate greps.",
    ruledAt: 'docs/SEAT_INBOX.md item 32 (Sam, 2026-08-13): "why the fuck is someone still saying shit like this WE HAVE FUCKING FIXED THESE ISSUES"; and, choosing between the two gates that got built: "if you built a gate that runs the search itself, keep that one over the state-your-grep version"',
    guard: {
      state: 'guarded',
      by: 'test:ruling-registry',
      chainStatus: 'in_chain',
      receipt: 'BUILT 2026-08-13, 7 cells over `docs/RULINGS_REGISTRY.md` — item 33 ordered three, and [2] is its UNENFORCED ratchet (14 of 81 as of 2026-08-13 evening; the row said 11 of 70 and both numbers had drifted — a receipt is a CLAIM and goes stale like any other) reddening in BOTH directions, while [1c] resolves every `BUILT <commit>` receipt after the registry\'s own author recorded catching themselves fabricating a citation. **THE FOUNDING CASE IS THIS SEAT\'S OWN ERROR:** three questions were put to Sam, TWO already ruled AND already built — the two-game field (ruled "as many games as needed", built `3f62ad62`; the re-ask came from reading `domain.ts:192` `gameDay` and reporting on the CALENDAR) and the fixture shortfall sentence (shipped `1dc52caf` twelve hours earlier). **TWO GATES GOT BUILT IN PARALLEL AND SAM CHOSE.** The terminal\'s `seat-inbox-hook.sh` requires a `REGISTRY-GREP:` line and says so honestly in its own comment: *"It cannot verify the grep was honest."* **A gate satisfied by typing a line is satisfied by typing a false one, and it would have passed all three re-asks.** So [3] here does the grep itself and reds when a question hits a row it does not cite. **AND THIS SEAT ALSO BUILT A RIVAL 14-ROW REGISTRY IN TYPESCRIPT WITHOUT LOOKING** — Sam: *"The registry has 33 rows, not 14 — check before you add or trim."* It is deleted, and [4] is a cell so its absence is held rather than remembered. MUTATION-CHECKED THREE WAYS: an uncited re-ask reds [3]; **gutting the matcher reds [3c], so the gate cannot rot into the rubber stamp it replaced; making the matcher fire on everything ALSO reds [3c]**, because a gate that refuses every question is the same uselessness wearing a red. TWO INSTRUMENT FAULTS WERE FOUND AND FIXED IN THE GATE ITSELF: it matched the words "BLOCKED-BY: sam" anywhere, so it flagged the paragraph QUOTING the marker while withdrawing it and the inbox\'s own legend; and it enumerated the status vocabulary, reddening on `PARKED`, `UNRULED` and `BINDING` — **all three of which are correct rows and none of which the registry\'s own "two states only" header allows.** It now reads the row FORMAT, and the stale header is named for its author rather than fought.',
    },
  },
  {
    id: 'LAW-an-exclusion-is-answered-with-a-scope',
    law: "When the athlete removes an exercise the app ASKS how long to leave it out and records the answer as ONE canonical decision — 'Today only' (this session; future sessions and blocks unaffected), 'This block' (expires automatically at the next block boundary) or 'Until I change it' (every future program until the athlete restores it). ONE decision per exercise: changing the scope UPDATES that decision, it never mints a second. An ORDINARY SUBSTITUTION IS NOT AN EXCLUSION and must not ban the original. Generation, rebuild, rotation, pools and validation all respect an active exclusion, and NOTHING may quietly restore one — where a legal same-pattern replacement exists it is used, and where none exists the gap is DISCLOSED.",
    ruledAt: 'docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md "Athlete substitutions and exclusions" (approved by Sam, 2026-08-16)',
    guard: {
      state: 'guarded',
      by: 'test:exercise-exclusions',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-16, 51 cells in `src/__tests__/exerciseExclusionScopeTests.ts`, every case driven through `generateProgramLocally` and `rebuildDerivedWorld` rather than hand-built state. **LIVENESS FIRST, AND IT EARNED ITS KEEP ON THE FIRST RUN:** the subject is the most-prescribed row in the real generated block (`Single-Leg RDL`, 8x, 39 distinct exercises) and the receipt is printed — the first cut of the program reader looked for a `workout.date` that does not exist (a `Workout` carries `dayOfWeek`; the date is on the microcycle), returned an empty map, and would have made every "it is gone" cell green and empty. **TWO PREMISES WERE REFUTED BEFORE BUILDING.** (1) The day screen\'s existing "Future weeks too" branch was INERT AGAINST GENERATION: it wrote an `avoid_exercise` ActivePreferenceConstraint to `coachUpdatesStore`, while `composeWeek.injuries.excludedIdentities` is fed from `prefs.excluded` and from nothing else — so an athlete who chose it saw the exercise return the next week. (2) `coachActions.setPreferredAlternative` — an ORDINARY SWAP — called `addExclusion` on the original, permanently banning a lift after one substitution, with nothing to expire it and nothing telling the athlete. **13 OF 13 MUTANTS KILLED:** `today_only` never expiring (4 red), `this_block` never expiring (5), the predicate losing its lower bound (2), any overlap treated as week-wide (2), generation dropping the dated exclusions (1), the composer ignoring the per-day set (1), the gap blaming the kit for an exclusion (1), `upsertExclusion` appending instead of updating (3), restore as a no-op (2), substitution banning the original again (1), the legacy fold skipped (1), Status showing expired exclusions (2), and the projection ignoring the date (2). **ONE MUTANT FIRST READ AS SURVIVING AND THE INSTRUMENT WAS AT FAULT** — its replacement text contained `//`, which terminated perl\'s own `s///`, so the file never changed; re-run properly it kills 2 cells. **A RED WAS MEASURED BEFORE IT WAS BELIEVED:** an assertion that the projection survives boot went red with `exclusions=[]` and looked like boot wiping the athlete\'s answers, so a standalone probe ran install-exclude-boot three times in a fresh process — `before=1 after=1` every time. `rebuildDerivedWorld`\'s clean slate touches `programStore` alone; the red was accumulated in-process state across nine cases, i.e. this file\'s own harness, and the claim is made once in the case whose world is a fresh install. NOT COVERED: the simulator. Every case is headless and the three-option sheet is owed a device pass.',
    },
  },
  {
    id: 'LAW-a-gap-names-its-real-cause',
    law: "A disclosed gap in a composed session names WHY the slot is empty — the athlete's KIT, or the athlete's own EXCLUSION — and never blames one for the other. The test is 'would the kit ALONE have emptied this slot': a kit that can train nothing here outranks a choice, because a thing the athlete cannot do outranks a thing they decided.",
    ruledAt: 'docs/BLOCK_TWO_PROGRESSION_CONTRACT_APPROVED_2026-08-16.md: "If the exclusion makes the pattern impossible, disclose the gap rather than restoring the exercise." Extends R-083, which ruled the kit-caused removal.',
    guard: {
      state: 'guarded',
      by: 'test:exercise-exclusions',
      chainStatus: 'in_chain',
      receipt: 'BORN GUARDED 2026-08-16, case [8] of `src/__tests__/exerciseExclusionScopeTests.ts`. THE FOUNDING CASE IS A ONE-MEMBER UNION: `ComposedGap.cause` was the literal `\'kit\'`, so every gap an exclusion emptied told the athlete their EQUIPMENT was the problem — sending them to buy a barbell for a hole only they could fill by restoring an exercise. The exhaustive case excludes EVERY squat-slot identity the composer can choose, read from `selectableExerciseNames()` joined through `slotsForExerciseName` rather than from a list this test typed, so a pool entry added tomorrow cannot leave the case silently non-exhaustive — an "impossible replacement" case that misses one candidate proves the opposite of what it claims. MUTATION: forcing `attributeGap` back to `\'kit\'` reds it. THE COMPLEMENT IS HELD TOO — case [7] proves that when a legal same-pattern replacement DOES exist it is used, in the same slot, with `mainStrengthPattern` preserved and NO gap disclosed, so the disclosure cannot rot into a gap reported whenever anything is excluded.',
    },
  },
];

/** Rows whose law has nothing holding it — the list Sam steers by. */
export const UNENFORCED_LAWS: readonly LawRow[] =
  LAW_REGISTRY.filter((row) => row.guard.state === 'UNENFORCED');

/**
 * A guard outside `test:bible` counts as unguarded for reporting: a check nobody
 * runs is not a check. No Batch 1 row is currently in this state, which is the
 * one piece of good news on the sheet.
 */
export const GUARDS_OUTSIDE_THE_CHAIN: readonly LawRow[] =
  LAW_REGISTRY.filter((row) =>
    row.guard.state === 'guarded' && row.guard.chainStatus === 'outside_chain');
