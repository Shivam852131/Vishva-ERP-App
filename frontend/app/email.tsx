import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, TextInput, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { useFetch } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Mail, Send, Inbox, Star, Trash2, Archive, Search, Filter,
  ChevronRight, Clock, Check, CheckCheck, AlertCircle, Paperclip,
  Reply, Forward, MoreHorizontal, Settings, Bell, BellOff, Zap,
} from 'lucide-react-native';

type Email = {
  id: string; from: string; subject: string; preview: string; time: string;
  read: boolean; starred: boolean; category: string; hasAttachment: boolean;
};

const EMAIL_FILTERS = [
  { key: 'all', label: 'All Mail', icon: Inbox, count: 6 },
  { key: 'unread', label: 'Unread', icon: Mail, count: 2 },
  { key: 'starred', label: 'Starred', icon: Star, count: 2 },
];

const EMAIL_CATEGORIES: Record<string, { color: string; label: string }> = {
  exam: { color: '#4F46E5', label: 'Exam' },
  fee: { color: '#F59E0B', label: 'Finance' },
  event: { color: '#10B981', label: 'Event' },
  library: { color: '#06B6D4', label: 'Library' },
  admin: { color: '#EC4899', label: 'Admin' },
};

export default function EmailIntegration() {
  const { data: emails, loading } = useFetch<any[]>('/notifications');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [emailPrefs, setEmailPrefs] = useState({ dailyDigest: true, instantAlerts: true, weeklyReport: false });
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const allEmails = (emails || []).map((e: any) => ({
    ...e,
    starred: starredIds.has(e.id) ? true : e.starred,
    read: readIds.has(e.id) ? true : e.read,
  }));

  const filteredEmails = allEmails.filter((e: any) => {
    if (filter === 'unread') return !e.read;
    if (filter === 'starred') return e.starred;
    return true;
  }).filter((e: any) => {
    if (!search) return true;
    return (e.subject || '').toLowerCase().includes(search.toLowerCase()) || (e.from || '').toLowerCase().includes(search.toLowerCase());
  });

  const toggleStar = (id: string) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markRead = (id: string) => {
    setReadIds(prev => new Set(prev).add(id));
    setSelectedEmail(id);
  };

  const selected = allEmails.find((e: any) => e.id === selectedEmail);

  if (selected) {
    const cat = EMAIL_CATEGORIES[selected.category] || { color: '#64748B', label: 'Other' };
    return (
      <ErrorBoundary>
        <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.detailHeader}>
              <Pressable onPress={() => setSelectedEmail(null)} style={styles.backBtn}>
                <Text style={{ fontSize: 18, color: theme.colors.brand }}>←</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 14, color: theme.colors.text }} numberOfLines={1}>{selected.subject}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable style={styles.headerIconBtn}><Archive size={16} color={theme.colors.muted} /></Pressable>
                <Pressable style={styles.headerIconBtn}><Trash2 size={16} color={theme.colors.muted} /></Pressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Card style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.senderAvatar, { backgroundColor: cat.color + '15' }]}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: cat.color }}>{selected.from[0]}</Text>
                    </View>
                    <View>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>{selected.from}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>{selected.time}</Text>
                    </View>
                  </View>
                  <View style={[styles.catBadge, { backgroundColor: cat.color + '15' }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: cat.color }}>{cat.label}</Text>
                  </View>
                </View>
              </Card>

              <Card style={{ padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.text }}>{selected.subject}</Text>
                <Text style={{ fontSize: 13, color: theme.colors.muted, lineHeight: 20 }}>
                  {selected.preview}{'\n\n'}This is to provide you with a detailed update regarding your child's academic progress and important campus notifications. Please review the attached documents for complete information.{'\n\n'}If you have any questions, please don't hesitate to reach out to the administration office.{'\n\n'}Best regards,{'\n'}Vishva University Administration
                </Text>
                {selected.hasAttachment && (
                  <View style={styles.attachment}>
                    <View style={styles.attachIcon}><Text style={{ fontSize: 14 }}>📄</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>attachment.pdf</Text>
                      <Text style={{ fontSize: 10, color: theme.colors.muted }}>245 KB</Text>
                    </View>
                  </View>
                )}
              </Card>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><GradientButton label="Reply" onPress={() => {}} /></View>
                <View style={{ flex: 1 }}><GradientButton label="Forward" onPress={() => {}} colors={['#64748B', '#94A3B8']} /></View>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </ErrorBoundary>
    );
  }

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
                <View style={styles.heroIcon}><Mail size={22} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>Email Integration</Text>
                  <Text style={styles.heroSub}>{allEmails.filter((e: any) => !e.read).length} unread messages</Text>
                </View>
                <Pressable style={styles.settingsBtn}><Settings size={18} color="#fff" /></Pressable>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.searchBox}>
            <Search size={16} color={theme.colors.muted} />
            <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
              placeholder="Search emails..." placeholderTextColor={theme.colors.muted} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {EMAIL_FILTERS.map(f => {
              const Icon = f.icon;
              return (
                <Pressable key={f.key} onPress={() => setFilter(f.key)}
                  style={[styles.filterChip, filter === f.key && styles.filterActive]}>
                  <Icon size={14} color={filter === f.key ? '#fff' : theme.colors.muted} />
                  <Text style={[styles.filterText, filter === f.key && { color: '#fff' }]}>{f.label}</Text>
                  <View style={[styles.filterBadge, filter === f.key && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={[styles.filterBadgeText, filter === f.key && { color: '#fff' }]}>{f.count}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.brand} style={{ marginTop: 40 }} />
            ) : filteredEmails.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 40, gap: 8 }}>
                <Mail size={32} color={theme.colors.muted} />
                <Text style={{ fontSize: 14, color: theme.colors.muted, fontWeight: '600' }}>No emails yet</Text>
              </View>
            ) : (
              filteredEmails.map(email => {
              const cat = EMAIL_CATEGORIES[email.category] || { color: '#64748B', label: 'Other' };
              return (
                <Pressable key={email.id} onPress={() => markRead(email.id)}>
                  <Card style={[styles.emailCard, !email.read && styles.emailUnread]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View style={[styles.senderAvatar, { backgroundColor: cat.color + '15' }]}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: cat.color }}>{email.from[0]}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={[styles.emailFrom, !email.read && { fontWeight: '800' }]} numberOfLines={1}>{email.from}</Text>
                          <Text style={styles.emailTime}>{email.time}</Text>
                        </View>
                        <Text style={[styles.emailSubject, !email.read && { fontWeight: '700', color: theme.colors.text }]} numberOfLines={1}>{email.subject}</Text>
                        <Text style={styles.emailPreview} numberOfLines={2}>{email.preview}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <View style={[styles.catBadge, { backgroundColor: cat.color + '15' }]}>
                            <Text style={{ fontSize: 9, fontWeight: '700', color: cat.color }}>{cat.label}</Text>
                          </View>
                          {email.hasAttachment && <Paperclip size={12} color={theme.colors.muted} />}
                        </View>
                      </View>
                      <Pressable onPress={() => toggleStar(email.id)}>
                        <Star size={16} color={email.starred ? '#F59E0B' : theme.colors.border} fill={email.starred ? '#F59E0B' : 'transparent'} />
                      </Pressable>
                    </View>
                  </Card>
                </Pressable>
              );
            })}

            <SectionTitle>Email Preferences</SectionTitle>
            <Card style={{ padding: 16, gap: 10 }}>
              {[
                { key: 'instantAlerts', label: 'Instant Email Alerts', desc: 'Get notified immediately for important updates', icon: Zap, color: '#4F46E5' },
                { key: 'dailyDigest', label: 'Daily Digest', desc: 'Summary of all notifications at 6 PM', icon: Clock, color: '#059669' },
                { key: 'weeklyReport', label: 'Weekly Report', desc: 'Weekly academic progress report', icon: Send, color: '#7C3AED' },
              ].map(pref => {
                const Icon = pref.icon;
                return (
                  <View key={pref.key} style={styles.prefRow}>
                    <View style={[styles.prefIcon, { backgroundColor: pref.color + '15' }]}><Icon size={16} color={pref.color} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>{pref.label}</Text>
                      <Text style={{ fontSize: 10, color: theme.colors.muted }}>{pref.desc}</Text>
                    </View>
                    <Switch value={(emailPrefs as any)[pref.key]} onValueChange={v => setEmailPrefs(p => ({ ...p, [pref.key]: v }))}
                      trackColor={{ false: '#E2E8F0', true: pref.color + '60' }} thumbColor="#fff" />
                  </View>
                );
              })}
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', gap: 10 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  settingsBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  filterActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  filterBadge: { backgroundColor: theme.colors.surfaceTertiary, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.muted },
  emailCard: { padding: 14, gap: 6 },
  emailUnread: { borderLeftWidth: 3, borderLeftColor: theme.colors.brand },
  senderAvatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emailFrom: { fontSize: 12, fontWeight: '600', color: theme.colors.text, flex: 1 },
  emailTime: { fontSize: 10, color: theme.colors.muted },
  emailSubject: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginTop: 2 },
  emailPreview: { fontSize: 11, color: theme.colors.muted, lineHeight: 16, marginTop: 2 },
  catBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerIconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.colors.border },
  attachIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  prefIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
