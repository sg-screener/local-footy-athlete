# NOW — overwrite at every checkpoint (pointer, not history)

- **⚠ SAM: I NEED ONE REBUILD FROM YOU, AND I AM NOT APOLOGISING FOR IT BECAUSE
  YOU ALREADY SAID YES.** You said you'd rather pay 40 minutes once than have me
  pick the cheap option. **So I built the proper way for the test to load a
  practice week** — its own named setting, checked properly, and it refuses
  loudly if it's given something wrong instead of quietly doing nothing.
  **THE COST, PLAINLY:** run `npx expo run:ios --configuration Debug`. It takes
  roughly 40 minutes and **your machine is busy the whole time**, so pick when.
  Nothing else needs you.
  **Until you run it, the new way cannot work at all** — it's built and it's
  never executed. **Not seen on your phone.**

- **⚠ SAM: I THINK I HAVE FOUND WHY ONLY THE STRENGTH MOVED — AND IT IS NOT
  COSMETIC.** I said the app names your Monday a "strength day" even though it
  carries conditioning too. I have now checked whether anything ACTS on that
  name. **It does, in two places.** The move checks it before it will run — and
  **the repair uses it to decide what survived the move.** On a day carrying
  both, **your conditioning has no name of its own**, so nothing carries it and
  the repair puts it back where it started. **That is exactly what you saw.**
  docs/DOES_THE_DOOR_READ_THE_NAME_2026-08-10.md
  **I have not proven it.** I read the code; I have not yet run
  your day through it. That is the next thing, it is small, and it settles it
  either way. **Not seen on your phone.**

- **⚠ SAM: THE TEST RIG IS NOT DEAD, AND IT IS NOT FORTY MINUTES. IT IS ABOUT
  TWENTY SECONDS.** You asked because you remember it eating your laptop. I ran
  it three times on the simulator you already have built: **26s, 20s, 26s per
  flow, no rebuild.** What you remember was the BUILD, not the run. **It DOES
  take over your screen** — the simulator comes to the front — so it belongs
  before a device build and overnight, not on every change.
  **AND THE THING EVERY REPORT SINCE 18 JULY HAS SAID IS WRONG:** the crash that
  killed it is gone — your rebuild fixed it. The app launches, loads, and draws
  the welcome screen.
  **AND I NOW KNOW WHAT THE POP-UP ACTUALLY DOES — I HAD IT HALF RIGHT.** I asked
  the test to list everything it can see while the pop-up is up. **It can see the
  pop-up and nothing else — none of your app is there at all.** So the pop-up
  doesn't just sit on top; **it hides the whole app from the test.** Clear it
  first and the test finds what it's looking for in **11 seconds — the first
  green step in 23 days.**
  **It is not fixed yet.** The pop-up comes from the way the test loads a
  practice week, and the clean fix is to load it a different way so the pop-up
  never appears. **Half the run works; the rest doesn't — and none of this has
  been on your phone yet.**
  **AND YOU DO NOT NEED TO REBUILD ANYTHING — I CHECKED BEFORE ASKING.** There is
  a way to load the practice week that doesn't involve the pop-up at all and
  costs nothing. **The test now gets all the way in, and it immediately found a
  real bug:** the practice week it saves doesn't survive being read back. That is
  the first thing this kind of testing has ever caught here. **I have not
  diagnosed it — it is named and nothing more**, because I've been wrong twice
  today by moving too fast on a cause.
  **THE NUMBERS, BECAUSE THEY CHANGE WHAT IS WORTH DOING: a whole test run is
  20-26 seconds, and the part that now works takes 11.** A set of ten different
  training weeks would be under four minutes. **Cost is no longer a reason to
  skip testing on a real phone-like device**, which it has been all year. docs/MAESTRO_RIG_MEASURED_2026-08-10.md

- **⚠ SAM: ALL SIX RULES YOU RULED ON ARE NOW WATCHED — AND TWO OF YOUR
  RE-WORDINGS BEAT MINE.** You said the plain-English rule was about **app
  wording**, not my prose, and you were right — it now checks every word the app
  says to you. And on the chat rule you refused the easy answer: *"held by
  discipline"* is just **UNENFORCED with a nicer name**, which you'd already
  banned. **So you are the guard, by name.** You pulling me up on it is the
  alarm. **36 rules still have nothing watching them, down from 42 this morning
  — and your rule that the number may only fall has held every time.** `faea72dd`
  · `75f26ca5`. **None of this has been on your phone yet.**

- **⚠ SAM: TWO THINGS I COULDN'T DO AND NEED YOU TO ALLOW.** You said yes to
  committing your two exports, and yes to binning the corrupt file. **My tools
  refused both** — they're still exactly where they were, untouched and unread.
  One word from you and both are done. **It's the one kind of thing only you can
  give.** `docs/STOP_INBOX_QUEUE_2026-08-10.md` · **Waiting on your word.**

- **⚠ SAM: YOU ASKED WHY I COULDN'T TELL WHETHER YOU USED THE COACH OR THE
  TAP. FIXED — AND YOU WERE RIGHT THAT IT WAS THE LABEL.** Every change you
  made was stamped **"tap"**, whether you used the Program tab or the coach's
  card, because that stamp answered *"did a person do this?"* and not *"which
  door?"*. **That is why I told you your move came through the Program tab when
  it came through the coach**, and it sent me down the wrong path for a whole
  pass. Now the stamp names the door, and the short summary in your export says
  the same thing as the detailed log — before, those two could disagree.
  **AND THE OTHER THING YOUR EXPORT SHOWED:** it said a repair had run four
  times and never said WHAT was repaired. It does now. `3d1e8d70` ·
  `test:diagnostic-label-names-the-door`. **Not seen on your phone — proven by tests, not by a real run yet.**

- **⚠ SAM: YOUR MONDAY IS CALLED A STRENGTH DAY BY THE APP'S OWN NAMING, AND
  THAT IS THE LEAD.** Your export carries `planEntryId: "w2:monday:none:strength"`
  on a day the app labels **Mixed**. Measured: the app gives each day **ONE**
  name, picked off a ladder — team, then strength, then conditioning. **A day
  with both stops at "strength" and the conditioning is never named.** Every
  test world we build has only one of the two, so the ladder's order has never
  been visible. Yours has both. `3d1e8d70` ·
  docs/PLAN_ENTRY_IDENTITY_MEASURED_2026-08-10.md
  **Not proven to be your problem yet.** It explains the NAME; whether the app
  acts on it, I have read but not yet run. **Not seen on your phone.**

