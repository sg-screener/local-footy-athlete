# COWORK SEAT HANDOFF — 2026-08-06

For the next Cowork session working with Sam on Local Footy Athlete. Read
this WHOLE document before your first substantive reply. It is orientation
plus binding practice — the authoritative laws live in the repo docs named
in §2.

---

## §1 — Who you are working with, and how

Sam is a strength & conditioning coach, NOT a developer. He built this app
from his own playing career (see docs/MOBILITY_PAIRING_RULINGS_2026-07-31.md
for the origin story: smart mobility, smart progressions, readiness
monitoring are his core values). He quit his job to build this. Treat him as
the head coach and product owner; treat yourself as his reviewer, translator
and orchestrator.

**Communication rules (violating these is how you lose him):**
- Plain English. Coach language, not engineering language. If you must use a
  technical term, translate it in the same breath.
- SHORT answers, one thing at a time. He explicitly hates walls of questions.
- Multiple-choice questions IN TEXT with lettered options and a marked
  recommendation. NEVER use the AskUserQuestion widget — it glitches for him.
- Compile PASTE-READY blocks for his terminal. He copies them verbatim. The
  block is the deliverable; keep your surrounding prose minimal.
- Evidence first, ALWAYS. Never theorize when a tape, export, or grep can
  answer. He will call you out (correctly) if you assert something you
  didn't check. When he uploads a device export, SAVE IT INTO THE REPO ROOT
  (bash: cp from the uploads mount) so the terminal can read it, then read
  the relevant slice yourself before saying anything.
- He swears when frustrated; do not become submissive, do not grovel. Own
  mistakes in one sentence and fix them. He values being told when his own
  reading is wrong (see the hard-day misparse incident — he corrected the
  reviewer harshly; the right response was owning it once and moving on).
- NEVER remind him about git push or the dev diary (explicitly ruled).
- The app has NO real users. Legacy-data risk = his test devices only.
- His signing style: present batches, he answers "1a, 2 yes, 3 ..." in one
  line. Record EVERY ruling verbatim into a tracked doc immediately.

**The rhythm that works:** terminal (Claude Code, in the repo) does the
building; Sam pastes its boundary reports here; you verify claims against
the repo (git log, grep — cheap spot-checks), translate to plain English,
present decisions with recommendations, compile the next paste block. You
also write ruling/design docs directly into the repo (docs/), which the
terminal commits "as authored" (convention established — you never touch
git yourself; a stale .git/index.lock means a terminal is mid-operation:
leave git alone).

## §2 — Read these before acting on anything

1. Your memory index (auto-loaded) — the walker/post-merge memory file is
   the project's running history.
2. docs/NORTH_STAR.md — store only decisions, derive everything else. Every
   unit's boundary report must answer the convergence question. This is THE
   law; everything else derives from it.
3. AGENTS.md — the working agreement: coach-intelligence rules, the
   escalation rule (7 questions before patching a repeatedly-failing
   pipeline), fixture-fidelity laws (reach state by ACTING, exports are
   conformance targets never seeds), instrumentation-alive rule, the
   de-duplication-un-gates warning, shared-worktree environment law (verify
   branch before every commit; git checkout -- and stash are hazards), and
   PROCESS LAWS L11–L16 (see §3).
4. CLAUDE.md — points to NORTH_STAR first; stop-patching triggers; the
   Elegant Solution Requirement (compare incremental vs redesign; prefer
   what removes representations).
5. docs/COPY_SHEET_RULINGS_2026-07-30.md — the signed-copy regime. Every
   athlete-visible word is Sam-signed, equality-bound both directions.
   Batches 1–10 signed. New/changed strings ship PROPOSED and come back to
   Sam in batches. "Exposure" never reaches an athlete; Remove not Bin;
   "Ask Coach" app-wide; Title Case short labels; signed sentences never
   claim state-dependent outcomes (typed cause selects the sentence).
6. docs/PARKED_QUESTIONS_2026-08-01.md — the park-and-move-on mechanism.
   Anything needing Sam parks there; you run the signing sessions.
7. The latest day-shift log + handover docs (docs/DAY_SHIFT_LOG_2026-08-01.md,
   the 2026-08-04 stage-1 handover, docs/STAGE_B_STAGE1_BOUNDARY_REPORT_2026-08-04.md).
8. The Stage B pack: docs/STAGE_B_PROMPT_DRAFT_2026-07-29.md +
   docs/STAGE_B_KICKOFF_ADDENDUM_2026-08-03.md (addendum wins) +
   docs/STAGE_B_PRECONDITION_REPORT_2026-08-03.md + stage 0/1 reports.
9. docs/LEGACY_RECKONING_CENSUS (current) — 27 units, ratcheted. LR-6 =
   HARD STOP on coach-pipeline work, with the ratified boundary: routing a
   coach caller through an owned store door (identical call/context/
   transaction) is NOT coach work; changing what a coach path DECIDES is.
10. docs/STORE_ARMOUR_RECIPE_2026-08-03.md — 16 lessons; every persisted
    store now has one door/tape/quarantine; totals-or-red is law for every
    bible suite (a suite is green only when its printed totals line appears).

## §3 — The laws you personally enforce as the review seat

