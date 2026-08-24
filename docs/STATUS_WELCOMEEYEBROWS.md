# Welcome eyebrow-label removal checkpoint

Branch: `codex/failure-only-state-export`

## Landed

- Removed **Your Program**, **Your Week** and **Your Progress** from the Welcome cards.
- Removed their data field, render branch and reserved spacing.
- Preserved every main card heading, description, icon and action.

## Evidence

- `test:onboarding-presentation`: tests-first 69 passed / 1 failed, then 70 passed / 0 failed.

## NOT COVERED

- Simulator pixels and final card spacing on small screens.
- The next physical-iPhone Release build.
