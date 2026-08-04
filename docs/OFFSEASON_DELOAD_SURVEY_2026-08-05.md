# Off-season deload — the survey, before any code

Ordered by `docs/OFFSEASON_DELOAD_RULING_2026-08-05.md`: *"Survey where
generation currently places off-season deloads; report the athlete-visible
change before regenerating any golden."*

**RESULT: the law is already implemented, already gated, and nothing changes
for the athlete. No code is warranted, and the instruction to remove the
block-2 deload would BREAK the law it cites. Nothing was built.**

---

## 1. Are early / mid / late real typed phases?

**Yes** — this was the doc's stop-condition, and it is satisfied.
`CanonicalOffseasonSubphase = 'early_offseason' | 'mid_offseason' |
'late_offseason'` (`src/rules/seasonPhaseClock.ts:7`), resolved by
`resolveSeasonSubphaseAtPhaseWeek`, with a policy table per subphase in
`src/rules/offseasonSubphasePolicy.ts`. Nothing had to be invented.

They are keyed on **phase week number** — time since the athlete entered
Off-season — which is exactly what the Bible requires at `:4605`: *"Off-season
subphase ownership is based on time since the athlete entered Off-season, not
the current block number."*

## 2. Where the app puts deloads today — measured, not read

There is exactly ONE producer of a scheduled deload week:
`resolveSeasonPhaseWeekKind` (`seasonPhaseClock.ts:84`). `getWeeksSinceDeload`
— the only block-relative counter in the codebase — has **no product
callers**. So block position cannot schedule a deload.

| off-season phase week | subphase | week kind |
|---|---|---|
| 1, 2 | early_offseason | build |
| 3, 4 | mid_offseason | build |
| 5, 6, 7 | late_offseason | build |
| **8** | late_offseason | **deload** |
| 9, 10, 11 | late_offseason | build |
| **12** | late_offseason | **deload** |
| **16, 20, …** | late_offseason | **deload** |

The guard is `phaseWeekNumber > 4 && (phaseWeekNumber - 4) % 4 === 0`.

**Weeks 1–4 cannot carry a scheduled deload. The `> 4` is the law, in code.**

Confirmed end to end by generating three consecutive off-season blocks from one
profile (phase entry 2026-07-06):

| block | week starts | week kind | multiplier | phase week |
|---|---|---|---|---|
| 1 | 07-06 / 07-13 / 07-20 / 07-27 | build ×4 | 1.0 | 1–4 |
| 2 | 08-03 / 08-10 / 08-17 / **08-24** | build, build, build, **deload** | **0.85** | 5–8 |
| 3 | 08-31 / 09-07 / 09-14 / **09-21** | build, build, build, **deload** | **0.85** | 9–12 |

## 3. It is already gated

`test:deload-week` — chained into `test:bible` by unit 7 — carries three cells
on exactly this law, and all three pass:

- `week kind table: first Off-season phase week 4 builds`
- `first Off-season phase block keeps all four weeks as build`
- `first Off-season phase week 4 receives no deload prescription notes`

## 4. The athlete-visible change

**None.** Every off-season deload the app can schedule already falls in
`late_offseason`. Weeks 1–4 are all `build` at multiplier 1.0. Enforcing the
law changes no week, no session and no dose, because the law is not being
broken.

## 5. The premise correction — the block-2 deload is NOT in week 4

The ruling doc's consequence reads: *"a deload is being SCHEDULED in weeks 1–4
of the off-season at all"*, and instructs removal of the block-2 deload.

**Measured: block 2's deload week starts 2026-08-24, which is seven weeks after
the phase entry Monday of 2026-07-06 — off-season week EIGHT.** It is in
`late_offseason`. The reading that makes it week 4 is *block* week 4, and the
Bible rules that reading out in the same passage the doc cites:

> *"Off-season subphase ownership is based on time since the athlete entered
> Off-season, not the current block number."* (`:4605`)
>
> *"Do not automatically deload at the end of Week 4 of **this first early/mid
> block**."* (`:4609` — emphasis on *first*)
>
> *"After Week 4, start a fresh late-off-season block."* (`:4611`)
>
> *"**Later late-off-season blocks may use the approved deload policy in
> Section F.**"* (`:4613`)
>
> *"From week 5 onward, normal 3-4 week deload cycles begin."* (`:110`)

Block 2 is a later late-off-season block. Its week-8 deload is the deload
`:110` and `:4613` **require**. Removing it would delete a mandated deload and
leave the off-season with no deload cycle at all — the opposite of the law.

## 6. What this does NOT settle

**The unit-7 declared gap does not resolve by removal.** Its subject sits in
`late_offseason`, a phase that deloads by law, so the finding it recorded
stands on its own terms:

| | week 3 (build, phase wk 7) | week 4 (deload, phase wk 8) |
|---|---|---|
| day 2 | Lower Body Strength — Front Squat ×3, Trap Bar Deadlift ×3 | Lower Hinge — **no anchor lift at all** |
| day 4 | Upper Pull — Chin-Ups ×3, Chest Supported Row ×3 | Lower Squat — Back Squat ×3 |
| day 5 | Lower Squat — Front Squat ×3 | Upper Pull — Chin-Ups ×2, Chest Supported Row ×3 |

A legitimate deload week is reshaping the build week instead of shrinking it,
and dropping a main lift. That is a Section F question — the "approved deload
policy" `:4613` points at — not a placement question. **The gap stays declared,
with its framing unchanged.**

## 7. Back to Sam

1. **Confirm the reading.** Is block 2's week-8 deload correct (the survey says
   the Bible mandates it), or did you mean something narrower by "only in
   off-season late" than `:110`'s "from week 5 onward, normal 3-4 week deload
   cycles"?
2. **If confirmed, nothing is built here** and the unit-7 gap keeps its
   original framing: a deload week in a deloading phase must not change the
   day layout or drop an anchor lift.
3. The one door that CAN still produce an easy week inside off-season weeks 1–4
   is the **readiness/illness door** (`resolveDoorDeloadPolicy`), which is
   deliberately un-phase-gated so in-season has a way to back off, and which
   the Bible's own deload-rules line appears to bless: *"Deload as well when
   the user is fatigued or showing a lack of readiness."* Flagged so it is a
   decision and not an oversight — say the word if you want it gated in the
   optional block too.
