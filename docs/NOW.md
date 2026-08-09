# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** `b203c6af` — **INBOX CLEAR. EVERYTHING NOW WAITS
  ON SAM'S DEVICE: rebuild, run the proof, then the whole-journal eye pass.**

- **⚠ THE ONE COMMAND: `npx expo run:ios`** — NOT `--configuration Release`, NOT
  TestFlight. Debug is what puts the proof panel in the app.
  **docs/JOURNAL_PROOF_PATH_BOUNDARY_2026-08-09.md §6 is the tap-by-tap script.**
  Three answers close every open unknown: does the weekday check say Monday, does
  the notification arrive, does tapping it land on the Journal tab.

- **BATCHES 27 + 28 SIGNED, AND 28 ARMED THE REMINDER** (`b203c6af`). Signing is
  a SWITCH here, not a record — while it read PROPOSED nothing could be scheduled
  and no permission requested. **Arming is not enabling:** the athlete's opt-in
  tap and iOS permission both still stand in front of every notification.
  - **THE VACUITY CHECK PAID THE SAME DAY IT WAS PROPOSED.** Two cells reddened
    and announced themselves; the silent gap was that EVERY cell passed
    `copySigned` explicitly, so **none exercised the default path that reads the
    copy module**. That gap predated the signing. Closed by the runtime mutation.
  - **THE PROOF PATH IS TWO INSTRUMENTS, because a 2-minute fire is half a
    proof.** It uses a TIME_INTERVAL trigger — **the weekday never enters it** —
    so building only that would leave the one flagged unknown unproven while
    feeling like a pass. `previewWeeklyFireDate()` asks the OS what date the REAL
    weekly trigger would next fire and names the weekday. **That is the
    conversion proof.** Both fire the REAL exported trigger and content.
  - **GATE CHOICE, as ordered:** `__DEV__` double-gated at require + render (the
    ScheduleDebugPanel convention). Reachable in Sam's Debug rebuild, unreachable
    in an athlete's Release build. **No conflict, one condition** — build Release
    and the panel is absent, which looks identical to broken.
  - **AN OFF_SHEET EXCLUSION WAS A LIE WAITING TO HAPPEN:** `components/dev/`
    excludes every file in the directory, justified as "double gated, asserted
    below" — but the assertion named ONE component BY NAME. Derived from the
    directory now.
  - **7 mutations, 7 red — P5 SURVIVED FIRST, the same shape as N7 one commit
    earlier.** It asserted the identifier's NAME appears; the mutation changed its
    VALUE. `a count taken for a record`, twice in two commits.

- **BEFORE IT — HEAD `8b12fcdd`: SAM'S SIGNING SESSION PROCESSED IN FULL.**
- **READ FIRST:** docs/JOURNAL_PROOF_PATH_BOUNDARY_2026-08-09.md, then
  docs/JOURNAL_SIGNING_BOUNDARY_2026-08-09.md (items i–v) and
  docs/JOURNAL_NOTIFICATION_BOUNDARY_2026-08-09.md (item vi). Ruling committed as
  authored first: docs/JOURNAL_SIGNING_SESSION_2026-08-09.md at `b4335d2a`.

- **⚠ SAM: THE APP NEEDS A REBUILD WITH PODS, NOT A RELOAD.**
  `expo-notifications` is a new NATIVE dependency with its plugin registered in
  `app.json`. `npx expo prebuild` → `pod install` in `ios/`, or
  `npx expo run:ios`. Until then the reminder is inert and renders nothing — no
  error, no broken tab.

- **HALF THE JOURNAL FRONT PAGE TURNED ON, AND NO SURFACE CODE WAS EDITED TO DO
  IT** (`09c29fb7`). Eight constants flipped `proposed` → `signed` and the load
  band, the load stat tile, the "ran hot" card and "balance drifting" all render.
  **0 PROPOSED of 10.** That is the load slice's mechanism paying out exactly as
  designed.
  - **11 CELLS WENT RED ON THE FLIP AND EVERY ONE WAS RE-AIMED, NOT DELETED** —
    they existed to red on this day. The VALUES are unchanged, so they are now
    asserted beside the signatures.
  - **THE FINDING: A SIGNATURE TAKES THE PROOF WITH IT.** Signing every constant
    removed the end-to-end evidence that a PROPOSED one darkens a real output.
    New section **[2b] un-signs a constant AT RUNTIME** and rebuilds the real
    model, both directions, mutation proven applied first. Without it the next
    author could hardcode `provenance: 'signed'` and nothing would red.
  - **AND IT CAUGHT A CONFLATION IN THE DOOR ON ITS FIRST RUN:** `signedValue`
    returns null for UNSIGNED and for ABSENT alike.
  - **THE COMPILER REFUSED SEVEN CELLS** — `as const` narrowed provenance to
    `'signed'`. The READ is widened; the table keeps its literals.
  - C2 "How did that go?" · C3 the lifts empty state RESTORED · C5 the month word
    ("since April", not "since 2026-04-06"). Batches 15–26 SIGNED.

- **A COMMENT IS NOT A SHIPPED STRING — FIXED, FOURTH SIGHTING** (`646116d3`).
  Mutation-testing C3 left the copy binder GREEN because the sentence lives in a
  docblock explaining that Sam restored it. **It found four strings the sheet
  claimed were shipping.** "Niggles" was a genuine omission in yesterday's batch
  26 and is fixed; "Ask Coach" / "Edit this session" / "Edit exercises" are named
  in `KNOWN_ABSENT`, each citing the record that ruled on it. **"Ask Coach" must
  NOT be withdrawn — batch 11-e rules it DORMANT for the beta cut.**

