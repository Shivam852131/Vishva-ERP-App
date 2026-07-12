import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';

interface ViLogoProps {
  size?: number;
  animate?: boolean;
}

export function ViLogo({ size = 120, animate = true }: ViLogoProps) {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      scaleAnim.setValue(1);
      return;
    }
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 40, friction: 6, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
      ),
    ]).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  const cornerRadius = size * 0.22;

  return (
    <Animated.View
      style={[
        logoStyles.container,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Glow */}
      <Animated.View
        style={[
          logoStyles.glow,
          {
            width: size + 30,
            height: size + 30,
            borderRadius: cornerRadius + 15,
            opacity: glowOpacity,
          },
        ]}
      />

      {/* Main logo background */}
      <LinearGradient
        colors={['#2563EB', '#0EA5E9', '#06B6D4', '#10B981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          logoStyles.background,
          {
            width: size,
            height: size,
            borderRadius: cornerRadius,
          },
        ]}
      >
        {/* Inner highlight */}
        <View style={[logoStyles.highlight, { borderRadius: cornerRadius }]} />

        {/* Vishva mark */}
        <View style={logoStyles.textContainer}>
          <Text style={[logoStyles.vText, { fontSize: size * 0.48 }]}>V</Text>
          <View style={logoStyles.iContainer}>
            <View style={[logoStyles.iDot, { width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05 }]} />
            <View style={[logoStyles.iBar, { width: size * 0.1, height: size * 0.18, borderRadius: size * 0.02 }]} />
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const logoStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(14,165,233,0.25)',
  },
  background: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  textContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  vText: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: -2,
  },
  iContainer: {
    alignItems: 'center',
    marginLeft: -4,
    marginBottom: 4,
  },
  iDot: {
    backgroundColor: '#fff',
    marginBottom: 3,
  },
  iBar: {
    backgroundColor: '#fff',
  },
});
