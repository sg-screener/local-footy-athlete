# Claude Instructions

> **NEW AGENT / NEW SEAT? START AT `docs/CODEX_HANDOFF_2026-08-11.md`.** It is
> the shortest true path into this repo: who is who, the five files worth
> reading, the laws that bite first, how to talk to Sam, and where things
> actually stand. That file names this one in its reading list. (Written for Codex on
> 2026-08-11; it is agent-neutral and applies to whoever holds the terminal.)

## HOW TO WRITE TO SAM — THIS GOVERNS EVERY REPORT

Instructions now come from Sam directly, in his words, with no seat in between.
**So every report is read by SAM.** They have been written for a reader who knows
the codebase. They are not any more.

**His rule, verbatim (2026-08-09):** *"i dont care about all this useless
bullshit - keep your responses simple so a 12 year old could understand - i dont
speak in code or anything. just tell me what happened, what we need to do next,
if i need to answer something then tell me what to send."* And the same evening:
*"stop sending me these fucking seat inboxes."*

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

**THE COMMANDS.**

| what | command |
| --- | --- |
| start the app | `npm run lfa:dev` |
| typecheck | `npm run test:compile` — the ratchet, and the gate. `npm run typecheck` is the raw compiler over a documented backlog; it is not the gate |
| one suite | `npm run test:<name>` |
| the whole chain, without stopping at the first red | `scripts/sweep.sh <label>` — `npm run test:bible` stops at the first failing suite and hides the rest |
| scenarios | `npm run test:scenarios`, and `npm run test:qa` for the full report |

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
