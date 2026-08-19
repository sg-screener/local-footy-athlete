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

---

# WHAT LANDED — candidate tip `feat/finish-coach-product`

Four commits on top of `main @ 9f081efa`. **NOT MERGED**, by instruction.

## MISSION A — the weekly-reduction conversation belongs to the Coach

**R-105 is BUILT and its registry row now says so.**

`deriveCommitment` and `deriveExtraSession` MOVED out of
`screens/home/useBlockBoundaryPrompts.ts` into `rules/weeklyCommitmentConversation.ts`,
reached by `screens/coach/useCoachWeeklyCommitment.ts`. What they DECIDE is
unchanged, gate for gate.

**The derivation moved, not the render.** The Program surface's hook, its screen
and its card file no longer contain the conversation at all, so the Day page
cannot raise it again without importing a module it no longer imports. The
block-boundary NOTICE stays there: it is a notice about a decision already taken,
not a negotiation, and R-105's subject is *"a surface that asks the athlete to
renegotiate their week"*.

| behaviour | how |
| --- | --- |
| Coach receives a visible notification | a DERIVED coach-tab dot — `hasNotification` is `conversation !== null`. No unread flag, no counter, nothing to clear. It carries an accessible name. |
| Coach explains the measured situation | Sam's signed sentence with the athlete's real completed/planned counts, from the logged sessions and the commitment the block was built on |
| accept or decline | `CommitmentCard` in the keyboard-safe FOOTER (L-C3), options + a decline that is never conditional |
| acceptance writes through the canonical transaction | `confirmWeeklyCommitment` → `commitProfileProgramTransaction`. The screen imports nothing that could rebuild a program |
| decline persists and does not nag | one `weekly_commitment_answer` ledger entry; the derivation refuses with `already_answered_for_this_block` |
| close/reopen preserves the outcome | the question is DERIVED and the answer is on the ledger — proven through a real process death (`relaunchApp`) |
| Program and Session pages do not duplicate it | asserted at the SOURCE, on the derivation as well as the render |
| no keyword/phrase matcher invents medical behaviour | R-108's deletion holds; every sentence this conversation can produce is checked against the deleted vocabulary, behind a control proving the detector can fire |

## MISSION B — the preview is the actual regenerated `n+1` program

`rules/commitmentChangePreview.ts` has **no generator import at all**. It DIFFS
two programs it is handed. The candidate is built by
`generateProgramForProfile` — `rebuildLocalWeek`'s own step 1, extracted — with
`recordSelections: false`.

### ACTUAL PREVIEW EXAMPLES, printed by the suite on a real walked athlete

```
Wednesday 12/8 becomes a new training day: Conditioning.
Saturday 15/8 keeps one training day and adds Strength to it: Strength + Conditioning.
```

Off-season athlete, two gym days (Monday/Thursday), no club, no game, cold-started
through onboarding and walked 28 days answering everything easy. The offer is
`3 sessions a week`; the preview is read off the program acceptance publishes.

- **the actual date/day** — `dateISO` from the CANDIDATE week's own start
- **new date or combined** — `arrival`, decided against the athlete's current
  week; R-106 means a combined day is reported as ONE day with its components
  listed separately, never as two training days
- **the actual session type/components** — `getSessionComponents`, the one
  component owner, rendered through signed names joined with Sam's own `" + "`
- **load/recovery already authored** — the week's `weekKind`, `deloadDoor`,
  `intensityMultiplier` and the training-day counts either side. **Nothing is
  inferred.** A "this will make your week harder" line would be a coaching claim
  with no author.

### ACCEPTANCE MATCHES THE PREVIEW — how it is proven

The preview function is run a SECOND time after acceptance, with the same week
the athlete was looking at as `current` and the **accepted** program as
`candidate`. If what was shown differs from what landed in any day, any arrival,
any component or any session name, the two lists differ and the cell reds.

## MISSION C — Coach truth

- Coach answers from the canonical accepted program's projection (`coachAnswer`
  over the visible week) and, now, from canonical COMPLETION data — the
  conversation's numbers are the logged sessions and the accepted block's own
  recorded requirement.
- **It authors no second program.** Asserted: the conversation module imports no
  generator, no transaction and no store; the preview module imports no generator
  at all; the coach hook reaches exactly two writers, both the commitment door.
- **R-108's deletion holds.** No `detectRedFlagSymptoms`, no `RED_FLAG` constant
  and no keyword escalation anywhere the coach tab reaches. Checked here as well
  as by `test:injury-guard` / `test:injury-client-guard`, behind a control.

# THE FIVE FINDINGS

