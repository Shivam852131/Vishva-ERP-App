import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Briefcase, MapPin, Calendar, Users, TrendingUp,
  CheckCircle2, XCircle, AlertCircle, Building2, X, Search,
  Award, Clock, Target,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { PlacementDrive, PlacementApplication, PlacementStats } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, Button, StatCard, ProgressBar, EmptyState } from '@/src/ui';

const TABS = [
  { key: 'drives', label: 'Drives' },
  { key: 'applications', label: 'My Applications' },
  { key: 'stats', label: 'Insights' },
];

const JOB_FILTERS = [
  { key: 'all', label: 'All roles' },
  { key: 'full_time', label: 'Full-time' },
  { key: 'internship', label: 'Internship' },
];

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  applied: { bg: '#DBEAFE', fg: '#2563EB', label: 'Applied' },
  shortlisted: { bg: '#FEF3C7', fg: '#D97706', label: 'Shortlisted' },
  in_process: { bg: '#EDE9FE', fg: '#7C3AED', label: 'In Process' },
  offered: { bg: '#DCFCE7', fg: '#16A34A', label: 'Offer' },
  accepted: { bg: '#DCFCE7', fg: '#15803D', label: 'Accepted' },
  rejected: { bg: '#FEE2E2', fg: '#DC2626', label: 'Rejected' },
  withdrawn: { bg: '#F1F5F9', fg: '#64748B', label: 'Withdrawn' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_STYLES[status] || STATUS_STYLES.applied;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.fg }]}>{config.label}</Text>
    </View>
  );
}

