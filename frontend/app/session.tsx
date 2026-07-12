import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppImage as Image } from '@/src/components/AppImage';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import QRCode from 'react-native-qrcode-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { ArrowLeft, Users, CheckCircle2, StopCircle, MapPin, ScanFace, Radar } from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme, bg } from '@/src/theme';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function LiveSession() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, refresh } = useFetch<any>(`/attendance/sessions/${id}`);
  const { mutate: closeSessionApi, loading: closing } = useMutate();
  const pollRef = useRef<any>(null);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(withSequence(withTiming(1.04, { duration: 900 }), withTiming(1, { duration: 900 })), -1);
  }, [scale]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    pollRef.current = setInterval(refresh, 4000);
    return () => clearInterval(pollRef.current);
  }, [refresh]);

  useEffect(() => subscribeRealtime<{ sessionId?: string; scheduleId?: string }>('attendance:session:update', (payload) => {
    if (payload?.sessionId === id || payload?.scheduleId === id) refresh();
  }), [id, refresh]);

  const closeSession = async () => {
    try {
      await closeSessionApi(`/attendance/sessions/${id}/close`, { method: 'POST' });
      await refresh();
    } catch {}
  };

  const s = data?.session;
  const active = s?.active;
  const minutesLeft = s ? Math.max(0, Math.round((new Date(s.expires_at).getTime() - Date.now()) / 60000)) : 0;
  const qrValue = s ? JSON.stringify({ sid: s.id, code: s.code }) : '';
  const MethodIcon = s?.method === 'gps' ? MapPin : s?.method === 'face' ? ScanFace : s?.method === 'auto' ? Radar : null;

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: theme.colors.surfaceInverse }}>
        <Image source={{ uri: bg.attendance }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['rgba(10,15,13,0.8)', 'rgba(10,15,13,0.97)']} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.title}>{active ? 'Live Session' : 'Session Ended'}</Text>
            <View style={{ width: 22 }} />
          </View>

          {loading || !s ? (
            <ActivityIndicator style={{ marginTop: 60 }} color={theme.colors.brandSecondary} />
          ) : (
            <>
              <View style={styles.top}>
                <Text style={styles.course}>{s.course_name}</Text>
                <Text style={styles.meta}>{s.course_code} · {s.method.toUpperCase()} · {active ? `${minutesLeft} min left` : 'closed'}</Text>

                {s.method === 'qr' && active ? (
                  <Animated.View style={[styles.qrBox, pulseStyle]}>
                    <QRCode value={qrValue} size={190} backgroundColor="#FFFFFF" color="#0A0F0D" />
                  </Animated.View>
                ) : MethodIcon && active ? (
                  <View style={styles.iconBig}><MethodIcon color={theme.colors.brandSecondary} size={64} /></View>
                ) : !active ? (
                  <View style={styles.iconBig}><CheckCircle2 color={theme.colors.brandSecondary} size={64} /></View>
                ) : null}

                {active && (
                  <View style={styles.codeRow}>
                    <Text style={styles.codeLbl}>Manual code</Text>
                    <Text testID="session-code" style={styles.code}>{s.code}</Text>
                  </View>
                )}
              </View>

              <View style={styles.panel}>
                <View style={styles.panelHead}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <Users color={theme.colors.brand} size={18} />
                    <Text style={styles.panelTitle}>Checked in</Text>
                  </View>
                  <Text testID="roll-count" style={styles.count}>{(data?.roll || []).length} / {data?.enrolled}</Text>
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
                  {(data?.roll || []).length === 0 && <Text style={styles.emptyTxt}>No students have checked in yet…</Text>}
                  {(data?.roll || []).map((r: any, i: number) => (
                    <View key={i} style={styles.rollRow}>
                      <CheckCircle2 color={theme.colors.success} size={16} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rollName}>{r.name}</Text>
                        <Text style={styles.rollMeta}>{r.student_id || ''} · {r.check_in?.slice(11, 16)} via {r.method}{r.check_out ? ` · out ${r.check_out.slice(11, 16)}` : ''}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {active ? (
                  <Pressable testID="close-session" onPress={closeSession} disabled={closing} style={styles.closeBtn} accessibilityLabel="End session">
                    {closing ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <StopCircle color="#fff" size={18} />
                        <Text style={styles.closeTxt}>End Session & Check Out Everyone</Text>
                      </>
                    )}
                  </Pressable>
                ) : (
                  <Pressable testID="session-back" onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: theme.colors.brandPrimary }]} accessibilityLabel="Go back">
                    <Text style={styles.closeTxt}>Done</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}
        </SafeAreaView>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' },
  top: { alignItems: 'center', paddingHorizontal: theme.spacing.lg },
  course: { fontSize: 20, fontWeight: '800', color: '#fff' },
  meta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  qrBox: { backgroundColor: '#fff', padding: 18, borderRadius: 24, marginTop: theme.spacing.lg },
  iconBig: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2, borderColor: 'rgba(16,185,129,0.35)', alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.lg },
  codeRow: { alignItems: 'center', marginTop: theme.spacing.md },
  codeLbl: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  code: { fontSize: 28, fontWeight: '800', color: theme.colors.brandSecondary, letterSpacing: 8, marginTop: 2 },
  panel: { flex: 1, backgroundColor: theme.colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: theme.spacing.lg, padding: theme.spacing.lg, paddingBottom: 28 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  panelTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  count: { fontSize: 15, fontWeight: '800', color: theme.colors.brand },
  emptyTxt: { color: theme.colors.muted, fontSize: 13, textAlign: 'center', marginTop: 20 },
  rollRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  rollName: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  rollMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  closeBtn: { flexDirection: 'row', gap: 8, backgroundColor: theme.colors.error, paddingVertical: 15, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: theme.spacing.md },
  closeTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
