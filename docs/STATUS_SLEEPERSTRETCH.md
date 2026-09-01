# STATUS — Sleeper Stretch (`sleeperstretch`, 2026-09-02)

## Goal

Add Sam's Sleeper Stretch through the existing exercise catalogue with no new
equipment and no automatic Primer use.

## Options compared

1. Add one-off Movement Prep, Mobility, Recovery and Add/Swap branches.
2. Add one canonical Mobility exercise and let the current Movement Prep,
   Mobility, Recovery and manual selectors consume it.

Option 2 is the smaller source-of-truth design. The current app has no separate
route to invent: the supplied upper-body warm-up role maps directly to the
existing Movement Prep route.

## Current state

Implemented through the existing catalogue. The master workbook and app agree
on the name, shoulder muscle tag, cues, everyone gate and notes. Empty equipment
requirements use the established bodyweight path. Movement Prep, Mobility,
Recovery and manual Add/Swap share the one catalogue identity, while Primer
explicitly refuses it.

## Verification receipt

- Red first: 13 distinct submitted exercise identities produced 690 passing
  checks and 42 failures while Sleeper Stretch was deliberately absent. The
  failures named its missing catalogue, dose, equipment, cue, video, injury,
  selection and durable-action facts.
- Final focused run: 735 passing checks, 0 failures across 13 distinct submitted
  exercise identities.
- Gate liveness: changing the 30-second duration to 45, inventing a band
  requirement and allowing Primer each killed its named cell. Restoring the
  requested values returned the suite to green.
- The master workbook contains `Exercise Master!A217:H217`; its style matches
  the preceding catalogue row, and the formula-error scan found 0 matches.
- Equipment vocabulary 95/95, Primer 25/25, Mobility door 33/33,
  muscle/experience equality 97/97, quick Add/Swap 64/64 and exercise Bible
  library 164/164 are green. Product and devtools type-check with 0 errors.

## Finding and repair caused by the new entry

Adding another upper-region movement exposed an order-sensitive Recovery bug:
the third mobility seat could duplicate hips or upper instead of being the
authored "one extra" region. The Recovery guard began at 37/39 with the reached
regions printed as hips, hips, upper. The shared region picker now excludes both
already named regions from the extra seat and shrinks if no other region is
legal. The guard is 39/39 after the repair. This changes no session count or
exercise-specific route; it restores the existing Recovery shape.

## What catches the next defect of this class

The exercise-intake guard compares the submitted source with the real catalogue,
automatic builders and manual actions. The chained Recovery guard separately
requires one hips movement, one upper movement and one movement from outside
those regions, so adding future Mobility entries cannot silently distort the
session through catalogue ordering.

## NOT COVERED

- Physical-iPhone acceptance and external video playback.
- Independent clinical validation of the supplied injury ratings.
- The whole repository is not green. Existing unrelated failures remain in load
  handling for Tib Raises and Copenhagen Plank (Half), three shared
  Movement-Prep screen assertions, seven test-harness type errors and the law
  registry's 21 previously recorded unguarded laws.
