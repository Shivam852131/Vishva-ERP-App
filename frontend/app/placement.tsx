import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, TextInput, Alert, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Briefcase, MapPin, Calendar, Users, TrendingUp,
  CheckCircle2, XCircle, AlertCircle, Building2, X, Search,
  Award, Clock, Target, Filter, ChevronDown, ChevronRight,
  ArrowUpRight, Download, RefreshCw, BarChart3, ChevronUp,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { PlacementDrive, PlacementApplication, PlacementStats } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, Button, StatCard, ProgressBar, EmptyState, Skeleton } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'drives', label: 'Drive Board' },
  { key: 'applications', label: 'Applications' },
  { key: 'analytics', label: 'Analytics' },
];

const JOB_FILTERS = [
  { key: 'all', label: 'All Roles' },
  { key: 'full_time', label: 'Full-Time' },
  { key: 'internship', label: 'Internship' },
];

const APP_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'applied', label: 'Applied' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'in_process', label: 'In Process' },
  { key: 'offered', label: 'Offered' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string; dot: string }> = {
  applied: { bg: '#EFF6FF', fg: '#2563EB', label: 'Applied', dot: '#3B82F6' },
  shortlisted: { bg: '#FFFBEB', fg: '#D97706', label: 'Shortlisted', dot: '#F59E0B' },
  in_process: { bg: '#F5F3FF', fg: '#7C3AED', label: 'In Process', dot: '#8B5CF6' },
  offered: { bg: '#F0FDF4', fg: '#16A34A', label: 'Offered', dot: '#22C55E' },
  accepted: { bg: '#F0FDF4', fg: '#15803D', label: 'Accepted', dot: '#16A34A' },
  rejected: { bg: '#FEF2F2', fg: '#DC2626', label: 'Rejected', dot: '#EF4444' },
  withdrawn: { bg: '#F8FAFC', fg: '#64748B', label: 'Withdrawn', dot: '#94A3B8' },
};

const ADMIN_STATUS_OPTIONS = ['applied', 'shortlisted', 'in_process', 'offered', 'accepted', 'rejected'] as const;

function StatusBadge({ status, size = 'default' }: { status: string; size?: 'small' | 'default' }) {
  const config = STATUS_STYLES[status] || STATUS_STYLES.applied;
  const isSmall = size === 'small';
  return (
    <View style={[erpStyles.badge, { backgroundColor: config.bg }, isSmall && erpStyles.badgeSmall]}>
      <View style={[erpStyles.badgeDot, { backgroundColor: config.dot }, isSmall && erpStyles.badgeDotSmall]} />
      <Text style={[erpStyles.badgeText, { color: config.fg }, isSmall && erpStyles.badgeTextSmall]}>
        {config.label}
      </Text>
    </View>
  );
}

