/**
 * Pins the icon audit approved by Sam on 2026-08-11.
 *
 * The visual paths live in one owner. The checks below also pin every surface
 * that consumes that owner, so a later local redraw cannot quietly bring back
 * the mismatched icon set this audit removed.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
// TOTALS-OR-RED (Sam, 2026-08-03): born failing, cleared only by the printed
// totals. This suite sits in test:bible; unarmed, it exits 0 on a drained loop
// and the chain calls that green.
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';
armTotalsOrRed();

const root = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

let passed = 0;
let failed = 0;

function ok(name: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}`);
}

const ownerPath = path.join(root, 'components/icons/LfaIcon.tsx');
const owner = fs.existsSync(ownerPath) ? fs.readFileSync(ownerPath, 'utf8') : '';
const equipment = read('screens/home/EquipmentLimitationSheet.tsx');
const home = read('screens/home/HomeScreenV2.tsx');
const changeHub = read('components/SessionChangeHub.tsx');
const plan = read('screens/home/PlanChangeSheet.tsx');
const injury = read('screens/home/GuidedInjuryFlowSheet.tsx');
const day = read('screens/home/DayWorkoutScreenV2.tsx');
const seasonPhase = read('screens/onboarding/SeasonPhaseScreen.tsx');
const footyAsset = fs.readFileSync(
  path.resolve(root, '../assets/icons/afl-football-traced.svg'),
  'utf8',
);
const foamRollerAsset = fs.readFileSync(
  path.resolve(root, '../assets/icons/foam-roller-traced.svg'),
  'utf8',
);
const pullUpBarAsset = fs.readFileSync(
  path.resolve(root, '../assets/icons/pull-up-bar-traced.svg'),
  'utf8',
);
const plyoBoxAsset = fs.readFileSync(
  path.resolve(root, '../assets/icons/plyo-box-traced.svg'),
  'utf8',
);
const flexedArmAsset = fs.readFileSync(
  path.resolve(root, '../assets/icons/flexed-arm-traced.svg'),
  'utf8',
);

console.log('\napproved icon ownership');

const customTraces = [
  'flexed-arm',
  'barbell-plates',
  'pull-up-bar',
  'plyo-box',
  'dip-bars',
  'back-extension',
  'ab-wheel',
  'sandbag-dead-ball',
  'foam-roller',
  'footy',
  'cable-machine',
  'weight-machine',
  'bench',
  'bike-erg',
  'air-bike',
  'row-erg',
  'ski-erg',
  'treadmill',
  'torso-abs',
  'lower-body',
  'spine',
];

const approvedTraceHash: Record<string, string> = {
  'ski-erg': '56902469e58a3452e763ad454be0121f95eb4134c5d8893bfb8d09a582b7244c',
  'row-erg': '912155b4735a88ec3fd7770192940e139f78103b54adccf63444f222ffeee0c5',
  'bike-erg': '37171752b6af18e6d8a97f2710dd4014b1eaca6d1c76c3a715d7a36b25299617',
  'air-bike': 'ac2418ad895fd393416fcdd455808214c60929136dcb8d4d6a400beeff4cd599',
  'weight-machine': 'ff7401133f812884f72c78ad63c46d97eecc402143704d77c5f1c16cfb8fab04',
  'cable-machine': 'c0997bd1af5659cabeb31ca1b6d416ca379055cac524f922ddcb8247f070d5d4',
  bench: '9106c0934aab9dcd633d0a237433cc19dfe9203a6adae3c674edc022b98055f0',
  treadmill: 'c5cfebbf3a2dac3495a00d8a5eeee8d7bb41aba0cfd35c81a40886f28ec3ef88',
  'torso-abs': '91c457cf5359af14bf014a4c15865bc66933da4b16b136799d9bf506cd1f6df3',
};

function traceHashFromOwner(name: string): string | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = owner.match(new RegExp(
    `'${escapedName}': \\{ viewBox: ("[^"]+"), d: ("[^"]+") \\}`,
  ));
  if (!match) return null;
  const viewBox = JSON.parse(match[1]) as string;
  const d = JSON.parse(match[2]) as string;
  return crypto.createHash('sha256').update(`${viewBox}|${d}`).digest('hex');
}

ok('the shared icon owner exists', owner.length > 0);
ok('every approved custom trace is owned centrally',
  customTraces.every((name) => owner.includes(`'${name}'`)));
ok('traced icons are optically larger, with targeted size boosts preserved',
  owner.includes('const tracedSize = size * 1.2;')
  && owner.includes("const renderedTracedSize = name === 'row-erg' ? tracedSize * 1.2 : tracedSize;")
  && owner.includes('width={renderedTracedSize} height={renderedTracedSize}')
  && owner.includes('const barbellWidth = tracedSize * 1.35;')
  && owner.includes("const outlinedTracedSize = name === 'weight-machine' ? tracedSize * 1.2 : tracedSize;")
  && owner.includes('width={outlinedTracedSize}')
  && owner.includes('height={outlinedTracedSize}')
  && (owner.match(/width=\{tracedSize\}/g) ?? []).length === 10
  && owner.includes('return <MaterialCommunityIcons name={libraryName} size={size} color={color} />'));
ok('every approved machine and torso trace is byte-for-byte the signed-off shape',
  Object.entries(approvedTraceHash).every(([name, expected]) =>
    traceHashFromOwner(name) === expected));
const compactOwner = owner.replace(/\s+/g, '');
const flexedArmPathData = Array.from(flexedArmAsset.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g))
  .map((match) => match[1].replace(/\s+/g, ''));
ok('Gun show and Upper body share the supplied flexed-arm trace',
  flexedArmPathData.length === 8
  && flexedArmPathData.every((d) => compactOwner.includes(d))
  && owner.includes("name === 'flexed-arm' || name === 'upper-body'")
  && owner.includes('const flexedArmSize = tracedSize * 1.2')
  && owner.includes('width={flexedArmSize} height={flexedArmSize}')
  && owner.includes('viewBox="60 55 230 245"')
  && !owner.includes('arm-flex-outline'));
ok('Lower body uses the traced leg and foot silhouette',
  owner.includes('M16.8 2.2C13.8 2.1 12.2 2.7 10 3.8')
  && owner.includes('M11.2 5.7C12.2 5 13.2 4.7 14.5 4.5')
  && owner.includes('M12.4 7.2C14.1 7.3 15.6 7.1 17.1 6.6')
  && owner.includes('M8.7 8.6C8.5 10 8.7 11.4 9.5 12.5')
  && !owner.includes('M8 3.5h8l-1 7.5 2.5 9.5'));
ok('Dip bars use the traced curved rails, brace and round feet',
  owner.includes('M9 4H7.4C5.1 4 3.4 5.8 3.4 8.1V16.2')
  && owner.includes('M15 4H16.6C18.9 4 20.6 5.8 20.6 8.1V16.2')
  && owner.includes('M10 3.2H14V5.3H10Z')
  && equipment.includes('<LfaIcon name="dip-bars" color={color} />')
  && !equipment.includes('M4 8h16'));
ok('Back extension uses the simplified split-pad machine trace',
  owner.includes('M7.4 6.2L18.1 19.6')
  && owner.includes('M13.3 13.5L7.7 20.1')
  && owner.includes('M16.3 11.7L18.4 10.7')
  && owner.includes('M4.4 3.9C4.2 3.5 4.5 3.1 4.9 3.1H7.4')
  && equipment.includes('<LfaIcon name="back-extension" color={color} />')
  && !equipment.includes('M4 18L16 6'));
ok('Ab wheel uses the traced twin wheels, front rim and long axle',
  owner.includes('M2.4 7.2L8.7 9.6')
  && owner.includes('M15.1 13.8L21.7 16.3')
  && owner.includes('M11.3 3.3C8.7 3.9 7.1 7.5 7.1 11.8')
  && owner.includes('M13 3.4C10.3 3.5 8.4 7.2 8.4 11.9')
  && equipment.includes('<LfaIcon name="ab-wheel" color={color} />')
  && !equipment.includes('M12 6a6 6 0 100 12'));
ok('Sand bag and dead ball use the supplied round stitched-bag trace',
  owner.includes('M16.8 3.6C12.6 1.4 7.3 2.6 4.3 6.4')
  && owner.includes('M6.6 8.5C7.1 7.5 16.9 7.5 17.4 8.5')
  && owner.includes('M8.1 12H15.9')
  && owner.includes('M9 11.4L9.4 12.6')
  && equipment.includes('<LfaIcon name="sandbag-dead-ball" color={color} />')
  && !equipment.includes('M4 11c0-2 2-3 8-3'));
ok('Barbell and plates use the supplied stacked-plate trace',
  owner.includes('width={barbellWidth}')
  && owner.includes('viewBox="0 0 32 24"')
  && owner.includes('M1.4 12H30.6')
  && owner.includes('M6.4 7.3V16.7')
  && owner.includes('M23.1 7.3V16.7')
  && equipment.includes('<LfaIcon name="barbell-plates" color={color} />')
  && !equipment.includes('M4 9v6'));
ok('Back and midline use the traced bent figure and one-colour pain mark',
  owner.includes('M10.2 4.8L14.8 6.6C16.5 7.2 17 8.2 16.2 9.6')
  && owner.includes('M8.1 11.4C7.1 12.5 7.2 14 8.1 15.2')
  && owner.includes('<Circle cx={9.3} cy={10.4} r={1.15} fill={color}')
  && !owner.includes('stroke="#F44336"')
  && owner.includes('M5.2 3.6L5.8 5.5L6.5 4.8L7.1 6.5')
  && !owner.includes('M12 2.5c-2 2-2 4 0 5'));
const plyoBoxPathData = Array.from(plyoBoxAsset.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g))
  .map((match) => match[1].replace(/\s+/g, ''));
ok('the app plyo box is the supplied three-face chevron trace',
  plyoBoxPathData.length === 9
  && plyoBoxPathData.every((d) => compactOwner.includes(d))
  && owner.includes('viewBox="40 35 240 175"')
  && owner.includes('strokeWidth={8.5}')
  && equipment.includes('<LfaIcon name="plyo-box" color={color} />')
  && !equipment.includes('M4 10l8-4 8 4-8 4z'));
const pullUpBarPathData = Array.from(pullUpBarAsset.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g))
  .map((match) => match[1].replace(/\s+/g, ''));
ok('the app pull-up bar is the supplied thin freestanding trace',
  pullUpBarPathData.length === 7
  && pullUpBarPathData.every((d) => compactOwner.includes(d))
  && owner.includes('viewBox="65 35 210 235"')
  && owner.includes('strokeWidth={6.5}')
  && !owner.includes('M4 20V5h16v15'));
const foamRollerPathData = Array.from(foamRollerAsset.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g))
  .map((match) => match[1].replace(/\s+/g, ''));
ok('the app foam roller is the supplied thin cylindrical trace',
  foamRollerPathData.length === 9
  && foamRollerPathData.every((d) => compactOwner.includes(d))
  && owner.includes('viewBox="50 50 240 190"')
  && owner.includes('strokeWidth={7}')
  && !owner.includes('rotation={-35}'));
const footyPathData = Array.from(footyAsset.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g))
  .map((match) => match[1].replace(/\s+/g, ''));
ok('the app footy is the supplied thin traced ball, not the retired local drawing',
  footyPathData.length === 8
  && footyPathData.every((d) => compactOwner.includes(d))
  && owner.includes('strokeWidth={29}')
  && owner.includes('strokeWidth={18}')
  && owner.includes('strokeWidth={16}')
  && owner.includes('<Circle cx={210} cy={269} r={10} fill={color} />')
  && !seasonPhase.includes('AflFootyIcon'));
ok('season phase choices are text-only with no leading icons',
  !seasonPhase.includes('MaterialCommunityIcons')
  && !seasonPhase.includes('LfaIcon')
  && !seasonPhase.includes('phase.icon')
  && !seasonPhase.includes('styles.iconBox'));
ok('the shared owner exposes the approved semantic replacements',
  [
    'sick', 'injury', 'mobility', 'medical-shield', 'no-energy',
    'half-energy', 'full-energy', 'totally-cooked',
    'severe-illness', 'move-right', 'flexed-arm', 'upper-body-injury',
    'upper-body', 'lower-body', 'spine', 'no-equipment', 'thumbs-down',
    'dumbbell', 'kettlebell',
  ].every((name) => owner.includes(`'${name}'`)));

ok('equipment and cardio maps route through the shared owner',
  equipment.includes("<LfaIcon name=\"cable-machine\"")
  && equipment.includes("<LfaIcon name=\"weight-machine\"")
  && equipment.includes("<LfaIcon name=\"bench\"")
  && equipment.includes("<LfaIcon name=\"pull-up-bar\"")
  && equipment.includes("<LfaIcon name=\"foam-roller\"")
  && equipment.includes("<LfaIcon name=\"bike-erg\"")
  && equipment.includes("<LfaIcon name=\"air-bike\"")
  && equipment.includes("<LfaIcon name=\"row-erg\"")
  && equipment.includes("<LfaIcon name=\"ski-erg\"")
  && equipment.includes("<LfaIcon name=\"treadmill\""));
ok('dumbbell and kettlebell reuse the one library glyph owner',
  equipment.includes("<LfaIcon name=\"dumbbell\"")
  && equipment.includes("<LfaIcon name=\"kettlebell\""));
ok('Program quick actions and readiness choices use the approved replacements',
  /<SessionChangeHub\b/.test(home)
  && changeHub.includes("tired: '#67D7FF'")
  && changeHub.includes("sick: '#FFCA68'")
  && changeHub.includes("injured: '#FF7F7F'")
  && changeHub.includes('M10 5a2 2 0 0 1 4 0v8.2a4 4 0 1 1-4 0Z')
  && changeHub.includes('M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z')
  && home.includes("<LfaIcon name=\"sick\"")
  && home.includes("<LfaIcon name=\"half-energy\"")
  && home.includes("<LfaIcon name=\"totally-cooked\"")
  && home.includes("<LfaIcon name=\"severe-illness\""));
/* ⚠ **THE RECOVERY BATTERY IS 3/4, NOT FULL — SAM AMENDED THE 2026-08-11 AUDIT
 * ON 2026-08-23**, seeing the Add menu on his phone: *"Is it possible to change
 * the recovery icon to a battery thats like 3/4 full?"* A full battery read as
 * "you are charged" on a row that offers the thing that charges you.
 *
 * THE PIN MOVED TO THE NEW SIGNED STATE; IT WAS NOT LOOSENED. `full-energy` is
 * asserted ABSENT from this sheet, so a hand that reinstates the full battery
 * reds — which is what this suite is for. `full-energy` itself is untouched and
 * still pinned on the readiness screen above, because it is that screen's
 * ANSWER and Sam changed a MENU ICON, not an answer. */
