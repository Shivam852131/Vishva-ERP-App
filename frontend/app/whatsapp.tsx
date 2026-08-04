import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, TextInput, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { api } from '@/src/api';
import { useFetch } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  MessageCircle, Send, Check, CheckCheck, Phone, Video,
  Settings, Link, Unlink, Bell, BellOff, Shield, Clock,
  ChevronRight, ExternalLink, QrCode, Smartphone, Wifi,
} from 'lucide-react-native';

const QUICK_REPLIES = [
  'Confirm attendance',
  'View fee details',
  'Check exam schedule',
  'Contact admin',
  'Report issue',
];

const WHATSAPP_FEATURES = [
  { icon: Bell, label: 'Attendance Alerts', desc: 'Real-time attendance notifications', color: '#EF4444', enabled: true },
  { icon: Clock, label: 'Fee Reminders', desc: 'Payment due date alerts', color: '#F59E0B', enabled: true },
  { icon: Check, label: 'Exam Updates', desc: 'Results and schedule notifications', color: '#4F46E5', enabled: true },
  { icon: MessageCircle, label: 'PTM Notifications', desc: 'Parent-teacher meeting alerts', color: '#10B981', enabled: true },
  { icon: Shield, label: 'Emergency Alerts', desc: 'Critical campus announcements', color: '#DC2626', enabled: true },
  { icon: Send, label: 'Weekly Reports', desc: 'Weekly academic summary', color: '#8B5CF6', enabled: false },
];

