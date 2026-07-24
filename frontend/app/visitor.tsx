import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Users, UserPlus, Clock, CheckCircle, AlertTriangle, Phone,
  ChevronRight, Shield, Car, BookOpen, Camera,
} from 'lucide-react-native';

const VISITORS_LOG = [
  { id: '1', name: 'Priya Sharma', purpose: 'Parent Meeting', who: 'Rahul Sharma (CS-A)', inTime: '10:30 AM', outTime: '12:15 PM', status: 'checked_out', type: 'Parent', photo: true },
  { id: '2', name: 'Vikram Singh', purpose: 'Guest Lecture', who: 'Dr. Mehta', inTime: '2:00 PM', outTime: null, status: 'in_campus', type: 'Guest', photo: true },
  { id: '3', name: 'Amit Patel', purpose: 'Delivery', who: 'Admin Office', inTime: '11:00 AM', outTime: '11:20 AM', status: 'checked_out', type: 'Vendor', photo: false },
  { id: '4', name: 'Neha Gupta', purpose: 'Interview', who: 'HR Department', inTime: '3:30 PM', outTime: null, status: 'in_campus', type: 'Candidate', photo: true },
  { id: '5', name: 'Rajesh Kumar', purpose: 'Maintenance', who: 'Hostel Block A', inTime: '9:00 AM', outTime: '4:30 PM', status: 'checked_out', type: 'Vendor', photo: false },
];

const PENDING_APPROVAL = [
  { id: '10', name: 'Sunita Verma', purpose: 'Parent Meeting', who: 'Amit Verma (CS-B)', type: 'Parent', expectedTime: 'Tomorrow 10 AM', phone: '+91 9876543220' },
  { id: '11', name: 'Dr. Rajesh Iyer', purpose: 'Workshop', who: 'CS Department', type: 'Guest', expectedTime: 'Jan 28, 2 PM', phone: '+91 9876543221' },
];

const VISITOR_TYPES = [
  { type: 'Parent', icon: Users, color: '#4F46E5', count: 12 },
  { type: 'Guest', icon: BookOpen, color: '#10B981', count: 5 },
  { type: 'Vendor', icon: Car, color: '#F59E0B', count: 8 },
  { type: 'Candidate', icon: UserPlus, color: '#3B82F6', count: 3 },
];

