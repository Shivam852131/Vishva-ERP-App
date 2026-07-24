import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, RefreshControl, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Bell, BellOff, BellRing, Check, CheckCheck, Clock, AlertTriangle,
  GraduationCap, CreditCard, Calendar, BookOpen, ChevronRight,
  Filter, Trash2, Archive, Star, Settings, Volume2, VolumeX,
  Smartphone, Mail, MessageCircle,
} from 'lucide-react-native';

type Notification = {
  id: string; title: string; body: string; time: string; read: boolean;
  category: string; priority: 'high' | 'medium' | 'low'; starred: boolean;
  source: string; actions?: string[];
};

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', title: 'Low Attendance Alert', body: 'Your child Rahul\'s Mathematics attendance has dropped to 68%. Immediate attention required.', time: '10 min ago', read: false, category: 'attendance', priority: 'high', starred: false, source: 'System', actions: ['View Details', 'Contact Faculty'] },
  { id: '2', title: 'Fee Payment Reminder', body: 'Semester 5 tuition fee of ₹45,000 is due by 30th Jan 2026. Late fee of ₹500 will apply after deadline.', time: '1 hour ago', read: false, category: 'fee', priority: 'high', starred: true, source: 'Finance Dept', actions: ['Pay Now', 'View Details'] },
  { id: '3', title: 'Mid-Term Results Published', body: 'Rahul scored 78% aggregate in mid-term exams. Top score: 92% in Computer Science.', time: '3 hours ago', read: false, category: 'exam', priority: 'medium', starred: false, source: 'Exam Cell', actions: ['View Report Card'] },
  { id: '4', title: 'Parent-Teacher Meeting', body: 'Scheduled for Feb 5, 2026 at 10:00 AM in Seminar Hall. Your child\'s progress will be discussed.', time: '5 hours ago', read: true, category: 'event', priority: 'medium', starred: false, source: 'Academic Office', actions: ['Confirm Attendance', 'Reschedule'] },
  { id: '5', title: 'Assignment Overdue', body: 'Data Structures assignment was due yesterday. Status: Not submitted. Please ensure timely submission.', time: '8 hours ago', read: true, category: 'assignment', priority: 'medium', starred: false, source: 'Faculty' },
  { id: '6', title: 'Library Book Due', body: 'Book "Introduction to Algorithms" is due for return on Jan 28. Fine of ₹10/day after due date.', time: '1 day ago', read: true, category: 'library', priority: 'low', starred: false, source: 'Library' },
  { id: '7', title: 'Hostel Maintenance Notice', body: 'Water supply in Block A will be suspended on Jan 25 from 10 AM to 12 PM for pipe maintenance.', time: '2 days ago', read: true, category: 'hostel', priority: 'low', starred: false, source: 'Hostel Warden' },
  { id: '8', title: 'Campus Event: Tech Fest', body: 'Annual tech fest "Innovision 2026" on Feb 12-13. Registration opens Feb 1. Encourage participation.', time: '3 days ago', read: true, category: 'event', priority: 'low', starred: false, source: 'Events Committee' },
];

const CATEGORIES = [
  { key: 'all', label: 'All', icon: Bell, count: 8 },
  { key: 'unread', label: 'Unread', icon: BellRing, count: 3 },
  { key: 'attendance', label: 'Attendance', icon: GraduationCap, count: 1 },
  { key: 'fee', label: 'Fees', icon: CreditCard, count: 1 },
  { key: 'exam', label: 'Exams', icon: BookOpen, count: 1 },
  { key: 'event', label: 'Events', icon: Calendar, count: 2 },
];

const CATEGORY_COLORS: Record<string, string> = {
  attendance: '#EF4444', fee: '#F59E0B', exam: '#4F46E5', event: '#10B981',
  assignment: '#8B5CF6', library: '#06B6D4', hostel: '#EC4899',
};

