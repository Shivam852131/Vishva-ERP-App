import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  LogOut, Award, Calendar, Bell, Users, BookOpen,
  Library, Bus, Home, MessageSquare, ChevronRight, IdCard,
  ScanFace, FileText, Pencil, Camera,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function Profile() {
  const { user: u, logout: doLogout } = useAuth();
  const [tapCount, setTapCount] = useState(0);
  const { data: faceProfile } = useFetch<{ enrolled: boolean }>('/face/profile');

  const logout = async () => {
    await doLogout();
    router.replace('/login');
  };

  const handleVersionTap = () => {
    const next = tapCount + 1;
    setTapCount(next);
    if (next >= 5) {
      setTapCount(0);
      router.push('/__screenshots' as any);
    }
  };

  const getLinksForRole = () => {
    const role = u?.role;
    if (role === 'faculty') {
      return [
        { icon: <IdCard size={18} color={theme.colors.brand} />, label: 'Digital ID Card', to: '/id-card' },
        { icon: <Calendar size={18} color={theme.colors.brand} />, label: 'Take Attendance', to: '/start-session' },
        { icon: <BookOpen size={18} color={theme.colors.brand} />, label: 'Live Classes', to: '/live-classes' },
        { icon: <Award size={18} color={theme.colors.brand} />, label: 'AI Exam Generator', to: '/(faculty)/exam-generator' },
        { icon: <FileText size={18} color={theme.colors.brand} />, label: 'Leave Requests', to: '/leave-management' },
        { icon: <Library size={18} color={theme.colors.brand} />, label: 'Library Resources', to: '/library' },
        { icon: <Users size={18} color={theme.colors.brand} />, label: 'Faculty Chat', to: '/chat' },
        { icon: <Bell size={18} color={theme.colors.brand} />, label: 'Notifications', to: '/notifications' },
      ];
    }
    if (role === 'college_admin') {
      return [
        { icon: <Award size={18} color={theme.colors.brand} />, label: 'Fee Payments & Invoices', to: '/(college_admin)/payments' },
        { icon: <IdCard size={18} color={theme.colors.brand} />, label: 'Campus Subscription', to: '/(college_admin)/subscription' },
        { icon: <Home size={18} color={theme.colors.brand} />, label: 'Hostel Administration', to: '/(college_admin)/hostel-admin' },
        { icon: <Users size={18} color={theme.colors.brand} />, label: 'Placement Management', to: '/(college_admin)/placements' },
        { icon: <BookOpen size={18} color={theme.colors.brand} />, label: 'Skill Assessments Admin', to: '/(college_admin)/assessments-admin' },
        { icon: <Calendar size={18} color={theme.colors.brand} />, label: 'Visitor Management', to: '/visitor' },
        { icon: <Library size={18} color={theme.colors.brand} />, label: 'Campus Assets', to: '/assets' },
        { icon: <MessageSquare size={18} color={theme.colors.brand} />, label: 'Complaints & Grievances', to: '/complaints' },
        { icon: <Bell size={18} color={theme.colors.brand} />, label: 'Notifications', to: '/notifications' },
      ];
    }
    if (role === 'super_admin') {
      return [
        { icon: <Home size={18} color={theme.colors.brand} />, label: 'Institutions & Colleges', to: '/(super_admin)/colleges' },
        { icon: <Users size={18} color={theme.colors.brand} />, label: 'Platform Users', to: '/(super_admin)/users' },
        { icon: <Award size={18} color={theme.colors.brand} />, label: 'Platform Analytics', to: '/analytics' },
        { icon: <Bell size={18} color={theme.colors.brand} />, label: 'Broadcast Notifications', to: '/push-notifications' },
        { icon: <MessageSquare size={18} color={theme.colors.brand} />, label: 'Email Integration', to: '/email' },
        { icon: <MessageSquare size={18} color={theme.colors.brand} />, label: 'WhatsApp Integration', to: '/whatsapp' },
      ];
    }
    if (role === 'parent') {
      return [
        { icon: <Calendar size={18} color={theme.colors.brand} />, label: 'Child Attendance Record', to: '/(parent)/attendance' },
        { icon: <Award size={18} color={theme.colors.brand} />, label: 'Fee Payments & Invoices', to: '/(parent)/fees' },
        { icon: <BookOpen size={18} color={theme.colors.brand} />, label: 'Report Card & Marks', to: '/report-card' },
        { icon: <FileText size={18} color={theme.colors.brand} />, label: 'Parent AI Assistant', to: '/(parent)/ai' },
        { icon: <Bus size={18} color={theme.colors.brand} />, label: 'Bus & Transport Tracker', to: '/bus-tracking' },
        { icon: <MessageSquare size={18} color={theme.colors.brand} />, label: 'Submit Grievance', to: '/grievances' },
        { icon: <Bell size={18} color={theme.colors.brand} />, label: 'Notifications', to: '/notifications' },
      ];
    }
    // Default student links
    return [
      { icon: <IdCard size={18} color={theme.colors.brand} />, label: 'Digital ID Card', to: '/id-card' },
      {
        icon: <ScanFace size={18} color={theme.colors.brand} />,
        label: 'Face ID Biometrics',
        to: '/face-enroll',
        badge: faceProfile?.enrolled ? 'Active' : undefined,
      },
      { icon: <Award size={18} color={theme.colors.brand} />, label: 'Skill Assessments', to: '/skill-assessment' },
      { icon: <BookOpen size={18} color={theme.colors.brand} />, label: 'Career Dashboard', to: '/career-dashboard' },
      { icon: <FileText size={18} color={theme.colors.brand} />, label: 'Leave Requests', to: '/leave-management' },
      { icon: <Award size={18} color={theme.colors.brand} />, label: 'Results & Marks', to: '/results' },
      { icon: <Calendar size={18} color={theme.colors.brand} />, label: 'Campus Events', to: '/events' },
      { icon: <Users size={18} color={theme.colors.brand} />, label: 'Student Chat', to: '/chat' },
      { icon: <Library size={18} color={theme.colors.brand} />, label: 'Digital Library', to: '/library' },
      { icon: <Home size={18} color={theme.colors.brand} />, label: 'Hostel Portal', to: '/hostel' },
      { icon: <Bus size={18} color={theme.colors.brand} />, label: 'Transport & Bus', to: '/transport' },
      { icon: <MessageSquare size={18} color={theme.colors.brand} />, label: 'Grievances & Support', to: '/grievances' },
      { icon: <Bell size={18} color={theme.colors.brand} />, label: 'Notifications', to: '/notifications' },
    ];
  };

  const links = getLinksForRole();

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView>
          <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.hero}>
            <View style={styles.avatarWrap}>
              {u?.avatar ? (
                <Image source={{ uri: u.avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{u?.name?.[0] || 'U'}</Text>
                </View>
              )}
              <Pressable
                testID="edit-profile-btn"
                accessibilityLabel="Edit your profile"
                accessibilityRole="button"
                onPress={() => router.push('/edit-profile')}
                style={styles.editBadge}
              >
                <Pencil size={14} color="#fff" />
              </Pressable>
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
                {l.badge ? (
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeTxt}>{l.badge}</Text>
                  </View>
                ) : null}
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

            <Pressable onPress={handleVersionTap} style={{ alignItems: 'center', marginTop: 16, padding: 8 }}>
              <Text style={{ color: theme.colors.muted, fontSize: 10 }}>v1.0.0</Text>
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
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    ...theme.shadow.lg,
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
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
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
    flexBasis: '47%',
    flexGrow: 1,
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
  badgePill: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
    marginRight: 6,
  },
  badgeTxt: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '700',
  },
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
