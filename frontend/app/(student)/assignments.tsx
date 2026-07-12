import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Modal, Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { CheckCircle2, Clock, X, Send, FileText, AlertTriangle, ChevronRight } from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Assignment } from '@/src/types';
import { theme } from '@/src/theme';
import { ChipBtn, GradientButton, EmptyState } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function Assignments() {
  const { data: items, loading, refresh } = useFetch<Assignment[]>('/assignments');
  const { mutate: submitAssign, loading: submitting } = useMutate();
  const [sel, setSel] = useState<Assignment | null>(null);
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'submitted'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const animDone = useRef(false);

  useEffect(() => {
    if (!loading && !animDone.current) {
      animDone.current = true;
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [loading]);

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

  const submit = async () => {
    if (!sel || !text.trim()) return;
    try {
      await submitAssign('/assignments/submit', {
        method: 'POST',
        body: JSON.stringify({ assignment_id: sel.id, content: text }),
      });
      setSel(null);
      setText('');
      refresh();
    } catch {
      /* handled by useMutate */
    }
  };

  const filtered = (items || []).filter(a => {
    if (filter === 'pending') return !a.submitted;
    if (filter === 'submitted') return a.submitted;
    return true;
  });

  const daysUntilDue = (due: string) => {
    return Math.ceil((new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const pendingCount = (items || []).filter(a => !a.submitted).length;
  const submittedCount = (items || []).filter(a => a.submitted).length;
  const loadingInitial = loading && !items;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={['#047857', '#059669']} style={styles.header}>
          <Text style={styles.title}>Assignments</Text>
          <Text style={styles.sub}>{pendingCount} pending · {submittedCount} done</Text>
        </LinearGradient>

        <View style={styles.filterRow}>
          {(['all', 'pending', 'submitted'] as const).map(f => (
            <ChipBtn
              key={f}
              label={f.charAt(0).toUpperCase() + f.slice(1)}
              active={filter === f}
              onPress={() => setFilter(f)}
              testID={`filter-${f}`}
            />
          ))}
        </View>

        {loadingInitial ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <Animated.ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 10 }}
            style={{ opacity: fadeAnim }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />
            }
          >
            {filtered.length === 0 && (
              <EmptyState
                title="No assignments"
                sub={filter === 'pending' ? 'All caught up!' : 'No assignments match this filter'}
                icon="✅"
              />
            )}
            {filtered.map(a => {
              const daysLeft = daysUntilDue(a.due_date);
              const isUrgent = daysLeft <= 2 && !a.submitted;
              const isOverdue = daysLeft < 0 && !a.submitted;
              return (
                <Pressable
                  key={a.id}
                  testID={`asg-${a.id}`}
                  accessibilityLabel={`${a.title} - ${a.submitted ? 'submitted' : `due in ${daysLeft} days`}`}
                  onPress={() => setSel(a)}
                  style={[styles.card, isUrgent && styles.cardUrgent]}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View
                        style={[
                          styles.statusIcon,
                          {
                            backgroundColor: a.submitted
                              ? '#DCFCE7'
                              : isOverdue
                                ? '#FEE2E2'
                                : isUrgent
                                  ? '#FEF3C7'
                                  : theme.colors.brandTertiary,
                          },
                        ]}
                      >
                        {a.submitted ? (
                          <CheckCircle2 size={16} color={theme.colors.success} />
                        ) : isOverdue ? (
                          <AlertTriangle size={16} color={theme.colors.error} />
                        ) : (
                          <Clock size={16} color={theme.colors.warning} />
                        )}
                      </View>
                      <View>
                        <Text style={styles.code}>{a.course_name}</Text>
                        <Text style={styles.cardTitle}>{a.title}</Text>
                      </View>
                    </View>
                    <ChevronRight color={theme.colors.muted} size={18} />
                  </View>
                  <View style={styles.cardMeta}>
                    <Text
                      style={[
                        styles.dueTxt,
                        { color: isOverdue ? theme.colors.error : isUrgent ? theme.colors.warning : theme.colors.muted },
                      ]}
                    >
                      {isOverdue
                        ? `Overdue by ${Math.abs(daysLeft)}d`
                        : isUrgent
                          ? `${daysLeft}d left`
                          : `Due ${new Date(a.due_date).toLocaleDateString()}`}
                    </Text>
                    {a.submitted && <Text style={styles.submittedTxt}>✓ Submitted</Text>}
                  </View>
                </Pressable>
              );
            })}
          </Animated.ScrollView>
        )}

        <Modal visible={!!sel} transparent animationType="slide" onRequestClose={() => setSel(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetCode}>{sel?.course_name}</Text>
                  <Text style={styles.sheetTitle}>{sel?.title}</Text>
                </View>
                <Pressable
                  testID="close-modal"
                  accessibilityLabel="Close"
                  onPress={() => setSel(null)}
                >
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <Text style={styles.sheetDesc}>{sel?.description}</Text>
              <View style={styles.sheetMeta}>
                <FileText size={14} color={theme.colors.muted} />
                <Text style={styles.sheetMetaTxt}>Max marks: {sel?.max_marks}</Text>
                <Clock size={14} color={theme.colors.muted} style={{ marginLeft: 12 }} />
                <Text style={styles.sheetMetaTxt}>
                  Due: {new Date(sel?.due_date || '').toLocaleDateString()}
                </Text>
              </View>

              {!sel?.submitted && (
                <>
                  <Text style={styles.label}>Your Submission</Text>
                  <TextInput
                    testID="submission-input"
                    accessibilityLabel="Assignment submission content"
                    value={text}
                    onChangeText={setText}
                    placeholder="Write or paste your work here..."
                    multiline
                    style={styles.input}
                    placeholderTextColor={theme.colors.muted}
                  />
                  <GradientButton
                    label="Submit Assignment"
                    onPress={submit}
                    loading={submitting}
                    disabled={!text.trim()}
                    icon={<Send color="#fff" size={16} />}
                    style={{ marginTop: theme.spacing.md }}
                  />
                </>
              )}
              {sel?.submitted && (
                <View style={styles.submittedBox}>
                  <CheckCircle2 color={theme.colors.success} size={24} />
                  <Text style={styles.submittedBoxTitle}>Submitted</Text>
                  <Text style={styles.submittedBoxTxt}>
                    Your work has been submitted successfully.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { padding: theme.spacing.xl, paddingTop: theme.spacing.md },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  card: {
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  cardUrgent: { borderColor: theme.colors.warning, borderWidth: 1.5 },
  statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  code: { fontSize: 10, color: theme.colors.brand, fontWeight: '700', textTransform: 'uppercase' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 2 },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  dueTxt: { fontSize: 12, fontWeight: '600' },
  submittedTxt: { color: theme.colors.success, fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    minHeight: 400,
    paddingBottom: 40,
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  sheetCode: { fontSize: 11, color: theme.colors.brand, fontWeight: '700', textTransform: 'uppercase' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface, marginTop: 2 },
  sheetDesc: { color: theme.colors.onSurfaceTertiary, fontSize: 14, lineHeight: 20, marginTop: 8 },
  sheetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  sheetMetaTxt: { fontSize: 12, color: theme.colors.muted },
  label: {
    color: theme.colors.onSurfaceTertiary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: theme.spacing.lg,
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    color: theme.colors.onSurface,
    fontSize: 14,
    lineHeight: 20,
  },
  submittedBox: { alignItems: 'center', paddingVertical: theme.spacing.xxl, gap: 8 },
  submittedBoxTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.success },
  submittedBoxTxt: { color: theme.colors.muted, fontSize: 13 },
});
