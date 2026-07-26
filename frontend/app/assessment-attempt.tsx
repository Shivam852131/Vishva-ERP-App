import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Award,
  ChevronLeft, ChevronRight, Flag,
} from 'lucide-react-native';
import { api } from '@/src/api';
import type { AssessmentAttempt, AssessmentResult } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, Button, ProgressBar, AsyncView } from '@/src/ui';

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ─── Result view ─────────────────────────────────────────────────
function ResultView({ result }: { result: AssessmentResult }) {
  const [showAll, setShowAll] = useState(false);
  const color = result.passed ? theme.colors.success : theme.colors.error;
  const shown = showAll ? result.breakdown : result.breakdown.filter(b => !b.correct);

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 60, gap: 14 }}>
      <LinearGradient
        colors={result.passed ? ['#10B981', '#059669'] : ['#F87171', '#DC2626']}
        style={styles.resultHero}
      >
        <Text style={styles.resultScore}>{result.score_percent}%</Text>
        <Text style={styles.resultLabel}>{result.passed ? 'Passed' : 'Not passed'}</Text>
        <Text style={styles.resultMeta}>
          {result.correct} of {result.total} correct · {Math.round(result.time_taken_seconds / 60)} min taken
        </Text>
      </LinearGradient>

      {result.certificate_id && (
        <Card style={styles.certCard}>
          <Award size={22} color={theme.colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.certTitle}>Certificate issued</Text>
            <Text style={styles.certSub}>Added to your skill profile as a verified credential.</Text>
          </View>
        </Card>
      )}

      {result.skill && (
        <Card style={{ gap: 8 }}>
          <Text style={styles.sectionLabel}>Skill updated</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.skillName}>{result.skill.name}</Text>
            <Text style={[styles.skillLevel, { color }]}>{result.skill.level_label}</Text>
          </View>
          <ProgressBar value={result.skill.score} max={100} height={7} showPct />
        </Card>
      )}

      {result.by_difficulty.length > 0 && (
        <Card style={{ gap: 10 }}>
          <Text style={styles.sectionLabel}>Performance by difficulty</Text>
          {result.by_difficulty.map(entry => (
            <View key={entry.difficulty} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.diffLabel}>{entry.difficulty}</Text>
                <Text style={styles.diffValue}>{entry.correct}/{entry.total} · {entry.percent}%</Text>
              </View>
              <ProgressBar value={entry.percent} max={100} height={6} />
            </View>
          ))}
        </Card>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.sectionLabel}>
          {showAll ? 'All questions' : `Review ${shown.length} incorrect`}
        </Text>
        <Pressable onPress={() => setShowAll(v => !v)}>
          <Text style={styles.linkText}>{showAll ? 'Show mistakes only' : 'Show all'}</Text>
        </Pressable>
      </View>

      {shown.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={28} color={theme.colors.success} />
          <Text style={styles.perfectText}>Perfect score — nothing to review.</Text>
        </Card>
      ) : (
        shown.map(item => (
          <Card key={item.index} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {item.correct
                ? <CheckCircle2 size={17} color={theme.colors.success} />
                : <XCircle size={17} color={theme.colors.error} />}
              <Text style={styles.questionText}>{item.question}</Text>
            </View>
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
                  <Text style={[
                    styles.reviewOptionText,
                    isCorrect && { color: '#065F46', fontWeight: '700' },
                    isChosen && !isCorrect && { color: '#991B1B', fontWeight: '700' },
                  ]}>
                    {option}
                  </Text>
                  {isCorrect && <Text style={styles.tagCorrect}>Correct</Text>}
                  {isChosen && !isCorrect && <Text style={styles.tagWrong}>Your answer</Text>}
                </View>
              );
            })}
            {item.selected_index == null && (
              <Text style={styles.skippedText}>You skipped this question.</Text>
            )}
          </Card>
        ))
      )}

      <Button label="Back to assessments" onPress={() => router.back()} />
    </ScrollView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────
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

  // Load the attempt. A finished attempt (or ?review=1) renders the result view.
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

  // Countdown; auto-submits when it hits zero.
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

  // Block the hardware back button mid-test so answers aren't lost silently.
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
      // The answer is still sent with the final submit payload.
    }
  };

  const confirmSubmit = () => {
    const answered = Object.keys(answersRef.current).length;
    const total = attempt?.questions.length || 0;
    Alert.alert(
      'Submit assessment?',
      answered < total
        ? `You have answered ${answered} of ${total}. Unanswered questions are marked wrong.`
        : 'All questions answered. Submit now?',
      [
        { text: 'Keep working', style: 'cancel' },
        { text: 'Submit', onPress: () => submit(false) },
      ],
    );
  };

  if (result) {
    return (
      <ErrorBoundary>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
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
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
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

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable
            onPress={() => Alert.alert('Leave the assessment?', 'Your attempt stays open and the timer keeps running.', [
              { text: 'Stay', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => router.back() },
            ])}
            testID="back-btn"
            accessibilityLabel="Go back"
          >
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{attempt.assessment.title}</Text>
          <View style={[styles.timer, urgent && styles.timerUrgent]}>
            <Clock size={13} color={urgent ? '#fff' : theme.colors.brandPrimary} />
            <Text style={[styles.timerText, urgent && { color: '#fff' }]}>{formatClock(secondsLeft)}</Text>
          </View>
        </View>

        <View style={styles.progressWrap}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={styles.progressText}>Question {current + 1} of {total}</Text>
            <Text style={styles.progressText}>{answeredCount} answered</Text>
          </View>
          <ProgressBar value={answeredCount} max={total} height={5} color={theme.colors.brandPrimary} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12 }}>
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.qNumber}>
                <Text style={styles.qNumberText}>{current + 1}</Text>
              </View>
              <Text style={styles.difficultyTag}>{question.difficulty}</Text>
            </View>
            <Text style={styles.questionText}>{question.question}</Text>

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
                  <Text style={[styles.optionText, selected && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </Card>

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
                  answers[index] !== undefined && { color: '#fff' },
                  current === index && { color: '#fff' },
                ]}>
                  {index + 1}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

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
              label="Submit"
              icon={<Flag size={15} color="#fff" />}
              loading={submitting}
              onPress={confirmSubmit}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              label="Next question"
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
            <Text style={styles.earlySubmitText}>Submit assessment now</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  timer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill,
  },
  timerUrgent: { backgroundColor: theme.colors.error },
  timerText: { fontSize: 12, fontWeight: '800', color: theme.colors.brandPrimary },

  progressWrap: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  progressText: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },

  qNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  qNumberText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  difficultyTag: { fontSize: 10, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText: { flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.onSurface, lineHeight: 22 },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: theme.radius.md,
    borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  optionSelected: { borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandTertiary },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: theme.colors.brandPrimary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.brandPrimary },
  optionText: { flex: 1, fontSize: 14, color: theme.colors.onSurface, lineHeight: 20 },

  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  gridCell: {
    width: 36, height: 36, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSecondary,
  },
  gridCellAnswered: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  gridCellCurrent: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  gridCellText: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },

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
  earlySubmit: { alignItems: 'center', paddingBottom: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary },
  earlySubmitText: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },

  resultHero: { borderRadius: theme.radius.xl, padding: theme.spacing.xxl, alignItems: 'center', gap: 4 },
  resultScore: { fontSize: 48, fontWeight: '900', color: '#fff' },
  resultLabel: { fontSize: 17, fontWeight: '800', color: '#fff' },
  resultMeta: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  certCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  certTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  certSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },

  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  skillName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  skillLevel: { fontSize: 12, fontWeight: '800' },
  diffLabel: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600', textTransform: 'capitalize' },
  diffValue: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  linkText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  perfectText: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },

  reviewOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: 10, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  reviewCorrect: { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  reviewWrong: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  reviewOptionText: { flex: 1, fontSize: 13, color: theme.colors.onSurface, lineHeight: 18 },
  tagCorrect: { fontSize: 9, fontWeight: '800', color: '#059669' },
  tagWrong: { fontSize: 9, fontWeight: '800', color: '#DC2626' },
  skippedText: { fontSize: 11, color: theme.colors.warning, fontWeight: '600' },
});
