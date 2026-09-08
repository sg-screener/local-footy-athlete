# Lived full-year audit

Owner: `livedyear`

## Boundary

- Audit only. Production code, programming rules, copy, migrations and athlete
  data are read-only.
- Saved commit under audit:
  `860e1fccb89a042b5c09bbdcfdb9917e5df906c5`.
- The shared checkout was already dirty before the audit. Execution uses a
  clean local clone of the saved commit so unrelated work cannot enter the
  evidence.
- Original cold-year source: the preserved 52-week male/female bundle beginning
  2026-09-28, with its original profile and dated event ledger.

## Instrument choice

Two routes were compared before audit authoring:

1. Extend the old illustration exporter in scratch space. It reaches production
   stores but omits current accepted-action, feedback and reconstruction checks.
2. Drive the current production transactions and compiler from a clean saved
   commit, reusing the old profile and event ledger, and build reports only from
   the resulting accepted state.

Route 2 is the audit authority. The old bundle is input provenance, not the
result oracle. No second program engine may be created.

## First boundary probe

`scripts/run-compiler-year.js --only male-3-experienced-gym --weeks 52` on the
clean saved commit reached 52/52 athlete-weeks. The command exited 1 because its
global verdict still requires all eight built-in archetypes when `--only` is
used; the selected athlete itself was 52/52 green. This is a reporting harness
limitation, not a compiler refusal.

## Stop receipt

- Status: `STOPPED_AT_PRODUCTION_BOUNDARY`.
- Last completed date: `2026-09-28`.
- Reached state: one male strength session; female replay not started.
- The athlete entered 60 actual minutes, RPE 7 and Bench Press RIR 2. The
  production transaction returned `committed`, but `actualMinutes` was absent
  both immediately and after a real store-emptying restart. Required session
  load (420 AU) was therefore not reconstructable.
- The workout log's actual last Bench set was 62.5 kg x 12, while the persisted
  e1RM input used 62.5 kg x 10 plus RIR 2. The accepted estimate input used
  prescription reps instead of the completed last set.
- Per the audit's failure rule, no later week or female result was fabricated.

## Outputs

The three stopped-run PDFs, comparison Markdown, five CSVs and JSONL trace are
under `output/lived-full-year-audit-860e1fcc/`. All ten requested filenames are
present. The PDFs were rendered page-by-page (4 male, 4 female, 2 comparison),
visually inspected, and text-extracted. CSV and JSON/JSONL syntax checks passed.

## NOT COVERED

- Any week after 2026-09-28 and the entire female lived replay.
- Native UI and physical-iPhone journeys.
- The known G-1 Move-route, fixture-repair G-1, accumulated Going Away, and
  combined action/proximity/state/route/restart reproduction targets.
- Team training, games, conditioning, optional sessions, injury, illness,
  fatigue, travel, fixture changes, deloads and manual progression.
- Catalogue reachability, concentration, and order permutation.
- Sports-science judgment. The stop occurred before those questions could be
  answered from accepted lived history.
