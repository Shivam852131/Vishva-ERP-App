import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import ChatTab from '@/src/screens/ai/ChatTab';
import {
  Sparkles, MessageCircle, CalendarCheck, Wand2, ClipboardCheck, FileText,
  Briefcase, GraduationCap, Mic, Zap, Brain, BookOpen, Target, Clock,
  ChevronRight, Lightbulb, Star, Cpu, Globe, ArrowLeft,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AI_TOOLS = [
  { key: 'career-dashboard', title: 'Career Dashboard', icon: Target, color: '#4F46E5', desc: 'Your placement readiness score', route: '/career-dashboard' as const, tag: 'New' },
  { key: 'skill-assessment', title: 'Skill Assessments', icon: ClipboardCheck, color: '#7C3AED', desc: 'Verify your skills with a test', route: '/skill-assessment' as const, tag: 'New' },
  { key: 'mentorship', title: 'Mentorship', icon: Globe, color: '#0891B2', desc: 'Learn from industry mentors', route: '/mentorship' as const, tag: 'New' },
  { key: 'assignment-checker', title: 'Assignment Checker', icon: ClipboardCheck, color: '#4F46E5', desc: 'AI feedback on assignments', route: '/assignment-checker' as const, tag: 'Popular' },
  { key: 'report-card', title: 'Report Analysis', icon: FileText, color: '#7C3AED', desc: 'Academic performance insights', route: '/report-card' as const },
  { key: 'career-advisor', title: 'Career Advisor', icon: Briefcase, color: '#059669', desc: 'Discover your career path', route: '/career-advisor' as const },
  { key: 'resume-builder', title: 'Resume Builder', icon: GraduationCap, color: '#0891B2', desc: 'Professional resume in minutes', route: '/resume-builder' as const },
  { key: 'interview-practice', title: 'Interview Prep', icon: Mic, color: '#DC2626', desc: 'Master your next interview', route: '/interview-practice' as const, tag: 'Popular' },
  { key: 'study-planner', title: 'Study Planner', icon: CalendarCheck, color: '#D97706', desc: 'AI-powered study schedule', route: '/study-planner' as const },
];

const PERSONAS = [
  { key: 'doubt', label: 'Doubt Solver', icon: Brain, color: '#4F46E5', desc: 'Get instant answers' },
  { key: 'academic', label: 'Academic Advisor', icon: GraduationCap, color: '#059669', desc: 'Plan & track goals' },
  { key: 'study', label: 'Study Coach', icon: Target, color: '#7C3AED', desc: 'Study strategies' },
  { key: 'code', label: 'Code Helper', icon: Cpu, color: '#0891B2', desc: 'Debug & learn' },
];

const QUICK_PROMPTS = [
  { icon: Lightbulb, label: 'Explain', color: '#F59E0B', prompt: 'Explain this concept in simple terms' },
  { icon: BookOpen, label: 'Summarize', color: '#059669', prompt: 'Summarize the key points of this chapter' },
  { icon: Target, label: 'Practice', color: '#4F46E5', prompt: 'Give me practice problems on this topic' },
  { icon: Brain, label: 'Quiz Me', color: '#7C3AED', prompt: 'Test my knowledge with a quiz' },
];

function EmptyChatState() {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Sparkles size={28} color={theme.colors.brandPrimary} />
      </View>
      <Text style={styles.emptyTitle}>How can I help you today?</Text>
      <Text style={styles.emptySub}>Ask a question, get study tips, or explore career paths</Text>
    </View>
  );
}

