# Stage B §5 preconditions — report, 2026-08-03

**Read-only. Stage B is NOT started; Sam fires it himself** (standing order,
and the addendum's own §5 header: "Do not start until the preconditions in §5
are green"). This report states pass/fail per precondition against main at
`fb5ca25`, and nothing in it authorises a first commit.

Source of the criteria: `docs/STAGE_B_KICKOFF_ADDENDUM_2026-08-03.md` §5.

---

## RE-RUN AFTER LR-1 MERGED — the runway reads zero-asterisk

**Re-checked 2026-08-03 against the finished tree** (`feat/lr1-program-store-door`
merged; `docs/LR1_PROGRAM_DOOR_BOUNDARY_2026-08-03.md`). All four preconditions
still PASS, and the one carried caveat is GONE:

- **§5.1's carry is PAID.** LR-1 proper is built. The 27 `.setManualOverride`
  references are zero; `programStore` has a door
  (`applyProgramOverrideSliceWrite`), two typed refusals, every writer named on
  the tape, and a closed writer union that makes an anonymous write a COMPILE
  error. Census LR-1 27 → 0 and LR-2 1 → 0, baseline 104 → 76, both entries
  `retired`. **Twelve of twelve persisted stores are now owned, taped and
  quarantined, or retired.** §5.1 no longer relies on the addendum's narrowing:
  it passes on the STRICTER reading the original NOT-COVERED section flagged.
- **§5.4 re-run on the finished tree: `test:bible` EXIT=0**, every one of the
  74 suite totals reporting zero failures, with the new
  `test:program-override-ownership` (7 cells) inside the chain and the deep
  walker tier green (3 walks × 90 actions, ≥4 weeks of clock per walk, 17/17).
- §5.2 and §5.3 are unchanged and still merged.

**ONE THING STAGE B'S FIRST SESSION MUST READ BEFORE ITS FIRST COMMIT**, and it
is new knowledge that did not exist when this report was first written:

> **No walked athlete tap door writes `dateOverrides` any more.** Adds and swaps
> land in `weekScopedOverlays`; deletions record a `UserRemovalConstraint`. The
> surviving writers of the surface the census calls "the athlete's decision
> surface" are the coach pipeline, the lighter-day transaction and LR-3's §18
> residuals. Whether `dateOverrides` is still a decision ledger or has become a
> stored-OUTPUT surface is **PARKED FOR SAM** — and Stage B derives over these
> surfaces, so the answer changes what it derives FROM.

Stage B is still NOT started. Sam fires it.

---

## §5.1 — Store armour proven + the stores Stage B writes through armoured

**PASS.**

- The recipe exists, is proven, and carries 13 numbered lessons:
  `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`.
- **Eleven of twelve persisted stores are owned, taped and quarantined.**
  `UNPROTECTED_STORES_DEBT` is the **empty list** — the 2026-07-30 declared
  debt ("eleven stores are still wipeable") is paid to zero. Two of the
  twelve were RETIRED rather than armoured (auth, ui — Sam's §6 ruling), so
  the audit now enumerates ten live stores, all protected.
- The generation/rebuild path Stage B builds on writes **only** through
  `commitAcceptedStateTransaction` (`weekRebuild.ts:714/809/822`); it never
  touches the raw primitive. Verified by grep, not assumed.
- `athletePreferencesStore` (named in the addendum) is armoured, including
  the last-answer-removal correction (lesson 11).

**Carried, not blocking (the addendum narrows §5.1 to exclude it):** LR-1
proper is unbuilt — 27 `.setManualOverride` references survive across 12
files, concentrated in the coach pipeline (`coachActions.ts` 20,
`applyAdjustmentEvents.ts` 9, `coachUndoEngine.ts` 6,
`coachModalitySwapOrchestrator.ts` 6) plus one screen
(`PlanChangeSheet.tsx`) and the dev seed. Census LR-2 stands at
`declared: 1` — that single count IS the program store, and it is LR-1's
unit.

## §5.2 — Schedule-fact deriving-lane build MERGED

**PASS.** `667e3a3`. The ruled effect owns the commit lane; the dead
always-refusing third lane is DELETED (zero guards); short-on-time derives
the compressed session under the existing 35-minute owner; busy/travel/
max_sessions/equipment commit inert and honest. Sam's §7 addendum merged at
`b2fc742`: on a fixture day the fact records inert and the athlete gets the
signed sentence. Copy Batch 9 SIGNED.

## §5.3 — Team-night movability MERGED

**PASS.** `ce8ad9a`. MOVE raises the typed once-or-permanent ask (routeless
never commits); SWAP stays refused; the one-off rides the approved deriving
lane, the permanent route rides the single setup owner confirmed inline. All
seven strings signed (Batch 10); three riders PROPOSED and parked (§8).

## §5.4 — `test:bible` EXIT=0 on main, declared reds listed

**PASS — and STRENGTHENED after this report was first written.** Sam's §9
answer (2026-08-03) made TOTALS-OR-RED law for the whole chain, and the
rollout is complete: **all 120 chain suites are armed and gated**
(`test:totals-or-red-law`, itself in the chain). A suite can no longer exit 0
without reporting, so the class of unknown that this section originally had to
disclose is now structurally closed rather than merely repaired in one suite.
Final run at `1920d4e`: **EXIT=0**.

Three things the rollout found, none of which existed as knowledge when §5.4
was first assessed:
- **A second silent suite, worse in kind**: `durableFactHorizonTests` forks a
  child per scenario and trusts the child's exit code; each child returned
  past its only clear, so armed, all 14 came back RED while printing PASS.
  Parent verdict and child output had been disagreeing outright.
- **The law had a bypass**: `process.exit(0)` hard-overrides
  `process.exitCode` — proven by a mutation that SURVIVED. Fourteen suites
  carried the construct; all are deleted and the gate bans it.
- **The chain's FIRST LINK was never armed**: `runSlice1` runs by direct
  invocation rather than an npm script, so every script-enumerating sweep was
  blind to it. The gate found it on its first run.

**The original §5.4 assessment, kept as the record:**

- `test:bible` **EXIT=0** at `fb5ca25`, zero failures across the whole chain.
- **The asterisk is removed.** `onboardingReliabilityTests` had been exiting
  0 **half-run** since `ea2dba3` (2026-08-01) — three days in which the
  bible read a drained event loop as green. Bisected, repaired, and now
  runs 24/24 INSIDE this chain. Every EXIT=0 claimed between 08-01 and the
  fix carried that unknown; this run does not.
- **What the silence masked, and it was real:** every armoured store's
  guarded storage wrapped its write `async`, and zustand fire-and-forget
  `void`s `setItem` — so a failing device write became an **unhandled
  rejection on the exact path the armour exists to protect**. Fixed at one
  owner (`guardedDurableWrite`), nine wrappers delegate, B2 is the
  regression gate.

**Declared reds standing on main:** none in the bible chain. The two
schedule-fact declared reds (1 and 2) were PAID by §5.2's build and deleted
as paid. Non-bible reds carried, each proven pre-existing at clean main in a
detached worktree, none owned by this shift: `test:block-state` (equipment
fixture rot), `fixtureMutationTransactionTests` (13 fails, equipment
`ProgramGenError`), `programControlActionsTests` (orphan suite, no script),
`devE2EDefaultSeedInstallationTests` (seed witness). All belong to LR-14.

---

## Verdict

**All four §5 preconditions PASS.** Stage B is unblocked by its own terms.

It is NOT started, and this report does not start it. What Stage B's first
session should read before its first commit: the addendum whole (its §3
narrowing, §4 open questions Sam must rule, §6 acceptance bar), the north
star, and `docs/STORE_ARMOUR_RECIPE_2026-08-03.md` (Stage B writes through
armoured doors — the recipe explains what those doors refuse and why).

## NOT COVERED

- **No device pass.** Every finding here is source-and-gate evidence. Per L4
  the device is arbiter and per L10 nothing is "done" until Sam's phone says
  so — including the eleven armoured stores and both signed builds.
- **The §5 criteria are read as written.** Where the addendum narrowed a
  draft precondition (LR-1/LR-2 → "the stores Stage B writes through"), this
  report follows the narrowing rather than the draft; if Sam intended the
  stricter form, §5.1 is a FAIL on LR-1 and Stage B waits.
- **The bisect bounded the silence to `ea2dba3`** by first-parent probing,
  not by testing all 16 commits in the range — the earlier boundary
  (`49c8579` prints totals) and the merge itself are proven; a finer cause
  inside that mega-merge was not isolated.
- **The armour's device behaviour under real write failure is untested on a
  phone.** B2 proves the code path in a harness with injected `disk_full`.
- Four cwd-class incidents and two node_modules destructions happened during
  this shift's parallel work; the ignore hardening closes the mechanism, but
  no gate proves an agent cannot damage a shared checkout — that is process,
  not code.
