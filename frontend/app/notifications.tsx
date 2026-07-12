import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Bell, CheckCheck } from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Notification } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { EmptyState } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function Notifications() {
  const { data: items, loading, refresh } = useFetch<Notification[]>('/notifications');
  const { mutate: markRead } = useMutate();

  React.useEffect(() => subscribeRealtime('notifications:update', () => refresh()), [refresh]);

  const itemsSafe = items || [];
  const unread = itemsSafe.filter(n => !n.read).length;

  const handleMarkRead = async (id: string) => {
    try {
      await markRead(`/notifications/read/${id}`, { method: 'POST' });
      refresh();
    } catch {}
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.subHeader}>
          <Bell size={14} color={theme.colors.muted} />
          <Text style={styles.subText}>{unread} unread · {itemsSafe.length} total</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
          >
            {itemsSafe.length === 0 && <EmptyState title="No notifications" sub="You're all caught up!" />}
            {itemsSafe.map(n => (
              <Pressable
                key={n.id}
                onPress={() => handleMarkRead(n.id)}
                style={[styles.notifCard, !n.read && styles.notifUnread]}
                accessibilityLabel={`Notification: ${n.title}`}
                testID={`notif-${n.id}`}
              >
                <View style={[styles.notifDot, { backgroundColor: n.read ? theme.colors.muted : theme.colors.brandPrimary }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.notifTitle, !n.read && styles.notifTitleUnread]} numberOfLines={1}>{n.title}</Text>
                    {!n.read && <CheckCheck size={14} color={theme.colors.brandPrimary} />}
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                  <Text style={styles.notifTime}>{new Date(n.created_at).toLocaleString()}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  subHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  subText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  notifCard: { flexDirection: 'row', gap: 10, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm },
  notifUnread: { borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandTertiary + '60' },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notifTitle: { fontWeight: '600', color: theme.colors.onSurface, fontSize: 13 },
  notifTitleUnread: { fontWeight: '800' },
  notifBody: { color: theme.colors.onSurfaceTertiary, marginTop: 3, fontSize: 12 },
  notifTime: { color: theme.colors.muted, marginTop: 4, fontSize: 10 },
});
