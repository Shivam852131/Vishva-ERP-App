import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Radio, Calendar, Clock, Users, Video, Plus,
  PlayCircle, CheckCircle2, X, Tag,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { LiveSession } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, Button, Input, EmptyState } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live now' },
  { key: 'scheduled', label: 'Upcoming' },
  { key: 'ended', label: 'Past' },
];

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;

  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${time}`;
}

function StatusPill({ status }: { status: string }) {
  const config = status === 'live'
    ? { bg: '#FEE2E2', fg: '#DC2626', label: 'LIVE' }
    : status === 'ended'
      ? { bg: theme.colors.surfaceTertiary, fg: theme.colors.muted, label: 'ENDED' }
      : { bg: '#DBEAFE', fg: '#2563EB', label: 'UPCOMING' };

  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      {status === 'live' && <View style={styles.liveDot} />}
      <Text style={[styles.pillText, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

function CreateClassModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { mutate, loading } = useMutate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [hoursFromNow, setHoursFromNow] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError('Give the class a title.');
      return;
    }
    setError(null);
    const scheduledAt = new Date(Date.now() + (Number(hoursFromNow) || 0) * 3600000).toISOString();
    try {
      await mutate('/live-classes', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          scheduledAt,
          durationMinutes: Number(duration) || 60,
        }),
      });
      setTitle('');
      setDescription('');
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not create the class.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Schedule a live class</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Binary Trees — Live Doubt Session" />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="What will you cover?"
              multiline
              style={{ height: 80, textAlignVertical: 'top' }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Input
                label="Starts in (hours)"
                value={hoursFromNow}
                onChangeText={setHoursFromNow}
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Duration (min)"
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Button label="Schedule class" onPress={submit} loading={loading} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function LiveClasses() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFetch<LiveSession[]>('/live-classes');
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const canHost = user?.role === 'faculty' || user?.role === 'college_admin' || user?.role === 'super_admin';

  useEffect(() => subscribeRealtime('live:started', () => refresh()), [refresh]);
  useEffect(() => subscribeRealtime('live:ended', () => refresh()), [refresh]);
  useEffect(() => subscribeRealtime('live:scheduled', () => refresh()), [refresh]);

  const sessions = useMemo(() => {
    const all = data || [];
    // Live first, then soonest upcoming, then most recent past.
    const ordered = [...all].sort((a, b) => {
      const rank = (s: LiveSession) => (s.status === 'live' ? 0 : s.status === 'scheduled' ? 1 : 2);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const diff = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      return a.status === 'ended' ? -diff : diff;
    });
    return filter === 'all' ? ordered : ordered.filter(s => s.status === filter);
  }, [data, filter]);

  const liveCount = (data || []).filter(s => s.status === 'live').length;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.hero}>
          <View style={styles.heroRow}>
            <Pressable onPress={() => router.back()} accessibilityLabel="Go back" testID="back-btn">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.heroTitle}>Live Classes</Text>
            {canHost ? (
              <Pressable onPress={() => setShowCreate(true)} accessibilityLabel="Schedule class">
                <Plus color="#fff" size={22} />
              </Pressable>
            ) : (
              <View style={{ width: 22 }} />
            )}
          </View>
          <Text style={styles.heroSub}>
            {liveCount > 0 ? `${liveCount} class${liveCount > 1 ? 'es' : ''} live right now` : 'Join interactive sessions with chat, Q&A and polls'}
          </Text>
        </LinearGradient>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}>
            {FILTERS.map(f => (
              <ChipBtn key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
        >
          <AsyncView
            loading={loading && !data}
            error={error}
            onRetry={refresh}
            empty={!loading && sessions.length === 0}
            emptyTitle="No classes here"
            emptySub={filter === 'all' ? 'Live sessions your faculty schedules will appear here.' : 'Try a different filter.'}
            emptyIcon={<Video size={48} color={theme.colors.muted} />}
          >
            {sessions.map(session => (
              <Card key={session.id} onPress={() => router.push(`/live-class?id=${session.id}`)} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={[styles.iconWrap, session.status === 'live' && { backgroundColor: '#FEE2E2' }]}>
                    {session.status === 'live'
                      ? <Radio size={20} color="#DC2626" />
                      : session.status === 'ended'
                        ? <CheckCircle2 size={20} color={theme.colors.muted} />
                        : <PlayCircle size={20} color={theme.colors.brandPrimary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{session.title}</Text>
                    <Text style={styles.cardHost}>{session.host_name}</Text>
                  </View>
                  <StatusPill status={session.status} />
                </View>

                {session.description ? (
                  <Text style={styles.cardDesc} numberOfLines={2}>{session.description}</Text>
                ) : null}

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Calendar size={13} color={theme.colors.muted} />
                    <Text style={styles.metaText}>{formatWhen(session.scheduled_at)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color={theme.colors.muted} />
                    <Text style={styles.metaText}>{session.duration_minutes} min</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Users size={13} color={theme.colors.muted} />
                    <Text style={styles.metaText}>
                      {session.status === 'live' ? `${session.active_count || 0} in class` : `${session.participant_count || 0} joined`}
                    </Text>
                  </View>
                </View>

                {session.tags?.length ? (
                  <View style={styles.tagRow}>
                    {session.tags.slice(0, 3).map(tag => (
                      <View key={tag} style={styles.tag}>
                        <Tag size={9} color={theme.colors.brandPrimary} />
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            ))}
          </AsyncView>
        </ScrollView>

        <CreateClassModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={refresh} />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  filterRow: { paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  cardHost: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  cardDesc: { fontSize: 13, color: theme.colors.muted, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#DC2626' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 10, color: theme.colors.onBrandTertiary, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.onSurface },
  errorText: { color: theme.colors.error, fontSize: 13, fontWeight: '600' },
});
