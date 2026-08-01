import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, TrendingUp, Briefcase, Award, Users,
  ChevronRight, Sparkles, Calendar, AlertCircle, BadgeCheck,
  ClipboardCheck, FolderGit2, Compass, BarChart3, Zap,
  Clock, Minus, TrendingDown, Lightbulb,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import type { CareerDashboard, CareerMatch, CareerPillar } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ProgressBar, StatCard } from '@/src/ui';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';

const ACTION_ROUTES: Record<string, string> = {
  'skill-profile': '/skill-profile',
  'skill-assessment': '/skill-assessment',
  placement: '/placement',
  mentorship: '/mentorship',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: theme.colors.error,
  medium: theme.colors.warning,
  low: theme.colors.info,
};

const PRIORITY_ICONS: Record<string, React.FC<{ size: number; color: string }>> = {
  high: AlertCircle,
  medium: Clock,
  low: Lightbulb,
};

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  in_process: 'In Process',
  offered: 'Offered',
  rejected: 'Rejected',
};

const STAGE_COLORS: Record<string, string> = {
  applied: '#3B82F6',
  shortlisted: '#F59E0B',
  in_process: '#8B5CF6',
  offered: '#10B981',
  rejected: '#EF4444',
};

function readinessColor(score: number) {
  if (score >= 80) return theme.colors.success;
  if (score >= 60) return theme.colors.info;
  if (score >= 40) return theme.colors.warning;
  return theme.colors.error;
}

function readinessGrade(score: number) {
  if (score >= 90) return 'Outstanding';
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'On Track';
  if (score >= 40) return 'Developing';
  return 'Getting Started';
}

function readinessMessage(score: number) {
  if (score >= 80) return "You're highly competitive. Keep refining your edge.";
  if (score >= 60) return 'Good progress. A few more skills to polish.';
  return 'Building your foundation. Stay consistent.';
}

// ─── Quick Actions Grid (shared across tabs) ────────
type QuickAction = { label: string; icon: React.FC<{ size: number; color: string }>; route: string; color: string };

const OVERVIEW_ACTIONS: QuickAction[] = [
  { label: 'Skill Profile', icon: Sparkles, route: '/skill-profile', color: '#059669' },
  { label: 'Assessments', icon: ClipboardCheck, route: '/skill-assessment', color: '#7C3AED' },
];

const SKILLS_ACTIONS: QuickAction[] = [
  { label: 'Skill Profile', icon: Sparkles, route: '/skill-profile', color: '#059669' },
  { label: 'Assessments', icon: ClipboardCheck, route: '/skill-assessment', color: '#7C3AED' },
];

const CAREERS_ACTIONS: QuickAction[] = [
  { label: 'Placements', icon: Briefcase, route: '/placement', color: '#4F46E5' },
  { label: 'Mentorship', icon: Users, route: '/mentorship', color: '#0891B2' },
];

const ACTIVITY_ACTIONS: QuickAction[] = [
  { label: 'Skill Profile', icon: Sparkles, route: '/skill-profile', color: '#059669' },
  { label: 'Assessments', icon: ClipboardCheck, route: '/skill-assessment', color: '#7C3AED' },
  { label: 'Placements', icon: Briefcase, route: '/placement', color: '#4F46E5' },
  { label: 'Mentorship', icon: Users, route: '/mentorship', color: '#0891B2' },
];