- **✅ THE CLEAN-RESET DOOR IS BUILT AND THE CRASHING MIGRATION IS DELETED**
  (`a0c0cabd`). Saved training the app can no longer read now **starts fresh and
  tells you once, in plain words**, instead of taking the app down at launch.
  `test:unreadable-world-reset`, 73 cells, in the chain; the law arrived guarded.
  **Never been on your phone — the message has never actually been shown.**

- **BRANCH:** `main` · **HEAD:** `f168b48b` — **`test:bible` IS DELIBERATELY RED
  AND STAYS RED UNTIL EVERY LAW HAS A GUARD.** S4 not started, as ordered. Sam's
  boot fix below is still UNSEEN on his phone.

- **⚠ SAM: I DELETED THE OLD "HOW HARD IS THIS WEEK" RULES FROM GENERATION, AND
  HERE IS WHAT THEY WERE DOING.** The old set **cannot see two things stacked on
  one day** — team training plus a gym block. So on exactly the days you combine
  work, it said the week was EASIER than it is, and it was still the gate that
  accepted your week whenever the new set was missing (any program saved before the
  rebuild). Now a week the current code can't describe gets rebuilt instead.
  **BUT IT IS NOT FULLY GONE:** the same old check still runs in three other places
  with no guard on it, so the undercount can still reach a current week. That is
  measured as open, not claimed as fixed. Full sweep before and after the cut: the
  same four reds, so nothing else moved. **This is a test result, not something you
  have seen on your phone.** `2ec4d49b` ·
  docs/V1_EXPOSURE_CONTRACT_CUT_2026-08-10.md · green after the cut:
  `test:section18-gateway`, `test:exposure-contract-equality`,
  `test:bible-anchors`, `test:stage-b-generation-differential`.

