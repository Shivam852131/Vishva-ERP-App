import React from 'react';
import { StyleSheet, View } from 'react-native';

type GradientProps = React.ComponentProps<typeof View> & {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
};

export function LinearGradient({ colors, style, children, start, end, locations, ...rest }: GradientProps) {
  const backgroundColor = colors[colors.length - 1] || 'transparent';

  return (
    <View style={[styles.base, { backgroundColor }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
