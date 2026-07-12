import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Dimensions,
} from 'react-native';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Calendar,
  Target,
  Calculator,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { theme } from '@/src/theme';
import { Card, StatCard, SectionTitle, EmptyState, ProgressBar } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

interface CourseAttendance {
  course_id: string;
  course_name: string;
  course_code: string;
  color: string;
  total: number;
  present: number;
  percentage: number;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  course_id: string;
  date: string;
  present: boolean;
  method: string;
}

interface AttendanceData {
  records: AttendanceRecord[];
  by_course: CourseAttendance[];
}

function attColor(pct: number): string {
  if (pct >= 75) return '#10B981';
  if (pct >= 60) return '#F59E0B';
  return '#EF4444';
}

function OverallRing({ percentage, size = 140 }: { percentage: number; size?: number }) {
  const strokeWidth = 12;
  const fill = Math.max(0, Math.min(100, percentage));
  const color = attColor(fill);
  const circumference = ((size - strokeWidth) / 2) * 2 * Math.PI;

  return (
    <View style={{ alignItems: 'center', width: size }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[orStyles.bg, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary }]} />
        <View style={[orStyles.fill, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: color, borderLeftColor: 'transparent', borderBottomColor: 'transparent', borderTopColor: 'transparent', transform: [{ rotate: `${(fill / 100) * 360}deg` }]}]} />
        <View style={orStyles.center}>
          <Text style={[orStyles.val, { color }]}>{fill.toFixed(1)}%</Text>
          <Text style={orStyles.label}>Attendance</Text>
        </View>
      </View>
    </View>
  );
}

const orStyles = StyleSheet.create({
  bg: { position: 'absolute' },
  fill: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  val: { fontSize: 28, fontWeight: '800' },
  label: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
});

function CourseBar({ name, code, present, total, color }: { name: string; code: string; present: number; total: number; color: string }) {
  const pct = total > 0 ? (present / total) * 100 : 0;
  const c = color || attColor(pct);
  return (
    <Card style={{ marginHorizontal: theme.spacing.lg, marginBottom: 8 }}>
      <View style={cbStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={cbStyles.name} numberOfLines={1}>{name}</Text>
          <Text style={cbStyles.code}>{code}</Text>
        </View>
        <View style={[cbStyles.badge, { backgroundColor: c + '20' }]}>
          <Text style={[cbStyles.pct, { color }]}>{pct.toFixed(1)}%</Text>
        </View>
      </View>
      <View style={cbStyles.barBg}>
        <View style={[cbStyles.barFill, { width: `${pct}%`, backgroundColor: c }]} />
      </View>
      <View style={cbStyles.footer}>
        <Text style={cbStyles.detail}>{present}/{total} classes attended</Text>
        {pct < 75 && <Text style={cbStyles.warning}>Below 75%</Text>}
      </View>
    </Card>
  );
}

const cbStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  name: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  code: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  pct: { fontSize: 14, fontWeight: '800' },
  barBg: { height: 8, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  detail: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  warning: { fontSize: 11, color: theme.colors.error, fontWeight: '700' },
});

