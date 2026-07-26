import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, ClipboardCheck, Clock, Trophy, CheckCircle2,
  RotateCcw, Play, Medal, Target, ChevronRight,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { Assessment, AssessmentHistoryItem, LeaderboardRow, AssessmentAttempt } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, StatCard, ProgressBar, EmptyState } from '@/src/ui';

const TABS = [
  { key: 'catalog', label: 'Assessments' },
  { key: 'history', label: 'My Results' },
  { key: 'leaderboard', label: 'Leaderboard' },
];

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'programming', label: 'Programming' },
  { key: 'data', label: 'Data' },
  { key: 'core_engineering', label: 'Core CS' },
  { key: 'business', label: 'Business' },
  { key: 'design', label: 'Design' },
  { key: 'communication', label: 'Soft Skills' },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: '#10B981',
  intermediate: '#F59E0B',
  advanced: '#EF4444',
};

function scoreColor(score: number) {
  return score >= 75 ? theme.colors.success : score >= 50 ? theme.colors.warning : theme.colors.error;
}

export default function SkillAssessment() {
  const [tab, setTab] = useState('catalog');
  const [category, setCategory] = useState('all');
  const [starting, setStarting] = useState<string | null>(null);

  const { data: assessments, loading, error, refresh } = useFetch<Assessment[]>('/assessments');
  const { data: history, refresh: refreshHistory } = useFetch<AssessmentHistoryItem[]>('/assessments/history');
  const { data: leaderboard, refresh: refreshBoard } = useFetch<LeaderboardRow[]>('/assessments/leaderboard');

  const refreshAll = () => {
    refresh();
    refreshHistory();
    refreshBoard();
  };

  const visible = useMemo(() => {
    const list = assessments || [];
    return category === 'all' ? list : list.filter(a => a.category === category);
  }, [assessments, category]);

  const summary = useMemo(() => {
    const list = assessments || [];
    const taken = list.filter(a => a.my_attempts > 0);
    const passed = list.filter(a => a.passed);
    const scores = taken.map(a => a.best_score || 0);
    return {
      taken: taken.length,
      passed: passed.length,
      average: scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : 0,
    };
  }, [assessments]);

  const start = async (assessment: Assessment) => {
    setStarting(assessment.id);
    try {
      const attempt = await api<AssessmentAttempt>(`/assessments/${assessment.id}/start`, { method: 'POST' });
      router.push(`/assessment-attempt?attemptId=${attempt.attempt_id}`);
    } catch (e: any) {
      Alert.alert('Could not start', e?.message || 'Please try again.');
    } finally {
      setStarting(null);
    }
  };

  const confirmStart = (assessment: Assessment) => {
    if (assessment.in_progress_attempt_id) {
      router.push(`/assessment-attempt?attemptId=${assessment.in_progress_attempt_id}`);
      return;
    }
    Alert.alert(
      assessment.title,
      `${assessment.total_questions} questions · ${assessment.duration_minutes} minutes\n\nThe timer starts immediately and cannot be paused.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start now', onPress: () => start(assessment) },
      ],
    );
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={['#7C3AED', '#4F46E5']} style={styles.hero}>
          <View style={styles.heroRow}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.heroTitle}>Skill Assessments</Text>
            <View style={{ width: 22 }} />
          </View>
          <Text style={styles.heroSub}>
            Verified scores carry six times the weight of self-ratings on your profile.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{summary.taken}</Text>
              <Text style={styles.heroStatLabel}>Taken</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{summary.passed}</Text>
              <Text style={styles.heroStatLabel}>Passed</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{summary.average}%</Text>
              <Text style={styles.heroStatLabel}>Avg score</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.tabBar}>
          {TABS.map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === t.key && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'catalog' && (
          <>
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}>
                {CATEGORIES.map(c => (
                  <ChipBtn key={c.key} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />
                ))}
              </ScrollView>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
            >
              <AsyncView
                loading={loading && !assessments}
                error={error}
                onRetry={refresh}
                empty={!loading && visible.length === 0}
                emptyTitle="No assessments here"
                emptySub="Try another category."
                emptyIcon={<ClipboardCheck size={48} color={theme.colors.muted} />}
              >
                {visible.map(assessment => (
                  <Card key={assessment.id} onPress={() => confirmStart(assessment)} style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={styles.iconWrap}>
                        <ClipboardCheck size={20} color={theme.colors.brandPrimary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{assessment.title}</Text>
                        <Text style={styles.cardSub} numberOfLines={2}>{assessment.description}</Text>
                      </View>
                      {assessment.passed && <CheckCircle2 size={19} color={theme.colors.success} />}
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Target size={12} color={theme.colors.muted} />
                        <Text style={styles.metaText}>{assessment.total_questions} questions</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Clock size={12} color={theme.colors.muted} />
                        <Text style={styles.metaText}>{assessment.duration_minutes} min</Text>
                      </View>
                      <View style={[styles.diffPill, { backgroundColor: (DIFFICULTY_COLORS[assessment.difficulty] || theme.colors.muted) + '18' }]}>
                        <Text style={[styles.diffText, { color: DIFFICULTY_COLORS[assessment.difficulty] || theme.colors.muted }]}>
                          {assessment.difficulty}
                        </Text>
                      </View>
                    </View>

                    {assessment.best_score != null ? (
                      <View style={{ gap: 5 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={styles.metaText}>
                            Best score · {assessment.my_attempts} attempt{assessment.my_attempts === 1 ? '' : 's'}
                          </Text>
                          <Text style={[styles.scoreText, { color: scoreColor(assessment.best_score) }]}>
                            {assessment.best_score}%
                          </Text>
                        </View>
                        <ProgressBar value={assessment.best_score} max={100} height={6} color={scoreColor(assessment.best_score)} />
                      </View>
                    ) : null}

                    <View style={styles.actionRow}>
                      {assessment.in_progress_attempt_id ? (
                        <>
                          <Play size={14} color={theme.colors.warning} />
                          <Text style={[styles.actionText, { color: theme.colors.warning }]}>Resume attempt</Text>
                        </>
                      ) : assessment.my_attempts > 0 ? (
                        <>
                          <RotateCcw size={14} color={theme.colors.brandPrimary} />
                          <Text style={styles.actionText}>Retake · pass mark {assessment.pass_score}%</Text>
                        </>
                      ) : (
                        <>
                          <Play size={14} color={theme.colors.brandPrimary} />
                          <Text style={styles.actionText}>Start assessment</Text>
                        </>
                      )}
                      <ChevronRight size={14} color={theme.colors.muted} style={{ marginLeft: 'auto' }} />
                    </View>
                  </Card>
                ))}
              </AsyncView>
            </ScrollView>
          </>
        )}

        {tab === 'history' && (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            {(history || []).length === 0 ? (
              <EmptyState
                title="No results yet"
                sub="Complete an assessment to build a verified skill record."
                icon={<Trophy size={48} color={theme.colors.muted} />}
              />
            ) : (
              (history || []).map(item => (
                <Card
                  key={item.id}
                  onPress={() => router.push(`/assessment-attempt?attemptId=${item.id}&review=1`)}
                  style={{ gap: 8 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.scoreCircle, { borderColor: scoreColor(item.score_percent) }]}>
                      <Text style={[styles.scoreCircleText, { color: scoreColor(item.score_percent) }]}>
                        {item.score_percent}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.assessment_title}</Text>
                      <Text style={styles.cardSub}>
                        {item.correct}/{item.total} correct · {Math.round(item.time_taken_seconds / 60)} min
                      </Text>
                      <Text style={styles.dateText}>{new Date(item.submitted_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: item.passed ? '#DCFCE7' : '#FEE2E2' }]}>
                      <Text style={[styles.badgeText, { color: item.passed ? '#16A34A' : '#DC2626' }]}>
                        {item.passed ? 'PASSED' : 'FAILED'}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        {tab === 'leaderboard' && (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 10 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            {(leaderboard || []).length === 0 ? (
              <EmptyState
                title="Leaderboard is empty"
                sub="Be the first to complete an assessment."
                icon={<Medal size={48} color={theme.colors.muted} />}
              />
            ) : (
              (leaderboard || []).map(row => (
                <Card key={row.student_id} style={[styles.boardRow, row.is_me && styles.boardRowMe]}>
                  <View style={[
                    styles.rankBadge,
                    row.rank === 1 && { backgroundColor: '#FDE68A' },
                    row.rank === 2 && { backgroundColor: '#E5E7EB' },
                    row.rank === 3 && { backgroundColor: '#FED7AA' },
                  ]}>
                    <Text style={styles.rankText}>{row.rank}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {row.student_name}{row.is_me ? ' (you)' : ''}
                    </Text>
                    <Text style={styles.cardSub}>
                      {row.attempts} attempt{row.attempts === 1 ? '' : 's'} · {row.passed} passed
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.scoreText, { color: scoreColor(row.best_score) }]}>{row.best_score}%</Text>
                    <Text style={styles.dateText}>avg {row.average_score}%</Text>
                  </View>
                </Card>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: theme.spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 17 },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: theme.radius.lg, padding: theme.spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.brandPrimary },
  tabLabel: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },
  filterRow: { paddingVertical: theme.spacing.md },

  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  cardSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2, lineHeight: 17 },
  dateText: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  diffPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  diffText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },

  scoreText: { fontSize: 14, fontWeight: '800' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 },
  actionText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },

  scoreCircle: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  scoreCircleText: { fontSize: 14, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boardRowMe: { borderColor: theme.colors.brandPrimary, borderWidth: 1.5 },
  rankBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '800', color: theme.colors.onSurface },
});
