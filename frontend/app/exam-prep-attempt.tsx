/**
 * exam-prep-attempt.tsx
 * Student — Timed Quiz Attempt
 * Timer enforcement, per-question autosave, secure server-side submission.
 * Works with /exam-prep/quizzes/:id/start and /exam-prep/attempts/:aid/* endpoints
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  ActivityIndicator, BackHandler, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Clock, ChevronLeft, ChevronRight, Trophy,
  CheckCircle2, XCircle, Lightbulb, AlertTriangle, Bookmark,
} from 'lucide-react-native';
import { api } from '@/src/api';
import type { ExamPrepAttemptPayload, ExamPrepResult } from '@/src/types';
import { theme } from '@/src/theme';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function scoreColor(pct: number) {
  if (pct >= 80) return '#10B981';
  if (pct >= 60) return '#F59E0B';
  return '#EF4444';
}

export default function ExamPrepAttemptScreen() {
  const params = useLocalSearchParams<{ attemptId?: string; quizId?: string }>();
  const [attempt, setAttempt] = useState<ExamPrepAttemptPayload | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamPrepResult | null>(null);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptIdRef = useRef<string>('');
  // Wall-clock deadline (epoch ms) derived once from the server's
  // seconds_remaining — the countdown recomputes from this instead of
  // decrementing a counter.
  const deadlineRef = useRef<number | null>(null);
  // Makes auto-submit idempotent: the expiry path can otherwise fire twice.
  const submittedRef = useRef(false);
  // Always points at the latest handleSubmit, so the interval — which
  // outlives many renders — never invokes a stale closure.
  const submitRef = useRef<(autoSubmit?: boolean) => Promise<void>>(async () => {});
  // Re-syncs when the app returns to the foreground.
  const [foregroundTick, setForegroundTick] = useState(0);

  // Load attempt
  useEffect(() => {
    const load = async () => {
      try {
        let data: ExamPrepAttemptPayload;
        if (params.attemptId) {
          data = await api<ExamPrepAttemptPayload>(`/exam-prep/attempts/${params.attemptId}`);
          // If already submitted, show result
          if ((data as any).score_percent !== undefined) {
            setResult(data as any);
            setLoading(false);
            return;
          }
        } else if (params.quizId) {
          data = await api<ExamPrepAttemptPayload>(`/exam-prep/quizzes/${params.quizId}/start`, { method: 'POST' });
        } else {
          throw new Error('No attempt or quiz ID provided');
        }
        setAttempt(data);
        setAnswers(data.answers || {});
        attemptIdRef.current = data.attempt_id;

        if (data.seconds_remaining !== null && data.seconds_remaining !== undefined && !data.is_practice) {
          deadlineRef.current = Date.now() + data.seconds_remaining * 1000;
          setTimeLeft(data.seconds_remaining);
        }
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to load quiz attempt');
        router.back();
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Block back navigation during active attempt
  useEffect(() => {
    if (result || !attempt) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert('Leave Exam?', 'Your progress is saved. You can resume from your dashboard.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => router.back() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [attempt, result]);

  const saveAnswer = async (questionIndex: number, optionIndex: number) => {
    if (!attemptIdRef.current) return;
    try {
      setSavingAnswer(true);
      await api(`/exam-prep/attempts/${attemptIdRef.current}/answer`, {
        method: 'POST',
        body: JSON.stringify({ index: questionIndex, optionIndex }),
      });
    } catch (e: any) {
      // Silent fail — server has the answer already or will accept on submit
      console.warn('Autosave failed:', e.message);
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleSelectOption = (optionIndex: number) => {
    setAnswers(prev => ({ ...prev, [currentIndex]: optionIndex }));
    saveAnswer(currentIndex, optionIndex);
  };

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!attemptIdRef.current || submittedRef.current) return;
    if (!autoSubmit) {
      const unanswered = (attempt?.questions.length || 0) - Object.keys(answers).length;
      if (unanswered > 0) {
        const confirmed = await new Promise(resolve =>
          Alert.alert(
            'Unanswered Questions',
            `You have ${unanswered} unanswered question(s). Submit anyway?`,
            [
              { text: 'Go Back', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Submit', style: 'destructive', onPress: () => resolve(true) },
            ]
          )
        );
        if (!confirmed) return;
      }
    }

    if (timerRef.current) clearInterval(timerRef.current);
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await api<ExamPrepResult>(`/exam-prep/attempts/${attemptIdRef.current}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setResult(res);
    } catch (e: any) {
      // Re-arm so the student can retry — a network blip must not strand a
      // finished attempt in a permanently "submitting" state.
      submittedRef.current = false;
      Alert.alert('Submit Error', e.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [answers, attempt]);

  // Declared ahead of the timer effect so React runs it first each commit —
  // the interval must never reach a first tick through the initial no-op ref.
  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

  // Timer countdown — driven by a wall-clock deadline, not a decremented
  // counter. React Native suspends JS timers while backgrounded, so a counter
  // resumes at the value it had before suspension and shows the student time
  // they do not have. Recomputing from the deadline is correct the instant the
  // app becomes usable again, with no network round-trip.
  useEffect(() => {
    if (deadlineRef.current === null || result) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current! - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        // Fire outside the state updater above — an updater must stay pure and
        // may legitimately be invoked more than once.
        if (!submittedRef.current) void submitRef.current(true);
      }
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [attempt, result, foregroundTick]);

  // Foregrounding has to do more than resume the countdown: the server may
  // already have graded the attempt (window closed, or it was submitted from
  // another device) while the app was away.
  useEffect(() => {
    if (!attempt || result) return;
    // Guarded: RN's AppState mock in tests doesn't always implement addEventListener.
    const sub = AppState.addEventListener?.('change', state => {
      if (state !== 'active') return;
      setForegroundTick(t => t + 1);
      if (!attemptIdRef.current || submittedRef.current) return;

      api<any>(`/exam-prep/attempts/${attemptIdRef.current}`)
        .then(data => {
          if (!data || submittedRef.current) return;
          if (data.score_percent !== undefined) {
            submittedRef.current = true;
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            setResult(data as ExamPrepResult);
          } else if (typeof data.seconds_remaining === 'number' && !data.is_practice) {
            deadlineRef.current = Date.now() + data.seconds_remaining * 1000;
          }
        })
        .catch(() => { /* Offline — the local deadline still counts down. */ });
    });
    return () => sub?.remove?.();
  }, [attempt, result]);

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
        <Text style={styles.loadingText}>Loading quiz…</Text>
      </SafeAreaView>
    );
  }

  // ── Result screen ──
  if (result) {
    const pct = result.score_percent;
    const color = scoreColor(pct);
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.resultHeader, { backgroundColor: result.passed ? '#059669' : '#DC2626' }]}>
          <Text style={styles.resultHeaderTitle}>{result.passed ? '🎉 Congratulations!' : 'Keep Practicing!'}</Text>
          <Text style={styles.resultHeaderSub}>{result.quiz.title}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.resultContent}>
          <Animated.View entering={ZoomIn} style={styles.scoreCard}>
            <Text style={[styles.scoreNum, { color }]}>{pct}%</Text>
            <Text style={styles.scoreSub}>{result.correct}/{result.total} correct</Text>
            <Text style={styles.scoreTime}>
              Time: {Math.floor(result.time_taken_seconds / 60)}m {result.time_taken_seconds % 60}s
            </Text>
            <View style={[styles.passBadge, { backgroundColor: result.passed ? '#DCFCE7' : '#FEE2E2' }]}>
              <Text style={[styles.passBadgeText, { color: result.passed ? '#059669' : '#DC2626' }]}>
                {result.passed ? 'PASSED' : 'FAILED'} · Pass mark: {result.quiz.pass_score}%
              </Text>
            </View>
          </Animated.View>

          {/* The server graded this on autosaves after the window closed — the
              student needs to know the score is not from a hand-finished run. */}
          {result.expired && (
            <View style={styles.expiredBanner}>
              <Clock size={14} color="#92400E" />
              <Text style={styles.expiredText}>
                Time ran out before you submitted. This was graded on the answers you had saved.
              </Text>
            </View>
          )}

          {/* By difficulty */}
          {result.by_difficulty.length > 0 && (
            <>
              <Text style={styles.reviewTitle}>By Difficulty</Text>
              <View style={styles.diffGrid}>
                {result.by_difficulty.map(d => (
                  <View key={d.difficulty} style={styles.diffCard}>
                    <Text style={[styles.diffScore, { color: scoreColor(d.percent) }]}>{d.percent}%</Text>
                    <Text style={styles.diffLabel}>{d.difficulty}</Text>
                    <Text style={styles.diffSub}>{d.correct}/{d.total}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Question review */}
          <Text style={styles.reviewTitle}>Question Review</Text>
          {result.breakdown.map((item, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 30)} style={[
              styles.reviewCard,
              { borderLeftColor: item.correct ? '#10B981' : '#EF4444', borderLeftWidth: 4 },
            ]}>
              <View style={styles.reviewHeader}>
                {item.correct ? <CheckCircle2 size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
                <Text style={styles.reviewNum}>Q{i + 1}</Text>
                <Text style={[styles.reviewDiff, { color: item.difficulty === 'hard' ? '#EF4444' : item.difficulty === 'medium' ? '#F59E0B' : '#10B981' }]}>
                  {item.difficulty}
                </Text>
              </View>
              <Text style={styles.reviewQ}>{item.question}</Text>
              {!item.correct && item.selected_index !== null && (
                <Text style={styles.reviewWrong}>Your answer: {item.options[item.selected_index]}</Text>
              )}
              <Text style={styles.reviewCorrect}>✓ {item.options[item.correct_index]}</Text>
              {item.explanation ? (
                <View style={styles.expBox}>
                  <Lightbulb size={12} color="#D97706" />
                  <Text style={styles.expText}>{item.explanation}</Text>
                </View>
              ) : null}
            </Animated.View>
          ))}

          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Back to Dashboard</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Reached when the attempt could not be loaded — bad id, quiz deleted, or
  // the fetch failed. A bare `return null` leaves a blank screen with no
  // escape on platforms where the error Alert is unavailable.
  if (!attempt) {
    return (
      <SafeAreaView style={styles.loading} edges={['top']}>
        <AlertTriangle size={40} color={theme.colors.textSecondary} />
        <Text style={styles.loadingText}>This quiz could not be loaded.</Text>
        <Pressable style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const q = attempt.questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const total = attempt.questions.length;
  const progress = (currentIndex + 1) / total;
  const timerWarning = timeLeft !== null && timeLeft <= 120;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => {
          Alert.alert('Leave Exam?', 'Your answers are saved. You can resume later.', [
            { text: 'Stay', style: 'cancel' },
            { text: 'Leave', onPress: () => router.back() },
          ]);
        }}>
          <ArrowLeft size={18} color={theme.colors.text} />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.quizTitle} numberOfLines={1}>{attempt.quiz.title}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>

        {/* Timer */}
        {timeLeft !== null && !attempt.is_practice ? (
          <View style={[styles.timer, timerWarning && styles.timerWarning]}>
            <Clock size={12} color={timerWarning ? '#DC2626' : theme.colors.textSecondary} />
            <Text style={[styles.timerText, timerWarning && { color: '#DC2626' }]}>{formatTime(timeLeft)}</Text>
          </View>
        ) : null}
      </View>

      {/* Question counter */}
      <View style={styles.questionBar}>
        <Text style={styles.questionCounter}>{currentIndex + 1} / {total}</Text>
        <Text style={styles.answeredCount}>{answeredCount} answered</Text>
        {savingAnswer && <ActivityIndicator size="small" color={theme.colors.brand} style={{ marginLeft: 6 }} />}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.questionContent}>
        {/* Difficulty */}
        <View style={styles.diffBadge}>
          <Text style={[styles.diffText, {
            color: q.difficulty === 'hard' ? '#EF4444' : q.difficulty === 'medium' ? '#D97706' : '#059669',
          }]}>{q.difficulty}</Text>
        </View>

        {/* Question */}
        <Animated.Text key={currentIndex} entering={FadeIn} style={styles.qText}>{q.question}</Animated.Text>

        {/* Options */}
        {q.options.map((opt, i) => {
          const isSelected = answers[currentIndex] === i;
          return (
            <Pressable
              key={i}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => handleSelectOption(i)}
            >
              <View style={[styles.optLetter, isSelected && styles.optLetterSelected]}>
                <Text style={[styles.optLetterText, isSelected && { color: '#fff' }]}>
                  {String.fromCharCode(65 + i)}
                </Text>
              </View>
              <Text style={[styles.optText, isSelected && { color: theme.colors.brand, fontWeight: '700' }]}>
                {opt}
              </Text>
              {isSelected && <CheckCircle2 size={16} color={theme.colors.brand} />}
            </Pressable>
          );
        })}

        {/* Timer warning banner */}
        {timerWarning && timeLeft !== null && timeLeft > 0 && (
          <Animated.View entering={FadeIn} style={styles.warningBanner}>
            <AlertTriangle size={16} color="#DC2626" />
            <Text style={styles.warningText}>
              {timeLeft <= 60 ? 'Less than 1 minute remaining!' : 'Less than 2 minutes remaining!'}
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.bottomNav}>
        <Pressable
          style={[styles.navBtn, currentIndex === 0 && { opacity: 0.4 }]}
          onPress={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={18} color={theme.colors.text} />
          <Text style={styles.navBtnText}>Prev</Text>
        </Pressable>

        {currentIndex < total - 1 ? (
          <Pressable
            style={styles.nextBtn}
            onPress={() => setCurrentIndex(i => i + 1)}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <ChevronRight size={18} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={() => handleSubmit(false)}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Trophy size={14} color="#fff" /><Text style={styles.nextBtnText}>Submit Quiz</Text></>}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: theme.colors.bg },
  loadingText: { color: theme.colors.textSecondary },
  retryBtn: { marginTop: 6, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.colors.brand },
  retryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  quizTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  progressTrack: { height: 4, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.brand, borderRadius: 2 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  timerWarning: { backgroundColor: '#FEE2E2' },
  timerText: { fontSize: 13, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] },

  questionBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  questionCounter: { flex: 1, fontSize: 12, fontWeight: '700', color: theme.colors.text },
  answeredCount: { fontSize: 12, color: theme.colors.textSecondary },

  questionContent: { padding: 16, gap: 12 },
  diffBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.colors.surfaceSecondary },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  qText: { fontSize: 16, fontWeight: '600', color: theme.colors.text, lineHeight: 24 },
  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: theme.colors.border, gap: 10 },
  optionSelected: { borderColor: theme.colors.brand, backgroundColor: '#EFF6FF' },
  optLetter: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  optLetterSelected: { backgroundColor: theme.colors.brand },
  optLetterText: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary },
  optText: { flex: 1, fontSize: 14, color: theme.colors.text, lineHeight: 20 },

  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FCA5A5' },
  warningText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#DC2626' },

  bottomNav: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  navBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.brand, borderRadius: 10, paddingVertical: 12 },
  submitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Result screen
  resultHeader: { paddingHorizontal: 20, paddingVertical: 20, alignItems: 'center' },
  resultHeaderTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  resultHeaderSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  resultContent: { padding: 16, gap: 12, paddingBottom: 40 },
  scoreCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border },
  scoreNum: { fontSize: 56, fontWeight: '900' },
  scoreSub: { fontSize: 16, color: theme.colors.textSecondary, fontWeight: '600' },
  scoreTime: { fontSize: 12, color: theme.colors.textSecondary },
  passBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 4 },
  passBadgeText: { fontSize: 13, fontWeight: '700' },
  expiredBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#FEF3C7',
  },
  expiredText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  diffGrid: { flexDirection: 'row', gap: 10 },
  diffCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  diffScore: { fontSize: 20, fontWeight: '800' },
  diffLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary, textTransform: 'capitalize' },
  diffSub: { fontSize: 11, color: theme.colors.textSecondary },
  reviewTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginTop: 8 },
  reviewCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  reviewNum: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  reviewDiff: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', marginLeft: 'auto' },
  reviewQ: { fontSize: 13, fontWeight: '600', color: theme.colors.text, lineHeight: 18, marginBottom: 6 },
  reviewWrong: { fontSize: 12, color: '#EF4444', marginBottom: 2 },
  reviewCorrect: { fontSize: 12, color: '#10B981', fontWeight: '600' },
  expBox: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'flex-start' },
  expText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  doneBtn: { backgroundColor: theme.colors.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
