import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, X, Calendar, GraduationCap, Pencil, CheckCircle, ChevronRight, Users,
} from 'lucide-react-native';

import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import {
  PageHeader, TabSelector, AsyncView, EmptyState, BadgePill, SearchBar, ChipBtn, Card,
} from '@/src/ui';

/**
 * College → Academic session → Programme (B.Tech/BCA/…) → Branch (CSE/…)
 * → Year → Semester → Subject. Everything is configurable: no course, branch
 * or subject list is hardcoded anywhere in this screen.
 */

interface SessionRow {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  active: boolean;
  is_current: boolean;
}

interface ProgramRow {
  id: string;
  code: string;
  name: string;
  level: string;
  duration_years: number;
  semesters_per_year: number;
  total_semesters: number;
  active: boolean;
}

interface BranchRow {
  id: string;
  program_id: string;
  name: string;
  code: string;
  active: boolean;
}

interface SectionRow {
  id: string;
  program_id: string;
  branch_id: string | null;
  year: number;
  name: string;
  active: boolean;
}

interface SubjectRow {
  id: string;
  code: string;
  name: string;
  program_id: string | null;
  branch_id: string | null;
  year: number | null;
  semester: number | null;
  subject_type: string;
  credits: number | null;
  session_ids: string[];
  active: boolean;
}

