# THE MAESTRO RIG IS NOT DEAD — MEASURED, WITH THE NUMBER SAM ASKED FOR

**LOOP CHECK:** `instrument-declared-dead-without-being-run` — **sighting 1**, and
it is a new shape worth naming: the rig has been carried as an OPEN BLOCKER in
every report since 18 July on the strength of a crash signature, and **nobody ran
it again after the thing that caused the crash was fixed.** Disposition:
**iterate** — one sighting, and the compression (run the instrument before
reporting it dead) is already `LAW-instrumentation-alive`, which is UNENFORCED.

The seat's order: *"Do not defend the tool; measure it."* This is the measurement.

## SAM'S NUMBER

He asked because he remembers the old rig eating his laptop for forty minutes.

| | |
|---|---|
| **Wall clock, one flow, already-built simulator** | **20–26 seconds** |
| runs measured | 3 (26s, 20s, 26s) |
| rebuild needed? | **No.** The installed binary was reused every time. |
| **Does it take over his screen?** | **YES.** The Simulator window comes to the front and the app relaunches. |

**It is not forty minutes. It is under half a minute per flow**, and the
expensive part — the native build — was already done. His memory was of the
BUILD, not the run, and the seat's prediction that the build is the expensive
part is **confirmed by measurement rather than asserted.**

The screen takeover is real and is the honest cost: an automated run-through
cannot run silently in the background on the machine he is using.

## THE BLOCKER IS NOT WHAT EVERY REPORT SINCE 18 JULY HAS SAID

**The `Cannot find native module 'ExpoPushTokenManager'` crash is GONE.** Sam's
rebuild fixed it. Measured, not assumed:

- the app **launches** (`Launch app ... COMPLETED`),
- Metro **serves it** (`packager-status:running`, Debug build, no `main.jsbundle`),
- the app **renders** — the onboarding welcome screen draws in full,
- the **dev markers render** — the status line *"answers 0 · snapshot none ·
  revision 0 · mirror refusals 0 · actions 5"* is on screen, which is
  `DevE2EStatusMarkers` doing its job.

## ✅ RESOLVED ENOUGH TO ACT ON — THE SEAT'S HYPOTHESIS IS CONFIRMED, AND HALF THE FLOW IS GREEN

**THE FIRST GREEN STEP IN TWENTY-THREE DAYS.** With the stale dialog cleared
first, a cold launch finds `e2e-entry-ready`:

```
Run flow when "Cancel" is visible... → Tap on "Cancel"... COMPLETED
Launch app with clear state... COMPLETED
Assert that id: e2e-entry-ready is visible... COMPLETED      ← 11 seconds
```

**The app was never the problem and the markers were never the problem.**

### THE MEASUREMENT THAT SETTLED IT — A HIERARCHY DUMP, NOT A SCREENSHOT

`maestro hierarchy` with the dialog up returns **972 lines containing the dialog,
Safari's chrome and the status bar — and ZERO app content.** Not "the markers are
missing": *nothing* of the app is in the tree.

| what Maestro can see | |
|---|---|
| `"Open in "Local Footy Athlete"?"`, `"Open"`, `"Cancel"` | the dialog |
| `"Mobile"`, scroll bars, `"100% battery power"` | Safari chrome + status bar |
| any `e2e-` marker | **0** |
| any app text (`BUILT FOR FOOTY`, `Build My Program`) | **0** |

**MY OWN SECOND CANDIDATE IS REFUTED BY THE SAME DUMP.** I proposed the markers
might be below Maestro's visibility threshold — 1×1 views at `opacity: 0.01`
(`devE2EEntry.tsx:325-334`). **False**: no app content of any kind is in the
tree, so nothing about the markers' size explains it, and they are found the
moment the dialog is gone. Written down rather than dropped.

**AND THE DIALOG SURVIVES `simctl terminate` of the app** — it belongs to Safari,
not to us, which is why answering it inside the app's flow never settled it.

### THE SEAT'S HYPOTHESIS: CONFIRMED IN SUBSTANCE

Its words: *"the dialog is a symptom of the mechanism, not a stray prompt"* —
`openLink: "localfootyathlete://…"` routes through the system, which raises it.
**Confirmed.** The dialog only ever appears after a flow uses `openLink`, it
belongs to Safari, and it blanks the app from the tree while it is up.

### THE TWO OPTIONS, PRICED — AND THE CHEAP ONE IS MEASURED, NOT ASSUMED

`LAW-elegant-two-options` (standing) requires both before coding.

**(A) Answer the dialog at each call site.** *Tested, three runs.* **Flaky:** one
run got past the tap to the seed assert, one stalled in the `when: visible`
block, one had `openLink` itself fail — exit 1 at 12s. It is also six call sites
(`reset-seed`, `reset-scenario`, `checkpoint-and-reload`, `run-explorer-scenario`,
and two scenario-checkpoint flows), i.e. a workaround repeated per flow.