export default function ParentNotifications() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const filteredNotifications = notifications.filter(n => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'unread') return !n.read;
    return n.category === selectedCategory;
  });

  const toggleRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  };

  const toggleStar = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><Bell size={22} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>Parent Notifications</Text>
                  <Text style={styles.heroSub}>{unreadCount} unread notifications</Text>
                </View>
                <Pressable onPress={() => setShowSettings(!showSettings)} style={styles.settingsBtn}>
                  <Settings size={18} color="#fff" />
                </Pressable>
              </View>

              <View style={styles.actionBar}>
                <Pressable onPress={markAllRead} style={styles.actionChip}>
                  <CheckCheck size={14} color="#fff" /><Text style={styles.actionText}>Mark all read</Text>
                </Pressable>
                <View style={styles.deliveryRow}>
                  <View style={styles.deliveryBadge}><Smartphone size={12} color="#fff" /><Text style={styles.deliveryText}>Push</Text></View>
                  <View style={styles.deliveryBadge}><Mail size={12} color="#fff" /><Text style={styles.deliveryText}>Email</Text></View>
                  <View style={styles.deliveryBadge}><MessageCircle size={12} color="#fff" /><Text style={styles.deliveryText}>WhatsApp</Text></View>
                </View>
              </View>
            </LinearGradient>
          </View>

          {showSettings && (
            <Card style={styles.settingsCard}>
              <Text style={{ fontWeight: '700', color: theme.colors.text, marginBottom: 10 }}>Notification Preferences</Text>
              {[
                { label: 'Push Notifications', desc: 'Receive on phone', enabled: true },
                { label: 'Email Alerts', desc: 'Send to registered email', enabled: true },
                { label: 'WhatsApp Messages', desc: 'Receive on WhatsApp', enabled: false },
                { label: 'Attendance Alerts', desc: 'Below 75% threshold', enabled: true },
                { label: 'Fee Reminders', desc: 'Before due date', enabled: true },
              ].map((item, i) => (
                <View key={i} style={styles.settingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>{item.label}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.muted }}>{item.desc}</Text>
                  </View>
                  <Switch value={item.enabled} trackColor={{ false: '#E2E8F0', true: '#818CF8' }} thumbColor="#fff" />
                </View>
              ))}
            </Card>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.key;
              return (
                <Pressable key={cat.key} onPress={() => setSelectedCategory(cat.key)}
                  style={[styles.catChip, isActive && styles.catActive]}>
                  <Icon size={14} color={isActive ? '#fff' : theme.colors.muted} />
                  <Text style={[styles.catText, isActive && { color: '#fff' }]}>{cat.label}</Text>
                  {cat.count > 0 && (
                    <View style={[styles.catBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                      <Text style={[styles.catBadgeText, isActive && { color: '#fff' }]}>{cat.count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 10 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
          >
            {filteredNotifications.map(n => (
              <Pressable key={n.id} onPress={() => toggleRead(n.id)}>
                <Card style={[styles.notifCard, !n.read && styles.notifUnread, n.starred && styles.notifStarred]}>
                  <View style={styles.notifHeader}>
                    <View style={[styles.notifDot, { backgroundColor: CATEGORY_COLORS[n.category] || '#64748B' }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.notifTitle, !n.read && { fontWeight: '800' }]} numberOfLines={1}>{n.title}</Text>
                        {n.priority === 'high' && <View style={styles.priorityBadge}><AlertTriangle size={10} color="#EF4444" /></View>}
                      </View>
                      <Text style={styles.notifSource}>{n.source} · {n.time}</Text>
                    </View>
                    <Pressable onPress={() => toggleStar(n.id)}>
                      <Star size={16} color={n.starred ? '#F59E0B' : theme.colors.border} fill={n.starred ? '#F59E0B' : 'transparent'} />
                    </Pressable>
                  </View>
                  <Text style={styles.notifBody}>{n.body}</Text>
                  {n.actions && n.actions.length > 0 && (
                    <View style={styles.notifActions}>
                      {n.actions.map((action, i) => (
                        <Pressable key={i} style={[styles.actionBtn, i === 0 && styles.primaryAction]}>
                          <Text style={[styles.actionBtnText, i === 0 && { color: '#fff' }]}>{action}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <View style={styles.notifFooter}>
                    <Text style={styles.notifCategory}>{n.category}</Text>
                    {!n.read && <View style={styles.unreadDot} />}
                  </View>
                </Card>
              </Pressable>
            ))}

            {filteredNotifications.length === 0 && (
              <Card style={{ padding: 40, alignItems: 'center', gap: 8 }}>
                <BellOff size={40} color={theme.colors.muted} />
                <Text style={{ fontWeight: '700', color: theme.colors.text }}>No notifications</Text>
                <Text style={{ fontSize: 12, color: theme.colors.muted }}>All caught up!</Text>
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 10 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  deliveryRow: { flexDirection: 'row', gap: 6 },
  deliveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  deliveryText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  settingsCard: { marginHorizontal: 16, marginTop: 12, padding: 16 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  categoryScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  catActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  catText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  catBadge: { backgroundColor: theme.colors.surfaceTertiary, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  catBadgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.muted },
  notifCard: { padding: 14, gap: 8 },
  notifUnread: { backgroundColor: '#F8FAFC', borderLeftWidth: 3, borderLeftColor: theme.colors.brand },
  notifStarred: { borderColor: '#F59E0B30' },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifDot: { width: 8, height: 8, borderRadius: 4 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text, flex: 1 },
  notifSource: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  notifBody: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  notifActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  primaryAction: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  actionBtnText: { fontSize: 11, fontWeight: '600', color: theme.colors.text },
  notifFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  notifCategory: { fontSize: 10, fontWeight: '600', color: theme.colors.muted, textTransform: 'capitalize', backgroundColor: theme.colors.surfaceTertiary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brand },
  priorityBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, padding: 2 },
});
