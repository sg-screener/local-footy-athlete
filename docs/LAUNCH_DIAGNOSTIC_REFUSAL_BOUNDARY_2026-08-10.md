# A DEV DIAGNOSTIC MAY NO LONGER KILL THE APP — BOUNDARY REPORT, 2026-08-10

**LOOP CHECK: a hard stop on the launch path costing a debugging cycle —
sighting 3 — COMPRESS.** The order's own words name the count: *"that is the
third sighting of this exact shape today (the missing purpose, the deep-link
dialog, now the URL), and each time the answer was 'fix the instance'."* The
alternative required at sighting 2 by `LAW-second-wall` was never put on the
table, so the compression is taken now and it is the class, not the instance:
**the ten hard stops are gone and a guard forbids their return.**

**The unit: the order's actual instruction — census every `fatalError` /
`assert` / `precondition` on the launch path, say how many, and replace the class
with a refusal a flow can SEE.**

**STATUS: BUILT AND GUARDED. NEVER RUN — it is native code and needs the rebuild
Sam already owes.**

---

## FIRST, THE ATTRIBUTION, BECAUSE THE ORDER SAID READ THE STACK

**The 18:56 crash Sam sent is this terminal's own bad command, not a second app
defect and not a regression from the launch-purpose fix.**

| Evidence | Value |
| --- | --- |
| Report | `LocalFootyAthlete-2026-08-10-185648.ips`, captured **18:56:45.1085 +1000** |
| This session's failing run | `~/.maestro/tests/2026-08-10_185641` |
| What was run | `maestro test .maestro/golden/day-week-profile.yaml` — **directly, not through `scripts/dev-e2e/run-maestro-ios.sh`** |
| Consequence | the runner's `-e "E2E_METRO_URL=…"` binding was never supplied, so the app was launched with the **literal string `${E2E_METRO_URL}`** |
| Result | `validatedMetroURL(_:)` did exactly what it was written to do |

**The seat's lead was that two different Metro URLs were in play
(`10.0.0.72:8081` from the build vs `127.0.0.1:8081` from the flows). Measured:
that is not it.** Three subsequent runs through the runner at `127.0.0.1:8081`
produced no crash report at all, and the walk plus a new flow both went green.

**THE ORDER STILL STANDS AND IS WHY THIS UNIT EXISTS.** An input mistake outside
the app should not be answered with a dead process.

---

## THE CENSUS, AS ASKED

**TEN hard `fatalError`s**, all in
`ios/LocalFootyAthlete/DevE2ELaunchDiagnostic.swift`, all reachable from
`didFinishLaunchingWithOptions` — lines 81, 95, 102, 120, 127, 164, 207, 234,
242, 257. **No `assert`, `precondition` or `assertionFailure` anywhere in
`ios/LocalFootyAthlete/`.** `AppDelegate.swift` and the bridge `.m` carry none.

**Three of the ten have each cost a debugging cycle:**

1. **the missing launch purpose** — read as "the rig is dead" for 23 days;
2. **the resolved-bundle trap** — behind every reload flow;
3. **the Metro URL** — today, above.

**Every one of the three was an INPUT mistake outside the app.** None was a
defect in the thing the diagnostic exists to check.

**The count is now ZERO.**

---

## WHAT REPLACED THEM

**`refuse(code, detail)`:** `NSLog` for the human, a typed code appended for the
machine, and the app boots. Ten sites, ten codes: `seed-id-malformed`,
`launch-purpose-invalid`, `bundle-identifier-missing`, `metro-url-invalid`,
`metro-url-not-canonical`, `bundle-url-unresolved`, `resolved-bundle-conflict`,
`receipt-serialization-failed`, `build-identity-invalid`,
`resolved-bundle-server-missing`.

