import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal, Alert, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Award, BadgeCheck, Plus, X, Trash2, Sparkles,
  FolderGit2, ThumbsUp, TrendingUp, ExternalLink, ChevronRight,
  BarChart3, Target, Shield, Zap, Filter, Search,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { subscribeRealtime } from '@/src/realtime/socket';
import { api } from '@/src/api';
import type { SkillProfile, SkillCatalogItem, SkillEntry } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, AsyncView, ChipBtn, Button, Input, ProgressBar, EmptyState, StatCard } from '@/src/ui';

const TABS = [
  { key: 'skills', label: 'Skills', icon: BarChart3 },
  { key: 'projects', label: 'Projects', icon: FolderGit2 },
  { key: 'credentials', label: 'Credentials', icon: Shield },
];

const LEVEL_COLORS: Record<string, string> = {
  novice: '#94A3B8',
  beginner: '#F59E0B',
  intermediate: '#3B82F6',
  advanced: '#10B981',
  expert: '#7C3AED',
};

const LEVEL_BG: Record<string, string> = {
  novice: '#F1F5F9',
  beginner: '#FFFBEB',
  intermediate: '#EFF6FF',
  advanced: '#ECFDF5',
  expert: '#F5F3FF',
};

const CATEGORY_LABELS: Record<string, string> = {
  programming: 'Programming',
  data: 'Data',
  design: 'Design',
  business: 'Business',
  communication: 'Communication',
  core_engineering: 'Core Engineering',
};

const CATEGORY_ICONS: Record<string, string> = {
  programming: '💻',
  data: '📊',
  design: '🎨',
  business: '💼',
  communication: '🗣️',
  core_engineering: '⚙️',
};

const RATING_STEPS = [
  { value: 20, label: 'Aware' },
  { value: 40, label: 'Practising' },
  { value: 60, label: 'Confident' },
  { value: 80, label: 'Strong' },
  { value: 95, label: 'Expert' },
];

function getScoreColor(score: number): string {
  if (score >= 88) return '#7C3AED';
  if (score >= 70) return '#10B981';
  if (score >= 45) return '#3B82F6';
  if (score >= 25) return '#F59E0B';
  return '#94A3B8';
}

function getLevelIcon(level: string): string {
  switch (level) {
    case 'expert': return '🏆';
    case 'advanced': return '🎯';
    case 'intermediate': return '📈';
    case 'beginner': return '🌱';
    default: return '📋';
  }
}

