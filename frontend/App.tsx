import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  Home,
  Calendar,
  ClipboardList,
  Bot,
  User,
  Users,
  BookOpen,
  BarChart3,
  ClipboardCheck,
  Building2,
  Wallet,
} from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import IndexScreen from './app/index';
import LandingScreen from './app/landing';
import LoginScreen from './app/login';
import StudentDashboardScreen from './app/(student)/dashboard';
import StudentTimetableScreen from './app/(student)/timetable';
import StudentAssignmentsScreen from './app/(student)/assignments';
import StudentAiScreen from './app/(student)/ai';
import StudentProfileScreen from './app/(student)/profile';
import ParentDashboardScreen from './app/(parent)/dashboard';
import ParentAttendanceScreen from './app/(parent)/attendance';
import ParentFeesScreen from './app/(parent)/fees';
import ParentProfileScreen from './app/(parent)/profile';
import FacultyDashboardScreen from './app/(faculty)/dashboard';
import FacultyClassesScreen from './app/(faculty)/classes';
import FacultyAssignmentsScreen from './app/(faculty)/assignments';
import FacultyAiScreen from './app/(faculty)/ai';
import FacultyProfileScreen from './app/(faculty)/profile';
import FacultyExamGeneratorScreen from './app/(faculty)/exam-generator';
import CollegeAdminDashboardScreen from './app/(college_admin)/dashboard';
import CollegeAdminUsersScreen from './app/(college_admin)/users';
import CollegeAdminAttendanceScreen from './app/(college_admin)/attendance';
import CollegeAdminAcademicsScreen from './app/(college_admin)/academics';
import CollegeAdminReportsScreen from './app/(college_admin)/reports';
import CollegeAdminProfileScreen from './app/(college_admin)/profile';
import CollegeAdminPaymentsScreen from './app/(college_admin)/payments';
import CollegeAdminSubscriptionScreen from './app/(college_admin)/subscription';
import CollegeAdminHostelAdminScreen from './app/(college_admin)/hostel-admin';
import SuperAdminDashboardScreen from './app/(super_admin)/dashboard';
import SuperAdminCollegesScreen from './app/(super_admin)/colleges';
import SuperAdminUsersScreen from './app/(super_admin)/users';
import SuperAdminReportsScreen from './app/(super_admin)/reports';
import SuperAdminProfileScreen from './app/(super_admin)/profile';
import AnalyticsScreen from './app/analytics';
import AttendanceScreen from './app/attendance';
import AttendanceLiveScreen from './app/attendance-live';
import AttendanceAdvancedScreen from './app/attendance-advanced';
import AttendanceLiveAdvancedScreen from './app/attendance-live-advanced';
import LeaveManagementScreen from './app/leave-management';
import ChatScreen from './app/chat';
import EventsScreen from './app/events';
import ExamsScreen from './app/exams';
import FeesScreen from './app/fees';
import GrievancesScreen from './app/grievances';
import HostelScreen from './app/hostel';
import IdCardScreen from './app/id-card';
import LibraryScreen from './app/library';
import NotesScreen from './app/notes';
import NotificationsScreen from './app/notifications';
import PlacementScreen from './app/placement';
import ResultsScreen from './app/results';
import ScanScreen from './app/scan';
import SelfieScreen from './app/selfie';
import SessionScreen from './app/session';
import StartSessionScreen from './app/start-session';
import TransportScreen from './app/transport';
import PhoneOTPLoginScreen from './app/phone-login';
import VisitorManagementScreen from './app/visitor';
import ComplaintManagementScreen from './app/complaints';
import AssetManagementScreen from './app/assets';
import PushNotificationsScreen from './app/push-notifications';
import EmailIntegrationScreen from './app/email';
import WhatsAppIntegrationScreen from './app/whatsapp';
import ParentAiScreen from './app/(parent)/ai';
import StudentFeesScreen from './app/(student)/fees';
import FacultyQuestionPaperScreen from './app/(faculty)/question-paper';
import AssignmentCheckerScreen from './app/assignment-checker';
import ReportCardScreen from './app/report-card';
import CareerAdvisorScreen from './app/career-advisor';
import ResumeBuilderScreen from './app/resume-builder';
import InterviewPracticeScreen from './app/interview-practice';
import StudyPlannerScreen from './app/study-planner';
import BusTrackingScreen from './app/bus-tracking';
import LiveClassesScreen from './app/live-classes';
import LiveClassRoomScreen from './app/live-class';
import SkillAssessmentScreen from './app/skill-assessment';
import AssessmentAttemptScreen from './app/assessment-attempt';
import MentorshipScreen from './app/mentorship';
import SkillProfileScreen from './app/skill-profile';
import CareerDashboardScreen from './app/career-dashboard';
import FaceEnrollScreen from './app/face-enroll';
import { ErrorBoundary } from './src/ErrorBoundary';
import { navigationRef } from './src/navigation/navigation-ref';
import { AuthProvider } from './src/providers/AuthContext';
import { theme } from './src/theme';

