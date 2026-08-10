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

The short version: for coach chat bugs, do not add phrase-by-phrase special
cases as the main fix. Improve the typed intent, context, target-resolution,
mutation history, executor, or verification layer that explains the whole class
of behaviour. If the correct abstraction is unclear, ask first.

## Coach Architecture Escalation Rule

For coach chat, AI coach, program-edit, and plan-adjustment work, do not keep
patching the same pipeline after repeated failures.

If either of these happens:

- the same class of coach bug appears twice after a supposedly general fix
- the AI/semantic layer understands the user correctly, but a later layer
  changes, blocks, downgrades, or reinterprets that intent

then stop implementation immediately.

Before writing more code, produce an architecture reassessment that answers:

1. What is the current source of truth?
2. How many representations of the user request exist?
3. Where can intent, domain, date, target, or scope be reinterpreted?
4. Which layer should own the decision?
5. What simpler architecture would remove representations instead of adding
   more guards?
6. Which legacy paths should be bypassed or retired rather than patched?
7. What tests prove the new ownership boundary?

Do not add another resolver, guard, fallback, regex, compatibility branch,
phrase handler, or finaliser patch until the reassessment is approved.

Prefer architectures that reduce the number of representations and ownership
boundaries.

## Stop-Patching Trigger

For coach chat, AI coach, program-edit, and plan-adjustment failures, treat
these phrases and implementation moves as red flags:

- "just add a guard"
- "fallback to legacy"
- "one more resolver"
- "compatibility path"
- "targetItemId guard"
- "special-case this route"
- "patch the finaliser"

When these appear after repeated coach failures, reassess whether the pipeline
itself is wrong before coding further.

## Elegant Solution Requirement

**STANDING — NOT "WHEN ASKED". Sam, 2026-08-10, verbatim:** *"I want to do this
in the most elegant way. EVERYTHING SHOULD BE DONE IN THE MOST ELEGANT WAY."*

**"When asked" is deleted, and the deletion has a founding case: the seat applied
this law to CODE all week and never once to the PROCESS**, which is how a broken
simulator rig sat unnoticed since 18 July and a 176-suite chain kept being paid
in full for one-line changes. **The law's subject is the work, not the code** —
process, instruments and chains answer to it the same way an abstraction does.

Compare at least two options before coding:

1. Incremental fix inside the current system.
2. Simpler source-of-truth / ownership redesign.

If the redesign removes whole classes of bugs, recommend it even if it is a
bigger pivot.

For AI coach one-off edits, prefer:

visible program snapshot

- user message
  -> proposed revised visible plan
  -> diff
  -> validation
  -> override
  -> visible verification

over command/resolver/event chains unless there is a clear reason not to.
