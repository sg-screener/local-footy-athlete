# Schedule-fact ownership reassessment — 2026-08-01

Unit 2 of the day shift. The seven-question reassessment owed on declared
reds 8-9 (`programControlDurableOwnershipTests`; VALIDATED by Sam's device —
"busy/away felt dead"). Produced per the escalation rule BEFORE code; the
recommendation parks for Sam's approval
(`docs/PARKED_QUESTIONS_2026-08-01.md` §2). No code changed in this unit.

## The defect, stated from the code

`transactTemporarySourceFact` commits a fact down one of three lanes:

1. **INERT** — the fact composes no source-fact-constraint change: commit off
   the §18 mutation boundary, `preserveExactAcceptedWorkouts: true`. Works.
2. **SCOPED REGEN** — a NEW deriving constraint (`type === 'fatigue' |
   'injury'`): authorised base change as a week overlay + fact-linked
   adjustment. Works (illness law, stage 1).
3. **THE DEAD LANE** — everything else, which in practice means a NEW
   `schedule` constraint (busy_week / travel / max_sessions): the mutate
   re-canonicalises the accepted base (`preserveExactAcceptedWorkouts:
   undefined`), and the verifier — correctly guarding the inert path —
   refuses ANY non-scoped-regen base change
   (`accepted_composition_base_changed_by_temporary_fact`,
   `temporarySourceFactTransaction.ts` verifier). Refused on every device
   with a real accepted base. This is declared red 8, whole.

Equipment facts escape the dead lane because generation itself enforces them
(`validateWorkoutAgainstActiveConstraints`) and their commit path was built
through the equipment unit's own transaction kind; schedule facts were left
on a lane whose two halves contradict each other. Declared red 9 is the
second, independent fact: even hand-composed, a busy_week constraint blocks
exposures the generator never emits — the constraint has NO ruled effect,
because "how short is short?" (the `time_cap` minutes question) has never
been answered.

## The seven questions

**1. What is the current source of truth?** The accepted composition base
(§18-validated surfaces) plus the typed fact list. The visible week derives.
That part is correct and is not in question.

**2. How many representations of "the athlete is short on time" exist?**
Five: the typed fact; the composed `schedule` activeConstraint; the
re-canonicalised base the dead lane builds and always throws away; the
legacy busy-week constraint shape (`migrateLegacyTemporarySourceFacts` still
mints week-scoped facts from it — the 2026-08-01 device tape's
`schedule:week:2026-07-27:busy_week` is exactly this residue); and the ack
sentence's implicit claim. Two of the five (the thrown-away base, the legacy
shape) exist only to cause trouble.

**3. Where can intent/scope be reinterpreted?** (a) fact → constraint
composition; (b) the inert-signature comparison (keyed on constraint
IDENTITY, so a record-only schedule fact still reads as "not inert");
(c) the deriving classification (keyed on constraint TYPE STRINGS, not on
whether a ruled effect exists); (d) the mutate-path choice; (e) the
verifier. Five decision points for one question — "does this fact change the
program?" — is the disease.

**4. Which layer should own the decision?** THE FACT'S RULED EFFECT. A fact
whose effect is unruled (busy_week today: no minutes answer) is RECORD-ONLY
by ruling, and record-only is what the INERT lane is for. A fact with a
ruled effect (severe illness; time_cap once Sam answers the minutes
question) is DERIVING and takes scoped regen. The commit lane follows the
ruling, not the constraint's type string.

**5. What simpler architecture removes representations?** RETIRE THE DEAD
LANE. Every source fact is either inert or deriving; there is no third path.
Concretely: a schedule fact with no ruled effect commits inert
(`preserveExact`, no §18 re-gate, program byte-unchanged — which makes the
signed success sentence "Got it — logged..." TRUE and the honest-refusal
sentence unnecessary); the re-canonicalising mutate for schedule facts is
deleted, not guarded. When the minutes ruling lands, `time_cap`/busy joins
the deriving set the same way illness did (scoped regen, overlay,
fact-linked undo). One classification, two lanes, zero guards.

**6. Which legacy paths retire?** The legacy busy-week activeConstraint
writers and the migration's week-scoped busy fact (the tape residue) — L15:
new saves in the canonical shape only, migration becomes read-ingress that
maps a legacy constraint to a fact ONCE and the constraint shape is never
written again. (Census work; sized small.)

**7. What tests prove the new boundary?** The walker's schedule-door cells
flip from "refuses conservatively" to "commits inert, program
byte-unchanged, honest success ack" — declared red 1 in
`programControlDurableOwnershipTests` is PAID and its cell rewrites to
assert the inert commit; the tape-world cell keeps its conservation half.
Declared red 2 ("the constraint changes nothing visible") STAYS, honestly
declared, until the minutes ruling gives busy an effect — at which point it
pays through the deriving lane with its own cells, and the two success
sentences re-sign with their effect clause (the §6-V caveat's own terms).

## Options compared (elegant-solution rule)

1. **Incremental**: teach the verifier to allow schedule-fact base changes —
   REJECTED: another guard on the dead lane, and a base change nothing ruled
   is exactly what the verifier exists to refuse.
2. **Classification owns the lane** (recommended): unruled-effect facts are
   inert; ruled-effect facts derive. Removes the dead lane, two
   representations, and the standing lie in the busy door — and needs no new
   resolver, guard, or compatibility branch.

## Parked for Sam

- Approve direction (option 2) before any code.
- "How short is short?" — the `time_cap` minutes answer that turns busy from
  record-only into deriving. Until answered, tapping "Short on time today"
  records the fact and truthfully says so; it changes nothing.
