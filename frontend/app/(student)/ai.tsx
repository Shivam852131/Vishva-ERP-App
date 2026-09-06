import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Platform, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import ChatTab from '@/src/screens/ai/ChatTab';
import {
  Sparkles, MessageCircle, CalendarCheck, Wand2, ClipboardCheck, FileText,
  Briefcase, GraduationCap, Mic, Zap, Brain, BookOpen, Target, Clock,
  ChevronRight, Lightbulb, Star, Cpu, Globe, ArrowLeft, ArrowRight,
} from 'lucide-react-native';
import { router } from '@/src/navigation/router';

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
  { icon: Lightbulb, label: 'Explain', color: '#F59E0B', prompt: 'Explain this concept in simple terms', desc: 'Clear explanations' },
  { icon: BookOpen, label: 'Summarize', color: '#059669', prompt: 'Summarize the key points of this chapter', desc: 'Key insights' },
  { icon: Target, label: 'Practice', color: '#4F46E5', prompt: 'Give me practice problems on this topic', desc: 'Problem solving' },
  { icon: Brain, label: 'Quiz Me', color: '#7C3AED', prompt: 'Test my knowledge with a quiz', desc: 'Self assessment' },
];

function ToolCard({ tool, onPress }: { tool: typeof AI_TOOLS[0]; onPress: () => void }) {
  const Icon = tool.icon;
  return (
    <Pressable style={styles.toolCard} onPress={onPress}>
      <View style={[styles.toolIconWrap, { backgroundColor: tool.color + '15' }]}>
        <Icon size={22} color={tool.color} />
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
      <View style={styles.toolArrow}>
        <ChevronRight size={16} color={theme.colors.muted} />
      </View>
    </Pressable>
  );
}

function StatBadge({ icon: Icon, value, label, color }: { icon: any; value: string; label: string; color: string }) {
  return (
    <View style={styles.statBadge}>
      <View style={[styles.statBadgeIcon, { backgroundColor: color + '14' }]}>
        <Icon size={16} color={color} />
      </View>
      <Text style={styles.statBadgeValue}>{value}</Text>
      <Text style={styles.statBadgeLabel}>{label}</Text>
    </View>
  );
}

