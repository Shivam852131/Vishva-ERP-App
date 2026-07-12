import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const theme = {
  colors: {
    bg: '#F4F7F6',
    text: '#064E3B',
    surface: '#F4F7F6',
    onSurface: '#064E3B',
    surfaceSecondary: '#FFFFFF',
    onSurfaceSecondary: '#0F766E',
    surfaceTertiary: '#E6ECEB',
    onSurfaceTertiary: '#115E59',
    surfaceInverse: '#0A0F0D',
    onSurfaceInverse: '#FFFFFF',
    brand: '#047857',
    brandPrimary: '#059669',
    onBrandPrimary: '#FFFFFF',
    brandSecondary: '#10B981',
    onBrandSecondary: '#022C22',
    brandTertiary: '#D1FAE5',
    onBrandTertiary: '#064E3B',
    success: '#10B981',
    onSuccess: '#022C22',
    warning: '#F59E0B',
    onWarning: '#451A03',
    error: '#EF4444',
    onError: '#450A0A',
    info: '#3B82F6',
    onInfo: '#EFF6FF',
    border: '#E2E8F0',
    borderStrong: '#94A3B8',
    divider: '#E2E8F0',
    muted: '#64748B',
    overlay: 'rgba(0,0,0,0.45)',
    glassLight: 'rgba(255,255,255,0.72)',
    glassDark: 'rgba(10,15,13,0.78)',
    dark: {
      surface: '#0A0F0D',
      onSurface: '#F8FAFC',
      surfaceSecondary: '#131B17',
      onSurfaceSecondary: '#94A3B8',
      surfaceTertiary: '#1C2621',
      onSurfaceTertiary: '#64748B',
      surfaceInverse: '#FFFFFF',
      onSurfaceInverse: '#0A0F0D',
      brandPrimary: '#10B981',
      onBrandPrimary: '#022C22',
      brandSecondary: '#059669',
      onBrandSecondary: '#FFFFFF',
      brandTertiary: '#064E3B',
      onBrandTertiary: '#D1FAE5',
      border: '#1E293B',
      borderStrong: '#334155',
      divider: '#1E293B',
      overlay: 'rgba(0,0,0,0.6)',
      glassLight: 'rgba(19,27,23,0.78)',
      glassDark: 'rgba(10,15,13,0.85)',
    },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 6, md: 12, lg: 20, pill: 999 },
  font: {
    display: Platform.OS === 'ios' ? 'System' : 'System',
    text: Platform.OS === 'ios' ? 'System' : 'System',
    size: { xs: 11, sm: 12, base: 14, lg: 16, xl: 20, xxl: 24, xxxl: 32, hero: 40 },
  },
  shadow: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6 },
    xl: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 10 },
  },
  screen: { width, height },
  isIOS: Platform.OS === 'ios',
  isAndroid: Platform.OS === 'android',
  isWeb: Platform.OS === 'web',
};

export const bg = {
  hero: 'https://images.unsplash.com/photo-1581084324492-c8076f130f86?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
  attendance: 'https://images.unsplash.com/photo-1769120062656-23adba3790b3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTN8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMGdyaWQlMjBkYXJrJTIwZ3JlZW58ZW58MHx8fHwxNzgxOTU0Njc5fDA&ixlib=rb-4.1.0&q=85',
  ai: 'https://images.unsplash.com/photo-1616072775440-ca2ea7c7ce13?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwyfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMG9yYnxlbnwwfHx8fDE3ODI0OTAxMjF8MA&ixlib=rb-4.1.0&q=85',
};

export const hero = {
  university: 'https://images.unsplash.com/photo-1664273891579-22f28332f3c4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwYnVpbGRpbmclMjBtb2Rlcm58ZW58MHx8fHwxNzgyOTY1MzExfDA&ixlib=rb-4.1.0&q=85',
  library: 'https://images.unsplash.com/photo-1741699428220-65f37f3fbbcb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTZ8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwc3R1ZHlpbmclMjBsaWJyYXJ5fGVufDB8fHx8MTc4Mjk2NTMxMXww&ixlib=rb-4.1.0&q=85',
};

export const COLORS = theme.colors;
