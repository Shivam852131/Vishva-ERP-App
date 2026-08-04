import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import ChatTab from '@/src/screens/ai/ChatTab';
import PlannerTab from '@/src/screens/ai/PlannerTab';
import GradeAnalyzer from '@/src/screens/ai/GradeAnalyzer';
import AttendancePredictor from '@/src/screens/ai/AttendancePredictor';
import RemindersTab from '@/src/screens/ai/RemindersTab';
import {
  Sparkles, MessageCircle, CalendarCheck, BellRing, BarChart3, TrendingUp,
  Wand2, ClipboardCheck, FileText, Briefcase, GraduationCap, Mic,
  Zap, Brain, BookOpen, Target, Clock, ChevronRight, ArrowRight,
  Lightbulb, Star, Cpu, Globe,
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
  { key: 'career-dashboard', title: 'Career Dashboard', icon: Target, color: '#4F46E5', desc: 'Your placement readiness score', route: '/career-dashboard' as const, tag: 'New' },
  { key: 'skill-assessment', title: 'Skill Assessments', icon: ClipboardCheck, color: '#7C3AED', desc: 'Verify your skills with a test', route: '/skill-assessment' as const, tag: 'New' },
  { key: 'mentorship', title: 'Mentorship', icon: Globe, color: '#0891B2', desc: 'Learn from industry mentors', route: '/mentorship' as const, tag: 'New' },
  { key: 'assignment-checker', title: 'Assignment Checker', icon: ClipboardCheck, color: '#4F46E5', desc: 'AI feedback on assignments', route: '/assignment-checker' as const, tag: 'Popular' },
  { key: 'report-card', title: 'Report Analysis', icon: FileText, color: '#7C3AED', desc: 'Academic performance insights', route: '/report-card' as const, tag: '' },
  { key: 'career-advisor', title: 'Career Advisor', icon: Briefcase, color: '#059669', desc: 'Discover your career path', route: '/career-advisor' as const, tag: '' },
  { key: 'resume-builder', title: 'Resume Builder', icon: GraduationCap, color: '#0891B2', desc: 'Professional resume in minutes', route: '/resume-builder' as const, tag: '' },
  { key: 'interview-practice', title: 'Interview Prep', icon: Mic, color: '#DC2626', desc: 'Master your next interview', route: '/interview-practice' as const, tag: 'Popular' },
  { key: 'study-planner', title: 'Study Planner', icon: CalendarCheck, color: '#D97706', desc: 'AI-powered study schedule', route: '/study-planner' as const, tag: '' },
];

const PERSONAS = [
  { key: 'doubt', label: 'Doubt Solver', icon: Brain, color: '#4F46E5', desc: 'Get instant answers to any academic doubt' },
  { key: 'academic', label: 'Academic Advisor', icon: GraduationCap, color: '#059669', desc: 'Plan courses, track progress & goals' },
  { key: 'study', label: 'Study Coach', icon: Target, color: '#7C3AED', desc: 'Personalized study strategies & tips' },
  { key: 'code', label: 'Code Helper', icon: Cpu, color: '#0891B2', desc: 'Debug code & learn programming' },
];

const QUICK_ACTIONS = [
  { icon: Lightbulb, label: 'Explain', color: '#F59E0B', prompt: 'Explain this concept in simple terms' },
  { icon: BookOpen, label: 'Summarize', color: '#059669', prompt: 'Summarize the key points of this chapter' },
  { icon: Target, label: 'Practice', color: '#4F46E5', prompt: 'Give me practice problems on this topic' },
  { icon: Brain, label: 'Quiz Me', color: '#7C3AED', prompt: 'Test my knowledge with a quiz' },
];

