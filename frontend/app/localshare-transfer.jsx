import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Download, CheckCircle2, FileText, Loader, Star, X, AlertTriangle,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Button, GradientButton, EmptyState } from '@/src/ui';
import { useLocalShare, useLocalShareRTC } from '@/src/localshare/hooks/useLocalShare';
import { FileCard } from '@/src/localshare/components/FileCard';
import { ConnectionStatus } from '@/src/localshare/components/ConnectionStatus';
import { formatFileSize } from '@/src/localshare/utils/fileChunker';

export default function LocalShareTransfer() {
  const { sessionId, sessionData } = useLocalSearchParams();
  const [session, setSession] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const { submitFeedback } = useLocalShare();

  useEffect(() => {
    try {
      if (sessionData) setSession(JSON.parse(sessionData));
    } catch {}
  }, [sessionData]);

  const rtc = useLocalShareRTC({
    session,
    role: 'student',
  });

  useEffect(() => {
    if (session?.status === 'active') {
      rtc.initAsStudent();
    }
    return () => rtc.disconnect();
  }, [session?.status]);

  const handleDownload = async (file) => {
    if (!rtc.isConnected) {
      Alert.alert('Not Connected', 'Waiting for WebRTC connection...');
      return;
    }
    Alert.alert('Download', `Download "${file.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Download', onPress: () => {
        rtc.sendData(JSON.stringify({
          type: 'file-request',
          fileId: file.file_id,
          fileName: file.name,
        }));
      }},
    ]);
  };

  const handleDownloadAll = async () => {
    if (!rtc.isConnected || !session?.files?.length) return;
    for (const file of session.files) {
      rtc.sendData(JSON.stringify({
        type: 'file-request',
        fileId: file.file_id,
        fileName: file.name,
      }));
      await new Promise(r => setTimeout(r, 200));
    }
  };

  if (!session) return null;

  const completedCount = Object.values(rtc.transfers || {}).filter(t => t.status === 'completed').length;
  const activeCount = Object.values(rtc.transfers || {}).filter(t => t.status === 'receiving').length;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text style={styles.headerTitle}>Download Files</Text>
            <ConnectionStatus state={rtc.connectionState} />
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            <Text style={styles.teacherName}>by {session.teacher_name}</Text>
          </View>

          {!rtc.isConnected && (
            <View style={styles.connectingCard}>
              <Loader size={20} color={theme.colors.brandPrimary} />
              <Text style={styles.connectingText}>Establishing P2P connection...</Text>
            </View>
          )}

          {rtc.isConnected && (
            <View style={styles.connectedCard}>
              <CheckCircle2 size={18} color={theme.colors.success} />
              <Text style={styles.connectedText}>Connected to teacher's device</Text>
            </View>
          )}

          {rtc.peerDisconnected && (
            <View style={styles.disconnectCard}>
              <AlertTriangle size={18} color={theme.colors.error} />
              <Text style={styles.disconnectText}>Teacher has disconnected. Files can no longer be transferred.</Text>
              <Button label="Go Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} />
            </View>
          )}

          {session.files?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.filesHeader}>
                <FileText size={18} color={theme.colors.brandPrimary} />
                <Text style={styles.filesTitle}>Files ({session.files.length})</Text>
              </View>
              {session.files.map((file, i) => (
                <Pressable key={i} onPress={() => handleDownload(file)}>
                  <FileCard
                    file={{
                      name: file.name,
                      size: file.size,
                      type: file.type,
                    }}
                    transfer={rtc.transfers?.[file.file_id]}
                  />
                </Pressable>
              ))}
            </View>
          )}

          {completedCount > 0 && (
            <View style={styles.statsCard}>
              <CheckCircle2 size={18} color={theme.colors.success} />
              <Text style={styles.statsText}>{completedCount} file{completedCount > 1 ? 's' : ''} received</Text>
            </View>
          )}

          {rtc.receivedFiles?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Saved Files</Text>
              {rtc.receivedFiles.map((file, i) => (
                <View key={i} style={styles.savedCard}>
                  <CheckCircle2 size={16} color={theme.colors.success} />
                  <Text style={styles.savedName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.savedSize}>{formatFileSize(file.size)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {completedCount > 0 && !showFeedback && (
            <Button
              label="Rate"
              icon={<Star size={16} />}
              variant="ghost"
              onPress={() => setShowFeedback(true)}
              style={{ flex: 0.3 }}
            />
          )}
          <GradientButton
            label={`Download All${activeCount > 0 ? ` (${activeCount} active)` : ''}`}
            icon={<Download size={18} color="#fff" />}
            onPress={handleDownloadAll}
            disabled={!rtc.isConnected || !session.files?.length}
            style={{ flex: 1 }}
          />
        </View>

        <Modal visible={showFeedback} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Rate Transfer</Text>
                <Pressable onPress={() => setShowFeedback(false)}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map(s => (
                  <Pressable key={s} onPress={() => setFeedbackRating(s)}>
                    <Star
                      size={32}
                      color={s <= feedbackRating ? '#F59E0B' : theme.colors.border}
                      fill={s <= feedbackRating ? '#F59E0B' : 'transparent'}
                    />
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Optional comment..."
                placeholderTextColor={theme.colors.muted}
                value={feedbackComment}
                onChangeText={setFeedbackComment}
                multiline
                maxLength={500}
              />
              <GradientButton
                label="Submit"
                onPress={async () => {
                  if (feedbackRating > 0 && session?.id) {
                    await submitFeedback(session.id, { rating: feedbackRating, comment: feedbackComment });
                    setShowFeedback(false);
                    Alert.alert('Thanks!', 'Your feedback helps us improve.');
                  }
                }}
                disabled={feedbackRating === 0}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.brand },
  header: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { color: '#fff', fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold, flex: 1, textAlign: 'center' },
  content: { flex: 1, backgroundColor: theme.colors.surface },
  contentContainer: { padding: theme.spacing.lg, paddingBottom: 100 },
  sessionInfo: { marginBottom: theme.spacing.lg },
  sessionTitle: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold, color: theme.colors.onSurface },
  teacherName: { fontSize: theme.font.size.base, color: theme.colors.muted, marginTop: 4 },
  connectingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: '#FFFBEB',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  connectingText: { fontSize: theme.font.size.sm, color: theme.colors.warning, fontWeight: theme.font.weight.medium },
  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: '#ECFDF5',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  connectedText: { fontSize: theme.font.size.sm, color: theme.colors.success, fontWeight: theme.font.weight.medium },
  disconnectCard: {
    backgroundColor: '#FEF2F2',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  disconnectText: { fontSize: theme.font.size.sm, color: theme.colors.error, fontWeight: theme.font.weight.medium, marginTop: 4 },
  section: { marginBottom: theme.spacing.xl },
  filesHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  filesTitle: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface },
  sectionTitle: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface, marginBottom: theme.spacing.md },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: '#ECFDF5',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.lg,
  },
  statsText: { fontSize: theme.font.size.sm, color: theme.colors.success, fontWeight: theme.font.weight.medium },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.sm,
  },
  savedName: { flex: 1, fontSize: theme.font.size.sm, color: theme.colors.onSurface },
  savedSize: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, flexDirection: 'row', gap: theme.spacing.md },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.md },
  feedbackInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.font.size.base,
    color: theme.colors.onSurface,
    height: 80,
    textAlignVertical: 'top',
  },
});
