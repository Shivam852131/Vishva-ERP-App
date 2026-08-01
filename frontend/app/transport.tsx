import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  RefreshControl, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import type { TransportRoute, TransportEnrollment } from '@/src/types';
import {
  ArrowLeft, Bus, MapPin, Clock, User, Phone, CheckCircle2, XCircle,
  Search, ChevronDown, ChevronUp, Navigation, AlertTriangle,
  Route, X, Shield,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { router } from '@/src/navigation/router';
import { subscribeRealtime } from '@/src/realtime/socket';

function formatTime(t: string) {
  if (!t) return '--:--';
  return t;
}

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

type Tab = 'routes' | 'myroute' | 'schedule';

export default function TransportScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('routes');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<TransportRoute | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);

  const { data: routes, loading, refresh } = useFetch<TransportRoute[]>('/transport/routes');
  const { data: myRoute, loading: myRouteLoading, refresh: refreshMyRoute } = useFetch<TransportEnrollment>(
    user?.role === 'student' ? '/transport/my-route' : null
  );
  const { mutate: enrollApi, loading: enrolling } = useMutate();
  const { mutate: deEnrollApi, loading: deEnrolling } = useMutate();

  const routesSafe = routes || [];
  const isEnrolled = !!myRoute;

  useEffect(() => {
    const unsub1 = subscribeRealtime<{ route_id: string; student_id: string }>('transport:enrolled', () => {
      refresh();
      refreshMyRoute();
    });
    const unsub2 = subscribeRealtime<{ route_id: string; student_id: string }>('transport:deenrolled', () => {
      refresh();
      refreshMyRoute();
    });
    return () => { unsub1(); unsub2(); };
  }, [refresh, refreshMyRoute]);

  const filteredRoutes = routesSafe.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.route_name.toLowerCase().includes(q) ||
      r.vehicle_number.toLowerCase().includes(q) ||
      r.driver_name.toLowerCase().includes(q) ||
      r.stops.some(s => s.name.toLowerCase().includes(q))
    );
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    refreshMyRoute();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh, refreshMyRoute]);

  const handleEnroll = async (routeId: string) => {
    try {
      await enrollApi('/transport/enroll', { method: 'POST', body: JSON.stringify({ routeId }) });
      setShowEnrollModal(false);
      setSelectedRoute(null);
      Alert.alert('Enrolled', 'You have been enrolled in this route successfully');
      refresh();
      refreshMyRoute();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not enroll');
    }
  };

  const handleDeEnroll = async () => {
    if (!myRoute) return;
    Alert.alert('De-enroll', 'Are you sure you want to de-enroll from this route?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'De-enroll',
        style: 'destructive',
        onPress: async () => {
          try {
            await deEnrollApi(`/transport/deenroll/${myRoute.route_id}`, { method: 'POST' });
            Alert.alert('Done', 'You have been de-enrolled');
            refresh();
            refreshMyRoute();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not de-enroll');
          }
        },
      },
    ]);
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={20} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Transport</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Routes', value: routesSafe.length, color: '#6366F1', icon: <Route size={14} color="#6366F1" /> },
            { label: 'My Route', value: isEnrolled ? 1 : 0, color: isEnrolled ? '#10B981' : '#9CA3AF', icon: <Bus size={14} color={isEnrolled ? '#10B981' : '#9CA3AF'} /> },
            { label: 'Stops', value: routesSafe.reduce((s, r) => s + (r.stops?.length || 0), 0), color: '#F59E0B', icon: <MapPin size={14} color="#F59E0B" /> },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <View style={styles.statRow}>{s.icon}<Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text></View>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabs}>
          {(['routes', 'myroute', 'schedule'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
                {t === 'routes' ? 'All Routes' : t === 'myroute' ? 'My Route' : 'Schedule'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'routes' && (
          <View style={styles.searchWrap}>
            <Search size={16} color={theme.colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search routes, stops, driver..."
              placeholderTextColor={theme.colors.muted}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <X size={14} color={theme.colors.muted} />
              </Pressable>
            )}
          </View>
        )}

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          {loading && !refreshing ? (
            <View style={styles.loadingWrap}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /><Text style={styles.loadingTxt}>Loading routes...</Text></View>
          ) : tab === 'routes' ? (
            filteredRoutes.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}><Bus size={40} color={theme.colors.muted} /></View>
                <Text style={styles.emptyTitle}>{search ? 'No routes found' : 'No routes available'}</Text>
                <Text style={styles.emptySub}>{search ? 'Try a different search' : 'Transport routes will appear here'}</Text>
              </View>
            ) : (
              filteredRoutes.map((route, idx) => {
                const isExpanded = expandedRoute === route.id;
                const isMyRoute = myRoute?.route_id === route.id;
                return (
                  <Animated.View key={route.id} entering={SlideInRight.delay(idx * 30)}>
                    <View style={[styles.routeCard, isMyRoute && styles.routeCardActive]}>
                      <Pressable onPress={() => setExpandedRoute(isExpanded ? null : route.id)}>
                        <View style={styles.routeTop}>
                          <View style={styles.routeLeft}>
                            <View style={[styles.routeIconWrap, { backgroundColor: isMyRoute ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)' }]}>
                              <Bus size={20} color={isMyRoute ? '#10B981' : '#6366F1'} />
                            </View>
                            <View style={styles.routeInfo}>
                              <Text style={styles.routeName} numberOfLines={1} ellipsizeMode="tail">{route.route_name}</Text>
                              <Text style={styles.routeVehicle} numberOfLines={1} ellipsizeMode="tail">{route.vehicle_number}</Text>
                            </View>
                          </View>
                          <View style={styles.routeRight}>
                            {isMyRoute && (
                              <View style={styles.enrolledBadge}>
                                <CheckCircle2 size={10} color="#10B981" />
                                <Text style={styles.enrolledBadgeTxt}>Enrolled</Text>
                              </View>
                            )}
                            {isExpanded ? <ChevronUp size={16} color={theme.colors.muted} /> : <ChevronDown size={16} color={theme.colors.muted} />}
                          </View>
                        </View>

                        <View style={styles.routeMetaRow}>
                          <View style={styles.routeMetaItem}>
                            <User size={12} color={theme.colors.muted} />
                            <Text style={styles.routeMetaTxt} numberOfLines={1} ellipsizeMode="tail">{route.driver_name}</Text>
                          </View>
                          {route.driver_phone && (
                            <View style={styles.routeMetaItem}>
                              <Phone size={12} color={theme.colors.muted} />
                              <Text style={styles.routeMetaTxt}>{route.driver_phone}</Text>
                            </View>
                          )}
                          <View style={styles.routeMetaItem}>
                            <MapPin size={12} color={theme.colors.muted} />
                            <Text style={styles.routeMetaTxt}>{route.stops?.length || 0} stops</Text>
                          </View>
                        </View>
                      </Pressable>

                      {isExpanded && (
                        <Animated.View entering={FadeInDown} style={styles.routeExpanded}>
                          <View style={styles.routeExpandedHeader}>
                            <Text style={styles.routeExpandedTitle}>Route Stops</Text>
                            <Text style={styles.routeExpandedCount}>{route.stops?.length || 0} stops</Text>
                          </View>
                          {route.stops && route.stops.length > 0 ? (
                            <View style={styles.stopsContainer}>
                              {route.stops.map((stop, i) => {
                                const nextDeparture = getTimeDiff(stop.time);
                                const isFirst = i === 0;
                                const isLast = i === (route.stops?.length || 0) - 1;
                                return (
                                  <View key={i} style={styles.stopItem}>
                                    <View style={styles.stopTimeline}>
                                      <View style={[styles.stopDot, isFirst && styles.stopDotFirst, isLast && styles.stopDotLast]} />
                                      {i < (route.stops?.length || 0) - 1 && <View style={styles.stopLine} />}
                                    </View>
                                    <View style={styles.stopContent}>
                                      <View style={styles.stopHeader}>
                                        <Text style={styles.stopName} numberOfLines={1} ellipsizeMode="tail">{stop.name}</Text>
                                        <View style={styles.stopTimeWrap}>
                                          <Clock size={10} color={theme.colors.muted} />
                                          <Text style={styles.stopTime}>{formatTime(stop.time)}</Text>
                                          {nextDeparture && nextDeparture !== 'Departed' && (
                                            <View style={styles.nextBadge}>
                                              <Text style={styles.nextBadgeTxt}>{nextDeparture}</Text>
                                            </View>
                                          )}
                                          {nextDeparture === 'Departed' && (
                                            <View style={[styles.nextBadge, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                              <Text style={[styles.nextBadgeTxt, { color: '#EF4444' }]}>Departed</Text>
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          ) : (
                            <Text style={styles.noStops}>No stops defined</Text>
                          )}

                          <View style={styles.driverCard}>
                            <View style={styles.driverCardHeader}>
                              <Text style={styles.driverCardTitle}>Driver Details</Text>
                            </View>
                            <View style={styles.driverCardRow}>
                              <View style={styles.driverAvatar}>
                                <User size={20} color="#FFF" />
                              </View>
                              <View style={styles.driverCardInfo}>
                                <Text style={styles.driverCardName} numberOfLines={1} ellipsizeMode="tail">{route.driver_name}</Text>
                                <Text style={styles.driverCardPhone} numberOfLines={1} ellipsizeMode="tail">{route.driver_phone || 'No phone'}</Text>
                              </View>
                              {route.driver_phone && (
                                <Pressable style={styles.callBtn} onPress={() => Alert.alert('Call', `Calling ${route.driver_name}...`)}>
                                  <Phone size={16} color="#FFF" />
                                </Pressable>
                              )}
                            </View>
                          </View>

                          {user?.role === 'student' && !isMyRoute && (
                            <Pressable
                              style={styles.enrollBtn}
                              onPress={() => { setSelectedRoute(route); setShowEnrollModal(true); }}
                              disabled={enrolling}
                            >
                              {enrolling ? (
                                <ActivityIndicator color="#FFF" size={16} />
                              ) : (
                                <>
                                  <Bus size={16} color="#FFF" />
                                  <Text style={styles.enrollBtnTxt}>Enroll in this Route</Text>
                                </>
                              )}
                            </Pressable>
                          )}
                        </Animated.View>
                      )}
                    </View>
                  </Animated.View>
                );
              })
            )
          ) : tab === 'myroute' ? (
            myRouteLoading ? (
              <View style={styles.loadingWrap}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /></View>
            ) : !isEnrolled ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}><Bus size={40} color={theme.colors.muted} /></View>
                <Text style={styles.emptyTitle}>Not Enrolled</Text>
                <Text style={styles.emptySub}>You haven't enrolled in any transport route yet</Text>
                <Pressable style={styles.goToRoutesBtn} onPress={() => setTab('routes')}>
                  <Route size={16} color={theme.colors.brandPrimary} />
                  <Text style={styles.goToRoutesTxt}>Browse Routes</Text>
                </Pressable>
              </View>
            ) : (
              <Animated.View entering={FadeInUp}>
                {(() => {
                  const enrolledRoute = routesSafe.find(r => r.id === myRoute.route_id);
                  return enrolledRoute ? (
                    <>
                      <View style={styles.myRouteBanner}>
                        <View style={styles.myRouteBannerRow}>
                          <CheckCircle2 size={22} color="#FFF" />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.myRouteTitle} numberOfLines={1} ellipsizeMode="tail">{enrolledRoute.route_name}</Text>
                            <Text style={styles.myRouteSub}>Active enrollment · {enrolledRoute.vehicle_number}</Text>
                          </View>
                        </View>
                        <View style={styles.myRouteStats}>
                          {enrolledRoute.stops?.map((stop, i) => (
                            <View key={i} style={styles.myRouteStopDot} />
                          ))}
                        </View>
                      </View>

                      <View style={styles.myRouteDetails}>
                        <View style={styles.myRouteDetailCard}>
                          <View style={styles.myRouteDetailRow}>
                            <User size={16} color={theme.colors.brandPrimary} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.myRouteDetailLabel}>Driver</Text>
                              <Text style={styles.myRouteDetailValue} numberOfLines={1} ellipsizeMode="tail">{enrolledRoute.driver_name}</Text>
                            </View>
                            {enrolledRoute.driver_phone && (
                              <Pressable style={styles.myRouteCallBtn} onPress={() => Alert.alert('Call', `Calling ${enrolledRoute.driver_name}...`)}>
                                <Phone size={16} color="#FFF" />
                              </Pressable>
                            )}
                          </View>
                        </View>

                        <View style={styles.myRouteDetailCard}>
                          <View style={styles.myRouteDetailRow}>
                            <Bus size={16} color="#6366F1" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.myRouteDetailLabel}>Vehicle</Text>
                              <Text style={styles.myRouteDetailValue} numberOfLines={1} ellipsizeMode="tail">{enrolledRoute.vehicle_number}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.myRouteDetailCard}>
                          <View style={styles.myRouteDetailRow}>
                            <Navigation size={16} color="#10B981" />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.myRouteDetailLabel}>Stops</Text>
                              <Text style={styles.myRouteDetailValue}>{enrolledRoute.stops?.length || 0} stops on route</Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      <View style={styles.myRouteStopsSection}>
                        <Text style={styles.myRouteStopsTitle}>Your Route Schedule</Text>
                        {enrolledRoute.stops && enrolledRoute.stops.length > 0 ? (
                          enrolledRoute.stops.map((stop, i) => {
                            const nextDeparture = getTimeDiff(stop.time);
                            const isFirst = i === 0;
                            const isLast = i === (enrolledRoute.stops?.length || 0) - 1;
                            return (
                              <View key={i} style={styles.myRouteStopItem}>
                                <View style={styles.myRouteStopLeft}>
                                  <View style={[styles.myRouteStopDot2, isFirst && styles.myRouteStopDotFirst, isLast && styles.myRouteStopDotLast]} />
                                  {i < (enrolledRoute.stops?.length || 0) - 1 && <View style={styles.myRouteStopLine} />}
                                </View>
                                <View style={styles.myRouteStopContent}>
                                  <Text style={styles.myRouteStopName} numberOfLines={1} ellipsizeMode="tail">{stop.name}</Text>
                                  <View style={styles.myRouteStopMeta}>
                                    <Clock size={10} color={theme.colors.muted} />
                                    <Text style={styles.myRouteStopTime}>{formatTime(stop.time)}</Text>
                                    {nextDeparture && nextDeparture !== 'Departed' && (
                                      <View style={styles.myRouteStopBadge}>
                                        <Text style={styles.myRouteStopBadgeTxt}>in {nextDeparture}</Text>
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

                      <Pressable style={styles.deEnrollBtn} onPress={handleDeEnroll} disabled={deEnrolling}>
                        {deEnrolling ? (
                          <ActivityIndicator color="#EF4444" size={16} />
                        ) : (
                          <>
                            <XCircle size={16} color="#EF4444" />
                            <Text style={styles.deEnrollTxt}>De-enroll from Route</Text>
                          </>
                        )}
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.emptyWrap}>
                      <View style={styles.emptyIconWrap}><AlertTriangle size={40} color="#F59E0B" /></View>
                      <Text style={styles.emptyTitle}>Route Not Found</Text>
                      <Text style={styles.emptySub}>The enrolled route data is unavailable</Text>
                    </View>
                  );
                })()}
              </Animated.View>
            )
          ) : (
            <View style={styles.scheduleSection}>
              <Text style={styles.scheduleTitle}>All Route Timings</Text>
              {routesSafe.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptySub}>No routes available</Text>
                </View>
              ) : (
                routesSafe.map((route, idx) => (
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
                            <Text style={styles.scheduleStopTime}>{formatTime(stop.time)}</Text>
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
                ))
              )}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>

        <Modal visible={showEnrollModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Animated.View entering={FadeInUp} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Confirm Enrollment</Text>
                <Pressable onPress={() => { setShowEnrollModal(false); setSelectedRoute(null); }} hitSlop={8}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>

              {selectedRoute && (
                <>
                  <View style={styles.modalRouteCard}>
                    <View style={styles.modalRouteIconWrap}>
                      <Bus size={24} color={theme.colors.brandPrimary} />
                    </View>
                    <Text style={styles.modalRouteName} numberOfLines={1} ellipsizeMode="tail">{selectedRoute.route_name}</Text>
                    <Text style={styles.modalRouteVehicle} numberOfLines={1} ellipsizeMode="tail">{selectedRoute.vehicle_number}</Text>

                    <View style={styles.modalRouteStops}>
                      {selectedRoute.stops?.map((stop, i) => {
                        const isFirst = i === 0;
                        const isLast = i === (selectedRoute.stops?.length || 0) - 1;
                        return (
                          <View key={i} style={styles.modalStopItem}>
                            <View style={[styles.modalStopDot, isFirst && styles.modalStopDotFirst, isLast && styles.modalStopDotLast]} />
                            {i < (selectedRoute.stops?.length || 0) - 1 && <View style={styles.modalStopLine} />}
                            <View style={styles.modalStopContent}>
                              <Text style={styles.modalStopName} numberOfLines={1} ellipsizeMode="tail">{stop.name}</Text>
                              <Text style={styles.modalStopTime}>{formatTime(stop.time)}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.modalDriverRow}>
                      <User size={12} color={theme.colors.muted} />
                      <Text style={styles.modalDriverTxt} numberOfLines={1} ellipsizeMode="tail">{selectedRoute.driver_name}</Text>
                      {selectedRoute.driver_phone && (
                        <>
                          <Phone size={12} color={theme.colors.muted} />
                          <Text style={styles.modalDriverTxt}>{selectedRoute.driver_phone}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  <View style={styles.modalNotice}>
                    <Shield size={14} color="#F59E0B" />
                    <Text style={styles.modalNoticeTxt}>By enrolling, you agree to use the college transport facility as per the institution's transport policy.</Text>
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable style={styles.modalCancelBtn} onPress={() => { setShowEnrollModal(false); setSelectedRoute(null); }}>
                      <Text style={styles.modalCancelTxt}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.modalConfirmBtn} onPress={() => selectedRoute && handleEnroll(selectedRoute.id)} disabled={enrolling}>
                      {enrolling ? (
                        <ActivityIndicator color="#FFF" size={16} />
                      ) : (
                        <>
                          <CheckCircle2 size={16} color="#FFF" />
                          <Text style={styles.modalConfirmTxt}>Confirm Enrollment</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              )}
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  statCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.colors.border },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },

  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brandPrimary },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 11 },
  tabTxtActive: { color: '#FFF' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.text, padding: 0 },

  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  loadingWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  loadingTxt: { fontSize: 13, color: theme.colors.muted },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptySub: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', paddingHorizontal: 20 },
  goToRoutesBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  goToRoutesTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.brandPrimary },

  routeCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  routeCardActive: { borderColor: '#10B981', borderLeftWidth: 3 },
  routeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  routeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  routeIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  routeInfo: { flex: 1, minWidth: 0 },
  routeName: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  routeVehicle: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  routeRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  enrolledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(16,185,129,0.1)' },
  enrolledBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#10B981' },

  routeMetaRow: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  routeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeMetaTxt: { fontSize: 11, color: theme.colors.muted },

  routeExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  routeExpandedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routeExpandedTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  routeExpandedCount: { fontSize: 11, color: theme.colors.muted },

  stopsContainer: { paddingLeft: 4 },
  stopItem: { flexDirection: 'row', marginBottom: 0 },
  stopTimeline: { width: 24, alignItems: 'center', flexShrink: 0 },
  stopDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.brandPrimary, marginVertical: 4 },
  stopDotFirst: { backgroundColor: '#10B981' },
  stopDotLast: { backgroundColor: '#EF4444' },
  stopLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, minHeight: 16 },
  stopContent: { flex: 1, paddingBottom: 8, minWidth: 0 },
  stopHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stopName: { fontSize: 13, fontWeight: '600', color: theme.colors.text, flex: 1, minWidth: 0 },
  stopTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  stopTime: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  nextBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(99,102,241,0.1)' },
  nextBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#6366F1' },

  noStops: { fontSize: 12, color: theme.colors.muted, fontStyle: 'italic', paddingVertical: 8 },

  driverCard: { marginTop: 12, backgroundColor: theme.colors.bg, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  driverCardHeader: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  driverCardTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase' },
  driverCardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, gap: 10 },
  driverAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  driverCardInfo: { flex: 1, minWidth: 0 },
  driverCardName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  driverCardPhone: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  callBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  enrollBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingVertical: 12, borderRadius: 10, marginTop: 12 },
  enrollBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  myRouteBanner: { backgroundColor: theme.colors.brandPrimary, borderRadius: 12, padding: 16, marginHorizontal: 0, marginBottom: 12 },
  myRouteBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRouteTitle: { fontSize: 16, fontWeight: '800', color: '#FFF', flex: 1, minWidth: 0 },
  myRouteSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  myRouteStats: { flexDirection: 'row', gap: 4, marginTop: 10 },
  myRouteStopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },

  myRouteDetails: { gap: 8, marginBottom: 12 },
  myRouteDetailCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  myRouteDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRouteDetailLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.muted, textTransform: 'uppercase' },
  myRouteDetailValue: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 1, flex: 1, minWidth: 0 },
  myRouteCallBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  myRouteStopsSection: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  myRouteStopsTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  myRouteStopItem: { flexDirection: 'row' },
  myRouteStopLeft: { width: 24, alignItems: 'center', flexShrink: 0 },
  myRouteStopDot2: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.brandPrimary, marginVertical: 4 },
  myRouteStopDotFirst: { backgroundColor: '#10B981' },
  myRouteStopDotLast: { backgroundColor: '#EF4444' },
  myRouteStopLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, minHeight: 16 },
  myRouteStopContent: { flex: 1, paddingBottom: 8, minWidth: 0 },
  myRouteStopName: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  myRouteStopMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  myRouteStopTime: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  myRouteStopBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: 'rgba(99,102,241,0.1)' },
  myRouteStopBadgeTxt: { fontSize: 9, fontWeight: '700', color: '#6366F1' },

  deEnrollBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.05)' },
  deEnrollTxt: { fontSize: 13, fontWeight: '700', color: '#EF4444' },

  scheduleSection: { paddingTop: 4 },
  scheduleTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 10 },
  scheduleCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  modalRouteCard: { alignItems: 'center', backgroundColor: theme.colors.bg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  modalRouteIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modalRouteName: { fontSize: 16, fontWeight: '800', color: theme.colors.text, textAlign: 'center', marginBottom: 2 },
  modalRouteVehicle: { fontSize: 12, color: theme.colors.muted, marginBottom: 12 },
  modalRouteStops: { width: '100%', paddingLeft: 4, marginBottom: 12 },
  modalStopItem: { flexDirection: 'row' },
  modalStopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brandPrimary, marginTop: 4, marginHorizontal: 3, flexShrink: 0 },
  modalStopDotFirst: { backgroundColor: '#10B981' },
  modalStopDotLast: { backgroundColor: '#EF4444' },
  modalStopLine: { width: 2, backgroundColor: theme.colors.border, minHeight: 12, marginHorizontal: 3 },
  modalStopContent: { flex: 1, paddingBottom: 6, minWidth: 0 },
  modalStopName: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
  modalStopTime: { fontSize: 10, color: theme.colors.muted },
  modalDriverRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  modalDriverTxt: { fontSize: 11, color: theme.colors.muted },
  modalNotice: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8, marginBottom: 16, alignItems: 'flex-start' },
  modalNoticeTxt: { fontSize: 11, color: '#F59E0B', flex: 1, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  modalCancelTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.muted },
  modalConfirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.colors.brandPrimary },
  modalConfirmTxt: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
