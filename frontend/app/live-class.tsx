import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Send, Hand, MessageCircle, HelpCircle, BarChart3,
  Users, ChevronUp, Radio, CheckCircle2, Plus, X, Video,
  Clock, CalendarDays,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { LiveSessionDetail, LiveMessage, LiveQuestion, LivePoll, LiveParticipant } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { AsyncView, Button, EmptyState, ProgressBar } from '@/src/ui';
import { connectRealtime, subscribeRealtime } from '@/src/realtime/socket';

const TABS = [
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'qa', label: 'Q&A', icon: HelpCircle },
  { key: 'polls', label: 'Polls', icon: BarChart3 },
  { key: 'people', label: 'People', icon: Users },
];

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function elapsed(startIso: string) {
  const ms = Date.now() - new Date(startIso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── Chat Panel ──────────────────────────────────────────────────
function ChatPanel({ sessionId, initial, canPost }: {
  sessionId: string;
  initial: LiveMessage[];
  canPost: boolean;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LiveMessage[]>(initial);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!initial.length) return;
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      const missing = initial.filter(m => !seen.has(m.id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [initial]);

  useEffect(() => {
    return subscribeRealtime<LiveMessage>('live:message', incoming => {
      setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      const sent = await api<LiveMessage>(`/live-classes/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: body }),
      });
      setMessages(prev => (prev.some(m => m.id === sent.id) ? prev : [...prev, sent]));
    } catch (e: any) {
      setText(body);
      Alert.alert('Message not sent', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.panelWrap}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.panelScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            sub="Say hello to get the conversation started."
            icon={<MessageCircle size={40} color={theme.colors.muted} />}
          />
        ) : (
          messages.map(message => {
            const mine = String(message.author_id) === String(user?.id);
            return (
              <View key={message.id} style={[styles.msgRow, mine && styles.msgRowEnd]}>
                <View style={[styles.msgBubble, mine ? styles.msgMine : styles.msgTheirs]}>
                  {!mine && (
                    <Text style={[styles.msgAuthor, message.author_role === 'faculty' && styles.msgAuthorHost]}>
                      {message.author_name}
                      {message.author_role === 'faculty' ? '  \u00B7  Host' : ''}
                    </Text>
                  )}
                  <Text style={[styles.msgText, mine && styles.msgTextMine]}>{message.text}</Text>
                  <Text style={[styles.msgTime, mine && styles.msgTimeMine]}>{timeOf(message.created_at)}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {canPost ? (
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            accessibilityLabel="Send message"
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={16} color="#fff" />}
          </Pressable>
        </View>
      ) : (
        <View style={styles.disabledBar}>
          <Text style={styles.disabledText}>Chat is disabled for this class.</Text>
        </View>
      )}
    </View>
  );
}

// ─── Q&A Panel ──────────────────────────────────────────────────
function QAPanel({ sessionId, initial, isHost, enabled }: {
  sessionId: string;
  initial: LiveQuestion[];
  isHost: boolean;
  enabled: boolean;
}) {
  const [questions, setQuestions] = useState<LiveQuestion[]>(initial);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  useEffect(() => {
    const offNew = subscribeRealtime<LiveQuestion>('live:question', incoming => {
      setQuestions(prev => (prev.some(q => q.id === incoming.id) ? prev : [incoming, ...prev]));
    });
    const offVote = subscribeRealtime<{ question_id: string; upvotes: number }>('live:question-upvote', payload => {
      setQuestions(prev => prev.map(q => (q.id === payload.question_id ? { ...q, upvotes: payload.upvotes } : q)));
    });
    const offAnswer = subscribeRealtime<{ question_id: string; answer: string }>('live:question-answered', payload => {
      setQuestions(prev => prev.map(q => (q.id === payload.question_id ? { ...q, answer: payload.answer, answered: true } : q)));
    });
    return () => { offNew(); offVote(); offAnswer(); };
  }, []);

  const ask = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const created = await api<LiveQuestion>(`/live-classes/${sessionId}/questions`, {
        method: 'POST',
        body: JSON.stringify({ text: body, anonymous }),
      });
      setQuestions(prev => (prev.some(q => q.id === created.id) ? prev : [created, ...prev]));
      setText('');
    } catch (e: any) {
      Alert.alert('Could not post', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const upvote = async (question: LiveQuestion) => {
    setQuestions(prev => prev.map(q => (
      q.id === question.id
        ? { ...q, upvoted: !q.upvoted, upvotes: q.upvotes + (q.upvoted ? -1 : 1) }
        : q
    )));
    try {
      await api(`/live-classes/${sessionId}/questions/${question.id}/upvote`, { method: 'POST' });
    } catch {
      setQuestions(prev => prev.map(q => (
        q.id === question.id
          ? { ...q, upvoted: question.upvoted, upvotes: question.upvotes }
          : q
      )));
    }
  };

  const submitAnswer = async (questionId: string) => {
    const body = answerText.trim();
    if (!body) return;
    try {
      await api(`/live-classes/${sessionId}/questions/${questionId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer: body }),
      });
      setQuestions(prev => prev.map(q => (q.id === questionId ? { ...q, answer: body, answered: true } : q)));
      setAnswering(null);
      setAnswerText('');
    } catch (e: any) {
      Alert.alert('Could not answer', e?.message || 'Please try again.');
    }
  };

  const sorted = useMemo(() => {
    return [...questions].sort((a, b) => {
      if (a.answered !== b.answered) return a.answered ? 1 : -1;
      return b.upvotes - a.upvotes;
    });
  }, [questions]);

  return (
    <View style={styles.panelWrap}>
      <ScrollView
        contentContainerStyle={styles.panelScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {sorted.length === 0 ? (
          <EmptyState
            title="No questions yet"
            sub="Ask the first one — upvoted questions rise to the top."
            icon={<HelpCircle size={40} color={theme.colors.muted} />}
          />
        ) : (
          sorted.map(question => (
            <View key={question.id} style={styles.qaCard}>
              <View style={styles.qaRow}>
                <Pressable
                  onPress={() => upvote(question)}
                  style={[styles.voteBtn, question.upvoted && styles.voteBtnActive]}
                  accessibilityLabel="Upvote question"
                >
                  <ChevronUp size={14} color={question.upvoted ? '#fff' : theme.colors.brandPrimary} />
                  <Text style={[styles.voteCount, question.upvoted && styles.voteCountActive]}>{question.upvotes}</Text>
                </Pressable>
                <View style={styles.qaContent}>
                  <Text style={styles.qaText}>{question.text}</Text>
                  <Text style={styles.qaMeta}>
                    {question.anonymous ? 'Anonymous' : question.author_name}  \u00B7  {timeOf(question.created_at)}
                  </Text>
                </View>
                {question.answered && <CheckCircle2 size={16} color={theme.colors.success} />}
              </View>

              {question.answer ? (
                <View style={styles.answerBox}>
                  <Text style={styles.answerLabel}>HOST ANSWER</Text>
                  <Text style={styles.answerText}>{question.answer}</Text>
                </View>
              ) : null}

              {isHost && !question.answered && (
                answering === question.id ? (
                  <View style={styles.answerForm}>
                    <TextInput
                      style={styles.answerInput}
                      value={answerText}
                      onChangeText={setAnswerText}
                      placeholder="Type your answer..."
                      placeholderTextColor={theme.colors.muted}
                      multiline
                    />
                    <View style={styles.answerActions}>
                      <Button label="Post" onPress={() => submitAnswer(question.id)} style={{ flex: 1 }} />
                      <Button label="Cancel" variant="secondary" onPress={() => { setAnswering(null); setAnswerText(''); }} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setAnswering(question.id)} style={styles.answerLinkWrap}>
                    <Text style={styles.answerLink}>Answer this question</Text>
                  </Pressable>
                )
              )}
            </View>
          ))
        )}
      </ScrollView>

      {enabled ? (
        <View style={styles.composer}>
          <View style={styles.composerField}>
            <TextInput
              style={styles.composerInput}
              value={text}
              onChangeText={setText}
              placeholder="Ask a question..."
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <Pressable onPress={() => setAnonymous(v => !v)} style={styles.anonRow} accessibilityLabel="Toggle anonymous">
              <View style={[styles.checkbox, anonymous && styles.checkboxOn]}>
                {anonymous && <Text style={styles.checkMark}>\u2713</Text>}
              </View>
              <Text style={styles.anonText}>Anonymous</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={ask}
            disabled={!text.trim() || busy}
            style={[styles.sendBtn, (!text.trim() || busy) && styles.sendBtnDisabled]}
            accessibilityLabel="Post question"
          >
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Send size={16} color="#fff" />}
          </Pressable>
        </View>
      ) : (
        <View style={styles.disabledBar}>
          <Text style={styles.disabledText}>Q&A is disabled for this class.</Text>
        </View>
      )}
    </View>
  );
}

// ─── Polls Panel ────────────────────────────────────────────────
function PollsPanel({ sessionId, initial, isHost }: {
  sessionId: string;
  initial: LivePoll[];
  isHost: boolean;
}) {
  const [polls, setPolls] = useState<LivePoll[]>(initial);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  useEffect(() => {
    const offNew = subscribeRealtime<LivePoll>('live:poll', incoming => {
      setPolls(prev => (prev.some(p => p.id === incoming.id) ? prev : [incoming, ...prev]));
    });
    const offUpdate = subscribeRealtime<{ poll_id: string; votes: number[]; total_votes: number }>('live:poll-update', payload => {
      setPolls(prev => prev.map(p => (p.id === payload.poll_id ? { ...p, votes: payload.votes, total_votes: payload.total_votes } : p)));
    });
    const offClosed = subscribeRealtime<{ poll_id: string }>('live:poll-closed', payload => {
      setPolls(prev => prev.map(p => (p.id === payload.poll_id ? { ...p, status: 'closed' } : p)));
    });
    return () => { offNew(); offUpdate(); offClosed(); };
  }, []);

  const vote = async (poll: LivePoll, optionIndex: number) => {
    if (poll.status !== 'open') return;
    try {
      const result = await api<{ votes: number[]; total_votes: number; my_vote: number }>(
        `/live-classes/${sessionId}/polls/${poll.id}/vote`,
        { method: 'POST', body: JSON.stringify({ optionIndex }) },
      );
      setPolls(prev => prev.map(p => (
        p.id === poll.id ? { ...p, votes: result.votes, total_votes: result.total_votes, my_vote: result.my_vote } : p
      )));
    } catch (e: any) {
      Alert.alert('Vote failed', e?.message || 'Please try again.');
    }
  };

  const createPoll = async () => {
    const cleaned = options.map(o => o.trim()).filter(Boolean);
    if (!question.trim() || cleaned.length < 2) {
      Alert.alert('Incomplete poll', 'Add a question and at least two options.');
      return;
    }
    try {
      const created = await api<LivePoll>(`/live-classes/${sessionId}/polls`, {
        method: 'POST',
        body: JSON.stringify({ question: question.trim(), options: cleaned }),
      });
      setPolls(prev => (prev.some(p => p.id === created.id) ? prev : [created, ...prev]));
      setQuestion('');
      setOptions(['', '']);
      setCreating(false);
    } catch (e: any) {
      Alert.alert('Could not create poll', e?.message || 'Please try again.');
    }
  };

  const closePoll = async (pollId: string) => {
    try {
      await api(`/live-classes/${sessionId}/polls/${pollId}/close`, { method: 'POST' });
      setPolls(prev => prev.map(p => (p.id === pollId ? { ...p, status: 'closed' } : p)));
    } catch (e: any) {
      Alert.alert('Could not close poll', e?.message || 'Please try again.');
    }
  };

  return (
    <View style={styles.panelWrap}>
      <ScrollView
        contentContainerStyle={styles.panelScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isHost && (
          creating ? (
            <View style={styles.pollForm}>
              <View style={styles.pollFormHeader}>
                <Text style={styles.pollFormTitle}>New Poll</Text>
                <Pressable onPress={() => setCreating(false)} accessibilityLabel="Cancel poll">
                  <X size={16} color={theme.colors.muted} />
                </Pressable>
              </View>
              <TextInput
                style={styles.pollInput}
                value={question}
                onChangeText={setQuestion}
                placeholder="Enter your question..."
                placeholderTextColor={theme.colors.muted}
              />
              {options.map((option, index) => (
                <TextInput
                  key={index}
                  style={styles.pollInput}
                  value={option}
                  onChangeText={value => setOptions(prev => prev.map((o, i) => (i === index ? value : o)))}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={theme.colors.muted}
                />
              ))}
              {options.length < 6 && (
                <Pressable onPress={() => setOptions(prev => [...prev, ''])} style={styles.addOption}>
                  <Plus size={14} color={theme.colors.brandPrimary} />
                  <Text style={styles.addOptionText}>Add option</Text>
                </Pressable>
              )}
              <Button label="Launch poll" onPress={createPoll} />
            </View>
          ) : (
            <Button label="Create a poll" icon={<Plus size={14} color="#fff" />} onPress={() => setCreating(true)} />
          )
        )}

        {polls.length === 0 ? (
          <EmptyState
            title="No polls yet"
            sub={isHost ? 'Create a poll to check understanding in real time.' : 'Your host has not run a poll yet.'}
            icon={<BarChart3 size={40} color={theme.colors.muted} />}
          />
        ) : (
          polls.map(poll => (
            <View key={poll.id} style={styles.pollCard}>
              <View style={styles.pollHeader}>
                <Text style={styles.pollQuestion} numberOfLines={2}>{poll.question}</Text>
                <View style={[styles.pollBadge, { backgroundColor: poll.status === 'open' ? '#DCFCE7' : theme.colors.surfaceTertiary }]}>
                  <Text style={[styles.pollBadgeText, { color: poll.status === 'open' ? '#16A34A' : theme.colors.muted }]}>
                    {poll.status === 'open' ? 'OPEN' : 'CLOSED'}
                  </Text>
                </View>
              </View>

              {poll.options.map((option, index) => {
                const count = poll.votes[index] || 0;
                const pct = poll.total_votes ? Math.round((count / poll.total_votes) * 100) : 0;
                const chosen = poll.my_vote === index;
                return (
                  <Pressable key={index} onPress={() => vote(poll, index)} disabled={poll.status !== 'open'} style={styles.pollOptionWrap}>
                    <View style={styles.pollOptionHeader}>
                      <Text style={[styles.pollOptionText, chosen && styles.pollOptionChosen]}>
                        {chosen ? '\u25CF ' : '\u25CB '}{option}
                      </Text>
                      <Text style={styles.pollOptionPct}>{pct}% ({count})</Text>
                    </View>
                    <ProgressBar value={pct} max={100} height={5} color={chosen ? theme.colors.brandPrimary : theme.colors.brandSecondary} />
                  </Pressable>
                );
              })}

              <View style={styles.pollFooter}>
                <Text style={styles.pollTotal}>{poll.total_votes} vote{poll.total_votes === 1 ? '' : 's'}</Text>
                {isHost && poll.status === 'open' && (
                  <Pressable onPress={() => closePoll(poll.id)} style={styles.closePollBtn}>
                    <Text style={styles.closePollText}>Close poll</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ─── People Panel ───────────────────────────────────────────────
function PeoplePanel({ participants }: { participants: LiveParticipant[] }) {
  const [people, setPeople] = useState<LiveParticipant[]>(participants);

  useEffect(() => {
    const offJoin = subscribeRealtime<LiveParticipant>('live:participant-joined', incoming => {
      setPeople(prev => {
        const existing = prev.findIndex(p => p.student_id === incoming.student_id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = incoming;
          return next;
        }
        return [...prev, incoming];
      });
    });
    const offLeave = subscribeRealtime<{ student_id: string }>('live:participant-left', payload => {
      setPeople(prev => prev.map(p => (p.student_id === payload.student_id ? { ...p, active: false } : p)));
    });
    const offHand = subscribeRealtime<{ student_id: string; raised: boolean }>('live:hand', payload => {
      setPeople(prev => prev.map(p => (p.student_id === payload.student_id ? { ...p, hand_raised: payload.raised } : p)));
    });
    return () => { offJoin(); offLeave(); offHand(); };
  }, []);

  const active = people.filter(p => p.active);
  const inactive = people.filter(p => !p.active);

  return (
    <View style={styles.panelWrap}>
      <ScrollView
        contentContainerStyle={styles.panelScrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.peopleHeader}>
          <Text style={styles.peopleSectionTitle}>In class ({active.length})</Text>
        </View>
        {active.length === 0 ? (
          <EmptyState
            title="Nobody here yet"
            sub="Participants appear as they join."
            icon={<Users size={40} color={theme.colors.muted} />}
          />
        ) : (
          active.map(person => (
            <View key={person.student_id} style={styles.personRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{person.student_name?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.personInfo}>
                <Text style={styles.personName}>{person.student_name}</Text>
                <Text style={styles.personMeta}>Joined {timeOf(person.joined_at)}</Text>
              </View>
              {person.hand_raised && (
                <View style={styles.handBadge}>
                  <Hand size={14} color={theme.colors.warning} />
                </View>
              )}
            </View>
          ))
        )}

        {inactive.length > 0 && (
          <>
            <View style={styles.peopleHeader}>
              <Text style={[styles.peopleSectionTitle, { marginTop: theme.spacing.lg }]}>Left ({inactive.length})</Text>
            </View>
            {inactive.map(person => (
              <View key={person.student_id} style={[styles.personRow, styles.personRowInactive]}>
                <View style={[styles.avatar, styles.avatarInactive]}>
                  <Text style={[styles.avatarText, { color: theme.colors.muted }]}>{person.student_name?.charAt(0)?.toUpperCase() || '?'}</Text>
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{person.student_name}</Text>
                  <Text style={styles.personMeta}>Left {person.left_at ? timeOf(person.left_at) : ''}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────
export default function LiveClassRoom() {
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = String(params.id || '');
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFetch<LiveSessionDetail>(sessionId ? `/live-classes/${sessionId}` : null);
  const { data: messages } = useFetch<LiveMessage[]>(sessionId ? `/live-classes/${sessionId}/messages` : null);

  const [tab, setTab] = useState('chat');
  const [joined, setJoined] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [busy, setBusy] = useState(false);
  const joinedRef = useRef(false);

  const isHost = !!data?.is_host;

  // Socket room subscription — subscribe on mount, unsubscribe on unmount
  useEffect(() => {
    if (!sessionId) return;
    let socketRef: any = null;
    let active = true;
    connectRealtime().then(socket => {
      if (!active || !socket) return;
      socketRef = socket;
      socket.emit('live:subscribe', sessionId);
    });
    return () => {
      active = false;
      if (socketRef) {
        try { socketRef.emit('live:unsubscribe', sessionId); } catch {}
      }
    };
  }, [sessionId]);

  // Sync joined state from server
  useEffect(() => {
    if (data?.joined) {
      setJoined(true);
      joinedRef.current = true;
    }
  }, [data?.joined]);

  // Listen for status changes (started/ended)
  useEffect(() => subscribeRealtime<{ sessionId: string; status: string }>('live:status', () => refresh()), [refresh]);

  const join = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/live-classes/${sessionId}/join`, { method: 'POST' });
      setJoined(true);
      joinedRef.current = true;
      refresh();
    } catch (e: any) {
      Alert.alert('Could not join', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [sessionId, busy, refresh]);

  const leave = useCallback(async () => {
    try {
      await api(`/live-classes/${sessionId}/leave`, { method: 'POST', body: JSON.stringify({}) });
    } catch {}
    joinedRef.current = false;
    setJoined(false);
    refresh();
  }, [sessionId, refresh]);

  // Cleanup: leave on unmount
  useEffect(() => () => {
    if (joinedRef.current) {
      api(`/live-classes/${sessionId}/leave`, { method: 'POST', body: JSON.stringify({}) }).catch(() => {});
    }
  }, [sessionId]);

  const toggleHand = async () => {
    const next = !handRaised;
    setHandRaised(next);
    try {
      await api(`/live-classes/${sessionId}/hand`, { method: 'POST', body: JSON.stringify({ raised: next }) });
    } catch (e: any) {
      setHandRaised(!next);
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  };

  const startClass = async () => {
    try {
      await api(`/live-classes/${sessionId}/start`, { method: 'POST' });
      refresh();
    } catch (e: any) {
      Alert.alert('Could not start', e?.message || 'Please try again.');
    }
  };

  const endClass = async () => {
    Alert.alert('End this class?', 'Participants will be disconnected and attendance finalised.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End class',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/live-classes/${sessionId}/end`, { method: 'POST', body: JSON.stringify({}) });
            refresh();
          } catch (e: any) {
            Alert.alert('Could not end', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back" style={styles.backBtn}>
            <ArrowLeft color={theme.colors.onSurface} size={20} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{data?.title || 'Live class'}</Text>
            <View style={styles.headerMeta}>
              {data?.status === 'live' && <View style={styles.liveDot} />}
              <Text style={styles.headerSub}>
                {data?.status === 'live'
                  ? `Live \u00B7 ${data?.active_count || 0} watching`
                  : data?.status === 'ended' ? 'Ended' : 'Not started yet'}
              </Text>
              {data?.status === 'live' && data?.started_at && (
                <Text style={styles.headerElapsed}>{elapsed(data.started_at)}</Text>
              )}
            </View>
          </View>
          {joined && data?.status === 'live' && !isHost && (
            <Pressable
              onPress={toggleHand}
              style={[styles.handBtn, handRaised && styles.handBtnActive]}
              accessibilityLabel={handRaised ? 'Lower hand' : 'Raise hand'}
            >
              <Hand size={16} color={handRaised ? '#fff' : theme.colors.warning} />
            </Pressable>
          )}
        </View>

        <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
          {data && (
            <View style={styles.roomBody}>
              {/* Status Banner */}
              {data.status !== 'live' && (
                <View style={[styles.banner, data.status === 'ended' && styles.bannerEnded]}>
                  {data.status === 'ended' ? (
                    <CheckCircle2 size={14} color={theme.colors.muted} />
                  ) : (
                    <Video size={14} color={theme.colors.brandPrimary} />
                  )}
                  <Text style={[styles.bannerText, data.status === 'ended' && styles.bannerTextEnded]}>
                    {data.status === 'ended'
                      ? 'This class has ended. You can still read the chat and Q&A.'
                      : `Starts ${new Date(data.scheduled_at).toLocaleString()}`}
                  </Text>
                </View>
              )}

              {/* Action Bar */}
              {isHost && data.status === 'scheduled' && (
                <View style={styles.actionBar}>
                  <Button label="Start class" icon={<Radio size={14} color="#fff" />} onPress={startClass} style={{ flex: 1 }} />
                </View>
              )}
              {isHost && data.status === 'live' && (
                <View style={styles.actionBar}>
                  <Button label="End class" variant="secondary" onPress={endClass} style={{ flex: 1 }} />
                </View>
              )}
              {!isHost && data.status !== 'ended' && (
                <View style={styles.actionBar}>
                  {joined ? (
                    <Button label="Leave class" variant="secondary" onPress={leave} style={{ flex: 1 }} />
                  ) : (
                    <Button label="Join class" loading={busy} onPress={join} style={{ flex: 1 }} />
                  )}
                </View>
              )}

              {/* Tab Bar */}
              <View style={styles.tabBar}>
                {TABS.map(t => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, active && styles.tabActive]}>
                      <Icon size={14} color={active ? theme.colors.brandPrimary : theme.colors.muted} />
                      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Panel */}
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.panelContainer}
                keyboardVerticalOffset={0}
              >
                {tab === 'chat' && (
                  <ChatPanel
                    sessionId={sessionId}
                    initial={messages || []}
                    canPost={data.allow_chat !== false && data.status !== 'ended'}
                  />
                )}
                {tab === 'qa' && (
                  <QAPanel
                    sessionId={sessionId}
                    initial={data.questions || []}
                    isHost={isHost}
                    enabled={data.allow_questions !== false && data.status !== 'ended'}
                  />
                )}
                {tab === 'polls' && (
                  <PollsPanel sessionId={sessionId} initial={data.polls || []} isHost={isHost} />
                )}
                {tab === 'people' && (
                  <PeoplePanel participants={data.participants || []} />
                )}
              </KeyboardAvoidingView>
            </View>
          )}
        </AsyncView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surface },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  backBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, marginHorizontal: theme.spacing.md },
  headerTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' },
  headerSub: { fontSize: 11, color: theme.colors.muted, fontWeight: '500' },
  headerElapsed: { fontSize: 11, color: '#DC2626', fontWeight: '700' },
  handBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  handBtnActive: { backgroundColor: theme.colors.warning, borderColor: theme.colors.warning },

  // Room body
  roomBody: { flex: 1 },

  // Banner
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.brandTertiary, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
  bannerEnded: { backgroundColor: theme.colors.surfaceTertiary },
  bannerText: { flex: 1, fontSize: 12, color: theme.colors.onBrandTertiary, fontWeight: '600' },
  bannerTextEnded: { color: theme.colors.muted },

  // Action bar
  actionBar: { flexDirection: 'row', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },

  // Tab bar
  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.brandPrimary },
  tabLabel: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  tabLabelActive: { color: theme.colors.brandPrimary, fontWeight: '700' },

  // Panel container
  panelContainer: { flex: 1 },
  panelWrap: { flex: 1 },
  panelScrollContent: { padding: theme.spacing.lg, gap: theme.spacing.sm },

  // Chat
  msgRow: { flexDirection: 'row' },
  msgRowEnd: { justifyContent: 'flex-end' },
  msgBubble: { maxWidth: '80%', borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  msgMine: { backgroundColor: theme.colors.brandPrimary, borderBottomRightRadius: 4 },
  msgTheirs: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderBottomLeftRadius: 4 },
  msgAuthor: { fontSize: 10, fontWeight: '700', color: theme.colors.brandPrimary },
  msgAuthorHost: { color: '#DC2626' },
  msgText: { fontSize: 13, color: theme.colors.onSurface, lineHeight: 18 },
  msgTextMine: { color: '#fff' },
  msgTime: { fontSize: 9, color: theme.colors.muted, alignSelf: 'flex-end' },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },

  // Composer
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm, padding: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  composerField: { flex: 1, gap: 6 },
  composerInput: { flex: 1, maxHeight: 90, minHeight: 40, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.onSurface, backgroundColor: theme.colors.surface },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
  disabledBar: { padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.border, alignItems: 'center' },
  disabledText: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },

  // Q&A
  qaCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, gap: 8 },
  qaRow: { flexDirection: 'row', gap: theme.spacing.sm },
  voteBtn: { alignItems: 'center', justifyContent: 'center', width: 40, paddingVertical: 6, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandTertiary },
  voteBtnActive: { backgroundColor: theme.colors.brandPrimary },
  voteCount: { fontSize: 11, fontWeight: '800', color: theme.colors.brandPrimary },
  voteCountActive: { color: '#fff' },
  qaContent: { flex: 1 },
  qaText: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600', lineHeight: 18 },
  qaMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 3 },
  answerBox: { backgroundColor: '#ECFDF5', borderRadius: theme.radius.sm, padding: theme.spacing.md, gap: 3, borderLeftWidth: 3, borderLeftColor: '#10B981' },
  answerLabel: { fontSize: 9, fontWeight: '800', color: '#059669', letterSpacing: 0.5 },
  answerText: { fontSize: 12, color: '#065F46', lineHeight: 17 },
  answerForm: { gap: 8 },
  answerInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, padding: theme.spacing.md, minHeight: 60, textAlignVertical: 'top', fontSize: 12, color: theme.colors.onSurface, backgroundColor: theme.colors.surface },
  answerActions: { flexDirection: 'row', gap: 8 },
  answerLinkWrap: { paddingTop: 4 },
  answerLink: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '900' },
  anonText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  // Polls
  pollForm: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, gap: theme.spacing.sm },
  pollFormHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pollFormTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  pollInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, fontSize: 13, color: theme.colors.onSurface, backgroundColor: theme.colors.surface },
  addOption: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addOptionText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  pollCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.lg, gap: theme.spacing.sm },
  pollHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm },
  pollQuestion: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, lineHeight: 19 },
  pollBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  pollBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  pollOptionWrap: { gap: 4 },
  pollOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pollOptionText: { fontSize: 12, color: theme.colors.onSurface, flex: 1 },
  pollOptionChosen: { color: theme.colors.brandPrimary, fontWeight: '700' },
  pollOptionPct: { fontSize: 11, color: theme.colors.muted, fontWeight: '700', marginLeft: theme.spacing.sm },
  pollFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: theme.spacing.xs },
  pollTotal: { fontSize: 11, color: theme.colors.muted },
  closePollBtn: { paddingHorizontal: theme.spacing.md, paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceTertiary, borderWidth: 1, borderColor: theme.colors.border },
  closePollText: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },

  // People
  peopleHeader: { paddingBottom: theme.spacing.sm },
  peopleSectionTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.onSurface, textTransform: 'uppercase', letterSpacing: 0.5 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  personRowInactive: { opacity: 0.55, backgroundColor: theme.colors.surfaceTertiary },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarInactive: { backgroundColor: theme.colors.surfaceTertiary },
  avatarText: { fontSize: 13, fontWeight: '800', color: theme.colors.brandPrimary },
  personInfo: { flex: 1 },
  personName: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  personMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  handBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
});
