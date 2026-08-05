# R1.3 fallout triage map (working tree UNCOMMITTED; boot core green)

## Green already
- quiescent-boot 4/4; accepted-state-transactions 43/43 (anchor rides the one
  publication via normalizeAcceptedProgramSurfaces pass-through);
  program-control-durable 19/19; compile gate green; decision-ledger,
  derived-week, door-append green.

## Remaining triage (world-follows-product; assertions move ONLY with the
## Option B ruling cited; supersession discipline)
1. runSlice1 / slice4PersistenceProbe (CURRENT): scenarios
   canonical-program-rehydrate + legacy-program-rehydrate +
   post-rehydrate-edit-rebuild plant OLD envelopes and assert the L15 lift
   restores workouts. Rework: hydration restores NO outputs; old envelope
   PARKED byte-identical (PRE_REBUILD_ENVELOPE_PARKING_KEY from programStore);
   legacy-lift semantics become a DECLARED R2 obligation (note in probe).
   Invariants live in invariants/pathEquivalenceInvariants.ts (legacyHydrate
   :280, modernWins :291, scalarNonAuthority :303, postRehydrate :316);
   scenario registry in types.ts + expectations/slice4Rules.ts; probe:
   observations/slice4PersistenceProbe.ts run() :222.
2. hydration-upgrade-path: 2 fails (details not yet pulled).
3. hydration-refusal-quarantine: 2 fails.
4. action-walker: 1 fail.
5. device-pass day suite: 3 fails.
6. evening suite: 4 fails — likely DECLARED-RED-NO-LONGER-REDS (ratchet
   firing on greened cells) + world-builder asserting acceptedMaterialContext
   in envelope (relaunchThroughHydration). Rework world-building to new boot;
   DELETE the greened declared-red entries in the same commit (evening-0,
   evening-1 structurally; evening-4 write-bill likely green — decisionKeys
   must add decision-ledger-store as the decision's own store).
   evening-2/3 (conflicted) stay RED until the revision check retires (R1.4b,
   after this triage; fixtureMutationTransaction.ts:176-187).

## Key design facts for continuation
- serializeProgramStoreEnvelope reduces EVERY program-store write to inputs
  shape; parkThenReduceProgramEnvelope parks old-shape disk before overwrite.
- Boot = gate → runQuiescentBoot = park + rebuildDerivedWorld (clean-slate
  reset, generate with generationAnchorISO + hydratedSeasonPhaseClock, replay
  ledger under latch; latch drops ALL durable writes + quiets the ring).
- Cell law: byte-identity is CONTENT identity (zustand write-back reorders
  keys); log key exempt with 8KB growth bound; write budget 32KB non-log.
- generationAnchorISO: stamped via proposal in commitRebuiltProgram, carried
  by AcceptedProgramSurfaces + AcceptedProgramSurfaceSnapshot + normalizer.
- After chain green: commit R1.3, THEN R1.4b (retire revision-conflict check,
  green evening-2/3, delete those declared reds same commit), THEN work-bill
  generalisation, checkpoint update, memory update, STOP for Sam's
  fresh-install pass (R1 gate). Deferred to R2+: LR-27 parked-envelope note;
  onboarding-path generation anchor stamp NOT-COVERED note.

## SESSION 1 TRIAGE PROGRESS (update before handover)
GREEN since map written: runSlice1 (slice-4 probe reworked onto canonicaliser
+ boot law), hydration-upgrade-path 4/4 (park law + canonicaliser vehicle),
hydration-refusal-quarantine 3/3 (seam re-seated at writer boundary; material
= inputs; carriesMaterial knows both shapes), accepted-state-transactions
43/43 (anchor rides the one publication), quiescent-boot 4/4, compile green.

KEY ADDITIONS since map: trackDurableWrite exported + programStateStorage
tracks the WHOLE setItem body (park prelude was invisible to flush — real
data-loss-guarantee defect, fixed); generationAnchorISO now stamped BY
GENERATION ITSELF (TrainingProgram.generationAnchorISO, generateProgramLocally
:~990) because the walker's selectedDate drifted from generation's todayISO;
commitRebuiltProgram prefers program.generationAnchorISO.

WALKER (action-walker) still 4 FAIL, all one thread — worlds now COMPLETE
onboarding (profileFor got firstName/heightCm/weightKg; In-season forces a
game day; pre/in-season forces ≥1 team day; tapeWorldProfile respects
override game days; completion refusal now THROWS in world-builder):
1. L16 SLICE relaunch week differs ENTIRELY — boot regenerates a different
   base program despite anchor fix. NEXT DEBUG: print pre-relaunch
   state.generationAnchorISO + program name vs post-boot; suspects: ambient
   boundary defaults at boot generation (athletePrefs, coachUpdates), block
   bounds (options.blockNumber/blockStartISO defaults vs walker's original
   call), bakeMicrocycleStrengthProgression inputs, rollover interplay.
2. SEED 2 walk: door threw 'Required core work could not be relocated' —
   world changed (profiles now complete), may be a REAL door refusal shape
   the walk must treat as an answer not a crash, or a legit red.
3. charter cell: In-season world now hits 'game day - can't add here' —
   target date addDaysISO(weekStart,5)=Saturday=game day now that the world
   HAS a game day; pick a non-game target date.
4. declared-red ratchet: session_list_has_no_representation_for_speed_work
   went GREEN (worlds complete now reach it) — DELETE the entry per ratchet.
REMAINING after walker: device-pass day (3 fails), evening suite rework
(world-builder relaunchThroughHydration + declared-red deletions), then FULL
CHAIN, commit R1.3, then R1.4b revision retirement (evening-2/3), work-bill,
checkpoint docs, STOP for Sam.

## L16 DIVERGENCE — where session 1 stopped (the live thread)

The L16 relaunch cell reds with the SAME program identity and weeks
(anchor round-trips: generation stamps generationAnchorISO, boot regenerates
with it) but a completely different RESOLVED week — before is a strength
split with team nights placed, after is Gunshow/Prehab/conditioning-heavy.
Established: NOT the clock (the slice now pins __LFA_DEV_E2E_CLOCK_RECEIPT__
to the world's day, cleared in finally); NOT the anchor; NOT the profile
(same store). Remaining suspects, in order: (1) act-time vs boot-time
ORDERING of the §18 accept-and-reduce rebases — act ran commit(selected =
generation day) then advance then the delete's own transaction; boot runs
clean-slate commit(selected = today) then replay — the gateway recomposition
differs; (2) the replayed delete triggering whole-week repair against a
freshly generated world ('Required core work could not be relocated' in
SEED 2 is the repair engine speaking); (3) exposureContractV2 baking
differences between the two commit paths. The differential is DOING ITS
JOB: act-vs-replay equivalence is not yet closed for §18-recomposed worlds.
Debug by diffing the two worlds' weekScopedOverlays for the fingerprint week
and the gateway's rebase inputs at each commit.

Also note: profileFor's rng CONSUMPTION ORDER changed (seasonPhase drawn
first now) — deterministic seeds roll different worlds than before; some
walk-cell deltas stem from re-rolled worlds, which is legitimate but worth
knowing while triaging. The declared-red ratchet hit
(session_list_has_no_representation_for_speed_work went green) needs its
entry DELETED in the R1.3 commit per the ratchet's own rule.

## SESSION 2 TRIAGE — COMPLETE (all suites green; full chain running)

THE L16 ROOT CAUSE: `resetStoresToFreshInstall` never reset the DECISION
LEDGER (the R1.1 store, born after the reset list) — every prior cell's landed
decisions replayed into the L16 world at boot (entry ids dl-156+ in a world
whose own history was ONE delete), recomposing the whole week. One-line fix in
the shared reset owner, through the ledger's own reset door. Receipts proved
generation identical (anchor + clock + base microcycle) and boot:pre-replay
resolved ≡ act-time resolved; only replay diverged. The constraint-record
byte-identity assertion then moved to the ruling's shape: the LEDGER
round-trips byte-identical; the derived removal-constraint record is held to
the projection's two declared normalisations. L16 both loops GREEN.

WALKER FIXES (world-follows-product):
- mark_calendar 'game' now enters the FIXTURE DOOR (`executeFixtureMutation-
  InMemory` — the interpreter boot replays), not the compatibility
  `setGameDay`. Fifth harness-below-the-door sighting. SEED 2's throw became a
  typed `impossible` answer.
- charter cell frees a day through the bin door before the add (In-season game
  weeks compose full).
- conformance cell (Sam's export-8 shape) reaches all 4 marks again.

TWO PRODUCT DEFECTS FOUND AND FIXED under the walker's light:
1. `deriveAcknowledgedCoachNote` (fixture door, both twins) ran a coach-note
   constraint upsert whose accepted-equivalence sweep covers EVERY week and
   THREW on week-away shortfalls — a landed athlete fixture add crashed on its
   own acknowledgement note ("a note is output, never evidence"). Note
   derivation is now total: a note that cannot derive is a missing note on the
   tape, never a veto.
2. The weekRebuild publication sites never STATED their operation, so the
   equivalence gate's `?? 'restoration'` default THREW on a repaired week's
   disclosed shortfall — the conformance cell measured a game add Sam's real
   phone performed and kept coming back "impossible"
   (`AcceptedStateLedgerMismatchError`, `required_minimum_shortfall`). All
   three sites now declare `operation: 'forward_decision'` per the signed
   accept-and-reduce law (Sam 2026-07-29); restorations still declare
   themselves at the adjustment ledger's own commit and still throw.

DEVICE-PASS DAY 17/17: the three worn cells moved onto the boot law — the
legacy constraint rides the PARKED old-shape envelope to R2 (byte-identical,
asserted), never the derived world; doors land on the derived world.

EVENING SUITE EXIT 0: evening-0/1/2/3 GREEN STRUCTURALLY — the quiescent boot
paid all four (no minted revisions: boot idempotence asserted across two
launches; no ring flood: tap trace survives 10 relaunches; no revision skew:
the first-rendered world IS the derived world, so the fixture taps carry a
revision nothing moved — green AHEAD of R1.4b). Their declared-red entries
DELETED per the ratchet. evening-4 still reds DECLARED: the delete's bill
still writes 6 mirror stores (calendar/readiness/coach-updates/mutation-
history/coach-prefs/profile x1 each, 134 KB); `decision-ledger-store` added to
the decision's own keys (R1.4a). The mirror-store bill is the R5 deletion's
subject.

DECLARED-RED LEDGER MOVES (walker):
- `session_list_calls_a_conditioning_day_recovery` RESTORED (deleted earlier
  same day for lost reach; bounded SEED 8 now builds the deletion note's own
  suspected coordinate — G+1 add via keep_the_day).
- `session_list_drops_conditioning_attached_to_an_appointment` redsIn
  'both'→'deep' (bounded re-rolled off it; deep + the matrix still reach it).
- `session_list_drops_a_team_night_stack_and_badges_support` DELETED
  MOVED-NOT-PAID (neither tier reaches it); matrix blind spot repointed at the
  conditioning constituent.
- NEW `composed_optional_marker_survives_a_stacked_combination` (L-P6, deep
  SEED 3, 67 actions): the marker-leak class paid 2026-08-01 at one site,
  alive at another.
- athleteSessionMoveTests cell 21: durable acknowledgement moved to the
  DECISION (ledger envelope); the restore's missing durable record is PINNED
  as R1's declared reversal-producer gap (reds when LR-29's heir lands).

STILL OPEN FOR SAM / LATER SLICES: the `?? 'restoration'` DEFAULT on the two
commit-site asserts contradicts the "no default here" comment on the assert's
interface — reclassification was applied only at the weekRebuild owners;
whether the default itself should die is a ruling. The durable door does not
AWAIT the decision-ledger flush before returning success (the program-store
barrier predates the ledger); noted for R1.4b/work-bill.

## Working-tree state at handover (UNCOMMITTED, chain red at action-walker)

Everything in this file's earlier sections is IN THE TREE, uncommitted:
ledger replay latch (ledgerReplayLatch.ts), quiescent boot
(store/quiescentBoot.ts), programStore persist flip (partialize/merge,
boundary park+reduce, carriesMaterial both shapes, whole-body write
tracking), anchor stamping (types/domain.ts + generateProgram.ts +
weekRebuild.ts + acceptedStateColdStart.ts + acceptedStateTransaction.ts),
gate wiring (appHydrationGate.ts), suite reworks (slice4PersistenceProbe,
hydrationUpgradePathTests, hydrationRefusalQuarantineTests,
quiescentBootTests + package.json chain entry), walker world-fidelity fixes.
Commits R1.1 `52e0e0c` / R1.2 `fe7e299` / R1.4a `c0a9ae0` are already in.
Verify branch feat/stage-b-stage2 before every commit; full chain green
before any commit; run gates bare (never `; echo EXIT $?`).
