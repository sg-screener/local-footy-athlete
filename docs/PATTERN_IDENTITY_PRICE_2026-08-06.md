# CONDITION 1 — FINAL FORM — PATTERN IDENTITY — 2026-08-06

Condition 1 of `docs/PATTERN_IDENTITY_RULING_2026-08-06.md`: *price the full
set with the stored-contract input retired. Green → build. Not green → STOP
with the residual named.*

**The priced set does not green. Nothing was built. Nothing was merged.** The
tree this document lands on is clean. The scaffold is preserved on
`scratch/r53-pricing-3-scaffold` (`bd6dccb3` … `f0dace20`).

**The residual is named, and it is one sentence: the DERIVER CANNOT RE-PLAN.**
That is §4 and it is the point of this document.

**A correction the last report owes, first**, because it changes what the seat
was ruling on.

---

## 0. CORRECTION — the pin was never the thing that moved

`docs/RESOLVED_AUTHORITY_REPRICE_2026-08-06.md` and its commit said *"leg (i)
alone moves the athlete's Monday from `Lower Squat|8` to `Lower Hinge|7`"*.
**The direction was wrong.** `diffWeeks(world.deriver, world.atTheTap)` prints
the DERIVER on the left. The deriver's Monday is `Lower Squat|8` — the pinned
value — in every variant measured, and `assertOneComposer`'s own
deriver-first assertion never fired. What reads `Lower Hinge|7` is the
PUBLISHED week.

Two consequences:

- **Cells 5/6 need no re-pinning.** The ruling authorised a re-pin; the
  measurement says it would be a no-op. `DERIVED_MONDAY = 'Lower Squat|8'`
  already IS the derived week's literal value, in both orderings, with the
  stored contract retired. No witness was edited and none needs to be.
- The ruling's premise — that retiring the stored input changes which patterns
  land on which days — is **confirmed, but on the publisher's side, not the
  deriver's.**

---

## 1. Step 1 of the cells 5/6 procedure — PASSED in the pin's world, 8/8

`npm run test:derived-week-lawfulness` (new, on the scaffold branch) is the
ruling's step 1, and it runs before any pin moves. In W2 (removal then fixture)
and W2r (fixture then removal), with the stored contract retired:

```
  PASS W2  lawful-1  patterns legal and balanced       ledger {squat:1,hinge:0,push:1,pull:1}
  PASS W2  lawful-2  §18 green, zero unresolved shortfall
  PASS W2  lawful-3  byte-identical across two derivations AND a relaunch
  PASS W2r lawful-1 / lawful-2 / lawful-3
```

Two corrections were required to get there, and both are keepers whatever the
seat rules next:

1. **The derived contract must read the DECISION ledger.** Leg (i) withholds
   the contract write, so the athlete's removal never lands in the stored
   contract — and the derived contract inherited nothing, leaving the week
   three sessions against a selected four with no authority for the gap.
   `deriveWeekContract` now reads the persisted `UserRemovalConstraint` and
   applies the app's existing owner, `applyAthleteRemovalTypedReduction`. This
   is the north star at this seam: derive the reduction from the DECISION,
   never from a stored copy of its arithmetic.
2. **`declaredSubphase` follows the DERIVED anchor state.** Carrying the stored
   contract's `expectedSubphase` made every derived practice-match week red on
   `phase_subphase_policy_mismatch` — the expectation is a function of the
   derived identity, so the contract disagreed with itself.

**Determinism, the ruling's third ground, HOLDS on the week** — two consecutive
derivations and a relaunch are byte-identical. One thing to name: the deriver
mints **146 wall-clock stamps per derivation (4 distinct)**, so raw bytes
differ by milliseconds while describing the identical week. A `createdAt` on a
derived row records WHEN the derivation ran, which is not a property of the
week — stored-output shaped, and the same north-star smell one layer down. The
proof normalises the stamps and reports them by name rather than hiding them.

---

## 2. The measurement — condition 1's own witness set

| witness | condition 1 requires | measured |
|---|---|---|
| `test:fixture-identity` | **6/6** | 3 passed, **3 failed** (3, 5, 6) |
| `test:athlete-session-deletion` | **24/24 · 5/5 · 3/3** | **19/24** · 5/5 · **3/3** |
| `test:accepted-state-transactions` | full | **22/23** · **9/10** · 10/10 |
| `test:phase-structure` | 11/11 with cell 8 | **11/11** ✔ |
| `test:action-walker` (L16) | 20/20 | **20/0** ✔ |
| `test:action-walker:deep` | 20/20 | **19/1** |
| `test:derived-repair-ownership` | able to red | 4/0 — **not able to red** |

**Condition 1 is not met.** Two of seven witnesses are clean.

The mutation witnesses hold at **3/3** and the deletion properties at **5/5**,
so the resolved-authority ruling's §2 remains free, exactly as the third
pricing measured.

The deep walker's single failure is attributed, not assumed: the same run with
every flag off prints **20 passed, 0 failed**, so `L-P3 TEMPLATE = PROJECTION`
(*"the session list omits `["speed"]` and invents `["support"]`"*) belongs to
this scaffold.

