import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { logger } from '../utils/logger';
import { disableJournalReminder } from '../services/journalReminderService';
import HomeScreen from '../screens/home/HomeScreen';
import { DayWorkoutScreen } from '../screens/home/DayWorkoutScreen';
import CoachScreen from '../screens/coach/CoachScreen';
import CoachTabScreen from '../screens/coach/CoachTabScreen';
import JournalScreen from '../screens/journal/JournalScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import FAQScreen from '../screens/profile/FAQScreen';
import { PrivacyScreen } from '../screens/profile/PrivacyScreen';
import { TermsScreen } from '../screens/profile/TermsScreen';

type ProgramStackParamList = {
  Home: { initialDate?: string } | undefined;
  DayWorkout: { workoutId: string; date?: string; startFinished?: boolean };
};

type CoachStackParamList = {
  Coach: { prefill?: string } | undefined;
};

type ProfileStackParamList = {
  Profile: undefined;
  FAQ: undefined;
  Privacy: undefined;
  Terms: undefined;
};

type TabParamList = {
  ProgramTab: { screen: string; params?: Record<string, any> } | undefined;
  CoachTab: { screen: string; params?: { prefill?: string } } | undefined;
  JournalTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const ProgramStack = createNativeStackNavigator<ProgramStackParamList>();
const CoachStack = createNativeStackNavigator<CoachStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();

function ProgramIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <Path d="M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      <Path d="M9 12h6" />
      <Path d="M9 16h6" />
    </Svg>
  );
}

function CoachIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </Svg>
  );
}

function JournalIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <Path d="M9 7h7" />
      <Path d="M9 11h7" />
    </Svg>
  );
}

function ProfileIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <Path d="M12 3a4 4 0 100 8 4 4 0 000-8z" />
    </Svg>
  );
}

function ProgramStackNavigator() {
  return (
    <ProgramStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <ProgramStack.Screen name="Home" component={HomeScreen} />
      <ProgramStack.Screen name="DayWorkout" component={DayWorkoutScreen} />
    </ProgramStack.Navigator>
  );
}

function CoachStackNavigator() {
  return (
    <CoachStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <CoachStack.Screen name="Coach" component={CoachScreen} />
    </CoachStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStackNav.Navigator id={undefined} screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="Profile" component={ProfileScreen} />
      <ProfileStackNav.Screen name="FAQ" component={FAQScreen} />
      <ProfileStackNav.Screen name="Privacy" component={PrivacyScreen} />
      <ProfileStackNav.Screen name="Terms" component={TermsScreen} />
    </ProfileStackNav.Navigator>
  );
}

