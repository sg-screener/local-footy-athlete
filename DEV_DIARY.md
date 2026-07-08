# Local Footy Athlete — Dev Diary

A plain-English log of what got built, why it matters for the app, and what's
next. Written so anyone can read it — no jargon, no code. Newest entries at
the top.

---

## Thursday 9 July 2026 — The word "tempo" means tempo again (Phase 4B)

**What happened.**
Phase 4A retired the word "tempo" because the app was using it as a
costume for genuinely hard VO2 work. Phase 4B brings tempo back as a real
thing: a MEDIUM conditioning category — controlled repeat efforts at
6-7/10, "worked but composed, never gasping". It sits between easy
aerobic and the hard stuff, with its own honest templates: 30:30 Tempo
Blocks, 1min-on/1min-easy Tempo Intervals, Bike/Row/Ski Tempo Intervals,
and running Cruise Intervals. None of the old hard sessions (1km repeats,
4x4s, MAS, 200-400m) are allowed to wear the tempo name.

The clever part is HOW tempo enters a week. It is not a fifth box the
planner must tick — cramming five energy systems into a real week is
impossible and an early attempt at that broke the signed-off weekly
rhythm (it stole Saturday from strength and pushed lifting onto the
Sunday rest day; caught by the sequencing tests and reverted). Instead,
tempo is the middle rung of a downgrade ladder inside the one finisher
law: when the scheduler wants hard conditioning but the day can't safely
take it, the request steps down to tempo first, and only falls to easy
aerobic when the day demands it. Weeks stopped collapsing to "all easy" —
the highest useful recoverable dose, not the lowest compliant one.

The guardrails all still win: nothing above easy aerobic near games, on
or next to team training days (finishers), on lower/hinge days, or for a
low-readiness athlete. Standalone tempo is off-feet (bike/row/ski) first;
actual running tempo is only prescribed in a clean pre-season week — good
base, fresh, uninjured, legs not already saturated by field sessions.
That run-vs-off-feet call now travels on a typed field, not buried in
label text.

**Visible changes:** S6's off-season week now carries two upper-day tempo
finishers (medium days) alongside its easy lower-day finishers; a clean
pre-season week earns a standalone running tempo session on Saturday;
TT-heavy and low-readiness weeks look exactly as conservative as before.

**Known pre-existing wobble (not new, not fixed here):** the six-day
pre-season no-team week rests Wednesday instead of training through it —
that sequencing quirk predates 4B and is logged for later.

---

## Thursday 9 July 2026 — Finishers stop sneaking past the rules (Phase 4A)

**What happened.**
The main scheduler has respected the Bible since Option B — but the four
"repair" passes that bolt conditioning finishers onto strength days each
carried their own partial checklist, and things kept slipping through:
sprint finishers on hinge days, hard work next to team training, and
"tempo" labels hiding hard VO2 blocks.

Now there is ONE shared finisher law (`finisherEligibility`) and every
attachment path passes it: the in-loop combined-day picker, both
minimum-conditioning repair passes, and Sprint Rescue. The law knows the
day's strength pattern, game proximity, team-training adjacency, season
phase, readiness, and the week's hard-day headroom — and it prefers
downgrading an unsafe finisher to easy off-feet aerobic over deleting it.

The big v1 calls, per Sam: **no automatic sprint finishers at all** —
sprint belongs to team training, games and dedicated speed sessions;
Sprint Rescue may only claim a standalone conditioning slot, and if no
safe one exists (off-season has no "late block" model yet; team weeks
already sprint at training), sprint is dropped honestly instead of hidden
in a finisher. Lower and hinge days now only ever get an easy off-feet
finisher. And label honesty: VO2 work now says "VO2 / hard repeat
effort" — the word "tempo" is retired until a true tempo category exists.

**Visible changes:** S6's off-season week traded its sneaky sprint/VO2
finishers for honest easy-aerobic ones; S11's Monday lower now carries an
easy off-feet finisher instead of a hidden VO2 block.

**One thing surfaced, not fixed (backlog):** the in-season BYE week
builds six strength-classified sessions — that's the old bye branch being
measured properly for the first time, not a finisher problem.

**Proof.** New 24-test finisher suite + whole board green: 70/41/25/35/
43/22/24 + QA 163, typecheck clean.

---

## Wednesday 8 July 2026 (midnight oil) — "I'm not 100%" gets a front door

**What happened.**
The wellbeing flow existed but was buried inside a day's session sheet —
a product problem, since readiness is usually a week-level call. The
Program screen now has a visible "I'm not 100%" card, styled identically
to "Busy or away this week?" (same shared card system as the practice-
match button), sitting between it and the practice-match card, in every
season phase.

