# STATUS — seat `finish-integration`

**One name, one file, one writer.** Opened 2026-08-20.
`ls docs/STATUS_*.md` before the first commit returned 39 files; **`FINISH_INTEGRATION`
was free** (the nearest neighbours are `FINISH_JOURNEY`, `FINISH_PROGRAMMING`,
and the two candidate files this integration brings in,
`FINISH_SETTINGS_PERSISTENCE` and `FINISH_INJURY`, `FINISH_COACH_PRODUCT`).

**Base:** `main @ 7d1bdf24`, frozen tag `sessionui-r117-frozen`.
**Branch:** `finish/integration-candidate`.
**Worktree:** session scratchpad `wt-integration`; control worktree `wt-control`
detached at the same `7d1bdf24`, both sharing the main checkout's `node_modules`.
**Stamp:** `Agent: finish-integration`. Commits by explicit pathspec only.
**THE SHARED MAIN CHECKOUT IS NOT WRITTEN TO. THIS DOES NOT MERGE TO `main`.**

## WHAT I READ BEFORE TOUCHING ANYTHING

`CLAUDE.md`, `AGENTS.md` (both halves — LAW ZERO, the count/anchoring laws, L1–L16,
the shared-checkout environment facts), `docs/CODEX_HANDOFF_2026-08-11.md`,
`docs/STATUS_FINISH_PROGRAMMING.md`, `docs/STATUS_FINISH_JOURNEY.md`, and each
candidate's own status file read out of its own commit:
`STATUS_FINISH_SETTINGS_PERSISTENCE` (815 lines, 4 sessions),
`STATUS_FINISH_INJURY` (468 lines), `STATUS_FINISH_COACH_PRODUCT` (433 lines).
`docs/RULINGS_REGISTRY.md` and `src/rules/lawRegistry.ts` were measured, not read
for recall — see the id census below.

## ⚠ FINDING 0 — TWO OF THE FIVE CANDIDATES ARE ALREADY IN THE BASE

Measured, not recalled:

```
git merge-base --is-ancestor 12fac3f1 7d1bdf24  -> YES
git merge-base --is-ancestor 74c593aa 7d1bdf24  -> YES
git rev-list --count 7d1bdf24..12fac3f1         -> 0
git rev-list --count 7d1bdf24..74c593aa         -> 0
```

- **Programming `12fac3f1`** landed at `e6d45010`
  (`merge(PROGRAMMING): 41 findings cleared…`).
- **Journey `74c593aa`** landed at `3ddc4c16`
  (`merge(JOURNEY): the complete athlete lifecycle is held…`).

So lanes 1 and 5 of the ordered integration are **VERIFY-ONLY**: no merge is
performed, their targeted guards are run against the integrated tree and compared
to the same guards at base. The three lanes that carry unmerged bytes are
**Settings `88f17e2c` (19 commits), Injury `da545333` (7 commits, includes
`b09626a3`), Product/Coach `18968818` (8 commits)** — all three branched from
`main @ 9f081efa`, which is 13 commits behind the base, with the whole SESSIONUI
R-110…R-117 era in between.

## RULING-ID CENSUS — MEASURED ACROSS THE COMBINED REGISTRY BEFORE RESOLVING

Both registry row formats counted (`## R-nnn — …` headings and `**R-nnn** · …`
rows); an earlier count that matched only the second format missed the
weekly-reduction row entirely and would have reported no `R-105` duplicate.

| tree | rows | duplicates | free ids below the max |
| --- | --- | --- | --- |
| base `main @ 7d1bdf24` | 116 | **R-105 (twice)** | **R-114, R-115** |
| Settings `88f17e2c` | +1 | — | claims **R-114** |
| Injury `da545333` | +2 | — | claims **R-114, R-115** |
| Product/Coach `18968818` | +0 | — | fills the existing R-105 weekly-reduction row |

**Combined demand: `R-114` is claimed twice and `R-105` is used twice.**
The already-landed ids `R-112`, `R-113`, `R-116`, `R-117` are untouched.

### THE RESOLUTION, AND WHY

- **`R-105` stays with the weekly-reduction ruling** — Sam ruled it on
  2026-08-20 in as many words.
- **The power-pool ruling takes `R-118`** — the *next unused id measured across
  the combined registry*, which is the mechanism Sam's own ruling names
  (*"must receive the next unused ruling id during integration, after all
  concurrent branches are present"*). All branches are now present; `R-118` is
  the first id no tree uses.
- **Injury keeps `R-114` and `R-115`.** They are a matched pair — the matrix
  authority and the withholding it enables — and `da545333` had already been
  renumbered once (from `R-112`/`R-113`) when sessionui landed those ids on
  `main`. Splitting the pair to save the same single row-move is the worse trade.
- **Settings' combined-day *COUNT IT* ruling moves `R-114` → `R-119`.** One row,
  and that lane had also already renumbered once (from `R-112`).

Every registry row, law-registry row, source comment, status reference and guard
naming a moved id is updated in the same commit as its move.

## LOG

- 2026-08-20 — worktree cut from `7d1bdf24`, control cut beside it, base swept.
  Nothing integrated yet.

Agent: finish-integration
