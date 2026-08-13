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