const SUBJECT_TYPES = ['theory', 'practical', 'lab', 'elective'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

export default function AcademicManagementScreen() {
  const [tab, setTab] = useState<'sessions' | 'programs' | 'subjects'>('sessions');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: sessionsRaw, loading: loadSessions, error: errSessions, refresh: refreshSessions,
  } = useFetch<SessionRow[]>('/academic/sessions');
  const {
    data: programsRaw, loading: loadPrograms, error: errPrograms, refresh: refreshPrograms,
  } = useFetch<ProgramRow[]>('/academic/programs');
  const { data: branchesRaw, loading: loadBranches, error: errBranches, refresh: refreshBranches } =
    useFetch<BranchRow[]>('/academic/branches');
  const { data: sectionsRaw, loading: loadSections, error: errSections, refresh: refreshSections } =
    useFetch<SectionRow[]>('/academic/sections');

  // Dependent subject filters (session → programme → branch → year → semester)
  const [fSession, setFSession] = useState('');
  const [fProgram, setFProgram] = useState('');
  const [fBranch, setFBranch] = useState('');
  const [fYear, setFYear] = useState('');
  const [fSem, setFSem] = useState('');
  const [q, setQ] = useState('');

  const subjectPath = useMemo(() => {
    const parts: string[] = [];
    if (fSession) parts.push(`session_id=${fSession}`);
    if (fProgram) parts.push(`program_id=${fProgram}`);
    if (fBranch) parts.push(`branch_id=${fBranch}`);
    if (fYear) parts.push(`year=${fYear}`);
    if (fSem) parts.push(`semester=${fSem}`);
    if (q.trim()) parts.push(`q=${encodeURIComponent(q.trim())}`);
    return `/academic/subjects${parts.length ? `?${parts.join('&')}` : ''}`;
  }, [fSession, fProgram, fBranch, fYear, fSem, q]);

  const {
    data: subjectsRaw, loading: loadSubjects, error: errSubjects, refresh: refreshSubjects,
  } = useFetch<SubjectRow[]>(subjectPath);

  const sessions = useMemo(() => sessionsRaw || [], [sessionsRaw]);
  const programs = useMemo(() => programsRaw || [], [programsRaw]);
  const branches = useMemo(() => branchesRaw || [], [branchesRaw]);
  const sections = useMemo(() => sectionsRaw || [], [sectionsRaw]);
  const subjects = useMemo(() => subjectsRaw || [], [subjectsRaw]);

  const loading = loadSessions || loadPrograms || loadBranches || loadSections || loadSubjects;
  const error = errSessions || errPrograms || errBranches || errSections || errSubjects;

  const reload = useCallback(() => {
    refreshSessions();
    refreshPrograms();
    refreshBranches();
    refreshSections();
    refreshSubjects();
  }, [refreshSessions, refreshPrograms, refreshBranches, refreshSections, refreshSubjects]);

  React.useEffect(() => {
    if (refreshing && !loading) setRefreshing(false);
  }, [refreshing, loading]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  const { mutate, loading: busy } = useMutate();

  /* ── selection state ─────────────────────────────────────────────── */
  const [selProgram, setSelProgram] = useState('');
  const [secYear, setSecYear] = useState('');
  const activeProgram: ProgramRow | null =
    programs.find(p => p.id === selProgram) || programs[0] || null;

  /* ── session modal ───────────────────────────────────────────────── */
  const [sModal, setSModal] = useState(false);
  const [sEdit, setSEdit] = useState<SessionRow | null>(null);
  const [sf, setSf] = useState({ name: '', start: '', end: '', is_current: false });
  const [sErr, setSErr] = useState('');

  const openSession = (row: SessionRow | null) => {
    setSEdit(row);
    setSf(row
      ? { name: row.name, start: row.start_date || '', end: row.end_date || '', is_current: row.is_current }
      : { name: '', start: '', end: '', is_current: sessions.length === 0 });
    setSErr('');
    setSModal(true);
  };

  const saveSession = async () => {
    if (!sf.name.trim()) { setSErr('Session name is required (e.g. 2025-2026)'); return; }
    if (sf.start && !DATE_RE.test(sf.start)) { setSErr('Start date must be YYYY-MM-DD'); return; }
    if (sf.end && !DATE_RE.test(sf.end)) { setSErr('End date must be YYYY-MM-DD'); return; }
    if (sf.start && sf.end && sf.start > sf.end) { setSErr('End date must be on or after start date'); return; }
    setSErr('');
    try {
      const payload = {
        name: sf.name.trim(),
        start_date: sf.start || null,
        end_date: sf.end || null,
        is_current: sf.is_current,
      };
      if (sEdit) await mutate(`/academic/sessions/${sEdit.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await mutate('/academic/sessions', { method: 'POST', body: JSON.stringify(payload) });
      setSModal(false);
      refreshSessions();
    } catch (e: any) { setSErr(e.message || 'Could not save the session'); }
  };

  const makeCurrent = async (row: SessionRow) => {
    try {
      await mutate(`/academic/sessions/${row.id}`, { method: 'PUT', body: JSON.stringify({ is_current: true }) });
      refreshSessions();
    } catch (e: any) { setSErr(e.message || 'Could not update the session'); }
  };

  /* ── programme modal ─────────────────────────────────────────────── */
  const [pModal, setPModal] = useState(false);
  const [pEdit, setPEdit] = useState<ProgramRow | null>(null);
  const [pf, setPf] = useState({ name: '', code: '', duration: '4', sems: '2' });
  const [pErr, setPErr] = useState('');

  const openProgram = (row: ProgramRow | null) => {
    setPEdit(row);
    setPf(row
      ? {
          name: row.name,
          code: row.code,
          duration: String(row.duration_years || 3),
          sems: String(row.semesters_per_year || 2),
        }
      : { name: '', code: '', duration: '4', sems: '2' });
    setPErr('');
    setPModal(true);
  };

  const saveProgram = async () => {
    if (!pf.name.trim()) { setPErr('Programme name is required (e.g. B.Tech)'); return; }
    const duration = parseInt(pf.duration, 10);
    const sems = parseInt(pf.sems, 10);
    if (Number.isNaN(duration) || duration < 1 || duration > 10) { setPErr('Duration must be 1–10 years'); return; }
    if (Number.isNaN(sems) || sems < 1 || sems > 4) { setPErr('Semesters per year must be 1–4'); return; }
    setPErr('');
    try {
      const payload = {
        name: pf.name.trim(),
        code: pf.code.trim().toUpperCase(),
        duration_years: duration,
        semesters_per_year: sems,
      };
      if (pEdit) await mutate(`/academic/programs/${pEdit.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await mutate('/academic/programs', { method: 'POST', body: JSON.stringify(payload) });
      setPModal(false);
      refreshPrograms();
    } catch (e: any) { setPErr(e.message || 'Could not save the programme'); }
  };

  const toggleProgramActive = async (row: ProgramRow) => {
    try {
      await mutate(`/academic/programs/${row.id}`, { method: 'PUT', body: JSON.stringify({ active: !row.active }) });
      refreshPrograms();
    } catch (e: any) { setPErr(e.message || 'Could not update the programme'); }
  };

  /* ── branch modal ────────────────────────────────────────────────── */
  const [bModal, setBModal] = useState(false);
  const [bEdit, setBEdit] = useState<BranchRow | null>(null);
  const [bf, setBf] = useState({ name: '', code: '' });
  const [bErr, setBErr] = useState('');

  const openBranch = (row: BranchRow | null) => {
    setBEdit(row);
    setBf(row ? { name: row.name, code: row.code } : { name: '', code: '' });
    setBErr('');
    setBModal(true);
  };

  const saveBranch = async () => {
    const programId = bEdit ? bEdit.program_id : activeProgram?.id;
    if (!programId) { setBErr('Select a programme first'); return; }
    if (!bf.name.trim()) { setBErr('Branch name is required (e.g. Computer Science and Engineering)'); return; }
    setBErr('');
    try {
      const payload = { program_id: programId, name: bf.name.trim(), code: bf.code.trim().toUpperCase() };
      if (bEdit) await mutate(`/academic/branches/${bEdit.id}`, { method: 'PUT', body: JSON.stringify({ name: payload.name, code: payload.code }) });
      else await mutate('/academic/branches', { method: 'POST', body: JSON.stringify(payload) });
      setBModal(false);
      refreshBranches();
    } catch (e: any) { setBErr(e.message || 'Could not save the branch'); }
  };

  const toggleBranchActive = async (row: BranchRow) => {
    try {
      await mutate(`/academic/branches/${row.id}`, { method: 'PUT', body: JSON.stringify({ active: !row.active }) });
      refreshBranches();
    } catch (e: any) { setBErr(e.message || 'Could not update the branch'); }
  };

  /* ── section modal ───────────────────────────────────────────────── */
  const [secModal, setSecModal] = useState(false);
  const [secEdit, setSecEdit] = useState<SectionRow | null>(null);
  const [secf, setSecf] = useState({ year: '1', name: '', branch_id: '' });
  const [secErr, setSecErr] = useState('');

  const openSection = (row: SectionRow | null) => {
    setSecEdit(row);
    setSecf(row
      ? { year: String(row.year), name: row.name, branch_id: row.branch_id || '' }
      : { year: secYear || '1', name: '', branch_id: activeProgram ? (branches.find(b => b.program_id === activeProgram.id)?.id || '') : '' });
    setSecErr('');
    setSecModal(true);
  };

  const saveSection = async () => {
    const programId = secEdit ? secEdit.program_id : activeProgram?.id;
    if (!programId) { setSecErr('Select a programme first'); return; }
    if (!secf.name.trim()) { setSecErr('Section name is required (e.g. A)'); return; }
    const year = parseInt(secf.year, 10);
    if (Number.isNaN(year) || year < 1 || year > 10) { setSecErr('Year must be between 1 and 10'); return; }
    setSecErr('');
    try {
      const payload = {
        program_id: programId,
        branch_id: secf.branch_id || null,
        year,
        name: secf.name.trim().toUpperCase(),
      };
      if (secEdit) await mutate(`/academic/sections/${secEdit.id}`, { method: 'PUT', body: JSON.stringify({ year, name: payload.name }) });
      else await mutate('/academic/sections', { method: 'POST', body: JSON.stringify(payload) });
      setSecModal(false);
      refreshSections();
    } catch (e: any) { setSecErr(e.message || 'Could not save the section'); }
  };

  const toggleSectionActive = async (row: SectionRow) => {
    try {
      await mutate(`/academic/sections/${row.id}`, { method: 'PUT', body: JSON.stringify({ active: !row.active }) });
      refreshSections();
    } catch (e: any) { setSecErr(e.message || 'Could not update the section'); }
  };

  /* ── subject modal ───────────────────────────────────────────────── */
  const [jModal, setJModal] = useState(false);
  const [jEdit, setJEdit] = useState<SubjectRow | null>(null);
  const [jf, setJf] = useState({
    code: '', name: '', credits: '3', year: '1', semester: '1',
    subject_type: 'theory', program_id: '', branch_id: '', session_ids: [] as string[],
  });
  const [jErr, setJErr] = useState('');

  const openSubject = (row: SubjectRow | null) => {
    setJEdit(row);
    setJf(row
      ? {
          code: row.code,
          name: row.name,
          credits: row.credits == null ? '3' : String(row.credits),
          year: row.year == null ? '1' : String(row.year),
          semester: row.semester == null ? '1' : String(row.semester),
          subject_type: row.subject_type || 'theory',
          program_id: row.program_id || '',
          branch_id: row.branch_id || '',
          session_ids: row.session_ids || [],
        }
      : {
          code: '', name: '', credits: '3', year: '1', semester: '1',
          subject_type: 'theory',
          program_id: activeProgram?.id || fProgram || '',
          branch_id: fBranch || '',
          session_ids: fSession ? [fSession] : [],
        });
    setJErr('');
    setJModal(true);
  };

  const saveSubject = async () => {
    if (!jf.code.trim()) { setJErr('Subject code is required (e.g. CS301)'); return; }
    if (!jf.name.trim()) { setJErr('Subject name is required'); return; }
    if (!jf.program_id) { setJErr('Select a programme'); return; }
    const year = parseInt(jf.year, 10);
    const semester = parseInt(jf.semester, 10);
    if (Number.isNaN(year) || year < 1 || year > 10) { setJErr('Academic year must be 1–10'); return; }
    if (Number.isNaN(semester) || semester < 1 || semester > 12) { setJErr('Semester must be 1–12'); return; }
    setJErr('');
    try {
      const payload = {
        code: jf.code.trim().toUpperCase(),
        name: jf.name.trim(),
        program_id: jf.program_id,
        branch_id: jf.branch_id || null,
        year,
        semester,
        subject_type: jf.subject_type,
        credits: parseInt(jf.credits, 10) || 0,
        session_ids: jf.session_ids,
      };
      if (jEdit) await mutate(`/academic/subjects/${jEdit.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await mutate('/academic/subjects', { method: 'POST', body: JSON.stringify(payload) });
      setJModal(false);
      refreshSubjects();
    } catch (e: any) { setJErr(e.message || 'Could not save the subject'); }
  };

  const toggleSubjectActive = async (row: SubjectRow) => {
    try {
      await mutate(`/academic/subjects/${row.id}`, { method: 'PUT', body: JSON.stringify({ active: !row.active }) });
      refreshSubjects();
    } catch (e: any) { setJErr(e.message || 'Could not update the subject'); }
  };

  /* ── derived lists ───────────────────────────────────────────────── */
  const programBranches = useMemo(
    () => branches.filter(b => activeProgram && b.program_id === activeProgram.id),
    [branches, activeProgram],
  );
  const programSections = useMemo(() => {
    if (!activeProgram) return [];
    return sections.filter(s =>
      s.program_id === activeProgram.id &&
      (!secYear || String(s.year) === secYear),
    );
  }, [sections, activeProgram, secYear]);

  const branchName = useCallback(
    (id: string | null) => (id ? (branches.find(b => b.id === id)?.name || 'Unknown branch') : 'All branches'),
    [branches],
  );

  const yearOptions = useMemo(() => {
    const p = programs.find(x => x.id === (fProgram || ''));
    return range(1, p ? p.duration_years || 3 : 6);
  }, [programs, fProgram]);
  const semOptions = useMemo(() => {
    const p = programs.find(x => x.id === (fProgram || ''));
    return range(1, p ? p.total_semesters || 6 : 8);
  }, [programs, fProgram]);

  const onFab = () => {
    if (tab === 'sessions') openSession(null);
    else if (tab === 'programs') openProgram(null);
    else openSubject(null);
  };

  /* ── render ──────────────────────────────────────────────────────── */
  return (
    <ErrorBoundary>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Academic Structure"
          subtitle="Session → Programme → Branch → Year → Semester → Subject"
        />

        <TabSelector
          tabs={[
            { key: 'sessions', label: 'Sessions', badge: sessions.length || undefined },
            { key: 'programs', label: 'Programmes', badge: programs.length || undefined },
            { key: 'subjects', label: 'Subjects', badge: subjects.length || undefined },
          ]}
          activeTab={tab}
          onSelect={(k: string) => setTab(k as any)}
        />

        <AsyncView loading={loading} error={error} onRetry={reload} empty={false}>
          {tab === 'sessions' && (
            <ScrollView
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
            >
              {sessions.length === 0 && (
                <EmptyState
                  title="No academic sessions yet"
                  sub="Create 2025-2026 to start organising sessions"
                  actionLabel="Add session"
                  onAction={() => openSession(null)}
                />
              )}
              {sessions.map(s => (
                <Card key={s.id} style={styles.rowCard}>
                  <View style={styles.rowMain}>
                    <View style={[styles.iconBox, { backgroundColor: theme.colors.brandTertiary }]}>
                      <Calendar size={18} color={theme.colors.brandPrimary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {s.start_date || s.end_date ? `${s.start_date || '—'} → ${s.end_date || '—'}` : 'No dates set'}
                      </Text>
                    </View>
                    <View style={styles.pillRow}>
                      {s.is_current && <BadgePill label="Current" variant="success" size="sm" />}
                      {!s.active && <BadgePill label="Inactive" variant="neutral" size="sm" />}
                    </View>
                  </View>
                  <View style={styles.rowActions}>
                    {!s.is_current && (
                      <Pressable testID={`session-current-${s.name}`} onPress={() => makeCurrent(s)} style={styles.miniBtn}>
                        <CheckCircle size={13} color={theme.colors.brand} />
                        <Text style={styles.miniTxt}>Make current</Text>
                      </Pressable>
                    )}
                    <Pressable testID={`session-edit-${s.name}`} onPress={() => openSession(s)} style={styles.miniBtn}>
                      <Pencil size={13} color={theme.colors.muted} />
                      <Text style={[styles.miniTxt, { color: theme.colors.muted }]}>Edit</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </ScrollView>
          )}

          {tab === 'programs' && (
            <ScrollView
              contentContainerStyle={styles.list}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
            >
              {programs.length === 0 ? (
                <EmptyState
                  title="No programmes yet"
                  sub="Add B.Tech, BCA, MBA or any programme your college offers"
                  actionLabel="Add programme"
                  onAction={() => openProgram(null)}
                />
              ) : (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    {programs.map(p => (
                      <ChipBtn
                        key={p.id}
                        testID={`program-chip-${p.code}`}
                        label={`${p.code} · ${p.name}`}
                        active={activeProgram?.id === p.id}
                        onPress={() => setSelProgram(p.id)}
                      />
                    ))}
                  </ScrollView>

                  {activeProgram && (
                    <Card style={styles.rowCard}>
                      <View style={styles.rowMain}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.brandTertiary }]}>
                          <GraduationCap size={18} color={theme.colors.brandPrimary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle} numberOfLines={1}>{activeProgram.name}</Text>
                          <Text style={styles.meta} numberOfLines={1}>
                            {activeProgram.code} · {activeProgram.duration_years} years · {activeProgram.total_semesters} semesters
                          </Text>
                        </View>
                        <BadgePill label={activeProgram.active ? 'Active' : 'Inactive'} variant={activeProgram.active ? 'success' : 'neutral'} size="sm" />
                      </View>
                      <View style={styles.rowActions}>
                        <Pressable testID="program-edit" onPress={() => openProgram(activeProgram)} style={styles.miniBtn}>
                          <Pencil size={13} color={theme.colors.muted} />
                          <Text style={[styles.miniTxt, { color: theme.colors.muted }]}>Edit</Text>
                        </Pressable>
                        <Pressable testID="program-toggle" onPress={() => toggleProgramActive(activeProgram)} style={styles.miniBtn}>
                          <Text style={styles.miniTxt}>{activeProgram.active ? 'Deactivate' : 'Reactivate'}</Text>
                        </Pressable>
                      </View>
                    </Card>
                  )}

                  <SectionHeader
                    title={`Branches${activeProgram ? ` · ${activeProgram.name}` : ''}`}
                    actionLabel="Add branch"
                    onAction={() => openBranch(null)}
                  />
                  {programBranches.length === 0 && (
                    <Text style={styles.hint}>No branches yet. Add CSE, IT, ECE… for this programme.</Text>
                  )}
                  {programBranches.map(b => (
                    <Card key={b.id} style={styles.rowCard}>
                      <View style={styles.rowMain}>
                        <View style={styles.codeBadge}><Text style={styles.codeBadgeTxt}>{b.code}</Text></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle} numberOfLines={2}>{b.name}</Text>
                        </View>
                        <BadgePill label={b.active ? 'Active' : 'Off'} variant={b.active ? 'success' : 'neutral'} size="sm" />
                        <Pressable testID={`branch-edit-${b.code}`} onPress={() => openBranch(b)} hitSlop={8}>
                          <Pencil size={16} color={theme.colors.muted} />
                        </Pressable>
                        <Pressable testID={`branch-toggle-${b.code}`} onPress={() => toggleBranchActive(b)} hitSlop={8}>
                          <ChevronRight size={16} color={theme.colors.muted} />
                        </Pressable>
                      </View>
                    </Card>
                  ))}

                  <SectionHeader
                    title="Sections"
                    actionLabel="Add section"
                    onAction={() => openSection(null)}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    <ChipBtn label="All years" active={!secYear} onPress={() => setSecYear('')} />
                    {range(1, activeProgram?.duration_years || 3).map(y => (
                      <ChipBtn
                        key={y}
                        label={`Year ${y}`}
                        active={secYear === String(y)}
                        onPress={() => setSecYear(String(y))}
                      />
                    ))}
                  </ScrollView>
                  {programSections.length === 0 && (
                    <Text style={styles.hint}>No sections for this filter yet.</Text>
                  )}
                  {programSections.map(s => (
                    <Card key={s.id} style={styles.rowCard}>
                      <View style={styles.rowMain}>
                        <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceTertiary }]}>
                          <Users size={16} color={theme.colors.muted} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle}>Section {s.name}</Text>
                          <Text style={styles.meta}>Year {s.year} · {branchName(s.branch_id)}</Text>
                        </View>
                        <BadgePill label={s.active ? 'Active' : 'Off'} variant={s.active ? 'success' : 'neutral'} size="sm" />
                        <Pressable testID={`section-edit-${s.name}`} onPress={() => openSection(s)} hitSlop={8}>
                          <Pencil size={16} color={theme.colors.muted} />
                        </Pressable>
                        <Pressable testID={`section-toggle-${s.name}`} onPress={() => toggleSectionActive(s)} hitSlop={8}>
                          <ChevronRight size={16} color={theme.colors.muted} />
                        </Pressable>
                      </View>
                    </Card>
                  ))}
                </>
              )}
            </ScrollView>
          )}

          {tab === 'subjects' && (
            <>
              <View style={styles.filters}>
                <SearchBar value={q} onChangeText={setQ} placeholder="Search subject name or code..." testID="subject-search" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="All sessions" active={!fSession} onPress={() => setFSession('')} testID="filter-session-all" />
                  {sessions.map(s => (
                    <ChipBtn key={s.id} label={s.name} active={fSession === s.id} onPress={() => setFSession(s.id)} testID={`filter-session-${s.name}`} />
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="All programmes" active={!fProgram} onPress={() => { setFProgram(''); setFBranch(''); }} testID="filter-program-all" />
                  {programs.map(p => (
                    <ChipBtn key={p.id} label={p.name} active={fProgram === p.id} onPress={() => { setFProgram(p.id); setFBranch(''); }} testID={`filter-program-${p.code}`} />
                  ))}
                </ScrollView>
                {fProgram && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    <ChipBtn label="All branches" active={!fBranch} onPress={() => setFBranch('')} />
                    {branches.filter(b => b.program_id === fProgram).map(b => (
                      <ChipBtn key={b.id} label={b.code} active={fBranch === b.id} onPress={() => setFBranch(b.id)} />
                    ))}
                  </ScrollView>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="Any year" active={!fYear} onPress={() => setFYear('')} />
                  {yearOptions.map(y => (
                    <ChipBtn key={y} label={`Y${y}`} active={fYear === String(y)} onPress={() => setFYear(String(y))} />
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="Any semester" active={!fSem} onPress={() => setFSem('')} />
                  {semOptions.map(sm => (
                    <ChipBtn key={sm} label={`Sem ${sm}`} active={fSem === String(sm)} onPress={() => setFSem(String(sm))} />
                  ))}
                </ScrollView>
              </View>

              <ScrollView
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
              >
                {subjects.length === 0 && (
                  <EmptyState
                    title="No subjects match"
                    sub="Adjust the filters or add a subject for this semester"
                    actionLabel="Add subject"
                    onAction={() => openSubject(null)}
                  />
                )}
                {subjects.map(s => (
                  <Pressable key={s.id} testID={`subject-${s.code}`} onPress={() => openSubject(s)}>
                    <Card style={styles.rowCard}>
                      <View style={styles.rowMain}>
                        <View style={styles.codeBadge}><Text style={styles.codeBadgeTxt}>{s.code}</Text></View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle} numberOfLines={2}>{s.name}</Text>
                          <Text style={styles.meta} numberOfLines={1}>
                            {s.year ? `Year ${s.year} · Sem ${s.semester}` : 'Legacy subject'} · {s.subject_type}
                            {s.credits != null ? ` · ${s.credits} credits` : ''}
                          </Text>
                        </View>
                        <BadgePill
                          label={s.active ? 'Active' : 'Inactive'}
                          variant={s.active ? 'success' : 'neutral'}
                          size="sm"
                        />
                        <Pressable testID={`subject-toggle-${s.code}`} onPress={() => toggleSubjectActive(s)} hitSlop={8}>
                          <ChevronRight size={16} color={theme.colors.muted} />
                        </Pressable>
                      </View>
                    </Card>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}
        </AsyncView>

        <Pressable
          testID="am-fab"
          accessibilityLabel={tab === 'sessions' ? 'Add session' : tab === 'programs' ? 'Add programme' : 'Add subject'}
          onPress={onFab}
          style={styles.fab}
        >
          <Plus color={theme.colors.onBrandPrimary} size={26} />
        </Pressable>

        {/* Session modal */}
        <Modal visible={sModal} transparent animationType="slide" onRequestClose={() => setSModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{sEdit ? 'Edit Session' : 'Add Academic Session'}</Text>
                <Pressable testID="session-close" onPress={() => setSModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Session name</Text>
                <TextInput
                  testID="session-name"
                  value={sf.name}
                  onChangeText={v => setSf(p => ({ ...p, name: v }))}
                  placeholder="2025-2026"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Start (YYYY-MM-DD)</Text>
                    <TextInput
                      testID="session-start"
                      value={sf.start}
                      onChangeText={v => setSf(p => ({ ...p, start: v }))}
                      placeholder="2025-07-01"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>End (YYYY-MM-DD)</Text>
                    <TextInput
                      testID="session-end"
                      value={sf.end}
                      onChangeText={v => setSf(p => ({ ...p, end: v }))}
                      placeholder="2026-06-30"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Set as current session</Text>
                  <Switch
                    testID="session-current"
                    value={sf.is_current}
                    onValueChange={v => setSf(p => ({ ...p, is_current: v }))}
                    trackColor={{ true: theme.colors.brandPrimary, false: theme.colors.border }}
                  />
                </View>
                {sErr ? <Text style={styles.err}>{sErr}</Text> : null}
                <Pressable testID="session-save" onPress={saveSession} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>{sEdit ? 'Save Changes' : 'Create Session'}</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Programme modal */}
        <Modal visible={pModal} transparent animationType="slide" onRequestClose={() => setPModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{pEdit ? 'Edit Programme' : 'Add Programme'}</Text>
                <Pressable testID="program-close" onPress={() => setPModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Programme name</Text>
                <TextInput
                  testID="program-name"
                  value={pf.name}
                  onChangeText={v => setPf(p => ({ ...p, name: v }))}
                  placeholder="B.Tech"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>Code (optional — derived from name if blank)</Text>
                <TextInput
                  testID="program-code"
                  value={pf.code}
                  onChangeText={v => setPf(p => ({ ...p, code: v }))}
                  placeholder="BTECH"
                  autoCapitalize="characters"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Duration (years)</Text>
                    <TextInput
                      testID="program-duration"
                      value={pf.duration}
                      onChangeText={v => setPf(p => ({ ...p, duration: v }))}
                      keyboardType="number-pad"
                      placeholder="4"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Semesters / year</Text>
                    <TextInput
                      testID="program-sems"
                      value={pf.sems}
                      onChangeText={v => setPf(p => ({ ...p, sems: v }))}
                      keyboardType="number-pad"
                      placeholder="2"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                </View>
                {pErr ? <Text style={styles.err}>{pErr}</Text> : null}
                <Pressable testID="program-save" onPress={saveProgram} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>{pEdit ? 'Save Changes' : 'Create Programme'}</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Branch modal */}
        <Modal visible={bModal} transparent animationType="slide" onRequestClose={() => setBModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{bEdit ? 'Edit Branch' : 'Add Branch'}</Text>
                <Pressable testID="branch-close" onPress={() => setBModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Branch name</Text>
                <TextInput
                  testID="branch-name"
                  value={bf.name}
                  onChangeText={v => setBf(p => ({ ...p, name: v }))}
                  placeholder="Computer Science and Engineering"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>Short code (optional — initials used if blank)</Text>
                <TextInput
                  testID="branch-code"
                  value={bf.code}
                  onChangeText={v => setBf(p => ({ ...p, code: v }))}
                  placeholder="CSE"
                  autoCapitalize="characters"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                {bErr ? <Text style={styles.err}>{bErr}</Text> : null}
                <Pressable testID="branch-save" onPress={saveBranch} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>{bEdit ? 'Save Changes' : 'Create Branch'}</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Section modal */}
        <Modal visible={secModal} transparent animationType="slide" onRequestClose={() => setSecModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{secEdit ? 'Edit Section' : 'Add Section'}</Text>
                <Pressable testID="section-close" onPress={() => setSecModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Section name</Text>
                <TextInput
                  testID="section-name"
                  value={secf.name}
                  onChangeText={v => setSecf(p => ({ ...p, name: v }))}
                  placeholder="A"
                  autoCapitalize="characters"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>Academic year</Text>
                <TextInput
                  testID="section-year"
                  value={secf.year}
                  onChangeText={v => setSecf(p => ({ ...p, year: v }))}
                  keyboardType="number-pad"
                  placeholder="2"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>Branch (optional)</Text>
                <View style={styles.chipRow}>
                  <ChipBtn label="All branches" active={!secf.branch_id} onPress={() => setSecf(p => ({ ...p, branch_id: '' }))} />
                  {programBranches.map(b => (
                    <ChipBtn
                      key={b.id}
                      label={b.code}
                      active={secf.branch_id === b.id}
                      onPress={() => setSecf(p => ({ ...p, branch_id: b.id }))}
                    />
                  ))}
                </View>
                {secErr ? <Text style={styles.err}>{secErr}</Text> : null}
                <Pressable testID="section-save" onPress={saveSection} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>{secEdit ? 'Save Changes' : 'Create Section'}</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Subject modal */}
        <Modal visible={jModal} transparent animationType="slide" onRequestClose={() => setJModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{jEdit ? 'Edit Subject' : 'Add Subject'}</Text>
                <Pressable testID="subject-close" onPress={() => setJModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Subject code</Text>
                    <TextInput
                      testID="subject-code"
                      value={jf.code}
                      onChangeText={v => setJf(p => ({ ...p, code: v }))}
                      placeholder="CS301"
                      autoCapitalize="characters"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ width: 90 }}>
                    <Text style={styles.label}>Credits</Text>
                    <TextInput
                      testID="subject-credits"
                      value={jf.credits}
                      onChangeText={v => setJf(p => ({ ...p, credits: v }))}
                      keyboardType="number-pad"
                      placeholder="4"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                </View>
                <Text style={styles.label}>Subject name</Text>
                <TextInput
                  testID="subject-name"
                  value={jf.name}
                  onChangeText={v => setJf(p => ({ ...p, name: v }))}
                  placeholder="Database Management Systems"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />

                <Text style={styles.label}>Programme</Text>
                <View style={styles.chipRow}>
                  {programs.map(p => (
                    <ChipBtn
                      key={p.id}
                      label={p.name}
                      active={jf.program_id === p.id}
                      onPress={() => setJf(prev => ({ ...prev, program_id: p.id, branch_id: '' }))}
                      testID={`subject-program-${p.code}`}
                    />
                  ))}
                  {programs.length === 0 && <Text style={styles.hint}>Create a programme first.</Text>}
                </View>

                <Text style={styles.label}>Branch (optional)</Text>
                <View style={styles.chipRow}>
                  <ChipBtn label="All branches" active={!jf.branch_id} onPress={() => setJf(p => ({ ...p, branch_id: '' }))} />
                  {branches.filter(b => b.program_id === jf.program_id).map(b => (
                    <ChipBtn
                      key={b.id}
                      label={b.code}
                      active={jf.branch_id === b.id}
                      onPress={() => setJf(p => ({ ...p, branch_id: b.id }))}
                      testID={`subject-branch-${b.code}`}
                    />
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Academic year</Text>
                    <TextInput
                      testID="subject-year"
                      value={jf.year}
                      onChangeText={v => setJf(p => ({ ...p, year: v }))}
                      keyboardType="number-pad"
                      placeholder="2"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Semester</Text>
                    <TextInput
                      testID="subject-semester"
                      value={jf.semester}
                      onChangeText={v => setJf(p => ({ ...p, semester: v }))}
                      keyboardType="number-pad"
                      placeholder="3"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                </View>

                <Text style={styles.label}>Subject type</Text>
                <View style={styles.chipRow}>
                  {SUBJECT_TYPES.map(t => (
                    <ChipBtn
                      key={t}
                      label={t[0].toUpperCase() + t.slice(1)}
                      active={jf.subject_type === t}
                      onPress={() => setJf(p => ({ ...p, subject_type: t }))}
                      testID={`subject-type-${t}`}
                    />
                  ))}
                </View>

                <Text style={styles.label}>Academic sessions (empty = current session)</Text>
                <View style={styles.chipRow}>
                  {sessions.map(s => {
                    const on = jf.session_ids.includes(s.id);
                    return (
                      <ChipBtn
                        key={s.id}
                        label={s.name}
                        active={on}
                        onPress={() => setJf(p => ({
                          ...p,
                          session_ids: on ? p.session_ids.filter(x => x !== s.id) : [...p.session_ids, s.id],
                        }))}
                        testID={`subject-session-${s.name}`}
                      />
                    );
                  })}
                </View>

                {jErr ? <Text style={styles.err}>{jErr}</Text> : null}
                <Pressable testID="subject-save" onPress={saveSubject} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>{jEdit ? 'Save Changes' : 'Create Subject'}</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onAction} hitSlop={8} style={styles.sectionAction} accessibilityRole="button">
        <Plus size={14} color={theme.colors.brandPrimary} />
        <Text style={styles.sectionActionTxt}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg, gap: 10, paddingBottom: 120 },
  rowCard: { padding: theme.spacing.md },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowActions: { flexDirection: 'row', gap: 14, marginTop: 10, marginLeft: 48 },
  rowTitle: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 14 },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  hint: { color: theme.colors.muted, fontSize: 12, fontStyle: 'italic', paddingHorizontal: 4 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  codeBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceTertiary, borderWidth: 1, borderColor: theme.colors.border },
  codeBadgeTxt: { fontSize: 11, fontWeight: '800', color: theme.colors.onSurfaceTertiary, letterSpacing: 0.3 },
  pillRow: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.brand },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  filters: { paddingHorizontal: theme.spacing.lg, gap: 8, paddingBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionActionTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.brandPrimary },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center',
    ...theme.shadow.md,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 13, fontSize: 15, color: theme.colors.onSurface },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: theme.colors.onBrandPrimary, fontWeight: '700', fontSize: 15 },
});
