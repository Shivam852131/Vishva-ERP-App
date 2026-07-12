import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import { CameraView, useCameraPermissions } from '@/src/native/camera';
import { ArrowLeft, QrCode, CheckCircle2, Settings } from 'lucide-react-native';
import * as Haptics from '@/src/native/haptics';
import { useMutate } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';

type CheckinResult = { ok: boolean; msg: string; detail?: string };

export default function ScanScreen() {
  const { sid } = useLocalSearchParams<{ sid?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [scanned, setScanned] = useState(false);
  const { mutate: doCheckin } = useMutate<any>();

  const handleCheckin = async (sessionId: string, code: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await doCheckin('/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId, code }),
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setResult({ ok: true, msg: r?.message || 'Checked in', detail: r?.detail });
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
      setScanned(false);
    } finally {
      setBusy(false);
    }
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (scanned || busy || result?.ok) return;
    setScanned(true);
    try {
      const p = JSON.parse(data);
      if (p.sid && p.code) { handleCheckin(p.sid, p.code); return; }
    } catch {}
    if (sid && /^\d{6}$/.test(data)) { handleCheckin(sid, data); return; }
    setResult({ ok: false, msg: 'Not a valid attendance QR code' });
    setTimeout(() => setScanned(false), 1500);
  };

  const submitManual = () => {
    if (!sid) { setResult({ ok: false, msg: 'No session selected — go back and pick a session' }); return; }
    if (manualCode.trim().length !== 6) { setResult({ ok: false, msg: 'Enter the 6-digit code shown by your faculty' }); return; }
    handleCheckin(sid, manualCode.trim());
  };

  const renderCamera = () => {
    if (!permission) return <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 40 }} />;
    if (!permission.granted) {
      return (
        <View style={styles.permBox}>
          <QrCode color={theme.colors.brandSecondary} size={40} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permSub}>We use your camera only to scan the attendance QR code shown by your faculty.</Text>
          {permission.canAskAgain ? (
            <Pressable testID="grant-camera" onPress={requestPermission} style={styles.permBtn} accessibilityLabel="Allow camera">
              <Text style={styles.permBtnTxt}>Allow Camera</Text>
            </Pressable>
          ) : (
            <Pressable testID="open-settings" onPress={() => Linking.openSettings()} style={styles.permBtn} accessibilityLabel="Open settings">
              <Settings color="#fff" size={16} />
              <Text style={styles.permBtnTxt}>Open Settings</Text>
            </Pressable>
          )}
        </View>
      );
    }
    return (
      <View style={styles.camWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onBarcode}
        />
        <View style={styles.frame} />
        <Text style={styles.camHint}>Point at the QR code on the faculty screen</Text>
      </View>
    );
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surfaceInverse }}>
        <View style={styles.header}>
          <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back">
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
          <Text style={styles.title}>Scan to Check In</Text>
          <View style={{ width: 22 }} />
        </View>

        {result?.ok ? (
          <View style={styles.successBox}>
            <CheckCircle2 color={theme.colors.success} size={64} />
            <Text style={styles.successTitle}>{result.msg}</Text>
            {result.detail ? <Text style={styles.successSub}>{result.detail}</Text> : null}
            <Pressable testID="scan-done" onPress={() => router.back()} style={styles.permBtn} accessibilityLabel="Done">
              <Text style={styles.permBtnTxt}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {renderCamera()}
            <View style={styles.manualBox}>
              <Text style={styles.manualLbl}>Or enter the 6-digit code</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  testID="manual-code"
                  value={manualCode}
                  onChangeText={setManualCode}
                  placeholder="123456"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  style={styles.codeInput}
                  keyboardType="number-pad"
                  maxLength={6}
                />
                <Pressable testID="manual-submit" onPress={submitManual} disabled={busy} style={styles.goBtn} accessibilityLabel="Check in with code">
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.permBtnTxt}>Check In</Text>}
                </Pressable>
              </View>
              {result && !result.ok ? <Text style={styles.errTxt}>{result.msg}</Text> : null}
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
  camWrap: { flex: 1, margin: theme.spacing.lg, borderRadius: theme.radius.lg, overflow: 'hidden', backgroundColor: '#131B17', alignItems: 'center', justifyContent: 'center' },
  frame: { width: 220, height: 220, borderRadius: 24, borderWidth: 3, borderColor: theme.colors.brandSecondary },
  camHint: { position: 'absolute', bottom: 18, color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  permBox: { flex: 1, margin: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: '#131B17', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: 10 },
  permTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  permSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  permBtn: { flexDirection: 'row', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: theme.radius.pill, marginTop: 10, alignItems: 'center' },
  permBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  manualBox: { padding: theme.spacing.lg, paddingBottom: 30 },
  manualLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  codeInput: { flex: 1, backgroundColor: '#131B17', borderWidth: 1, borderColor: '#1E293B', borderRadius: theme.radius.md, padding: 14, fontSize: 20, letterSpacing: 6, color: '#fff', fontWeight: '800', textAlign: 'center' },
  goBtn: { backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  errTxt: { color: theme.colors.error, marginTop: 10, fontSize: 13 },
  successBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: theme.spacing.xl },
  successTitle: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  successSub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, textAlign: 'center' },
});
