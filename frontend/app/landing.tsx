import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  Dimensions, StatusBar, ScrollView,
} from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  GraduationCap, BookOpen, Users, Shield, Sparkles,
  ChevronRight, BarChart3, Calendar, Bell, Wifi,
  Brain, CreditCard, ClipboardCheck,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ViLogo } from '@/src/components/ViLogo';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ONBOARDING_KEY = 'vishva_onboarding_done';

// ─── Floating Particle ──────────────────────────
function Particle({ delay, x, size, color }: { delay: number; x: number; size: number; color: string }) {
  const yAnim = useRef(new Animated.Value(SCREEN_HEIGHT + 50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.loop(
        Animated.parallel([
          Animated.timing(yAnim, {
            toValue: -50,
            duration: 8000 + Math.random() * 4000,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacityAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
            Animated.delay(4000 + Math.random() * 2000),
            Animated.timing(opacityAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
          ]),
        ]),
      ).start();
    }, delay);
  }, []);

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: x,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: opacityAnim,
          transform: [{ translateY: yAnim }],
        },
      ]}
    />
  );
}

// ─── Feature Card ───────────────────────────────
function FeatureItem({
  icon, title, subtitle, delay, visible,
}: { icon: React.ReactNode; title: string; subtitle: string; delay: number; visible: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[
        styles.featureItem,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.featureIcon}>{icon}</View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
    </Animated.View>
  );
}

