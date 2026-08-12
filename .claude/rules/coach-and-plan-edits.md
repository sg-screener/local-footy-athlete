---
paths:
  - src/utils/coach*
  - src/rules/coach*
  - src/screens/coach/**
  - src/utils/planChange*
  - src/utils/programControlActions.ts
---

# Coach chat, program edits and plan adjustment

**MOVED OUT OF `AGENTS.md` ON 2026-08-12** so it loads only when the files it
governs are touched. `AGENTS.md` was 746 lines re-read every single turn, and
these apply only to coach and plan-edit work.

**NOTHING HERE IS NEW.** Every word below is the law as it stood in `AGENTS.md`;
this file changed WHERE it is read, never WHAT it says. `AGENTS.md` keeps a
pointer at each moved section, so if the path-scoped mechanism is ever inert the
law is still findable rather than lost.

**THIS FILE IS TRACKED.** `.gitignore` excludes `.claude/*` and re-includes
`.claude/rules/` for exactly this reason — a law only one machine can see is not
a law.

---

## Coach Intelligence Rules

- Always optimise for the most elegant general solution in this app. If the
  right abstraction is unclear, ask before editing.
- Do not fix coach failures by adding one-off regexes, phrase branches, or
  narrow examples unless they are part of a broader typed intent, context, or
  executor improvement.
- For coach chat/program-edit bugs, work through the whole pipeline:
  1. parse the user's request into a typed intent,
  2. resolve the target from explicit text, recent chat, opened workout, and
     mutation history,
  3. ask the smallest useful clarification only when a required field is truly
     missing,
  4. apply the change through the deterministic executor/store layer,
  5. verify the visible program state changed before claiming it did.
- Preserve the user's exact training terms when they matter. "Assault bike
  sprints" must not become generic bike intervals; "Pilates" must not become
  aerobic base unless the user asked for that.
- Follow-up phrases like "make it longer", "make them shorter", "instead of
  that", and "a bit harder" should use structured recent context and mutation
  history first, not guess from canned wording.
- The LLM may interpret intent and missing fields, but it must not be trusted as
  the source of truth for program mutation. Program changes still go through the
  typed command/event/executor path.
- If a request could safely mean multiple different program changes, ask a
  concise question instead of pretending.

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

**MOVED HERE FROM `CLAUDE.md` ON 2026-08-12, word for word.** It is coach and
plan-edit law, so it belongs where that law loads; `CLAUDE.md` keeps a pointer.
Reports written before that date cite it as "CLAUDE.md's stop-patching trigger"
and those citations stay true — the pointer is one hop.

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
