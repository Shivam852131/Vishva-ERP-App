import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, X, Users, BookOpen, Pencil, GraduationCap,
} from 'lucide-react-native';

import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import {
  PageHeader, TabSelector, AsyncView, EmptyState, BadgePill, SearchBar, ChipBtn, Card,
} from '@/src/ui';

/**
 * Day-to-day academic operations:
 *  • Assignments — assign faculty to a subject + section inside a session, with
 *    backend conflict protection (no double booking unless co-teaching allows it).
 *  • Students — enroll students into the programme structure, build subject
 *    rosters, promote cohorts (history is kept, never rewritten) and withdraw
 *    enrollment softly. Every list is filtered and paginated server-side.
 */

interface SessionRow { id: string; name: string; is_current: boolean }
interface ProgramRow { id: string; code: string; name: string; duration_years: number; total_semesters: number }
interface BranchRow { id: string; program_id: string; name: string; code: string }
interface SectionRow { id: string; program_id: string; branch_id: string | null; year: number; name: string; active?: boolean }
interface SubjectRow {
  id: string; code: string; name: string; program_id: string | null;
  branch_id: string | null; year: number | null; semester: number | null; active: boolean;
}
interface UserRow { id: string; name: string; studentCode?: string }
interface AssignmentRow {
  id: string; session_id: string; course_id: string; course_name: string | null; course_code: string | null;
  program_id: string | null; branch_id: string | null; year: number | null; semester: number | null;
  section_id: string | null; section_name: string | null; faculty_id: string; faculty_name: string | null; active: boolean;
}
interface EnrollmentRow {
  id: string; student_id: string; student_name: string; student_code: string | null;
  program_id: string; branch_id: string | null; year: number; semester: number;
  section_id: string | null; section_name: string | null; status: string; promoted_to: any;
}

const PAGE_SIZE = 25;
const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'promoted', label: 'Promoted' },
  { key: 'inactive', label: 'Withdrawn' },
];

function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