Tapping it opens a simple sheet: feeling sore/tight, low energy/tired,
sick/run down, niggle or injury, need an easier week. No chat, no AI.
Under the hood it reuses the exact modifiers the day sheet already
creates — "Load reduced this week" or "Recovery mode active" — scoped to
whichever week you're looking at (the modifiers were already week-keyed
by date; nobody had ever pointed them at a future week before). The
injury option opens the same guided injury flow as everywhere else.

While active, the card flips to "Not 100% this week" / "Recovery mode
this week" and the sheet offers Update and Clear. Clearing removes just
that week's readiness note — busy/away, games and manual edits untouched,
which the tests prove by stacking all three on one week and rebuilding
through the canonical door.

**Proof.** New 22-test suite: week-scoped modifier creation with correct
expiry, Coach Note appears, stacks with away + practice match through a
full rebuild, clear removes only itself, day-level flow untouched, network
disabled throughout. Full board stays green (43/35/70/41/25/24/163).

---

## Wednesday 8 July 2026 (encore) — The real culprit was hiding in the store

**What happened.**
Sam's live test proved the resurrection bug was STILL alive: remove a
future Monday, add a Saturday practice match, Monday comes back. All the
sweep logic from earlier today was correct — and it never stood a chance.

The real culprit sat one layer deeper: the program store's own
`setCurrentProgram` silently wiped every per-date override the moment any
rebuild committed a new program ("new block = fresh slate", written long
ago). The preservation sweep would carefully decide to keep Monday's
removal — and then the store setter destroyed it anyway. Our earlier
tests passed because they exercised the sweep helper directly and never
went through the store setter: exactly the class of gap Sam called out.
The new tests drive the REAL taps end to end, which is how the bug was
finally reproduced and pinned.

The fix is architectural, as demanded:

1. **One canonical rebuild door** (`utils/weekRebuild.ts`): every rebuild
   assembles the full week context — profile + game overlay, every
   override with its ownership metadata, every live Coach Note constraint,
   the new game anchors — builds the candidate week, runs the pure
   preservation policy, and commits game mark + program + sweep in one
   atomic step. The home screen can no longer rebuild any other way, and
   the AI path (onboarding/phase-shift) commits through the same policy.
2. **The store setter no longer wipes overrides.** Clearing is a
   decision, not a side effect. The three places that genuinely want a
   fresh slate (onboarding completion, manual program creation, profile
   reset) now say so explicitly, and the coach's setup-edit rebuild got
   the same preserving sweep.
3. **Static architecture guards**: tests fail if the home screen ever
   calls the generator or a raw sweep directly again.

**Proof.** A new 43-test integration suite drives every real removal path
— Busy/Away, bin, swap-to-recovery, move, manual add, low readiness — in
BOTH pre-season and in-season, on future weeks, then adds the Saturday
game and rebuilds twice: nothing resurrects, notes stay truthful, unsafe
edits near the game are removed out loud, and the network stays off. Full
board green: rebuild suites 43 + 35, kernel 70, validator 41, stress 25,
coach-updates 24, QA 163.

---

## Wednesday 8 July 2026 (last call) — Rebuilds now respect everything you told the app

