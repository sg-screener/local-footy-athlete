# WEEKLY SCHEDULER CONTRACT — boundary report, 2026-08-15, seat `core`

**Branch `slice-weekly-scheduler`, base `main @ 0e43fcfd`.** Worktree-isolated.
**The shared checkout's five uncommitted onboarding-copy files were never touched**
— verified before and after every commit.

| commit | what it did |
| --- | --- |
| `8ee2c9fa` | the typed contract + the deterministic scheduler |
| `1be27696` | liveness — 72/72 cells seen red by mutation |
| `da15a415` | the production cutover, and the measurement that says do not merge |

**Approved source:** `docs/WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md`,
sha256 **`0d34e288c23f0654d0163d41dff1a73050697d54219ecf6facd84ef1eb68c190`**,
430 lines, 24,842 bytes. Copied into the branch **with this implementation and its
guards**, never as unguarded standalone law. Approved by Sam 2026-08-15:
*"okay i approve it"*. The hash is pinned in `CONTRACT_SOURCE` and guarded.

---

## 1. MERGE RECOMMENDATION — **DO NOT MERGE**

The contract, the scheduler and their guards are sound. **The cutover is not.**

    BEFORE (main @ 0e43fcfd)   142 built / 38 refused
    AFTER  (this branch)       136 built / 44 refused
    LOST    22 worlds
    GAINED  16 worlds

**Four suites went from green to red.** One blocker explains every refusal, and it
is named in §6. **I recommend merging nothing until that blocker is closed** —
the contract and scheduler could be landed alone, but only by reverting the
cutover, and the mission forbids retaining a fallback scheduling path, so the
honest unit is the whole branch.

---

## 2. THE TYPED CONTRACT AND SCHEDULER OWNERS

| owner | file | what it owns |
| --- | --- | --- |
| **the contract** | `src/rules/weeklyProgrammingContract.ts` | 41 clauses, 11 base layouts, 3 phase overlays, global rules, set budgets, the fourth-session selector |
| **the scheduler** | `src/rules/weeklyScheduler.ts` | contract + facts → dated session intentions, or a typed refusal |
| inputs seam | `src/rules/weeklySchedulerInputs.ts` | the athlete's already-authorised facts → scheduler inputs |
| composer seam | `src/rules/schedulerPlannedDays.ts` | intentions → `ComposerPlannedDay[]`, shape only |

**Every clause carries a stable `WC-nnn` id and a §-section provenance.** The
registry is **mechanically derived** where it can be — layout and overlay rows are
generated from `BASE_LAYOUTS` and the overlay tables, not retyped, because the
mission forbade a hand-written duplicate list and a second list is a second
authority.

**The scheduler does not select exercises.** Equipment substitution, injury
modification, projection, training-history progression and athlete-facing copy all
stay where they were. The composer receives an INTENTION.

**The search is exhaustive, not greedy** — at most `C(7,4) × 4! = 840` candidates,
every legal arrangement scored by a total order. Same inputs, same week, optimal
rather than merely feasible.

---

## 3. BEHAVIOURAL MATRIX AND MUTATION RECEIPTS

`npm run test:weekly-scheduler` — **72 cells, 0 failures, 41/41 clauses guarded,
0 unguarded, 0 phantom.**

Required coverage, all present and all running the scheduler:

- **every phase × 2/3/4/5/6 gym-access days** (15 cases) — club and no-club;
- **weekend available and unavailable** (WC-111 vs WC-112 give different layouts);
- **real weekdays** — a **Wednesday/Friday** club athlete with a **Sunday** game,
  never assumed Tue/Thu/Sat;
- the fourth-session selector on both arms, **the conjunction** (a fatigued
  34-year-old does not qualify on two of three) and **the low-readiness veto**
  (a 22-year-old reporting low readiness stays on three);
- **5–6 gym days never create a fifth required session**, asserted per phase;
- lower spacing and plane repeats **swept over 135 worlds**;
- hard-day limits, explicit unavailability, off-gym running, the three off-season
  blocks, split-lower 10-set budget, 12–15/16 elsewhere, typed refusals.

### Liveness — every cell seen red

    GREEN BASELINE: 72 cells
    KILLED BY AT LEAST ONE MUTATION: 72
    SURVIVORS: 0

`scripts/mutate-weekly-scheduler.ts`, 43 mutations against the real subjects,
restored from an **in-memory backup, never `git checkout`**.

**KILLED means "was passing and is not passing"**, not "printed FAIL" — counting
FAIL lines credited nothing when a mutation made the suite throw.

**Two mutations are inert and say so in the run output:** `M12` (five-day run
without two rest days) and `M14` (G-1/G+1 exclusion) redden nothing *on their own*,
because the scorer independently avoids those arrangements. The cells they target
are killed by other mutations, so liveness holds; these two add no coverage.

