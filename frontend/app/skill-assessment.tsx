import React, { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Alert,
  Dimensions, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, ClipboardCheck, Clock, Trophy, CheckCircle2,
  RotateCcw, Play, Medal, Target, ChevronRight, Search,
  Filter, BarChart3, TrendingUp, Award, FileText,
  ChevronDown, ChevronUp, X, Star, Zap, AlertCircle,
  BookOpen, CheckSquare, XSquare, AlertTriangle,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { Assessment, AssessmentHistoryItem, LeaderboardRow, AssessmentAttempt } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, StatCard, ProgressBar, EmptyState } from '@/src/ui';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeInDown, SlideInRight,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'catalog', label: 'Catalog', icon: BookOpen },
  { key: 'history', label: 'Results', icon: FileText },
  { key: 'leaderboard', label: 'Leaders', icon: Trophy },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const CATEGORIES = [
  { key: 'all', label: 'All', icon: ClipboardCheck },
  { key: 'programming', label: 'Programming', icon: Zap },
  { key: 'data', label: 'Data', icon: BarChart3 },
  { key: 'core_engineering', label: 'Core CS', icon: Target },
  { key: 'business', label: 'Business', icon: TrendingUp },
  { key: 'design', label: 'Design', icon: Star },
  { key: 'communication', label: 'Soft Skills', icon: Award },
];

const DIFFICULTY_META: Record<string, { color: string; bg: string; icon: any }> = {
  beginner: { color: '#10B981', bg: '#DCFCE7', icon: CheckCircle2 },
  intermediate: { color: '#F59E0B', bg: '#FEF3C7', icon: AlertCircle },
  advanced: { color: '#EF4444', bg: '#FEE2E2', icon: AlertTriangle },
};

function scoreColor(score: number) {
  return score >= 75 ? theme.colors.success : score >= 50 ? theme.colors.warning : theme.colors.error;
}

// ─── Animated Score Ring ────────────────────────────────
function ScoreRing({ percentage, size = 64, strokeWidth = 5 }: {
  percentage: number; size?: number; strokeWidth?: number;
}) {
  const animatedValue = useSharedValue(0);
  const scaleValue = useSharedValue(0.8);

  useEffect(() => {
    animatedValue.value = withTiming(percentage, { duration: 1200 });
    scaleValue.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, [percentage]);

  const radius = (size - strokeWidth) / 2;
  const fill = Math.max(0, Math.min(100, percentage));
  const color = scoreColor(fill);

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, animatedRingStyle]}>
      <View style={[styles.ringOuter, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary }]} />
      <View style={[styles.ringProgress, {
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: color,
        borderLeftColor: 'transparent', borderBottomColor: 'transparent',
        transform: [{ rotate: `${(fill / 100) * 360 - 90}deg` }],
      }]} />
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color }]}>{fill}</Text>
      </View>
    </Animated.View>
  );
}

