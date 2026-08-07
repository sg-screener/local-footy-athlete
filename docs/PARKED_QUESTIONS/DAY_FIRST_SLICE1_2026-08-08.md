# PARKED — day-first UI, slice 1 (2026-08-08)

Parked under the overnight law: a Sam-shaped question is written down and the
build continues. None of these blocked slice 1; each is a decision only he makes.
Full context in docs/DAY_FIRST_SLICE1_BOUNDARY_2026-08-08.md.

## 1. Mid-session ticks do not survive an app kill — is that acceptable?

**RECOMMENDED ANSWER: yes, leave it.** Fork A's known edge, and it costs the
athlete nothing: the timeline shows what a SAVED outcome recorded, so there are
no unsaved ticks to lose — there is simply nothing shown until they save. If Sam
wants live per-component ticks that survive a kill, that is fork B or C
(an incremental per-component ledger with its own door, or a partial state on the
session-outcome transaction) as **its own later unit** — both grow engine
machinery inside what he scoped as a new window.

## 2. Two words, PROPOSED and unsigned: `Today` and `Week`

The slice's only new chrome copy — the labels on the zoom control. Both are
already this screen's vocabulary ("Today" is the day badge; "This week" / "Next
week" / "Last week" are the nav badges), which is why they were chosen over
inventing a pair. They join the next signing batch. The extraction gate does not
count single words, so this park is the record that they are new, not the gate.

## 3. Icons, terminal-proposed from existing assets (rulings 6 and 10)

The timeline row icons, by the part's typed kind: strength → strength,
power → bolt, **speed → bolt as well**, conditioning → flame, support → core,
recovery → recovery, team training → team, game → game. **Power and speed share
one icon**, which is the pairing most likely to be wrong. Flagged for the icon
pick session; icons are imagery, not copy, so nothing waits on a signature.

## 4. Should the Today / Week choice be remembered?

Today leads on every open, and the choice resets when the athlete leaves the tab.
**Persisting it would be new stored state** — a UI preference is not a decision,
a fact, an answer or a result — so this unit did not persist it. If Sam wants it
remembered, that is a deliberate north-star exception with a retirement plan, and
his call rather than the terminal's.

## 5. Two identical `recovery` rows on a recovery day with an add-on

A recovery day carrying a populated add-on projects **two parts of kind
`recovery`**, and they render with the same headline and the same rows because
`partHeadline` and `rowsForKind` both key on kind. The timeline keys on `id`, so
no work vanishes — but the athlete would see two identical-looking lines. The
projection carries nothing that tells them apart, so a surface that invented a
distinguishing word would be composing. **Named, not patched.** The fix, if he
wants one, belongs in the projection: an add-on part deserves its own signed
name.
