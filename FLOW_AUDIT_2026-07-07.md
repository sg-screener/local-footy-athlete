# LFA product-flow audit — 7 July 2026

Analysis only. No code changed. Scope: every athlete-facing flow in the
live app, with a focus on the tap-first "russian doll" change sheet and on
holes where the athlete gives enough information but the plan doesn't
actually change, no Coach Note is created/cleared, or nothing gets
explained.

Method: read the live tap sheet (`PlanChangeSheet.tsx`) and its producer
(`planChangeProducer.ts`) end to end, then traced the modifier/Coach-Note
lifecycle, the settings/setup flows, feedback, games, exercise edits, and
navigation reachability against the design in `ATHLETE_CHANGE_VOCABULARY.md`.
Everything below is verified against current code, not the docs.

## Headline

The core tap machine is genuinely solid. Tapping a day → Edit → swap /
add / move / bin all build a real proposal and run it through the same
validate → apply → verify pipeline the chat coach uses. Games,
in-session exercise swaps, injury flow, and session feedback are all
built and wired. The problems are not in that engine — they're at the
**edges of the vocabulary**: whole categories of real athlete life
(a busy week, a missed session, "I've got no barbell") either have no
tap path, apply to the wrong day, or collect information that never
reaches the program. And a large amount of dead code sits next to the
live code, which is actively dangerous because it looks built.

---

## Biggest gaps, ranked by athlete impact

### 1. "Busy week / away / holiday" has NO live tap path
This is the single biggest hole against your own stated priority (life,
schedule, capacity to train). The design calls for a busy-week / travel
control (vocab group 5). The machinery exists — a current-week load
reducer (`buildTapScheduleModifier`) and an unavailable-days stub — but
it lives entirely inside `HomeQuickActionSheet`, which is only imported
by the **dead** classic `HomeScreen`. The live screen is `HomeScreenV2`
(`DESIGN_VERSION` is hardcoded to `'v2'`), and it never mounts that
sheet. So today, an athlete with a brutal work week or a week away has
exactly one option: "Something else — ask the coach." That's precisely
the open-ended chat you're trying to move away from.

**What should happen:** a first-class "This week's busy / I'm away"
entry (either in the day sheet or as a week-level control on the Program
tab) that marks a date range as rest/reduced through the same override
pipeline, creates a Coach Note, and shows the week visibly ease off. The
back-end reducer already exists; this is mostly porting the orphaned
control onto the live screen and adding a date-range/away variant.

### 2. "I'm not 100%" always applies to TODAY, even when you tapped a future day
The sheet header says the day you tapped (e.g. "Wednesday 9 July"), but
every wellbeing action — tired, sore, sick, injured — hardcodes
`todayISO` and ignores the tapped date. Tap next Wednesday, say "I'm
injured," and the plan changes *today* while Wednesday is untouched, with
no indication of the mismatch. The payloads already support a distinct
date; no caller passes the tapped one.

**What should happen:** either thread the tapped date through so the
change lands where the athlete is looking, or (cleaner) pull "I'm not
100%" out of the per-day sheet entirely and make it a single global
"How am I today?" entry, since fatigue/sickness are about *now*, not a
specific future square. Right now it's silently doing the wrong thing.

### 3. Missed sessions are invisible
There is no missed-session concept anywhere. If a day passes and the
athlete never opens it, nothing happens: it isn't flagged, carried
forward, or allowed to nudge the week. The only "skip" the system honours
is when the athlete deliberately opens the session and taps
Completion = "skipped" in the feedback panel. Real athletes miss work by
simply not doing it — so the app's picture of the week silently drifts
from reality, which is the exact thing that later makes rolling
programming wrong.

**What should happen:** detect a past, un-logged session and offer one
obvious follow-up — "Did you do Tuesday? [Did it / Missed it / Move it
forward]" — feeding the same feedback/override paths. This is also the
cleanest signal source for the readiness loop you already built.

### 4. Equipment is collected but never used
Marking equipment unavailable changes nothing about the program. The
equipment value is sent to generation but never read by the prompt or
the coaching engine, and the live Profile setup sheet doesn't even
include equipment (only the orphaned, unreachable Equipment screen does,
and that only persists a value with no rebuild). The one place equipment
*works* is the in-session per-exercise "no equipment" swap, which is good
and can persist as a future-weeks preference — but there's no global
"here's what I can train with" that reshapes the whole plan.

**What should happen:** make equipment a real generation input, and give
it one reachable surface that rebuilds. Until then, an athlete training
at home with dumbbells gets a barbell program and has to fix it exercise
by exercise.

### 5. "Too easy / too hard lately" load nudge is missing, and feedback only steers strength
Two related holes in the "How I'm going" group. First, there's no
athlete-initiated "bump me up / back me off lately" tap at all. Second,
the per-session feedback that *does* exist (feeling, soreness,
completion) only drives the resolver's readiness/volume adaptation for
**Strength** sessions — conditioning and recovery feedback is stored and
then ignored by that path. So an athlete who keeps flagging conditioning
as brutal sees no response.