### The harness found four guards that could not fail

1. **WC-135 was green because the thing it forbids could not happen.**
   `inSeasonSprintDay` had **no caller** — no sprint was ever emitted under any
   conditions. Wired, and it also returned the first eligible weekday without
   checking it was free (Monday, already a strength day).
2. **WC-050's cell had no Saturday in its gym set**, so removing the G-1 exclusion
   could not change the output.
3. **WC-142's cell asserted only THAT it refused**, so skipping the
   not-enough-days branch still passed on a different refusal.
4. **WC-023's cell used a week containing no full-body session**, so gutting
   `full_body`'s pattern list changed nothing.

### And one finding about the scheduler itself

**Eight of the first twenty single-edit mutations reddened nothing** — not because
the guards were blind, but because **removing a legality check leaves the SCORER
still preferring the legal arrangement.** Lower spacing, hard-day limits and
explicit unavailability are each enforced in two or three places. Mutations are
therefore multi-edit.

---

## 4. THREE DEFECTS THE GUARDS FOUND IN MY OWN IMPLEMENTATION

1. **`owner` was exclusive, so a club night that was also a gym day lost its club
   training.** §3: *"Gym may share a club-training day"*, and the contract's own
   reference week pairs an upper session with EACH club night. WC-062 reported
   **zero** club days for a Wed/Fri club athlete. Club and game are now flags.
2. **WC-040/WC-041 were SCORED, not enforced.** *"The app does not program 6"* is a
   law. A five-gym-day athlete with two club nights and a game was handed six and
   seven hard days. Now legality, and **the unit is DAYS not sessions**, so a gym
   session sharing a club night is one hard day.
3. **The sprint rule, above.**

---

## 5. BEFORE → AFTER WORLD ACCOUNTING

Reported separately, never as a net figure.

| | built | refused | lost | gained |
| --- | ---: | ---: | ---: | ---: |
| **BEFORE** — `main @ 0e43fcfd` | **142** | 38 | — | — |
| **AFTER** — this branch | **136** | 44 | **22** | **16** |

**GAINED (16)** — pre-season 4/5/6-day worlds the contract now lays out correctly:
`Pre-season/{4d,5d,6d}/{club,noclub}/{Full Gym, Dumbbells, Bodyweight Only}`
across w1/w2.

**LOST (22)** — almost all off-season 4/5-day:
`Off-season/{3d,4d,5d}/{club,noclub}/{Full Gym, Dumbbells, Bodyweight Only}`.

---

## 6. THE SINGLE BLOCKER

**All 44 refusals are one cause.**

| typed finding | occ | distinct worlds |
| --- | ---: | ---: |
| `main_strength_planner_selected_target` | 22 | 16 |
| `main_strength_permitted_maximum` | 16 | 8 |
| `main_strength_required_minimum` | 6 | 6 |

**§18's exposure contract still derives its main-strength targets from the
PLANNER.** `weeklyExposureContractV2` holds a per-phase
`strength: { required, defaultTarget, preferred, max }` policy and a
`plannerSelectedTarget` taken from the planner's own allocation — **and it is built
BEFORE the scheduler runs.** So the judge measures the scheduler's week against a
session count the scheduler did not choose.

**The fix is to make that contract's main-strength target come from
`scheduled.requiredStrengthSessions`**, which means building the exposure contract
after the scheduler or re-stamping it. That is a real change inside §18's owner and
I did not attempt it inside the cap rather than half-land it.

### Two contract readings the cutover forced, both grounded in the source

- **SCALE, DO NOT REFUSE.** A Mon/Wed/Fri athlete with a Saturday game loses Friday
  to G-1 and has two legal days for a three-session layout. Refusing cost **60
  occurrences across 30 worlds**. §8 answers it: *"Scale honestly to two or three
  strength sessions when that is all the athlete can do."* Below two there is
  nothing to scale to and it refuses with its own finding.
- **THE LEGACY STAND-DOWN IS THE UNION.** The planner can still mark a strength day
  the scheduler did not choose; that orphan fell to the severed legacy builder and
  killed 6 worlds. Strength is the composer's on every day.

---

## 7. DELETED LEGACY OWNERS — **NONE, AND THE EVIDENCE SAYS WHY**

**0 owners deleted. 0 lines removed.**

The mission gates deletion on execution evidence that the superseded owner is
unreachable. **That evidence does not exist**: `buildCoachingPlan` (9,074 lines)
still runs on every generation and still owns conditioning content, warm-ups, dose
and the §18 exposure contract — none of which the contract claims. Its
*scheduling* is superseded in the composer's path only.

