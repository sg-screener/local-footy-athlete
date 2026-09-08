import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProgressTabScreen from '../screens/progress/ProgressTabScreen';
import LoadHistoryScreen, { RecordedLoadSessionScreen } from '../screens/progress/LoadHistoryScreen';
import type { ProgressPeriod } from '../rules/progressPeriod';

export type ProgressStackParamList = {
  ProgressOverview: undefined;
  LoadHistory: { period: ProgressPeriod };
  RecordedLoadSession: { date: string };
};
const Stack = createNativeStackNavigator<ProgressStackParamList>();
export default function ProgressNavigator() {
  return <Stack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProgressOverview" component={ProgressTabScreen} />
    <Stack.Screen name="LoadHistory" component={LoadHistoryScreen} />
    <Stack.Screen name="RecordedLoadSession" component={RecordedLoadSessionScreen} />
  </Stack.Navigator>;
}
