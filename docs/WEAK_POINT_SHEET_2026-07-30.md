# Weak-point work — DRAFT for Sam's signing

**Your line, and it is the one this sheet has to turn into code:**

> `:105` — "Weak point work: KEY thing in off season is working on weakness — may be
> mobility and injury prevention, or strength and size, or conditioning, or speed.
> **What the user said is their weakness is the focus here.** If they don't really say
> they have a weakness then strength and size should be prioritised early, then
> building work capacity, then increasing speed and intensity as we get closer to pre
> season."

**Nothing is wired.** This is the definition, sent first, exactly as the need
computation was. Same format: what is measured, thresholds, caps, `[BIBLE]` where the
line exists and `[MINE]` where it does not.

I named this sheet in §6 of `NEED_COMPUTATION_SHEET_2026-07-30.md` as the one thing I
would not guess at, and this is why: your line names four weaknesses and says the
stated one is "the focus", and "the focus" is the word that could mean three completely
different amounts of app behaviour.

---

## THE ONE QUESTION THAT DECIDES THE REST

**Does a stated weakness change the week's COUNTS, or only what fills them?**

Everything below changes with your answer, so it is first. Three readings, and they are
genuinely different products:

| | What "focus" means | What changes | What it costs |
|---|---|---|---|
| **A. CONTENT ONLY** | the same week, filled differently — a Strength weakness biases exercise selection toward the lifts that build it | nothing structural | it may be too quiet to feel like a focus |
| **B. EMPHASIS WITHIN THE COUNTS** | the same counts, redistributed — 4 strength becomes 3 lower + 1 upper for a lower-body weakness, or a conditioning weakness spends its 4 on the quality that is weakest | the SHAPE of the week within its authored totals | the phase table's balance is what moves |
| **C. THE COUNTS THEMSELVES** | +1 of the weak thing — a Speed weakness makes the week S4/C4/sprint**2** | the authored off-season phase table | the table is yours and this overrides it |

**I recommend B**, and I have not assumed it. B is the only reading where "the focus"
is visible in the week without overriding a table you authored, and it is what your own
example describes: *"an athlete is super fit but weak, not much point in smashing out
running and fitness stuff. They should be focused on strength"* — that is the same
number of sessions, aimed differently.

**A already partly exists** and you should know that before you answer. See §4.

---

## §1 — WHAT THE ATHLETE ACTUALLY SAID

One field, seven answers, asked at onboarding: `biggestLimitation`.

> Strength · Speed · Endurance · Size · Injury history · Mobility · Power &
> explosiveness

