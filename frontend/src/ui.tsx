import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated as RNAnimated, ActivityIndicator, TextInput } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { LinearGradient } from '@/src/components/LinearGradient';
import { BlurView } from '@/src/components/BlurView';
import { theme } from './theme';

// ─── Glass Card ───────────────────────────────────
export function GlassCard({ children, style, intensity = 30, tint = 'light' }: any) {
  return (
    <BlurView intensity={intensity} tint={tint} style={[glassStyles.card, style]}>
      {children}
    </BlurView>
  );
}

const glassStyles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

// ─── Gradient Button ──────────────────────────────
export function GradientButton({ onPress, label, icon, loading, disabled, colors, style }: any) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = () => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); };
  const onPressOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: !!loading }}
      >
        <LinearGradient
          colors={colors || [theme.colors.brandPrimary, theme.colors.brand, theme.colors.brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={gradBtnStyles.btn}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.onBrandPrimary} size="small" />
          ) : (
            <View style={gradBtnStyles.inner}>
              {icon}
              <Text style={gradBtnStyles.label}>{label}</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const gradBtnStyles = StyleSheet.create({
  btn: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center', ...theme.shadow.md },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: theme.colors.onBrandPrimary, fontWeight: '700', fontSize: 15 },
});

// ─── Button (generic, flat) ───────────────────────
// Use for plain actions; use GradientButton for the hero/primary-CTA look.
export function Button({ onPress, label, icon, loading, disabled, variant = 'primary', style, testID, accessibilityLabel }: any) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const onPressIn = () => { scale.value = withSpring(0.96, { damping: 15, stiffness: 300 }); };
  const onPressOut = () => { scale.value = withSpring(1, { damping: 15, stiffness: 300 }); };
  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ disabled: isDisabled, busy: !!loading }}
        style={[
          buttonStyles.base,
          buttonStyles[variant as 'primary' | 'secondary' | 'ghost'] || buttonStyles.primary,
          isDisabled && buttonStyles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? theme.colors.onBrandPrimary : theme.colors.brandPrimary}
            size="small"
          />
        ) : (
          <View style={buttonStyles.inner}>
            {icon}
            <Text style={buttonTextStyles[variant as 'primary' | 'secondary' | 'ghost'] || buttonTextStyles.primary}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const buttonStyles = StyleSheet.create({
  base: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primary: { backgroundColor: theme.colors.brandPrimary, ...theme.shadow.sm },
  secondary: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

const buttonTextStyles = StyleSheet.create({
  primary: { color: theme.colors.onBrandPrimary, fontWeight: '700', fontSize: 15 },
  secondary: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 15 },
  ghost: { color: theme.colors.brandPrimary, fontWeight: '700', fontSize: 15 },
});

// ─── Input (generic text field) ───────────────────
export function Input({ label, error, style, containerStyle, ...textInputProps }: any) {
  return (
    <View style={[inputStyles.container, containerStyle]}>
      {label ? <Text style={inputStyles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={label}
        style={[inputStyles.input, error && inputStyles.inputError, style]}
        {...textInputProps}
      />
      {error ? <Text style={inputStyles.error}>{error}</Text> : null}
    </View>
  );
}

const inputStyles = StyleSheet.create({
  container: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.onSurface,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  inputError: { borderColor: theme.colors.error },
  error: { fontSize: 12, color: theme.colors.error },
});

// ─── Skeleton Loading ──────────────────────────────
export function Skeleton({ width: w, height: h, radius = theme.radius.md, style }: any) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.7, { duration: 800 }), withTiming(0.3, { duration: 800 })),
      -1,
    );
  }, [opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width: w || '100%', height: h || 20, borderRadius: radius, backgroundColor: theme.colors.surfaceTertiary }, animatedStyle, style]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Skeleton height={160} radius={theme.radius.xl} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton height={80} width="48%" radius={theme.radius.lg} />
        <Skeleton height={80} width="48%" radius={theme.radius.lg} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton height={80} width="48%" radius={theme.radius.lg} />
        <Skeleton height={80} width="48%" radius={theme.radius.lg} />
      </View>
      <Skeleton height={60} radius={theme.radius.lg} />
      <Skeleton height={60} radius={theme.radius.lg} />
      <Skeleton height={60} radius={theme.radius.lg} />
    </View>
  );
}

