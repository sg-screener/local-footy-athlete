# PLANNED LOAD IS NOT EXPERIENCED LOAD — and the app only has the first one

LOOP CHECK `enforcement-deferred-then-forgotten` — sighting 8. **Same organ as
sightings 5-7: the athlete's own rating IS collected, and the module that decides
how hard his week was never reads it.** The compression is unchanged —
`LAW-computed-must-be-consumed`.

**Sam, 2026-08-12:** *"a lot of this app is based on user feedback and readiness -
so shouldn't the default for hard sessions or moderate sessions or easy sessions
be based on the user feedback? ... we might classify something as hard when it's
actually not to the athlete so maybe hard easy moderate is not the way to think
about it or it's only a way to think about it for the programming but not for
managing the readiness of the athlete?"*

**HIS SPLIT IS RIGHT AND IT IS THE WHOLE DOCUMENT.** Hard / moderate / easy is a
PLANNING vocabulary. It is not a MEASUREMENT vocabulary. The app currently uses
it as both.

---

## §1 THE TWO NUMBERS

| | PLANNED | EXPERIENCED |
| --- | --- | --- |
| Who says it | Sam's programming | the athlete |
| When | before | after |
| Vocabulary | hard / moderate / easy | effort × time |
| What it is for | building the week | protecting the athlete |

**Keep hard/moderate/easy for building.** You cannot plan without intending a
load, and every Section 17 rule (G-1, G-2, pairings, the hard-day budget's
shape) is written in it. **Nothing in this document changes generation.**

**Stop using it for readiness.** The same "hard lower" is routine for a strong
in-season 19-year-old and brutal for a 15-year-old in his first pre-season.

## §2 WHAT IS MEASURED TODAY — verified

- **The hard-day count reads the PLAN.** `dayHard` is derived from
  `workout.section18Evidence?.conditioningStress`
  (`section18EffectiveWeekEvaluator.ts:451`, consumed `:650`) — authored at build
  time. **The athlete never touches it.**
- **The only athlete input to it is a yes/no.** Anchors get
  `stress: fullParticipation ? 'hard' : 'moderate'` (`:545`). **Did you turn up**
  — not **what did it cost you**.
- **sRPE EXISTS AND IS CORRECT.** `conditioningSRPE(log) = rpe × totalTimeMinutes`
  (`journalLoad.ts:509-520`).
- **AND IT GOES ONLY TO THE JOURNAL, WHICH IS HIDDEN.** `journalLoad` is imported
  by `journalMonth.ts`, `journalChanges.ts`, `journalStrengthTrend.ts` and
  `JournalScreen.tsx` — **all four are the journal**, and the journal is hidden
  by Sam's own ruling. **Sighting 8.**
- **ONE real reader outside it, and it is honest:** `sessionBuilder.ts:997` —
  `conditioningLog?.rpe ?? feedback.difficulty ?? feedbackFeelingToConditioningRPE(...)`.
- **Team training ALREADY stores what is needed:** *"Measured duration and 1–5
  effort for a performed Team Training component"* (`programStore.ts:1692`),
  validated at `sessionOutcomeTransaction.ts:456`.

## §3 THREE SESSION TYPES — the rule is DISTANCE FROM THE SESSION, not type

**Ask for less the further you are from the moment. Recall degrades; effort
survives, minutes do not.**

**CONDITIONING — in the moment, both halves real.** `effort × minutes`. Already
built.

**TEAM TRAINING — next day, ask ONE thing.** They will not remember whether
training ran 75 or 95 minutes; they will remember how hard it was. **Do not ask
for minutes. Use the known usual length and ask only for effort.** Sam's pop-up
on next open is the right trigger.

**STRENGTH — there is no time component because nobody is measuring it. MEASURE
IT, DO NOT ASK FOR IT.** The athlete runs the live session inside the app, so
start and finish are observable. Then strength uses the same currency as
everything else and Sam keeps ONE number.

> **THE RULE THIS GENERALISES TO: never ask the athlete for something the app
> can observe. Every question is a tax on someone who has just trained.**

**OPEN-UNKNOWN, AND IT IS THE ONE THING THIS PLAN DEPENDS ON:** grep found **no
`startedAt` / session-start stamp** in `programStore.ts`,
`sessionOutcomeTransaction.ts` or `domain.ts`, and `sessionOutcomeTransaction`
mentions `durationMinutes` only for TEAM TRAINING (`:456`). **So a strength
session probably has no start time today and the stamp may need adding.** Not
established — `domain.ts:1289-1292` does carry `completedAt` + optional
`durationMinutes` on something. **MEASURE BEFORE BUILDING.**
**Fallback where the athlete did not use the live checklist: `sets × reps ×
effort`. No clock needed.**

## §4 WHAT HAPPENS WHEN THEY DON'T FILL IT IN — the load-bearing ruling

**A missing answer is data, not a hole. Assume the session happened as planned,
at the planned effort, and MARK IT AN ESTIMATE.**

**THE ARGUMENT IS THE ERROR DIRECTION, and it is a safety argument:**
- Assume they SKIPPED it → the app believes they are fresher than they are →
  **it adds load to a tired athlete.**
- Assume they DID it → if they actually skipped, the app backs off slightly.
  **A wasted easy day costs nothing. The other way round injures someone.**
- Treating it as UNKNOWN and excluding it is the same failure as assuming they
  skipped: a week with three unconfirmed trainings reads as a light week and the
  app fills it.

**AND THE CONFIDENCE MUST TRAVEL WITH THE NUMBER.** A week of three estimates and
one real rating is not the same week as four real ratings. Store `reported` vs
`estimated` on every load figure. **This is also the input the coach needs to say
"you haven't told me how training went in three weeks — is it getting heavier?"**

## §5 THE ORDER OF WORK

1. **Make sRPE readable outside the journal.** It exists and is correct
   (`journalLoad.ts:509`) and is trapped behind a hidden surface. **Do not
   unhide the journal — lift the load model out of it.**
2. **Add `reported | estimated` to every load figure**, with the §4 default.
3. **Stamp strength session start/finish** (§3 OPEN-UNKNOWN first), with the
   `sets × reps × effort` fallback.
4. **Team-training prompt on next open** — effort only, never minutes.
5. **THEN, and only then, let readiness read experienced load.** **Generation
   keeps using planned hard/moderate/easy.** The two must not be merged into one
   number — that is how the app got here.

## NOT COVERED

- **Nothing here ran.** Static reading only; no device, no simulator.
- **Whether a strength session has a start timestamp is OPEN-UNKNOWN** (§3) and
  it is the plan's only real dependency.
- **No sports-science validation of `sets × reps × effort` against sRPE units** —
  they are not the same scale and mixing them in one total is unexamined.
- Whether `feedback.difficulty` (`sessionBuilder.ts:997`) is the same 1-5 scale
  as `ConditioningPerformanceLog.rpe` was not established.
- Sam has NOT ruled on §4. It is the seat's recommendation with its argument
  stated, not a decision.
