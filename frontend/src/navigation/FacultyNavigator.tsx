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

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getResponsiveTabOptions } from './tabOptions';

const Tabs = createBottomTabNavigator();

function TabIcon({ Icon, color, size, focused }: { Icon: React.ElementType; color: string; size: number; focused?: boolean }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
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

export default function FacultyTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabOptions = getResponsiveTabOptions(insets);

  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen name="/(faculty)/dashboard" component={FacultyDashboardScreen} options={{ title: 'Home', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Home} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="/(faculty)/classes" component={FacultyClassesScreen} options={{ title: 'Classes', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Users} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="/(faculty)/assignments" component={FacultyAssignmentsScreen} options={{ title: 'Tasks', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={ClipboardList} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="/(faculty)/ai" component={FacultyAiScreen} options={{ title: 'AI', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Bot} color={color} size={size} focused={focused} /> }} />
      <Tabs.Screen name="/(faculty)/profile" component={FacultyProfileScreen} options={{ title: 'Profile', tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={User} color={color} size={size} focused={focused} /> }} />
    </Tabs.Navigator>
  );
}