export default function VisitorManagement() {
  const [activeTab, setActiveTab] = useState<'log' | 'pending' | 'register'>('log');
  const [newVisitor, setNewVisitor] = useState({ name: '', purpose: '', who: '', phone: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleRegister = () => {
    if (!newVisitor.name.trim()) return Alert.alert('Error', 'Enter visitor name');
    Alert.alert('Visitor Registered', `${newVisitor.name} has been registered. A notification will be sent.`);
    setNewVisitor({ name: '', purpose: '', who: '', phone: '' });
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
                <View style={styles.heroIcon}><Users size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>Visitor Management</Text>
                  <Text style={styles.heroSub}>Track and manage campus visitors</Text>
                </View>
              </View>
              <View style={styles.heroStats}>
                {VISITOR_TYPES.map((vt, i) => {
                  const Icon = vt.icon;
                  return (
                    <View key={i} style={styles.heroStat}>
                      <Icon size={16} color={vt.color} />
                      <Text style={styles.heroStatVal}>{vt.count}</Text>
                      <Text style={styles.heroStatLabel}>{vt.type}</Text>
                    </View>
                  );
                })}
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {(['log', 'pending', 'register'] as const).map(t => (
              <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabActive]}>
                <Text style={[styles.tabTxt, activeTab === t && { color: '#fff' }]}>{t === 'log' ? 'Visitor Log' : t === 'pending' ? 'Approvals' : 'Register'}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {activeTab === 'log' && (
              <>
                {VISITORS_LOG.map(v => (
                  <Card key={v.id} style={{ padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.avatar, v.status === 'in_campus' ? styles.avatarActive : styles.avatarLeft]}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{v.name.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={{ fontWeight: '700', color: theme.colors.text }}>{v.name}</Text>
                          <Text style={{ fontSize: 11, color: theme.colors.muted }}>{v.purpose} · {v.type}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, v.status === 'in_campus' ? styles.statusIn : styles.statusOut]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: v.status === 'in_campus' ? '#10B981' : '#64748B' }}>{v.status === 'in_campus' ? 'In Campus' : 'Left'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 16, marginLeft: 42 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>📞 {v.who}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, marginLeft: 42 }}>
                      <View style={styles.timeChip}><Clock size={10} color={theme.colors.brand} /><Text style={styles.timeText}>In: {v.inTime}</Text></View>
                      {v.outTime && <View style={styles.timeChip}><Clock size={10} color={theme.colors.muted} /><Text style={styles.timeText}>Out: {v.outTime}</Text></View>}
                    </View>
                  </Card>
                ))}
              </>
            )}

            {activeTab === 'pending' && (
              <>
                {PENDING_APPROVAL.map(p => (
                  <Card key={p.id} style={{ padding: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.avatar, styles.avatarPending]}><AlertTriangle size={16} color="#F59E0B" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: theme.colors.text }}>{p.name}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.muted }}>{p.purpose} · {p.type}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.colors.muted, marginLeft: 42 }}>Meeting: {p.who}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.muted, marginLeft: 42 }}>Expected: {p.expectedTime}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginLeft: 42 }}>
                      <Pressable style={styles.approveBtn} onPress={() => Alert.alert('Approved', `${p.name} has been approved`)}>
                        <CheckCircle size={14} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Approve</Text>
                      </Pressable>
                      <Pressable style={styles.rejectBtn} onPress={() => Alert.alert('Rejected', `${p.name} has been rejected`)}>
                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>Reject</Text>
                      </Pressable>
                    </View>
                  </Card>
                ))}
              </>
            )}

            {activeTab === 'register' && (
              <>
                <Card style={{ padding: 16, gap: 10 }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>Register New Visitor</Text>
                  <TextInput style={styles.input} value={newVisitor.name} onChangeText={v => setNewVisitor(p => ({ ...p, name: v }))}
                    placeholder="Visitor Name" placeholderTextColor={theme.colors.muted} />
                  <TextInput style={styles.input} value={newVisitor.purpose} onChangeText={v => setNewVisitor(p => ({ ...p, purpose: v }))}
                    placeholder="Purpose of Visit" placeholderTextColor={theme.colors.muted} />
                  <TextInput style={styles.input} value={newVisitor.who} onChangeText={v => setNewVisitor(p => ({ ...p, who: v }))}
                    placeholder="Whom to meet" placeholderTextColor={theme.colors.muted} />
                  <TextInput style={styles.input} value={newVisitor.phone} onChangeText={v => setNewVisitor(p => ({ ...p, phone: v }))}
                    placeholder="Phone Number" placeholderTextColor={theme.colors.muted} keyboardType="phone-pad" />
                  <GradientButton label="Register Visitor" onPress={handleRegister} />
                </Card>

                <Card style={{ padding: 14, backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brand + '30' }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Shield size={16} color={theme.colors.brand} />
                    <Text style={{ fontSize: 12, color: theme.colors.text, flex: 1, lineHeight: 16 }}>
                      All visitors must present valid ID at the gate. Security will verify before entry. Visitor passes are valid for the registered time only.
                    </Text>
                  </View>
                </Card>
              </>
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
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginTop: 4 },
  heroStat: { alignItems: 'center', gap: 2 },
  heroStatVal: { color: '#fff', fontSize: 16, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brand },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarActive: { backgroundColor: '#10B981' },
  avatarLeft: { backgroundColor: theme.colors.muted },
  avatarPending: { backgroundColor: '#F59E0B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusIn: { backgroundColor: '#10B98115' },
  statusOut: { backgroundColor: theme.colors.surfaceTertiary },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  timeText: { fontSize: 10, color: theme.colors.muted },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 },
  rejectBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#EF444430' },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
});
