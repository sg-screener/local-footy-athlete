/**
 * Singleton NavigationContainerRef used by the smoke route enforcer.
 *
 * The smoke harness needs to imperatively dispatch a navigation reset
 * to the Tab.Navigator (e.g. `CommonActions.reset({ routes: [{ name:
 * 'CoachTab' }] })`) once React Navigation has finished mounting. The
 * cleanest way to do that — without forcing the enforcer to live
 * inside a Tab.Screen — is a module-level ref that is attached to the
 * top-level NavigationContainer in RootNavigator and read by the
 * enforcer in AppNavigator.
 *
 * Keep this file dependency-free so it can be imported from either
 * RootNavigator or AppNavigator without creating a cycle.
 *
 * Usage:
 *   - RootNavigator: <NavigationContainer ref={navigationRef} …>
 *   - AppNavigator (SmokeRouteEnforcer): navigationRef.isReady() +
 *     navigationRef.dispatch(CommonActions.reset(…))
 */
import { createNavigationContainerRef } from '@react-navigation/native';

// `any` keeps the ref usable from both the onboarding navigator and the
// main tab navigator without forcing every consumer to share one param
// list. The smoke enforcer only ever dispatches by route name, so the
// looser type is intentional.
export const navigationRef = createNavigationContainerRef<any>();
