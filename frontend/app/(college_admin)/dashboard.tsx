import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from '@/src/navigation/router';
import {
  GraduationCap, UserCheck, BookOpen, Wallet, Megaphone, X,
  Users, Building, Library, Home, BarChart3, MessageSquare, Bus, Bell,
  CreditCard, ShieldCheck, TrendingUp, TrendingDown, Clock, Activity,
  Zap, Target, ArrowRight, Star, Calendar, AlertTriangle, CheckCircle,
  Eye, ChevronRight, Send, MapPin,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { AdminDashboardData, Announcement } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { StatCard, Card, SectionTitle, GradientButton, EmptyState, DashboardSkeleton, ProgressBar, ProgressRing } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: dash, loading: dashLoading, refresh: refreshDash } = useFetch<AdminDashboardData>('/dashboard/admin');
  const { data: analytics, loading: anaLoading, refresh: refreshAna } = useFetch<any>('/analytics/admin');
  const { data: announcements = [], loading: annLoading, refresh: refreshAnn } = useFetch<Announcement[]>('/announcements');
  const { data: subscription, loading: subLoading, refresh: refreshSub } = useFetch<any>('/subscription/current');
  const { data: notifications = [] } = useFetch<any[]>('/notifications');
  const { data: attendanceData } = useFetch<any>('/attendance/daily');
  const { data: schedules = [] } = useFetch<any[]>('/admin/schedules');
  const { mutate: sendAnnouncement, loading: annBusy } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [annVisible, setAnnVisible] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annAudience, setAnnAudience] = useState('all');
  const [annErr, setAnnErr] = useState('');
  const [annSuccess, setAnnSuccess] = useState(false);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const loading = dashLoading || anaLoading || (subLoading && !subscription);
  const subscriptionActive = subscription?.active !== false || user?.role === 'super_admin';
  const unreadNotifs = (notifications as any[]).filter((n: any) => !n.read).length;

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
        body: JSON.stringify({ title: annTitle.trim(), body: annBody.trim(), audience: annAudience }),
      });
      setAnnSuccess(true);
      setAnnTitle('');
      setAnnBody('');
      setAnnAudience('all');
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
    { icon: <Home size={18} color="#fff" />, label: 'Hostel', color: '#065F46', route: '/(college_admin)/hostel-admin' },
    { icon: <Bus size={18} color="#fff" />, label: 'Transport', color: '#0F766E', route: '/transport' },
    { icon: <MessageSquare size={18} color="#fff" />, label: 'Grievances', color: '#059669', route: '/grievances' },
    { icon: <CreditCard size={18} color="#fff" />, label: 'Payments', color: '#0891b2', route: '/(college_admin)/payments' },
    { icon: <ShieldCheck size={18} color="#fff" />, label: 'Subscription', color: '#7c3aed', route: '/(college_admin)/subscription' },
    { icon: <BarChart3 size={18} color="#fff" />, label: 'Reports', color: '#047857', route: '/(college_admin)/reports' },
    { icon: <Activity size={18} color="#fff" />, label: 'Attendance', color: '#EF4444', route: '/(college_admin)/attendance' },
    { icon: <Bell size={18} color="#fff" />, label: 'Notifications', color: '#8B5CF6', route: '/notifications' },
    { icon: <MapPin size={18} color="#fff" />, label: 'Campus', color: '#0891b2', route: '/grievances' },
  ];

  const visibleLinks = showAllLinks ? quickLinks : quickLinks.slice(0, 8);

  const todayStats = attendanceData ? {
    present: attendanceData.present || 0,
    absent: attendanceData.absent || 0,
    total: (attendanceData.present || 0) + (attendanceData.absent || 0),
  } : null;

  const liveScheduleCount = (schedules as any[]).filter((s: any) => {
    if (!s.day) return false;
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return s.day.toLowerCase() === days[new Date().getDay()];
  }).length;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {/* Hero Section */}
          <LinearGradient colors={['#047857', '#059669']} style={styles.hero}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={styles.role}>{user?.role === 'super_admin' ? 'Super Admin' : 'College Admin'}</Text>
                <Text style={styles.name}>{user?.name}</Text>
              </View>
              <Pressable
                onPress={() => setShowNotifPanel(true)}
                style={styles.notifBadge}
              >
                <Bell color="#fff" size={20} />
                {unreadNotifs > 0 && (
                  <View style={styles.notifCount}>
                    <Text style={styles.notifCountTxt}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
                  </View>
                )}
              </Pressable>
            </View>
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
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatVal}>{liveScheduleCount}</Text>
                  <Text style={styles.heroStatLbl}>Today's Classes</Text>
                </View>
              </View>
            )}
          </LinearGradient>

          {/* Quick Stats Row */}
          {todayStats && (
            <View style={styles.quickStatsRow}>
              <View style={styles.quickStat}>
                <CheckCircle size={16} color="#10B981" />
                <Text style={styles.quickStatVal}>{todayStats.present}</Text>
                <Text style={styles.quickStatLabel}>Present</Text>
              </View>
              <View style={styles.quickStat}>
                <AlertTriangle size={16} color="#EF4444" />
                <Text style={[styles.quickStatVal, { color: '#EF4444' }]}>{todayStats.absent}</Text>
                <Text style={styles.quickStatLabel}>Absent</Text>
              </View>
              <View style={styles.quickStat}>
                <Clock size={16} color="#F59E0B" />
                <Text style={[styles.quickStatVal, { color: '#F59E0B' }]}>{liveScheduleCount}</Text>
                <Text style={styles.quickStatLabel}>Classes</Text>
              </View>
              <View style={styles.quickStat}>
                <Activity size={16} color="#3B82F6" />
                <Text style={[styles.quickStatVal, { color: '#3B82F6' }]}>{dash?.courses || 0}</Text>
                <Text style={styles.quickStatLabel}>Courses</Text>
              </View>
            </View>
          )}

          {/* Announcement Button */}
          <Pressable
            testID="announce-btn"
            accessibilityLabel="Send announcement"
            style={styles.announceBtn}
            onPress={() => { setAnnErr(''); setAnnSuccess(false); setAnnVisible(true); }}
          >
            <Megaphone color="#fff" size={18} />
            <Text style={styles.announceTxt}>Send Announcement</Text>
            <Send color="rgba(255,255,255,0.6)" size={14} />
          </Pressable>

          {/* System Metrics */}
          <SectionTitle title="System Metrics" />
          <View style={styles.grid}>
            {stats.map((c, i) => (
              <Pressable
                key={i}
                style={styles.metricCard}
                onPress={() => {
                  if (c.label === 'Students' || c.label === 'Faculty') router.push('/(college_admin)/users');
                  else if (c.label === 'Courses') router.push('/(college_admin)/academics');
                  else if (c.label === 'Fees Due') router.push('/(college_admin)/payments');
                  else if (c.label === 'Hostel') router.push('/(college_admin)/hostel-admin');
                }}
              >
                <LinearGradient colors={[c.color, c.color + 'cc']} style={styles.metricIcon}>{c.icon}</LinearGradient>
                <Text style={styles.metricVal}>{c.value}</Text>
                <Text style={styles.metricLbl}>{c.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Attendance Progress */}
          {analytics && (
            <>
              <SectionTitle title="Performance Overview" />
              <View style={styles.perfRow}>
                <Card style={styles.perfCard}>
                  <ProgressRing
                    percentage={analytics.attendance_rate || 0}
                    size={70}
                    label="Attendance"
                    sub={`${analytics.attendance_rate || 0}% overall`}
                  />
                </Card>
                <Card style={styles.perfCard}>
                  <ProgressBar
                    value={dash?.pending_fees || 0}
                    max={Math.max(dash?.pending_fees || 0, 100)}
                    label="Fee Collection"
                    showPct
                  />
                  <Text style={styles.perfNote}>{dash?.pending_fees || 0} pending</Text>
                </Card>
              </View>
            </>
          )}

          {/* Quick Links */}
          <SectionTitle title="Quick Links" actionLabel={showAllLinks ? 'Show less' : 'Show all'} action={() => setShowAllLinks(!showAllLinks)} />
          <View style={styles.linkGrid}>
            {visibleLinks.map(l => (
              <Pressable
                key={l.label}
                testID={`quick-link-${l.label.toLowerCase()}`}
                accessibilityLabel={l.label}
                onPress={() => router.push(l.route as any)}
                style={styles.linkCard}
              >
                <LinearGradient colors={[l.color, l.color + 'aa']} style={styles.linkIcon}>{l.icon}</LinearGradient>
                <Text style={styles.linkLabel} numberOfLines={1}>{l.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Recent Announcements */}
          <SectionTitle title="Recent Announcements" actionLabel="View all" action={() => {}} />
          <View style={{ paddingHorizontal: theme.spacing.lg }}>
            {annLoading ? (
              <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 20 }} />
            ) : announcements.length === 0 ? (
              <EmptyState title="No announcements" sub="Create one to notify everyone on campus" />
            ) : (
              announcements.slice(0, 3).map(a => (
                <Card key={a.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.annTitle}>{a.title}</Text>
                      <Text style={styles.annBody} numberOfLines={2}>{a.body}</Text>
                    </View>
                    <View style={styles.annBadge}>
                      <Text style={styles.annBadgeTxt}>{a.audience}</Text>
                    </View>
                  </View>
                  <View style={styles.annMeta}>
                    <Text style={styles.annMetaTxt}>{new Date(a.created_at).toLocaleDateString()}</Text>
                    <Pressable onPress={() => {}}>
                      <Text style={styles.annMetaAction}>Read more</Text>
                    </Pressable>
                  </View>
                </Card>
              ))
            )}
          </View>

          {/* System Health */}
          <SectionTitle title="System Health" />
          <Card style={{ marginHorizontal: theme.spacing.lg, marginBottom: 10 }}>
            <View style={styles.healthRow}>
              <View style={styles.healthItem}>
                <View style={[styles.healthDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.healthLabel}>API Status</Text>
                <Text style={[styles.healthVal, { color: '#10B981' }]}>Online</Text>
              </View>
              <View style={styles.healthItem}>
                <View style={[styles.healthDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.healthLabel}>Database</Text>
                <Text style={[styles.healthVal, { color: '#10B981' }]}>Connected</Text>
              </View>
              <View style={styles.healthItem}>
                <View style={[styles.healthDot, { backgroundColor: subscription?.active ? '#10B981' : '#F59E0B' }]} />
                <Text style={styles.healthLabel}>Subscription</Text>
                <Text style={[styles.healthVal, { color: subscription?.active ? '#10B981' : '#F59E0B' }]}>
                  {subscription?.active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </Card>
        </ScrollView>

        {/* Announcement Modal */}
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
              <Text style={styles.mLabel}>Audience</Text>
              <View style={styles.audienceRow}>
                {['all', 'students', 'faculty', 'parents'].map(a => (
                  <Pressable
                    key={a}
                    onPress={() => setAnnAudience(a)}
                    style={[styles.audienceBtn, annAudience === a && styles.audienceBtnActive]}
                  >
                    <Text style={[styles.audienceBtnTxt, annAudience === a && styles.audienceBtnTxtActive]}>
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
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

        {/* Notification Panel */}
        <Modal visible={showNotifPanel} transparent animationType="slide" onRequestClose={() => setShowNotifPanel(false)}>
          <View style={styles.mBackdrop}>
            <View style={styles.mSheet}>
              <View style={styles.mHeader}>
                <Text style={styles.mTitle}>Notifications</Text>
                <Pressable onPress={() => setShowNotifPanel(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 400 }}>
                {(notifications as any[]).length === 0 ? (
                  <EmptyState title="No notifications" sub="You're all caught up!" />
                ) : (
                  (notifications as any[]).slice(0, 10).map((n: any) => (
                    <View key={n.id} style={[styles.notifItem, !n.read && styles.notifItemUnread]}>
                      <View style={[styles.notifDot, { backgroundColor: n.read ? theme.colors.border : theme.colors.brandPrimary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notifTitle} numberOfLines={1}>{n.title}</Text>
                        <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                        <Text style={styles.notifTime}>{new Date(n.created_at).toLocaleDateString()}</Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
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
  notifBadge: { position: 'relative', width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  notifCount: { position: 'absolute', top: -2, right: -2, backgroundColor: '#EF4444', minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  notifCountTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heroStats: { flexDirection: 'row', marginTop: theme.spacing.lg, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: theme.radius.md, padding: theme.spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroStatLbl: { color: 'rgba(255,255,255,0.7)', fontSize: 9, marginTop: 2 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  quickStatsRow: { flexDirection: 'row', marginHorizontal: theme.spacing.lg, gap: 8, marginBottom: theme.spacing.md },
  quickStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.surfaceSecondary, padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  quickStatVal: { fontSize: 16, fontWeight: '800', color: '#10B981' },
  quickStatLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600' },
  announceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brandPrimary, marginHorizontal: theme.spacing.lg, paddingVertical: 14, borderRadius: theme.radius.md, ...theme.shadow.md },
  announceTxt: { color: '#fff', fontWeight: '700', fontSize: 14, flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.lg, gap: 8 },
  metricCard: { flexBasis: '30%', flexGrow: 1, flexShrink: 1, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'flex-start', ...theme.shadow.sm },
  metricIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricVal: { fontSize: 22, fontWeight: '800', color: theme.colors.onSurface, marginTop: 8 },
  metricLbl: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
  perfRow: { flexDirection: 'row', gap: 12, paddingHorizontal: theme.spacing.lg },
  perfCard: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.lg },
  perfNote: { fontSize: 11, color: theme.colors.muted, marginTop: 8, fontWeight: '600' },
  linkGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: theme.spacing.lg, gap: 8 },
  linkCard: { flexBasis: '22%', flexGrow: 1, flexShrink: 1, alignItems: 'center', gap: 6 },
  linkIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', ...theme.shadow.sm },
  linkLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.onSurface, textAlign: 'center' },
  annTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  annBody: { fontSize: 13, color: theme.colors.muted, marginTop: 4, lineHeight: 18 },
  annBadge: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, marginLeft: 8 },
  annBadgeTxt: { fontSize: 10, fontWeight: '700', color: theme.colors.brand, textTransform: 'capitalize' },
  annMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  annMetaTxt: { fontSize: 11, color: theme.colors.muted },
  annMetaAction: { fontSize: 11, color: theme.colors.brandPrimary, fontWeight: '700' },
  healthRow: { flexDirection: 'row', justifyContent: 'space-around' },
  healthItem: { alignItems: 'center', gap: 4 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  healthVal: { fontSize: 12, fontWeight: '700' },
  mBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  mSheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, paddingBottom: 40, maxHeight: '85%' },
  mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  mTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  mInput: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 14, fontSize: 15, color: theme.colors.onSurface, marginTop: 10 },
  mLabel: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  audienceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  audienceBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  audienceBtnActive: { backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brandPrimary },
  audienceBtnTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  audienceBtnTxtActive: { color: theme.colors.brand },
  mErr: { color: theme.colors.error, marginTop: 8, fontSize: 12 },
  mSuccess: { color: theme.colors.success, marginTop: 8, fontSize: 13, fontWeight: '700' },
  notifItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  notifItemUnread: { backgroundColor: theme.colors.brandTertiary + '20', marginHorizontal: -theme.spacing.xl, paddingHorizontal: theme.spacing.xl },
  notifDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  notifBody: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  notifTime: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
  lockHero: { padding: theme.spacing.xl, borderRadius: theme.radius.lg, gap: 10, ...theme.shadow.lg },
  lockTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  lockSub: { fontSize: 14, lineHeight: 22, color: 'rgba(255,255,255,0.82)' },
  lockList: { gap: 10, paddingHorizontal: theme.spacing.lg },
  lockItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md },
  lockItemText: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600' },
});
