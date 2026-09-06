import React, { Suspense } from 'react';
import { ActivityIndicator, View, StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/ErrorBoundary';
import { navigationRef } from './src/navigation/navigation-ref';
import { AuthProvider } from './src/providers/AuthContext';
import { theme } from './src/theme';

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
      <ActivityIndicator size="large" color={theme.colors.brand} />
    </View>
  );
}

const LS = (fn: () => Promise<{ default: React.ComponentType<any> }>) => React.lazy(fn);

// ── Role-based navigators — only the active role's code is loaded ──
const StudentTabNavigator = LS(() => import('./src/navigation/StudentNavigator'));
const ParentTabNavigator = LS(() => import('./src/navigation/ParentNavigator'));
const FacultyTabNavigator = LS(() => import('./src/navigation/FacultyNavigator'));
const CollegeAdminTabNavigator = LS(() => import('./src/navigation/CollegeAdminNavigator'));
const SuperAdminTabNavigator = LS(() => import('./src/navigation/SuperAdminNavigator'));

// ── Auth screens ──
const IndexScreen = LS(() => import('./app/index'));
const LandingScreen = LS(() => import('./app/landing'));
const LoginScreen = LS(() => import('./app/login'));
const PhoneOTPLoginScreen = LS(() => import('./app/phone-login'));

// ── Role sub-screens ──
const StudentFeesScreen = LS(() => import('./app/(student)/fees'));
const ParentAiScreen = LS(() => import('./app/(parent)/ai'));
const FacultyExamGeneratorScreen = LS(() => import('./app/(faculty)/exam-generator'));
const FacultyQuestionPaperScreen = LS(() => import('./app/(faculty)/question-paper'));
const CollegeAdminPaymentsScreen = LS(() => import('./app/(college_admin)/payments'));
const CollegeAdminSubscriptionScreen = LS(() => import('./app/(college_admin)/subscription'));
const CollegeAdminHostelAdminScreen = LS(() => import('./app/(college_admin)/hostel-admin'));
const CollegeAdminPaymentSettingsScreen = LS(() => import('./app/(college_admin)/payment-settings'));
const CollegeAdminCareerHubScreen = LS(() => import('./app/(college_admin)/career-hub'));
const CollegeAdminPlacementsScreen = LS(() => import('./app/(college_admin)/placements'));
const CollegeAdminAssessmentsAdminScreen = LS(() => import('./app/(college_admin)/assessments-admin'));
const CollegeAdminMentorshipAdminScreen = LS(() => import('./app/(college_admin)/mentorship-admin'));
const CollegeAdminSkillAdminScreen = LS(() => import('./app/(college_admin)/skill-admin'));

