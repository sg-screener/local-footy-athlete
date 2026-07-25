# Onboarding save blocker — diagnosis (2026-07-25)

**Status: STOP. Diagnosis only. No product code changed.**
Device symptom: fresh install → flawless onboarding → generation fails at save with
*"Your program was created, but it could not be saved. Please try again."*
Immediate retry fails identically; a later retry succeeds.

**Headline: Hypothesis A is not supported. Hypothesis B is confirmed.**
The hard acceptance-time vocabulary contract never fired — not once in 21 live
generations. The blocker is a different gate entirely, and the "coin flip" is not
in the gate: it is an upstream transient amplified into a hard stop by a fallback
path that is **100% broken** for any athlete who names a game day.

---

## 1. Which gate fires, and on what names

**Gate:** `AcceptedEffectiveWeekUnavailableError` — *"Accepted effective week
unavailable for <weekStart>: Contract v2 is missing"* —
`src/rules/acceptedEffectiveWeek.ts:100`, raised from `rebaseAcceptedEffectiveWeek`.

**On what names:** none. It is not a name gate. It fires on a **missing
`exposureContractV2`** on the installed microcycle. Zero exercise names are involved.

### The mechanism, end to end

1. Onboarding generation fails for **any** reason (network blip, edge/model
   overload, bad response — or, in principle, a vocabulary refusal).
2. `CompleteScreen.tsx:305` tests `err?.name === 'OverloadError'`. **That branch is
   dead code.** Generation only ever throws `ProgramGenError`, whose `name` is
   `'ProgramGenError'`; `OverloadError` is assigned in exactly one place in the
   repo — `CoachScreen.tsx:1935` — which the generation path never touches.
   So *every* generation failure falls through to line 330: `program = DEFAULT_PROGRAM`.
3. `DEFAULT_PROGRAM` carries **no `exposureContractV2` and no legacy
   `exposureContract`** (measured, not assumed).
4. `setCurrentProgram` → `canonicaliseAcceptedStateCandidate` →
   `canonicaliseAcceptedBoundaryState` with **`structuralMigrationRequired: false`**
   (`programStore.ts:1052`). At `programStore.ts:743-745` that flag means the program
   passes through **uncanonicalised**, so no contract is minted. The *hydration* path
   does mint one for a contractless microcycle
   (`canonicaliseHydratedMicrocycle` → `deriveContractlessLegacyContract`,
   `programStore.ts:599-605`). **This asymmetry is the root cause.**
5. `seedOnboardingProgram` then calls `setGameDay` for each computed game date
   (`onboardingCompletion.ts:136-139`) → `rebaseAcceptedEffectiveWeek` → **throws**.
6. The error carries no `code`, so `inferOnboardingPipelineStage` returns
   `accepted_state_transaction`, not `section18_acceptance`. `CompleteScreen.tsx:342`
   therefore takes the `else` branch → the athlete's copy.
   *(Both doors are closed: even if the stage had inferred as `section18_acceptance`,
   the guard `program !== DEFAULT_PROGRAM` is already false.)*

### Reproduction (deterministic, not a coin flip)

`scripts/probe-onboarding-save-path.ts` replays the Complete screen's exact save
path through the real production functions:

| Program installed | Result |
|---|---|
| Live-generated program | **SEED OK** — athlete reaches "ready" |
| `DEFAULT_PROGRAM` fallback | **THREW** at `set_game_day:2026-07-25` — *Contract v2 is missing* → the exact device copy |
| `DEFAULT_PROGRAM` after hydration canonicalisation | **SEED OK** |

The fallback failure is **date-independent** (identical for `PROBE_TODAY` =
2026-07-25 / 27 / 29 / 31), so it is not a weekday artefact.

### Blast radius (`scripts/probe-fallback-blast-radius.ts`)

| Game-day answer | Fallback seed |
|---|---|
| Saturday | **THREW** |
| Sunday | **THREW** |
| Varies | OK — but installs a **contractless program**, a latent fault for the first accepted-week read elsewhere |

