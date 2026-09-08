(global as any).__DEV__ = false;
import assert from 'node:assert/strict';
import { createTemporaryFatigueFact, normalizeTemporarySourceFacts, sourceFactsForHistoricalCompilation,
  composeTemporarySourceFactCompatibility } from '../rules/temporarySourceFact';
import { factHorizonCoversDate } from '../rules/durableFactHorizon';
import { normalizeInjuryEpisode } from '../rules/injuryEpisode';
import { filterConstraintsForDate } from '../utils/readinessConstraints';

const active = createTemporaryFatigueFact({observedDate:'2027-07-01',scope:{kind:'open',from:'2027-07-01',until:null},
  athleteReportedLevel:'cooked',sourceSurface:'test',now:'2026-09-07T04:00:00.000Z'});
const closed = {...active,status:'resolved' as const,resolvedAt:'2026-09-07T04:01:00.000Z',resolvedOnISO:'2027-07-03'};
const hydrated = normalizeTemporarySourceFacts({value:JSON.parse(JSON.stringify([closed]))});
const before = JSON.stringify(hydrated);
const history=sourceFactsForHistoricalCompilation(hydrated);
assert.equal(history.length,1);
assert.equal(factHorizonCoversDate(history[0],'2027-06-30'),false);
assert.equal(factHorizonCoversDate(history[0],'2027-07-01'),true);
assert.equal(factHorizonCoversDate(history[0],'2027-07-02'),true);
assert.equal(factHorizonCoversDate(history[0],'2027-07-03'),false);
assert.equal(JSON.stringify(hydrated),before,'Historical compilation must not reactivate the saved report');
assert.equal(composeTemporarySourceFactCompatibility({temporarySourceFacts:hydrated}).activeConstraints.length,0);
assert.equal(sourceFactsForHistoricalCompilation([{...closed,resolvedOnISO:'2027-07-01'}]).length,0,'Same-day Clear restores that day');
const injury=normalizeInjuryEpisode({protocolVersion:1,episodeId:'dated-input',bodyPart:'knee',region:'lower_body',bucket:'knee',severity:0,status:'resolved',
  onsetOrReportedDate:'2027-07-01',createdAt:'2026-09-07T04:00:00Z',resolvedAt:'2026-09-07T04:01:00Z',resolvedOnISO:'2027-07-03',
  restrictionBeforeResolution:{severity:4,policy:{rules:['reduce running'],safeFocus:[],advice:[]}},
  affectedWeeks:['2027-06-28'],compatibility:{constraintId:'injury-dated-input'}})!;
const injuryViews=sourceFactsForHistoricalCompilation([injury]);
const constraints=composeTemporarySourceFactCompatibility({temporarySourceFacts:injuryViews}).activeConstraints;
assert.equal(constraints.length,1);
assert.equal(filterConstraintsForDate(constraints,'2027-06-30').length,0);
assert.equal(filterConstraintsForDate(constraints,'2027-07-02').length,1);
assert.equal(filterConstraintsForDate(constraints,'2027-07-03').length,0);
assert.equal(composeTemporarySourceFactCompatibility({temporarySourceFacts:[injury]}).activeConstraints.length,0);
console.log('PASS historical fact scopes: explicit athlete dates survive serialization, preserve earlier restrictions and end on Clear');