// ─── Progress Ring (circular) ────────────────────
export function ProgressRing({ percentage = 0, size = 80, strokeWidth = 6, color, label, sub }: any) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const fill = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (fill / 100) * circumference;
  const bgColor = color || (fill >= 75 ? theme.colors.success : fill >= 50 ? theme.colors.warning : theme.colors.error);

  return (
    <View style={{ alignItems: 'center', width: size + 20 }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[ringStyles.bg, { width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary }]} />
        <View style={[ringStyles.fill, {
          width: size, height: size, borderRadius: size / 2,
          borderWidth: strokeWidth, borderColor: bgColor,
          borderLeftColor: 'transparent', borderBottomColor: 'transparent',
          transform: [{ rotate: `${(fill / 100) * 360}deg` }],
        }]} />
        <View style={ringStyles.center}>
          <Text style={[ringStyles.val, { color: bgColor }]}>{fill}%</Text>
        </View>
      </View>
      {label && <Text style={ringStyles.label}>{label}</Text>}
      {sub && <Text style={ringStyles.sub}>{sub}</Text>}
    </View>
  );
}

const ringStyles = StyleSheet.create({
  bg: { position: 'absolute' },
  fill: { position: 'absolute', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  val: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 12, color: theme.colors.muted, marginTop: 6, fontWeight: '600' },
  sub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
});

