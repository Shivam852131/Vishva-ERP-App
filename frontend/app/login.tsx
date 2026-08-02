import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Animated, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { BlurView } from '@/src/components/BlurView';
import { AppImage as Image } from '@/src/components/AppImage';
import { router } from '@/src/navigation/router';
import {
  LogIn, UserPlus, Sparkles,
  Mail, Lock, User, ChevronRight, Shield, Eye, EyeOff,
  BookOpen, Users, Building2, Crown, Smartphone, AlertCircle,
} from 'lucide-react-native';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/providers/AuthContext';
import type { UserRole } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { ViLogo } from '@/src/components/ViLogo';
import { LOGIN, REGISTER } from '@/constants/testIds';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

const DEMO: { role: UserRole; email: string; label: string; icon: React.ReactNode; color: string }[] = [
  { role: 'student', email: 'aarav@campus.edu', label: 'Student', icon: <BookOpen size={14} />, color: '#059669' },
  { role: 'faculty', email: 'meera@campus.edu', label: 'Faculty', icon: <Users size={14} />, color: '#3B82F6' },
  { role: 'parent', email: 'rohit@campus.edu', label: 'Parent', icon: <Users size={14} />, color: '#8B5CF6' },
  { role: 'college_admin', email: 'ananya@campus.edu', label: 'Admin', icon: <Building2 size={14} />, color: '#F59E0B' },
  { role: 'super_admin', email: 'vikram@campus.edu', label: 'Super', icon: <Crown size={14} />, color: '#EF4444' },
];

