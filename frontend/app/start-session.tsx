import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import * as Location from '@/src/native/location';
import { QrCode, MapPin, ScanFace, Radar, LocateFixed, Clock, BookOpen, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Course } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { PageHeader, GradientButton, Card } from '@/src/ui';

const METHODS = [
  { key: 'qr', label: 'QR Code', desc: 'Rotating security QR code on your screen', icon: QrCode },
  { key: 'gps', label: 'GPS Radius', desc: 'Verify students are physically inside classroom', icon: MapPin },
  { key: 'face', label: 'AI Face ID', desc: 'AI verifies live selfie against biometric profile', icon: ScanFace },
  { key: 'auto', label: 'Auto Geofence', desc: 'Automatic background check-in within radius', icon: Radar },
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
    if (!courseId) { setErr('Please select a course'); return; }
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
        <PageHeader
          title="Take Attendance"
          subtitle="Configure live verification session"
          onBack={() => router.back()}
        />

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 120 }}>
            {/* Step 1: Course Picker */}
            <View style={styles.sectionHead}>
              <BookOpen size={16} color={theme.colors.brandPrimary} />
              <Text style={styles.label}>Select Course</Text>
            </View>
            <View style={styles.chipWrap}>
              {list.map(c => (
                <Pressable
                  key={c.id}
                  testID={`sess-course-${c.code}`}
                  onPress={() => setCourseId(c.id)}
                  style={[styles.chip, courseId === c.id && styles.chipActive]}
                  accessibilityLabel={`Select course ${c.code}`}
                >
                  <Text style={[styles.chipTxt, courseId === c.id && styles.chipTxtActive]}>
                    {c.code}
                  </Text>
                  {c.name ? (
                    <Text style={[styles.chipSub, courseId === c.id && { color: 'rgba(255,255,255,0.85)' }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>

            {/* Step 2: Verification Mode */}
            <View style={styles.sectionHead}>
              <ShieldCheck size={16} color={theme.colors.brandPrimary} />
              <Text style={styles.label}>Verification Mode</Text>
            </View>
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
                    <View style={[styles.iconCircle, active && { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <Icon color={active ? '#fff' : theme.colors.brandPrimary} size={22} />
                    </View>
                    <Text style={[styles.methodLbl, active && { color: '#fff' }]}>{m.label}</Text>
                    <Text style={[styles.methodDesc, active && { color: 'rgba(255,255,255,0.8)' }]}>{m.desc}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Step 3: Duration */}
            <View style={styles.sectionHead}>
              <Clock size={16} color={theme.colors.brandPrimary} />
              <Text style={styles.label}>Session Window</Text>
            </View>
            <View style={styles.durWrap}>
              {DURATIONS.map(d => (
                <Pressable
                  key={d}
                  testID={`sess-dur-${d}`}
                  onPress={() => setDuration(d)}
                  style={[styles.durChip, duration === d && styles.durChipActive]}
                  accessibilityLabel={`Set duration ${d} minutes`}
                >
                  <Text style={[styles.durTxt, duration === d && styles.durTxtActive]}>{d} mins</Text>
                </Pressable>
              ))}
            </View>

            {needsLocation && (
              <View style={{ marginTop: theme.spacing.lg }}>
                <View style={styles.sectionHead}>
                  <MapPin size={16} color={theme.colors.brandPrimary} />
                  <Text style={styles.label}>Classroom Location</Text>
                </View>
                <Card style={{ padding: 14 }}>
                  <Pressable
                    testID="sess-myloc"
                    onPress={useMyLocation}
                    style={[styles.locBtn, !!myLoc && styles.locBtnActive]}
                    accessibilityLabel="Use my location"
                  >
                    {locBusy ? (
                      <ActivityIndicator size="small" color={theme.colors.brandPrimary} />
                    ) : (
                      <LocateFixed color={myLoc ? '#10B981' : theme.colors.brandPrimary} size={18} />
                    )}
                    <Text style={[styles.locTxt, !!myLoc && { color: '#10B981', fontWeight: '700' }]}>
                      {myLoc ? `Location Set (${myLoc.lat.toFixed(4)}, ${myLoc.lng.toFixed(4)})` : 'Detect Current Classroom Location'}
                    </Text>
                  </Pressable>
                </Card>
              </View>
            )}

            {err ? (
              <View style={styles.errBox}>
                <Text style={styles.err}>{err}</Text>
              </View>
            ) : null}

            <View style={{ marginTop: 24 }}>
              <GradientButton
                testID="sess-start"
                label={busy ? 'Starting Session...' : 'Launch Attendance Session'}
                onPress={start}
                disabled={busy || !courseId}
                loading={busy}
              />
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing.lg, marginBottom: 8 },
  label: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
    minWidth: 90,
  },
  chipActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
    ...theme.shadow.sm,
  },
  chipTxt: { fontSize: 14, color: theme.colors.onSurface, fontWeight: '800' },
  chipTxtActive: { color: '#fff' },
  chipSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  methodCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: 8,
    ...theme.shadow.sm,
  },
  methodActive: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
    ...theme.shadow.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLbl: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  methodDesc: { fontSize: 11, color: theme.colors.muted, lineHeight: 16 },
  durWrap: { flexDirection: 'row', gap: 10 },
  durChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durChipActive: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
    ...theme.shadow.sm,
  },
  durTxt: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '700' },
  durTxtActive: { color: '#fff' },
  locBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  locBtnActive: {},
  locTxt: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' },
  errBox: {
    marginTop: theme.spacing.md,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: theme.radius.md,
  },
  err: { color: theme.colors.error, fontSize: 13, fontWeight: '600' },
});