// ── Shared screens ──
const AnalyticsScreen = LS(() => import('./app/analytics'));
const AttendanceScreen = LS(() => import('./app/attendance'));
const AttendanceLiveScreen = LS(() => import('./app/attendance-live'));
const AttendanceAdvancedScreen = LS(() => import('./app/attendance-advanced'));
const AttendanceLiveAdvancedScreen = LS(() => import('./app/attendance-live-advanced'));
const LeaveManagementScreen = LS(() => import('./app/leave-management'));
const ChatScreen = LS(() => import('./app/chat'));
const EventsScreen = LS(() => import('./app/events'));
const ExamsScreen = LS(() => import('./app/exams'));
const FeesScreen = LS(() => import('./app/fees'));
const GrievancesScreen = LS(() => import('./app/grievances'));
const HostelScreen = LS(() => import('./app/hostel'));
const IdCardScreen = LS(() => import('./app/id-card'));
const LibraryScreen = LS(() => import('./app/library'));
const NotesScreen = LS(() => import('./app/notes'));
const NotificationsScreen = LS(() => import('./app/notifications'));
const PlacementScreen = LS(() => import('./app/placement'));
const ResultsScreen = LS(() => import('./app/results'));
const ScanScreen = LS(() => import('./app/scan'));
const SelfieScreen = LS(() => import('./app/selfie'));
const SessionScreen = LS(() => import('./app/session'));
const StartSessionScreen = LS(() => import('./app/start-session'));
const TransportScreen = LS(() => import('./app/transport'));
const VisitorManagementScreen = LS(() => import('./app/visitor'));
const ComplaintManagementScreen = LS(() => import('./app/complaints'));
const AssetManagementScreen = LS(() => import('./app/assets'));
const PushNotificationsScreen = LS(() => import('./app/push-notifications'));
const EmailIntegrationScreen = LS(() => import('./app/email'));
const WhatsAppIntegrationScreen = LS(() => import('./app/whatsapp'));
const AssignmentCheckerScreen = LS(() => import('./app/assignment-checker'));
const ReportCardScreen = LS(() => import('./app/report-card'));
const CareerAdvisorScreen = LS(() => import('./app/career-advisor'));
const ResumeBuilderScreen = LS(() => import('./app/resume-builder'));
const InterviewPracticeScreen = LS(() => import('./app/interview-practice'));
const StudyPlannerScreen = LS(() => import('./app/study-planner'));
const BusTrackingScreen = LS(() => import('./app/bus-tracking'));
const LiveClassesScreen = LS(() => import('./app/live-classes'));
const LiveClassRoomScreen = LS(() => import('./app/live-class'));
const SkillAssessmentScreen = LS(() => import('./app/skill-assessment'));
const AssessmentAttemptScreen = LS(() => import('./app/assessment-attempt'));
const MentorshipScreen = LS(() => import('./app/mentorship'));
const SkillProfileScreen = LS(() => import('./app/skill-profile'));
const CareerDashboardScreen = LS(() => import('./app/career-dashboard'));
const FaceEnrollScreen = LS(() => import('./app/face-enroll'));
const EditProfileScreen = LS(() => import('./app/edit-profile'));
const ScreenshotTestScreen = LS(() => import('./app/screenshot-test'));
const LocalShareHomeScreen = LS(() => import('./app/localshare-home'));
const LocalShareCreateScreen = LS(() => import('./app/localshare-create'));
const LocalShareActiveScreen = LS(() => import('./app/localshare-active'));
const LocalShareJoinScreen = LS(() => import('./app/localshare-join'));
const LocalShareTransferScreen = LS(() => import('./app/localshare-transfer'));
const LocalShareHistoryScreen = LS(() => import('./app/localshare-history'));

const RootStack = createNativeStackNavigator();

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={theme.colors.surface}
            translucent={false}
          />
          <AuthProvider>
            <BottomSheetModalProvider>
              <NavigationContainer ref={navigationRef}>
                <Suspense fallback={<LoadingScreen />}>
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
                  <RootStack.Screen name="/(college_admin)/payment-settings" component={CollegeAdminPaymentSettingsScreen} />
                  <RootStack.Screen name="/(college_admin)/subscription" component={CollegeAdminSubscriptionScreen} />
                  <RootStack.Screen name="/(college_admin)/hostel-admin" component={CollegeAdminHostelAdminScreen} />
                  <RootStack.Screen name="/(college_admin)/career-hub" component={CollegeAdminCareerHubScreen} />
                  <RootStack.Screen name="/(college_admin)/placements" component={CollegeAdminPlacementsScreen} />
                  <RootStack.Screen name="/(college_admin)/assessments-admin" component={CollegeAdminAssessmentsAdminScreen} />
                  <RootStack.Screen name="/(college_admin)/mentorship-admin" component={CollegeAdminMentorshipAdminScreen} />
                  <RootStack.Screen name="/(college_admin)/skill-admin" component={CollegeAdminSkillAdminScreen} />
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
                  <RootStack.Screen name="/edit-profile" component={EditProfileScreen} />
                  <RootStack.Screen name="/localshare" component={LocalShareHomeScreen} />
                  <RootStack.Screen name="/localshare-create" component={LocalShareCreateScreen} />
                  <RootStack.Screen name="/localshare-active" component={LocalShareActiveScreen} />
                  <RootStack.Screen name="/localshare-join" component={LocalShareJoinScreen} />
                  <RootStack.Screen name="/localshare-transfer" component={LocalShareTransferScreen} />
                  <RootStack.Screen name="/localshare-history" component={LocalShareHistoryScreen} />
                  <RootStack.Screen name="/__screenshots" component={ScreenshotTestScreen} options={{ headerShown: false }} />
                </RootStack.Navigator>
                </Suspense>
              </NavigationContainer>
            </BottomSheetModalProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