**Deleting it now would be deletion on assumption**, which is the opposite of what
was asked. No "temporary" fallback scheduling was retained either — the cutover is
unconditional, which is exactly why the four suites are red rather than masked.

---

## 8. REPRESENTATIVE WEEKS

`docs/weekly-scheduler-layouts/README.md` — **11 layout rows and 12 weeks,
generated from the typed contract and the scheduler**, per §10 (*"Generate the
readable document from the same typed data so prose and code cannot drift"*).

Covers in-season 2/3/4 sessions, younger and older four-day athletes, pre-season
2/3/5 days, off-season 2/3/4 days across all three blocks, the real
Wednesday/Friday + Sunday-game athlete, and an explicit-unavailability week.

---

## 9. GATES

    test:compile             PASSED — 459 total, no file regressed
    test:weekly-scheduler    72 passed, 0 failures, 41/41 clauses guarded
    test:bible:parallel      253 suites — 71 red on main -> 70 red on the branch

**⚠ THE 70 HIDES FOUR REGRESSIONS.** Five other suites went green, so the TOTAL
improved while four suites broke. **The suite-name diff is the receipt:**

| suite | state | real? |
| --- | --- | --- |
| `test:program-override-ownership` | 1 passed / **6 failed** | yes |
| `test:athlete-door-matrix` | 416 passed / **1 failed** | yes |
| `test:main-lift-pattern` | 22 passed / **1 failed** — `[non-vacuity] the generated census actually reached heavy lifts` | yes, a direct consequence of more refusals |
| `test:game-anchor` | **15 passed / 0 failed standalone** | **UNVERIFIED** — likely a parallel-runner flake, not re-run clean |

**No ratchet, floor, ceiling or allow-list was reset.**

---

## 10. NOT COVERED

- **The §18 exposure-contract integration (§6).** The whole remaining gap.
- **No legacy owner deleted** (§7) — no evidence of unreachability.
- **`test:game-anchor` was not re-verified** with a clean full-roster re-run. It
  passes standalone; I am not claiming it is a flake, only that it is unconfirmed.
- **The 26–30 age band straddles the contract's boundary of 27.** `ageFromRange`
  takes the band's TOP, so a 26–30 athlete is treated as 30 and does not qualify on
  age. Conservative on purpose — guessing young would hand a fourth session to
  someone the contract does not cover — but it is a real boundary the source does
  not resolve. Recorded in the function's docstring.
- **`consistentlyCompletesThree`, `highReadiness` and `lowFatigue` are hard-wired
  false.** The app has a typed deload signal but no typed "completes three
  comfortably" signal. The earned arm of the selector is therefore unreachable in
  production, so an older athlete always stays on three. The guards cover both
  arms; only the production input is missing.
- **No simulator, no phone, no relaunch tape.** Every claim here is headless.
- **Conditioning counts, running minimums and rest-day counts are encoded but not
  enforced against the produced week** — the scheduler places running and the
  contract states the targets, but no cell asserts a built week hits 3–5
  conditioning exposures end to end.
- **`docs/weekly-scheduler-layouts/` is generated but the review draft was not
  replaced** (§10 item 1). The draft remains the source of record.

---

## 11. WHAT FOUGHT ME, VERBATIM

- **Eight of my first twenty mutations proved nothing**, and the reason was not the
  guards — three of the contract's rules are enforced in two or three places each,
  so a single-edit mutation leaves the behaviour intact. *A rule held twice needs
  breaking twice before its guard can speak.*
- **`inSeasonSprintDay` had no caller.** I wrote the function, wrote its guard,
  watched the guard pass, and it was passing because the scheduler could not emit a
  sprint at all. **Only the mutation harness found it** — flipping the rule
  reddened nothing.
- **The cutover's first measurement was 88 built, down from 142.** Two contract
  readings later it is 136. The remaining 6 are not a reading; they are §18.
- **`test:bible:parallel` went from 71 red to 70 while four suites broke.** A total
  that improves is not evidence that nothing regressed, and this one nearly read as
  a clean run.
- **The contract does not say what to do when game proximity leaves fewer legal
  days than the chosen layout wants.** §8's *"scale honestly"* answers it for
  pre-season and I applied it across all three phases. **That is an inference, not
  a quotation** — flagged here rather than buried, and it is the one place this
  implementation extends the source.

---

## 12. IF SAM WANTS THIS LANDED

The next unit is small and named: **make `weeklyExposureContractV2`'s
main-strength target come from `scheduled.requiredStrengthSessions`** instead of
the planner's allocation, then re-run this report's §5 and §9. Everything else on
this branch is already guarded and mutation-proved.

Agent: core
