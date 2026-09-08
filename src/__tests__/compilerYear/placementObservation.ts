import type { compileCanonicalWeek } from '../../rules/canonicalWeeklyCompiler';
const weekly = require('../../rules/canonicalWeeklyCompiler') as { compileCanonicalWeek: typeof compileCanonicalWeek };

/** Separate explicit placement previews from final authorship for every observer.
 * Never choose observations by matching the final output: that would hide loss.
 * Each scope restores the previous wrapper, so nested observers remain valid.
 */
export function observeStrengthPlacementScope() {
  const original = weekly.compileCanonicalWeek;
  let depth = 0;
  weekly.compileCanonicalWeek = (input, assignment) => original({
    ...input,
    ...(input.resolveStrengthWorkload ? {resolveStrengthWorkload: draft => {
      depth++;
      try { return input.resolveStrengthWorkload!(draft); }
      finally { depth--; }
    }} : {}),
  }, assignment);
  return {
    isPreview: () => depth > 0,
    restore: () => { weekly.compileCanonicalWeek = original; },
  };
}
