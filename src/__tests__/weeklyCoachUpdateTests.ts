/**
 * weeklyCoachUpdateTests — proves the active-constraint summary
 * system surfaces:
 *  - Coach Update card on every affected week (not just current)
 *  - Multiple active injuries together
 *  - Disappears when constraints resolve
 *  - Per-session coachNotes attribution
 *  - CTA prefill names the body part(s)
 *  - Reply composer produces ONE coherent reply, not stitched fragments
 *
 * Run: npm run test:weekly-coach-update
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import {
  buildWeeklyCoachUpdateFromConstraints,
  getUpdateCoachPrefill,
  buildSessionConstraintNote,
} from '../utils/weeklyCoachUpdate';
import {
  composeCoachAdjustmentReply,
  insertProgramSummaryBeforeFinalClose,
} from '../utils/coachReplyComposer';
import type {
  ActiveConstraint,
  ActiveInjuryConstraint,
} from '../store/coachUpdatesStore';
import type { ResolvedDay } from '../utils/sessionResolver';
import type { Workout } from '../types/domain';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function eq<T>(name: string, a: T, b: T) {
  ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function section(label: string) { console.log(`\n${label}`); }
function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

// ─── Fixtures ────────────────────────────────────────────────────────
function ex(name: string): any {
  return {
    id: `we-${name}`, workoutId: 'wk', exerciseId: `ex-${name}`,
    exerciseOrder: 0, prescribedSets: 3, prescribedRepsMin: 6, prescribedRepsMax: 8,
    prescribedWeightKg: 0, restSeconds: 0,
    exercise: {
      id: `ex-${name}`, name, description: name,
      exerciseType: 'Compound', muscleGroups: [], equipmentRequired: [],
      difficultyLevel: 'Intermediate', createdAt: '', updatedAt: '',
    },
    createdAt: '', updatedAt: '',
  };
}
function wk(name: string, exercises: any[], coachNotes: string[] = []): Workout {
  return {
    id: 'w', microcycleId: 'mc', dayOfWeek: 1,
    name, description: '', durationMinutes: 60,
    intensity: 'Moderate' as any, workoutType: 'Strength' as any,
    sessionTier: 'core' as any, exercises, createdAt: '', updatedAt: '',
    coachNotes,
  } as Workout;
}
function day(date: string, w: Workout | null): ResolvedDay {
  const [y, m, d] = date.split('-').map(Number);
  return {
    date, dayOfWeek: new Date(y, m - 1, d, 12, 0, 0, 0).getDay(),
    short: 'MON', isToday: false, workout: w, source: 'template', indicator: null,
  } as any;
}
function injury(
  bodyPart: string,
  bucket: any,
  severity: number,
  status: 'active' | 'improving' | 'resolved' = 'active',
  rules: string[] = [],
  safeFocus: string[] = [],
  advice: string[] = [],
): ActiveInjuryConstraint {
  return {
    id: `injury-${bucket || bodyPart}`,
    type: 'injury',
    bodyPart, bucket, severity, status,
    startDate: '2026-04-29T10:00:00Z',
    lastUpdatedAt: '2026-04-29T10:00:00Z',
    rules, safeFocus, advice,
  };
}

// ═════════════════════════════════════════════════════════════════════
// 1. Multi-constraint card — hammy 7 + shoulder 8 → both shown
// ═════════════════════════════════════════════════════════════════════
section('[1] Multi-constraint card — hammy 7 + shoulder 8');
{
  const constraints: ActiveConstraint[] = [
    injury('hammy', 'hamstring', 7, 'active',
      ['No sprinting or high-speed running', 'No heavy hinge work'],
      ['Upper body', 'Trunk'],
      ['Get a physio to look at it.']),
    injury('shoulder', 'shoulder', 8, 'active',
      ['No pressing', 'No overhead loading', 'No explosive push work'],
      ['Lower body', 'Trunk'],
      ['Get it assessed.']),
  ];
  const baseline = [
    day('2026-05-04', wk('Lower Body Strength', [ex('Trap Bar Deadlift'), ex('Goblet Squat')])),
    day('2026-05-07', wk('Upper Push', [ex('Bench Press'), ex('Lateral Raise')])),
  ];
  const visible = [
    day('2026-05-04', wk('Lower Body Strength', [ex('Goblet Squat')])),
    day('2026-05-07', wk('Upper Push', [])),
  ];
  const view = buildWeeklyCoachUpdateFromConstraints({
    weekStartISO: '2026-05-04',
    visibleWeek: visible,
    baselineWeek: baseline,
    activeConstraints: constraints,
  });
  ok('view returned', !!view);
  eq('two activeIssues', view!.activeIssues.length, 2);
  ok('hammy issue named', view!.activeIssues.some((s) => /Hammy pain/i.test(s)));
  ok('shoulder issue named', view!.activeIssues.some((s) => /Shoulder pain/i.test(s)));
  ok('rules deduped + combined', view!.rules.length >= 4);
  ok('no rule duplicates', view!.rules.length === new Set(view!.rules).size);
  ok('sessionsChanged includes Mon Lower', view!.sessionsChanged.some((b) => /Mon Lower Body Strength/.test(b)));
  ok('sessionsChanged includes Thu Upper Push', view!.sessionsChanged.some((b) => /Thu Upper Push/.test(b)));
  eq('cta = Update coach', view!.cta, 'Update coach');
}

// ═════════════════════════════════════════════════════════════════════
// 2. Card appears on FUTURE week — hammy 7/10
// ═════════════════════════════════════════════════════════════════════
section('[2] Card appears on next-week view');
{
  const constraints: ActiveConstraint[] = [injury('hammy', 'hamstring', 7)];
  const baseline = [day('2026-05-11', wk('Lower Body Strength', [ex('Trap Bar Deadlift')]))];
  const visible = [day('2026-05-11', wk('Lower Body Strength', []))];
  const view = buildWeeklyCoachUpdateFromConstraints({
    weekStartISO: '2026-05-11',
    visibleWeek: visible,
    baselineWeek: baseline,
    activeConstraints: constraints,
  });
  ok('view returned for next-week', !!view);
  ok('sessionsChanged populated', view!.sessionsChanged.length > 0);
  ok('mentions Mon Lower Body Strength', view!.sessionsChanged.some((s) => /Mon Lower Body Strength/.test(s)));
}

// ═════════════════════════════════════════════════════════════════════
// 3. Card disappears when constraint resolved
// ═════════════════════════════════════════════════════════════════════
section('[3] Resolved constraint → no card');
{
  const constraints: ActiveConstraint[] = [injury('hammy', 'hamstring', 0, 'resolved')];
  const baseline = [day('2026-05-04', wk('Lower', [ex('Deadlift')]))];
  const visible = [day('2026-05-04', wk('Lower', [ex('Deadlift')]))];
  const view = buildWeeklyCoachUpdateFromConstraints({
    weekStartISO: '2026-05-04',
    visibleWeek: visible,
    baselineWeek: baseline,
    activeConstraints: constraints,
  });
  ok('view is null for resolved-only', view === null);
}

// ═════════════════════════════════════════════════════════════════════
// 4. Empty constraint set → null view
// ═════════════════════════════════════════════════════════════════════
section('[4] Empty constraints → null');
{
  const view = buildWeeklyCoachUpdateFromConstraints({
    weekStartISO: '2026-05-04',
    visibleWeek: [],
    baselineWeek: [],
    activeConstraints: [],
  });
  ok('null', view === null);
}

// ═════════════════════════════════════════════════════════════════════
// 5. Active constraint with no week diff → still returns view
//    (active restriction in place, but this week pure rest etc.)
// ═════════════════════════════════════════════════════════════════════
section('[5] Active constraint + no diff → view (explanation persists)');
{
  const constraints: ActiveConstraint[] = [injury('hammy', 'hamstring', 7)];
  const week = [day('2026-05-04', wk('Recovery', [ex('Foam Roll')]))];
  const view = buildWeeklyCoachUpdateFromConstraints({
    weekStartISO: '2026-05-04',
    visibleWeek: week,
    baselineWeek: week,
    activeConstraints: constraints,
  });
  ok('view non-null', !!view);
  eq('sessionsChanged empty (no diff)', view!.sessionsChanged.length, 0);
  eq('one activeIssue', view!.activeIssues.length, 1);
}

// ═════════════════════════════════════════════════════════════════════
// 6. CTA prefill — single + multiple injuries
// ═════════════════════════════════════════════════════════════════════
section('[6] getUpdateCoachPrefill');
{
  eq(
    'no constraints → generic',
    getUpdateCoachPrefill([]),
    'Update on my injury: ',
  );
  eq(
    'one injury → name',
    getUpdateCoachPrefill([injury('hammy', 'hamstring', 6)]),
    'Update on my hammy: ',
  );
  eq(
    'two injuries → joined',
    getUpdateCoachPrefill([
      injury('hammy', 'hamstring', 7),
      injury('shoulder', 'shoulder', 8),
    ]),
    'Update on my hammy/shoulder: ',
  );
  // Resolved injuries are filtered out.
  eq(
    'resolved injury skipped',
    getUpdateCoachPrefill([
      injury('hammy', 'hamstring', 0, 'resolved'),
      injury('shoulder', 'shoulder', 8),
    ]),
    'Update on my shoulder: ',
  );
}

// ═════════════════════════════════════════════════════════════════════
// 7. Multi-constraint single session note
// ═════════════════════════════════════════════════════════════════════
section('[7] buildSessionConstraintNote — multi-constraint single line');
{
  const single = buildSessionConstraintNote([injury('hammy', 'hamstring', 7)]);
  ok('single mentions hammy', !!single && /hammy/i.test(single));
  ok('single mentions update coach', !!single && /update coach/i.test(single));
  const multi = buildSessionConstraintNote([
    injury('hammy', 'hamstring', 7),
    injury('shoulder', 'shoulder', 8),
  ]);
  ok('multi single line', !!multi && multi.split('\n').length === 1);
  ok('multi mentions both', !!multi && /hammy/.test(multi) && /shoulder/.test(multi));
  ok('multi uses + separator', !!multi && / \+ /.test(multi));
  // Resolved constraints excluded.
  const onlyActive = buildSessionConstraintNote([
    injury('hammy', 'hamstring', 0, 'resolved'),
    injury('shoulder', 'shoulder', 8),
  ]);
  ok('resolved excluded', !!onlyActive && !/hammy/.test(onlyActive));
}

// ═════════════════════════════════════════════════════════════════════
// 8. Reply composer — current week unchanged, next week changed
// ═════════════════════════════════════════════════════════════════════
section('[8] composeCoachAdjustmentReply — future-only change');
{
  const reply = composeCoachAdjustmentReply({
    constraints: [
      injury('hammy', 'hamstring', 7, 'active',
        ['No sprinting or high-speed running', 'No heavy hinge work'],
        ['Upper body', 'Trunk', 'Easy bike']),
    ],
    currentWeekChanges: [],
    nextWeekChanges: ['Mon Lower Body Strength adjusted — Trap Bar Deadlift removed'],
    didCurrentWeekChange: false,
    didFutureWeekChange: true,
  });
  ok('mentions hammy 7/10', /Hammy 7\/10/.test(reply));
  // New composer phrasing — Avoid section replaces the older
  // "active restriction" wording.
  ok('has Avoid section', /Avoid:/.test(reply));
  ok('mentions next week', /next week/i.test(reply));
  // Per-session bullets are summarised in `majorChangesSummary` —
  // the legacy shim takes the first change line and trims any
  // session-name prefix. So the reply contains the trailing
  // detail ("Trap Bar Deadlift removed"), not the day/session prefix.
  ok('mentions the major change detail', /Trap Bar Deadlift removed/i.test(reply));
  ok('does NOT say "program unchanged"', !/program unchanged/i.test(reply));
  ok('does NOT say "no future sessions"', !/no future sessions/i.test(reply));
  ok('includes physio nudge for severe', /physio/i.test(reply));
  ok('includes update-coach nudge', /Update coach/i.test(reply));
  ok(
    'future-week summary appears before physio advice',
    reply.toLowerCase().indexOf('next week') < reply.toLowerCase().indexOf('physio'),
    reply,
  );
  ok(
    'nothing appears after final physio/update-coach close',
    /(?:physio[\s\S]*Hit Update coach when it improves, worsens, or clears\.)$/.test(reply.trim()),
    reply,
  );
  ok('no duplicate This week sections', countMatches(reply, /^This week\b/gim) <= 1, reply);
  ok('no duplicate Next week sections', countMatches(reply, /next week/gi) <= 1, reply);
  // Coherence — physio shouldn't be a dangling appendix.
  const lines = reply.split('\n').map((l) => l.trim()).filter(Boolean);
  ok('reply not empty', lines.length > 0);
  ok('first line is a sentence', lines[0].length > 0);
}

// ═════════════════════════════════════════════════════════════════════
// 8b. Reply composer — inserted future summary stays before physio close
// ═════════════════════════════════════════════════════════════════════
section('[8b] insertProgramSummaryBeforeFinalClose — future summary before physio');
{
  const stitched = [
    'Sounds rough — hammy 7/10 is too high for sprinting or heavy lower work.',
    'This week:\n• No sprinting or high-speed running\n• No heavy hinge work',
    'Keep upper body and trunk going where pain-free.',
    'Get a physio to look at it.',
  ].join('\n\n');
  const futureBlock = [
    'Nothing major left to change this week, but the active restriction is now shaping next week:',
    '• Mon Lower Body Strength adjusted',
    '• Team training notes added',
  ].join('\n');
  const reply = insertProgramSummaryBeforeFinalClose(stitched, futureBlock);
  ok(
    'future-week summary appears before physio advice',
    reply.indexOf('Nothing major left') < reply.indexOf('Get a physio'),
    reply,
  );
  ok(
    'reply ends on physio close',
    /Get a physio to look at it\.$/.test(reply.trim()),
    reply,
  );
  ok('no duplicate This week sections', countMatches(reply, /^This week\b/gim) === 1, reply);
  ok('no duplicate Next week sections', countMatches(reply, /active restriction is now shaping next week/gi) === 1, reply);
}

// ═════════════════════════════════════════════════════════════════════
// 9. Reply composer — current week changed
// ═════════════════════════════════════════════════════════════════════
section('[9] composeCoachAdjustmentReply — current week change only');
{
  const reply = composeCoachAdjustmentReply({
    constraints: [
      injury('shoulder', 'shoulder', 8, 'active',
        ['No pressing, overhead loading, or explosive push work'],
        ['Lower body', 'Trunk']),
    ],
    currentWeekChanges: ['Thu Upper Push adjusted — pressing removed'],
    nextWeekChanges: [],
    didCurrentWeekChange: true,
    didFutureWeekChange: false,
  });
  ok('mentions shoulder 8/10', /Shoulder 8\/10/.test(reply));
  // Per-session bullet content survives via majorChangesSummary —
  // the "pressing removed" detail trails the "this week is now
  // adjusted" sentence.
  ok('mentions pressing removed detail', /pressing removed/i.test(reply));
  ok('says "this week is now adjusted"', /this week is now adjusted/i.test(reply));
  ok('does NOT mention next week', !/next week/i.test(reply));
  ok('physio for 8/10', /physio/i.test(reply));
}

// ═════════════════════════════════════════════════════════════════════
// 10. Reply composer — both weeks changed
// ═════════════════════════════════════════════════════════════════════
section('[10] composeCoachAdjustmentReply — both weeks changed');
{
  const reply = composeCoachAdjustmentReply({
    constraints: [injury('hammy', 'hamstring', 7, 'active', ['No sprinting'], ['Upper body'])],
    currentWeekChanges: ['Wed Conditioning adjusted — sprints removed'],
    nextWeekChanges: ['Mon Lower Body Strength adjusted — Trap Bar Deadlift removed'],
    didCurrentWeekChange: true,
    didFutureWeekChange: true,
  });
  // The legacy shim grabs the FIRST change line as the major-changes
  // summary; remaining bullets live behind the card "Show details"
  // toggle, NOT in the chat reply. So the reply should mention the
  // current-week detail and signal "this week and next are now adjusted".
  ok('mentions current change detail', /sprints removed/i.test(reply));
  ok('says "this week and next are now adjusted"',
    /this week and next are now adjusted/i.test(reply));
  ok('has Avoid section', /Avoid:/.test(reply));
  ok('one coherent reply (no double headlines)',
    (reply.match(/Hammy 7\/10/g) ?? []).length === 1);
}

// ═════════════════════════════════════════════════════════════════════
// 11. Reply composer — multi-constraint headline
// ═════════════════════════════════════════════════════════════════════
section('[11] composeCoachAdjustmentReply — multiple injuries');
{
  const reply = composeCoachAdjustmentReply({
    constraints: [
      injury('hammy', 'hamstring', 7, 'active', ['No sprinting'], ['Upper body']),
      injury('shoulder', 'shoulder', 8, 'active', ['No pressing'], ['Lower body']),
    ],
    currentWeekChanges: ['Mon Lower adjusted', 'Thu Upper Push adjusted'],
    nextWeekChanges: [],
    didCurrentWeekChange: true,
    didFutureWeekChange: false,
  });
  ok('mentions both body parts', /hammy/i.test(reply) && /shoulder/i.test(reply));
  ok('combined headline ("Two issues active")', /Two issues active/i.test(reply) || /hammy.*shoulder|shoulder.*hammy/i.test(reply));
  // New composer derives Avoid labels from plan policy (engine
  // exposures), not raw constraint rules — so the dedupe assertion
  // checks the Avoid section only mentions pressing once.
  ok('Avoid labels deduped (no doubled press mention)',
    (reply.match(/Pressing/g) ?? []).length <= 1);
  ok('physio nudge once only', (reply.match(/physio/gi) ?? []).length === 1);
}

// ═════════════════════════════════════════════════════════════════════
// 12. Reply composer — neither week changed, no rules → minimal
// ═════════════════════════════════════════════════════════════════════
section('[12] composeCoachAdjustmentReply — neither week changed');
{
  const reply = composeCoachAdjustmentReply({
    constraints: [],
    currentWeekChanges: [],
    nextWeekChanges: [],
    didCurrentWeekChange: false,
    didFutureWeekChange: false,
  });
  ok('mentions nothing to change', /Nothing on the program/i.test(reply));
  ok('mentions Update coach', /Update coach/i.test(reply));
}

// ═════════════════════════════════════════════════════════════════════
// 13. Store integration — multi-constraint upsert keeps both
// ═════════════════════════════════════════════════════════════════════
section('[13] coachUpdatesStore.upsertActiveConstraint preserves both');
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useCoachUpdatesStore } = require('../store/coachUpdatesStore');
  useCoachUpdatesStore.getState().clearAllCoachUpdates();

  useCoachUpdatesStore.getState().upsertActiveConstraint(injury('hammy', 'hamstring', 7));
  useCoachUpdatesStore.getState().upsertActiveConstraint(injury('shoulder', 'shoulder', 8));
  const all = useCoachUpdatesStore.getState().activeConstraints;
  eq('two active constraints', all.length, 2);
  ok('hammy preserved', all.some((c: any) => c.bodyPart === 'hammy'));
  ok('shoulder preserved', all.some((c: any) => c.bodyPart === 'shoulder'));

  // Removing one keeps the other.
  useCoachUpdatesStore.getState().removeActiveConstraint('injury-hamstring');
  const remaining = useCoachUpdatesStore.getState().activeConstraints;
  eq('one remaining', remaining.length, 1);
  ok('shoulder remaining', remaining[0].bodyPart === 'shoulder');

  // activeInjury alias mirrors primary.
  ok('legacy activeInjury alias updated', useCoachUpdatesStore.getState().activeInjury?.bodyPart === 'shoulder');

  useCoachUpdatesStore.getState().clearAllCoachUpdates();
}

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
