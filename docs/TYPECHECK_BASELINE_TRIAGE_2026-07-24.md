# Typecheck Baseline Triage — 2026-07-24

Read-only triage. No code was changed. All commands below are reproducible; no
scratch files were left in the repo (temp `tsconfig.*.json` files used during
this triage were deleted after use).

## 1. What `npm run typecheck` actually checks today

```json
// tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {},
  "files": ["App.tsx"],
  "exclude": ["node_modules", "supabase/functions", "src/__tests__"]
}
```

`"files": ["App.tsx"]` overrides `include` entirely — TS only type-checks
`App.tsx` and whatever it transitively imports **that TS chooses to resolve
eagerly**, which in practice is nowhere near the full `src/` tree (most
imports are type-only or resolved lazily enough that broken files elsewhere
never surface). `npm run test:compile` runs the identical `tsc --noEmit`
against the identical `tsconfig.json`, so it is not a distinct, stronger
gate — it's the same weak gate under a second name.

**Nothing in CI or `npm test` currently type-checks the bulk of `src/`.**

## 2. Reproducing the full-source run

```bash
cat > tsconfig.fullsrc.json <<'EOF'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {},
  "include": ["App.tsx", "src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "supabase/functions", "src/__tests__"]
}
EOF
npx tsc --noEmit --project tsconfig.fullsrc.json
```

| Scope | Command variant | Error count |
|---|---|---|
| Product `src/` only (excl. `src/__tests__`) | `include` as above | **136** |
| Product `src/` + `src/__tests__` | drop the `src/__tests__` exclude | **469** |
| + `supabase/functions` (Deno edge functions) | add `supabase/**/*.ts` | 588 |

The task brief cited "326 pre-existing errors" from an earlier full-src run.
I could not reproduce exactly 326 under any include/exclude combination I
tried (136 product-only, 469 with tests, 588 with edge functions). The
likely explanation is that today's branch has already shipped several fixes
since that number was taken (`41dd803`, `bec2954`, `e8442c4`, `3d5030e`,
`e9d0250` all landed today, 2026-07-24) — the error count has moved. I'm
reporting the number as measured right now, from this working tree, with the
exact reproduction commands above so it can be re-verified at any time.
`supabase/functions` runs under Deno, not this project's `tsconfig`, and
should stay excluded from a Node/RN full-src gate — it needs its own
`deno check` step if it's ever gated.

All analysis below is against the **136 product-`src/` errors** unless
labeled otherwise; test-harness errors are covered separately in §4.

## 3. Product-`src/` errors (136): categorized

Full list categorized into four buckets. Counts sum to 136.

| Bucket | Count |
|---|---|
| Real-risk product code (evidence of an actual live bug) | **60** |
| Trivially fixable (single root cause, mechanical fix) | **41** |
| Dev/E2E tooling (`__DEV__`-gated, not shipped, but real risk to device-testing reliability) | **35** |
| Dead code (unreferenced by anything that ships or runs) | 1 file, kills 1 line in the count* |

\* the dead-code finding (`screens/onboarding/index.ts`) produces exactly 1
of the 136 lines but is worth calling out because deleting it is free.

### 3a. Real-risk product code (60 errors) — three clusters, all tied to representation drift

**Cluster A — `TemporarySourceFact` union is not actually uniform (23 errors).**
Files: `HomeScreenV2.tsx`(5), `programControlActions.ts`(4),
`illnessRecoveryWeekMode.ts`(4), `coachTurnController.ts`(3),
`visibleReadinessState.ts`(3), `temporarySourceFact.ts`(3),
`lighterDayTransaction.ts`(1).

Root cause, confirmed by reading the type definitions:
`src/rules/temporarySourceFact.ts` defines `TemporarySourceFactBase<TKind>`
with `factId`, `effectiveFrom`, `effectiveUntil`, `scope`, `factKind` etc.,
and every health/schedule/equipment fact extends that base. But
`TemporarySourceFact = InjuryEpisodeV1 | NonInjuryTemporarySourceFact`
(`temporarySourceFact.ts:147`), and `InjuryEpisodeV1`
(`src/rules/injuryEpisode.ts:35`) is a **standalone interface that does not
extend `TemporarySourceFactBase`** — it has `episodeId` not `factId`,
`onsetOrReportedDate` not `effectiveFrom`/`effectiveUntil`, no `scope`, no
`factKind`. The comment on the union even says injury is "the landed injury
member of the same canonical fact set" — the intent was uniformity, the
shape isn't. Every call site that treats `TemporarySourceFact` polymorphically
(reading `.factId`, `.scope`, `.effectiveFrom`, `.factKind`) breaks the
moment an `InjuryEpisodeV1` flows through it.

