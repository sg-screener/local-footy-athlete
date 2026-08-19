# STATUS — seat `orchestrator`

Opened 2026-08-19 from `20cb1422`. One writer: `orchestrator`. Name checked free
against `ls docs/STATUS_*.md` before the first commit.

## Mission

Take over integration of the four `codex/finish-*` lanes. Trust no lane's own
completion claim. Independently inspect state, fix or reject candidates, and
prove the two UI contracts on glass before declaring the UI corrected.

## FINDING O-1 — THE DAY-SCREEN DEFECT IS ON `main`, NOT IN ANY CANDIDATE

**No lane reported this.** QA routed the Day/Session contract as future work for
the *product* candidate ("the next tip must prove the two action sets
separately"). It is not future work: `main` @ `20cb1422` already ships the wrong
Day screen, and all three candidates branch from it, so all three inherit it.

Measured at `src/screens/home/HomeScreenV2.tsx` on `20cb1422`:

- lines ~988-1010 — `<SessionChangeHub testID="home-change-card">` renders the
  FIVE session actions (Equipment · Injury · Add · Remove · Swap) inside the
  original "Need to make a change?" card;
- lines ~1020-1055 — a SEPARATE, card-less `View testID="home-life-fact-chips"`
  holds only Tired and Sick;
- the `Injured` `LifeFactChip` (red `#FF7F7F` medical cross,
  `home-injured-entry`) is GONE from the Day screen. Injury is now the hub's
  amber-adjacent warning-triangle glyph.

The authority `1a7e7bd0:src/screens/home/HomeScreenV2.tsx` lines 858-935 has
exactly the contracted shape: one `Card testID="home-change-card"` with
signedCopy heading + subline, containing three chips —

| chip | testID | stroke | glyph |
|---|---|---|---|
| Tired | `home-tired-entry` | `#67D7FF` cyan | battery `M3 8h15v8H3z` + terminal |
| Sick | readiness set/update id | `#FFCA68` amber | thermometer `M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0Z` |
| Injured | `home-injured-entry` | `#FF7F7F` red | cross `M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z` |

**So the corrective work is a change to `main` itself.** Product `fe6ed715` is
Coach work and does not touch either screen; holding it does not fix this.

## FINDING O-2 — THE HUB HARD-CODES ITS ACTION LIST

`SESSION_CHANGE_ACTION_IDS` in `src/components/SessionChangeHub.tsx` is frozen
at the five session actions, with per-id tints and glyphs in closed `Record`s
and a non-exhaustive-safe `switch`. Sam's contract permits a shared visual
component but forbids a hard-coded action list. The component must carry
`tired`/`sick`/`injured` identities too, and neither surface may reach for a
list it did not pass in.

## Candidate verdicts (independent)

| lane | tip | my verdict | basis |
|---|---|---|---|
| journey | `74c593aa` | MERGE-ELIGIBLE, guards only | `git diff --name-only main...` = 1 doc + 2 test files. Zero production bytes. Ruling conflict raised to Sam, not decided here. |
| programming | `12fac3f1` | HOLD | QA's 84 duplicate identities / 36 bodyweight bench cues / red travel worlds, to be independently reproduced before any ruling. |
| product | `fe6ed715` | HOLD | unreviewed by QA; does not address O-1. |
| qa | `5f94d6e7` | evidence only | consumed as input; its artifacts are not a merge candidate for product code. |

## Log

- 2026-08-19 — seat opened; O-1 and O-2 recorded before any write.
