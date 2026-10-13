import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Calendar, ClipboardList, Bot, User } from 'lucide-react-native';
import { theme } from '../theme';

import StudentDashboardScreen from '../../app/(student)/dashboard';
import StudentTimetableScreen from '../../app/(student)/timetable';
import StudentAssignmentsScreen from '../../app/(student)/assignments';
import StudentAiScreen from '../../app/(student)/ai';
import StudentProfileScreen from '../../app/(student)/profile';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getResponsiveTabOptions } from './tabOptions';

const Tabs = createBottomTabNavigator();

function TabIcon({ Icon, color, size, focused }: { Icon: any; color: string; size: number; focused: boolean }) {
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

export default function StudentTabNavigator() {
  const insets = useSafeAreaInsets();
  const tabOptions = getResponsiveTabOptions(insets);

  return (
    <Tabs.Navigator screenOptions={tabOptions}>
      <Tabs.Screen
        name="/(student)/dashboard"
        component={StudentDashboardScreen}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Home} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(student)/timetable"
        component={StudentTimetableScreen}
        options={{
          title: 'Timetable',
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Calendar} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(student)/assignments"
        component={StudentAssignmentsScreen}
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={ClipboardList} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(student)/ai"
        component={StudentAiScreen}
        options={{
          title: 'AI Hub',
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={Bot} color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="/(student)/profile"
        component={StudentProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => <TabIcon Icon={User} color={color} size={size} focused={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}
