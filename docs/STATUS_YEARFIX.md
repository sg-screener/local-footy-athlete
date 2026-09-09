# YEARFIX — Sam's six-item review of the three-day 52-week book (2026-09-09)

Seat: yearfix (Fable). Worktree `/private/tmp/lfa-yearfix-20260909`, branch
`yearfix/three-day-year-20260909` from `integrate/2026-09-09-combined` @ 326ef8ab
(app code identical to 017818cc, the code on Sam's phone). node_modules symlinked
from the original folder; the original folder, its servers and simulators were not
touched. Evidence: `/private/tmp/lfa-yearfix-evidence/` (suite logs, fault-control
logs) and `output/three-day-program-2026-09-09-yearfix/` (regenerated year, book,
PDF, proofs; untracked like every other output folder).

REGISTRY-GREP before building: R-393, R-389, R-390, R-386, R-378, R-354, R-337,
R-312, R-233, R-266, R-290, R-129, R-288, R-388, plus R-036 (illness law) and
R-303/R-391 found while diagnosing items 4 and 6.

## Root causes, one per family (verified in the 017818cc book by date)

- **Item 3, Primer Pogo Hops under a knee.** The knee filter that strips every
  lower jump is `applyConstraintsToTypedComponents`, which reads
  `role === 'power'`. The Primer's Pogo Hops is an AUTHORED row
  (`authoredSlotRowToWorkoutExercise`) and carried no role, so it walked past the
  one filter; the exercise-level matrix separately permits Pogo Hops at knee 4/10.
  Fix at the composition owner: the authored jump slot declares `power: 'lower'`
  and the builder types it exactly like a pool-drawn jump. No second reading.
- **Item 5, two adductor isometrics on 2027-03-05.** Two causes. ("Isometric" is
  read from the groin pool's duration-authored entries — Copenhagen variants and
  Groin Squeeze; a Cossack Squat or Lateral Lunge is dynamic adductor work and is
  not counted. A first, broader reading counted them and the early eight-athlete
  annual run reddened 65 weeks on it; narrowed before the release run. The
  release run then found seven composer-placed pairs of holds — Copenhagen +
  Groin Squeeze on female-5-home, Long-Lever + Half Copenhagen on
  male-6-no-standing-fixture — so the rule moved to the shared
  `adductor_isometric` variation family, one owner for every door.) (a) Two holds could
  land on one day: the warm-up flow drew Groin Squeeze beside a prescribed Half
  Copenhagen on six dates, and the eight-athlete year showed the composer itself
  placing two robustness holds on one day (Copenhagen + Groin Squeeze, Long-Lever
  + Half Copenhagen). Fix: the groin pool's duration-authored holds are one
  `adductor_isometric` variation family, so the existing same-session family
  rule (composer, automatic selector, flow, add/swap doors) refuses the second. (b) The 3 x 30 s on a deload: the frontal-plane
  completion built its row at authored sets with no dated dose (the leg coverage
  already took one), and `reduceDemandingPrehab` read only the useful-strength
  contract, which a Mixed day does not carry. Fix: the completion takes the same
  `dosePolicyForDate` in all three callers, and the reducer also reads the dated
  deload policy. Result: one Copenhagen at one set.
- **Item 1 (R-394).** `weeklyLegCoverage` in-season now answers a typed Nordic
  category first (R-312's `nordicCurlVariant`), before the R-393 pair.
- **Item 2 (R-395).** `weeklyScheduler` adds one off-feet tempo finisher on the
  first strength-owned gym day off club training outside G-2..G+2 with a machine,
  outside the game-week budget; the V2 in-season game-week contract permits that
  one extra for two-or-more-night club athletes (`max` only; `preferred` and
  `required` unchanged, because the planner selects from `preferred`).
  `wholeWeekPlacementCost` excludes it from the metabolic count so the strength
  assignment cannot move to chase it (found by `spare-day-options` case [2]).
- **Item 4 — NOT a code inconsistency, stopped.** The reduced dose on 2027-07-19
  is stage 2 of the KNEE return (knee 2027-06-22 to 07-06 = 14 days, sprint
  blocking; stage 1 shown 07-10). Neither illness (03-23..27, 07-14..17, both
  under 7 days, tier MODERATE) triggers R-393's return, and R-036 rules a
  MODERATE illness eases training only while active. Making a short illness carry
  a return dose would be a new ruling, not a repair.
- **Item 6 — NOT buildable without a ruling, stopped.** Replayed week 16 through
  the live scheduler (`probe-w16-replay.cjs`): Friday already counts 11 lower
  working sets, so the four-day run IS visible. Thursday is the only legal
  standalone day because (a) the week owes two running days (Bible 17.B), all
  three lifting days are full-body so their metabolic work is off-feet, hence a
  standalone running day is required; (b) Tuesday makes Mon-Tue-Wed three
  consecutive energy-system days, refused by R-303 (kept by R-337); (c) Sunday
  makes Fri-Sat-Sun-Mon four; (d) Speed stays Saturday (R-389/R-391). Every
  spacing fix reverses one of those.

## WORKING / BUILT / WRITTEN (receipts in /private/tmp/lfa-yearfix-evidence/)

**WORKING** (the test that reds if it breaks is named):
- Primer Pogo Hops typed power and removed by a knee restriction —
  `test:leg-programming` case "The Primer's authored Pogo Hops is typed power…";
  fault `untype-primer-pogo` caught. `test:primer-session` 25/25 unchanged.
- One adductor isometric per session (variation family) — case "One adductor
  isometric per session…"; fault `adductor-holds-not-one-family` caught.
- Frontal completion + prehab reducer read the dated deload policy — case "The
  frontal-plane completion consumes the dated deload dose…"; faults
  `drop-frontal-completion-dose`, `ignore-dated-policy-for-prehab-reduction`.
- R-394 in-season Nordic — case "In-season a curl does not replace the Nordic…"
  (added, credited, pre-season silent, G-1 refused); fault `nordic-satisfied-by-curl`.
- R-395 in-season harder-than-flush day — case "In-season game week: the
  off-club gym day…" (Sat/Sun fixture, deload, low readiness, no machine, no
  club, no eligible day, pre-season); fault `drop-inseason-moderate-conditioning`.
- Annual verdict: `weekly_inseason_nordic`, `weekly_inseason_conditioning`,
  `injury_exposure_fixed_point`, `one_adductor_isometric_per_session` are
  required weekly checks; `scripts/test-compiler-year.js` 53/53 controls
  including missing/failed variants of each.

**Exact results (command · exit · counts):**
- `npm run test:compile` · 0 · 0 errors against baseline (run twice, after every edit batch).
- `node src/__tests__/legProgrammingTests.cjs` · 0 · 42/42 (37 existing + 5 new).
- `node scripts/test-leg-programming-mutations.cjs` · 0 · 36/36 faults caught
  (30 existing + 6 new; three existing anchors re-pointed after my edits made
  them non-unique — fault behaviour unchanged).
- `npm run test:leg-programming` chain: journey 137 assertions, injury-energy and
  no-equipment journeys inside the chain green (release run below is the receipt).
- `npm run test:exercise-intake` · 0 · intake 2142/0, B-Stance 18/0, equipment
  vocabulary 98/0, Primer 25/0, power pool 57/0, quick actions 64/0.
- `npm run test:annual-audit-repairs` · 0 · controlled-2/3/4/5 each 364 dates,
  20 history comparisons, 52 reopens.
- `npm run test:rest-day-reason` · 0 · 144/144.
- `npm run test:weekly-writer-zero` · 0 · 1192/1192 reviewed, 0 unresolved
  (seven owners re-recorded with dated reasons).
- `npm run test:section18-v2` · 0 · 142/0. `npm run test:weekly-scheduler` · 0
  (spare-day-options 22/0 after the whole-week-cost fix). `node
  scripts/test-compiler-year.js` · 0 · 53/0.
- Baseline reds, NOT mine (reproduced on an untouched 326ef8ab worktree):
  `test:section18-planner` (Pre-season no-club phaseWeek 2, expected 4 actual 3;
  classified rewrite_test in test-truth-decisions), `test:clause-enforcement`
  (WC-138, WC-136 unclassified; WC-031, WC-064 orphaned).

**Regenerated three-day year** (`output/three-day-program-2026-09-09-yearfix/`,
same pipeline as the 017818cc book): annual-audit-evidence exit 0; prepare: 52
weeks, 364 days, 2,045 rows, 443 numeric feedback comparisons, 364/364 reopens
identical, 0 findings, 0 driver failures; PDF 280 pages, 2,045/2,045 printed rows
in order, 0 mismatches, 0 week-finder errors, sha256
e7e5dacad7e63f1ba471c55e3c18e861f7839853840a2213a1e038f54c22e394
(`output/pdf/three-day-athlete-full-52-week-program-2026-09-09-yearfix.pdf`).
prepare exit 0, 0 source changes against the manifest taken before the run
(fourth run, after the adductor-hold family below).

**Dated proofs (`tools/proofs.py`, red on the 017818cc book, green here):**
- item 1: in-season Nordic sets w27–w52 = 2 every week except w42 = 1 (illness
  week, halved) and w45 = 0 (two fatigue reports, readiness deload; w44 = 2).
- item 2: Wednesday 2027-03-31 carries `tempo_intervals` beside Monday's flush,
  and so does every in-season game week except w45 (reduced); bye weeks keep
  their own hard session.
- item 3: Primers 2027-06-25 and 2027-07-02 (knee active) carry no Pogo Hops.
- item 5: 2027-03-05 carries one adductor isometric, Half Copenhagen 1 x 30 s.
- item 4 (report): 2027-03-28 still five Fly 20s — ruled by R-036/R-393, see above.
- item 6 (report): week 16 longest leg-loading run stays 4 — ruled, see above.

## 2026-09-10 — phone install from this branch (seat PHONEBUILD)

**WORKING** — `TZ=Australia/Melbourne npx sucrase-node
src/__tests__/sessionSectionAddTests.ts` re-run fresh at HEAD de2e79c7 (the
earlier log finished two minutes after the merge, so it could have started on
pre-merge files): 250 passed, 0 failed, exit 0. The two cells red before
cc6e687d ("male|female/primer+conditioning_light: combined session preserves
section label, row order and typed context") are in that count. Receipt:
`/private/tmp/lfa-yearfix-evidence/section-add-4.log`.

**BUILT and on Sam's phone** — Release/iphoneos, `-allowProvisioningUpdates`,
BUILD SUCCEEDED, exit 0 (`/private/tmp/lfa-yearfix-build/build-release.log`).
`codesign --verify --deep --strict` OK, team 66M7FZ6G37,
com.localfootyathlete.app 1.0.0 (1). `main.jsbundle` embedded, 8,709,517 bytes,
Hermes bytecode, sha256 5309760937e4a0a6…; no `ip.txt` in the .app. Installed
in place with `devicectl device install app` on AFA21856… (bundle container
5607E5DF-C6FB-43F2-BDB0-DBE87CAA2C72); no uninstall, no data cleared. Launch
refused twice: device Locked — Sam opens it himself.

Two things the handoff got wrong, and what was done instead:
- The handoff asked for a **Debug** build and then for `main.jsbundle` to be
  embedded. The bundle phase forces `SKIP_BUNDLING=1` for every Debug
  configuration and there is no `.xcode.env.updates` to lift it, so the Debug
  build (also exit 0) produced no bundle at all. A Debug app on a phone reaches
  for Metro. Built **Release**, as the 2026-09-04 phone install did.
- This worktree's `node_modules` is a **symlink to the original folder**.
  `expo/AppEntry.js` imports `../../App` relative to its REAL path, so the
  first Release bundle failed to resolve — and had it resolved, it would have
  bundled the ORIGINAL folder's App (integrate @ 556e2ac8), not this branch.
  Fixed with an untracked entry file in the worktree,
  `phone-entry.yearfix.js` (`import App from './App'`), named by
  `ENTRY_FILE` in the gitignored `ios/.xcode.env.local`. Proof the phone
  carries this branch: the embedded bytecode's string table holds
  `adductor_isometric` (3 worktree source files, 0 in the original) and
  `R-395` (absent from the original `lawRegistry.ts`).

Not run: `test:release`, `test:bible`, the 44-group gate, any year audit, the
baseline reds listed above. Not done: the everyday seat's coach-server
deploy (Sam decides). Original folder's servers, Metro :8093 and the
everyday simulator untouched.

**06:35 — badge opacity (R-396).** Sam, on the phone screenshot: *"the badges
need to have opacity boosted 25% or so"*. `BADGE_DE_EMPHASIS` 0.5 → 0.75 in
`SessionTierBadge.tsx` (commit 9ff283ae, with the registry row R-396 the 50%
ruling never had). **BUILT** — no cell asserts the value. `test:ruling-registry`
exit 1 on four pre-existing reds, none naming R-396 (R-384 no status, R-070
missing file, 9 UNENFORCED above the ceiling of 4, 18 inbox re-asks); cell
[1c] and [4] green with the new row. Release rebuilt at 9ff283ae
(`build-release-2.log`, exit 0), codesign OK, bundle 8,709,521 bytes, no
`ip.txt`, installed in place on AFA21856… (container C7A796EB…); launch
refused again: Locked. No simulator proof taken — Sam judges the chip on his
phone. Not run: `test:compile`, gates, audits.

**07:05 — Coach probe (Sam: "give him 10 questions, tell me what he can and
can't do").** Real path: `askCoachReadOnly` from this tree → the DEPLOYED
`coach-chat` function (gpt-5.6-terra), i.e. exactly what the phone build calls;
only the athlete differs (Coach Lab fixture week of 2026-08-24, Saturday game,
flat quick check, squat 95→100). 10 answers + 3 with exercise rows filled in,
all accepted by both truth gates: `/private/tmp/lfa-yearfix-evidence/coach-10-questions.log`.
Findings, in order of weight: (1) the model snapshot carries no season phase /
block, so the coach cannot apply a pre-season vs in-season ruling — it
approved "leg curls instead of Nordics" without knowing the phase (R-394 says a
curl does not replace the Nordic in season); (2) the repo's knowledge bundle
stops at R-393 (built 2026-09-09 01:26), R-394/395/396 absent, and the
deployed bundle is at best that old; (3) it never points the athlete at the
app's own doors (Tired / Sick / Injured, the move option was named once);
(4) conversation is not persisted and only 6 turns travel; (5) the Debug
fixture had `rows: []` — the live projection does send rows (exercise,
prescription, dose, cue), verified in `projectCoachSnapshotForModel`.
**WRITTEN** — findings only; nothing changed in code. Not run: Coach Lab
suites, gates.

**07:40 — Coach 90% plan WRITTEN:** `docs/COACH_90_PLAN_2026-09-10.md` — five
rocks (Snapshot v2, rule book fresh/findable/deployed, app map, memory in
three layers, proof loop), five slices, three questions for Sam (profile vs
Privacy screen, on-device memory, deploy). Inputs: 24 live probes + four
read-only audits (rulings, profile gap, app map, knowledge pipeline). No code
changed.

**08:10 — Sam ruled on the plan and the coach is deployed.** R-397 (full
profile to the coach; name/ids never), R-398 (memory = app session, in memory,
10 turns, nothing stored; the remember-offer dropped). Bundle rebuilt
(R-393 → R-396), `test:coach-chat-integration` 87/0, `supabase functions
deploy coach-chat` exit 0 → **v10 ACTIVE**. Live smoke: the Nordic question
now cites the in-season rule. Receipt: `docs/COACH_DEPLOY_RECEIPTS.md`.
Plan §7 and Rock 4 updated. Next: slice S1 (Snapshot v2) on Sam's word.

**08:40 — Coach slice S1 BUILT and on the phone (R-397).** Commits bbc3861c
(code) and 1de68e6e (Lab bench + tapes). The one projection
(`projectCoachSnapshotForModel`) now carries `situation` (season: phase,
subphase, phase week, week kind, block, week-in-block, deload; standing:
usual game day, club nights, gym days, sessions/week, Christmas break;
fixtures ahead 28 days; next week through the same projection via the new
`useProjectedWeekFor`), `history` (14 days of readiness signals, session
outcomes with components, ledger decisions with ids and `name` keys stripped —
`projectRecentChange`), `injuries` (active/improving episodes), `mas`,
`estimates`, `load.weeklyCompletedLoadAU` and `load.isDeloadWeek`. The
adapter reads the owned phase (`ownSeasonPhase`) and the block clock
(`getStoredBlockStateForDate`), never the day kinds. Two refusals in the pure
owner: a next week that is not the week after the visible week; season and
load disagreeing about a deload. `phaseClaimGrounded` holds the words to the
owned phase in the contract, the client (`coachChat.ts`) and the server
(`index.ts` also now requires `situation`). Contract `snapshotFieldsUsed`
whitelist gained the five new blocks — without it a model citing
`situation` would have been an "invalid answer".
**WORKING:** `coachSnapshotTests` 53/0 (new §5: present, unknown-not-guessed,
both refusals, no refused key, ledger projection), `coachChatIntegrationTests`
91/0 (four R-397 cells incl. conditional escape), `coachLabRetrievalTests`
22/0, `openAICoachLabTests` 61/0, `coachSnapshotPopulatedTests` 18/0,
`progressTabOwnershipTests` 84/0, `test:compile` 0 errors.
**Baseline reds, reproduced on an untouched control worktree at HEAD:**
`test:coach-lab` dies at `UnsignedCopyError "part.headline.strength"` in the
old local candidate (`currentReadOnlyCoachCandidate` → `coachOpener`);
`test:coach-phrase-ratchet` red on 10 files (control: same 10; my change adds
two regex literals to `coachResponseContract.ts`, 28→30, the same class as
the F14 gates; not re-baselined — owner's call).
**Phone:** Release at bbc3861c, codesign OK, installed in place on AFA21856…
(container 7932FC7B…), launch refused: Locked. **Server:** NOT redeployed —
the repo's `index.ts` now requires `situation` and carries the phase gate +
bundle R-398; deploying is Sam's call (the phone build already runs the
client gate; the deployed v10 accepts the extra fields — 12 live tapes prove
it). **Tapes:** `docs/COACH_LAB_S1_TAPES_2026-09-10.md` + review page for
Sam; row 7 (Nordic swap) still wrong on one of two runs — retrieval, S2.
Not run: gates, audits, `test:bible`.

**08:55 — Coach slice S2a BUILT (Rock 2: the rule book, fresh and findable).**
Commit 077bd39d. Measured first: the registry was cut into 72-line sliding
windows, two windows allowed per question, ranked by word overlap with the
question plus the readiness words (weight 12) — so "can i do leg curls
instead of nordics" reached R-394 on one run in two, and the readiness rows
(R-127, R-350) sat in every answer. Now: (1) the registry is ONE CHUNK PER
RULING (`chunkRulings`, boundaries `**R-nnn**` / `## R-nnn` / section /
`---`; id keeps the exact line-slice form, `ruling` names the row; rows over
1,500 chars are length-normalised so bulk cannot win); (2) the athlete's own
words seat SIX rulings first (`QUESTION_RULING_SLOTS`), ranked title-match
first — the sum of the rarity of each question term found in the row's
title, so "sprint" beats "every … week" — then the full context fills to
eight (was two); (3) the query also carries today's/the named day's session
words and the phase words, and a row naming the athlete's phase gets ×1.3
(no demotion — R-003's COD gate names all three phases). Bible and data
sources keep their overlapping windows (the readiness-adjacency cell needs
them). **WORKING:** `test:coach-retrieval-regression` (new, 18/0: eighteen
question→owning-ruling pairs, e.g. nordics→R-394, deload→R-310/R-063,
sick→R-037, away→R-018, missed→R-275, no barbell→R-212, gunshow→R-052,
starting load→R-026, sprint→R-062, cod→R-003/R-329/R-331, Christmas→R-002,
gym twice→R-235/R-237, RDL+nordic→R-233, harder Wednesday→R-395, and the
soreness question shows the Bible's soreness excerpt) — registered as a
current_contract witness (decision 210, current_contract 48);
`coachLabRetrievalTests` 22/0 unchanged; `test:compile` 0.
**Known misses, recorded not asserted:** "change of direction" in words does
not reach R-003 (the row says COD) and "two sessions a week" does not reach
the gym-days rows — vocabulary gaps keyword retrieval cannot close and the
retrieval suite forbids a phrase table; embeddings (plan 2a) are the
principled fix, deferred.
**Correction to the plan:** `test:coach-chat-integration` (the bundle
freshness cell) was ALREADY a current_contract witness in
`scripts/test-truth-decisions.json` — the audit read `release-gate.js` for a
"coach" entry, but the gate's units come from the decisions file. Nothing to
wire; the plan's §2 row is wrong on that point.
**2b/2c:** `npm run coach:deploy` (`scripts/coach-deploy.sh`) = rebuild bundle
→ `test:coach-chat-integration` + `test:coach-retrieval-regression` must be
green → `supabase functions deploy coach-chat` → receipt row in
`docs/COACH_DEPLOY_RECEIPTS.md` (sha, version, highest R, dirty count).
`COACH_CHAT_CONTRACT_VERSION = 2` (`coachChatLimits.ts`) travels inside
`modelInput`; the server answers 409 `coach_chat_contract_mismatch` on a
different number and the app shows the unavailable sentence (R-140 words
unchanged) and logs both numbers. **Consequence:** the server deploy and the
phone build must go together — the S1 phone build sends no version and the
new server would refuse it; the deployed v10 ignores the field, so the new
app works against it meanwhile.
**Not done in S2a:** Rock 3 (app map) moves to S3; the Lab tape for the
Nordic case cannot be re-run locally (`COACH_LAB_SECRET` is not on this
machine) — it is re-taped through `coach:chat:smoke` after the deploy.
