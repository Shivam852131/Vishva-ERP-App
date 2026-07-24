import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Sparkles, BarChart3, TrendingUp, TrendingDown, Award,
  BookOpen, Target, ChevronRight, AlertTriangle,
} from 'lucide-react-native';

const SEMESTERS = [
  {
    name: 'Semester 1',
    gpa: 7.8,
    subjects: [
      { name: 'Mathematics', grade: 'B+', marks: 78, max: 100 },
      { name: 'Physics', grade: 'A', marks: 85, max: 100 },
      { name: 'Chemistry', grade: 'B', marks: 72, max: 100 },
      { name: 'Computer Science', grade: 'A+', marks: 95, max: 100 },
      { name: 'English', grade: 'B', marks: 70, max: 100 },
    ],
    attendance: 88,
  },
  {
    name: 'Semester 2',
    gpa: 8.2,
    subjects: [
      { name: 'Mathematics', grade: 'A', marks: 82, max: 100 },
      { name: 'Physics', grade: 'A', marks: 88, max: 100 },
      { name: 'Chemistry', grade: 'B+', marks: 78, max: 100 },
      { name: 'Computer Science', grade: 'A+', marks: 96, max: 100 },
      { name: 'English', grade: 'B+', marks: 76, max: 100 },
    ],
    attendance: 91,
  },
  {
    name: 'Semester 3',
    gpa: 8.4,
    subjects: [
      { name: 'Mathematics', grade: 'A', marks: 84, max: 100 },
      { name: 'Physics', grade: 'A+', marks: 92, max: 100 },
      { name: 'Chemistry', grade: 'A', marks: 80, max: 100 },
      { name: 'Computer Science', grade: 'A+', marks: 97, max: 100 },
      { name: 'English', grade: 'B+', marks: 75, max: 100 },
    ],
    attendance: 87,
  },
];

const AI_INSIGHTS = [
  { type: 'strength', text: 'Computer Science is your strongest subject with consistent A+ grades across all semesters.' },
  { type: 'improvement', text: 'English performance has been stagnant. Consider focusing on writing practice and reading comprehension.' },
  { type: 'trend', text: 'Overall GPA trend is positive (7.8 → 8.2 → 8.4). Keep up the momentum!' },
  { type: 'warning', text: 'Mathematics improvement has plateaued. A focused 2-week review on calculus could boost your next exam score.' },
  { type: 'strength', text: 'Physics practical scores are excellent — your lab skills are outstanding.' },
];

export default function ReportCardAnalysis() {
  const [selectedSem, setSelectedSem] = useState(2);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const current = SEMESTERS[selectedSem];
  const avgMarks = Math.round(current.subjects.reduce((s, sub) => s + sub.marks, 0) / current.subjects.length);
  const bestSubject = current.subjects.reduce((a, b) => a.marks > b.marks ? a : b);
  const worstSubject = current.subjects.reduce((a, b) => a.marks < b.marks ? a : b);

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><Sparkles size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>AI Report Card Analysis</Text>
                  <Text style={styles.heroSub}>Deep insights into academic performance</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.semTabs}>
            {SEMESTERS.map((s, i) => (
              <Pressable key={i} onPress={() => setSelectedSem(i)}
                style={[styles.semTab, selectedSem === i && styles.semTabActive]}>
                <Text style={[styles.semTabText, selectedSem === i && { color: '#fff' }]}>{s.name}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Award size={20} color={theme.colors.brand} />
                <Text style={styles.statValue}>{current.gpa}</Text>
                <Text style={styles.statLabel}>CGPA</Text>
              </Card>
              <Card style={styles.statCard}>
                <BarChart3 size={20} color="#10B981" />
                <Text style={styles.statValue}>{avgMarks}%</Text>
                <Text style={styles.statLabel}>Avg Marks</Text>
              </Card>
              <Card style={styles.statCard}>
                <Target size={20} color="#F59E0B" />
                <Text style={styles.statValue}>{current.attendance}%</Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </Card>
            </View>

            <SectionTitle>Subject Performance</SectionTitle>
            {current.subjects.map((sub, i) => (
              <Card key={i} style={{ padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>{sub.name}</Text>
                  <View style={styles.gradeBadge}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{sub.grade}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>{sub.marks}/{sub.max}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>{sub.marks}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: `${sub.marks}%`,
                    backgroundColor: sub.marks >= 90 ? '#10B981' : sub.marks >= 75 ? '#4F46E5' : sub.marks >= 60 ? '#F59E0B' : '#EF4444',
                  }]} />
                </View>
              </Card>
            ))}

            <SectionTitle>Semester Trend</SectionTitle>
            <Card style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {SEMESTERS.map((s, i) => (
                  <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 10, color: theme.colors.muted }}>{s.name.replace('Semester ', 'Sem ')}</Text>
                    <View style={[styles.trendBar, { height: s.gpa * 10 }]}>
                      <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={StyleSheet.absoluteFill} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>{s.gpa}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <SectionTitle>AI Insights</SectionTitle>
            {AI_INSIGHTS.map((ins, i) => (
              <Card key={i} style={{ padding: 14, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  {ins.type === 'strength' ? <TrendingUp size={16} color="#10B981" /> :
                   ins.type === 'improvement' ? <AlertTriangle size={16} color="#F59E0B" /> :
                   ins.type === 'warning' ? <TrendingDown size={16} color="#EF4444" /> :
                   <TrendingUp size={16} color="#3B82F6" />}
                  <Text style={{ fontSize: 13, color: theme.colors.text, flex: 1, lineHeight: 18 }}>{ins.text}</Text>
                </View>
              </Card>
            ))}

            <Card style={{ padding: 16, gap: 8, backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brand + '30' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <BookOpen size={16} color={theme.colors.brand} />
                <Text style={{ fontWeight: '700', color: theme.colors.brand }}>Top Performer</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.colors.text }}>
                {bestSubject.name} — {bestSubject.marks} marks ({bestSubject.grade}). Your consistent excellence here suggests strong aptitude.
              </Text>
            </Card>

            <Card style={{ padding: 16, gap: 8, backgroundColor: '#FEF3C7', borderColor: '#F59E0B30' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AlertTriangle size={16} color="#F59E0B" />
                <Text style={{ fontWeight: '700', color: '#B45309' }}>Needs Focus</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.colors.text }}>
                {worstSubject.name} — {worstSubject.marks} marks ({worstSubject.grade}). Consider allocating extra study time here.
              </Text>
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  semTabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  semTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  semTabActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  semTabText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  statLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  gradeBadge: { backgroundColor: theme.colors.brand, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  trendBar: { width: 36, borderRadius: 6, overflow: 'hidden' },
});
