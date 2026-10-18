import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import { printAsync } from '@/src/native/print';
import {
  Sparkles, BarChart3, TrendingUp, TrendingDown, Award,
  BookOpen, Target, ChevronRight, AlertTriangle, ArrowLeft, Download, Printer, FileText,
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
                <View style={styles.heroHeaderRow}>
                  <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
                    <ArrowLeft size={20} color="#fff" />
                  </Pressable>
                  <View style={styles.heroIcon}><Sparkles size={22} color="#fff" /></View>
                  <View style={styles.heroTitles}>
                    <Text style={styles.heroTitle} numberOfLines={1}>AI Report Card Analysis</Text>
                    <Text style={styles.heroSub} numberOfLines={1}>Deep insights into academic performance</Text>
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

  const downloadOfficialTranscript = async () => {
    try {
      const data = await api('/reports/transcript');
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #1E293B; background: #FFF; }
            .header { text-align: center; border-bottom: 3px solid #4F46E5; padding-bottom: 14px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: 800; color: #4F46E5; text-transform: uppercase; letter-spacing: 0.5px; }
            .subtitle { font-size: 13px; color: #64748B; margin-top: 4px; font-weight: 600; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #F8FAFC; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; border: 1px solid #E2E8F0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
            th, td { border: 1px solid #CBD5E1; padding: 10px 12px; text-align: left; }
            th { background: #4F46E5; color: white; font-weight: 700; text-transform: uppercase; font-size: 11px; }
            .summary { background: #EEF2FF; padding: 16px; border-radius: 8px; font-size: 14px; border: 1px solid #C7D2FE; margin-bottom: 20px; }
            .summary-item { margin-bottom: 6px; }
            .footer { margin-top: 40px; text-align: right; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${data.institution || 'Vishva ERP Institution'}</div>
            <div class="subtitle">Official Academic Transcript & Marksheet</div>
          </div>
          <div class="info-grid">
            <div><strong>Student Name:</strong> ${data.student.name}</div>
            <div><strong>Roll Number:</strong> ${data.student.rollNumber}</div>
            <div><strong>Department:</strong> ${data.student.department}</div>
            <div><strong>Semester:</strong> ${data.student.semester}</div>
            <div><strong>Academic Year:</strong> ${data.student.academicYear}</div>
            <div><strong>Issue Date:</strong> ${data.summary.issueDate}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Credits</th>
                <th>Max Marks</th>
                <th>Obtained</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${data.results.map((r: any) => `
                <tr>
                  <td>${r.sno}</td>
                  <td>${r.subjectCode}</td>
                  <td>${r.subjectName}</td>
                  <td>${r.credits}</td>
                  <td>${r.maxMarks}</td>
                  <td>${r.marksObtained}</td>
                  <td><strong>${r.grade}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-item"><strong>Overall Percentage:</strong> ${data.summary.percentage}</div>
            <div class="summary-item"><strong>Cumulative GPA (CGPA):</strong> ${data.summary.cgpa}</div>
            <div class="summary-item"><strong>Academic Standing:</strong> ${data.summary.status}</div>
          </div>
          <div class="footer">
            <p>Verified by Vishva ERP Automated Registrar Service • Document Reference ID: VERP-${Date.now()}</p>
          </div>
        </body>
        </html>
      `;
      await printAsync({ html });
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Failed to generate official transcript PDF.');
    }
  };

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <View style={styles.heroHeaderRow}>
                <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
                  <ArrowLeft size={20} color="#fff" />
                </Pressable>
                <View style={styles.heroIcon}><Sparkles size={22} color="#fff" /></View>
                <View style={styles.heroTitles}>
                  <Text style={styles.heroTitle} numberOfLines={1}>AI Report Card Analysis</Text>
                  <Text style={styles.heroSub} numberOfLines={1}>Deep insights into academic performance</Text>
                </View>
                <Pressable onPress={downloadOfficialTranscript} style={styles.exportBtn}>
                  <Download size={14} color="#fff" />
                  <Text style={styles.exportTxt}>PDF</Text>
                </Pressable>
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
  heroGrad: { paddingHorizontal: 16, paddingVertical: 18, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 14 },
  heroHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heroTitles: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  exportTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
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
