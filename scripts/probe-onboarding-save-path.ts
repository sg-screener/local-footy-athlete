/** Retired diagnostic: the hard-coded onboarding fallback no longer exists. */
export {};
console.error('RETIRED: this probe modelled DEFAULT_PROGRAM fallback, not current onboarding. Run npm run test:onboarding-generation-outcome and npm run test:canonical-weekly-compiler.');
process.exitCode = 2;