This is exactly the shape of bug the repo's own `CLAUDE.md` "Coach
Architecture Escalation Rule" is written for: two representations of "a
temporary source fact" exist (base-derived vs. injury-standalone), and the
type system is the only thing currently catching the mismatch — at runtime
these are silent `undefined` reads, not throws. This cluster sits directly
under the illness/injury/readiness pipeline (`illness_recovery mode
boundary`, `Durable fact horizon Stage 1` work already in flight per
project memory). **Recommend the escalation reassessment this rule calls
for before patching any individual call site** — I have not attempted a fix,
per the read-only scope of this task.

**Cluster B — `LoggedSet`/`Workout` in-session logging references fields
that don't exist on either domain type (15 errors).**
Files: `WorkoutLoggerScreen.tsx`(4), `SetLoggerRow.tsx`(4),
`workoutService.ts`(4), `calculations.ts`(2), `useWorkoutLog.ts`(1).

`src/types/domain.ts` and `src/types/domain.d.ts` (two files defining the
same types — see note below) both declare `LoggedSet` with `actualReps`,
`actualWeightKg`, `notes` — **no `actualRpe`, no `completed`**. But the
workout-logging screens and `workoutService.ts` read/write
`set.actualRpe` and `set.completed` throughout (e.g.
`workoutService.ts:307`, `:401`; `SetLoggerRow.tsx:68,78,83`). Either the
in-session RPE/completed-toggle UI is live and has been silently writing to
fields that don't persist (or throwing at the `LoggedWorkout`/`Workout`
argument-mismatch sites — `WorkoutLoggerScreen.tsx:84`, `useWorkoutLog.ts:38`
pass a `LoggedWorkout` where a `Workout` is expected), or this screen has
been broken since the type was last narrowed and nobody has run it. Worth an
actual device check of the in-workout logging flow — I did not run the app
as part of this triage (out of scope, see NOT-COVERED).

Secondary note: `src/types/domain.d.ts` and `src/types/domain.ts` are two
separate files declaring an overlapping set of interfaces (`Workout`,
`LoggedWorkout`, `LoggedSet`, `CoachConversation`, ...). They agree today,
but a hand-maintained `.d.ts` sitting next to the real `.ts` source is a
standing drift hazard — worth confirming whether `domain.d.ts` is a stale
leftover (e.g. from before `domain.ts` existed) that should be deleted.

**Cluster C — discriminated-union narrowing failures on coach-mutation
result types (22 errors).**
Files: `fixtureMutationTransaction.ts`(3), `injuryEpisodeCommand.ts`(1),
`profileProgramTransaction.ts`(1), `coachFixtureChange.ts`(2),
`planChangeProducer.ts`(2), `weeklyCoachUpdate.ts`(2), plus the `unknown`
cluster below shares the same "generic result wrapper" family.

Spot-checked `fixtureMutationTransaction.ts:734-737`: the code **does**
guard with `if (!transaction.ok) { ... transaction.reason ... }` before
reading `.reason`/`.route`, which is the textbook-correct way to narrow
`CoachMutationTransactionResult<T>` (`ok: true |...` / `ok: false | reason,
route,...` discriminated union, `coachMutationTransaction.ts:97`). TS still
reports the properties as missing. I did not fully resolve why narrowing
fails here in the time available — it may be a generic-inference limitation
in how `runCoachMutationTransaction<T>`'s return type is inferred rather
than a true logic bug, but I can't rule out that it indicates a real
mismatch. **Flagging as needs-follow-up, not confirmed either way** — do not
treat my "60 real-risk" count as fully diagnosed for this sub-cluster the
way Clusters A and B are.

`planChangeProducer.ts:1342,1664` (`PlanChange` not assignable to
`AthleteOwnedPlanChange`, an `Extract<PlanChange, ...>` narrowing) is the
same family — a general type is handed to a call site that wants a proven
narrower subset, and the narrowing isn't happening. This is in the
"give the athlete's answers one owner" area (commit `41dd803`, today).

### 3b. Trivially fixable (41 errors) — single root cause, mechanical fix

