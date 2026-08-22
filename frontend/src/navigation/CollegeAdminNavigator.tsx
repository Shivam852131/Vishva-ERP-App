import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Users, ClipboardCheck, BookOpen, BarChart3, User } from 'lucide-react-native';
import { theme } from '../theme';

import CollegeAdminDashboardScreen from '../../app/(college_admin)/dashboard';
import CollegeAdminUsersScreen from '../../app/(college_admin)/users';
import CollegeAdminAttendanceScreen from '../../app/(college_admin)/attendance';
import CollegeAdminAcademicsScreen from '../../app/(college_admin)/academics';
import CollegeAdminReportsScreen from '../../app/(college_admin)/reports';
import CollegeAdminProfileScreen from '../../app/(college_admin)/profile';

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

export default function CollegeAdminTabNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen name="/(college_admin)/dashboard" component={CollegeAdminDashboardScreen} options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <TabIcon Icon={Home} color={color} size={size} /> }} />
      <Tabs.Screen name="/(college_admin)/users" component={CollegeAdminUsersScreen} options={{ title: 'Users', tabBarIcon: ({ color, size }) => <TabIcon Icon={Users} color={color} size={size} /> }} />
      <Tabs.Screen name="/(college_admin)/attendance" component={CollegeAdminAttendanceScreen} options={{ title: 'Attendance', tabBarIcon: ({ color, size }) => <TabIcon Icon={ClipboardCheck} color={color} size={size} /> }} />
      <Tabs.Screen name="/(college_admin)/academics" component={CollegeAdminAcademicsScreen} options={{ title: 'Academics', tabBarIcon: ({ color, size }) => <TabIcon Icon={BookOpen} color={color} size={size} /> }} />
      <Tabs.Screen name="/(college_admin)/reports" component={CollegeAdminReportsScreen} options={{ title: 'Reports', tabBarIcon: ({ color, size }) => <TabIcon Icon={BarChart3} color={color} size={size} /> }} />
      <Tabs.Screen name="/(college_admin)/profile" component={CollegeAdminProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <TabIcon Icon={User} color={color} size={size} /> }} />
    </Tabs.Navigator>
  );
}
