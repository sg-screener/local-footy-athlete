# QA Scenario Cleanup Plan — Human-Readable Harness (2026-07-09)

Read-only plan. Source of truth: `docs/LFA_PROGRAMMING_BIBLE.md` (the QA harness protects its rules; Section 17 wins conflicts). Out of scope by instruction: recovery_addon, injury/readiness, speed/sprint, Coach Notes implementations, generation logic, rebuild architecture — this plan touches **test tooling only**; the acceptance test for every slice is that generation output is byte-identical.

## A. Plain-English model

The QA board should read like a coach's case list. Every scenario states who the athlete is, what week they're in, what the week SHOULD look like, and what findings are acceptable — so when something fails, the output itself tells you whether it's a real Bible violation or known noise, without tribal knowledge. Three artifacts per scenario: a typed registry entry (who/what/why), a compact week-shape summary (the Mon-Sun structure plus the counts the Bible cares about), and a diff against the committed expected shape. A failure message names the scenario in plain words ("Off-season, 4 days, no team training — Wednesday gained a second hard day") and the fix target.

## B. Current code gaps (verified at HEAD)

- Scenarios are inline `Scenario` objects in `weekPlanQA.ts` (~930 lines): `{ name, onboarding: Partial<OnboardingData>, calendarOverrides?, editFrom?, editOps? }` (:50-60). Names actually contain human text ("S6: Off-season, 4 days, no team training", :667) but everything downstream — roadmap docs, PR notes, failure chatter — uses bare S-numbers; there's no manifest, no type-safe lookup, no table of contents in output.
- **No per-scenario expectations.** `runAssertions` (:146+) applies one global rule set to every scenario; there is no `expectedWeekShape`, no `allowedFindings`, no `scenarioIntent`. "Known pre-existing failures… do not chase" lives in roadmap prose, not in code — the false-positive policy is tribal knowledge.
- **No diff tooling.** Output is `printScenario` ASCII tables (:518); comparing before/after a change is manual eyeballing, despite every slice PR being required to include a QA week-shape diff.
- **Duplicated persona setup:** each scenario hand-writes overlapping `Partial<OnboardingData>`; adding a persona is copy-paste. Region classification is re-implemented locally (`classifyRegion` :98-120 "mirrors coachingEngine") — a known duplicate (roadmap 5.2 owns consolidating classifiers; this plan must NOT do that — the QA copy stays but gets a drift-guard test).
- **Hidden assumptions:** fixed block dates (`BLOCK_START = '2026-03-23'` :78-80) and week-1 semantics are implicit; scenarios added since the Bible landed (S13 low availability, S14 injuries/readiness) have no stated intent, so nobody can tell if their output is Bible-correct or merely unchanged.
- **Coverage vs the Bible:** no bye-week-deload scenario, no deload-week scenario (3.4a landed with its own tests but no QA persona), no busy-week, practice-match, or hamstring-injury-named persona — the plans delivered today (injury/readiness, speed, recovery_addon, notes) will all need named personas.

## C. Proposed scenario registry shape

Typed `ScenarioDef` in a new `weekPlanQA/scenarios.ts`:

```
id: 'S6'                      // stable alias, kept for existing docs
slug: 'offseason-4day-no-tt'  // human key used in output + failures
humanName: 'Off-season, 4 days, no team training'
phase, persona (trainingAge/goals), availability (days + selectedDays),
gameDay?, practiceMatch?, teamTrainingDays, equipment,
constraints?: { injury?, readiness? }        // named, for S14-style personas
scenarioIntent: 'Guards the 4-day off-season S+C double structure'
expectedWeekShape: WeekShape                  // committed, see §D
allowedFindings: AllowedFinding[]             // typed false-positive policy, see below
failureNotes?: 'What a failure here usually means / where to look'
```

`AllowedFinding = { code: validator-finding-code or assertion-rule id, reason, addedBy, reviewBy? }` — every tolerated warning is explicit, dated, and owned; anything not allowed is a failure. Output prints a table of contents (id, slug, humanName, intent) at board start, and every assertion/validator line is prefixed with the slug, not the bare S-number.

## D. Proposed week-shape summary

One compact block per scenario (also the snapshot unit):

```
Mon  LWR strength (core) + easy bike finisher      Tue  TT
Wed  UPR strength (core) + glyco component         Thu  rest
Fri  Gunshow (optional)                            Sat  GAME
Sun  recovery
hard days 3/4 · main strength 2 · conditioning 3 (1 hard) · running 1 · sprint/COD 2 (TT+game) · anchors TT-Tue, game-Sat · week kind: build
stacked: Wed double (UPR+glyco) — legal pairing
```

Fields: per-day session kind/region/tier/attached-conditioning kind; then the Bible §17 counters (hard-day count vs cap, main strength count, conditioning exposures incl. hard split, running exposures, sprint/COD exposures, TT/game anchors, week kind build/deload, stacked-day notes with legality). Counters computed by the EXISTING kernel counters (`weeklyExposureCounts`) — the summary consumes them, never re-implements counting.

## E. Snapshot/diff model