function CompanyAvatar({ company }: { company: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{company.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

// ─── Drive detail + apply ────────────────────────────────────────
function DriveDetailModal({ drive, visible, onClose, onApplied }: {
  drive: PlacementDrive | null;
  visible: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [coverNote, setCoverNote] = useState('');
  const [applying, setApplying] = useState(false);

  if (!drive) return null;

  const apply = async () => {
    setApplying(true);
    try {
      await api(`/placement/drives/${drive.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverNote: coverNote.trim() || null }),
      });
      Alert.alert('Application submitted', `You have applied to ${drive.company}. Track progress under My Applications.`);
      setCoverNote('');
      onApplied();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not apply', e?.message || 'Please try again.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} accessibilityLabel="Close">
            <X size={22} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={styles.modalTitle}>Drive details</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 40, gap: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <CompanyAvatar company={drive.company} />
            <View style={{ flex: 1 }}>
              <Text style={styles.detailCompany}>{drive.company}</Text>
              <Text style={styles.detailRole}>{drive.role}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaBox}>
              <Text style={styles.metaBoxLabel}>Package</Text>
              <Text style={styles.metaBoxValue}>{drive.package_label}</Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.metaBoxLabel}>Location</Text>
              <Text style={styles.metaBoxValue}>{drive.location}</Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.metaBoxLabel}>Openings</Text>
              <Text style={styles.metaBoxValue}>{drive.openings ?? '—'}</Text>
            </View>
            <View style={styles.metaBox}>
              <Text style={styles.metaBoxLabel}>Deadline</Text>
              <Text style={styles.metaBoxValue}>
                {drive.days_left >= 0 ? `${drive.days_left}d left` : 'Closed'}
              </Text>
            </View>
          </View>

          {drive.description ? (
            <Card style={{ gap: 6 }}>
              <Text style={styles.sectionLabel}>About the role</Text>
              <Text style={styles.bodyText}>{drive.description}</Text>
            </Card>
          ) : null}

          <Card style={{ gap: 10 }}>
            <Text style={styles.sectionLabel}>Eligibility</Text>
            {drive.eligibility.checks.map(check => (
              <View key={check.key} style={styles.checkRow}>
                {check.unverified
                  ? <AlertCircle size={16} color={theme.colors.warning} />
                  : check.passed
                    ? <CheckCircle2 size={16} color={theme.colors.success} />
                    : <XCircle size={16} color={theme.colors.error} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkLabel}>{check.label}</Text>
                  <Text style={styles.checkMeta}>
                    Yours: {check.actual}{check.unverified ? ' (not verified yet)' : ''}
                  </Text>
                </View>
              </View>
            ))}
            {drive.eligibility.checks.length === 0 && (
              <Text style={styles.bodyText}>Open to all students.</Text>
            )}
          </Card>

          {drive.required_skills.length > 0 && (
            <Card style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionLabel}>Skills they screen for</Text>
                <Text style={styles.readinessValue}>{drive.eligibility.skill_readiness}% ready</Text>
              </View>
              <ProgressBar value={drive.eligibility.skill_readiness} max={100} height={7} />
              <View style={styles.chipWrap}>
                {drive.required_skills.map(skill => {
                  const gap = drive.eligibility.skill_gaps.find(g => g.skill_key === skill.skill_key);
                  return (
                    <View key={skill.skill_key} style={[styles.skillChip, gap && styles.skillChipGap]}>
                      <Text style={[styles.skillChipText, gap && { color: theme.colors.warning }]}>{skill.name}</Text>
                    </View>
                  );
                })}
              </View>
              {drive.eligibility.skill_gaps.length > 0 && (
                <Text style={styles.hintText}>
                  Highlighted skills are below 50%. Take an assessment to strengthen them.
                </Text>
              )}
            </Card>
          )}

          <Card style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>Selection process</Text>
            {drive.rounds.map((round, index) => (
              <View key={index} style={styles.roundRow}>
                <View style={styles.roundNum}>
                  <Text style={styles.roundNumText}>{index + 1}</Text>
                </View>
                <Text style={styles.roundName}>{round}</Text>
              </View>
            ))}
          </Card>

          {drive.applied ? (
            <Card style={{ alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={28} color={theme.colors.success} />
              <Text style={styles.appliedTitle}>Already applied</Text>
              <Text style={styles.bodyText}>Track your progress under My Applications.</Text>
            </Card>
          ) : !drive.eligibility.eligible ? (
            <Card style={{ gap: 6, borderColor: theme.colors.error }}>
              <Text style={[styles.sectionLabel, { color: theme.colors.error }]}>Not eligible yet</Text>
              {drive.eligibility.failed_checks.map(reason => (
                <Text key={reason} style={styles.bodyText}>• {reason}</Text>
              ))}
            </Card>
          ) : drive.days_left < 0 ? (
            <Card><Text style={styles.bodyText}>Applications for this drive have closed.</Text></Card>
          ) : (
            <>
              <TextInput
                style={styles.noteInput}
                value={coverNote}
                onChangeText={setCoverNote}
                placeholder="Add a short note to the recruiter (optional)"
                placeholderTextColor={theme.colors.muted}
                multiline
              />
              <Button label={`Apply to ${drive.company}`} loading={applying} onPress={apply} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Application detail ──────────────────────────────────────────
function ApplicationCard({ application, onWithdraw }: {
  application: PlacementApplication;
  onWithdraw: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const clearedRounds = application.rounds.filter(r => r.status === 'cleared').length;
  const progress = application.rounds.length ? (clearedRounds / application.rounds.length) * 100 : 0;

  return (
    <Card style={{ gap: 10 }} onPress={() => setExpanded(v => !v)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <CompanyAvatar company={application.company} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{application.company}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>{application.role}</Text>
        </View>
        <StatusBadge status={application.status} />
      </View>

      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.progressLabel}>
            Round {Math.min(application.current_round + 1, application.rounds.length)} of {application.rounds.length}
          </Text>
          <Text style={styles.progressLabel}>{application.package_label}</Text>
        </View>
        <ProgressBar value={progress} max={100} height={6} />
      </View>

      {expanded && (
        <View style={{ gap: 10, marginTop: 4 }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.sectionLabel}>Rounds</Text>
            {application.rounds.map((round, index) => (
              <View key={index} style={styles.roundRow}>
                {round.status === 'cleared'
                  ? <CheckCircle2 size={15} color={theme.colors.success} />
                  : round.status === 'failed'
                    ? <XCircle size={15} color={theme.colors.error} />
                    : <Clock size={15} color={theme.colors.muted} />}
                <Text style={[styles.roundName, round.status === 'pending' && { color: theme.colors.muted }]}>
                  {round.name}
                </Text>
              </View>
            ))}
          </View>

          {application.timeline.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={styles.sectionLabel}>Timeline</Text>
              {application.timeline.map((entry, index) => (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineEvent}>{entry.event}</Text>
                    <Text style={styles.timelineDate}>{new Date(entry.at).toLocaleDateString()}</Text>
                    {entry.note ? <Text style={styles.timelineNote}>{entry.note}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}

          {!['offered', 'accepted', 'withdrawn', 'rejected'].includes(application.status) && (
            <Button label="Withdraw application" variant="secondary" onPress={() => onWithdraw(application.id)} />
          )}
        </View>
      )}
    </Card>
  );
}

// ─── Screen ──────────────────────────────────────────────────────
export default function Placement() {
  const [tab, setTab] = useState('drives');
  const [jobFilter, setJobFilter] = useState('all');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PlacementDrive | null>(null);

  const drivesPath = `/placement/drives${jobFilter !== 'all' ? `?jobType=${jobFilter}` : ''}`;
  const { data: drives, loading, error, refresh } = useFetch<PlacementDrive[]>(drivesPath);
  const { data: applications, refresh: refreshApps } = useFetch<PlacementApplication[]>('/placement/applications');
  const { data: stats, refresh: refreshStats } = useFetch<PlacementStats>('/placement/stats');

  const refreshAll = () => {
    refresh();
    refreshApps();
    refreshStats();
  };

  const visibleDrives = useMemo(() => {
    let list = drives || [];
    if (eligibleOnly) list = list.filter(d => d.eligibility.eligible);
    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter(d =>
        d.company.toLowerCase().includes(query) || d.role.toLowerCase().includes(query));
    }
    return list;
  }, [drives, eligibleOnly, search]);

  const withdraw = async (id: string) => {
    Alert.alert('Withdraw application?', 'You will need to reapply if the drive is still open.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/placement/applications/${id}/withdraw`, { method: 'POST' });
            refreshAll();
          } catch (e: any) {
            Alert.alert('Could not withdraw', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.hero}>
          <View style={styles.heroRow}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.heroTitle}>Placement Portal</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats?.open_drives ?? '—'}</Text>
              <Text style={styles.heroStatLabel}>Open drives</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats?.applications ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Applied</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{stats?.offers ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Offers</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.tabBar}>
          {TABS.map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === t.key && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'drives' && (
          <>
            <View style={styles.searchRow}>
              <Search size={16} color={theme.colors.muted} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search company or role"
                placeholderTextColor={theme.colors.muted}
              />
            </View>
            <View style={styles.filterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg }}>
                {JOB_FILTERS.map(f => (
                  <ChipBtn key={f.key} label={f.label} active={jobFilter === f.key} onPress={() => setJobFilter(f.key)} />
                ))}
                <ChipBtn label="Eligible only" active={eligibleOnly} onPress={() => setEligibleOnly(v => !v)} />
              </ScrollView>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
              refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
            >
              <AsyncView
                loading={loading && !drives}
                error={error}
                onRetry={refresh}
                empty={!loading && visibleDrives.length === 0}
                emptyTitle="No drives match"
                emptySub="Try clearing filters or check back soon."
                emptyIcon={<Briefcase size={48} color={theme.colors.muted} />}
              >
                {visibleDrives.map(drive => (
                  <Card key={drive.id} onPress={() => setSelected(drive)} style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <CompanyAvatar company={drive.company} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{drive.company}</Text>
                        <Text style={styles.cardSub} numberOfLines={1}>{drive.role}</Text>
                      </View>
                      {drive.applied
                        ? <StatusBadge status={drive.application_status || 'applied'} />
                        : drive.eligibility.eligible
                          ? <View style={[styles.badge, { backgroundColor: '#DCFCE7' }]}>
                              <Text style={[styles.badgeText, { color: '#16A34A' }]}>Eligible</Text>
                            </View>
                          : <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                              <Text style={[styles.badgeText, { color: '#DC2626' }]}>Not eligible</Text>
                            </View>}
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaItem}>
                        <Award size={13} color={theme.colors.brandPrimary} />
                        <Text style={styles.metaStrong}>{drive.package_label}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <MapPin size={13} color={theme.colors.muted} />
                        <Text style={styles.metaText}>{drive.location}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Users size={13} color={theme.colors.muted} />
                        <Text style={styles.metaText}>{drive.application_count} applied</Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <View style={styles.metaItem}>
                        <Calendar size={13} color={drive.closing_soon ? theme.colors.error : theme.colors.muted} />
                        <Text style={[styles.metaText, drive.closing_soon && { color: theme.colors.error, fontWeight: '700' }]}>
                          {drive.days_left >= 0 ? `${drive.days_left} days left` : 'Closed'}
                        </Text>
                      </View>
                      {drive.required_skills.length > 0 && (
                        <Text style={styles.readinessSmall}>{drive.eligibility.skill_readiness}% skill match</Text>
                      )}
                    </View>
                  </Card>
                ))}
              </AsyncView>
            </ScrollView>
          </>
        )}

        {tab === 'applications' && (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 12 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            {(applications || []).length === 0 ? (
              <EmptyState
                title="No applications yet"
                sub="Apply to a drive and track every round here."
                icon={<Target size={48} color={theme.colors.muted} />}
              />
            ) : (
              (applications || []).map(application => (
                <ApplicationCard key={application.id} application={application} onWithdraw={withdraw} />
              ))
            )}
          </ScrollView>
        )}

        {tab === 'stats' && (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 14 }}
            refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            {stats ? (
              <>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <StatCard label="Applications" value={stats.applications} icon={<Briefcase size={20} color={theme.colors.brandPrimary} />} />
                  <StatCard label="Offers" value={stats.offers} color={theme.colors.success} icon={<Award size={20} color={theme.colors.success} />} />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <StatCard label="Conversion" value={`${stats.conversion_rate}%`} color="#7C3AED" icon={<TrendingUp size={20} color="#7C3AED" />} />
                  <StatCard label="Highest pkg" value={stats.highest_package ? `${stats.highest_package} LPA` : '—'} color={theme.colors.warning} icon={<Award size={20} color={theme.colors.warning} />} />
                </View>

                <Card style={{ gap: 10 }}>
                  <Text style={styles.sectionLabel}>Application funnel</Text>
                  {stats.by_stage.filter(s => s.count > 0).length === 0 ? (
                    <Text style={styles.bodyText}>Apply to a drive to see your funnel.</Text>
                  ) : (
                    stats.by_stage.map(stage => {
                      const config = STATUS_STYLES[stage.stage] || STATUS_STYLES.applied;
                      const max = Math.max(...stats.by_stage.map(s => s.count), 1);
                      return (
                        <View key={stage.stage} style={{ gap: 4 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={styles.funnelLabel}>{config.label}</Text>
                            <Text style={styles.funnelValue}>{stage.count}</Text>
                          </View>
                          <ProgressBar value={stage.count} max={max} height={6} color={config.fg} />
                        </View>
                      );
                    })
                  )}
                </Card>

                {stats.top_recruiters.length > 0 && (
                  <Card style={{ gap: 8 }}>
                    <Text style={styles.sectionLabel}>Top recruiters</Text>
                    {stats.top_recruiters.map(recruiter => (
                      <View key={recruiter.company} style={styles.recruiterRow}>
                        <Building2 size={15} color={theme.colors.brandPrimary} />
                        <Text style={styles.recruiterName}>{recruiter.company}</Text>
                        <Text style={styles.recruiterCount}>{recruiter.count}</Text>
                      </View>
                    ))}
                  </Card>
                )}
              </>
            ) : (
              <AsyncView loading error={null} empty={false} />
            )}
          </ScrollView>
        )}

        <DriveDetailModal
          drive={selected}
          visible={!!selected}
          onClose={() => setSelected(null)}
          onApplied={refreshAll}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: theme.spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: theme.radius.lg, padding: theme.spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.brandPrimary },
  tabLabel: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md,
    paddingHorizontal: 12, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.onSurface },
  filterRow: { paddingVertical: theme.spacing.md },

  avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: theme.colors.brandPrimary },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  cardSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  metaStrong: { fontSize: 12, color: theme.colors.brandPrimary, fontWeight: '800' },
  readinessSmall: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  readinessValue: { fontSize: 12, fontWeight: '800', color: theme.colors.brandPrimary },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: theme.radius.sm },
  badgeText: { fontSize: 10, fontWeight: '800' },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  detailCompany: { fontSize: 19, fontWeight: '800', color: theme.colors.onSurface },
  detailRole: { fontSize: 14, color: theme.colors.muted, marginTop: 2 },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaBox: {
    flexGrow: 1, minWidth: '46%', backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 12,
  },
  metaBoxLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  metaBoxValue: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface, marginTop: 3 },

  sectionLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  bodyText: { fontSize: 13, color: theme.colors.muted, lineHeight: 19 },
  hintText: { fontSize: 11, color: theme.colors.warning, fontWeight: '600' },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' },
  checkMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  skillChip: { backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.sm, paddingHorizontal: 9, paddingVertical: 4 },
  skillChipGap: { backgroundColor: '#FEF3C7' },
  skillChipText: { fontSize: 11, color: theme.colors.onBrandTertiary, fontWeight: '700' },

  roundRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roundNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  roundNumText: { fontSize: 10, fontWeight: '800', color: theme.colors.brandPrimary },
  roundName: { fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' },

  noteInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
    padding: 12, minHeight: 80, textAlignVertical: 'top',
    fontSize: 14, color: theme.colors.onSurface, backgroundColor: theme.colors.surfaceSecondary,
  },
  appliedTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },

  progressLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '700' },
  timelineRow: { flexDirection: 'row', gap: 8 },
  timelineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.brandPrimary, marginTop: 5 },
  timelineEvent: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  timelineDate: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  timelineNote: { fontSize: 11, color: theme.colors.muted, marginTop: 2, fontStyle: 'italic' },

  funnelLabel: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },
  funnelValue: { fontSize: 12, color: theme.colors.muted, fontWeight: '700' },
  recruiterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recruiterName: { flex: 1, fontSize: 13, color: theme.colors.onSurface, fontWeight: '600' },
  recruiterCount: { fontSize: 12, color: theme.colors.muted, fontWeight: '700' },
});