function HeroSection({ fadeAnim, glowAnim, aiStats }: { fadeAnim: Animated.Value; glowAnim: Animated.Value; aiStats: any }) {
  const defaultStats = [
    { label: 'Questions', value: aiStats?.questions || '0', icon: MessageCircle, color: '#4F46E5' },
    { label: 'Study Hours', value: aiStats?.studyHours || '0h', icon: Clock, color: '#059669' },
    { label: 'Tasks Done', value: aiStats?.tasksDone || '0', icon: Zap, color: '#7C3AED' },
    { label: 'Streak', value: aiStats?.streak || '0d', icon: Star, color: '#F59E0B' },
  ];

  return (
    <View style={styles.heroContainer}>
      <LinearGradient colors={['#4F46E5', '#6366F1', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
        <View style={styles.heroDecor1} />
        <View style={styles.heroDecor2} />
        <SafeAreaView edges={['top']} style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 16 }}>
          <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 20 }}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroGreeting} numberOfLines={1} ellipsizeMode="tail">Hello! How can I help?</Text>
                <Text style={styles.heroSub} numberOfLines={1} ellipsizeMode="tail">Your AI campus assistant</Text>
              </View>
              <Animated.View style={[styles.heroAvatar, { opacity: Animated.add(0.7, Animated.multiply(glowAnim, 0.3)) }]}>
                <Sparkles size={24} color="#fff" />
              </Animated.View>
            </View>
            <View style={styles.statsRow}>
              {defaultStats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <View key={i} style={styles.statItem}>
                    <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                      <Icon size={12} color={stat.color} />
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
                <Icon size={18} color={isActive ? '#fff' : p.color} />
              </View>
              <Text style={[styles.personaName, isActive && { color: p.color }]} numberOfLines={1} ellipsizeMode="tail">{p.label}</Text>
              <Text style={styles.personaDesc} numberOfLines={2} ellipsizeMode="tail">{p.desc}</Text>
              {isActive && <View style={[styles.activeIndicator, { backgroundColor: p.color }]} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

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
                <Icon size={18} color={action.color} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1} ellipsizeMode="tail">{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function RecentConversations({ conversations }: { conversations: any[] }) {
  return (
    <View style={styles.recentContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent</Text>
        <Pressable onPress={() => {}}><Text style={styles.seeAllText}>See All</Text></Pressable>
      </View>
      {(!conversations || conversations.length === 0) ? (
        <View style={{ alignItems: 'center', marginTop: 16, gap: 8 }}>
          <MessageCircle size={28} color={theme.colors.muted} />
          <Text style={{ fontSize: 13, color: theme.colors.muted, fontWeight: '600' }}>No conversations yet</Text>
        </View>
      ) : (
        conversations.map((conv: any) => (
          <Pressable key={conv.id} style={styles.convCard}>
            <View style={styles.convIcon}>
              <MessageCircle size={16} color="#4F46E5" />
            </View>
            <View style={styles.convInfo}>
              <Text style={styles.convTitle} numberOfLines={1} ellipsizeMode="tail">{conv.title}</Text>
              <View style={styles.convMeta}>
                <Text style={styles.convPersona} numberOfLines={1} ellipsizeMode="tail">{conv.persona}</Text>
                <Text style={styles.convDot}>·</Text>
                <Text style={styles.convMessages}>{conv.messages} msgs</Text>
              </View>
            </View>
            <View style={styles.convRight}>
              <Text style={styles.convTime}>{conv.time}</Text>
              <ChevronRight size={12} color={theme.colors.muted} />
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

function AIToolsGrid({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <View style={styles.toolsContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>AI-Powered Tools</Text>
        <View style={styles.toolsCount}>
          <Wand2 size={10} color="#EC4899" />
          <Text style={styles.toolsCountText}>{AI_TOOLS.length}</Text>
        </View>
      </View>
      <View style={styles.toolsGrid}>
        {AI_TOOLS.map(tool => {
          const Icon = tool.icon;
          return (
            <Pressable key={tool.key} style={styles.toolCard} onPress={() => onNavigate(tool.route)}>
              <View style={[styles.toolIcon, { backgroundColor: tool.color + '12' }]}>
                <Icon size={20} color={tool.color} />
              </View>
              <View style={styles.toolContent}>
                <Text style={styles.toolTitle} numberOfLines={1} ellipsizeMode="tail">{tool.title}</Text>
                <Text style={styles.toolDesc} numberOfLines={1} ellipsizeMode="tail">{tool.desc}</Text>
              </View>
              {tool.tag ? (
                <View style={[styles.toolTag, tool.tag === 'Popular' ? styles.tagPopular : styles.tagNew]}>
                  <Text style={[styles.toolTagText, tool.tag === 'Popular' ? styles.tagTextPopular : styles.tagTextNew]}>{tool.tag}</Text>
                </View>
              ) : null}
              <ArrowRight size={14} color={tool.color} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AITip() {
  return (
    <View style={styles.tipCard}>
      <LinearGradient colors={['#FEF3C7', '#FDE68A']} style={styles.tipGradient}>
        <View style={styles.tipHeader}>
          <View style={styles.tipIconWrap}>
            <Lightbulb size={16} color="#D97706" />
          </View>
          <Text style={styles.tipTitle} numberOfLines={1} ellipsizeMode="tail">AI Tip of the Day</Text>
        </View>
        <Text style={styles.tipText} numberOfLines={3} ellipsizeMode="tail">
          Try the Pomodoro Technique: Study for 25 minutes, then take a 5-minute break. After 4 cycles, take a longer 15-30 minute break.
        </Text>
        <View style={styles.tipFooter}>
          <View style={styles.tipAuthor}>
            <View style={styles.tipAvatar}><Text style={styles.tipAvatarTxt}>AI</Text></View>
            <Text style={styles.tipAuthorText} numberOfLines={1} ellipsizeMode="tail">CampusAI Study Coach</Text>
          </View>
          <Star size={12} color="#D97706" />
        </View>
      </LinearGradient>
    </View>
  );
}

function ToolsTab({ onNavigate }: { onNavigate: (route: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.toolsTabScroll} showsVerticalScrollIndicator={false}>
      <AIToolsGrid onNavigate={onNavigate} />
    </ScrollView>
  );
}

export default function AIHub() {
  const { data: aiStats } = useFetch<any>('/ai/stats');
  const { data: conversations } = useFetch<any[]>('/ai/sessions');
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

  const handleNavigate = (route: string) => {
    try {
      const { router } = require('@/src/navigation/router');
      router.push(route as any);
    } catch {}
  };

  if (tab === 'chat') {
    return (
      <ErrorBoundary>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <Pressable onPress={() => setTab('home')} style={styles.chatBackBtn}>
              <Text style={styles.chatBackTxt}>←</Text>
            </Pressable>
            <View style={styles.chatHeaderInfo}>
              <Text style={styles.chatHeaderTitle} numberOfLines={1} ellipsizeMode="tail">
                {PERSONAS.find(p => p.key === selectedPersona)?.label || 'AI Chat'}
              </Text>
              <Text style={styles.chatHeaderSub} numberOfLines={1} ellipsizeMode="tail">Ask anything...</Text>
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
        <View style={styles.toolsContainerOuter}>
          <View style={styles.toolsHeader}>
            <Pressable onPress={() => setTab('home')} style={styles.chatBackBtn}>
              <Text style={styles.chatBackTxt}>←</Text>
            </Pressable>
            <Text style={styles.toolsHeaderTitle} numberOfLines={1} ellipsizeMode="tail">AI Tools</Text>
            <View style={{ width: 36 }} />
          </View>
          <ToolsTab onNavigate={handleNavigate} />
        </View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <HeroSection fadeAnim={fadeAnim} glowAnim={glowAnim} aiStats={aiStats} />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <PersonaSelector selected={selectedPersona} onSelect={setSelectedPersona} />
          <QuickActions onStartChat={handleStartChat} />
          <AITip />
          <RecentConversations conversations={conversations || []} />
          <AIToolsGrid onNavigate={handleNavigate} />
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={styles.bottomTabs}>
          {TABS.map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.bottomTab, isActive && styles.bottomTabActive]}>
                <Icon size={18} color={isActive ? t.color : theme.colors.muted} />
                <Text style={[styles.bottomTabLabel, isActive && { color: t.color, fontWeight: '700' }]} numberOfLines={1} ellipsizeMode="tail">{t.label}</Text>
                {isActive && <View style={[styles.bottomTabDot, { backgroundColor: t.color }]} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  scrollContent: { paddingBottom: 80 },

  heroContainer: { height: 200, overflow: 'hidden' },
  heroGradient: { flex: 1, position: 'relative' },
  heroDecor1: { position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroDecor2: { position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  heroGreeting: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3 },
  heroAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 },
  statItem: { alignItems: 'center', gap: 2 },
  statIcon: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#fff', fontSize: 13, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 8, fontWeight: '600' },

  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  personaContainer: { marginTop: 14, paddingLeft: 16 },
  personaScroll: { gap: 8, paddingRight: 16 },
  personaCard: { width: 130, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: theme.colors.border, position: 'relative', overflow: 'hidden' },
  personaIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  personaName: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  personaDesc: { fontSize: 9, color: theme.colors.muted, marginTop: 3, lineHeight: 13 },
  activeIndicator: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },

  quickActionsContainer: { marginTop: 16, paddingHorizontal: 16 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCard: { width: '47%', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.text, flex: 1, minWidth: 0 },

  tipCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  tipGradient: { padding: 14, gap: 8 },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(217,119,6,0.15)', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 13, fontWeight: '800', color: '#92400E', flex: 1, minWidth: 0 },
  tipText: { fontSize: 12, color: '#78350F', lineHeight: 17 },
  tipFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  tipAuthor: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tipAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#D97706', alignItems: 'center', justifyContent: 'center' },
  tipAvatarTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },
  tipAuthorText: { fontSize: 9, color: '#92400E', fontWeight: '600' },

  recentContainer: { marginTop: 16, paddingHorizontal: 16 },
  seeAllText: { fontSize: 11, color: theme.colors.brandPrimary, fontWeight: '700' },
  convCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 10, marginTop: 6, borderWidth: 1, borderColor: theme.colors.border },
  convIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  convInfo: { flex: 1, minWidth: 0 },
  convTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  convMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  convPersona: { fontSize: 9, color: theme.colors.brandPrimary, fontWeight: '600', flex: 1, minWidth: 0 },
  convDot: { fontSize: 9, color: theme.colors.muted },
  convMessages: { fontSize: 9, color: theme.colors.muted },
  convRight: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  convTime: { fontSize: 9, color: theme.colors.muted },

  toolsContainer: { marginTop: 16, paddingHorizontal: 16 },
  toolsCount: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FDF2F8', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  toolsCountText: { fontSize: 9, fontWeight: '700', color: '#EC4899' },
  toolsGrid: { gap: 8 },
  toolCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  toolIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toolContent: { flex: 1, minWidth: 0 },
  toolTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  toolDesc: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  toolTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, flexShrink: 0 },
  tagPopular: { backgroundColor: '#FEF3C7' },
  tagNew: { backgroundColor: '#DCFCE7' },
  toolTagText: { fontSize: 8, fontWeight: '700' },
  tagTextPopular: { color: '#D97706' },
  tagTextNew: { color: '#16A34A' },

  toolsTabScroll: { padding: 16 },

  bottomTabs: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 6 },
  bottomTab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  bottomTabActive: {},
  bottomTabLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600' },
  bottomTabDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },

  chatContainer: { flex: 1, backgroundColor: theme.colors.bg },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 48, paddingBottom: 10, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  chatBackBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  chatBackTxt: { fontSize: 16, color: theme.colors.brandPrimary, fontWeight: '700' },
  chatHeaderInfo: { flex: 1, minWidth: 0 },
  chatHeaderTitle: { fontWeight: '700', fontSize: 14, color: theme.colors.text },
  chatHeaderSub: { fontSize: 10, color: theme.colors.muted },
  chatStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },

  toolsContainerOuter: { flex: 1, backgroundColor: theme.colors.bg },
  toolsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 10, backgroundColor: theme.colors.surfaceSecondary, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  toolsHeaderTitle: { fontWeight: '800', fontSize: 16, color: theme.colors.text, flex: 1, textAlign: 'center' },
});
