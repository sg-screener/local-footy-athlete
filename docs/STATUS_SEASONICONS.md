# Season-phase icon removal checkpoint

Branch: `codex/failure-only-state-export`

## Landed

- Removed the leading icon from every season-phase choice.
- Removed the unused icon data, imports, render branch and reserved icon-box layout.
- Kept all three cards, labels and supporting lines unchanged.

## Evidence

- `test:onboarding-presentation`: 62 passed / 0 failed.
- `test:approved-icons`: the new season-phase cell failed before the source change and passes after it. The suite retains two unrelated existing failures.

## NOT COVERED

- Simulator pixels after this visual change.
- The next physical-iPhone Release build.