// ─── Stat Grid Component ────────────────────────────────────────
function StatGrid({ summary }: { summary: any }) {
  const stats = [
    { label: 'AVG SCORE', value: `${summary?.average_score ?? 0}%`, color: '#6366F1', icon: Target },
    { label: 'SKILLS', value: summary?.total_skills ?? 0, color: '#10B981', icon: BarChart3 },
    { label: 'VERIFIED', value: summary?.verified_skills ?? 0, color: '#3B82F6', icon: Shield },
    { label: 'ENDORSED', value: summary?.endorsements ?? 0, color: '#F59E0B', icon: ThumbsUp },
  ];

  return (
    <View style={styles.statGrid}>
      {stats.map((stat, i) => (
        <View key={i} style={[styles.statCard, { borderLeftColor: stat.color }]}>
          <View style={[styles.statIconWrap, { backgroundColor: stat.color + '12' }]}>
            <stat.icon size={16} color={stat.color} />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Skill Row Component ────────────────────────────────────────
function SkillRow({ skill, onRemove }: { skill: SkillEntry; onRemove: () => void }) {
  const scoreColor = getScoreColor(skill.score);

  return (
    <View style={styles.skillRow}>
      <View style={styles.skillRowLeft}>
        <View style={[styles.skillLevelIcon, { backgroundColor: LEVEL_BG[skill.level] || '#F1F5F9' }]}>
          <Text style={{ fontSize: 14 }}>{getLevelIcon(skill.level)}</Text>
        </View>
        <View style={styles.skillInfo}>
          <View style={styles.skillNameRow}>
            <Text style={styles.skillName} numberOfLines={1}>{skill.name}</Text>
            {skill.verified && <BadgeCheck size={13} color={theme.colors.success} />}
          </View>
          <Text style={styles.skillMeta} numberOfLines={1}>
            {skill.verified
              ? `Verified · ${skill.assessment_score}%`
              : 'Self-rated'}
            {skill.endorsement_count > 0 ? ` · ${skill.endorsement_count} endorsements` : ''}
          </Text>
        </View>
      </View>
      <View style={styles.skillRowRight}>
        <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '15' }]}>
          <Text style={[styles.scoreText, { color: scoreColor }]}>{skill.score}%</Text>
        </View>
        <View style={[styles.levelPill, { backgroundColor: LEVEL_BG[skill.level] || '#F1F5F9' }]}>
          <Text style={[styles.levelText, { color: LEVEL_COLORS[skill.level] || theme.colors.muted }]}>
            {skill.level_label}
          </Text>
        </View>
        <Pressable onPress={onRemove} style={styles.removeBtn} accessibilityLabel={`Remove ${skill.name}`}>
          <Trash2 size={13} color={theme.colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

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
            <View>
              <Text style={styles.modalTitle}>Add Skill</Text>
              <Text style={styles.modalSubtitle}>Select a skill from the catalog</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={18} color={theme.colors.muted} />
            </Pressable>
          </View>

          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {categories.map(c => (
                <ChipBtn
                  key={c}
                  label={c === 'all' ? 'All Skills' : CATEGORY_LABELS[c] || c}
                  active={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.pickList} style={styles.pickListScroll}>
            {options.length === 0 ? (
              <View style={styles.emptyPick}>
                <Text style={styles.emptyPickText}>All skills in this category are already added.</Text>
              </View>
            ) : (
              options.map(option => (
                <Pressable
                  key={option.skill_key}
                  onPress={() => setSelected(option)}
                  style={[styles.pickRow, selected?.skill_key === option.skill_key && styles.pickRowActive]}
                >
                  <View style={styles.pickRowContent}>
                    <Text style={styles.pickCategoryIcon}>{CATEGORY_ICONS[option.category] || '📋'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pickText, selected?.skill_key === option.skill_key && { color: theme.colors.brandPrimary, fontWeight: '700' }]}>
                        {option.name}
                      </Text>
                      <Text style={styles.pickCategory}>{CATEGORY_LABELS[option.category] || option.category}</Text>
                    </View>
                    {selected?.skill_key === option.skill_key && (
                      <View style={styles.checkCircle}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>

          {selected && (
            <View style={styles.ratingSection}>
              <View style={styles.ratingDivider} />
              <Text style={styles.inputLabel}>Self-rating for {selected.name}</Text>
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
                Self-ratings account for 20% of your proficiency score. Take an assessment to verify.
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
            <View>
              <Text style={styles.modalTitle}>Add Project</Text>
              <Text style={styles.modalSubtitle}>Document your project work</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={18} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Input label="Project Title" value={title} onChangeText={setTitle} placeholder="e.g. Campus ride-share app" />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Problem, your role, and the outcome"
              multiline
              style={styles.textArea}
            />
            <Input label="Repository URL (optional)" value={repoUrl} onChangeText={setRepoUrl} placeholder="https://github.com/..." autoCapitalize="none" />
            <Button label="Save Project" loading={busy} onPress={save} />
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
            <View>
              <Text style={styles.modalTitle}>Add Certification</Text>
              <Text style={styles.modalSubtitle}>Add your professional credentials</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={18} color={theme.colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.formContent}>
            <Input label="Certificate Name" value={title} onChangeText={setTitle} placeholder="e.g. AWS Cloud Practitioner" />
            <Input label="Issued By" value={issuer} onChangeText={setIssuer} placeholder="e.g. Amazon Web Services" />
            <Input label="Credential URL (optional)" value={credentialUrl} onChangeText={setCredentialUrl} placeholder="https://..." autoCapitalize="none" />
            <Button label="Save Certification" loading={busy} onPress={save} />
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

  useEffect(() => {
    const unsubs = [
      subscribeRealtime('skills:updated', () => refresh()),
      subscribeRealtime('skills:removed', () => refresh()),
      subscribeRealtime('skills:endorsed', () => refresh()),
      subscribeRealtime('skills:certifications-changed', () => refresh()),
      subscribeRealtime('skills:projects-changed', () => refresh()),
      subscribeRealtime('assessment:submitted', () => refresh()),
    ];
    return () => unsubs.forEach(u => u());
  }, [refresh]);

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
  const skillCount = data?.skills?.length || 0;
  const verifiedPct = skillCount > 0 ? Math.round(((summary?.verified_skills || 0) / skillCount) * 100) : 0;

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={20} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Skill Profile</Text>
            <Text style={styles.headerSub}>Competency Management</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{skillCount}</Text>
            </View>
          </View>
        </View>

        {/* ── Stats Section ── */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          <AsyncView loading={loading && !data} error={error} onRetry={refresh} empty={false}>
            {/* Summary Stats */}
            <StatGrid summary={summary} />

            {/* Readiness Bar */}
            <View style={styles.readinessCard}>
              <View style={styles.readinessHeader}>
                <View style={styles.readinessTitleRow}>
                  <Zap size={14} color="#6366F1" />
                  <Text style={styles.readinessTitle}>Skill Readiness</Text>
                </View>
                <Text style={styles.readinessPct}>{verifiedPct}%</Text>
              </View>
              <ProgressBar value={verifiedPct} max={100} height={6} color="#6366F1" />
              <Text style={styles.readinessMeta}>
                {summary?.verified_skills || 0} of {skillCount} skills verified via assessment
              </Text>
            </View>

            {/* ── Tabs ── */}
            <View style={styles.tabBar}>
              {TABS.map(t => (
                <Pressable
                  key={t.key}
                  onPress={() => setTab(t.key)}
                  style={[styles.tab, tab === t.key && styles.tabActive]}
                >
                  <t.icon size={14} color={tab === t.key ? theme.colors.brandPrimary : theme.colors.muted} />
                  <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* ── Skills Tab ── */}
            {tab === 'skills' && (
              <View style={styles.tabContent}>
                <View style={styles.toolbar}>
                  <Text style={styles.toolbarTitle}>Skill Registry</Text>
                  <Pressable onPress={() => setShowSkill(true)} style={styles.addBtn}>
                    <Plus size={14} color="#fff" />
                    <Text style={styles.addBtnText}>Add Skill</Text>
                  </Pressable>
                </View>

                {skillCount === 0 ? (
                  <EmptyState
                    title="No skills registered"
                    sub="Start building your competency profile by adding skills from the catalog."
                    icon={<Sparkles size={40} color={theme.colors.muted} />}
                  />
                ) : (
                  grouped.map(([category, skills]) => (
                    <View key={category} style={styles.categoryGroup}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryIcon}>{CATEGORY_ICONS[category] || '📋'}</Text>
                        <Text style={styles.categoryTitle}>{CATEGORY_LABELS[category] || category}</Text>
                        <View style={styles.categoryCount}>
                          <Text style={styles.categoryCountText}>{skills.length}</Text>
                        </View>
                      </View>
                      <View style={styles.tableHeader}>
                        <Text style={[styles.tableHeaderText, { flex: 1 }]}>SKILL</Text>
                        <Text style={[styles.tableHeaderText, { width: 52, textAlign: 'center' }]}>SCORE</Text>
                        <Text style={[styles.tableHeaderText, { width: 72, textAlign: 'center' }]}>LEVEL</Text>
                        <Text style={[styles.tableHeaderText, { width: 32 }]}></Text>
                      </View>
                      {skills.map(skill => (
                        <SkillRow key={skill.skill_key} skill={skill} onRemove={() => removeSkill(skill)} />
                      ))}
                    </View>
                  ))
                )}

                {/* Endorsements */}
                {(data?.endorsements || []).length > 0 && (
                  <View style={styles.categoryGroup}>
                    <View style={styles.categoryHeader}>
                      <Text style={styles.categoryIcon}>👍</Text>
                      <Text style={styles.categoryTitle}>Endorsements</Text>
                      <View style={styles.categoryCount}>
                        <Text style={styles.categoryCountText}>{(data?.endorsements || []).length}</Text>
                      </View>
                    </View>
                    {(data?.endorsements || []).map(endorsement => (
                      <View key={endorsement.id} style={styles.endorsementRow}>
                        <View style={styles.endorsementAvatar}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary }}>
                            {endorsement.endorser_name?.charAt(0) || '?'}
                          </Text>
                        </View>
                        <View style={styles.endorsementInfo}>
                          <Text style={styles.endorsementName}>{endorsement.endorser_name}</Text>
                          <Text style={styles.endorsementMeta}>
                            endorsed {endorsement.skill_key} · {endorsement.endorser_role}
                          </Text>
                          {endorsement.note ? <Text style={styles.endorsementNote}>{endorsement.note}</Text> : null}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── Projects Tab ── */}
            {tab === 'projects' && (
              <View style={styles.tabContent}>
                <View style={styles.toolbar}>
                  <Text style={styles.toolbarTitle}>Project Portfolio</Text>
                  <Pressable onPress={() => setShowProject(true)} style={styles.addBtn}>
                    <Plus size={14} color="#fff" />
                    <Text style={styles.addBtnText}>Add Project</Text>
                  </Pressable>
                </View>

                {(data?.projects || []).length === 0 ? (
                  <EmptyState
                    title="No projects yet"
                    sub="Document your project work to showcase practical experience."
                    icon={<FolderGit2 size={40} color={theme.colors.muted} />}
                  />
                ) : (
                  (data?.projects || []).map(project => (
                    <View key={project.id} style={styles.projectCard}>
                      <View style={styles.projectHeader}>
                        <View style={styles.projectIconWrap}>
                          <FolderGit2 size={16} color="#6366F1" />
                        </View>
                        <View style={styles.projectInfo}>
                          <Text style={styles.projectTitle}>{project.title}</Text>
                          {project.description ? (
                            <Text style={styles.projectDesc} numberOfLines={2}>{project.description}</Text>
                          ) : null}
                        </View>
                        <Pressable onPress={() => removeItem('projects', project.id, 'project')} style={styles.removeBtn} accessibilityLabel="Remove project">
                          <Trash2 size={13} color={theme.colors.muted} />
                        </Pressable>
                      </View>
                      {project.repo_url ? (
                        <View style={styles.projectLink}>
                          <ExternalLink size={11} color={theme.colors.brandPrimary} />
                          <Text style={styles.projectLinkText} numberOfLines={1}>{project.repo_url}</Text>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            )}

            {/* ── Credentials Tab ── */}
            {tab === 'credentials' && (
              <View style={styles.tabContent}>
                <View style={styles.toolbar}>
                  <Text style={styles.toolbarTitle}>Credentials & Certifications</Text>
                  <Pressable onPress={() => setShowCert(true)} style={styles.addBtn}>
                    <Plus size={14} color="#fff" />
                    <Text style={styles.addBtnText}>Add Cert</Text>
                  </Pressable>
                </View>

                {(data?.certifications || []).length === 0 ? (
                  <EmptyState
                    title="No certifications yet"
                    sub="Pass a skill assessment to automatically earn verified credentials."
                    icon={<Award size={40} color={theme.colors.muted} />}
                  />
                ) : (
                  (data?.certifications || []).map(certification => (
                    <View key={certification.id} style={styles.certCard}>
                      <View style={styles.certLeft}>
                        <View style={[styles.certIconWrap, certification.source === 'assessment' && styles.certIconVerified]}>
                          <Award size={16} color={certification.source === 'assessment' ? '#fff' : '#6366F1'} />
                        </View>
                        <View style={styles.certInfo}>
                          <Text style={styles.certTitle}>{certification.title}</Text>
                          <Text style={styles.certIssuer}>{certification.issuer}</Text>
                          <Text style={styles.certDate}>
                            {new Date(certification.issued_at).toLocaleDateString()}
                            {certification.credential_id ? ` · ${certification.credential_id}` : ''}
                          </Text>
                        </View>
                      </View>
                      {certification.source === 'assessment' ? (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
                        </View>
                      ) : (
                        <Pressable onPress={() => removeItem('certifications', certification.id, 'certification')} style={styles.removeBtn} accessibilityLabel="Remove certification">
                          <Trash2 size={13} color={theme.colors.muted} />
                        </Pressable>
                      )}
                    </View>
                  ))
                )}
              </View>
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
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, marginLeft: theme.spacing.md },
  headerTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  headerSub: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  badgeCount: {
    backgroundColor: theme.colors.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // ── Scroll ──
  scrollContainer: { flex: 1 },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 100, gap: theme.spacing.md },

  // ── Stat Grid ──
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    ...theme.shadow.xs,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statContent: { flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '700', color: theme.colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },

  // ── Readiness ──
  readinessCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
    ...theme.shadow.xs,
  },
  readinessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  readinessTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readinessTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  readinessPct: { fontSize: 14, fontWeight: '800', color: '#6366F1' },
  readinessMeta: { fontSize: 11, color: theme.colors.muted },

  // ── Tabs ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    gap: 5,
  },
  tabActive: { backgroundColor: theme.colors.brandTertiary },
  tabLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabLabelActive: { color: theme.colors.brandPrimary, fontWeight: '700' },

  // ── Tab Content ──
  tabContent: { gap: theme.spacing.md },

  // ── Toolbar ──
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolbarTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface, textTransform: 'uppercase', letterSpacing: 0.3 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    ...theme.shadow.xs,
  },
  addBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // ── Category Group ──
  categoryGroup: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    ...theme.shadow.xs,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceTertiary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 8,
  },
  categoryIcon: { fontSize: 14 },
  categoryTitle: { flex: 1, fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, textTransform: 'uppercase', letterSpacing: 0.3 },
  categoryCount: {
    backgroundColor: theme.colors.brandPrimary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  categoryCountText: { fontSize: 10, fontWeight: '700', color: theme.colors.brandPrimary },

  // ── Table Header ──
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tableHeaderText: { fontSize: 9, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // ── Skill Row ──
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  skillRowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
  skillLevelIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillInfo: { flex: 1 },
  skillNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skillName: { fontSize: 13, fontWeight: '600', color: theme.colors.onSurface, flexShrink: 1 },
  skillMeta: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  skillRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scoreBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    minWidth: 42,
    alignItems: 'center',
  },
  scoreText: { fontSize: 11, fontWeight: '800' },
  levelPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
    minWidth: 64,
    alignItems: 'center',
  },
  levelText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.xs,
    backgroundColor: theme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Endorsements ──
  endorsementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: 10,
  },
  endorsementAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endorsementInfo: { flex: 1 },
  endorsementName: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  endorsementMeta: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  endorsementNote: { fontSize: 11, color: theme.colors.onSurface, marginTop: 4, lineHeight: 16 },

  // ── Projects ──
  projectCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 8,
    ...theme.shadow.xs,
  },
  projectHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  projectIconWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: { flex: 1 },
  projectTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  projectDesc: { fontSize: 11, color: theme.colors.muted, marginTop: 3, lineHeight: 16 },
  projectLink: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 42 },
  projectLinkText: { fontSize: 10, color: theme.colors.brandPrimary, fontWeight: '600', flex: 1 },

  // ── Credentials ──
  certCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadow.xs,
  },
  certLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  certIconWrap: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certIconVerified: { backgroundColor: '#10B981' },
  certInfo: { flex: 1 },
  certTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  certIssuer: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  certDate: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.xs,
  },
  verifiedBadgeText: { fontSize: 8, fontWeight: '800', color: '#16A34A', letterSpacing: 0.5 },

  // ── Modals ──
  sheetBackdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.onSurface },
  modalSubtitle: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterBar: { marginBottom: theme.spacing.sm },
  filterScroll: { gap: 6 },
  pickList: { gap: 6 },
  pickListScroll: { maxHeight: 200 },
  emptyPick: { padding: 20, alignItems: 'center' },
  emptyPickText: { fontSize: 12, color: theme.colors.muted },
  pickRow: {
    padding: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  pickRowActive: { borderColor: theme.colors.brandPrimary, backgroundColor: theme.colors.brandTertiary },
  pickRowContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickCategoryIcon: { fontSize: 16 },
  pickText: { fontSize: 12, color: theme.colors.onSurface },
  pickCategory: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  checkCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ratingSection: { marginTop: theme.spacing.sm },
  ratingDivider: { height: 1, backgroundColor: theme.colors.border, marginBottom: theme.spacing.sm },
  inputLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  ratingChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  ratingChipOn: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  ratingChipText: { fontSize: 11, fontWeight: '600', color: theme.colors.onSurface },
  hintText: { fontSize: 10, color: theme.colors.muted, lineHeight: 14, marginTop: 6, marginBottom: 8 },

  formContent: { gap: 12 },
  textArea: { height: 90, textAlignVertical: 'top' },
});
