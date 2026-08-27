import { ARCHETYPES, YEAR_WEEKS, yearTimeline } from './catalog';
import type { DoseReceipt } from './dose';

export interface Check { id: string; ok: boolean; detail?: string }
export interface WeekResult {
  index: number; weekStart: string; phase: string; phaseWeek: number;
  status: 'measured' | 'not_reached'; checks: Check[]; reason?: string;
  sessions?: number; rows?: number; fixtures?: number; ledgerDepth?: number;
  liveFingerprint?: string; rebuiltFingerprint?: string;
  doseReceipts?: DoseReceipt[];
}
export interface AthleteResult {
  id: string; weeks: WeekResult[]; checks: Check[];
  actions: { kind: string; date: string; ok: boolean; detail?: string }[];
  compilerCalls: number; loggedSessions: number; restarts: number;
}
export interface YearResult {
  version: 1; revision: string; startedAt: string;
  prerequisites: Check[]; mutations: Check[]; athletes: AthleteResult[];
  notCovered: string[];
}
export const WEEK_CHECKS = ['compiler_boundary', 'dose_arithmetic', 'compiler_owns_visible_rows', 'phase_clock', 'placement', 'fixtures', 'conservation', 'energy_session_content', 'optional', 'deload', 'programming', 'restart', 'ledger', 'selection_history', 'logging'] as const;
export function requiredWeekChecks(week: Pick<WeekResult, 'phaseWeek' | 'phase' | 'index'>): readonly string[] {
  if (week.phaseWeek === 10) return [...WEEK_CHECKS, 'carried_injury_report'];
  if (week.phaseWeek === 11 || week.phaseWeek === 12) return [...WEEK_CHECKS, 'carried_injury_retained'];
  if (week.phaseWeek === 13 || (week.phase === 'Pre-season' && week.phaseWeek === 1 && week.index > 0)) return [...WEEK_CHECKS, 'carried_injury_retained',
    'carried_injury_after_rollover', 'carried_injury_resolved'];
  return week.phaseWeek === 8 ? [...WEEK_CHECKS,
    'facts_prior_edit', 'facts_history_unchanged', 'facts_update_identity', 'facts_improving_identity', 'facts_overlap_identity',
    'facts_independent_resolution', 'facts_healthy_restored', 'facts_undo_edit_only',
    'facts_undo_failure_program-store', 'facts_undo_failure_decision-ledger-store',
    'facts_undo_failure_athlete-preferences-store',
    'clear_shared_constraint_reached', 'clear_ambiguous_clear_refused', 'clear_failed_clear_rolled_back',
    'clear_exact_clear', 'clear_other_report_retained', 'clear_remaining_restart',
    'clear_generic_clear_restores', 'clear_cleared_restart',
    'clear_trip_failed_clear_rolled_back', 'clear_trip_cleared_atomically', 'clear_trip_clear_restart', 'clear_trip_cleanup',
    ...['active', 'updated', 'improving', 'overlap', 'one_remaining', 'resolved', 'undo'].flatMap(stage =>
      ['restart', 'facts', 'ledger', 'acceptance_preserves_material', 'compiler_owns_visible_rows'].map(subject => `facts_${stage}_${subject}`)),
  ] : WEEK_CHECKS;
}

