'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {spawnSync}=require('node:child_process');
const {checkAnnualSecondRepairs}=require('./support/annualSecondRepairChecks.cjs');
const root=path.resolve(__dirname,'../..');
function verify(folder){
 const y=JSON.parse(fs.readFileSync(path.join(folder,'year-programs.json'),'utf8')).athletes[0];
 assert.equal(y.weeks.length,52,'Reach all phases, injuries and accumulated block history');
 const receipt=checkAnnualSecondRepairs(folder);
 if(path.basename(folder)==='minimal-kit'){
  const week=y.weeks[26];const powers=[];
  for(const d of week.days){
   const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder,'raw',d.date+'.json.gz'))));
   powers.push(...(raw.day.workout?.exercises??[]).filter(r=>r.role==='power').map(r=>r.exercise.name));
  }
  assert(powers.includes('Explosive Push-up')&&powers.includes('Explosive Landmine Press'),'Both safe upper-power alternatives must be delivered instead of a phantom selection consuming one');
  assert.equal(new Set(powers).size,powers.length,'Unused suitable power wins over repeating during this full safe two-option week');
 }
 console.log(`PASS second annual repair journey ${path.basename(folder)}: ${JSON.stringify(receipt)}`);
}
if(process.argv.length>2)process.argv.slice(2).forEach(verify);
else{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'lfa-second-annual-repairs-'));
 for(const name of ['minimal-kit','beginner-three-years']){
  const folder=path.join(out,name);fs.mkdirSync(folder,{recursive:true});const log=fs.openSync(path.join(folder,'run.log'),'w');
  const p=spawnSync(process.execPath,['scripts/annual-audit-evidence.cjs','--preset='+name,'--weeks=52','--output='+folder],{cwd:root,stdio:['ignore',log,log]});fs.closeSync(log);
  assert.equal(p.status,0,`Real app journey failed: ${folder}`);verify(folder);
 }
}