export default function Login() {
  const { user, login, register, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('aarav@campus.edu');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string; confirmPassword?: string }>({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const validate = useCallback((): boolean => {
    const errors: typeof fieldErrors = {};
    if (mode === 'register') {
      if (!name.trim()) errors.name = 'Name is required';
      else if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    }
    if (!email.trim()) errors.email = 'Email is required';
    else if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address';
    if (!password) errors.password = 'Password is required';
    else if (password.length < PASSWORD_MIN) errors.password = `Password must be at least ${PASSWORD_MIN} characters`;
    if (mode === 'register') {
      if (!confirmPassword) errors.confirmPassword = 'Please confirm your password';
      else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [mode, name, email, password, confirmPassword]);

  useEffect(() => {
    if (!authLoading && user) {
      const roleRouteMap: Record<string, string> = {
        student: '/(student)/dashboard',
        faculty: '/(faculty)/dashboard',
        college_admin: '/(college_admin)/dashboard',
        super_admin: '/(super_admin)/dashboard',
        parent: '/(parent)/dashboard',
      };
      router.replace((roleRouteMap[user.role] || '/login') as any);
    }
  }, [user, authLoading]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const submit = useCallback(async () => {
    if (!validate()) return;
    setLoading(true);
    setErr('');
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(name.trim(), email.trim(), password, role);
      }
    } catch (e: any) {
      setErr(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [mode, email, password, name, role, login, register, validate]);

  return (
    <ErrorBoundary>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: '#0A1612' }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero Section ── */}
          <View style={styles.hero}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1562774053-701939374585?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200' }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
            <LinearGradient
                colors={['rgba(79,70,229,0.35)', 'rgba(2,6,23,0.95)']}
                style={StyleSheet.absoluteFill}
              />
            <LinearGradient
              colors={['transparent', 'rgba(2,6,23,1)']}
              locations={[0.4, 1]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.heroContent}>
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }],
                  },
                ]}
              >
                <ViLogo size={72} animate={false} />
              </Animated.View>

              <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <Text style={styles.brandName}>Vishva ERP</Text>
                <Text style={styles.brandSub}>Smart Campus Platform</Text>
              </Animated.View>

              <Animated.Text
                style={[
                  styles.tagline,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                Smart Campus Management System
              </Animated.Text>

              <Animated.View
                style={[
                  styles.featurePills,
                  { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                ]}
              >
                {['AI-Powered', 'Real-time', 'Secure'].map((f) => (
                  <View key={f} style={styles.featurePill}>
                    <Sparkles size={10} color="#0EA5E9" />
                    <Text style={styles.featurePillText}>{f}</Text>
                  </View>
                ))}
              </Animated.View>
            </View>
          </View>

          {/* ── Login Card ── */}
          <View style={styles.cardSection}>
            <View style={styles.card}>
              {/* Mode Tabs */}
              <View style={styles.tabBar}>
                <Pressable
                  onPress={() => { setMode('login'); setErr(''); setFieldErrors({}); }}
                  style={[styles.tab, mode === 'login' && styles.tabActive]}
                  testID={LOGIN.registerLink}
                  accessibilityLabel="Sign In tab"
                >
                  <LogIn size={16} color={mode === 'login' ? '#fff' : '#64748B'} />
                  <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setMode('register'); setErr(''); setFieldErrors({}); }}
                  style={[styles.tab, mode === 'register' && styles.tabActive]}
                  testID={REGISTER.loginLink}
                  accessibilityLabel="Register tab"
                >
                  <UserPlus size={16} color={mode === 'register' ? '#fff' : '#64748B'} />
                  <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                    Register
                  </Text>
                </Pressable>
              </View>

              {/* Form Fields */}
              <View style={styles.form}>
                {mode === 'register' && (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Full Name</Text>
                      <View style={[styles.inputRow, fieldErrors.name && styles.inputRowError]}>
                        <User size={18} color={fieldErrors.name ? '#EF4444' : '#64748B'} style={styles.inputIcon} />
                        <TextInput
                          value={name}
                          onChangeText={(t) => { setName(t); if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined })); }}
                          placeholder="Enter your full name"
                          style={styles.input}
                          placeholderTextColor="#475569"
                          testID={REGISTER.nameInput}
                        />
                      </View>
                      {fieldErrors.name ? (
                        <View style={styles.fieldError}>
                          <AlertCircle size={12} color="#EF4444" />
                          <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Role</Text>
                      <View style={styles.roleGrid}>
                        {(['student', 'faculty', 'parent'] as UserRole[]).map((r) => (
                          <Pressable
                            key={r}
                            onPress={() => setRole(r)}
                            style={[styles.roleCard, role === r && styles.roleCardActive]}
                            testID={`role-${r}`}
                            accessibilityLabel={`Select role ${r}`}
                          >
                            <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                              {r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <View style={[styles.inputRow, fieldErrors.email && styles.inputRowError]}>
                    <Mail size={18} color={fieldErrors.email ? '#EF4444' : '#64748B'} style={styles.inputIcon} />
                    <TextInput
                      value={email}
                      onChangeText={(t) => { setEmail(t); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined })); }}
                      placeholder="you@campus.edu"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.input}
                      placeholderTextColor="#475569"
                      testID={mode === 'login' ? LOGIN.emailInput : REGISTER.emailInput}
                    />
                  </View>
                  {fieldErrors.email ? (
                    <View style={styles.fieldError}>
                      <AlertCircle size={12} color="#EF4444" />
                      <Text style={styles.fieldErrorText}>{fieldErrors.email}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <View style={[styles.inputRow, fieldErrors.password && styles.inputRowError]}>
                    <Lock size={18} color={fieldErrors.password ? '#EF4444' : '#64748B'} style={styles.inputIcon} />
                    <TextInput
                      value={password}
                      onChangeText={(t) => { setPassword(t); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined })); }}
                      placeholder={mode === 'login' ? 'Enter your password' : `Min ${PASSWORD_MIN} characters`}
                      secureTextEntry={!showPassword}
                      style={[styles.input, { flex: 1 }]}
                      placeholderTextColor="#475569"
                      testID={mode === 'login' ? LOGIN.passwordInput : REGISTER.passwordInput}
                    />
                    <Pressable
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color="#64748B" />
                      ) : (
                        <Eye size={18} color="#64748B" />
                      )}
                    </Pressable>
                  </View>
                  {fieldErrors.password ? (
                    <View style={styles.fieldError}>
                      <AlertCircle size={12} color="#EF4444" />
                      <Text style={styles.fieldErrorText}>{fieldErrors.password}</Text>
                    </View>
                  ) : null}
                </View>

                {mode === 'register' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Confirm Password</Text>
                    <View style={[styles.inputRow, fieldErrors.confirmPassword && styles.inputRowError]}>
                      <Lock size={18} color={fieldErrors.confirmPassword ? '#EF4444' : '#64748B'} style={styles.inputIcon} />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={(t) => { setConfirmPassword(t); if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }}
                        placeholder="Re-enter your password"
                        secureTextEntry={!showPassword}
                        style={[styles.input, { flex: 1 }]}
                        placeholderTextColor="#475569"
                        testID={REGISTER.passwordConfirmInput}
                      />
                    </View>
                    {fieldErrors.confirmPassword ? (
                      <View style={styles.fieldError}>
                        <AlertCircle size={12} color="#EF4444" />
                        <Text style={styles.fieldErrorText}>{fieldErrors.confirmPassword}</Text>
                      </View>
                    ) : null}
                  </View>
                )}

                {err ? (
                  <View style={styles.errorBox}>
                    <Shield size={14} color="#EF4444" />
                    <Text style={styles.errorText} testID="error-text">{err}</Text>
                  </View>
                ) : null}

                {/* Forgot Password (login only) */}
                {mode === 'login' && (
                  <Pressable
                    onPress={() => {}}
                    style={styles.forgotRow}
                    testID={LOGIN.forgotPasswordLink}
                    accessibilityLabel="Forgot password"
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                )}

                {/* Submit Button */}
                <Pressable
                  onPress={submit}
                  disabled={loading}
                  style={({ pressed }) => [
                    styles.submitBtn,
                    pressed && styles.submitBtnPressed,
                  ]}
                  testID={mode === 'login' ? LOGIN.submitButton : REGISTER.submitButton}
                  accessibilityLabel={mode === 'login' ? 'Sign In' : 'Create Account'}
                >
                  <LinearGradient
                    colors={loading ? ['#475569', '#64748B'] : ['#2563EB', '#0EA5E9', '#06B6D4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.submitGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Text style={styles.submitText}>
                          {mode === 'login' ? 'Sign In' : 'Create Account'}
                        </Text>
                        <ChevronRight size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </Pressable>

                {/* Phone OTP Sign-in */}
                {mode === 'login' && (
                  <Pressable
                    onPress={() => router.push('/phone-login')}
                    style={({ pressed }) => [styles.phoneBtn, pressed && styles.phoneBtnPressed]}
                    accessibilityLabel="Sign in with Phone Number"
                  >
                    <Smartphone size={18} color="#4F46E5" />
                    <Text style={styles.phoneBtnText}>Sign in with Phone & OTP</Text>
                  </Pressable>
                )}
              </View>

              {/* Demo Accounts */}
              {mode === 'login' && (
                <View style={styles.demoSection}>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>Quick Demo Access</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <View style={styles.demoGrid}>
                    {DEMO.map((d) => (
                      <Pressable
                        key={d.email}
                        style={({ pressed }) => [
                          styles.demoCard,
                          pressed && styles.demoCardPressed,
                        ]}
                        onPress={() => { setEmail(d.email); setPassword('password123'); }}
                        testID={`demo-${d.role}`}
                        accessibilityLabel={`Demo login as ${d.label}`}
                      >
                        <View style={[styles.demoIcon, { backgroundColor: d.color + '18' }]}>
                          {d.icon}
                        </View>
                        <Text style={styles.demoLabel}>{d.label}</Text>
                        <Text style={styles.demoEmail} numberOfLines={1}>
                          {d.email.split('@')[0]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.demoHint}>
                    All demo accounts use password: password123
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Powered by Vishva Technologies
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 380,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroContent: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
    alignItems: 'center',
  },
  logoContainer: {
    width: 72,
    height: 72,
    marginBottom: 20,
  },
  brandName: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  brandSub: {
    color: theme.colors.brandSecondary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: -4,
  },
  tagline: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  featurePills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(129,140,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  featurePillText: {
    color: theme.colors.brandSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  cardSection: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: -30,
  },
  card: {
    backgroundColor: theme.colors.dark.surfaceSecondary,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    ...theme.shadow.xl,
  },
  tabBar: {
    flexDirection: 'row',
    margin: theme.spacing.md,
    marginBottom: 0,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabActive: {
    backgroundColor: 'rgba(14,165,233,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
  },
  tabText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#0EA5E9',
  },
  form: {
    padding: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    gap: 4,
  },
  fieldGroup: {
    marginBottom: theme.spacing.md,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#F8FAFC',
  },
  inputRowError: {
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  fieldError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  fieldErrorText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 4,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  forgotText: {
    color: '#0EA5E9',
    fontSize: 13,
    fontWeight: '600',
  },
  roleGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  roleCard: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  },
  roleCardActive: {
    backgroundColor: 'rgba(14,165,233,0.15)',
    borderColor: 'rgba(14,165,233,0.4)',
  },
  roleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  roleTextActive: {
    color: '#0EA5E9',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    flex: 1,
  },
  submitBtn: {
    marginTop: theme.spacing.md,
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  phoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#4F46E530',
    backgroundColor: '#4F46E508',
  },
  phoneBtnPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  phoneBtnText: { color: '#4F46E5', fontSize: 14, fontWeight: '700' },
  demoSection: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoCard: {
    width: (SCREEN_WIDTH - 80) / 3 - 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  demoCardPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(14,165,233,0.3)',
  },
  demoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  demoEmail: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '500',
  },
  demoHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#475569',
    marginTop: theme.spacing.md,
  },
  footer: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
});
