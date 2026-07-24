import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Bus, MapPin, Clock, Navigation, AlertTriangle, CheckCircle,
  ChevronRight, ChevronLeft, RefreshCw, Users, ArrowRight,
} from 'lucide-react-native';

const ROUTES = [
  {
    id: 'R1', name: 'Route A — North Campus', busNo: 'KA-01-1234', driver: 'Ramesh Kumar', phone: '+91 9876543210',
    status: 'running', capacity: 45, passengers: 32, nextStop: 'Main Gate',
    stops: ['Hostel Block A', 'Library', 'Admin Block', 'Main Gate', 'North Campus'],
    eta: '5 min', color: '#10B981',
  },
  {
    id: 'R2', name: 'Route B — City Center', busNo: 'KA-02-5678', driver: 'Suresh Patel', phone: '+91 9876543211',
    status: 'running', capacity: 40, passengers: 28, nextStop: 'City Mall',
    stops: ['South Gate', 'Sports Complex', 'City Mall', 'Railway Station', 'City Center'],
    eta: '12 min', color: '#4F46E5',
  },
  {
    id: 'R3', name: 'Route C — East Wing', busNo: 'KA-03-9012', driver: 'Venkat Reddy', phone: '+91 9876543212',
    status: 'arrived', capacity: 35, passengers: 15, nextStop: 'Campus',
    stops: ['East Hostel', 'Canteen', 'Lab Block', 'Campus'],
    eta: 'Arrived', color: '#F59E0B',
  },
  {
    id: 'R4', name: 'Route D — Evening Shuttle', busNo: 'KA-04-3456', driver: 'Mohammed Ali', phone: '+91 9876543213',
    status: 'scheduled', capacity: 50, passengers: 0, nextStop: 'Departs 5:00 PM',
    stops: ['Campus', 'North Gate', 'City Center', 'Bus Stand'],
    eta: '3:45 PM', color: '#8B5CF6',
  },
];

const MOCK_LIVE_UPDATES = [
  { id: '1', time: '2 min ago', text: 'Route A bus passed Library stop', type: 'info' },
  { id: '2', time: '5 min ago', text: 'Route B bus delayed by 3 min due to traffic', type: 'warning' },
  { id: '3', time: '8 min ago', text: 'Route C bus arrived at Campus', type: 'success' },
  { id: '4', time: '15 min ago', text: 'Route D shuttle departed on schedule', type: 'info' },
];

const SCHEDULE = [
  { time: '7:30 AM', route: 'Route A', from: 'North Campus', to: 'City Center', status: 'completed' },
  { time: '8:00 AM', route: 'Route B', from: 'South Gate', to: 'Campus', status: 'completed' },
  { time: '8:30 AM', route: 'Route C', from: 'East Hostel', to: 'Campus', status: 'completed' },
  { time: '12:30 PM', route: 'Route A', from: 'Campus', to: 'North Campus', status: 'running' },
  { time: '1:00 PM', route: 'Route B', from: 'Campus', to: 'South Gate', status: 'running' },
  { time: '5:00 PM', route: 'Route D', from: 'Campus', to: 'Bus Stand', status: 'scheduled' },
  { time: '5:30 PM', route: 'Route A', from: 'North Campus', to: 'Campus', status: 'scheduled' },
  { time: '6:00 PM', route: 'Route B', from: 'South Gate', to: 'Campus', status: 'scheduled' },
];

