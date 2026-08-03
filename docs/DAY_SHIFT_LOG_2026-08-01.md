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

## The silent bible suite — DIAGNOSED, FIXED, and what it hid (2026-08-03)

**Sam's priority insertion, and it earned its place.**
`onboardingReliabilityTests` exited **0 half-run** from `ea2dba3`
(2026-08-01) until today — three days in which `test:bible` read a drained
event loop as green, and blocks B2–G (including the D1 hydration-registry
pin) ran on no branch at all. Mechanism: B1 awaited a commit whose armoured
write now cascades a persist onto a later macrotask; a single
`releaseWrites()` never pumps it, the loop drains, node exits 0.

**Fixed, in order:** totals-or-red (`process.exitCode = 1` armed at module
top, cleared only by the totals line — now the pattern §9 proposed as law);
B1/B2 pumped via `whileReleasingWrites`; D1b boots through
`retryAppHydration` (the memoized settlement made the remover a cache hit);
the "complete profile" fixture answers the 07-31 required-equipment ruling
(three cells were pinning a pre-ruling profile); denominator counted, not
asserted. Suite: **24/24, honest exit.**

**WHAT THE SILENCE MASKED — the real defect:** every armoured store's
guarded storage wrapped its write `async`. Zustand fire-and-forget-`void`s
`setItem`, so an `async` wrapper's rejected promise had no handler: a
failing device write became an **UNHANDLED REJECTION on the exact path the
armour exists to protect**. Nine stores carried nine copies. Fixed at ONE
owner — `guardedDurableWrite` in `refusedPayloadQuarantine.ts`, returning
the compat layer's already-handled promise; B2 is its regression gate. The
fleet shipped that hole in every store and the only suite that would have
caught it was the one that had gone quiet.

**The bisect's own instrument lied first** (the shift's fourth): the probe
used `timeout`, absent on macOS, so every probe returned empty and read as
SILENT — including commits that were fine. Checked the checker, re-ran,
bounded the silence to `ea2dba3` with `49c8579` proven clean.

**Environment, twice:** `node_modules` was destroyed a second time — a
worktree agent's `git add -A` had COMMITTED its node_modules **symlink**
(`.gitignore`'s `node_modules/` matches directories, not symlinks), so
every `git checkout` of main clobbered the real tree with a self-loop.
Untracked, ignore hardened with the bare form and the mechanism documented,
`npm ci` restored (5s).

## Stage B §5 preconditions — REPORT ONLY, all four PASS

`docs/STAGE_B_PRECONDITION_REPORT_2026-08-03.md`. §5.1 armour (11 stores
owned, debt list empty, generation path writes only through the accepted
transaction; LR-1's 27 refs carried per the addendum's own narrowing), §5.2
lanes merged, §5.3 team-night merged, §5.4 **bible EXIT=0 with the
asterisk removed**. **Stage B is NOT started — Sam fires it himself.**

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

## §8/§9/§10 — Sam's third answer batch, all built (2026-08-03)

**§8** Batch 10-c riders SIGNED verbatim. **§10** the practice-match variant:
the fixture's own `FixtureAvailabilityKind` rides from the lane owner to the
ack owner, so the sentence and the day's card label are picked by ONE
expression and cannot disagree; both variants pinned behaviourally.
*My defect, found by a shard agent:* I changed a signed string and re-pointed
only the two cells in front of me — the walker's tape world (Sam's real
PRE-SEASON export) kept asserting the game-day wording and went red. The
agent A/B-proved it against main and correctly refused to own it. **When a
signed string changes, sweep the repo for every assertion of it.**

**§9 — TOTALS-OR-RED IS LAW, rolled through all 120 chain suites and GATED**
(`test:totals-or-red-law`, in the chain, derives its list from the chain
itself so enrolment is automatic). One owner, not 120 copies. Bible EXIT=0
fully armed at `1920d4e`.

**What the rollout FOUND — the point of the unit:**
1. **A second silent suite, worse in kind.** `durableFactHorizonTests` forks a
   child per scenario and trusts the child's EXIT CODE; each child returned
   past its only clear, so armed, all 14 came back RED **while printing
   PASS**. Parent verdict and child output had been disagreeing outright.
