import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wifi, WifiOff, Loader } from 'lucide-react-native';
import { theme } from '@/src/theme';

const STATUS_CONFIG = {
  connected: { color: theme.colors.success, bg: '#ECFDF5', label: 'Connected' },
  connecting: { color: theme.colors.warning, bg: '#FFFBEB', label: 'Connecting...' },
  disconnected: { color: theme.colors.error, bg: '#FEF2F2', label: 'Disconnected' },
  waiting: { color: theme.colors.muted, bg: theme.colors.surfaceTertiary, label: 'Waiting...' },
  new: { color: theme.colors.muted, bg: theme.colors.surfaceTertiary, label: 'Initializing...' },
};

export function ConnectionStatus({ state = 'waiting', compact = false }) {
  const config = STATUS_CONFIG[state] || STATUS_CONFIG.waiting;

  if (compact) {
    return (
      <View style={[styles.dot, { backgroundColor: config.color }]} />
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      {state === 'connected' ? (
        <Wifi size={14} color={config.color} />
      ) : state === 'disconnected' ? (
        <WifiOff size={14} color={config.color} />
      ) : (
        <Loader size={14} color={config.color} />
      )}
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    gap: 4,
  },
  label: {
    fontSize: theme.font.size.xs,
    fontWeight: theme.font.weight.semibold,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
