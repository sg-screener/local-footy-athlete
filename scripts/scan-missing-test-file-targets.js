// Static scan: readFileSync / path.resolve targets in test files that no
// longer exist on disk. This is the exact profileResetUITests failure mode —
// a module-scope file read against a path a purge deleted.
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/samgeurts/Documents/local-footy-athlete';
const TESTS = path.join(ROOT, 'src/__tests__');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = walk(TESTS);
const findings = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // path.resolve(__dirname, '..', 'a', 'b.tsx')  and  path.join(root, 'x/y.ts')
  const re = /path\.(?:resolve|join)\(\s*([^)]*?)\)/g;
  let m;
  while ((m = re.exec(src))) {
    const parts = m[1].split(',').map((p) => p.trim());
    if (!parts.length) continue;
    const segs = [];
    let base = null;
    for (const p of parts) {
      if (p === '__dirname') { base = path.dirname(file); continue; }
      const lit = p.match(/^['"](.*)['"]$/);
      if (lit) segs.push(lit[1]);
      else { base = base ?? null; segs.length = segs.length; }
    }
    if (base === null || segs.length === 0) continue;
    // only judge when every non-__dirname segment was a literal
    const literalCount = parts.filter((p) => /^['"].*['"]$/.test(p)).length;
    if (literalCount !== parts.length - 1) continue;
    const target = path.resolve(base, ...segs);
    if (/\.(ts|tsx|js|json|md|xlsx|csv)$/.test(target) && !fs.existsSync(target)) {
      findings.push({ file: path.relative(ROOT, file), target: path.relative(ROOT, target) });
    }
  }
}
if (!findings.length) console.log('STATIC: no missing literal path targets found');
for (const f of findings) console.log(`STATIC MISSING  ${f.file}\n                -> ${f.target}`);