- **🔴 THE CHAIN IS RED ON PURPOSE. UNENFORCED COUNT: 42 of 62** (verified by
  running `test:law-registry`, not recalled). `915c58fe` flipped the law
  registry's default on Sam's stop-the-line ruling (*"WHY CAN'T YOU JUST MAKE
  SURE EVERY FUCKING RULE IS FOLLOWED FROM RIGHT NOW"*): `test:law-registry` is
  the last link of the chain and **FAILS while any registry row reads
  `UNENFORCED`.** **The red does NOT mean the app broke — it means the app has
  never been checked against 42 of its own rules, and from now that counts as
  failing.** Placed LAST so the red costs no coverage: every other suite still
  runs and reports first. **Nothing but guards, guard-caught fixes and
  measurement lands while it is red.** Expect some guards to go red on their
  FIRST run — that is the point, and each one is then a real bug with a name,
  reported the moment it appears.

- **✅ THE COUNT GOING 20 → 42 OF 62 IS THE RIGHT ANSWER AND IS NOT A
  REGRESSION — SAM RULED THIS PLAINLY, 2026-08-10. Nobody may read it as work
  going backwards.** No law was added and nothing broke. **The map was wrong: a
  sweep found laws that had never had a row at all** — the whole of Process Law
  L1–L10, the north star itself, every seat law in the handoffs — so the
  denominator grew from 28 to 62 and the honest unguarded count grew with it.
  **A number that gets worse because you finally measured it is the measurement
  working.** **Sam's rule from here: it may only fall.**

- **⛔ STOP — 36 OF 66 LAWS UNGUARDED; see docs/STOP_INBOX_QUEUE_2026-08-10.md
  for the live queue.** NOT STARTED, named rather than implied: splitting the
  chain (Sam asked for the per-change runtime AS A NUMBER — there is no number
  yet), the Maestro rig, the world replay, and whether the door READS the day
  name. **None of it has been on your phone.**

- **⛔ (HISTORY) STOP — 42 OF 62 LAWS STILL UNGUARDED, AND THE NEXT MOVES NEED SAM.**
  docs/LAW_SWEEP_STOP_2026-08-10.md. **Two things only he can give:** the
  **template files from his partner** (photos + HTML — his own step 1 cannot open
  without them, MOCK-FIRST), and **one line for `eas.json`** (Apple ID /
  App Store Connect app id; `submit.production.ios` is `{}`, verified). **Two
  decisions only he can make:** local-only vs sign-in (**there is no auth code in
  the repo at all**), and whether v1 is iPhone-only (**Android has never been
  run**). **Six laws no script can check** need his ruling on a re-wording.
  **And cut (a) is a STOP on a contradiction:** the order says "replace with the
  clean-reset path" and **that path does not exist**, so it is a BUILD, which the
  same order forbids while the chain is red.

- **⚠ SAM: YOU CAN SEND ME YOUR REAL DATA RIGHT NOW, FROM THE BUILD ON YOUR
  PHONE — NOTHING NEEDS BUILDING.** Open the app → **Profile** tab → scroll to
  the top → tap **"Export stored state"** → the share sheet opens with the whole
  export → send it to yourself in Mail or Notes. The green line of counts just
  above the button answers most of it without sharing anything. (We thought this
  door didn't exist in a Release build; it does, on Profile, and a chain cell
  already guards it — `test:profile-mirror-narrowing`.) **This is the instrument
  that would settle your conditioning case, because every seed I can generate
  disagrees with your phone.**

*(The power-row correction that used to sit here is now one block, further down —
"I TOLD YOU YOUR POWER WORK WAS BEING DELETED. THAT WAS WRONG." Two blocks said
the same thing in different words; the fuller one survives.)*

- **🔴 THE COURIER TOLL IS PAID (`f168b48b`).** The stop hook detected an order by
  matching `^1\.` only, so **every order the seat wrote as `00.`/`0.`/`000.` was
  invisible and the turn ended silently — Sam had to type "check inbox" himself,
  twice on 2026-08-10.** Sighting 4 of the numbering-artefact class the hook's own
  comments already named twice. Now read by CONTENT: anything under
  `## Unprocessed` that is not blank, not an empty-queue marker and not parked is
  an order. `test:seat-inbox-hook`, 17 cells both directions, **enrolled in the
  chain — the suite existed and was in NO chain at all.**

- **⏳ THE BLOCKER IS CLEARING — SAM APPROVED THE REBUILD AND IT IS RUNNING.**
  `npx expo run:ios --configuration Debug` was started 2026-08-10 once Sam
  confirmed his device build had finished. **It had not completed when this
  checkpoint was written, so NOTHING BELOW HAS BEEN SEEN ON GLASS YET** — the
  L-C3 matrix is still unrun and the coach-tab undo question is still
  OPEN-UNKNOWN. The history that made it necessary is kept below.

- **⛔ (HISTORY) THE MAESTRO RIG CANNOT RUN: THE SIMULATOR BINARY IS ONE DAY
  TOO OLD.** Every flow dies on the launch path with
  `Cannot find native module 'ExpoPushTokenManager'` — `expo-notifications` →
  `journalReminderService.ts:33` → `AppNavigator.tsx:7` → `RootNavigator.tsx:6`
  → `App.tsx:69`, so no flow reaches any screen. **DATED RECEIPT:**
  `expo-notifications` entered `package.json` 2026-08-09 (`8b12fcdd`) and
  `ios/Podfile.lock` the same day (`77f5e415`); the installed simulator binary is
  from **2026-08-08** and contains **zero** occurrences of `ExpoPushTokenManager`
  (`strings` over the installed Mach-O). Metro serves today's JS to a binary that
  predates the dependency. **THE FIX IS A NATIVE SIMULATOR REBUILD**
  (`npx expo run:ios`, Debug), and it is **HELD until Sam's device workspace is
  free** — a second `xcodebuild` against the same workspace and DerivedData would
  contend with his in-flight device build. **Nothing that needs glass can be
  measured until this clears**, which includes both OPEN-UNKNOWNs below.
  - **THE L-C3 FLOW IS NOW WRITTEN AND HAS NEVER BEEN RUN, WHICH IS SAID HERE
    RATHER THAN LEFT TO BE DISCOVERED.** `.maestro/keyboard/` — a parameterised
    matrix (`conversation-keyboard-matrix.yaml`, so S4 joins by passing
    parameters, not by copying) plus the coach-tab caller
    (`coach-tab-keyboard.yaml`) carrying both OPEN-UNKNOWNs. Every testID in it
    was verified to EXIST in product source; **existence is not reachability**,
    and its YAML parses — that is the whole of what it currently claims. Run it
    with `E2E_METRO_URL=http://127.0.0.1:8081 npm run e2e:maestro:ios --
    .maestro/keyboard/coach-tab-keyboard.yaml` once the binary is rebuilt, and
    treat the first run as AUTHORING, not as a regression check.
    **The Undo assertion in it is EXPECTED TO FAIL** — that red is the finding,
    not a broken flow. And the toast has **no testID at all**, so it can only be
    matched by its copy, which is the weakest anchor in the file.
  - Separately FIXED and committed this pass (`dd192603`): eight of the eleven
    flows had *also* been crashing the app since 2026-07-18 because
    `reset-seed.yaml` omitted `e2eLaunchPurpose`, which
    `DevE2ELaunchDiagnostic.swift:55-60` treats as a `fatalError`. That half is
    verified green — the launch step and `e2e-entry-ready` now pass. **The rig
    had two independent breaks and only the first is paid.**

- **⚠ SAM: THE COACH NOW OFFERS YOU THE SAME CHOICES YOUR OWN PROGRAM TAB DOES —
  AND THAT FIXED THE THING WHERE IT SAID NO TO SOMETHING YOU CAN DO.** You asked
  for the build order off the parity census and this is row 1. Before: on a
  Monday that carries team training, tapping your own picker offers *"Just the
  gym session"* and *"Team training"* — and the coach, which never asked what
  the day offered, sent a whole-day move and got **refused** (*"protected
  game/team anchor"*). Same day, same destination, same door, you succeed and it
  fails. **Now the coach reads your picker's own list and puts those same rows on
  the card**, in your picker's own words, and the move **lands**. Measured
  refused→applied in `npm run tape:coach-move-durability`, which is the same tape
  that measured it broken. Gate `test:coach-tab-slice3`, **137 cells**.
  **Not on your phone yet** — the chooser is a shape nobody has tapped.

- **⚠ SAM: I TOLD YOU YOUR POWER WORK WAS BEING DELETED. THAT WAS WRONG, AND I
  AM CORRECTING IT WHERE YOU READ IT.** ~~*"a day carrying power + gym work,
  moved onto a team night, arrives with the power work deleted — 8 rows in, 7
  out"*~~ — **WITHDRAWN 2026-08-10.** I put probes on all five places in the app
  that can remove power work, including one wrapper covering every one of the 73
  places a session gets rewritten. On the run where the row vanishes, **all five
  counted zero. Nothing deletes it.**
  **Why I got it wrong, plainly: I counted rows on the SCREEN and called it rows
  in the app.** *"8 rows in, 7 out"* was reading what the screen DRAWS, never
  what is stored, and I never said which of the two I was counting — so a
  drawing problem read as a deletion. That is `LAW-count-names-instrument`,
  already a written rule here, and this is now its founding case: **a number
  names the instrument's unit, not the thing you care about.**
  **What is still true and still open:** the day that lands on a **team night**
  had never once been exercised by any tape — every arm had been landing on
  EMPTY days — so that path is genuinely untested, and I found it. But *"your
  power work was deleted"* is **not established**, and the two live
  possibilities are that the move never carried the row, or that it is still
  stored and the screen isn't drawing it. Next probe is one line: stored rows
  beside drawn rows, same tape.
  **AND YOUR OWN CASE IS UNTOUCHED BY ALL OF THIS — it is conditioning, not
  power, and it is OPEN and unreproduced.** That is the only live half of the
  report. `npm run tape:coach-move-durability` ·
  docs/POWER_REMOVAL_REASON_XS_2026-08-10.md

- **⚠ SAM: I TOLD YOU THE COACH COULD MOVE A SESSION. IT COULDN'T — AND NOW IT
  CAN.** The seat ordered a tape that actually runs the door instead of reading
  it. First run: your own tap on the Program tab moved the week and recorded it;
  **the coach's identical move, same world, same two days, same run, did nothing
  and told you *"Cannot safely apply this day/session action without the current
  visible week."*** One missing argument, fixed. What the tape says now: the two
  moves produce a **byte-identical** week, a byte-identical ledger entry, the
  same week after a relaunch, and Undo unwinds the coach's move and it stays
  unwound. **Measured in a test, never tapped on your phone.**
  `npm run tape:coach-move-durability` ·
  docs/COACH_MOVE_DURABILITY_BOUNDARY_2026-08-10.md

- **⚠ SAM: YOUR MULTI-SESSION CATCH — I COULD NOT REPRODUCE WHAT YOU SAW, AND I
  FOUND A DIFFERENT REAL DEFECT LOOKING FOR IT.** You said *"i tried moving
  monday S&C to wednesday and it only moved the strength"*. Measured in
  `tape:coach-move-durability` (new multi-part section):
  - **On a plain two-part day (strength+conditioning) the move carries BOTH
    parts** — coach and your own tap, identical. **Your partial-move symptom did
    NOT reproduce.** I am not reporting it as fixed; I am reporting that this
    world did not reach it.
  - **On an ANCHORED day (Monday = strength + team training, your exact day
    shape) the coach is REFUSED** — *"This would remove or replace a protected
    game/team anchor"* — and it tells you *"I couldn't make that change."*
  - **AND HERE IS THE DEFECT, MEASURED:** on that same day, your own tap
    carrying the picker's own *"Just the gym session"* row **APPLIED** — the
    strength moved, team training stayed. **The coach is refused exactly where
    you succeed.** Same day, same destination, same door. That is an L-C4 parity
    break, measured rather than argued (arm D).
  - **~~THE LIKELIEST EXPLANATION…~~ RETRACTED 2026-08-10 — SAM ANSWERED AND THE
    HYPOTHESIS IS DEAD.** It read: *if you tapped "Just the gym session" on a
    Monday that also carried conditioning, only the strength would move.* **You
    tapped nothing — you did it in the COACH CHAT — and your Monday carried GYM +
    CONDITIONING with NO team training.** So it was never a copy defect, and the
    scope row you never saw cannot explain it. Do not re-read that line as live.
  - **AND SAM'S ANSWER TURNS THE RESULT ABOVE OVER.** The NOT-REPRODUCED verdict
    was recorded on *a plain two-part day (conditioning+strength), all arms
    carried BOTH parts* — **that is your day exactly, and the coach is the arm you
    used.** The anchored-day parity break stays (it is real, and it is measured),
    but it is **not your defect**: your Monday had no anchor. **The tape and the
    phone now disagree about the same shape, and the hand-built world is the
    suspect** — every fixture in that section is hand-assembled, which is the
    NOT-COVERED the boundary wrote about itself: *"a real `project()` over a worn
    athlete may hold day shapes these fixtures do not."* Next instrument: re-run
    the section over a **GENERATED** week and diff a generated gym+conditioning
    Monday against the hand-built one field by field. **Every line above is a test result;
    nothing here has been seen on your phone.**

- **⚠ SAM: WHAT THE COACH TAB DOES, WITH WHAT HOLDS EACH CLAIM.** Every line
  below is either pinned by a named cell or marked **OPEN-UNKNOWN** — the new
  standing rule (AGENTS.md), written because *"why is Friday heavy? is refused"*
  reached you here and was false.
  - Type **"move Friday to Sunday"** or *"can you move Friday to Sunday?"* and
    it is read as a change, not a question — `test:coach-tab-slice3` [1], the
    marker matrix, 11 rows.
  - A card comes up in the strip above the keypad — what changes, from what, to
    what, and why — with **Make the change** and **Not now** — [3] and [6].
  - **Nothing happens until you tap** — [3]: a proposed action always arrives
    with its card, and the screen holds no executable it cannot show.
  - **Tapping it goes through the same door as your own tap, and Undo covers it**
    — `tape:coach-move-durability`, both arms byte-identical through a relaunch,
    and section [7] pins the argument the tape found missing.
  - **The Undo TOAST on a coach move: OPEN-UNKNOWN, and the source now says it
    probably does NOT appear.** The toast reads the ledger and the coach's
    decision is byte-identical to yours, so it *should* appear — but
    `UndoToast` is mounted in exactly ONE place, `HomeScreenV2.tsx:1225`, and
    **`CoachTabScreen` mounts no undo surface at all.** Its own docstring says
    *"This mounts once, on the Program screen."* Because bottom tabs stay
    mounted, the likely behaviour is worse than absence: the toast arms
    invisibly behind the Coach tab and **burns its own 6-second timer**
    (`UndoToast.tsx:31,47`), marking the entry seen, so it is gone before you
    ever switch tabs. `rules/undoToast.ts:17-19` predicted the gap in writing —
    *"A coach-authored change would appear here for free."*
    **THIS IS A HYPOTHESIS, NOT A FINDING: no cell holds it and no glass has
    confirmed it**, and the rig that would confirm it is the blocker above. It
    is row-listed in the L-C4 parity census as a coach/athlete parity defect.
  - **Both card buttons reachable with the keyboard up: OPEN-UNKNOWN, and it is
    the thing to watch.** Every keyboard cell reads SOURCE; no keyboard has been
    raised in this repo. The card adds height to the strip that rides the keypad
    — if anything overshoots or sits under the keys, this is the slice that
    shows it.
  - It still ANSWERS the same three questions — `test:coach-tab-slice2`, 76 cells.
  - **And the thing I told you it refused — *"why is Friday heavy?"* — it did
    NOT refuse: it answered "Friday: Lower Squat."** You asked WHY and it told
    you WHAT. Fixed; it now says it has no answer, honestly — [2], *"a reason
    question about a day is placed as a REASON"* + *"Sam's own message is placed
    as a reason question"*. The Bible layer is what fills it.
  - **Tell me the first request it refused that it should have proposed.**

- **COACH SLICE 3 (2026-08-10).** **READ:**
  docs/COACH_SLICE3_BOUNDARY_2026-08-10.md ·
  docs/COACH_MOVE_DURABILITY_BOUNDARY_2026-08-10.md · gate
  `test:coach-tab-slice3` (**127 cells** — 116 at the slice, +11 for the tape's
  finding; **27 mutations, 27 red** across the suite's life).
  - **THE DOOR HAD NEVER RUN, AND WHEN IT WAS RUN IT DID NOT WORK.** The
    confirm handler passed the door `{ todayISO }` and every plan-change action
    needs a visible week, so the coach's move was inert while 116 cells stayed
    green — **all of them claims about which FUNCTION is called, and the defect
    was in an ARGUMENT.** Fixed; section [7] pins the argument and compares it
    to the sheet's. See the durability boundary above.
  - **ONE READING SEAM, NOT TWO READERS.** *"Can you move Friday to Sunday?"*
    carries an interrogative AND a move verb; two readers tried in sequence
    answer by table order, which is the slice-2 class exactly. The MARKER MATRIX
    was written before the resolver, as ordered — **eleven rows, seven matching
    three families at once**, and it is what reds when the precedence is
    reversed.
  - **THE CARD IS A PROJECTION OF THE ACTION** (L-C2). `changeCardFor` sees the
    action and the week and nothing else — no message, no request, no
    conversation — so card and change cannot drift. A kind it cannot draw gets
    no card, and `coachProposal` returns action-and-card together, so *"a
    proposed action without a card"* is unrepresentable.
  - **THE TRUTH GATE HAD NO VOCABULARY FOR A MOVE.** All fourteen forbidden
    phrases came from the substitution incident; none could catch a coach
    claiming a move it had not made. Three added, the confirmation worded in the
    first person so the gate can read it. **Measured, not assumed:**
    `test:coach-truth-gate` 61/61, and the frozen command-router's single red
    reproduces byte-identically against a restored baseline copy.
  - **THE REFUSAL RUNG CAME FREE.** Capability is checked before the destination
    is asked for — because L-C1 requires it — so *"why can't I move Saturday?"*
    is answered with the day's own recorded refusal, spoken verbatim.
  - **A DEFECT IN SLICE 2's SHIPPED CODE, found by needing two days:** day
    resolution walked `WEEKDAY_INDEX`, so the day the coach picked was decided by
    the order of `WEEKDAY_NAMES` rather than by the sentence. *"Am I training
    friday or monday?"* answered about Monday. Third sighting of an ordered table
    answering a question about specificity.
  - **TWO MUTATIONS SURVIVED AND BOTH WERE MY CELLS PASSING FOR THE WRONG
    REASON** — a sort no input could observe, and a no-card probe whose payload
    was missing the field rather than the kind. Re-aimed and re-probed, both red.
  - **THE L-C3 DEVICE FAILURE (inbox item 0) IS FIXED AT THE SHARED OWNER.**
    `KeyboardStickyView` lifted the footer and **nothing ever moved the body** —
    `flex: 1` inside a root that does not shrink, so the list ran behind the
    keypad. Hidden everywhere else because `KeyboardAwareScrollView` scrolls the
    FOCUSED INPUT clear, and **a screen whose input is in the FOOTER has no
    focused input in the body at all.** The body now reserves the keyboard's
    height off the same native frame the footer rides; the conversation pins to
    bottom on new content when already at bottom, and re-pins on
    `keyboardDidShow`. `test:keyboard-convention` 43/43.
  - **AND THE FREE DEVICE EVIDENCE HELD A DEFECT: *"why is Friday heavy?"* was
    NOT refused** — the day marker won and it answered with Friday's session
    list. Both the slice-2 boundary and this file said otherwise; **no cell held
    the claim.** Fixed as a `reason` subject, recognised positively and answered
    honestly — the arm the Bible layer lands on.
  - **NOT COVERED, first line: ~~THE DOOR HAS NEVER RUN~~ — PAID, AND IT WAS
    RIGHT TO WORRY.** The tape exists (`tape:coach-move-durability`), the door
    runs, and the run found the slice inert. What is still uncovered: **no
    React** — nothing is mounted, so render order, a stale closure and the
    settling effect's timing are outside what the tape sees; **one action kind,
    one week, L13 depth 1**; and the Undo TOAST over a coach move is
    OPEN-UNKNOWN. **Item 0 is fixed in SHAPE, not proven on glass** — every one
    of its cells reads source, no keyboard has been raised here, and the inset
    is a Reanimated layout animation only a device can judge.
    **No follow-up context:** both asks teach the whole shape because a bare
    *"friday"* in reply would be read as a question.

- **COACH SLICE 2 (2026-08-10).** `5ff09347` (the seat's parked ideas) ·
  `24617f53` (batch 30 ruled, the greeting signed) · `e533f1ec` (the slice).
  **READ:** docs/COACH_SLICE2_BOUNDARY_2026-08-10.md · gate
  `test:coach-tab-slice2` (76 cells, 11 mutations 11 red).
  - **THE GREETING IS SAM'S SENTENCE, VERBATIM, AND IT IS THE ONE BATCH-30
    STRING IN THE SIGNED-COPY SHEET.** A verbatim quote is the strongest
    provenance the sheet has. It ships AHEAD OF THE ABILITY by his own ruling;
    **the re-check condition (a beta gate before S3) is written in the module
    that holds the words and pinned by a cell**, not left in a doc.
  - **THE TRUTH GATE IS THE KEYSTONE, AND IT IS SALVAGE USED UNCHANGED.** Every
    answer runs past `validateCoachCommunicationTruth` with ZERO applied
    changes — the flag that arms `FORBIDDEN_WHEN_NO_APPLIED`. Read-only becomes
    a claim about the coach's MOUTH, not just its imports. **Proven to BITE on a
    real answer with a control beside it**, not on the validator.
  - **THE SALVAGE TARGET RESOLVER COULD NOT BE RE-POINTED, AND THAT IS THE
    FINDING.** `resolveCoachTargetFrame` consumes `ResolvedDay[]` — feeding it
    means a SECOND week representation in the coach's read path, the exact count
    the reassessment ruled against — and it imports a zustand store constant.
    **A salvage module written against a retired representation cannot be
    re-pointed without restoring the representation.** Slice 2 targets a DATE
    looked up in the week it was handed, which is what the ledger's own
    targeting law says a decision may name.
  - **THE READER RECOGNISES POSITIVELY.** No "is this a mutation" test and none
    needed: anything unplaced is `unknown` and the coach says so. **A negative
    test must be exhaustive to be safe; a positive one is safe by being
    incomplete.**
  - **THE IMPORT BAN WAS ONE HOP TOO SHORT AND SLICE 2 IS WHAT EXPOSED IT.**
    The cheapest way to hand the coach a store is now `rules/coachAnswer`, where
    slice 1's cell was not looking — the screen's list would stay spotless and
    the gate would stay green. It now sweeps the screen's `rules/` imports one
    hop out, **excluding `import type`, which is erased.**
  - **A REAL DEFECT FOUND BY PROBING, NOT BY A RED.** *"What am I doing on
    friday this week?"* carries a day marker AND a week marker; the table was
    searched in ORDER and the coach answered with the WEEK and never mentioned
    Friday — **72/72 green throughout, because no cell fed it a message matching
    two markers.** Now precedence is SPECIFICITY, not table order. **The class
    for S3: a first-match-wins resolver needs at least one input matching two
    rules, per pair that can co-occur.**
  - **NOT COVERED, first line: DEPTH 0, NOBODY HAS ASKED THIS COACH ANYTHING.**
    No keyboard case exercised — still the half L-C3 calls a gate failure, and
    it matters more now that the tab has to be TYPED into. **The reader has
    never seen a sentence Sam wrote**; the likeliest failure is a refused good
    question. **Batch 31 is PROPOSED, on the module not the sheet.**

- **COACH SLICE 1 (2026-08-09) — superseded above, kept for its findings.**
  `ee85c40e` (kickoff + mock as authored) ·
  `c25c8b77` (the slice) · `adab18df` (the survivor + the duplicate).
  **READ:** docs/COACH_SLICE1_BOUNDARY_2026-08-09.md · kickoff
  docs/COACH_REBUILD_KICKOFF_2026-08-09.md · gate `test:coach-tab-slice1`
  (57 cells at slice 1; **80 today** — the signing, slice 2 and slice 3 each
  added to it, and cells were re-aimed, none deleted).
  - **THE TAB MOUNTS THE REBUILD, NOT THE SCREEN R5.7 CUT.** `CoachScreen` and
    its stack stay frozen and UNREACHED — the kickoff's supersession answer to
    the parked 41,220-line question, started rather than promised.
  - **THE COACH'S WORDS FOR A DAY ARE THE WEEK ROW'S WORDS** —
    `visibleDayLeadHeadline`, the same call `HomeScreenV2` makes, asserted on
    both sides. Ruling 1 holds by construction, not by care.
  - **L-C1 IS RETURNED AS DATA:** the opener carries the `grounds` it used, so
    "the coach invented a fact" is a testable claim rather than a worry.
  - **READ-ONLY IS AN IMPORT BAN,** not a promise — module families, because a
    ban on a symbol is one rename from useless. **Zero new stored state.**
  - **A MUTATION SURVIVED AND IT WAS THE INTERESTING ONE:** `'Tuesday'` →
    `'Tues'` left 56/56 green, because the derived abbreviation `'Tue'` was
    still correct. Both cells true; the athlete reads "Game Tues".
  - **THE SWEEP FOUND A DUPLICATE PREDICATE THE CHAIN CANNOT SEE** — the same
    tab-count cell in two suites. Four suites censused, all four re-aimed to
    pin the SET rather than the count.
  - **NOT COVERED, first line: DEPTH 0, NOBODY HAS SEEN THIS SCREEN.** No
    keyboard case exercised — which is the half L-C3 calls a gate failure. The
    opener has never run over an accumulated world. **Batch 30 was PROPOSED at
    slice 1 and is RULED as of 2026-08-09 — see the slice-2 block above.**

- **THE OVERNIGHT COACH GROUNDWORK (2026-08-09 night).**
  **READ:** docs/COACH_DOORS_BOUNDARY_2026-08-09.md ·
  law doc docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md ·
  gate `test:program-control-decisions` (11 cells) ·
  instrument `npm run tape:exercise-edit-durability`.
  - **THE RULING: ten representations of one athlete sentence, and the ledger
    is not one of them.** The coach's output becomes a `ProgramControlAction`,
    the athlete's own door executes it, the ledger records it verbatim. Ten
    collapse to two. **The coach gets undo, replay and durability by NOT having
    a writer.** AGENTS.md requires this doc APPROVED before further coach
    pipeline code — tonight was door/engine work, which does not need it.
  - **A REAL BUG, MEASURED THEN FIXED: an athlete's own exercise edit did not
    survive a relaunch.** Tap remove, and it is back tomorrow with nothing shown
    and nothing logged. The survey filed this as an INFERENCE; the tape observed
    the three mechanisms together, then the fix made it durable. **Red before,
    green after, with a control proving the boot reproduces an unedited day.**
  - **ONE LEDGER KIND FOR A 26-MEMBER UNION** — `program_control`, carrying the
    action unchanged. **ZERO new stored state; north star TOWARD.** An
    allow-list keeps it honest: recording a type the boot cannot replay is worse
    than recording nothing.
  - **THE SIDE-WRITER CLASS GOT ITS CENSUS** (the compression `side-writer-
    outside-the-ledger` asked for, not a fourth per-kind fix): undo, then diff
    the WHOLE persisted envelope. **CENSUS CLEAN.** It found three side-writers
    before it found none — **all three were the instrument's own** (unflushed
    baseline, unequal relaunch, and a raw-string compare that read JSON KEY
    ORDER as drift).
  - **STILL HALF TRUE: two ledger destinations of five.** Injury, illness/
    readiness and setup answers are NOT on the ledger and were deliberately not
    attempted — they PERSIST today, so a ledger kind alone would be two stored
    representations of one input. They need the fact slices to leave
    `partialize` plus a migration, and **a mistake there loses facts that
    currently survive.**
  - **ITEM 3 RETURNED ZERO DELETIONS, AND THAT IS THE RESULT.** A real import
    graph says cutting `CoachScreen.tsx` makes **40 modules / 41,220 lines**
    unreachable — bigger than the survey's 28,160 name-scan lower bound, and 8
    of them are not named `*coach*`. But **the tree is rooted at the one module
    the order's rule protects** (`AppNavigator.tsx:10` imports it), so the rule
    has no consistent deletion set. The three apparently-orphaned modules were
    each checked and each KEPT — one is target-resolution SALVAGE, one is held
    by three suites, one was a COMMENT mention. **Sam's call, parked.**
  - **`a count taken for a record` — ELEVENTH AND TWELFTH SIGHTINGS**, both in
    my own new instruments on their first runs: `import type` counted as a
    runtime edge (it is erased — that alone made 6,296 lines look load-bearing),
    and a byte-compare of JSON read key order as a state change.
  - **NOT COVERED, first line: DEPTH 0, NO DEVICE EVIDENCE.** Only
    `remove_exercise` was driven end to end of the three allow-listed types; a
    swap's safety check on REPLAY is unexercised. **No coach turn was executed** —
    that the coach's vocabulary fits `ProgramControlAction` is a type-level
    reading of two unions, not a port, and is the likeliest place it is wrong.

- **⚠ SAM: REBUILD RELEASE AND OPEN IT.** The boot error screen was
  `missing_generation_anchor` — **neither of the two suspects.** His world was
  built across pre-2026-08-06 eras and never stored a generation anchor at all,
  so the boot refused **permanently** and Try Again was correctly useless.
  Held by `test:worn-world-boot`; **NOT ON GLASS — no device evidence.**

- **THE ANCHOR RECOVERY (fifty-sixth pass).**
  - **ROOT CAUSE, with receipts:** "the anchor rides the program it anchors"
    (Sam, 2026-08-06); `generateProgram.ts:998` is the only stamp and it
    postdates his program; the old-shape envelope migration carries the absence
    forward (`programStore.ts:361`). **Never written — not a wipe, not a
    partialize gap.**
  - **THE REFUSAL STAYS RIGHT.** `?? todayISOLocal()` deleted worn athletes'
    weeks; **nothing here reads the device clock.**
  - **THE WORLD IS ASKED WHAT IT REMEMBERS** instead
    (`rules/generationAnchorRecovery.ts`): stored anchor → **its own earliest
    microcycle start** → oldest ledger decision. **A world testifying to
    NOTHING still refuses, typed.**
  - **NO WRITE, NO NEW STORED STATE.** The recovery is derived; the rebuild
    re-stamps the anchor, so the world heals itself without reaching around the
    store's write owner.
  - **`wornWorldBootTests` CAUGHT IT AND WAS RE-AIMED, NOT LOOSENED** — its law
    is "do not invent today", never "always refuse". It now pins that a
    recovered world reproduces the athlete's weeks EXACTLY and never lands on
    today. **This is also the install-over reproduction the standing order
    demanded: red before, green after, on an ACCUMULATED world. The
    fifty-fifth pass's debt is PAID.**
  - **NEITHER SUSPECT FIRED.** (a) was real, mine, and fixed at `1682f6fd` —
    but it was not his failure. (b) was never implicated.

- **THE BOOT ARMOUR (fifty-fifth pass).**
  - **THE REGRESSION WAS MINE, at `ca89ff7f`:** `replayableEntries` throws on a
    row whose `decision` is missing, and it runs OUTSIDE the per-entry
    try/catch. Before the filter existed a bad row broke only its own replay.
  - **FIXED IN TWO HALVES:** every exported ledger reader is TOTAL (unreadable
    rows dropped and COUNTED, `unreadableEntryCount`); and the boot's **replay
    PHASE** is wrapped — not one kind, because the per-entry catch never covered
    computing the replay SET.
  - **GENERATION IS DELIBERATELY NOT CAUGHT.** Replay is recoverable; generation
    is not, and a blank app serves nobody better than the error screen. Cell
    [17] pins that scope in both directions.
  - **SUSPECT (b) — the deleted mark-writer — IS NOT CLEARED.** The fix would
    stop it being FATAL, which is a reason to expect his phone to open, not
    evidence of which suspect fired.
  - **ORDER 1 WAS NOT DONE AS SPECIFIED:** the install-over accumulated-world
    boot is still UNBUILT, and the order's own L13 point stands — my new cells
    are fresh-world cells too. **That is the next pass's first debt.**

- **⚠ SAM: THE FIRST THING TO LOOK AT ON THE PHONE — move a session on the
  Program screen.** A toast should say *"You moved a session"* with **Undo**.
  Tap it: the week goes back, and it stays back after a relaunch. **Nothing else
  changed on that screen.** Batch 29 is two words (`"You"`, `"Undo"`), PROPOSED. Held by
  `test:undo-reversal` and `npm run tape:lr29-undo-durability`;
  **NOT ON GLASS — no device evidence.**

- **THE UNDO UNIT — BUILT, GATED, WITH ITS CLASS STILL OPEN.**
  **READ:** docs/LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md (+ its addendum) ·
  rulings docs/UNDO_SHAPE_RULING_2026-08-09.md ·
  docs/UNDO_SURFACE_RULING_2026-08-09.md · gate `test:undo-reversal` (14 cells) ·
  instrument `npm run tape:lr29-undo-durability`.
  - **UNDO = APPEND A `reversal`, RE-DERIVE.** Two statements, **zero new stored
    state**, durable across a process death. The kind has been declared since
    R1.1 and inert; this is the heir `quiescentBoot.ts` named.
  - **§4 CLOSED BY DELETING A REPRESENTATION.** A move wrote a calendar `rest`
    mark that is not a decision, so undo could not take it back. **Sam had
    already ruled that exact write out of the sibling deletion door on
    2026-07-30**, and the move's own constraint already owned the emptiness. The
    write is gone; nothing was added to the undo door.
  - **THE TOAST IS UNDO'S ONLY SCREEN-LEVEL AFFORDANCE** (surface ruling: the
    bar and sheet are dead, change-talk belongs to the coach tab). It **reads the
    ledger** rather than being raised by ten call sites, so every door gets it by
    existing.
  - **THE CLASS IS OPEN:** undo is proven complete for **one** decision kind.
    `side-writer-outside-the-ledger` sighting 1 — the compression rule is a
    CENSUS of decision side-writers, not another per-kind fix.
  - **COPY GATES GREEN IS NOT EVIDENCE:** batch 29 lives in `rules/`, invisible
    to the extractor. On the module, **not on the sheet.**
  - **PARKED to the coach kickoff:** undo of a COACH-authored decision. The
    mechanism does not read provenance, so it would currently offer one.

- **THE HIDE** (`7f9e54ab`, ruling committed as authored first at `47312bd9`;
  native rebuild artifacts at `77f5e415`).
  **READ:** docs/JOURNAL_HIDDEN_BOUNDARY_2026-08-09.md
  - **R5.7's shape exactly: ENTRY SURFACE GONE, MACHINERY FROZEN NOT DELETED.**
    One `Tab.Screen` block removed at the navigation owner. Restoring it is one
    block. Nothing deleted, no copy withdrawn, **batches 15-28 stay signed**.
  - **THE FINDING: "unreachable = nothing can ever fire" is HALF TRUE.** True of
    every future schedule — the opt-in has one product caller and it is the
    hidden screen. **False of a schedule already accepted: the OS is this
    feature's store and it outlives the surface.** Tapping one would have
    navigated to a tab that no longer exists, which THROWS, with the athlete not
    yet in the app.
  - So: tab removed, tap door removed, **cancel added on mount** through the
    service's existing door. Stateless, idempotent, **no new stored state —
    north star NEUTRAL.**
  - **THE TWO DATA-CREATING TAPS STAY** ("How did that go?", the post-game
    legs/energy rating) — seat-ruled, **Sam's veto open**. They live on
    `SessionFeedbackPanel`, and the gate proves that screen still REACHABLE hop
    by hop rather than merely present.
  - **NEW GATE `test:journal-hidden`, 35 cells** — the gate must watch the
    deleted surface. **6 cells re-aimed, none deleted. 9 mutations, 9 red.**
    M6's first probe was a prefix of its own mutation and **the harness refused
    to read the result** instead of reporting a survivor.
  - **`a count taken for a record` — TENTH SIGHTING**, in the new gate on its
    first run: the opt-in sweep read its own OWNER as a second caller. The
    instrument counted a NAME; the claim was about CALL SITES.

- **GATE:** full `test:bible` **UNPIPED `GATE_EXIT=1` at
  `test:program-control-durable`, 1 FAIL cell** — *"a move committed durably
  reaches the visible week"*, main's declared red, 92 suites reached.
  `test:compile` PASSED, totals byte-identical to baseline (35/51/373).
  **Sweep 2 of 174** = the declared set exactly
  (`program-control-durable`, `fixture-identity`). **The denominator did NOT
  move this pass — `tape:coach-move-durability` is a TAPE: it asserts nothing,
  prints a measurement, and is deliberately not in the chain. Section [7] of
  `test:coach-tab-slice3` is what the chain sees of its finding.** Previously,
  **the denominator moved 173 → 174 in the commit that earned it**
  (`test:coach-tab-slice3`). Previously: **the denominator
  moved 172 → 173 in the commit that earned it** (`test:coach-tab-slice2`).
  Previously: **The denominator
  moved 171 → 172 in the commit that earned it** (`test:coach-tab-slice1`,
  which sits past the chain's exit — the sweep is what proves it).
  **THE DENOMINATOR MOVED 169 → 170 IN THE COMMIT THAT EARNED IT**
  (`test:undo-reversal`), and it still names its instrument: chain steps /
  `npm run` suites / **sweep suites** are three different units (the sweep
  runner excludes `test:compile`). **`test:undo-reversal` sits PAST the gate
  exit at position 92, so the chain never reaches it — the sweep is what proves
  it green.**

- **THE LR-29 REPLAY UNIT IS OPEN — UNDO IS ITS FACE** (Sam's addendum,
  docs/REPLAY_UNIT_KICKOFF_2026-08-07.md; dependency list at
  docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md). **The opening law held:
  built from the measured map, item 1 first, no serial discovery.**
  **READ:** docs/LR29_ITEM1_BOOT_REPLAY_TAPE_2026-08-09.md ·
  instrument `npm run tape:lr29-boot-replay` (NOT in `test:bible` — it asserts
  nothing and prints a measurement).
  - **ITEM 1 IS NOT ANSWERED, AND THE PROBE IS WHY.** `6 → 6 → 6`: a whole-day
    delete put **nothing** in the accumulator, so "the boot reconstructed it"
    and "there was nothing to reconstruct" are the same reading. Reporting that
    beat opening the unit on a vacuous green.
  - **AND THE REASON IS A CONDITION, NOT A GAP.** A typed reduction is not what
    a delete produces — it is what a delete produces **when the week cannot
    absorb it** (`userRemovalConstraints.addFrequencyReduction`: *"relocation
    and substitution were exhausted"*). The world was reached correctly and the
    probe was too easy. **Item 1 is ONE ACT away, not one investigation away:
    delete enough of a pattern that §18 cannot repair it, then photograph.**
  - **EVERY REDUCTION IN THAT WORLD IS GENERATION-AUTHORED POLICY**
    (`game_load_protection` ×3, `deload_policy` ×3) and survives because **the
    boot re-generates** — no ledger replay involved. The athlete's delete landed
    in `userRemovalConstraints`, which the boot DID reconstruct (1 → 1).
  - **THE FIND WORTH CARRYING INTO THE BUILD: the answering RUNG moved while
    the answer did not.** A past week's overlay did not survive the boot and the
    door answered from the covering microcycle instead — row-for-row identical,
    so nothing visible changed, **which is exactly why it would never be
    noticed.**
  - **THE INSTRUMENT'S OWN DEFECT, CAUGHT MID-RUN:** the first photograph read
    `programStore.exposureContractsByWeek` and reported ZERO contracts in all
    three worlds. **The declaration lives on the overlay or the covering
    microcycle** — it now asks through `selectStoredWeekDeclaration`, the door
    every reader uses.
  - **ITEM 2 IS A DESIGN FORK NEEDING A RULING, not a measurement:** the
    ledger's six kinds cannot express illness, injury, readiness or phase, so
    replay consumes ledger + fact stores, or the ledger gains R3's fact
    decisions first. **Undo's SHAPE IS RULED — one step (2026-08-09), and the
    fork above is no longer abstract: the calendar-mark finding is that same
    §3 fork, reproduced in the athlete's most visible feature.**

- **COACH REBUILD IS OPEN AND SLICES 1 + 2 + 3 ARE LANDED** (see the top of this
  file). **The greeting's second sentence — *"I can … make changes to your
  program"* — is TRUE as of slice 3, for one kind.** S4 (*it knows how you're
  tracking*) is next and is NOT started. Sam's note still
  governs S4: **the journal's behind-the-scenes record — load, regions, feel,
  niggles — is an INPUT to coach intelligence.** That is why the data layer
  stayed live and why every journal suite is pinned in the chain.
  Ten unordered coach feature ideas are parked at
  docs/PARKED_QUESTIONS/COACH_WOW_IDEAS_2026-08-09.md (`5ff09347`, the seat's,
  committed as authored). **Item 4 — ASK WHY ABOUT ANYTHING — is the named gap
  between S2's kickoff line and what slice 2 delivers.**

- **STRUCK BY THE HIDE:** C4 (the week bars' colours), the three proof answers,
  "March 2025", 08:00 as the hour, the restored lifts line, the in-app off
  switch. **The weekday `+1` conversion is now unproven AND unprovable without
  restoring the tab** — the proof panel lives on the hidden screen. Closed by
  removal, not by an answer.

- **STILL OPEN, NOT THIS UNIT:** the **~150 `label:` strings across 20+
  `utils`/`rules` modules** invisible to both copy gates. Legacy
  `JournalStack`/`JournalHome`/`RouteEnum.JOURNAL` in `src/types/navigation.ts`
  — type-only debt from the OLD purged journal tree, named not hunted. **No
  instrument distinguishes "shipped" from "shipped and reachable"** — the sheet
  now records ~100 signed strings that are present and unreachable.

- **STILL TRUE FROM THE MERGE (2026-08-07, `89b540f9`):** main carries Stage B
  stages 1 + 2; a green main went to a **2-red main knowingly** —
  `test:program-control-durable` + `test:fixture-identity`, the declared set
  exactly. **`fixture-identity`'s payer is the LR-29 replay unit** — re-measured,
  it goes GREEN under `LFA_FLIP_DOOR=1`. That is the unit opening now.
- **DEFERRED, NOT FORGOTTEN:** coaching QUALITY — *"labels are okay but the
  programming is pretty shit"*, docs/COACHING_QUALITY_EXHIBITS_2026-08-07.md.
- **WATCH-FORS still open on Sam's device:** completed-day display at the next
  completed session; the three fallback sheets; stale-banner Review; the
  team-training affordance.
- **INBOX CONVENTION:** an empty queue is written `(none)`. **Numbering no longer
  matters in either direction** (`f168b48b`) — the hook reads content, and a
  numbered empty marker is still recognised as empty. **The seat's half: orders
  are 1, 2, 3, newest first; urgency belongs in the words, not in inventing
  `00.`.**
- **Standing:** `test:bible` is the ONLY official gate, unpiped, per commit — and
  it **stops at the first failing suite**, so anything after position 92 needs
  the sweep. `npm run test:bible:parallel` is a NON-OFFICIAL fast pre-check.
  Verify `git branch --show-current` before every commit (shared worktree).
