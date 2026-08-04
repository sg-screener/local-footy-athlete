# Stage B implementation batch — boundary report (6 of 7 units)

Branch `feat/stage-b-stage2`, UNMERGED, `main` untouched at `936bbf7`.
Every unit was green on a **full `test:bible` EXIT 0** before its commit.

| # | Unit | Commit |
|---|---|---|
| — | Sam's rulings + signed workbook, as authored | `d64c993` |
| 1 | Switchover rulings 1, 4, 5 | `6c63db7` |
| 2 | Muscle sheet + modality-map owner | `72295d8` |
| 3 | Census bookkeeping | `58d3ed6` |
| 4 | D-1a overlay writers + LR-30 | `84ce5d1` |
| 5 | D-3a factId passthrough | `c0dc745` |
| 6 | D-2 worn-world probe (receipts only) | `67556e2` |
| 7 | Unchained conditioning suites | **NOT DONE** — handed over |

## The convergence question

> **Does this move the app toward "store decisions, derive everything"?**

**Toward, on every unit, and three of them delete a derivation that stood
where a decision already existed** — the class this batch kept finding:

- **D-3a**: the athlete's tap already produced a factId; the app threw it away
  and re-derived one *alphabetically by fact kind*. The decision is now stored
  and carried; the derivation is deleted.
- **Unit 1 (ruling 5)**: a code filter would have decided which sessions are
  standalone. An authored sheet property decides it instead.
- **Unit 2**: a machine session's muscles were going to be stored per template.
  They derive from one authored row per machine — stored once, derived
  everywhere.
- **D-1a**: one week's contract had three stored homes; the overlay's copy is
  gone. Two remain, and LR-30 owns the rest.

Nothing stored was added. Two typed fields were added to in-memory shapes
(`nameProvenance`, and the offer's `factId`), both making an existing decision
legible rather than adding a second representation.

## What each unit paid, in one line

1. **Rulings 1/4/5** — Two-Minute Repeats re-signed plain in workbook + code
   lockstep; Sam's warm-up sentence ships through the copy sheet and **retires
   the L-P2 declared red**, so `project()` carries conditioning rows for the
   first time; the warm-up rider is gated by a 7th authored sheet property.
2. **Muscle sheet** — `MODALITY_MUSCLE_MAP` (4 machines) + 53 template rows,
   equality-gated both directions plus the architecture itself;
   `conditioningSessionMuscles` is the one owner; `muscleMetadataFor` is the
   one door over both signed sheets; `SELECTABLE_WITHOUT_METADATA` retires.
3. **Census bookkeeping** — the founding doc is marked history, id recycling
   is recorded, and **a unit it declared was found never to have been typed
   into code at all**.
4. **D-1a** — both overlay v1 writers stop; LR-30 refiles that dropped
   founding unit and takes the generation-time writer as its scope; the
   unit-count ceiling rises 29→30 *because 29 was itself the error*.
5. **D-3a** — factId end to end, alphabetical sort deleted (arrival order
   now), card and trim unified onto one selector, two walker pins.
6. **D-2** — probe only. Receipts in
   `docs/D2_WORN_WORLD_PROBE_2026-08-05.md`; **no ruling taken**.

## NOT COVERED

- **Unit 7 — the unchained conditioning suites** (switchover boundary §4:
  `visibleProgramProjectionTests`, `weeklyPlanDisplayTests`,
  `conditioningVisibleIdentityTests`, `standaloneConditioningOwnershipTests`,
  the coach revision suites). Not started; several were already red on `main`.
- **No device pass.** L10 stands open for stages 1+2 together — the merge gate.
- **D-2 is unruled**, by Sam's instruction. Nothing was redirected or reordered.
- **The coach path** is untouched throughout; LR-6 holds.
- **Derive-at-render has no caller** — no surface renders muscles today, so the
  owner is built and gated but unused. Building a surface would have been
  inventing one.
- **A `mixed`-modality session derives NO muscles** (pinned in the gate). Sam
  authored four machines; a rotating session has no single row. His to rule.
- **`EXERCISE_TAGS` was not derived** from the conditioning sheet — injury
  profiles are authored, not derivable.
- **The D-2 probe cannot reach its subject by acting**, and says so.

## What catches the next defect of the class

The class this batch kept meeting: **a derivation standing where a decision
already exists.** What now catches the next one:

- `test:conditioning-muscle` (new, chained) gates the *architecture*, not just
  values: a map-derived row that also stores muscles fails, and so does a
  muscle word outside the signed vocabulary — which is what would stop `Wrist`
  arriving by hand.
- The two walker pins make the factId link behavioural: pin (ii) builds the
  two-overlapping-facts world and prints that it really trimmed, so it cannot
  pass vacuously.
- **LR-30 in the ratchet** is the durable one. A staged retirement whose gate
  lived in a type comment now has an owner that fails a build.
- The census doc/code reconciliation means neither file can be read as the
  whole ledger again — the specific way this batch's biggest finding hid.

## Process note, recorded against myself

I edited files while a `test:bible` run was in flight; that run went red on a
cell in a file I was editing. The result was contaminated, so I discarded it
rather than diagnosing it, and re-ran clean. **Never edit under a running
gate** — the same discipline the orchestrator rule already states for
background agents.

## Where the next session picks up

1. **Sam's D-2 ruling** on the reshaped question in the probe report.
2. **Unit 7** — the unchained conditioning suites.
3. **L10 device pass** for stages 1+2 together, the standing merge gate.
