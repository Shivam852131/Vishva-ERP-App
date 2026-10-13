import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, History, Calendar, Users, FileText, Download,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { EmptyState } from '@/src/ui';
import { useFetch } from '@/src/hooks/useFetch';
import { ConnectionStatus } from '@/src/localshare/components/ConnectionStatus';

export default function LocalShareHistory() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFetch('/localshare/history?scope=mine');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const sessions = data || [];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text style={styles.headerTitle}>Share History</Text>
            <View style={{ width: 20 }} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {loading && !data ? (
              <View style={styles.skeletons}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={styles.skeletonCard} />
                ))}
              </View>
            ) : sessions.length === 0 ? (
              <EmptyState
                title="No history yet"
                sub="Past sharing sessions will appear here"
                icon={<History size={48} color={theme.colors.muted} />}
              />
            ) : (
              sessions.map(s => (
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
                      <Text style={styles.cardMeta}>{s.teacher_name}</Text>
                    </View>
                    <ConnectionStatus state="disconnected" compact />
                  </View>

                  <View style={styles.cardStats}>
                    <View style={styles.statItem}>
                      <Users size={14} color={theme.colors.muted} />
                      <Text style={styles.statText}>{s.unique_students || 0} students</Text>
                    </View>
                    <View style={styles.statItem}>
                      <FileText size={14} color={theme.colors.muted} />
                      <Text style={styles.statText}>{s.files?.length || 0} files</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Download size={14} color={theme.colors.muted} />
                      <Text style={styles.statText}>{s.total_downloads || 0} downloads</Text>
                    </View>
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.dateRow}>
                      <Calendar size={12} color={theme.colors.muted} />
                      <Text style={styles.dateText}>{new Date(s.ended_at || s.created_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={styles.shareCode}>{s.share_code}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.brand },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, flex: 1, textAlign: 'center' },
  content: { flex: 1, backgroundColor: theme.colors.surface },
  skeletons: { padding: theme.spacing.lg, gap: theme.spacing.md },
  skeletonCard: { height: 100, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceTertiary },
  card: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
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
  cardStats: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  shareCode: {
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.brandPrimary,
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.xs,
  },
});
