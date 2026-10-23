import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from '@/src/navigation/router';
import { Download, FileText, ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react-native';
import { theme } from '@/src/theme';
import {
  PageHeader, StatCard, ChipBtn, Button, AsyncView, EmptyState, SearchBar, SectionTitle,
} from '@/src/ui';
import { useFetch } from '@/src/hooks/useFetch';
import { apiUrl, getToken } from '@/src/api';
import { downloadFile, openFile } from '@/src/download';

type HistoryItem = {
  id: string;
  date: string;
  status: 'present' | 'late' | 'absent';
  method: string;
  student_id: string;
  student_name: string;
  student_code: string;
  course_id: string;
  course_name: string;
  course_code: string;
  corrected: boolean;
  corrected_at: string | null;
  corrected_by: string | null;
  correction_reason: string | null;
  original_status: string | null;
};

type HistorySummary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  corrected: number;
  percentage: number;
};

type HistoryResponse = {
  items: HistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  order: string;
  summary: HistorySummary;
};

type Filters = {
  courseId: string;
  status: string;
  from: string;
  to: string;
  search: string;
  correctedOnly: boolean;
  sort: string;
  order: string;
  page: number;
};

const PAGE_SIZE = 20;
const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
];
const SORTS = [
  { key: 'date', label: 'Date' },
  { key: 'student', label: 'Student' },
  { key: 'status', label: 'Status' },
  { key: 'method', label: 'Method' },
];

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * One query builder feeds the page and the exports, so the CSV/PDF always
 * contains exactly the rows on screen (minus paging).
 */
function historyPath(f: Filters, withPaging: boolean) {
  const parts: string[] = [];
  const add = (key: string, value?: string) => {
    if (value) parts.push(`${key}=${encodeURIComponent(value)}`);
  };
  if (withPaging) {
    parts.push(`page=${f.page}`);
    parts.push(`pageSize=${PAGE_SIZE}`);
  }
  add('courseId', f.courseId);
  if (f.status !== 'all') add('status', f.status);
  add('from', validDate(f.from) ? f.from : '');
  add('to', validDate(f.to) ? f.to : '');
  add('search', f.search);
  if (f.correctedOnly) add('corrected', 'true');
  add('sort', f.sort);
  add('order', f.order);
  return `/attendance/history${parts.length ? `?${parts.join('&')}` : ''}`;
}

function statusColor(status: string) {
  if (status === 'absent') return theme.colors.error;
  if (status === 'late') return theme.colors.warning;
  return theme.colors.success;
}

function riskColor(pct: number) {
  if (pct < 75) return theme.colors.error;
  if (pct < 85) return theme.colors.warning;
  return theme.colors.success;
}

function fmtDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export default function AttendanceHistoryScreen() {
  const router = useRouter();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [correctedOnly, setCorrectedOnly] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'date' | 'course'>('date');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Debounced so typing a name does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters: Filters = { courseId, status, from, to, search, correctedOnly, sort, order, page };
  const path = historyPath(filters, true);
  const { data, loading, error, refresh } = useFetch<HistoryResponse>(path);
  const { data: courses } = useFetch<Array<{ _id?: string; id?: string; name: string; code?: string }>>('/courses');

  const summary = data?.summary;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Class-wise or date-wise view of the current page.
  const groups = useMemo(() => {
    const items = data?.items || [];
    const map = new Map<string, HistoryItem[]>();
    for (const item of items) {
      const key = groupBy === 'date'
        ? item.date
        : `${item.course_name || 'Course'} ${item.course_code || ''}`.trim();
      const bucket = map.get(key);
      if (bucket) bucket.push(item);
      else map.set(key, [item]);
    }
    const entries = [...map.entries()];
    if (groupBy === 'date') entries.sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
    else entries.sort(([a], [b]) => a.localeCompare(b));
    return entries;
  }, [data?.items, groupBy]);

  // Returns an onPress handler — the setter only runs when pressed, never
  // during render (calling it inline would loop render-phase updates).
  const applyFilter = <T,>(setter: (value: T) => void, value: T) => () => {
    setter(value);
    setPage(1);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const exportFile = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      const token = await getToken();
      const stamp = new Date().toISOString().slice(0, 10);
      const result = await downloadFile(
        apiUrl(`${historyPath(filters, false)}&format=${format}`),
        `attendance-history-${stamp}.${format}`,
        undefined,
        token ? { Authorization: `Bearer ${token}` } : undefined,
      );
      await openFile(result.path);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export the attendance history.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PageHeader
        title="Attendance history"
        subtitle={data ? `${total} mark${total === 1 ? '' : 's'} · page ${page} of ${totalPages}` : 'All marks, filterable'}
        onBack={() => router.back()}
      />

      <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {/* Exports carry the same filters as the list above them. */}
          <View style={s.exportRow}>
            <Button
              label="Export CSV"
              icon={<Download size={16} color={theme.colors.brandPrimary} />}
              variant="secondary"
              onPress={() => exportFile('csv')}
              loading={exporting === 'csv'}
              disabled={!!exporting}
              testID="export-csv"
              style={{ flex: 1 }}
            />
            <Button
              label="Export PDF"
              icon={<FileText size={16} color={theme.colors.brandPrimary} />}
              variant="secondary"
              onPress={() => exportFile('pdf')}
              loading={exporting === 'pdf'}
              disabled={!!exporting}
              testID="export-pdf"
              style={{ flex: 1 }}
            />
          </View>

          {summary && (
            <>
              <View style={s.statRow}>
                <StatCard
                  testID="history-pct"
                  label="Attendance"
                  value={`${summary.percentage}%`}
                  sub={`${summary.total} marks in view`}
                  color={riskColor(summary.percentage)}
                />
                <StatCard
                  testID="history-corrected"
                  label="Corrected"
                  value={summary.corrected}
                  sub="With audit trail"
                  color={theme.colors.warning}
                />
              </View>
              <View style={s.statRow}>
                <StatCard testID="history-present" label="Present" value={summary.present} sub={`${summary.late} late`} color={theme.colors.success} />
                <StatCard testID="history-absent" label="Absent" value={summary.absent} sub="In this filter" color={theme.colors.error} />
              </View>
            </>
          )}

          <SectionTitle>Filters</SectionTitle>
          <View style={s.filters}>
            <SearchBar
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Search student name or ID..."
              onClear={() => setSearchInput('')}
            />

            <View style={s.chipRow}>
              {STATUSES.map((st) => (
                <ChipBtn
                  key={st.key}
                  label={st.label}
                  active={status === st.key}
                  onPress={() => {
                    setStatus(st.key);
                    setPage(1);
                  }}
                  testID={`history-status-${st.key}`}
                />
              ))}
              <ChipBtn
                label="Corrected only"
                active={correctedOnly}
                onPress={() => {
                  setCorrectedOnly((v) => !v);
                  setPage(1);
                }}
                testID="history-corrected-only"
              />
            </View>

            <View style={s.chipRow}>
              <ChipBtn
                label="All courses"
                active={!courseId}
                onPress={applyFilter(setCourseId, '')}
                testID="history-course-all"
              />
              {(courses || []).map((c) => {
                const id = String(c.id || c._id || '');
                return (
                  <ChipBtn
                    key={id}
                    label={c.code || c.name}
                    active={courseId === id}
                    onPress={applyFilter(setCourseId, id)}
                    testID={`history-course-${id}`}
                  />
                );
              })}
            </View>

            <View style={s.dateRow}>
              <View style={s.dateField}>
                <Text style={s.dateLabel}>From</Text>
                <TextInput
                  testID="history-from"
                  accessibilityLabel="From date"
                  value={from}
                  onChangeText={(v) => {
                    setFrom(v);
                    setPage(1);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  style={s.dateInput}
                />
              </View>
              <View style={s.dateField}>
                <Text style={s.dateLabel}>To</Text>
                <TextInput
                  testID="history-to"
                  accessibilityLabel="To date"
                  value={to}
                  onChangeText={(v) => {
                    setTo(v);
                    setPage(1);
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.colors.muted}
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  style={s.dateInput}
                />
              </View>
            </View>

            <View style={s.chipRow}>
              <Text style={s.sortLabel}>Sort</Text>
              {SORTS.map((so) => (
                <ChipBtn
                  key={so.key}
                  label={so.label}
                  active={sort === so.key}
                  onPress={() => {
                    setSort(so.key);
                    setPage(1);
                  }}
                  testID={`history-sort-${so.key}`}
                />
              ))}
              <ChipBtn
                label={order === 'desc' ? 'Descending' : 'Ascending'}
                active
                onPress={() => {
                  setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                  setPage(1);
                }}
                testID="history-order"
              />
            </View>

            <View style={s.chipRow}>
              <Text style={s.sortLabel}>View</Text>
              <ChipBtn
                label="By date"
                active={groupBy === 'date'}
                onPress={() => setGroupBy('date')}
                testID="history-group-date"
              />
              <ChipBtn
                label="By class"
                active={groupBy === 'course'}
                onPress={() => setGroupBy('course')}
                testID="history-group-course"
              />
            </View>
          </View>

          {data && data.items.length === 0 && (
            <EmptyState
              title="No marks match these filters"
              sub="Try widening the date range, clearing the search, or picking another course."
              icon={<SearchIcon size={40} color={theme.colors.muted} />}
            />
          )}

          {groups.map(([key, items]) => (
            <View key={key} style={s.group}>
              <Text style={s.groupTitle} testID={`history-group-${key}`}>
                {groupBy === 'date' ? fmtDay(key) : key}
                <Text style={s.groupCount}>  ·  {items.length}</Text>
              </Text>

              {items.map((item) => (
                <View key={item.id} testID={`history-row-${item.id}`} style={s.row}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowName} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                      {item.student_name}
                      {item.student_code ? <Text style={s.rowCode}>  ·  {item.student_code}</Text> : null}
                    </Text>
                    <Text style={s.rowMeta} numberOfLines={1}>
                      {groupBy === 'date'
                        ? `${item.course_name || item.course_code} · ${item.method}`
                        : `${fmtDate(item.date)} · ${item.method}`}
                    </Text>
                    {item.corrected && (
                      <Text style={s.rowCorrected} numberOfLines={1} testID={`history-corrected-${item.id}`}>
                        ↻ corrected{item.original_status ? ` from ${item.original_status}` : ''} · {item.corrected_by || 'staff'}
                      </Text>
                    )}
                  </View>
                  <View style={[s.statusPill, { backgroundColor: statusColor(item.status) + '20' }]}>
                    <Text style={[s.statusPillTxt, { color: statusColor(item.status) }]}>{item.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}

          {total > 0 && (
            <View style={s.pager}>
              <Button
                label="Prev"
                icon={<ChevronLeft size={16} color={theme.colors.brandPrimary} />}
                variant="secondary"
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                testID="page-prev"
                style={{ flex: 1 }}
              />
              <Text style={s.pagerTxt} testID="page-label">
                {page} / {totalPages}
              </Text>
              <Button
                label="Next"
                icon={<ChevronRight size={16} color={theme.colors.brandPrimary} />}
                variant="secondary"
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                testID="page-next"
                style={{ flex: 1 }}
              />
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

  exportRow: { flexDirection: 'row', gap: theme.spacing.sm },
  statRow: { flexDirection: 'row', gap: theme.spacing.sm },
  filters: {
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  sortLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.muted, marginRight: 2 },

  dateRow: { flexDirection: 'row', gap: theme.spacing.sm },
  dateField: { flex: 1, gap: 4 },
  dateLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.muted },
  dateInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    fontSize: 13,
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.surface,
  },

  group: { gap: 6, marginTop: theme.spacing.xs },
  groupTitle: { fontSize: 13, fontWeight: '900', color: theme.colors.onSurface, marginTop: theme.spacing.sm },
  groupCount: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  rowName: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  rowCode: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  rowMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  rowCorrected: { fontSize: 11, color: theme.colors.warning, fontWeight: '700', marginTop: 2 },

  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: theme.radius.pill },
  statusPillTxt: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },

  pager: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  pagerTxt: { fontSize: 12, fontWeight: '800', color: theme.colors.onSurface, minWidth: 64, textAlign: 'center' },
});
