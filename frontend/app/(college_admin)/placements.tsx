import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Briefcase, Plus, X, Search, Filter, Eye, ChevronRight, Users, TrendingUp,
  CheckCircle, Clock, AlertTriangle, Award, ArrowUpRight, Building2, Calendar,
  Target, BarChart3, Trash2, Pencil, Send, ExternalLink,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, StatCard, SectionTitle, ProgressBar, EmptyState, ChipBtn } from '@/src/ui';

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981', open: '#10B981', upcoming: '#3B82F6', closed: '#6B7280',
  draft: '#F59E0B', cancelled: '#EF4444',
};

const JOB_TYPES = ['Full-time', 'Internship', 'Part-time', 'Contract'];

export default function PlacementsAdmin() {
  const { data: drives = [], loading: drivesLoading, refresh: refreshDrives } = useFetch<any[]>('/placement/drives');
  const { data: applications = [], refresh: refreshApps } = useFetch<any[]>('/placement/applications');
  const { data: stats, refresh: refreshStats } = useFetch<any>('/placement/stats');
  const { data: courses = [] } = useFetch<any[]>('/courses');
  const { mutate: createDrive } = useMutate();
  const { mutate: updateDrive } = useMutate();
  const { mutate: deleteDrive } = useMutate();
  const { mutate: updateAppStatus } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'drives' | 'applications' | 'analytics'>('drives');
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [editDrive, setEditDrive] = useState<any>(null);
  const [form, setForm] = useState({
    company: '', role: '', sector: '', package_lpa: '', location: '',
    job_type: 'Full-time', description: '', min_cgpa: '', min_attendance: '',
    openings: '', deadline: '', drive_date: '', required_skills: '',
    allowed_departments: '', rounds: '',
  });
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshDrives();
    refreshApps();
    refreshStats();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshDrives, refreshApps, refreshStats]);

  const filteredDrives = useMemo(() => {
    let list = drives;
    if (filter !== 'all') list = list.filter((d: any) => d.status === filter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter((d: any) =>
        d.company?.toLowerCase().includes(q) ||
        d.role?.toLowerCase().includes(q) ||
        d.sector?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [drives, filter, searchQ]);

  const filteredApps = useMemo(() => {
    let list = applications;
    if (filter !== 'all') list = list.filter((a: any) => a.status === filter);
    return list;
  }, [applications, filter]);

  const openCreate = () => {
    setEditDrive(null);
    setForm({ company: '', role: '', sector: '', package_lpa: '', location: '', job_type: 'Full-time', description: '', min_cgpa: '', min_attendance: '', openings: '', deadline: '', drive_date: '', required_skills: '', allowed_departments: '', rounds: '' });
    setFormErr('');
    setCreateModal(true);
  };

  const openEdit = (drive: any) => {
    setEditDrive(drive);
    setForm({
      company: drive.company || '', role: drive.role || '', sector: drive.sector || '',
      package_lpa: String(drive.package_lpa || ''), location: drive.location || '',
      job_type: drive.job_type || 'Full-time', description: drive.description || '',
      min_cgpa: String(drive.min_cgpa || ''), min_attendance: String(drive.min_attendance || ''),
      openings: String(drive.openings || ''), deadline: drive.deadline?.slice(0, 10) || '',
      drive_date: drive.drive_date?.slice(0, 10) || '',
      required_skills: drive.required_skills?.map((s: any) => s.name).join(', ') || '',
      allowed_departments: drive.allowed_departments?.join(', ') || '',
      rounds: drive.rounds?.join(', ') || '',
    });
    setFormErr('');
    setCreateModal(true);
  };

  const saveDrive = async () => {
    if (!form.company.trim() || !form.role.trim()) { setFormErr('Company and role are required'); return; }
    setFormErr('');
    setSaving(true);
    try {
      const body = {
        company: form.company.trim(),
        role: form.role.trim(),
        sector: form.sector || null,
        package_lpa: form.package_lpa ? parseFloat(form.package_lpa) : null,
        location: form.location || null,
        job_type: form.job_type,
        description: form.description || null,
        min_cgpa: form.min_cgpa ? parseFloat(form.min_cgpa) : null,
        min_attendance: form.min_attendance ? parseFloat(form.min_attendance) : null,
        openings: form.openings ? parseInt(form.openings) : null,
        deadline: form.deadline || null,
        drive_date: form.drive_date || null,
        required_skills: form.required_skills ? form.required_skills.split(',').map((s: string) => ({ skill_key: s.trim().toLowerCase().replace(/\s+/g, '_'), name: s.trim() })) : [],
        allowed_departments: form.allowed_departments ? form.allowed_departments.split(',').map((d: string) => d.trim()) : [],
        rounds: form.rounds ? form.rounds.split(',').map((r: string) => r.trim()) : [],
      };
      if (editDrive) {
        await updateDrive(`/placement/drives/${editDrive.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await createDrive('/placement/drives', { method: 'POST', body: JSON.stringify(body) });
      }
      setCreateModal(false);
      refreshDrives();
      refreshStats();
    } catch (e: any) { setFormErr(e.message); }
    finally { setSaving(false); }
  };

  const doDeleteDrive = async () => {
    if (!editDrive) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    try {
      await deleteDrive(`/placement/drives/${editDrive.id}`, { method: 'DELETE' });
      setCreateModal(false);
      setConfirmDel(false);
      refreshDrives();
      refreshStats();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const updateAppStatus = async (appId: string, status: string) => {
    try {
      await updateAppStatus(`/placement/applications/${appId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      refreshApps();
      refreshStats();
      setSelectedApp(null);
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const tabs = [
    { key: 'drives', label: 'Drives', icon: <Briefcase size={14} /> },
    { key: 'applications', label: 'Applications', icon: <Users size={14} /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={14} /> },
  ];

  const filters = ['all', 'active', 'upcoming', 'closed', 'draft'];

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={styles.h1}>Placements</Text>
                <Text style={styles.sub}>Manage drives, applications & recruitment</Text>
              </View>
              <Pressable onPress={openCreate} style={styles.iconBtn}>
                <Plus color={theme.colors.brand} size={20} />
              </Pressable>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statMini}>
                <Text style={styles.statMiniVal}>{stats?.open_drives || 0}</Text>
                <Text style={styles.statMiniLabel}>Open Drives</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={styles.statMiniVal}>{stats?.applications || 0}</Text>
                <Text style={styles.statMiniLabel}>Applications</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniVal, { color: '#10B981' }]}>{stats?.offers || 0}</Text>
                <Text style={styles.statMiniLabel}>Offers</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniVal, { color: '#F59E0B' }]}>{stats?.conversion_rate || 0}%</Text>
                <Text style={styles.statMiniLabel}>Conversion</Text>
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

          {/* Drives Tab */}
          {tab === 'drives' && (
            <View style={{ padding: theme.spacing.lg }}>
              <View style={styles.searchBox}>
                <Search size={16} color={theme.colors.muted} />
                <TextInput value={searchQ} onChangeText={setSearchQ} placeholder="Search drives..." placeholderTextColor={theme.colors.muted} style={styles.searchInput} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {filters.map(f => (
                  <ChipBtn key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} active={filter === f} onPress={() => setFilter(f)} />
                ))}
              </ScrollView>
              {drivesLoading ? (
                <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 20 }} />
              ) : filteredDrives.length === 0 ? (
                <EmptyState title="No drives found" sub="Create a placement drive to get started" />
              ) : (
                filteredDrives.map((d: any) => (
                  <Pressable key={d.id} onPress={() => openEdit(d)}>
                    <Card style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.driveCompany}>{d.company}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[d.status] || '#6B7280') + '15' }]}>
                              <Text style={[styles.statusBadgeTxt, { color: STATUS_COLORS[d.status] || '#6B7280' }]}>{d.status}</Text>
                            </View>
                          </View>
                          <Text style={styles.driveRole}>{d.role}</Text>
                          <View style={styles.driveMeta}>
                            <Text style={styles.driveMetaTxt}>₹{d.package_lpa} LPA</Text>
                            <Text style={styles.driveMetaTxt}>📍 {d.location || 'TBD'}</Text>
                            <Text style={styles.driveMetaTxt}>{d.job_type}</Text>
                          </View>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <Text style={styles.driveApps}>{d.application_count || 0} apps</Text>
                          {d.days_left !== undefined && (
                            <Text style={[styles.driveDays, { color: d.days_left <= 3 ? '#EF4444' : '#F59E0B' }]}>{d.days_left}d left</Text>
                          )}
                        </View>
                      </View>
                      {d.required_skills?.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                          {d.required_skills.slice(0, 4).map((s: any) => (
                            <View key={s.skill_key} style={styles.skillTag}>
                              <Text style={styles.skillTagTxt}>{s.name}</Text>
                            </View>
                          ))}
                          {d.required_skills.length > 4 && <Text style={styles.moreTag}>+{d.required_skills.length - 4}</Text>}
                        </View>
                      )}
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* Applications Tab */}
          {tab === 'applications' && (
            <View style={{ padding: theme.spacing.lg }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
                {['all', 'applied', 'shortlisted', 'in_process', 'offered', 'rejected'].map(f => (
                  <ChipBtn key={f} label={f.replace(/_/g, ' ')} active={filter === f} onPress={() => setFilter(f)} />
                ))}
              </ScrollView>
              {filteredApps.length === 0 ? (
                <EmptyState title="No applications" sub="Applications will appear here" />
              ) : (
                filteredApps.map((a: any) => (
                  <Pressable key={a.id} onPress={() => setSelectedApp(a)}>
                    <Card style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.appName}>{a.student_name || a.student_id}</Text>
                          <Text style={styles.appMeta}>{a.company} · {a.role}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[a.status] || '#6B7280') + '15' }]}>
                          <Text style={[styles.statusBadgeTxt, { color: STATUS_COLORS[a.status] || '#6B7280' }]}>{a.status?.replace(/_/g, ' ')}</Text>
                        </View>
                      </View>
                      <Text style={styles.appDate}>Applied: {new Date(a.applied_at).toLocaleDateString()}</Text>
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* Analytics Tab */}
          {tab === 'analytics' && (
            <View style={{ padding: theme.spacing.lg }}>
              <SectionTitle title="Placement Funnel" />
              {stats?.by_stage?.map((s: any) => (
                <View key={s.stage} style={styles.funnelRow}>
                  <Text style={styles.funnelStage}>{s.stage.replace(/_/g, ' ')}</Text>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <ProgressBar value={s.count} max={Math.max(...(stats.by_stage || []).map((x: any) => x.count), 1)} height={8} />
                  </View>
                  <Text style={styles.funnelCount}>{s.count}</Text>
                </View>
              ))}

              <SectionTitle title="Top Recruiters" />
              {stats?.top_recruiters?.map((r: any) => (
                <Card key={r.company} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.recruiterName}>{r.company}</Text>
                    <Text style={styles.recruiterCount}>{r.count} hired</Text>
                  </View>
                </Card>
              ))}

              <SectionTitle title="Package Stats" />
              <View style={styles.statsGrid}>
                <Card style={styles.statsGridItem}>
                  <Text style={styles.statsGridVal}>₹{stats?.highest_package || 0}L</Text>
                  <Text style={styles.statsGridLabel}>Highest CTC</Text>
                </Card>
                <Card style={styles.statsGridItem}>
                  <Text style={styles.statsGridVal}>₹{stats?.average_package || 0}L</Text>
                  <Text style={styles.statsGridLabel}>Average CTC</Text>
                </Card>
              </View>
            </View>
          )}
        </ScrollView>

        {/* FAB */}
        {tab === 'drives' && (
          <Pressable onPress={openCreate} style={styles.fab}>
            <Plus color="#fff" size={26} />
          </Pressable>
        )}

        {/* Create/Edit Drive Modal */}
        <Modal visible={createModal} transparent animationType="slide" onRequestClose={() => setCreateModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{editDrive ? 'Edit Drive' : 'Create Drive'}</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {editDrive && (
                    <Pressable onPress={doDeleteDrive}>
                      <Trash2 color={confirmDel ? '#EF4444' : theme.colors.muted} size={20} />
                    </Pressable>
                  )}
                  <Pressable onPress={() => setCreateModal(false)}><X color={theme.colors.muted} size={22} /></Pressable>
                </View>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {[
                  ['Company *', 'company', 'e.g. Google'],
                  ['Role *', 'role', 'e.g. SDE-2'],
                  ['Sector', 'sector', 'e.g. Tech, Finance'],
                  ['Package (LPA)', 'package_lpa', 'e.g. 15'],
                  ['Location', 'location', 'e.g. Bangalore'],
                  ['Openings', 'openings', 'e.g. 10'],
                  ['Min CGPA', 'min_cgpa', 'e.g. 7.5'],
                  ['Min Attendance %', 'min_attendance', 'e.g. 75'],
                  ['Deadline (YYYY-MM-DD)', 'deadline', '2026-09-15'],
                  ['Drive Date (YYYY-MM-DD)', 'drive_date', '2026-09-20'],
                  ['Required Skills (comma)', 'required_skills', 'React, Node.js, Python'],
                  ['Departments (comma)', 'allowed_departments', 'CS, IT, ECE'],
                  ['Rounds (comma)', 'rounds', 'Online Test, Interview, HR'],
                ].map(([label, key, placeholder]) => (
                  <View key={key}>
                    <Text style={styles.label}>{label}</Text>
                    <TextInput
                      value={(form as any)[key]}
                      onChangeText={(v) => setForm(p => ({ ...p, [key]: v }))}
                      placeholder={placeholder}
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                ))}
                <Text style={styles.label}>Job Type</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {JOB_TYPES.map(jt => (
                    <Pressable key={jt} onPress={() => setForm(p => ({ ...p, job_type: jt }))} style={[styles.chip, form.job_type === jt && styles.chipActive]}>
                      <Text style={[styles.chipTxt, form.job_type === jt && styles.chipTxtActive]}>{jt}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Description</Text>
                <TextInput value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="Job description..." placeholderTextColor={theme.colors.muted} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline />
                {formErr ? <Text style={styles.err}>{formErr}</Text> : null}
                <Pressable onPress={saveDrive} disabled={saving} style={styles.cta}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{editDrive ? 'Save Changes' : 'Create Drive'}</Text>}
                </Pressable>
                <View style={{ height: 30 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Application Detail Modal */}
        <Modal visible={!!selectedApp} transparent animationType="slide" onRequestClose={() => setSelectedApp(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              {selectedApp && (
                <ScrollView>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>Application Detail</Text>
                    <Pressable onPress={() => setSelectedApp(null)}><X color={theme.colors.muted} size={22} /></Pressable>
                  </View>
                  <Text style={styles.appDetailName}>{selectedApp.student_name || selectedApp.student_id}</Text>
                  <Text style={styles.appDetailMeta}>{selectedApp.company} · {selectedApp.role}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selectedApp.status] || '#6B7280') + '15', alignSelf: 'flex-start', marginTop: 12 }]}>
                    <Text style={[styles.statusBadgeTxt, { color: STATUS_COLORS[selectedApp.status] || '#6B7280' }]}>{selectedApp.status?.replace(/_/g, ' ')}</Text>
                  </View>

                  {selectedApp.rounds?.length > 0 && (
                    <>
                      <Text style={[styles.label, { marginTop: 16 }]}>Rounds</Text>
                      {selectedApp.rounds.map((r: any, i: number) => (
                        <View key={i} style={styles.roundRow}>
                          <View style={[styles.roundDot, { backgroundColor: r.status === 'completed' ? '#10B981' : r.status === 'current' ? '#3B82F6' : '#D1D5DB' }]} />
                          <Text style={styles.roundName}>{r.name}</Text>
                          <Text style={[styles.roundStatus, { color: r.status === 'completed' ? '#10B981' : r.status === 'current' ? '#3B82F6' : '#9CA3AF' }]}>{r.status}</Text>
                        </View>
                      ))}
                    </>
                  )}

                  <Text style={[styles.label, { marginTop: 16 }]}>Actions</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {['shortlisted', 'in_process', 'offered', 'rejected'].map(s => (
                      <Pressable key={s} onPress={() => updateAppStatus(selectedApp.id, s)} style={[styles.actionChip, { borderColor: STATUS_COLORS[s] || '#6B7280' }]}>
                        <Text style={[styles.actionChipTxt, { color: STATUS_COLORS[s] || '#6B7280' }]}>{s.replace(/_/g, ' ')}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ height: 30 }} />
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  statMini: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  statMiniVal: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  statMiniLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
  tabBar: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabTxtActive: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface },
  driveCompany: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface },
  driveRole: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  driveMeta: { flexDirection: 'row', gap: 10, marginTop: 6 },
  driveMetaTxt: { fontSize: 11, color: theme.colors.muted },
  driveApps: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  driveDays: { fontSize: 11, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  statusBadgeTxt: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  skillTag: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  skillTagTxt: { fontSize: 10, fontWeight: '600', color: theme.colors.brand },
  moreTag: { fontSize: 10, color: theme.colors.muted, alignSelf: 'center' },
  appName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  appMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  appDate: { fontSize: 11, color: theme.colors.muted, marginTop: 6 },
  funnelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  funnelStage: { width: 100, fontSize: 11, fontWeight: '600', color: theme.colors.onSurface, textTransform: 'capitalize' },
  funnelCount: { width: 30, fontSize: 13, fontWeight: '800', color: theme.colors.onSurface, textAlign: 'right' },
  recruiterName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  recruiterCount: { fontSize: 12, fontWeight: '600', color: theme.colors.brandPrimary },
  statsGrid: { flexDirection: 'row', gap: 12 },
  statsGridItem: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.md },
  statsGridVal: { fontSize: 22, fontWeight: '800', color: theme.colors.brandPrimary },
  statsGridLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '88%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, fontSize: 14, color: theme.colors.onSurface },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brandPrimary },
  chipTxt: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  chipTxtActive: { color: theme.colors.brand },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  appDetailName: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  appDetailMeta: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
  roundRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  roundDot: { width: 10, height: 10, borderRadius: 5 },
  roundName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.onSurface },
  roundStatus: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  actionChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1.5 },
  actionChipTxt: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
});
