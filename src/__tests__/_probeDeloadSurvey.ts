(global as unknown as { __DEV__: boolean }).__DEV__ = false;
import { resolveSeasonPhaseWeekKind, resolveSeasonSubphaseAtPhaseWeek } from '../rules/seasonPhaseClock';
console.log('OFF-SEASON — phase week -> subphase / weekKind');
for (let w = 1; w <= 20; w++) {
  console.log(`  wk ${String(w).padStart(2)}  ${String(resolveSeasonSubphaseAtPhaseWeek('Off-season', w)).padEnd(17)} ${resolveSeasonPhaseWeekKind('Off-season', w)}`);
}
console.log('\nPRE-SEASON — for contrast');
for (let w = 1; w <= 12; w++) {
  console.log(`  wk ${String(w).padStart(2)}  ${String(resolveSeasonSubphaseAtPhaseWeek('Pre-season', w)).padEnd(17)} ${resolveSeasonPhaseWeekKind('Pre-season', w)}`);
}
console.log('\nIN-SEASON');
for (let w = 1; w <= 8; w++) {
  console.log(`  wk ${String(w).padStart(2)}  ${resolveSeasonPhaseWeekKind('In-season', w)}`);
}
