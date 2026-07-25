# DEFERRED — vocabulary substitution ladder

**Status: deferred, low priority. Not built. Do not build without a trigger below firing.**
Deferred by Sam, 2026-07-25.

## What it is

A three-rung escalation for a generated program that carries an exercise name the
app cannot cue:

1. **Retry once with explicit correction** — tell the model which names were
   illegal and require reselection from the curated vocabulary.
2. **Deterministic slot-substitution at ingress** — replace the unresolvable
   exercise with the curated pool's entry for that slot. The athlete sees only
   Sam-curated content; the offender is logged.
3. **Hard refusal** — only when substitution is impossible. This rung already
   exists and works (`enforceCuratedCueContract` →
   `programGenErrorForCuelessCards`), and is now reachable in onboarding.

## Why it is deferred

Measured, not assumed. 21 live generations against the deployed `coach-chat`
edge function across 4 profiles (in-season/commercial, home/minimal/pre-season,
outdoor/off-season, plus save-path replays):

- **0 vocabulary refusals.**
- **100% of strength-card names were *exact* members** of the 186-name curated
  vocabulary — the canonicalisation matcher was never needed (`viaMatcher=0` in
  all 21 runs).
- One out-of-vocabulary string total (`"Foam Roll — Quad, Adductors"`), correctly
  passed as a recovery row exempt by kind.

The prompt-carried vocabulary (`958a1fc`) removed the generator's naming rights
and it is holding. Building substitution now would add machinery for a failure
mode that is not occurring, against Sam's ruling to reduce representations rather
than add guards.

Evidence: `docs/ONBOARDING_SAVE_BLOCKER_DIAGNOSIS_2026-07-25.md`.
Measurement instrument: `scripts/probe-generation-vocabulary-rate.ts`.

## Re-open triggers

Build the ladder if **any** of these fires:

1. **Any** cueless refusal reaches a real athlete on device or in production logs
   (it is now visible rather than swallowed, so this is observable).
2. A rerun of `npm run test:generation-vocabulary`-style live probing shows
   **≥1 vocabulary refusal in 20 runs** on a profile athletes actually use.
3. The curated vocabulary is materially widened or the pools are re-cut, such
   that the prompt no longer enumerates every selectable name.
4. The generation prompt stops carrying the vocabulary, or the model/provider
   behind `coach-chat` changes.

## Design constraint if it IS built

Slot identity must come from the deterministic `planEntry`
(`strengthPattern` / `strengthPatternContributions`), **not** from parsing the
offending name. `classifyPoolSlot` resolves through the pools, so it returns
`null` for exactly the names that would need substituting. The plan entry already
carries the intended pattern independently of whatever the model called it — it
is the only honest slot source of truth.

Sam's no-cueless-card and no-invented-names rulings hold under every rung.
