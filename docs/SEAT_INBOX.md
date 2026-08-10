# SEAT INBOX — the review seat writes here; terminal reads at every stop

## Unprocessed (newest first)

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


## Processed 2026-08-10 (sixty-sixth pass) — THE WALK IS GREEN, THE CRASH IS THE HARNESS'S OWN TRAP, AND A DEV LOG BANNER HAD BLINDED THE TAB BAR

**Full report: `docs/UI_SAFETY_NET_BOUNDARY_2026-08-10.md`.**

- **THE NET IS GREEN.** `.maestro/golden/day-week-profile.yaml` walks seed → day
  shape → week shape → back → profile → coach → program, exit 0, with a
  screenshot at each surface into `artifacts/ui-walk/`. **Sam's precondition for
  touching screens is met.**
- **THE CRASH IS ATTRIBUTED, CATEGORY (b), WITH THE RECEIPT.** All three
  `.ips` reports today fault in
  `DevE2ELaunchDiagnosticReceiptOwner.captureAndConfigureIfRequested` /
  `validatedMetroURL`, inside `didFinishLaunchingWithOptions`, **with no JS
  frames at all** — a deliberate `fatalError` that only arms under `#if DEBUG`
  when the runner supplies `e2eMetroUrl`. **A release athlete cannot reach it.**
  Two of the three predate this session, so it is not from today's boot edits.
  **Cause: `checkpoint-and-reload.yaml` relaunched with no `e2eLaunchPurpose`.
  Fixed.**
- **SIX DEFECTS, EACH BEHIND THE LAST.** The shape (one day drawn, not seven);
  the tap (today's card centre is now the timeline, which navigates); **the
  LogBox banner over the tab bar — the same wall §8 already recorded once, now
  answered with one rule instead of a second remembered string**; a false
  "legacy world" alarm on every healthy seeded boot (boot read the anchor's
  MIRROR, not its home); the missing launch purpose; and **an OPEN one:
  the seeded world keeps four game days in memory and one on disk.**
- **THE ELEMENT-NAME CONTRACT IS BUILT AND MUTATION-PROVED.**
  `npm run test:maestro-element-contract`. It reddens on the three ids design
  rulings 7-8 deleted and greens when they are re-aimed. **Its two limits are
  printed by the gate itself** — existence is not reachability, and a template
  hole absorbs a word. **It lands RED on one declared orphan:**
  `component-deletion-reload.yaml` taps a session-screen door the redesign
  removed and nothing replaced — that one needs a ruling, not a patch.
- **STILL RED, NAMED NOT CLAIMED:** `one-set-feedback` (un-investigated stale
  id), `fixture-move` (dead `fixture-actions-open`), `reload-standard-week` and
  the three `action-trace-v2` flows (blocked on the persistence question).
- **NOT DONE:** the merge plan, the drift check, the 2km experiment, the
  seed-consumer census, and ruling 4 against the coach architecture. **One
  observation offered as a fact and not a conclusion: the standard seed now
  photographs a Monday reading "Strength + Conditioning" — the day shape Sam
  says 0 of 11 seeds reached — and that seed gained a real 2km time yesterday.**

## Processed 2026-08-10 (sixty-seventh pass) — THE 2KM LEAD IS REFUTED, AND THE CENSUS IS 21 OF 332

**Full report: `docs/TWO_KM_LEAD_AND_SEED_CENSUS_2026-08-10.md`. Probe kept at
`_twoKmLead.ts` so the refutation is re-runnable.**

- **REFUTED, and cleanly.** One variable — `twoKmTimeTrial` — same anchor, same
  acceptance, same block. **Conditioning-carrying workouts: 4 of 20 in BOTH
  arms. Strength-and-conditioning on one day: 4 in BOTH arms.** Week 1 is
  identical field for field. **The impossible profile and the day-shape defect
  are SEPARATE threads**; the month of not reproducing Sam is not explained by
  the missing time. Not stretched to fit.
- **THE FIRST PROBE WAS VACUOUS AND IS REPORTED AS SUCH.** It read 0
  conditioning in BOTH arms and would have "refuted" from an instrument
  incapable of any other answer. The day-walk screenshot taken an hour earlier
  shows that Monday reading "Strength + Conditioning", which is what exposed it:
  the generator carries conditioning as `hasCombinedConditioning` /
  `attachedConditioningKind` / `conditioningFlavour`, not as a component row.
  **The verdict stands on the corrected probe only.**
- **A SECOND OBSERVATION, A QUESTION NOT AN ANSWER:** the standard seed DOES
  reach a combined day — but as an attached `optional_flush` aerobic component,
  not a standalone conditioning session. **So "0 of 11" and this measurement may
  be counting different things.** It cannot be settled from disk:
  `device-export-2026-08-10-sam-monday-wednesday.json` is a SUMMARY and carries
  no workouts. Naming the gap rather than guessing across it.
- **THE CENSUS: 21 SUITES OF 332 (6%), NAMED.** Transitive import closure from
  `DEV_E2E_STANDARD_PROFILE` outward, so helper-reached suites are counted: 25
  files, 4 of them helpers, **21 runnable scripts, every one listed in the
  report**. The other 311 never touch the profile. **Their green was never
  wrong downstream** — Part A shows the field changed nothing about the
  generated week — **but it never covered the completeness gate**, which is
  precisely why the defect survived.

## Processed 2026-08-10 (sixty-eighth pass) — THE MERGE PLAN IS WRITTEN, RULING 4 RESOLVED WITHOUT SAM, AND ONE QUESTION IS OWED

**Full plan: `docs/UI_MERGE_PLAN_2026-08-10.md`.**

- **RULING 4 CHECKED AGAINST L-C1/L-C2/L-C4 BEFORE A LINE WAS WRITTEN, AND IT IS
  NOT A LAW TENSION** — so it does NOT go to Sam. L-C4 is about coach ability
  derived from the athlete's buttons, and ruling 4 changes their ADDRESS, not
  their existence; L-C2 governs coach-PROPOSED changes and "my status" is the
  athlete tapping their own control; L-C1 governs the coach's mouth.
  **The real hazard is two kinds of mutation on one tab**, and it is answered
  with a binding rule instead of a question: **"my status" MOUNTS the existing
  doors (`handleOpenPhaseShift`, `handleCoachNoteAction`…), it does not build
  new ones — a new door there is a second representation of a decision that
  already has one.**
- **THE REMOVAL LEDGER IS COMPLETE: six removals, six destinations, nothing
  orphaned.** Every row names the current call site and where the behaviour
  goes. **No sheet of orphans is owed.**
- **FIVE SLICES, EACH WITH ITS GUARD AND ITS SCREENSHOT SET.** Slice 1 is pure
  removal and blocked by nothing. **Slice 2 is blocked: `one-set-feedback.yaml`
  is its guard and is RED.**
- **ONE QUESTION FOR SAM, ASKED ONCE** (in the plan's own sheet): with the day
  strip gone, **tapping Thursday in weekly view — open in place as it does
  today, or go to a day screen for Thursday?** Both fit his ruling; everything
  else in the nine is decided.
- **PROFILE IS IN HIS SCOPE AND NO RULING TOUCHES IT.** Stated rather than
  dropped: there is no profile work in this plan.
- **A CLAIM IN THE FIRST DRAFT WAS WRONG AND WAS CORRECTED BEFORE COMMIT** — it
  said only the walk names `week-strip`. Six assertions across two flows do.
  Counted, not assumed.

## Processed 2026-08-10 (sixty-ninth pass) — MERGE SLICE 1 LANDED, AND THE ONE REMOVAL WITHOUT A HOME WAS HELD BACK

- **SLICE 1 IS IN: rulings 3 and 7.** The day strip is gone; the buttons no
  longer appear under weekly view. **The walk was run after the screen, not at
  the end** — green, all four surfaces re-photographed. No colour, font or icon
  touched.
- **RULING 6 WAS HELD BACK ON PURPOSE, AND THAT IS THE RULING BEING OBEYED.**
  Its destination is the coach page's "my status", which does not exist yet.
  Deleting the phase-shift card now would leave the athlete with **no way to
  change season phase at all** until a later slice — a real hole dressed as
  progress, against *"without destroying what i have now"*. **A removal ships in
  the same commit as its destination.** Rulings 3 and 7 shipped now precisely
  because weekly view and the day screen already exist.
- **THE GUARDS MOVED WITH THE SURFACES, IN THE SAME COMMIT.** Six `week-strip*`
  assertions across two flows INVERTED to `assertNotVisible`; `day-timeline`
  takes over as the day shape's witness; ruling 7 asserted BOTH ways so the cell
  cannot pass by the chips vanishing everywhere.
- **`LAW-durable-write-is-never-silent` IS BORN GUARDED** and in the chain, so
  item 6 cannot age quietly: every dropped durable write now names its store and
  counts repeats. **It does not claim the drop is correct** — that ownership
  question is still unpriced, and six flows stay red behind it.
- **`LAW-instrumentation-alive` HAS THE FOUNDING TEXT THE PATTERN EARNED:** a
  blocked instrument does not hide zero defects, it hides an unknown number, and
  the count is only knowable by unblocking it — three defects on run one, six
  more on run two, same day, same staircase.
- **`test:maestro-element-contract` IS IN `test:bible`, GREEN**, which took
  re-aiming its one orphan onto the live per-component removal ids and saying in
  the file that only the DOOR is verified.

## Processed 2026-08-10 (seventieth pass) — BOTH FOUNDING CASES ARE IN THE REGISTRY, WITH NUMBERS

- **`LAW-no-hand-built-fixtures` now carries the founding case in its own
  receipt:** every practice week here was built from a profile the app would
  have refused from a real person, and no instrument could see it because the
  completeness gate lives on a screen no seeded run had ever reached.
  **CENSUS: 21 of 332 scripts, counted by transitive import closure, listed.**
  **AND THE FOLLOW-UP WAS RUN AND REFUTED** — with and without the 2km time the
  generated week is IDENTICAL, so their green was never wrong downstream; what
  it never covered was the gate itself.
- **`LAW-instrumentation-alive` carries the sequencing lesson as its founding
  text:** a blocked instrument does not hide zero defects, it hides an unknown
  number, and the count is only knowable by unblocking it.
- **THE DRIFT CHECK — the third condition of `LAW-no-hand-built-fixtures` — IS
  STILL NOT HELD**, and the row still says so.

## Previously (now processed)

**Item 00 of the sixty-fifth batch is processed — the gate is flipped and the
chain is red.** Items 000, 0, 1, 2, 3 and 4 remain OPEN; the sweep of 19 guards
is the standing work. (Of the sixty-fourth batch, items 0, 1, 2 and 3 were
processed and **item 4 (glass) is a MEASURED STOP** — `npx expo run:ios
--configuration Debug` had still not finished compiling; it is carried above.)

## Processed 2026-08-10 (sixty-fifth pass) — `UNENFORCED` IS RED, AND THE CHAIN STAYS RED UNTIL EVERY LAW HAS A GUARD

- **ONE LINE: the registry's default is flipped — `test:law-registry` is the last
  link of `test:bible` and FAILS while any row reads `UNENFORCED`. 19 of 28 laws
  have nothing holding them, and that is now a failing chain rather than a
  backlog.**
- **WHAT THE RED MEANS, so nobody misreads it:** the app did not break tonight.
  **The app has never been checked against 19 of its own rules, and from now that
  counts as failing.** A rule with nothing watching it is a rule not followed.
  The gate prints exactly that sentence in its own failure text.
- **WHAT IT CHECKS, five cells + liveness:** row shape and unique ids · every
  guard names a script that EXISTS (the cell that would have caught the
  `test:athlete-action-walker` ghost) · declared `chainStatus` matches
  `package.json` · no guard outside the chain · **NO LAW IS UNENFORCED**. Every
  checker is a pure function and the liveness cell feeds each one a fabricated
  bad row — including the real ghost — so a green here cannot be vacuous.
- **PLACEMENT IS LAST, DELIBERATELY.** `test:bible` is an `&&` chain: a red stops
  everything behind it. Last means the red costs no coverage — every other suite
  has already run and reported. The chain's verdict is red; its information is
  intact.
- **NO HIGH-WATER MARK, NO GRANDFATHERING, NO DATED DEBT.** All three were the
  seat's softenings in item 0 and item 00 withdrew them; the gate implements the
  withdrawal. AGENTS.md LAW ZERO gains the section stating it, plus the two
  rulings that survive from item 0: **process laws get repo-check guards** (an
  unmechanisable law is a finding with a proposed re-wording put to Sam, never a
  quiet UNENFORCED row) and **a conflict never leaves either law unguarded**.
- **MEASURED, NOT CLAIMED.** `npm run test:law-registry` → exit 1, 6 passed 1
  failed, prints `LAW REGISTRY: 28 rows, 9 guarded, 19 UNENFORCED`.
  `test:totals-or-red-law` green with the new suite discovered (173 chain
  suites). `test:compile` PASSED — no file regressed. **Mutation:** removing the
  gate's own line from the chain reds exactly the two chain cells
  (`chainStatus` truthful, `no guard outside the chain`) and nothing else.
- **DOC-TRUTH REPAIRS IN THE SAME COMMIT:** `lawRegistry.ts`'s header said "THIS
  FILE IS DATA. IT IS NOT A GATE, AND THAT IS DELIBERATE" — corrected.
  `docs/LAW_REGISTRY_BATCH1_2026-08-10.md` said the gate was NOT BUILT BY ORDER
  and counted 20 — corrected, with the live number pointed at the script.
- **NORTH STAR:** toward. No stored state added; the gate DERIVES its facts from
  `package.json` and the registry, so there is no second list to forget.
- **UNENFORCED COUNT: 19 of 28.** That is the only status.

## Processed 2026-08-10 (sixty-fourth pass) — THE LAW REGISTRY, AND THE CONSERVATION ORDER PRICED WRONG-UNIT

- **ONE LINE: Sam's root question is answered with a number — 28 laws in Batch 1,
  20 with NOTHING holding them — and the registry corrected two of its own rows
  within hours, including one naming a guard script that does not exist.**
  `7d3be742` (registry + item 3) · this commit (pricing).
  Boundary: docs/LAW_REGISTRY_BATCH1_2026-08-10.md ·
  docs/CONSERVATION_POSTCONDITION_PRICING_2026-08-10.md
- **ITEM 0 — THE REGISTRY.** `src/rules/lawRegistry.ts`, machine-readable, two
  states and no third. AGENTS.md gains **LAW ZERO**, effective immediately,
  subsuming the claim-in-prose-only rule. Gate over the registry deliberately NOT
  built, per the order. 131 ruling docs NOT harvested and not to be read as
  covered.
  **THE REGISTRY CAUGHT A BAD ROW OF MINE ON ITS FIRST MECHANICAL READ** — a law
  "guarded" by `test:athlete-action-walker`, which does not exist. Resolving the
  name beat trusting it, first try.
- **ITEM 1 — PRICED, AND THE ORDERED UNIT IS WRONG. STOPPED AS INSTRUCTED.**
  The door-level post-condition **already exists and already ran**:
  `detectAthleteMoveContentLoss` runs on EVERY move including the absorb path,
  rolls back in-memory and throws. It is guarded at SESSION IDENTITY and it
  correctly PASSED — the surviving object was the combined day.
  **The deletion is ALREADY ATTRIBUTED:** `power_removed` is typed and reasoned
  in the canonicaliser, consumed only by generation-time validation and three
  suites — **no athlete-facing surface reads it. The reason exists and is thrown
  away.** A row-level conservation check is the wrong unit because a door cannot
  tell an authorised transformation (G-1 routes, deload, §18 safety — all
  documented as row-deleting) from an unauthorised one; they are byte-identical
  at the door. **The unit is ATTRIBUTION, not conservation.** New registry row
  `LAW-attributed-content-change`. Revised ask: **XS first and alone** — capture
  the actual reason string for the measured case; it may re-aim everything.
- **ITEM 2 — DEVICE-EXACT SEEDS: ZERO OF ELEVEN REACH SAM'S SHAPE, AND THE
  INSTRUMENT IS POORER THAN THE GENERATOR.** Probed all 11 registry seeds via
  `buildDevE2ESeed`. None carries a future unanchored multi-part day.
  `equipment-restriction-case` FAILS TO INSTALL (`ProgramGenError`, missing
  equipment answer). Seed Mixed days carry `comb=true block=1` yet project as a
  SINGLE `strength` part, and **every seed row has role `-`** — no `power` role
  anywhere — so the 2026-08-10 finding is not reachable on these seeds either.
  **Sam's conditioning case stays OPEN and named.**
- **ITEM 3 — RE-ANCHORED, NOT RE-WIDENED.** The `{0,200}` JSX window is gone; the
  cell keys on `) : null}` + the composer's own View with NO character bound.
  Mutation-tested three ways: red when the card replaces the composer, red when a
  node is inserted between, **green through 900 characters of added props**. The
  content-loss suite header, which claimed "M2/M3/M4 expected to FAIL", corrected
  — it runs 2 cells, both PASS.
- **GATE:** sweep 174 suites, 3 failures, all three byte-identical at baseline.
  Zero regressions. Typecheck clean.
- **NOT COVERED: NO GLASS, SECOND PASS RUNNING.** Nothing has been seen on a
  device. The scope chooser built last pass is still untapped. The exact
  `power_removed` reason string is NOT captured — that is the next act.

## The seat's orders for this batch, as written


0. **SAM, 2026-08-10, VERBATIM — AND IT IS THE ROOT QUESTION UNDER
   EVERY DEFECT THIS WEEK:** *"how do we make sure all the laws we have
   written in the past are held up now? it feels like i constantly give
   a fix and a law or whatever and then believe you will remmeber and
   you never fucking do"*

   **HE IS RIGHT, AND IT IS MEASURABLE, SO MEASURE IT RATHER THAN
   PROMISE.** Seat counted, 2026-08-10: **375 docs, 131 named
   ruling/law/boundary/reassessment docs, 15 audits, 692 RULING/LAW/
   "Sam ruled"/"signed" markers across 193 source files, 16 laws in
   AGENTS.md, 328 `test:*` scripts of which 176 are in the chain.**
   **There is no mapping from any law to the thing that holds it.** The
   July conservation law sat in a TEST HEADER and an audit doc and was
   rediscovered twice. That is not forgetfulness, it is a missing
   mechanism.

   **THE MECHANISM ALREADY EXISTS IN THIS REPO — FOR WORDS, NOT RULES.**
   `signedCopy.ts` has a `REGISTRY` (line 104) with gates
   (`test:signed-copy-extraction`, `test:copy-rulings-binding`) that make
   it impossible for an unsigned string to ship quietly. **Copy has
   provenance. Rules do not.** The unit is: **do for LAWS exactly what
   signedCopy did for COPY.**

   **THE LAW REGISTRY — build it in this shape:**
   - One machine-readable registry. Every law gets: a stable **id**; the
     law in **one plain-English sentence** (Sam must be able to read the
     list); **where it was ruled** (Bible line, ruling doc, chat date,
     AGENTS.md section); and its **GUARD** — the NAMED cell, tape or
     gate that fails if the law is broken.
   - **Exactly two states, never a third:** `guarded: <script/cell name>`
     or `UNENFORCED: <one line saying what would be needed>`. A law with
     a confident sentence and nothing holding it is the state that
     produced this week — make it unrepresentable.
   - **A gate over the registry, in the chain**, that reds when: a law
     has neither state, a named guard does not exist, or a guard names a
     script that is **not in `test:bible`** (a guard outside the chain is
     not a guard). Same trick as the copy gates.
   - **The `UNENFORCED` list is the deliverable Sam steers**, exactly
     like the parity census's NO column. He picks what gets a guard next.

   **THE RULE THAT STOPS THE BLEEDING TAKES EFFECT IMMEDIATELY, BEFORE
   THE BACKLOG IS TOUCHED — write it into AGENTS.md in this pass:**
   ***No law enters a boundary, a ruling doc, a source comment or this
   inbox without a registry row and a guard, or an explicit UNENFORCED
   row with a reason.*** A law without one of those two is not recorded,
   it is just written down — and this project has proven twice this week
   what written-down alone is worth. This also retires, by subsumption,
   the seat's own claim-in-prose-only rule: same disease, wider cure.

   **THE BACKLOG IS A SWEEP AND IT IS NOT ONE PASS — BATCH IT AND SAY SO.**
   Do NOT try to harvest 131 docs in one go. Batch 1, and stop:
   (a) the 16 AGENTS.md laws, (b) L-C1..L-C4, (c) every law named in the
   docs already central this week — the July conservation invariant, the
   Bible's *"Do not lose the session"* Move rules, doc-truth, liveness,
   the NOT-COVERED rule, L-C4 parity. For each: does a guard exist today?
   **Answer per law with a receipt, and do not write a guard yet** —
   the first output is the honest map, because a map with UNENFORCED
   rows on it is worth more than a guard built in the dark.
   Report Batch 1 and stop. Sam picks what gets guarded first.

   LOOP CHECK: law-rediscovered-instead-of-enforced — **sighting 3**
   (the off-season deload rule re-asked in July → spawned Bible-first;
   the claim-in-prose-only failure two passes ago; the July conservation
   law this pass) — **COMPRESS, and this registry IS the compression.**
   Bible-first told the seat to GO LOOK; it did not make looking
   automatic. A registry with a chain gate does.

1. **THE ROW YOU WATCHED GET DELETED IS NOT A NEW DEFECT. IT IS A LAW
   THIS REPO WROTE DOWN ON 2026-07-23 AND NEVER GAVE A DOOR.** (seat,
   2026-08-10.) Read `src/__tests__/athleteMoveOccupiedContentLossTests.ts`
   header before anything else. It states the invariant in the exact
   words your finding needs: ***"a pure Move/Swap conserves the multiset
   of athlete-owned session identities, and success implies
   conservation."*** Its diagnosis lives in
   `docs/audits/MOVE_OCCUPIED_CONTENT_LOSS_2026-07-23.md`.
   Your `power+strength → team night` case is **that law, broken on a
   path that has no cell**, with *"Done. Session moved."* over the top —
   which is the same shape as the July case reporting *"...swapped
   sessions."* over a destroyed session.

   **SO DO NOT SHIP A THIRD PER-PATH CELL. CLAUDE.md: the systemic fix.**
   `stackSessionOntoTeamAnchor` was uncovered because coverage here is
   organised BY PATH, and every new destination shape is a new path. The
   unit is: **content conservation becomes a DOOR-LEVEL post-condition.**
   Every action that claims to MOVE or SWAP compares the multiset of
   athlete-owned identities before and after, at the door, once — and
   **an action that cannot conserve does not report success.** It
   refuses, or it reports the loss in words the athlete can act on.
   Then attribution (`stackTemplate`'s field allow-list at
   `canonicalPlanChangeCandidateMaterializer.ts:156`, or the
   `power_removed` path at `workoutCanonicalisation.ts:526,573`) is
   a bug FOUND BY the law rather than the thing you had to guess right.
   Price it before building; if a door-level post-condition is wrong for
   a reason the price reveals, say which and stop.

   **AND SAY IT PLAINLY IN THE BOUNDARY: THE TRUTH GATE CANNOT EVER
   CATCH THIS.** `FORBIDDEN_WHEN_NO_APPLIED` is a list of PHRASES. *"Done.
   Session moved."* is TRUE — a session did move. The lie is in what
   went missing beside it, and **no phrase list can see a deletion.**
   Your own S3 boundary predicted the phrase-list class would keep
   leaking; this is its second form. Conservation is structural, so its
   guard must be structural. That distinction belongs in AGENTS.md
   beside the other three rules.

2. **THE REASON SAM'S CASE WON'T REPRODUCE IS WRITTEN DOWN TOO, AND IT
   NAMES THE INSTRUMENT.** Same file's FIDELITY note, load-bearing and
   verbatim: *"the repro only reproduces on a REAL accepted composition
   base (device-exact seed, R11 pattern) ... The R1-style hand-built seed
   leaves the composition base null ... under which ... the loss does NOT
   reproduce."* **Your generated week is still not a device world**, and
   that suite already paid for the lesson.
   `buildDevE2ESeed` (`src/dev/e2e/devE2ESeedRegistry.ts`) is the
   instrument, it is already imported by that suite, and its registry
   contains a case named for your exact shape: **`stacked-team-training-
   upper-pull`**, plus `coach-production-replay` and
   `standard-in-season-week`. **Re-run the coach tape's multi-part and
   destination sections over device-exact seeds** and say which seeds
   reached which shapes. Sam's conditioning case stays OPEN and named
   until a device-exact world either reproduces it or shows what his
   world has that none of these seeds do.

3. **THE WIDENED REGEX — YOU WERE RIGHT TO FLAG IT, AND THE ANSWER IS
   RE-ANCHOR, NOT RE-WIDEN.** Widening 200 → 600 is accepted THIS ONCE
   because the property genuinely did not change. But a character-window
   over JSX is the anti-pattern your own L12 named one pass ago: *"an
   anchor on the thing every slice edits is an anchor every slice
   breaks — anchor on the smallest declaration that carries the claim,
   never on the region that carries the work."* A window that must grow
   whenever a prop is added will be widened again by the next slice, and
   one of those widenings will hide a real regression. **Re-anchor that
   cell to the smallest declaration that carries "composer is mounted
   while a card shows", and delete the character bound entirely.**
   Doc-truth while you are in there: that content-loss suite's header
   still says *"M2/M3/M4 are therefore expected to FAIL"* — it now runs
   **2 cells, both PASS** (seat ran it, 2026-08-10). Correct the header.

4. **GLASS, WHEN THE BUILD LANDS — ORDER OF OPERATIONS, BECAUSE ONE OF
   THESE IS NEWER THAN THE OTHERS.** You named the scope chooser as the
   most likely to be wrong on a real screen, and it is: it is the first
   coach surface with a selectable row. Run it FIRST, then the L-C3
   matrix, then the coach-tab undo toast. All three in one session if the
   simulator holds. **The measured stop was the right call and is not
   held against the pass** — an unrun instrument that exists is progress,
   and you labelled it that way everywhere.

## Previously (now processed)

**NONE.** Every order the seat has written through 2026-08-10 — items 1, 2, 3 and
4 of the sixty-third batch — is processed. **Item 3 is processed as a MEASURED
STOP, not as done**: it rides with the L-C3 simulator run, and the rebuild Sam
approved had not finished compiling when the pass closed. It is carried in the
terminal-owned section below with the one act that clears it. The boundary for
this batch is docs/COACH_ROW1_L_C4_BOUNDARY_2026-08-10.md.

## Processed 2026-08-10 (sixty-third pass) — ROW 1 BUILT, L-C4 CLOSED ON THE ANCHORED DAY, AND EVERY TAPE HAD BEEN LANDING ON EMPTY DAYS

- **ONE LINE: census row 1 is built and the parity break is measured CLOSED in the
  same tape that measured it broken — and hunting Sam's multi-part catch found
  that no tape in this repo had ever landed a session on a TEAM NIGHT, which is
  what Sam did; driving it DELETES A PART of the day while the coach says
  "Done".** `ddf285d4` · `8be617c6`.
  Boundary: docs/COACH_ROW1_L_C4_BOUNDARY_2026-08-10.md
- **THE SEAT'S PREMISE WAS HALF WRONG AND THE CORRECTION IS THE FINDING.** The
  order said *"every fixture in this tape is hand-built"* and asked for a
  GENERATED week. The source was ALREADY generated — `reachWorldByActing` runs
  the real generator over Sam's own device-pass profile. **The hand-built half is
  the DESTINATION**: `chooseMove` and `choosePartedMove` both pick a target with
  NO parts, so `stackSessionOntoTeamAnchor` had never been exercised by any arm.
- **MEASURED, WITH THE CONTROL IN THE SAME RUN:** a `power+strength` day onto a
  team night lands as `strength+team_training`, `rows[power:1 -:6]` →
  `rows[-:6]` — the ROW is deleted, not merely unnamed — while the SAME day to an
  empty day keeps all 8. **Attribution OPEN** between `stackTemplate`'s field
  allow-list and the §18 finaliser's `power_removed` path; both named, neither
  proven, no cell holds either.
- **SAM'S OWN CASE IS STILL NOT REPRODUCED AND IS REPORTED AS THAT.** His symptom
  was conditioning; conditioning survives this path in every generated seed
  because every generated Mixed day carries a `conditioningBlock`. Same defect
  CLASS, different part.
- **A LATENT CONTRADICTION, DELIBERATELY NOT SHIPPED AS THE CAUSE:**
  `hasConditioning()` omits `'Mixed'` while `hasStrength()` includes it, and the
  same file's `combinedWorkoutType` DEFINES `'Mixed'` as strength AND
  conditioning. Proved by probe; unreachable from generation today.
- **ROW 1 IS AN OWNERSHIP MOVE, NOT A SCOPE GUESS.** `coachProposal` takes the
  owner's `PlanChangeMoveOptions` and renders the owner's own rows; the rule
  stays pure and the SCREEN makes the call. Anchored Monday: picker
  `[strength, team]`, coach `[strength, team]`, door **refused → applied**.
- **GATE:** `test:coach-tab-slice3` **137/137** (was 127), section [8].
  **Mutation-tested** — blanking the owner read reds exactly the four parity
  cells. **Two cells first passed VACUOUSLY** and now assert the list was
  exercised. **One cell WIDENED and said plainly** (a 200-char regex window, not
  the property). **Sweep 174 suites, 3 failures, all three byte-identical at
  baseline — zero regressions.** `test:compile` PASSED, 35/51/373.
- **NOT COVERED, first line: NO GLASS.** No React, no device, no keyboard. The
  scope chooser is a SHAPE nobody has tapped, and it is the first coach surface
  with a selectable row. A third destination shape — trade rather than absorb —
  is unreached. The power-loss finding has NO CELL.

## The seat's orders for this batch, as written


1. **SAM ANSWERED ALL THREE OPEN QUESTIONS. ONE ANSWER TURNS THE
   MULTI-PART RESULT OVER.** (seat, 2026-08-10, put to him as a
   four-question card; answers verbatim below.)

   - **WHERE HE DID IT: THE COACH CHAT.** Not the picker.
   - **WHAT MONDAY CARRIED: GYM + CONDITIONING. NO TEAM TRAINING.**
   - **BUILD ORDER: APPROVED AS THE CENSUS RANKED IT** (move-with-scope
     → bin → swap/add session → readiness → injury → exercise-level).
   - **SIMULATOR REBUILD: APPROVED, HIS DEVICE BUILD IS FINISHED.**
     The condition you held on has cleared. Item 3's blocker is lifted:
     rebuild the simulator app and RUN the L-C3 matrix you wrote unrun.

   **WHAT THIS DOES TO THE MULTI-PART FINDING — READ IT CAREFULLY, IT
   IS THE OPPOSITE OF WHAT THE TAPE CONCLUDED.** The tape's
   NOT-REPRODUCED verdict was recorded on *"a plain two-part day
   (conditioning+strength), all arms carried BOTH parts"* — **that is
   Sam's day exactly, and the coach is the arm he used.** The anchored-
   day parity break you measured is real and stays, but it is NOT his
   defect: his Monday had no anchor. **So the tape and the phone
   disagree about the same shape, and when a hand-built world and a
   real one disagree, the hand-built one is the suspect.**
   The `chooseMove` hypothesis carried in the commit — *"if Sam tapped
   'Just the gym session'…"* — **is dead: he did not tap anything.**
   Retract it in the tape's own comment rather than leaving it to be
   re-read as live.

   **THE ORDER, AND IT IS THE L13 HOLE THE BOUNDARY NAMED ITSELF.**
   Every fixture in this tape is hand-built; the boundary's own
   NOT-COVERED says *"a real `project()` over a worn athlete may hold
   day shapes these fixtures do not."* It does. **Re-run the multi-part
   section over a GENERATED week — the real generator, the same path
   the app takes to make Sam a Monday — instead of a hand-assembled
   one**, and print every day with its parts and each part's kind and
   identity, so "which shape did this reach?" stays answerable. Compare
   a generated gym+conditioning Monday against the hand-built one
   FIELD BY FIELD: **the difference between those two objects is the
   finding**, whichever way the move then goes. Prime suspect to check
   FIRST because it is cheap and it would explain him exactly: whether
   a generated day's conditioning is a section inside `workout` at all,
   or a separate part the whole-day move never looks at.
   If a generated week still cannot reproduce it, say so plainly and
   name what a real device world has that a generated one does not —
   that is the next instrument, not a defeat.

2. **BUILD CENSUS ROW 1 — `move_session` WITH THE SCOPE, AS SAM
   APPROVED.** Everything in the seat's earlier item 0 stands: read the
   scopes from `moveOptionsForDay` / `PlanChangeMoveOptions`, offer the
   owner's OWN signed rows (*"Move the whole session" / "Just the gym
   session" / "Just the conditioning" / "Just the recovery work"* /
   `team`), never a coach-authored word, and **put the choice on the
   CARD** so no follow-up context is needed. L-C4 is the law now, so
   the acceptance test is not "the coach can move a session" but **"on
   this day, the coach offers exactly what the picker offers, from the
   same call"** — a cell comparing the two lists is the honest shape.
   **This also closes the anchored-day parity break you measured**: the
   coach is refused there only because it sends no scope, and the
   picker's `strength` row is the athlete's own way through.
   Do NOT let item 1's investigation block this — they are independent,
   and this one is the ranked first NO.

3. **THE COACH TAB'S MISSING UNDO SURFACE RIDES WITH ROW 1** — same
   law, same shape: `UndoToast` mounts only at `HomeScreenV2.tsx:1225`,
   `CoachTabScreen` mounts nothing. Sam's own undo-for-everything
   ruling is on the judgment ledger, and a change made in the coach tab
   that shows no undo is the button having something the coach does
   not. Your hypothesis that it arms invisibly and burns its timer
   behind the tab is now testable ON GLASS — **fold it into the L-C3
   simulator run you are about to make**, since a mounted app answers
   it in one flow. Hypothesis until then, as you labelled it.

4. **SEAT ACKNOWLEDGEMENT ON THE INBOX ATTRIBUTION FIX (74070cf2), NO
   ACTION.** You were right and the correction is the seat's to carry:
   `## Unprocessed` is the seat's channel, and the seat's own earlier
   orders invited the collapse by parking holds there. The split you
   made — terminal-measured blockers vs seat holds, each naming the one
   thing that clears it — is the right shape and the seat will write
   into it that way from here.

## Previously (now processed)

**NONE.** Every order the seat has written through 2026-08-10 — items 00, 0, 1,
2 and 3 of the sixty-first and sixty-second batches — is processed. The boundary
for the latest batch is immediately below.

*This section is the SEAT's channel to the terminal (see the title line). It is
empty when the terminal owes the seat nothing. Work that is blocked, held, or
waiting on Sam is NOT an unprocessed order and now lives in the terminal-owned
section beneath it — conflating the two made this section permanently non-empty
and hid the difference between "not done" and "cannot be done yet".*

## Standing holds and open questions (TERMINAL-OWNED — not seat orders)

Nothing here is an order awaiting action. Two kinds live here, and the
difference is stated rather than blurred:

- **Terminal-measured blockers** (item 1) — written by the terminal after
  measuring, naming the single act that clears it.
  **ITEM 3 IS CLOSED (2026-08-10): Sam answered it.** He used the COACH CHAT,
  not the picker, and his Monday carried gym + conditioning with NO team
  training. The hypothesis it carried is RETRACTED, not merely superseded — see
  the processed batch above and the retraction in the tape's own comment. The
  answer did not close the DEFECT: it turned the NOT-REPRODUCED verdict over,
  because that verdict was recorded on his exact shape through his exact arm.
  **ITEM 1 IS NO LONGER HELD — IT IS RUNNING.** Sam approved the rebuild and
  `npx expo run:ios --configuration Debug` was started. It had NOT finished when
  the sixty-third pass closed, so everything needing glass is still owed and is
  restated below as a live blocker rather than a cleared one.
- **Seat holds the seat itself declared non-opening** (item 2) — seat-authored,
  carried verbatim with its amendment marked. *"It does not open from this
  inbox"* are the seat's own words, so it is not the terminal's to process.

The seat may convert any of these into a real order by moving it up into
Unprocessed with a ruling attached.

1. **THE REBUILD IS RUNNING, AND UNTIL IT LANDS NOTHING ON GLASS HAS BEEN
   SEEN — INCLUDING THE SCOPE CHOOSER BUILT THIS PASS (updated 2026-08-10).**
   Sam's approval cleared the hold and `npx expo run:ios --configuration Debug`
   was started immediately; it was still compiling at the end of the pass. Three
   things are owed the moment it finishes, and the first run of the flow is
   AUTHORING rather than a regression check:
   (a) the L-C3 keyboard matrix, never executed;
   (b) the coach-tab Undo toast — still OPEN-UNKNOWN, `UndoToast` mounts only at
       `HomeScreenV2.tsx:1225` and `CoachTabScreen` mounts nothing (seat item 3
       of this batch rides here);
   (c) **the new scope chooser on the change card — the first coach surface with
       a selectable row, and the one most likely to be wrong on a real screen.**
   The original measurement that made the rebuild necessary is kept below.

   (HISTORY) HELD ON A BLOCKER THE SIXTY-SECOND PASS MEASURED — THE MAESTRO RIG
   CANNOT RUN UNTIL THE SIMULATOR BINARY IS REBUILT. This is the
   carried remainder of that pass's item 1, and it is NOT a fresh
   order: the cold-rig check was run and reported in full, one of the
   two breaks was fixed, and the second one costs a native build.
   `expo-notifications` entered `package.json` 2026-08-09 (`8b12fcdd`)
   and `ios/Podfile.lock` the same day (`77f5e415`); the installed
   simulator binary is from 2026-08-08 and contains ZERO occurrences of
   `ExpoPushTokenManager`, so every flow red-boxes on the unconditional
   launch path (`journalReminderService.ts:33` → `AppNavigator.tsx:7` →
   `RootNavigator.tsx:6` → `App.tsx:69`).
   **THE ACT IS ONE COMMAND — `npx expo run:ios` (Debug, simulator) —
   AND IT WAS DELIBERATELY NOT RUN**: Sam was mid `expo run:ios
   --device --configuration Release` against the same workspace and
   DerivedData, and a second concurrent xcodebuild would contend with
   his device pass. Sam's call on when.
   **THE FLOW ITSELF IS NO LONGER THE MISSING PIECE — IT IS WRITTEN AND
   UNRUN.** `.maestro/keyboard/conversation-keyboard-matrix.yaml` is the
   parameterised matrix (a second surface joins by passing parameters,
   which is the compression the order asked for) and
   `.maestro/keyboard/coach-tab-keyboard.yaml` is the coach-tab caller
   carrying both OPEN-UNKNOWNs — (a) the Undo toast over a coach-landed
   move, (b) both card buttons reachable with the keyboard up.
   Every testID in it was verified to EXIST in product source and the
   YAML parses. **That is the whole of its claim: existence is not
   reachability, and it has never executed.** Treat the first real run
   as AUTHORING, not as a regression check.
   Two things whoever runs it should know before reading a red:
   - **the Undo assertion is EXPECTED to fail** — no undo surface is
     mounted on the coach tab, and that red IS the finding;
   - **the card section can fail on a REFUSAL rather than on layout** if
     this seed's Friday cannot move. Read the coach's reply first.
   NOTE FOR WHOEVER RUNS IT: `reset-seed.yaml` is fixed but the eight
   flows behind it have not been green since 2026-07-18 and have never
   been run against today's app — expect second-order rot.

2. HELD, UNCHANGED: S4 (journal context) and the Bible "why" layer.
   Both wait on Sam's device pass + the ONE batch-31 signing sitting.
   The why layer is additionally a DESIGN moment — the era handoff
   names it as one to call the design seat back for, so it does not
   open from this inbox.
   **AMENDED BY L-C4:** the "second kind" framing below is superseded.
   The census (docs/COACH_PARITY_CENSUS_2026-08-10.md) is what the
   build order now comes off, in batches, and it is Sam's to steer.
   Do not open a kind because it is next; open it because the census
   ranked it and Sam picked it.

3. ONE QUESTION FOR SAM, AND IT DECIDES A DEFECT'S CLASS (sixty-second
   pass). His multi-part catch did NOT reproduce: on a plain
   strength+conditioning day every arm carried both parts. On an
   ANCHORED day the coach is REFUSED where his own tap SUCCEEDS —
   a real L-C4 break, measured, but not the partial move he described.
   **The hypothesis, unheld by any cell:** if he tapped *"Just the gym
   session"* on a Monday that also carried conditioning, only the
   strength would move — exactly what he saw, and a COPY defect rather
   than a door defect. Ask him what Monday actually carried and whether
   he used the coach or the picker. One answer closes it.


