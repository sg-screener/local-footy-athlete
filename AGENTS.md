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

## De-duplication can silently un-gate the values it tidies

When duplicated values are collapsed behind a single reference — a shared
constant, a spread, an inherited base — **re-verify that the equality gate still
sees them**, before assuming the collapse was free.

Gates in this repo frequently parse source for inline literals (`required: 3`,
`preferredMax: 4`). Moving those literals into one object and spreading it
(`...PRE_SEASON_TARGETS`) removes them from the shape the parser matches, so the
gate stops comparing those cells and goes on passing. Nothing fails. The values
are now less protected than before the tidy-up, and the commit that did it reads
like an improvement.

This happened on 2026-07-28 collapsing three identical pre-season contracts into
one: the de-duplication was correct and ruled, and it would have un-gated the
very cells the same ruling had just authored. The fix is a second assertion that
compares the shared object directly.

The general shape: **a gate that reads code rather than behaviour is coupled to
the code's SHAPE, and refactoring changes shape by definition.** After any
de-duplication, ask what the gate matches on and whether it still matches.

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

## Environment Facts

### This working tree is SHARED with concurrent sessions

More than one agent session can be working in this checkout at the same time.
Another session can check out a different branch, commit, and merge **while your
session is mid-unit**. Git branch state is therefore shared mutable state that
nothing tells you has changed.

**Run `git branch --show-current` immediately before every commit, not once at
the start and not at session end.** Which branch you are on is a fact to verify,
not a fact to remember.

This is recorded because it has already gone wrong. On 2026-07-28 a session
created `feat/provenance-lock-phase1`, committed five times, and then a
concurrent session branched off that tip, merged to `main`, and left HEAD on
`main`. The next ten commits of a fifteen-commit unit went straight to `main`
while the session went on reporting "branch …, unmerged" at the end of every
turn. Nothing was lost and no gate broke — the damage was purely that the
author's account of where the work lived was wrong for most of a long session,
including in what it told the repo owner.

Practical consequences:

- Verify the branch before each commit. A stale assumption is silent; the check
  costs nothing.
- `git stash` / `git stash pop` are unsafe here — a concurrent session can
  observe or disturb the stash, and a branch switch between stash and pop lands
  the changes somewhere unintended. Prefer committing to a scratch commit, or
  copying files to the session scratchpad.
- **`git checkout -- <file>` destroys uncommitted edits, and it is the same
  class of hazard as stash.** It is the obvious way to undo a mutation during
  mutation-testing, and it silently takes every unrelated edit in that file with
  it. This happened twice in one session on 2026-07-28: both times a deliberate
  one-line mutation was reverted along with an hour of unrelated wiring in the
  same file, and both times the loss was invisible until a later grep. Two rules
  follow, and the first is cheap enough that there is no excuse for skipping it:
  **commit before mutation-testing**, and revert a mutation by copying the file
  back from the session scratchpad rather than by asking git for it. A file that
  git does not track yet is worse still — `git checkout` fails on it and leaves
  the mutation in place, so the "restored" baseline is not restored at all.
- Before reporting "merged" or "unmerged", ask git rather than recalling:
  `git merge-base --is-ancestor <branch> main` and `git log main..<branch>`.
- A branch fully contained in `main` should be deleted rather than left as a
  pointer someone can build on.
