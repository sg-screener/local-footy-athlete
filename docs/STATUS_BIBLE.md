# STATUS — seat `bible`

**One name, one file, one writer.** Started 2026-08-13. `ls docs/STATUS_*.md`
returned ARMS / AUDIT / CAP / COMPOSER / DESKTOP / DEVICE / GUNSHOW / LAWS /
PACE / PATTERNS / PROGRESSION / READINESS / TERMINAL / VOCAB — `BIBLE` was free.
Item 64 claimed by stamping the name on its **first physical line**, because the
scan reads column 0 and three items today had their owner one line too low.

---

## 2026-08-13 — STEP ONE: HOW BIG IS THE BIBLE, AS RULES?

**⚠ THIS IS NOT ITEM 61 AND THE TWO NUMBERS MUST NEVER BE ADDED.**
Item 61 (`vocab`) counts **CODE-to-CODE drift** — one concept written as two
word-lists inside the app, 93 unchecked crosswalks. **This counts BIBLE-to-CODE
ABSENCE** — a rule that exists in Sam's prose and has no enforcer at all.
Different corpus, different failure, different owner. Nothing here is a
crosswalk and nothing there is a Bible line.

### THE ANSWER

# 1,003 RULE LINES

Out of **4,986** lines / **4,528** non-empty, in `docs/LFA_PROGRAMMING_BIBLE.md`.

**IT IS IN THE THOUSANDS AND I AM SAYING SO**, which the item explicitly asks
for: *"do not quietly narrow the definition until it is comfortable."* I did not.
The one narrowing I made went the OTHER way and made the number BIGGER — see the
sensitivity note below.

| bucket | lines |
| --- | --- |
| **RULE LINES** | **1,003** |
| headings (excluded) | 1,233 |
| changelog, section 19 (excluded) | 58 |
| narrative — no normative token | 2,234 |
| **accounted** | **4,528 of 4,528 non-empty** |

Every non-empty line lands in exactly one bucket. Nothing is dropped on the
floor, which is the first thing a census can get wrong.

### THE DEFINITION, STATED BEFORE THE NUMBER AND APPLIED BY A SCRIPT

A **RULE LINE** is a non-empty Bible line that is NORMATIVE — it says what the
app must, must not, or always does — decided by three mechanical tests in order.
**No per-line judgement is made by me at any point.**

1. **NOT A HEADING.** Under 60 characters with no sentence-ending punctuation, a
   markdown `#` heading, or a section number (`3.`, `20.5`). **A bullet, table
   row or numbered list entry is CONTENT by construction, whatever its length.**
2. **NOT HISTORY.** Section 19, the amendment changelog, records what CHANGED.
   Those lines are normative in grammar and settled in fact; counting them would
   pad the census with the app's own diary.
3. **CARRIES A NORMATIVE TOKEN** — a modal, a prohibition, a threshold or an
   ordering arrow:
   `must · never · always · only · may (not) · cannot · should · shall ·
   forbidden · illegal · required · requires · exception · at least · at most ·
   maximum · minimum · no more than · no fewer than · does not · do not ·
   is not · are not · counts as/toward/against · per week/session/day · ->`

### ⚠ SENSITIVITY: ONE TEST MOVES THE ANSWER 14%, AND I MEASURED IT RATHER THAN PICKING

**My first heading test called 1,846 lines headings and produced 863 rule
lines.** It was wrong: `* Barbell work` and `Avoid / reduce` are CONTENT — a
bullet is a list item, never a section title. Excluding bullets from the heading
test moves the answer:

| heading test | rule lines |
| --- | --- |
| bullets are content **(the answer)** | **1,003** |
| bullets can be headings (`--wide-headings`, kept runnable) | 863 |

**A 14% swing on one predicate.** Both runs stay in the script so the next reader
can see the instrument's sensitivity instead of taking a single confident number
on trust. **The number is ~1,000, not 1,003 to the unit**, and saying otherwise
would be false precision.

### THE INSTRUMENT FINDS THE CASE THAT ORDERED THE ITEM

**Line `:227` — the founding sighting — is classified RULE.** That is the
liveness check that matters: a census that cannot see the defect it was built
for is measuring its own blind spot, which is the failure this repo has recorded
seven times and which I hit four times in one hour on item 61 as a different seat.

> `:227` *Lower-session heavy-slot ladder, in fill order: heavy squat pattern ->
> heavy hinge pattern -> single-leg knee-dominant -> single-leg hip-dominant ->
> accessories.*

### TWENTY THE DEFINITION CAUGHT, SAMPLED EVENLY ACROSS THE FILE

