import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

/**
 * AnimatedViLogo
 *
 * Vector version of the Vishva ERP brand mark (the "Vi" tile), rebuilt from
 * the app icon so it can animate and stay crisp at any size:
 *
 *  1. The gradient tile springs in.
 *  2. The white "V" draws itself on with a stroke-dash flow.
 *  3. The "i" stem wipes in and its dot pops with a spring.
 *  4. An idle loop takes over: soft glow pulse, shimmer sweep across the
 *     tile and two orbiting light trails ("flow") circling the logo.
 *
 * All idle motion runs on the native driver (transform/opacity only), so it
 * stays at 60fps and costs almost nothing after the intro finishes.
 *
 * `animate={false}` (or the OS "reduce motion" setting) renders the final,
 * fully static logo with no running loops.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/* Brand palette — matches assets/images/icon.png and theme.ts gradients. */
const BRAND = {
  tileTop: '#2563EB',
  tileMid: '#0EA5E9',
  tileBottom: '#10B981',
  mark: '#FFFFFF',
  dot: '#A5C8FF',
  glow: 'rgba(14,165,233,0.35)',
  trailA: '#38BDF8',
  trailB: '#34D399',
};

/* Geometry lives in a 100x100 viewBox so the mark scales to any size. */
const VIEW = 100;
const TILE_RX = 23;
const V_D = 'M28 33 L47.5 66.5 L65.5 33';
const V_LEN = 77; // path length (draws 0 -> 100% via dash offset)
const STEM_D = 'M71 54.5 L71 65.5';
const STEM_LEN = 11;
const DOT_CX = 71;
const DOT_CY = 42;
const DOT_R = 5.6;

/* The orbit frame is slightly larger than the logo so the light trails
 * circle just outside the tile (118 viewBox units = size * 1.18, so both
 * SVGs share the exact same unit scale). */
const ORBIT_SCALE = 1.18;
const ORBIT_VIEW = 118;
const ORBIT_CX = 59;
const ORBIT_CY = 59;
const ORBIT_R = 54;
const ORBIT_CIRC = 2 * Math.PI * ORBIT_R;
const TRAIL_A = `${(ORBIT_CIRC * 0.3).toFixed(2)} ${(ORBIT_CIRC * 0.7).toFixed(2)}`;
const TRAIL_B = `${(ORBIT_CIRC * 0.18).toFixed(2)} ${(ORBIT_CIRC * 0.82).toFixed(2)}`;

/* Unique gradient ids per instance (React 19's useId produces colons,
 * which are not safe inside SVG url(#...) fragments). */
let instanceCount = 0;

export interface AnimatedViLogoProps {
  /** Logo size in dp. Everything else is derived, so it stays crisp at any size. */
  size?: number;
  /** Play the intro + idle flow. `false` renders the static final frame. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function AnimatedViLogo({
  size = 96,
  animate = true,
  style,
  accessibilityLabel = 'Vishva ERP logo',
}: AnimatedViLogoProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const active = animate && !reduceMotion;

  const idsRef = useRef<string | null>(null);
  if (idsRef.current === null) {
    instanceCount += 1;
    idsRef.current = `vishvaLogo${instanceCount}`;
  }
  const gradId = `${idsRef.current}Grad`;

  /* Native-driven values (transform / opacity on wrapper Views). */
  const tileOpacity = useRef(new Animated.Value(0)).current;
  const tileScale = useRef(new Animated.Value(0.82)).current;
  const shimmerT = useRef(new Animated.Value(0)).current;
  const glowT = useRef(new Animated.Value(0)).current;
  const orbitOpacity = useRef(new Animated.Value(0)).current;
  const orbitSpinA = useRef(new Animated.Value(0)).current;
  const orbitSpinB = useRef(new Animated.Value(0)).current;

  /* JS-driven values (SVG props, intro only). */
  const vDash = useRef(new Animated.Value(V_LEN)).current;
  const stemDash = useRef(new Animated.Value(STEM_LEN)).current;
  const dotR = useRef(new Animated.Value(0)).current;

