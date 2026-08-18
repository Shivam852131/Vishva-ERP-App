import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import { ArrowLeft, Search, Wifi, FileText, Download } from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Button, GradientButton, EmptyState } from '@/src/ui';
import { useLocalShare } from '@/src/localshare/hooks/useLocalShare';
import { ConnectionStatus } from '@/src/localshare/components/ConnectionStatus';
import { FileCard } from '@/src/localshare/components/FileCard';
import { formatFileSize } from '@/src/localshare/utils/fileChunker';

export default function LocalShareJoin() {
  const { code } = useLocalSearchParams();
  const [shareCode, setShareCode] = useState(code || '');
  const [sessionData, setSessionData] = useState(null);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const { joinSession, loading, error } = useLocalShare();

  useEffect(() => {
    if (code) {
      setShareCode(code.toUpperCase());
      handleJoin(code.toUpperCase());
    }
  }, []);

  const handleJoin = async (codeToJoin) => {
    const finalCode = (codeToJoin || shareCode).trim().toUpperCase();
    if (!finalCode) return;

    setJoining(true);
    try {
      const data = await joinSession(finalCode);
      setSessionData(data.session);
      setJoined(true);
    } catch (e) {
      Alert.alert('Join Failed', e.message || 'Could not join session.');
    } finally {
      setJoining(false);
    }
  };

  const handleDownloadAll = () => {
    if (!sessionData) return;
    router.push(`/localshare-transfer?sessionId=${sessionData.id}&sessionData=${encodeURIComponent(JSON.stringify(sessionData))}`);
  };

  if (joined && sessionData) {
    return (
      <ErrorBoundary>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.header}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()}>
                <ArrowLeft color="#fff" size={20} />
              </Pressable>
              <Text style={styles.headerTitle}>Session Joined</Text>
              <View style={{ width: 20 }} />
            </View>
          </LinearGradient>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            <View style={styles.sessionInfo}>
              <Text style={styles.sessionTitle}>{sessionData.title}</Text>
              <Text style={styles.teacherName}>by {sessionData.teacher_name}</Text>
              {sessionData.description ? (
                <Text style={styles.description}>{sessionData.description}</Text>
              ) : null}
            </View>

            <View style={styles.filesHeader}>
              <FileText size={18} color={theme.colors.brandPrimary} />
              <Text style={styles.filesTitle}>Available Files ({sessionData.files?.length || 0})</Text>
            </View>

            {sessionData.files?.length > 0 ? (
              sessionData.files.map((file, i) => (
                <FileCard key={i} file={file} />
              ))
            ) : (
              <EmptyState title="No files shared yet" icon={<FileText size={48} color={theme.colors.muted} />} />
            )}
          </ScrollView>

          <View style={styles.footer}>
            <GradientButton
              label="Download All Files"
              icon={<Download size={18} color="#fff" />}
              onPress={handleDownloadAll}
              disabled={!sessionData.files?.length}
            />
          </View>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text style={styles.headerTitle}>Join Session</Text>
            <View style={{ width: 20 }} />
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.joinSection}>
            <Wifi size={48} color={theme.colors.brandPrimary} />
            <Text style={styles.joinTitle}>Enter Share Code</Text>
            <Text style={styles.joinSub}>Ask your teacher for the share code</Text>

            <TextInput
              style={styles.codeInput}
              placeholder="LS-XXXX"
              placeholderTextColor={theme.colors.muted}
              value={shareCode}
              onChangeText={(t) => setShareCode(t.toUpperCase())}
              autoCapitalize="characters"
              maxLength={7}
              autoFocus
            />

            <GradientButton
              label="Join Session"
              icon={<Search size={18} color="#fff" />}
              onPress={() => handleJoin()}
              loading={joining}
              disabled={!shareCode.trim()}
            />

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>
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
  content: { flex: 1, backgroundColor: theme.colors.surface },
  contentContainer: { padding: theme.spacing.lg, paddingBottom: 100 },
  joinSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxxl,
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  joinTitle: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold, color: theme.colors.onSurface },
  joinSub: { fontSize: theme.font.size.base, color: theme.colors.muted },
  codeInput: {
    width: '100%',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    fontSize: theme.font.size.xxxl,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.onSurface,
    textAlign: 'center',
    letterSpacing: 6,
    backgroundColor: theme.colors.surfaceSecondary,
    marginTop: theme.spacing.lg,
  },
  errorText: { color: theme.colors.error, fontSize: theme.font.size.sm, marginTop: theme.spacing.sm },
  sessionInfo: { marginBottom: theme.spacing.xl },
  sessionTitle: { fontSize: theme.font.size.xxl, fontWeight: theme.font.weight.bold, color: theme.colors.onSurface },
  teacherName: { fontSize: theme.font.size.base, color: theme.colors.muted, marginTop: 4 },
  description: { fontSize: theme.font.size.base, color: theme.colors.onSurfaceTertiary, marginTop: theme.spacing.sm, lineHeight: 20 },
  filesHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  filesTitle: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface },
  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface },
});
