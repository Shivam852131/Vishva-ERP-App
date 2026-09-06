import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  TextInput, Modal, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Share, Plus, Search, Radio, Clock, Users,
  FileText, Trash2, ChevronRight, History,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { EmptyState, Button, GradientButton } from '@/src/ui';
import { useLocalShare } from '@/src/localshare/hooks/useLocalShare';
import { formatFileSize } from '@/src/localshare/utils/fileChunker';
import { ConnectionStatus } from '@/src/localshare/components/ConnectionStatus';

export default function LocalShareHome() {
  const { user } = useAuth();
  const isTeacher = ['faculty', 'college_admin', 'super_admin'].includes(user?.role);
  const { sessions, loading, fetchSessions, deleteSession } = useLocalShare();
  const [filter, setFilter] = useState('all');
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions(filter === 'all' ? {} : { status: filter });
    setRefreshing(false);
  }, [filter, fetchSessions]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setShowJoin(false);
    router.push(`/localshare-join?code=${joinCode.trim().toUpperCase()}`);
    setJoinCode('');
  };

  const handleDelete = (session) => {
    Alert.alert('Delete Session', `Delete "${session.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSession(session.id) },
    ]);
  };

  const filtered = sessions?.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'active') return s.status === 'active';
    if (filter === 'ended') return s.status === 'ended';
    return true;
  }) || [];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text style={styles.headerTitle}>Local Share</Text>
            <Pressable onPress={() => router.push('/localshare-history')}>
              <History color="#fff" size={20} />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.actions}>
            {isTeacher ? (
              <View style={styles.actionsRow}>
                <GradientButton
                  label="New Session"
                  icon={<Plus size={18} color="#fff" />}
                  onPress={() => router.push('/localshare-create')}
                  style={styles.flexBtn}
                />
                <Button
                  label="Join"
                  icon={<Share size={18} color={theme.colors.brandPrimary} />}
                  variant="secondary"
                  onPress={() => setShowJoin(true)}
                  style={styles.joinBtn}
                />
              </View>
            ) : (
              <GradientButton
                label="Join Session"
                icon={<Share size={18} color="#fff" />}
                onPress={() => setShowJoin(true)}
              />
            )}
          </View>

          <View style={styles.filters}>
            {['all', 'active', 'ended'].map(f => (
              <Pressable
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          >
            {loading && !sessions ? (
              <View style={styles.skeletons}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={styles.skeletonCard} />
                ))}
              </View>
            ) : filtered.length === 0 ? (
              <EmptyState
                title="No sessions"
                sub="Create a session to share files with students"
                icon={<Share size={48} color={theme.colors.muted} />}
              />
            ) : (
              filtered.map(s => (
                <Pressable
                  key={s.id}
                  style={styles.card}
                  onPress={() => router.push(`/localshare-active?id=${s.id}`)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIcon}>
                      <FileText size={18} color={theme.colors.brandPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{s.title}</Text>
                      <Text style={styles.cardMeta}>
                        {s.files?.length || 0} files · {s.participant_count || 0} joined
                      </Text>
                    </View>
                    <ConnectionStatus state={s.status === 'active' ? 'connected' : 'disconnected'} compact />
                  </View>
                  <View style={styles.cardFooter}>
                    <View style={styles.cardInfo}>
                      <Clock size={12} color={theme.colors.muted} />
                      <Text style={styles.cardTime}>{new Date(s.created_at).toLocaleString()}</Text>
                    </View>
                    <Text style={styles.shareCode}>{s.share_code}</Text>
                  </View>
                  {isTeacher && (
                    <Pressable style={styles.deleteBtn} onPress={() => handleDelete(s)}>
                      <Trash2 size={16} color={theme.colors.error} />
                    </Pressable>
                  )}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>

        <Modal visible={showJoin} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Join Session</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter share code (e.g. LS-4A7X)"
                placeholderTextColor={theme.colors.muted}
                value={joinCode}
                onChangeText={setJoinCode}
                autoCapitalize="characters"
                autoFocus
              />
              <View style={styles.modalActions}>
                <Button label="Cancel" variant="ghost" onPress={() => setShowJoin(false)} />
                <Button label="Join" onPress={handleJoin} disabled={!joinCode.trim()} />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.brand },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold },
  content: { flex: 1, backgroundColor: theme.colors.surface },
  actions: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  flexBtn: {
    flex: 1,
  },
  joinBtn: {
    paddingHorizontal: theme.spacing.lg,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: theme.spacing.md + 2,
    paddingVertical: theme.spacing.xs + 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceTertiary,
  },
  filterActive: { backgroundColor: theme.colors.brand },
  filterText: { fontSize: theme.font.size.sm, color: theme.colors.muted, fontWeight: theme.font.weight.medium },
  filterTextActive: { color: '#fff' },
  scrollContent: {
    paddingBottom: theme.spacing.xxl,
  },
  skeletons: { paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md },
  skeletonCard: { height: 80, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceTertiary },
  card: {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface },
  cardMeta: { fontSize: theme.font.size.sm, color: theme.colors.muted, marginTop: 2 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardTime: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  shareCode: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.brandPrimary,
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.xs,
  },
  deleteBtn: { position: 'absolute', top: theme.spacing.md, right: theme.spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
  },
  modalTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, marginBottom: theme.spacing.lg },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.font.size.lg,
    color: theme.colors.onSurface,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: theme.spacing.lg,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md },
});