**FAIL CLOSED IS KEPT; FAIL DEAD IS NOT — and those are different properties.** A
refusal still stops the diagnostic dead: no receipt is written, no seed id
reaches JS, no Metro override is installed. So a run **cannot** go green having
tested an empty world, which is the property the seed channel's `fatalError` was
actually protecting. The registry row for `LAW-seed-channel-is-first-class` is
re-worded to say so, and its cell is re-aimed rather than deleted.

**THE REFUSAL REACHES A FLOW, OR IT IS JUST A QUIETER CRASH.** The codes ride the
constants bridge — the one channel measured to reach JS — and
`devE2EEntry.installDevE2EEntry` publishes them through
`setDevE2EExplorerLaunchError`, so they surface as
**`e2e-explorer-launch-error-<code>`**. **Through the EXISTING marker family, not
a new one:** that marker already means "the launch diagnostic refused, here is
why", and a second family for one fact is a second representation.

**PUBLISHED BEFORE HYDRATION**, so the first marker up names the CAUSE rather
than a consequence of it. A cell asserts that ordering.

---

## WHAT CAUGHT WHAT

- **The seed-channel gate went red on this change and was RIGHT to.** Its
  fail-closed proof was the literal `fatalError(…Invalid…)`. Re-aimed to the
  property: the malformed branch **records a refusal AND returns**. A new liveness
  probe covers the failure mode the re-aim CREATED — a refusal that carries on,
  which would seed nothing quietly.
- **My own new ordering cell was wrong on its first run.** It searched for
  `hydrateExplorerNativeLaunchDiagnostic` and found the **import** at the top of
  the file, reporting an ordering fault that did not exist. Fixed to match the
  call site. *A scan that matches a name anywhere matches its declaration first.*
- **The crash-ban cell strips comments before scanning**, or the paragraph in
  that file explaining the ban would itself be a violation — the
  `a comment is not a shipped string` shape, from the false-RED side.

---

## THE REGISTRY

Two rows, both **BORN GUARDED** (LAW ZERO): `LAW-diagnostic-refuses-never-crashes`
and `LAW-hot-file-budget`. **72 rows, 37 guarded, 35 UNENFORCED** — the unguarded
count FELL, which is the only direction Sam allows.

---

## NOT COVERED

- **NO REFUSAL HAS EVER FIRED.** This is Swift on the launch path; it does not
  exist in the running app until `npx expo run:ios --configuration Debug`. The
  simulator that went green tonight is running the OLD native binary with the new
  JavaScript. **The one thing this unit is about is unproven on any device.**
- **THE JS HALF IS UNPROVEN TOO**, for the same reason: no native build emits
  `launchRefusalCodes` yet, so `publishNativeLaunchRefusals` has never had a
  non-empty array. It is checked by source-reading cells only.
- **NO FLOW ASSERTS A REFUSAL MARKER YET.** The marker family exists and the
  publisher is wired, but no `.maestro` flow deliberately launches with a bad
  input to prove the refusal is visible. That flow is the natural next act and it
  is cheap — **it needs the rebuild first, so it is not written blind.**
- **`~/.maestro` AND THE RUNNER ARE UNCHANGED.** The invocation mistake that
  caused tonight's crash is still possible; nothing stops a future terminal
  running `maestro test` directly. **A guard on the invocation was considered and
  not built** — the refusal makes the mistake self-describing, which is the
  cheaper half, and the runner script already refuses without `E2E_METRO_URL`.
- **THE OTHER `fatalError`s IN THE REPO ARE NOT AUDITED.** The census is
  `ios/LocalFootyAthlete/` — the launch path the order named. `ios/Pods` and the
  two `.claude/worktrees` copies are untouched and out of scope.
- **`test:bible` WAS NOT RUN END TO END.** It is red on purpose and stops at the
  first failing suite. `test:repo-law-guards` (27 passed) and `test:law-registry`
  were run by name.
- **ONE PRE-EXISTING RED IS STILL THERE AND IS NOT THIS UNIT'S** — a queue order
  using "supersedes" descriptively with no quote, verified red at `HEAD` before
  any of tonight's work.
