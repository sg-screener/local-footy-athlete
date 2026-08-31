# STATUS — SL exercise acronym (`exerciseacronym`, 2026-09-01)

## Owner request

Every exercise name authored with `SL` must display `SL`, never `Sl`.

## Options compared

1. Rename the two affected back-extension rows at their call sites.
2. Add `SL` to the existing shared exercise-display acronym owner.

Option 2 landed. It fixes every current and future athlete-facing `SL` title
without changing catalogue identities or duplicating screen-specific patches.

## Verification

- Red first: both exact back-extension display cells returned `Sl`.
- After the shared formatter change, both return `SL`.
- Removing the one acronym mapping recreates both failures.

## What catches the next defect of this class

The chained exercise-display suite tests canonical acronym names through the
same formatter used by session rows and exercise video titles.

## NOT COVERED

- Physical-iPhone Release acceptance.
- A new Release build containing this change has not yet been installed.
