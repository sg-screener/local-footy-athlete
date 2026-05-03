/**
 * profileResetUITests — proves the MVP Profile page structure is
 * wired into the live ProfileScreen.tsx (the screen the Profile tab
 * routes to), with coach adjustment state, separated danger-zone reset,
 * FAQ copy, and reset functions still calling the canonical helpers.
 *
 * The previous "reset is implemented" claim was false because the
 * section had been added to ProfileHomeScreen.tsx — a file the tab
 * navigator never mounts. This suite uses static-source assertions
 * over the actual rendered file plus a behavioural call-through
 * test using the reset module's dep injection seam.
 *
 * Run: npm run test:profile-reset-ui
 */

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

import * as fs from 'fs';
import * as path from 'path';
import {
  clearCoachAdjustments,
  clearCoachChat,
  resetProgramAndOnboarding,
} from '../utils/resetCoach';

// ─── Harness ─────────────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`); }
  else { fail++; failures.push(name); console.log(`  \u2717 ${name}${detail ? '\n      ' + detail : ''}`); }
}
function section(label: string) { console.log(`\n${label}`); }

// ─── Load the actual rendered file ──────────────────────────────────
const PROFILE_SCREEN_PATH = path.resolve(
  __dirname,
  '..',
  'screens',
  'profile',
  'ProfileScreen.tsx',
);
const src = fs.readFileSync(PROFILE_SCREEN_PATH, 'utf8');
const HOME_CONSTANTS_PATH = path.resolve(
  __dirname,
  '..',
  'screens',
  'home',
  'homeScreenConstants.ts',
);
const homeConstants = fs.readFileSync(HOME_CONSTANTS_PATH, 'utf8');

// ═════════════════════════════════════════════════════════════════════
// 1. The actual file rendered by the Profile tab contains the MVP sections
// ═════════════════════════════════════════════════════════════════════
section('[1] ProfileScreen.tsx contains MVP Profile sections');
ok('section title PROGRAM SETUP present', /PROGRAM SETUP/.test(src));
ok('section title COACH ADJUSTMENTS present', /COACH ADJUSTMENTS/.test(src));
ok('section title LEARN / FAQ present', /LEARN \/ FAQ/.test(src));
ok('section title SUPPORT present', /SUPPORT/.test(src));
ok('section title LEGAL present', /LEGAL/.test(src));
ok('section title DANGER ZONE present', /DANGER ZONE/.test(src));
ok('page header PROFILE present', />\s*PROFILE\s*</.test(src));
ok(
  'page subtitle present',
  /Your program setup, coach adjustments and support\./.test(src),
);
ok('label "Clear active changes" present', /Clear active changes/.test(src));
ok('old visible label "Clear coach adjustments" removed', !/>\s*Clear coach adjustments\s*</.test(src));
ok('label "Clear coach chat" present', /Clear coach chat/.test(src));
ok('label "Privacy Policy" present', /Privacy Policy/.test(src));
ok('label "Terms of Use" present', /Terms of Use/.test(src));
ok('Delete Account is not shown for no-account MVP', !/>\s*Delete Account\s*</.test(src));
ok('label "Full reset" present', /Full reset/.test(src));

