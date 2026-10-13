import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, TextInput, Dimensions } from 'react-native';
import { TrendingUp, TrendingDown, Target, Award, AlertTriangle, Calculator, BookOpen } from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { theme } from '@/src/theme';
import { Card, StatCard, SectionTitle, EmptyState, ProgressBar } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

interface Result {
  id: string;
  course_name: string;
  course_code: string;
  marks: number;
  max_marks: number;
  grade: string;
  semester: number;
}

interface SemesterData {
  semester: number;
  gpa: number;
  subjects: Result[];
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#10B981', 'A': '#10B981', 'A-': '#34D399',
  'B+': '#3B82F6', 'B': '#3B82F6', 'B-': '#60A5FA',
  'C+': '#F59E0B', 'C': '#F59E0B', 'C-': '#FBBF24',
  'D': '#EF4444', 'F': '#EF4444',
};

function gradeToGPA(grade: string): number {
  const map: Record<string, number> = {
    'A+': 10, 'A': 10, 'A-': 9, 'B+': 8, 'B': 8, 'B-': 7,
    'C+': 6, 'C': 6, 'C-': 5, 'D': 4, 'F': 0,
  };
  return map[grade] ?? 0;
}

function gradeColor(pct: number): string {
  if (pct >= 80) return '#10B981';
  if (pct >= 60) return '#3B82F6';
  if (pct >= 40) return '#F59E0B';
  return '#EF4444';
}

function ProgressRingGrade({ cgpa, size = 140 }: { cgpa: number; size?: number }) {
  const strokeWidth = 12;
  const fill = Math.max(0, Math.min(100, (cgpa / 10) * 100));
  const bgColor = gradeColor(fill);
  const circumference = ((size - strokeWidth) / 2) * 2 * Math.PI;
  const offset = circumference - (fill / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', width: size }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[prStyles.bgRing, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary }]} />
        <View style={[prStyles.fillRing, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: bgColor, borderLeftColor: 'transparent', borderBottomColor: 'transparent', borderTopColor: 'transparent', transform: [{ rotate: `${(fill / 100) * 360}deg` }] }]} />
        <View style={prStyles.center}>
          <Text style={[prStyles.value, { color: bgColor }]}>{cgpa.toFixed(1)}</Text>
          <Text style={prStyles.label}>CGPA</Text>
        </View>
      </View>
    </View>
  );
}

const prStyles = StyleSheet.create({
  bgRing: { position: 'absolute' },
  fillRing: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 32, fontWeight: '800' },
  label: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
});

function SubjectBar({ name, marks, maxMarks }: { name: string; marks: number; maxMarks: number }) {
  const pct = maxMarks > 0 ? (marks / maxMarks) * 100 : 0;
  const color = gradeColor(pct);
  return (
    <View style={sbStyles.row}>
      <Text style={sbStyles.name} numberOfLines={1}>{name}</Text>
      <View style={sbStyles.barBg}>
        <View style={[sbStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[sbStyles.marks, { color }]}>{marks}/{maxMarks}</Text>
    </View>
  );
}

const sbStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { width: 90, fontSize: 11, color: theme.colors.onSurface, fontWeight: '600' },
  barBg: { flex: 1, height: 10, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },
  marks: { width: 55, fontSize: 11, fontWeight: '700', textAlign: 'right' },
});

