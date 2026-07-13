import type { InvariantFailure } from '../types';

function compact(value: unknown): string {
  if (Array.isArray(value)) return `[${value.join(', ')}]`;
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function contributionLine(label: 'LOSS' | 'EXTRA', values: readonly string[]): string | null {
  if (values.length === 0) return null;
  return `${label.padEnd(10)}${values.join(', ')} — unauthorised`;
}

/** Concise, typed, first-divergence report. Never dumps full workout objects. */
export function renderConformanceFailure(failure: InvariantFailure): string {
  const lines = [
    `RULE      ${failure.ruleId}`,
    `SCENARIO  ${failure.scenarioId}`,
    `STAGE     ${failure.stage}`,
    `EXPECTED  ${compact(failure.expected)}`,
    `ACTUAL    ${compact(failure.actual)}`,
  ];
  const loss = contributionLine('LOSS', failure.missing);
  const extra = contributionLine('EXTRA', failure.extra);
  if (loss) lines.push(loss);
  if (extra) lines.push(extra);
  if (failure.planEntryId) lines.push(`ENTRY     ${failure.planEntryId}${failure.day ? ` (${failure.day})` : ''}`);
  else if (failure.day) lines.push(`DAY       ${failure.day}`);
  if (failure.weekComponents) lines.push(`WEEK      ${compact(failure.weekComponents)}`);
  if (failure.detailComponents) lines.push(`DETAIL    ${compact(failure.detailComponents)}`);
  if (failure.row) lines.push(`ROW       ${failure.row}`);
  if (failure.evidence) {
    lines.push(`EVIDENCE  ${failure.evidence.length > 0 ? failure.evidence.join(', ') : 'none'}`);
  }
  lines.push(`PATH      ${failure.path}`);
  if (failure.detail) {
    lines.push(`${failure.detailComponents ? 'NOTE      ' : 'DETAIL    '}${failure.detail}`);
  }
  return lines.join('\n');
}
