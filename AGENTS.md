# Agent Working Agreement

This repo's most important product surface is the coach chat. Treat it as an
intelligent program-editing system, not a collection of phrase handlers.

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

## Elegant Solution Requirement

When the user asks for the most elegant solution, compare at least two options
before coding:

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

## Test Standard

- Prefer invariant or scenario tests that prove the capability, not only the
  exact phrase that failed.
- Multi-turn coach fixes should cover follow-up context, target resolution, and
  visible mutation where possible.
- If a narrow regression test is useful, add it after the broader behaviour is
  represented.

## Working Style

- Before changing coach intelligence code, name the abstraction being improved.
- Keep implementation scoped to the pipeline layer that owns the behaviour.
- Do not expose, repeat, or commit API keys. Supabase/OpenAI secrets belong in
  deployed secrets only.
