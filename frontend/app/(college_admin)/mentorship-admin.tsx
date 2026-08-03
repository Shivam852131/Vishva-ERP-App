import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users, Plus, X, Search, Star, Clock, Calendar, Target, Award,
  ChevronRight, CheckCircle, AlertTriangle, MessageSquare,
  BarChart3, Eye, UserCheck,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, SectionTitle, ProgressBar, ProgressRing, EmptyState, ChipBtn } from '@/src/ui';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B', active: '#10B981', completed: '#3B82F6', cancelled: '#EF4444',
};

export default function MentorshipAdmin() {
  const { data: mentors = [], loading: mentorsLoading, refresh: refreshMentors } = useFetch<any[]>('/mentorship/mentors');
  const { data: connections = [], refresh: refreshConn } = useFetch<any[]>('/mentorship/connections');
  const { data: sessions = [], refresh: refreshSessions } = useFetch<any[]>('/mentorship/sessions');
  const { data: goals = [], refresh: refreshGoals } = useFetch<any[]>('/mentorship/goals');
  const { data: overview } = useFetch<any>('/mentorship/overview');
  const { mutate: acceptConn } = useMutate();
  const { mutate: completeConn } = useMutate();
  const { mutate: createSession } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'mentors' | 'connections' | 'sessions'>('overview');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [bookSessionModal, setBookSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({ connectionId: '', topic: '', scheduledAt: '', agenda: '', durationMinutes: '30' });
  const [sessionSaving, setSessionSaving] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshMentors();
    refreshConn();
    refreshSessions();
    refreshGoals();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshMentors, refreshConn, refreshSessions, refreshGoals]);

  const stats = useMemo(() => ({
    totalMentors: mentors.length,
    activeMentors: (mentors as any[]).filter((m: any) => m.is_active).length,
    totalConnections: connections.length,
    pendingRequests: (connections as any[]).filter((c: any) => c.status === 'pending').length,
    activeConnections: (connections as any[]).filter((c: any) => c.status === 'active').length,
    totalSessions: sessions.length,
    completedSessions: (sessions as any[]).filter((s: any) => s.status === 'completed').length,
    totalGoals: goals.length,
    completedGoals: (goals as any[]).filter((g: any) => g.status === 'completed').length,
  }), [mentors, connections, sessions, goals]);

  const filteredConnections = useMemo(() => {
    if (filter === 'all') return connections;
    return (connections as any[]).filter((c: any) => c.status === filter);
  }, [connections, filter]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'mentors', label: 'Mentors', icon: <Users size={14} /> },
    { key: 'connections', label: 'Connections', icon: <UserCheck size={14} /> },
    { key: 'sessions', label: 'Sessions', icon: <Calendar size={14} /> },
  ];

  const acceptConnection = async (connId: string) => {
    try {
      await acceptConn(`/mentorship/connections/${connId}/accept`, { method: 'POST' });
      refreshConn();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const completeConnection = async (connId: string) => {
    try {
      await completeConn(`/mentorship/connections/${connId}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
      refreshConn();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const bookSession = async () => {
    if (!sessionForm.connectionId || !sessionForm.topic || !sessionForm.scheduledAt) {
      Alert.alert('Error', 'Connection, topic, and scheduled time are required');
      return;
    }
    setSessionSaving(true);
    try {
      await createSession('/mentorship/sessions', {
        method: 'POST',
        body: JSON.stringify({
          connectionId: sessionForm.connectionId,
          topic: sessionForm.topic,
          scheduledAt: new Date(sessionForm.scheduledAt).toISOString(),
          agenda: sessionForm.agenda,
          durationMinutes: Number(sessionForm.durationMinutes) || 30,
        }),
      });
      setBookSessionModal(false);
      setSessionForm({ connectionId: '', topic: '', scheduledAt: '', agenda: '', durationMinutes: '30' });
      refreshSessions();
      refreshConn();
      Alert.alert('Done', 'Session booked successfully');
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSessionSaving(false);
  };

  const activeConnections = useMemo(() =>
    (connections as any[]).filter((c: any) => c.status === 'active'),
    [connections]
  );

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <View>
              <Text style={styles.h1}>Mentorship</Text>
              <Text style={styles.sub}>Manage mentors, connections & sessions</Text>
            </View>
            <Pressable onPress={() => setBookSessionModal(true)} style={[styles.iconBtn, { marginTop: 12 }]}>
              <Plus color="#fff" size={16} />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Book Session</Text>
            </Pressable>

            <View style={styles.statsRow}>
              <View style={styles.statMini}>
                <Users size={14} color="#3B82F6" />
                <Text style={styles.statMiniVal}>{stats.activeMentors}</Text>
                <Text style={styles.statMiniLabel}>Mentors</Text>
              </View>
              <View style={styles.statMini}>
                <UserCheck size={14} color="#10B981" />
                <Text style={styles.statMiniVal}>{stats.activeConnections}</Text>
                <Text style={styles.statMiniLabel}>Active</Text>
              </View>
              <View style={styles.statMini}>
                <Clock size={14} color="#F59E0B" />
                <Text style={styles.statMiniVal}>{stats.pendingRequests}</Text>
                <Text style={styles.statMiniLabel}>Pending</Text>
              </View>
              <View style={styles.statMini}>
                <Calendar size={14} color="#8B5CF6" />
                <Text style={styles.statMiniVal}>{stats.completedSessions}</Text>
                <Text style={styles.statMiniLabel}>Sessions</Text>
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

          {/* Overview Tab */}
          {tab === 'overview' && (
            <View style={{ padding: theme.spacing.lg }}>
              <Card style={{ marginBottom: 12, alignItems: 'center' }}>
                <Text style={styles.cardTitle}>Mentorship Health</Text>
                <ProgressRing percentage={stats.totalConnections > 0 ? Math.round((stats.activeConnections / stats.totalConnections) * 100) : 0} size={90} label="Active Rate" />
              </Card>

              <SectionTitle title="Goals Progress" />
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={styles.goalLabel}>Total Goals</Text>
                  <Text style={styles.goalVal}>{stats.totalGoals}</Text>
                </View>
                <ProgressBar value={stats.completedGoals} max={Math.max(stats.totalGoals, 1)} label={`${stats.completedGoals} completed`} showPct />
              </Card>

              <SectionTitle title="Session Summary" />
              <View style={styles.statsGrid}>
                <Card style={styles.statsGridItem}>
                  <Text style={styles.statsGridVal}>{stats.totalSessions}</Text>
                  <Text style={styles.statsGridLabel}>Total</Text>
                </Card>
                <Card style={styles.statsGridItem}>
                  <Text style={[styles.statsGridVal, { color: '#10B981' }]}>{stats.completedSessions}</Text>
                  <Text style={styles.statsGridLabel}>Completed</Text>
                </Card>
                <Card style={styles.statsGridItem}>
                  <Text style={[styles.statsGridVal, { color: '#F59E0B' }]}>{stats.totalSessions - stats.completedSessions}</Text>
                  <Text style={styles.statsGridLabel}>Upcoming</Text>
                </Card>
              </View>
            </View>
          )}

          {/* Mentors Tab */}
          {tab === 'mentors' && (
            <View style={{ padding: theme.spacing.lg }}>
              {mentorsLoading ? (
                <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 20 }} />
              ) : mentors.length === 0 ? (
                <EmptyState title="No mentors" sub="Mentors will appear here" />
              ) : (
                (mentors as any[]).map((m: any) => (
                  <Pressable key={m.id} onPress={() => setSelected(m)}>
                    <Card style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={styles.mentorAvatar}>
                          <Text style={styles.mentorAvatarTxt}>{m.name?.[0]?.toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.mentorName}>{m.name}</Text>
                          <Text style={styles.mentorHeadline} numberOfLines={1}>{m.headline} · {m.company}</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            <View style={styles.ratingRow}>
                              <Star size={12} color="#F59E0B" fill="#F59E0B" />
                              <Text style={styles.ratingTxt}>{m.rating?.toFixed(1) || '—'}</Text>
                            </View>
                            <View style={styles.metaTag}>
                              <Text style={styles.metaTagTxt}>{m.sessions_completed || 0} sessions</Text>
                            </View>
                            <View style={[styles.statusDot, { backgroundColor: m.is_active ? '#10B981' : '#EF4444' }]} />
                          </View>
                          {m.expertise?.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                              {m.expertise.slice(0, 3).map((e: any) => (
                                <View key={e.skill_key} style={styles.skillTag}>
                                  <Text style={styles.skillTagTxt}>{e.name}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* Connections Tab */}
          {tab === 'connections' && (
            <View style={{ padding: theme.spacing.lg }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {['all', 'pending', 'active', 'completed', 'cancelled'].map(f => (
                  <ChipBtn key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} />
                ))}
              </ScrollView>
              {filteredConnections.length === 0 ? (
                <EmptyState title="No connections" sub="Connections will appear here" />
              ) : (
                (filteredConnections as any[]).map((c: any) => (
                  <Card key={c.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.connTitle}>{c.mentor_name}</Text>
                        <Text style={styles.connMeta}>Student: {c.student_name}</Text>
                        <Text style={styles.connMeta} numberOfLines={1}>Goal: {c.goal}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[c.status] || '#6B7280') + '15' }]}>
                            <Text style={[styles.statusBadgeTxt, { color: STATUS_COLORS[c.status] || '#6B7280' }]}>{c.status}</Text>
                          </View>
                          <Text style={styles.connMeta}>{c.sessions_count || 0} sessions</Text>
                        </View>
                      </View>
                      <View style={{ gap: 6 }}>
                        {c.status === 'pending' && (
                          <Pressable onPress={() => acceptConnection(c.id)} style={styles.actionBtn}>
                            <CheckCircle size={14} color="#10B981" />
                          </Pressable>
                        )}
                        {c.status === 'active' && (
                          <Pressable onPress={() => completeConnection(c.id)} style={styles.actionBtn}>
                            <Award size={14} color="#3B82F6" />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* Sessions Tab */}
          {tab === 'sessions' && (
            <View style={{ padding: theme.spacing.lg }}>
              {sessions.length === 0 ? (
                <EmptyState title="No sessions" sub="Sessions will appear here" />
              ) : (
                (sessions as any[]).map((s: any) => (
                  <Card key={s.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionTitle}>{s.topic}</Text>
                        <Text style={styles.sessionMeta} numberOfLines={1}>{s.mentor_name} → {s.student_name}</Text>
                        <Text style={styles.sessionMeta}>{new Date(s.scheduled_at).toLocaleString()}</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[s.status] || '#6B7280') + '15' }]}>
                            <Text style={[styles.statusBadgeTxt, { color: STATUS_COLORS[s.status] || '#6B7280' }]}>{s.status}</Text>
                          </View>
                          {s.rating && (
                            <View style={styles.ratingRow}>
                              <Star size={12} color="#F59E0B" fill="#F59E0B" />
                              <Text style={styles.ratingTxt}>{s.rating}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    {s.action_items?.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.actionItemsLabel}>Action Items:</Text>
                        {s.action_items.map((item: string, i: number) => (
                          <Text key={i} style={styles.actionItem}>• {item}</Text>
                        ))}
                      </View>
                    )}
                  </Card>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* Mentor Detail Modal */}
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              {selected && (
                <ScrollView>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{selected.name}</Text>
                    <Pressable onPress={() => setSelected(null)}><X color={theme.colors.muted} size={22} /></Pressable>
                  </View>
                  <Text style={styles.mentorHeadline}>{selected.headline} · {selected.company}</Text>
                  <Text style={styles.mentorBio} numberOfLines={4}>{selected.bio}</Text>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <View style={styles.ratingRow}>
                      <Star size={14} color="#F59E0B" fill="#F59E0B" />
                      <Text style={[styles.ratingTxt, { fontSize: 14 }]}>{selected.rating?.toFixed(1) || '—'}</Text>
                    </View>
                    <Text style={styles.detailMeta}>{selected.experience_years}yr exp</Text>
                    <Text style={styles.detailMeta}>{selected.sessions_completed} sessions</Text>
                  </View>

                  {selected.expertise?.length > 0 && (
                    <>
                      <Text style={[styles.label, { marginTop: 16 }]}>Expertise</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {selected.expertise.map((e: any) => (
                          <View key={e.skill_key} style={styles.skillTag}>
                            <Text style={styles.skillTagTxt}>{e.name}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {selected.reviews?.length > 0 && (
                    <>
                      <Text style={[styles.label, { marginTop: 16 }]}>Reviews</Text>
                      {selected.reviews.slice(0, 3).map((r: any, i: number) => (
                        <Card key={i} style={{ marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.reviewName}>{r.student_name}</Text>
                            <View style={styles.ratingRow}>
                              <Star size={10} color="#F59E0B" fill="#F59E0B" />
                              <Text style={styles.ratingTxt}>{r.rating}</Text>
                            </View>
                          </View>
                          <Text style={styles.reviewFeedback} numberOfLines={3}>{r.feedback}</Text>
                        </Card>
                      ))}
                    </>
                  )}
                  <View style={{ height: 30 }} />
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* Book Session Modal */}
        <Modal visible={bookSessionModal} transparent animationType="slide" onRequestClose={() => setBookSessionModal(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Book Session</Text>
                <Pressable onPress={() => setBookSessionModal(false)}><X color={theme.colors.muted} size={22} /></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Connection *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                  {activeConnections.map((c: any) => (
                    <Pressable key={c.id} onPress={() => setSessionForm(p => ({ ...p, connectionId: c.id }))} style={[styles.chip, sessionForm.connectionId === c.id && styles.chipActive]}>
                      <Text style={[styles.chipTxt, sessionForm.connectionId === c.id && styles.chipTxtActive]}>{c.mentor_name} → {c.student_name}</Text>
                    </Pressable>
                  ))}
                  {activeConnections.length === 0 && <Text style={styles.detailMeta}>No active connections</Text>}
                </ScrollView>
                <Text style={styles.label}>Topic *</Text>
                <TextInput value={sessionForm.topic} onChangeText={v => setSessionForm(p => ({ ...p, topic: v }))} placeholder="e.g. Career guidance" placeholderTextColor={theme.colors.muted} style={styles.input} />
                <Text style={styles.label}>Scheduled At (YYYY-MM-DD HH:MM) *</Text>
                <TextInput value={sessionForm.scheduledAt} onChangeText={v => setSessionForm(p => ({ ...p, scheduledAt: v }))} placeholder="2026-08-10 14:00" placeholderTextColor={theme.colors.muted} style={styles.input} />
                <Text style={styles.label}>Duration (minutes)</Text>
                <TextInput value={sessionForm.durationMinutes} onChangeText={v => setSessionForm(p => ({ ...p, durationMinutes: v }))} placeholder="30" placeholderTextColor={theme.colors.muted} style={styles.input} keyboardType="number-pad" />
                <Text style={styles.label}>Agenda</Text>
                <TextInput value={sessionForm.agenda} onChangeText={v => setSessionForm(p => ({ ...p, agenda: v }))} placeholder="What to discuss..." placeholderTextColor={theme.colors.muted} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline />
                <Pressable onPress={bookSession} disabled={sessionSaving} style={[styles.cta, sessionSaving && { opacity: 0.6 }]}>
                  {sessionSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Book Session</Text>}
                </Pressable>
                <View style={{ height: 20 }} />
              </ScrollView>
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
  statsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  statMini: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 4 },
  statMiniVal: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  statMiniLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600' },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabTxtActive: { color: '#fff' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 8 },
  goalLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  goalVal: { fontSize: 13, fontWeight: '800', color: theme.colors.brandPrimary },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statsGridItem: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md },
  statsGridVal: { fontSize: 22, fontWeight: '800', color: theme.colors.brandPrimary },
  statsGridLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
  mentorAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  mentorAvatarTxt: { color: theme.colors.brand, fontWeight: '800', fontSize: 16 },
  mentorName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  mentorHeadline: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  mentorBio: { fontSize: 13, color: theme.colors.onSurfaceTertiary, lineHeight: 20, marginTop: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingTxt: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  metaTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTagTxt: { fontSize: 10, color: theme.colors.muted },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  skillTag: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  skillTagTxt: { fontSize: 10, fontWeight: '600', color: theme.colors.brand },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  statusBadgeTxt: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  connTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  connMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  sessionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  sessionMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  actionItemsLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface },
  actionItem: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  detailMeta: { fontSize: 12, color: theme.colors.muted },
  reviewName: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  reviewFeedback: { fontSize: 12, color: theme.colors.muted, marginTop: 4, lineHeight: 18 },
  iconBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brandPrimary },
  chipTxt: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  chipTxtActive: { color: theme.colors.brand },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, fontSize: 14, color: theme.colors.onSurface },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
