# TEST ROSTER CLOSURE — 2026-08-16, seat `core`

Base merged main `da4c5e46`. Work committed directly on main. **No production
changes.**

---

## 1. HISTORY HYGIENE — CLEAN, AND IT TOOK TWO RECONSTRUCTIONS

    git log --oneline da4c5e46..HEAD -- <the five paths>   ->  0 commits
    git log -p        da4c5e46..HEAD -- <the five paths>   ->  0 content lines

**Twice in this mission a broad `git add` reached Sam's uncommitted onboarding
work.** Once with `git add -A`; then again with `git add -A -- package.json
src/__tests__`, which swept in his in-progress
`onboardingAnswerPresentationTests.ts` — including a whole new test block of his.

The second time is the one worth naming: **I had already written a commit about
exactly this mistake, and it still happened.** A pathspec on `commit` does not undo
a broad `add`. The only safe form is `git add <explicit path>`.

As instructed, a revert was not treated as sufficient — history was reconstructed
from the base both times. The five files are byte-identical to their pre-session
state and remain **modified and uncommitted**.

---

## 2. THE 162 SCRIPTS NOTHING RAN — EVERY ONE EXECUTED ONCE

| outcome | count |
| --- | ---: |
| passed | **79** |
| assertion-failed | **56** |
| other (assertion failure, unrecognised format) | **23** |
| import/crash | **3** |
| composites/wrappers, not leaves | 5 |

`OTHER` is not a separate condition: `test:apply-events` prints
`Fail: 2 — power: strength row removed, expected 0 got 1`. The honest split is
**79 passing, 76 failing, 3 crashing**.

### Classification

| class | action | count |
| --- | --- | ---: |
| **A** valid guard | registered in the canonical roster | **141** + `test:clause-enforcement` |
| **B** diagnostic only | relabelled `test:*` → `diag:*` | **15** |
| **C** retired/deleted-planner behaviour | physically deleted | **4** (earlier, 1,034 lines) |
| **D** duplicate | none proven | 0 |
| **E** live guard that fails | registered and grouped below | **76** |

**No duplicates were consolidated.** I could not prove any surviving guard protects
the same rule, and the brief allows consolidation only after that proof.

### The 15 diagnostics, now `diag:*`

    bible:agreement · bible:agreement:mutation · injury-episode-transactions
    injury-episode-commands · equipment-schedule-facts · coach-classification-ownership
    athlete-action-diagnostics · explorer-metro-transform · explorer-ui-observation
    explorer-lifecycle-ui · feedback-render-witness · coach-mutation-truth
    program-semantic-snapshot · coach-visible-domain-verifier
    coach-committed-program-edit-reply

They carry fewer than three assertion constructs — they assert nothing — and were
counted in every `test:*` total I have quoted. **A diagnostic reported as coverage
is worse than no diagnostic.**

### Still outside the roster — 5, named so it is a fact and not a gap

`test:bible` (the roster itself), `test:bible:extended`, `test:bible:report`,
`test:qa:local`, `test:off-season-sequencing` — wrappers and aliases, not leaves.

---

## 3. ONE TRUTHFUL DENOMINATOR

    BEFORE   93 failing of 252   (and 162 scripts nobody ran)
    AFTER   163 failing of 394

    newly visible failures:            70
    previously-failing now green:       0

**Nothing regressed. 70 real failures were simply invisible**, including
`test:clause-enforcement` — my own suite from this mission, green and unregistered
the whole time.

---

## 4. GROUPED FOR LATER WORK — NOT FIXED, AS INSTRUCTED

| family | scale | note |
| --- | --- | --- |
| pre-existing product-defect suites | 87 | predate the whole scheduler slice |
| newly visible failing guards | 76 | were never run; failures are pre-existing |
| the G-2 injury exception (R-095) | 3 cells | `injury-authority` G2–G4, see below |
| `section18-planner` | 1 | `sprint_cod` required 1, delivered 0 |
| `power-primer-policy` | 1 | world hits a refusal setup that is out of scope |
| `generation-vocabulary` | 1 cell | vocabulary violation not mapped to its refusal |
| the 20 refusing athlete setups | 20 of 90 | bodyweight-only and off-season ceilings |

---

## 5. R-095 — SAM'S RULING, RECORDED

**"G-2 outranks the injury exception. High Box Squat and Vertical Jump are both
prohibited on G-2. Omit and disclose; upper-body work remains legal."**

Written to `docs/RULINGS_REGISTRY.md`, as CLAUDE.md requires in the same task.

**Already ENFORCED**: `WC-051` in `rules/weeklyLegality.ts` refuses any lower
purpose on G-2 as a typed legality rule, so the exception cannot be scheduled at
all — no production change was needed and none was made.

⚠ **The omit-and-disclose GUARD did not land.** `injuryAuthorityOwnershipTests`
G2–G4 still assert the old exception. The brief allowed the guard only if it could
land cleanly in this mission; rebasing three expectations at the cap is exactly how
a test stops describing the rule and starts describing the code, so they are
reported as a defect family instead.

---

## 6. COMPLETION CONDITIONS

| condition | state |
| --- | --- |
| zero executable references to the deleted planner | ⚠ **one**: `scenarioHarness.js` |
| no onboarding content anywhere in branch history | ✅ 0 commits, 0 lines |
| one truthful denominator | ✅ **163 of 394** |
| 140/40 worlds, zero lost/gained | ✅ 140 built / 40 refused, 70/20 setups |
| no production changes | ✅ none |
| every test file is guard, diagnostic, or deleted | ✅ 394 guards + 15 `diag:*` + 5 wrappers |

`scenarioHarness.js` is the single remaining reference. It is wired to
`test:scenarios` (**passing**) and `require`s from a **compiled snapshot** in
`/tmp/lfa-compiled` rather than from source — so it may be exercising stale code
entirely. Migrating it means touching a green suite whose instrument reads a build
I cannot see. **Left and reported rather than risked at the cap.**

---

## 7. MERGE RECOMMENDATION

**Nothing to merge — this is committed on main**, and the working tree holds only
Sam's own five uncommitted files.

**What I would do next, and it is not the 87:** `scenarioHarness.js` reading a
compiled snapshot is the last planner reference AND a suite that may be green
against stale code. That is a bigger risk than any counted red, because it is the
one place left where "passing" might mean nothing.

Agent: core
