import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, Pressable, Modal, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from '@/src/navigation/router';
import { Clock, AlertTriangle, CheckCircle2, Users, X } from 'lucide-react-native';
import { theme } from '@/src/theme';
import {
  PageHeader, StatCard, ProgressBar, AsyncView, EmptyState, SearchBar, ChipBtn, Button,
} from '@/src/ui';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';

type StudentRow = {
  id: string;
  name: string;
  student_code: string;
  enrolled: boolean;
  present: number;
  late: number;
  absent: number;
  total: number;
  percentage: number;
  status: 'critical' | 'safe' | 'unmarked';
  shortfall_classes: number;
  history: Record<string, string>;
};

type CourseDetail = {
  threshold: number;
  period: { startDate: string; endDate: string };
  course: { id: string; name: string; code: string; department: string; semester: string };
  summary: {
    present: number;
    late: number;
    absent: number;
    classes_marked: number;
    sessions: number;
    enrolled: number;
    marked: number;
    defaulters: number;
    percentage: number;
  };
  students: StudentRow[];
  sessions: Array<{
    id: string;
    date: string;
    method: string;
    active: boolean;
    present: number;
    enrolled: number;
    percentage: number;
  }>;
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'critical', label: 'At risk' },
  { key: 'safe', label: 'Safe' },
  { key: 'unmarked', label: 'Unmarked' },
];

function riskColor(pct: number, threshold: number) {
  if (pct < threshold) return theme.colors.error;
  if (pct < threshold + 10) return theme.colors.warning;
  return theme.colors.success;
}

