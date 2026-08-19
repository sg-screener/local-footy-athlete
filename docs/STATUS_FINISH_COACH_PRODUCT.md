# STATUS — seat `finish-coach-product`

Opened 2026-08-20. One writer: `finish-coach-product`. The name was checked free
against `ls docs/STATUS_*.md` before the first commit.

Branch `feat/finish-coach-product`, isolated worktree
`/Users/samgeurts/Documents/lfa-finish-coach-product`, based on **`main @
9f081efa`** (clean tip; `git status` showed only two untracked `.fuse_hidden*`
files, which are not mine and are not touched).

**THE REJECTED `codex/finish-product` BRANCH (`fe6ed715`) IS NOT AN INPUT.** It
is not merged, not cherry-picked and not read for code. Its REVIEW
(`docs/STATUS_ORCHESTRATOR.md` §"PRODUCT `fe6ed715` — REJECTED FOR MERGE") is
read as evidence of what must not be rebuilt, and two of its four findings are
this mission's own work items.

## Mission, as three missions

- **A** — the weekly-reduction conversation moves off the Program page into
  Coach, announced by a notification, answered through the canonical
  accepted-program transaction, with the decline recorded so it cannot nag.
- **B** — the optional-session preview comes from the ACTUAL regenerated `n+1`
  program, never from a guess over the current week.
- **C** — Coach truth: canonical facts only, no second program author, no
  keyword escalation; R-108's deletion stays deleted.

## REGISTRY GREP, before any question or any build

`grep -n -iE "smaller week|reduc|missed|completed 0|escalat|emergency|optional
session|nag|decline" docs/RULINGS_REGISTRY.md`

- **R-099** (2026-08-16) — the missed-session question. *The question is
  DERIVED; only the ANSWER is stored.* `BUILT`:
  `rules/weeklyCommitmentQuestion.ts`, `rules/weeklyCommitmentLegality.ts`,
  `store/weeklyCommitmentAnswer.ts`.
- **R-105 (the first of two rows carrying that id)** — *"This should not be
  popping up on the main page - it should show up in the coaches chat with a
  notification"*. **`OWNER: unassigned — NEXT MISSION. NOT BUILT, NOT
  STARTED.`** This mission is that owner.
- **R-106** — a combined day is ONE day and TWO components. Binds the preview's
  "new date or combined with an existing day" wording.
- **R-108** — the keyword/escalation authority is DELETED, both halves.
- **⚠ REGISTRY DEFECT, FOUND NOT FIXED: `R-105` IS USED TWICE.** The
  weekly-reduction ruling and the power-pool ruling both carry it. Recorded for
  Sam's question table; renumbering another seat's row is not mine to do.

## BASE CONTROL — measured on this worktree BEFORE the first edit

Each suite run ALONE (`scripts` chained by `npm` make the last totals line lie).
`DEAD/THROWS` is its own state, not a red.

| suite | base exit | base counts |
| --- | --- | --- |
| `test:block-two-difficult-missed` | 0 | 88 passed, 0 failed |
| `test:block-two-ladder` | 0 | 59 passed, 0 failed |
| `test:block-two-screen-delivery` | 0 | 35 passed, 0 failed |
| `test:block-two-extra-session` | **1** | **8 FAIL then THROWS** (see B-1) |
| `test:coach-tab-slice1` | 0 | 79/79, 0 failed |
| `test:coach-tab-slice2` | 0 | pass |
| `test:coach-tab-slice3` | 0 | pass |
| `test:coach-entry-surface` | **1** | 38/39, 1 failed (pre-existing) |
| `test:injury-guard` | 0 | pass |
| `test:injury-client-guard` | 0 | pass |
| `test:coach-truth-gate` | 0 | pass |
| `test:signed-copy-extraction` | **1** | 7 passed, 1 failed (pre-existing) |
| `test:copy-rulings-binding` | 0 | pass |
| `test:visible-surfaces` | **1** | 6 failed (pre-existing) |
| `test:dead-affordances` | 0 | pass |
| `test:feature-registry` | 0 | pass |
| `test:ruling-registry` | **1** | 2 failed (pre-existing) |

**FIVE SUITES ARE RED ON `main` BEFORE I TOUCH ANYTHING.** They are named here
so nothing I do can be credited or blamed for them.

## FINDING B-1 — THE EXTRA-SESSION OFFER CANNOT REACH ANY ATHLETE ON `main`

**`useBlockBoundaryPrompts` reads an input NO PRODUCTION CALLER SUPPLIES.**

`deriveExtraSession` computes the completion denominator as
`acceptedBlocks?.[previous.startISO]?.requiredStrengthSessions ?? 0`
(`src/screens/home/useBlockBoundaryPrompts.ts:190`), and
`blockBoundaryProgression.ts:731` gates on `requiredStrengthSessions > 0`.

`useHomeScreen.ts:701-708` — the ONLY production caller — passes
`currentProgram`, `blockNumber`, `blockStartISO`, `sessionFeedback`,
`onboardingData`, `ledgerEntries`, `weekOrder`. **It does not pass
`acceptedBlocks`.** A census of the whole tree finds no other caller.

So `requiredStrengthSessions` is 0 for every real athlete, `history.qualifies`
is false, and `decideExtraSessionOffer` returns `block_did_not_qualify` before
any other gate is reached. **The offer is unreachable in production.**

`test:block-two-extra-session` reproduces it at base: its `promptsFor` helper
has the same omission, its `[0]` LIVENESS cells all PASS (the block qualifies,
the athlete has a free day, the four-day week generates), and then 8 cells fail
and the suite THROWS at `BlockBoundaryCards.tsx:164` rendering a null model.
**The liveness arm passing while the offer is null is what proves this is the
denominator and not the world.**

This is the `EVERY NEW DOMAIN FIELD NAMES ITS WRITER, ITS READER AND ITS
BEHAVIOURAL TEST` law failing on the writer side: a reader with no writer.

## NOT COVERED at open

- The simulator. Another lane owns it exclusively today; nothing here is
  claimed on glass.
