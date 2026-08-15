# The weekly scheduling contract, as the app executes it

Generated from `docs/WEEKLY_PROGRAMMING_SOURCE_REVIEW_2026-08-14.md`
sha256 `0d34e288c23f0654d0163d41dff1a73050697d54219ecf6facd84ef1eb68c190`
Approved: Sam, 2026-08-15: "okay i approve it"

Nothing on this page is hand-written. Every layout row is read from the
typed contract and every week is produced by the scheduler.

---

## Every approved base layout

| Clause | Phase | Gym days | Weekend | Required sessions | Purposes | Set budget |
| --- | --- | ---: | --- | ---: | --- | --- |
| `WC-100` | In-season | 2 | either | **2** | full_body + full_body | 12-15, ceiling 16 |
| `WC-101` | In-season | 3 | either | **3** | lower + upper_pull + upper_push | 12-15, ceiling 16 |
| `WC-102` | In-season | 4, 5, 6 | either | **3** | lower + upper_pull + upper_push | 12-15, ceiling 16 |
| `WC-103` | In-season | 4, 5, 6 | either | **4** | lower_squat + upper_pull + lower_hinge + upper_push | 10 (approved exception) |
| `WC-110` | Pre-season | 2 | either | **2** | full_body + full_body | 12-15, ceiling 16 |
| `WC-111` | Pre-season | 3 | unavailable | **3** | lower + upper + full_body | 12-15, ceiling 16 |
| `WC-112` | Pre-season | 3 | available | **3** | full_body + full_body + full_body | 12-15, ceiling 16 |
| `WC-113` | Pre-season | 4, 5, 6 | either | **4** | upper_pull + lower_squat + upper_push + lower_hinge | 12-15, ceiling 16 |
| `WC-120` | Off-season | 2 | either | **2** | full_body + full_body | 12-15, ceiling 16 |
| `WC-121` | Off-season | 3 | either | **3** | lower + upper + full_body | 12-15, ceiling 16 |
| `WC-122` | Off-season | 4, 5, 6 | either | **4** | lower_squat + upper_pull + lower_hinge + upper_push | 12-15, ceiling 16 |

**11 layout rows · 41 typed clauses.**

## The in-season fourth-session selector, resolved

| Athlete | Gym days | Result |
| --- | ---: | --- |
| age 25 | 4 | **4 sessions** (`WC-103`) |
| age 27 (the ceiling) | 4 | **4 sessions** (`WC-103`) |
| age 28, no earned arm | 4 | **3 sessions** (`WC-102`) |
| age 34, consistent + high readiness + low fatigue | 4 | **4 sessions** (`WC-103`) |
| age 22 but LOW READINESS | 4 | **3 sessions** (`WC-102`) |

---

## Representative athlete weeks

### In-season, 2 gym days, Tue/Thu club, Saturday game

_Two sessions — Full Body x2._

Layout `WC-100` · **2 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | full_body | strength | off_leg | 12-15 |  |  |
| Tue | — | club | — | — | yes |  |
| Wed | full_body | strength | off_leg | 12-15 |  |  |
| Thu | — | club | — | — | yes |  |
| Fri | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sat | — | game | — | — |  | yes |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, hinge, horizontal_push, horizontal_pull, single_leg_knee, single_leg_hip

### In-season, 3 gym days on the club nights, Saturday game

_The contract's own reference week: an upper session paired with each club night._

Layout `WC-101` · **3 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | lower | strength | off_leg | 12-15 |  |  |
| Tue | upper_pull | strength | running | 12-15 | yes |  |
| Wed | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Thu | upper_push | strength | running | 12-15 | yes |  |
| Fri | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sat | — | game | — | — |  | yes |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, hinge, single_leg_knee, single_leg_hip, horizontal_pull, vertical_pull, horizontal_push, vertical_push

### In-season, 4 gym days, YOUNGER athlete (24)

_Selector met — four sessions, split Lower Squat / Lower Hinge at 10 sets._

Layout `WC-103` · **4 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | lower_squat | strength | off_leg | 10 |  |  |
| Tue | upper_pull | strength | running | 10 | yes |  |
| Wed | lower_hinge | strength | off_leg | 10 |  |  |
| Thu | upper_push | strength | running | 10 | yes |  |
| Fri | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sat | — | game | — | — |  | yes |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, single_leg_knee, horizontal_pull, vertical_pull, hinge, single_leg_hip, horizontal_push, vertical_push

### In-season, 4 gym days, OLDER athlete (34), no earned arm

_Selector not met — the three-session layout is retained._

Layout `WC-102` · **3 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | lower | strength | off_leg | 12-15 |  |  |
| Tue | upper_pull | strength | running | 12-15 | yes |  |
| Wed | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Thu | upper_push | strength | running | 12-15 | yes |  |
| Fri | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sat | — | game | — | — |  | yes |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, hinge, single_leg_knee, single_leg_hip, horizontal_pull, vertical_pull, horizontal_push, vertical_push

