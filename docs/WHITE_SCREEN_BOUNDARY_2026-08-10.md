# SAM'S WHITE SCREEN — BOUNDARY REPORT, 2026-08-10

**LOOP CHECK: a failure that renders as nothing at all — sighting 2 — COMPRESS.**
The first was this morning's LogBox banner over the tab bar, read as "the Profile
tab is broken". This is the second in one day, and the seat named the risk in the
same order that reported it: *"a diagnostic that used to crash and now returns
quietly could turn a loud failure into exactly this."* The compression is the
rule, not the instance: **whatever refuses must say so on the screen.**

**The unit: Sam rebuilt, the app opened white, and he could not look at slice 2.**

**STATUS: DIAGNOSED BY EXPERIMENT, FIXED, GREEN ON THE DEVICE, AND HE IS
UNBLOCKED.** `.maestro/golden/dev-launch-refusal-speaks.yaml`.

---

## BOTH OFFERED LEADS ARE REFUTED, AND THE MEASUREMENT IS CHEAP

| Lead | Verdict |
| --- | --- |
| *"The launcher hands the LAN address while the server is on localhost"* | **REFUTED.** Metro answers `packager-status:running` on **both** `127.0.0.1:8081` and `10.0.0.72:8081`; it listens on `*:8081`. The device log shows the app requesting `http://127.0.0.1:8081/.expo/.virtual-metro-entry.bundle` **nine times**, and Metro serves it — HTTP 200, 18.9 MB. |
| *"Your own change — a refusal that now returns quietly could swallow a failure"* | **REFUTED, and it was the right thing to suspect.** The device log carries **no `[DevE2E Refusal]` line at all** on a plain launch, and no `[DevE2E …]` line either: `captureAndConfigureIfRequested` returns before any of it when `e2eMetroUrl` is absent. The harness launch on the same binary logs all three of its lines and works. |

**THE EXPERIMENT THAT ISOLATED IT, in two runs on one binary and one world:**

- **harness launch** → seeds, boots, renders the day screen with the new
  drop-downs. Green.
- **plain launch, same world, same binary** → white.

**So it is neither the bundle nor the data nor the native diagnostic. It is the
launch path — and specifically the half that only a plain launch takes.**

---

## THE CAUSE, IN ONE SENTENCE

**In `__DEV__`, `App.tsx` mounts `RootNavigator` only after
`prepareDevE2EAppLaunch()` resolves — and that function returned a bare `false`
on failure, so the effect returned and the app rendered a root with nothing in
it, forever.**

The trigger is ordinary: a harness run leaves a dev clock receipt in storage; the
next plain launch reads a receipt with **no matching checkpoint**;
`restoreDevE2EClockBeforeHydration` throws *"DevE2EClock reload mismatch: clock
receipt has no active checkpoint."*; `prepareDevE2EAppLaunch` catches it,
publishes a marker **nothing on a plain launch is watching**, and returns `false`.

**Sam's 19:22 launch followed this terminal's 19:00 Maestro runs. He walked
straight into it.**

---

## THE FIX, AND WHY IT DOES NOT JUST MOUNT THE APP ANYWAY

**The barrier is right to refuse.** It exists so store hydration cannot begin
before the development clock is restored; mounting past a failed restore would
hydrate the athlete's stores against the wrong clock — **a worse fault than a
blank screen, and a silent one too.**

**So the app still refuses. It just says so.**

- `prepareDevE2EAppLaunch` returns `{ ready, reason }` — the reason has to travel
  with the refusal or the screen cannot name it, and a screen that cannot name it
  is the blank screen with a border.
- `App.tsx` renders `DevLaunchRefused`: what happened, **the exact reason**, and
  a one-tap **"Clear test-harness state and start"**.
- `clearDevE2EHarnessState()` removes **only the three dev-E2E records** — clock
  receipt, checkpoint, scenario session. **The athlete's program is not touched**,
  and the screen says so in as many words.

**MEASURED, NOT ASSERTED:** the flow reproduces the white screen (seed through
the harness, then `launchApp` without it — `clearState` deliberately NOT set,
because clearing it would delete the condition under test), asserts the surface
and its reason, taps the button, and lands on `program-screen`. Green.

---

## THE INSTRUMENT THAT COULD HAVE CAUGHT THIS DID NOT EXIST

**Every source-reading cell in the chain passed while the app was white.** There
is nothing wrong with code that did not run. This is the second time today that a
whole class of failure was invisible to the chain and visible in one device run —
the first was eight Maestro flows crashing for 23 days.

`LAW-no-silent-blank-screen` is registered and **its repo-check cell is explicitly
the weaker half**; the flow is the instrument. The registry row says so.

---

## NOT COVERED

- **WHY THE CLOCK RECEIPT OUTLIVES ITS CHECKPOINT IS NOT FIXED.** The refusal is
  now visible and escapable; the underlying asymmetry — a harness run leaving a
  receipt with no checkpoint behind for the next plain launch — is **untouched**.
  It is a dev-harness persistence-ownership question and it is named, not solved.
  **Sam will hit the screen again after the next Maestro run** — he will just know
  what it is and get past it in one tap.
- **THE OTHER `return false` PATHS ARE NOT AUDITED.** `prepareDevE2EAppLaunch` was
  the one that bit; nothing here surveys the rest of the boot for other silent
  dead ends.
- **RELEASE IS UNTOUCHED AND UNCHECKED.** The whole surface is inside `__DEV__`.
  Whether a release build can reach a blank screen by another route is not
  answered here.
- **NOTHING IS ON SAM'S PHONE.** Simulator only. He has not yet seen slice 2 with
  his own eyes, which is the thing that started this.
- **`test:bible` WAS NOT RUN END TO END** — red on purpose, stops at the first
  failing suite. `test:repo-law-guards` and `test:law-registry` were run by name,
  plus three device flows.
