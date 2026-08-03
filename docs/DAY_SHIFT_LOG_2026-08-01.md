# Day-shift log — 2026-08-01

Sam's standing instruction (mid-shift): unit summaries land HERE, not as
reports; the shift runs until the queue is empty, a hard block, or context
exhaustion (then a handover section at the bottom).

## Unit 1 — block rollover interim — MERGED `45d717a`
The boundary refuses typed (store untouched, tape witness); the sentence has
the one ack owner (Batch 8 PROPOSED, parked §1); week screen renders it with
retry; walker L6 re-pointed to the ruling's terms; declared red 6 paid. Deep
tier crosses block boundaries for the first time (81/53/94 days, LIVE).
`test:block-state` (non-bible) red on clean main = PRE-EXISTING (equipment
fixture rot), recorded in the unit boundary doc.

## Unit 2 — schedule-fact ownership reassessment — DOC ONLY (by rule)
`docs/SCHEDULE_FACT_OWNERSHIP_REASSESSMENT_2026-08-01.md`. The dead third
commit lane named precisely (not inert, not deriving → re-canonicalise then
always-refused). Recommendation: the fact's RULED EFFECT owns its lane;
retire the lane. Code blocked on Sam's approval + the minutes ruling
(parked §2).

## Unit 3 — team-night movability design sheet — DELIVERED
`docs/TEAM_NIGHT_MOVABILITY_SHEET_2026-08-01.md`: G-1 ask pattern, seven
strings, two design choices (Swap asks too? permanent confirms where?) —
parked §3. Build queued behind §2's approval.

## Unit 3.5 — CARD IDENTITY, ONE NAME — MERGED `d2aea03`
`getSessionComponentRows` splits trunk rows only as sole-content identity
(ruling recorded as copy sheet 7-f); L-P8 armed both tiers (red on every
bounded seed pre-fix); golden re-pinned with zero row-total deltas; the
conformance trunk-support invariant and the `trunk_as_conditioning` mutation
probe re-pointed to the row's new home — the probe's own activity check
caught the old injection going vacuous.

## Unit 4 — icon candidates — SHEET DELIVERED
`docs/ICON_CANDIDATES_SHEET_2026-08-01.md`, parked §4 for the live pick.

## Unit 5 — LR-27 — MERGED `190795f` (shape inverted by evidence)
The differential proved no body-part copy is reproducible from
`data/injuryRegions.ts` by composition — the divergences are routing POLICY
(glute+hip → one region, two different buckets; neck→shoulder; quad→knee;
'upper back'→lowerBack vs the sheet's shoulder; achilles dual-tag; shin
routable only in the copy). Shipped the GATE instead of a rewrite:
`test:injury-routing-divergence` in `test:bible` — vocabularies
source-pinned, divergence sets equality-pinned (11/11/11/3), owner routable
pinned (61). Ruling table parked §5, including the owner's own
`quadricep`(singular)→knee oddity flagged as a possible sheet typo.

## Unit 6 — cross-walk contamination — IN PROGRESS
Carriers confirmed absent from `freshInstall`: the two LR-23 in-memory
stores (`pendingCoachClarifierStore`, `coachContextStateStore`) and the
`getCoachRevisionTemplateContext` module singleton. Built
`WALKER_ORDER_PROBE` (band-independent instrument): replay one seed's walk
virgin vs after predecessors, fingerprint per action + carrier states, diff
names the first contaminated action. Probe runs next.

## Unit 6 — cross-walk contamination — CLOSED: NOT REPRODUCIBLE; instrument + resets shipped
The Task-7 observation (seeds 4-6 fail / 5-6 pass with schedule doors in the
random band) does NOT reproduce on today's tree. Built `WALKER_ORDER_PROBE`
(band-independent: replay one seed solo vs after predecessors, per-action
world fingerprint + carrier states) plus `WALKER_RANDOM_SCHEDULE_DOORS=1`
(restores the original band arrangement, probe-only). Definitive sweep:
targets 2-10, each after ALL predecessors — BYTE-IDENTICAL every time, at
the original trigger arrangement.

The investigation's real finding is about INSTRUMENTS — three separate ways
the probe itself lied before it told the truth, each now documented in the
probe's own comments: (1) `process.exit()` discards buffered stdout on a
pipe, so longer runs read as vanished walks; (2) piped-vs-file capture
differs, so the instrument's documented usage is `> file 2>&1`; (3) BSD
`seq -s,` emits a trailing comma, which parsed to a NaN target that matched
nothing — a whole false-divergence sweep from one quiet parse. The probe now
refuses malformed specs loudly. (Same lesson as the fix round's
stale-declared-red artifact: a verdict from a run with a broken instrument
in it is not evidence.)

