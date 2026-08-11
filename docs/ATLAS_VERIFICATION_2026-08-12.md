# THE ATLAS, VERIFIED — where Codex is right, where he is wrong, and the
# ONE finding that answers Sam's actual question

**Sam, 2026-08-12:** *"I want you or the terminal to analyse his work — is he
right? is he wrong? and tell me what we need to do."*

**Method:** six independent read-only verifications against the working tree at
`a4961f6a`, each required to return a verdict WITH a `file:line` receipt, each
told that a correction is worth as much as a confirmation. Nothing below is
taken from the atlas on trust. Where a verifier could not establish something
statically it says OPEN-UNKNOWN, and those are left as OPEN-UNKNOWN here.

**HEADLINE: he is substantially right, his numbers are close, and he is honest
about his limits — the atlas labels its own units and marks its own
open-unknowns, which is more than most work in this repo has done. Three of his
claims are UNDERSTATED. One framing is misleading enough to send work to the
wrong place. And the verification found TWO LIVE DEFECTS THE ATLAS DOES NOT
CONTAIN**, one of them shipped the day after the thing it re-breaks was
declared fixed.

---

## §1 THE ANSWER TO "WHY IS THE PROGRAMMING SHIT"

**This is the finding. Everything else in this document is smaller than it.**

Sam asked whether his Bible is being lost — *"is this old stuff creeping in and
the new stuff not being found?"* Codex answered "there is no single final
programming authority." **That is REFUTED architecturally and CONFIRMED where it
counts, and the true shape is sharper and much more fixable than his answer.**

**There IS a single final authority and it is wired everywhere.** The §18
accepted-week gateway (`src/rules/section18AcceptedWeekGateway.ts:1435`) runs at
generation (`generateProgram.ts:715`), at every single-date write (nine edit
doors all converge on `programStore.ts:2619` → `requireSection18AcceptedWeek`),
at hydration (`programStore.ts:930`, `:1347`) and as the terminating return of
the read resolver (`sessionResolver.ts:1841`). **The AI cannot mutate the
program, and cannot even invent an exercise NAME** —
`defaultProgram.ts:2719` `enforceCuratedCueContract` throws
`ExerciseVocabularyViolation` on any name off Sam's curated list. So "the AI
reinterprets your rules" is not what is happening.

**What IS happening — one line, and it is the whole answer:**

> **The module that holds Sam's coaching CRAFT is wired to LOG, not to BLOCK.**

`src/rules/weekStructureValidator.ts` is the Bible's Section 17 kernel. It knows
`g2_hard_lower`, `g_plus1_hard_work`, `double_hinge_plus_sprint`,
`double_lower_plus_upper_full`, `cap_maxHardDays_over`, `min_strength_under`.
**Its own header, lines 5-8:** *"Phase 2 rules kernel: FINDINGS ONLY. • Never
mutates a week, never blocks a write, never throws into a caller's control
flow. • Enforcement is a later phase behind its own approved plan."* It has
exactly **three live callers and all three only log**: `coachingEngine.ts:1660`,
`coachRevisionOverrideWriter.ts:202`, `programEditRiskAssessment.ts:410`.

Meanwhile the gate that DOES block asserts *contract conformance* — counts,
ceilings, floors, prohibitions, pattern balance
(`section18EffectiveWeekEvaluator.ts:27-55`). **It never asks whether the
session reads like a coach wrote it.** A 50-minute aerobic run stacked onto a
power+speed day is conformant. That is the exact gap between "the labels are
okay" and "the programming is pretty shit."

**"Enforcement is a later phase" was written as a plan. It became a permanent
state.** Sam's rules were not lost and old code is not overriding them — **his
craft rules were built, and then left switched off.**

**THE FIX IS ONE SEAM.** In the gateway's `assess` closure
(`section18AcceptedWeekGateway.ts:1348-1370`), which today calls only
`evaluateSection18EffectiveWeek`, also call `validateProgramWeek` on the same
visible workouts and treat `severity: 'strong'` findings as blocking. The repair
search already exists, is already bounded, already re-evaluates, and already has
`regenerate`/`safeFallback` escapes — so craft violations become candidates to
repair against instead of a second opinion nobody reads. **One edit at one seam
retro-fits every path at once** (generation, coach edit, tap, hydration, read),
because they all already converge there. **This is the systemic fix Sam's
standing instruction asks for, and it is available today.**