**(B) Seed through a LAUNCH ARGUMENT, beside the two that already work.** The app
already reads `e2eMetroUrl` and `e2eLaunchPurpose` from `UserDefaults`
(`DevE2ELaunchDiagnostic.swift:30-31`). Adding a seed id there and calling the
same `coordinator.reset(seedId)` the URL route already calls
(`devE2EEntry.tsx:215`) **removes the URL scheme, Safari and the dialog from the
path together** — one owner, no per-flow workaround.

**(B) WINS ON BOTH AXES**, which is unusual and worth stating: it is the more
elegant shape *and* the more reliable one by measurement. (A) is not merely
inelegant, it is flaky.

### NOT COVERED — NO COMPLETE RUN-THROUGH YET

**Half the flow is green, not the flow.** Launch + `e2e-entry-ready` completes
reliably; everything past `openLink` does not. **No athlete run-through has
finished**, so every claim waiting on one still waits: the world matrix, the
chain split, Sam's Monday arm.

## ⚠ CORRECTION, 2026-08-10 — THE DIALOG IS NOT THE BLOCKER, AND I TOLD SAM IT WAS

**The claim below — that one unhandled dialog is "the whole distance" to a
working run-through — is WITHDRAWN. It was tested and it is false.**

A probe answered the dialog (`runFlow when: visible: "Open"` → `tapOn: "Open"`,
which Maestro reported COMPLETED) and **`e2e-entry-ready` still did not appear.**
The failure screenshot shows the dialog back on screen after the tap.

**Two things I got wrong in one sentence:** I inferred causation from a
screenshot — the dialog was ON TOP of the failure, so I called it the cause —
and I put a work estimate on it ("minutes of work") that nothing supported.
**Sighting 2 of `a theory that explains the screenshot is not a measured cause`**
within one day; the first was the team-anchor absorb, which turned out not to be
Sam's shape at all. **The seat had warned about exactly this in the same batch:
*"a theory that explains everything is the kind this project has been wrong about
twice this week."* It was wrong again inside the hour.**

**WHAT IS ACTUALLY KNOWN, AND IT IS LESS THAN I SAID:**

- the rig RUNS and the app renders — that part stands and is measured;
- the number (20–26s) stands, and is now 30s for the dialog-answering probe;
- **the dialog RE-APPEARS after being answered**, which is a new fact and
  suggests something re-issues the deep link rather than a stale alert;
- **why `e2e-entry-ready` is not visible is OPEN-UNKNOWN.** Two candidates,
  neither tested: the system alert owns the accessibility hierarchy so Maestro
  never sees the app's tree at all; or the markers — 1×1 views at `opacity: 0.01`
  (`devE2EEntry.tsx:330`) — are below what Maestro counts as visible.

**Attempts stopped here rather than continuing.** Three probes, no green run, and
the next step is a hierarchy dump rather than a fourth guess.

## THE ORIGINAL (WITHDRAWN) CLAIM, KEPT SO THE CORRECTION HAS ITS SUBJECT

**~~WHAT ACTUALLY BLOCKS IT: one unhandled iOS system dialog.~~**

> **Open in "Local Footy Athlete"?**  ·  Cancel  ·  Open

It sits on top of the rendered app in the failure screenshot of every run. An
iOS system alert owns the view hierarchy while it is up, so
`extendedWaitUntil: e2e-entry-ready` cannot see a marker that may well be
rendered underneath it. **No flow in `.maestro/` dismisses or accepts it.**

That is the whole distance between this repo and an automated athlete
run-through: **a confirmation dialog nobody answers.** It has been read as "the
rig is dead" for twenty-three days.

## A HYPOTHESIS RAISED AND REFUTED IN THE SAME PASS

The launch log prints `e2eMetroUrl=${E2E_METRO_URL}` — an unsubstituted
template. The obvious reading is that `runFlow` does not forward the parent's
`-e` environment into `reset-seed.yaml`, which passes only `SEED_ID`.

**Refuted by probe.** A flow with NO nesting at all, run through
`scripts/dev-e2e/run-maestro-ios.sh` with `E2E_METRO_URL` set, prints the same
literal — and the app loads from Metro regardless and renders. So the printed
template is Maestro echoing the raw command, and the substitution is not the
defect. **Recorded because it was the first thing that looked wrong, and a
plausible cause left unrefuted becomes next week's received wisdom.**

## AND ONE ERROR OF MINE, IN THE OPEN

The first run invoked `maestro test` directly, bypassing
`scripts/dev-e2e/run-maestro-ios.sh` — the repo's own runner, which requires
`E2E_METRO_URL`, validates its shape, and checks Metro is actually up before
spending a second on the simulator. **The runner existed and I did not use it.**
The number above comes from runs through the runner.

## NOT COVERED

**The flow still fails**, so no athlete run-through has completed and nothing
below the dialog has been verified. Whether `e2e-entry-ready` is rendered
underneath the alert is **OPEN-UNKNOWN** — it is *likely*, because its sibling
markers are visible, and likely is not measured. The keyboard matrix has still
never run. **The dialog's origin is not established**: it may be the dev URL
ingress, Maestro's own launch mechanism, or a system alert persisting across
launches from an earlier run. **Naming its cause is the next act, and it is
small.**
