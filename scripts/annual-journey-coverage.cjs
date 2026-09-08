'use strict';
/** Evidence completeness, independent of whether the generated training is legal. */
function annualJourneyCoverage(year) {
  const expectedGenders=year.auditScope?.expectedGenders??['male','female'];
  const scopeValid=(!year.auditScope||year.auditScope.expectedWeeks===52)
    && expectedGenders.length>0&&new Set(expectedGenders).size===expectedGenders.length
    && expectedGenders.every(gender=>gender==='male'||gender==='female');
  const athletes=(year.athletes??[]).map(athlete=>{
    const weeks=athlete.weeks??[],days=weeks.flatMap(week=>week.days??[]),restarts=athlete.restarts??[];
    const start=Date.parse(year.start+'T12:00:00Z');
    const sevenDatedDays=Number.isFinite(start)&&weeks.every((week,index)=>week.start===new Date(start+index*7*86400000).toISOString().slice(0,10)
      &&(week.days??[]).length===7
      && week.days.every((day,index)=>day.date===new Date(Date.parse(week.start+'T12:00:00Z')+index*86400000).toISOString().slice(0,10)));
    const successfulRestarts=restarts.filter(restart=>restart.ok===true).length;
    const failedActions=(athlete.actions??[]).filter(action=>action.result && 'outcome' in action.result
      ? action.result.outcome!=='accepted' : action.result?.ok!==true).length;
    const failedChecks=(athlete.checkFailures??[]).length;
    return {gender:athlete.gender,weeks:weeks.length,athleteDays:days.length,restartChecks:restarts.length,successfulRestarts,
      distinctWeeks:new Set(weeks.map(week=>week.start)).size,distinctDays:new Set(days.map(day=>day.date)).size,
      distinctRestartDates:new Set(restarts.map(restart=>restart.date)).size,sevenDatedDays,failedActions,failedChecks};
  });
  const complete=scopeValid&&athletes.length===expectedGenders.length
    && expectedGenders.every(gender=>athletes.filter(athlete=>athlete.gender===gender).length===1)
    && athletes.every(athlete=>athlete.weeks===52&&athlete.distinctWeeks===52&&athlete.athleteDays===364&&athlete.distinctDays===364
      && athlete.restartChecks===52&&athlete.successfulRestarts===52&&athlete.distinctRestartDates===52
      && athlete.sevenDatedDays&&athlete.failedActions===0&&athlete.failedChecks===0);
  return {expectedGenders,athletes,complete};
}
module.exports={annualJourneyCoverage};