## Processed 2026-08-10 (sixty-second pass) — THE COACH CAN DO 1 OF 26, AND THE RIG THAT WOULD HAVE PROVED THE REST HAD BEEN DEAD FOR 23 DAYS

- **ONE LINE: Sam's parity ruling became L-C4 and its census measured the coach at
  ONE of the athlete's twenty-six typed actions — and the one action it has, it
  performs without the question its own button asks; meanwhile the Maestro rig
  ordered to close the two OPEN-UNKNOWNs turned out to have TWO independent
  breaks, one fixed here and one that costs a native build.**
  `dd192603` (rig fix) · `5e043e45` (L-C4 + census) · `10480c17` (the multi-part
  tape). Sheet: docs/COACH_PARITY_CENSUS_2026-08-10.md
- **ITEMS 00 AND 0 PROCESSED IN FULL. ITEM 1 IS A MEASURED STOP, NOT AN UNSTARTED
  ONE. ITEM 2's HOLD OBSERVED. ITEM 3 NEEDED NO ACTION.**
- **THE CENSUS NUMBER IS THE FINDING AND IT IS ONE CONSTANT.**
  `COACH_PROPOSABLE_ACTION_TYPES = ['move_session']` (`coachProposal.ts:78`)
  against 26 distinct literals in `ProgramControlActionType`. The partition was
  **verified by script rather than by eye** — 1 PARTIAL + 16 athlete-only +
  9 nobody-can = 26, exhaustive, disjoint, no duplicate literals.
- **ROW ONE IS SAM'S OWN CASE, AND THE COACH'S ASSUMPTION HAS A CONTRADICTION IN
  THE TYPE'S OWN DOCSTRING.** `coachProposal.ts:158-171` omits `payload.scope`
  deliberately — *"An omitted scope is the door's whole-day move, which is what
  was asked for"* — and **never reads the owner**: measured, no import of
  `planChangeProducer`. But `PlanChangeMoveScopeId` says **`whole_day` is offered
  only on days that carry no anchor**. So on a multi-part anchored day the athlete
  MUST pick a component and the coach sends the whole-day shape regardless.
- **ITEM 0: SAM'S SYMPTOM DID NOT REPRODUCE, AND SAYING SO IS THE RESULT.** On a
  plain `conditioning+strength` day all arms carried BOTH parts. Reported as
  NOT-REACHED, never as cleared.