**This is the input `:105` points at**, and it is worth noticing that your line names
four categories ("mobility and injury prevention, or strength and size, or
conditioning, or speed") while onboarding offers seven answers. They map, but not
one-to-one:

| Your `:105` category | Onboarding answers that mean it |
|---|---|
| mobility and injury prevention | Mobility · Injury history |
| strength and size | Strength · Size |
| conditioning | Endurance |
| speed | Speed · Power & explosiveness |

**QUESTION 1: is that mapping right?** In particular — **is "Power & explosiveness" a
speed weakness, or its own thing?** I have grouped it with speed because your sprint
and power rules live closest together, but power has its own authored pool and its own
primer rules, so it could reasonably be a fifth category. `[MINE]`

**QUESTION 2: what if they said nothing?** `:105` answers this and it is the one part
of the line that is unambiguous: *"strength and size should be prioritised early, then
building work capacity, then increasing speed and intensity as we get closer to pre
season."* That is a DEFAULT ORDER over the off-season, and §3 says what the app already
does about it.

---

## §2 — WHAT WOULD BE MEASURED, UNDER READING B

Under B nothing new is counted. What changes is a DISTRIBUTION the app already
computes, so the sheet is short — which is itself an argument for B.

### W1 — Strength distribution (weakness: Strength, Size)

**Today:** the phase table gives a strength COUNT and the allocator distributes it
across lower/upper/full by its own balance rules.

**Under B:** a strength weakness shifts that distribution toward the region the athlete
is weakest in — and here the app has more to go on than the one field, because
onboarding also asks `squatStrength` and `benchStrength`. An athlete who says "Strength"
and squats 1.0x bodyweight while benching 1.25x has a LOWER-body weakness, and the app
knows it.

**Threshold:** `[MINE]` — shift one exposure, never more. A 4-strength week becomes 3+1
rather than 2+2.

### W2 — Conditioning quality distribution (weakness: Endurance)

**Today:** the phase table gives a conditioning count and the scorer picks qualities
(aerobic base / tempo / VO2 / glycolytic / sprint) by its own rotation.

**Under B:** an endurance weakness weights that pick toward aerobic base and tempo — the
qualities that build the thing they said they lack — for the EARLY off-season, releasing
as the phase progresses (your "then increasing speed and intensity as we get closer to
pre season").

**Threshold:** `[MINE]` — at most one quality substitution per week.

### W3 — Sprint / power emphasis (weakness: Speed, Power & explosiveness)

**Today:** `:104`-adjacent rules already floor sprint at 1 exposure from mid off-season,
and the power primer has its own authored spec.

**Under B:** a speed weakness does NOT add a second sprint day — that is reading C, and
it would override your sprint law. It biases the primer toward the explosive end of the
authored power pool and prefers the sprint qualities inside the conditioning count.

**`[BIBLE]`** for the floor; **`[MINE]`** for the bias.

### W4 — Mobility and prehab (weakness: Mobility, Injury history)

**Today:** the need-based top-up already places an off-season Mobility session toward
two (N2, signed), and an Accessories session when coverage is short (N1, signed).

**Under B:** a mobility or injury-history weakness raises N2's aim from "toward 2" to
"2, and prefer it early in the week", and lowers N1's threshold so the accessories
top-up fires more readily — from below 3 of 6 regions to below 4 of 6.

**This is the one place where B and C are hard to separate**, because the top-up's aim
IS a count. It is a count of OPTIONAL work, which is why I think it stays inside B: the
authored phase table governs required work and does not mention it.

**QUESTION 3: does a mobility weakness move N1's threshold and N2's aim?** `[MINE]`

---

## §3 — THE DEFAULT ORDER, AND WHAT ALREADY IMPLEMENTS IT

`:105`'s no-stated-weakness default — strength/size early, work capacity next, speed and
intensity approaching pre-season — **is already the shape of the off-season subphase
tables.** `early_offseason`, `mid_offseason` and `late_offseason` each select their own
strength/conditioning/sprint targets, and the progression runs in that direction.

So the honest position is: **the default half of `:105` is implemented, structurally,
and nothing needs to be built for it.** What is NOT implemented is the stated-weakness
half — the part that says the athlete's own answer is the focus.

**I am flagging this rather than claiming it as coverage**, because "the subphase tables
happen to run in the same direction as the sentence" is weaker than "the sentence is
enforced". If you want the default order gated as law rather than coincidence, that is a
Bible anchor plus a cell, and it is small. **QUESTION 4: gate it?**

---

## §4 — WHAT ALREADY EXISTS, SO THIS SHEET IS NOT SOLD TWICE

`rules/testingBias.ts` already reads `biggestLimitation` and produces small selection
biases: an Endurance answer leans aerobic, Speed leans sprint, Injury history leans the
prehab focus areas. It is **reading A, at low amplitude** — capped at 0.1, scaled by
phase (off-season 1.0, pre-season 0.6, in-season 0.3), and it changes which exercise or
template gets picked, never a count or a distribution.

**So A is live and B is not.** If you rule B, this bias stays and the distribution work
sits on top of it — they answer different questions, and the bias is the finer grain.

**One thing to note, and it is the kind of thing this repo has been wrong about before:
the bias is not currently gated against your line.** It exists, it is plausible, and
nothing asserts that its direction matches `:105`. If you sign B, the same commit should
bind A to the same mapping table in §1, so the two cannot disagree about what a Speed
answer means.

---

## §5 — CAPS, WHICHEVER READING YOU PICK

| Cap | Value | Source |
|---|---|---|
| Weak-point emphasis applies in | **off-season only** | **`[BIBLE] :105`** — "KEY thing in **off season**" |
| Required work changed | **never** (under B) | your phase tables are authored |
| Exposures shifted per week | **at most one** | `[MINE]` |
| Overriding a safety or feasibility reduction | **never** | existing law |
| Applies when the athlete states nothing | **no** — the default order applies instead | **`[BIBLE] :105`** |

**Why off-season only, stated plainly:** `:105` is an off-season line and `:104` is the
reason — chasing mobility in-season "risks injury", and the same logic applies to
chasing any weakness while games and team demands are live. In-season the week is built
around being fresh for game day, and a weakness is not an emergency.

---

## §6 — WHAT THIS SHEET DELIBERATELY DOES NOT PROPOSE

- **No new onboarding question.** Seven answers already exist; asking again would be a
  second representation of one fact.
- **No free-text weakness.** `biggestLimitation` is a closed list, and a free-text
  weakness would be an input with no owner — the exact class the injury "Other" path is
  being investigated for.
- **No weakness-driven exercise INVENTION.** Whatever the weakness, the session is still
  composed from your pools at your doses. A weakness changes WHICH authored thing is
  picked, never what exists.
- **No in-season behaviour.** §5.

---

## §7 — WHAT I NEED FROM YOU

1. **A, B or C?** (§0 — decides everything. I recommend B.)
2. **Is "Power & explosiveness" a speed weakness or its own category?** (§1)
3. **Does a mobility / injury-history weakness move N1's threshold and N2's aim?** (§2 W4)
4. **Should the default order be GATED as law, or left as the subphase tables' emergent
   behaviour?** (§3)
5. **Anything measured here that should not be, or missing that should be.** The one I am
   least sure about is W1's use of `squatStrength`/`benchStrength` to decide WHICH region
   a "Strength" answer means — it is the app inferring something the athlete did not say,
   and it would be just as defensible to ask them.
