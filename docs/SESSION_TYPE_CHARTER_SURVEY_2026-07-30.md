# The Session Type Charter — Step 1 survey

**STATUS: SURVEY ONLY. NO BEHAVIOUR CHANGED.** Sam's programmable vocabulary is
**Rest, Recovery, Strength, Conditioning, Mobility, Prehab, Gunshow**. Each row
answers his four questions with receipts. Gaps and inventions are named plainly;
nothing is smoothed over.

## The matrix

| # | Type | (a) Generator places it? | (b) Athlete door? | (c) Counted as | (d) Composition |
|---|---|---|---|---|---|
| 1 | **Rest** | YES — implicitly. A day is rest iff nothing was placed on it: `evaluator:497` `[0..6].filter(d => !activeDays.has(d))`. No rule, no authored source; rest is a RESIDUE, not a decision. | **NO add door.** Not in `CATEGORY_COPY` (`planChangeProducer:181-209`). Reached only by bin/remove — comment at `:404` "rest is owned by bin/remove rather than add". | `trueFullRestDays` (`evaluator:497`), and `full_rest_frequency` targets read it (`:714`). | n/a — has no contents. |
| 2 | **Recovery** | **YES, UNINVITED.** Five hardcoded pushes: `coachingEngine:1792, 1980, 2003, 2177, 2196`. **8 `tier: 'recovery'` sites total.** No authored source cited at any. Bible says "rest **or** recovery" and "user can always add … as optional" (`LFA_PROGRAMMING_BIBLE:79, 81, 122, 134`) — the app resolves a disjunction the Bible left to the athlete. | YES — `recovery` category, "Rolling, mobility, easy movement, breathing" (`planChangeProducer:190-193`). BUT barred from add-on-top: `categoryAddsSessionKind` → `if (addedKind === 'recovery') return false` (`:443`). | Not hard, not load: `contributions.recovery` → `dayRecovery` (`evaluator:470-477`). **BREAKS REST** — excluded from `trueFullRestDays`; 3 recovery sessions raise `default_target_miss:full_rest`. **BLOCKED cell, ruling 1 vs prior fix `section18ContractV2Tests` 8a/8b/P5.** | **INVENTED.** Names/cues authored (5 Foam Roll variants, Adductor Rockback in `exerciseCues.ts`); selection + ordering have NO authored source. No `RECOVERY` entry in `mobilityFlowTemplates.ts`. Session described by a free-text `focus` literal typed inline at the push site. |
| 3 | **Strength** | YES — `tier: 'core'`, 15 sites in `coachingEngine`. Governed by Contract v2 `mainStrength` and the §18 pattern rules — the most authored of the seven. | YES, three doors: `strength_upper`, `strength_lower`, `strength_full` (`planChangeProducer:194-205`). | `contributions.mainStrength` (`sessionClassificationAdapter:147`); hard day when stress high; counts toward load. | Authored: exercise pools + `strengthIntent` patterns, gated by the locked-list and cue gates. |
| 4 | **Conditioning** | YES — inside `tier: 'core'` allocations, with `section18ConditioningRole` typed (`coachingEngine:684`). Contract v2 `conditioning.core` governs counts. | YES, two doors: `conditioning_light`, `conditioning_hard` (`:182-189`). | `CONDITIONING_CATEGORIES` → `contributions.conditioning`; counts toward load; hard when stress high. | Authored — 55 signed conditioning templates (`conditioning-templates-v3`). **But** the athlete-facing name can leak internal text: `coachingEngine:1262, 6500` append `' + easy off-feet aerobic conditioning component'` to `focus`. |
| 5 | **Mobility** | **NO.** No `tier: 'mobility'` anywhere. `MOBILITY_FLOW_TEMPLATES` exists and is AUTHORED — 11 entries (`mobilityFlowTemplates.ts:92`) — but is consumed only by `recoveryAddonBuilder` (`:20, 524, 606, 714`), i.e. as an add-on inside Recovery, never as a session type. | **NO DOOR.** Absent from `CATEGORY_COPY` entirely. The athlete cannot add or swap to mobility. Bible: "You can **always add** a recovery or **mobility** flow to any day as optional" (`:122`) — the Bible grants it and the app does not offer it. | No representation of its own. Whatever it lands inside is counted. | **AUTHORED and unused as a type** — 11 templates, reachable only through Recovery. |
| 6 | **Prehab** | **NO** — not independently. Collapsed into the `gunshow_prehab` category (`sessionClassificationAdapter:148`). | **NO DOOR OF ITS OWN.** Shares `accessories`, whose subtitle is "Gunshow or prehab - small muscles, big payoff" (`:206-209`) — two of Sam's seven behind one label. | Not hard (correct, ruling 2): `contributions.gunshow` → `dayRecovery` (`evaluator:470-477`). Verified: prehab is NOT counted hard anywhere. | Shares gunshow's pool. **No prehab-specific authored composition.** |
| 7 | **Gunshow** | **NO `tier: 'gunshow'`** — 0 sites. Bible names it in all three ideal weekly structures ("friday **gunshow** or recovery", `:81`) and the generator never places it. It exists only as a CLASSIFICATION of content (`gunshow_prehab`) and as legacy pool sessions the resolver may materialise (`evaluator:465-467`). | Shares `accessories` with Prehab. | Not hard (correct). `contributions.gunshow`. | Pool-tagged, not template-composed. No authored gunshow SESSION. |

## What the survey found, stated plainly

**1. Three of Sam's seven cannot be placed by the generator at all** — Mobility,
Prehab, Gunshow. Gunshow is the sharpest: the Bible names it in **all three** ideal
weekly structures and there is no `tier: 'gunshow'` in the codebase.

**2. Two of the seven have no athlete door.** Mobility has none. Prehab and Gunshow
share one door called "Accessories". So the athlete's vocabulary is 5 wide where
Sam's is 7.

**3. The Bible grants Mobility explicitly and the app does not offer it.**
`:122` — "You can always add a recovery or mobility flow to any day as optional."
Eleven authored mobility templates exist and are reachable only as an add-on inside
Recovery.

**4. Recovery is the inverse defect: the only type the app places UNINVITED.**
Eight `tier: 'recovery'` sites, zero authored sources, against four Bible lines that
make it the athlete's choice. And its composition is invented — authored
vocabulary, unauthored shape.

**5. Rest is a residue, not a decision.** It is "no one placed anything", which is
why a deletion door once wrote a schedule fact and why recovery can consume it.
Under the charter, Rest should be a TYPE the athlete or a fact chooses.

**6. Counting is correct where Sam has ruled it** — gunshow, prehab, accessories
and recovery are all not-hard (ruling 2 verified). The one open conflict is
recovery-vs-rest, and it is blocked on ruling 1 against `section18ContractV2Tests`
8a/8b/P5, whose comment at `:487` records the opposite as a closed defect.

## Recommendation for Sam's ruling

The seven questions are not evenly answerable today because **only Strength and
Conditioning are full session types.** The other five are a mix of residue
(Rest), uninvited placement (Recovery), authored-but-unreachable (Mobility), and
classification-without-existence (Prehab, Gunshow).

So the charter's value is highest if it rules, per type: **who may place it, who
may choose it, what it counts as, and who authored its contents** — and then
forbids a type existing without all four. That is the "answer the same seven
questions before it exists" gate Sam asked for, and it would have caught every gap
above at the moment each was introduced.

Nothing here is implemented. Step 2 waits on Sam's rulings.
