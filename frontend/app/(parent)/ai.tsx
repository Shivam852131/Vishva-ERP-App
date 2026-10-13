import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { router } from '@/src/navigation/router';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import {
  Sparkles, BarChart3, Bell, Wallet, MessageSquare,
  TrendingUp, TrendingDown, ChevronRight, Send, BookOpen,
  GraduationCap, Clock, AlertTriangle,
} from 'lucide-react-native';

const FEATURE_CARDS = [
  { key: 'progress', title: 'Child Progress', icon: BarChart3, color: '#4F46E5', desc: 'CGPA, grades & trends' },
  { key: 'alerts', title: 'Attendance Alerts', icon: Bell, color: '#F59E0B', desc: 'Low attendance warnings' },
  { key: 'fees', title: 'Fee Status', icon: Wallet, color: '#10B981', desc: 'Pending payments & dues' },
  { key: 'chat', title: 'Smart Chat', icon: MessageSquare, color: '#3B82F6', desc: 'Ask anything about your child' },
];

export default function ParentAI() {
  const { user } = useAuth();
  const { data: childData } = useFetch<any>('/dashboard/parent');
  const { data: alerts } = useFetch<any[]>('/notifications');
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string }[]>([]);
  const [sending, setSending] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const quickStats = childData ? [
    { label: 'Attendance', value: childData.attendance || '—' },
    { label: 'CGPA', value: childData.cgpa || '—' },
    { label: 'Fees Due', value: childData.feesDue || '—' },
    { label: 'Assignments', value: childData.pendingAssignments || '—' },
  ] : [];

  const CHAT_PROMPTS = [
    'How is my child performing academically?',
    'What subjects need improvement?',
    'Show attendance breakdown',
    'Upcoming exam schedule',
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const sendMessage = async (msg: string) => {
    try {
      const res = await api('/ai/chat', { method: 'POST', body: JSON.stringify({ message: msg }) });
      return res.response || 'I could not process that request.';
    } catch { return 'AI service unavailable. Please try again.'; }
  };

  const handleSend = async (text?: string) => {
    const msg = text || chatInput.trim();
    if (!msg) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setSending(true);
    const reply = await sendMessage(msg);
    setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
    setSending(false);
  };

  if (activeFeature === 'chat') {
    return (
      <ErrorBoundary>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView edges={['top']} style={styles.chatHeader}>
            <Pressable onPress={() => setActiveFeature(null)} style={styles.backBtn}>
              <Text style={{ fontSize: 18, color: theme.colors.brand }}>←</Text>
            </Pressable>
            <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.text }}>AI Parent Chat</Text>
            <View style={{ width: 32 }} />
          </SafeAreaView>
          <ScrollView style={styles.chatBody} contentContainerStyle={{ padding: 16, gap: 12 }}>
            {chatMessages.length === 0 && (
              <View style={styles.chatEmpty}>
                <MessageSquare size={40} color={theme.colors.brand} />
                <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.text, marginTop: 12 }}>AI Parent Assistant</Text>
                <Text style={{ color: theme.colors.muted, textAlign: 'center', marginTop: 4 }}>Ask about your child's academics, attendance, fees, or anything else.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  {CHAT_PROMPTS.map((p, i) => (
                    <Pressable key={i} onPress={() => handleSend(p)} style={styles.chatPrompt}>
                      <Text style={{ fontSize: 12, color: theme.colors.brand }}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {chatMessages.map((m, i) => (
              <View key={i} style={[styles.chatBubble, m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAI]}>
                <Text style={{ color: m.role === 'user' ? '#fff' : theme.colors.text, fontSize: 14, lineHeight: 20 }}>{m.text}</Text>
              </View>
            ))}
            {sending && (
              <View style={[styles.chatBubble, styles.chatBubbleAI]}>
                <Text style={{ color: theme.colors.muted }}>Analyzing...</Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TextInput style={styles.chatInput} value={chatInput} onChangeText={setChatInput} placeholder="Ask about your child..." placeholderTextColor={theme.colors.muted} />
            <Pressable onPress={() => handleSend()} style={styles.sendBtn}>
              <Send size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={[theme.colors.brand, '#6366F1']} style={styles.heroGrad}>
              <View style={styles.heroContent}>
                <View style={styles.aiIcon}>
                  <Sparkles size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>AI Parent Assistant</Text>
                  <Text style={styles.heroSub}>Track your child's academic progress</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            <View style={styles.statsRow}>
              {quickStats.map((s, i) => {
                return (
                  <Card key={i} style={styles.statCard}>
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </Card>
                );
              })}
            </View>

            <SectionTitle>Quick Actions</SectionTitle>
            <View style={styles.featureGrid}>
              {FEATURE_CARDS.map((f) => {
                const Icon = f.icon;
                return (
                  <Pressable key={f.key} onPress={() => f.key === 'chat' ? setActiveFeature('chat') : null} style={styles.featureCard}>
                    <LinearGradient colors={[f.color + '15', f.color + '08']} style={styles.featureIcon}>
                      <Icon size={24} color={f.color} />
                    </LinearGradient>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                    <ChevronRight size={14} color={theme.colors.muted} />
                  </Pressable>
                );
              })}
            </View>

            <SectionTitle>Recent Alerts</SectionTitle>
            {alerts && alerts.length > 0 ? alerts.map((a: any) => (
              <Card key={a.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View style={[styles.alertBadge, a.priority === 'high' ? styles.badgeHigh : a.priority === 'medium' ? styles.badgeMed : styles.badgeLow]}>
                    {a.priority === 'high' ? <AlertTriangle size={12} color="#fff" /> : <Clock size={12} color="#fff" />}
                    <Text style={styles.badgeText}>{a.priority === 'high' ? 'Urgent' : a.priority === 'medium' ? 'Soon' : 'Info'}</Text>
                  </View>
                  <Text style={styles.alertTime}>{a.time}</Text>
                </View>
                <Text style={styles.alertTitle}>{a.title}</Text>
                <Text style={styles.alertBody}>{a.body}</Text>
              </Card>
            )) : (
              <Card style={styles.alertCard}>
                <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>No alerts at this time</Text>
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
  heroGrad: { paddingHorizontal: 20, paddingVertical: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aiIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, gap: 4 },
  statValue: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  statLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  featureCard: { width: '47%', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
  featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  featureDesc: { fontSize: 11, color: theme.colors.muted },
  alertCard: { padding: 16, gap: 8 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeHigh: { backgroundColor: '#EF4444' },
  badgeMed: { backgroundColor: '#F59E0B' },
  badgeLow: { backgroundColor: '#3B82F6' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  alertTime: { fontSize: 11, color: theme.colors.muted },
  alertTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  alertBody: { fontSize: 13, color: theme.colors.muted, lineHeight: 18 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  chatBody: { flex: 1 },
  chatEmpty: { alignItems: 'center', paddingTop: 60, gap: 4 },
  chatPrompt: { backgroundColor: theme.colors.brandTertiary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.brand + '30' },
  chatBubble: { maxWidth: '85%', borderRadius: 16, padding: 12 },
  chatBubbleUser: { backgroundColor: theme.colors.brand, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatBubbleAI: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: theme.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.colors.border },
  chatInput: { flex: 1, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, paddingHorizontal: 16, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
});
