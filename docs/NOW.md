# NOW — overwrite at every checkpoint (pointer, not history)

- **BRANCH:** `main` · **HEAD:** `8b12fcdd` — **SAM'S SIGNING SESSION IS
  PROCESSED IN FULL. THE INBOX IS CLEAR. TWO THINGS NOW WAIT ON HIM.**
- **READ FIRST:** docs/JOURNAL_SIGNING_BOUNDARY_2026-08-09.md (items i–v) and
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
  **NOTHING FIRES UNTIL SAM SIGNS BATCH 28'S SENTENCE** — the gate refuses even
  with permission already granted, because iOS grants ONE prompt and burning it
  on a feature that cannot fire does not get it back.
  - **11 mutations, 11 red — N7 GENUINELY SURVIVED FIRST.** "A reschedule cancels
    first" was asserted FILE-WIDE and `disableJournalReminder` satisfied it.
    `a count taken for a record`, source-scan form, **eighth sighting**, in a
    cell written minutes earlier. Re-aimed at the located region, order asserted.

- **GATE, all three commits:** full `test:bible` **UNPIPED `GATE_EXIT=1` at
  `test:program-control-durable`, 1 FAIL line** — main's declared red.
  `test:compile` PASSED. **Sweep 2 of 170 = the declared set exactly.** New suite
  `test:journal-reminder` **55 passed, 0 failed** (chain position 129; the
  declared red is at 92, so the official chain stops before it — the sweep is
  what proves it).

- **A NUMBER IN THE LAST TWO REPORTS WAS WRONG.** They said "sweep 2 of 167". The
  chain held **169** at `73232293` and `b6509f02` — measured at both, byte-
  identical script list — and is **170** now with the new suite. The failure
  count was right; the denominator was not.

- **NOT COVERED, first line: NO DEVICE EVIDENCE, and it matters more this pass
  than any before it. DEPTH 0.** Four surfaces rendered for the first time today
  and **not one has been seen**; the band's track and marker are GEOMETRY that no
  cell draws. **No notification has ever been scheduled or delivered** — the
  weekday `+ 1` conversion for expo's Sunday-is-1 numbering is read off docs and
  is the single most likely thing to be wrong.

- **WAITING ON SAM (7, none blocking except where noted):**
  1. **BATCH 28'S NOTIFICATION SENTENCE — blocking that feature ON PURPOSE.**
  2. **C4, his own open item: the week bars' colours** — app tokens as built, or
     the mock's calmer ramp. He judges on the phone after this lands.
  3. The restored lifts line also shows on a week he never lifted — built
     unconditional as ruled, flagged not narrowed.
  4. "March 2025" — the year rider on C5 is the terminal's phrasing.
  5. Batch 27's twelve month words (the DECISION is signed, the words are not).
  6. 08:00 Monday is the terminal's hour; C6 said "Monday morning".
  7. No in-app off switch for the reminder — off lives in OS Settings, so there
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