  /* Respect the OS "reduce motion" accessibility setting. */
  useEffect(() => {
    let mounted = true;
    try {
      const result = AccessibilityInfo.isReduceMotionEnabled?.();
      if (result && typeof result.then === 'function') {
        result
          .then((value: boolean) => {
            if (mounted && value) {
              setReduceMotion(true);
            }
          })
          .catch(() => {});
      }
    } catch {
      /* Native module unavailable (e.g. tests) — keep animations enabled. */
    }
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active) {
      /* Final static frame: mark fully drawn, steady glow, no loops. */
      tileOpacity.setValue(1);
      tileScale.setValue(1);
      vDash.setValue(0);
      stemDash.setValue(0);
      dotR.setValue(DOT_R);
      shimmerT.setValue(0);
      glowT.setValue(0.5);
      orbitOpacity.setValue(0);
      orbitSpinA.setValue(0);
      orbitSpinB.setValue(0);
      return;
    }

    /* Intro start frame. */
    tileOpacity.setValue(0);
    tileScale.setValue(0.82);
    vDash.setValue(V_LEN);
    stemDash.setValue(STEM_LEN);
    dotR.setValue(0);
    shimmerT.setValue(0);
    glowT.setValue(0);
    orbitOpacity.setValue(0);
    orbitSpinA.setValue(0);
    orbitSpinB.setValue(0);

    let mounted = true;
    const loops: Animated.CompositeAnimation[] = [];

    const intro = Animated.sequence([
      Animated.parallel([
        Animated.timing(tileOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.spring(tileScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(vDash, {
          toValue: 0,
          duration: 1000,
          delay: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(stemDash, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.spring(dotR, {
          toValue: DOT_R,
          tension: 140,
          friction: 8,
          useNativeDriver: false,
        }),
      ]),
    ]);

    intro.start(({ finished }) => {
      if (!finished || !mounted) {
        return;
      }
      loops.push(
        /* Light trails fade in once the mark has fully drawn. */
        Animated.timing(orbitOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        /* Shimmer sweep: eased out-and-back so the loop point is seamless. */
        Animated.loop(
          Animated.sequence([
            Animated.timing(shimmerT, {
              toValue: 1,
              duration: 2800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(shimmerT, {
              toValue: 0,
              duration: 2800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ),
        /* Soft glow breathing. */
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowT, {
              toValue: 1,
              duration: 2400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowT, {
              toValue: 0,
              duration: 2400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ),
        /* Orbiting trails: a full 360deg spin snaps back invisibly. */
        Animated.loop(
          Animated.sequence([
            Animated.timing(orbitSpinA, {
              toValue: 1,
              duration: 7000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(orbitSpinA, {
              toValue: 0,
              duration: 1,
              useNativeDriver: true,
            }),
          ]),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(orbitSpinB, {
              toValue: 1,
              duration: 11000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(orbitSpinB, {
              toValue: 0,
              duration: 1,
              useNativeDriver: true,
            }),
          ]),
        ),
      );
      loops.forEach((loop) => loop.start());
    });

    return () => {
      mounted = false;
      intro.stop();
      loops.forEach((loop) => loop.stop());
    };
    // The Animated.Value refs are stable for the component lifetime, and the
    // intro must replay only when `active` flips — adding them here would
    // restart the animation on every render. Size only affects interpolations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const shimmerX = shimmerT.interpolate({
    inputRange: [0, 1],
    outputRange: [-size * 0.8, size * 0.8],
  });
  const shimmerOpacity = shimmerT.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.9, 0],
  });
  const glowOpacity = glowT.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.16, 0.42, 0.16],
  });
  const glowScale = glowT.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.07, 1],
  });
  const orbitRotateA = orbitSpinA.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const orbitRotateB = orbitSpinB.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '540deg'],
  });

  const corner = size * (TILE_RX / VIEW);
  const orbitFrame = size * ORBIT_SCALE;
  const orbitOffset = (orbitFrame - size) / 2;

  return (
    <View
      style={[{ width: size, height: size }, styles.root, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Ambient glow behind the tile */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: size * 1.35,
            height: size * 1.35,
            borderRadius: corner + size * 0.2,
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Drop shadow (kept outside the clipped tile so iOS draws it) */}
      <View
        pointerEvents="none"
        style={[
          styles.shadow,
          {
            width: size,
            height: size,
            borderRadius: corner,
            shadowColor: BRAND.tileTop,
            shadowOffset: { width: 0, height: size * 0.06 },
            shadowOpacity: 0.5,
            shadowRadius: size * 0.18,
            elevation: 12,
          },
        ]}
      />

      {/* The gradient tile with the vector "Vi" mark */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tile,
          {
            width: size,
            height: size,
            borderRadius: corner,
            opacity: tileOpacity,
            transform: [{ scale: tileScale }],
          },
        ]}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
          <Defs>
            <SvgLinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={BRAND.tileTop} />
              <Stop offset="0.5" stopColor={BRAND.tileMid} />
              <Stop offset="1" stopColor={BRAND.tileBottom} />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={VIEW} height={VIEW} rx={TILE_RX} fill={`url(#${gradId})`} />
          <AnimatedPath
            d={V_D}
            stroke={BRAND.mark}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={V_LEN}
            strokeDashoffset={vDash}
          />
          <AnimatedPath
            d={STEM_D}
            stroke={BRAND.mark}
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={STEM_LEN}
            strokeDashoffset={stemDash}
          />
          <AnimatedCircle cx={DOT_CX} cy={DOT_CY} r={dotR} fill={BRAND.dot} />
        </Svg>

        {/* Shimmer sweep clipped to the tile */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shimmer,
            {
              width: size * 0.3,
              height: size * 2,
              borderRadius: size * 0.15,
              top: -size * 0.5,
              left: size * 0.35,
              opacity: shimmerOpacity,
              transform: [{ translateX: shimmerX }, { rotate: '22deg' }],
            },
          ]}
        />
      </Animated.View>

      {/* Orbiting light trails */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbitLayer,
          {
            top: -orbitOffset,
            left: -orbitOffset,
            width: orbitFrame,
            height: orbitFrame,
            opacity: orbitOpacity,
            transform: [{ rotate: orbitRotateA }],
          },
        ]}
      >
        <Svg width={orbitFrame} height={orbitFrame} viewBox={`0 0 ${ORBIT_VIEW} ${ORBIT_VIEW}`}>
          <Circle
            cx={ORBIT_CX}
            cy={ORBIT_CY}
            r={ORBIT_R}
            stroke={BRAND.trailA}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={TRAIL_A}
          />
          <Circle cx={ORBIT_CX + ORBIT_R} cy={ORBIT_CY} r={2.8} fill={BRAND.dot} />
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbitLayer,
          {
            top: -orbitOffset,
            left: -orbitOffset,
            width: orbitFrame,
            height: orbitFrame,
            opacity: orbitOpacity,
            transform: [{ rotate: orbitRotateB }],
          },
        ]}
      >
        <Svg width={orbitFrame} height={orbitFrame} viewBox={`0 0 ${ORBIT_VIEW} ${ORBIT_VIEW}`}>
          <Circle
            cx={ORBIT_CX}
            cy={ORBIT_CY}
            r={ORBIT_R}
            stroke={BRAND.trailB}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={TRAIL_B}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    backgroundColor: BRAND.glow,
  },
  shadow: {
    position: 'absolute',
  },
  tile: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  orbitLayer: {
    position: 'absolute',
  },
});
