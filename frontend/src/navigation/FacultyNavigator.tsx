import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, ClipboardList, Bot, User } from 'lucide-react-native';
import { theme } from '../theme';

import FacultyDashboardScreen from '../../app/(faculty)/dashboard';
import FacultyClassesScreen from '../../app/(faculty)/classes';
import FacultyAssignmentsScreen from '../../app/(faculty)/assignments';
import FacultyAiScreen from '../../app/(faculty)/ai';
import FacultyProfileScreen from '../../app/(faculty)/profile';

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

function TabIcon({ Icon, color, size }: { Icon: React.ElementType; color: string; size: number }) {
  return <View><Icon color={color} size={size} /></View>;
}

export default function FacultyTabNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen name="/(faculty)/dashboard" component={FacultyDashboardScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <TabIcon Icon={Home} color={color} size={size} /> }} />
      <Tabs.Screen name="/(faculty)/classes" component={FacultyClassesScreen} options={{ title: 'Classes', tabBarIcon: ({ color, size }) => <TabIcon Icon={Users} color={color} size={size} /> }} />
      <Tabs.Screen name="/(faculty)/assignments" component={FacultyAssignmentsScreen} options={{ title: 'Tasks', tabBarIcon: ({ color, size }) => <TabIcon Icon={ClipboardList} color={color} size={size} /> }} />
      <Tabs.Screen name="/(faculty)/ai" component={FacultyAiScreen} options={{ title: 'AI', tabBarIcon: ({ color, size }) => <TabIcon Icon={Bot} color={color} size={size} /> }} />
      <Tabs.Screen name="/(faculty)/profile" component={FacultyProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <TabIcon Icon={User} color={color} size={size} /> }} />
    </Tabs.Navigator>
  );
}