function ToolCard({ tool, onPress }: { tool: typeof AI_TOOLS[0]; onPress: () => void }) {
  const Icon = tool.icon;
  return (
    <Pressable style={styles.toolCard} onPress={onPress}>
      <View style={[styles.toolIconWrap, { backgroundColor: tool.color + '10' }]}>
        <Icon size={20} color={tool.color} />
      </View>
      <View style={styles.toolInfo}>
        <View style={styles.toolTitleRow}>
          <Text style={styles.toolTitle} numberOfLines={1}>{tool.title}</Text>
          {tool.tag ? (
            <View style={[styles.toolTag, tool.tag === 'Popular' ? styles.tagPopular : styles.tagNew]}>
              <Text style={[styles.toolTagText, tool.tag === 'Popular' ? styles.tagTextPopular : styles.tagTextNew]}>{tool.tag}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.toolDesc} numberOfLines={1}>{tool.desc}</Text>
      </View>
      <ChevronRight size={16} color={theme.colors.muted} />
    </Pressable>
  );
}

function StatBadge({ icon: Icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <View style={styles.statBadge}>
      <View style={[styles.statBadgeIcon, { backgroundColor: color + '12' }]}>
        <Icon size={14} color={color} />
      </View>
      <Text style={styles.statBadgeValue}>{value}</Text>
      <Text style={styles.statBadgeLabel}>{label}</Text>
    </View>
  );
}

function HomeView({ aiStats, conversations, onNavigate, onStartChat }: { aiStats: any; conversations: any[]; onNavigate: (r: string) => void; onStartChat: (p: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.homeScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.greetingSection}>
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingTitle}>AI Campus Assistant</Text>
            <Text style={styles.greetingSub}>What would you like to learn?</Text>
          </View>
          <View style={styles.aiAvatarSmall}>
            <Sparkles size={16} color="#fff" />
          </View>
        </View>
        <View style={styles.statRow}>
          <StatBadge icon={MessageCircle} value={String(aiStats?.questions || 0)} label="Questions" color="#4F46E5" />
          <StatBadge icon={Clock} value={aiStats?.studyHours || '0h'} label="Study" color="#059669" />
          <StatBadge icon={Zap} value={String(aiStats?.tasksDone || 0)} label="Tasks" color="#7C3AED" />
          <StatBadge icon={Star} value={aiStats?.streak || '0d'} label="Streak" color="#F59E0B" />
        </View>
      </View>

      <View style={styles.personaSection}>
        <Text style={styles.sectionLabel}>Choose AI Persona</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personaRow}>
          {PERSONAS.map(p => {
            const Icon = p.icon;
            return (
              <Pressable key={p.key} style={styles.personaPill} onPress={() => onStartChat('')}>
                <View style={[styles.personaPillIcon, { backgroundColor: p.color + '15' }]}>
                  <Icon size={14} color={p.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.personaPillName} numberOfLines={1}>{p.label}</Text>
                  <Text style={styles.personaPillDesc} numberOfLines={1}>{p.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.quickSection}>
        <Text style={styles.sectionLabel}>Quick Start</Text>
        <View style={styles.quickRow}>
          {QUICK_PROMPTS.map((action, i) => {
            const Icon = action.icon;
            return (
              <Pressable key={i} style={styles.quickChip} onPress={() => onStartChat(action.prompt)}>
                <View style={[styles.quickChipIcon, { backgroundColor: action.color + '15' }]}>
                  <Icon size={16} color={action.color} />
                </View>
                <Text style={styles.quickChipLabel} numberOfLines={1}>{action.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {conversations && conversations.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>Recent</Text>
            <Pressable><Text style={styles.sectionAction}>See All</Text></Pressable>
          </View>
          {conversations.slice(0, 3).map((conv: any) => (
            <Pressable key={conv.id} style={styles.convCard}>
              <View style={[styles.convDot, { backgroundColor: '#4F46E5' }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
                <Text style={styles.convMeta}>{conv.persona} · {conv.messages} msgs</Text>
              </View>
              <Text style={styles.convTime}>{conv.time}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.tipSection}>
        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Lightbulb size={14} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>AI Tip of the Day</Text>
            <Text style={styles.tipText} numberOfLines={2}>
              Try the Pomodoro Technique: Study for 25 minutes, then take a 5-minute break.
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

function ToolsView({ onNavigate }: { onNavigate: (r: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.toolsScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.toolsHeader}>
        <Text style={styles.toolsTitle}>AI-Powered Tools</Text>
        <Text style={styles.toolsSub}>{AI_TOOLS.length} tools available</Text>
      </View>
      {AI_TOOLS.map(tool => (
        <ToolCard key={tool.key} tool={tool} onPress={() => onNavigate(tool.route)} />
      ))}
      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

function ChatView({ onBack, persona }: { onBack: () => void; persona: string }) {
  const personaInfo = PERSONAS.find(p => p.key === persona);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack} style={styles.chatBackBtn}>
          <ArrowLeft size={18} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatTitle}>{personaInfo?.label || 'AI Chat'}</Text>
          <Text style={styles.chatSub}>Online</Text>
        </View>
        <View style={styles.chatOnlineDot} />
      </View>
      <View style={{ flex: 1 }}>
        <EmptyChatState />
      </View>
      <ChatTab />
    </KeyboardAvoidingView>
  );
}

export default function AIHub() {
  const { data: aiStats } = useFetch<any>('/ai/stats');
  const { data: conversations } = useFetch<any[]>('/ai/sessions');
  const [tab, setTab] = useState('home');
  const [selectedPersona, setSelectedPersona] = useState('doubt');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleStartChat = (prompt: string) => {
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
        <SafeAreaView edges={['top']} style={styles.screen}>
          <ChatView onBack={() => setTab('home')} persona={selectedPersona} />
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.screen}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {tab === 'home' && (
            <HomeView
              aiStats={aiStats}
              conversations={conversations || []}
              onNavigate={handleNavigate}
              onStartChat={handleStartChat}
            />
          )}
          {tab === 'tools' && (
            <ToolsView onNavigate={handleNavigate} />
          )}
        </Animated.View>

        <View style={styles.bottomBar}>
          {[
            { key: 'home', icon: Sparkles, label: 'Home', color: '#4F46E5' },
            { key: 'chat', icon: MessageCircle, label: 'Chat', color: '#059669' },
            { key: 'tools', icon: Wand2, label: 'Tools', color: '#7C3AED' },
          ].map(t => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => t.key === 'chat' ? handleStartChat('') : setTab(t.key)} style={styles.bottomBarItem}>
                <View style={[styles.bottomBarIcon, isActive && { backgroundColor: t.color + '15' }]}>
                  <Icon size={20} color={isActive ? t.color : theme.colors.muted} />
                </View>
                <Text style={[styles.bottomBarLabel, isActive && { color: t.color, fontWeight: '700' }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },

  homeScroll: { paddingBottom: 20 },

  greetingSection: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  greetingTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  greetingSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  aiAvatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: 8 },
  statBadge: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  statBadgeIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statBadgeValue: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  statBadgeLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600', marginTop: 1 },

  personaSection: { marginTop: 16, paddingLeft: 16 },
  personaRow: { gap: 8, paddingRight: 16 },
  personaPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.colors.border, width: 160 },
  personaPillIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  personaPillName: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  personaPillDesc: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },

  quickSection: { marginTop: 16, paddingHorizontal: 16 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickChip: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 12, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border },
  quickChipIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  quickChipLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.text },

  sectionLabel: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionAction: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },

  recentSection: { marginTop: 16, paddingHorizontal: 16 },
  convCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, marginTop: 6, borderWidth: 1, borderColor: theme.colors.border },
  convDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  convTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  convMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  convTime: { fontSize: 10, color: theme.colors.muted, flexShrink: 0 },

  tipSection: { marginTop: 16, paddingHorizontal: 16 },
  tipCard: { flexDirection: 'row', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FDE68A' },
  tipIconWrap: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tipTitle: { fontSize: 12, fontWeight: '800', color: '#92400E', marginBottom: 2 },
  tipText: { fontSize: 11, color: '#78350F', lineHeight: 16 },

  toolsScroll: { padding: 16 },
  toolsHeader: { marginBottom: 12 },
  toolsTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.text, letterSpacing: -0.3 },
  toolsSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },

  toolCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: theme.colors.border },
  toolIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toolInfo: { flex: 1, minWidth: 0 },
  toolTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  toolDesc: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  toolTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  tagPopular: { backgroundColor: '#FEF3C7' },
  tagNew: { backgroundColor: '#DCFCE7' },
  toolTagText: { fontSize: 9, fontWeight: '700' },
  tagTextPopular: { color: '#D97706' },
  tagTextNew: { color: '#16A34A' },

  bottomBar: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingBottom: Platform.OS === 'ios' ? 20 : 8, paddingTop: 8, paddingHorizontal: 16 },
  bottomBarItem: { flex: 1, alignItems: 'center', gap: 3 },
  bottomBarIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bottomBarLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },

  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  chatBackBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.bg, alignItems: 'center', justifyContent: 'center' },
  chatTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  chatSub: { fontSize: 11, color: theme.colors.muted },
  chatOnlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  emptySub: { fontSize: 13, color: theme.colors.muted, textAlign: 'center', lineHeight: 18 },
});
