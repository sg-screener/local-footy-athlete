# Device-pass rulings — Sam, 2026-08-05 evening ("1a, 2 just show the time")

Answers to §4 of docs/DEVICE_PASS_L11_REASSESSMENT_2026-08-05.md. Recorded
by the review seat; committed by the terminal as authored.

**1. Recovery (finding 3) — RULED (a): the 2026-07-31 charter ruling
STANDS, unsuperseded.** The app plans rest and never places recovery
uninvited; the ATHLETE chooses recovery. Sam's device expectation was the
choosing, not the scheduling — so the defect is that no findable athlete
door exists to CHOOSE a recovery session. That door (its absence, or its
unfindability) is the unit; the ruling is not touched.

**2. Times, not ratios (finding 7) — RULED, Sam verbatim: "just show us
the time the app can handle logic behind the scenes."**

- Athlete-facing dose display ALWAYS spells explicit durations ("15 s on /
  15 s easy", "work 1 min, rest 2 min"). The workToRest column NEVER
  renders to an athlete — it is coach/internal data and stays in the
  workbook untouched (including "1:2 (Sam)").
- Colon forms that ARE times stay everywhere: template names ("MAS 15:15
  Blocks", "30:30 Hard Intermittent", "Flush Intervals 2:1 (2 min /
  1 min)" — durations sit in the name itself), clock times ("departing
  every 2:00"), and cues referencing those names.
- NO workbook re-sign is needed. The 13 flagged strings resolve: the 8
  workToRest values become non-rendering internal data by display rule;
  names/cues/clock-times stay signed as-is. The sweep re-scopes to flag
  ratios only on ATHLETE-RENDERED surfaces, so a future ratio leaking into
  a rendered line still fails the build.

**3. Diagnostics-on device pass — accepted as a standing requirement.**
The review seat's next tap list ships with the diagnostics-on build
command; findings 1, 2, 4, 6a wait for their traces.
