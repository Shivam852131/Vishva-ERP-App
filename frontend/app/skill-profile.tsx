import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Award, BadgeCheck, Plus, X, Trash2, Sparkles,
  FolderGit2, ThumbsUp, TrendingUp, ExternalLink,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { SkillProfile, SkillCatalogItem, SkillEntry } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, Button, Input, ProgressBar, EmptyState, StatCard } from '@/src/ui';

const TABS = [
  { key: 'skills', label: 'Skills' },
  { key: 'projects', label: 'Projects' },
  { key: 'credentials', label: 'Credentials' },
];

const LEVEL_COLORS: Record<string, string> = {
  novice: '#94A3B8',
  beginner: '#F59E0B',
  intermediate: '#3B82F6',
  advanced: '#10B981',
  expert: '#7C3AED',
};

const CATEGORY_LABELS: Record<string, string> = {
  programming: 'Programming',
  data: 'Data',
  design: 'Design',
  business: 'Business',
  communication: 'Communication',
  core_engineering: 'Core Engineering',
};

const RATING_STEPS = [
  { value: 20, label: 'Aware' },
  { value: 40, label: 'Practising' },
  { value: 60, label: 'Confident' },
  { value: 80, label: 'Strong' },
  { value: 95, label: 'Expert' },
];

