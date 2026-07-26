import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { BlurView } from '@/src/components/BlurView';
import { theme } from '@/src/theme';
import { router } from '@/src/navigation/router';
import { Card, SectionTitle } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import ChatTab from '@/src/screens/ai/ChatTab';
import PlannerTab from '@/src/screens/ai/PlannerTab';
import GradeAnalyzer from '@/src/screens/ai/GradeAnalyzer';
import AttendancePredictor from '@/src/screens/ai/AttendancePredictor';
import RemindersTab from '@/src/screens/ai/RemindersTab';
import {
  Sparkles, MessageCircle, CalendarCheck, BellRing, BarChart3, TrendingUp,
  Wand2, ClipboardCheck, FileText, Briefcase, GraduationCap, Mic,
  Zap, Brain, BookOpen, Target, Clock, ChevronRight, ArrowRight,
  Lightbulb, TrendingUp as TrendUp, Star, Activity, Cpu, Globe,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'chat', label: 'Chat', icon: MessageCircle, color: '#4F46E5' },
  { key: 'planner', label: 'Plan', icon: CalendarCheck, color: '#059669' },
  { key: 'grades', label: 'Grades', icon: BarChart3, color: '#7C3AED' },
  { key: 'attendance', label: 'Attend', icon: TrendingUp, color: '#F59E0B' },
  { key: 'tools', label: 'Tools', icon: Wand2, color: '#EC4899' },
];

const AI_TOOLS = [
  { key: 'career-dashboard', title: 'Career Dashboard', icon: Target, color: '#4F46E5', desc: 'Your placement readiness score', route: '/career-dashboard', tag: 'New' },
  { key: 'skill-assessment', title: 'Skill Assessments', icon: ClipboardCheck, color: '#7C3AED', desc: 'Verify your skills with a test', route: '/skill-assessment', tag: 'New' },
  { key: 'mentorship', title: 'Mentorship', icon: Globe, color: '#0891B2', desc: 'Learn from industry mentors', route: '/mentorship', tag: 'New' },
  { key: 'assignment-checker', title: 'Assignment Checker', icon: ClipboardCheck, color: '#4F46E5', desc: 'AI feedback on assignments', route: '/assignment-checker', tag: 'Popular' },
  { key: 'report-card', title: 'Report Analysis', icon: FileText, color: '#7C3AED', desc: 'Academic performance insights', route: '/report-card', tag: '' },
  { key: 'career-advisor', title: 'Career Advisor', icon: Briefcase, color: '#059669', desc: 'Discover your career path', route: '/career-advisor', tag: '' },
  { key: 'resume-builder', title: 'Resume Builder', icon: GraduationCap, color: '#0891B2', desc: 'Professional resume in minutes', route: '/resume-builder', tag: '' },
  { key: 'interview-practice', title: 'Interview Prep', icon: Mic, color: '#DC2626', desc: 'Master your next interview', route: '/interview-practice', tag: 'Popular' },
  { key: 'study-planner', title: 'Study Planner', icon: CalendarCheck, color: '#D97706', desc: 'AI-powered study schedule', route: '/study-planner', tag: '' },
];

const PERSONAS = [
  { key: 'doubt', label: 'Doubt Solver', icon: Brain, color: '#4F46E5', gradient: ['#4F46E5', '#6366F1'], desc: 'Get instant answers to any academic doubt' },
  { key: 'academic', label: 'Academic Advisor', icon: GraduationCap, color: '#059669', gradient: ['#059669', '#10B981'], desc: 'Plan courses, track progress & goals' },
  { key: 'study', label: 'Study Coach', icon: Target, color: '#7C3AED', gradient: ['#7C3AED', '#8B5CF6'], desc: 'Personalized study strategies & tips' },
  { key: 'code', label: 'Code Helper', icon: Cpu, color: '#0891B2', gradient: ['#0891B2', '#06B6D4'], desc: 'Debug code & learn programming' },
];

const AI_STATS = [
  { label: 'Questions Asked', value: '1,247', icon: MessageCircle, color: '#4F46E5' },
  { label: 'Study Hours', value: '86h', icon: Clock, color: '#059669' },
  { label: 'Tasks Completed', value: '342', icon: CheckCircle, color: '#7C3AED' },
  { label: 'Streak', value: '12 days', icon: Zap, color: '#F59E0B' },
];

