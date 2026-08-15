# CLAUSE ENFORCEMENT PASS — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. **No merge.** Planner deleted.
The two bookkeeping fixes are paused, as ordered.

---

## 0. WHAT THIS FOUND

**One misclassified rule, and it was mine.** `test:clause-enforcement` reds on its
first run: **WC-050 was filed as a `definition`.** Its wording — *"game proximity
constrains the days around the fixture"* — reads like vocabulary, but it is the
CARRIER of the G-1/G+1 ban. **A ban whose clause is filed as a definition is a ban
nothing has to enforce.** Reclassified to prohibition.

No other clause was misclassified once the four conditions were applied
mechanically. G-2 (WC-051) — the one that reached an athlete's Friday — was already
corrected in WS-21 and is now held by the legality owner rather than by a score.

⚠ **An earlier version of the audit reported 17 REDs and I did not trust it.** It
inferred modality from prose and enforcement by grepping clause ids, so it missed
every rule enforced through a contract CONSTANT (WC-040/041 among them). Most of
its findings were false. **It was deleted rather than patched**, and the table
below is generated from the same objects the guard asserts against.

---

## 1. THE FOUR RED CONDITIONS, MECHANISED

| condition | how it is checked | mutation receipt |
| --- | --- | --- |
| prohibition represented only by scoring | every clause declaring `prohibits` must own a rule in `LEGALITY_RULES` | demote G-2 to score-only → **FAIL** `[WC-051] the ban held under pressure` |
| requirement with no completeness check | every clause declaring `requires` must own a check in `COMPLETENESS_CHECKS` | delete a rule → **FAIL** `WC-062 prohibits, so the legality owner holds it` |
| preference implemented as refusal | a clause with neither flag may own NO legality rule | — (asserted for all 15 definitions + 10 preferences) |
| fact re-derived after the canonical context | the legality owner is read for any recomputation of game proximity | re-derive inside it → **FAIL** `the legality owner never recomputes game proximity` |

**42 clauses · 20 prohibitions · 6 requirements · 15 definitions.**

---

## 2. THE TABLE

