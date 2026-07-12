import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Building, Phone, Home } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import type { Hostel, HostelAllocation } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { EmptyState, Card } from '@/src/ui';

export default function Hostel() {
  const { user } = useAuth();
  const { data: allocation } = useFetch<HostelAllocation>(
    user?.role === 'student' ? '/hostel/my-allocation' : null
  );
  const { data: hostels, loading, refresh } = useFetch<Hostel[]>('/hostels');

  if (loading) {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface }}>
          <ActivityIndicator color={theme.colors.brandPrimary} />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Hostel Management</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
        >
          {user?.role === 'student' && allocation ? (
            <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.allocCard}>
              <View style={styles.allocTop}>
                <Home color="rgba(255,255,255,0.9)" size={24} />
                <Text style={styles.allocTitle}>Your Hostel Allocation</Text>
              </View>
              <Text style={styles.allocHostel}>{allocation.hostel_name}</Text>
              <Text style={styles.allocDetail}>Room {allocation.room_number}</Text>
            </LinearGradient>
          ) : user?.role === 'student' ? (
            <View style={styles.noAlloc}>
              <Building size={32} color={theme.colors.muted} />
              <Text style={styles.noAllocTxt}>Not allocated to any hostel yet</Text>
              <Text style={styles.noAllocSub}>Contact the admin for hostel allocation</Text>
            </View>
          ) : null}

          <>
            <Text style={styles.h2}>Residential Halls</Text>
            {(hostels || []).map(h => (
              <Card key={h.id} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.hostelIcon}>
                    <Building color="#fff" size={22} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hostelName}>{h.name}</Text>
                    <Text style={styles.hostelMeta}>{h.type} · {h.total_rooms} rooms</Text>
                    {h.warden_name && <Text style={styles.hostelMeta}>Warden: {h.warden_name}</Text>}
                  </View>
                </View>
                {h.contact ? (
                  <View style={styles.contactRow}>
                    <Phone size={14} color={theme.colors.muted} />
                    <Text style={styles.contactTxt}>{h.contact}</Text>
                  </View>
                ) : null}
              </Card>
            ))}
            {(hostels || []).length === 0 && <EmptyState title="No hostels" sub="Hostel information will appear here" />}
          </>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  h2: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },
  allocCard: { padding: theme.spacing.xl, borderRadius: theme.radius.lg, ...theme.shadow.lg },
  allocTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  allocTitle: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 15 },
  allocHostel: { color: '#fff', fontSize: 24, fontWeight: '800' },
  allocDetail: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 4 },
  noAlloc: { alignItems: 'center', padding: theme.spacing.xl, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border },
  noAllocTxt: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 15, marginTop: 10 },
  noAllocSub: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  hostelIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hostelName: { fontWeight: '700', color: theme.colors.onSurface, fontSize: 16 },
  hostelMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.divider },
  contactTxt: { color: theme.colors.onSurfaceTertiary, fontSize: 12 },
});
