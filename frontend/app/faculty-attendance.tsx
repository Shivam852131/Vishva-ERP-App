import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from '@/src/navigation/router';
import {
  BarChart3, BookOpen, Clock, AlertTriangle, ChevronRight, CheckCircle2, History,
} from 'lucide-react-native';
import { theme } from '@/src/theme';
import {
  PageHeader, TabSelector, StatCard, ProgressBar, ProgressRing,
  AsyncView, EmptyState, SectionTitle,
} from '@/src/ui';
import { useFetch } from '@/src/hooks/useFetch';

type CourseRow = {
  id: string;
  name: string;
  code: string;
  department: string;
  semester: string;
  enrolled: number;
  sessions: number;
  present: number;
  late: number;
  absent: number;
  classes_marked: number;
  percentage: number;
};

type DefaulterRow = {
  student_id: string;
  name: string;
  student_code: string;
  percentage: number;
  shortfall_classes: number;
  course_id: string;
  course_name: string;
  course_percentage: number;
  present: number;
  late: number;
  absent: number;
  total: number;
};

type TrendPoint = { date: string; percentage: number; marked: number };

type SessionRow = {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  date: string;
  method: string;
  active: boolean;
  present: number;
  enrolled: number;
  percentage: number;
};

type OverviewData = {
  period_days: number;
  threshold: number;
  faculty_only: boolean;
  truncated: boolean;
  totals: {
    courses: number;
    sessions: number;
    students: number;
    present: number;
    late: number;
    absent: number;
    classes_marked: number;
    defaulters: number;
    percentage: number;
  };
  courses: CourseRow[];
  defaulters: DefaulterRow[];
  trend: TrendPoint[];
  sessions: SessionRow[];
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'courses', label: 'Courses', icon: BookOpen },
  { key: 'defaulters', label: 'At risk', icon: AlertTriangle },
  { key: 'sessions', label: 'Sessions', icon: Clock },
];

/** Amber once a course nears the line, red once it drops below it. */
function riskColor(pct: number, threshold: number) {
  if (pct < threshold) return theme.colors.error;
  if (pct < threshold + 10) return theme.colors.warning;
  return theme.colors.success;
}

function initials(name: string) {
  const parts = String(name || '').split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function Chip({ label }: { label: string }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipTxt} numberOfLines={1} maxFontSizeMultiplier={1.15}>{label}</Text>
    </View>
  );
}

