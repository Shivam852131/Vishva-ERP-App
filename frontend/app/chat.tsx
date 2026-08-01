import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Send, MessageCircle, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { ChatUser, ChatMessage } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, EmptyState, AsyncView } from '@/src/ui';
import { api } from '@/src/api';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function Chat() {
  const { user: me } = useAuth();
  const { data: users, loading: usersLoading, error: usersError, refresh: refreshUsers } = useFetch<ChatUser[]>('/chat/users');
  const [sel, setSel] = useState<ChatUser | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [input, setInput] = useState('');
  const { mutate: sendMsg, loading: sending } = useMutate<ChatMessage>();
  const scrollRef = useRef<ScrollView>(null);

  const loadMessages = useCallback(async (userId: string) => {
    setMsgsLoading(true);
    try {
      const data = await api<ChatMessage[]>(`/chat/messages/${userId}`);
      setMsgs(data || []);
    } catch {
      setMsgs([]);
    } finally {
      setMsgsLoading(false);
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 200);
  }, []);

  useEffect(() => {
    if (sel) loadMessages(sel.id);
  }, [sel, loadMessages]);

  useEffect(() => {
    if (!sel || !me?.id) return;
    return subscribeRealtime<ChatMessage>('chat:message', (message) => {
      const isCurrentThread =
        (message.from_id === me.id && message.to_id === sel.id) ||
        (message.from_id === sel.id && message.to_id === me.id);
      if (!isCurrentThread) return;
      setMsgs(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [me?.id, sel]);

  const send = async () => {
    if (!input.trim() || !sel) return;
    const t = input.trim();
    setInput('');
    try {
      const doc = await sendMsg('/chat/messages', { method: 'POST', body: JSON.stringify({ receiverId: sel.id, content: t }) });
      if (doc) setMsgs(m => [...m, doc]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      setInput(t);
      Alert.alert('Error', e?.message || 'Message could not be sent');
    }
  };

  const usersSafe = users || [];

  if (!sel) {
    return (
      <ErrorBoundary>
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.headerGrad}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable onPress={() => router.back()} accessibilityLabel="Go back" accessibilityRole="button">
                <ArrowLeft color="#fff" size={22} />
              </Pressable>
              <Text style={styles.headerTitle}>Messages</Text>
              <MessageCircle color="rgba(255,255,255,0.5)" size={22} />
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>{usersSafe.length} contacts</Text>
          </LinearGradient>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 10 }}>
            <AsyncView
              loading={usersLoading && !users}
              error={usersError}
              onRetry={refreshUsers}
              empty={!usersLoading && usersSafe.length === 0}
              emptyTitle="No contacts"
              emptySub="Other users will appear here"
            >
              {usersSafe.map(u => (
                <Pressable key={u.id} onPress={() => setSel(u)} style={styles.userRow} testID={`chat-user-${u.id}`} accessibilityLabel={`Chat with ${u.name}`} accessibilityRole="button">
                  <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.avatar}>
                    <Text style={styles.avatarTxt}>{u.name?.[0]}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.uName}>{u.name}</Text>
                    <Text style={styles.uRole}>{u.role.replace('_', ' ')} · {u.email || '—'}</Text>
                  </View>
                  <ChevronRight color={theme.colors.muted} size={18} />
                </Pressable>
              ))}
            </AsyncView>
          </ScrollView>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.chatHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable onPress={() => setSel(null)} accessibilityLabel="Back to contacts" accessibilityRole="button">
                <ArrowLeft color="#fff" size={22} />
              </Pressable>
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarTxt}>{sel.name?.[0]}</Text>
              </View>
              <View>
                <Text style={styles.chatName}>{sel.name}</Text>
                <Text style={styles.chatRole}>{sel.role.replace('_', ' ')}</Text>
              </View>
            </View>
          </LinearGradient>

          {msgsLoading ? (
            <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: theme.spacing.lg, gap: 8 }}>
              {msgs.map((m, i) => (
                <View key={m.id || i} style={[styles.bubble, m.from_id === me?.id ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={m.from_id === me?.id ? styles.txtMe : styles.txtThem}>{m.message}</Text>
                  <Text style={m.from_id === me?.id ? styles.timeMe : styles.timeThem}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
              {msgs.length === 0 && <EmptyState title="Start a conversation" sub={`Say hi to ${sel.name}`} />}
            </ScrollView>
          )}

          <View style={styles.inputRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              style={styles.input}
              placeholderTextColor={theme.colors.muted}
              testID="chat-input"
            />
            <Pressable
              onPress={send}
              disabled={sending || !input.trim()}
              style={[styles.sendBtn, { opacity: sending || !input.trim() ? 0.5 : 1 }]}
              testID="chat-send"
              accessibilityLabel="Send message"
              accessibilityRole="button"
            >
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={18} />}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  headerGrad: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 20, fontWeight: '800', color: '#fff' },
  uName: { fontWeight: '700', color: theme.colors.onSurface, fontSize: 15 },
  uRole: { color: theme.colors.muted, fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  chatHeader: { padding: theme.spacing.md, paddingHorizontal: theme.spacing.lg, ...theme.shadow.md },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatAvatarTxt: { fontSize: 18, fontWeight: '800', color: '#fff' },
  chatName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  chatRole: { color: 'rgba(255,255,255,0.7)', fontSize: 11, textTransform: 'capitalize' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: theme.radius.md },
  bubbleMe: { backgroundColor: theme.colors.brandPrimary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: theme.colors.surfaceSecondary, alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: theme.colors.border },
  txtMe: { color: '#fff', fontSize: 14, lineHeight: 20 },
  txtThem: { color: theme.colors.onSurface, fontSize: 14, lineHeight: 20 },
  timeMe: { color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 4, textAlign: 'right' },
  timeThem: { color: theme.colors.muted, fontSize: 10, marginTop: 4 },
  inputRow: { flexDirection: 'row', gap: 8, padding: theme.spacing.md, borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  input: { flex: 1, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill, paddingHorizontal: 16, paddingVertical: 12, color: theme.colors.onSurface, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', ...theme.shadow.md },
});
