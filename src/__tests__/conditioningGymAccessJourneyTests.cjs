'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {spawnSync} = require('node:child_process');
const repo=path.resolve(__dirname,'../..');
function deliveredRows(rows, inheritedModality) {
  return rows.flatMap(row => row.choices
    ? row.choices.flatMap(choice => deliveredRows(choice.rows ?? [], choice.modalityLabel ?? inheritedModality).map(child=>({...child,role:child.role??row.role})))
    : [{...row, modalityLabel: row.modalityLabel ?? inheritedModality}]);
}
function verify(folder) {
  const year=JSON.parse(fs.readFileSync(path.join(folder,'year-programs.json'),'utf8'));
  assert(year.athletes.length>0,'No athlete was reached');
  for(const a of year.athletes) {
    assert(a.weeks.length>=8,'Must cross preparation, build and pre-season');
    assert(a.restarts.length>=8&&a.restarts.every(r=>r.ok),'Every reached week must reopen');
    assert.deepEqual(a.checkFailures??[],[]);
    for(const w of a.weeks) {
      assert.equal(new Set(w.days.map(d=>d.date)).size,7);
      const conditioning=w.days.filter(d=>deliveredRows(d.rows??[]).some(r=>r.role==='conditioning'));

      for(const d of conditioning) {
        const day=new Date(d.date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'});
        if(w.acceptedProgrammingInputs.preferredTrainingDays.includes(day)) continue;
        assert.deepEqual(deliveredRows(d.rows).filter(r=>r.role==='conditioning'&&/Bike|Erg/.test(r.modalityLabel??'')).map(r=>r.name),[],`${d.date}: machine work outside gym access`);
      }
    }
    for(const w of a.weeks.filter(w=>w.number===3||w.number===4)) assert(w.days.some(d=>deliveredRows(d.rows??[]).some(r=>r.role==='conditioning')),`Week ${w.number}: no aerobic offer`);
    console.log(`PASS ${a.athleteId??a.gender}: aerobic offers, dated machine access and ${a.restarts.length} reopens`);
  }
}
const folders=process.argv.slice(2);
if(folders.length) folders.forEach(verify);
else {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lfa-conditioning-access-'));
  for(const preset of ['two-day','three-day']) {
    const out=path.join(root,preset);fs.mkdirSync(out,{recursive:true});
    const log=fs.openSync(path.join(out,'run.log'),'w');
    const r=spawnSync(process.execPath,['scripts/athlete-cohort-year.cjs',`--preset=${preset}`,'--weeks=8',`--output=${out}`],{cwd:repo,stdio:['ignore',log,log]});fs.closeSync(log);
    assert.equal(r.status,0,`Journey failed: ${out}`);verify(out);
  }
}
