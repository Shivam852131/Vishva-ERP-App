import React from 'react';
import { View } from 'react-native';
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
    ...theme.shadow.md,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, marginTop: -2 },
};

function TabIcon({ Icon, color, size, focused }: { Icon: any; color: string; size: number; focused: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 3,
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

export default function ParentTabNavigator() {
  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen name="/(parent)/dashboard" component={ParentDashboardScreen} options={{ title: 'Home', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Home} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="/(parent)/attendance" component={ParentAttendanceScreen} options={{ title: 'Attendance', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={ClipboardList} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="/(parent)/fees" component={ParentFeesScreen} options={{ title: 'Fees', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Wallet} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="/(parent)/profile" component={ParentProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={User} color={color} size={size} focused={focused} /> }} />
    </Tabs.Navigator>
  );
}
