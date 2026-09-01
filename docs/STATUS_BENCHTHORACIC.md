# STATUS — Bench Thoracic Extension (`benchthoracic`, 2026-09-02)

## Goal

Add Sam's Bench Thoracic Extension through the existing exercise catalogue,
without new equipment or a special programming route.

## Options compared

1. Add a one-off branch in warm-up, Mobility, Recovery and Add/Swap code.
2. Add one canonical exercise to the existing sheet-backed catalogue and let the
   current selectors consume it.

Option 2 is the smaller source-of-truth design. The existing `Mobility` pool,
upper region, bench-or-box equipment group and programming policy already express
the entire request.

## Current state

Implemented through the existing catalogue. The master workbook and the app now
agree on the name, mapped muscles, cues, experience gate and notes. The existing
bench-or-plyo-box answer is shared by automatic selection and manual Add/Swap;
no equipment vocabulary or special programming branch was added.

## Verification receipt

- Red first: the focused instrument reached 12 submitted exercise identities and
  reported 637 passing checks and 42 failures while Bench Thoracic Extension was
  deliberately absent. The failures named this exercise's missing catalogue,
  dose, equipment, route, cue, video, injury and selection facts.
- Final focused run: 682 passing checks, 0 failures across 12 distinct submitted
  exercise identities.
- Gate liveness: three independent mutations changed the 5-rep dose, removed the
  bench-or-box requirement and disabled the upper warm-up route. Each mutation
  made its named cell fail, and all three returned green after restoration.
- The master workbook contains the new row at `Exercise Master!A216:H216`, its
  style matches the preceding catalogue row, and its formula-error scan found 0
  matching cells.
- The equipment vocabulary, Mobility door (33/33), muscle/experience equality
  (97/97), quick Add/Swap actions (64/64), and exercise Bible library (164/164)
  are green. Product source type-checking reports 0 errors.

## What catches the next defect of this class

The exercise-intake guard compares each submitted exercise against the authored
source, then runs the real automatic and manual selection paths. New intake rows
must enter that same submitted list, so a wrong dose, unsupported equipment,
missing cue/video, injury leak or unreachable session route fails by name rather
than relying on a catalogue total alone.

## NOT COVERED

- Physical-iPhone acceptance and external video playback.
- Independent clinical validation of the supplied injury ratings.
- The whole repository is not green. Existing unrelated failures remain in the
  authored-cue load handling for Tib Raises and Copenhagen Plank (Half), three
  shared Mobility-screen source assertions, one deload power-identity assertion,
  seven test-harness type errors, and the registry's 21 previously recorded
  unguarded laws. None names or is reached through Bench Thoracic Extension.
