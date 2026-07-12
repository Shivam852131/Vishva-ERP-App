import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppImage as Image } from '@/src/components/AppImage';
import { LinearGradient } from '@/src/components/LinearGradient';
import { BlurView } from '@/src/components/BlurView';
import { Sparkles, MessageCircle, CalendarCheck, BellRing, BarChart3, TrendingUp } from 'lucide-react-native';
import { theme, bg } from '@/src/theme';
import ChatTab from '@/src/screens/ai/ChatTab';
import PlannerTab from '@/src/screens/ai/PlannerTab';
import GradeAnalyzer from '@/src/screens/ai/GradeAnalyzer';
import AttendancePredictor from '@/src/screens/ai/AttendancePredictor';
import RemindersTab from '@/src/screens/ai/RemindersTab';
import { ErrorBoundary } from '@/src/ErrorBoundary';

const TABS = [
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'planner', label: 'Planner', icon: CalendarCheck },
  { key: 'grades', label: 'Grades', icon: BarChart3 },
  { key: 'attendance', label: 'Attendance', icon: TrendingUp },
  { key: 'reminders', label: 'Reminders', icon: BellRing },
];

export default function AIHub() {
  const [tab, setTab] = useState('chat');
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
      >
        <View style={styles.hero}>
          <Image source={{ uri: bg.ai }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient
            colors={['rgba(10,15,13,0.4)', 'rgba(10,15,13,0.92)']}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView
            edges={['top']}
            style={{
              paddingHorizontal: theme.spacing.lg,
              flex: 1,
              justifyContent: 'flex-end',
              paddingBottom: theme.spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Animated.View
                style={[
                  styles.aiIcon,
                  { opacity: Animated.add(0.7, Animated.multiply(glowAnim, 0.3)) },
                ]}
              >
                <Sparkles size={22} color={theme.colors.brandSecondary} />
              </Animated.View>
              <View>
                <BlurView
                  intensity={20}
                  tint="dark"
                  style={{
                    borderRadius: theme.radius.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    overflow: 'hidden',
                  }}
                >
                  <Text style={styles.title}>CampusAI</Text>
                </BlurView>
                <Text style={styles.sub}>Doubts · Planners · Grades · Attendance · Reminders</Text>
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.tabs}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                testID={`tab-${t.key}`}
                accessibilityLabel={t.label}
                onPress={() => setTab(t.key)}
                style={[styles.tabBtn, active && styles.tabActive]}
              >
                <Icon color={active ? '#fff' : theme.colors.muted} size={13} />
                <Text style={[styles.tabTxt, active && { color: '#fff' }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          {tab === 'chat' && <ChatTab />}
          {tab === 'planner' && <PlannerTab />}
          {tab === 'grades' && <GradeAnalyzer />}
          {tab === 'attendance' && <AttendancePredictor />}
          {tab === 'reminders' && <RemindersTab />}
        </View>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { height: 160, overflow: 'hidden' },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 11, marginTop: 4 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: theme.radius.pill,
    padding: 3,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadow.sm,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    gap: 3,
  },
  tabActive: { backgroundColor: theme.colors.brand, ...theme.shadow.md },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 10.5 },
});
