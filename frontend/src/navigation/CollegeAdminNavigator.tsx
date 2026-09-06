import React from 'react';
import { View, Text } from 'react-native';
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
    ...theme.shadow.md,
  },
  tabBarItemStyle: {
    paddingHorizontal: 0,
  },
};

function TabIcon({ Icon, color, size, focused }: { Icon: React.ElementType; color: string; size: number; focused?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: theme.radius.pill,
        backgroundColor: focused ? theme.colors.brandTertiary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon color={color} size={size} strokeWidth={focused ? 2.4 : 1.8} />
    </View>
  );
}

function TabLabel({ title, color, focused }: { title: string; color: string; focused: boolean }) {
  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      style={{
        fontSize: 10,
        fontWeight: focused ? '800' : '600',
        color,
        textAlign: 'center',
        letterSpacing: -0.2,
      }}
    >
      {title}
    </Text>
  );
}

export default function CollegeAdminTabNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen
        name="/(college_admin)/dashboard"
        component={CollegeAdminDashboardScreen}
        options={{
          title: 'Overview',
          tabBarLabel: ({ color, focused }) => <TabLabel title="Overview" color={color} focused={focused} />,
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Home} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(college_admin)/users"
        component={CollegeAdminUsersScreen}
        options={{
          title: 'Users',
          tabBarLabel: ({ color, focused }) => <TabLabel title="Users" color={color} focused={focused} />,
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Users} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(college_admin)/attendance"
        component={CollegeAdminAttendanceScreen}
        options={{
          title: 'Attendance',
          tabBarLabel: ({ color, focused }) => <TabLabel title="Attendance" color={color} focused={focused} />,
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={ClipboardCheck} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(college_admin)/academics"
        component={CollegeAdminAcademicsScreen}
        options={{
          title: 'Academics',
          tabBarLabel: ({ color, focused }) => <TabLabel title="Academics" color={color} focused={focused} />,
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={BookOpen} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(college_admin)/reports"
        component={CollegeAdminReportsScreen}
        options={{
          title: 'Reports',
          tabBarLabel: ({ color, focused }) => <TabLabel title="Reports" color={color} focused={focused} />,
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={BarChart3} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(college_admin)/profile"
        component={CollegeAdminProfileScreen}
        options={{
          title: 'Profile',
          tabBarLabel: ({ color, focused }) => <TabLabel title="Profile" color={color} focused={focused} />,
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={User} color={color} size={size} focused={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}
