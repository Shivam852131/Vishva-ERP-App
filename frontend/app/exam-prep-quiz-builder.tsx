/**
 * exam-prep-quiz-builder.tsx
 * Faculty/Admin — Quiz Builder: select questions, configure, schedule, publish
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, Switch, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Plus, Check, Minus, Clock, Award, Users,
  Calendar, Eye, Save, Send, BarChart2, Play, ChevronRight,
  CheckSquare, Square, Filter, Search,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { QuestionBankItem, ExamPrepQuiz, QuizAnalytics, EducationLevel, QuizStatus } from '@/src/types';
import { theme } from '@/src/theme';
import Animated, { FadeInDown } from 'react-native-reanimated';

const TABS = ['Questions', 'Configure', 'Schedule', 'Analytics'] as const;
type Tab = typeof TABS[number];

function diffColor(d: string) {
  return d === 'easy' ? '#10B981' : d === 'hard' ? '#EF4444' : '#F59E0B';
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Split an ISO instant into *local* date and time parts for the inputs. */
function splitLocal(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

/**
 * Join the date/time inputs into an ISO instant, or null when either half is
 * missing. A half-filled window is stored but never enforced by the server,
 * so the UI treats it as "unset" rather than silently doing nothing.
 */
function joinLocal(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Local YYYY-MM-DD / HH:MM for an instant `offsetMs` from now. */
function localParts(offsetMs: number): { date: string; time: string } {
  const d = new Date(Date.now() + offsetMs);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function SelectableQuestion({ item, selected, onToggle }: {
  item: QuestionBankItem; selected: boolean; onToggle: () => void;
}) {
  return (
    <Pressable style={[styles.qRow, selected && styles.qRowSelected]} onPress={onToggle}>
      {selected ? <CheckSquare size={18} color={theme.colors.brand} /> : <Square size={18} color={theme.colors.textSecondary} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.qText} numberOfLines={2}>{item.question}</Text>
        <View style={styles.qMeta}>
          {item.subject ? <Text style={styles.qSubject}>{item.subject}</Text> : null}
          <Text style={[styles.qDiff, { color: diffColor(item.difficulty) }]}>{item.difficulty}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Date + time pair with quick presets — replaces hand-typed ISO strings. */
function WindowField({ label, hint, date, time, onDate, onTime, presets }: {
  label: string;
  hint: string;
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  presets: { label: string; run: () => void }[];
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.dtRow}>
        <TextInput
          style={[styles.input, styles.dtDate]}
          value={date}
          onChangeText={onDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textSecondary}
        />
        <TextInput
          style={[styles.input, styles.dtTime]}
          value={time}
          onChangeText={onTime}
          placeholder="HH:MM"
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>
      <View style={styles.presetRow}>
        {presets.map(p => (
          <Pressable key={p.label} style={styles.presetChip} onPress={p.run}>
            <Text style={styles.presetText}>{p.label}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.presetChip, styles.presetClear]} onPress={() => { onDate(''); onTime(''); }}>
          <Text style={[styles.presetText, { color: '#DC2626' }]}>Clear</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

export default function ExamPrepQuizBuilderScreen() {
  const params = useLocalSearchParams<{ quizId?: string }>();
  const editQuizId = params?.quizId;

  const { data: questions, loading: qLoading } = useFetch<QuestionBankItem[]>('/exam-prep/questions?limit=200');
  const { data: existingQuiz } = useFetch<ExamPrepQuiz>(editQuizId ? `/exam-prep/quizzes/${editQuizId}` : null);
  const { data: analytics } = useFetch<QuizAnalytics>(editQuizId ? `/exam-prep/quizzes/${editQuizId}/analytics` : null);

  const [activeTab, setActiveTab] = useState<Tab>('Questions');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQ, setSearchQ] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  // Config
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState('30');
  const [passScore, setPassScore] = useState('60');
  const [maxAttempts, setMaxAttempts] = useState('');
  const [isPractice, setIsPractice] = useState(false);
  const [shuffleQ, setShuffleQ] = useState(true);
  const [shuffleOpts, setShuffleOpts] = useState(true);

  // Schedule — split into date and time so the field is editable without
  // hand-typing an ISO string.
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [status, setStatus] = useState<QuizStatus>('draft');

  const [saving, setSaving] = useState(false);

  // Editing a quiz must start from its stored values — previously this screen
  // fetched existingQuiz and then never read it, so saving an edit wiped the
  // title, settings and question selection.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (!existingQuiz || prefilledRef.current) return;
    prefilledRef.current = true;

    setTitle(existingQuiz.title ?? '');
    setDescription(existingQuiz.description ?? '');
    setSubject(existingQuiz.subject ?? '');
    setDuration(String(existingQuiz.duration_minutes ?? 30));
    setPassScore(String(existingQuiz.pass_score ?? 60));
    setMaxAttempts(existingQuiz.max_attempts != null ? String(existingQuiz.max_attempts) : '');
    setIsPractice(Boolean(existingQuiz.is_practice));
    setShuffleQ(existingQuiz.shuffle_questions !== false);
    setShuffleOpts(existingQuiz.shuffle_options !== false);
    setStatus(existingQuiz.status ?? 'draft');
    setSelectedIds(new Set(existingQuiz.question_ids || []));

    const s = splitLocal(existingQuiz.window_start);
    const e = splitLocal(existingQuiz.window_end);
    setStartDate(s.date); setStartTime(s.time);
    setEndDate(e.date); setEndTime(e.time);
  }, [existingQuiz]);

  const filteredQuestions = useMemo(() => {
    return (questions || []).filter(q => {
      if (subjectFilter && q.subject !== subjectFilter) return false;
      if (searchQ && !q.question.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    });
  }, [questions, subjectFilter, searchQ]);

  const subjects = useMemo(() => {
    const s = new Set<string>();
    (questions || []).forEach(q => { if (q.subject) s.add(q.subject); });
    return Array.from(s);
  }, [questions]);

  const toggleQuestion = (id: string) => {
    setSelectedIds(s => {
      const ns = new Set(s);
      ns.has(id) ? ns.delete(id) : ns.add(id);
      return ns;
    });
  };

  const handleSave = async (publishNow = false) => {
    if (!title.trim()) return Alert.alert('Error', 'Quiz title is required.');
    if (selectedIds.size === 0) return Alert.alert('Error', 'Select at least one question.');

    const window_start = joinLocal(startDate, startTime);
    const window_end = joinLocal(endDate, endTime);

    // A half-filled window is never enforced server-side — make it explicit.
    if ((startDate || startTime) && (endDate || endTime) && (!window_start || !window_end)) {
      return Alert.alert('Incomplete window', 'Enter both a date and a time for the start and the end.');
    }
    if (window_start && window_end && new Date(window_end) <= new Date(window_start)) {
      return Alert.alert('Invalid window', 'The window must end after it starts.');
    }

    setSaving(true);
    try {
      const body: any = {
        title,
        description,
        subject,
        question_ids: Array.from(selectedIds),
        duration_minutes: parseInt(duration, 10) || 30,
        pass_score: parseInt(passScore, 10) || 60,
        max_attempts: maxAttempts ? parseInt(maxAttempts, 10) : null,
        is_practice: isPractice,
        shuffle_questions: shuffleQ,
        shuffle_options: shuffleOpts,
        status: publishNow ? 'published' : status,
        window_start,
        window_end,
      };

      let result: ExamPrepQuiz;
      if (editQuizId) {
        result = await api<ExamPrepQuiz>(`/exam-prep/quizzes/${editQuizId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        result = await api<ExamPrepQuiz>('/exam-prep/quizzes', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      Alert.alert(
        publishNow ? 'Published!' : 'Saved!',
        publishNow
          ? `Quiz "${result.title}" is now live for students.`
          : `Quiz "${result.title}" saved as draft.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{editQuizId ? 'Edit Quiz' : 'New Quiz'}</Text>
        <Pressable style={[styles.publishBtn, saving && { opacity: 0.5 }]} onPress={() => handleSave(true)} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Send size={14} color="#fff" />}
          <Text style={styles.publishBtnText}>Publish</Text>
        </Pressable>
      </View>

      {/* Question selection summary pill */}
      {selectedIds.size > 0 && (
        <View style={styles.selectionPill}>
          <CheckSquare size={14} color={theme.colors.brand} />
          <Text style={styles.selectionText}>{selectedIds.size} questions selected</Text>
        </View>
      )}

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── QUESTIONS TAB ── */}
      {activeTab === 'Questions' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Search size={14} color={theme.colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={searchQ}
                onChangeText={setSearchQ}
                placeholder="Search questions…"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </View>
          </View>

          {/* Subject filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
            {['', ...subjects].map(s => (
              <Pressable
                key={s || 'all'}
                style={[styles.chip, subjectFilter === s && styles.chipActive]}
                onPress={() => setSubjectFilter(s)}
              >
                <Text style={[styles.chipText, subjectFilter === s && styles.chipTextActive]}>{s || 'All'}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {qLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brand} />
          ) : (
            <FlatList
              data={filteredQuestions}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              renderItem={({ item }) => (
                <SelectableQuestion
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onToggle={() => toggleQuestion(item.id)}
                />
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, marginTop: 40 }}>
                  No questions found. Add questions to the bank first.
                </Text>
              }
            />
          )}
        </View>
      )}

      {/* ── CONFIGURE TAB ── */}
      {activeTab === 'Configure' && (
        <ScrollView contentContainerStyle={styles.configContent}>
          <TextInput style={styles.input} placeholder="Quiz Title *" value={title} onChangeText={setTitle} placeholderTextColor={theme.colors.textSecondary} />
          <TextInput style={[styles.input, styles.textArea]} placeholder="Description (optional)" value={description} onChangeText={setDescription} multiline placeholderTextColor={theme.colors.textSecondary} />
          <TextInput style={styles.input} placeholder="Subject" value={subject} onChangeText={setSubject} placeholderTextColor={theme.colors.textSecondary} />

          <View style={styles.configRow}>
            <View style={styles.configField}>
              <Text style={styles.fieldLabel}>Duration (minutes)</Text>
              <TextInput style={styles.numInput} value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholderTextColor={theme.colors.textSecondary} />
            </View>
            <View style={styles.configField}>
              <Text style={styles.fieldLabel}>Pass Score (%)</Text>
              <TextInput style={styles.numInput} value={passScore} onChangeText={setPassScore} keyboardType="number-pad" placeholderTextColor={theme.colors.textSecondary} />
            </View>
          </View>

          <View style={styles.configField}>
            <Text style={styles.fieldLabel}>Max Attempts (blank = unlimited)</Text>
            <TextInput style={styles.numInput} value={maxAttempts} onChangeText={setMaxAttempts} keyboardType="number-pad" placeholder="Unlimited" placeholderTextColor={theme.colors.textSecondary} />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Practice Mode</Text>
              <Text style={styles.switchSub}>No timer, explanations shown after each answer</Text>
            </View>
            <Switch value={isPractice} onValueChange={setIsPractice} trackColor={{ true: theme.colors.brand }} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Shuffle Questions</Text>
            <Switch value={shuffleQ} onValueChange={setShuffleQ} trackColor={{ true: theme.colors.brand }} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Shuffle Options</Text>
            <Switch value={shuffleOpts} onValueChange={setShuffleOpts} trackColor={{ true: theme.colors.brand }} />
          </View>

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={() => handleSave(false)} disabled={saving}>
            <Save size={16} color="#fff" />
            <Text style={styles.saveBtnText}>Save as Draft</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── SCHEDULE TAB ── */}
      {activeTab === 'Schedule' && (
        <ScrollView contentContainerStyle={styles.configContent}>
          <View style={styles.infoBox}>
            <Calendar size={14} color="#7C3AED" />
            <Text style={styles.infoText}>Set a window during which students can access this quiz. Leave both blank for always-available.</Text>
          </View>

          <WindowField
            label="Opens"
            hint="Students cannot start the quiz before this time."
            date={startDate} time={startTime}
            onDate={setStartDate} onTime={setStartTime}
            presets={[
              { label: 'Now', run: () => { const p = localParts(0); setStartDate(p.date); setStartTime(p.time); } },
              { label: 'In 1 hour', run: () => { const p = localParts(60 * 60 * 1000); setStartDate(p.date); setStartTime(p.time); } },
              { label: 'Tomorrow 9:00', run: () => { const p = localParts(24 * 60 * 60 * 1000); setStartDate(p.date); setStartTime('09:00'); } },
            ]}
          />

          <WindowField
            label="Closes"
            hint="After this time the quiz is no longer available."
            date={endDate} time={endTime}
            onDate={setEndDate} onTime={setEndTime}
            presets={[
              {
                label: 'Start + duration',
                run: () => {
                  if (!startDate || !startTime) return Alert.alert('Set the start first', 'Enter when the quiz opens before adding the duration.');
                  const end = new Date(new Date(`${startDate}T${startTime}`).getTime() + (parseInt(duration, 10) || 30) * 60000);
                  setEndDate(`${end.getFullYear()}-${pad2(end.getMonth() + 1)}-${pad2(end.getDate())}`);
                  setEndTime(`${pad2(end.getHours())}:${pad2(end.getMinutes())}`);
                },
              },
              { label: 'End of tomorrow', run: () => { const p = localParts(48 * 60 * 60 * 1000); setEndDate(p.date); setEndTime('23:59'); } },
            ]}
          />

          {(startDate || endDate) && (
            <View style={styles.windowSummary}>
              <Clock size={13} color={theme.colors.textSecondary} />
              <Text style={styles.windowSummaryText}>
                {startDate && startTime ? `Opens ${startDate} ${startTime}` : 'Opens immediately'}
                {'  →  '}
                {endDate && endTime ? `closes ${endDate} ${endTime}` : 'never closes'}
              </Text>
            </View>
          )}

          <Text style={styles.fieldLabel}>Status</Text>
          <View style={styles.chipRow}>
            {(['draft', 'published', 'closed'] as const).map(s => (
              <Pressable key={s} style={[styles.chip, status === s && styles.chipActive]} onPress={() => setStatus(s)}>
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={[styles.publishBtnFull, saving && { opacity: 0.5 }]} onPress={() => handleSave(true)} disabled={saving}>
            <Send size={16} color="#fff" />
            <Text style={styles.saveBtnText}>Save & Publish</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'Analytics' && (
        <ScrollView contentContainerStyle={styles.configContent}>
          {!editQuizId ? (
            <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
              Save the quiz first to see analytics.
            </Text>
          ) : !analytics ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brand} />
          ) : (
            <>
              <Text style={styles.analyticsTitle}>{analytics.quiz.title}</Text>
              <View style={styles.analyticsGrid}>
                {[
                  { label: 'Total Attempts', value: analytics.stats.total_attempts, color: '#4F46E5' },
                  { label: 'Pass Rate', value: `${analytics.stats.pass_rate}%`, color: '#059669' },
                  { label: 'Average Score', value: `${analytics.stats.average_score}%`, color: '#D97706' },
                  { label: 'Highest Score', value: `${analytics.stats.highest_score}%`, color: '#7C3AED' },
                ].map(({ label, value, color }) => (
                  <View key={label} style={[styles.analyticsCard, { borderTopColor: color }]}>
                    <Text style={[styles.analyticsValue, { color }]}>{value}</Text>
                    <Text style={styles.analyticsLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Score Distribution</Text>
              {analytics.distribution.map(d => (
                <View key={d.range} style={styles.distRow}>
                  <Text style={styles.distRange}>{d.range}%</Text>
                  <View style={styles.distBarTrack}>
                    <View style={[styles.distBarFill, { width: `${Math.min(100, (d.count / Math.max(1, analytics.stats.total_attempts)) * 100)}%` }]} />
                  </View>
                  <Text style={styles.distCount}>{d.count}</Text>
                </View>
              ))}

              <Text style={styles.sectionLabel}>Top Students</Text>
              {analytics.top_students.map((s, i) => (
                <View key={i} style={styles.topRow}>
                  <Text style={styles.topRank}>#{s.rank}</Text>
                  <Text style={styles.topName}>{s.student_name}</Text>
                  <Text style={[styles.topScore, { color: s.score >= 60 ? '#059669' : '#EF4444' }]}>{s.score}%</Text>
                  <View style={[styles.topBadge, { backgroundColor: s.passed ? '#DCFCE7' : '#FEE2E2' }]}>
                    <Text style={[styles.topBadgeText, { color: s.passed ? '#059669' : '#DC2626' }]}>
                      {s.passed ? 'Pass' : 'Fail'}
                    </Text>
                  </View>
                </View>
              ))}
              {analytics.attempts && analytics.attempts.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>All Attempts ({analytics.attempts.length})</Text>
                  <View style={styles.attHead}>
                    <Text style={[styles.attCell, styles.attName]}>Student</Text>
                    <Text style={styles.attCell}>Score</Text>
                    <Text style={styles.attCell}>Correct</Text>
                    <Text style={styles.attCell}>Time</Text>
                    <Text style={styles.attCell}>Date</Text>
                  </View>
                  {analytics.attempts.map(a => (
                    <View key={a.attempt_id} style={styles.attRow}>
                      <Text style={[styles.attCell, styles.attName]} numberOfLines={1}>{a.student_name}</Text>
                      <Text style={[styles.attCell, { fontWeight: '700', color: a.passed ? '#059669' : '#EF4444' }]}>
                        {a.score}%
                      </Text>
                      <Text style={styles.attCell}>{a.correct}/{a.total}</Text>
                      <Text style={styles.attCell}>
                        {Math.floor(a.time_taken_seconds / 60)}m{a.time_taken_seconds % 60}s
                      </Text>
                      <Text style={styles.attCell}>
                        {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : '—'}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 10 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.colors.text },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  publishBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  selectionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#EFF6FF', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  selectionText: { fontSize: 13, fontWeight: '600', color: theme.colors.brand },

  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.brand },
  tabText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.brand },

  searchRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text },
  subjectScroll: { paddingHorizontal: 12, marginBottom: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, marginRight: 6, backgroundColor: theme.colors.bg },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },

  qRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  qRowSelected: { borderColor: theme.colors.brand, backgroundColor: '#EFF6FF' },
  qText: { fontSize: 13, fontWeight: '500', color: theme.colors.text, lineHeight: 18 },
  qMeta: { flexDirection: 'row', gap: 8, marginTop: 4 },
  qSubject: { fontSize: 11, color: theme.colors.textSecondary },
  qDiff: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },

  configContent: { padding: 16, gap: 14, paddingBottom: 32 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.surface },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  configRow: { flexDirection: 'row', gap: 12 },
  configField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },

  // Schedule window inputs
  fieldGroup: { gap: 8 },
  dtRow: { flexDirection: 'row', gap: 8 },
  dtDate: { flex: 2 },
  dtTime: { flex: 1, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.brand, backgroundColor: '#EFF6FF' },
  presetClear: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  presetText: { fontSize: 11, fontWeight: '600', color: theme.colors.brand },
  hint: { fontSize: 11, color: theme.colors.textSecondary, lineHeight: 15 },
  windowSummary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  windowSummaryText: { flex: 1, fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },
  numInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.text, backgroundColor: theme.colors.surface, textAlign: 'center', fontWeight: '700' },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  switchLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text },
  switchSub: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveBtn: { backgroundColor: theme.colors.brand, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  publishBtnFull: { backgroundColor: '#059669', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#F5F3FF', padding: 12, borderRadius: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, color: '#5B21B6', lineHeight: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 8, marginBottom: 8 },

  // Analytics
  analyticsTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 16 },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  analyticsCard: { flex: 1, minWidth: '45%', backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderTopWidth: 3, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  analyticsValue: { fontSize: 22, fontWeight: '900' },
  analyticsLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '500', marginTop: 2 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  distRange: { width: 55, fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },
  distBarTrack: { flex: 1, height: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden' },
  distBarFill: { height: '100%', backgroundColor: theme.colors.brand, borderRadius: 4 },
  distCount: { width: 24, fontSize: 11, fontWeight: '700', color: theme.colors.text, textAlign: 'right' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  topRank: { width: 28, fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  topName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text },
  topScore: { fontSize: 14, fontWeight: '800' },
  topBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  topBadgeText: { fontSize: 10, fontWeight: '700' },

  // All-attempts detail table
  attHead: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  attRow: { flexDirection: 'row', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  attCell: { flex: 1, fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center' },
  attName: { flex: 1.6, textAlign: 'left', fontWeight: '600', color: theme.colors.text },
});