export default function BusTracking() {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [tab, setTab] = useState<'live' | 'schedule'>('live');
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const activeBuses = ROUTES.filter(r => r.status === 'running').length;

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><Bus size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>Bus Tracking</Text>
                  <Text style={styles.heroSub}>Live campus bus tracking & schedules</Text>
                </View>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{activeBuses}</Text>
                  <Text style={styles.heroStatLabel}>Active</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{ROUTES.length}</Text>
                  <Text style={styles.heroStatLabel}>Routes</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>75</Text>
                  <Text style={styles.heroStatLabel}>Passengers</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {(['live', 'schedule'] as const).map(t => (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabActive]}>
                <Text style={[styles.tabTxt, tab === t && { color: '#fff' }]}>{t === 'live' ? 'Live Tracking' : 'Schedule'}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
          >
            {tab === 'live' ? (
              <>
                {ROUTES.map(route => {
                  const isSelected = selectedRoute === route.id;
                  return (
                    <Pressable key={route.id} onPress={() => setSelectedRoute(isSelected ? null : route.id)}>
                      <Card style={{ padding: 14, gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={[styles.routeDot, { backgroundColor: route.color }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 14 }}>{route.name}</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.muted }}>{route.busNo} · {route.driver}</Text>
                          </View>
                          <View style={[styles.statusBadge, route.status === 'running' ? styles.statusRunning : route.status === 'arrived' ? styles.statusArrived : styles.statusScheduled]}>
                            <Text style={styles.statusText}>{route.status === 'running' ? route.eta : route.status === 'arrived' ? 'Arrived' : route.eta}</Text>
                          </View>
                        </View>

                        {isSelected && (
                          <View style={{ gap: 8, marginTop: 4 }}>
                            <View style={styles.progressRow}>
                              <View style={styles.progressBg}>
                                <View style={[styles.progressFill, { width: `${(route.passengers / route.capacity) * 100}%`, backgroundColor: route.color }]} />
                              </View>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: route.color }}>{route.passengers}/{route.capacity}</Text>
                            </View>

                            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.text }}>Route Stops</Text>
                            {route.stops.map((stop, i) => (
                              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={[styles.stopDot, i === route.stops.indexOf(route.nextStop) && styles.stopActive]} />
                                <Text style={[styles.stopText, i === route.stops.indexOf(route.nextStop) && { fontWeight: '700', color: route.color }]}>{stop}</Text>
                                {i === route.stops.indexOf(route.nextStop) && <Text style={{ fontSize: 10, color: route.color, fontWeight: '700' }}>← Next</Text>}
                              </View>
                            ))}

                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                              <View style={styles.infoChip}><Users size={12} color={route.color} /><Text style={styles.infoText}>{route.passengers} on board</Text></View>
                              <View style={styles.infoChip}><Clock size={12} color={route.color} /><Text style={styles.infoText}>ETA: {route.eta}</Text></View>
                            </View>
                          </View>
                        )}
                      </Card>
                    </Pressable>
                  );
                })}

                <SectionTitle>Live Updates</SectionTitle>
                {MOCK_LIVE_UPDATES.map(u => (
                  <Card key={u.id} style={{ padding: 12, gap: 4 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      {u.type === 'success' ? <CheckCircle size={14} color="#10B981" /> :
                       u.type === 'warning' ? <AlertTriangle size={14} color="#F59E0B" /> :
                       <Navigation size={14} color={theme.colors.brand} />}
                      <Text style={{ fontSize: 13, color: theme.colors.text, flex: 1 }}>{u.text}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: theme.colors.muted, marginLeft: 22 }}>{u.time}</Text>
                  </Card>
                ))}
              </>
            ) : (
              <>
                <SectionTitle>Today's Schedule</SectionTitle>
                {SCHEDULE.map((s, i) => (
                  <Card key={i} style={{ padding: 12, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.brand, width: 56 }}>{s.time}</Text>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{s.route}</Text>
                          <Text style={{ fontSize: 11, color: theme.colors.muted }}>{s.from} → {s.to}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, s.status === 'running' ? styles.statusRunning : s.status === 'completed' ? styles.statusArrived : styles.statusScheduled]}>
                        <Text style={styles.statusText}>{s.status}</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  heroStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginTop: 4 },
  heroStat: { alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brand },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 13 },
  routeDot: { width: 10, height: 10, borderRadius: 5 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusRunning: { backgroundColor: '#10B98120' },
  statusArrived: { backgroundColor: '#F59E0B20' },
  statusScheduled: { backgroundColor: '#8B5CF620' },
  statusText: { fontSize: 10, fontWeight: '700', color: theme.colors.text },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  stopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.border },
  stopActive: { backgroundColor: '#10B981', width: 10, height: 10, borderRadius: 5 },
  stopText: { fontSize: 12, color: theme.colors.muted },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  infoText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
});
