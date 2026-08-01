import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, TextInput,
  RefreshControl, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { subscribeRealtime } from '@/src/realtime/socket';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { router } from '@/src/navigation/router';
import type { Notification } from '@/src/types';
import {
  ArrowLeft, Bell, BellOff, BellRing, CheckCheck, Clock, AlertTriangle,
  GraduationCap, CreditCard, Calendar, BookOpen, ChevronRight,
  Star, Settings, Search, X, CheckCircle2,
  Smartphone, Mail, MessageCircle,
  Award, Home,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';

interface EnrichedNotification extends Notification {
  _isRead: boolean;
  _isStarred: boolean;
  _category: string;
  _priority: 'high' | 'medium' | 'low';
}

interface Prefs {
  push: boolean;
  email: boolean;
  whatsapp: boolean;
  attendance: boolean;
  fees: boolean;
  exams: boolean;
  events: boolean;
  assignments: boolean;
}

const CATEGORY_MAP: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  attendance: { color: '#EF4444', icon: <GraduationCap size={14} color="#EF4444" />, label: 'Attendance' },
  fee: { color: '#F59E0B', icon: <CreditCard size={14} color="#F59E0B" />, label: 'Fees' },
  exam: { color: '#6366F1', icon: <BookOpen size={14} color="#6366F1" />, label: 'Exams' },
  event: { color: '#10B981', icon: <Calendar size={14} color="#10B981" />, label: 'Events' },
  assignment: { color: '#8B5CF6', icon: <Award size={14} color="#8B5CF6" />, label: 'Assignments' },
  library: { color: '#06B6D4', icon: <BookOpen size={14} color="#06B6D4" />, label: 'Library' },
  hostel: { color: '#EC4899', icon: <Home size={14} color="#EC4899" />, label: 'Hostel' },
  general: { color: '#64748B', icon: <Bell size={14} color="#64748B" />, label: 'General' },
};

function detectCategory(title: string, body: string): string {
  const text = `${title} ${body}`.toLowerCase();
  if (text.includes('attendance') || text.includes('absent')) return 'attendance';
  if (text.includes('fee') || text.includes('payment') || text.includes('tuition')) return 'fee';
  if (text.includes('exam') || text.includes('result') || text.includes('mid-term')) return 'exam';
  if (text.includes('event') || text.includes('fest') || text.includes('meeting')) return 'event';
  if (text.includes('assignment') || text.includes('homework') || text.includes('submit')) return 'assignment';
  if (text.includes('library') || text.includes('book') || text.includes('borrow')) return 'library';
  if (text.includes('hostel') || text.includes('block') || text.includes('maintenance')) return 'hostel';
  return 'general';
}

function getPriority(title: string, body: string): 'high' | 'medium' | 'low' {
  const text = `${title} ${body}`.toLowerCase();
  if (text.includes('urgent') || text.includes('immediate') || text.includes('overdue') || text.includes('dropped')) return 'high';
  if (text.includes('reminder') || text.includes('due') || text.includes('scheduled')) return 'medium';
  return 'low';
}

