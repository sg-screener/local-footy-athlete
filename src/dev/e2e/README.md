# Deterministic development E2E entry

`DevE2ESeedCoordinator` is the single reset/checkpoint protocol owner. It is a
pure coordinator with injected dependencies; `defaultDevE2ESeedCoordinator`
is the only adapter that knows about Zustand stores, AsyncStorage, the local
program builder, and `seedOnboardingProgram`.

`DevE2EClock` is the single development clock source. `App.tsx` restores its
minimal receipt and checks it against the active checkpoint before importing
`RootNavigator`, the coordinator, or persisted Zustand stores. `appDate` reads
that source only in `__DEV__`; without an active receipt it uses the real local
clock. Release never imports the coordinator and the clock refuses set,
restore, read, and clear operations when `__DEV__` is false.

The clock receipt contains only protocol version, seed ID, anchor instant,
IANA timezone, receipt creation timestamp, and a semantic fingerprint.
Checkpoint protocol v2 binds its persisted-state fingerprints to that clock
fingerprint. A missing, corrupt, unknown, or mismatched receipt fails closed
through the exact `e2e-seed-error-reason` marker.

The runtime entry accepts only these exact links:

- `localfootyathlete://e2e/reset/<allowlisted-seed-id>`
- `localfootyathlete://e2e/checkpoint/<allowlisted-seed-id>`
- `localfootyathlete://e2e/scenario/reset/<scenario-id>`
- `localfootyathlete://e2e/scenario/checkpoint/<scenario-id>/<step-id>`

Reset waits for every relevant persisted store to hydrate, clears domain
state through public APIs with ProgramStore last, clears the prior clock and
checkpoint, installs the selected seed clock before building the deterministic
accepted week, installs through the onboarding installation seam, applies owned
auxiliary state through public canonical APIs, completes onboarding, validates
typed semantic witnesses (including the clock date), and waits for persisted
semantic equality before publishing ready. Seed installation never writes
Zustand internals directly.

Checkpoint records semantic fingerprints only after persistence converges.
Cold-start validation starts the checkpoint and persisted-fingerprint reads
before awaiting hydration, so an exact receipt is selected before ProgramStore
can legitimately migrate its internal overlay envelope. It publishes reload
ready only after those durable fingerprints match, every store is hydrated,
and the hydrated state has converged back to persistence. It never calls the
seed builder, allowing Maestro to distinguish preservation from reseeding.
Comparison failures expose the exact store plus expected and actual hashes via
the `e2e-seed-error-reason` accessibility marker.

## Native Explorer launch receipt

`DevE2ELaunchDiagnosticReceiptOwner` is the sole owner of native Explorer
launch provenance. In Debug only, it captures the selected Metro URL and launch
purpose before the React factory exists, resolves the actual bundle server,
loads the build-time repository SHA and bridge version, and finalizes one
deterministically fingerprinted receipt before JavaScript boots. The bridge
exports only that canonical receipt JSON; Release compiles out both owner and
bridge.

`ExplorerNativeLaunchDiagnosticTransaction` validates the schema, bridge,
purpose, requested/resolved Metro URLs, bundle identifier, repository SHA and
fingerprint. It persists the exact native JSON and reads it back before the
launch marker can be published. Identical delivery is idempotent, conflicting
delivery in one JS lifetime is rejected, and a new native process may replace a
prior launch's durable receipt. React remounts and JS reloads therefore retain
the current native launch proof.

Campaign identity remains a separate transaction. Campaign start consumes the
active launch receipt and checks its initial-launch purpose, selected Metro and
integrated repository SHA before it can write a pending campaign receipt. The
external runner independently rejects an installed Debug app whose embedded
build identity does not match current `HEAD`, then waits for app-reported
requested/resolved Metro, build SHA, supported bridge and durable receipt
markers before delivering campaign start once.

## Scenario-session protocol V2

A scenario manifest owns one existing seed and an ordered list of action step
IDs. Reset installs that seed once and persists `dev-e2e-scenario-session-v2`
with protocol version, scenario/seed/checkpoint identity, active and prior
TraceV2 IDs, reload count, accepted and persisted semantic fingerprints, clock
fingerprint, next-action eligibility, and a clock-derived deterministic
`updatedAt`.

Explorer scenario reset first consumes the accepted
`dev-e2e-explorer-campaign-bootstrap-v1` receipt. That dev-only transaction is
the sole campaign identity owner: campaign ID, integrated repository SHA,
selected Metro URL, deterministic campaign clock receipt, status, and
deterministic acceptance time are persisted and read back before the accepted
marker is published. Scenario-session V2 validates the existing receipt; it
does not create or reinterpret campaign identity.

