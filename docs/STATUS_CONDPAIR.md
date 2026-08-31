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

## 2026-09-01 — canonical pulldown and six-row Upper Push/Pull

Scope: retire `Single-Arm Pulldown` as a current identity without losing old
program/history data; reduce normal male Upper Push and Upper Pull from seven
to six rows; prevent explicit near-duplicate families across composition, Add
and Swap; keep important planes when upper splits are made easier. Physical
phones and PDF regeneration were explicitly prohibited.

Two designs compared:

1. Filter the duplicate name and extra rows at display time, plus add local
   special cases for the photographed sessions.
2. Canonicalise the legacy identity at read ingress/current writing, change the
   shared male slot tables, and give composition/Add/Swap one explicit typed
   variation-family owner.

The second landed. It removes the invalid states before persistence or display,
keeps the separate female tables intact, and prevents future catalogue order or
copy changes from recreating the same class.

### Completed implementation

- `Single-Arm Lat Pulldown` is the only current pool, cue, tag, equipment,
  metadata and workbook identity. The retired spelling remains in the two
  legacy lookup boundaries only. Current writing canonicalises it, and block
  history merges old loads into the canonical progression key.
- The authored workbook has one canonical row with the merged cues and a dated
  changelog. Independent structural validation found zero unexpected cell
  differences after the one-row merge; the workbook rendered cleanly.
- Male Upper Push and Upper Pull now compose the ruled six slots. The female
  split tables remain seven rows and were not parameterised through the male
  change.
- `exerciseVariationFamily.ts` explicitly owns near-duplicate identities. The
  composer filters candidates by already-used family; Add and Swap apply the
  same rule while allowing the row being replaced to leave first.
- G-1 and scheduled deload transformations retain the important horizontal and
  vertical upper planes and trim low-value isolation rows before a one-set
  scatter can form.
- R-299 and `LAW-upper-split-composition-and-pulldown-identity` record the rule
  and its release boundary.

### Verification receipts

- `npm run test:upper-split-composition`: 18/18. Covers legacy ingress/current
  writing/history, exact male and female tables, normal and injury-adjusted
  composition, typed families, athlete Add/Swap, G-1 easier and scheduled
  deload.
- `npm run test:muscle-experience`: 94/94 workbook/code equality cells.
- `npm run test:authored-cues`: 56/56.
- `npm run test:deload-law`: 72/72.
- `npm run test:quick-exercise-actions`: 64/64.
- Focused `exerciseIntakeTests.ts`: 639/639 before its broader convenience
  chain entered an unrelated existing power-deload failure.
- `npm run test:programming-catalogue-order-year`: two complete 52-week
  athlete-years (male and female), identical saved/restarted outcomes,
  0 retired-name/family mismatches, and 0/728 changed athlete-days after
  reversing every automatic catalogue.
- `npm run test:programming-selection-release`: green end to end, including all
  receipts above plus selection trace, conditioning persistence, audited load,
  final composition and generated-week assembly gates.
- Gate liveness was observed red before implementation: the male tables still
  returned seven rows, no family owner existed, the legacy identity remained
  writable/selectable, and G-1 retained the six-row one-set scatter. The XLSX
  reader also failed a newly added self-closing-empty-cell fixture before its
  cell matcher was corrected.

### Existing reds observed, not caused or hidden

- `npm run test:exercise-canonicalisation`: 62 pass / 1 existing source-count
  failure in the shared CueDisclosure ownership cell. All six new legacy
  pulldown cells pass.
- `npm run test:pools`: 476 pass / 4 existing rotation/pinning expectation
  failures. The new retired-name pool cell passes.
- `npm run test:composer-b1`: the new six-row, family and female-control cells
  pass; four existing bodyweight/source-anchor/phase-clock cells remain red.
- The full `npm run test:exercise-intake` convenience chain reaches a pre-existing
  power-deload identity failure after its focused 639/639 intake suite and all
  earlier linked gates pass.

### NOT COVERED

- Either physical phone or a native Release build (explicitly prohibited).
- Final PDF regeneration (explicitly prohibited).
- Pixel-level rendering, Dynamic Type and VoiceOver after the structural
  session change.
- Athlete worlds outside the audited male/female full-kit years; the pure
  composition boundary covers additional injury and athlete-added routes.
