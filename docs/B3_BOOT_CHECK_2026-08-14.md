# FINAL B3 BOOT CHECK — 2026-08-14

**Base: `slice-b3-verification-correction` @ `7d1eaf6e`.** Separate worktree;
shared checkout untouched. **Zero production diff** — this is a measurement.

Two athlete inputs driven through the **real durable door**
(`executeProgramControlActionDurably`). **Nothing was seeded**: no
`activeConstraints`, no `acceptedMaterialContext`, no derived state written by
hand. Production derived everything from the athlete's own fact.

**VERDICT: MERGE.** Both facts and both derived constraints survive the
relaunch, and the readiness reduction lands exactly where it should. The one
failure found is **pre-existing at `54758870`, before any B3 work** — measured,
not assumed — and belongs to a class this mission explicitly excludes.

---

## THE WORLD, AND WHY IT TOOK THREE ATTEMPTS TO FIND

In-season · 4 training days (Mon/Tue/Thu/Fri) · club Tue+Thu · **game
Wednesday** · full gym.

Finding a week with genuinely **composer-owned Friday work** was not trivial and
the failures are worth recording:

| attempt | Friday | composer-owned rows |
| --- | --- | ---: |
| game Saturday (any day count) | `"Gunshow"` | **0** — G−1 reserves it for the optional arms day, which is signed-pool content |
| no club, game Sunday | composer upper day | 5 — **but onboarding REFUSES**: an In-season athlete must state team-training days |
| **club Tue+Thu, game Wednesday** | `"Lower body strength (squat + hinge)"` | **5** ✓ |

A tape run on either of the first two would have proved nothing — the first has
no composer work on Friday at all, and the second cannot be onboarded.

---

## TAPE 1 — READINESS ON A DATED COMPOSER SESSION · **PASS**

Door: `set_fatigue_status { date: 2026-07-17 (Fri), level: 'cooked' }`.

```
DOOR ......................... ACCEPTED
BEFORE RELAUNCH
  fact persisted on disk ..... {"count":1,"kinds":["fatigue"]}
  constraint derived ......... {"count":1,"kinds":["fatigue"]}
  Friday main sets ........... [3,3] -> [3,3]
  Mon/Tue/Thu byte-identical . true
AFTER RELAUNCH
  fact still on disk ......... {"count":1,"kinds":["fatigue"]}
  constraint still derived ... {"count":1,"kinds":["fatigue"]}
  Friday main sets ........... [2,2]
  Mon/Tue/Thu vs pre-action .. IDENTICAL
```

**Every required proof holds:**

- the fact is accepted and **persisted to disk** (read from the envelope, not
  from memory);
- the fatigue constraint is **derived before relaunch**;
- both **survive the relaunch**;
- the regenerated week carries the reduction — Friday's main lifts `[3,3] → [2,2]`,
  `DELOAD_LAW`'s half-sets-to-the-floor-of-2 on composed strength;
- **the reduction is on the governed date and nowhere outside it** —
  Mon/Tue/Thu are byte-identical to the pre-action week.

**One nuance worth stating rather than hiding:** the reduction appears **at the
relaunch, not at the tap**. The action carries `requiresRebuild: true` and this
tape did not rebuild in-session, so the fact governed the next generation — which
is the boot. That is coherent with the architecture (the week is derived from
stored decisions at every launch), and it is the behaviour the gate asked about.

## TAPE 2 — FRIDAY AWAY, ON COMPOSER-OWNED WORK · **FACT AND CONSTRAINT PASS; THE WEEK REFUSES, AND THE REFUSAL PRE-DATES B3**

Door: `set_schedule_modifier { awaySpan: { from: Fri, until: Fri } }`.

```
DOOR ......................... ACCEPTED
BEFORE RELAUNCH
  fact persisted on disk ..... {"count":1,"kinds":["schedule"]}
  constraint derived ......... {"count":1,"kinds":["schedule"]}
    -> {type:'schedule', scheduleKind:'travel',
        start:'2026-07-17', expires:'2026-07-17'}
  Friday ..................... "Lower body strength (squat + hinge)" [Mixed] 6 rows
  other days still have work . true
AFTER RELAUNCH
  regenerated week ........... REFUSED
    main_strength_required_minimum: expected 2, actual 1
    required_safe_patterns_present: push
    required_safe_patterns_present: pull
```

**The persistence-to-generation handoff WORKS** — the fact reaches disk, the
constraint is derived from it, and it survives the relaunch. Nothing disappeared,
so this is not the handoff case the mission scoped a fix for.

**Friday keeping its 6 rows is CORRECT, not a failure.** The away door
deliberately does not clear the athlete's own gym session — Sam ruled it twice
(*"if yes, follow same program"*) and then ruled what away *does* do: *"yes clear
team training and games while away"*. Club-bound work only. My tape's original
expectation ("Friday remains unavailable") was wrong about the door.

**The refusal is real and athlete-facing:** push and pull live on **Monday** in
this week, and a **Friday-only** travel constraint leaves the regenerated week
without them. An athlete who says "I'm away Friday" gets a week that will not
build.

**BUT IT IS NOT B3'S, AND THAT WAS MEASURED, NOT ASSUMED.** The identical action
was run at `54758870` — before every B3 commit:

| | main_strength | patterns |
| --- | --- | --- |
| at `54758870` (pre-B3) | `main_strength_required_minimum:1` | `required_safe_patterns_present:0`, `:0` |
| at `7d1eaf6e` (this branch) | `main_strength_required_minimum:1` | `required_safe_patterns_present:push`, `:pull` |

**Same refusal, same counts.** The only difference is that B3 now NAMES the
missing patterns instead of printing `:0` twice — the diagnostic improvement made
during the verification correction, which is what allowed this to be diagnosed at
all.

It is the same class as the 60 ordinary refusals (a composition/planning
shortfall once days are removed), which this mission excludes explicitly, and it
is a pre-existing defect of the AWAY feature — not a B3 regression.

---

## GATES

| gate | result |
| --- | --- |
| 180-world identity baseline | **120 retained · 0 lost · 0 gained · 0 content changed** |
| production diff vs base | **none** |
| `test:compile` | PASSED, baseline unchanged |
| `test:generated-week` | 36 / 0 |
| `test:generated-week-assembly` | 30 / 0 |
| `test:composer-severance` | 73 / 0 |
| `test:feature-registry` | 6 / 0 |
| `test:pools` | 473 / 1 — known pinning red only |
| repair/regenerate/fallback at generation | none (unchanged from the B3 matrix) |

---

## NOT COVERED

- **Only these two doors.** `set_illness_status`, `set_injury_modifier`,
  `set_equipment_modifier` and the rest were not re-driven here.
- **One week, one world.** The tapes run week 1 of one In-season block.
- **The in-session rebuild path.** Tape 1 shows the effect at the next
  generation; the `requiresRebuild: true` in-session rebuild was not driven.
- **No device or simulator pass.**

---

## THE ONE THING TO CARRY FORWARD

**An athlete who marks a single day away can get a week that refuses to build.**
Measured here, reproduced at `54758870`, and out of scope for B3 in every
direction the mission drew. It belongs with the away feature and the composition
shortfalls, and it now has a diagnosable signature (`:push`, `:pull`) that it did
not have a day ago.

*Agent: core, 2026-08-14. This closes B3.*
