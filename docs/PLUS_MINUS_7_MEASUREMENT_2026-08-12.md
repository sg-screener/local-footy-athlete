# THE ±7 INVENTION — MEASURED, AND IT ALREADY BITES SUNDAY-FIXTURE ATHLETES

LOOP CHECK `one-predicate-grows-copies-in-other-modules` — **sighting 3.** The
game-anchor unit collapsed eight copies of "which day is the game"; this measures
a NINTH shape of the same disease at a different altitude: **a second place that
takes the first fixture and drops the rest.** `derivedWeekContract.ts:90` was
named as THE waist; `section18CraftTier.ts:152` is a second one, in a file the
architecture doc did not list under §5 item 4. **DISPOSITION: a third sighting
means the duplicate-predicate gate proposed in `docs/STOP_2026-08-12_GAME_ANCHOR.md`
is owed, not another hand-collapse.**

**Order:** `docs/SEAT_INBOX.md` order 4(c) / `HOW_TO_BUILD_THIS_APP` §5 item 3.
**MEASUREMENT ONLY — nothing was changed.** Priced for the next unit.

**Every file read here was verified byte-identical to `main` first**
(`git diff main -- <file>` empty), because this checkout was sitting on another
agent's branch. A measurement of the wrong tree is not a measurement.

---

## §1 WHAT IS INVENTED, AND WHERE IT LANDS

`section18CraftTier.ts:152-163`:

```
const fixture = args.contract.anchors.find(a => a.kind === 'game' || a.kind === 'practice_match');
const fixtureDate = fixture ? isoDateForWeekday(weekStart, fixture.dayOfWeek) : null;
gameDates: fixtureDate ? [fixtureDate] : [],
...(fixtureDate ? { previousGameDate: shiftISO(fixtureDate, -7),
                    nextGameDate:     shiftISO(fixtureDate, +7) } : {}),
```

**TWO defects in twelve lines, not one:**

1. **`.find()` + a one-element list.** The contract's `anchors` array is already
   N-shaped; this takes the first fixture and silently drops any others. It is
   the same collapse as `derivedWeekContract.ts:90` in a second file.
2. **`±7` is fabricated from nothing.** No calendar read, no fixture list — just
   arithmetic on this week's fixture.

And the validator does not treat them as hints. `weekStructureValidator.ts`:

- `:254-256` — **`nextGameDate` is merged INTO `gameDates`**, so the invented
  game receives the full Section 17.C treatment: G-1 and G-2 protection carved
  around a fixture that may not exist.
- `:271-272` — `previousGameDate` is pushed into `gPlusOneSources`, so the day
  after an invented game is judged as recovery.

## §2 WHICH DAYS ACTUALLY BLEED — the arithmetic, not the vibe

The guards are `weekDates.has(g1)` / `has(gPlus1)`, so an invented neighbour only
matters when its protected day falls INSIDE the Monday–Sunday week being judged.

| Invented anchor | Protected days | Lands in THIS week when the fixture is |
| --- | --- | --- |
| `nextGameDate` = fixture **+7** | G-1 = +6, G-2 = +5 | **Monday** (G-1 = this Sunday), **Tuesday** (G-2 = this Sunday) |
| `previousGameDate` = fixture **−7** | G+1 = −6 | **Sunday** (G+1 = this Monday) |

**THE HEADLINE, AND IT CORRECTS THE ARCHITECTURE DOC'S FRAMING.**
`HOW_TO_BUILD_THIS_APP` §5 item 3 describes this as a defect *"for an irregular
fixture list"* — i.e. a consequence of the midweek work. **It is narrower than
that in one direction and wider in another: it never fires for Friday or
Saturday fixtures at all, and it ALREADY fires for SUNDAY fixtures**, which the
app has supported since long before 2026-08-12.

**A Sunday-fixture athlete's MONDAY is judged as the day after a game that the
app invented.** Correct by luck while fixtures are weekly and unbroken. Wrong on:
the first in-season week, the week after a bye, the week after a phase shift into
In-season, and any split round.

**Monday and Tuesday fixtures bleed the other way**, and those became reachable
for the first time in `06401d92`.

## §3 WHAT THE ATHLETE SEES, AND WHY IT IS NOT COSMETIC

Both findings are real, athlete-visible refusals:

- `g_plus1_hard_work` — *"…is the day after a game — G+1 should be rest or
  recovery."* **`severity: 'strong'` when the session's stress is high.**
- `g1_not_light` — *"…is the day before the {Day} game…"*, same escalation.

Since `2db1b8ce` the craft tier **BLOCKS** on `strong`. So an invented game can
refuse a week the athlete asked for, with copy naming a game that does not exist.

**And they carry `canOverride: true`, which changes nothing** — `canOverride` is
written in nine places and read **nowhere in production**
(`HOW_TO_BUILD_THIS_APP` §1). The athlete is told a rule about a phantom fixture
and has no way past it. **This is `LAW-computed-must-be-consumed` and the missing
Layer 3 meeting in one message box.**

## §4 THE FIX, PRICED

**Derive from the fixture list; pass nothing when there is no neighbour.** The
calendar already stores every fixture date and `targetWeekFixtures` already
returns them all (`fixtureConditionedAvailability.ts:146-149`) — the honest
neighbours are a lookup, not arithmetic.

- **Cheapest correct step:** delete the `±7` synthesis and pass
  `previousGameDate` / `nextGameDate` **only when a real fixture exists** in the
  weeks either side. Removes the phantom entirely; the regular-weekly case keeps
  its protection because the neighbour is genuinely there.
- **Same commit, or it is a half-fix:** `:152`'s `.find()` → the anchor LIST, so
  a two-game week stops being a one-game week here as well.
- **The guard this needs:** a cell that builds a first-in-season week with a
  Sunday fixture and asserts **no `g_plus1_hard_work` finding on the Monday**,
  plus a Monday-fixture week asserting no `g1_not_light` on the Sunday. Both red
  today. Mutation: re-introduce `±7` and both must red.

**NOT a rewrite of Section 17.** The kernel is right and already loops every
game date; only its INPUT is fabricated.

## NOT COVERED

- **Nothing was run.** This is a static measurement; no suite was executed and
  no world was built, because the checkout was on another agent's branch and any
  number produced here would describe a tree that exists nowhere.
- **The claim in §2 that `previousGameDate` misfires on the first in-season week
  is derived from the arithmetic, not observed** — it needs the cell in §4 to
  become a receipt. Written as a prediction, not a result.
- **How often real athletes hit it is OPEN-UNKNOWN** — no telemetry was read.
- **Practice matches** are folded into the same `.find()` and were not analysed
  separately.
- `derivedWeekContract.ts:90` (§5 item 4) remains untouched.

**NORTH STAR: toward.** The fix REMOVES a representation — two invented dates
replaced by a read of the fixture list that already exists.
