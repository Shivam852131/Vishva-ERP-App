import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  Modal, TextInput, Dimensions, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Radio, Calendar, Clock, Users, Plus,
  PlayCircle, CheckCircle2, X, Search, MoreVertical,
  Trash2, Video, ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { LiveSession } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { AsyncView, ChipBtn, Button, EmptyState } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live Now' },
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

function StatusBadge({ status }: { status: string }) {
  if (status === 'live') {
    return (
      <View style={[styles.badge, styles.badgeLive]}>
        <View style={styles.liveDotPulse} />
        <Text style={styles.badgeLiveText}>LIVE</Text>
      </View>
    );
  }
  if (status === 'ended') {
    return (
      <View style={[styles.badge, styles.badgeEnded]}>
        <CheckCircle2 size={10} color={theme.colors.muted} />
        <Text style={styles.badgeEndedText}>ENDED</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, styles.badgeScheduled]}>
      <PlayCircle size={10} color="#2563EB" />
      <Text style={styles.badgeScheduledText}>SCHEDULED</Text>
    </View>
  );
}

function SessionCard({ session, onDelete, onHost }: {
  session: LiveSession;
  onDelete: (id: string) => void;
  onHost: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isLive = session.status === 'live';
  const isScheduled = session.status === 'scheduled';

  return (
    <Pressable
      onPress={() => router.push(`/live-class?id=${session.id}`)}
      style={[styles.card, isLive && styles.cardLive]}
    >
      {/* Top row: badge + actions */}
      <View style={styles.cardTop}>
        <StatusBadge status={session.status} />
        {onHost && (
          <View style={styles.actionsWrap}>
            <Pressable
              onPress={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              style={styles.actionsBtn}
              accessibilityLabel="More actions"
            >
              <MoreVertical size={14} color={theme.colors.muted} />
            </Pressable>
            {menuOpen && (
              <View style={styles.actionsMenu}>
                {isScheduled && (
                  <Pressable
                    style={styles.actionItem}
                    onPress={() => { setMenuOpen(false); router.push(`/live-class?id=${session.id}`); }}
                  >
                    <ChevronRight size={12} color={theme.colors.brandPrimary} />
                    <Text style={styles.actionText}>View</Text>
                  </Pressable>
                )}
                {!isLive && (
                  <Pressable
                    style={styles.actionItem}
                    onPress={() => { setMenuOpen(false); onDelete(session.id); }}
                  >
                    <Trash2 size={12} color={theme.colors.error} />
                    <Text style={[styles.actionText, { color: theme.colors.error }]}>Delete</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>{session.title}</Text>
      {session.description ? (
        <Text style={styles.cardDesc} numberOfLines={1}>{session.description}</Text>
      ) : null}

      {/* Meta row */}
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaHost} numberOfLines={1}>{session.host_name}</Text>
        </View>
        <View style={styles.metaItem}>
          <Clock size={11} color={theme.colors.muted} />
          <Text style={styles.metaText}>{session.duration_minutes}m</Text>
        </View>
        <View style={styles.metaItem}>
          <Users size={11} color={isLive ? '#DC2626' : theme.colors.muted} />
          <Text style={[styles.metaText, isLive && styles.metaLive]}>
            {isLive ? session.active_count || 0 : session.participant_count || 0}
          </Text>
        </View>
      </View>

      {/* Schedule row */}
      <View style={styles.cardSchedule}>
        <Calendar size={11} color={theme.colors.muted} />
        <Text style={styles.scheduleText}>
          {isLive && session.started_at
            ? `Started ${formatWhen(session.started_at)}`
            : isScheduled
              ? formatWhen(session.scheduled_at)
              : session.ended_at
                ? `Ended ${formatWhen(session.ended_at)}`
                : formatWhen(session.scheduled_at)}
        </Text>
      </View>

      {/* Tags */}
      {session.tags && session.tags.length > 0 && (
        <View style={styles.cardTags}>
          {session.tags.slice(0, 3).map(tag => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {session.tags.length > 3 && (
            <Text style={styles.tagMore}>+{session.tags.length - 3}</Text>
          )}
        </View>
      )}

      {/* Enter button for live */}
      {isLive && (
        <View style={styles.cardEnter}>
          <View style={styles.enterPulse} />
          <Text style={styles.enterText}>Enter Class</Text>
          <ChevronRight size={14} color="#DC2626" />
        </View>
      )}
    </Pressable>
  );
}

function CreateClassModal({ visible, onClose, onCreated }: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [hoursFromNow, setHoursFromNow] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError('Give the class a title.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const scheduledAt = new Date(Date.now() + (Number(hoursFromNow) || 0) * 3600000).toISOString();
      await api('/live-classes', {
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
      setDuration('60');
      setHoursFromNow('1');
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not create the class.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Schedule Class</Text>
              <Text style={styles.modalSub}>Create a new live session for students</Text>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseBtn} accessibilityLabel="Close">
              <X size={18} color={theme.colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Class Title *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Binary Trees — Live Doubt Session"
                placeholderTextColor={theme.colors.muted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="What will you cover in this session?"
                placeholderTextColor={theme.colors.muted}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Starts In (hours)</Text>
                <TextInput
                  style={styles.textInput}
                  value={hoursFromNow}
                  onChangeText={setHoursFromNow}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor={theme.colors.muted}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Duration (min)</Text>
                <TextInput
                  style={styles.textInput}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="numeric"
                  placeholder="60"
                  placeholderTextColor={theme.colors.muted}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
              <Button label={loading ? 'Scheduling...' : 'Schedule Class'} onPress={submit} loading={loading} style={{ flex: 1 }} />
            </View>
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
  const [searchQuery, setSearchQuery] = useState('');
  const [localSessions, setLocalSessions] = useState<LiveSession[]>([]);

  const canHost = user?.role === 'faculty' || user?.role === 'college_admin' || user?.role === 'super_admin';

  // Sync server data into local state for real-time patches
  useEffect(() => {
    if (data) setLocalSessions(data);
  }, [data]);

  // Real-time: update participant counts live
  useEffect(() => {
    const off1 = subscribeRealtime<{ sessionId: string }>('live:started', (payload) => {
      refresh();
    });
    const off2 = subscribeRealtime<{ sessionId: string }>('live:ended', () => refresh());
    const off3 = subscribeRealtime<LiveSession>('live:scheduled', (session) => {
      setLocalSessions(prev => {
        if (prev.some(s => s.id === session.id)) return prev;
        return [session, ...prev];
      });
    });
    const off4 = subscribeRealtime<{ student_id: string; student_name: string }>('live:participant-joined', () => {
      // Refresh to get updated counts
      refresh();
    });
    const off5 = subscribeRealtime<{ student_id: string }>('live:participant-left', () => {
      refresh();
    });
    return () => { off1(); off2(); off3(); off4(); off5(); };
  }, [refresh]);

  const allSessions = localSessions;

  const stats = useMemo(() => {
    const live = allSessions.filter(s => s.status === 'live').length;
    const upcoming = allSessions.filter(s => s.status === 'scheduled').length;
    const past = allSessions.filter(s => s.status === 'ended').length;
    return { total: allSessions.length, live, upcoming, past };
  }, [allSessions]);

  const sessions = useMemo(() => {
    const ordered = [...allSessions].sort((a, b) => {
      const rank = (s: LiveSession) => (s.status === 'live' ? 0 : s.status === 'scheduled' ? 1 : 2);
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      const diff = new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      return a.status === 'ended' ? -diff : diff;
    });
    const filtered = filter === 'all' ? ordered : ordered.filter(s => s.status === filter);
    if (!searchQuery.trim()) return filtered;
    const q = searchQuery.toLowerCase();
    return filtered.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.host_name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q)
    );
  }, [allSessions, filter, searchQuery]);

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert('Delete Class', 'This will permanently remove this class and all its data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/live-classes/${id}`, { method: 'DELETE' });
            setLocalSessions(prev => prev.filter(s => s.id !== id));
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={['#4F46E5', '#6366F1']} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Live Classes</Text>
              <Text style={styles.headerSub}>Real-time teaching sessions</Text>
            </View>
            {canHost ? (
              <Pressable onPress={() => setShowCreate(true)} style={styles.addBtn} accessibilityLabel="Schedule class">
                <Plus color="#fff" size={20} />
              </Pressable>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { borderLeftColor: '#6366F1' }]}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#DC2626' }]}>
              <Text style={[styles.statValue, { color: '#DC2626' }]}>{stats.live}</Text>
              <Text style={styles.statLabel}>Live</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#2563EB' }]}>
              <Text style={[styles.statValue, { color: '#2563EB' }]}>{stats.upcoming}</Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
            <View style={[styles.statCard, { borderLeftColor: '#64748B' }]}>
              <Text style={styles.statValue}>{stats.past}</Text>
              <Text style={styles.statLabel}>Past</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBar}>
            <Search size={16} color={theme.colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by title, host..."
              placeholderTextColor={theme.colors.muted}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.searchClear}>
                <X size={12} color={theme.colors.muted} />
              </Pressable>
            )}
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
            {FILTERS.map(f => (
              <ChipBtn key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
            ))}
          </ScrollView>

          {/* Results count */}
          <Text style={styles.resultsText}>
            {sessions.length} class{sessions.length !== 1 ? 'es' : ''}
            {searchQuery ? ` matching "${searchQuery}"` : ''}
          </Text>

          {/* Cards */}
          <ScrollView
            style={styles.cardsScroll}
            contentContainerStyle={styles.cardsContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
          >
            {loading && !data ? (
              <View style={styles.loadingWrap}>
                <View style={styles.skeletonCard} />
                <View style={styles.skeletonCard} />
                <View style={styles.skeletonCard} />
              </View>
            ) : sessions.length === 0 ? (
              <EmptyState
                title={filter === 'all' && !searchQuery ? 'No classes yet' : 'No classes found'}
                sub={filter === 'all' && !searchQuery
                  ? 'Live sessions your faculty schedules will appear here.'
                  : 'Try adjusting your search or filter.'}
                icon={<Video size={48} color={theme.colors.muted} />}
              />
            ) : (
              sessions.map(session => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onDelete={handleDelete}
                  onHost={canHost}
                />
              ))
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>

        <CreateClassModal visible={showCreate} onClose={() => setShowCreate(false)} onCreated={refresh} />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.brand },

  // Header
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, marginHorizontal: theme.spacing.md },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },

  // Content
  content: { flex: 1, backgroundColor: theme.colors.surface },

  // Stats
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, padding: theme.spacing.lg, paddingBottom: 0 },
  statCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderLeftWidth: 3, ...theme.shadow.xs },
  statValue: { fontSize: 20, fontWeight: '800', color: theme.colors.onSurface },
  statLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },

  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.md, height: 42, gap: theme.spacing.sm, ...theme.shadow.xs },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface, paddingVertical: 0 },
  searchClear: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },

  // Filters
  filterScroll: { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md },
  filterRow: { gap: theme.spacing.sm },

  // Results
  resultsText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs },

  // Cards
  cardsScroll: { flex: 1 },
  cardsContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
  loadingWrap: { gap: theme.spacing.sm },
  skeletonCard: { height: 140, backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.lg, opacity: 0.6 },

  // Card
  card: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, gap: theme.spacing.sm, ...theme.shadow.sm },
  cardLive: { borderColor: '#FCA5A5', backgroundColor: '#FFFBFB' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, lineHeight: 20 },
  cardDesc: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },
  cardMeta: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaHost: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },
  metaText: { fontSize: 11, color: theme.colors.muted, fontWeight: '500' },
  metaLive: { color: '#DC2626', fontWeight: '700' },
  cardSchedule: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  scheduleText: { fontSize: 11, color: theme.colors.muted },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  tag: { backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, color: theme.colors.onBrandTertiary, fontWeight: '600' },
  tagMore: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', alignSelf: 'center' },
  cardEnter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: theme.radius.md, paddingVertical: 8, marginTop: theme.spacing.xs, borderWidth: 1, borderColor: '#FECACA' },
  enterPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  enterText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },

  // Badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  badgeLive: { backgroundColor: '#FEE2E2' },
  badgeLiveText: { fontSize: 10, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 },
  badgeEnded: { backgroundColor: theme.colors.surfaceTertiary },
  badgeEndedText: { fontSize: 10, fontWeight: '800', color: theme.colors.muted, letterSpacing: 0.5 },
  badgeScheduled: { backgroundColor: '#DBEAFE' },
  badgeScheduledText: { fontSize: 10, fontWeight: '800', color: '#2563EB', letterSpacing: 0.5 },
  liveDotPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' },

  // Actions
  actionsWrap: { position: 'relative' },
  actionsBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionsMenu: { position: 'absolute', top: 32, right: 0, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 4, minWidth: 110, zIndex: 100, ...theme.shadow.md },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.xl, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.onSurface },
  modalSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: theme.spacing.xl, gap: theme.spacing.lg },
  fieldGroup: { gap: theme.spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 2 },
  textInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, fontSize: 13, color: theme.colors.onSurface, backgroundColor: theme.colors.surface },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  errorBanner: { backgroundColor: '#FEF2F2', borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: theme.colors.error, fontSize: 12, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: theme.spacing.md, paddingTop: theme.spacing.sm },
});