function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {actions.map(action => {
          const Icon = action.icon;
          return (
            <Pressable key={action.route} onPress={() => router.push(action.route)} style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                <Icon size={22} color={action.color} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

// ─── Animated Readiness Ring ─────────────────────────
function ReadinessRing({ score, size = 130, strokeWidth = 10 }: {
  score: number; size?: number; strokeWidth?: number;
}) {
  const animatedValue = useSharedValue(0);
  const scaleValue = useSharedValue(0.8);

  useEffect(() => {
    animatedValue.value = withTiming(score, { duration: 1200 });
    scaleValue.value = withSpring(1, { damping: 12, stiffness: 100 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const fill = Math.max(0, Math.min(100, score));
  const color = readinessColor(fill);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  return (
    <Animated.View style={[styles.ringOuter, animatedStyle]}>
      <View style={[styles.ringBg, {
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary,
      }]} />
      <View style={[styles.ringFill, {
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: color,
        borderLeftColor: 'transparent', borderBottomColor: 'transparent',
        transform: [{ rotate: `${(fill / 100) * 360 - 90}deg` }],
      }]} />
      <View style={styles.ringCenter}>
        <Text style={[styles.ringScore, { color }]}>{fill}</Text>
        <Text style={styles.ringMax}>/ 100</Text>
      </View>
    </Animated.View>
  );
}

// ─── Trend Indicator ─────────────────────────────────
function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  const bgColor = isNeutral ? '#F3F4F6' : isPositive ? '#DCFCE7' : '#FEE2E2';
  const fgColor = isNeutral ? '#6B7280' : isPositive ? theme.colors.success : theme.colors.error;

  return (
    <View style={styles.trendCol}>
      <View style={[styles.trendBadge, { backgroundColor: bgColor }]}>
        {isPositive ? <TrendingUp size={12} color={fgColor} /> :
         isNeutral ? <Minus size={12} color={fgColor} /> :
         <TrendingDown size={12} color={fgColor} />}
        <Text style={[styles.trendValue, { color: fgColor }]}>
          {isPositive ? '+' : ''}{value}%
        </Text>
      </View>
      <Text style={styles.trendLabel}>{label}</Text>
    </View>
  );
}

// ─── Career Match Card ───────────────────────────────
function CareerMatchCard({ match }: { match: CareerMatch }) {
  const [expanded, setExpanded] = useState(false);
  const scaleValue = useSharedValue(0.95);

  useEffect(() => {
    scaleValue.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const color = readinessColor(match.match);

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 12 }]}>
      <Pressable onPress={() => setExpanded(!expanded)} style={styles.matchCard}>
        <View style={styles.matchHeader}>
          <View style={[styles.matchIcon, { backgroundColor: color + '18' }]}>
            <Compass size={20} color={color} />
          </View>
          <View style={styles.matchInfo}>
            <Text style={styles.matchTitle} numberOfLines={1}>{match.title}</Text>
            <Text style={styles.matchMeta} numberOfLines={1}>
              {match.salary_range} · {match.growth}% growth
            </Text>
          </View>
          <View style={[styles.matchBadge, { backgroundColor: color }]}>
            <Text style={styles.matchBadgeText}>{match.match}%</Text>
          </View>
        </View>

        <View style={styles.matchProgressWrap}>
          <ProgressBar value={match.match} max={100} height={6} color={color} />
        </View>

        {expanded && (
          <View style={styles.matchExpanded}>
            <Text style={styles.matchDesc}>{match.description}</Text>
            <Text style={styles.matchEdu}>Typical route: {match.education}</Text>

            <Text style={styles.matchSectionLabel}>Core Skills</Text>
            <View style={styles.skillGrid}>
              {match.core_skills.map(skill => (
                <View key={skill.skill_key} style={styles.skillItem}>
                  <View style={styles.skillRow}>
                    <View style={styles.skillNameRow}>
                      <Text style={styles.skillName} numberOfLines={1}>{skill.name}</Text>
                      {skill.verified && <BadgeCheck size={12} color={theme.colors.success} />}
                    </View>
                    <Text style={styles.skillPct}>{skill.score}%</Text>
                  </View>
                  <ProgressBar value={skill.score} max={100} height={4} />
                </View>
              ))}
            </View>

            {match.gaps.length > 0 && (
              <View style={styles.gapBanner}>
                <AlertCircle size={14} color="#92400E" />
                <Text style={styles.gapBannerText}>
                  Focus next on {match.gaps.slice(0, 3).map(g => g.name).join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.matchExpandRow}>
          <Text style={styles.matchExpandText}>{expanded ? 'Show less' : 'View details'}</Text>
          <ChevronRight size={14} color={theme.colors.muted} style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Pillar Card ─────────────────────────────────────
function PillarCard({ pillar }: { pillar: CareerPillar }) {
  const color = readinessColor(pillar.score);

  return (
    <View style={styles.pillarCard}>
      <View style={styles.pillarHeader}>
        <View style={[styles.pillarDot, { backgroundColor: color }]} />
        <View style={styles.pillarInfo}>
          <Text style={styles.pillarLabel}>{pillar.label}</Text>
          <Text style={styles.pillarWeight}>{Math.round(pillar.weight * 100)}% weight</Text>
        </View>
        <Text style={[styles.pillarScore, { color }]}>{pillar.score}%</Text>
      </View>
      <ProgressBar value={pillar.score} max={100} height={6} color={color} />
      <Text style={styles.pillarDetail}>{pillar.detail}</Text>
    </View>
  );
}

// ─── Pipeline Bar ────────────────────────────────────
function PipelineBar({ stages }: { stages: { stage: string; count: number }[] }) {
  const total = stages.reduce((s, st) => s + st.count, 0);

  return (
    <View style={styles.pipelineContainer}>
      <View style={styles.pipelineBarOuter}>
        {stages.map(stage => {
          const pct = total > 0 ? (stage.count / total) * 100 : 0;
          const color = STAGE_COLORS[stage.stage] || theme.colors.muted;
          return pct > 0 ? (
            <View key={stage.stage} style={[styles.pipelineSegment, { width: `${pct}%`, backgroundColor: color }]} />
          ) : null;
        })}
      </View>
      <View style={styles.pipelineLegend}>
        {stages.map(stage => {
          const color = STAGE_COLORS[stage.stage] || theme.colors.muted;
          return (
            <View key={stage.stage} style={styles.pipelineLegendItem}>
              <View style={[styles.pipelineLegendDot, { backgroundColor: color }]} />
              <Text style={styles.pipelineLegendLabel}>{STAGE_LABELS[stage.stage] || stage.stage}</Text>
              <Text style={styles.pipelineLegendCount}>{stage.count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Skill Bar Row ───────────────────────────────────
function SkillBarRow({ pillar }: { pillar: CareerPillar }) {
  const c = readinessColor(pillar.score);
  return (
    <View style={styles.skillBarRow}>
      <View style={styles.skillBarInfo}>
        <Text style={styles.skillBarName}>{pillar.label}</Text>
        <Text style={[styles.skillBarScore, { color: c }]}>{pillar.score}%</Text>
      </View>
      <ProgressBar value={pillar.score} max={100} height={8} color={c} />
      <Text style={styles.skillBarDetail}>{pillar.detail}</Text>
    </View>
  );
}

// ─── Session Card ────────────────────────────────────
function SessionCard({ session, showTime }: {
  session: { id: string; topic: string; mentor_name: string; scheduled_at: string; duration_minutes: number };
  showTime?: boolean;
}) {
  return (
    <Card key={session.id} style={{ gap: 6 }}>
      <View style={styles.sessionRow}>
        <View style={styles.sessionIcon}>
          <Calendar size={16} color={theme.colors.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sessionTitle}>{session.topic}</Text>
          <Text style={styles.sessionMeta}>
            {session.mentor_name} {!showTime && `· ${session.duration_minutes}min`}
          </Text>
        </View>
        <View style={styles.sessionTimeWrap}>
          {showTime && <Clock size={12} color={theme.colors.muted} />}
          <Text style={styles.sessionTime}>
            {showTime
              ? new Date(session.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : new Date(session.scheduled_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Overview Tab ────────────────────────────────────
function OverviewTab({ data }: { data: CareerDashboard }) {
  return (
    <>
      <View style={styles.statsRow}>
        <StatCard
          label="Applications"
          value={data.stats.applications}
          sub={`${data.stats.active_applications} active`}
          icon={<Briefcase size={20} color={theme.colors.brandPrimary} />}
        />
        <StatCard
          label="Offers"
          value={data.stats.offers}
          color={theme.colors.success}
          icon={<Award size={20} color={theme.colors.success} />}
        />
      </View>
      <View style={[styles.statsRow, { marginTop: 12 }]}>
        <StatCard
          label="Verified Skills"
          value={data.stats.verified_skills}
          sub={`${data.stats.assessments_passed} assessments`}
          color="#7C3AED"
          icon={<BadgeCheck size={20} color="#7C3AED" />}
        />
        <StatCard
          label="Portfolio"
          value={data.stats.projects + data.stats.certifications}
          sub={`${data.stats.projects} projects`}
          color={theme.colors.warning}
          icon={<FolderGit2 size={20} color={theme.colors.warning} />}
        />
      </View>

      <Text style={styles.sectionTitle}>Readiness Breakdown</Text>
      <Card style={{ gap: 12 }}>
        {data.pillars.map(pillar => (
          <PillarCard key={pillar.key} pillar={pillar} />
        ))}
      </Card>

      {data.recommendations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Do This Next</Text>
          {data.recommendations.map(rec => {
            const PIcon = PRIORITY_ICONS[rec.priority] || Lightbulb;
            const pColor = PRIORITY_COLORS[rec.priority] || theme.colors.muted;
            return (
              <Card
                key={rec.key}
                onPress={() => {
                  const route = ACTION_ROUTES[rec.action];
                  if (route) router.push(route);
                }}
                style={{ gap: 8 }}
              >
                <View style={styles.recHeader}>
                  <View style={[styles.recPriority, { backgroundColor: pColor + '18' }]}>
                    <PIcon size={14} color={pColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recTitle}>{rec.title}</Text>
                    <Text style={styles.recPriorityLabel}>
                      {rec.priority.charAt(0).toUpperCase() + rec.priority.slice(1)} priority
                    </Text>
                  </View>
                  <ChevronRight size={16} color={theme.colors.muted} />
                </View>
                <Text style={styles.recBody}>{rec.body}</Text>
              </Card>
            );
          })}
        </>
      )}

      {data.skill_gaps.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Skill Gaps to Close</Text>
          <Card style={{ gap: 12 }}>
            {data.skill_gaps.map(gap => (
              <View key={gap.skill_key} style={styles.gapItem}>
                <View style={styles.gapInfo}>
                  <Text style={styles.gapName}>{gap.name}</Text>
                  <Text style={styles.gapDelta}>+{gap.gap} to target</Text>
                </View>
                <ProgressBar value={gap.score} max={100} height={5} color={theme.colors.warning} />
              </View>
            ))}
            <Pressable onPress={() => router.push('/skill-assessment')} style={styles.linkRow}>
              <ClipboardCheck size={14} color={theme.colors.brandPrimary} />
              <Text style={styles.linkText}>Take assessment to close these gaps</Text>
            </Pressable>
          </Card>
        </>
      )}

      {data.upcoming_sessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Upcoming Sessions</Text>
          {data.upcoming_sessions.map(session => (
            <SessionCard key={session.id} session={session} />
          ))}
        </>
      )}

      <QuickActions actions={OVERVIEW_ACTIONS} />
    </>
  );
}

// ─── Skills Tab ──────────────────────────────────────
function SkillsTab({ data }: { data: CareerDashboard }) {
  return (
    <>
      <Text style={styles.sectionTitle}>Skill Proficiency</Text>
      <Card style={{ gap: 12 }}>
        {data.pillars.map(pillar => (
          <SkillBarRow key={pillar.key} pillar={pillar} />
        ))}
      </Card>

      {data.skill_gaps.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Priority Gaps</Text>
          <Card style={{ gap: 12 }}>
            {data.skill_gaps.map(gap => (
              <View key={gap.skill_key} style={styles.gapItem}>
                <View style={styles.gapInfo}>
                  <Text style={styles.gapName}>{gap.name}</Text>
                  <Text style={styles.gapDelta}>+{gap.gap} needed</Text>
                </View>
                <ProgressBar value={gap.score} max={100} height={5} color={theme.colors.warning} />
              </View>
            ))}
          </Card>
        </>
      )}

      {data.top_matches.length > 0 && data.top_matches[0].core_skills.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Top Match Skills</Text>
          <Card style={{ gap: 10 }}>
            <Text style={styles.matchSkillTitle}>{data.top_matches[0].title}</Text>
            {data.top_matches[0].core_skills.map(skill => (
              <View key={skill.skill_key} style={styles.skillItem}>
                <View style={styles.skillRow}>
                  <View style={styles.skillNameRow}>
                    <Text style={styles.skillName} numberOfLines={1}>{skill.name}</Text>
                    {skill.verified && <BadgeCheck size={12} color={theme.colors.success} />}
                  </View>
                  <Text style={styles.skillPct}>{skill.score}%</Text>
                </View>
                <ProgressBar value={skill.score} max={100} height={4} />
              </View>
            ))}
            <Pressable onPress={() => router.push('/skill-profile')} style={styles.linkRow}>
              <Zap size={14} color={theme.colors.brandPrimary} />
              <Text style={styles.linkText}>Update your skill profile</Text>
            </Pressable>
          </Card>
        </>
      )}

      <QuickActions actions={SKILLS_ACTIONS} />
    </>
  );
}

// ─── Careers Tab ─────────────────────────────────────
function CareersTab({ data }: { data: CareerDashboard }) {
  return (
    <>
      {data.stats.applications > 0 && (
        <>
          <Text style={styles.sectionTitle}>Application Pipeline</Text>
          <Card>
            <PipelineBar stages={data.pipeline} />
            <Pressable onPress={() => router.push('/placement')} style={styles.linkRow}>
              <Briefcase size={14} color={theme.colors.brandPrimary} />
              <Text style={styles.linkText}>Open placement portal</Text>
            </Pressable>
          </Card>
        </>
      )}

      {data.top_matches.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Career Matches</Text>
          {data.top_matches.map((match) => (
            <CareerMatchCard key={match.key} match={match} />
          ))}
        </>
      )}

      {data.pillars.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Your Skill Radar</Text>
          <Card style={{ gap: 8 }}>
            <View style={styles.radarGrid}>
              {data.pillars.map(pillar => {
                const c = readinessColor(pillar.score);
                return (
                  <View key={pillar.key} style={styles.radarItem}>
                    <View style={[styles.radarRing, { borderColor: c + '30' }]}>
                      <View style={[styles.radarDot, {
                        backgroundColor: c,
                        width: Math.max(8, pillar.score / 5),
                        height: Math.max(8, pillar.score / 5),
                      }]} />
                    </View>
                    <Text style={styles.radarLabel} numberOfLines={1}>{pillar.label}</Text>
                    <Text style={[styles.radarScore, { color: c }]}>{pillar.score}%</Text>
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      )}

      <QuickActions actions={CAREERS_ACTIONS} />
    </>
  );
}

// ─── Activity Tab ────────────────────────────────────
function ActivityTab({ data }: { data: CareerDashboard }) {
  return (
    <>
      {data.recent_activity.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <Card style={{ gap: 0 }}>
            {data.recent_activity.map((activity, index) => {
              const isActive = activity.status === 'active' || activity.status === 'completed';
              return (
                <View key={index} style={[styles.activityItem, index < data.recent_activity.length - 1 && styles.activityBorder]}>
                  <View style={[styles.activityDot, { backgroundColor: isActive ? theme.colors.success : theme.colors.muted }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityTime}>
                      {new Date(activity.at).toLocaleDateString()} · {activity.type}
                    </Text>
                  </View>
                  <View style={[styles.activityStatus, {
                    backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9',
                  }]}>
                    <Text style={[styles.activityStatusText, {
                      color: isActive ? theme.colors.success : theme.colors.muted,
                    }]}>
                      {activity.status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        </>
      )}

      <Text style={styles.sectionTitle}>Activity Summary</Text>
      <View style={styles.statsRow}>
        <StatCard
          label="Assessments"
          value={data.stats.assessments_taken}
          sub={`${data.stats.assessments_passed} passed`}
          color="#7C3AED"
          icon={<ClipboardCheck size={20} color="#7C3AED" />}
        />
        <StatCard
          label="Mentors"
          value={data.stats.active_mentors}
          sub={`${data.stats.upcoming_sessions} upcoming`}
          color="#0891B2"
          icon={<Users size={20} color="#0891B2" />}
        />
      </View>

      {data.upcoming_sessions.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Upcoming Mentorship</Text>
          {data.upcoming_sessions.map(session => (
            <SessionCard key={session.id} session={session} showTime />
          ))}
        </>
      )}

      <QuickActions actions={ACTIVITY_ACTIONS} />
    </>
  );
}

// ─── Main Component ──────────────────────────────────
type TabKey = 'overview' | 'skills' | 'careers' | 'activity';

const TABS: { key: TabKey; label: string; icon: React.FC<{ size: number; color: string }> }[] = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'skills', label: 'Skills', icon: Zap },
  { key: 'careers', label: 'Careers', icon: Compass },
  { key: 'activity', label: 'Activity', icon: Clock },
];

export default function CareerDashboardScreen() {
  const { data, loading, error, refresh } = useFetch<CareerDashboard>('/career/dashboard');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const score = data?.readiness_score ?? 0;
  const color = readinessColor(score);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Hero */}
        <View style={styles.hero}>
          <LinearGradient colors={[color, '#4F46E5', '#7C3AED']} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.headerRow}>
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <ArrowLeft color="#fff" size={22} />
              </Pressable>
              <Text style={styles.headerTitle}>Career Dashboard</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={styles.heroContent}>
              <ReadinessRing score={score} size={120} strokeWidth={10} />
              <View style={styles.heroStats}>
                <Text style={styles.heroGrade}>{readinessGrade(score)}</Text>
                <Text style={styles.heroSubtext}>{readinessMessage(score)}</Text>
                <View style={styles.trendRow}>
                  <TrendIndicator value={5} label="vs last month" />
                  <TrendIndicator value={-2} label="vs peers" />
                </View>
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              >
                <Icon size={16} color={activeTab === tab.key ? theme.colors.brandPrimary : theme.colors.muted} />
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
            {data && (
              <>
                {activeTab === 'overview' && <OverviewTab data={data} />}
                {activeTab === 'skills' && <SkillsTab data={data} />}
                {activeTab === 'careers' && <CareersTab data={data} />}
                {activeTab === 'activity' && <ActivityTab data={data} />}
              </>
            )}
          </AsyncView>
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
}

// ─── Styles ──────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  // Hero
  hero: { height: 260, overflow: 'hidden' },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  heroContent: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: 16,
  },
  heroStats: { flex: 1 },
  heroGrade: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 18 },
  trendRow: { flexDirection: 'row', gap: 12, marginTop: 10 },

  // Ring
  ringOuter: { alignItems: 'center', justifyContent: 'center' },
  ringBg: { position: 'absolute' },
  ringFill: { position: 'absolute', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontSize: 32, fontWeight: '900' },
  ringMax: { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },

  // Trend
  trendCol: { alignItems: 'center' },
  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm,
  },
  trendValue: { fontSize: 12, fontWeight: '700' },
  trendLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  // Tabs
  tabBar: {
    flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1, flexDirection: 'row', paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.brandPrimary },
  tabText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabTextActive: { color: theme.colors.brandPrimary },

  content: { padding: theme.spacing.lg, paddingBottom: 100, gap: 16 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 12 },

  // Section
  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface, marginTop: 8 },

  // Pillar
  pillarCard: { gap: 8 },
  pillarHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillarDot: { width: 8, height: 8, borderRadius: 4 },
  pillarInfo: { flex: 1 },
  pillarLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  pillarWeight: { fontSize: 11, color: theme.colors.muted },
  pillarScore: { fontSize: 15, fontWeight: '800' },
  pillarDetail: { fontSize: 11, color: theme.colors.muted, lineHeight: 16 },

  // Recommendation
  recHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recPriority: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  recTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  recPriorityLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  recBody: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },

  // Skill Gaps
  gapItem: { gap: 6 },
  gapInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  gapName: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  gapDelta: { fontSize: 11, fontWeight: '700', color: theme.colors.warning },

  // Links
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  linkText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },

  // Session
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center',
  },
  sessionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  sessionMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  sessionTimeWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionTime: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  // Match Card
  matchCard: {
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden',
  },
  matchHeader: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.lg, gap: 10 },
  matchIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  matchInfo: { flex: 1 },
  matchTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  matchMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  matchBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.md },
  matchBadgeText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  matchProgressWrap: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  matchExpanded: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: 10 },
  matchDesc: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  matchEdu: { fontSize: 11, color: theme.colors.muted, fontStyle: 'italic' },
  matchSectionLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginTop: 4 },
  matchExpandRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 4,
  },
  matchExpandText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },

  // Skill Grid
  skillGrid: { gap: 8 },
  skillItem: { gap: 4 },
  skillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skillNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  skillName: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  skillPct: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },

  // Gap Banner
  gapBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF3C7', borderRadius: theme.radius.md, padding: 10,
  },
  gapBannerText: { flex: 1, fontSize: 11, color: '#92400E', fontWeight: '600' },

  // Pipeline
  pipelineContainer: { gap: 12 },
  pipelineBarOuter: {
    flexDirection: 'row', height: 8, borderRadius: 4,
    overflow: 'hidden', backgroundColor: theme.colors.surfaceTertiary,
  },
  pipelineSegment: { height: 8 },
  pipelineLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pipelineLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pipelineLegendDot: { width: 8, height: 8, borderRadius: 4 },
  pipelineLegendLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  pipelineLegendCount: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface },

  // Skill Bar (skills tab)
  skillBarRow: { gap: 6 },
  skillBarInfo: { flexDirection: 'row', justifyContent: 'space-between' },
  skillBarName: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  skillBarScore: { fontSize: 13, fontWeight: '800' },
  skillBarDetail: { fontSize: 11, color: theme.colors.muted },

  matchSkillTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },

  // Radar
  radarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  radarItem: { width: '22%', alignItems: 'center', gap: 4 },
  radarRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radarDot: { borderRadius: 99 },
  radarLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', textAlign: 'center' },
  radarScore: { fontSize: 11, fontWeight: '700' },

  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    flexGrow: 1, minWidth: '46%', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.lg,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },

  // Activity
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  activityTime: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  activityStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  activityStatusText: { fontSize: 10, fontWeight: '700' },
});
