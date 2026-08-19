import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Plus, X, FileText, Upload } from 'lucide-react-native';
import { launchImageLibraryAsync } from '@/src/native/image-picker';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Button, GradientButton } from '@/src/ui';
import { useLocalShare } from '@/src/localshare/hooks/useLocalShare';
import { FileCard } from '@/src/localshare/components/FileCard';
import { ALLOWED_TYPES, MAX_FILE_SIZE } from '@/src/localshare/utils/rtcConfig';

export default function LocalShareCreate() {
  const { createSession, loading } = useLocalShare();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);

  const pickFiles = async () => {
    try {
      const result = await launchImageLibraryAsync({
        mediaType: 'mixed',
        selectionLimit: 10 - files.length,
      });
      if (result.canceled) {
        if (result.errorCode) {
          let msg = 'Failed to pick files.';
          if (result.errorCode === 'permission') {
            msg = 'Storage permission is required to select files. Please grant permission in Settings.';
          } else if (result.errorMessage) {
            msg = result.errorMessage;
          }
          Alert.alert('Error', msg);
        }
        return;
      }

      const newFiles = (result.assets || []).map(asset => ({
        name: asset.fileName || asset.uri.split('/').pop(),
        size: asset.fileSize || 0,
        type: asset.type === 'video' ? 'video/mp4' : (asset.type || 'image/jpeg'),
        uri: asset.uri,
      })).filter(f => {
        if (f.size > MAX_FILE_SIZE) {
          Alert.alert('File too large', `"${f.name}" exceeds 50MB limit.`);
          return false;
        }
        return true;
      });

      setFiles(prev => [...prev, ...newFiles].slice(0, 10));
    } catch (e) {
      Alert.alert('Error', 'Failed to pick files.');
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title.trim()) return Alert.alert('Title required', 'Please enter a session title.');
    if (files.length === 0) return Alert.alert('Files required', 'Please select at least one file.');

    try {
      const session = await createSession({
        title: title.trim(),
        description: description.trim(),
        files: files.map(f => ({
          name: f.name,
          size: f.size,
          type: f.type,
        })),
      });
      router.replace(`/localshare-active?id=${session.id}`);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create session.');
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <LinearGradient colors={[theme.colors.brand, theme.colors.brandSecondary]} style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text style={styles.headerTitle}>New Session</Text>
            <View style={{ width: 20 }} />
          </View>
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.field}>
            <Text style={styles.label}>Session Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Data Structures - Week 3 Notes"
              placeholderTextColor={theme.colors.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Optional description..."
              placeholderTextColor={theme.colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Files ({files.length}/10)</Text>
            <Pressable style={styles.uploadBtn} onPress={pickFiles}>
              <Upload size={20} color={theme.colors.brandPrimary} />
              <Text style={styles.uploadText}>Select Files</Text>
            </Pressable>
          </View>

          {files.length > 0 && (
            <View style={styles.fileList}>
              {files.map((file, index) => (
                <View key={index} style={styles.fileRow}>
                  <FileCard file={file} showStatus={false} />
                  <Pressable style={styles.removeBtn} onPress={() => removeFile(index)}>
                    <X size={16} color={theme.colors.error} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <GradientButton
            label="Create Session"
            icon={<Plus size={18} color="#fff" />}
            onPress={handleCreate}
            loading={loading}
            disabled={!title.trim() || files.length === 0}
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
  headerTitle: { color: '#fff', fontSize: theme.font.size.xl, fontWeight: theme.font.weight.bold },
  content: { flex: 1, backgroundColor: theme.colors.surface },
  contentContainer: { padding: theme.spacing.lg, paddingBottom: 100 },
  field: { marginBottom: theme.spacing.xl },
  label: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface, marginBottom: theme.spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.font.size.base,
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.brandPrimary,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.brandTertiary,
  },
  uploadText: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.brandPrimary },
  fileList: { gap: theme.spacing.sm },
  fileRow: { position: 'relative' },
  removeBtn: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  footer: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface },
});