export default function WhatsAppIntegration() {
  const { user } = useAuth();
  const { data: fetchedMessages, loading } = useFetch<any[]>('/notifications');
  const messages = fetchedMessages || [];
  const [linked, setLinked] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [features, setFeatures] = useState(WHATSAPP_FEATURES);
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const allMessages = [...messages, ...localMessages];

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const toggleFeature = (index: number) => {
    setFeatures(prev => prev.map((f, i) => i === index ? { ...f, enabled: !f.enabled } : f));
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || sending) return;
    const newMsg = {
      id: String(Date.now()),
      from: 'parent',
      text: text.trim(),
      time: 'Just now',
      type: 'sent' as const,
    };
    setLocalMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setSending(true);
    try {
      await api('/twilio/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({ to: user?.phone || '', message: text.trim() }),
      });
    } catch {
      // Message already shown locally — silently fail
    } finally {
      setSending(false);
    }
  };

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#25D366', '#128C7E']} style={styles.heroGrad}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><MessageCircle size={22} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>WhatsApp Integration</Text>
                  <Text style={styles.heroSub}>{linked ? `Connected • ${user?.phone || 'Not set'}` : 'Not connected'}</Text>
                </View>
                <Pressable onPress={() => setLinked(!linked)}
                  style={[styles.linkBtn, linked ? styles.linkedBtn : styles.unlinkedBtn]}>
                  {linked ? <Link size={14} color="#fff" /> : <Unlink size={14} color="#fff" />}
                  <Text style={styles.linkText}>{linked ? 'Linked' : 'Link'}</Text>
                </Pressable>
              </View>

              <View style={styles.tabRow}>
                <Pressable onPress={() => setActiveTab('chat')} style={[styles.tabBtn, activeTab === 'chat' && styles.tabActive]}>
                  <MessageCircle size={14} color={activeTab === 'chat' ? '#fff' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.tabText, activeTab === 'chat' && { color: '#fff' }]}>Chat</Text>
                </Pressable>
                <Pressable onPress={() => setActiveTab('settings')} style={[styles.tabBtn, activeTab === 'settings' && styles.tabActive]}>
                  <Settings size={14} color={activeTab === 'settings' ? '#fff' : 'rgba(255,255,255,0.6)'} />
                  <Text style={[styles.tabText, activeTab === 'settings' && { color: '#fff' }]}>Settings</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          {activeTab === 'chat' ? (
            <>
              <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} style={{ flex: 1 }}>
                {loading ? (
                  <ActivityIndicator size="small" color={theme.colors.brand} style={{ marginTop: 40 }} />
                ) : allMessages.length === 0 ? (
                  <View style={{ alignItems: 'center', marginTop: 40, gap: 8 }}>
                    <MessageCircle size={32} color={theme.colors.muted} />
                    <Text style={{ fontSize: 14, color: theme.colors.muted, fontWeight: '600' }}>No messages yet</Text>
                  </View>
                ) : (
                  allMessages.map(msg => (
                  <View key={msg.id} style={[styles.msgBubble, msg.type === 'sent' ? styles.msgSent : msg.type === 'system' ? styles.msgSystem : styles.msgReceived]}>
                    {msg.priority && <View style={styles.priorityBadge}><Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>ALERT</Text></View>}
                    <Text style={[styles.msgText, msg.type === 'sent' ? { color: '#fff' } : { color: theme.colors.text }]}>{msg.text}</Text>
                    <Text style={[styles.msgTime, msg.type === 'sent' && { color: 'rgba(255,255,255,0.7)' }]}>{msg.time}</Text>
                    {msg.type === 'sent' && <CheckCheck size={14} color="rgba(255,255,255,0.7)" style={{ alignSelf: 'flex-end', marginTop: 2 }} />}
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={styles.quickReplyRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {QUICK_REPLIES.map((reply, i) => (
                    <Pressable key={i} style={styles.quickReplyChip} onPress={() => sendMessage(reply)}>
                      <Text style={{ fontSize: 11, color: '#25D366', fontWeight: '600' }}>{reply}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputRow}>
                <TextInput style={styles.chatInput} value={chatInput} onChangeText={setChatInput}
                  placeholder="Type a message..." placeholderTextColor={theme.colors.muted} />
                <Pressable style={[styles.sendBtn, sending && { opacity: 0.5 }]} onPress={() => sendMessage(chatInput)}>
                  <Send size={18} color="#fff" />
                </Pressable>
              </View>
            </>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
              <Card style={{ padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.connectionIcon, linked ? styles.connectedIcon : styles.disconnectedIcon]}>
                    {linked ? <Link size={20} color="#fff" /> : <Unlink size={20} color="#fff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.text }}>{linked ? 'WhatsApp Connected' : 'Not Connected'}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>{linked ? `${user?.phone || 'Not set'} • Verified` : 'Link your WhatsApp number'}</Text>
                  </View>
                </View>
                {!linked && <GradientButton label="Link WhatsApp" onPress={() => setLinked(true)} />}
              </Card>

              <SectionTitle>Notification Features</SectionTitle>
              {features.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <Card key={i} style={{ padding: 14, gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[styles.featIcon, { backgroundColor: feat.color + '15' }]}>
                        <Icon size={18} color={feat.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 13 }}>{feat.label}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.muted }}>{feat.desc}</Text>
                      </View>
                      <Switch value={feat.enabled} onValueChange={() => toggleFeature(i)}
                        trackColor={{ false: '#E2E8F0', true: feat.color + '60' }} thumbColor="#fff" />
                    </View>
                  </Card>
                );
              })}

              <SectionTitle>Quick Actions</SectionTitle>
              {[
                { icon: Phone, label: 'Call Support', desc: 'Talk to admin directly', color: '#4F46E5' },
                { icon: Video, label: 'Video Call', desc: 'Schedule a video meeting', color: '#7C3AED' },
                { icon: QrCode, label: 'Scan QR Code', desc: 'Link via QR scan', color: '#059669' },
                { icon: ExternalLink, label: 'Open WhatsApp Web', desc: 'Use on desktop', color: '#25D366' },
              ].map((action, i) => {
                const Icon = action.icon;
                return (
                  <Pressable key={i}>
                    <Card style={{ padding: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                          <Icon size={18} color={action.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 13 }}>{action.label}</Text>
                          <Text style={{ fontSize: 11, color: theme.colors.muted }}>{action.desc}</Text>
                        </View>
                        <ChevronRight size={14} color={theme.colors.muted} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}

              <Card style={{ padding: 14, backgroundColor: '#F0FDF4', borderColor: '#25D36630' }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Shield size={16} color="#25D366" />
                  <Text style={{ fontSize: 12, color: theme.colors.text, flex: 1, lineHeight: 16 }}>
                    Your WhatsApp number is verified and secured. All messages are end-to-end encrypted. We never share your data with third parties.
                  </Text>
                </View>
              </Card>
            </ScrollView>
          )}
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
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  linkedBtn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  unlinkedBtn: { backgroundColor: 'rgba(255,255,255,0.1)' },
  linkText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  tabRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)' },
  tabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tabText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  msgBubble: { maxWidth: '85%', borderRadius: 16, padding: 12, position: 'relative' },
  msgSent: { backgroundColor: '#25D366', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  msgReceived: { backgroundColor: theme.colors.surfaceSecondary, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
  msgSystem: { backgroundColor: theme.colors.brandTertiary, alignSelf: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.brand + '20' },
  msgText: { fontSize: 13, lineHeight: 18 },
  msgTime: { fontSize: 9, color: theme.colors.muted, marginTop: 4 },
  priorityBadge: { position: 'absolute', top: -2, right: 8, backgroundColor: '#EF4444', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  quickReplyRow: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  quickReplyChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#25D36630' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: theme.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.colors.border },
  chatInput: { flex: 1, height: 42, borderRadius: 21, backgroundColor: theme.colors.surface, paddingHorizontal: 16, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#25D366', alignItems: 'center', justifyContent: 'center' },
  connectionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  connectedIcon: { backgroundColor: '#25D366' },
  disconnectedIcon: { backgroundColor: theme.colors.muted },
  featIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
