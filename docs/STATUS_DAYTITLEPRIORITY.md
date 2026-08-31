# STATUS — day-title priority (`daytitlepriority`, 2026-09-01)

## Owner request

`Strength + Speed` stays when there is no conditioning. A day containing
Strength, Speed and Conditioning is titled `Strength + Conditioning`, while
its Speed section remains visible inside the day.

## Options compared

1. Shorten the title only inside the Today card.
2. Put the priority in the shared visible-day headline owner used by Day and
   Week, leaving the typed parts unchanged.

Option 2 landed so Day and Week cannot disagree and no screen parses titles.

## Verification

- Red first: the three-part control returned
  `Strength + Speed + Conditioning`.
- The `Strength + Speed` control already passed and still passes.
- The focused day-title tape passes 57/57 after the shared-owner change.
- Its chained Week-board continuation retains one unrelated inherited adapter
  failure; this change does not touch that adapter.

## What catches the next defect of this class

The same test builds exact two- and three-part typed days and checks the shared
headline function directly. The broader generated-week loop derives its
expected primary buckets independently.

## NOT COVERED

- Physical-iPhone Release acceptance.
- A new Release build containing this change has not yet been installed.
