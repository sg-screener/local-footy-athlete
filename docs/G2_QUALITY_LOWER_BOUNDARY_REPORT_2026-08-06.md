# THE G-2 QUALITY-LOWER UNIT — BUILT, and step 1 of the build order is CORRECTED

Executes `docs/G2_CONDITIONS_5_AND_6_2026-08-06.md` §3, under
`docs/INJURY_AUTHORITY_EXHAUSTION_RULING_V2_2026-08-06.md`. Pays the miss
diagnosed at `45fb91cb`
(`docs/UPPER_BODY_SEVERE_STRENGTH_MISS_DIAGNOSIS_2026-08-06.md`).

**North star:** toward it. The unit adds NO stored state. It adds one derived
DOSE on an in-memory allocation, and it deletes a representation gap rather
than adding a representation: the shape now has one owner instead of an
authored validator with no producer.

---

## §1 THE CORRECTION — §3 step 1 was wrong about the carrier, and it is superseded

Build order step 1 read: "Vocabulary: `StrengthArchetype` + `CandidateType`
gain the quality-lower shape." Three measurements refuted it before any code
was written. The ruling's SUBSTANCE is unchanged and fully built; only the
carrier moved. Sam holds his veto over the correction as over the ruling.

**1. The placer that builds this week has neither.** A temporary probe against
green `HEAD` instrumented `buildWeeklyPlan` through the re-derive:

```
[G2PROBE-ENTRY] wk 1 In-season gameDay= Saturday hasGame= true gc= ["shoulder/9"]
[G2PROBE] slots Monday@G-5 Tuesday@G-4T Thursday@G-2T core= 3 gc= true injuries= ["shoulder/9/true"]
[G2PROBE] assigned Monday:lower_combined Thursday:push Tuesday:pull
```

The week is composed by the **G-relative branch** (`coachingEngine.ts:1894`),
which places `Thursday:push` with the injury **in scope and unread** — it
consults no restriction at all. `CandidateType`, `isHeavyLower` and the three
guards §2.1 tabulates (`:3199`, `:3707/:3714`, `:4984`) all live in the SCORER
branch, which never runs for an in-season game week. A new `CandidateType`
would have been vocabulary nothing could reach. §2.1's table was right about
the guards and wrong about which placer it was describing.

**2. `StrengthArchetype` is derived, not stored.** `inferStrengthArchetype`
computes it from the pattern set (squat → `lower`), so a `quality_lower` member
is unproducible by the union's own inference, and `workoutCanonicalisation.ts:851`
re-infers and would overwrite it on every round trip. It is also intensity
feeding identity — closed by Sam at `a670115`. The 8th strength variant would
additionally have edited `seven_strength_sessions`, a Bible anchor whose
declared state is the number **7**.

**3. The shape was already authored; what was missing was a PRODUCER.**
`looksLikeNeuralPrimer` (`rules/weekStructureValidator.ts`, approved
2026-07-08) IS the G-2 exception — ≤2 lower/power exercises, ≤3 sets, ≤3 reps,
no hinge, no deadlift/RDL/Nordic — and `weekStructureValidatorTests:180` pins
Sam's own example, `High Box Squat 2×3 + Vertical Jump 2×3`. `decidePowerPrimer`
already emits `spec('primer', family, 2, 3, 3, 'G-2 tiny neural primer')`, so
the jump half existed and was already G-2-gated. This is condition 1's finding
one layer deeper: **an authored occupant with a validator, an example and no
placer.** `authored-source-already-exists`, again.

