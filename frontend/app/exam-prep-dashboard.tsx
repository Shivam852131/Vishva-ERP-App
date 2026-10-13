/**
 * exam-prep-dashboard.tsx
 * Student — Personalised Exam Prep Dashboard
 * Shows: stats, weak areas, topic mastery, available quizzes, AI recommendations
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, BookOpen, Brain, Target, Bookmark,
  ChevronRight, TrendingUp, TrendingDown, Award,
  Play, Clock, BarChart3, Zap, CheckCircle2, AlertCircle,
  Star, RefreshCw, Plus,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { ExamPrepDashboard, ExamPrepQuiz, TopicMastery, ExamPrepAttemptSummary } from '@/src/types';
import { theme } from '@/src/theme';
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';

function scoreColor(pct: number) {
  if (pct >= 80) return '#10B981';
  if (pct >= 60) return '#F59E0B';
  return '#EF4444';
}

function MasteryBar({ topic, percent, index }: { topic: string; percent: number; index: number }) {
  const color = scoreColor(percent);
  return (
    <Animated.View entering={FadeInDown.delay(index * 60)} style={styles.masteryRow}>
      <Text style={styles.masteryTopic} numberOfLines={1}>{topic}</Text>
      <View style={styles.masteryBarTrack}>
        <View style={[styles.masteryBarFill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.masteryPct, { color }]}>{percent}%</Text>
    </Animated.View>
  );
}

function QuizCard({ quiz, index }: { quiz: ExamPrepQuiz; index: number }) {
  const now = new Date();
  const winStart = quiz.window_start ? new Date(quiz.window_start) : null;
  const winEnd = quiz.window_end ? new Date(quiz.window_end) : null;
  const isOpen = (!winStart || now >= winStart) && (!winEnd || now <= winEnd);

  const handleStart = async () => {
    if (!isOpen) {
      const msg = winStart && now < winStart
        ? `Opens ${winStart.toLocaleString()}`
        : 'Window has closed.';
      return Alert.alert('Not Available', msg);
    }
    try {
      const attempt = await api('/exam-prep/quizzes/' + quiz.id + '/start', { method: 'POST' });
      router.push('/exam-prep-attempt' as any, {
        attemptId: attempt.attempt_id,
        quizId: quiz.id,
      } as any);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start quiz');
    }
  };

  return (
    <Animated.View entering={SlideInRight.delay(index * 80)} style={styles.quizCard}>
      <View style={styles.quizHeader}>
        <View style={[styles.quizBadge, { backgroundColor: quiz.is_practice ? '#EFF6FF' : '#FEF3C7' }]}>
          <Text style={[styles.quizBadgeText, { color: quiz.is_practice ? '#2563EB' : '#D97706' }]}>
            {quiz.is_practice ? 'Practice' : 'Exam'}
          </Text>
        </View>
        <Text style={styles.quizDifficulty}>{quiz.difficulty}</Text>
      </View>
      <Text style={styles.quizTitle} numberOfLines={2}>{quiz.title}</Text>
      {quiz.subject ? <Text style={styles.quizSubject}>{quiz.subject} {quiz.topic ? `· ${quiz.topic}` : ''}</Text> : null}
      <View style={styles.quizMeta}>
        <View style={styles.quizMetaItem}>
          <Clock size={12} color={theme.colors.textSecondary} />
          <Text style={styles.quizMetaText}>{quiz.duration_minutes}m</Text>
        </View>
        <View style={styles.quizMetaItem}>
          <BookOpen size={12} color={theme.colors.textSecondary} />
          <Text style={styles.quizMetaText}>{quiz.total_questions}Q</Text>
        </View>
        <View style={styles.quizMetaItem}>
          <Award size={12} color={theme.colors.textSecondary} />
          <Text style={styles.quizMetaText}>Pass {quiz.pass_score}%</Text>
        </View>
      </View>
      {quiz.window_start && (
        <Text style={styles.quizWindow}>
          {winStart && now < winStart
            ? `Opens ${winStart.toLocaleDateString()}`
            : winEnd ? `Closes ${winEnd.toLocaleDateString()}` : ''}
        </Text>
      )}
      <Pressable
        style={[styles.startBtn, !isOpen && { opacity: 0.5 }]}
        onPress={handleStart}
      >
        <Play size={14} color="#fff" />
        <Text style={styles.startBtnText}>{quiz.is_practice ? 'Practice' : 'Start Exam'}</Text>
      </Pressable>
    </Animated.View>
  );
}

function RecommendationCard({ rec, index }: { rec: any; index: number }) {
  const colors = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
  const bg = { high: '#FEE2E2', medium: '#FEF3C7', low: '#DCFCE7' };
  const color = colors[rec.priority as keyof typeof colors] || '#6B7280';
  const bgColor = bg[rec.priority as keyof typeof bg] || '#F3F4F6';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60)} style={styles.recCard}>
      <View style={[styles.recPriority, { backgroundColor: bgColor }]}>
        <Text style={[styles.recPriorityText, { color }]}>{rec.priority}</Text>
      </View>
      <Text style={styles.recTitle}>{rec.title}</Text>
      <Text style={styles.recBody} numberOfLines={2}>{rec.body}</Text>
    </Animated.View>
  );
}

export default function ExamPrepDashboardScreen() {
  const { data, loading, error, refresh } = useFetch<ExamPrepDashboard>('/exam-prep/dashboard');
  // Full history incl. expired attempts. Declared unconditionally (before the
  // early return below) so the hook order never changes between renders.
  const { data: history, loading: historyLoading, refresh: refreshHistory } =
    useFetch<ExamPrepAttemptSummary[]>('/exam-prep/my-attempts');
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'quizzes' | 'mastery' | 'history' | 'recs'>('overview');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshHistory()]);
    setRefreshing(false);
  }, [refresh, refreshHistory]);

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
        <Text style={styles.loadingText}>Loading your exam prep dashboard…</Text>
      </SafeAreaView>
    );
  }

  const d = data;
  const stats = d?.stats;
  const TABS = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'quizzes', label: 'Quizzes', icon: Play },
    { key: 'mastery', label: 'Mastery', icon: Target },
    { key: 'history', label: 'History', icon: Clock },
    { key: 'recs', label: 'Tips', icon: Brain },
  ] as const;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#4F46E5', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Exam Prep Center</Text>
          <Text style={styles.headerSubtitle}>Practice · Quiz · Master</Text>
        </View>
        <Pressable style={styles.bookmarkBtn} onPress={() => router.push('/exam-prep-bookmarks' as any)}>
          <Bookmark size={20} color="#fff" />
        </Pressable>
      </LinearGradient>

      {/* Stats bar */}
      {stats && (
        <View style={styles.statsBar}>
          {[
            { label: 'Attempts', value: stats.total_quiz_attempts, icon: Play, color: '#4F46E5' },
            { label: 'Practice', value: stats.total_practice_sessions, icon: BookOpen, color: '#059669' },
            { label: 'Avg Score', value: `${stats.average_score}%`, icon: BarChart3, color: '#D97706' },
            { label: 'Mastered', value: stats.topics_mastered, icon: CheckCircle2, color: '#7C3AED' },
          ].map(({ label, value, icon: Icon, color }) => (
            <View key={label} style={styles.statItem}>
              <Icon size={14} color={color} />
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <Pressable
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(key as any)}
            >
              <Icon size={14} color={active ? theme.colors.brand : theme.colors.textSecondary} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <>
            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Practice</Text>
            <View style={styles.quickActions}>
              <Pressable
                style={[styles.quickBtn, { backgroundColor: '#EFF6FF' }]}
                onPress={() => router.push('/exam-prep-practice' as any)}
              >
                <BookOpen size={24} color="#2563EB" />
                <Text style={[styles.quickBtnLabel, { color: '#2563EB' }]}>Start Practice</Text>
                <Text style={styles.quickBtnSub}>Untimed, with explanations</Text>
              </Pressable>
              <Pressable
                style={[styles.quickBtn, { backgroundColor: '#F0FDF4' }]}
                onPress={() => router.push('/exam-prep-question-bank' as any)}
              >
                <BookOpen size={24} color="#059669" />
                <Text style={[styles.quickBtnLabel, { color: '#059669' }]}>Question Bank</Text>
                <Text style={styles.quickBtnSub}>Browse & bookmark</Text>
              </Pressable>
            </View>

            {/* Weak areas */}
            {d?.weak_areas && d.weak_areas.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <TrendingDown size={16} color="#EF4444" />
                  <Text style={[styles.sectionTitle, { color: '#EF4444', marginLeft: 6 }]}>Needs Attention</Text>
                </View>
                {d.weak_areas.slice(0, 3).map((area, i) => (
                  <MasteryBar key={area.topic} topic={area.topic} percent={area.mastery_percent} index={i} />
                ))}
              </>
            )}

            {/* Strong areas */}
            {d?.strong_areas && d.strong_areas.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <TrendingUp size={16} color="#10B981" />
                  <Text style={[styles.sectionTitle, { color: '#10B981', marginLeft: 6 }]}>Strengths</Text>
                </View>
                {d.strong_areas.map((area, i) => (
                  <MasteryBar key={area.topic} topic={area.topic} percent={area.mastery_percent} index={i} />
                ))}
              </>
            )}

            {/* Recent attempts */}
            {d?.recent_attempts && d.recent_attempts.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Recent Results</Text>
                {d.recent_attempts.map((a, i) => (
                  <Animated.View key={a.id} entering={FadeInDown.delay(i * 50)} style={styles.attemptRow}>
                    <View style={styles.attemptLeft}>
                      <Text style={styles.attemptTitle} numberOfLines={1}>{a.quiz_title}</Text>
                      <Text style={styles.attemptDate}>{new Date(a.submitted_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.attemptRight}>
                      <Text style={[styles.attemptScore, { color: scoreColor(a.score_percent) }]}>
                        {a.score_percent}%
                      </Text>
                      <View style={[styles.attemptBadge, { backgroundColor: a.passed ? '#DCFCE7' : '#FEE2E2' }]}>
                        <Text style={[styles.attemptBadgeText, { color: a.passed ? '#059669' : '#DC2626' }]}>
                          {a.passed ? 'PASS' : 'FAIL'}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </>
            )}

            {(!d || (d.recent_attempts?.length === 0 && d.weak_areas?.length === 0)) && (
              <View style={styles.emptyState}>
                <Brain size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No data yet</Text>
                <Text style={styles.emptyBody}>Take a practice session or quiz to see your personalized dashboard.</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push('/exam-prep-practice' as any)}>
                  <Text style={styles.emptyBtnText}>Start Practice</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {/* ── QUIZZES TAB ── */}
        {activeTab === 'quizzes' && (
          <>
            <Text style={styles.sectionTitle}>Available Quizzes & Exams</Text>
            {d?.available_quizzes?.length ? (
              <View style={styles.quizGrid}>
                {d.available_quizzes.map((q, i) => (
                  <QuizCard key={q.id} quiz={q} index={i} />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Play size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No quizzes available</Text>
                <Text style={styles.emptyBody}>Your faculty hasn't published any quizzes yet.</Text>
              </View>
            )}
          </>
        )}

        {/* ── MASTERY TAB ── */}
        {activeTab === 'mastery' && (
          <>
            <Text style={styles.sectionTitle}>Topic Mastery</Text>
            {d?.topic_mastery?.length ? (
              d.topic_mastery.map((t, i) => (
                <MasteryBar key={t.topic} topic={t.topic} percent={t.mastery_percent} index={i} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Target size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No mastery data yet</Text>
                <Text style={styles.emptyBody}>Complete practice sessions to see topic-wise mastery.</Text>
              </View>
            )}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <>
            <Text style={styles.sectionTitle}>Attempt History</Text>

            {historyLoading && !history ? (
              <ActivityIndicator style={{ marginTop: 30 }} color={theme.colors.brand} />
            ) : history && history.length > 0 ? (
              history.map((a, i) => (
                <Animated.View key={a.id} entering={FadeInDown.delay(Math.min(i, 8) * 50)} style={styles.attemptRow}>
                  <View style={styles.attemptLeft}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.attemptTitle} numberOfLines={1}>{a.quiz_title}</Text>
                      {a.is_practice && (
                        <View style={[styles.attemptBadge, { backgroundColor: '#EFF6FF' }]}>
                          <Text style={[styles.attemptBadgeText, { color: '#2563EB' }]}>PRAC</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.attemptDate}>
                      {new Date(a.submitted_at).toLocaleString()}
                      {a.expired ? ' · timed out' : ''}
                    </Text>
                  </View>

                  <View style={styles.attemptRight}>
                    <Text style={[styles.attemptScore, { color: a.score_percent == null ? theme.colors.textSecondary : scoreColor(a.score_percent) }]}>
                      {a.score_percent == null ? '—' : `${a.score_percent}%`}
                    </Text>
                    <View style={[styles.attemptBadge, {
                      backgroundColor: a.expired ? '#FEF3C7' : a.passed ? '#DCFCE7' : '#FEE2E2',
                    }]}>
                      <Text style={[styles.attemptBadgeText, {
                        color: a.expired ? '#92400E' : a.passed ? '#059669' : '#DC2626',
                      }]}>
                        {a.expired ? 'EXPIRED' : a.passed ? 'PASS' : 'FAIL'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Play size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyTitle}>No attempts yet</Text>
                <Text style={styles.emptyBody}>Your submitted quizzes — including any that timed out — will appear here.</Text>
              </View>
            )}
          </>
        )}

        {/* ── RECOMMENDATIONS TAB ── */}
        {activeTab === 'recs' && (
          <>
            <Text style={styles.sectionTitle}>Personalized Tips</Text>
            {d?.recommendations?.length ? (
              d.recommendations.map((r: any, i: number) => (
                <RecommendationCard key={i} rec={r} index={i} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Brain size={48} color={theme.colors.textSecondary} />
                <Text style={styles.emptyTitle}>Complete some practice first</Text>
                <Text style={styles.emptyBody}>We'll generate personalized study tips once you've answered a few questions.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  loadingText: { marginTop: 12, color: theme.colors.textSecondary },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  bookmarkBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  statsBar: { flexDirection: 'row', backgroundColor: theme.colors.surface, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 15, fontWeight: '700' },
  statLabel: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '500' },

  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 4 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.brand },
  tabLabel: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  tabLabelActive: { color: theme.colors.brand, fontWeight: '700' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 20, marginBottom: 10 },

  masteryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  masteryTopic: { width: 100, fontSize: 12, color: theme.colors.text, fontWeight: '500' },
  masteryBarTrack: { flex: 1, height: 6, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
  masteryBarFill: { height: '100%', borderRadius: 3 },
  masteryPct: { width: 36, fontSize: 12, fontWeight: '700', textAlign: 'right' },

  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  quickBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'transparent' },
  quickBtnLabel: { fontSize: 13, fontWeight: '700' },
  quickBtnSub: { fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center' },

  quizGrid: { gap: 12 },
  quizCard: { backgroundColor: theme.colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quizBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  quizBadgeText: { fontSize: 10, fontWeight: '700' },
  quizDifficulty: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '500', textTransform: 'capitalize' },
  quizTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  quizSubject: { fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 },
  quizMeta: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  quizMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  quizMetaText: { fontSize: 11, color: theme.colors.textSecondary },
  quizWindow: { fontSize: 11, color: '#D97706', marginBottom: 8, fontWeight: '500' },
  startBtn: { backgroundColor: theme.colors.brand, borderRadius: 8, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  startBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  attemptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  attemptLeft: { flex: 1, marginRight: 12 },
  attemptTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  attemptDate: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  attemptRight: { alignItems: 'flex-end', gap: 4 },
  attemptScore: { fontSize: 16, fontWeight: '800' },
  attemptBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  attemptBadgeText: { fontSize: 10, fontWeight: '700' },

  recCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  recPriority: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 6 },
  recPriorityText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  recTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  recBody: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptyBody: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 18 },
  emptyBtn: { backgroundColor: theme.colors.brand, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  emptyBtnText: { color: '#fff', fontWeight: '700' },
});
