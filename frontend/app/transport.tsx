import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Bus, MapPin, Clock, User, Phone, CheckCircle2, XCircle } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { TransportRoute, TransportEnrollment } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, EmptyState, GradientButton } from '@/src/ui';

export default function Transport() {
  const { user } = useAuth();
  const { data: routes, loading, refresh } = useFetch<TransportRoute[]>('/transport/routes');
  const { data: myRoute, refresh: refreshMyRoute } = useFetch<TransportEnrollment>(
    user?.role === 'student' ? '/transport/my-route' : null
  );
  const { mutate: enrollApi, loading: enrolling } = useMutate();
  const { mutate: deEnrollApi, loading: deEnrolling } = useMutate();

  const routesSafe = routes || [];

  const enroll = async (routeId: string) => {
    try {
      await enrollApi(`/transport/enroll/${routeId}`, { method: 'POST' });
      refresh();
      refreshMyRoute();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const deEnroll = async () => {
    try {
      await deEnrollApi('/transport/de-enroll', { method: 'POST' });
      refresh();
      refreshMyRoute();
    } catch (e: any) {
      alert(e.message);
    }
  };

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
          <Text style={styles.title}>Transport</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
        >
          {myRoute && (
            <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.enrolledBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 color="#fff" size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.enrolledTitle}>Enrolled: {myRoute.route_name}</Text>
                  <Text style={styles.enrolledSub}>You are registered for this shuttle route</Text>
                </View>
              </View>
              <Pressable
                onPress={deEnroll}
                disabled={deEnrolling}
                style={styles.deEnrollBtn}
                testID="de-enroll"
                accessibilityLabel="De-enroll from route"
              >
                {deEnrolling ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <XCircle color="#fff" size={16} />
                    <Text style={styles.deEnrollTxt}>De-enroll</Text>
                  </>
                )}
              </Pressable>
            </LinearGradient>
          )}

          <Text style={styles.h2}>Available Routes</Text>
          {routesSafe.map(r => (
            <Card key={r.id} style={{ marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.routeIcon}>
                  <Bus color="#fff" size={22} />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeName}>{r.route_name}</Text>
                  <Text style={styles.routeMeta}>{r.vehicle_number}</Text>
                </View>
              </View>

              <View style={styles.driverRow}>
                <User size={14} color={theme.colors.muted} />
                <Text style={styles.driverTxt}>{r.driver_name}</Text>
                {r.driver_phone && (
                  <>
                    <Phone size={14} color={theme.colors.muted} />
                    <Text style={styles.driverTxt}>{r.driver_phone}</Text>
                  </>
                )}
              </View>

              <View style={styles.scheduleRow}>
                <Clock size={14} color={theme.colors.muted} />
                <Text style={styles.scheduleTxt}>Morning: {(r as any).morning_departure || 'N/A'} · Evening: {(r as any).evening_departure || 'N/A'}</Text>
              </View>

              {r.stops && r.stops.length > 0 && (
                <View style={styles.stopsWrap}>
                  <Text style={styles.stopsTitle}>Stops:</Text>
                  {r.stops.map((s, i) => (
                    <View key={i} style={styles.stopRow}>
                      <MapPin size={12} color={theme.colors.brand} />
                      <Text style={styles.stopTxt}>{s.name}</Text>
                      <Text style={styles.stopTime}>{s.time}</Text>
                    </View>
                  ))}
                </View>
              )}

              {user?.role === 'student' && !myRoute && (
                <GradientButton
                  label={enrolling ? 'Enrolling...' : 'Enroll in this Route'}
                  onPress={() => enroll(r.id)}
                  loading={enrolling}
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>
          ))}
          {routesSafe.length === 0 && <EmptyState title="No transport routes" sub="Routes will appear once configured" />}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  h2: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },
  enrolledBanner: { padding: theme.spacing.lg, borderRadius: theme.radius.lg, ...theme.shadow.lg },
  enrolledTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  enrolledSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  deEnrollBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, marginTop: 10, alignSelf: 'flex-start' },
  deEnrollTxt: { color: '#fff', fontWeight: '600', fontSize: 12 },
  routeIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  routeName: { fontWeight: '700', color: theme.colors.onSurface, fontSize: 16 },
  routeMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  driverTxt: { color: theme.colors.onSurfaceTertiary, fontSize: 12, marginRight: 8 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  scheduleTxt: { color: theme.colors.onSurfaceTertiary, fontSize: 12 },
  stopsWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: theme.colors.divider },
  stopsTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 6 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 3 },
  stopTxt: { color: theme.colors.onSurface, fontSize: 13, flex: 1 },
  stopTime: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
});
