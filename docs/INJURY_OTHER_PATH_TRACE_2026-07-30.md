# Where does the injury "Other" answer GO? — the trace, with receipts

**Sam's question (HOME_SCREEN_REDESIGN_RULINGS ruling 11):** when an athlete taps
Other on the injury sheet, or types free text into "e.g. calf, wrist, elbow", where
does that answer go? Stored as a typed fact, routed to a ruled region via the phrase
map, or silently dropped? If free text can't resolve to a region, what does the program
DO with it?

**The answer: it is a PARTIAL SWALLOW.** The answer is stored, it is typed, and it
changes the DOSE. It changes nothing about the CONTENT — no movement is filtered, no
exercise is swapped — and nothing anywhere says so. And it is worse than the question
assumed: **two ordinary menu rows do it too, with no typing at all.**

---

## The path, step by step

**1. The sheet** (`screens/home/GuidedInjuryFlowSheet.tsx`)

Region `other` routes to the `custom_area` step; the free text lands in `customArea`,
and `selectedArea = (area || customArea).trim()`. An empty box cannot continue
(`disabled={customArea.trim().length === 0}`), so the value is never blank — but
`submit()` still defends with `area: selectedArea || 'unknown'`.

**2. The constraint** (`utils/guidedInjuryControl.ts` → `buildGuidedInjuryConstraint`)

```
const bucket = guidedInjuryBucketForArea(result.area);   // may be NULL
const key = bucket ?? normaliseKey(result.area);
...
id: `injury-${key}`, bodyPart: displayArea(result.area), bucket, region: result.region
```

`guidedInjuryBucketForArea` is a phrase map of eleven patterns: shoulder/neck/chest/
rib/pec, elbow, wrist/hand, groin/adductor, hip, hamstring/hammy, knee/quad,
calf/achilles, ankle/foot, and a back/midline group. Anything else returns **null**.

**3. It IS stored, and it IS typed.** The constraint is a real `ActiveInjuryConstraint`
with `source: 'guided_injury_flow'`, its own id, the athlete's words in `bodyPart`, and
the severity answers filled in. So the answer is not dropped. That much of Sam's worry
is unfounded.

**4. The DOSE path works.** `severity`, `severityBand` and `adjustmentLevel` are derived
from the severity answer alone, through `classifyBibleInjurySeverity`. An 8-10 answer
pauses affected training whatever the area says, and `injurySeverityPausesAffectedTraining`
does not consult the bucket. **So an unresolvable area still deloads the week.**

**5. The CONTENT path does nothing.** Every consumer that decides which MOVEMENTS to
avoid is bucket-keyed, and each one early-returns on null:

| Consumer | Line | Behaviour when `bucket` is null |
|---|---|---|
| `utils/tapSwapHierarchy.ts` | `if (!bucket) continue;` | the injury is skipped entirely when building `activeInjuries` |
| `utils/injuryWorkoutFilter.ts` | `if (!bucket) return null;` | no filter policy at all |
| `utils/trainAroundEngine.ts` | `if (!bucket) return null;` | no train-around plan |
| `utils/generationConstraints.ts` | `injuryKeysFor(bodyPart, bucket)` | regex over the same text — returns `[]`, so `injuryKeys` is empty and no pool entry is excluded |

And the REGION answer does nothing either: the generator's bye-week branch tests
`injury.region === 'lower_body' | 'upper_body' | 'back_midline'`, and `'other'` matches
none of them.

**So the net effect of an unresolvable answer:** the week's dose drops by the severity
band, and every exercise the athlete can no longer do stays in the program.

---

## It is not only the free-text path

Three of the guided AREA rows are literally named "Other", and they are menu taps, not
typing:

| Menu row | `guidedInjuryBucketForArea` | Result |
|---|---|---|
| `Other upper body` | no pattern matches | **null bucket** |
| `Other lower body` | no pattern matches | **null bucket** |
| `Other midline` | `/midline/` matches | `lowerBack` — resolves |
| `Chest / ribs` | `/chest|rib/` | `shoulder` |
| `Neck` | `/neck/` | `shoulder` |
| `Quad` | `/quad/` | `knee` |
| `Abs / side` | `/abs|side/` | `lowerBack` |

**An athlete who never types a word can reach the null-bucket state by tapping "Other
lower body".** That is a fully-guided path through a ruled menu, and it ends in the
same place as the free text.

---

## The second finding: two phrase maps, different vocabularies

There are **two** area-to-injury maps in the app, for the same question, with different
coverage:

- `guidedInjuryControl.guidedInjuryBucketForArea` — the guided sheet's, eleven patterns.
- `sessionBuilder.INJURY_BODY_AREA_MAP` — onboarding's, ~30 keys **including `shin`,
  `achilles`, `glute`, `quads`, `neck`, `adductors`**.

So "shin" typed at onboarding resolves to `['calf','ankle']` and filters exercises;
"shin" typed into the guided sheet resolves to nothing and filters none. Same word, same
athlete, two answers, depending on which door they used.

That is a second representation of one decision, which is the shape the north star
forbids — and it is invisible because each map is individually plausible.

---

## What no gate observes

Nothing asserts that a guided-flow answer resolves. There is no cell for "every
`GUIDED_INJURY_AREA_OPTIONS` value maps to a bucket", which is why two menu rows can end
in null without any suite noticing. That absence is the reason this needed a trace rather
than a test run.

---

## What I recommend, and what I have NOT done

**Not done: any fix.** This is Sam's ruling-11 investigation and the report is the
deliverable. The fix is a charter-style gap — an input door whose answer no owner
consumes — and it has at least three candidate shapes, which is exactly when to ask
rather than pick:

1. **Make the menu total.** Every `GUIDED_INJURY_AREA_OPTIONS` value must resolve to a
   bucket, gated in both directions, and the three "Other <region>" rows either get a
   bucket or stop being offered. Smallest, and it closes the fully-guided path.
2. **Collapse the two phrase maps to one owner.** One map, one vocabulary, both doors.
   This is the convergent fix and it is bigger.
3. **Refuse honestly instead of storing.** If an answer cannot reach a bucket, say so at
   the point of answering — "I can't program around that one; tell the coach" — rather
   than storing a fact that changes the dose and nothing else. This is the only option
   that does not let the app appear to have understood.

**My recommendation is 1 + 3:** make the guided menu total so the tap path always
resolves, and refuse free text that cannot, because a stored answer that filters nothing
is the worst of the three outcomes and it is the one the app currently produces.

**One thing worth saying plainly:** the severity path working is what makes this hard to
see. The athlete taps "Other lower body", says 6/10, and the week visibly gets easier —
so the app looks like it listened. It did, about the dose. It is still programming the
movement that hurts.
