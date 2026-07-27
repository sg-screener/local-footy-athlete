/**
 * D13 — "midline" replaces "trunk/core" in every word the athlete reads.
 *
 * Spec: `docs/SESSION_TEMPLATE_SPEC_2026-07-25.md` §5. D13's terminology
 * ruling: "'midline' replaces 'trunk/core' everywhere — athlete-facing copy,
 * badges, pool display names, docs (internal type keys may keep their ids;
 * words the athlete sees say midline)."
 *
 * THE TRAP THIS SUITE EXISTS TO CATCH. A naive string sweep for "core" would
 * rewrite `SessionTier = 'core' | 'optional' | 'recovery'` — a same-spelling
 * homonym meaning "required/primary session", nothing to do with the body
 * region. It drives the rendered "CORE" chip on the Program tab and the day-row
 * accent colour key. Sam ruled it explicitly excluded (§6 item 10), so §3 below
 * PINS it: if a future rename sweeps it in, this fails.
 *
 * The other half is the same trap in reverse — internal ids
 * (`trunk_anti_rotation`, `movement: 'core'`, `trunk_core`) are deliberately
 * NOT renamed, because D13 permits keeping them and churning them would touch
 * persisted data. §4 pins those too.
 *
 * §2 is the general invariant rather than 25 one-off assertions: no string
 * LITERAL in the athlete-copy files may contain the body-region word, with a
 * named allowlist for the internal ids that legitimately do.
 *
 * Run: npm run test:midline
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;
process.env.TZ = 'Australia/Melbourne';

import fs from 'fs';
import path from 'path';

import {
  componentQuestionLabel,
  componentSkipReasonLabel,
  getSessionComponents,
} from '../utils/sessionComponents';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.resolve(__dirname, '..');

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failures.push(name);
  console.error(`  FAIL ${name}${detail ? `\n      ${detail}` : ''}`);
}

function read(relative: string): string {
  return fs.readFileSync(path.join(src, relative), 'utf8');
}

/* ══ 1. The words the athlete reads ══ */

console.log('\n[1] Athlete-facing copy says midline');
{
  // The role badge TEXT was removed from rows on Sam's 2026-07-27 ruling, so
  // there is no badge string left to check. "Midline" still reaches the athlete
  // through the feedback questions, the coach-chat lines, the Add-exercise
  // sheet and the pool group label — which is what the rest of this asserts.

  const supportWorkout: any = {
    id: 'w1',
    workoutType: 'Strength',
    exercises: [
      {
        id: 'r1',
        exerciseId: 'e1',
        prescribedSets: 2,
        prescribedRepsMin: 10,
        prescribedRepsMax: 12,
        restSeconds: 45,
        exercise: { id: 'x1', name: 'Band Pallof Press' },
      },
    ],
  };
  const support = getSessionComponents(supportWorkout).find(
    (component) => component.kind === 'support',
  );
  ok('the session still resolves a midline component', !!support);
  ok(
    'its label says midline',
    support?.label === 'midline work',
    `got ${support?.label}`,
  );
  ok(
    'the post-session question says midline',
    componentQuestionLabel(support!, 2) === 'Did you complete the midline work?',
    `got ${componentQuestionLabel(support!, 2)}`,
  );
  ok(
    'the skip-reason sentence says midline',
    componentSkipReasonLabel(support!) === 'Why did you skip the midline work?',
    `got ${componentSkipReasonLabel(support!)}`,
  );

  const screen = read('screens/home/DayWorkoutScreenV2.tsx');
  ok(
    'the Add-exercise sheet offers "Midline", not "Core"',
    /'Midline'/.test(screen) && !/\| 'Core'/.test(screen),
  );

  const vocabulary = read('data/selectableExerciseVocabulary.ts');
  ok(
    'the pool group display name says Midline',
    /trunk_anti_rotation: 'Midline[^']*'/.test(vocabulary),
    'this label is read into the generation prompt, so the model echoes it back',
  );

  const coverage = read('../src/rules/recoveryAddonCoverage.ts');
  ok(
    'the recovery add-on focus-area label says Midline',
    /label: 'Midline'/.test(coverage),
  );

  const templates = read('data/mobilityFlowTemplates.ts');
  ok(
    'the mobility template display name says Midline',
    /name: '[^']*Midline[^']*'/.test(templates),
    'flow headers render template names the moment §4 ships, so this is now live copy',
  );
}

/* ══ 2. No body-region "trunk" survives in athlete copy ══ */

