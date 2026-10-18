import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WifiOff, Wifi } from 'lucide-react-native';

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const slideAnim = useState(new Animated.Value(-40))[0];

  useEffect(() => {
    // In React Native web / native environments, listen to network changes
    if (typeof window !== 'undefined' && window.addEventListener) {
      const handleOnline = () => {
        setIsOffline(false);
        setShowRestored(true);
        setTimeout(() => setShowRestored(false), 3000);
      };
      const handleOffline = () => {
        setIsOffline(true);
        setShowRestored(false);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    if (isOffline || showRestored) {
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: -40, duration: 250, useNativeDriver: true }).start();
    }
  }, [isOffline, showRestored, slideAnim]);

  if (!isOffline && !showRestored) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: isOffline ? '#DC2626' : '#059669',
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {isOffline ? (
        <>
          <WifiOff size={14} color="#FFF" />
          <Text style={styles.text}>You are currently offline. Showing cached ERP data.</Text>
        </>
      ) : (
        <>
          <Wifi size={14} color="#FFF" />
          <Text style={styles.text}>Internet connection restored.</Text>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
