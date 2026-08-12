# "VERY HARD" IS READ AS "EASY" — one field, two scales, and the athlete gets MORE load for it

**2026-08-12, unattended session.** Found while starting inbox item 6 after
Sam's ruling *"ask me"* (add an effort rating to strength sessions).

**THE RULING IS ALREADY BUILT. The asking already happens.** What is broken is
the READING — and it is inverted, live, on the exact field the ruling depends
on.

**NOTHING IS CHANGED BY THIS PASS.** The last step is a training-semantics
decision (§5) and it is Sam's.

---

## §1 THE DEFECT, IN ONE LINE

**An athlete who rates a strength session `5` — the panel's own label for
"very hard" — with no soreness, is given MORE volume next session, and told
*"Load increased due to strong performance last session."***

## §2 THE CHAIN, EVERY LINK VERIFIED

**1. The panel asks, on a 1–5 scale.** `SessionFeedbackPanel.tsx:1072-1084` —
*"How hard was the session?"*, hint **"1 = very easy · 5 = very hard"**, five
chips.

**2. It writes into `difficulty`.** `:899` —
`difficulty: executionSummary ? sessionRpeValue : conditioningRpeValue`. On a
strength/checklist session the execution summary exists, so `difficulty`
receives the **1–5** value.

**3. The 1–5 range is enforced.** `sessionFeedbackForm.ts:162` —
`isSessionEffortRating` = integer **1..5**.

**4. THE SAME FIELD ALSO RECEIVES A 1–10 VALUE.** The conditioning RPE input
goes through `parseRpe` (`SessionFeedbackPanel.tsx:180-184`), which clamps to
**1..10**, and lands in the same `difficulty`.

**5. The reader is written for 1–10.** `feedbackAdapter.ts:221-266`, and its own
helper says so: *"Map the 5-level feeling to approximate RPE difficulty
(**1-10**)"* (`:274`).

```
Rule 3  difficulty >= 9  -> reduce volume, block progression   ("fatigue")
Rule 4  difficulty >= 8  -> hold volume, block progression     ("recovering")
Rule 6  difficulty <= 5  -> volumeAdjustment: +1, 'Strong'     ("progress")
                            "Load increased due to strong performance last session."
```

## §3 THE ARITHMETIC — what a strength rating can and cannot reach

The panel's maximum is **5**. Therefore, from a strength session:

| athlete says | `difficulty` | rule that fires | what the app does |
|---|---|---|---|
| 1 very easy | 1 | Rule 6 | **+1 volume** |
| 3 | 3 | Rule 6 | **+1 volume** |
| **5 VERY HARD** | **5** | **Rule 6** | **+1 volume, "strong performance"** |

- **Rules 3 and 4 are UNREACHABLE from a strength session.** 5 < 8, always.
- **Rule 6 fires on EVERY strength rating**, including the hardest one the
  athlete can give, whenever soreness is `none`.
- Soreness is the only thing that can stop it — so the defect is masked exactly
  when the athlete also reports soreness, and bites when they report a brutal
  session that left them fine the next morning.

## §4 WHY IT SURVIVED

`difficulty` was a conditioning-RPE field. Extending the same tap to strength
was Sam's own ruling — *"one tap, no per-set anything"* — and the type's comment
records it. **What travelled was the field; what did not travel was the SCALE.**

The type comment at `types/sessionOutcome.ts:48-51` is now stale in the other
direction — it still says *"`difficulty` is written from the conditioning RPE
input alone, so a strength session records no effort at all"*, which the code at
`:899` contradicts. **The capture landed; the comment and the reader both missed
it.**

**This is the `two-meanings` class** (`e9e9f4d9`, "THE TWO-MEANINGS CLASS IS A
LAW, AND SO IS ITS MIRROR"): one field, two units, no marker saying which. The
existing law's guard did not catch it because both writers are legal and neither
is a rename.

## §5 THE DECISION — Sam's, because it is training semantics

The scales must stop sharing one field. Three ways, and they differ in what they
say about an athlete:

- **(A) MAP 1–5 ONTO 1–10 at the write boundary** (`5 -> 10`, `4 -> 8`,
  `3 -> 6`…). One line, no new surface, no new question. But it ASSERTS that
  "very hard" on the five-point scale means 10/10 RPE, which is a claim about
  the athlete nobody has made.
- **(B) GIVE THE READER BOTH SCALES** — carry the scale with the number and
  branch on it. Honest, no invented equivalence, and it is the shape the
  two-meanings law prefers: make the unit explicit rather than converting.
- **(C) ASK STRENGTH ON THE SAME 1–10 SCALE AS CONDITIONING.** Removes the
  mismatch at the source; costs a changed surface Sam has already ruled on
  once ("one tap").

**RECOMMENDED: (B).** It is the only one that adds no claim about what the
athlete meant, and the two-meanings law names converting-without-marking as the
defect rather than the cure.

## §6 NOT COVERED

- **Nothing was run.** This is a static trace of five verified links; no world
  was built and no suite was executed against the inversion.
- **No cell exists for it yet.** The fix owes one: a strength session rated 5
  with no soreness must NOT return `volumeAdjustment: +1`, and a conditioning
  RPE of 9 must still reduce volume. Both arms, or the fix is unproven.
- **How often it bites real athletes is OPEN-UNKNOWN** — no journal data read.
- **Whether `sessionBuilder.ts:997`** (`feedback.difficulty` feeding a
  conditioning RPE) **has the same mixed-scale exposure is NOT investigated.**
  It reads the same field.

**NORTH STAR: toward.** The fix removes an ambiguity rather than adding a guard.
