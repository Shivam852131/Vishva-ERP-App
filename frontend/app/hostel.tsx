import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Home, Bed, UtensilsCrossed, Wrench, Users, Phone,
  ChevronRight, CheckCircle, AlertTriangle, Clock, MessageSquare,
} from 'lucide-react-native';

const MY_ROOM = { block: 'A', number: '302', type: 'Double Sharing', roommate: 'Amit Verma', warden: 'Dr. Priya Nair' };

const MESS_MENU = {
  breakfast: ['Poha & Tea', 'Bread Butter', 'Cornflakes', 'Idli Sambar'],
  lunch: ['Rice, Dal, Aloo Gobi, Salad', 'Chapati, Paneer, Rice, Curd'],
  dinner: ['Rice, Rajma, Jeera Aloo', 'Chapati, Chicken Curry, Rice', 'Veg Biryani, Raita'],
  snack: ['Samosa & Chai', 'Biscuits & Coffee'],
};

const COMPLAINTS = [
  { id: '1', title: 'AC not working', category: 'Maintenance', status: 'in_progress', date: 'Jan 20', priority: 'high' },
  { id: '2', title: 'WiFi slow in Block A', category: 'Network', status: 'pending', date: 'Jan 18', priority: 'medium' },
  { id: '3', title: 'Geyser replacement', category: 'Plumbing', status: 'resolved', date: 'Jan 15', priority: 'low' },
];

const NOTICES = [
  { id: '1', title: 'Mess timings updated', body: 'Dinner: 7:30 PM - 9:00 PM', date: 'Jan 22' },
  { id: '2', title: 'Hostel cricket tournament', body: 'Sign up by Jan 28', date: 'Jan 20' },
  { id: '3', title: 'Maintenance schedule', body: 'Block A water supply off 10-12 AM', date: 'Jan 19' },
];

export default function HostelManagement() {
  const [activeTab, setActiveTab] = useState<'overview' | 'mess' | 'complaints'>('overview');
  const [complaintText, setComplaintText] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleComplaint = () => {
    if (!complaintText.trim()) return;
    Alert.alert('Complaint Filed', 'Your complaint has been submitted successfully.');
    setComplaintText('');
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
                <View style={styles.heroIcon}><Home size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>Hostel Management</Text>
                  <Text style={styles.heroSub}>Room {MY_ROOM.block}-{MY_ROOM.number} · {MY_ROOM.type}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {(['overview', 'mess', 'complaints'] as const).map(t => (
              <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabActive]}>
                <Text style={[styles.tabTxt, activeTab === t && { color: '#fff' }]}>{t === 'overview' ? 'Overview' : t === 'mess' ? 'Mess Menu' : 'Complaints'}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {activeTab === 'overview' && (
              <>
                <Card style={{ padding: 16, gap: 12 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>My Room</Text>
                  <View style={styles.roomGrid}>
                    <View style={styles.roomItem}><Text style={styles.roomLabel}>Block</Text><Text style={styles.roomValue}>{MY_ROOM.block}</Text></View>
                    <View style={styles.roomItem}><Text style={styles.roomLabel}>Room</Text><Text style={styles.roomValue}>{MY_ROOM.number}</Text></View>
                    <View style={styles.roomItem}><Text style={styles.roomLabel}>Type</Text><Text style={styles.roomValue}>{MY_ROOM.type}</Text></View>
                    <View style={styles.roomItem}><Text style={styles.roomLabel}>Roommate</Text><Text style={styles.roomValue}>{MY_ROOM.roommate}</Text></View>
                  </View>
                </Card>

                <Card style={{ padding: 16, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Users size={18} color={theme.colors.brand} />
                    <Text style={{ fontWeight: '700', color: theme.colors.text }}>Warden</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: theme.colors.muted }}>{MY_ROOM.warden}</Text>
                  <Pressable style={styles.contactBtn}>
                    <Phone size={14} color={theme.colors.brand} /><Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.brand }}>Contact</Text>
                  </Pressable>
                </Card>

                <SectionTitle>Notices</SectionTitle>
                {NOTICES.map(n => (
                  <Card key={n.id} style={{ padding: 12, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 13 }}>{n.title}</Text>
                      <Text style={{ fontSize: 10, color: theme.colors.muted }}>{n.date}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>{n.body}</Text>
                  </Card>
                ))}

                <SectionTitle>Quick Actions</SectionTitle>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[
                    { icon: Wrench, label: 'Maintenance', color: '#F59E0B' },
                    { icon: MessageSquare, label: 'Message Warden', color: '#4F46E5' },
                    { icon: Clock, label: 'Gate Pass', color: '#10B981' },
                  ].map((a, i) => {
                    const Icon = a.icon;
                    return (
                      <Pressable key={i} style={[styles.quickAction, { borderColor: a.color + '30' }]}>
                        <Icon size={20} color={a.color} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text }}>{a.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {activeTab === 'mess' && (
              <>
                {Object.entries(MESS_MENU).map(([meal, items]) => (
                  <Card key={meal} style={{ padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <UtensilsCrossed size={16} color={theme.colors.brand} />
                      <Text style={{ fontWeight: '800', fontSize: 14, color: theme.colors.text, textTransform: 'capitalize' }}>{meal}</Text>
                    </View>
                    {items.map((item, i) => (
                      <Text key={i} style={{ fontSize: 13, color: theme.colors.muted, marginLeft: 24 }}>• {item}</Text>
                    ))}
                  </Card>
                ))}
                <Card style={{ padding: 12, backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brand + '30' }}>
                  <Text style={{ fontSize: 12, color: theme.colors.brand, fontWeight: '600' }}>💡 Meal timings: Breakfast 7:30-9 AM | Lunch 12:30-2 PM | Dinner 7:30-9 PM</Text>
                </Card>
              </>
            )}

            {activeTab === 'complaints' && (
              <>
                <Card style={{ padding: 16, gap: 10 }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>New Complaint</Text>
                  <TextInput style={styles.input} value={complaintText} onChangeText={setComplaintText}
                    placeholder="Describe your issue..." placeholderTextColor={theme.colors.muted} multiline />
                  <GradientButton label="Submit Complaint" onPress={handleComplaint} />
                </Card>

                <SectionTitle>My Complaints</SectionTitle>
                {COMPLAINTS.map(c => (
                  <Card key={c.id} style={{ padding: 14, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>{c.title}</Text>
                      <View style={[styles.statusBadge, c.status === 'resolved' ? styles.statusResolved : c.status === 'in_progress' ? styles.statusProgress : styles.statusPending]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: c.status === 'resolved' ? '#10B981' : c.status === 'in_progress' ? '#F59E0B' : '#EF4444' }}>{c.status.replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>{c.category}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>{c.date}</Text>
                    </View>
                  </Card>
                ))}
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
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brand },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 12 },
  roomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roomItem: { width: '47%', backgroundColor: theme.colors.surfaceTertiary, borderRadius: 10, padding: 12, alignItems: 'center' },
  roomLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  roomValue: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 2 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.brandTertiary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  quickAction: { flex: 1, alignItems: 'center', gap: 6, padding: 14, borderRadius: 12, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border, minHeight: 80, textAlignVertical: 'top' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary },
  statusResolved: { backgroundColor: '#10B98115' },
  statusProgress: { backgroundColor: '#F59E0B15' },
  statusPending: { backgroundColor: '#EF444415' },
});
