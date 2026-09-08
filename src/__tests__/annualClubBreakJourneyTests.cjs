'use strict';
// Execute the real yearly drivers. Optional existing artifacts let an unchanged
// captured failure prove this guard red before a repair, without inventing state.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const repo = path.resolve(__dirname, '../..');
const from = '2026-12-18', until = '2027-01-30'; // Sam's accepted audit dates.
const isClub = d => d.type === 'Team Training' || (d.parts ?? []).some(p => p.kind === 'team_training') || (d.rows ?? []).some(r => r.role === 'team_training');
function verify(folder) {
  const year = JSON.parse(fs.readFileSync(path.join(folder, 'year-programs.json'), 'utf8'));
  for (const athlete of year.athletes) {
    const days = athlete.weeks.flatMap(w => w.days);
    assert(days.some(d => d.date === '2027-02-03'), 'Journey must reach the resumed club week');
    assert.deepEqual(athlete.checkFailures ?? [], [], 'No refused actions or failed reopens hidden by the cohort runner');
    assert.equal(athlete.restarts.length, athlete.weeks.length);
    assert(athlete.restarts.every(r => r.ok), 'Saved weeks must survive reopen');
    const closed = days.filter(d => d.date >= from && d.date <= until);
    assert.equal(closed.length, 44, 'Every date in the inclusive break must be captured');
    assert.deepEqual(closed.filter(isClub).map(d => d.date), [], 'Club sessions survived the Christmas break');
    assert(closed.some(d => (d.rows ?? []).some(r => r.role === 'main_lift')), 'The club break must preserve app lifting');
    for (const date of ['2026-12-16','2027-02-01','2027-02-03']) {
      assert(isClub(days.find(d => d.date === date)), `Club session missing outside break: ${date}`);
    }
    console.log(`PASS ${athlete.athleteId ?? athlete.gender}: 44 closed dates, before/after club anchors, lifting retained, ${athlete.restarts.length} reopens`);
  }
}
async function run(spec, root) {
  const out = path.join(root,spec.label);fs.mkdirSync(out,{recursive:true});
  const log = fs.openSync(path.join(out,'generation.log'),'w');
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[spec.script,...spec.args,'--weeks=19',`--output=${out}`],{cwd:repo,stdio:['ignore',log,log]});
    child.on('error',reject);child.on('close',resolve);
  });
  fs.closeSync(log);assert.equal(code,0,`${spec.label} driver failed; see ${out}`);verify(out);
}
(async()=>{
  const existing=process.argv.slice(2);
  if(existing.length){for(const folder of existing)verify(path.resolve(folder));return;}
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lfa-annual-club-break-'));
  console.log(`Annual club-break journey evidence: ${root}`);
  await Promise.all([
    {label:'two-day',script:'scripts/athlete-cohort-year.cjs',args:['--preset=two-day']},
    {label:'three-day',script:'scripts/athlete-cohort-year.cjs',args:['--preset=three-day']},
    {label:'pair-male',script:'scripts/programming-remediation-year.cjs',args:['--kit=full','--gender=male']},
  ].map(s=>run(s,root)));
})().catch(e=>{console.error(e);process.exitCode=1;});
