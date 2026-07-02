# Claude Instructions

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
