import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Calendar, FileText, Award } from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Assignment, Course } from '@/src/types';
import { theme } from '@/src/theme';
import {
  Card,
  SectionTitle,
  EmptyState,
  ChipBtn,
  GradientButton,
} from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function FacultyAssignments() {
  const { data: items, loading, refresh } = useFetch<Assignment[]>('/assignments');
  const { data: courses } = useFetch<Course[]>('/courses');
  const { mutate: createAssign, loading: creating } = useMutate();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({
    course_id: '',
    title: '',
    description: '',
    due_date: new Date(Date.now() + 7 * 864e5)
      .toISOString()
      .slice(0, 10),
    max_marks: '100',
  });

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading, refreshing]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

  const create = async () => {
    if (!form.course_id || !form.title) return;
    try {
      await createAssign('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          max_marks: parseInt(form.max_marks) || 100,
        }),
      });
      setOpen(false);
      setForm({
        course_id: '',
        title: '',
        description: '',
        due_date: new Date(Date.now() + 7 * 864e5)
          .toISOString()
          .slice(0, 10),
        max_marks: '100',
      });
      refresh();
    } catch {}
  };

  const isFormValid = form.course_id && form.title.trim().length > 0;

  return (
    <ErrorBoundary>
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Assignments</Text>
            <Text style={styles.subtitle}>Manage your tasks</Text>
          </View>
          <Pressable
            testID="add-asg"
            accessibilityLabel="Add assignment"
            onPress={() => setOpen(true)}
            style={styles.addBtn}
          >
            <Plus color="#fff" size={20} />
          </Pressable>
        </View>

        {loading && !items ? (
          <ActivityIndicator
            style={{ marginTop: 40 }}
            color={theme.colors.brandPrimary}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.brandPrimary}
              />
            }
          >
            {(!items || items.length === 0) && (
              <EmptyState
                title="No assignments yet"
                sub="Tap + to create your first assignment."
                icon="📝"
              />
            )}
            {(items || []).map((a) => (
              <Card key={a.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.cardBadge,
                      {
                        backgroundColor:
                          new Date(a.due_date) < new Date()
                            ? '#FEE2E2'
                            : theme.colors.brandTertiary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cardBadgeText,
                        {
                          color:
                            new Date(a.due_date) < new Date()
                              ? theme.colors.error
                              : theme.colors.brand,
                        },
                      ]}
                    >
                      {new Date(a.due_date) < new Date()
                        ? 'Overdue'
                        : 'Active'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.cardCourse}>{a.course_name}</Text>
                <Text style={styles.cardTitle}>{a.title}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {a.description}
                </Text>
                <View style={styles.cardFooter}>
                  <View style={styles.cardMetaItem}>
                    <Calendar size={12} color={theme.colors.muted} />
                    <Text style={styles.cardMeta}>
                      Due: {new Date(a.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.cardMetaItem}>
                    <Award size={12} color={theme.colors.muted} />
                    <Text style={styles.cardMeta}>
                      {a.max_marks} marks
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}

        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>New Assignment</Text>
                <Pressable
                  testID="close-form"
                  accessibilityLabel="Close form"
                  onPress={() => setOpen(false)}
                >
                  <X color={theme.colors.onSurface} size={22} />
                </Pressable>
              </View>

              <Text style={styles.label}>Course</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {(courses || []).map((c) => (
                  <ChipBtn
                    key={c.id}
                    testID={`course-${c.id}`}
                    label={c.code}
                    active={form.course_id === c.id}
                    onPress={() =>
                      setForm((f) => ({ ...f, course_id: c.id }))
                    }
                  />
                ))}
              </ScrollView>

              <Text style={styles.label}>Title</Text>
              <TextInput
                testID="asg-title"
                accessibilityLabel="Assignment title"
                value={form.title}
                onChangeText={(t) =>
                  setForm((f) => ({ ...f, title: t }))
                }
                placeholder="e.g. Chapter 5 exercises"
                style={styles.input}
                placeholderTextColor={theme.colors.muted}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                testID="asg-desc"
                accessibilityLabel="Assignment description"
                value={form.description}
                onChangeText={(t) =>
                  setForm((f) => ({ ...f, description: t }))
                }
                placeholder="Instructions..."
                multiline
                style={[styles.input, styles.textArea]}
                placeholderTextColor={theme.colors.muted}
              />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Due Date</Text>
                  <TextInput
                    testID="asg-due"
                    accessibilityLabel="Due date"
                    value={form.due_date}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, due_date: t }))
                    }
                    placeholder="YYYY-MM-DD"
                    style={styles.input}
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Max Marks</Text>
                  <TextInput
                    testID="asg-marks"
                    accessibilityLabel="Maximum marks"
                    value={form.max_marks}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, max_marks: t }))
                    }
                    placeholder="100"
                    keyboardType="numeric"
                    style={styles.input}
                    placeholderTextColor={theme.colors.muted}
                  />
                </View>
              </View>

              <View style={{ marginTop: theme.spacing.xl }}>
                <GradientButton
                  testID="asg-create"
                  accessibilityLabel="Publish assignment"
                  label={creating ? 'Publishing...' : 'Publish'}
                  onPress={create}
                  loading={creating}
                  disabled={!isFormValid || creating}
                  icon={<FileText size={18} color="#fff" />}
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  subtitle: { color: theme.colors.muted, marginTop: 3 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: 10,
    paddingBottom: 100,
  },
  card: {
    padding: theme.spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  cardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardCourse: {
    fontSize: 11,
    color: theme.colors.brand,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.onSurface,
    marginTop: 4,
  },
  cardDesc: {
    color: theme.colors.onSurfaceTertiary,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMeta: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  label: {
    color: theme.colors.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: theme.spacing.md,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipRow: { gap: 8, paddingRight: 8 },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    color: theme.colors.onSurface,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
