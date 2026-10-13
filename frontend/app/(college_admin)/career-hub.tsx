import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Zap, Users, Target, BookOpen, Award, ChevronRight,
  BarChart3, Briefcase, GraduationCap, LineChart, Sparkles,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, SectionTitle, ProgressBar, ProgressRing, EmptyState } from '@/src/ui';
import { useRouter } from '@/src/navigation/router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PILLAR_COLORS: Record<string, string> = {
  skills: '#3B82F6',
  assessments: '#8B5CF6',
  applications: '#10B981',
  portfolio: '#F59E0B',
  mentorship: '#EC4899',
};

const STAT_ITEMS = [
  { key: 'totalStudents',    icon: Users,    color: '#3B82F6', label: 'Students', bg: '#EFF6FF' },
  { key: 'activeDrives',     icon: Briefcase, color: '#10B981', label: 'Drives',   bg: '#F0FDF4' },
  { key: 'totalApplications',icon: Target,   color: '#8B5CF6', label: 'Applied',  bg: '#F5F3FF' },
  { key: 'totalOffers',      icon: Award,    color: '#F59E0B', label: 'Offers',   bg: '#FFFBEB' },
] as const;

const ACTIONS = [
  { icon: Briefcase,    color: '#3B82F6', title: 'Manage Placements',  sub: 'Create drives, review applications', route: '/(college_admin)/placements' },
  { icon: BookOpen,     color: '#8B5CF6', title: 'Manage Assessments', sub: 'Create quizzes, view results',       route: '/(college_admin)/assessments-admin' },
  { icon: Users,        color: '#EC4899', title: 'Manage Mentorship',  sub: 'Mentors, connections, sessions',     route: '/(college_admin)/mentorship-admin' },
  { icon: Zap,          color: '#10B981', title: 'Skill Profiles',     sub: 'Catalog, endorsements, projects',   route: '/(college_admin)/skill-admin' },
  { icon: GraduationCap,color: '#F59E0B', title: 'Career Advisor',     sub: 'AI-powered career guidance',        route: '/career-advisor' },
  { icon: LineChart,    color: '#6366F1', title: 'Career Analytics',   sub: 'Trends, insights, reports',         route: '/career-dashboard' },
] as const;

