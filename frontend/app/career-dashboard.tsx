import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Target, TrendingUp, Briefcase, Award, Users,
  ChevronRight, Sparkles, Calendar, AlertCircle, BadgeCheck,
  ClipboardCheck, FolderGit2, Compass,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import type { CareerDashboard, CareerMatch } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ProgressBar, StatCard } from '@/src/ui';

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

const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  in_process: 'In Process',
  offered: 'Offered',
  rejected: 'Rejected',
};

function readinessColor(score: number) {
  return score >= 80 ? '#10B981' : score >= 60 ? '#3B82F6' : score >= 40 ? '#F59E0B' : '#EF4444';
}

// Circular gauge built from two half-circle masks — avoids pulling in a chart lib.
function ReadinessGauge({ score, label }: { score: number; label: string }) {
  return (
    <View style={styles.gauge}>
      <View style={styles.gaugeInner}>
        <Text style={styles.gaugeScore}>{score}</Text>
        <Text style={styles.gaugeUnit}>/ 100</Text>
      </View>
      <Text style={styles.gaugeLabel}>{label}</Text>
    </View>
  );
}

function MatchCard({ match }: { match: CareerMatch }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card onPress={() => setExpanded(v => !v)} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={styles.matchIcon}>
          <Compass size={19} color={theme.colors.brandPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.matchTitle}>{match.title}</Text>
          <Text style={styles.matchMeta}>{match.salary_range} · {match.growth}% growth</Text>
        </View>
        <View style={[styles.matchBadge, { backgroundColor: readinessColor(match.match) }]}>
          <Text style={styles.matchBadgeText}>{match.match}%</Text>
        </View>
      </View>

      <ProgressBar value={match.match} max={100} height={6} color={readinessColor(match.match)} />

      {expanded && (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text style={styles.bodyText}>{match.description}</Text>
          <Text style={styles.metaText}>Typical route: {match.education}</Text>

          <Text style={styles.sectionLabel}>Core skills</Text>
          {match.core_skills.map(skill => (
            <View key={skill.skill_key} style={{ gap: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.skillLabel}>{skill.name}</Text>
                  {skill.verified && <BadgeCheck size={12} color={theme.colors.success} />}
                </View>
                <Text style={styles.skillValue}>{skill.score}%</Text>
              </View>
              <ProgressBar value={skill.score} max={100} height={5} />
            </View>
          ))}

          {match.gaps.length > 0 && (
            <View style={styles.gapBox}>
              <AlertCircle size={14} color={theme.colors.warning} />
              <Text style={styles.gapText}>
                Focus next on {match.gaps.slice(0, 3).map(g => g.name).join(', ')}
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

export default function CareerDashboardScreen() {
  const { data, loading, error, refresh } = useFetch<CareerDashboard>('/career/dashboard');

  const score = data?.readiness_score ?? 0;
  const color = readinessColor(score);

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={[color, '#4F46E5']} style={styles.hero}>
          <View style={styles.heroRow}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.heroTitle}>Career Dashboard</Text>
            <View style={{ width: 22 }} />
          </View>
          <ReadinessGauge score={score} label={data?.readiness_label || 'Getting started'} />
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 16 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
        >
          <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
            {data && (
              <>
                {/* Readiness pillars */}
                <Card style={{ gap: 12 }}>
                  <Text style={styles.sectionLabel}>What makes up your score</Text>
                  {data.pillars.map(pillar => (
                    <View key={pillar.key} style={{ gap: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.pillarLabel}>
                          {pillar.label}
                          <Text style={styles.pillarWeight}> · {Math.round(pillar.weight * 100)}%</Text>
                        </Text>
                        <Text style={[styles.pillarScore, { color: readinessColor(pillar.score) }]}>
                          {pillar.score}%
                        </Text>
                      </View>
                      <ProgressBar value={pillar.score} max={100} height={6} color={readinessColor(pillar.score)} />
                      <Text style={styles.pillarDetail}>{pillar.detail}</Text>
                    </View>
                  ))}
                </Card>

                {/* Key stats */}
                <View style={{ flexDirection: 'row', gap: 12 }}>
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
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <StatCard
                    label="Verified skills"
                    value={data.stats.verified_skills}
                    sub={`${data.stats.assessments_passed} assessments passed`}
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

                {/* Recommendations */}
                {data.recommendations.length > 0 && (
                  <View style={{ gap: 10 }}>
                    <Text style={styles.groupTitle}>Do this next</Text>
                    {data.recommendations.map(recommendation => (
                      <Card
                        key={recommendation.key}
                        onPress={() => {
                          const route = ACTION_ROUTES[recommendation.action];
                          if (route) router.push(route);
                        }}
                        style={{ gap: 6 }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[recommendation.priority] || theme.colors.muted }]} />
                          <Text style={[styles.recTitle, { flex: 1 }]}>{recommendation.title}</Text>
                          <ChevronRight size={15} color={theme.colors.muted} />
                        </View>
                        <Text style={styles.bodyText}>{recommendation.body}</Text>
                      </Card>
                    ))}
                  </View>
                )}

                {/* Career matches */}
                {data.top_matches.length > 0 && (
                  <View style={{ gap: 10 }}>
                    <Text style={styles.groupTitle}>Career matches</Text>
                    {data.top_matches.map(match => (
                      <MatchCard key={match.key} match={match} />
                    ))}
                  </View>
                )}

                {/* Skill gaps */}
                {data.skill_gaps.length > 0 && (
                  <Card style={{ gap: 10 }}>
                    <Text style={styles.sectionLabel}>Your biggest skill gaps</Text>
                    {data.skill_gaps.map(gap => (
                      <View key={gap.skill_key} style={{ gap: 3 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={styles.skillLabel}>{gap.name}</Text>
                          <Text style={styles.gapValue}>+{gap.gap} to target</Text>
                        </View>
                        <ProgressBar value={gap.score} max={100} height={5} color={theme.colors.warning} />
                      </View>
                    ))}
                    <Pressable onPress={() => router.push('/skill-assessment')} style={styles.linkRow}>
                      <ClipboardCheck size={14} color={theme.colors.brandPrimary} />
                      <Text style={styles.linkText}>Take an assessment to close these</Text>
                    </Pressable>
                  </Card>
                )}

                {/* Application pipeline */}
                {data.stats.applications > 0 && (
                  <Card style={{ gap: 10 }}>
                    <Text style={styles.sectionLabel}>Placement pipeline</Text>
                    {data.pipeline.map(stage => {
                      const max = Math.max(...data.pipeline.map(s => s.count), 1);
                      return (
                        <View key={stage.stage} style={{ gap: 3 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.skillLabel}>{STAGE_LABELS[stage.stage] || stage.stage}</Text>
                            <Text style={styles.skillValue}>{stage.count}</Text>
                          </View>
                          <ProgressBar value={stage.count} max={max} height={5} />
                        </View>
                      );
                    })}
                    <Pressable onPress={() => router.push('/placement')} style={styles.linkRow}>
                      <Briefcase size={14} color={theme.colors.brandPrimary} />
                      <Text style={styles.linkText}>Open placement portal</Text>
                    </Pressable>
                  </Card>
                )}

                {/* Upcoming mentorship */}
                {data.upcoming_sessions.length > 0 && (
                  <Card style={{ gap: 10 }}>
                    <Text style={styles.sectionLabel}>Upcoming mentorship</Text>
                    {data.upcoming_sessions.map(session => (
                      <View key={session.id} style={styles.sessionRow}>
                        <Calendar size={15} color={theme.colors.brandPrimary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recTitle}>{session.topic}</Text>
                          <Text style={styles.metaText}>
                            {session.mentor_name} · {new Date(session.scheduled_at).toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Recent activity */}
                {data.recent_activity.length > 0 && (
                  <Card style={{ gap: 10 }}>
                    <Text style={styles.sectionLabel}>Recent activity</Text>
                    {data.recent_activity.map((activity, index) => (
                      <View key={index} style={styles.activityRow}>
                        <View style={styles.activityDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activityText}>{activity.title}</Text>
                          <Text style={styles.metaText}>{new Date(activity.at).toLocaleDateString()}</Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Shortcuts */}
                <View style={styles.shortcutGrid}>
                  {[
                    { label: 'Skill Profile', icon: Sparkles, route: '/skill-profile', color: '#059669' },
                    { label: 'Assessments', icon: ClipboardCheck, route: '/skill-assessment', color: '#7C3AED' },
                    { label: 'Placements', icon: Briefcase, route: '/placement', color: '#4F46E5' },
                    { label: 'Mentorship', icon: Users, route: '/mentorship', color: '#0891B2' },
                  ].map(shortcut => {
                    const Icon = shortcut.icon;
                    return (
                      <Pressable key={shortcut.route} onPress={() => router.push(shortcut.route)} style={styles.shortcut}>
                        <View style={[styles.shortcutIcon, { backgroundColor: shortcut.color + '18' }]}>
                          <Icon size={20} color={shortcut.color} />
                        </View>
                        <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </AsyncView>
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl, gap: theme.spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  gauge: { alignItems: 'center', gap: 8 },
  gaugeInner: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 6, borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  gaugeScore: { fontSize: 40, fontWeight: '900', color: '#fff' },
  gaugeUnit: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  gaugeLabel: { fontSize: 15, fontWeight: '800', color: '#fff' },

  groupTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  bodyText: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  metaText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },

  pillarLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  pillarWeight: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  pillarScore: { fontSize: 13, fontWeight: '800' },
  pillarDetail: { fontSize: 11, color: theme.colors.muted },

  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  recTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },

  matchIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  matchTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  matchMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  matchBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.md },
  matchBadgeText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  skillLabel: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },
  skillValue: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  gapValue: { fontSize: 11, color: theme.colors.warning, fontWeight: '700' },
  gapBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', borderRadius: theme.radius.md, padding: 10 },
  gapText: { flex: 1, fontSize: 11, color: '#92400E', fontWeight: '600' },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  linkText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },

  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityRow: { flexDirection: 'row', gap: 8 },
  activityDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.brandPrimary, marginTop: 6 },
  activityText: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },

  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: {
    flexGrow: 1, minWidth: '46%', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, paddingVertical: theme.spacing.lg,
  },
  shortcutIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
});
