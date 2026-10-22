import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, BarChart3, Users, BookOpen, TrendingUp,
  TrendingDown, GraduationCap, Building2, AlertTriangle,
  CheckCircle, Clock, DollarSign,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, StatCard, SectionTitle, ProgressBar, AsyncView } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function AnalyticsScreen() {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const { data: studentData, loading: sLoad, error: sErr, refresh: sRefresh } = useFetch<any>(
    user?.role === 'student' ? '/analytics/dashboard/student' : null,
  );
  const { data: facultyData, loading: fLoad, error: fErr, refresh: fRefresh } = useFetch<any>(
    user?.role === 'faculty' ? '/analytics/faculty' : null,
  );
  const { data: adminData, loading: aLoad, error: aErr, refresh: aRefresh } = useFetch<any>(
    user?.role === 'college_admin' || user?.role === 'super_admin' ? '/analytics/admin' : null,
  );

  const loading = sLoad || fLoad || aLoad;
  const error = sErr || fErr || aErr;
  const hasData = !!(studentData || facultyData || adminData);
  const onRefresh = async () => {
    setRefreshing(true);
    sRefresh();
    fRefresh();
    aRefresh();
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  };
  const onRetry = () => { sRefresh(); fRefresh(); aRefresh(); };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
        {/* Header */}
        <LinearGradient
          colors={['#4F46E5', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable
            testID="analytics-back"
            accessibilityLabel="Go back"
            accessibilityRole="button"
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSub}>
              {user?.role === 'student' ? 'Your academic performance'
                : user?.role === 'faculty' ? 'Your courses and classes'
                  : 'Institution-wide insights'}
            </Text>
          </View>
          <View style={styles.headerIcon}>
            <BarChart3 size={20} color="#fff" />
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          <AsyncView
            loading={loading && !hasData}
            error={error}
            onRetry={onRetry}
            empty={!loading && !hasData}
            emptyTitle="No Analytics Available"
            emptySub="Analytics data will appear here once you have activity."
            emptyIcon={<BarChart3 size={48} color={theme.colors.muted} />}
          >
          {/* Student Analytics */}
          {user?.role === 'student' && studentData && (
            <>
              <View style={styles.ringRow}>
                <View style={styles.ringCard}>
                  <Text style={styles.ringValue}>{studentData.attendance || 0}%</Text>
                  <ProgressBar value={studentData.attendance || 0} height={6} label="Attendance" showPct />
                </View>
                <View style={styles.ringCard}>
                  <Text style={[styles.ringValue, { color: '#8B5CF6' }]}>{studentData.cgpa || 0}</Text>
                  <ProgressBar value={(studentData.cgpa || 0) * 10} max={100} height={6} label="CGPA" color="#8B5CF6" showPct />
                </View>
              </View>

              <SectionTitle title="Performance" />
              <View style={styles.statRow}>
                <StatCard label="Avg Marks" value={studentData.avg_marks || 0} color="#0EA5E9" icon={<BarChart3 size={18} color="#0EA5E9" />} />
                <StatCard label="Books" value={studentData.books_issued || 0} color="#8B5CF6" icon={<BookOpen size={18} color="#8B5CF6" />} />
              </View>

              <View style={styles.statRow}>
                <StatCard label="Overdue Books" value={studentData.overdue_books || 0} color={theme.colors.error} icon={<AlertTriangle size={18} color={theme.colors.error} />} />
                <StatCard label="Grievances" value={studentData.open_grievances || 0} color={theme.colors.warning} icon={<Clock size={18} color={theme.colors.warning} />} />
              </View>

              {studentData.attendance_by_course?.length > 0 && (
                <>
                  <SectionTitle title="Attendance by Course" />
                  <Card style={{ marginHorizontal: 0 }}>
                    {studentData.attendance_by_course.map((c: any, i: number) => (
                      <View key={i} style={{ marginBottom: 12 }}>
                        <ProgressBar
                          value={c.percentage}
                          height={8}
                          label={`${c.code} — ${c.course}`}
                          showPct
                          color={c.percentage >= 75 ? '#10B981' : c.percentage >= 60 ? theme.colors.warning : theme.colors.error}
                        />
                      </View>
                    ))}
                  </Card>
                </>
              )}
            </>
          )}

          {/* Faculty Analytics */}
          {user?.role === 'faculty' && facultyData && (
            <>
              <SectionTitle title="Faculty Overview" />
              <View style={styles.statRow}>
                <StatCard label="Courses" value={facultyData.total_courses || 0} color="#0EA5E9" icon={<BookOpen size={18} color="#0EA5E9" />} />
                <StatCard label="Students" value={facultyData.total_students || 0} color="#10B981" icon={<Users size={18} color="#10B981" />} />
              </View>
              <View style={styles.statRow}>
                <StatCard label="Assignments" value={facultyData.total_assignments || 0} color="#8B5CF6" icon={<GraduationCap size={18} color="#8B5CF6" />} />
                <StatCard label="Submissions" value={facultyData.total_submissions || 0} color={theme.colors.warning} icon={<CheckCircle size={18} color={theme.colors.warning} />} />
              </View>
              <View style={styles.statRow}>
                <StatCard label="Total Classes" value={facultyData.total_classes || 0} color="#06B6D4" icon={<Clock size={18} color="#06B6D4" />} />
              </View>

              {facultyData.courses?.length > 0 && (
                <>
                  <SectionTitle title="Your Courses" />
                  {facultyData.courses.map((c: any, i: number) => (
                    <Card key={i} style={{ marginBottom: 8, marginHorizontal: 0 }}>
                      <View style={styles.courseRow}>
                        <View style={[styles.courseDot, { backgroundColor: c.color || '#0EA5E9' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseName}>{c.name}</Text>
                          <Text style={styles.courseCode}>{c.code} • {c.credits} credits</Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                </>
              )}
            </>
          )}

          {/* Admin Analytics */}
          {(user?.role === 'college_admin' || user?.role === 'super_admin') && adminData && (
            <>
              <SectionTitle title="Institution Overview" />
              <View style={styles.statRow}>
                <StatCard label="Students" value={adminData.students || 0} color="#0EA5E9" icon={<Users size={18} color="#0EA5E9" />} />
                <StatCard label="Faculty" value={adminData.faculty || 0} color="#10B981" icon={<GraduationCap size={18} color="#10B981" />} />
              </View>
              <View style={styles.statRow}>
                <StatCard label="Courses" value={adminData.courses || 0} color="#8B5CF6" icon={<BookOpen size={18} color="#8B5CF6" />} />
                <StatCard label="Colleges" value={adminData.colleges || 0} color="#06B6D4" icon={<Building2 size={18} color="#06B6D4" />} />
              </View>

              <SectionTitle title="Operations" />
              <View style={styles.statRow}>
                <StatCard label="Books" value={adminData.books || 0} color={theme.colors.warning} icon={<BookOpen size={18} color={theme.colors.warning} />} />
                <StatCard label="Issued" value={adminData.books_issued || 0} color={theme.colors.error} icon={<TrendingDown size={18} color={theme.colors.error} />} />
              </View>
              <View style={styles.statRow}>
                <StatCard label="Hostel Occupants" value={adminData.hostel_occupants || 0} color="#8B5CF6" icon={<Building2 size={18} color="#8B5CF6" />} />
                <StatCard label="Pending Fees" value={adminData.pending_fees || 0} color={theme.colors.error} icon={<DollarSign size={18} color={theme.colors.error} />} />
              </View>

              <Card style={{ marginHorizontal: 0, marginTop: 8 }}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Attendance Rate</Text>
                  <Text style={styles.metricValue}>{adminData.attendance_rate || 0}%</Text>
                </View>
                <ProgressBar value={adminData.attendance_rate || 0} height={8} showPct color="#10B981" />
                <View style={[styles.metricRow, { marginTop: 16 }]}>
                  <Text style={styles.metricLabel}>Student:Faculty Ratio</Text>
                  <Text style={styles.metricValue}>{adminData.student_faculty_ratio || 0}:1</Text>
                </View>
              </Card>

              {adminData.open_grievances > 0 && (
                <Card style={{ marginHorizontal: 0, marginTop: 8, borderColor: '#FEF3C7' }}>
                  <View style={styles.alertRow}>
                    <AlertTriangle size={18} color={theme.colors.warning} />
                    <Text style={styles.alertText}>{adminData.open_grievances} open grievances need attention</Text>
                  </View>
                </Card>
              )}
            </>
          )}
          </AsyncView>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },

  ringRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  ringCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  ringValue: { color: '#0EA5E9', fontSize: 28, fontWeight: '900', marginBottom: 8 },

  statRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },

  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseDot: { width: 8, height: 8, borderRadius: 4 },
  courseName: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '700' },
  courseCode: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },

  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  metricLabel: { color: theme.colors.muted, fontSize: 13, fontWeight: '600' },
  metricValue: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '800' },

  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  alertText: { color: theme.colors.warning, fontSize: 13, fontWeight: '600', flex: 1 },
});
