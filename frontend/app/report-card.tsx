import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import {
  Sparkles, BarChart3, TrendingUp, TrendingDown, Award,
  BookOpen, Target, ChevronRight, AlertTriangle,
} from 'lucide-react-native';

export default function ReportCardAnalysis() {
  const { data: results, loading } = useFetch<any[]>('/results/me');
  const { data: insights } = useFetch<any[]>('/ai/insights');
  const [selectedSem, setSelectedSem] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const semesters = useMemo(() => {
    if (!results) return [];
    const grouped: Record<string, any[]> = {};
    results.forEach((r: any) => {
      const sem = r.semester || 'Unknown';
      if (!grouped[sem]) grouped[sem] = [];
      grouped[sem].push(r);
    });
    return Object.entries(grouped).map(([name, subjects]) => {
      const avgMarks = subjects.length
        ? Math.round(subjects.reduce((sum: number, subject: any) => sum + Number(subject.marks || 0), 0) / subjects.length)
        : 0;
      const avgAttendance = subjects.length
        ? Math.round(subjects.reduce((sum: number, subject: any) => sum + Number(subject.attendance || 0), 0) / subjects.length)
        : 0;
      return {
        name,
        subjects,
        gpa: subjects.find((subject: any) => subject.gpa)?.gpa || (avgMarks ? (avgMarks / 10).toFixed(1) : '—'),
        attendance: avgAttendance || '—',
      };
    });
  }, [results]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  if (loading) {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: theme.colors.muted }}>Loading results...</Text>
        </View>
      </ErrorBoundary>
    );
  }

  if (!results || semesters.length === 0) {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
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
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>No results published yet</Text>
              <Text style={{ fontSize: 13, color: theme.colors.muted, marginTop: 8, textAlign: 'center' }}>Your results will appear here once published by your institution.</Text>
            </View>
          </SafeAreaView>
        </View>
      </ErrorBoundary>
    );
  }

  const current = semesters[selectedSem];
  const avgMarks = Math.round(current.subjects.reduce((s: number, sub: any) => s + (sub.marks || 0), 0) / current.subjects.length);
  const bestSubject = current.subjects.reduce((a: any, b: any) => (a.marks || 0) > (b.marks || 0) ? a : b);
  const worstSubject = current.subjects.reduce((a: any, b: any) => (a.marks || 0) < (b.marks || 0) ? a : b);

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
            {semesters.map((s, i) => (
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
                <Text style={styles.statValue}>{current.gpa || '—'}</Text>
                <Text style={styles.statLabel}>CGPA</Text>
              </Card>
              <Card style={styles.statCard}>
                <BarChart3 size={20} color="#10B981" />
                <Text style={styles.statValue}>{avgMarks}%</Text>
                <Text style={styles.statLabel}>Avg Marks</Text>
              </Card>
              <Card style={styles.statCard}>
                <Target size={20} color="#F59E0B" />
                <Text style={styles.statValue}>{current.attendance || '—'}%</Text>
                <Text style={styles.statLabel}>Attendance</Text>
              </Card>
            </View>

            <SectionTitle>Subject Performance</SectionTitle>
            {current.subjects.map((sub: any, i: number) => (
              <Card key={i} style={{ padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>{sub.name || sub.subject}</Text>
                  <View style={styles.gradeBadge}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{sub.grade || '—'}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>{sub.marks || 0}/{sub.max || 100}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>{sub.marks || 0}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {
                    width: `${sub.marks || 0}%`,
                    backgroundColor: (sub.marks || 0) >= 90 ? '#10B981' : (sub.marks || 0) >= 75 ? '#4F46E5' : (sub.marks || 0) >= 60 ? '#F59E0B' : '#EF4444',
                  }]} />
                </View>
              </Card>
            ))}

            <SectionTitle>Semester Trend</SectionTitle>
            <Card style={{ padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {semesters.map((s, i) => (
                  <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 10, color: theme.colors.muted }}>{s.name.replace('Semester ', 'Sem ')}</Text>
                    <View style={[styles.trendBar, { height: (s.gpa || 0) * 10 }]}>
                      <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={StyleSheet.absoluteFill} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>{s.gpa || '—'}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <SectionTitle>AI Insights</SectionTitle>
            {insights && insights.length > 0 ? insights.map((ins: any, i: number) => (
              <Card key={i} style={{ padding: 14, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  {ins.type === 'strength' ? <TrendingUp size={16} color="#10B981" /> :
                   ins.type === 'improvement' ? <AlertTriangle size={16} color="#F59E0B" /> :
                   ins.type === 'warning' ? <TrendingDown size={16} color="#EF4444" /> :
                   <TrendingUp size={16} color="#3B82F6" />}
                  <Text style={{ fontSize: 13, color: theme.colors.text, flex: 1, lineHeight: 18 }}>{ins.text}</Text>
                </View>
              </Card>
            )) : (
              <Card style={{ padding: 16, gap: 8 }}>
                <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>No insights available</Text>
              </Card>
            )}

            <Card style={{ padding: 16, gap: 8, backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brand + '30' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <BookOpen size={16} color={theme.colors.brand} />
                <Text style={{ fontWeight: '700', color: theme.colors.brand }}>Top Performer</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.colors.text }}>
                {bestSubject.name || bestSubject.subject} — {bestSubject.marks || 0} marks ({bestSubject.grade || '—'}). Your consistent excellence here suggests strong aptitude.
              </Text>
            </Card>

            <Card style={{ padding: 16, gap: 8, backgroundColor: '#FEF3C7', borderColor: '#F59E0B30' }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AlertTriangle size={16} color="#F59E0B" />
                <Text style={{ fontWeight: '700', color: '#B45309' }}>Needs Focus</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.colors.text }}>
                {worstSubject.name || worstSubject.subject} — {worstSubject.marks || 0} marks ({worstSubject.grade || '—'}). Consider allocating extra study time here.
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
