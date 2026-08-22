import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Building2, Users, BarChart3, User } from 'lucide-react-native';
import { theme } from '../theme';

import SuperAdminDashboardScreen from '../../app/(super_admin)/dashboard';
import SuperAdminCollegesScreen from '../../app/(super_admin)/colleges';
import SuperAdminUsersScreen from '../../app/(super_admin)/users';
import SuperAdminReportsScreen from '../../app/(super_admin)/reports';
import SuperAdminProfileScreen from '../../app/(super_admin)/profile';

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

export default function SuperAdminTabNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen name="/(super_admin)/dashboard" component={SuperAdminDashboardScreen} options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <TabIcon Icon={Home} color={color} size={size} /> }} />
      <Tabs.Screen name="/(super_admin)/colleges" component={SuperAdminCollegesScreen} options={{ title: 'Colleges', tabBarIcon: ({ color, size }) => <TabIcon Icon={Building2} color={color} size={size} /> }} />
      <Tabs.Screen name="/(super_admin)/users" component={SuperAdminUsersScreen} options={{ title: 'Users', tabBarIcon: ({ color, size }) => <TabIcon Icon={Users} color={color} size={size} /> }} />
      <Tabs.Screen name="/(super_admin)/reports" component={SuperAdminReportsScreen} options={{ title: 'Reports', tabBarIcon: ({ color, size }) => <TabIcon Icon={BarChart3} color={color} size={size} /> }} />
      <Tabs.Screen name="/(super_admin)/profile" component={SuperAdminProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <TabIcon Icon={User} color={color} size={size} /> }} />
    </Tabs.Navigator>
  );
}
