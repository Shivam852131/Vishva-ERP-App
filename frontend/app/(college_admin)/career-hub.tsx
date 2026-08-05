import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Zap, TrendingUp, Users, Target, BookOpen, Award, ChevronRight,
  BarChart3, Briefcase, X,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, SectionTitle, ProgressBar, ProgressRing, EmptyState, ChipBtn } from '@/src/ui';
import { useRouter } from '@/src/navigation/router';

const PILLAR_COLORS: Record<string, string> = {
  skills: '#3B82F6',
  assessments: '#8B5CF6',
  applications: '#10B981',
  portfolio: '#F59E0B',
  mentorship: '#EC4899',
};

export default function CareerHubAdmin() {
  const router = useRouter();
  const { data: dash, loading: dashLoading, refresh: refreshDash } = useFetch<any>('/career/dashboard');
  const { data: users = [], refresh: refreshUsers } = useFetch<any[]>('/admin/users?role=student');
  const { data: drives = [] } = useFetch<any[]>('/placement/drives');
  const { data: assessments = [] } = useFetch<any[]>('/assessments');
  const { data: mentors = [] } = useFetch<any[]>('/mentorship/mentors');
  const { data: skillProfile } = useFetch<any>('/skills/profile');
  const { data: placementStats } = useFetch<any>('/placement/stats');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'readiness' | 'skills' | 'actions'>('overview');
  const [searchQ, setSearchQ] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDash();
    refreshUsers();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshDash, refreshUsers]);

  const stats = useMemo(() => {
    const totalStudents = users.length;
    const activeDrives = (drives as any[]).filter((d: any) => d.status === 'active' || d.status === 'open').length;
    const totalApplications = (placementStats as any)?.applications || 0;
    const totalOffers = (placementStats as any)?.offers || 0;
    const readinessScore = dash?.readiness_score || 0;
    const topSkills = dash?.skill_gaps?.length || 0;
    return { totalStudents, activeDrives, totalApplications, totalOffers, readinessScore, topSkills };
  }, [users, drives, dash, placementStats]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'readiness', label: 'Readiness', icon: <Target size={14} /> },
    { key: 'skills', label: 'Skills', icon: <Zap size={14} /> },
    { key: 'actions', label: 'Actions', icon: <Award size={14} /> },
  ];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {/* Header */}
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.h1}>Career Hub</Text>
                <Text style={styles.sub} numberOfLines={1}>Manage career readiness & placement activities</Text>
              </View>
              <Pressable onPress={() => router.push('/(college_admin)/placements' as any)} style={styles.iconBtn}>
                <Briefcase color={theme.colors.brand} size={18} />
              </Pressable>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statMini}>
                <Users size={14} color="#3B82F6" />
                <Text style={styles.statMiniVal}>{stats.totalStudents}</Text>
                <Text style={styles.statMiniLabel}>Students</Text>
              </View>
              <View style={styles.statMini}>
                <Briefcase size={14} color="#10B981" />
                <Text style={styles.statMiniVal}>{stats.activeDrives}</Text>
                <Text style={styles.statMiniLabel}>Active Drives</Text>
              </View>
              <View style={styles.statMini}>
                <Target size={14} color="#8B5CF6" />
                <Text style={styles.statMiniVal}>{stats.totalApplications}</Text>
                <Text style={styles.statMiniLabel}>Applications</Text>
              </View>
              <View style={styles.statMini}>
                <Award size={14} color="#F59E0B" />
                <Text style={styles.statMiniVal}>{stats.totalOffers}</Text>
                <Text style={styles.statMiniLabel}>Offers</Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabBar}>
              {tabs.map(t => (
                <Pressable key={t.key} onPress={() => setTab(t.key as any)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
                  {t.icon}
                  <Text style={[styles.tabTxt, tab === t.key && styles.tabTxtActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {dashLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
          ) : (
            <>
              {/* Overview Tab */}
              {tab === 'overview' && (
                <View style={{ padding: theme.spacing.lg }}>
                  {/* Readiness Score */}
                  <Card style={{ marginBottom: 12, alignItems: 'center' }}>
                    <Text style={styles.cardTitle}>Overall Readiness</Text>
                    <ProgressRing percentage={stats.readinessScore} size={100} label="Readiness Score" />
                    <Text style={styles.cardSub} numberOfLines={2}>Based on skills, assessments, applications, portfolio & mentorship</Text>
                  </Card>

                  {/* Pillars */}
                  <SectionTitle title="Readiness Pillars" />
                  {dash?.pillars?.map((p: any) => (
                    <Card key={p.key} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pillarName}>{p.label}</Text>
                          <Text style={styles.pillarDetail} numberOfLines={1}>{p.detail}</Text>
                        </View>
                        <Text style={[styles.pillarScore, { color: PILLAR_COLORS[p.key] || theme.colors.brandPrimary }]}>{p.score}%</Text>
                      </View>
                      <ProgressBar value={p.score} max={100} height={6} color={PILLAR_COLORS[p.key] || theme.colors.brandPrimary} style={{ marginTop: 8 }} />
                      <Text style={styles.pillarWeight}>Weight: {Math.round(p.weight * 100)}%</Text>
                    </Card>
                  ))}

                  {/* Quick Stats */}
                  <SectionTitle title="Placement Pipeline" />
                  {dash?.pipeline?.map((p: any) => (
                    <View key={p.stage} style={styles.pipelineRow}>
                      <Text style={styles.pipelineStage}>{p.stage.replace(/_/g, ' ')}</Text>
                      <View style={{ flex: 1, marginHorizontal: 12 }}>
                        <ProgressBar value={p.count} max={Math.max(...(dash.pipeline || []).map((x: any) => x.count), 1)} height={6} />
                      </View>
                      <Text style={styles.pipelineCount}>{p.count}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Readiness Tab */}
              {tab === 'readiness' && (
                <View style={{ padding: theme.spacing.lg }}>
                  <SectionTitle title="Recommendations" />
                  {dash?.recommendations?.map((r: any) => (
                    <Card key={r.key} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <View style={[styles.recBadge, { backgroundColor: r.priority === 'high' ? '#FEE2E2' : r.priority === 'medium' ? '#FEF3C7' : '#DCFCE7' }]}>
                          <Text style={[styles.recBadgeTxt, { color: r.priority === 'high' ? '#EF4444' : r.priority === 'medium' ? '#F59E0B' : '#10B981' }]}>
                            {r.priority?.toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recTitle}>{r.title}</Text>
                          <Text style={styles.recBody}>{r.body}</Text>
                          <Text style={styles.recAction}>Action: {r.action}</Text>
                        </View>
                      </View>
                    </Card>
                  ))}
                  {(!dash?.recommendations || dash.recommendations.length === 0) && (
                    <EmptyState title="No recommendations" sub="All students are on track" />
                  )}

                  <SectionTitle title="Recent Activity" />
                  {dash?.recent_activity?.map((a: any, i: number) => (
                    <View key={i} style={styles.activityRow}>
                      <View style={[styles.activityDot, { backgroundColor: a.status === 'completed' ? '#10B981' : a.status === 'in_progress' ? '#3B82F6' : '#F59E0B' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityTitle}>{a.title}</Text>
                        <Text style={styles.activityTime}>{new Date(a.at).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.activityStatus, { color: a.status === 'completed' ? '#10B981' : a.status === 'in_progress' ? '#3B82F6' : '#F59E0B' }]}>
                        {a.status?.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Skills Tab */}
              {tab === 'skills' && (
                <View style={{ padding: theme.spacing.lg }}>
                  <SectionTitle title="Skill Gaps (Students Need)" />
                  {dash?.skill_gaps?.map((g: any) => (
                    <Card key={g.skill_key} style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.gapName}>{g.name}</Text>
                        <View style={styles.gapBadge}>
                          <Text style={styles.gapBadgeTxt}>Gap: {g.gap}</Text>
                        </View>
                      </View>
                      <ProgressBar value={g.score} max={100} height={6} color="#F59E0B" style={{ marginTop: 8 }} />
                      <Text style={styles.gapScore}>Current: {g.score}%</Text>
                    </Card>
                  ))}
                  {(!dash?.skill_gaps || dash.skill_gaps.length === 0) && (
                    <EmptyState title="No skill gaps identified" sub="All skills are above threshold" />
                  )}

                  <SectionTitle title="Skill Profile Summary" />
                  {skillProfile?.summary && (
                    <Card>
                      <View style={styles.skillSummary}>
                        <View style={styles.skillSumItem}>
                          <Text style={styles.skillSumVal}>{skillProfile.summary.total_skills}</Text>
                          <Text style={styles.skillSumLabel}>Total Skills</Text>
                        </View>
                        <View style={styles.skillSumItem}>
                          <Text style={styles.skillSumVal}>{skillProfile.summary.verified_skills}</Text>
                          <Text style={styles.skillSumLabel}>Verified</Text>
                        </View>
                        <View style={styles.skillSumItem}>
                          <Text style={styles.skillSumVal}>{skillProfile.summary.average_score}%</Text>
                          <Text style={styles.skillSumLabel}>Avg Score</Text>
                        </View>
                        <View style={styles.skillSumItem}>
                          <Text style={styles.skillSumVal}>{skillProfile.summary.endorsements}</Text>
                          <Text style={styles.skillSumLabel}>Endorsements</Text>
                        </View>
                      </View>
                    </Card>
                  )}
                </View>
              )}

              {/* Actions Tab */}
              {tab === 'actions' && (
                <View style={{ padding: theme.spacing.lg }}>
                  <SectionTitle title="Management Actions" />
                  <Pressable style={styles.actionCard} onPress={() => router.push('/(college_admin)/placements' as any)}>
                    <View style={[styles.actionIcon, { backgroundColor: '#3B82F615' }]}>
                      <Briefcase size={20} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionTitle}>Manage Placements</Text>
                      <Text style={styles.actionSub}>Create drives, review applications</Text>
                    </View>
                    <ChevronRight color={theme.colors.muted} size={16} />
                  </Pressable>
                  <Pressable style={styles.actionCard} onPress={() => router.push('/(college_admin)/assessments-admin' as any)}>
                    <View style={[styles.actionIcon, { backgroundColor: '#8B5CF615' }]}>
                      <BookOpen size={20} color="#8B5CF6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionTitle}>Manage Assessments</Text>
                      <Text style={styles.actionSub}>Create quizzes, view results</Text>
                    </View>
                    <ChevronRight color={theme.colors.muted} size={16} />
                  </Pressable>
                  <Pressable style={styles.actionCard} onPress={() => router.push('/(college_admin)/mentorship-admin' as any)}>
                    <View style={[styles.actionIcon, { backgroundColor: '#EC489915' }]}>
                      <Users size={20} color="#EC4899" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionTitle}>Manage Mentorship</Text>
                      <Text style={styles.actionSub}>Mentors, connections, sessions</Text>
                    </View>
                    <ChevronRight color={theme.colors.muted} size={16} />
                  </Pressable>
                  <Pressable style={styles.actionCard} onPress={() => router.push('/(college_admin)/skill-admin' as any)}>
                    <View style={[styles.actionIcon, { backgroundColor: '#10B98115' }]}>
                      <Zap size={20} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionTitle}>Skill Profiles</Text>
                      <Text style={styles.actionSub}>Catalog, endorsements, projects</Text>
                    </View>
                    <ChevronRight color={theme.colors.muted} size={16} />
                  </Pressable>

                  <SectionTitle title="Career Stats" />
                  <View style={styles.statsGrid}>
                    <Card style={styles.statsGridItem}>
                      <Text style={styles.statsGridVal}>{placementStats?.open_drives || 0}</Text>
                      <Text style={styles.statsGridLabel}>Open Drives</Text>
                    </Card>
                    <Card style={styles.statsGridItem}>
                      <Text style={styles.statsGridVal}>{placementStats?.total_drives || 0}</Text>
                      <Text style={styles.statsGridLabel}>Total Drives</Text>
                    </Card>
                    <Card style={styles.statsGridItem}>
                      <Text style={[styles.statsGridVal, { color: '#10B981' }]}>{placementStats?.conversion_rate || 0}%</Text>
                      <Text style={styles.statsGridLabel}>Conversion</Text>
                    </Card>
                    <Card style={styles.statsGridItem}>
                      <Text style={styles.statsGridVal}>₹{placementStats?.highest_package || 0}L</Text>
                      <Text style={styles.statsGridLabel}>Highest CTC</Text>
                    </Card>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  statMini: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', gap: 4 },
  statMiniVal: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  statMiniLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600' },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabTxtActive: { color: '#fff' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 8 },
  cardSub: { fontSize: 11, color: theme.colors.muted, marginTop: 8, textAlign: 'center' },
  pillarName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  pillarDetail: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  pillarScore: { fontSize: 20, fontWeight: '800' },
  pillarWeight: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  pipelineStage: { minWidth: 70, fontSize: 11, fontWeight: '600', color: theme.colors.onSurface, textTransform: 'capitalize' },
  pipelineCount: { width: 30, fontSize: 13, fontWeight: '800', color: theme.colors.onSurface, textAlign: 'right' },
  recBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, alignSelf: 'flex-start' },
  recBadgeTxt: { fontSize: 9, fontWeight: '800' },
  recTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  recBody: { fontSize: 12, color: theme.colors.muted, marginTop: 4, lineHeight: 18 },
  recAction: { fontSize: 11, color: theme.colors.brandPrimary, fontWeight: '600', marginTop: 6 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  activityDot: { width: 8, height: 8, borderRadius: 4 },
  activityTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  activityTime: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  activityStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  gapName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  gapBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  gapBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  gapScore: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
  skillSummary: { flexDirection: 'row', justifyContent: 'space-around' },
  skillSumItem: { alignItems: 'center' },
  skillSumVal: { fontSize: 20, fontWeight: '800', color: theme.colors.brandPrimary },
  skillSumLabel: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  actionSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statsGridItem: { width: '48%', alignItems: 'center', paddingVertical: theme.spacing.md },
  statsGridVal: { fontSize: 24, fontWeight: '800', color: theme.colors.brandPrimary },
  statsGridLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
});