const QUICK_ACTIONS = [
  { icon: Lightbulb, label: 'Explain Concept', color: '#F59E0B', prompt: 'Explain this concept in simple terms' },
  { icon: BookOpen, label: 'Summarize Chapter', color: '#059669', prompt: 'Summarize the key points of this chapter' },
  { icon: Target, label: 'Practice Problems', color: '#4F46E5', prompt: 'Give me practice problems on this topic' },
  { icon: Brain, label: 'Quiz Me', color: '#7C3AED', prompt: 'Test my knowledge with a quiz' },
];

const RECENT_CONVERSATIONS = [
  { id: '1', title: 'Explain Binary Search Trees', time: '2 hours ago', persona: 'Doubt Solver', messages: 8 },
  { id: '2', title: 'Weekly study plan for mid-terms', time: 'Yesterday', persona: 'Study Coach', messages: 12 },
  { id: '3', title: 'Help with React hooks assignment', time: '2 days ago', persona: 'Code Helper', messages: 15 },
  { id: '4', title: 'Physics electromagnetic waves doubt', time: '3 days ago', persona: 'Doubt Solver', messages: 6 },
];

function CheckCircle({ size, color }: { size: number; color: string }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: size * 0.6, fontWeight: '900' }}>✓</Text></View>;
}

