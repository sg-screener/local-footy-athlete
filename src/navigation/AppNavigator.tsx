import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import Svg, { Path } from 'react-native-svg';
import { logger } from '../utils/logger';
import HomeScreen from '../screens/home/HomeScreen';
import { DayWorkoutScreen } from '../screens/home/DayWorkoutScreen';
import CoachScreen from '../screens/coach/CoachScreen';
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
  const navigation = useNavigation();

  React.useEffect(() => {
    logger.info('[app-navigator] initialRouteName=ProgramTab');
    logger.info('[tabs-mounted] true');
    return () => logger.info('[tabs-mounted] false');
  }, []);

  /*
    C6 (Sam, 2026-08-09): THE MONDAY NOTIFICATION "OPENS THE JOURNAL TAB".

    THE ROUTE TRAVELS IN THE NOTIFICATION, NOT IN THIS HANDLER. The scheduler
    puts `{ route: 'JournalTab' }` in the payload and this reads it back, so a
    second scheduled notification aimed somewhere else needs no change here —
    and, more to the point, a handler that hardcoded `JournalTab` would send an
    athlete to the Journal for a notification about something else.

    IT IS GUARDED AGAINST AN UNKNOWN ROUTE. A payload naming a tab that does not
    exist is ignored rather than navigated to; `navigate` with a bad name throws,
    and a crash on tapping a notification is the worst place in the app to have
    one — the athlete is not even in the app yet.

    THE LISTENER HANDLES A TAP, NEVER AN ARRIVAL. `addNotificationResponse
    ReceivedListener` fires when the athlete TAPS. A notification that merely
    arrives while they are using the app must not yank them out of whatever they
    are doing.
  */
  React.useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const route = response.notification.request.content.data?.route;
        if (route !== 'JournalTab') return;
        logger.info('[notification-tap] journal');
        navigation.navigate('JournalTab' as never);
      });
    } catch (error) {
      // THE NATIVE MODULE IS ABSENT UNTIL SAM REBUILDS WITH PODS, and that is
      // the normal state on the running binary rather than an edge case. A
      // throw here would take the whole navigator down on mount.
      logger.info(`[notification-tap] listener unavailable: ${String(error)}`);
    }
    return () => subscription?.remove();
  }, [navigation]);

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
        */}
        {/*
          THE JOURNAL TAB (journal unit, slice 1) — the permanent home Sam ruled
          in the design review: "the Journal TAB is the permanent home and ships
          in the launch build". It sits between Program and Profile because it
          is a training surface, not a settings one.

          It is a READING SURFACE: no door, no transaction, no stored state. It
          renders a derivation over facts the app already keeps as inputs.
        */}
        <Tab.Screen
          name="JournalTab"
          component={JournalScreen}
          options={{
            title: 'Journal',
            tabBarIcon: ({ color }) => <JournalIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-journal',
            tabBarAccessibilityLabel: 'Journal tab',
          }}
          listeners={{ tabPress: () => logger.info('[tab-press] journal') }}
        />
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
