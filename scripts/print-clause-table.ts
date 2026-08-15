/**
 * THE CLAUSE ENFORCEMENT TABLE — generated from the tables, never hand-written.
 *
 *   npx sucrase-node scripts/print-clause-table.ts
 *
 * An earlier version of this script inferred the modality from the clause prose
 * and the enforcement site by grepping for clause ids. **It reported 17 REDs, most
 * of them false** — WC-040/041 are enforced through contract CONSTANTS, not by
 * literal id strings, so string-matching under-detected wholesale. It was deleted.
 * This one reads `CLAUSE_MODALITY`, `LEGALITY_RULES` and `COMPLETENESS_CHECKS`,
 * which are the same objects the guard asserts against.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const c = require('../src/rules/weeklyProgrammingContract');
const { LEGALITY_RULES } = require('../src/rules/weeklyLegality');
const { COMPLETENESS_CHECKS } = require('../src/rules/weeklyCompleteness');

const legality = new Map(LEGALITY_RULES.map((r: any) => [r.clauseId, r]));
const complete = new Map(COMPLETENESS_CHECKS.map((r: any) => [r.clauseId, r]));

const rows = c.WEEKLY_CONTRACT_CLAUSES.map((clause: any) => {
  const m = c.modalityFor(clause.id);
  const kinds = [m.prohibits && 'PROHIBITION', m.requires && 'REQUIREMENT',
    m.prefers && 'preference'].filter(Boolean).join('+') || 'definition';
  const l = legality.get(clause.id) as any;
  const cp = complete.get(clause.id) as any;
  const enforcement = !l ? '—'
    : l.violated ? 'LEGALITY (typed rule)' : `-> ${l.enforcedElsewhere}`;
  const validation = !cp ? '—'
    : cp.gap ? 'COMPLETENESS (typed check)' : `-> ${cp.validatedElsewhere}`;
  return { id: clause.id, kinds, fact: m.fact, enforcement, validation,
    statement: clause.statement.replace(/\s+/g, ' ') };
});

console.log('| clause | exact rule | kind | canonical input fact | enforcement site | validation site |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const r of rows.sort((a: any, b: any) => a.id.localeCompare(b.id))) {
  console.log(`| ${r.id} | ${r.statement.slice(0, 96)} | ${r.kinds} | ${r.fact} `
    + `| ${r.enforcement} | ${r.validation} |`);
}
console.log(`\n${rows.length} clauses · `
  + `${rows.filter((r: any) => r.kinds.includes('PROHIBITION')).length} prohibitions · `
  + `${rows.filter((r: any) => r.kinds.includes('REQUIREMENT')).length} requirements · `
  + `${rows.filter((r: any) => r.kinds === 'definition').length} definitions`);
