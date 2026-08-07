# Finding 3 — the injury path REDUCES where the Bible says SUBSTITUTE

Measured on the settled 1b boundary (`022e1495`), with the tree green.
**No production code rides with this document.** The gap is declared red in
`phaseStructureConformanceTests` cell 10, which names this document as its payer
and forces its own deletion in the commit that pays it.

Supersedes the FINDING 3 section of
`docs/R3_DOOR_PASS_FINDINGS_BIBLE_MEASUREMENT_2026-08-06.md` on two points of
fact — see "what the earlier report got wrong", below.

## What the Bible requires

> **`:4755`** "**Substitute before reducing frequency.**"

> **`:4688`** "Repair order after deletion is: **relocate** the required
> exposure to the highest-scoring Bible-valid day; **substitute** a valid
> session/component where exact relocation is not possible; move or remove
> lower-priority optional work to recover space or stress; **then** record an
> `explicit_user_override` typed reduction for any unavoidable shortfall."

> **`:1913-1917`** (6-7/10, "Limiting issue") "**Keep unaffected work in where
> possible.** Use off-feet conditioning if lower limb is affected."

> **`:72`** "Work around the injury as much as possible. **Continue to do work
> on unaffected areas.**"
> **`:93`** "**Get as much work as you can in around the injury.**"

## What the app produces

Sam's pass profile, team training Monday and Wednesday, target week
`2026-08-10`, hamstring logged at **6/10** through the guided injury door.

```
BEFORE                                   AFTER
  Mon Team Training + Upper Push           Mon Team Training
  Tue Lower Hinge                          Tue Upper Push + conditioning
  Wed Team Training                        Wed Team Training
  Thu Prehab & Accessories                 Thu Prehab & Accessories
  Fri Upper Pull + conditioning            Fri —
  Sat Lower Squat + conditioning           Sat Upper Pull + conditioning
  Sun —                                    Sun —
  6 sessions                               5 sessions
```

Read through the app's own accepted-week owner (`rebaseAcceptedEffectiveWeek`),
the injured week is:

| | |
|---|---|
| prohibited patterns | `squat`, `hinge` |
| required safe patterns | `push`, `pull` |
| main strength required / selected | **2 / 2** (was 4) |
| main strength achieved | 2 |
| conditioning core | 4 against a required 3 |
| blocking violations | **none** |
| authorised reductions | `strength_pattern_count:injury_restriction`, `main_strength_frequency:injury_restriction`, `sprint_high_speed_frequency:injury_restriction`, `power_primer_budget:game_load_protection` |

## The root cause, one line

`src/rules/section18SafetyPolicy.ts`, in the `prohibited.length > 0` branch:

```ts
addReduction(contract, {
  metric: 'main_strength_frequency',
  reducedTarget: Math.min(
    selectedMainStrengthTarget(contract),
    requiredSafe.length,          // ← two safe patterns ⇒ at most two sessions
  ),
  reason: 'injury_restriction',
  detail: 'The selected strength frequency cannot exceed the number of safely available main patterns.',
});
```

**The week's strength FREQUENCY is capped at the number of surviving
PATTERNS.** Prohibit squat and hinge and the athlete may have at most two
strength sessions that week — not because two is all they can safely do, but
because two patterns remain.

Pattern count is a constraint on VARIETY. Frequency is a different quantity, and
nothing in the Bible ties them: a week can carry two upper-push and two
upper-pull sessions, or a second pull session plus the off-feet conditioning
`:1917` names by name. Capping one with the other is a frequency reduction taken
in place of a substitution — `:4755` inverted, and `:4688`'s step 4 performed
instead of its step 2.

The reduction is honestly recorded and the week is §18-conformant. That is not
the defect. The defect is that **the reduction is reached first**, so the
athlete loses a session the Bible says to keep.

This line carries no `BIBLE_ANCHOR` and no Sam ruling — it entered with
`2a7eece8` "fix: enforce shared Section 18 safety boundary" as an implementation
rationale, not an authored number. Worth stating explicitly, because *a Sam
ruling is not a BIBLE_ANCHOR and neither is a plausible sentence*.

## What the earlier report got wrong, and how

`R3_DOOR_PASS_FINDINGS_BIBLE_MEASUREMENT_2026-08-06.md` said the removed slots
"came back as nothing" and that "no off-feet conditioning was added". On the
settled boundary both are now false:

1. **Conditioning is not short.** The injured week carries 4 core conditioning
   exposures against a required 3, off-feet, on the surviving strength days.
   1b's placement owner is why; whatever was true in R3 is not true now.
2. **The week is not silently broken.** It records typed reductions and passes
   §18 with no blocking violation. The complaint is the ORDER the Bible
   prescribes, not a missing disclosure.

**A trap worth recording, because it nearly produced a wrong diagnosis here.**
Evaluating the resolved week against the contract stored on the microcycle
reports three blocking violations — `required_minimum_shortfall:main_strength`
and two `pattern_restore_failure` — and an empty `prohibitedPatterns`. All three
are artefacts: that contract predates the injury. The app's own owner rebases
the contract first, and the rebased answer is the one above. This is
`docs/…/harness-enters-below-the-door` in its evaluator form — **ask the app's
owner, never assemble the pair yourself.**

## The seven questions

1. **Current source of truth?** The contract. `section18SafetyPolicy` authors
   the reductions and `applyReductionProjections` folds them into
   `mainStrength.exposure`. That part is sound and single-owner.
2. **How many representations?** One. This is not an ownership defect — it is a
   RULE defect inside the correct owner, which is why it is small.
3. **Where can intent be reinterpreted?** Nowhere new. The injury's meaning
   ("these patterns are unsafe") is turned into a second, unstated claim
   ("therefore this many sessions") at a single line.
4. **Which layer should own the decision?** The same one. `section18SafetyPolicy`
   should reduce VARIETY where variety is restricted, and reduce FREQUENCY only
   when the week genuinely cannot be filled with safe work.
5. **What simpler architecture removes representations?** Stop deriving one
   quantity from the other:
   - `strength_pattern_count` keeps its reduction to `requiredSafe.length` —
     that is exactly what the injury restricts, and it is correct today.
   - `main_strength_frequency` reduces only when NO safe pattern remains
     (whole-body restriction ⇒ 0). With one or more safe patterns the selected
     frequency stands, and the week fills the freed days with safe work.
   - the balance rule already tolerates repetition: `permittedCountDifference`
     and `pattern_imbalance` are computed over MEANINGFUL main-lift counts, so
     two push and two pull sessions are balanced, not a breach.
6. **Which legacy paths retire?** None. One expression changes.
7. **What tests prove the boundary?** Cell 10 (declared red today) asserts that
   a 6/10 hamstring keeps the week's session count and leaves no empty day,
   while squat and hinge stay prohibited and the week stays §18-conformant. Plus
   a cell for the whole-body case, where reducing frequency IS correct and must
   not regress.

## Blast radius — why this is not landing in the same breath as its diagnosis

Every injured week gains sessions. That moves the two generation goldens, the
injury matrix suites, and anything asserting a session count under restriction.
The change is one expression; validating it is a unit. It is specified here so
that unit executes rather than re-derives.

## Question for Sam

**Should a restricted week hold its selected strength frequency, filling the
freed days with safe work — or is there a load reason to run fewer sessions
while injured that the Bible states elsewhere and this document has missed?**
The recommendation above is the first reading, on `:4755`, `:72` and `:93`. It
is the only point that needs a ruling; everything else follows from it.
