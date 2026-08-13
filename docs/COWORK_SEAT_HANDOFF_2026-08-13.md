# COWORK SEAT HANDOFF — 2026-08-13

**For the next REVIEW SEAT (a Cowork/Opus chat), not the terminal.** The
terminal's entry point is `docs/CODEX_HANDOFF_2026-08-11.md`.

## WHAT THIS SEAT IS

Sam builds LFA (Local Footy Athlete), an Australian rules football S&C app. He
has **two coding agents** working the same checkout, and **you are neither**. You
read, verify, write orders into `docs/SEAT_INBOX.md`, and translate between him
and them.

- **TERMINAL** — Claude Code CLI. Rules, store, tests, the engine. Reads the
  inbox at every stop; a Stop hook blocks it from ending a turn while orders exist.
- **DESKTOP** — Claude Code Desktop with an iOS Simulator pane. Screens,
  components, Maestro flows. It can see the app on glass; the terminal cannot.
- **YOU** — no code. Orders and verification only.

## HOW SAM WANTS TO BE TALKED TO

**SHORT. No jargon. No file paths in prose unless he asked.** He is not a
scientist and says so. If he has to read a paragraph twice, you failed.

He gets angry — reasonably — when you tell him something that turns out to be
wrong, because he then acts on it with his agents and wastes a night. His exact
words this week: *"can you make sure you tell me the right shit from now on ...
fuck me you just confuse me over and over again"* and *"stop worrying about
adding complexity - just tell me if i need to tell the terminal or claude code
something - keep it simple for fuck sake"*.

**When he asks what to send an agent, give him the message to paste. Nothing else.**

## THE THREE RULES THAT BIND YOU

**RULE 1 — Never state something to Sam as fact without running the ONE check
that would prove it wrong.** Broken four times this week. Each break cost him a
turn.

**RULE 2 — MEASURE BEFORE YOU PARK A QUESTION ON HIM.** Three times in one day a
"DECISION OWED" turned out to be the wrong question, because a grep would have
dissolved it: the game already asked for minutes AND effort; the "second game
field" was really a button that only rendered in pre-season; the experienced-load
fork had already been closed by his own earlier ruling. **The test is whether the
answer lives in the codebase or in his head. Only the second kind is his.**

**RULE 3 — ONE GREP IS NOT THE WHOLE PICTURE.** Both orders written on 2026-08-13
named a real defect and explained it wrongly, the same way: a single grep found
one thing and it was stated as the complete truth. Item 19 said *"in season there
is NO add-a-game control"* — there was one, capped. Item 16 listed four
assertions to invert — only three could be, and two more suites were missed.
**The agents measure your premises before building against them. Do not rely on
that.**

## THE SEAT'S OWN GIT DEFECT — IT STALLED AN AGENT TODAY

This session reaches the repo over a mount that **cannot delete files**. Two
consequences, and both hit the agents rather than you:

1. **Every commit leaves a `.git/HEAD.lock` you cannot remove.** The next agent
   to save sits at *"Waiting for the lock to clear"*. This stopped Desktop dead.
   **After every commit: `mv .git/HEAD.lock .git/_cleared.$RANDOM`** (`rm` fails
   too). **And check for a stray lock BEFORE reporting an agent as stuck.**
2. **`git add <path>` then a bare `git commit` sweeps in whatever the other agent
   had staged.** It happened twice — Desktop's modifier notice and add-a-game
   landed under a commit message about item 21. Nothing was lost, but the history
   lies about who built what. **Always `git commit -- <pathspec>`.**

**Better still: while an agent is mid-edit, write the inbox and DO NOT COMMIT.**
The hook scans the inbox as a FILE, not as a commit. It reaches them either way.

## WHERE THINGS STAND (HEAD `1dc52caf`, 2026-08-13)

**Queue is items 0-22 in `docs/SEAT_INBOX.md`.** Roughly 14 done, 2 live, 5
parked. Ownership is written per item — Desktop holds 16, 19, 22; the terminal
holds everything else.