export default function CareerHubAdmin() {
  const router = useRouter();
  const { data: dash, loading: dashLoading, refresh: refreshDash } = useFetch<any>('/career/dashboard');
  const { data: users = [], refresh: refreshUsers } = useFetch<any[]>('/admin/users?role=student');
  const { data: drives = [] } = useFetch<any[]>('/placement/drives');
  const { data: skillProfile } = useFetch<any>('/skills/profile');
  const { data: placementStats } = useFetch<any>('/placement/stats');
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'readiness' | 'skills' | 'actions'>('overview');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDash();
    refreshUsers();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshDash, refreshUsers]);

  const stats = useMemo(() => {
    const totalStudents     = users.length;
    const activeDrives      = (drives as any[]).filter((d: any) => d.status === 'active' || d.status === 'open').length;
    const totalApplications = (placementStats as any)?.applications || 0;
    const totalOffers       = (placementStats as any)?.offers || 0;
    const readinessScore    = dash?.readiness_score || 0;
    return { totalStudents, activeDrives, totalApplications, totalOffers, readinessScore };
  }, [users, drives, dash, placementStats]);

  const tabs = [
    { key: 'overview',  label: 'Overview',  Icon: BarChart3 },
    { key: 'readiness', label: 'Readiness', Icon: Target },
    { key: 'skills',    label: 'Skills',    Icon: Zap },
    { key: 'actions',   label: 'Actions',   Icon: Award },
  ] as const;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header Banner ── */}
          <View style={styles.headerBanner}>
            <View style={styles.headerLeft}>
              <View style={styles.headerBadge}>
                <Sparkles size={11} color="#fff" />
                <Text style={styles.headerBadgeTxt}>Admin Dashboard</Text>
              </View>
              <Text style={styles.h1}>Career Hub</Text>
              <Text style={styles.sub} numberOfLines={2}>
                Manage career readiness &amp; placement activities
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/(college_admin)/placements' as any)}
              style={styles.iconBtn}
            >
              <Briefcase color="#fff" size={18} />
            </Pressable>
          </View>

          {/* ── Stats Row ── */}
          <View style={styles.statsRow}>
            {STAT_ITEMS.map((item) => {
              const Icon = item.icon;
              const val  = (stats as any)[item.key] ?? 0;
              return (
                <View key={item.key} style={[styles.statCard, { backgroundColor: item.bg }]}>
                  <View style={[styles.statIconWrap, { backgroundColor: item.color + '25' }]}>
                    <Icon size={15} color={item.color} />
                  </View>
                  <Text style={[styles.statVal, { color: item.color }]}>{val}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </View>
              );
            })}
          </View>

          {/* ── Tab Bar ── */}
          <View style={styles.tabBar}>
            {tabs.map(({ key, label, Icon }) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.tabBtn, active && styles.tabBtnActive]}
                >
                  <Icon size={15} color={active ? '#fff' : theme.colors.muted} />
                  <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Content ── */}
          {dashLoading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
              <Text style={styles.loaderText}>Loading career data…</Text>
            </View>
          ) : (
            <View style={styles.tabContent}>

              {/* ──────── Overview ──────── */}
              {tab === 'overview' && (
                <>
                  <Card style={styles.readinessCard}>
                    <View style={styles.readinessRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Overall Readiness</Text>
                        <Text style={styles.cardSub}>
                          Skills · Assessments · Applications · Portfolio · Mentorship
                        </Text>
                      </View>
                      <ProgressRing percentage={stats.readinessScore} size={76} label="Score" />
                    </View>
                  </Card>

                  {dash?.pillars?.length > 0 && (
                    <>
                      <SectionTitle title="Readiness Pillars" />
                      {dash.pillars.map((p: any) => (
                        <Card key={p.key} style={styles.pillarCard}>
                          <View style={styles.pillarRow}>
                            <View style={[styles.pillarDot, { backgroundColor: PILLAR_COLORS[p.key] || theme.colors.brandPrimary }]} />
                            <View style={styles.pillarMeta}>
                              <Text style={styles.pillarName} numberOfLines={1}>{p.label}</Text>
                              <Text style={styles.pillarDetail} numberOfLines={1}>{p.detail}</Text>
                            </View>
                            <View style={styles.pillarScoreWrap}>
                              <Text style={[styles.pillarScore, { color: PILLAR_COLORS[p.key] || theme.colors.brandPrimary }]}>
                                {p.score}%
                              </Text>
                              <Text style={styles.pillarWeight}>wt {Math.round(p.weight * 100)}%</Text>
                            </View>
                          </View>
                          <ProgressBar
                            value={p.score} max={100} height={6}
                            color={PILLAR_COLORS[p.key] || theme.colors.brandPrimary}
                            style={{ marginTop: 10 }}
                          />
                        </Card>
                      ))}
                    </>
                  )}

                  {dash?.pipeline?.length > 0 && (
                    <>
                      <SectionTitle title="Placement Pipeline" />
                      <Card style={{ marginBottom: 12 }}>
                        {dash.pipeline.map((p: any, i: number) => (
                          <View
                            key={p.stage}
                            style={[
                              styles.pipelineRow,
                              i === dash.pipeline.length - 1 && { borderBottomWidth: 0 },
                            ]}
                          >
                            <Text style={styles.pipelineStage} numberOfLines={1}>
                              {p.stage.replace(/_/g, ' ')}
                            </Text>
                            <View style={styles.pipelineBarWrap}>
                              <ProgressBar
                                value={p.count}
                                max={Math.max(...(dash.pipeline || []).map((x: any) => x.count), 1)}
                                height={6}
                              />
                            </View>
                            <Text style={styles.pipelineCount}>{p.count}</Text>
                          </View>
                        ))}
                      </Card>
                    </>
                  )}
                </>
              )}

              {/* ──────── Readiness ──────── */}
              {tab === 'readiness' && (
                <>
                  <SectionTitle title="Recommendations" />
                  {dash?.recommendations?.length > 0
                    ? dash.recommendations.map((r: any) => {
                        const pc =
                          r.priority === 'high' ? '#EF4444' :
                          r.priority === 'medium' ? '#F59E0B' : '#10B981';
                        const pbg =
                          r.priority === 'high' ? '#FEE2E2' :
                          r.priority === 'medium' ? '#FEF3C7' : '#DCFCE7';
                        return (
                          <View key={r.key} style={styles.recCard}>
                            <View style={[styles.recBar, { backgroundColor: pc }]} />
                            <View style={styles.recInner}>
                              <View style={[styles.recBadge, { backgroundColor: pbg }]}>
                                <Text style={[styles.recBadgeTxt, { color: pc }]}>
                                  {r.priority?.toUpperCase()}
                                </Text>
                              </View>
                              <Text style={styles.recTitle}>{r.title}</Text>
                              <Text style={styles.recBodyTxt}>{r.body}</Text>
                              <Text style={styles.recAction}>→ {r.action}</Text>
                            </View>
                          </View>
                        );
                      })
                    : <EmptyState title="No recommendations" sub="All students are on track" />
                  }

                  <SectionTitle title="Recent Activity" />
                  {dash?.recent_activity?.length > 0
                    ? (
                      <Card style={{ marginBottom: 12 }}>
                        {dash.recent_activity.map((a: any, i: number) => {
                          const dc =
                            a.status === 'completed' ? '#10B981' :
                            a.status === 'in_progress' ? '#3B82F6' : '#F59E0B';
                          return (
                            <View
                              key={i}
                              style={[
                                styles.activityRow,
                                i === dash.recent_activity.length - 1 && { borderBottomWidth: 0 },
                              ]}
                            >
                              <View style={[styles.activityDot, { backgroundColor: dc }]} />
                              <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                                <Text style={styles.activityTitle} numberOfLines={1}>{a.title}</Text>
                                <Text style={styles.activityTime}>{new Date(a.at).toLocaleDateString()}</Text>
                              </View>
                              <View style={[styles.activityBadge, { backgroundColor: dc + '22' }]}>
                                <Text style={[styles.activityStatus, { color: dc }]}>
                                  {a.status?.replace(/_/g, ' ')}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </Card>
                    )
                    : <EmptyState title="No recent activity" sub="Nothing to show yet" />
                  }
                </>
              )}

              {/* ──────── Skills ──────── */}
              {tab === 'skills' && (
                <>
                  <SectionTitle title="Skill Gaps" />
                  {dash?.skill_gaps?.length > 0
                    ? dash.skill_gaps.map((g: any) => (
                        <Card key={g.skill_key} style={styles.gapCard}>
                          <View style={styles.gapRow}>
                            <Text style={styles.gapName} numberOfLines={1}>{g.name}</Text>
                            <View style={styles.gapBadge}>
                              <Text style={styles.gapBadgeTxt}>Gap: {g.gap}</Text>
                            </View>
                          </View>
                          <ProgressBar value={g.score} max={100} height={8} color="#F59E0B" style={{ marginTop: 8 }} />
                          <Text style={styles.gapScore}>Proficiency: {g.score}%</Text>
                        </Card>
                      ))
                    : <EmptyState title="No skill gaps identified" sub="All skills are above threshold" />
                  }

                  {skillProfile?.summary && (
                    <>
                      <SectionTitle title="Skill Profile Summary" />
                      <Card style={styles.skillSummaryCard}>
                        {[
                          { label: 'Total Skills',  val: skillProfile.summary.total_skills,    color: theme.colors.brandPrimary },
                          { label: 'Verified',       val: skillProfile.summary.verified_skills, color: '#10B981' },
                          { label: 'Avg Score',      val: `${skillProfile.summary.average_score}%`, color: '#F59E0B' },
                          { label: 'Endorsements',   val: skillProfile.summary.endorsements,    color: '#EC4899' },
                        ].map((item) => (
                          <View key={item.label} style={styles.skillSumItem}>
                            <Text style={[styles.skillSumVal, { color: item.color }]}>{item.val}</Text>
                            <Text style={styles.skillSumLabel}>{item.label}</Text>
                          </View>
                        ))}
                      </Card>
                    </>
                  )}
                </>
              )}

              {/* ──────── Actions ──────── */}
              {tab === 'actions' && (
                <>
                  <SectionTitle title="Management Actions" />
                  {ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <Pressable
                        key={action.title}
                        style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.75 }]}
                        onPress={() => router.push(action.route as any)}
                      >
                        <View style={[styles.actionIconWrap, { backgroundColor: action.color + '18' }]}>
                          <Icon size={20} color={action.color} />
                        </View>
                        <View style={styles.actionMeta}>
                          <Text style={styles.actionTitle}>{action.title}</Text>
                          <Text style={styles.actionSub} numberOfLines={1}>{action.sub}</Text>
                        </View>
                        <ChevronRight color={theme.colors.muted} size={16} />
                      </Pressable>
                    );
                  })}

                  <SectionTitle title="Career Stats" />
                  <View style={styles.statsGrid}>
                    {[
                      { label: 'Open Drives',  val: placementStats?.open_drives   ?? 0,  color: '#3B82F6' },
                      { label: 'Total Drives', val: placementStats?.total_drives   ?? 0,  color: '#8B5CF6' },
                      { label: 'Conversion',   val: `${placementStats?.conversion_rate ?? 0}%`, color: '#10B981' },
                      { label: 'Highest CTC',  val: `₹${placementStats?.highest_package ?? 0}L`, color: '#F59E0B' },
                    ].map((item) => (
                      <Card key={item.label} style={styles.statsGridItem}>
                        <Text style={[styles.statsGridVal, { color: item.color }]}>{item.val}</Text>
                        <Text style={styles.statsGridLabel}>{item.label}</Text>
                      </Card>
                    ))}
                  </View>
                </>
              )}

            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