Two seams must close with it or they escape the widened check:
`applyOptionalTopUps` (`generateProgram.ts:756` — documented as never
re-evaluated) and `SAFE_PATTERN_FALLBACK` (`section18SafetyFinaliser.ts:111` —
a private four-name literal map that injects exercises late).

---

## §2 THE TWO LIVE DEFECTS THE ATLAS DOES NOT CONTAIN

### 2.1 THE GAME DAY IS BROKEN AGAIN, ON THE NEW DERIVED PATH — NOT COVERED BY ANY TEST

The atlas records game-day loss as **FIXED ON SIMULATOR** and it is: `f79806e0`
deleted the derived mirror from disk (`calendarStore.ts:109-115`, `:255`),
`test:calendar-ownership` 8/8, `test:quiescent-boot` 5/5, and
`.maestro/golden/reload-standard-week.yaml` does a genuine `stopApp` + relaunch
and still sees Saturday. **That is a real fix, honestly proven.**

**But `src/store/quiescentBoot.ts:337` `deriveBootFixtureMarks` re-derives the
recurring game day from `profile?.gameDay` ALONE, and skips when it reads
`'Varies'` (`:338`).** Every other consumer resolves `usualGameDay ?? gameDay`
(`sessionResolver.ts:525`, `coachingEngine.ts:8775`,
`fixtureMinimalReplan.ts:1087`, `recoveryAddonBuilder.ts:342`,
`section18AcceptedWeekGateway.ts:281`). And
`profileMutations.ts:30-33` `mapToLegacyGameDay` writes `gameDay = 'Varies'` for
**any day outside Fri/Sat/Sun**, while the phase-shift sheet
(`HomeScreenV2.tsx:3534`) offers **all seven days**.

> **FAILURE SCENARIO, in plain English: an athlete sets a Wednesday game day.
> The week shows it. He closes the app and opens it again — the recurring game
> day is gone.** Same defect, new path, one day after it was declared fixed.

**No test covers it** — no test file references `deriveBootFixtureMarks`, and
`quiescentBootTests.ts` never mentions `usualGameDay`. **Not reproduced on a
running app; confirmed by four files that agree on the mechanism.**

**Root cause is Sam's own defect class: EIGHT representations of one game day** —
`OnboardingData.gameDay` (`domain.ts:184`, four options),
`OnboardingData.usualGameDay` (`:187`, seven options — **two persisted fields
for one fact, made to disagree by `mapToLegacyGameDay`**), `calendarStore
.markedDays`, the ledger `fixture_door` decisions, the contract's fixture
anchors (`section18AcceptedWeekGateway.ts:271`), `fixtureAwareMarkedDaysForWeek`
(`:261`), `sessionResolver`'s own derivation (`:522-596`, documented as
"mirrors coachingEngine"), and boot's derivation.

**FIX:** one `resolveEffectiveGameDay(profile)` as the SOLE reader, a gate that
reds if any file outside it touches `.gameDay`/`.usualGameDay` (~25 sites
today), and retire `gameDay` so `'Varies'` stops existing as a lossy encoding.

### 2.2 THE OFF-FEET CONTRADICTION IS REAL, AND THE SESSION LIES ABOUT ITSELF

Codex's "the walking decision is internally stupid" is **CONFIRMED**, and the
mechanism is worse than he described. `conditioningFeasibility.ts`
`substitutionDecision`, three consecutive lines:

```
207  if (runningSafe) return 'outdoor_running';          // gated on !conditioningOffFeet
210  if (!lowerRestricted && !entry.conditioningOffFeet) // hills: gated
215  if (!lowerRestricted && stress !== 'hard' && !genuineSprint)  // walking: NOT gated
```

