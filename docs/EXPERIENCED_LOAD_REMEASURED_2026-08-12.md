# STRENGTH HAS AN RPE NOW — item 6's headline finding is STALE, and Sam's own ruling is what obsoleted it

**LOOP CHECK: `a-ruling-premise-is-a-claim-too`, and this time the stale premise
was a MEASUREMENT, not a sentence.** `docs/EXPERIENCED_LOAD_MEASUREMENT_2026-08-12.md`
was correct when it was taken. It is not correct now, and nothing announced the
change because the two units were different items.

---

## 1. WHAT THE EARLIER MEASUREMENT SAID

Item 6, §1-§3, measured earlier the same day:

> A strength session stores **NO rpe, NO minutes and NO start or end time** —
> three missing things, not one.

and drew the consequence that shaped the whole item:

> **for strength, EVERY value would be an estimate, on every session, forever,
> until an RPE is captured.** The estimate mark is not an edge case there; it is
> the whole column … **That asymmetry is the thing to design against.**

## 2. IT IS NO LONGER TRUE — THE RPE IS CAPTURED

**Sam's own effort-scale ruling did it** (inbox item 0a, *"okay do 1-10 for
everything i think?"* and, on strength, *"ask me"* — built at `7a6281ce`,
`f3861b31`, `f9f84123`). That unit landed AFTER the measurement above was taken,
and item 6 was never re-read against it.

Measured 2026-08-12, at source:

| where | what |
|---|---|
| `SessionFeedbackPanel.tsx:1065` | the live session asks **"How hard was the session?"** with the hint *"1 = very easy · 10 = very hard"* |
| `SessionFeedbackPanel.tsx:1067` | an `EffortSlider`, `testID="session-feedback-rpe-grid"` |
| `SessionFeedbackPanel.tsx:892` | `difficulty: executionSummary ? sessionRpeValue : conditioningRpeValue` |
| `DayWorkoutScreenV2.tsx:555` | `executionSummary` is built for **any session with an execution plan** — which strength has |
| `programStore.ts:1772` | `difficulty?: number` — *"Session effort, 1-10 — one scale for every input since 2026-08-12"* |

**So a strength session asks the athlete how hard it was, on Sam's one scale,
and stores the answer.** The comment at `programStore.ts:1807` still says
`difficulty` *"is written from the conditioning RPE input alone"* — **that
comment is stale too**, and it is the line that would mislead the next reader.

## 3. WHAT IS ACTUALLY MISSING IS **ONE** THING, AND IT IS DURATION

Three missing things is now one:

- **RPE — PRESENT.** Reported by the athlete, 1-10, per session.
- **ACTUAL minutes — ABSENT.** Still no start time, no end time, no measured
  duration on a strength session.
- **PLANNED minutes — PRESENT.** `Workout.durationMinutes` is a REQUIRED field
  on every workout (`domain.ts:834`) and is populated at generation
  (`coachingEngine.ts:1732`, `templateDurationMinutes(template)`).

## 4. THIS DISSOLVES THE ASYMMETRY THE ITEM RESERVED FOR SAM

Item 6 asks Sam to choose between **(a)** capture an RPE, **(b)** volume load,
**(c)** planned-and-marked-estimate. Re-measured:

- **(a) IS ALREADY BUILT.** It is not a choice; it happened.
- **(c) NO LONGER MEANS WHAT IT MEANT.** §4's ruling — *"assume they did as
  planned … MARKED AS AN ESTIMATE"* — now applies to the **duration only**. A
  strength sRPE would be `reported RPE × planned minutes`: **half real athlete
  data, half estimate.**
- **THE 100%-ESTIMATE COLUMN CANNOT HAPPEN.** The consequence the earlier
  measurement said must be designed against does not exist any more. The
  estimate mark belongs on the duration component, not on the value.
- **(b) volume load** stops being a rescue from a signal-free strength session
  and becomes an ordinary second measure — still real, still a different unit,
  but no longer needed to avoid an all-estimate column.

## 5. WHAT THIS UNBLOCKS, AND WHAT IT DOES NOT

**UNBLOCKED.** The build §4 ruled is now a small, honest unit: strength sRPE =
stored `difficulty` × `Workout.durationMinutes`, carrying a flag saying the
DURATION was assumed. It reads real athlete data on the half that matters most
and estimates only the half nobody captures.

**STILL SAM'S, AND STILL NOT ASKED AGAIN HERE.** Whether the estimated-duration
sRPE is the measure he wants shown, or whether he would rather see volume load
beside it, is a product decision — it is just a much smaller one than the item
describes, because it is no longer a choice between "real data" and "an
all-estimate column".

## 6. NOT COVERED

- **No build.** This unit re-measured and stopped, deliberately: it changes what
  item 6 IS, and shipping a load column on top of a premise I had just found
  stale would repeat the mistake this document is about.
- **No device pass.** Every claim above is read at source and cited by file and
  line; none is a claim about what an athlete saw.
- **The stale comment at `programStore.ts:1807` is NOT corrected here** — that
  file is mid-flight with another agent in this shared checkout. It is named so
  whoever holds it fixes it.
- Conditioning is unchanged and still stores both halves of sRPE honestly.
