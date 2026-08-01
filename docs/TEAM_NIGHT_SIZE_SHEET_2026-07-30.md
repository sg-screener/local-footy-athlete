# Team-night size — SURVEY, and the smallest mechanism, for Sam's signing

---

## ✅ SIGNED AND SHIPPED — 2026-07-31

**Sam signed the whole sheet.** The mechanism is built; this document is now the record of
what was asked and what he answered, not a proposal.

| §2.4 question | Sam's ruling | Where it lives |
|---|---|---|
| How many nights, how weighted? | **The last 3**, rolling | `TEAM_NIGHT_WINDOW`, `rules/teamNightSize.ts` |
| What if they never answer? | **The seed persists, never decays** | `deriveTeamNightSize`, source `onboarding_seed` |
| Next day or next week? | **Next WEEK, never next day** — the readiness door owns today | the `weekStartISO` filter |
| §4.4 — does duration stay asked? | **NO. It stops being asked.** | removed from `ONBOARDING_STEPS` + its screen |
| The wording | **Signed as proposed** | `signedCopy`: `team_night_size_question` + 3 answers |

**One thing in the mechanism is still [MINE] and is flagged in the code:** Sam ruled the
WINDOW ("the last 3") but not the FUNCTION that turns three answers into one size. It uses
the ordinal mean, rounded — equal weight, and the only total combination (a majority vote
has no winner for {light, normal, hard}). Two hard nights and a light read as *normal*;
two hard and a normal read as *hard*. If he wants recency-weighting, `deriveTeamNightSize`
is the only thing that changes.

**NOT BUILT, deliberately: nothing consumes the derived size yet.** §2.3 lists what size
*may* influence (gym work stacked on a team night, conditioning credit, the day-before
warning) — each of those is a separate ruling, and building one now would be inventing a
mechanism Sam has not signed. The measurement exists and is correct; what it changes is
his next call. This is the estimate→measured pattern arriving in the right order: the
truth is collected before anything is allowed to act on it.

**Also recorded:** `teamTrainingIntensity` GRADUATED out of
`ONBOARDING_FIELD_DECLARATIONS`. It was declared "coach context + estimate seed, waiting on
a mechanism"; the mechanism shipped, so it has a real programming consumer and the
declaration gate correctly refused to keep calling it decorative.

---


**Sam's ruling, 2026-07-30 (2+3):**

> The onboarding `teamTrainingDuration` and `teamTrainingIntensity` answers are a
> **STARTING ASSUMPTION ONLY**. Season reality varies — some team nights hard, some
> lighter — so a static onboarding answer can never own team-night size. The
> **ESTIMATE→MEASURED** pattern applies, same as loads and the 2km TT: onboarding seeds
> the initial team-night assumption (and remains coach context); actual logged sessions
> become the truth and inform training from then on.
>
> Do NOT invent the logging mechanism. **SURVEY first**, then propose the smallest
> mechanism as a sheet for signing. Principle recorded now; wiring waits for the sheet.

**Nothing is wired.** The principle is recorded in code
(`rules/onboardingFieldInfluence.ts` declares both fields
`coach_context_and_estimate_seed`, naming this sheet as what supersedes them) and the
declaration gate requires this document to exist. No mechanism is built.

---

## §1 — THE SURVEY: what exists today

### 1.1 What the app records about a finished session

`SessionFeedback`, keyed by date in `programStore.sessionFeedback`, written through
`commitSessionOutcomeTransaction`:

| Field | What it holds |
|---|---|
| `completion` | done / partial / skipped |
| `components[]` | per-component completion for combined days, with partial and skip reasons |
| `feeling` | session effort |
| `difficulty` | RPE-style 1–10 |
| `soreness` | post-session soreness |
| `outcomeReceipt` | the transaction's receipt |

**So the app already asks the two questions team-night size needs** — how hard did that
feel, and how sore are you — and it already stores them per date through a typed
transaction with a receipt. That is the whole reason the smallest mechanism is small.

### 1.2 What it records about a TEAM night, specifically

**Nothing.** This is the finding.

- `sessionFeedbackForm.ts` contains no team-training branch.
- `feedbackAdapter.ts` and `sessionOutcomeTransaction.ts` have no team-training case.
- A team-only day resolves to a session the athlete can see, but the feedback panel is
  built around components the APP prescribed — and on a pure team night the app prescribed
  none.