2. **The law had a BYPASS, proven by a mutation that SURVIVED.**
   `process.exit(0)` hard-overrides `process.exitCode` — a suite ending by
   asserting its own success cannot be armed at all. Fourteen suites carried
   it; all deleted, and the gate bans the construct.
3. **The chain's FIRST LINK was never armed.** `runSlice1` runs by direct
   invocation, not an npm script, so every script-enumerating sweep — mine
   and all four shards' — was blind to it. The gate found it on its first run.

**Three more instruments lied before telling the truth**, consistent with the
day: my recipe's first version anchored the clear to the exit-guard BESIDE
the print (passed a mutation that skipped the print — the law not holding);
the helper script read the failure variable from the template's literal WORD
(emitting an undefined `failed` where the counter is `fail` — caught
independently by three shards); and the gate's own first scan reported 14
violations that were its own comments quoting the banned call.

---

# HANDOVER — end of the 2026-08-03 shift

**Main is `fb5ca25`. `test:bible` EXIT=0, zero failures, and for the first
time this week that green has no known liar in it** (the silent suite is
repaired and runs 24/24 inside the chain). Working tree clean; every merge
`--no-ff`, ancestor-verified, branch pointer deleted; all agent worktrees
removed.

## What landed (22 first-parent merges/commits since `8f25c33`)

**The store armour fleet — LR-2 PAID.** `docs/STORE_ARMOUR_RECIPE_2026-08-03.md`
(13 lessons) distilled from the profile/program protections, then applied to
every persisted store: calendar, athlete prefs, readiness, coach updates,
coach preferences, coach mutation history, coach chat, coach memory, plus
the profile quarantine — **eleven owned, taped, quarantined**; auth and ui
RETIRED under Sam's §6 ruling with a boot-time stale-key remover (L15).
`UNPROTECTED_STORES_DEBT` is the **empty list**. Census LR-2 `declared`
11→1, baseline 114→104; the remaining 1 is `programStore` = **LR-1, the
next major unit**.

**Sam's rulings, all built:** Batch 8 + Batch 9 SIGNED; 11 icon rows
(`dfcd09e`, bin retired from imagery); LR-27 convergence (`8/8` rows, shin
added, three maps deleted, divergence pins 0/0/0/0); schedule-fact deriving
lanes (`667e3a3`, dead lane DELETED, compressed session under the 35-minute
owner); game-day inert + signed sentence (`b2fc742`); team-night movability
(`ce8ad9a`, MOVE asks / SWAP refused / permanent inline); shell retirement
(`3546c12`).

**The gate repair** (`005fd11`): see the section above — three days silent,
and it hid an unhandled-rejection crash in all nine armour wrappers.

## Open with Sam (parked: NONE — the file is empty)

All ten parked questions are answered and built. §8/§9/§10 landed in the
final hour; the previous three-item list is superseded and kept below only as
the record of what was asked.

### (superseded) Open with Sam (parked, three)

- **§8** — three PROPOSED team-night rider strings (Batch 10-c).
- **§9** — rule whether bible suites must adopt totals-or-red as LAW (the
  pattern is now precedent in two suites); and schedule LR-14's largest
  instance if more silent suites exist — nothing has swept for them.
