# BOUNDARY — BATCHES 27+28 SIGNED, AND THE PROOF PATH (2026-08-09)

**Commit:** `b203c6af`. **Order:** SEAT_INBOX item 1, both parts.

**GATE:** full `test:bible` **UNPIPED `GATE_EXIT=1` at
`test:program-control-durable`, 1 FAIL line** — main's declared red.
`test:compile` PASSED. **Sweep 2 of 170 = the declared set exactly.**
`test:journal-reminder` **71 passed, 0 failed**. **7 mutations, 7 red** (one
genuine survivor, re-aimed — §5). Extraction ceiling **unchanged at 576**.

---

## 1. (a) THE SIGNATURE ARMS THE REMINDER

Batches 27 (the twelve month words) and 28 (the notification) are SIGNED.

**28'S SIGNATURE IS A SWITCH, NOT A RECORD — the second time today.** While it
read PROPOSED, `decideJournalReminder` returned `unsigned_copy`: nothing could be
scheduled and **no permission could be requested**. Signing it arms the feature,
with no code change. That is `signature-arms-a-dark-surface` sighting 2, after
this morning's eight constants.

**ARMING IS NOT ENABLING, AND THAT IS THE WHOLE SAFETY MARGIN.** Signing removed
*this terminal's* gate. The athlete's own opt-in tap and iOS permission both
still stand in front of every notification, and a signature cannot grant either.

### The vacuity check found a real gap — this morning's compression, used same-day

Two cells reddened on the flip and announced themselves. **The silent problem was
underneath them:** every cell in that section passes `copySigned` explicitly, so
**not one exercised the DEFAULT path** — the `??` that reads the copy module.
Deleting `isJournalReminderSentenceSigned()` from the decision left the suite
green.

**That gap predated the signing.** The signing is only what made it visible:
while the module read `proposed`, "the feature is dark" was true for a reason
nobody had tied to the wiring. Closed by mutating the copy entry at runtime and
reading the default path back — the same instrument `journalLoadTests` [2b] uses
for the constants. Mutation-proven: severing the default wiring reds it.

---

## 2. (b) WHY A 2-MINUTE FIRE IS ONLY HALF A PROOF

The notification boundary named **one** thing as most likely to be wrong: our
rule counts Sunday as 0 (`Date.getDay()`), expo's `WeeklyTriggerInput` counts
Sunday as 1, so the service passes `weekday + 1`. Both are documented. Neither
has been observed, **and no unit test can observe it — the OS performs the
conversion.**

**A NOTIFICATION FIRING IN TWO MINUTES DOES NOT TOUCH THAT.** It uses a
`TIME_INTERVAL` trigger; the weekday never enters it. Building only that would
prove the native module, the permission, the sentence and the tap — and would
leave the single flagged unknown exactly as unproven **while feeling like a
pass.** That is the shape this repo calls a green gate that lies.

**So there are two instruments, and the panel labels which proves what:**

| Button | What it actually proves |
| --- | --- |
| **1. Check the weekday conversion** | Asks the OS what date the **real weekly trigger** would next fire and names the weekday. **This is the conversion proof.** No waiting, no permission, nothing scheduled. |
| **2. Fire the real reminder in 2 minutes** | The native module works, the permission prompt appears, the sentence reads as it will, and tapping lands on the Journal tab. |

**BOTH FIRE THE REAL OBJECTS.** `journalReminderWeeklyTrigger()` and
`journalReminderContent()` are exported and read by **the scheduler and the
proof** — one owner each. A proof that built its own trigger would prove its own
trigger, and the conversion is precisely the byte a hand-written copy gets right
by accident.

---

## 3. THE GATE CHOICE, STATED BECAUSE THE ORDER ASKED

The order's test: **reachable in the build Sam actually installs, unreachable in
anything an athlete could hold** — and say so if those conflict.

**They do not conflict, and the reason is a fact rather than an assumption.** Sam
must rebuild with pods for `expo-notifications` to exist at all, and
`npx expo run:ios` produces a **Debug** build where `__DEV__` is true. An
athlete's build is Release, where the module is not bundled at all.

So: `__DEV__`, double-gated at the require and render sites — the
`ScheduleDebugPanel` convention this repo already established and already
asserts.

**ONE CONDITION, AND IT IS THE FAILURE MODE TO KNOW ABOUT:** if he builds with
`--configuration Release`, or installs through TestFlight, **the panel is simply
absent — and its absence looks identical to it being broken.** §6 gives the one
command that guarantees it appears.

**A `__DEV__` DIAGNOSTIC IS NORMALLY THE WRONG ANSWER IN THIS REPO.** AGENTS.md
records three device round trips paid for exactly that mistake. It is right here
because of *what this is*: not a diagnostic watching for a defect on a build
somebody else is running, but a bench instrument for the one person doing the
rebuilding. Nothing an athlete does can produce the evidence it collects.

---

## 4. THE UNPLANNED FINDING — AN EXCLUSION THAT WAS A LIE WAITING TO HAPPEN

`signedCopyExtractionTests` excludes **every file under `components/dev/`** from
the copy sheet, justified as *"Double-gated by `__DEV__` at require and render
sites (asserted below)"*.

