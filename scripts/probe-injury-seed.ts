process.env.TZ = 'Australia/Melbourne';
(global as unknown as { __DEV__: boolean }).__DEV__ = true;
import { buildDevE2ESeed } from '../src/dev/e2e/devE2ESeedRegistry';

for (const id of ['injury-case', 'standard-in-season-week'] as const) {
  try {
    const seed = buildDevE2ESeed(id);
    const program = (seed as any).state?.program ?? (seed as any).program;
    console.log(`\n=== ${id} ===`);
    console.log('program.id       :', program?.id);
    console.log('expected id      :', `dev-e2e-${id}`);
    console.log('microcycle starts:', (program?.microcycles ?? []).map((m: any) => m.startDate.slice(0, 10)).join(', '));
    const w = (seed as any).witnesses ?? [];
    const pw = w.find((x: any) => x.kind === 'program');
    console.log('witness weekStart:', pw?.weekStart, ' witness programId:', pw?.programId);
  } catch (e) {
    console.log(`\n=== ${id} === THREW:`, e instanceof Error ? e.message : e);
  }
}
