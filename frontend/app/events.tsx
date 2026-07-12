import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Calendar, MapPin } from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import type { Event } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, EmptyState } from '@/src/ui';

export default function Events() {
  const { data: items, loading, refresh } = useFetch<Event[]>('/events');
  const itemsSafe = items || [];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.title}>Events</Text>
            <View style={{ width: 22 }} />
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>{itemsSafe.length} upcoming events</Text>
        </LinearGradient>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
          >
            {itemsSafe.length === 0 && <EmptyState title="No events" sub="Check back later for campus events" />}
            {itemsSafe.map((e, i) => (
              <Card key={e.id || i} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateDay}>{new Date(e.date).toLocaleDateString('en-US', { day: 'numeric' })}</Text>
                    <Text style={styles.dateMonth}>{new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventTitle}>{e.title}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 6 }}>
                      <MapPin size={12} color={theme.colors.muted} />
                      <Text style={styles.eventVenue}>{e.venue}</Text>
                    </View>
                    <Text style={styles.eventDesc}>{e.description}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  dateBadge: { width: 56, height: 56, borderRadius: 14, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 20, fontWeight: '800', color: theme.colors.brand },
  dateMonth: { fontSize: 10, fontWeight: '700', color: theme.colors.brand, marginTop: -2 },
  eventTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  eventVenue: { fontSize: 12, color: theme.colors.muted, fontWeight: '500' },
  eventDesc: { fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 8, lineHeight: 19 },
});