function HomeView({
  aiStats,
  conversations,
  onNavigate,
  onStartChat,
  onSelectPersona,
}: {
  aiStats: any;
  conversations: any[];
  onNavigate: (r: string) => void;
  onStartChat: (p: string) => void;
  onSelectPersona: (key: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.homeScroll} showsVerticalScrollIndicator={false}>
      {/* Quick Ask / Search Bar */}
      <Pressable style={styles.askBar} onPress={() => onStartChat('')}>
        <View style={styles.askBarIcon}>
          <Sparkles size={18} color={theme.colors.brandPrimary} />
        </View>
        <Text style={styles.askBarPlaceholder}>Ask a doubt, solve homework, or explore...</Text>
        <View style={styles.askBarArrow}>
          <ArrowRight size={14} color="#fff" />
        </View>
      </Pressable>

      {/* Stats Summary */}
      <View style={styles.statRow}>
        <StatBadge icon={MessageCircle} value={String(aiStats?.questions || 0)} label="Questions" color="#4F46E5" />
        <StatBadge icon={Clock} value={aiStats?.studyHours || '0h'} label="Study" color="#059669" />
        <StatBadge icon={Zap} value={String(aiStats?.tasksDone || 0)} label="Tasks" color="#7C3AED" />
        <StatBadge icon={Star} value={aiStats?.streak || '0d'} label="Streak" color="#F59E0B" />
      </View>

      {/* AI Persona Selector */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Choose AI Persona</Text>
          <Text style={styles.sectionSubHeading}>Specialized academic assistants</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.personaRow}>
          {PERSONAS.map(p => {
            const Icon = p.icon;
            return (
              <Pressable
                key={p.key}
                style={styles.personaCard}
                onPress={() => {
                  onSelectPersona(p.key);
                  onStartChat('');
                }}
              >
                <View style={[styles.personaIconWrap, { backgroundColor: p.color + '15' }]}>
                  <Icon size={18} color={p.color} />
                </View>
                <View style={styles.personaTextWrap}>
                  <Text style={styles.personaName} numberOfLines={1}>{p.label}</Text>
                  <Text style={styles.personaDesc} numberOfLines={1}>{p.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Quick Start Prompts */}
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Quick Start</Text>
          <Text style={styles.sectionSubHeading}>One-tap instant AI help</Text>
        </View>
        <View style={styles.quickGrid}>
          {QUICK_PROMPTS.map((action, i) => {
            const Icon = action.icon;
            return (
              <Pressable key={i} style={styles.quickCard} onPress={() => onStartChat(action.prompt)}>
                <View style={[styles.quickCardIcon, { backgroundColor: action.color + '16' }]}>
                  <Icon size={20} color={action.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickCardLabel}>{action.label}</Text>
                  <Text style={styles.quickCardDesc} numberOfLines={1}>{action.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Recent Sessions */}
      {conversations && conversations.length > 0 && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionHeading}>Recent Discussions</Text>
            <Pressable onPress={() => onStartChat('')}><Text style={styles.sectionAction}>Open Chat</Text></Pressable>
          </View>
          {conversations.slice(0, 3).map((conv: any) => (
            <Pressable key={conv.id} style={styles.convCard} onPress={() => onStartChat('')}>
              <View style={[styles.convDot, { backgroundColor: theme.colors.brandPrimary }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.convTitle} numberOfLines={1}>{conv.title}</Text>
                <Text style={styles.convMeta}>{conv.persona || 'Doubt Solver'} · {conv.messages || 1} msgs</Text>
              </View>
              <Text style={styles.convTime}>{conv.time || 'Today'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* AI Tip of the Day */}
      <View style={styles.tipSection}>
        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Lightbulb size={18} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.tipBadgeRow}>
              <Text style={styles.tipBadgeText}>AI Tip of the Day</Text>
            </View>
            <Text style={styles.tipText}>
              Try the Pomodoro Technique: Study with laser focus for 25 minutes, then take a 5-minute break.
            </Text>
          </View>
        </View>
      </View>

      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

function ToolsView({ onNavigate }: { onNavigate: (r: string) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.toolsScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.toolsHeader}>
        <Text style={styles.toolsTitle}>Academic & Career Tools</Text>
        <Text style={styles.toolsSub}>{AI_TOOLS.length} intelligent tools ready for you</Text>
      </View>
      {AI_TOOLS.map(tool => (
        <ToolCard key={tool.key} tool={tool} onPress={() => onNavigate(tool.route)} />
      ))}
      <View style={{ height: 28 }} />
    </ScrollView>
  );
}

function ChatView({ onBack, persona }: { onBack: () => void; persona: string }) {
  const personaInfo = PERSONAS.find(p => p.key === persona);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.chatHeader}>
        <Pressable onPress={onBack} style={styles.chatBackBtn} accessibilityLabel="Back to AI Hub">
          <ArrowLeft size={20} color={theme.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatTitle}>{personaInfo?.label || 'AI Campus Assistant'}</Text>
          <Text style={styles.chatSub}>Always active · Real-time AI support</Text>
        </View>
        <View style={styles.onlineBadge}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <ChatTab />
      </View>
    </View>
  );
}

export default function AIHub() {
  const { data: aiStats } = useFetch<any>('/ai/stats');
  const { data: conversations } = useFetch<any[]>('/ai/sessions');
  const [tab, setTab] = useState<'home' | 'chat' | 'tools'>('home');
  const [selectedPersona, setSelectedPersona] = useState('doubt');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const handleStartChat = (_prompt: string) => {
    setTab('chat');
  };

  const handleNavigate = (route: string) => {
    try {
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
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>AI Campus Assistant</Text>
            <Text style={styles.headerSubtitle}>What would you like to learn today?</Text>
          </View>
          <View style={styles.headerAvatar}>
            <Sparkles size={20} color="#fff" />
          </View>
        </View>

        {/* Modern Top Segmented Control - Replaces awkward secondary bottom bar */}
        <View style={styles.segmentContainer}>
          <View style={styles.segmentTrack}>
            {[
              { key: 'home', icon: Sparkles, label: 'AI Hub' },
              { key: 'chat', icon: MessageCircle, label: 'Ask AI' },
              { key: 'tools', icon: Wand2, label: `Tools (${AI_TOOLS.length})` },
            ].map(t => {
              const Icon = t.icon;
              const isActive = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key as any)}
                  style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
                >
                  <Icon
                    size={15}
                    color={isActive ? theme.colors.brandPrimary : theme.colors.muted}
                  />
                  <Text style={[styles.segmentBtnText, isActive && styles.segmentBtnTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Main Content Area */}
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {tab === 'home' && (
            <HomeView
              aiStats={aiStats}
              conversations={conversations || []}
              onNavigate={handleNavigate}
              onStartChat={handleStartChat}
              onSelectPersona={setSelectedPersona}
            />
          )}
          {tab === 'tools' && (
            <ToolsView onNavigate={handleNavigate} />
          )}
        </Animated.View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.sm,
  },

  // Top Segmented Bar
  segmentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.brandTertiary,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  segmentBtnTextActive: {
    color: theme.colors.brandPrimary,
    fontWeight: '700',
  },

  // Home Scroll
  homeScroll: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 24,
  },

  // Ask Bar
  askBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.brandPrimary + '30',
    ...theme.shadow.sm,
  },
  askBarIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  askBarPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  askBarArrow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stat Row
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBadge: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  statBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statBadgeValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  statBadgeLabel: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 2,
  },

  // Section Wrap
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  sectionSubHeading: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 1,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionAction: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.brandPrimary,
  },

  // Persona
  personaRow: {
    gap: 10,
    paddingVertical: 2,
  },
  personaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 180,
    ...theme.shadow.sm,
  },
  personaIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  personaTextWrap: {
    flex: 1,
  },
  personaName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  personaDesc: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },

  // Quick Start Grid
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: (SCREEN_WIDTH - 50) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  quickCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  quickCardDesc: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 2,
  },

  // Recent Sessions
  convCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  convDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  convTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  convMeta: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
  convTime: {
    fontSize: 10,
    color: theme.colors.muted,
    flexShrink: 0,
  },

  // Tip Card
  tipSection: {
    marginTop: 4,
  },
  tipCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    ...theme.shadow.sm,
  },
  tipIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tipBadgeRow: {
    marginBottom: 4,
  },
  tipBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.2,
  },
  tipText: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Tools Tab
  toolsScroll: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  toolsHeader: {
    marginBottom: 12,
  },
  toolsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  toolsSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  toolIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toolInfo: {
    flex: 1,
    minWidth: 0,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  toolDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  toolTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagPopular: {
    backgroundColor: '#FEF3C7',
  },
  tagNew: {
    backgroundColor: '#DCFCE7',
  },
  toolTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  tagTextPopular: {
    color: '#D97706',
  },
  tagTextNew: {
    color: '#16A34A',
  },
  toolArrow: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chat Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  chatBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  chatSub: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 1,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
});