**B-1 — THE EXTRA-SESSION OFFER COULD NOT REACH ONE ATHLETE.** `acceptedBlocks`
was an OPTIONAL input no production caller supplied, so the completion
denominator was `?? 0` and the qualifying gate refused everyone. A reader with no
writer. **CLOSED** — it is REQUIRED on the conversation's input type.

**B-2 — AN OFFER GATED ON LEGALITY ALONE PROMISES A SESSION THAT NEVER APPEARS.**
In-season, Saturday game, club Tuesday/Thursday: `commitmentLegalityProbe` says a
four-day commitment builds, and it builds the IDENTICAL two-gym-day week —
`[1,3]` at three days and `[1,3]` at four. **CLOSED** — the rebuild is the last
gate; `LAW-an-offer-the-rebuild-will-not-keep-is-not-put`.

**B-3 — THE OBVIOUS PREVIEW BUILDER WAS THE WRONG ONE.**
`commitProfileProgramTransaction`'s intermediate hands generation NO
`progressionHistory` and disagreed with the delivered program in **40 of 90**
prescriptions. **CLOSED** — the preview uses the week-rebuild path, which
matched exactly.

**B-4 — A PROFILE CHANGE REGENERATES TWICE. NAMED, NOT FIXED.** The delivered
program is reproduced exactly by re-running the same builder AFTER acceptance —
whose `previousProgram` is then the first build — and differs from the same
builder run BEFORE in **60 of 90** loads. `weightOverrides` are byte-identical
across the transaction, so the override sweep is not the cause. **The day set is
identical either way.** Which producer should own the program after a profile
change is a real ownership question and not this unit's to answer.

**B-5 — `R-105` IS USED TWICE IN THE RULINGS REGISTRY.** The weekly-reduction
ruling and the power-pool ruling both carry it. Flagged at both rows; not
renumbered — a seat does not silently renumber another seat's row.

# MUTATIONS — 13 run, 12 seen red for the right reason

| # | mutation | result |
| --- | --- | --- |
| M1 | the rebuild gate deleted | reds 2 |
| M2 | the preview authors block selections | reds 1 |
| M3 | the preview reads the CURRENT week | reds 5 |
| M4 | the decline records nothing | reds 4 |
| M5 | the notification permanently on | **SURVIVED**, then reds 1 |
| M6 | every changed day called a new training day | reds 1 |
| M7 | the Program page draws the card again | reds 1 |
| M8 | force the transaction result to `ok` | **MISSED** — see below |
| M8b | record the answer, report success, change no program | reds 2 |
| M9 | the confirmation speaks the tap, not the door | reds 1 |
| M10 | the preview reports every day as changed | reds 2 |
| M11 | the signed join becomes `.join(', ')` over raw kinds | **SURVIVED**, then reds 1 |
| M12 | the card's render condition becomes `false` | **SURVIVED**, then reds 2 |
| M13 | the tab badge deleted | reds 1 |

**M8 MISSED RATHER THAN THE GATE BEING BLIND**, and the two are told apart: it
forced `ok` in a world where the transaction already succeeds, so nothing
observable changed. M8b is the same property with a real coordinate.

**THE THREE SURVIVORS EACH EXPOSED A REAL HOLE IN MY OWN GUARDS**, and each is
fixed rather than excused: nothing read the notification (both cells read the
conversation); the preview sentences were PRINTED and never asserted; and the
mount cell counted an occurrence instead of asserting what makes it run.

# EXACT CONTROL COMPARISON

Base is a detached worktree at `main @ 9f081efa`. Every suite run ALONE.

| suite | base | candidate |
| --- | --- | --- |
| `block-two-extra-session` | 18 pass, **8 FAIL + THROWS** | **40 passed, 1 failed** |
| `block-two-screen-delivery` | 35 / 0 | 36 / 0 (+1 cell) |
| `coach-tab-slice1` | 79 / 79 | 80 / 80 (+1 cell) |
| `signed-copy-extraction` | 584 unauthored strings, 1 failed | 583, 1 failed |
| `athlete-journey` | 64 / 0 | 64 / 0 |
| `coach-weekly-reduction` | — | **62 passed, 0 failed** (NEW) |
| `block-two-difficult-missed` | 88 / 0 | 88 / 0 |
| `block-two-ladder` | 59 / 0 | 59 / 0 |
| `block-two-progression` | 38 / 0 | 38 / 0 |
| `block-two-boot-preservation` | 20 / 0 | 20 / 0 |
| `coach-tab-slice2` / `slice3` | 76/76, 151/151 | 76/76, 151/151 |
| `injury-guard`, `injury-client-guard`, `coach-truth-gate` | pass | pass |
| `copy-rulings-binding`, `dead-affordances`, `feature-registry` | pass | pass |
| `undo-reversal`, `session-change-hub`, `my-status-modifiers` | pass | pass |