Every athlete who names a concrete game day — in a football app, effectively all of
them — hits a hard stop the moment generation hiccups once.

### Why retry "fails identically" then later succeeds

The save error is 100% deterministic given the fallback. What varies is *upstream*:
whether generation succeeds at all. Retry-during-the-outage-window → same error;
retry after it clears → success. **The observed coin flip is the transient
generation-failure rate, not gate flakiness.**

---

## 2. Did the LLM ignore the prompt vocabulary, or is it a matching gap?

**Neither. The generator is complying.** The prompt-carried vocabulary
(`958a1fc`) is working as designed.

21 live generations against the deployed `coach-chat` edge function, 4 profiles:

| Profile | Runs | Vocabulary refusals | Strength-card names off-vocabulary |
|---|---|---|---|
| standard / in-season / commercial gym | 13 | 0 | 0 |
| home gym / minimal kit / pre-season | 3 | 0 | 0 |
| outdoor / off-season / no team training | 3 | 0 | 0 |
| save-path replays (standard) | 2 | 0 | 0 |
| **Total** | **21** | **0** | **0** |

Per-run detail: 23–28 distinct exercise names emitted, and in every run
**100% were *exact* members of the 186-name curated vocabulary**. The
canonicalisation matcher was never even needed (`viaMatcher=0` in all 21 runs) —
the model is selecting verbatim from the offered list, not emitting near-misses
that the matcher rescues.

**One out-of-vocabulary string was seen** in 21 runs:
`"Foam Roll — Quad, Adductors"` (home-minimal/pre-season). The program **passed**,
correctly: it is a recovery-session row, exempt **by kind** from the strength-cue
contract (`curatedCueContract.ts:34-42`). That is the designed exemption, not a
gate miss — recovery/mobility content renders as descriptive text, not a cued card.

Classifier verified against a negative control before trusting these numbers
(`scripts/probe-name-classification-check.ts`): `"Totally Made Up Movement"`
correctly reports `exact=false, hasCue=false`, while spellings like `"RDLs"` and
`"Bicep Curl (Dumbbell)"` are genuine curated entries.

**Caveat, stated plainly:** 21 runs is enough to rule out a coin-flip-rate
non-compliance (a 50% rate would have produced ~10 refusals; even a 10% rate had
~89% chance of showing at least one). It is **not** enough to prove a low
single-digit rate is zero, and it did not sample Sam's actual onboarding answers.

---

## 3. Was the approved single self-retry ever implemented?

**No. It does not exist anywhere in the repo.**

- No client-side retry wrapper around `generateProgramFromProfile` (single function,
  no retry loop; `generateProgram.ts:1161`).
- No commit implements it (`git log --all --grep=retry` → three commits, none of them this).
- No ruling document describes it — the ruling appears never to have been pasted in.
- The only retries that exist are **inside the edge function** (`coach-chat/index.ts:1439`:
  2 primary attempts → 2 fallback-model attempts), they are **overload-only**, and they
  happen **before** the response is returned. A vocabulary violation is detected
  client-side *after* the response, so those retries could never cover it.

Related dead path worth naming: because `err?.name === 'OverloadError'` never
matches, the honest athlete copy for **both** the cueless refusal
(*"Some exercises came back without coaching cues…"*) and the overload case
(*"The AI service is under heavy load right now"*) is **unreachable during
onboarding**. Both are silently replaced by the fallback, and then by the
misleading save error. The same refusal copy *does* reach the athlete on the
home-screen rebuild path (`useHomeScreen.ts` → `classifyRebuildError`) — onboarding
is the only surface that swallows it.

---

## 4. Evaluating the proposed resolution ladder against the evidence

The ladder (retry-with-correction → deterministic slot-substitution → hard refusal)
is a sound design **for the problem it targets**. The evidence says that problem is
not currently occurring, and that shipping the ladder alone would **not fix this
device blocker** — a generation that fails on the network still lands in the broken
fallback.

