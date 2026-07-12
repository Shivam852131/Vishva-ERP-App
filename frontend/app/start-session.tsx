import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import * as Location from '@/src/native/location';
import { ArrowLeft, QrCode, MapPin, ScanFace, Radar, LocateFixed } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Course } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';

const METHODS = [
  { key: 'qr', label: 'QR Code', desc: 'Students scan a rotating QR on your screen', icon: QrCode },
  { key: 'gps', label: 'GPS', desc: 'Students verify their location inside a radius', icon: MapPin },
  { key: 'face', label: 'Face ID', desc: 'AI verifies a selfie against their profile', icon: ScanFace },
  { key: 'auto', label: 'Auto', desc: 'Auto check-in when entering the geofence', icon: Radar },
];
const DURATIONS = [5, 10, 15, 30];

export default function StartSession() {
  const { user } = useAuth();
  const { data: allCourses, loading } = useFetch<Course[]>('/courses');
  const { mutate: createSession, loading: busy } = useMutate<any>();

  const [courseId, setCourseId] = useState('');
  const [method, setMethod] = useState('qr');
  const [duration, setDuration] = useState(10);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locBusy, setLocBusy] = useState(false);
  const [err, setErr] = useState('');

  const courses = (allCourses || []).filter(c => c.faculty_id === user?.id);
  const list = courses.length ? courses : (allCourses || []);

  const useMyLocation = async () => {
    setLocBusy(true);
    setErr('');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { setErr('Location permission denied.'); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setErr('Could not get your location.');
    } finally {
      setLocBusy(false);
    }
  };

  const start = async () => {
    if (!courseId) { setErr('Pick a course'); return; }
    setErr('');
    try {
      const body: any = { course_id: courseId, method, duration_min: duration };
      if ((method === 'gps' || method === 'auto') && myLoc) {
        body.lat = myLoc.lat;
        body.lng = myLoc.lng;
        body.radius_m = 150;
      }
      const s = await createSession('/attendance/sessions', { method: 'POST', body: JSON.stringify(body) });
      if (s?.id) router.replace(`/session?id=${s.id}` as any);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const needsLocation = method === 'gps' || method === 'auto';

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Take Attendance</Text>
          <View style={{ width: 22 }} />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120 }}>
            <Text style={styles.label}>Course</Text>
            <View style={styles.chipWrap}>
              {list.map(c => (
                <Pressable
                  key={c.id}
                  testID={`sess-course-${c.code}`}
                  onPress={() => setCourseId(c.id)}
                  style={[styles.chip, courseId === c.id && styles.chipActive]}
                  accessibilityLabel={`Select course ${c.code}`}
                >
                  <Text style={[styles.chipTxt, courseId === c.id && styles.chipTxtActive]}>{c.code}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Method</Text>
            <View style={styles.methodGrid}>
              {METHODS.map(m => {
                const Icon = m.icon;
                const active = method === m.key;
                return (
                  <Pressable
                    key={m.key}
                    testID={`sess-method-${m.key}`}
                    onPress={() => setMethod(m.key)}
                    style={[styles.methodCard, active && styles.methodActive]}
                    accessibilityLabel={`Select ${m.label} method`}
                  >
                    <Icon color={active ? '#fff' : theme.colors.brand} size={22} />
                    <Text style={[styles.methodLbl, active && { color: '#fff' }]}>{m.label}</Text>
                    <Text style={[styles.methodDesc, active && { color: 'rgba(255,255,255,0.75)' }]}>{m.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Duration</Text>
            <View style={styles.chipWrap}>
              {DURATIONS.map(d => (
                <Pressable
                  key={d}
                  testID={`sess-dur-${d}`}
                  onPress={() => setDuration(d)}
                  style={[styles.chip, duration === d && styles.chipActive]}
                  accessibilityLabel={`Set duration ${d} minutes`}
                >
                  <Text style={[styles.chipTxt, duration === d && styles.chipTxtActive]}>{d} min</Text>
                </Pressable>
              ))}
            </View>

            {needsLocation && (
              <>
                <Text style={styles.label}>Classroom Location</Text>
                <View style={styles.chipWrap}>
                  <Pressable
                    testID="sess-myloc"
                    onPress={useMyLocation}
                    style={[styles.chip, !!myLoc && styles.chipActive, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}
                    accessibilityLabel="Use my location"
                  >
                    {locBusy ? <ActivityIndicator size="small" color={theme.colors.brand} /> : <LocateFixed color={myLoc ? '#fff' : theme.colors.brand} size={14} />}
                    <Text style={[styles.chipTxt, !!myLoc && styles.chipTxtActive]}>{myLoc ? 'Using my location' : 'Use my location'}</Text>
                  </Pressable>
                </View>
              </>
            )}

            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable testID="sess-start" onPress={start} disabled={busy} style={[styles.cta, { opacity: busy || !courseId ? 0.5 : 1 }]} accessibilityLabel="Start live session">
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Start Live Session</Text>}
            </Pressable>
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '700', marginTop: theme.spacing.xl, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipTxt: { fontSize: 13, color: theme.colors.onSurfaceTertiary, fontWeight: '600' },
  chipTxtActive: { color: '#fff' },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  methodCard: { width: '48%', backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, gap: 6 },
  methodActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  methodLbl: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  methodDesc: { fontSize: 11, color: theme.colors.muted, lineHeight: 15 },
  err: { color: theme.colors.error, marginTop: theme.spacing.lg, fontSize: 13 },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 16, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: theme.spacing.xl },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
