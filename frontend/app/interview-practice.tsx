import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Sparkles, Mic, Play, Pause, RotateCcw, CheckCircle, AlertTriangle,
  ChevronRight, Clock, Target, TrendingUp, MessageSquare, Award,
} from 'lucide-react-native';

const INTERVIEW_TYPES = [
  { id: 'technical', title: 'Technical Interview', icon: Target, desc: 'Coding problems, system design, algorithms' },
  { id: 'behavioral', title: 'Behavioral Interview', icon: MessageSquare, desc: 'STAR method, leadership, teamwork' },
  { id: 'hr', title: 'HR Interview', icon: ChevronRight, desc: 'Salary, career goals, company culture' },
];

const MOCK_QUESTIONS: Record<string, { q: string; tips: string[]; sampleAnswer: string }[]> = {
  technical: [
    {
      q: 'Explain the difference between a stack and a queue. When would you use each?',
      tips: ['Mention FIFO vs LIFO', 'Give real-world examples', 'Discuss time complexity'],
      sampleAnswer: 'A stack follows LIFO (Last In First Out) principle - like a plate stack. Used in function calls, undo operations, and backtracking. A queue follows FIFO (First In First Out) - like a line at a store. Used in BFS, task scheduling, and print queues. Both have O(1) push/enqueue and pop/dequeue operations.',
    },
    {
      q: 'How would you design a URL shortener like bit.ly?',
      tips: ['Consider scalability', 'Discuss hashing strategies', 'Think about storage'],
      sampleAnswer: 'I\'d use a hash function to generate short codes from URLs. Store mappings in a distributed database like DynamoDB. Use Redis for caching popular URLs. Implement a counter-based approach for generating unique IDs. Add analytics for click tracking. Consider rate limiting to prevent abuse.',
    },
    {
      q: 'What is a deadlock? How do you prevent it?',
      tips: ['Define 4 conditions', 'Give an example', 'Mention prevention strategies'],
      sampleAnswer: 'Deadlock occurs when four conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait. Example: Thread A holds Lock 1 and waits for Lock 2, while Thread B holds Lock 2 and waits for Lock 1. Prevention strategies include lock ordering, timeout mechanisms, and using atomic operations.',
    },
  ],
  behavioral: [
    {
      q: 'Tell me about a time you faced a conflict with a team member. How did you resolve it?',
      tips: ['Use STAR method', 'Focus on resolution', 'Show emotional intelligence'],
      sampleAnswer: 'Situation: During a group project, a teammate disagreed with my approach to the database schema. Task: We needed to resolve this to meet our deadline. Action: I scheduled a one-on-one meeting, listened to their concerns, and we found that their approach was better for scalability. Result: We combined both approaches, delivered on time, and I learned to be more open to alternative perspectives.',
    },
    {
      q: 'Describe a situation where you had to learn something quickly.',
      tips: ['Show adaptability', 'Mention specific learning strategy', 'Quantify results'],
      sampleAnswer: 'Situation: Two weeks before a hackathon, I realized I needed to learn React Native. Task: Build a functional mobile app in 48 hours. Action: I followed a structured tutorial, built small projects daily, and joined a Discord community for help. Result: Successfully built and deployed our team\'s app, which won second place. Now React Native is one of my primary skills.',
    },
  ],
  hr: [
    {
      q: 'Where do you see yourself in 5 years?',
      tips: ['Be ambitious but realistic', 'Align with company goals', 'Show growth mindset'],
      sampleAnswer: 'In 5 years, I see myself as a senior software engineer leading a team of 5-8 developers, contributing to architecting scalable systems. I want to have deep expertise in cloud infrastructure and mentor junior developers. Ultimately, I aim to drive technical decisions that impact millions of users while continuously learning emerging technologies.',
    },
    {
      q: 'Why should we hire you over other candidates?',
      tips: ['Highlight unique strengths', 'Be specific', 'Connect to role requirements'],
      sampleAnswer: 'I bring a unique combination of strong technical skills and proven project delivery. My CGPA of 8.4 reflects my academic rigor, while my 3 deployed projects demonstrate practical ability. I\'ve led a team of 4 in building our campus ERP system, showing leadership. I\'m also a quick learner who thrives in collaborative environments, which aligns perfectly with your team culture.',
    },
  ],
};

