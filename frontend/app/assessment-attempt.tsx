import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, BackHandler,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Award,
  ChevronLeft, ChevronRight, Flag, Target, BarChart3,
  BookOpen, Zap, Star, RotateCcw,
} from 'lucide-react-native';
import { api } from '@/src/api';
import type { AssessmentAttempt, AssessmentResult } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, Button, ProgressBar, AsyncView } from '@/src/ui';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeInDown, SlideInRight,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ─── Animated Score Ring ────────────────────────────────
function ScoreRing({ percentage, size = 120, strokeWidth = 8 }: {
  percentage: number; size?: number; strokeWidth?: number;
}) {
  const animatedValue = useSharedValue(0);
  const scaleValue = useSharedValue(0.8);

  useEffect(() => {
    animatedValue.value = withTiming(percentage, { duration: 1500 });
    scaleValue.value = withSpring(1, { damping: 12, stiffness: 100 });
  }, [percentage]);

  const fill = Math.max(0, Math.min(100, percentage));
  const color = fill >= 75 ? '#10B981' : fill >= 50 ? '#F59E0B' : '#EF4444';
  const label = fill >= 90 ? 'Excellent' : fill >= 75 ? 'Good' : fill >= 50 ? 'Average' : 'Needs Work';

  const animatedRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View style={[{ alignItems: 'center' }, animatedRingStyle]}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.resultRingBg, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary }]} />
        <View style={[styles.resultRingProgress, {
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: color,
          borderLeftColor: 'transparent', borderBottomColor: 'transparent',
          transform: [{ rotate: `${(fill / 100) * 360 - 90}deg` }],
        }]} />
        <View style={styles.resultRingCenter}>
          <Text style={[styles.resultRingValue, { color }]}>{fill}%</Text>
          <Text style={styles.resultRingLabel}>{label}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Result View ────────────────────────────────────────
