import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Briefcase } from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { EmptyState } from '@/src/ui';

export default function Placement() {
  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Placement Portal</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.content}>
          <EmptyState
            title="Placement Portal - Coming Soon"
            sub="Placement drives, company visits, and career opportunities will be available here."
          />
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
});
