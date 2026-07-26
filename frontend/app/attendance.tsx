import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppImage as Image } from '@/src/components/AppImage';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import * as Location from '@/src/native/location';
import * as Haptics from '@/src/native/haptics';
import { QrCode, ArrowLeft, CheckCircle2, MapPin, ScanFace, Radar, Satellite, Settings, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { AttendanceData, AttendanceByCourse } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme, bg } from '@/src/theme';
import { EmptyState, Card, ProgressBar } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

const METHOD_META: Record<string, { label: string; icon: any; cta: string }> = {
  qr: { label: 'QR Code', icon: QrCode, cta: 'Scan QR' },
  gps: { label: 'GPS', icon: MapPin, cta: 'Check in with GPS' },
  face: { label: 'Face ID', icon: ScanFace, cta: 'Selfie Check-In' },
  auto: { label: 'Auto', icon: Radar, cta: 'Arm Auto Check-In' },
};

export default function Attendance() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFetch<AttendanceData>('/attendance/me');
  const { data: sessionData, loading: sessionsLoading, refresh: refreshSessions } = useFetch<{ sessions: any[]; face_enrolled: boolean }>(
    user?.role === 'student' ? '/attendance/sessions/active' : null
  );
  const { mutate: checkin, loading: checkinLoading } = useMutate<any>();
  const { mutate: checkinAuto } = useMutate<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyId, setBusyId] = useState('');
  const [locDenied, setLocDenied] = useState(false);
  const [pendingGps, setPendingGps] = useState<any>(null);
  const [autoArmed, setAutoArmed] = useState(false);
  const [autoStatus, setAutoStatus] = useState('');
  const pollRef = useRef<any>(null);

  const sessions = sessionData?.sessions || [];
  const faceEnrolled = !!sessionData?.face_enrolled;

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (user?.role !== 'student') return undefined;
    return subscribeRealtime('attendance:active-sessions:update', () => {
      refreshSessions();
      refresh();
    });
  }, [refresh, refreshSessions, user?.role]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    if (user?.role === 'student') await refreshSessions();
    setRefreshing(false);
  };

  const flash = (ok: boolean, text: string) => {
    setMsg({ ok, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const getLocation = async (): Promise<{ lat: number; lng: number } | null> => {
    try {
      const req = await Location.requestForegroundPermissionsAsync();
      if (!req.granted) {
        setLocDenied(!req.canAskAgain);
        flash(false, 'Location permission is needed for GPS check-in');
        return null;
      }
      setLocDenied(false);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      flash(false, 'Could not get your location');
      return null;
    }
  };

  const gpsCheckin = async (session: any) => {
    setPendingGps(null);
    setBusyId(session.id);
    try {
      const loc = await getLocation();
      if (!loc) return;
      const r = await checkin('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ session_id: session.id, ...loc }),
      });
      if (r && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flash(true, `${r?.message || 'Checked in'} — ${r?.detail || ''}`);
      await refresh();
    } catch (e: any) {
      flash(false, e.message);
    } finally {
      setBusyId('');
    }
  };

  const armAuto = async (session: any) => {
    const loc = await getLocation();
    if (!loc) return;
    setAutoArmed(true);
    setAutoStatus('Watching your location — walk into the classroom to check in automatically…');

    const attempt = async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const r = await checkinAuto('/attendance/checkin', {
          method: 'POST',
          body: JSON.stringify({ session_id: session.id, lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        flash(true, `Auto check-in: ${r?.message || 'Done'}`);
        setAutoArmed(false);
        setAutoStatus('');
        if (pollRef.current) clearInterval(pollRef.current);
        await refresh();
      } catch (e: any) {
        if (e.message?.includes('already checked in') || e.message?.includes('ended')) {
          setAutoArmed(false);
          setAutoStatus('');
          if (pollRef.current) clearInterval(pollRef.current);
          await refresh();
        } else {
          setAutoStatus(e.message?.includes('away') ? `${e.message}. Still watching…` : 'Watching your location…');
        }
      }
    };
    await attempt();
    pollRef.current = setInterval(attempt, 15000);
  };

  const enableBackground = async () => {
    if (Platform.OS === 'web') {
      setBgStatus('Background geofencing needs the installed mobile app. Use "Arm Auto Check-In" while the app is open instead.');
      return;
    }
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (!fg.granted) { setBgStatus('Location permission denied.'); return; }
      const bgp = await Location.requestBackgroundPermissionsAsync();
      if (!bgp.granted) { setBgStatus('Background location denied — enable "Allow all the time" in Settings.'); return; }
      setBgStatus('Background auto check-in enabled. Works even with the app closed.');
    } catch {
      setBgStatus('Background geofencing is not available in Expo Go — it works after you create a build.');
    }
  };

  const [bgStatus, setBgStatus] = useState('');
  const minutesLeft = (iso: string) => Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
  const byCourse = data?.by_course || [];
  const overallPct = byCourse.length ? Math.round(byCourse.reduce((s: number, c: AttendanceByCourse) => s + c.percentage, 0) / byCourse.length) : 0;
  const isStudent = user?.role === 'student';

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.hero}>
          <Image source={{ uri: bg.attendance }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={['rgba(10,15,13,0.55)', 'rgba(10,15,13,0.95)']} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']} style={{ paddingHorizontal: theme.spacing.lg, flex: 1 }}>
            <View style={styles.headRow}>
              <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back" accessibilityRole="button">
                <ArrowLeft color="#fff" size={22} />
              </Pressable>
              <Text style={styles.headTitle}>Smart Attendance</Text>
              <View style={{ width: 22 }} />
            </View>
            <View style={styles.heroStats}>
              <View style={styles.ring}>
                <Text style={styles.ringVal}>{overallPct}%</Text>
                <Text style={styles.ringLbl}>overall</Text>
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.lg }}>
                <Text style={styles.heroMain}>{overallPct >= 75 ? 'On track for exams' : 'Attendance needs attention'}</Text>
                <Text style={styles.heroSub}>Keep it above 75% to stay exam-eligible.</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {loading && !data ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          >
            {error && (
              <View style={styles.errorBox}>
                <AlertTriangle size={16} color={theme.colors.error} />
                <Text style={styles.errorTxt}>{error}</Text>
              </View>
            )}

            {msg && (
              <View style={[styles.toast, { backgroundColor: msg.ok ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={{ color: msg.ok ? theme.colors.brand : theme.colors.error, fontWeight: '700', fontSize: 13, flex: 1 }}>{msg.text}</Text>
              </View>
            )}

            {locDenied && (
              <Pressable testID="loc-settings" onPress={() => Linking.openSettings()} style={styles.settingsRow} accessibilityLabel="Open location settings" accessibilityRole="button">
                <Settings color={theme.colors.warning} size={16} />
                <Text style={styles.settingsTxt}>Location blocked — tap to open Settings and enable it</Text>
              </Pressable>
            )}

            {isStudent && (
              <>
                <Text style={styles.section}>Live Sessions</Text>
                {sessionsLoading ? (
                  <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 12 }} />
                ) : sessions.length === 0 ? (
                  <View style={styles.noSession}>
                    <Satellite color={theme.colors.muted} size={22} />
                    <Text style={styles.noSessionTxt}>No active sessions right now. Your faculty starts one when class begins.</Text>
                  </View>
                ) : (
                  sessions.map((s: any) => {
                    const M = METHOD_META[s.method] || METHOD_META.qr;
                    const Icon = M.icon;
                    return (
                      <View key={s.id} testID={`session-${s.id}`} style={styles.sessionCard}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={styles.sessionIcon}>
                            <Icon color={theme.colors.brand} size={20} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sessionName} numberOfLines={1}>{s.course_name}</Text>
                            <Text style={styles.sessionMeta} numberOfLines={1}>{s.faculty_name} · ends in {minutesLeft(s.expires_at)} min</Text>
                          </View>
                          <View style={styles.methodPill}>
                            <Text style={styles.methodTxt}>{M.label}</Text>
                          </View>
                        </View>
                        {s.checked_in ? (
                          <View style={styles.checkedRow}>
                            <CheckCircle2 color={theme.colors.success} size={16} />
                            <Text style={styles.checkedTxt}>Checked in · auto check-out when class ends</Text>
                          </View>
                        ) : pendingGps?.id === s.id ? (
                          <View style={styles.explainBox}>
                            <Text style={styles.explainTxt}>We will use your location once to confirm you are inside the classroom zone.</Text>
                            <Pressable testID={`gps-continue-${s.id}`} onPress={() => gpsCheckin(s)} style={styles.cta} accessibilityLabel="Continue with GPS" accessibilityRole="button">
                              <Text style={styles.ctaTxt}>Continue</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            testID={`checkin-${s.id}`}
                            disabled={busyId === s.id || (s.method === 'auto' && autoArmed)}
                            onPress={() => {
                              if (s.method === 'qr') router.push(`/scan?sid=${s.id}` as any);
                              else if (s.method === 'face') router.push(`/selfie?sid=${s.id}&enrolled=${faceEnrolled ? 1 : 0}` as any);
                              else if (s.method === 'gps') setPendingGps(s);
                              else armAuto(s);
                            }}
                            style={styles.cta}
                            accessibilityLabel={M.cta}
                            accessibilityRole="button"
                          >
                            {busyId === s.id ? (
                              <ActivityIndicator color="#fff" />
                            ) : (
                              <>
                                <Icon color="#fff" size={16} />
                                <Text style={styles.ctaTxt}>{s.method === 'auto' && autoArmed ? 'Auto check-in armed' : M.cta}</Text>
                              </>
                            )}
                          </Pressable>
                        )}
                      </View>
                    );
                  })
                )}
                {autoArmed && autoStatus ? (
                  <View style={styles.autoBanner}>
                    <Radar color={theme.colors.brandSecondary} size={16} />
                    <Text style={styles.autoTxt}>{autoStatus}</Text>
                  </View>
                ) : null}
              </>
            )}

            <Text style={styles.section}>By Course</Text>
            {byCourse.map((c: AttendanceByCourse) => (
              <Card key={c.course_id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.dot, { backgroundColor: c.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{c.course_name}</Text>
                    <ProgressBar
                      value={c.percentage}
                      max={100}
                      height={6}
                      color={c.percentage >= 75 ? theme.colors.success : c.percentage >= 50 ? theme.colors.warning : theme.colors.error}
                      showPct
                    />
                    <Text style={styles.stats}>{c.present}/{c.total} classes attended</Text>
                  </View>
                </View>
              </Card>
            ))}
            {byCourse.length === 0 && <EmptyState title="No attendance yet" sub="Records appear once classes begin" />}

            {isStudent && (
              <View style={styles.bgCard}>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Radar color={theme.colors.brand} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bgTitle}>Background auto check-in</Text>
                    <Text style={styles.bgSub}>Geofencing checks you in the moment you enter campus zones — even with the app closed.</Text>
                  </View>
                </View>
                <Pressable testID="enable-bg" onPress={enableBackground} style={styles.bgBtn} accessibilityLabel="Enable background check-in" accessibilityRole="button">
                  <Text style={styles.bgBtnTxt}>Enable</Text>
                </Pressable>
                {bgStatus ? <Text style={styles.bgStatus}>{bgStatus}</Text> : null}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { height: 210, overflow: 'hidden' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md },
  headTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  heroStats: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingBottom: theme.spacing.lg },
  ring: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: theme.colors.brandSecondary, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16,185,129,0.12)' },
  ringVal: { fontSize: 20, fontWeight: '800', color: '#fff' },
  ringLbl: { fontSize: 10, color: theme.colors.brandTertiary, fontWeight: '600' },
  heroMain: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', padding: 12, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
  errorTxt: { color: theme.colors.error, fontSize: 13, fontWeight: '600', flex: 1 },
  toast: { flexDirection: 'row', padding: 12, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
  settingsRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#FEF3C7', padding: 12, borderRadius: theme.radius.md, marginBottom: theme.spacing.md },
  settingsTxt: { flex: 1, color: '#92400E', fontSize: 12, fontWeight: '600' },
  section: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface, marginTop: theme.spacing.md, marginBottom: theme.spacing.md },
  noSession: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  noSessionTxt: { flex: 1, color: theme.colors.muted, fontSize: 12, lineHeight: 17 },
  sessionCard: { backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.brandTertiary, marginBottom: 10 },
  sessionIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  sessionName: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  sessionMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  methodPill: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  methodTxt: { color: theme.colors.brand, fontSize: 10, fontWeight: '800' },
  cta: { flexDirection: 'row', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingVertical: 13, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  checkedRow: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#DCFCE7', padding: 10, borderRadius: theme.radius.md, marginTop: theme.spacing.md },
  checkedTxt: { color: theme.colors.brand, fontSize: 12, fontWeight: '700' },
  explainBox: { backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, marginTop: theme.spacing.md },
  explainTxt: { fontSize: 12, color: theme.colors.onSurfaceTertiary, lineHeight: 17 },
  autoBanner: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)', padding: 12, borderRadius: theme.radius.md, marginBottom: 6 },
  autoTxt: { flex: 1, color: theme.colors.brand, fontSize: 12, fontWeight: '600' },
  dot: { width: 4, height: '80%', borderRadius: 2 },
  name: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  stats: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
  bgCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, marginTop: theme.spacing.xl },
  bgTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  bgSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2, lineHeight: 16 },
  bgBtn: { backgroundColor: theme.colors.brandTertiary, paddingVertical: 11, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: theme.spacing.md },
  bgBtnTxt: { color: theme.colors.brand, fontWeight: '800', fontSize: 13 },
  bgStatus: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginTop: 10, lineHeight: 17 },
});