- **§10** — the signed game-day sentence on a PRACTICE-MATCH day ("It's game
  day" vs ruling 6-IV-4's "Practice Match").

## Next by rank

1. **LR-1** — one door to the program store. 27 `.setManualOverride` refs
   across 12 files, 20 of them in `coachActions.ts`. **Read the LR-6 STOP
   first**: most of that surface is the coach pipeline, so the door lands as
   store ownership only, never as behaviour change.
2. **Stage B** — all four §5 preconditions PASS
   (`docs/STAGE_B_PRECONDITION_REPORT_2026-08-03.md`). **Sam fires it; it is
   not started.**
3. **LR-14** — the non-bible rot, now with a proven detection pattern.

## Standing hazards the next session must know

- **A worktree agent's `git add -A` can commit its node_modules symlink**
  and every later checkout of main clobbers the real tree. Ignore hardened
  (`fb5ca25`); recovery is `rm node_modules && npm ci` (~5s).
- **Agents lose their cwd** — four incidents. Every agent brief must demand
  `cd <abs worktree> &&` on every command and a `pwd` guard before any
  destructive step.
- **Never let an agent sleep on its own running gate** (Sam's standing rule,
  three stalls): foreground the gate in the agent, or the orchestrator owns
  the watcher and merges on the exit line.
- **Parallel agents paying the same census from one base auto-merge to a
  textually-identical, cumulatively-FALSE counter.** Caught twice by census
  direction 1; resolve to cumulative truth at every fleet merge.
- Pre-existing non-bible reds, each A/B-proven at clean main, none this
  shift's: `test:block-state`, `fixtureMutationTransactionTests`,
  `programControlActionsTests`, `devE2EDefaultSeedInstallationTests`.

## The shift's lesson, four instruments deep

Yesterday's lesson was "the instrument is part of the claim." Today it went
further: **a green gate is a claim about the instrument too.** A suite that
exits 0 without running, a probe that reads empty output as a verdict, a
census counter that merges cleanly into a lie, an armour wrapper whose
rejection nobody handles — each looked exactly like health. Every one was
found by checking the checker. Keep doing that; it is now four for four.

---

# LR-1 — THE LAST STORE DOOR (2026-08-03)

`docs/LR1_PROGRAM_DOOR_BOUNDARY_2026-08-03.md`. Branch
`feat/lr1-program-store-door` from `cef886f`.

**The raw override primitive is RETIRED.** `programStore.setManualOverride`
described itself as a "raw storage primitive" and 27 references across 13
files reached it — a screen, a dev seed and eleven pipeline modules, on the
surface that holds every move, bin, swap and lighten the athlete ever
performed. All 27 now route through `applyProgramOverrideWrite`, whose
`ProgramOverrideWriterId` is a CLOSED union: **an unnamed writer is a compile
error, not a gate finding.** Two typed refusals, both erasures declared under
named acts, every write on the tape (`program_override_write`, in
`DECISION_EVENTS`) applied or refused, counts and labels only. The door owns
the DECISION; `commitAcceptedStateTransaction` still owns the PUBLICATION.

Coach-path refs are NAMED, never touched — identical behaviour, LR-6 holds.
The dev seam writes as `dev_seed` and the 70 test seeding sites as `harness`,
an id cell 6 sweeps out of product code entirely.

**Census: LR-1 27 → 0, LR-2 1 → 0, baseline 104 → 76. Both entries `retired`.
Every persisted store in this app now has a write owner** — the count that
opened at eleven ends at none.

**WHAT THE WALKER CELL FOUND, and it is the point of the unit:** the cell was
written to bin a session and went red with `{}`. **No walked athlete tap door
writes `dateOverrides` any more.** Removals record a `UserRemovalConstraint`;
adds and swaps land in `weekScopedOverlays`. That is the §18 migration having
worked — the tap doors were moved off the raw surface one unit at a time and
nobody had asked what was left on it. What is left: the coach pipeline, the
lighter-day transaction, and LR-3's residuals. So the surface the census calls
"the athlete's decision surface" may now be a stored-OUTPUT surface wearing a
decision surface's name. **PARKED FOR SAM** — the door is correct either way,
but Stage B derives over these surfaces and the answer changes what it derives
from.

Gates: `programOverrideOwnershipTests` 7/7 (in the chain, totals-or-red armed),
walker 17/17 with the new wipe-replay cell (SHALLOW tier declared: 3 walked
actions, 10 days, one authored decision). Seven mutations, seven caught —
including a coach writer re-opening the raw path, caught independently by the
sweep AND by three census cells.

Recipe gains lessons 13-16; **16 is the transferable one — the §6 walker cell
is an INSTRUMENT, not a formality: write it before assuming you know who
writes the slice, and read a red precondition as a measurement.**

**cwd compliance:** own worktree, `pwd` echoed before every destructive step,
`node_modules` symlink untouched, staged by name and never `git add -A`.