/* ─────────────────────────── Styles ─────────────────────────── */
const CARD_GAP        = 8;
const GRID_COLS       = 2;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - theme.spacing.lg * 2 - CARD_GAP) / GRID_COLS;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surface },
  scrollContent: { paddingBottom: 100 },

  /* Header */
  headerBanner: {
    margin: theme.spacing.lg,
    marginBottom: 4,
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...theme.shadow.md,
  },
  headerLeft: { flex: 1 },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    marginBottom: 8,
  },
  headerBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.4 },
  h1:  { fontSize: 26, fontWeight: '800', color: '#fff' },
  sub: { color: 'rgba(255,255,255,0.75)', marginTop: 4, fontSize: 12, lineHeight: 18 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginBottom: 4,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 2,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 3,
    ...theme.shadow.xs,
  },
  statIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statVal:      { fontSize: 17, fontWeight: '800', lineHeight: 21 },
  statLabel:    { fontSize: 9, color: theme.colors.muted, fontWeight: '600', textAlign: 'center' },

  /* Tab Bar — column layout stops icon/text overlap */
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: 4,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabTxt:       { fontSize: 10, fontWeight: '700', color: theme.colors.muted, textAlign: 'center' },
  tabTxtActive: { color: '#fff' },

  /* Loader */
  loaderWrap: { marginTop: 60, alignItems: 'center', gap: 12 },
  loaderText: { fontSize: 13, color: theme.colors.muted, fontWeight: '500' },

  /* Tab Content */
  tabContent: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },

  /* Overview — Readiness */
  readinessCard: { marginBottom: 12, padding: theme.spacing.lg },
  readinessRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  cardSub:   { fontSize: 11, color: theme.colors.muted, marginTop: 6, lineHeight: 16 },

  /* Pillars */
  pillarCard: { marginBottom: 8, padding: theme.spacing.md },
  pillarRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pillarDot:  { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  pillarMeta: { flex: 1, minWidth: 0 },
  pillarName:   { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  pillarDetail: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  pillarScoreWrap: { alignItems: 'flex-end', flexShrink: 0 },
  pillarScore:  { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  pillarWeight: { fontSize: 9, color: theme.colors.muted, marginTop: 2 },

  /* Pipeline — explicit widths prevent overlap */
  pipelineRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
    gap: 10,
  },
  pipelineStage: {
    width: 88, flexShrink: 0,
    fontSize: 11, fontWeight: '600', color: theme.colors.onSurface,
    textTransform: 'capitalize',
  },
  pipelineBarWrap: { flex: 1 },
  pipelineCount: {
    width: 26, flexShrink: 0,
    fontSize: 13, fontWeight: '800', color: theme.colors.onSurface, textAlign: 'right',
  },

  /* Recommendations */
  recCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 10,
    overflow: 'hidden',
    ...theme.shadow.xs,
  },
  recBar:   { width: 4, flexShrink: 0 },
  recInner: { flex: 1, padding: theme.spacing.md, gap: 4 },
  recBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  recBadgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  recTitle:    { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  recBodyTxt:  { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  recAction:   { fontSize: 11, color: theme.colors.brandPrimary, fontWeight: '600' },

  /* Activity */
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.divider,
    gap: 12,
  },
  activityDot:    { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  activityTitle:  { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  activityTime:   { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  activityBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, flexShrink: 0 },
  activityStatus: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  /* Skill Gaps */
  gapCard: { marginBottom: 8, padding: theme.spacing.md },
  gapRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  gapName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface, flex: 1 },
  gapBadge: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.radius.pill, flexShrink: 0,
  },
  gapBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  gapScore:    { fontSize: 11, color: theme.colors.muted, marginTop: 6 },

  skillSummaryCard: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: theme.spacing.lg, marginBottom: 12 },
  skillSumItem:     { alignItems: 'center', gap: 4 },
  skillSumVal:      { fontSize: 22, fontWeight: '800' },
  skillSumLabel:    { fontSize: 10, color: theme.colors.muted, fontWeight: '600', textAlign: 'center' },

  /* Action Cards */
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 8,
    ...theme.shadow.xs,
  },
  actionIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  actionMeta:     { flex: 1, minWidth: 0 },
  actionTitle:    { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  actionSub:      { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  /* Stats Grid — computed width avoids '48%' rounding overlap */
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, marginBottom: 12 },
  statsGridItem: { width: GRID_ITEM_WIDTH, alignItems: 'center', paddingVertical: theme.spacing.lg },
  statsGridVal:  { fontSize: 24, fontWeight: '800' },
  statsGridLabel:{ fontSize: 11, color: theme.colors.muted, marginTop: 6, fontWeight: '600', textAlign: 'center' },
});

