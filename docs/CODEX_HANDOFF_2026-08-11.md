# HANDOFF TO CODEX — 2026-08-11

**You are taking over the terminal seat on this repo from Claude Code.** Sam is
out of Claude credits until 2026-08-12, so you are the build hand now. This file
is your entry point. **Read it fully before you touch anything, then read the
five files in §1 and nothing else until you need them.**

**Why this file exists:** the previous seat carried a lot of context in memory
that you do not have. Everything load-bearing is written down here or pointed at
from here. If something is not in this file or its five pointers, it is not
binding on you.

---

## 0. WHO IS WHO

- **Sam** — the owner. Not a programmer, and does not want to be spoken to like
  one. He is the ONLY eye on the product.
- **You (terminal)** — you build, you measure, you commit.
- **The seat (a Cowork session)** — reviews, rules, writes orders into
  `docs/SEAT_INBOX.md`. It is not running while you are; if you need a decision
  and the rules do not answer it, ask SAM in plain words.
- **The app** — an iOS strength & conditioning app for footballers. One athlete,
  one program, a coach chat that can change that program.

---

## 1. READ THESE, IN THIS ORDER — AND ONLY THESE

1. `CLAUDE.md` (5KB) — the root contract. **It applies to you; the filename is
   historical.** Line 1 binds `docs/NORTH_STAR.md`.
2. `AGENTS.md` (40KB) — every process law, LAW ZERO first. **This is the big
   one and it is worth the read; do not skim it.**
3. `docs/NOW.md` (9KB) — the single status surface. Current, budgeted, honest.
4. `docs/SEAT_INBOX.md` (1KB) — your live orders. Nothing else in it is work.
5. `docs/LFA_PROGRAMMING_BIBLE.md` — the COACHING law. **Read it before you
   answer or implement anything about how training should work.**

**DO NOT READ, unless you are chasing a specific fact into them:**
`docs/NOW_HISTORY_TO_2026-08-10.md`, `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md`,
or the ~375 other files in `docs/`. They are history. Sam paid $68.95 in one
sitting for an agent re-reading history at every step — **the two files above
were split out precisely so you do not pay that.** Grep them; do not read them.

---

## 2. THE LAWS THAT WILL BITE YOU FIRST

The full set is in `AGENTS.md`. These are the ones a new agent breaks on day one.

1. **LAW ZERO — A LAW WITHOUT A GUARD IS NOT RECORDED.** Every rule in this repo
   must be held by a test. `src/rules/lawRegistry.ts` is the register;
   `npm run test:law-registry` is its gate. **If you write a new rule anywhere —
   doc, comment, inbox — it needs a registry row AND a guard in the same commit,
   or you have made the problem worse.**
2. **MEASURE, NEVER RECALL.** No number in a report unless you just ran the thing
   that produced it. State the instrument next to the number.
3. **A CLAIM NEEDS A RECEIPT.** "It works" needs a test name, a commit id or a
   printed exit line. If you have none, write **OPEN-UNKNOWN**. That is an
   accepted, respected answer here. A confident wrong claim is the worst output
   you can produce — it has cost this project days.
4. **A GREEN TEST IS A CLAIM, NOT A PROOF.** On 2026-08-10 a feature shipped
   with 116 green cells and was completely dead: every cell asserted WHICH
   FUNCTION was called, and the bug was in an ARGUMENT. **Prefer a tape that RUNS
   the thing over a test that describes it.**
5. **NOTHING IS "DONE" UNTIL IT RAN.** Not written, not compiled — ran.
6. **BIBLE FIRST.** Before asking Sam any coaching question, grep
   `docs/LFA_PROGRAMMING_BIBLE.md` and the ruling docs. If it is already ruled,
   enforce it; do not ask him twice. **Asking again for something he already gave
   is the single thing that annoys him most.**
7. **DO NOT FIX EDGE CASES.** His standing project instruction: *"don't fix edge
   cases, build a systemic fix into the system so issues are fixed globally."*
   Two representations of one fact is the defect class this whole repo fights.
8. **EVERY REMOVAL NAMES WHERE THE BEHAVIOUR WENT**, in the same commit.
9. **VERIFY `git branch --show-current` BEFORE EVERY COMMIT** — shared worktree.

