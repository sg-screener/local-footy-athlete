(global as unknown as { __DEV__: boolean }).__DEV__ = true;

import {
  clearDevE2EClock,
  createDevE2EClockReceipt,
  createDevE2EClockReceiptForSeed,
  devE2EAnchorInstantForDate,
  getDevE2EClockReceipt,
  setDevE2EClock,
  setDevE2EClockForSeed,
} from '../dev/e2e/DevE2EClock';
import {
  appDateNow,
  appDateTimezone,
  formatLocalISODate,
  todayISOLocal,
} from '../utils/appDate';
import { getMondayISOForDate } from '../utils/programBlockState';

let passed = 0;
const failures: string[] = [];

function ok(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}`);
  }
}

const originalTZ = process.env.TZ;
const originalDiagnostics = process.env.EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS;
const originalClockOverride = process.env.EXPO_PUBLIC_DEV_E2E_CLOCK;

try {
  clearDevE2EClock();
  const wallClockBefore = formatLocalISODate(new Date());
  ok('real clock is used outside an active E2E scenario', todayISOLocal() === wallClockBefore);

  const receipt = createDevE2EClockReceiptForSeed(
    'standard-in-season-week',
    '2026-07-13T00:00:00.000Z',
  );
  ok('development clock installs', setDevE2EClock(receipt)?.seedId === receipt.seedId);
  ok('today ISO comes from the explicit seed timezone', todayISOLocal() === '2026-07-13');
  ok('clock instant is explicit and readable',
    appDateNow().toISOString() === receipt.anchorInstant);
  ok('clock timezone is exposed through appDate',
    appDateTimezone() === 'Australia/Melbourne');

  process.env.TZ = 'Pacific/Honolulu';
  const honolulu = todayISOLocal();
  process.env.TZ = 'Asia/Tokyo';
  const tokyo = todayISOLocal();
  ok('device timezone cannot move the athlete-facing seed date',
    honolulu === '2026-07-13' && tokyo === honolulu);
  ok('Monday boundary is stable for the seed date',
    getMondayISOForDate(tokyo) === '2026-07-13');

  const dstReceipt = createDevE2EClockReceipt({
    seedId: 'standard-in-season-week',
    anchorInstant: devE2EAnchorInstantForDate(
      '2026-10-04',
      'Australia/Melbourne',
    ),
    timezone: 'Australia/Melbourne',
    createdAt: '2026-07-13T00:00:00.000Z',
  });
  setDevE2EClock(dstReceipt);
  process.env.TZ = 'UTC';
  const dstUTC = todayISOLocal();
  process.env.TZ = 'America/Los_Angeles';
  const dstLosAngeles = todayISOLocal();
  ok('DST transition does not shift the intended seed date',
    dstUTC === '2026-10-04' && dstLosAngeles === dstUTC);
  ok('DST Sunday remains in the intended Monday-anchored week',
    getMondayISOForDate(dstLosAngeles) === '2026-09-28');
  setDevE2EClock(receipt);

  process.env.EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS = 'false';
  const diagnosticsOff = todayISOLocal();
  process.env.EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS = 'true';
  const diagnosticsOn = todayISOLocal();
  ok('diagnostics do not affect clock behavior',
    diagnosticsOff === '2026-07-13' && diagnosticsOn === diagnosticsOff);

  ok('development clock clears', clearDevE2EClock());
  ok('clearing removes the active receipt', getDevE2EClockReceipt() === null);
  const wallClockAfter = formatLocalISODate(new Date());
  ok('clearing restores the real clock', todayISOLocal() === wallClockAfter);

  (global as unknown as { __DEV__: boolean }).__DEV__ = false;
  process.env.EXPO_PUBLIC_DEV_E2E_CLOCK = receipt.anchorInstant;
  ok('release mode cannot install the clock',
    setDevE2EClockForSeed('standard-in-season-week') === null);
  ok('release mode cannot read an active clock', getDevE2EClockReceipt() === null);
  ok('release environment variables cannot enable the clock',
    todayISOLocal() === formatLocalISODate(new Date()));
} finally {
  (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  clearDevE2EClock();
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
  if (originalDiagnostics === undefined) {
    delete process.env.EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS;
  } else {
    process.env.EXPO_PUBLIC_ENABLE_ATHLETE_ACTION_DIAGNOSTICS = originalDiagnostics;
  }
  if (originalClockOverride === undefined) {
    delete process.env.EXPO_PUBLIC_DEV_E2E_CLOCK;
  } else {
    process.env.EXPO_PUBLIC_DEV_E2E_CLOCK = originalClockOverride;
  }
}

console.log(`\nApp date clock boundary: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  failures.forEach((failure) => console.log(`  • ${failure}`));
  process.exit(1);
}