function groupByDate(items: EnrichedNotification[]): { title: string; data: EnrichedNotification[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

  const groups: Record<string, EnrichedNotification[]> = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Earlier': [] };

  items.forEach(n => {
    const d = new Date(n.created_at);
    if (d >= today) groups['Today'].push(n);
    else if (d >= yesterday) groups['Yesterday'].push(n);
    else if (d >= weekAgo) groups['This Week'].push(n);
    else groups['Earlier'].push(n);
  });

  return Object.entries(groups)
    .filter(([, data]) => data.length > 0)
    .map(([title, data]) => ({ title, data }));
}

function formatTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { data: rawNotifications, loading, refresh } = useFetch<Notification[]>('/notifications');
  const { mutate: markReadMutate } = useMutate<any>();
  const { mutate: markAllReadMutate } = useMutate<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showPrefs, setShowPrefs] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<EnrichedNotification | null>(null);
  const [readState, setReadState] = useState<Record<string, boolean>>({});
  const [starredState, setStarredState] = useState<Record<string, boolean>>({});

  const [prefs, setPrefs] = useState<Prefs>({
    push: true, email: true, whatsapp: false,
    attendance: true, fees: true, exams: true, events: true, assignments: true,
  });

  useEffect(() => {
    const unsub = subscribeRealtime('notifications:update', () => refresh());
    return unsub;
  }, [refresh]);

  const notifications = useMemo(() => {
    return (rawNotifications || []).map(n => ({
      ...n,
      _isRead: readState[n.id] ?? n.read ?? (n.read_by || []).includes(user?.id || ''),
      _isStarred: starredState[n.id] ?? false,
      _category: detectCategory(n.title, n.body),
      _priority: getPriority(n.title, n.body),
    }));
  }, [rawNotifications, readState, starredState, user?.id]);

  const unreadCount = notifications.filter(n => !n._isRead).length;

  const filtered = useMemo(() => {
    let result = notifications;
    if (categoryFilter === 'unread') result = result.filter(n => !n._isRead);
    else if (categoryFilter === 'starred') result = result.filter(n => n._isStarred);
    else if (categoryFilter !== 'all') result = result.filter(n => n._category === categoryFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notifications, categoryFilter, search]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.length, unread: unreadCount, starred: notifications.filter(n => n._isStarred).length };
    notifications.forEach(n => { counts[n._category] = (counts[n._category] || 0) + 1; });
    return counts;
  }, [notifications, unreadCount]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [refresh]);

  const handleMarkRead = async (id: string) => {
    setReadState(prev => ({ ...prev, [id]: true }));
    try { await markReadMutate(`/notifications/${id}/read`, { method: 'POST' }); } catch {}
  };

  const handleMarkAllRead = async () => {
    const updates: Record<string, boolean> = {};
    notifications.forEach(n => { if (!n._isRead) updates[n.id] = true; });
    setReadState(prev => ({ ...prev, ...updates }));
    try { await markAllReadMutate('/notifications/read-all', { method: 'POST' }); } catch {}
  };

  const toggleStar = (id: string) => {
    setStarredState(prev => ({ ...prev, [id]: !(prev[id] ?? false) }));
  };

  const openDetail = (n: EnrichedNotification) => {
    setSelectedNotif(n);
    setShowDetail(true);
    if (!n._isRead) handleMarkRead(n.id);
  };

  const getCatInfo = (cat: string) => CATEGORY_MAP[cat] || CATEGORY_MAP.general;

  const FILTER_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'starred', label: 'Starred' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'fee', label: 'Fees' },
    { key: 'exam', label: 'Exams' },
    { key: 'event', label: 'Events' },
    { key: 'assignment', label: 'Tasks' },
    { key: 'library', label: 'Library' },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={20} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeTxt}>{unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={handleMarkAllRead} style={styles.headerBtn} accessibilityLabel="Mark all read">
              <CheckCheck size={18} color={theme.colors.brandPrimary} />
            </Pressable>
            <Pressable onPress={() => setShowPrefs(true)} style={styles.headerBtn} accessibilityLabel="Settings">
              <Settings size={18} color={theme.colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Search size={16} color={theme.colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notifications..."
            placeholderTextColor={theme.colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <X size={14} color={theme.colors.muted} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {FILTER_CHIPS.map(c => {
            const active = categoryFilter === c.key;
            const count = categoryCounts[c.key] || 0;
            return (
              <Pressable
                key={c.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategoryFilter(c.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.chipCount, active && styles.chipCountActive]}>
                    <Text style={[styles.chipCountTxt, active && styles.chipCountTxtActive]}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          {loading && !refreshing ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingTxt}>Loading notifications...</Text>
            </View>
          ) : grouped.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconWrap}>
                <BellOff size={40} color={theme.colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>{search ? 'No results' : 'All caught up!'}</Text>
              <Text style={styles.emptySub}>
                {search ? 'Try a different search term' : 'No notifications to show'}
              </Text>
            </View>
          ) : (
            grouped.map(group => (
              <View key={group.title} style={styles.groupSection}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupCount}>{group.data.length}</Text>
                </View>
                {group.data.map((n, idx) => {
                  const catInfo = getCatInfo(n._category || 'general');
                  const isHigh = n._priority === 'high';
                  return (
                    <Animated.View key={n.id} entering={SlideInRight.delay(idx * 30)}>
                      <Pressable
                        style={[
                          styles.notifCard,
                          !n._isRead && styles.notifUnread,
                        ]}
                        onPress={() => openDetail(n)}
                      >
                        <View style={styles.notifLeft}>
                          <View style={[styles.catIconWrap, { backgroundColor: catInfo.color + '15' }]}>
                            {catInfo.icon}
                          </View>
                          <View style={styles.notifLine} />
                        </View>
                        <View style={styles.notifContent}>
                          <View style={styles.notifTop}>
                            <View style={styles.notifTitleRow}>
                              {isHigh && <View style={styles.highDot} />}
                              <Text
                                style={[styles.notifTitle, !n._isRead && styles.notifTitleUnread]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {n.title}
                              </Text>
                            </View>
                            <Pressable onPress={() => toggleStar(n.id)} hitSlop={8}>
                              <Star
                                size={14}
                                color={n._isStarred ? '#F59E0B' : theme.colors.border}
                                fill={n._isStarred ? '#F59E0B' : 'transparent'}
                              />
                            </Pressable>
                          </View>
                          <Text style={styles.notifBody} numberOfLines={2} ellipsizeMode="tail">
                            {n.body}
                          </Text>
                          <View style={styles.notifMeta}>
                            <View style={[styles.metaTag, { backgroundColor: catInfo.color + '12' }]}>
                              {catInfo.icon}
                              <Text style={[styles.metaTagTxt, { color: catInfo.color }]}>{catInfo.label}</Text>
                            </View>
                            <View style={styles.metaDot} />
                            <Clock size={10} color={theme.colors.muted} />
                            <Text style={styles.metaTime}>{formatTime(n.created_at)}</Text>
                          </View>
                        </View>
                        {!n._isRead && <View style={styles.unreadDot} />}
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>

        <Modal visible={showPrefs} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Animated.View entering={FadeInUp} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notification Settings</Text>
                <Pressable onPress={() => setShowPrefs(false)} hitSlop={8}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>
                <Text style={styles.prefSectionTitle}>Delivery Channels</Text>
                {([
                  { key: 'push', label: 'Push Notifications', desc: 'Receive on your phone', icon: <Smartphone size={16} color={theme.colors.brandPrimary} /> },
                  { key: 'email', label: 'Email Alerts', desc: 'Sent to registered email', icon: <Mail size={16} color="#F59E0B" /> },
                  { key: 'whatsapp', label: 'WhatsApp Messages', desc: 'Receive on WhatsApp', icon: <MessageCircle size={16} color="#10B981" /> },
                ] as const).map(item => (
                  <View key={item.key} style={styles.prefRow}>
                    <View style={styles.prefRowLeft}>
                      <View style={styles.prefIconWrap}>{item.icon}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.prefLabel}>{item.label}</Text>
                        <Text style={styles.prefDesc}>{item.desc}</Text>
                      </View>
                    </View>
                    <Switch
                      value={prefs[item.key]}
                      onValueChange={v => setPrefs(p => ({ ...p, [item.key]: v }))}
                      trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}

                <Text style={styles.prefSectionTitle}>Categories</Text>
                {([
                  { key: 'attendance', label: 'Attendance Alerts', desc: 'Below 75% threshold', icon: <GraduationCap size={16} color="#EF4444" /> },
                  { key: 'fees', label: 'Fee Reminders', desc: 'Before due dates', icon: <CreditCard size={16} color="#F59E0B" /> },
                  { key: 'exams', label: 'Exam Updates', desc: 'Results & schedules', icon: <BookOpen size={16} color="#6366F1" /> },
                  { key: 'events', label: 'Campus Events', desc: 'Meetings & activities', icon: <Calendar size={16} color="#10B981" /> },
                  { key: 'assignments', label: 'Assignments', desc: 'Due dates & submissions', icon: <Award size={16} color="#8B5CF6" /> },
                ] as const).map(item => (
                  <View key={item.key} style={styles.prefRow}>
                    <View style={styles.prefRowLeft}>
                      <View style={styles.prefIconWrap}>{item.icon}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.prefLabel}>{item.label}</Text>
                        <Text style={styles.prefDesc}>{item.desc}</Text>
                      </View>
                    </View>
                    <Switch
                      value={prefs[item.key as keyof Prefs]}
                      onValueChange={v => setPrefs(p => ({ ...p, [item.key]: v }))}
                      trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </ScrollView>

              <Pressable onPress={() => setShowPrefs(false)} style={styles.prefDoneBtn}>
                <Text style={styles.prefDoneTxt}>Done</Text>
              </Pressable>
            </Animated.View>
          </View>
        </Modal>

        <Modal visible={showDetail} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Animated.View entering={FadeInDown} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notification</Text>
                <Pressable onPress={() => { setShowDetail(false); setSelectedNotif(null); }} hitSlop={8}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>

              {selectedNotif && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {(() => {
                    const catInfo = getCatInfo(selectedNotif._category || 'general');
                    return (
                      <View style={[styles.detailCatBadge, { backgroundColor: catInfo.color + '12' }]}>
                        {catInfo.icon}
                        <Text style={[styles.detailCatTxt, { color: catInfo.color }]}>{catInfo.label}</Text>
                        {selectedNotif._priority === 'high' && (
                          <View style={styles.detailHighBadge}>
                            <AlertTriangle size={10} color="#EF4444" />
                            <Text style={styles.detailHighTxt}>Urgent</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  <Text style={styles.detailTitle}>{selectedNotif.title}</Text>

                  <View style={styles.detailMeta}>
                    <Clock size={12} color={theme.colors.muted} />
                    <Text style={styles.detailTime}>{new Date(selectedNotif.created_at).toLocaleString()}</Text>
                  </View>

                  <Text style={styles.detailBody}>{selectedNotif.body}</Text>

                  <View style={styles.detailActions}>
                    <Pressable
                      style={styles.detailActionBtn}
                      onPress={() => { toggleStar(selectedNotif.id); }}
                    >
                      <Star size={16} color={selectedNotif._isStarred ? '#F59E0B' : theme.colors.muted} fill={selectedNotif._isStarred ? '#F59E0B' : 'transparent'} />
                      <Text style={styles.detailActionTxt}>{selectedNotif._isStarred ? 'Starred' : 'Star'}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.detailActionBtn}
                      onPress={() => { handleMarkRead(selectedNotif.id); }}
                    >
                      <CheckCircle2 size={16} color={theme.colors.brandPrimary} />
                      <Text style={styles.detailActionTxt}>{selectedNotif._isRead ? 'Read' : 'Mark Read'}</Text>
                    </Pressable>
                  </View>
                </ScrollView>
              )}
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  unreadBadge: { backgroundColor: theme.colors.brandPrimary, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBadgeTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceTertiary },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.text, padding: 0 },

  chipScroll: { paddingHorizontal: 16, paddingBottom: 10, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  chipTextActive: { color: '#FFF' },
  chipCount: { backgroundColor: theme.colors.surfaceTertiary, borderRadius: 8, minWidth: 18, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipCountTxt: { fontSize: 9, fontWeight: '700', color: theme.colors.muted },
  chipCountTxtActive: { color: '#FFF' },

  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  loadingWrap: { paddingVertical: 40, alignItems: 'center' },
  loadingTxt: { fontSize: 13, color: theme.colors.muted },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptySub: { fontSize: 12, color: theme.colors.muted },

  groupSection: { marginBottom: 16 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  groupCount: { fontSize: 11, fontWeight: '600', color: theme.colors.muted, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },

  notifCard: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'flex-start' },
  notifUnread: { backgroundColor: theme.colors.brandPrimary + '08', borderLeftWidth: 3, borderLeftColor: theme.colors.brandPrimary },

  notifLeft: { alignItems: 'center', marginRight: 10, paddingTop: 2 },
  catIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  notifLine: { width: 1, flex: 1, backgroundColor: theme.colors.border, marginTop: 4, minHeight: 8 },

  notifContent: { flex: 1, minWidth: 0 },
  notifTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  highDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', flexShrink: 0 },
  notifTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.text, flex: 1 },
  notifTitleUnread: { fontWeight: '800' },
  notifBody: { fontSize: 12, color: theme.colors.muted, lineHeight: 17, marginBottom: 6 },

  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  metaTagTxt: { fontSize: 10, fontWeight: '600' },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: theme.colors.border },
  metaTime: { fontSize: 10, color: theme.colors.muted },

  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brandPrimary, marginLeft: 8, marginTop: 4, flexShrink: 0 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },

  prefSectionTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  prefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  prefRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  prefIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  prefLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  prefDesc: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  prefDoneBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 10, backgroundColor: theme.colors.brandPrimary, alignItems: 'center' },
  prefDoneTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  detailCatBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  detailCatTxt: { fontSize: 12, fontWeight: '600' },
  detailHighBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(239,68,68,0.1)' },
  detailHighTxt: { fontSize: 10, fontWeight: '700', color: '#EF4444' },
  detailTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  detailTime: { fontSize: 12, color: theme.colors.muted },
  detailBody: { fontSize: 14, color: theme.colors.text, lineHeight: 22, marginBottom: 20 },
  detailActions: { flexDirection: 'row', gap: 10 },
  detailActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
  detailActionTxt: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
});