---

## 3. HOW TO TALK TO SAM

**His words, and they are binding:** *"keep your responses simple so a 12 year
old could understand — i dont speak in code. just tell me what happened, what we
need to do next, if i need to answer something then tell me what to send."*

Every message to him is three short parts and nothing else:

- **WHAT HAPPENED** — one or two sentences, no file names, no commit ids, no
  jargon.
- **WHAT'S NEXT** — one sentence.
- **WHAT TO SEND** — the exact words for him to type, or "nothing".

All ceremony — receipts, law citations, counts, loop checks — goes in the repo
docs and commit messages, where the next agent reads it. **Never in his chat.**

---

## 4. WHERE THINGS STAND — MEASURED 2026-08-11 06:45 MELBOURNE

- **Branch `main`, HEAD `d01e9255`.** Working tree has ONE uncommitted change:
  `docs/SEAT_INBOX.md` (the seat's live orders). That is expected.
- **`npm run test:law-registry` — 77 rows, 43 guarded, 34 UNENFORCED, RED.** Run
  by the seat this morning; that is the real number, not a recalled one.
- **`test:bible` IS DELIBERATELY RED and stays red until every law has a guard.**
  Sam's stop-the-line ruling. **The UNENFORCED count may only fall.** Report it
  after every batch — it is the only status number he asked for.
- **Only guards, guard-caught fixes, and measurement land while it is red.**
- **The coach tab** does slices 1-3 (talks, answers, changes the program through
  the athlete's own doors). **S4 — it knows how you're tracking — not started.**
- **The UI merge** — slices 2, 3, 5 landed; **slice 3b open** (the coach status
  screen's buttons are a NO-OP, so the day screen still keeps every control, so
  rulings 4 and 6 are NOT closed).
- **ONE RED IS NOT YOURS.** `npm run test:repo-law-guards` fails on
  *"a repeated sighting states its disposition"*, naming
  `docs/REBUILD_NOTICE_OWNERSHIP_BOUNDARY_2026-08-10.md`. It was already failing
  when you arrived (measured 2026-08-11). The fix is one line in that doc stating
  **iterate or compress** for its sighting. Cheap, and yours to take if you want
  a warm-up that ends green.
- Everything else open is listed under `## OPEN, ON US` in `docs/NOW.md`. **That
  list is current and honest — trust it over this paragraph if they disagree.**

---

## 5. YOUR ORDERS

They live in `docs/SEAT_INBOX.md` and there are three. **Work them top down.
Report only when one is done or you are blocked.**

---

## 6. COMMANDS THAT ACTUALLY WORK

```
npm run test:law-registry          # the law gate — the number Sam wants
npm run test:bible                 # the chain; STOPS at the first failing suite
npm run test:bible:parallel        # NON-OFFICIAL pre-check, faster, do not quote it
scripts/sweep.sh <label>           # to reach suites past position 92
npm run e2e:maestro:ios            # needs E2E_METRO_URL + Metro running
```

**iOS debug build gotcha:** a Sealable linker failure is cleared by
`rm -rf Pods build && pod install` in `ios/`. Debug needs wifi + Metro. `__DEV__`
panels do not exist in Release.

---

## 7. WHAT NOT TO DO

- **Do not assume the last agent's claims are true.** Several were not. Re-run
  anything you are about to build on.
- **Do not tell Sam something he then has to relay to another agent.** If your
  answer creates work, write it into `docs/SEAT_INBOX.md` FIRST, then speak.
- **Do not ship a feature and report it working without running it end to end.**
- **Do not start a big refactor.** Vertical slices, each one commits green.
- **Do not use his phone as the first instrument.** It is the LAST one.
- **Do not delete or "tidy" docs.** Move things and say where they went.

---

## 8. WHEN YOU STOP

Write a stop report as the commit message: what landed, the measured numbers with
their instruments, **and a NOT COVERED section naming what you did not check.**
Then update `docs/NOW.md` — re-stamp the HEAD line, keep it a pointer, never let
it grow into history. **Then tell Sam the three things from §3 and stop.**
