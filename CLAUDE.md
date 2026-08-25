# Claude Instructions

> **NEW AGENT / NEW SEAT? START AT `docs/CODEX_HANDOFF_2026-08-11.md`.** It is
> the shortest true path into this repo: who is who, the five files worth
> reading, the laws that bite first, how to talk to Sam, and where things
> actually stand. That file names this one in its reading list. (Written for Codex on
> 2026-08-11; it is agent-neutral and applies to whoever holds the terminal.)


## THREE RULES FOR A SHARED FOLDER — READ THESE BEFORE YOUR FIRST COMMIT

**Added 2026-08-13. Sam runs two or three agents in THIS ONE checkout at once.**
Every one of these was paid for the same day: a commit that swept away 27 files
of another agent's finished work, two agents spending eight minutes each on the
identical job, and a third agent whose work nobody could see.

**1. STAMP EVERY COMMIT.** End every commit message with `Agent: <who you are>`
— `terminal`, `desktop`, or a name for what you do. **Without it you are
invisible in the history and the guards cannot tell your work from anyone
else's.**

**PICK A NAME NOBODY ELSE IS USING.** On 2026-08-13 two seats both stamped
`Agent: audit` within fourteen minutes — innocently, one read the name out of a
status file the other had just renamed — and for a while the history could not
say who did what. **Before your first commit: `ls docs/STATUS_*.md`. If your
name is taken, pick another and create your own file.** One name, one file, one
writer.

**2. `git commit -- <pathspec>`, ALWAYS. NEVER a bare `git commit`.** A bare
commit sweeps up whatever the other agents left staged. **`git status` before
every save and read what is actually going in.** "Just my file" is not just your
file here. Held by `test:repo-law-guards`.

**3. THE INBOX IS THE SEAT'S FILE. YOUR STATUS FILE IS YOURS.**
`docs/SEAT_INBOX.md` — you READ it, and you may MARK your item (`BLOCKED-BY:`,
an owner line, a one-line status). **You may not rewrite, re-order, compress or
archive it; over 150 changed lines is refused.**
`docs/STATUS_<YOU>.md` — findings, measurements, what you tried and backed out.
Write freely; nobody else touches it. **Read the OTHER agents' status files
before you start anything**, so two of you never take the same item.


**OWNED IS NOT BLOCKED. THIS ONE WORD WAS DOING TWO JOBS.** On 2026-08-13, 15 of
19 queue items read `BLOCKED-BY: other-agent` when what they meant was *"another
agent owns this"*. **The queue looked jammed while every one of them was
progressing** — and the stop-check counts a blocked item as NO WORK, so a queue
marked that way entitles every agent to stop while Sam's list is unfinished.

- **`OWNED BY <name>`** — someone else is doing it. **You walk past it. You do
  NOT mark it blocked.**
- **`BLOCKED-BY: sam | other-agent | external`** — *you* cannot proceed, and
  `other-agent` means **a file you need is being edited right now**, not that
  someone else owns the item. **Name the file.** A block with no file named is
  an ownership note wearing the wrong word.
- **Un-mark a block the moment the file is free.** A block nobody clears is
  indistinguishable from finished work.

**AND EVERY ORDER NAMES AN OWNER.** If you write one, name who does it. There is
a ratchet on this and it only falls.

## HOW TO WRITE TO SAM — THIS GOVERNS EVERY REPORT

Instructions now come from Sam directly, in his words, with no seat in between.
**So every report is read by SAM.** They have been written for a reader who knows
the codebase. They are not any more.

**His rule, verbatim (2026-08-09):** *"i dont care about all this useless
bullshit - keep your responses simple so a 12 year old could understand - i dont
speak in code or anything. just tell me what happened, what we need to do next,
if i need to answer something then tell me what to send."* And the same evening:
*"stop sending me these fucking seat inboxes."*

**BEFORE ANY QUESTION REACHES HIM — GREP `docs/RULINGS_REGISTRY.md`.**
Ordered by Sam on 2026-08-13 after he was handed three questions, **two of which
he had already ruled and which were already built and shipped**: *"why the fuck
is someone still saying shit like this WE HAVE FUCKING FIXED THESE ISSUES"*.
**`test:ruling-registry` does not ask whether you grepped — IT GREPS**, and reds
when a question hits a row whose `R-nnn` it does not cite. State the grep anyway
(`REGISTRY-GREP: R-014, ...`), because the seat hook requires it and because a
question that survives a ruling must say what is new. **`docs/RULINGS_REGISTRY.md`
is the ONE list** — the prose "do not re-ask" sections are history and must not
grow, and **a second registry is the defect, not a convenience.**
**Re-asking a settled ruling is the single thing that has made him angriest.**

**THE SHAPE — three parts, nothing else:**

1. **WHAT HAPPENED** — a sentence or two.
2. **WHAT'S NEXT** — one sentence.
3. **WHAT TO SEND** — the exact thing for him to type or answer, or "nothing".

