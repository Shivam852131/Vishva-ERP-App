import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { Camera, CheckCircle2, Circle, Play, Square, AlertTriangle } from 'lucide-react-native';
import { theme } from '@/src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScreenEntry {
  route: string;
  label: string;
  group: string;
  type: 'tab' | 'stack';
}

const ALL_SCREENS: ScreenEntry[] = [
  // Auth
  { route: '/landing', label: 'Landing', group: 'auth', type: 'stack' },
  { route: '/login', label: 'Login', group: 'auth', type: 'stack' },
  { route: '/phone-login', label: 'Phone OTP Login', group: 'auth', type: 'stack' },

  // Student tabs
  { route: '/(student)/dashboard', label: 'Student Dashboard', group: 'student', type: 'tab' },
  { route: '/(student)/timetable', label: 'Student Timetable', group: 'student', type: 'tab' },
  { route: '/(student)/assignments', label: 'Student Assignments', group: 'student', type: 'tab' },
  { route: '/(student)/ai', label: 'Student AI Hub', group: 'student', type: 'tab' },
  { route: '/(student)/profile', label: 'Student Profile', group: 'student', type: 'tab' },

  // Student push screens
  { route: '/(student)/fees', label: 'Student Fees', group: 'student', type: 'stack' },
  { route: '/attendance', label: 'Attendance', group: 'student', type: 'stack' },
  { route: '/attendance-advanced', label: 'Attendance Advanced', group: 'student', type: 'stack' },
  { route: '/exams', label: 'Exams', group: 'student', type: 'stack' },
  { route: '/results', label: 'Results', group: 'student', type: 'stack' },
  { route: '/id-card', label: 'Digital ID Card', group: 'student', type: 'stack' },
  { route: '/face-enroll', label: 'Face ID Enrollment', group: 'student', type: 'stack' },
  { route: '/library', label: 'Library', group: 'student', type: 'stack' },
  { route: '/hostel', label: 'Hostel', group: 'student', type: 'stack' },
  { route: '/transport', label: 'Transport', group: 'student', type: 'stack' },
  { route: '/bus-tracking', label: 'Bus Tracking', group: 'student', type: 'stack' },
  { route: '/leave-management', label: 'Leave Management', group: 'student', type: 'stack' },
  { route: '/grievances', label: 'Grievances', group: 'student', type: 'stack' },
  { route: '/events', label: 'Events', group: 'student', type: 'stack' },
  { route: '/notes', label: 'Notes', group: 'student', type: 'stack' },
  { route: '/live-classes', label: 'Live Classes', group: 'student', type: 'stack' },
  { route: '/live-class', label: 'Live Classroom', group: 'student', type: 'stack' },
  { route: '/chat', label: 'Chat', group: 'student', type: 'stack' },
  { route: '/analytics', label: 'Analytics', group: 'student', type: 'stack' },
  { route: '/scan', label: 'QR Scan', group: 'student', type: 'stack' },
  { route: '/selfie', label: 'Selfie Attendance', group: 'student', type: 'stack' },
  { route: '/career-dashboard', label: 'Career Dashboard', group: 'student', type: 'stack' },
  { route: '/career-advisor', label: 'Career Advisor', group: 'student', type: 'stack' },
  { route: '/skill-profile', label: 'Skill Profile', group: 'student', type: 'stack' },
  { route: '/skill-assessment', label: 'Skill Assessment', group: 'student', type: 'stack' },
  { route: '/assessment-attempt', label: 'Assessment Attempt', group: 'student', type: 'stack' },
  { route: '/mentorship', label: 'Mentorship', group: 'student', type: 'stack' },
  { route: '/placement', label: 'Placement', group: 'student', type: 'stack' },
  { route: '/report-card', label: 'Report Card', group: 'student', type: 'stack' },
  { route: '/assignment-checker', label: 'Assignment Checker', group: 'student', type: 'stack' },
  { route: '/resume-builder', label: 'Resume Builder', group: 'student', type: 'stack' },
  { route: '/interview-practice', label: 'Interview Practice', group: 'student', type: 'stack' },
  { route: '/study-planner', label: 'Study Planner', group: 'student', type: 'stack' },
  { route: '/exam-prep-dashboard', label: 'Exam Prep Dashboard', group: 'student', type: 'stack' },
  { route: '/exam-prep-practice', label: 'Exam Prep Practice', group: 'student', type: 'stack' },
  { route: '/exam-prep-question-bank', label: 'Question Bank', group: 'student', type: 'stack' },
  { route: '/exam-prep-bookmarks', label: 'Exam Prep Bookmarks', group: 'student', type: 'stack' },
  { route: '/exam-prep-attempt', label: 'Exam Prep Attempt', group: 'student', type: 'stack' },
  { route: '/notifications', label: 'Notifications', group: 'shared', type: 'stack' },
  { route: '/push-notifications', label: 'Push Notifications', group: 'shared', type: 'stack' },
  { route: '/email', label: 'Email Integration', group: 'shared', type: 'stack' },
  { route: '/whatsapp', label: 'WhatsApp Integration', group: 'shared', type: 'stack' },
  { route: '/edit-profile', label: 'Edit Profile', group: 'shared', type: 'stack' },

  // Faculty tabs
  { route: '/(faculty)/dashboard', label: 'Faculty Dashboard', group: 'faculty', type: 'tab' },
  { route: '/(faculty)/classes', label: 'Faculty Classes', group: 'faculty', type: 'tab' },
  { route: '/(faculty)/assignments', label: 'Faculty Assignments', group: 'faculty', type: 'tab' },
  { route: '/(faculty)/ai', label: 'Faculty AI', group: 'faculty', type: 'tab' },
  { route: '/(faculty)/profile', label: 'Faculty Profile', group: 'faculty', type: 'tab' },

  // Faculty push screens
  { route: '/(faculty)/exam-generator', label: 'Exam Generator', group: 'faculty', type: 'stack' },
  { route: '/(faculty)/question-paper', label: 'Question Paper', group: 'faculty', type: 'stack' },
  { route: '/exam-prep-question-manager', label: 'Question Manager', group: 'faculty', type: 'stack' },
  { route: '/exam-prep-quiz-builder', label: 'Quiz Builder', group: 'faculty', type: 'stack' },
  { route: '/start-session', label: 'Start Session', group: 'faculty', type: 'stack' },
  { route: '/session', label: 'Live Session', group: 'faculty', type: 'stack' },
  { route: '/attendance-live', label: 'Live Attendance', group: 'faculty', type: 'stack' },
  { route: '/attendance-live-advanced', label: 'Live Attendance Advanced', group: 'faculty', type: 'stack' },

  // Parent tabs
  { route: '/(parent)/dashboard', label: 'Parent Dashboard', group: 'parent', type: 'tab' },
  { route: '/(parent)/attendance', label: 'Parent Attendance', group: 'parent', type: 'tab' },
  { route: '/(parent)/fees', label: 'Parent Fees', group: 'parent', type: 'tab' },
  { route: '/(parent)/ai', label: 'Parent AI', group: 'parent', type: 'tab' },
  { route: '/(parent)/profile', label: 'Parent Profile', group: 'parent', type: 'tab' },

  // College Admin tabs
  { route: '/(college_admin)/dashboard', label: 'Admin Dashboard', group: 'college_admin', type: 'tab' },
  { route: '/(college_admin)/users', label: 'User Management', group: 'college_admin', type: 'tab' },
  { route: '/(college_admin)/attendance', label: 'Admin Attendance', group: 'college_admin', type: 'tab' },
  { route: '/(college_admin)/academics', label: 'Academics', group: 'college_admin', type: 'tab' },
  { route: '/(college_admin)/reports', label: 'Admin Reports', group: 'college_admin', type: 'tab' },
  { route: '/(college_admin)/profile', label: 'Admin Profile', group: 'college_admin', type: 'tab' },

  // College Admin push screens
  { route: '/(college_admin)/payments', label: 'Payments', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/payment-settings', label: 'Payment Settings', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/subscription', label: 'Subscription', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/hostel-admin', label: 'Hostel Admin', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/career-hub', label: 'Career Hub', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/placements', label: 'Placements Admin', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/assessments-admin', label: 'Assessments Admin', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/mentorship-admin', label: 'Mentorship Admin', group: 'college_admin', type: 'stack' },
  { route: '/(college_admin)/skill-admin', label: 'Skill Admin', group: 'college_admin', type: 'stack' },
  { route: '/visitor', label: 'Visitor Management', group: 'admin', type: 'stack' },
  { route: '/complaints', label: 'Complaints', group: 'admin', type: 'stack' },
  { route: '/assets', label: 'Assets', group: 'admin', type: 'stack' },

  // Super Admin tabs
  { route: '/(super_admin)/dashboard', label: 'Super Admin Overview', group: 'super_admin', type: 'tab' },
  { route: '/(super_admin)/colleges', label: 'Colleges', group: 'super_admin', type: 'tab' },
  { route: '/(super_admin)/users', label: 'Super Admin Users', group: 'super_admin', type: 'tab' },
  { route: '/(super_admin)/reports', label: 'Super Admin Reports', group: 'super_admin', type: 'tab' },
  { route: '/(super_admin)/profile', label: 'Super Admin Profile', group: 'super_admin', type: 'tab' },
];

const DELAY_MS = 2500;

const GROUP_COLORS: Record<string, string> = {
  auth: '#6366F1',
  student: '#10B981',
  faculty: '#F59E0B',
  parent: '#EC4899',
  college_admin: '#3B82F6',
  super_admin: '#8B5CF6',
  admin: '#EF4444',
  shared: '#6B7280',
};

export default function ScreenshotTestScreen() {
  const navigation = useNavigation();
  const [running, setRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [errors, setErrors] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const navigateTo = useCallback((entry: ScreenEntry) => {
    try {
      navigation.dispatch(
        CommonActions.navigate({
          name: entry.route,
          params: {},
        })
      );
    } catch {
      // Try without params for tab screens
      try {
        navigation.dispatch(
          CommonActions.navigate({
            name: entry.route,
          })
        );
      } catch {
        // Skip this screen
      }
    }
  }, [navigation]);

  const goBack = useCallback(() => {
    try {
      navigation.dispatch(CommonActions.goBack());
    } catch {}
  }, [navigation]);

  const runNext = useCallback((index: number) => {
    if (index >= ALL_SCREENS.length) {
      setRunning(false);
      setCurrentIndex(-1);
      return;
    }

    setCurrentIndex(index);

    // Navigate to this screen
    navigateTo(ALL_SCREENS[index]);

    // Wait for screen to render, then capture and move to next
    timerRef.current = setTimeout(() => {
      setCompleted(prev => new Set([...prev, index]));
      // Go back before navigating to next
      goBack();
      // Small delay after going back, then next
      timerRef.current = setTimeout(() => {
        runNext(index + 1);
      }, 300);
    }, DELAY_MS);
  }, [navigateTo, goBack]);

  const startCapture = useCallback(() => {
    setRunning(true);
    setCompleted(new Set());
    setErrors(new Set());
    setCurrentIndex(0);
    runNext(0);
  }, [runNext]);

  const stopCapture = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setRunning(false);
    setCurrentIndex(-1);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Auto-scroll to current item
  useEffect(() => {
    if (currentIndex >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: currentIndex * 44, animated: true });
    }
  }, [currentIndex]);

  const groups = [...new Set(ALL_SCREENS.map(s => s.group))];

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Screenshot Capture</Text>
          <Text style={styles.subtitle}>{ALL_SCREENS.length} screens • {DELAY_MS / 1000}s per screen</Text>
        </View>
        <View style={styles.headerActions}>
          {running ? (
            <Pressable onPress={stopCapture} style={styles.stopBtn}>
              <Square color="#fff" size={16} />
              <Text style={styles.stopBtnTxt}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable onPress={startCapture} style={styles.startBtn}>
              <Play color="#fff" size={16} />
              <Text style={styles.startBtnTxt}>Start All</Text>
            </Pressable>
          )}
        </View>
      </View>

      {running && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${((currentIndex + 1) / ALL_SCREENS.length) * 100}%`,
          }]} />
          <Text style={styles.progressText}>
            {currentIndex + 1} / {ALL_SCREENS.length} — {ALL_SCREENS[currentIndex]?.label}
          </Text>
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.list}>
        {groups.map(group => (
          <View key={group}>
            <View style={[styles.groupHeader, { borderLeftColor: GROUP_COLORS[group] || '#666' }]}>
              <Text style={styles.groupLabel}>{group.toUpperCase()}</Text>
              <Text style={styles.groupCount}>{ALL_SCREENS.filter(s => s.group === group).length}</Text>
            </View>
            {ALL_SCREENS.map((screen, i) => {
              if (screen.group !== group) return null;
              const isCurrent = i === currentIndex;
              const isDone = completed.has(i);
              return (
                <View key={i} style={[styles.row, isCurrent && styles.rowActive]}>
                  <View style={styles.rowLeft}>
                    {isDone ? (
                      <CheckCircle2 color="#10B981" size={16} />
                    ) : isCurrent ? (
                      <Camera color={theme.colors.brandPrimary} size={16} />
                    ) : (
                      <Circle color="rgba(255,255,255,0.2)" size={16} />
                    )}
                    <Text style={[styles.rowLabel, isCurrent && styles.rowLabelActive, isDone && styles.rowLabelDone]}>
                      {screen.label}
                    </Text>
                  </View>
                  <Text style={[styles.rowRoute, isCurrent && styles.rowRouteActive]}>
                    {screen.route}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerTxt}>
          Run: adb shell screencap to capture each screen
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0F0D' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  startBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  stopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  stopBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },

  progressBar: { height: 28, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(16,185,129,0.3)', borderRadius: 14 },
  progressText: { color: '#fff', fontSize: 11, fontWeight: '600', textAlign: 'center', lineHeight: 28 },

  list: { flex: 1 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderLeftWidth: 3, marginTop: 8 },
  groupLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  groupCount: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 },
  rowActive: { backgroundColor: 'rgba(99,102,241,0.15)' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  rowLabelActive: { color: '#fff', fontWeight: '700' },
  rowLabelDone: { color: '#10B981' },
  rowRoute: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'monospace' },
  rowRouteActive: { color: 'rgba(99,102,241,0.8)' },

  footer: { padding: 12, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  footerTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
});
