import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  RefreshControl,
} from 'react-native';
import { AppImage as Image } from '@/src/components/AppImage';
import { LinearGradient } from '@/src/components/LinearGradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import {
  Bell,
  BookOpen,
  Users,
  ClipboardList,
  MessageSquare,
  Bot,
  Calendar,
  Library,
  BarChart3,
  FileText,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import type { FacultyDashboardData, Course } from '@/src/types';
import { theme } from '@/src/theme';
import {
  GlassCard,
  StatCard,
  SectionTitle,
  DashboardSkeleton,
  EmptyState,
  Card,
} from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const { data: dashboard, loading, refresh: refreshDashboard } =
    useFetch<FacultyDashboardData>('/dashboard/faculty');
  const { data: analytics, refresh: refreshAnalytics } =
    useFetch<any>('/analytics/faculty');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const animDone = useRef(false);

  useEffect(() => {
    if (!loading && !animDone.current) {
      animDone.current = true;
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading, refreshing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDashboard();
    refreshAnalytics();
  }, [refreshDashboard, refreshAnalytics]);

  if (loading && !dashboard) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <DashboardSkeleton />
      </View>
    );
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <Animated.ScrollView
          contentContainerStyle={styles.scrollContent}
          style={{ opacity: fadeAnim }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.brandPrimary}
            />
          }
        >
          <View style={styles.hero}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1741699428220-65f37f3fbbcb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwc3R1ZHlpbmclMjBsaWJyYXJ5fGVufDB8fHx8MTc4Mjk2NTMxMXww&ixlib=rb-4.1.0&q=85' }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient
              colors={['rgba(6,95,70,0.3)', 'rgba(24,26,24,0.95)']}
              style={StyleSheet.absoluteFill}
            />
            <SafeAreaView
              edges={['top']}
              style={styles.heroContent}
            >
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.greeting} numberOfLines={1}>
                    Welcome, Prof. {user?.name?.split(' ').pop()}
                  </Text>
                  <Text style={styles.date} numberOfLines={1}>{today}</Text>
                  <Text style={styles.dept} numberOfLines={1}>
                    {user?.department} · Faculty
                  </Text>
                </View>
                <Pressable
                  testID="notif-btn"
                  accessibilityLabel="Notifications"
                  onPress={() => router.push('/notifications' as any)}
                  style={styles.notifBtn}
                >
                  <Bell color="#fff" size={20} />
                </Pressable>
              </View>
              <GlassCard intensity={35} tint="dark">
                <Text style={styles.todayCount}>
                  {dashboard?.today_classes || 0}
                </Text>
                <Text style={styles.todaySub}>
                  classes today · {dashboard?.students || 0} students enrolled
                  across your courses
                </Text>
              </GlassCard>
            </SafeAreaView>
          </View>

          <View style={styles.statsSection}>
            <View style={styles.statsRow}>
              <StatCard
                label="Courses"
                value={dashboard?.courses?.length || 0}
                sub="Teaching"
                icon={<BookOpen size={16} color={theme.colors.brand} />}
              />
              <StatCard
                label="Students"
                value={analytics?.total_students || dashboard?.students || 0}
                sub="Enrolled"
                color={theme.colors.brandSecondary}
                icon={
                  <Users size={16} color={theme.colors.brandSecondary} />
                }
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                label="Classes"
                value={dashboard?.today_classes || 0}
                sub="Today"
                color={theme.colors.warning}
                icon={
                  <Calendar size={16} color={theme.colors.warning} />
                }
              />
              <StatCard
                label="Assignments"
                value={
                  analytics?.total_assignments || dashboard?.assignments || 0
                }
                sub="Created"
                color={theme.colors.info}
                icon={
                  <ClipboardList size={16} color={theme.colors.info} />
                }
              />
            </View>
          </View>

          {dashboard?.courses && dashboard.courses.length > 0 && (
            <>
              <SectionTitle title="Your Courses" />
              <View style={styles.coursesContainer}>
                {dashboard.courses.map((c: Course) => (
                  <Card key={c.id} style={styles.courseCard}>
                    <View
                      style={[
                        styles.courseAccent,
                        { backgroundColor: c.color || theme.colors.brand },
                      ]}
                    />
                    <View style={styles.courseBody}>
                      <Text style={styles.courseCode}>{c.code}</Text>
                      <Text style={styles.courseName}>{c.name}</Text>
                      <Text style={styles.courseMeta}>
                        {c.credits} credits · {c.faculty_name}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            </>
          )}

          {!dashboard?.courses || dashboard.courses.length === 0 ? (
            <EmptyState
              title="No courses assigned"
              sub="You don't have any courses assigned yet."
              icon="📚"
            />
          ) : null}

          <SectionTitle title="Quick Actions" />
          <View style={styles.actionsGrid}>
            {[
              {
                icon: <ClipboardList size={20} color="#fff" />,
                label: 'Create Task',
                to: '/(faculty)/assignments',
                color: theme.colors.brandPrimary,
              },
              {
                icon: <MessageSquare size={20} color="#fff" />,
                label: 'Chat',
                to: '/chat',
                color: '#059669',
              },
              {
                icon: <Bot size={20} color="#fff" />,
                label: 'AI Assist',
                to: '/(faculty)/ai',
                color: '#10B981',
              },
              {
                icon: <Calendar size={20} color="#fff" />,
                label: 'Events',
                to: '/events',
                color: '#047857',
              },
              {
                icon: <Library size={20} color="#fff" />,
                label: 'Library',
                to: '/library',
                color: '#065F46',
              },
              {
                icon: <BarChart3 size={20} color="#fff" />,
                label: 'Analytics',
                to: '/analytics',
                color: '#059669',
              },
              {
                icon: <FileText size={20} color="#fff" />,
                label: 'Exam Generator',
                to: '/(faculty)/exam-generator',
                color: '#6366f1',
              },
              {
                icon: <FileText size={20} color="#fff" />,
                label: 'Question Paper',
                to: '/(faculty)/question-paper',
                color: '#8B5CF6',
              },
              {
                icon: <BarChart3 size={20} color="#fff" />,
                label: 'Live Classes',
                to: '/live-classes',
                color: '#DC2626',
              },
            ].map((a) => (
              <Pressable
                testID={`qa-${a.label.toLowerCase().replace(/\s/g, '-')}`}
                accessibilityLabel={a.label}
                key={a.label}
                onPress={() => router.push(a.to as any)}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: a.color + '15',
                    borderColor: a.color + '30',
                  },
                ]}
              >
                <LinearGradient
                  colors={[a.color, a.color + 'cc']}
                  style={styles.actionIconWrap}
                >
                  {a.icon}
                </LinearGradient>
                <Text style={[styles.actionLabel, { color: a.color }]}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.ScrollView>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surface },
  scrollContent: { paddingBottom: 40 },
  hero: { height: 280, overflow: 'hidden' },
  heroContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    flex: 1,
    justifyContent: 'space-between',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: { color: '#fff', fontSize: 20, fontWeight: '800' },
  date: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  dept: { color: theme.colors.brandTertiary, fontSize: 12, marginTop: 3 },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayCount: { color: '#fff', fontSize: 30, fontWeight: '800' },
  todaySub: {
    color: theme.colors.brandTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  statsSection: { marginTop: theme.spacing.md },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
  },
  coursesContainer: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  courseAccent: {
    width: 4,
    height: 44,
    borderRadius: 2,
    marginRight: 12,
  },
  courseBody: { flex: 1 },
  courseCode: {
    fontSize: 11,
    color: theme.colors.brand,
    fontWeight: '700',
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginTop: 2,
  },
  courseMeta: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.lg,
    gap: 10,
  },
  actionBtn: {
    width: '47%',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...theme.shadow.sm,
  },
  actionLabel: { fontWeight: '700', fontSize: 13 },
});
