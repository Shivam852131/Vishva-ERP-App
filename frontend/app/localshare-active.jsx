import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Users, Clock, Square, Send, AlertTriangle,
  RefreshCw, BarChart3, TrendingUp,
} from 'lucide-react-native';
import { launchImageLibrary } from '@/src/native/image-picker';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Button, GradientButton, EmptyState } from '@/src/ui';
import { useLocalShare, useLocalShareRTC } from '@/src/localshare/hooks/useLocalShare';
import { QRCodeDisplay } from '@/src/localshare/components/QRCodeDisplay';
import { ConnectionStatus } from '@/src/localshare/components/ConnectionStatus';
import { FileCard } from '@/src/localshare/components/FileCard';
import { formatFileSize } from '@/src/localshare/utils/fileChunker';
import { subscribeRealtime } from '@/src/realtime/socket';
import { api } from '@/src/api';

export default function LocalShareActive() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { session, fetchSession, endSession } = useLocalShare();
  const [students, setStudents] = useState([]);
  const [monitor, setMonitor] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const rtc = useLocalShareRTC({ session, role: 'teacher' });

  useEffect(() => {
    if (id) fetchSession(id);
  }, [id]);

  const fetchMonitor = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api(`/localshare/sessions/${id}/monitor`);
      setMonitor(data);
    } catch {}
  }, [id]);

  useEffect(() => {
    if (session?.status === 'active') fetchMonitor();
  }, [session?.status, fetchMonitor]);

  useEffect(() => {
    if (!session?.session_id) return;
    const off1 = subscribeRealtime('localshare:student-joined', (data) => {
      if (data.session_id === session.session_id) {
        setStudents(prev => [...prev.filter(s => s.student_id !== data.student?.student_id), data.student]);
        fetchMonitor();
      }
    });
    const off2 = subscribeRealtime('localshare:student-left', (data) => {
      if (data.session_id === session.session_id) {
        setStudents(prev => prev.filter(s => s.student_id !== data.student_id));
        fetchMonitor();
      }
    });
    const off3 = subscribeRealtime('localshare:file-downloaded', () => fetchMonitor());
    return () => { off1(); off2(); off3(); };
  }, [session?.session_id, fetchMonitor]);

  useEffect(() => {
    if (session?.status === 'active') rtc.initAsTeacher();
    return () => rtc.disconnect();
  }, [session?.status]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSession(id);
    await fetchMonitor();
    setRefreshing(false);
  }, [id, fetchSession, fetchMonitor]);

  const handleSendFiles = async () => {
    if (!rtc.isConnected) {
      Alert.alert('Not Connected', 'Waiting for WebRTC connection. Students will receive files once connected.');
      return;
    }
    try {
      const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10 });
      if (result.didCancel) return;

      const filesToSend = (result.assets || []).map(asset => ({
        fileId: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: asset.fileName || asset.uri.split('/').pop(),
        size: asset.fileSize || 0,
        type: asset.type === 'video' ? 'video/mp4' : (asset.mimeType || 'image/jpeg'),
        uri: asset.uri,
      }));

      const { completed, failed } = await rtc.sendFiles(filesToSend);
      if (failed > 0) {
        Alert.alert('Transfer Complete', `${completed} sent, ${failed} failed.`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to send files.');
    }
  };

  const handleEnd = () => {
    const activeTransfers = Object.values(rtc.transfers || {}).filter(t => t.status === 'sending' || t.status === 'receiving');
    if (activeTransfers.length > 0) {
      Alert.alert('Active Transfers', `${activeTransfers.length} transfer(s) in progress. End anyway?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End', style: 'destructive', onPress: doEnd },
      ]);
    } else {
      Alert.alert('End Session', 'Students will be disconnected. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End', style: 'destructive', onPress: doEnd },
      ]);
    }
  };

  const doEnd = async () => {
    await endSession(session.id);
    router.back();
  };

  if (!session) return null;

  const activeTransfers = Object.entries(rtc.transfers || {}).filter(
    ([, t]) => t.status === 'sending' || t.status === 'receiving'
  );

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text style={styles.headerTitle}>Active Session</Text>
            <ConnectionStatus state={rtc.connectionState} />
          </View>
        </LinearGradient>

        {rtc.error && (
          <View style={styles.errorBanner}>
            <AlertTriangle size={16} color={theme.colors.error} />
            <Text style={styles.errorText}>{rtc.error}</Text>
            {rtc.retryCount > 0 && rtc.retryCount < 3 && (
              <Pressable onPress={rtc.init}>
                <RefreshCw size={14} color={theme.colors.brandPrimary} />
              </Pressable>
            )}
          </View>
        )}

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <QRCodeDisplay shareCode={session.share_code} title={session.title} />

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Users size={18} color={theme.colors.brandPrimary} />
              <Text style={styles.statValue}>{monitor?.total_participants || students.length || 0}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.stat}>
              <BarChart3 size={18} color={theme.colors.brandPrimary} />
              <Text style={styles.statValue}>{monitor?.total_downloads || 0}</Text>
              <Text style={styles.statLabel}>Downloads</Text>
            </View>
            <View style={styles.stat}>
              <TrendingUp size={18} color={theme.colors.brandPrimary} />
              <Text style={styles.statValue}>{monitor?.total_bytes_transferred ? formatFileSize(monitor.total_bytes_transferred) : '0 B'}</Text>
              <Text style={styles.statLabel}>Transferred</Text>
            </View>
          </View>

          {session.files?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Shared Files ({session.files.length})</Text>
              {session.files.map((file, i) => (
                <FileCard key={i} file={file} transfer={rtc.transfers?.[file.file_id]} />
              ))}
            </View>
          )}

          {activeTransfers.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Active Transfers ({activeTransfers.length})</Text>
              {activeTransfers.map(([fileId, t]) => (
                <View key={fileId} style={styles.transferCard}>
                  <View style={styles.transferHeader}>
                    <Text style={styles.transferName} numberOfLines={1}>{t.name}</Text>
                    <Text style={styles.transferSpeed}>{t.speed || ''}</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${t.progress || 0}%` }]} />
                  </View>
                  <Text style={styles.transferProgress}>{t.progress || 0}% · {t.status}</Text>
                </View>
              ))}
            </View>
          )}

          {monitor?.participants?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Student Activity</Text>
              {monitor.participants.map((p, i) => (
                <View key={i} style={styles.studentCard}>
                  <View style={styles.studentAvatar}>
                    <Text style={styles.studentInitial}>{(p.student_name || '?')[0]}</Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{p.student_name}</Text>
                    <Text style={styles.studentStats}>
                      {p.files_downloaded} files · {formatFileSize(p.total_bytes)}
                    </Text>
                  </View>
                  <ConnectionStatus
                    state={p.connection_status === 'connected' ? 'connected' : 'disconnected'}
                    compact
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <GradientButton
            label="Send Files"
            icon={<Send size={18} color="#fff" />}
            onPress={handleSendFiles}
            disabled={!rtc.isConnected}
            style={{ flex: 1 }}
          />
          <Button
            label="End"
            icon={<Square size={16} />}
            variant="secondary"
            onPress={handleEnd}
            style={{ flex: 0.4 }}
          />
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.brand },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, flex: 1, textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  errorText: { flex: 1, fontSize: theme.font.size.sm, color: theme.colors.error },
  content: { flex: 1, backgroundColor: theme.colors.surface },
  contentContainer: { padding: theme.spacing.lg, paddingBottom: 100 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.onSurface },
  statLabel: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  section: { marginBottom: theme.spacing.xl },
  sectionTitle: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface, marginBottom: theme.spacing.md },
  transferCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  transferHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  transferName: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.medium, flex: 1 },
  transferSpeed: { fontSize: theme.font.size.xs, color: theme.colors.brandPrimary, fontWeight: theme.font.weight.semibold },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: theme.colors.brandPrimary, borderRadius: 3 },
  transferProgress: { fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: 4 },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitial: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.colors.brand },
  studentInfo: { flex: 1 },
  studentName: { fontSize: theme.font.size.base, color: theme.colors.onSurface },
  studentStats: { fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: 2 },
  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, flexDirection: 'row', gap: theme.spacing.md },
});
