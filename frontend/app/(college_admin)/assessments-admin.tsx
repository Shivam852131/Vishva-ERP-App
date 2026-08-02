import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen, Plus, X, Search, Clock, BarChart3,
  CheckCircle, Trophy, Target, TrendingUp, Trash2,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, SectionTitle, ProgressBar, ProgressRing, EmptyState, ChipBtn } from '@/src/ui';

const DIFF_COLORS: Record<string, string> = { easy: '#10B981', medium: '#F59E0B', hard: '#EF4444' };

export default function AssessmentsAdmin() {
  const { data: assessments = [], loading, refresh } = useFetch<any[]>('/assessments');
  const { data: history = [] } = useFetch<any[]>('/assessments/history');
  const { data: leaderboard = [] } = useFetch<any[]>('/assessments/leaderboard');
  const { data: catalog = [] } = useFetch<any[]>('/skills/catalog');
  const { mutate: createAssessment } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'catalog' | 'results' | 'leaderboard' | 'analytics'>('catalog');
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', skill_key: '', category: '', duration_minutes: '30', total_questions: '10', pass_score: '60', difficulty: 'medium' });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refresh]);

  const filtered = useMemo(() => {
    let list = assessments;
    if (filter !== 'all') list = list.filter((a: any) => a.difficulty === filter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter((a: any) => a.title?.toLowerCase().includes(q) || a.skill_name?.toLowerCase().includes(q));
    }
    return list;
  }, [assessments, filter, searchQ]);

  const stats = useMemo(() => {
    const total = assessments.length;
    const totalAttempts = history.length;
    const passed = history.filter((h: any) => h.passed).length;
    const avgScore = totalAttempts > 0 ? Math.round(history.reduce((s: number, h: any) => s + h.score_percent, 0) / totalAttempts) : 0;
    return { total, totalAttempts, passed, avgScore };
  }, [assessments, history]);

  const saveAssessment = async () => {
    if (!form.title.trim()) { setFormErr('Title is required'); return; }
    setFormErr('');
    setSaving(true);
    try {
      await createAssessment('/assessments', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          duration_minutes: parseInt(form.duration_minutes) || 30,
          total_questions: parseInt(form.total_questions) || 10,
          pass_score: parseInt(form.pass_score) || 60,
        }),
      });
      setCreateModal(false);
      refresh();
    } catch (e: any) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const tabs = [
    { key: 'catalog', label: 'Catalog', icon: <BookOpen size={14} /> },
    { key: 'results', label: 'Results', icon: <CheckCircle size={14} /> },
    { key: 'leaderboard', label: 'Leaderboard', icon: <Trophy size={14} /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={14} /> },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.h1}>Assessments</Text>
                <Text style={styles.sub}>Manage quizzes, track student performance</Text>
              </View>
              <Pressable onPress={() => setCreateModal(true)} style={styles.iconBtn}>
                <Plus color={theme.colors.brand} size={20} />
              </Pressable>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statMini}>
                <Text style={styles.statMiniVal}>{stats.total}</Text>
                <Text style={styles.statMiniLabel}>Assessments</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={styles.statMiniVal}>{stats.totalAttempts}</Text>
                <Text style={styles.statMiniLabel}>Attempts</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniVal, { color: '#10B981' }]}>{stats.passed}</Text>
                <Text style={styles.statMiniLabel}>Passed</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniVal, { color: '#3B82F6' }]}>{stats.avgScore}%</Text>
                <Text style={styles.statMiniLabel}>Avg Score</Text>
              </View>
            </View>

            <View style={styles.tabBar}>
              {tabs.map(t => (
                <Pressable key={t.key} onPress={() => setTab(t.key as any)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
                  {t.icon}
                  <Text style={[styles.tabTxt, tab === t.key && styles.tabTxtActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Catalog Tab */}
          {tab === 'catalog' && (
            <View style={{ padding: theme.spacing.lg }}>
              <View style={styles.searchBox}>
                <Search size={16} color={theme.colors.muted} />
                <TextInput value={searchQ} onChangeText={setSearchQ} placeholder="Search assessments..." placeholderTextColor={theme.colors.muted} style={styles.searchInput} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {['all', 'easy', 'medium', 'hard'].map(f => (
                  <ChipBtn key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} />
                ))}
              </ScrollView>
              {loading ? (
                <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 20 }} />
              ) : filtered.length === 0 ? (
                <EmptyState title="No assessments" sub="Create an assessment to get started" />
              ) : (
                filtered.map((a: any) => (
                  <Pressable key={a.id} onPress={() => setSelected(a)}>
                    <Card style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.assessTitle} numberOfLines={1}>{a.title}</Text>
                          <Text style={styles.assessMeta} numberOfLines={1}>{a.skill_name} · {a.total_questions} questions</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            <View style={[styles.diffBadge, { backgroundColor: (DIFF_COLORS[a.difficulty] || '#6B7280') + '15' }]}>
                              <Text style={[styles.diffBadgeTxt, { color: DIFF_COLORS[a.difficulty] || '#6B7280' }]}>{a.difficulty}</Text>
                            </View>
                            <View style={styles.metaTag}>
                              <Clock size={10} color={theme.colors.muted} />
                              <Text style={styles.metaTagTxt}>{a.duration_minutes}m</Text>
                            </View>
                            <View style={styles.metaTag}>
                              <Target size={10} color={theme.colors.muted} />
                              <Text style={styles.metaTagTxt}>{a.pass_score}% pass</Text>
                            </View>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          {a.passed && <CheckCircle size={16} color="#10B981" />}
                          <Text style={styles.attemptsTxt}>{a.attempts || 0} attempts</Text>
                          {a.best_score !== null && <Text style={styles.bestTxt}>Best: {a.best_score}%</Text>}
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* Results Tab */}
          {tab === 'results' && (
            <View style={{ padding: theme.spacing.lg }}>
              <SectionTitle title="Recent Results" />
              {history.length === 0 ? (
                <EmptyState title="No results yet" sub="Students haven't attempted any assessments" />
              ) : (
                history.map((h: any) => (
                  <Card key={h.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultTitle}>{h.assessment_title}</Text>
                        <Text style={styles.resultMeta}>{new Date(h.submitted_at).toLocaleDateString()}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.resultScore, { color: h.passed ? '#10B981' : '#EF4444' }]}>{h.score_percent}%</Text>
                        <Text style={styles.resultDetail}>{h.correct}/{h.total}</Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* Leaderboard Tab */}
          {tab === 'leaderboard' && (
            <View style={{ padding: theme.spacing.lg }}>
              <SectionTitle title="Top Performers" />
              {leaderboard.length === 0 ? (
                <EmptyState title="No leaderboard data" sub="Complete assessments to appear here" />
              ) : (
                leaderboard.map((l: any) => (
                  <Card key={l.student_id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.rankBadge, { backgroundColor: l.rank <= 3 ? '#F59E0B' : theme.colors.surfaceTertiary }]}>
                        <Text style={[styles.rankTxt, { color: l.rank <= 3 ? '#fff' : theme.colors.onSurface }]}>#{l.rank}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leaderName}>{l.student_name}</Text>
                        <Text style={styles.leaderMeta}>{l.attempts} attempts · {l.passed} passed</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.leaderBest}>{l.best_score}%</Text>
                        <Text style={styles.leaderAvg}>avg {l.average_score}%</Text>
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* Analytics Tab */}
          {tab === 'analytics' && (
            <View style={{ padding: theme.spacing.lg }}>
              <SectionTitle title="Performance Overview" />
              <Card style={{ marginBottom: 12, alignItems: 'center' }}>
                <ProgressRing percentage={stats.avgScore} size={90} label="Average Score" />
              </Card>
              <View style={styles.statsGrid}>
                <Card style={styles.statsGridItem}>
                  <Text style={[styles.statsGridVal, { color: '#10B981' }]}>{stats.passed}</Text>
                  <Text style={styles.statsGridLabel}>Passed</Text>
                </Card>
                <Card style={styles.statsGridItem}>
                  <Text style={[styles.statsGridVal, { color: '#EF4444' }]}>{stats.totalAttempts - stats.passed}</Text>
                  <Text style={styles.statsGridLabel}>Failed</Text>
                </Card>
              </View>

              <SectionTitle title="By Difficulty" />
              {['easy', 'medium', 'hard'].map(d => {
                const count = assessments.filter((a: any) => a.difficulty === d).length;
                return (
                  <View key={d} style={styles.diffRow}>
                    <View style={[styles.diffDot, { backgroundColor: DIFF_COLORS[d] }]} />
                    <Text style={styles.diffLabel}>{d.charAt(0).toUpperCase() + d.slice(1)}</Text>
                    <View style={{ flex: 1, marginHorizontal: 12 }}>
                      <ProgressBar value={count} max={Math.max(assessments.length, 1)} height={6} color={DIFF_COLORS[d]} />
                    </View>
                    <Text style={styles.diffCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* FAB */}
        {tab === 'catalog' && (
          <Pressable onPress={() => setCreateModal(true)} style={styles.fab}>
            <Plus color="#fff" size={26} />
          </Pressable>
        )}

        {/* Create Modal */}
        <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Create Assessment</Text>
                <Pressable onPress={() => setCreateModal(false)}><X color={theme.colors.muted} size={22} /></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Title *</Text>
                <TextInput value={form.title} onChangeText={v => setForm(p => ({ ...p, title: v }))} placeholder="e.g. Data Structures Quiz" placeholderTextColor={theme.colors.muted} style={styles.input} />
                <Text style={styles.label}>Description</Text>
                <TextInput value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="Brief description..." placeholderTextColor={theme.colors.muted} style={styles.input} />
                <Text style={styles.label}>Skill</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                  {(catalog as any[]).slice(0, 10).map((s: any) => (
                    <Pressable key={s.skill_key} onPress={() => setForm(p => ({ ...p, skill_key: s.skill_key }))} style={[styles.chip, form.skill_key === s.skill_key && styles.chipActive]}>
                      <Text style={[styles.chipTxt, form.skill_key === s.skill_key && styles.chipTxtActive]}>{s.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Duration (min)</Text>
                    <TextInput value={form.duration_minutes} onChangeText={v => setForm(p => ({ ...p, duration_minutes: v }))} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Questions</Text>
                    <TextInput value={form.total_questions} onChangeText={v => setForm(p => ({ ...p, total_questions: v }))} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Pass %</Text>
                    <TextInput value={form.pass_score} onChangeText={v => setForm(p => ({ ...p, pass_score: v }))} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>
                <Text style={styles.label}>Difficulty</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['easy', 'medium', 'hard'].map(d => (
                    <Pressable key={d} onPress={() => setForm(p => ({ ...p, difficulty: d }))} style={[styles.chip, form.difficulty === d && { backgroundColor: DIFF_COLORS[d] }]}>
                      <Text style={[styles.chipTxt, form.difficulty === d && { color: '#fff' }]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                {formErr ? <Text style={styles.err}>{formErr}</Text> : null}
                <Pressable onPress={saveAssessment} disabled={saving} style={styles.cta}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Create Assessment</Text>}
                </Pressable>
                <View style={{ height: 30 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Detail Modal */}
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              {selected && (
                <ScrollView>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{selected.title}</Text>
                    <Pressable onPress={() => setSelected(null)}><X color={theme.colors.muted} size={22} /></Pressable>
                  </View>
                  <Text style={styles.detailDesc}>{selected.description}</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Skill</Text>
                    <Text style={styles.detailVal}>{selected.skill_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Difficulty</Text>
                    <View style={[styles.diffBadge, { backgroundColor: (DIFF_COLORS[selected.difficulty] || '#6B7280') + '15' }]}>
                      <Text style={[styles.diffBadgeTxt, { color: DIFF_COLORS[selected.difficulty] || '#6B7280' }]}>{selected.difficulty}</Text>
                    </View>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Duration</Text>
                    <Text style={styles.detailVal}>{selected.duration_minutes} minutes</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Questions</Text>
                    <Text style={styles.detailVal}>{selected.total_questions}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Pass Score</Text>
                    <Text style={styles.detailVal}>{selected.pass_score}%</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Total Attempts</Text>
                    <Text style={styles.detailVal}>{selected.attempts || 0}</Text>
                  </View>
                  {selected.best_score !== null && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailKey}>Best Score</Text>
                      <Text style={[styles.detailVal, { color: selected.passed ? '#10B981' : '#EF4444' }]}>{selected.best_score}%</Text>
                    </View>
                  )}
                  <View style={{ height: 30 }} />
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  statMini: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  statMiniVal: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  statMiniLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabTxtActive: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface },
  assessTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  assessMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  diffBadgeTxt: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  metaTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTagTxt: { fontSize: 10, color: theme.colors.muted },
  attemptsTxt: { fontSize: 11, color: theme.colors.muted },
  bestTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.brandPrimary },
  resultTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  resultMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  resultScore: { fontSize: 18, fontWeight: '800' },
  resultDetail: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  rankBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankTxt: { fontSize: 12, fontWeight: '800' },
  leaderName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  leaderMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  leaderBest: { fontSize: 16, fontWeight: '800', color: theme.colors.brandPrimary },
  leaderAvg: { fontSize: 10, color: theme.colors.muted },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statsGridItem: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md },
  statsGridVal: { fontSize: 24, fontWeight: '800' },
  statsGridLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
  diffRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  diffDot: { width: 10, height: 10, borderRadius: 5 },
  diffLabel: { minWidth: 60, fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  diffCount: { minWidth: 30, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, fontSize: 14, color: theme.colors.onSurface },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brandPrimary },
  chipTxt: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  chipTxtActive: { color: theme.colors.brand },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  detailDesc: { fontSize: 13, color: theme.colors.muted, lineHeight: 20, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  detailKey: { fontSize: 13, color: theme.colors.muted },
  detailVal: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
});