### Pre-season, 2 gym days, no club

_Full Body x2, and required running leaves the gym days._

Layout `WC-110` · **2 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | full_body | strength | off_leg | 12-15 |  |  |
| Tue | — | conditioning | running | — |  |  |
| Wed | full_body | strength | off_leg | 12-15 |  |  |
| Thu | — | conditioning | running | — |  |  |
| Fri | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sat | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, hinge, horizontal_push, horizontal_pull, single_leg_knee, single_leg_hip

### Pre-season, 3 gym days, weekend UNAVAILABLE

_Lower + Upper + Full Body._

Layout `WC-111` · **3 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | lower | strength | off_leg | 12-15 |  |  |
| Tue | — | conditioning | running | — |  |  |
| Wed | upper | strength | running | 12-15 |  |  |
| Thu | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Fri | full_body | strength | off_leg | 12-15 |  |  |
| Sat | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, hinge, single_leg_knee, single_leg_hip, horizontal_push, horizontal_pull, vertical_push, vertical_pull

### Pre-season, 5 gym days, no club

_Four required sessions; the fifth day does not create a fifth session._

Layout `WC-113` · **4 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | upper_pull | strength | running | 12-15 |  |  |
| Tue | lower_squat | strength | off_leg | 12-15 |  |  |
| Wed | upper_push | strength | running | 12-15 |  |  |
| Thu | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Fri | lower_hinge | strength | off_leg | 12-15 |  |  |
| Sat | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: horizontal_pull, vertical_pull, squat, single_leg_knee, horizontal_push, vertical_push, hinge, single_leg_hip

### Off-season weeks 1-2, 2 gym days

_Every session OPTIONAL — zero completed is a valid week._

Layout `WC-120` · **2 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | full_body _(optional)_ | strength | off_leg | 12-15 |  |  |
| Tue | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Wed | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Thu | full_body _(optional)_ | strength | off_leg | 12-15 |  |  |
| Fri | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sat | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, hinge, horizontal_push, horizontal_pull, single_leg_knee, single_leg_hip

### Off-season weeks 3-4, 3 gym days

_The skeleton is required again at 90% load._

Layout `WC-121` · **3 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | lower | strength | off_leg | 12-15 |  |  |
| Tue | — | conditioning | running | — |  |  |
| Wed | upper | strength | running | 12-15 |  |  |
| Thu | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Fri | full_body | strength | off_leg | 12-15 |  |  |
| Sat | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, hinge, single_leg_knee, single_leg_hip, horizontal_push, horizontal_pull, vertical_push, vertical_pull

### Off-season week 5+, 4 gym days

_Lower x2 + Upper x2 on the best-spaced days._

Layout `WC-122` · **4 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | lower_squat | strength | off_leg | 12-15 |  |  |
| Tue | upper_pull | strength | running | 12-15 |  |  |
| Wed | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Thu | lower_hinge | strength | off_leg | 12-15 |  |  |
| Fri | upper_push | strength | running | 12-15 |  |  |
| Sat | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sun | — _(optional)_ | rest_or_recovery | — | — |  |  |

Patterns intended this week: squat, single_leg_knee, horizontal_pull, vertical_pull, hinge, single_leg_hip, horizontal_push, vertical_push

### Wednesday/Friday club, SUNDAY game — real weekdays, not assumed

_Anchors follow the athlete, and Saturday (G-1) holds no strength._

Layout `WC-103` · **4 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | lower_squat | strength | off_leg | 10 |  |  |
| Tue | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Wed | upper_pull | strength | running | 10 | yes |  |
| Thu | lower_hinge | strength | off_leg | 10 |  |  |
| Fri | upper_push | strength | running | 10 | yes |  |
| Sat | — _(optional)_ | rest_or_recovery | — | — |  |  |
| Sun | — | game | — | — |  | yes |

Patterns intended this week: squat, single_leg_knee, horizontal_pull, vertical_pull, hinge, single_leg_hip, horizontal_push, vertical_push

### Explicit unavailable days (Wed, Sat, Sun)

_Those days never appear in the week at all._

Layout `WC-113` · **4 required strength sessions**

| Day | Session | Owner | Conditioning | Sets | Club | Game |
| --- | --- | --- | --- | --- | --- | --- |
| Mon | upper_pull | strength | running | 12-15 |  |  |
| Tue | lower_squat | strength | off_leg | 12-15 |  |  |
| Thu | upper_push | strength | running | 12-15 |  |  |
| Fri | lower_hinge | strength | off_leg | 12-15 |  |  |

Patterns intended this week: horizontal_pull, vertical_pull, squat, single_leg_knee, horizontal_push, vertical_push, hinge, single_leg_hip
