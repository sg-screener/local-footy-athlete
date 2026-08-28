import fs from 'fs';
import path from 'path';

export function guidedInjuryUiTruth(ok: (label: string, value: boolean) => void) {
  const sheet = fs.readFileSync(path.resolve(__dirname, '../../screens/home/GuidedInjuryFlowSheet.tsx'), 'utf8');
  // Anchor the rendered loop; a comment or unused component is not a row.
  const start = sheet.indexOf("\n    if (step === 'severity') {");
  const end = sheet.indexOf('return null;', start);
  const rows = sheet.slice(start, end);
  ok('injury UI: severity rows have neutral chips and dividers, including 4–5',
    start >= 0 && end > start + 200
    && rows.includes('GUIDED_INJURY_SEVERITY_OPTIONS.map(')
    && /<FlowOption\b/.test(rows) && !/selected=/.test(rows));
}