// ─── Progress Bar ──────────────────────────────────
export function ProgressBar({ value, max = 100, height = 8, color, bg, label, showPct = false, style }: any) {
  // max can be 0 (an assessment with no questions), which makes value/max NaN and
  // renders width: "NaN%". Guard the divisor and the numerator.
  const ratio = max > 0 ? Number(value) / max : 0;
  const pct = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const barColor = color || (pct >= 0.75 ? theme.colors.success : pct >= 0.5 ? theme.colors.warning : theme.colors.error);

  return (
    <View style={[{ gap: 6 }, style]}>
      {(label || showPct) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {label && <Text style={{ fontSize: 12, color: theme.colors.muted, fontWeight: '600' }}>{label}</Text>}
          {showPct && <Text style={{ fontSize: 12, color: barColor, fontWeight: '700' }}>{Math.round(pct * 100)}%</Text>}
        </View>
      )}
      <View style={[barStyles.bg, { height, backgroundColor: bg || theme.colors.surfaceTertiary, borderRadius: theme.radius.sm }]}>
        <RNAnimated.View style={[barStyles.fill, { width: `${pct * 100}%`, height, backgroundColor: barColor, borderRadius: theme.radius.sm }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  bg: { overflow: 'hidden' },
  fill: { },
});

// ─── Stat Card (enhanced) ──────────────────────────
export function StatCard({ label, value, sub, color = theme.colors.brandPrimary, icon, trend, testID }: any) {
  return (
    <View testID={testID} style={[statStyles.card]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={statStyles.label} numberOfLines={1}>{label}</Text>
          <Text style={[statStyles.value, { color: color || theme.colors.brandPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
          {sub ? <Text style={statStyles.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {icon && <View style={[statStyles.iconWrap, { backgroundColor: (color || theme.colors.brandPrimary) + '12' }]}>{icon}</View>}
      </View>
      {trend !== undefined && (
        <View style={[statStyles.trend, { backgroundColor: trend >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
          <Text style={{ color: trend >= 0 ? theme.colors.success : theme.colors.error, fontSize: 11, fontWeight: '700' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.lg, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm },
  label: { color: theme.colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  iconWrap: { width: 44, height: 44, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center' },
  trend: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, marginTop: 8 },
});

// ─── Empty State ──────────────────────────────────
export function EmptyState({ title, sub, icon }: any) {
  const iconNode = React.isValidElement(icon) ? (
    <View style={{ marginBottom: 16 }}>{icon}</View>
  ) : (
    <Text style={{ fontSize: 56, marginBottom: 16 }}>{icon || '📭'}</Text>
  );

  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      {iconNode}
      <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.onSurface }}>{title}</Text>
      {sub ? <Text style={{ color: theme.colors.muted, marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>{sub}</Text> : null}
    </View>
  );
}

// ─── Async View ────────────────────────────────────
// Canonical loading -> error -> empty -> content sequence for screens backed by
// useFetch. Pass useFetch's {loading, error, refresh} straight through as
// {loading, error, onRetry}, plus `empty` computed from the fetched data.
export function AsyncView({ loading, error, empty, onRetry, emptyTitle, emptySub, emptyIcon, children }: any) {
  if (loading) {
    return (
      <View style={asyncViewStyles.center}>
        <ActivityIndicator color={theme.colors.brandPrimary} size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={asyncViewStyles.center}>
        <Text style={asyncViewStyles.errorText}>{error}</Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={asyncViewStyles.retryBtn}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={asyncViewStyles.retryLabel}>Retry</Text>
          </Pressable>
        )}
      </View>
    );
  }
  if (empty) {
    return <EmptyState title={emptyTitle || 'Nothing here yet'} sub={emptySub} icon={emptyIcon} />;
  }
  return children;
}

const asyncViewStyles = StyleSheet.create({
  center: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 16 },
  errorText: { color: theme.colors.error, fontSize: 14, textAlign: 'center', fontWeight: '600' },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandPrimary, ...theme.shadow.sm },
  retryLabel: { color: theme.colors.onBrandPrimary, fontWeight: '700', fontSize: 14 },
});

// ─── Chip Button ──────────────────────────────────
export function ChipBtn({ label, active, onPress, testID, icon }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[chipStyles.chip, active && chipStyles.active]}>
      {icon}
      <Text style={[chipStyles.txt, active && chipStyles.txtActive]}>{label}</Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: 16, height: 38, justifyContent: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  active: { backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brandPrimary },
  txt: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600' },
  txtActive: { color: theme.colors.onBrandTertiary },
});

// ─── Card ─────────────────────────────────────────
export function Card({ children, style, onPress }: any) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[cardStyles.card, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[cardStyles.card, style]}>{children}</View>;
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm },
});

// ─── Section Title ────────────────────────────────
// Accepts either <SectionTitle title="X" /> or <SectionTitle>X</SectionTitle>;
// both spellings are used widely across the app.
export function SectionTitle({ title, action, actionLabel, onPress, children }: any) {
  const handler = typeof action === 'function' ? action : onPress;
  const showAction = !!handler || !!actionLabel;
  const label = title ?? children;

  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.title} numberOfLines={1}>{label}</Text>
      {showAction && (
        <Pressable onPress={handler} disabled={!handler}>
          <Text style={sectionStyles.action}>{actionLabel || 'See all'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: theme.colors.onSurface },
  action: { color: theme.colors.brandPrimary, fontWeight: '600', fontSize: 14 },
});

// ─── Metric Row ──────────────────────────────────
export function MetricRow({ items }: any) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md }}>
      {items.map((item: any, i: number) => (
        <StatCard key={i} {...item} />
      ))}
    </View>
  );
}

// ─── Glass Sheet (Bottom sheet style) ────────────
export function GlassSheet({ visible, children, onClose }: any) {
  if (!visible) return null;
  return (
    <View style={sheetStyles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <BlurView intensity={40} tint="dark" style={sheetStyles.sheet}>
        {children}
      </BlurView>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 1000 },
  sheet: { borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing.xxl, paddingBottom: 40, overflow: 'hidden' },
});

// ─── Badge ────────────────────────────────────────
export function Badge({ count, color }: any) {
  if (!count || count === 0) return null;
  const label = typeof count === 'number' && count > 99 ? '99+' : String(count);
  return (
    <View style={[badgeStyles.dot, { backgroundColor: color || theme.colors.warning }]}>
      <Text style={badgeStyles.txt}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  dot: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, ...theme.shadow.sm },
  txt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
