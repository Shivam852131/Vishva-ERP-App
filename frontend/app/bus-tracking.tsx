import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useFetch } from '@/src/hooks/useFetch';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import type { TransportRoute } from '@/src/types';
import {
  ArrowLeft, Bus, Clock, User, Phone,
  Signal, ChevronDown, ChevronUp,
} from 'lucide-react-native';
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';
import { subscribeRealtime } from '@/src/realtime/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getTimeDiff(timeStr: string) {
  if (!timeStr) return null;
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  const diff = target.getTime() - now.getTime();
  if (diff < 0) return 'Departed';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

const ROUTE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6'];

export default function BusTracking() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [tab, setTab] = useState<'live' | 'schedule'>('live');
  const [refreshing, setRefreshing] = useState(false);

  const { data: routes, loading, refresh } = useFetch<TransportRoute[]>('/transport/routes');

  const routesSafe = routes || [];

  useEffect(() => {
    const unsub1 = subscribeRealtime<any>('transport:enrolled', () => refresh());
    const unsub2 = subscribeRealtime<any>('transport:deenrolled', () => refresh());
    return () => { unsub1(); unsub2(); };
  }, [refresh]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroGrad}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#fff" />
            </Pressable>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}><Bus size={22} color="#fff" /></View>
              <View>
                <Text style={styles.heroTitle}>Bus Tracking</Text>
                <Text style={styles.heroSub}>Live campus bus tracking & schedules</Text>
              </View>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>{routesSafe.length}</Text>
                <Text style={styles.heroStatLabel}>Routes</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>{routesSafe.reduce((s, r) => s + (r.stops?.length || 0), 0)}</Text>
                <Text style={styles.heroStatLabel}>Stops</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>{routesSafe.length > 0 ? 'Active' : '--'}</Text>
                <Text style={styles.heroStatLabel}>Status</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.tabs}>
          {(['live', 'schedule'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
                {t === 'live' ? 'Live Tracking' : 'Schedule'}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          {loading && !refreshing ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={theme.colors.brandPrimary} size="large" />
              <Text style={styles.loadingTxt}>Loading routes...</Text>
            </View>
          ) : routesSafe.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}><Bus size={40} color={theme.colors.muted} /></View>
              <Text style={styles.emptyTitle}>No Routes Available</Text>
              <Text style={styles.emptySub}>Transport routes will appear here once configured</Text>
            </View>
          ) : tab === 'live' ? (
            <>
              {routesSafe.map((route, idx) => {
                const isSelected = selectedRoute === route.id;
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                const nextStop = route.stops?.[0]?.name || 'N/A';
                return (
                  <Animated.View key={route.id} entering={SlideInRight.delay(idx * 50)}>
                    <Pressable onPress={() => setSelectedRoute(isSelected ? null : route.id)}>
                      <View style={[styles.routeCard, isSelected && styles.routeCardActive]}>
                        <View style={styles.routeTop}>
                          <View style={[styles.routeDot, { backgroundColor: color }]} />
                          <View style={styles.routeInfo}>
                            <Text style={styles.routeName} numberOfLines={1} ellipsizeMode="tail">{route.route_name}</Text>
                            <Text style={styles.routeMeta} numberOfLines={1} ellipsizeMode="tail">{route.vehicle_number} · {route.driver_name}</Text>
                          </View>
                          <View style={styles.routeRight}>
                            <Signal size={14} color="#10B981" />
                            {isSelected ? <ChevronUp size={16} color={theme.colors.muted} /> : <ChevronDown size={16} color={theme.colors.muted} />}
                          </View>
                        </View>

                        {isSelected && (
                          <Animated.View entering={FadeInDown} style={styles.routeExpanded}>
                            <View style={styles.stopsSection}>
                              <Text style={styles.sectionLabel}>Route Stops ({route.stops?.length || 0})</Text>
                              {route.stops && route.stops.length > 0 ? (
                                route.stops.map((stop, i) => {
                                  const next = getTimeDiff(stop.time);
                                  const isFirst = i === 0;
                                  const isLast = i === (route.stops?.length || 0) - 1;
                                  return (
                                    <View key={i} style={styles.stopItem}>
                                      <View style={styles.stopTimeline}>
                                        <View style={[styles.stopDot, isFirst && styles.stopDotFirst, isLast && styles.stopDotLast]} />
                                        {!isLast && <View style={styles.stopLine} />}
                                      </View>
                                      <View style={styles.stopContent}>
                                        <Text style={styles.stopName} numberOfLines={1} ellipsizeMode="tail">{stop.name}</Text>
                                        <View style={styles.stopMeta}>
                                          <Clock size={10} color={theme.colors.muted} />
                                          <Text style={styles.stopTime}>{stop.time || '--:--'}</Text>
                                          {next && next !== 'Departed' && (
                                            <View style={styles.timeBadge}>
                                              <Text style={styles.timeBadgeTxt}>in {next}</Text>
                                            </View>
                                          )}
                                          {next === 'Departed' && (
                                            <View style={[styles.timeBadge, styles.timeBadgeGone]}>
                                              <Text style={[styles.timeBadgeTxt, styles.timeBadgeTxtGone]}>Departed</Text>
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                    </View>
                                  );
                                })
                              ) : (
                                <Text style={styles.noStops}>No stops defined</Text>
                              )}
                            </View>

                            <View style={styles.driverCard}>
                              <View style={styles.driverLabel}>
                                <Text style={styles.driverLabelText}>DRIVER</Text>
                              </View>
                              <View style={styles.driverRow}>
                                <View style={styles.driverAvatar}>
                                  <User size={18} color="#FFF" />
                                </View>
                                <View style={styles.driverInfo}>
                                  <Text style={styles.driverName} numberOfLines={1} ellipsizeMode="tail">{route.driver_name}</Text>
                                  <Text style={styles.driverPhone} numberOfLines={1} ellipsizeMode="tail">{route.driver_phone || 'No phone'}</Text>
                                </View>
                                {route.driver_phone && (
                                  <View style={styles.callBtn}><Phone size={14} color="#FFF" /></View>
                                )}
                              </View>
                            </View>
                          </Animated.View>
                        )}
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </>
          ) : (
            <>
              <Text style={styles.scheduleTitle}>All Route Timings</Text>
              {routesSafe.map((route, idx) => (
                <Animated.View key={route.id} entering={SlideInRight.delay(idx * 30)}>
                  <View style={styles.scheduleCard}>
                    <View style={styles.scheduleHeader}>
                      <Bus size={14} color={theme.colors.brandPrimary} />
                      <Text style={styles.scheduleRouteName} numberOfLines={1} ellipsizeMode="tail">{route.route_name}</Text>
                      <Text style={styles.scheduleVehicle} numberOfLines={1} ellipsizeMode="tail">{route.vehicle_number}</Text>
                    </View>
                    <View style={styles.scheduleStops}>
                      {route.stops?.map((stop, i) => (
                        <View key={i} style={styles.scheduleStopRow}>
                          <View style={styles.scheduleStopDot} />
                          <Text style={styles.scheduleStopName} numberOfLines={1} ellipsizeMode="tail">{stop.name}</Text>
                          <Text style={styles.scheduleStopTime}>{stop.time || '--:--'}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.scheduleFooter}>
                      <View style={styles.scheduleMetaItem}>
                        <User size={10} color={theme.colors.muted} />
                        <Text style={styles.scheduleMetaTxt} numberOfLines={1} ellipsizeMode="tail">{route.driver_name}</Text>
                      </View>
                      {route.driver_phone && (
                        <View style={styles.scheduleMetaItem}>
                          <Phone size={10} color={theme.colors.muted} />
                          <Text style={styles.scheduleMetaTxt}>{route.driver_phone}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Animated.View>
              ))}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  hero: { marginBottom: 0 },
  heroGrad: { backgroundColor: '#6366F1', paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 12 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  heroStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginTop: 4 },
  heroStat: { alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brandPrimary },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 13 },
  tabTxtActive: { color: '#FFF' },

  scrollContent: { paddingHorizontal: 16, gap: 12 },

  loadingWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  loadingTxt: { fontSize: 13, color: theme.colors.muted },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptySub: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', paddingHorizontal: 20 },

  routeCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  routeCardActive: { borderColor: theme.colors.brandPrimary, borderLeftWidth: 3 },
  routeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  routeInfo: { flex: 1, minWidth: 0 },
  routeName: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  routeMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  routeRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },

  routeExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text },

  stopsSection: { gap: 0 },
  stopItem: { flexDirection: 'row' },
  stopTimeline: { width: 24, alignItems: 'center', flexShrink: 0 },
  stopDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.brandPrimary, marginVertical: 4 },
  stopDotFirst: { backgroundColor: '#10B981' },
  stopDotLast: { backgroundColor: '#EF4444' },
  stopLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, minHeight: 16 },
  stopContent: { flex: 1, paddingBottom: 8, minWidth: 0 },
  stopName: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  stopMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stopTime: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  timeBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(99,102,241,0.1)' },
  timeBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#6366F1' },
  timeBadgeGone: { backgroundColor: 'rgba(239,68,68,0.1)' },
  timeBadgeTxtGone: { color: '#EF4444' },
  noStops: { fontSize: 12, color: theme.colors.muted, fontStyle: 'italic', paddingVertical: 8 },

  driverCard: { backgroundColor: theme.colors.bg, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  driverLabel: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  driverLabelText: { fontSize: 10, fontWeight: '700', color: theme.colors.muted },
  driverRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 10 },
  driverAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  driverInfo: { flex: 1, minWidth: 0 },
  driverName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  driverPhone: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  scheduleTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  scheduleCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  scheduleRouteName: { fontSize: 14, fontWeight: '700', color: theme.colors.text, flex: 1, minWidth: 0 },
  scheduleVehicle: { fontSize: 11, color: theme.colors.muted, flexShrink: 0 },
  scheduleStops: { paddingLeft: 4 },
  scheduleStopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  scheduleStopDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.brandPrimary, flexShrink: 0 },
  scheduleStopName: { flex: 1, fontSize: 12, color: theme.colors.text, minWidth: 0 },
  scheduleStopTime: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', flexShrink: 0 },
  scheduleFooter: { flexDirection: 'row', gap: 16, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  scheduleMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scheduleMetaTxt: { fontSize: 10, color: theme.colors.muted },
});