// ─── Assessment Card (Advanced) ─────────────────────────
function AssessmentCard({ assessment, onAction, startingId }: {
  assessment: Assessment; onAction: (a: Assessment) => void; startingId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const scaleValue = useSharedValue(0.95);

  useEffect(() => {
    scaleValue.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const diffMeta = DIFFICULTY_META[assessment.difficulty] || DIFFICULTY_META.intermediate;
  const DiffIcon = diffMeta.icon;
  const isStarting = startingId === assessment.id;

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 12 }]}>
      <Pressable onPress={() => onAction(assessment)} style={styles.assessmentCard}>
        <View style={[styles.cardAccent, { backgroundColor: diffMeta.color }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: diffMeta.bg }]}>
              <ClipboardCheck size={18} color={diffMeta.color} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>{assessment.title}</Text>
              <Text style={styles.cardSub} numberOfLines={2}>{assessment.description}</Text>
            </View>
            {assessment.passed && (
              <View style={[styles.passedBadge, { backgroundColor: '#DCFCE7' }]}>
                <CheckCircle2 size={12} color="#16A34A" />
                <Text style={styles.passedText}>PASSED</Text>
              </View>
            )}
          </View>

          <View style={styles.cardMetaGrid}>
            <View style={styles.metaChip}>
              <Target size={11} color={theme.colors.muted} />
              <Text style={styles.metaChipText}>{assessment.total_questions} Q</Text>
            </View>
            <View style={styles.metaChip}>
              <Clock size={11} color={theme.colors.muted} />
              <Text style={styles.metaChipText}>{assessment.duration_minutes}m</Text>
            </View>
            <View style={[styles.metaChip, { backgroundColor: diffMeta.bg }]}>
              <DiffIcon size={11} color={diffMeta.color} />
              <Text style={[styles.metaChipText, { color: diffMeta.color }]}>{assessment.difficulty}</Text>
            </View>
            <View style={styles.metaChip}>
              <Star size={11} color={theme.colors.muted} />
              <Text style={styles.metaChipText}>Pass {assessment.pass_score}%</Text>
            </View>
          </View>

          {assessment.best_score != null && (
            <View style={styles.scoreSection}>
              <View style={styles.scoreHeader}>
                <Text style={styles.scoreLabel}>Best Score</Text>
                <Text style={[styles.scoreValue, { color: scoreColor(assessment.best_score) }]}>
                  {assessment.best_score}%
                </Text>
              </View>
              <ProgressBar value={assessment.best_score} max={100} height={6} color={scoreColor(assessment.best_score)} />
              <Text style={styles.attemptsText}>
                {assessment.my_attempts} attempt{assessment.my_attempts === 1 ? '' : 's'}
              </Text>
            </View>
          )}

          {expanded && (
            <View style={styles.expandedContent}>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <BookOpen size={13} color={theme.colors.brandPrimary} />
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>{assessment.category || 'General'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Award size={13} color={theme.colors.brandPrimary} />
                  <Text style={styles.detailLabel}>Pass Mark</Text>
                  <Text style={styles.detailValue}>{assessment.pass_score}%</Text>
                </View>
                <View style={styles.detailItem}>
                  <Clock size={13} color={theme.colors.brandPrimary} />
                  <Text style={styles.detailLabel}>Duration</Text>
                  <Text style={styles.detailValue}>{assessment.duration_minutes} min</Text>
                </View>
                <View style={styles.detailItem}>
                  <BarChart3 size={13} color={theme.colors.brandPrimary} />
                  <Text style={styles.detailLabel}>Questions</Text>
                  <Text style={styles.detailValue}>{assessment.total_questions}</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Pressable onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
              <Text style={styles.expandText}>{expanded ? 'Less' : 'Details'}</Text>
              {expanded ? <ChevronUp size={12} color={theme.colors.brandPrimary} /> : <ChevronDown size={12} color={theme.colors.brandPrimary} />}
            </Pressable>

            <View style={styles.actionArea}>
              {assessment.in_progress_attempt_id ? (
                <View style={[styles.actionBtn, { backgroundColor: '#FEF3C7' }]}>
                  <Play size={13} color="#D97706" />
                  <Text style={[styles.actionText, { color: '#D97706' }]}>Resume</Text>
                </View>
              ) : assessment.my_attempts > 0 ? (
                <View style={[styles.actionBtn, { backgroundColor: theme.colors.brandTertiary }]}>
                  <RotateCcw size={13} color={theme.colors.brandPrimary} />
                  <Text style={styles.actionText}>Retake</Text>
                </View>
              ) : (
                <View style={[styles.actionBtn, { backgroundColor: theme.colors.brandPrimary }]}>
                  {isStarting ? (
                    <ActivityIndicator color="#fff" size={13} />
                  ) : (
                    <Play size={13} color="#fff" />
                  )}
                  <Text style={[styles.actionText, { color: '#fff' }]}>
                    {isStarting ? 'Starting...' : 'Start'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── History Card ───────────────────────────────────────
function HistoryCard({ item }: { item: AssessmentHistoryItem }) {
  const color = scoreColor(item.score_percent);
  return (
    <Pressable
      onPress={() => router.push(`/assessment-attempt?attemptId=${item.id}&review=1`)}
      style={styles.historyCard}
    >
      <View style={[styles.historyAccent, { backgroundColor: color }]} />
      <View style={styles.historyContent}>
        <View style={styles.historyHeader}>
          <ScoreRing percentage={item.score_percent} size={52} strokeWidth={4} />
          <View style={styles.historyInfo}>
            <Text style={styles.historyTitle} numberOfLines={1}>{item.assessment_title}</Text>
            <Text style={styles.historyMeta}>
              {item.correct}/{item.total} correct · {Math.round(item.time_taken_seconds / 60)} min
            </Text>
            <Text style={styles.historyDate}>{new Date(item.submitted_at).toLocaleDateString()}</Text>
          </View>
          <View style={[styles.resultBadge, { backgroundColor: item.passed ? '#DCFCE7' : '#FEE2E2' }]}>
            <Text style={[styles.resultBadgeText, { color: item.passed ? '#16A34A' : '#DC2626' }]}>
              {item.passed ? 'PASS' : 'FAIL'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Leaderboard Row ────────────────────────────────────
function LeaderboardRowItem({ row }: { row: LeaderboardRow }) {
  const rankColors: Record<number, string> = { 1: '#FDE68A', 2: '#E5E7EB', 3: '#FED7AA' };

  return (
    <View style={[styles.leaderCard, row.is_me && styles.leaderCardMe]}>
      <View style={[
        styles.rankBadge,
        row.rank <= 3 && { backgroundColor: rankColors[row.rank] || theme.colors.surfaceTertiary },
      ]}>
        <Text style={styles.rankText}>{row.rank}</Text>
      </View>
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderName}>
          {row.student_name}{row.is_me ? ' (you)' : ''}
        </Text>
        <Text style={styles.leaderMeta}>
          {row.attempts} attempt{row.attempts === 1 ? '' : 's'} · {row.passed} passed
        </Text>
      </View>
      <View style={styles.leaderScores}>
        <Text style={[styles.leaderBest, { color: scoreColor(row.best_score) }]}>{row.best_score}%</Text>
        <Text style={styles.leaderAvg}>avg {row.average_score}%</Text>
      </View>
    </View>
  );
}

// ─── Analytics Tab ──────────────────────────────────────
function AnalyticsTab({ assessments, history }: { assessments: Assessment[]; history: AssessmentHistoryItem[] }) {
  const totalTaken = assessments.filter(a => a.my_attempts > 0).length;
  const totalPassed = assessments.filter(a => a.passed).length;
  const allScores = assessments.filter(a => a.best_score != null).map(a => a.best_score!);
  const avgScore = allScores.length ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length) : 0;
  const passRate = totalTaken > 0 ? Math.round((totalPassed / totalTaken) * 100) : 0;

  const categoryStats = useMemo(() => {
    const map = new Map<string, { taken: number; passed: number; avg: number }>();
    assessments.forEach(a => {
      const cat = a.category || 'other';
      const existing = map.get(cat) || { taken: 0, passed: 0, avg: 0 };
      if (a.my_attempts > 0) existing.taken++;
      if (a.passed) existing.passed++;
      if (a.best_score != null) existing.avg = (existing.avg + a.best_score) / 2;
      map.set(cat, existing);
    });
    return Array.from(map.entries()).filter(([, v]) => v.taken > 0);
  }, [assessments]);

  const recentHistory = history.slice(0, 5);
  const trendScores = recentHistory.map(h => h.score_percent);
  const trend = trendScores.length >= 2 ? trendScores[0] - trendScores[trendScores.length - 1] : 0;

  return (
    <View style={styles.analyticsContainer}>
      <View style={styles.statsGrid}>
        <StatCard
          label="AVG SCORE"
          value={`${avgScore}%`}
          sub={`${allScores.length} scored`}
          color={scoreColor(avgScore)}
          icon={<BarChart3 size={18} color={scoreColor(avgScore)} />}
          trend={trend}
        />
        <StatCard
          label="PASS RATE"
          value={`${passRate}%`}
          sub={`${totalPassed}/${totalTaken} passed`}
          color={passRate >= 70 ? '#10B981' : '#F59E0B'}
          icon={<TrendingUp size={18} color={passRate >= 70 ? '#10B981' : '#F59E0B'} />}
        />
      </View>

      <View style={[styles.statsGrid, { marginTop: 12 }]}>
        <StatCard
          label="COMPLETED"
          value={`${totalTaken}`}
          sub="Assessments"
          color="#6366F1"
          icon={<CheckSquare size={18} color="#6366F1" />}
        />
        <StatCard
          label="PENDING"
          value={`${assessments.length - totalTaken}`}
          sub="Remaining"
          color="#F59E0B"
          icon={<XSquare size={18} color="#F59E0B" />}
        />
      </View>

      <Text style={styles.sectionTitle}>Performance by Category</Text>
      {categoryStats.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: 24 }}>
          <BarChart3 size={32} color={theme.colors.muted} />
          <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 8 }}>No category data yet</Text>
        </Card>
      ) : (
        categoryStats.map(([cat, stats]) => (
          <Card key={cat} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryName}>{cat.replace('_', ' ')}</Text>
              <Text style={[styles.categoryRate, { color: stats.passed / Math.max(stats.taken, 1) >= 0.7 ? '#10B981' : '#F59E0B' }]}>
                {Math.round((stats.passed / Math.max(stats.taken, 1)) * 100)}% pass
              </Text>
            </View>
            <View style={styles.categoryStats}>
              <Text style={styles.categoryStatText}>{stats.taken} taken</Text>
              <Text style={styles.categoryStatText}>{stats.passed} passed</Text>
              <Text style={styles.categoryStatText}>avg {Math.round(stats.avg)}%</Text>
            </View>
            <ProgressBar
              value={Math.round(stats.avg)}
              max={100}
              height={5}
              color={scoreColor(stats.avg)}
            />
          </Card>
        ))
      )}

      <Text style={styles.sectionTitle}>Recent Trend</Text>
      {recentHistory.length === 0 ? (
        <Card style={{ alignItems: 'center', padding: 24 }}>
          <TrendingUp size={32} color={theme.colors.muted} />
          <Text style={{ color: theme.colors.muted, fontSize: 13, marginTop: 8 }}>Complete assessments to see trends</Text>
        </Card>
      ) : (
        <Card style={styles.trendCard}>
          <View style={styles.chartBars}>
            {recentHistory.slice(0, 7).reverse().map((h, i) => (
              <View key={h.id} style={styles.chartBarWrap}>
                <View style={[styles.chartBar, { height: `${h.score_percent}%`, backgroundColor: scoreColor(h.score_percent) }]} />
                <Text style={styles.chartBarLabel}>{h.score_percent}%</Text>
              </View>
            ))}
          </View>
          <View style={styles.trendFooter}>
            <Text style={styles.trendFooterText}>Last {recentHistory.length} attempts</Text>
            <View style={[styles.trendBadge, { backgroundColor: trend >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={{ color: trend >= 0 ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: '700' }}>
                {trend >= 0 ? '+' : ''}{trend}%
              </Text>
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────
export default function SkillAssessment() {
  const [tab, setTab] = useState('catalog');
  const [category, setCategory] = useState('all');
  const [starting, setStarting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const { data: assessments, loading, error, refresh } = useFetch<Assessment[]>('/assessments');
  const { data: history, refresh: refreshHistory } = useFetch<AssessmentHistoryItem[]>('/assessments/history');
  const { data: leaderboard, refresh: refreshBoard } = useFetch<LeaderboardRow[]>('/assessments/leaderboard');

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshHistory(), refreshBoard()]);
    setRefreshing(false);
  };

  const visible = useMemo(() => {
    let list = assessments || [];
    if (category !== 'all') list = list.filter(a => a.category === category);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.title.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [assessments, category, searchQuery]);

  const summary = useMemo(() => {
    const list = assessments || [];
    const taken = list.filter(a => a.my_attempts > 0);
    const passed = list.filter(a => a.passed);
    const scores = taken.map(a => a.best_score || 0);
    return {
      total: list.length,
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
      <View style={styles.container}>
        {/* Hero */}
        <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.hero}>
          <SafeAreaView edges={['top']}>
            <View style={styles.heroHeader}>
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <ArrowLeft color="#fff" size={22} />
              </Pressable>
              <Text style={styles.heroTitle}>Skill Assessments</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={styles.heroContent}>
              <View style={styles.heroRing}>
                <ScoreRing percentage={summary.average} size={80} strokeWidth={6} />
              </View>
              <View style={styles.heroStats}>
                <Text style={styles.heroStatus}>
                  {summary.average >= 75 ? 'Strong Performance' : summary.average >= 50 ? 'Getting There' : 'Keep Practicing'}
                </Text>
                <Text style={styles.heroSubtext}>
                  {summary.taken}/{summary.total} completed · {summary.passed} passed
                </Text>
                <View style={styles.heroQuickStats}>
                  <View style={styles.heroQuickStat}>
                    <Text style={styles.heroQuickValue}>{summary.taken}</Text>
                    <Text style={styles.heroQuickLabel}>Taken</Text>
                  </View>
                  <View style={styles.heroQuickDivider} />
                  <View style={styles.heroQuickStat}>
                    <Text style={styles.heroQuickValue}>{summary.passed}</Text>
                    <Text style={styles.heroQuickLabel}>Passed</Text>
                  </View>
                  <View style={styles.heroQuickDivider} />
                  <View style={styles.heroQuickStat}>
                    <Text style={styles.heroQuickValue}>{summary.average}%</Text>
                    <Text style={styles.heroQuickLabel}>Avg</Text>
                  </View>
                </View>
              </View>
            </View>

            <Text style={styles.heroBanner}>
              Verified scores carry 6x the weight of self-ratings on your profile.
            </Text>
          </SafeAreaView>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
              <t.icon size={14} color={tab === t.key ? theme.colors.brandPrimary : theme.colors.muted} />
              <Text style={[styles.tabLabel, tab === t.key && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
        >
          {/* Catalog */}
          {tab === 'catalog' && (
            <>
              <View style={styles.searchWrap}>
                <View style={styles.searchBar}>
                  <Search size={16} color={theme.colors.muted} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search assessments..."
                    placeholderTextColor={theme.colors.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery('')}>
                      <X size={14} color={theme.colors.muted} />
                    </Pressable>
                  )}
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                {CATEGORIES.map(c => (
                  <ChipBtn key={c.key} label={c.label} active={category === c.key} onPress={() => setCategory(c.key)} />
                ))}
              </ScrollView>

              <AsyncView
                loading={loading && !assessments}
                error={error}
                onRetry={refresh}
                empty={!loading && visible.length === 0}
                emptyTitle="No assessments found"
                emptySub="Try another category or search term."
                emptyIcon={<ClipboardCheck size={48} color={theme.colors.muted} />}
              >
                {visible.map(assessment => (
                  <AssessmentCard
                    key={assessment.id}
                    assessment={assessment}
                    onAction={confirmStart}
                    startingId={starting}
                  />
                ))}
              </AsyncView>
            </>
          )}

          {/* History */}
          {tab === 'history' && (
            <>
              <View style={styles.resultsSummary}>
                <View style={styles.resultsSummaryItem}>
                  <Text style={styles.resultsSummaryValue}>{summary.taken}</Text>
                  <Text style={styles.resultsSummaryLabel}>Taken</Text>
                </View>
                <View style={styles.resultsSummaryDivider} />
                <View style={styles.resultsSummaryItem}>
                  <Text style={[styles.resultsSummaryValue, { color: '#10B981' }]}>{summary.passed}</Text>
                  <Text style={styles.resultsSummaryLabel}>Passed</Text>
                </View>
                <View style={styles.resultsSummaryDivider} />
                <View style={styles.resultsSummaryItem}>
                  <Text style={[styles.resultsSummaryValue, { color: '#EF4444' }]}>{summary.taken - summary.passed}</Text>
                  <Text style={styles.resultsSummaryLabel}>Failed</Text>
                </View>
              </View>

              {(history || []).length === 0 ? (
                <EmptyState
                  title="No results yet"
                  sub="Complete an assessment to build a verified skill record."
                  icon={<Trophy size={48} color={theme.colors.muted} />}
                />
              ) : (
                (history || []).map(item => (
                  <HistoryCard key={item.id} item={item} />
                ))
              )}
            </>
          )}

          {/* Leaderboard */}
          {tab === 'leaderboard' && (
            <>
              {(leaderboard || []).length === 0 ? (
                <EmptyState
                  title="Leaderboard is empty"
                  sub="Be the first to complete an assessment."
                  icon={<Medal size={48} color={theme.colors.muted} />}
                />
              ) : (
                (leaderboard || []).map(row => (
                  <LeaderboardRowItem key={row.student_id} row={row} />
                ))
              )}
            </>
          )}

          {/* Analytics */}
          {tab === 'analytics' && (
            <AnalyticsTab assessments={assessments || []} history={history || []} />
          )}
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  // Hero
  hero: { paddingBottom: theme.spacing.lg },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  heroContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, gap: theme.spacing.lg },
  heroRing: { alignItems: 'center' },
  heroStats: { flex: 1 },
  heroStatus: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  heroQuickStats: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 0 },
  heroQuickStat: { flex: 1, alignItems: 'center' },
  heroQuickValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroQuickLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '600' },
  heroQuickDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroBanner: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.xl, lineHeight: 16 },

  // Tabs
  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.brandPrimary },
  tabLabel: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },

  content: { padding: theme.spacing.lg, paddingBottom: 100 },

  // Stats
  statsGrid: { flexDirection: 'row', gap: 12 },

  // Search
  searchWrap: { marginBottom: theme.spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.onSurface, marginLeft: 8 },

  // Filters
  filterScroll: { gap: 8, paddingBottom: theme.spacing.md },

  // Ring
  ringOuter: { position: 'absolute' },
  ringProgress: { position: 'absolute', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 14, fontWeight: '800' },

  // Assessment Card
  assessmentCard: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden', ...theme.shadow.sm },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, padding: theme.spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardIconWrap: { width: 36, height: 36, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  cardSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2, lineHeight: 17 },
  passedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  passedText: { fontSize: 9, fontWeight: '800', color: '#16A34A', letterSpacing: 0.3 },

  cardMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  metaChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },

  scoreSection: { marginTop: 12, gap: 6 },
  scoreHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  scoreValue: { fontSize: 15, fontWeight: '800' },
  attemptsText: { fontSize: 11, color: theme.colors.muted },

  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailItem: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.surface, padding: 10, borderRadius: theme.radius.md },
  detailLabel: { fontSize: 11, color: theme.colors.muted, flex: 1 },
  detailValue: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  expandBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  expandText: { fontSize: 12, fontWeight: '600', color: theme.colors.brandPrimary },
  actionArea: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill },
  actionText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },

  // History
  resultsSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  resultsSummaryItem: { flex: 1, alignItems: 'center' },
  resultsSummaryValue: { fontSize: 22, fontWeight: '800', color: theme.colors.onSurface },
  resultsSummaryLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 2, fontWeight: '600' },
  resultsSummaryDivider: { width: 1, height: 32, backgroundColor: theme.colors.border },

  historyCard: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10, overflow: 'hidden' },
  historyAccent: { width: 4 },
  historyContent: { flex: 1, padding: theme.spacing.lg },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  historyMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  historyDate: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  resultBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.sm },
  resultBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  // Leaderboard
  leaderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, marginBottom: 8 },
  leaderCardMe: { borderColor: theme.colors.brandPrimary, borderWidth: 1.5, backgroundColor: theme.colors.brandTertiary },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankText: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  leaderMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  leaderScores: { alignItems: 'flex-end' },
  leaderBest: { fontSize: 16, fontWeight: '800' },
  leaderAvg: { fontSize: 11, color: theme.colors.muted },

  // Analytics
  analyticsContainer: { gap: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },

  categoryCard: { marginBottom: 10 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, textTransform: 'capitalize' },
  categoryRate: { fontSize: 12, fontWeight: '700' },
  categoryStats: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  categoryStatText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  trendCard: { marginBottom: 12 },
  chartBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, gap: 6 },
  chartBarWrap: { flex: 1, alignItems: 'center' },
  chartBar: { width: '100%', maxWidth: 32, borderRadius: 4, minHeight: 4 },
  chartBarLabel: { fontSize: 9, color: theme.colors.muted, marginTop: 4, fontWeight: '600' },
  trendFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  trendFooterText: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  trendBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
});
