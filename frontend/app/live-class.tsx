import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from '@/src/navigation/router';
import {
  ArrowLeft, Send, Hand, MessageCircle, HelpCircle, BarChart3,
  Users, ChevronUp, Radio, CheckCircle2, Plus, X, Video,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { LiveSessionDetail, LiveMessage, LiveQuestion, LivePoll, LiveParticipant } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, Button, EmptyState, ProgressBar } from '@/src/ui';
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

// ─── Chat ────────────────────────────────────────────────────────
function ChatPanel({ sessionId, initial, canPost }: {
  sessionId: string;
  initial: LiveMessage[] | undefined;
  canPost: boolean;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LiveMessage[]>(initial || []);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // History can resolve after this panel mounts, and realtime messages may already
  // have arrived — merge rather than overwrite.
  useEffect(() => {
    if (!initial?.length) return;
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      const missing = initial.filter(m => !seen.has(m.id));
      return missing.length ? [...missing, ...prev] : prev;
    });
  }, [initial]);

  useEffect(() => {
    return subscribeRealtime<LiveMessage>('live:message', incoming => {
      setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
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
    <View style={{ flex: 1 }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: theme.spacing.lg, gap: 10 }}>
        {messages.length === 0 ? (
          <EmptyState title="No messages yet" sub="Say hello to get the conversation started." icon={<MessageCircle size={44} color={theme.colors.muted} />} />
        ) : (
          messages.map(message => {
            const mine = String(message.author_id) === String(user?.id);
            return (
              <View key={message.id} style={[styles.msgRow, mine && { justifyContent: 'flex-end' }]}>
                <View style={[styles.msgBubble, mine ? styles.msgMine : styles.msgTheirs]}>
                  {!mine && (
                    <Text style={styles.msgAuthor}>
                      {message.author_name}
                      {message.author_role === 'faculty' ? ' · Host' : ''}
                    </Text>
                  )}
                  <Text style={[styles.msgText, mine && { color: '#fff' }]}>{message.text}</Text>
                  <Text style={[styles.msgTime, mine && { color: 'rgba(255,255,255,0.7)' }]}>{timeOf(message.created_at)}</Text>
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
            placeholder="Type a message"
            placeholderTextColor={theme.colors.muted}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.4 }]}
            accessibilityLabel="Send message"
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Send size={17} color="#fff" />}
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

// ─── Q&A ─────────────────────────────────────────────────────────
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
    // Optimistic — the socket event reconciles the authoritative count.
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

  const sorted = [...questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    return b.upvotes - a.upvotes;
  });

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 10 }}>
        {sorted.length === 0 ? (
          <EmptyState title="No questions yet" sub="Ask the first one — upvoted questions rise to the top." icon={<HelpCircle size={44} color={theme.colors.muted} />} />
        ) : (
          sorted.map(question => (
            <Card key={question.id} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => upvote(question)}
                  style={[styles.voteBtn, question.upvoted && styles.voteBtnActive]}
                  accessibilityLabel="Upvote question"
                >
                  <ChevronUp size={16} color={question.upvoted ? '#fff' : theme.colors.brandPrimary} />
                  <Text style={[styles.voteCount, question.upvoted && { color: '#fff' }]}>{question.upvotes}</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qText}>{question.text}</Text>
                  <Text style={styles.qMeta}>{question.author_name} · {timeOf(question.created_at)}</Text>
                </View>
                {question.answered && <CheckCircle2 size={17} color={theme.colors.success} />}
              </View>

              {question.answer ? (
                <View style={styles.answerBox}>
                  <Text style={styles.answerLabel}>Answer</Text>
                  <Text style={styles.answerText}>{question.answer}</Text>
                </View>
              ) : null}

              {isHost && !question.answered && (
                answering === question.id ? (
                  <View style={{ gap: 8 }}>
                    <TextInput
                      style={styles.answerInput}
                      value={answerText}
                      onChangeText={setAnswerText}
                      placeholder="Type your answer"
                      placeholderTextColor={theme.colors.muted}
                      multiline
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button label="Post answer" onPress={() => submitAnswer(question.id)} style={{ flex: 1 }} />
                      <Button label="Cancel" variant="secondary" onPress={() => { setAnswering(null); setAnswerText(''); }} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => setAnswering(question.id)}>
                    <Text style={styles.answerLink}>Answer this question</Text>
                  </Pressable>
                )
              )}
            </Card>
          ))
        )}
      </ScrollView>

      {enabled ? (
        <View style={styles.composer}>
          <View style={{ flex: 1, gap: 6 }}>
            <TextInput
              style={styles.composerInput}
              value={text}
              onChangeText={setText}
              placeholder="Ask a question"
              placeholderTextColor={theme.colors.muted}
              multiline
            />
            <Pressable onPress={() => setAnonymous(v => !v)} style={styles.anonRow} accessibilityLabel="Toggle anonymous">
              <View style={[styles.checkbox, anonymous && styles.checkboxOn]}>
                {anonymous && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.anonText}>Ask anonymously</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={ask}
            disabled={!text.trim() || busy}
            style={[styles.sendBtn, (!text.trim() || busy) && { opacity: 0.4 }]}
            accessibilityLabel="Post question"
          >
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Send size={17} color="#fff" />}
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

// ─── Polls ───────────────────────────────────────────────────────
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
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12 }}>
      {isHost && (
        creating ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.sectionLabel}>New poll</Text>
              <Pressable onPress={() => setCreating(false)} accessibilityLabel="Cancel poll">
                <X size={18} color={theme.colors.muted} />
              </Pressable>
            </View>
            <TextInput
              style={styles.pollInput}
              value={question}
              onChangeText={setQuestion}
              placeholder="Poll question"
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
          </Card>
        ) : (
          <Button label="Create a poll" icon={<Plus size={16} color="#fff" />} onPress={() => setCreating(true)} />
        )
      )}

      {polls.length === 0 ? (
        <EmptyState title="No polls yet" sub={isHost ? 'Create a poll to check understanding in real time.' : 'Your host has not run a poll yet.'} icon={<BarChart3 size={44} color={theme.colors.muted} />} />
      ) : (
        polls.map(poll => (
          <Card key={poll.id} style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <Text style={styles.pollQuestion}>{poll.question}</Text>
              <View style={[styles.pill, { backgroundColor: poll.status === 'open' ? '#DCFCE7' : theme.colors.surfaceTertiary }]}>
                <Text style={[styles.pillText, { color: poll.status === 'open' ? '#16A34A' : theme.colors.muted }]}>
                  {poll.status === 'open' ? 'OPEN' : 'CLOSED'}
                </Text>
              </View>
            </View>

            {poll.options.map((option, index) => {
              const count = poll.votes[index] || 0;
              const pct = poll.total_votes ? Math.round((count / poll.total_votes) * 100) : 0;
              const chosen = poll.my_vote === index;
              return (
                <Pressable key={index} onPress={() => vote(poll, index)} disabled={poll.status !== 'open'}>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={[styles.pollOption, chosen && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                        {chosen ? '● ' : '○ '}{option}
                      </Text>
                      <Text style={styles.pollPct}>{pct}% ({count})</Text>
                    </View>
                    <ProgressBar value={pct} max={100} height={6} color={chosen ? theme.colors.brandPrimary : theme.colors.brandSecondary} />
                  </View>
                </Pressable>
              );
            })}

            <Text style={styles.pollTotal}>{poll.total_votes} vote{poll.total_votes === 1 ? '' : 's'}</Text>

            {isHost && poll.status === 'open' && (
              <Button label="Close poll" variant="secondary" onPress={() => closePoll(poll.id)} />
            )}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

// ─── People ──────────────────────────────────────────────────────
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
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 8 }}>
      <Text style={styles.sectionLabel}>In class ({active.length})</Text>
      {active.map(person => (
        <Card key={person.student_id} style={styles.personRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{person.student_name?.charAt(0)?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.personName}>{person.student_name}</Text>
            <Text style={styles.personMeta}>Joined {timeOf(person.joined_at)}</Text>
          </View>
          {person.hand_raised && <Hand size={17} color={theme.colors.warning} />}
        </Card>
      ))}
      {active.length === 0 && (
        <EmptyState title="Nobody here yet" sub="Participants appear as they join." icon={<Users size={44} color={theme.colors.muted} />} />
      )}

      {inactive.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: theme.spacing.md }]}>Left ({inactive.length})</Text>
          {inactive.map(person => (
            <Card key={person.student_id} style={[styles.personRow, { opacity: 0.55 }]}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceTertiary }]}>
                <Text style={[styles.avatarText, { color: theme.colors.muted }]}>{person.student_name?.charAt(0)?.toUpperCase() || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{person.student_name}</Text>
                <Text style={styles.personMeta}>Left {person.left_at ? timeOf(person.left_at) : ''}</Text>
              </View>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

// ─── Screen ──────────────────────────────────────────────────────
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

  // Subscribe the socket to this class's room so realtime events arrive.
  useEffect(() => {
    if (!sessionId) return;
    let socketRef: any = null;
    connectRealtime().then(socket => {
      if (!socket) return;
      socketRef = socket;
      socket.emit('live:subscribe', sessionId);
    });
    return () => {
      if (socketRef) socketRef.emit('live:unsubscribe', sessionId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (data?.joined) {
      setJoined(true);
      joinedRef.current = true;
    }
  }, [data?.joined]);

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
    } catch {
      // Leaving is best-effort; the host's end-class sweep closes stragglers.
    }
    joinedRef.current = false;
    setJoined(false);
  }, [sessionId]);

  // Mark the student as left if they navigate away without tapping Leave.
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
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <View style={{ flex: 1, marginHorizontal: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{data?.title || 'Live class'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {data?.status === 'live' && <View style={styles.liveDot} />}
              <Text style={styles.headerSub}>
                {data?.status === 'live'
                  ? `Live · ${data?.active_count || 0} watching`
                  : data?.status === 'ended' ? 'Ended' : 'Not started yet'}
              </Text>
            </View>
          </View>
          {joined && data?.status === 'live' && !isHost && (
            <Pressable onPress={toggleHand} style={[styles.handBtn, handRaised && styles.handBtnOn]} accessibilityLabel="Raise hand">
              <Hand size={18} color={handRaised ? '#fff' : theme.colors.warning} />
            </Pressable>
          )}
        </View>

        <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
          {data && (
            <>
              {data.status !== 'live' && (
                <View style={styles.banner}>
                  <Video size={16} color={theme.colors.brandPrimary} />
                  <Text style={styles.bannerText}>
                    {data.status === 'ended'
                      ? 'This class has ended. You can still read the chat and Q&A.'
                      : `Starts ${new Date(data.scheduled_at).toLocaleString()}`}
                  </Text>
                </View>
              )}

              {isHost && data.status === 'scheduled' && (
                <View style={styles.hostBar}>
                  <Button label="Start class" icon={<Radio size={16} color="#fff" />} onPress={startClass} style={{ flex: 1 }} />
                </View>
              )}
              {isHost && data.status === 'live' && (
                <View style={styles.hostBar}>
                  <Button label="End class" variant="secondary" onPress={endClass} style={{ flex: 1 }} />
                </View>
              )}

              {!isHost && data.status !== 'ended' && (
                <View style={styles.hostBar}>
                  {joined ? (
                    <Button label="Leave class" variant="secondary" onPress={leave} style={{ flex: 1 }} />
                  ) : (
                    <Button label="Join class" loading={busy} onPress={join} style={{ flex: 1 }} />
                  )}
                </View>
              )}

              <View style={styles.tabBar}>
                {TABS.map(t => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, active && styles.tabActive]}>
                      <Icon size={16} color={active ? theme.colors.brandPrimary : theme.colors.muted} />
                      <Text style={[styles.tabLabel, active && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                        {t.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={90}
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
            </>
          )}
        </AsyncView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  headerSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DC2626' },
  handBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7' },
  handBtnOn: { backgroundColor: theme.colors.warning },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
  },
  bannerText: { flex: 1, fontSize: 12, color: theme.colors.onBrandTertiary, fontWeight: '600' },
  hostBar: { flexDirection: 'row', gap: 10, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md },
  tabBar: {
    flexDirection: 'row', marginTop: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.brandPrimary },
  tabLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  msgRow: { flexDirection: 'row' },
  msgBubble: { maxWidth: '82%', borderRadius: theme.radius.lg, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  msgMine: { backgroundColor: theme.colors.brandPrimary, borderBottomRightRadius: 4 },
  msgTheirs: { backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderBottomLeftRadius: 4 },
  msgAuthor: { fontSize: 10, fontWeight: '700', color: theme.colors.brandPrimary },
  msgText: { fontSize: 14, color: theme.colors.onSurface, lineHeight: 19 },
  msgTime: { fontSize: 9, color: theme.colors.muted, alignSelf: 'flex-end' },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: theme.spacing.md,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  composerInput: {
    flex: 1, maxHeight: 100, minHeight: 42,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: theme.colors.onSurface, backgroundColor: theme.colors.surface,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  disabledBar: { padding: theme.spacing.lg, borderTopWidth: 1, borderTopColor: theme.colors.border, alignItems: 'center' },
  disabledText: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },

  voteBtn: {
    alignItems: 'center', justifyContent: 'center', width: 44, paddingVertical: 6,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.brandPrimary,
    backgroundColor: theme.colors.brandTertiary,
  },
  voteBtnActive: { backgroundColor: theme.colors.brandPrimary },
  voteCount: { fontSize: 12, fontWeight: '800', color: theme.colors.brandPrimary },
  qText: { fontSize: 14, color: theme.colors.onSurface, fontWeight: '600', lineHeight: 19 },
  qMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 3 },
  answerBox: { backgroundColor: '#ECFDF5', borderRadius: theme.radius.md, padding: 10, gap: 3 },
  answerLabel: { fontSize: 10, fontWeight: '800', color: '#059669', letterSpacing: 0.5 },
  answerText: { fontSize: 13, color: '#065F46', lineHeight: 18 },
  answerLink: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  answerInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 10, minHeight: 70, textAlignVertical: 'top',
    fontSize: 13, color: theme.colors.onSurface, backgroundColor: theme.colors.surface,
  },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  checkMark: { color: '#fff', fontSize: 10, fontWeight: '900' },
  anonText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  pollQuestion: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  pollOption: { fontSize: 13, color: theme.colors.onSurface },
  pollPct: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  pollTotal: { fontSize: 11, color: theme.colors.muted },
  pollInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: theme.colors.onSurface, backgroundColor: theme.colors.surface,
  },
  addOption: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addOptionText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800', color: theme.colors.brandPrimary },
  personName: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  personMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
});
