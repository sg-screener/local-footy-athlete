# HOW TO BUILD THIS APP — the shape Sam asked for, and the three things
# standing between here and there

LOOP CHECK `enforcement-deferred-then-forgotten` — sighting 6, and this document
is the COMPRESSION rather than another instance. **Every defect found on
2026-08-12 has one shape: the app computes the right answer and then does not
consume it.** Nine examples are listed in §4. **The proposed gate is one gate.**

**Sam, 2026-08-12, the brief:** *"i want you to think about whats the best way to
build this app. Not the fastest way, or the cheapest way, I want the app to be
flexible and have rules that it upholds but nothing so tight that you can't put a
game on a wednesday or the athlete can't choose to do whatever they want you know
-- its just about getting the athlete to train as smart as possible based on their
circumstances and my brain"*

**Method:** three independent read-only verifications, each given ONE question and
required to return `file:line` receipts, each told a correction is worth as much
as a confirmation. All three corrected the seat's framing. Nothing below is taken
on trust.

---

## §0 THE HEADLINE

**This app is not built wrong. It is built right and disconnected.**

The bottom of the stack already does what Sam is asking for. The calendar already
stores any number of games on any date. `targetWeekFixtures` already returns them
all. The Section 17 kernel — his actual coaching brain — already loops every game
and already protects around each one (`weekStructureValidator.ts:277`, and its own
comment at `:247-249`: *"Checked around EVERY game date"*). The contract's anchor
array is already `Section18AnchorContract[]` with a day-scoped `id`
(`weeklyExposureContractV2.ts:421`, `:718`) — **it was designed for N games.**

**It collapses to one game in a single narrow band, and the root is ONE LINE:**
`src/rules/derivedWeekContract.ts:90` — `const fixture = fixtures[0] ?? null`.
Everything downstream that looks like a bug (twelve `.find()` / `[0]` sites in
eight files) is a *symptom* of that line handing them a scalar.

**It is a waist, not a floor.** That is the whole good news of this document.

---

## §1 THE THREE LAYERS, AND WHICH ONE IS MISSING

Everything Sam asked for falls out of separating three things the app currently
mixes.

### LAYER 1 — FACTS. What is true about this athlete's life.
Fixtures, team trainings, availability, injuries, equipment, what they have
already done. **A fact is never inferred from a rule and never negotiable.**
- **Today:** facts are list-shaped at the edges and scalar in the middle (§0).
- **The fix:** fixtures become a LIST OF DATES everywhere. Not a weekday. Not a
  recurrence. A list. A recurrence is a convenience for *filling* the list, never
  the storage.

### LAYER 2 — THE BRAIN. Sam's rules.
- **Today: this layer is the healthiest in the app** and is already
  preference-shaped (`hard_stop` / `strong` / `soft` / `info`).
- **The fix is small:** the tiers must mean the same thing everywhere, and the
  arbitrary count-vs-shape ownership split (craft tier ruling 2) needs revisiting
  now that `achievedModerateDayCount` has been found unread.

### LAYER 3 — THE ATHLETE'S WILL. **THIS LAYER DOES NOT EXIST.**
This is the gap, and it is exactly what Sam named.

**Measured:** there is no way for an athlete to proceed past a blocking rule.
`PlanChangeSheet.tsx:859-883` renders a `block_warning` with exactly one button,
labelled **`"OK"`**, which goes back. Repo-wide grep for `proceedAnyway`,
`overrideBlock`, `forceApply`, `athleteInsist`, `doItAnyway`: **zero hits.**

**`canOverride` IS A DEAD FIELD.** Written in nine places
(`weekStructureValidator.ts:290,315,325`; `section18CraftTier.ts:205`;
`programEditRiskAssessment.ts:165,262,293,322,358`; `planChangeProducer.ts:2044`)
and **read nowhere in production** — the only two reads are test assertions.
**A field literally named "can override" that no code consults.**

**And an override that IS allowed is not recorded.** When an athlete clicks
"Continue" past a `confirm` (`PlanChangeSheet.tsx:844-850`), the ledger entry is
`{ kind: 'plan_change', change }` (`planChangeProducer.ts:2412-2416`) — the
decision, but **not the fact that it overruled a warning.**

**What DOES exist is the seed of the layer:** `athletePlacement`
(`domain.ts:877`) with ONE predicate, `resolverMayDisplace`
(`athletePlacement.ts:102-106`), derived from two persisted athlete-owned
surfaces. It is genuinely good and a sweep test fails the build on any new
deriver that ignores it (`resolverDisplacementSweepTests.ts:463-468`).
**It governs exactly one verb: displacement.**

---

## §2 THE DESIGN RULING THIS ASKS FOR — SEPARATE REFUSAL FROM ADVICE

> **The app should almost never refuse. It should say what it thinks, RECORD that
> it said it, then do what the athlete asked — and never quietly undo it later.**

Reserve true refusal for the incoherent and the genuinely dangerous. Everything
else becomes: **a strong opinion, the athlete's call, and a durable record of
both.**

