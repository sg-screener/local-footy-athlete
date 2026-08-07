# R5.3 — REDUCTION OWNERSHIP DERIVES AT READ (2026-08-07)

# **BUILT. BOTH RESTORATION CONSUMERS DERIVE OWNERSHIP FROM THE DECISION; THE MIRROR IS NOW BEHAVIOURALLY WRITE-ONLY AND EQUALITY HOLDS EVERYWHERE IT WAS EXERCISED.**

LOOP CHECK: **gate-passing-on-coordinates-it-never-builds** — sighting recorded
against myself, mid-pass. My first equality-bind run came back green across the
seat's whole ordered witness set and proved almost nothing: 35 of 37 consumer
calls compared an EMPTY set against an EMPTY set. I caught it by reading the
controls rather than the verdict, and the rest of this pass is the fix.

Twenty-fourth pass. Answers inbox item 1 (b) and (c). **BUILT into the branch**,
unflagged — the read half only; the writer is untouched, per "read side first,
writer last".

---

## WHAT THE SEAT ORDERED

> *linkedTypedReductions is a STORED MIRROR OF DERIVED ARITHMETIC … it is NOT
> filled by any route … THE UNIT: the consumers … derive the typed reductions
> from decisions + the deriver's arithmetic AT READ, equality-bound against
> current Restore behaviour on the full witness set.*

## WHAT THE CONSUMERS ACTUALLY NEEDED — one question, not a table

Both restoration consumers (`reverseOwnedReductions`,
`recomposeUnrelatedReductions` in `reversibleAdjustmentTransaction.ts`) read
`linkedTypedReductions` for exactly ONE thing: *which of this week's authorised
reductions does this adjustment own?* Neither reads a target, a metric or a
detail from the mirror — they intersect its fingerprints with the contract in
hand and act on the contract's own rows.

That question already had a decision-shaped answer, recorded as leg (iv)'s
ruling inside `decisionDerivedLinkedReductions`:

> a typed reduction belongs to the adjustment whose CONSTRAINT authored it — the
> link is `deletionIdentity ∈ the constraint ids this adjustment carries`.

So the derivation is that sentence, evaluated against the contract in hand:

```
owned(contract, adjustment) =
  { row ∈ contract.authorisedReductions
    | row.deletionIdentity ∈ adjustment.linkedUserRemovalConstraintIds }
```

No mirror, no fingerprint bookkeeping, and — the point — it cannot go stale,
because it is computed from the decision against the contract being restored.

---

## THE EQUALITY BIND — the seat's (c)

Both answers are computed at every consumer call and compared. Which one is
USED is settled (the derived one); whether they AGREE is recorded either way.

**One correction to the bind itself, made before trusting it.** The first
version compared the two RAW sets and reported 6 divergences on the deletion
suite. Reading the rows showed the mirror was naming reductions **the contract
in hand does not carry at all** — entries recorded against a week whose rows
have since been rebuilt. Both consumers filter those away before they can
matter, so the comparison had to be over **what each method SELECTS from the
contract**, not over the sets. Comparing the raw sets reds on a difference the
product never observes. Corrected, the same run is 0 divergent.

That stale half is worth its own line: **18 mirror entries in the deletion suite
alone name rows that no longer exist.** The mirror is not merely incomplete (the
40 rows from the last pass) — it is also wrong in the other direction, and both
failures are invisible because the consumers intersect it away.

---

## COVERAGE — and the vacuous-pass I refused

The first bind across the ordered witness set:

| | |
|---|---|
| consumer calls | 37 |
| divergent | **0** |
| calls whose owned set was empty on BOTH sides | **35** |
| calls that compared anything | **2** |

**Green, and nearly vacuous.** The walker — the harness carrying the 40
reduction-row worlds — reached the consumers exactly ONCE, with an
`explicit_load_edit`. `device-pass-2026-08-05`, `derived-week-lawfulness`,
`fixture-identity` and `accepted-state-transactions` never reached them at all.

**The cause is the action vocabulary, and this file's own header already names
that as a defect:**

> a state an athlete can reach that the walker cannot is a defect in the
> harness (L13), not a gap in the app.

An athlete can undo an adjustment from the week screen
(`useHomeScreen.ts:1749`). The walker had no action for it. `clearReversible
Adjustment` is awaited and `perform` is synchronous, so it cannot be a
`WalkerAction` — the same constraint that put the schedule doors in
`walkTheScheduleDoors`. So it is walked end-to-end in a new cell instead.

### The new cell — `walkTheRestoreDoorOverAReduction`

Acts from a fresh install: onboard → generate → remove sessions until the week's
contract carries an `explicit_user_override` reduction (a removal only authors
one when relocation AND substitution are exhausted, which is why no bounded
fixture reaches it) → find the adjustment claiming that constraint → **restore
through the real door** → assert.

It asserts three things, and the first two exist so it cannot pass vacuously:

1. the Restore REACHED the ownership consumers (`calls` moved);
2. at least one comparison had a NON-EMPTY owned set (`equal` moved);
3. derived and stored agreed (`divergent` did not move);

and then the visible meaning: the reduction the restored decision authored is
gone from the contract.