export default function FacultyAttendanceConsole() {
  const router = useRouter();
  const [tab, setTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, refresh } = useFetch<OverviewData>(
    '/attendance/faculty/overview?days=30',
  );

  const threshold = data?.threshold ?? 75;
  const totals = data?.totals;
  const trendPoints = (data?.trend || []).slice(-14);
  const courses = data?.courses || [];
  const defaulters = data?.defaulters || [];
  const sessions = data?.sessions || [];

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const scoped = !!data?.faculty_only;
  const overall = totals?.percentage ?? 0;
  const overallColor = riskColor(overall, threshold);

  const goToCourse = (id: string) => {
    if (!id) return;
    router.push(`/faculty-attendance-course?id=${id}` as any);
  };

  const tabs = TABS.map((t) =>
    t.key === 'defaulters' && totals?.defaulters ? { ...t, badge: totals.defaulters } : t,
  );

  const emptyTitle =
    tab === 'defaulters' ? 'Nobody below the line' : tab === 'sessions' ? 'No sessions yet' : 'Nothing here yet';
  const emptySub =
    tab === 'defaulters'
      ? 'Every student with a mark on record is at or above the shortage requirement.'
      : tab === 'sessions'
        ? 'Start a class from your Classes tab and it will show up here.'
        : 'Attendance appears once a session has been closed.';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PageHeader
        title="Attendance Console"
        subtitle={scoped ? 'Your courses only' : 'All courses in this college'}
        badge={
          scoped ? (
            <View style={s.scopeBadge}>
              <Text style={s.scopeBadgeTxt}>Faculty</Text>
            </View>
          ) : undefined
        }
        rightAction={
          <Pressable
            testID="open-attendance-history"
            accessibilityLabel="Attendance history"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/attendance-history' as any)}
            style={s.historyBtn}
          >
            <History size={18} color={theme.colors.brandPrimary} />
          </Pressable>
        }
      />
      <TabSelector tabs={tabs} activeTab={tab} onSelect={setTab} />

      <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {data?.truncated && (
            <View style={s.warnBar}>
              <AlertTriangle size={14} color={theme.colors.onWarning} />
              <Text style={s.warnBarTxt} numberOfLines={2}>
                Showing the most recent records. Narrow the range for a complete picture.
              </Text>
            </View>
          )}

          {/* ── Overview ── */}
          {tab === 'overview' && totals && (
            <View>
              <View style={s.ringCard}>
                <ProgressRing
                  percentage={overall}
                  size={116}
                  strokeWidth={10}
                  color={overallColor}
                  label="Overall"
                  sub={`${threshold}% shortage line`}
                />
                <View style={s.ringSide}>
                  <Text style={s.ringSidePct}>{overall}%</Text>
                  <Text style={s.ringSideLbl}>across {totals.courses} {totals.courses === 1 ? 'course' : 'courses'}</Text>
                  <View style={s.ringStat}>
                    <CheckCircle2 size={13} color={theme.colors.success} />
                    <Text style={s.ringStatTxt}>{totals.present} present</Text>
                  </View>
                  <View style={s.ringStat}>
                    <Clock size={13} color={theme.colors.warning} />
                    <Text style={s.ringStatTxt}>{totals.late} late</Text>
                  </View>
                  <View style={s.ringStat}>
                    <AlertTriangle size={13} color={theme.colors.error} />
                    <Text style={s.ringStatTxt}>{totals.absent} absent</Text>
                  </View>
                </View>
              </View>

              <View style={s.statRow}>
                <StatCard testID="fac-att-classes" label="Classes" value={totals.classes_marked} sub="Marked" color={theme.colors.brandPrimary} />
                <StatCard testID="fac-att-students" label="Students" value={totals.students} sub="Enrolled" color={theme.colors.info} />
              </View>
              <View style={s.statRow}>
                <StatCard testID="fac-att-sessions" label="Sessions" value={totals.sessions} sub={`Last ${data?.period_days || 30} days`} color={theme.colors.brandSecondary} />
                <StatCard
                  testID="fac-att-defaulters"
                  label="At risk"
                  value={totals.defaulters}
                  sub="Below the line"
                  color={totals.defaulters ? theme.colors.error : theme.colors.success}
                />
              </View>

              <SectionTitle title="Daily trend" />
              <View style={s.chartCard} testID="fac-att-trend">
                {trendPoints.length ? (
                  <>
                    <View style={s.chartRow}>
                      {trendPoints.map((p) => (
                        <View key={p.date} style={s.barWrap}>
                          <View
                            accessibilityLabel={`${p.date}: ${p.percentage}%`}
                            style={[
                              s.bar,
                              {
                                height: Math.max(4, Math.round((p.percentage / 100) * 96)),
                                backgroundColor: riskColor(p.percentage, threshold),
                              },
                            ]}
                          />
                        </View>
                      ))}
                    </View>
                    <View style={s.chartLabels}>
                      <Text style={s.chartLabel}>{fmtDate(trendPoints[0].date)}</Text>
                      <Text style={s.chartLabel}>{fmtDate(trendPoints[trendPoints.length - 1].date)}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={s.chartEmpty}>No daily data yet.</Text>
                )}
              </View>

              <View style={s.thresholdCard}>
                <Text style={s.thresholdTitle}>Shortage line · {threshold}%</Text>
                <Text style={s.thresholdTxt}>
                  Students under {threshold}% lose exam eligibility. Open a course to see how many more classes each
                  student needs to recover.
                </Text>
              </View>
            </View>
          )}

          {/* ── Courses ── */}
          {tab === 'courses' && (
            <View style={s.list}>
              {courses.length === 0 && (
                <EmptyState
                  title="No courses assigned"
                  sub="You have no courses to teach yet, or attendance has not been recorded."
                  icon={<BookOpen size={40} color={theme.colors.muted} />}
                />
              )}
              {courses.map((c) => {
                const color = riskColor(c.percentage, threshold);
                return (
                  <Pressable
                    key={c.id}
                    testID={`fac-course-${c.code || c.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name}, ${c.percentage} percent`}
                    onPress={() => goToCourse(c.id)}
                    style={s.card}
                  >
                    <View style={s.cardHead}>
                      <View style={s.cardHeadLeft}>
                        <Text style={s.cardTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>{c.name}</Text>
                        <Text style={s.cardSub} numberOfLines={1}>
                          {c.code}{c.department ? ` · ${c.department}` : ''}{c.semester ? ` · ${c.semester}` : ''}
                        </Text>
                      </View>
                      <Text style={[s.pct, { color }]}>{c.percentage}%</Text>
                      <ChevronRight size={18} color={theme.colors.muted} />
                    </View>
                    <ProgressBar value={c.percentage} color={color} />
                    <View style={s.chipsRow}>
                      <Chip label={`${c.enrolled} students`} />
                      <Chip label={`${c.sessions} ${c.sessions === 1 ? 'class' : 'classes'}`} />
                      <Chip label={`${c.present}P · ${c.late}L · ${c.absent}A`} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* ── At risk ── */}
          {tab === 'defaulters' && (
            <View style={s.list}>
              {defaulters.length === 0 && (
                <EmptyState
                  title={emptyTitle}
                  sub={emptySub}
                  icon={<CheckCircle2 size={40} color={theme.colors.success} />}
                />
              )}
              {defaulters.map((d) => (
                <Pressable
                  key={d.student_id}
                  testID={`fac-risk-${d.student_id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.name}, ${d.percentage} percent`}
                  onPress={() => goToCourse(d.course_id)}
                  style={s.card}
                >
                  <View style={s.cardHead}>
                    <View style={s.avatar}>
                      <Text style={s.avatarTxt}>{initials(d.name)}</Text>
                    </View>
                    <View style={s.cardHeadLeft}>
                      <Text style={s.cardTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>{d.name}</Text>
                      <Text style={s.cardSub} numberOfLines={1}>
                        {d.student_code || 'No ID'}
                        {d.course_name ? ` · ${d.course_name} ${d.course_percentage}%` : ''}
                      </Text>
                    </View>
                    <View style={s.pctBadge}>
                      <Text style={s.pctBadgeTxt}>{d.percentage}%</Text>
                    </View>
                  </View>
                  <View style={s.recoverRow}>
                    <Clock size={13} color={theme.colors.warning} />
                    <Text style={s.recoverTxt}>
                      {d.shortfall_classes > 0
                        ? `Needs ${d.shortfall_classes} more ${d.shortfall_classes === 1 ? 'class' : 'classes'} to reach ${threshold}%`
                        : `Close to ${threshold}% — next classes matter`}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* ── Sessions ── */}
          {tab === 'sessions' && (
            <View style={s.list}>
              {sessions.length === 0 && (
                <EmptyState title={emptyTitle} sub={emptySub} icon={<Clock size={40} color={theme.colors.muted} />} />
              )}
              {sessions.map((sess) => {
                const color = riskColor(sess.percentage, threshold);
                return (
                  <Pressable
                    key={sess.id}
                    testID={`fac-session-${sess.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Session on ${sess.date}`}
                    onPress={() => router.push(`/attendance-live-advanced?sid=${sess.id}` as any)}
                    style={s.card}
                  >
                    <View style={s.cardHead}>
                      <View style={s.cardHeadLeft}>
                        <Text style={s.cardTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                          {sess.course_name || sess.course_code || 'Class'}
                        </Text>
                        <Text style={s.cardSub} numberOfLines={1}>
                          {fmtDate(sess.date)} · {String(sess.method || '').toUpperCase()}
                        </Text>
                      </View>
                      {sess.active ? (
                        <View style={s.liveBadge}>
                          <View style={s.liveDot} />
                          <Text style={s.liveTxt}>Live</Text>
                        </View>
                      ) : null}
                      <Text style={[s.pct, { color }]}>{sess.percentage}%</Text>
                      <ChevronRight size={18} color={theme.colors.muted} />
                    </View>
                    <ProgressBar value={sess.percentage} color={color} />
                    <Text style={s.turnout}>
                      {sess.present} of {sess.enrolled || 0} attended
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </AsyncView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl },

  scopeBadge: {
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  scopeBadgeTxt: { fontSize: 10, fontWeight: '800', color: theme.colors.onBrandTertiary },
  historyBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brandPrimary + '18',
  },

  warnBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning + '33',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  warnBarTxt: { flex: 1, fontSize: 12, color: theme.colors.onWarning, fontWeight: '600' },

  ringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  ringSide: { flex: 1, minWidth: 0, gap: 4 },
  ringSidePct: { fontSize: 30, fontWeight: '900', color: theme.colors.onSurface, letterSpacing: -1 },
  ringSideLbl: { fontSize: 12, color: theme.colors.muted, marginBottom: 4 },
  ringStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ringStatTxt: { fontSize: 12, color: theme.colors.onSurfaceSecondary, fontWeight: '600' },

  statRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },

  chartCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 96 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '100%', borderRadius: 3 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  chartLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  chartEmpty: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', paddingVertical: theme.spacing.md },

  thresholdCard: {
    backgroundColor: theme.colors.brandTertiary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: 4,
  },
  thresholdTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.onBrandTertiary },
  thresholdTxt: { fontSize: 12, color: theme.colors.onBrandTertiary, lineHeight: 17 },

  list: { gap: theme.spacing.sm },
  card: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 10,
    ...theme.shadow.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardHeadLeft: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  cardSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  pct: { fontSize: 16, fontWeight: '900' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    backgroundColor: theme.colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  chipTxt: { fontSize: 10, fontWeight: '700', color: theme.colors.onSurfaceTertiary },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 13, fontWeight: '800', color: theme.colors.onBrandTertiary },

  pctBadge: { backgroundColor: theme.colors.error + '33', paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  pctBadgeTxt: { fontSize: 13, fontWeight: '900', color: theme.colors.error },

  recoverRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recoverTxt: { flex: 1, fontSize: 11, color: theme.colors.onSurfaceSecondary, fontWeight: '600' },

  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.error + '33',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.error },
  liveTxt: { fontSize: 10, fontWeight: '800', color: theme.colors.error },

  turnout: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
});