**The record is what makes this SAFE rather than permissive**, and it is why this
is not "just let them do anything":
1. A later pass knows the day was overridden, so it never "repairs" it back.
2. The week's shortfall is attributed to the athlete, not to the app — which
   makes the fifth-hard-day and moderate-day measurements honest for the first
   time.
3. **It is the input the coach needs.** *"You've moved your heavy legs day next to
   the game three weeks running — want me to just program it there?"* cannot be
   said by an app that does not keep the record.

**One concept, one field: EVERY DAY HAS AN AUTHOR AND A REASON.** Athlete-authored
days are FACTS (layer 1). App-authored days are CANDIDATES (layer 2).

**Today there are FOUR answers to "is this the athlete's will":**
`athletePlacement`; the `source === 'manual'` short-circuit still live as an
OR-branch at `projectVisibleWeek.ts:214-219` **inside the function the stamp was
written to replace**; `mutationIntent` (`acceptedStateTransaction.ts:1867`); and
**a `date|name` STRING JOIN** at `section18CraftTier.ts:217-232` — **which breaks
on a rename, in both directions.** Collapse them to the one predicate.

---

## §3 THE CONGESTION ANSWER — COMPUTE THE HONEST TARGET, DO NOT REPAIR DOWN

Sam: *"sometimes that may mean only doing 1 strength session during the week if
they have 2 games and 2 team trainings"*.

**Measured: the app cannot currently reach that outcome by design.**
- `withDisplacedCapacityReduction` — the ONLY gateway-time fixture-authorised
  reduction — writes **`conditioning_core_frequency` only**
  (`section18AcceptedWeekGateway.ts:1205-1206`). **There is no fixture-authorised
  STRENGTH reduction anywhere at the gateway.**
- Strength capacity **counts team-training days as strength-capable**:
  `min(target, selected.length)` at `weeklyExposureContractBuilders.ts:386-388`.
  `nonTeamDays` exists (`:277`) and is used for conditioning and sprint — **never
  for strength.** So three team trainings do not lower the strength target at all.
- Result: a jammed week targets 3, fails, and enters the repair cascade. **It
  fights.**

**THE RULING:** a week's targets are DERIVED FROM WHAT THE CALENDAR LEAVES, not
asserted and then forgiven. **A 1-strength week with 2 games and 2 team trainings
is not a shortfall. It is the plan.** Reductions stop being apologies and become
arithmetic.

**REFUTED FRAMING, worth recording:** the seat believed reductions required an
athlete action. **False.** `explicit_user_override` is ONE of THIRTEEN reasons
(`weeklyExposureContract.ts:31-44`); `game_load_protection`,
`insufficient_availability` and `spacing_safety_conflict` are all written from
pure calendar arithmetic and DO lower the enforceable floor
(`weeklyExposureContractV2.ts:1172-1174`). **The machinery is right; strength is
simply not wired into it.**

**AND THE APP LIES ABOUT WHY.** `renderSection18Shortfall` has exactly one
template: **`"Resting {Day} means you'll miss a strength session this week"`**
(`section18ShortfallDisclosure.ts:96-103`). A fixture-caused shortfall is
explained to the athlete as their own resting. **Blaming the athlete for the
club's draw is the worst copy in the app.**

---

## §4 THE ONE GATE THAT WOULD HAVE CAUGHT ALL OF IT

Nine findings from one day, all the same shape — **computed, then not consumed:**

| Value | Computed at | Readers |
| --- | --- | --- |
| `weekStructureValidator` findings | whole module | 3 loggers (until 2026-08-12) |
| `unavoidableAnchorCausedExcess` | `section18EffectiveWeekEvaluator.ts:1047` | **0** |
| `achievedModerateDayCount` | `:1034` | **0** |
| `canOverride` | 9 sites | **0** in production |
| decision ledger `decisions` | `deriveVisibleWeek.ts:70,101` | **0** |
| `targetWeekFixtures` N-list | `fixtureConditionedAvailability.ts:146-149` | collapsed at `derivedWeekContract.ts:90` |
| fixture-day `Set` | `postGenerationConstraintValidation.ts:878,928` | `[0]` one line later (`:881`, `:931`) |
| `maxExercisesPerStrengthSession` | — | **0** (`sessionRowCounting.ts:246-251`) |
| `contract.anchors` N-capacity | `weeklyExposureContractV2.ts:421` | builder emits 1 (`:723`) |

> **PROPOSED LAW — `LAW-computed-must-be-consumed`: a value the app computes on
> every assessment and no code reads is not a feature, it is a rule that was
> switched off. Either wire it or delete it.**

Implementable as a `noUnusedWrites`-style gate over `contract.*` assignments and
exported rule outputs. **This is the compression for sightings 1-6 and it is one
gate.** It subsumes the narrower `subject: 'doc' | 'behaviour'` proposal.

---

## §5 THE ORDER OF WORK — cheapest-first is also correctness-first here