console.log('\n[2] Sweep — no rendered literal still says trunk');
{
  // Every file the spec's §5.1/§5.2 inventory names as reaching the athlete.
  const COPY_FILES = [
    'utils/sessionComponents.ts',
    'utils/blockAdjuster.ts',
    'utils/sessionExplanation.ts',
    'utils/constraintPlan.ts',
    'utils/exposureEngine.ts',
    'utils/guidedInjuryControl.ts',
    'utils/activeProgramModifiers.ts',
    'utils/coachCommandRouter.ts',
    'utils/coachRevisionTemplates.ts',
    'data/exercisePools.ts',
    'data/exerciseCues.ts',
    'data/mobilityFlowTemplates.ts',
    'data/selectableExerciseVocabulary.ts',
    '../src/rules/recoveryAddonCoverage.ts',
    'screens/home/DayWorkoutScreenV2.tsx',
  ];

  /**
   * Internal identifiers that legitimately contain the word. D13 permits
   * keeping type keys and ids; only the words the athlete SEES must change.
   */
  const INTERNAL_IDS = [
    'trunk_anti_rotation',
    'trunk_core',
    'lower_back_trunk',
    'trunk_flexion_extension',
    'low-back-friendly-trunk-reset',
  ];

  /**
   * `ExposureTag`'s bare `'trunk'` value (exposureEngine, section 18 allow
   * lists). Exact-match only — a literal that merely CONTAINS the word, like a
   * sentence of coach copy, must still fail the sweep.
   */
  const INTERNAL_EXACT = ['trunk'];

  function isInternalId(literal: string): boolean {
    if (INTERNAL_EXACT.includes(literal)) return true;
    return INTERNAL_IDS.some((id) => literal.includes(id));
  }

  const offenders: string[] = [];
  for (const file of COPY_FILES) {
    const source = read(file);
    for (const match of source.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)) {
      const literal = match[1];
      if (!/\btrunk\b/i.test(literal)) continue;
      if (isInternalId(literal)) continue;
      offenders.push(`${file}: '${literal}'`);
    }
  }
  ok(
    'no athlete-facing literal still uses the body-region word "trunk"',
    offenders.length === 0,
    offenders.join('\n      '),
  );

  // "core" as a body region, in the two places it is prose rather than a key.
  const pools = read('data/exercisePools.ts');
  ok(
    'the Dead Bug note no longer says "core"',
    !/Keep core tight/.test(pools),
  );
  const modifiers = read('utils/activeProgramModifiers.ts');
  ok(
    'the coach-note card no longer says "core work"',
    !/bike or core work stayed in/.test(modifiers),
  );
  const guided = read('utils/guidedInjuryControl.ts');
  ok(
    'the injury keep-line no longer says "Unaffected core work"',
    !/Unaffected core work/.test(guided),
  );
}

/* ══ 3. The SessionTier "CORE" homonym is untouched ══ */

console.log('\n[3] The SessionTier homonym survives the rename (§6 item 10)');
{
  const domain = fs.readFileSync(path.join(src, 'types/domain.ts'), 'utf8');
  ok(
    "SessionTier still has its 'core' value",
    /export type SessionTier =[^;]*'core'/.test(domain),
    'this means "required session", not the body region — renaming it breaks the Program tab',
  );

  const badge = fs.readFileSync(
    path.join(src, 'components/common/SessionTierBadge.tsx'),
    'utf8',
  );
  ok(
    'SessionTierBadge still renders the literal "CORE" chip',
    /CORE/.test(badge) && !/MIDLINE/.test(badge),
  );

  const home = fs.readFileSync(path.join(src, 'screens/home/HomeScreenV2.tsx'), 'utf8');
  ok(
    "HomeScreenV2's day-row accent key still reads the 'core' tier",
    /'core'/.test(home),
  );
}

/* ══ 4. Internal ids are deliberately not renamed ══ */

console.log('\n[4] Internal type keys keep their ids');
{
  const pools = read('data/exercisePools.ts');
  ok("the pool key stays 'trunk_anti_rotation'", /trunk_anti_rotation/.test(pools));

  const tags = read('data/exerciseTags.ts');
  ok(
    "the MovementPattern enum keeps its 'core' value",
    /'core'/.test(tags),
    'filter/scoring pipeline only — never displayed',
  );

  const coverage = read('../src/rules/recoveryAddonCoverage.ts');
  ok("the focus-area key stays 'trunk_core'", /'trunk_core'/.test(coverage));

  const templates = read('data/mobilityFlowTemplates.ts');
  ok(
    "the focus tag stays 'lower_back_trunk'",
    /'lower_back_trunk'/.test(templates),
  );
  ok(
    'the mobility template id is unchanged',
    /id: 'low-back-friendly-trunk-reset'/.test(templates),
    'ids are referenced by recoveryAddonCoverage; renaming one silently unlinks it',
  );
}

/* ══ 5. The cue changeset stays the source of truth ══ */

console.log('\n[5] Renamed cues land in the changeset doc first (§5.4)');
{
  const doc = fs.readFileSync(
    path.join(repoRoot, 'docs/CUE_CHANGESET_2026-07-23.md'),
    'utf8',
  );
  const cues = read('data/exerciseCues.ts');

  ok(
    'the changeset doc no longer carries a trunk cue',
    !/\btrunk\b/i.test(
      doc
        .split('\n')
        .filter((line) => line.trim().startsWith('- **'))
        .join('\n'),
    ),
    'authoredCueLibraryTests treats the doc as source of truth — it must move first',
  );
  ok(
    'the cue library matches, with no trunk cue left',
    !/(?:primaryCue|secondaryCue): '[^']*\btrunk\b/i.test(cues),
  );
  ok(
    'midline is used in its place',
    /(?:primaryCue|secondaryCue): '[^']*\bmidline\b/i.test(cues),
  );
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