// ─── Hero Section ────────────────────────────────
function HeroSection({ fadeAnim, glowAnim }: { fadeAnim: Animated.Value; glowAnim: Animated.Value }) {
  return (
    <View style={styles.heroContainer}>
      <LinearGradient
        colors={['#4F46E5', '#6366F1', '#818CF8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        {/* Decorative circles */}
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <View style={styles.heroDecor3} />

        <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 16 }}>
          <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 20 }}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroGreeting}>Hello, Student! 👋</Text>
                <Text style={styles.heroSub}>What can I help you with today?</Text>
              </View>
              <Animated.View style={[styles.heroAvatar, { opacity: Animated.add(0.7, Animated.multiply(glowAnim, 0.3)) }]}>
                <Sparkles size={28} color="#fff" />
              </Animated.View>
            </View>

            {/* Quick Stats */}
            <View style={styles.statsRow}>
              {AI_STATS.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <View key={i} style={styles.statItem}>
                    <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                      <Icon size={14} color={stat.color} />
                    </View>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

// ─── Persona Selector ────────────────────────────
function PersonaSelector({ selected, onSelect }: { selected: string; onSelect: (k: string) => void }) {
  return (
    <View style={styles.personaContainer}>
      <Text style={styles.sectionTitle}>Choose AI Persona</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personaScroll}>
        {PERSONAS.map(p => {
          const Icon = p.icon;
          const isActive = selected === p.key;
          return (
            <Pressable key={p.key} onPress={() => onSelect(p.key)} style={[styles.personaCard, isActive && { borderColor: p.color, backgroundColor: p.color + '08' }]}>
              <View style={[styles.personaIcon, { backgroundColor: isActive ? p.color : p.color + '15' }]}>
                <Icon size={20} color={isActive ? '#fff' : p.color} />
              </View>
              <Text style={[styles.personaName, isActive && { color: p.color }]}>{p.label}</Text>
              <Text style={styles.personaDesc} numberOfLines={2}>{p.desc}</Text>
              {isActive && (
                <View style={[styles.activeIndicator, { backgroundColor: p.color }]} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Quick Actions ───────────────────────────────
function QuickActions({ onStartChat }: { onStartChat: (prompt: string) => void }) {
  return (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        {QUICK_ACTIONS.map((action, i) => {
          const Icon = action.icon;
          return (
            <Pressable key={i} style={styles.quickCard} onPress={() => onStartChat(action.prompt)}>
              <View style={[styles.quickIcon, { backgroundColor: action.color + '15' }]}>
                <Icon size={22} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Recent Conversations ────────────────────────
function RecentConversations() {
  return (
    <View style={styles.recentContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Conversations</Text>
        <Pressable onPress={() => {}}>
          <Text style={styles.seeAllText}>See All</Text>
        </Pressable>
      </View>
      {RECENT_CONVERSATIONS.map(conv => (
        <Pressable key={conv.id} style={styles.convCard}>
          <View style={styles.convIcon}>
            <MessageCircle size={18} color="#4F46E5" />
          </View>
          <View style={styles.convInfo}>
            <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
            <View style={styles.convMeta}>
              <Text style={styles.convPersona}>{conv.persona}</Text>
              <Text style={styles.convDot}>·</Text>
              <Text style={styles.convMessages}>{conv.messages} messages</Text>
            </View>
          </View>
          <View style={styles.convRight}>
            <Text style={styles.convTime}>{conv.time}</Text>
            <ChevronRight size={14} color={theme.colors.muted} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── AI Tools Grid ───────────────────────────────
function AIToolsGrid() {
  return (
    <View style={styles.toolsContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>AI-Powered Tools</Text>
        <View style={styles.toolsCount}>
          <Wand2 size={12} color="#EC4899" />
          <Text style={styles.toolsCountText}>{AI_TOOLS.length} Tools</Text>
        </View>
      </View>
      <View style={styles.toolsGrid}>
        {AI_TOOLS.map(tool => {
          const Icon = tool.icon;
          return (
            <Pressable key={tool.key} style={styles.toolCard} onPress={() => router.push(tool.route as any)}>
              <View style={[styles.toolIcon, { backgroundColor: tool.color + '12' }]}>
                <Icon size={24} color={tool.color} />
              </View>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDesc}>{tool.desc}</Text>
              {tool.tag ? (
                <View style={[styles.toolTag, tool.tag === 'Popular' ? styles.tagPopular : styles.tagNew]}>
                  <Text style={[styles.toolTagText, tool.tag === 'Popular' ? styles.tagTextPopular : styles.tagTextNew]}>{tool.tag}</Text>
                </View>
              ) : null}
              <View style={styles.toolArrow}>
                <ArrowRight size={14} color={tool.color} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── AI Tip of the Day ──────────────────────────
function AITip() {
  return (
    <Card style={styles.tipCard}>
      <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.tipGradient}>
        <View style={styles.tipHeader}>
          <View style={styles.tipIconWrap}>
            <Lightbulb size={18} color="#D97706" />
          </View>
          <Text style={styles.tipTitle}>AI Tip of the Day</Text>
        </View>
        <Text style={styles.tipText}>
          Try the Pomodoro Technique: Study for 25 minutes, then take a 5-minute break. After 4 cycles, take a longer 15-30 minute break. This helps maintain focus and prevents burnout.
        </Text>
        <View style={styles.tipFooter}>
          <View style={styles.tipAuthor}>
            <View style={styles.tipAvatar}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>AI</Text></View>
            <Text style={styles.tipAuthorText}>CampusAI Study Coach</Text>
          </View>
          <Star size={14} color="#D97706" />
        </View>
      </LinearGradient>
    </Card>
  );
}

// ─── Tools Tab (Expanded) ────────────────────────
function ToolsTab() {
  return (
    <ScrollView contentContainerStyle={styles.toolsTabScroll} showsVerticalScrollIndicator={false}>
      <AIToolsGrid />
    </ScrollView>
  );
}

// ─── Main Screen ─────────────────────────────────
export default function AIHub() {
  const [tab, setTab] = useState('home');
  const [selectedPersona, setSelectedPersona] = useState('doubt');
  const [chatInput, setChatInput] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    glow.start();
    return () => glow.stop();
  }, []);

  const handleStartChat = (prompt: string) => {
    setChatInput(prompt);
    setTab('chat');
  };

  if (tab === 'chat') {
    return (
      <ErrorBoundary>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, backgroundColor: theme.colors.surface }}
        >
          <View style={styles.chatHeader}>
            <Pressable onPress={() => setTab('home')} style={styles.chatBackBtn}>
              <Text style={{ fontSize: 18, color: theme.colors.brand }}>←</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', fontSize: 15, color: theme.colors.text }}>
                {PERSONAS.find(p => p.key === selectedPersona)?.label || 'AI Chat'}
              </Text>
              <Text style={{ fontSize: 11, color: theme.colors.muted }}>Ask anything...</Text>
            </View>
            <View style={styles.chatStatusDot} />
          </View>
          <View style={{ flex: 1 }}>
            <ChatTab />
          </View>
        </KeyboardAvoidingView>
      </ErrorBoundary>
    );
  }

  if (tab === 'tools') {
    return (
      <ErrorBoundary>
        <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
          <View style={styles.toolsHeader}>
            <Pressable onPress={() => setTab('home')} style={styles.chatBackBtn}>
              <Text style={{ fontSize: 18, color: theme.colors.brand }}>←</Text>
            </Pressable>
            <Text style={{ fontWeight: '800', fontSize: 18, color: theme.colors.text }}>AI Tools</Text>
            <View style={{ width: 36 }} />
          </View>
          <ToolsTab />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        {/* Hero */}
        <HeroSection fadeAnim={fadeAnim} glowAnim={glowAnim} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Persona Selector */}
          <PersonaSelector selected={selectedPersona} onSelect={setSelectedPersona} />

          {/* Quick Actions */}
          <QuickActions onStartChat={handleStartChat} />

          {/* AI Tip */}
          <AITip />

          {/* Recent Conversations */}
          <RecentConversations />

          {/* AI Tools Grid */}
          <AIToolsGrid />

          {/* Bottom Spacer */}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Bottom Tab Bar */}
        <View style={styles.bottomTabs}>
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.bottomTab, isActive && styles.bottomTabActive]}
              >
                <Icon size={20} color={isActive ? t.color : theme.colors.muted} />
                <Text style={[styles.bottomTabLabel, isActive && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
                {isActive && <View style={[styles.bottomTabDot, { backgroundColor: t.color }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ErrorBoundary>
  );
}

// ─── Styles ──────────────────────────────────────
const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 80 },

  // Hero
  heroContainer: { height: 220, overflow: 'hidden' },
  heroGradient: { flex: 1, position: 'relative' },
  heroDecor1: { position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroDecor2: { position: 'absolute', bottom: -20, left: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroDecor3: { position: 'absolute', top: 40, left: SCREEN_WIDTH / 2 - 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  heroGreeting: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 },
  heroAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14, padding: 12,
  },
  statItem: { alignItems: 'center', gap: 3 },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#fff', fontSize: 14, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '600' },

  // Section
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },

  // Persona
  personaContainer: { marginTop: 16, paddingLeft: 16 },
  personaScroll: { gap: 10, paddingRight: 16 },
  personaCard: {
    width: 140, backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: theme.colors.border,
    position: 'relative', overflow: 'hidden',
  },
  personaIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  personaName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  personaDesc: { fontSize: 10, color: theme.colors.muted, marginTop: 4, lineHeight: 14 },
  activeIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  // Quick Actions
  quickActionsContainer: { marginTop: 20, paddingHorizontal: 16 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickCard: {
    width: '47%', backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  quickIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.text, flex: 1 },

  // Tip
  tipCard: { marginHorizontal: 16, marginTop: 20, padding: 0, overflow: 'hidden' },
  tipGradient: { padding: 16, gap: 10 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(217,119,6,0.15)', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  tipText: { fontSize: 13, color: '#78350F', lineHeight: 19 },
  tipFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  tipAuthor: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center' },
  tipAuthorText: { fontSize: 10, color: '#92400E', fontWeight: '600' },

  // Recent Conversations
  recentContainer: { marginTop: 20, paddingHorizontal: 16 },
  seeAllText: { fontSize: 12, color: theme.colors.brand, fontWeight: '700' },
  convCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 12, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  convIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  convInfo: { flex: 1 },
  convTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  convMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  convPersona: { fontSize: 10, color: theme.colors.brand, fontWeight: '600' },
  convDot: { fontSize: 10, color: theme.colors.muted },
  convMessages: { fontSize: 10, color: theme.colors.muted },
  convRight: { alignItems: 'flex-end', gap: 4 },
  convTime: { fontSize: 10, color: theme.colors.muted },

  // Tools
  toolsContainer: { marginTop: 20, paddingHorizontal: 16 },
  toolsCount: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FDF2F8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  toolsCountText: { fontSize: 10, fontWeight: '700', color: '#EC4899' },
  toolsGrid: { gap: 10 },
  toolCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: theme.colors.border, position: 'relative',
  },
  toolIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  toolDesc: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  toolArrow: { position: 'absolute', right: 14, top: '50%', transform: [{ translateY: -7 }] },
  toolTag: { position: 'absolute', top: 10, right: 36, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagPopular: { backgroundColor: '#FEF3C7' },
  tagNew: { backgroundColor: '#DCFCE7' },
  toolTagText: { fontSize: 8, fontWeight: '700' },
  tagTextPopular: { color: '#D97706' },
  tagTextNew: { color: '#16A34A' },

  // Tools Tab
  toolsTabScroll: { padding: 16 },

  // Bottom Tabs
  bottomTabs: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    ...theme.shadow.lg,
  },
  bottomTab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 },
  bottomTabActive: {},
  bottomTabLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  bottomTabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  // Chat Header
  chatHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12,
    backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  chatBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  chatStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },

  // Tools Header
  toolsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12,
    backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
});
