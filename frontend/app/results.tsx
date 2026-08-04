import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Download } from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import type { ExamResult } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { StatCard, EmptyState, Card, ChipBtn } from '@/src/ui';
import RNFS from 'react-native-fs';

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

  const handleDownloadMarksheet = useCallback(async () => {
    if (filtered.length === 0) {
      Alert.alert('No data', 'No results to export.');
      return;
    }
    try {
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rows = filtered.map((r, i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${i + 1}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(r.course_code)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(r.course_name)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${r.marks}/${r.max_marks}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:700">${esc(r.grade)}</td></tr>`
      ).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Marksheet</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;padding:32px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #4F46E5;padding-bottom:12px;margin-bottom:20px}.title{font-size:22px;font-weight:800}.summary{display:flex;justify-content:center;gap:32px;margin-top:12px}.stat{text-align:center}.stat-val{font-size:20px;font-weight:800;color:#4F46E5}.stat-lbl{font-size:10px;color:#64748b;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:left;padding:8px;border-bottom:2px solid #4F46E5;font-size:12px;font-weight:700;color:#4F46E5}</style></head><body>
<div class="header"><div class="title">Academic Marksheet</div><div class="summary"><div class="stat"><div class="stat-val">${cgpa}</div><div class="stat-lbl">CGPA</div></div><div class="stat"><div class="stat-val">${obtainedMarks}/${totalMarks}</div><div class="stat-lbl">Total Marks</div></div><div class="stat"><div class="stat-val">${filtered.length}</div><div class="stat-lbl">Subjects</div></div></div></div>
<table><tr><th>#</th><th>Code</th><th>Subject</th><th>Marks</th><th>Grade</th></tr>${rows}</table></body></html>`;

      const fileName = `Marksheet_${selectedSem || 'All'}_${Date.now()}`;
      const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      await RNFS.writeFile(`${dir}/${fileName}.html`, html, 'utf8');
      Alert.alert('Saved', `${fileName}.html saved. Open and print to PDF.`);
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not save marksheet.');
    }
  }, [filtered, cgpa, obtainedMarks, totalMarks, selectedSem]);

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Results</Text>
          <Pressable onPress={handleDownloadMarksheet} style={styles.downloadBtn} accessibilityLabel="Download marksheet">
            <Download color="#fff" size={16} />
          </Pressable>
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
  downloadBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.brandPrimary },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md },
  chipRow: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: 8 },
  code: { fontSize: 11, color: theme.colors.brand, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 2 },
  semester: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  gradeWrap: { alignItems: 'flex-end', backgroundColor: theme.colors.brandTertiary, padding: 12, borderRadius: theme.radius.md, minWidth: 60 },
  grade: { fontSize: 24, fontWeight: '800', color: theme.colors.brand },
  marks: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
});