**What happened.**
A follow-up audit on the rebuild sweep asked the obvious next question:
fine, away days survive — but what about the athlete's own manual edits?
The audit proved a gap: binned, moved, swapped and manually added
sessions were still being silently wiped by every rebuild (as they always
had been, even before this week's fixes).

The sweep now implements the full three-tier policy: (1) Coach-Note-owned
overrides survive while their note is active (away/busy days, injury
swaps, recovery mode); (2) the athlete's manual edits — bin, move, swap,
add, exercise changes — always survive; (3) only system artifacts are
cleared (old pre-game conversions, orphaned leftovers whose note was
cleared, contextless legacy overrides).

And when a preserved manual edit collides with a newly added game — say a
hand-added MetCon sitting on the day before the new match — the app
resolves it deterministically using the Bible stress model: anything on
the game date or hard work within two days of it is removed, and an alert
tells the athlete exactly what was removed and why. Light edits near the
game (a gunshow swap on match eve) survive untouched. Protect the game,
never silently.

Readiness / "I'm not 100%" adjustments were confirmed safe by design —
they live in the constraints store the sweep never touches — and a static
test now guarantees no rebuild path can quietly go back to the old
blanket wipe (that stays reserved for intentional profile resets).

**Proof.** Rebuild suite now 35 tests: bin survives, swap survives, hard
G-1 addition removed-and-reported, light G-1 edit survives, game-date
override removed (it would have hidden the game entirely), readiness
constraint untouched. Full board green: kernel 70, validator 41, stress
25, coach-updates 24, QA 163.

---

## Wednesday 8 July 2026 (nightcap) — Rebuilds stop steamrolling "Away this week"

**What happened.**
Live testing found the new instant game-day rebuild had a memory problem:
mark Monday as away (Coach Note appears, Monday clears), then add a
Saturday practice match — and Monday's session quietly came back while
the note still said "Away this week". Program and Coach Notes disagreed.

Root cause: away days live as per-date overrides owned by their Coach
Note, and every rebuild wiped ALL per-date overrides to make room for the
fresh template — including the ones that represent live promises to the
athlete.

The fix is a smarter sweep: rebuilds still clear stale overrides (old
exercise swaps, protection for a game that moved), but any override owned
by a still-active Coach Note — away days, injury swaps, recovery mode —
now survives every rebuild. Clear the note and the next rebuild releases
the day, exactly as the note's copy promises. This applies to all rebuild
flavours (game taps, phase shifts), so the note and the program can no
longer drift apart through this path.

**Proof.** The game-rebuild suite grew to 26 tests, including the exact
repro: future week, Monday away, add Saturday match → Monday stays
blocked, Saturday is Game Day, Friday stays light, note still active; and
clearing the note releases Monday on the next rebuild. Full board green:
kernel 70, validator 41, stress 25, coach-updates 24, QA 163.

---

## Wednesday 8 July 2026 (final) — Game-day taps no longer phone the AI

**What happened.**
Live testing caught a big one: tapping "Add a pre-season practice match"
showed the Game Day card, but the week never reshaped — because the
rebuild was calling the AI coach over the network, and OpenAI timed out
after 55 seconds. Worse, the game mark had already been committed, so the
athlete saw a half-updated week: Saturday said Game, Friday still said
Upper Push + Hard Conditioning.

Two principles restored:

1. **Tap edits never depend on the AI.** There's a new fully local
   program builder — same coaching engine, same normaliser, zero network.
   It turned out 95% of it already existed: the client has always been
   able to complete missing days deterministically when the AI omits
   them; we now simply hand it an empty AI response and let it build the
   whole week. Adding, moving and removing a game (in-season and
   pre-season) all use this instant path now. Onboarding and phase
   shifts still use the richer AI path.

2. **All or nothing.** The game mark now commits *inside* the rebuild's
   success path — the week is built first, and only then do the Game Day
   card and the reshaped program land together. A failed rebuild changes
   nothing.

Two classifier gaps found by the new tests and fixed along the way: a
session named just "Lower Body Strength" (no squat/hinge words) lost its
strength classification, and the generic fallback was putting bench/
overhead press on the day before a game — that slot now correctly builds
a Gunshow.

**Proof.** New suite (19 tests) runs with the network literally disabled —
add Saturday match → Game Day appears, Friday goes light, 3 strength
exposures, 4 hard days, zero validator findings; move to Sunday and
remove-game both reshape correctly; in-season behaviour unchanged. Full
board: kernel 70, validator 41, stress-placement 25, QA 163 — all green.

---

## Wednesday 8 July 2026 (evening polish) — Practice-match button dressed properly

Tiny UI fix: the new "Add a pre-season practice match" card (Codex's
addition) looked off because its styles were referenced but never actually
defined — the trophy floated loose and nothing lined up. It now reuses the
exact same card, row, icon-circle and text styles as "Busy or away this
week?", with just the game-day orange tint and trophy icon swapped in —
one shared style system, so the two cards can't drift apart again. Still
pre-season only.

---

## Wednesday 8 July 2026 (latest) — The engine learns that upper body isn't leg day (Option B)

**What happened.**
The deepest change of the day, approved as "Option B": the engine stopped
treating every strength session as equally stressful. Upper-body strength
is now medium stress; lower body, hard full-body work, hard conditioning
and sprinting are high stress; and the guards that protect athletes from
brutal weeks now count *high-stress days*, not "any gym day".

Why it matters: the app's goal is the highest useful dose an athlete can
recover from, not the lowest compliant one. Before this, a healthy
pre-season athlete with two club sessions and a Saturday game collapsed
to ONE strength session — the old model priced an upper session on a
team-training night as if it created a brand-new hard day.

What changed under the hood: a stress table for every session type; the
consecutive-day guard rebuilt around high-stress days (so team training +
Wednesday upper + team training is legal, while lower or hard intervals
in that spot stay banned); the weekly hard budget no longer charges upper
work stacked on an already-hard team day; and game weeks now put lower
strength early and upper pull/push on the team days. Sam refined the
sandwich rule mid-flight: hinge-heavy lower, hard conditioning and sprint
NEVER sit between two team sessions in any phase, but a controlled
full-body is allowed there when it's genuinely the only gym day.

Three older passes were caught bypassing the rules and brought into line:
the sprint-rescue pass no longer retrofits sprints onto game weeks or
team-adjacent days, finishers can't attach to team days, and lower
strength can never stack onto team training in any phase (Sam's guardrail).

**The payoff.** S11 now generates exactly Sam's target: Mon lower, Tue
team + upper push, Wed recovery, Thu team + upper pull, Fri gunshow,
Sat game, Sun recovery — three proper strength exposures, four hard
days, zero validator findings. And S7 (off-season, three club nights)
quietly improved too: its hinge day moved off the team session and the
old three-hard-days-in-a-row opening is gone, with identical findings.

**Proof.** New suite: 21 stress-placement tests. Full board: kernel 68,
validator 41, QA sweep 163 across 17 scenarios, all green; in-season
scenarios byte-identical; low-readiness athletes still get the reduced
dose. This is a real behaviour change to generated weeks — worth a live
Simulator look before shipping.

---

## Wednesday 8 July 2026 (late) — Game-day protection works in every phase now (S11)

**What happened.**
The last real catch from the validator sweep is fixed: pre-season weeks
with a game were putting a full leg session on the day before the match.
The cause was one gate — the engine's game-aware placement only switched
on in-season, so a pre-season game week was planned as if no game existed.

The fix, in the engine only (approved scope):

1. **H-GAME hard rules** in the pre/off-season allocator: nothing hard on
   game day or the day before (those days fall through to light
   accessories/recovery), and no dedicated heavy lower or hard
   conditioning two days out. Enforced in every mode, including the
   "must place required movements" fallback — a required session gets
   moved or swapped, never forced into the pre-game window.
2. **Two bypass routes closed:** the post-pass that promotes spare days
   into conditioning, and the one that bolts finishers onto strength
   days, both now respect the game window too.
3. **No lost strength:** when the squeeze leaves a game week without any
   leg work (the only free mid-week day sits between two hard club
   sessions), the earliest safe upper session becomes a full-body session
   — patterns covered, nothing deleted. Any hard finisher it carried is
   downgraded to an easy aerobic one, per the "full body + easy only"
   pairing rule.

**S11 before:** Mon upper, Fri full lower (day before the game!).
**S11 after:** Mon full body + easy finisher, Wed recovery, Fri recovery,
game protected on every side. QA now guards "no heavy lower within 72h"
and "G-1 light" for every phase with a game, not just in-season.

**Proof.** Kernel 68, validator 41, QA sweep 163 across 17 scenarios —
all green. Pre-season-no-game and all in-season weeks untouched. The only
remaining S11 note is an info-level "1 main strength session" — the
honest trade-off of a safe week with two club sessions and a game.

---

## Wednesday 8 July 2026 (night) — The fix that was already built (S6 conditioning)

**What happened.**
Today's approved job was to make sure a 4-day off-season athlete doesn't
get zero conditioning just because strength fills every available day.
The plan was to teach the engine to attach conditioning finishers to
strength days. The investigation found something better: **the engine
already does this** — and almost exactly by Sam's rules. For the S6
athlete it attaches a short sprint finisher to Monday's upper day, a
tempo finisher to Friday's upper day, an easy zone-2 finisher to
Saturday's squat day, and deliberately leaves the Wednesday hinge day
clean. Three full rest days survive. No engine code was needed, and
none was written.

So why did the report say zero conditioning? Two measurement bugs:

1. The QA rig (again) dropped the "this day has a conditioning finisher"
   metadata when rebuilding weeks — now carried properly.
2. A real classifier bug: any strength session whose description mentions
   the word "accessory" (e.g. "…optional quad accessory: leg extension")
   was being classified as a Gunshow pump session — hiding both the
   strength work and its finisher from every count. Fixed so gunshow only
   matches when the session isn't a real strength day, with regression
   tests both ways.

**S6 before/after (as measured):** 0 conditioning exposures → 2
conditioning + 1 sprint exposure, 4 strength sessions kept, 4 hard days
(at target, not over), 3 true rest days. A new permanent QA check keeps
every off-season athlete at 2+ conditioning exposures.

**Two judgement calls flagged for Sam (existing engine behaviour, not
changed):** the Monday finisher is a hard little sprint session on an
upper day — Sam's pairing rules cap upper-day add-ons at tempo/moderate,
and the Bible keeps off-season sprinting for the late block; and the
Friday "tempo" finisher is internally categorised as VO2 (hard), which
quietly makes that day a hard day.

**Proof.** 68 kernel tests, 41 validator tests, 161 QA assertions across
17 scenarios — all green, typecheck clean.

---

## Wednesday 8 July 2026 (evening) — Trust the referee: false alarms fixed, real ones found (Phase 2.5)

**What happened.**
Two follow-ups to the new weekly validator, both approved by Sam.

First, the hard-day rule got Sam's real intent instead of a blunt cap:
4 hard days is the clean target, 5 is the absolute edge (a gentle note,
firmer in-season where games and club training already load the week),
and 6+ is a genuine warning. The message now nudges toward the smarter
answer — stack compatible work onto fewer days so athletes keep true
rest days — rather than just "train less".

Second, detective work on the validator's first catches showed two of
three were false alarms caused by the QA test rig, not the app: the rig
was shortening session names and dropping the "this is club training"
flag, so Thursday team training (which mentions sprinting in its
description) looked like a forbidden sprint session two days before a
game. The rig also ignored each athlete's chosen training days, letting
imaginary sessions land on days real athletes never made available.
Both rig gaps are fixed, the classifier now recognises anything named
"Team training…" even with a mangled label, and two permanent guard
checks in QA make sure these false alarms can never quietly return.

Fixing the rig also un-hid three whole scenarios that had been silently
erroring for a while — and one of them revealed a real catch: **pre-season
weeks with a Saturday game put lower-body strength on the Friday** — the
one day the Bible says must be easy. That, plus off-season athletes with
few gym days getting zero conditioning (because the app can only fill
empty days, not stack), goes on the list for the Phase 4 conditioning/
scheduling alignment work.

**Proof.** All suites green and bigger: 66 kernel tests, 41 validator
tests, 158 QA assertions across 17 scenarios — zero failures, zero false
positives.

**Next.** Phase 4 plan when Sam's ready: pass-2 hard-day budget, rest-day
preservation, generation-time stacking, and the pre-season G-1 lower fix.

---

## Wednesday 8 July 2026 (later) — The week gets a referee (Phase 2, report-only)

**What happened.**
Phase 2 of the Programming Bible work: a weekly-structure validator that
reads any week — generated or edited — and reports where it breaks the
Bible's rules. Like Phase 1, it changes nothing: it produces findings and
log lines only. No warnings block anything, no schedules move.

What it checks: game-day spacing (day before a game must be light; two
days before means no full leg session and no hard conditioning except
normal club training; day after a game means rest or recovery), the weekly
caps (max 4 strength, max 4 running, max 4 hard days, 2-3 sprint, 3-5
conditioning), that team training is never treated as recovery, risky
same-day pairings (heavy hinge + sprinting, hard change-of-direction +
heavy legs, and lower + upper as two separate full sessions), and a gentle
minimum-week check that deliberately goes quiet during busy, sick, injured
or bye weeks — nobody gets nagged for having a life.

Findings come in four levels: info, soft warning, strong warning, and
hard stop — with hard stop strictly reserved for true safety situations
(it never fires for programming-risk issues; those are strong warnings the
athlete can override).

Nice touches: days can now hold multiple sessions (so double days are
judged properly), the Bible's tiny "neural primer" exception is honoured
(2×3 box squats two days out is fine; anything bigger isn't), and games
from last week still protect Monday.

**Where it watches from.** Three log-only lookouts: every freshly
generated plan, every applied coach edit (chat and tap sheet both funnel
through the same writer), and the QA harness, which now prints a Bible
report per scenario.

**First catches.** The QA sweep immediately found real issues to review:
some off-season plans run 5-6 hard days (Bible max is 4), and two
in-season personas get sprint work placed two days before their game.
Exactly the kind of thing the validator exists to see. These are reports,
not failures — fixing the generator is future-phase work.

**Proof.** 35 new validator tests pass, Phase 1's 65 still pass, the
writer's 34 still pass, and the freshly generated baseline in-season week
comes back with zero findings.

**One correction.** Yesterday's note said `test:qa` was clean — in truth
that script's compile step has been broken since before this work (two
pre-existing type errors), so it never actually ran. The harness runs fine
through the same runner every other test uses, which is how the Bible
report above was produced. Worth fixing the script sometime.

**Next.** Review the QA findings, then decide what Phase 2b enforcement
should look like — that needs its own plan and sign-off.

---

## Wednesday 8 July 2026 — The Programming Bible gets a rulebook in code (Phase 1)

**What happened.**
Sam handed over the full LFA Programming Rules ("the Bible") — the document
that defines how a smart footy S&C coach builds a week. Today the first
piece of it moved into the app as a small, read-only "rules kernel"
(`src/rules/`). Read-only is the point: nothing about how programs are
generated, scheduled, or edited changed today. The app just got the ability
to *look at* any week and describe it the way the Bible does.

What the kernel can now do:

1. **Name every session properly.** Each day gets classified into the
   Bible's session types — lower/upper/full-body strength, gunshow,
   recovery, easy/tempo/hard conditioning, sprint, team training, game,
   rest. Combined days ("Team Training + Upper Push", "Lower + flush")
   correctly count as two things, not one.

2. **Say how hard each session is.** High / medium / low stress, with the
   Bible's context shifts: upper body is high stress for a complete
   beginner, tempo running is high stress for an unfit runner, light team
   training drops to medium.

3. **Count the week like a coach.** Hard exposures, hard days, main
   strength sessions, conditioning load (team training and games count),
   running exposures (bike/erg work doesn't), and sprint/COD exposures —
   then compare against the Bible's weekly caps (max 4 strength, max 4
   running, max 4 hard days, 2-3 sprint, 3-5 conditioning) and *report*
   any breaches. Report only — no enforcement yet.

4. **Carry the Bible's injury bands.** The 1-3 / 4-5 / 6-7 / 8-10 severity
   bands are now defined as shared constants with tests. Deliberately NOT
   wired into live injury behaviour — that migration is its own later phase.

5. **Phase set/rep tables as data.** In-season 3x3, pre-season 3x5,
   off-season 3x8 (pulls tolerate more reps) — stored, not yet consumed.

**Proof it works.** 65 new tests pass (`npm run test:rules-kernel`),
including a live run: the engine generated a real in-season week (Saturday
game, Tuesday/Thursday training) and the kernel counted it — 4 hard days,
3 strength sessions, 3 running exposures, zero cap breaches. The Bible's
own "Option 1" ideal week counts out exactly as the document says it should.

**Bonus catch.** The very first live count exposed a classifier trap: a
recovery ride named "easy bike/row" was being read as an upper-body pull
day because of the word "row". Fixed systemically in the classifier (with a
regression test), not with a one-off phrase patch.

**Next.** Phase 2 — a weekly-structure validator built on these counters
(game-day spacing, double-day legality, caps) — needs its own short plan
and Sam's sign-off before any wiring into generation.

*(Note: `test:injury-engine` shows 2 pre-existing failures at the last
commit, 3 with the uncommitted role-bucket work in the tree — none related
to today's change; worth a look next session.)*

---

## Tuesday 7 July 2026 — Real-life gaps closed (Stage 2F)

**What happened.**
After the audit found where the tap-first app still quietly did the wrong
thing, today we fixed the four that mattered most for real athletes — all
without touching the AI coach.

1. **"I'm not 100%" now honestly means "today".** Before, you could tap a
   day later in the week, say "I'm injured", and the app would change
   *today* while showing that other day — a silent mismatch. Now the
   feeling check always applies to today, says so plainly ("How are you
   today?"), and only appears when today is on screen. No more sleight of
   hand.

2. **Busy or away this week — finally a real button.** There's a new
   "Busy or away this week?" option on the plan. Two roads: *busy* keeps
   you training but lightens the whole week; *away* lets you tick the exact
   days you can't make it and clears them. Either way you get a Coach Note,
   your week updates on the spot, and clearing the note brings the cleared
   days back. No more being pushed into the chat coach for a hectic week.
   (The plumbing existed but was wired to a dead screen — now it's live.)

3. **Missed a session? The app notices.** If a training day slips past
   without being logged, the plan now asks "Did you do Tuesday?" with four
   taps: *Did it*, *Missed it*, *Move it forward*, *Skip it*. Each one
   feeds the same feedback/plan machinery — "did it" lets your loads keep
   climbing, "missed it" holds them steady, "move" shunts the session to
   your next free day, "skip" bins it. The app's picture of your week
   stops drifting from reality.

4. **Clearing adjustments actually clears everything.** The Profile
   "clear active changes" button used to leave tired/recovery/busy notes
   behind in some cases. Now it clears them through the exact same path as
   the per-note button on your plan, and old, dormant "feeling" signals
   get tidied up automatically instead of piling up forever.

**Numbers for the nerds (skippable):** typecheck clean; the tap-producer,
control-action, Coach-Notes, team-training and reset suites all green
(plan-change producer 186, control actions 112, Coach Notes 83), plus a
new missed-sessions suite (10) and new busy/away + clear-days coverage.
Everything runs through the same validate → apply → Coach Note pipeline,
so a tap still can't corrupt a plan and nothing routine drops you into
chat.

**What's next.** Live-verify on the simulator after a Metro restart, then
the remaining audit items in order: equipment as a real input, real
set/rep numbers for one-off strength, and the dead-code cleanup.

---

## Friday 3 July 2026 — The coach learns Sam's conditioning philosophy

**What happened.**
Yesterday the coach learned to be honest. Today it learned to coach like
Sam. We sat down and wrote out how conditioning should actually work across
a footy season — and then built it into the app.

The rules, in plain English: during a normal game week the body needs to
recover, so the coach will only add easy "flush out" sessions — gentle
bike, row or ski work that helps you bounce back. But on a bye week, with
no game to save your legs for, the gloves come off: the coach unlocks two
proper hard sessions — an every-minute-on-the-minute erg grinder and a
"MetCon" of hard machines, carries and burpees — to simulate that game-day
hit the body would otherwise miss. The app works out for itself which
weeks are bye weeks. The AI doesn't get a say in breaking the rule — the
app enforces it, so a hard session physically cannot land on a game week.

Watching it work live was genuinely cool: asked for hard conditioning on
Saturday (a bye), it offered the menu; picked the MetCon; it asked "want
me to swap in MetCon — Off-Legs on Saturday? (yes/no)"; said yes; it was
on the board two seconds later. Then asked for the same thing NEXT
Saturday — a game week — and it politely refused, explained why, and
offered the easy options instead. That's exactly what a good human coach
would do.

**A bug caught before Sam ever hit it.** In testing, picking an option
from the coach's menu ("MetCon please") hit a dead end — the app dropped
the choice instead of asking for the yes/no. Turned out two code paths
were doing the same job slightly differently. Fixed by making them share
one path, with a test so it can never quietly come back. This is the
whole philosophy of the rebuild: don't patch the symptom, remove the
duplicate.

**Also fixed the invisible-updates trap.** Twice now, the app was
secretly running yesterday's code while we tested today's — which makes
test results meaningless. The app now stamps every coach reply in the
logs with a fingerprint of what's actually running, so a stale build
exposes itself immediately instead of wasting a morning.

**What's next.**
Sam feeds in more work-capacity sessions over time and the menu grows.
Bigger picture: teach the program generator itself the running rules
(max 4 runs a week, in-season running only around training and game
days) — that one needs a proper plan first, it touches the engine that
builds the whole week.

---

## Thursday 2 July 2026 — The day the AI coach got a brain transplant

**What happened.**
Huge one. Started before sunrise, wrapped mid-afternoon. Claude Fable 5 came
out, and after weeks of hitting the same wall with the old setup, I grabbed
the subscription and pointed it at the problem.

The old system had the AI coach's changes passing through about fifteen
different layers of checks and translations before anything touched the
program. Each layer could have its own bugs, and worse — they could disagree
with each other. The AI would understand me perfectly ("drop the lower work
Monday but keep the flush") and then some layer downstream would mangle it
into the wrong change, or block it, or claim it was done when nothing
happened. Whack-a-mole for weeks.

Today we replaced all of that with one source of truth: the AI looks at the
exact program the athlete sees, proposes the new version of it, and the app
checks that proposal against hard rules before anything is saved. One
representation of the change, checked once, applied once, verified on screen.

**What the coach can do now (all tested live, on the actual app, today):**
- Remove a session or part of a session ("bin tomorrow's session")
- Make a day lighter without deleting anything
- Move a session to another day ("move Friday's session to Wednesday")
- Swap a session for an approved easy-conditioning option — and it asks
  "want me to?" before doing it
- Route big schedule changes ("I can only train Mon/Wed/Fri now") into a
  full program rebuild
- Answer normal questions like a coach instead of treating everything as an
  edit request
- Understand slang, typos, and vague wording ("bin", "gunshow", "the 6th") —
  and when it genuinely isn't sure, it asks a short question and REMEMBERS
  your answer instead of starting over

**The big one: it doesn't lie anymore.** All day, across every test we threw
at it — including deliberate traps — it never once said "Done" without the
change actually being on screen, exactly as described. If it can't do
something safely, it says so plainly. Trust is the product; today we built
it.

**Bonus:** Claude can now drive the app itself — it taps through the
simulator, sends coach messages, reads the logs, finds a bug, fixes it, and
re-tests, while I do other things. It caught and fixed several bugs today
completely on its own. That's hours a week back for content, business, and
actually training.

**Numbers for the nerds (skippable):** ~30 code changes shipped, 300+
automated tests guarding everything, and the whole project is now backed up
on GitHub so nothing can be lost.

**What's next.**
Edits currently take about 5–15 seconds depending on size — accurate every
time, just not instant. We measured exactly where the seconds go (the AI is
genuinely "thinking", which is why it's so accurate), and there's a designed
plan to roughly halve that without making it any dumber, if real-world use
says it's worth it. Otherwise: use the coach for a few days like a real
athlete would, and let it prove itself.

---

## Friday 3 July 2026 — evening session

**The plan got a facelift, and the change menu grew up.**

This afternoon we decided the plan itself should be the way athletes talk
to the coach — tap a day, pick from a menu, done. Tonight that idea got
polished in five visible ways:

1. **One clean week list.** The big "today" card at the top is gone.
   You now see Monday to Sunday as one list, with today gently bigger and
   highlighted. Tap any other day and *it* becomes the highlighted one,
   with its Start Session button and change options right there. Browsing
   next week? Nothing is highlighted until you tap — and the top of the
   screen now says "Next week" or "Last week" so you always know where
   you are.

2. **Real dates everywhere.** Every day now shows its actual date (like
   "FRI 3/7"), on the week list and inside each session.

3. **"Want to change something?" lives inside sessions too.** Athletes
   open a session, read it, and *then* decide to change it — so the
   change door is now in both places.

4. **Binning asks "are you sure?"** and then takes you straight back to
   your week. No accidental deletions.

5. **The change menu now works like russian dolls.** Instead of a wall
   of 18 session options: pick "Conditioning" → "Light or Hard" → and
   the engine picks the best session *for you* — instantly, following
   all the coaching rules (hard sessions only appear on bye weeks, and
   it avoids giving you something already in your week). There's a new
   "Recovery" option too — a proper restorative flow. No AI chat
   involved, so it's instant and can never pick something illegal.

Sam also signed off the bigger roadmap tonight: swapping between any two
days (not just onto rest days), binning just one part of a double-session
day (including team training if you can't make it), strength swaps that
use the real programming engine, and an "I'm not 100%" flow — tired,
sick, or injured, with a couple of taps for how bad it is, and the AI
coach only stepping in when it's genuinely needed.

**Numbers for the nerds:** 8 commits tonight, 72 producer tests all
green (up from 49), and every new menu option is provably unable to
offer something the safety validator would reject.

**What's next.** Restart the app and try the new week view and change
menu live. Then, in order: day-swapping, partial binning, strength
swaps, "I'm not 100%".

---

## Saturday 4 July 2026 — early morning session

**The change menu learned three big tricks.**

1. **You're the boss now.** Hard sessions used to be hidden unless it
   was a bye week. New rule signed off tonight: the athlete can choose
   anything, always — the coach just gets a word in first. Pick a hard
   session before game day and you'll see "make sure you don't overdo
   it — we want you fresh for game day", with an "Add it anyway — I'm
   good" button. Stack a third hard session in one week and you get a
   burnout warning instead. Nothing is ever blocked; everything is
   still checked.

2. **Days can trade places.** "Move it to another day" used to only
   offer empty days. Now every day (except game day) is fair game — pick
   an occupied one and the two days simply swap, all-or-nothing, with
   the safety checks proving nothing gets lost or mangled in transit.

3. **Bin exactly what you mean.** On a double day like "Team Training +
   Upper Pull" you now choose: just team training (can't make it
   tonight — that date only, next week untouched), just the gym session,
   or the whole day. Same for strength + conditioning days.

**Bonus:** you can now stack conditioning ON TOP of a lifting day —
"Add to this day" turns a lower-body session into a proper combined
day, built with the same structures the weekly programming uses.

**Numbers for the nerds:** 4 more commits, the change-menu test suite
grew from 91 to 122 checks, and every new path still can't offer
anything the safety validator would reject.

**What's next.** Strength swaps powered by the real programming engine
(pick "upper body", the engine builds it with all the coaching
principles), then the "I'm not 100%" flow — tired, sick or injured,
two taps for severity, coach conversation only when it actually helps.

---

## Saturday 4 July 2026 — the change menu is complete

**The last two pieces landed. The whole signed-off vision is now built.**

1. **Strength swaps use the real coach brain.** Pick "Swap → Strength →
   Upper body" and the same engine that writes the weekly program builds
   the session on the spot — respecting injuries, how close the next
   game is, and what your week already has (pick "Upper body" when
   Upper Push is already scheduled and you'll get Upper Pull). Lower
   body, full body, Gunshow and a proper prehab/accessories session are
   all in there too.

2. **"I'm not 100%".** Tap it and say what's up:
   - *Tired* → "lacking spark" backs today off; "absolutely cooked"
     drops today to recovery level. Nothing is deleted — the plan
     bounces back tomorrow.
   - *Sick* → "light sniffle" softens today to a recovery flow;
     "bed-ridden" clears the rest of the week (game day untouched, one
     confirm first); "pretty rough" opens the coach mid-conversation
     with the context already filled in.
   - *Injured* → straight to the coach, pre-loaded, into the existing
     injury system that adapts the plan around a body part.

**Numbers for the nerds:** the change-menu suite now runs 154 checks
(49 this morning), 15 session templates in the registry including 6
engine-generated ones, and the whole athlete-change vocabulary from
Friday's design page is implemented except sprint conditioning (waiting
on the running-rules decisions).

**What's next.** Live-verify the lot in the simulator after a Metro
restart, then polish: real set/rep prescriptions for one-off engine
sessions, strength stacking onto occupied days, and the sprint category
once the running rules are signed off.

---
