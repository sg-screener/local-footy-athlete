# Deterministic development E2E entry

`DevE2ESeedCoordinator` is the single reset/checkpoint protocol owner. It is a
pure coordinator with injected dependencies; `defaultDevE2ESeedCoordinator`
is the only adapter that knows about Zustand stores, AsyncStorage, the local
program builder, and `seedOnboardingProgram`.

The runtime entry is loaded from `App.tsx` only inside `__DEV__`. It accepts
only these exact links:

- `localfootyathlete://e2e/reset/<allowlisted-seed-id>`
- `localfootyathlete://e2e/checkpoint/<allowlisted-seed-id>`

Reset waits for every relevant persisted store to hydrate, clears domain
state through public APIs with ProgramStore last, builds a deterministic
accepted week, installs through the onboarding installation seam, applies
owned auxiliary state, completes onboarding, validates witnesses, and waits
for persisted semantic equality before publishing ready.

Checkpoint records semantic fingerprints only after persistence converges.
Cold-start validation reads that checkpoint after hydration and never calls
the seed builder, allowing Maestro to distinguish preservation from reseeding.

Named seeds and their extra witnesses:

| Seed | Extra visible/state witness |
| --- | --- |
| `standard-in-season-week` | Saturday fixture |
| `stacked-team-training-upper-pull` | Tuesday combined team + upper-pull session |
| `lower-body-deletion` | Monday squat-pattern session |
| `one-set-strength` | Stable exercise row prescribed for one set |
| `fixture-move` | Saturday fixture ready to move |
| `injury-case` | Active right-hamstring constraint |
| `equipment-restriction-case` | Complete bodyweight profile + active equipment constraint |
| `feedback-progression-case` | Full-completion feedback at the seed anchor |

Every seed also witnesses its exact profile, program identity, and anchored
accepted microcycle. Maestro flows live under `.maestro/common` and
`.maestro/golden`.
