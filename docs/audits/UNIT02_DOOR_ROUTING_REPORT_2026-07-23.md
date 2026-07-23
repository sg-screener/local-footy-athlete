# Unit 0.2 — Door-routing (R16): terminal status report (verbatim, 2026-07-23)

Preserved from the Opus terminal session (chat accidentally closed).
Cowork review verdict 2026-07-23: conformant; stages A–E approved as
built; unit NOT merged — finding #4 is the merge blocker; diagnosis-only
follow-up unit ordered (see ILLNESS_CLEAR_LEDGER_REASSESSMENT_2026-07-23
when it lands). To be committed by a terminal docs pass.

---

Branch diagnose/move-occupied-content-loss, 5 staged commits on top of
c4ba0fe. Tests-first throughout, gates green at every stage. STOP for
review — finding #4 is NOT closed and blocks merge.

## What was built (tests-first, staged)

| Stage | Commit | What | Device finding |
|---|---|---|---|
| A | 5715366 | Retire the day-card pick_wellbeing/shutdown_week subtree (+ its dead injury flow); route "I'm not 100%" → the single week owner via onOpenReadiness. Extract the tier→action mapping into a pure single owner readinessActionForKind. | #1 (bed-ridden hard-fail), #5 (clear-to-rest wording deleted) |
| B | 5a90beb | Redesign the sheet to 3 russian-doll buckets (Feeling flat / Sick / Something hurts), distinct icons, "Short on time" removed (prop + wiring), SheetOption subtitle. Sam's Sick ruling: two sub-options. | #6 (flat 9-list), X2 |
| C | 179f484 | Typed readinessKind:'illness' discriminator + pure readinessBodyLead (never "you said you're cooked" on illness); ack surfaces the authored disclosure. | #2 |
| D | 184b7df | Day card renders sessionTier==='optional' as optional, not prominent CORE. | #3 |
| E | 89d4536 | resolveVisibleReadinessState owns 'illness' (was excluded) so the card surfaces + owns the illness clear. | #4 (PARTIAL) |

Gates (final): readiness-ownership 19/19 · weekly-readiness 17/17 · §18
ownership 12/12 · illness-recovery-mode 5/5 · tsc exit 0 · test:bible
exit 0. R16 (two-door single-owner equivalence across all tiers) +
inverted weeklyReadinessCardTests + repointed activeCoachNotesTests all in.

## Device re-pass (iPhone 17 Pro sim, seed standard-in-season-week)

Verified working on device:
- #1 — day-card "I'm not 100%" opens home-week-readiness-sheet (no
  pick_wellbeing/shutdown_week).
- Redesign — 3 buckets, distinct icons, no "Short on time"; Sick → 2
  sub-options; "Properly sick" subtitle reads "Nothing will be required
  this week — gentle optional work if you're up to it."
- #2/#5 — ack surfaces the severe-illness disclosure verbatim; coach note
  reads "You said you're sick" (not "cooked").
- R19 — illness now surfaces as the active card state ("Under the weather
  this week") with a clear keyed to the illness factId.

## 🔴 Finding #4 is NOT fixed — merge blocker

On device, after the readiness-card clear of a severe illness: the week
reverts (adjustment-restored fires) but the illness fact stays active
(readiness-active-…illness… witness + "Recovery mode active" coach note
persist). The R19 fix (card ownership) was necessary but insufficient —
and the R19 unit test had a fidelity gap (it used the seed() harness with
a null composition base).

Root cause, diagnosed with evidence: on a real acceptedCompositionBase,
the fact-resolve inside clear_fatigue_status
(programControlActions.ts:1342) fails after the cascade revert. A
device-exact repro threw "Accepted-state ledger mismatch: persisted and
visible ledgers differ" on the illness_recovery week (persisted
activeRecovery:1/moderateDays:1 vs visible activeRecovery:2/
moderateDays:0). That persisted-vs-visible ledger divergence is what
rejects the resolve, leaving the fact active.

Per the CLAUDE.md escalation rule this is the textbook "the intent is
understood correctly but a later layer blocks it" case — stopped rather
than guess-patch the trust/coach pipeline. Fixing it needs (a) a faithful
failing reproduction (the seedDeviceExact repro currently throws at
commit, a different point than the device resolve-failure — a
harness-fidelity gap), then (b) the resolve/ledger fix (candidate
directions, unvalidated: resolve the fact before the cascade revert; or
fix the illness_recovery persisted/visible ledger count divergence).

## NOT COVERED (L2)

- Finding #4 resolution — diagnosed, not fixed (above). Blocks merge.
- Finding #3 on device — the optional-session render was not visually
  confirmed on device (illness was cleared before inspecting the day
  card); unit-covered (bible D6 proves the sessions are optional-tier;
  the render branch consumes it) but not device-verified.
- Cold-start / non-seeded pass (L3) — not run; only the seeded
  standard-in-season-week harness.
- The other doors/tiers on device — only the day-card→sheet route and the
  severe-illness (Properly sick) tier were driven on device;
  Feeling-flat tiers, sniffle, and "Something hurts"→injury were not
  tapped through.
- Coach-note clear path — a pre-existing residual (flagged in Stage C/E):
  clear_fatigue_status by constraint id is ambiguous when >1 fact shares
  a window; the card clear (by factId) is unaffected but the coach-note
  "I'm good now" path was not exercised.
- activeCoachNotesTests — already red at c4ba0fe (11 pre-existing
  failures, crashes before §9); stale day-sheet assertions repointed but
  the unrelated crash not fixed. Not in test:bible.
- Everything outside this unit (Groups E/F/G, move-chain, cold-start
  onboarding, etc.).

## Terminal state (L10)

Stages A–D and the R19 card-ownership layer of E are gates green,
awaiting Sam device acceptance. But the whole unit does not merge:
finding #4 (a trust-layer intermittent) still reproduces on device, and
per the standing rule an intermittent at the trust layer does not ship.