**The smoking gun is 100 lines further down.** `:326-329` clears the flag for
running and hills — `? { conditioningOffFeet: false }` — **and omits walking**.
So the allocation keeps `conditioningOffFeet: true` while its rows now read
"Brisk Walking", **and every downstream consumer still believes the session is
off-feet.** It ships: 40 occurrences in the committed golden snapshot
(`offseason-no-equipment`), one of them attached to a workout whose own focus
string says *"optional off-leg conditioning"*.

**Two owners disagree about what off-feet means** —
`conditioningSelection.ts:307` enforces it correctly with a modality filter;
`conditioningFeasibility.ts` enforces it by three hand-written checks, one of
which was forgotten.

**FIX:** declare `onFeet: boolean` on every family beside its label
(`:365-372`), derive BOTH gates from it, and delete the hardcoded pair at
`:326-329`. The module already states this principle for its copy sheet
(*"a family added here is automatically both emittable AND signed"*) — extend it
to the property that caused the bug, and a family added later cannot be
forgotten.

---

## §3 CLAIM-BY-CLAIM VERDICTS

| # | Codex's claim | Verdict | What the measurement actually says |
| --- | --- | --- | --- |
| 1 | 32 of 95 laws unguarded | **CONFIRMED, MISLEADING FRAMING** | Count exact. But **24 of the 32 are PROCESS laws** about how agents work; **only 4 can change what the athlete sees** (`LAW-L6-honest-actions`, `LAW-attributed-content-change`, `LAW-L5-no-dead-affordances`, `LAW-L15-one-write-format`). Presented as athlete exposure it overstates by ~8×. |
| 1b | *(not in the atlas)* | **BIGGER MISS** | **95 is the count of HARVESTED laws, not of laws.** 116 named ruling/law/boundary docs, 644 `RULING` markers across 298 files; the registry header itself says 131 ruling docs are unharvested. **An unharvested rule is worse than an UNENFORCED one — UNENFORCED is red and loud; unharvested is silent and looks like nothing.** |
| 1c | *(not in the atlas)* | **GUARDS SPOT-AUDITED** | 5 product-critical guarded rows read: **3 real, 1 mostly real, 1 partial**. The liveness discipline is genuinely implemented (all 27 checkers in `repoLawGuardsTests.ts` are probed with fabricated violations). **But `LAW-L4-device-is-arbiter` and `LAW-L10-phone-is-done` are held by grepping NOW.md for a device word** — writing "NOT ON GLASS" passes them. Those two read guarded and guard a document. |
| 2 | Game days lost on restart | **WAS TRUE, FIXED, RE-BROKEN** | See §2.1. |
| 3 | Feedback loop dead-ends | **CONFIRMED** | Consistent with `docs/NOW.md`: journal data layer live and gated, surface hidden, coach S4 not started. No new measurement. |
| 4 | Onboarding weakly proven: 38 taps, 0 in flows, 10 unchecked | **CONFIRMED AND UNDERSTATED** | Tap sites are **43**, not 38. Flows walking onboarding: **zero** — all 14 flows start `reset-seed.yaml` and skip it. **And a flow COULD NOT be written today: 23 screens expose 4 testIDs total, all on Welcome.** 9 screens have no test naming them. Worse: **`test:onboarding-cold-start` is 3/16 passing** (13 failures, 11 sharing one stack at `calendarStore.ts:341`) **and is NOT in the `test:bible` chain, so that red gates nothing.** `test:onboarding-field-influence` also carries one real red (`trainingLocation` declared coach-only but read by `equipmentVocabulary.ts`). |
| 5 | 372 taps, 19 in flows, 115 trace-stops | **PARTIAL** | Independent recount: **386** by the stated instrument, **377** under the exclusions actually used; 372 is reproducible only by also excluding `src/components/dev` and including `App.tsx` — i.e. **the stated instrument does not reproduce the number**. "19 named in flows" ≈ **18**, confirmed, but it counts only hand-written literal testIDs; with computed ids resolved it is up to **54**. **"115 trace-stops" is UNVERIFIABLE — no instrument is named and it is not derivable.** |
| 6 | Old and current paths coexist: 38 sites = 32+4+2 | **CONFIRMED EXACTLY, AND UNDERSTATED** | 32 `HomeScreen.tsx` + 4 `JournalScreen.tsx` + 2 `CoachScreen.tsx`. **The Program one is the worst case in the repo:** `HomeScreenClassic` lives INSIDE the file the navigator mounts, behind a compile-time `const DESIGN_VERSION = 'v2'` — so the import graph, TypeScript and dead-code analysis all say "live". `DayWorkoutScreen.tsx:32` already shows the correct resolution (1-line re-export). Understated: **72 of 95 declared route names in `src/types/navigation.ts` have no mounted screen and no importer** — a whole fictional auth stack, journal stack and 18-route profile stack, with three ParamList names DUPLICATED against the real ones in `AppNavigator.tsx`. The deep-link surface (`DeepLinkPath`, 16 paths) has zero importers and no `linking` prop. |
| 7 | 3-exercise days are old logic surviving | **CONFIRMED, AND WORSE** | Abolition is real (`LFA_PROGRAMMING_BIBLE.md:4968`, `:3149`; `trainingAgePolicy.ts:112` *"never authored"*, live value 6). Eleven 3-row branches in `defaultProgram.ts:1069` `fallbackExercisesForPlanEntry`, reachable by three live paths — and **`generateProgramLocally` synthesises EVERY day from them** (`generateProgram.ts:866-872`, comment: *"3-ish core exercises per session"*), so they are not an error path, they are the normal output of non-AI generation. **And there is no floor AND no ceiling: `sessionRowCounting.ts:246-251` states outright that `maxExercisesPerStrengthSession` is "read by no prompt builder, validator or trim".** The AI prompt emits `MAX EXERCISES PER SESSION` with no MIN (`supabase/functions/coach-chat/index.ts:1369`). Correction: the primary full-body branch returns **four**, not three (`defaultProgram.ts:1135`). |
| 8 | "Brisk Walking" invented from one Bible mention | **PARTIAL** | The NAME is code-invented — "Brisk" appears nowhere in the Bible; `conditioningFeasibility.ts:53` splits the Bible's coarse `walking` into a typed `brisk_walking` family and `:368-369` labels it. Zero hits for "brisk" in any RULING/DECISION doc. **But "one mention" is wrong: walking is authored in five places** (`:4753-4762` the substitution law, `:522` recovery, `:554` **inside the conditioning vocabulary**, `:742` rest days, `:4273-4279` explicitly NOT running exposure). **The real finding is provenance laundering:** `projectionCopy.ts:556-563` registers the name as `source: 'authored_sheet'` — which `signedCopy.ts:33-36` defines as *"the exercise master sheet or the cue sheet. Sam's data"* — while its `provenance` field cites **a TypeScript file and the fact that it already ships.** The copy sheet exists so a gap is visibly a gap; this string used it to certify itself. |
| 9 | No single final programming authority | **REFUTED architecturally, CONFIRMED on quality** | See §1. |

