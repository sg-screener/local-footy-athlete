# COWORK SEAT HANDOFF — 2026-08-12

**For the next REVIEW SEAT (a Cowork chat), not the terminal.** The terminal's
entry point is `docs/CODEX_HANDOFF_2026-08-11.md` and it is agent-neutral.

## READ EXACTLY THIS, IN THIS ORDER, AND STOP

1. Your project-memory index (it loads itself).
2. **This file.**
3. `docs/ATLAS_VERIFICATION_2026-08-12.md` — the current state of every open
   question, with receipts. **If you read one thing, read this.**
4. `docs/SEAT_INBOX.md` — the live orders (5 of them, ordered).
5. `docs/NOW.md` — status pointer only.

**DO NOT READ** `docs/NOW_HISTORY_TO_2026-08-10.md`,
`docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md`, or any of the ~460 other files in
`docs/`. **GREP them; never open them.** Sam has paid for a seat reading history
twice now — $68.95 in one sitting on 2026-08-10, and this session cost $19.23
with 12M tokens in. **The reading is the cost. Almost nothing else is.**

## HOW TO SPEND SAM'S MONEY WELL — measured this session

- **Subagents were 51% of the spend and they were worth it.** Six parallel
  read-only verifiers, each given ONE claim and required to return a `file:line`
  receipt, found **two live defects neither Sam nor the terminal had** (the
  Wednesday game-day loss, the off-feet walking contradiction). **Use fan-out for
  VERIFICATION. Never use it for a lookup you could grep in one call.**
- **`device_bash` with grep/sed beats reading a file**, every time. One command
  can answer what a 3,000-line read would.
- **Screenshots beat prose for UI** and cost less to be right about. The parity
  method is written down in `docs/UI_STATE_2026-08-12.md`.

## WHERE THINGS STAND — measured 2026-08-12 06:05 MELB

- **Branch `main`, HEAD `21ec6609`.** Terminal is **Claude Opus** as of
  2026-08-12 (it was Codex on 08-11; Sam is back on Claude).
- **Law registry: 95 rows, 63 guarded, 32 UNENFORCED**, red by Sam's
  stop-the-line ruling. `test:repo-law-guards` 34/34 green.
- **The UI merge is built and gates-green, awaiting SAM'S EYE ON A DEVICE.** The
  week list took the prototype's card shape; the question that doc asked is
  CLOSED and must not be re-asked. Pictures: `docs/UI_STATE_2026-08-12.md`.
- **Five orders live in the inbox**, order 1 being the craft-validator switch.

## THE ONE THING TO UNDERSTAND ABOUT THIS PROJECT RIGHT NOW

Sam asked why the programming has been poor. **His Bible is not being lost and
old code is not overriding it.** `src/rules/weekStructureValidator.ts` holds his
Section 17 craft rules and is **FINDINGS-ONLY by its own header** — its three
live callers only log. **His craft rules were built and then left switched off.**
"Enforcement is a later phase" became a permanent state. Order 1 flips it.

**This is also the repo's recurring disease, third sighting:** the abolished
beginner cap that eleven fallback branches never heard about; the
`maxExercisesPerStrengthSession` that nothing reads; this. **A rule that ships
wired to `log` is not shipped.**

## THE FOUR STANDING LAWS ON THE SEAT

1. **INBOX-FIRST.** Any answer that creates work is written to
   `docs/SEAT_INBOX.md` BEFORE it is said in chat. Telling Sam something he then
   has to relay makes him the courier.
2. **THREE PARTS TO SAM, ALWAYS** — what happened / what's next / what to send.
   Twelve-year-old simple, no file names, no commit ids, no jargon. All
   ceremony goes in the repo.
3. **NEVER ASK FOR SOMETHING HE HAS ALREADY GIVEN.** Check the docs first. This
   has bitten four times.
4. **NO FILE CARDS FOR REPO PLUMBING.** Write to the repo with `device_bash`
   heredocs. `SendUserFile` is only for things Sam himself opens — a mock, a
   screenshot, a sheet he asked for.

## THE ENVIRONMENT GOTCHAS — the git one has now cost three seats, SOLVED BELOW

The connected folder `.../local-footy-athlete/LFA` is **empty** — request the
PARENT `/Users/samgeurts/Documents/local-footy-athlete`.

**THE GIT LOCK TOLL, AND ITS FIX.** `device_bash` cannot delete, so **every git
command that writes the index leaves a `.git/index.lock` or `.git/HEAD.lock`
behind that the seat cannot remove — and the leftover lock BLOCKS THE TERMINAL'S
NEXT COMMIT.** Worse, `git status` itself refreshes the index, so the naive
cleanup loop *re-creates the lock it just moved*.

**THE FIX — use it for every read:**

```
git --no-optional-locks status --porcelain     # cannot create a lock
git --no-optional-locks log --oneline -1
```

**And after any seat COMMIT (which must write the index), clean up in the SAME
`device_bash` call, using `mv`, never `rm`:**

```
for L in .git/index.lock .git/HEAD.lock; do
  [ -e "$L" ] && mv "$L" "$L.stale-seat"
done
ls -1 .git/*.lock 2>/dev/null || echo "NONE — clean"   # verify with ls, NOT git
```

Leftover `.git/objects/*/tmp_obj_*` files are harmless — git prunes them.

**Better still: prefer not committing at all while the terminal is running.** The
seat's writes are read from DISK by the terminal, so an uncommitted doc is
already live. Commit only at a terminal stop, and only when the durability is
worth the toll.

## THE THIRD SIGHTING — MEASURE BEFORE YOU PARK A QUESTION ON SAM

**Added 2026-08-12 after it happened three times in one day.** Every time, the
seat wrote a DECISION OWED under `## AWAITING SAM`, Sam answered — and the
answer showed the question itself had been wrong, because a measurement nobody
took would have dissolved it:

1. **"Does a game's minutes count as training load?"** The app had *already been
   asking* the athlete both halves — duration at `SessionFeedbackPanel.tsx:383`,
   effort at `:415`, both validated on the way in and read by nothing. Sam's
   answer was *"don't we already do that?"* **He was right, and one grep would
   have said so before the question was written.**
2. **"Should a second game field land on the profile, or are two-game weeks out
   of scope?"** Neither. The engine had been multi-fixture since the waist was
   unpinched; the real defect was `useHomeScreen.ts:1315` — the add-a-game
   control **only exists in pre-season**, and the in-season copy for it was
   already written for a mode nothing could enter. **Sam found this from the
   couch, phrased as a question, because the seat had framed it as data
   modelling instead of looking at the button.**
3. **"Which measure should experienced load show?"** Sam's own earlier ruling
   plus the 1-10 effort scale had already collapsed the fork. The item was
   re-measured and the "asymmetry reserved for Sam" **no longer existed.**

**THE RULE, and it is cheap: before writing a DECISION OWED, run the one command
that would prove the question is already answered.** Does the field exist? Does
the control exist? Does a ruling of his already cover it? **A question parked on
Sam costs him a turn and costs the queue a night; a grep costs one call.**

**IT IS NOT A BAN ON ASKING.** The moderate-day generation target is a real
coaching decision no measurement can settle, and it is still correctly parked.
**The test is whether the answer lives in the codebase or in Sam's head.** Only
the second kind is his.
