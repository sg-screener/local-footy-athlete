/**
 * ONE PLACE TO CHANGE THE SESSION, AND EVERY BUTTON IN IT GOES SOMEWHERE.
 *
 * Sam, 2026-08-19: *"Remove unlabelled header icons. Remove always-visible row
 * Swap/Remove icons. Build one 'Need to make a change?' section: Equipment ·
 * Injury · Add · Remove · Swap. No dead buttons. Keep play/demo, checkboxes,
 * load controls and form cues."*
 *
 * ## WHY THIS SUITE READS SOURCE
 *
 * The claim is about what the screen MOUNTS — which affordances exist and which
 * are gone — and this repo already answers that class of question by reading
 * the screen (`exerciseEditEntrySurfaceContractTests`). The BEHAVIOUR behind
 * each door is gated separately and by scenario:
 * `test:exercise-removal-owner`, `test:exercise-swap-choices`,
 * `test:exercise-add-candidates`, `test:injury-recomposition`, and the combined
 * walk in `test:session-change-sequence`.
 *
 * ## THE HALF THAT IS EASY TO FORGET
 *
 * A deletion suite that only checks absences passes on an empty file. Half the
 * cells here assert what SURVIVED — the play button, the checkboxes, the load
 * controls, the form cues — because Sam named those in the same breath.
 *
 * Run: npm run test:session-change-hub
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SCREEN = join(__dirname, '..', 'screens', 'home', 'DayWorkoutScreenV2.tsx');
const source = readFileSync(SCREEN, 'utf8');

let passed = 0;
const failures: string[] = [];
function ok(label: string, condition: boolean, detail?: string): void {
  if (condition) { passed++; console.log(`  PASS ${label}`); return; }
  failures.push(detail ? `${label} — ${detail}` : label);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Source with every block comment stripped, so a NAME in prose is not a mount. */
const live = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\n[0] THE INSTRUMENT CAN SEE A MOUNT AT ALL');
{
  // ⚠ CONTROL. Every absence cell below is a `!includes`, and `!includes` is
  // true of an empty string. If the comment stripper ate the file, all of them
  // would pass and the suite would report a screen that no longer exists.
  ok('the stripped source still holds the screen',
    live.includes('function DayWorkoutScreenV2') && live.length > 20000,
    `${live.length} chars`);
}

console.log('\n[1] The unlabelled header icons are gone');
{
  for (const testId of [
    'day-workout-add-exercise-action',
    'day-workout-equipment-concern-action',
    'day-workout-injury-concern-action',
  ]) {
    ok(`'${testId}' is not mounted`, !live.includes(testId));
  }
  ok('the icon row style is not used', !live.includes('styles.exerciseActionsRow'));
}

console.log('\n[2] The always-visible row Swap/Remove icons are gone');
{
  ok('`ExerciseRowActions` is not mounted', !live.includes('<ExerciseRowActions'));
  ok('and is not defined', !live.includes('function ExerciseRowActions'));
  ok('no row passes an `onSwap` prop', !/onSwap=\{/.test(live));
  ok('no row passes an `onRemove` prop', !/onRemove=\{/.test(live));
}

console.log('\n[3] There is exactly ONE change section, and it is labelled');
{
  ok('the hub is mounted', live.includes('<SessionChangeHub'));
  ok('and it carries Sam’s question, verbatim',
    live.includes('Need to make a change?'));
  ok('the hub has a stable id', live.includes('day-workout-change-hub'));
  ok('there is only one of it',
    (live.match(/<SessionChangeHub/g) ?? []).length === 1,
    `${(live.match(/<SessionChangeHub/g) ?? []).length} mounts`);
}

console.log('\n[4] All five doors, by name, in Sam’s order');
{
  const order = ['Equipment', 'Injury', 'Add', 'Remove', 'Swap'];
  const hub = live.slice(live.indexOf('<SessionChangeHub'), live.indexOf('</SessionChangeHub>') + 1
    || live.indexOf('<SessionChangeHub') + 1800);
  let cursor = -1;
  let ordered = true;
  for (const label of order) {
    ok(`'${label}' is a labelled door`, hub.includes(`label: '${label}'`), hub.slice(0, 200));
    const at = hub.indexOf(`label: '${label}'`);
    if (at <= cursor) ordered = false;
    cursor = at;
  }
  ok('and they appear in the order Sam wrote them', ordered);
}

console.log('\n[5] NO DEAD BUTTONS — every door names a real opener');
{
  const hub = live.slice(live.indexOf('<SessionChangeHub'), live.indexOf('/>', live.indexOf('<SessionChangeHub')));
  const openers = [...hub.matchAll(/onPress: (\w+)/g)].map((match) => match[1]!);
  ok('CONTROL — the hub really wires five openers', openers.length === 5,
    JSON.stringify(openers));
  for (const opener of openers) {
    ok(`'${opener}' is a real callback on this screen`,
      new RegExp(`const ${opener} = React\\.useCallback`).test(live));
  }
  ok('no door is rendered disabled instead of omitted',
    !/disabled=\{/.test(hub), hub);
  // Equipment is the ONE door that comes and goes, and it goes by ABSENCE.
  ok('Equipment is conditional on the session actually having requirements',
    /sessionEquipmentRequirements\.length > 0[\s\S]{0,120}label: 'Equipment'/.test(live));
}

console.log('\n[6] What Sam said to KEEP is still here');
{
  ok('the play/demo button survives', live.includes('<PlayButton'));
  ok('the checkboxes survive', /Checkbox|checkbox/.test(live));
  // The real names, read off the screen rather than guessed: the first cut
  // looked for `LoadControl`/`onWeightChange` and found neither, which is a
  // fixture claim, not a finding.
  ok('the load controls survive',
    live.includes('styles.weightControl') && live.includes('styles.weightInput'));
  ok('the form cues survive', /cue/i.test(live));
  ok('the video modal the play button opens survives', live.includes('<ExerciseVideoModal'));
}

console.log('\n[7] The deleted surface’s gate still watches — the ingress ids moved with it');
{
  ok('`componentSwapIngress` is still mounted somewhere',
    live.includes('explorerTestId.componentSwapIngress('));
  ok('`componentDeleteIngress` is still mounted somewhere',
    live.includes('explorerTestId.componentDeleteIngress('));
  ok('and they are on the picker, which is the ingress now',
    /action === 'swap'[\s\S]{0,200}componentSwapIngress/.test(live));
}

console.log(`\n${'─'.repeat(72)}`);
if (failures.length === 0) {
  console.log(`ALL GREEN — ${passed} passed`);
} else {
  console.log(`FAILURES — ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exitCode = 1;
}