// ═════════════════════════════════════════════════════════════════════
// 1b. Program setup shows available program-driving profile fields
// ═════════════════════════════════════════════════════════════════════
section('[1b] Program setup shows profile inputs that drive the program');
ok('Name row present', /label="Name"/.test(src));
ok('Position row present', /label="Position"/.test(src));
ok('Experience row present', /label="Experience"/.test(src));
ok('Training days per week row present', /label="Training days per week"/.test(src));
ok('Team training days row present when available', /label="Team training days"/.test(src));
ok('Game day row present when available', /label="Game day"/.test(src));
ok('Main goal / focus row present when available', /label="Main goal \/ focus"/.test(src));
ok('Equipment / gym access row removed', !/Equipment \/ gym access/.test(src));
ok(
  'long assumed equipment list is not rendered',
  !/Barbell|Dumbbells|Squat rack|Pullup bar|Cable machine|Hamstring curl|Knee extension|Bands/.test(src),
);
ok('Program setup CTA present', /Something changed\? Tell the coach/.test(src));
ok('Program setup CTA testID present', /testID="profile-program-setup-change"/.test(src));
ok(
  'Program setup CTA navigates to Coach with setup prefill',
  /onProgramSetupChanged[\s\S]*navigation\.navigate\('CoachTab'[\s\S]*prefill:\s*'I need to make an adjustment to my program setup — '/.test(src),
);

// ═════════════════════════════════════════════════════════════════════
// 1c. Coach adjustments show active state or empty state
// ═════════════════════════════════════════════════════════════════════
section('[1c] Coach adjustments render active issue state');
ok('imports useCoachUpdatesStore', /useCoachUpdatesStore/.test(src));
ok('reads activeConstraints', /activeConstraints\s*=\s*useCoachUpdatesStore/.test(src));
ok('formats injury issue as pain + severity', /return `\$\{part\} pain — \$\{c\.severity\}\/10`/.test(src));
ok('formats fatigue issue as severity', /return `Fatigue — \$\{c\.severity\}\/10`/.test(src));
ok('renders Active label', /Active:/.test(src));
ok('renders no active coach changes empty state', /No active coach changes\./.test(src));
ok(
  'old equipment guidance copy removed from Profile',
  !/Missing equipment\? Tell the coach and your session can be adjusted\./.test(src),
);

// ═════════════════════════════════════════════════════════════════════
// 2. Reset functions are imported from the canonical module
// ═════════════════════════════════════════════════════════════════════
section('[2] Reset functions imported from utils/resetCoach');
ok(
  'imports clearCoachAdjustments',
  /import\s*{[^}]*clearCoachAdjustments[^}]*}\s*from\s*['"][^'"]*resetCoach['"]/.test(src),
);
ok(
  'imports clearCoachChat',
  /import\s*{[^}]*clearCoachChat[^}]*}\s*from\s*['"][^'"]*resetCoach['"]/.test(src),
);
ok(
  'imports resetProgramAndOnboarding',
  /import\s*{[^}]*resetProgramAndOnboarding[^}]*}\s*from\s*['"][^'"]*resetCoach['"]/.test(src),
);

