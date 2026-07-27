# Journal Design — Addendum (2026-07-28)

**Status: candidate features, recorded for future selection. Nothing in this addendum is scheduled or ruled — including items phrased "adopted", which are review recommendations, not Sam rulings. The Journal build unit (Phase 5C) selects from this list with Sam's sign-off at that time. The base design in JOURNAL_DESIGN_2026-07-23.md stands unchanged; where this addendum conflicts with the base doc, the base doc wins until Sam rules otherwise.**

Source: external design feedback reviewed by Sam and Cowork, 2026-07-28. Items below were assessed against the app as it stands and found compatible with the Journal's hard rules (deterministic, on-device, record-only projection, no gamification, no AI summaries).

## Organising idea

The Journal should answer a closed loop, not act as a diary:
**Week intention → what actually happened → what was protected → what is changing over time.**

Progress means different things by season phase. An athlete must never read "no PBs in round 14" as going backwards. In-season progress can mean: strength maintained, speed exposure kept, work completed without excessive fatigue, feeling physically capable after games, no repeated disruption from the same niggle.

## Group 1 — nearly free: the app already computes this data, the feature is presentation

1. **Key exposures, not completion counts.** Show "Strength 2/2 · Speed 1/1 · Team 2/2 · Game completed · Optional 0/1" instead of "5 of 6 sessions". This is a direct read of the weekly exposure contract (§18) — the same data that validates program edits. No "83% complete" anywhere.

2. **What changed / what was protected.** Every athlete-initiated change already routes through the transaction owner, which records disclosures, relocations, and what survived. The Journal reads that ledger and shows: what moved and why, and what the system protected ("lower-body strength exposure remained four days before the game; game day protected"). Record-only — changes are made elsewhere, documented here.

3. **Week status — one calm, plain-language line, fully deterministic.** Candidate statuses: *Week achieved its purpose / Key work was protected / Recovery needs watching / Disrupted week / Building your baseline.* Computed from exposure-contract satisfaction plus active facts. Never a score out of 100.

4. **This week's job.** A deterministic opening line derived from season phase + the week's contract (e.g. in-season: "Maintain lower-body strength, complete one speed exposure and arrive ready for Saturday"). The Monday card then answers whether the week did its job.

5. **Week shape strip.** Tiny Mon–Sun strip using the existing day taxonomy (Hard / Moderate / Easy / Rest / Game / Recovery), plus simple spacing observations ("hardest lower-body session was five days before the game"). Placement matters, not just amount.

6. **Post-game question wording (candidate).** "How did your body feel after the game?" with anchors 1 Very beat up / 2 More sore than usual / 3 About normal / 4 Physically good / 5 Very good. Physical, not emotional — prevents rating the match result.

7. **Extra tags (candidate).** Add sleep, illness, travel to the existing tag set (recovery, mobility, injury, diet, work stress). Monthly review resurfaces tag patterns with tap-through to original notes. Resurfaced context, never generated summaries.

## Group 2 — real but small builds

8. **"Session felt different" exception.** One tap after a session: As expected / Harder than expected / Easier than expected / Stopped early. Only the last three ask why (soreness, energy, sleep, time, pain, equipment, motivation). Fits the assume-prescribed edit-by-exception model; per-set logging stays out.

9. **Niggle history.** Region-keyed view over existing typed injury/soreness facts and tagged notes: first mentioned, most recent, entries, latest status, sessions affected, tap-through to originals. When the athlete flags the same region again, surface the history ("you previously noted right-groin soreness on 8 May and 15 May"). Strictly record-only — no diagnosis, no causal claims.

10. **Progress markers (not achievements).** Evidence lines without gamification: "RDL increased from 90 kg × 8 to 95 kg × 8", "both weekly strength exposures maintained across the last six game weeks", "first complete training week since the ankle issue". Depends on the athlete-updated baseline / logging wire (already planned Journal/buttons work).

11. **Progressive data-state schedule (refines base doc).** Week 1: "Your Journal is building — this week establishes your starting point." Weeks 2–3: completion, exceptions, game feel, consistency. Week 4+: load vs athlete's normal. Weeks 6–8: anchor direction, repeated flags, game-feel patterns. Months: monthly and phase-level comparisons. Never a chart with one floating dot — empty space explains what will appear and what's being collected.

## Example finished weekly card (target shape)

> **THIS WEEK — Key work was protected**
> Strength 2/2 · Speed 1/1 · Team 2/2 · Game completed
> **Training load:** slightly above your four-week normal.
> **Progress:** Bench press stable. RDL 90 kg × 8 → 95 kg × 8.
> **Recovery:** Poor sleep recorded twice. Right-groin soreness recorded once. Post-game body feel: 4/5.
> **What changed:** Thursday upper session moved to Friday — work.
> **Observation:** You completed every key exposure despite moving one session. Two poor-sleep flags occurred during a slightly higher-than-normal week.
> **Your note:** Busy week at work but felt much better than expected on Saturday. *Tags: Work stress · Recovery*

The whole story in ~10 seconds. Roughly 80% written for the athlete, 20% by the athlete.

## Two build constraints (Cowork's riders, to honour when this is built)

1. **Reasons are only partially captured today.** The ledger records what changed; the *why* exists only where a flow asked for it (facts carry kinds; busy/away capture is hidden for launch). The Journal must have an honest "no reason recorded" state — it never invents a reason.

2. **Every status line and observation sentence is athlete-affecting authored copy.** "Key work was protected" is a claim the app makes to an athlete. All status vocabulary and observation-line templates must be Sam-authored and provenance-locked, same standard as cues — the Journal must not become a new channel of unauthored content.

## Reaffirmed avoid-list

No daily questionnaires, no readiness scores out of 100, no streaks, no badges, no compliance leaderboards, no chart walls. The Journal repeatedly reinforces: one difficult week is a data point, not a trend; a lighter week can still be a successful week; in-season progress can mean maintaining strength while playing well; missing optional work does not mean the program failed.
