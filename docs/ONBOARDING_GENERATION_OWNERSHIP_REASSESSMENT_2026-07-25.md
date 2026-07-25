# Escalation reassessment — onboarding generation → save pipeline (2026-07-25)

Owed under CLAUDE.md's **Coach Architecture Escalation Rule**. The trigger that
fired: *"the AI/semantic layer understands the user correctly, but a later layer
changes, blocks, downgrades, or reinterprets that intent."* Generation produced
either a valid program or an honest typed refusal; the Complete screen discarded
both and substituted a program that could not be installed, then reported a
failure reason that was not the real one.

Evidence base: `docs/ONBOARDING_SAVE_BLOCKER_DIAGNOSIS_2026-07-25.md`.
Sam's ruling (2026-07-25): **onboarding never silently substitutes
`DEFAULT_PROGRAM`; the silent-fallback path is retired**, per the honest-actions
law (L6).

---

## 1. What is the current source of truth?

There isn't one — there are two, and the wrong one wins.

- **Intended:** `generateProgramFromProfile` returns either an accepted program or
  throws a typed `ProgramGenError` carrying `kind`, `userMessage`, `canRetry` and a
  developer `diagnostic`. That object is a complete, honest account of the outcome.
- **Actual:** `CompleteScreen.generateProgram()` treats that typed result as
  advisory. On any throw it discards the typed refusal and elects `DEFAULT_PROGRAM`
  — a static fixture with no `exposureContractV2` — as the new truth. The athlete's
  reported outcome is then determined by whether *that substitute* installs, not by
  what actually happened.

The screen is acting as a second, untyped generation authority.

## 2. How many representations of the user request exist?

Four, where one would do:

1. `OnboardingData` (the athlete's answers) — legitimate.
2. The generated `TrainingProgram` — legitimate.
3. `DEFAULT_PROGRAM`, the silent substitute — **illegitimate**. It represents no
   athlete's answers, yet it is installed under their name.
4. The failure account, which exists in two incompatible forms: the typed
   `ProgramGenError` (accurate, discarded) and the string
   `'Your program was created, but it could not be saved.'` (inaccurate, shown).

Representation 3 is the one to delete. Representation 4 collapses to one as soon as
3 is gone.

## 3. Where can intent, domain, date, target, or scope be reinterpreted?

Three seams, all inside `CompleteScreen`:

- **`CompleteScreen.tsx:305`** — `err?.name === 'OverloadError'` is dead. Generation
  only throws `ProgramGenError`; `OverloadError` is assigned solely in
  `CoachScreen.tsx:1935`. Every failure kind therefore takes the fallback branch,
  including the two that already have correct athlete copy (`overloaded`, and the
  cueless refusal from `programGenErrorForCuelessCards`).
- **`CompleteScreen.tsx:330`** — the substitution itself. Intent ("build this
  athlete's program") is silently reinterpreted as ("install the demo program").
- **`CompleteScreen.tsx:342`** — the recovery guard reads
  `pipelineError.stage === 'section18_acceptance' && program !== DEFAULT_PROGRAM`.
  Both conditions are false in the failing case, so the honest branch is unreachable
  from either direction.

A fourth, outside the screen: **`programStore.ts:743-745`**. The accepted-state
candidate path runs with `structuralMigrationRequired: false` and passes a program
through uncanonicalised, so a contractless program is *accepted* and only explodes
later, at an unrelated call site (`setGameDay`). That relocates the failure away
from its cause and is why the reported reason was wrong.

## 4. Which layer should own the decision?

- **Generation owns the outcome and its reason.** `ProgramGenError` is already the
  right type; nothing above it may invent a different reason.
- **A single pure classifier owns failure → athlete copy + retryability.** Today
  that logic exists twice: typed and correct in `useHomeScreen.classifyRebuildError`
  (a closure, unreachable from onboarding), and absent in onboarding. One shared,
  tested owner replaces both.
- **The store owns program invariants.** A program that is accepted must be
  installable. Minting the exposure contract is the store's job on *every* ingress,
  not only hydration.
- **The screen owns presentation only** — which copy, which button. It must not
  choose a different program.

## 5. What simpler architecture removes representations instead of adding guards?

```
onboarding answers
  -> generateProgramFromProfile
       -> success: install (store mints any missing contract) -> ready
       -> typed failure: classify -> honest copy + Try Again
```

That is the whole pipeline. It deletes representation 3 outright, collapses
representation 4 to one, and removes both the fallback guard and the recovery guard
rather than repairing them. No resolver, no compatibility branch, no new fallback.

The one addition Sam approved is deliberately *not* a guard: a single automatic
retry for transient `network` / `server_outage` / `overloaded` kinds, taken **before**
anything is surfaced. It does not reinterpret intent — it re-attempts the same
intent once, then reports honestly either way.

## 6. Which legacy paths should be bypassed or retired rather than patched?

- **Retire:** the silent `DEFAULT_PROGRAM` substitution in onboarding (both call
  sites), and the recovery guard that only existed to service it.
- **Retire:** the dead `OverloadError` name check.
- **Retire:** `useHomeScreen`'s private `classifyRebuildError` closure, folded into
  the shared owner so there is one classification, not two.
- **Keep:** `DEFAULT_PROGRAM` itself — it is still the dev/E2E fixture and the
  seed-registry base. Only its use as a *silent production substitute* is retired.
- **Do not patch:** the contract asymmetry is closed at the store's ingress
  (defence-in-depth), not by pre-canonicalising at each caller.

## 7. What tests prove the new ownership boundary?

1. **No silent substitution:** a generation failure of every typed kind leaves
   `currentProgram` untouched — `DEFAULT_PROGRAM` is never installed by onboarding.
2. **Reason fidelity:** each `ProgramGenError.kind` surfaces its own `userMessage`;
   specifically `overloaded` and the cueless refusal are reachable, and the string
   *"could not be saved"* is never produced by a generation failure.
3. **Retry policy:** transient kinds are retried exactly once before surfacing;
   non-transient kinds are surfaced immediately with no second call; a retry that
   succeeds installs normally and shows no error.
4. **Retryability:** `canRetry: false` (e.g. `unauthorized`) offers no Try Again.
5. **Contract invariant (defence-in-depth):** any program set through the store
   carries `exposureContractV2` on every microcycle, and a contractless program
   installed through onboarding can have a game day set without throwing.
6. **Single classifier:** the home-screen rebuild path and onboarding produce
   identical copy/retryability for the same error.

Sim verification covers both the failure path and the happy path (L4/L10).

---

## Decision requested / granted

Approved by Sam, 2026-07-25, as ruling items 1–5. The substitution ladder
(retry-with-correction → slot-substitution → hard refusal) is **deferred** — see
`docs/DEFERRED_VOCABULARY_SUBSTITUTION_LADDER.md` for its re-open trigger.