```
:   3  Conditioning qualities, doses, work:rest bands and template properties are owned by…
: 121  * Can strength and conditioning be on the same day? yes absolutely and I'd almost pr…
: 412  It is not a max strength lift.
: 748  * When injury severity requires affected training to pause.
:1043  * Upper pull should appear regularly because it supports shoulder health and balances…
:1279  * Tempo / extensive conditioning -> Aerobic Capacity (extensive tempo, aerobic shuttl…
:1507  * Do not punish them.
:1753  * Do not add hard sprint/COD close to game day.
:1994  * Running pain -> more running volume
:2237  * Bent-over row -> chest-supported row or cable row
:2434  * Quad pain from lunges -> walking lunges
:2657  Simple rule: Missing one session should not wreck the week.
:3077  Position should never override:
:3567  What the app should not do: Do not over-bias strength so fitness drops, or over-bias …
:3907  * The app should check total daily and weekly load.
:4093  * Do not ignore team training when calculating weekly load.
:4283  "Running: 2 days minimum per week, 3 preferred, 4 hard max. Team training counts towa…
:4567  | Maximum | The normal programmed ceiling. It is not a target. A user override may be…
:4660  * Do not add unnecessary sprint after the floor is met.
:4781  * After that first block, off-season deload cycles begin and run on the same 3–4-week…
```

### FIVE IT DELIBERATELY DID NOT

```
:2850  Contest robustness              HEADING — names territory, rules nothing
:2851  Lateral movement                HEADING — names territory, rules nothing
:1640  * 30m build + 30m fast.         NARRATIVE — no normative token
:1641  * 40-60m smooth sprint exposure. Gradually building to top end speed.
                                       NARRATIVE — no normative token
:4922  19. Amendment changelog         CHANGELOG — records what changed, does not rule
```

**⚠ TWO OF THOSE FIVE ARE ARGUABLY RULES AND I AM NOT HIDING IT.** `:1640` and
`:1641` are DOSES — *"30m build + 30m fast"* prescribes work as surely as any
`must` does. **The token list cannot see a bare dose**, and that is a known
under-count in the narrative bucket, not a decision that they do not matter.
Any future widening should start there, and it will push the number UP.

### WHERE THE RULES ARE

| lines | rule lines |
| --- | --- |
| 0–499 | 110 |
| 500–999 | 87 |
| 1000–1499 | 103 |
| 1500–1999 | 102 |
| 2000–2499 | 116 |
| 2500–2999 | 74 |
| 3000–3499 | 53 |
| 3500–3999 | 79 |
| 4000–4499 | 115 |
| 4500–4999 | **164** |

Rules are spread through the whole document, not concentrated in a rules
section — **there is no chapter you could enforce and be done.**

### WHAT THIS DOES NOT YET SAY

**Nothing about coverage.** This commit is the DENOMINATOR only: how many rules
there are to hold. **How many are held, and by what, is the ratchet — and it is
the next commit, deliberately not this one**, because the item says step one
lands alone.

---

## 2026-08-13 — STEP TWO: THE RATCHET. **8 OF 1,003.**

# DEBT 995 · COVERAGE 0.8%

**Eight rule lines out of a thousand have a named enforcer.** The mechanism to
cite the Bible from code exists, is bidirectional, is tested — and reaches
**eight**.

| | |
| --- | --- |
| RULE LINES | 1,003 |
| **HELD — a cited enforcer names them** | **8** |
| **DEBT** | **995** |
| coverage | **0.8%** |

Held: Bible lines `105, 110, 132, 4890, 4898, 4904, 4908, 4918`.

### NOTHING IS HAND-TYPED — THE MAP IS DERIVED END TO END

The item requires the mapping be machine-held and derived where derivation is
possible. **No line number appears anywhere in the suite.**

| what | derived from |
| --- | --- |
| rule lines | the step-one definition, re-applied to the same corpus |
| enforcers | `data/bibleThresholdAnchors.ts` — 18 entries, each quoting a Bible sentence verbatim |
| the citation | a `BIBLE_ANCHOR: <id>` marker in production code — **18 of 18 present** |
| **held lines** | **found by LOCATING each quote in the Bible.** Edit the Bible and the map moves with it |

**An anchor counts only when BOTH halves exist.** A registry row nothing cites is
a claim; a marker citing no row is a dangling name.

### ⚠ WHY 18 ANCHORS HOLD ONLY 8 RULE LINES

The 18 quotes land on 18 Bible lines, but **10 of those are lines my own
definition does not call rules** — they are doses and table rows without a
normative token. **The two instruments disagree about what a rule is**, and that
disagreement is a finding, not a rounding error: the enforcement mechanism that
exists is pointed largely at lines the rule-census cannot see. Widening the
definition to catch bare doses would raise BOTH numbers. Stated here so the 8 is
not read as "10 anchors are broken" — they are not.