function CompanyAvatar({ company, size = 44 }: { company: string; size?: number }) {
  const initials = company
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={[erpStyles.avatar, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={[erpStyles.avatarText, { fontSize: size * 0.35 }]}>{initials}</Text>
    </View>
  );
}

// ─── Drive Detail Modal ────────────────────────────────────────
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
      Alert.alert('Application Submitted', `You have successfully applied to ${drive.company}.`);
      setCoverNote('');
      onApplied();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit application.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={erpStyles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={erpStyles.modalTitle}>Drive Details</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={erpStyles.modalContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={erpStyles.modalCompanyRow}>
            <CompanyAvatar company={drive.company} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={erpStyles.modalCompany}>{drive.company}</Text>
              <Text style={erpStyles.modalRole}>{drive.role}</Text>
            </View>
          </View>

          <View style={erpStyles.modalMetaGrid}>
            {[
              { label: 'Package', value: drive.package_label },
              { label: 'Location', value: drive.location },
              { label: 'Openings', value: String(drive.openings ?? '—') },
              { label: 'Deadline', value: drive.days_left >= 0 ? `${drive.days_left}d left` : 'Closed' },
            ].map(item => (
              <View key={item.label} style={erpStyles.modalMetaBox}>
                <Text style={erpStyles.modalMetaLabel}>{item.label}</Text>
                <Text style={erpStyles.modalMetaValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          {drive.description ? (
            <View style={erpStyles.modalSection}>
              <Text style={erpStyles.modalSectionTitle}>About the Role</Text>
              <Text style={erpStyles.modalBodyText}>{drive.description}</Text>
            </View>
          ) : null}

          <View style={erpStyles.modalSection}>
            <Text style={erpStyles.modalSectionTitle}>Eligibility Checks</Text>
            {drive.eligibility.checks.length === 0 ? (
              <Text style={erpStyles.modalBodyText}>Open to all students.</Text>
            ) : (
              drive.eligibility.checks.map(check => (
                <View key={check.key} style={erpStyles.checkRow}>
                  {check.unverified
                    ? <AlertCircle size={16} color={theme.colors.warning} />
                    : check.passed
                      ? <CheckCircle2 size={16} color={theme.colors.success} />
                      : <XCircle size={16} color={theme.colors.error} />}
                  <View style={{ flex: 1 }}>
                    <Text style={erpStyles.checkLabel}>{check.label}</Text>
                    <Text style={erpStyles.checkMeta}>
                      Yours: {check.actual}{check.unverified ? ' (pending verification)' : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {drive.required_skills.length > 0 && (
            <View style={erpStyles.modalSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={erpStyles.modalSectionTitle}>Skill Requirements</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.brandPrimary }}>
                  {drive.eligibility.skill_readiness}% match
                </Text>
              </View>
              <ProgressBar value={drive.eligibility.skill_readiness} max={100} height={6} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {drive.required_skills.map(skill => {
                  const gap = drive.eligibility.skill_gaps.find(g => g.skill_key === skill.skill_key);
                  return (
                    <View
                      key={skill.skill_key}
                      style={[erpStyles.skillTag, gap && erpStyles.skillTagGap]}
                    >
                      <Text style={[erpStyles.skillTagText, gap && { color: theme.colors.warning }]}>
                        {skill.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {drive.eligibility.skill_gaps.length > 0 && (
                <Text style={{ fontSize: 11, color: theme.colors.warning, fontWeight: '600', marginTop: 8 }}>
                  Highlighted skills need improvement. Consider taking an assessment.
                </Text>
              )}
            </View>
          )}

          <View style={erpStyles.modalSection}>
            <Text style={erpStyles.modalSectionTitle}>Selection Process</Text>
            {drive.rounds.map((round, index) => (
              <View key={index} style={erpStyles.roundStep}>
                <View style={erpStyles.roundStepNum}>
                  <Text style={erpStyles.roundStepNumText}>{index + 1}</Text>
                </View>
                <Text style={erpStyles.roundStepName}>{round}</Text>
              </View>
            ))}
          </View>

          {drive.applied ? (
            <View style={erpStyles.modalAppliedBox}>
              <CheckCircle2 size={22} color={theme.colors.success} />
              <Text style={erpStyles.modalAppliedText}>You have already applied to this drive.</Text>
            </View>
          ) : !drive.eligibility.eligible ? (
            <View style={erpStyles.modalIneligibleBox}>
              <Text style={erpStyles.modalIneligibleTitle}>Not Eligible</Text>
              {drive.eligibility.failed_checks.map(reason => (
                <Text key={reason} style={erpStyles.modalIneligibleReason}>• {reason}</Text>
              ))}
            </View>
          ) : drive.days_left < 0 ? (
            <View style={erpStyles.modalIneligibleBox}>
              <Text style={erpStyles.modalIneligibleTitle}>Applications Closed</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <TextInput
                style={erpStyles.noteInput}
                value={coverNote}
                onChangeText={setCoverNote}
                placeholder="Cover note (optional)"
                placeholderTextColor={theme.colors.muted}
                multiline
              />
              <Button label={`Apply to ${drive.company}`} loading={applying} onPress={apply} />
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Application Card ──────────────────────────────────────────
function ApplicationRow({ application, onWithdraw, onStatusUpdate, isAdmin }: {
  application: PlacementApplication;
  onWithdraw: (id: string) => void;
  onStatusUpdate?: (id: string, status: string) => void;
  isAdmin?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const clearedRounds = application.rounds.filter(r => r.status === 'cleared').length;
  const totalRounds = application.rounds.length;
  const progress = totalRounds > 0 ? (clearedRounds / totalRounds) * 100 : 0;

  return (
    <View style={erpStyles.appCard}>
      <Pressable onPress={() => setExpanded(v => !v)} style={erpStyles.appCardHeader}>
        <CompanyAvatar company={application.company} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={erpStyles.appCardCompany} numberOfLines={1}>{application.company}</Text>
          <Text style={erpStyles.appCardRole} numberOfLines={1}>{application.role}</Text>
        </View>
        <StatusBadge status={application.status} size="small" />
        {expanded
          ? <ChevronUp size={16} color={theme.colors.muted} style={{ marginLeft: 4 }} />
          : <ChevronRight size={16} color={theme.colors.muted} style={{ marginLeft: 4 }} />}
      </Pressable>

      <View style={erpStyles.appCardProgressRow}>
        <View style={{ flex: 1 }}>
          <ProgressBar value={progress} max={100} height={4} />
        </View>
        <Text style={erpStyles.appCardRoundText}>
          {clearedRounds}/{totalRounds} rounds
        </Text>
        <Text style={erpStyles.appCardPkg}>{application.package_label}</Text>
      </View>

      {expanded && (
        <View style={erpStyles.appCardExpanded}>
          <View style={erpStyles.divider} />

          <Text style={erpStyles.appCardSectionTitle}>Rounds</Text>
          {application.rounds.map((round, index) => (
            <View key={index} style={erpStyles.roundRow}>
              {round.status === 'cleared'
                ? <CheckCircle2 size={14} color={theme.colors.success} />
                : round.status === 'failed'
                  ? <XCircle size={14} color={theme.colors.error} />
                  : <Clock size={14} color={theme.colors.muted} />}
              <Text style={[erpStyles.roundName, round.status === 'pending' && { color: theme.colors.muted }]}>
                {round.name}
              </Text>
              {round.feedback ? (
                <Text style={erpStyles.roundFeedback} numberOfLines={1}>{round.feedback}</Text>
              ) : null}
            </View>
          ))}

          {application.timeline.length > 0 && (
            <>
              <Text style={[erpStyles.appCardSectionTitle, { marginTop: 12 }]}>Activity Log</Text>
              {application.timeline.map((entry, index) => (
                <View key={index} style={erpStyles.timelineEntry}>
                  <View style={erpStyles.timelineDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={erpStyles.timelineEvent}>{entry.event}</Text>
                    <Text style={erpStyles.timelineDate}>{new Date(entry.at).toLocaleDateString()}</Text>
                    {entry.note ? <Text style={erpStyles.timelineNote}>{entry.note}</Text> : null}
                  </View>
                </View>
              ))}
            </>
          )}

          {isAdmin && onStatusUpdate && !['accepted', 'withdrawn'].includes(application.status) && (
            <View style={{ marginTop: 12 }}>
              <Pressable
                style={erpStyles.adminStatusBtn}
                onPress={() => setShowStatusPicker(v => !v)}
              >
                <Text style={erpStyles.adminStatusBtnText}>Update Status</Text>
                <ChevronDown size={14} color={theme.colors.brandPrimary} />
              </Pressable>
              {showStatusPicker && (
                <View style={erpStyles.statusPicker}>
                  {ADMIN_STATUS_OPTIONS.filter(s => s !== application.status).map(s => {
                    const cfg = STATUS_STYLES[s];
                    return (
                      <Pressable
                        key={s}
                        style={erpStyles.statusOption}
                        onPress={() => {
                          setShowStatusPicker(false);
                          onStatusUpdate(application.id, s);
                        }}
                      >
                        <View style={[erpStyles.badgeDot, { backgroundColor: cfg.dot }]} />
                        <Text style={erpStyles.statusOptionText}>{cfg.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {!['offered', 'accepted', 'withdrawn', 'rejected'].includes(application.status) && (
            <Pressable
              style={erpStyles.withdrawBtn}
              onPress={() => onWithdraw(application.id)}
            >
              <Text style={erpStyles.withdrawBtnText}>Withdraw Application</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────
export default function Placement() {
  const [tab, setTab] = useState('drives');
  const [jobFilter, setJobFilter] = useState('all');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [appFilter, setAppFilter] = useState('all');
  const [selected, setSelected] = useState<PlacementDrive | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const drivesPath = `/placement/drives${jobFilter !== 'all' ? `?jobType=${jobFilter}` : ''}`;
  const { data: drives, loading: drivesLoading, error: drivesError, refresh: refreshDrives } = useFetch<PlacementDrive[]>(drivesPath);
  const { data: applications, loading: appsLoading, error: appsError, refresh: refreshApps } = useFetch<PlacementApplication[]>('/placement/applications');
  const { data: stats, loading: statsLoading, error: statsError, refresh: refreshStats } = useFetch<PlacementStats>('/placement/stats');

  // ── Real-time socket subscriptions ───────────────────────────
  useEffect(() => {
    const unsubs = [
      subscribeRealtime<PlacementDrive>('placement:drive-created', (drive) => {
        refreshDrives();
        refreshStats();
      }),
      subscribeRealtime<PlacementApplication>('placement:application-created', (app) => {
        refreshApps();
        refreshDrives();
        refreshStats();
      }),
      subscribeRealtime<PlacementApplication>('placement:application-updated', (app) => {
        refreshApps();
        refreshDrives();
        refreshStats();
      }),
    ];
    return () => { unsubs.forEach(u => u()); };
  }, [refreshDrives, refreshApps, refreshStats]);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshDrives(), refreshApps(), refreshStats()]);
    setRefreshing(false);
  }, [refreshDrives, refreshApps, refreshStats]);

  const visibleDrives = useMemo(() => {
    let list = drives || [];
    if (eligibleOnly) list = list.filter(d => d.eligibility.eligible);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(d => d.company.toLowerCase().includes(q) || d.role.toLowerCase().includes(q));
    return list;
  }, [drives, eligibleOnly, search]);

  const visibleApplications = useMemo(() => {
    let list = applications || [];
    if (appFilter !== 'all') list = list.filter(a => a.status === appFilter);
    const q = appSearch.trim().toLowerCase();
    if (q) list = list.filter(a => a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
    return list;
  }, [applications, appFilter, appSearch]);

  const isAdmin = false;

  const withdraw = async (id: string) => {
    Alert.alert('Withdraw Application?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/placement/applications/${id}/withdraw`, { method: 'POST' });
            refreshAll();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not withdraw.');
          }
        },
      },
    ]);
  };

  const updateApplicationStatus = async (id: string, status: string) => {
    try {
      await api(`/placement/applications/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      refreshAll();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update status.');
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={erpStyles.root}>
        {/* ── Header ────────────────────────────────────────── */}
        <LinearGradient colors={['#1E1B4B', '#312E81', '#4338CA']} style={erpStyles.header}>
          <View style={erpStyles.headerTop}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ArrowLeft color="#fff" size={20} />
            </Pressable>
            <Text style={erpStyles.headerTitle}>Placement Management</Text>
            <Pressable onPress={refreshAll} hitSlop={12}>
              <RefreshCw color="rgba(255,255,255,0.7)" size={18} />
            </Pressable>
          </View>

          <View style={erpStyles.headerStats}>
            {[
              { val: stats?.open_drives ?? '—', label: 'Open Drives' },
              { val: stats?.applications ?? 0, label: 'Applications' },
              { val: stats?.offers ?? 0, label: 'Offers' },
              { val: stats?.conversion_rate ? `${stats.conversion_rate}%` : '—', label: 'Conversion' },
            ].map(s => (
              <View key={s.label} style={erpStyles.headerStatItem}>
                <Text style={erpStyles.headerStatVal}>{s.val}</Text>
                <Text style={erpStyles.headerStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── Tab Bar ──────────────────────────────────────── */}
        <View style={erpStyles.tabBar}>
          {TABS.map(t => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[erpStyles.tabItem, tab === t.key && erpStyles.tabItemActive]}
            >
              <Text style={[erpStyles.tabLabel, tab === t.key && erpStyles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Drives Tab ───────────────────────────────────── */}
        {tab === 'drives' && (
          <View style={erpStyles.tabContent}>
            <View style={erpStyles.searchBar}>
              <Search size={16} color={theme.colors.muted} />
              <TextInput
                style={erpStyles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by company or role..."
                placeholderTextColor={theme.colors.muted}
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <X size={14} color={theme.colors.muted} />
                </Pressable>
              )}
            </View>

            <View style={erpStyles.filterBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={erpStyles.filterScroll}>
                {JOB_FILTERS.map(f => (
                  <ChipBtn key={f.key} label={f.label} active={jobFilter === f.key} onPress={() => setJobFilter(f.key)} />
                ))}
                <ChipBtn label="Eligible Only" active={eligibleOnly} onPress={() => setEligibleOnly(v => !v)} />
              </ScrollView>
            </View>

            <ScrollView
              contentContainerStyle={erpStyles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
            >
              <AsyncView
                loading={drivesLoading && !drives}
                error={drivesError}
                onRetry={refreshDrives}
                empty={!drivesLoading && visibleDrives.length === 0}
                emptyTitle="No drives found"
                emptySub="Try adjusting your filters or check back later."
                emptyIcon={<Briefcase size={42} color={theme.colors.muted} />}
              >
                {visibleDrives.map(drive => (
                  <Pressable key={drive.id} onPress={() => setSelected(drive)} style={erpStyles.driveCard}>
                    <View style={erpStyles.driveCardTop}>
                      <CompanyAvatar company={drive.company} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={erpStyles.driveCompany} numberOfLines={1}>{drive.company}</Text>
                        <Text style={erpStyles.driveRole} numberOfLines={1}>{drive.role}</Text>
                      </View>
                      {drive.applied
                        ? <StatusBadge status={drive.application_status || 'applied'} size="small" />
                        : drive.eligibility.eligible
                          ? <View style={[erpStyles.miniBadge, { backgroundColor: '#F0FDF4' }]}>
                              <CheckCircle2 size={12} color="#16A34A" />
                              <Text style={[erpStyles.miniBadgeText, { color: '#15803D' }]}>Eligible</Text>
                            </View>
                           : <View style={[erpStyles.miniBadge, { backgroundColor: '#FEF2F2' }]}>
                              <XCircle size={12} color="#DC2626" />
                              <Text style={[erpStyles.miniBadgeText, { color: '#DC2626' }]}>Ineligible</Text>
                            </View>
                      }
                    </View>

                    <View style={erpStyles.driveCardMeta}>
                      <View style={erpStyles.driveMetaItem}>
                        <Award size={13} color={theme.colors.brandPrimary} />
                        <Text style={erpStyles.driveMetaValue}>{drive.package_label}</Text>
                      </View>
                      <View style={erpStyles.driveMetaItem}>
                        <MapPin size={13} color={theme.colors.muted} />
                        <Text style={erpStyles.driveMetaText}>{drive.location}</Text>
                      </View>
                      <View style={erpStyles.driveMetaItem}>
                        <Users size={13} color={theme.colors.muted} />
                        <Text style={erpStyles.driveMetaText}>{drive.application_count} applied</Text>
                      </View>
                    </View>

                    <View style={erpStyles.driveCardBottom}>
                      <View style={erpStyles.driveMetaItem}>
                        <Calendar size={13} color={drive.closing_soon ? theme.colors.error : theme.colors.muted} />
                        <Text style={[erpStyles.driveMetaText, drive.closing_soon && { color: theme.colors.error, fontWeight: '700' }]}>
                          {drive.days_left >= 0 ? `${drive.days_left} days left` : 'Closed'}
                        </Text>
                      </View>
                      {drive.required_skills.length > 0 && (
                        <Text style={erpStyles.driveSkillMatch}>{drive.eligibility.skill_readiness}% skill match</Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </AsyncView>
            </ScrollView>
          </View>
        )}

        {/* ── Applications Tab ─────────────────────────────── */}
        {tab === 'applications' && (
          <View style={erpStyles.tabContent}>
            <View style={erpStyles.searchBar}>
              <Search size={16} color={theme.colors.muted} />
              <TextInput
                style={erpStyles.searchInput}
                value={appSearch}
                onChangeText={setAppSearch}
                placeholder="Search applications..."
                placeholderTextColor={theme.colors.muted}
              />
              {appSearch.length > 0 && (
                <Pressable onPress={() => setAppSearch('')} hitSlop={8}>
                  <X size={14} color={theme.colors.muted} />
                </Pressable>
              )}
            </View>

            <View style={erpStyles.filterBar}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={erpStyles.filterScroll}>
                {APP_FILTERS.map(f => (
                  <ChipBtn key={f.key} label={f.label} active={appFilter === f.key} onPress={() => setAppFilter(f.key)} />
                ))}
              </ScrollView>
            </View>

            <ScrollView
              contentContainerStyle={erpStyles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
            >
              <AsyncView
                loading={appsLoading && !applications}
                error={appsError}
                onRetry={refreshApps}
                empty={!appsLoading && visibleApplications.length === 0}
                emptyTitle="No Applications Yet"
                emptySub="Apply to a drive to start tracking your progress here."
                emptyIcon={<Target size={42} color={theme.colors.muted} />}
              >
                {visibleApplications.map(app => (
                  <ApplicationRow
                    key={app.id}
                    application={app}
                    onWithdraw={withdraw}
                    onStatusUpdate={updateApplicationStatus}
                    isAdmin={isAdmin}
                  />
                ))}
              </AsyncView>
            </ScrollView>
          </View>
        )}

        {/* ── Analytics Tab ────────────────────────────────── */}
        {tab === 'analytics' && (
          <ScrollView
            contentContainerStyle={erpStyles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={theme.colors.brandPrimary} />}
          >
            {statsLoading && !stats ? (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Skeleton height={100} width="48%" radius={theme.radius.lg} />
                  <Skeleton height={100} width="48%" radius={theme.radius.lg} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Skeleton height={100} width="48%" radius={theme.radius.lg} />
                  <Skeleton height={100} width="48%" radius={theme.radius.lg} />
                </View>
                <Skeleton height={180} radius={theme.radius.lg} />
              </View>
            ) : statsError ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: theme.colors.error, fontSize: 14, fontWeight: '600' }}>{statsError}</Text>
                <Pressable onPress={refreshStats} style={{ marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.colors.brandPrimary, borderRadius: theme.radius.md }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Retry</Text>
                </Pressable>
              </View>
            ) : stats ? (
              <>
                <View style={erpStyles.statsGrid}>
                  <StatCard label="Total Applications" value={stats.applications} icon={<Briefcase size={20} color={theme.colors.brandPrimary} />} />
                  <StatCard label="Offers Received" value={stats.offers} color={theme.colors.success} icon={<Award size={20} color={theme.colors.success} />} />
                </View>
                <View style={erpStyles.statsGrid}>
                  <StatCard label="Conversion Rate" value={`${stats.conversion_rate}%`} color="#7C3AED" icon={<TrendingUp size={20} color="#7C3AED" />} />
                  <StatCard label="Highest Package" value={stats.highest_package ? `${stats.highest_package} LPA` : '—'} color={theme.colors.warning} icon={<BarChart3 size={20} color={theme.colors.warning} />} />
                </View>

                <View style={erpStyles.funnelCard}>
                  <Text style={erpStyles.funnelTitle}>Application Funnel</Text>
                  {stats.by_stage.filter(s => s.count > 0).length === 0 ? (
                    <Text style={{ fontSize: 13, color: theme.colors.muted, textAlign: 'center', paddingVertical: 20 }}>
                      Apply to a drive to see your funnel.
                    </Text>
                  ) : (
                    stats.by_stage.map(stage => {
                      const config = STATUS_STYLES[stage.stage] || STATUS_STYLES.applied;
                      const max = Math.max(...stats.by_stage.map(s => s.count), 1);
                      return (
                        <View key={stage.stage} style={erpStyles.funnelRow}>
                          <View style={erpStyles.funnelLabel}>
                            <View style={[erpStyles.funnelDot, { backgroundColor: config.dot }]} />
                            <Text style={erpStyles.funnelLabelText}>{config.label}</Text>
                          </View>
                          <Text style={erpStyles.funnelCount}>{stage.count}</Text>
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <ProgressBar value={stage.count} max={max} height={5} color={config.dot} />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>

                {stats.top_recruiters.length > 0 && (
                  <View style={erpStyles.recruitersCard}>
                    <Text style={erpStyles.funnelTitle}>Top Recruiters</Text>
                    {stats.top_recruiters.map((recruiter, index) => (
                      <View key={recruiter.company} style={erpStyles.recruiterRow}>
                        <Text style={erpStyles.recruiterRank}>{index + 1}</Text>
                        <View style={[erpStyles.recruiterAvatar]}>
                          <Building2 size={16} color={theme.colors.brandPrimary} />
                        </View>
                        <Text style={erpStyles.recruiterName}>{recruiter.company}</Text>
                        <View style={erpStyles.recruiterCountBadge}>
                          <Text style={erpStyles.recruiterCountText}>{recruiter.count}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : null}
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

// ─── Styles ────────────────────────────────────────────────────
const erpStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },

  // Header
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  headerStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  headerStatItem: { flex: 1, alignItems: 'center' },
  headerStatVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerStatLabel: { fontSize: 9, color: 'rgba(255,255,255,0.65)', marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandTertiary + '30' },
  tabLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  tabLabelActive: { color: theme.colors.brandPrimary, fontWeight: '800' },

  // Tab Content
  tabContent: { flex: 1 },
  listContent: { padding: theme.spacing.lg, paddingBottom: 100, gap: 10 },

  // Search & Filters
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md,
    paddingHorizontal: 12, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: theme.colors.onSurface },
  filterBar: { paddingVertical: theme.spacing.sm },
  filterScroll: { gap: 6, paddingHorizontal: theme.spacing.lg },

  // Drive Card
  driveCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
    overflow: 'hidden',
  },
  driveCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  driveCompany: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  driveRole: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  driveCardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  driveMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driveMetaValue: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  driveMetaText: { fontSize: 11, color: theme.colors.muted, fontWeight: '500' },
  driveCardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 8, marginTop: 2,
  },
  driveSkillMatch: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  // Application Card
  appCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  appCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: theme.spacing.md },
  appCardCompany: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  appCardRole: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  appCardProgressRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md,
  },
  appCardRoundText: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', minWidth: 45 },
  appCardPkg: { fontSize: 11, fontWeight: '700', color: theme.colors.brandPrimary },
  appCardExpanded: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md },
  appCardSectionTitle: { fontSize: 11, fontWeight: '800', color: theme.colors.onSurface, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 8 },

  // Stats
  statsGrid: { flexDirection: 'row', gap: 10 },
  funnelCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
    marginTop: 10,
  },
  funnelTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface, textTransform: 'uppercase', letterSpacing: 0.3 },
  funnelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  funnelLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 90 },
  funnelDot: { width: 7, height: 7, borderRadius: 4 },
  funnelLabelText: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '600' },
  funnelCount: { fontSize: 12, color: theme.colors.muted, fontWeight: '700', minWidth: 20, textAlign: 'right' },

  recruitersCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    marginTop: 10,
  },
  recruiterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recruiterRank: { fontSize: 12, fontWeight: '800', color: theme.colors.muted, minWidth: 16 },
  recruiterAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  recruiterName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  recruiterCountBadge: { backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  recruiterCountText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },

  // Badge
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 2 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDotSmall: { width: 5, height: 5, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextSmall: { fontSize: 10, fontWeight: '700' },
  miniBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: theme.radius.sm },
  miniBadgeText: { fontSize: 10, fontWeight: '700' },

  // Avatar
  avatar: { backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: theme.colors.brandPrimary },

  // Check / Eligibility
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  checkMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },

  // Skill Tags
  skillTag: { backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  skillTagGap: { backgroundColor: '#FEF3C7' },
  skillTagText: { fontSize: 11, fontWeight: '700', color: theme.colors.onBrandTertiary },

  // Round Steps
  roundStep: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  roundStepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  roundStepNumText: { fontSize: 10, fontWeight: '800', color: theme.colors.brandPrimary },
  roundStepName: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },

  // Round Row (in expanded application)
  roundRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  roundName: { fontSize: 12, color: theme.colors.onSurface, fontWeight: '500', flex: 1 },
  roundFeedback: { fontSize: 11, color: theme.colors.muted, fontStyle: 'italic', flex: 1 },

  // Timeline
  timelineEntry: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  timelineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.brandPrimary, marginTop: 5 },
  timelineEvent: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
  timelineDate: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  timelineNote: { fontSize: 11, color: theme.colors.muted, marginTop: 2, fontStyle: 'italic' },

  // Note Input
  noteInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, minHeight: 60, textAlignVertical: 'top',
    fontSize: 13, color: theme.colors.onSurface, backgroundColor: theme.colors.surfaceSecondary,
  },

  // Withdraw Button
  withdrawBtn: { marginTop: 8, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.error + '40' },
  withdrawBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.error },

  // Admin Status Update
  adminStatusBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.brandPrimary + '40',
    backgroundColor: theme.colors.brandTertiary,
  },
  adminStatusBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  statusPicker: {
    marginTop: 6, backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border,
    padding: 8, gap: 4,
  },
  statusOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 10, borderRadius: theme.radius.sm,
  },
  statusOptionText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },

  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  modalTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  modalContent: { padding: theme.spacing.lg, paddingBottom: 40, gap: 14 },
  modalCompanyRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  modalCompany: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  modalRole: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  modalMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalMetaBox: {
    flexGrow: 1, minWidth: '46%', backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: 10,
  },
  modalMetaLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  modalMetaValue: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface, marginTop: 2 },
  modalSection: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
  },
  modalSectionTitle: { fontSize: 12, fontWeight: '800', color: theme.colors.onSurface, textTransform: 'uppercase', letterSpacing: 0.3 },
  modalBodyText: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  modalAppliedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', padding: 14, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  modalAppliedText: { fontSize: 13, fontWeight: '600', color: '#15803D' },
  modalIneligibleBox: { backgroundColor: '#FEF2F2', padding: 14, borderRadius: theme.radius.md, borderWidth: 1, borderColor: '#FECACA', gap: 4 },
  modalIneligibleTitle: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  modalIneligibleReason: { fontSize: 12, color: '#991B1B', lineHeight: 18 },
});
