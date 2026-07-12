import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ActivityIndicator } from 'react-native';
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
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

// ─── Gradient Button ──────────────────────────────
export function GradientButton({ onPress, label, icon, loading, disabled, colors, style }: any) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={disabled || loading}
      >
        <LinearGradient
          colors={colors || [theme.colors.brandPrimary, theme.colors.brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={gradBtnStyles.btn}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
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
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: theme.radius.pill, alignItems: 'center', justifyContent: 'center' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Skeleton Loading ──────────────────────────────
export function Skeleton({ width: w, height: h, radius = theme.radius.md, style }: any) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[{ width: w || '100%', height: h || 20, borderRadius: radius, backgroundColor: theme.colors.surfaceTertiary, opacity }, style]}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      <Skeleton height={160} radius={theme.radius.lg} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton height={80} width="48%" radius={theme.radius.md} />
        <Skeleton height={80} width="48%" radius={theme.radius.md} />
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Skeleton height={80} width="48%" radius={theme.radius.md} />
        <Skeleton height={80} width="48%" radius={theme.radius.md} />
      </View>
      <Skeleton height={60} radius={theme.radius.md} />
      <Skeleton height={60} radius={theme.radius.md} />
      <Skeleton height={60} radius={theme.radius.md} />
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
  val: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 11, color: theme.colors.muted, marginTop: 4, fontWeight: '600' },
  sub: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
});

// ─── Progress Bar ──────────────────────────────────
export function ProgressBar({ value, max = 100, height = 8, color, bg, label, showPct = false }: any) {
  const pct = Math.min(1, Math.max(0, value / max));
  const barColor = color || (pct >= 0.75 ? theme.colors.success : pct >= 0.5 ? theme.colors.warning : theme.colors.error);

  return (
    <View style={{ gap: 4 }}>
      {(label || showPct) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {label && <Text style={{ fontSize: 11, color: theme.colors.muted, fontWeight: '600' }}>{label}</Text>}
          {showPct && <Text style={{ fontSize: 11, color: barColor, fontWeight: '700' }}>{Math.round(pct * 100)}%</Text>}
        </View>
      )}
      <View style={[barStyles.bg, { height, backgroundColor: bg || theme.colors.surfaceTertiary }]}>
        <Animated.View style={[barStyles.fill, { width: `${pct * 100}%`, height, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  bg: { borderRadius: 4, overflow: 'hidden' },
  fill: { borderRadius: 4 },
});

// ─── Stat Card (enhanced) ──────────────────────────
export function StatCard({ label, value, sub, color = theme.colors.brandPrimary, icon, trend, testID }: any) {
  return (
    <View testID={testID} style={[statStyles.card, { borderLeftColor: color || theme.colors.brandPrimary }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={statStyles.label}>{label}</Text>
          <Text style={[statStyles.value, { color: color || theme.colors.brandPrimary }]}>{value}</Text>
          {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
        </View>
        {icon && <View style={[statStyles.iconWrap, { backgroundColor: (color || theme.colors.brandPrimary) + '18' }]}>{icon}</View>}
      </View>
      {trend !== undefined && (
        <View style={[statStyles.trend, { backgroundColor: trend >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
          <Text style={{ color: trend >= 0 ? theme.colors.brand : theme.colors.error, fontSize: 10, fontWeight: '700' }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderLeftWidth: 4, borderColor: theme.colors.border, borderWidth: 1, ...theme.shadow.sm },
  label: { color: theme.colors.muted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 24, fontWeight: '800', marginTop: 4 },
  sub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  trend: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 6 },
});

// ─── Empty State ──────────────────────────────────
export function EmptyState({ title, sub, icon }: any) {
  const iconNode = React.isValidElement(icon) ? (
    <View style={{ marginBottom: 12 }}>{icon}</View>
  ) : (
    <Text style={{ fontSize: 48, marginBottom: 12 }}>{icon || '📭'}</Text>
  );

  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      {iconNode}
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.onSurface }}>{title}</Text>
      {sub ? <Text style={{ color: theme.colors.muted, marginTop: 6, textAlign: 'center', fontSize: 13, lineHeight: 19 }}>{sub}</Text> : null}
    </View>
  );
}

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
  chip: { paddingHorizontal: 16, height: 36, justifyContent: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  active: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  txt: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600' },
  txtActive: { color: '#fff' },
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
export function SectionTitle({ title, action, actionLabel, onPress }: any) {
  const handler = typeof action === 'function' ? action : onPress;
  const showAction = !!handler || !!actionLabel;

  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.title}>{title}</Text>
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
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  action: { color: theme.colors.brandPrimary, fontWeight: '600', fontSize: 13 },
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
  sheet: { borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: theme.spacing.xl, paddingBottom: 40, overflow: 'hidden' },
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
  dot: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  txt: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
