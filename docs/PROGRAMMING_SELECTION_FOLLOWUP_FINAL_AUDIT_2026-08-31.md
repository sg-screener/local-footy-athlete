# Programming-selection follow-up final audit

Audited compiler checkpoint: `b4f53a55332fb26bf96cd6a137bd79205d0b962f`.

This is the follow-up to
`docs/PROGRAMMING_SELECTION_FINAL_AUDIT_2026-08-31.md`. It records Sam's two
decisions and closes the four additional issues he called out. The evidence is
two preserved real-onboarding athlete journeys (one male and one female), 52
weeks and 364 athlete-days each. The final year contains 5,493 visible row
placements. All 104 weekly restart checks completed without a mismatch.

Count unit for placements is a visible raw-catalogue row in mobility
preparation, the session template or Speed, with choices expanded. It is not a
set performed, a selector call or a formatted display-name occurrence.

## Sam's decisions

### 1. Every Primer remains short and low-fatigue

The one shared Primer composition owner now stops after seven checked rows.
The final audit found 24 Primer sessions, zero optional rows and zero Primer
rows named `Acceleration`, `Trap Bar Deadlift`, `High Box Squat` or
`Bench Press`. Generator-placed, coach-template and athlete-added routes use
that same composition owner. Athletes can still add a separate Strength
session.

Guard: `test:primer-session`, including the real-date, coach-template and
canonical-write paths. Restoring one removed slot made all three cells red.

### 2. Fully replaced sessions use `Injury-Adjusted Session`

The typed naming owner now uses `Injury-Adjusted Session` only when an active
injury adjustment has removed every planned movement pattern. A partial
replacement retains the honest surviving pattern name.

On 2027-03-01, both audited athletes now have:

- workout and strength-part name: `Injury-Adjusted Session`;
- conditioning display row: `Steady Aerobic Blocks`;
- raw catalogue identity: `Steady Blocks (3×8 min or 4×6 min)`;
- modality: `Bike`;
- visible dose: `4 × 6 min`.

The modifier still says `High 6/10. Limits: limit running.` No running-named
conditioning row remains. The selector now excludes run-named templates when
off-feet delivery is explicitly required instead of retaining a running title
and silently changing only its modality.

Guards: `test:session-naming` and `test:conditioning-templates`. Disabling the
full-replacement predicate or the off-feet identity filter made the matching
cell red.

## Additional audit issues

### Seated Good Morning routes

Both identities are now observed through the real automatic mobility routes:
composed Mobility sessions and in-session mobility/prehab flow. Their policies
admit warm-up selection, retain their experience/equipment/injury/G-minus
boundaries, and treat absent game distance as no upcoming game rather than an
automatic exclusion.

The final two-year report contains 77 visible placements of
`Seated Good Morning (Barbell)` and 74 of `Seated Good Morning`. A separate
six-week route trace selected the bodyweight version four times and the Barbell
version three times. Neither identity remains in a missing-route class.

Guards: `test:exercise-intake`, `test:programming-selection-trace` and
`test:catalogue-reachability-classification`. Reverting either warm-up policy
or the absent-game-distance rule made the named cells red.

### Thirty-two broken duration labels

All 32 were projection defects. The projector multiplied generic numeric row
placeholders—sometimes legitimately transformed by deload or injury—by an
authored duration. It now derives visible structure from the same concrete
55-template prescription that authors the conditioning card.

The direct witnesses changed from `41 × 50 min` to `40 min steady` and from
`16 × 20 min` to `2 × 15 min`. The complete final audit has zero conditioning
dose labels implying more than 120 minutes. Bypassing authored-template
structure reproduced both bad labels and made both regression cells red.

Guard: the focused visible-dose cells in `test:conditioning-identity`; all 161
conditioning-template cells also pass.

### Twenty-nine `incorrectly_tagged_or_classified` entries

There were no 29 exercise identity/tag defects to paper over. The old audit
discarded raw catalogue identity in favour of formatted display copy, omitted
visible mobility rows, and treated any compiler-attempt winner as though it had
survived into accepted final rows. The exporter now preserves raw identity and
the audit correlates accepted rows on the same athlete-date.

