import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ClipboardList, Wallet, User } from 'lucide-react-native';
import { theme } from '../theme';

import ParentDashboardScreen from '../../app/(parent)/dashboard';
import ParentAttendanceScreen from '../../app/(parent)/attendance';
import ParentFeesScreen from '../../app/(parent)/fees';
import ParentProfileScreen from '../../app/(parent)/profile';

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

export default function ParentTabNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen name="/(parent)/dashboard" component={ParentDashboardScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="/(parent)/attendance" component={ParentAttendanceScreen} options={{ title: 'Attendance', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }} />
      <Tabs.Screen name="/(parent)/fees" component={ParentFeesScreen} options={{ title: 'Fees', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
      <Tabs.Screen name="/(parent)/profile" component={ParentProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs.Navigator>
  );
}
