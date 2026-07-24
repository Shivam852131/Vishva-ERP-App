import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  LogOut, Award, Calendar, Bell, Users, BookOpen,
  Library, Bus, Home, MessageSquare, ChevronRight, IdCard,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { theme } from '@/src/theme';
import { Card } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function Profile() {
  const { user: u, logout: doLogout } = useAuth();

  const logout = async () => {
    await doLogout();
    router.replace('/login');
  };

  const links = [
    { icon: <IdCard size={18} color={theme.colors.brand} />, label: 'Digital ID Card', to: '/id-card' },
    { icon: <Bell size={18} color={theme.colors.brand} />, label: 'Notifications', to: '/notifications' },
    { icon: <Award size={18} color={theme.colors.brand} />, label: 'Results', to: '/results' },
    { icon: <Calendar size={18} color={theme.colors.brand} />, label: 'Events', to: '/events' },
    { icon: <Users size={18} color={theme.colors.brand} />, label: 'Chat', to: '/chat' },
    { icon: <Library size={18} color={theme.colors.brand} />, label: 'Library', to: '/library' },
    { icon: <Home size={18} color={theme.colors.brand} />, label: 'Hostel', to: '/hostel' },
    { icon: <Bus size={18} color={theme.colors.brand} />, label: 'Transport', to: '/transport' },
    { icon: <MessageSquare size={18} color={theme.colors.brand} />, label: 'Grievances', to: '/grievances' },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView>
          <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{u?.name?.[0] || 'U'}</Text>
            </View>
            <Text style={styles.name}>{u?.name}</Text>
            <Text style={styles.email}>{u?.email}</Text>
            {u?.student_id && (
              <View style={styles.idBadge}>
                <Text style={styles.idTxt}>ID: {u.student_id}</Text>
              </View>
            )}
          </LinearGradient>

          <View style={styles.body}>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Role</Text>
                <Text style={styles.infoVal}>{u?.role?.replace('_', ' ')}</Text>
              </View>
              {u?.college && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>College</Text>
                  <Text style={styles.infoVal}>{u.college}</Text>
                </View>
              )}
              {u?.department && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Department</Text>
                  <Text style={styles.infoVal}>{u.department}</Text>
                </View>
              )}
              {u?.year && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Year</Text>
                  <Text style={styles.infoVal}>{u.year}</Text>
                </View>
              )}
              {u?.cgpa !== undefined && (
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>CGPA</Text>
                  <Text style={styles.infoVal}>{u.cgpa}</Text>
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Quick Links</Text>
            {links.map(l => (
              <Pressable
                testID={`link-${l.label.toLowerCase()}`}
                accessibilityLabel={`Navigate to ${l.label}`}
                accessibilityRole="button"
                key={l.label}
                style={styles.link}
                onPress={() => router.push(l.to as any)}
              >
                <View style={styles.linkIcon}>{l.icon}</View>
                <Text style={styles.linkTxt}>{l.label}</Text>
                <ChevronRight color={theme.colors.muted} size={16} />
              </Pressable>
            ))}

            <Pressable
              testID="logout-btn"
              accessibilityLabel="Log out of your account"
              accessibilityRole="button"
              onPress={logout}
              style={styles.logout}
            >
              <LogOut color={theme.colors.error} size={18} />
              <Text style={styles.logoutTxt}>Log Out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    paddingBottom: theme.spacing.xxl,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    ...theme.shadow.lg,
  },
  avatarTxt: { fontSize: 40, fontWeight: '800', color: '#fff' },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12 },
  email: { color: 'rgba(255,255,255,0.85)', marginTop: 4, fontSize: 13 },
  idBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    marginTop: 8,
  },
  idTxt: { color: '#fff', fontSize: 12, fontWeight: '600' },
  body: { padding: theme.spacing.lg },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.lg },
  infoItem: {
    width: '48%',
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  infoLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: '600' },
  infoVal: {
    color: theme.colors.onSurface,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.onSurface,
    marginBottom: theme.spacing.md,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTxt: { color: theme.colors.onSurface, fontWeight: '600', flex: 1 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.xl,
  },
  logoutTxt: { color: theme.colors.error, fontWeight: '700' },
});
