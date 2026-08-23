(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative, resolve } from 'path';
import { armTotalsOrRed, totalsPrinted } from './support/totalsOrRed';

armTotalsOrRed();

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');
let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, condition: unknown, detail?: unknown): void {
  if (condition) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.error(`  FAIL ${name}${detail === undefined ? '' : `\n      ${JSON.stringify(detail)}`}`);
  }
}

function source(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), 'utf8');
}

function filesUnder(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(absolute) : [absolute];
  });
}

function retiredOwnerIsAbsent(exists: boolean): boolean {
  return !exists;
}

function protectedOwnerIsSubstantial(body: string): boolean {
  return body.length > 500;
}

function hasRetiredRuntimeImport(body: string): boolean {
  const runtime = body
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
    .join('\n');
  return /from\s+['"][^'"]*(?:coachTurnController|coachCommandRouter|coachIntentDispatcher|coachStore|coachMemoryStore|pendingCoachClarifierStore|coachContextStateStore)['"]/.test(runtime);
}

const retired = [
  'src/screens/coach/CoachScreen.tsx',
  'src/utils/coachTurnController.ts',
  'src/utils/coachCommandExecutor.ts',
  'src/utils/coachCommandRouter.ts',
  'src/utils/coachIntent.ts',
  'src/utils/coachIntentDispatcher.ts',
  'src/utils/coachLLMCommandAdapter.ts',
  'src/utils/coachProgramEdit.ts',
  'src/utils/coachProgramEditDraft.ts',
  'src/utils/semanticProgramEditDraft.ts',
  'src/utils/semanticCoachRevisionProposal.ts',
  'src/utils/visibleWorkoutDiff.ts',
  'src/store/coachStore.ts',
  'src/store/coachMemoryStore.ts',
  'src/store/coachMutationHistoryStore.ts',
  'src/store/pendingCoachClarifierStore.ts',
  'src/store/coachContextStateStore.ts',
  'src/screens/journal/JournalScreen.tsx',
  'src/components/journal/TrendChart.tsx',
  'src/services/journalReminderService.ts',
  'src/services/journalReminderProof.ts',
  'src/rules/journalReminder.ts',
  'src/rules/journalReminderCopy.ts',
  'supabase/functions/coach-chat/index.ts',
  'supabase/functions/coach-intent/index.ts',
  'supabase/functions/coach-revision-proposal/index.ts',
  'supabase/functions/coach-semantic-program-edit-draft/index.ts',
  'supabase/functions/coach-send-message/index.ts',
] as const;

console.log('\n[1] RETIRED MEANS ABSENT');
for (const file of retired) {
  ok(`${file} is absent`, retiredOwnerIsAbsent(existsSync(join(ROOT, file))));
}
ok('the absence checker reds on a fabricated reintroduction',
  retiredOwnerIsAbsent(false) && !retiredOwnerIsAbsent(true));

const protectedFiles = [
  'src/screens/coach/CoachTabScreen.tsx',
  'src/rules/coachQuestion.ts',
  'src/rules/coachAnswer.ts',
  'src/store/coachMutationTransaction.ts',
  'src/utils/programControlActions.ts',
  'src/utils/planChangeProducer.ts',
  'src/utils/coachRevisionProposal.ts',
  'src/rules/journalWeek.ts',
  'src/rules/journalLoad.ts',
  'src/rules/journalMonth.ts',
  'src/rules/journalChanges.ts',
  'src/rules/journalNiggleHistory.ts',
  'src/rules/journalStrengthTrend.ts',
  'src/rules/journalWeekJob.ts',
  'src/rules/journalWeekStatus.ts',
  'src/store/journalNoteStore.ts',
] as const;

console.log('\n[2] THE DATA AND THE PROGRAM DOOR REMAIN');
for (const file of protectedFiles) {
  const absolute = join(ROOT, file);
  ok(`${file} remains substantial`,
    existsSync(absolute) && protectedOwnerIsSubstantial(readFileSync(absolute, 'utf8')));
}
ok('the protected-owner checker reds on a fabricated deletion',
  protectedOwnerIsSubstantial('x'.repeat(501)) && !protectedOwnerIsSubstantial(''));

console.log('\n[3] NOTHING SHIPPED CAN REACH THE RETIRED SYSTEMS');
{
  const navigator = source('src', 'navigation', 'AppNavigator.tsx');
  ok('the current Coach tab remains mounted', /name="CoachTab"[\s\S]{0,160}?CoachTabScreen/.test(navigator));
  ok('the navigator names no retired Coach screen', !/CoachScreen/.test(navigator));
  ok('the navigator names no Journal screen or tab', !/JournalScreen|JournalTab/.test(navigator));

  const app = source('App.tsx');
  ok('startup makes no frozen Coach warm-up call', !/coachBuildInfo|logCoachBuildFingerprint/.test(app));

  const env = source('src', 'config', 'env.ts');
  ok('client configuration exposes no retired Coach endpoint or mode',
    !/coachChatEndpoint|coachIntentEndpoint|semanticProgramEditDraftMode|coachRevisionProposalMode/.test(env));

  const hydration = source('src', 'store', 'appHydrationGate.ts');
  for (const key of ['coach-store', 'coach-memory-store', 'coach-mutation-history-store']) {
    ok(`${key} is retired at boot, not hydrated`,
      hydration.includes(`'${key}'`) && !new RegExp(`handle\\('${key}'`).test(hydration));
  }

  const config = source('supabase', 'config.toml');
  ok('Supabase registers no retired Coach function', !/\[functions\.coach-/.test(config));

  const product = filesUnder(SRC)
    .filter((file) => /\.(?:ts|tsx)$/.test(file))
    .filter((file) => !file.includes(`${join('src', '__tests__')}`));
  ok('the product tree was walked', product.length > 300, product.length);
  const forbiddenRuntimeReferences = product.flatMap((file) => {
    return hasRetiredRuntimeImport(readFileSync(file, 'utf8'))
      ? [relative(ROOT, file)]
      : [];
  });
  ok('no product module imports a retired Coach owner',
    forbiddenRuntimeReferences.length === 0, forbiddenRuntimeReferences);
  ok('the import scanner reds on a fabricated retired import',
    hasRetiredRuntimeImport("import { x } from './coachTurnController';")
      && !hasRetiredRuntimeImport("import { x } from './coachAnswer';"));
}

console.log(`\nCoach clean-room totals: ${pass} passed, ${fail} failed`);
totalsPrinted(fail);
console.log('  NOT COVERED: this is a source and ownership guard. It does not mount a screen, execute a program change, or judge the new Coach response quality.');
if (failures.length > 0) console.log(`Failures:\n  - ${failures.join('\n  - ')}`);