The first step becomes eligible only after reset hydration and persistence
converge. A checkpoint is accepted only for the manifest's expected step and
only when the active TraceV2 root is present in the unfinished trace envelope.
Non-final checkpoints persist the following step as `blocked/reload_required`.
Cold launch restores the clock before store imports, then validates the
scenario session, checkpoint, pre-hydration store fingerprints, hydrated
state, persistence convergence, and TraceV2 resume. It increments reload count,
moves the checkpointed trace from active to prior, reevaluates eligibility, and
publishes the reload and next-action markers.

The TraceV2 front door consumes the eligibility marker synchronously before a
tap or Coach action root can begin. Each later action receives a new root whose
`priorActionTraceId` links to the preceding action; no live span is treated as
surviving process death. Final checkpoints and later reloads retain
`complete/scenario_complete`. Duplicate, out-of-order, stale, corrupt, blocked,
and correlation failures publish `e2e-scenario-error-<reasonCode>`.

## Typed Explorer runtime foundation

`explorerRuntime` is the canonical coordinator for manifest-driven Explorer
scenarios. Its ownership sequence is fixed:

1. validate and hash the manifest before any reset;
2. install the declared seed exactly once and require its typed witness report;
3. evaluate current, complete eligibility witnesses and publish the exact
   intended-action marker;
4. claim that action and invoke its named production transaction through
   `explorerActionBridge`;
5. validate the production receipt against the manifest action hash, target,
   accepted revision, owner, and TraceV2 root;
6. wait for a correlated React render, run hard after-action oracles, checkpoint,
   cold reload through scenario-session V2, and run hard after-reload oracles;
7. assemble manifest, seed, action, receipt, trace, oracle, checkpoint, reload,
   and first-divergence evidence before advancing.

Explorer never mutates program state. The bridge contains one typed adapter
slot for every supported non-Coach action and names the existing production
transaction that owns each mutation. Adapters may invoke that owner and return
its typed durable outcome; they cannot publish accepted state or implement a
second mutation path. Success is derived only from `applied`, `rejected`,
`no-change`, `conflict`, or `failure` production outcomes. Reply text and UI copy
are not bridge inputs. `coach.message` remains capability-disabled.

`explorerSmokeScenarioManifests` compiles nine non-Coach scenarios (15 actions):
whole-session deletion; stacked upper-pull component deletion; fixture move;
the three-reload move/delete/restore chain; injury update/resolve; readiness
set/clear; equipment clear/reapply; session feedback; and Repeat Week/restore.
Every step requires durable reload proof and a rendered witness.

Eligibility is deliberately fail-closed. A missing collection is not treated as
an empty collection, a stale revision is not current, and an unavailable render
test ID blocks before mutation. `explorerProductionBindings` now resolves the
deterministic target, invokes the existing canonical owner once, and returns its
typed receipt. Fixture and Repeat Week restoration bind to the exact adjustment
ID returned by the manifest-declared baseline step and rehydrate that ID through
the exact prior TraceV2 chain after reload. The equipment seed installs its
canonical source fact through the existing temporary-source-fact transaction.

`explorerScenarioRunner` installs those production bindings plus the correlated
render wait around the existing runtime dependencies. The in-app render observer
waits for accepted semantic state and the exact visible session/component state,
then records the manifest control, semantic test IDs, observation ID, TraceV2
root and canonical identity. Screenshots and accessibility hierarchies are never
invented: all nine manifests preflight as executable but explicitly incomplete
until a live collector attaches both external artifact references.

Named seeds and their extra witnesses:

| Seed | Extra visible/state witness |
| --- | --- |
| `standard-in-season-week` | Saturday fixture |
| `stacked-team-training-upper-pull` | Separate Team Training and upper-pull component identities on the same Tuesday |
| `lower-body-deletion` | Monday squat-pattern session |
| `one-set-strength` | Stable exercise row prescribed for one set |
| `fixture-move` | Exact Saturday fixture, eligible Sunday rest target, and no conflicting target ownership |
| `injury-case` | Native canonical right-hamstring injury episode/source fact |
| `equipment-restriction-case` | Complete bodyweight profile + active equipment constraint |
| `feedback-progression-case` | Exact feedback source, baseline prescription, and future progression target |
| `multi-reload-fixture-chain` | Four accepted weeks, exact fixture/rest/following-Monday identities, empty source facts, empty reversible ledger, and exact accepted revision |
| `repeat-week-phase-transition` | Adjacent accepted weeks with different Section 18 phase signatures and explicit target fixture/Team Training anchors; no Repeat Week overlay is installed |
| `coach-production-replay` | Empty Coach transcript/memory/history/clarifier/proposal with stable move, injury-exposure, and feedback-progression targets |

