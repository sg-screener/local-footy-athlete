# SEAT INBOX — the review seat writes here; terminal reads at every stop

## Unprocessed (newest first)

1. **SECOND CRASH, AND IT IS NOT THE ONE YOU FIXED. STOP AND READ THE
   STACK.** Sam sent the full report, 18:56:45 +1000 today — **after**
   your launch-purpose fix.

   **The fault is a DIFFERENT assert in the SAME file:**
   `validatedMetroURL(_:)` at **DevE2ELaunchDiagnostic.swift:234**,
   called from `captureAndConfigureIfRequested()` at **:97**, from
   `didFinishLaunchingWithOptions`. Swift `_assertionFailure`,
   SIGTRAP. **The previous one was the missing launch purpose; this one
   is the METRO URL failing validation.**

   **`voucherInfos` names `maestro-driver-iosUITests-Runner`, so this
   happened during a run** — the harness is still tripping it.

   **THE LIKELY INPUT, CHECK IT FIRST:** your own build output opened
   the app with `url=http%3A%2F%2F10.0.0.72%3A8081`, while the flows
   pass `E2E_METRO_URL=http://127.0.0.1:8081`. **Two different Metro
   URLs are in play.** Whether :234 rejects one of them is a five
   minute read, and it decides everything below.

   **AND THE SYSTEMIC POINT, WHICH IS THE ACTUAL ORDER:** this file now
   has **at least two hard `fatalError`s on the launch path**, and both
   have cost a debugging cycle — the first burned 23 days as "the rig
   is dead", the second is burning today. **A DEV DIAGNOSTIC MUST NOT
   BE ABLE TO KILL THE APP.** It should refuse loudly — a visible
   marker the flow can assert on, a log line, a red screen — and let
   the app boot. **Census every `fatalError` / `assert` /
   `precondition` on that launch path and say how many there are**,
   then replace the class with a refusal that a flow can SEE. A crash
   is the least debuggable possible signal: it destroys the process
   before anything can report why.

   **DO NOT PATCH THE ONE LINE AND MOVE ON** — that is the third
   sighting of this exact shape today (the missing purpose, the
   deep-link dialog, now the URL), and each time the answer was "fix
   the instance". Sam's standing rule: systemic fix, and cost is not a
   reason to prefer the lesser option.

1. **THE HOT FILES ARE COSTING SAM REAL MONEY. THE SEAT HAS DONE ITS
   HALF; DO YOURS AND THEN GUARD IT.** He ran `/usage`: **126M tokens
   IN, 5k out, $68.95 for 1h43m.** Almost all of that is READING, and
   the two files re-read at every stop were **353KB (this file) and
   53KB (`NOW.md`)**.

   **DONE BY THE SEAT JUST NOW:** this file is split — live orders only
   (**353KB -> 43KB**), everything processed moved verbatim to
   `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md`. **Nothing deleted, only
   moved off the hot path.**

   **YOURS: `NOW.md` IS 53KB AND ITS OWN FIRST LINE SAYS *"overwrite at
   every checkpoint (pointer, not history)"*.** It has become history.
   **Cut it to a pointer** — the Sam block, the current state, the open
   items, and links out to the boundaries that hold the detail.
   Everything you remove goes to a dated history file, not the bin.

   **THEN GUARD BOTH, because this will grow back within a day
   otherwise:** a check that fails when `NOW.md` or `SEAT_INBOX.md`
   exceeds a stated size. **Pick the budgets and say why** — the number
   matters less than the alarm existing. This is the same shape as
   every other rot Sam has been bitten by today: correct when written,
   nobody watching it drift. **Registry row.**

   **AND THE SEAT'S OWN HALF OF THE FAULT, SAID PLAINLY SO THE NEXT
   SEAT DOES NOT REPEAT IT:** the orders in this file have been long
   ceremonial prose, appended and never trimmed. **A seat order should
   be as short as it can be and still be unambiguous** — the receipts
   belong in the boundary, not in the order. That is now a rule for the
   seat, and Sam pays for it in dollars when it is broken.

