const {spawnSync}=require('child_process');const assert=require('assert/strict');
const cases={week_scope:'YP5 Bench on another day',repeat_first:'YP5 unused horizontal push',list_chooser:'YP5 normal chooser',generic_dose:'YP1 added main',add_authored:'YP2 every authored',lost_units:'YP2 authored hold',optional_denominator:'YP3 four required',optional_credit:'YP3 optional completion',missed_recovery:'YP4 recovery window'};
for(const [mutation,expected] of Object.entries(cases)){
 const r=spawnSync(process.execPath,['src/__tests__/yearproofRepairTests.cjs'],{encoding:'utf8',env:{...process.env,YEARPROOF_MUTATION:mutation}});
 const output=r.stdout+r.stderr;
 assert.equal(r.status,1,`${mutation} did not fail the check: ${output}`);
 assert(output.includes(`FAIL ${expected}`),`${mutation} failed for the wrong reason: ${output}`);
 console.log(`PASS mutation ${mutation}: expected check rejects defect`);
}
console.log(`Mutation checks: ${Object.keys(cases).length} passed; app files unchanged.`);