| clause | exact rule | kind | canonical input fact | enforcement site | validation site |
| --- | --- | --- | --- | --- | --- |
| WC-020 | Across the complete week, aim for at least one meaningful exposure in each of the eight named pa | REQUIREMENT | intendedPatterns across the week | — | COMPLETENESS (typed check) |
| WC-021 | Additional exposures remain balanced with their partner, measured across the whole week, not nec | preference | pattern partner balance | — | — |
| WC-022 | Do not repeat the same movement plane on consecutive days. Different planes in the same broad fa | PROHIBITION | purpose plane, consecutive days | LEGALITY (typed rule) | — |
| WC-023 | Each session purpose intends a stated set of movement patterns. | definition | PATTERNS_FOR_PURPOSE | — | — |
| WC-024 | Which session purposes load the legs, for lower spacing. | definition | PURPOSE_IS_LOWER | — | — |
| WC-030 | Prefer 12-15 main/secondary working sets; 16 is a hard ceiling; the same limit applies to Lower, | PROHIBITION+preference | setBudget per session | -> layout set budget (BASE_LAYOUTS.setBudget) | — |
| WC-031 | Split in-season Lower Squat and Lower Hinge sessions use 10 main/secondary working sets — an app | definition | split in-season set budget | — | — |
| WC-040 | Prefer 4 hard days; allow 5. The app does not program 6. | PROHIBITION+preference | hard days across the week | LEGALITY (typed rule) | — |
| WC-041 | Prefer no more than 3 consecutive hard days; 4 acceptable when availability requires; 5 only whe | PROHIBITION+preference | consecutive hard days | LEGALITY (typed rule) | — |
| WC-042 | Normally 1-2 full rest days; early off-season and bye-recovery may have 3. | preference | full rest day count | — | — |
| WC-043 | At least one complete day between hard lower sessions; never place lower strength sessions on co | PROHIBITION | lower session spacing | LEGALITY (typed rule) | — |
| WC-044 | No more than 3 running days consecutively. | PROHIBITION | consecutive running days | -> running top-up loop (WC-044 streak check) | — |
| WC-045 | Aim for 3-5 conditioning exposures; club training and games count; total cap 5 and a fifth is of | PROHIBITION+REQUIREMENT+preference | conditioning exposures incl. anchors | -> demand.coreConditioning cap, GLOBAL_RULES.conditioning.max | COMPLETENESS (typed check) |
| WC-046 | Running minimum 2, preferred 3, maximum 4. Club training counts. | PROHIBITION+REQUIREMENT+preference | running day count | -> running top-up loop, GLOBAL_RULES.running.max | COMPLETENESS (typed check) |
| WC-047 | Aim for 2-3 upper exposures per week. | preference | upper exposures per week | — | — |
| WC-048 | Seven app-authored strength movements is a daily ceiling, not a target. Mobility does not count. | PROHIBITION | daily movement ceiling | -> composer daily movement ceiling | — |
| WC-050 | Game proximity constrains the days around the fixture. | PROHIBITION | gameDay + fixtureRecurrence | LEGALITY (typed rule) | — |
| WC-051 | G-2 prohibits added LOWER-BODY sprint, jumping, plyometric and power work. Upper-body power is p | PROHIBITION | G-2 lower power / speed work | LEGALITY (typed rule) | — |
| WC-060 | Required strength work is never placed outside gym-access days. Equipment-free running or condit | PROHIBITION | gymAccessDays | LEGALITY (typed rule) | — |
| WC-061 | Any work placed outside gym-access days must still respect game and club placement, spacing, and | PROHIBITION | unavailableDays | LEGALITY (typed rule) | — |
| WC-062 | Use the athlete's real club nights; never assume Tuesday/Thursday. | PROHIBITION | clubNights (declared, never assumed) | -> coachingInputsToSchedulerInputs — declared club nights only | — |
| WC-063 | Availability is permission, not a quota. Five or six available days do not create five or six re | PROHIBITION | availability is not a quota | -> baseLayoutFor — the layout owns the count | — |
| WC-100 | Full Body x2 on the best-separated days. | definition | layout: In-season 2 days | — | — |
| WC-101 | Lower + Upper Pull + Upper Push. With two club nights, pair one upper session with each. | definition | layout: In-season 3 days | — | — |
| WC-102 | Selector NOT met — the three-session layout is retained. Availability above three never creates  | definition | layout: In-season 4, selector unmet | — | — |
| WC-103 | Selector MET — four sessions. The fourth creates separate Lower Squat and Lower Hinge days, each | definition | layout: In-season 4, selector met | — | — |
| WC-110 | Full Body x2 on the best-separated gym days, never back-to-back. | PROHIBITION | layout: Pre-season 2, never back-to-back | -> WC-043 spacing above | — |
| WC-111 | Weekend unavailable: Lower + Upper + Full Body. | definition | layout: Pre-season 3, no weekend | — | — |
| WC-112 | Weekend available: Full Body x3 on the best-separated days. | definition | layout: Pre-season 3, weekend | — | — |
| WC-113 | Upper x2 + Lower x2. Pair running/top-end with Upper and off-leg conditioning with Lower. Extra  | PROHIBITION | layout: Pre-season 4+, no fifth | -> baseLayoutFor — no fifth session | — |
| WC-120 | Full Body x2 on the best-separated gym days. | definition | layout: Off-season 2 | — | — |
| WC-121 | Lower + Upper + Full Body on the best-separated gym days. Full Body fills the movement patterns  | definition | layout: Off-season 3 | — | — |
| WC-122 | Lower x2 + Upper x2 on the best-spaced four gym days. Extra days may hold optional work; they do | PROHIBITION | layout: Off-season 4+, no fifth | -> baseLayoutFor — no fifth session | — |
| WC-130 | Off-season weeks 1-2: every session optional, zero completed is valid, 75% load, no required run | preference | off-season weeks 1-2 overlay | — | — |
| WC-131 | Off-season weeks 3-4: the normal strength skeleton becomes required again, 90% load, conditionin | REQUIREMENT | off-season weeks 3-4 overlay | — | -> off-season weeks 3-4 overlay — required skeleton returns |
| WC-132 | Off-season week 5 onward: normal loading, 2-4 required strength sessions by availability, condit | REQUIREMENT | off-season week 5+ overlay | — | -> off-season week 5+ overlay — sprint exposure floor |
| WC-133 | Pre-season: prefer four strength sessions when availability permits, scale honestly to two or th | PROHIBITION+REQUIREMENT+preference | pre-season overlay, max two lower | -> pre-season overlay + WC-043 | -> pre-season overlay sets the demand; §18 judges the delivery |
| WC-134 | In-season: maintain strength and conditioning while arriving fresh for the game. No scheduled ca | definition | in-season overlay | — | — |
| WC-135 | In-season, only add sprint work when there is no club training, and place it G-3 or earlier. | PROHIBITION | in-season sprint placement | -> inSeasonSprintDay placement | — |
| WC-140 | The in-season fourth-session age ceiling is 27. | definition | FOURTH_SESSION_AGE_CEILING | — | — |
| WC-141 | Use four in-season sessions when the athlete is 27 or younger, OR when they consistently complet | definition | inSeasonUsesFourSessions selector | — | — |
| WC-142 | One entry point resolves phase x availability to a base layout. | definition | baseLayoutFor entry point | — | — |

