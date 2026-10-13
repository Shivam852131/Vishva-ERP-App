import React from 'react';
import { StyleSheet, View } from 'react-native';

type BlurViewProps = React.ComponentProps<typeof View> & {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
};

const tintMap = {
  light: 'rgba(255,255,255,0.18)',
  dark: 'rgba(15,23,42,0.48)',
  default: 'rgba(255,255,255,0.12)',
};

export function BlurView({ tint = 'default', style, children, ...rest }: BlurViewProps) {
  return (
    <View style={[styles.base, { backgroundColor: tintMap[tint] }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