function ResultView({ result }: { result: AssessmentResult }) {
  const [showAll, setShowAll] = useState(false);
  const color = result.passed ? theme.colors.success : theme.colors.error;
  const shown = showAll ? result.breakdown : result.breakdown.filter(b => !b.correct);

  return (
    <ScrollView contentContainerStyle={styles.resultContainer}>
      {/* Hero */}
      <LinearGradient
        colors={result.passed ? ['#10B981', '#059669'] : ['#F87171', '#DC2626']}
        style={styles.resultHero}
      >
        <ScoreRing percentage={result.score_percent} size={100} strokeWidth={7} />
        <View style={styles.resultHeroStats}>
          <Text style={styles.resultHeroLabel}>{result.passed ? 'Passed' : 'Not Passed'}</Text>
          <Text style={styles.resultHeroMeta}>
            {result.correct} of {result.total} correct · {Math.round(result.time_taken_seconds / 60)} min taken
          </Text>
        </View>
      </LinearGradient>

      {/* Certificate */}
      {result.certificate_id && (
        <Card style={styles.certCard}>
          <View style={[styles.certIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <Award size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.certTitle}>Certificate Issued</Text>
            <Text style={styles.certSub}>Added to your skill profile as a verified credential.</Text>
          </View>
        </Card>
      )}

      {/* Skill Updated */}
      {result.skill && (
        <Card style={{ gap: 10 }}>
          <View style={styles.sectionHeader}>
            <Zap size={16} color={theme.colors.brandPrimary} />
            <Text style={styles.sectionLabel}>Skill Updated</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.skillName}>{result.skill.name}</Text>
            <View style={[styles.skillBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.skillLevel, { color }]}>{result.skill.level_label}</Text>
            </View>
          </View>
          <ProgressBar value={result.skill.score} max={100} height={7} showPct />
        </Card>
      )}

      {/* Performance by Difficulty */}
      {result.by_difficulty.length > 0 && (
        <Card style={{ gap: 10 }}>
          <View style={styles.sectionHeader}>
            <BarChart3 size={16} color={theme.colors.brandPrimary} />
            <Text style={styles.sectionLabel}>Performance by Difficulty</Text>
          </View>
          {result.by_difficulty.map(entry => (
            <View key={entry.difficulty} style={styles.diffRow}>
              <View style={styles.diffHeader}>
                <Text style={styles.diffLabel}>{entry.difficulty}</Text>
                <Text style={styles.diffValue}>{entry.correct}/{entry.total} · {entry.percent}%</Text>
              </View>
              <ProgressBar value={entry.percent} max={100} height={6} />
            </View>
          ))}
        </Card>
      )}

      {/* Questions Review */}
      <View style={styles.reviewHeader}>
        <View style={styles.sectionHeader}>
          <BookOpen size={16} color={theme.colors.brandPrimary} />
          <Text style={styles.sectionLabel}>
            {showAll ? 'All Questions' : `Review ${shown.length} Incorrect`}
          </Text>
        </View>
        <Pressable onPress={() => setShowAll(v => !v)} style={styles.toggleBtn}>
          <Text style={styles.toggleText}>{showAll ? 'Mistakes Only' : 'Show All'}</Text>
        </Pressable>
      </View>

      {shown.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 8, padding: 24 }}>
          <View style={[styles.perfectIcon, { backgroundColor: '#DCFCE7' }]}>
            <CheckCircle2 size={28} color="#10B981" />
          </View>
          <Text style={styles.perfectText}>Perfect Score</Text>
          <Text style={styles.perfectSub}>Nothing to review — great work!</Text>
        </Card>
      ) : (
        shown.map(item => (
          <Card key={item.index} style={{ gap: 10 }}>
            <View style={styles.questionHeader}>
              {item.correct
                ? <View style={[styles.qStatusIcon, { backgroundColor: '#DCFCE7' }]}><CheckCircle2 size={14} color="#10B981" /></View>
                : <View style={[styles.qStatusIcon, { backgroundColor: '#FEE2E2' }]}><XCircle size={14} color="#EF4444" /></View>}
              <Text style={styles.questionText} numberOfLines={3}>{item.question}</Text>
            </View>

            <View style={styles.optionsList}>
              {item.options.map((option, optionIndex) => {
                const isCorrect = optionIndex === item.correct_index;
                const isChosen = optionIndex === item.selected_index;
                return (
                  <View
                    key={optionIndex}
                    style={[
                      styles.reviewOption,
                      isCorrect && styles.reviewCorrect,
                      isChosen && !isCorrect && styles.reviewWrong,
                    ]}
                  >
                    <View style={styles.optionRow}>
                      <Text style={[
                        styles.reviewOptionText,
                        isCorrect && { color: '#065F46', fontWeight: '700' },
                        isChosen && !isCorrect && { color: '#991B1B', fontWeight: '700' },
                      ]} numberOfLines={2}>
                        {option}
                      </Text>
                      {isCorrect && <Text style={styles.tagCorrect}>Correct</Text>}
                      {isChosen && !isCorrect && <Text style={styles.tagWrong}>Your answer</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {item.selected_index == null && (
              <View style={styles.skippedRow}>
                <RotateCcw size={12} color={theme.colors.warning} />
                <Text style={styles.skippedText}>Skipped</Text>
              </View>
            )}
          </Card>
        ))
      )}

      <Button label="Back to Assessments" onPress={() => router.back()} />
    </ScrollView>
  );
}

// ─── Screen ─────────────────────────────────────────────
export default function AssessmentAttemptScreen() {
  const params = useLocalSearchParams<{ attemptId: string; review?: string }>();
  const attemptId = String(params.attemptId || '');

  const [attempt, setAttempt] = useState<AssessmentAttempt | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const answersRef = useRef(answers);
  const submittedRef = useRef(false);
  answersRef.current = answers;

  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const payload = await api<AssessmentResult>(`/assessments/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers: answersRef.current }),
      });
      setResult(payload);
      setAttempt(null);
      if (auto) {
        Alert.alert('Time is up', 'Your answers were submitted automatically.');
      }
    } catch (e: any) {
      submittedRef.current = false;
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [attemptId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!attemptId) {
        setError('No attempt specified.');
        setLoading(false);
        return;
      }
      try {
        const payload = await api<any>(`/assessments/attempts/${attemptId}`);
        if (cancelled) return;
        if (payload.score_percent !== undefined) {
          setResult(payload as AssessmentResult);
          submittedRef.current = true;
        } else {
          const loaded = payload as AssessmentAttempt;
          setAttempt(loaded);
          setSecondsLeft(loaded.seconds_remaining);
          const restored: Record<number, number> = {};
          Object.entries(loaded.answers || {}).forEach(([key, value]) => {
            restored[Number(key)] = Number(value);
          });
          setAnswers(restored);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load this attempt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  useEffect(() => {
    if (!attempt || result) return;
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          submit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [attempt, result, submit]);

  useEffect(() => {
    if (!attempt || result) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Leave the assessment?', 'Your attempt stays open and the timer keeps running.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]);
      return true;
    });
    return () => handler.remove();
  }, [attempt, result]);

  const choose = async (questionIndex: number, optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: optionIndex }));
    try {
      await api(`/assessments/attempts/${attemptId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ index: questionIndex, optionIndex }),
      });
    } catch {
      // Answer sent with final submit
    }
  };

  const confirmSubmit = () => {
    const answered = Object.keys(answersRef.current).length;
    const total = attempt?.questions.length || 0;
    Alert.alert(
      'Submit Assessment?',
      answered < total
        ? `You have answered ${answered} of ${total}. Unanswered questions are marked wrong.`
        : 'All questions answered. Submit now?',
      [
        { text: 'Keep Working', style: 'cancel' },
        { text: 'Submit', onPress: () => submit(false) },
      ],
    );
  };

  if (result) {
    return (
      <ErrorBoundary>
        <SafeAreaView edges={['top']} style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ArrowLeft color={theme.colors.onSurface} size={22} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>{result.assessment.title}</Text>
            <View style={{ width: 22 }} />
          </View>
          <ResultView result={result} />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  if (loading || error || !attempt) {
    return (
      <ErrorBoundary>
        <SafeAreaView edges={['top']} style={styles.container}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <ArrowLeft color={theme.colors.onSurface} size={22} />
            </Pressable>
            <Text style={styles.headerTitle}>Assessment</Text>
            <View style={{ width: 22 }} />
          </View>
          <AsyncView loading={loading} error={error} onRetry={() => router.back()} empty={false}>
            <View />
          </AsyncView>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  const question = attempt.questions[current];
  const answeredCount = Object.keys(answers).length;
  const total = attempt.questions.length;
  const urgent = secondsLeft <= 60;
  const progress = total > 0 ? (current + 1) / total : 0;

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Header */}
        <SafeAreaView edges={['top']}>
          <View style={styles.header}>
            <Pressable
              onPress={() => Alert.alert('Leave the assessment?', 'Your attempt stays open and the timer keeps running.', [
                { text: 'Stay', style: 'cancel' },
                { text: 'Leave', style: 'destructive', onPress: () => router.back() },
              ])}
              hitSlop={10}
            >
              <ArrowLeft color={theme.colors.onSurface} size={22} />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>{attempt.assessment.title}</Text>
            <View style={[styles.timer, urgent && styles.timerUrgent]}>
              <Clock size={13} color={urgent ? '#fff' : theme.colors.brandPrimary} />
              <Text style={[styles.timerText, urgent && { color: '#fff' }]}>{formatClock(secondsLeft)}</Text>
            </View>
          </View>
        </SafeAreaView>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Q {current + 1}/{total}</Text>
            <Text style={styles.progressLabel}>{answeredCount} answered</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Question */}
        <ScrollView contentContainerStyle={styles.questionContainer}>
          <Card style={{ gap: 14 }}>
            <View style={styles.questionMeta}>
              <View style={styles.qNumber}>
                <Text style={styles.qNumberText}>{current + 1}</Text>
              </View>
              <Text style={styles.difficultyTag}>{question.difficulty}</Text>
              {answers[current] !== undefined && (
                <View style={styles.answeredBadge}>
                  <CheckCircle2 size={12} color="#10B981" />
                  <Text style={styles.answeredText}>Answered</Text>
                </View>
              )}
            </View>

            <Text style={styles.questionText}>{question.question}</Text>

            <View style={styles.optionsList}>
              {question.options.map((option, index) => {
                const selected = answers[current] === index;
                return (
                  <Pressable
                    key={index}
                    onPress={() => choose(current, index)}
                    style={[styles.option, selected && styles.optionSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.radio, selected && styles.radioOn]}>
                      {selected && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.optionText, selected && { color: theme.colors.brandPrimary, fontWeight: '700' }]} numberOfLines={3}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          {/* Question Grid */}
          <Card style={{ gap: 10 }}>
            <Text style={styles.gridTitle}>Question Navigator</Text>
            <View style={styles.gridWrap}>
              {attempt.questions.map((_, index) => (
                <Pressable
                  key={index}
                  onPress={() => setCurrent(index)}
                  style={[
                    styles.gridCell,
                    answers[index] !== undefined && styles.gridCellAnswered,
                    current === index && styles.gridCellCurrent,
                  ]}
                >
                  <Text style={[
                    styles.gridCellText,
                    (answers[index] !== undefined || current === index) && { color: '#fff' },
                  ]}>
                    {index + 1}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.brandPrimary }]} />
                <Text style={styles.legendText}>Current</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Answered</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.colors.surfaceTertiary }]} />
                <Text style={styles.legendText}>Unanswered</Text>
              </View>
            </View>
          </Card>
        </ScrollView>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            style={[styles.navBtn, current === 0 && { opacity: 0.35 }]}
            accessibilityLabel="Previous question"
          >
            <ChevronLeft size={20} color={theme.colors.onSurface} />
          </Pressable>

          {current === total - 1 ? (
            <Button
              label="Submit Assessment"
              icon={<Flag size={15} color="#fff" />}
              loading={submitting}
              onPress={confirmSubmit}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              label="Next Question"
              onPress={() => setCurrent(c => Math.min(total - 1, c + 1))}
              style={{ flex: 1 }}
            />
          )}

          <Pressable
            onPress={() => setCurrent(c => Math.min(total - 1, c + 1))}
            disabled={current === total - 1}
            style={[styles.navBtn, current === total - 1 && { opacity: 0.35 }]}
            accessibilityLabel="Next question"
          >
            <ChevronRight size={20} color={theme.colors.onSurface} />
          </Pressable>
        </View>

        {current !== total - 1 && (
          <Pressable onPress={confirmSubmit} style={styles.earlySubmit}>
            <Flag size={12} color={theme.colors.muted} />
            <Text style={styles.earlySubmitText}>Submit now</Text>
          </Pressable>
        )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  timer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill,
  },
  timerUrgent: { backgroundColor: theme.colors.error },
  timerText: { fontSize: 12, fontWeight: '800', color: theme.colors.brandPrimary },

  // Progress
  progressContainer: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  progressTrack: { height: 5, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: theme.colors.brandPrimary, borderRadius: 3 },

  // Question
  questionContainer: { padding: theme.spacing.lg, gap: 12, paddingBottom: 100 },
  questionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  qNumberText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  difficultyTag: { fontSize: 10, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  answeredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, marginLeft: 'auto' },
  answeredText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  questionText: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, lineHeight: 24 },

  // Options
  optionsList: { gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    padding: 14, borderRadius: theme.radius.md,
    borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  optionSelected: { borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandTertiary },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOn: { borderColor: theme.colors.brandPrimary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.brandPrimary },
  optionText: { flex: 1, fontSize: 14, color: theme.colors.onSurface, lineHeight: 20 },

  // Grid
  gridTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  gridCell: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSecondary,
  },
  gridCellAnswered: { backgroundColor: '#10B981', borderColor: '#10B981' },
  gridCellCurrent: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  gridCellText: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },

  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: theme.spacing.lg, paddingBottom: theme.spacing.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  navBtn: {
    width: 44, height: 44, borderRadius: theme.radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  earlySubmit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary },
  earlySubmitText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },

  // Result
  resultContainer: { padding: theme.spacing.lg, paddingBottom: 60, gap: 14 },
  resultHero: { borderRadius: theme.radius.xl, padding: theme.spacing.xxl, alignItems: 'center', gap: 12 },
  resultHeroStats: { alignItems: 'center' },
  resultHeroLabel: { fontSize: 18, fontWeight: '800', color: '#fff' },
  resultHeroMeta: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  resultRingBg: { position: 'absolute' },
  resultRingProgress: { position: 'absolute', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  resultRingCenter: { alignItems: 'center', justifyContent: 'center' },
  resultRingValue: { fontSize: 22, fontWeight: '800' },
  resultRingLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },

  certCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  certIconWrap: { width: 40, height: 40, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  certTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  certSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  skillName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  skillBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  skillLevel: { fontSize: 11, fontWeight: '800' },

  diffRow: { gap: 6 },
  diffHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  diffLabel: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600', textTransform: 'capitalize' },
  diffValue: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },

  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandTertiary },
  toggleText: { fontSize: 11, fontWeight: '700', color: theme.colors.brandPrimary },

  perfectIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  perfectText: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  perfectSub: { fontSize: 12, color: theme.colors.muted },

  questionHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  qStatusIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },

  reviewOption: {
    padding: 10, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  reviewCorrect: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  reviewWrong: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reviewOptionText: { flex: 1, fontSize: 13, color: theme.colors.onSurface, lineHeight: 18 },
  tagCorrect: { fontSize: 9, fontWeight: '800', color: '#059669' },
  tagWrong: { fontSize: 9, fontWeight: '800', color: '#DC2626' },
  skippedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  skippedText: { fontSize: 12, color: theme.colors.warning, fontWeight: '600' },
});
