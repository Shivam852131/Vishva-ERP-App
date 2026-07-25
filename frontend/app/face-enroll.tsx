import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Platform, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import { CameraView, useCameraPermissions } from '@/src/native/camera';
import { ArrowLeft, ScanFace, CheckCircle2, Settings, RefreshCcw, Shield, Eye, Camera } from 'lucide-react-native';
import * as Haptics from '@/src/native/haptics';
import { useMutate, useFetch } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';

type EnrollStatus = 'idle' | 'capturing' | 'analyzing' | 'ready' | 'enrolling' | 'success' | 'failed';

export default function FaceEnrollScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<EnrollStatus>('idle');
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const { mutate: enroll } = useMutate<any>();
  const { data: profile } = useFetch<any>('/face/profile');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isEnrolled = profile?.enrolled;

  useEffect(() => {
    if (status === 'idle') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
    return () => pulseAnim.setValue(1);
  }, [status]);

  const capture = async () => {
    try {
      setStatus('capturing');
      setResult(null);
      const pic = await camRef.current?.takePictureAsync({ base64: true, quality: 0.4 });
      if (pic?.base64) {
        setPhoto(pic.base64);
        setStatus('analyzing');
        setTimeout(() => setStatus('ready'), 1000);
      } else {
        setStatus('idle');
        setResult({ ok: false, msg: 'Could not capture photo.' });
      }
    } catch {
      setStatus('idle');
      setResult({ ok: false, msg: 'Camera error.' });
    }
  };

  const doEnroll = async () => {
    if (!photo) return;
    setStatus('enrolling');
    setResult(null);
    try {
      const r = await enroll('/face/enroll', {
        method: 'POST',
        body: JSON.stringify({ selfie_base64: photo }),
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStatus('success');
      setResult({ ok: true, msg: r?.message || 'Face enrolled!' });
    } catch (e: any) {
      setStatus('failed');
      setResult({ ok: false, msg: e.message || 'Enrollment failed' });
    }
  };

  const retake = () => {
    setPhoto(null);
    setResult(null);
    setStatus('idle');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ready': return '#10B981';
      case 'enrolling': return theme.colors.brandSecondary;
      case 'success': return '#10B981';
      case 'failed': return theme.colors.error;
      default: return theme.colors.brandSecondary;
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surfaceInverse }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Face ID Enrollment</Text>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          </View>
          <View style={{ width: 22 }} />
        </View>

        {isEnrolled && (
          <View style={styles.enrolledBanner}>
            <CheckCircle2 color="#10B981" size={14} />
            <Text style={styles.enrolledTxt}>Face already enrolled on {new Date(profile.enrolled_at).toLocaleDateString()}</Text>
          </View>
        )}

        {result?.ok ? (
          <View style={styles.successBox}>
            <CheckCircle2 color="#10B981" size={72} />
            <Text style={styles.successTitle}>{result.msg}</Text>
            <Text style={styles.successSub}>Your face is now registered for attendance check-in</Text>
            <Pressable onPress={() => router.back()} style={styles.cta}>
              <Text style={styles.ctaTxt}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.instructions}>
              <Shield color={theme.colors.brandSecondary} size={16} />
              <Text style={styles.instrTxt}>Position your face clearly in the oval. Good lighting helps AI verify you better.</Text>
            </View>

            <View style={styles.camWrap}>
              {!permission ? (
                <ActivityIndicator color={theme.colors.brandPrimary} />
              ) : !permission.granted ? (
                <View style={styles.permBox}>
                  <ScanFace color={theme.colors.brandSecondary} size={48} />
                  <Text style={styles.permTitle}>Camera Access Needed</Text>
                  <Text style={styles.permSub}>We need your camera to enroll your face for attendance.</Text>
                  {permission.canAskAgain ? (
                    <Pressable onPress={requestPermission} style={styles.cta}>
                      <Camera color="#fff" size={16} />
                      <Text style={styles.ctaTxt}>Allow Camera</Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => Linking.openSettings()} style={styles.cta}>
                      <Settings color="#fff" size={16} />
                      <Text style={styles.ctaTxt}>Open Settings</Text>
                    </Pressable>
                  )}
                </View>
              ) : photo ? (
                <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <>
                  <CameraView ref={camRef} style={StyleSheet.absoluteFill} facing="front" />
                  <Animated.View style={[styles.faceFrame, { transform: [{ scale: pulseAnim }] }]} />
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </>
              )}

              {status === 'enrolling' && (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#10B981" size="large" />
                  <Text style={styles.overlayTxt}>Enrolling face...</Text>
                </View>
              )}
            </View>

            {result && !result.ok ? <Text style={styles.errTxt}>{result.msg}</Text> : null}

            <View style={styles.actions}>
              {photo ? (
                <>
                  <Pressable onPress={retake} style={styles.secondary} disabled={status === 'enrolling'}>
                    <RefreshCcw color={theme.colors.brandSecondary} size={16} />
                    <Text style={styles.secondaryTxt}>Retake</Text>
                  </Pressable>
                  <Pressable
                    onPress={doEnroll}
                    disabled={status !== 'ready'}
                    style={[styles.cta, { flex: 1, opacity: status !== 'ready' ? 0.5 : 1 }]}
                  >
                    <Shield color="#fff" size={16} />
                    <Text style={styles.ctaTxt}>{isEnrolled ? 'Update Face' : 'Enroll Face'}</Text>
                  </Pressable>
                </>
              ) : permission?.granted ? (
                <Pressable onPress={capture} style={[styles.cta, { flex: 1 }]}>
                  <ScanFace color="#fff" size={18} />
                  <Text style={styles.ctaTxt}>Take Selfie</Text>
                </Pressable>
              ) : null}
            </View>

            {profile?.enrolled && (
              <View style={styles.profileInfo}>
                <Eye color={theme.colors.muted} size={12} />
                <Text style={styles.profileTxt}>Verified {profile.verification_count} times · Last: {profile.last_verified ? new Date(profile.last_verified).toLocaleString() : 'Never'}</Text>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  enrolledBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: theme.spacing.lg, marginBottom: 8, padding: 10, backgroundColor: 'rgba(16,185,129,0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  enrolledTxt: { color: '#10B981', fontSize: 12, fontWeight: '600' },
  instructions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginHorizontal: theme.spacing.lg, marginBottom: 8, padding: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  instrTxt: { flex: 1, color: theme.colors.muted, fontSize: 11, lineHeight: 16 },
  camWrap: { flex: 1, margin: theme.spacing.lg, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: '#0A0F0D', alignItems: 'center', justifyContent: 'center' },
  faceFrame: { width: 220, height: 280, borderRadius: 140, borderWidth: 2, borderColor: theme.colors.brandSecondary, position: 'absolute' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#fff' },
  cornerTL: { top: '25%', left: '20%', borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: '25%', right: '20%', borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: '35%', left: '20%', borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: '35%', right: '20%', borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,15,13,0.8)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  overlayTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  permBox: { alignItems: 'center', padding: theme.spacing.xl, gap: 10 },
  permTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  permSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, padding: theme.spacing.lg, paddingBottom: 16 },
  cta: { flexDirection: 'row', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondary: { flexDirection: 'row', gap: 8, borderWidth: 1.5, borderColor: theme.colors.brandSecondary, paddingHorizontal: 18, paddingVertical: 14, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  secondaryTxt: { color: theme.colors.brandSecondary, fontWeight: '700', fontSize: 14 },
  errTxt: { color: theme.colors.error, marginHorizontal: theme.spacing.lg, fontSize: 12, textAlign: 'center' },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: theme.spacing.xl },
  successTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  successSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' },
  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', paddingBottom: 20 },
  profileTxt: { color: theme.colors.muted, fontSize: 10 },
});
