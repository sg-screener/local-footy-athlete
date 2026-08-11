# SESSION EQUIPMENT SCOPE — BOUNDARY — 2026-08-11

**LOOP CHECK: `temporary-equipment-represented-at-two-scopes` — first named sighting.**

The Program screen and the opened session both offered “missing equipment”, but
they answered different questions through different mutation paths. Program
created a current-week modifier from the athlete’s whole saved kit. The session
picked one exercise and offered one swap. Sam’s ruling gives the split one owner:
temporary availability belongs to the session that names the equipment; permanent
availability belongs to Profile.

## Options compared before implementation

1. Move the existing whole-kit, current-week limitation sheet behind the session
   icon. This changes the location but preserves the wrong scope: a rower missing
   for today still rewrites the week and shows equipment the session never uses.
2. Derive a checklist from the opened workout, attach every requirement to the
   exercises that use it, and commit replacements as today-only exercise swaps
   through the existing accepted action door. Keep Profile as the permanent
   equipment editor.

Option 2 was chosen because it deletes the rival temporary-equipment model rather
than hiding it one screen deeper.

## What changed

- Day/Program no longer shows an Equipment shortcut in either Program variant.
- The session equipment icon opens one checklist containing only the equipment
  required by that workout. Each row also names the exercise or exercises using it.
- Unticking a machine plans a same-tier conditioning replacement from machines the
  athlete still has. A row erg can become same-tier bike work when a bike is in the
  saved kit; no bike is invented when none remains.
- Strength replacements use the existing safe exercise hierarchy with the unticked
  equipment removed from its availability input.
- Every accepted replacement is scoped to today, creates no active modifier and
  does not alter Profile.
- The sheet points permanent changes to the existing Profile equipment editor.
- The old current-week equipment writer and classic Program quick action were
  removed from the live Home surfaces.

## Verification

- The session owner derives exact row-erg and barbell requirements from a workout.
- Exact machine rows do not duplicate into a vague cardio-equipment row.
- The rower-to-bike example preserves the conditioning tier and refuses to invent
  a machine when no alternative remains.
- The opened session mounts the requirement-driven sheet; Day mounts no equipment
  shortcut; Profile remains the permanent editor.
- Temporary replacements are pinned as today-only actions with no active modifier.
- The feature-specific session, Profile, Day-timeline and entry-surface checks pass.
- Product typechecking adds no errors against the repository baseline.

The repository-wide law audit remains red on **32 pre-existing unguarded law rows**.
An unrelated plan-change suite also expects **15 templates while the live catalogue
contains 19**. Neither count changed in this slice and neither is reported as a pass.

## NOT COVERED

- Sam’s physical iPhone.
- VoiceOver traversal and the sheet’s physical fit on the smallest supported phone.
- Generated exercises carrying an equipment requirement string the equipment
  vocabulary cannot classify.
- Atomic rollback if a multi-exercise change commits one replacement and a later
  replacement is refused at write time. The UI reports that partial result honestly,
  but the existing action API has no batch transaction for these swaps.
- Permanent equipment editing itself; this slice preserves and links to the existing
  Profile owner rather than changing its save pathway.