// ─── Main Landing Screen ────────────────────────
export default function LandingScreen() {
  const [showContent, setShowContent] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Animations
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleSlide = useRef(new Animated.Value(40)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleSlide = useRef(new Animated.Value(30)).current;
  const featuresOpacity = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonSlide = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  // Particles
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 5000,
      color: ['rgba(14,165,233,0.4)', 'rgba(16,185,129,0.4)', 'rgba(99,102,241,0.3)', 'rgba(236,72,153,0.3)'][i % 4],
    })),
  ).current;

  // Features data
  const features = [
    { icon: <Brain size={20} color="#0EA5E9" />, title: 'AI-Powered Learning', subtitle: 'Smart study plans & doubt solving' },
    { icon: <ClipboardCheck size={20} color="#10B981" />, title: 'Smart Attendance', subtitle: 'QR, GPS, Face ID & Auto check-in' },
    { icon: <BarChart3 size={20} color="#8B5CF6" />, title: 'Performance Analytics', subtitle: 'Track grades, attendance & more' },
    { icon: <CreditCard size={20} color="#F59E0B" />, title: 'Digital ID Card', subtitle: 'QR-verified campus identity' },
    { icon: <Bell size={20} color="#EF4444" />, title: 'Smart Notifications', subtitle: 'AI reminders & alerts' },
    { icon: <Shield size={20} color="#06B6D4" />, title: 'Secure Platform', subtitle: 'Enterprise-grade security' },
  ];

  useEffect(() => {
    // Start entrance animations sequence
    Animated.sequence([
      // Logo entrance
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 30, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
      // Title entrance
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(titleSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      ]),
      // Subtitle
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(subtitleSlide, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      ]),
      // Features
      Animated.timing(featuresOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      // Button
      Animated.parallel([
        Animated.timing(buttonOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(buttonSlide, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
      ]),
    ]).start(() => setShowContent(true));

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
    ).start();

    // Dot animation
    Animated.loop(
      Animated.timing(dotAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
    ).start();
  }, []);

  const handleGetStarted = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    router.replace('/login');
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {}
    router.replace('/login');
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#020617', '#0A0F1E', '#0F172A', '#0A0F1E']}
        style={StyleSheet.absoluteFill}
      />

      {/* Background particles */}
      {particles.map((p) => (
        <Particle key={p.id} x={p.x} size={p.size} delay={p.delay} color={p.color} />
      ))}

      {/* Background radial glow */}
      <View style={styles.bgGlow1} />
      <View style={styles.bgGlow2} />
      <View style={styles.bgGlow3} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Skip button */}
        <Pressable
          testID="landing-skip"
          accessibilityLabel="Skip to login"
          style={styles.skipBtn}
          onPress={handleSkip}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>

        {/* Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [
                { scale: Animated.multiply(logoScale, pulseAnim) },
              ],
            },
          ]}
        >
          <ViLogo size={140} animate={false} />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={[
            styles.titleContainer,
            { opacity: titleOpacity, transform: [{ translateY: titleSlide }] },
          ]}
        >
          <Text style={styles.appName}>Vishva ERP</Text>
          <View style={styles.titleUnderline} />
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          style={[
            styles.subtitleContainer,
            { opacity: subtitleOpacity, transform: [{ translateY: subtitleSlide }] },
          ]}
        >
          <Text style={styles.subtitle}>Smart Campus Management System</Text>
          <Text style={styles.description}>
            AI-powered academic platform for students, faculty, and administrators
          </Text>
        </Animated.View>

        {/* Feature pills */}
        <Animated.View style={[styles.pillRow, { opacity: subtitleOpacity }]}>
          {['AI-Powered', 'Real-time', 'Secure', 'Smart'].map((f, i) => (
            <View key={f} style={styles.pill}>
              <Sparkles size={10} color="#0EA5E9" />
              <Text style={styles.pillText}>{f}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Features list */}
        <Animated.View style={[styles.featuresContainer, { opacity: featuresOpacity }]}>
          <Text style={styles.featuresSectionTitle}>Why Vishva ERP?</Text>
          {features.map((f, i) => (
            <FeatureItem
              key={i}
              icon={f.icon}
              title={f.title}
              subtitle={f.subtitle}
              delay={i * 200}
              visible={showContent}
            />
          ))}
        </Animated.View>

        {/* Stats row */}
        <Animated.View style={[styles.statsRow, { opacity: featuresOpacity }]}>
          {[
            { value: '50K+', label: 'Students' },
            { value: '500+', label: 'Faculty' },
            { value: '100+', label: 'Colleges' },
            { value: '99.9%', label: 'Uptime' },
          ].map((s, i) => (
            <View key={i} style={styles.statItem}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* CTA Button */}
        <Animated.View
          style={[
            styles.ctaContainer,
            { opacity: buttonOpacity, transform: [{ translateY: buttonSlide }] },
          ]}
        >
          <Pressable
            testID="landing-get-started"
            accessibilityLabel="Get started with Vishva ERP"
            style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
            onPress={handleGetStarted}
          >
            <LinearGradient
              colors={['#2563EB', '#0EA5E9', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaText}>Get Started</Text>
              <ChevronRight size={20} color="#fff" />
            </LinearGradient>
          </Pressable>

          {/* Animated dots indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  i === 0 && {
                    width: 24,
                    backgroundColor: dotAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: ['#2563EB', '#0EA5E9', '#2563EB'],
                    }),
                  },
                ]}
              />
            ))}
          </View>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <Wifi size={12} color="rgba(255,255,255,0.2)" />
            <Text style={styles.footerText}>Connected Campus Experience</Text>
          </View>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  // Background effects
  bgGlow1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(14,165,233,0.08)',
    top: -50,
    right: -80,
  },
  bgGlow2: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(16,185,129,0.06)',
    bottom: 100,
    left: -60,
  },
  bgGlow3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99,102,241,0.05)',
    top: SCREEN_HEIGHT * 0.4,
    right: -40,
  },

  // Particles
  particle: {
    position: 'absolute',
  },

  // Skip button
  skipBtn: {
    alignSelf: 'flex-end',
    marginTop: 50,
    marginRight: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  skipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 24,
  },

  // Title
  titleContainer: { alignItems: 'center', marginBottom: 12 },
  appName: {
    color: '#fff',
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  titleUnderline: {
    width: 60,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0EA5E9',
    marginTop: 8,
  },

  // Subtitle
  subtitleContainer: { alignItems: 'center', paddingHorizontal: 32, marginBottom: 20 },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Feature pills
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 32,
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(14,165,233,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.15)',
  },
  pillText: { color: '#0EA5E9', fontSize: 11, fontWeight: '700' },

  // Features
  featuresContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  featuresSectionTitle: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
    marginLeft: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  featureSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 32,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statItem: { alignItems: 'center' },
  statValue: { color: '#0EA5E9', fontSize: 20, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: '600', marginTop: 2 },

  // CTA
  ctaContainer: { paddingHorizontal: 24, alignItems: 'center', marginBottom: 24 },
  ctaBtn: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 16,
    gap: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: { color: 'rgba(255,255,255,0.2)', fontSize: 11, fontWeight: '500' },
  footerVersion: { color: 'rgba(255,255,255,0.1)', fontSize: 10 },
});