What was TRUE and is now fixed: `freshInstall` provably missed the two
LR-23 in-memory stores (`pendingCoachClarifierStore`,
`coachContextStateStore`). Today's vocabulary cannot vary them (proven by
the probe's constant carrier columns), but the first coach-door action added
to the vocabulary would have inherited the hazard silently. Both now reset
through their own actions and the `freshInstall is total` cell CHECKS them,
so the reset lines cannot be tidied away. DECLARED, not reset: the
`getCoachRevisionTemplateContext` module singleton (third confirmed
carrier; no reset API; re-set per materialisation from live state — a
hazard only for a future vocabulary that materialises templates across
walks without re-setting context).

The original Task-7 crash evidence (shrunk history not reproducing alone)
is now best explained as the same class as everything else found today: an
artifact of instrument/arrangement, not proven state leakage — recorded
honestly as "not reproducible" rather than "fixed".

---

# Store armour unit — 2026-08-03 (LR-1+LR-2 opening)

## The unit — recipe proven on the two highest-risk stores

`docs/STORE_ARMOUR_RECIPE_2026-08-03.md` distils the profile/program stores'
four protections (one door + typed refusals · every write on the tape ·
refused-payload quarantine at the persistence writer · build failure on a
second writer) into a cold-followable recipe, then proves it on
**calendarStore** (`applyCalendarMarkedDaysWrite` — the accepted-state
publish and the coach-mutation rollback are now WRITERS of the door, not
exceptions; the COMPATIBILITY-ONLY writers terminate in one owner) and
**athletePreferencesStore** (`applyAthletePrefsWrite` — exclusions, pins and
active injuries are refusable answers). Two new bible suites
(`test:calendar-ownership` 7 cells, `test:athlete-prefs-ownership` 6 cells);
`calendar_write` / `athlete_prefs_write` join the tape's typed vocabulary
and its decision-event survivor set.

**Ratchets paid, same commits:** writer-audit debt 11 → 9 (both stores left
`UNPROTECTED_STORES_DEBT` the commit their boundary registered); census LR-2
`declared` 11 → 9, `LEGACY_DEBT_BASELINE` 114 → 112, both registry entries
owned+taped (309/309).

