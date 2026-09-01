'use strict';

/**
 * Accepted facts for the illustrative final-year audit journey.
 *
 * This module belongs to the audit harness, not production programming. The
 * journey driver and final checker both consume it so dates and expectations
 * cannot drift independently.
 */
const ACCEPTED_CHRISTMAS_BREAK = Object.freeze({
  from: '2026-12-19',
  until: '2027-01-11',
});
const ACCEPTED_AWAY_SPAN = Object.freeze({
  from: '2026-12-28',
  until: '2027-01-01',
  restoredOn: '2027-01-02',
});

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const RESTRICTED_AWAY_TAGS = ['bodyweight', 'dumbbells', 'bands', 'bench'];

function weekday(dateISO) {
  return DAY_NAMES[new Date(`${dateISO}T12:00:00Z`).getUTCDay()];
}

function inSpan(dateISO, span) {
  return dateISO >= span.from && dateISO <= span.until;
}

function same(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function sameSet(actual, expected) {
  const left = [...new Set(actual ?? [])].sort();
  const right = [...new Set(expected ?? [])].sort();
  return same(left, right);
}

function expectedTeamTrainingWeekdays(phase) {
  if (phase === 'Pre-season') return ['Monday', 'Wednesday'];
  if (phase === 'In-season') return ['Tuesday', 'Thursday'];
  return [];
}

function expectedPreferredTrainingDays(phase) {
  return phase === 'In-season'
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
}

function acceptedProgrammingInputFindings(weeks) {
  return weeks.flatMap((week) => {
    const expected = {
      preferredTrainingDays: expectedPreferredTrainingDays(week.phase),
      teamTrainingDays: expectedTeamTrainingWeekdays(week.phase),
      usualGameDay: week.phase === 'In-season' ? 'Saturday' : null,
    };
    const actual = week.acceptedProgrammingInputs;
    return actual
      && same(actual.preferredTrainingDays, expected.preferredTrainingDays)
      && same(actual.teamTrainingDays, expected.teamTrainingDays)
      && (actual.usualGameDay ?? null) === expected.usualGameDay
      ? [] : [{ week: week.number, phase: week.phase, actual, expected }];
  });
}

function isTeamTrainingDay(day) {
  return day.type === 'Team Training'
    || (day.parts ?? []).some((part) => part.kind === 'team_training')
    || (day.rows ?? []).some((row) => row.role === 'team_training');
}

function teamTrainingAnchorFindings(weeks) {
  return weeks.flatMap((week) => {
    const allowedWeekdays = new Set(expectedTeamTrainingWeekdays(week.phase));
    const expectedDates = week.days
      .filter((day) => allowedWeekdays.has(weekday(day.date)))
      .filter((day) => !inSpan(day.date, ACCEPTED_CHRISTMAS_BREAK))
      .filter((day) => !inSpan(day.date, ACCEPTED_AWAY_SPAN))
      .map((day) => day.date);
    const actualDates = week.days.filter(isTeamTrainingDay).map((day) => day.date);
    const expectedSet = new Set(expectedDates);
    const actualSet = new Set(actualDates);
    const missing = expectedDates.filter((date) => !actualSet.has(date));
    const unexpected = actualDates.filter((date) => !expectedSet.has(date));
    const duplicateDates = actualDates.filter((date, index) => actualDates.indexOf(date) !== index);
    return missing.length === 0 && unexpected.length === 0 && duplicateDates.length === 0
      ? [] : [{ week: week.number, phase: week.phase, missing, unexpected, duplicateDates }];
  });
}

function fullEquipmentTravelRestoreFindings(days, requiredEquipmentTags, requiredModalities) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const findings = [];
  for (let date = ACCEPTED_AWAY_SPAN.from; date <= ACCEPTED_AWAY_SPAN.until;) {
    const day = byDate.get(date);
    if (!day || !sameSet(day.resolvedEquipment?.tags, RESTRICTED_AWAY_TAGS)
      || !sameSet(day.resolvedEquipment?.conditioningModalities, [])) {
      findings.push({ date, expected: 'restricted_away_kit', actual: day?.resolvedEquipment ?? null });
    }
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    date = next.toISOString().slice(0, 10);
  }
  const restored = byDate.get(ACCEPTED_AWAY_SPAN.restoredOn);
  const missingTags = requiredEquipmentTags.filter((tag) =>
    !restored?.resolvedEquipment?.tags?.includes(tag));
  const missingModalities = requiredModalities.filter((modality) =>
    !restored?.resolvedEquipment?.conditioningModalities?.includes(modality));
  if (!restored || missingTags.length > 0 || missingModalities.length > 0) {
    findings.push({ date: ACCEPTED_AWAY_SPAN.restoredOn, expected: 'normal_equipment_restored',
      missingTags, missingModalities, actual: restored?.resolvedEquipment ?? null });
  }
  return findings;
}

function isFixtureDay(day) {
  return day.kind === 'game'
    || (day.parts ?? []).some((part) => part.kind === 'game');
}

function fixturePlacementFindings(weeks) {
  return weeks.flatMap((week) => {
    const accepted = week.acceptedFixtures;
    if (!Array.isArray(accepted)) {
      return [{ week: week.number, finding: 'accepted_fixture_facts_missing' }];
    }
    const acceptedDates = accepted.map((fixture) => fixture.date).sort();
    const placedDates = week.days.filter(isFixtureDay).map((day) => day.date).sort();
    const duplicateAccepted = acceptedDates.filter((date, index) => acceptedDates.indexOf(date) !== index);
    const duplicatePlaced = placedDates.filter((date, index) => placedDates.indexOf(date) !== index);
    return same(acceptedDates, placedDates) && duplicateAccepted.length === 0 && duplicatePlaced.length === 0
      ? [] : [{ week: week.number, acceptedDates, placedDates, duplicateAccepted, duplicatePlaced }];
  });
}

function daysBetween(earlierISO, laterISO) {
  return (Date.parse(`${laterISO}T12:00:00Z`) - Date.parse(`${earlierISO}T12:00:00Z`))
    / 86_400_000;
}

function genderedOptionalFixtureFindings(weeks, gender) {
  const expectedOptional = gender === 'male' ? 'Gunshow' : 'Primer';
  const otherOptional = gender === 'male' ? 'Primer' : 'Gunshow';
  return weeks.flatMap((week) => {
    const fixtureDates = Array.isArray(week.acceptedFixtures)
      ? week.acceptedFixtures.map((fixture) => fixture.date)
      : week.days.filter(isFixtureDay).map((day) => day.date);
    return week.days.flatMap((day) => {
      if (day.name !== expectedOptional && day.name !== otherOptional) return [];
      const valid = day.name === expectedOptional
        && ['Pre-season', 'In-season'].includes(week.phase)
        && fixtureDates.some((fixtureDate) => daysBetween(day.date, fixtureDate) === 1);
      return valid ? [] : [{ week: week.number, phase: week.phase,
        optionalDate: day.date, optionalName: day.name, fixtureDates }];
    });
  });
}

module.exports = {
  ACCEPTED_AWAY_SPAN,
  ACCEPTED_CHRISTMAS_BREAK,
  RESTRICTED_AWAY_TAGS,
  acceptedProgrammingInputFindings,
  expectedTeamTrainingWeekdays,
  fixturePlacementFindings,
  fullEquipmentTravelRestoreFindings,
  genderedOptionalFixtureFindings,
  teamTrainingAnchorFindings,
};