- **THE MONDAY NOTIFICATION IS BUILT AND DELIBERATELY DARK** (`8b12fcdd`).
  **ZERO new stored state — the OS is the store** (`granted` + `canAskAgain`
  answer every question). **"A refusal is a fact, not an error" is a returned
  state, not a catch block**, and `refused` renders nothing at all.
  It shipped DARK behind batch 28's unsigned sentence — the gate refuses even
  with permission already granted, because iOS grants ONE prompt and burning it
  on a feature that cannot fire does not get it back. **Batch 28 is SIGNED as of
  `b203c6af`, so that gate is now open and the athlete's own opt-in is what
  stands in front of it.**
  - **11 mutations, 11 red — N7 GENUINELY SURVIVED FIRST.** "A reschedule cancels
    first" was asserted FILE-WIDE and `disableJournalReminder` satisfied it.
    `a count taken for a record`, source-scan form, **eighth sighting**, in a
    cell written minutes earlier. Re-aimed at the located region, order asserted.

- **GATE, all three commits:** full `test:bible` **UNPIPED `GATE_EXIT=1` at
  `test:program-control-durable`, 1 FAIL line** — main's declared red.
  `test:compile` PASSED. **Sweep 2 of 170 = the declared set exactly.** New suite
  `test:journal-reminder` **71 passed, 0 failed at `b203c6af`** (chain position
  129; **the declared red is at 92, so the official chain STOPS BEFORE IT** — the
  sweep is what proves anything registered later).

- **A NUMBER IN THE LAST TWO REPORTS WAS WRONG.** They said "sweep 2 of 167". The
  chain held **169** at `73232293` and `b6509f02` — measured at both, byte-
  identical script list — and is **170** now with the new suite. The failure
  count was right; the denominator was not.

- **NOT COVERED, first line: NO DEVICE EVIDENCE, and it matters more this pass
  than any before it. DEPTH 0.** Four surfaces rendered for the first time today
  and **not one has been seen**; the band's track and marker are GEOMETRY that no
  cell draws. **No notification has ever been scheduled or delivered** — the
  weekday `+ 1` conversion for expo's Sunday-is-1 numbering is read off docs and
  is the single most likely thing to be wrong. **It is still UNVERIFIED but no
  longer UNVERIFIABLE** — the proof panel is the instrument and it takes Sam a
  tap. The panel itself has also never rendered.

- **WAITING ON SAM — the two signed items are struck; the live ask is 7:**
  1. **~~Batch 28's sentence~~ SIGNED 2026-08-09 — the reminder is armed.**
  2. **C4, his own open item: the week bars' colours** — app tokens as built, or
     the mock's calmer ramp. He judges on the phone after this lands.
  3. The restored lifts line also shows on a week he never lifted — built
     unconditional as ruled, flagged not narrowed.
  4. "March 2025" — the year rider on C5 is the terminal's phrasing.
  5. ~~Batch 27's twelve month words~~ SIGNED 2026-08-09.
  6. 08:00 Monday is the terminal's hour; C6 said "Monday morning".
  7. **THE THREE PROOF ANSWERS, and they are the live ask** — does the weekday
     check say Monday, does the notification arrive, does tapping it land on the
     Journal tab.
  8. No in-app off switch for the reminder — off lives in OS Settings, so there
     is one owner of "is this on".

- **STILL OPEN, NOT THIS UNIT:** the **~150 `label:` strings across 20+
  `utils`/`rules` modules** invisible to both copy gates. Journal **week
  navigation** is not built (`useResolvedWeek` resolves this week only). The
  three `KNOWN_ABSENT` strings are batch 6/11's business.

- **STILL TRUE FROM THE MERGE (2026-08-07, `89b540f9`):** main carries Stage B
  stages 1 + 2; a green main went to a **2-red main knowingly** —
  `test:program-control-durable` + `test:fixture-identity`, the declared set
  exactly. `fixture-identity`'s payer is the **LR-29 replay unit**, measured
  (under `LFA_FLIP_DOOR=1` that suite goes GREEN). Sam-accepted as
  known-imperfect. Dependency list: docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md
- **BEFORE THIS UNIT:** the Journal unit itself is complete —
  docs/JOURNAL_UNIT_BOUNDARY_2026-08-09.md, 22 of 22 items, ten slices; the UI
  slice at docs/JOURNAL_UI_SLICE_BOUNDARY_2026-08-09.md.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY — *"labels are okay but the
  programming is pretty shit"*, docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md.
- **WATCH-FORS still open on Sam's device:** completed-day display at the next
  completed session; the three fallback sheets; stale-banner Review; the
  team-training affordance.
- **INBOX CONVENTION:** an empty queue is written `(none)`, **unnumbered** — the
  stop hook read a numbered empty marker as an order twice.
- **Standing:** `test:bible` is the ONLY official gate, unpiped, per commit — and
  it **stops at the first failing suite**, so anything after position 92 needs
  the sweep. `npm run test:bible:parallel` is a NON-OFFICIAL fast pre-check.
  Verify `git branch --show-current` before every commit (shared worktree).