42 clauses · 20 prohibitions · 6 requirements · 15 definitions

---

## 3. THE CLASS FIX

- **`CLAUSE_MODALITY`** — all 42 clauses declare `prohibits` / `requires` /
  `prefers` plus their canonical input fact. The three flags are **independent on
  purpose**: WC-045 is a floor AND a ceiling AND a target, and collapsing that to
  one verdict silently drops the floor — the exact shape this table exists to stop.
- **`rules/weeklyLegality.ts`** — one owner for every prohibition. A rule returns a
  typed REASON or null. **It has no access to a score, so nothing can be bought.**
  Game proximity is passed IN, never re-derived: a second owner of the cyclic-week
  question already cost a Sunday-fixture athlete their recovery day.
- **`rules/weeklyCompleteness.ts`** — one owner for every requirement, asked of the
  FINISHED week. It reports a typed gap and does not refuse; **a requirement that
  refuses on its own is how a preference becomes a ban by accident.**
- **`assignmentIsLegal` now delegates.** Scoring only ever sees legal candidates.
- A rule that is genuinely held elsewhere must NAME its owner (`enforcedElsewhere`
  / `validatedElsewhere`). An empty function body reads as enforced while
  enforcing nothing.

**It is a PORT, not a rewrite.** Every rule is the check the scheduler already
performed, moved verbatim with its clause id attached. **84/84 and 80/180 worlds
unchanged — that invariance is the evidence.** My first draft did re-derive from
the prose and invented three constants that do not exist; it was thrown away.

### The adversarial half

Coverage proves a rule EXISTS; it cannot prove the rule BINDS. Four pressure worlds
are engineered so that obeying the ban is the **worst-scoring option available** —
the exact circumstance under which G-2 was bought — plus one world each for G+1
across the week boundary, gym-day legality, unavailable days and declared club
nights. Each asserts the scheduler refuses or falls back, never pays.

---

## 4. BEFORE / AFTER

    worlds        80 built / 100 refused  ->  UNCHANGED (a port must not move them)
    full sweep    93 red -> 93 red.  0 newly red, 0 newly green
    typecheck     35 file/scope pairs worse, ALL [tests]; zero product, zero devtools

    clause-enforcement 83/83   scheduler 84/84   cyclic 124/124
    anchors 12/12              weekday-index 85/85

**No threshold, floor, ceiling, ratchet or baseline was reset.**

---

## 5. REMAINING REDS

| red | state |
| --- | --- |
| `test:weekly-dose-ownership` | the six contract-decided rows from the previous pass — §18's pre-season target (should be 4) and hard-day maximum (should be 5), plus anchors counted from the raw profile. **Specified, paused as ordered.** |
| `test:rules-kernel` | 1 cell — unclassified ("other") units in the live week |
| 91 others | unchanged from the pre-deletion rollback point; not investigated |
| 35 test files | reference symbols the deletion removed |

### Honest limits of this pass

1. **11 prohibitions delegate rather than check here** (WC-030, 044, 045, 046,
   048, 062, 063, 110, 113, 122, 133, 135). Each names its real owner and the
   guard requires that name, but **the guard does not verify the named owner
   actually enforces it** — that is a weaker claim than a typed rule and is
   labelled as such in the table.
2. **WC-020's completeness check asks only that the week intends patterns**, not
   that the composer delivered all eight. Delivery is §18's ledger; the honest
   scope is stated in the check.
3. The 80/180 world count is still the post-G-2 figure. The two paused
   bookkeeping fixes are expected to recover much of it.

---

## 6. MERGE RECOMMENDATION — **DO NOT MERGE**

Unchanged from the previous pass, and for the same reason: G-2 enforcement halved
the corpus and the two §18 corrections that would restore most of it are specified
and unimplemented. This pass added no new blocker — it made the rule *kinds*
explicit and enforceable, and moved zero worlds.

Agent: core
