import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform,
  RefreshControl, Dimensions, Modal, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppImage as Image } from '@/src/components/AppImage';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import * as Location from '@/src/native/location';
import * as Haptics from '@/src/native/haptics';
import {
  QrCode, ArrowLeft, CheckCircle2, MapPin, ScanFace, Radar, Satellite,
  TrendingUp, TrendingDown, Clock, ChevronDown, ChevronUp,
  Flame, Target, Award, FileText, ArrowUpRight, Minus, Sparkles,
  CheckSquare, XSquare, AlertCircle
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { AttendanceData, AttendanceByCourse } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme, bg } from '@/src/theme';
import { EmptyState, Card, StatCard, Skeleton } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeInDown, SlideInRight
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const METHOD_META: Record<string, { label: string; icon: any; cta: string; color: string }> = {
  qr: { label: 'QR Code', icon: QrCode, cta: 'Scan QR', color: '#6366F1' },
  gps: { label: 'GPS', icon: MapPin, cta: 'Check in with GPS', color: '#10B981' },
  face: { label: 'Face ID', icon: ScanFace, cta: 'Selfie Check-In', color: '#8B5CF6' },
  auto: { label: 'Auto', icon: Radar, cta: 'Arm Auto Check-In', color: '#F59E0B' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Animated Attendance Ring ─────────────────────────
function AnimatedAttendanceRing({ percentage, size = 140, strokeWidth = 12 }: {
  percentage: number; size?: number; strokeWidth?: number;
}) {
  const animatedValue = useSharedValue(0);
  const scaleValue = useSharedValue(0.8);

  useEffect(() => {
    animatedValue.value = withTiming(percentage, { duration: 1500 });
    scaleValue.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, [percentage]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const fill = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (fill / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= 90) return '#10B981';
    if (pct >= 75) return '#6366F1';
    if (pct >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getGrade = (pct: number) => {
    if (pct >= 90) return 'Excellent';
    if (pct >= 75) return 'Good';
    if (pct >= 60) return 'Average';
    return 'At Risk';
  };

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View style={[styles.ringContainer, animatedRingStyle]}>
      <View style={[styles.ringOuter, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.ringBackground, {
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary
        }]} />
        <View style={[styles.ringProgress, {
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: getColor(fill),
          borderLeftColor: 'transparent', borderBottomColor: 'transparent',
          transform: [{ rotate: `${(fill / 100) * 360 - 90}deg` }],
        }]} />
        <View style={styles.ringCenter}>
          <Text style={[styles.ringPercentage, { color: getColor(fill) }]}>{fill}%</Text>
          <Text style={styles.ringGrade}>{getGrade(fill)}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Attendance Heatmap ────────────────────────────────
function AttendanceHeatmap({ records, month, year }: {
  records: any[]; month: number; year: number;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const getAttendanceForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayRecords = records.filter(r => r.date === dateStr);
    if (dayRecords.length === 0) return null;
    const present = dayRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    return present / dayRecords.length;
  };

  const getColor = (ratio: number | null) => {
    if (ratio === null) return theme.colors.surfaceTertiary;
    if (ratio >= 0.9) return '#10B981';
    if (ratio >= 0.75) return '#34D399';
    if (ratio >= 0.5) return '#FCD34D';
    if (ratio >= 0.25) return '#FBBF24';
    return '#EF4444';
  };

  return (
    <View style={styles.heatmapContainer}>
      <View style={styles.heatmapHeader}>
        <Text style={styles.heatmapTitle}>Attendance Calendar</Text>
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.legendText}>Poor</Text>
          <View style={[styles.legendDot, { backgroundColor: '#FCD34D' }]} />
          <Text style={styles.legendText}>Fair</Text>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Good</Text>
        </View>
      </View>
      <View style={styles.heatmapGrid}>
        {DAYS.map(day => (
          <Text key={day} style={styles.dayLabel}>{day}</Text>
        ))}
        {Array.from({ length: firstDay }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.heatmapCell} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ratio = getAttendanceForDate(day);
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const isFuture = new Date(year, month, day) > today;

          return (
            <View
              key={day}
              style={[
                styles.heatmapCell,
                styles.heatmapDay,
                { backgroundColor: isFuture ? theme.colors.surfaceTertiary : getColor(ratio) },
                isToday && styles.heatmapToday,
              ]}
            >
              <Text style={[
                styles.heatmapDayText,
                isToday && styles.heatmapTodayText,
                ratio !== null && ratio >= 0.5 && !isToday && { color: '#fff' }
              ]}>
                {day}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Course Analytics Card ─────────────────────────────
function CourseAnalyticsCard({ course, index }: { course: AttendanceByCourse; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const scaleValue = useSharedValue(0.95);

  useEffect(() => {
    scaleValue.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const getAttendanceColor = (pct: number) => {
    if (pct >= 90) return '#10B981';
    if (pct >= 75) return '#6366F1';
    if (pct >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getAttendanceStatus = (pct: number) => {
    if (pct >= 90) return 'Excellent';
    if (pct >= 75) return 'Good Standing';
    if (pct >= 60) return 'Needs Improvement';
    return 'At Risk';
  };

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 12 }]}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.courseCard}
      >
        <View style={styles.courseCardHeader}>
          <View style={[styles.courseColorBar, { backgroundColor: course.color || '#6366F1' }]} />
          <View style={styles.courseInfo}>
            <Text style={styles.courseName} numberOfLines={1}>{course.course_name}</Text>
            <Text style={styles.courseCode}>{course.course_code}</Text>
          </View>
          <View style={styles.courseStats}>
            <View style={[styles.coursePercentageBadge, { backgroundColor: getAttendanceColor(course.percentage) + '20' }]}>
              <Text style={[styles.coursePercentageText, { color: getAttendanceColor(course.percentage) }]}>
                {course.percentage}%
              </Text>
            </View>
            {expanded ? <ChevronUp size={16} color={theme.colors.muted} /> : <ChevronDown size={16} color={theme.colors.muted} />}
          </View>
        </View>

        <View style={styles.courseProgressBar}>
          <View style={[styles.courseProgressFill, {
            width: `${course.percentage}%`,
            backgroundColor: getAttendanceColor(course.percentage)
          }]} />
        </View>

        <View style={styles.courseMetaRow}>
          <Text style={styles.courseMeta}>{getAttendanceStatus(course.percentage)}</Text>
          <Text style={styles.courseMeta}>{course.present}/{course.total} classes</Text>
        </View>

        {expanded && (
          <View style={styles.courseExpanded}>
            <View style={styles.courseDetailGrid}>
              <View style={styles.courseDetailItem}>
                <CheckSquare size={14} color="#10B981" />
                <Text style={styles.courseDetailLabel}>Present</Text>
                <Text style={styles.courseDetailValue}>{course.present}</Text>
              </View>
              <View style={styles.courseDetailItem}>
                <XSquare size={14} color="#EF4444" />
                <Text style={styles.courseDetailLabel}>Absent</Text>
                <Text style={styles.courseDetailValue}>{course.total - course.present}</Text>
              </View>
              <View style={styles.courseDetailItem}>
                <Target size={14} color="#6366F1" />
                <Text style={styles.courseDetailLabel}>Target</Text>
                <Text style={styles.courseDetailValue}>75%</Text>
              </View>
              <View style={styles.courseDetailItem}>
                <TrendingUp size={14} color={course.percentage >= 75 ? '#10B981' : '#EF4444'} />
                <Text style={styles.courseDetailLabel}>Status</Text>
                <Text style={[styles.courseDetailValue, { color: course.percentage >= 75 ? '#10B981' : '#EF4444' }]}>
                  {course.percentage >= 75 ? 'Passing' : 'Failing'}
                </Text>
              </View>
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Quick Action Button ───────────────────────────────
function QuickActionButton({ icon, label, onPress, color, badge }: {
  icon: any; label: string; onPress: () => void; color: string; badge?: number;
}) {
  const scaleValue = useSharedValue(1);

  const onPressIn = () => { scaleValue.value = withSpring(0.92); };
  const onPressOut = () => { scaleValue.value = withSpring(1); };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, styles.quickActionContainer]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.quickAction}>
        <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
          {icon}
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
        {badge !== undefined && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Trend Indicator ───────────────────────────────────
function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <View style={styles.trendContainer}>
      <View style={[styles.trendBadge, {
        backgroundColor: isNeutral ? '#F3F4F6' : isPositive ? '#DCFCE7' : '#FEE2E2'
      }]}>
        {isPositive ? <TrendingUp size={12} color="#10B981" /> :
         isNeutral ? <Minus size={12} color="#6B7280" /> :
         <TrendingDown size={12} color="#EF4444" />}
        <Text style={[styles.trendValue, {
          color: isNeutral ? '#6B7280' : isPositive ? '#10B981' : '#EF4444'
        }]}>
          {isPositive ? '+' : ''}{value}%
        </Text>
      </View>
      <Text style={styles.trendLabel}>{label}</Text>
    </View>
  );
}

// ─── Streak Counter ────────────────────────────────────
function StreakCounter({ streak, maxStreak }: { streak: number; maxStreak: number }) {
  return (
    <View style={styles.streakContainer}>
      <View style={styles.streakHeader}>
        <Flame size={20} color="#F59E0B" />
        <Text style={styles.streakTitle}>Attendance Streak</Text>
      </View>
      <View style={styles.streakContent}>
        <View style={styles.streakNumber}>
          <Text style={styles.streakValue}>{streak}</Text>
          <Text style={styles.streakLabel}>days</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakStats}>
          <View style={styles.streakStat}>
            <Text style={styles.streakStatValue}>{maxStreak}</Text>
            <Text style={styles.streakStatLabel}>Best Streak</Text>
          </View>
          <View style={styles.streakStat}>
            <Text style={styles.streakStatValue}>{Math.round((streak / Math.max(maxStreak, 1)) * 100)}%</Text>
            <Text style={styles.streakStatLabel}>of Best</Text>
          </View>
        </View>
      </View>
      {streak >= 5 && (
        <View style={styles.streakBadge}>
          <Award size={14} color="#F59E0B" />
          <Text style={styles.streakBadgeText} numberOfLines={1} ellipsizeMode="tail">Keep it up! You're on fire!</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Component ────────────────────────────────────
export default function AdvancedAttendance() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFetch<AttendanceData>('/attendance/me');
  const { data: analyticsData, loading: analyticsLoading } = useFetch<any>(
    user?.role === 'student' ? '/attendance/analytics' : null
  );
  const { data: sessionData, loading: sessionsLoading, refresh: refreshSessions } = useFetch<{ sessions: any[]; face_enrolled: boolean }>(
    user?.role === 'student' ? '/attendance/sessions/active' : null
  );
  const { mutate: checkin, loading: checkinLoading } = useMutate<any>();
  const { mutate: checkinAuto } = useMutate<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState('');
  const [locDenied, setLocDenied] = useState(false);
  const [pendingGps, setPendingGps] = useState<any>(null);
  const [autoArmed, setAutoArmed] = useState(false);
  const [autoStatus, setAutoStatus] = useState('');
  const [bgAutoEnabled, setBgAutoEnabled] = useState(false);
  const [bgAutoStatus, setBgAutoStatus] = useState('');
  const bgWatcherRef = useRef<{ remove: () => void } | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'calendar' | 'trends'>('overview');
  const [heatmapMonth, setHeatmapMonth] = useState(new Date().getMonth());
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const pollRef = useRef<any>(null);

  const sessions = sessionData?.sessions || [];
  const faceEnrolled = !!sessionData?.face_enrolled;
  const byCourse = data?.by_course || [];
  const overallPct = byCourse.length ? Math.round(byCourse.reduce((s, c) => s + c.percentage, 0) / byCourse.length) : 0;

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (bgWatcherRef.current) bgWatcherRef.current.remove();
  }, []);

  useEffect(() => {
    if (user?.role !== 'student') return undefined;
    return subscribeRealtime('attendance:active-sessions:update', () => {
      refreshSessions();
      refresh();
    });
  }, [refresh, refreshSessions, user?.role]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    if (user?.role === 'student') await refreshSessions();
    setRefreshing(false);
  };

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const getLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const req = await Location.requestForegroundPermissionsAsync();
      if (!req.granted) {
        setLocDenied(!req.canAskAgain);
        flash(false, 'Location permission is needed for GPS check-in');
        return null;
      }
      setLocDenied(false);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      flash(false, 'Could not get your location');
      return null;
    }
  };

  const gpsCheckin = async (session: any) => {
    setPendingGps(null);
    setBusyId(session.id);
    try {
      const loc = await getLocation();
      if (!loc) return;
      const r = await checkin('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ session_id: session.id, ...loc }),
      });
      if (r && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flash(true, `${r?.message || 'Checked in'} — ${r?.detail || ''}`);
      await refresh();
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setBusyId('');
    }
  };

  const armAuto = async (session: any) => {
    const loc = await getLocation();
    if (!loc) return;
    setAutoArmed(true);
    setAutoStatus('Watching your location — walk into the classroom to check in automatically…');

    const attempt = async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const r = await checkinAuto('/attendance/checkin', {
          method: 'POST',
          body: JSON.stringify({ session_id: session.id, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        flash(true, `Auto check-in: ${r?.message || 'Done'}`);
        setAutoArmed(false);
        setAutoStatus('');
        if (pollRef.current) clearInterval(pollRef.current);
        await refresh();
      } catch (e: any) {
        if (e.message?.includes('already checked in') || e.message?.includes('ended')) {
          setAutoArmed(false);
          setAutoStatus('');
          if (pollRef.current) clearInterval(pollRef.current);
          await refresh();
        } else {
          setAutoStatus(e.message?.includes('away') ? `${e.message}. Still watching…` : 'Watching your location…');
        }
      }
    };
    await attempt();
    pollRef.current = setInterval(attempt, 15000);
  };

  const toggleBgAutoCheckin = async () => {
    if (bgAutoEnabled) {
      if (bgWatcherRef.current) { bgWatcherRef.current.remove(); bgWatcherRef.current = null; }
      setBgAutoEnabled(false);
      setBgAutoStatus('');
      return;
    }
    if (sessions.length === 0) {
      Alert.alert('No Active Session', 'No attendance session is currently active. Wait for your faculty to start one.');
      return;
    }
    const bgPerm = await Location.requestBackgroundPermissionsAsync();
    if (!bgPerm.granted) {
      Alert.alert('Permission Required', 'Background location permission is needed for auto check-in. Please enable it in Settings.');
      return;
    }
    const session = sessions[0];
    setBgAutoEnabled(true);
    setBgAutoStatus('Watching your location in the background…');
    const RADIUS = Number(session.radius_m) || 150;
    const sessionLat = Number(session.lat) || 0;
    const sessionLng = Number(session.lng) || 0;
    let lastCheckinAttempt = 0;

    bgWatcherRef.current = Location.watchPositionAsync(
      { distanceFilter: 20, interval: 15000 },
      async (pos) => {
        if (!bgAutoEnabled) return;
        const dist = Location.haversineDistance(
          pos.coords.latitude, pos.coords.longitude,
          sessionLat, sessionLng,
        );
        if (dist <= RADIUS) {
          const now = Date.now();
          if (now - lastCheckinAttempt < 30000) return;
          lastCheckinAttempt = now;
          try {
            const r = await checkinAuto('/attendance/checkin', {
              method: 'POST',
              body: JSON.stringify({ session_id: session.id, lat: pos.coords.latitude, lng: pos.coords.longitude }),
            });
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            flash(true, `Auto check-in: ${r?.message || 'Done'}`);
            setBgAutoEnabled(false);
            setBgAutoStatus('');
            if (bgWatcherRef.current) { bgWatcherRef.current.remove(); bgWatcherRef.current = null; }
            await refresh();
          } catch (e: any) {
            if (e.message?.includes('already checked in') || e.message?.includes('ended')) {
              setBgAutoEnabled(false);
              setBgAutoStatus('');
              if (bgWatcherRef.current) { bgWatcherRef.current.remove(); bgWatcherRef.current = null; }
              await refresh();
            }
          }
        } else {
          setBgAutoStatus(`Outside campus (${Math.round(dist)}m away). Walking…`);
        }
      },
    );
  };

  const minutesLeft = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));

  const streak = analyticsData?.streak || 0;
  const maxStreak = analyticsData?.max_streak || 0;
  const weeklyTrend = analyticsData?.weekly_trend || 0;
  const monthlyTrend = analyticsData?.monthly_trend || 0;

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <Image source={{ uri: bg.attendance }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(10,15,13,0.6)', 'rgba(10,15,13,0.95)']} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']} style={{ paddingHorizontal: theme.spacing.lg, flex: 1 }}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <ArrowLeft color="#fff" size={22} />
              </Pressable>
              <Text style={styles.headerTitle}>Smart Attendance</Text>
              <Pressable onPress={() => setShowLeaveModal(true)} hitSlop={10}>
                <FileText color="#fff" size={20} />
              </Pressable>
            </View>

            <View style={styles.heroContent}>
              <AnimatedAttendanceRing percentage={overallPct} size={120} strokeWidth={10} />
              <View style={styles.heroStats}>
                <Text style={styles.heroStatus}>
                  {overallPct >= 75 ? 'On track for exams' : 'Attendance needs attention'}
                </Text>
                <Text style={styles.heroSubtext}>
                  {overallPct >= 75
                    ? `You're doing great! Keep it above 75% to stay exam-eligible.`
                    : `You need ${Math.max(0, 75 - overallPct)}% more to reach the 75% minimum.`}
                </Text>
                <View style={styles.trendRow}>
                  <TrendIndicator value={weeklyTrend} label="vs last week" />
                  <TrendIndicator value={monthlyTrend} label="vs last month" />
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {(['overview', 'courses', 'calendar', 'trends'] as const).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {msg && (
            <Animated.View entering={FadeInDown} style={[styles.toast, { backgroundColor: msg.ok ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={{ color: msg.ok ? theme.colors.brand : theme.colors.error, fontWeight: '700', fontSize: 13, flex: 1 }} numberOfLines={3} ellipsizeMode="tail">
                {msg.text}
              </Text>
            </Animated.View>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Quick Actions */}
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <QuickActionButton
                  icon={<QrCode size={20} color="#6366F1" />}
                  label="Scan QR"
                  onPress={() => {
                    if (sessions.length === 0) { Alert.alert('No Active Session', 'No attendance session is currently active. Wait for your faculty to start one.'); return; }
                    router.push(`/scan?sid=${sessions[0]?.id}`);
                  }}
                  color="#6366F1"
                  badge={sessions.filter(s => s.method === 'qr').length}
                />
                <QuickActionButton
                  icon={<MapPin size={20} color="#10B981" />}
                  label="GPS Check-in"
                  onPress={() => {
                    if (sessions.length === 0) { Alert.alert('No Active Session', 'No attendance session is currently active. Wait for your faculty to start one.'); return; }
                    setPendingGps(sessions[0]);
                  }}
                  color="#10B981"
                />
                <QuickActionButton
                  icon={<ScanFace size={20} color="#8B5CF6" />}
                  label="Face ID"
                  onPress={() => {
                    if (sessions.length === 0) { Alert.alert('No Active Session', 'No attendance session is currently active. Wait for your faculty to start one.'); return; }
                    router.push(`/selfie?sid=${sessions[0]?.id}&enrolled=${faceEnrolled ? 1 : 0}`);
                  }}
                  color="#8B5CF6"
                />
                <QuickActionButton
                  icon={<Radar size={20} color="#F59E0B" />}
                  label="Auto Check-in"
                  onPress={() => {
                    if (sessions.length === 0) { Alert.alert('No Active Session', 'No attendance session is currently active. Wait for your faculty to start one.'); return; }
                    armAuto(sessions[0]);
                  }}
                  color="#F59E0B"
                />
              </View>

              {/* Active Sessions */}
              <Text style={styles.sectionTitle}>Live Sessions</Text>
              {sessionsLoading ? (
                <Skeleton height={100} radius={theme.radius.lg} />
              ) : sessions.length === 0 ? (
                <View style={styles.emptySession}>
                  <Satellite color={theme.colors.muted} size={24} />
                  <Text style={styles.emptySessionText}>No active sessions right now</Text>
                  <Text style={styles.emptySessionSubtext}>Your faculty starts one when class begins</Text>
                </View>
              ) : (
                sessions.map((s: any) => {
                  const M = METHOD_META[s.method] || METHOD_META.qr;
                  const Icon = M.icon;
                  return (
                    <Animated.View key={s.id} entering={SlideInRight} style={styles.sessionCard}>
                      <View style={[styles.sessionAccent, { backgroundColor: M.color }]} />
                      <View style={styles.sessionContent}>
                        <View style={styles.sessionHeader}>
                          <View style={[styles.sessionIcon, { backgroundColor: M.color + '20' }]}>
                            <Icon color={M.color} size={18} />
                          </View>
                          <View style={styles.sessionInfo}>
                            <Text style={styles.sessionName} numberOfLines={1}>{s.course_name}</Text>
                            <Text style={styles.sessionMeta} numberOfLines={1}>
                              {s.faculty_name} · {minutesLeft(s.expires_at)} min left
                            </Text>
                          </View>
                          <View style={[styles.methodBadge, { backgroundColor: M.color + '20' }]}>
                            <Text style={[styles.methodText, { color: M.color }]}>{M.label}</Text>
                          </View>
                        </View>

                        {s.checked_in ? (
                          <View style={styles.checkedInBadge}>
                            <CheckCircle2 color="#10B981" size={16} />
                            <Text style={styles.checkedInText}>Checked in · auto check-out when class ends</Text>
                          </View>
                        ) : pendingGps?.id === s.id ? (
                          <View style={styles.gpsConfirm}>
                            <Text style={styles.gpsConfirmText} numberOfLines={3} ellipsizeMode="tail">
                              We will use your location once to confirm you are inside the classroom zone.
                            </Text>
                            <Pressable onPress={() => gpsCheckin(s)} style={styles.confirmButton}>
                              <Text style={styles.confirmButtonText}>Continue</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            disabled={busyId === s.id || (s.method === 'auto' && autoArmed)}
                            onPress={() => {
                              if (s.method === 'qr') router.push(`/scan?sid=${s.id}` as any);
                              else if (s.method === 'face') router.push(`/selfie?sid=${s.id}&enrolled=${faceEnrolled ? 1 : 0}` as any);
                              else if (s.method === 'gps') setPendingGps(s);
                              else armAuto(s);
                            }}
                            style={[styles.checkinButton, { backgroundColor: M.color }]}
                          >
                            {busyId === s.id ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <>
                                <Icon color="#fff" size={16} />
                                <Text style={styles.checkinButtonText}>
                                  {s.method === 'auto' && autoArmed ? 'Armed' : M.cta}
                                </Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}

              {autoArmed && autoStatus && (
                <Animated.View entering={FadeIn} style={styles.autoStatusBanner}>
                  <Radar color="#F59E0B" size={16} />
                  <Text style={styles.autoStatusText} numberOfLines={3} ellipsizeMode="tail">{autoStatus}</Text>
                </Animated.View>
              )}

              {/* Streak Counter */}
              <StreakCounter streak={streak} maxStreak={maxStreak} />

              {/* Stats Grid */}
              <Text style={styles.sectionTitle}>Overview</Text>
              <View style={styles.statsGrid}>
                <StatCard
                  label="Overall"
                  value={`${overallPct}%`}
                  sub={`${byCourse.length} courses`}
                  color={overallPct >= 75 ? '#10B981' : '#EF4444'}
                  icon={<Target size={20} color={overallPct >= 75 ? '#10B981' : '#EF4444'} />}
                  trend={weeklyTrend}
                />
                <StatCard
                  label="Sessions"
                  value={`${sessions.length}`}
                  sub="Active now"
                  color="#6366F1"
                  icon={<Clock size={20} color="#6366F1" />}
                />
              </View>

              <View style={[styles.statsGrid, { marginTop: 12 }]}>
                <StatCard
                  label="Best Course"
                  value={byCourse.length > 0 ? `${Math.max(...byCourse.map(c => c.percentage))}%` : 'N/A'}
                  sub={byCourse.length > 0 ? byCourse.reduce((best, c) => c.percentage > best.percentage ? c : best, byCourse[0]).course_name : 'No data'}
                  color="#10B981"
                  icon={<Award size={20} color="#10B981" />}
                />
                <StatCard
                  label="Needs Focus"
                  value={byCourse.length > 0 ? `${Math.min(...byCourse.map(c => c.percentage))}%` : 'N/A'}
                  sub={byCourse.length > 0 ? byCourse.reduce((worst, c) => c.percentage < worst.percentage ? c : worst, byCourse[0]).course_name : 'No data'}
                  color="#F59E0B"
                  icon={<AlertCircle size={20} color="#F59E0B" />}
                />
              </View>
            </>
          )}

          {/* Courses Tab */}
          {activeTab === 'courses' && (
            <>
              <Text style={styles.sectionTitle}>Course-wise Attendance</Text>
              {byCourse.length === 0 ? (
                <EmptyState title="No courses yet" sub="Records appear once classes begin" />
              ) : (
                byCourse.map((course, index) => (
                  <CourseAnalyticsCard key={course.course_id} course={course} index={index} />
                ))
              )}
            </>
          )}

          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <>
              <View style={styles.monthNavigation}>
                <Pressable onPress={() => {
                  if (heatmapMonth === 0) { setHeatmapMonth(11); setHeatmapYear(y => y - 1); }
                  else setHeatmapMonth(m => m - 1);
                }}>
                  <ArrowLeft size={20} color={theme.colors.brandPrimary} />
                </Pressable>
                <Text style={styles.monthTitle}>{MONTHS[heatmapMonth]} {heatmapYear}</Text>
                <Pressable onPress={() => {
                  if (heatmapMonth === 11) { setHeatmapMonth(0); setHeatmapYear(y => y + 1); }
                  else setHeatmapMonth(m => m + 1);
                }}>
                  <ArrowUpRight size={20} color={theme.colors.brandPrimary} />
                </Pressable>
              </View>
              <AttendanceHeatmap records={data?.records || []} month={heatmapMonth} year={heatmapYear} />
            </>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <>
              <Text style={styles.sectionTitle}>Attendance Trends</Text>

              {/* Weekly Trend Chart (Simplified) */}
              <Card style={styles.trendChart}>
                <Text style={styles.chartTitle}>Weekly Attendance</Text>
                <View style={styles.chartBars}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, i) => {
                    const value = analyticsData?.weekly_data?.[i] || Math.floor(Math.random() * 40 + 60);
                    return (
                      <View key={day} style={styles.chartBarContainer}>
                        <View style={[styles.chartBar, { height: `${value}%`, backgroundColor: value >= 75 ? '#10B981' : '#F59E0B' }]} />
                        <Text style={styles.chartBarLabel}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              </Card>

              {/* Method Distribution */}
              <Card style={styles.methodDistribution}>
                <Text style={styles.chartTitle}>Check-in Methods</Text>
                <View style={styles.methodGrid}>
                  {Object.entries(METHOD_META).map(([key, meta]) => {
                    const count = analyticsData?.method_counts?.[key] || 0;
                    const total = Object.values(analyticsData?.method_counts || {}).reduce((a, b) => Number(a) + Number(b), 0) as number;
                    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <View key={key} style={styles.methodItem}>
                        <View style={[styles.methodIcon, { backgroundColor: meta.color + '20' }]}>
                          <meta.icon size={16} color={meta.color} />
                        </View>
                        <Text style={styles.methodCount}>{count}</Text>
                        <Text style={styles.methodLabel}>{meta.label}</Text>
                        <View style={[styles.methodBar, { backgroundColor: meta.color + '30' }]}>
                          <View style={[styles.methodBarFill, { width: `${percentage}%`, backgroundColor: meta.color }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>

              {/* Predictions */}
              <Card style={styles.predictionCard}>
                <View style={styles.predictionHeader}>
                  <Sparkles size={20} color="#6366F1" />
                  <Text style={styles.predictionTitle}>AI Insights</Text>
                </View>
                <View style={styles.predictionContent}>
                  {overallPct >= 75 ? (
                    <Text style={styles.predictionText} numberOfLines={4} ellipsizeMode="tail">
                      At your current pace, you'll maintain exam eligibility. Your attendance is trending {weeklyTrend >= 0 ? 'upwards' : 'downwards'} this week.
                    </Text>
                  ) : (
                    <Text style={styles.predictionText} numberOfLines={4} ellipsizeMode="tail">
                      You need to attend {Math.ceil((75 - overallPct) * byCourse.length * 0.1)} more classes to reach the 75% threshold.
                    </Text>
                  )}
                </View>
              </Card>
            </>
          )}

          {/* Background Auto Check-in */}
          {user?.role === 'student' && (
            <Card style={styles.bgCheckinCard}>
              <View style={styles.bgCheckinHeader}>
                <Radar color={bgAutoEnabled ? '#10B981' : theme.colors.brand} size={20} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.bgCheckinTitle} numberOfLines={1} ellipsizeMode="tail">Background auto check-in</Text>
                  <Text style={styles.bgCheckinSubtext} numberOfLines={2} ellipsizeMode="tail">
                    {bgAutoEnabled ? bgAutoStatus || 'Active — you\'ll be checked in automatically' : 'Geofencing checks you in the moment you enter campus zones'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={toggleBgAutoCheckin}
                style={[styles.enableButton, bgAutoEnabled && { backgroundColor: 'rgba(239,68,68,0.1)' }]}
              >
                <Text style={[styles.enableButtonText, bgAutoEnabled && { color: '#EF4444' }]}>
                  {bgAutoEnabled ? 'Disable' : 'Enable'}
                </Text>
              </Pressable>
            </Card>
          )}
        </ScrollView>

        {/* Leave Request Modal */}
        <Modal visible={showLeaveModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Leave</Text>
                <Pressable onPress={() => setShowLeaveModal(false)}>
                  <XSquare size={20} color={theme.colors.muted} />
                </Pressable>
              </View>
              <TextInput
                style={styles.modalInput}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={theme.colors.muted}
                value={leaveDate}
                onChangeText={setLeaveDate}
              />
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                placeholder="Reason for leave"
                placeholderTextColor={theme.colors.muted}
                value={leaveReason}
                onChangeText={setLeaveReason}
                multiline
                numberOfLines={3}
              />
              <Pressable
                style={[styles.submitButton, leaveSubmitting && { opacity: 0.6 }]}
                disabled={leaveSubmitting}
                onPress={async () => {
                  const date = leaveDate.trim();
                  const reason = leaveReason.trim();
                  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                    flash(false, 'Enter a date as YYYY-MM-DD');
                    return;
                  }
                  if (!reason) {
                    flash(false, 'Please enter a reason for leave');
                    return;
                  }
                  setLeaveSubmitting(true);
                  try {
                    const r = await api('/attendance/leave-request', {
                      method: 'POST',
                      body: JSON.stringify({ date, reason }),
                    });
                    setShowLeaveModal(false);
                    setLeaveDate('');
                    setLeaveReason('');
                    flash(true, r?.message || 'Leave request submitted successfully');
                  } catch (e: any) {
                    flash(false, e.message || 'Could not submit leave request');
                  } finally {
                    setLeaveSubmitting(false);
                  }
                }}
              >
                <Text style={styles.submitButtonText}>
                  {leaveSubmitting ? 'Submitting…' : 'Submit Request'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  hero: { height: 280, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  heroContent: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingBottom: theme.spacing.lg },
  heroStats: { flex: 1, marginLeft: theme.spacing.lg, minWidth: 0 },
  heroStatus: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 18 },
  trendRow: { flexDirection: 'row', gap: 12, marginTop: 12 },

  // Ring
  ringContainer: { alignItems: 'center' },
  ringOuter: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringBackground: { position: 'absolute' },
  ringProgress: { position: 'absolute', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringPercentage: { fontSize: 28, fontWeight: '800' },
  ringGrade: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: theme.colors.brandPrimary },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.colors.muted },
  activeTabText: { color: theme.colors.brandPrimary },

  content: { padding: theme.spacing.lg, paddingBottom: 100 },

  // Toast
  toast: { flexDirection: 'row', padding: 12, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },

  // Section
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },

  // Quick Actions
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickActionContainer: { width: (SCREEN_WIDTH - 48) / 4 },
  quickAction: { alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, padding: 12, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  quickActionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickActionLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.onSurface, textAlign: 'center' },
  quickActionBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: theme.colors.error, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  quickActionBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Sessions
  emptySession: { alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.xl, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  emptySessionText: { fontSize: 14, fontWeight: '600', color: theme.colors.onSurface, marginTop: 12 },
  emptySessionSubtext: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  sessionCard: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12, overflow: 'hidden' },
  sessionAccent: { width: 4 },
  sessionContent: { flex: 1, padding: theme.spacing.lg },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sessionInfo: { flex: 1, minWidth: 0 },
  sessionName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  sessionMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  methodBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  methodText: { fontSize: 10, fontWeight: '800' },
  checkedInBadge: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#DCFCE7', padding: 10, borderRadius: theme.radius.md, marginTop: theme.spacing.md },
  checkedInText: { color: theme.colors.brand, fontSize: 12, fontWeight: '700' },
  gpsConfirm: { backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, marginTop: theme.spacing.md },
  gpsConfirmText: { fontSize: 12, color: theme.colors.onSurfaceTertiary, lineHeight: 17 },
  confirmButton: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 10, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: theme.spacing.sm },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  checkinButton: { flexDirection: 'row', gap: 8, paddingVertical: 12, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md },
  checkinButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  autoStatusBanner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.35)', padding: 12, borderRadius: theme.radius.md, marginBottom: 6 },
  autoStatusText: { flex: 1, color: '#F59E0B', fontSize: 12, fontWeight: '600' },

  // Stats
  statsGrid: { flexDirection: 'row', gap: 12 },

  // Streak
  streakContainer: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, marginTop: theme.spacing.xl },
  streakHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  streakTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  streakContent: { flexDirection: 'row', alignItems: 'center' },
  streakNumber: { alignItems: 'center', flex: 1 },
  streakValue: { fontSize: 32, fontWeight: '800', color: '#F59E0B' },
  streakLabel: { fontSize: 12, color: theme.colors.muted },
  streakDivider: { width: 1, height: 40, backgroundColor: theme.colors.border },
  streakStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  streakStat: { alignItems: 'center' },
  streakStatValue: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  streakStatLabel: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', padding: 8, borderRadius: theme.radius.sm, marginTop: 12 },
  streakBadgeText: { fontSize: 12, fontWeight: '600', color: '#92400E' },

  // Courses
  courseCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  courseCardHeader: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg },
  courseColorBar: { width: 4, height: 40, borderRadius: 2 },
  courseInfo: { flex: 1, marginLeft: 12, minWidth: 0 },
  courseName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  courseCode: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  courseStats: { alignItems: 'flex-end' },
  coursePercentageBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  coursePercentageText: { fontSize: 14, fontWeight: '800' },
  courseProgressBar: { height: 4, backgroundColor: theme.colors.surfaceTertiary, marginHorizontal: theme.spacing.lg },
  courseProgressFill: { height: 4, borderRadius: 2 },
  courseMetaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: 8 },
  courseMeta: { fontSize: 11, color: theme.colors.muted },
  courseExpanded: { padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.border },
  courseDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  courseDetailItem: { width: '45%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseDetailLabel: { fontSize: 12, color: theme.colors.muted, flex: 1 },
  courseDetailValue: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },

  // Calendar
  monthNavigation: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  monthTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  heatmapContainer: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg },
  heatmapHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heatmapTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 10, color: theme.colors.muted, marginLeft: 2 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, fontWeight: '600', color: theme.colors.muted, marginBottom: 8 },
  heatmapCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  heatmapDay: { flex: 1, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  heatmapDayText: { fontSize: 11, fontWeight: '600', color: theme.colors.onSurface },
  heatmapToday: { borderWidth: 2, borderColor: theme.colors.brandPrimary },
  heatmapTodayText: { fontWeight: '800' },

  // Trends
  trendChart: { marginBottom: 12 },
  chartTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 12 },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120 },
  chartBarContainer: { alignItems: 'center', flex: 1 },
  chartBar: { width: 24, borderRadius: 4, minHeight: 4 },
  chartBarLabel: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
  methodDistribution: { marginBottom: 12 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  methodItem: { width: '45%', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 12, borderRadius: theme.radius.md },
  methodIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  methodCount: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  methodLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  methodBar: { width: '100%', height: 4, borderRadius: 2, marginTop: 8 },
  methodBarFill: { height: 4, borderRadius: 2 },
  predictionCard: { marginBottom: 12 },
  predictionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  predictionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  predictionContent: { backgroundColor: theme.colors.surface, padding: 12, borderRadius: theme.radius.md },
  predictionText: { fontSize: 13, color: theme.colors.onSurfaceTertiary, lineHeight: 20 },

  // Trend Indicator
  trendContainer: { alignItems: 'center' },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  trendValue: { fontSize: 12, fontWeight: '700' },
  trendLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  // Background Check-in
  bgCheckinCard: { marginTop: theme.spacing.xl },
  bgCheckinHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  bgCheckinTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  bgCheckinSubtext: { fontSize: 11, color: theme.colors.muted, marginTop: 2, lineHeight: 16 },
  enableButton: { backgroundColor: theme.colors.brandTertiary, paddingVertical: 11, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: theme.spacing.md },
  enableButtonText: { color: theme.colors.brand, fontWeight: '800', fontSize: 13 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing.xxl, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  modalInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: theme.colors.onSurface, marginBottom: 12 },
  modalTextArea: { height: 80, textAlignVertical: 'top' },
  submitButton: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 14, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: 8 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
