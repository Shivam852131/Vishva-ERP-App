import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Calendar, Clock, MapPin, FileText, Download } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import type { Exam } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, Badge, AsyncView } from '@/src/ui';
import RNFS from 'react-native-fs';

interface HallTicket {
  id: string;
  student_id: string;
  student_name: string;
  exams: { exam_id: string; course_name: string; venue: string; date: string }[];
}

export default function Exams() {
  const { user } = useAuth();
  const { data: exams, loading, error, refresh } = useFetch<Exam[]>('/exams');
  const { data: hallTicket } = useFetch<HallTicket>(
    user?.role === 'student' ? '/exams/my-hallticket' : null
  );

  const examsSafe = exams || [];

  const handleDownloadHallTicket = useCallback(async () => {
    if (!hallTicket) return;
    try {
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const examsHTML = (hallTicket.exams || []).map(e =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(e.course_name)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(e.date)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(e.venue)}</td></tr>`
      ).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hall Ticket</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;padding:32px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #4F46E5;padding-bottom:12px;margin-bottom:20px}.name{font-size:22px;font-weight:800}.label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:left;padding:8px;border-bottom:2px solid #4F46E5;font-size:12px;font-weight:700;color:#4F46E5}</style></head><body>
<div class="header"><div class="label">Hall Ticket</div><div class="name" style="margin-top:8px">${esc(hallTicket.student_name)}</div><div style="font-size:12px;color:#64748b;margin-top:4px">${(hallTicket.exams || []).length} exam(s) scheduled</div></div>
<table><tr><th>Subject</th><th>Date</th><th>Venue</th></tr>${examsHTML}</table></body></html>`;

      const fileName = `HallTicket_${Date.now()}`;
      const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      await RNFS.writeFile(`${dir}/${fileName}.html`, html, 'utf8');
      Alert.alert('Saved', `${fileName}.html saved to Downloads. Open and print to PDF.`);
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not save hall ticket.');
    }
  }, [hallTicket]);

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Examinations</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
        >
          {hallTicket && (
            <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.ticketCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.ticketLabel}>Hall Ticket</Text>
                <Pressable onPress={handleDownloadHallTicket} style={{ padding: 8 }}>
                  <Download color="rgba(255,255,255,0.9)" size={20} />
                </Pressable>
              </View>
              <Text style={styles.ticketName}>{hallTicket.student_name}</Text>
              <Text style={styles.ticketExams}>{hallTicket.exams?.length || 0} exam(s) scheduled</Text>
              <View style={styles.ticketBadge}>
                <Text style={styles.ticketBadgeTxt}>VALID</Text>
              </View>
            </LinearGradient>
          )}

          <Text style={styles.h2}>Exam Schedule</Text>
          <AsyncView
            loading={loading && !exams}
            error={error}
            onRetry={refresh}
            empty={!loading && examsSafe.length === 0}
            emptyTitle="No exams scheduled"
            emptySub="Your exam timetable will appear here"
          >
            {examsSafe.map(ex => (
              <Card key={ex.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.examTypeRow}>
                      <Badge count={ex.exam_type} color={theme.colors.brandPrimary} />
                      <Text style={styles.examCode}>{ex.course_code || ''}</Text>
                    </View>
                    <Text style={styles.examName}>{ex.course_name}</Text>
                  </View>
                  <View style={styles.marksBadge}>
                    <Text style={styles.marksTxt}>{ex.max_marks}</Text>
                    <Text style={styles.marksLbl}>marks</Text>
                  </View>
                </View>
                <View style={styles.examMeta}>
                  <View style={styles.examMetaRow}>
                    <Calendar size={14} color={theme.colors.muted} />
                    <Text style={styles.examMetaTxt}>{new Date(ex.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  </View>
                  <View style={styles.examMetaRow}>
                    <Clock size={14} color={theme.colors.muted} />
                    <Text style={styles.examMetaTxt}>{ex.start_time} – {ex.end_time}</Text>
                  </View>
                  <View style={styles.examMetaRow}>
                    <MapPin size={14} color={theme.colors.muted} />
                    <Text style={styles.examMetaTxt}>{ex.venue}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </AsyncView>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  h2: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },
  ticketCard: { padding: theme.spacing.xl, borderRadius: theme.radius.lg, ...theme.shadow.lg },
  ticketLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ticketName: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 8 },
  ticketExams: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 },
  ticketBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: theme.radius.pill, alignSelf: 'flex-start', marginTop: 12 },
  ticketBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  examTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  examCode: { fontSize: 11, fontWeight: '700', color: theme.colors.brand, textTransform: 'uppercase' },
  examName: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginTop: 4 },
  marksBadge: { alignItems: 'center', backgroundColor: theme.colors.brandTertiary, padding: 10, borderRadius: theme.radius.md, minWidth: 56 },
  marksTxt: { fontSize: 18, fontWeight: '800', color: theme.colors.brand },
  marksLbl: { fontSize: 9, color: theme.colors.brand, fontWeight: '600' },
  examMeta: { marginTop: theme.spacing.md, gap: 6, paddingTop: theme.spacing.md, borderTopWidth: 1, borderColor: theme.colors.divider },
  examMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  examMetaTxt: { color: theme.colors.onSurfaceTertiary, fontSize: 13 },
});
