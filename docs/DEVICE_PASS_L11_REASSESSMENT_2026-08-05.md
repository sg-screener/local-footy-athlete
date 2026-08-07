# Device pass 2026-08-05 FAILED — the L11 reassessment

Sam's combined stages-1+2 device pass returned seven findings. Per L11, **all
fix work stopped**; this document is the reproduction matrix, produced by
ACTING before any fix, with the coverage gaps named as first-class findings.
**No product code was touched.** The reproduction suite is
`test:device-pass-2026-08-05` (`src/__tests__/devicePass20260805ReplayTests.ts`),
chained into the bible, committed `9dd2cca`.

The export `device-export-2026-08-05.txt` sits at repo root, untracked. Its
answers and marks are transcribed into
`src/__tests__/support/samDevicePass20260805Fixture.ts` as ACT inputs; per the
export-8 precedent it can be deleted once Sam confirms nothing else in it is
needed — its transaction tape is quoted below.

---

## §1 — What the export actually shows (three corrections first)

**1. The "coach_rollback write burst" is NOT a rollback.**
`restoreAcceptedInMemory` — the function that owns every writer on the tape
(`coach_mutation_mirror`, `coach_mutation_rollback`, `coach_rollback_restore`)
— runs **unconditionally at every transaction ENTRY**
(`src/store/coachMutationTransaction.ts:232`, comment: "Nothing may replace
the visible state captured at command entry while the durable read yields").
Every transaction burns one `calendar-reset:coach_mutation_rollback:N` id,
success or failure. The export's own cycle #1 proves it: the "rollback" at
00:14:44.108 is followed by `accepted_state_publication_result: accepted` and
`athlete_action_completed: hydration_accepted`. The writer names describe a
mechanism, not an event, and they cost this reassessment a detour.

**2. The 15 cycles are 1 hydration + Sam's 7 actions × 2 transactions each** —
seven pairs ~100–130 ms apart (00:15:01 → 00:15:33). Those pairs are almost
certainly his failing taps. **We cannot see their outcomes because
athlete-action diagnostics were OFF on his build** (`persistedPayloadHash:
"diagnostics-disabled"`; `athleteActionDiagnosticsEnabled()` gates every
requested/completed/failed emission — only the store doors emit
unconditionally, which is why only mirrors are on the tape). This is the
**instrumentation-alive rule failing a fourth time**, and it is the single
biggest reason four of his seven findings could not be located: the failures
left no trace. **The next device pass must run with athlete-action
diagnostics ON.**

**3. The 21-vs-22 answer count is a counter artifact, not profile loss.**
`answeredCount` (`profileStore.ts:387-397`) skips empty arrays, so
`injuries: []` is uncounted (21); the export's own key count is raw (22).
`profileMirrorRefusals` is empty. Nothing was restored over his profile.

**Also real, and standing:** his launch re-mints an ACTIVE `busy_week`
temporary source fact for 2026-07-27 — a week already over — from a legacy
schedule constraint that migration never consumes
(`loadCanonicalTemporarySourceFactOwnership`,
`temporarySourceFactTransaction.ts:229-244`: a schedule constraint with no
`temporarySourceFactIds` re-migrates on EVERY transaction, and
`composeTemporarySourceFactCompatibility` re-emits the constraint itself, so
the pair never expires). The suite reaches this coordinate through the
hydration door and proves conformance — and the doors it drives all still
work there, so this is convergence debt (L15 read-ingress that never
completes its lift), not the cause of his findings as far as acting can show.

## §2 — The reproduction matrix

| # | His finding | Cell(s) | Result | Layer / coordinate |
|---|---|---|---|---|
| 1 | Cannot change season mode from profile | `finding-1a`, `-1b`, `-1-worn` | **NOT reproduced** — decision + transaction land, owned phase moves, fresh AND on the worn worlds | No trace of his failure exists (diagnostics off). Remaining candidates: the sheet/UI layer (unmountable in this repo), or device state the export cannot specify (20 revisions, overlay content) |
| 2 | Cannot add a pre-season game | `finding-2` | **NOT reproduced** — the phase gate passes (owned phase = Pre-season) and the fixture transaction lands | The screen gate `useHomeScreen.ts:1207` silently swallows the tap when the OWNED phase is neither In- nor Pre-season — asserted as a precondition in the cell, not his coordinate here. Same no-trace problem as 1 |
| 3 | Cannot add a recovery day | none — **ruling conflict, parked** | The app OBEYS Sam's signed 2026-07-31 closure: "Recovery is not an athlete-facing session type at all: an empty G+1 Sunday is REST, which is the ruled end state." The sheet has no recovery row by ruling 9 | Supersession is Sam's call, never edited in place. §4 Q1 |
| 4 | Program adjustments error out | `finding-4a`, `-4b`, `-4-worn` | **NOT reproduced** — offered moves and removals land, fresh and worn | Same no-trace problem. Note: the alert copy his phone shows exists at `useHomeScreen.ts:1104-1123` (`classifyRebuildFailure`) — the failing layer is behind it, unrecorded |
| 5 | Cannot log fatigue or illness | `finding-5a` (fatigue), **`finding-5b` (illness) — RED, REPRODUCED FRESH** | Fatigue lands; **illness_moderate is REFUSED**: the report triggers recomposition, the deload-modified week fails the **§18 final-week gate** — `Section 18 final-week rejection (pattern_imbalance:strength_patterns:{squat:2,hinge:0,push:0,pull:2})` — and the transaction rolls back | `PROBE_5B=1 npm run test:device-pass-2026-08-05` shows the layer. **A stored athlete decision refused by a derivation guard** — the inverted shape the stage-2 checkpoint named |
| 6a | Duplicated description on the Metcon screen | `finding-6a`, `-6a-moved` | **NOT reproduced** — no duplicate fresh, nor after every offered scoped move | The promotion mechanism EXISTS (`sessionComponents.ts:397`: a conditioning-only move remainder takes the row's description as the session description; the screen renders both positions raw, `DayWorkoutScreenV2.tsx:1231` + `:2171`; the coach MetCon template writes one sentence into FOUR fields, `coachRevisionTemplates.ts:142→346/380/392/411`) — but no acted path here makes the two strings equal. Stored overlay content (unexported) and the coach template path (LR-6-frozen) are the suspects |
| 6b | "Deload:" note on non-deload weeks | `finding-6b`, `-6b-door` — **held RED as an unreached coordinate** | Generation is clean. The G-1 "deloaded" route — the one live writer with no week-kind check (`resolveDoorDeloadPolicy`, `deloadWeekRules.ts:134-146`, applied by `g1LandingAsk.ts:481-495`) — could not be reached: the G-1 protection refuses the move before the ask can offer the route | The note is persisted into `exercise.notes` with **no strip path**, and the strength applier's guard matches `/Deload week:/` while appending `Deload: …` (`deloadWeekRules.ts:208/211`) so reapplication duplicates. His overlay content (keys exported, content not) is the likely carrier. Held red so the gap cannot read as coverage |
| 7 | Athletes never see work:rest ratios | **`finding-7` — RED, REPRODUCED** | **13 offending strings** in athlete-reaching template fields — including **five template NAMES** ("MAS 15:15 Blocks", "30:30 Hard Intermittent", "Flush Intervals 30:30 / 1:1 / 2:1"), two effort cues, two restPeriods, and one signed intensity cue carrying "(Sam)": `…a 1:40 rest means the efforts must be maximal (Sam)` | Every field is workbook-equality-bound (`conditioningTemplateEqualityTests.ts:168-180`), so **no code-only fix exists** — the new rule contradicts the signed sheet and the re-sign is Sam's (§4 Q2). Work and rest already exist as separate authored fields (`workPeriod`/`restPeriod`) and `workToRest` itself is never rendered |

**Also measured, and falsified:** the one-root-many-doors hypothesis. After
acting his five removals (`userRemovalConstraintCount: 5`), **1 of 4**
recomposing doors refuses (illness), not four (`finding-worn-removals`, held
red as the measurement). The worn coordinates this suite CAN build do not
break doors 1, 2, 4.

## §3 — The coverage gaps, as first-class findings (why the device found these)

1. **The walker's action vocabulary contains none of the doors his findings
   1–5 used.** Season-phase change from profile: no action kind. Game mark:
   walked BELOW the door (`calendarStore.setGameDay` + raw `setState`) while
   the phone goes through `executeFixtureMutationTransaction`. Recovery add:
   excluded by ruling (correctly — see finding 3). Program adjustments: only
   `plan_change` add/swap/move/remove. Fatigue: no kind at all. Illness:
   a raw `setState` state-reacher writing fields (`illness`, `sleepQuality`)
   that are **not members of `ReadinessSignal`**, and `illness_moderate` —
   the tier that reds — is unreachable. The new suite's cells are the first
   acting coverage of four of these doors; **promoting them into walker
   vocabulary is the L12 answer** (below).
2. **The readiness-door suites are not in the bible.** `test:readiness`,
   `test:weekly-readiness`, `test:poor-sleep` exist ungated; the gated illness
   suites test the LAW, not the door. Finding 5 lived exactly there.
3. **The fixture-door suites are not in the bible**
   (`test:fixture-mutation-transaction`, `test:game-local-rebuild`,
   `test:preseason-subphase`, …) — the gated calendar suites are
   ownership/shape, not the add door.
4. **`workout.description`, `option.description` and `exercise.notes` are
   outside every string gate.** The projection carries only
   name/prescription/cue (`projectVisibleWeek.ts:425-433`);
   `athleteVisibleStrings` never enumerates notes or descriptions; the
   signed-copy extractor walks screens, not `src/utils`/`src/rules`. Findings
   6a, 6b and most of 7 live in exactly this carve-out — the "INPUT surface"
   exemption (`projectVisibleWeek.ts:463-473`) is where un-gated words reach
   athletes.
5. **`deloadCoachNotesTests` has no npm script**, and no gate sweeps
   HYDRATED overlay content for note/copy agreement — a stored week wears
   whatever any past build wrote, forever.
6. **Athlete-action diagnostics off on the device build** — the fourth
   sighting of the instrumentation-alive failure. The doors emit only when
   `athleteActionDiagnosticsEnabled()`; the one pass that matters ran dark.
7. **The explorer capability matrix remains ungated** — unchanged since L11
   was written (`AGENTS.md:210-219` records this as the outstanding L11 work;
   nineteen `test:explorer-*` scripts, zero in the bible).

## §4 — Parked for Sam (the review seat runs the signing session)

1. **Finding 3 is a ruling conflict, not a defect.** Your 2026-07-31 closure
   says recovery is not an athlete-facing session type (empty G+1 Sunday IS
   the ruled end state). Your device pass expected to add a recovery day.
   Which ruling stands? A new ruling supersedes; nothing is edited in place.
2. **Finding 7 cannot be fixed in code alone.** 13 strings, five of them
   template NAMES, one a signed cue with your initials — all bound to the
   workbook by the equality gate. The re-sign needs your triage of what
   counts as a ratio: `1:2` clearly; is `30:30` (work:rest seconds) a ratio?
   is `2:00` (a clock time) not? The sweep currently flags all of them on
   purpose so nothing slips while you decide.
3. **The next device pass runs with athlete-action diagnostics ON**, so any
   failing tap carries its trace. Findings 1, 2, 4 and 6a are unlocatable
   from this export; one traced tap each will name their layers.

## §5 — L12: what catches the NEXT defect of each class

- **Write-door class (1, 2, 4, 5):** the door cells in this suite become
  walker VOCABULARY (season-change, fixture-add through the transaction,
  readiness kinds through `readinessActionForKind`, screen-door dispatch) so
  the fuzzer reaches them in combination and at depth, not only at this
  suite's fixed coordinates. The §18-gate-refuses-athlete-decision class
  specifically: `finding-5b` retires only with an ownership answer (the
  7-question reassessment), not a guard.
- **Athlete-visible-words class (6a, 6b, 7):** the gate must own the words
  that bypass `project()` — either notes/descriptions enter
  `athleteVisibleStrings` (and thus L-P2 signed-words law), or the projection
  stops exempting them. A ratio-law cell moves from templates to the composed
  athlete surface the day the re-sign lands.
- **No-trace class (everything):** diagnostics on for every device pass; the
  suite's `PROBE_5B` shape (env-gated, inert by default) is the local
  precedent for keeping the instrument alive where the defect is.

## §6 — Convergence

Toward. Nothing stored was added; the suite stores nothing and derives every
assertion from acting. The two reproduced reds are both the north star's own
shapes: a derivation guard overruling a stored athlete decision (5b), and
athlete-facing words living outside the signed/derived surface (7). The
falsified hypotheses (busy_week breaks doors; removals spread the §18
refusal) are recorded so nobody re-walks them.

**No fixes were built. LR-6 was not touched. The next moves are Sam's three
answers in §4 and the ownership reassessment for 5b.**