- L10: Sam's device makes a thing DONE. L11: the matrix/walker green BEFORE
  his phone — his device is the LAST instrument; if two defects differ only
  by combination coordinates, ALL fix work stops for a reassessment.
  L12: every boundary report states what catches the NEXT defect of the
  class; verification strategy is reviewed like code — send back reports
  that lack it. L13: walkers must reach ACCUMULATED state (long lives);
  reports state depth reached. L14: domain purity. L15: one write format;
  superseded shapes get read-ingress lifts, never writers. L16: vertical
  slice first.
- Boundary reports must answer the NORTH-STAR CONVERGENCE question, carry
  NOT-COVERED honestly, and get spot-verified by you (git log/grep) before
  you tell Sam anything is true.
- Supersession discipline: rulings are never edited in place — new docs
  declare supersession (there is one recorded case of a reviewer-authored
  overreach: "generator never places optional work" — withdrawn and
  replaced by the five-condition Optional Placement Law).
- Copy law, provenance law (every athlete-affecting number is
  Sam-authored/anchored; unauthored = STOP and ask), the charter's four
  questions (no session type without: who places / who chooses / how
  counted / who authored contents), the Rest law, "team night = hard day",
  estimate→measured (onboarding seeds, logged reality owns), "ask when no
  fact answers; derive when one does; never both", 90/10 (core built first,
  optional = need-based top-up only), "the builder owns the week"
  (attach-first repairs), one-word card identity, one projection (L-P1–P8:
  every surface renders from project(); no surface composes words).

## §4 — State at handoff (2026-08-06, morning)

- main at 936bbf7. feat/stage-b-stage1-l16-slice at 8dc35a2, COMPLETE,
  GREEN, UNMERGED (L10 open — device pass deliberately bundled to Stage 2's
  first athlete-visible milestone: ONE combined pass covering stages 1+2).
- STAGE 2 KICKOFF JUST FIRED on a fresh Fable week, carrying Sam's four
  2026-08-06 rulings: (1) the precedence ordering RATIFIED (athlete's mark
  outranks stored output — dayPrecedence.ts is law, flip contingency
  dissolved); (2) lighter-day-is-re-filterable-by-later-injury KEPT;
  (3) LR-27 gets LR-26's ruling (delete nested snapshot, keep reference,
  re-derive at read), scheduled EARLY, twins ship together, consumer check
  first; (4) %MAS binary ≤30s→110% rule is ACCRETED (Sam does not remember
  authoring it) — the 55 templates' RANGES own conditioning intensity.
  Also ratified: the L-P3 containment; LR-25 deletion stays.
- Stage 2 priorities as fired: A) name the blind-spot defect (team_night ×
  conditioning/strength deep-walker red with mischaracterised coordinates)
  BEFORE building further; B) LR-27+26; C) conditioning from the 55
  templates (third vocabulary dies, one typed dose-string parse at one
  ingress); D) survey-first on carried opens (v1 exposureContract vs L15,
  hydration-repair in-place branch, two-facts tie-break).
- Census at 27 (ceiling); coach work frozen (LR-6) until the coach rebuild
  era; parked file currently empty.
- Credit/model practice (established): Fable for judgment-heavy/long units;
  Opus for closeouts and mechanical work (/model switch mid-session
  preserves context — switch in place when unwritten context would be lost,
  fresh session otherwise); totals-or-red style checkpoint docs before
  context exhaustion; NO parallel subagent fan-out unless work is
  file-disjoint (store-pair precedent); agents verify their cwd before
  destructive commands (node_modules was destroyed twice by cwd drift).
- Known terminal quirk: background-gate completion sometimes fails to wake
  a sleeping agent. Symptom: "nothing has changed for ages". Fix: type a
  status-question nudge; or pre-empt with the standing rule "never let an
  agent end its turn while its own gate runs".

## §5 — What comes after Stage 2 (the standing queue)

Stage B continues slice by slice (strength/muscle blocks D11, power-as-rows,
MAS wiring, mobility pairing composition, rolling two-block horizon — the
addendum §1 lists all inheritances). Then: the combined device pass (Sam's
tap list — keep it SHORT, plain, with expected sights per tap; anything off
= number + what he saw + tape, NO retries), merge, then the census by rank,
then the coach rebuild (LR-6 lifts; coach voice migration, dateOverrides
full retirement), then day-first UI (docs/DAY_FIRST_UI_DIRECTION_2026-08-01.md,
parked post-Stage-B), then launch reality: real beta (Renee + athletes),
accounts/sync (authStore was retired — a sign-in flow will need building
under the armour recipe), App Store mechanics.

Sam's own future signings to expect: conditioning cue gaps (23 PENDING +
Easy Swim), any new athlete-visible strings, weak-point v2
(soreness-informed pairing, parked), G-1 primer option (parked for a
buttons pass), team-night "how big was the session" model evolutions.

## §6 — Practical mechanics

- Repo on host: /Users/samgeurts/Documents/local-footy-athlete (request via
  folder tool if not mounted). In the shell sandbox it appears under
  /sessions/<name>/mnt/local-footy-athlete — use host paths for
  Read/Write/Edit/Grep, sandbox paths for bash. Uploaded files land in an
  uploads mount; copy device exports into the repo root with a dated name.
- Sam's build command (Release to his phone): delete app ONLY when a fresh
  install is the test; otherwise install over (data survives):
  `cd ~/Documents/local-footy-athlete && npx expo run:ios --device
  --configuration Release`. No git pull needed (work is local).
- Update your memory file after every major milestone — the next session
  depends on it. Keep the walker/post-merge memory file as the single
  running history; newest entries at top.
