# L2 report — onboarding never silently substitutes DEFAULT_PROGRAM (2026-07-25)

Merged to `main` `--no-ff` as `2c460a3`.
Branch: `fix/onboarding-honest-generation-failure` (`f30c868`, `6f78a80`).

Ruling executed: Sam, 2026-07-25 — the silent-fallback path is retired per the
honest-actions law (L6).

---

## What shipped

**1 + 2. Honest, reason-specific failure copy; the dead check fixed.**
New owner `src/utils/onboardingGenerationOutcome.ts` classifies a typed
`ProgramGenError` into athlete copy + retryability, and applies the one approved
retry policy. `CompleteScreen` now renders that outcome and never elects a
different program.

- The dead `err?.name === 'OverloadError'` branch is gone (generation only ever
  throws `ProgramGenError`; `OverloadError` is assigned solely in `CoachScreen`).
- The overload copy and the cueless-refusal copy are **reachable in onboarding
  for the first time**.
- The *"could not be saved"* string survives in exactly one place and can now
  only mean a genuine install failure — a generation failure can no longer
  produce it.
- **Approved automatic retry:** exactly one, and only for `network` /
  `server_outage` / `overloaded`. `bad_response` is deliberately excluded even
  though it is flagged retryable — it carries the cueless refusal, and silently
  re-rolling a contract violation would hide it. The athlete still gets a manual
  Try Again; the decision is just theirs.
- Try Again is gated on `canRetry`, so a non-retryable auth/config failure no
  longer offers a retry that cannot work.
- `useHomeScreen`'s private `classifyRebuildError` closure folded into the same
  owner — one answer to "generation failed, what do we say", not two.

**4. `trainingLocation` TypeError — checked, NOT live, locked instead of guarded.**
No guard added, per the ruling's "guard if live" condition. It is not live:
`trainingLocation` is a `PROFILE_DEFAULT_REQUIRED_FIELD` the store guarantees
(`'Commercial gym'`), no onboarding step collects it, the type has only ever had
its four values (single commit in history), and no product writer assigns a free
string. **Confirmed on device** — no equipment/location screen appears anywhere in
the 18-step flow. Locked with tests so a fifth location cannot ship without a
modality entry, and so the finding resurfaces if a step ever starts collecting it.

**5. Substitution ladder deferred** — `docs/DEFERRED_VOCABULARY_SUBSTITUTION_LADDER.md`,
with four explicit re-open triggers and the design constraint if it is ever built
(slot identity from `planEntry.strengthPattern`, never from parsing the offending
name — `classifyPoolSlot` returns `null` for exactly the names needing substitution).

**7-question reassessment** written and merged:
`docs/ONBOARDING_GENERATION_OWNERSHIP_REASSESSMENT_2026-07-25.md`.

---

## 3. RESOLVED (2026-07-26) — ruled (b), shipped, with one scope caveat

Sam ruled **(b): fail fast at the accept boundary with a typed error naming the
cause. No silent rebuilds on the accept path.** Shipped as `2a71841`.

`AcceptedProgramContractMissingError` refuses a program whose microcycles carry
neither `exposureContractV2` nor a legacy `exposureContract`, **before anything is
installed**. It names the offending week start and carries a typed `code`
(`accepted_program_contract_missing`) for pipeline-stage classification. Tests
(`npm run test:accept-boundary-contract`, 9 assertions, wired into `test:bible`)
assert the refusal fires, names the cause, leaves no trace in accepted state, and
fires before any game day is marked — plus a negative control so the gate can
never widen onto healthy programs.

**Scope caveat, stated plainly.** The assertion sits on the **onboarding install
path** (`seedOnboardingProgram`), not on every `setCurrentProgram`. That covers the
athlete-facing blocker completely. Putting it on the store-wide accept boundary is
the fuller reading of the ruling but is **not a small follow-up**: the slice-4
bible fixtures (`pathMicrocycle` / `pathProgram`) seed deliberately bare structural
programs through `setCurrentProgram`, so the store-wide gate refuses them
correctly. Making those fixtures representative means giving them real contracts,
which then have to satisfy `validateLiveProgramWrite` — i.e. rebuilding their week
model. Two attempts at that drifted into fixture-fitting and were reverted rather
than pushed. **Open question for a future unit:** fund the slice-4 fixture rework,
then move the assertion into `canonicaliseAcceptedBoundaryState`.

The original blocked analysis is kept below for the record.

### Original blocked analysis (2026-07-25)

This is the one ruling item I did not deliver. I reverted it rather than force it,
and it needs your decision.

**What I tried, and what the evidence said:**

| Attempt | Result |
|---|---|
| Mint via the hydration canonicaliser | **test:bible EXIT=1** — `Section18WeekAcceptanceError` (`required_minimum_shortfall`). Hydration's minting runs the §18 acceptance *gateway*, which rejects weeks outright. |
| Derive the contract only, no safety, no gateway | `AcceptedStateLedgerMismatchError: maximum_breach` — a raw legacy week does not fit the contract it just acquired. |
| Derive + safety finalisation, still no gateway | `maximum_breach` again. |

