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
const plan = read('screens/home/PlanChangeSheet.tsx');
const injury = read('screens/home/GuidedInjuryFlowSheet.tsx');
const day = read('screens/home/DayWorkoutScreenV2.tsx');
const seasonPhase = read('screens/onboarding/SeasonPhaseScreen.tsx');
const footyAsset = fs.readFileSync(
  path.resolve(root, '../assets/icons/afl-football-traced.svg'),
  'utf8',
);

console.log('\napproved icon ownership');

const customTraces = [
  'pull-up-bar',
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
ok('every approved machine and torso trace is byte-for-byte the signed-off shape',
  Object.entries(approvedTraceHash).every(([name, expected]) =>
    traceHashFromOwner(name) === expected));
ok('the foam roller preserves the supplied rotated ribbed construction',
  owner.includes('rotation={-35}') && owner.includes('origin="12, 12"')
  && owner.includes('foam-roller'));
const compactOwner = owner.replace(/\s+/g, '');
const footyPathData = Array.from(footyAsset.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\/>/g))
  .map((match) => match[1].replace(/\s+/g, ''));
ok('the app footy is the supplied thin traced ball, not the retired local drawing',
  footyPathData.length === 8
  && footyPathData.every((d) => compactOwner.includes(d))
  && owner.includes('strokeWidth={24}')
  && owner.includes('strokeWidth={15}')
  && owner.includes('strokeWidth={13}')
  && owner.includes('<Circle cx={210} cy={269} r={10} fill={color} />')
  && seasonPhase.includes('<LfaIcon name="footy" color={iconColor} size={26} />')
  && !seasonPhase.includes('AflFootyIcon'));
ok('the shared owner exposes the approved semantic replacements',
  [
    'sick', 'injury', 'mobility', 'medical-shield', 'no-energy',
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
  home.includes("<LfaIcon name=\"sick\"")
  && home.includes("<LfaIcon name=\"injury\"")
  && home.includes("<LfaIcon name=\"no-energy\"")
  && home.includes("<LfaIcon name=\"severe-illness\""));
ok('plan editing uses arrow, flexed arm, stretching person and medical shield',
  plan.includes("<LfaIcon name=\"move-right\"")
  && plan.includes("<LfaIcon name=\"flexed-arm\"")
  && plan.includes("<LfaIcon name=\"mobility\"")
  && plan.includes("<LfaIcon name=\"medical-shield\""));
ok('injury regions use the approved upper, lower and spine families',
  injury.includes("<LfaIcon name=\"upper-body-injury\"")
  && injury.includes("<LfaIcon name=\"lower-body\"")
  && injury.includes("<LfaIcon name=\"spine\""));
ok('exercise editing uses the approved body, prehab, mobility and reason icons',
  day.includes("<LfaIcon name=\"torso-abs\"")
  && day.includes("<LfaIcon name=\"upper-body\"")
  && day.includes("<LfaIcon name=\"lower-body\"")
  && day.includes("<LfaIcon name=\"medical-shield\"")
  && day.includes("<LfaIcon name=\"mobility\"")
  && day.includes("<LfaIcon name=\"no-equipment\"")
  && day.includes("<LfaIcon name=\"thumbs-down\""));

console.log(`\napproved icon ownership totals: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