**ZERO jargon. No file paths. No commit ids. No test names. No LOOP CHECK lines,
no law citations, no receipts, no boundary prose.**

**THE CEREMONY DOES NOT DISAPPEAR — IT MOVES.** Every receipt, mutation run,
LOOP CHECK and citation is still written, in the repo docs and boundary reports,
where the seat and future terminals read them. **The rigour does not shrink. Only
the surface Sam reads gets simple.** A report that drops the depth from the docs
to look tidy has broken a different law.

Held by `LAW-sam-chat-simplicity`, whose guard is Sam himself: **him having to
ask "what does that mean?" is the red.** It has fired twice — *"what the fuck is
this? i don't even know what some of that shit is"* and *"what do you even
mean?"*

Read `docs/NORTH_STAR.md` FIRST — it defines what this app IS and the
convergence rule every unit answers to: **store only decisions, derive
everything else.** New stored state that is not an input (a decision, a fact,
an answer, a result) is presumed wrong. Every boundary report states whether
the unit moved toward or away from the north star.

Read and follow `AGENTS.md` before changing this repo.

**`/goal` is not a command — it is how a big task is USED.** Sam states the
outcome once; the terminal restates it as acceptance criteria and non-goals,
then works it in vertical slices, checking each slice against that same
statement rather than against the last thing said. **When a slice drifts from
the stated goal, the goal wins and the drift is reported, not absorbed.**

## WHAT COUNTS AS FINISHED

**Sam, 2026-08-12, on why this section exists:** this file governed how to TALK
to him and nothing else, so "finished" was decided fresh every session.

**SOURCE OF TRUTH, IN THIS ORDER.** The task's acceptance criteria → the law and
ruling registry (`src/rules/lawRegistry.ts`, `AGENTS.md`, `docs/SEAT_INBOX.md`)
→ the executable tests → the code. **The code is evidence of what was BUILT,
never of what was INTENDED.** A chat message is not a durable ruling: when Sam
rules, the registry is updated in the same task, or the ruling is lost.

**DONE MEANS THE ATHLETE CAN SEE IT.** The primary proof is the athlete-visible
Program flow — **not a coach mutation, a log line, a debug marker or an internal
function call.** A UI change needs simulator proof. A persistence claim needs a
relaunch. A generation change needs the full scenario report.

**EVERY NEW DOMAIN FIELD NAMES ITS WRITER, ITS READER AND ITS BEHAVIOURAL TEST,
IN THE SAME TASK.** A field with no reader is not half-built, it is dead weight
that later code will trust. `canOverride` was written nine times and read zero.

**THREE WORDS, AND ONLY THESE THREE.** **WORKING** — name the test that fails if
it breaks. **BUILT** — the code exists, nothing checks it. **WRITTEN** — a doc
says so, no code. **Banned: done, shipped, wired, handled, sorted, passing.**

**AUTO MEMORY IS FOR THE ENVIRONMENT, NEVER FOR THE LAW.** **YES:** how to get
around and get things running — the Metro command, an env var a suite needs,
which module owns program persistence, a simulator quirk. **NEVER: product
law** — what makes a valid football week, what deletion means, whether the
athlete's intent is hard or soft, which session may move, what `canOverride` is
for. **Those live in `src/rules/lawRegistry.ts` or they do not exist.** A ruling
remembered somewhere machine-local, model-authored and silently truncated is a
ruling that will vanish, and that is the trap Sam has actually been in.

**THE COMMANDS.**

| what | command |
| --- | --- |
| start the app | `npm run lfa:dev` |
| typecheck | `npm run test:compile` — the ratchet, and the gate. `npm run typecheck` is the raw compiler over a documented backlog; it is not the gate |
| one suite | `npm run test:<name>` |
| the whole chain, without stopping at the first red | `scripts/sweep.sh <label>` — `npm run test:bible` stops at the first failing suite and hides the rest |
| scenarios | `npm run test:scenarios`, and `npm run test:qa` for the full report |
| the launch-audit regression flows, on the simulator | `npm run qa:audit-flows` — one PASS/FAIL line per flow; needs `npm run lfa:dev` first. Flows + their map to audit findings: `.maestro/audit/README.md` |

## Coach chat, program edits and plan adjustment

> **MOVED to `.claude/rules/coach-and-plan-edits.md`** on 2026-08-12 — the Coach
> Intelligence Rules, the Architecture Escalation Rule and the Stop-Patching
> Trigger all live there and load when coach or plan-edit files are touched.
> **Nothing was deleted. If that mechanism is ever inert, read that file
> directly — it is tracked, not local.** The short version, because it decides
> whether to open the file at all: **do not fix a coach bug with phrase-by-phrase
> special cases; fix the layer that explains the whole class.**

## Elegant Solution Requirement

> **Lives in `AGENTS.md` "Elegant Solution Requirement"**, which this file
> already tells you to read. It was duplicated here word for word until
> 2026-08-12. **STANDING, not "when asked", and its subject is the WORK — process
> and instruments answer to it the same way an abstraction does.**
