# Accent yellow — 2026-09-03

Owner: accentyellow.

## What Sam ruled

Change the app accent from lime `#C8FF00` to yellow `#D8D800`, use `#B0B000`
for the pressed state, and leave the logo unchanged.

## Options compared

1. Keep the existing `colors.accent.lime` compatibility name and change its
   value, every active hard-coded accent literal, every translucent tint and
   both shared primary-button pressed bindings.
2. Rename the public theme key across the app as well as changing the colour.

Option 1 landed. It changes the actual pixels and guards the whole active
surface without mixing a colour ruling with a large, conflict-prone API rename.
The old key name is now explicitly a compatibility name.

## Red first

`npm run test:accent-colour` began at 2/7 green, 5 red:

- primary and pressed theme tokens were still the old values;
- 42 active app/source-pictogram files retained the old main or translucent
  lime;
- both shared button primitives faded their primary colour instead of using
  the declared pressed colour;
- the six traced pictograms still used the old lime.

The two green cells were the unchanged-logo check and the mutation arm.

## Change

- Primary accent: `#D8D800`.
- Pressed primary accent: `#B0B000`.
- Translucent accent RGB: `216, 216, 0`, retaining each existing alpha.
- The old light and dark lime-tinted surfaces moved to yellow-tinted values.
- Both shared primary buttons now render the exact pressed token instead of
  applying opacity to the primary fill.
- Six traced app pictograms moved with the app accent.
- The wordmark component and every brand/logo image were untouched.

## Verification

- `test:accent-colour`: 7/7 green.
- Mutation: an in-memory return to `#C8FF00` makes the guard exit red for the
  correct two cells.
- `test:lfa-wordmark`: 15/15 green; the default white, supplied viewBox and
  three vector paths are unchanged.
- `npx tsc --noEmit`: green.
- `test:session-components`: 39/39 green.
- `test:day-first-timeline`: its 57/57 colour-affected cells are green; its
  chained Week-board suite retains the candidate's unrelated 1 red.
- Existing candidate debt remained visible: ruling registry 3 red, law registry
  1 red, repo-law guard 12 red, and accessibility contracts 6 red. None names
  this colour work. `test:coach-note-display` could not start because the
  candidate already lacks `TodayWorkoutCard.tsx` at the path that suite reads.
- Simulator: pending; Claude owns the currently running candidate/simulator,
  so this branch does not replace its app or Metro session.

## Not covered

- The combined final candidate after Claude's two Maestro updates are applied.
- Simulator pixel inspection and physical-iPhone Release acceptance.
- A theme-token API rename; deliberately out of scope for this colour-only
  ruling.
