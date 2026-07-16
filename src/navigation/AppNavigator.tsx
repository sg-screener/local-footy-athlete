import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { logger } from '../utils/logger';
import HomeScreen from '../screens/home/HomeScreen';
import { DayWorkoutScreen } from '../screens/home/DayWorkoutScreen';
import CoachScreen from '../screens/coach/CoachScreen';
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
        <Tab.Screen
          name="CoachTab"
          component={CoachStackNavigator}
          options={{
            title: 'Coach',
            tabBarIcon: ({ color }) => <CoachIcon color={color} size={22} />,
            tabBarButtonTestID: 'tab-coach',
            tabBarAccessibilityLabel: 'Coach tab',
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