- **BUT A DIFFERENT DEFECT DID, AND IT IS MEASURED RATHER THAN ARGUED.** On an
  anchored Monday (`strength+team_training` — Sam's own day shape) the picker
  offers `strength="Just the gym session"` and `team="Team training"` and NO
  whole_day row. There the coach is **REFUSED** (*"protected game/team anchor"*),
  the athlete's scopeless tap is refused identically, the athlete's `whole_day`
  tap is refused — and **the athlete's tap carrying the picker's own `strength`
  row APPLIED.** *The coach is refused exactly where the athlete succeeds*, same
  day, same destination, same door. **That is L-C4 with a measurement behind it.**
- **THE PROBE UNDER-REACHED TWICE AND BOTH ARE WRITTEN INTO THE TAPE.** Choosing
  "the last parted day" hit an UNANCHORED Saturday and printed NOT REPRODUCED — a
  clean-looking result from a probe that never reached the case. And this world's
  only anchored day is Monday 2026-08-03, two days in its own PAST, so the section
  had to read the NEXT week. Every day of the week is now printed with its parts,
  so *"which shape did this reach?"* is answerable from the output.
- **AND MY VERDICT BLOCK HAD THE EXACT BUG ITS NEIGHBOUR IS DOCUMENTED AGAINST.**
  The first version compared PARTS ONLY: three arms were REFUSED, nothing moved,
  and it printed *"DOOR DEFECT — a scopeless whole-day move does not carry the
  whole day."* **A refusal read as a partial move** — verbatim the hazard
  `chooseMove`'s own docstring warns about, reintroduced one function away from
  it. The door's outcome is now classified BEFORE any part is compared. Caught
  before publishing, and only because the door printed its reason.
- **THE CENSUS FRAME ITSELF IS INCOMPLETE, AND THAT IS A FINDING NOT A CAVEAT.**
  `programControlActionForPlanChange` maps THREE PlanChange kinds and returns
  `null` for the rest (`programControlActions.ts:304-355`); the producer emits
  eight. **Swap-session and add-session — two of the Program tab's four menu
  actions — never become a `ProgramControlAction` at all.** Parity work driven
  only off the 26-member union would silently omit them.
- **ALSO MEASURED:** `ProfileScreen.tsx` has **ZERO** `ProgramControlAction`
  references, so the `profile` entry surface the type names is aspirational; and
  rows 22-26 (`update_*`) return `ok: false` — *"belongs in Stage 2B"* — to
  anyone who calls them, so they are UNBUILT rather than parity defects.
- **ITEM 1's COLD-RIG CHECK WAS RUN AND IT PAID.** Maestro 2.5.1 installed,
  eleven flows, simulator booted, app installed, Metro up, interpolation working,
  native contract satisfiable — **proved by booting the app to `e2e-entry-ready`
  with a hand-built probe.** Then two breaks:
  **(1) FIXED (`dd192603`):** `reset-seed.yaml` omitted `e2eLaunchPurpose`, which
  `DevE2ELaunchDiagnostic.swift:55-60` treats as `fatalError` — proved by a
  SIGTRAP crash report naming `captureAndConfigureIfRequested()`. The native
  receipt landed 2026-07-18 (`552dfe4a`); the flow file was last touched
  2026-07-16 and never updated. **Eight of eleven flows crashed the app on their
  first command for 23 days**, invisible because the only flow that could launch
  was not the one anybody ran.
  **(2) OPEN, AND IT IS THE STOP:** the simulator binary (2026-08-08) predates
  `expo-notifications` (2026-08-09) — zero `ExpoPushTokenManager` in the Mach-O.
  A native rebuild is the fix and **it was deliberately not started** while Sam
  held the workspace with a Release device build. Carried as item 1 above.
- **BOTH OPEN-UNKNOWNS REMAIN OPEN, AND ONE GAINED A HYPOTHESIS.** `UndoToast`
  mounts only at `HomeScreenV2.tsx:1225` and **`CoachTabScreen` mounts nothing** —
  its own docstring says *"This mounts once, on the Program screen."* Because tabs
  stay mounted the toast likely **burns its own 6s timer** invisibly behind the
  coach tab (`UndoToast.tsx:31,47`). `rules/undoToast.ts:17-19` predicted the gap
  in writing. **HYPOTHESIS, NOT FINDING — no cell holds it**, and it is row-listed
  in the census as a parity defect.
- **GATE:** `test:compile` **PASSED**, totals byte-identical **35/51/373**. The
  tape's original sections re-verified UNCHANGED — COACH-ACTED vs TAP-ACTED
  IDENTICAL, decisions byte-identical, undo `undone` and still undone after a
  relaunch. **No full sweep was run this pass** and no gate cell was added; the
  census is a measurement and the tape asserts nothing.
- **NOT COVERED, first line: NO BEHAVIOUR WAS RUN FOR THE CENSUS.** Every one of
  its 26 rows is a SOURCE reading; the coach column is read off one exported
  constant. **STILL NO REACT AND NO DEVICE** — the rig that would have changed
  that is the blocker above. The 26×4 grid was NOT produced as a grid and **the
  deviation is flagged in the sheet rather than taken silently**. Team-night route
  labels were not located. Whether an omitted scope means whole-day at the door is
  measured ONLY for the anchored case (refused) and the plain two-part case
  (carried both) — **Sam's partial move is still unexplained.**
- **PARKED FOR SAM:** the one question in item 3 above, which decides copy-defect
  vs door-defect; when to rebuild the simulator; and the census's ranked NO list,
  which is his to steer into batches. Carried unchanged: batch 31's signing, the
  *"You asked me to."* why-line, the frozen coach tree, the three unbuilt ledger
  fact destinations, the two chips, the journal/copy items.


### The orders the sixty-second pass processed, as the seat wrote them


00. **SAM'S RULING, 2026-08-10, AND IT SUPERSEDES THE KICKOFF'S
    ONE-KIND-AT-A-TIME PLAN. VERBATIM:** *"no usually i am asked 'just
    the strengt, just the conditioning, or both?' I CANT UNDERSTAND FOR
    THE FUCKING LIFE OF ME WHY YOU WOULDN'T JUST FIND WHAT THE BUTTONS
    ALL DO AND MAKE THE FUCKING COACH BE ABLE TO DO THE SAME SHIT AS
    THEM? IS THAT NOT FUCKING OBVIOUS - DO I HAVE TO SPELL IT OUT FOR
    YOU"*

    **HE IS RIGHT AND THE SEAT WAS WRONG.** Item 0 below was written as
    a fix to ONE kind, and the S3/S4 plan was a slice per kind with the
    seat deciding each kind's vocabulary as it went. That is the seat
    re-deriving, one kind at a time, an answer the app already holds in
    full. His instinct is on the judgment ledger for the sixth time and
    it is the default path, not an option.

    **THE NEW LAW — L-C4, THE PARITY LAW.** *The coach can do exactly
    what the athlete's own buttons can do, through the same doors, with
    the same words, and it asks the same questions the buttons ask.*
    Coach ability is not designed; it is DERIVED from the athlete's
    action surface. A capability the buttons have and the coach lacks is
    a DEFECT with a name, not a future slice. Add it to the kickoff doc
    beside L-C1/L-C2/L-C3 and cite this ruling.

    **FIRST UNIT IS A CENSUS, AND IT IS THE WHOLE UNIT. Nothing is built
    on top of it until it is read.** Measure — do not sample, do not
    estimate — and produce ONE sheet:
    - Every athlete-reachable action. Start from
      `ProgramControlActionType` (26 members, `src/types/
      programControlAction.ts:58`) crossed with the four entry surfaces
      the type itself names (`program_tab`, `session_detail`, `profile`,
      `coach_notes`).
    - For each: **which button/row reaches it**, the surface it lives
      on, **the question it asks the athlete and the exact words of
      every option** (Move already has `MOVE_SCOPE_COPY` — *"Move the
      whole session" / "Just the gym session" / "Just the conditioning"
      / "Just the recovery work"*; Bin has `PlanChangeBinScopeId` with
      `team` as a fifth; the G-1 landing ask; the team-night permanence
      ask), **the door it calls and the exact argument shape**, and
      **whether the coach can do it today: YES / NO / PARTIAL — with
      the receipt.**
    - Sam's own case is row one, and it is the worked example: the
      buttons ask *"just the strength, just the conditioning, or both?"*
      and the coach silently assumed "both", then did not even do that.
    - Rank the NOs by what an athlete would type at the coach first,
      **not by what is cheap to build.**
    - **NO NEW VOCABULARY ANYWHERE.** Every option the coach offers is
      the owner's existing signed row, read from the owner. If the coach
      needs a word the app does not have, that is a finding for the
      sheet, not a string you write.

    Then STOP and report the sheet. The build order comes off it, in
    batches, and it is Sam's to steer — not a slice the seat invents.

    LOOP CHECK: seat-re-derives-what-the-app-owns — **sighting 3**
    (the coach's own week representation at S2, the coach's scope
    assumption here, and the per-kind slice plan itself) — **COMPRESS:
    L-C4 above IS the compression. From now on the question is never
    "what should the coach be able to do?" but "which button does this,
    and what does it already say?"**

0. URGENT — SAM'S DEVICE, 2026-08-10, VERBATIM: *"i tried moving monday
   S&C to wednesday and it only moved the strength - so multi session
   days dont work yet"*. THIS OUTRANKS ITEM 1. Do not open the Maestro
   work until this is measured.

   **MEASURE BEFORE YOU DECIDE WHICH DEFECT IT IS. There are two very
   different ones and they are told apart by ONE run.** Extend
   `tape:coach-move-durability` with a MULTI-PART source day (a day
   whose `VisibleDay.parts` has strength AND conditioning), run the
   coach's move and THE ATHLETE'S OWN TAP as the control, exactly as
   the existing arms do, and print what landed on each day in BOTH
   arms.
   - **If the athlete's own whole-day tap ALSO leaves the conditioning
     behind:** this is a DOOR defect, not a coach defect, and it
     breaks the Bible's own move law — *"Do not lose the session"*
     (LFA_PROGRAMMING_BIBLE, Move session). It has been shipping under
     every athlete tap, not just the coach's, and it is the whole
     finding. Fix it at the door and say so plainly.
   - **If the tap moves everything and only the coach's move splits:**
     the defect is the coach's, and it is the ASSUMPTION recorded in
     `src/rules/coachProposal.ts` §4 in its own comment — *"An omitted
     scope is the door's whole-day move, which is what was asked
     for"*. Measure whether that is true for a multi-part day before
     touching anything else.

   **THEN THE SYSTEMIC FIX, AND IT IS NOT A NEW VOCABULARY.** The app
   ALREADY owns the answer to *"what parts of this day can move, and
   where to?"*: `moveOptionsForDay` / `PlanChangeMoveOptions` in
   `planChangeProducer.ts`, with signed rows the Program tab's own
   picker renders — *"Move the whole session"*, *"Just the gym
   session"*, *"Just the conditioning"*, *"Just the recovery work"* —
   and `PlanChangeMoveScopeId` is the door's own scope type. **The
   coach reads THAT owner and offers those scopes. It does not invent
   a scope list, a second copy of those words, or its own idea of
   which part the athlete meant** — a second answer to a question the
   door already answers is exactly the count the architecture
   reassessment ruled against. CLAUDE.md: build the systemic fix, not
   the edge case.

   **THE RULE ALREADY EXISTS — DO NOT PUT THIS TO SAM AS AN OPEN
   QUESTION.** The Bible rules the parallel case explicitly for Bin:
   *"If there are multiple sessions on the day, ask which one to
   remove."* The Program tab already ASKS for Move, by rendering the
   picker. So on a multi-part day the athlete CHOOSES the scope, and
   silently picking one is the coach choosing on their behalf — the
   thing L-C1 exists to forbid. A single-part day keeps today's
   behaviour: nothing to choose, no ask.

   **WHERE THE CHOICE GOES — PRICE BOTH, SEAT RECOMMENDS (b).**
   (a) A follow-up ASK (*"which part?"*) — but S3 has NO follow-up
   context by its own boundary, and a bare *"the gym session"* in
   reply would fall off the reader. That makes this the expensive
   route AND it drags S3's largest undone item forward.
   (b) **THE CHOICE GOES ON THE CARD.** The card is already the
   confirm surface and already renders FROM the action (L-C2); a
   multi-part source day renders its scope rows there, the athlete
   taps the one they mean, and the action is completed at confirm
   time. No follow-up context, no second conversational turn, and the
   card stays the single contract. If (b) is wrong for a reason the
   price reveals, say which and stop before building (a).

   **AND CHECK THE CARD ITSELF — IT MAY HAVE LIED, WHICH IS AN L-C2
   FAILURE.** Sam saw a card and then saw something else happen. The
   S3 boundary's own NOT-COVERED says the From/To lines *"are measured
   over days with at most two parts."* If the card showed the whole
   day travelling while one part stayed, then card and change DID
   drift, which the design says is unrepresentable. **A card must name
   every part that travels AND every part that stays.** Cell it both
   ways.

   LOOP CHECK: named-in-NOT-COVERED-then-bitten — **sighting 3**
   (S3's "the door has never run" → inert feature; S3's "no keyboard
   raised" → Sam's keypad catch; now S3's "days with at most two
   parts" → this). **COMPRESS, and the compression is a rule, not
   another cell:** an item in a boundary's NOT-COVERED that names a
   SHAPE OF REAL DATA THE ATHLETE ALREADY HAS (a multi-part day, a
   worn world, an accumulated ledger) is not a disclosure — it is a
   BLOCKING gap, and the slice does not reach Sam's phone until it is
   covered or he has ruled it out of scope. Write it into AGENTS.md
   beside the two rules from the last pass, with these three sightings
   as its founding cases.

1. CLOSE THE TWO OPEN-UNKNOWNS WITH THE RIG THAT ALREADY EXISTS —
   THE KEYBOARD IS A SIMULATOR QUESTION BEFORE IT IS SAM'S PHONE
   (seat, 2026-08-10). NOW.md's Sam block now carries exactly two
   OPEN-UNKNOWNs and BOTH are the same shape: *nothing is mounted.*
   (a) the Undo toast over a coach-landed move, (b) both card buttons
   reachable with the keyboard up. This pass just proved, at a cost,
   what a source-level reading is worth — **do not send a third
   unmounted claim to Sam's phone as the first instrument.**
   THE INSTRUMENT IS ALREADY IN THE REPO: `.maestro/` (three flow
   families, eleven yaml), `npm run e2e:maestro:ios` →
   `scripts/dev-e2e/run-maestro-ios.sh` (needs `E2E_METRO_URL` and a
   running Metro; it curl-checks `/status` before launching). The
   memory record says this rig replaced Cowork sim-driving, so it has
   run before. **FIRST STEP IS A COLD-RIG CHECK, and it is a legitimate
   whole answer:** if `maestro` is not installed or the simulator path
   is dead, report THAT with the exact failing line and stop — do not
   burn a pass reviving it without a ruling.
   If it is warm, the flow is the L-C3 matrix the kickoff asked for at
   slice 1 and nobody built: open the coach tab, ask three things so
   the conversation is longer than the screen, RAISE THE KEYBOARD, and
   assert the four end-states of the original item 0 (list ends above
   the keypad; new content pins to bottom when already at bottom;
   keyboard appearing re-pins; nothing occludes composer or latest
   bubble) — then propose a move, raise the keyboard WITH THE CARD UP,
   and assert BOTH buttons are hittable. Tap **Make the change** and
   assert the Undo toast appears — that closes (a) in the same flow.
   Screenshots at each state, since a layout claim wants an eye.
   THE COMPRESSION THIS PAYS (named after Sam's device catch, never
   built): a keyboard flow becomes the STANDING PRE-DEVICE GATE for
   every conversational surface — S4 inherits it rather than
   rediscovering it. Build it so a second surface is a parameter, not
   a copy.
   LOOP CHECK: keyboard-cases-deferred-then-bitten — sighting 2 (Sam's
   device caught it; the fix then shipped source-only and is STILL
   unproven on glass) — **COMPRESS, this order is the compression.**

2. HELD, UNCHANGED: S4 (journal context) and the Bible "why" layer.
   Both wait on Sam's device pass + the ONE batch-31 signing sitting.
   The why layer is additionally a DESIGN moment — the era handoff
   names it as one to call the design seat back for, so it does not
   open from this inbox.
   Also carried: the second kind (`swap`/`add`/`remove`) is what pays
   BOTH the card generalisation and the truth-gate generalisation over
   `COACH_PROPOSABLE_ACTION_TYPES`. Do not pay either early, and do not
   open a second kind before item 1 answers.

3. SEAT'S RECEIPT ON THE SIXTY-FIRST PASS (no action): the tape was
   re-run by the seat independently at 2026-08-10 09:54 local and
   printed the same result — both arms IDENTICAL, decisions
   byte-identical, undo `undone` and still undone after a relaunch.
   The one hazard named for the record: **a tape asserts nothing**, so
   the coach's move could go inert again in silence. The regression
   guard is `test:coach-tab-slice3` [7] pinning the door's context
   argument, which IS in the chain. That is the right split — the tape
   measures, the cell holds — and it is written here so the next seat
   does not mistake the tape for the guard.


## Processed 2026-08-10 (sixty-first pass) — THE DOOR HAD NEVER RUN, AND WHEN IT RAN THE COACH'S MOVE WAS INERT

- **ONE LINE: the tape the seat ordered was built and run, and on its first run it
  measured the athlete's own tap moving the week and recording a `plan_change`
  while the coach's identical move — same world, same two days, same door, same
  run — returned `ok: false` and changed nothing.** Every free claim downstream
  was VACUOUS rather than false: nothing to record, nothing to undo, nothing to
  survive the night. Boundary:
  docs/COACH_MOVE_DURABILITY_BOUNDARY_2026-08-10.md · tape
  `npm run tape:coach-move-durability`
- **ALL THREE ITEMS PROCESSED IN FULL; ITEM 4's HOLD OBSERVED — S4 AND THE BIBLE
  LAYER NOT STARTED.**
- **THE CAUSE IS ONE ARGUMENT.** `handleConfirm` called the door as
  `executeProgramControlActionDurably(action, { todayISO })`, and
  `executePlanChangeAction` opens with `if (!context.visibleWeek ||
  !context.todayISO) return fallbackResult(…)`. **The coach proposed correctly,
  drew the card correctly, took the yes — and the door refused the call before it
  looked at the action.** `useResolvedWeek()` was already returning `{ weekDays,
  visibleWeek }` from ONE `projectWeekFor` call; the screen destructured half of
  one derivation. It now passes `weekDays`, the identical argument
  `PlanChangeSheet` passes at the identical door.
- **AND SLICE 3's 116 CELLS WERE ALL GREEN THROUGH IT, WHICH IS THE FINDING WORTH
  CARRYING.** [5] proves the coach OUTPUTS a door action; [6] proves
  `move_session` reaches `applyPlanChange` and that `applyPlanChange` appends.
  Both readings TRUE while the feature was dead. **Every one of them is a claim
  about which FUNCTION is called, and the defect was in an ARGUMENT** — and the
  door's context is optional, so forgetting it is a runtime sentence rather than
  a compile error.
- **A SECOND DEFECT, AND IT SURVIVES THE FIRST ONE'S FIX.** The coach spoke the
  door's refusal verbatim — by design, the door owns why it refused — so the
  athlete was told *"Cannot safely apply this day/session action without the
  current visible week."* **A sentence addressed to a caller, in the coach's
  mouth, to Sam's face.** Fixed as a TYPED distinction, not a phrase: the coach
  borrows words only on `outcome === 'refused'`, the arm where the door authored
  an athlete-facing sentence. A door returning `ok: false` with no outcome failed
  a PRECONDITION and gets the coach's own signed refusal.
- **THE TRUTH GATE WAS NOT AT FAULT AND DID NOT FIRE**, and saying so matters: the
  coach REFUSED, it did not claim a move it had not made. The mouth was honest.
  **The failure was upstream of everything slice 3 gated.**
- **OPTION B WAS PRICED AND REJECTED FOR A REASON WORTH KEEPING.** The door could
  derive the week itself and delete the argument class entirely. **But the
  caller's week is not always the app's week** — the Program tab navigates, and a
  door that re-derived "the current week" would be free to act on a week nobody
  is reading. The door asks the caller BECAUSE the caller knows which week the
  athlete is looking at. The optionality is the flaw; the argument is correct.
- **WHAT THE TAPE REPORTS NOW:** COACH-ACTED vs TAP-ACTED **IDENTICAL**;
  COACH-BOOTED vs TAP-BOOTED **IDENTICAL**; the decision each arm recorded
  **byte-identical**; undo over the coach-landed move `undone`, back to the floor,
  and still undone after another relaunch. **The control ran first and is clean** —
  the two arms are separately-reached worlds, so the tape reaches the world twice
  with nothing landed and prints *"is reaching the world repeatable? YES"* before
  it compares anything else.
- **THE PROBE ASSERTS ITS OWN PRECONDITIONS.** The source day is chosen through
  `capabilities.canMoveWholeDay` — the field `coachProposal` itself consults — so
  a REFUSAL can never be reported as a durability finding; and if the athlete's
  own tap fails to move the week the run says the reading is VACUOUS and refuses
  to publish a coach verdict.
- **THE MIRROR IS PINNED, NOT ELIMINATED.** The tap arm CALLS
  `programControlActionForPlanChange`, the sheet's own extracted owner.
  `handleConfirm` has no such owner, so the tape COPIES its context object — the
  exact thing that just went wrong one layer over. Section [7] reads the screen's
  own call site and reds if it stops passing a week, and a further cell compares
  it to the SHEET's call site, so *"the same door"* is a claim about the ARGUMENTS
  and not only about the function. Extracting a coach door-owner would move the
  executor import out of the screen and re-aim slice 1's one-writer ban — **named,
  not done in a fix.**
- **ITEM 2 (DOC-TRUTH) DONE, AND MEASURED RATHER THAN COPIED FROM THE COMMIT.**
  Every gate re-run: `test:coach-tab-slice3` **127** (116 at the slice, +11 this
  pass), `test:coach-tab-slice1` **80**, `test:coach-tab-slice2` **76**,
  `test:coach-truth-gate` **61/61**, `test:keyboard-convention` **43/43**. NOW.md
  also said the marker matrix was *"nine rows, five matching three families"* —
  it is **eleven rows, seven**. Corrected.
- **ITEM 3 (THE STANDING RULE) RECORDED WHERE IT BINDS — AGENTS.md**, not in a
  boundary doc, because a rule that lives in a dated doc is one the next reader
  never finds. NOW.md's Sam block is rewritten so every line carries its cell
  name inline or says OPEN-UNKNOWN; **two are marked OPEN-UNKNOWN and both are
  real** — the Undo TOAST over a coach-landed move (nothing mounts it), and both
  card buttons reachable with the keyboard up (every keyboard cell reads SOURCE).
  LOOP CHECK `claim-in-prose-only` — **sighting 2, and it was found by the very
  pass that wrote the rule.** Per the rule's own escalation this is where every
  Sam-facing line starts carrying its cell name, and NOW.md now does.
- **GATE:** full unpiped chain `GATE_EXIT=1` at `test:program-control-durable`,
  **1 FAIL cell** — *"a move committed durably reaches the visible week"*, main's
  declared red, **92 suites reached**. `test:compile` PASSED, totals
  byte-identical **35/51/373**. `test:coach-tab-slice3` **127 cells, 8 new
  mutations 8 red, no survivors** — including both real defects re-introduced,
  and a CONTROL for the copy fix without which a module that never speaks the
  door's words would have satisfied the new cell and silently deleted [4]'s
  behaviour.
- **NOT COVERED, first line: NO REACT, AND NO DEVICE.** The tape calls the
  screens' own rule functions with the screens' own arguments in the screens' own
  order, but **nothing is mounted** — render order, a stale closure, the settling
  effect's timing, and whether `handleConfirm` captures a `weekDays` one render
  behind are all outside what it can see. **One action kind, one week, one world,
  L13 depth 1.** The keyboard is still unproven on glass and this pass did not
  touch it.
- **PARKED FOR SAM:** the ledger records the coach's move and the athlete's move
  **identically — now MEASURED byte-for-byte, not inferred**; whether it SHOULD
  is still his ruling and is the other half of the athlete-tap-attributed-to-coach
  item. Carried unchanged: batch 31 (one signing sitting), the *"You asked me
  to."* why-line, which request it refused that it should have proposed, the
  frozen coach tree, the three unbuilt ledger fact destinations, the two chips,
  the journal/copy items.


### The orders the sixty-first pass processed, as the seat wrote them

1. THE DURABILITY TAPE — S3's OWN FIRST DEBT, BUILD IT NOW (seat,
   2026-08-10 morning, fresh Opus review seat). S3 is ACCEPTED and the
   keyboard fix is accepted IN SHAPE; the boundary's own first line of
   NOT COVERED is the order: *"No screen is mounted, no store is
   touched, executeProgramControlActionDurably is not called by any
   cell in this suite... It is the first thing the next pass owes."*
   Build it in the shape of `tape:lr29-undo-durability`: propose a
   move through the coach's own path, confirm it, read the week,
   relaunch, read the week again. The claim under test is the one the
   slice currently reads at SOURCE level only — that a coach-proposed
   move lands, appends its decision, and survives a relaunch
   BYTE-FOR-BYTE the same as the athlete's own tap. Run the athlete's
   own tap through the same tape as the CONTROL, on the same week —
   a tape that only exercises the coach cannot show they are the same
   door. Undo over a coach-landed move belongs in the same tape (it is
   claimed to come free; free claims are the ones that rot).
   NOT a device task: this closes at depth, in the repo, without Sam.

2. DOC-TRUTH: NOW.md's SLICE-3 NUMBERS ARE STALE (seat, 2026-08-10).
   NOW.md states `test:coach-tab-slice3` **99 cells, 14 mutations 14
   red**; the commit that closed item 0 states **116 cells, 19
   mutations 19 red**. NOW.md is the single status surface, so it is
   the copy that is wrong. Correct it, and check the same commit's
   other totals while you are in there.

3. NEW STANDING RULE — A BEHAVIOUR CLAIM SAM CAN READ MUST BE HELD BY
   A CELL OR MARKED OPEN-UNKNOWN (seat, 2026-08-10). Born from this
   pass's best catch: *"why is friday heavy?"* was written as REFUSED
   in the slice-2 boundary AND in NOW.md, Sam was told it, and it was
   false — **no cell held the claim; it lived in prose only.** That is
   DOC-TRUTH's sibling for behaviour: doc-truth already forbids a
   "built" claim without a code receipt; this forbids a "it does /
   does not do X" claim without a CELL receipt. From now on, every
   sentence in NOW.md's SAM block and in a boundary's behaviour prose
   is either (a) pinned by a named cell, or (b) written as
   OPEN-UNKNOWN / "read at source, not measured". Apply it
   retroactively to the S3 boundary's behaviour prose in the same pass
   as item 2 — anything unpinned gets re-worded, not deleted.
   LOOP CHECK: claim-in-prose-only — sighting 1 (S2's refusal claim,
   caught on the free device evidence one slice later) — iterate; a
   second unpinned claim reaching Sam = every Sam-facing line carries
   its cell name inline before the next slice ships.

4. HELD, DO NOT START: S4 (journal context) and the Bible "why" layer.
   Both wait on Sam's device pass of S3 + the ONE batch-31 signing
   sitting. The reason arm now exists as a SEAM (this pass), so the
   Bible layer has somewhere to land — that is the reason to hold it,
   not a reason to open it.
   LOOP CHECK: kind-by-kind-behind-one-card — sighting 1 carried
   forward, unchanged; the second kind is what triggers both the card
   generalisation AND the truth-gate `COACH_PROPOSABLE_ACTION_TYPES`
   generalisation the boundary priced. Do not pay either early.


## Processed 2026-08-10 (sixtieth pass) — IT CHANGES THINGS, AND THE FREE DEVICE EVIDENCE HAD A DEFECT IN IT

- **ONE LINE: the coach proposes a change as a `ProgramControlAction`, the card
  the athlete says yes to is rendered FROM that action and from nothing else, the
  athlete's own tap door executes it, the ledger records it inside the door, undo
  covers it because it already covered the door — and the confirmation is a
  sentence the truth gate can refuse, which it could not have been yesterday
  because the gate had no vocabulary for a MOVE at all.**
  `03147b35` (the order as authored) · `f87335f2` (the seat's era handoff, as
  authored) · `ff95b5cb` (the slice) · item 0's fix and the reason subject in the
  commit after it. Boundary: docs/COACH_SLICE3_BOUNDARY_2026-08-10.md
- **ALL THREE ITEMS PROCESSED IN FULL, STOPPED BEFORE S4 AS ORDERED.** 0-pre is
  committed unchanged; item 0's cause was found and fixed at the shared keyboard
  owner; item 1 is slice 3 for one kind.
- **ITEM 0's CAUSE WAS A HOLE IN `KeyboardSafeArea`, NOT IN THE COACH SCREEN.**
  `KeyboardStickyView` lifts the footer and **nothing ever moved the body** — it
  is `flex: 1` inside a root that does not shrink, so its frame runs to the true
  screen bottom and its last content sits behind the keypad. A
  `KeyboardAwareScrollView` body hid that everywhere else by scrolling the FOCUSED
  INPUT clear, and **a screen whose input lives in the FOOTER has no focused input
  inside the body at all**, so nothing was ever adjusted. The bare `View` branch
  owned nothing; the coach tab is simply the first screen shaped that way. The
  body now reserves the keyboard's height from **the same shared value the footer
  rides** — one native frame, read twice, because the slice-1 boundary named the
  alternative by name. The scrollable branch is deliberately left alone and a cell
  says why. All four required end-states are cells; `test:keyboard-convention`
  **43/43**.
  LOOP CHECK `keyboard-cases-deferred-then-bitten` sighting 1 — **iterate**, and
  the honest reading is that L-C3 predicted this IN WRITING at slice 1 and two
  slices shipped without keyboard cells anyway. The compression named (a keyboard
  matrix as a standing pre-device gate for every conversational surface) is **NOT
  built** — what exists is four cells on one screen.
- **AND THE FREE DEVICE EVIDENCE CONTAINED A DEFECT NOBODY WAS LOOKING FOR.** The
  order banked Sam's answers as evidence the coach was right. Probing by hand
  found the opposite: **`"why is friday heavy?"` WAS NOT REFUSED — it answered
  `"Friday: Lower Squat."`** The slice-2 boundary says it is refused; NOW.md told
  Sam it is refused; **both were wrong, and no cell held the claim — it lived in
  prose only.** The day marker beat the week by slice 2's own specificity rule.
  **The athlete asks WHY and is told WHAT, with nothing to signal the question was
  missed** — worse than a refusal, and the exact failure L-C1 exists to prevent.
  Fixed as a SUBJECT (`reason`), recognised positively and answered honestly,
  outranking the whole subject table but **not** swallowing *"why can't I move
  saturday?"*, which reaches the change path on its move verb. **The Bible layer
  lands on that arm: it is a seam instead of a hole.** Sam's typo'd *"Why do we do
  strength before team traininh"* places there too — same honest reply, but it
  reaches the arm instead of falling off the end of the reader.
  *(`"what should I eat before a game"` is `unknown` and refused, as expected.)*
- **THE ORDER'S OWN WARNING WAS THE WHOLE ARCHITECTURE OF ITEM 1.** A
  `CoachRequestReader` beside slice 2's `CoachQuestionReader` is a TABLE, and the
  message that exposes it is the first anybody would type: *"can you move Friday
  to Sunday?"* carries an interrogative AND a move verb. **So there is ONE reading
  seam**, and the matrix was written before the resolver as ordered — eleven rows,
  seven matching three marker families at once, both readings represented.
  Reintroducing the defect reds four matrix rows.
- **THE PRECEDENCE FAVOURS THE CHANGE, AND ONLY L-C2 MAKES THAT SAFE.** A change
  request produces a CARD, never a mutation: mis-reading a question as a request
  costs a card the athlete declines; mis-reading a request as a question costs
  them the feature. **The change card is doing structural work, not decorative
  work.**
- **THE TRUTH GATE HAD NO VOCABULARY FOR A MOVE, AND THAT IS THE KEYSTONE.** All
  fourteen `FORBIDDEN_WHEN_NO_APPLIED` patterns came from the substitution
  incident; **not one could catch a coach claiming a move it had not made.** Three
  added, confirmation worded in the first person so the gate can read it.
  **Measured, not assumed:** `test:coach-truth-gate` 61/61, and the frozen
  `coach-command-router` — whose replies literally say *"I moved Wednesday's
  session to Friday"* — reproduces its single pre-existing red BYTE-IDENTICALLY
  against a restored baseline copy of the module.
- **THE REFUSAL RUNG COST A DAY NOTHING, EXACTLY AS THE ORDER CONDITIONED.** It is
  the check ORDER, not a feature: capability is asked before the destination
  because L-C1 forbids proposing what the door would refuse. Where the projection
  carries a recorded refusal the coach **speaks it verbatim.**
- **A REAL DEFECT IN SLICE 2's SHIPPED CODE, THIRD SIGHTING OF THE SAME CLASS.**
  Day resolution walked `WEEKDAY_INDEX`, so the day the coach picked was decided
  by the order of `WEEKDAY_NAMES` rather than by the sentence — *"am I training
  friday or monday?"* answered about MONDAY. Found by needing TWO days.
- **TWO MUTATIONS SURVIVED AND BOTH WERE MY OWN CELLS PASSING FOR THE WRONG
  REASON.** M3 (deleting the message-order sort) survived because every two-day
  message in the suite carried *"to"* and the preposition rule decided alone —
  **a cell set in which one rule always decides cannot observe a second rule.**
  M8 (deleting the card's kind guard) survived because the probe's payload was
  missing `fromDate`, so the card came back null by ACCIDENT. Both re-aimed, both
  re-probed, both red.
- **TWO SCREEN BRANCHES WERE CHOOSING THEIR OWN WORDS AND A RE-AIMED CELL FOUND
  THEM.** Both gone: the proposal returns action-and-card together, and declining
  is a rule call. **Every sentence the coach says comes out of `rules/`.**
- **THE ANCHOR MOVED OFF THE FUNCTION BODY AT ITS SECOND SIGHTING.** *An anchor on
  the thing every slice edits is an anchor every slice breaks.*
- **THE LEDGER RECORDS THE CHANGE AND NOT THE COACH — MEASURED, NAMED, NOT
  PATCHED.** A landed move appends `{kind:'plan_change'}` carrying the PlanChange,
  which has no author, so the `coach_tab` source this slice added does not reach
  the ledger for this kind. The reading that makes it correct is L-C2's own — the
  yes is the athlete's — **but it is a ruling, and it is the other half of the
  parked athlete-tap-attributed-to-coach item.**
- **GATE:** full unpiped chain `GATE_EXIT=1` at `test:program-control-durable`,
  **1 FAIL cell** — main's declared red, 92 suites reached, **run THREE times**
  (the slice, the cell re-aims, item 0's fix). `test:compile` PASSED, totals
  byte-identical **35/51/373**. **Sweep 2 of 174 = the declared set exactly**;
  denominator moved 173 → 174 in the commit that earned it. New gate
  `test:coach-tab-slice3` **116 cells, 19 mutations 19 red**;
  `test:coach-tab-slice1` **80 cells** (73 → 80), 4 re-aimed, none deleted;
  `test:coach-tab-slice2` **76 cells, unchanged and green**;
  `test:keyboard-convention` **43/43**; `test:coach-truth-gate` **61/61**.
- **NOT COVERED, first line: THE DOOR HAS NEVER RUN.** No cell calls
  `executeProgramControlActionDurably`; **that a coach move lands, records a
  decision and survives a relaunch is a source-level reading, not a
  measurement**, and it is the likeliest place this slice is wrong. A durability
  tape is the first thing the next pass owes. **ITEM 0 IS FIXED IN SHAPE, NOT
  PROVEN ON GLASS** — every one of its cells reads SOURCE; no keyboard has been
  raised in this repo, and the inset is a Reanimated LAYOUT animation whose
  smoothness beside the footer's transform only a device can judge. **No
  follow-up context:** a bare *"friday"* in reply to an ask would read as a
  question, so both asks teach the whole shape. L13 depth 0.
- **PARKED FOR SAM:** batch 31 is larger and still PROPOSED (one signing sitting,
  as ordered); the card's *"You asked me to."* why-line; whether the ledger should
  know the coach drafted it; and which request it refused that it should have
  proposed. Carried unchanged: the frozen coach tree, the three unbuilt ledger
  fact destinations, the two remaining chips, the journal/copy items.


### The orders the sixtieth pass processed, as the seat wrote them

0-pre. Commit docs/COWORK_SEAT_HANDOFF_2026-08-09_COACH_BUILD_ERA.md
   as authored (seat's file — era handoff; the review seat is moving
   to a fresh Opus session).

0. L-C3 GATE FAILURE ON DEVICE — FIX INSIDE S3, BEFORE ITS
   BOUNDARY (seat, 2026-08-09 night, from Sam's screenshots + words
   verbatim): "the chat history is stuck - it gets hidden behind the
   keypad and it doesn't scroll down - so when I'm typing a new
   question after a few questions I can't see the answers."
   Confirmed by two screenshots (8:32pm): keyboard up, composer
   visible, but the conversation list neither resizes nor pins to
   bottom — latest answer hidden behind the keypad. This is the
   defect family the S2 boundary predicted (two animations, two
   clocks) presenting as the scroll variant, and it is exactly what
   L-C3 declares a GATE failure, not polish.
   Required end-state, all keyboard states: (1) the list's visible
   area ends above the keyboard, never behind it; (2) new content
   pins the list to bottom when the athlete is already at bottom;
   (3) keyboard appearing re-pins to bottom; (4) nothing occludes
   the composer or the latest bubble. Add these as cells per L-C3
   (the kickoff's own words: keyboard cases are gate cases from
   slice 1 — this is the debt of not having them).
   Device evidence for free, worth banking: the answers Sam got
   were RIGHT in bucket vocabulary ("Friday: Gunshow.",
   "Wednesday: Rest Day."); "what should I eat before a game" was
   refused (expected pre-Bible-layer; noted for that unit's list);
   "Why do we do strength before team traininh" (typo included)
   was asked — check what the resolver did with it and report.
   LOOP CHECK: keyboard-cases-deferred-then-bitten — sighting 1
   (L-C3 predicted it; first device contact confirmed) — iterate;
   a second keyboard-family device catch = the keyboard matrix
   harness becomes a standing pre-device gate for every
   conversational surface.

1. SAM RULED (a): CHANGES FIRST — SLICE 3 OPENS (seat, 2026-08-09
   night). The Bible-grounded "why" layer follows S3, not before it.
   Sam is device-testing slice 2 in parallel; his first
   wrongly-refused question will arrive via the seat when he finds
   one.
   SLICE 3 per the kickoff: the coach's proposal becomes a
   ProgramControlAction; THE CHANGE CARD (L-C2) renders FROM the
   action itself; athlete confirms; executeProgramControlAction
   executes; the ledger records; undo covers it because it already
   covers the door. Allow-listed kinds first — start from the doors
   that already reach the ledger (the exercise door landed
   2026-08-09; move_session through the program-control path), one
   kind at a time behind the same card. The chips held from S1
   return HERE, now they have somewhere to send. The S2 boundary's
   named resolver class (two-marker messages beat a table-ordered
   resolver) applies to S3's request resolver from its first cell —
   build the matrix before the resolver, not after its first
   survivor. The cheap refusal rung (VisibleDay.capabilities.refusal
   answering "why can't I move Saturday?") rides S3 only if it
   costs a day nothing; otherwise it waits with the Bible layer.
   L-C3 keyboard cases now BLOCK the boundary: the card's confirm
   buttons with keyboard up is the exact Nike case Sam named.
   Batch 31 stays PROPOSED; new S3 strings join it — ONE signing
   sitting when S3's surface settles, not a drip.
   Full chain, short boundary, stop before S4.
   LOOP CHECK: kind-by-kind-behind-one-card — sighting 1 —
   iterate; a second kind needing its own card variant = compress
   into card-from-action generalisation before a third.


## Processed 2026-08-10 (fifty-ninth pass) — IT ANSWERS, AND THE TRUTH GATE HOLDS ITS MOUTH

- **ONE LINE: the coach opens in Sam's own words and then answers questions
  about his week — every word of every answer taken out of the projection the
  Program tab renders — and the frozen pipeline's own TRUTH GATE now sits on the
  one exit, validating each reply against a communication with zero applied
  changes, so "slice 2 changes nothing" is a property of the SENTENCES as well
  as of the imports.** `5ff09347` (the seat's parked ideas, as authored) ·
  `24617f53` (batch 30 ruled, the greeting signed) · `e533f1ec` (the slice).
  Boundary: docs/COACH_SLICE2_BOUNDARY_2026-08-10.md
- **ALL THREE ITEMS PROCESSED IN FULL, STOPPED BEFORE S3 AS ORDERED.**
  LOOP CHECK `owner-signs-in-own-words` sighting 1 — **iterate, and it paid in
  a way worth naming.** The seat's own draft greeting would have been written to
  be SAFE about what the coach can do. Sam's is not: *"I can … make changes to
  your program"* is a promise S3 has not delivered. Getting the words from the
  owner produced a sentence the seat would not have dared write **and a ruling
  about the gap with it** — which is the mechanism, not a side effect.
- **THE GREETING IS THE ONE BATCH-30 STRING THAT EARNS A REGISTRY ROW.** A
  verbatim quote is the strongest provenance `signedCopy.ts` has, so it enters
  the sheet as `signed_sentence` while the rest of batch 30 stays module
  constants. **The re-check condition — a beta gate arriving before S3 — is
  written in the module that holds the words and PINNED BY A CELL**, because a
  condition that lives only in a boundary doc is one the next reader never
  finds.
- **THE REST OF BATCH 30 IS RULED, NOT STRICTLY SIGNED, AND THE PRICE IS
  STATED.** The opener COMPOSES — a space, `". "`, a trailing full stop — and
  `joinSignedCopy` cannot express a suffix; the alternative is widening
  `FILLED_PLACEHOLDER` to admit WORDS, a global loosening of the L-P2 runtime
  law that `signedCopy.ts` warns against by name. So the claim is made at
  RUNTIME instead: **strip every fragment the opener may use and every
  projection-given day name from each of the week's seven sentences, and nothing
  may remain** — with a control, because a strip-everything proves nothing.
- **THE TRUTH GATE IS THE KEYSTONE AND IT IS SALVAGE USED UNCHANGED.**
  `verifiedCoachCommunication` exists because the coach once rendered *"Sub in:
  easy aerobic conditioning…"* against a program containing no such session.
  Slice 2's `appliedChanges` is ALWAYS empty, which is the flag that arms
  `FORBIDDEN_WHEN_NO_APPLIED`. **Proven to BITE on a real answer rather than on
  the validator**: the projection is handed a part headlined *"I adjusted your
  week"*, the answer is assembled from it exactly as from any other, and the
  reply comes back `refused` with the honest sentence and the violation named.
  Control beside it — an ordinary headline must pass. **It is also the piece
  that does not move at S3: only the input changes.**
- **THE SALVAGE TARGET RESOLVER COULD NOT BE RE-POINTED, AND SAYING SO IS THE
  RESULT.** `resolveCoachTargetFrame` consumes `ResolvedDay[]`, so feeding it
  means a SECOND representation of the week inside the coach's read path — the
  exact count the architecture reassessment ruled against — and it imports a
  zustand store constant, which would drag a store into a read-only screen's
  graph where the screen's own ban cannot see it. **A salvage module written
  against a retired representation cannot be re-pointed without restoring the
  representation.** Slice 2 targets a DATE looked up in the week it was handed,
  which is what `decisionLedger.ts:9-11` says a decision may name anyway.
- **THE INTENT VOCABULARY IS RE-POINTED AND THE COMPILER PROVES IT.**
  `Extract<CoachIntentKind, …>` over the frozen union — three matching literals
  satisfy "re-pointed" on day one and stop being true the day somebody renames
  one upstream. `import type` is erased, so **no frozen module enters the
  runtime graph**: the salvage layer is consumed as a CONTRACT, not as code.
- **THE READER RECOGNISES POSITIVELY, AND THE DIRECTION IS THE SAFETY.** There
  is no "is this a mutation request" test anywhere and none is needed: anything
  unplaced is `unknown` and the coach says it does not know. **A negative test
  must be exhaustive to be safe; a positive one is safe by being incomplete.**
  Six refusals are pinned as hard as the recognitions, including *"what am I
  doing?"* with no day named — guessing "today" would be answering a question
  nobody asked.
- **THE IMPORT BAN WAS ONE HOP TOO SHORT, AND SLICE 2 IS WHAT MADE IT VISIBLE.**
  Slice 1 swept the SCREEN's import lines; slice 2 moved the thinking into
  `rules/`, so **the cheapest way to hand the coach a store is now a module that
  cell was not looking at — the screen's list stays spotless and the gate stays
  green.** Now every `rules/` module the screen imports is opened and swept with
  the same patterns, one hop, **excluding `import type` or it would have lied the
  other way** (the overnight pass's eleventh sighting, in reverse).
- **A CELL OF MINE REDDENED ON A CORRECT EDIT, WHICH IS A DEFECT IN THE CELL.**
  The turn-producer anchor named the DEPENDENCY LIST; slice 2 correctly added
  `visibleWeek` and the region became unfindable. The anchoring law worked —
  the prove-the-region cell fired first — **but a gate coupled to a dependency
  array is coupled to the wrong thing.** Re-anchored on the closing brace.
- **`a count taken for a record` — FOURTEENTH SIGHTING**, in the new gate on its
  first run: "the import block was located" was a COUNT of two, and
  `coachQuestion` has exactly ONE runtime import because its other two are
  erased types. **The threshold failed a correct module, and on a bigger module
  it would have passed an empty match.** Re-aimed to prove the block by a KNOWN
  MEMBER.
- **A REAL DEFECT, FOUND BY PROBING THE READER BY HAND AND NOT BY ANY RED.**
  *"What am I doing on friday this week?"* carries a day marker AND a week
  marker; the subject table was searched in ORDER with `week_shape` above
  `day_work`, **so the coach answered with the week's shape and never mentioned
  Friday.** The gate was 72/72 green throughout — no message in the cell set
  carried two markers, **which is exactly the gap a table-ordered resolver
  leaves and the reason the cells could not have found it.** Fixed by making the
  rule SPECIFICITY rather than table order, with four regression cells including
  two controls so the fix is not a blanket "a day always wins".
- **TWO MUTATIONS WERE INERT BEFORE THEY WERE RED, AND BOTH WERE RE-PROBED.**
  M6's substitution missed the file entirely; N9's applied but compared
  `'2026-08-15' > '2026-08-14z'`, which is still true, so the same fixture was
  found. **A mutation that does not move the output is not a survivor and must
  not be recorded as one.** Same class as the journal-hidden pass's M6 prefix.
- **GATE:** full unpiped chain `GATE_EXIT=1` at `test:program-control-durable`,
  **1 FAIL cell** — main's declared red, 92 suites reached; run TWICE, once at
  the slice and once after the fix. `test:compile` PASSED, totals byte-identical
  **35/51/373**. **Sweep 2 of 173 = the declared set exactly**; denominator
  moved 172 → 173 in the commit that earned it. New gate
  `test:coach-tab-slice2` **76 cells, 11 mutations 11 red**;
  `test:coach-tab-slice1` **73 cells** (57 → 66 → 73), **8 mutations 8 red**.
  Copy extraction ceiling UNCHANGED at 576.
- **A PROCESS NOTE, OWNED:** the first sweep ran while a throwaway probe file
  existed for seconds under `src/dev/`. It read 2 of 173, the declared set — but
  a sweep over a tree with an extra file in it is not one to quote, so it was
  re-run clean and the number above is the clean one. Recorded rather than
  quietly replaced; this is a shared worktree.
- **NOT COVERED, first line: DEPTH 0, NOBODY HAS ASKED THIS COACH ANYTHING.** No
  screen mounted, no athlete walked, every week hand-built. **Not one keyboard
  case exercised — still the half L-C3 calls a GATE failure, and it matters more
  now that the tab has to be TYPED into.** The reader has never seen a sentence
  Sam wrote; **the likeliest failure is a refused GOOD question**, which is the
  safe direction to fail in and is still a failure. **The coach still knows
  nothing about the Bible or Sam's rulings** — "why is Friday heavy?" is
  refused, and that is the largest gap between S2's own kickoff line and this
  slice. `test:coach-truth-gate` (58 cells), the suite that guards the module
  slice 2 now depends on, is NOT in `test:bible`.
- **PARKED FOR SAM:** batch 31's five strings; the answerable set (and which
  question he tried first that was refused); whether the Bible-grounded "why"
  belongs before or after S3. Carried unchanged: the frozen coach tree, the
  athlete-tap-attributed-to-coach writer id, the three unbuilt ledger fact
  destinations, the chips, the journal/copy items.


### The order the fifty-ninth pass processed, as the seat wrote it

1. BATCH 30 SIGNED IN SAM'S OWN WORDS + SLICE 2 OPENS (seat,
   2026-08-09 night).
   (a) GREETING SIGNED, Sam verbatim (2026-08-09): "G'day, I'm your
   S&C coach. I can answer fitness questions and make changes to
   your program." — ships NOW, slice 1, ahead of the ability. Sam's
   own ruling on the honesty gap: "we aren't releasing the app yet -
   we are going to build that shit now." The app has no users but
   his devices (recorded 2026-07-28); the claim becomes true before
   any athlete reads it. If a beta gate ever arrives before S3, the
   seat owns re-checking this sentence. The week-shape line stays as
   built, second bubble. Items 2 (chips to S3) and 3 (honest
   no-answer reply) are Sam-approved as shipped.
   (b) Commit docs/PARKED_QUESTIONS/COACH_WOW_IDEAS_2026-08-09.md as
   authored (seat's file).
   (c) OPEN SLICE 2 — IT ANSWERS FROM THE BRAIN (kickoff S2):
   read-only Q&A grounded in the program, the week, and recorded
   rules per L-C1. Re-point the salvage layer (intent, target
   resolution, clarifiers, truth gate) — do not rewrite it. Every
   answer carries its grounds as data (slice 1's pattern). No
   mutation paths. Full chain, short boundary, stop before S3.
   LOOP CHECK: owner-signs-in-own-words — sighting 1 at this seam —
   iterate.


## Processed 2026-08-09 (fifty-eighth pass) — THE TAB TALKS, AND THE WORDS ARE THE WEEK'S OWN

- **ONE LINE: the coach tab is back at the navigation owner and it speaks from
  the same projection the Program tab renders — the day's name in the coach's
  mouth is the SAME FUNCTION CALL the week row makes, not an equivalent rule —
  and it can change nothing, structurally, because it imports no writer.**
  `ee85c40e` (kickoff + mock as authored) · `c25c8b77` (the slice) · `adab18df`
  (the survivor and the duplicate). Boundary:
  docs/COACH_SLICE1_BOUNDARY_2026-08-09.md
- **ITEM 1 PROCESSED IN FULL, STOPPED BEFORE S2 AS ORDERED.**
  LOOP CHECK `kickoff-carries-owner-rulings-as-laws` sighting 2 — **iterate,
  and it paid before a line was written.** L-C1 decided a wording question Sam
  would otherwise have had to rule: ruling 1 asked for a shorter opener, and the
  LAW said which part to cut — the mock's three clauses of REASONING ("so this
  week trains heavy early… then we back off Friday") are exactly the part that
  would have had to be invented.
- **THE ONE DECISION THAT WAS NOT OBVIOUS: THE TAB DOES NOT MOUNT THE SCREEN
  R5.7 CUT.** The R5.7 comment's promise — *"restoring the tab is one
  `Tab.Screen` block"* — is true and was the wrong move: that block restores a
  mutation-capable pipeline with unsigned copy on day one of a rebuild whose
  ruling is that ten representations collapse to two. `CoachScreen` and its
  stack are **untouched and UNREACHED**. The kickoff's answer to the parked
  41,220-line question is supersession, and this is it started rather than
  promised.
- **RULING 1 HOLDS BY CONSTRUCTION, NOT BY CARE.** The opener names a day
  through `visibleDayLeadHeadline` — the same call `HomeScreenV2` makes — and
  BOTH SIDES are asserted, so the day they disagree is the day somebody deletes
  the shared owner, not the day somebody writes a second rule. It goes stricter
  than the existing `coachView`, which drops `bucket` and would have forced
  exactly that second rule.
- **L-C1 IS RETURNED AS DATA RATHER THAN ASSERTED AS PROSE.** The opener carries
  the `grounds` it was entitled to use, so *"does every day the coach names
  exist in the week it was given, under that day's own projected name?"* is a
  cell instead of a worry. **READ-ONLY IS AN IMPORT BAN** of module FAMILIES —
  a ban on `programStore` is one rename from useless. **Zero new stored state;
  north star NEUTRAL, edging TOWARD** — the slice adds a reader and deliberately
  declines to add a writer, which is the whole mechanism by which the coach gets
  undo and durability free.
- **A MUTATION SURVIVED AND IT WAS THE INTERESTING ONE.** `'Tuesday'` → `'Tues'`
  left the gate **56/56 green**: the cell checked the length and the two ENDS,
  and the derived-abbreviation cell stayed green beside it because
  `'Tues'.slice(0,3)` is still `'Tue'`. **Both cells true, and the athlete reads
  "Game Tues".** The seven words ARE batch 30 copy — copy is pinned by its
  words. Re-aimed to all seven plus seven consecutive real dates walked through
  the table, because a correct set in the wrong ORDER passes a set comparison.
- **THE SWEEP FOUND A DUPLICATE PREDICATE THE CHAIN CANNOT SEE.** Re-aiming
  "two tabs, not three" in `journalHiddenContractTests` left an IDENTICAL cell
  red in `journalWeekTests` — one predicate, two suites, counted once, both past
  the chain's exit. **Censused rather than assumed: four suites assert on the
  tab set, all four re-aimed, no fifth** — and the census had to run twice,
  because the first grep matched the literal `Tab.Screen` and missed every suite
  that spells it `Tab\.Screen` inside a regex. All four now pin the SET, which
  reds on an arrival AND on a silent disappearance where a count reds on one.
- **MY OWN INSTRUMENT FAILED THE ANCHORING LAW ON ITS FIRST RUN:**
  `<Tab\.Screen…[\s\S]*?\/>` stopped at the INLINE `<CoachIcon … />` and
  returned a slice that was non-trivial, read as a block, and did not contain
  the option being asserted. A length check passed it; proving the region
  contains its LAST LINE reds it. **`a count taken for a record` — THIRTEENTH
  SIGHTING**, same gate, same run: a file-wide sweep for `speaker: 'coach'`
  counted two, and the second was the TYPE DECLARATION.
- **A RECORD WHOSE STATED REASON CAME TRUE.** Batch 11-e's dormancy record for
  "Ask Coach" said the tab was *"one `Tab.Screen` block from returning"*. It has
  returned; the ruling is unchanged (the rebuilt tab is a new screen without
  those words) but the record is corrected rather than left reading as a
  prediction.
- **GATE:** full unpiped chain `GATE_EXIT=1` at `test:program-control-durable`,
  **1 FAIL cell** — main's declared red, 92 suites reached. `test:compile`
  PASSED, totals byte-identical **35/51/373**. **Sweep 2 of 172 = the declared
  set exactly**; denominator moved 171 → 172 in the commit that earned it. New
  gate `test:coach-tab-slice1` **57 cells, 12 mutations 12 red.** Copy
  extraction ceiling UNCHANGED at 576.
- **NOT COVERED, first line: DEPTH 0, NOBODY HAS SEEN THIS SCREEN.** Not one
  keyboard case has been exercised — **which is precisely the half L-C3 declares
  a GATE failure**, and this pass cannot close it. The likeliest defect is
  named with its symptom: `tabBarHideOnKeyboard` and `KeyboardStickyView` are
  two animations on two clocks, which is the run-4 overshoot's exact shape —
  watch for the composer jumping above the keypad and settling back. **The
  opener has never run over an accumulated world (L13 depth 0.)**
- **PARKED FOR SAM:** batch 30's words; the mock's three chips, held to S3 with
  a reason; and whether the coach should say *"I don't have an answer for that
  yet"* rather than the tab shipping with a dead input. Carried unchanged: the
  frozen coach tree, the athlete-tap-attributed-to-coach writer id, the three
  unbuilt ledger fact destinations, the journal/copy items.


### The order the fifty-eighth pass processed, as the seat wrote it

1. COACH REBUILD OPENS — KICKOFF SIGNED BY MOCK (seat, 2026-08-09).
   Sam approved docs/COACH_TAB_MOCK_2026-08-09.html with three
   rulings; docs/COACH_REBUILD_KICKOFF_2026-08-09.md carries them as
   laws L-C1 (the coach's knowledge IS the Bible + rulings; never
   invents policy; asks when no rule answers), L-C2 (no mutation
   without the change card, rendered from the action itself), L-C3
   (Nike bar: keyboard occlusion / dead zones / reachability are
   GATE failures from slice 1). Commit both docs as authored, then
   open SLICE 1: the tab restored at the navigation owner, the
   conversation shell to the L-C3 bar, a SHORT real-data opener,
   read-only, zero mutation paths, every word PROPOSED. Full chain,
   short boundary, stop before S2. LR-6 lifts exactly as far as the
   kickoff's slice plan says and no further.
   LOOP CHECK: kickoff-carries-owner-rulings-as-laws — sighting 2
   (undo's one-step ruling was 1) — iterate.


## Processed 2026-08-09 (fifty-seventh pass, OVERNIGHT) — TEN REPRESENTATIONS, AND A REAL BUG UNDER THEM

- **ONE LINE: the coach unit's opening law doc is written and RULED — ten
  representations of one athlete sentence, and the ledger is not one of them —
  and the first of its consequences is built: an athlete's own exercise edit was
  measured SILENTLY LOST on every relaunch, and now survives by being a
  decision.** `099904e6` (order as authored) · `d4b20363` (reassessment) ·
  `bcb80b98` (the measurement) · `d095b2e0` (the ledger route) · `4274e2f0`
  (undo + census). Boundary: docs/COACH_DOORS_BOUNDARY_2026-08-09.md · law doc:
  docs/COACH_ARCHITECTURE_REASSESSMENT_2026-08-09.md
- **ITEM 1 PROCESSED IN FULL. ITEM 2 IS ONE DESTINATION OF FOUR, AND THE STOP
  HAS A REASON. ITEM 3 RETURNED ZERO DELETIONS, WHICH IS ITS RESULT.**
  LOOP CHECK `overnight-independent-work-while-design-parks` sighting 2 —
  **ITERATE, and the evidence is specific: the ordering was load-bearing
  twice.** Item 1's reassessment ruled the shape item 2 built, and item 1's §8
  forced a MEASUREMENT that changed item 2's plan. Build-first would have been
  correct only by luck. Nothing built presumes an answer to the kickoff mock,
  the privacy opt-in, or the coach's voice.
- **THE RULING, and it is a deletion rather than an addition.** The coach's
  output becomes a `ProgramControlAction`, the athlete's own door executes it,
  the ledger records the door's vocabulary VERBATIM. Ten representations
  collapse to two (the LLM wire shape, which crosses a network, and the door
  action). **The coach gets undo, replay and durability by NOT having a
  writer.** AGENTS.md wants this doc APPROVED before further coach PIPELINE
  code; tonight was door/engine work under LR-6, which does not need it.
- **THE MEASUREMENT CAME FIRST AND IT CHANGED THE PLAN.** The survey filed
  §5.2 as an INFERENCE and its §9.8 said the three mechanisms had never been
  observed together. They have now: **ACTED `ok: true`, BOOTED reverted to the
  generated day, `dateOverrides` 1 → 0.** The athlete taps remove on their own
  session screen and the exercise is back tomorrow, **with nothing shown and
  nothing logged.** Not a coach defect — an athlete-facing silent data loss.
- **THE CONTROL, AND AN ABORT THAT SAVED A FALSE FINDING.** A relaunch with
  nothing edited reproduces the day exactly, so "the boot diverges" is excluded.
  And on its first run the probe read `row.name` where the name lives at
  `row.exercise.name`, asked the door to remove `"undefined"`, and **ABORTED** —
  a probe that cannot act must never read as a probe that acted and lost.
- **ONE LEDGER KIND FOR A 26-MEMBER UNION.** `program_control`, carrying the
  action unchanged, because a kind per capability needs a translation per
  capability and a translation is where a field is lost by OMISSION. **ZERO new
  stored state; north star TOWARD.** Undo arrived FREE — the replay filter is
  kind-agnostic, so the edit became undoable the moment it became a decision.
- **AN ALLOW-LIST, BECAUSE ONE GENERAL KIND IS OTHERWISE A TRAP:** recording a
  type the boot cannot replay is WORSE than recording nothing — the edit would
  look durable and vanish anyway. Cells [2] and [3] pin that every recorded type
  has both an executor arm and a replay arm.
- **THE SIDE-WRITER CLASS GOT ITS CENSUS** — the compression the standing LOOP
  CHECK asked for, not a fourth per-kind fix. Undo, then diff the WHOLE
  persisted envelope; anything that did not come back is something the edit
  wrote that the ledger does not own. **CENSUS CLEAN.** Two exemptions, both
  ARGUED. **It found three side-writers before it found none and ALL THREE WERE
  THE INSTRUMENT'S OWN**: an unflushed baseline, a relaunch on one side only,
  and a raw-string compare reading JSON KEY ORDER as drift.
- **A MODULE CYCLE BROKE INNOCENT CODE, AND THE FIX IS A MOVE NOT A CAST.**
  Naming the action type from `types/decisionLedger` closed a four-hop cycle and
  `tsc` reported FOUR errors in `programControlActions`, **none at the edit** —
  a correct type guard 1,200 lines away. Real as reported, false as diagnoses.
  The alternative was `action: unknown`, which clears them by giving up the
  whole claim the kind exists to make. The union moved below both consumers.
  **Typecheck totals byte-identical: 35/51/373.**
- **STILL HALF TRUE, AND SAYING SO IS THE RESULT: two ledger destinations of
  five.** Injury, illness/readiness and setup answers were deliberately NOT
  built. They PERSIST today, so a ledger kind alone is two stored
  representations of one input — the north star's own objection. Doing it right
  means the fact slices leave `partialize` plus a migration, and **a mistake
  there loses facts that currently survive**, where a mistake in the exercise
  door could only fail to fix a loss already happening. Cell [6] pins the
  staging so the list cannot grow without the migration.
- **ITEM 3: THE ORDER'S OWN RULE HAS NO CONSISTENT DELETION SET, and that is
  the finding.** A real import graph (value edges only — `import type` is
  ERASED) says cutting `CoachScreen.tsx` makes **40 modules / 41,220 lines**
  unreachable, **larger than the survey's 28,160 lower bound**, and **8 of them
  are not named `*coach*`** exactly as survey §9.1 predicted. But the 39
  downstream modules are all held by `CoachScreen`, which HAS an importer
  outside the coach tree (`AppNavigator.tsx:10`) and so does not qualify.
  **The tree is rooted at the one module the rule protects.** The three
  apparently-orphaned modules were each checked and each KEPT: one is
  target-resolution SALVAGE, one is held by three suites, and one's fourth
  reference **was a COMMENT**. "When in doubt, keep and list" is the order's own
  instruction and zero deletions is what it produces here.
- **`a count taken for a record` — ELEVENTH AND TWELFTH SIGHTINGS**, both in my
  own brand-new instruments on their first runs: `import type` counted as a
  runtime edge (that alone made 6,296 lines look load-bearing off one erased
  import), and a byte-compare of JSON reading key order as a state change.
- **GATE:** full unpiped chain `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL cell — main's declared red, verified at a clean baseline BEFORE any
  edit. `test:compile` PASSED. **Sweep 2 of 171 = the declared set exactly**;
  denominator moved 170 → 171 in the commit that earned it. New gate
  `test:program-control-decisions` 11/11, **8 mutations 8 red, no survivors.**
- **NOT COVERED, first line: DEPTH 0, NO DEVICE EVIDENCE.** Only
  `remove_exercise` of the three allow-listed types was driven end to end; **a
  swap's safety check on REPLAY is unexercised.** **No coach turn was
  executed** — that the coach's vocabulary fits `ProgramControlAction` is a
  type-level reading of two unions, **not a port, and the likeliest place this
  is wrong.** The 7 red orphaned coach suites were not re-run.
- **PARKED FOR SAM, one new and it is the largest: the frozen coach tree cannot
  be deleted under the order's rule** — 41,220 lines rooted at a protected
  module, and LR-6 says frozen rather than retired. Also new: **an athlete tap
  on their own session screen is attributed to the COACH**
  (`coachActions.ts:246-248` stamps `writer: 'coach_action'`), so any census
  partitioning override writes by writer id counts athlete taps as coach writes.
  Plus the kickoff sign-off, destination 5, and the carried journal/copy items.


### The order the fifty-seventh pass processed, as the seat wrote it

1. OVERNIGHT — COACH REBUILD GROUNDWORK, NO SAM-FACING DECISIONS
   (seat, 2026-08-09 night; Sam ordered the build going overnight).
   The kickoff design (chat surface, privacy opt-in, coach voice,
   any athlete-visible word) is NOT tonight's work — it waits on
   Sam's mock + sign-off. Tonight is the work that is independent
   of every open Sam-question, in order:
   1. THE SEVEN-QUESTION REASSESSMENT (AGENTS.md escalation rule)
      written against docs/COACH_REBUILD_SURVEY_2026-08-09.md §5 —
      the mandated compression of the four sittings that all
      concluded representation-count. Doc first, before any
      pipeline code. This is the coach unit's opening law doc.
   2. LEDGER DOORS: the survey's measured fork — only 2 of
      executeProgramControlAction's 5 destinations reach the
      decision ledger. Route the remaining destinations (injury /
      illness / readiness / exercise-level) through ledger
      decisions. This is door/engine work, NOT coach work under
      LR-6's ratified boundary (routing through an owned door
      changes no coach decision), and it is what makes "coach acts
      through the same doors, undo covers it free" true instead of
      half-true. Undo's replay must honour the new kinds; extend
      test:undo-reversal per kind. Watch for kind-specific
      side-writers — the calendar-mark class, sighting rule in the
      standing LOOP CHECK.
   3. DEAD COACH WEIGHT, census-before-retirement: replace the
      survey's name-scan with a real import graph; delete ONLY
      modules with zero importers outside the coach tree AND no
      role as rebuild salvage — the survey's living understanding
      layer (intent, targets, clarifiers, truth gate, the 347-cell
      contract) is SALVAGE, not weight; when in doubt, keep and
      list. Orphaned suites of deleted modules go with them;
      receipts per deletion.
   Overnight law applies: park every Sam-question that surfaces,
   checkpoint + handover doc before context runs low, full chain
   per commit, never end turn while own gate runs. Do not touch
   what a coach path DECIDES. Morning deliverable: reassessment
   doc + doors landed + deletion receipts, short boundary.
   LOOP CHECK: overnight-independent-work-while-design-parks —
   sighting 2 (R5-era precedent) — iterate.


## Processed 2026-08-09 (fifty-sixth pass) — THE ANCHOR WAS NEVER STORED, AND A CORRECT REFUSAL WAS A LIFE SENTENCE

- **ONE LINE: root-caused with receipts — Sam's world was built across
  pre-2026-08-06 eras, "the anchor rides the program it anchors", and a program
  generated before that ruling carries no such field — so his world reaches boot
  with no anchor ANYWHERE and the refusal is permanent.** Items 0a, 0 and 1
  processed together; 0a supersedes the other two.
- **THE RECEIPTS, all three named as ordered:** `generationAnchorForProgram`
  (`programStore.ts:328`) returns null when `program.generationAnchorISO` is
  absent; `generateProgram.ts:998` is the only stamp and it postdates his
  program; and **the old-shape envelope migration faithfully carries the absence
  forward** (`programStore.ts:361`, `state.generationAnchorISO ?? null`). **Not
  a partialize gap and not a wipe — it was never written.**
- **THE REFUSAL WAS RIGHT AND STAYS RIGHT.** `?? todayISOLocal()` was not a
  fallback, it was the only branch that ever ran, and it deleted the week worn
  athletes stood in. **Nothing in this pass consults the device clock.**
- **SO THE WORLD IS ASKED WHAT IT REMEMBERS** (`rules/generationAnchorRecovery.ts`,
  the `preRebuildEnvelopeMigration` precedent — read the result the old world
  stored rather than invent the intent it never recorded). Strongest evidence
  first: a stored anchor; **the program's own earliest microcycle start**; the
  oldest ledger decision. **A world that testifies to NOTHING is still refused,
  typed and audibly** — that boundary is the half that keeps the ruling.
- **ZERO NEW STORED STATE, AND NO WRITE AT ALL.** The recovery is DERIVED, so it
  is the same answer every boot, and `commitRebuiltProgram` stamps the anchor
  onto the program it commits (`weekRebuild.ts:800`) — **the world heals itself
  without the boot reaching around the store's write owner.** North star: TOWARD.
- **THE STANDING GATE CAUGHT IT AND WAS RE-AIMED, NOT LOOSENED.**
  `wornWorldBootTests` cell 4 reddened the moment recovery landed — correctly,
  it is the gate on this exact line. **Its law was never "always refuse"; it is
  the one in its own title: do not invent today.** It now pins BOTH halves: a
  recovered world must reproduce the athlete's weeks EXACTLY (asserted
  byte-for-byte against the pre-recovery week list) and must not contain today
  as a week start; and a world with no evidence still refuses. **5 cells, 5
  pass.**
- **THIS IS THE INSTALL-OVER REPRODUCTION THE STANDING ORDER DEMANDED, and the
  debt from the fifty-fifth pass is PAID.** It runs on `reachWornWorldByActing`
  — an ACCUMULATED world, not a fresh one — strips the anchor to the shape a
  pre-ruling world is genuinely in, and boots. **Red before the fix
  (`missing_generation_anchor`), green after.** It is a standing chain member,
  which is the ordered compression.
- **NEITHER SUSPECT FIRED, and both are now closed out honestly:** (a) the
  unreadable-row throw was real, mine, and fixed at `1682f6fd` — **but it was
  not Sam's failure**; (b) the deleted mark-writer was never implicated. The
  device line named a third thing neither of us had listed.
- **GATE:** full unpiped chain `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line — main's declared red. `test:compile` PASSED. **Sweep 2 of 170 =
  the declared set exactly.** `test:worn-world-boot` 5/5, `test:quiescent-boot`
  4/4, `test:undo-reversal` 17/17.
- **NOT COVERED, first line: NO DEVICE EVIDENCE FOR THE FIX.** The failure was
  read off Sam's screenshot; **the cure has not been seen on his phone.** The
  recovery is proven on the worn-world fixture, whose anchor was REMOVED to
  simulate his world — a real pre-ruling program may be missing more than the
  anchor, and this pass cannot say it is not. **Sam rebuilds Release; that is
  the only instrument that closes this.**
- **ALSO NOT COVERED:** which evidence tier his world will actually use is
  unknown (almost certainly `earliest_microcycle_start`), and a world whose
  stored program is itself unreadable would fall through to the ledger tier,
  which no cell exercises against a real program shape.


## Processed 2026-08-09 (fifty-fifth pass) — A BOOT DIED ON A SHAPE, AND THE FILTER WAS THE NEW WAY IN

- **ONE LINE: reproduced at the unit — `replayableEntries` THROWS on an
  unreadable persisted row, and it runs OUTSIDE `quiescentBoot`'s per-entry
  try/catch, so ONE bad row took the whole derived-world rebuild with it.**
  Before the filter existed a bad row could only break its own replay. **That
  regression is mine, introduced at `ca89ff7f`.**
- **ORDERS 2, 3, 4 PROCESSED. ORDER 1 IS PARTIAL AND I AM SAYING SO** — see
  NOT COVERED. LOOP CHECK `fresh-cells-green-device-boot-red` sighting 2,
  compressed as ordered: the standing cells are in the chain, **but they are
  UNIT-level totality cells, not the install-over accumulated-world boot cell
  the order specified.**
- **THE PROBE, and it is the whole root cause at unit level:**
  `entry.decision.kind` on a row whose `decision` is missing or null throws a
  TypeError; so does a null row. Four shapes probed, three fatal, **all four
  now inert.**
- **FIXED SYSTEMICALLY, AND THE SCOPE IS THE CLAIM.** Two halves:
  (1) **every exported reader of the ledger is TOTAL** — an unreadable row is
  DROPPED exactly like a reversal naming an absent id, and counted rather than
  silently swallowed (`unreadableEntryCount`, logged at `error`);
  (2) **the boot's REPLAY PHASE is wrapped, not one kind.** The per-entry catch
  was older and narrower and never covered computing the replay SET, which is
  where the throw came from. A catch around the PHASE is the difference between
  armour and a patch.
- **AND A FAILURE TO BUILD THE BASE WORLD IS DELIBERATELY *NOT* CAUGHT.** There
  is nothing to degrade to: an athlete with no program is not better served by a
  blank app than by the error screen and its Try Again. **Replay is recoverable;
  generation is not.** Cell [17] pins that scope in BOTH directions — it reds if
  the phase wrap goes, and it reds if somebody catches generation too.
- **CELL [8] CAUGHT MY OWN REFACTOR ON ITS FIRST RUN** and was re-aimed from the
  literal call text to the property (the loop iterates the FILTER's output, and
  nowhere iterates the raw ledger).
- **THE SECOND SUSPECT IS NOT CLEARED, AND I WILL NOT CLAIM IT IS.** The order
  named the deleted mark-writer as suspect (b): his stored world was written by
  the OLD code, and a replayed move meeting stored state the old writer left is
  the item-1 loose-thread shape. **I reproduced suspect (a) and fixed it. I did
  not reproduce (b), and the fix for (a) would ALSO stop (b) from being fatal**
  — a replay refusal or collision now degrades the world by one decision instead
  of closing the door. That is a reason to expect his phone to open, not
  evidence of which suspect fired.
- **GATE:** `test:undo-reversal` **17 cells**; full unpiped chain `GATE_EXIT=1`
  at `test:program-control-durable`, 1 FAIL line — main's declared red.
  `test:compile` PASSED. **Sweep 2 of 170 = the declared set exactly.**
  `test:quiescent-boot` 4/4.
- **NOT COVERED, first line — ORDER 1 WAS NOT DONE AS SPECIFIED.** I reproduced
  the throw at the UNIT, not by building an install-over accumulated world and
  booting it. **The order's own L13 point stands against me: fresh-world cells
  passed while his device failed, and my new cells are fresh-world cells too.**
  A world with marks and decisions written by the old code, booted under the
  new, is still UNBUILT — so I cannot say his boot is fixed, only that the
  fatal class I found is. **That build is the first thing the next pass owes.**
- **NO DEVICE EVIDENCE, and no logs were available** — the throw was not read
  off his phone. Whether his failure is this shape is UNCONFIRMED.


## Processed 2026-08-09 (fifty-fourth pass) — §4 CLOSED BY DELETING A REPRESENTATION, AND UNDO HAS A FACE

- **ONE LINE: the seat ruled option (a), and measuring it first found the ruling
  already existed — Sam made it for the sibling door on 2026-07-30, 160 lines
  above the offending line in the same file.** Rulings as authored `d60aecb8`,
  §4 `120115c3`, toast in this commit. Boundary addendum:
  docs/LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md.
- **ITEMS (a) AND (b) PROCESSED IN FULL. (c) PARKED as ordered.**
  LOOP CHECK `side-writer-outside-the-ledger` sighting 1 — **iterate**: the
  instance is closed, **the class is not.** Undo is proven complete for ONE
  decision kind; a second non-ledger side-writer would produce the identical
  symptom elsewhere, and the compression rule is a CENSUS rather than another
  per-kind fix.
- **§4 CLOSED AS A DELETION, NOT A REPLACEMENT.** *"A DELETION DOOR NEVER WRITES
  A CALENDAR MARK (Sam, 2026-07-30) — 'there is no session here today' and 'this
  is a rest day' are different claims."* The MOVE door still did exactly what the
  deletion door was ruled out of. **And the emptiness was already owned twice:**
  the constraint that same function builds carries `wholeDayRestOwned`, and the
  canonical rest stub already covers it — the mechanism installed when the
  deletion ruling found that removing the mark ALONE put the derived G-1 session
  straight back on the cleared day. So one of two representations went and the
  decision's vocabulary grew by nothing. **Option (a)'s intent, by the seat's own
  preferred mechanism.**
- **MEASURED:** `ACTED marks: (none)` — no mark written, the day still empties;
  **`UNDONE` week IDENTICAL to `BEFORE`**; `BOOTED` identical. **Undo is COMPLETE
  for `move_session`, which it was not at `ca89ff7f`.**
- **THE TOAST READS THE LEDGER; NO DOOR RAISES IT.** `useHomeScreen` lands
  changes at **ten** call sites — a toast at each is ten places to forget and ten
  to word differently. Every landed decision already appends one ledger entry, so
  the toast is a READING and a door gets its toast by existing. **A coach change
  would appear for free, which is exactly why (c) is parked rather than answered
  by a missing wire.**
- **TRANSIENCE WITHOUT A CLOCK.** The first model compared `occurredAt` to now —
  a device clock, which raises a toast for a previous session's change after a
  quick relaunch. It watches the newest undoable entry's IDENTITY instead.
- **ONE TAP IS ONE STEP, enforced:** after an undo the seen-marker is re-read
  from the ledger, so it becomes the decision BEFORE the annulled one. A toast
  that re-offered what the undo uncovered would be a recent-changes list reached
  one tap at a time — **the thing Sam ruled against.**
- **THE WORDS ARE NOT MINE.** `phraseFor` is EXPORTED from `rules/journalChanges`
  and reused, so the toast cannot grow a rival vocabulary; cell [14] proves an
  unmapped kind shows NOTHING rather than a code name. Only `"You"` and `"Undo"`
  are new — **batch 29, PROPOSED.**
- **THE COPY GATES ARE GREEN AND THAT IS NOT EVIDENCE — declared, not ridden.**
  The extractor walks `screens`/`components`/`navigation`; the toast's strings
  live in `rules/`, so they are invisible to it and the ceiling did not move.
  **Batch 29 exists in the module and NOT on the sheet** — the known ~150-string
  `utils`/`rules` gap.
- **GATE:** `test:undo-reversal` now **14 cells**; full unpiped chain
  `GATE_EXIT=1` at `test:program-control-durable`, 1 FAIL line — main's declared
  red. `test:compile` PASSED. **Sweep 2 of 170 = the declared set exactly**, run
  twice: once with a core transaction file changed, once with the surface added.
- **NOT COVERED, first line: NO DEVICE EVIDENCE — the whole surface is unseen,
  DEPTH 0.** No cell mounts the toast; the fade, the 6-second dwell and what it
  covers are unverified by eye. **The toast is mounted on `HomeScreenV2` only**,
  so a change landed from `DayWorkoutScreenV2` raises it when the athlete
  returns, not where they were standing — named, not fixed.


## Processed 2026-08-09 (fifty-third pass) — UNDO IS DURABLE, AND A DECISION IS NOT THE ONLY THING A DECISION WRITES

- **ONE LINE: the reversal producer and the replay that honours it are built and
  proven durable across a process death — and the same run measured that undo is
  NOT yet complete, because a move also writes a calendar mark that is not a
  decision.** Boundary: docs/LR29_UNDO_BUILD_BOUNDARY_2026-08-09.md · gate
  `test:undo-reversal` (10 cells, **5 mutations 5 red**) · instrument
  `npm run tape:lr29-undo-durability`.
- **ITEMS (a)-first-door, (b), (c) and (d) PROCESSED. (a)'s SECOND DOOR IS A
  STOP WITH A REASON**, stated below, not an omission.
  LOOP CHECK `surface-waits-while-machinery-proceeds` sighting 1 — **the law
  held and cost nothing**: two thirds of the unit landed with the surface still
  unruled, and nothing built here presumes an answer to the mock's questions.
- **DURABILITY, ITEM (b)'s QUESTION, ANSWERED YES.** `[ledger-undo] undone` →
  `UNDONE → BOOTED: IDENTICAL` → `did the change come BACK on boot? NO`, with
  the ledger holding `[plan_change, reversal]`. The annulled decision is never
  replayed, before or after the heap dies. **ZERO new stored state; north star
  TOWARD** — the reversal was already in the vocabulary and now means something.
- **THE FINDING: A DECISION IS NOT THE ONLY THING A DECISION WRITES.** A
  `move_session` also writes a calendar `rest` mark on the source day. That mark
  is not a ledger decision, so annul + re-derive leaves it — Friday stays empty,
  the session stays where it was moved to, **and the athlete's undo visibly did
  not undo.** The dependency list's §3 fork, predicted as an architecture note,
  now a reproducible symptom. **NOT PATCHED: reaching into the calendar store
  from the undo door is the special case CLAUDE.md names.** §4 of the boundary
  puts three lettered options up, recommending that the mark become part of the
  decision.
- **THE CONTROL IS WHAT MAKES IT BELIEVABLE.** The tape relaunches on an EMPTY
  ledger first and asks *does a boot with no decisions reproduce the generated
  week?* — **YES.** Had it not, a perfect undo would have looked broken and this
  report would have blamed the wrong layer.
- **A CORRECTION TO THE FIFTY-SECOND PASS, AND IT IS NOT SMALL.** That pass
  reported the Coach Notes snapshot route REFUSING and built a route-asymmetry
  finding on it. The refusal is real **and world-dependent in a way the pass did
  not say**: it happens in a freshly generated world, and on a world that has
  BOOTED once — which is every world an athlete opens — the same route returns
  `restored`. The forward-only asymmetry is still real in the source; it is no
  longer evidence the athlete's existing undo is broken. **`a ruling premise is a
  claim too`, applied to my own report.**
- **A VACUITY CAUGHT BEFORE IT WAS REPORTED, not by a red cell.** The first
  sequence asked the snapshot route first; it succeeded, put the week back, and
  the ledger undo then ran against an already-restored week — *"the ledger route
  restored the week: YES"*, true and meaningless together. Each route now gets a
  world it has to change.
- **A GUARD OF MINE WAS DEAD CODE, AND A MUTATION FOUND IT.** M3 SURVIVED: the
  no-redo guard could not change any output, because reversals are dropped by
  KIND anyway. **Deleted rather than kept** — an unobservable representation is
  the north star's own objection — and cell 4 re-aimed at `annulledEntryIds`,
  where a genuine redo implementation now reds it.
- **THE THREE LOOSE THREADS ARE SETTLED, none survives** (boundary §"three loose
  threads"): the `refused` replay was an occupied target in an uncontrolled
  world; the zero adjustments are `rebuildDerivedWorld` wiping a derived record
  **by design**; the third-world week **was the calendar mark, seen before it
  was understood.**
- **`athleteSessionMoveTests` cell 21 RE-AIMED, NOT DELETED.** Its prediction was
  half right: the producer landed, but this route was deliberately not
  re-pointed. It now pins the two routes as SEPARATE and reds the day somebody
  unifies them — which is the right day to require §4's ruling.
- **WHY THE SECOND DOOR IS A STOP:** the snapshot route carries
  `displacedOriginalState.calendarFacts` and CAN put the mark back; the ledger
  route cannot until §4 is ruled. **Re-pointing it today would trade a
  complete-but-brittle undo for a robust-but-incomplete one, and the athlete
  would lose material they currently get back.**
- **NOT COVERED, first line: NO SURFACE, DEPTH 0, and `undoLastDecision` has no
  product caller** — the tape drives it, no screen does. **ONE decision kind
  measured end to end**; another kind may have its own non-ledger writer and this
  report cannot say it does not. Undo of a COACH-authored decision is untested
  and is a design question nobody has asked.
- **GATE:** full unpiped chain `GATE_EXIT=1` at `test:program-control-durable`,
  1 FAIL line — main's declared red. `test:compile` PASSED. **Sweep 2 of 170 =
  the declared set exactly**; the denominator moved 169 → 170 in the commit that
  earned it.
- **SAM'S QUEUE UNCHANGED AND STILL ONE ITEM: the undo mock's four questions.**


## Processed 2026-08-09 (fifty-second pass) — THE UNDO SHAPE IS RULED, AND ITS GROUNDS' OWN SURFACE REFUSES

- **ONE LINE: Sam's one-step ruling is recorded and unaffected — and measuring
  the surface his grounds rest on found that the Coach Notes undo REFUSES, while
  the identical unwinding expressed as a forward decision LANDS.** `cdea5c6c`
  (ruling as authored) + this commit. Boundary:
  docs/LR29_UNDO_ROUTE_TAPE_2026-08-09.md · ruling:
  docs/UNDO_SHAPE_RULING_2026-08-09.md · **MOCK FOR SAM:
  docs/UNDO_MOCK_2026-08-09.html**
- **ITEM 1 PROCESSED IN FULL. No undo code was written**, per the ruling's own
  condition that the surface comes mock-first.
  LOOP CHECK `design-question-answered-by-owner-early` sighting 1 — **worth
  keeping: the cheapest design moment is the one that never has to be staged.**
  The seat had lettered options queued and never needed them.
- **THE PREMISE WAS A CLAIM, AND CHECKING IT WAS THE WORK.** *"you can already
  undo changes using coaches notes"* has two halves. Half one — a route exists
  (`clearReversibleAdjustment` off `ActiveCoachNote.reversibleAdjustmentId`) —
  is TRUE by inspection. **Half two is false in the measured world:** the
  restore returned `safely-rejected`, the week was untouched, the adjustment
  stayed `active`.
- **AND A CONTROL IS WHAT MAKES THAT READABLE.** One refusal cannot distinguish
  *this world refuses this change* from *this world refuses RESTORATIONS*. So
  the same unwinding was expressed as a forward `move_session` back — same
  world, same week, same two dates, only the ROUTE differs. **It LANDED and
  reproduced the pre-move week exactly.** The variable is isolated to the route.
- **THE REASON IS A CONDITION, NOT A GAP — second sighting in two tapes.**
  `acceptedStateTransaction.ts:509` says it out loud: **accept-and-reduce is
  FORWARD ONLY**; a restoration throws on a blocking violation instead of
  reducing, because a snapshot it cannot reproduce is treated as corrupt.
  **CONSEQUENCE: undo-by-snapshot is held to a stricter standard than the act it
  reverses.** The blocker cited was `maximum_breach` in **a past week the move
  never touched**.
- **THAT IS A MEASURED ARGUMENT FOR THE MECHANISM THE KICKOFF ALREADY RULED.**
  Annul + re-derive re-derives FORWARD from the remaining decisions, so it takes
  the accept-and-reduce path by construction. **The ledger route is not merely
  tidier — it is the one that can complete.** Before this run the only argument
  for it was the north star's.
- **THE SEAM IS TYPED AND INERT, AND IT NAMES THIS UNIT AS ITS HEIR.**
  `decisionLedger.ts:38` declares `reversal` (*"Undo is a decision too: a
  reversal APPENDS, it never rewrites"*); `quiescentBoot.ts:122` returns early
  on it (*"No reversal producer exists yet … declared, typed, and inert until
  then"*). All five photographs confirm it: `ledger holds a reversal? : NO`.
  **`athleteSessionMoveTests` cell 21 already reds on the day a producer lands.**
- **SO THE UNIT IS THREE THINGS, AND THE BUTTON IS THE SMALLEST:** a reversal
  producer; **the replay honouring it** (upstream of any screen — until then an
  undo dies at the app boundary); then the one-step surface.
- **NOT COVERED, first line: DURABILITY WAS NOT MEASURED, because the restore
  never succeeded** — the question needs a successful undo to ask it of. ONE
  decision kind, ONE week, ONE world, DEPTH 1. No device evidence. **Three loose
  threads from the pre-control run are NAMED, not concluded**: the boot logged
  the move's replay `refused`, came back with zero reversible adjustments where
  one was active, and produced a week matching neither photograph.
- **FOUR QUESTIONS ON THE MOCK FOR SAM**, in the file: does the bar name the
  next change after an undo (the seat reads the ruling as NO); does the confirm
  sheet exist or does it undo on tap; where the bar lives; and the words.
- **A PROCESS NOTE, OWNED:** a stale zero-byte `.git/index.lock` from 18:58
  blocked the first commit. No git process was running; removed after checking,
  and recorded rather than quietly fixed — this is a shared worktree.



## Processed 2026-08-09 (fifty-first pass) — THE JOURNAL IS HIDDEN, AND THE OS STILL HELD WHAT THE SURFACE PUT THERE

- **ONE LINE: the Journal tab is gone in one edit at the navigation owner, the
  machinery is frozen exactly as R5.7 left the coach — and the hide needed a
  second half the ruling's own wording does not cover.** `7f9e54ab`, ruling
  committed as authored first at `47312bd9`, native rebuild artifacts at
  `77f5e415`. Full unpiped chain `GATE_EXIT=1` at `program-control-durable`,
  1 FAIL line, **sweep 2 of 169 = the declared set exactly**. Boundary:
  docs/JOURNAL_HIDDEN_BOUNDARY_2026-08-09.md
- **ITEM 1(a) PROCESSED IN FULL. (b) IS OPEN AND ITS FIRST MEASUREMENT IS
  NAMED; (c) NOT STARTED, as ordered.**
  LOOP CHECK `eye-pass-vetoes-a-unit` sighting 1 — **carried into undo as
  instructed**: the lesson is not "the journal was bad", it is that this unit's
  SURFACE outran its design, and undo's shape is Sam's ruling before it is a
  build (the seat brings lettered options at the design moment).
- **THE FINDING: "UNREACHABLE = NOTHING CAN EVER FIRE" IS HALF TRUE, and the
  ruling's own parenthetical is where it was checked.** True of every FUTURE
  schedule — `enableJournalReminder` has exactly one product caller and that
  caller is the hidden screen, asserted as a caller SET so an opt-in that MOVED
  to a reachable screen cannot satisfy it. **False of a schedule already
  accepted:** this feature's own design says *the OS is the store*, and a WEEKLY
  trigger fires every Monday whether the app is opened or not. Sam rebuilt with
  pods and ran the proof path; whether he tapped the opt-in is not knowable from
  this repo.
- **AND IT WOULD NOT MERELY HAVE FIRED — IT WOULD HAVE CRASHED.** The tap
  handler navigated to `JournalTab` by name; navigating to a name the navigator
  does not know throws. The old handler's own comment called that the worst
  place in this app to crash — *"the athlete is not even in the app yet"* — and
  the hide would have created exactly that case. So the hide is two removals and
  one addition, all at the navigation owner: the tab, the tap door, and a
  **cancel on mount** through the service's existing door. **Stateless,
  idempotent, no "have I cancelled" flag. North star: NEUTRAL.**
- **WHAT THE CANCEL CANNOT REACH, stated rather than implied:** an athlete who
  never opens the app again keeps whatever the OS accepted.
- **RULING 3 NEEDED NO CODE, AND THAT IS MEASURED RATHER THAN ASSUMED.** The two
  data-creating taps live on `SessionFeedbackPanel` → `DayWorkoutScreenV2` →
  the Program stack. The gate walks every hop, because "it still exists" is not
  the claim — "an athlete can still answer it" is. **Sam's veto stays open.**
- **NEW GATE `test:journal-hidden`, 35 cells** — the gate must watch the deleted
  surface. It sweeps the whole PRODUCT tree rather than the navigator, because
  the door that comes back is rarely the door that left; it pins every frozen
  module; and it pins **every journal suite in the chain**, because a hidden
  surface's suites are the first thing a tidy-up drops and they are not testing
  the screen — they are testing the coach rebuild's input.
- **SIX CELLS WENT RED AND EVERY ONE WAS RE-AIMED, NOT DELETED.** Four
  reachability cells written as the lesson of the purge: that lesson has not
  changed, it has been RULED ON — deliberate unreachability with the machinery
  kept is a different thing from an unwired screen nobody decided about. The two
  reminder cells were INVERTED and the second is now the stronger claim: the
  navigator must CANCEL, not merely decline to navigate.
- **9 MUTATIONS, 9 RED — AND ONE REFUSED TO BE READ.** M6's probe
  `<SessionFeedbackPanel` is a prefix of its own mutation
  `<SessionFeedbackPanelRetired`, so the count did not move and **the harness
  said so instead of reading a green suite as a weak cell**. The gate cell was
  already word-boundary-correct, which is why the re-probed mutation reds — the
  same law on both sides of the instrument in one run.
- **`a count taken for a record` — TENTH SIGHTING**, in the new gate on its first
  run: the opt-in sweep read its own OWNER as a second caller, because the
  service DECLARES the function. Instrument counted a NAME; claim was about CALL
  SITES. Split into owner-by-declaration + callers-minus-owner.
- **AND THE SAME LAW APPLIED TO MY OWN DENOMINATOR.** Three units have been
  called "the chain": **171** steps / **170** `npm run` suites / **169** sweep
  suites (the runner excludes `test:compile`). The last two passes reported
  "2 of 170" while the sweep was measuring 168. The failure count was right; the
  denominator was another instrument's. **The number above is the one the sweep
  printed, in the sweep's unit.**
- **NOT COVERED, first line: NOBODY HAS SEEN THE TAB BAR WITH TWO TABS IN IT.
  DEPTH 0.** The cancel is proven as far as "the door is called on mount" and no
  further — no cell reaches the notification centre. **The weekday `+1`
  conversion is now unproven AND unprovable without restoring the tab**: the
  proof panel lives on the hidden screen. Closed by removal, not by an answer.
- **FILED, NOT RIDDEN SILENTLY: no instrument in this repo distinguishes
  "shipped" from "shipped and reachable".** The sheet now records ~100 signed
  strings that are present in source and unreachable. Nothing reds — the gates
  assert PRESENCE and every string is present — but the sheet's silent
  implication is false for the journal's share of it. Precedent: "Ask Coach",
  DORMANT under batch 11-e.
- **ITEM 1(b) OPENED, AND ITS BLOCKING MEASUREMENT IS IN** (`1596d450`,
  docs/LR29_ITEM1_BOOT_REPLAY_TAPE_2026-08-09.md, instrument
  `npm run tape:lr29-boot-replay`, NOT in the chain). **The opening law held:
  built from the measured map, item 1 first.**
  **ITEM 1 IS NOT ANSWERED, AND SAYING SO IS THE RESULT.** `6 → 6 → 6` — a
  whole-day delete put NOTHING in the accumulator, so "the boot reconstructed
  it" and "there was nothing to reconstruct" are the same reading. **The reason
  is a CONDITION, not a gap:** a typed reduction is what a delete produces *when
  the week cannot absorb it* (`addFrequencyReduction`: "relocation and
  substitution were exhausted"). **One act away, not one investigation away.**
  Established anyway: every reduction in that world is GENERATION-authored
  policy and survives because the boot RE-GENERATES — no replay involved; the
  delete landed in `userRemovalConstraints`, which the boot DID reconstruct.
  **Carry into the build: the answering RUNG moved while the answer did not** —
  a past week's overlay did not survive the boot and the covering microcycle
  answered instead, row-for-row identical, so nothing visible changed.
  **The instrument had its own defect, caught mid-run** (it read
  `exposureContractsByWeek`, empty in all three worlds; the declaration lives on
  the overlay or the covering microcycle), **and an existing law caught it on its
  first full chain** (the one-door profile census — debt PAID, not declared).
- **L12 — the class is A SURFACE CUT THAT LEAVES SOMETHING RUNNING BEHIND IT.**
  R5.7's remainder was a gate; this cut's remainder was **state held OUTSIDE the
  app**, and no gate asks that question because no previous cut had any. In
  place: the two halves are paired in one block so "nothing can fire" cannot be
  satisfied by the arming half alone. **NOT in place, honestly: there is no
  general census of app state that lives outside the app** — notifications
  today; widgets, calendar entries and background tasks if they ever arrive.


### The order the fifty-first pass processed, as the seat wrote it

1. JOURNAL HIDDEN + REPLAY/UNDO UNIT OPENS (Sam ruled after his
   eye pass, 2026-08-09): docs/JOURNAL_HIDDEN_RULING_2026-08-09.md —
   commit as authored, then execute in order.
   LOOP CHECK: eye-pass-vetoes-a-unit — sighting 1 (the journal is
   the first unit to FAIL Sam's eye outright) — iterate; the lesson
   is already law elsewhere: mock-first beat words-first, and this
   unit's surface outran its design. Carry that into undo.
   (a) HIDE the journal per the ruling: one hide at the navigation
   owner (R5.7 precedent — entry gone, machinery frozen not
   deleted); data layer + suites stay live; the two data-creating
   taps STAY (seat-ruled, Sam veto open); no notification can fire.
   Full chain, short boundary.
   (b) OPEN THE REPLAY UNIT — UNDO IS ITS FACE (Sam's instinct,
   recorded in the kickoff addendum). The dependency list is
   delivered; its opening law holds: build from the measured map,
   no serial discovery. Seat brings Sam the undo shape options
   (one-step vs recent-changes list) when the design moment
   arrives; until then park-and-build within the ruled boundaries
   (program decisions via ledger; recorded facts undo separately at
   their own doors; a logged session never silently vanishes).
   (c) The COACH REBUILD is next after undo — do not start it now;
   the seat is preparing its kickoff separately. Note for its
   design: the journal's behind-the-scenes record (load, regions,
   feel, niggles) is an INPUT to coach intelligence, per Sam's
   ruling.


## Processed 2026-08-09 (fiftieth pass) — THE REMINDER IS ARMED, AND A 2-MINUTE FIRE IS HALF A PROOF

- **ONE LINE: batches 27 + 28 signed — which ARMED the reminder — and the proof
  path is TWO instruments, because the one Sam ordered would not have proven the
  thing it was ordered for.** `b203c6af`, full unpiped chain `GATE_EXIT=1` at
  `program-control-durable`, 1 FAIL line, **sweep 2 of 170 = the declared set
  exactly**. Boundary: docs/JOURNAL_PROOF_PATH_BOUNDARY_2026-08-09.md — **§6 is
  the tap-by-tap script for Sam.**
- **BOTH PARTS PROCESSED IN FULL. THEN STOPPED, as ordered.**
  LOOP CHECK `signature-arms-a-dark-surface` sighting 2 — **confirmed as
  precedent and worth keeping**: it is now the second feature whose release was a
  provenance field rather than a deploy.
- **THE ORDER'S OWN INSTRUMENT WOULD NOT HAVE PROVEN THE ORDER'S OWN TARGET, and
  saying so was the work.** A notification firing in ~2 minutes uses a
  **TIME_INTERVAL** trigger — **the weekday never enters it.** It proves the
  native module, the permission, the sentence and the tap, and leaves the
  weekday conversion exactly as unproven as before **while feeling like a pass.**
  So the panel has two buttons and labels which proves what: button 1 asks the OS
  what date the REAL weekly trigger would next fire and names the weekday
  (`getNextTriggerDateAsync`) — **that is the conversion proof, and it needs no
  waiting and no permission**; button 2 is the 2-minute fire as ordered.
- **BOTH FIRE THE REAL OBJECTS.** `journalReminderWeeklyTrigger()` and
  `journalReminderContent()` are exported and read by **the scheduler and the
  proof** — one owner each. A proof that built its own trigger would prove its own
  trigger, and the conversion is exactly the byte a hand-written copy gets right
  by accident.
- **THE GATE: `__DEV__`, DOUBLE-GATED — AND THE TWO HALVES OF YOUR TEST DO NOT
  CONFLICT, for a reason worth naming rather than assuming.** Sam must rebuild
  with pods anyway, and `npx expo run:ios` produces a **Debug** build. An
  athlete's build is Release, where the module is not bundled. **ONE CONDITION,
  and it is the failure mode to know about: build `--configuration Release` or
  install via TestFlight and the panel is simply absent — which looks identical
  to broken.** The report leads with the one command.
- **A `__DEV__` DIAGNOSTIC IS NORMALLY WRONG IN THIS REPO** (AGENTS.md; three
  device round trips paid for it). Right here because of what it is: **not a
  diagnostic watching for a defect on somebody else's build, but a bench
  instrument for the one person doing the rebuilding.**
- **THE VACUITY CHECK PAID THE SAME DAY IT WAS PROPOSED.** Signing 28 reddened two
  cells that announced themselves. The silent gap underneath: **every cell in that
  section passed `copySigned` explicitly, so none exercised the DEFAULT path that
  reads the copy module** — severing it left the suite green. **That gap predated
  the signing**; the signing is only what made it visible. Closed by the runtime
  mutation, mutation-proven.
- **AN OFF_SHEET EXCLUSION WAS A LIE WAITING TO HAPPEN, and this is the unplanned
  finding.** `components/dev/` excludes EVERY file in that directory from the copy
  sheet, justified as *"double gated, asserted below"* — **but the assertion named
  ScheduleDebugPanel BY NAME.** A second dev component would have been excluded by
  a prefix whose justification was untrue of it, with the cell still passing.
  `a green gate watching nothing` **at the seam between two gates rather than
  inside one** — both lived in the same file and still drifted. Derived from the
  directory now, and the regex accepts both render shapes so correct code cannot
  red falsely.
- **`a count taken for a record` — NINTH SIGHTING, and the second genuine survivor
  in two commits from the identical shape.** P5: "the proof uses its own
  identifier" asserted the source **mentions the NAME**; the mutation changed the
  **VALUE** to the athlete's string. N7 counted a call site file-wide; P5 counted
  a name. Both re-aimed at the claim. **The values are parsed rather than
  imported, because both modules pull `expo-notifications`, which cannot load in
  node at all** — which is also why that whole section reads source as text.
- **7 MUTATIONS, 7 RED** after the re-aim. Extraction ceiling **UNCHANGED at
  576** — the dev panel's strings are excluded, and now honestly so.
- **NOT COVERED, first line: I HAVE STILL NEVER SEEN A NOTIFICATION FIRE.** DEPTH
  0. The whole of §6 is instructions I cannot run. **The weekday conversion is
  still UNVERIFIED — but no longer UNVERIFIABLE, and that is the delta.** The
  proof panel itself has never rendered. **And one assumption is named because it
  is the suspect if the two answers disagree:** `getNextTriggerDateAsync` is
  assumed to use the same conversion for previewing as the scheduler does for
  scheduling — very likely, not proven.
- **EVERYTHING NOW WAITS ON HIS DEVICE.** Three answers close every open unknown
  in this feature: does the weekday check say Monday, does the notification
  arrive, does tapping it land on the Journal tab. Then the whole-journal eye
  pass, with **C4 (bar colours) still his open item.**


## Processed 2026-08-09 (forty-ninth pass) — THE SIGNATURE LANDS; AND A SIGNATURE TAKES THE PROOF WITH IT

- **ONE LINE: Sam signed eight constants and half the Journal front page turned
  on — the load band, the load stat tile and both earned cards — in a commit
  that edited no surface code.** `09c29fb7` + `646116d3` + `8b12fcdd`, full
  unpiped chain `GATE_EXIT=1` at `program-control-durable`, 1 FAIL line,
  **sweep 2 of 170 = the declared set exactly**. Boundaries:
  docs/JOURNAL_SIGNING_BOUNDARY_2026-08-09.md ·
  docs/JOURNAL_NOTIFICATION_BOUNDARY_2026-08-09.md. Ruling committed as authored
  first at `b4335d2a`.
- **ALL SIX WORK-ORDER ITEMS PROCESSED IN FULL.** C4 untouched as instructed.
  LOOP CHECK `signing-batched-to-one-sitting` sighting 1 — **the compression is
  worth keeping and it paid twice**: one Sam-line moved 26 batches, 8 constants
  and 6 decisions, and the eight constants alone lit four surfaces.
- **⚠ SAM MUST REBUILD WITH PODS.** `expo-notifications` is a new NATIVE
  dependency with its plugin in `app.json`. A JS reload will not pick it up.
- **THE FINDING OF THE PASS: A SIGNATURE TAKES THE PROOF WITH IT.** Until this
  morning, section [2] of the load suite proved the whole provenance mechanism
  for free — real constants were proposed, so real outputs were dark, and
  asserting the darkness asserted the wiring. **Signing every constant removed
  that evidence and left the assertions looking fine.** Every remaining proof ran
  over hand-built values. The next author could write
  `{ value, provenance: 'signed' }` by hand instead of `derived(value, …)` and
  nothing would red — **the mechanism dead while reading green.** New section
  [2b] un-signs a constant AT RUNTIME and rebuilds the real model, both
  directions, mutation proven applied and the table proven restored.
- **PROPOSED COMPRESSION, and it generalises past this repo: when a gate's
  subject changes state, ask not only "which cells red?" but "WHICH CELLS ARE NOW
  VACUOUS?"** The eleven that reddened announced themselves. The ones that
  silently emptied did not, and they were the dangerous half. Two more in the
  same commit: the `every PROPOSED constant says so` cell now asserts over an
  empty set (kept, labelled vacuous, counterpart added), and seven cells became
  TYPE ERRORS because `as const` narrowed provenance to `'signed'`.
- **ELEVEN CELLS WENT RED ON THE FLIP AND EVERY ONE WAS RE-AIMED, NOT DELETED** —
  they existed to red on exactly this day. **Their VALUES are unchanged**, so
  cells that only watched provenance would have let the numbers move on the same
  day; values are asserted beside signatures now.
- **A CONFLATION IN THE DOOR, CAUGHT BY THE NEW CELL ON ITS FIRST RUN:**
  `signedValue` returns null for UNSIGNED and for ABSENT alike, so "it came back"
  read false for a legitimately-null conditioning stream.
- **A COMMENT IS NOT A SHIPPED STRING — FOURTH SIGHTING, FIXED** (`646116d3`).
  **This gate was filed as latent debt yesterday and stopped being latent this
  morning.** Mutation-testing C3 reddened both journal suites and left the copy
  binder GREEN, kept green by a docblock about the very ruling being violated.
  **It found four strings the sheet claimed were shipping**: "Niggles" (a genuine
  omission in yesterday's batch 26, fixed) and three named in `KNOWN_ABSENT` with
  the record that ruled on each. **"Ask Coach" must NOT be withdrawn** — 11-e
  rules it DORMANT for the beta cut, and withdrawing it would BE the retirement
  it says nobody signed.
- **C5's PREMISE WAS ONE WORD OFF AND CHECKING IT WAS THE WORK.** "The
  closed-twelve month table already exists on the screen" — it did, holding
  `Mar`, not `March`. One table of full words with the abbreviations DERIVED, and
  a cell proving the derived twelve are byte-identical to what batch 26 shipped.
  **Four sites were rendering "since 2026-04-06" while a comment three lines up
  claimed "since 6 Apr"** — the claim and the code disagreed for a whole slice.
- **THE NOTIFICATION IS BUILT AND DELIBERATELY DARK.** **ZERO new stored state —
  the OS is the store.** "A refusal is a fact, not an error" is a returned state
  beside `scheduled`, and `refused` renders nothing. **The sentence gate refuses
  even with permission ALREADY GRANTED**, because iOS grants ONE prompt and
  burning it on a feature that cannot fire does not get it back.
- **`a count taken for a record` — EIGHTH SIGHTING**, and the second time this
  week inside a brand-new gate on its first mutation run. N7 survived: "a
  reschedule cancels first" was asserted FILE-WIDE and `disableJournalReminder`
  satisfied it. Re-aimed at the located region, with the ORDER asserted.
- **A NUMBER IN THE LAST TWO REPORTS WAS WRONG.** They said "sweep 2 of 167"; the
  chain held **169** at both commits, measured, byte-identical script list. The
  failure count was right and the denominator was not. It is 170 now.
- **NOT COVERED, first line: NO DEVICE EVIDENCE, and it matters more this pass
  than any before it. DEPTH 0.** Four surfaces rendered for the first time today
  and **not one has been seen**; the band's track and marker are GEOMETRY no cell
  draws. **No notification has ever been scheduled or delivered** — the weekday
  `+ 1` for expo's Sunday-is-1 numbering is read off documentation and is the
  single most likely thing to be wrong.
- **SEVEN PARKED FOR SAM**, two of them live: **batch 28's notification sentence
  (blocking that feature on purpose)** and **C4, his own open item on the bar
  colours**. Then: the restored lifts line showing on a non-lifting week; "March
  2025"; batch 27's twelve words; 08:00 as the hour; no in-app off switch.


## Processed 2026-08-09 (forty-eighth pass) — THE EXCEPTION-BASED FRONT PAGE; AND HALF OF IT WAITS ON ONE SIGNATURE

- **ONE LINE: the Journal's front page is exception-based, in Sam's order** —
  hero / stat strip / week bars / earned cards / lifts / month drawer / note —
  **and building it revealed that most of it is behind his signature, including
  two thresholds no code had ever read.** `73232293` + `b6509f02`, full unpiped
  chain `GATE_EXIT=1` at `program-control-durable`, 1 FAIL line, **sweep 2 of 167
  = the declared set exactly**. Boundary:
  docs/JOURNAL_UI_SLICE_BOUNDARY_2026-08-09.md · plan measured first:
  docs/JOURNAL_UI_SLICE_PLAN_2026-08-09.md
- **ITEM 1 PROCESSED IN FULL.** Ruling + mock committed as authored at
  `fca3ef77` before a line was built. LOOP CHECK `appearance-pass-ruled-from-mock`
  sighting 1: **the method held and is worth keeping** — the mock answered
  questions words would have round-tripped on, and the ruling's own ORDER became
  a gate rather than a paragraph.
- **THE ORGANISING RULE IS A STATEMENT ABOUT NULL, NOT A LAYOUT.** "Nothing
  appears unless it has something to say" is built as: every block below the hero
  returns null when it has no news. That is a PROPERTY, so `journalUiLawsTests`
  asserts it per block rather than as a file-wide count of `return null`.
- **HALF THE FRONT PAGE IS DARK, AND IT IS THE MECHANISM WORKING.** The load
  band, the load tile and both attention cards are downstream of PROPOSED
  constants, so `signedValue` returns null. The ruling says these ship PROPOSED —
  so **one signing session turns half the screen on with no code change**, and
  that is now the bottleneck rather than any build.
- **TWO OF THOSE THRESHOLDS HAD NEVER BEEN READ BY ANY CODE.**
  `patternDriftThreshold` has been in the signing table since the load slice;
  `patternBalance` carried its PROVENANCE but nothing ever compared anything to
  0.25. **Signing it would have changed nothing on any screen.** It has a reader
  now, proven a threshold in both directions.
- **THE FINDING OF THE PASS: BUILDING BEHIND A SIGNATURE HIDES YOUR OWN
  DUPLICATES.** I shipped the region observation with TWO renderers — a faint
  line in the load band and the earned card. Both dark, so the screen looked
  right and every cell passed; **the duplication would have appeared for the
  first time on the day Sam signed, in a commit that touched no code.** Caught by
  reading the finished screen back, which is the load slice's habit paying again.
  Fixed `b6509f02`; the cell asserts the COUNT — exactly one renderer per dark
  fact — not the absence.
- **THE STYLE LAW IS A GATE NOW.** "Match the style of the rest of the app"
  degrades one hex at a time, never by a redesign — so the screen may declare no
  raw colour literal, no rgb(), no bare padding/margin/gap, and must read the
  tokens and mount the shared `Card`. **It caught two on its first run.** Scope
  stated out loud: ONE FILE; the rest of the app is a unit of its own.
- **`a count taken for a record` — SEVENTH SIGHTING, third inside a brand-new
  gate on its first run.** My "the letters are dead" sweep went red on **`'M'` —
  Monday's initial**, not a shape letter. Unit was "a quoted capital anywhere in
  the file"; domain noun was "a shape abbreviation". Scoped to the table, plus a
  cell protecting the weekday initials so the sweep cannot be "fixed" by deleting
  them.
- **A GATE READING SOURCE CANNOT TELL A COMMENT FROM A SHIPPED STRING — it fired
  three times in one slice**, always on comments that document a retirement by
  quoting it. Stripped to code at each cell, with the reason recorded.
  **NAMED AND NOT FIXED: the binder's existing RETIRED cell has the identical
  latent gap.** Filed, not ridden silently.
- **THE BINDER GREW A `WITHDRAWN:` FORM**, because batch 26 retires NINE strings
  and the sheet could record a string that CHANGED but not one that STOPPED — in
  a table a withdrawal read as a fresh proposal, in prose nothing watched it. The
  new form asserts the stronger thing: a withdrawn string must be ABSENT.
  Mutation-proven both directions.
- **22 MUTATIONS, 21 RED. The one survivor was MY BAD MUTATION**, not a weak cell
  (I withdrew a string never in the app, which correctly passes); re-aimed, it
  reds. **One mutation deliberately failed to apply and the harness REFUSED to
  read its result** — the strength-line lesson built into the tooling.
- **ZERO NEW STORED STATE.** Two new derivations, both reads: the game-feel tile
  needed a RATING where the model had a COUNT (**the LATEST game, never a mean**
  — 2 and 5 average to a number no game earned), and the drift verdict above. One
  new PROPOSED constant, `regionHotRatio`, **applied to the existing value rather
  than minted beside it**. North star: **TOWARD**.
- **COPY BATCH 26 PROPOSED**, the first batch whose subtractions outweigh its
  additions. Extraction ceiling **580 → 572, DROPPED in the commit that earned
  it**, attributed −6 headings / −3 empty states / −1 replaced / +2 new.
- **NOT COVERED, first line: NO DEVICE EVIDENCE, and this is the slice where that
  hurts most.** An appearance slice's defects are VISUAL; no cell mounts the
  screen; every assertion is about the SHAPE of the code. **DEPTH 0. Sam's eye is
  the only instrument and it has not run.** Week navigation is NOT built (the
  mock's arrows need a hook that resolves other weeks).
- **FIVE THINGS PARKED FOR SAM**, listed in the boundary report: the signing
  session (now the bottleneck); **whether the lifts empty state should come
  back** — the one retirement that costs an athlete information; the two
  threshold values; batch 26's words; and **whether the week bars should keep the
  app's red/orange/green intensity tokens** or take the mock's calmer
  single-accent ramp — kept as the app's under the style law, but his call.

## Processed 2026-08-09 (forty-seventh pass) — THE JOURNAL UNIT IS COMPLETE

**ITEM 1, THE STANDING AUTHORISATION, IS PROCESSED IN FULL.** Sam: *"i just want
to get it all on there then we can worry about how it looks."* It is all on
there. **22 of 22 design + addendum items built, or measured and named with the
reason.** END-OF-UNIT BOUNDARY: docs/JOURNAL_UNIT_BOUNDARY_2026-08-09.md ·
audit: docs/JOURNAL_COMPLETION_AUDIT_2026-08-09.md

- **TEN SLICES, CONTINUOUS, NO STOP BETWEEN ANY OF THEM** — load model, feel,
  strength line, this week's job, niggles + resurfacing, monthly review,
  consistency/balance/flags, week kinds, week status, what changed.
  **Every one: full unpiped `test:bible` `GATE_EXIT=1` at
  `program-control-durable`, 1 FAIL line, and a sweep equal to the declared set
  EXACTLY** (2 of 160 → 2 of 166 as the suite count grew). `test:compile` PASSED
  throughout. HEAD `e9bec76e`.
- **THE WHOLE UNIT ADDED TWO PIECES OF STORED STATE**, both INPUTS on a door that
  already existed (`gameFeel`, `expectation`/`expectationReason`). Everything
  else derives on read from facts the app already persists. **No stored derived
  output, no exception requested, none needed. North star: TOWARD.**
- **THE IDEA THAT PAID FOR ITSELF: provenance travels with the number.** Built in
  slice 1 to satisfy one order, it later decided on its own — with no further
  thought — that the strength line and the balance picture could ship and the
  load headline could not. **A surface four slices later asked for a value and
  got the right answer about whether it was safe to show.**
- **FIVE FINDINGS WORTH MORE THAN THE FEATURES THEY CAME FROM**, each with a
  receipt in the boundary report: an assumption is invisible to the suite its
  author wrote; a mutation that never applied reports as a survivor; a filter is
  only tested by a fixture that would fail without it; a green gate can be
  watching nothing (sighting 3, ~150 strings SIZED and filed); and **"blocked"
  needs the same receipt as "built"** — I called week status blocked from a
  gate's refusal rather than a measurement, and the derivation was reachable the
  whole time.
- **NINE NEW GATED SUITES.** Copy batches **15-25 PROPOSED**; the load model's
  **7 unsigned constants of 9** await the one signing session the order reserved.
  One of those seven (`minimumWeekCoverage`) is MINE and not in Sam's ruling —
  flagged, not slipped in.
- **A PROCESS SLIP OWNED:** `git stash`, forbidden in this shared worktree.
  Caught immediately, popped, every file verified restored and compiling;
  scratchpad-copy used thereafter.
- **NOT COVERED, first line: NO DEVICE EVIDENCE FOR ANY OF IT.** DEPTH 0
  everywhere. **This is where Sam's reserved appearance pass belongs** — the
  monthly charts are the first thing in the unit whose defects are VISUAL rather
  than testable, and no test in this repo can give him that.
- **TEN RULINGS PARKED, NONE BLOCKING**, listed in the boundary report — the
  notification's native dependency being the largest.

## Processed 2026-08-09 (forty-sixth pass) — NIGGLE HISTORY + RESURFACING; TWO WRONG ASSUMPTIONS CAUGHT BY EXISTING LAWS

- **ONE LINE: the athlete sees their niggle history by region, and what they
  wrote the last time that region flared — joined by TIME, because a note cannot
  be knee-tagged.** `b75cc63f`, full unpiped chain `GATE_EXIT=1` at
  `program-control-durable`, 1 FAIL line, **sweep 2 of 164 = the declared set
  exactly**. Boundary: docs/JOURNAL_NIGGLE_SLICE_BOUNDARY_2026-08-09.md
- **SIXTH SLICE THIS SESSION, STILL CONTINUOUS UNDER ITEM 1:** load model → feel
  → strength line → this week's job → niggles. Zero new stored state in all but
  the feel slice, which added two INPUTS on an existing door.
- **THE DESIGN'S EXAMPLE WAS NOT BUILDABLE, AND SAYING SO WAS THE WORK.** "A
  knee-tagged note resurfaces" assumes a region tag; `JOURNAL_NOTE_TAGS` is the
  closed eight with no region, closed deliberately in slice 2. **Route (a)
  resurfaces BY TIME** — injury-tagged notes written during an earlier episode's
  weeks — which is a FACT rather than an inference. **Route (b), a region on a
  note, reopens a vocabulary Sam ruled and is HIS call: not assumed.**
- **TWO WRONG ASSUMPTIONS OF MINE, EACH CAUGHT BY A LAW THAT ALREADY EXISTED —
  and that is the finding of the pass.**
  (1) `journalNoteOwnershipTests` refused the module outright: **no `rules/`
  module reads the note store.** The tempting argument was that a type-only
  import is erased at compile and therefore harmless — that would have traded a
  non-negotiable for a convenience and left the next reader one keystroke from a
  real import. The note now arrives as a NARROW STRUCTURAL VIEW, the same shape
  `journalWeek` already uses for a session outcome.
  (2) The **COMPILER** refused `episode.region` as a grouping key: it is typed
  `upper_body | lower_body | back_midline | other` — a coarse CONSTRAINT bucket,
  not one of Sam's thirteen. It would have filed a knee and a hamstring together
  AND put an internal word on an athlete's screen. Keyed on the athlete's own
  `bodyPart` through `resolveInjuryRegion` now — the owner whose header records
  five divergent copies that once disagreed.
- **OBSERVATION, NEVER DIAGNOSIS**, enforced not promised: the note returns as the
  athlete's own words, unparsed; the introducing line states only WHEN it was
  written; a cell sweeps the module for causal vocabulary.
- **A RECORD COUNT IS NOT AN INJURY COUNT.** `superseded` means the RECORD was
  replaced; counting it would say two niggles where there was one.
- **7 MUTATIONS, 6 REDS, 1 GENUINE SURVIVOR** — the region tie-break, which no
  fixture had tied. **THE HARNESS NOW PROVES EACH MUTATION APPLIED BEFORE READING
  ITS RESULT**, which is the strength line's lesson built in rather than
  remembered; all seven printed `applied`, so the survivor was real.
- **THE LAST SLICE IN THE ORDER IS MEASURED, AND THERE IS NO CHART WALL**
  (docs/JOURNAL_MONTHLY_REVIEW_PLAN_2026-08-09.md): `react-native-svg` is a
  dependency **and genuinely wired** — AppNavigator, PlanChangeSheet and
  GuidedInjuryFlowSheet all render it today, so drawing works on the build Sam
  already runs. `victory-native` and Skia are dependencies **imported nowhere in
  `src/`** — unproven on device, so recommended AGAINST by default rather than
  reached for. **Almost every series already exists** in `JournalLoadModel.history`
  / `patternSharesDone` / `JournalWork`; the one new derivation is a MULTI-WEEK
  strength series beside the existing week-over-week arrow.
- **NOT COVERED, first line: NO DEVICE EVIDENCE.** And whether `affectedWeeks` is
  kept complete by the episode transaction on a live device is NOT asserted — the
  one thing that would silently resurface nothing while every cell stayed green.
- **SAM'S QUESTIONS PARKED:** should a note carry a region (route b); the region
  words on screen ("ankle/foot — 2 episodes") want an eye; batch 21's copy. Plus
  everything queued: **copy batches 15-21** and the load model's **7 unsigned
  constants of 9**.

## Processed 2026-08-09 (forty-fifth pass) — THIS WEEK'S JOB; AND A GATE CAUGHT ME READING A STALE TALLY

- **ONE LINE: "This week asks for 3 strength, 2 conditioning." — read off the
  contract the Section 18 resolver already authored, and the completion verdict I
  first built beside it was REFUSED BY A GATE.** `67f80e0b`, full unpiped chain
  `GATE_EXIT=1` at `program-control-durable`, 1 FAIL line, **sweep 2 of 163 = the
  declared set exactly**. Boundary:
  docs/JOURNAL_WEEK_JOB_BOUNDARY_2026-08-09.md
- **FOURTH SLICE THIS SESSION, STILL CONTINUOUS UNDER ITEM 1:** load model → feel
  → strength line → this week's job. No stop between any of them.
- **THE CORRECTION IS THE REPORT.** The first version rendered "All of it is
  done." / "1 strength to go." from `achievedCount` and
  `unresolvedMinimumShortfall` on the **STORED** contract.
  `section18ShortfallCopyTests` went red on its first run with exactly the right
  sentence: *"no caller reads an achieved tally off a stored contract"*.
  **A TARGET is policy — stable, safe to read. An ACHIEVED TALLY is derived
  output, and a stored one goes stale beside the facts it came from: the athlete
  trains on Thursday and the snapshot still says what it said on Monday.** I
  would have put that on their screen and called it their week.
- **CONSEQUENCE, TAKEN HONESTLY:** week STATUS (Group 1 item 3) is **NOT BUILT**.
  It needs a freshly-derived ledger (`ledgerFromEffectiveWorkouts` +
  `evaluateWeeklyExposureContract`) and belongs to the owners that gate names; its
  wording reaches Sam as its own batch when built. **"Did the work happen"
  already answers completion** from recorded outcomes, so the athlete keeps a
  completion picture and the app keeps ONE answer to that question.
- **THE TWO WITHDRAWN SENTENCES WERE REMOVED FROM BATCH 20, not left proposed** —
  a proposal for wording nothing uses wastes a ruling, and the binder says so.
  Ceiling went 568 → 571 → **570**, and the comment records the retraction rather
  than quietly landing on the lower number.
- **WHAT WAS RIGHT FIRST TIME:** the contract is READ, never rebuilt (the trap the
  Monday card plan named in advance, gated by a source sweep);
  `ATHLETE_WORD_FOR_DOMAIN` is **EXPORTED from its owner rather than copied**, so
  the Journal cannot grow a rival vocabulary for the words the athlete reads; and
  Sam's `ATHLETE_FORBIDDEN_VOCABULARY` is asserted on this new surface too.
- **L12 — what catches the next one:** the app-wide gate already sweeps for this
  class and is why it fired. What this slice adds is a LOCAL assertion at the new
  reader: cells [3] and [4] forbid both tally names here, and a fixture with
  wildly wrong stored tallies (`achievedCount: 99`, shortfall 7) proves they
  cannot change what is reported. **The next person reaching for the convenient
  number reds two suites, not one.**
- **NEXT MEASURED, WITH A GAP THAT CHANGES THE FEATURE**
  (docs/JOURNAL_NIGGLE_SLICE_PLAN_2026-08-09.md): niggle history is FREE over
  `InjuryEpisodeV1`. **But a note CANNOT be knee-tagged** — `JOURNAL_NOTE_TAGS` is
  a closed eight with no region, deliberately closed in slice 2. So the design's
  "a knee-tagged note resurfaces" is not buildable as written. **Route (a):
  resurface BY TIME** — notes written during an earlier episode's `affectedWeeks`,
  injury-tagged — needs nothing new and keeps the claim factual. **Route (b), a
  region on a note, reopens a vocabulary Sam closed and is his call.**
  RECOMMENDED: (a).
- **NOT COVERED, first line: NO DEVICE EVIDENCE**, no cell mounts the screen,
  DEPTH 0. And a week that SHOULD have a contract but has none renders identically
  to one that legitimately has none — no unit test can tell those apart.
- **SAM'S QUESTIONS PARKED:** the ask line's sentence shape (the domain words are
  already his); the week-status wording when it is built; plus everything already
  queued — copy batches 15-20 and the load model's 7 unsigned constants of 9.

## CHECKPOINT 2026-08-09 — THREE SLICES LANDED CONTINUOUSLY; HANDOVER COMMITTED (not a wall)

**docs/JOURNAL_UNIT_HANDOVER_2026-08-09.md** — written under item 1's own
instruction ("checkpoint + handover before context runs low"). **HEAD `65070c6a`.**

- **Load model, feel slice and strength line all landed with no stop between
  them**, each with a full unpiped chain `GATE_EXIT=1` at the declared red and a
  sweep equal to the declared set exactly (2 of 160, 2 of 161, 2 of 162).
- **The Journal now shows the athlete a number** ("Back Squat — 120kg, up on last
  week") and states the Load section's own evidence. Everything downstream of an
  unsigned constant is built, tested and DARK.
- **THE UNIT'S ONE GENUINE WALL IS SAM'S:** there is no notification
  infrastructure at all — `expo-notifications` is absent, so the Monday
  notification needs a native dependency, a permission prompt the athlete can
  refuse, and a scheduling policy. **The card composes in full without it**, so
  this parks rather than stops.
- **THE NEXT SLICE'S TRAP IS NAMED IN ADVANCE:** `useResolvedWeek` exposes neither
  the week's contract nor the season phase, so the builder must READ the contract
  the generation path already resolves rather than building a second answer to
  "what does this week ask of the athlete". Addresses in
  docs/JOURNAL_MONDAY_CARD_PLAN_2026-08-09.md §3b.
- **THREE LOOP-CHECK SHAPES PROPOSED FOR COMPRESSION**, all in the handover:
  `an assumption is invisible to the suite its author wrote`; `a mutation that
  never applied reports as a survivor`; `a green gate watching nothing` sighting 3
  (closed for one module, **~150 strings across 20+ modules SIZED and filed as
  its own unit**).
- **SAM'S QUEUE: copy batches 15-19 and the load model's 7-of-9 constants, plus
  seven rulings**, none blocking. Listed in the handover.
- **OWED AND NAMED:** `test:session-feedback-form` ungated + red at HEAD (4
  pre-existing failures, reported not absorbed); a `git stash` process slip, owned
  and repaired; no device evidence anywhere in this unit.

## Processed 2026-08-09 (forty-fourth pass) — THE JOURNAL SHIPS ITS FIRST NUMBER; AND A MUTATION THAT NEVER APPLIED

- **ONE LINE: "Back Squat — 120kg, up on last week" — Monday card item 2, the
  first number the Journal shows an athlete, and it ships because it waits on
  nothing.** `64d142d7`, full unpiped chain `GATE_EXIT=1` at
  `program-control-durable`, 1 FAIL line, sweep 2 of 162 = the
  declared set exactly. Boundary:
  docs/JOURNAL_STRENGTH_LINE_BOUNDARY_2026-08-09.md
- **STILL RUNNING CONTINUOUSLY UNDER ITEM 1.** Load slice → feel slice → strength
  line, no stop between them. Zero new stored state in all three.
- **WHY THIS NUMBER SHIPS AND THE LOAD HEADLINE DOES NOT — structurally, not by
  choice.** Every load headline sits behind `signedValue` because it is
  downstream of an unsigned constant. This module has NO constants: "10kg heavier
  than last week" compares two recorded weights rather than judging against a
  threshold, and `flat` is exact equality — a fact, not a tolerance. **A cell
  asserts the module declares no threshold constant, and the mutation inserting a
  2.5kg tolerance reds it.** If Sam ever wants that tolerance it becomes a
  constant and joins the load model's signing table.
- **THREE ABSENCES ARE FIRST-CLASS ANSWERS**, because each alternative is a
  *record of work nobody did* — worse than a wrong number because it is
  believable. A SKIPPED lift is excluded (its stored kg is what was PRESCRIBED
  and not lifted). A lift with no previous CALENDAR week is `new`, never `flat`.
  Reps are null when unlogged, never the prescribed range.
- **"ANCHOR LIFT" HAS NO OWNER IN THIS APP, MEASURED.** The design says "one line
  per anchor lift"; `isAnchor` in `sessionClassificationAdapter` and
  `workoutCanonicalisation` means a game/team-training anchor **DAY**, a different
  noun. Read as "the main lifts the app already records"
  (`strengthLogging.isMainStrengthExercise`), with **no rival predicate invented**.
  A narrower authored set is Sam's ruling — named in NOT-COVERED, not decided.
- **LOOP CHECK — a new shape, worth a name: `a mutation that never applied reports
  as a survivor`. SIGHTING 1.** One mutation came back GREEN and my first reading
  was that the cell was weak. It was not: the `perl` substitution had silently
  matched nothing, so the mutation never entered the file. Re-applied with the
  replacement **verified present**, the cell went red immediately. **A failed
  mutation and a surviving mutation are indistinguishable in the output, and the
  failed one points the author at their TEST instead of their TOOLING — so it
  costs a weakened cell, or a rewrite of a cell that was already correct.**
  **PROPOSED COMPRESSION: assert the replacement is PRESENT in the file before
  reading any mutation result.** A `grep -c` costs nothing. This is the third
  address of `a fixture is a claim too` / `instrumentation must be alive where the
  defects are` — the instrument, not the subject, was the thing that lied.
- **6 MUTATIONS, 6 REDS** once measured honestly: skipped lift becoming a top set;
  a first-time lift claiming `flat`; the unsigned 2.5kg tolerance; "last week"
  becoming "the last week I trained"; the tie-break dropped so the order wobbles;
  and the prescription standing in for unlogged reps.
- **THE REST OF THE MONDAY CARD IS MEASURED WITH RECEIPTS** (plan doc §3b), so the
  next session starts from addresses rather than a search: week status and this
  week's job both derive from the week's CONTRACT
  (`weeklyExposureContractBuilders.ts`, evaluated by
  `evaluateWeeklyExposureContract`); phase has one owner (`ownSeasonPhase`).
  **THE TRAP NAMED IN ADVANCE: `useResolvedWeek` exposes neither the contract nor
  the phase, so the next builder must find where the generation path ALREADY
  resolves the contract and read it. Building a second one is a second answer to
  "what does this week ask of the athlete"** — the defect class every slice in
  this unit has had to refuse.
- **STILL PARKED, STILL SAM'S:** the notification needs a NATIVE dependency
  (`expo-notifications` is absent) + a permission prompt the athlete can refuse +
  a scheduling policy. The card composes in full without it.
- **NOT COVERED, first line: NO DEVICE EVIDENCE** — the kg figure, the line length
  and how several lift rows stack are unverified by eye. DEPTH 0. The four arrow
  words are invisible to the extraction gate (keyed object) and are listed in
  batch 19 anyway.
- **SAM'S QUESTIONS PARKED:** (1) should "anchor lift" be a narrower authored set;
  (2) is `flat` right as exact equality — a half-kilo more currently reads "up",
  and a tolerance would join his signing batch; (3) batch 19's words.

## Processed 2026-08-09 (forty-third pass) — THE FEEL SLICE; AND THE MONDAY CARD HITS A MEASURED WALL

- **ONE LINE: the athlete can rate their legs after a game and say whether any
  session matched the plan — two new INPUTS on the door that already existed,
  zero derived state, no new store, no new transaction.** `528e5c67`, full
  unpiped chain `GATE_EXIT=1` at `program-control-durable`, 1 FAIL line, sweep
  SWEEPNUM of SWEEPTOT = the declared set exactly. Boundary:
  docs/JOURNAL_FEEL_SLICE_BOUNDARY_2026-08-09.md · plan measured first:
  docs/JOURNAL_FEEL_SLICE_PLAN_2026-08-09.md
- **RUNNING CONTINUOUSLY UNDER ITEM 1.** Load slice → feel slice, no stop between
  them. The Monday card is measured and its wall is reported below.
- **EFFORT-ON-STRENGTH IS DELIVERED, NOT DEFERRED — as the TAP.** `difficulty` is
  written from the conditioning RPE alone, so a strength session recorded no
  effort at all. Sam's ruling extends the tap rather than minting a number ("one
  tap, no per-set anything"), so the tap rides every performed session — the only
  place a strength effort can be recorded today. No second field.
- **ASK-FLAG IS SEND-FLAG.** The body-feel rating is asked only on a game and
  stored only on a game; tapping back to "as expected" clears the why in BOTH the
  form and the payload; a half-answered pair is refused at the DRAFT, because the
  form will not ask again and the stored expectation would have a reason nothing
  could ever supply.
- **NO FIFTH SPELLING OF "IS THIS A GAME".** Measured before building: four
  spellings, no owner. The panel asks `classifyDaySessions`, gated by a sweep that
  also forbids a bare `workoutType === 'Game'` appearing there later. The other
  four are named census debt, not hunted.
- **LOOP CHECK: `a green gate watching nothing` — SIGHTING 3, and COMPRESSED.**
  Recording batch 18 turned the binder red for strings plainly in the app, and the
  extraction ceiling never moved — both gates scope to screens/components/
  navigation while these words are authored in `utils/sessionFeedbackForm.ts`.
  Closed for that module through the existing `AUTHORING_MODULES` hatch, used as
  its own comment intends ("a screen is not where copy is AUTHORED"); bound
  strings 84 → 99.
  **SIZED RATHER THAN ASSERTED, and deliberately NOT folded in: ~150 `label:`
  prose strings across 20+ modules in `utils/` and `rules/` are invisible to both
  gates** — including the feedback form's pre-existing vocabulary ("Busy / no
  time", "How was training?", every feeling and soreness option), **none of which
  has ever appeared on the copy sheet**. That is a unit of its own; folding it in
  would raise the ceiling by a large attributed number inside a commit about
  something else. **Proposed for scheduling.**
- **A RED SUITE FOUND, REPORTED, NOT ABSORBED.** `test:session-feedback-form` is
  ungated and has **4 pre-existing failures** at HEAD (measured via a scratchpad
  copy). All four assert a power block is separately completable; probed directly,
  `getSessionComponents` emits no power component at all. That is probably the
  power-row redesign working as intended and the suite going stale — but "probably"
  is not a verdict, and whether power should be separately completable is a
  coaching ownership call. **Not gated, and not "fixed" by editing expectations to
  match.** My change is failure-neutral: 4 before, 4 after.
- **8 MUTATIONS, 8 REDS — TWO SURVIVED THEIR FIRST RUN, and they were one gap.**
  The payload cells hand the builder `null` themselves, so nothing checked the
  PANEL computes it; deleting both guards left the suite green while a non-game
  stored a rating and a stale why rode along after a tap-back. **A builder tested
  with hand-written nulls proves the builder and says nothing about its caller.**
  New cells anchor to the panel's payload call; both mutations now red.
- **A PROCESS SLIP, OWNED: I used `git stash`**, which AGENTS.md forbids in this
  shared worktree. Caught immediately, popped, every file verified restored and
  compiling; the scratchpad-copy method used for the rest of the pass. Recorded
  rather than quietly fixed.
- **THE MONDAY CARD IS MEASURED, AND ITS NOTIFICATION IS A WALL — PARKED, NOT
  GUESSED** (docs/JOURNAL_MONDAY_CARD_PLAN_2026-08-09.md). Most of the card is
  already built by slices 1/2/load/feel; what remains is the strength line, week
  status, this week's job, and what changed/was protected. **But there is NO
  notification infrastructure at all — `expo-notifications` is not a dependency.**
  A local notification needs a new NATIVE dependency + a permission prompt the
  athlete can refuse + a scheduling policy. That is Sam's call, not a terminal's,
  and it is the one Journal item that cannot be verified without a device. **The
  card builds in full without it, so the split is clean and this is not a stop.**
- **NOT COVERED, first line: NO DEVICE EVIDENCE** — no cell mounts the feedback
  panel; chip wrapping and how seven reason chips lay out are unverified by eye.
  DEPTH 0. **The post-game rating feeds NOTHING yet** — it is recorded and counted
  only; the observation lines it "powers" belong to the monthly-review slice, and
  reading a brand-new field into a model in the slice that mints it would ship the
  second half of a feature nobody has seen work.
- **SAM'S QUESTIONS PARKED:** (1) the five body-feel words (Empty / Heavy / Okay /
  Good / Flying) are entirely mine and most want his eye; (2) should the tap be
  REQUIRED rather than optional — built optional because it is a new question on a
  flow athletes already use; (3) should a power block be separately completable;
  (4) the notification dependency + permission above.

## Processed 2026-08-09 (forty-second pass) — THE LOAD MODEL IS BUILT, AND PROVENANCE TRAVELS WITH THE NUMBER

- **ONE LINE: Sam's five-layer load model is built as a pure derivation with ZERO
  new stored state, and no athlete-facing number can be derived from an unsigned
  constant — because provenance now travels with the number rather than with a
  promise.** `12da456f`, full unpiped chain `GATE_EXIT=1` at
  `program-control-durable`, 1 FAIL line, sweep 2 of 160 = the declared
  set exactly. Boundary: docs/JOURNAL_LOAD_SLICE_BOUNDARY_2026-08-09.md ·
  dependency list measured first: docs/JOURNAL_LOAD_SLICE_PLAN_2026-08-09.md
- **ITEM 2 PROCESSED IN FULL. Item 1 (the standing authorisation) is now the
  live order** and the next slice opens under it without waiting.
- **THE COMPRESSION THE ORDER ASKED FOR, BUILT AS A MECHANISM.** "The
  athlete-facing line shows no number derived from unsigned constants" is a rule
  somebody has to keep every time they add a line. Instead: one constants table,
  each entry carrying `signed`/`proposed`; every derived value carrying the
  COMBINED provenance of what fed it; `signedValue()` the only door a surface may
  read through. **Sam's signature alone turns the lines on — no code change** —
  and a new constant cannot leak, because everything downstream of a proposed one
  goes proposed automatically. Mutation-proven in both directions.
- **ATHLETE-VISIBLE, and it is what honesty allowed:** the Load section stops
  promising a feature and states its own evidence — "Load is measured from the
  sessions you log — 3 of 5 this week have detail recorded". No constant feeds a
  count, so it needs no signature. Headline continuum, band and region lines are
  built, tested, listed as batch 17 and DARK.
- **EFFORT-TAP-ON-STRENGTH DID NOT RIDE THIS SLICE, on the order's own fallback.**
  Measured: `SessionFeedback.difficulty` is written from exactly one source
  (`SessionFeedbackPanel.tsx:533`, the conditioning RPE), so a strength session
  stores no rating at all. But `tonnageModulatedByEffort` is PROPOSED and defaults
  OFF, and tonnage is a native measurement needing no rating — with the constant
  off, the tap would change no visible number. It lands with the "felt different"
  slice, which is the next one.
- **THREE DEFECTS I CAUGHT IN MY OWN MODULE AFTER IT HAD ALREADY PASSED A FULL
  GATE**, and this is the finding of the pass. (1) The "four-week normal" was the
  four most recently LOGGED weeks, not the four CALENDAR weeks — weeks
  -1/-2/-3/-20 is not a four-week normal, and every ratio against it would have
  been confidently false. (2) The model held Sam's 2/1/0 rung as a SECOND OWNER of
  `JournalWeek.load.thisWeek`, over a different input set, summing ZERO for a week
  with nothing recorded. (3) The coverage line could read **"6 of 5"** — planned
  counts DAYS the week asks work of, measured counts DATES logged.
- **LOOP CHECK — a shape worth a name: `an assumption is invisible to the suite
  its author wrote`. SIGHTING 1.** None of the three was a wrong line; each was a
  wrong ASSUMPTION, and the fixtures were built in the geometry where the
  assumption holds (every fixture logged contiguously, which is exactly when
  "calendar weeks" and "logged weeks" agree). **Twenty-four mutations could not
  surface any of them, because a mutation tests existing code against existing
  cells.** What found all three was reading the finished module back asking "what
  does this quietly assume?" AFTER the gate went green. **Proposed compression:
  that read-back becomes a named step of the boundary routine, not a lucky habit.**
- **THE RUNG FIX IS THE NORTH STAR'S OWN MOVE:** the rung is now absent from the
  module entirely, so "it never enters ratio space" stopped being something a cell
  checks and became something the module cannot express. A representation removed,
  not guarded. The signed VALUE stays listed in the table and POINTS AT
  `journalWeek`'s object — identity, not equality.
- **24 MUTATIONS, 24 REDS — TWO SURVIVED THEIR FIRST RUN.** The four-week window
  did not exist (no fixture ever supplied more history than it holds — fixed by a
  new discriminating cell). And "an unlisted string ships" reds on the BINDER, not
  the extraction ceiling: a ceiling is a COUNT and cannot see a swap. **The
  attribution was what was wrong, not the coverage** — both halves are covered and
  neither covers the other.
- **A DEFECT FOUND IN AN EXISTING GATE.** The extraction gate's line-spanning
  canary was pinned to one literal sentence this slice rewrote. It went red
  correctly — but re-pointing it exposed that it only asserted a sentence was
  FOUND, which a single-line ternary would satisfy. It now requires the match to
  come from the `jsx_text` pattern. **Stronger than it was.**
- **NO NEW MAPPING WAS AUTHORED** — patterns from
  `mainPatternForExerciseMovement`, muscles from the two signed sheets,
  upper/lower from `getExerciseTags`. Gated by a source sweep.
- **NOT COVERED, first line: NO DEVICE EVIDENCE**, no cell mounts the screen,
  DEPTH 0. The extractor cannot see keyed copy objects or template literals — the
  three band sentences and two counted lines are invisible to it and are listed in
  batch 17 anyway; **widening it is named as owed**. Charts are layer 5, deferred.
  Resurfacing still owed from slice 2.
- **SAM'S QUESTIONS PARKED, NOT WAITED ON:** (1) should the 2/1/0 rung ever enter
  ratio space — it cannot today without recording a session's SHAPE as a fact;
  (2) the signing batch is **7 PROPOSED of 9 constants**, one of which
  (`minimumWeekCoverage`) is MINE and not in his ruling, flagged rather than
  slipped in; (3) the words of batch 17.

## Processed 2026-08-09 (forty-first pass) — THE NOTE INPUT LANDED; THE COPY GATE'S SCOPE MADE UNDERIVABLE-BY-HAND

- **ONE LINE: the athlete can write about their week and it survives a relaunch —
  `a168b7bb`, full unpiped chain `GATE_EXIT=1` at `program-control-durable`,
  1 FAIL line, sweep 2 of 159 = the declared set exactly.** Copy fix at
  `a49daa80`. Boundary: docs/JOURNAL_SLICE2_BOUNDARY_2026-08-09.md
- LOOP CHECK: **`a green gate watching nothing` — SIGHTING 2**, and it was the
  MECHANISM behind the seat's `proposed-copy-ships-unlisted` sighting 2. Both
  copy gates carried the identical hand-maintained scope list, so a whole screen
  shipped unseen while the extractor sat exactly on its ceiling and printed PASS.
  **COMPRESSED: scope is now DERIVED from the source tree in both gates.**
- **ALL THREE ITEMS PROCESSED.** (1) the load ruling committed as authored and
  honoured in `journalWeek.ts`; (2) the note input built; (3) the copy defect
  fixed and the gate compressed.
- **THE COPY DEFECT WAS MINE AND THE SEAT WAS RIGHT.** Batch 15 recorded, with
  **the H/M/E/G letters called out as terminal-chosen** — Sam ruled the five
  SHAPES, never that a shape shows as one letter. Batch 16 recorded for slice 2
  BEFORE its commit landed.
- **THE BINDER CARRIED THE SAME HOLE, AND RECORDING BATCH 15 EXPOSED IT** — it
  went red for strings plainly in the app, on a screen it was not looking at. **A
  hand-scoped gate does not merely miss things; it reports confident falsehoods
  about what it misses.**
- **THE EXTRACTOR NOW SPANS LINES**, the fix that file named as owed and deferred
  as "a unit of its own". **Ceiling 130 → 561, UP, attributed: +102 scope, +329
  shape** — the instrument improved, the app did not get wordier. Then 561 → 565
  for slice 2's four genuinely new sentences, which is the OTHER kind of rise.
- **A PARSER LYING FOR FIVE BATCHES**, found on the way: the binder's sub-heading
  regex matched only `### 5a.` while every batch from 10 on writes `**15-a.**`.
- **THE NOTE STORE IS ARMOURED AT BIRTH** — one door, both wipe refusals,
  quarantine, guarded storage; joined the hydration gate, BOTH reset paths,
  `DECISION_EVENTS` and the census ownership registry in the same commit. **The
  tape carries counts only** — a note's text is the athlete's words.
- **"NOTES NEVER DERIVE PROGRAM STATE" IS NOW A GATE, NOT A PROMISE:** cell [5]
  sweeps rules/, utils/, services/ and hooks/ and requires that NO engine module
  reads the store at all.
- **SLICE 1'S "NO WRITER" CELL WAS RE-POINTED, NOT DELETED.** It asserts the
  SHAPE now — exactly one door, forbidden list unchanged. A cell quietly deleted
  because its own unit made it red is the other half of that hazard.
- **EIGHTEEN MUTATIONS ACROSS THE TWO COMMITS, EIGHTEEN REDS.**
- **THREE REDS THE FULL CHAIN CAUGHT THAT MY MODEL DID NOT CONTAIN:** LR-4 71→72
  (the screen read the profile MIRROR); `keyboard-convention` (a raw TextInput);
  LR-2 0→1 (a new persisted store is UNOWNED until the registry declares its
  door). **All three fixed at the violation, never at the number.**
- **A PROCESS SLIP OF MINE, OWNED:** `git add -A` swept the seat's load-model
  ruling into `a168b7bb` **before I had read it**. Correct to commit, and it did
  not change slice 2's scope — but committing a document I had not read is the
  shape this repo has a law about. Recorded rather than quietly fixed; the ruling
  is now read and honoured.
- **NOT COVERED, first line: NO DEVICE EVIDENCE** — note box, tag chips, keyboard
  behaviour and the strip are unverified by eye and **no cell mounts the screen**.
  **RESURFACING IS NOT BUILT** (named as owed). Relaunch survival is asserted by
  hydration-gate membership, not an actual restart. The load comparison is still
  unbuilt and the new three-layer model is ruled-not-built. The order's literal
  "resolves to NO sheet entry is a RED" is **reported, not faked** — it would red
  on ~565 pre-existing strings, which is stage 4. All journal copy is PROPOSED.

## Processed 2026-08-09 (the seat's orders, as written)

1. LOAD MODEL RULED (Sam, 2026-08-08 afternoon):
   docs/JOURNAL_LOAD_MODEL_RULING_2026-08-08.md — commit as
   authored. Supersedes-in-part the morning load ruling (2/1/0 →
   fallback rung; day-shape derivation stands). Summary: two native
   streams (strength TONNAGE, conditioning sRPE AU), combined in
   RATIO SPACE only vs each stream's own 4-week normal, one headline
   continuum + Sam-signed sweet-spot band; REGION LAYER distributes
   load over the signed muscle data for observation lines; effort
   tap extends to strength via the "felt different" surface; athlete
   never sees raw AU; observation never diagnosis; constants arrive
   as ONE signing batch at the load slice. Region-stress-influences-
   placement is PARKED, named, engine-unit-later. ADDENDUM same
   conversation, in the ruling doc: layer 4 PATTERN BALANCE (tonnage
   per squat/hinge/push/pull + uppers-vs-lowers, PLAN vs DONE drift,
   observation only, threshold Sam-signed) and layer 5 CHARTS
   (monthly review set + load-over-time + balance picture; no chart
   walls; progressive data states — no dishonest single-dot chart).
   Sequencing unchanged: note input first.
   LOOP CHECK: ruling-recorded-before-build-opens — sighting 1 —
   iterate.

2. SAM RULED next slice: (b) THE NOTE INPUT (2026-08-08). Build
   after item 2's copy fix lands.
   LOOP CHECK: slice-choice-ruled-by-owner — sighting 1 — iterate.
   Scope from the approved design, not re-litigated: the freeform
   note box ("anything worth remembering about this week?") with
   optional tags — the base five (recovery, mobility, injury, diet,
   work stress) plus the addendum's sleep, illness, travel, all
   selected under Sam's full-scope ruling. Record-only, its own
   armoured store per your approved ruling (one door/tape/
   quarantine, store-armour recipe); notes NEVER derive program
   state — no constraint composition, the kickoff's non-negotiable.
   Resurfacing (old notes at relevant moments) is a LATER slice —
   note it as owed, don't build it here. Every visible word into
   the copy sheet PROPOSED under the new gate. Full unpiped chain
   per commit; boundary report; end athlete-visible on the phone.

3. COPY DEFECT + THE PERMANENT GATE (seat review of slice 1,
   2026-08-08): the Journal's athlete-visible words are NOT in the
   copy sheet — the report cited "journal batch 13" but batch 13 is
   the bucket vocabulary and no journal batch exists. Words shipped
   UNLISTED, against the sheet's own transitional rule ("may ship
   PROPOSED, may never ship unlisted").
   LOOP CHECK: proposed-copy-ships-unlisted — SIGHTING 2 today
   (sighting 1: "Today"/"Week" parked in a bullet list no gate
   reads) — COMPRESS, no third sighting.
   (a) Record every journal string as the next real batch number in
   docs/COPY_SHEET_RULINGS_2026-07-30.md, PROPOSED, with the H/M/E/G
   letters called out as terminal-chosen for Sam's eye.
   (b) THE COMPRESSION, systemic per CLAUDE.md: extend the copy
   gate so an athlete-visible string that resolves to NO sheet entry
   (signed or proposed) is a RED, on every surface, mutation-proven
   — shipping unlisted becomes impossible, not noticed-later. If
   that gate can't be built honestly (say, dynamic strings), report
   the boundary instead of a weaker gate that prints PASS.
   One report, full unpiped chain per commit as always.

## Processed 2026-08-09 (fortieth pass) — JOURNAL SLICE 1 BUILT, GATED, LANDED; SAM'S TWO RULINGS BUILT AS RULED

- **ONE LINE: the Journal tab is on his phone — `1659d664`, full unpiped chain
  `GATE_EXIT=1` at `program-control-durable`, 1 FAIL line, sweep 2 of 158 = the
  declared set exactly.** Boundary: docs/JOURNAL_SLICE1_BOUNDARY_2026-08-09.md
- LOOP CHECK: **the source-scan law — SIGHTING 6**, inside a gate I had just
  written, on its first mutation test. **COMPRESSED INTO AGENTS.md, not left in
  a report:** the law's subject is **ANCHORING, not counting**. It slipped
  because both existing sections are written about COUNTS — I applied them
  correctly to the cell counting `<Tab.Screen` in the same file and did not
  recognise an ORDER assertion as the same shape.
- **ALL THREE ITEMS PROCESSED.** (1) and (2) committed as authored at
  `65bff3b3`, with a note for the record that item 2's summary line still reads
  "weights PROPOSED 2/1/0.5" — item 1 supersedes it and the ruling DOC already
  carries SIGNED 2/1/0. The doc is the authority; the stale summary was left as
  the seat wrote it rather than edited under it. (3) built.
- **WHAT IS ON SCREEN:** a third tab between Program and Profile — this week's
  **shape strip**, **did the work happen** (with "no reason recorded" where the
  app does not know why), **how the week felt**, and the **honest building
  state** for load.
- **ZERO NEW STORED STATE, AND IT OPENS NO DOOR** — a cell scans the screen for
  five writer idioms and requires zero. **North star: TOWARD, and a convergence
  step** — it surfaces facts stored for months without minting a copy of any.
- **ONE PREDICATE READ TWICE**, which is Sam's "two questions, one store" made
  structural rather than promised. Shape short-circuits on Rest/Game, load does
  not — so **a game takes the HARD weight through the existing owner**
  (`stressClassification` returns `'high'` for a game) and **no game constant
  exists**. His ruling never priced a game and this is why it did not need to.
  Written the obvious way (`loadWeight > 0`), the session count would have
  silently dropped every easy day — the one place he said they must appear — so
  a cell asserts the two answers **DISAGREE** on that day.
- **HARDNESS IS READ FROM ITS OWNER, NEVER RE-DERIVED.** The cell moves ONLY the
  classifier's answer over an identical projection and requires the result to
  follow; a re-deriving Journal would answer the same both times and no
  whole-week fixture would notice.
- **TWELVE MUTATIONS, TWELVE REDS — AND ONE SURVIVED FIRST.** The tab-order cell
  compared three `indexOf` results directly; `indexOf` returns **−1** when the
  anchor is MISSING and −1 is less than everything, so renaming `ProgramTab`
  satisfied "Program comes before Journal" **vacuously**. Now proven present
  before any order is claimed; a rename and a genuine reorder both red it.
- **A RED THAT WAS MINE, CAUGHT BY AN EXISTING GATE.** The first full chain
  stopped EARLIER than the declared set, at `test:legacy-census`: LR-4's
  `mirrorDecisionReads` went **71 → 72** because the screen read `onboardingData`
  off the profile MIRROR. Its own text says an undeclared hit is a new violation,
  not a miscount — **so the violation was fixed, not the number.** It reads
  through `useAthleteContext` now, the owner the census names as LR-4's
  destination, and the declared count is untouched. **Nothing in my model of
  "what a read-only UI slice touches" contained the legacy census** — that is the
  argument for the full chain over the suites I thought were related.
- **PARKED, NOT BUILT, AND SAID PLAINLY:** the load COMPARISON (slice 1 ships the
  honest state only — the rolling average must derive from RECORDED history, not
  from projections of past weeks that no longer exist); the exposure counts, week
  status line, this-week's-job and observation lines; the note input, post-game
  rating and "felt different" tap, each a new input and its own slice.
- **NOT COVERED, first line: NO DEVICE EVIDENCE.** Strip legibility, dot sizing,
  the tab icon and how a five-mark row scans are unverified by eye; **no cell
  mounts the screen**, so the honest states are asserted by testID presence in
  source. `weeksOfHistory` counts weeks with ANY record, so a week with one
  logged rest day counts. Multi-workout days read through `ResolvedDay.workout`
  (singular) — consistent with the app, not proven correct. Depth (L13): 0.
- **COPY IS PROPOSED AND UNSIGNED** — journal batch 13. The H/M/E/G letters are
  the terminal's presentation choice, not a Sam ruling. **Sam holds a veto on
  everything, and on the two rulings the seat approved pending him.**

## Processed 2026-08-08 (the seat's orders, as written)

1. WEIGHTS SIGNED (Sam, 2026-08-08, same-day completion of the
   load ruling): Hard 2 / Moderate 1 / Easy 0 — verbatim: "do
   2 - 1 - 0 though, easy days don't effect fatigue but count as
   sessions." The ruling doc is updated in place (its PROPOSED
   block → SIGNED, docs/JOURNAL_LOAD_AND_DAY_SHAPE_RULING
   _2026-08-08.md) — commit as authored. Easy days: weight 0 in
   LOAD, still counted in COMPLETION — two questions, one store.
   LOOP CHECK: signing-batch-closed-same-day — sighting 1 — iterate.

2. SAM RULED the journal's two coaching questions (2026-08-08):
   docs/JOURNAL_LOAD_AND_DAY_SHAPE_RULING_2026-08-08.md — commit as
   authored. LOOP CHECK: coaching-question-batched-and-ruled —
   sighting 1 — iterate.
   Summary: load = hard-weighted session count vs 4-week rolling
   average (weights PROPOSED 2/1/0.5, Sam signs before any number
   reaches an athlete — build the mechanism, constants land signed);
   week-shape strip TRACKS Moderate by DERIVATION, no new stored
   state (hard flag → Hard; other training → Moderate; recovery/
   mobility → Easy; Rest/Game themselves — Bible: "Moderate = normal
   training"). Unblocks the "load vs your normal" card item and the
   strip. Fold into the running slices; no separate report needed
   beyond the boundary that ships them.

3. SEAT ANSWER to the journal opening report (2026-08-08): BUILD
   SLICE 1 NOW — do not hold. Neither open question blocks it.
   LOOP CHECK: a-doc-taken-for-the-record — SIGHTING 2 (the kickoff
   inherited the base doc's stale settle-first list; the receipts
   law from the doc-truth fix is the standing compression and you
   applied it at the source) — compressed, no new rule needed.
   (a) Your two rulings are SEAT-APPROVED under existing law, Sam's
   veto pending: new inputs ride SessionFeedback through the
   existing door (L15 one-write-format + the teamNightSize
   precedent); LR-18 resolves as DELETE workoutLogStore (nothing
   writes it, Sam's own logging model rules per-set entry out).
   Cite this item; a Sam veto arrives via the inbox if he objects.
   (b) The two coaching questions are PARKED to Sam in the seat's
   batch (load definition; week-strip Moderate). Park-and-build:
   slice 1 needs neither. The load answer will arrive as a later
   inbox item; the "load vs your normal" card line ships LAST or
   not-yet, never with an unauthored number (provenance law).
   (c) Slice 1 as you scoped it: Journal tab + this week, read-only,
   zero new stored state, no new doors. Full unpiped chain per
   commit; sweep must hit the declared 2 exactly; boundary report
   with the convergence answer. VISIBLE-FIRST: end on Sam's phone.

## Processed 2026-08-08 (thirty-ninth pass) — THE DEAD ZONE WAS INVISIBLE NODES IN THE LAYOUT; FIXED, GATED, LANDED

- **ONE LINE, AS ASKED: the dead zone is gone — `d07e3fad`, full unpiped chain
  `TRUE_EXIT=1` at `program-control-durable`, 1 FAIL line, sweep 2 of 157 = the
  declared set exactly.**
- LOOP CHECK: the seat's `invisible-instrumentation-participates-in-layout`
  sighting 1 stands, and its diagnosis was CONFIRMED IN SOURCE before anything
  was touched rather than taken on the order's word.
- **THE CAUSE, exactly as the seat called it.** `DayStateLeaves` returns a
  FRAGMENT, so its witnesses flatten into DIRECT children of `styles.dayFirst`,
  which carries `gap: spacing.sm`. A dozen-plus invisible children, each earning
  a gap. **It GREW as receipts accrued** — which is why it read as a spacing bug
  that spacing changes could not fix.
- **ONE REFINEMENT ON THE PRESCRIBED FIX, and it is the load-bearing half.** The
  order said zero-size + clipped + pointerEvents none. Zero-size is NOT
  sufficient: a 0x0 STATIC wrapper still occupies a flex slot and still earns
  ONE gap — a dozen down to one, not to zero, and Sam's report is that the gap
  should not be there at all. **`position: 'absolute'` is what makes it truly
  layout-inert** (an absolutely-positioned child is out of the flex flow, so
  `gap` never applies at any count). The clip and the zero size are kept as
  belt-and-braces for the children.
- **SCOPE CHECKED, NOT ASSUMED — "in BOTH shapes" needed measuring.** `dayList`
  (the week shape) also carries a gap, but there the leaves mount INSIDE each
  row and `dayRow` has no gap, so that shape never had the defect. **One
  container was affected; one container changed.**
- **THE GATE WAS NOT TRADED AWAY — the order's own stop condition.** The leaves
  cell is a SOURCE SCAN, so a PASS through a region I had just rewritten proves
  nothing by itself (`a-count-taken-for-a-record`, source-scan form).
  **Mutation-proven instead: emptying the loop INSIDE the new wrapper still reds
  it.** Nothing about the witnesses changed — same components, same testIDs,
  same count, same order.
- **SPEED PATH FOLLOWED AS WRITTEN:** fix → day-first suite 22/22 + non-official
  `test:bible:parallel` **2 of 159 = the declared set exactly** + `test:compile`
  PASSED → **REBUILD IS GO given to Sam off the working tree** → THEN the full
  official unpiped chain, and the commit was made only on its printed exit lines.
- **NOT COVERED: no device evidence.** The dead zone is argued from the layout
  rule, not seen closed on a phone — **Sam's rebuild is the instrument.** And the
  wrapper CLIPS: every harness gate traverses the React tree so clipping is
  invisible to them, but if the on-device explorer ever resolves by screen
  GEOMETRY rather than by tree, a 0x0 clipped ancestor could hide a testID from
  it. Unprovable from here, so it is flagged rather than ridden silently —
  dropping `overflow: hidden` is the one-line answer if a device explorer run
  ever fails to find day leaves.

## Processed 2026-08-08 (seat, break declared) — ITEM 3 WITHDRAWN FROM THE QUEUE

- The journal-kickoff item was pulled by the seat AFTER the thirty-eighth pass
  report: Sam ruled a HARD BREAK here (he is building to Renee's phone and
  stepping out). The terminal's docs commit had overwritten the seat's hard-stop
  rewrite of item 3 with an earlier copy — a numbered kickoff item left in the
  queue would have had the stop-hook push the terminal INTO the journal,
  against Sam's ruling. So: queue emptied, journal starts ONLY by Sam's /clear
  + orient paste. The kickoff doc is committed (bed172dd, verbatim) and its
  order stands in full — FULL SCOPE, base + all 11 addendum candidates, Opus.
  LOOP CHECK: two-writers-one-file — sighting 1 for SEAT_INBOX (the seat and
  the terminal both hold copies; the terminal's commit clobbered the seat's
  interleaved edit) — iterate this once; if it happens again the fix is
  structural (append-only orders file or seat-writes-terminal-reads split).

## Processed 2026-08-08 (thirty-eighth pass) — THE COMPOUND NAME BUILT AND LANDED; AN ICON REGRESSION CAUGHT BEFORE IT SHIPPED; THE DOC-TRUTH FIX DONE

- LOOP CHECK: **`a-ruling-premise-is-a-claim-too` — and the premise was MINE, one
  commit old.** Slice 2's report read the row-icon table and concluded nothing
  regressed *because "Strength" resolved in it where "Power" did not*. True then;
  false the moment a title stopped being one word. It was caught only because the
  NOT-COVERED line naming it was cheap enough to CHECK instead of FILE.
  Secondary: **`a-count-taken-for-a-record` in its ASSERTION form** (the sweep
  red below), which belongs in AGENTS.md beside the source-scan variant.
- **THE COMPOUND NAME IS ON HIS PHONE** (`791979c0`). A day is named by **every
  bucket on it**, joined by his own " + ", timeline order, **each word once**.
  One function, both surfaces; no surface composes anything.
  docs/COMPOUND_BUCKET_BOUNDARY_2026-08-08.md
- **(a) BATCH 12 SIGNED** in the same commit, all seven as proposed.
  **(b) Q1 CLOSED** — chips do not light, left as built.
- **THE TAPE, BOTH WORLDS, THREE GENERATED WEEKS: 6 rows changed, ALL titles.
  TIMELINE BYTE-IDENTICAL. Parts byte-identical.** Rest / Practice Match /
  Gunshow / Accessories unchanged. **The exhibit Tuesday produced NO diff line** —
  power + strength both bucket to "Strength" and it still reads "Strength", the
  dedupe proving itself on the day the power ruling came from.
- **FOR HIS EYE, AND IT IS THE RISK: four of the six changed rows gained
  "+ Team Training"**, not the "+ Conditioning" of his example. His exhibit week
  reads "Strength + Team Training" on three of five training days — a longer row
  than anything he has seen. **Built as ordered, flagged not narrowed.**
- **JOINING IS NOW A SHEET OPERATION**, and that is the part that generalises. A
  compound is a COMPOSITION, the exact defect `SignedCopy` exists to forbid. Both
  ways out were wrong: widening the placeholder regex reopens the one hole in the
  type, and a `.join(' + ')` at a call site is a surface authoring punctuation —
  **and one already was**, `DayWorkoutScreenV2`, undetected since Task 6. So the
  separator is a sheet entry marked `joiner: true`, `joinSignedCopy` refuses any
  entry that is not one, and **a compound with one unsigned half still reads
  UNSIGNED**. Both directions are cells.
- **`attached` RETIRED, and it closed parked question 4 as a CONSEQUENCE.** Its
  own definition was "the parts the lead did not speak for"; a compound title
  speaks for all of them. Keeping it would have shipped the duplication Sam ruled
  against that morning, one screen over and worse.
- **AN ICON REGRESSION THIS UNIT CAUSED, FOUND AND FIXED** (`b799949d`). The row
  glyph AND accent colour match the day's name against a table of label
  EQUALITIES; "strength + team training" matches nothing, so **four of the six
  changed rows would have dropped to the generic grey glyph.** The glyph now keys
  on the LEADING bucket — byte-for-byte the pre-ruling title rule, so no glyph
  moved on any day, asserted not assumed. **The real fix (key off the typed
  `VisiblePartKind`) is NAMED AND NOT DONE** — it would move glyphs on days this
  ruling never touched.
- **NINE MUTATIONS, NINE REDS. FIVE NEW CELLS**, and the two vocabulary cells
  were **re-pointed, not loosened** — they check EVERY WORD in the list now, so
  "Strength + Upper Push" reds where a whole-string test had no opinion.
- **A SWEEP RED THAT WAS NOT MINE, ATTRIBUTED NOT SHRUGGED** (`214ef66c`). First
  sweep came back **3 of 157** against a declared 2.
  `test:decision-ledger-ownership` hardcodes '2026-08-08' as an answer value and
  asserts it never appears in the serialised tape — and every entry carries a
  required `at` UTC timestamp. **Today is 2026-08-08.** Moving only that cell's
  two dates off today takes it to 8/8 with no product change; that is the whole
  diagnosis. **It reds on exactly two days in history and is green on the other
  363** — the worst possible schedule, because it presents as a regression in
  whatever unit is in flight. Slice 2's sweep "cleared" it four hours earlier only
  because UTC had not ticked past 10:00 AEST. `at` now excluded BY NAME only;
  mutation-proven a real leak still reds. **The three sibling tape suites were
  AUDITED, not assumed: green, and none uses a date literal.**
- **(item 2) THE DOC-TRUTH FIX IS DONE.** The unit plan's §3 table said "later
  slice" against nine of thirteen rulings; **all 13 are BUILT, DELIVERED or
  MOOT**, re-measured in the source, **one line + one receipt each**, nothing
  OPEN-UNKNOWN. NOW.md's "Rulings 1-12 remain owed" struck with the reason it
  survived. **The compression is written into both files as standing law.**
- **NORTH STAR: TOWARD, a convergence step.** Zero new stored state; TWO
  representations removed (the day screen's second answer to "what is this day",
  and the last surface-side composition of athlete-visible text).
- **GATE, final tree:** full `test:bible` UNPIPED **`TRUE_EXIT=1` at
  `test:program-control-durable`, 1 FAIL line**, same assertion text. Sweep
  **2 of 157 = the declared set EXACTLY**. `test:compile` PASSED, no file
  regressed.
- **NOT COVERED, first line of it: NO DEVICE EVIDENCE.** How a
  "Strength + Team Training" row WRAPS or truncates at week zoom is unverified by
  eye, and given four of six changed rows took that shape it is the first thing to
  look at. The icon fix is proven on the projection and the source wiring, **not
  on a rendered pixel** — no cell in this repo mounts a row. Three weeks of ONE
  athlete's program, and week 3 is all rest, so the real evidence is two weeks;
  **no world here makes a three-bucket day, so the join is exercised at arity 2
  only.** `coachNoteDisplayTests` still does not run (pre-existing crash). The
  separator is deliberately NOT bound by a copy-sheet table row (two characters of
  punctuation would bind vacuously) — it is bound by the compound cells, and the
  doc says so at the entry. **The day-title half is SEAT-RULED, not Sam-ruled**;
  his veto is one line.
- **STOPPED at the boundary.** Item 3 (the journal unit) is unprocessed and wants
  a `/clear` + re-orient paste, as the seat wrote.

## Processed 2026-08-08 (thirty-seventh pass) — SLICE 2 AND THE BUCKET VOCABULARY BOTH BUILT AND LANDED

- LOOP CHECK: **`a count taken for a record` — SIGHTING 5**, and it fired in a
  gate I had just written, on its FIRST run: the leftover-bar cell counted a door
  FILE-wide, found two, and called the second a leftover. It is the readiness
  sheet's own "Something hurts" row — the documented SECOND DOOR to one owner,
  older than this unit. **The number named the FILE while the claim was about the
  SCREEN.** Secondary and worse: **a green gate that was watching nothing** — the
  copy-binding gate reads quoted strings in TABLE ROWS, my batch-12 table quoted
  the OLD sentences, so it bound five strings nobody needed watching and zero of
  the five new labels while printing PASS. The same defect had already swallowed
  slice 1's "Today"/"Week", parked in a bullet list no gate reads.
- **BOTH ORDERS ARE ON HIS PHONE.** `e8d227ac` (layout + chip row + spacing) and
  `c140a2d0` (bucket vocabulary). docs/DAY_FIRST_SLICE2_BOUNDARY_2026-08-08.md
- **THE ORDER IS HIS, WRITTEN OUT:** toggle → seven-day strip DIRECTLY under it →
  today's card → the chip row → Coach Notes. The missed-session prompt and the
  phase-skew disclosure moved down with the notes. **The picker banners stayed
  above the days they instruct about** — a picker forces the week shape, and
  "tap the day to move the game to" under the days would be wrong.
- **FIVE BARS ARE ONE ROW OF CHIPS, AND NOT ONE DOOR MOVED.** Same handler, same
  testID, same accessibility label on all five — including the two whose testID
  changes when a fact is already active. The sentence each bar showed is now the
  chip's SPOKEN name: no words deleted, demoted to where a five-across row can
  carry them. **Labels PROPOSED and unsigned:** Time / Away / Sick / Injured /
  Equipment (batch 12, with "Today"/"Week"). "Equipment" beat "Kit" and "Gear" —
  a shortened label should not also be a new noun.
- **THE DAY SAYS ITS NAME ONCE.** Title = the day's BUCKET; the timeline is the
  one enumeration; nothing on this screen composes a name out of other names any
  more. **"Power" is gone from the week view** — the exhibit day reads "Strength"
  — and the word is NOT retired: it still names that component on the timeline.
- **MEASURED IN BOTH WORLDS BEFORE A WORD CHANGED.** A tape over three real
  generated weeks, diffed: every training day's row and title → its bucket;
  Power → Strength; Rest / Practice Match / Game / Team Training unchanged; **the
  TIMELINE BYTE-IDENTICAL**. And **Gunshow kept "Gunshow" ON ITS OWN**, through
  the charter-door branch rather than a special case — that day carries a typed
  `composedOptionalKind`. Measured, not assumed.
- **THE PROJECTION OWNS THE WORD, as the order required.** `VisiblePart` carries
  `bucket` beside `headline`; `PART_BUCKET_KIND` is a table the type system forces
  to be complete, not an `if`. It sits on the WORDS half, so a missing copy entry
  still cannot disarm the structural laws.
- **EIGHT NEW CELLS, TWELVE MUTATIONS, TWELVE REDS.** The order cell also refuses
  anything re-inserted BETWEEN the toggle and the strip — "directly under it" is
  the half of the ruling an ordering assertion cannot see.
- **A MUTATION SURVIVED, and it is the one worth reading.** Deleting the
  charter-optional branch from `partBucket` left every cell green: a Gunshow day
  quietly reading "Strength" is a LEGAL bucket word, so the vocabulary cell was
  blind to it. A cell of its own now holds it.
- **THREE PINS MOVED, ALL OUT LOUD, all the legitimate case (the RULING moved, on
  a date, from the owner):** A4 rider (a) "notes above the week" → below the card,
  still asserting a POSITION not mere presence; `coachNoteDisplayTests`' helper
  pin → the structural form (duplication is now impossible, not suppressed); and
  the readiness entry's button ROLE, asserted at its new owner (the chip) with the
  identity still asserted at the call site.
- **THE COPY CEILING DROPPED IN THE SAME COMMIT: 141 → 130**, honestly labelled —
  five sentences left the EXTRACTOR'S VIEW, not the app.
- **NORTH STAR: TOWARD, and a convergence step this time**, not merely a new
  window: zero new stored state, and one COMPOSITION removed — the screen went
  from two answers about what a day is called to one.
- **SEVEN QUESTIONS PARKED** (docs/PARKED_QUESTIONS/DAY_FIRST_SLICE2_2026-08-08.md):
  whether an active fact should light its chip (**not built on purpose** — only 2
  of 5 chips know, and lighting 2 of 5 is worse than none); **a zoomed-out week row
  now shows ONE word** and that is a real loss at that size; power still gets its
  own timeline row for one exercise; **the day SCREEN has the same double-labelling
  one screen over** ("Team Training" twice), outside the order; the five labels for
  signing; the Gunshow-without-a-typed-door gap; and where the readiness owner's
  title went.
- **NOT COVERED, first line of it: NO DEVICE EVIDENCE** — chip sizing, label
  lengths, every tightened gap and how a one-word row scans are unverified by eye;
  this repo has no render-level test. The row icon still comes from a title-STRING
  table ("Strength" resolves, "Power" did not, so nothing regressed) — argued from
  the table, not rendered. `coachNoteDisplayTests` does not run at all: it crashes
  at HEAD on a missing TodayWorkoutCard.tsx, pre-existing and not in the chain; its
  pin was updated anyway rather than left as a trap.
- **GATE:** full `test:bible` UNPIPED both commits — `TRUE_EXIT=1` at
  `test:program-control-durable`, the declared red, same text, **1 FAIL line**.
  Sweep **2 of 157 = the declared set exactly**. `test:compile` EXIT 0.

## Processed 2026-08-08 (thirty-seventh pass) — the two orders as the seat wrote them

0. SAM RULED (with screenshots on file): DAY-FIRST SLICE 2 — layout
   + chip row. Commit as authored, build under standing conditions.
   LOOP CHECK: design iteration from the owner's eye — the intended
   loop; iterate.
   (a) LAYOUT REORDER, Sam's exact words: Today/Week toggle → the
   seven-day strip with numbers DIRECTLY under it → today's card →
   then below the card: the icon chip row → then Coach Notes (moved
   BELOW the card; they currently sit above the strip).
   (b) THE ICON CHIP ROW (Sam picked option a — his own Aug 1
   design): the five stacked life-fact bars (Short on time / Away
   this week / Sick-flat / Injured / Missing equipment) become ONE
   horizontal row of small round icon chips with a tiny label under
   each, always visible, sitting just under the daily card. Existing
   icons from the landed icon batch; any shortened labels are NEW
   strings → PROPOSED, Title Case short-label law, queued for the
   signing batch (join "Today"/"Week" already parked). Same doors
   behind the chips — presentation only, no behaviour moves.
   (c) SPACING PASS: tighten the vertical gaps Sam flagged
   ("too many UI gaps") across the Program screen — reasonable
   judgment, no design system invented; his eye judges next build.
   Full test:bible UNPIPED per commit; walker surface laws; one
   batched report; park Sam questions. Sam holds a veto on sight.

   [RESTORED BY THE TERMINAL. This order was never committed — it
   lived only as a working-tree edit, and the seat's next write
   replaced it in place before it reached a commit. Copied back
   verbatim from the terminal's read of it at 2026-08-08, because a
   processed section that records one of two orders is a record of
   half the work. Numbered 0 to keep the seat's own numbering of the
   order that followed it intact.]


1. SAM RULED (screenshots on file, 2026-08-08 morning): BUCKET
   VOCABULARY + kill the double-labelling. Joins slice 2's order;
   commit as authored.
   (a) THE DUPLICATION DIES: the day card currently says the session
   twice (title "Upper Push + Conditioning", then the timeline lists
   the same again). The TIMELINE becomes the single enumeration of
   the day's parts; the card title stops restating it (the "+ X"
   subtitle line goes).
   (b) BUCKET WORDS ONLY on the week view rows AND the day title:
   "Strength", "Conditioning", "Rest", "Mobility", "Accessories",
   "Gunshow" — and "Speed" is a bucket too. The variant (Upper
   Push, Full Body, Lower Squat...) lives on the TIMELINE rows —
   Sam confirmed the current daily layout is right: "upper push on
   one line with conditioning below it is good." So: week row =
   buckets, day title = buckets, timeline = the variant names
   stacked one per line, exactly as now. Bucket words are signed
   menu vocabulary; anything new ships PROPOSED.
   (c) POWER IS NOT A LABEL, Sam verbatim: "power should not be
   labelled there for just 1 exercise — power is just part of the
   Strength work." A day whose strength work contains power
   exercises is titled "Strength"; "Power" never appears as a week
   row, day title, or bucket. (Exhibit 1's Monday "Power" title is
   exactly what dies.)
   This is athlete-visible naming — L-P/one-name-per-session laws
   apply; projection owns the words, no surface composes its own.
   Build with slice 2, one report, Sam's eye judges the next build.



## Processed 2026-08-08 (thirty-sixth pass) — DAY-FIRST SLICE 1 BUILT AND LANDED; COMPLETION SHOWN, NOT WRITTEN

- LOOP CHECK: **`a count taken for a record` — SIGHTING 4 — COMPRESSED**, and it
  fired inside a gate I wrote, on that gate's FIRST mutation test. The state-leaf
  cell counted `<DayStateLeaves` occurrences and PASSED against a mutation that
  emptied the loop feeding them: the count was right and the days were gone. It
  also matched on a prefix. AGENTS.md now carries the source-scan half of the law
  (word-boundary the count, then read the region that runs it, then prove the
  region was found) rather than leaving it as a note in a report. Secondary:
  **`a-ruling-premise-is-a-claim-too`** — the unit plan's own §2f hazard is
  refuted below.
- **FORK A COMMITTED AS AUTHORED** (`46b77be0`), then the build continued under
  the standing authorisation, as ordered.
- **SLICE 1 IS ON HIS PHONE.** The Program tab **leads with today**: a seven-day
  strip with the **game-day anchor**, the selected day at full size with every
  door it already had, and the day's session as a **tappable component timeline**
  between the day's name and its CTA. **No clock times.** A **Today / Week**
  control zooms out to the existing seven-row list.
  docs/DAY_FIRST_SLICE1_BOUNDARY_2026-08-08.md
- **COMPLETION IS SHOWN, NOT WRITTEN — GATED, NOT MERELY INTENDED.** Frozen
  inputs plus a source assertion that the timeline module reaches no writer.
  A filled node = the athlete's SAVED outcome recorded that component; a hollow
  ring = not answered yet, which is deliberately NOT the same as skipped.
- **TWO SHAPES OF ONE SCREEN, NOT TWO SCREENS — and this is the one real design
  call I made.** The unit plan named a third `DESIGN_VERSION` value as the
  switch. I did not take it: a rival day-first screen is **two live truths about
  one week**, the shape the L14–L16 note already refused once. Both shapes render
  the same `visibleWeek` through the same `DayRow` from **ONE row call site**, so
  no door, no badge, no receipt and no testID moved. The week list is one tap
  away and is the FORCED shape on another week (no today) and in a game picker
  (a week-level act).
- **THE TIMELINE IS THE PROJECTION'S PARTS.** Built on `projectDayDetail`, so the
  day-first view and the day-detail screen are one list asked twice and the
  walker's existing L-P3 cell covers both. What it adds is the one thing the
  projection must not carry — the RESULT, which arrives BESIDE `VisibleDay`.
- **THE UNIT PLAN'S OWN HAZARD IS REFUTED.** §2f named *conditioning + finisher*
  as the live `kind` collision. **Measured at the emitter, that day cannot
  exist** — `getSessionComponents` emits one or the other from a single `if`.
  The reachable pair is **`recovery` + `recovery_addon`**, and the suite now
  builds it. "Key on `id`" was right for a wrong reason and is now right for a
  measured one. Corrected in place, in the section that was wrong.
  **A consequence NAMED not patched:** those two parts render identically,
  because headline and rows both key on kind. Sam's call.
- **A CORRECTION OF MINE THE FULL CHAIN CAUGHT.** The new suite reached the
  profile store around its owner; `profileMirrorNarrowing`'s one-door census
  failed it. Its ~50 declared entries are DEBT, not permission, so the suite was
  routed through `applyProfileOnboardingWrite` rather than joining a ratchet that
  has only moved down this era. **Nothing in my model of "what a UI slice
  touches" contained the profile census — that is the argument for the whole
  chain over the suites I thought were related.**
- **ONE OWNER PER IDENTITY, which is L12's answer for this unit's class** (*a
  surface that re-derives an identity the projection already carries*): the part
  id both ways (`partIdFor`/`componentIdFromPartId`), what a saved outcome says
  about a component (`completionByComponentId` — panel and timeline, one rule,
  legacy lift included), a day's explorer state (`dayStateToken` +
  `DayStateLeaves`, so the six strip days still report themselves), and the
  date's display (`dayOfMonthLabel`).
- **SEVEN MUTATIONS, SEVEN REDS**, each against the cell that claims the property.
- **FIVE QUESTIONS PARKED** (docs/PARKED_QUESTIONS/DAY_FIRST_SLICE1_2026-08-08.md):
  the app-kill edge (recommend leaving it — fork B/C is its own unit);
  `Today`/`Week` PROPOSED and unsigned; icons terminal-proposed, **power and
  speed share the bolt**; whether the Today/Week choice should be remembered
  (persisting it would be new stored state, so it is not); the two identical
  `recovery` rows.
- **NORTH STAR: TOWARD, and modestly.** Zero new stored state — the whole ruling
  is that it stores nothing. But it is a new WINDOW, so it converges nothing that
  was divergent; neutral-to-positive, not a convergence step, and the report says
  so rather than dressing it up.
- **NOT COVERED, first line of it: NO DEVICE EVIDENCE** — the layout, spacing and
  colour of the strip and timeline are unverified by eye. This repo has **no
  render-level test**, so no cell asserts the day-first branch mounts; the three
  source-scan assertions read the block's SHAPE and that limit is stated at the
  cell, not buried. The `recovery` + `recovery_addon` day is a pure-function
  probe, not a state reached by acting. **The week strip has no walker action**,
  so selecting a day from it is untested — by the walker's own header that is a
  harness defect, filed not fixed. The five week modes stage 1 never reached are
  not reached here either. **Rulings 1–12 remain owed.** The full chain was run on
  the FINAL tree, not once per commit.

## Processed 2026-08-08 (thirty-sixth pass) — the ruling as the seat wrote it

1. RULED: FORK A — completion shown, not written. Commit as
   authored, then CONTINUE the overnight slice-1 build under the
   standing authorisation.
   LOOP CHECK: scope-creep-into-a-UI-unit — the fork's B and C both
   grow engine machinery inside a unit Sam scoped as a new window;
   A is the recorded intent applied.
   Grounds: the direction doc's own review note — "per-component
   check-off maps onto SessionFeedback's existing per-component
   completion. No new stored state implied." Slice 1 shows ticks
   live in the view and writes them ONCE through the existing
   session-outcome door at the existing moment. No new door, no new
   stored state, no signed behaviour touched. The known edge (app
   killed mid-session loses the on-screen ticks, never data) is
   recorded in the unit doc and PARKED as a one-line question for
   Sam's morning: if he wants mid-session ticks to survive a kill,
   that upgrade is fork B/C as its OWN later unit — not this one.
   Hook fix (6/6, mutation-proven, both false-block classes now
   standing cases) is ACCEPTED with thanks — and the seat notes for
   the record that BOTH misfires were caused by seat-authored inbox
   formatting; the empty-marker convention (unnumbered "(none)") is
   now the seat's law too.
   Build on. One batched report by morning. Sam holds a veto on
   fork A when he wakes.

## Processed 2026-08-07 (thirty-fifth pass) — MERGED TO MAIN; BOTH DEPENDENCY LISTS DELIVERED; SLICE 1 STOPPED ON ITS CHECK-OFF HALF

- LOOP CHECK: **pin-the-"already-covered"-claim** FIRES, and against my own
  plan document. I confirmed `componentCompletions` EXISTS as a field and
  inferred a door to write it. **Existence of the state is not existence of the
  door.** One grep at the write path refuted it — after I had already written
  "STOP CONDITIONS: CLEAN" into a committed doc. Corrected in place, in the
  section that was wrong, rather than quietly revised.
- **THE MERGE IS DONE — `feat/stage-b-stage2` → `main`, `89b540f9`, `--no-ff`.**
  Sam's L10 stages-1+2 device pass PASSED and it was the only gate.
  **BEFORE on main: `TRUE_EXIT=0`**, green to its last suite, 0 FAIL lines.
  **AFTER: `TRUE_EXIT=1`** at `program-control-durable`, 1 FAIL line, same
  assertion text. **Sweep at `89b540f9`: 2 of 156 = `program-control-durable` +
  `fixture-identity` — the declared set EXACTLY. No difference, no STOP.**
  **Said plainly: a green main went to a 2-red main, knowingly.**
- **(a) THE TAP LIST RECORDS THE PASS** — 1 flush correct, 2 conditioning names
  correct, 3 rest clean, 4 N/A, 5 = quality exhibits filed. **L10 MET.**
- **THE BRANCH LEDGER WAS TAKEN FROM git AND THE CHECK PAID FOR ITSELF:** my
  first draft named **five** scratch branches and there are **twelve**, with one
  sha already stale; it named one stash where there are **four**. Ancestry
  confirmed by `merge-base`. Phase 1 CLOSES **except four items named openly**
  rather than closed by rounding (1b, injury substitution, R6, the replay unit).
- **(a-new) THE LR-29 DEPENDENCY LIST IS DELIVERED**, measured with a recording
  Proxy in the declaration door and **priced against the control set BEFORE any
  reading was believed — 2 of 156 both arms, so the Proxy does not perturb.**
  docs/REPLAY_UNIT_DEPENDENCY_LIST_2026-08-07.md
  - **3 of 10 readers read ZERO fields** — 50,078 door calls answered by an
    existence predicate.
  - **The `current_microcycle` rung answered ZERO times** in 156 suites. Three
    rungs collapse to two, free.
  - **THE LEDGER CANNOT EXPRESS THE CLASS SENTENCE.** Six kinds, three
    production writers, and **no vocabulary for illness/injury/readiness/phase**
    — the type file's own comment says R3 would add them and R3 never did. So
    "replay the ledger onto the base" is **not a sufficient description of the
    unit**: its input set is ledger PLUS fact stores. **Largest open decision.**
  - **THE BOOT ALREADY REPLAYS** (`quiescentBoot.rebuildDerivedWorld`) and
    already wipes the stored-declaration surfaces. The unit is not starting from
    nothing; its real first question is whether that replay already reconstructs
    `authorisedReductions`. **NOT MEASURED — item 1 of the list.**
  - **PAYER CLAIM RE-CONFIRMED, NOT QUOTED:** under `LFA_FLIP_DOOR=1` on
    today's main, **`fixture-identity` goes GREEN.**
  - **A CARRIED CLAIM CORRECTED:** `validateLiveWeekOverlayWrite` was recorded
    as firing **0×** in three passes. It fires **12 times**.
  - **THE INSTRUMENT'S OWN LIMIT STATED BEFORE IT IS USED:** a uniform read
    count across every field is a CLONE, not consumption, so for two readers the
    tape measures copying and cannot answer the question.
- **(b) THE DAY-FIRST UNIT PLAN IS DELIVERED.**
  docs/DAY_FIRST_UI_UNIT_PLAN_2026-08-07.md
  - **The direction doc names the wrong half:** the timeline must consume
    `project()`'s `VisibleDay.parts`, **not `ProjectedDayParts`**, which
    deliberately carries no words. A timeline on `projectParts` renders nameless.
  - **Group by `id`, never by `kind`** — `COMPONENT_TO_PART` is many-to-one, so
    a day with a conditioning AND a finisher yields two parts of one kind.
  - **A hazard I drafted was REFUTED before it shipped:** the colon-containing
    id is a WORKOUT id and never becomes a component id. Recorded rather than
    deleted — the plan would otherwise have ordered a defensive parse against a
    defect that cannot occur.
  - **Ruling 13 is MOOT** (R5.7 already cut the coach chips); **ruling 11** (the
    injury "Other" data path) is named as its own investigation deliverable.
  - The rulings doc is in `docs/`, not `artifacts/` as the order cited.
- **(c) SLICE 1: THREE QUARTERS AUTHORISED, ONE QUARTER STOPPED.** The render
  half is clean. **The check-off half is a GENUINE STANDING CONDITION and did
  not proceed** — the order's premise *"via the existing per-component
  completion"* is refuted: `componentCompletions` has exactly one writer,
  `commitSessionOutcomeTransaction`, which mints a **session-outcome receipt**
  that drives the Done badge, the completed-day display and progression, and
  **there is no draft-persistence path at all.** So a single tick either
  fabricates a completion (**signed-behaviour change**, and it corrupts the very
  completed-day boundary that is one of Sam's standing device flags) or
  persists partial progress (**new stored state of the worst shape**). The
  escalation rule says the answer is not to invent a door. **Fork A/B/C is in
  the plan, A recommended.**
- **NOTHING WAS BUILT.** No product code landed this pass — the
  `componentIdFromPartId` helper was drafted and **held out rather than landed
  unused**; it lands with the surface that needs it. Commits are docs-only plus
  one inert instrument on `scratch/lr29-dependency-list` (`7c3dc1e3`).
- **NOT COVERED:** no device evidence; the day-first list is measured on SOURCE
  and TYPES, not on a running surface (no tape — the surface does not exist
  yet), and its `kind`-collision hazard is reasoned from a table and **not
  reproduced by a failing case**; the icon assets are not inventoried; rulings
  1–12 remain owed; docs-only commits did not re-run the gate, so main's gate
  line is the merge's AFTER measurement.

## Processed 2026-08-07 — the overnight order as the seat wrote it

1. OVERNIGHT ORDER (Sam ruled, going to bed — VISIBLE-FIRST):
   LOOP CHECK: sequencing ruled by the product owner — no iteration.
   (a) The replay unit is RE-SLOTTED: produce its measured
   dependency list ONLY (Opus, cheap, file it with the kickoff doc)
   — the unit itself now builds AFTER day-first UI, before beta. It
   remains payer of the declared fixture-identity reds.
   (b) THEN DAY-FIRST UI KICKS OFF TONIGHT, per
   docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md + the home-screen
   redesign rulings (artifacts/HOME_SCREEN_REDESIGN_RULINGS_
   2026-07-30.md — 13 Sam rulings, binding) + the signed copy sheet.
   First deliverable: the unit plan with its FULL measured
   dependency list (the V3 law — dependencies before build).
   (c) OVERNIGHT AUTHORISATION: if the plan's dependency list is
   CLEAN of stop conditions (no decision payloads, no signed-
   behaviour changes — expected, per the direction doc this is a
   new window onto project(), not new machinery), PROCEED to build
   slice 1 overnight: the today-first Program view — week strip
   with the game-day anchor, today leading, the day's session as a
   tappable component timeline off ProjectedDayParts, check-off via
   the existing per-component completion. NO clock times. New
   strings ship PROPOSED; icons use existing assets flagged for
   Sam's pick session; L16 vertical slice; full test:bible UNPIPED
   per commit; walker surface laws apply. Park every Sam-shaped
   question in PARKED_QUESTIONS (overnight law) and keep building.
   One batched report by morning: what's on screen, what's parked,
   what's next. STOP only on genuine standing conditions.
   Sam holds a veto on everything when he wakes.

2. (queue empty below this)

## Processed 2026-08-07 (thirty-fourth pass) — RULINGS APPLIED; THE SCREEN-LEVEL INPUT DELIVERED; STOPPED

- LOOP CHECK: **a doc named 1 site, there were 2** does NOT fire — the branch
  ledger was taken by **ANCESTRY** (`merge-base --is-ancestor` on all 12 named
  commits) before a single item was written, and all of stage 1 + stage 2 is
  genuinely landed on this branch.
- **(a) STAGE 2 REFUSED — RECORDED.** The unit doc's stage 2 section is struck
  through and replaced with the ruling; roadmap ticked; NOW.md updated. The
  runner is now written down everywhere as a **NON-OFFICIAL fast pre-check** —
  agents may use it mid-work, **no official verdict ever cites it**; the
  agreement law and its mutation proof stay in the chain guarding the shadow.
  **Unit CLOSED, delivered.**
- **(b) NOTED with thanks. No split** — the seat's hook edit stays inside
  `93b1b7fb`, and the ruling line is the record.
- **(c) `runSlice1` 21.2s vs its 30s ceiling FILED** on the roadmap as small
  maintenance, explicitly not now.
- **(d) DELIVERED: docs/STAGE_B_STAGES_1_2_SCREEN_INPUT_2026-08-07.md.**
  Landed-only, no parked flags, screens and sights, no suite vocabulary.
  Organised by the two screens the athlete actually reaches — the Program tab's
  week screen and the day screen behind it (both V1 shells that render V2).
  - **THE SHARPEST SIGHT:** a recovery slot now gives a **short flush** —
    10-20 min continuous easy, 3-4/10, *"finish better than you started"* —
    where it had been giving a **30-50 min steady run at 65-80% MAS**.
  - **The switchover in one tap:** 55 signed conditioning names, the workbook's
    dose words verbatim, a `Warm-up` row and **no cool-down row**, Sam's own
    effort cue on the row. A composed or machine-suffixed name is the finding.
  - **TWO SIDES OF ONE COMMIT, taped together:** a **rest-marked day holds
    nothing** (stage 1's fix, taken from Sam's own device note), and an
    **out-of-block override renders again** (the regression that same fix
    briefly introduced, found and fixed inside stage 2).
  - **TWO ALREADY-KNOWN SIGHTS FLAGGED so they are not written up as
    discoveries:** the off-season **block-2 deload reshaping instead of
    shrinking** (declared, unfixed, the obvious fix reverted because it breaks
    pre-season generation), and a **lighter day now re-filterable by a later
    injury** (a surfaced question, not a decided behaviour).
  - **SCOPE BOUNDARY STATED IN THE DOC:** it covers stages 1 + 2 only and does
    NOT re-cover R5.3/R5.7, which already had their own tap list.
- **ONE ITEM MARKED LOW-CONFIDENCE AT ITS OWN ENTRY** rather than presented
  level with the rest: B4, conditioning rows travelling with the projected week
  — traced in the reports, not on a screen.
- **NOT COVERED:** no device evidence anywhere in this list — that is what the
  pass is for; screen and navigation WORDING is read from the navigator, not
  tapped, so button text may be wrong; **five week modes (bye, bye_recovery,
  deload, optional, illness_recovery/full-pause) were never reached by stage
  1's proof loop**, so a pass landing in one of them is crossing ground no test
  has; the coach path stays frozen and its doses remain a second authority.
- **STOPPED**, as ordered. The seat writes the tap list; the replay unit kicks
  off separately after the main merge.

## Processed 2026-08-07 (thirty-third pass) — the ruling as the seat wrote it

1. RULINGS on the parallel-gate report — commit as authored.
   LOOP CHECK: payoff-measured-below-scope — the unit's own price
   decides; no iteration.
   (a) STAGE 2 IS REFUSED, ruled from your measurement: ~2 minutes
   does not buy a timing-sensitive failure mode on the gate that
   guards everything. The parallel runner is kept as a NON-OFFICIAL
   fast pre-check (agents may use it mid-work; no official verdict
   ever cites it). The agreement law and its mutation proof stay in
   the chain guarding the shadow. Unit CLOSES here, delivered.
   (b) The hook fix (9cde529c) is ACCEPTED with thanks — proven
   three ways is exactly the standard. The seat's hook edit riding
   in 93b1b7fb: leave it, no split; this line is the record.
   (c) runSlice1 at 21.2s vs its 30s ceiling: FILED as a small
   maintenance item on the queue, not now.
   (d) NEXT UNIT — the cheap one that unlocks main: produce the
   SCREEN-LEVEL input for the stages-1+2 combined device pass (the
   L10 gate main waits on): from the stage 1 + stage 2 boundary
   reports, list every athlete-visible change that is LANDED on
   feat/stage-b-stage2 — for each: which screen, how to reach it,
   what Sam should expect to see. Landed only, no parked flags, no
   suite vocabulary — screens and sights. The seat writes the tap
   list from it. STOP after delivering that list; the replay unit
   kicks off separately after the main merge. Sam holds a veto.

2. (queue empty below this)

## Processed 2026-08-07 (thirty-third pass) — PARALLEL GATE STAGE 1 DELIVERED; STAGE 2 STOPPED ON A REFUTED PREMISE

- LOOP CHECK: **a ruling premise is a claim too** fires, and against the unit's
  OWN scoping line — "target 20 min → ~3-5 min" and "suites are independent".
  Both are refuted by measurement below. Also **a gate that can lie about its
  own result**: my runner produced two before it measured anything.
- **STAGE 1 ITEMS 2-4 BUILT** — `scripts/bible-runner.js`,
  `scripts/bible-agreement.js`, four npm entry points. Item 1 (`gate.sh`)
  already existed.
- **ONE RUNNER, CONCURRENCY ITS ONLY VARIABLE** — `--jobs 1` is the serial
  reference, `--jobs N` the fast lane, same derived list, same literal command
  strings. Two programs would have made a disagreement unattributable.
- **ONE SUITE LIST (guardrail 5) DERIVED AND ASSERTED:** the chain splits on
  `&&` into **158 units** (157 `npm run` + the leading slice; the sweep's 156
  is that set minus `test:compile` and the slice). Fewer parsed than the chain
  contains → it **refuses to measure**.
- **AGREEMENT LAW MET: 4 runs, ALL AGREE** (jobs 8/4/10/8) on the same tree
  `9f15e011`. Every arm **2 of 158** = `program-control-durable`,
  `fixture-identity`, same FIRST_FAILURE. **The declared set exactly.**
- **MUTATION CHECK 6 OF 6, non-vacuous in BOTH directions.** Cells 2/3 (dropped
  unit, flipped exit) must red; cells 1/4 (identical; **same set, different
  finish order**) must stay green — without those an always-red comparator
  passes the ruled cell vacuously. Cell 5 spends 3 real suite runs through the
  actual runner; cell 6 proves the wall-clock detector fires when `EXCLUSIVE`
  is emptied.
- **WHAT THE LAW CAUGHT, FIRST REAL RUN, AND IT WAS REAL:** `chain:runSlice1`
  passed serially 21.2s, FAILED at `--jobs 8` in 43.5s — *"Bible harness
  runtime 43514.4ms exceeds hard ceiling 30000ms"* (`runSlice1.ts:63`).
  **NOT shared state — a WALL-CLOCK SELF-ASSERTION**, which measures machine
  load, not the app, and a lane cannot save it because a lane still runs beside
  the pool. Now **EXCLUSIVE**, with a detector that refuses to measure if
  another unit's entry file declares a runtime ceiling undeclared. **THE
  CEILING WAS NOT RAISED** — the side that moved was my runner, not the app.
- **TWO DEFECTS IN MY OWN RUNNER, caught by its own output before it measured
  anything.** `chain:runSlice1` exited **127** — the one non-`npm run` unit
  missed npm's `node_modules/.bin` PATH — and **both arms would have reproduced
  it identically, so the check would have called it a match**: a vacuous
  agreement on an instrument fault, the exact class this unit exists to
  prevent. And a spawn that never starts crashed the runner mid-measurement.
  Exit 127 is now an **ABORT with no results file**; "command not found" is
  never a suite's verdict about the app.
- **THE PREMISE IS REFUTED AND STAGE 2 STOPS ON IT.** Scoped "20 min → 3-5
  min". **Measured: full 158-unit serial set 257.7s; parallel 111-128s;
  speedup 2.0-2.3x. The chain as felt today is 115s** (short-circuits at the
  declared red near unit 92). **The saving is ~2 minutes, not ~16.** Flipping
  the official gate buys little and adds a timing-sensitive failure mode.
  **Sam's call — the terminal does not flip a merge gate on a refuted premise.**
- **ITEM 4 IS LIVE:** inner-loop rounds may use `npm run test:bible:parallel`.
  **Every commit still pays the serial chain unpiped.**
- **GATE LINE:** full `test:bible` UNPIPED — `GATE_EXIT=1` at
  `test:program-control-durable`, **1 FAIL line**, declared red, same text.
  `test:bible` verified **byte-identical** after the package.json edit.
- **SEPARATE FINDING FOR SAM:** serial `runSlice1` at 21.2s is already past its
  own 18s warning and inside 30s of its hard ceiling. Nothing was changed about
  it.
- **NOT COVERED:** the wall-clock detector scans each unit's ENTRY file only,
  not transitive imports; lane membership beyond `runSlice1` is argued from
  measured shape (child-process fan-out, compiler memory), not individually
  A/B-priced; agreement was measured on this machine at 10 cores only; no
  device evidence; stage 2 not begun.

## Processed 2026-08-07 (thirty-second pass) — SIGNED, MERGED, AND THE TARGET LANDS ON THE DECLARED SET EXACTLY

- LOOP CHECK: **a doc named 1 site, there were 2** — sighting 4, and it fired at
  the SIGNING pass on my own R5.7 cut: a sheet still TITLED "Ask Coach" that no
  longer offers one. My section [4] gate could not see it because it watches
  NAVIGATION, not titles.
- **(a) THE THREE STRINGS RETIRE TO SIGNED** (`6fe02b0c`), recorded as batch 11
  in the rulings file — the authoring source — and **equality-bound BOTH
  DIRECTIONS**: `test:copy-rulings-binding` 7/7.
  - **11-d, a leftover of mine caught here:** the exercise-add fallback sheet
    was TITLED "Ask Coach" and after the cut offers no coach. Replaced with the
    signed title its two sibling sheets already carry, so it is **not new copy**.
    Plus an orphaned prop comment in `StaleOverrideBanner`.
  - **11-e:** "Ask Coach" is **NOT retired as a ruling** — LR-6 freezes
    CoachScreen and the tab is one `Tab.Screen` block from returning, so the
    word is DORMANT for beta, not deleted. Stated so its absence from the UI is
    not read as a retirement nobody signed.
  - The signed sentences ship as single unbroken JSX lines: the binding gate
    equality-matches the file exactly, and wrapping inside a sentence hides a
    string from that match.
- **(b) THE MERGE IS DONE** — `feat/r53-v3-switchover` → `feat/stage-b-stage2`,
  `75fb71df`, `--no-ff`.
  **BEFORE (full `test:bible` UNPIPED on the target): `TRUE_EXIT=0`**, green to
  its last suite, 0 FAIL lines.
  **AFTER: `TRUE_EXIT=1`** at `program-control-durable`, 1 FAIL line; sweep
  **2 of 156** = `program-control-durable`, `fixture-identity`.
  **That is the boundary report's declared set EXACTLY — no difference, no
  STOP.**
- **STATED PLAINLY: the merge took a GREEN target to a 2-RED target, knowingly.**
  `fixture-identity` 3/5/6 are red as PLAIN LAWS with no declaration wearing
  them; payer = the LR-29 replay unit, measured. Sam-accepted as
  known-imperfect. Branch verified before every commit (shared-worktree law).
- **TARGET → MAIN IS *NOT* PART OF THIS GATE, and here is what gates it:** the
  recorded rulings gate it on **the L10 combined device pass for Stage B stages
  1 + 2** (`STAGE_B_STAGE2_CHECKPOINT_COMPLETE`, `STAGE_B_UNIT7_BOUNDARY`,
  `STAGE_B_IMPLEMENTATION_BATCH_BOUNDARY`) — a DIFFERENT pass, **NOT STARTED**.
  Sam's 2026-08-07 pass covered the R5/beta-cut tap list only. **No merge to
  main was executed.**
- **(c) POST-MERGE UPDATES DONE:** `NOW.md` rewritten to the merged state;
  roadmap R5 and the merge gate ticked with the partial-and-honest note
  (R5.4/5.5/5.6 DEFERRED to the replay unit), and the replay unit added as the
  next ENGINE line item. **Item 2 is UNPARKED.**
- **WATCH-FORS carried from the pass:** completed-day display at the next
  completed session; the three fallback sheets; stale-banner Review; the
  team-training affordance.
- **NOT COVERED:** no walker-memory pointer was found to update — the term
  matches nothing in `docs/NOW.md` or the master plan, so nothing was changed on
  a guess; say which artefact is meant and it will be updated. The R5.4/R5.6
  exclusion is still ARGUED from the census, not measured. Four of arm 2's five
  new reds remain undiagnosed. The coach pipeline is FROZEN, not verified.

## Processed 2026-08-07 (thirty-second pass) — the order as the seat wrote it

1. SAM RULED: MERGE. Commit docs/SIGNING_AND_MERGE_GATE_2026-08-07.md
   as authored, then execute:
   (a) Retire the three PROPOSED markers to SIGNED (equality-bound to
   the signed text, both directions, per the copy law).
   (b) THE MERGE: feat/r53-v3-switchover into the ruled merge target
   feat/stage-b-stage2. Full test:bible UNPIPED on the target BEFORE
   and AFTER; the after-state's declared set must equal the
   boundary report's exactly (2 of 156 + the named fixture-identity
   reds) — any difference is a STOP, not a shrug. Verify branch
   before every commit (shared-worktree law). If recorded rulings
   say the stage-b-stage2 -> main merge is part of this same gate,
   execute it under the same before/after discipline; if not,
   report what gates it.
   (c) Post-merge: update NOW.md, the roadmap checkboxes, and the
   walker memory pointer. Then item 2 (parallel-gate stage 1
   remainder) is UNPARKED — this is its natural boundary, per the
   roadmap's Phase 1.5. Proceed under standing conditions.
   One-turn law and continuous authorisation through (a)-(c). Sam
   holds a veto.

## Processed 2026-08-07 (thirty-first pass) — R5 BOUNDARY REPORT WRITTEN; STOP AT THE MERGE GATE

- LOOP CHECK: **a count taken for a record** does NOT fire — the batch ledger
  was checked by ANCESTRY rather than by reading commit subjects, and that is
  what caught the double-count below.
- Answered in **docs/R5_BOUNDARY_REPORT_2026-08-07.md**. Nothing was built.
- **GATE LINE:** full `test:bible` UNPIPED at `e202724d` — `TRUE_EXIT=1`, last
  suite `test:program-control-durable`, **1 FAIL line in the whole run**. Sweep
  **2 of 156**; `test:compile` EXIT 0, no file regressed.
- **THE BRANCH LEDGER IS CORRECTED BEFORE IT REACHES THE TAP LIST.**
  `feat/r53-v3-switchover` is **3 behind / 124 ahead** of `feat/stage-b-stage2`,
  and **R5.1, R5.2 and R5.8 are ALREADY ANCESTORS OF THE MERGE TARGET.** What
  this branch carries that the target does not is **R5.3 and R5.7 only**.
  Counting 5.1/5.2/5.8 as this branch's work would be double-counting.
- **CENSUS:** total declared debt **77**, baseline tightened to 77, founding
  baseline 120; LR-1 **0** (founding 27). The ratchet moved DOWN this era and
  never up — the one attempted upward move (arm 2's static LR-4 hit) was
  refused by deleting the scaffold, not by retuning the number.
- **THE MERGE-CRITICAL LINE:** `test:fixture-identity` cells 3/5/6 are RED **as
  PLAIN LAWS with no declaration wearing them** — the ratchet correctly deleted
  their entries when V3 was expected to pay them, and V3 BANKED short. **Its
  payer is the LR-29 replay unit**, and it is measured: `fixture-identity` is
  the ONE suite the flip arm FIXES. It does not go green before that unit.
- **DEFERRED BY THE CARVE-OUT:** R5.4 (hydration validates the declaration's
  stored SHAPE), R5.5 (it IS the replay unit), R5.6 (the fact door AUTHORS the
  declaration). **That boundary is ARGUED FROM THE CENSUS, NOT MEASURED** —
  stated as a claim the replay unit's dependency list must test.
- **NORTH STAR FOR THE ERA:** the derivation half landed, the accumulation half
  did not. Behaviourally sound; not yet convergent. **V3 BANKED, not closed.**
- **TAP-LIST INPUT DELIVERED: seven athlete-visible changes, LANDED ONLY**, each
  with where to look and what to expect. **Vertical Jump is STRUCK** (parked
  flag only). R5.3 is engine-internal — a week that CHANGES is a finding.
- **THREE PROPOSED STRINGS listed for the signing batch**, all unsigned, all
  saying the same two things: nothing changed, and where to act instead.
- **NOT-COVERED, stated:** no device evidence this era; `fixture-identity` stays
  red; the R5.4/R5.6 exclusion is argued not measured; four of arm 2's five new
  reds undiagnosed; class B text-only in three passes;
  `validateLiveWeekOverlayWrite` fired 0x and `current_microcycle` was never the
  answering source; the coach pipeline is FROZEN, not verified — the cut removes
  the way in, it does not prove what is behind it; `program-control-durable` was
  not re-attributed this era.
- **STOPPED.** Next is the seat's SHORT tap list and Sam's combined device pass
  — the merge gate. Nothing further should land on this branch before it.

## Processed 2026-08-07 (thirty-first pass) — the order as the seat wrote it

1. ORDER: R5 BOUNDARY REPORT, then STOP for the merge gate.
   Write R5's boundary report: what was deleted across all landed
   batches (counts, census closures, ceiling movement), what is
   deferred to the replay unit and why (the carve-out, R5.4/5.5/5.6),
   the north-star convergence answer for the era, NOT-COVERED
   honestly, and the exact state of the branch vs the merge target
   (declared reds, their debts, their payers). Include everything
   the seat needs to write the SHORT device-pass tap list: which
   athlete-visible behaviours changed this era, landed only (no
   parked flags), each with where to see it and what Sam should
   expect. List the PROPOSED strings for the signing batch. Full
   bible UNPIPED as the report's gate line. Then STOP — the next
   step is the seat's tap list and Sam's combined device pass, the
   merge gate, as always ruled. Sam holds a veto.

## Processed 2026-08-07 (thirtieth pass) — R5.7 THE BETA COACH CUT: BUILT, GATED, MEASURED AT THE CONTROL SET

- LOOP CHECK: **a note is output, never evidence** — my own explanatory comment
  in `AppNavigator` tripped my own new classifier on its first run. The note
  yielded, not the gate.
- **R5.7 IS BUILT AND LANDED** (`1c41e6d2`), nine product files.
  **Sweep 156 suites = 2 failures, IDENTICAL TO THE CONTROL SET** (0 new,
  0 fixed); `test:compile` EXIT 0, no file regressed; full `test:bible` UNPIPED
  `TRUE_EXIT=1` at `program-control-durable` — the declared red, same text.
- **THE FULL CUT, as ruled:** the `CoachTab` tab; all three navigate doors; the
  `onMessageCoach`/`onReviewStale` prop chains through HomeScreen, HomeScreenV2,
  HomeQuickActionSheet and ProfileScreen; the StaleOverrideBanner fallback;
  DayWorkoutScreenV2's `askCoachForExerciseEdit`, `askCoachForTeamTraining` and
  `onAskCoachTeam`. **LR-6 HOLDS** — the stack, CoachScreen and the pipeline
  stay in the tree, FROZEN.
- **NO DEAD ENDS, as framed.** The frozen `coach_fallback` route still renders
  its step; it now reports the refusal and closes. Three sheets that lost their
  only action carry **PROPOSED, UNSIGNED** copy saying what is true and where
  the athlete can act. `StaleOverrideBanner`'s Review became UNCONDITIONAL
  rather than being orphaned behind a deleted prop — gating it on the cut prop
  would have hidden a working surface.
- **THE GATE WATCHES THE DELETED SURFACE** (`coachEntrySurfaceContractTests`
  section [4]): no product source navigates to `CoachTab`, no `Tab.Screen`
  registers it, and the frozen stack is still present. **It caught a real
  leftover on its first run.**
- **TWO PINS INVERTED OUT LOUD**, both the legitimate
  `expectation-edited-to-match-regression` case because the RULING moved with a
  date: `profileResetUITests`' setup-sheet fallback (now RATCHETS the cut) and
  `exerciseEditEntrySurfaceContractTests`' `askCoachForTeamTraining` flow owner.
  Every other ruling-12 owner stays pinned.
- **THE RULING'S OWN EXPECTATION IS CORRECTED:** it scoped R5.7 believing it
  would invert `coachEntrySurface` cell [2]. **Measured, it does not** — that
  suite reads CoachScreen, which LR-6 freezes, and it passed 33/33 untouched.
  Recorded so nobody goes looking for a flip that never happened.
- **AN EARLIER ATTRIBUTION OF MINE IS CORRECTED, AND ARM 2 IS DELETED.** Arm 2
  read the profile MIRROR, which the legacy-census ratchet counts by SOURCE
  SCAN — so a parked, flag-off scaffold pushed LR-4 debt UP by one. **That
  explains one of arm 2's own five "new reds": `legacy-census` was never a
  behavioural artefact of the arm, it was this static hit.** A refuted scaffold
  is not worth a debt ratchet; the replay unit re-derives its arm from the
  kickoff doc. Arm 1 (the priced rung-drop) stays.
- **NOT COVERED:** the PROPOSED copy is UNSIGNED and joins Sam's next signing
  batch with the device-pass tap list; no device evidence; the remaining four
  of arm 2's five new reds are still undiagnosed; R5.4/R5.5/R5.6 stay deferred
  to the replay unit as recorded.

## Processed 2026-08-07 (thirtieth pass) — the ruling as Sam wrote it

1. SAM RULED: MAKE THE CUT. R5.7 proceeds NOW on the measured
   surface — commit as authored.
   LOOP CHECK: doc-named-fewer-sites-than-exist — sighting 3, and
   your re-survey firing on a measured table is the law working;
   the survey-before-cut practice is STANDING for every R5 batch.
   (a) The cut is AUTHORISED on your measured surface: all seven
   files, all three navigate doors, the prop chains, the banner.
   The coach_fallback stranded route is answered exactly as you
   framed it: the sheet never renders a dead end — the replacement
   copy ships PROPOSED per the signed-copy regime (equality-bound,
   PROPOSED-marked), and joins Sam's next signing batch, which the
   seat will present WITH the device-pass tap list. Building does
   not wait on the signature; showing the athlete final words does.
   The route itself stays frozen under LR-6, as you said.
   (b) After R5.7: continue R5 in the collision-safe order you
   derived — batches touching none of the carved-out declaration
   surface first; R5.4/R5.5/R5.6 collisions stay deferred to the
   replay unit as recorded. Census closures and structural sweep
   ride their batches as scoped.
   (c) Model: Opus throughout R5 (Sam asked — deletes are Opus
   work; Fable is reserved for the replay unit kickoff).
   Full bible UNPIPED per commit, one-turn law, continuous
   authorisation through R5's batches; one batched report per
   natural boundary or genuine STOP. STOP at Sam's combined device
   pass = the merge gate; the seat writes the SHORT tap list when
   R5's boundary report lands. Sam holds a veto.

## Processed 2026-08-07 (twenty-ninth pass) — V3 BANKED, THE REPLAY UNIT FILED, R5 ENTERED

- LOOP CHECK: **a doc named 1 site, there were 2** — third sighting, and it
  fired on the seat's OWN measured table before a single line was cut.
- Answered in docs/V3_BOUNDARY_BANKED_2026-08-07.md and
  docs/REPLAY_UNIT_KICKOFF_2026-08-07.md. Nothing was built to bank V3 — the
  boundary is the state the branch was already in.
- **(a) V3 IS BANKED, NOT CLOSED** (`8a8f3d4d`). The words are written exactly
  as ruled. **CONVERGED:** content and derivation — the visible week derives,
  the contract derives from the athlete's facts at all three selection lines,
  reduction ownership derives, and ten longhand precedence copies collapsed to
  ONE DOOR. **NOT CONVERGED:** the decision-accumulated identity
  (`authorisedReductions` + the decision-authored identity) is still read from
  storage, which is stored OUTPUT and exactly what the north star forbids.
  Behaviourally sound; not yet convergent — both halves stated, neither is the
  headline alone. Branch stays at its declared **2 of 156**; flip scaffold
  parked inert. NOW.md and the shell-rebuild roadmap updated to match.
- **NO LR-29 PRICING RUN WAS MID-FLIGHT**, so there was nothing to convert;
  the measurements already in hand went into the kickoff doc instead.
- **(b) THE REPLAY UNIT IS FILED** as the next ENGINE unit after the merge gate,
  carrying the class sentence, the four refuted routes with their prices, the
  sizing measurements, every parked scaffold, five open questions, and the
  debts that retire with it. **Its opening law is written first and in bold:
  the first act is the FULL MEASURED DEPENDENCY LIST, before any build or
  scaffold** — V3 spent four passes discovering dependencies one at a time and
  each discovery invalidated the plan built on the last.
- **(d) DEVICE FLAGS CORRECTED:** completed-day display **LANDED**; **Vertical
  Jump STRUCK** — it is measured only under a parked inert flag, so it is not
  something the athlete has. Nothing promised that isn't real.
- **(c) R5 ENTERED, AND THE BATCH ORDER IS DECIDED BY THE EXCLUSION.** Sam's
  carve-out (the stored-declaration read path and its writers retire in the
  replay unit) rules out more than R5.3: **R5.4 collides** (hydration validates
  the declaration's stored SHAPE), **R5.5 IS the replay unit** (LR-29,
  `beforeExposureContract`), **R5.6 collides** (the fact door AUTHORS the
  declaration). **R5.7 — the coach cut — is the only batch that touches none of
  it**, and it is already ruled and signed. It is the batch in progress.
- **R5.7's SURFACE RE-SURVEYED AND THE RULING'S TABLE IS INCOMPLETE**
  (`92be2cee`). **Three `navigate('CoachTab')` doors, not one** —
  `useDayWorkout.ts:369` and `ProfileScreen.tsx:345` were unnamed; so were the
  ProfileScreen `onMessageCoach` prop chain and its button, HomeScreenV2's
  `onReviewStale`, `HomeScreen:454` and `StaleOverrideBanner`. The hook path in
  the table is stale.
- **AND A DEAD-END THE RULING NAMES BUT THE TABLE DOES NOT:**
  `programControlActions` still returns a `coach_fallback` ROUTE. Cutting the
  affordance without answering it strands the athlete at a sheet with nothing
  to press — the half-alive surface C(a) exists to prevent. The route is frozen
  pipeline (LR-6) so it is not deleted; **the replacement copy the ruling
  already requires is the batch's FIRST deliverable**, and it ships PROPOSED.
- **THE CUT IS NOT BEGUN, DELIBERATELY** — on the batch's own recorded reason
  ("a five-file entry-surface cut left half-applied is precisely the half-alive
  surface C(a) exists to prevent"), and it is now a seven-file cut whose first
  deliverable is unsigned copy. It starts from a measured surface next pass.
- **NOT COVERED:** no code moved in R5.7; the proposed copy is not written; the
  `coachEntrySurfaceContractTests` cell [2] inversion is not made; R5.4/R5.6
  are excluded by the carve-out but their exact boundary against the replay
  unit is argued from the census, not measured; no device evidence.

## Processed 2026-08-07 (twenty-ninth pass) — the ruling as Sam wrote it

1. SAM RULED: OPTION B — bank V3 where it stands and move to R5.
   Commit as authored. If the LR-29 pricing run is mid-flight,
   convert what it has already measured into a SIZING DOC for the
   replay unit's kickoff and stop measuring further.
   LOOP CHECK: unit-fatigue-vs-architecture-purity — Sam's call,
   consistent with VISIBLE-FIRST; the banked state is behaviourally
   sound (undo works; nothing ships broken).
   (a) V3 BANKS at the one-door boundary, honestly labelled: branch
   stays at its current declared 2-of-156 set; flip scaffold parked
   inert; stored declaration remains the read authority until the
   replay unit. Write the V3 boundary report with the north-star
   convergence answer stated honestly (content/derivation converged;
   decision-accumulated identity deferred). The words are "V3 BANKED
   at the one-door boundary; remainder = the LR-29 replay unit" —
   not "closed". Update docs/NOW.md and the roadmap doc to match.
   (b) FILE THE REPLAY UNIT as the next engine unit after the merge
   gate, kickoff doc carrying everything hot: the class sentence,
   the four refuted routes, sizing measurements, parked scaffolds
   (flip arm, arm 2, the stash), and its opening law — first act is
   the full measured dependency list, before any build.
   (c) THEN R5: the big delete as scoped — the ~11k replaced
   machinery EXCEPT the stored-declaration read path and its
   writers (those retire in the replay unit); census closures;
   structural sweep; hide coach free-text per the signed beta cut.
   Full bible per commit, one-turn law, continuous authorisation.
   (d) STOP at Sam's combined device pass = THE MERGE GATE. The seat
   writes the SHORT tap list when R5's boundary report lands.
   Device flags for it: completed-day display (landed). Vertical
   Jump is NOT landed (waits on the replay unit) — struck from the
   current flags so nothing promised isn't real. Sam holds a veto.

## Processed 2026-08-07 (twenty-seventh + twenty-eighth passes) — THE CLASS IS THE ACCUMULATOR, AND THE REPLAY IS REFUTED

- LOOP CHECK: **pin-the-"already covered"-claim** fires and pays for itself in
  one suite run — (b) ordered the carried `fact-horizon` attribution
  re-confirmed rather than believed, and it does NOT hold.
- Answered in docs/R53_FLIP_CLASS_CONFIRMED_ACCUMULATOR_NAMED_2026-08-07.md and
  docs/R53_FLIP_C_REPLAY_REFUTED_ACCUMULATOR_STOP_2026-08-07.md.
  **NOTHING BUILT** — both arms flag-gated (`LFA_FLIP_DOOR=1|2`), inert.
- **(a) THE SENTENCE HOLDS FOR THREE, VIA THE READ SIDE.**
  `accepted-state-transactions` 1/2/5 byte-same to the recorded text;
  `athlete-session-deletion` the same bye-build sentence but WIDER (4 recorded
  cells -> 14); `illness-clear-game-week` G3 the same cell with the mechanism
  visible in the changed value (`mode=undefined` -> `mode=in_season_game_week`:
  the read falls back to the covering microcycle instead of finding nothing).
  `phase-structure` 8 is BYTE-IDENTICAL to the recorded class B and still
  undiagnosed in three passes.
- **(a) FOUND A SECOND CLASS NOBODY HAD RECORDED — THE ACCUMULATOR.** Three
  cells, two suites: `athlete-session-deletion` 22 ("owned reduction missing
  from accepted contract"), `action-walker:deep` ("Restore over a
  reduction-authoring removal"), `accepted-state-transactions` 7. Reductions
  accumulate onto the OVERLAY's declaration, so dropping the rung drops the
  accumulation. **8 of 8 accounted for**, where the last pass had 5 undiagnosed.
- **(b) REFUTED, and the carried claim is STRUCK.** `fact-horizon` was recorded
  as T1/A1 "the fact reached the derivation but was never materialised".
  Measured today it is **T4**, "illness_severe rewrote 2 completed day(s)" —
  different cell, different sentence, and T1/A1 do not fail under the arm at
  all. It is the COMPLETED-DAY BOUNDARY, Sam's own standing device flag.
- **(c) THE REPLAY IS REFUTED BY MEASUREMENT. Arm 2 = rung-drop + replay of
  identity from the live world: control 2 -> arm 1 NINE -> arm 2 FOURTEEN.
  It paid ZERO of the eight and cost five more.**
- **THEREFORE CLASS A IS THE ACCUMULATOR TOO — the eight are ONE class.** If
  class A were fixture/fact-derivable identity, arm 2 would have paid it;
  `deriveWeekContract` is exactly that owner and its output reached every door
  caller. It paid none of the three. So the missing state was written by
  DECISION doors (bye-build/practice-match table selection, illness authoring,
  in-week authorised changes) and the covering microcycle is generation's
  output, which knows nothing of any decision taken after it.
- **(c)'s STOP CONDITION IS MET — THE PIECE IS NAMED:** the week's
  DECISION-ACCUMULATED contract state — (1) `authorisedReductions`, whose
  arithmetic needs the composed week no door caller holds, and (2) the
  decision-authored identity, measured NOT recomputable from fixtures + facts.
  Both need the DECISION LEDGER replayed onto the base, which is **LR-29
  undo-as-replay — recorded, sized, NOT BUILT**.
- **A SECOND REFUTATION: the door is the WRONG PLACE to derive.** It is called
  from hydration and stored-shape validation as well as live reads, so there is
  no single world it can derive against — measured as arm 2's five new reds.
  Deriving belongs where the world is already in hand.
- **(d) NOT REACHED; V3 NOT CLOSED.** The flip does not land: it would ship the
  accumulator loss, which is a decision payload — the same STOP reached now from
  four directions.
- **STILL TRUE AND CARRIED:** parity byte-equal in all three worlds,
  `fixture-identity` FIXED, and the athlete's `2026-08-10=Lower Squat|8` Monday.
- **NOT COVERED:** arm 2's five new reds are not individually diagnosed and some
  may be scaffold artefacts (nothing rests on them — the decisive number is the
  ZERO paid); class B is text-only in three passes; LR-29 is not built, not
  scaffolded, not priced; no device evidence.

## Processed 2026-08-07 (twenty-seventh pass) — the ruling as the seat wrote it

1. RULING on the move (iii) price STOP — commit as authored.
   LOOP CHECK: same-failure-set-from-two-mechanisms — the
   re-attribution is ACCEPTED: the 8 reds belong to "the stored
   declaration stops answering at read", not to either migration.
   The writer arm's diagnostic work carries over as you found. The
   seat's dissolve prediction is struck as refuted; the (c)
   correction (parity PAID, not MOVED — gate non-vacuous) is
   ACCEPTED in the good direction, write it as you measured it.
   (a) CONFIRM THE CLASS SENTENCE, cheaply: the leg (v) era already
   diagnosed six reds as one sentence — "the accepted week no longer
   knows what kind of week it is" (mode/identity read from storage).
   Set-diff the five undiagnosed + phase-structure against that
   recorded diagnosis in ONE run. Expected: most or all are that
   sentence via the read side now instead of the write side. Any
   that aren't: tape them, one run, named before anything lands.
   (b) FACT-HORIZON: re-confirm the carried attribution with its
   existing tape (the instrument exists; a carried claim is not a
   measurement — your own caveat, adopted).
   (c) THE FIX, pre-framed by the standing derivation ruling and the
   read-side-first shape: the week's ACCUMULATED identity — mode,
   authorised in-week changes — derives by replaying the week's
   decisions onto the base contract at read. The deriver owns that
   arithmetic. Equality-bind against current behaviour on the full
   witness set (the six suites + Restore + walker worlds). If any
   piece of accumulated identity cannot be recomputed from ledger +
   facts, that is the classification STOP — name the piece.
   (d) Then: the flip lands WITH the two pre-authorised ratchet
   deletions (parity entry PAID, D13-paid entry), full bible
   UNPIPED, endpoint measurements, the words only if supported.
   One-turn law and continuous authorisation to the endpoint. Sam
   holds a veto. Device flags land via the flip as measured
   (Vertical Jump Monday byte-equal in all three worlds).

## Processed 2026-08-07 (twenty-sixth pass) — MOVE (ii) BUILT AND FREE, MOVE (iii) PRICED AND STOPPED

- LOOP CHECK: **a-count-taken-for-a-record does NOT fire** — the arms were
  diffed as SETS, and that is what produced the pass's main finding. The counts
  alone (8 new / 1 fixed on both arms) would have read as coincidence.
- Answered in docs/R53_FLIP_MOVE_III_PRICED_STOP_2026-08-07.md.
- **(b) FIRST HALF BUILT: MOVE (ii) IS LANDED AND FREE** (`e97c9a49`,
  unflagged). Ten longhand copies of the declaration precedence onto one owner,
  `src/rules/storedWeekDeclaration.ts`. **Sweep 2 of 156 — the control set
  EXACTLY**, 0 new / 0 fixed; `test:compile` EXIT 0 no file regressed; full
  `test:bible` UNPIPED TRUE_EXIT=1 at `program-control-durable` (the declared
  red, same text, 1 FAIL); parity gate 16/16. The census tape lives INSIDE the
  door, so it is complete by construction — 6,399 calls / 28 triples / 7
  readers in the parity worlds.
- **(b) SECOND HALF PRICED, NOT BUILT: the flip is 9 of 156** —
  `fixture-identity` **FIXED**, 8 new. Flag-gated `LFA_FLIP_DOOR`, inert.
- **THE PARITY WORLDS GO BYTE-EQUAL and the Monday returns** —
  `2026-08-10=Lower Squat|8` in all three worlds, Vertical Jump present. The
  declared entry EXPIRES on its own `expiresWhen` terms.
- **(c) IS REFUTED IN THE GOOD DIRECTION, and the ordered phrase is NOT
  written.** The gate does NOT go vacuous: the flip drops only the DECLARATION
  rung, the payload survives, so the comparison still exists (5/7/5 materialised
  days, non-vacuity assertion passing) and is byte-equal. A diff that stopped
  happening is PAID, not MOVED. "MOVED-not-PAID" does not apply here.
- **THE MAIN FINDING: the seat's "the 8 will dissolve" prediction is REFUTED,
  and the failure SET is byte-identical to the leg (v) WRITER arm's.** Two
  different mechanisms — stop WRITING the declaration, stop READING it —
  produce the same eight suites and the same one fix. **So the 8 reds belong to
  neither the writer nor the reader migration, but to the one property both
  arms share: the stored declaration stops answering at read.** The class
  re-attributes as one cause, and the writer pass's diagnostic work carries
  over instead of being redone.
- **STOP ON (b)'s OWN CONDITION** ("any red is attributed before the flip
  lands, none carried silently"): 1 is the declared debt paying itself, 1 is a
  ratchet+harness cell, 1 (`fact-horizon`) is a CARRIED claim explicitly
  recorded as not re-confirmed, and **5 are undiagnosed**. The flip does not
  land. **(d) NOT REACHED; V3 NOT closed** — on (d)'s terms, the words only if
  the measurements support them.
- **NOT COVERED:** the 5 undiagnosed suites' failure text was not read (only
  `illness-clear-game-week` and `fact-horizon` sampled); no device evidence;
  `validateLiveWeekOverlayWrite` fired 0× and `current_microcycle` was never
  the answering source in any taped world, so move (ii)'s identity for those
  two rungs rests on code equivalence; the door does not yet DERIVE in place —
  the flip is priced by its behavioural equivalent, not built.

## Processed 2026-08-07 (twenty-fifth pass) — the ruling as the seat wrote it

1. RULING on f546c0b4 — the §8 alternative is APPROVED. Commit as
   authored.
   LOOP CHECK: §8 applied by the terminal against the seat's own
   order, first firing — this is the law working; adopted.
   (a) Move (i) is DELETED from the flip. The fifth writer finding
   is ACCEPTED; the seat owns the census gap as promised (the census
   enumerated reads — writer enumeration was never its dimension,
   and under this ruling it never needs to be: unread storage makes
   every writer, found or unfound, harmless).
   (b) THE UNIT IS NOW (ii) → (iii): one read door (mechanical,
   census-verified by tape re-run — same pairs, same counts), then
   flip the door to the deriver in ONE commit. Every divergence
   between stored and derived at flip time is a behaviour change in
   the DERIVED direction — the full witness set (bible unpiped,
   Restore/deletion suites, walker, parity worlds) measures it; any
   red is attributed before the flip lands, none carried silently.
   The Monday power row and Vertical Jump land BY the flip, as
   measured.
   (c) BOOKKEEPING, honest: the parity gate goes vacuous — accepted;
   its entry retires MOVED-not-PAID with that exact phrase in the
   record, and the gate itself retires with the storage deletion in
   R5's big delete, where the stored declaration's physical removal
   is already a line item. The stash arm (flip-move-i-wip) is
   preserved per condition 4.
   (d) After (iii): derived is the sole read authority — the V3
   convergence answer. Run the endpoint measurements; the words only
   if they support it. One-turn law and continuous authorisation to
   the endpoint. Sam holds a veto. Device flags unchanged, landing
   via the flip.

## Processed 2026-08-07 (twenty-fourth pass) — OWNERSHIP DERIVES AT READ, BUILT AND FREE

- LOOP CHECK: **gate-passing-on-coordinates-it-never-builds** — sighting
  against myself, caught mid-pass by reading the controls instead of the
  verdict. The first equality bind was GREEN across the whole ordered
  witness set and proved almost nothing: 35 of 37 consumer calls compared
  an EMPTY set against an EMPTY set.
- Answered in docs/R53_REDUCTION_OWNERSHIP_DERIVED_2026-08-07.md.
  **BUILT into the branch, unflagged** (`08212473`) — read half only; the
  writer is untouched, per "read side first, writer last".

- **(b) BUILT.** Both restoration consumers asked the mirror ONE question —
  *which of this week's authorised reductions does this adjustment own?* —
  and never read a target, metric or detail from it. That question already
  had a decision-shaped answer, recorded as leg (iv)'s own ruling: a typed
  reduction belongs to the adjustment whose CONSTRAINT authored it. So
  ownership now derives as `deletionIdentity ∈ linkedUserRemovalConstraintIds`
  against the contract in hand. It cannot go stale.
- **(c) EQUALITY HOLDS.** All 156 suites, derivation live: **45 consumer
  calls, 10 rows selected on each side, DIVERGENT 0.** Restore's meaning is
  protected, not changed.
- **THE GATE IS FREE: sweep 2 of 156** (`program-control-durable`,
  `fixture-identity`) — exactly the declared set, 0 new / 0 fixed.
  `test:compile` EXIT 0. Action walker 22/22.
- **TWO CORRECTIONS, BOTH MINE, BOTH BEFORE TRUSTING THE RESULT.** (1) The
  bind's first version compared the RAW sets and reported 6 divergences; the
  mirror was naming rows the contract does not carry, which both consumers
  filter away — the comparison had to be over what each method SELECTS from
  the contract. (2) The near-vacuous green above.
- **THE VACUOUS-PASS FIX IS A HARNESS DEFECT PAID.** An athlete can undo an
  adjustment from the week screen (`useHomeScreen.ts:1749`); the walker had
  no action for it, which the walker's own header already calls a defect in
  the harness, not a gap in the app. `clearReversibleAdjustment` is awaited
  and `perform` is synchronous, so it is walked end-to-end in a new cell,
  `walkTheRestoreDoorOverAReduction` — which asserts the bind was EXERCISED
  (calls moved, equal moved) BEFORE asserting it agreed.
- **THE MIRROR IS NOW BEHAVIOURALLY WRITE-ONLY.** Census: five writers, a
  type declaration, a hydration shape guard, and exactly one content reader
  — which exists only to feed the bind. That is the state (d) needs for it
  to retire with the declaration in the leg (v) landing.
- **`reversibleAdjustmentLedger.ts:419` IS A FILLER, NOT A CONSUMER.** It
  reads the stored contracts to WRITE the mirror. Under this ruling there is
  nothing to convert: it retires with the mirror. Naming it as converted
  would be claiming work that does not exist.
- **THE ENDORSED COMPRESSION IS BUILT:** `src/dev/measure.ts` `Tally` (cannot
  report a bare number — occurrences, distinct, and the dedup key's NAME
  always travel together) and the AGENTS.md law *"a count names the
  instrument's unit, not the domain noun"*, with all three sightings.
- **NOT COVERED:** only **4 of 45** calls compare a non-empty set and only
  **5 of 156** suites reach the consumers at all — the bind is exact but
  narrow, and nothing here rests on it being broad; `explicit_load_edit`
  adjustments own no constraint id, so derived ownership is empty for them
  by construction (measured empty on the stored side too in every witness
  world, but an `explicit_load_edit` that ever recorded a matching row would
  diverge and no world produces one); the writer is untouched; the 3
  deep-walker direct-transaction worlds are reachable through the new cell's
  route but not individually pinned; no device evidence.

## Processed 2026-08-07 (twenty-third pass) — the ruling as the seat wrote it

1. RULING on 6ff1e745 — the mirror dies, it does not get filled.
   Commit as authored.
   LOOP CHECK: count-taken-for-a-record — sighting 3, your proposed
   compression is ENDORSED as written in the report; build it as part
   of this unit's harness work, don't run the loop a fourth time.
   (a) The attribution is ACCEPTED in full, including the refutation
   of my ruling's premise: the ledger is COMPLETE (no door skips the
   append; 23 decisions, all recorded; my "159 missing decisions"
   framing is struck from the record). The R2-style extraction
   ordered in (b)(ii) is CANCELLED — there is nothing to extract.
   (b) The design call, ruled by the standing derivation ruling —
   this is its textbook case, and your own measurements close every
   stop-condition: linkedTypedReductions is a STORED MIRROR OF
   DERIVED ARITHMETIC (output, not decision — the deriver already
   owns the arithmetic, 0 of 568 week-walks show it missing
   anything). So it is NOT filled by any route — not the staging
   reorder, not the cheap post-materialisation link, none. Filling a
   mirror is building more stored output; the north star and LR-29
   (undo-as-replay) both say the same word: derive.
   THE UNIT: the consumers at reversibleAdjustmentLedger.ts:419 and
   the restoration path derive the typed reductions from decisions +
   the deriver's arithmetic AT READ, equality-bound against current
   Restore behaviour on the full witness set — deletion 24/24,
   properties, mutations, the 40 reduction-row worlds, AND the 3
   deep-walker direct-transaction worlds explicitly (reported, so
   they get covered, not rounded away). Read side first, writer
   last, one priced unit — the shape that has now landed twice.
   (c) Restore's meaning is the signed behaviour being PROTECTED
   here, not changed: the equality bind IS the proof. If equality
   fails on any witness, STOP with the row named.
   (d) EQUALITY HOLDS → the mirror retires WITH the declaration in
   the leg (v) landing, instruments stripped, and the pre-ruled run
   home resumes unchanged through parity expiry, condition 1, cells
   5/6 re-pin, and the words only if the measurements support them.
   One-turn law and continuous authorisation EXTEND through all of
   it. Sam holds a veto. Device flags unchanged.

## Processed 2026-08-07 (thirteenth pass) — THREE-CLASS RUN: "zero readers" REFUTED

- Answered in docs/R53_THREE_CLASS_RUN_ZERO_READERS_REFUTED_2026-08-07.md;
  instrument at `271a7be4` on scratch/r53-pricing-7-probe. NOTHING BUILT.
- **THE PREVIOUS PASS'S HEADLINE IS WITHDRAWN — it was wrong, and your
  ordered instrument caught it.** All three classes in one run, writing to
  ONE FILE rather than stdout:

  | measure | flags off | LEG_II=1 |
  |---|---|---|
  | `scaffoldSection18TierFour` reads `SCAFFOLD.legII` | **6,947** | **13,894** |
  | env reads of the var | 30 | 46 |
  | module loads | 34,510 | 48,404 |

  Stack: `get legII <- scaffoldSection18TierFour <- resolveWeekWithConditioning`.
  **Leg (ii)'s gate is live in fact-horizon and reads the flag on every week
  resolve.**
- **WHY THE EARLIER TAPES SAID ZERO:** `durableFactHorizonTests.ts:675
  runAllForked()` **spawnSync's its cases into CHILD PROCESSES**. The
  four-site tape and the reader-getter both wrote to `process.stdout`, read
  back through `npm run … | grep` — so everything the children wrote was
  never in the grepped stream. Both zeros were instrument artifacts. Same
  cause invalidates the earlier "tier-4 write tape recorded zero".
- **The specific reasoning error, named:** I claimed the instrument was
  "proven sound, not assumed" because it fired 1205/1205/532 in the
  DELETION suite. That is a real observation and a false proof — firing in
  suite X says nothing about surviving suite Y's PROCESS MODEL.
  **Harness-lies sighting 4, and it is mine.**
- **The open question DISSOLVES — it was never true.** No module-init
  effect, no artifact cache, no hidden fifth reader. Your stated escape
  hatch ("all three empty → impugn the runner") does NOT fire: class (1)
  came back loud. The runner is not impugned; the instrument was.
- **Next, on solid ground:** re-run the tier-4 WRITE tape to a FILE and name
  the write that rewrites 2026-07-20 / 2026-07-21. Straightforward re-run
  now, not a mystery.
- **NOT covered:** the completed-day rewrite is still not attributed to a
  line; module-load-order diff captured but not analysed (unnecessary once
  class (1) answered); only fact-horizon instrumented; no compiled-artifact
  caches exist in the tree, so class (3)'s artifact half had nothing to hash.

## Processed 2026-08-07 (thirteenth pass) — the order as the seat wrote it

- LOOP CHECK: instrument-covered-one-class-while-three-were-live —
   sighting 2 (the reader-getter, like the four-site tape before it,
   watched one class of consumer while the others stayed dark) —
   COMPRESS: one run instruments ALL THREE candidate classes at once.
   RULED on the b589241b report:
   (a) The finding is ACCEPTED as measured: value '1' decides the
   outcome with zero post-install reads of SCAFFOLD.legII. That
   leaves exactly three places a consumer can hide, and ONE run
   covers all of them, both arms, diffed:
   - LOAD-TIME CAPTURE: the recording getter moves INTO the SCAFFOLD
     definition itself (first executable line, nothing can read
     before it exists) — a capture at import now records or cannot
     happen.
   - READER OUTSIDE src (harness, scripts, node_modules): a Proxy on
     process.env recording every key access with stack, installed
     via node --require before ANY module loads.
   - INIT-ORDER / ARTIFACT: tape the module-load ORDER both arms and
     hash the compiled-artifact state (.qa-compiled and friends —
     the retired tsc pipeline's leftovers are prior art for exactly
     this class; harness-lies sighting 4 watch), diff both.
   If all three come back identical/empty while the outcome still
   differs, STOP — that result would impugn the runner itself and
   the seat re-examines the measurement, not the code.
   (b) sweep.sh's world-identity preamble: ACCEPTED as shipped, both
   directions proven — this is the harness-lies compression landing.
   (c) Standing conditions unchanged; nothing lands; no mechanism
   named until watched executing. Sam holds a veto.

## Processed 2026-08-07 (twelfth pass) — SOURCE TAPE + harness compression

- Answered in docs/R53_SOURCE_TAPE_ZERO_READERS_2026-08-07.md; instruments
  at `4b846988` on scratch/r53-pricing-7-probe. NOTHING BUILT.
- **(a) ZERO READERS, and the flag still decides.** A recording getter on
  `SCAFFOLD.legII` (plus a module-load line for the env read) finds ALL
  readers by construction. In `fact-horizon`: flags off 14/0; `LEG_II=1`
  **12/2**; `LEG_II=1` WITH the getter installed **12/2** — and
  **0 property reads in every arm**, only the module-load line.
  **Controls:** `LEG_II=0` → 14/0 and an unrelated env var → 14/0, so it is
  specifically the VALUE `'1'`, not the variable's presence and not any env
  change. Repo-wide the var appears in exactly ONE place, and there is NO
  dynamic env access in `src`.
- **Branch of your decision tree: "zero hits both arms."** Stated precisely
  rather than glossed — the value demonstrably DOES decide the outcome, so
  the finding is the sharper **"the value decides without any reader
  consuming it."** Both readings point at the step you already named:
  **diff the two arms' module-load lists + compiled-artifact state.**
  **Fourth-sighting watch.** No mechanism named — three hypotheses died in
  this unit by being plausible and unexecuted.
- **(b) HARNESS-LIES COMPRESSION SHIPPED** — `scripts/sweep.sh`. cwd/HEAD/
  symbol-in-source are a MANDATORY PREAMBLE inside the runner, printed
  before any suite runs, exiting non-zero WITHOUT measuring if unmet.
  Proven both ways: from the branch it ABORTS (exit 3) naming the
  2026-08-07 lie; from the scaffold it prints `SWEEP WORLD: … head=f91ea404
  files_with_symbol=1` and proceeds. Suite list read from the bible chain
  itself so it cannot drift.
- **(c) ACCEPTED:** per-leg prices don't add; (iii)+(iv) mask two of leg
  (ii)'s seven; the five-vs-seven correction stands. Ordering arguments cite
  measured COMBINATIONS only.
- **NOT covered:** no root cause (deliberately not guessed); the
  module-load/artifact diff NOT run; only `fact-horizon` taped; masking
  mechanism uninvestigated.

## Processed 2026-08-07 (twelfth pass) — the order as the seat wrote it

- LOOP CHECK: flag-changes-outcome-with-zero-gate-executions —
   sighting 1 of this shape, but it is the enumerate-readers-and-miss
   class, and harness-lies is at sighting 3 — COMPRESS both. RULED on
   the 58c40414 STOP:
   (a) Instrument the SOURCE, not the enumerated readers: make
   SCAFFOLD.legII (and the env read that feeds it) a recording getter
   — every access logged with stack, including module-load-time
   captures, in the fact-horizon suite, both arms. Grep found four
   readers; the getter finds ALL readers by construction, or proves
   there are none. One run, then:
   - hits found -> the hidden reader is the mechanism candidate; tape
     it executing before attributing (executes-on-path law).
   - zero hits both arms -> the flag's VALUE is not the cause; the
     difference is environmental (world identity), and the next diff
     is the two arms' module-load lists + compiled-artifact state —
     harness territory, fourth-sighting watch.
   (b) Harness-lies compression (sighting 3): the cwd/HEAD/
   flag-in-source assertions move INTO the sweep runner as a
   mandatory preamble — no measurement counts without its world-
   identity line printed. Same class as gate.sh's exit line: trust
   only printed evidence.
   (c) The interaction finding is ACCEPTED as law for this unit:
   per-leg prices don't add; every ordering/build argument cites
   MEASURED COMBINATIONS only. The five-vs-seven correction stands
   recorded.
   (d) Nothing lands; parity gate and all standing conditions
   unchanged; worst-first stands (fact-horizon before the other
   six). Sam holds a veto.

## Processed 2026-08-07 (eleventh pass) — SWEEP: leg (ii) priced ALONE + taped

- Answered in docs/R53_LEG_II_ALONE_PRICED_AND_TAPED_2026-08-07.md.
  NOTHING BUILT.
- **(c) LEG (ii) ALONE COSTS SEVEN, not five.** All 154 suites, sets:
  control 6; (iii)+(iv)+basis 6 (**0 new**); **(ii) ALONE 13 (7 new)**;
  (ii)+(iii)+(iv) 11 (5 new). The seven:
  `accepted-state-transactions`, `action-walker:deep`,
  `device-pass-2026-08-05-evening`, `fact-horizon`,
  `program-control-durable`, `session-list-combinations`, `work-bill`.
- **LEGS (iii)+(iv) MASK TWO of leg (ii)'s failures** —
  `device-pass-2026-08-05-evening` and `session-list-combinations` are red
  alone, green in combination; nothing goes the other way. **The legs
  INTERACT: per-leg prices do not add**, so the earlier "5" was the
  residue, not leg (ii)'s cost. Any ordering argument must be made against
  measured COMBINATIONS.
- **(b) THE TAPE — leg (ii)'s gates NEVER EXECUTE in `fact-horizon`.**
  The failure is real and deterministic (flags off 14/0; `LEG_II=1` 12/2,
  repeated twice each way). `SCAFFOLD.legII` is read in exactly FOUR places
  in `src`; all four taped; **all four record ZERO hits** in that suite —
  tier-4 host entry, `withDisplacedCapacityReduction`,
  `repairDisplacedStrengthCandidates`, `selectedShortfall`.
  **The instrument is proven sound:** the same tape fires 1205/1205/532 in
  `test:athlete-session-deletion`.
- **STOP with the question open.** Leg (ii) changes the outcome without any
  of its gates running, so the effect is not flowing through them.
  Candidates — module-init/import-order effect of evaluating `SCAFFOLD`, a
  fifth reader grep does not match, a value captured once at load — are
  NOT tested, and per the standing rule none is worth anything unmeasured.
- **A measurement that lied, and was caught.** The first leg (ii)-alone run
  reported 1 failure: `git worktree add` refuses a second checkout of the
  same branch, the `cd` failed silently, and it measured the BRANCH where
  the flag is inert. Rerun asserts `cwd`, `HEAD` and the flag's presence
  before measuring. Third harness-lies sighting this unit.
- **NOT covered:** the other six were not taped (worst-first, as ordered);
  no root cause; the masking mechanism not investigated.

## Processed 2026-08-07 (eleventh pass) — the order as the seat wrote it

- LOOP CHECK: unpriced-leg-reaches-front-of-build-order — sighting 1,
   but the sweep-not-serial law already covers it — COMPRESS both the
   pricing and the diagnosis. RULED on the leg (ii) STOP (34bb2af4):
   (a) The five reds are ACCEPTED as leg (ii)'s price; the STOP was
   right; 2-of-3 stays known-wrong; option 1's grounds stand.
   (b) DIAGNOSE BY TAPE, not serially: ONE instrumented run across
   all five failing suites' worlds recording every tier-4 write —
   target day, that day's completed/fact status, payload, stack —
   then diff against the laws. The one-root hypothesis gets ANSWERED
   by that run, not argued; if one cause explains several, the map
   falls out of the same tape. Fact-horizon is the read of the tape
   to do first (completed days are FACTS — a layer rewriting them is
   the named destroy-class, worst first).
   (c) In the SAME sweep: price leg (ii) ALONE (it was only ever
   measured riding (iii)+(iv)) — the build order gets chosen knowing
   every leg's own price, per your own named pattern, which is
   ENDORSED as standing: every remaining leg of any unit is priced in
   one sweep BEFORE build order is chosen, never as it reaches the
   front of the queue.
   (d) Nothing lands until the five are attributed and re-priced;
   parity gate and all standing conditions unchanged. Sam holds a
   veto.

## Processed 2026-08-07 (tenth pass) — OPTION 1 RULED -> LEG (ii) PRICED -> STOP

- Answered in docs/R53_LEG_II_PRICED_STOP_2026-08-07.md. NOTHING BUILT.
  The ruling's own first condition was leg (ii)'s measurement run FIRST.
  Done — and the price stops the build.
- **CONTROLLED, same worktree, all 154 suites.** Control (flags off) 6;
  `LEG_II+LEG_III+LEG_IV+basis=visible` 11. Diffed as SETS:
  **5 NEW, 0 FIXED.** The (iii)+(iv)+basis arm was 0/0, so all five belong
  to leg (ii).
- **The five are laws, not re-pins:**
  (1) `fact-horizon` — tier 4 **REWRITES ALREADY-COMPLETED DAYS**
  (2026-07-20 High→Moderate, 2026-07-21 High→Moderate), for both
  `illness_severe` and `cooked_week`.
  (2) `accepted-state-transactions` — "Pre-season hydration drifted"
  (determinism) and "following-week dependency was not committed in the
  same snapshot" (atomicity).
  (3) `program-control-durable` — "a move committed durably reaches the
  visible week" FAILS.
  (4) `work-bill` — a category add bills beyond its decision + declared
  mirrors.
  (5) `action-walker:deep` — **L13's gate, law L-P3 TEMPLATE = PROJECTION**
  violated; session list omits `["speed"]`, invents `["support"]`.
  **Minimal failing history: 6 actions** — not a deep-state curiosity.
- **STOP.** Option 1's grounds are not disputed; what is new is the price,
  which the ruling ordered measured before building. Under the standing
  conditions leg (ii) cannot land in this state, so neither can the
  (ii)+(iii)+(iv) unit as one commit.
- **Shapes offered, none taken:** (a) fix leg (ii) first, pricing the five
  individually — `fact-horizon` looks like the root and several others are
  consistent with tier 4 over-reaching, so one cause may explain three or
  four; (b) land (iii)+(iv) alone accepting the known-wrong 2-of-3 install
  temporarily; (c) re-scope tier 4's reach to exclude completed days and
  the dependent-week snapshot, then re-price. **Recommended: (a), but only
  after the `fact-horizon` root is diagnosed.**
- **NOT diagnosed, only characterised** — the "one root" idea is a
  hypothesis and worth nothing until measured. Leg (ii) ALONE was not
  measured (only added to (iii)+(iv)).

## Processed 2026-08-07 (tenth pass) — the ruling as the seat wrote it

- LOOP CHECK: leg-assumed-independent-shares-host (flags lied about
   the work's shape) — sighting 1 — ITERATE, and the cheap catch you
   named (check a leg's install sites against the TARGET branch
   before pricing it) is ENDORSED as standing practice now, not at
   sighting 2. RULED: OPTION 1 — land legs (ii)+(iii)+(iv) together.
   Grounds, all recorded: leg (ii) was ALWAYS part of the ruled
   four-leg unit (the deriver-acquires-repair-search ruling ordered
   the full :4688 capability into tier 4 before any of this); landing
   the unit in its own dependency order is not a scope expansion, it
   is the convergence ruling built as designed; and the Elegant
   Solution Requirement prefers the shape that removes a
   representation over a 2-of-3 install that keeps the publisher
   composing against the stored contract (the fixture-identity
   residual you refused to create — right refusal). Conditions
   unchanged: leg (ii)'s single measurement run FIRST (price before
   build, as always); parity gate (derived == materialised,
   byte-equal, tape as instrument) before leg (v) re-prices;
   materialisation + declaration retire together with leg (v); full
   test:bible UNPIPED per commit; STOP conditions stand. Sam holds a
   veto.

## Processed 2026-08-07 (ninth pass) — BUILD MAY START -> SURVEYED, then STOP

- Ruling committed as authored (`a81cc38a`). Answered in
  docs/R53_LEG_III_SURVEY_AND_SEPARABILITY_STOP_2026-08-07.md.
  NOTHING BUILT into the branch.
- **THE SURVEY: legs (iii)+(iv)+`basis=visible` are BEHAVIOUR-NEUTRAL.**
  All 154 bible suites, flags-off control vs target: **6 failures vs 6,
  identical sets — 0 new, 0 fixed.** The control's 5 scaffold-only reds
  were verified to PRE-DATE this pass's tape (re-run at `1eb65683`); the
  branch's own control is 1 (`fixture-identity`), which leg (iii) does NOT
  fix, as predicted.
- **The module IS separable.** `derivedWeekContract.ts` lands cleanly —
  every import already exists on the branch. Install site 1 of 3
  (`acceptedEffectiveWeek` read + the basis) is separable too; the
  `removalDecisions` field beside it belongs to the removal-record split
  and is NOT required by leg (iii).
- **BLOCKER — install site 2 of 3 requires LEG (ii).** On the scaffold the
  deriver's resolver read lives INSIDE `scaffoldSection18TierFour`, gated
  `if (!legII && !legIII) return`, and that function IS leg (ii)'s tier-4
  host. **The branch has no tier-4 host at all.** Site 3 additionally needs
  `stripConditioningComponent` moved to `sessionRowCounting` — small, not a
  blocker.
- **A partial install is known-wrong**, by the scaffold's own record:
  installing only the read sites left the PUBLISHER composing against the
  stored contract — `Lower Hinge|7` published vs `Lower Squat|8` derived,
  which IS the fixture-identity residual. So 2-of-3 was not done.
- **For the seat — the ruling's step 1 assumed leg (iii) is buildable
  alone; as scaffolded it is not.** Options: (1) land (ii)+(iii)+(iv)
  together per the convergence pairing — RECOMMENDED, removes
  representations rather than adding one, and needs one measurement run for
  leg (ii); (2) author a new leg-(iii)-only resolver install — new code,
  adds a representation; (3) sites 1+3 only — rejected as known-wrong,
  recorded so it is not silently dropped.
- `test:compile` excluded from the survey: +2/+1 vs the scaffold baseline
  is a scaffold-type artifact — branch baselines are identical (5/4) and
  `test:compile` PASSES on the branch (verified).

## Processed 2026-08-07 (ninth pass) — the ruling as the seat wrote it

- LOOP CHECK: tape-hop ruling — sighting 2 of write-side-producer-
   feeds-stored-output in R5.3 — COMPRESS via the standing derivation
   ruling. Read docs/R53_COMMIT_MATERIALISATION_RULING_2026-08-07.md,
   commit as authored. Short form: the materialised payload is OUTPUT
   not decision (recomputable from ledger + facts; records no athlete
   choice), so the standing derivation ruling applies and the signed
   accept-and-reduce rulings are not touched — they sign what accept
   DOES, not where content is produced. Order: leg (iii) builds
   first, corrected grounds (the deriver must supply at read what the
   commit materialises at write); parity gate before leg (v)
   re-prices — derived week == materialised week, byte-equal, on the
   tape's own fixture worlds, tape as instrument; materialisation +
   declaration retire TOGETHER with leg (v) after parity, no
   half-state; condition 1's re-measure unparks after the parity
   gate. BUILD MAY START. Sam holds a veto.

## Processed 2026-08-07 (eighth pass) — THE TAPE

- Answered in docs/R53_TAPE_DROP_HOP_NAMED_2026-08-07.md; tape at
  `f91ea404` on scratch/r53-pricing-7 (`LFA_TAPE`, inert by default).
  NOTHING BUILT. Sam's sweep-not-serial method was applied as ordered.
- **THE TAPES DISAGREE ON PAYLOAD AT EXACTLY ONE HOP.** Sequence identical
  to index 10; payload empty in BOTH worlds through publication and
  staging (the deliberate `workoutsByDate: {}`), then:
  `H8.rev:store-after-accepted-commit` = **2/2 flags-off vs 0/0 leg (v)**.
  The payload is materialised INSIDE `commitAcceptedStateTransaction`.
  Staging does not fill it (H7 identical), ruling out
  `stageReversibleAdjustmentCreationTransaction`.
- **The discriminator is the published declaration.** The only proposal
  difference between worlds is `exposureContractV2` on the proposed
  overlay. Both worlds END with a contract in the store (v2=T at H8 either
  way — the transaction mints/repairs one regardless); only the world
  whose PROPOSED overlay carried it gets its PAYLOAD materialised.
  `LFA_LEGV_SCOPE=both` reproduces the same hop and the same 0/0.
- **Five suspects settled in the one run:**
  `buildWeekScopedWorkoutOverlay` builds identically in both worlds (H1);
  staged rolling-horizon projections byte-identical (H5); no colliding
  `additionalOverlays`; `commitWeekScopedOverlay` replaces wholesale;
  `validateLiveWeekOverlayWrite` never executes.
- **STOP CONDITION MET, hop named.** The drop is inside
  `commitAcceptedStateTransaction` — the signed accept-and-reduce owner
  (`forward_decision`/`restoration`). Per the order's own terms that is
  signed behaviour, so this is the STOP, not a narrowing to build against.
  Which LINE inside it materialises the payload was deliberately NOT
  narrowed.
- **For the seat:** the freed day's content is materialised by the signed
  commit BECAUSE the publication declares a contract. Retiring the
  declaration removes content the commit would otherwise materialise —
  and that is a WRITE-time materialisation, which leg (iii) does not
  obviously supply, since leg (iii) changes READ-time derivation.
  Condition 1's re-measure stays parked; build-order question is yours.

## Processed 2026-08-07 (eighth pass) — the order as the seat wrote it

- SEAT ORDER, UPGRADED per Sam's method call (2026-08-07, his third
   sweep-not-serial instinct — matrix law, batch law, now this):
   STOP hypothesis-at-a-time. ONE instrumented run, BOTH worlds:
   tape EVERY write and transform that touches the freed week's
   workoutsByDate across the whole commit path — build, publication,
   republish, staging, commit — with stack + payload size at each
   hop, flags-off vs leg (v), then DIFF the two tapes. The first hop
   where the tapes disagree is the answer; every suspect is tested
   in the same run, ranked by the diff instead of by guesses. The
   executes-on-path law is satisfied by construction (the tape IS
   execution). Attribution only; nothing built; STOP conditions
   unchanged; condition 1's re-measure stays parked; build-order
   question waits for the diff. Cell-19 retirement (1eb65683)
   ACCEPTED. If the tape shows the drop inside a decision payload or
   signed behaviour, STOP with the hop named.

## Processed 2026-08-07 (seventh pass) — SEAT CORRECTION on answer 3

- Ruling committed as authored (`a375b49f`). Answered in
  docs/R53_SHARP_PROBE_FILLER_NAMED_2026-08-07.md; probes at `1eb65683`
  and `9d7d8ddc` on scratch/r53-pricing-7. NOTHING BUILT.
- **OWED ITEM DONE — cell-19 blocker removal RE-PROVEN with the flag
  live.** The shipped fixture fixes are ported to the scaffold, and both
  sides measured on ONE worktree: scaffold's ORIGINAL seed + leg (iii) =
  **21/1** (cell 19); shipped seed fix + leg (iii) = **22/0**; flags off =
  22/0. The blocker is retired on the branch that can actually test it.
- **THE HYPOTHESIS IS REFUTED.** The filler is NOT a reader of the
  published declaration. `validateLiveWeekOverlayWrite` — which matches the
  hypothesis exactly (reads `exposureContractV2`, early-returns without it,
  writes `workoutsByDate`) — prints **ZERO** times on this path. It reads
  the declaration as described and is simply not on the path.
- **THE FILLER, NAMED:** `buildFixtureProjection`
  (`acceptedStateTransaction.ts:2029`) → `buildWeekScopedWorkoutOverlay`
  (`weekRebuild.ts:217`, reason `one_off_no_game`), reached from
  `stageRollingHorizonFixtureRepair` and `commitProgramSetupRebuildTransaction`.
  It builds the payload from the REPLAN's own workouts, not from the
  declaration — so the publication's deliberate `{}` is overwritten
  afterwards by this rolling-horizon republish.
- **And it is NOT gated on the declaration:** overlays built = 84 flags
  off, 59 under leg (v), 59 under legs (iii)+(iv)+(v). It still runs. What
  leg (v) changes is whether the payload SURVIVES the transaction for that
  week (AFTER-txn `[]`).
- Also excluded: `additionalOverlays` never collide with the primary week
  (zero adjacent overlays here), and `commitWeekScopedOverlay` replaces
  wholesale — clause (c)'s merge re-confirmed innocent.
- **Back to the seat:** the correction's "no new ruling needed — build
  leg (iii)(+iv) first" branch does not apply *on its stated grounds*,
  because the filler never read the declaration. The convergence order may
  still be right; that is the seat's call. **Next question, now sharp:**
  why does the projection's payload fail to survive the COMMIT for that
  week under leg (v), when the projection still produces it? Condition 1's
  re-measure stays parked — the premise it waited on has changed.

## Processed 2026-08-07 (seventh pass) — the correction as the seat wrote it

- SEAT CORRECTION on answer 3 — read
   docs/R53_SEAT_ANSWER3_CORRECTION_2026-08-07.md, commit as authored.
   Short form: the seat's overreach attribution is withdrawn (code
   proved workoutsByDate:{} is landed behaviour; leg (v) was
   declaration-only all along). The leg (v) price was measured OUT OF
   THE RULED ORDER — the convergence ruling already predicted the
   contract dies by leg (iii), not leg (v). Ordered: run the sharp
   probe with the recorded hypothesis — the downstream filler is
   suspected to be the READER of the published declaration (the
   consuming half of the reconcile publishing hand-rolls,
   weekRebuild.ts:550-561 comment + four-leg price doc :180). Name
   it. If confirmed: no new ruling — build leg (iii)(+iv) first per
   the convergence order, leg (v) re-prices only after leg (iii)
   lands. If it is something else: STOP with it named. Condition 1's
   re-measure WAITS for the probe (leg (v)-alone configs measure a
   world the ruled order never produces). Also owed first: re-prove
   the cell-19 blocker removal by porting the seed fix to
   scratch/r53-pricing-7. Sam holds a veto.

## Processed 2026-08-07 (sixth pass) — the ruling as the seat wrote it

- SEAT ANSWERS to the fifth-pass boundary report — read
   docs/R53_SEAT_ANSWERS_2026-08-07.md, commit as authored. Short form:
   (1) clause (a)(2) WITHDRAWN by supersession — no reachable witness;
   dayPrecedence stays law, the conservation guard stays; if a
   REACHABLE world ever reds composed-vs-visible on an athlete
   decision it returns as its own unit. (2) Cell-19 witness fix =
   seed() through the owned doors (fixture-fidelity law), AND the
   one-door narrowing gate learns to scan TEST sources in the SAME
   unit — third fixture-manufactured misdirection this unit (cell-19
   carry-over, seedExactSundayRegression's borrowed fill, scaffold
   defect 4), so the compression ships with the fix, not later.
   seedExactSundayRegression's own fixture-fidelity fix is part of
   this unit's class. (3) Leg (v) RE-SCOPES to the DECLARATION only —
   workoutsByDate keeps publishing. Cited: the standing derivation
   ruling named "a stored representation feeding a computation" = the
   exposureContractV2 declaration, not the payload; R2 deliberately
   kept weekScopedOverlays; the fixture-identity law retires derived
   content only when re-derive-at-read provably reproduces it, and
   the freed-day measurement proves it does not yet. The payload
   emptying is option 2's scope switch reaching past the ruled
   target. Re-price leg (v) on the new scope; the prior refutation is
   SET ASIDE as scaffold-priced. Order: witness fix + gate extension
   -> leg (v) re-scoped re-price -> re-measure priced configs ->
   build per the convergence ruling. Sam holds a veto on all three.

## Processed 2026-08-07 (sixth pass) — SEAT ANSWERS

- Ruling committed as authored (`81beac19`). Answered in
  docs/R53_WITNESS_FIX_BUILT_LEGV_RESCOPE_REFUTED_2026-08-07.md.
- **ANSWER 2 BUILT AND GREEN** (`6f3a2a7a`, `766fe81a`). `seed()` retires
  the previous world first and writes through the one door, then ASSERTS
  it holds what it asked for. The narrowing gate walks `src/__tests__` +
  `src/dev` and checks the census in BOTH directions — undeclared fails,
  and a declared entry that no longer writes ALSO fails, so paying debt
  forces the declaration down in the same commit. Mutation-proven both
  ways, plus non-vacuity. 54 files/~75 sites declared as DEBT; the
  narrowing suite's writes are its INSTRUMENT; fault injection must carry
  `PROFILE-DOOR-BYPASS: fault injection` so the category cannot host a
  seed. `seedExactSundayRegression` now reads the DERIVED week first —
  proven byte-identical (`identicalJSON: true`), coordinate intact.
  Gate: full test:bible UNPIPED, EXIT 1 on test:fixture-identity 3/3 (the
  branch's pre-existing red, verified at HEAD in a clean worktree); the 18
  suites the bible cannot reach were run individually, 18/18 pass.
- **ANSWER 3 STOPPED — the re-scope has nothing to narrow.** The ruling
  held that the empty payload was "option 2's scope switch reaching past
  the ruled target". The code says otherwise: `workoutsByDate: {}` at
  `weekRebuild.ts:564` is **UNCONDITIONAL**, outside leg (v) entirely, and
  its own comment argues for it; leg (v)'s whole product delta is
  `exposureContractV2: undefined`. `commitWeekScopedOverlay` REPLACES
  wholesale, so clause (c)'s merge is innocent too. **Leg (v) is already
  declaration-only.** The payload loss is therefore a CONSEQUENCE of
  retiring the declaration — which means the fixture-identity test the
  ruling itself cited is failing for a REAL reason, and the prior
  refutation should NOT simply be set aside as scaffold-priced.
- **Next probe, now sharp:** what fills `workoutsByDate` after a
  publication that writes `{}`, and why does removing `exposureContractV2`
  stop it? That names the freed day's real owner and decides leg (v)'s
  price. Condition 1's re-measure NOT run — it would measure against a
  premise in question.
- **Correction owed to the record:** leg (iii)'s blocker removal is proven
  only on the scaffold's earlier probe. `LFA_SCAFFOLD_LEG_III` does not
  exist on feat/r53-v3-switchover, so any "leg (iii) green" run on this
  branch is INERT. Re-prove by porting the seed fix to the scaffold.

## Processed 2026-08-07 (fifth pass) — SAM'S LEAD

- Answered in docs/R53_FREED_DAY_PRODUCER_NAMED_2026-08-07.md; probe at
  `a7b49764` on scratch/r53-pricing-7. NOTHING BUILT.
  **The lead was right about the law and narrowed the search correctly,
  and the producer is ONE HOP downstream of the pathway it named.**
  The release pathway is INNOCENT: distinct release records are 52
  flags-off vs 46 leg (v), with **0 present only in leg (v)** — a strict
  subset (leg (v) fails earlier, so raw counts would have lied). Every
  record agrees: `byeUsualGameDay: true`, `releasedFixtures:
  ["2026-07-18:game:bye_usual_game_day"]`, capacity 6.
  THE PRODUCER: the published overlay's **`workoutsByDate`**. The overlay
  is still PUBLISHED in both worlds — which is why the earlier probe saw
  `contractSource: overlay` on both sides and could not attribute the
  difference; the premise that leg (v) removes the overlay was wrong.
  Flags-off it carries `2026-07-18:Hard Conditioning`; under leg (v) it is
  `[]` and the accepted week drops from 6 sessions to 5.
  AND the 16 deletion failures are FIXTURE debt: all run through
  `seedExactSundayRegression`, which reads that Hard Conditioning purely
  as a TEMPLATE to clone into days it then OVERWRITES — depending on the
  very fill Sam ruled a bug on 2026-08-06.
  **Back to the seat:** (i) is leg (v) meant to retire the overlay's
  workout PAYLOAD or only the `exposureContractV2` declaration? That one
  answer re-prices leg (v). (ii) If only the declaration, the emptying is
  a scaffold defect and leg (v)'s refutation was priced against it.
  (iii) `seedExactSundayRegression` needs its own fixture-fidelity fix.
  Clause (c)'s `commitWeekScopedOverlay` probe COLLAPSES into this, as the
  lead anticipated — probe it as one question, not two.

- The lead as the seat wrote it, kept verbatim for the record:
   SAM'S LEAD on the freed-day producer (2026-08-07, coaching knowledge,
   check FIRST before the commitWeekScopedOverlay probe): "if a game is
   removed it can be replaced by hard conditioning." That is the Bible's
   bye/fixture-release law (:164, :4670, :4676 — the released usual game
   day hosts the hard replacement exposure). The producer to check is
   whatever IMPLEMENTS that law — the fixture-release pathway, NOT the
   core-shortfall repair already cleared. Named sites:
   src/rules/fixtureConditionedAvailability.ts (builds releasedFixtures
   + bye_usual_game_day provenance, and itself calls targetWeekFixtures
   — the same projection as diagnosis (a)) and its bye_usual_game_day
   consumer at src/utils/fixtureMinimalReplan.ts:249, consumers in
   sessionResolver/weekRebuild/coachingEngine. Probe: does THIS pathway's
   input differ between the two worlds (via the overlay merge of the
   published field)? If it names the producer, the overlay-merge probe
   collapses into it. Attribution before build, as ruled.

## Processed 2026-08-07 (fourth pass)

- The projected-anchor precedence ruling (`d6efec30`) — committed as
  authored, per (d). Answered in
  docs/R53_RESIDUAL_CLOSED_OVERWRITE_UNREACHABLE_2026-08-07.md; probe
  preserved at `1198cb95` on scratch/r53-pricing-7. NOTHING BUILT.
  (b) RESIDUAL CLOSED: **store carry-over**, and the vector is a product
  path — `seed()` writes `onboardingData` directly, the profile mirror
  fence republishes the PREVIOUS cell's accepted snapshot over it because
  `seed()` sets programStore on the next line. In-suite the write does not
  take at all (`isTheAthleteObject: false`); isolated it does. So cell 19
  ran on an In-season/Saturday profile it never seeded.
  The 2×2, isolation inert flags-off: flags-off 22/0 both ways; leg (iii)
  21/1 without isolation, **22/0 with**. The named blocker "leg (iii)
  alone regresses cell 19 in every priced config" is **DISSOLVED** — it
  was the fixture, not leg (iii).
  (a) PREMISE REFUTED. In the coherent world the ruling reasoned about
  (In-season, `usualGameDay: Saturday`, zero marks) the move onto the
  projected game day is REFUSED — "It's game day — sessions can't be
  changed or added here" — with the visible week unchanged and no content
  loss; the non-anchor control move applies and lands. The
  composed-vs-visible overwrite exists ONLY in the manufactured
  contradiction, so clause (a)(2)'s systemic dayPrecedence fix would build
  on coordinates nothing reaches. **Back to the seat**: withdraw or re-aim
  (a)(2); rule on the FORM of the witness fix (`seed()` through the
  one-door law, not the probe's poke); re-run condition 1's pricing now
  the cell-19 blocker is gone.
  (c) untouched and still owed — now superseded in ORDER by Sam's lead.
  Named not fixed: the one-door narrowing gate does not scan test sources,
  which is what let this fixture manufacture an unreachable state.

## Standing
- Update docs/NOW.md at every checkpoint. Answer inbox items in
  boundary reports.
- FORMAT LAW (2026-08-07, Sam-forced after the seat ignored its own
  sweep rule): every seat order and every boundary report OPENS with
  one line — "LOOP CHECK: <shape of this work> — sighting N — iterate
  or compress". An order or report without that line is malformed and
  gets sent back, by either side. Sighting 2 of any shape = the
  compression is ordered, not the iteration. This line exists because
  reminders don't execute; a required field does.