const RootStack = createNativeStackNavigator();
const StudentTabs = createBottomTabNavigator();
const ParentTabs = createBottomTabNavigator();
const FacultyTabs = createBottomTabNavigator();
const CollegeAdminTabs = createBottomTabNavigator();
const SuperAdminTabs = createBottomTabNavigator();

type TabIconProps = {
  Icon: React.ElementType;
  color: string;
  size: number;
  badge?: number;
};

function TabIcon({ Icon, color, size, badge }: TabIconProps) {
  return (
    <View>
      <Icon color={color} size={size} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const defaultTabOptions = {
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

function StudentTabNavigator() {
  return (
    <StudentTabs.Navigator screenOptions={defaultTabOptions}>
      <StudentTabs.Screen
        name="/(student)/dashboard"
        component={StudentDashboardScreen}
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <StudentTabs.Screen
        name="/(student)/timetable"
        component={StudentTimetableScreen}
        options={{ title: 'Timetable', tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <StudentTabs.Screen
        name="/(student)/assignments"
        component={StudentAssignmentsScreen}
        options={{ title: 'Tasks', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
      />
      <StudentTabs.Screen
        name="/(student)/ai"
        component={StudentAiScreen}
        options={{ title: 'AI Hub', tabBarIcon: ({ color, size }) => <Bot color={color} size={size} /> }}
      />
      <StudentTabs.Screen
        name="/(student)/profile"
        component={StudentProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </StudentTabs.Navigator>
  );
}

function ParentTabNavigator() {
  return (
    <ParentTabs.Navigator screenOptions={defaultTabOptions}>
      <ParentTabs.Screen
        name="/(parent)/dashboard"
        component={ParentDashboardScreen}
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <ParentTabs.Screen
        name="/(parent)/attendance"
        component={ParentAttendanceScreen}
        options={{ title: 'Attendance', tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} /> }}
      />
      <ParentTabs.Screen
        name="/(parent)/fees"
        component={ParentFeesScreen}
        options={{ title: 'Fees', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
      <ParentTabs.Screen
        name="/(parent)/profile"
        component={ParentProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </ParentTabs.Navigator>
  );
}

function FacultyTabNavigator() {
  return (
    <FacultyTabs.Navigator screenOptions={defaultTabOptions}>
      <FacultyTabs.Screen
        name="/(faculty)/dashboard"
        component={FacultyDashboardScreen}
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <TabIcon Icon={Home} color={color} size={size} /> }}
      />
      <FacultyTabs.Screen
        name="/(faculty)/classes"
        component={FacultyClassesScreen}
        options={{ title: 'Classes', tabBarIcon: ({ color, size }) => <TabIcon Icon={Users} color={color} size={size} /> }}
      />
      <FacultyTabs.Screen
        name="/(faculty)/assignments"
        component={FacultyAssignmentsScreen}
        options={{ title: 'Tasks', tabBarIcon: ({ color, size }) => <TabIcon Icon={ClipboardList} color={color} size={size} /> }}
      />
      <FacultyTabs.Screen
        name="/(faculty)/ai"
        component={FacultyAiScreen}
        options={{ title: 'AI', tabBarIcon: ({ color, size }) => <TabIcon Icon={Bot} color={color} size={size} /> }}
      />
      <FacultyTabs.Screen
        name="/(faculty)/profile"
        component={FacultyProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <TabIcon Icon={User} color={color} size={size} /> }}
      />
    </FacultyTabs.Navigator>
  );
}

function CollegeAdminTabNavigator() {
  return (
    <CollegeAdminTabs.Navigator screenOptions={defaultTabOptions}>
      <CollegeAdminTabs.Screen
        name="/(college_admin)/dashboard"
        component={CollegeAdminDashboardScreen}
        options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <TabIcon Icon={Home} color={color} size={size} /> }}
      />
      <CollegeAdminTabs.Screen
        name="/(college_admin)/users"
        component={CollegeAdminUsersScreen}
        options={{ title: 'Users', tabBarIcon: ({ color, size }) => <TabIcon Icon={Users} color={color} size={size} /> }}
      />
      <CollegeAdminTabs.Screen
        name="/(college_admin)/attendance"
        component={CollegeAdminAttendanceScreen}
        options={{ title: 'Attendance', tabBarIcon: ({ color, size }) => <TabIcon Icon={ClipboardCheck} color={color} size={size} /> }}
      />
      <CollegeAdminTabs.Screen
        name="/(college_admin)/academics"
        component={CollegeAdminAcademicsScreen}
        options={{ title: 'Academics', tabBarIcon: ({ color, size }) => <TabIcon Icon={BookOpen} color={color} size={size} /> }}
      />
      <CollegeAdminTabs.Screen
        name="/(college_admin)/reports"
        component={CollegeAdminReportsScreen}
        options={{ title: 'Reports', tabBarIcon: ({ color, size }) => <TabIcon Icon={BarChart3} color={color} size={size} /> }}
      />
      <CollegeAdminTabs.Screen
        name="/(college_admin)/profile"
        component={CollegeAdminProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <TabIcon Icon={User} color={color} size={size} /> }}
      />
    </CollegeAdminTabs.Navigator>
  );
}

function SuperAdminTabNavigator() {
  return (
    <SuperAdminTabs.Navigator screenOptions={defaultTabOptions}>
      <SuperAdminTabs.Screen
        name="/(super_admin)/dashboard"
        component={SuperAdminDashboardScreen}
        options={{ title: 'Overview', tabBarIcon: ({ color, size }) => <TabIcon Icon={Home} color={color} size={size} /> }}
      />
      <SuperAdminTabs.Screen
        name="/(super_admin)/colleges"
        component={SuperAdminCollegesScreen}
        options={{ title: 'Colleges', tabBarIcon: ({ color, size }) => <TabIcon Icon={Building2} color={color} size={size} /> }}
      />
      <SuperAdminTabs.Screen
        name="/(super_admin)/users"
        component={SuperAdminUsersScreen}
        options={{ title: 'Users', tabBarIcon: ({ color, size }) => <TabIcon Icon={Users} color={color} size={size} /> }}
      />
      <SuperAdminTabs.Screen
        name="/(super_admin)/reports"
        component={SuperAdminReportsScreen}
        options={{ title: 'Reports', tabBarIcon: ({ color, size }) => <TabIcon Icon={BarChart3} color={color} size={size} /> }}
      />
      <SuperAdminTabs.Screen
        name="/(super_admin)/profile"
        component={SuperAdminProfileScreen}
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <TabIcon Icon={User} color={color} size={size} /> }}
      />
    </SuperAdminTabs.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <BottomSheetModalProvider>
              <NavigationContainer ref={navigationRef}>
                <RootStack.Navigator screenOptions={{ headerShown: false }}>
                  <RootStack.Screen name="/" component={IndexScreen} />
                  <RootStack.Screen name="/landing" component={LandingScreen} />
                  <RootStack.Screen name="/login" component={LoginScreen} />
                  <RootStack.Screen name="/(student)" component={StudentTabNavigator} />
                  <RootStack.Screen name="/(parent)" component={ParentTabNavigator} />
                  <RootStack.Screen name="/(faculty)" component={FacultyTabNavigator} />
                  <RootStack.Screen name="/(college_admin)" component={CollegeAdminTabNavigator} />
                  <RootStack.Screen name="/(super_admin)" component={SuperAdminTabNavigator} />
                  <RootStack.Screen name="/(student)/fees" component={StudentFeesScreen} />
                  <RootStack.Screen name="/(faculty)/exam-generator" component={FacultyExamGeneratorScreen} />
                  <RootStack.Screen name="/(college_admin)/payments" component={CollegeAdminPaymentsScreen} />
                  <RootStack.Screen name="/(college_admin)/subscription" component={CollegeAdminSubscriptionScreen} />
                  <RootStack.Screen name="/(college_admin)/hostel-admin" component={CollegeAdminHostelAdminScreen} />
                  <RootStack.Screen name="/analytics" component={AnalyticsScreen} />
                  <RootStack.Screen name="/attendance" component={AttendanceScreen} />
                  <RootStack.Screen name="/attendance-live" component={AttendanceLiveScreen} />
                  <RootStack.Screen name="/attendance-advanced" component={AttendanceAdvancedScreen} />
                  <RootStack.Screen name="/attendance-live-advanced" component={AttendanceLiveAdvancedScreen} />
                  <RootStack.Screen name="/leave-management" component={LeaveManagementScreen} />
                  <RootStack.Screen name="/chat" component={ChatScreen} />
                  <RootStack.Screen name="/events" component={EventsScreen} />
                  <RootStack.Screen name="/exams" component={ExamsScreen} />
                  <RootStack.Screen name="/fees" component={FeesScreen} />
                  <RootStack.Screen name="/grievances" component={GrievancesScreen} />
                  <RootStack.Screen name="/hostel" component={HostelScreen} />
                  <RootStack.Screen name="/id-card" component={IdCardScreen} />
                  <RootStack.Screen name="/library" component={LibraryScreen} />
                  <RootStack.Screen name="/notes" component={NotesScreen} />
                  <RootStack.Screen name="/notifications" component={NotificationsScreen} />
                  <RootStack.Screen name="/placement" component={PlacementScreen} />
                  <RootStack.Screen name="/results" component={ResultsScreen} />
                  <RootStack.Screen name="/scan" component={ScanScreen} />
                  <RootStack.Screen name="/selfie" component={SelfieScreen} />
                  <RootStack.Screen name="/session" component={SessionScreen} />
                  <RootStack.Screen name="/start-session" component={StartSessionScreen} />
                  <RootStack.Screen name="/transport" component={TransportScreen} />
                  <RootStack.Screen name="/phone-login" component={PhoneOTPLoginScreen} options={{ headerShown: false }} />
                  <RootStack.Screen name="/visitor" component={VisitorManagementScreen} />
                  <RootStack.Screen name="/complaints" component={ComplaintManagementScreen} />
                  <RootStack.Screen name="/assets" component={AssetManagementScreen} />
                  <RootStack.Screen name="/push-notifications" component={PushNotificationsScreen} />
                  <RootStack.Screen name="/email" component={EmailIntegrationScreen} />
                  <RootStack.Screen name="/whatsapp" component={WhatsAppIntegrationScreen} />
                  <RootStack.Screen name="/(parent)/ai" component={ParentAiScreen} />
                  <RootStack.Screen name="/(faculty)/question-paper" component={FacultyQuestionPaperScreen} />
                  <RootStack.Screen name="/assignment-checker" component={AssignmentCheckerScreen} />
                  <RootStack.Screen name="/report-card" component={ReportCardScreen} />
                  <RootStack.Screen name="/career-advisor" component={CareerAdvisorScreen} />
                  <RootStack.Screen name="/resume-builder" component={ResumeBuilderScreen} />
                  <RootStack.Screen name="/interview-practice" component={InterviewPracticeScreen} />
                  <RootStack.Screen name="/study-planner" component={StudyPlannerScreen} />
                  <RootStack.Screen name="/bus-tracking" component={BusTrackingScreen} />
                  <RootStack.Screen name="/live-classes" component={LiveClassesScreen} />
                  <RootStack.Screen name="/live-class" component={LiveClassRoomScreen} />
                  <RootStack.Screen name="/skill-assessment" component={SkillAssessmentScreen} />
                  <RootStack.Screen name="/assessment-attempt" component={AssessmentAttemptScreen} />
                  <RootStack.Screen name="/mentorship" component={MentorshipScreen} />
                  <RootStack.Screen name="/skill-profile" component={SkillProfileScreen} />
                  <RootStack.Screen name="/career-dashboard" component={CareerDashboardScreen} />
                  <RootStack.Screen name="/face-enroll" component={FaceEnrollScreen} />
                </RootStack.Navigator>
              </NavigationContainer>
            </BottomSheetModalProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
