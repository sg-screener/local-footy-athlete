/**
 * THE SAVE CONTROL AND THE DOOR ANSWER TO ONE RULE — door-pass finding 4.
 *
 * Sam, R3 door pass: "the readiness sheet's 'Save & Finish' button does nothing
 * on tap."
 *
 * REPRODUCED BY ACTING, and the door names it. `resolveSessionOutcomeTarget`
 * owns a rule with a typed code and an authored sentence:
 *
 *     if (date > todayISO) throw new SessionOutcomeValidationError(
 *       'future_session_outcome',
 *       'Session outcomes can only be recorded for today or a past session.');
 *
 * `SessionFeedbackPanel` does not know that rule. It renders "Save & Finish"
 * whenever the DRAFT is complete — which it is, for a future day, as soon as the
 * athlete picks how the session went and how they feel. The tap runs
 * `handleSave`, the door refuses, and the handler's last line is
 *
 *     if (!result.ok) return;
 *
 * — a bare return. No message, no close, no state change. The button does
 * nothing, exactly as reported, and the athlete is told nothing at all.
 *
 * TWO DEFECTS, ONE OWNER:
 *
 *   1. THE CONTROL IS OFFERED FOR AN ACT THE DOOR WILL REFUSE. The dead-control
 *      class (`docs/DEAD_CONTROL_CLASS_REASSESSMENT_2026-07-29.md`). The fix is
 *      NOT a date check copied into the panel — that is a second owner of the
 *      same rule, and the next change to one of them makes them disagree. The
 *      door exports its own predicate; the panel asks it.
 *   2. A REFUSAL IS SWALLOWED. Even with (1) paid, every other refusal code
 *      this door can return still ends at a bare `return`. A refused save must
 *      say something. This is the refuse-on-Continue owner ruling
 *      (device-pass small fixes, 2026-07-29) applied to the save control.
 *
 * Run: npm run test:session-outcome-control
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
const disk = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => disk.get(key) ?? null,
    setItem: (key: string, value: string) => { disk.set(key, value); },
    removeItem: (key: string) => { disk.delete(key); },
    clear: () => { disk.clear(); },
  },
};
(global as unknown as { fetch: () => never }).fetch = () => {
  throw new Error('NETWORK DISABLED — session outcomes are recorded on-device');
};
process.env.TZ = 'Australia/Melbourne';

import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

import { readFileSync } from 'fs';
import path from 'path';
import type { TrainingProgram, Workout } from '../types/domain';
import { generateProgramLocally } from '../services/api/generateProgram';
import { useProgramStore } from '../store/programStore';
import { useProfileStore } from '../store/profileStore';
import { useCalendarStore } from '../store/calendarStore';
import { commitRebuiltProgram } from '../utils/weekRebuild';
import { resolveWeekWithConditioning } from '../utils/sessionResolver';
import { buildScheduleStateImperative } from '../utils/coachWeekDiff';
import { resetStoresToFreshInstall } from './support/freshInstallStores';
import {
  commitSessionOutcomeTransaction,
  createRecordSessionOutcomeIntentFromFeedback,
  sessionOutcomeRecordableRefusal,
} from '../store/sessionOutcomeTransaction';
import { canSaveFeedbackDraft } from '../utils/sessionFeedbackForm';
import {
  samDevicePass20260805Profile,
  SAM_PASS_20260805_TODAY_ISO,
  SAM_PASS_20260805_CURRENT_WEEK,
  SAM_PASS_20260805_ENTRY_WEEK,
  SAM_PASS_20260805_GENERATION_DAY,
  SAM_PASS_20260805_MARKED_DAYS,
} from './support/samDevicePass20260805Fixture';

const TODAY = SAM_PASS_20260805_TODAY_ISO;
const WEEK = SAM_PASS_20260805_CURRENT_WEEK;
const SRC = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function run(name: string, body: () => void | Promise<void>): Promise<void> {
  try {
    await body();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`  FAIL ${name}`);
    console.log(`      ${message}`);
  }
}

function quiet<T>(body: () => T): T {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

async function quietAsync<T>(body: () => Promise<T>): Promise<T> {
  const log = console.log; const warn = console.warn; const error = console.error;
  console.log = () => {}; console.warn = () => {}; console.error = () => {};
  try { return await body(); } finally { console.log = log; console.warn = warn; console.error = error; }
}

function reachWorldByActing(): void {
  disk.clear();
  resetStoresToFreshInstall('session-outcome-control');
  const profile = samDevicePass20260805Profile();
  useProfileStore.getState().updateOnboardingData(profile);
  quiet(() => useProfileStore.getState().completeOnboarding());
  for (const [date, mark] of Object.entries(SAM_PASS_20260805_MARKED_DAYS)) {
    if (mark === 'game') useCalendarStore.getState().setGameDay(date, SAM_PASS_20260805_GENERATION_DAY);
  }
  const program = quiet(() => generateProgramLocally(profile, {
    weekAcceptance: 'forward_decision',
    todayISO: SAM_PASS_20260805_GENERATION_DAY,
    previousProgram: null,
    seasonPhaseClock: {
      protocolVersion: 1,
      selectedPhase: 'Pre-season',
      phaseEntryWeekStartISO: SAM_PASS_20260805_ENTRY_WEEK,
      originProvenance: 'explicit_user_phase_change',
      persistenceProvenance: 'preserved_persisted_state',
    },
  })) as TrainingProgram;
  quiet(() => commitRebuiltProgram(program, { preserve: [], clear: [], conflictsRemoved: [] }, {
    markedDays: useCalendarStore.getState().markedDays ?? {},
    selectedDate: SAM_PASS_20260805_GENERATION_DAY,
    reason: 'session-outcome-control:generate',
  }));
  const his = (useProgramStore.getState().currentProgram as TrainingProgram | null)
    ?.microcycles.find((cycle) => cycle.startDate.slice(0, 10) === WEEK) ?? null;
  if (his) useProgramStore.setState({ currentMicrocycle: his } as never);
}

/** A day the athlete can open and fill in, that has not happened yet. */
function futureSession(): { date: string; workout: Workout } {
  const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
  const day = week.find((candidate) =>
    candidate.date > TODAY
    && !!(candidate as unknown as { workout?: Workout | null }).workout);
  assert(day, 'no future session in the week — this suite has nothing to open');
  return { date: day.date, workout: (day as unknown as { workout: Workout }).workout };
}

