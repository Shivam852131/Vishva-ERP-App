import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  BellRing,
  Clock,
  AlertTriangle,
  CreditCard,
  BookOpen,
  Target,
  ChevronRight,
  Sparkles,
  CalendarDays,
  GraduationCap,
} from 'lucide-react-native';
import type { AiReminder } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, EmptyState } from '@/src/ui';

const TYPE_META: Record<
  string,
  { icon: any; color: string; label: string; bg: string }
> = {
  class: {
    icon: Clock,
    color: theme.colors.info,
    label: 'Class',
    bg: '#DBEAFE',
  },
  assignment: {
    icon: BookOpen,
    color: theme.colors.warning,
    label: 'Assignment',
    bg: '#FEF3C7',
  },
  fee: {
    icon: CreditCard,
    color: theme.colors.error,
    label: 'Fee',
    bg: '#FEE2E2',
  },
  attendance: {
    icon: AlertTriangle,
    color: theme.colors.error,
    label: 'Attendance',
    bg: '#FEE2E2',
  },
  study: {
    icon: Target,
    color: theme.colors.brandSecondary,
    label: 'Study',
    bg: '#D1FAE5',
  },
  exam: {
    icon: GraduationCap,
    color: '#8B5CF6',
    label: 'Exam',
    bg: '#EDE9FE',
  },
  event: {
    icon: CalendarDays,
    color: theme.colors.brand,
    label: 'Event',
    bg: '#D1FAE5',
  },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  0: { label: 'Urgent', color: '#DC2626', bg: '#FEE2E2' },
  1: { label: 'Soon', color: '#D97706', bg: '#FEF3C7' },
  2: { label: 'Upcoming', color: '#059669', bg: '#D1FAE5' },
  3: { label: 'Info', color: '#6B7280', bg: '#F3F4F6' },
};

export default function RemindersTab() {
  const [refreshing, setRefreshing] = useState(false);
  const {
    data: reminders = [],
    loading,
    refresh: loadReminders,
  } = useFetch<AiReminder[]>('/reminders');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReminders();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadReminders]);

  if (loading && reminders.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.brandPrimary} size="large" />
        <Text style={styles.loadingTxt}>Loading reminders...</Text>
      </View>
    );
  }

  const grouped = reminders.reduce<Record<string, AiReminder[]>>((acc, r) => {
    const key = r.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const sortedTypes = Object.keys(grouped).sort((a, b) => {
    const order = ['attendance', 'fee', 'assignment', 'exam', 'class', 'study', 'event'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <ErrorBoundary>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brandPrimary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {reminders.length === 0 && !loading ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
              <Sparkles color={theme.colors.brandSecondary} size={32} />
            </View>
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptySub}>
              No reminders right now. Enjoy your day!
            </Text>
          </View>
        ) : (
          sortedTypes.map((type) => {
            const meta = TYPE_META[type] || {
              icon: BellRing,
              color: theme.colors.muted,
              label: type,
              bg: '#F3F4F6',
            };
            const Icon = meta.icon;
            const items = grouped[type];

            return (
              <View key={type} style={styles.groupSection}>
                <View style={styles.groupHeader}>
                  <View style={[styles.groupIconWrap, { backgroundColor: meta.bg }]}>
                    <Icon size={14} color={meta.color} />
                  </View>
                  <Text style={styles.groupTitle}>{meta.label}</Text>
                  <View style={styles.groupCount}>
                    <Text style={styles.groupCountTxt}>{items.length}</Text>
                  </View>
                </View>

                {items.map((r, i) => {
                  const pri = PRIORITY_CONFIG[r.priority] || PRIORITY_CONFIG[3];
                  return (
                    <Card key={r.id || i} style={styles.reminderCard}>
                      <View style={styles.reminderRow}>
                        <View style={[styles.reminderIconWrap, { backgroundColor: meta.bg }]}>
                          <Icon color={meta.color} size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.reminderTags}>
                            <View
                              style={[
                                styles.priorityPill,
                                { backgroundColor: pri.bg },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.priorityTxt,
                                  { color: pri.color },
                                ]}
                              >
                                {pri.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.reminderTitle}>{r.title}</Text>
                          {r.body && (
                            <Text style={styles.reminderBody} numberOfLines={2}>
                              {r.body}
                            </Text>
                          )}
                        </View>
                        <ChevronRight color={theme.colors.muted} size={16} />
                      </View>
                    </Card>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
    gap: 8,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingTxt: { color: theme.colors.muted, fontSize: 13 },
  emptyWrap: {
    alignItems: 'center',
    padding: theme.spacing.xxxl,
    gap: 8,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  emptySub: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  groupSection: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.onSurface,
    flex: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupCount: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCountTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  reminderCard: {
    marginBottom: 6,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderTags: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 2,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityTxt: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reminderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginTop: 2,
  },
  reminderBody: {
    fontSize: 12,
    color: theme.colors.onSurfaceTertiary,
    marginTop: 2,
    lineHeight: 17,
  },
});
