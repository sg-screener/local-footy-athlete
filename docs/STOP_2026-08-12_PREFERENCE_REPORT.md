# STOP — ITEM 5 IS BUILT: THE 17 SCENARIOS NOW ANSWER SAM'S QUESTION

**LOOP CHECK:** *an instrument that measures but never decides* — **sighting 3**
(`achievedModerateDayCount` written and read by nobody; `canOverride` written
nine times and read zero; the two shape probes printing into a log nobody diffs).
**Disposition: COMPRESS, and this unit is the compression** — the numbers that
were only ever printed now carry a verdict against a committed baseline, and the
verdict has its own suite. A fourth sighting of "computed and unconsumed" should
be met by item 10's `LAW-computed-must-be-consumed` gate, not by another probe.

**HEAD:** `8f7354d3` on `main`. Branch verified immediately before the commit.
**No simulator was touched** — Sam ruled it belongs to Claude Code until he says
otherwise, and nothing in this unit needs it.

---

## 1. WHAT THE 17 NOW REPORT

`LFA_HARD_DAY_PROBE=1 npm run test:qa` ends with a table across every scenario:

    scenario | hard | anchor | moderate | pref<=| score | verdict
    S3       |    4 |      3 |        1 |     4 |   2/2 | unchanged
    S8       |    4 |      3 |        0 |     4 |   1/2 | unchanged
    S10      |    5 |      4 |        0 |     4 |   0/2 | unchanged
    ...

**TODAY: 4 of 17 weeks meet both ruled preferences. 0 hard violations.** That is
now a committed number (`scripts/preference-baseline.json`), so the next
rules-engine change has to say what it did to it.

## 2. THE DESIGN PROBLEM WAS THE SCORE, AND THE ANSWER WAS TO NOT INVENT ONE

A weighted score would have been this file deciding that a missing moderate day
is worth twice a fifth hard day. **Nobody ruled that.** So the score is the
**count of Sam's ruled preferences a week satisfies**, each axis named in the row
and quoted at the code:

| axis | his words |
| --- | --- |
| `hardDaysWithinPreferred` | *"4 hard days plus 1 moderate/easy day is prefered but 5 hard days is okay"* |
| `hasModerateDay` | the other half of the same sentence — and the half with no reader anywhere |

**Both thresholds are READ from the contract**, never hard-coded: an off-season
week whose `preferredHardDayRange.max` is 2 is judged against 2. A cell that
assumed 4 and 5 would have called those weeks unpreferred for having three hard
days, which is the "first-match-wins hides its ordering" family of mistake — one
world's numbers standing in for every world's.

**A FIFTH HARD DAY COSTS THE PREFERENCE AND IS NEVER A VIOLATION.** Stand-down A
exists because that was nearly enforced once.

## 3. THE THREE OUTCOMES, KEPT APART

- **Hard failure** — over `permittedHardDayMaximum`. Blocks.
- **Preference regression** — a lower score. Continues **only with a stated
  reason**, which a human writes; no script can supply it.
- **Intentional change** — the baseline is updated, carrying its evidence.

**A hard failure is NOT also counted as a regression.** One event, two names, and
the blocking one must not be diluted by the advisory one.

**OVER-FITTING IS MECHANICAL.** Improvements ≥ 1 **and** more regressions than
improvements → REJECTED. His words are in the code: *"I don't want to get 2 weeks
down the line and realise that a weekly template optimised for that and that
alone."* The opposite case is probed as well — a broad gain with one cost is not
over-fitting, it is a change with a price to state.

**AND A SCENARIO THAT VANISHES IS NOT A PASS.** Dropping the week that failed is
the cheapest way to satisfy any set of preferences; the comparator reports it.

## 4. WHY `test:qa` PRINTS AND DOES NOT BLOCK

`test:qa` carries **84 pre-existing failures**. A verdict wired into that exit
code would be indistinguishable from them on every run — a gate that is already
red gates nothing. So the harness measures and prints; **`test:preference-shape`
holds the rules, is green, and is in the chain.** Printing is not enforcing, and
this repo has paid for confusing the two.

**8 cells, three mutations killed:** making a fifth hard day illegal, making
over-fitting unfireable, and corrupting a stored verdict inside the committed
baseline. The baseline cell **recomputes every row from its own numbers**, so a
stale baseline cannot silently decide every future comparison.

Registry row `LAW-preference-report`. **102/70 → 103/71; UNENFORCED unmoved at 32.**

## 5. NORTH STAR

**Toward it, and on the process rather than the data.** The baseline stores a
measurement, not a decision — and the verdicts are DERIVED from it on every run
rather than stored beside it, which is why a corrupted stored verdict reds
instead of being believed.

## 6. NOT COVERED

- **THE 2-OF-17 / 4-OF-17 DISCREPANCY IS OPEN.** Item 4 records the shape in
  **2 of 17 and in ZERO fixture weeks**; this instrument counts **4 of 17**, and
  two of the four (S3, S12) carry anchor-caused hard days. **They are different
  questions** — "exactly 4 hard days" versus "within this week's own preferred
  maximum" — and **I did not establish what item 4 counted as a fixture week**.
  Both readings sit in the table; neither was reconciled by assertion.
- **NO SCENARIO WAS CHANGED, AND NO RULE WAS ENFORCED.** This unit measures and
  decides about CHANGES; it does not make any week meet the shape. The 13 weeks
  that miss it still miss it.
- **THE BASELINE IS ONE RUN.** It was produced twice with identical numbers, but
  a harness this large has flaked before; a third arm was not run.
- **`preferenceTable` IS RENDERED AND NOT SNAPSHOTTED.** One cell asserts it
  names the scenario and the verdict; column alignment is not held by anything.
- **NO SIMULATOR, BY INSTRUCTION.** The `lower-body-deletion.yaml` re-run from
  the previous unit is still **OWED** and still blocked on Sam's word.
- **THREE REDS IN THIS TREE ARE NOT MINE:** `test:compile` on the other agent's
  untracked `fixtureSettleAfterSetupTests.ts`, and `test:dev-e2e-seeds` /
  `test:dev-e2e-scenario-session` on the pre-existing "manifests add no seed
  families" cell.
