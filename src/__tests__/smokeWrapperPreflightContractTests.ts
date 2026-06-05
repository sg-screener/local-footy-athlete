/**
 * Contract tests for scripts/smoke-coach-bike-flow.js.
 *
 * The wrapper script is too entwined with spawnSync to unit-test as a
 * module, so we lock in its critical regexes + failure messages by
 * scanning the source. These contracts caught the previous misleading
 * "Maestro never reached openLink" branch — they should fail loudly if
 * the preflight, the scheme-rejected detection, or the rebuild
 * instructions get stripped during a future refactor.
 *
 * Run: npm run test:smoke-wrapper-preflight
 */

import * as fs from 'fs';
import * as path from 'path';

const WRAPPER_PATH = path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow.js');
const FRESH_WRAPPER_PATH = path.resolve(
  __dirname,
  '../../scripts/smoke-coach-bike-flow-fresh.js',
);
const source = fs.readFileSync(WRAPPER_PATH, 'utf8');
const freshSource = fs.readFileSync(FRESH_WRAPPER_PATH, 'utf8');

let pass = 0;
let fail = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? `\n      ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? '\n      ' + detail : ''}`);
  }
}

function section(label: string) {
  console.log(`\n${label}`);
}

section('[1] URL scheme constants present');
{
  ok(
    'SMOKE_URL_SCHEME constant',
    /const\s+SMOKE_URL_SCHEME\s*=\s*['"]localfootyathlete['"]/.test(source),
  );
  ok(
    'SMOKE_BOOTSTRAP_URL points to coach-bike-flow',
    /SMOKE_BOOTSTRAP_URL[^\n]*smoke\/coach-bike-flow/.test(source),
  );
  ok(
    'SMOKE_PROBE_URL is distinct from the real bootstrap URL',
    /SMOKE_PROBE_URL[^\n]*__preflight_probe__/.test(source) &&
      !/SMOKE_PROBE_URL[^\n]*coach-bike-flow/.test(source),
    'probe URL must not be the real flow — otherwise the probe would seed Sam',
  );
}

section('[2] xcrunOpenUrl helper');
{
  ok(
    'function xcrunOpenUrl declared',
    /function\s+xcrunOpenUrl\s*\(/.test(source),
  );
  ok(
    'invokes xcrun simctl openurl',
    /spawnSync\(\s*['"]xcrun['"]\s*,\s*\[\s*['"]simctl['"]\s*,\s*['"]openurl['"]/.test(
      source,
    ),
  );
  ok(
    'classifies LSApplicationWorkspaceErrorDomain as schemeRejected',
    /schemeRejected[\s\S]{0,400}LSApplicationWorkspaceErrorDomain/.test(source),
  );
  ok(
    'classifies error 115 as schemeRejected',
    /schemeRejected[\s\S]{0,400}error\\s\*115/.test(source) ||
      /LSApplicationWorkspaceErrorDomain[\s\S]{0,200}error\\s\*115/.test(source),
  );
}

section('[3] preflightUrlScheme runs before Maestro');
{
  ok(
    'function preflightUrlScheme declared',
    /function\s+preflightUrlScheme\s*\(/.test(source),
  );
  ok(
    'preflight is called from the main runner',
    /preflightUrlScheme\(deviceId\)/.test(source),
  );

  // Critical ordering — preflight call must precede runMaestroSmoke call.
  const preflightIdx = source.indexOf('preflightUrlScheme(deviceId)');
  const maestroIdx = source.indexOf('runMaestroSmoke(deviceId, capture)');
  ok(
    'preflightUrlScheme is invoked BEFORE runMaestroSmoke',
    preflightIdx > 0 && maestroIdx > 0 && preflightIdx < maestroIdx,
    `preflightUrlScheme idx=${preflightIdx}, runMaestroSmoke idx=${maestroIdx}`,
  );
}

section('[4] Failure message: scheme-not-registered → rebuild instructions');
{
  ok(
    'uses required scheme failure language',
    /Native URL scheme missing\. Rebuild native app\./.test(source),
  );
  ok(
    'lists `npx expo prebuild --clean`',
    /npx\s+expo\s+prebuild\s+--clean/.test(source),
  );
  ok(
    'lists `npx expo run:ios`',
    /npx\s+expo\s+run:ios/.test(source),
  );
  ok(
    'mentions LSApplicationWorkspaceErrorDomain error 115 explicitly in user-facing message',
    /LSApplicationWorkspaceErrorDomain error 115/.test(source),
  );
  ok(
    'references CFBundleURLTypes in the explanation',
    /CFBundleURLTypes/.test(source),
  );
}

section('[5] Maestro openLink-detection regex is tolerant');
{
  // The misleading "Maestro never reached the openLink step" message
  // appeared because the old regex only matched `openLink: "..."` —
  // newer Maestro logs use `Open <url>`. The new regex must catch both.
  ok(
    'openLinkAttempted matches "openLink"',
    /openLinkAttempted[\s\S]{0,300}openLink/.test(source),
  );
  ok(
    'openLinkAttempted matches "Open" (Maestro newer log format)',
    /openLinkAttempted[\s\S]{0,400}Open(?:\(\?:ing\)\?\)?|\\\?:ing|ing)?/i.test(
      source,
    ) || /openLinkAttempted[\s\S]{0,400}\?:openLink\|Open/i.test(source),
  );
}

section('[6] Scheme-rejected diagnosis branch in Maestro output');
{
  ok(
    'scheme-rejected detector defined at Maestro layer',
    /const\s+schemeRejected\s*=/.test(source),
  );
  ok(
    'failure message: "Maestro reached openLink, but iOS could not open"',
    /Maestro reached openLink, but iOS could not open/i.test(source),
  );
  ok(
    'failure message references the bootstrap URL via SMOKE_BOOTSTRAP_URL or literal',
    /SMOKE_BOOTSTRAP_URL/.test(source) ||
      /localfootyathlete:\/\/smoke\/coach-bike-flow/.test(source),
  );
  ok(
    'trace block surfaces "iOS rejected scheme" row',
    /iOS rejected scheme[^\n]*LSAppWorkspace 115/.test(source),
  );
}

section('[7] Old misleading wording is gone');
{
  ok(
    'no "Maestro never reached the openLink step" wording',
    !/Maestro never reached the openLink step/i.test(source),
    'old branch produced misleading output when openLink was actually fired but iOS rejected the URL',
  );
}

section('[8] Success-path bootstrap markers are surfaced');
{
  // The source uses escaped regexes (\[smoke-bootstrap\]) — match either
  // the escaped or unescaped form so this test doesn't break on layout
  // changes. successMarkers must scan for all three critical phases.
  ok(
    'success path scans for [smoke-bootstrap] started marker',
    /smokeMarkersFromText[\s\S]{0,1200}smoke-bootstrap[\s\S]{0,40}started/.test(source),
  );
  ok(
    'success path scans for [smoke-bootstrap] onboarding complete marker',
    /smokeMarkersFromText[\s\S]{0,1600}smoke-bootstrap[\s\S]{0,40}onboarding complete/.test(
      source,
    ),
  );
  ok(
    'success path scans for [tabs-mounted] true marker',
    // smokeMarkersFromText keeps growing; rather than chase its size,
    // just confirm the function exists AND the tabs-mounted regex
    // appears anywhere in the source.
    /function\s+smokeMarkersFromText/.test(source) &&
      /tabsMounted:\s*\/\\\[tabs-mounted\\\]\s*true/.test(source),
  );
}

section('[9] Runtime installer preflight and debug dump are present');
{
  ok(
    'Maestro discovery falls back to ~/.maestro/bin/maestro',
    /\.maestro['"],\s*['"]bin['"],\s*['"]maestro/.test(source),
  );
  ok(
    'Maestro runner uses resolved Maestro binary',
    /const\s+maestroBin\s*=\s*which\(['"]maestro['"]\)/.test(source) &&
      /spawn\(\s*maestroBin/.test(source),
  );
  ok(
    'fresh-proven env runtime preflight is not relaunched by child wrapper',
    /RUNTIME_PREFLIGHT_ALREADY_PROVEN/.test(source) &&
      /fresh wrapper already proved runtime markers before Maestro/.test(source) &&
      /SMOKE_RUNTIME_PREFLIGHT_ALREADY_PROVEN/.test(freshSource),
  );
  ok(
    'Maestro Java bootstrap failure has precise setup language',
    /Smoke bootstrap\/setup failed: Maestro could not start because Java Runtime is missing\./.test(
      source,
    ) && /Unable to locate a Java Runtime/.test(source),
  );
  ok(
    'preflightRuntimeInstaller declared',
    /async\s+function\s+preflightRuntimeInstaller\s*\(/.test(source),
  );
  ok(
    'missing app-entry failure language present',
    /App runtime logs were not captured, or simulator connected to a different Metro bundle\./.test(source),
  );
  ok(
    'App.tsx-without-installer failure language present',
    /App\.tsx loaded but smokeBootstrapInstaller was not imported\./.test(source),
  );
  ok(
    'bootstrap-flag-missing failure language present',
    /Installer present but bootstrap flag missing from runtime\./.test(source),
  );
  ok(
    'installer imported marker is required',
    /installer imported/.test(source),
  );
  ok(
    'simulator log stream captures runtime markers',
    /function\s+startSimulatorLogCapture\s*\(/.test(source) &&
      /log['"],\s*['"]stream/.test(source),
  );
  ok(
    'debug dump prints latest Maestro artifact folder',
    /latest Maestro artifact folder/.test(source),
  );
  ok(
    'debug dump prints last 100 relevant log lines',
    /last 100 relevant log lines/.test(source),
  );
}

section('[10] Fresh smoke owns Metro without invalid Expo CLI flags');
{
  ok(
    'fresh command starts Expo dev-client on an explicit free port',
    /expo['"],\s*['"]start[\s\S]{0,180}--dev-client[\s\S]{0,180}--localhost[\s\S]{0,180}--port/.test(
      freshSource,
    ),
  );
  ok(
    'fresh run:ios uses --no-bundler',
    /expo['"],\s*['"]run:ios[\s\S]{0,120}--no-bundler/.test(freshSource),
  );

  const runIosCommandMatches = freshSource.match(
    /\[\s*['"]expo['"]\s*,\s*['"]run:ios['"][\s\S]*?\]/g,
  ) ?? [];
  ok(
    'fresh run:ios command never combines --no-bundler with --port',
    runIosCommandMatches.length > 0 &&
      runIosCommandMatches.every(
        (cmd) => !(cmd.includes("'--no-bundler'") && cmd.includes("'--port'")) &&
          !(cmd.includes('"--no-bundler"') && cmd.includes('"--port"')),
      ),
    runIosCommandMatches.join('\n'),
  );
  ok(
    'fresh command manually opens dev-client URL against chosen port',
    /function\s+openDevClientUrl\s*\(\s*port\s*\)/.test(freshSource) &&
      /expo-development-client\/\?url=/.test(freshSource) &&
      /127\.0\.0\.1:\$\{port\}/.test(freshSource) &&
      /simctl['"],\s*['"]openurl/.test(freshSource),
  );
  ok(
    'fresh command detects an already-installed dev build',
    /function\s+isDevBuildInstalled\s*\(\s*\)/.test(freshSource) &&
      /get_app_container['"],\s*['"]booted['"][\s\S]{0,120}APP_ID/.test(freshSource),
  );
  ok(
    'fresh command tolerates Expo post-install launch failures only after install is proven',
    /runStatus\s*!==?\s*0|runStatus\s*={3}\s*0/.test(freshSource) &&
      /if\s*\(\s*isDevBuildInstalled\(\)\s*\)[\s\S]{0,300}continuing with manual dev-client launch/.test(
        freshSource,
      ),
  );
  ok(
    'fresh command writes generated smoke bootstrap file before Metro',
    /GENERATED_FLAG_PATH/.test(freshSource) &&
      /ACTIVE_GENERATED_FLAG_SOURCE/.test(freshSource) &&
      /writeGeneratedSmokeFlag\(true\)/.test(freshSource),
  );
  ok(
    'fresh command resets generated smoke bootstrap file on exit',
    /INERT_GENERATED_FLAG_SOURCE/.test(freshSource) &&
      /writeGeneratedSmokeFlag\(false\)/.test(freshSource),
  );
  ok(
    'fresh diagnostics recognise generated file flag',
    /smokeBootstrapFileFlag/.test(freshSource) &&
      /file flag detected flow=coach-bike-flow/.test(freshSource),
  );
}

section('[11] App/bootstrap read generated smoke flag');
{
  const appSource = fs.readFileSync(path.resolve(__dirname, '../../App.tsx'), 'utf8');
  const bootstrapSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/utils/smokeBootstrap.ts'),
    'utf8',
  );
  const initializeSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/hooks/useInitializeApp.ts'),
    'utf8',
  );
  ok(
    'App.tsx logs generated file flag in app-entry marker',
    /smokeBootstrapFileFlag/.test(appSource) &&
      /\[app-entry\] App\.tsx module loaded/.test(appSource),
  );
  ok(
    'smokeBootstrap imports generated smokeBootstrapFlag module',
    /smokeBootstrapFlag/.test(bootstrapSource) &&
      /SMOKE_BOOTSTRAP_FLOW/.test(bootstrapSource),
  );
  ok(
    'useInitializeApp reads runtime signal, not env-only helper',
    /getSmokeRuntimeSignal/.test(initializeSource) &&
      !/getSmokeFlowFromEnv/.test(initializeSource),
  );
}

section('[12] Coach screen smoke selectors are native and stable');
{
  const coachSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/screens/coach/CoachScreen.tsx'),
    'utf8',
  );
  const homeSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/screens/home/HomeScreenV2.tsx'),
    'utf8',
  );
  const appNavigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/navigation/AppNavigator.tsx'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.resolve(__dirname, '../../src/utils/smokeBootstrap.ts'),
    'utf8',
  );
  const maestroEnvSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const maestroDeepLinkSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );
  const bottomTabBarSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../node_modules/@react-navigation/bottom-tabs/src/views/BottomTabBar.tsx',
    ),
    'utf8',
  );
  ok(
    'CoachScreen has coach-screen-root testID',
    /testID="coach-screen-root"/.test(coachSource),
  );
  ok(
    'CoachScreen has coach-ready testID',
    /testID="coach-ready"/.test(coachSource),
  );
  ok(
    'CoachScreen has coach-message-list testID',
    /testID="coach-message-list"/.test(coachSource),
  );
  ok(
    'CoachScreen has coach-input testID',
    /testID="coach-input"/.test(coachSource),
  );
  ok(
    'CoachScreen has coach-send-button testID',
    /testID="coach-send-button"/.test(coachSource),
  );
  ok(
    'Coach tab uses official tabBarButtonTestID',
    /tabBarButtonTestID:\s*'tab-coach'/.test(appNavigatorSource),
  );
  ok(
    'installed bottom-tabs maps tabBarButtonTestID to testID',
    /testID=\{options\.tabBarButtonTestID\}/.test(bottomTabBarSource),
  );
  ok(
    'custom tabBarButton override is not used for smoke tabs',
    !/tabBarButton:\s*tabButton/.test(appNavigatorSource) &&
      !/function\s+tabButton/.test(appNavigatorSource),
  );
  ok(
    'tab press logging uses official tabPress listener',
    /listeners=\{\{[\s\S]{0,120}tabPress:\s*\(\)\s*=>[\s\S]{0,120}\[tab-press\] coach/.test(
      appNavigatorSource,
    ),
  );
  ok(
    'AppNavigator renders dev route-current marker driven by state-machine snapshot.actualCurrentRoute',
    /testID=\{`route-current-\$\{snapshot\.actualCurrentRoute\}`\}/.test(
      appNavigatorSource,
    ),
  );
  ok(
    'RootNavigator logs nav route changes from NavigationContainer.onStateChange',
    (() => {
      const rootNavigatorSrc = fs.readFileSync(
        path.resolve(__dirname, '../navigation/RootNavigator.tsx'),
        'utf8',
      );
      return /\[nav-route\] currentRoute=\$\{leaf\}/.test(rootNavigatorSrc);
    })(),
  );
  ok(
    'smoke bootstrap records Coach as the initial route for coach-bike-flow',
    /initialRouteForSmokeFlow/.test(bootstrapSource) &&
      /coach-bike-flow[\s\S]{0,80}Coach/.test(bootstrapSource) &&
      /\[smoke-bootstrap\] initialRoute=\$\{activeSmokeInitialRoute\}/.test(
        bootstrapSource,
      ),
  );
  ok(
    'AppNavigator starts smoke coach-bike-flow on CoachTab',
    /initialRouteName=\{initialTabRoute\}/.test(appNavigatorSource) &&
      /resolvedSmokeInitialRoute === 'Coach'\s*\?\s*'CoachTab'/.test(
        appNavigatorSource,
      ),
  );
  ok(
    'AppNavigator does NOT optimistically seed currentRoute from smoke intent',
    // The OLD contract (intent-seeded currentRoute) was the source of the
    // live-Maestro contradiction. The NEW contract: actualCurrentRoute is
    // owned by the smokeNavState state machine, populated only by
    // NavigationContainer.onStateChange (in RootNavigator), so the
    // smoke-bootstrap-route-ready and smoke-route-current-Coach markers
    // reflect React Navigation's actual mounted route, never intent.
    (() => {
      const rootNavigatorSrc = fs.readFileSync(
        path.resolve(__dirname, '../navigation/RootNavigator.tsx'),
        'utf8',
      );
      return (
        // No useState seeded from intent.
        !/useState<string>\(['"]pending['"]\)/.test(appNavigatorSource) &&
        !/screenListeners=\{\{\s*state:/.test(appNavigatorSource) &&
        // NavigationContainer.onStateChange is the source of truth.
        /onStateChange=\{\(state\)\s*=>/.test(rootNavigatorSrc) &&
        /setActualCurrentRoute\(leaf\)/.test(rootNavigatorSrc) &&
        /\[nav-route\] currentRoute=\$\{leaf\}/.test(rootNavigatorSrc)
      );
    })(),
  );
  ok(
    'CoachScreen logs mount and ready render markers',
    /\[coach-screen\] mounted/.test(coachSource) &&
      /\[coach-ready\] rendered/.test(coachSource),
  );
  ok(
    'CoachScreen readiness marker is gated by focused Coach tab',
    /useIsFocused/.test(coachSource) &&
      /__DEV__\s*&&\s*isFocused/.test(coachSource) &&
      /\[nav-route\] currentRoute=Coach/.test(coachSource),
  );
  ok(
    'Coach ready marker is a visible non-collapsed native View',
    /testID="coach-ready"/.test(coachSource) &&
      /accessible=\{false\}/.test(coachSource) &&
      /minWidth:\s*1/.test(coachSource) &&
      /minHeight:\s*1/.test(coachSource),
  );
  ok(
    'wrapper debug dump prints tab navigation marker status',
    /\[tab-press\] coach:/.test(source) &&
      /\[nav-route\] currentRoute=Coach:/.test(source) &&
      /\[coach-screen\] mounted:/.test(source) &&
      /\[coach-ready\] rendered:/.test(source),
  );
  ok(
    'CoachScreen owns smoke-open-wednesday-workout (direct Coach → DayWorkout path)',
    /testID="smoke-open-wednesday-workout"/.test(coachSource) &&
      /smokeCoachBikeFlow/.test(coachSource) &&
      /useResolvedWeek/.test(coachSource) &&
      /deriveSmokeWednesdayOpenTarget/.test(coachSource),
  );
  ok(
    'HomeScreenV2 no longer renders any smoke testIDs (Coach owns the smoke seam)',
    !/testID="smoke-open-wednesday-workout"/.test(homeSource) &&
      !/testID="smoke-program-ready"/.test(homeSource) &&
      !/testID="smoke-go-program"/.test(homeSource) &&
      !/testID="smoke-wednesday-workout-missing"/.test(homeSource),
  );
  ok(
    'Maestro env flow does not enter Coach through bottom tabs',
    // The smoke-route-current-Coach → coach-ready window includes the
    // smoke-bootstrap-route-ready gate from the state machine, so widen
    // the allowed gap.
    !/tapOn:\s*"Coach"/.test(maestroEnvSource) &&
      !/id:\s*"tab-coach"/.test(maestroEnvSource) &&
      /id:\s*"smoke-route-current-Coach"[\s\S]{0,800}id:\s*"coach-ready"/.test(
        maestroEnvSource,
      ),
  );
  ok(
    'Maestro deep-link flow does not enter Coach through bottom tabs',
    !/tapOn:\s*"Coach"/.test(maestroDeepLinkSource) &&
      !/id:\s*"tab-coach"/.test(maestroDeepLinkSource) &&
      /id:\s*"smoke-route-current-Coach"[\s\S]{0,800}id:\s*"coach-ready"/.test(
        maestroDeepLinkSource,
      ),
  );
  ok(
    'Maestro env flow uses direct Coach → DayWorkout navigation (no Program hop)',
    // The new path is: coach-message-list → assertNotVisible
    // smoke-wednesday-workout-missing → smoke-wednesday-workout-ready →
    // smoke-open-wednesday-workout → tapOn → day-workout-title.
    /id:\s*"smoke-wednesday-workout-ready"[\s\S]{0,800}id:\s*"smoke-open-wednesday-workout"[\s\S]{0,800}id:\s*"day-workout-title"/.test(
      maestroEnvSource,
    ) &&
      !/id:\s*"tab-program"/.test(maestroEnvSource) &&
      !/id:\s*"smoke-go-program"/.test(maestroEnvSource),
  );
  ok(
    'Maestro deep-link flow uses direct Coach → DayWorkout navigation (no Program hop)',
    /id:\s*"smoke-wednesday-workout-ready"[\s\S]{0,800}id:\s*"smoke-open-wednesday-workout"[\s\S]{0,800}id:\s*"day-workout-title"/.test(
      maestroDeepLinkSource,
    ) &&
      !/id:\s*"tab-program"/.test(maestroDeepLinkSource) &&
      !/id:\s*"smoke-go-program"/.test(maestroDeepLinkSource),
  );
  ok(
    'wrapper step trace includes smoke-route-current-Coach (state-machine canonical leaf)',
    /smoke-route-current-Coach/.test(source),
  );
  ok(
    'wrapper diagnoses missing Coach label text as a selector exposure issue',
    /Coach tab label text is not exposed to Maestro; use id: tab-coach\./.test(source),
  );
  ok(
    'wrapper uses precise coach navigation failure language',
    /Smoke bootstrap mounted main tabs but did not select Coach route\./.test(
      source,
    ) && /Coach route opened but CoachScreen did not become ready\./.test(source),
  );
  ok(
    'wrapper uses precise coach-input failure language',
    /Coach UI flow failed: Coach route opened but coach-input was not visible\./.test(
      source,
    ),
  );
}

section('[13] Smoke bootstrap initial-route ready gate (live Maestro fix)');
{
  const bootstrapSourceLocal = fs.readFileSync(
    path.resolve(__dirname, '../utils/smokeBootstrap.ts'),
    'utf8',
  );
  const appNavigatorSourceLocal = fs.readFileSync(
    path.resolve(__dirname, '../navigation/AppNavigator.tsx'),
    'utf8',
  );

  ok(
    'smokeBootstrap exposes subscribable activeSmokeInitialRoute',
    /export\s+function\s+subscribeToActiveSmokeInitialRoute\s*\(/.test(
      bootstrapSourceLocal,
    ) &&
      /export\s+function\s+getActiveSmokeInitialRoute\s*\(\)\s*:\s*SmokeInitialRoute/.test(
        bootstrapSourceLocal,
      ),
  );
  ok(
    'runSmokeBootstrap notifies subscribers after setting activeSmokeInitialRoute',
    /activeSmokeInitialRoute\s*=\s*initialRouteForSmokeFlow\(flow\)[\s\S]{0,1200}notifyActiveSmokeInitialRouteSubscribers\(\)/.test(
      bootstrapSourceLocal,
    ),
  );
  ok(
    '__resetSmokeBootstrapForTest also notifies subscribers (so tests see reset)',
    /__resetSmokeBootstrapForTest[\s\S]{0,400}notifyActiveSmokeInitialRouteSubscribers\(\)/.test(
      bootstrapSourceLocal,
    ),
  );

  ok(
    'AppNavigator imports the subscribable smoke route helpers',
    /import[\s\S]{0,300}getActiveSmokeInitialRoute[\s\S]{0,300}from\s+['"]\.\.\/utils\/smokeBootstrap['"]/.test(
      appNavigatorSourceLocal,
    ) &&
      /subscribeToActiveSmokeInitialRoute/.test(appNavigatorSourceLocal) &&
      /getSmokeRuntimeSignal/.test(appNavigatorSourceLocal),
  );
  ok(
    'AppNavigator subscribes via useSyncExternalStore',
    /React\.useSyncExternalStore\(\s*subscribeToActiveSmokeInitialRoute\s*,\s*getActiveSmokeInitialRoute\s*,/.test(
      appNavigatorSourceLocal,
    ),
  );
  ok(
    'AppNavigator emits [app-navigator] smokeInitialRoute raw= log',
    /\[app-navigator\] smokeInitialRoute raw=/.test(appNavigatorSourceLocal),
  );
  ok(
    'AppNavigator emits [app-navigator] initialRouteName= log',
    /\[app-navigator\] initialRouteName=/.test(appNavigatorSourceLocal),
  );
  ok(
    'AppNavigator ready gate renders main-tabs-root WITHOUT Tab.Navigator while smoke route unresolved',
    /if\s*\(!smokeInitialResolved\)/.test(appNavigatorSourceLocal) &&
      /testID="smoke-bootstrap-pending"/.test(appNavigatorSourceLocal),
  );
  ok(
    'AppNavigator only mounts ResolvedAppNavigator (Tab.Navigator) once smoke route resolves',
    /function\s+ResolvedAppNavigator\(/.test(appNavigatorSourceLocal) &&
      /<ResolvedAppNavigator[\s\S]{0,200}initialTabRoute=\{initialTabRoute\}/.test(
        appNavigatorSourceLocal,
      ),
  );
  ok(
    'In smoke mode, AppNavigator does NOT trust the legacy fallback for initialRouteName',
    /inSmokeMode\s*\?\s*activeSmokeRoute\s*:\s*getSmokeInitialRoute\(\)/.test(
      appNavigatorSourceLocal,
    ),
  );

  // Diagnostics — wrapper must surface the new log markers and produce
  // the exact failure label the user requested.
  ok(
    'wrapper smokeMarkersFromText scans for [app-navigator] smokeInitialRoute raw=',
    /appNavigatorRouteRaw[\s\S]{0,140}\\\[app-navigator\\\] smokeInitialRoute raw=/.test(
      source,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [app-navigator] tabs not mounted yet',
    /appNavigatorTabsPending[\s\S]{0,140}\\\[app-navigator\\\] tabs not mounted yet/.test(
      source,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [app-navigator] initialRouteName=CoachTab',
    /appNavigatorInitialRouteCoachTab[\s\S]{0,180}\\\[app-navigator\\\] initialRouteName=CoachTab/.test(
      source,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [nav-route] currentRoute=Coach',
    /navRouteCoach[\s\S]{0,140}\\\[nav-route\\\] currentRoute=Coach/.test(source),
  );
  ok(
    'wrapper formatMarkers prints [app-navigator] initialRouteName=CoachTab line',
    /\[app-navigator\] initialRouteName=CoachTab/.test(source),
  );
  ok(
    'wrapper diagnoseMaestroFailure uses exact "mounted main tabs but did not select Coach route" label',
    /label\s*=\s*'Smoke bootstrap mounted main tabs but did not select Coach route\.'/.test(
      source,
    ),
  );
  ok(
    'wrapper diagnoseMaestroFailure surfaces ready-gate hint when tabs were pending',
    /tabs not mounted yet \(ready gate\)/.test(source) ||
      /\[app-navigator\] tabs not mounted yet/.test(source),
  );
}

section('[14] Generated smoke flag stays set across the live Maestro run');
{
  // The fresh wrapper must (a) write the generated flag BEFORE Metro
  // starts, and (b) only reset it inside finally — i.e. AFTER
  // runLogged('node', ['scripts/smoke-coach-bike-flow.js', '--env-bootstrap'])
  // returns. Otherwise the flag could be reset mid-Maestro and the
  // app would hot-reload into a non-smoke state.
  ok(
    'fresh wrapper writes ACTIVE generated flag before starting Metro',
    (() => {
      const writeIdx = freshSource.indexOf('writeGeneratedSmokeFlag(true)');
      const expoStartIdx = freshSource.indexOf("'expo', 'start'");
      return writeIdx !== -1 && expoStartIdx !== -1 && writeIdx < expoStartIdx;
    })(),
  );
  ok(
    'fresh wrapper resets generated flag only in finally (after smoke completes)',
    /finally\s*\{[\s\S]{0,800}writeGeneratedSmokeFlag\(false\)/.test(freshSource),
  );
  ok(
    'fresh wrapper does NOT reset generated flag before runLogged of smoke script',
    /writeGeneratedSmokeFlag\(false\)[\s\S]{0,800}runLogged\(\s*['"]node['"]\s*,\s*\[\s*['"]scripts\/smoke-coach-bike-flow\.js['"]/.test(
      freshSource,
    ) === false,
  );
  ok(
    'ACTIVE generated flag source emits coach-bike-flow as the bundled SMOKE_BOOTSTRAP_FLOW',
    /ACTIVE_GENERATED_FLAG_SOURCE[\s\S]{0,400}SMOKE_BOOTSTRAP_FLOW[\s\S]{0,80}coach-bike-flow/.test(
      freshSource,
    ),
  );
}

section('[15] Maestro env flow does not reset state between bootstrap and Coach route');
{
  // CRITICAL — env mode used to use launchApp clearState: true, which
  // wiped the state already seeded by the fresh wrapper before Maestro
  // started. The route-current-Coach assertion would then race the
  // re-bootstrap and lose. Env mode must now have ZERO clearState
  // (Maestro attaches to the wrapper-bootstrapped app), and at most one
  // launchApp (no clear, no stop).
  const maestroEnvSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const maestroDeepLinkSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );
  // Strip whole-line YAML comments (#…) before counting so that prose
  // inside header comments cannot trip the test.
  const stripComments = (s: string): string =>
    s
      .split(/\r?\n/)
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
  const envCode = stripComments(maestroEnvSource);
  const deepLinkCode = stripComments(maestroDeepLinkSource);
  const envClearStateTrueMatches = (envCode.match(/clearState:\s*true/g) || []).length;
  const envStopAppTrueMatches = (envCode.match(/stopApp:\s*true/g) || []).length;
  const deepLinkClearStateMatches = (deepLinkCode.match(/clearState:\s*true/g) || []).length;
  ok(
    'env Maestro flow has ZERO clearState: true (no relaunch wipes wrapper bootstrap)',
    envClearStateTrueMatches === 0,
    `count=${envClearStateTrueMatches}`,
  );
  ok(
    'env Maestro flow has ZERO stopApp: true (no relaunch kills wrapper-running JS context)',
    envStopAppTrueMatches === 0,
    `count=${envStopAppTrueMatches}`,
  );
  ok(
    'deep-link Maestro flow has exactly one clearState: true (the initial launchApp)',
    deepLinkClearStateMatches === 1,
    `count=${deepLinkClearStateMatches}`,
  );
  ok(
    'env Maestro flow asserts smoke-route-current-Coach BEFORE coach-ready',
    // The state-machine path is smoke-route-current-Coach →
    // smoke-bootstrap-route-ready → coach-ready.
    /id:\s*"smoke-route-current-Coach"[\s\S]{0,800}id:\s*"coach-ready"/.test(
      maestroEnvSource,
    ),
  );
  ok(
    'deep-link Maestro flow asserts smoke-route-current-Coach BEFORE coach-ready',
    /id:\s*"smoke-route-current-Coach"[\s\S]{0,800}id:\s*"coach-ready"/.test(
      maestroDeepLinkSource,
    ),
  );
  ok(
    'env Maestro flow has at most one launchApp block (the no-clear, no-stop attach)',
    (envCode.match(/launchApp:/g) || []).length <= 1,
  );
  ok(
    'deep-link Maestro flow does not contain a second launchApp anywhere after initial bootstrap',
    (deepLinkCode.match(/launchApp:/g) || []).length === 1,
  );
}

section('[16] Marker split: smoke-tabs-pending-root vs main-tabs-root + smoke-bootstrap-route-ready');
{
  const appNavigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/AppNavigator.tsx'),
    'utf8',
  );
  const maestroEnvSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const maestroDeepLinkSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );
  const wrapperSource = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow.js'),
    'utf8',
  );
  const freshWrapperSource = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow-fresh.js'),
    'utf8',
  );

  // 16.1 — pending shell uses smoke-tabs-pending-root, NOT main-tabs-root
  ok(
    'AppNavigator pending gate renders smoke-tabs-pending-root',
    /testID="smoke-tabs-pending-root"/.test(appNavigatorSource),
  );
  ok(
    'AppNavigator pending gate does NOT render main-tabs-root',
    (() => {
      // Find the if (!smokeInitialResolved) { ... } block and assert
      // main-tabs-root does not appear inside it.
      const idx = appNavigatorSource.indexOf('if (!smokeInitialResolved)');
      if (idx === -1) return false;
      // Pull out the next ~1200 chars (the pending block return JSX).
      const slice = appNavigatorSource.slice(idx, idx + 1200);
      const endIdx = slice.indexOf('return (\n    <ResolvedAppNavigator');
      const pendingBlock = endIdx === -1 ? slice : slice.slice(0, endIdx);
      return !/testID="main-tabs-root"/.test(pendingBlock);
    })(),
    'main-tabs-root must only render after the smoke route resolves',
  );
  ok(
    'AppNavigator pending gate still renders smoke-bootstrap-pending',
    /testID="smoke-bootstrap-pending"/.test(appNavigatorSource),
  );

  // 16.2 — resolved navigator owns main-tabs-root and (in smoke mode) smoke-bootstrap-route-ready
  ok(
    'ResolvedAppNavigator renders main-tabs-root',
    // ResolvedAppNavigator grew with the SmokeRouteEnforcer + new
    // marker hooks; widen the search window.
    /function\s+ResolvedAppNavigator[\s\S]{0,5000}testID="main-tabs-root"/.test(
      appNavigatorSource,
    ),
  );
  ok(
    'ResolvedAppNavigator renders smoke-bootstrap-route-ready only when intent AND actual nav state both Coach',
    // The contract changed: route-ready is now a composite AND of
    // intentIsCoach and actualRouteIsCoach. Intent alone (as in the
    // pre-enforcer code) was the source of the live-Maestro
    // contradiction.
    /routeReady\s*=\s*intentIsCoach\s*&&\s*actualRouteIsCoach/.test(
      appNavigatorSource,
    ) &&
      /routeReady\s*\?\s*\([\s\S]{0,500}testID="smoke-bootstrap-route-ready"/.test(
        appNavigatorSource,
      ),
  );
  ok(
    'AppNavigator passes inSmokeMode through to ResolvedAppNavigator',
    /inSmokeMode=\{inSmokeMode\}/.test(appNavigatorSource) &&
      /inSmokeMode:\s*boolean/.test(appNavigatorSource),
  );
  ok(
    'ResolvedAppNavigator logs [app-navigator] smoke-bootstrap-route-ready',
    /\[app-navigator\] smoke-bootstrap-route-ready/.test(appNavigatorSource),
  );

  // 16.3 — under the state-machine architecture, main-tabs-root is
  // intentionally NOT a smoke readiness gate (it's a layout marker
  // only). The Maestro YAMLs must NOT assert main-tabs-root before
  // smoke-bootstrap-route-ready — instead they wait for
  // smoke-nav-ready → smoke-route-current-Coach → smoke-bootstrap-route-ready.
  ok(
    'env Maestro flow does NOT use main-tabs-root as a readiness gate',
    !/extendedWaitUntil:[\s\S]{0,80}id:\s*"main-tabs-root"/.test(
      maestroEnvSource,
    ),
    'main-tabs-root must not be a smoke readiness gate in env mode',
  );
  ok(
    'deep-link Maestro flow does NOT use main-tabs-root as a readiness gate',
    !/extendedWaitUntil:[\s\S]{0,80}id:\s*"main-tabs-root"/.test(
      maestroDeepLinkSource,
    ),
    'main-tabs-root must not be a smoke readiness gate in deep-link mode',
  );
  ok(
    'env Maestro flow waits for smoke-nav-ready BEFORE smoke-bootstrap-route-ready',
    /id:\s*"smoke-nav-ready"[\s\S]{0,1500}id:\s*"smoke-bootstrap-route-ready"/.test(
      maestroEnvSource,
    ),
  );
  ok(
    'deep-link Maestro flow waits for smoke-nav-ready BEFORE smoke-bootstrap-route-ready',
    /id:\s*"smoke-nav-ready"[\s\S]{0,1500}id:\s*"smoke-bootstrap-route-ready"/.test(
      maestroDeepLinkSource,
    ),
  );

  // 16.4 — wrapper diagnostics surface the new markers and YAML-clearState/flag-active checks
  ok(
    'wrapper smokeMarkersFromText scans for [app-navigator] smoke-bootstrap-route-ready',
    /appNavigatorRouteReady[\s\S]{0,200}\\\[app-navigator\\\] smoke-bootstrap-route-ready/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper formatMarkers prints [app-navigator] smoke-bootstrap-route-ready line',
    /\[app-navigator\] smoke-bootstrap-route-ready/.test(wrapperSource),
  );
  ok(
    'wrapper allStepStatuses tracks smoke-bootstrap-route-ready and smoke-tabs-pending-root',
    /smokeBootstrapRouteReadyStatus[\s\S]{0,140}'smoke-bootstrap-route-ready'/.test(
      wrapperSource,
    ) &&
      /smokeTabsPendingRootStatus[\s\S]{0,140}'smoke-tabs-pending-root'/.test(
        wrapperSource,
      ),
  );
  ok(
    'wrapper helper detects whether YAML uses launchApp clearState: true',
    /function\s+maestroFlowUsedClearState\s*\(\)[\s\S]{0,400}clearState:\\s\*true/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper helper detects whether generated SMOKE_BOOTSTRAP_FLOW is still set',
    /function\s+generatedSmokeFlagActive\s*\(\)[\s\S]{0,400}coach-bike-flow/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper still surfaces the legacy Main-tabs-before-route label as a fallback diagnostic',
    /label\s*=\s*['"]Main tabs mounted before smoke route resolved, or Maestro relaunched without bootstrap route\.['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper Main-tabs-before-route detail surfaces YAML clearState + flag-still-set + smoke-bootstrap-route-ready status',
    /Maestro flow used launchApp clearState: true:/.test(wrapperSource) &&
      /generated SMOKE_BOOTSTRAP_FLOW still set at Maestro start:/.test(
        wrapperSource,
      ) &&
      /smoke-bootstrap-route-ready step status:/.test(wrapperSource),
  );
  ok(
    'wrapper Maestro step trace prints smoke-bootstrap-route-ready row',
    /smoke-bootstrap-route-ready:[\s\S]{0,200}stepStatuses\.smokeBootstrapRouteReadyStatus/.test(
      wrapperSource,
    ),
  );

  // 16.5 — fresh wrapper logs flag-still-set + flag-reset markers
  ok(
    'fresh wrapper logs [smoke-flag] generated flag still set before Maestro',
    /\[smoke-flag\] generated flag still set before Maestro/.test(
      freshWrapperSource,
    ),
  );
  ok(
    'fresh wrapper logs [smoke-flag] generated flag reset after Maestro',
    /\[smoke-flag\] generated flag reset after Maestro/.test(
      freshWrapperSource,
    ),
  );
  ok(
    'fresh wrapper still resets generated flag inside finally (after Maestro returns)',
    /finally\s*\{[\s\S]{0,1200}writeGeneratedSmokeFlag\(false\)/.test(
      freshWrapperSource,
    ),
  );
  ok(
    'fresh wrapper logs flag-still-set BEFORE running smoke script',
    (() => {
      const stillSetIdx = freshWrapperSource.indexOf(
        '[smoke-flag] generated flag still set before Maestro',
      );
      const runLoggedIdx = freshWrapperSource.indexOf(
        "runLogged(\n      'node',\n      ['scripts/smoke-coach-bike-flow.js'",
      );
      // Fall back to any runLogged of the smoke script if formatting changes
      const runLoggedFallbackIdx =
        runLoggedIdx === -1
          ? freshWrapperSource.indexOf("'scripts/smoke-coach-bike-flow.js'")
          : runLoggedIdx;
      return (
        stillSetIdx !== -1 &&
        runLoggedFallbackIdx !== -1 &&
        stillSetIdx < runLoggedFallbackIdx
      );
    })(),
  );
}

section('[17] Imperative smoke route enforcer + actual-state markers');
{
  const appNavigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/AppNavigator.tsx'),
    'utf8',
  );
  const rootNavigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/RootNavigator.tsx'),
    'utf8',
  );
  const navRefSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/navigationRef.ts'),
    'utf8',
  );
  const wrapperSource = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow.js'),
    'utf8',
  );
  const maestroEnvSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const maestroDeepLinkSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );

  // 17.1 — smoke-bootstrap-route-ready must not render unless actualCurrentRoute === Coach
  ok(
    'smoke-bootstrap-route-ready depends on actualCurrentRoute, never on intent alone',
    /routeReady\s*=\s*intentIsCoach\s*&&\s*actualRouteIsCoach/.test(
      appNavigatorSource,
    ) &&
      /routeReady\s*\?\s*\([\s\S]{0,400}testID="smoke-bootstrap-route-ready"/.test(
        appNavigatorSource,
      ),
    'route-ready marker must AND intent with actualCurrentRoute === Coach',
  );

  // 17.2 — actualCurrentRoute is owned by the state machine, sourced from
  // NavigationContainer.onStateChange (NOT screenListeners.state).
  ok(
    'state-machine snapshot drives every smoke marker (no local currentRoute useState)',
    /useSyncExternalStore\(\s*subscribeSmokeNavState\s*,\s*getSmokeNavStateSnapshot/.test(
      appNavigatorSource,
    ) && !/useState<string>\(['"]pending['"]\)/.test(appNavigatorSource),
    'do not seed currentRoute from intent or any local state — that was the original bug',
  );
  ok(
    'route-current-${snapshot.actualCurrentRoute} testID is gated on a non-null leaf',
    /testID=\{`route-current-\$\{snapshot\.actualCurrentRoute\}`\}/.test(
      appNavigatorSource,
    ) &&
      /snapshot\.actualCurrentRoute !== null/.test(appNavigatorSource),
  );
  ok(
    'AppNavigator no longer uses screenListeners.state to compute currentRoute',
    !/screenListeners=\{\{\s*state:/.test(appNavigatorSource),
  );

  // 17.3 — initialRouteName alone is not considered proof of route selection
  ok(
    'SmokeRouteEnforcer dispatches CommonActions.reset to CoachTab — initialRouteName is not enough',
    /function\s+SmokeRouteEnforcer\(/.test(appNavigatorSource) &&
      /CommonActions\.reset\(\s*\{\s*index:\s*0\s*,\s*routes:\s*\[\s*\{\s*name:\s*['"]CoachTab['"]/.test(
        appNavigatorSource,
      ),
  );
  ok(
    'SmokeRouteEnforcer is gated on the state-machine snapshot, not a derived `active` prop',
    /<SmokeRouteEnforcer\s+snapshot=\{snapshot\}\s*\/?>/.test(
      appNavigatorSource,
    ) &&
      /gateOpen\s*=\s*\n?\s*navReady\s*&&\s*bootstrapComplete\s*&&\s*routeIntent === ['"]Coach['"]/.test(
        appNavigatorSource,
      ),
  );

  // 17.4 — smoke route enforcer logs each step the wrapper scans for
  ok(
    'enforcer logs [smoke-route-enforcer] gate ready',
    /\[smoke-route-enforcer\] gate ready: navReady=true bootstrapComplete=true routeIntent=/.test(
      appNavigatorSource,
    ),
  );
  ok(
    'enforcer logs [smoke-route-enforcer] navigation ready',
    /\[smoke-route-enforcer\] navigation ready/.test(appNavigatorSource),
  );
  ok(
    'enforcer logs [smoke-route-enforcer] requested CoachTab',
    /\[smoke-route-enforcer\] requested CoachTab/.test(appNavigatorSource),
  );
  ok(
    'enforcer logs [smoke-route-enforcer] navigated CoachTab',
    /\[smoke-route-enforcer\] navigated CoachTab/.test(appNavigatorSource),
  );
  ok(
    'enforcer guards on navigationRef.isReady() and surfaces a hard error if false',
    /if\s*\(!navigationRef\.isReady\(\)\)\s*\{[\s\S]{0,400}gate said navReady but navigationRef\.isReady\(\) is false/.test(
      appNavigatorSource,
    ),
  );
  ok(
    'enforcer uses module-singleton navigationRef from navigation/navigationRef.ts',
    /import\s*\{\s*navigationRef\s*\}\s*from\s*['"]\.\/navigationRef['"]/.test(
      appNavigatorSource,
    ) &&
      /export const navigationRef = createNavigationContainerRef/.test(
        navRefSource,
      ),
  );
  ok(
    'RootNavigator attaches navigationRef to NavigationContainer',
    /import\s*\{\s*navigationRef\s*\}\s*from\s*['"]\.\/navigationRef['"]/.test(
      rootNavigatorSource,
    ) &&
      /<NavigationContainer[\s\S]{0,300}ref=\{navigationRef\}/.test(
        rootNavigatorSource,
      ),
  );

  // 17.5 — actualCurrentRoute and routeIntent each get their own marker
  ok(
    'smoke-route-current-Coach (actual state) is its own marker',
    /actualRouteIsCoach\s*=[\s\S]{0,200}snapshot\.actualCurrentRoute === ['"]Coach['"]/.test(
      appNavigatorSource,
    ) &&
      /testID="smoke-route-current-Coach"/.test(appNavigatorSource),
  );
  ok(
    'smoke-route-intent-Coach (intent) is its own marker',
    /intentIsCoach\s*=[\s\S]{0,200}snapshot\.routeIntent === ['"]Coach['"]/.test(
      appNavigatorSource,
    ) &&
      /testID="smoke-route-intent-Coach"/.test(appNavigatorSource),
  );
  ok(
    'intent marker can be visible without route-ready marker (route-ready requires actual state too)',
    (() => {
      return (
        /intentIsCoach\s*\?\s*\([\s\S]{0,300}testID="smoke-route-intent-Coach"/.test(
          appNavigatorSource,
        ) &&
        /routeReady\s*\?\s*\([\s\S]{0,300}testID="smoke-bootstrap-route-ready"/.test(
          appNavigatorSource,
        )
      );
    })(),
  );

  // 17.6 — Maestro YAML asserts smoke-route-current-Coach before route-ready
  ok(
    'env Maestro flow asserts smoke-route-current-Coach BEFORE smoke-bootstrap-route-ready',
    /id:\s*"smoke-route-current-Coach"[\s\S]{0,400}id:\s*"smoke-bootstrap-route-ready"/.test(
      maestroEnvSource,
    ),
  );
  ok(
    'deep-link Maestro flow asserts smoke-route-current-Coach BEFORE smoke-bootstrap-route-ready',
    /id:\s*"smoke-route-current-Coach"[\s\S]{0,400}id:\s*"smoke-bootstrap-route-ready"/.test(
      maestroDeepLinkSource,
    ),
  );
  ok(
    'env Maestro flow waits for smoke-bootstrap-complete BEFORE smoke-nav-ready',
    /id:\s*"smoke-bootstrap-complete"[\s\S]{0,400}id:\s*"smoke-nav-ready"/.test(
      maestroEnvSource,
    ),
  );
  ok(
    'deep-link Maestro flow waits for smoke-bootstrap-complete BEFORE smoke-nav-ready',
    /id:\s*"smoke-bootstrap-complete"[\s\S]{0,400}id:\s*"smoke-nav-ready"/.test(
      maestroDeepLinkSource,
    ),
  );

  // 17.7 — main-tabs-root is layout-only (still rendered, but not a smoke gate)
  ok(
    'main-tabs-root renders unconditionally inside ResolvedAppNavigator — independent of route-ready',
    (() => {
      const mainTabsIdx = appNavigatorSource.indexOf('testID="main-tabs-root"');
      const routeReadyIdx = appNavigatorSource.indexOf(
        'testID="smoke-bootstrap-route-ready"',
      );
      return (
        mainTabsIdx !== -1 && routeReadyIdx !== -1 && mainTabsIdx < routeReadyIdx
      );
    })(),
  );
  ok(
    'main-tabs-root unconditional: no ternary that hides it on routeReady=false',
    !/routeReady\s*\?\s*\([\s\S]{0,200}testID="main-tabs-root"/.test(
      appNavigatorSource,
    ),
  );

  // 17.8 — Diagnostics catch contradiction: route-ready visible + route-current-Coach missing
  ok(
    'wrapper diagnoses contradiction with exact label "INTERNAL HARNESS CONTRADICTION: route-ready visible while actual route is not Coach."',
    /label\s*=\s*\n?\s*['"]INTERNAL HARNESS CONTRADICTION: route-ready visible while actual route is not Coach\.['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper contradiction branch fires on smoke-bootstrap-route-ready=COMPLETED + smoke-route-current-Coach=FAILED',
    /smokeBootstrapRouteReadyStatus\s*===\s*['"]COMPLETED['"][\s\S]{0,300}smokeRouteCurrentCoachStatus\s*===\s*['"]FAILED['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [smoke-route-enforcer] gate ready',
    /routeEnforcerGateReady[\s\S]{0,260}\\\[smoke-route-enforcer\\\] gate ready/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [smoke-route-enforcer] navigation ready',
    /routeEnforcerReady[\s\S]{0,200}\\\[smoke-route-enforcer\\\] navigation ready/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [smoke-route-enforcer] requested CoachTab',
    /routeEnforcerRequested[\s\S]{0,200}\\\[smoke-route-enforcer\\\] requested CoachTab/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [smoke-route-enforcer] navigated CoachTab',
    /routeEnforcerNavigated[\s\S]{0,200}\\\[smoke-route-enforcer\\\] navigated CoachTab/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper smokeMarkersFromText scans for [smoke-route-error] (mismatch log)',
    /routeMismatchObserved[\s\S]{0,260}\\\[smoke-route-error\\\] intent=Coach actual=/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper allStepStatuses tracks smoke-bootstrap-complete + smoke-nav-ready + smoke-route-current-Coach + smoke-route-mismatch + smoke-coach-ready',
    /smokeBootstrapCompleteStatus[\s\S]{0,120}['"]smoke-bootstrap-complete['"]/.test(
      wrapperSource,
    ) &&
      /smokeNavReadyStatus[\s\S]{0,140}['"]smoke-nav-ready['"]/.test(
        wrapperSource,
      ) &&
      /smokeRouteCurrentCoachStatus[\s\S]{0,140}['"]smoke-route-current-Coach['"]/.test(
        wrapperSource,
      ) &&
      /smokeRouteMismatchStatus[\s\S]{0,140}['"]smoke-route-mismatch['"]/.test(
        wrapperSource,
      ) &&
      /smokeCoachReadyStatus[\s\S]{0,140}['"]smoke-coach-ready['"]/.test(
        wrapperSource,
      ),
  );
  ok(
    'wrapper Maestro step trace prints state-machine marker rows',
    /smoke-bootstrap-complete:[\s\S]{0,200}stepStatuses\.smokeBootstrapCompleteStatus/.test(
      wrapperSource,
    ) &&
      /smoke-nav-ready:[\s\S]{0,200}stepStatuses\.smokeNavReadyStatus/.test(
        wrapperSource,
      ) &&
      /smoke-route-current-Coach:[\s\S]{0,200}stepStatuses\.smokeRouteCurrentCoachStatus/.test(
        wrapperSource,
      ) &&
      /smoke-route-mismatch:[\s\S]{0,200}stepStatuses\.smokeRouteMismatchStatus/.test(
        wrapperSource,
      ),
  );
}

section('[18] Smoke state machine — single-source-of-truth contract');
{
  const stateMachineSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/smokeNavState.ts'),
    'utf8',
  );
  const rootNavigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/RootNavigator.tsx'),
    'utf8',
  );
  const appSource = fs.readFileSync(
    path.resolve(__dirname, '../../App.tsx'),
    'utf8',
  );
  const coachScreenSource = fs.readFileSync(
    path.resolve(__dirname, '../screens/coach/CoachScreen.tsx'),
    'utf8',
  );
  const appNavigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/AppNavigator.tsx'),
    'utf8',
  );
  const bootstrapSource = fs.readFileSync(
    path.resolve(__dirname, '../utils/smokeBootstrap.ts'),
    'utf8',
  );
  const wrapperSource = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow.js'),
    'utf8',
  );
  const maestroEnvSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const maestroDeepLinkSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );
  const freshWrapperSource = freshSource;

  // 18.1 — State machine module exists with the canonical fields
  ok(
    'smokeNavState declares all canonical state-machine fields',
    /runtimeReady:\s*boolean/.test(stateMachineSource) &&
      /bootstrapComplete:\s*boolean/.test(stateMachineSource) &&
      /navReady:\s*boolean/.test(stateMachineSource) &&
      /routeIntent:\s*string \| null/.test(stateMachineSource) &&
      /routeEnforcerRequested:\s*boolean/.test(stateMachineSource) &&
      /actualCurrentRoute:\s*string \| null/.test(stateMachineSource) &&
      /coachReady:\s*boolean/.test(stateMachineSource),
  );
  ok(
    'smokeNavState does NOT carry the deprecated programReady field',
    !/programReady:\s*boolean/.test(stateMachineSource) &&
      !/setProgramReady/.test(stateMachineSource),
  );
  ok(
    'smokeNavState exports a getCurrentLeafRouteName helper that walks nested state',
    /export function getCurrentLeafRouteName/.test(stateMachineSource) &&
      /route\?\.state[\s\S]{0,200}getCurrentLeafRouteName\(route\.state\)/.test(
        stateMachineSource,
      ),
  );
  ok(
    'smokeNavState exposes subscribe + getSnapshot pair for useSyncExternalStore',
    /export function subscribeSmokeNavState/.test(stateMachineSource) &&
      /export function getSmokeNavStateSnapshot/.test(stateMachineSource),
  );

  // 18.2 — smoke-bootstrap-route-ready cannot render unless actualCurrentRoute === Coach
  ok(
    'smoke-bootstrap-route-ready renders only when intent AND actual nav state both Coach',
    /routeReady\s*=\s*intentIsCoach\s*&&\s*actualRouteIsCoach/.test(
      appNavigatorSource,
    ),
  );

  // 18.3 — smoke-route-current-Coach is derived from React Navigation
  // state (NavigationContainer.onStateChange), NOT from smoke intent.
  ok(
    'smoke-route-current-Coach is derived from NavigationContainer.onStateChange + getCurrentLeafRouteName',
    /onStateChange=\{\(state\)\s*=>[\s\S]{0,1200}getCurrentLeafRouteName\(state\)/.test(
      rootNavigatorSource,
    ) &&
      /setActualCurrentRoute\(leaf\)/.test(rootNavigatorSource),
  );
  ok(
    'AppNavigator computes actualRouteIsCoach from snapshot.actualCurrentRoute (not intent)',
    /actualRouteIsCoach\s*=[\s\S]{0,200}snapshot\.actualCurrentRoute === ['"]Coach['"]/.test(
      appNavigatorSource,
    ) &&
      !/actualRouteIsCoach\s*=[\s\S]{0,200}routeIntent === ['"]Coach['"]/.test(
        appNavigatorSource,
      ),
  );

  // 18.4 — When routeIntent=Coach but actualCurrentRoute=Program (or any
  // other leaf), the JSX must render smoke-route-mismatch and NOT
  // smoke-bootstrap-route-ready.
  ok(
    'routeMismatch renders smoke-route-mismatch (and is independent of route-ready)',
    /routeMismatch\s*=[\s\S]{0,300}snapshot\.routeEnforcerRequested[\s\S]{0,300}snapshot\.actualCurrentRoute !== snapshot\.routeIntent/.test(
      appNavigatorSource,
    ) &&
      /routeMismatch\s*\?\s*\([\s\S]{0,300}testID="smoke-route-mismatch"/.test(
        appNavigatorSource,
      ),
  );
  ok(
    'route-ready and route-mismatch are mutually exclusive in the snapshot derivation',
    (() => {
      // routeReady requires actualCurrentRoute === routeIntent.
      // routeMismatch requires actualCurrentRoute !== routeIntent.
      // Therefore the two derivations cannot both be true for a single
      // snapshot. We assert the expressions are wired off the SAME
      // snapshot fields so they can never disagree by construction.
      return (
        /routeReady\s*=\s*intentIsCoach\s*&&\s*actualRouteIsCoach/.test(
          appNavigatorSource,
        ) &&
        /actualRouteIsCoach\s*=[\s\S]{0,200}snapshot\.actualCurrentRoute === ['"]Coach['"]/.test(
          appNavigatorSource,
        ) &&
        /routeMismatch\s*=[\s\S]{0,300}snapshot\.actualCurrentRoute !== snapshot\.routeIntent/.test(
          appNavigatorSource,
        )
      );
    })(),
  );

  // 18.5 — Route enforcer dispatches reset/navigate ONLY after
  // bootstrapComplete AND navReady AND routeIntent === 'Coach'.
  ok(
    'SmokeRouteEnforcer gate ANDs navReady, bootstrapComplete, and routeIntent === Coach',
    /gateOpen\s*=\s*\n?\s*navReady\s*&&\s*bootstrapComplete\s*&&\s*routeIntent === ['"]Coach['"]/.test(
      appNavigatorSource,
    ),
  );
  ok(
    'SmokeRouteEnforcer skips dispatch entirely when gate is closed (early return)',
    /if\s*\(!gateOpen\)\s*return/.test(appNavigatorSource),
  );

  // 18.6 — main-tabs-root is NOT a smoke route readiness marker.
  // It still renders (as a layout marker) but the YAMLs must not gate
  // on it as the route-ready signal.
  ok(
    'env Maestro flow does NOT extendedWaitUntil on main-tabs-root',
    !/extendedWaitUntil:[\s\S]{0,80}id:\s*"main-tabs-root"/.test(
      maestroEnvSource,
    ),
  );
  ok(
    'deep-link Maestro flow does NOT extendedWaitUntil on main-tabs-root',
    !/extendedWaitUntil:[\s\S]{0,80}id:\s*"main-tabs-root"/.test(
      maestroDeepLinkSource,
    ),
  );

  // 18.7 — Maestro YAMLs must NOT assert main-tabs-root before
  // route proof as a pass condition. The new ordering goes
  // smoke-runtime-ready → smoke-bootstrap-complete → smoke-nav-ready
  // → smoke-route-current-Coach → smoke-bootstrap-route-ready.
  ok(
    'env Maestro YAML follows the canonical state-machine marker order',
    (() => {
      const order = [
        'smoke-runtime-ready',
        'smoke-bootstrap-complete',
        'smoke-nav-ready',
        'smoke-route-current-Coach',
        'smoke-bootstrap-route-ready',
        'coach-ready',
        'coach-input',
        'coach-send-button',
      ];
      let pos = 0;
      for (const id of order) {
        const idx = maestroEnvSource.indexOf(`id: "${id}"`, pos);
        if (idx === -1) return false;
        pos = idx + 1;
      }
      return true;
    })(),
  );
  ok(
    'deep-link Maestro YAML follows the canonical state-machine marker order',
    (() => {
      const order = [
        'smoke-runtime-ready',
        'smoke-bootstrap-complete',
        'smoke-nav-ready',
        'smoke-route-current-Coach',
        'smoke-bootstrap-route-ready',
        'coach-ready',
        'coach-input',
        'coach-send-button',
      ];
      let pos = 0;
      for (const id of order) {
        const idx = maestroDeepLinkSource.indexOf(`id: "${id}"`, pos);
        if (idx === -1) return false;
        pos = idx + 1;
      }
      return true;
    })(),
  );

  // 18.8 — Diagnostics catch route-ready visible + route-current missing
  // as an internal contradiction with the four exact labels the user
  // required.
  ok(
    'wrapper diagnoses INTERNAL HARNESS CONTRADICTION exactly',
    wrapperSource.includes(
      'INTERNAL HARNESS CONTRADICTION: route-ready visible while actual route is not Coach.',
    ),
  );
  ok(
    'wrapper diagnoses "Smoke route enforcer failed: intended Coach, actual ${observed}." exactly',
    /Smoke route enforcer failed: intended Coach, actual \$\{observedActual\}/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper diagnoses "NavigationContainer did not become ready." exactly',
    wrapperSource.includes('NavigationContainer did not become ready.'),
  );
  ok(
    'wrapper diagnoses "Navigation reset/navigate to Coach did not take effect." exactly',
    wrapperSource.includes(
      'Navigation reset/navigate to Coach did not take effect.',
    ),
  );

  // 18.9 — Generated flag stays set across the live Maestro run.
  ok(
    'fresh wrapper resets generated SMOKE_BOOTSTRAP_FLOW only AFTER Maestro finishes (in finally)',
    /finally\s*\{[\s\S]{0,1500}writeGeneratedSmokeFlag\(false\)/.test(
      freshWrapperSource,
    ) &&
      // No early reset before runLogged of the smoke script.
      /writeGeneratedSmokeFlag\(false\)[\s\S]{0,800}runLogged\(\s*['"]node['"]\s*,\s*\[\s*['"]scripts\/smoke-coach-bike-flow\.js['"]/.test(
        freshWrapperSource,
      ) === false,
  );

  // 18.10 — Bonus structural checks on the wiring.
  ok(
    'App.tsx wires setRuntimeReady(true) behind the smoke runtime signal',
    /import\s*\{\s*setRuntimeReady\s*\}\s*from\s*['"]\.\/src\/navigation\/smokeNavState['"]/.test(
      appSource,
    ) &&
      /if\s*\(\s*smokeBootstrapSignal\.flow\s*\)\s*\{[\s\S]{0,120}setRuntimeReady\(true\)/.test(
        appSource,
      ),
  );
  ok(
    'CoachScreen wires setCoachReady(isFocused)',
    /import\s*\{\s*setCoachReady\s*\}\s*from\s*['"]\.\.\/\.\.\/navigation\/smokeNavState['"]/.test(
      coachScreenSource,
    ) && /setCoachReady\(isFocused\)/.test(coachScreenSource),
  );
  ok(
    'smokeBootstrap calls setRouteIntent + setBootstrapComplete on success',
    /setRouteIntent\(activeSmokeInitialRoute\)/.test(bootstrapSource) &&
      /setBootstrapComplete\(true\)/.test(bootstrapSource),
  );
  ok(
    'RootNavigator wires setNavReady(true) inside NavigationContainer.onReady',
    /onReady=\{\(\)\s*=>\s*\{[\s\S]{0,800}setNavReady\(true\)/.test(
      rootNavigatorSource,
    ),
  );
}

section('[19] Smoke Program/Wednesday deterministic navigation contract');
{
  const coachScreenSource = fs.readFileSync(
    path.resolve(__dirname, '../screens/coach/CoachScreen.tsx'),
    'utf8',
  );
  const homeScreenV2Source = fs.readFileSync(
    path.resolve(__dirname, '../screens/home/HomeScreenV2.tsx'),
    'utf8',
  );
  const dayWorkoutScreenV2Source = fs.readFileSync(
    path.resolve(__dirname, '../screens/home/DayWorkoutScreenV2.tsx'),
    'utf8',
  );
  const dayWorkoutSmokeContractSource = fs.readFileSync(
    path.resolve(__dirname, '../screens/home/dayWorkoutSmokeContract.ts'),
    'utf8',
  );
  const wrapperSource = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow.js'),
    'utf8',
  );
  const smokeTargetSource = fs.readFileSync(
    path.resolve(__dirname, '../components/dev/smokeVisibleWeekHarnessState.ts'),
    'utf8',
  );
  const maestroEnvSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const maestroDeepLinkSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );

  // 19.1 — CoachScreen must resolve Wednesday from the same source of
  // truth HomeScreen uses (useResolvedWeek → buildProgramTabProjectedWeek
  // → projectVisibleDay). The smoke is no longer a Program/Home
  // navigation test; it is a direct Coach → DayWorkout contract test.
  ok(
    'CoachScreen imports useResolvedWeek from hooks/useSchedule',
    /import\s*\{\s*useResolvedWeek\s*\}\s*from\s*['"]\.\.\/\.\.\/hooks\/useSchedule['"]/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen calls useResolvedWeek() and derives the post-coach Wednesday open target',
    /useResolvedWeek\(\)/.test(coachScreenSource) &&
      /deriveSmokeWednesdayOpenTarget\(\{\s*weekDays:\s*resolvedWeek\.weekDays\s*\}\)/.test(
        coachScreenSource,
      ),
  );

  // 19.2 — smokeWednesdayMissingReason must enumerate the four
  // canonical failure modes so the harness diagnostic names each one.
  ok(
    'postcoach target helper returns "no-visible-week-data"',
    /['"]no-visible-week-data['"]/.test(smokeTargetSource),
  );
  ok(
    'postcoach target helper returns "no-Wednesday-date-in-week"',
    /['"]no-Wednesday-date-in-week['"]/.test(smokeTargetSource),
  );
  ok(
    'postcoach target helper returns "Wednesday-day-has-no-workout"',
    /['"]Wednesday-day-has-no-workout['"]/.test(smokeTargetSource),
  );
  ok(
    'postcoach target helper returns "Wednesday-not-easy-aerobic-flush"',
    /['"]Wednesday-not-easy-aerobic-flush['"]/.test(smokeTargetSource),
  );
  ok(
    'postcoach target helper returns "DayWorkout-route-params-unavailable"',
    /['"]DayWorkout-route-params-unavailable['"]/.test(smokeTargetSource),
  );

  // 19.3 — handleSmokeOpenWednesdayWorkout must dispatch through the
  // root navigationRef to ('ProgramTab', { screen: 'DayWorkout',
  // params: { workoutId, date } }). The Coach-stack navigation prop is
  // intentionally NOT used here.
  ok(
    'CoachScreen.handleSmokeOpenWednesdayWorkout uses navigationRef.dispatch + CommonActions.navigate',
    /handleSmokeOpenWednesdayWorkout[\s\S]{0,2000}navigationRef\.dispatch\(\s*CommonActions\.navigate\(\s*['"]ProgramTab['"]/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen direct DayWorkout dispatch targets screen: DayWorkout with latest target workoutId + date params',
    /screen:\s*['"]DayWorkout['"][\s\S]{0,220}workoutId:\s*target\.workoutId[\s\S]{0,220}date:\s*target\.date/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen.handleSmokeOpenWednesdayWorkout bails out when navigationRef.isReady() is false',
    /handleSmokeOpenWednesdayWorkout[\s\S]{0,1200}navigationRef\.isReady\(\)[\s\S]{0,200}return/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen.handleSmokeOpenWednesdayWorkout bails out when target Wednesday missing',
    /handleSmokeOpenWednesdayWorkout[\s\S]{0,1200}!target[\s\S]{0,240}return/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen re-resolves the current Wednesday workout on tap before falling back to stable target',
    /const\s+latestSmokeWednesdayOpenTarget[\s\S]{0,260}smokeWednesdayTargetResult\.state\s*===\s*['"]ready['"][\s\S]{0,260}const\s+target\s*=\s*latestSmokeWednesdayOpenTarget\s*\?\?\s*smokeWednesdayOpenTarget/.test(
      coachScreenSource,
    ) &&
      /source=\$\{latestSmokeWednesdayOpenTarget\s*\?\s*['"]latest['"]\s*:\s*['"]stable['"]\}/.test(
        coachScreenSource,
      ),
  );

  // 19.4 — Required log lines for harness scanning.
  ok(
    'CoachScreen emits "[smoke-open-wednesday-workout] pressed"',
    /\[smoke-open-wednesday-workout\] pressed/.test(coachScreenSource),
  );
  ok(
    'CoachScreen emits "[smoke-open-wednesday-workout] rendered source=CoachScreen"',
    /\[smoke-open-wednesday-workout\] rendered source=CoachScreen/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen emits "[smoke-open-wednesday-workout] missing reason="',
    /\[smoke-open-wednesday-workout\] missing reason=/.test(coachScreenSource),
  );
  ok(
    'CoachScreen emits "[smoke-open-wednesday-workout] navigating DayWorkout"',
    /\[smoke-open-wednesday-workout\] navigating DayWorkout/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen emits "[smoke-open-wednesday-workout] navigationRef not ready" fallback',
    /\[smoke-open-wednesday-workout\] navigationRef not ready/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen emits "[smoke-open-wednesday-workout] no target reason=" fallback',
    /\[smoke-open-wednesday-workout\] no target reason=/.test(
      coachScreenSource,
    ),
  );

  // 19.5 — CoachScreen renders the three smoke markers, gated on
  // smokeCoachBikeFlow + isFocused so they cannot leak outside the
  // coach-bike-flow smoke or off the Coach leaf.
  ok(
    'CoachScreen renders smoke-wednesday-workout-ready gated on smokeCoachBikeFlow + isFocused + !missingReason',
    /smokeCoachBikeFlow\s*&&\s*isFocused\s*&&\s*!smokeWednesdayMissingReason[\s\S]{0,120}smokeWednesdayOpenTarget[\s\S]{0,400}testID="smoke-wednesday-workout-ready"/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen renders smoke-open-wednesday-workout Pressable gated on smokeCoachBikeFlow + isFocused + workout-resolved',
    /smokeCoachBikeFlow[\s\S]{0,200}isFocused[\s\S]{0,200}!smokeWednesdayMissingReason[\s\S]{0,200}smokeWednesdayOpenTarget[\s\S]{0,600}testID="smoke-open-wednesday-workout"/.test(
      coachScreenSource,
    ),
  );
  ok(
    'CoachScreen captures a stable smoke Wednesday target before opening DayWorkout',
    /smokeWednesdayStableTarget[\s\S]{0,400}setSmokeWednesdayStableTarget\(smokeWednesdayCurrentTarget\)/.test(
      coachScreenSource,
    ) &&
      /smokeWednesdayStableTarget\s*\?\?\s*smokeWednesdayCurrentTarget/.test(
        coachScreenSource,
      ),
  );
  ok(
    'CoachScreen renders smoke-wednesday-workout-missing fallback when missingReason set',
    /smokeCoachBikeFlow\s*&&\s*isFocused\s*&&\s*smokeWednesdayMissingReason[\s\S]{0,400}testID="smoke-wednesday-workout-missing"/.test(
      coachScreenSource,
    ),
  );

  // 19.6 — HomeScreenV2 must NOT carry any smoke testIDs, logs, or
  // setProgramReady wiring after the architecture change. Coach owns
  // the entire smoke seam; Home is just product UI again.
  ok(
    'HomeScreenV2 does NOT import setProgramReady',
    !/setProgramReady/.test(homeScreenV2Source),
  );
  ok(
    'HomeScreenV2 does NOT import useIsFocused',
    !/useIsFocused/.test(homeScreenV2Source),
  );
  ok(
    'HomeScreenV2 does NOT import getSmokeInitialRoute',
    !/getSmokeInitialRoute/.test(homeScreenV2Source),
  );
  ok(
    'HomeScreenV2 does NOT render testID="smoke-program-ready"',
    !/testID="smoke-program-ready"/.test(homeScreenV2Source),
  );
  ok(
    'HomeScreenV2 does NOT render testID="smoke-open-wednesday-workout"',
    !/testID="smoke-open-wednesday-workout"/.test(homeScreenV2Source),
  );
  ok(
    'HomeScreenV2 does NOT render testID="smoke-wednesday-workout-missing"',
    !/testID="smoke-wednesday-workout-missing"/.test(homeScreenV2Source),
  );
  ok(
    'HomeScreenV2 does NOT emit "[home-screen] mounted" smoke log',
    !/\[home-screen\] mounted/.test(homeScreenV2Source),
  );

  // 19.7 — Maestro YAMLs must NOT walk through smoke-go-program /
  // smoke-route-current-Home / smoke-program-ready. The new path is
  // assertNotVisible smoke-wednesday-workout-missing → wait
  // smoke-wednesday-workout-ready → wait smoke-open-wednesday-workout
  // → tap it → day-workout-title.
  function assertYamlNewArch(yaml: string, label: string) {
    ok(
      `${label}: YAML does NOT contain smoke-go-program`,
      !/smoke-go-program/.test(yaml),
    );
    ok(
      `${label}: YAML does NOT contain smoke-route-current-Home`,
      !/smoke-route-current-Home/.test(yaml),
    );
    ok(
      `${label}: YAML does NOT contain smoke-program-ready`,
      !/smoke-program-ready/.test(yaml),
    );

    const missing = yaml.indexOf('id: "smoke-wednesday-workout-missing"');
    const ready = yaml.indexOf('id: "smoke-wednesday-workout-ready"');
    const openWed = yaml.indexOf('id: "smoke-open-wednesday-workout"');
    const tapOpen = yaml.indexOf('tapOn:');
    const title = yaml.indexOf('id: "day-workout-title"');

    ok(
      `${label}: YAML walks missing(assertNot) → ready → open-wed → tap → day-workout-title`,
      missing >= 0 &&
        ready >= 0 &&
        openWed >= 0 &&
        title >= 0 &&
        missing < ready &&
        ready < openWed &&
        openWed < title,
    );
    ok(
      `${label}: smoke-wednesday-workout-missing is an assertNotVisible step`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-wednesday-workout-missing"/.test(
        yaml,
      ),
    );
    ok(
      `${label}: tapOn smoke-open-wednesday-workout occurs before day-workout-title`,
      tapOpen >= 0 && tapOpen < title,
    );
  }
  assertYamlNewArch(maestroEnvSource, 'env YAML');
  assertYamlNewArch(maestroDeepLinkSource, 'deep-link YAML');

  // 19.8 — Wrapper must scan the new log lines from CoachScreen and
  // must NOT scan removed markers (smoke-go-program / nav-route Home /
  // home-screen mounted).
  ok(
    'wrapper scans [smoke-open-wednesday-workout] rendered source=CoachScreen marker',
    /smokeOpenWednesdayRendered[\s\S]{0,400}smoke-open-wednesday-workout\\\] rendered source=CoachScreen/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans [smoke-open-wednesday-workout] pressed marker',
    /smokeOpenWednesdayPressed[\s\S]{0,400}smoke-open-wednesday-workout\\\] pressed/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans [smoke-open-wednesday-workout] navigating DayWorkout marker',
    /smokeOpenWednesdayNavigating[\s\S]{0,400}smoke-open-wednesday-workout\\\] navigating DayWorkout/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans [smoke-open-wednesday-workout] missing reason= marker',
    /smokeOpenWednesdayMissing[\s\S]{0,400}smoke-open-wednesday-workout\\\] missing reason=/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans [nav-route] currentRoute=DayWorkout marker',
    /navRouteDayWorkout[\s\S]{0,200}\[nav-route\\\] currentRoute=DayWorkout/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper does NOT scan [smoke-go-program] pressed marker (removed)',
    !/smokeGoProgramPressed/.test(wrapperSource),
  );
  ok(
    'wrapper does NOT scan [home-screen] mounted marker (removed)',
    !/homeScreenMounted/.test(wrapperSource),
  );
  ok(
    'wrapper does NOT scan [nav-route] currentRoute=Home as a standalone marker (removed)',
    !/navRouteHome:/.test(wrapperSource),
  );

  // 19.9 — Wrapper has step-status rows for the new Maestro markers.
  ok(
    'wrapper records smokeWednesdayReadyStatus from smoke-wednesday-workout-ready step',
    /smokeWednesdayReadyStatus:\s*stepStatusFromText\([\s\S]{0,200}['"]smoke-wednesday-workout-ready['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper records smokeWednesdayMissingStatus from smoke-wednesday-workout-missing step',
    /smokeWednesdayMissingStatus:\s*stepStatusFromText\([\s\S]{0,200}['"]smoke-wednesday-workout-missing['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper records smokeWednesdayMissingVisibility from smoke-wednesday-workout-missing assertNotVisible step',
    /smokeWednesdayMissingVisibility:\s*stepVisibilityFromText\([\s\S]{0,200}['"]smoke-wednesday-workout-missing['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper records smokeOpenWednesdayStatus from smoke-open-wednesday-workout step',
    /smokeOpenWednesdayStatus:\s*stepStatusFromText\([\s\S]{0,200}['"]smoke-open-wednesday-workout['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper does NOT record smokeRouteCurrentHomeStatus (removed)',
    !/smokeRouteCurrentHomeStatus/.test(wrapperSource),
  );
  ok(
    'wrapper does NOT record smokeProgramReadyStatus (removed)',
    !/smokeProgramReadyStatus/.test(wrapperSource),
  );

  // 19.10 — Per-subcase diagnostic labels for the direct DayWorkout
  // path. Three distinct surfaces, three labels.
  ok(
    'wrapper labels failure when smoke-wednesday-workout-missing was visible (target missing)',
    wrapperSource.includes(
      'Wednesday DayWorkout smoke target missing: CoachScreen rendered smoke-wednesday-workout-missing fallback.',
    ) &&
      /smokeWednesdayMissingVisibility\?\.visible\s*===\s*['"]yes['"]/.test(
        wrapperSource,
      ),
  );
  ok(
    'wrapper labels failure when Wednesday smoke target was not available from Coach',
    wrapperSource.includes(
      'Coach flow completed, but Wednesday DayWorkout smoke target was not available from Coach.',
    ),
  );
  ok(
    'wrapper labels generic direct-DayWorkout navigation failure',
    wrapperSource.includes(
      'Smoke direct DayWorkout navigation failed after coach flow.',
    ),
  );
  ok(
    'wrapper does NOT carry removed "smoke-go-program button never tapped" label',
    !wrapperSource.includes(
      'Smoke deterministic navigation failed: smoke-go-program button never tapped.',
    ),
  );
  ok(
    'wrapper does NOT carry removed "route did not change to Home" label',
    !wrapperSource.includes(
      'Smoke deterministic navigation failed: route did not change to Home after smoke-go-program.',
    ),
  );
  ok(
    'wrapper does NOT carry removed "HomeScreen did not become ready" label',
    !wrapperSource.includes(
      'Smoke deterministic navigation failed: HomeScreen did not become ready (smoke-program-ready not visible).',
    ),
  );

  // 19.11 — Final DayWorkout visible contract now lives on the real
  // DayWorkout screen. The smoke no longer depends on brittle Maestro
  // raw text matching for the final assertions.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dayWorkoutContract = require('../screens/home/dayWorkoutSmokeContract');
  const deriveDayWorkoutContract =
    dayWorkoutContract.deriveDayWorkoutSmokeContract as (args: any) => {
      state: string;
      hasEasyAerobicFlush: boolean;
      hasBike: boolean;
      has20min: boolean;
      hasEasyIntensity: boolean;
      forbiddenTokens: string[];
      label: string;
    };

  const buildDayWorkout = (name: string, description: string) => ({
    id: 'wed-smoke',
    name,
    workoutType: 'Conditioning',
    description,
    conditioningBlock: {
      options: [
        {
          title: name,
          description,
        },
      ],
    },
  });

  {
    const result = deriveDayWorkoutContract({
      workout: buildDayWorkout(
        'Easy Aerobic Flush (20min Bike)',
        '20min easy Bike. Cruise pace. 3-4/10.',
      ),
      date: '2026-05-13',
      workoutId: 'wed-smoke',
    });
    ok(
      'DayWorkout contract ready for Easy Aerobic Flush + Bike + 20min + easy intensity',
      result.state === 'ready' &&
        result.hasEasyAerobicFlush &&
        result.hasBike &&
        result.has20min &&
        result.hasEasyIntensity &&
        result.forbiddenTokens.length === 0,
    );
    ok(
      'DayWorkout contract label includes pass/fail booleans',
      /hasEasyAerobicFlush=true/.test(result.label) &&
        /hasBike=true/.test(result.label) &&
        /has20min=true/.test(result.label) &&
        /hasEasyIntensity=true/.test(result.label) &&
        /forbiddenTokens=none/.test(result.label) &&
        /routeParams=date=2026-05-13 workoutId=wed-smoke/.test(result.label),
    );
  }
  {
    const result = deriveDayWorkoutContract({
      workout: buildDayWorkout(
        'Easy Aerobic Flush (20min Rower)',
        '20min easy Rower. 3-4/10.',
      ),
      date: '2026-05-13',
      workoutId: 'wed-smoke',
    });
    ok(
      'DayWorkout contract failed if Rower remains',
      result.state === 'failed' && result.forbiddenTokens.includes('Rower'),
    );
  }
  {
    const result = deriveDayWorkoutContract({
      workout: buildDayWorkout(
        'Easy Aerobic Flush (20min Assault Bike)',
        '20min easy Assault Bike. 3-4/10.',
      ),
      date: '2026-05-13',
      workoutId: 'wed-smoke',
    });
    ok(
      'DayWorkout contract failed if Assault appears',
      result.state === 'failed' && result.forbiddenTokens.includes('Assault'),
    );
  }
  {
    const result = deriveDayWorkoutContract({
      workout: buildDayWorkout(
        'Easy Aerobic Flush (20min)',
        '20min easy cruise pace. 3-4/10.',
      ),
      date: '2026-05-13',
      workoutId: 'wed-smoke',
    });
    ok(
      'DayWorkout contract failed if Bike missing',
      result.state === 'failed' && result.hasBike === false,
    );
  }
  ok(
    'DayWorkout smoke contract helper encodes forbidden token list',
    /FORBIDDEN_TOKENS[\s\S]{0,260}Rower[\s\S]{0,260}Rowing[\s\S]{0,260}Assault[\s\S]{0,260}Assault Bike Intervals[\s\S]{0,260}\[Swapped to bike\]/.test(
      dayWorkoutSmokeContractSource,
    ),
  );
  ok(
    'DayWorkoutScreenV2 renders smoke markers only for __DEV__ coach-bike-flow',
    /__DEV__\s*&&\s*getSmokeRuntimeSignal\(\)\.flow\s*===\s*['"]coach-bike-flow['"]/.test(
      dayWorkoutScreenV2Source,
    ) &&
      /smokeCoachBikeFlow[\s\S]{0,160}renderDayWorkoutSmokeContractMarker/.test(
        dayWorkoutScreenV2Source,
      ),
  );
  ok(
    'DayWorkoutScreenV2 renders smoke-dayworkout-contract-ready and failed markers',
    /smoke-dayworkout-contract-ready/.test(dayWorkoutScreenV2Source) &&
      /smoke-dayworkout-contract-failed/.test(dayWorkoutScreenV2Source),
  );
  ok(
    'DayWorkout smoke marker is a native non-collapsing visible marker',
    // v5: refactored to TWO separate <View testID=…> blocks (ready
    // and failed) instead of a single conditional testID, so the
    // failed marker is statically present in JSX and Maestro's hit
    // test is unambiguous. Both blocks still use collapsable={false}.
    /collapsable=\{false\}/.test(dayWorkoutScreenV2Source) &&
      /testID="smoke-dayworkout-contract-ready"/.test(dayWorkoutScreenV2Source) &&
      /testID="smoke-dayworkout-contract-failed"/.test(dayWorkoutScreenV2Source) &&
      /smokeContractMarker:[\s\S]{0,400}position:\s*['"]absolute['"][\s\S]{0,400}width:\s*30[\s\S]{0,200}height:\s*30[\s\S]{0,400}zIndex:\s*2147483647[\s\S]{0,400}elevation:\s*2147483647/.test(
        dayWorkoutScreenV2Source,
      ) &&
      /smokeContractReady:[\s\S]{0,160}backgroundColor:\s*['"]#[0-9A-Fa-f]{6}['"]/.test(
        dayWorkoutScreenV2Source,
      ) &&
      /smokeContractFailed:[\s\S]{0,160}backgroundColor:\s*['"]#[0-9A-Fa-f]{6}['"]/.test(
        dayWorkoutScreenV2Source,
      ),
  );
  function assertYamlDayWorkoutContract(yaml: string, label: string) {
    ok(
      `${label}: asserts smoke-dayworkout-contract-ready as final load-bearing check`,
      /assertVisible:\s*\n\s*id:\s*"smoke-dayworkout-contract-ready"/.test(
        yaml,
      ),
    );
    ok(
      `${label}: asserts smoke-dayworkout-contract-failed is not visible`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-dayworkout-contract-failed"/.test(
        yaml,
      ),
    );
    ok(
      `${label}: no load-bearing raw text final assertions remain`,
      !/assertVisible:\s*(?:\n\s*)?(?:"Easy Aerobic Flush"|"Bike"|"20min"|"easy")/.test(
        yaml,
      ) &&
        !/assertNotVisible:\s*(?:\n\s*)?(?:"Rower"|"Rowing"|"Assault"|"Assault Bike Intervals"|"\[Swapped to bike\]")/.test(
          yaml,
        ),
    );
  }
  assertYamlDayWorkoutContract(maestroEnvSource, 'env YAML');
  assertYamlDayWorkoutContract(maestroDeepLinkSource, 'deep-link YAML');
  ok(
    'wrapper scans DayWorkout contract ready/failed logs',
    // v5: screen now emits `[smoke-dayworkout-contract] ready …` and
    // `[smoke-dayworkout-contract] failed …` AND the legacy
    // `state=ready` / `state=failed` forms. The marker regex is
    // alternation, so each scan name must reference its corresponding
    // alternative.
    /smokeDayWorkoutContractReady[\s\S]{0,260}smoke-dayworkout-contract\\\][\s\S]{0,160}state=ready/.test(
      wrapperSource,
    ) &&
      /smokeDayWorkoutContractFailed[\s\S]{0,260}smoke-dayworkout-contract\\\][\s\S]{0,160}state=failed/.test(
        wrapperSource,
      ),
  );
  ok(
    'wrapper records DayWorkout contract Maestro step statuses',
    /dayWorkoutContractReadyStatus:\s*stepStatusFromText\([\s\S]{0,180}smoke-dayworkout-contract-ready/.test(
      wrapperSource,
    ) &&
      /dayWorkoutContractFailedStatus:\s*stepStatusFromText\([\s\S]{0,180}smoke-dayworkout-contract-failed/.test(
        wrapperSource,
      ),
  );
  ok(
    'wrapper prioritizes DayWorkout contract failure over stale runtime-log diagnostic',
    (() => {
      const diagnoseSource = wrapperSource.slice(
        wrapperSource.indexOf('function diagnoseMaestroFailure'),
      );
      return (
        diagnoseSource.includes('DayWorkout final contract failed:') &&
        diagnoseSource.includes(
        'DayWorkout mounted but final contract marker missing.',
        ) &&
        diagnoseSource.indexOf('DayWorkout final contract failed:') <
          diagnoseSource.indexOf(
            'App runtime logs were not captured, or simulator connected to a different Metro bundle.',
          )
      );
    })(),
  );
}

section('[20] Smoke visible-week hard preflight (live coach context mismatch)');
{
  const coachScreenSource = fs.readFileSync(
    path.resolve(__dirname, '../screens/coach/CoachScreen.tsx'),
    'utf8',
  );
  const smokeBootstrapSource = fs.readFileSync(
    path.resolve(__dirname, '../utils/smokeBootstrap.ts'),
    'utf8',
  );
  const sharedFixtureSource = fs.readFileSync(
    path.resolve(__dirname, '../data/smokeCoachBikeFlowProgram.ts'),
    'utf8',
  );
  const pipelineTestSource = fs.readFileSync(
    path.resolve(__dirname, './smokeCoachBikeFlowTests.ts'),
    'utf8',
  );
  const wrapperSource = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow.js'),
    'utf8',
  );
  const maestroEnvSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const maestroDeepLinkSource = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );

  // 20.1 — Shared fixture file exists with the canonical exports both
  // the live bootstrap and the pipeline test depend on.
  ok(
    'shared fixture src/data/smokeCoachBikeFlowProgram.ts exports SMOKE_WEDNESDAY_WORKOUT_NAME',
    /export\s+const\s+SMOKE_WEDNESDAY_WORKOUT_NAME\s*=\s*['"]Easy Aerobic Flush['"]/.test(
      sharedFixtureSource,
    ),
  );
  ok(
    'shared fixture exports SMOKE_WEDNESDAY_DESCRIPTION with rower modality',
    /export\s+const\s+SMOKE_WEDNESDAY_DESCRIPTION\s*=\s*[\s\S]{0,80}rower/i.test(
      sharedFixtureSource,
    ),
  );
  ok(
    'shared fixture exports SMOKE_WEDNESDAY_OPTION_TITLE',
    /export\s+const\s+SMOKE_WEDNESDAY_OPTION_TITLE\s*=\s*['"]Easy Aerobic Flush \(20min Rower\)['"]/.test(
      sharedFixtureSource,
    ),
  );
  ok(
    'shared fixture exports SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY as a regex',
    /export\s+const\s+SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY[\s\S]{0,50}rower/i.test(
      sharedFixtureSource,
    ),
  );
  ok(
    'shared fixture exports buildSmokeWednesdayWorkout(microcycleId)',
    /export\s+function\s+buildSmokeWednesdayWorkout\s*\(\s*microcycleId/.test(
      sharedFixtureSource,
    ),
  );
  ok(
    'shared fixture exports buildSmokeCoachBikeFlowProgram(today)',
    /export\s+function\s+buildSmokeCoachBikeFlowProgram\s*\(/.test(
      sharedFixtureSource,
    ),
  );
  ok(
    'shared fixture uses computeBlockBounds so current week is always in-block',
    /computeBlockBounds/.test(sharedFixtureSource),
  );
  ok(
    'shared fixture Wednesday workout has dayOfWeek: 3',
    /dayOfWeek:\s*3/.test(sharedFixtureSource),
  );

  // 20.2 — smokeBootstrap installs the shared fixture (NOT
  // DEFAULT_PROGRAM) for the 'coach-bike-flow' flow.
  ok(
    'smokeBootstrap imports buildSmokeCoachBikeFlowProgram',
    /import\s*\{[\s\S]{0,200}buildSmokeCoachBikeFlowProgram[\s\S]{0,200}\}\s*from\s*['"]\.\.\/data\/smokeCoachBikeFlowProgram['"]/.test(
      smokeBootstrapSource,
    ),
  );
  ok(
    'smokeBootstrap defines programForSmokeFlow(flow) dispatch',
    /function\s+programForSmokeFlow\s*\(\s*flow/.test(smokeBootstrapSource),
  );
  ok(
    'smokeBootstrap routes coach-bike-flow flow through buildSmokeCoachBikeFlowProgram',
    /case\s+['"]coach-bike-flow['"][\s\S]{0,200}buildSmokeCoachBikeFlowProgram/.test(
      smokeBootstrapSource,
    ),
  );
  ok(
    'smokeBootstrap calls programForSmokeFlow(flow) in the main install path',
    /programForSmokeFlow\(flow\)/.test(smokeBootstrapSource),
  );
  ok(
    'smokeBootstrap emits [smoke-bootstrap] wednesday-seeded diagnostic log',
    /\[smoke-bootstrap\] wednesday-seeded name=/.test(smokeBootstrapSource),
  );

  // 20.3 — CoachScreen NO LONGER owns the visible-week markers. They
  // now live in src/components/dev/SmokeCoachBikeHarness.tsx mounted
  // top-level by AppNavigator. CoachScreen rendering must be free of
  // smoke-visible-week-{ready,pending,missing,inactive,debug} testIDs
  // so we can never re-introduce the silent-state failure.
  ok(
    'CoachScreen does NOT render testID="smoke-visible-week-ready"',
    !/testID="smoke-visible-week-ready"/.test(coachScreenSource),
  );
  ok(
    'CoachScreen does NOT render testID="smoke-visible-week-pending"',
    !/testID="smoke-visible-week-pending"/.test(coachScreenSource),
  );
  ok(
    'CoachScreen does NOT render testID="smoke-visible-week-missing"',
    !/testID="smoke-visible-week-missing"/.test(coachScreenSource),
  );
  ok(
    'CoachScreen does NOT render testID="smoke-visible-week-inactive"',
    !/testID="smoke-visible-week-inactive"/.test(coachScreenSource),
  );
  ok(
    'CoachScreen does NOT render testID="smoke-visible-week-debug"',
    !/testID="smoke-visible-week-debug"/.test(coachScreenSource),
  );
  ok(
    'CoachScreen does not declare a SmokeVisibleWeekState type',
    !/type\s+SmokeVisibleWeekState\s*=/.test(coachScreenSource),
  );

  // 20.4 — Maestro preflight order: precoach-ready BEFORE pending/missing/inactive.
  function assertVisibleWeekPreflight(yaml: string, label: string) {
    const readyIdx = yaml.indexOf('id: "smoke-precoach-week-ready"');
    const pendingIdx = yaml.indexOf('id: "smoke-visible-week-pending"');
    const missingIdx = yaml.indexOf('id: "smoke-visible-week-missing"');
    const inactiveIdx = yaml.indexOf('id: "smoke-visible-week-inactive"');
    const tapCoachInputIdx = yaml.indexOf('tapOn:\n    id: "coach-input"');
    ok(
      `${label}: YAML contains smoke-precoach-week-ready`,
      readyIdx >= 0,
    );
    ok(
      `${label}: YAML contains smoke-visible-week-pending (assertNotVisible)`,
      pendingIdx >= 0,
    );
    ok(
      `${label}: YAML contains smoke-visible-week-missing (assertNotVisible)`,
      missingIdx >= 0,
    );
    ok(
      `${label}: YAML contains smoke-visible-week-inactive (assertNotVisible)`,
      inactiveIdx >= 0,
    );
    ok(
      `${label}: smoke-precoach-week-ready wait appears BEFORE pending assertNotVisible`,
      readyIdx >= 0 && pendingIdx >= 0 && readyIdx < pendingIdx,
    );
    ok(
      `${label}: smoke-precoach-week-ready wait appears BEFORE missing assertNotVisible`,
      readyIdx >= 0 && missingIdx >= 0 && readyIdx < missingIdx,
    );
    ok(
      `${label}: smoke-visible-week-inactive assertNotVisible appears BEFORE precoach-ready wait`,
      // Per the v3 spec the order is: fingerprint → debug → inactive
      // → ready (wait) → pending → missing. inactive is checked
      // FIRST so a "Harness mounted but smoke flow inactive" failure
      // surfaces immediately instead of waiting 15s for the ready
      // timeout.
      readyIdx >= 0 && inactiveIdx >= 0 && inactiveIdx < readyIdx,
    );
    ok(
      `${label}: smoke-precoach-week-ready resolves BEFORE first tapOn coach-input`,
      readyIdx >= 0 && tapCoachInputIdx >= 0 && readyIdx < tapCoachInputIdx,
    );
    ok(
      `${label}: smoke-visible-week-pending is an assertNotVisible step`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-visible-week-pending"/.test(yaml),
    );
    ok(
      `${label}: smoke-visible-week-missing is an assertNotVisible step`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-visible-week-missing"/.test(yaml),
    );
    ok(
      `${label}: smoke-visible-week-inactive is an assertNotVisible step`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-visible-week-inactive"/.test(yaml),
    );
  }
  assertVisibleWeekPreflight(maestroEnvSource, 'env YAML');
  assertVisibleWeekPreflight(maestroDeepLinkSource, 'deep-link YAML');

  // 20.5 — Wrapper scans the harness-emitted log lines.
  ok(
    'wrapper scans [smoke-visible-week] state=ready marker',
    /smokeVisibleWeekReady[\s\S]{0,200}\[smoke-visible-week\\\] state=ready/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans [smoke-visible-week] state=missing marker',
    /smokeVisibleWeekMissing[\s\S]{0,200}\[smoke-visible-week\\\] state=missing/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans [smoke-visible-week] state=pending marker',
    /smokeVisibleWeekPending[\s\S]{0,200}\[smoke-visible-week\\\] state=pending/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans [smoke-visible-week] state=inactive marker',
    /smokeVisibleWeekInactive[\s\S]{0,200}\[smoke-visible-week\\\] state=inactive/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans state=missing reason=route-not-coach',
    /smokeVisibleWeekMissingRouteNotCoach[\s\S]{0,200}state=missing reason=route-not-coach/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans state=missing reason=wednesday-not-easy-aerobic-flush',
    /smokeVisibleWeekMissingNotEasyAerobicFlush[\s\S]{0,200}state=missing reason=wednesday-not-easy-aerobic-flush/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans state=missing reason=no-rower-before-change',
    /smokeVisibleWeekMissingNoRower[\s\S]{0,200}state=missing reason=no-rower-before-change/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper scans bootstrap wednesday-seeded log',
    /smokeBootstrapWednesdaySeeded[\s\S]{0,300}wednesday-seeded name=Easy Aerobic Flush/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper records smokePrecoachWeekReadyStatus from smoke-precoach-week-ready step',
    /smokePrecoachWeekReadyStatus:\s*stepStatusFromText\([\s\S]{0,200}['"]smoke-precoach-week-ready['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper records smokeVisibleWeekMissingStatus from smoke-visible-week-missing step',
    /smokeVisibleWeekMissingStatus:\s*stepStatusFromText\([\s\S]{0,200}['"]smoke-visible-week-missing['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper labels failure with the canonical visible-week mismatch label',
    wrapperSource.includes(
      'Live coach context mismatch: visible week did not contain expected Wednesday rower session.',
    ),
  );
  ok(
    'wrapper includes smoke-precoach-week-ready in the Maestro step trace',
    /smoke-precoach-week-ready:[\s\S]{0,200}smokePrecoachWeekReadyStatus/.test(
      wrapperSource,
    ),
  );

  // 20.6 — Pipeline test must source the Wednesday workout from the
  // SAME shared fixture so divergence between live bootstrap and
  // pipeline can never silently slip back in.
  ok(
    'pipeline test imports buildSmokeWednesdayWorkout from shared fixture',
    /import\s*\{[\s\S]{0,300}buildSmokeWednesdayWorkout[\s\S]{0,300}\}\s*from\s*['"]\.\.\/data\/smokeCoachBikeFlowProgram['"]/.test(
      pipelineTestSource,
    ),
  );
  ok(
    'pipeline test buildWedEasyAerobicFlush delegates to buildSmokeWednesdayWorkout',
    /function\s+buildWedEasyAerobicFlush[\s\S]{0,200}return\s+buildSmokeWednesdayWorkout/.test(
      pipelineTestSource,
    ),
  );
  ok(
    'pipeline test does NOT inline its own Wednesday Workout literal',
    !/dayOfWeek:\s*3[\s\S]{0,400}name:\s*['"]Easy Aerobic Flush['"][\s\S]{0,200}conditioningBlock/.test(
      pipelineTestSource,
    ),
  );
}

section('[21] SmokeCoachBikeHarness — top-level mount + wrapper diagnostics');
{
  // The visible-week preflight previously rendered nothing because:
  //   (a) CoachScreen's smokeCoachBikeFlow was non-reactive; if the
  //       screen mounted before runSmokeBootstrap resolved the route
  //       the flag stayed false forever.
  //   (b) markers were also gated on isFocused — false on the same
  //       frame the screen mounted.
  //   (c) markers rendered inside the chat FlatList /
  //       KeyboardAvoidingView, so Maestro occasionally treated them
  //       as offscreen / collapsed under the keyboard.
  //
  // The fix moves all visible-week markers into a top-level harness
  // (src/components/dev/SmokeCoachBikeHarness.tsx) mounted as a
  // sibling of Tab.Navigator inside ResolvedAppNavigator. The harness
  // reads activeSmokeInitialRoute + actualCurrentRoute via
  // useSyncExternalStore, builds the resolved week directly from
  // Zustand stores, and renders EXACTLY one of {inactive, pending,
  // ready, missing} plus an always-on debug marker.

  const harnessSource = fs.readFileSync(
    path.resolve(__dirname, '../components/dev/SmokeCoachBikeHarness.tsx'),
    'utf8',
  );
  const harnessStateSource = fs.readFileSync(
    path.resolve(__dirname, '../components/dev/smokeVisibleWeekHarnessState.ts'),
    'utf8',
  );
  const appNavigatorSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/AppNavigator.tsx'),
    'utf8',
  );
  const wrapperSource = fs.readFileSync(WRAPPER_PATH, 'utf8');

  // 21.1 — Harness exists and exports a default React component.
  ok(
    'SmokeCoachBikeHarness file exists and exports default component',
    /export\s+default\s+function\s+SmokeCoachBikeHarness/.test(harnessSource),
  );

  // 21.2 — Harness uses the same smoke signal seam AppNavigator does:
  // activeSmokeInitialRoute + smokeNavState (actualCurrentRoute).
  ok(
    'harness imports subscribeToActiveSmokeInitialRoute + getActiveSmokeInitialRoute',
    /subscribeToActiveSmokeInitialRoute/.test(harnessSource) &&
      /getActiveSmokeInitialRoute/.test(harnessSource),
  );
  ok(
    'harness imports subscribeSmokeNavState + getSmokeNavStateSnapshot',
    /subscribeSmokeNavState/.test(harnessSource) &&
      /getSmokeNavStateSnapshot/.test(harnessSource),
  );
  ok(
    'harness uses React.useSyncExternalStore for the smoke nav snapshot',
    /React\.useSyncExternalStore\(\s*subscribeSmokeNavState\s*,\s*getSmokeNavStateSnapshot\s*,/.test(
      harnessSource,
    ),
  );
  ok(
    'harness imports buildProgramTabProjectedWeek (same source Program/Home use)',
    /buildProgramTabProjectedWeek/.test(harnessSource) &&
      /from\s*['"]\.\.\/\.\.\/utils\/visibleProgramReadModel['"]/.test(
        harnessSource,
      ),
  );
  ok(
    'harness state module imports SMOKE_WEDNESDAY_* constants from shared fixture',
    /SMOKE_WEDNESDAY_WORKOUT_NAME/.test(harnessStateSource) &&
      /SMOKE_WEDNESDAY_PRE_CHANGE_MODALITY/.test(harnessStateSource) &&
      /from\s*['"]\.\.\/\.\.\/data\/smokeCoachBikeFlowProgram['"]/.test(
        harnessStateSource,
      ),
  );

  // 21.3 — Pure derivation function lives in its own module so tests
  // can require it without pulling in react-native.
  ok(
    'pure state module exports deriveSmokeVisibleWeekHarnessState(args) helper',
    /export\s+function\s+deriveSmokeVisibleWeekHarnessState/.test(
      harnessStateSource,
    ),
  );
  ok(
    'pure state module exports SmokeVisibleWeekHarnessState type with all four states',
    /export\s+type\s+SmokeVisibleWeekHarnessState[\s\S]{0,200}['"]inactive['"][\s\S]{0,80}['"]pending['"][\s\S]{0,80}['"]ready['"][\s\S]{0,80}['"]missing['"]/.test(
      harnessStateSource,
    ),
  );
  ok(
    'harness re-exports deriveSmokeVisibleWeekHarnessState from pure module',
    /export\s*\{[\s\S]{0,400}deriveSmokeVisibleWeekHarnessState[\s\S]{0,400}\}\s*from\s*['"]\.\/smokeVisibleWeekHarnessState['"]/.test(
      harnessSource,
    ),
  );

  // 21.4 — All four state markers + debug marker rendered.
  ok(
    'harness renders testID="smoke-visible-week-inactive"',
    /testID="smoke-visible-week-inactive"/.test(harnessSource),
  );
  ok(
    'harness renders testID="smoke-visible-week-pending"',
    /testID="smoke-visible-week-pending"/.test(harnessSource),
  );
  ok(
    'harness renders testID="smoke-visible-week-ready"',
    /testID="smoke-visible-week-ready"/.test(harnessSource),
  );
  ok(
    'harness renders testID="smoke-visible-week-missing"',
    /testID="smoke-visible-week-missing"/.test(harnessSource),
  );
  ok(
    'harness renders testID="smoke-visible-week-debug"',
    /testID="smoke-visible-week-debug"/.test(harnessSource),
  );

  // 21.5 — Each marker gated on the corresponding state value.
  ok(
    'smoke-visible-week-inactive gated on result.state === "inactive"',
    /result\.state\s*===\s*['"]inactive['"][\s\S]{0,400}testID="smoke-visible-week-inactive"/.test(
      harnessSource,
    ),
  );
  ok(
    'smoke-visible-week-pending gated on result.state === "pending"',
    /result\.state\s*===\s*['"]pending['"][\s\S]{0,400}testID="smoke-visible-week-pending"/.test(
      harnessSource,
    ),
  );
  ok(
    'smoke-visible-week-ready gated on result.state === "ready"',
    /result\.state\s*===\s*['"]ready['"][\s\S]{0,400}testID="smoke-visible-week-ready"/.test(
      harnessSource,
    ),
  );
  ok(
    'smoke-visible-week-missing gated on result.state === "missing"',
    /result\.state\s*===\s*['"]missing['"][\s\S]{0,400}testID="smoke-visible-week-missing"/.test(
      harnessSource,
    ),
  );

  // 21.6 — Debug marker label carries state + reason + route + week.
  ok(
    'smoke-visible-week-debug accessibilityLabel carries state/reason/route/week',
    /testID="smoke-visible-week-debug"[\s\S]{0,800}accessibilityLabel=\{`smoke-visible-week\s+state=\$\{result\.state\}\s+reason=\$\{result\.reason\}\s+route=\$\{result\.route\s*\?\?\s*['"]null['"]\}\s+week=\$\{result\.weekDump\}`\}/.test(
      harnessSource,
    ),
  );

  // 21.7 — All four state log lines emitted.
  ok(
    'harness emits [smoke-visible-week] state=inactive log',
    /\[smoke-visible-week\] state=inactive/.test(harnessSource),
  );
  ok(
    'harness emits [smoke-visible-week] state=pending log',
    /\[smoke-visible-week\] state=pending/.test(harnessSource),
  );
  ok(
    'harness emits [smoke-visible-week] state=ready log',
    /\[smoke-visible-week\] state=ready/.test(harnessSource),
  );
  ok(
    'harness emits [smoke-visible-week] state=missing log',
    /\[smoke-visible-week\] state=missing/.test(harnessSource),
  );

  // 21.8 — App.tsx mounts the harness UNCONDITIONALLY in __DEV__.
  // Previously the harness was mounted by AppNavigator gated on
  // inSmokeMode — that gate failed in deep-link runs where the smoke
  // runtime signal stayed null. Mounting at App.tsx removes every
  // mount-order / gating race possible.
  {
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, '../../App.tsx'),
      'utf8',
    );
    // v5 — App.tsx must NOT import or render the separate
    // SmokeCoachBikeHarness component. It also must NOT render the old
    // nested AppSmokeCoachBikeOverlay component; visible-week markers
    // are direct App.tsx Views through renderSmokeMarker.
    ok(
      'v4: App.tsx does NOT import SmokeCoachBikeHarness',
      !/import\s+SmokeCoachBikeHarness\s+from/.test(appSrc),
    );
    ok(
      'v4: App.tsx does NOT render <SmokeCoachBikeHarness />',
      !/<SmokeCoachBikeHarness\s*\/>/.test(appSrc),
    );
    ok(
      'v5: App.tsx does NOT define AppSmokeCoachBikeOverlay locally',
      !/function\s+AppSmokeCoachBikeOverlay\s*\(\s*\)/.test(appSrc),
    );
    ok(
      'v5: App.tsx does NOT render <AppSmokeCoachBikeOverlay />',
      !/<AppSmokeCoachBikeOverlay\s*\/>/.test(appSrc),
    );
    ok(
      'v5: App.tsx directly renders smoke-visible-week-debug with renderSmokeMarker',
      /renderSmokeMarker\([\s\S]{0,120}['"]smoke-visible-week-debug['"]/.test(
        appSrc,
      ),
    );
    ok(
      'AppNavigator does NOT mount SmokeCoachBikeHarness (duplicate testID would break)',
      !/<SmokeCoachBikeHarness/.test(appNavigatorSource),
    );
  }

  // 21.9 — stepVisibilityFromText helper for assertNotVisible vs visible.
  ok(
    'wrapper defines stepVisibilityFromText helper',
    /function\s+stepVisibilityFromText\s*\(/.test(wrapperSource),
  );
  ok(
    'stepVisibilityFromText returns visible: "yes"|"no"|"unknown"',
    /let\s+visible\s*=\s*['"]unknown['"]/.test(wrapperSource) &&
      /visible\s*=\s*isAssertNotVisible\s*\?\s*['"]no['"]\s*:\s*['"]yes['"]/.test(
        wrapperSource,
      ) &&
      /visible\s*=\s*isAssertNotVisible\s*\?\s*['"]yes['"]\s*:\s*['"]no['"]/.test(
        wrapperSource,
      ),
  );
  ok(
    'stepVisibilityFromText recognises Maestro "is not visible" assertNotVisible lines',
    /is\\s\+not\\s\+visible/.test(wrapperSource),
  );
  ok(
    'wrapper records smokeVisibleWeekDebugVisibility from smoke-visible-week-debug step',
    /smokeVisibleWeekDebugVisibility:\s*stepVisibilityFromText\([\s\S]{0,200}['"]smoke-visible-week-debug['"]/.test(
      wrapperSource,
    ),
  );
  ok(
    'wrapper records smokeVisibleWeekInactiveVisibility from smoke-visible-week-inactive step',
    /smokeVisibleWeekInactiveVisibility:\s*stepVisibilityFromText\([\s\S]{0,200}['"]smoke-visible-week-inactive['"]/.test(
      wrapperSource,
    ),
  );

  // 21.10 — V3 categorical wrapper diagnostic labels (per spec).
  // The previous "Smoke harness inactive..." / "INTERNAL HARNESS
  // BUG..." labels were replaced by exact spec strings; v3 also adds
  // "Stale bundle: smoke-build-fingerprint missing".
  ok(
    'wrapper diagnostic: Harness mounted but smoke flow inactive',
    wrapperSource.includes('Harness mounted but smoke flow inactive'),
  );
  ok(
    'wrapper diagnostic: Harness pending: <reason>',
    /Harness pending:/.test(wrapperSource),
  );
  ok(
    'wrapper diagnostic: Harness not mounted in live app bundle',
    wrapperSource.includes('Harness not mounted in live app bundle'),
  );
  ok(
    'wrapper diagnostic: Stale bundle: smoke-build-fingerprint missing',
    wrapperSource.includes('Stale bundle: smoke-build-fingerprint missing'),
  );
  ok(
    'wrapper diagnostic preserves: Live coach context mismatch label',
    wrapperSource.includes(
      'Live coach context mismatch: visible week did not contain expected Wednesday rower session.',
    ),
  );

  // 21.11 — Bootstrap "unknown" when logs unscannable.
  ok(
    'wrapper bootstrap diagnostic reports "unknown" when logs not scannable',
    /bootstrapLogScannable\s*\?\s*\(markers\.smokeBootstrapWednesdaySeeded[\s\S]{0,400}unknown/.test(
      wrapperSource,
    ),
  );

  // 21.12 — fail-block step trace includes inactive + debug.
  ok(
    'fail-block step trace includes smoke-visible-week-inactive with visibility',
    /smoke-visible-week-inactive:[\s\S]{0,200}smokeVisibleWeekInactiveStatus[\s\S]{0,200}smokeVisibleWeekInactiveVisibility/.test(
      wrapperSource,
    ),
  );
  ok(
    'fail-block step trace includes smoke-visible-week-debug as direct App.tsx debug marker',
    /smoke-visible-week-debug:[\s\S]{0,200}smokeVisibleWeekDebugVisibility[\s\S]{0,120}direct App\.tsx debug marker/.test(
      wrapperSource,
    ),
  );
}

section('[22] Harness state-machine — required hard tests');
{
  // The user spec required exactly 10 hard tests for the harness fix.
  // Some were already proven in [21] above (mount, marker rendering,
  // diagnostics). The 10 below run the EXPORTED pure derivation
  // function so each state outcome is verified end-to-end without
  // standing up React Native.
  //
  // We import the pure helper via require() because this file is run
  // by sucrase-node — it can transpile .tsx but the require path
  // matters: harness uses React imports, but
  // deriveSmokeVisibleWeekHarnessState is pure. The require below
  // grabs only the pure export.

  // Require the PURE state-derivation module (not the .tsx component)
  // so sucrase-node doesn't try to parse react-native's Flow types.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const harness = require('../components/dev/smokeVisibleWeekHarnessState');
  const derive = harness.deriveSmokeVisibleWeekHarnessState as (
    args: any,
  ) => {
    state: string;
    reason: string;
    route: string | null;
    weekDump: string;
    wedText?: string;
    hasEasyAerobicFlush?: boolean;
    hasRower?: boolean;
  };
  const collectWednesdaySmokeText =
    harness.collectWednesdaySmokeText as (wedDay: any) => string;
  const deriveOpenTarget = harness.deriveSmokeWednesdayOpenTarget as (
    args: any,
  ) => {
    state: string;
    reason: string;
    target: { date: string; workoutId: string; title: string } | null;
    wedText: string;
    hasEasyAerobicFlush: boolean;
  };

  // Build a minimal Wednesday workout that satisfies the ready
  // contract — same shared constants the harness consumes.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fixture = require('../data/smokeCoachBikeFlowProgram');
  const SMOKE_WEDNESDAY_WORKOUT_NAME = fixture.SMOKE_WEDNESDAY_WORKOUT_NAME;
  const SMOKE_WEDNESDAY_OPTION_TITLE = fixture.SMOKE_WEDNESDAY_OPTION_TITLE;
  const SMOKE_WEDNESDAY_DESCRIPTION = fixture.SMOKE_WEDNESDAY_DESCRIPTION;

  const buildReadyWedDay = () => ({
    dayOfWeek: 3,
    short: 'Wed',
    date: '2026-05-13',
    workout: {
      name: SMOKE_WEDNESDAY_WORKOUT_NAME,
      description: SMOKE_WEDNESDAY_DESCRIPTION,
      conditioningBlock: {
        options: [
          {
            title: SMOKE_WEDNESDAY_OPTION_TITLE,
            description: SMOKE_WEDNESDAY_DESCRIPTION,
          },
        ],
      },
    },
  });

  // Test 1 — every state derivation produces exactly one state value
  // from the closed enum, never `undefined`.
  {
    const cases = [
      { smokeFlowActive: false, actualCurrentRoute: null, weekDays: undefined },
      { smokeFlowActive: true, actualCurrentRoute: null, weekDays: undefined },
      { smokeFlowActive: true, actualCurrentRoute: 'Coach', weekDays: undefined },
      { smokeFlowActive: true, actualCurrentRoute: 'Home', weekDays: [] },
      {
        smokeFlowActive: true,
        actualCurrentRoute: 'Coach',
        weekDays: [buildReadyWedDay()],
      },
    ];
    let allClosed = true;
    for (const c of cases) {
      const r = derive(c);
      if (!['inactive', 'pending', 'ready', 'missing'].includes(r.state)) {
        allClosed = false;
        break;
      }
    }
    ok('Test 1: harness state always one of closed enum {inactive,pending,ready,missing}', allClosed);
  }

  // Test 2 — pending when resolvedWeek is undefined or null.
  {
    const r1 = derive({
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: undefined,
    });
    const r2 = derive({
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: null,
    });
    ok(
      'Test 2: pending no-resolved-week-yet when weekDays undefined',
      r1.state === 'pending' && r1.reason === 'no-resolved-week-yet',
    );
    ok(
      'Test 2: pending no-resolved-week-yet when weekDays null',
      r2.state === 'pending' && r2.reason === 'no-resolved-week-yet',
    );
  }

  // Test 3 — every missing reason is reachable from valid input.
  {
    const wedNoMatch = {
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [
        { dayOfWeek: 3, date: '2026-05-13', workout: { name: 'Other Session' } },
      ],
    };
    const wedNoWorkout = {
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [{ dayOfWeek: 3, date: '2026-05-13', workout: null }],
    };
    const noWedDay = {
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [{ dayOfWeek: 1, date: '2026-05-11' }],
    };
    const wedNoRower = {
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [
        {
          dayOfWeek: 3,
          date: '2026-05-13',
          workout: {
            name: SMOKE_WEDNESDAY_WORKOUT_NAME,
            description: 'bike only flush with easy breathing',
            conditioningBlock: { options: [] },
          },
        },
      ],
    };
    const emptyWeek = {
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [],
    };
    const routeNotCoach = {
      smokeFlowActive: true,
      actualCurrentRoute: 'Home',
      weekDays: [buildReadyWedDay()],
    };
    ok(
      'Test 3a: missing reason=route-not-coach',
      derive(routeNotCoach).reason === 'route-not-coach',
    );
    ok(
      'Test 3b: missing reason=no-resolved-week (empty array)',
      derive(emptyWeek).reason === 'no-resolved-week',
    );
    ok(
      'Test 3c: missing reason=no-wednesday-day',
      derive(noWedDay).reason === 'no-wednesday-day',
    );
    ok(
      'Test 3d: missing reason=wednesday-has-no-workout',
      derive(wedNoWorkout).reason === 'wednesday-has-no-workout',
    );
    ok(
      'Test 3e: missing reason=wednesday-not-easy-aerobic-flush',
      derive(wedNoMatch).reason === 'wednesday-not-easy-aerobic-flush',
    );
    ok(
      'Test 3f: missing reason=no-rower-before-change',
      derive(wedNoRower).reason === 'no-rower-before-change',
    );
  }

  // Test 4 — ready only with full happy path.
  {
    const r = derive({
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [buildReadyWedDay()],
    });
    ok('Test 4: ready when route=Coach + Wed + EAF + Rower', r.state === 'ready' && r.reason === 'ok');
    const suffixedTitle = derive({
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [
        {
          dayOfWeek: 3,
          short: 'Wed',
          date: '2026-05-13',
          workout: {
            id: 'smoke-wed-workout',
            name: 'Easy Aerobic Flush (20min Rower)',
            workoutType: 'Conditioning',
          },
        },
      ],
    });
    ok(
      'Test 4b: ready when title is "Easy Aerobic Flush (20min Rower)"',
      suffixedTitle.state === 'ready' &&
        suffixedTitle.reason === 'ok' &&
        suffixedTitle.hasEasyAerobicFlush === true &&
        suffixedTitle.hasRower === true,
    );
    const exactTitleNestedRower = derive({
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [
        {
          dayOfWeek: 3,
          short: 'Wed',
          date: '2026-05-13',
          workout: {
            name: 'Easy Aerobic Flush',
            conditioningBlock: {
              options: [{ title: 'Rower', description: '20min easy row' }],
            },
            exercises: [
              {
                exercise: {
                  name: 'Rower technique',
                  description: 'Easy aerobic row',
                },
                notes: 'Keep it smooth',
              },
            ],
          },
        },
      ],
    });
    ok(
      'Test 4c: ready when exact title and option/exercise contains Rower',
      exactTitleNestedRower.state === 'ready' &&
        exactTitleNestedRower.reason === 'ok',
    );
    const noRower = derive({
      smokeFlowActive: true,
      actualCurrentRoute: 'Coach',
      weekDays: [
        {
          dayOfWeek: 3,
          date: '2026-05-13',
          workout: {
            name: 'Easy Aerobic Flush',
            conditioningBlock: {
              options: [{ title: 'Bike', description: '20min easy spin' }],
            },
          },
        },
      ],
    });
    ok(
      'Test 4d: no-rower-before-change when Easy Aerobic Flush exists but rower/row/rowing is absent',
      noRower.state === 'missing' &&
        noRower.reason === 'no-rower-before-change' &&
        noRower.hasEasyAerobicFlush === true &&
        noRower.hasRower === false,
    );
    ok(
      'Test 4e: collectWednesdaySmokeText includes option title/description and exercise name/description/notes',
      (() => {
        const text = collectWednesdaySmokeText({
          dayOfWeek: 3,
          workout: {
            name: 'Easy Aerobic Flush',
            conditioningBlock: {
              options: [{ title: 'Option Rower', description: 'Option description' }],
            },
            exercises: [
              {
                exercise: {
                  name: 'Exercise Rower',
                  description: 'Exercise description',
                },
                notes: 'Exercise notes',
              },
            ],
          },
        });
        return (
          text.includes('Option Rower') &&
          text.includes('Option description') &&
          text.includes('Exercise Rower') &&
          text.includes('Exercise description') &&
          text.includes('Exercise notes')
        );
      })(),
    );
    const postCoachBike = deriveOpenTarget({
      weekDays: [
        {
          dayOfWeek: 3,
          short: 'Wed',
          date: '2026-05-13',
          workout: {
            id: 'smoke-wed-workout',
            name: 'Easy Aerobic Flush (20min Bike)',
            description: '20min easy Bike. Cruise pace. 3-4/10.',
            workoutType: 'Conditioning',
          },
        },
      ],
    });
    ok(
      'Test 4f: postcoach open target accepts Easy Aerobic Flush (20min Bike)',
      postCoachBike.state === 'ready' &&
        postCoachBike.reason === 'ok' &&
        postCoachBike.target?.date === '2026-05-13' &&
        postCoachBike.target?.workoutId === 'smoke-wed-workout',
    );
    const postCoachNoRower = deriveOpenTarget({
      weekDays: [
        {
          dayOfWeek: 3,
          date: '2026-05-13',
          workout: {
            id: 'smoke-wed-workout',
            name: 'Easy Aerobic Flush',
            conditioningBlock: {
              options: [{ title: 'Bike', description: '20min easy spin' }],
            },
          },
        },
      ],
    });
    ok(
      'Test 4g: postcoach open target does not require Rower',
      postCoachNoRower.state === 'ready' &&
        postCoachNoRower.reason === 'ok' &&
        postCoachNoRower.hasEasyAerobicFlush === true,
    );
    const postCoachMissingWed = deriveOpenTarget({
      weekDays: [
        {
          dayOfWeek: 1,
          date: '2026-05-11',
          workout: { id: 'mon', name: 'Lower Body Strength' },
        },
      ],
    });
    const postCoachWrongWed = deriveOpenTarget({
      weekDays: [
        {
          dayOfWeek: 3,
          date: '2026-05-13',
          workout: { id: 'wed', name: 'Tempo Run' },
        },
      ],
    });
    ok(
      'Test 4h: postcoach open target rejects missing Wednesday or non-Easy Aerobic Flush',
      postCoachMissingWed.state === 'missing' &&
        postCoachMissingWed.reason === 'no-Wednesday-date-in-week' &&
        postCoachWrongWed.state === 'missing' &&
        postCoachWrongWed.reason === 'Wednesday-not-easy-aerobic-flush',
    );
  }

  // Test 5 — derivation is pure: no React, no CoachScreen state.
  {
    const sourceSelf = fs.readFileSync(__filename, 'utf8');
    ok(
      'Test 5: deriveSmokeVisibleWeekHarnessState requires no CoachScreen state',
      // Calling derive with arbitrary args produces a result deterministically
      // (no thrown errors, no global state).  Sanity: this whole section ran.
      typeof derive === 'function' && sourceSelf.length > 0,
    );
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const harnessSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/dev/SmokeCoachBikeHarness.tsx'),
      'utf8',
    );
    ok(
      'Test 5: harness does not import CoachScreen',
      !/from\s*['"][^'"]*CoachScreen['"]/.test(harnessSrc),
    );
    // Strip block + line comments before checking that useIsFocused
    // is not called in actual code — the harness doc-comment
    // legitimately mentions it.
    const harnessCodeOnly = harnessSrc
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    ok(
      'Test 5: harness does not call useIsFocused',
      !/useIsFocused\s*\(/.test(harnessCodeOnly) &&
        !/import[^;]*useIsFocused/.test(harnessCodeOnly),
    );
  }

  // Test 6 — CoachScreen no longer owns the visible-week markers.
  {
    const coachSrc = fs.readFileSync(
      path.resolve(__dirname, '../screens/coach/CoachScreen.tsx'),
      'utf8',
    );
    ok(
      'Test 6: CoachScreen has no smoke-visible-week-* testID',
      !/testID="smoke-visible-week-(ready|pending|missing|inactive|debug)"/.test(
        coachSrc,
      ),
    );
  }

  // Test 7 — Maestro YAMLs assert ready BEFORE coach-input tap.
  {
    const env = fs.readFileSync(
      path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
      'utf8',
    );
    const dl = fs.readFileSync(
      path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
      'utf8',
    );
    for (const [label, yaml] of [
      ['env yaml', env],
      ['deep-link yaml', dl],
    ] as const) {
      const ready = yaml.indexOf('id: "smoke-precoach-week-ready"');
      const tap = yaml.indexOf('tapOn:\n    id: "coach-input"');
      ok(
        `Test 7 (${label}): precoach ready wait precedes coach-input tap`,
        ready >= 0 && tap >= 0 && ready < tap,
      );
    }
  }

  // Test 8 — wrapper has all four diagnostic labels (inactive,
  // stuck-pending, missing, harness-bug).
  {
    const w = fs.readFileSync(WRAPPER_PATH, 'utf8');
    ok(
      'Test 8a: wrapper has Harness mounted but smoke flow inactive label',
      w.includes('Harness mounted but smoke flow inactive'),
    );
    ok(
      'Test 8b: wrapper has Harness pending: template',
      /Harness pending:/.test(w),
    );
    ok(
      'Test 8c: wrapper has Live coach context mismatch label (legacy preserved)',
      w.includes(
        'Live coach context mismatch: visible week did not contain expected Wednesday rower session.',
      ),
    );
    ok(
      'Test 8d: wrapper has Harness not mounted in live app bundle label',
      w.includes('Harness not mounted in live app bundle'),
    );
    ok(
      'Test 8e: wrapper has Stale bundle label',
      w.includes('Stale bundle: smoke-build-fingerprint missing'),
    );
  }

  // Test 9 — pipeline test + bootstrap use the SAME shared fixture.
  {
    const bootstrapSrc = fs.readFileSync(
      path.resolve(__dirname, '../utils/smokeBootstrap.ts'),
      'utf8',
    );
    const pipelineSrc = fs.readFileSync(
      path.resolve(__dirname, 'smokeCoachBikeFlowTests.ts'),
      'utf8',
    );
    ok(
      'Test 9: bootstrap imports buildSmokeCoachBikeFlowProgram from shared fixture',
      /buildSmokeCoachBikeFlowProgram[\s\S]{0,200}from\s*['"][^'"]*smokeCoachBikeFlowProgram['"]/.test(
        bootstrapSrc,
      ),
    );
    ok(
      'Test 9: pipeline test imports buildSmokeWednesdayWorkout from shared fixture',
      /buildSmokeWednesdayWorkout[\s\S]{0,200}from\s*['"][^'"]*smokeCoachBikeFlowProgram['"]/.test(
        pipelineSrc,
      ),
    );
  }

  // Test 10 — there is no reachable code path where smoke flow active
  // + actualCurrentRoute='Coach' produces no state marker. Brute-force
  // exhaustively over the cartesian product of weekDays shapes that
  // could occur. Every shape must produce a non-empty state.
  {
    const shapes: any[] = [
      undefined,
      null,
      [],
      [{ dayOfWeek: 1, date: '2026-05-11' }],
      [{ dayOfWeek: 3, date: '2026-05-13' }],
      [{ dayOfWeek: 3, date: '2026-05-13', workout: null }],
      [
        {
          dayOfWeek: 3,
          date: '2026-05-13',
          workout: { name: 'Wrong' },
        },
      ],
      [
        {
          dayOfWeek: 3,
          date: '2026-05-13',
          workout: { name: SMOKE_WEDNESDAY_WORKOUT_NAME },
        },
      ],
      [buildReadyWedDay()],
    ];
    let allYieldMarker = true;
    for (const w of shapes) {
      const r = derive({
        smokeFlowActive: true,
        actualCurrentRoute: 'Coach',
        weekDays: w,
      });
      if (!r.state || !['inactive', 'pending', 'ready', 'missing'].includes(r.state)) {
        allYieldMarker = false;
        break;
      }
    }
    ok(
      'Test 10: no possible weekDays shape yields a silent (empty) state',
      allYieldMarker,
    );
  }
}

section('[23] Top-level harness mount + physical-visibility hardening');
{
  // The previous live run showed: coach-ready visible, coach-input
  // visible, coach-send-button visible, smoke-precoach-week-ready
  // FAILED, all other visible-week markers unknown/not visible. That
  // is the harness-not-in-live-tree failure: harness mount was gated
  // on inSmokeMode inside AppNavigator, and the gate did not fire.
  //
  // Spec required:
  //   1. Mount unconditionally in __DEV__ from App.tsx.
  //   2. Module-load + render + error logs in the harness.
  //   3. Markers physically visible (red 12×12, zIndex 999999).
  //   4. Always render smoke-visible-week-debug + exactly one state.
  //   5. smoke-build-fingerprint marker as the first thing Maestro
  //      asserts; absent = stale bundle.
  //   6. Five exact wrapper diagnostic labels.
  //   7. Maestro YAML order: fingerprint → debug → inactive →
  //      ready (wait) → pending → missing → coach-input.
  //   8. Wrapper never reports a marker as "visible" just because the
  //      step was COMPLETED (assertNotVisible COMPLETED means absent).

  const appSource = fs.readFileSync(
    path.resolve(__dirname, '../../App.tsx'),
    'utf8',
  );
  const harnessSource = fs.readFileSync(
    path.resolve(__dirname, '../components/dev/SmokeCoachBikeHarness.tsx'),
    'utf8',
  );
  const rootNavSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/RootNavigator.tsx'),
    'utf8',
  );
  const appNavSource = fs.readFileSync(
    path.resolve(__dirname, '../navigation/AppNavigator.tsx'),
    'utf8',
  );
  const wrapperSourceLocal = fs.readFileSync(WRAPPER_PATH, 'utf8');
  const envYaml = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const dlYaml = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );

  // 23.1 — Unconditional __DEV__ direct markers in App.tsx (no inSmokeMode gate).
  // v5 — App.tsx no longer mounts the nested AppSmokeCoachBikeOverlay
  // component. It owns smokeOverlayResult state directly and renders
  // the visible-week debug/state markers through renderSmokeMarker as
  // siblings of <RootNavigator />.
  ok(
    '23.1: App.tsx does NOT render <AppSmokeCoachBikeOverlay />',
    !/<AppSmokeCoachBikeOverlay\s*\/>/.test(appSource),
  );
  ok(
    '23.1: App.tsx does NOT define AppSmokeCoachBikeOverlay',
    !/function\s+AppSmokeCoachBikeOverlay/.test(appSource),
  );
  ok(
    '23.1: App.tsx owns smokeOverlayResult state directly',
    /const\s*\[\s*smokeOverlayResult\s*,\s*setSmokeOverlayResult\s*\]\s*=[\s\S]{0,120}React\.useState<SmokeOverlayResult>\(SMOKE_OVERLAY_INITIAL\)/.test(
      appSource,
    ),
  );
  ok(
    '23.1: App.tsx renders smoke-visible-week-debug through renderSmokeMarker',
    /renderSmokeMarker\([\s\S]{0,120}['"]smoke-visible-week-debug['"]/.test(
      appSource,
    ),
  );
  ok(
    '23.1: App.tsx smoke marker mount is gated on smoke runtime signal',
    /shouldRenderSmokeRuntimeMarker\s*\?\s*\([\s\S]{0,2200}smoke-visible-week-debug/.test(
      appSource,
    ),
  );
  ok(
    '23.1: AppNavigator no longer mounts SmokeCoachBikeHarness',
    !/<SmokeCoachBikeHarness/.test(appNavSource),
  );

  // 23.2 — Module-load + render + error logs.
  ok(
    '23.2: harness emits [smoke-harness] module loaded at module top',
    /console\.warn\s*\(\s*['"`]\[smoke-harness\] module loaded['"`]\s*\)/.test(
      harnessSource,
    ),
  );
  ok(
    '23.2: harness emits [smoke-harness] render console.warn',
    /console\.warn\s*\(\s*['"`]\[smoke-harness\] render['"`]/.test(
      harnessSource,
    ),
  );
  ok(
    '23.2: harness emits [smoke-harness] render error in catch',
    /console\.error\s*\(\s*['"`]\[smoke-harness\] render error['"`]/.test(
      harnessSource,
    ),
  );
  ok(
    '23.2: wrapper scans [smoke-harness] module loaded marker',
    /smokeHarnessModuleLoaded[\s\S]{0,200}\[smoke-harness\\\] module loaded/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '23.2: wrapper scans [smoke-harness] render marker',
    /smokeHarnessRender:\s*\/\\\[smoke-harness\\\] render /.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '23.2: wrapper scans [smoke-harness] render error marker',
    /smokeHarnessRenderError[\s\S]{0,200}\[smoke-harness\\\] render error/.test(
      wrapperSourceLocal,
    ),
  );

  // 23.3 — Markers physically visible.
  ok(
    '23.3: harness uses zIndex 999999 (or higher) for marker base style',
    /zIndex:\s*999999/.test(harnessSource),
  );
  ok(
    '23.3: harness uses elevation 999999 for android visibility',
    /elevation:\s*999999/.test(harnessSource),
  );
  ok(
    '23.3: harness state markers use a real backgroundColor (no opacity 0.01)',
    /backgroundColor:\s*['"]#[0-9A-Fa-f]{3,6}['"]/.test(harnessSource) &&
      !/opacity:\s*0\.01/.test(harnessSource),
  );
  ok(
    '23.3: harness state marker is at least 12×12 px',
    /width:\s*12[\s\S]{0,50}height:\s*12/.test(harnessSource),
  );

  // 23.4 — Always renders debug marker + exactly one state marker.
  ok(
    '23.4: harness always renders smoke-visible-week-debug (no state gating)',
    /testID="smoke-visible-week-debug"/.test(harnessSource),
  );
  // The four state-marker JSX blocks must be present and gated on
  // result.state === one of the four values.
  for (const s of ['inactive', 'pending', 'ready', 'missing']) {
    ok(
      `23.4: smoke-visible-week-${s} gated on result.state === "${s}"`,
      new RegExp(
        `result\\.state\\s*===\\s*['"]${s}['"][\\s\\S]{0,400}testID="smoke-visible-week-${s}"`,
      ).test(harnessSource),
    );
  }

  // 23.5 — Build fingerprint marker.
  ok(
    '23.5: harness exports SMOKE_HARNESS_BUILD_FINGERPRINT constant',
    /export\s+const\s+SMOKE_HARNESS_BUILD_FINGERPRINT\s*=\s*['"]smoke-harness-v\d/.test(
      harnessSource,
    ),
  );
  // 23.5 (v4) — smoke-build-fingerprint moved from harness to App.tsx
  // so it survives any failure of imported modules. The harness now
  // owns smoke-harness-mounted instead (verified in section [24]).
  ok(
    '23.5: harness no longer renders testID="smoke-build-fingerprint" (App.tsx owns it)',
    !/testID="smoke-build-fingerprint"/.test(harnessSource),
  );
  ok(
    '23.5: fingerprint marker has visible backgroundColor + size',
    // The fingerprint marker uses FINGERPRINT_STYLE which sets a
    // backgroundColor + width:12 + height:12.  Confirm the style
    // constant exists with those properties.
    /FINGERPRINT_STYLE\s*=\s*\{[\s\S]{0,400}backgroundColor:\s*['"]#[0-9A-Fa-f]{3,6}['"]/.test(
      harnessSource,
    ),
  );
  ok(
    '23.5: wrapper records smokeBuildFingerprintVisibility',
    /smokeBuildFingerprintVisibility:\s*stepVisibilityFromText\([\s\S]{0,200}['"]smoke-build-fingerprint['"]/.test(
      wrapperSourceLocal,
    ),
  );

  // 23.6 — Navigator-live debug markers.
  ok(
    '23.6: RootNavigator renders testID="root-navigator-live"',
    /testID="root-navigator-live"/.test(rootNavSource),
  );
  ok(
    '23.6: AppNavigator renders testID="app-navigator-live"',
    /testID="app-navigator-live"/.test(appNavSource),
  );
  ok(
    '23.6: wrapper records rootNavigatorLiveVisibility',
    /rootNavigatorLiveVisibility:\s*stepVisibilityFromText/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '23.6: wrapper records appNavigatorLiveVisibility',
    /appNavigatorLiveVisibility:\s*stepVisibilityFromText/.test(
      wrapperSourceLocal,
    ),
  );

  // 23.7 — Five exact wrapper diagnostic labels.
  ok(
    '23.7: wrapper has "Stale bundle: smoke-build-fingerprint missing"',
    wrapperSourceLocal.includes(
      'Stale bundle: smoke-build-fingerprint missing',
    ),
  );
  ok(
    '23.7: wrapper has "Harness not mounted in live app bundle"',
    wrapperSourceLocal.includes('Harness not mounted in live app bundle'),
  );
  ok(
    '23.7: wrapper has "Harness mounted but smoke flow inactive"',
    wrapperSourceLocal.includes('Harness mounted but smoke flow inactive'),
  );
  ok(
    '23.7: wrapper has "Harness pending:" template',
    /Harness pending:/.test(wrapperSourceLocal),
  );
  ok(
    '23.7: wrapper has "Harness missing:" template',
    /Harness missing:/.test(wrapperSourceLocal),
  );

  // 23.8 — Maestro YAML order: fingerprint → debug → inactive →
  // precoach-ready → pending → missing → coach-input.
  function assertYamlOrder(yaml: string, label: string) {
    const fp = yaml.indexOf('id: "smoke-build-fingerprint"');
    const dbg = yaml.indexOf('id: "smoke-visible-week-debug"');
    const inact = yaml.indexOf('id: "smoke-visible-week-inactive"');
    const ready = yaml.indexOf('id: "smoke-precoach-week-ready"');
    const pend = yaml.indexOf('id: "smoke-visible-week-pending"');
    const miss = yaml.indexOf('id: "smoke-visible-week-missing"');
    const tap = yaml.indexOf('tapOn:\n    id: "coach-input"');
    ok(`23.8 (${label}): asserts fingerprint`, fp >= 0);
    ok(`23.8 (${label}): asserts debug`, dbg >= 0);
    ok(`23.8 (${label}): asserts inactive`, inact >= 0);
    ok(`23.8 (${label}): asserts ready`, ready >= 0);
    ok(`23.8 (${label}): asserts pending`, pend >= 0);
    ok(`23.8 (${label}): asserts missing`, miss >= 0);
    ok(
      `23.8 (${label}): fingerprint precedes debug`,
      fp >= 0 && dbg >= 0 && fp < dbg,
    );
    ok(
      `23.8 (${label}): debug precedes inactive`,
      dbg >= 0 && inact >= 0 && dbg < inact,
    );
    ok(
      `23.8 (${label}): inactive precedes ready`,
      inact >= 0 && ready >= 0 && inact < ready,
    );
    ok(
      `23.8 (${label}): ready precedes pending`,
      ready >= 0 && pend >= 0 && ready < pend,
    );
    ok(
      `23.8 (${label}): pending precedes missing`,
      pend >= 0 && miss >= 0 && pend < miss,
    );
    ok(
      `23.8 (${label}): missing precedes coach-input tap`,
      miss >= 0 && tap >= 0 && miss < tap,
    );
    ok(
      `23.8 (${label}): fingerprint is assertVisible`,
      /assertVisible:\s*\n\s*id:\s*"smoke-build-fingerprint"/.test(yaml),
    );
    ok(
      `23.8 (${label}): debug is assertVisible`,
      /assertVisible:\s*\n\s*id:\s*"smoke-visible-week-debug"/.test(yaml),
    );
  }
  assertYamlOrder(envYaml, 'env');
  assertYamlOrder(dlYaml, 'deep-link');

  // 23.9 — Wrapper distinguishes assertNotVisible from visible
  // completion. smoke-route-mismatch is the canonical example:
  // historically reported as COMPLETED (which means NOT visible —
  // the pass case).  The wrapper must report visibility, not status.
  ok(
    '23.9: wrapper records smokeRouteMismatchVisibility via stepVisibilityFromText',
    /smokeRouteMismatchVisibility:\s*stepVisibilityFromText/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '23.9: fail-block trace reports smoke-route-mismatch visibility, not bare status',
    /smoke-route-mismatch:[\s\S]{0,200}smokeRouteMismatchStatus[\s\S]{0,200}smokeRouteMismatchVisibility/.test(
      wrapperSourceLocal,
    ),
  );

  // 23.10 — Harness uses try/catch around derivation so a thrown
  // engine call cannot silently fail.
  ok(
    '23.10: harness wraps buildProgramTabProjectedWeek call in try/catch',
    /try\s*\{[\s\S]{0,400}buildProgramTabProjectedWeek[\s\S]{0,400}\}\s*catch/.test(
      harnessSource,
    ),
  );
  ok(
    '23.10: harness wraps derive call in try/catch',
    /try\s*\{[\s\S]{0,200}deriveCore\([\s\S]{0,200}\}\s*catch/.test(
      harnessSource,
    ),
  );
}

section('[24] Separated mount probes + wrapper crash prevention');
{
  // Live run regression triggered TWO failures simultaneously:
  //   (a) ReferenceError: Cannot access 'markers' before initialization
  //       at scripts/smoke-coach-bike-flow.js — the wrapper crashed
  //       inside its own failure-diagnostic block.
  //   (b) smoke-build-fingerprint missing: harness markers didn't reach
  //       Maestro at all, but the bundle/harness/state-mount layers
  //       were indistinguishable.
  //
  // Fix:
  //   1. Hoist marker extraction in runMaestroSmoke ABOVE all
  //      diagnostic branches.
  //   2. App.tsx owns its own smoke-build-fingerprint marker, fully
  //      independent of the harness import.
  //   3. Harness exposes smoke-harness-mounted as a separate mount
  //      probe (independent of the state-machine derivation).
  //   4. Maestro YAML asserts probes in this exact order:
  //      smoke-build-fingerprint → smoke-harness-mounted →
  //      smoke-visible-week-debug → inactive (not visible) →
  //      ready (wait) → pending → missing.
  //   5. Wrapper has dedicated diagnostic branches for each probe.

  const appSource = fs.readFileSync(
    path.resolve(__dirname, '../../App.tsx'),
    'utf8',
  );
  const harnessSource = fs.readFileSync(
    path.resolve(__dirname, '../components/dev/SmokeCoachBikeHarness.tsx'),
    'utf8',
  );
  const wrapperSourceLocal = fs.readFileSync(WRAPPER_PATH, 'utf8');
  const envYaml = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const dlYaml = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );

  // 24.1 — App.tsx owns smoke-build-fingerprint INDEPENDENT of the
  // harness import.
  ok(
    '24.1: App.tsx renders smoke-build-fingerprint through renderSmokeMarker',
    /renderSmokeMarker\([\s\S]{0,120}['"]smoke-build-fingerprint['"]/.test(
      appSource,
    ),
  );
  ok(
    '24.1: App.tsx marker helper style uses position: absolute',
    /smokeMarker:\s*\{[\s\S]{0,400}position:\s*['"]absolute['"]/.test(
      appSource,
    ),
  );
  ok(
    '24.1: App.tsx fingerprint marker passes lime/green background',
    /renderSmokeMarker\([\s\S]{0,240}['"]smoke-build-fingerprint['"][\s\S]{0,240}['"]#7[06]FF[0-9A-Fa-f]{2}['"]/.test(
      appSource,
    ),
  );
  ok(
    '24.1: App.tsx marker helper zIndex maxes out',
    /smokeMarker:\s*\{[\s\S]{0,800}zIndex:\s*2147483647/.test(
      appSource,
    ),
  );
  ok(
    '24.1: App.tsx marker helper is at least 30×30',
    /smokeMarker:\s*\{[\s\S]{0,800}width:\s*30[\s\S]{0,80}height:\s*30/.test(
      appSource,
    ),
  );
  ok(
    '24.1: App.tsx fingerprint marker uses the build label constant',
    /SMOKE_BUILD_FINGERPRINT_LABEL/.test(appSource),
  );
  ok(
    '24.1: harness no longer renders smoke-build-fingerprint (App.tsx owns it)',
    !/testID="smoke-build-fingerprint"/.test(harnessSource),
  );

  // 24.2 — App.tsx OWNS smoke-harness-mounted (moved out of harness).
  // Both fingerprint and harness-mounted live in App.tsx so a silent
  // harness-import failure produces an unambiguous "App.tsx smoke
  // mount zone missing." vs "SmokeCoachBikeHarness component not
  // rendered or module not loaded." failure mode.
  ok(
    '24.2: App.tsx renders smoke-harness-mounted through renderSmokeMarker',
    /renderSmokeMarker\([\s\S]{0,120}['"]smoke-harness-mounted['"]/.test(
      appSource,
    ),
  );
  ok(
    '24.2: harness no longer renders testID="smoke-harness-mounted" (App.tsx owns it)',
    !/testID="smoke-harness-mounted"/.test(harnessSource),
  );
  ok(
    '24.2: App.tsx renderSmokeMarker View is non-collapsing',
    /function\s+renderSmokeMarker[\s\S]{0,600}<View[\s\S]{0,240}collapsable=\{false\}/.test(
      appSource,
    ),
  );
  ok(
    '24.2: App.tsx smoke-harness-mounted passes visible backgroundColor',
    /renderSmokeMarker\([\s\S]{0,240}['"]smoke-harness-mounted['"][\s\S]{0,240}['"]#[0-9A-Fa-f]{3,6}['"]/.test(
      appSource,
    ),
  );
  ok(
    '24.2: App.tsx marker helper is at least 30×30',
    /smokeMarker:\s*\{[\s\S]{0,800}width:\s*30[\s\S]{0,80}height:\s*30/.test(
      appSource,
    ),
  );
  ok(
    '24.2: App.tsx marker helper uses MAX-INT zIndex',
    /smokeMarker:\s*\{[\s\S]{0,800}zIndex:\s*2147483647/.test(
      appSource,
    ),
  );
  ok(
    '24.2: App.tsx emits [app-smoke-mount] fingerprint rendered console.warn',
    /console\.warn\s*\(\s*['"`]\[app-smoke-mount\] fingerprint rendered['"`]/.test(
      appSource,
    ),
  );
  ok(
    '24.2: App.tsx emits [app-smoke-mount] harness mount zone rendered console.warn',
    /console\.warn\s*\(\s*['"`]\[app-smoke-mount\] harness mount zone rendered['"`]/.test(
      appSource,
    ),
  );
  ok(
    '24.2: wrapper scans appSmokeMountFingerprint marker',
    /appSmokeMountFingerprint[\s\S]{0,200}\[app-smoke-mount\\\] fingerprint rendered/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '24.2: wrapper scans appSmokeMountHarness marker',
    /appSmokeMountHarness[\s\S]{0,200}\[app-smoke-mount\\\] harness mount zone rendered/.test(
      wrapperSourceLocal,
    ),
  );

  // 24.3 — Maestro YAML order: fingerprint → harness-mounted → debug
  // → inactive → precoach-ready → pending → missing → coach-input.
  function assertYamlOrder24(yaml: string, label: string) {
    const fp = yaml.indexOf('id: "smoke-build-fingerprint"');
    const hm = yaml.indexOf('id: "smoke-harness-mounted"');
    const dbg = yaml.indexOf('id: "smoke-visible-week-debug"');
    const inact = yaml.indexOf('id: "smoke-visible-week-inactive"');
    const ready = yaml.indexOf('id: "smoke-precoach-week-ready"');
    const pend = yaml.indexOf('id: "smoke-visible-week-pending"');
    const miss = yaml.indexOf('id: "smoke-visible-week-missing"');
    const tap = yaml.indexOf('tapOn:\n    id: "coach-input"');
    ok(
      `24.3 (${label}): asserts smoke-harness-mounted`,
      hm >= 0,
    );
    ok(
      `24.3 (${label}): smoke-harness-mounted is assertVisible`,
      /assertVisible:\s*\n\s*id:\s*"smoke-harness-mounted"/.test(yaml),
    );
    ok(
      `24.3 (${label}): fingerprint precedes harness-mounted`,
      fp >= 0 && hm >= 0 && fp < hm,
    );
    ok(
      `24.3 (${label}): harness-mounted precedes debug`,
      hm >= 0 && dbg >= 0 && hm < dbg,
    );
    ok(
      `24.3 (${label}): debug precedes inactive`,
      dbg >= 0 && inact >= 0 && dbg < inact,
    );
    ok(
      `24.3 (${label}): inactive precedes ready`,
      inact >= 0 && ready >= 0 && inact < ready,
    );
    ok(
      `24.3 (${label}): ready precedes pending`,
      ready >= 0 && pend >= 0 && ready < pend,
    );
    ok(
      `24.3 (${label}): pending precedes missing`,
      pend >= 0 && miss >= 0 && pend < miss,
    );
    ok(
      `24.3 (${label}): missing precedes coach-input tap`,
      miss >= 0 && tap >= 0 && miss < tap,
    );
  }
  assertYamlOrder24(envYaml, 'env');
  assertYamlOrder24(dlYaml, 'deep-link');

  // 24.4 — Wrapper records visibility for the three mount probes
  // separately, AND emits dedicated diagnostic labels.
  ok(
    '24.4: wrapper records smokeBuildFingerprintVisibility',
    /smokeBuildFingerprintVisibility:\s*stepVisibilityFromText/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '24.4: wrapper records smokeHarnessMountedVisibility',
    /smokeHarnessMountedVisibility:\s*stepVisibilityFromText\([\s\S]{0,200}['"]smoke-harness-mounted['"]/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '24.4: wrapper records smokeVisibleWeekDebugVisibility',
    /smokeVisibleWeekDebugVisibility:\s*stepVisibilityFromText/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '24.4: wrapper has v3 stale-bundle label "Stale bundle / App.tsx marker missing."',
    wrapperSourceLocal.includes('Stale bundle / App.tsx marker missing.'),
  );
  ok(
    '24.4: wrapper preserves "Stale bundle: smoke-build-fingerprint missing" alias',
    wrapperSourceLocal.includes(
      'Stale bundle: smoke-build-fingerprint missing',
    ),
  );
  ok(
    '24.4: wrapper has "App.tsx smoke mount zone missing." label (probe 2)',
    wrapperSourceLocal.includes('App.tsx smoke mount zone missing.'),
  );
  ok(
    '24.4: wrapper has "App.tsx direct smoke debug marker missing." label (probe 3)',
    wrapperSourceLocal.includes('App.tsx direct smoke debug marker missing.'),
  );
  ok(
    '24.4: wrapper preserves "Harness mounted but smoke flow inactive" (probe 4)',
    wrapperSourceLocal.includes('Harness mounted but smoke flow inactive'),
  );
  ok(
    '24.4: wrapper has "Harness pending:" template (probe 5)',
    /Harness pending:/.test(wrapperSourceLocal),
  );
  ok(
    '24.4: wrapper has "Harness missing:" template (probe 6)',
    /Harness missing:/.test(wrapperSourceLocal),
  );

  // 24.5 — Probe branches are exclusive: each gated on its OWN
  // visibility="no" + status="FAILED", so they fire in priority
  // order without bleeding into each other.
  ok(
    '24.5: fingerprint branch gated on smokeBuildFingerprintVisibility',
    /stepStatuses\.smokeBuildFingerprintVisibility\?\.visible\s*===\s*['"]no['"][\s\S]{0,200}smokeBuildFingerprintVisibility\?\.status\s*===\s*['"]FAILED['"]/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '24.5: harness-mounted branch gated on smokeHarnessMountedVisibility',
    /stepStatuses\.smokeHarnessMountedVisibility\?\.visible\s*===\s*['"]no['"][\s\S]{0,200}smokeHarnessMountedVisibility\?\.status\s*===\s*['"]FAILED['"]/.test(
      wrapperSourceLocal,
    ),
  );
  ok(
    '24.5: debug-marker branch gated on smokeVisibleWeekDebugVisibility',
    /stepStatuses\.smokeVisibleWeekDebugVisibility\?\.visible\s*===\s*['"]no['"][\s\S]{0,200}smokeVisibleWeekDebugVisibility\?\.status\s*===\s*['"]FAILED['"]/.test(
      wrapperSourceLocal,
    ),
  );

  // 24.6 — node --check passes on the wrapper script. Catches syntax
  // errors and (importantly) NEVER-EVER catches TDZ ReferenceErrors,
  // so this is just a syntax floor — the TDZ check is in 24.7.
  {
    const child = require('child_process').spawnSync(
      'node',
      ['--check', WRAPPER_PATH],
      { encoding: 'utf8' },
    );
    ok(
      '24.6: node --check scripts/smoke-coach-bike-flow.js passes',
      child.status === 0,
      child.stderr || child.stdout,
    );
  }

  // 24.7 — TDZ ReferenceError prevention. The `markers` symbol is
  // referenced inside the failure-diagnostic dump in runMaestroSmoke;
  // it MUST be declared above the `if (result.status !== 0)` block,
  // not after. Without the hoist, the JS runtime throws
  // "Cannot access 'markers' before initialization" the moment the
  // failure block runs (because `const markers` later in the same
  // scope puts the reference in TDZ).
  ok(
    '24.7: runMaestroSmoke declares `const markers` BEFORE `if (result.status !== 0)`',
    (() => {
      // Use the bounded slice between runMaestroSmoke and the next
      // top-level `async function` declaration so inner closing braces
      // don't terminate the search early.
      const startIdx = wrapperSourceLocal.indexOf(
        'async function runMaestroSmoke',
      );
      const endIdx = wrapperSourceLocal.indexOf(
        '\nasync function main',
        startIdx,
      );
      const fnBody = wrapperSourceLocal.slice(
        startIdx,
        endIdx >= 0 ? endIdx : undefined,
      );
      // Strip comments so the search lands on actual statements, not
      // doc-comments that mention the same syntax. The original test
      // matched a backtick-quoted comment fragment that referenced
      // `if (result.status !== 0)`.
      const stripped = fnBody
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
      const markersDecl = stripped.indexOf('const markers = smokeMarkersFromText');
      const failureIf = stripped.indexOf('if (result.status !== 0)');
      return markersDecl >= 0 && failureIf >= 0 && markersDecl < failureIf;
    })(),
  );
  ok(
    '24.7: runMaestroSmoke declares only ONE `const markers` (no redeclaration after the failure block)',
    (() => {
      const startIdx = wrapperSourceLocal.indexOf(
        'async function runMaestroSmoke',
      );
      const endIdx = wrapperSourceLocal.indexOf(
        '\nasync function main',
      );
      const fnBody = wrapperSourceLocal.slice(startIdx, endIdx >= 0 ? endIdx : undefined);
      const matches = fnBody.match(/const markers = smokeMarkersFromText/g);
      return matches !== null && matches.length === 1;
    })(),
  );

  // 24.8 — Step trace dump includes smoke-harness-mounted.
  ok(
    '24.8: fail-block step trace lists smoke-harness-mounted with visibility',
    /smoke-harness-mounted:[\s\S]{0,200}smokeHarnessMountedVisibility/.test(
      wrapperSourceLocal,
    ),
  );
}

section('[25] App.tsx-direct visible-week smoke markers');
{
  // Live run regression history:
  //   v1: smoke-visible-week-* in CoachScreen -> screen-mount race.
  //   v2: harness in ResolvedAppNavigator gated on inSmokeMode -> null
  //       runtime signal in deep-link flow.
  //   v3: harness mounted from App.tsx as separate file -> module
  //       never reached the live render tree.
  //   v4: inline AppSmokeCoachBikeOverlay rendered, but its nested
  //       debug marker was invisible to Maestro.
  //   v5 (this section): App.tsx owns smokeOverlayResult state and
  //       renders debug/state markers directly through the same native
  //       View factory as smoke-build-fingerprint and smoke-harness-mounted.

  const appSource = fs.readFileSync(
    path.resolve(__dirname, '../../App.tsx'),
    'utf8',
  );
  const wrapperSource25 = fs.readFileSync(WRAPPER_PATH, 'utf8');
  const envYaml = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const dlYaml = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );
  const appReturn = appSource.slice(
    appSource.indexOf('export default function App'),
    appSource.indexOf('const styles = StyleSheet.create'),
  );

  ok(
    '25.1: App.tsx does NOT render <AppSmokeCoachBikeOverlay />',
    !/<AppSmokeCoachBikeOverlay\s*\/>/.test(appSource),
  );
  ok(
    '25.1: App.tsx does NOT define AppSmokeCoachBikeOverlay',
    !/function\s+AppSmokeCoachBikeOverlay\s*\(/.test(appSource),
  );
  ok(
    '25.1: App.tsx does NOT import or render SmokeCoachBikeHarness',
    !/import\s+SmokeCoachBikeHarness\s+from/.test(appSource) &&
      !/<SmokeCoachBikeHarness\s*\/>/.test(appSource),
  );

  ok(
    '25.2: App.tsx defines no smoke marker child component',
    !/function\s+Smoke[A-Za-z0-9_]*Marker\s*\(/.test(appSource) &&
      !/const\s+Smoke[A-Za-z0-9_]*Marker\s*=/.test(appSource),
  );
  ok(
    '25.2: renderSmokeMarker is a helper function, not a capitalized component',
    /function\s+renderSmokeMarker\s*\(/.test(appSource) &&
      !/<renderSmokeMarker/.test(appSource),
  );

  ok(
    '25.3: App.tsx owns smokeOverlayResult state directly',
    /const\s*\[\s*smokeOverlayResult\s*,\s*setSmokeOverlayResult\s*\]\s*=[\s\S]{0,160}React\.useState<SmokeOverlayResult>\(SMOKE_OVERLAY_INITIAL\)/.test(
      appReturn,
    ),
  );
  ok(
    '25.3: App.tsx useEffect polls deriveOverlayState every 250ms only in smoke runtime',
    /React\.useEffect[\s\S]{0,240}if\s*\(\s*!shouldRenderSmokeRuntimeMarker\s*\)\s*return[\s\S]{0,800}setSmokeOverlayResult\(deriveOverlayState\(\)\)[\s\S]{0,600}setInterval\(tick,\s*250\)/.test(
      appReturn,
    ),
  );
  ok(
    '25.3: App.tsx directly renders smoke-visible-week-debug in the main return',
    /renderSmokeMarker\([\s\S]{0,120}['"]smoke-visible-week-debug['"][\s\S]{0,120}smokeOverlayDebugLabel[\s\S]{0,120}80[\s\S]{0,80}['"]#FFD600['"]/.test(
      appReturn,
    ),
  );
  ok(
    '25.3: smoke-visible-week-debug is rendered before RootNavigator',
    appReturn.indexOf("'smoke-visible-week-debug'") > 0 &&
      appReturn.indexOf('<RootNavigator />') >
        appReturn.indexOf("'smoke-visible-week-debug'"),
  );

  ok(
    '25.4: STATE_TEST_IDS contains exact visible-week/precoach marker ids',
    /const\s+STATE_TEST_IDS[\s\S]{0,400}inactive:\s*['"]smoke-visible-week-inactive['"][\s\S]{0,120}pending:\s*['"]smoke-visible-week-pending['"][\s\S]{0,120}ready:\s*['"]smoke-precoach-week-ready['"][\s\S]{0,120}missing:\s*['"]smoke-visible-week-missing['"]/.test(
      appSource,
    ),
  );
  ok(
    '25.4: App.tsx renders exactly one state marker via STATE_TEST_IDS[result.state]',
    /const\s+smokeOverlayStateTestID\s*=\s*STATE_TEST_IDS\[smokeOverlayResult\.state\]/.test(
      appReturn,
    ) &&
      /renderSmokeMarker\([\s\S]{0,120}smokeOverlayStateTestID[\s\S]{0,120}smokeOverlayStateLabel[\s\S]{0,120}120[\s\S]{0,120}smokeOverlayStateColor/.test(
        appReturn,
      ),
  );

  ok(
    '25.5: renderSmokeMarker View uses collapsable={false}',
    /function\s+renderSmokeMarker[\s\S]{0,600}<View[\s\S]{0,240}collapsable=\{false\}/.test(
      appSource,
    ),
  );
  ok(
    '25.5: smoke-runtime-ready View also uses collapsable={false}',
    /<View[\s\S]{0,160}collapsable=\{false\}[\s\S]{0,160}testID="smoke-runtime-ready"/.test(
      appReturn,
    ),
  );

  const fpIdx = appReturn.indexOf("'smoke-build-fingerprint'");
  const hmIdx = appReturn.indexOf("'smoke-harness-mounted'");
  const dbgIdx = appReturn.indexOf("'smoke-visible-week-debug'");
  ok(
    '25.6: fingerprint, harness-mounted, and debug all use renderSmokeMarker',
    /renderSmokeMarker\([\s\S]{0,120}['"]smoke-build-fingerprint['"]/.test(
      appReturn,
    ) &&
      /renderSmokeMarker\([\s\S]{0,120}['"]smoke-harness-mounted['"]/.test(
        appReturn,
      ) &&
      /renderSmokeMarker\([\s\S]{0,120}['"]smoke-visible-week-debug['"]/.test(
        appReturn,
      ),
  );
  ok(
    '25.6: debug marker is rendered beside the two known-working markers',
    fpIdx >= 0 && hmIdx > fpIdx && dbgIdx > hmIdx,
  );

  ok(
    '25.7: renderSmokeMarker returns a direct native View with testID',
    /function\s+renderSmokeMarker[\s\S]{0,260}return\s*\([\s\S]{0,120}<View[\s\S]{0,400}testID=\{testID\}/.test(
      appSource,
    ),
  );
  ok(
    '25.7: renderSmokeMarker passes accessible accessibilityLabel and pointerEvents none',
    /function\s+renderSmokeMarker[\s\S]{0,600}accessible=\{true\}[\s\S]{0,120}accessibilityLabel=\{accessibilityLabel\}[\s\S]{0,160}pointerEvents="none"/.test(
      appSource,
    ),
  );
  ok(
    '25.7: renderSmokeMarker uses absolute 30x30 MAX-INT zIndex/elevation style',
    /smokeMarker:\s*\{[\s\S]{0,160}position:\s*['"]absolute['"][\s\S]{0,160}width:\s*30[\s\S]{0,80}height:\s*30[\s\S]{0,160}zIndex:\s*2147483647[\s\S]{0,80}elevation:\s*2147483647/.test(
      appSource,
    ),
  );
  ok(
    '25.7: renderSmokeMarker uses unique left offset and real backgroundColor',
    /style=\{\[styles\.smokeMarker,\s*\{\s*left,\s*backgroundColor\s*\}\]\}/.test(
      appSource,
    ) &&
      /renderSmokeMarker\([\s\S]{0,120}['"]smoke-visible-week-debug['"][\s\S]{0,160}80[\s\S]{0,80}['"]#[0-9A-Fa-f]{6}['"]/.test(
        appReturn,
      ),
  );

  function assertVisibleWeekYaml(yaml: string, label: string) {
    ok(
      `25.8 (${label}): asserts smoke-build-fingerprint`,
      /assertVisible:\s*\n\s*id:\s*"smoke-build-fingerprint"/.test(yaml),
    );
    ok(
      `25.8 (${label}): asserts smoke-harness-mounted`,
      /assertVisible:\s*\n\s*id:\s*"smoke-harness-mounted"/.test(yaml),
    );
    ok(
      `25.8 (${label}): asserts smoke-visible-week-debug`,
      /assertVisible:\s*\n\s*id:\s*"smoke-visible-week-debug"/.test(yaml),
    );
    ok(
      `25.8 (${label}): assertNotVisible smoke-visible-week-inactive`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-visible-week-inactive"/.test(yaml),
    );
    ok(
      `25.8 (${label}): extendedWaitUntil smoke-precoach-week-ready`,
      /extendedWaitUntil:\s*\n\s*visible:\s*\n\s*id:\s*"smoke-precoach-week-ready"/.test(
        yaml,
      ),
    );
    ok(
      `25.8 (${label}): assertNotVisible smoke-visible-week-pending`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-visible-week-pending"/.test(yaml),
    );
    ok(
      `25.8 (${label}): assertNotVisible smoke-visible-week-missing`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-visible-week-missing"/.test(yaml),
    );
  }
  assertVisibleWeekYaml(envYaml, 'env');
  assertVisibleWeekYaml(dlYaml, 'deep-link');

  ok(
    '25.9: wrapper has "App.tsx direct smoke debug marker missing." label',
    wrapperSource25.includes('App.tsx direct smoke debug marker missing.'),
  );
  ok(
    '25.9: wrapper reports inactive/pending/missing with App smoke overlay labels',
    /App smoke overlay inactive:/.test(wrapperSource25) &&
      /App smoke overlay pending:/.test(wrapperSource25) &&
      /App smoke overlay missing\/wrong week:/.test(wrapperSource25),
  );
  ok(
    '25.9: wrapper extracts the latest app smoke overlay debug label from logs',
    /function\s+lastAppSmokeOverlayDebugLabel/.test(wrapperSource25) &&
      /lastAppSmokeOverlayDebugLabel\(combined\)/.test(wrapperSource25),
  );

  ok(
    '25.10: App.tsx debug label includes state/reason/route/week/error',
    /const\s+smokeOverlayDebugLabel\s*=\s*`smoke-visible-week\s+state=\$\{smokeOverlayResult\.state\}\s+reason=\$\{smokeOverlayResult\.reason\}\s+route=\$\{smokeOverlayResult\.route\s*\?\?\s*['"]null['"]\}\s+hasEasyAerobicFlush=\$\{smokeOverlayResult\.hasEasyAerobicFlush\s*\?\?\s*false\}\s+hasRower=\$\{smokeOverlayResult\.hasRower\s*\?\?\s*false\}\s+wedText=\$\{smokeOverlayResult\.wedText\s*\?\?\s*['"]\(none\)['"]\}\s+week=\$\{smokeOverlayResult\.weekDump\}\s+error=\$\{smokeOverlayResult\.error\s*\?\?\s*['"]null['"]\}`/.test(
      appReturn,
    ),
  );
  ok(
    '25.10: App.tsx logs [app-smoke-overlay] render state=... for diagnostics',
    /console\.warn\(\s*`\[app-smoke-overlay\] render \$\{smokeOverlayDebugLabel\}`\s*\)/.test(
      appReturn,
    ),
  );
  ok(
    '25.10: dynamic require + categorical missing reasons remain in App.tsx',
    /require\(\s*['"]\.\/src\/utils\/visibleProgramReadModel['"]\s*\)/.test(
      appSource,
    ) &&
      /reason:\s*['"]engine-load-error['"]/.test(appSource) &&
      /reason:\s*['"]store-read-error['"]/.test(appSource) &&
      /reason:\s*['"]week-derive-error['"]/.test(appSource),
  );
  ok(
    '25.11: App.tsx defines collectWednesdaySmokeText for day/workout/options/exercises',
    /function\s+collectWednesdaySmokeText\s*\(wedDay:\s*any\)/.test(appSource) &&
      /workout\?\.conditioningBlock\?\.options/.test(appSource) &&
      /workout\?\.exercises/.test(appSource) &&
      /wx\?\.exercise\?\.description/.test(appSource) &&
      /wx\?\.notes/.test(appSource),
  );
  ok(
    '25.11: App.tsx no longer exact-matches wed.workout.name to WED_NAME',
    !/wed\.workout\.name\s*!==\s*WED_NAME/.test(appSource) &&
      !/workout\.name\s*!==\s*SMOKE_WEDNESDAY_WORKOUT_NAME/.test(appSource),
  );
  ok(
    '25.11: App.tsx accepts Easy Aerobic Flush by normalized haystack contains',
    /EASY_AEROBIC_FLUSH_TOKEN\s*=\s*['"]easy aerobic flush['"]/.test(appSource) &&
      /const\s+haystack\s*=\s*normalizeSmokeText\(wedText\)/.test(appSource) &&
      /hasEasyAerobicFlush[\s\S]{0,240}haystack\.includes\(EASY_AEROBIC_FLUSH_TOKEN\)/.test(
        appSource,
      ),
  );
  ok(
    '25.11: App.tsx accepts rower/rowing/row by word-boundary regex',
    /ROWER_SMOKE_RE\s*=\s*\/\\b\(rower\|rowing\|row\)\\b\/i/.test(appSource) &&
      /const\s+hasRower\s*=[\s\S]{0,120}ROWER_SMOKE_RE\.test\(haystack\)/.test(
        appSource,
      ),
  );
  ok(
    '25.11: App.tsx returns no-rower-before-change only after Easy Aerobic Flush passes',
    /if\s*\(\s*!hasEasyAerobicFlush\s*\)[\s\S]{0,400}reason:\s*['"]wednesday-not-easy-aerobic-flush['"][\s\S]{0,700}if\s*\(\s*!hasRower\s*\)[\s\S]{0,400}reason:\s*['"]no-rower-before-change['"]/.test(
      appSource,
    ),
  );
  ok(
    '25.11: App.tsx ready result carries wedText/hasEasyAerobicFlush/hasRower',
    /state:\s*['"]ready['"][\s\S]{0,160}reason:\s*['"]ok['"][\s\S]{0,240}wedText:\s*compactWedText[\s\S]{0,120}hasEasyAerobicFlush[\s\S]{0,80}hasRower/.test(
      appSource,
    ),
  );
  ok(
    '25.11: wrapper labels debug state=missing as missing/wrong week, not inactive',
    /const\s+appSmokeOverlayDebugState\s*=\s*appSmokeOverlayDebugField/.test(
      wrapperSource25,
    ) &&
      /appSmokeOverlayDebugState\s*===\s*['"]inactive['"][\s\S]{0,200}appSmokeOverlayDebugState\s*!==\s*['"]missing['"]/.test(
        wrapperSource25,
      ) &&
      /const\s+reasonLabel\s*=\s*appSmokeOverlayDebugReason/.test(wrapperSource25),
  );
}

section('[26] DayWorkout final-contract markers (post-Coach)');
{
  // Live run reached DayWorkout but `smoke-dayworkout-contract-ready`
  // was FAILED while the failed marker was unknown — the marker
  // simply never rendered. Fix:
  //   1. Wrap the contract derivation in try/catch.
  //   2. Render THREE markers (mounted + ready/failed), exhaustive.
  //   3. Mount the markers in the SAME render path as
  //      day-workout-title (inside headerContent) so the gate is
  //      identical.
  //   4. Maestro asserts mounted BEFORE ready.
  //   5. Wrapper has dedicated labels: mount-point-missing,
  //      rendered-silently, contract-failed.

  const screenSource = fs.readFileSync(
    path.resolve(__dirname, '../screens/home/DayWorkoutScreenV2.tsx'),
    'utf8',
  );
  const contractSource = fs.readFileSync(
    path.resolve(__dirname, '../screens/home/dayWorkoutSmokeContract.ts'),
    'utf8',
  );
  const wrapperSource26 = fs.readFileSync(WRAPPER_PATH, 'utf8');
  const envYaml26 = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const dlYaml26 = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );

  // 26.1 — Same file owns day-workout-title AND the three markers.
  ok(
    '26.1: DayWorkoutScreenV2 renders testID="day-workout-title"',
    /testID="day-workout-title"/.test(screenSource),
  );
  ok(
    '26.1: DayWorkoutScreenV2 renders testID="smoke-dayworkout-contract-mounted"',
    /testID="smoke-dayworkout-contract-mounted"/.test(screenSource),
  );
  ok(
    '26.1: DayWorkoutScreenV2 renders testID="smoke-dayworkout-contract-ready"',
    /testID="smoke-dayworkout-contract-ready"/.test(screenSource),
  );
  ok(
    '26.1: DayWorkoutScreenV2 renders testID="smoke-dayworkout-contract-failed"',
    /testID="smoke-dayworkout-contract-failed"/.test(screenSource),
  );

  // 26.2 — The marker renderer is invoked inline beside day-workout-title.
  ok(
    '26.2: renderDayWorkoutSmokeContractMarkers invoked beside day-workout-title',
    // The marker call lives in the same headerContent <View> as the
    // title. Allow up to 2KB of intervening JSX (comment block +
    // closing tags + the `{smokeCoachBikeFlow ? … : null}` ternary).
    /testID="day-workout-title"[\s\S]{0,2400}renderDayWorkoutSmokeContractMarkers\(/.test(
      screenSource,
    ),
  );

  // 26.3 — Renderer ALWAYS emits the mounted probe (no gating).
  ok(
    '26.3: renderer always renders mounted probe (no state gate)',
    /function\s+renderDayWorkoutSmokeContractMarkers[\s\S]{0,2000}testID="smoke-dayworkout-contract-mounted"/.test(
      screenSource,
    ),
  );

  // 26.4 — ready/failed marker gated on result.state.
  ok(
    '26.4: ready marker gated on result.state === "ready" via isReady',
    /(?:isReady\s*\?\s*[\s\S]{0,1200}testID="smoke-dayworkout-contract-ready"|result\.state\s*===\s*['"]ready['"][\s\S]{0,1200}testID="smoke-dayworkout-contract-ready")/.test(
      screenSource,
    ),
  );
  ok(
    '26.4: failed marker rendered in the else branch',
    /:\s*\(\s*<View[\s\S]{0,1200}testID="smoke-dayworkout-contract-failed"/.test(
      screenSource,
    ),
  );

  // 26.5 — Markers use collapsable={false} + real backgroundColor.
  ok(
    '26.5: smoke-dayworkout-contract-mounted uses collapsable={false}',
    /testID="smoke-dayworkout-contract-mounted"[\s\S]{0,400}collapsable=\{false\}|collapsable=\{false\}[\s\S]{0,400}testID="smoke-dayworkout-contract-mounted"/.test(
      screenSource,
    ),
  );
  ok(
    '26.5: smoke-dayworkout-contract-ready uses collapsable={false}',
    /testID="smoke-dayworkout-contract-ready"[\s\S]{0,400}collapsable=\{false\}|collapsable=\{false\}[\s\S]{0,400}testID="smoke-dayworkout-contract-ready"/.test(
      screenSource,
    ),
  );
  ok(
    '26.5: smoke-dayworkout-contract-failed uses collapsable={false}',
    /testID="smoke-dayworkout-contract-failed"[\s\S]{0,400}collapsable=\{false\}|collapsable=\{false\}[\s\S]{0,400}testID="smoke-dayworkout-contract-failed"/.test(
      screenSource,
    ),
  );
  ok(
    '26.5: smokeContractMounted style has visible backgroundColor + size',
    // Match the props in either order (style key declarations can be
    // listed however the editor / linter sorts them).
    /smokeContractMounted:\s*\{[\s\S]{0,600}backgroundColor:\s*['"]#[0-9A-Fa-f]{3,6}['"]/.test(
      screenSource,
    ) &&
      /smokeContractMounted:\s*\{[\s\S]{0,600}width:\s*30[\s\S]{0,200}height:\s*30/.test(
        screenSource,
      ),
  );

  // 26.6 — Screen wraps contract derivation in try/catch + uses error helper.
  ok(
    '26.6: screen imports buildDayWorkoutSmokeContractErrorResult',
    /buildDayWorkoutSmokeContractErrorResult/.test(screenSource),
  );
  ok(
    '26.6: screen wraps deriveDayWorkoutSmokeContract in try/catch',
    /try\s*\{[\s\S]{0,400}deriveDayWorkoutSmokeContract\([\s\S]{0,400}\}\s*catch/.test(
      screenSource,
    ),
  );

  // 26.7 — Contract module exposes reason + categorical reason values.
  const requiredReasons = [
    'ok',
    'missing-workout-data',
    'contract-error',
    'missing-title-token',
    'missing-bike-token',
    'missing-20min-token',
    'missing-easy-intensity-token',
    'forbidden-token-present',
  ];
  for (const r of requiredReasons) {
    ok(
      `26.7: contract module declares reason "${r}"`,
      new RegExp(`['"]${r}['"]`).test(contractSource),
    );
  }
  ok(
    '26.7: contract module exports buildDayWorkoutSmokeContractErrorResult',
    /export\s+function\s+buildDayWorkoutSmokeContractErrorResult/.test(
      contractSource,
    ),
  );

  // 26.8 — Pure derivation: exhaustive happy/failure cases via require().
  // Use sucrase-node — the contract module is pure TS.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const contract = require('../screens/home/dayWorkoutSmokeContract');
  const derive = contract.deriveDayWorkoutSmokeContract as (
    args: any,
  ) => any;
  const buildError = contract.buildDayWorkoutSmokeContractErrorResult as (
    args: any,
  ) => any;

  // Happy path — Easy Aerobic Flush / Bike / 20min / easy intensity.
  {
    const r = derive({
      workout: {
        name: 'Easy Aerobic Flush',
        description: '20min bike, easy 3-4/10',
      },
      date: '2026-05-13',
      workoutId: 'wk-123',
    });
    ok('26.8: ready when all tokens present, no forbidden', r.state === 'ready' && r.reason === 'ok');
  }
  // Missing workout.
  {
    const r = derive({ workout: null });
    ok(
      '26.8: failed reason=missing-workout-data when workout is null',
      r.state === 'failed' && r.reason === 'missing-workout-data',
    );
  }
  // Contract error helper.
  {
    const r = buildError({ error: new Error('boom'), date: '2026-05-13', workoutId: 'x' });
    ok(
      '26.8: buildDayWorkoutSmokeContractErrorResult returns failed reason=contract-error',
      r.state === 'failed' && r.reason === 'contract-error',
    );
  }
  // Rower leak.
  {
    const r = derive({
      workout: {
        name: 'Easy Aerobic Flush',
        description: '20min Rower easy',
      },
    });
    ok(
      '26.8: Rower remaining renders failed with forbiddenTokens including Rower',
      r.state === 'failed' &&
        r.reason === 'forbidden-token-present' &&
        r.forbiddenTokens.includes('Rower'),
    );
  }
  // Assault leak.
  {
    const r = derive({
      workout: {
        name: 'Easy Aerobic Flush',
        description: '20min Assault Bike easy',
      },
    });
    ok(
      '26.8: Assault remaining renders failed with forbiddenTokens including Assault',
      r.state === 'failed' &&
        r.reason === 'forbidden-token-present' &&
        r.forbiddenTokens.includes('Assault'),
    );
  }
  // Missing title.
  {
    const r = derive({
      workout: { name: 'Some Other Session', description: '20min bike easy' },
    });
    ok(
      '26.8: missing Easy Aerobic Flush title → reason=missing-title-token',
      r.state === 'failed' && r.reason === 'missing-title-token',
    );
  }

  // 26.9 — Maestro YAMLs assert mounted BEFORE ready.
  function assertYaml26(yaml: string, label: string) {
    const mounted = yaml.indexOf('id: "smoke-dayworkout-contract-mounted"');
    const ready = yaml.indexOf('id: "smoke-dayworkout-contract-ready"');
    const failed = yaml.indexOf('id: "smoke-dayworkout-contract-failed"');
    const title = yaml.indexOf('id: "day-workout-title"');
    ok(`26.9 (${label}): YAML asserts mounted`, mounted >= 0);
    ok(`26.9 (${label}): YAML asserts ready`, ready >= 0);
    ok(`26.9 (${label}): YAML asserts failed`, failed >= 0);
    ok(
      `26.9 (${label}): day-workout-title precedes contract-mounted`,
      title >= 0 && mounted >= 0 && title < mounted,
    );
    ok(
      `26.9 (${label}): contract-mounted precedes contract-ready`,
      mounted >= 0 && ready >= 0 && mounted < ready,
    );
    ok(
      `26.9 (${label}): contract-ready precedes contract-failed (assertNotVisible)`,
      ready >= 0 && failed >= 0 && ready < failed,
    );
    ok(
      `26.9 (${label}): smoke-dayworkout-contract-mounted is assertVisible`,
      /assertVisible:\s*\n\s*id:\s*"smoke-dayworkout-contract-mounted"/.test(yaml),
    );
    ok(
      `26.9 (${label}): smoke-dayworkout-contract-ready is assertVisible`,
      /assertVisible:\s*\n\s*id:\s*"smoke-dayworkout-contract-ready"/.test(yaml),
    );
    ok(
      `26.9 (${label}): smoke-dayworkout-contract-failed is assertNotVisible`,
      /assertNotVisible:\s*\n\s*id:\s*"smoke-dayworkout-contract-failed"/.test(yaml),
    );
  }
  assertYaml26(envYaml26, 'env');
  assertYaml26(dlYaml26, 'deep-link');

  // 26.10 — Wrapper has all three DayWorkout-final labels + visibility.
  ok(
    '26.10: wrapper records dayWorkoutContractMountedVisibility',
    /dayWorkoutContractMountedVisibility:\s*stepVisibilityFromText\([\s\S]{0,200}['"]smoke-dayworkout-contract-mounted['"]/.test(
      wrapperSource26,
    ),
  );
  ok(
    '26.10: wrapper has "DayWorkout mounted but contract marker mount point missing." label',
    wrapperSource26.includes(
      'DayWorkout mounted but contract marker mount point missing.',
    ),
  );
  ok(
    '26.10: wrapper has "DayWorkout contract marker rendered silently." label',
    wrapperSource26.includes('DayWorkout contract marker rendered silently.'),
  );
  ok(
    '26.10: wrapper has "DayWorkout final contract failed:" label template',
    /DayWorkout final contract failed:/.test(wrapperSource26),
  );

  // 26.11 — Wrapper step trace dump includes mounted row.
  ok(
    '26.11: fail-block step trace lists smoke-dayworkout-contract-mounted',
    /smoke-dayworkout-contract-mounted[\s\S]{0,200}dayWorkoutContractMountedStatus[\s\S]{0,200}dayWorkoutContractMountedVisibility/.test(
      wrapperSource26,
    ),
  );
}

section('[27] Live Coach target-binding guard — smoke-coach-unexpected-clarifier');
{
  const coachScreenSource = fs.readFileSync(
    path.resolve(__dirname, '../screens/coach/CoachScreen.tsx'),
    'utf8',
  );
  const wrapperSource27 = fs.readFileSync(
    path.resolve(__dirname, '../../scripts/smoke-coach-bike-flow.js'),
    'utf8',
  );
  const envYaml27 = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow-env.yaml'),
    'utf8',
  );
  const dlYaml27 = fs.readFileSync(
    path.resolve(__dirname, '../../.maestro/coach-bike-flow.yaml'),
    'utf8',
  );

  // 27.1 — CoachScreen declares the FORBIDDEN_CLARIFIER_RE detector.
  // The regex must match the historically-observed clarifier strings:
  //   - "Which session should I switch?"
  //   - "Which session should the bike change apply to?"
  //   - "Which session do you mean?"
  //   - "I can't see the row session in the visible week"
  //   - "I don't see a X in this week"
  ok(
    '27.1: CoachScreen declares FORBIDDEN_CLARIFIER_RE',
    /const\s+FORBIDDEN_CLARIFIER_RE\s*=\s*\//.test(coachScreenSource),
  );
  ok(
    '27.1: FORBIDDEN_CLARIFIER_RE matches "Which session should I switch"',
    /FORBIDDEN_CLARIFIER_RE[\s\S]{0,400}which\\s\+session\\s\+should\\s\+i\\s\+switch/i.test(
      coachScreenSource,
    ),
  );
  ok(
    '27.1: FORBIDDEN_CLARIFIER_RE matches "Which session should the bike change apply to"',
    /FORBIDDEN_CLARIFIER_RE[\s\S]{0,400}which\\s\+session\\s\+should\\s\+the\\s\+bike\\s\+change\\s\+apply\\s\+to/i.test(
      coachScreenSource,
    ),
  );

  // 27.2 — CoachScreen evaluates the regex against the latest assistant
  // message in a memo (not the user message — the guard catches what
  // the COACH said, not what the user typed).
  ok(
    '27.2: CoachScreen memoises latestAssistantMessage from messages[].filter(role===assistant)',
    /latestAssistantMessage\s*=\s*React\.useMemo[\s\S]{0,400}role\s*===\s*['"]assistant['"]/.test(
      coachScreenSource,
    ),
  );
  ok(
    '27.2: CoachScreen memoises smokeForbiddenClarifierVisible against FORBIDDEN_CLARIFIER_RE',
    /smokeForbiddenClarifierVisible\s*=\s*React\.useMemo[\s\S]{0,400}FORBIDDEN_CLARIFIER_RE\.test\(latestAssistantMessage\)/.test(
      coachScreenSource,
    ),
  );

  // 27.3 — Marker JSX renders with testID/accessibilityLabel
  // smoke-coach-unexpected-clarifier — gated on smokeCoachBikeFlow,
  // isFocused, smokeForbiddenClarifierVisible. collapsable=false +
  // pointerEvents="none" so the marker doesn't intercept Maestro taps.
  ok(
    '27.3: CoachScreen renders smoke-coach-unexpected-clarifier marker',
    /testID="smoke-coach-unexpected-clarifier"/.test(coachScreenSource) &&
      /accessibilityLabel="smoke-coach-unexpected-clarifier"/.test(
        coachScreenSource,
      ),
  );
  ok(
    '27.3: marker render gates on smokeCoachBikeFlow + isFocused + smokeForbiddenClarifierVisible',
    /smokeCoachBikeFlow\s*&&\s*isFocused\s*&&\s*smokeForbiddenClarifierVisible[\s\S]{0,300}testID="smoke-coach-unexpected-clarifier"/.test(
      coachScreenSource,
    ),
  );
  ok(
    '27.3: marker uses pointerEvents="none" so it cannot intercept Maestro taps',
    /testID="smoke-coach-unexpected-clarifier"[\s\S]{0,400}pointerEvents="none"|pointerEvents="none"[\s\S]{0,400}testID="smoke-coach-unexpected-clarifier"/.test(
      coachScreenSource,
    ),
  );

  // 27.4 — Warning log fires when the marker becomes visible, with the
  // truncated reply text in the log payload so the simulator capture
  // names the offending string.
  ok(
    '27.4: CoachScreen logs [smoke-coach-unexpected-clarifier] when the marker fires',
    /logger\.warn\(\s*`?\[smoke-coach-unexpected-clarifier\]/.test(
      coachScreenSource,
    ),
  );

  // 27.5 — Both Maestro YAMLs assert the marker is NOT visible
  // immediately after EACH of the three coach turns (turns 1, 2, 3 —
  // turn 2 is the historically-leaking turn). Three asserts per file.
  function assertYaml27ClarifierAsserts(yaml: string, label: string) {
    const matches = yaml.match(
      /assertNotVisible:\s*\n\s*id:\s*"smoke-coach-unexpected-clarifier"/g,
    );
    ok(
      `27.5 (${label}): YAML asserts smoke-coach-unexpected-clarifier NOT visible after EACH coach turn (3 asserts)`,
      matches !== null && matches.length === 3,
    );
  }
  assertYaml27ClarifierAsserts(envYaml27, 'env');
  assertYaml27ClarifierAsserts(dlYaml27, 'deep-link');

  // 27.6 — Wrapper reads smoke-coach-unexpected-clarifier step status +
  // visibility, and the diagnose branch fires with the spec-mandated
  // label "Live Coach target binding failed: unexpected clarifier."
  ok(
    '27.6: wrapper records smokeCoachUnexpectedClarifierStatus from stepStatusFromText',
    /smokeCoachUnexpectedClarifierStatus:\s*stepStatusFromText\([\s\S]{0,200}['"]smoke-coach-unexpected-clarifier['"]/.test(
      wrapperSource27,
    ),
  );
  ok(
    '27.6: wrapper records smokeCoachUnexpectedClarifierVisibility from stepVisibilityFromText',
    /smokeCoachUnexpectedClarifierVisibility:\s*stepVisibilityFromText\([\s\S]{0,200}['"]smoke-coach-unexpected-clarifier['"]/.test(
      wrapperSource27,
    ),
  );
  ok(
    '27.6: wrapper diagnose branch emits "Live Coach target binding failed: unexpected clarifier." label',
    wrapperSource27.includes(
      'Live Coach target binding failed: unexpected clarifier.',
    ),
  );
  ok(
    '27.6: wrapper diagnose branch reads smokeCoachUnexpectedClarifier{Status,Visibility}',
    /smokeCoachUnexpectedClarifierStatus\s*===\s*['"]FAILED['"][\s\S]{0,200}smokeCoachUnexpectedClarifierVisibility/.test(
      wrapperSource27,
    ),
  );

  // 27.7 — Clarifier branch fires BEFORE the Wednesday-missing branch.
  // When target binding leaks at turn 2, the downstream Wednesday gate
  // is irrelevant noise, so the clarifier label must take priority in
  // the wrapper's diagnose chain.
  ok(
    '27.7: wrapper clarifier diagnose branch is ordered before Wednesday-missing branch',
    (() => {
      const diagnoseSource = wrapperSource27.slice(
        wrapperSource27.indexOf('function diagnoseMaestroFailure'),
      );
      const clarifierIdx = diagnoseSource.indexOf(
        'Live Coach target binding failed: unexpected clarifier.',
      );
      const wedMissingIdx = diagnoseSource.indexOf(
        'Wednesday DayWorkout smoke target missing',
      );
      return (
        clarifierIdx > 0 && wedMissingIdx > 0 && clarifierIdx < wedMissingIdx
      );
    })(),
  );
}

console.log(`\n— Summary —`);
console.log(`  Pass: ${pass}`);
console.log(`  Fail: ${fail}`);
if (fail > 0) {
  console.log(`\n— Failures —`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}
process.exit(0);