**Walker:** two refusal-replay cells — the wipe attempted against a WALKED
world (shallow tier, depth stated per L13: 5 actions, one week crossed),
typed refusal, byte-identical survival, tape witness COUNTED not
index-sliced (a walked ring sits at cap where append+trim keeps length
constant — the shift's instrument lesson, again). Walker 10/10.

**Mutations: five applied, five caught** (door bypass → sweep; refusal
deleted → 3 cells; tape silenced → taped-either-way; boundary unregistered →
writer audit; census un-paid → four census cells). Table in the recipe doc.

**L12 — what catches the NEXT one:** a new persisted store is caught twice
over (audit's registry enumeration + census's unowned-by-default); a new
writer around either door is a build failure; the next store to armour
follows the recipe + its ten recorded lessons, so the class's fix is now a
procedure, not an investigation.

**Convergence (north star):** toward. No new stored state; two stores of
INPUTS became refusable, taped, quarantined ledger-shaped stores.

**NOT-COVERED:** nine stores still on the recipe's fleet table (the
parallelize-across-worktrees phase, next session); LR-1 proper
(`setManualOverride`, 27 refs) untouched; the two hand-maintained registries
(appHydrationGate 12 handles / resetCoach 22 clears) not yet collapsed —
LR-2's remainder; the walker vocabulary has NO preference action (declared
in the cell — prefs state is acted in cells, not proposed in walks); the
calendar sweep is product-code scoped (31 seeding suites are the walker's
arc, declared in the cell). Pre-existing reds proven at `main` in a detached
worktree, not inherited: `fixtureMutationTransactionTests` (1/13, equipment
`ProgramGenError` — the same rot family as `test:block-state`) and
`programControlActionsTests` (orphan suite, LR-14's lane).

## Icon picks — 2026-08-03

Sam's 11 icon rulings (parked §4) shipped as ONE commit, two files
(`HomeScreenV2.tsx`, `PlanChangeSheet.tsx`): 1 stopwatch (was hourglass) ·
2 thermometer (was pulse) · 3 plaster KEPT · 4 dumbbell-with-slash (was
plain MCI dumbbell, redrawn in the surface's inline-SVG idiom) · 5 two
arrows circling (was straight pair — now the SAME mark the day screen's
`SwapIcon` and `RowIcon`'s 'refresh' already draw) · 6 plus KEPT · 7 arrow
INTO calendar day (arrow used to LEAVE) · 8 minus-in-circle (was a bin;
the retired verb retired in imagery; propagates through `binScopeIcon`
`whole_day` and both blocked steps — a repo sweep found no other bin glyph
anywhere) · 9 flexed arm KEPT (current already the ruled glyph) · 10 figure
stretching KEPT (ditto) · 11 rollover retry confirmed NO ICON, text stands.
KEEP-unless-vetoed confirmed untouched: shield / globe / the three
WeekReadinessSheet fixes.

**The gate was MANUAL:** ruling 10's adjacency check has no automated home
— it shipped as "imagery, no per-icon signing" (§6-II-h) and no test pins
a shape (`planChangeProducerTests` pins only that each row CARRIES its
icon). Per-surface row-order + glyph listing is in the commit message
(`037be1f`); no adjacent pair shares a glyph on any of the six surfaces.
No new source-parsing gate invented — a shape-coupled gate is the
AGENTS.md de-duplication trap.

**Convergence:** neutral-to-toward — no new stored state, no new
representations; three cross-surface glyph vocabularies (swap, remove,
sick) CONVERGED to one mark per meaning.

**NOT-COVERED:** imagery is judged on glass — Sam eyeballs all 11 on his
next device build, no dedicated pass. Move DESTINATION rows still repeat
the swap mark on consecutive occupied days (pre-existing occupancy-status
semantics, unchanged, flagged in the commit). The `equipmentIconFor`
per-item glyphs and coach surfaces untouched (not in the ruling; LR-6
STOP respected).

## Fleet wave 1 + fix round — MERGED (2026-08-03)

Wave 1b `b5340a2` (coachPreferences + coachMutationHistory, agent-built per
the recipe, bible EXIT=0 on identical base). Fix round `c2b60e2`: the second
application found two defects in the FIRST — removing the last
exclusion/pin/injury was refused (the athlete could not take an answer
back; now a named erasure via `applyRemovalThroughDoor`), and
`resetActionId` never reached the tape ANYWHERE (the diagnostics filter
eats keys containing "set" — doors now emit `erasureActId`; the profile
door's stripped field recorded as known). Recipe lessons 11+12. Full bible
EXIT=0. Wave 1a `232259c` (readiness + coachUpdates): census counters
auto-merged WRONG (both waves paid from one base — textually identical,
cumulatively false); reset to truth declared 5 / baseline 108, census gate
309/309 — the ratchet catching a silent bad merge is the ratchet working.
Walker: SIX refusal-replay cells, 14/14. Audit debt: 5 stores wipeable.

## Icons `dfcd09e` + LR-27 convergence merged (2026-08-03)

All 11 icon rows per Sam's ruling (bin retired from imagery everywhere;
adjacency manual per surface — no automated glyph gate exists, recorded).
LR-27: 8/8 rows converged, shin→calf added (owner 61→63), quadricep typo
fixed, three BODY_PART_TO_BUCKET maps deleted, divergence gate behavioural
at 0/0/0/0, census entry deleted per the tracked-only rule. Combined-tree
bible (wave 1a + LR-27 merges together, hand-resolved conflicts included):
**EXIT=0** — both merges are claimed green.

## THE FLEET COMPLETES — writer-audit debt ZERO (2026-08-03, `2a5b529` + `84249a6`)

Wave 2a (coachStore + coachMemory) and the tail (auth + ui + the profile
quarantine) merged; full bible EXIT=0 on the final tree. **The 2026-07-30
declared debt — "Eleven stores are still wipeable" — is paid to the empty
list.** Eleven of twelve stores owned/taped/quarantined; `programStore`'s
raw primitive is the census's last LR-2 count (declared 1, baseline 104) and
is LR-1's unit. Walker: NINE wipe-replay cells, 17/17. Recipe carries 13
lessons (12b: `field:` sweeps are blind to ES6 shorthand). Second silent
census auto-merge caught by the gate, same as the first — direction 1 has
now paid for itself twice in one day. Parked §6: auth/ui have NO product
writers at all — retire-or-wire is Sam's call. Fleet honesty finds worth
reading in the agents' unit docs: chat history ruled material (AGENTS.md
names it a follow-up-resolution input); `addNote`'s Date.now() id collides
within a millisecond (recorded, LR-6-held).

## Team-night MERGED `ce8ad9a` + the environment incident (2026-08-03)

The anchor moves through the ask (one-off on the deriving lane, permanent
through the one setup owner, SWAP stays refused); its census red was fixed
by LR-4's own migration (liveAthleteContext), not declared; the re-point at
`f36804a` inverts exactly the assertion whose premise the ruling changed —
scrutinized and approved. Gate owned at TOP LEVEL per Sam's new standing
rule (a sleeping agent waiting on a finished shell stalled three times
before the rule; the rule is now memory + this log). Bible EXIT=0 on the
branch; merge delta docs-only, docs gates + census + compile green on the
merged tree. **Environment incident:** an agent's node_modules "cleanup" ran
with its cwd in the PRIMARY checkout — the real node_modules deleted, a
self-loop symlink left behind; recovered with `npm ci` (5s, cache); the
retirement agent was wrongly suspected and exonerated by its own
cd-prefixed command log, which is now the mandated standard for every
worktree agent. FOUR cwd-class incidents this shift; every future agent
brief carries the pwd-guard. Parked §8 (three rider strings). Batch 9
SIGNED (`743b715`).

## Sam's five answers landed mid-shift (2026-08-02/03) — queue re-formed

All five parked questions ANSWERED; recorded in full in
`docs/PARKED_QUESTIONS_2026-08-01.md` (kept as the record). Build queue
after this unit, by size ascending: **§4 icon commit** (one commit,
icon-rule gate re-run) → **§1 Batch 8 PROPOSED→SIGNED flip** → **§5 LR-27
convergence** (owner's sheet wins every row; shin added; quadricep typo;
each ruled row drops its pin in the converging commit) → **§2 schedule-fact
lanes** (option 2 approved; dead lane retired; short-on-time = compressed
session under the 35-minute time-cap owner) → **§3 team-night build**
(behind §2's lanes; MOVE asks, SWAP stays refused; permanent confirms
inline).

---

## HANDOVER (context exhausted — next session continues the shift)

**Merged to main this shift, in order:** `45d717a` (rollover interim),
`d2aea03` (card identity), `190795f` (LR-27 divergence gate), `ba5fb04`
(contamination closed + order probe). Every merge --no-ff, ancestor-verified,
pointer deleted; `test:bible` EXIT=0 before each. Working tree clean; branch:
main.

**Queue position:** units 1-6 done (2 and 3 as docs, code parked on Sam).
NEXT = the census by rank. Sam's standing ruling (memory:
legacy-reckoning-census-ratchet): **LR-1 + LR-2 next** — the raw
program-write primitive and the ten unowned stores. Both are LARGE; read
`docs/LEGACY_RECKONING_CENSUS_2026-07-30.md` §LR-1/LR-2 before starting, and
note LR-24 (action-log coverage) is folded into them by the census's own
terms. Ground rules unchanged: scratch branch per unit, merge only on a green
bible, log here, park Sam-things in `docs/PARKED_QUESTIONS_2026-08-01.md`.

**Open with Sam (parked, five entries):** §1 Batch 8 signatures (rollover
sentence + "Try again"); §2 schedule-fact reassessment approval + "how short
is short?"; §3 team-night sheet strings + two choices; §4 icon live pick;
§5 the LR-27 routing table (incl. the possible `quadricep` sheet typo).

**Standing hazards the next session should know:** `test:block-state` is
non-bible and red on clean main (pre-existing equipment-fixture rot — rot
sweep's, not any unit's); the `getCoachRevisionTemplateContext` singleton is
a declared cross-walk carrier if coach-door vocabulary ever joins the
walker; the order probe's documented usage is `> file 2>&1` (pipes lie).

**The shift's recurring lesson, three units running:** the instrument is
part of the claim. A stale declared red from truncated walks, a vacuous
mutation probe caught by its own activity check, and a false-divergence
sweep from a trailing comma — each found because a gate checked the
CHECKER. Keep doing that.

---

# LR-27 convergence — 2026-08-03

## The unit — Sam ruled the table, every copy converged, every pin is zero

Sam answered parked §5 on 2026-08-02: **the owner's sheet wins every row**
(glute→hip · hip→hip · neck→neck · quad→quad · upper back→shoulder ·
achilles→calf single-target · shin ADDED →calf · `quadricep` singular
corrected to quad, a sheet typo). Built on `feat/lr27-convergence`, five
commits, each convergence dropping its divergence pins in the same commit:

1. **The sheet, then the owner** — shin/shins→calf and the quadricep
   correction land in `INJURY_MATRIX_RULINGS_2026-07-28.json` with the
   ruling cited; the generator's inheritance is FROZEN as a snapshot
   (verified byte-identical before amending — it used to read the five
   copies live from the tree, which regeneration can no longer depend on);
   owner regenerated 61→63 phrases.
2. **programAdjustmentEngine** — `BODY_PART_TO_BUCKET` deleted;
   `resolveInjuryBucket` delegates to the owner (pendingInjuryResolver
   converges transitively); hip/quad classify lower, neck upper, ribs to
   the back default; exposure/replacement tables fall back as documented
   rather than growing unsigned copy.
3. **injuryAdjustmentEngine** — the mirrored map deleted; detected tokens
   route through the owner; measured END TO END by the gate through
   `extractInjuryContext` over its whole extraction vocabulary.
4. **coachConstraintProducers** — map deleted; soreness resolves direct
   then inner-word over the owner's routable phrases (the old
   'ankle/foot'/'wrist/hand' identity keys still land via the scan).
