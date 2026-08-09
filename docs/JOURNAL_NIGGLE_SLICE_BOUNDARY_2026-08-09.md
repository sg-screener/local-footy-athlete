# NIGGLE HISTORY + NOTE RESURFACING — boundary report (2026-08-09)

Addendum Group 2 item 9. Built under the standing authorisation; dependency list
measured first in docs/JOURNAL_NIGGLE_SLICE_PLAN_2026-08-09.md.

Commit: `b75cc63f`.

## ONE LINE

**The athlete sees their niggle history by region, and what they wrote the last
time that region flared — joined by TIME, because a note cannot be knee-tagged.**

## NORTH STAR: TOWARD

Zero new stored state. Both inputs already exist and are already INPUTS:
`InjuryEpisodeV1` in the accepted material context, and the athlete's notes from
slice 2. This module joins them and stores nothing.

## THE DESIGN SAID "KNEE-TAGGED", AND THAT IS NOT BUILDABLE

The design's example is *"a knee-tagged note resurfaces when a knee niggle is
flagged"*. **Measured: `JOURNAL_NOTE_TAGS` is a CLOSED vocabulary of eight** —
recovery, mobility, injury, diet, work stress, sleep, illness, travel — with no
region among them, closed deliberately in slice 2 ("a free-text tag set would be
an unauthored vocabulary growing on the athlete's device").

So the join is by TIME: a note resurfaces when it was written in a week an
EARLIER episode in the SAME region was active, and only when it is injury-tagged.
**That link is a fact — same region, same weeks — where a tag-region link would
have needed a vocabulary Sam has not ruled on.**

Adding a region to a note is route (b) in the plan doc. It reopens a vocabulary
he closed, so it is **his call and is not assumed**.

## TWO WRONG ASSUMPTIONS OF MINE, EACH CAUGHT BY AN EXISTING LAW

### 1. `rules/` may not read the note store — even a type-only import

`journalNoteOwnershipTests` refused the module on its first run: *"no rules/ or
resolver module reads the note store."* Notes never derive program state, and
`rules/` is where the engine lives.

**The tempting argument was that a type-only import is erased at compile and
therefore harmless.** That would have traded a non-negotiable for a convenience,
and it would have left the next reader one keystroke from a real import. The note
now arrives as a **narrow structural view** — four fields, named in this module,
mapped by the surface — which is exactly how `journalWeek` takes
`JournalSessionOutcome` rather than the whole `SessionFeedback`. The engine
cannot reach a note from this file even by accident, and a new cell asserts the
module never names the store.

### 2. `episode.region` is a coarse constraint bucket, not a body region

The compiler refused my fixture: `InjuryEpisodeV1.region` is typed
`'upper_body' | 'lower_body' | 'back_midline' | 'other'`. **Grouping by it would
have filed a knee and a hamstring together under "lower_body" — a wrong grouping
AND an internal word on an athlete's screen.**

The key is now the athlete's own `bodyPart`, routed through `resolveInjuryRegion`
— the single owner whose header records that five divergent copies of that
mapping once existed and disagreed with each other and with Sam's ruling. Asking
the owner is the opposite of a rival table, and a cell now asserts both halves:
that the owner IS asked, and that `episode.region` is NOT used.

**A body part the owner cannot route keeps the athlete's own word** rather than
being dropped. They said it, and a niggle the app cannot classify is still one
they had; dropping it would make the history quietly shorter than their memory.

## OBSERVATION, NEVER DIAGNOSIS

The load ruling's second law binds here verbatim. The note comes back as the
athlete's **own words, unparsed**, beside the episode. The introducing line
states only WHEN it was written. **No sentence anywhere in this feature connects
a note to a cause**, and a cell sweeps the module for causal vocabulary.

## A RECORD COUNT IS NOT AN INJURY COUNT

`superseded` means THIS RECORD was replaced by another. Counting it would tell
the athlete they had two niggles where they had one — a count of rows wearing the
name of a count of injuries, which is `a-count-taken-for-a-record` in a new
instrument. Excluded, with a cell.

## SEVEN MUTATIONS, SIX REDS, ONE GENUINE SURVIVOR

**The harness now proves each mutation APPLIED before reading its result** — the
strength line's lesson, built into the runner as an assertion that the
replacement matched exactly once. All seven printed `applied`, so the survivor
below is real rather than a silent no-op.

**The survivor: the region tie-break.** Two regions troubled on the same day swap
with Map insertion order between renders — a diff nobody can explain and a
screenshot nobody can reproduce. No fixture had tied. The discriminating cell is
added and reds on revert.

The six: superseded records entering the history; `improving` treated as an
ending; a note from the CURRENT episode resurfacing as a memory; any tag
resurfacing rather than injury only; notes resurfacing into a quiet region; and
the coarse constraint bucket used as the key.

## THE GATE

- **Full `test:bible`, UNPIPED: `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line** — main's declared red, same assertion text.
- **Sweep: `failures=2 of 164` = the declared set EXACTLY** —
  `test:program-control-durable`, `test:fixture-identity`, at head `b75cc63f`.
- `test:compile` PASSED — no file regressed.
- New suite `test:journal-niggle-history` registered in `test:bible`: **30
  passed, 0 failed.**
- Copy batch 21 PROPOSED. Extraction ceiling **570 → 572**, attributed.

## WHAT WOULD CATCH THE NEXT DEFECT OF THIS CLASS (L12)

The class is **a join that says more than the facts support**. The cells are
built per FILTER rather than per outcome: region-must-flare, episode-must-be-past,
note-must-be-injury-tagged and region-must-match each have a cell that fails
alone. So a future edit that widens any single filter reds exactly one cell and
names which claim it broke — rather than one omnibus cell going red with nothing
to say.

## NOT COVERED

- **NO DEVICE EVIDENCE.** No cell mounts the Journal screen.
- **DEPTH (L13): 0.** Hand-built episodes and notes; no walked athlete.
- **Whether `affectedWeeks` is kept complete by the episode transaction on a live
  device is NOT asserted here** — and it is the one thing that would silently
  resurface nothing while every cell stayed green.
- Route (b) — a region on a note — is Sam's and is not assumed.
- The multi-month progress marker belongs to the monthly review.

## SAM'S QUESTIONS (parked, not waited on)

1. **Should a note carry a region?** Route (b). It reopens the closed tag
   vocabulary, so it is yours. Route (a) is built and works without it.
2. **The region word on screen** is one of your thirteen, routed by your owner —
   but seeing "ankle/foot — 2 episodes" is worth an eye.
3. Batch 21's words.
