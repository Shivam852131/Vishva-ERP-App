import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Linking, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import { CameraView, useCameraPermissions } from '@/src/native/camera';
import { ArrowLeft, ScanFace, CheckCircle2, Settings, RefreshCcw, Sparkles } from 'lucide-react-native';
import * as Haptics from '@/src/native/haptics';
import { useMutate } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';

export default function SelfieScreen() {
  const { sid, enrolled } = useLocalSearchParams<{ sid?: string; enrolled?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; detail?: string } | null>(null);
  const { mutate: doCheckin } = useMutate<any>();
  const isEnrolled = enrolled === '1';

  const capture = async () => {
    try {
      const pic = await camRef.current?.takePictureAsync({ base64: true, quality: 0.4 });
      if (pic?.base64) setPhoto(pic.base64);
    } catch {
      setResult({ ok: false, msg: 'Could not capture photo. Try again.' });
    }
  };

  const verify = async () => {
    if (!photo || !sid) return;
    setVerifying(true);
    setResult(null);
    try {
      const r = await doCheckin('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ session_id: sid, selfie_base64: photo }),
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ok: true, msg: r?.message || 'Verified', detail: r?.detail });
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surfaceInverse }}>
        <View style={styles.header}>
          <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.title}>Face Check-In</Text>
          <View style={{ width: 22 }} />
        </View>

        {result?.ok ? (
          <View style={styles.successBox}>
            <CheckCircle2 color={theme.colors.success} size={64} />
            <Text style={styles.successTitle}>{result.msg}</Text>
            {result.detail ? <Text style={styles.successSub}>{result.detail}</Text> : null}
            <Pressable testID="selfie-done" onPress={() => router.back()} style={styles.cta} accessibilityLabel="Done">
              <Text style={styles.ctaTxt}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {!isEnrolled && (
              <View style={styles.notice}>
                <Sparkles color={theme.colors.brandSecondary} size={16} />
                <Text style={styles.noticeTxt}>First time? This selfie becomes your reference photo for future AI face verification.</Text>
              </View>
            )}
            <View style={styles.camWrap}>
              {!permission ? (
                <ActivityIndicator color={theme.colors.brandPrimary} />
              ) : !permission.granted ? (
                <View style={styles.permBox}>
                  <ScanFace color={theme.colors.brandSecondary} size={40} />
                  <Text style={styles.permTitle}>Camera access needed</Text>
                  <Text style={styles.permSub}>Take a quick selfie so AI can verify it is really you checking in.</Text>
                  {permission.canAskAgain ? (
                    <Pressable testID="grant-camera" onPress={requestPermission} style={styles.cta} accessibilityLabel="Allow camera">
                      <Text style={styles.ctaTxt}>Allow Camera</Text>
                    </Pressable>
                  ) : (
                    <Pressable testID="open-settings" onPress={() => Linking.openSettings()} style={styles.cta} accessibilityLabel="Open settings">
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
                  <View style={styles.faceFrame} />
                </>
              )}
              {verifying && (
                <View style={styles.verifyOverlay}>
                  <ActivityIndicator color={theme.colors.brandSecondary} size="large" />
                  <Text style={styles.verifyTxt}>AI is verifying your face…</Text>
                </View>
              )}
            </View>

            {result && !result.ok ? <Text style={styles.errTxt}>{result.msg}</Text> : null}

            <View style={styles.actions}>
              {photo ? (
                <>
                  <Pressable
                    testID="selfie-retake"
                    onPress={() => { setPhoto(null); setResult(null); }}
                    style={styles.secondary}
                    accessibilityLabel="Retake photo"
                  >
                    <RefreshCcw color={theme.colors.brandSecondary} size={16} />
                    <Text style={styles.secondaryTxt}>Retake</Text>
                  </Pressable>
                  <Pressable
                    testID="selfie-verify"
                    onPress={verify}
                    disabled={verifying}
                    style={[styles.cta, { flex: 1 }]}
                    accessibilityLabel={isEnrolled ? 'Verify and check in' : 'Enroll and check in'}
                  >
                    {verifying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.ctaTxt}>{isEnrolled ? 'Verify & Check In' : 'Enroll & Check In'}</Text>
                    )}
                  </Pressable>
                </>
              ) : permission?.granted ? (
                <Pressable testID="selfie-capture" onPress={capture} style={[styles.cta, { flex: 1 }]} accessibilityLabel="Capture selfie">
                  <ScanFace color="#fff" size={18} />
                  <Text style={styles.ctaTxt}>Capture Selfie</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 17, fontWeight: '800', color: '#fff' },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', marginHorizontal: theme.spacing.lg, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: theme.radius.md, padding: 12, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  noticeTxt: { flex: 1, color: theme.colors.brandSecondary, fontSize: 12, lineHeight: 17 },
  camWrap: { flex: 1, margin: theme.spacing.lg, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: '#131B17', alignItems: 'center', justifyContent: 'center' },
  faceFrame: { width: 210, height: 270, borderRadius: 130, borderWidth: 3, borderColor: theme.colors.brandSecondary },
  verifyOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,15,13,0.75)', alignItems: 'center', justifyContent: 'center', gap: 14 },
  verifyTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  permBox: { alignItems: 'center', padding: theme.spacing.xl, gap: 10 },
  permTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  permSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, padding: theme.spacing.lg, paddingBottom: 30 },
  cta: { flexDirection: 'row', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondary: { flexDirection: 'row', gap: 8, borderWidth: 1.5, borderColor: theme.colors.brandSecondary, paddingHorizontal: 18, paddingVertical: 14, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  secondaryTxt: { color: theme.colors.brandSecondary, fontWeight: '700', fontSize: 14 },
  errTxt: { color: theme.colors.error, marginHorizontal: theme.spacing.lg, fontSize: 13, textAlign: 'center' },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: theme.spacing.xl },
  successTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' },
});
