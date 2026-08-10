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

**WHAT ACTUALLY BLOCKS IT: one unhandled iOS system dialog.**

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
