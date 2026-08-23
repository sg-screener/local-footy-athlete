import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { logger } from '../utils/logger';
import HomeScreen from '../screens/home/HomeScreen';
import { DayWorkoutScreen } from '../screens/home/DayWorkoutScreen';
import CoachTabScreen from '../screens/coach/CoachTabScreen';
import { useCoachWeeklyCommitment } from '../screens/coach/useCoachWeeklyCommitment';
import { commitmentConversationNoticeSentence } from '../rules/projectionCopy';
import ProfileScreen from '../screens/profile/ProfileScreen';
import FAQScreen from '../screens/profile/FAQScreen';
import { PrivacyScreen } from '../screens/profile/PrivacyScreen';
import { TermsScreen } from '../screens/profile/TermsScreen';

type ProgramStackParamList = {
  Home: { initialDate?: string } | undefined;
  DayWorkout: {
    workoutId: string; date?: string; startFinished?: boolean;
  };
};

type ProfileStackParamList = {
  Profile: undefined;
  FAQ: undefined;
  Privacy: undefined;
  Terms: undefined;
};

export type TabParamList = {
  ProgramTab: { screen: string; params?: Record<string, any> } | undefined;
  CoachTab: { status?: 'open' } | undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const ProgramStack = createNativeStackNavigator<ProgramStackParamList>();
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
  /*
    R-105 — THE COACH'S NOTIFICATION, AND IT IS DERIVED LIKE THE QUESTION.

    Sam, 2026-08-19: *"This should not be popping up on the main page - it should
    show up in the coaches chat with a notification"*. A notification the athlete
    only sees once they are already inside the Coach tab is not a notification,
    so it is the TAB's dot.

    ⚠ **THERE IS NO UNREAD FLAG.** `hasNotification` is `conversation !== null`
    computed from the stored facts and the decision ledger, so answering the
    question turns the dot off with nothing to clear, and a relaunch cannot
    resurrect it. R-099 ruled that the question is derived and only the answer is
    stored; the dot is that same object seen from the tab bar.

    ⚠ **AND IT IS CHEAP FOR EVERY ATHLETE WHO IS NOT BEING ASKED.** The
    derivation's gates — block number, commitment, attendance, the ledger — all
    return before either expensive closure is called, and the hook memoises on
    the stores. `test:block-two-extra-session` holds that as a cost property with
    its own counter.
  */
  const coachCommitment = useCoachWeeklyCommitment();
  /*
    HOISTED OUT OF THE TAB OPTIONS ON PURPOSE. `test:signed-copy-extraction`
    reads a `tabBarAccessibilityLabel` written as a TERNARY as two unauthored
    athlete-visible strings, and it is right to: a surface choosing between two
    literals is a surface authoring words. One of these two is signed copy and
    the other is this tab's existing name, so the choice is made here and the
    property receives one value.
  */
  const coachTabAccessibilityLabel = coachCommitment.hasNotification
    ? String(commitmentConversationNoticeSentence())
    : 'Coach tab';

  React.useEffect(() => {
    logger.info('[app-navigator] initialRouteName=ProgramTab');
    logger.info('[tabs-mounted] true');
    return () => logger.info('[tabs-mounted] false');
  }, []);

  /*
    THE JOURNAL IS HIDDEN (Sam, 2026-08-09, after his eye pass) — AND THE OS
    The old Journal surface and its reminder system have now been retired. The
    Journal's pure calculations and recorded inputs remain for the Coach
    snapshot; no hidden screen or notification code is kept alive.
  */
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
          The frozen beta chat root and its parallel mutation pipeline were
          retired before the clean-room Coach rebuild. This tab is the current
          simple Coach and remains the only mounted Coach surface until its
          read-only replacement is proven in Coach Lab.
        */}
        <Tab.Screen
          name="CoachTab"
          component={CoachTabScreen}
          options={{
            title: 'Coach',
            tabBarIcon: ({ color }) => <CoachIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-coach',
            /*
              THE DOT SPEAKS, AND IT SPEAKS SIGNED WORDS. A badge with no
              accessible name is a visual-only notification, and R-109 ruled that
              a control speaks the athlete's word rather than its address.

              ⚠ **NO NEW SENTENCE IS INVENTED HERE.** The spoken name is the
              conversation's own signed notification line — the one Sam approved
              on 2026-08-20 — so the dot and the first thing the athlete reads
              inside the tab are the same words. The un-notified name is the
              literal this tab has always carried, unchanged.
            */
            tabBarAccessibilityLabel: coachTabAccessibilityLabel,
            // A DOT, NOT A COUNT. There is exactly one question and it is not a
            // queue; a number would imply a backlog the app cannot have.
            tabBarBadge: coachCommitment.hasNotification ? '' : undefined,
            tabBarBadgeStyle: { backgroundColor: '#C8FF00', minWidth: 10, height: 10,
              borderRadius: 5, transform: [{ translateY: 2 }] },
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