| Rung | Verdict against evidence |
|---|---|
| **0 (unlisted) — fix the fallback** | **This is the actual blocker.** Must ship first, independently. |
| **1 — retry once with explicit correction** | Good insurance; 0/21 observed need. Also the natural home for a retry on *transient* failures, which is what actually bit. |
| **2 — deterministic slot-substitution at ingress** | Feasible, with one caveat below. Currently unexercised. |
| **3 — hard refusal** | Already built and correct; the bug is that onboarding never lets it reach the athlete. |

**Design caveat on rung 2, if approved:** substitution must key the slot off the
deterministic `planEntry` (`strengthPattern` / `strengthPatternContributions`),
**not** off parsing the offending string. `classifyPoolSlot` resolves through the
pools, so it returns `null` for exactly the names that need substituting. The plan
entry already carries the intended pattern independently of whatever the model
called it — that is the only honest slot source of truth.

**Sam's rulings hold under all rungs**, and are not currently at risk: no cueless
card can render (the gate throws), and no invented name can survive (21/21 exact
vocabulary compliance).

### Escalation flag (CLAUDE.md)

This matches the stop-patching trigger verbatim: *"the AI/semantic layer
understands the user correctly, but a later layer changes, blocks, downgrades, or
reinterprets that intent."* Generation produces either a valid program or an honest
refusal; the Complete screen's fallback discards both and substitutes a program that
cannot be installed. **The 7-question reassessment is owed before the fallback is
recoded** — in particular Q4 (which layer owns the decision) and Q6 (which legacy
paths should be retired rather than patched). The obvious candidate question: should
onboarding have a silent `DEFAULT_PROGRAM` substitution at all, or should a
generation failure simply surface its own honest, retryable copy?

---

## 5. NOT COVERED (L2)

- **iOS simulator / physical device pass.** Not run. The repro drives the same
  production functions in-process against the live edge function; the mechanism is
  deterministic, so a sim run would add a screenshot, not information. **L4/L10 still
  apply: this is not "fixed" or "confirmed" until Sam sees it on his phone.**
- **Sam's actual onboarding answers.** The 21 runs used 4 synthetic profiles. If Sam's
  fresh-install answers differ materially, the compliance rate is unmeasured for them.
- **The original device failure itself.** I could not reproduce the *upstream*
  generation failure — the edge function was healthy for all 21 attempts. Which
  transient hit Sam's device (network, cold start, model overload) is **unknown**;
  the dev-console `[ProgramGen]` diagnostic from that run would settle it and is
  worth capturing if it recurs.
- **Whether `DEFAULT_PROGRAM` content is still appropriate** post Phase 1.6 purge.
  It carries no cueless strength cards (checked) but its programming was not reviewed.
- **The "Varies" latent fault.** Confirmed that it installs a contractless program;
  where that first throws downstream was not traced.
- **`trainingLocation` robustness.** An unrecognised location crashes generation with
  an unguarded `TypeError` (`equipmentAvailability.ts:521`,
  `LOCATION_CONDITIONING_MODALITIES[location] is not iterable`). Found via my own
  invalid fixture. Whether onboarding can *emit* an unrecognised value was **not
  checked** — if it can, this is a second onboarding crash path.
- **No fix, no test, no commit.** Per the escalation rule, stopping here for approval.

---

## Instruments (new, untracked; diagnostics not gates)

- `scripts/probe-generation-vocabulary-rate.ts` — N live generations, classifies every
  emitted name as exact-vocabulary / matcher-resolved / unresolved. `--profiles`,
  `PROBE_PROFILE`, `PROBE_TODAY`.
- `scripts/probe-onboarding-save-path.ts` — replays the Complete screen save path.
  `--force-fallback` to force the fallback branch.
- `scripts/probe-default-program-seed.ts` — the fallback's contract state, and proof it
  seeds cleanly once canonicalised.
- `scripts/probe-fallback-blast-radius.ts` — fallback outcome by game-day answer.
- `scripts/probe-name-classification-check.ts` — classifier sanity + negative control.