function dotColor(status: string) {
  if (status === 'absent') return theme.colors.error;
  if (status === 'late') return theme.colors.warning;
  return theme.colors.success;
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

/** A mark the faculty member tapped, and wants to correct. */
type CorrectionTarget = {
  studentId: string;
  studentName: string;
  date: string;
  status: string;
};

type AuditEntry = {
  id: string;
  previous_status: string;
  new_status: string;
  reason: string;
  actor_name: string;
  created_at: string;
};

type AuditTrail = {
  items: AuditEntry[];
  total: number;
  current_status: string;
  original_status: string;
};

const STATUS_OPTIONS = [
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
];

export default function FacultyAttendanceCourse() {
  const params = useLocalSearchParams<{ id: string }>();
  const courseId = String(params.id || '');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const { data, loading, error, refresh } = useFetch<CourseDetail>(
    courseId ? `/attendance/faculty/course/${courseId}` : null,
  );

  // Correction sheet: which mark is being corrected, the proposed new status,
  // and the (mandatory) reason. The audit trail for the open mark loads read-only.
  const [target, setTarget] = useState<CorrectionTarget | null>(null);
  const [newStatus, setNewStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const auditPath = target
    ? `/attendance/records/audit?courseId=${encodeURIComponent(courseId)}&studentId=${encodeURIComponent(target.studentId)}&date=${target.date}`
    : null;
  const { data: audit, refresh: refreshAudit } = useFetch<AuditTrail>(auditPath);

  const threshold = data?.threshold ?? 75;
  const summary = data?.summary;
  // Memoised on `data` so the filtered list below does not recompute every render.
  const students = useMemo(() => data?.students || [], [data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false;
      if (!q) return true;
      return row.name.toLowerCase().includes(q) || row.student_code.toLowerCase().includes(q);
    });
  }, [students, query, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const openCorrection = (row: StudentRow, date: string, status: string) => {
    // Preselect the current mark so "Save" stays disabled until something
    // actually changes — a no-op correction is refused by the server anyway.
    setTarget({ studentId: row.id, studentName: row.name, date, status });
    setNewStatus(status);
    setReason('');
  };

  const submitCorrection = () => {
    if (!target) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      Alert.alert('Reason required', 'Give a reason of at least 5 characters for the correction.');
      return;
    }
    if (newStatus === target.status) {
      Alert.alert('No change', `That mark is already ${newStatus}.`);
      return;
    }

    Alert.alert(
      'Correct attendance?',
      `${target.studentName} · ${fmtDate(target.date)}\n${target.status} → ${newStatus}. The student will be notified with your reason, and the original mark stays in the audit trail.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Correct',
          onPress: async () => {
            setSaving(true);
            try {
              await api('/attendance/records/correct', {
                method: 'PATCH',
                body: JSON.stringify({
                  courseId,
                  studentId: target.studentId,
                  date: target.date,
                  status: newStatus,
                  reason: trimmed,
                  // Optimistic guard: the server refuses if the mark moved since.
                  expected_status: target.status,
                }),
              });
              setTarget(null);
              refreshAudit(); // drop the cached trail so the next open is fresh
              await refresh(); // roster, percentages and dots reflect the new mark
              Alert.alert('Attendance corrected', `${target.studentName} is now marked ${newStatus}.`);
            } catch (e: any) {
              if (e?.status === 409) await refresh(); // stale screen — reload it
              Alert.alert('Correction failed', e?.message || 'Could not correct attendance.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const counts = {
    critical: students.filter((r) => r.status === 'critical').length,
    safe: students.filter((r) => r.status === 'safe').length,
    unmarked: students.filter((r) => r.status === 'unmarked').length,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PageHeader
        title={data?.course?.name || 'Course attendance'}
        subtitle={
          data?.course
            ? [data.course.code, data.course.department].filter(Boolean).join(' · ') || 'Roster'
            : 'Roster'
        }
      />

      <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {summary && (
            <>
              <View style={s.statRow}>
                <StatCard
                  testID="course-att-pct"
                  label="Attendance"
                  value={`${summary.percentage}%`}
                  sub={`${summary.marked} of ${summary.enrolled} marked`}
                  color={riskColor(summary.percentage, threshold)}
                />
                <StatCard
                  testID="course-att-risk"
                  label="At risk"
                  value={summary.defaulters}
                  sub={`Below ${threshold}%`}
                  color={summary.defaulters ? theme.colors.error : theme.colors.success}
                />
              </View>
              <View style={s.statRow}>
                <StatCard label="Classes" value={summary.sessions} sub={`${summary.classes_marked} marks`} color={theme.colors.brandPrimary} />
                <StatCard label="Present" value={summary.present + summary.late} sub={`${summary.late} were late`} color={theme.colors.success} />
              </View>
              <View style={s.statRow}>
                <StatCard label="Absent" value={summary.absent} sub="Marks recorded" color={theme.colors.error} />
                {/* Derived from the roster, not enrolled - marked: a student can
                    hold marks without an enrolment, which would go negative. */}
                <StatCard label="Unmarked" value={counts.unmarked} sub="No data yet" color={theme.colors.muted} />
              </View>
            </>
          )}

          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search students..."
            onClear={() => setQuery('')}
          />

          <View style={s.filters}>
            {FILTERS.map((f) => (
              <ChipBtn
                key={f.key}
                label={f.key === 'all' ? `All ${students.length}` : `${FILTERS.find((x) => x.key === f.key)?.label} ${counts[f.key as 'critical' | 'safe' | 'unmarked']}`}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
                testID={`course-filter-${f.key}`}
              />
            ))}
          </View>

          {visible.length === 0 && (
            <EmptyState
              title={students.length ? 'No matching students' : 'No roster yet'}
              sub={
                students.length
                  ? 'Try a different search or filter.'
                  : 'Students appear once they are enrolled in this course.'
              }
              icon={<Users size={40} color={theme.colors.muted} />}
            />
          )}

          {visible.map((row) => {
            const color = riskColor(row.percentage, threshold);
            const dots = Object.entries(row.history || {})
              .sort(([a], [b]) => a.localeCompare(b))
              .slice(-12);
            return (
              <View key={row.id} testID={`course-student-${row.id}`} style={s.card}>
                <View style={s.head}>
                  <View style={[s.badge, { backgroundColor: color + '20' }]}>
                    <Text style={[s.badgeTxt, { color }]}>{row.total ? `${row.percentage}%` : '—'}</Text>
                  </View>
                  <View style={s.headLeft}>
                    <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={1.2}>{row.name}</Text>
                    <Text style={s.sub} numberOfLines={1}>
                      {row.student_code || 'No ID'}
                      {!row.enrolled ? ' · not enrolled' : ''}
                    </Text>
                  </View>
                  {row.status === 'critical' && (
                    <View style={s.riskTag}>
                      <AlertTriangle size={11} color={theme.colors.onBrandPrimary} />
                      <Text style={s.riskTagTxt}>Risk</Text>
                    </View>
                  )}
                  {row.status === 'safe' && <CheckCircle2 size={17} color={theme.colors.success} />}
                </View>

                <ProgressBar value={row.percentage} color={color} height={7} />

                <View style={s.metaRow}>
                  <Text style={s.meta}>{row.present}P</Text>
                  <Text style={s.meta}>{row.late}L</Text>
                  <Text style={s.meta}>{row.absent}A</Text>
                  <Text style={[s.meta, { color: theme.colors.muted }]}>{row.total} marked</Text>
                </View>

                {row.status === 'critical' && row.shortfall_classes > 0 && (
                  <View style={s.recover}>
                    <Clock size={13} color={theme.colors.warning} />
                    <Text style={s.recoverTxt}>
                      Needs {row.shortfall_classes} more {row.shortfall_classes === 1 ? 'class' : 'classes'} to reach {threshold}%
                    </Text>
                  </View>
                )}
                {row.status === 'unmarked' && (
                  <Text style={s.unmarked}>No attendance recorded yet</Text>
                )}

                {dots.length > 0 && (
                  <View style={s.dotsRow}>
                    {dots.map(([date, status]) => (
                      <Pressable
                        key={date}
                        testID={`course-dot-${row.id}-${date}`}
                        accessibilityLabel={`${fmtDate(date)}: ${status}`}
                        accessibilityRole="button"
                        hitSlop={4}
                        onPress={() => openCorrection(row, date, status)}
                        style={[s.dot, { backgroundColor: dotColor(status) }]}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </AsyncView>

      <Modal visible={!!target} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetKicker}>Correct attendance</Text>
                <Text style={s.sheetTitle} numberOfLines={1}>{target?.studentName}</Text>
                <Text style={s.sheetSub}>{target ? `${fmtDate(target.date)} · ${target.date}` : ''}</Text>
              </View>
              <Pressable
                testID="correction-close"
                accessibilityLabel="Close"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setTarget(null)}
              >
                <X size={22} color={theme.colors.muted} />
              </Pressable>
            </View>

            {target && (
              <View style={s.currentRow}>
                <View style={[s.statusTag, { backgroundColor: dotColor(target.status) + '20' }]}>
                  <Text style={[s.statusTagTxt, { color: dotColor(target.status) }]}>{target.status}</Text>
                </View>
                <Text style={s.currentTxt}>currently marked</Text>
              </View>
            )}

            <Text style={s.label}>Change to</Text>
            <View style={s.statusRow}>
              {STATUS_OPTIONS.map((opt) => (
                <ChipBtn
                  key={opt.key}
                  label={opt.label}
                  active={newStatus === opt.key}
                  onPress={() => setNewStatus(opt.key)}
                  testID={`correction-status-${opt.key}`}
                />
              ))}
            </View>

            <Text style={s.label}>Reason (required)</Text>
            <TextInput
              testID="correction-reason"
              accessibilityLabel="Correction reason"
              value={reason}
              onChangeText={setReason}
              placeholder="Why is this mark being changed? (min 5 characters)"
              placeholderTextColor={theme.colors.muted}
              multiline
              style={s.reasonInput}
            />
            <Text style={s.hint}>
              The student is notified with this reason, and the original mark is kept in the audit trail.
            </Text>

            {audit && audit.total > 0 && (
              <View style={s.trail} testID="correction-trail">
                <Text style={s.trailTitle}>Audit trail ({audit.total})</Text>
                {audit.items.map((entry) => (
                  <Text key={entry.id} style={s.trailItem} testID={`audit-entry-${entry.id}`}>
                    {fmtDate(String(entry.created_at || '').slice(0, 10))}: {entry.previous_status} → {entry.new_status}
                    {' · '}{entry.actor_name} — {entry.reason}
                  </Text>
                ))}
              </View>
            )}

            <View style={s.sheetActions}>
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => setTarget(null)}
                testID="correction-cancel"
                style={{ flex: 1 }}
              />
              <Button
                label="Save correction"
                onPress={submitCorrection}
                loading={saving}
                disabled={
                  reason.trim().length < 5 ||
                  !target ||
                  newStatus === target.status
                }
                testID="correction-save"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm, paddingBottom: theme.spacing.xxl },

  statRow: { flexDirection: 'row', gap: theme.spacing.sm },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  card: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 8,
    ...theme.shadow.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headLeft: { flex: 1, minWidth: 0 },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radius.sm, minWidth: 48, alignItems: 'center' },
  badgeTxt: { fontSize: 13, fontWeight: '900' },
  name: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  sub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  riskTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.error,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  riskTagTxt: { fontSize: 10, fontWeight: '800', color: theme.colors.onBrandPrimary },

  metaRow: { flexDirection: 'row', gap: 12 },
  meta: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurfaceSecondary },

  recover: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recoverTxt: { flex: 1, fontSize: 11, color: theme.colors.onSurfaceSecondary, fontWeight: '600' },
  unmarked: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  dotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dot: { width: 9, height: 9, borderRadius: 5 },

  // ── Correction sheet ──
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 18, 26, 0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
    maxHeight: '88%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  sheetKicker: {
    fontSize: 11, fontWeight: '800', color: theme.colors.brandPrimary,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.onSurface, marginTop: 2 },
  sheetSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },

  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: theme.radius.pill },
  statusTagTxt: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  currentTxt: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  label: { fontSize: 12, fontWeight: '800', color: theme.colors.onSurface, marginTop: 4 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    minHeight: 76,
    fontSize: 13,
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.surfaceSecondary,
    textAlignVertical: 'top',
  },
  hint: { fontSize: 11, color: theme.colors.muted },

  trail: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: 4,
  },
  trailTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.onSurface },
  trailItem: { fontSize: 11, color: theme.colors.onSurfaceSecondary },

  sheetActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
});