ok('plan editing uses arrow, flexed arm, mobility, medical shield and a 3/4 battery',
  plan.includes("<LfaIcon name=\"move-right\"")
  && plan.includes("<LfaIcon name=\"flexed-arm\"")
  && plan.includes("<LfaIcon name=\"mobility\"")
  && plan.includes("<LfaIcon name=\"medical-shield\"")
  && plan.includes("<LfaIcon name=\"three-quarter-energy\"")
  && !plan.includes("<LfaIcon name=\"full-energy\"")
  && !plan.includes('M3 12a9 9 0 1 1 3 6.7'));
ok('injury regions use the approved bicep, lower-body and spine families',
  injury.includes("<LfaIcon name=\"flexed-arm\"")
  && injury.includes("<LfaIcon name=\"lower-body\"")
  && injury.includes("<LfaIcon name=\"spine\""));
/* THE END ANCHOR MOVED WHEN THE `Other` ROW WENT (Sam, 2026-08-21). It was
   `custom_area` — the typed-area step the area step used to run into — and
   that step no longer exists, so the next step down the file is the anchor
   now. The cell's SUBJECT is unchanged: the area rows are text-only. */
const areaStepStart = injury.indexOf("if (step === 'area' && region)");
const customAreaStepStart = injury.indexOf("if (step === 'stop_training')", areaStepStart);
const areaStepSource = areaStepStart >= 0 && customAreaStepStart >= 0
  && customAreaStepStart > areaStepStart
  ? injury.slice(areaStepStart, customAreaStepStart)
  : '';
