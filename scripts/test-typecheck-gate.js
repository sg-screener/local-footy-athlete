'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'typecheck-gate.js'), 'utf8');
const keys = ['product', 'devtools', 'tests'];
function run({ output = '', allowances = 0, update = false, code = source, compilerFailed = true } = {}) {
  const baseline = { scopes: Object.fromEntries(keys.map((key) => [key, {
    files: allowances ? { 'src/example.ts': allowances } : {}, total: allowances,
  }])) };
  const writes = [];
  let exit = 0;
  const ended = {};
  const silent = () => {};
  try {
    vm.runInNewContext(code, {
      __dirname, Date,
      console: { log: silent, error: silent },
      process: { argv: update ? ['node', 'gate', '--update'] : ['node', 'gate'],
        exit: (value) => { exit = value; throw ended; } },
      require: (name) => {
        if (name === 'path') return path;
        if (name === 'fs') return { existsSync: () => true,
          readFileSync: () => JSON.stringify(baseline),
          writeFileSync: (_file, content) => writes.push(JSON.parse(content)) };
        if (name === 'child_process') return { execFileSync: () => {
          if (compilerFailed) throw Object.assign(new Error('compiler failed'), { status: 2, stdout: output });
          return output;
        } };
        throw new Error(`Unexpected dependency ${name}`);
      },
    });
  } catch (error) {
    if (error !== ended) exit = 1;
  }
  return { exit, writes };
}

let passed = 0;
let failed = 0;
function test(name, body) {
  try { body(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
}
const diagnostic = 'src/example.ts(1,2): error TS2322: incompatible type';
const refuses = (result) => { assert.notEqual(result.exit, 0); assert.equal(result.writes.length, 0); };
test('all three successful compiler scopes can pass', () => assert.equal(run({ compilerFailed: false }).exit, 0));
test('known file-level debt is counted without pretending it is zero', () =>
  assert.equal(run({ allowances: 1, output: diagnostic }).exit, 0));
test('a new diagnostic blocks the gate and cannot be absorbed with --update', () => {
  refuses(run({ output: diagnostic }));
  refuses(run({ output: diagnostic, update: true }));
});
test('a genuinely improved baseline may only move down', () => {
  const result = run({ compilerFailed: false, allowances: 2, update: true });
  assert.equal(result.exit, 0); assert.equal(result.writes.length, 1);
  for (const key of keys) { assert.equal(result.writes[0].scopes[key].total, 0); assert.deepEqual(Object.keys(result.writes[0].scopes[key].files), []); }
});
test('missing compiler and global/config diagnostics are red, never zero errors', () => {
  for (const output of ['', 'npm error: compiler unavailable', 'error TS18003: No inputs were found',
    diagnostic + '\nerror TS5083: Cannot read config']) refuses(run({ output, update: true }));
});
test('mutation: restoring unconditional baseline update breaks refusal', () => {
  const mutant = source.replace('if (updating && regressions.length === 0)', 'if (updating)');
  assert.notEqual(mutant, source, 'the mutation must reach the update condition');
  assert.throws(() => refuses(run({ code: mutant, output: diagnostic, update: true })));
});
console.log(`Typecheck gate controls: ${passed} passed, ${failed} failed (mock compiler outcomes, not product type results).`);
process.exitCode = failed ? 1 : 0;
