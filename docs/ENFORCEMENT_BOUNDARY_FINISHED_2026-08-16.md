# THE ENFORCEMENT BOUNDARY, FINISHED — 2026-08-16, seat `core`

Branch `slice-weekly-scheduler`. Worktree-isolated. **No merge.** Planner deleted.
No bookkeeping fixes, no scheduling changes, no threshold resets.

---

## 0. UNITS, STATED ONCE

Every number below carries its denominator. The previous reports' bare "93" meant
**failing SUITES**, and I did not say so.

| figure | unit |
| --- | --- |
| **93 of 414** | failing **suites** (npm `test:*` scripts), whole-suite pass/fail |
| **105/105**, **84/84** | assertion **cells** inside one suite |
| **80 built / 100 refused of 180** | generation **occurrences** (90 athlete setups × 2 run lengths) |
| **50 of 90** | distinct athlete **setups** that refuse |
| **35** | file/scope **pairs** worse in `test:compile`, all `[tests]` |

---

## 1. THE 12 DELEGATED PROHIBITIONS — EXECUTED RECEIPTS

**Twelve, not eleven.** My previous report said 11 and then listed 12; the list was
right and the count was wrong.

All 12 reported HELD on first execution. **Reading them mattered more than running
them**, because two shapes of receipt proved worthless:

- **WC-030's was VACUOUS.** It called `baseLayoutFor` with the wrong argument shape,
  measured `0` sets against a ceiling of 16, and printed HELD. `SetBudget` is
  `{preferredMin, preferredMax, hardCeiling}` — my check read `main`/`secondary`,
  which do not exist. **A check that reads a missing field always passes.**
- **WC-044 and WC-046 never approached their limits.** They showed the ban was not
  NEEDED in that world, never that it BINDS.

So eight moved. Four stayed, each on a receipt that genuinely exercises it:

| clause | world executed | observed | verdict |
| --- | --- | --- | --- |
| WC-048 | off-season Full Body ×2, the densest strength day the app builds | max 5 strength rows on one day; ceiling 7 | HELD — composer owns it, measured end-to-end |
| WC-062 | athlete declares NO club nights (Tue/Thu was the old default) | club days in week: `[]` | HELD — an input FACT, not a competing verdict |
| WC-110 | pre-season, the only two gym days are adjacent (Mon+Tue) | refused `no_legal_arrangement_within_spacing_rules` | HELD — refuses through WC-043, which IS in the owner |
| WC-135 | in-season **with** club nights / **without** club nights | sprint days `[]` / `[2]`, none later than G-3 | HELD — both halves of the rule exercised |

---

## 2. ONE AUTHORITATIVE VERDICT, TWO MOMENTS

`weeklyLegality.ts` now holds **16 of the 20 prohibitions** across two tables in
one module:

- **candidate-time** (`LEGALITY_RULES`) — answered about an arrangement *before it
  can be scored*.
- **week-time** (`WEEK_LEGALITY_RULES`) — answered once running top-ups, anchor
  conditioning and the layout's session count exist. `scheduleWeek` returns a typed
  refusal carrying the clause id.

**The downstream loops still COMPUTE these facts. They no longer render the
verdict** — which is the distinction Sam asked for: other modules supply facts, not
competing verdicts.

### ⚠ Coverage is not binding, and I measured the difference

Neutering WC-045, WC-046 and WC-063 changed **nothing observable across all 180
worlds** — the scheduler never produces a week approaching those limits. That is
the same weakness the delegation notes had, merely relocated. So section [9] of the
guard calls the owner **directly** with facts engineered to violate each rule:
8 rules × (refused + correctly attributed) = 16 cells that prove the verdict rather
than the presence of a function.

That section immediately found an ordering defect: **WC-063 is the general form of
WC-113/WC-122**, so running it first made every pre-season and off-season breach
report as WC-063 — a real rule, but the wrong one. **A wrong attribution is worse
than none**; the next reader goes looking in the wrong clause. Specific now
precedes general.

### WC-133 fired on the contract's OWN approved layout

My predicate used `PURPOSE_IS_LOWER`, which is true for `full_body`, so "no more
than two lower sessions" refused the approved pre-season **Full Body ×3** row. A
full-body day is not a lower day in that sentence. Narrowed to explicit lower
purposes. **Caught by the scheduler suite the moment the rule went live.**

---

## 3. WC-020 MEASURES DELIVERY, NOT THE REQUEST

It asked whether the week INTENDED patterns — a fact the scheduler itself decides,
so **it could never fail**. It now compares the intended set against the patterns
the FINAL week actually delivers.

    MUTATION: point the comparison back at the request
      -> FAIL  dropping a DELIVERED row for an intended pattern fails completeness
      -> FAIL  ...and the failure names the pattern that went missing
      103/105 cells

---

## 4. WORLDS — LOST AND GAINED, SEPARATELY

    before this pass   80 built / 100 refused   (50 of 90 setups refuse)
    after  this pass   80 built / 100 refused   (50 of 90 setups refuse)

    LOST: 0        GAINED: 0