### MUTATION-PROVEN THREE WAYS, AND THE ITEM DEMANDED THE FIRST

| mutant | result |
| --- | --- |
| **delete one enforcer name from the mapping** (`BIBLE_ANCHOR: gunshow_two_two_two`) | held **8 → 7**, debt **995 → 996**, cells **[3] and [4] RED** |
| ceiling 995 → 994 | **[4] RED** |
| **NARROW the rule definition** (drop the arrow and two modals) — the blinding case | debt "improves" **995 → 838 with ZERO rules enforced**, and **[2] and [5] RED** |

**THAT THIRD ROW IS THE ONE THAT MATTERS.** A coverage number can be improved by
enforcing a rule or by ceasing to notice it, and they look identical in a totals
line. **Cell [2] catches it because the founding sighting `:227` stops being seen
as a rule the moment the definition narrows** — the case that ordered this item
is the tripwire that keeps the instrument honest. Cell [5] catches the same move
from the other side: a fall of more than 10 must be BANKED in the ceiling.

`test:bible-coverage`, **5/5**, in `test:bible`.

### ORDERED BY WHAT AN ATHLETE WOULD NOTICE, NOT BY EASE

The item asks for this explicitly — *"the single-leg case sat behind a green
suite for months precisely because nobody was ranking by harm."*

1. **`:227` — the lower-day ladder.** Five slots authored, four planned, and
   single-leg work never requested. **An athlete does legs all year and never
   gets a lunge or a single-leg RDL.** This is the founding case and it is still
   unheld. Cell [2] pins it.
2. **Dose lines with no token** — *"30m build + 30m fast"*, *"15-25 min easy
   aerobic"*. These PRESCRIBE. They are invisible to both the census and the
   anchor registry, so an athlete could be given any distance and nothing
   anywhere would object.
3. **The 164 rule lines in the last 500-line band** — Section 18 and the
   exposure tables, the densest rules in the document, holding **zero** anchors
   between `:4890` and `:4918`'s six.

### WHAT THIS DOES NOT CLAIM

**COVERAGE IS NOT CONFORMANCE.** A line counts as held when a cited enforcer
names it. `:227` is the proof that a rule can have a checker, have a planner,
and still not be obeyed — `sessionSlotCoverage` CHECKS five slots while
`coachingEngine` PLANS four, and both are individually correct. **This census
would call such a line HELD.** The next instrument is the one that compares what
the enforcer asks for against what the prose says, and it is not this.

**AND I FIXED NOTHING**, per the item: *"DO NOT FIX WHAT YOU FIND. The census is
the deliverable."*

---

## 2026-08-13 — STANDING ITEM 13, PERFORMED THIS STOP

**`LAW REGISTRY: 125 rows, 104 guarded, 21 UNENFORCED`** — measured with
`npm run test:law-registry`, which counts ROWS, not `grep -c`, which item 13
records as sending every seat one high.

**The count is falling: 27 → 26 → 24 → 22 → 21** across the day. Not my payment —
`laws` and `readiness` made the last ones; measuring and reporting it is what the
standing item asks of whoever stops.

**Item 1 (merge `codex/*`) I did NOT re-derive.** Its own text records the answer
from this morning: 72 branches, 42 with a delta, **all forked 2026-07-19, none
after 2026-08-10 — nothing of Sam's is waiting to reach his phone.** `git branch
--no-merged main` still returns 42, consistent with that reading. **Re-deriving a
performed standing item is the waste this repo keeps paying for.**

### THE QUEUE AT MY STOP, AND WHY I STOPPED WITHOUT CLEARING IT

**One item reads workable and it is not mine: 66, `OWNED BY \`sim\``, with the
owner on the item's SECOND line** — invisible to a scan that reads column 0.

**I did not rewrite it.** `laws` escalated exactly this to Sam with a proper
`REGISTRY-GREP` and stated the reason plainly: *"rewriting other seats' items is
not mine."* It is not mine either, and **a second question would be the re-ask
Sam has named as his single worst failure mode.**

**What I DID add is an UPDATE to that live entry, not a new one:** its blocker has
shrunk **three items → one**, because 61 and 63 have since been re-formed by their
own owners. **A decision priced at three is being made on a queue that now has
one**, and that is worth Sam knowing before he answers.

**FIFTH SIGHTING OF THE SAME SHAPE IN ONE DAY** — 50, 62 (mine, as `device`), 61,
63, 66. The convention is right and the writing keeps missing it.
