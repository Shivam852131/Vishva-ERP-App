import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { theme } from '@/src/theme';

export function QRCodeDisplay({ shareCode, title }) {
  const qrData = useMemo(() => JSON.stringify({
    type: 'LOCALSHARE',
    code: shareCode,
  }), [shareCode]);

  return (
    <View style={styles.container}>
      <View style={styles.qrWrap}>
        <QRCode value={qrData} size={180} color={theme.colors.onSurface} backgroundColor="white" />
      </View>
      <Text style={styles.label}>Scan to join</Text>
      {title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
      <View style={styles.codeWrap}>
        <Text style={styles.code}>{shareCode}</Text>
      </View>
      <Text style={styles.hint}>Or enter code manually</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: theme.spacing.md },
  qrWrap: {
    padding: theme.spacing.lg,
    backgroundColor: 'white',
    borderRadius: theme.radius.lg,
    ...theme.shadow.md,
  },
  label: { fontSize: theme.font.size.sm, color: theme.colors.muted },
  title: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface },
  codeWrap: {
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  code: {
    fontSize: theme.font.size.xxl,
    fontWeight: theme.font.weight.extrabold,
    color: theme.colors.brand,
    letterSpacing: 4,
  },
  hint: { fontSize: theme.font.size.xs, color: theme.colors.muted },
});