Twenty-five of the 29 have real final placements. The remaining four are
explicitly and evidentially `selected_only_in_nonfinal_compilation`:

| Identity | Attempt wins | Accepted-final placements |
|---|---:|---:|
| `Lateral Bounds` | 8 | 0 |
| `Suitcase Carry` | 3 | 0 |
| `Two-Minute Repeats` | 4 | 0 |
| `1 km Repeats` | 2 | 0 |

The corrected audit contains zero `incorrectly_tagged_or_classified` entries.
The full JSON receipt retains the athlete, date, decision owner and accepted
final identity for each of the four attempt-only cases.

Guards: `test:programming-selection-trace` and
`test:catalogue-reachability-classification`. Removing raw identity or the
attempt-only classification made the corresponding cell red.

## Final audit result

- Reversing every automatic strength, power and conditioning catalogue changed
  0 of 728 final athlete-days.
- Projection errors: 0; restart failures: 0.
- Conditioning rows missing explicit modality: 0.
- `Lower Squat` sessions without a trainable squat main movement: 0.
- Team Training days with silent gym work: 0.
- Conditioning dose labels implying over 120 minutes: 0.
- Athlete-weeks with duplicate “one quality exposure” ownership: 0.
- Catalogue identities with zero final placements: 71 of 215, classified
  exhaustively as 25 `eligible_but_out_ranked`, 24
  `intentionally_manual_or_special_use_only`, 18
  `not_eligible_for_audited_athletes`, and 4
  `selected_only_in_nonfinal_compilation`.
- `incorrectly_tagged_or_classified`: 0.
- automatic exercises with no programming route: 0.

The 71 zero-placement identities are the exact remaining catalogue result for
these two athlete profiles. Zero placement is not itself treated as a defect or
a programming target. The full row-by-row classification is in
`output/programming-selection-followup-final/report/programming-selection-final-audit.json`.

## Evidence receipts

- Authored-year SHA-256:
  `25ae7dda79830671a989a6075da55b7ced0616a66f51fe228b558cc9219b20bc`
- Selection-trace SHA-256:
  `64c1b23810f150febb6ee4066e3ae31e1eaca991fc9dc43f4903f58d1ef4c0f6`
- Catalogue-order comparison SHA-256:
  `640d9215a09a19b5c892f83e750d88371677dc1afc32464ae966f2a4f401c311`
- Final audit JSON SHA-256:
  `3c419b8f5a8d7b8edd90d9321eafd2974d7eedc9af83186cea5db95a809cdd33`

Exact generation and audit commands are recorded in the generated Markdown
receipt beside that JSON.

## Verification at the final checkpoint

- `test:programming-selection-release`: exit 0. Its chained instruments report
  0 / 728 differing final days, selection trace 10 / 10, reachability 6 / 6,
  power pool 94 / 94, modality persistence 3 / 3, weekly deload ownership
  11 / 11, block-two progression 41 / 41, final composition 6 / 6 and
  generated-week assembly 30 / 30.
- `test:compile`: product 0 errors and devtools 0 errors. The repo's existing
  untyped test-harness scope remains red with four errors in three unrelated
  test files: `canonicalWeeklyCompilerSliceTests.ts`,
  `fatiguePlumbingTests.ts` (two) and `fixtureMutationTransactionTests.ts`.
- `test:law-registry`: 224 registry rows, 203 guarded and 21 inherited
  `UNENFORCED`. The new Primer and injury-adjusted naming rulings are guarded;
  the named inherited registry debt remains red and was not hidden.

## NOT COVERED

- Physical-iPhone execution or Sam's device acceptance.
- Native onboarding taps; the audit uses the preserved real-onboarding driver.
- Athlete profiles beyond the preserved male and female inputs.
- Clinical validation of injury programming.
- A whole-app PASS. This report covers the named programming-selection and
  final-composition surfaces only.
