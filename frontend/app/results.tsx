import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import { ArrowLeft } from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import type { ExamResult } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { StatCard, EmptyState, Card, ChipBtn } from '@/src/ui';

export default function Results() {
  const { data: items, loading, refresh } = useFetch<ExamResult[]>('/results/me');
  const [selectedSem, setSelectedSem] = useState<string | null>(null);
  const itemsSafe = items || [];

  const semesters = useMemo(() => {
    const set = new Set(itemsSafe.map(r => r.semester).filter(Boolean));
    return Array.from(set).sort();
  }, [itemsSafe]);

  const filtered = useMemo(() => {
    if (!selectedSem) return itemsSafe;
    return itemsSafe.filter(r => r.semester === selectedSem);
  }, [itemsSafe, selectedSem]);

  const totalMarks = filtered.reduce((s, r) => s + r.max_marks, 0);
  const obtainedMarks = filtered.reduce((s, r) => s + r.marks, 0);
  const cgpa = filtered.length ? (filtered.reduce((s, r) => s + r.marks, 0) / filtered.length / 10).toFixed(2) : '\u2014';

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Results</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.statsRow}>
          <StatCard label="CGPA" value={cgpa} color={theme.colors.brandPrimary} />
          <StatCard label="Total" value={`${obtainedMarks}/${totalMarks}`} color={theme.colors.brandSecondary} />
          <StatCard label="Subjects" value={String(filtered.length)} color={theme.colors.info} />
        </View>

        {semesters.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <ChipBtn label="All" active={!selectedSem} onPress={() => setSelectedSem(null)} testID="sem-all" />
            {semesters.map(s => (
              <ChipBtn key={s} label={s} active={selectedSem === s} onPress={() => setSelectedSem(s)} testID={`sem-${s}`} />
            ))}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
          >
            {filtered.length === 0 && <EmptyState title="No results yet" sub="Exam results will appear here once published" />}
            {filtered.map((r, i) => (
              <Card key={r.id || i} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{r.course_code}</Text>
                    <Text style={styles.name}>{r.course_name}</Text>
                    <Text style={styles.semester}>{r.semester}</Text>
                  </View>
                  <View style={styles.gradeWrap}>
                    <Text style={styles.grade}>{r.grade}</Text>
                    <Text style={styles.marks}>{r.marks}/{r.max_marks}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  chipRow: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: 8 },
  code: { fontSize: 11, color: theme.colors.brand, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 2 },
  semester: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  gradeWrap: { alignItems: 'flex-end', backgroundColor: theme.colors.brandTertiary, padding: 12, borderRadius: theme.radius.md, minWidth: 60 },
  grade: { fontSize: 24, fontWeight: '800', color: theme.colors.brand },
  marks: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
});
