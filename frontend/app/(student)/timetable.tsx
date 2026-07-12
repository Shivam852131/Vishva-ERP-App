import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ActivityIndicator, Dimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { Calendar, Clock, MapPin, User } from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import type { TimetableSlot } from '@/src/types';
import { theme } from '@/src/theme';
import { ChipBtn, EmptyState } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const { width } = Dimensions.get('window');
const COLORS = ['#047857', '#059669', '#10B981', '#065F46', '#0F766E'];

export default function Timetable() {
  const { data: slots, loading, refresh } = useFetch<TimetableSlot[]>('/timetable');
  const [refreshing, setRefreshing] = useState(false);
  const [day, setDay] = useState(() => {
    const d = new Date().toLocaleDateString('en-US', { weekday: 'short' });
    const idx = DAYS.findIndex(dd => dd === d);
    return idx >= 0 ? DAYS[idx] : 'Mon';
  });

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

  const filtered = (slots || [])
    .filter(s => s.day === day)
    .sort((a, b) => a.start.localeCompare(b.start));

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={['#047857', '#059669']} style={styles.header}>
          <Text style={styles.title}>Weekly Timetable</Text>
          <Text style={styles.sub}>
            {filtered.length} {filtered.length === 1 ? 'class' : 'classes'} on {day}
          </Text>
        </LinearGradient>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.dayScroll}
          contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}
        >
          {DAYS.map(d => (
            <ChipBtn
              key={d}
              label={d}
              active={day === d}
              onPress={() => setDay(d)}
              testID={`day-${d}`}
            />
          ))}
        </ScrollView>

        {loading && !slots ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 10 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />
            }
          >
            {filtered.length === 0 && (
              <EmptyState title="No classes" sub={`No classes scheduled for ${day}`} icon="📅" />
            )}
            {filtered.map((c, i) => (
              <View
                key={c.id || i}
                testID={`slot-${c.id || i}`}
                accessibilityLabel={`${c.course_name} at ${c.start} in ${c.room}`}
                style={styles.classCard}
              >
                <View style={[styles.timeBadge, { backgroundColor: COLORS[i % COLORS.length] + '18' }]}>
                  <Text style={[styles.timeStart, { color: COLORS[i % COLORS.length] }]}>{c.start}</Text>
                  <Text style={[styles.timeEnd, { color: COLORS[i % COLORS.length] }]}>{c.end}</Text>
                </View>
                <View style={styles.classBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.codeDot, { backgroundColor: COLORS[i % COLORS.length] }]} />
                    <Text style={styles.code}>{c.course_code}</Text>
                  </View>
                  <Text style={styles.name}>{c.course_name}</Text>
                  <View style={styles.metaRow}>
                    <User size={12} color={theme.colors.muted} />
                    <Text style={styles.metaTxt}>{c.faculty_name}</Text>
                    <MapPin size={12} color={theme.colors.muted} style={{ marginLeft: 10 }} />
                    <Text style={styles.metaTxt}>{c.room}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { padding: theme.spacing.xl, paddingTop: theme.spacing.md },
  title: { color: '#fff', fontSize: 24, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 },
  dayScroll: {
    maxHeight: 56,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surface,
  },
  classCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadow.sm,
  },
  timeBadge: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
  },
  timeStart: { fontSize: 16, fontWeight: '800' },
  timeEnd: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  classBody: { flex: 1, paddingVertical: theme.spacing.md, paddingRight: theme.spacing.md },
  codeDot: { width: 8, height: 8, borderRadius: 4 },
  code: { fontSize: 10, fontWeight: '700', color: theme.colors.brand, textTransform: 'uppercase' },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  metaTxt: { fontSize: 11, color: theme.colors.muted },
});