**The assertion named `ScheduleDebugPanel` BY NAME.** So the moment a second dev
component arrived, its strings would have been excluded by a prefix whose
justification was not true of it — **and the cell would have gone on passing.**

That is `a green gate watching nothing` **at the seam between two gates rather
than inside one**: the exclusion and its justification lived in the same file and
still drifted apart. The set is **derived from the directory** now, so a new dev
component is gated the day it appears rather than the day somebody notices — the
same compression already applied to `SURFACE_ROOTS` and the binder's scope.

**AND THE REGEX ACCEPTS BOTH RENDER SHAPES.** `{__DEV__ && X && <X/>}` and
`{__DEV__ && X ? <X/> : null}` gate identically; a gate that knew only the first
would red on correct code, **and a false red is how a gate gets weakened by
whoever next has to make it pass.** What is still required is `__DEV__ &&`
immediately before the name.

---

## 5. P5 SURVIVED — THE SAME SHAPE AS N7, ONE COMMIT LATER

"The proof uses its own identifier, never the athlete's" asserted that the source
**mentions** `JOURNAL_REMINDER_PROOF_IDENTIFIER`. The mutation changed that
constant's **value** to the athlete's string and left the name alone. Green.

**The instrument counted a NAME; the claim was about two schedule slots being
DISTINCT.** `a count taken for a record`, and the second genuine survivor of that
exact shape in two commits — N7 counted a call site file-wide, P5 counted a name.

Now compared as **values**. They are parsed out of the source rather than
imported, because both modules pull `expo-notifications`, **which cannot load in
node at all** — which is also why every cell in that section reads source as
text. Both literals are proven found before they are compared.

---

## 6. SAM — EXACTLY WHAT TO DO

### Window 1 — Terminal, in the project folder

```
npx expo run:ios
```

**Use this command, not `--configuration Release` and not TestFlight.** It builds
Debug, which is what puts the proof panel in the app. It installs and launches
the app itself; the first run takes a few minutes because it is compiling the new
native module.

*(If it complains about pods: `cd ios && pod install && cd ..`, then run it
again.)*

### Window 2 — the app, on your phone/simulator

1. Open the **Journal** tab.
2. Scroll to the very bottom. Below the note box you will see a dashed box:
   **"DEV — journal reminder proof"**. *(If it is not there, you built Release —
   see the command above.)*
3. Tap **"1. Check the weekday conversion"**. It answers instantly.
   - **"PASS — the OS says Monday"** → the conversion is right. This is the
     thing that was unproven.
   - **"FAIL — the OS says Tuesday, not Monday"** → the `+ 1` is wrong. Send me
     that line and it is a one-character fix.
   - It also prints the OS's next fire date and our own rule's prediction, so you
     can eyeball them side by side.
4. Tap **"2. Fire the real reminder in 2 minutes"**.
   - iOS will ask for notification permission. **Allow it.**
   - The panel says the exact time to watch for.
5. **Background the app** (swipe up / press Home). A notification will not show
   while you are looking at the app.
6. Wait ~2 minutes. You should get:
   > **Last week**
   > Your week is in the Journal.
7. **Tap the notification.** It should open the app on the **Journal** tab.
8. Tap **"3. Cancel a pending proof"** if you want to clear anything still
   pending. *(Optional — the proof uses its own slot and can never disturb the
   real Monday reminder.)*

### What to tell me

The result of step 3 (Pass/Fail and the weekday), whether the notification
arrived at step 6, and whether step 7 landed on the Journal tab. **Those three
answers close every open unknown in this feature.**

---

## 7. NOT COVERED

**FIRST LINE: I HAVE STILL NEVER SEEN A NOTIFICATION FIRE.** Everything in §6 is
a set of instructions I cannot run. DEPTH (L13): **0**.

- **THE WEEKDAY CONVERSION IS STILL UNVERIFIED — but it is no longer
  UNVERIFIABLE**, and that is the whole delta of this commit. The cells prove the
  instrument is wired to the real trigger; only Sam's tap produces the answer.
- **THE PROOF PANEL ITSELF HAS NEVER RENDERED.** Whether the buttons are legible,
  whether the result text fits, and whether the dashed box is findable below a
  screen that just gained five blocks are unverified.
- **`getNextTriggerDateAsync` MAY BEHAVE DIFFERENTLY FROM THE SCHEDULER.** It is
  the OS's answer to "when would this fire", and this slice assumes the OS uses
  the same conversion for previewing as for scheduling. That is very likely and
  it is not proven — **if step 3 passes and step 6 arrives on a Tuesday, that
  assumption is the suspect.**
- **NOTHING ASSERTS THE PANEL IS ABSENT FROM A RELEASE BUILD BY BUILDING ONE.**
  The double gate is asserted in source; no Release bundle was produced and
  inspected.
- The reminder row and the four surfaces Sam signed this morning **still have no
  device evidence** — the whole-journal eye pass is his next step and is why this
  slice STOPS here, as ordered.

---

## 8. PARKED FOR SAM

Unchanged from the notification boundary, minus batch 28 which he has now signed:
**C4 (the week-bar colours)**; the restored lifts line on a non-lifting week;
"March 2025" as the year phrasing; **08:00 as the reminder hour** (C6 said
"Monday morning" and did not pick an hour); and no in-app off switch — off lives
in OS Settings so there is one owner of "is this on".
