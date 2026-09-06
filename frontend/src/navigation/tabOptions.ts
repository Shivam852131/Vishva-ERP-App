import { Platform } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { theme } from '../theme';

export function getResponsiveTabOptions(
  insets?: EdgeInsets | number | { bottom?: number },
  options?: { isCompact?: boolean }
) {
  const bottomInset = typeof insets === 'number' ? insets : (insets?.bottom ?? 0);
  const isCompact = options?.isCompact ?? false;
  return {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.brand,
    tabBarInactiveTintColor: theme.colors.muted,
    tabBarHideOnKeyboard: true,
    tabBarStyle: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderTopColor: theme.colors.border,
      borderTopWidth: 1,
      height: 56 + bottomInset,
      paddingBottom: Math.max(bottomInset, 6),
      paddingTop: 6,
      ...theme.shadow.md,
    },
    tabBarItemStyle: isCompact ? { paddingHorizontal: 1 } : undefined,
    tabBarLabelStyle: {
      fontSize: isCompact ? 9 : 11,
      fontWeight: '700' as const,
      marginTop: -2,
      maxFontSizeMultiplier: isCompact ? 1.15 : 1.2,
    },
  };
}
