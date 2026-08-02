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