5. **sessionBuilder** — `INJURY_BODY_AREA_MAP` deleted; what remains is
   only the tag RENAME (total over `InjuryRegion`, build-failing on a new
   region) and `injuryTagsForBodyArea` deriving ONE tag from the owner —
   single-target per the ruling, so achilles means calf and shin means
   calf; description scanning word-bounded so 'dribbling' is not a rib.

**The gate's end state** (`test:injury-routing-divergence`, in the bible):
all four doors asked BEHAVIOURALLY through exported surfaces — pins
programAdjustmentEngine **0**, injuryAdjustmentEngine **0**,
coachConstraintProducers **0**, sessionBuilderTags **0**; owner routable
pinned 63; retired literals pinned GONE. Zero is where the pins end: a
divergence reappearing is a defect, never new debt.

**Census:** LR-27 entry DELETED (tracked-only units die when their work
lands, the census's own rule [3]); a tombstone comment names the ruling and
the gate that holds the surface at zero. `test:legacy-census` 299/299.
Baselines untouched — LR-27 was never detector-backed.

**North star:** toward. Four stored copies of one routing answer became one
authored owner plus three pure derivations; the divergence class is now
unrepresentable at these doors, not merely tested away.

**Suites updated to the ruled routing** (each cites the ruling inline):
`guidedInjuryMenuTotalityTests` (shin accepted, leaves the unroutable
list; trailer updated), `injuryCanonicalisationTests` (glute→hip,
quad→quad, hip→hip), `injuryAdjustmentEngineTests` (same three),
`injurySeverityBandTests` (both hip rows). In those suites the
groin/ankle/adductor/foot rows expected a pre-region vocabulary
('adductor', 'ankle') no engine ever produced — **verified red on main by
A/B against the pre-change engines** — and now pin the owner's answers.

**Pre-existing reds, verified by A/B against pre-convergence engines
(identical fail before and after; none in the bible; NOT this unit's):**
- `injuryCanonicalisationTests` "severity 6 may retain a safe
  affected-area alternative" (replacement pool, hardcoded hamstring);
- `injuryAdjustmentEngineTests` ×2 Back Squat rows (same family);
- `trainAroundEngineTests` "Goblet Squat preserved";
- `coachInjuryIntegrationTests` "store: Goblet Squat preserved";
- `injuryEpisodeCommandTests` TraceV2 root reuse;
- `injuryEpisodeTransactionTests` "unrelated fact has its own visible
  program effect";
- `injuryReadinessCoachNotesTests` ×2 (hamstring/shoulder note copy);
- `tapSwapHierarchyTests` crashes in `capacityRubric.scoreCapacity`.

**NOT-COVERED:** the walker was not extended with an injury-door action
that speaks the new rows (glute/shin through a real door at depth — the
gate asks resolvers, not walked athletes); the free-text inner-word scans
(coachConstraintProducers, sessionBuilder descriptions) are pinned only at
phrase granularity, not against adversarial sentences; the BUCKET_EXPOSURE
/ avoid-bullet fallbacks for the newly reachable buckets (hip, quad, neck,
ribs) render the generic severity copy — whether Sam wants authored
exposure rows for them is HIS call and was not asked; the eight
pre-existing reds above are recorded, not diagnosed. **L12 — what catches
the next one of this class:** the gate now measures behaviour through
exported doors, so the next divergence cannot hide in a literal a parser
stopped matching; what it would NOT catch is a fifth door that never
imports the owner at all — the census completeness direction (a detector
for `Record<string, Injury...>` literals outside `data/`) is the missing
sweep, and it was not built here.


# Schedule-fact deriving lanes — 2026-08-03

## The unit — the fact's ruled effect owns its commit lane; the dead lane is gone

Option 2 of `docs/SCHEDULE_FACT_OWNERSHIP_REASSESSMENT_2026-08-01.md`, built
as Sam approved it verbatim (2026-08-02) on `feat/schedule-fact-lanes`,
tests first (six cells red against the dead lane before a line of product
code moved). Final shape:

- **DERIVING (ruled effects):** fatigue, injury — and now `schedule/
  time_cap` per the minutes ruling. "Short on time today" records a
  today-scoped time-cap fact at the one 35-minute owner
  (`SHORT_ON_TIME_MINUTES`) and scoped-regen delivers the COMPRESSED
  session — main lift byte-identical, accessory sets halved, hard finisher
  dropped, via the Bible §9 authored trim (`applyLighterDayTrim`), no new
  content authority. Clear cascade-reverts byte-exact (illness precedent).
- **INERT (unruled):** busy_week, travel, max_sessions, equipment through
  this boundary — recorded and honest: fact + constraint land, program
  byte-unchanged, off the whole-week §18 gate, no overlay, no adjustment.
  The away door is alive as record-only; its ack says so.
- **DELETED, not guarded:** the third lane — the re-canonicalising mutate
  whose own verifier refused it on every device
  (`accepted_composition_base_changed_by_temporary_fact`). Fact commits are
  `forward_decision` at the accepted boundary: a pre-existing shortfall in
  some week records and discloses, it does not refuse recording a fact.

**Two standing lies paid beyond the lanes:** the cap owner's
`durationMinutes > cap` guard NEVER fired on real generated weeks (core
sessions state 0 minutes — the whole cap machinery was vacuous on exactly
the content it existed for, declared red 9's deeper shape); and 6-II-e's
modifier body ("drops the highest-cost work") is now TRUE and ships from
`timeCapProjection` for the door's fact. Declared reds 1 and 2 in
`programControlDurableOwnershipTests` and the walker's refuses-conservatively
cells are DELETED as paid, rewritten as the lanes' laws. Copy: Batch 9
PROPOSED (the §6-V re-signing — both success sentences with effect clauses,
selected by the COMMITTED result). `illnessClearGameWeek` P1 rewritten to
the lanes (its old premise WAS the dead lane); ownership-scoping payload
kept.

**Mutations: five applied, five caught — one only after it taught us.**
time_cap dropped from the deriving set (deriving cell) · travel smuggled in
(inert cell) · preserveExact flipped off, the dead lane's writer
resurrected (two cells) · door regressed to minting busy (three cells) ·
the trim deleted while the cap stamps durations — SURVIVED the end-to-end
cell (regen variance satisfies "today changed" without any cut), so the
compression law got an owner-level cell over deterministic input; re-run
under the same mutation: caught.

**L13 — depth reached:** the walker's schedule-door cells commit through
the REAL executor (`executeProgramControlActionDurably`) in fresh walked
worlds (onboard → generate → clock-hops until today holds a session, ≤13
actions); the tape-world cell holds Sam's exact 2026-08-01 coordinate at
depth (game marked ON the tap day + active week-scoped busy fact, 5+
actions) — where the deriving regen refuses on the pre-existing
game-marked-week §18 family (`planner_selected_target_miss`; the
established severe-illness lane refuses identically there, probed) and the
athlete now gets the honest typed refusal instead of the old silence.
Parked §6: what "short on time" should DO on a fixture day. Deep tier
unchanged (its walks exercise the state-reachers; the random-band promotion
of the schedule doors is a separate vocabulary decision, below).

**L12 — what catches the NEXT dead lane:** the class was "a writer and its
verifier disagreeing about one commit, visible only on devices" — now (1)
the commit site has exactly TWO shapes and the non-regen one is
base-preserving by construction, so the contradiction is unrepresentable at
this boundary; (2) the durable suite's lane cells assert each lane's whole
signature (ok + changedProgram + base bytes + overlay/adjustment counts),
so a lane change cannot hide behind a green `ok`; (3) the mutation round is
recorded above so the next lane edit re-runs it. What this does NOT catch:
a NEW transaction boundary (outside `commitTemporarySourceFactSet`) growing
its own third lane — the census's writer-audit direction, not this unit's.

**Convergence (north star):** toward. No new stored state (the compressed
session is DERIVED at read from fact + cap owner, never stored); two of the
five representations of "the athlete is short on time" died with the lane
(the thrown-away re-canonicalised base; the ack's implicit false claim);
the fact stored is the ruling's own answer (35, once, from the owner).

**NOT-COVERED:** the legacy busy-week activeConstraint writers and the
migration's week-scoped busy fact (reassessment Q6) are census work, sized
small, untouched here per its own terms; the schedule doors stay OUT of the
walker's random band (order-probe arrangement preserved — promoting them is
a vocabulary decision that reshuffles every seed's world, not smuggled in
with the lanes); busy/away EFFECTS remain unruled (record-only by ruling)
— when Sam rules them they join the deriving set the same way; the
fixture-day coordinate is parked (§6), answered honestly meanwhile;
`equipmentScheduleFactTransactionTests` red is PRE-EXISTING at clean main
(A/B in a detached worktree: identical FAIL + abort at the same line; not
in the bible), as are `coachLivePathV2IntegrationTests`'s two Fri-collapse
failures (same A/B method, identical at main; also not in the bible);
coach free-text time_cap facts now derive when a program exists — coach
files untouched (LR-6 STOP respected; the coach path enters the same one
boundary).


# Team-night movability — 2026-08-03

## The unit — the ask replaces the refusal; both routes ride existing owners

Sam's §3 answers built as signed (`feat/team-night-movability`): MOVE on a
team night raises the typed ask ("Move team training?" / "Is this a one-off,
or has your club changed nights?") — two routes + back, G-1 ask chrome, all
seven signed strings registered in `src/rules/teamNightMoveAsk.ts` via
`registerSignedCopy` (extraction ceiling untouched; copy sheet Batch 10).
SWAP on a team night is UNCHANGED — its own signed refusal stands. The
`anchored_day` sentence is RETIRED (no reachable cause; deleted from the
producer, 6-II-b row converted to prose, TN-5 pins its absence).

**One-off** = a dated `team_night_move` schedule fact (week scope, the dated
pair on the fact) through the approved deriving lane. Its ruled effect is an
ANCHOR RELOCATION (`rules/teamNightMoveDerivation.ts`): a sparse TWO-DATE
overlay over the week the athlete actually has — landing day COMBINED per the
doubling law (`stackSessionOntoTeamAnchor`), vacated day the split remainder
(`splitAcceptedSessionForAthleteMove`, `team_component`), every other day
falling through to untouched stored state by construction. Deliberately NO
contract on the overlay: attaching the finalised evaluation contract made the
rebase re-author planner-derived rows on untouched days. The lane is
otherwise the illness precedent unchanged — fact-linked adjustment, atomic
forward_decision commit, undo = the generic `clear_fatigue_status` cascade
(reverts by `sourceFactId`, byte-exact, no team-night special case).

**Permanent** = `teamNightPermanentPatch` (pure `Partial<OnboardingData>`) →
`commitProfileProgramTransaction({kind:'profile_setup'})` — the ONE setup
owner writes `teamTrainingDays` through the profile store's armoured door and
regenerates forward; confirmed INLINE in the ask (signed success sentence as
the result-step ack, no deep-link). No second writer exists; TN-3's source
gate pins the door's only path is the owner.

Both routes enter through `programControlActionForPlanChange` →
`executeProgramControlActionDurably` (`type: 'move_team_night'`) — the same
one door the sheet and harness share. A ROUTELESS change never maps (TN-1b).

## Gates (the sheet's pre-commits) — `test:team-night-movability`, in `test:bible`

TN-1 ask on a team night exactly (plain day refuses `not_a_team_night`, no
ask) · TN-1b routeless never commits · TN-2 one-off conserves every other
day byte-for-byte at the stored boundary (overlay carries exactly two dates;
base program byte-identical) and undoes clean through the cascade · TN-4
doubling law on occupied AND empty landing days · TN-3 permanent updates the
one owner + the no-second-writer source gate · TN-5 team scope offered +
retired sentence absent. Depth stated per L13: shallow tier, seeded world,
1-2 actions per cell; accumulated-life coverage rides the walker's worlds
(team nights come from `TEAM_DAY_SETS` profiles; `plan_change` move
vocabulary reaches them — the proposer was NOT extended: promoting
`move_team_night` into the random band is a vocabulary decision that
reshuffles every seed's world, the same NOT-COVERED ruling the schedule
doors recorded).

## Mutations: three applied, three caught — one only after it taught us

anchor condition dropped from the preview gate (TN-1) · `team_night_move`
dropped from the deriving set (TN-2 end-to-end) · the mapping widened to
routeless changes — SURVIVED the original six cells (the sheet still asked;
any other caller could commit unasked), so the commit boundary got its own
cell (TN-1b); re-run under the same mutation: caught.

## L12 — what catches the next one

The class was "a refusal standing in for a question": the gate is now typed
at THREE boundaries (preview raises the ask, the mapping refuses routeless
changes, the executor takes only answered routes), and each boundary has a
cell that reds alone. A new anchor-guarding door copies the shape or fails
TN-1's pattern.

## Convergence (north star): toward

No new stored state: the one-off is a typed dated life-fact (an input); the
permanent change is a profile answer through its owner; the visible move is
DERIVED (overlay from fact, cascade-reverted on resolve). One representation
of "team training moved" — the fact — and the retired refusal sentence took
a dead branch of the move vocabulary with it (`anchored_day` deleted from
the reason union).

## NOT-COVERED, stated honestly

The walker proposer does not draw `move_team_night` in the random band (see
above — a vocabulary decision, parked with the schedule doors' identical
ruling); door-matrix grid rows were not added — the route × occupied/empty
coordinates live in the dedicated suite's cells instead; the three Batch
10-c rider strings (scope row, occupied-landing sub-line, modifier card) are
PROPOSED and parked §8; fixture-adjacent landing days (G-1/G+1) accept the
anchor but the game-proximity derivation re-dresses those days at render —
behaviour observed and left to the existing G-1/G+1 owners, not ruled here;
conservation is asserted at the STORED boundary — resolver-owned derivations
(G-1 gunshow, planner optionals, read-time conditioning placement) re-derive
around the week's new shape by design, which is the sheet's own "the week
re-derives around it".

## Shell retirement — 2026-08-03

Branch `feat/retire-auth-ui-shells`. Sam's §6 ruling executed: authStore and
uiStore RETIRED WHOLE. Investigation before deletion confirmed the ruling's
premise and sharpened it: git history DOES contain writers for both stores
(SignIn/SignUpScreen wrote the auth session; PreferencesScreen wrote
designVersion) — but all were dead code from birth: AuthNavigator was never
mounted by RootNavigator in any commit, PreferencesScreen was never
registered in any navigator, and all died in the Phase 1.6 purge. No
reachable screen ever wrote either store, so no device envelope can hold
anything but defaults. The STOP condition ("evidence a real value could have
been written") was checked and does not fire; the check is on the record.

**What died:** both store files whole (doors, tapes, reset acts, quarantine
registrations, guarded storages), both ownership suites + their package.json
scripts + their `test:bible` entries, the walker's auth refusal-replay cell
(suite now 16 cells, stated), the `auth_write`/`ui_store_write` names in
DECISION_EVENTS and AthleteActionEventName, the two hydration-registry
handles, the store-index exports + clearAllStores lines, the dev-seed clear,
the dev-E2E ui-store descriptor and its coordinator-test pins.

**What was kept, per field:** nothing — `activeTab`/`isOnline` (the runtime
conveniences) had ZERO live readers and zero writers outside the store
itself, so there was no live runtime state to relocate; HomeScreen's
`DesignVersion` type is now a local two-literal type beside the hardcoded
constant that was already shadowing the store.

**The boot cleanup (L15):** `RETIRED_STORE_PERSIST_KEYS` +
`removeRetiredStoreEnvelopes()` beside the hydration registry;
`awaitAppHydration()` awaits it before settling. Deletion IS the read-ingress
lift for a shape that never carried a value.

**Census:** zero counter edits — both stores were already owned (LR-2
declared stays 1 = programStore, baseline stays 104); entries deleted with
their files, narration corrected (27+1+4+72), retirement noted. D1 in
onboardingReliabilityTests re-pinned >=10 with the retirement cited.

**Mutations (all caught):** remover no-ops → behavioural cell; boot stops
calling it → static pin; retired key re-registered → stay-retired cell AND
the audit's enumeration cell (bonus catch: a re-registered shell has no
boundary).

**L12 — the next defect of this class:** a suite that dies mid-run with exit
0 is green to an exit-code gate. The audit suite now holds the process red
until its totals line prints; §9 asks Sam to make that pattern law.

**NOT-COVERED:** `onboardingReliabilityTests` blocks B2-G are DEAD on clean
main (silent exit 0 after B1; A/B-proven, mechanism traced, parked §9) — the
new D1b cell is correct but inert there; the load-bearing pins live in
`storedStateWriterAuditTests`. The B1/B2 harness repair is deliberately NOT
attempted here (two defects deep, touches commit/flush pump + profile armour
write path). `clearAllStores` in store/index.ts has zero callers — dead code
kept as-is, not this unit's surface. Device pass not run (no visible surface
changed; the deleted state was invisible by construction).

**North star: TOWARD — this unit DELETES stored state.** Two persisted
stores that only ever held their own defaults are gone, and what that
proves: the recipe + writer-audit ratchet made retirement safe — any future
sign-in flow or UI store must arrive through the audit's enumeration,
armoured, and must take its key off the retired list in the same commit.
Stored non-decisions died; the machinery that prevents their silent return
is the part that survives.