Not a net figure — both are genuinely zero. The four refusal families are
**identical occurrence-for-occurrence** to the pre-pass census (60 / 20 / 16 / 4),
which is the evidence that no enforcement gap opened or closed. **A boundary pass
that moved a world would have needed an explanation; none did.**

---

## 5. THE FINAL TABLE

| clause | exact rule | kind | canonical input fact | enforcement site | validation site |
| --- | --- | --- | --- | --- | --- |
| WC-020 | Across the complete week, aim for at least one meaningful exposure in each of the eight named pa | REQUIREMENT | intendedPatterns across the week | — | COMPLETENESS (typed check) |
| WC-021 | Additional exposures remain balanced with their partner, measured across the whole week, not nec | preference | pattern partner balance | — | — |
| WC-022 | Do not repeat the same movement plane on consecutive days. Different planes in the same broad fa | PROHIBITION | purpose plane, consecutive days | LEGALITY owner — candidate-time | — |
| WC-023 | Each session purpose intends a stated set of movement patterns. | definition | PATTERNS_FOR_PURPOSE | — | — |
| WC-024 | Which session purposes load the legs, for lower spacing. | definition | PURPOSE_IS_LOWER | — | — |
| WC-030 | Prefer 12-15 main/secondary working sets; 16 is a hard ceiling; the same limit applies to Lower, | PROHIBITION+preference | setBudget per session | LEGALITY owner — week-time | — |
| WC-031 | Split in-season Lower Squat and Lower Hinge sessions use 10 main/secondary working sets — an app | definition | split in-season set budget | — | — |
| WC-040 | Prefer 4 hard days; allow 5. The app does not program 6. | PROHIBITION+preference | hard days across the week | LEGALITY owner — candidate-time | — |
| WC-041 | Prefer no more than 3 consecutive hard days; 4 acceptable when availability requires; 5 only whe | PROHIBITION+preference | consecutive hard days | LEGALITY owner — candidate-time | — |
| WC-042 | Normally 1-2 full rest days; early off-season and bye-recovery may have 3. | preference | full rest day count | — | — |
| WC-043 | At least one complete day between hard lower sessions; never place lower strength sessions on co | PROHIBITION | lower session spacing | LEGALITY owner — candidate-time | — |
| WC-044 | No more than 3 running days consecutively. | PROHIBITION | consecutive running days | LEGALITY owner — week-time | — |
| WC-045 | Aim for 3-5 conditioning exposures; club training and games count; total cap 5 and a fifth is of | PROHIBITION+REQUIREMENT+preference | conditioning exposures incl. anchors | LEGALITY owner — week-time | COMPLETENESS (typed check) |
| WC-046 | Running minimum 2, preferred 3, maximum 4. Club training counts. | PROHIBITION+REQUIREMENT+preference | running day count | LEGALITY owner — week-time | COMPLETENESS (typed check) |
| WC-047 | Aim for 2-3 upper exposures per week. | preference | upper exposures per week | — | — |
| WC-048 | Seven app-authored strength movements is a daily ceiling, not a target. Mobility does not count. | PROHIBITION | daily movement ceiling | delegated -> composer daily movement ceiling | — |
| WC-050 | Game proximity constrains the days around the fixture. | PROHIBITION | gameDay + fixtureRecurrence | LEGALITY owner — candidate-time | — |
| WC-051 | G-2 prohibits added LOWER-BODY sprint, jumping, plyometric and power work. Upper-body power is p | PROHIBITION | G-2 lower power / speed work | LEGALITY owner — candidate-time | — |
| WC-060 | Required strength work is never placed outside gym-access days. Equipment-free running or condit | PROHIBITION | gymAccessDays | LEGALITY owner — candidate-time | — |
| WC-061 | Any work placed outside gym-access days must still respect game and club placement, spacing, and | PROHIBITION | unavailableDays | LEGALITY owner — candidate-time | — |
| WC-062 | Use the athlete's real club nights; never assume Tuesday/Thursday. | PROHIBITION | clubNights (declared, never assumed) | delegated -> coachingInputsToSchedulerInputs — declared club nights only | — |
| WC-063 | Availability is permission, not a quota. Five or six available days do not create five or six re | PROHIBITION | availability is not a quota | LEGALITY owner — week-time | — |
| WC-100 | Full Body x2 on the best-separated days. | definition | layout: In-season 2 days | — | — |
| WC-101 | Lower + Upper Pull + Upper Push. With two club nights, pair one upper session with each. | definition | layout: In-season 3 days | — | — |
| WC-102 | Selector NOT met — the three-session layout is retained. Availability above three never creates  | definition | layout: In-season 4, selector unmet | — | — |
| WC-103 | Selector MET — four sessions. The fourth creates separate Lower Squat and Lower Hinge days, each | definition | layout: In-season 4, selector met | — | — |
| WC-110 | Full Body x2 on the best-separated gym days, never back-to-back. | PROHIBITION | layout: Pre-season 2, never back-to-back | delegated -> WC-043 spacing above | — |
| WC-111 | Weekend unavailable: Lower + Upper + Full Body. | definition | layout: Pre-season 3, no weekend | — | — |
| WC-112 | Weekend available: Full Body x3 on the best-separated days. | definition | layout: Pre-season 3, weekend | — | — |
| WC-113 | Upper x2 + Lower x2. Pair running/top-end with Upper and off-leg conditioning with Lower. Extra  | PROHIBITION | layout: Pre-season 4+, no fifth | LEGALITY owner — week-time | — |
| WC-120 | Full Body x2 on the best-separated gym days. | definition | layout: Off-season 2 | — | — |
| WC-121 | Lower + Upper + Full Body on the best-separated gym days. Full Body fills the movement patterns  | definition | layout: Off-season 3 | — | — |
| WC-122 | Lower x2 + Upper x2 on the best-spaced four gym days. Extra days may hold optional work; they do | PROHIBITION | layout: Off-season 4+, no fifth | LEGALITY owner — week-time | — |
| WC-130 | Off-season weeks 1-2: every session optional, zero completed is valid, 75% load, no required run | preference | off-season weeks 1-2 overlay | — | — |
| WC-131 | Off-season weeks 3-4: the normal strength skeleton becomes required again, 90% load, conditionin | REQUIREMENT | off-season weeks 3-4 overlay | — | -> off-season weeks 3-4 overlay — required skeleton returns |
| WC-132 | Off-season week 5 onward: normal loading, 2-4 required strength sessions by availability, condit | REQUIREMENT | off-season week 5+ overlay | — | -> off-season week 5+ overlay — sprint exposure floor |
| WC-133 | Pre-season: prefer four strength sessions when availability permits, scale honestly to two or th | PROHIBITION+REQUIREMENT+preference | pre-season overlay, max two lower | LEGALITY owner — week-time | -> pre-season overlay sets the demand; §18 judges the delivery |
| WC-134 | In-season: maintain strength and conditioning while arriving fresh for the game. No scheduled ca | definition | in-season overlay | — | — |
| WC-135 | In-season, only add sprint work when there is no club training, and place it G-3 or earlier. | PROHIBITION | in-season sprint placement | delegated -> inSeasonSprintDay placement | — |
| WC-140 | The in-season fourth-session age ceiling is 27. | definition | FOURTH_SESSION_AGE_CEILING | — | — |
| WC-141 | Use four in-season sessions when the athlete is 27 or younger, OR when they consistently complet | definition | inSeasonUsesFourSessions selector | — | — |
| WC-142 | One entry point resolves phase x availability to a base layout. | definition | baseLayoutFor entry point | — | — |

