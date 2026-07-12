import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Animated } from 'react-native';
import { router } from '@/src/navigation/router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { ViLogo } from '@/src/components/ViLogo';

const ONBOARDING_KEY = 'vishva_onboarding_done';

export default function Index() {
  const { user, token, loading } = useAuth();
  const [routeDone, setRouteDone] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  useEffect(() => {
    // Animate logo on splash
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (loading) return;

    const navigate = async () => {
      try {
        const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);

        if (!onboardingDone) {
          // First time → landing page
          router.replace('/landing');
        } else if (token && user) {
          // Authenticated → role dashboard
          const role = user.role;
          const roleRouteMap: Record<string, string> = {
            student: '/(student)/dashboard',
            faculty: '/(faculty)/dashboard',
            college_admin: '/(college_admin)/dashboard',
            super_admin: '/(super_admin)/dashboard',
            parent: '/(parent)/dashboard',
          };
          if (roleRouteMap[role]) {
            router.replace(roleRouteMap[role] as any);
          } else {
            router.replace('/login');
          }
        } else {
          // Not authenticated → login
          router.replace('/login');
        }
      } catch (err) {
        // Fallback to login on any error
        router.replace('/login');
      } finally {
        setRouteDone(true);
      }
    };

    // Minimum splash display time (800ms) for smooth UX
    const timer = setTimeout(navigate, 800);
    return () => clearTimeout(timer);
  }, [loading, token, user]);

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.logoWrap,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <ViLogo size={100} animate={false} />
        </Animated.View>
        <Animated.Text style={[styles.appName, { opacity: fadeAnim }]}>
          Vishva ERP
        </Animated.Text>
        <ActivityIndicator color="#0EA5E9" size="small" style={styles.spinner} />
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    marginBottom: 20,
  },
  appName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  spinner: {
    marginTop: 24,
  },
});
