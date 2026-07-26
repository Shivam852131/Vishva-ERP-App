import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Users, Star, Briefcase, Calendar, Clock, Target,
  X, CheckCircle2, Plus, MessageSquare, Search, Globe, Award,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { Mentor, MentorshipOverview, MentorshipSession, MentorshipGoal } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, Button, ProgressBar, EmptyState, Input } from '@/src/ui';

const TABS = [
  { key: 'discover', label: 'Find Mentors' },
  { key: 'mine', label: 'My Mentors' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'goals', label: 'Goals' },
];

const SORTS = [
  { key: 'relevance', label: 'Best match' },
  { key: 'rating', label: 'Top rated' },
  { key: 'experience', label: 'Most experienced' },
];

function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 4 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Star size={12} color={theme.colors.warning} fill={theme.colors.warning} />
      <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
    </View>
  );
}

// ─── Mentor detail + request ─────────────────────────────────────
function MentorModal({ mentor, visible, onClose, onRequested }: {
  mentor: Mentor | null;
  visible: boolean;
  onClose: () => void;
  onRequested: () => void;
}) {
  const [goal, setGoal] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  if (!mentor) return null;

  const request = async () => {
    if (!goal.trim()) {
      Alert.alert('Add a goal', 'Tell the mentor what you want help with.');
      return;
    }
    setBusy(true);
    try {
      await api(`/mentorship/mentors/${mentor.id}/request`, {
        method: 'POST',
        body: JSON.stringify({
          goal: goal.trim(),
          message: message.trim() || null,
          focusSkills: mentor.expertise.map(e => e.skill_key),
        }),
      });
      Alert.alert('Request sent', `${mentor.name} will review your request shortly.`);
      setGoal('');
      setMessage('');
      onRequested();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not send request', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} accessibilityLabel="Close">
            <X size={22} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={styles.modalTitle}>Mentor profile</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Avatar name={mentor.name} size={62} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailName}>{mentor.name}</Text>
              <Text style={styles.detailHeadline}>{mentor.headline}</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 5 }}>
                <Stars rating={mentor.rating} />
                <Text style={styles.metaText}>{mentor.experience_years} yrs exp</Text>
                <Text style={styles.metaText}>{mentor.sessions_completed} sessions</Text>
              </View>
            </View>
          </View>

          <Card style={{ gap: 6 }}>
            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.bodyText}>{mentor.bio}</Text>
          </Card>

          <Card style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>Expertise</Text>
            <View style={styles.chipWrap}>
              {mentor.expertise.map(skill => (
                <View key={skill.skill_key} style={styles.chip}>
                  <Text style={styles.chipText}>{skill.name}</Text>
                </View>
              ))}
            </View>
          </Card>

          {mentor.career_tracks.length > 0 && (
            <Card style={{ gap: 8 }}>
              <Text style={styles.sectionLabel}>Coaches for</Text>
              <View style={styles.chipWrap}>
                {mentor.career_tracks.map(track => (
                  <View key={track.key} style={[styles.chip, { backgroundColor: '#EDE9FE' }]}>
                    <Text style={[styles.chipText, { color: '#6D28D9' }]}>{track.title}</Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          <Card style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>Availability</Text>
            {mentor.availability.map(slot => (
              <View key={slot} style={styles.slotRow}>
                <Clock size={13} color={theme.colors.brandPrimary} />
                <Text style={styles.bodyText}>{slot}</Text>
              </View>
            ))}
            <View style={styles.slotRow}>
              <Globe size={13} color={theme.colors.muted} />
              <Text style={styles.metaText}>Speaks {mentor.languages.join(', ')}</Text>
            </View>
          </Card>

          {mentor.reviews && mentor.reviews.length > 0 && (
            <Card style={{ gap: 10 }}>
              <Text style={styles.sectionLabel}>Student reviews</Text>
              {mentor.reviews.map((review, index) => (
                <View key={index} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.reviewName}>{review.student_name}</Text>
                    <Stars rating={review.rating} />
                  </View>
                  {review.feedback ? <Text style={styles.bodyText}>{review.feedback}</Text> : null}
                </View>
              ))}
            </Card>
          )}

          {mentor.connection_status === 'active' ? (
            <Card style={{ alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={26} color={theme.colors.success} />
              <Text style={styles.connectedText}>You are connected with {mentor.name.split(' ')[0]}</Text>
              <Text style={styles.bodyText}>Book a session from the Sessions tab.</Text>
            </Card>
          ) : mentor.connection_status === 'pending' ? (
            <Card style={{ alignItems: 'center', gap: 6 }}>
              <Clock size={26} color={theme.colors.warning} />
              <Text style={styles.connectedText}>Request pending</Text>
              <Text style={styles.bodyText}>You will be notified once it is reviewed.</Text>
            </Card>
          ) : (
            <>
              <Input
                label="What do you want help with?"
                value={goal}
                onChangeText={setGoal}
                placeholder="e.g. Crack product-based company interviews"
              />
              <Input
                label="Message (optional)"
                value={message}
                onChangeText={setMessage}
                placeholder="Introduce yourself briefly"
                multiline
                style={{ height: 90, textAlignVertical: 'top' }}
              />
              <Button label="Send mentorship request" loading={busy} onPress={request} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Book session ────────────────────────────────────────────────
function BookSessionModal({ visible, connections, onClose, onBooked }: {
  visible: boolean;
  connections: MentorshipOverview['connections'];
  onClose: () => void;
  onBooked: () => void;
}) {
  const active = connections.filter(c => c.status === 'active');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [agenda, setAgenda] = useState('');
  const [daysAhead, setDaysAhead] = useState('2');
  const [duration, setDuration] = useState('45');
  const [busy, setBusy] = useState(false);

  const selected = connectionId || active[0]?.id || null;

  const book = async () => {
    if (!selected) {
      Alert.alert('No active mentor', 'Connect with a mentor before booking a session.');
      return;
    }
    if (!topic.trim()) {
      Alert.alert('Add a topic', 'What should this session cover?');
      return;
    }
    setBusy(true);
    try {
      const scheduledAt = new Date(Date.now() + (Number(daysAhead) || 1) * 86400000).toISOString();
      await api('/mentorship/sessions', {
        method: 'POST',
        body: JSON.stringify({
          connectionId: selected,
          topic: topic.trim(),
          agenda: agenda.trim(),
          scheduledAt,
          durationMinutes: Number(duration) || 45,
        }),
      });
      setTopic('');
      setAgenda('');
      onBooked();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not book', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.modalHeaderPlain}>
            <Text style={styles.modalTitle}>Book a session</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            {active.length === 0 ? (
              <EmptyState
                title="No active mentors"
                sub="Send a mentorship request first."
                icon={<Users size={40} color={theme.colors.muted} />}
              />
            ) : (
              <>
                <View style={{ gap: 8 }}>
                  <Text style={styles.inputLabel}>Mentor</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {active.map(connection => (
                      <ChipBtn
                        key={connection.id}
                        label={connection.mentor_name}
                        active={selected === connection.id}
                        onPress={() => setConnectionId(connection.id)}
                      />
                    ))}
                  </ScrollView>
                </View>

                <Input label="Topic" value={topic} onChangeText={setTopic} placeholder="e.g. Mock system design interview" />
                <Input
                  label="Agenda (optional)"
                  value={agenda}
                  onChangeText={setAgenda}
                  placeholder="What should you both prepare?"
                  multiline
                  style={{ height: 70, textAlignVertical: 'top' }}
                />
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Input label="In (days)" value={daysAhead} onChangeText={setDaysAhead} keyboardType="numeric" containerStyle={{ flex: 1 }} />
                  <Input label="Duration (min)" value={duration} onChangeText={setDuration} keyboardType="numeric" containerStyle={{ flex: 1 }} />
                </View>
                <Button label="Book session" loading={busy} onPress={book} />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Goal creation ───────────────────────────────────────────────
function GoalModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [milestones, setMilestones] = useState(['', '', '']);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!title.trim()) {
      Alert.alert('Add a title', 'What is the goal?');
      return;
    }
    setBusy(true);
    try {
      await api('/mentorship/goals', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          milestones: milestones.map(m => m.trim()).filter(Boolean),
        }),
      });
      setTitle('');
      setMilestones(['', '', '']);
      onCreated();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not create goal', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.modalHeaderPlain}>
            <Text style={styles.modalTitle}>New goal</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            <Input label="Goal" value={title} onChangeText={setTitle} placeholder="e.g. Land a backend internship" />
            <Text style={styles.inputLabel}>Milestones</Text>
            {milestones.map((milestone, index) => (
              <Input
                key={index}
                value={milestone}
                onChangeText={(value: string) => setMilestones(prev => prev.map((m, i) => (i === index ? value : m)))}
                placeholder={`Milestone ${index + 1}`}
              />
            ))}
            <Pressable onPress={() => setMilestones(prev => [...prev, ''])} style={styles.addRow}>
              <Plus size={14} color={theme.colors.brandPrimary} />
              <Text style={styles.addRowText}>Add milestone</Text>
            </Pressable>
            <Button label="Create goal" loading={busy} onPress={create} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────
export default function Mentorship() {
  const [tab, setTab] = useState('discover');
  const [sort, setSort] = useState('relevance');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Mentor | null>(null);
  const [showBook, setShowBook] = useState(false);
  const [showGoal, setShowGoal] = useState(false);

  const { data: mentors, loading, error, refresh } = useFetch<Mentor[]>(`/mentorship/mentors?sort=${sort}`);
  const { data: overview, refresh: refreshOverview } = useFetch<MentorshipOverview>('/mentorship/overview');
  const { data: sessions, refresh: refreshSessions } = useFetch<MentorshipSession[]>('/mentorship/sessions');
  const { data: goals, refresh: refreshGoals } = useFetch<MentorshipGoal[]>('/mentorship/goals');

  const refreshAll = () => {
    refresh();
    refreshOverview();
    refreshSessions();
    refreshGoals();
  };

  const visibleMentors = useMemo(() => {
    const list = mentors || [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.company.toLowerCase().includes(query) ||
      m.expertise.some(e => e.name.toLowerCase().includes(query)));
  }, [mentors, search]);

  const openMentor = async (mentor: Mentor) => {
    try {
      const full = await api<Mentor>(`/mentorship/mentors/${mentor.id}`);
      setSelected(full);
    } catch {
      setSelected(mentor);
    }
  };

  const completeSession = async (session: MentorshipSession) => {
    try {
      await api(`/mentorship/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      refreshAll();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const rateSession = (session: MentorshipSession) => {
    Alert.alert('Rate this session', 'How useful was it?', [
      ...[5, 4, 3].map(rating => ({
        text: `${rating} star${rating > 1 ? 's' : ''}`,
        onPress: async () => {
          try {
            await api(`/mentorship/sessions/${session.id}/feedback`, {
              method: 'POST',
              body: JSON.stringify({ rating }),
            });
            refreshAll();
          } catch (e: any) {
            Alert.alert('Could not rate', e?.message || 'Please try again.');
          }
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const toggleMilestone = async (goal: MentorshipGoal, index: number) => {
    try {
      await api(`/mentorship/goals/${goal.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ milestoneIndex: index }),
      });
      refreshGoals();
      refreshOverview();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const stats = overview?.stats;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={['#0891B2', '#4F46E5']} style={styles.hero}>
          <View style={styles.heroRow}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.heroTitle}>Mentorship</Text>
            <View style={{ width: 22 }} />
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats?.active_mentors ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Mentors</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats?.completed_sessions ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Sessions</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats?.total_hours ?? 0}h</Text>
              <Text style={styles.heroStatLabel}>Coached</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats?.active_goals ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Goals</Text>
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

        {tab === 'discover' && (
          <>
            <View style={styles.searchRow}>
              <Search size={16} color={theme.colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, company or skill"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}>
                {SORTS.map(s => (
                  <ChipBtn key={s.key} label={s.label} active={sort === s.key} onPress={() => setSort(s.key)} />
                ))}
              </ScrollView>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
            >
              <AsyncView
                loading={loading && !mentors}
                error={error}
                onRetry={refresh}
                empty={!loading && visibleMentors.length === 0}
                emptyTitle="No mentors found"
                emptySub="Try a different search."
                emptyIcon={<Users size={48} color={theme.colors.muted} />}
              >
                {visibleMentors.map(mentor => (
                  <Card key={mentor.id} onPress={() => openMentor(mentor)} style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Avatar name={mentor.name} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{mentor.name}</Text>
                        <Text style={styles.cardSub} numberOfLines={1}>{mentor.headline}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                          <Stars rating={mentor.rating} />
                          <Text style={styles.metaText}>{mentor.experience_years} yrs</Text>
                          <Text style={styles.metaText}>{mentor.sessions_completed} sessions</Text>
                        </View>
                      </View>
                      {mentor.connection_status === 'active' && <CheckCircle2 size={18} color={theme.colors.success} />}
                      {mentor.connection_status === 'pending' && <Clock size={18} color={theme.colors.warning} />}
                    </View>

                    <View style={styles.chipWrap}>
                      {mentor.expertise.slice(0, 4).map(skill => (
                        <View key={skill.skill_key} style={styles.chip}>
                          <Text style={styles.chipText}>{skill.name}</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))}
              </AsyncView>
            </ScrollView>
          </>
        )}

        {tab === 'mine' && (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            {(overview?.connections || []).length === 0 ? (
              <EmptyState
                title="No mentors yet"
                sub="Find a mentor whose expertise matches your skill gaps."
                icon={<Users size={48} color={theme.colors.muted} />}
              />
            ) : (
              (overview?.connections || []).map(connection => (
                <Card key={connection.id} style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <Avatar name={connection.mentor_name} size={42} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{connection.mentor_name}</Text>
                      <Text style={styles.cardSub} numberOfLines={1}>{connection.mentor_headline}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: connection.status === 'active' ? '#DCFCE7' : connection.status === 'pending' ? '#FEF3C7' : theme.colors.surfaceTertiary },
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: connection.status === 'active' ? '#16A34A' : connection.status === 'pending' ? '#D97706' : theme.colors.muted },
                      ]}>
                        {connection.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.goalBox}>
                    <Target size={13} color={theme.colors.brandPrimary} />
                    <Text style={styles.goalBoxText}>{connection.goal}</Text>
                  </View>
                  <Text style={styles.metaText}>{connection.sessions_count} session{connection.sessions_count === 1 ? '' : 's'} completed</Text>
                </Card>
              ))
            )}
          </ScrollView>
        )}

        {tab === 'sessions' && (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            <Button label="Book a session" icon={<Plus size={16} color="#fff" />} onPress={() => setShowBook(true)} />

            {(sessions || []).length === 0 ? (
              <EmptyState
                title="No sessions booked"
                sub="Schedule time with an active mentor."
                icon={<Calendar size={48} color={theme.colors.muted} />}
              />
            ) : (
              (sessions || []).map(session => (
                <Card key={session.id} style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={styles.sessionIcon}>
                      <MessageSquare size={17} color={theme.colors.brandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{session.topic}</Text>
                      <Text style={styles.cardSub} numberOfLines={1}>with {session.mentor_name}</Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: session.status === 'completed' ? '#DCFCE7' : session.status === 'cancelled' ? '#FEE2E2' : '#DBEAFE' },
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: session.status === 'completed' ? '#16A34A' : session.status === 'cancelled' ? '#DC2626' : '#2563EB' },
                      ]}>
                        {session.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Calendar size={12} color={theme.colors.muted} />
                      <Text style={styles.metaText}>{new Date(session.scheduled_at).toLocaleString()}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={12} color={theme.colors.muted} />
                      <Text style={styles.metaText}>{session.duration_minutes} min</Text>
                    </View>
                  </View>

                  {session.agenda ? <Text style={styles.bodyText}>{session.agenda}</Text> : null}

                  {session.action_items?.length > 0 && (
                    <View style={{ gap: 4 }}>
                      <Text style={styles.sectionLabel}>Action items</Text>
                      {session.action_items.map((item, index) => (
                        <Text key={index} style={styles.bodyText}>• {item}</Text>
                      ))}
                    </View>
                  )}

                  {session.status === 'scheduled' && (
                    <Button label="Mark completed" variant="secondary" onPress={() => completeSession(session)} />
                  )}
                  {session.status === 'completed' && session.rating == null && (
                    <Button label="Rate this session" variant="secondary" onPress={() => rateSession(session)} />
                  )}
                  {session.rating != null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Award size={14} color={theme.colors.warning} />
                      <Text style={styles.metaText}>You rated this {session.rating}/5</Text>
                    </View>
                  )}
                </Card>
              ))
            )}
          </ScrollView>
        )}

        {tab === 'goals' && (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            <Button label="New goal" icon={<Plus size={16} color="#fff" />} onPress={() => setShowGoal(true)} />

            {(goals || []).length === 0 ? (
              <EmptyState
                title="No goals yet"
                sub="Break a career target into milestones you can tick off."
                icon={<Target size={48} color={theme.colors.muted} />}
              />
            ) : (
              (goals || []).map(goal => (
                <Card key={goal.id} style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={[styles.cardTitle, { flex: 1 }]}>{goal.title}</Text>
                    {goal.status === 'completed' && <CheckCircle2 size={18} color={theme.colors.success} />}
                  </View>

                  <ProgressBar value={goal.progress} max={100} height={7} showPct label="Progress" />

                  {goal.milestones.map((milestone, index) => (
                    <Pressable
                      key={index}
                      onPress={() => toggleMilestone(goal, index)}
                      style={styles.milestoneRow}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: milestone.done }}
                    >
                      <View style={[styles.checkbox, milestone.done && styles.checkboxOn]}>
                        {milestone.done && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                      <Text style={[styles.milestoneText, milestone.done && styles.milestoneDone]}>
                        {milestone.title}
                      </Text>
                    </Pressable>
                  ))}
                </Card>
              ))
            )}
          </ScrollView>
        )}

        <MentorModal mentor={selected} visible={!!selected} onClose={() => setSelected(null)} onRequested={refreshAll} />
        <BookSessionModal
          visible={showBook}
          connections={overview?.connections || []}
          onClose={() => setShowBook(false)}
          onBooked={refreshAll}
        />
        <GoalModal visible={showGoal} onClose={() => setShowGoal(false)} onCreated={refreshAll} />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: theme.spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: theme.radius.lg, padding: theme.spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 19, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.brandPrimary },
  tabLabel: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md,
    paddingHorizontal: 12, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.onSurface },
  filterRow: { paddingVertical: theme.spacing.md },

  avatar: { backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: theme.colors.brandPrimary },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  cardSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  ratingText: { fontSize: 11, fontWeight: '800', color: theme.colors.onSurface },
  metaText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bodyText: { fontSize: 13, color: theme.colors.muted, lineHeight: 19 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.sm, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { fontSize: 11, color: theme.colors.onBrandTertiary, fontWeight: '700' },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalHeaderPlain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  detailName: { fontSize: 19, fontWeight: '800', color: theme.colors.onSurface },
  detailHeadline: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  reviewName: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  connectedText: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  sheetBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl, maxHeight: '88%',
  },
  inputLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addRowText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },

  goalBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10 },
  goalBoxText: { flex: 1, fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },
  sessionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },

  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkbox: { width: 19, height: 19, borderRadius: 5, borderWidth: 1.5, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  checkMark: { color: '#fff', fontSize: 11, fontWeight: '900' },
  milestoneText: { flex: 1, fontSize: 13, color: theme.colors.onSurface },
  milestoneDone: { textDecorationLine: 'line-through', color: theme.colors.muted },
});
