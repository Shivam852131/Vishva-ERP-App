import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { AppImage as Image } from '@/src/components/AppImage';

interface ViLogoProps {
  size?: number;
  animate?: boolean;
}

export function ViLogo({ size = 120, animate = true }: ViLogoProps) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      scaleAnim.setValue(1);
      glowAnim.setValue(0.5);
      return;
    }
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 35,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 2500,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 2500,
              useNativeDriver: true,
            }),
          ]),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmerAnim, {
              toValue: 1,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.timing(shimmerAnim, {
              toValue: 0,
              duration: 3000,
              useNativeDriver: true,
            }),
          ]),
        ),
      ]),
    ]).start();
  }, []);

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.15, 0.45, 0.15],
  });

  const glowScale = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.06, 1],
  });

  const shimmerX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 0.8, size * 0.8],
  });

  const cornerRadius = size * 0.24;
  const borderWidth = size * 0.025;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: cornerRadius,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: cornerRadius + 20,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Shadow layer */}
      <View
        style={[
          styles.shadow,
          {
            width: size,
            height: size,
            borderRadius: cornerRadius,
            shadowColor: '#2563EB',
            shadowOffset: { width: 0, height: size * 0.08 },
            shadowOpacity: 0.5,
            shadowRadius: size * 0.15,
            elevation: 12,
          },
        ]}
      />

      {/* Border ring */}
      <View
        style={[
          styles.borderRing,
          {
            width: size + borderWidth * 2,
            height: size + borderWidth * 2,
            borderRadius: cornerRadius + borderWidth,
          },
        ]}
      />

      {/* Main gradient background */}
      <LinearGradient
        colors={['#2563EB', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.background,
          {
            width: size,
            height: size,
            borderRadius: cornerRadius,
          },
        ]}
      >
        {/* Top-left highlight (glass reflection) */}
        <View
          style={[
            styles.glassHighlight,
            {
              width: size * 0.7,
              height: size * 0.5,
              borderRadius: cornerRadius * 1.2,
              top: -size * 0.15,
              left: -size * 0.1,
            },
          ]}
        />

        {/* Shimmer sweep */}
        <Animated.View
          style={[
            styles.shimmer,
            {
              width: size * 0.3,
              height: size * 2,
              borderRadius: size * 0.15,
              transform: [{ translateX: shimmerX }, { rotate: '25deg' }],
            },
          ]}
        />

        {/* Inner border glow */}
        <View
          style={[
            styles.innerBorder,
            {
              width: size - 2,
              height: size - 2,
              borderRadius: cornerRadius - 1,
            },
          ]}
        />

        {/* Logo image */}
        <Image
          source={require('../../assets/images/icon.png')}
          style={{
            width: size * 0.7,
            height: size * 0.7,
            borderRadius: size * 0.12,
          }}
          contentFit="contain"
        />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  shadow: {
    position: 'absolute',
  },
  borderRing: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  background: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glassHighlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ rotate: '-15deg' }],
  },
  shimmer: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  innerBorder: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
});
