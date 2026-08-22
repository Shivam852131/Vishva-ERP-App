import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Calendar, ClipboardList, Bot, User } from 'lucide-react-native';
import { theme } from '../theme';

import StudentDashboardScreen from '../../app/(student)/dashboard';
import StudentTimetableScreen from '../../app/(student)/timetable';
import StudentAssignmentsScreen from '../../app/(student)/assignments';
import StudentAiScreen from '../../app/(student)/ai';
import StudentProfileScreen from '../../app/(student)/profile';

const Tabs = createBottomTabNavigator();

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: theme.colors.brand,
  tabBarInactiveTintColor: theme.colors.muted,
  tabBarStyle: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    ...theme.shadow.sm,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
};

export default function StudentTabNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen name="/(student)/dashboard" component={StudentDashboardScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="/(student)/timetable" component={StudentTimetableScreen} options={{ title: 'Timetable', tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
      <Tabs.Screen name="/(student)/assignments" component={StudentAssignmentsScreen} options={{ title: 'Tasks', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }} />
      <Tabs.Screen name="/(student)/ai" component={StudentAiScreen} options={{ title: 'AI Hub', tabBarIcon: ({ color, size }) => <Bot color={color} size={size} /> }} />
      <Tabs.Screen name="/(student)/profile" component={StudentProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs.Navigator>
  );
}