/** Single verdict owner. Neither HTML nor a cached status field gets a vote. */
export function yearVerdict(result: YearResult) {
  const failures = new Map<string, string>();
  const fail = (id: string, detail = '') => failures.set(id, `${id}${detail ? ': ' + detail : ''}`);
  if (result.version !== 1) fail('result_version');
  if (!result.prerequisites.some((c) => c.id === 'canonical_only' && c.ok)) fail('canonical_only');
  for (const check of result.prerequisites) if (!check.ok) fail(check.id, check.detail);
  if (!result.mutations.some((c) => c.id === 'real_compiler_mutation' && c.ok)) fail('real_compiler_mutation');
  if (!result.mutations.some((c) => c.id === 'source_fact_history_mutation' && c.ok)) fail('source_fact_history_mutation');
  if (!result.mutations.some((c) => c.id === 'acceptance_writer_mutation' && c.ok)) fail('acceptance_writer_mutation');
  if (!result.mutations.some((c) => c.id === 'injury_render_writer_mutation' && c.ok)) fail('injury_render_writer_mutation');
  for (const id of ['progression_arithmetic_mutation', 'deload_arithmetic_mutation']) {
    if (!result.mutations.some(c => c.id === id && c.ok)) fail(id);
  }
  for (const check of result.mutations) if (!check.ok) fail(check.id, check.detail);
  const ids = result.athletes.map((a) => a.id);
  if (new Set(ids).size !== ids.length || ids.length !== ARCHETYPES.length) fail('archetype_coverage');
  for (const archetype of ARCHETYPES) {
    const athlete = result.athletes.find((a) => a.id === archetype.id);
    if (!athlete) { fail(`${archetype.id}/missing`); continue; }
    if (athlete.weeks.length !== YEAR_WEEKS) fail(`${archetype.id}/year_length`);
    if (!athlete.checks.some((c) => c.id === 'onboarding' && c.ok)) fail(`${archetype.id}/onboarding`);
    if (athlete.compilerCalls === 0 || athlete.loggedSessions === 0 || athlete.restarts !== YEAR_WEEKS) fail(`${archetype.id}/depth`);
    for (const check of athlete.checks) if (!check.ok) fail(`${archetype.id}/${check.id}`, check.detail);
    for (const action of ['remove_session', 'undo_session', 'practice_match', 'phase_shift']) {
      if (!athlete.actions.some((a) => a.kind === action && a.ok)) fail(`${archetype.id}/action/${action}`);
    }
    if (athlete.actions.filter((a) => a.kind === 'phase_shift' && a.ok).length !== 2) fail(`${archetype.id}/phase_transitions`);
    for (const kind of [...(archetype.gameDay ? ['move_game', 'remove_game'] : []), ...(archetype.extraGame ? ['add_game'] : [])]) {
      if (!athlete.actions.some((a) => a.kind === kind && a.ok)) fail(`${archetype.id}/action/${kind}`);
    }
    if (archetype.id === 'male-5-two-fixtures' && !athlete.actions.some((a) => a.kind === 'swap_exercise' && a.ok)) {
      fail(`${archetype.id}/action/swap_exercise`);
    }
    if (archetype.id === 'male-5-two-fixtures' && !athlete.actions.some((a) => a.kind === 'lighter_day' && a.ok)) {
      fail(`${archetype.id}/action/lighter_day`);
    }
    for (const action of athlete.actions) if (!action.ok) fail(`${archetype.id}/${action.kind}/${action.date}`, action.detail);
    const expected = yearTimeline(archetype);
    for (const item of expected) {
      const matches = athlete.weeks.filter((week) => week.index === item.index);
      const week = matches[0];
      const key = `${archetype.id}/week-${item.index + 1}`;
      if (matches.length !== 1 || week.weekStart !== item.weekStart || week.phase !== item.phase || week.phaseWeek !== item.phaseWeek) {
        fail(`${key}/identity`); continue;
      }
      if (week.status !== 'measured') { fail(`${key}/not_reached`, week.reason); continue; }
      for (const id of requiredWeekChecks(week)) if (!week.checks.some((c) => c.id === id && c.ok)) fail(`${key}/${id}`);
      for (const check of week.checks) if (!check.ok) fail(`${key}/${check.id}`, check.detail);
      if (!Array.isArray(week.doseReceipts)) fail(`${key}/missing_numeric_receipts`);
      for (const receipt of week.doseReceipts ?? []) {
        if (!Number.isFinite(receipt.before) || !Number.isFinite(receipt.expected) ||
            typeof receipt.actual !== 'number' || !Number.isFinite(receipt.actual) ||
            Math.abs(receipt.actual - receipt.expected) > 0.000001 ||
            (receipt.kind === 'deload_sets' && receipt.expected !== Math.max(1, Math.round(receipt.before / 2))) ||
            (receipt.kind === 'progressed_load' && receipt.actual <= receipt.before) ||
            (receipt.kind === 'held_load' && receipt.actual !== receipt.before)) {
          fail(`${key}/numeric/${receipt.kind}/${receipt.rowId}`, JSON.stringify(receipt));
        }
      }
    }
  }
  const measured = result.athletes.flatMap((a) => a.weeks).filter((w) => w.status === 'measured');
  const receipts = measured.flatMap(w => w.doseReceipts ?? []);
  if (!receipts.some(r => r.kind === 'progressed_load' && r.actual! > r.before)) fail('earned_load_increase_not_reached');
  if (!receipts.some(r => r.kind === 'deload_sets' && r.actual! < r.before)) fail('deload_reduction_not_reached');
  return { ok: failures.size === 0, failures: [...failures.values()],
    expectedWeeks: ARCHETYPES.length * YEAR_WEEKS, measuredWeeks: measured.length,
    greenWeeks: measured.filter((w) => requiredWeekChecks(w).every((id) => w.checks.some((c) => c.id === id && c.ok)) && w.checks.every((c) => c.ok)).length };
}

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function renderYearHtml(result: YearResult): string {
  const verdict = yearVerdict(result);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LFA compiler year acceptance</title>
<style>body{font:16px/1.5 system-ui;background:#101010;color:#eee;max-width:1100px;margin:auto;padding:28px}h1,h2{line-height:1.2}summary{cursor:pointer}table{border-collapse:collapse;width:100%;font-size:14px}td,th{text-align:left;padding:8px;border-bottom:1px solid #333}.fail{color:#ff9c9c}.pass{color:#d3ff36}.muted{color:#aaa}.scroll{overflow:auto}li{overflow-wrap:anywhere}</style>
<h1>LFA compiler year acceptance</h1><p class="${verdict.ok ? 'pass' : 'fail'}">${verdict.ok ? 'PASS' : 'NOT ACCEPTED'}</p>
<p>${verdict.greenWeeks} green weeks; ${verdict.measuredWeeks}/${verdict.expectedWeeks} weeks reached. Unreached weeks are not passes.</p>
<p class="muted">Revision ${escape(result.revision)} · ${escape(result.startedAt)}. This page presents the gate's results; it has no separate scoring rules.</p>
<h2>Prerequisites and detector checks</h2><ul>${[...result.prerequisites, ...result.mutations].map((c) => `<li class="${c.ok ? 'pass' : 'fail'}">${c.ok ? 'PASS' : 'FAIL'} ${escape(c.id)}: ${escape(c.detail ?? '')}</li>`).join('')}</ul>
${result.athletes.map((a) => `<h2>${escape(a.id)}</h2><p>${a.loggedSessions} recorded sessions · ${a.restarts} restarts · ${a.compilerCalls} compiler calls</p><details><summary>52-week timeline and exact failures</summary><div class="scroll"><table><thead><tr><th>Week</th><th>Date / phase</th><th>Result</th><th>Details</th></tr></thead><tbody>${a.weeks.map((w) => `<tr><td>${w.index + 1}</td><td>${escape(w.weekStart)}<br>${escape(w.phase)} ${w.phaseWeek}</td><td>${w.status === 'not_reached' ? 'NOT REACHED' : requiredWeekChecks(w).every((id) => w.checks.some((c) => c.id === id && c.ok)) && w.checks.every((c) => c.ok) ? 'PASS' : 'FAIL'}</td><td>${escape(w.reason ?? w.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail ?? ''}`).join(' | '))}</td></tr>`).join('')}</tbody></table></div></details>`).join('')}
<details><summary>All blocking results (${verdict.failures.length})</summary><ul>${verdict.failures.map((f) => `<li>${escape(f)}</li>`).join('')}</ul></details>
<h2>Not covered</h2><ul>${result.notCovered.map((s) => `<li>${escape(s)}</li>`).join('')}</ul></html>`;
}
