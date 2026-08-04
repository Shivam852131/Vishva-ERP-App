import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { useFetch } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Smartphone, Bell, BellRing, Settings, Check, ChevronRight,
  Volume2, VolumeX, Vibrate, Moon, Shield, Clock, Zap,
  GraduationCap, CreditCard, Calendar, BookOpen, MessageCircle,
} from 'lucide-react-native';

const PUSH_CATEGORIES = [
  { key: 'attendance', label: 'Attendance Alerts', icon: GraduationCap, color: '#EF4444', desc: 'Below 75% threshold notifications', enabled: true, sound: true },
  { key: 'fee', label: 'Fee Reminders', icon: CreditCard, color: '#F59E0B', desc: 'Due date and payment confirmations', enabled: true, sound: true },
  { key: 'exam', label: 'Exam Updates', icon: BookOpen, color: '#4F46E5', desc: 'Results, schedules, and hall tickets', enabled: true, sound: false },
  { key: 'event', label: 'Campus Events', icon: Calendar, color: '#10B981', desc: 'Events, fests, and activities', enabled: false, sound: false },
  { key: 'assignment', label: 'Assignments', icon: MessageCircle, color: '#8B5CF6', desc: 'Deadlines and submissions', enabled: true, sound: true },
  { key: 'library', label: 'Library', icon: BookOpen, color: '#06B6D4', desc: 'Due dates and availability', enabled: false, sound: false },
  { key: 'hostel', label: 'Hostel Updates', icon: Bell, color: '#EC4899', desc: 'Maintenance and notices', enabled: true, sound: false },
];

const QUICK_SETTINGS = [
  { key: 'sound', label: 'Notification Sound', icon: Volume2, color: '#4F46E5', value: 'Campus Chime' },
  { key: 'vibrate', label: 'Vibration', icon: Vibrate, color: '#059669', value: 'On' },
  { key: 'dnd', label: 'Do Not Disturb', icon: Moon, color: '#7C3AED', value: 'Off' },
  { key: 'priority', label: 'Priority Only', icon: Shield, color: '#DC2626', value: 'Off' },
  { key: 'quiet', label: 'Quiet Hours', icon: Clock, color: '#D97706', value: '10 PM - 7 AM' },
];

export default function PushNotifications() {
  const { data: pushHistory, loading } = useFetch<any[]>('/notifications');
  const [categories, setCategories] = useState(PUSH_CATEGORIES);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const toggleCategory = (key: string) => {
    setCategories(prev => prev.map(c => c.key === key ? { ...c, enabled: !c.enabled } : c));
  };

  const toggleSound = (key: string) => {
    setCategories(prev => prev.map(c => c.key === key ? { ...c, sound: !c.sound } : c));
  };

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
                <View style={styles.heroIcon}><Smartphone size={22} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>Push Notifications</Text>
                  <Text style={styles.heroSub}>Manage real-time alerts</Text>
                </View>
                <Switch value={globalEnabled} onValueChange={setGlobalEnabled}
                  trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#fff' }}
                  thumbColor={globalEnabled ? '#4F46E5' : '#64748B'} />
              </View>

              <View style={styles.statusBar}>
                <View style={[styles.statusBadge, globalEnabled ? styles.statusOn : styles.statusOff]}>
                  {globalEnabled ? <BellRing size={12} color="#fff" /> : <Bell size={12} color="#fff" />}
                  <Text style={styles.statusText}>{globalEnabled ? 'Notifications ON' : 'Notifications OFF'}</Text>
                </View>
                <Text style={styles.statusCount}>{categories.filter(c => c.enabled).length} of {categories.length} enabled</Text>
              </View>
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <SectionTitle>Notification Categories</SectionTitle>
            {categories.map(cat => {
              const Icon = cat.icon;
              return (
                <Card key={cat.key} style={{ padding: 14, gap: 8, opacity: globalEnabled ? 1 : 0.5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={[styles.catIcon, { backgroundColor: cat.color + '15' }]}>
                      <Icon size={18} color={cat.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 13 }}>{cat.label}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>{cat.desc}</Text>
                    </View>
                    <Switch value={cat.enabled} onValueChange={() => toggleCategory(cat.key)}
                      trackColor={{ false: '#E2E8F0', true: cat.color + '60' }} thumbColor="#fff" disabled={!globalEnabled} />
                  </View>
                  {cat.enabled && (
                    <View style={{ flexDirection: 'row', gap: 8, marginLeft: 44 }}>
                      <Pressable onPress={() => toggleSound(cat.key)}
                        style={[styles.soundBtn, cat.sound && styles.soundActive]}>
                        {cat.sound ? <Volume2 size={12} color={cat.sound ? cat.color : theme.colors.muted} /> :
                          <VolumeX size={12} color={theme.colors.muted} />}
                        <Text style={{ fontSize: 10, fontWeight: '600', color: cat.sound ? cat.color : theme.colors.muted }}>{cat.sound ? 'Sound On' : 'Silent'}</Text>
                      </Pressable>
                    </View>
                  )}
                </Card>
              );
            })}

            <SectionTitle>Quick Settings</SectionTitle>
            {QUICK_SETTINGS.map(setting => {
              const Icon = setting.icon;
              return (
                <Pressable key={setting.key}>
                  <Card style={{ padding: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.settingIcon, { backgroundColor: setting.color + '15' }]}>
                        <Icon size={18} color={setting.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 13 }}>{setting.label}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{setting.value}</Text>
                      <ChevronRight size={14} color={theme.colors.muted} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}

            <SectionTitle>Recent Push Notifications</SectionTitle>
            {loading ? (
              <ActivityIndicator size="small" color={theme.colors.brand} style={{ marginTop: 20 }} />
            ) : !pushHistory || pushHistory.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 20, gap: 8 }}>
                <Bell size={32} color={theme.colors.muted} />
                <Text style={{ fontSize: 14, color: theme.colors.muted, fontWeight: '600' }}>No push notifications sent yet</Text>
              </View>
            ) : (
              pushHistory.map((p: any) => (
                <Card key={p.id} style={{ padding: 12, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.notifDot, p.read && { backgroundColor: theme.colors.muted }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text }}>{p.title}</Text>
                      <Text style={{ fontSize: 10, color: theme.colors.muted }}>{p.time}</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
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
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusOn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  statusOff: { backgroundColor: 'rgba(255,255,255,0.1)' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  statusCount: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  soundBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.colors.surfaceTertiary },
  soundActive: { borderWidth: 1, borderColor: theme.colors.brand + '30' },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4F46E5' },
});