42 clauses · 20 prohibitions · 6 requirements · 15 definitions

---

## 6. GATES

    clause-enforcement   105/105 cells      scheduler      84/84 cells
    cyclic-proximity     124/124 cells      anchors        12/12 cells
    weekday-index         85/85 cells

    full sweep     93 of 414 suites failing — 0 newly red, 0 newly green
    test:compile   35 file/scope pairs worse, ALL [tests].
                   ZERO product, ZERO devtools.

**No threshold, floor, ceiling, ratchet or baseline was reset.**

### Remaining reds, by unit

| red | unit | state |
| --- | --- | --- |
| `test:weekly-dose-ownership` | 6 failing cells | the contract-decided rows: §18's pre-season target (should be 4) and hard-day maximum (should be 5), plus anchors counted from the raw profile |
| `test:rules-kernel` | 1 failing cell of 122 | unclassified ("other") units in the live week |
| 91 other suites | suites | unchanged from the pre-deletion rollback point; not investigated |
| 35 test files | file/scope pairs | reference symbols the deletion removed |

---

## 7. NO CLAUSE NEEDS A SAM RULING

All 42 resolved against the approved source. The one that looked like it might —
WC-133's "two lower sessions" against the approved Full Body ×3 layout — was my
misreading, settled by the contract's own layout table, not by a new ruling.

---

## 8. ARE THE TWO PAUSED BOOKKEEPING FIXES SAFE TO START?

**Yes, and this pass is what makes them safe.**

Both corrections raise a ceiling: §18's pre-season strength target 3 → 4, and its
hard-day permitted maximum 4 → 5. Before today, raising a ceiling was risky in a
specific way — **the scheduler had prohibitions living as scores**, so a raised
§18 number could have been absorbed by the scorer and produced a week that broke a
ban without refusing.

That can no longer happen:

- WC-063 / WC-113 / WC-122 now refuse a fifth required strength session **in the
  legality owner**, so raising the pre-season target to 4 cannot drift to 5.
- WC-040 refuses a sixth hard day **in the legality owner**, so raising the
  permitted maximum to 5 cannot drift to 6.
- Both rules are proven to BIND by direct-call cells, not merely to exist.

**Recommended order:** the §18 numbers first (they are pure bookkeeping and should
recover worlds), then the anchor-counting correction, measuring worlds between the
two so a change is attributable to one of them rather than to both.

**Expected effect: worlds GAINED, none lost.** If any world is lost, that is an
enforcement gap this pass did not find and it should stop the fix.

Agent: core
