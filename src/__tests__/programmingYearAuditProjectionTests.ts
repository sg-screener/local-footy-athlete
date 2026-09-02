import assert from 'node:assert/strict';
import {
  athleticPlaneExposuresForAuditDay,
  finalAthleteFacingAuditRows,
  programmingAuditProjectionFindings,
  summarizeProgrammingAuditConditioningVocabulary,
  type ProgrammingAuditExportDay,
} from '../rules/programmingYearAuditProjection';

let passed = 0;
function check(name: string, fn: () => void): void {
  fn(); passed += 1; console.log(`PASS ${name}`);
}

const airBikeDay: ProgrammingAuditExportDay = {
  date: '2026-10-01',
  rows: [{
    name: 'Air Bike Accelerations', catalogueIdentity: 'Air Bike Accelerations',
    role: 'conditioning', modalityLabel: 'Air Bike',
  }],
  speedRows: [{
    name: 'Air Bike Accelerations', catalogueIdentity: 'Air Bike Accelerations',
    role: 'speed', modalityLabel: 'Air Bike',
  }],
  conditioningIdentity: { structureFamily: 'hard_intervals', primaryLabel: 'Hard Intervals' },
};

check('typed Speed evidence is not appended to the final athlete-facing rows', () => {
  assert.equal(finalAthleteFacingAuditRows(airBikeDay).length, 1);
  assert.equal(programmingAuditProjectionFindings(airBikeDay).length, 0);
});

check('duplicating a final Speed row is a named audit failure', () => {
  const duplicate = { ...airBikeDay, rows: [airBikeDay.rows![0], airBikeDay.rows![0]] };
  assert.deepEqual(programmingAuditProjectionFindings(duplicate).map((row) => row.kind),
    ['duplicate_final_row']);
});

check('Air Bike Speed cannot be reconstructed as Running', () => {
  const running = { ...airBikeDay, rows: [{ ...airBikeDay.rows![0], modalityLabel: 'Run' }] };
  assert.deepEqual(programmingAuditProjectionFindings(running), [{
    kind: 'speed_modality_mismatch', date: '2026-10-01',
    catalogueIdentity: 'Air Bike Accelerations', finalModality: 'Run',
    evidenceModality: 'Air Bike',
  }]);
});

check('Speed evidence cannot disappear from the final session', () => {
  const absent = { ...airBikeDay, rows: [] };
  assert.equal(programmingAuditProjectionFindings(absent)[0]?.kind,
    'speed_evidence_missing_from_final');
});

check('conditioning categories and selected templates are different audit terms', () => {
  const summary = summarizeProgrammingAuditConditioningVocabulary([
    airBikeDay,
    { date: '2026-10-02', rows: [{ name: 'Classic 4×4', catalogueIdentity: 'Classic 4×4' }],
      conditioningIdentity: { structureFamily: 'hard_intervals' } },
    { date: '2026-10-03', rows: [{ name: 'Continuous Aerobic Run', catalogueIdentity: 'Continuous Aerobic Run' }],
      conditioningIdentity: { structureFamily: 'continuous_aerobic' } },
    { date: '2026-10-04', rows: [{ name: '30:30 Controlled Tempo Blocks', catalogueIdentity: '30:30 Controlled Tempo Blocks' }],
      conditioningIdentity: { structureFamily: 'tempo_intervals' } },
    { date: '2026-10-05', rows: [{ name: 'Short Flush', catalogueIdentity: 'Short Flush' }],
      conditioningIdentity: { structureFamily: 'aerobic_flush' } },
  ]);
  assert.deepEqual(summary.distinctCategories,
    ['Continuous Aerobic', 'Tempo', 'Hard Intervals', 'Flush']);
  assert.equal(summary.distinctTemplates.length, 5);
  assert.ok(summary.distinctTemplates.includes('Air Bike Accelerations'));
});

check('a typed club-training anchor stays visible but is not treated as an exercise', () => {
  const clubDay: ProgrammingAuditExportDay = {
    date: '2026-10-06',
    rows: [
      { name: 'Club session', role: 'team_training' },
      { name: 'Bench Press', catalogueIdentity: 'Bench Press', role: 'main_lift' },
    ],
  };
  assert.equal(finalAthleteFacingAuditRows(clubDay).length, 2);
  assert.deepEqual(programmingAuditProjectionFindings(clubDay), []);
  assert.deepEqual(summarizeProgrammingAuditConditioningVocabulary([clubDay]).distinctTemplates, []);
});

check('a real exercise without catalogue identity still fails the audit', () => {
  assert.throws(() => programmingAuditProjectionFindings({
    date: '2026-10-07',
    rows: [{ name: 'Club session', role: 'main_lift' }],
  }), /missing catalogueIdentity/);
});

check('the combined Change of Direction session earns typed cod_decel credit from its authored sections', () => {
  const combinedCod: ProgrammingAuditExportDay = {
    date: '2026-11-10',
    rows: [
      { name: 'Pull-Ups', catalogueIdentity: 'Pull-Ups', role: 'main_lift' },
      { name: 'Warm-Up', catalogueIdentity: 'Warm-up', role: 'conditioning' },
      { name: 'Low-Intensity Deceleration Drills', catalogueIdentity: 'Low-Intensity Deceleration Drills', role: 'conditioning' },
      { name: '45-Degree Cut Reps', catalogueIdentity: '45-Degree Cut Reps', role: 'conditioning' },
      { name: 'Up-Back Shuttle', catalogueIdentity: 'Up-Back Shuttle', role: 'conditioning' },
    ],
    conditioningIdentity: { structureFamily: 'hard_intervals', primaryLabel: 'Hard Intervals' },
  };
  assert.deepEqual(athleticPlaneExposuresForAuditDay(combinedCod), ['cod_decel']);
  // One section alone is still the same typed session identity; the display
  // label of the day is never consulted.
  assert.deepEqual(athleticPlaneExposuresForAuditDay({
    date: '2026-11-10',
    rows: [{ name: 'Cut reps', catalogueIdentity: '45-Degree Cut Reps', role: 'conditioning' }],
    conditioningIdentity: { structureFamily: 'continuous_aerobic', primaryLabel: 'Change of Direction' },
  }), ['cod_decel']);
});

check('other typed credits and non-credits are read from role, template quality and power pool only', () => {
  assert.deepEqual(athleticPlaneExposuresForAuditDay({
    date: '2026-11-11',
    rows: [{ name: 'Club session', role: 'team_training' }],
  }), ['team_training']);
  assert.deepEqual(athleticPlaneExposuresForAuditDay({
    date: '2026-11-12',
    rows: [
      { name: 'Rotational Medicine-Ball Slam', catalogueIdentity: 'Rotational Medicine-Ball Slam', role: 'power' },
      { name: 'Back Squat', catalogueIdentity: 'Back Squat', role: 'main_lift' },
    ],
  }), ['rotational_med_ball']);
  assert.deepEqual(athleticPlaneExposuresForAuditDay({
    date: '2026-11-13',
    rows: [
      { name: 'Warm-Up', catalogueIdentity: 'Warm-up', role: 'conditioning' },
      { name: 'Continuous Aerobic Run', catalogueIdentity: 'Continuous Aerobic Run', role: 'conditioning' },
      { name: 'Change of Direction', catalogueIdentity: 'Not a template', role: 'conditioning' },
    ],
    conditioningIdentity: { structureFamily: 'continuous_aerobic', primaryLabel: 'Change of Direction' },
  }), []);
});

console.log(`Programming year audit projection: ${passed}/9 passed`);
