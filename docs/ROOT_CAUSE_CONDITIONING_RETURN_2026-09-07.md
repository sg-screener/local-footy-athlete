# Conditioning return and gym-access diagnosis

Owner: scopebridge. Diagnosis only; no app, rule or test edits.

Replayed the real three-day onboarding/logging/rollover journey for eight weeks.
All eight reopens succeeded; conditioning output matches the delivered report.

**Verified causes**

1. `offseasonSubphasePolicy.OFFSEASON_PREPARATION` (85–88) sets conditioning
minimum/default to zero despite preferred 1–2. `weeklyProgrammingContract`
transition (533) shares it; `weeklyScheduler.scheduleWeek` (1235) allocates only
the minimum. No aerobic offer reaches selection in weeks 3–4. The previous
preparation correction prohibited unwanted work without ensuring optional base
work actually appeared. Its `every` assertions pass an empty list.
2. `canonicalWeeklyAvailabilityStateFrom` (143–147) supplies owned machines on
all seven dates, without the gym-day restriction. `materialiseAuthoredSessions`
(211–226) sees Saturday machines and passes `runOnly:false`, although the
scheduler requested running. `defaultProgram.resolvedBlockModality` (1203)
delivers the selected machine template as Bike. Both presets exhibit this in
weeks 5–8, including pre-season Saturday.
3. `OFFSEASON_OVERLAYS.normal_build` (545) immediately demands four stimuli.
`hardConditioningQualityFor` (633) selects glycolytic in mini-cycle two.
`movementPlaneProgramming.athleticTransverseExposureRule` (180) starts COD in
week five; scheduler (1865) exchanges the first easy/moderate component.
`runningSpeedTemplatePreference` (52) explicitly selects week-five acceleration.

**Actual candidates**

Saturday: seven hard-conditioning candidates, including bike sprints, 150–200 m
repeats and hill repeats. Bike sprints win rotation; running alternatives remain
eligible. Aerobic templates are rejected as wrong quality. COD has one eligible
combined template. Ten speed candidates are eligible; 20 m accelerations win the
explicit preference. Full reasons: `output/conditioning-diagnosis-2026-09-07/candidates.json`.

**Proposed complete correction**

Prefer shared dated equipment access over a Saturday-only patch; ensure optional
base sessions are offered on gym days. Reconcile gradual progression with explicit
R-311/R-329/R-331/R-337 prescriptions before changing speed/COD timing. Update
all consumers, Coach references, checks and fixtures. Add failing journey
regressions, prove save/reload, test neighbouring availability/phase combinations,
then run relevant gates and both full years. Detailed dependency/test inventory
is alongside the trace.

NOT COVERED: implementation, revised progression approval, native UI, post-fix years.