// ─── Add / rate a skill ──────────────────────────────────────────
function AddSkillModal({ visible, existing, onClose, onSaved }: {
  visible: boolean;
  existing: SkillEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: catalog } = useFetch<SkillCatalogItem[]>(visible ? '/skills/catalog' : null);
  const [selected, setSelected] = useState<SkillCatalogItem | null>(null);
  const [rating, setRating] = useState(60);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState('all');

  const owned = new Set(existing.map(s => s.skill_key));
  const categories = useMemo(() => {
    const keys = Array.from(new Set((catalog || []).map(c => c.category)));
    return ['all', ...keys];
  }, [catalog]);

  const options = useMemo(() => {
    const list = (catalog || []).filter(c => !owned.has(c.skill_key));
    return category === 'all' ? list : list.filter(c => c.category === category);
  }, [catalog, category, existing]);

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/skills/profile/${selected.skill_key}`, {
        method: 'PUT',
        body: JSON.stringify({ selfRating: rating }),
      });
      setSelected(null);
      setRating(60);
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.modalTitle}>Add a skill</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {categories.map(c => (
              <ChipBtn
                key={c}
                label={c === 'all' ? 'All' : CATEGORY_LABELS[c] || c}
                active={category === c}
                onPress={() => setCategory(c)}
              />
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }} style={{ maxHeight: 220 }}>
            {options.length === 0 ? (
              <Text style={styles.bodyText}>You have already added every skill in this category.</Text>
            ) : (
              options.map(option => (
                <Pressable
                  key={option.skill_key}
                  onPress={() => setSelected(option)}
                  style={[styles.pickRow, selected?.skill_key === option.skill_key && styles.pickRowActive]}
                >
                  <Text style={[styles.pickText, selected?.skill_key === option.skill_key && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                    {option.name}
                  </Text>
                  <Text style={styles.pickCategory}>{CATEGORY_LABELS[option.category] || option.category}</Text>
                </Pressable>
              ))
            )}
          </ScrollView>

          {selected && (
            <View style={{ gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
              <Text style={styles.inputLabel}>How would you rate yourself in {selected.name}?</Text>
              <View style={styles.ratingRow}>
                {RATING_STEPS.map(step => (
                  <Pressable
                    key={step.value}
                    onPress={() => setRating(step.value)}
                    style={[styles.ratingChip, rating === step.value && styles.ratingChipOn]}
                  >
                    <Text style={[styles.ratingChipText, rating === step.value && { color: '#fff' }]}>{step.label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hintText}>
                Self-ratings count for only 20% of your score. Take an assessment to verify this skill.
              </Text>
              <Button label={`Add ${selected.name}`} loading={busy} onPress={save} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Add project ─────────────────────────────────────────────────
function ProjectModal({ visible, onClose, onSaved }: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Add a title', 'What is the project called?');
      return;
    }
    setBusy(true);
    try {
      await api('/skills/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          repoUrl: repoUrl.trim() || null,
        }),
      });
      setTitle('');
      setDescription('');
      setRepoUrl('');
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.modalTitle}>Add a project</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Campus ride-share app" />
            <Input
              label="What did you build?"
              value={description}
              onChangeText={setDescription}
              placeholder="Problem, your role, and the outcome"
              multiline
              style={{ height: 100, textAlignVertical: 'top' }}
            />
            <Input label="Repository link (optional)" value={repoUrl} onChangeText={setRepoUrl} placeholder="https://github.com/..." autoCapitalize="none" />
            <Button label="Save project" loading={busy} onPress={save} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add certification ───────────────────────────────────────────
function CertificationModal({ visible, onClose, onSaved }: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [credentialUrl, setCredentialUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim() || !issuer.trim()) {
      Alert.alert('Missing details', 'Add both the certificate name and the issuer.');
      return;
    }
    setBusy(true);
    try {
      await api('/skills/certifications', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          issuer: issuer.trim(),
          credentialUrl: credentialUrl.trim() || null,
        }),
      });
      setTitle('');
      setIssuer('');
      setCredentialUrl('');
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.modalTitle}>Add a certification</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close">
              <X size={22} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }}>
            <Input label="Certificate" value={title} onChangeText={setTitle} placeholder="e.g. AWS Cloud Practitioner" />
            <Input label="Issued by" value={issuer} onChangeText={setIssuer} placeholder="e.g. Amazon Web Services" />
            <Input label="Credential link (optional)" value={credentialUrl} onChangeText={setCredentialUrl} placeholder="https://..." autoCapitalize="none" />
            <Button label="Save certification" loading={busy} onPress={save} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────
export default function SkillProfileScreen() {
  const [tab, setTab] = useState('skills');
  const [showSkill, setShowSkill] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [showCert, setShowCert] = useState(false);

  const { data, loading, error, refresh } = useFetch<SkillProfile>('/skills/profile');

  const grouped = useMemo(() => {
    const map = new Map<string, SkillEntry[]>();
    for (const skill of data?.skills || []) {
      const list = map.get(skill.category) || [];
      list.push(skill);
      map.set(skill.category, list);
    }
    return Array.from(map.entries());
  }, [data?.skills]);

  const removeSkill = (skill: SkillEntry) => {
    Alert.alert('Remove skill?', `${skill.name} will be removed from your profile.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/skills/profile/${skill.skill_key}`, { method: 'DELETE' });
            refresh();
          } catch (e: any) {
            Alert.alert('Could not remove', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const removeItem = (kind: 'projects' | 'certifications', id: string, label: string) => {
    Alert.alert(`Remove ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/skills/${kind}/${id}`, { method: 'DELETE' });
            refresh();
          } catch (e: any) {
            Alert.alert('Could not remove', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const summary = data?.summary;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <LinearGradient colors={['#059669', '#0891B2']} style={styles.hero}>
          <View style={styles.heroRow}>
            <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
              <ArrowLeft color="#fff" size={22} />
            </Pressable>
            <Text style={styles.heroTitle}>Skill Profile</Text>
            <View style={{ width: 22 }} />
          </View>

          <View style={styles.heroScore}>
            <Text style={styles.heroScoreValue}>{summary?.average_score ?? 0}%</Text>
            <Text style={styles.heroScoreLabel}>Average proficiency</Text>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{summary?.total_skills ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Skills</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{summary?.verified_skills ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Verified</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{summary?.projects ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Projects</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{summary?.endorsements ?? 0}</Text>
              <Text style={styles.heroStatLabel}>Endorsed</Text>
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

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 14 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
        >
          <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
            {tab === 'skills' && (
              <>
                <Button label="Add a skill" icon={<Plus size={16} color="#fff" />} onPress={() => setShowSkill(true)} />

                {(data?.skills || []).length === 0 ? (
                  <EmptyState
                    title="No skills yet"
                    sub="Add the skills you are building, then verify them with an assessment."
                    icon={<Sparkles size={48} color={theme.colors.muted} />}
                  />
                ) : (
                  grouped.map(([category, skills]) => (
                    <View key={category} style={{ gap: 10 }}>
                      <Text style={styles.groupTitle}>{CATEGORY_LABELS[category] || category}</Text>
                      {skills.map(skill => (
                        <Card key={skill.skill_key} style={{ gap: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.skillName}>{skill.name}</Text>
                                {skill.verified && <BadgeCheck size={15} color={theme.colors.success} />}
                              </View>
                              <Text style={styles.skillMeta}>
                                {skill.verified
                                  ? `Verified · best ${skill.assessment_score}% over ${skill.assessment_count} attempt${skill.assessment_count === 1 ? '' : 's'}`
                                  : 'Self-rated · take an assessment to verify'}
                                {skill.endorsement_count > 0 ? ` · ${skill.endorsement_count} endorsement${skill.endorsement_count === 1 ? '' : 's'}` : ''}
                              </Text>
                            </View>
                            <View style={[styles.levelPill, { backgroundColor: (LEVEL_COLORS[skill.level] || theme.colors.muted) + '1A' }]}>
                              <Text style={[styles.levelText, { color: LEVEL_COLORS[skill.level] || theme.colors.muted }]}>
                                {skill.level_label}
                              </Text>
                            </View>
                            <Pressable onPress={() => removeSkill(skill)} accessibilityLabel={`Remove ${skill.name}`}>
                              <Trash2 size={15} color={theme.colors.muted} />
                            </Pressable>
                          </View>
                          <ProgressBar
                            value={skill.score}
                            max={100}
                            height={7}
                            showPct
                            color={LEVEL_COLORS[skill.level] || theme.colors.brandPrimary}
                          />
                        </Card>
                      ))}
                    </View>
                  ))
                )}

                {(data?.endorsements || []).length > 0 && (
                  <View style={{ gap: 10 }}>
                    <Text style={styles.groupTitle}>Endorsements</Text>
                    {(data?.endorsements || []).map(endorsement => (
                      <Card key={endorsement.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        <ThumbsUp size={17} color={theme.colors.brandPrimary} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.skillName}>{endorsement.endorser_name}</Text>
                          <Text style={styles.skillMeta}>
                            endorsed your {endorsement.skill_key} · {endorsement.endorser_role}
                          </Text>
                          {endorsement.note ? <Text style={styles.bodyText}>{endorsement.note}</Text> : null}
                        </View>
                      </Card>
                    ))}
                  </View>
                )}
              </>
            )}

            {tab === 'projects' && (
              <>
                <Button label="Add a project" icon={<Plus size={16} color="#fff" />} onPress={() => setShowProject(true)} />
                {(data?.projects || []).length === 0 ? (
                  <EmptyState
                    title="No projects yet"
                    sub="Two shipped projects beat ten listed skills on a resume."
                    icon={<FolderGit2 size={48} color={theme.colors.muted} />}
                  />
                ) : (
                  (data?.projects || []).map(project => (
                    <Card key={project.id} style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <View style={styles.iconWrap}>
                          <FolderGit2 size={18} color={theme.colors.brandPrimary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.skillName}>{project.title}</Text>
                          {project.description ? <Text style={styles.bodyText}>{project.description}</Text> : null}
                        </View>
                        <Pressable onPress={() => removeItem('projects', project.id, 'project')} accessibilityLabel="Remove project">
                          <Trash2 size={15} color={theme.colors.muted} />
                        </Pressable>
                      </View>
                      {project.repo_url ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <ExternalLink size={12} color={theme.colors.brandPrimary} />
                          <Text style={styles.linkText} numberOfLines={1}>{project.repo_url}</Text>
                        </View>
                      ) : null}
                    </Card>
                  ))
                )}
              </>
            )}

            {tab === 'credentials' && (
              <>
                <Button label="Add a certification" icon={<Plus size={16} color="#fff" />} onPress={() => setShowCert(true)} />
                {(data?.certifications || []).length === 0 ? (
                  <EmptyState
                    title="No certifications yet"
                    sub="Pass a skill assessment to earn a verified credential automatically."
                    icon={<Award size={48} color={theme.colors.muted} />}
                  />
                ) : (
                  (data?.certifications || []).map(certification => (
                    <Card key={certification.id} style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                        <View style={[styles.iconWrap, certification.source === 'assessment' && { backgroundColor: '#DCFCE7' }]}>
                          <Award size={18} color={certification.source === 'assessment' ? theme.colors.success : theme.colors.brandPrimary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.skillName}>{certification.title}</Text>
                          <Text style={styles.skillMeta}>{certification.issuer}</Text>
                          <Text style={styles.dateText}>
                            Issued {new Date(certification.issued_at).toLocaleDateString()}
                            {certification.credential_id ? ` · ${certification.credential_id}` : ''}
                          </Text>
                        </View>
                        {certification.source === 'assessment' ? (
                          <View style={styles.verifiedPill}>
                            <Text style={styles.verifiedText}>VERIFIED</Text>
                          </View>
                        ) : (
                          <Pressable onPress={() => removeItem('certifications', certification.id, 'certification')} accessibilityLabel="Remove certification">
                            <Trash2 size={15} color={theme.colors.muted} />
                          </Pressable>
                        )}
                      </View>
                    </Card>
                  ))
                )}
              </>
            )}
          </AsyncView>
        </ScrollView>

        <AddSkillModal
          visible={showSkill}
          existing={data?.skills || []}
          onClose={() => setShowSkill(false)}
          onSaved={refresh}
        />
        <ProjectModal visible={showProject} onClose={() => setShowProject(false)} onSaved={refresh} />
        <CertificationModal visible={showCert} onClose={() => setShowCert(false)} onSaved={refresh} />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.lg, gap: theme.spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroScore: { alignItems: 'center', gap: 2 },
  heroScoreValue: { fontSize: 38, fontWeight: '900', color: '#fff' },
  heroScoreLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  heroStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: theme.radius.lg, padding: theme.spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  heroStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: '600' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.brandPrimary },
  tabLabel: { fontSize: 13, color: theme.colors.muted, fontWeight: '600' },

  groupTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  skillName: { fontSize: 14, fontWeight: '700', color: theme.colors.onSurface },
  skillMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  bodyText: { fontSize: 12, color: theme.colors.muted, lineHeight: 17, marginTop: 3 },
  dateText: { fontSize: 10, color: theme.colors.muted, marginTop: 3 },
  linkText: { flex: 1, fontSize: 11, color: theme.colors.brandPrimary, fontWeight: '600' },

  levelPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  levelText: { fontSize: 10, fontWeight: '800' },
  verifiedPill: { backgroundColor: '#DCFCE7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: theme.radius.sm },
  verifiedText: { fontSize: 8, fontWeight: '800', color: '#16A34A', letterSpacing: 0.4 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },

  sheetBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl, maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  inputLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  hintText: { fontSize: 11, color: theme.colors.muted, lineHeight: 16 },

  pickRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  pickRowActive: { borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandTertiary },
  pickText: { fontSize: 13, color: theme.colors.onSurface },
  pickCategory: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },

  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ratingChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  ratingChipOn: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  ratingChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.onSurface },
});