export default function InterviewPractice() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [completedQs, setCompletedQs] = useState<number[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const questions = selectedType ? MOCK_QUESTIONS[selectedType] || [] : [];
  const totalScore = Math.round((completedQs.length / Math.max(questions.length, 1)) * 100);

  const handleNext = () => {
    setCompletedQs(prev => [...prev, currentQ]);
    setShowAnswer(false);
    setUserNotes('');
    setTimer(0);
    setTimerRunning(false);
    if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
  };

  if (selectedType) {
    const q = questions[currentQ];
    return (
      <ErrorBoundary>
        <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.hero}>
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
                <Pressable onPress={() => { setSelectedType(null); setCurrentQ(0); setShowAnswer(false); setTimerRunning(false); setTimer(0); }} style={styles.backBtn}>
                  <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={styles.heroTitle}>Question {currentQ + 1}/{questions.length}</Text>
                    <Text style={styles.heroSub}>{INTERVIEW_TYPES.find(t => t.id === selectedType)?.title}</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{formatTime(timer)}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>{completedQs.length}/{questions.length} done</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
              <Card style={{ padding: 20, gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <View style={styles.qBadge}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Q{currentQ + 1}</Text></View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text, flex: 1, lineHeight: 22 }}>{q.q}</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={() => setTimerRunning(!timerRunning)} style={[styles.controlBtn, timerRunning && { backgroundColor: '#EF4444' }]}>
                    {timerRunning ? <Pause size={16} color="#fff" /> : <Play size={16} color={theme.colors.brand} />}
                    <Text style={{ fontSize: 12, color: timerRunning ? '#fff' : theme.colors.text }}>{timerRunning ? 'Pause' : 'Start'}</Text>
                  </Pressable>
                  <Pressable onPress={() => { setTimer(0); setTimerRunning(false); }} style={styles.controlBtn}>
                    <RotateCcw size={16} color={theme.colors.muted} /><Text style={{ fontSize: 12, color: theme.colors.muted }}>Reset</Text>
                  </Pressable>
                </View>
              </Card>

              <SectionTitle>Your Notes</SectionTitle>
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={userNotes} onChangeText={setUserNotes}
                placeholder="Type your answer notes here..." placeholderTextColor={theme.colors.muted} multiline />

              <Pressable onPress={() => setShowAnswer(!showAnswer)}>
                <Card style={{ padding: 16, gap: 8, backgroundColor: showAnswer ? theme.colors.brandTertiary : theme.colors.surfaceSecondary }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontWeight: '700', color: showAnswer ? theme.colors.brand : theme.colors.text }}>
                      {showAnswer ? 'Hide' : 'Show'} AI Sample Answer
                    </Text>
                    <ChevronRight size={16} color={theme.colors.brand} style={{ transform: [{ rotate: showAnswer ? '90deg' : '0deg' }] }} />
                  </View>
                  {showAnswer && (
                    <View style={{ gap: 8 }}>
                      <Text style={{ fontSize: 13, color: theme.colors.text, lineHeight: 20 }}>{q.sampleAnswer}</Text>
                      <Text style={{ fontWeight: '700', fontSize: 12, color: theme.colors.muted, marginTop: 4 }}>Tips:</Text>
                      {q.tips.map((tip, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                          <CheckCircle size={12} color="#10B981" style={{ marginTop: 2 }} />
                          <Text style={{ fontSize: 12, color: theme.colors.muted, flex: 1 }}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
              </Pressable>

              {currentQ < questions.length - 1 ? (
                <GradientButton label="Next Question" onPress={handleNext} />
              ) : (
                <Card style={{ padding: 20, alignItems: 'center', gap: 8 }}>
                  <Award size={40} color={theme.colors.brand} />
                  <Text style={{ fontWeight: '800', fontSize: 18, color: theme.colors.text }}>Practice Complete!</Text>
                  <Text style={{ color: theme.colors.muted }}>You answered {completedQs.length + 1} questions</Text>
                  <Text style={{ fontSize: 24, fontWeight: '800', color: theme.colors.brand }}>{totalScore}%</Text>
                  <GradientButton label="Try Another Type" onPress={() => { setSelectedType(null); setCurrentQ(0); setCompletedQs([]); }} />
                </Card>
              )}
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
                <View style={styles.heroIcon}><Sparkles size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>AI Interview Practice</Text>
                  <Text style={styles.heroSub}>Master your next interview with AI coaching</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {INTERVIEW_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <Pressable key={type.id} onPress={() => setSelectedType(type.id)}>
                  <Card style={{ padding: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.typeIcon}>
                        <Icon size={24} color={theme.colors.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.text }}>{type.title}</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{type.desc}</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.brand }}>{MOCK_QUESTIONS[type.id]?.length || 0} Qs</Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}

            <SectionTitle>Interview Tips</SectionTitle>
            {[
              { icon: Clock, text: 'Keep answers under 2 minutes for behavioral questions' },
              { icon: Target, text: 'Use the STAR method: Situation, Task, Action, Result' },
              { icon: TrendingUp, text: 'Practice with a timer to improve response speed' },
              { icon: MessageSquare, text: 'Record yourself to check body language and tone' },
            ].map((tip, i) => {
              const TipIcon = tip.icon;
              return (
                <Card key={i} style={{ padding: 12, gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                    <TipIcon size={16} color={theme.colors.brand} style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 13, color: theme.colors.text, flex: 1, lineHeight: 18 }}>{tip.text}</Text>
                  </View>
                </Card>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  typeIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  qBadge: { backgroundColor: theme.colors.brand, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  controlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
});
