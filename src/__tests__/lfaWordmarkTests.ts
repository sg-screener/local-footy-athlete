import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}`);
  }
}

const root = process.cwd();
const read = (relativePath: string): string => {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : '';
};

const component = read('src/components/branding/LfaWordmark.tsx');
const program = read('src/screens/home/HomeScreenV2.tsx');
const coach = read('src/screens/coach/CoachTabScreen.tsx');
const progress = read('src/screens/progress/ProgressTabScreen.tsx');
const profile = read('src/screens/profile/ProfileScreen.tsx');
const workoutDetail = read('src/screens/home/DayWorkoutScreenV2.tsx');
const coachStatus = read('src/screens/coach/CoachStatusScreen.tsx');

console.log('\n-- LFA wordmark ownership --');

assert(component.length > 0, 'one reusable LfaWordmark component exists');
assert(/viewBox="0 0 871 314"/.test(component), 'the component preserves the supplied SVG viewBox');
assert((component.match(/<Path\b/g) ?? []).length === 3,
  'the component preserves the supplied three-path wordmark');
assert(/width\s*=\s*64/.test(component) && /color\s*=\s*['"]#FFFFFF['"]/.test(component),
  'the dark-app default is the compact white wordmark');
assert(/accessibilityRole="image"/.test(component) && /accessibilityLabel="LFA"/.test(component),
  'the wordmark has one concise screen-reader identity');

const topLevelScreens = [
  ['Program', program],
  ['Coach', coach],
  ['Progress', progress],
  ['Profile', profile],
] as const;
for (const [name, source] of topLevelScreens) {
  assert(/import \{ LfaWordmark \}/.test(source) && /<LfaWordmark\b/.test(source),
    `${name} renders the shared wordmark`);
}

assert(!/<Text style=\{styles\.brand\}>LFA<\/Text>/.test(coach)
  && !/<Text style=\{styles\.brand\}>LFA<\/Text>/.test(progress),
  'Coach and Progress no longer imitate the logo with styled text');
assert(program.indexOf('<LfaWordmark') >= 0
  && program.indexOf('<LfaWordmark') < program.indexOf('styles.topBar'),
  'Program places the wordmark before its Day / Week controls');
assert(profile.indexOf('<LfaWordmark') >= 0
  && profile.indexOf('<LfaWordmark') < profile.indexOf('testID="profile-program-setup-section"'),
  'Profile places the wordmark before its first real content section');
assert(!/testID="profile-page-header"/.test(profile)
  && !/>\s*PROFILE\s*</.test(profile)
  && !/Your program setup and support\./.test(profile),
  'Profile does not repeat its tab name or keep an orphaned page subtitle');
assert(/import \{ LfaWordmark \}/.test(workoutDetail)
  && /<LfaWordmark[^>]*testID="day-workout-title"/.test(workoutDetail)
  && !/<Text[\s\S]{0,160}style=\{styles\.headerTitle\}/.test(workoutDetail),
  'programmed workout detail replaces its generic session title with the shared wordmark');
assert(/import \{ LfaWordmark \}/.test(coachStatus)
  && coachStatus.indexOf('<LfaWordmark') >= 0
  && coachStatus.indexOf('<LfaWordmark') < coachStatus.indexOf('testID="coach-status-season-phase"'),
  'My Status shows the shared wordmark before its status content');

console.log(`\nlfaWordmarkTests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
