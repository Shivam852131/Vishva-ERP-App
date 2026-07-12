import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart3, GraduationCap, UserCheck, BookOpen, Wallet, Users, TrendingUp } from 'lucide-react-native';
import type { AdminDashboardData } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, StatCard, SectionTitle } from '@/src/ui';

export default function Reports() {
  const { data: dash, loading: dashLoading, refresh: refreshDash } = useFetch<AdminDashboardData>('/dashboard/admin');
  const { data: analytics, loading: anaLoading, refresh: refreshAna } = useFetch<any>('/analytics/admin');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDash();
    refreshAna();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshDash, refreshAna]);

  const loading = dashLoading || anaLoading;

  if (loading || !dash) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface }}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </View>
    );
  }

  const total = (dash.students || 0) + (dash.faculty || 0) + (dash.parents || 0);
  const studentPct = total ? Math.round(((dash.students || 0) / total) * 100) : 0;
  const facultyPct = total ? Math.round(((dash.faculty || 0) / total) * 100) : 0;
  const parentPct = total ? Math.round(((dash.parents || 0) / total) * 100) : 0;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <Text style={styles.h1}>Reports & Analytics</Text>
          <Text style={styles.sub}>System-wide insights</Text>

          <View style={styles.statRow}>
            <StatCard
              testID="stat-students"
              label="Students"
              value={dash.students || 0}
              color={theme.colors.brand}
              icon={<GraduationCap size={18} color={theme.colors.brand} />}
            />
            <StatCard
              testID="stat-faculty"
              label="Faculty"
              value={dash.faculty || 0}
              color={theme.colors.brandSecondary}
              icon={<UserCheck size={18} color={theme.colors.brandSecondary} />}
            />
          </View>

          <View style={styles.statRow}>
            <StatCard
              testID="stat-courses"
              label="Courses"
              value={dash.courses || 0}
              color={theme.colors.info}
              icon={<BookOpen size={18} color={theme.colors.info} />}
            />
            <StatCard
              testID="stat-fees"
              label="Pending Fees"
              value={dash.pending_fees || 0}
              color={theme.colors.warning}
              icon={<Wallet size={18} color={theme.colors.warning} />}
            />
          </View>

          {analytics && (
            <View style={styles.statRow}>
              <StatCard
                testID="stat-attendance"
                label="Attendance Rate"
                value={`${analytics.attendance_rate || 0}%`}
                color={theme.colors.success}
                icon={<TrendingUp size={18} color={theme.colors.success} />}
              />
              <StatCard
                testID="stat-ratio"
                label="Student:Faculty"
                value={`${analytics.student_faculty_ratio || 0}:1`}
                color={theme.colors.brand}
                icon={<Users size={18} color={theme.colors.brand} />}
              />
            </View>
          )}

          <SectionTitle title="User Distribution" />
          <Card style={{ marginBottom: theme.spacing.md }}>
            {[
              { label: 'Students', val: dash.students || 0, pct: studentPct, color: theme.colors.brand },
              { label: 'Faculty', val: dash.faculty || 0, pct: facultyPct, color: theme.colors.brandSecondary },
              { label: 'Parents', val: dash.parents || 0, pct: parentPct, color: theme.colors.warning },
            ].map(r => (
              <View key={r.label} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.barLabel}>{r.label}</Text>
                  <Text style={styles.barVal}>{r.val} ({r.pct}%)</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${r.pct}%`, backgroundColor: r.color }]} />
                </View>
              </View>
            ))}
          </Card>

          <SectionTitle title="Fee Overview" />
          <Card style={{ marginBottom: theme.spacing.md }}>
            <Text style={styles.bigNum}>{dash.pending_fees || 0}</Text>
            <Text style={styles.cardSub}>Pending payments across all students</Text>
          </Card>

          {analytics?.books !== undefined && (
            <>
              <SectionTitle title="Library & Hostel" />
              <View style={styles.statRow}>
                <Card style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.bigNum}>{analytics.books || 0}</Text>
                  <Text style={styles.cardSub}>Total Books</Text>
                </Card>
                <Card style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.bigNum}>{analytics.books_issued || 0}</Text>
                  <Text style={styles.cardSub}>Currently Issued</Text>
                </Card>
              </View>
              <Card style={{ marginBottom: theme.spacing.md }}>
                <Text style={styles.bigNum}>{analytics.hostel_occupants || 0}</Text>
                <Text style={styles.cardSub}>Hostel Occupants</Text>
              </Card>
            </>
          )}

          <SectionTitle title="AI Insight" />
          <Card>
            <Text style={styles.insight}>
              {analytics?.attendance_rate >= 75
                ? `Attendance is strong at ${analytics.attendance_rate}%. Consider recognizing top-performing students in the next announcement to maintain momentum.`
                : `Attendance is at ${analytics?.attendance_rate || 0}%. Consider sending targeted reminders to improve engagement across departments.`}
            </Text>
            <Text style={styles.insight}>
              Faculty-to-student ratio is {analytics?.student_faculty_ratio || '—'}:1.
              {(analytics?.student_faculty_ratio || 0) > 30
                ? ' Consider recruiting additional faculty members.'
                : ' This is within the recommended range.'}
            </Text>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12, marginBottom: theme.spacing.lg },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  barLabel: { color: theme.colors.muted, fontSize: 13 },
  barVal: { fontWeight: '800', color: theme.colors.onSurface, fontSize: 13 },
  barBg: { height: 8, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 4, marginTop: 6, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  bigNum: { fontSize: 32, fontWeight: '800', color: theme.colors.brand },
  cardSub: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  insight: { color: theme.colors.onSurfaceTertiary, lineHeight: 20, fontSize: 13, marginBottom: 12 },
});