export default function AcademicEnrollmentScreen() {
  const [tab, setTab] = useState<'assignments' | 'students'>('assignments');
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState('');

  /* ── structure data shared by both tabs ──────────────────────────── */
  const {
    data: sessionsRaw, loading: loadSessions, error: errSessions, refresh: refreshSessions,
  } = useFetch<SessionRow[]>('/academic/sessions');
  const { data: programsRaw, refresh: refreshPrograms } = useFetch<ProgramRow[]>('/academic/programs');
  const { data: branchesRaw, refresh: refreshBranches } = useFetch<BranchRow[]>('/academic/branches');
  const { data: sectionsRaw, refresh: refreshSections } = useFetch<SectionRow[]>('/academic/sections');
  const { data: subjectsRaw, refresh: refreshSubjects } = useFetch<SubjectRow[]>('/academic/subjects');
  const { data: facultyRaw, refresh: refreshFaculty } = useFetch<UserRow[]>('/admin/users?role=faculty');
  const { data: allStudentsRaw, refresh: refreshAllStudents } = useFetch<UserRow[]>('/admin/users?role=student');
  const { data: settingsRaw, refresh: refreshSettings } = useFetch<{ allowCoTeaching: boolean }>('/academic/settings');

  const sessions = useMemo(() => sessionsRaw || [], [sessionsRaw]);
  const programs = useMemo(() => programsRaw || [], [programsRaw]);
  const branches = useMemo(() => branchesRaw || [], [branchesRaw]);
  const sections = useMemo(() => sectionsRaw || [], [sectionsRaw]);
  const subjects = useMemo(() => subjectsRaw || [], [subjectsRaw]);
  const faculty = useMemo(() => facultyRaw || [], [facultyRaw]);
  const allStudents = useMemo(() => allStudentsRaw || [], [allStudentsRaw]);
  const settings = settingsRaw || { allowCoTeaching: true };

  const { mutate, loading: busy } = useMutate();
  const { mutate: mutateSettings, loading: busySettings } = useMutate();

  /* ── assignments (server-side filtered) ──────────────────────────── */
  const [afSession, setAfSession] = useState('');
  const [afSubject, setAfSubject] = useState('');
  const [afFaculty, setAfFaculty] = useState('');

  const assignmentsPath = useMemo(() => {
    const parts: string[] = [];
    if (afSession) parts.push(`session_id=${afSession}`);
    if (afSubject) parts.push(`course_id=${afSubject}`);
    if (afFaculty) parts.push(`faculty_id=${afFaculty}`);
    return `/academic/assignments${parts.length ? `?${parts.join('&')}` : ''}`;
  }, [afSession, afSubject, afFaculty]);

  const {
    data: assignmentsRaw, loading: loadAssignments, error: errAssignments, refresh: refreshAssignments,
  } = useFetch<AssignmentRow[]>(assignmentsPath);
  const assignments = useMemo(() => assignmentsRaw || [], [assignmentsRaw]);

  /* ── student roster (server-side filtered + paginated) ───────────── */
  const [sfSession, setSfSession] = useState('');
  const [sfProgram, setSfProgram] = useState('');
  const [sfBranch, setSfBranch] = useState('');
  const [sfYear, setSfYear] = useState('');
  const [sfSem, setSfSem] = useState('');
  const [sfSection, setSfSection] = useState('');
  const [sfStatus, setSfStatus] = useState('active');
  const [sq, setSq] = useState('');
  const [page, setPage] = useState(1);

  const rosterPath = useMemo(() => {
    const parts = [`page=${page}`, `pageSize=${PAGE_SIZE}`, `status=${sfStatus}`];
    if (sfSession) parts.push(`session_id=${sfSession}`);
    if (sfProgram) parts.push(`program_id=${sfProgram}`);
    if (sfBranch) parts.push(`branch_id=${sfBranch}`);
    if (sfYear) parts.push(`year=${sfYear}`);
    if (sfSem) parts.push(`semester=${sfSem}`);
    if (sfSection) parts.push(`section_id=${sfSection}`);
    if (sq.trim()) parts.push(`q=${encodeURIComponent(sq.trim())}`);
    return `/academic/enrollments?${parts.join('&')}`;
  }, [page, sfStatus, sfSession, sfProgram, sfBranch, sfYear, sfSem, sfSection, sq]);

  const {
    data: rosterPage, loading: loadRoster, error: errRoster, refresh: refreshRoster,
  } = useFetch<{ items: EnrollmentRow[]; total: number; page: number; pageSize: number }>(rosterPath);

  const roster = useMemo(() => rosterPage?.items || [], [rosterPage]);
  const rosterTotal = rosterPage?.total || 0;
  const totalPages = Math.max(1, Math.ceil(rosterTotal / PAGE_SIZE));

  const setFilter = useCallback((setter: (v: any) => void, value: any) => {
    setter(value);
    setPage(1);
    setNotice('');
  }, []);

  const reloadAll = useCallback(() => {
    refreshSessions();
    refreshPrograms();
    refreshBranches();
    refreshSections();
    refreshSubjects();
    refreshFaculty();
    refreshAllStudents();
    refreshSettings();
    refreshAssignments();
    refreshRoster();
  }, [
    refreshSessions, refreshPrograms, refreshBranches, refreshSections, refreshSubjects,
    refreshFaculty, refreshAllStudents, refreshSettings, refreshAssignments, refreshRoster,
  ]);

  React.useEffect(() => {
    if (refreshing && !loadSessions && !loadAssignments && !loadRoster) setRefreshing(false);
  }, [refreshing, loadSessions, loadAssignments, loadRoster]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reloadAll();
  }, [reloadAll]);

  /* ── assignment sheet ────────────────────────────────────────────── */
  const [aSheet, setASheet] = useState(false);
  const [aEdit, setAEdit] = useState<AssignmentRow | null>(null);
  const [af2, setAf2] = useState({
    session_id: '', program_id: '', branch_id: '', year: '1', semester: '1',
    course_id: '', section_id: '', faculty_id: '',
  });
  const [aErr, setAErr] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState('');

  const openAssignment = (row: AssignmentRow | null) => {
    setAEdit(row);
    setAf2(row
      ? {
          session_id: row.session_id, program_id: row.program_id || '', branch_id: row.branch_id || '',
          year: row.year ? String(row.year) : '1', semester: row.semester ? String(row.semester) : '1',
          course_id: row.course_id, section_id: row.section_id || '', faculty_id: row.faculty_id,
        }
      : {
          session_id: sfSession || (sessions.find(s => s.is_current)?.id || sessions[0]?.id || ''),
          program_id: sfProgram, branch_id: sfBranch, year: sfYear || '1', semester: sfSem || '1',
          course_id: afSubject, section_id: '', faculty_id: afFaculty,
        });
    setAErr('');
    setASheet(true);
  };

  // Dependent selectors inside the assignment sheet
  const sheetProgram = programs.find(p => p.id === af2.program_id) || null;
  const sheetSubjects = useMemo(() => subjects.filter(s => s.active !== false && (
    (!af2.program_id || s.program_id === af2.program_id) &&
    (!af2.branch_id || !s.branch_id || s.branch_id === af2.branch_id) &&
    (!af2.year || String(s.year) === af2.year) &&
    (!af2.semester || String(s.semester) === af2.semester)
  )), [subjects, af2.program_id, af2.branch_id, af2.year, af2.semester]);
  const sheetSections = useMemo(() => sections.filter(s => s.active !== false && (
    (!af2.program_id || s.program_id === af2.program_id) &&
    (!af2.branch_id || !s.branch_id || s.branch_id === af2.branch_id) &&
    (!af2.year || String(s.year) === af2.year)
  )), [sections, af2.program_id, af2.branch_id, af2.year]);

  const saveAssignment = async () => {
    if (!af2.session_id) { setAErr('Select an academic session'); return; }
    if (!af2.course_id) { setAErr('Select a subject'); return; }
    if (!af2.faculty_id) { setAErr('Select a faculty member'); return; }
    setAErr('');
    try {
      const payload = {
        session_id: af2.session_id,
        course_id: af2.course_id,
        faculty_id: af2.faculty_id,
        section_id: af2.section_id || undefined,
      };
      if (aEdit) await mutate(`/academic/assignments/${aEdit.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await mutate('/academic/assignments', { method: 'POST', body: JSON.stringify(payload) });
      setASheet(false);
      refreshAssignments();
      setNotice(aEdit ? 'Assignment updated.' : 'Faculty assigned.');
    } catch (e: any) { setAErr(e.message || 'Could not save the assignment'); }
  };

  const deactivateAssignment = async (row: AssignmentRow) => {
    if (confirmDeactivate !== row.id) { setConfirmDeactivate(row.id); return; }
    setConfirmDeactivate('');
    try {
      await mutate(`/academic/assignments/${row.id}`, { method: 'DELETE' });
      refreshAssignments();
      setNotice('Assignment deactivated (kept for history).');
    } catch (e: any) { setNotice(e.message || 'Could not update the assignment'); }
  };

  const toggleCoTeaching = async (value: boolean) => {
    try {
      await mutateSettings('/academic/settings', { method: 'PUT', body: JSON.stringify({ allowCoTeaching: value }) });
      refreshSettings();
    } catch (e: any) { setNotice(e.message || 'Could not update the policy'); }
  };

  /* ── enroll students sheet ───────────────────────────────────────── */
  const [eSheet, setESheet] = useState(false);
  const [ef, setEf] = useState({
    session_id: '', program_id: '', branch_id: '', year: '1', semester: '1', section_id: '',
  });
  const [eSel, setESel] = useState<string[]>([]);
  const [eq, setEq] = useState('');
  const [eErr, setEErr] = useState('');

  const openEnroll = () => {
    setEf({
      session_id: sfSession || (sessions.find(s => s.is_current)?.id || sessions[0]?.id || ''),
      program_id: sfProgram, branch_id: sfBranch, year: sfYear || '1', semester: sfSem || '1',
      section_id: sfSection,
    });
    setESel([]);
    setEq('');
    setEErr('');
    setESheet(true);
  };

  const enrollSheetSections = useMemo(() => sections.filter(s => s.active !== false && (
    (!ef.program_id || s.program_id === ef.program_id) &&
    (!ef.branch_id || !s.branch_id || s.branch_id === ef.branch_id) &&
    (!ef.year || String(s.year) === ef.year)
  )), [sections, ef.program_id, ef.branch_id, ef.year]);

  const filteredStudents = useMemo(() => {
    const rx = eq.trim().toLowerCase();
    if (!rx) return allStudents;
    return allStudents.filter(s =>
      (s.name || '').toLowerCase().includes(rx) || (s.studentCode || '').toLowerCase().includes(rx));
  }, [allStudents, eq]);

  const saveEnroll = async () => {
    if (!ef.session_id) { setEErr('Select an academic session'); return; }
    if (!ef.program_id) { setEErr('Select a programme'); return; }
    if (!eSel.length) { setEErr('Select at least one student'); return; }
    setEErr('');
    try {
      const res: any = await mutate('/academic/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          session_id: ef.session_id,
          program_id: ef.program_id,
          branch_id: ef.branch_id || undefined,
          year: parseInt(ef.year, 10) || 1,
          semester: parseInt(ef.semester, 10) || 1,
          section_id: ef.section_id || undefined,
          studentIds: eSel,
        }),
      });
      setESheet(false);
      refreshRoster();
      setNotice(`${res?.created ?? 0} enrolled, ${res?.skipped ?? 0} skipped (already enrolled).`);
    } catch (e: any) { setEErr(e.message || 'Could not enroll the students'); }
  };

  /* ── bulk subject roster sheet ───────────────────────────────────── */
  const [sbSheet, setSbSheet] = useState(false);
  const [sbErr, setSbErr] = useState('');

  const openSubjectRoster = () => {
    setSbErr('');
    setSbSheet(true);
  };

  const matchingSubjects = useMemo(() => subjects.filter(s => s.active !== false && (
    (!sfProgram || s.program_id === sfProgram) &&
    (!sfBranch || !s.branch_id || s.branch_id === sfBranch) &&
    (!sfYear || String(s.year) === sfYear) &&
    (!sfSem || String(s.semester) === sfSem)
  )), [subjects, sfProgram, sfBranch, sfYear, sfSem]);

  const saveSubjectRoster = async () => {
    if (!sfProgram) { setSbErr('Select a programme in the filters first'); return; }
    if (!sfYear || !sfSem) { setSbErr('Select a year and semester in the filters first'); return; }
    setSbErr('');
    try {
      const res: any = await mutate('/academic/enrollments/subjects', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sfSession || undefined,
          program_id: sfProgram,
          branch_id: sfBranch || undefined,
          year: parseInt(sfYear, 10),
          semester: parseInt(sfSem, 10),
          section_id: sfSection || undefined,
        }),
      });
      setSbSheet(false);
      setNotice(`Roster built: ${res?.students ?? 0} students × ${res?.subjects ?? 0} subjects — ${res?.created ?? 0} links created, ${res?.skipped ?? 0} already existed.`);
    } catch (e: any) { setSbErr(e.message || 'Could not build the subject roster'); }
  };

  /* ── promote sheet ───────────────────────────────────────────────── */
  const [pSheet, setPSheet] = useState(false);
  const [pf, setPf] = useState({ to_year: '3', to_semester: '5', to_section_id: '' });
  const [pSel, setPSel] = useState<string[]>([]);
  const [pErr, setPErr] = useState('');

  const openPromote = () => {
    const nextYear = (parseInt(sfYear, 10) || 2) + 1;
    setPf({
      to_year: String(nextYear),
      to_semester: String(((nextYear - 1) * 2) + 1),
      to_section_id: '',
    });
    setPSel(roster.filter(r => r.status === 'active').map(r => r.student_id));
    setPErr('');
    setPSheet(true);
  };

  const promoteSections = useMemo(() => sections.filter(s => s.active !== false && (
    (!sfProgram || s.program_id === sfProgram) &&
    (!sfBranch || !s.branch_id || s.branch_id === sfBranch) &&
    String(s.year) === pf.to_year
  )), [sections, sfProgram, sfBranch, pf.to_year]);

  const savePromote = async () => {
    const sessionId = sfSession || sessions.find(s => s.is_current)?.id || sessions[0]?.id || '';
    if (!sessionId) { setPErr('No academic session available'); return; }
    const toYear = parseInt(pf.to_year, 10);
    const toSem = parseInt(pf.to_semester, 10);
    if (Number.isNaN(toYear) || toYear < 1 || toYear > 10) { setPErr('Target year must be 1–10'); return; }
    if (Number.isNaN(toSem) || toSem < 1 || toSem > 12) { setPErr('Target semester must be 1–12'); return; }
    if (!pSel.length) { setPErr('Select at least one student on this page'); return; }
    setPErr('');
    try {
      const res: any = await mutate('/academic/enrollments/promote', {
        method: 'POST',
        body: JSON.stringify({
          session_id: sessionId,
          studentIds: pSel,
          to_year: toYear,
          to_semester: toSem,
          to_section_id: pf.to_section_id || undefined,
        }),
      });
      setPSheet(false);
      refreshRoster();
      setNotice(`${res?.promoted ?? 0} promoted to Year ${toYear} · Sem ${toSem}. Previous enrollment kept as history.`);
    } catch (e: any) { setPErr(e.message || 'Could not promote the students'); }
  };

  /* ── withdraw (soft) ─────────────────────────────────────────────── */
  const [confirmWithdraw, setConfirmWithdraw] = useState('');

  const withdraw = async (row: EnrollmentRow) => {
    if (confirmWithdraw !== row.id) { setConfirmWithdraw(row.id); return; }
    setConfirmWithdraw('');
    try {
      await mutate(`/academic/enrollments/${row.id}`, { method: 'DELETE' });
      refreshRoster();
      setNotice(`${row.student_name} withdrawn (record kept for history).`);
    } catch (e: any) { setNotice(e.message || 'Could not withdraw the student'); }
  };

  /* ── name joins for the assignment list ──────────────────────────── */
  const programName = useCallback((id: string | null) => (id ? (programs.find(p => p.id === id)?.name || null) : null), [programs]);
  const branchCode = useCallback((id: string | null) => (id ? (branches.find(b => b.id === id)?.code || null) : null), [branches]);
  const sessionName = useCallback((id: string) => (sessions.find(s => s.id === id)?.name || null), [sessions]);

  const loading = tab === 'assignments'
    ? loadAssignments || loadSessions
    : loadRoster || loadSessions;
  const error = tab === 'assignments'
    ? errAssignments || errSessions
    : errRoster || errSessions;

  return (
    <ErrorBoundary>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Enrollment & Faculty"
          subtitle="Assign faculty to classes · manage student enrollments"
        />

        <TabSelector
          tabs={[
            { key: 'assignments', label: 'Assignments', badge: assignments.length || undefined },
            { key: 'students', label: 'Students', badge: rosterTotal || undefined },
          ]}
          activeTab={tab}
          onSelect={(k: string) => setTab(k as any)}
        />

        <AsyncView loading={loading} error={error} onRetry={reloadAll} empty={false}>
          {tab === 'assignments' ? (
            <>
              {/* College policy: co-teaching */}
              <View style={styles.policyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.policyTitle}>Allow co-teaching</Text>
                  <Text style={styles.policySub}>Multiple faculty per subject + section</Text>
                </View>
                <Switch
                  testID="co-teaching-toggle"
                  value={!!settings.allowCoTeaching}
                  onValueChange={toggleCoTeaching}
                  disabled={busySettings}
                  trackColor={{ true: theme.colors.brandPrimary, false: theme.colors.border }}
                />
              </View>

              <View style={styles.filters}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="All sessions" active={!afSession} onPress={() => setAfSession('')} />
                  {sessions.map(s => (
                    <ChipBtn key={s.id} label={s.name} active={afSession === s.id} onPress={() => setAfSession(s.id)} testID={`assign-filter-session-${s.name}`} />
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="All faculty" active={!afFaculty} onPress={() => setAfFaculty('')} />
                  {faculty.map(f => (
                    <ChipBtn key={f.id} label={f.name} active={afFaculty === f.id} onPress={() => setAfFaculty(f.id)} testID={`assign-filter-faculty-${f.id}`} />
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="All subjects" active={!afSubject} onPress={() => setAfSubject('')} />
                  {subjects.slice(0, 60).map(s => (
                    <ChipBtn key={s.id} label={s.code} active={afSubject === s.id} onPress={() => setAfSubject(s.id)} testID={`assign-filter-subject-${s.code}`} />
                  ))}
                </ScrollView>
              </View>

              <ScrollView
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
              >
                {notice ? (
                  <Pressable onPress={() => setNotice('')} style={styles.notice}>
                    <Text style={styles.noticeTxt}>{notice}</Text>
                    <X size={14} color={theme.colors.muted} />
                  </Pressable>
                ) : null}
                {assignments.length === 0 && (
                  <EmptyState
                    title="No assignments yet"
                    sub="Assign faculty to a subject and section"
                    actionLabel="Assign faculty"
                    onAction={() => openAssignment(null)}
                  />
                )}
                {assignments.map(a => {
                  const prog = programName(a.program_id);
                  const br = branchCode(a.branch_id);
                  const sess = sessionName(a.session_id);
                  return (
                    <Card key={a.id} style={styles.rowCard}>
                      <View style={styles.rowMain}>
                        <View style={styles.codeBadge}>
                          <Text style={styles.codeBadgeTxt}>{a.course_code || '—'}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowTitle} numberOfLines={2}>{a.course_name || 'Unknown subject'}</Text>
                          <Text style={styles.meta} numberOfLines={2}>
                            {[sess, prog, br, a.year ? `Year ${a.year}` : null, a.semester ? `Sem ${a.semester}` : null, a.section_name ? `Section ${a.section_name}` : null]
                              .filter(Boolean).join(' · ')}
                          </Text>
                          <Text style={styles.facultyTxt}>{a.faculty_name || 'Unknown faculty'}</Text>
                        </View>
                        <BadgePill label={a.active ? 'Active' : 'Off'} variant={a.active ? 'success' : 'neutral'} size="sm" />
                      </View>
                      <View style={styles.rowActions}>
                        <Pressable testID={`assignment-edit-${a.id}`} onPress={() => openAssignment(a)} style={styles.miniBtn}>
                          <Pencil size={13} color={theme.colors.muted} />
                          <Text style={[styles.miniTxt, { color: theme.colors.muted }]}>Edit</Text>
                        </Pressable>
                        {a.active && (
                          <Pressable
                            testID={`assignment-deactivate-${a.id}`}
                            onPress={() => deactivateAssignment(a)}
                            style={styles.miniBtn}
                          >
                            <Text style={[styles.miniTxt, confirmDeactivate === a.id && { color: theme.colors.error }]}>
                              {confirmDeactivate === a.id ? 'Tap again to deactivate' : 'Deactivate'}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </Card>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <>
              <View style={styles.filters}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="All sessions" active={!sfSession} onPress={() => setFilter(setSfSession, '')} />
                  {sessions.map(s => (
                    <ChipBtn key={s.id} label={s.name} active={sfSession === s.id} onPress={() => setFilter(setSfSession, s.id)} testID={`roster-filter-session-${s.name}`} />
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="All programmes" active={!sfProgram} onPress={() => { setFilter(setSfProgram, ''); setSfBranch(''); setSfSection(''); }} />
                  {programs.map(p => (
                    <ChipBtn key={p.id} label={p.name} active={sfProgram === p.id} onPress={() => { setFilter(setSfProgram, p.id); setSfBranch(''); setSfSection(''); }} testID={`roster-filter-program-${p.code}`} />
                  ))}
                </ScrollView>
                {sfProgram && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    <ChipBtn label="All branches" active={!sfBranch} onPress={() => { setFilter(setSfBranch, ''); setSfSection(''); }} />
                    {branches.filter(b => b.program_id === sfProgram).map(b => (
                      <ChipBtn key={b.id} label={b.code} active={sfBranch === b.id} onPress={() => { setFilter(setSfBranch, b.id); setSfSection(''); }} />
                    ))}
                  </ScrollView>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="Any year" active={!sfYear} onPress={() => setFilter(setSfYear, '')} />
                  {range(1, programs.find(p => p.id === sfProgram)?.duration_years || 6).map(y => (
                    <ChipBtn key={y} label={`Year ${y}`} active={sfYear === String(y)} onPress={() => setFilter(setSfYear, String(y))} />
                  ))}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  <ChipBtn label="Any semester" active={!sfSem} onPress={() => setFilter(setSfSem, '')} />
                  {range(1, programs.find(p => p.id === sfProgram)?.total_semesters || 8).map(sm => (
                    <ChipBtn key={sm} label={`Sem ${sm}`} active={sfSem === String(sm)} onPress={() => setFilter(setSfSem, String(sm))} />
                  ))}
                </ScrollView>
                {sfProgram && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                    <ChipBtn label="All sections" active={!sfSection} onPress={() => setFilter(setSfSection, '')} />
                    {sections.filter(s => s.active !== false && s.program_id === sfProgram && (!sfBranch || !s.branch_id || s.branch_id === sfBranch) && (!sfYear || String(s.year) === sfYear)).map(s => (
                      <ChipBtn key={s.id} label={s.name} active={sfSection === s.id} onPress={() => setFilter(setSfSection, s.id)} />
                    ))}
                  </ScrollView>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {STATUS_TABS.map(st => (
                    <ChipBtn key={st.key} label={st.label} active={sfStatus === st.key} onPress={() => setFilter(setSfStatus, st.key)} testID={`roster-status-${st.key}`} />
                  ))}
                </ScrollView>
                <SearchBar value={sq} onChangeText={(v: string) => setFilter(setSq, v)} placeholder="Search student name or roll number..." />
                <View style={styles.toolbar}>
                  <Pressable testID="roster-enroll" onPress={openEnroll} style={styles.toolBtn}>
                    <Plus size={14} color={theme.colors.brandPrimary} />
                    <Text style={styles.toolTxt}>Enroll</Text>
                  </Pressable>
                  <Pressable testID="roster-subjects" onPress={openSubjectRoster} style={styles.toolBtn}>
                    <BookOpen size={14} color={theme.colors.brandPrimary} />
                    <Text style={styles.toolTxt}>Subject roster</Text>
                  </Pressable>
                  <Pressable testID="roster-promote" onPress={openPromote} style={styles.toolBtn}>
                    <GraduationCap size={14} color={theme.colors.brandPrimary} />
                    <Text style={styles.toolTxt}>Promote</Text>
                  </Pressable>
                </View>
              </View>

              <ScrollView
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
              >
                {notice ? (
                  <Pressable onPress={() => setNotice('')} style={styles.notice}>
                    <Text style={styles.noticeTxt}>{notice}</Text>
                    <X size={14} color={theme.colors.muted} />
                  </Pressable>
                ) : null}
                {roster.length === 0 && (
                  <EmptyState
                    title="No students match"
                    sub="Adjust the filters, or enroll students into this class"
                    actionLabel="Enroll students"
                    onAction={openEnroll}
                  />
                )}
                {roster.map(r => (
                  <Card key={r.id} style={styles.rowCard}>
                    <View style={styles.rowMain}>
                      <View style={[styles.iconBox, { backgroundColor: theme.colors.surfaceTertiary }]}>
                        <Users size={16} color={theme.colors.muted} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{r.student_name}</Text>
                        <Text style={styles.meta} numberOfLines={1}>
                          {[r.student_code, r.section_name ? `Section ${r.section_name}` : null, `Year ${r.year}`, `Sem ${r.semester}`]
                            .filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <BadgePill
                        label={r.status === 'active' ? 'Active' : r.status === 'promoted' ? 'Promoted' : 'Withdrawn'}
                        variant={r.status === 'active' ? 'success' : r.status === 'promoted' ? 'info' : 'neutral'}
                        size="sm"
                      />
                    </View>
                    {r.status === 'active' && (
                      <View style={styles.rowActions}>
                        <Pressable
                          testID={`withdraw-${r.student_id}`}
                          onPress={() => withdraw(r)}
                          style={styles.miniBtn}
                        >
                          <Text style={[styles.miniTxt, confirmWithdraw === r.id && { color: theme.colors.error }]}>
                            {confirmWithdraw === r.id ? 'Tap again to withdraw' : 'Withdraw'}
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </Card>
                ))}

                {rosterTotal > 0 && (
                  <View style={styles.pager}>
                    <Pressable
                      testID="pager-prev"
                      onPress={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      style={[styles.pagerBtn, page <= 1 && styles.pagerBtnOff]}
                    >
                      <Text style={[styles.pagerTxt, page <= 1 && styles.pagerTxtOff]}>‹ Prev</Text>
                    </Pressable>
                    <Text style={styles.pagerInfo}>Page {page} of {totalPages} · {rosterTotal} students</Text>
                    <Pressable
                      testID="pager-next"
                      onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnOff]}
                    >
                      <Text style={[styles.pagerTxt, page >= totalPages && styles.pagerTxtOff]}>Next ›</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </AsyncView>

        <Pressable
          testID="enrollment-fab"
          accessibilityLabel={tab === 'assignments' ? 'Assign faculty' : 'Enroll students'}
          onPress={() => (tab === 'assignments' ? openAssignment(null) : openEnroll())}
          style={styles.fab}
        >
          <Plus color={theme.colors.onBrandPrimary} size={26} />
        </Pressable>

        {/* Assignment sheet */}
        <Modal visible={aSheet} transparent animationType="slide" onRequestClose={() => setASheet(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{aEdit ? 'Edit Assignment' : 'Assign Faculty'}</Text>
                <Pressable testID="assignment-close" onPress={() => setASheet(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {!aEdit && (
                  <>
                    <Text style={styles.label}>Academic session</Text>
                    <View style={styles.chipRow}>
                      {sessions.map(s => (
                        <ChipBtn key={s.id} label={s.name} active={af2.session_id === s.id} onPress={() => setAf2(p => ({ ...p, session_id: s.id }))} testID={`assign-session-${s.name}`} />
                      ))}
                      {sessions.length === 0 && <Text style={styles.hint}>Create a session in Academic Structure first.</Text>}
                    </View>

                    <Text style={styles.label}>Programme</Text>
                    <View style={styles.chipRow}>
                      {programs.map(p => (
                        <ChipBtn key={p.id} label={p.name} active={af2.program_id === p.id} onPress={() => setAf2(prev => ({ ...prev, program_id: p.id, branch_id: '', course_id: '', section_id: '' }))} testID={`assign-program-${p.code}`} />
                      ))}
                    </View>

                    {sheetProgram && (
                      <>
                        <Text style={styles.label}>Branch (optional)</Text>
                        <View style={styles.chipRow}>
                          <ChipBtn label="All branches" active={!af2.branch_id} onPress={() => setAf2(p => ({ ...p, branch_id: '', course_id: '', section_id: '' }))} />
                          {branches.filter(b => b.program_id === af2.program_id).map(b => (
                            <ChipBtn key={b.id} label={b.code} active={af2.branch_id === b.id} onPress={() => setAf2(p => ({ ...p, branch_id: b.id, course_id: '', section_id: '' }))} testID={`assign-branch-${b.code}`} />
                          ))}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Year</Text>
                            <TextInput
                              testID="assign-year"
                              value={af2.year}
                              onChangeText={v => setAf2(p => ({ ...p, year: v, course_id: '', section_id: '' }))}
                              keyboardType="number-pad"
                              placeholder="2"
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.label}>Semester</Text>
                            <TextInput
                              testID="assign-semester"
                              value={af2.semester}
                              onChangeText={v => setAf2(p => ({ ...p, semester: v, course_id: '', section_id: '' }))}
                              keyboardType="number-pad"
                              placeholder="3"
                              placeholderTextColor={theme.colors.muted}
                              style={styles.input}
                            />
                          </View>
                        </View>
                      </>
                    )}

                    <Text style={styles.label}>Subject</Text>
                    <View style={styles.chipRow}>
                      {sheetSubjects.slice(0, 80).map(s => (
                        <ChipBtn key={s.id} label={`${s.code} · ${s.name}`} active={af2.course_id === s.id} onPress={() => setAf2(p => ({ ...p, course_id: s.id }))} testID={`assign-subject-${s.code}`} />
                      ))}
                      {sheetSubjects.length === 0 && <Text style={styles.hint}>No active subjects match — add one in Academic Structure.</Text>}
                    </View>
                  </>
                )}

                <Text style={styles.label}>Faculty</Text>
                <View style={styles.chipRow}>
                  {faculty.map(f => (
                    <ChipBtn key={f.id} label={f.name} active={af2.faculty_id === f.id} onPress={() => setAf2(p => ({ ...p, faculty_id: f.id }))} testID={`assign-faculty-${f.id}`} />
                  ))}
                  {faculty.length === 0 && <Text style={styles.hint}>No faculty accounts yet.</Text>}
                </View>

                <Text style={styles.label}>Section (optional)</Text>
                <View style={styles.chipRow}>
                  <ChipBtn label="No section" active={!af2.section_id} onPress={() => setAf2(p => ({ ...p, section_id: '' }))} />
                  {sheetSections.map(s => (
                    <ChipBtn key={s.id} label={s.name} active={af2.section_id === s.id} onPress={() => setAf2(p => ({ ...p, section_id: s.id }))} testID={`assign-section-${s.name}`} />
                  ))}
                </View>

                {aErr ? <Text style={styles.err}>{aErr}</Text> : null}
                <Pressable testID="assignment-save" onPress={saveAssignment} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>{aEdit ? 'Save Changes' : 'Assign Faculty'}</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Enroll students sheet */}
        <Modal visible={eSheet} transparent animationType="slide" onRequestClose={() => setESheet(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Enroll Students</Text>
                <Pressable testID="enroll-close" onPress={() => setESheet(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Academic session</Text>
                <View style={styles.chipRow}>
                  {sessions.map(s => (
                    <ChipBtn key={s.id} label={s.name} active={ef.session_id === s.id} onPress={() => setEf(p => ({ ...p, session_id: s.id }))} testID={`enroll-session-${s.name}`} />
                  ))}
                </View>

                <Text style={styles.label}>Programme</Text>
                <View style={styles.chipRow}>
                  {programs.map(p => (
                    <ChipBtn key={p.id} label={p.name} active={ef.program_id === p.id} onPress={() => setEf(prev => ({ ...prev, program_id: p.id, branch_id: '', section_id: '' }))} testID={`enroll-program-${p.code}`} />
                  ))}
                  {programs.length === 0 && <Text style={styles.hint}>Create a programme in Academic Structure first.</Text>}
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Year</Text>
                    <TextInput
                      testID="enroll-year"
                      value={ef.year}
                      onChangeText={v => setEf(p => ({ ...p, year: v }))}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Semester</Text>
                    <TextInput
                      testID="enroll-semester"
                      value={ef.semester}
                      onChangeText={v => setEf(p => ({ ...p, semester: v }))}
                      keyboardType="number-pad"
                      placeholder="1"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                </View>

                <Text style={styles.label}>Section (optional)</Text>
                <View style={styles.chipRow}>
                  <ChipBtn label="No section" active={!ef.section_id} onPress={() => setEf(p => ({ ...p, section_id: '' }))} />
                  {enrollSheetSections.map(s => (
                    <ChipBtn key={s.id} label={s.name} active={ef.section_id === s.id} onPress={() => setEf(p => ({ ...p, section_id: s.id }))} testID={`enroll-section-${s.name}`} />
                  ))}
                </View>

                <Text style={styles.label}>Students ({eSel.length} selected)</Text>
                <SearchBar value={eq} onChangeText={setEq} placeholder="Search students..." />
                <View style={styles.chipRow}>
                  <ChipBtn label="Select all shown" active={false} onPress={() => setESel(prev => [...new Set([...prev, ...filteredStudents.map(s => s.id)])])} testID="enroll-select-all" />
                  <ChipBtn label="Clear" active={false} onPress={() => setESel([])} />
                </View>
                <View style={styles.chipRow}>
                  {filteredStudents.slice(0, 200).map(s => {
                    const on = eSel.includes(s.id);
                    return (
                      <ChipBtn
                        key={s.id}
                        label={s.studentCode ? `${s.name} (${s.studentCode})` : s.name}
                        active={on}
                        onPress={() => setESel(prev => (on ? prev.filter(x => x !== s.id) : [...prev, s.id]))}
                        testID={`enroll-student-${s.id}`}
                      />
                    );
                  })}
                  {allStudents.length === 0 && <Text style={styles.hint}>No student accounts found in this college.</Text>}
                </View>

                {eErr ? <Text style={styles.err}>{eErr}</Text> : null}
                <Pressable testID="enroll-save" onPress={saveEnroll} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>Enroll {eSel.length || ''} Student{eSel.length === 1 ? '' : 's'}</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Subject roster sheet */}
        <Modal visible={sbSheet} transparent animationType="slide" onRequestClose={() => setSbSheet(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Build Subject Roster</Text>
                <Pressable testID="subject-roster-close" onPress={() => setSbSheet(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.confirmTxt}>
                  Enroll every active student of the filtered class into every active subject of that
                  year and semester. Existing links are skipped — nothing is overwritten.
                </Text>
                <Card style={styles.summaryCard}>
                  <Text style={styles.meta}>Programme: {programs.find(p => p.id === sfProgram)?.name || 'not selected'}</Text>
                  <Text style={styles.meta}>Year {sfYear || '?'} · Semester {sfSem || '?'}{sfBranch ? ` · ${branchCode(sfBranch) || ''}` : ''}{sfSection ? ` · Section ${sections.find(s => s.id === sfSection)?.name || ''}` : ''}</Text>
                  <Text style={styles.meta}>Subjects that will be linked: {matchingSubjects.length}</Text>
                  <Text style={styles.meta}>Students currently in this class: {rosterTotal}</Text>
                </Card>
                {sbErr ? <Text style={styles.err}>{sbErr}</Text> : null}
                <Pressable testID="subject-roster-save" onPress={saveSubjectRoster} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>Build Roster</Text>}
                </Pressable>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Promote sheet */}
        <Modal visible={pSheet} transparent animationType="slide" onRequestClose={() => setPSheet(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Promote Students</Text>
                <Pressable testID="promote-close" onPress={() => setPSheet(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.confirmTxt}>
                  Promotion keeps the previous enrollment as history — it is marked “promoted”, never
                  edited or deleted.
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Target year</Text>
                    <TextInput
                      testID="promote-year"
                      value={pf.to_year}
                      onChangeText={v => setPf(p => ({ ...p, to_year: v }))}
                      keyboardType="number-pad"
                      placeholder="3"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Target semester</Text>
                    <TextInput
                      testID="promote-semester"
                      value={pf.to_semester}
                      onChangeText={v => setPf(p => ({ ...p, to_semester: v }))}
                      keyboardType="number-pad"
                      placeholder="5"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                    />
                  </View>
                </View>

                <Text style={styles.label}>Target section (optional)</Text>
                <View style={styles.chipRow}>
                  <ChipBtn label="No section" active={!pf.to_section_id} onPress={() => setPf(p => ({ ...p, to_section_id: '' }))} />
                  {promoteSections.map(s => (
                    <ChipBtn key={s.id} label={s.name} active={pf.to_section_id === s.id} onPress={() => setPf(p => ({ ...p, to_section_id: s.id }))} testID={`promote-section-${s.name}`} />
                  ))}
                </View>

                <Text style={styles.label}>Students on this page ({pSel.length} selected)</Text>
                <View style={styles.chipRow}>
                  <ChipBtn label="Select all" active={false} onPress={() => setPSel(roster.map(r => r.student_id))} testID="promote-select-all" />
                  <ChipBtn label="Clear" active={false} onPress={() => setPSel([])} />
                </View>
                <View style={styles.chipRow}>
                  {roster.map(r => {
                    const on = pSel.includes(r.student_id);
                    return (
                      <ChipBtn
                        key={r.id}
                        label={r.student_code ? `${r.student_name} (${r.student_code})` : r.student_name}
                        active={on}
                        onPress={() => setPSel(prev => (on ? prev.filter(x => x !== r.student_id) : [...prev, r.student_id]))}
                        testID={`promote-student-${r.student_id}`}
                      />
                    );
                  })}
                </View>

                {pErr ? <Text style={styles.err}>{pErr}</Text> : null}
                <Pressable testID="promote-save" onPress={savePromote} disabled={busy} style={styles.cta}>
                  {busy ? <ActivityIndicator color={theme.colors.onBrandPrimary} /> : <Text style={styles.ctaTxt}>Promote {pSel.length || ''} Student{pSel.length === 1 ? '' : 's'}</Text>}
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

const styles = StyleSheet.create({
  list: { padding: theme.spacing.lg, gap: 10, paddingBottom: 120 },
  rowCard: { padding: theme.spacing.md },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowActions: { flexDirection: 'row', gap: 14, marginTop: 10, marginLeft: 48 },
  rowTitle: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 14 },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  hint: { color: theme.colors.muted, fontSize: 12, fontStyle: 'italic' },
  facultyTxt: { color: theme.colors.brand, fontSize: 12, fontWeight: '700', marginTop: 3 },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  codeBadge: {
    paddingHorizontal: 8, paddingVertical: 6, borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceTertiary, borderWidth: 1, borderColor: theme.colors.border,
  },
  codeBadgeTxt: { fontSize: 11, fontWeight: '800', color: theme.colors.onSurfaceTertiary, letterSpacing: 0.3 },
  miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.muted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  filters: { paddingHorizontal: theme.spacing.lg, gap: 6, paddingBottom: 4 },
  policyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: theme.spacing.lg,
    marginTop: 6, padding: theme.spacing.md, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border,
  },
  policyTitle: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 13 },
  policySub: { color: theme.colors.muted, fontSize: 11, marginTop: 1 },
  toolbar: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 2, flexWrap: 'wrap' },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandTertiary,
    borderWidth: 1, borderColor: theme.colors.brandPrimary,
  },
  toolTxt: { fontSize: 12, fontWeight: '700', color: theme.colors.brand },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandTertiary, borderWidth: 1, borderColor: theme.colors.brandPrimary,
  },
  noticeTxt: { flex: 1, color: theme.colors.onSurface, fontSize: 12, fontWeight: '600' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 8 },
  pagerBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  pagerBtnOff: { opacity: 0.4 },
  pagerTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  pagerTxtOff: { color: theme.colors.muted },
  pagerInfo: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center',
    ...theme.shadow.md,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: theme.spacing.xl, maxHeight: '85%',
  },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: 13, fontSize: 15, color: theme.colors.onSurface,
  },
  confirmTxt: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  summaryCard: { marginTop: 12, padding: theme.spacing.md },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  cta: {
    backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md,
    marginTop: theme.spacing.lg, alignItems: 'center',
  },
  ctaTxt: { color: theme.colors.onBrandPrimary, fontWeight: '700', fontSize: 15 },
});
