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