// ═════════════════════════════════════════════════════════════════════
// 3. Each button's onPress handler invokes the correct reset function
// ═════════════════════════════════════════════════════════════════════
section('[3] Button handlers wired to correct reset functions');
ok(
  'Clear active changes handler still calls clearCoachAdjustments()',
  /onClearCoachAdjustments[\s\S]*?clearCoachAdjustments\(/.test(src),
);
ok(
  'onClearCoachChat calls clearCoachChat()',
  /onClearCoachChat[\s\S]*?clearCoachChat\(/.test(src),
);
ok(
  'onFullReset calls resetProgramAndOnboarding()',
  /onFullReset[\s\S]*?resetProgramAndOnboarding\(/.test(src),
);

// ═════════════════════════════════════════════════════════════════════
// 4. Section order matches MVP structure
// ═════════════════════════════════════════════════════════════════════
section('[4] Profile sections are in MVP order');
{
  const setupIdx = src.indexOf('PROGRAM SETUP');
  const coachIdx = src.indexOf('COACH ADJUSTMENTS');
  const faqIdx = src.indexOf('LEARN / FAQ');
  const supportIdx = src.indexOf('SUPPORT');
  const legalIdx = src.indexOf('LEGAL');
  const dangerIdx = src.indexOf('DANGER ZONE');
  ok('PROGRAM SETUP found', setupIdx !== -1);
  ok('COACH ADJUSTMENTS found', coachIdx !== -1);
  ok('LEARN / FAQ found', faqIdx !== -1);
  ok('SUPPORT found', supportIdx !== -1);
  ok('LEGAL found', legalIdx !== -1);
  ok('DANGER ZONE found', dangerIdx !== -1);
  ok('sections appear in requested order',
    setupIdx >= 0 &&
    setupIdx < coachIdx &&
    coachIdx < faqIdx &&
    faqIdx < supportIdx &&
    supportIdx < legalIdx &&
    legalIdx < dangerIdx,
    `setup=${setupIdx}, coach=${coachIdx}, faq=${faqIdx}, support=${supportIdx}, legal=${legalIdx}, danger=${dangerIdx}`);
}

// ═════════════════════════════════════════════════════════════════════
// 4b. Full reset is separated from Coach adjustments
// ═════════════════════════════════════════════════════════════════════
section('[4b] Full reset is under Danger Zone, not Coach adjustments');
{
  const coachStart = src.indexOf('COACH ADJUSTMENTS');
  const faqStart = src.indexOf('LEARN / FAQ');
  const dangerStart = src.indexOf('DANGER ZONE');
  const fullReset = src.indexOf('testID="profile-full-reset"');
  ok('Full reset appears after DANGER ZONE', dangerStart >= 0 && fullReset > dangerStart);
  ok(
    'Full reset is not inside Coach adjustments block',
    coachStart >= 0 && faqStart > coachStart && (fullReset < coachStart || fullReset > faqStart),
    `coachStart=${coachStart}, faqStart=${faqStart}, fullReset=${fullReset}`,
  );
}

// ═════════════════════════════════════════════════════════════════════
// 5. Section is inside the ScrollView so it's reachable
// ═════════════════════════════════════════════════════════════════════
section('[5] Section lives inside ScrollView');
{
  const scrollOpen = src.indexOf('<ScrollView');
  const scrollClose = src.indexOf('</ScrollView>');
  const coachIdx = src.indexOf('COACH ADJUSTMENTS');
  ok('ScrollView open found', scrollOpen !== -1);
  ok('ScrollView close found', scrollClose !== -1);
  ok('COACH ADJUSTMENTS between ScrollView tags',
    scrollOpen < coachIdx && coachIdx < scrollClose);
}

// ═════════════════════════════════════════════════════════════════════
// 6. testID accessibility hooks present (for future component tests)
// ═════════════════════════════════════════════════════════════════════
section('[6] testID hooks present for each row');
ok('testID profile-program-setup-section', /testID="profile-program-setup-section"/.test(src));
ok('testID profile-page-header', /testID="profile-page-header"/.test(src));
ok('testID profile-program-setup-change', /testID="profile-program-setup-change"/.test(src));
ok('testID profile-coach-adjustments-section', /testID="profile-coach-adjustments-section"/.test(src));
ok('testID profile-active-coach-state', /testID="profile-active-coach-state"/.test(src));
ok('testID profile-no-active-coach-adjustments', /testID="profile-no-active-coach-adjustments"/.test(src));
ok('testID profile-learn-faq-section', /testID="profile-learn-faq-section"/.test(src));
ok('testID profile-support-section', /testID="profile-support-section"/.test(src));
ok('testID profile-legal-section', /testID="profile-legal-section"/.test(src));
ok('testID profile-privacy-policy', /testID="profile-privacy-policy"/.test(src));
ok('testID profile-terms-of-use', /testID="profile-terms-of-use"/.test(src));
ok('testID profile-danger-zone-section', /testID="profile-danger-zone-section"/.test(src));
ok('testID profile-clear-coach-adjustments', /testID="profile-clear-coach-adjustments"/.test(src));
ok('testID profile-clear-coach-chat', /testID="profile-clear-coach-chat"/.test(src));
ok('testID profile-full-reset', /testID="profile-full-reset"/.test(src));

// ═════════════════════════════════════════════════════════════════════
// 6b. Legal/support App Store surfaces are reachable from live Profile
// ═════════════════════════════════════════════════════════════════════
section('[6b] Legal/support surfaces are reachable');
ok('Support renders Leave Feedback', /Leave Feedback/.test(src));
ok('Support renders Ask a Human', /Ask a Human/.test(src));
ok('Support opens mailto link', /Linking\.openURL\(buildMailto\(env\.supportEmail,\s*'LFA - Speak to a Human'\)\)/.test(src));
ok('Privacy row navigates to Privacy screen', /onPress=\{\(\) => navigation\.navigate\('Privacy'\)\}/.test(src));
ok('Terms row navigates to Terms screen', /onPress=\{\(\) => navigation\.navigate\('Terms'\)\}/.test(src));

// ═════════════════════════════════════════════════════════════════════
// 7. Render-time + press-time logs exist
// ═════════════════════════════════════════════════════════════════════
section('[7] Runtime proof logs');
ok(
  '[profile] coach_adjustments_section_rendered',
  /\[profile\]\s*coach_adjustments_section_rendered/.test(src),
);
ok(
  '[reset-ui] clear_coach_adjustments_pressed',
  /\[reset-ui\]\s*clear_coach_adjustments_pressed/.test(src),
);
ok(
  '[reset-ui] clear_coach_chat_pressed',
  /\[reset-ui\]\s*clear_coach_chat_pressed/.test(src),
);
ok(
  '[reset-ui] full_reset_pressed',
  /\[reset-ui\]\s*full_reset_pressed/.test(src),
);

// ═════════════════════════════════════════════════════════════════════
// 8. Behavioural — invoke the reset functions directly via deps and
//    confirm they touch the right surfaces. Mirrors what onPress does.
// ═════════════════════════════════════════════════════════════════════
section('[8] Reset functions still callable + dispatch correctly');
{
  let activeInjuryNulled = false;
  let coachUpdatesCleared = 0;
  let coachStoreCleared = false;
  let programCleared = false;

  const fakeDeps = {
    programStore: {
      getOverrideContexts: () => ({}),
      getDateOverrides: () => ({}),
      removeManualOverride: () => {},
      clearManualOverrides: () => {},
      clear: () => { programCleared = true; },
    },
    coachUpdatesStore: {
      getActiveInjury: () => ({ bodyPart: 'hammy' }),
      getUpdatesByWeek: () => ({ '2026-04-27': { active: true } }),
      setActiveInjury: (s: any) => { if (s === null) activeInjuryNulled = true; },
      clearAllCoachUpdates: () => { coachUpdatesCleared = 1; },
    },
    profileStore: { resetOnboarding: () => {}, clear: () => {} },
    calendarStore: { clear: () => {} },
    athletePreferencesStore: { setActiveInjuries: () => {}, clear: () => {} },
    coachStore: { clear: () => { coachStoreCleared = true; } },
    clearPendingInjury: () => {},
  };

  const a = clearCoachAdjustments({ deps: fakeDeps as any });
  ok('clearCoachAdjustments → activeInjury nulled', activeInjuryNulled);
  ok('clearCoachAdjustments → coachUpdates cleared', coachUpdatesCleared === 1);
  ok('clearCoachAdjustments → summary.activeInjuryCleared', a.activeInjuryCleared);

  const b = clearCoachChat({ deps: fakeDeps as any });
  ok('clearCoachChat → coachStore cleared', coachStoreCleared);
  ok('clearCoachChat → summary.chatCleared', b.chatCleared);

  // Reset state for full reset run.
  programCleared = false;
  coachStoreCleared = false;
  const c = resetProgramAndOnboarding({ deps: fakeDeps as any });
  ok('resetProgramAndOnboarding → program cleared', programCleared);
  ok('resetProgramAndOnboarding → chat cleared', coachStoreCleared);
  ok('resetProgramAndOnboarding → summary.chatCleared', c.chatCleared);
}

// ═════════════════════════════════════════════════════════════════════
// 9. The unused/wrong file ProfileHomeScreen.tsx isn't routed —
//    the Profile tab MUST point at ProfileScreen.tsx. Check the
//    AppNavigator wires it correctly.
// ═════════════════════════════════════════════════════════════════════
section('[9] Navigator routes Profile tab to ProfileScreen');
{
  const navPath = path.resolve(__dirname, '..', 'navigation', 'AppNavigator.tsx');
  if (fs.existsSync(navPath)) {
    const nav = fs.readFileSync(navPath, 'utf8');
    ok(
      'AppNavigator imports ProfileScreen',
      /from\s*['"][^'"]*ProfileScreen['"]/.test(nav),
    );
    ok(
      'AppNavigator imports PrivacyScreen',
      /from\s*['"][^'"]*PrivacyScreen['"]/.test(nav),
    );
    ok(
      'AppNavigator imports TermsScreen',
      /from\s*['"][^'"]*TermsScreen['"]/.test(nav),
    );
    ok('AppNavigator routes Privacy screen', /name="Privacy"\s+component=\{PrivacyScreen\}/.test(nav));
    ok('AppNavigator routes Terms screen', /name="Terms"\s+component=\{TermsScreen\}/.test(nav));
    ok('DeleteAccountScreen is not routed in no-account MVP', !/DeleteAccountScreen/.test(nav));
  } else {
    ok('AppNavigator file present', false, navPath);
  }
}

// ═════════════════════════════════════════════════════════════════════
// 9b. Legal copy is MVP-safe and not account-placeholder copy
// ═════════════════════════════════════════════════════════════════════
section('[9b] Legal copy is MVP-safe');
{
  const privacyPath = path.resolve(__dirname, '..', 'screens', 'profile', 'PrivacyScreen.tsx');
  const termsPath = path.resolve(__dirname, '..', 'screens', 'profile', 'TermsScreen.tsx');
  const privacy = fs.readFileSync(privacyPath, 'utf8');
  const terms = fs.readFileSync(termsPath, 'utf8');
  ok('Privacy says MVP does not require an account', /does not require you to create an account/.test(privacy));
  ok('Privacy mentions backend and AI services', /backend and AI services/.test(privacy));
  ok('Privacy says not medical diagnosis/treatment/rehab', /not medical diagnosis, treatment or rehab/.test(privacy));
  ok('Privacy avoids password placeholder claim', !/password is encrypted/i.test(privacy));
  ok('Terms title says Terms of Use', /Terms of Use/.test(terms));
  ok('Terms says S&C app, not medical advice', /Local Footy Athlete is an S&C app/.test(terms));
  ok('Terms warns coach is not for diagnosis or treatment', /diagnosis or treatment decisions/.test(terms));
  ok('Terms avoids subscription placeholder claim', !/Paid subscriptions automatically renew/i.test(terms));
}

// ═════════════════════════════════════════════════════════════════════
// 10. FAQ contains the MVP product questions
// ═════════════════════════════════════════════════════════════════════
section('[10] FAQ contains MVP product questions');
{
  const faqPath = path.resolve(__dirname, '..', 'screens', 'profile', 'FAQScreen.tsx');
  const faq = fs.readFileSync(faqPath, 'utf8');
  const questions = [
    'How does the app build my program?',
    'What does the AI coach actually change?',
    'What is a Coach Update?',
    'Why did my session change?',
    'What happens if I’m injured or sore?',
    'Why doesn’t the app give me rehab exercises?',
    'Why does the week change around game day?',
    'Why are there no obvious progressions every week?',
    'When should I tap Update coach?',
    'When should I see a physio?',
  ];
  for (const q of questions) {
    ok(`FAQ includes: ${q}`, faq.includes(q));
  }
  ok('FAQ explains deterministic rules make final changes', /deterministic program rules make the final changes/i.test(faq));
  ok('FAQ says S&C app, not a physio', /S&C app, not a physio/.test(faq));
  ok('FAQ mentions resolver-style placement around game timing', /Game day controls the week/.test(faq));
}

// ═════════════════════════════════════════════════════════════════════
// 11. Weekly adjustment chip equipment copy is concise + routed
// ═════════════════════════════════════════════════════════════════════
section('[11] Program weekly adjustment equipment chip copy');
ok('Program chip label is Missing equipment', /label:\s*'Missing equipment'/.test(homeConstants));
ok('old Program chip label removed', !/No access to equipment/.test(homeConstants));
ok(
  'Missing equipment chip has requested Coach prefill',
  /prefill:\s*"I’m missing equipment for my program — "/.test(homeConstants),
);

// ─── Summary ───
console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
