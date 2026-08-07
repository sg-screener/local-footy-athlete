# R5.3 — (b) IS NOT EXECUTABLE FIRST: THE DEBT DELETIONS ARE WRITER-COUPLED (2026-08-07)

# **BOTH PRE-AUTHORISED DELETIONS CAN ONLY LAND IN THE SAME COMMIT AS THE WRITER. TAKING THEM "NOW" REDS THE BRANCH — MEASURED, BOTH DIRECTIONS.**

Twenty-sixth pass. Answers inbox item 1 (b), and re-sequences it. **NOTHING
BUILT** beyond bringing the writer flag onto the branch, inert.

---

## THE ORDER

> *(b) YES — take the two pre-authorised deletions now: both entries fire
> exactly as their expiry declared; the ratchet working is never deferred. Arm
> drops to 6.*
>
> *(d) Sequence: (b) deletions → (a) restore derivation → (c) six attributed …*

(b) is ordered FIRST. It cannot be done first, and the reason is a property of
the gates themselves rather than a preference.

## THE MEASUREMENT — the parity entry, both directions

`DECLARED_PARITY_DIFF` holds one entry,
`stored_declaration_costs_mondays_power_row`. Deleting it and running
`test:derived-week-lawfulness` in both arms:

| | writer LIVE (the branch) | writer RETIRED (the arm) |
|---|---|---|
| entry PRESENT | **EXIT 0**, 16/16 | **EXIT 1** — the ratchet fires: *"a declared parity diff no longer happens … the commit that turned it green owes the deletion of its entry"* |
| entry DELETED | **EXIT 1** — the parity gate reds: *"the stored week and the derived week disagree, and the difference is NOT declared"* (`2026-08-10` materialised `Lower Squat\|7` vs derived `Lower Squat\|8`) | **EXIT 0**, 16/16 |

**All four cells measured.** The two gates pin the entry from opposite sides:
on the branch the diff HAPPENS, so the entry is required; in the arm it does
not, so the entry is forbidden. There is no state of the file that is green in
both worlds, which is precisely what a correctly-built ratchet should do — the
entry is a debt whose payment IS the writer.

**So the deletion is not deferred by taking it with the writer; it is
*impossible* to take before it.** The seat's intent — the ratchet working is
never deferred — is satisfied by landing both in one commit, which is also what
"debt only ever moves down" means here: the commit that turns it green owes the
deletion, and that commit is the writer's.

## THE SECOND ENTRY IS NOT YET SHOWN PAID, AND ITS OWN HISTORY SAYS WHY

The walker's declared red `session_list_calls_a_conditioning_day_recovery` also
stops redding in the arm. Its entry carries this note, verbatim:

> RESTORED 2026-08-05, SAME DAY IT WAS DELETED — reach came back, so the entry
> comes back … The entry was deleted (**MOVED NOT PAID**) when the choose-door
> ruling re-rolled every seeded path and neither tier deterministically built
> the coordinate.

The stale-debt ratchet asks only *did the offence occur*. It has no reach check,
so a coordinate that stopped being BUILT and a defect that got FIXED look
identical to it — the `gate-passing-on-coordinates-it-never-builds` shape, which
this entry has already been deleted under once.

Offence survey, both arms (`WALKER_SURVEY=1`):

- **Control** carries the offence: `2026-07-24 — omits ["conditioning"] invents
  ["recovery"], template ["recovery"] / projection ["conditioning"]`.
- **Arm** does not. The rest of the population is comparable (support/speed
  shapes on `2026-07-21`, `2026-07-27`, `2026-07-22`; the arm gains
  `2026-07-20`).
- Conditioning-projecting days are still built in the arm. Recovery-classified
  days are still built in the arm. **But no day in the arm is BOTH** — which is
  the exact coordinate the entry names.

**That is the MOVED shape, not the PAID shape**, on the evidence available. The
mechanism the entry blames (`buildSessionTemplate` answering `mode: 'recovery'`
from `isRecoveryWorkout` before its conditioning arms run) is in the session
template, and nothing in leg (v) touches it — so a leg (v) arm making the
offence disappear is more likely to have moved the world than fixed the
classifier.

**I have not deleted it, and I am not claiming it is paid.** Deleting it on the
ratchet's word alone would repeat, in the same file, the mistake that file
already records.

---

## THE RE-SEQUENCE, under standing law

No ruling is needed for this — the seat's intent is preserved and only the
order changes:

1. **(a) the restore derivation** — next, and substantive (below).
2. **(c) the six attributed** — set-diff then tape, the one-run method.
3. **the two deletions LAND WITH THE WRITER**, in its commit, because that is
   the only commit in which both gates are green.
4. writer re-priced on the then-current world, arm clean, writer retires.

The arm's price after the writer lands with its deletions is **6, not 8** —
which is the number the seat's (b) was aiming at. It arrives at the same place
by the only route the gates permit.

## WHAT (a) ACTUALLY IS — sized, not started

`displacedOriginalState.beforeExposureContract` is written at two sites
(`acceptedStateTransaction.ts:1330`, `:1577`) and read at one
(`reversibleAdjustmentTransaction.ts:661` → `recomposeUnrelatedReductions`).

It is **a stored snapshot of the week's contract as it was before the
decision**. Deriving it means: remove the decision, re-derive the week. That is
not a local refactor — it is **LR-29's undo-as-replay**, arriving where the
seat's own ruling said it points. The ownership half already derives
(`08212473`); this is the other half, and it is the larger one.

It is stated here so the next pass starts from a sized problem rather than
discovering it.

## NOT COVERED

- (a) is sized, **not started**.
- (c) — the six undiagnosed reds — untouched this pass.
- The MOVED-vs-PAID question on the walker entry is **argued from the offence
  survey, not settled by a probe**. A probe that reaches a recovery-classified
  day carrying conditioning in the arm would settle it; it has not been run.
- The parity measurement is one entry, one suite, four cells. It is exact, and
  it is narrow.
- **No device evidence.** Nothing has changed on Sam's phone.