**What should happen:** a small "lately this has been too easy/hard" nudge
that writes a load-adjustment modifier, plus extending the feedback
adaptation to conditioning so the data you're already collecting actually
does something.

### 6. Sheet-added strength sessions use placeholder sets/reps/loads
When the athlete swaps/adds a strength session from the sheet, the engine
builds it with a default prescription (3×8–10, 90s rest) rather than the
real prescriptions + load estimates that weekly generation produces. The
session structure is right, but the numbers are generic. Against
weekly-programmed days sitting right next to it, athletes will notice.
(Quality gap, not a flow hole — but it undercuts trust in the tap system.)

### 7. Team training: single-date bin only, no "different night this week"
Binning team training for one date works well (recurring schedule
untouched). Permanently changing your team nights works too (setup
regeneration). The missing middle is the common one: "training's on
Thursday instead of Tuesday *this week only*." No tap path — it falls to
chat.

### 8. Coach Note lifecycle: two rough edges
The main path is fine — the Program tab shows active Coach Notes and the
per-note "Clear and update program" button works correctly for every
source. Two edges: (a) the Profile "Clear active changes" bulk button
can leave tap-created fatigue/recovery/busy constraints behind when
there's no coach-update card to trigger the sweep; (b) the lighter "spark
/ sore" readiness signals go dormant tomorrow but are never actually
deleted, so they quietly pile up in storage. Neither corrupts the plan,
but the bulk-clear one can leave an athlete looking at a note they think
they cleared.

### 9. Large dead-code surface that looks live
Not an athlete-facing gap, but it's the thing that will keep biting this
audit and future work. Sitting next to the live code: the entire classic
`HomeScreen`/`DayWorkoutScreen` branch (dead behind the hardcoded v2
flag), the whole `src/screens/program/` directory (9 screens), the whole
`src/screens/journal/` directory (8 screens), the orphaned Profile
settings screens (EditProfile, TrainingPreferences, Equipment, Health,
Goal, Injury, Preferences), and `HomeQuickActionSheet`. This is exactly
why "busy week" *looked* built when it isn't — the reduce-week code is
right there, just wired to a dead screen. Every reader (you, me, ChatGPT,
a future agent) risks mistaking it for a live feature.

**What should happen:** a Stage-4/5-style cleanup pass — propose the
deletions, don't surprise. Getting the dead parallel implementations out
makes the real gaps legible.

---

## Recommended implementation order

Ordered by athlete impact against your stated priorities (schedule/life,
missed sessions, training around niggles), with correctness fixes first
because they're cheap and stop the app doing the wrong thing.

1. **Fix "I'm not 100%" day targeting (#2).** Small, correctness, stops a
   silent wrong-day change. Decide: thread the tapped date, or promote
   wellbeing to a global "today" entry. Do this first.
2. **Build the busy-week / away flow onto the live screen (#1).** Highest
   real-life impact, and the back-end reducer already exists — this is
   mostly reconnecting a designed feature that's wired to a dead screen,
   plus a date-range "away" variant.
3. **Missed-session handling (#3).** Systemic detection of a passed,
   un-logged day with one obvious follow-up. Also feeds the readiness
   loop you've already built.
4. **Equipment as a real input + one reachable surface (#4).** Either
   make generation read it, or at minimum let the in-session "no
   equipment" preference reshape future weeks globally.
5. **Load nudge + conditioning feedback adaptation (#5).** Makes the
   feedback you already collect actually steer the plan.
6. **Real prescriptions for sheet-added strength (#6).** Quality; removes
   the "these numbers look generic" tell.
7. **Coach Note clear edges (#8)** — bundle as small hygiene fixes
   alongside any of the above.
8. **Dead-code cleanup (#9).** Propose-then-delete. Do this before or
   between the bigger items so the codebase stops hiding live-looking
   traps.
9. **Team-training "different night this week" (#7).** Lower frequency;
   fold in when convenient.

Every one of the build items (1–5) should go through the existing
producer → validate → apply pipeline so the menu can never offer what the
validator would reject — consistent with the invariant already enforced,
and with the "systemic fix, not edge-case patch" rule.

---

## What's genuinely working (so it's not touched by accident)

Tap day → Edit → swap/add/move/bin (all real, validated, ~2s). Russian-
doll categories with deterministic picks. Games add/move/remove/bye
(relocated into the Program week view after the Calendar tab removal).
In-session exercise swap with no-equipment / injury / too-hard reasons,
today-only or persisted forward. Guided injury flow. Session feedback
capture (feeling/soreness/completion) with strength readiness adaptation.
Per-note Coach Note clearing. Season-phase / training-days / team-days /
game-day changes through the live Profile setup sheet, which does a real
rebuild.