So the athlete can tell us how their gym session went, every time, and cannot tell us
anything about the session that carries the most load in their week.

### 1.3 What already follows the estimate→measured pattern

Two precedents, both Sam's, and the shape is identical:

| | Estimate | Measured truth |
|---|---|---|
| **Loads** | onboarding `squatStrength`/`benchStrength` → anchor ladder → 77 ratios | logged weights on the actual rows |
| **2km TT** | onboarding `twoKmTimeTrial` → MAS | a re-tested time trial replaces it |

Both keep the onboarding answer as the SEED and let reality replace it. Neither deletes
the answer, and neither asks the athlete to re-answer an onboarding question.

---

## §2 — THE SMALLEST MECHANISM

**One question, on a surface that already exists, answered only when there is something to
answer.**

### 2.1 The proposal

> **On a team-training day, the existing session-completion flow gains ONE question:
> "How was training?" — Light / Normal / Hard.**
>
> Three options, the same three words as the Bible's own scale (`:704` — "Light =
> skills/touch, low running · Moderate = normal training · Hard = lots of running,
> sprinting, contact, match sim"). Stored as the existing `SessionFeedback` for that date,
> through the existing transaction. **No new store, no new surface, no new door.**

**What it replaces:** the onboarding answer, from the second team night onward.

**What owns team-night size after that:** a rolling read of the last N logged team nights,
derived — never stored as a second copy of the answer. The onboarding seed is used only
until there is at least one logged team night.

### 2.2 Why this is the smallest

- **It rides `SessionFeedback`**, which is already per-date, already transactional, already
  has a receipt, and already asks two adjacent questions (`feeling`, `difficulty`).
- **It adds no field to `OnboardingData`** and asks the athlete nothing at signup.
- **It needs no new law.** `:704`'s three-way scale is the answer set; the athlete is now
  answering it about a night that happened rather than about a season that has not.
- **It cannot regress the hard-day rule.** Sam ruled a team night a hard day
  unconditionally (`:119`), and that is now unconditional in code. Size is a separate
  question from hard-day status, and this mechanism only touches size.

### 2.3 What size would then influence — and what it must not

**May influence (all selection or dose, never structure):**
- how much gym work the app is willing to stack on or beside a team night;
- the conditioning credit a team night carries;
- whether the app warns before putting lower-body work the day before.

**Must NOT influence:**
- hard-day status — ruled unconditional;
- the phase tables' counts — the readiness law's boundary;
- retroactive rewriting of a week the athlete has already trained.

### 2.4 The three questions this proposal leaves open

1. **How many nights, and how does it weight them?** "The last 3" and "an exponential
   decay" are both defensible and neither is mine to pick. **[MINE]** either way — say
   which.
2. **What if they never answer?** The seed persists indefinitely, or it decays toward
   Normal. I lean **seed persists** — silence is not evidence — but it is a ruling.
3. **Does a single Hard night change the NEXT day, or only the next week?** The former is
   more responsive and the latter is more stable. The readiness door already handles "I am
   cooked today", which argues for the next WEEK here, so the two doors do not both answer
   the same question.

---

## §3 — WHAT I DELIBERATELY DID NOT PROPOSE

- **A duration question.** `teamTrainingDuration` is declared an estimate seed, but asking
  an athlete to log how long training ran is a second question for a value the app barely
  uses. If size is answered by Light/Normal/Hard, duration adds little — and one question
  is the smallest mechanism.
- **A new logging surface for team nights.** The completion flow exists; a second surface
  would be a second owner of "how did that go".
- **Any storage of the DERIVED size.** It is a rolling read over stored answers. Storing it
  would be a stored derivation, which the north star presumes wrong.
- **Backfill.** A season already trained is not the app's to re-litigate.

---

## §4 — WHAT I NEED FROM SAM

1. **Sign the one-question mechanism**, or name a different smallest one.
2. **§2.4's three open questions** — window and weighting, silence, and next-day vs
   next-week.
3. **The wording.** "How was training?" with Light / Normal / Hard is proposed copy, unsigned.
4. **Does `teamTrainingDuration` stay asked at all?** If size is measured and duration
   influences nothing (the influence map found no consumer), the honest options are: give
   it a consumer through this mechanism, or stop asking it. It is currently declared
   coach-context + estimate-seed, which is the honest state, not a resting place.
