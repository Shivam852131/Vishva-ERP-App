import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import {
  Send,
  Image as ImageIcon,
  Bot,
  User,
  Sparkles,
  BookOpen,
  GraduationCap,
  Lightbulb,
  RefreshCw,
  Clock,
  ChevronRight,
  AlertCircle,
  X,
  ImagePlus,
  History,
  ArrowLeft,
} from 'lucide-react-native';
import * as ImagePicker from '@/src/native/image-picker';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { subscribeRealtime } from '@/src/realtime/socket';

interface LocalMsg {
  id: string;
  role: 'user' | 'ai';
  text: string;
  image?: string;
  timestamp?: string;
}

interface ChatSession {
  session_id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface HistoryEntry {
  id: string;
  user_msg: string;
  ai_msg: string;
  created_at: string;
}

const PERSONAS = [
  {
    key: 'doubt',
    label: 'Doubt Solver',
    icon: Sparkles,
    color: '#059669',
    gradient: ['#059669', '#10B981'] as const,
    bgLight: '#D1FAE5',
    placeholder: 'Ask a doubt or attach a problem photo...',
  },
  {
    key: 'general',
    label: 'Academic Advisor',
    icon: GraduationCap,
    color: '#3B82F6',
    gradient: ['#2563EB', '#3B82F6'] as const,
    bgLight: '#DBEAFE',
    placeholder: 'Ask about academics, courses, or campus...',
  },
  {
    key: 'study',
    label: 'Study Coach',
    icon: BookOpen,
    color: '#8B5CF6',
    gradient: ['#7C3AED', '#8B5CF6'] as const,
    bgLight: '#EDE9FE',
    placeholder: 'Get study tips, schedules, and strategies...',
  },
];

const QUICK_ACTIONS = [
  { label: 'Explain a concept', prompt: 'Can you explain a concept in simple terms?' },
  { label: 'Solve a problem', prompt: 'I need help solving a problem step by step.' },
  { label: 'Study tips', prompt: 'Give me some effective study tips for exams.' },
];

const SUGGESTED_PROMPTS = [
  'How do I prepare for exams?',
  'Explain data structures',
  'Study schedule for finals',
  'Tips for better attendance',
  'Help with assignments',
  'Career guidance',
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    const combined = Animated.parallel(animations);
    combined.start();
    return () => combined.stop();
  }, []);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.aiAvatarSmall}>
        <Sparkles size={12} color={theme.colors.brand} />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                styles.typingDot,
                {
                  opacity: dot,
                  transform: [
                    {
                      translateY: dot.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -6],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function EmptyChatView({ onSelectPrompt }: { onSelectPrompt: (p: string) => void }) {
  return (
    <ScrollView
      style={styles.emptyContainer}
      contentContainerStyle={styles.emptyContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.emptyHeader}>
        <View style={styles.emptyIconWrap}>
          <Sparkles size={32} color={theme.colors.brandPrimary} />
        </View>
        <Text style={styles.emptyTitle}>CampusAI</Text>
        <Text style={styles.emptySubtitle}>
          Your intelligent campus assistant. Ask anything about academics, studies, or campus life.
        </Text>
      </View>
      <Text style={styles.suggestedLabel}>Suggested Prompts</Text>
      <View style={styles.suggestedGrid}>
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <Pressable
            key={i}
            style={styles.suggestedCard}
            onPress={() => onSelectPrompt(prompt)}
            testID={`suggested-prompt-${i}`}
            accessibilityLabel={prompt}
          >
            <Lightbulb size={16} color={theme.colors.brandSecondary} />
            <Text style={styles.suggestedText}>{prompt}</Text>
            <ChevronRight size={14} color={theme.colors.muted} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

export default function ChatTab() {
  const { user } = useAuth();
  const [persona, setPersona] = useState('doubt');
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionId, setSessionId] = useState(`ai_${user?.id || 'anon'}_${Date.now()}`);
  const [refreshing, setRefreshing] = useState(false);
  const [retryMsg, setRetryMsg] = useState<LocalMsg | null>(null);

  const sessionRef = useRef(sessionId);
  const scrollRef = useRef<FlatList<LocalMsg>>(null);
  const inputRef = useRef<TextInput>(null);

  const { mutate: sendMsg, loading } = useMutate<{ reply: string }>();
  const { data: historyData, loading: historyLoading, refresh: refreshHistory } = useFetch<HistoryEntry[]>(
    showHistory ? `/ai/history/${sessionRef.current}` : null,
  );
  const { data: sessionsData, refresh: refreshSessions } = useFetch<ChatSession[]>('/ai/sessions');

  const currentPersona = PERSONAS.find((p) => p.key === persona) || PERSONAS[0];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: generateId(),
          role: 'ai',
          text: `Hi${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! I'm your ${currentPersona.label}. How can I help you today?`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [persona]);

  useEffect(() => subscribeRealtime<{ sessionId?: string; userId?: string }>('ai:sessions:update', (payload) => {
    if (payload?.userId && payload.userId !== user?.id) return;
    refreshSessions();
    if (showHistory && payload?.sessionId === sessionRef.current) refreshHistory();
  }), [refreshHistory, refreshSessions, showHistory, user?.id]);

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.5,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets?.[0]?.base64) {
        setImage(res.assets[0].base64);
      }
    } catch {
      // user cancelled
    }
  };

  const removeImage = () => setImage(null);

  const send = async (overrideText?: string) => {
    const q = (overrideText || input).trim();
    if ((!q && !image) || loading) return;

    const img = image;
    const userMsg: LocalMsg = {
      id: generateId(),
      role: 'user',
      text: q || '(photo attached)',
      image: img || undefined,
      timestamp: new Date().toISOString(),
    };

    setInput('');
    setImage(null);
    setMessages((m) => [...m, userMsg]);
    setError(null);
    setRetryMsg(null);

    try {
      let reply: string;
      if (persona === 'doubt' || img) {
        const r = await sendMsg('/ai/doubt', {
          method: 'POST',
          body: JSON.stringify({
            session_id: sessionRef.current,
            message: q,
            image_base64: img,
            course: undefined,
          }),
        });
        reply = r?.reply || 'No response from AI.';
      } else {
        const r = await sendMsg('/ai/chat', {
          method: 'POST',
          body: JSON.stringify({
            session_id: sessionRef.current,
            message: q,
            context: persona,
          }),
        });
        reply = r?.reply || 'No response from AI.';
      }
      setMessages((m) => [
        ...m,
        { id: generateId(), role: 'ai', text: reply, timestamp: new Date().toISOString() },
      ]);
    } catch (e: any) {
      const errMsg = e?.message || 'Something went wrong. Please try again.';
      setError(errMsg);
      setRetryMsg(userMsg);
    } finally {
      scrollToBottom();
    }
  };

  const retryLastMessage = () => {
    if (retryMsg) {
      const text = retryMsg.text === '(photo attached)' ? '' : retryMsg.text;
      setInput(text);
      setImage(retryMsg.image || null);
      setMessages((m) => m.filter((msg) => msg.id !== retryMsg.id));
      setTimeout(() => send(text || undefined), 50);
    }
  };

  const loadSession = (sid: string) => {
    setSessionId(sid);
    sessionRef.current = sid;
    setShowHistory(false);
    refreshHistory();
  };

  const newSession = () => {
    const newSid = `ai_${user?.id || 'anon'}_${Date.now()}`;
    setSessionId(newSid);
    sessionRef.current = newSid;
    setMessages([
      {
        id: generateId(),
        role: 'ai',
        text: `Hi${user?.name ? ` ${user.name.split(' ')[0]}` : ''}! I'm your ${currentPersona.label}. How can I help you today?`,
        timestamp: new Date().toISOString(),
      },
    ]);
    setShowHistory(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    refreshSessions();
    setTimeout(() => setRefreshing(false), 500);
  };

  const renderMessage = ({ item }: { item: LocalMsg }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAi]}
        testID={isUser ? `msg-user-${item.id}` : `msg-ai-${item.id}`}
        accessibilityLabel={isUser ? 'Your message' : 'AI reply'}
      >
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: currentPersona.bgLight }]}>
            <Bot size={14} color={currentPersona.color} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi, isUser && { backgroundColor: currentPersona.color }]}>
          {!isUser && (
            <Text style={[styles.aiName, { color: currentPersona.color }]}>{currentPersona.label}</Text>
          )}
          {item.image && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${item.image}` }}
              style={styles.msgImage}
            />
          )}
          <Text style={isUser ? styles.txtUser : styles.txtAi}>{item.text}</Text>
          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAi]}>
            {formatTime(item.timestamp)}
          </Text>
        </View>
        {isUser && (
          <View style={styles.userAvatar}>
            <User size={14} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  const keyExtractor = (item: LocalMsg) => item.id;

  if (showHistory) {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          <View style={styles.historyHeader}>
            <Pressable
              onPress={() => setShowHistory(false)}
              style={styles.backBtn}
              testID="history-back"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={20} color={theme.colors.onSurface} />
            </Pressable>
            <Text style={styles.historyTitle}>Chat History</Text>
            <Pressable
              onPress={newSession}
              style={styles.newChatBtn}
              testID="new-chat"
              accessibilityLabel="Start new chat"
            >
              <Text style={styles.newChatTxt}>New</Text>
            </Pressable>
          </View>
          {historyLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
            </View>
          ) : !historyData || historyData.length === 0 ? (
            <View style={styles.centered}>
              <History size={48} color={theme.colors.muted} />
              <Text style={styles.emptyHistoryTxt}>No conversation history yet</Text>
            </View>
          ) : (
            <FlatList
              data={historyData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <View style={styles.historyItemUser}>
                    <User size={12} color="#fff" />
                    <Text style={styles.historyItemTxt} numberOfLines={1}>{item.user_msg}</Text>
                  </View>
                  <View style={styles.historyItemAi}>
                    <Bot size={12} color={theme.colors.brand} />
                    <Text style={styles.historyItemTxtAi} numberOfLines={2}>{item.ai_msg}</Text>
                  </View>
                  <Text style={styles.historyItemTime}>{formatTime(item.created_at)}</Text>
                </View>
              )}
              contentContainerStyle={{ padding: theme.spacing.lg, gap: 12 }}
            />
          )}
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={140}
      >
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          {/* Persona Selector */}
          <View style={styles.personaBar}>
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              const active = persona === p.key;
              return (
                <Pressable
                  key={p.key}
                  testID={`persona-${p.key}`}
                  accessibilityLabel={p.label}
                  onPress={() => setPersona(p.key)}
                  style={[styles.personaBtn, active && { backgroundColor: p.color }]}
                >
                  <Icon size={14} color={active ? '#fff' : p.color} />
                  <Text style={[styles.personaTxt, active && { color: '#fff' }]}>{p.label}</Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setShowHistory(true)}
              style={styles.historyBtn}
              testID="open-history"
              accessibilityLabel="Chat history"
            >
              <History size={18} color={theme.colors.muted} />
            </Pressable>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <AlertCircle color={theme.colors.error} size={14} />
              <Text style={styles.errorTxt}>{error}</Text>
              <Pressable onPress={retryLastMessage} style={styles.retryBtn} testID="retry-btn" accessibilityLabel="Retry sending">
                <RefreshCw size={12} color={theme.colors.error} />
              </Pressable>
              <Pressable onPress={() => setError(null)} hitSlop={8} testID="dismiss-error" accessibilityLabel="Dismiss error">
                <X color={theme.colors.error} size={14} />
              </Pressable>
            </View>
          )}

          {/* Messages or Empty State */}
          {messages.length <= 1 && !loading ? (
            <EmptyChatView onSelectPrompt={(p) => { setInput(p); setTimeout(() => send(p), 50); }} />
          ) : (
            <FlatList
              ref={scrollRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={keyExtractor}
              style={styles.msgList}
              contentContainerStyle={styles.msgContent}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={loading ? <TypingIndicator /> : null}
            />
          )}

          {/* Image Attachment Preview */}
          {image && (
            <View style={styles.attachRow}>
              <Image
                source={{ uri: `data:image/jpeg;base64,${image}` }}
                style={styles.attachThumb}
              />
              <Text style={styles.attachTxt}>Photo attached — AI will read the problem</Text>
              <Pressable onPress={removeImage} hitSlop={8} testID="remove-image" accessibilityLabel="Remove image">
                <X color={currentPersona.color} size={18} />
              </Pressable>
            </View>
          )}

          {/* Quick Actions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickBar}
            contentContainerStyle={styles.quickContent}
          >
            {QUICK_ACTIONS.map((a, i) => (
              <Pressable
                key={i}
                style={[styles.quickBtn, { borderColor: currentPersona.color + '40' }]}
                onPress={() => { setInput(a.prompt); setTimeout(() => send(a.prompt), 50); }}
                testID={`quick-action-${i}`}
                accessibilityLabel={a.label}
              >
                <Lightbulb size={12} color={currentPersona.color} />
                <Text style={[styles.quickTxt, { color: currentPersona.color }]}>{a.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Input Row */}
          <View style={styles.inputRow}>
            <Pressable
              onPress={pickImage}
              style={[styles.attachBtn, { backgroundColor: currentPersona.bgLight }]}
              testID="chat-attach"
              accessibilityLabel="Attach image"
            >
              <ImageIcon color={currentPersona.color} size={20} />
            </Pressable>
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              placeholder={currentPersona.placeholder}
              style={styles.input}
              placeholderTextColor={theme.colors.muted}
              multiline
              testID="chat-input"
              accessibilityLabel="Message input"
            />
            <Pressable
              onPress={() => send()}
              disabled={loading || (!input.trim() && !image)}
              style={[
                styles.sendBtn,
                { backgroundColor: currentPersona.color },
                (loading || (!input.trim() && !image)) && styles.sendBtnDisabled,
              ]}
              testID="chat-send"
              accessibilityLabel="Send message"
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Send color="#fff" size={18} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  personaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  personaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  personaTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.onSurfaceTertiary,
  },
  historyBtn: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    marginHorizontal: theme.spacing.lg,
    marginTop: 8,
    padding: 10,
    borderRadius: theme.radius.md,
  },
  errorTxt: {
    flex: 1,
    color: theme.colors.error,
    fontSize: 12,
    fontWeight: '600',
  },
  retryBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgList: { flex: 1 },
  msgContent: {
    padding: theme.spacing.lg,
    paddingBottom: 20,
    gap: 12,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '92%',
  },
  msgRowUser: {
    alignSelf: 'flex-end',
  },
  msgRowAi: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    flex: 1,
    padding: 12,
    borderRadius: theme.radius.md,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  aiName: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  txtUser: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  txtAi: {
    color: theme.colors.onSurface,
    fontSize: 14,
    lineHeight: 20,
  },
  msgImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginBottom: 8,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  timestampAi: {
    color: theme.colors.muted,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
  },
  aiAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingBubble: {
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.brandPrimary,
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    backgroundColor: '#D1FAE5',
  },
  attachThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  attachTxt: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.brand,
    fontWeight: '600',
  },
  quickBar: {
    maxHeight: 44,
  },
  quickContent: {
    gap: 8,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 6,
  },
  quickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
  },
  quickTxt: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: 8,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'flex-end',
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    maxHeight: 100,
    color: theme.colors.onSurface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.md,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyContent: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.onSurface,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  suggestedLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  suggestedGrid: {
    width: '100%',
    gap: 10,
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    padding: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  suggestedText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  newChatBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyHistoryTxt: {
    fontSize: 14,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  historyItem: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    ...theme.shadow.sm,
  },
  historyItemUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyItemTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  historyItemAi: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  historyItemTxtAi: {
    color: theme.colors.onSurface,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  historyItemTime: {
    fontSize: 10,
    color: theme.colors.muted,
    textAlign: 'right',
  },
});
