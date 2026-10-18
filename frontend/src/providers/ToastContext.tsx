import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Pressable } from 'react-native';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react-native';
import { theme } from '../theme';
import * as Haptics from '../native/haptics';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (opts: ToastOptions | string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -100, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setToast(null);
    });
  }, [opacity, translateY]);

  const showToast = useCallback((opts: ToastOptions | string) => {
    const message = typeof opts === 'string' ? opts : opts.message;
    const type = typeof opts === 'string' ? 'info' : (opts.type || 'info');
    const duration = typeof opts === 'string' ? 3000 : (opts.duration || 3000);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (type === 'success') Haptics.notificationSuccess();
    else if (type === 'error') Haptics.notificationError();
    else Haptics.selection();

    setToast({ message, type });

    translateY.setValue(-100);
    opacity.setValue(0);

    Animated.parallel([
      Animated.spring(translateY, { toValue: 12, tension: 80, friction: 10, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timerRef.current = setTimeout(() => {
      hideToast();
    }, duration);
  }, [hideToast, opacity, translateY]);

  const success = useCallback((msg: string) => showToast({ message: msg, type: 'success' }), [showToast]);
  const error = useCallback((msg: string) => showToast({ message: msg, type: 'error' }), [showToast]);
  const info = useCallback((msg: string) => showToast({ message: msg, type: 'info' }), [showToast]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={18} color="#10B981" />;
      case 'error': return <AlertCircle size={18} color="#EF4444" />;
      case 'warning': return <AlertTriangle size={18} color="#F59E0B" />;
      case 'info':
      default: return <Info size={18} color="#3B82F6" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success': return '#10B981';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info':
      default: return '#3B82F6';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              transform: [{ translateY }],
              opacity,
              borderLeftColor: getBorderColor(toast.type),
            },
          ]}
          testID="toast-banner"
        >
          <View style={styles.toastContent}>
            {getIcon(toast.type)}
            <Text style={styles.toastText} numberOfLines={2}>
              {toast.message}
            </Text>
            <Pressable onPress={hideToast} hitSlop={10} style={styles.closeBtn}>
              <X size={14} color={theme.colors.muted} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 99999,
    backgroundColor: '#1E293B',
    borderRadius: theme.radius.md,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toastText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 2,
  },
});