export default function AppNavigator() {
  React.useEffect(() => {
    logger.info('[app-navigator] initialRouteName=ProgramTab');
    logger.info('[tabs-mounted] true');
    return () => logger.info('[tabs-mounted] false');
  }, []);

  /*
    THE JOURNAL IS HIDDEN (Sam, 2026-08-09, after his eye pass) — AND THE OS
    STILL HOLDS WHAT THE SURFACE PUT THERE.

    The ruling reads "unreachable = nothing can ever fire". That is true of
    every FUTURE schedule — the opt-in tap lives on a screen no tab reaches
    any more, so nothing can arm the reminder again. It is NOT true of a
    schedule already handed to the notification centre. The reminder unit's own
    design says so in as many words: **the OS is the store**. A weekly trigger
    accepted before today keeps firing every Monday whether this app is opened
    or not, and hiding the surface does not reach into that store.

    So the hide has two halves, and this is the second one. It cancels by the
    reminder's stable identifier through the service's own door, on every
    launch: stateless, idempotent, and no "have I cancelled yet" flag to store.

    THE TAP DOOR IS GONE WITH THE TAB, and that is the same removal R5.7 made
    for the coach cut — the entry surface and every door that targeted it. It
    also has to go: the old handler navigated to a tab that no longer exists,
    and navigating to a name the navigator does not know throws. A crash on
    tapping a notification is the worst place in the app to have one, and a
    notification delivered from before the cancel is exactly the case that
    would have found it.

    WHAT THIS CANNOT REACH: an athlete who never opens the app again. Their
    phone keeps the schedule the OS accepted. Nothing inside a binary can
    cancel a notification for a binary that is never run.
  */
  React.useEffect(() => {
    void disableJournalReminder().then((outcome) => {
      logger.info(`[journal-hidden] reminder cancelled: ${outcome?.kind ?? 'ok'}`);
    });
  }, []);

  return (
    <View style={{ flex: 1 }} testID="main-tabs-root" accessibilityLabel="Main tabs">
      <Tab.Navigator
        id={undefined}
        initialRouteName="ProgramTab"
        screenOptions={{
          headerShown: false,
          lazy: false,
          tabBarStyle: {
            backgroundColor: '#0C0C0C',
            borderTopWidth: 0,
            elevation: 0,
            shadowOpacity: 0,
            height: 84,
            paddingTop: 12,
            paddingBottom: 28,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.3,
            marginTop: 4,
          },
          tabBarActiveTintColor: '#C8FF00',
          tabBarInactiveTintColor: '#555555',
          tabBarItemStyle: { gap: 2 },
        }}
      >
        <Tab.Screen
          name="ProgramTab"
          component={ProgramStackNavigator}
          options={{
            title: 'Program',
            tabBarIcon: ({ color }) => <ProgramIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-program',
            tabBarAccessibilityLabel: 'Program tab',
          }}
          listeners={{ tabPress: () => logger.info('[tab-press] program') }}
        />
        {/*
          R5.7 — THE BETA COACH CUT (§6, decision C(a), signed; Sam's
          "MAKE THE CUT" 2026-08-07). The free-text coach entry point does not
          appear in the beta build, and the boundary is the FULL cut: zero
          paths to a chat surface, not a reachable screen with its input
          removed. The tab is gone and all three navigation doors that
          targeted it are gone with it.

          The wording above is deliberate: `coachEntrySurfaceContractTests`
          section [4] greps product sources for the literal call, and prose
          containing it reads to that gate as a door. A note is output, never
          evidence — so the note yields, not the gate.

          LR-6 HOLDS: `CoachStackNavigator`, `CoachScreen` and the pipeline stay
          in the tree, FROZEN. This is a scope cut, not a retirement — §6's own
          words. Restoring the tab is one `Tab.Screen` block.

          AND THE TAB IS BACK, 2026-08-09 — BUT NOT THE SURFACE THAT WAS CUT.
          Sam approved docs/COACH_TAB_MOCK_2026-08-09.html and
          docs/COACH_REBUILD_KICKOFF_2026-08-09.md opened SLICE 1. The block
          below mounts `CoachTabScreen`, which is the rebuild: read-only, zero
          mutation paths, its words derived from the same projection the Program
          tab renders.

          `CoachScreen` and `CoachStackNavigator` above are UNCHANGED and
          UNREACHED. The beta chat surface C(a) cut stays cut — this is not its
          restoration, and `coachEntrySurfaceContractTests` section [4] was
          re-aimed at exactly that distinction rather than deleted. The frozen
          root is retired by SUPERSESSION when S1-S3 have replaced its every
          reachable duty, which is the kickoff's own answer to the parked
          question of what to do with 41,220 unreachable lines.
        */}
        <Tab.Screen
          name="CoachTab"
          component={CoachTabScreen}
          options={{
            title: 'Coach',
            tabBarIcon: ({ color }) => <CoachIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-coach',
            tabBarAccessibilityLabel: 'Coach tab',
            /*
              L-C3, THE NIKE BAR, AT THE ONE PLACE THIS SCREEN CANNOT SOLVE IT
              ITSELF. The composer rides `KeyboardStickyView`, which lifts by the
              keyboard height measured from the true screen bottom. An 84pt tab
              bar sitting under it is a STATIC bottom inset, and a sticky footer
              resting one inset up overshoots the keypad by exactly that inset —
              the run-3 onboarding finding, in a place a screen cannot reach
              because the tab bar is not its own layout. Hiding the bar while the
              keyboard is up removes the inset instead of compensating for it.
            */
            tabBarHideOnKeyboard: true,
          }}
          listeners={{ tabPress: () => logger.info('[tab-press] coach') }}
        />
        {/*
          THE JOURNAL IS HIDDEN — Sam, 2026-08-09, after his own eye pass:
          "i'd like all the journal stuff hidden for now - keep the data behind
          the scenses because it might be useful for the coach."
          Ruling: docs/JOURNAL_HIDDEN_RULING_2026-08-09.md

          ONE HIDE AT THE NAVIGATION OWNER, not a scatter of conditionals, and
          it is the R5.7 shape exactly: ENTRY SURFACE GONE, MACHINERY FROZEN
          NOT DELETED. The tab block and the notification's tap door are the
          only two things removed. `JournalScreen` stays imported above and
          every derivation, store and suite behind it stays alive in the chain,
          because the record they keep is the input the coach rebuild is going
          to read. Restoring the surface is one Tab.Screen block.

          It was NOT a retirement, so nothing here is deleted and no word is
          withdrawn from the copy sheet: batches 15-28 stay signed against a
          screen that still exists and no longer renders.

          `journalHiddenContractTests` is the ratchet that keeps it hidden —
          the gate must watch the deleted surface, or one restored line brings
          a screen Sam has ruled on back with nothing noticing.
        */}
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStackNavigator}
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <ProfileIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-profile',
            tabBarAccessibilityLabel: 'Profile tab',
          }}
          listeners={{ tabPress: () => logger.info('[tab-press] profile') }}
        />
      </Tab.Navigator>
    </View>
  );
}
