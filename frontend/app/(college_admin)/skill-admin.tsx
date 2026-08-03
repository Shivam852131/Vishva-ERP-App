import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Zap, Plus, X, Search, Award, BookOpen, ChevronRight,
  CheckCircle, Shield, Briefcase, Trash2, Pencil, Users,
} from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Card, SectionTitle, ProgressBar, ProgressRing, EmptyState, ChipBtn } from '@/src/ui';

const LEVEL_COLORS: Record<string, string> = {
  beginner: '#6B7280', intermediate: '#3B82F6', advanced: '#8B5CF6', expert: '#10B981',
};

export default function SkillAdmin() {
  const { data: catalog = [], loading: catLoading, refresh: refreshCatalog } = useFetch<any[]>('/skills/catalog');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const { data: profile, refresh: refreshProfile } = useFetch<any>(selectedStudentId ? `/skills/profile?studentId=${selectedStudentId}` : '/skills/profile');
  const { data: careerMatches = [] } = useFetch<any[]>('/skills/career-matches');
  const { data: users = [] } = useFetch<any[]>('/admin/users?role=student');
  const { mutate: endorseSkill } = useMutate();
  const { mutate: addCert } = useMutate();
  const { mutate: addProject } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'catalog' | 'skills' | 'certifications' | 'projects' | 'endorsements'>('catalog');
  const [filter, setFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [endorseModal, setEndorseModal] = useState(false);
  const [endorseForm, setEndorseForm] = useState({ skill_key: '', student_id: '', note: '' });
  const [certModal, setCertModal] = useState(false);
  const [certForm, setCertForm] = useState({ title: '', issuer: '', credential_id: '', credential_url: '', issued_at: '', expires_at: '' });
  const [projectModal, setProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({ title: '', description: '', skills: '', repo_url: '', demo_url: '' });
  const [studentSearchQ, setStudentSearchQ] = useState('');
  const [showStudentPicker, setShowStudentPicker] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshCatalog();
    refreshProfile();
    setTimeout(() => setRefreshing(false), 1500);
  }, [refreshCatalog, refreshProfile]);

  const summary = profile?.summary || {};
  const skills = profile?.skills || [];
  const certifications = profile?.certifications || [];
  const projects = profile?.projects || [];
  const endorsements = profile?.endorsements || [];

  const filteredCatalog = useMemo(() => {
    if (!searchQ) return catalog;
    return (catalog as any[]).filter((c: any) => c.name?.toLowerCase().includes(searchQ.toLowerCase()));
  }, [catalog, searchQ]);

  const tabs = [
    { key: 'catalog', label: 'Catalog', icon: <BookOpen size={14} /> },
    { key: 'skills', label: 'Skills', icon: <Zap size={14} /> },
    { key: 'certifications', label: 'Certs', icon: <Shield size={14} /> },
    { key: 'projects', label: 'Projects', icon: <Briefcase size={14} /> },
    { key: 'endorsements', label: 'Endorse', icon: <Award size={14} /> },
  ];

  const doEndorse = async () => {
    if (!endorseForm.skill_key || !endorseForm.student_id) { Alert.alert('Error', 'Select skill and student'); return; }
    try {
      await endorseSkill('/skills/endorse', { method: 'POST', body: JSON.stringify(endorseForm) });
      setEndorseModal(false);
      setEndorseForm({ skill_key: '', student_id: '', note: '' });
      refreshProfile();
      Alert.alert('Done', 'Skill endorsed successfully');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const doAddCert = async () => {
    if (!certForm.title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    try {
      await addCert('/skills/certifications', { method: 'POST', body: JSON.stringify(certForm) });
      setCertModal(false);
      setCertForm({ title: '', issuer: '', credential_id: '', credential_url: '', issued_at: '', expires_at: '' });
      refreshProfile();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const doAddProject = async () => {
    if (!projectForm.title.trim()) { Alert.alert('Error', 'Title is required'); return; }
    try {
      await addProject('/skills/projects', { method: 'POST', body: JSON.stringify({ ...projectForm, skills: projectForm.skills.split(',').map(s => s.trim()) }) });
      setProjectModal(false);
      setProjectForm({ title: '', description: '', skills: '', repo_url: '', demo_url: '' });
      refreshProfile();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

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
                <Text style={styles.h1}>Skill Profiles</Text>
                <Text style={styles.sub}>{selectedStudentId ? `Viewing: ${users.find((u: any) => u.id === selectedStudentId)?.name || 'Student'}` : 'Manage skills, certifications & endorsements'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={() => setShowStudentPicker(!showStudentPicker)} style={styles.iconBtn}>
                  <Users color={theme.colors.brand} size={16} />
                </Pressable>
                <Pressable onPress={() => setCertModal(true)} style={styles.iconBtn}>
                  <Shield color={theme.colors.brand} size={16} />
                </Pressable>
                <Pressable onPress={() => setEndorseModal(true)} style={styles.iconBtn}>
                  <Award color={theme.colors.brand} size={16} />
                </Pressable>
              </View>
            </View>

            {showStudentPicker && (
              <Card style={{ marginTop: 12, padding: 12 }}>
                <Text style={[styles.label, { marginTop: 0 }]}>Select Student</Text>
                <View style={styles.searchBox}>
                  <Search size={16} color={theme.colors.muted} />
                  <TextInput value={studentSearchQ} onChangeText={setStudentSearchQ} placeholder="Search students..." placeholderTextColor={theme.colors.muted} style={styles.searchInput} />
                </View>
                {selectedStudentId && (
                  <Pressable onPress={() => { setSelectedStudentId(''); setStudentSearchQ(''); }} style={[styles.chip, styles.chipActive, { alignSelf: 'flex-start', marginBottom: 8 }]}>
                    <Text style={[styles.chipTxt, styles.chipTxtActive]}>✕ Clear selection</Text>
                  </Pressable>
                )}
                <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                  {(users as any[]).filter((u: any) => !studentSearchQ || u.name?.toLowerCase().includes(studentSearchQ.toLowerCase())).slice(0, 20).map((u: any) => (
                    <Pressable key={u.id} onPress={() => { setSelectedStudentId(u.id); setShowStudentPicker(false); setStudentSearchQ(''); }} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                      <Text style={{ fontSize: 13, fontWeight: selectedStudentId === u.id ? '700' : '500', color: selectedStudentId === u.id ? theme.colors.brand : theme.colors.onSurface }}>{u.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Card>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statMini}>
                <Text style={styles.statMiniVal}>{summary.total_skills || 0}</Text>
                <Text style={styles.statMiniLabel}>Skills</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniVal, { color: '#10B981' }]}>{summary.verified_skills || 0}</Text>
                <Text style={styles.statMiniLabel}>Verified</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniVal, { color: '#F59E0B' }]}>{summary.average_score || 0}%</Text>
                <Text style={styles.statMiniLabel}>Avg Score</Text>
              </View>
              <View style={styles.statMini}>
                <Text style={[styles.statMiniVal, { color: '#8B5CF6' }]}>{summary.endorsements || 0}</Text>
                <Text style={styles.statMiniLabel}>Endorsed</Text>
              </View>
            </View>

            <View style={styles.tabBar}>
              {tabs.map(t => (
                <Pressable key={t.key} onPress={() => setTab(t.key as any)} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
                  {t.icon}
                  <Text style={[styles.tabTxt, tab === t.key && styles.tabTxtActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Catalog Tab */}
          {tab === 'catalog' && (
            <View style={{ padding: theme.spacing.lg }}>
              <View style={styles.searchBox}>
                <Search size={16} color={theme.colors.muted} />
                <TextInput value={searchQ} onChangeText={setSearchQ} placeholder="Search skills..." placeholderTextColor={theme.colors.muted} style={styles.searchInput} />
              </View>
              {catLoading ? (
                <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 20 }} />
              ) : filteredCatalog.length === 0 ? (
                <EmptyState title="No skills found" sub="Skills catalog is empty" />
              ) : (
                (filteredCatalog as any[]).map((c: any) => (
                  <Pressable key={c.skill_key} onPress={() => setSelected(c)}>
                    <Card style={{ marginBottom: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.skillName}>{c.name}</Text>
                          <Text style={styles.skillCat}>{c.category}</Text>
                        </View>
                        <ChevronRight color={theme.colors.muted} size={16} />
                      </View>
                    </Card>
                  </Pressable>
                ))
              )}
            </View>
          )}

          {/* Skills Tab */}
          {tab === 'skills' && (
            <View style={{ padding: theme.spacing.lg }}>
              <SectionTitle title="Skill Entries" />
              {skills.length === 0 ? (
                <EmptyState title="No skills added" sub="Students add skills to their profiles" />
              ) : (
                skills.map((s: any) => (
                  <Card key={s.skill_key} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.skillName}>{s.name}</Text>
                        <Text style={styles.skillCat}>{s.category}</Text>
                      </View>
                      <View style={[styles.levelBadge, { backgroundColor: (LEVEL_COLORS[s.level] || '#6B7280') + '15' }]}>
                        <Text style={[styles.levelBadgeTxt, { color: LEVEL_COLORS[s.level] || '#6B7280' }]}>{s.level}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                      <View style={styles.skillMetric}>
                        <Text style={styles.skillMetricVal}>{s.score}%</Text>
                        <Text style={styles.skillMetricLabel}>Score</Text>
                      </View>
                      <View style={styles.skillMetric}>
                        <Text style={styles.skillMetricVal}>{s.self_rating || '—'}/10</Text>
                        <Text style={styles.skillMetricLabel}>Self</Text>
                      </View>
                      <View style={styles.skillMetric}>
                        <Text style={styles.skillMetricVal}>{s.assessment_count || 0}</Text>
                        <Text style={styles.skillMetricLabel}>Tests</Text>
                      </View>
                      <View style={styles.skillMetric}>
                        <Text style={styles.skillMetricVal}>{s.endorsement_count || 0}</Text>
                        <Text style={styles.skillMetricLabel}>Endorse</Text>
                      </View>
                    </View>
                    <ProgressBar value={s.score} max={100} height={4} color={LEVEL_COLORS[s.level] || '#6B7280'} style={{ marginTop: 8 }} />
                  </Card>
                ))
              )}

              <SectionTitle title="Career Matches" />
              {careerMatches.length === 0 ? (
                <EmptyState title="No career matches" sub="Complete skill profiles to see matches" />
              ) : (
                (careerMatches as any[]).slice(0, 5).map((m: any) => (
                  <Card key={m.key} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.matchTitle}>{m.title}</Text>
                        <Text style={styles.matchCat} numberOfLines={1}>{m.category} · {m.salary_range}</Text>
                      </View>
                      <View style={styles.matchBadge}>
                        <Text style={styles.matchBadgeTxt}>{m.match}%</Text>
                      </View>
                    </View>
                    <ProgressBar value={m.match} max={100} height={4} color="#10B981" style={{ marginTop: 8 }} />
                  </Card>
                ))
              )}
            </View>
          )}

          {/* Certifications Tab */}
          {tab === 'certifications' && (
            <View style={{ padding: theme.spacing.lg }}>
              <Pressable onPress={() => setCertModal(true)} style={styles.addBtn}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addBtnTxt}>Add Certification</Text>
              </Pressable>
              {certifications.length === 0 ? (
                <EmptyState title="No certifications" sub="Add certifications to showcase achievements" />
              ) : (
                certifications.map((c: any) => (
                  <Card key={c.id} style={{ marginBottom: 8 }}>
                    <Text style={styles.certTitle}>{c.title}</Text>
                    <Text style={styles.certMeta}>{c.issuer} · {new Date(c.issued_at).toLocaleDateString()}</Text>
                    {c.credential_id && <Text style={styles.certId}>ID: {c.credential_id}</Text>}
                  </Card>
                ))
              )}
            </View>
          )}

          {/* Projects Tab */}
          {tab === 'projects' && (
            <View style={{ padding: theme.spacing.lg }}>
              <Pressable onPress={() => setProjectModal(true)} style={styles.addBtn}>
                <Plus size={16} color="#fff" />
                <Text style={styles.addBtnTxt}>Add Project</Text>
              </Pressable>
              {projects.length === 0 ? (
                <EmptyState title="No projects" sub="Add projects to build your portfolio" />
              ) : (
                projects.map((p: any) => (
                  <Card key={p.id} style={{ marginBottom: 8 }}>
                    <Text style={styles.projectTitle}>{p.title}</Text>
                    <Text style={styles.projectDesc} numberOfLines={2}>{p.description}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {p.skills?.map((s: string) => (
                        <View key={s} style={styles.skillTag}>
                          <Text style={styles.skillTagTxt}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                ))
              )}
            </View>
          )}

          {/* Endorsements Tab */}
          {tab === 'endorsements' && (
            <View style={{ padding: theme.spacing.lg }}>
              <Pressable onPress={() => setEndorseModal(true)} style={styles.addBtn}>
                <Award size={16} color="#fff" />
                <Text style={styles.addBtnTxt}>Endorse Skill</Text>
              </Pressable>
              {endorsements.length === 0 ? (
                <EmptyState title="No endorsements" sub="Faculty endorsements appear here" />
              ) : (
                endorsements.map((e: any) => (
                  <Card key={e.id} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={styles.endorseName}>{e.endorser_name}</Text>
                        <Text style={styles.endorseMeta}>{e.endorser_role} · {new Date(e.created_at).toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.skillTag}>
                        <Text style={styles.skillTagTxt}>{e.skill_key}</Text>
                      </View>
                    </View>
                    {e.note && <Text style={styles.endorseNote}>{e.note}</Text>}
                  </Card>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* Endorse Modal */}
        <Modal visible={endorseModal} transparent animationType="slide" onRequestClose={() => setEndorseModal(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Endorse Skill</Text>
                <Pressable onPress={() => setEndorseModal(false)}><X color={theme.colors.muted} size={22} /></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Skill</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                {(catalog as any[]).slice(0, 15).map((s: any) => (
                  <Pressable key={s.skill_key} onPress={() => setEndorseForm(p => ({ ...p, skill_key: s.skill_key }))} style={[styles.chip, endorseForm.skill_key === s.skill_key && styles.chipActive]}>
                    <Text style={[styles.chipTxt, endorseForm.skill_key === s.skill_key && styles.chipTxtActive]}>{s.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>Student</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 8 }}>
                {(users as any[]).slice(0, 10).map((u: any) => (
                  <Pressable key={u.id} onPress={() => setEndorseForm(p => ({ ...p, student_id: u.id }))} style={[styles.chip, endorseForm.student_id === u.id && styles.chipActive]}>
                    <Text style={[styles.chipTxt, endorseForm.student_id === u.id && styles.chipTxtActive]}>{u.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.label}>Note</Text>
              <TextInput value={endorseForm.note} onChangeText={v => setEndorseForm(p => ({ ...p, note: v }))} placeholder="Why you endorse this skill..." placeholderTextColor={theme.colors.muted} style={styles.input} />
              <Pressable onPress={doEndorse} style={styles.cta}>
                <Text style={styles.ctaTxt}>Endorse</Text>
              </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Cert Modal */}
        <Modal visible={certModal} transparent animationType="slide" onRequestClose={() => setCertModal(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Add Certification</Text>
                <Pressable onPress={() => setCertModal(false)}><X color={theme.colors.muted} size={22} /></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
              {[
                ['Title *', 'title', 'e.g. AWS Solutions Architect'],
                ['Issuer', 'issuer', 'e.g. Amazon'],
                ['Credential ID', 'credential_id', 'Optional'],
                ['Credential URL', 'credential_url', 'https://...'],
                ['Issued Date (YYYY-MM-DD)', 'issued_at', '2026-01-15'],
                ['Expiry Date (YYYY-MM-DD)', 'expires_at', '2029-01-15'],
              ].map(([label, key, placeholder]) => (
                <View key={key}>
                  <Text style={styles.label}>{label}</Text>
                  <TextInput value={(certForm as any)[key]} onChangeText={v => setCertForm(p => ({ ...p, [key]: v }))} placeholder={placeholder} placeholderTextColor={theme.colors.muted} style={styles.input} />
                </View>
              ))}
              <Pressable onPress={doAddCert} style={styles.cta}>
                <Text style={styles.ctaTxt}>Add Certification</Text>
              </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Project Modal */}
        <Modal visible={projectModal} transparent animationType="slide" onRequestClose={() => setProjectModal(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Add Project</Text>
                <Pressable onPress={() => setProjectModal(false)}><X color={theme.colors.muted} size={22} /></Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Title *</Text>
              <TextInput value={projectForm.title} onChangeText={v => setProjectForm(p => ({ ...p, title: v }))} placeholder="Project name" placeholderTextColor={theme.colors.muted} style={styles.input} />
              <Text style={styles.label}>Description</Text>
              <TextInput value={projectForm.description} onChangeText={v => setProjectForm(p => ({ ...p, description: v }))} placeholder="What does it do?" placeholderTextColor={theme.colors.muted} style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline />
              <Text style={styles.label}>Skills (comma separated)</Text>
              <TextInput value={projectForm.skills} onChangeText={v => setProjectForm(p => ({ ...p, skills: v }))} placeholder="React, Node.js, MongoDB" placeholderTextColor={theme.colors.muted} style={styles.input} />
              <Text style={styles.label}>Repo URL</Text>
              <TextInput value={projectForm.repo_url} onChangeText={v => setProjectForm(p => ({ ...p, repo_url: v }))} placeholder="https://github.com/..." placeholderTextColor={theme.colors.muted} style={styles.input} />
              <Text style={styles.label}>Demo URL</Text>
              <TextInput value={projectForm.demo_url} onChangeText={v => setProjectForm(p => ({ ...p, demo_url: v }))} placeholder="https://..." placeholderTextColor={theme.colors.muted} style={styles.input} />
              <Pressable onPress={doAddProject} style={styles.cta}>
                <Text style={styles.ctaTxt}>Add Project</Text>
              </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Skill Detail Modal */}
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              {selected && (
                <ScrollView>
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{selected.name}</Text>
                    <Pressable onPress={() => setSelected(null)}><X color={theme.colors.muted} size={22} /></Pressable>
                  </View>
                  <Text style={styles.skillCat}>{selected.category}</Text>
                  <View style={[styles.levelBadge, { backgroundColor: (LEVEL_COLORS[selected.level] || '#6B7280') + '15', alignSelf: 'flex-start', marginTop: 8 }]}>
                    <Text style={[styles.levelBadgeTxt, { color: LEVEL_COLORS[selected.level] || '#6B7280' }]}>{selected.level}</Text>
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
  tabBar: { flexDirection: 'row', gap: 6, marginTop: theme.spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabTxt: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  tabTxtActive: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, height: 40, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface },
  skillName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  skillCat: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  levelBadgeTxt: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  skillMetric: { alignItems: 'center' },
  skillMetricVal: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  skillMetricLabel: { fontSize: 9, color: theme.colors.muted, marginTop: 2 },
  matchTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  matchCat: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  matchBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  matchBadgeTxt: { fontSize: 14, fontWeight: '800', color: '#10B981' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingVertical: 12, borderRadius: 10, marginBottom: 12 },
  addBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  certTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  certMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  certId: { fontSize: 11, color: theme.colors.brandPrimary, marginTop: 4 },
  projectTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  projectDesc: { fontSize: 12, color: theme.colors.muted, marginTop: 4, lineHeight: 18 },
  skillTag: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  skillTagTxt: { fontSize: 10, fontWeight: '600', color: theme.colors.brand },
  endorseName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  endorseMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  endorseNote: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginTop: 8, fontStyle: 'italic' },
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
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
