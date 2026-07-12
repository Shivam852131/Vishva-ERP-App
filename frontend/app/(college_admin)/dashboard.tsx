import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from '@/src/navigation/router';
import {
  GraduationCap, UserCheck, BookOpen, Wallet, Megaphone, X,
  Users, Building, Library, Home, BarChart3, MessageSquare, Bus, Bell,
  CreditCard, ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { AdminDashboardData, Announcement } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { StatCard, Card, SectionTitle, GradientButton, EmptyState, DashboardSkeleton } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: dash, loading: dashLoading, refresh: refreshDash } = useFetch<AdminDashboardData>('/dashboard/admin');
  const { data: analytics, loading: anaLoading, refresh: refreshAna } = useFetch<any>('/analytics/admin');
  const { data: announcements = [], loading: annLoading, refresh: refreshAnn } = useFetch<Announcement[]>('/announcements');
  const { data: subscription, loading: subLoading, refresh: refreshSub } = useFetch<any>('/subscription/current');
  const { mutate: sendAnnouncement, loading: annBusy } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [annVisible, setAnnVisible] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annErr, setAnnErr] = useState('');
  const [annSuccess, setAnnSuccess] = useState(false);

  const loading = dashLoading || anaLoading || (subLoading && !subscription);
  const subscriptionActive = subscription?.active !== false || user?.role === 'super_admin';

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDash();
    refreshAna();
    refreshAnn();
    refreshSub();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshDash, refreshAna, refreshAnn, refreshSub]);

  React.useEffect(() => subscribeRealtime('announcements:update', () => refreshAnn()), [refreshAnn]);
  React.useEffect(() => subscribeRealtime('subscription:update', () => {
    refreshSub();
    refreshDash();
    refreshAna();
  }), [refreshAna, refreshDash, refreshSub]);
  React.useEffect(() => subscribeRealtime('payments:update', () => {
    refreshDash();
    refreshAna();
  }), [refreshAna, refreshDash]);

  const submitAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim()) {
      setAnnErr('Title and message are required');
      return;
    }
    setAnnErr('');
    try {
      await sendAnnouncement('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: annTitle.trim(), body: annBody.trim(), audience: 'all' }),
      });
      setAnnSuccess(true);
      setAnnTitle('');
      setAnnBody('');
      refreshAnn();
      setTimeout(() => { setAnnSuccess(false); setAnnVisible(false); }, 1200);
    } catch (e: any) {
      setAnnErr(e.message || 'Failed to send');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!subscriptionActive) {
    return (
      <ErrorBoundary>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40 }}>
            <LinearGradient colors={['#1e1b4b', '#312e81']} style={styles.lockHero}>
              <ShieldCheck color="#fff" size={30} />
              <Text style={styles.lockTitle}>Activate Subscription</Text>
              <Text style={styles.lockSub}>
                Your institution needs an active subscription before college admin tools are unlocked.
              </Text>
              <GradientButton
                label="Open Subscription Plans"
                onPress={() => router.push('/(college_admin)/subscription')}
                style={{ marginTop: theme.spacing.md, alignSelf: 'stretch' }}
              />
            </LinearGradient>

            <SectionTitle title="What unlocks" />
            <View style={styles.lockList}>
              {['User management', 'Fee operations', 'Exam generator', 'Analytics and reports', 'AI-powered workflows'].map((item) => (
                <View key={item} style={styles.lockItem}>
                  <ShieldCheck size={16} color={theme.colors.brandPrimary} />
                  <Text style={styles.lockItemText}>{item}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  const stats = [
    { icon: <GraduationCap size={20} color="#fff" />, label: 'Students', value: dash?.students || 0, color: '#065F46' },
    { icon: <UserCheck size={20} color="#fff" />, label: 'Faculty', value: dash?.faculty || 0, color: '#059669' },
    { icon: <BookOpen size={20} color="#fff" />, label: 'Courses', value: dash?.courses || 0, color: '#10B981' },
    { icon: <Wallet size={20} color="#fff" />, label: 'Fees Due', value: dash?.pending_fees || 0, color: '#D97706' },
    { icon: <Library size={20} color="#fff" />, label: 'Books', value: analytics?.books || 0, color: '#047857' },
    { icon: <Home size={20} color="#fff" />, label: 'Hostel', value: analytics?.hostel_occupants || 0, color: '#0F766E' },
  ];

  const quickLinks = [
    { icon: <Users size={18} color="#fff" />, label: 'Users', color: '#047857', route: '/(college_admin)/users' },
    { icon: <Building size={18} color="#fff" />, label: 'Academics', color: '#059669', route: '/(college_admin)/academics' },
    { icon: <Library size={18} color="#fff" />, label: 'Library', color: '#10B981', route: '/library' },
    { icon: <Home size={18} color="#fff" />, label: 'Hostel', color: '#065F46', route: '/hostel' },
    { icon: <Bus size={18} color="#fff" />, label: 'Transport', color: '#0F766E', route: '/transport' },
    { icon: <MessageSquare size={18} color="#fff" />, label: 'Grievances', color: '#059669', route: '/grievances' },
    { icon: <CreditCard size={18} color="#fff" />, label: 'Payments', color: '#0891b2', route: '/(college_admin)/payments' },
    { icon: <ShieldCheck size={18} color="#fff" />, label: 'Subscription', color: '#7c3aed', route: '/(college_admin)/subscription' },
    { icon: <BarChart3 size={18} color="#fff" />, label: 'Reports', color: '#047857', route: '/(college_admin)/reports' },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <LinearGradient colors={['#047857', '#059669']} style={styles.hero}>
            <Text style={styles.role}>{user?.role === 'super_admin' ? 'Super Admin' : 'College Admin'}</Text>
            <Text style={styles.name}>{user?.name}</Text>
            {analytics && (
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{analytics.student_faculty_ratio || '—'}:1</Text>
                  <Text style={styles.heroStatLbl}>Student-Faculty Ratio</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{analytics.attendance_rate || 0}%</Text>
                  <Text style={styles.heroStatLbl}>Overall Attendance</Text>
                </View>
              </View>
            )}
          </LinearGradient>

          <Pressable
            testID="announce-btn"
            accessibilityLabel="Send announcement"
            style={styles.announceBtn}
            onPress={() => { setAnnErr(''); setAnnSuccess(false); setAnnVisible(true); }}
          >
            <Megaphone color="#fff" size={18} />
            <Text style={styles.announceTxt}>Send Announcement</Text>
          </Pressable>

          <SectionTitle title="System Metrics" />
          <View style={styles.grid}>
            {stats.map((c, i) => (
              <View key={i} style={styles.metricCard}>
                <LinearGradient colors={[c.color, c.color + 'cc']} style={styles.metricIcon}>{c.icon}</LinearGradient>
                <Text style={styles.metricVal}>{c.value}</Text>
                <Text style={styles.metricLbl}>{c.label}</Text>
              </View>
            ))}
          </View>

          <SectionTitle title="Quick Links" />
          <View style={styles.linkGrid}>
            {quickLinks.map(l => (
              <Pressable
                key={l.label}
                testID={`quick-link-${l.label.toLowerCase()}`}
                accessibilityLabel={l.label}
                onPress={() => router.push(l.route as any)}
                style={styles.linkCard}
              >
                <LinearGradient colors={[l.color, l.color + 'aa']} style={styles.linkIcon}>{l.icon}</LinearGradient>
                <Text style={styles.linkLabel}>{l.label}</Text>
              </Pressable>
            ))}
          </View>

          <SectionTitle title="Recent Announcements" />
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            {annLoading ? (
              <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 20 }} />
            ) : announcements.length === 0 ? (
              <EmptyState title="No announcements" sub="Create one to notify everyone on campus" />
            ) : (
              announcements.slice(0, 5).map(a => (
                <Card key={a.id} style={{ marginBottom: 10 }}>
                  <Text style={styles.annTitle}>{a.title}</Text>
                  <Text style={styles.annBody} numberOfLines={2}>{a.body}</Text>
                  <View style={styles.annMeta}>
                    <Text style={styles.annMetaTxt}>{a.audience}</Text>
                    <Text style={styles.annMetaTxt}>{new Date(a.created_at).toLocaleDateString()}</Text>
                  </View>
                </Card>
              ))
            )}
          </View>
        </ScrollView>

        <Modal visible={annVisible} transparent animationType="slide" onRequestClose={() => setAnnVisible(false)}>
          <View style={styles.mBackdrop}>
            <View style={styles.mSheet}>
              <View style={styles.mHeader}>
                <Text style={styles.mTitle}>New Announcement</Text>
                <Pressable testID="announce-close" accessibilityLabel="Close announcement form" onPress={() => setAnnVisible(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <TextInput
                testID="announce-title"
                value={annTitle}
                onChangeText={setAnnTitle}
                placeholder="Title"
                placeholderTextColor={theme.colors.muted}
                style={styles.mInput}
                accessibilityLabel="Announcement title"
              />
              <TextInput
                testID="announce-body"
                value={annBody}
                onChangeText={setAnnBody}
                placeholder="Write your message to everyone..."
                placeholderTextColor={theme.colors.muted}
                style={[styles.mInput, { height: 100, textAlignVertical: 'top' }]}
                multiline
                accessibilityLabel="Announcement message"
              />
              {annErr ? <Text style={styles.mErr}>{annErr}</Text> : null}
              {annSuccess ? <Text style={styles.mSuccess}>Announcement sent!</Text> : null}
              <GradientButton
                label={annBusy ? 'Sending...' : 'Broadcast to Everyone'}
                onPress={submitAnnouncement}
                loading={annBusy}
                style={{ marginTop: theme.spacing.md }}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { padding: theme.spacing.xl, margin: theme.spacing.lg, borderRadius: theme.radius.lg, ...theme.shadow.lg },
  role: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 4 },
  heroStats: { flexDirection: 'row', marginTop: theme.spacing.lg, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: theme.radius.md, padding: theme.spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroStatLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  announceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brandPrimary, marginHorizontal: theme.spacing.lg, paddingVertical: 14, borderRadius: theme.radius.md, ...theme.shadow.md },
  announceTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.lg, gap: 10 },
  metricCard: { width: '31%', backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'flex-start', ...theme.shadow.sm },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricVal: { fontSize: 22, fontWeight: '800', color: theme.colors.onSurface, marginTop: 8 },
  metricLbl: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
  linkGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.lg, gap: 10 },
  linkCard: { width: '23%', alignItems: 'center', gap: 6 },
  linkIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...theme.shadow.sm },
  linkLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.onSurface, textAlign: 'center' },
  annTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  annBody: { fontSize: 13, color: theme.colors.muted, marginTop: 4, lineHeight: 18 },
  annMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  annMetaTxt: { fontSize: 11, color: theme.colors.muted },
  mBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  mSheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, paddingBottom: 40 },
  mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  mTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  mInput: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 14, fontSize: 15, color: theme.colors.onSurface, marginTop: 10 },
  mErr: { color: theme.colors.error, marginTop: 8, fontSize: 12 },
  mSuccess: { color: theme.colors.success, marginTop: 8, fontSize: 13, fontWeight: '700' },
  lockHero: { padding: theme.spacing.xl, borderRadius: theme.radius.lg, gap: 10, ...theme.shadow.lg },
  lockTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  lockSub: { fontSize: 14, lineHeight: 22, color: 'rgba(255,255,255,0.82)' },
  lockList: { gap: 10, paddingHorizontal: theme.spacing.lg },
  lockItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md },
  lockItemText: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600' },
});