If the walked world never authors a reduction the cell THROWS rather than
skipping — the lighter-day door's precedent.

**Result: PASS, action walker 22/22.**

---

## THE MIRROR IS NOW BEHAVIOURALLY WRITE-ONLY

Census of `linkedTypedReductions` outside tests and instruments after this
change:

| site | role |
|---|---|
| `reversibleAdjustmentLedger.ts:237` | type declaration |
| `:400`, `:546`, `:551` | migration WRITER |
| `:496` | hydration shape guard (is it an array) |
| `acceptedStateTransaction.ts:1306/1429`, `1592/1638` | WRITERS |
| `temporarySourceFactTransaction.ts:376` | WRITER (the empty one) |
| `reversibleAdjustmentTransaction.ts:409` | **reads it only to feed the bind** |

**No product behaviour reads the mirror's content any more.** That is the state
the seat's (d) requires for it to retire with the declaration in the leg (v)
landing — the writer is untouched here on purpose.

### On `reversibleAdjustmentLedger.ts:419`, which the ruling named as a consumer

It is not a consumer of the mirror; it is a **filler** of it.
`legacyLinkedTypedReductions` reads the STORED CONTRACTS by deletion identity
and writes the result into `linkedTypedReductions` at migration and at the
hydration merge. It appeared on the census list because it consumes the
declaration — which is true — but under this ruling there is nothing to convert:
its only output is the mirror, and the mirror is now unread. **It retires with
the mirror, in the same landing, rather than being taught to derive.** Naming it
as converted would be claiming work that does not exist.

---

## THE ENDORSED COMPRESSION, BUILT

The seat endorsed the `a-count-taken-for-a-record` compression and ordered it
built as part of this unit's harness work. Both halves landed:

- **`src/dev/measure.ts` — `Tally`.** It cannot report a bare number: every
  `add` supplies the domain object's identity, and the serialised form always
  carries `occurrences`, `distinct`, and the NAME of the dedup key. Where two
  identities are meaningful (a reduction row and the decision behind it), both
  are counted, so "40 rows from 23 decisions" is the cheapest thing to write.
  Breakdowns are counted in DISTINCT terms so ranked lists never inherit the
  occurrence inflation.
- **`AGENTS.md` — "A count names the instrument's unit, not the domain noun"**,
  with all three sightings and what the third one cost.

---

## THE GATE, AND THE BIND ACROSS ALL 156 SUITES

`scripts/sweep.sh`, whole bible, derivation LIVE and unflagged:

**`SWEEP RESULT: failures=2 of 156`** — `test:program-control-durable` and
`test:fixture-identity`, **exactly the set `docs/NOW.md` already declares.**
0 new, 0 fixed. The build is free.

The bind over the same run:

| | |
|---|---|
| suites that reach the ownership consumers at all | **5 of 156** |
| consumer calls | 45 |
| **divergent** | **0** |
| comparisons with a NON-EMPTY owned set | 4 |
| rows selected — derived / stored | **10 / 10** |
| mirror entries naming rows the contract no longer carries | **26** |

The five: `athleteSessionDeletionTests` (18), `athleteSessionMoveTests` (17),
`athleteActionWalkerTests` (4 in each of two processes — the new cell), and
`readinessSourceFactOwnershipTests` (2).

**Read this honestly.** Equality is exact wherever it was tested — 10 rows
selected on each side, never a different row — but only **4 of 45** calls had
anything in the owned set, and that is after the new cell doubled the walker's
contribution. The bind is a real proof over a genuinely narrow set, and the
narrowness is a property of Restore itself: most restores undo a relocation, and
only an exhausted removal authors a typed reduction at all.

## CONTROLS

- **The bind is always on in-process** and only its WRITING is flag-gated. A
  bind whose comparison were itself flag-gated could not be relied on to have
  run.
- **Divergences travel with their rows** — week, adjustment kind, constraint
  ids, both selected sets, and every reduction row in the contract. A count of
  divergences would be the error this unit just paid for.
- `test:compile` **EXIT 0**.

---

## NOT COVERED

- **`explicit_load_edit` adjustments own no constraint id**, so derived
  ownership is empty for them by construction. Measured, not assumed: every
  such call in the witness set was empty on the STORED side too, so nothing
  changes today — but an `explicit_load_edit` that ever recorded a reduction
  matching a row in the contract would diverge, and no world in the witness set
  produces one. That is the sharpest remaining edge and it is stated, not
  papered over.
- The new cell walks ONE reduction-authoring removal, not the 40 rows. It makes
  the class reachable; it does not sweep it. Across all 156 suites only **4 of
  45** consumer calls compare a non-empty set — the bind is exact but narrow,
  and no claim here rests on it being broad.
- **Only 5 of 156 suites reach the restoration consumers at all.** Restore is
  thinly walked in general, which is a coverage fact about the harness that this
  unit surfaces but does not fix.
- The **writer is untouched** — the mirror is still written by five sites and
  still goes to storage. It retires with the declaration, per (d).
- The 3 deep-walker direct-transaction worlds are now reachable in principle
  through the new cell's route but are not individually pinned.
- **No device evidence.** Nothing has changed on Sam's phone.