1. **ANY DAY OF THE WEEK — nearly free, do it now.** `GAME_DAY_MAP` already maps
   all seven days (`sessionResolver.ts:2205-2213`); `usualGameDay: DayOfWeek`
   already offers seven; **no code anywhere branches on Friday-vs-Saturday
   semantically.** The whole restriction is **ONE allowlist**:
   `sessionResolver.ts:526`. A Tuesday game returns `undefined` there and gets **no
   G-1/G-2/G+1 protection at all.** Widen `GameDay` → `DayOfWeek`, delete
   `mapToLegacyGameDay` (3 call sites), open the picker
   (`GameDayScreen.tsx:28-32`); ~9 `!== 'Varies'` guards go dead.
   **Check for persisted `'Varies'` on device first — migration may be owed.**
2. **FIX `quiescentBoot.ts:337-338`** — the live loss-on-relaunch. One line.
3. **KILL THE ±7 INVENTION — THIS IS A DEFECT, NOT A GAP.**
   `section18CraftTier.ts:161` synthesises `previousGameDate = fixture-7d` and
   `nextGameDate = fixture+7d`, and the validator **merges them into `gameDates`
   as real games** (`weekStructureValidator.ts:255,272`). For an irregular fixture
   list this **fabricates games that do not exist**, so the athlete gets the WRONG
   protection, not merely a missing one. Derive from the fixture list or pass
   nothing.
4. **UNPINCH THE WAIST.** `derivedWeekContract.ts:90` and its return type `:82`;
   then `Section18ContractV2Input.fixtureDay` → `fixtureDays: number[]` and
   `anchorsFor` mapping over it (`weeklyExposureContractV2.ts:693-736`).
   **Consumers that already `.filter()` need no change**
   (`postGenerationConstraintValidation.ts:878`,
   `section18AcceptedWeekGateway.ts:721`). Then the twelve `.find()`/`[0]` sites.
5. **STRENGTH JOINS THE CAPACITY ARITHMETIC** (§3) — `nonTeamDays` for strength,
   and a fixture-authorised strength reduction. Fix the shortfall copy.
6. **BUILD LAYER 3** (§2) — one authorship field, one predicate, a recorded
   override, and a way through every block that is not physically impossible.
7. **THE GATE** (§4).

**1-3 are small, and 3 is a live correctness defect. 4 is the architectural one.
6 is the one Sam actually asked for.**

---

## §6 A CORRECTION THE SEAT OWES, AND THE RULE THAT PREVENTS IT

**On 2026-08-12 the seat told Sam the phase-shift sheet lived on the home screen.
It does not. Sam:** *"The phase-shift sheet on the home screen thats gone now -
dude i told you to look at the new fucking ui changes - that lives in the status
section inside the coach tab - did you not look at all this"*. **He is right.**

The seat cited `HomeScreenV2.tsx:3534` out of a doc written before the UI merge,
**without checking who renders it.** `docs/UI_STATE_2026-08-12.md` is the picture
index and says at its line 42 that *"the phase card left both shapes when Coach
took My Status"*. The seat handoff says in bold: **look there before reading any
UI prose.** It was not read.

**THE ACTUAL STATE — worth knowing, because it is a half-finished move:**
- **Surface:** `CoachTabScreen.tsx:479`, inside My Status. **Sam is correct.**
- **Implementation:** still `HomeScreenV2.tsx:3352`.
- **Bridge:** `src/components/SeasonPhaseShiftSheet.tsx` is a **six-line
  re-export** whose comment says it exists *"while its surface moves from Program
  to My Status ... instead of duplicating the sheet"*. Deliberate and documented
  — **but the implementation never followed, so the bridge is now permanent.**
  Same disease as §4, one step along: not a value nobody reads, a MOVE nobody
  finished.

> **RULE — `LAW-ui-location-from-the-picture`: never cite a UI location from
> prose. Read `docs/UI_STATE_*.md`, then confirm the CONSUMER (who renders it),
> not the definition. A component's file is where it was written, not where the
> athlete finds it.**

This is the §4 mistake in the seat's own reasoning: it trusted a write without
checking for a reader.

## NOT COVERED

- **Nothing here ran on a device or a simulator.** Static reading plus the
  existing suites.
- **`test:qa` was not run for this document.** The terminal's own 2026-08-12
  measurement (`a8f13d91`) stands separately.
- **Persisted-data migration is OPEN-UNKNOWN throughout** — whether devices hold
  `'Varies'` profiles or singular `fixtureDay` contract rows was not established
  and cannot be by static reading.
- Whether any `hard_stop` finding is currently REACHABLE from an athlete door is
  OPEN-UNKNOWN; §2's argument does not depend on it.
- The 137 test files touching `gameDay` were not categorised. §5 item 1's "short
  tail" is measured for `src/`, not for the suites.

**NORTH STAR:** toward. **Every ruling here REMOVES a representation** — one
fixture list replacing a weekday plus a recurrence plus eight mirrors; one
authorship predicate replacing four; one derived target replacing an asserted
target plus a forgiveness pass.
