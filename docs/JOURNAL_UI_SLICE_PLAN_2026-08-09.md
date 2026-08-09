# JOURNAL UI POLISH SLICE — the dependency list, measured before the build

Order: SEAT_INBOX item 1 (2026-08-09), against
docs/JOURNAL_UI_DIRECTION_RULING_2026-08-09.md and the v2 mock beside it.
Both committed as authored at `fca3ef77`.

This document is the measurement the V3 law requires before a build opens. It is
written BEFORE any code, so what it gets wrong is visible later.

---

## 1. WHAT THE SLICE IS

**A presentation slice. It adds no stored state and it derives no new fact from
the stores** — with two exceptions, both named in §4, both pure derivations over
inputs the app already persists.

The ruling's organising rule — *nothing appears unless it has something to
say* — is not a layout instruction. It is a statement about NULL: every block
below the hero must be able to return nothing. That is the shape the build
takes, and it is what a cell can assert.

---

## 2. THE FINDING THAT CHANGES THE SLICE

**Most of the ruling's default screen is behind Sam's signature, and the
appearance pass is what made that visible.**

`JOURNAL_LOAD_CONSTANTS` carries 7 PROPOSED constants of 9. Everything
downstream of a proposed constant returns null through `signedValue()` — the
mechanism the load slice built. Applied to the ruling's own default screen:

| Ruling's element | Feeds from | Renders today? |
|---|---|---|
| HERO — week status headline | `evaluateSection18EffectiveWeek` | **YES** |
| HERO — the week's job | `exposureContractV2` | **YES** |
| HERO — the load band + marker | `headline` (`sweetSpotBand`, `streamWeighting`) | **NO — proposed** |
| HERO — what-changed credit line | decision ledger | **YES** |
| STRIP — sessions done | recorded outcomes | **YES** |
| STRIP — load vs normal arrow+% | `strengthStream`/`conditioningStream` (`minimumWeekCoverage`) | **NO — proposed** |
| STRIP — game feel | recorded outcomes | **YES**, see §4 |
| WEEK BARS | day-shape derivation | **YES** |
| EARNED — region hot | `regionObservations` (`regionNormalWindowWeeks`, `regionSecondaryShare`) | **NO — proposed** |
| EARNED — balance drifting | `patternBalance` (`patternDriftThreshold`) | **NO — proposed** |
| EARNED — niggle history | injury episodes | **YES** |
| LIFTS | recorded weights, no constant | **YES** |
| YOUR MONTH | recorded history | **YES** |
| NOTE BOX | the note store | **YES** |

**This is not a defect and it is not a reason to wait.** It is the provenance
mechanism doing exactly what it was built to do, and the ruling itself says the
thresholds ship PROPOSED. But it means the honest statement of this slice is:
*the exception-based front page is built in full, and Sam's one signing session
is what turns half of it on — no code change.*

**A SECOND FINDING, SMALLER AND WORTH THE SAME SENTENCE.**
`patternDriftThreshold` has sat in the signing table since the load slice, and
**nothing consumes its value.** `patternBalance` carries its PROVENANCE but never
applies the number. Signing it today would have changed nothing on any screen.
This slice makes it load-bearing (§4b), which is the first time the entry means
what the table says it means.

---

## 3. THE GATES THIS RESTRUCTURE IS COUPLED TO — measured, not assumed

Nine journal suites read `JournalScreen.tsx` **as source text**. Four of them
anchor on POSITION, which AGENTS.md's anchoring law says is the shape that
passes vacuously when the anchor moves. Every one of these is a constraint on
the restructure and is listed so none of them is discovered by a red:

| Suite | Anchor | Constraint on this build |
|---|---|---|
| `journal-week` | `function WeekKinds` → `function DidTheWorkHappen` | both names survive, in that order, no "exposure" between |
| `journal-load` | `function LoadSection` → `// ─── The note` | `LoadSection` survives and the note marker stays BELOW it |
| `journal-load` | `function loadEvidenceLine` → `\n}` | survives; still drops the denominator; still no `Math.min/max` |
| `journal-week-job` | `function WeekJob` → next `\n/**` | survives, >300 chars, still renders no completion verdict |
| `journal-month` | `function MonthlyReview` → next `\n/**` | survives, >400 chars, never reads `.value` |

Plus **20 testIDs** asserted by regex across the nine suites. The exception-based
screen stops RENDERING several of them on an ordinary week; the source assertion
only reads the file, so it would keep passing over a line the athlete can never
see. **That gap is the thing to be honest about** — see §5.

Copy gates, both green at baseline: extraction **580 strings, exactly on the
ceiling of 580**; binder **116 proposed strings bound**. Any string this slice
adds raises the ceiling and must be attributed in the same commit.

---

## 4. THE TWO NEW DERIVATIONS, AND WHY EACH IS NOT NEW STORED STATE

**(a) THE GAME-FEEL TILE NEEDS A VALUE, AND THE MODEL ONLY HAS A COUNT.**
`JournalFelt` carries `gameFeelsRecorded` — how many games were rated. The
ruling's tile is a RATING ("4 / 5"). The rating is already stored per session
(`SessionFeedback.gameFeel`, 1–5, an INPUT written by the feel slice) and is
already read into `JournalSessionOutcome.gameFeel`; it is simply never
aggregated. Adding it to the week model is a read.

**The aggregate is the LATEST game's rating, never a mean.** A week with two
games averaged to 3.5 reports a number no game earned. The latest game is a
fact.

**(b) THE BALANCE THRESHOLD BECOMES LOAD-BEARING.** `patternBalance` gains the
plan-vs-done DRIFT its own threshold constant describes. No new constant: the
entry already exists and already contributes its provenance.

**(c) ONE GENUINELY NEW CONSTANT, PROPOSED:** `regionHotRatio` — how far above
its previous best a region must run before the card appears. Today
`regionObservations` fires on ANY exceedance, which is a card every week the
athlete trains slightly harder. The ruling names the region-hot line as Sam's
constant, so it joins his batch. **It is applied to the EXISTING derived value
rather than minted beside it** — one representation of "ran hot", not two.

---

## 5. WHAT THIS SLICE CANNOT PROVE, DECIDED IN ADVANCE

- **NO DEVICE EVIDENCE, and this is the slice where that hurts most.** Every
  previous journal slice could argue its correctness from a derivation. An
  appearance slice's defects are VISUAL. **Sam's eye is the instrument**, and
  this is the pass the order reserved for it.
- **No cell mounts this screen.** The repo has no render-level test; the gates
  read source SHAPE and derivation OUTPUT. A source assertion that a testID
  exists cannot tell a rendered line from a dead branch — which matters more
  in an exception-based screen than it ever has before, because now several
  branches are *supposed* to be dark. Where a line stops rendering on an
  ordinary week, the cell is RE-POINTED to assert the CONDITION, not deleted.
- **Week navigation (‹ 3 – 9 Aug ›) is NOT built.** The mock draws arrows;
  `useResolvedWeek` resolves this week only, and browsing past weeks is a
  feature, not an appearance. The label ships without the arrows.

---

## 6. ORDER OF WORK

1. The two derivations + the constant (`rules/`), with their cells.
2. The screen restructure.
3. Re-point the cells the exception-based screen makes vacuous, out loud.
4. Copy batch 26 PROPOSED; ceiling raised with attribution.
5. Full unpiped chain, boundary report.