---

## §4 WHAT WE NEED TO DO — IN ORDER, AND WHY THIS ORDER

**Sam's standing instruction governs every line: never fix the edge case, make
the class impossible. Every item below is a seam, not a patch.**

1. **TURN ON THE CRAFT VALIDATOR.** `weekStructureValidator` into the §18 gate's
   `assess` closure as a blocking tier, plus the two escaping seams
   (`applyOptionalTopUps`, `SAFE_PATTERN_FALLBACK`). **This is the answer to
   "why is the programming shit" and it is one seam.** Everything else on this
   list can wait behind it.
2. **ONE OWNER FOR THE GAME DAY.** `resolveEffectiveGameDay` as sole reader; fix
   `quiescentBoot.ts:337` first (that closes the live Wednesday defect today);
   gate the ~25 direct readers; retire `gameDay`/`'Varies'`.
3. **ONE OWNER FOR OFF-FEET.** `onFeet` on the family table, both gates derived,
   `:326-329` deleted, `conditioningSelection.ts:307` consuming the same
   predicate.
4. **A FLOOR AND A CEILING ON SESSION SIZE**, enforced at the one site
   `sessionRowCounting.ts:253` already nominates, so the AI path, the fallback
   path and every future branch are caught by the same predicate. Emit
   `MIN EXERCISES PER SESSION` to the prompt.
