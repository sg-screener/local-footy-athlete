# Batches 4 and 6 — Sam's rulings, 2026-07-28

The last two batches of the engine-thresholds unit. Ruled conversationally, then
wired with attribution and gated.

---

## Batch 4 — the severity scale

> **ONE 1–10 severity scale serves injury and fatigue, ruled deliberately.**
> Bands are the Bible's: 1–3 / 4–5 / 6–7 / 8–10. All fatigue cut points align to
> band edges: record-only <4, moderate effects ≥4, strong/limiting effects ≥6
> (every stray ≥7 moves to ≥6), pause ≥8. Attribute all 11 to Bible §8 + this
> ruling.

The fatigue path was already using 4, 6, 7 and 8 — the injury bands' own edges —
by inheritance rather than by decision, plus a scattering of `>= 7` cut points
belonging to no band at all. Eleven sites asserted the two scales were the same
thing without anyone having ruled it once.

`7` is the interior of the 6–7 band, so a cut point there split a band the Bible
draws whole. Every one of them moved to 6. One interior `>= 5` was found during
the wiring — inside the 4–5 band, same defect — and moved to 4 under the same
ruling.

Owner: `rules/injurySeverityBands.ts`. The scale-neutral readers
(`severityIsRecordOnly` / `severityHasModerateEffect` / `severityIsLimiting` /
`severityPausesTraining`) exist because a fatigue site calling
`injurySeverityRemovesRiskyWork` reads as a mistake and invites someone to "fix"
it with a local literal — which is how the eleven got there.

Gated by `test:severity-scale`: the eleven readers may hold no severity literal,
and 6 and 7 must be indistinguishable on every predicate.

### Time caps

> **"short on time" = 35 minutes, one owner** — the coach path's 45 conforms. The
> minutes→severity conversion (`readinessConstraints:176`) dies per the existing
> law that time caps are session-scoped facts off the fatigue ladder — short time
> shapes the session, never scores the athlete. `sessionBuilder`'s ≤10/≤20-minute
> session shapes are blessed as authored.

Owner: `rules/timeAvailabilityPolicy.ts`. Two sites said 35 and one said 45, so
the same athlete on the same day was short on time through the coach and not
short on time through the readiness door.

The conversion mapped minutes onto a severity — under 20 minutes became severity
7, otherwise 5 — putting a calendar fact on the ladder where 7 means "limiting".
The constraint now carries the minutes, which is the whole fact.

---

## Batch 6 — display thresholds

All nine blessed. Where a number had two copies, the ruling collapses them to one
owner rather than blessing both.

| Threshold | Ruling | Owner |
|---|---|---|
| impact = high at ≥0.5 of the week removed | blessed | `rules/sessionImpactBands.ts` |
| impact = moderate at ≥2 sessions removed | blessed | `rules/sessionImpactBands.ts` |
| session → recovery/rebuild at ≥0.75 | keeps its existing citation (Bible §14 addendum) | unchanged |
| substitute tolerance ±0.2 loadRatio | blessed, **both sites to one owner** | `rules/substituteLoadTolerance.ts` |
| completion <0.5 = failed, <1 = partial | blessed (wording revisited in Journal work, numbers stand) | `utils/progressionHelpers.ts` |
| coach streak at 4 | blessed as deliberate — one full block earns an observation | `utils/coachingEngine.ts` |

The impact bands had two copies (`exposureEngine` and `trainAroundEngine`), as
did the substitute tolerance (`exerciseSubstitutes` twice). Collapsing them is
the part of this ruling that removes representations rather than authorising
numbers.

---

## Not covered

- **The stopped move.** Sam's ruling 1 (athlete-placed content outranks derived
  filler) is NOT implemented. The one-condition fix is contained but trades a
  move-destruction defect for a G-1 safety defect — see
  `docs/PLACED_CONTENT_PRECEDENCE_REASSESSMENT_2026-07-28.md`.
