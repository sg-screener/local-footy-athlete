# Gym-availability slider checkpoint

Branch: `codex/failure-only-state-export`

## Landed

- Replaced the six large gym-day cards with one horizontal slider.
- Added seven visible stops: 1–7.
- Applied Sam's new team-training subtitle.
- Preserved the existing nullable selection, Not sure path, Continue transaction and `trainingDaysPerWeek` save.
- Extracted the proven feedback slider mechanics into one shared discrete-slider owner.

## Evidence

- `test:onboarding-presentation`: tests-first 61 passed / 4 failed, then 65 passed / 0 failed.
- `test:effort-scale`: 42 passed / 0 failed after sharing the slider owner.
- `test:compile`: unchanged known repo baseline; neither new component nor either changed component appears in its error list.

## NOT COVERED

- Simulator pixels and physical drag/tap feel.
- The next physical-iPhone Release build.