The witness vocabulary also covers accepted-week count, Section 18
contract/phase signature, eligible target dates, fixture and component
identity, absent overlay/source-fact ownership, accepted revision,
reversible-ledger state, future progression targets, and visible
card/detail equality. Every declared witness must pass before the seed-ready
marker is published. Maestro flows live under `.maestro/common` and
`.maestro/golden`.

## Explorer Physical Evidence Bridge

The nine-flow campaign uses one development-only external-capture boundary.
The app creates and persists a strict capture request at seed reset, after
every action, and after every cold reload. Runtime advancement pauses until a
single receipt containing both the PNG and Maestro accessibility-hierarchy
hashes has been validated and durably acknowledged.

The app owns request identity, expected scenario/step/phase/trace/control/
observation identity, deterministic clock identity, receipt validation,
acknowledgement ordering, and scenario-artifact binding. Maestro owns physical
capture and file creation; the app never claims it captured either file.

Run the local harness with `E2E_METRO_URL=http://127.0.0.1:<PORT> npm run
e2e:explorer-nine:live -- --simulator <UDID> --reserved-metro-port <PORT>`.
It requires exactly one booted simulator, the explicit URL, and the separately
reserved matching campaign port, writes under
`artifacts/explorer-nine-<integrated-short-sha>/<scenario-id>/`, and enforces
the 35-minute target, 45-minute hard stop, and single whole-scenario
infrastructure retry. This bridge is not present in release entry wiring.

## Isolated Metro cold launches on iOS

Maestro must launch this debug app with an explicit Metro URL. Every Explorer
process launch delegates to `launch-explorer-app.yaml`, which passes
`E2E_METRO_URL` and the typed launch purpose as native launch arguments. The
debug AppDelegate publishes the resolved Metro server, allowing entry-ready
code to publish launch diagnostics without any campaign or deep-link identity.
Only after that launch marker does the runner send the campaign-start link.
URL ingress is installed before the asynchronous clock/coordinator barrier, so
an early campaign route is queued once and consumed after readiness.
The typed launch plan runs the literal `clear-explorer-app-state.yaml` prelude
only for the initial cold launch; every preservation purpose runs the canonical
launch flow directly, without an interpolated clear-state value.
Before React Native
creates its bridge, the debug-only AppDelegate hook validates that URL and
sets `RCTBundleURLProvider` to its scheme and host-port. It logs both the
selected server and the resolved bundle URL. The development entry compares
the native value with each later deep-link value before dispatching an Explorer
reset or run. Invalid or mismatched URLs fail loudly; release builds do not
contain the hook.

Choose any free port rather than relying on a shared default. For example,
while a competing worktree keeps port 8081:

```sh
npx expo start --localhost --port 8082
```

In another terminal, run one flow or a directory through the checked wrapper:

```sh
E2E_METRO_URL=http://127.0.0.1:8082 npm run e2e:maestro:ios -- .maestro/golden/reload-standard-week.yaml
```

The wrapper verifies the selected server's `/status` endpoint, prints the URL,
and forwards it once to Maestro. All nested reset/reload launches inherit the
same value, so no Dev Menu action or manual step is needed between flows. The
port is intentionally supplied by the caller and is never fixed in source.

## AthleteActionTraceV2

`AthleteActionTraceCoordinator` is the sole diagnostic authority for one
athlete action. Outer Coach, tap, and system doors start a root token; nested
doors create spans on that token. The token is captured explicitly before an
async persistence or render boundary, so neither FIFO order nor a returned
domain message is accepted as correlation or UI proof.

The V2 record uses `captured`, `not_applicable`, and `missing` field states.
Semantic fingerprints use the versioned `athlete-semantic-sha256-v2` contract.
Accepted revision remains separate concurrency metadata and is never part of
the semantic hash. The fingerprint includes the reversible ledger, removal
constraints, injury/source facts, active constraints, readiness, feedback,
Coach Note ownership, overlays, overrides, contracts, provenance, and typed
reductions.

`runCoachMutationTransaction` records accepted/visible/persisted before state,
the write and acknowledged readback, card/detail verification, and exact
rollback evidence for memory, ProgramStore, compatibility mirrors, and the
visible projection. A V2 success cannot finalize until a React observation and
post-reload verification also exist.

Dev E2E checkpoint V2 persists unfinished trace records. Cold-start validation
resumes the same trace IDs and attaches post-reload accepted, persisted,
visible, and Coach Note evidence. Artifact collection is pure in-app; the Node
writer materializes the required `artifacts/<campaign>/<scenarioRunId>/`
bundle and refuses incomplete bundles.