**Live now:** item 22 (Desktop — the popup's short phrases, then the away flow).
Item 20 just landed.

**Parked behind stand-down D (the generator):** item 3's last step, item 7, item
21's build half, plus the real fix for item 2 and the remainder of item 9.

**STAND-DOWN D IS PROBABLY STALE AND ITS WORDING IS THE BUG.** It says *"another
agent holds the generator"* and **never names who**, so an agent reading it cannot
tell if it is the holder or the held — Desktop read it and pointed at itself as
"the other agent". Sam has been told the reopen fix landed 9 hours before this
handoff and no generator file has moved since. **If he confirms it is lifted, five
items unblock. Name the agents in any replacement.**

**Standing red, pre-existing:** `test:law-registry`'s NO LAW IS UNENFORCED —
**31 rows unenforced**, which is the stop-the-line working as designed.

**THE TERMINAL MISCOUNTS THE LAW REGISTRY, CONSISTENTLY ONE LOW.** It reported
"32 -> 31" when the file went 33 -> 32, and "31 -> 30" when it went 32 -> 31.
Twice, same direction. **The truth is `grep -c "state: 'UNENFORCED'"` — 31 today.**

## WHAT SAM OWES — three decisions, all genuinely his

1. **Three modifier kinds have no short phrase** (item 22a). His eight signed
   phrases cover most kinds; exercise preferences, pinned/excluded exercises and
   a swapped conditioning modality are unnamed. Either three more phrases, or
   "leave those as full sentences". **Nothing is blocked meanwhile.**
2. **The moderate-day generation target** (item 4) — which session becomes the
   moderate one, and at whose expense. Real coaching, no measurement settles it.
3. **The sheet's rows: one column or two** (item 16) — decided in substance by
   (1) above; the rows currently show each modifier's own title and sentence,
   which is correct and honest, just longer than his drawing.

## RULINGS MADE TODAY — do not re-ask

> **⚠ THIS LIST IS RETIRED. THE MACHINE-HELD ONE IS `src/rules/rulingRegistry.ts`,
> GATED BY `npm run test:ruling-registry`.**
>
> **Why, in Sam's words (2026-08-13):** *"why the fuck is someone still saying
> shit like this WE HAVE FUCKING FIXED THESE ISSUES"* — said on being handed
> three questions, two of which were ruled AND built, and **both of which were
> already written down here.** Prose an agent may never open is not a record.
> **The bullets below are kept as HISTORY, not as the list**; they are seeded
> into the registry with an enforcing `file:line` each, and the gate refuses any
> question to Sam that has not grepped it. Do not add a bullet here — add a row
> there, or there will be two lists again and this is how that ends.


- A game's load counts **in full** (effort x minutes), same unit as everything else.
- Strength now asks **how long it took**; all four session kinds have real load.
- **As many games per week as needed.** The profile does NOT grow a second game
  field — the calendar holds fixtures; `gameDay` is only a default.
- **A gym session is the same size whatever else is on that day.** No team-night
  exception. And *"already at the club"* is a FALSE justification — the athlete
  may lift in the morning or on the drive to footy.
- **Team training is its own component of the day, like conditioning** — not one
  of the strength exercises. It currently counts against the exercise budget,
  and is identified BY NAME in a module whose own header bans name probes.
- **Time caps are out of the Program count and the popup**, kept on My Status.
- **Away/travel** should reshape the program, not avoid the dates. It reuses the
  existing onboarding equipment door (where do you train -> pre-ticked checklist
  -> you edit it) with a start and an end date.
- The shortfall sentence branches by cause; his wording covers fixture-caused only.

## COST DISCIPLINE

**The reading is the cost, and almost nothing else is.** There are 480 files in
`docs/`. **GREP them; never open them.** `device_bash` with grep/sed beats a
file read every time. Use parallel subagents for VERIFICATION of a specific
claim, never for a lookup one grep would answer.

**Read exactly this, then stop:** this file -> `docs/SEAT_INBOX.md` (the live
queue) -> `docs/ATLAS_VERIFICATION_2026-08-12.md` (receipts) -> `docs/NOW.md`.
Do NOT open the archives.