**RED AT BASE AND STILL RED, FAILURE NAMES DIFFED AND IDENTICAL** — not counted,
diffed: `coach-entry-surface` 1, `signed-copy-extraction` 1, `visible-surfaces`
6, `ruling-registry` 2, `law-registry` 2, `repo-law-guards` 8, `approved-icons`
2, `accepted-state-transactions` 24, `week-rebuild` THROWS, `block-rollover`
THROWS.

`test:law-registry` — 136 rows / 21 UNENFORCED at base, **138 rows / 21
UNENFORCED** now. Both new rows are `guarded`; the UNENFORCED count did not rise.

`test:compile` — **the set of files over baseline is identical to base**: 45
files, every one of them a test file, ZERO product files in either direction.

# THE ONE BOUNDARY EXCEPTION, STATED

The order said not to edit `HomeScreenV2`. **Removing the duplicate conversation
from the Program page cannot be done without it**, and *"Program and Session
pages do not independently own or duplicate this conversation"* is a required
behaviour of the mission and the substance of R-105. The edit is DELETION ONLY:
three destructured names and one JSX block in `HomeScreenV2.tsx`, and the
matching consts, handlers and return fields in `useHomeScreen.ts`, each replaced
by a comment naming where the behaviour went. `DayWorkoutScreenV2`, the session
screen and layout, the injury fallback rules and the settings screens are
untouched.

# UI HANDOFFS

1. **The tab dot's visual treatment.** `tabBarBadge` with a lime dot and an
   accessible name. Nobody has designed it; the colour is the app's accent.
2. **The card's placement inside the coach footer.** `CommitmentCard` copies
   the change card's style VALUE FOR VALUE and stacks its buttons vertically,
   because the smaller-week direction can offer five and five 44pt buttons on one
   row is a row of dead tap zones. Not a design decision anyone made.
3. **At most one card is in the footer** — a pending change wins, and the
   conversation returns the moment it is answered. Worth an eye.
4. **The conversation's bubbles sit above the athlete's turns**, because the
   coach raised the subject. Worth an eye on a long conversation.

# NOT COVERED

- **No simulator, no glass.** Another lane owns the device exclusively today.
  The card is called as the function it is and its own `onPress` closures are
  invoked; that proves the wiring, not the layout. **L10: not done until Sam has
  seen it.**
- **The smaller-week direction has no per-option preview.** Up to five options is
  up to five real generations on a redraw. The extra-session offer — Mission B's
  subject — is a single count. Named as a cost decision, not an oversight.
- **B-4 (the double regeneration) is measured and left.**
- **Whether accepting should tell the athlete their typed loads may move** is not
  answered. The preview claims structure, not loads, and the load delta between a
  pre-acceptance build and the delivered program is 60 of 90 rows on the measured
  athlete.
- **Seven signed-copy entries are PROPOSED, not signed.** They are in the
  question table below.
- **The in-season athlete with a Saturday game is never offered an extra
  session** — correctly, because the scheduler will not place one. Whether that
  is the RIGHT programming answer is a coaching question, not a code one.

# QUESTIONS FOR SAM — one table, nothing else

**REGISTRY-GREP: R-099, R-100, R-105 (both rows), R-106, R-108, R-109, R-110.**

| # | question | why it is not already ruled |
| --- | --- | --- |
| 1 | Seven new coach sentences are PROPOSED and need your words or your yes. The notification line; the two preview lines; the "could not build it" line; "Done. Your program is rebuilt around N sessions a week."; "No problem — I have left your week as it is, and I will not ask again this block."; "I could not rebuild your program just now, so nothing has changed." | R-105 rules THAT there is a notification and says in as many words that what it is must not be invented. The rest are new sentences this conversation needs. |
| 2 | An in-season athlete with a Saturday game and two club nights is never offered a fourth session, because the scheduler will not place one. Is that the right coaching answer, or should the app find them a day? | R-099 rules the SHRINKING direction's "nothing legal to offer → no question". Nobody has ruled the growing direction's equivalent. |
| 3 | Accepting a commitment change moves 60 of 90 loads for the coming block. Should the athlete be told before they accept? | Not ruled anywhere. The preview deliberately claims structure and not loads. |
| 4 | `R-105` is used by two different rulings. Which one keeps the number? | A seat does not renumber another seat's row. |
