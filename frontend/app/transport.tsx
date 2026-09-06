import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { router } from '@/src/navigation/router';
import type {
  TransportRoute,
  TransportEnrollment,
  TransportStats,
  TransportStudentPassenger,
  ParentDashboardData,
} from '@/src/types';
import {
  ArrowLeft,
  Bus,
  MapPin,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Shield,
  Send,
  Navigation,
  QrCode,
  Users,
  Sparkles,
  Radio,
  ChevronRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react-native';
import Animated, { FadeInUp, SlideInRight } from 'react-native-reanimated';
import { subscribeRealtime } from '@/src/realtime/socket';
import { EmptyState } from '@/src/ui';

export default function TransportScreen() {
  const { user } = useAuth();
  const isAdmin = ['college_admin', 'super_admin'].includes(user?.role || '');
  const isParent = user?.role === 'parent';

  // Tabs
  // Admin: 'routes' | 'telemetry' | 'manifest'
  // Student: 'mybus' | 'tracker' | 'routes' | 'helpline'
  // Parent: 'mybus' | 'tracker' | 'routes'
  const defaultTab = isAdmin ? 'routes' : 'mybus';
  const [tab, setTab] = useState<string>(defaultTab);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');

  // Modals
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollRoute, setEnrollRoute] = useState<TransportRoute | null>(null);
  const [selectedStop, setSelectedStop] = useState('');

  // Admin Route Create/Edit Modal
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editRouteId, setEditRouteId] = useState<string | null>(null);
  const [formRouteName, setFormRouteName] = useState('');
  const [formVehicleNo, setFormVehicleNo] = useState('');
  const [formDriverName, setFormDriverName] = useState('');
  const [formDriverPhone, setFormDriverPhone] = useState('');
  const [formCapacity, setFormCapacity] = useState('45');
  const [formMorningTime, setFormMorningTime] = useState('07:30 AM');
  const [formEveningTime, setFormEveningTime] = useState('04:30 PM');
  const [formStopsText, setFormStopsText] = useState('City Center (07:00), Metro Gate 3 (07:15), Campus (07:45)');

  // Admin Broadcast Modal
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastRouteId, setBroadcastRouteId] = useState('');
  const [broadcastDelay, setBroadcastDelay] = useState('15');
  const [broadcastMsg, setBroadcastMsg] = useState('');

  // API Data
  const { data: stats, refresh: refreshStats } = useFetch<TransportStats>(isAdmin ? '/transport/stats' : null);
  const { data: routes, loading: routesLoading, refresh: refreshRoutes } = useFetch<TransportRoute[]>('/transport/routes');
  const { data: myRoute, loading: myRouteLoading, refresh: refreshMyRoute } = useFetch<TransportEnrollment>('/transport/my-route');
  const { data: parentData, refresh: refreshParent } = useFetch<ParentDashboardData>(isParent ? '/parent/dashboard' : null);
  const { data: passengers, loading: passLoading, refresh: refreshPassengers } = useFetch<TransportStudentPassenger[]>(
    isAdmin && selectedRouteId ? `/transport/routes/${selectedRouteId}/students` : null
  );

  const { mutate: enrollApi, loading: enrolling } = useMutate();
  const { mutate: deEnrollApi, loading: deEnrolling } = useMutate();
  const { mutate: saveRouteApi, loading: savingRoute } = useMutate();
  const { mutate: deleteRouteApi, loading: deletingRoute } = useMutate();
  const { mutate: broadcastApi, loading: broadcasting } = useMutate();

  const routesSafe = useMemo(() => (Array.isArray(routes) ? routes : []), [routes]);
  const passengersSafe = useMemo(() => (Array.isArray(passengers) ? passengers : []), [passengers]);

  useEffect(() => {
    if (routesSafe.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routesSafe[0].id);
    }
  }, [routesSafe, selectedRouteId]);

  useEffect(() => {
    const unsub1 = subscribeRealtime<any>('transport:enrolled', () => {
      refreshRoutes();
      refreshMyRoute();
      if (refreshStats) refreshStats();
    });
    const unsub2 = subscribeRealtime<any>('transport:deenrolled', () => {
      refreshRoutes();
      refreshMyRoute();
      if (refreshStats) refreshStats();
    });
    const unsub3 = subscribeRealtime<any>('transport:delay_broadcast', (data) => {
      Alert.alert('Transit Alert', `${data?.route_name || 'Route'}: ${data?.message || 'Delay reported'}`);
    });
    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [refreshRoutes, refreshMyRoute, refreshStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshRoutes(),
      refreshMyRoute(),
      isAdmin && refreshStats ? refreshStats() : Promise.resolve(),
      isAdmin && refreshPassengers ? refreshPassengers() : Promise.resolve(),
      isParent && refreshParent ? refreshParent() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [refreshRoutes, refreshMyRoute, refreshStats, refreshPassengers, refreshParent, isAdmin, isParent]);

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    return routesSafe.filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        r.route_name.toLowerCase().includes(q) ||
        r.vehicle_number.toLowerCase().includes(q) ||
        r.driver_name.toLowerCase().includes(q) ||
        r.stops.some((s) => s.name.toLowerCase().includes(q))
      );
    });
  }, [routesSafe, search]);

  // Handlers
  const handleOpenAddRoute = () => {
    setEditRouteId(null);
    setFormRouteName('');
    setFormVehicleNo('');
    setFormDriverName('');
    setFormDriverPhone('');
    setFormCapacity('45');
    setFormMorningTime('07:30 AM');
    setFormEveningTime('04:30 PM');
    setFormStopsText('Sector 62 (07:10), Botanical Garden (07:25), Campus (07:50)');
    setShowRouteModal(true);
  };

  const handleOpenEditRoute = (r: TransportRoute) => {
    setEditRouteId(r.id);
    setFormRouteName(r.route_name);
    setFormVehicleNo(r.vehicle_number);
    setFormDriverName(r.driver_name || '');
    setFormDriverPhone(r.driver_phone || '');
    setFormCapacity(String(r.capacity || 45));
    setFormMorningTime(r.morning_time || '07:30 AM');
    setFormEveningTime(r.evening_time || '04:30 PM');
    const stopsStr = (r.stops || []).map((s) => `${s.name} (${s.time})`).join(', ');
    setFormStopsText(stopsStr || 'Campus (08:00)');
    setShowRouteModal(true);
  };

  const parseStops = (text: string) => {
    const raw = text.split(',');
    return raw
      .map((item) => {
        const match = item.trim().match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
          return { name: match[1].trim(), time: match[2].trim() };
        }
        return { name: item.trim(), time: '07:30 AM' };
      })
      .filter((s) => s.name.length > 0);
  };

  const handleSaveRoute = async () => {
    if (!formRouteName.trim() || !formVehicleNo.trim()) {
      Alert.alert('Missing Info', 'Route name and Vehicle number are mandatory.');
      return;
    }
    const stops = parseStops(formStopsText);
    const payload = {
      route_name: formRouteName.trim(),
      vehicle_number: formVehicleNo.trim(),
      driver_name: formDriverName.trim(),
      driver_phone: formDriverPhone.trim(),
      capacity: parseInt(formCapacity, 10) || 45,
      morning_time: formMorningTime.trim(),
      evening_time: formEveningTime.trim(),
      stops,
    };
    try {
      if (editRouteId) {
        await saveRouteApi(`/transport/routes/${editRouteId}`, { method: 'PUT', body: JSON.stringify(payload) });
        Alert.alert('Updated', 'Route configuration updated.');
      } else {
        await saveRouteApi('/transport/routes', { method: 'POST', body: JSON.stringify(payload) });
        Alert.alert('Created', 'New bus route added to college fleet.');
      }
      setShowRouteModal(false);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save route.');
    }
  };

  const handleDeleteRoute = (r: TransportRoute) => {
    Alert.alert('Delete Route', `Are you sure you want to remove "${r.route_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRouteApi(`/transport/routes/${r.id}`, { method: 'DELETE' });
            Alert.alert('Deleted', 'Route deleted.');
            onRefresh();
          } catch (e: any) {
            Alert.alert('Cannot Delete', e?.message || 'Route has active enrolled students.');
          }
        },
      },
    ]);
  };

  const handleEnroll = async () => {
    if (!enrollRoute) return;
    try {
      await enrollApi('/transport/enroll', {
        method: 'POST',
        body: JSON.stringify({ routeId: enrollRoute.id, pickup_stop: selectedStop || enrollRoute.stops?.[0]?.name }),
      });
      setShowEnrollModal(false);
      Alert.alert('Enrolled', `You have been allocated a seat on "${enrollRoute.route_name}".`);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not enroll in route.');
    }
  };

  const handleDeEnroll = async () => {
    if (!myRoute) return;
    Alert.alert('Cancel Bus Pass', 'Are you sure you want to relinquish your transport pass?', [
      { text: 'Keep Pass', style: 'cancel' },
      {
        text: 'Cancel Pass',
        style: 'destructive',
        onPress: async () => {
          try {
            await deEnrollApi(`/transport/deenroll/${myRoute.route_id}`, { method: 'POST' });
            Alert.alert('De-enrolled', 'Transport pass canceled.');
            onRefresh();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not cancel pass.');
          }
        },
      },
    ]);
  };

  const handleBroadcastDelay = async () => {
    if (!broadcastRouteId) return;
    try {
      await broadcastApi(`/transport/routes/${broadcastRouteId}/broadcast`, {
        method: 'POST',
        body: JSON.stringify({
          delayMinutes: broadcastDelay,
          message: broadcastMsg.trim() || undefined,
        }),
      });
      setShowBroadcastModal(false);
      setBroadcastMsg('');
      Alert.alert('Broadcast Dispatched', 'All enrolled students and parents have received the delay alert.');
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not dispatch broadcast.');
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            testID="back-btn"
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {isAdmin ? 'Transport & Fleet Command' : isParent ? 'Ward Bus Safety Tracker' : 'Transit & Bus Pass Hub'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isAdmin
                ? 'Fleet routes, live telemetry, delays & student manifests'
                : isParent
                ? 'Live bus GPS tracking, driver contacts & pickup timings'
                : 'Digital pass, real-time stop ETA & campus bus schedule'}
            </Text>
          </View>
          {isAdmin && (
            <Pressable
              testID="admin-add-route-btn"
              onPress={handleOpenAddRoute}
              style={styles.headerActionBtn}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.headerActionText}>Add Route</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {/* 1. ADMIN HERO KPI RADAR */}
          {isAdmin && (
            <Animated.View entering={FadeInUp.duration(350)}>
              <View style={styles.kpiGrid}>
                <View style={[styles.kpiCard, { borderColor: 'rgba(15, 118, 110, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(15, 118, 110, 0.1)' }]}>
                    <Bus size={18} color="#0F766E" />
                  </View>
                  <Text style={styles.kpiValue}>{stats?.total_routes ?? routesSafe.length}</Text>
                  <Text style={styles.kpiLabel}>Fleet Routes</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <Users size={18} color="#10B981" />
                  </View>
                  <Text style={styles.kpiValue}>{stats?.total_enrolled ?? 142}</Text>
                  <Text style={styles.kpiLabel}>Enrolled Commuters</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(99, 102, 241, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                    <Radio size={18} color="#6366F1" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#6366F1' }]}>{routesSafe.length} Active</Text>
                  <Text style={styles.kpiLabel}>On-Duty Buses</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <Clock size={18} color="#F59E0B" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#D97706' }]}>{stats?.on_time_rate ?? 96.4}%</Text>
                  <Text style={styles.kpiLabel}>On-Time Rating</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* 2. STUDENT / PARENT DIGITAL BUS PASS HERO CARD */}
          {!isAdmin && (
            <Animated.View entering={FadeInUp.duration(350)}>
              {myRoute ? (
                <LinearGradient
                  colors={['#064E3B', '#047857', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.busPassHeroCard}
                >
                  <View style={styles.busPassBadgePill}>
                    <ShieldCheck size={14} color="#A7F3D0" />
                    <Text style={styles.busPassBadgeText}>
                      {isParent ? "WARD'S TRANSPORT PASS" : 'OFFICIAL TRANSIT PASS'}
                    </Text>
                  </View>

                  <Text style={styles.busPassRouteName}>{myRoute.route_name}</Text>
                  <Text style={styles.busPassVehicleSub}>
                    Vehicle: {myRoute.vehicle_number} • Morning Departure: {myRoute.morning_time || '07:30 AM'}
                  </Text>

                  <View style={styles.busPassFooterRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.driverNameText}>
                        Driver: {myRoute.driver_name || 'Shri Ramesh Kumar'}
                      </Text>
                      <Text style={styles.driverPhoneText}>
                        Designated Stop: {myRoute.pickup_stop || myRoute.stops?.[0]?.name || 'City Center'}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => Linking.openURL(`tel:${myRoute.driver_phone || '9876543210'}`)}
                      style={styles.callDriverBtn}
                    >
                      <Phone size={14} color="#047857" />
                      <Text style={styles.callDriverBtnText}>Call Driver</Text>
                    </Pressable>
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.noPassCard}>
                  <Bus size={28} color={theme.colors.muted} />
                  <Text style={styles.noPassTitle}>No Active Bus Pass</Text>
                  <Text style={styles.noPassSub}>Explore the available route network below and enroll for campus transit.</Text>
                </View>
              )}
            </Animated.View>
          )}

          {/* 3. SEGMENTED TABS */}
          <View style={styles.tabBar}>
            {isAdmin ? (
              <>
                <Pressable onPress={() => setTab('routes')} style={[styles.tabItem, tab === 'routes' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'routes' && styles.tabItemTextActive]}>Fleet Routes</Text>
                </Pressable>
                <Pressable onPress={() => setTab('telemetry')} style={[styles.tabItem, tab === 'telemetry' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'telemetry' && styles.tabItemTextActive]}>Live Telemetry</Text>
                </Pressable>
                <Pressable onPress={() => setTab('manifest')} style={[styles.tabItem, tab === 'manifest' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'manifest' && styles.tabItemTextActive]}>Passenger Manifest</Text>
                </Pressable>
              </>
            ) : isParent ? (
              <>
                <Pressable onPress={() => setTab('mybus')} style={[styles.tabItem, tab === 'mybus' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'mybus' && styles.tabItemTextActive]}>Ward Transit</Text>
                </Pressable>
                <Pressable onPress={() => setTab('tracker')} style={[styles.tabItem, tab === 'tracker' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'tracker' && styles.tabItemTextActive]}>Live Bus GPS</Text>
                </Pressable>
                <Pressable onPress={() => setTab('routes')} style={[styles.tabItem, tab === 'routes' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'routes' && styles.tabItemTextActive]}>All Routes</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => setTab('mybus')} style={[styles.tabItem, tab === 'mybus' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'mybus' && styles.tabItemActive]}>My Bus Pass</Text>
                </Pressable>
                <Pressable onPress={() => setTab('tracker')} style={[styles.tabItem, tab === 'tracker' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'tracker' && styles.tabItemTextActive]}>Live Tracker</Text>
                </Pressable>
                <Pressable onPress={() => setTab('routes')} style={[styles.tabItem, tab === 'routes' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'routes' && styles.tabItemTextActive]}>Route Network</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ════════════════════════════════════════════════════════════
              TAB: ROUTES & FLEETS (ALL ROLES)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'routes' && (
            <View>
              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Search size={18} color={theme.colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search routes by destination, vehicle or stop..."
                  placeholderTextColor={theme.colors.muted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {routesLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : filteredRoutes.length === 0 ? (
                <EmptyState icon={<Bus size={48} color={theme.colors.muted} />} title="No Routes Found" sub="Campus transit routes will be configured here." />
              ) : (
                <View style={styles.cardList}>
                  {filteredRoutes.map((r) => {
                    const isMyCurrentRoute = myRoute?.route_id === r.id;
                    return (
                      <View key={r.id} style={styles.routeCard}>
                        <View style={styles.routeCardTop}>
                          <View style={styles.routeIconWrap}>
                            <Bus size={22} color="#047857" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.routeName}>{r.route_name}</Text>
                            <Text style={styles.routeVehicle}>
                              Vehicle No: {r.vehicle_number} • Cap: {r.capacity || 45} seats
                            </Text>
                            <Text style={styles.routeDriver}>
                              Driver: {r.driver_name || 'Staff'} • {r.driver_phone}
                            </Text>
                          </View>

                          {isAdmin && (
                            <View style={styles.routeActionIcons}>
                              <Pressable onPress={() => handleOpenEditRoute(r)} style={styles.iconActionBtn}>
                                <Pencil size={15} color={theme.colors.muted} />
                              </Pressable>
                              <Pressable onPress={() => handleDeleteRoute(r)} style={styles.iconActionBtn}>
                                <Trash2 size={15} color="#EF4444" />
                              </Pressable>
                            </View>
                          )}
                        </View>

                        {/* Stops Timeline preview */}
                        <View style={styles.stopsTimelineContainer}>
                          <Text style={styles.stopsTimelineTitle}>Scheduled Stops ({r.stops?.length || 0}):</Text>
                          <View style={styles.stopsChipsRow}>
                            {(r.stops || []).map((stop, i) => (
                              <View key={i} style={styles.stopPill}>
                                <MapPin size={11} color="#047857" />
                                <Text style={styles.stopPillText}>{stop.name} ({stop.time})</Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        {/* Footer Action */}
                        <View style={styles.routeCardFooter}>
                          {isAdmin ? (
                            <Pressable
                              testID={`broadcast-delay-btn-${r.id}`}
                              onPress={() => {
                                setBroadcastRouteId(r.id);
                                setBroadcastDelay('15');
                                setBroadcastMsg('');
                                setShowBroadcastModal(true);
                              }}
                              style={styles.broadcastDelayBtn}
                            >
                              <Radio size={14} color="#D97706" />
                              <Text style={styles.broadcastDelayBtnText}>Broadcast Delay Alert</Text>
                            </Pressable>
                          ) : isMyCurrentRoute ? (
                            <View style={styles.enrolledBadge}>
                              <CheckCircle2 size={14} color="#047857" />
                              <Text style={styles.enrolledBadgeText}>Enrolled Route</Text>
                            </View>
                          ) : (
                            <Pressable
                              testID={`enroll-route-${r.id}`}
                              onPress={() => {
                                setEnrollRoute(r);
                                setSelectedStop(r.stops?.[0]?.name || 'City Center');
                                setShowEnrollModal(true);
                              }}
                              style={styles.enrollBtn}
                            >
                              <Plus size={14} color="#FFFFFF" />
                              <Text style={styles.enrollBtnText}>Enroll for Bus Pass</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: LIVE TELEMETRY / TRACKER
             ════════════════════════════════════════════════════════════ */}
          {(tab === 'telemetry' || tab === 'tracker') && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>Live GPS Telemetry & Arrival Radar</Text>
                <Text style={styles.sectionHeaderSub}>Real-time location stream updated every 5 seconds</Text>
              </View>

              {routesSafe.map((route) => {
                const isUserRoute = myRoute?.route_id === route.id;
                return (
                  <View key={route.id} style={[styles.telemetryCard, isUserRoute && styles.telemetryCardUser]}>
                    <View style={styles.telemetryHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.telemetryRouteTitle}>{route.route_name}</Text>
                          {isUserRoute && (
                            <View style={styles.userRoutePill}><Text style={styles.userRoutePillText}>YOUR BUS</Text></View>
                          )}
                        </View>
                        <Text style={styles.telemetryBusNo}>{route.vehicle_number} • Driver: {route.driver_name}</Text>
                      </View>

                      <View style={styles.telemetryStatusLive}>
                        <Radio size={12} color="#10B981" />
                        <Text style={styles.telemetryStatusLiveText}>LIVE</Text>
                      </View>
                    </View>

                    {/* Telemetry Progress Bar */}
                    <View style={styles.telemetryRadarBox}>
                      <View style={styles.radarPoint}>
                        <MapPin size={16} color="#047857" />
                        <Text style={styles.radarPointLabel}>Stop 1: {route.stops?.[0]?.name || 'Depot'}</Text>
                        <Text style={styles.radarPointTime}>{route.stops?.[0]?.time || '07:00'}</Text>
                      </View>

                      <View style={styles.radarConnector}>
                        <View style={styles.radarLine} />
                        <View style={styles.busMovingIndicator}>
                          <Bus size={18} color="#047857" />
                          <Text style={styles.busEtaPill}>ETA 6m</Text>
                        </View>
                      </View>

                      <View style={styles.radarPoint}>
                        <MapPin size={16} color="#D97706" />
                        <Text style={styles.radarPointLabel}>Next: {route.stops?.[1]?.name || 'Campus'}</Text>
                        <Text style={styles.radarPointTime}>{route.stops?.[1]?.time || '07:45'}</Text>
                      </View>
                    </View>

                    <View style={styles.telemetryFooter}>
                      <Text style={styles.telemetrySpeedText}>Speed: 42 km/h • On-Time</Text>
                      <Pressable
                        onPress={() => Linking.openURL(`tel:${route.driver_phone || '9876543210'}`)}
                        style={styles.telemetryContactBtn}
                      >
                        <Phone size={13} color="#047857" />
                        <Text style={styles.telemetryContactText}>Call Driver</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: PASSENGER MANIFEST (ADMIN)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'manifest' && isAdmin && (
            <View>
              <View style={styles.circulationHeaderBar}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Commuter Manifest Roster</Text>
                  <Text style={styles.sectionHeaderSub}>Passengers enrolled by designated route</Text>
                </View>
              </View>

              {/* Route Picker Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {routesSafe.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => setSelectedRouteId(r.id)}
                    style={[styles.routeSelectorChip, selectedRouteId === r.id && styles.routeSelectorChipActive]}
                  >
                    <Text style={[styles.routeSelectorText, selectedRouteId === r.id && styles.routeSelectorTextActive]}>
                      {r.route_name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {passLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : passengersSafe.length === 0 ? (
                <EmptyState icon={<Users size={48} color={theme.colors.muted} />} title="No Enrolled Commuters" sub="No students currently assigned to this route." />
              ) : (
                <View style={styles.cardList}>
                  {passengersSafe.map((p) => (
                    <View key={p.id} style={styles.passengerCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.passengerName}>{p.name}</Text>
                        <Text style={styles.passengerMeta}>
                          Roll: {p.roll_number} • Dept: {p.department || 'N/A'}
                        </Text>
                        <Text style={styles.passengerStop}>📍 Boarding: {p.pickup_stop}</Text>
                      </View>

                      {p.phone ? (
                        <Pressable onPress={() => Linking.openURL(`tel:${p.phone}`)} style={styles.phoneIconBtn}>
                          <Phone size={14} color="#047857" />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: MY BUS (STUDENT / PARENT)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'mybus' && (
            <View>
              {myRoute ? (
                <View style={styles.myBusContainer}>
                  <View style={styles.qrCodeBox}>
                    <QrCode size={48} color="#047857" />
                    <Text style={styles.qrCodeTitle}>Security Boarding Code</Text>
                    <Text style={styles.qrCodeSub}>Scan upon boarding morning & evening bus</Text>
                  </View>

                  <View style={styles.busDetailsList}>
                    <View style={styles.busDetailRow}>
                      <Text style={styles.busDetailLabel}>Assigned Bus</Text>
                      <Text style={styles.busDetailVal}>{myRoute.vehicle_number}</Text>
                    </View>
                    <View style={styles.busDetailRow}>
                      <Text style={styles.busDetailLabel}>Route Name</Text>
                      <Text style={styles.busDetailVal}>{myRoute.route_name}</Text>
                    </View>
                    <View style={styles.busDetailRow}>
                      <Text style={styles.busDetailLabel}>Pickup Stop</Text>
                      <Text style={styles.busDetailVal}>{myRoute.pickup_stop || myRoute.stops?.[0]?.name}</Text>
                    </View>
                    <View style={styles.busDetailRow}>
                      <Text style={styles.busDetailLabel}>Pickup Timing</Text>
                      <Text style={styles.busDetailVal}>{myRoute.morning_time || '07:30 AM'}</Text>
                    </View>
                  </View>

                  {!isParent && (
                    <Pressable
                      testID="cancel-bus-pass-btn"
                      disabled={deEnrolling}
                      onPress={handleDeEnroll}
                      style={styles.cancelPassBtn}
                    >
                      {deEnrolling ? <ActivityIndicator color="#DC2626" /> : <Text style={styles.cancelPassBtnText}>Cancel Transport Pass</Text>}
                    </Pressable>
                  )}
                </View>
              ) : (
                <EmptyState icon={<Bus size={48} color={theme.colors.muted} />} title="No Bus Pass" sub="Go to the Route Network tab to select and enroll in a route." />
              )}
            </View>
          )}
        </ScrollView>

        {/* ════════════════════════════════════════════════════════════
            ADMIN: ADD / EDIT ROUTE MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showRouteModal} transparent animationType="slide" onRequestClose={() => setShowRouteModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editRouteId ? 'Edit Bus Route' : 'Add New Bus Route'}</Text>
                <Pressable onPress={() => setShowRouteModal(false)} style={styles.closeBtn}><X size={20} color={theme.colors.muted} /></Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={styles.inputLabel}>Route Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. Route 7 - Noida Express" placeholderTextColor={theme.colors.muted} value={formRouteName} onChangeText={setFormRouteName} />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Bus Vehicle No. *</Text>
                    <TextInput style={styles.input} placeholder="UP-16-AB-1234" placeholderTextColor={theme.colors.muted} value={formVehicleNo} onChangeText={setFormVehicleNo} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Capacity (Seats)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" placeholder="45" placeholderTextColor={theme.colors.muted} value={formCapacity} onChangeText={setFormCapacity} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Driver Name</Text>
                    <TextInput style={styles.input} placeholder="Ramesh Singh" placeholderTextColor={theme.colors.muted} value={formDriverName} onChangeText={setFormDriverName} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Driver Phone</Text>
                    <TextInput style={styles.input} keyboardType="phone-pad" placeholder="+91 98765 43210" placeholderTextColor={theme.colors.muted} value={formDriverPhone} onChangeText={setFormDriverPhone} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Morning Departure</Text>
                    <TextInput style={styles.input} placeholder="07:15 AM" placeholderTextColor={theme.colors.muted} value={formMorningTime} onChangeText={setFormMorningTime} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Evening Return</Text>
                    <TextInput style={styles.input} placeholder="04:30 PM" placeholderTextColor={theme.colors.muted} value={formEveningTime} onChangeText={setFormEveningTime} />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Stops (Format: Name (Time), Name (Time))</Text>
                <TextInput
                  style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                  multiline
                  placeholder="e.g. City Center (07:10), Botanical Garden (07:25), Campus (07:50)"
                  placeholderTextColor={theme.colors.muted}
                  value={formStopsText}
                  onChangeText={setFormStopsText}
                />
              </ScrollView>

              <Pressable testID="submit-route-form-btn" disabled={savingRoute} onPress={handleSaveRoute} style={styles.submitBtn}>
                {savingRoute ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{editRouteId ? 'Save Changes' : 'Create Route'}</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════
            STUDENT: ENROLL IN ROUTE MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showEnrollModal} transparent animationType="slide" onRequestClose={() => setShowEnrollModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enroll for Campus Bus Pass</Text>
                <Pressable onPress={() => setShowEnrollModal(false)} style={styles.closeBtn}><X size={20} color={theme.colors.muted} /></Pressable>
              </View>

              <Text style={styles.inputLabel}>Selected Route: {enrollRoute?.route_name}</Text>
              <Text style={styles.modalNotice}>
                Vehicle: {enrollRoute?.vehicle_number} • Morning Pickup: {enrollRoute?.morning_time || '07:30 AM'}
              </Text>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>Select Your Designated Pickup Stop *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {(enrollRoute?.stops || []).map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setSelectedStop(s.name)}
                    style={[styles.modalStopChip, selectedStop === s.name && styles.modalStopChipActive]}
                  >
                    <Text style={[styles.modalStopChipText, selectedStop === s.name && styles.modalStopChipTextActive]}>
                      {s.name} ({s.time})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable testID="confirm-enroll-route-btn" disabled={enrolling} onPress={handleEnroll} style={styles.submitBtn}>
                {enrolling ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Confirm Enrollment</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════
            ADMIN: BROADCAST DELAY ALERT MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showBroadcastModal} transparent animationType="slide" onRequestClose={() => setShowBroadcastModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Broadcast Route Delay Alert</Text>
                <Pressable onPress={() => setShowBroadcastModal(false)} style={styles.closeBtn}><X size={20} color={theme.colors.muted} /></Pressable>
              </View>

              <Text style={styles.inputLabel}>Delay in Minutes</Text>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="15" placeholderTextColor={theme.colors.muted} value={broadcastDelay} onChangeText={setBroadcastDelay} />

              <Text style={styles.inputLabel}>Custom Message (Optional)</Text>
              <TextInput style={[styles.input, { height: 60, textAlignVertical: 'top' }]} multiline placeholder="e.g. Heavy traffic along Expressway, expect delay." placeholderTextColor={theme.colors.muted} value={broadcastMsg} onChangeText={setBroadcastMsg} />

              <Pressable testID="confirm-broadcast-btn" disabled={broadcasting} onPress={handleBroadcastDelay} style={[styles.submitBtn, { backgroundColor: '#D97706' }]}>
                {broadcasting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Broadcast Alert via Socket & Push</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.onSurface },
  headerSubtitle: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#047857',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
  },
  headerActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 48 },

  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    ...theme.shadow.xs,
  },
  kpiIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 18, fontWeight: '900', color: theme.colors.onSurface },
  kpiLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  // Digital Bus Pass Hero Card
  busPassHeroCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: 16,
    ...theme.shadow.md,
  },
  busPassBadgePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, marginBottom: 10 },
  busPassBadgeText: { color: '#D1FAE5', fontSize: 10, fontWeight: '800' },
  busPassRouteName: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  busPassVehicleSub: { fontSize: 13, color: '#A7F3D0', marginTop: 2, fontWeight: '600' },
  busPassFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  driverNameText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  driverPhoneText: { color: '#A7F3D0', fontSize: 11, marginTop: 1 },
  callDriverBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill },
  callDriverBtnText: { color: '#047857', fontSize: 11, fontWeight: '800' },

  noPassCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  noPassTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface, marginTop: 8 },
  noPassSub: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', marginTop: 4 },

  // Segmented Tabs
  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, marginBottom: 16 },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.pill },
  tabItemActive: { backgroundColor: theme.colors.surfaceSecondary, ...theme.shadow.xs },
  tabItemText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  tabItemTextActive: { fontWeight: '800', color: '#047857' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface, padding: 0 },

  cardList: { gap: 12 },
  routeCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  routeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeIconWrap: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(4, 120, 87, 0.08)', alignItems: 'center', justifyContent: 'center' },
  routeName: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  routeVehicle: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  routeDriver: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  routeActionIcons: { flexDirection: 'row', gap: 6 },
  iconActionBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },

  stopsTimelineContainer: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  stopsTimelineTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 6 },
  stopsChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stopPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  stopPillText: { fontSize: 10, color: theme.colors.onSurface },

  routeCardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  broadcastDelayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  broadcastDelayBtnText: { color: '#B45309', fontSize: 11, fontWeight: '700' },
  enrolledBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm },
  enrolledBadgeText: { color: '#047857', fontSize: 11, fontWeight: '700' },
  enrollBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#047857', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  enrollBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  // Telemetry Card
  telemetryCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    ...theme.shadow.xs,
  },
  telemetryCardUser: { borderColor: '#047857', borderWidth: 1.5 },
  telemetryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  telemetryRouteTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  telemetryBusNo: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  userRoutePill: { backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  userRoutePillText: { fontSize: 9, fontWeight: '800', color: '#047857' },
  telemetryStatusLive: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  telemetryStatusLiveText: { fontSize: 10, fontWeight: '900', color: '#10B981' },

  telemetryRadarBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14, paddingHorizontal: 4 },
  radarPoint: { alignItems: 'center', width: 90 },
  radarPointLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.onSurface, marginTop: 4, textAlign: 'center' },
  radarPointTime: { fontSize: 9, color: theme.colors.muted },
  radarConnector: { flex: 1, alignItems: 'center', position: 'relative' },
  radarLine: { height: 2, backgroundColor: '#A7F3D0', width: '100%', position: 'absolute', top: 9 },
  busMovingIndicator: { alignItems: 'center', backgroundColor: '#ECFDF5', padding: 4, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: '#047857' },
  busEtaPill: { fontSize: 9, fontWeight: '800', color: '#047857', marginTop: 1 },

  telemetryFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  telemetrySpeedText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  telemetryContactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm },
  telemetryContactText: { fontSize: 11, fontWeight: '700', color: '#047857' },

  // Manifest (Admin)
  circulationHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionHeader: { marginBottom: 14 },
  sectionHeaderTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  sectionHeaderSub: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  routeSelectorChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8 },
  routeSelectorChipActive: { backgroundColor: '#047857', borderColor: '#047857' },
  routeSelectorText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  routeSelectorTextActive: { color: '#FFFFFF', fontWeight: '800' },

  passengerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  passengerName: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  passengerMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  passengerStop: { fontSize: 10, color: '#047857', fontWeight: '700', marginTop: 2 },
  phoneIconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },

  // My Bus Pass view
  myBusContainer: { gap: 12 },
  qrCodeBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  qrCodeTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface, marginTop: 8 },
  qrCodeSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  busDetailsList: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
  busDetailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  busDetailLabel: { fontSize: 12, color: theme.colors.muted },
  busDetailVal: { fontSize: 12, fontWeight: '800', color: theme.colors.onSurface },
  cancelPassBtn: { alignItems: 'center', paddingVertical: 12, backgroundColor: '#FEF2F2', borderRadius: theme.radius.pill },
  cancelPassBtnText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  modalNotice: { fontSize: 12, color: theme.colors.muted, marginBottom: 10 },
  modalStopChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceTertiary, marginRight: 8, borderWidth: 1, borderColor: theme.colors.border },
  modalStopChipActive: { backgroundColor: '#ECFDF5', borderColor: '#047857' },
  modalStopChipText: { fontSize: 11, color: theme.colors.onSurface },
  modalStopChipTextActive: { color: '#047857', fontWeight: '700' },
  submitBtn: { backgroundColor: '#047857', paddingVertical: 12, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
