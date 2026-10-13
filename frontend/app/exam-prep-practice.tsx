/**
 * exam-prep-practice.tsx
 * Student — Untimed Practice Session
 * One question at a time, immediate answer + explanation shown after selection.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, BookOpen, CheckCircle2, XCircle, Lightbulb,
  ChevronRight, ChevronLeft, RotateCcw, Trophy, Bookmark,
  Filter, Brain,
} from 'lucide-react-native';
import { api } from '@/src/api';
import type { PracticeSession, PracticeAnswerResult, QuestionDifficulty } from '@/src/types';
import { theme } from '@/src/theme';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

type SessionState = 'config' | 'active' | 'complete';
type AnswerState = { selected: number | null; result: PracticeAnswerResult | null };

const DIFFICULTIES: { key: QuestionDifficulty | 'mixed'; label: string }[] = [
  { key: 'mixed', label: 'Mixed' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

const COUNTS = [5, 10, 15, 20, 25];

export default function ExamPrepPracticeScreen() {
  const params = useLocalSearchParams<{ subject?: string; topic?: string }>();
  const [sessionState, setSessionState] = useState<SessionState>('config');
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [finalResult, setFinalResult] = useState<any>(null);

  // Config
  const [subject, setSubject] = useState(params.subject || '');
  const [topic, setTopic] = useState(params.topic || '');
  const [difficulty, setDifficulty] = useState<'mixed' | QuestionDifficulty>('mixed');
  const [count, setCount] = useState(10);
  const [starting, setStarting] = useState(false);

  const startSession = async () => {
    setStarting(true);
    try {
      const body: any = { count, education_level: 'college' };
      if (subject.trim()) body.subject = subject.trim();
      if (topic.trim()) body.topic = topic.trim();
      if (difficulty !== 'mixed') body.difficulty = difficulty;

      const data = await api<PracticeSession>('/exam-prep/practice/start', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setSession(data);
      setSessionId(data.session_id);
      setAnswers(data.questions.map(() => ({ selected: null, result: null })));
      setCurrentIndex(0);
      setSessionState('active');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start practice session.\nMake sure questions exist for the selected filters.');
    } finally {
      setStarting(false);
    }
  };

  const handleSelectAnswer = async (optionIndex: number) => {
    if (!session || !sessionId) return;
    if (answers[currentIndex]?.selected !== null) return; // already answered

    try {
      const result = await api<PracticeAnswerResult>(`/exam-prep/practice/${sessionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ index: currentIndex, optionIndex }),
      });
      const newAnswers = [...answers];
      newAnswers[currentIndex] = { selected: optionIndex, result };
      setAnswers(newAnswers);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to record answer');
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const result = await api(`/exam-prep/practice/${sessionId}/submit`, { method: 'POST' });
      setFinalResult(result);
      setSessionState('complete');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit session');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setSession(null);
    setSessionId('');
    setAnswers([]);
    setCurrentIndex(0);
    setFinalResult(null);
    setSessionState('config');
  };

  const q = session?.questions[currentIndex];
  const currentAnswer = answers[currentIndex];
  const answered = currentAnswer?.selected !== null;
  const result = currentAnswer?.result;
  const allAnswered = answers.every(a => a.selected !== null);

  // ── Config screen ──────────────────────────────────────────────
  if (sessionState === 'config') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#059669', '#065F46']} style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Practice Session</Text>
            <Text style={styles.headerSub}>Untimed · Immediate feedback</Text>
          </View>
          <Brain size={24} color="rgba(255,255,255,0.7)" />
        </LinearGradient>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.configContent}>
          <Animated.View entering={FadeInDown.delay(100)} style={styles.configCard}>
            <Text style={styles.configLabel}>Subject (optional)</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Mathematics, Physics, History…"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150)} style={styles.configCard}>
            <Text style={styles.configLabel}>Topic (optional)</Text>
            <TextInput
              style={styles.input}
              value={topic}
              onChangeText={setTopic}
              placeholder="e.g. Trigonometry, Thermodynamics…"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.configCard}>
            <Text style={styles.configLabel}>Difficulty</Text>
            <View style={styles.chipRow}>
              {DIFFICULTIES.map(d => (
                <Pressable
                  key={d.key}
                  style={[styles.chip, difficulty === d.key && styles.chipActive]}
                  onPress={() => setDifficulty(d.key)}
                >
                  <Text style={[styles.chipText, difficulty === d.key && styles.chipTextActive]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250)} style={styles.configCard}>
            <Text style={styles.configLabel}>Number of Questions</Text>
            <View style={styles.chipRow}>
              {COUNTS.map(c => (
                <Pressable
                  key={c}
                  style={[styles.chip, count === c && styles.chipActive]}
                  onPress={() => setCount(c)}
                >
                  <Text style={[styles.chipText, count === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300)}>
            <Pressable
              style={[styles.startBtn, starting && { opacity: 0.6 }]}
              onPress={startSession}
              disabled={starting}
            >
              {starting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <BookOpen size={18} color="#fff" />
                  <Text style={styles.startBtnText}>Start Practice</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Complete screen ────────────────────────────────────────────
  if (sessionState === 'complete' && finalResult) {
    const pct = finalResult.score_percent;
    const scoreColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#059669', '#065F46']} style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>Session Complete</Text>
        </LinearGradient>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <Animated.View entering={ZoomIn} style={styles.scoreCircle}>
            <Text style={[styles.scoreNum, { color: scoreColor }]}>{pct}%</Text>
            <Text style={styles.scoreSub}>{finalResult.correct}/{finalResult.total} correct</Text>
          </Animated.View>

          <Text style={styles.reviewTitle}>Question Review</Text>
          {finalResult.breakdown?.map((item: any, i: number) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 40)} style={[
              styles.reviewCard,
              { borderLeftColor: item.correct ? '#10B981' : '#EF4444', borderLeftWidth: 4 },
            ]}>
              <View style={styles.reviewHeader}>
                {item.correct
                  ? <CheckCircle2 size={14} color="#10B981" />
                  : <XCircle size={14} color="#EF4444" />}
                <Text style={styles.reviewQNum}>Q{i + 1}</Text>
                <Text style={[styles.reviewDiff, { color: item.difficulty === 'hard' ? '#EF4444' : item.difficulty === 'medium' ? '#F59E0B' : '#10B981' }]}>
                  {item.difficulty}
                </Text>
              </View>
              <Text style={styles.reviewQuestion}>{item.question}</Text>
              {!item.correct && item.selected_index !== null && (
                <Text style={styles.reviewWrong}>Your answer: {item.options[item.selected_index]}</Text>
              )}
              <Text style={styles.reviewCorrect}>✓ {item.options[item.correct_index]}</Text>
              {item.explanation ? (
                <View style={styles.explanationBox}>
                  <Lightbulb size={12} color="#D97706" />
                  <Text style={styles.explanationText}>{item.explanation}</Text>
                </View>
              ) : null}
            </Animated.View>
          ))}

          <View style={styles.resultActions}>
            <Pressable style={styles.resetBtn} onPress={resetAll}>
              <RotateCcw size={16} color={theme.colors.brand} />
              <Text style={styles.resetBtnText}>Practice Again</Text>
            </Pressable>
            <Pressable style={styles.dashBtn} onPress={() => router.back()}>
              <Text style={styles.dashBtnText}>Back to Dashboard</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Active session ────────────────────────────────────────────
  if (!q) return null;
  const progress = (currentIndex + 1) / (session?.total_questions || 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.activeHeader}>
        <Pressable style={styles.backBtn2} onPress={() => {
          Alert.alert('Quit Practice?', 'Your progress will be lost.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Quit', style: 'destructive', onPress: resetAll },
          ]);
        }}>
          <ArrowLeft size={18} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {currentIndex + 1} / {session?.total_questions}
          </Text>
        </View>
        {answered && (
          <Pressable onPress={() => {
            Alert.prompt
              ? Alert.prompt('Add Bookmark Note', 'Optional note:', (note) => {
                  api('/exam-prep/bookmarks', {
                    method: 'POST',
                    body: JSON.stringify({ question_id: q.question_id, note }),
                  }).catch(() => {});
                })
              : api('/exam-prep/bookmarks', {
                  method: 'POST',
                  body: JSON.stringify({ question_id: q.question_id }),
                }).then(() => Alert.alert('Bookmarked!')).catch(() => {});
          }}>
            <Bookmark size={20} color={theme.colors.brand} />
          </Pressable>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.activeContent}>
        {/* Difficulty chip */}
        <View style={styles.diffChip}>
          <Text style={[styles.diffChipText, {
            color: q.difficulty === 'hard' ? '#EF4444' : q.difficulty === 'medium' ? '#D97706' : '#059669',
          }]}>
            {q.difficulty}
          </Text>
        </View>

        {/* Question */}
        <Animated.Text key={currentIndex} entering={FadeIn} style={styles.questionText}>
          {q.question}
        </Animated.Text>

        {/* Options */}
        {q.options.map((opt, i) => {
          let optStyle = styles.option;
          let textStyle = styles.optionText;
          let icon = null;

          if (answered) {
            if (i === result?.correct_index) {
              optStyle = { ...styles.option, ...styles.optionCorrect };
              textStyle = { ...styles.optionText, color: '#065F46' };
              icon = <CheckCircle2 size={16} color="#10B981" />;
            } else if (i === currentAnswer?.selected && !result?.correct) {
              optStyle = { ...styles.option, ...styles.optionWrong };
              textStyle = { ...styles.optionText, color: '#7F1D1D' };
              icon = <XCircle size={16} color="#EF4444" />;
            }
          }

          return (
            <Pressable
              key={i}
              style={[optStyle, currentAnswer?.selected === i && !answered && styles.optionSelected]}
              onPress={() => handleSelectAnswer(i)}
              disabled={answered}
            >
              <View style={styles.optionLetter}>
                <Text style={styles.optionLetterText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={[textStyle, { flex: 1 }]}>{opt}</Text>
              {icon}
            </Pressable>
          );
        })}

        {/* Explanation */}
        {answered && result && (
          <Animated.View entering={FadeInDown} style={[
            styles.explanationCard,
            { borderColor: result.correct ? '#10B981' : '#EF4444' },
          ]}>
            <View style={styles.explanationHeader}>
              {result.correct
                ? <CheckCircle2 size={18} color="#10B981" />
                : <XCircle size={18} color="#EF4444" />}
              <Text style={[styles.explanationResult, { color: result.correct ? '#10B981' : '#EF4444' }]}>
                {result.correct ? 'Correct!' : 'Incorrect'}
              </Text>
            </View>
            {!result.correct && (
              <Text style={styles.correctAnswer}>
                Correct answer: <Text style={{ fontWeight: '700' }}>{result.correct_option}</Text>
              </Text>
            )}
            {result.explanation ? (
              <View style={styles.explanationRow}>
                <Lightbulb size={14} color="#D97706" />
                <Text style={styles.explanationText}>{result.explanation}</Text>
              </View>
            ) : null}
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom navigation */}
      <View style={styles.bottomNav}>
        <Pressable
          style={[styles.navBtn, currentIndex === 0 && { opacity: 0.4 }]}
          onPress={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={20} color={theme.colors.text} />
          <Text style={styles.navBtnText}>Prev</Text>
        </Pressable>

        {currentIndex < (session?.total_questions || 1) - 1 ? (
          <Pressable
            style={styles.nextBtn}
            onPress={() => setCurrentIndex(i => i + 1)}
          >
            <Text style={styles.nextBtnText}>Next</Text>
            <ChevronRight size={20} color="#fff" />
          </Pressable>
        ) : (
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Trophy size={16} color="#fff" />
                  <Text style={styles.nextBtnText}>Finish & Review</Text>
                </>
            }
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  configContent: { padding: 20, gap: 16 },
  configCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  configLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 10 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.bg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },
  startBtn: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  activeHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn2: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  progressTrack: { height: 5, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#059669', borderRadius: 3 },
  progressLabel: { fontSize: 10, color: theme.colors.textSecondary, marginTop: 3, textAlign: 'right' },

  activeContent: { padding: 20, gap: 12 },
  diffChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: theme.colors.surfaceSecondary },
  diffChipText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  questionText: { fontSize: 16, fontWeight: '600', color: theme.colors.text, lineHeight: 24 },

  option: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 10, padding: 14, borderWidth: 1.5, borderColor: theme.colors.border, gap: 10 },
  optionSelected: { borderColor: theme.colors.brand, backgroundColor: '#EFF6FF' },
  optionCorrect: { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
  optionWrong: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  optionLetter: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  optionLetterText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  optionText: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },

  explanationCard: { borderRadius: 12, padding: 14, borderWidth: 2, backgroundColor: theme.colors.surface, gap: 8 },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  explanationResult: { fontSize: 15, fontWeight: '700' },
  correctAnswer: { fontSize: 13, color: theme.colors.textSecondary },
  explanationRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  explanationText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, flex: 1 },

  bottomNav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 12 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  navBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.brand, borderRadius: 10, paddingVertical: 12 },
  submitBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Complete screen
  scoreCircle: { alignItems: 'center', padding: 30, backgroundColor: theme.colors.surface, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border },
  scoreNum: { fontSize: 52, fontWeight: '900' },
  scoreSub: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  reviewTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  reviewCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  reviewQNum: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  reviewDiff: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize', marginLeft: 'auto' },
  reviewQuestion: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 6, lineHeight: 18 },
  reviewWrong: { fontSize: 12, color: '#EF4444', marginBottom: 2 },
  reviewCorrect: { fontSize: 12, color: '#10B981', fontWeight: '600' },
  explanationBox: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'flex-start' },
  resultActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  resetBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: theme.colors.brand, borderRadius: 10, paddingVertical: 12 },
  resetBtnText: { color: theme.colors.brand, fontWeight: '700', fontSize: 14 },
  dashBtn: { flex: 1, backgroundColor: theme.colors.brand, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  dashBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
