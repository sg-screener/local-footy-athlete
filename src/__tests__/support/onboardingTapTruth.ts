import fs from 'fs';
import path from 'path';

/** The native tape supplies the geometry evidence. These binding guards stop
 * the known first-frame inset shift and blind tap-only journeys returning. */
export function onboardingTapTruth(ok: (label: string, value: boolean) => void) {
  const root = path.resolve(__dirname, '../../..');
  const layout = fs.readFileSync(path.join(root, 'src/components/onboarding/OnboardingLayout.tsx'), 'utf8');
  const start = layout.indexOf('  return (', layout.indexOf('export const OnboardingLayout'));
  const end = layout.indexOf('\nconst styles', start);
  ok('onboarding: shared shell render anchors are present', start >= 0 && end > start + 300);
  const rendered = layout.slice(start, end);
  ok('onboarding: stable context insets position the screen before answer hit targets mount',
    /paddingTop: insets\.top/.test(rendered) && !/<SafeAreaView\b/.test(rendered));
  const km = fs.readFileSync(path.join(root, 'src/screens/onboarding/TwoKmTimeTrialScreen.tsx'), 'utf8');
  const injuries = fs.readFileSync(path.join(root, 'src/screens/onboarding/InjuriesScreen.tsx'), 'utf8');
  ok('onboarding: skip and No have distinct button identities at their existing callbacks',
    /testID="onboarding-two-km-skip"[\s\S]{0,200}onPress=\{\(\) => commit\(null\)\}/.test(km)
    && /testID="onboarding-injury-no"[\s\S]{0,120}onPress=\{saveNoIssues\}/.test(injuries));
  const tapePath = path.join(root, '.maestro/visible/onboarding-critical-answers.yaml');
  const tape = fs.existsSync(tapePath) ? fs.readFileSync(tapePath, 'utf8') : '';
  for (const id of ['onboarding-two-km-skip', 'onboarding-injury-no']) {
    const tap = tape.indexOf(`- tapOn:\n    id: ${id}`);
    const ready = tape.lastIndexOf('- waitForAnimationToEnd', tap);
    const visible = tape.lastIndexOf('- extendedWaitUntil:', ready);
    ok(`onboarding/${id}: tape waits for the new screen and settled layout before one tap`,
      visible >= 0 && ready > visible && tap > ready && tap - ready < 80);
  }
  ok('onboarding: tape checks the saved skip and no-injury answers on Review',
    tape.includes('onboarding-review-TwoKmTimeTrial-value') && tape.includes('onboarding-review-Injuries-value')
    && tape.includes('No current issues') && !tape.includes('retryIfNoChange: true'));
}