Three attempts, so I stopped per the stop-patching rule rather than try a fourth.

**Why it cannot simply be done:** hydration's minting only survives because it can
hand `requireSection18AcceptedWeek` a `regenerate` / `safeFallback` candidate built
from a profile — i.e. it can **rebuild the week**. That is structural migration, not
minting. For a genuinely legacy-shaped program, "mint the contract like hydration
does" is not separable from "rebuild the week like hydration does".

**Your call.** Two coherent options:

- **(a) Mint + rebuild on the accept path** — literally what the ruling asked, but
  it puts week rebuilding on every `setCurrentProgram`, and the bible fixture that
  broke has no profile to rebuild from.
- **(b) Fail fast at the accept boundary** — refuse a program with no mintable
  contract *there*, with a typed error naming the cause, instead of letting it
  install and detonate later at `setGameDay`. Simpler, adds no repair machinery,
  and matches the honest-actions law. My recommendation.

Note the primary blocker is fixed either way: onboarding no longer installs
`DEFAULT_PROGRAM` at all, so nothing currently reaches the broken path. This item
is defence-in-depth, not the blocker.

Reproduction kept: `scripts/probe-default-program-seed.ts`,
`scripts/probe-fallback-blast-radius.ts`.

---

## Gates

- `npm run test:bible` — **EXIT=0**, 0 failures (includes the new
  `test:onboarding-generation-outcome`, 45 assertions).
- `npm run test:compile` — **PASSED**, no file regressed. Product errors
  **39 → 38** (one fewer than baseline; the change removed one).
- New suite wired into `test:bible`.

## Simulator verification (both paths, real onboarding, L3 cold start)

`clearState` → full 18-step onboarding by hand each time. Profile: Inside mid,
stay injury-free, 184/90, In-season, **Saturday** game day, Tue/Thu team training,
5 training days.

- **Happy path** — real generation against the live edge function → "YOUR PROGRAM
  IS READY" → home screen showing a real week (Lower Body Strength, Upper Pull +
  Team Training, Rest, Upper Push + Team Training, Gunshow, Game Day, Recovery).
  This is the exact configuration (a concrete Saturday game day) that previously
  detonated whenever generation hiccupped.
- **Failure path** — generation endpoint pointed at an unreachable host,
  `.env` restored afterwards and verified byte-identical. Athlete sees
  **"SOMETHING WENT WRONG / Couldn't reach the server. Check your connection and
  try again."** plus **Try Again**. No program installed. Metro log confirms
  `attempt 1` then `attempt 2`, both `kind: "network"` — the single automatic
  retry fired, then surfaced honestly. Under the old code this was the
  "could not be saved" dead end.

---

## NOT COVERED (L2)

- **Sam's physical iPhone.** Simulator only. **L10: this is not done until you
  verify it on your phone.** Both paths above are the ones to re-run.
- **The store-wide accept boundary.** Item 3 shipped on the onboarding install
  path only; `setCurrentProgram` at large is still unguarded, pending the slice-4
  bible fixture rework described above. Every other caller of `setCurrentProgram`
  (coach edits, rebuilds, hydration) can still accept a contractless program and
  fail later — unchanged from before this unit, but now explicitly known.
- **The fail-fast on device.** Item 3's refusal is unit-tested only; it was not
  driven on the simulator, because onboarding can no longer produce a contractless
  program to trigger it (the fallback that did is gone).
- **The original device transient.** Still not reproduced — the edge function was
  healthy for all 21 live generations. Which transient hit your device (network,
  cold start, provider overload) remains unknown. It no longer matters for the
  athlete's experience, but the `[ProgramGen]` diagnostic is worth capturing if it
  recurs.
- **Failure kinds other than `network` on device.** `overloaded`, `unauthorized`,
  and the cueless refusal are covered by unit tests and are now reachable by
  construction, but only `network` was driven end to end on the simulator.
- **Your Metro process was restarted.** You had `expo run:ios --device
  --configuration Release` (PID 6194) running; I stopped it to reload env and
  restarted as plain `npx expo start`. **Re-run your original command if you need
  the device build** — Metro itself is up and serving the restored `.env`.
- **A copy change on the rebuild surface (L7, your gate).** Folding the two
  classifiers means an *untyped* rebuild failure now reads "Something went wrong
  building your program. Please try again." instead of "Something went wrong.
  Please try again." Typed failures are unchanged. Flagging it because copy is
  yours to sign off.
- **`DEFAULT_PROGRAM`'s programming content** post Phase 1.6 purge. It carries no
  cueless strength cards (checked); its programming was not reviewed. It remains
  the dev/E2E fixture — only its use as a silent production substitute is retired.
- **The "Varies" game-day latent fault.** A contractless program installs cleanly
  when no concrete game day is set; where it first throws downstream was not
  traced. Related to blocked item 3.
- **Other onboarding entry points.** Only the Complete screen's generation path
  was changed. Deep links, back-stack jumps and the profile-incomplete refusal
  were left exactly as they were.
- **Load/perf, accessibility, and any non-onboarding surface.** Untouched and
  unexamined.