ok('injury category rows keep icons while follow-up body-area rows are text-only',
  areaStepStart >= 0
  && customAreaStepStart >= 0
  && customAreaStepStart > areaStepStart
  && areaStepSource.length > 300
  && areaStepSource.includes('GUIDED_INJURY_AREA_OPTIONS[region].map')
  && !areaStepSource.includes('icon=')
  && injury.includes('icon={REGION_ICON[option.id](REGION_COLOR[option.id])}'));
/* FOUR BECAME THREE when Sam removed the `Other` injury region (2026-08-21),
   so the count is READ OFF THE MENU rather than typed here.

   ⚠ **AND LIME BECAME THE THREE STATUS COLOURS — Sam, 2026-08-27**: *"the
   injury one - needs updating - they're all lime green = they should match the
   blue orange red"*. This cell required the opposite and named the very hexes
   it now requires, so it is inverted, not deleted: every region still draws
   from ONE table, still one colour each, and the three are the SAME hexes the
   Fatigue and Sick sheets use — a fourth palette here would red it. */
const regionColorTable = /const REGION_COLOR:[^=]*=\s*\{([\s\S]*?)\};/.exec(injury)?.[1] ?? '';
const regionIconCount = (regionColorTable.match(/^\s+(\w+): '#[0-9A-Fa-f]{6}',$/gm) ?? []).length;
ok('every injury category icon wears one of the app\'s three status colours',
  !injury.includes('const REGION_ICON_COLOR = colors.accent.lime;')
  && regionIconCount === (injury.match(/^\s+(\w+): \w+Icon,$/gm) ?? []).length
  && regionIconCount > 0
  && injury.includes("upper_body: '#67D7FF'")
  && injury.includes("lower_body: '#FFC247'")
  && injury.includes("back_midline: '#FF7F7F'"));
ok('R-209/R-210 session options reuse the shared glyph owner; R-217 retires menu Add',
  day.includes("from '../../components/SessionChangeHub'")
  && ['equipment', 'injury'].every(id =>
    day.includes(`sessionChangeGlyph('${id}')`))
  && !day.includes("sessionChangeGlyph('add')"));

console.log(`\napproved icon ownership totals: ${passed} passed, ${failed} failed`);
totalsPrinted(failed);
if (failed > 0) process.exit(1);