**33 of these are one bug.** `handleSupabaseError` in
`src/services/api/supabaseClient.ts:88` declares its return type as
`{ code: string; message: string; details?: unknown }`. Every service file
(`workoutService.ts`, `programService.ts`, `scheduleService.ts`,
`coachService.ts`, `authService.ts`, `programModificationService.ts`)
declares its own local error shape wanting
`details?: Record<string, unknown>` and assigns `apiError.details`
(typed `unknown`) straight into it. Widening `details` to
`Record<string, unknown> | undefined` in the one function (or narrowing at
each call site) collapses all 33 `TS2322 "unknown is not assignable to
Record<string, unknown>"` errors to a single one-line fix. This is a
type-only mismatch — the runtime values are already objects — so it's
correctly bucketed as trivial, not real-risk.

The remaining 8: `coachService.ts` missing export
`StreamCoachMessageChunk` from `types/domain` (TS2305 — likely a rename
that didn't propagate to one import), `programService.ts` `deloadWeek` not
in `Microcycle` (TS2353, one stray field), two RN `style={[array]}` vs.
`ViewStyle` mismatches (`CurrentWeekScreen.tsx`, `MicrocycleDetailScreen.tsx`
— should be typed `StyleProp<ViewStyle>`, RN accepts the array fine at
runtime), `TodayWorkoutCard.tsx`'s `LinearGradient`/`Badge` prop-shape
mismatches (4 errors, likely an `expo-linear-gradient` version/type
mismatch or a `BadgeProps` signature that drifted), and 3 React Navigation
param-tuple mismatches (`AuthNavigator.tsx`, `WorkoutDetailScreen.tsx`,
`WorkoutLoggerScreen.tsx:146`, `ProgramListScreen.tsx`,
`CustomizeWorkoutScreen.tsx`) where a route's declared param list doesn't
match what's being pushed — these usually no-op at runtime (React Navigation
doesn't validate at runtime) but are worth a quick look since a couple
(`WorkoutDetailScreen.tsx:162` pushing to `"WorkoutLogger"`,
`WorkoutLoggerScreen.tsx:146` pushing to `"WorkoutComplete"`) target routes
that may not exist in the declared navigator param list at all, which *can*
be a real "screen doesn't navigate" bug rather than a type nuisance.

### 3c. Dev/E2E tooling (35 errors) — not shipped, but not test-only either

Files: `explorerActionBridge.ts`(12), `explorerProductionBindings.ts`(7),
`explorerCanonicalLiveHost.ts`(5), `devE2ESeedRegistry.ts`(3),
`explorerLiveEligibility.ts`(2), and one each in
`defaultDevE2ESeedCoordinator.ts`, `devE2EScenarioManifestRegistry.ts`,
`devE2EScenarioSession.ts`, `ExplorerActionIngressControl.tsx`,
`explorerRuntime.ts`, `explorerScenarioActiveTimeBudget.ts`.

Confirmed via `App.tsx`: `src/dev/e2e/devE2EEntry` is only `require()`'d
inside `if (__DEV__) { ... }` (`App.tsx:14,26,54,68`), and Metro/Expo
production builds inline `__DEV__` as `false` and dead-code-eliminate that
branch — **this code does not ship to end users.** But it is not test-only
either: it's the harness this project's own device-acceptance passes run
through (referenced repeatedly in project memory — Explorer render-witness
checks, device-commit tests). A broken Explorer harness means the *next*
device-acceptance pass silently can't be trusted, which matters given how
much of the current workflow (per `CLAUDE.md`'s Process Law and memory)
gates on device acceptance. Recommend its own gate, separate from both
"ship-blocking product code" and "test-only," see §5.

### 3d. Dead code (1 finding, worth flagging beyond its 1-line count)

`src/screens/onboarding/index.ts:2` — `export { AgeScreen } from
'./AgeScreen';` — **`AgeScreen.tsx` does not exist** in
`src/screens/onboarding/`. Confirmed the real onboarding flow
(`src/navigation/OnboardingNavigator.tsx`) imports each screen directly
(`NameScreen`, not `AgeScreen`) and never imports this barrel file at all.
Grepping the whole tree, nothing imports `AgeScreen` through the barrel
either. This barrel file is orphaned — safe to delete outright, not just
suppress. (It is imported by 4 test files —
`onboardingReliabilityTests.ts`, `keyboardConventionContractTests.ts`,
`roleBucketsTests.ts`, `onboardingColdStartTests.ts` — worth checking what
they actually pull from it before deleting, since `sucrase-node` doesn't
type-check and those tests currently run despite the broken export.)

## 4. Test-harness errors (`src/__tests__`, 333 additional errors)

I did not categorize all 333 individually — sampled the top offenders and
the error-code distribution instead:

```
104 TS2339 (property doesn't exist)
 86 TS2322 (not assignable)
 39 TS2345 (argument mismatch)
 22 TS2741 (missing required property)
 18 TS2739 (missing properties, object literal)
 16 TS2352 (conversion may be a mistake)
 14 TS2353 (unknown object-literal property)
 10 TS2820 (did-you-mean typo)
  7 TS2540 (read-only assignment)
  7 TS2367 (no-overlap comparison)
  6 other
```

Top offenders by file: `coachCommandRouterTests.ts`(33),
`coachProgramEditContractTests.ts`(21), `coachRevisionProposalTests.ts`(20),
`explorerActionIngressTests.ts`(11),
`bibleConformance/registry/mutationCatalogue.ts`(11),
`deviceExactSeed.ts`(10), `missedSessionsTests.ts`(9),
`readinessSourceFactOwnershipTests.ts`(8).

Spot-checked `coachCommandRouterTests.ts`: errors are
`Property 'date' does not exist on type 'CoachCommandTarget'`,
`Property 'fromDow'/'toDate'/'toDow'/'moveScope' does not exist on type
'CoachMutatePayload'`, repeated ~15 times across the file. These are stale
test fixtures — the file still constructs mock payloads using field names
`CoachCommandTarget`/`CoachMutatePayload` no longer have. **These are the
same kind of representation drift as Cluster A above, just visible in test
fixtures instead of production call sites** — the coach-command types moved
and the huge router test file wasn't updated.

Because every `test:*` script in `package.json` runs through
`sucrase-node` (a **transpile-only** runner — it strips types, it does not
check them), none of this currently blocks any test from running or
passing. That cuts both ways: it means test-file type errors are lower
urgency than product-code ones, but it also means a test can currently
assert against a property that always evaluates to `undefined` (e.g.
`target.date` when `CoachCommandTarget` has no `date` field) and pass
anyway if the assertion happens to tolerate `undefined`. I did not verify
whether any specific test in this pile is a false-negative in that way —
flagging the mechanism, not a confirmed instance.

## 5. ESLint: no config exists (pre-existing gap, decision needed)

```bash
$ find . -maxdepth 1 -iname ".eslintrc*"     # nothing
$ find . -maxdepth 2 -iname "eslint.config*" # nothing
$ npx tsc --version                          # 5.9.3 confirms toolchain is live
```

`package.json` has `"lint": "eslint src --ext .ts,.tsx"` but there is no
`.eslintrc*` or `eslint.config.*` anywhere in the repo, and no `eslint`
devDependency pinned that I found alongside one. Running `npm run lint`
today either errors immediately (no config found) or silently no-ops
depending on the installed ESLint major version's default-config behavior —
either way it is not currently doing anything useful. This is pre-existing,
not something this triage caused. Two ways forward, no clear default:

- **Adopt**: add a flat `eslint.config.js` (ESLint 9+) or `.eslintrc.cjs`
  scoped to this RN/Expo + TS project, wire it into CI/`test:bible`.
- **Drop**: delete the `lint` script and the implied intent, rely on `tsc`
  alone as the static-analysis gate.

Recommend deferring this decision to whoever owns CI/tooling priorities —
it's orthogonal to the typecheck-gating plan below and shouldn't block it.

## 6. Proposed wiring plan: `test:compile` → full-src gate

Goal: `npm run test:compile` type-checks all of `src/` (product code), not
just `App.tsx`'s reachable subgraph, and is added to `test:bible` (or CI)
so regressions can't land silently the way this 136-error backlog did.

**Step 1 — split the tsconfig, don't touch the App.tsx one.**
Add `tsconfig.compile.json` (the file I used for this triage, minus the
temp-file cleanup) with `include: ["App.tsx", "src/**/*.ts",
"src/**/*.tsx"]` and the same `exclude` for `node_modules` /
`supabase/functions`. Point `test:compile` at it:
`"test:compile": "tsc --noEmit --project tsconfig.compile.json"`. Leave
`typecheck` (the IDE-facing, App.tsx-only script) alone if anything depends
on its current narrow scope — otherwise consider merging the two so there's
only one meaning of "typecheck" in this repo.

**Step 2 — per-category rollout, not one big-bang fix:**

| Category | Action | Why |
|---|---|---|
| Trivial (41, mostly the `handleSupabaseError` cluster) | **Fix first**, before wiring the gate. One PR, mechanical, collapses 41→~8 distinct issues. | Free win, removes noise before baselining anything. |
| Real-risk Cluster A (`TemporarySourceFact`/`InjuryEpisodeV1`, 23) | **Do not fix inline.** Run the `CLAUDE.md` Coach Architecture Escalation Rule's 7-question reassessment first (source of truth, representation count, ownership) — this is precisely the pattern it's written to catch. | Explicit repo instruction; patching call-by-call would add exactly the guard/fallback pattern the rule prohibits. |
| Real-risk Cluster B (`LoggedSet`/`Workout`, 15) | **Verify on-device first** (does in-session RPE/completed logging actually work today?), then fix type + implementation together. | Can't tell from types alone whether this is a live break or a dead code path; device truth should drive the fix, not the type error. |
| Real-risk Cluster C (narrowing failures, 22) | **Investigate root cause** (generic inference vs. real bug) as its own small spike before deciding fix vs. suppress. | Unresolved in this triage; don't baseline-suppress something that might be a real narrowing bug without understanding it first. |
| Dev/E2E (35) | **Own gate**, e.g. `test:compile:devtools`, run in the same CI job but reported separately from product-code health. | Never ships to users, but device-acceptance passes depend on it — deserves visibility without conflating with "app is broken." |
| Dead code (1) | **Delete** `src/screens/onboarding/index.ts`'s `AgeScreen` line (or the whole barrel, after checking the 4 test imports). Zero-risk. | Confirmed unreferenced by anything that runs. |
| Test-harness (333) | **Baseline-suppress now**, fix opportunistically. A `tsc`-generated baseline (e.g. a checked-in list of "known-broken test files," or `// @ts-nocheck` only at the top of the worst offenders like `coachCommandRouterTests.ts`) keeps the gate meaningful for *new* test code without demanding an immediate 333-error fix-a-thon. Re-visit `coachCommandRouterTests.ts` specifically alongside Cluster A, since it's the same representation drift. | Tests already run untyped via `sucrase-node`; fixing types here is pure hygiene + false-negative risk reduction, not urgent correctness. |

**Step 3 — make the gate real.** Once Step 2's "fix first" categories are
clean and the rest have an explicit baseline (a file list of accepted
pre-existing errors, checked so the count can only go down, never up),
add `npm run test:compile` to the `test:bible` chain in `package.json` (it
already lists ~20 `npm run test:*` steps — one more, run first, is cheap)
and/or a CI step. A baseline file (e.g.
`scripts/typecheck-baseline.json` listing file→error-count) with a small
script that fails only if a file's count *increases* vs. the baseline is a
reasonable middle ground between "fix everything now" and "gate nothing" —
it stops new drift immediately while categories 2-4 above get worked
through on their own timeline.

## 7. Addendum (follow-up session, still 2026-07-24): Cluster C root-caused

Read-only follow-up. No code changed; `scripts/typecheck-baseline.json` was
read, not edited. This section **supersedes** §3a's "needs follow-up, not
confirmed either way" and §6's "investigate root cause... unresolved in
this triage" language for Cluster C — root cause is now resolved for all 6
files. `scripts/typecheck-baseline.json`'s `cluster-C-result-narrowing`
entry (`"owner": "UNASSIGNED... Needs a root-cause spike"`) can be updated
accordingly by whoever next touches that file; I did not edit it, per the
read-only scope of this pass.

### 7.0 Count reconciliation: it's 11 distinct errors, not 22

The baseline's `"errors": 22` for this cluster double-counts. Re-running
`tsc` fresh against each of the three live scopes
(`tsconfig.compile.json` / `.devtools.json` / `.tests.json`, all three
`extends: expo/tsconfig.base` with no compiler-option overrides — so a
shared file produces byte-identical errors in every scope that reaches it)
and filtering to the 6 cluster-C files:

| Scope | Errors in these 6 files |
|---|---|
| `product` (`tsconfig.compile.json`) | 11 |
| `tests` (`tsconfig.tests.json`) | 11 |
| `devtools` (`tsconfig.devtools.json`) | 8 |

`product`'s 11 + `tests`' 11 = 22 exactly. These are not 22 independent
bugs — they're **the same 11 source-level errors**, counted once because
`tsconfig.compile.json` reaches these files directly and a second time
because `tsconfig.tests.json`'s test files import them transitively (TS
type-checks a file's full dependency graph, not just the files an
`include` glob names directly — the same mechanism that makes `devtools`
re-surface 8 of the 11). **11 is the number that matters** — it's what
ships in the `product` scope, which is the only one that reflects athlete-
facing risk.

### 7.1 Three distinct mechanisms, not one

Root-caused by reading each guard against its type, then confirming each
mechanism with a minimal isolated `tsc` repro (kept in the scratchpad, not
the repo). All three mechanisms are **type-checker limitations on code
that is already logically correct at runtime** — none of the 11 errors
found here indicate the guards fire wrong or fail to protect anything.
That is a materially different conclusion than Cluster A (real `undefined`
reads) or Cluster B's open question (real feature, unverified on-device).

**Mechanism 1 — `strictNullChecks: false` disables narrowing on inline
truthy/falsy discriminant checks (6 of 11 errors, 3 files).**

Confirmed by isolated repro: a plain

```ts
type Result = { ok: true; value: string } | { ok: false; reason: string };
function f(r: Result) {
  if (!r.ok) { r.reason; }   // TS2339 under strictNullChecks:false
}
```

fails to narrow **only** when `strictNullChecks` is off, and only for the
truthy/falsy form (`if (!r.ok)` or `if (r.needsClarification)`) — the
equivalent `if (r.ok === false)` narrows correctly under both settings.
`expo/tsconfig.base` (which every `tsconfig.*.json` in this repo extends,
unmodified) never sets `strict` or `strictNullChecks`, so this project has
always run with `strictNullChecks: false`. Every file in this bucket uses
the `if (!x.ok)` / `if (x.needsClarification)` idiom, correctly, at a spot
where the guard is exactly what a reader would expect:

- `fixtureMutationTransaction.ts:734,736,737` — `if (!transaction.ok) { ... transaction.reason / .route }` after `await runCoachMutationTransaction<CandidateResult>(...)`, whose return type is explicitly `Promise<CoachMutationTransactionResult<T>>` (`coachMutationTransaction.ts:142`, no inference ambiguity — checked).
- `profileProgramTransaction.ts:366` — identical shape, `CoachMutationTransactionResult<AcceptedStateTransactionResult>`.
- `coachFixtureChange.ts:416,487` — different discriminant but same mechanism: `executeCoachFixtureChange` guards `if (intent.needsClarification) { return ...; }` at the top (`coachFixtureChange.ts:312`) against `FixtureChangeIntent`, a **correctly** discriminated union (`needsClarification: false` ⇒ `payload: FixtureChangePayload`; `needsClarification: true` ⇒ `payload: IncompleteFixtureClarificationPayload`, `coachIntent.ts:280-291`). The guard is right; `strictNullChecks:false` is why TS still carries `IncompleteFixtureClarificationPayload` in `payload`'s type 100 lines later at the `payload.action === 'move'` check.

**Product risk: none identified.** These are `!x.ok` / `if (x.flag)` reads
guarding a `return`/early-exit — the runtime behavior is correct JS
regardless of what the type checker can prove. The risk is indirect: with
`strictNullChecks` off, the type checker's ability to catch a **real**
missing-guard bug in this exact idiom, anywhere in the codebase, is
weakened — it can't tell a correct guard from a missing one here, so it
conservatively flags both by treating the union as unnarrowed. (Mechanism 3
below is what an undetected version of that real bug looks like.)

**Recommended fix:** mechanical, not architectural — rewrite the guard
condition from truthy/falsy form to explicit equality
(`if (transaction.ok === false)`, `if (intent.needsClarification === true)`),
confirmed by repro to narrow correctly under this project's actual
`strictNullChecks: false`. Zero runtime change, no new abstraction, does
not touch `CoachMutationTransactionResult<T>`, `FixtureChangeIntent`, or
any resolver/executor. This does **not** trip the CLAUDE.md escalation
rule — it isn't a guard, fallback, or resolver being *added*; it's an
existing correct guard's spelling being changed so the type checker can
verify it. (Project-wide `strictNullChecks: true` was not evaluated as an
alternative — flipping it is a repo-wide blast-radius change utterly out
of scope for an 11-error cluster, and would need its own reassessment.)

**Mechanism 2 — narrowing doesn't propagate through a named boolean
derived from the discriminant check (3 of 11 errors, 2 files).**

Confirmed by isolated repro, and confirmed this one is independent of
`strictNullChecks` (fails identically under `strict: true` and
`strict: false`):

```ts
type Safety = { kind: 'standard' } | { kind: 'red_flag'; reason: string };
function f(args: { command: { safety: Safety } }) {
  const isRed = args.command.safety.kind === 'red_flag';
  return isRed ? args.command.safety.reason : undefined;  // TS2339, both strict settings
}
```

TypeScript narrows a union based on the discriminant expression *actually
written in the condition*. Once that check is captured in a named boolean
and the object is re-accessed later through a fresh property-access
expression, TS does not retroactively connect the two — this holds even
though `args.command.safety` is never reassigned and the logic is sound.

- `injuryEpisodeCommand.ts:190` — `const redFlag = args.command.safety.kind === 'red_flag';` (line 167), then 23 lines later `redFlag ? args.command.safety.reason : undefined` (line 190). Same nested-chain-through-a-flag shape as the repro exactly.
- `planChangeProducer.ts:1342,1664` — `const wantsTypedSwap = args.change.kind === 'swap_category' || args.change.kind === 'swap_template'; const wantsTypedAdd = args.change.kind === 'add_category' || args.change.kind === 'add_template'; if (args.change.kind === 'move_session' || args.change.kind === 'remove_session' || wantsTypedSwap || wantsTypedAdd) { resolveAthleteMutation({ change: args.change, ... }) }` (`planChangeProducer.ts:1335-1343`). Two of the four disjuncts are direct discriminant comparisons TS can use; the other two are opaque booleans it can't map back to `kind`, so the `if` only narrows out what the direct comparisons exclude, leaving `args.change` too wide for the `AthleteOwnedPlanChange` (`Extract<PlanChange, ...>`) parameter.

**Product risk: none identified**, same reasoning as Mechanism 1 — both
booleans are computed correctly and used correctly; this is the type
checker failing to *prove* what the code already does right.

**Recommended fix:** at each site, make the discriminant check visible to
TS at the point of use instead of routing it through a named boolean —
either inline the comparison directly in the ternary/`if`
(`args.command.safety.kind === 'red_flag' ? args.command.safety.reason : undefined`),
or capture the narrowed *value* (not a boolean) once
(`const safety = args.command.safety; if (safety.kind === 'red_flag') { safety.reason }`).
For `planChangeProducer.ts`, a small named type predicate
(`function isAthleteOwnedPlanChange(c: PlanChange): c is AthleteOwnedPlanChange`)
used directly in the `if` would read better than four inlined comparisons
and is the more natural fix given `AthleteOwnedPlanChange` is already a
named type one function above. Same non-escalation reasoning as Mechanism
1: this changes how an already-correct check is *expressed*, not what it
does.

**Mechanism 3 — a real missing-case gap, currently dormant (2 of 11
errors, 1 file, both on the same line).**

`weeklyCoachUpdate.ts:150` is different in kind from the other 10: it is
not a narrowing limitation, it's TS correctly catching an incomplete
`if`-chain.

```ts
// weeklyCoachUpdate.ts:127-150
function reasonLine(c: ActiveConstraint): string {
  ...
  if (c.type === 'fatigue' && ...) { ... }
  if (c.type === 'injury') { ... return ...; }
  if (c.type === 'fatigue') { ... return ...; }
  if (c.type === 'soreness') { ... return ...; }
  if (c.type === 'schedule') { ... return ...; }
  // missed_session
  return c.sessionName ? `Missed ${c.sessionName}` : 'Missed session';
}
```

`ActiveConstraint` (`coachUpdatesStore.ts:377`) is a **7-member** union:
injury, fatigue, soreness, schedule, equipment, missed_session,
preference. The chain above handles 4 of them by name and falls through
for the rest under a comment that assumes only `missed_session` remains —
but `ActiveEquipmentConstraint` and `ActivePreferenceConstraint` are also
possible at this point and neither has a `sessionName` field. If either
ever reaches this function, `c.sessionName` is `undefined` and the reason
line silently reads **"Missed session"** for what is actually an equipment
restriction or a stated preference — a real, athlete-visible mislabel, not
a type-checker artifact.

**Product risk: dormant, not live.** `reasonLine` is only called from
`buildWeeklyCoachUpdateFromConstraints` (`weeklyCoachUpdate.ts:237`,
`constraints.map(reasonLine)`, unfiltered by type), and grepping the whole
tree for every export of `weeklyCoachUpdate.ts`
(`getUpdateCoachPrefill`, `buildWeeklyCoachUpdateFromConstraints`,
`buildSessionConstraintNote`) turns up **zero non-test callers anywhere in
`src/`**. This file is one of the 109 files in
[[unreachable-product-files]] — nothing on the path from `App.tsx` reaches
it today, so the mislabel cannot currently show up in the running app.

**Recommended fix:** replace the trailing assumption with an explicit
`c.type === 'missed_session'` check plus a final exhaustiveness assert
(`const _exhaustive: never = c;`) so a future 8th `ActiveConstraint`
variant fails the build the same way this one should have. Low priority
given dormancy — bundle it with whatever unit eventually wires
`weeklyCoachUpdate.ts` back into a reachable surface, not before. Do not
delete the file to silence this — per [[unreachable-product-files]],
retiring unreachable code is a product decision, not implied by a
typecheck finding.

### 7.2 Owner/slot recommendation

None of Cluster C needs the CLAUDE.md escalation reassessment Cluster A
does — there is no representation drift and no case of "the AI/semantic
layer understands the request correctly but a later layer reinterprets
it." Mechanisms 1 and 2 are mechanical, low-risk, same-behavior rewrites;
Mechanism 3 is a one-line real fix that only matters once its file is
reachable.

- **Mechanisms 1 + 2 (9 errors, 5 files)** — small standalone PR, no
  named unit currently owns it. `planChangeProducer.ts`'s two sites sit
  in the exact ownership boundary (`AthleteOwnedPlanChange`) that shipped
  today in `41dd803` ("give the athlete's answers one owner") — natural to
  fold into that unit's next follow-up rather than a separate slot.
  `injuryEpisodeCommand.ts` sits in the same injury/coach-command
  neighborhood as Cluster A's Option B Phase 2 work
  (`docs/DURABLE_ATHLETE_STATE_FACT_OWNERSHIP_REASSESSMENT_2026-07-24.md`)
  — worth doing alongside that unit for shared context, though it does not
  require that unit's reassessment. `fixtureMutationTransaction.ts`,
  `profileProgramTransaction.ts`, and `coachFixtureChange.ts` have no
  obvious existing owner — fine as a fresh small "typecheck narrowing
  hygiene" slot.
- **Mechanism 3 (2 errors, 1 file)** — no owner needed yet; note it
  against `weeklyCoachUpdate.ts` and revisit when/if that file is ever
  wired back into a reachable screen.

## NOT-COVERED

Per Process Law, explicitly out of scope for this triage:

- **No code was changed.** Not the 41 trivial errors, not the dead
  `AgeScreen` export, not a baseline-suppression script — all deferred to
  whoever picks up §6.
- **No device/simulator run.** Cluster B's "is in-session workout logging
  actually broken" question is stated as a hypothesis from static types
  only, not verified against the running app.
- ~~Cluster C's root cause is unresolved~~ — **resolved in §7** (follow-up
  pass, same date): three mechanisms (`strictNullChecks:false` truthy-guard
  narrowing, boolean-flag-indirection narrowing, one real dormant
  missing-case bug), all with isolated repros. What §7 itself does not
  cover: no code was changed there either (mechanical fixes described, not
  applied), and `scripts/typecheck-baseline.json`'s `owner: "UNASSIGNED"`
  field was read but not edited to reflect the new findings.
- **The 333 test-harness errors were sampled, not individually
  categorized.** The error-code distribution and top-offender list are
  real; a per-file dead/test-only/real-risk breakdown like §3 was not done
  for the test tree.
- **`supabase/functions` (Deno edge functions, 119 additional errors when
  included) was not analyzed at all** — different runtime, different
  tsconfig needs, flagged only as "exists, should get its own `deno check`
  gate eventually," not triaged.
- **ESLint config authorship was not attempted** — §5 states the gap and
  the two options; no config was written.
- **No architecture reassessment was written for Cluster A**, per the
  Escalation Rule's own requirement that the reassessment happen *before*
  further code changes — this triage stops at "here's the evidence you need
  one," not at producing it.
- **326-vs-136/469 discrepancy was not root-caused further** than "today's
  commits likely moved the number" — I did not bisect history to find the
  exact prior run that produced 326.