function GradeDistribution({ results }: { results: Result[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    results.forEach((r) => {
      const g = r.grade?.toUpperCase() || '';
      if (g.startsWith('A')) c['A']++;
      else if (g.startsWith('B')) c['B']++;
      else if (g.startsWith('C')) c['C']++;
      else if (g === 'D') c['D']++;
      else if (g === 'F') c['F']++;
    });
    return c;
  }, [results]);

  const entries = [
    { grade: 'A', count: counts['A'], color: '#10B981' },
    { grade: 'B', count: counts['B'], color: '#3B82F6' },
    { grade: 'C', count: counts['C'], color: '#F59E0B' },
    { grade: 'D', count: counts['D'], color: '#F97316' },
    { grade: 'F', count: counts['F'], color: '#EF4444' },
  ];

  const maxC = Math.max(...entries.map((e) => e.count), 1);

  return (
    <Card style={{ marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md }}>
      <Text style={distStyles.title}>Grade Distribution</Text>
      <View style={distStyles.barRow}>
        {entries.map((e, i) => (
          <View key={i} style={distStyles.col}>
            <Text style={[distStyles.count, { color: e.color }]}>{e.count}</Text>
            <View style={[distStyles.bar, { height: Math.max(4, (e.count / maxC) * 80), backgroundColor: e.color }]} />
            <Text style={distStyles.grade}>{e.grade}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const distStyles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 12 },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  count: { fontSize: 11, fontWeight: '700' },
  bar: { width: '100%', borderRadius: 4 },
  grade: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface },
});

function TrendChart({ semesters }: { semesters: { semester: number; gpa: number }[] }) {
  const maxGPA = Math.max(...semesters.map((s) => s.gpa), 10);
  return (
    <Card style={{ marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 12 }}>Semester Trend</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 }}>
        {semesters.map((s, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.brandPrimary }}>{s.gpa.toFixed(1)}</Text>
            <View style={{ width: '100%', height: Math.max(4, (s.gpa / maxGPA) * 70), backgroundColor: theme.colors.brandPrimary, borderRadius: 4 }} />
            <Text style={{ fontSize: 10, fontWeight: '600', color: theme.colors.muted }}>S{s.semester}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function TipsSection({ cgpa, worst, best }: { cgpa: number; worst?: string; best?: string }) {
  const tips: string[] = [];
  if (cgpa < 6) tips.push('Focus on strengthening your core fundamentals with daily revision.');
  if (cgpa < 8) tips.push('Aim for consistent study of at least 2-3 hours per subject daily.');
  if (worst) tips.push(`Pay extra attention to ${worst} — consider forming a study group.`);
  if (best) tips.push(`Great performance in ${best}! Keep up the momentum.`);
  tips.push('Practice previous year question papers for better exam preparation.');
  tips.push('Visit faculty during office hours for concept clarity.');

  return (
    <Card style={{ marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, marginBottom: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
          <Award size={16} color="#F59E0B" />
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.onSurface }}>Improvement Tips</Text>
      </View>
      {tips.map((tip, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Text style={{ color: theme.colors.brand, fontSize: 12, marginTop: 1 }}>{'\u2022'}</Text>
          <Text style={{ flex: 1, fontSize: 12, color: theme.colors.onSurface, lineHeight: 18 }}>{tip}</Text>
        </View>
      ))}
    </Card>
  );
}

export default function GradeAnalyzer() {
  const { user } = useAuth();
  const { data: results, loading, error, refresh } = useFetch<Result[]>('/results/me');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const { cgpa, semesters, bestSubject, worstSubject } = useMemo(() => {
    if (!results || results.length === 0) return { cgpa: 0, semesters: [], bestSubject: '', worstSubject: '' };
    const total = results.reduce((sum, r) => sum + gradeToGPA(r.grade), 0);
    const cgpaVal = total / results.length;

    const semMap: Record<number, Result[]> = {};
    results.forEach((r) => {
      if (!semMap[r.semester]) semMap[r.semester] = [];
      semMap[r.semester].push(r);
    });
    const sems = Object.entries(semMap).map(([s, rrs]) => ({
      semester: Number(s),
      gpa: rrs.reduce((sum, r) => sum + gradeToGPA(r.grade), 0) / rrs.length,
      subjects: rrs,
    })).sort((a, b) => a.semester - b.semester);

    let best = results[0];
    let worst = results[0];
    results.forEach((r) => {
      if (gradeToGPA(r.grade) > gradeToGPA(best.grade)) best = r;
      if (gradeToGPA(r.grade) < gradeToGPA(worst.grade)) worst = r;
    });

    return { cgpa: cgpaVal, semesters: sems, bestSubject: best.course_name, worstSubject: worst.course_name };
  }, [results]);

  return (
    <ErrorBoundary>
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        showsVerticalScrollIndicator={false}
      >
        {loading && !results ? (
          <View style={styles.centered}>
            <Text style={{ color: theme.colors.muted }}>Loading grades...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <AlertTriangle size={32} color={theme.colors.error} />
            <Text style={{ color: theme.colors.error, marginTop: 8 }}>{error}</Text>
            <Pressable onPress={refresh} style={styles.retryBtn} testID="retry-grades" accessibilityLabel="Retry loading grades">
              <Text style={{ color: theme.colors.brandPrimary, fontWeight: '700', marginTop: 8 }}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : !results || results.length === 0 ? (
          <EmptyState icon={<BookOpen size={48} color={theme.colors.muted} />} title="No Grades Found" sub="Your academic results will appear here once available." />
        ) : (
          <>
            {/* CGPA Ring */}
            <View style={{ alignItems: 'center', paddingTop: theme.spacing.xl }}>
              <ProgressRingGrade cgpa={cgpa} />
              <Text style={styles.overallLabel}>Overall Performance</Text>
            </View>

            {/* Stats */}
            <View style={styles.statRow}>
              <StatCard label="Best Subject" value={bestSubject} icon={<Award size={16} color="#10B981" />} color="#10B981" testID="best-subject" />
              <StatCard label="Needs Work" value={worstSubject} icon={<AlertTriangle size={16} color="#F59E0B" />} color="#F59E0B" testID="worst-subject" />
            </View>

            {/* Semester Breakdown */}
            <SectionTitle title="Semester Breakdown" />
            {semesters.map((sem) => (
              <Card key={sem.semester} style={{ marginHorizontal: theme.spacing.lg, marginBottom: 8 }}>
                <View style={styles.semHeader}>
                  <Text style={styles.semTitle}>Semester {sem.semester}</Text>
                  <Text style={[styles.semGpa, { color: gradeColor((sem.gpa / 10) * 100) }]}>GPA: {sem.gpa.toFixed(1)}</Text>
                </View>
                {sem.subjects.map((r) => (
                  <SubjectBar key={r.id} name={r.course_code || r.course_name} marks={r.marks} maxMarks={r.max_marks} />
                ))}
              </Card>
            ))}

            {/* Charts */}
            <GradeDistribution results={results} />
            <TrendChart semesters={semesters} />

            {/* Tips */}
            <TipsSection cgpa={cgpa} worst={worstSubject} best={bestSubject} />
          </>
        )}
      </ScrollView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  overallLabel: { fontSize: 13, color: theme.colors.muted, fontWeight: '600', marginTop: 8 },
  statRow: { flexDirection: 'row', gap: 12, paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg },
  semHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  semTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  semGpa: { fontSize: 14, fontWeight: '800' },
});