function AttendanceCalculator() {
  const [totalClasses, setTotalClasses] = useState('');
  const [attended, setAttended] = useState('');
  const [missCount, setMissCount] = useState('');

  const current = useMemo(() => {
    const t = parseInt(totalClasses, 10);
    const a = parseInt(attended, 10);
    if (isNaN(t) || isNaN(a) || t <= 0) return null;
    return { pct: (a / t) * 100, total: t, attended: a };
  }, [totalClasses, attended]);

  const whatIf = useMemo(() => {
    if (!current || !missCount) return null;
    const miss = parseInt(missCount, 10);
    if (isNaN(miss) || miss < 0) return null;
    const newTotal = current.total + miss;
    const newPct = (current.attended / newTotal) * 100;
    return { pct: newPct, total: newTotal };
  }, [current, missCount]);

  const recovery = useMemo(() => {
    if (!current) return null;
    const targets = [
      { label: '75%', value: 75 },
      { label: '85%', value: 85 },
      { label: '90%', value: 90 },
    ];
    return targets.map((t) => {
      if (current.pct >= t.value) return { ...t, needed: 0 };
      const needed = Math.ceil((t.value * current.total - 100 * current.attended) / (100 - t.value));
      return { ...t, needed: Math.max(0, needed) };
    });
  }, [current]);

  return (
    <Card style={{ marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center' }}>
          <Calculator size={16} color="#8B5CF6" />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.onSurface }}>Attendance Calculator</Text>
      </View>

      <View style={{ gap: 10 }}>
        <View style={calcStyles.row}>
          <Text style={calcStyles.label}>Total Classes</Text>
          <TextInput
            style={calcStyles.input}
            keyboardType="numeric"
            value={totalClasses}
            onChangeText={setTotalClasses}
            placeholder="0"
            placeholderTextColor={theme.colors.muted}
            testID="calc-total"
            accessibilityLabel="Total classes held"
          />
        </View>
        <View style={calcStyles.row}>
          <Text style={calcStyles.label}>Classes Attended</Text>
          <TextInput
            style={calcStyles.input}
            keyboardType="numeric"
            value={attended}
            onChangeText={setAttended}
            placeholder="0"
            placeholderTextColor={theme.colors.muted}
            testID="calc-attended"
            accessibilityLabel="Classes attended"
          />
        </View>
      </View>

      {current && (
        <View style={[calcStyles.result, { backgroundColor: attColor(current.pct) + '15' }]}>
          <Text style={{ fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' }}>
            Current: <Text style={{ color: attColor(current.pct), fontWeight: '800' }}>{current.pct.toFixed(1)}%</Text>
          </Text>
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 8 }}>What-If Scenario</Text>
        <View style={calcStyles.row}>
          <Text style={calcStyles.label}>If I miss next</Text>
          <TextInput
            style={calcStyles.input}
            keyboardType="numeric"
            value={missCount}
            onChangeText={setMissCount}
            placeholder="0"
            placeholderTextColor={theme.colors.muted}
            testID="calc-miss"
            accessibilityLabel="Number of classes to miss"
          />
          <Text style={calcStyles.label}>classes</Text>
        </View>
        {whatIf && (
          <View style={[calcStyles.result, { backgroundColor: attColor(whatIf.pct) + '15' }]}>
            <Text style={{ fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' }}>
              Attendance drops to{' '}
              <Text style={{ color: attColor(whatIf.pct), fontWeight: '800' }}>{whatIf.pct.toFixed(1)}%</Text>
            </Text>
          </View>
        )}
      </View>

      {recovery && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 8 }}>Classes needed to reach:</Text>
          {recovery.map((r, i) => (
            <View key={i} style={calcStyles.recRow}>
              <Text style={calcStyles.recTarget}>{r.label}</Text>
              <Text style={[calcStyles.recVal, { color: r.needed === 0 ? '#10B981' : theme.colors.onSurface }]}>
                {r.needed === 0 ? 'Achieved' : `${r.needed} more classes`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const calcStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  input: {
    width: 60,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  result: { marginTop: 10, padding: 10, borderRadius: theme.radius.md },
  recRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  recTarget: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  recVal: { fontSize: 12, fontWeight: '700' },
});

function SmartAlerts({ courses }: { courses: CourseAttendance[] }) {
  const warnings = courses.filter((c) => c.percentage < 75);
  if (warnings.length === 0) return null;

  return (
    <Card style={{ marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, backgroundColor: '#FEF2F2' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <AlertTriangle size={18} color={theme.colors.error} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.error }}>Attention Needed</Text>
      </View>
      {warnings.map((w, i) => {
        const classesNeeded = Math.ceil((75 * w.total - 100 * w.present) / 25);
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <XCircle size={14} color={theme.colors.error} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.onSurface }}>{w.course_name}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.error, marginTop: 1 }}>
                At {w.percentage.toFixed(1)}% — need {Math.max(0, classesNeeded)} more classes to reach 75%
              </Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function MiniCalendar({ records }: { records: AttendanceRecord[] }) {
  const last30 = useMemo(() => {
    const now = new Date();
    const thirtyAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return records.filter((r) => new Date(r.date) >= thirtyAgo);
  }, [records]);

  const days = useMemo(() => {
    const map: Record<string, { present: number; absent: number }> = {};
    last30.forEach((r) => {
      const day = r.date.slice(0, 10);
      if (!map[day]) map[day] = { present: 0, absent: 0 };
      if (r.present) map[day].present++;
      else map[day].absent++;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [last30]);

  if (days.length === 0) return null;

  return (
    <Card style={{ marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Calendar size={16} color={theme.colors.brandPrimary} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.onSurface }}>Last 30 Days</Text>
      </View>
      <View style={calStyles.grid}>
        {days.map(([date, data], i) => {
          const isAllPresent = data.absent === 0;
          const isAllAbsent = data.present === 0;
          const color = isAllPresent ? '#10B981' : isAllAbsent ? '#EF4444' : '#F59E0B';
          const dayLabel = new Date(date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' });
          return (
            <View key={i} style={[calStyles.dot, { backgroundColor: color + '20' }]} testID={`calendar-day-${i}`}>
              <View style={[calStyles.dotInner, { backgroundColor: color }]} />
              <Text style={calStyles.dotLabel}>{dayLabel}</Text>
            </View>
          );
        })}
      </View>
      <View style={calStyles.legend}>
        <View style={calStyles.legendItem}><View style={[calStyles.legendDot, { backgroundColor: '#10B981' }]} /><Text style={calStyles.legendTxt}>Present</Text></View>
        <View style={calStyles.legendItem}><View style={[calStyles.legendDot, { backgroundColor: '#EF4444' }]} /><Text style={calStyles.legendTxt}>Absent</Text></View>
        <View style={calStyles.legendItem}><View style={[calStyles.legendDot, { backgroundColor: '#F59E0B' }]} /><Text style={calStyles.legendTxt}>Partial</Text></View>
      </View>
    </Card>
  );
}

const calStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dot: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 10, height: 10, borderRadius: 5 },
  dotLabel: { fontSize: 7, color: theme.colors.muted, marginTop: 2, fontWeight: '600' },
  legend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
});

export default function AttendancePredictor() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFetch<AttendanceData>('/attendance/me');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const overallPct = useMemo(() => {
    if (!data?.by_course || data.by_course.length === 0) return 0;
    const total = data.by_course.reduce((s, c) => s + c.total, 0);
    const present = data.by_course.reduce((s, c) => s + c.present, 0);
    return total > 0 ? (present / total) * 100 : 0;
  }, [data]);

  return (
    <ErrorBoundary>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !data ? (
          <View style={styles.centered}>
            <Text style={{ color: theme.colors.muted }}>Loading attendance data...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <AlertTriangle size={32} color={theme.colors.error} />
            <Text style={{ color: theme.colors.error, marginTop: 8 }}>{error}</Text>
            <Pressable onPress={refresh} testID="retry-attendance" accessibilityLabel="Retry loading attendance">
              <Text style={{ color: theme.colors.brandPrimary, fontWeight: '700', marginTop: 8 }}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : !data || data.by_course.length === 0 ? (
          <EmptyState icon={<Calendar size={48} color={theme.colors.muted} />} title="No Attendance Data" sub="Your attendance records will appear here once available." />
        ) : (
          <>
            {/* Overall Ring */}
            <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
              <OverallRing percentage={overallPct} />
              <Text style={styles.overallLabel}>Overall Attendance</Text>
            </View>

            {/* Stats */}
            <View style={styles.statRow}>
              <StatCard label="Total Classes" value={data.by_course.reduce((s, c) => s + c.total, 0).toString()} icon={<Calendar size={16} color={theme.colors.info} />} color={theme.colors.info} testID="total-classes" />
              <StatCard label="Attended" value={data.by_course.reduce((s, c) => s + c.present, 0).toString()} icon={<CheckCircle size={16} color="#10B981" />} color="#10B981" testID="attended-classes" />
            </View>

            {/* Per-Course Bars */}
            <SectionTitle title="Course-wise Attendance" />
            {data.by_course.map((c) => (
              <CourseBar key={c.course_id} name={c.course_name} code={c.course_code} present={c.present} total={c.total} color={c.color} />
            ))}

            {/* Smart Alerts */}
            <SmartAlerts courses={data.by_course} />

            {/* Calculator */}
            <AttendanceCalculator />

            {/* Mini Calendar */}
            {data.records && <MiniCalendar records={data.records} />}

            <View style={{ height: theme.spacing.xl }} />
          </>
        )}
      </ScrollView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  overallLabel: { fontSize: 13, color: theme.colors.muted, fontWeight: '600', marginTop: 8 },
  statRow: { flexDirection: 'row', gap: 12, paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg },
});
