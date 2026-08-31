# STATUS — condpair

Owner: `condpair`

## 2026-09-01 — conditioning template/modality identity boundary

Sam supplied a 68-occurrence full-year audit showing five repeated failures:
running-distance or MAS identities delivered on Bike, Bike warm-ups carrying
running language, and Air Bike Accelerations delivered as Run.

Scope: make each authored template's explicit modality declaration executable
at selection, composition, persistence/restart and final validation; derive
warm-up copy from the selected typed modality; preserve conditioning placement,
frequency and intended quality; add release-blocking exhaustive and full-year
guards. Neither physical phone nor the final PDFs may be touched.

Two designs to compare before implementation:

1. Repair the five observed identities and the warm-up strings at their current
   call sites.
2. Make template/modality compatibility one typed domain boundary used by
   selection, composition and final validation, with modality-owned warm-up
   copy.

The second is the expected direction because it removes the class of invalid
pair rather than hiding the 68 observed rows.

## Completed implementation

- The signed workbook now contains `Supported modalities` for all 55 rows, and
  the equality suite compares those declarations verbatim with code.
- Every distance-based template is Run-only; the named MAS and Run identities
  are Run-only; Air Bike identities are Air Bike-only; Erg identities exclude
  Run. The nine declarations implicated by the audit were corrected in both
  workbook and typed source.
- `conditioningModalityCompatibility.ts` is the single compatibility owner.
  It validates all declared combinations and rejects an incompatible authored
  pair at the final generation/mutation boundary.
- `offFeetAlternative` continues to choose by stable decision and now falls
  through to a compatible template of the same quality when the original
  identity cannot use the required machine.
- `SpeedBlock` now preserves a typed modality. The active card and taxonomy read
  that fact, so `Air Bike Accelerations` no longer becomes Run.
- The shared conditioning display projects warm-up words from the typed mode.
  Bike, RowErg, SkiErg and mixed-ergo work contain no jog/run-through copy.
- The non-machine substitution boundary preserves the original option's mode
  and sequence instead of rebuilding an untyped option. Running-only profiles
  retain Run when a stale machine hint has no usable machine.
- R-298 and
  `LAW-conditioning-template-and-selected-modality-must-be-compatible` record
  the rule and its chained guard.

## Verification receipts

- `npm run test:conditioning-templates`: 162/162 workbook/code cells plus 5/5
  complete modality-contract cells.
- `npm run test:conditioning-modality-persistence`: all 55 × permitted-mode
  intensity projections, 2,738 visible-route cells, injury compilation,
  machine and running save/restart, and final Erg Flush: green.
- `npm run test:programming-final-composition`: 6/6.
- `npx tsc --noEmit --pretty false`: green.
- `npm run test:programming-catalogue-order-year`: 0/728 changed athlete-days,
  4/4 direct Going Away dates stable, and 0 conditioning identity/modality
  mismatches across 272 displayed conditioning/speed rows. The supplied audit
  baseline was 68 occurrences.
- `npm run test:programming-selection-release`: green end to end, including the
  annual gate above, selection traces, catalogue reachability, 94/94 power
  cells, complete conditioning route/persistence coverage, deload quality,
  41/41 block progression, 4/4 audited loads, 6/6 final composition and 30/30
  generated-week assembly.
- Workbook visual QA: all eight changed template tabs rendered; Aerobic Power
  and Aerobic Capacity were inspected at full sheet width with the new column
  and existing formatting intact.

## Existing reds observed, not caused or hidden

- `npm run test:law-registry`: the new row is well formed, guarded and in-chain;
  the suite remains red on the repository's pre-existing 21 `UNENFORCED` laws.
- `npm run test:workout-canonicalisation`: 38 pass / 3 pre-existing failures:
  support-row bucketing, missing-hinge restoration and the Upper Push label.
  These are outside the conditioning identity/modality scope.

## NOT COVERED

- Either physical phone or a native Release build (explicitly prohibited).
- Final PDF regeneration (explicitly prohibited).
- Athlete-authored conditioning identities outside the signed 55-template
  catalogue; they remain readable but are not governed by workbook pairing.
- Native pixel layout, Dynamic Type and VoiceOver wording order.
