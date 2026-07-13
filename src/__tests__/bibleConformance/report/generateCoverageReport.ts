import fs from 'node:fs';
import path from 'node:path';
import type { BibleCoverageReport, CoverageStatus } from '../types';

function pct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function renderCoverageMarkdown(report: BibleCoverageReport): string {
  const partial = report.rules.filter((rule) =>
    ['pairwise', 'property', 'pathEquivalence', 'persistence', 'metamorphic', 'mutation'].some((key) =>
      rule[key as keyof typeof rule] === 'partial' || rule[key as keyof typeof rule] === 'none'));
  const exemptions = report.rules.filter((rule) => rule.exemptions.length > 0);
  const lines = [
    '# Executable Bible Conformance Coverage',
    '',
    `Seed: \`${report.seed}\`  `,
    `Reference date: \`${report.referenceDate}\`  `,
    `Timezone: \`${report.timezone}\``,
    '',
    '## Overall summary',
    '',
    `- Registered rules: ${report.summary.ruleCount}`,
    `- Pairwise matrix: ${report.summary.pairwise.scenarios} scenarios, ${report.summary.pairwise.coveredPairs}/${report.summary.pairwise.totalPairs} pairs (${pct(report.summary.pairwise.percentage)})`,
    `- Mutation score: ${report.summary.mutationScore.killed}/${report.summary.mutationScore.total} (${pct(report.summary.mutationScore.percentage)})`,
    '- Overall conformance is intentionally not reported as 100%; coverage types and known limitations remain distinct.',
    '',
    '### Explicitly unsupported pairwise combinations',
    '',
    ...report.summary.pairwise.unsupported.map((entry) => `- ${entry}`),
    '',
    '## Rule counts by category',
    '',
    ...Object.entries(report.summary.categoryCounts).map(([category, count]) => `- ${category}: ${count}`),
    '',
    '## Coverage by test type',
    '',
    '| Type | None | Partial | Full | Not applicable |',
    '|---|---:|---:|---:|---:|',
    ...Object.entries(report.summary.coverageCounts).map(([type, counts]) => {
      const value = counts as Record<CoverageStatus, number>;
      return `| ${type} | ${value.none} | ${value.partial} | ${value.full} | ${value.not_applicable} |`;
    }),
    '',
    '## Production paths covered',
    '',
    ...report.summary.productionPaths.map((entry) => `- ${entry}`),
    '',
    '## Rule registry',
    '',
    '| Rule | Category | Golden | Pairwise | Property | Paths | Persistence | Metamorphic | Mutation |',
    '|---|---|---|---|---|---|---|---|---|',
    ...report.rules.map((rule) => `| ${rule.ruleId} | ${rule.category} | ${rule.fixedGolden} | ${rule.pairwise} | ${rule.property} | ${rule.pathEquivalence} | ${rule.persistence} | ${rule.metamorphic} | ${rule.mutation} |`),
    '',
    '## Rules with partial or no coverage',
    '',
    ...(partial.length ? partial.map((rule) => `- ${rule.ruleId}: ${rule.coverageGaps.join(' ') || 'bounded coverage'}`) : ['- None']),
    '',
    '## Mutation protection and exemptions',
    '',
    ...report.rules.map((rule) => rule.mutationIds.length
      ? `- ${rule.ruleId}: ${rule.mutationIds.join(', ')}`
      : `- ${rule.ruleId}: ${rule.exemptions.join(' ')}`),
    '',
    '## Explicit exemptions',
    '',
    ...(exemptions.length ? exemptions.map((rule) => `- ${rule.ruleId}: ${rule.exemptions.join(' ')}`) : ['- None']),
    '',
    '## Known limitations',
    '',
    ...report.limitations.map((entry) => `- ${entry}`),
    '',
    '## Runtime and reproducibility',
    '',
    `- Every-commit hard ceiling: ${report.summary.runtimeBudget.everyCommitMs}ms`,
    `- Extended hard ceiling: ${report.summary.runtimeBudget.extendedMs}ms`,
    '- Measured runtime is printed by the command but omitted from artifacts so report files remain byte-deterministic.',
    `- Rerun: \`npm run test:bible:extended -- --seed=${report.seed}\``,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function writeCoverageArtifacts(report: BibleCoverageReport, repoRoot: string): { markdownPath: string; jsonPath: string } {
  const outputDir = path.join(repoRoot, 'test-results', 'bible-conformance');
  fs.mkdirSync(outputDir, { recursive: true });
  const markdownPath = path.join(outputDir, 'coverage.md');
  const jsonPath = path.join(outputDir, 'coverage.json');
  fs.writeFileSync(markdownPath, renderCoverageMarkdown(report), 'utf8');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { markdownPath, jsonPath };
}
