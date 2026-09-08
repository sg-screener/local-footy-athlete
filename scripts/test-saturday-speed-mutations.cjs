const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const mutations={
 'title-penalty': ['src/rules/weeklyScheduler.ts','const lowerCost = dose ? dose.unknown || dose.workingSets >= 10 : heavyLower.has(previous);','const lowerCost = heavyLower.has(previous);','unit'],
 'six-set-ban': ['src/rules/weeklyScheduler.ts','dose.workingSets >= 10','dose.workingSets >= 6','unit'],
 'double-leg-sets': ['src/rules/lowerBodyWorkload.ts','workingSets += sets;','workingSets += sets * 2;','real rows'],
 'ignore-completed-sets': ['src/rules/lowerBodyWorkload.ts',"log?.completedSets ?? (log?.completion === 'full' ? log.prescribedSets : row.prescribedSets)",'row.prescribedSets','real rows'],
 'ignore-meaningful-mobility':['src/rules/lowerBodyWorkload.ts','return [...parts.strengthRows, ...parts.supportRows, ...parts.mobilityRows, ...parts.recoveryRows];','return [...parts.strengthRows, ...parts.supportRows];','real rows count'],
 'consolidate-first': ['src/rules/weeklyScheduler.ts','freshnessCost(day), ...(selection.placementCostByDay?.[day] ?? []), role, orderIndex(day)','freshnessCost(day), role, ...(selection.placementCostByDay?.[day] ?? []), orderIndex(day)','real three-day'],
 'ignore-real-dose': ['src/rules/canonicalWeeklyCompiler.ts','if (!input.resolveStrengthWorkload) return draft;','if (true) return draft;','real three-day'],
 'promote-friday': ['src/rules/canonicalWeeklyCompiler.ts',': Object.fromEntries(draft.schedule.days',': Object.fromEntries([]','real three-day'],
};
function installMutation(name){const m=mutations[name];if(!m)throw Error('Unknown mutation '+name);const previous=require.extensions['.ts'];let reached=false;
 require.extensions['.ts']=function(mod,file){if(file!==path.join(root,m[0]))return previous(mod,file);let source=fs.readFileSync(file,'utf8');if(!source.includes(m[1]))throw Error('Mutation anchor missing: '+name);source=source.replace(m[1],m[2]);reached=true;console.log('MUTATION REACHED '+name);return mod._compile(require('sucrase').transform(source,{transforms:['typescript','imports'],filePath:file}).code,file);};
 process.on('exit',()=>{if(!reached){console.error('Mutation never reached '+name);process.exitCode=2;}});
}
module.exports={installMutation};
if(require.main===module){let failures=0;for(const[name,m]of Object.entries(mutations)){
 const unit=m[3]==='unit';const r=spawnSync(process.execPath,unit?['-r','sucrase/register','-r',path.join(__dirname,'test-saturday-speed-mutation-register.cjs'),'src/__tests__/saturdaySpeedPlacementTests.ts']:['src/__tests__/saturdaySpeedJourneyTests.cjs'],{cwd:root,encoding:'utf8',env:{...process.env,TZ:'Australia/Melbourne',SATURDAY_SPEED_MUTATION:name,SATURDAY_SPEED_FILTER:unit?'':m[3]}});
 const output=r.stdout+r.stderr;const caught=r.status===1&&output.includes('MUTATION REACHED '+name)&& (unit?output.includes('AssertionError'):output.includes('FAIL '+m[3]))&&!output.includes('Mutation anchor missing');
 console.log((caught?'PASS':'FAIL')+' fault control '+name);if(!caught){failures++;console.error(output);}
 }console.log(`Saturday Speed fault controls: ${Object.keys(mutations).length-failures}/${Object.keys(mutations).length} caught`);if(failures)process.exitCode=1;}
