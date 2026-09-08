/** Historical constraint fixture; no current app writer accepts soreness. */
import { buildInjuryConstraint } from '../../utils/exposureEngine';
export function historicalSorenessConstraint(args: {region: Parameters<typeof buildInjuryConstraint>[0]['region']; severity: number}) {
  return {...buildInjuryConstraint({...args,severity:Math.max(1,args.severity-2)}),
    type:'soreness' as const,severity:args.severity};
}