`derived-repair-ownership` printed **4 passed, 0 failed on a tree with eleven
red witness cells** — an eighth sighting of
`gate-passing-on-coordinates-it-never-builds`. Condition 1 asked whether it is
able to red; on this evidence it is not. I did not run a mutation to prove the
capability, because with five other witnesses red the verdict cannot change and
a run that adds nothing to a decision is not evidence.

---

## 3. Leg (iii) at the PUBLISHER — installed, measured, and it is not the answer

The obvious next move was that the publisher still conformed against the STORED
contract while the deriver read the derived one. So leg (iii) was installed at a
third site: `buildFixtureMinimalReplan` replaces its microcycle's contract with
the derived one once at entry, so its six downstream readers cannot disagree.

**It moves fixture-identity by nothing.** The residual is not which contract the
publisher conforms against.

---

## 4. THE RESIDUAL — the deriver cannot re-plan, and that is what the stored contract was buying

Instrumented on cell 3's world (a fixture and nothing else), the whole thing is
visible in three lines:

```
BEFORE THE ADD   Mon Lower Squat|8   Tue TT+Upper Pull   Wed Prehab|5   Thu TT+Upper Push   Fri Lower Hinge|8   Sat REST
PUBLISHED        Mon Lower Hinge|7   Tue TT+Upper Push   Wed Prehab|6   Thu TT+Upper Pull   Fri Gunshow|6       Sat Game Day
DERIVED          Mon Lower Squat|8   Tue TT+Upper Pull   Wed Prehab|5   Thu TT+Upper Push   Fri Gunshow|6       Sat Game Day
```

The fixture lands on the Saturday. G-1 correctly demotes the Friday — **and the
Friday was carrying the week's only HINGE.**

- The **PUBLISHER** re-plans: hinge moves to the Monday, the two upper days swap
  to keep balance, and the week still covers all four patterns.
- The **DERIVER** demotes the Friday and changes nothing else. The week loses
  hinge entirely.

Run the lawfulness proof on that world and it says so outright:

```
  FAIL W3-fixture-only lawful-1  pattern_restore_failure — "at least one meaningful hinge main lift", actual 0
  FAIL W3-fixture-only lawful-2  planner_selected_target_miss main_strength expected 4 actual 3
                                 planner_selected_target_miss conditioning   expected 4 actual 3
```

**So the published week is the LAWFUL one and the derived week is not.** The
proof passed in W2/W2r only because the athlete's cleared Wednesday authorises
the imbalance through an `explicit_user_override` typed reduction. Remove the
decision and the identical missing hinge is a blocking violation. The pin's
world was a genuine pass and a narrow one — `gate-passing-on-coordinates-it-
never-builds` avoided only because the third world was added and run.

**This is what the stored §18 contract was actually buying, and it is not
arithmetic.** It is the RE-PLANNING that keeps a week lawful when a fixture
consumes the day carrying a pattern. Retiring it as an input does not move that
capability into the deriver — **it deletes it**, and the deriver produces a
deterministic, byte-stable, UNLAWFUL week.

The ruling's four grounds survive contact individually — the stored contract
does store no decision, a landed decision does settle by re-deriving,
determinism does hold, and the blast radius is zero athletes. The gap is
between grounds 1 and 3: **determinism is not lawfulness.** A pure function of
persisted inputs can still return a week the Bible rejects, and this one does.

### What the seat now has to rule

Not "who owns pattern identity" — that is ruled, and the answer stands. The
open question is narrower and it is a BUILD question:

> Re-planning is a §18 repair, and the repair search lives in the gateway on
> the publish path. Under the pattern-identity ruling the deriver must own it.
> Does the deriver acquire the repair search (tier 4 at read gains the
> reallocation the publisher performs), or does the retirement stop at the
> contract and leave the publisher composing?

Leg (ii) already runs the gateway at read with the projection identity, so the
machinery is reachable. What it does NOT do is expand candidates the way the
publish path does — it conforms the week it is handed. That is the next unit,
and it is priced by exactly the proof this one built.

---

## 5. Status

- **Condition 1 (final form):** MET as a process, FAILED as a result. Per the
  condition's own instruction: **STOP with the residual named.**
- **Built:** nothing. **Merged:** nothing. **Scaffold:** preserved on
  `scratch/r53-pricing-3-scaffold`; working tree reverted and clean.
- **Cells 5/6:** NOT re-pinned, and the ruling's own procedure is why — the
  pinned literal is already the derived week's value. Condition 4 intact.
- **Step 1 of the procedure:** passed 8/8 in the pin's world; failed 2/4 in
  cell 3's world, which is the world condition 1 also requires.
- **Two corrections worth keeping** regardless of what is ruled next: the
  derived contract reads the decision ledger, and the declared subphase follows
  the derived anchor state.
- **Condition 5** (unpiped bible, condition 4 markedDays proof, merge,
  post-merge bible, R5.7, remaining batches): not started — gated on a build
  that did not happen.
