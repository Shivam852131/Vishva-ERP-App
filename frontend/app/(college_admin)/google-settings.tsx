import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, Switch, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Sheet } from 'lucide-react-native';
import { useRouter } from '@/src/navigation/router';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { subscribeRealtime } from '@/src/realtime/socket';
import { theme } from '@/src/theme';

type GoogleStatus = {
  sign_in: { configured: boolean };
  api: { serviceAccount: boolean; serviceAccountEmail?: string | null };
  meet: { configured: boolean; fallback?: string };
  sheets: {
    configured: boolean;
    connected: boolean;
    enabled: boolean;
    spreadsheetId: string | null;
    spreadsheetUrl: string | null;
    title?: string | null;
    ownedBy?: string | null;
    lastSyncAt: string | null;
    lastSyncResult: { ok: boolean; rows: number } | null;
    pending: number;
    failed: number;
    syncedTypes: string[];
    requiresOwnedSheet?: boolean;
  };
};

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={[styles.pill, ok ? styles.pillOk : styles.pillWarn]}>
      <View style={[styles.pillDot, { backgroundColor: ok ? '#16A34A' : '#D97706' }]} />
      <Text style={[styles.pillTxt, { color: ok ? '#15803D' : '#B45309' }]}>{label}</Text>
    </View>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function GoogleSettingsScreen() {
  const router = useRouter();
  const { data: status, loading, error, refresh } = useFetch<GoogleStatus>('/google/status');
  const { mutate, loading: working } = useMutate();
  const [busy, setBusy] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const serviceAccountEmail = status?.api?.serviceAccountEmail || null;

  // Real-time: refresh when a sync completes elsewhere.
  const lastSyncRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    lastSyncRef.current = status?.sheets?.lastSyncAt || null;
  }, [status?.sheets?.lastSyncAt]);
  subscribeRealtime('google:sheets:synced', () => refresh());

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }, [busy]);

  const connect = () =>
    run('connect', async () => {
      try {
        const url = sheetUrl.trim();
        const res = (await mutate('/google/sheets/connect', {
          method: 'POST',
          body: JSON.stringify(url ? { spreadsheetUrl: url } : {}),
        })) as { spreadsheetUrl?: string };
        refresh();
        setSheetUrl('');
        const opened = res?.spreadsheetUrl;
        if (opened) {
          Alert.alert(
            'Google Sheets connected',
            'Live ERP data will now sync into your spreadsheet. Rows appear within seconds of a change.',
            [
              { text: 'Later', style: 'cancel' },
              { text: 'Open sheet', onPress: () => Linking.openURL(opened).catch(() => {}) },
            ],
          );
        }
      } catch (e: any) {
        Alert.alert('Could not connect', e?.message || 'Check the Google service account setup on the server.');
      }
    });

  const copyServiceAccountEmail = () => {
    if (!serviceAccountEmail) return;
    Alert.alert('Service account', serviceAccountEmail, [{ text: 'Done' }]);
  };

  const syncNow = () =>
    run('sync', async () => {
      try {
        const res = (await mutate('/google/sheets/sync-now', { method: 'POST' })) as { flushed?: number };
        refresh();
        Alert.alert('Sync complete', `${res?.flushed ?? 0} row(s) synced to Google Sheets.`);
      } catch (e: any) {
        Alert.alert('Sync failed', e?.message || 'Please try again.');
      }
    });

  const toggleEnabled = async (value: boolean) => {
    try {
      await mutate(value ? '/google/sheets/enable' : '/google/sheets/disable', { method: 'POST' });
      refresh();
    } catch (e: any) {
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const sheets = status?.sheets;
  const lastSyncLabel = sheets?.lastSyncAt
    ? new Date(sheets.lastSyncAt).toLocaleString()
    : 'Never';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
            <ArrowLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Google Workspace</Text>
            <Text style={styles.subtitle}>Sign-in, Meet and live Sheets sync</Text>
          </View>
          <View style={styles.headerIcon}>
            <Sheet size={20} color="#2563EB" />
          </View>
        </View>

      {loading && !status ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error && !status ? (
        <View style={styles.centered}>
          <Text style={styles.errorTxt}>Could not load status.</Text>
          <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── Overview ── */}
          <Section title="Services" subtitle="What the server has configured">
            <View style={styles.statusRow}>
              <StatusPill ok={!!status?.sign_in?.configured} label={status?.sign_in?.configured ? 'Sign-In ready' : 'Sign-In not set'} />
              <StatusPill ok label={status?.meet?.configured ? 'Meet links ready' : 'Live video ready (Jitsi)'} />
              <StatusPill ok={!!sheets?.configured} label={sheets?.configured ? 'Sheets API ready' : 'Sheets API not set'} />
            </View>
            <Text style={styles.hint}>
              Sign-In uses GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Live video falls back to a free
              Jitsi room when Google Meet is unavailable, and Sheets uses the GOOGLE_SERVICE_ACCOUNT_*
              credentials to write into your own spreadsheet.
            </Text>
          </Section>

          {/* ── Sheets live sync ── */}
          <Section
            title="Real-time data sync"
            subtitle="Attendance and fee payments stream into Google Sheets as they happen"
          >
            {!sheets?.connected ? (
              <>
                <Text style={styles.emptyTxt}>
                  Rows are appended within seconds of a check-in or payment — no manual export
                  needed. Because of how Google service accounts work, the sheet must live in
                  your own Google account:
                </Text>
                <View style={styles.stepsBox}>
                  <Text style={styles.stepTxt}>1. Create a blank spreadsheet in your Google Drive</Text>
                  <Text style={styles.stepTxt}>2. Share it with the service account below as “Editor”</Text>
                  <Text style={styles.stepTxt}>3. Paste its link here and connect</Text>
                </View>
                {serviceAccountEmail ? (
                  <TouchableOpacity onPress={copyServiceAccountEmail} style={styles.emailChip} accessibilityLabel="Show service account email">
                    <Text style={styles.emailTxt} numberOfLines={1}>{serviceAccountEmail}</Text>
                    <Text style={styles.emailHint}>Tap to view</Text>
                  </TouchableOpacity>
                ) : null}
                <TextInput
                  value={sheetUrl}
                  onChangeText={setSheetUrl}
                  placeholder="https://docs.google.com/spreadsheets/d/…"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.input}
                  testID="sheet-url-input"
                />
                <TouchableOpacity onPress={connect} style={[styles.primaryBtn, working && { opacity: 0.6 }]} disabled={working}>
                  {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Connect my spreadsheet</Text>}
                </TouchableOpacity>
                {!sheets?.configured ? (
                  <Text style={styles.warnTxt}>
                    The server has no Google service account configured yet, so connecting will
                    fail until GOOGLE_SERVICE_ACCOUNT_EMAIL / KEY are set.
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.sheetCard}>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Status</Text>
                    <StatusPill ok={sheets.enabled} label={sheets.enabled ? 'Syncing live' : 'Paused'} />
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Last sync</Text>
                    <Text style={styles.sheetValue}>{lastSyncLabel}</Text>
                  </View>
                  {sheets.lastSyncResult ? (
                    <View style={styles.sheetRow}>
                      <Text style={styles.sheetLabel}>Last result</Text>
                      <Text style={styles.sheetValue}>
                        {sheets.lastSyncResult.ok ? `${sheets.lastSyncResult.rows} row(s) written` : 'Failed'}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Queued / failed</Text>
                    <Text style={styles.sheetValue}>
                      {sheets.pending} pending · {sheets.failed} failed
                    </Text>
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={styles.sheetLabel}>Syncing</Text>
                    <Text style={styles.sheetValue}>{(sheets.syncedTypes || []).join(', ') || '—'}</Text>
                  </View>
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Auto-sync</Text>
                    <Text style={styles.switchSub}>Stream new records automatically</Text>
                  </View>
                  <Switch
                    value={sheets.enabled}
                    onValueChange={toggleEnabled}
                    trackColor={{ true: '#2563EB55', false: '#E2E8F0' }}
                    thumbColor={sheets.enabled ? '#2563EB' : '#94A3B8'}
                  />
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity onPress={syncNow} style={[styles.primaryBtn, { flex: 1 }, busy === 'sync' && { opacity: 0.6 }]} disabled={!!busy}>
                    {busy === 'sync' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Sync now</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      sheets.spreadsheetUrl
                        ? Linking.openURL(sheets.spreadsheetUrl).catch(() => Alert.alert('Could not open', 'No browser available.'))
                        : Alert.alert('No spreadsheet', 'Reconnect Google Sheets first.')
                    }
                    style={[styles.secondaryBtn, { flex: 1 }]}
                  >
                    <Text style={styles.secondaryBtnTxt}>Open sheet</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Section>

          {/* ── What syncs ── */}
          {sheets?.connected ? (
            <Section title="What syncs" subtitle="Each dataset lives in its own tab of the spreadsheet">
              {(sheets.syncedTypes || []).map(type => (
                <View key={type} style={styles.typeRow}>
                  <View style={styles.typeDot} />
                  <Text style={styles.typeTxt}>
                    {type === 'attendance'
                      ? 'Attendance — every check-in with student, course, status and time'
                      : type === 'fee_payment'
                        ? 'Fee Payments — every captured payment with receipt and amount'
                        : 'Placements — placement drive activity'}
                  </Text>
                </View>
              ))}
            </Section>
          ) : null}

          <View style={{ height: 40 }} />
        </>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  errorTxt: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2563EB' },
  retryTxt: { color: '#fff', fontWeight: '700' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', ...theme.shadow.xs },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  sectionSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  sectionBody: { gap: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  pillOk: { backgroundColor: '#DCFCE7' },
  pillWarn: { backgroundColor: '#FEF3C7' },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillTxt: { fontSize: 11, fontWeight: '700' },
  hint: { fontSize: 11, color: '#94A3B8', lineHeight: 16 },
  emptyTxt: { fontSize: 13, color: '#475569', lineHeight: 19 },
  stepsBox: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  stepTxt: { fontSize: 12, color: '#334155', lineHeight: 18 },
  emailChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  emailTxt: { flex: 1, fontSize: 11, color: '#1D4ED8', fontWeight: '600' },
  emailHint: { fontSize: 10, color: '#2563EB', fontWeight: '700' },
  input: { height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 12, fontSize: 13, color: '#0F172A', backgroundColor: '#fff' },
  warnTxt: { fontSize: 11, color: '#B45309', lineHeight: 16 },
  primaryBtn: { height: 46, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  primaryBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryBtn: { height: 46, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnTxt: { color: '#2563EB', fontSize: 14, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10 },
  sheetCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  sheetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sheetLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  sheetValue: { fontSize: 12, color: '#0F172A', fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  switchTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  switchSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  typeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  typeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563EB', marginTop: 6 },
  typeTxt: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 17 },
});