/** The draft an athlete has after answering the two required questions. */
const COMPLETE_DRAFT = {
  completion: 'full' as const,
  feeling: 'good',
  soreness: 'none',
};

const main = async () => {
  console.log('\n-- The save control and the door answer to one rule (finding 4) --');

  // ── 1. THE DOOR'S RULE, AS THE DOOR STATES IT ────────────────────────────
  await run('1 the door refuses a session that has not happened yet', async () => {
    reachWorldByActing();
    const target = futureSession();
    const result = await quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date: target.date,
        feedback: { date: target.date, ...COMPLETE_DRAFT } as never,
        workout: target.workout,
        source: { entryPoint: 'tap', surface: 'session_feedback_panel' },
      } as never),
      // The door is asked about THIS WORLD's today, not the day the suite runs.
      TODAY,
    )) as { ok: boolean; code?: string };
    assert(!result.ok && result.code === 'future_session_outcome',
      `the door accepted a future session (ok=${result.ok}, code=${result.code}) — this `
      + 'suite is built on the door being RIGHT; if the rule moved, the panel gate below '
      + 'must move with it, which is the whole point of one owner');
  });

  // ── 2. THE DEFECT: THE CONTROL IS OFFERED ANYWAY ─────────────────────────
  await run('2 the save control is not offered for a session the door will refuse', () => {
    reachWorldByActing();
    const target = futureSession();
    // What the panel computes to decide whether to render "Save & Finish".
    const draftIsComplete = canSaveFeedbackDraft(COMPLETE_DRAFT as never);
    assert(draftIsComplete,
      'the draft this cell uses is not savable at all — it no longer represents an athlete '
      + 'who has answered the required questions');
    const refusal = sessionOutcomeRecordableRefusal(target.date, TODAY);
    assert(refusal !== null,
      `the panel has no way to know the door will refuse ${target.date} on ${TODAY}. `
      + 'It renders "Save & Finish" from the DRAFT alone, the athlete taps it, '
      + '`handleSave` reaches `if (!result.ok) return;` and nothing happens — which is '
      + 'exactly what Sam saw. The rule belongs to `resolveSessionOutcomeTarget`; the '
      + 'panel must be able to ask its owner rather than carry a second copy of it');
    assert(refusal.code === 'future_session_outcome',
      `the predicate answered ${refusal.code}, not the door's own code — two owners again`);
    assert(/today or a past session/.test(refusal.message),
      `the refusal does not carry the door's authored sentence: "${refusal.message}"`);
  });

  // ── 3. AND A REFUSAL IS NEVER SWALLOWED ──────────────────────────────────
  await run('3 the save handler surfaces a refusal instead of returning in silence', () => {
    const panel = readFileSync(path.join(SRC, 'components/SessionFeedbackPanel.tsx'), 'utf8');
    const handler = /const handleSave = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[/
      .exec(panel)?.[0] ?? '';
    assert(handler, 'handleSave is no longer declared where this cell reads it');
    assert(!/if \(!result\.ok\) return;/.test(handler),
      'the save handler still ends a refused commit with a bare `return`. Every refusal '
      + 'code this door can answer — not only the future-session one cell 2 pays — dies '
      + 'there, and the athlete taps a button that does nothing. A refused save must say '
      + 'something (the refuse-on-Continue owner, 2026-07-29)');
    assert(!/if \(!feedback\) return;/.test(handler),
      'the save handler still discards an unbuildable payload in silence — same dead end, '
      + 'one line earlier');
    assert(/catch/.test(handler),
      'the save handler has no failure boundary at all: it `await`s the door with no '
      + '`try`, so ANY throw becomes an unhandled rejection inside an onPress and the '
      + 'button silently does nothing. That is the same silence that hid the '
      + 'unhandled-rejection crash in all nine armour wrappers (2026-08-03)');
  });

  // ── 4. THE RULE HAS ONE OWNER ────────────────────────────────────────────
  await run('4 the recordable rule is not re-implemented outside its door', () => {
    const walk = (dir: string, hits: string[]): string[] => {
      for (const entry of require('fs').readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          walk(full, hits);
        } else if (/\.tsx?$/.test(entry.name)) {
          if (full.endsWith(path.join('store', 'sessionOutcomeTransaction.ts'))) continue;
          const text = readFileSync(full, 'utf8');
          // A second copy of "is this date in the future" reached for by any
          // surface that also mentions session feedback/outcomes.
          if (!/sessionOutcome|SessionOutcome|feedback/i.test(text)) continue;
          if (/date\s*>\s*todayISO|dateStr\s*>\s*todayISO|date\s*>\s*today\b/.test(text)) {
            hits.push(path.relative(SRC, full));
          }
        }
      }
      return hits;
    };
    const hits = walk(SRC, []);
    assert(hits.length === 0,
      `${hits.length} file(s) outside the door re-implement its future-session rule: `
      + `${hits.join(', ')}. One rule, one owner, any number of readers — a copied date `
      + 'comparison is how the control and the door drift apart again');
  });

  // ── 5. TODAY STILL SAVES ─────────────────────────────────────────────────
  await run('5 a session that HAS happened still saves', async () => {
    reachWorldByActing();
    const week = quiet(() => resolveWeekWithConditioning(WEEK, buildScheduleStateImperative()));
    const today = week.find((candidate) => candidate.date === TODAY
      && !!(candidate as unknown as { workout?: Workout | null }).workout);
    assert(today, `no session on ${TODAY} to log`);
    const workout = (today as unknown as { workout: Workout }).workout;
    assert(sessionOutcomeRecordableRefusal(TODAY, TODAY) === null,
      'the predicate refuses TODAY — it has become a stricter rule than the door it speaks '
      + 'for, and the athlete cannot log the session they just did');
    const result = await quietAsync(() => commitSessionOutcomeTransaction(
      createRecordSessionOutcomeIntentFromFeedback({
        date: TODAY,
        feedback: { date: TODAY, ...COMPLETE_DRAFT } as never,
        workout,
        source: { entryPoint: 'tap', surface: 'session_feedback_panel' },
      } as never),
      TODAY,
    )) as { ok: boolean; code?: string };
    assert(result.ok, `logging today's session refused: ${result.code}`);
  });

  console.log(`\n  session-outcome control ownership totals: ${passed} passed, ${failed} failed`);
  totalsPrinted(failed);
  if (failed > 0) {
    console.log('\n  FAILURES');
    for (const failure of failures) console.log(`   - ${failure}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('session-outcome control ownership suite crashed', error);
  process.exit(1);
});
