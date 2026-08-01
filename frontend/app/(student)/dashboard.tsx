import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Animated, Dimensions } from 'react-native';
import { AppImage as Image } from '@/src/components/AppImage';
import { LinearGradient } from '@/src/components/LinearGradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import {
  Bell, Wallet, Award, TrendingUp, BookOpen, ChevronRight,
  BellRing, Library, Building, Bus, FileText, Sparkles,
  QrCode, MessageSquare,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import type { StudentDashboardData, Notification, AiReminder, TimetableSlot } from '@/src/types';
import { theme } from '@/src/theme';
import { GlassCard, StatCard, ProgressBar, ProgressRing, DashboardSkeleton, SectionTitle, MetricRow, AsyncView, Card } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { subscribeRealtime } from '@/src/realtime/socket';

const { width } = Dimensions.get('window');

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data: d, loading: dLoading, error: dError, refresh: dRefresh } = useFetch<StudentDashboardData>('/dashboard/student');
  const { data: notifs, refresh: refreshNotifs } = useFetch<Notification[]>('/notifications');
  const { data: rems, refresh: refreshRems } = useFetch<AiReminder[]>('/reminders');
  const { data: analytics, refresh: refreshAnalytics } = useFetch<any>('/analytics/student');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const animDone = useRef(false);

  useEffect(() => {
    if (!dLoading && !animDone.current) {
      animDone.current = true;
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [dLoading]);

  useEffect(() => {
    if (!dLoading && refreshing) setRefreshing(false);
  }, [dLoading]);

  const onRefresh = () => {
    setRefreshing(true);
    dRefresh();
    refreshNotifs();
    refreshRems();
    refreshAnalytics();
  };

  useEffect(() => subscribeRealtime('notifications:update', () => refreshNotifs()), [refreshNotifs]);
  useEffect(() => subscribeRealtime('payments:update', () => {
    dRefresh();
    refreshAnalytics();
  }), [dRefresh, refreshAnalytics]);
  useEffect(() => subscribeRealtime('fees:update', () => dRefresh()), [dRefresh]);

  if (dLoading && !d) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (dError && !d) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <AsyncView loading={false} error={dError} onRetry={dRefresh} empty={false} />
      </View>
    );
  }

  const data = d || { attendance: 0, cgpa: 0, pending_assignments: 0, pending_fees: 0, upcoming_classes: [] };
  const notif = (notifs || []).slice(0, 3);
  const reminders = (rems || []).slice(0, 4);
  const unreadCount = notif.filter(n => !n.read).length;
  const attPct = data.attendance || 0;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const quickActions = [
    { icon: <QrCode size={20} color="#fff" />, label: 'Attendance', to: '/attendance-advanced', color: theme.colors.brandPrimary },
    { icon: <BookOpen size={20} color="#fff" />, label: 'Notes', to: '/notes', color: theme.colors.brandPrimary },
    { icon: <Award size={20} color="#fff" />, label: 'Results', to: '/results', color: '#10B981' },
    { icon: <Wallet size={20} color="#fff" />, label: 'Fees', to: '/(student)/fees', color: theme.colors.brand },
    { icon: <Library size={20} color="#fff" />, label: 'Library', to: '/library', color: '#065F46' },
    { icon: <Building size={20} color="#fff" />, label: 'Hostel', to: '/hostel', color: theme.colors.brandPrimary },
    { icon: <Bus size={20} color="#fff" />, label: 'Transport', to: '/transport', color: '#10B981' },
    { icon: <FileText size={20} color="#fff" />, label: 'Exams', to: '/exams', color: theme.colors.brand },
  ];

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />
          }
          contentContainerStyle={{ paddingBottom: 100 }}
          style={{ opacity: fadeAnim }}
        >
          <View style={styles.hero}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1581084324492-c8076f130f86?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200' }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient colors={['rgba(79,70,229,0.3)', 'rgba(2,6,23,0.95)']} style={StyleSheet.absoluteFill} />
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.greeting} numberOfLines={1}>Good day, {user?.name?.split(' ')[0]}</Text>
                  <Text style={styles.date} numberOfLines={1}>{today}</Text>
                  <Text style={styles.heroSub} numberOfLines={1}>
                    {user?.department} · Year {user?.year || 3} · ID: {user?.student_id}
                  </Text>
                </View>
                <Pressable
                  testID="notif-btn"
                  accessibilityLabel="Notifications"
                  accessibilityRole="button"
                  onPress={() => router.push('/notifications' as any)}
                  style={styles.iconBtn}
                >
                  <Bell color="#fff" size={20} />
                  {unreadCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeTxt}>{unreadCount}</Text>
                    </View>
                  )}
                </Pressable>
              </View>

              <GlassCard intensity={35} tint="dark" style={styles.glassHero}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.glassLabel}>Current CGPA</Text>
                    <Text style={styles.glassValue}>{analytics?.cgpa || data?.cgpa || '—'}</Text>
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                      <View>
                        <Text style={styles.glassStatLabel}>Attendance</Text>
                        <Text style={styles.glassStatValue}>{attPct}%</Text>
                      </View>
                      <View>
                        <Text style={styles.glassStatLabel}>Avg. Marks</Text>
                        <Text style={styles.glassStatValue}>{analytics?.avg_marks || '—'}</Text>
                      </View>
                      <View>
                        <Text style={styles.glassStatLabel}>Books</Text>
                        <Text style={styles.glassStatValue}>{analytics?.books_issued || 0}</Text>
                      </View>
                    </View>
                  </View>
                   <Pressable
                    testID="qr-btn"
                    accessibilityLabel="Attendance QR"
                    accessibilityRole="button"
                    onPress={() => router.push('/attendance-advanced' as any)}
                    style={styles.qrBtn}
                  >
                    <QrCode color="#fff" size={28} />
                  </Pressable>
                </View>
              </GlassCard>
            </SafeAreaView>
          </View>

          {reminders.length > 0 && (
            <View style={{ marginTop: theme.spacing.lg }}>
              <SectionTitle title="Smart Reminders" actionLabel="View all" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 10 }}
              >
                {reminders.map((r, i) => (
                  <Pressable
                    key={r.id || i}
                    testID={`reminder-${i}`}
                    accessibilityLabel={r.title}
                    accessibilityRole="button"
                    onPress={() => router.push('/(student)/ai' as any)}
                    style={styles.remCard}
                  >
                    <View
                      style={[
                        styles.remIcon,
                        { backgroundColor: r.priority === 0 ? '#FEE2E2' : theme.colors.brandTertiary },
                      ]}
                    >
                      <BellRing color={r.priority === 0 ? theme.colors.error : theme.colors.brand} size={14} />
                    </View>
                    <Text style={styles.remTitle} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={styles.remBody} numberOfLines={2}>
                      {r.body}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ marginTop: theme.spacing.lg }}>
            <MetricRow
              items={[
                {
                  label: 'Attendance',
                  value: `${attPct}%`,
                  sub: 'Overall',
                  color: attPct >= 75 ? theme.colors.success : theme.colors.warning,
                  icon: <TrendingUp size={16} color={theme.colors.brand} />,
                  trend: attPct >= 75 ? 12 : -5,
                  testID: 'stat-attendance',
                },
                {
                  label: 'CGPA',
                  value: analytics?.cgpa || data?.cgpa || '—',
                  sub: 'Current',
                  color: theme.colors.brandSecondary,
                  icon: <Award size={16} color={theme.colors.brandSecondary} />,
                  testID: 'stat-cgpa',
                },
              ]}
            />
            <MetricRow
              items={[
                {
                  label: 'Pending',
                  value: data?.pending_assignments || 0,
                  sub: 'Assignments',
                  color: theme.colors.warning,
                  icon: <FileText size={16} color={theme.colors.warning} />,
                  testID: 'stat-pending',
                },
                {
                  label: 'Fees Due',
                  value: data?.pending_fees || 0,
                  sub: 'Bills',
                  color: theme.colors.error,
                  icon: <Wallet size={16} color={theme.colors.error} />,
                  testID: 'stat-fees',
                },
              ]}
            />
          </View>

          {(analytics as any)?.attendance_by_course &&
            (analytics as any).attendance_by_course.length > 0 && (
              <View style={{ marginTop: theme.spacing.lg }}>
                <SectionTitle title="Attendance by Course" />
                <View style={{ paddingHorizontal: theme.spacing.lg, gap: 12 }}>
                  {(analytics as any).attendance_by_course.slice(0, 4).map((c: any, i: number) => (
                    <Card key={i} style={styles.attRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attCourse} numberOfLines={1}>{c.code}</Text>
                        <Text style={styles.attCourseName} numberOfLines={1}>{c.course}</Text>
                      </View>
                      <ProgressBar value={c.percentage} max={100} height={8} label="" showPct={false} style={{ flex: 1 }} />
                      <Text
                        style={[
                          styles.attPct,
                          { color: c.percentage >= 75 ? theme.colors.success : theme.colors.warning },
                        ]}
                      >
                        {c.percentage}%
                      </Text>
                    </Card>
                  ))}
                </View>
              </View>
            )}

          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionTitle title="Quick Access" />
            <View style={styles.qaGrid}>
              {quickActions.map(a => (
                <Pressable
                  testID={`qa-${a.label.toLowerCase()}`}
                  accessibilityLabel={a.label}
                  accessibilityRole="button"
                  key={a.label}
                  style={styles.qaCard}
                  onPress={() => router.push(a.to as any)}
                >
                  <LinearGradient colors={[a.color, a.color + 'cc']} style={styles.qaIconWrap}>
                    {a.icon}
                  </LinearGradient>
                  <Text style={styles.qaLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionTitle
              title="Today's Classes"
              action
              actionLabel="Timetable"
              onPress={() => router.push('/(student)/timetable' as any)}
            />
            <View style={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}>
              {(data?.upcoming_classes || []).slice(0, 4).map((c: TimetableSlot, i: number) => (
                <Card key={i} style={styles.classRow} onPress={() => router.push('/(student)/timetable' as any)}>
                  <View style={styles.classTime}>
                    <Text style={styles.classTimeStart}>{c.start}</Text>
                    <Text style={styles.classTimeEnd}>{c.end}</Text>
                  </View>
                  <View style={styles.classDivider} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.className} numberOfLines={1}>{c.course_name}</Text>
                    <Text style={styles.classMeta} numberOfLines={1}>
                      {c.faculty_name} · {c.room}
                    </Text>
                  </View>
                  <ChevronRight color={theme.colors.muted} size={18} />
                </Card>
              ))}
              {(data?.upcoming_classes || []).length === 0 && (
                <Card style={styles.noClass}>
                  <Text style={styles.noClassTxt}>No classes scheduled for today</Text>
                </Card>
              )}
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionTitle
              title="Recent Notifications"
              action
              actionLabel="View all"
              onPress={() => router.push('/notifications' as any)}
            />
            <View style={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}>
              {notif.map(n => (
                <Card key={n.id} testID={`notif-${n.id}`} style={styles.notifRow}>
                  <View
                    style={[
                      styles.notifDot,
                      { backgroundColor: n.read ? theme.colors.muted : theme.colors.brandPrimary },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                  </View>
                </Card>
              ))}
              {notif.length === 0 && (
                <Card style={styles.noClass}>
                  <Text style={styles.noClassTxt}>No notifications</Text>
                </Card>
              )}
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.xl, marginHorizontal: theme.spacing.lg }}>
            <LinearGradient
              colors={[theme.colors.brand, '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.exploreBanner}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.exploreTitle}>Explore CampusAI</Text>
                <Text style={styles.exploreSub}>
                  Your AI study assistant — solve doubts, plan studies, get smart reminders
                </Text>
                <Pressable
                  testID="try-ai"
                  accessibilityLabel="Try CampusAI"
                  accessibilityRole="button"
                  onPress={() => router.push('/(student)/ai' as any)}
                  style={styles.exploreBtn}
                >
                  <Sparkles color="#fff" size={16} />
                  <Text style={styles.exploreBtnTxt}>Try Now</Text>
                </Pressable>
              </View>
              <Sparkles
                color="rgba(255,255,255,0.2)"
                size={64}
                style={{ position: 'absolute', right: -10, bottom: -10 }}
              />
            </LinearGradient>
          </View>

          <View style={{ marginTop: theme.spacing.lg, marginHorizontal: theme.spacing.lg }}>
            <SectionTitle title="Career & Growth" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { icon: '🎯', label: 'Career Hub', route: '/career-dashboard' },
                { icon: '🎥', label: 'Live Classes', route: '/live-classes' },
                { icon: '💼', label: 'Placements', route: '/placement' },
                { icon: '📝', label: 'Assessments', route: '/skill-assessment' },
                { icon: '🤝', label: 'Mentorship', route: '/mentorship' },
                { icon: '⭐', label: 'Skill Profile', route: '/skill-profile' },
              ].map((item, i) => (
                <Pressable key={i} onPress={() => router.push(item.route as any)}
                  style={{ width: '30%', alignItems: 'center', gap: 4, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text, textAlign: 'center' }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginTop: theme.spacing.lg, marginHorizontal: theme.spacing.lg }}>
            <SectionTitle title="Campus Services" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { icon: '🚌', label: 'Bus Tracking', route: '/bus-tracking' },
                { icon: '🏠', label: 'Hostel', route: '/hostel' },
                { icon: '📚', label: 'Library', route: '/library' },
                { icon: '👤', label: 'Visitors', route: '/visitor' },
                { icon: '🔧', label: 'Complaints', route: '/complaints' },
                { icon: '📦', label: 'Assets', route: '/assets' },
              ].map((item, i) => (
                <Pressable key={i} onPress={() => router.push(item.route as any)}
                  style={{ width: '30%', alignItems: 'center', gap: 4, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ fontSize: 24 }}>{item.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.ScrollView>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { height: 330, overflow: 'hidden' },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  greeting: { color: '#fff', fontSize: 24, fontWeight: '800' },
  date: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  heroSub: { color: theme.colors.brandTertiary, fontSize: 12, marginTop: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    ...theme.shadow.sm,
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  glassHero: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md },
  glassLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  glassValue: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 2 },
  glassStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600' },
  glassStatValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 1 },
  qrBtn: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.lg,
  },
  remCard: {
    width: 200,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.brandTertiary,
    padding: theme.spacing.md,
    gap: 4,
    ...theme.shadow.sm,
  },
  remIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  remTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.onSurface },
  remBody: { fontSize: 11, color: theme.colors.muted, lineHeight: 15 },
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  attCourse: { fontSize: 11, fontWeight: '700', color: theme.colors.brand },
  attCourseName: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  attPct: { fontSize: 14, fontWeight: '800', textAlign: 'right', marginTop: -4 },
  qaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    gap: 10,
  },
  qaCard: { width: (width - 52) / 4, alignItems: 'center', gap: 6 },
  qaIconWrap: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.md,
  },
  qaLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.onSurface, textAlign: 'center' },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classTime: { width: 48, alignItems: 'center' },
  classTimeStart: { fontWeight: '800', color: theme.colors.brand, fontSize: 14 },
  classTimeEnd: { fontSize: 10, color: theme.colors.muted },
  classDivider: { width: 1, height: 30, backgroundColor: theme.colors.divider, marginLeft: 8 },
  className: { fontWeight: '700', color: theme.colors.onSurface, fontSize: 14 },
  classMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  noClass: {
    alignItems: 'center',
  },
  noClassTxt: { color: theme.colors.muted, fontSize: 13 },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifTitle: { fontWeight: '700', fontSize: 13, color: theme.colors.onSurface },
  notifBody: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  exploreBanner: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    overflow: 'hidden',
    ...theme.shadow.lg,
  },
  exploreTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  exploreSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 6, lineHeight: 17 },
  exploreBtn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.md,
    alignSelf: 'flex-start',
  },
  exploreBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
