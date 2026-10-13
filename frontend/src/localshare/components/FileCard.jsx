import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileText, Image, File, CheckCircle2, AlertCircle, Loader } from 'lucide-react-native';
import { theme } from '@/src/theme';
import { formatFileSize } from '../utils/fileChunker';

const ICON_MAP = {
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'image/png': Image,
  'image/jpeg': Image,
  'text/plain': FileText,
  'application/zip': File,
};

export function FileCard({ file, transfer, showStatus = true }) {
  const Icon = ICON_MAP[file.type] || File;
  const progress = transfer?.progress || 0;
  const status = transfer?.status;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Icon size={22} color={theme.colors.brandPrimary} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
        <Text style={styles.size}>{formatFileSize(file.size)}</Text>
      </View>
      {showStatus && status && (
        <View style={styles.statusWrap}>
          {status === 'completed' && <CheckCircle2 size={18} color={theme.colors.success} />}
          {status === 'failed' && <AlertCircle size={18} color={theme.colors.error} />}
          {(status === 'sending' || status === 'receiving') && (
            <View style={styles.progressWrap}>
              <Loader size={14} color={theme.colors.brandPrimary} />
              <Text style={styles.progress}>{progress}%</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
  name: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface },
  size: { fontSize: theme.font.size.sm, color: theme.colors.muted, marginTop: 2 },
  statusWrap: { alignItems: 'flex-end' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progress: { fontSize: theme.font.size.sm, color: theme.colors.brandPrimary, fontWeight: theme.font.weight.semibold },
});