5. **MAKE DORMANCY A FILESYSTEM FACT.** `src/retired/`, one gate: nothing under
   `src/` may import it and nothing in it may be reachable from `App.tsx`. Move
   `HomeScreenClassic`, `CoachScreen`, `JournalScreen` — 38 of 38 dormant tap
   sites in one move, and the NEXT freeze lands in the right place by default.
   Delete the 72 fictional routes and the dead deep-link surface in the same
   pass; turn on `noUnusedLocals` for `src/navigation/`.
6. **MAKE ONBOARDING ADDRESSABLE, THEN WALK IT.** testIDs on the 19 screens that
   have none — **this is the precondition; the flow cannot exist without it** —
   then one cold-install device journey, then put `test:onboarding-cold-start`
   into the chain (it is 3/16 and currently gates nothing).
7. **HARVEST RATCHET FOR THE REGISTRY.** Extend the gate's existing "no suite
   names a rule the registry has never heard of" cell from suites to `docs/`:
   every named ruling doc either produces a row or joins a dated, shrink-only
   HARVEST_DEBT list with a ceiling. **That converts the invisible prose backlog
   into a number that can only fall** — the one failure mode the registry
   cannot currently see. Add `subject: 'doc' | 'behaviour'` to every row and red
   when a behaviour law is held by a markdown grep (catches
   `LAW-L4-device-is-arbiter` and `LAW-L10-phone-is-done` automatically).
8. **COMPUTE THE ATLAS, DO NOT WRITE IT.** `scripts/tap-atlas.ts` emitting
   committed JSON, with a test that reds when it is stale. Every number in this
   verification came from ~15 lines of grep; **the reason 372 is
   wrong-but-close is that a human transcribed a machine's output and then
   described the machine incorrectly.** A count that names its instrument should
   BE its instrument.

---

## §5 WHAT THE ATLAS GOT RIGHT THAT IS WORTH SAYING OUT LOUD

It labels its own units, it distinguishes "source-traced" from "proven", it
carries a NOT COVERED section, and it corrected two of its own findings between
snapshot and delivery rather than shipping the stale ones. **The claims that
failed verification failed on instrument description and emphasis, not on
honesty.** That is a different and much cheaper problem than a confident wrong
map.

---

## NOT COVERED

- **Nothing here was run on a device or a simulator.** Every verdict is static
  reading plus existing test suites; the Wednesday game-day defect in §2.1 is
  confirmed by four agreeing files, **not reproduced**.
- **`test:bible` (~190 suites) was not run.** Suites actually executed:
  `test:law-registry`, `test:calendar-ownership`, `test:quiescent-boot`,
  `test:onboarding-reliability`, `test:onboarding-cold-start`,
  `test:onboarding-field-influence`, `test:athlete-move-occupied-content-loss`,
  `test:session-execution-checklist`, `test:repo-law-guards`.
- **No mutation testing.** Whether a guard REDS when its law breaks requires a
  write; the conservation guard's real strength is OPEN-UNKNOWN.
- 5 of 63 guarded registry rows were audited; the other ~58 are unexamined.
- The generate-program edge function's server-side prompt was not read (only
  `supabase/functions/coach-chat` exists here), so the MIN/MAX finding is
  confirmed for coach-chat and OPEN-UNKNOWN for generation.
- The Bible was sampled at its anchors, not diffed clause-by-clause against the
  gate, so "the gate checks less than the Bible says" is inferred from anchor
  coverage plus `weekStructureValidator`'s advisory status.
- The number of distinct UNHARVESTED rules is unmeasured and is the largest open
  number in this document.

LOOP CHECK `enforcement-deferred-then-forgotten` — sighting 3 (the beginner-cap
abolition that eleven fallback branches never heard about; the
`maxExercisesPerStrengthSession` that nothing reads; `weekStructureValidator`'s
"enforcement is a later phase"). **COMPRESS: a rule that ships wired to `log`
is not shipped. Item 7's `subject` field is the proposed compression — a
behaviour law whose only consumer is a logger should red the same way a
markdown-held one does.**