**What was built instead.** `SessionAllocation.strengthVariant:
'quality_low_volume'` — a DOSE, the exact twin of the existing
`conditioningVariant: 'micro_dose'` ("very low volume neural exposure — used as
the last resort so sprint category is never dropped from a week"). The archetype
stays `lower`; the patterns stay `['squat']`; nothing is added to any union the
inference layer owns.

## §2 WHAT SHIPPED

| # | Change | File |
|---|---|---|
| 1 | `strengthVariant` on the allocation — the dose carrier | `utils/coachingEngine.ts` |
| 2 | The G-2 last-resort branch, both the 3-core and 2-core shapes | `utils/coachingEngine.ts` |
| 3 | The authored content, 2×3 High Box Squat + 2×3 Vertical Jump | `data/defaultProgram.ts` |
| 4 | The dose is not overwritten by the phase rep scheme | `data/defaultProgram.ts` |
| 5 | The authored movement is not rewritten by pool rotation | `data/defaultProgram.ts` |
| 6 | The validator names the anchor it has been licensing | `rules/weekStructureValidator.ts` |
| 7 | State 2 finally cites its sites | `data/bibleThresholdAnchors.ts` |
| 8 | The `:319` citation correction | `rules/weeklyExposureContractBuilders.ts` |
| 9 | The three-world matrix, 7 cells | `__tests__/injuryAuthorityOwnershipTests.ts` |

**The branch is unreachable without a restriction, by construction.** The whole
last resort hangs off a non-empty `resolveRestrictedMainStrengthPatterns` set —
the same function the §18 contract uses, so the placer and the contract cannot
disagree about what the injury blocked. A healthy week cannot enter it.

**No guard was weakened, and none was touched.** The shape is not heavy, so
`g_minus_2_no_heavy_lower_or_speed`, `lateWeek` and H-TEAM-LOWER admit it as
§2.1 predicted — the prediction was right even though its vocabulary was not.

## §3 THE MEASUREMENTS

Before (re-derive, `HEAD`): **threw** `Section18WeekAcceptanceError:
planner_selected_target_miss:main_strength:2`. THU stripped to zero rows.

After:

```
d1 Mixed         | 4ex | Lower Body Strength         | Front Squat[3x3-4], Deadlift[3x3-4], ...
d2 Team Training | 3ex | Team Training + Lower Hinge | Deadlift[3x2-4], Single-Leg RDL, Nordic Lower
d4 Team Training | 1ex | Team Training + Lower Squat | High Box Squat[2x3-3]      <- G-2, FILLED
d5 Strength      | 6ex | Gunshow
d6 Game
mainStrength.exposure  achievedCount 3 / plannerSelectedTarget 3
blocking               (none)
```

**The matrix (7 cells, all green), and its mutation testing.** A green gate is
a claim, so each was killed on purpose before being trusted:

| mutation | cells killed |
|---|---|
| `g2QualityLowerAvailable = false` | G2, G3, G4, **G7 with the original signature** `planner_selected_target_miss:main_strength:2` |
| dose exemption removed | G4 — "High Box Squat shipped 3x4, not the authored 2x3" |
| rotation exemption removed | G4 — "`Vertical Jump[2x3-3], Back Squat[2x3-3]`" |

The third is the one worth reading twice: without the rotation exemption the
session still SATISFIES `looksLikeNeuralPrimer` (G3 stays green) and is a
full-range Back Squat two days before a game. G3 alone would have signed it.
That is why G4 asserts the movement by name.

**The three worlds, per ruling V2 §3:**

- **G1 — no game.** The exception is unreachable and nothing exhausts.
- **G2/G3/G4 — Saturday game + severe upper.** G-2 FILLS, the shipped session
  satisfies the authored definition, and the content is Sam's sentence verbatim.
- **G6 — genuinely exhausted.** Every pattern paused ⇒ the typed
  `main_strength_frequency` reduction is authorised, and the quality-lower is
  NOT placed (its shape is squat-family; building it from banned movements
  would be a primer in name only). The reduction appears in G6 and in no other
  cell — V1's mechanism stands and does not fire in world 2, exactly as ruled.
- **G5 — the ruling's own enforcement.** A healthy week, and a lower-body-only
  restriction, never reach it.
- **G7 — end to end** through `rebuildDerivedWorld`, the same body boot runs.

## §4 THE HUSK — measured, and it is NOT on the athlete's surface

Build item 4 asked that a day never ship titled with zero rows. In world 2 the
day is now filled, so the husk is gone at its source. In world 3 a zero-row day
remains, and the honest measurement is that the athlete does not see a husk:

```
WORLD C   d2  0ex  name="Team Training + Upper Body Strength"
          COMPONENTS d2  team_training/team_training/team training
```

The stale half of the name lives on `workout.name` only. `getSessionComponents`
yields **no strength component**, so `projectVisibleWeek` composes no strength
part and the athlete reads a Team Training day. `resolveSessionDisplayName`'s
own header records why the stale name survives (rule 5, focus inference, KEPT
and measured as load-bearing) and that `project()` deliberately passes it
neither `focus` nor `name`.

So item 4 is paid as a LAW rather than a rename: **G7 asserts no session ships a
strength component with zero rows.** The residual stored-name artifact is
declared, not patched — `resolveSessionDisplayName` is inside LR-6's standing
STOP, and a rename there is a silent coach-pipeline behaviour change.

## §5 COPY — PROPOSED, NOT SIGNED

Two athlete-facing sentences were drafted for the two rows and are **NOT
shipped**. The rows carry no note; the dose carries the instruction.

- High Box Squat — *"Low range of motion, high quality - stop well short of failure"*
- Vertical Jump — *"Quality reps, full recovery between sets"*

A third, for the Coach Note, is proposed and also not shipped. It is worth
noting the diagnosis's assumed note ("you are training twice, not three times")
is now WRONG for this world — the week holds its count of three:

- *"Your Thursday session is deliberately small this week: your shoulder is
  paused and there is a game on Saturday, so it is a short, sharp lower session
  instead of a full one."*

`focus` strings are not athlete-facing on this path (pinned by
`projectionOwnershipTests`), so the allocation's focus text is internal.

## §6 CONDITION 5, in the narrow way this unit can pay it

The anchor gate's vacuity is unfixed and remains its own unit. What this unit
owed it is now paid at one anchor: `lower_strength_g3` lists sites for **both**
declared states, where it previously cited `midWeek` alone — state 3 — while
declaring `[3, 2]`. `test:bible-anchors` 274/274.

The successor question — **how many other anchors declare a state no site
implements** — is still UNMEASURED. Named, not counted.

## §7 NOT-COVERED

- **The genuinely-exhausted world G6 reaches is the ALL-patterns-paused one.**
  The narrower world my branch's own guard implies — push+pull paused, squat
  paused, hinge safe — is **unreachable through the athlete's guided injury
  door**: `resolveRestrictedMainStrengthPatterns` blocks squat AND hinge
  together for any `lower_body`/`back_midline` region, and only a bare
  `injuryKeys: ['knee']` blocks squat alone, which the guided door never emits.
  So ruling V2's "no eligible day remains AFTER the G-2 option is considered" is
  satisfied VACUOUSLY on the reachable set. Stated rather than papered over —
  this is the `gate-passing-on-coordinates-it-never-builds` shape, and I am
  declaring my own instance of it.
- **World 1 (no game) is driven at the allocation layer, not end to end.** The
  `spent-week-friday` seed carries a Saturday fixture in every one of its weeks
  (measured: weeks 1-4 all resolve `in_season_game_week` off the profile's usual
  game day), so a no-game week is not reachable from that seed at all. G1 drives
  `buildCoachingPlan` directly. G7 is the end-to-end cell.
- **The Vertical Jump row does not reach the athlete in the seeded world.** The
  composer emits it (G4 asserts so); the week's authorised power-primer budget
  is 0 for `game_load_protection` (two team trainings + a game), and
  `section18SafetyFinaliser.capSessions` removes it. That is the power owner
  deciding, not a silent drop — "content derived to match its budget cannot
  contradict it" is that site's own ruling. **Whether Sam intends the jump half
  to be exempt from the weekly power budget at G-2 is HIS call and is not
  assumed here.** `decidePowerPrimer` already licenses a G-2 primer for an
  experienced athlete; the weekly budget is a different owner and they disagree
  in this world.
- **No device pass.** Suite output and static traces only.
- **`loadEstimation` treatment beyond the existing 1.2× High Box Squat ruling
  was not examined**, carried unchanged from `docs/G2_CONDITIONS_5_AND_6` §4.
- The `back_midline` region was not probed at the matrix layer; G1/G2/G5/G6 use
  `upper_body` and `lower_body`.

## §8 SAM'S SIGNING BATCH, 2026-08-06 — what landed and what did NOT

`docs/G2_SIGNING_AND_LAST_RESORT_RULING_2026-08-06.md`.

### 8.1 Signed copy — 2 of 3 shipped

The two row notes ship **verbatim, including the en dash** in the first: a
signed sentence is signed as written, and normalising its punctuation is the
same class of edit as rewording it. Both were grepped against every regex that
reads the `notes` field before shipping (`a-note-is-output-never-evidence`):
`deloadWeekRules`' conditioning and quality-conditioning patterns, and
`coachActions.RUN_PATTERN`. All three miss — note that `RUN_PATTERN` has **no
word boundaries**, and "Quality **reps**" still does not match `repeat`.

**The Coach Note is NOT shipped.** Its channel is the typed
`DeterministicCoachNoteEffectSeed` (`kind` + `reason` + `ownerKey`, with the
sentence composed in `deterministicCoachNoteFactory`), so shipping it means a
new `kind`/`reason` pair and a sentence site — not a string drop. Located, not
built. The sentence is signed and waiting.

### 8.2 The last-resort ruling — the doc's own claim was WRONG, and it is now built

The signing doc records the preference as "already the built shape". **It was
not.** Cell G8 was written to pin the claim and measured the opposite
immediately:

> an earlier eligible day (Wednesday, G-3, non-team) was free and the app built
> the G-2 quality session anyway, on [Thursday]

The cause is structural: the placer picks the G-2 **team** day for its upper
slot FIRST, before any earlier day is considered, so the conversion happened
before G-3 was ever looked at. Sam's ruling is therefore a behaviour change, and
it is built: `earlierLowerSlotThan` tries G-3 first, then G-4/G-5, skipping team
days (H-TEAM-LOWER bars heavy lower there, and what this places is an ORDINARY
lower session, not the non-heavy exception). Only when no earlier day exists is
the G-2 quality session built. G2 still passes — its 5-day world genuinely has
no free earlier non-team day — so the two cells now separate "last resort" from
"only resort", which is exactly Sam's distinction.

This is the second time in this unit that a claim of "already covered" was
false when measured ([[authored-source-already-exists]] was the first). Pinning
the claim cost one cell and caught a real defect.

### 8.3 Ruling 4a — DELIVERED. The third owner was the gateway, and BOTH named suspects were wrong

**Superseded by §8.4 below.** The measurement §8.3 asked for was taken; it
refuted both suspects and found the owner elsewhere. The original text is kept
below the line because the refutation is the useful part of the record.

---

#### 8.3 (as written) — the budget half is built; the ruling is NOT delivered

**Built and measured:** `budgetedPowerSession` is one predicate with two
readers — `section18SafetyFinaliser` (what may be stripped) and
`section18EffectiveWeekEvaluator`'s primer ledger (what is counted). That
symmetry is deliberate: an exemption the content owner knows and the verdict
owner does not is the exact asymmetry the finaliser's own header calls "the
whole defect". `strengthVariant` rides onto the `Workout` to carry it, derived
and never persisted.

**Not delivered:** the jump still does not reach the athlete. Measured at the
composition layer:

```
ALLOC            Thursday:quality_low_volume
WORKOUT d4       strengthVariant= quality_low_volume
  rows           Vertical Jump/role=power/power={"family":"lower","kind":"primer"}
                 | High Box Squat
```

So the allocation, the workout marker and the power row are all correct and a
**third owner** removes it downstream. That owner is NOT identified, and I did
not guess: the two named suspects are `contract.safety.prohibitedPower`
(lines 199/368 of the finaliser strip every power row when it is set — and it
reads `contract.power.eligible`, which is per-MODE and should be true here) and
the canonicalisation re-decide at `workoutCanonicalisation.ts:480/512`, which
its own comments say "shrinks the G-2 primer".

**G7 asserts neither direction.** Asserting the ruling would be a gate passing
on coordinates the app does not build; asserting the current behaviour would
pin the defect as if it were the law. The cell says so in place.

**Next measurement, for whoever picks it up:** print
`contract.safety.prohibitedPower` and `contract.power.eligible` for the seeded
severe-upper world, then instrument the two `hasPowerRow` strip sites at
`section18SafetyFinaliser:199` and `:368`. One of them fires, or
canonicalisation does.

### 8.4 THE MEASUREMENT — taken. Neither suspect fired; the owner is the GATEWAY

**North star: toward it.** No stored state; one module stops keeping its own
copy of a rule that already had an owner. A representation was REMOVED.

The measurement §8.3 asked for was taken, and it refuted the whole suspect list:

| suspect | verdict | evidence |
|---|---|---|
| `contract.safety.prohibitedPower` (`:199`/`:368`) | **REFUTED** | `prohibitedPower=false` on this world — neither site can fire |
| canonicalisation re-decide (`:480`/`:512`) | **REFUTED** | `finaliseWorkoutAfterMutation` measured `IN=1 OUT=1` on every pass; `updatePowerForPhase`'s removal branch never fired (`gMinusTwoBlocked=false` — the athlete is `5+ years`) |
| `alignPowerToFinalWorkoutContent` (my own next guess) | **REFUTED** | `sameFamily=1` — High Box Squat resolves `squat`→`lower`, matching the row |

**The owner is `section18AcceptedWeekGateway.weeklyPowerBudget`** — the WEEKLY
SELECTOR, which no one had named. Measured on the seeded world:

```
[gateway] budget=0 ineligible=false fixtureDay=6 teamCount=2
          candidates=["d1/tooClose=false/anchorDay=false",
                      "d2/tooClose=false/anchorDay=true",
                      "d4/variant=quality_low_volume/tooClose=true/anchorDay=true"]
          keep=0
[gateway] >>> STRIPPING d4 variant=quality_low_volume
```

Both of its exclusion terms fire on the G-2 day and **neither can ever be
satisfied**: `tooCloseToFixture` is true for every day within two of the game,
which is what G-2 *means*, and `anchorDay` is true because the placer puts this
session on a team day. The session was unkeepable at any budget — a week with
no fixture at all was the only world where the authored half survived.

**The fix, at the owner.** `budgetedPowerSession` had "ONE PREDICATE, TWO
READERS" in its header and the warning that a second copy of it *is* the bug.
The gateway held **four** such copies — what competes for the budget, what is
stripped, what is counted, what the repair detail reports. All four now read the
predicate, and `hasPowerRow` is **no longer imported into that module at all**,
so the copy cannot grow back without someone re-adding the import past the
comment that says why it is absent. No guard was added.

**Mutation testing, and what it caught in my own work.** Each edit was killed on
purpose:

| mutation | result |
|---|---|
| strip guard back to `hasPowerRow` | **KILLED** — G7 reds, "does not ship Vertical Jump" |
| `candidates` filter back to `hasPowerRow` | **SURVIVED** |
| `achieved` count back to `hasPowerRow` | **SURVIVED** — all 91 gateway cells stay green |

So two of the three edits are unwatched by any suite. A counting assertion was
written to cover them, measured, and **REMOVED as vacuous**: the gateway's count
is overwritten by `section18EffectiveWeekEvaluator:1027` from its own ledger, so
a cell reading `achievedPrimerCount` reads the EVALUATOR's value and can never
see the gateway's. Keeping it would have been my own instance of
`gate-passing-on-coordinates-it-never-builds`. It is declared in place instead —
the compile-time absence of the import is what enforces those three sites, not a
test.

**G7 now asserts the ruling by NAME**, both movements, and it was RED before the
fix for exactly that reason. `test:bible` printed **`TRUE_EXIT=0`**, chain
reached `test:stage-b-generation-differential` (3/3), differential golden
byte-identical — the healthy week is untouched, as `budgetedPowerSession` and
`hasPowerRow` differ only on a session no healthy week builds.

**NOT-COVERED:** no device pass. The `removed` bookkeeping and the repair-detail
sentence are corrected but unwatched, as declared above.

## §9 OPEN FOR SAM

1. The §1 correction — the dose carrier instead of a fourth archetype and an
   eighth strength session. Ruled by the review seat per RULE-DON'T-ASK.
2. The three PROPOSED sentences in §5.
3. §7's power-budget question is ANSWERED — ruling 4a, the jumps stay. The
   budget half is built; §8.3 carries what is still removing them.
4. The signed Coach Note (§8.1) needs a typed `kind`/`reason` pair before it
   can ship. Sam's sentence is signed and unshipped until then.
