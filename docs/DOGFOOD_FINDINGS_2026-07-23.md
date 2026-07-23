# Dogfood Findings — Sam, on-device, 2026-07-23

Source: Sam's first real-athlete run on a physical iPhone (clean Release
build at the 99b3c7c checkpoint, fresh onboarding — NOT a seeded program).
This surface (first-run, generation, season transitions, session lifecycle)
was NEVER covered by the QA contract, which scoped only the week-editing
mutation surface on seeded in-season programs. That scoping gap is the
finding behind all findings.

Severity: 🔴 wrong/broken · 🟡 confusing/inconsistent · ⚪ polish
Provenance: NEW = first time recorded · KNOWN-NOT-BUILT = flow recorded as
unbuilt 2026-07-22 but its UI shipped anyway · DEFERRED = previously found
and consciously postponed (decision now re-opened).

---

## GROUP E — First-run & onboarding experience

| # | Finding | Sev | Provenance |
|---|---------|-----|------------|
| E1 | App icon on device is the old one — new ball icon never wired into the native iOS asset catalog (ios/…/AppIcon.appiconset); assets/icon.png alone doesn't reach a checked-in native project | 🔴 | NEW (wiring miss, fix known) |
| E2 | "Built for footy" first screen: dead empty space at bottom | ⚪ | NEW |
| E3 | Keyboard covers the Continue button on name + height/weight screens; button should ride above the keypad | 🔴 | NEW |
| E4 | Input-dismiss inconsistency: name screen accepts keypad tick, height/weight requires tapping blank space before Continue is reachable | 🟡 | NEW |
| E5 | "Building my program" wait screen: layout gap below "built for local footy" | ⚪ | NEW |
| E6 | Sign-up-date blindness: on a Thursday signup, app asks about Mon–Wed sessions the athlete could never have done, and counts them missed/skipped. Sessions may display for context but must be exempt from done/missed accounting before signup date | 🔴 | NEW — design gap |
| E7 | Weight-entry keypad: "Done" overlay can cover the weight field so you can't see what you're typing | 🟡 | NEW |

Systemic fix direction for E3/E4/E7: ONE keyboard-avoidance + input-accessory
convention applied to every text/number input in the app — not per-screen
patches (per AGENTS.md).

## GROUP F — Session lifecycle & feedback

| # | Finding | Sev | Provenance |
|---|---------|-----|------------|
| F1 | Catch-up prompt ("did you do Tuesday?"): EVERY option — skip (unresponsive), "move it forward", "missed it" — results in the session being labelled DONE. False-Done class: the exact dishonesty the ownership work exists to kill, in a flow outside the contract | 🔴 | NEW — top priority |
| F2 | Finish session → feedback form opens below the fold; must auto-scroll/present fully visible | 🔴 | NEW |
| F3 | "Fully"/"Partially" follow-up popups cut off (same presentation bug family as F2) | 🔴 | NEW |
| F4 | Game-day feedback says "How did the session feel?" — should be game-specific copy ("How did the game feel?") | 🟡 | NEW |
| F5 | Game day: "Save and finish" unresponsive (works on gym + TT days) | 🔴 | NEW |
| F6 | Mid-session injury flow ("something hurts" → shoulder → 8/10 → "Stop affected training" warning → "Pause for affected training"): tapping it changes NOTHING — session unchanged, no visible effect at all | 🔴 | NEW — false-affordance/false-Done family |
| F7 | "Repeat this week into next week" — why so prominent? Purpose unclear to the athlete. Product question: keep/demote/hide | 🟡 | NEW [SAM GATE] |

## GROUP G — Program generation quality & season transitions

| # | Finding | Sev | Provenance |
|---|---------|-----|------------|
| G1 | Week 1 good; weeks 2–3 collapse to 2–3 exercises/day (vs ~6) | 🔴 | DEFERRED (Sam flagged 2026-07-22 as post-v1 "density") — RE-OPENED, proposed pre-v1 |
| G2 | Session construction: box squat at start AND back squat at end of same lower session — programming-invalid ordering | 🔴 | NEW — programming rules |
| G3 | Swap candidate pool: Copenhagen plank offered "easy bike" as a swap — swap candidates must respect movement category/intent | 🔴 | NEW — programming rules |
| G4 | Exercise notes/cues: quality inconsistent; provenance unknown even to Sam — needs an authored, reviewed source | 🟡 | NEW [SAM GATE on voice/content] |
| G5 | Off-season week shape wrong: LBS as core; trunk+groin prehab both optional; upper push optional; recovery Thu; Gunshow Fri; **a GAME DAY Saturday in off-season**; recovery Sun | 🔴 | NEW — off-season generation/fixture carryover |
| G6 | Pre-season mode shift fails: "The server returned a program, but the app could not read it." — client/server generation contract mismatch (schema drift between edge function output and client parser) | 🔴 | NEW — pipeline defect |
| G7 | "Busy week → keep me training, go lighter": semantically wrong (lighter ≠ less busy; skipping/merging addresses busyness) AND the button changes nothing | 🔴 | KNOWN-NOT-BUILT (5.4 busy flow not built; old busy=lighter path retired 2026-07-22) — but its UI shipped live |
| G8 | "Away two days this week" changes nothing | 🔴 | KNOWN-NOT-BUILT — same as G7 |
| G9 | Equipment change does nothing | 🔴 | NEW (Group B item 1 covered visible toggle wiring on sessions; the equipment-change flow itself evidently not functional end-to-end) |

## Cross-cutting

| # | Finding | Disposition |
|---|---------|-------------|
| X1 | Dead affordances shipped (G7, G8, F6 partially): buttons that LOOK functional and do nothing are worse than absence. V1 rule: every visible control either works or is removed/hidden. Sweep the app against this rule (extends Group D's dead-button philosophy app-wide) | 🔴 |
| X2 | "Not 100%" sheet: too many options at first level, weak/repeated icons. Sam's design instruction: MAX ~3 top-level options, russian-doll expansion for detail. FEED INTO the in-flight door-unification unit — do not build the old flat list into the unified door | 🔴 design input, timely |
| X3 | The QA contract itself: SUPPORTED_ATHLETE_ACTIONS.md must grow a "first-run + generation + season transition" surface, and the sweep/final-QA scripts must include a NON-SEEDED cold-start pass. A QA process that only tests seeded states is structurally blind to everything in this doc | 🔴 process |

---

## Proposed re-baselined v1 (Sam to approve/redraw)

In (existing): readiness branch merge → Group C → Group D → stack stage.
ADD (from this doc):
1. Group F false-Done items (F1, F5, F6) — same trust class as the
   ownership work; non-negotiable for v1.
2. Group E in full — every downloader sees this surface in the first 60s.
3. G6 (pre-season parse failure) + G5 (off-season game day) — mode changes
   are advertised core ("LFA shifts with your season").
4. G1 density + G2/G3 candidate-pool correctness — **[SAM GATE]** proposed
   pre-v1 (re-opening the 07-22 deferral); needs Sam's programming
   sign-off per standing rule.
5. X1 dead-affordance sweep (hide G7/G8 flows for v1 or build them —
   [SAM GATE], hiding is the fast honest option).
Post-v1 (unchanged): Journal, coach free-text, model reassessment, etc.

Estimate honesty: this adds real weeks, not days, to v1 — dominated by
Group G (programming/generation), which is design-gated on Sam, not just
execution.