Snapshot = the week-shape summary serialized as stable JSON (coarse fields only — session kind/region/tier/category per day + the counters; deliberately NOT exercise names or prescriptions, so content-level slices don't churn structure snapshots). Committed per scenario under `src/__tests__/__snapshots__/weekPlanQA/<slug>.json`. `test:qa-diff` regenerates and prints a per-scenario, per-field diff vs committed ("S6 offseason-4day-no-tt: Wed conditioning glycolytic → aerobic_base; hard days 3 → 2") — the PR-ready before/after block every slice is already required to produce manually. `expectedWeekShape` in the registry and the snapshot are the same object: expectations ARE the committed snapshot, reviewed once, diffed forever.

## F. Implementation slice order

- **QA-A — Registry + human-readable output (first, Codex-ready now).** Typed registry, slugs/humanName/intent, TOC, slug-prefixed assertion output. Zero assertion/behaviour changes.
- **QA-B — Week-shape summary.** Printer consuming kernel counters; replaces ad-hoc table internals without changing assertions.
- **QA-C — Snapshot + diff tool.** Serialize §D, commit baselines, `test:qa-diff` script.
- **QA-D — Persona builder cleanup.** `buildAthlete(preset, overrides)` factory; scenarios become data rows; add the missing Bible personas (bye-deload, deload week, busy week, practice match, hamstring week, low-readiness week) as registry entries whose expected shapes get reviewed by Sam at commit time.
- **QA-E — Allowed-findings policy.** Move "do not chase" prose into typed `allowedFindings` per scenario; board fails on any unlisted finding; stale allowances (reviewBy passed) warn.
- **QA-F — Docs/test-command cleanup.** README section for the board, `test:qa`/`test:qa-diff` documented, roadmap references updated from S-numbers to slugs (docs edit, separate tiny PR).

Order rationale: A unlocks readable failures immediately; B/C give every in-flight workstream (injury, speed, addons, notes) the diff tooling their PRs need; D grows coverage once the harness is trustworthy; E converts noise policy into code last, when the findings are visible enough to classify honestly.

## G. Tests needed

QA is test tooling, so acceptance is mostly self-referential: registry uniqueness (ids/slugs); every scenario has non-empty humanName/intent; snapshot round-trip stability (two consecutive runs ⇒ zero diff); diff tool detects a seeded synthetic change (fixture mutates one day's category); **byte-identical generation guarantee** — all existing assertions pass unchanged and the week shapes produced before/after each QA slice are identical (proven via the new snapshots in QA-C; via assertion pass-through in QA-A/B); classifyRegion drift-guard (QA copy vs kernel classifier agree on the scenario board — a warning, not a consolidation; 5.2 owns the merge); allowed-findings: unlisted finding fails, listed finding passes with its reason printed.

## H. Codex-ready first prompt (QA-A)

> **Task: QA-A — human-readable QA scenario registry + output. Test tooling only; generation behaviour and all assertions must be unchanged. READ `docs/QA_SCENARIO_CLEANUP_PLAN_2026-07-09.md` first.**
>
> 1. Extract the inline scenario objects from `src/__tests__/weekPlanQA.ts` (S1-S14, E1-E3, :~627-800) into a new `src/__tests__/weekPlanQA/scenarios.ts` with a typed `ScenarioDef`: `{ id ('S6'), slug ('offseason-4day-no-tt'), humanName, scenarioIntent, onboarding, calendarOverrides?, editFrom?, editOps? }`. Keep every existing config field byte-identical — this is a move, not a rewrite. Derive slugs from the existing name text; write a one-line `scenarioIntent` for each based on what its config exercises (e.g. S10: 'Guards the 3-consecutive-team-days structure rules') — flag any scenario whose intent you cannot infer in the PR description rather than guessing.
> 2. Output upgrades in `weekPlanQA.ts`: print a table of contents (id · slug · humanName · intent) before the first scenario; prefix every assertion result and validator finding line with the slug instead of/alongside the bare S-number; keep the existing per-scenario tables otherwise untouched.
> 3. Registry integrity checks (run as part of the board): unique ids and slugs; non-empty humanName and scenarioIntent; `editFrom` references resolve.
> 4. **Guarantees:** every existing assertion runs against the same configs and produces the same pass/fail results as before (paste the before/after board summary in the PR to prove it); no imports from generation code change; do NOT touch `classifyRegion` or any assertion logic; do NOT add expectedWeekShape/allowedFindings/snapshots (QA-C/QA-E); do NOT touch recovery_addon, injury/readiness, sprint, Coach Notes, generation, or rebuild code.
> 5. Known pre-existing failures per roadmap — do not chase. Run the full test board.

## I. Behaviour risk

Near zero for the app — no production code path changes in any slice; QA-A/B are output-only, QA-C adds files, QA-D/E change only which test personas exist and which warnings count as failures. The real risks are process ones: snapshot churn noise (mitigated by coarse §D fields — structure, not content), false-positive policy becoming a rubber stamp (mitigated by owned/dated `allowedFindings` with review dates), and expected-shape review burden when QA-D adds personas (explicitly routed through Sam once, then diff-guarded). One lane guard: the harness must keep consuming kernel counters and classifiers rather than growing its own — any QA slice that needs new counting logic should stop and check whether the kernel already owns it (5.2 territory).
