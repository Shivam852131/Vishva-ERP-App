import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { AppImage as Image } from '@/src/components/AppImage';
import { router } from '@/src/navigation/router';
import {
  Smartphone, Shield, Check, ChevronRight, ArrowLeft,
  RefreshCw, Lock, KeyRound, Fingerprint, Eye, EyeOff,
  Phone, MessageSquare, Clock, AlertCircle,
} from 'lucide-react-native';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/providers/AuthContext';
import { api } from '@/src/api';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { ViLogo } from '@/src/components/ViLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Step = 'phone' | 'otp' | 'role' | 'success';

const COUNTRY_CODE = '+91';

export default function PhoneOTPLogin() {
  const { login, register, user } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'student' | 'faculty' | 'parent'>('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const otpAnimRefs = useRef(Array(6).fill(null).map(() => new Animated.Value(0))).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
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

  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(t);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (!user) return;
    const roleRouteMap: Record<string, string> = {
      student: '/(student)/dashboard',
      faculty: '/(faculty)/dashboard',
      college_admin: '/(college_admin)/dashboard',
      super_admin: '/(super_admin)/dashboard',
      parent: '/(parent)/dashboard',
    };
    router.replace((roleRouteMap[user.role] || '/login') as any);
  }, [user]);

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) });
      setLoading(false);
      setOtpSent(true);
      setResendTimer(30);
      setCanResend(false);
      setStep('otp');
      otpAnimRefs.forEach((anim, i) => {
        Animated.spring(anim, { toValue: 1, delay: i * 80, tension: 50, friction: 8, useNativeDriver: true }).start();
      });
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp: otpString }),
      });
      setLoading(false);
      setStep('success');
      Animated.spring(successAnim, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }).start();
      setTimeout(() => {
        if (result?.token && result?.user) {
          import('@/src/api').then(({ setAuth }) => setAuth(result.token, result.user));
        }
      }, 1500);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Verification failed. Please try again.');
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setResendTimer(30);
    setCanResend(false);
    setError('');
    try {
      await api('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) });
      setOtpSent(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to resend OTP.');
    }
  };

  const handleOTPChange = (text: string, index: number) => {
    if (text.length > 1) text = text.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    setError('');
    // Auto-focus next
    if (text && index < 5) {
      // Focus next input would go here
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      // Focus previous
    }
  };

  const maskedPhone = phone ? `${COUNTRY_CODE} ${phone.slice(0, 2)}****${phone.slice(-2)}` : '';

  if (step === 'success') {
    return (
      <ErrorBoundary>
        <StatusBar barStyle="light-content" />
        <View style={[styles.container, { backgroundColor: '#0A1612' }]}>
          <View style={styles.hero}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1562774053-701939374585?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200' }}
              style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(16,185,129,0.35)', 'rgba(2,6,23,0.95)']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', 'rgba(2,6,23,1)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />

            <View style={styles.successContent}>
              <Animated.View style={[styles.successCircle, { transform: [{ scale: successAnim }] }]}>
                <Check size={48} color="#fff" />
              </Animated.View>
              <Animated.Text style={[styles.successTitle, { opacity: successAnim }]}>Verified!</Animated.Text>
              <Animated.Text style={[styles.successSub, { opacity: successAnim }]}>Phone number verified successfully</Animated.Text>
              <Animated.View style={[styles.loadingDots, { opacity: successAnim }]}>
                <View style={styles.loadingDot} />
                <View style={[styles.loadingDot, { opacity: 0.6 }]} />
                <View style={[styles.loadingDot, { opacity: 0.3 }]} />
              </Animated.View>
            </View>
          </View>
        </View>
      </ErrorBoundary>
    );
  }

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
          {/* Hero */}
          <View style={styles.hero}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1562774053-701939374585?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200' }}
              style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient colors={['rgba(79,70,229,0.35)', 'rgba(2,6,23,0.95)']} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['transparent', 'rgba(2,6,23,1)']} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />

            <View style={styles.heroContent}>
              <Animated.View style={[styles.logoContainer, {
                opacity: fadeAnim,
                transform: [{ scale: Animated.multiply(logoScale, pulseAnim) }],
              }]}>
                <ViLogo size={72} animate={false} />
              </Animated.View>
              <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <Text style={styles.brandName}>Vishva ERP</Text>
                <Text style={styles.brandSub}>Smart Campus Platform</Text>
              </Animated.View>
            </View>
          </View>

          {/* Card */}
          <View style={styles.cardSection}>
            <View style={styles.card}>
              {/* Step Indicator */}
              <View style={styles.stepIndicator}>
                {['phone', 'otp', 'role'].map((s, i) => (
                  <View key={s} style={styles.stepRow}>
                    <View style={[styles.stepDot, (step === 'phone' && i === 0) || (step === 'otp' && i <= 1) || (step === 'role' && i <= 2) ? styles.stepDotActive : styles.stepDotInactive]}>
                      {((step === 'otp' && i === 0) || (step === 'role' && i <= 1) || step === 'success') ?
                        <Check size={10} color="#fff" /> :
                        <Text style={styles.stepNumber}>{i + 1}</Text>}
                    </View>
                    {i < 2 && <View style={[styles.stepLine, (step === 'otp' && i === 0) || step === 'role' ? styles.stepLineActive : styles.stepLineInactive]} />}
                  </View>
                ))}
              </View>

              {step === 'phone' && (
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                  <View style={styles.stepHeader}>
                    <View style={styles.stepIconWrap}>
                      <Smartphone size={24} color="#4F46E5" />
                    </View>
                    <Text style={styles.stepTitle}>Sign in with Phone</Text>
                    <Text style={styles.stepSub}>Enter your registered phone number to receive a one-time password</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Phone Number</Text>
                    <View style={styles.phoneInputRow}>
                      <View style={styles.countryCode}>
                        <Text style={styles.countryFlag}>🇮🇳</Text>
                        <Text style={styles.countryCodeText}>{COUNTRY_CODE}</Text>
                      </View>
                      <TextInput
                        value={phone}
                        onChangeText={(t) => { setPhone(t.replace(/[^0-9]/g, '').slice(0, 10)); setError(''); }}
                        placeholder="Enter 10-digit number"
                        keyboardType="phone-pad"
                        maxLength={10}
                        style={styles.phoneInput}
                        placeholderTextColor="#475569"
                      />
                    </View>
                    {phone.length > 0 && phone.length < 10 && (
                      <View style={styles.phoneHint}>
                        <AlertCircle size={12} color="#F59E0B" />
                        <Text style={styles.phoneHintText}>{10 - phone.length} more digits needed</Text>
                      </View>
                    )}
                  </View>

                  {error ? (
                    <View style={styles.errorBox}>
                      <AlertCircle size={14} color="#EF4444" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <Pressable onPress={handleSendOTP} disabled={loading || phone.length < 10}
                    style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed, phone.length < 10 && styles.submitBtnDisabled]}>
                    <LinearGradient
                      colors={loading ? ['#475569', '#64748B'] : ['#2563EB', '#0EA5E9', '#06B6D4']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}>
                      {loading ? (
                        <View style={styles.loadingDots}><View style={styles.loadingDot} /><View style={[styles.loadingDot, { opacity: 0.6 }]} /><View style={[styles.loadingDot, { opacity: 0.3 }]} /></View>
                      ) : (
                        <>
                          <MessageSquare size={18} color="#fff" />
                          <Text style={styles.submitText}>Send OTP</Text>
                          <ChevronRight size={18} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>

                  <View style={styles.securityNote}>
                    <Shield size={14} color="#10B981" />
                    <Text style={styles.securityText}>Your phone number is secure and encrypted. We never share it with third parties.</Text>
                  </View>
                </Animated.View>
              )}

              {step === 'otp' && (
                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                  <View style={styles.stepHeader}>
                    <View style={styles.stepIconWrap}>
                      <KeyRound size={24} color="#4F46E5" />
                    </View>
                    <Text style={styles.stepTitle}>Enter OTP</Text>
                    <Text style={styles.stepSub}>We've sent a 6-digit code to {maskedPhone}</Text>
                  </View>

                  <View style={styles.otpContainer}>
                    {otp.map((digit, i) => (
                      <Animated.View key={i} style={[styles.otpBoxWrapper, { transform: [{ scale: otpAnimRefs[i] }] }]}>
                        <TextInput
                          value={digit}
                          onChangeText={(t) => handleOTPChange(t, i)}
                          onKeyPress={(e) => handleKeyPress(e, i)}
                          keyboardType="number-pad"
                          maxLength={1}
                          secureTextEntry={false}
                          style={[styles.otpBox, digit ? styles.otpBoxFilled : null, error ? styles.otpBoxError : null]}
                          placeholderTextColor="#475569"
                        />
                        {digit ? <View style={styles.otpDot} /> : null}
                      </Animated.View>
                    ))}
                  </View>

                  <View style={styles.otpHint}>
                    <Clock size={14} color={canResend ? '#10B981' : '#64748B'} />
                    <Text style={[styles.otpHintText, canResend && { color: '#10B981' }]}>
                      {canResend ? 'Resend OTP' : `Resend in ${resendTimer}s`}
                    </Text>
                    {canResend && (
                      <Pressable onPress={handleResend} style={styles.resendBtn}>
                        <RefreshCw size={14} color="#4F46E5" />
                        <Text style={styles.resendText}>Resend</Text>
                      </Pressable>
                    )}
                  </View>

                  {error ? (
                    <View style={styles.errorBox}>
                      <AlertCircle size={14} color="#EF4444" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <Pressable onPress={handleVerifyOTP} disabled={loading || otp.join('').length !== 6}
                    style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed, otp.join('').length !== 6 && styles.submitBtnDisabled]}>
                    <LinearGradient
                      colors={loading ? ['#475569', '#64748B'] : ['#2563EB', '#0EA5E9', '#06B6D4']}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={styles.submitGradient}>
                      {loading ? (
                        <View style={styles.loadingDots}><View style={styles.loadingDot} /><View style={[styles.loadingDot, { opacity: 0.6 }]} /><View style={[styles.loadingDot, { opacity: 0.3 }]} /></View>
                      ) : (
                        <>
                          <Fingerprint size={18} color="#fff" />
                          <Text style={styles.submitText}>Verify OTP</Text>
                          <Check size={18} color="#fff" />
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>

                  <Pressable onPress={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); setError(''); }} style={styles.changePhoneBtn}>
                    <ArrowLeft size={14} color="#4F46E5" />
                    <Text style={styles.changePhoneText}>Change phone number</Text>
                  </Pressable>
                </Animated.View>
              )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>By continuing, you agree to our Terms of Service and Privacy Policy</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { height: 280, overflow: 'hidden', justifyContent: 'flex-end' },
  heroContent: { paddingHorizontal: 24, paddingBottom: 20, alignItems: 'center' },
  logoContainer: { marginBottom: 16 },
  brandName: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  brandSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', marginTop: 4 },

  cardSection: { flex: 1, marginTop: -20, paddingHorizontal: 20 },
  card: {
    backgroundColor: '#1E293B', borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: '#334155',
  },

  // Step Indicator
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 24, gap: 0 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#4F46E5' },
  stepDotInactive: { backgroundColor: '#334155' },
  stepNumber: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  stepLine: { width: 40, height: 2, borderRadius: 1 },
  stepLineActive: { backgroundColor: '#4F46E5' },
  stepLineInactive: { backgroundColor: '#334155' },

  // Step Header
  stepHeader: { alignItems: 'center', marginBottom: 24, gap: 8 },
  stepIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#4F46E515', borderWidth: 1, borderColor: '#4F46E530', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  stepTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  stepSub: { color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 18 },

  // Phone Input
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 14, borderWidth: 1.5, borderColor: '#334155', overflow: 'hidden' },
  countryCode: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 14, backgroundColor: '#1E293B', borderRightWidth: 1, borderRightColor: '#334155' },
  countryFlag: { fontSize: 16 },
  countryCodeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  phoneInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 14, color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 2 },
  phoneHint: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  phoneHintText: { color: '#F59E0B', fontSize: 11, fontWeight: '500' },

  // OTP Input
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
  otpBoxWrapper: { position: 'relative' },
  otpBox: {
    width: 48, height: 56, borderRadius: 12, borderWidth: 2, borderColor: '#334155',
    backgroundColor: '#0F172A', color: '#fff', fontSize: 22, fontWeight: '800',
    textAlign: 'center', textAlignVertical: 'center',
  },
  otpBoxFilled: { borderColor: '#4F46E5', backgroundColor: '#4F46E510' },
  otpBoxError: { borderColor: '#EF4444' },
  otpDot: { position: 'absolute', bottom: 12, width: 6, height: 6, borderRadius: 3, backgroundColor: '#4F46E5' },

  otpHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  otpHintText: { color: '#64748B', fontSize: 12 },
  resendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resendText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },

  changePhoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 12 },
  changePhoneText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },

  // Error
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EF444415', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#EF444430' },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600', flex: 1 },

  // Submit Button
  submitBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  submitBtnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  submitBtnDisabled: { opacity: 0.5 },
  submitGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

  // Loading
  loadingDots: { flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center' },
  loadingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  // Security
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#10B98110', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#10B98120' },
  securityText: { color: '#94A3B8', fontSize: 11, flex: 1, lineHeight: 16 },

  // Success
  successContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  successSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },

  // Footer
  footer: { paddingVertical: 16, alignItems: 'center' },
  footerText: { color: '#64748B', fontSize: 10, textAlign: 'center', lineHeight: 14 },
});