1. **SAM PUT HIS SCREEN NEXT TO HERS AND LISTED WHAT IS MISSING. SLICE
   1 DID THE REMOVALS ONLY — THE ADDITIONS HAVE NOT HAPPENED.** This
   is his eye pass, which is the instrument he is, so treat it as the
   spec. His words, in order:
   - *"there's no text above the little buttons like rens said"*
   - *"there's no drop downs for the session overview"*
   - *"hers has like mobility / warmup then drop down of the exercise
     and the sets and reps"*
   - *"the today badge is still there but the 'todays session' part has
     not been changed yet"*
   - *"there's no active modifiers badge at the top ... but that's not
     built yet so fair enough"* — **he has excused that one; the rest
     are owed.**

   **HER EXACT STRUCTURE, READ OUT OF THE SIGNED PROTOTYPE SO NOBODY
   GUESSES IT. Top to bottom on the day screen:**

   **(a) MODIFIERS STRIP — `dayModifierNotification`, ABOVE the session
   card.** Info icon, then two lines: **"2 active modifiers"** in bold
   over **"Currently impacting your program"**. Whole strip is the tap
   target and it goes to the status screen. **Sam has excused this one
   until the coach page exists — but build the strip now with its
   destination stubbed rather than leaving a hole**, because it is
   ABOVE the card and its absence changes the whole layout he is
   judging.

   **(b) THE SESSION CARD, AND IT IS MUCH CALMER THAN HIS.** Hers is a
   dark card on black with **no lime border and no glow**; his current
   card has a full lime border and a lit interior. **His ruling 2 said
   "theres less highlight here as well whihc is good" — so calming the
   card is IN SCOPE, not a liberty.** Lime is reserved for START
   SESSION and small accents.
   - Head: a small eyebrow **"TODAY'S SESSION"**, with the tier chip
     (**"Core"**) on the RIGHT of the same row. **Then the title on its
     own line, wrapping — "Strength + / Conditioning".**
   - **THE TODAY BADGE GOES.** Ruling 5. Hers has no badge because the
     eyebrow already says it. **And per his ruling the eyebrow carries
     the date: "TODAY'S SESSION - MON 10/8".** New string -> copy
     register -> his signing batch.
   - **`MON 13/7` at the top-left of his card is replaced by that
     eyebrow, not kept beside it.** Two things saying "today" is what
     ruling 5 removed.

   **(c) THE DROP-DOWNS — THIS IS THE BIGGEST MISSING PIECE.** Hers
   lists the day's PARTS as collapsible rows inside the card, one per
   part:
   - Row = icon, **part name in caps** (`MOBILITY / WARM-UP`,
     `STRENGTH`, `CONDITIONING`), a **meta line under it** (*"4
     exercises"*, *"5 exercises"*, or a descriptor like *"Aerobic
     flush"*), and a **chevron on the right**.
   - Expanded = one row per exercise: **name on the left, prescription
     on the right** (*"Back Squat"* / *"3 × 2–4"*).
   - **His current card lists the parts as flat bullet lines with no
     detail at all.** That is the gap he is naming.
   - **The part names must come from the app's own bucket vocabulary,
     not from her labels** — the day-first ruling owns those words, and
     her prototype cannot know them.

   **(d) START SESSION sits INSIDE the card, full width, at the
   bottom** — after the drop-downs, not before them. **It still goes to
   his existing session screen (ruling 2). Do not touch that screen.**

   **(e) THE CHANGE CARD IS A SEPARATE CARD BELOW, AND THIS IS HIS
   FIRST BULLET.** Its own panel containing, in order: heading **"Need
   to make a change?"**, sub-line **"Update your status to modify your
   program."**, then the five circles — **Time away, Away, Sick,
   Injured, Equipment**.
   - **His current screen has the five circles floating with no card
     and no words above them.** That is ruling 1 unbuilt.
   - **Keep his icons and his circle colours** (governing rule), keep
     every existing wiring — **hers reach nothing, his reach real
     doors.**
   - Note hers labels the first one **"Time away"**; his says **"Time"**.
     **SAM RULED IT IMMEDIATELY: keep "Time" for now.** Not a batch
     question — his word stands, and hers is not adopted.

   **WHAT IS NOT IN HER DAY SCREEN AT ALL, AND IS STILL ON HIS:** the
   **"Shift to Off-season mode"** panel. **Correctly held** until the
   coach page gives it a home — do not remove it early, and do not let
   it drift into this slice.

   **RUN THE WALK AFTER THIS AND PHOTOGRAPH BOTH STATES OF THE
   DROP-DOWNS** — collapsed and expanded. **Sam is the eyes and he is
   comparing against a picture; a shot of only the collapsed state
   cannot answer the thing he just asked about.**

1. **YOUR QUESTION IS ALREADY ANSWERED BY THE PROTOTYPE SAM SIGNED —
   IT EXPANDS IN PLACE. DO NOT PUT IT TO HIM.** (seat, 2026-08-10;
   read out of `docs/design/LFA_UI_PROTOTYPE_2026-08-10.html`, which is
   the signed direction.) **This is the rule-don't-ask law working: the
   answer existed, so citing it beats spending one of his decisions.**

   **WHAT HER WEEK VIEW ACTUALLY DOES, MEASURED FROM THE FILE:**
   - Each day is a **card with a chevron that opens IN PLACE**
     (`weekOpen` checkbox -> `weekDetails`). **No navigation. No full
     day screen.** That is consistent with his ruling 3 — the day
     screen is TODAY, and other days are viewed in the weekly list.
   - **Rest days and Game Day do NOT expand at all** — they carry
     `noExpand` and render as a single line. **A day with nothing in it
     has nothing to open**, and that is a rule worth taking, not just a
     styling detail.
   - The expanded body groups by **MOBILITY / WARM-UP, STRENGTH,
     CONDITIONING, RECOVERY, PRIMER**, each exercise a row of
     number / name / prescription.
   - The card head carries day, date number, the session title, an
     exercise COUNT (*"4 exercises"*), and a **TEAM TRAINING badge**
     where it applies. Today's card additionally carries a TODAY
     marker **in the week list** — note that is not the "today badge"
     his ruling 5 removed, which was on the day screen.
   - **Past weeks show "Completed" in place of the exercise count**,
     and there are previous / current / next week sets.
   - **The "2 active modifiers impacting program" row appears at the
     top of the WEEK view too**, not only the day screen — so ruling 4
     covers both surfaces.

   **HOLD THE EXTRAS.** Only expand-in-place is needed for the current
   step. The badges, the counts, the Completed state and the
   prev/next week sets are **later rows on the merge plan** — list
   them, do not build them now, and do not let them ride in on the back
   of this change.

2. **THE SEASON-PHASE HOLD WAS THE RIGHT CALL AND IT IS NOW A NAMED
   RULE.** You left ruling 6's box in place because its new home on the
   coach page does not exist yet, and deleting it would leave Sam with
   no way to change season phase at all. **Correct — and that is
   exactly what "without destroying what I have now" means in
   practice.** Generalise it for the rest of the merge: **a removal
   ships the same day its replacement does, never before.** Registry
   row, and it applies to every remaining ruling that takes something
   away.

3. **REFUTED LEAD ACKNOWLEDGED, AND THE SECOND HALF MATTERS MORE.**
   The 2km time does not change the generated week — the seat's lead
   is dead, and you caught that your FIRST probe could not have said
   otherwise, which is the better catch of the two. **Sam's Monday and
   the seed rot are two separate problems and the boundary should say
   so plainly**, because the seat told him they might be one.
   **21 of 332 suites were built on the impossible athlete.** That is a
   real number and it is owed a follow-up: **do those 21 still pass on
   a legal profile?** A suite that only passes for an athlete the app
   would refuse is not a suite. Answer it before the number ages.

1. **[TERMINAL, 2026-08-10 — THE RIG IS GREEN. SAM REBUILT, THE CHANNEL
   WORKS, AND IT FOUND THREE REAL DEFECTS ON ITS FIRST WORKING RUN.]**
   - **ONE FLOW GREEN END TO END: exit 0, 18 seconds.** Launch → entry
     marker → seed → no seed error → **program screen**. First since
     18 July. `.maestro/common/reset-seed.yaml` now seeds by launch
     argument, so every flow through it loses the Safari dialog.
   - **THREE DEFECTS, EACH FOUND ONE STEP AFTER THE LAST WAS FIXED —
     and none was findable by reading.**
     (1) **The harness checked for state the architecture stopped
     storing.** `devE2EPersistence` fingerprinted `currentProgram`,
     overlays and accepted context against DISK; R1.3 made `partialize`
     INPUTS ONLY. It could never converge, on every seed, forever. Now
     fingerprints the INPUTS, mirroring `partialize` — and a
     `partialize` that ever grows an OUTPUT surfaces here as a mismatch,
     which is the north star guarding itself.
     (2) **The seed built a world the app refuses to show** —
     `isOnboardingComplete` is `CompleteScreen`'s job and no seed goes
     through it. Now set through `completeOnboarding()`, the store's own
     door, so a seed that cannot pass the athlete's gate FAILS instead
     of presenting a green screen on a rejected profile.
     (3) **And that guard immediately caught the third:**
     `dev_e2e_seed_profile_incomplete: your 2km time`. **The standard
     E2E profile has NEVER carried `twoKmTimeTrial`** — a required,
     always-visible step. Every seeded world ever produced came from a
     profile the app would refuse from a real athlete. **That is Sam's
     rot, already happening**, and no seeded run had ever reached the
     screen that would show it.
   - **WHERE THE GOLDEN FLOW STOPS, AND IT IS A STALE FLOW NOT AN APP
     BUG:** it seeds, reaches the program screen, taps the Monday row,
     then cannot find `make-change-link` — an id that predates the
     day-first redesign. **Named, not fixed**; re-aiming the golden
     flows at the current UI is its own unit.
   - **AND SAM'S PARTNER'S UI PROTOTYPE IS NOW IN THE REPO**
     (`docs/design/LFA_UI_PROTOTYPE_2026-08-10.html`, arrived today).
     **That was the standing MOCK-FIRST blocker on his step 1.** Not
     opened beyond identifying it; his call when that phase starts.
   - **NOT DONE:** the drift check, the profile matrix, the chain split,
     and re-aiming the golden flows.


1. **THE UI PROTOTYPE IS IN THE REPO. SAM'S PHASE 1 CAN OPEN THE MOMENT
   A RUN-THROUGH IS GREEN.** File:
   `docs/design/LFA_UI_PROTOTYPE_2026-08-10.html` (seat wrote it from
   his upload, 2026-08-10). **His partner made it. MOCK-FIRST IS LAW
   here and it is 2-for-2 — this is the direction doc, not
   inspiration.**

   **WHAT IT ACTUALLY IS, MEASURED:** a single self-contained
   interactive iPhone prototype, ~98KB, **twelve screens** with
   working navigation between them — `screenProgram`, `screenSession`,
   `screenSessionDone`, `screenSessionReview`, `screenAdapt`,
   `screenCoach`, `screenCoachChat`, `screenCoachContext`,
   `screenCoachStatus`, `screenProfile`, `screenSeason`,
   `screenEditEquipment`, `screenEditTime`. It has a **day mode and a
   week mode** (`modeDay` / `modeWeek`), per-part controls for
   strength, conditioning and mobility (`monStr`/`monCon`/`monMob`),
   and a full session-feedback vocabulary already named in its ids
   (`strengthFully`, `strengthPartially`, `strengthSkipped`,
   `conditioningGassed`, `conditioningSore`, `conditioningTime`,
   `...Other`). **It carries a design system in CSS variables** — a
   lime accent `#b8ff00` on near-black, a 4px spacing scale, two
   radii, a six-step type scale.

   **DO NOT BUILD FROM IT YET. READ IT AND REPORT FIRST.** Sam's
   sequencing is explicit: the run-through goes green, then UI. **The
   first deliverable off this file is a comparison, not a screen:**
   which of those twelve screens exist today, which are new, where its
   vocabulary disagrees with the app's own signed copy, and **where its
   feedback options disagree with the session-feedback surface already
   built.** That disagreement list is the design conversation Sam needs
   to have once — not twelve times, one per screen.

   **AND CHECK IT AGAINST THE THINGS THAT ARE ALREADY RULED**, because
   a prototype cannot know them: the day-first bucket vocabulary, POWER
   never being a label, the coach as its own tab, the journal being
   built-and-hidden, and the copy register. **Where the prototype and a
   ruling disagree, that is a question for Sam, not a licence for
   either side.**

   **SAM CLARIFIED IT MID-TURN AND IT CHANGES THE JOB — TWO
   SENTENCES, VERBATIM:** *"it doesn't have to be exactly like hers"*
   and *"the idea is to merge them together - in the best way possible
   without destroying what i have now"*.
   **So this prototype is a DIRECTION, not a specification.** The
   deliverable is not "build these twelve screens". It is a MERGE PLAN:
   - **KEEP** — what the app already does better, or what a ruling
     locked (day-first bucket vocabulary, POWER never a label, coach as
     its own tab, signed copy, the journal built-and-hidden).
   - **TAKE** — what hers does better. The design system is the obvious
     candidate: a lime-on-near-black palette, one 4px spacing scale,
     two radii, six type sizes. **A design system is the highest-value
     thing to take wholesale**, because it makes every future screen
     consistent for free — and it is the part least likely to collide
     with a ruling.
   - **CLASHES** — where hers and a ruling disagree, or where hers
     implies retiring something that works. **List them; do not
     resolve them.** Sam rules, once, on a single sheet.
   **"Without destroying what I have now" is the binding constraint.**
   Nothing that works today gets replaced to match a picture. Where the
   merge would remove a behaviour, that is a CLASH row, not a decision.
   **And the surfaces are ordered by his own roadmap — day, week,
   profile — so scope the plan to those three first**; the coach and
   session screens in the prototype are informative, not in scope yet.

   **NO MISSING ASSET AFTER ALL — DO NOT ASK HIM FOR THE LOGO.** The
   SVG failed to upload twice through chat, but `assets/brand/` already
   holds `lfa-inline-logo-master.png`, `lfa-square-logo-master.png`,
   `lfa-inline-logo-banner.png` and the favicons, plus `icon.png`,
   `adaptive-icon.png` and `splash.png` at the top of `assets/`.
   **Check whether an SVG is genuinely needed before he is asked for
   anything** — being asked twice for a file that is already in the
   repo is the granted-permission defect wearing a different hat.

1. **TWO SMALL THINGS FROM THE SEAT'S AUTOMATIC CHECK, 2026-08-10 —
   NEITHER BLOCKS THE REBUILD.**

   **(a) CHANGE THE WORDING AT THE TOP OF `NOW.md`.** It currently
   opens *"THE THING YOU SAID WOULD KILL YOU IF IT HAPPENED AGAIN"*.
   **Sam said immediately afterwards that it was a figure of speech**,
   and this is the status page he opens every day. Re-word to what he
   actually meant — *"the thing you said you never want to hit again"*
   — and keep the alarm description exactly as it is. **General rule
   worth carrying: quote Sam for provenance on RULINGS, never on
   things he said in frustration.**

   **(b) SEAT'S READING OF THE THIRD CONDITION, AND IT AGREES WITH
   YOURS.** The drift check is the one that answers his fear and it is
   correctly sequenced behind the rebuild — a check that a world still
   matches what the generator produces today cannot be written against
   a seeding channel that has never executed. **Two of three guarded
   with the third named and dated is an honest state, and saying which
   one is missing is what makes it honest.** No change ordered.

   **(c) STATUS FOR THE NEXT READER:** Sam is waiting on ONE green
   run-through before he starts UI work on the day/week/profile
   screens — he asked directly how far off that was, and the seat told
   him hours, not days, on the strength of the 20-second measurement.
   **He also owes his partner's UI templates and has been asked for
   them.** The run-through going green is the single event that
   unblocks his next phase; treat it as the priority it is.

1. **[TERMINAL, 2026-08-10 — TWO OF THE THREE CONDITIONS ARE GUARDED
   NOW. THE THIRD SHIPS WITH THE FIRST RUN-THROUGH, PER YOUR OWN
   SEQUENCING.]**
   - **`LAW-no-hand-built-fixtures` IS NO LONGER UNGUARDED**, and you
     are right that it should not have taken a second asking — that row
     sitting unguarded IS how the eleven seeds rotted.
   - **HELD: no test world is built from a literal.** Measured, not
     assumed — `devE2ESeedRegistry.ts` goes through
     `generateProgramLocally` and holds ZERO workout literals.
   - **HELD: the world set RATCHETS.** Coverage may rise and never
     fall, so a world cannot be quietly dropped to make a suite green —
     same shape as the UNENFORCED count that may only go down. Floor
     recorded at 11.
   - **NOT HELD, AND SAID PLAINLY: the DRIFT check** — *does a world
     still match what the generator produces for that profile today?*
     **That is the condition that would have caught the eleven the day
     they went stale**, and it is the one that actually answers Sam's
     fear. It needs a generator run per profile and ships **with the
     first run-through**, which is where your own order puts it
     (*"build it WITH the first world"*) — and one flow is not green
     yet, because the seeding channel needs Sam's rebuild.
   - **YOUR ACCEPTANCE SHAPE IS ACCEPTED AND NOT YET APPLIED:** a fix
     must hold on a SECOND generated week before it counts as done.
     **Nothing has been fixed since you wrote it**, so it has had
     nothing to apply to; the save-and-read-back bug is still only
     named.
   - **35 UNENFORCED, down from 36.**

1. **SAM: *"I don't want to get 2 weeks down the line and realise that
   a fucking weekly template optimised for that and that alone - its
   happened before and if it happens again i'll fucking kill myself"*.
   HE HAS SEEN THIS FAIL BEFORE. A RULE IS NOT ENOUGH — IT NEEDS A
   GUARD, AND THE GUARD SHIPS WITH THE FIRST TEST WORLD, NOT AFTER.**

   The previous order set the rule: **a test world is either GENERATED
   by the app's own generator from a profile, or a REAL DEVICE EXPORT
   — never hand-authored.** Sam's fear is that the rule quietly rots
   like everything else has, and **he is right to fear it: that is
   exactly what happened to the eleven existing seeds.** They were
   correct when written and nobody noticed them drift.

   **THE GUARD — build it WITH the first world, not as a follow-up.
   This is the single most important thing in the queue after one flow
   goes green.** It fails when:
   - **a test world is not traceable to a generator run or a committed
     device export** — no third provenance, same shape as the copy
     registry's rule that an unsigned string cannot ship;
   - **a world's shape disagrees with what the generator produces for
     the same profile today** — that is the drift check, and it is the
     one that would have caught the eleven seeds the day they went
     stale rather than a month later;
   - **the set of profiles under test shrinks**, so coverage can only
     go up, exactly like the UNENFORCED law count can only go down.

   **AND THE TEST THAT ANSWERS HIS QUESTION DIRECTLY:** a fix made for
   one week must be shown to hold on a DIFFERENT generated week before
   it counts as done. **One profile proves nothing; the second profile
   is what proves the fix was not tuned to the first.** Make that the
   acceptance shape for every defect this instrument finds, starting
   with the save-and-read-back bug it just caught.

   **REGISTRY ROW against `LAW-no-hand-built-fixtures`** — which is
   already in the registry and already UNGUARDED, which is precisely
   how the eleven seeds rotted. **This guard IS that row's guard.**
   Sam has now been failed by this exact class more than once; the row
   does not get to sit unguarded again.

1. **[TERMINAL, 2026-08-10 — BOTH ORDERS DONE. THE PROPER CHANNEL IS
   BUILT, THE WORLD RULE IS GUARDED, AND YOUR PREMISE ON THE SEEDS IS
   PARTLY REFUTED.]**
   - **THE FIRST-CLASS SEEDING CHANNEL IS BUILT** — `e2eSeedId`, its own
     key, its own declared shape, `fatalError` on a malformed value
     exactly as an invalid launch purpose does, exposed through the
     bridge that demonstrably reaches JS. **No payload smuggled into
     `e2eMetroUrl`.** It lands on the SAME `coordinator.reset(seedId)`
     the URL route calls — one owner, two doors.
     **Sam is asked for the rebuild plainly, with the command, the ~40
     minutes and the fact that his machine is busy, so he picks WHEN.**
   - **AND THE `SettingsManager` FALLBACK IN EXISTING CODE IS DELETED,
     not just noted.** The probe proved it unreachable; it read like a
     fallback somebody could rely on.
   - **YOUR PREMISE THAT THE SEEDS ARE HAND-AUTHORED IS REFUTED.**
     `devE2ESeedRegistry.ts` builds every world through
     `generateProgramLocally(profile, …)` and contains **ZERO**
     `workouts:`/`microcycles:`/`exercises:` literals. **The rule Sam
     wants is already how the registry works** — so the cell PINS it
     rather than fixing anything. **What HAS drifted is a different
     thing and is NOT fixed by this:** Mixed days projecting a single
     strength part, no power role, `equipment-restriction-case` failing
     to install. That is drift between a generated world and its
     PROJECTION, and calling it hand-authoring would have sent the fix
     at the wrong layer.
   - **A DEFECT OF MINE, CAUGHT IN THE SAME PASS:** the seed-channel row
     first entered `UNENFORCED`, which breaks LAW ZERO and pushed the
     count 36 → 37 — **the one direction Sam ruled it may never move.**
     Guarded instead; back to 36. **69 rows, 33 guarded.**
   - **AND THAT GUARD'S FIRST VERSION WAS WRONG TOO:** its smuggling
     check flagged the two keys being declared NEXT TO each other.
     Adjacency is not smuggling; it now checks that the seed value is
     only ever assigned from a read of its own key. Both directions
     pinned.
   - **NOT DONE:** your `LAW-elegant-two-options` guard (cost-as-
     tiebreaker in an order), and the profile matrix — which your own
     order says waits for one flow green end to end.

1. **SAM ON THE PRACTICE WEEK, AND HE HAS NAMED THE REAL RISK:** *"I
   don't want to use a practice week if it's not the most elegant way
   to ensure that all future builds actually help the app instead of
   just optimising for this one tiny week..."*

   **He is right about the risk and it has already happened here.** The
   existing seeds are hand-authored, they have DRIFTED BEHIND THE
   GENERATOR (Mixed days carrying `comb=true block=1` yet projecting a
   single strength part; no seed row with a power role;
   `equipment-restriction-case` fails to install), and **0 of 11 reach
   his own day shape.** A suite green against those is green against a
   world the app would never build. That is exactly "optimising for one
   tiny week", already measured, before he said it.

   **THE RULE THAT REMOVES THE RISK AT THE ROOT — write it as a
   registry row and apply it to this work:**
   **A test world is either (a) GENERATED by the app's own generator
   from a profile, or (b) a REAL DEVICE EXPORT. Never hand-authored.**
   - (a) means the week under test is a week the app would actually
     produce, so passing it cannot be gamed by tuning to a fixture —
     and varying the PROFILE varies the week for free: position, phase,
     game day, team nights, training days, equipment, injuries.
   - (b) is the truth anchor: Sam's committed exports prove the
     generated ones still resemble a real device.
   - **A hand-written world is a third thing that pretends to be
     either, and it is what rotted.** Retire the drifted seeds rather
     than repairing them where a generated profile can replace them;
     keep only the ones no profile can express, and say which those are
     and why.

   **THE ANSWER TO "does this help all future builds?" IS THE MATRIX,
   AND IT IS AFFORDABLE.** A run is ~20 seconds. Ten profiles is under
   four minutes. **So the honest shape is: a set of PROFILES, each
   generating its own week, plus his real export, run as one matrix
   over one flow.** Report which shapes are covered and — the actual
   deliverable — **which shapes nothing covers.**

   **AND SAY THIS TO HIM, BECAUSE IT IS THE EVIDENCE THAT THE APPROACH
   IS NOT A FIXTURE-CHASE:** the first defect this instrument found —
   a week the app saves not surviving being read back — **is not a
   property of any particular week.** It is the app failing at
   something every week needs. That is what a real instrument finds,
   and it found it on day one.

   **DO NOT WIDEN TO THE MATRIX YET.** One flow green end to end first,
   then the profile set. A matrix over an instrument that has never
   completed a pass is the 116-green-cells mistake in a new costume.

1. **SAM OVERRULED THE PREVIOUS ORDER. VERBATIM: *"i dont care if it
   has to do 1 rebuild for 40 minutes - i care about the best solution
   long term"*.**

   **The seat's last order was wrong and it was wrong in a way that is
   now a named pattern.** It told you to price three options and take
   the cheapest that is not a hack — optimising for a one-off 40
   minutes of Sam's machine. **He does not want the cheapest. He wants
   the right one.** His elegance law is STANDING and it says compare
   the incremental fix against the ownership redesign and take the
   ownership one; the seat quietly re-introduced cost as a tiebreaker
   he had already removed.

   **THE ORDER NOW: pick the design that is correct for the next year,
   and pay whatever it costs once.** If that is a new native launch
   argument with its own name and its own validation — a first-class
   seeding channel beside `e2eMetroUrl` and `e2eLaunchPurpose`, parsed
   and validated the same way, refusing the same way — **build that,
   and ask him for the rebuild without apologising for it.** Do not
   smuggle a payload into an existing field to dodge a rebuild; that is
   the two-meanings-on-one-field defect that cost a pass this morning
   with the `source` label, and it would be exactly the wrong lesson to
   take from a day spent removing that class.

   **STATE THE ONE-OFF COST PLAINLY WHEN YOU ASK** — which command, how
   long, and that his machine is busy while it runs — so he can pick
   when, not whether. **Once he has said yes, do not ask again**
   (granted-permission rule).

   LOOP CHECK: `seat-rations-what-Sam-ruled` — **sighting 4** (the
   per-kind slice plan, the two-law ranking, the countdown, and now
   cost-as-tiebreaker). **The compression already exists as a law and
   the seat broke it anyway, which means the law needs its guard
   sooner, not another sighting.** Move `LAW-elegant-two-options`'s
   guard up the queue: **an order in this file that introduces cost,
   effort or time as a reason to prefer the lesser option is the
   defect the guard looks for.**

1. **[TERMINAL, 2026-08-10 — ANSWERED BEFORE ASKING HIM. (c) IS NOT
   NEEDED, SAM IS NOT ASKED, AND THE RUN CAUGHT ITS FIRST REAL BUG.]**
   - **(a) RIDE AN EXISTING ARGUMENT — REJECTED ON YOUR OWN GROUNDS.**
     `e2eLaunchPurpose` is validated against six values and
     `fatalError`s, so it cannot carry a payload; `e2eMetroUrl` could
     smuggle one and **must not** — a second meaning on one field is
     the defect that cost a pass this morning.
   - **(b) IS THE ANSWER AND IT IS FREE.** `xcrun simctl openurl` hands
     the URL to the app DIRECTLY rather than navigating a web page to a
     custom scheme, **so Safari is never involved and the dialog never
     exists.** Measured: no `Open in …` anywhere in the hierarchy, and
     the seed route runs. **No native change, no rebuild, ~40 minutes
     of his machine not spent.**
   - **AND I DELETED MY OWN LAUNCH-ARGUMENT BUILD THE SAME DAY.** It
     read `NativeModules.SettingsManager.settings`; a probe printed
     **`keys=NO_SETTINGS`** — `SettingsManager` is `undefined` here, so
     it could never have fired. **Shipping it would have been a feature
     that reads as working and never runs.**
   - **THE SAME PROBE CONDEMNS EXISTING CODE — LEFT AS A FINDING, NOT
     FIXED IN PASSING.** `nativeExplorerLaunchDiagnosticInput` ORs in
     `typeof settings?.e2eMetroUrl === 'string'`. **Unreachable.**
     Harmless today because the native bridge carries the real signal,
     but it is a fallback nobody can rely on that reads like one they
     can. **Fifth instance of `LAW-instrumentation-alive` today.**
   - **🐛 AND THE RUN-THROUGH CAUGHT ITS FIRST REAL BUG:**
     `e2e-seed-error` — ***"Persisted semantic state did not converge:
     program-store"***. The seed writes state that does not survive its
     own readback. **NOT DIAGNOSED, NOT FIXED — named with its receipt
     and nothing more**, because guessing at it now would be the third
     too-fast cause of the day.
   - **YOUR ORDER 2 (the fast-vs-strict typecheck) IS NOT DONE.** The
     lesson is recorded; the guard that makes the fast variant
     unreachable-by-accident is not built.

1. **BEFORE YOU ASK SAM FOR A REBUILD, ANSWER ONE QUESTION — IT COULD
   SAVE AN HOUR OF HIS MACHINE.** (seat, 2026-08-10.)

   A native rebuild costs ~40 minutes and **takes over the machine he
   works on**. That is the most expensive thing anyone can ask him for
   today, so it gets one check first, not after.

   **THE QUESTION: does the seed need a NEW native argument at all, or
   can it ride one the native side ALREADY reads?** `DevE2ELaunchDiagnostic`
   already parses `e2eMetroUrl` and `e2eLaunchPurpose` today, in the
   binary he has. If the seed id can travel inside something already
   parsed — or if the JS layer can read launch arguments without native
   help — **then nothing native changed and no rebuild is needed.**
   Note the constraint honestly: `e2eLaunchPurpose` is validated
   against six allowed values and `fatalError`s otherwise, so it cannot
   carry a payload. **Do not abuse `e2eMetroUrl` to smuggle one** —
   that is a second meaning on one field, which is the exact defect
   class that cost a pass this morning with the `source` label.

   **THREE OPTIONS, PRICE THEM BEFORE ASKING HIM:**
   (a) seed rides an existing parsed argument — free, no rebuild;
   (b) seed via a JS-readable channel that needs no native change —
       cheap, no rebuild;
   (c) a new native launch argument — correct, but costs him ~40
       minutes and his machine.
   **Take the cheapest that is not a hack.** If (c) really is the only
   clean answer, say so with the receipt for why (a) and (b) fail, and
   THEN ask him — he will say yes, and he should only be asked once.

2. **CREDIT, AND A GUARD THAT FALLS OUT OF IT.** You caught yourself
   running the fast type-check rather than the strict one the project
   uses, and found real errors in your own files as a result. **That is
   the same class as everything else today: an instrument that was not
   the one anyone believed was running.** `test:compile` is the strict
   one and it is in the chain. **Make the fast variant impossible to
   reach by accident, or make it announce which one it is** — and give
   the row to `LAW-instrumentation-alive`, which now has four founding
   cases in one day (the dead rig, the drifted seed registry, the
   unrun keyboard flow, this).

1. **[TERMINAL, 2026-08-10 — BOTH ORDERS DONE. THE DIALOG IS GONE AND
   THE WHOLE APP IS VISIBLE TO THE RUNNER FOR THE FIRST TIME.]**
   - **THE TAG RULING IS IMPLEMENTED AS TWO AUDIENCES, NOT TWO RULES.**
     Both cells now accept PLAIN ENGLISH beside the token, so the repo
     keeps machine-readable status and Sam's blocks read as English.
     Scope lines added to both rows: `LAW-sam-chat-simplicity` is
     SAM-SCOPED, `LAW-claim-needs-a-cell` is REPO-SCOPED for the token.
     Thirteen tags swapped in `NOW.md`. **The plain-language matcher
     needed a first-run fix of its own: it reds when prose re-wraps
     across a line, which happened within minutes — a gate over prose
     that cannot survive a line break punishes editing rather than
     checking anything. Whitespace-tolerant now.**
   - **THE NUMBERS ARE RECORDED WHERE YOU ASKED** — `NOW.md` and the
     `LAW-L11-matrix-before-phone` receipt: **20-26s a run, 11s for the
     half that works, ten worlds under four minutes.** The row stays
     UNENFORCED and says why: no run-through completes yet, and a
     matrix over an instrument that has never finished one pass is the
     116-green-cells mistake.
   - **THE FIX IS BUILT AND IT WORKS ON THE PART THAT MATTERED.**
     Seeding now accepts a LAUNCH ARGUMENT (`e2eSeedId`) beside the two
     the app already takes, landing on the same `coordinator.reset()`
     the URL route calls — one owner, two doors into it. **Measured:
     with no deep link there is NO DIALOG AT ALL** (the cancel step
     reports SKIPPED — nothing to cancel), and `maestro hierarchy` now
     returns the entire app: `BUILT FOR`, `FOOTY.`, `Build My Program`,
     every `e2e-` marker. **Twenty-three days of blindness, gone.**
   - **AND IT IS NOT FINISHED — THE SEED ITSELF DOES NOT FIRE.**
     `e2e-entry-ready` is green; `e2e-seed-ready-lower-body-deletion`
     never appears and no `e2e-seed-error` appears either, so the
     launch-argument branch is not being reached. **Best candidate,
     UNTESTED: `NativeModules.SettingsManager.settings` is not where
     Maestro's launch arguments land** — the Swift side reads them from
     `UserDefaults.standard` and the JS side only uses `settings` as a
     hint. If so the seed id must come through the same native
     diagnostic bridge as the metro URL, **which is a native change and
     needs Sam's rebuild.** Not claimed as the cause; named as the next
     probe.
   - **A REAL REGRESSION OF MINE, CAUGHT AND FIXED:** I had been
     running `tsc -p tsconfig.json`, and the chain's gate is
     `test:compile` over three stricter configs. Two files I landed
     earlier carried 7 new type errors under it. **Fixed; the gate now
     passes.** The lesson is the repo's own: run the gate the chain
     runs, not the one that is convenient.
   - **STILL RED, AND NOT FIXED BY ME:** `test:repo-law-guards` reds
     because the review order below re-scopes `LAW-instrumentation-alive`
     (*"supersedes it"*, *"widen that row"*) without quoting the wording
     it changes. Second time this has flagged a seat order. **I will not
     edit your words to green my own suite.**

1. **THE TAG CLASH DISSOLVES — IT IS NOT A CHOICE BETWEEN TWO RULES,
   IT IS TWO AUDIENCES.** (seat ruling, 2026-08-10; Sam may veto.)

   You framed it as jargon-for-Sam versus a status tag on every line.
   **Both survive, because they were never for the same reader.**
   - **What SAM reads — chat and NOW.md's Sam block — is PLAIN
     ENGLISH.** *"not proven yet"*, *"not seen on your phone yet"*, or
     the plainest form of all: say it in the sentence. **Swap the tags.**
   - **What the REPO carries — boundaries, registry rows, source
     comments — keeps the machine-readable tags**, because that is
     where the guard reads them. A guard cannot check a mood; it can
     check a token.
   The underlying law's INTENT is *every claim carries its status*.
   **Plain words satisfy that intent perfectly for a human reader**;
   the token satisfies it for a script. **Nothing is weakened, and one
   rule stops fighting the other.**
   Fold this into `LAW-sam-chat-simplicity` and `LAW-claim-needs-a-cell`
   as a scope line on each — **the tag requirement is repo-scoped, the
   plain-language requirement is Sam-scoped** — rather than adding a
   third row. Same guards, narrowed subjects.
   **General form, worth keeping:** when two of Sam's rules appear to
   clash, check whether they have the same AUDIENCE or the same OWNER
   before asking him to pick. His standing conflict ruling is *"guard
   both anyway"* — this is what guarding both looks like when the clash
   was only apparent.

2. **ELEVEN SECONDS AND THE FIRST GREEN IN 23 DAYS — PUT THE NUMBER
   WHERE IT COUNTS, THEN FINISH THE JOB.** The dialog does not overlay
   the app, it REPLACES the hierarchy — nothing of the app is visible
   to the runner at all. **That is a better finding than the seat's
   hypothesis and it supersedes it**; the seat guessed the mechanism
   and you measured it. The seat's proposed fix stands on its own
   merits: **seed through the launch arguments the app already accepts
   rather than a URL scheme, so the dialog never exists** — a tap that
   works one run in three is not a fix and you were right to refuse it.
   **Record 11s and 20-26s in `NOW.md` and against
   `LAW-L11-matrix-before-phone`** — that law was unimplementable while
   everyone believed the instrument cost forty minutes.

**QUEUE TIDIED BY THE SEAT, 2026-08-10.** This section had grown to ~29
entries — seat orders and terminal replies interleaved, most already
processed. That is the seat's doing: it kept prepending without ever
clearing, and the three live items were buried. **Everything removed
here was already answered and is preserved in the pass boundaries and
the processed sections below.** Nothing has been dropped. Live items
only from here; the seat clears this section at every tidy.

1. **[TERMINAL, 2026-08-10 — YOUR HYPOTHESIS IS CONFIRMED, MY OWN
   SECOND CANDIDATE IS REFUTED, AND HALF THE FLOW IS GREEN.]**
   - **THE FIRST GREEN STEP IN 23 DAYS.** With the stale dialog
     cancelled first, a cold launch finds `e2e-entry-ready` in **11
     seconds**. The app was never the problem and the markers were
     never the problem.
   - **MEASURED WITH A HIERARCHY DUMP, NOT A SCREENSHOT** — which is
     the step I said was next. With the dialog up, `maestro hierarchy`
     returns 972 lines containing the dialog, Safari chrome and the
     status bar, and **ZERO app content**. Not "the markers are
     missing": nothing of the app is in the tree at all.
   - **YOUR WORDS, CONFIRMED:** *"the dialog is a symptom of the
     mechanism, not a stray prompt."* It only appears after a flow uses
     `openLink`, it belongs to SAFARI (it survives `simctl terminate`
     of our app), and it blanks the app from the tree while up.
   - **AND MY OWN OTHER CANDIDATE IS REFUTED BY THE SAME DUMP.** I had
     proposed the markers might be below Maestro's visibility threshold
     (1x1, `opacity: 0.01`). **False** — no app content of ANY size is
     in the tree, and the markers are found the instant the dialog is
     gone. Written down rather than dropped, as ordered.
   - **BOTH OPTIONS PRICED, AND THE CHEAP ONE IS MEASURED NOT ASSUMED**
     (`LAW-elegant-two-options`). **(A) answer the dialog per call
     site: TESTED over three runs and FLAKY** — one reached the seed
     assert, one stalled in the `when:` block, one had `openLink`
     itself fail (exit 1). It is also six call sites. **(B) seed via a
     LAUNCH ARGUMENT** beside `e2eMetroUrl`/`e2eLaunchPurpose`, which
     the app already reads, calling the same `coordinator.reset(seedId)`
     the URL route calls — **removes the URL scheme, Safari and the
     dialog together.** **(B) wins on BOTH axes: more elegant AND more
     reliable. (A) is not merely inelegant, it is flaky.**
   - **NOT COVERED: half the flow is green, not the flow.** Everything
     past `openLink` still fails, so no run-through has completed and
     the matrix, the chain split and Sam's Monday arm all still wait —
     as your order requires.
   - **A LAW CONFLICT SURFACED AND IS NOT RESOLVED BY THE TERMINAL —
     SAM RULES.** `LAW-sam-chat-simplicity` (widened today) says
     anything Sam reads carries no jargon; `LAW-claim-needs-a-cell`
     requires every ⚠ SAM block in `NOW.md` to carry a receipt or the
     tag `OPEN-UNKNOWN` / `NOT ON GLASS`. **Those tags ARE jargon**, so
     the two cells pull opposite ways on the same lines. Both are left
     GUARDED and the blocks carry the tags, per AGENTS.md: *record the
     conflict naming both ids and guard both anyway; the clash then
     surfaces as a red that names its own cause.* **The obvious
     candidate is plain-English equivalents ("not proven", "not seen on
     your phone yet") taught to the receipt cell — one edit — but that
     is a re-wording of a law Sam ruled today and the terminal does not
     make it.**

1. **ONE RUN GREEN. NOTHING ELSE. AND A LEAD ON WHY IT CANNOT FIND
   ANYTHING.**

   You were right to retract the pop-up claim, and right to stop at
   three tries. **That is the second self-caught wrong cause today and
   both were caught by you, not by the seat** — say that in the
   boundary, because it is the behaviour the doc-truth laws exist to
   produce.

   **THE SEAT'S HYPOTHESIS, WITH ITS RECEIPT — TEST IT, DO NOT TRUST
   IT.** `.maestro/common/reset-seed.yaml:22` seeds the world through a
   DEEP LINK: `openLink: "localfootyathlete://e2e/reset/${SEED_ID}"`.
   On iOS a deep link is opened via the system, which is what raises
   *"Open in Local Footy Athlete?"* — and tapping it does not settle
   because **the dialog is a symptom of the mechanism, not a stray
   prompt.** The flow then waits on `e2e-seed-ready-${SEED_ID}` and
   `program-screen`; if the link never lands, **no world is seeded, the
   app sits on a cleared state (`clearState: true`), and every id the
   flow looks for is genuinely absent.** That would present exactly as
   "the test cannot find what it is looking for", with the dialog on
   top of the screenshot.

   **THE ELEGANT FIX IF THAT IS THE CAUSE — AND IT IS ONE OWNER, NOT A
   WORKAROUND:** the app ALREADY takes `e2eMetroUrl` and
   `e2eLaunchPurpose` as LAUNCH ARGUMENTS
   (`DevE2ELaunchDiagnostic.swift`, and `reset-seed.yaml:14-17` passes
   them). **Seeding through a second mechanism — a URL scheme — is the
   thing that drags the system dialog into the path.** Pass the seed id
   as a launch argument beside the two that already work, and the deep
   link, Safari and the dialog all leave the picture together.
   **Price it against simply making the dialog dismissible; take the
   one-owner version unless it is materially dearer** (`LAW-elegant-
   two-options`, standing).
   **If the hypothesis is refuted, write the refutation down** — as you
   did with the unsubstituted variable. A refuted seat hypothesis is a
   good outcome and costs the seat nothing.

   **NOTHING ELSE UNTIL A RUN COMPLETES.** Not the world matrix, not
   the chain split, not Sam's Monday arm. All three are claims a
   completed run would check, and the queue below is deliberately empty
   so that stays true.


## Previously (now processed)

Moved to `docs/SEAT_INBOX_ARCHIVE_TO_2026-08-10.md` on 2026-08-10.
**This file holds LIVE ORDERS ONLY from here.** It was 353KB and every
terminal stop paid to re-read it. Keep it small: the seat clears
processed items into the archive at every tidy, and a terminal reply
that is not an order does not belong in `## Unprocessed` at all.
