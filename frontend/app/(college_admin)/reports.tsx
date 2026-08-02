import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BarChart3, GraduationCap, UserCheck, BookOpen, Wallet, Users, TrendingUp,
  Download, Calendar, Filter, ChevronDown, AlertTriangle, CheckCircle,
  Clock, Target, Zap, Eye, ArrowUpRight, ArrowDownRight, Activity,
} from 'lucide-react-native';
import type { AdminDashboardData } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, StatCard, SectionTitle, ProgressBar, ProgressRing, EmptyState } from '@/src/ui';

const DATE_RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'This Semester', value: 'semester' },
  { label: 'All Time', value: 'all' },
];

export default function Reports() {
  const { data: dash, loading: dashLoading, refresh: refreshDash } = useFetch<AdminDashboardData>('/dashboard/admin');
  const { data: analytics, loading: anaLoading, refresh: refreshAna } = useFetch<any>('/analytics/admin');
  const { data: attendanceReport, loading: attLoading, refresh: refreshAtt } = useFetch<any>('/attendance/reports?days=30');
  const { data: fees } = useFetch<any[]>('/fees/all');
  const { data: users = [] } = useFetch<any[]>('/admin/users');
  const { data: courses = [] } = useFetch<any[]>('/courses');
  const { data: schedules = [] } = useFetch<any[]>('/admin/schedules');
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('month');
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'finance' | 'users'>('overview');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDash();
    refreshAna();
    refreshAtt();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshDash, refreshAna, refreshAtt]);

  const loading = dashLoading || anaLoading;

  const userStats = useMemo(() => {
    const total = users.length;
    const byRole = {
      student: users.filter((u: any) => u.role === 'student').length,
      faculty: users.filter((u: any) => u.role === 'faculty').length,
      parent: users.filter((u: any) => u.role === 'parent').length,
      admin: users.filter((u: any) => u.role === 'college_admin').length,
    };
    const active = users.filter((u: any) => u.status !== 'suspended').length;
    const suspended = users.filter((u: any) => u.status === 'suspended').length;
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, byRole, active, suspended, activeRate };
  }, [users]);

  const feeStats = useMemo(() => {
    const all = fees || [];
    const total = all.reduce((s: number, f: any) => s + (f.amount || 0), 0);
    const paid = all.filter((f: any) => f.status === 'paid').reduce((s: number, f: any) => s + (f.amount || 0), 0);
    const pending = all.filter((f: any) => f.status === 'pending').reduce((s: number, f: any) => s + (f.amount || 0), 0);
    const collectionRate = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, pending, collectionRate };
  }, [fees]);

  const scheduleStats = useMemo(() => {
    const total = schedules.length;
    const byDay: Record<string, number> = {};
    (schedules as any[]).forEach((s: any) => {
      const day = s.day || 'unknown';
      byDay[day] = (byDay[day] || 0) + 1;
    });
    return { total, byDay };
  }, [schedules]);

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

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'attendance', label: 'Attendance', icon: <CheckCircle size={14} /> },
    { key: 'finance', label: 'Finance', icon: <Wallet size={14} /> },
    { key: 'users', label: 'Users', icon: <Users size={14} /> },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.h1}>Reports & Analytics</Text>
              <Text style={styles.sub}>System-wide insights</Text>
            </View>
            <Pressable
              onPress={() => Alert.alert('Export', `Would export ${activeTab} report as PDF/CSV`)}
              style={styles.exportBtn}
            >
              <Download size={16} color={theme.colors.brand} />
            </Pressable>
          </View>

          {/* Date Range Selector */}
          <Pressable
            style={styles.dateSelector}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Calendar size={14} color={theme.colors.brand} />
            <Text style={styles.dateText}>{DATE_RANGES.find(d => d.value === dateRange)?.label}</Text>
            <ChevronDown size={14} color={theme.colors.muted} />
          </Pressable>
          {showDatePicker && (
            <View style={styles.datePickerPanel}>
              {DATE_RANGES.map(d => (
                <Pressable
                  key={d.value}
                  onPress={() => { setDateRange(d.value); setShowDatePicker(false); }}
                  style={[styles.dateOption, dateRange === d.value && styles.dateOptionActive]}
                >
                  <Text style={[styles.dateOptionTxt, dateRange === d.value && styles.dateOptionTxtActive]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabBar}>
            {tabs.map(t => (
              <Pressable
                key={t.key}
                onPress={() => setActiveTab(t.key as any)}
                style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              >
                {t.icon}
                <Text style={[styles.tabTxt, activeTab === t.key && styles.tabTxtActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Key Metrics */}
              <View style={styles.statRow}>
                <StatCard
                  testID="stat-students"
                  label="Students"
                  value={dash.students || 0}
                  color="#3B82F6"
                  icon={<GraduationCap size={18} color="#3B82F6" />}
                  trend={5}
                />
                <StatCard
                  testID="stat-faculty"
                  label="Faculty"
                  value={dash.faculty || 0}
                  color="#8B5CF6"
                  icon={<UserCheck size={18} color="#8B5CF6" />}
                  trend={2}
                />
              </View>
              <View style={styles.statRow}>
                <StatCard
                  testID="stat-courses"
                  label="Courses"
                  value={dash.courses || 0}
                  color="#06B6D4"
                  icon={<BookOpen size={18} color="#06B6D4" />}
                />
                <StatCard
                  testID="stat-fees"
                  label="Pending Fees"
                  value={`₹${((dash.pending_fees || 0) / 100).toLocaleString()}`}
                  color="#F59E0B"
                  icon={<Wallet size={18} color="#F59E0B" />}
                  trend={-3}
                />
              </View>
              {analytics && (
                <View style={styles.statRow}>
                  <StatCard
                    testID="stat-attendance"
                    label="Attendance"
                    value={`${analytics.attendance_rate || 0}%`}
                    color="#10B981"
                    icon={<TrendingUp size={18} color="#10B981" />}
                    trend={analytics.attendance_rate >= 75 ? 3 : -5}
                  />
                  <StatCard
                    testID="stat-ratio"
                    label="Student:Faculty"
                    value={`${analytics.student_faculty_ratio || 0}:1`}
                    color="#EC4899"
                    icon={<Users size={18} color="#EC4899" />}
                  />
                </View>
              )}

              {/* User Distribution */}
              <SectionTitle title="User Distribution" />
              <Card style={{ marginBottom: theme.spacing.md }}>
                {[
                  { label: 'Students', val: dash.students || 0, pct: studentPct, color: '#3B82F6' },
                  { label: 'Faculty', val: dash.faculty || 0, pct: facultyPct, color: '#8B5CF6' },
                  { label: 'Parents', val: dash.parents || 0, pct: parentPct, color: '#F59E0B' },
                ].map(r => (
                  <View key={r.label} style={{ marginTop: 12 }}>
                    <ProgressBar value={r.pct} max={100} label={`${r.label} (${r.val})`} showPct color={r.color} />
                  </View>
                ))}
              </Card>

              {/* Fee Overview */}
              <SectionTitle title="Fee Overview" />
              <View style={styles.feeOverview}>
                <Card style={styles.feeCard}>
                  <Text style={styles.feeBigNum}>₹{(feeStats.paid / 100).toLocaleString()}</Text>
                  <Text style={styles.feeCardSub}>Collected</Text>
                  <ProgressBar value={feeStats.collectionRate} max={100} color="#10B981" />
                </Card>
                <Card style={styles.feeCard}>
                  <Text style={[styles.feeBigNum, { color: '#F59E0B' }]}>₹{(feeStats.pending / 100).toLocaleString()}</Text>
                  <Text style={styles.feeCardSub}>Pending</Text>
                  <ProgressBar value={100 - feeStats.collectionRate} max={100} color="#F59E0B" />
                </Card>
              </View>

              {/* Library & Hostel */}
              {analytics?.books !== undefined && (
                <>
                  <SectionTitle title="Library & Hostel" />
                  <View style={styles.statRow}>
                    <Card style={{ flex: 1, marginRight: 6, alignItems: 'center' }}>
                      <ProgressRing percentage={Math.min(100, Math.round(((analytics.books_issued || 0) / Math.max(analytics.books || 1, 1)) * 100))} size={60} label="Issued" />
                      <Text style={styles.bigNum}>{analytics.books || 0}</Text>
                      <Text style={styles.cardSub}>Total Books</Text>
                    </Card>
                    <Card style={{ flex: 1, marginLeft: 6, alignItems: 'center' }}>
                      <ProgressRing percentage={analytics.hostel_occupants ? Math.min(100, Math.round((analytics.hostel_occupants / 200) * 100)) : 0} size={60} label="Occupancy" />
                      <Text style={styles.bigNum}>{analytics.hostel_occupants || 0}</Text>
                      <Text style={styles.cardSub}>Hostel Occupants</Text>
                    </Card>
                  </View>
                </>
              )}

              {/* AI Insights */}
              <SectionTitle title="AI Insights" />
              <Card>
                <View style={styles.insightRow}>
                  <Zap size={16} color="#F59E0B" />
                  <Text style={styles.insightTitle}>Smart Recommendations</Text>
                </View>
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
                <Text style={styles.insight}>
                  Fee collection rate is {feeStats.collectionRate}%.
                  {feeStats.collectionRate < 70
                    ? ' Consider sending bulk reminders to improve collection.'
                    : ' Collection rate is healthy.'}
                </Text>
              </Card>
            </>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <>
              <SectionTitle title="Attendance Analytics" />
              <View style={styles.statRow}>
                <StatCard label="Overall Rate" value={`${analytics?.attendance_rate || 0}%`} color="#10B981" icon={<TrendingUp size={18} color="#10B981" />} />
                <StatCard label="Total Sessions" value={attendanceReport?.total_sessions || 0} color="#3B82F6" icon={<Clock size={18} color="#3B82F6" />} />
              </View>

              {attendanceReport?.by_course?.length > 0 && (
                <>
                  <SectionTitle title="Course-wise Attendance" />
                  {attendanceReport.by_course.map((c: any) => (
                    <Card key={c.course_id} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseName} numberOfLines={1}>{c.course_name}</Text>
                          <Text style={styles.courseCode}>{c.course_code}</Text>
                        </View>
                        <View style={[styles.attBadge, { backgroundColor: c.percentage >= 75 ? '#DCFCE7' : c.percentage >= 50 ? '#FEF3C7' : '#FEE2E2' }]}>
                          <Text style={[styles.attBadgeTxt, { color: c.percentage >= 75 ? '#10B981' : c.percentage >= 50 ? '#F59E0B' : '#EF4444' }]}>
                            {c.percentage}%
                          </Text>
                        </View>
                      </View>
                      <ProgressBar value={c.percentage} max={100} height={6} style={{ marginTop: 8 }} />
                      <Text style={styles.attDetail}>{c.present}/{c.total_records} present · {c.enrolled} enrolled</Text>
                    </Card>
                  ))}
                </>
              )}

              {attendanceReport?.low_attendance?.length > 0 && (
                <>
                  <SectionTitle title="Low Attendance Alerts" actionLabel={`${attendanceReport.low_attendance.length} students`} />
                  {attendanceReport.low_attendance.slice(0, 5).map((s: any) => (
                    <Card key={s.student_id} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.alertDot, { backgroundColor: s.percentage < 50 ? '#EF4444' : '#F59E0B' }]}>
                          <AlertTriangle size={14} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.alertName}>{s.student_name}</Text>
                          <Text style={styles.alertMeta} numberOfLines={1}>{s.student_code} · {s.email}</Text>
                        </View>
                        <Text style={[styles.alertPct, { color: s.percentage < 50 ? '#EF4444' : '#F59E0B' }]}>{s.percentage}%</Text>
                      </View>
                    </Card>
                  ))}
                </>
              )}

              {attendanceReport?.patterns?.length > 0 && (
                <>
                  <SectionTitle title="Detected Patterns" />
                  {attendanceReport.patterns.map((p: any, i: number) => (
                    <Card key={i} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.patternBadge, {
                          backgroundColor: p.severity === 'high' ? '#FEE2E2' : p.severity === 'medium' ? '#FEF3C7' : '#DCFCE7'
                        }]}>
                          <Text style={[styles.patternTxt, {
                            color: p.severity === 'high' ? '#EF4444' : p.severity === 'medium' ? '#F59E0B' : '#10B981'
                          }]}>{p.severity.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.patternDesc}>{p.description}</Text>
                      </View>
                    </Card>
                  ))}
                </>
              )}
            </>
          )}

          {/* Finance Tab */}
          {activeTab === 'finance' && (
            <>
              <SectionTitle title="Financial Overview" />
              <View style={styles.statRow}>
                <StatCard label="Total Revenue" value={`₹${(feeStats.total / 100).toLocaleString()}`} color="#10B981" icon={<Wallet size={18} color="#10B981" />} />
                <StatCard label="Collection Rate" value={`${feeStats.collectionRate}%`} color="#3B82F6" icon={<Target size={18} color="#3B82F6" />} />
              </View>
              <View style={styles.statRow}>
                <StatCard label="Collected" value={`₹${(feeStats.paid / 100).toLocaleString()}`} color="#10B981" icon={<CheckCircle size={18} color="#10B981" />} />
                <StatCard label="Pending" value={`₹${(feeStats.pending / 100).toLocaleString()}`} color="#F59E0B" icon={<Clock size={18} color="#F59E0B" />} />
              </View>

              <SectionTitle title="Collection Progress" />
              <Card>
                <ProgressBar value={feeStats.collectionRate} max={100} label="Overall Collection" showPct height={12} />
                <View style={styles.feeBreakdown}>
                  <View style={styles.feeBreakItem}>
                    <View style={[styles.feeBreakDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.feeBreakLabel}>Collected</Text>
                    <Text style={styles.feeBreakVal}>₹{(feeStats.paid / 100).toLocaleString()}</Text>
                  </View>
                  <View style={styles.feeBreakItem}>
                    <View style={[styles.feeBreakDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.feeBreakLabel}>Pending</Text>
                    <Text style={styles.feeBreakVal}>₹{(feeStats.pending / 100).toLocaleString()}</Text>
                  </View>
                </View>
              </Card>
            </>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <>
              <SectionTitle title="User Analytics" />
              <View style={styles.statRow}>
                <StatCard label="Total Users" value={userStats.total} color="#3B82F6" icon={<Users size={18} color="#3B82F6" />} />
                <StatCard label="Active Rate" value={`${userStats.activeRate}%`} color="#10B981" icon={<Activity size={18} color="#10B981" />} />
              </View>

              <SectionTitle title="User Breakdown" />
              <Card>
                {[
                  { label: 'Students', val: userStats.byRole.student, color: '#3B82F6', icon: '🎓' },
                  { label: 'Faculty', val: userStats.byRole.faculty, color: '#8B5CF6', icon: '👨‍🏫' },
                  { label: 'Parents', val: userStats.byRole.parent, color: '#F59E0B', icon: '👪' },
                  { label: 'Admins', val: userStats.byRole.admin, color: '#10B981', icon: '🏛️' },
                ].map(item => (
                  <View key={item.label} style={styles.userBreakRow}>
                    <Text style={styles.userBreakIcon}>{item.icon}</Text>
                    <Text style={styles.userBreakLabel}>{item.label}</Text>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <ProgressBar value={item.val} max={userStats.total || 1} height={6} color={item.color} />
                    </View>
                    <Text style={styles.userBreakVal}>{item.val}</Text>
                  </View>
                ))}
              </Card>

              {userStats.suspended > 0 && (
                <Card style={{ marginTop: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle size={16} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>{userStats.suspended} suspended accounts</Text>
                  </View>
                  <Text style={{ color: theme.colors.muted, fontSize: 12, marginTop: 4 }}>Review and reactivate as needed</Text>
                </Card>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12, marginBottom: theme.spacing.md },
  exportBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  dateSelector: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' },
  dateText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  datePickerPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.sm },
  dateOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  dateOptionActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  dateOptionTxt: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  dateOptionTxtActive: { color: '#fff' },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabTxtActive: { color: '#fff' },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  feeOverview: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  feeCard: { flex: 1, alignItems: 'center' },
  feeBigNum: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  feeCardSub: { color: theme.colors.muted, fontSize: 12, marginTop: 4, marginBottom: 8 },
  bigNum: { fontSize: 28, fontWeight: '800', color: theme.colors.brand, marginTop: 8 },
  cardSub: { color: theme.colors.muted, fontSize: 13, marginTop: 4 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  insight: { color: theme.colors.onSurfaceTertiary, lineHeight: 20, fontSize: 13, marginBottom: 10 },
  courseName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  courseCode: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  attBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  attBadgeTxt: { fontSize: 14, fontWeight: '800' },
  attDetail: { fontSize: 11, color: theme.colors.muted, marginTop: 6 },
  alertDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  alertName: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  alertMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  alertPct: { fontSize: 16, fontWeight: '800' },
  patternBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  patternTxt: { fontSize: 10, fontWeight: '800' },
  patternDesc: { fontSize: 13, color: theme.colors.onSurface, flex: 1 },
  feeBreakdown: { flexDirection: 'row', justifyContent: 'space-around', marginTop: theme.spacing.md },
  feeBreakItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feeBreakDot: { width: 8, height: 8, borderRadius: 4 },
  feeBreakLabel: { fontSize: 12, color: theme.colors.muted },
  feeBreakVal: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  userBreakRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  userBreakIcon: { fontSize: 16, width: 24 },
  userBreakLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface, minWidth: 60, flex: 1 },
  userBreakVal: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface, minWidth: 40, textAlign: 'right' },
});
