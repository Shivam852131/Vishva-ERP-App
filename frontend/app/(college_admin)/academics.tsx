import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus, X, Trash2, BookOpen, Clock, Calendar, Users, MapPin,
  Copy, CheckCircle, AlertTriangle, ChevronRight, Search, Filter,
  ArrowUpDown, Eye, Pencil, Zap,
} from 'lucide-react-native';
import type { Course, TimetableSlot } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { ChipBtn, EmptyState, AsyncView, StatCard, Card, ProgressBar } from '@/src/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
];

const COURSE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16'];

export default function Academics() {
  const [tab, setTab] = useState<'courses' | 'timetable' | 'analytics'>('courses');
  const [refreshing, setRefreshing] = useState(false);
  const [day, setDay] = useState('Mon');
  const [confirmSlot, setConfirmSlot] = useState('');
  const [q, setQ] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const { data: courses = [], loading: coursesLoading, error: coursesError, refresh: refreshCourses } = useFetch<Course[]>('/courses');
  const { data: slots = [], loading: slotsLoading, error: slotsError, refresh: refreshSlots } = useFetch<TimetableSlot[]>('/timetable');
  const { data: faculty = [], loading: facultyLoading, refresh: refreshFaculty } = useFetch<any[]>('/admin/users?role=faculty');
  const { mutate: saveCourseApi, loading: cBusy } = useMutate();
  const { mutate: deleteCourseApi } = useMutate();
  const { mutate: saveSlotApi, loading: sBusy } = useMutate();
  const { mutate: deleteSlotApi } = useMutate();

  const reloadAll = useCallback(() => {
    refreshCourses();
    refreshSlots();
    refreshFaculty();
  }, [refreshCourses, refreshSlots, refreshFaculty]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reloadAll();
    setTimeout(() => setRefreshing(false), 1500);
  }, [reloadAll]);

  const loading = coursesLoading || slotsLoading || facultyLoading;

  const [cModal, setCModal] = useState(false);
  const [cEdit, setCEdit] = useState<Course | null>(null);
  const [cf, setCf] = useState({ code: '', name: '', credits: '3', faculty_id: '' });
  const [cErr, setCErr] = useState('');
  const [cDel, setCDel] = useState(false);

  const [sModal, setSModal] = useState(false);
  const [sf, setSf] = useState({ day: 'Mon', start: '09:00', end: '10:00', course_id: '', room: '' });
  const [sErr, setSErr] = useState('');
  const [editSlot, setEditSlot] = useState<TimetableSlot | null>(null);

  const [dupModal, setDupModal] = useState(false);
  const [dupSource, setDupSource] = useState('');
  const [dupTarget, setDupTarget] = useState('');

  const stats = useMemo(() => {
    const totalSlots = slots.length;
    const byDay: Record<string, number> = {};
    ALL_DAYS.forEach(d => { byDay[d] = 0; });
    slots.forEach(s => { byDay[s.day] = (byDay[s.day] || 0) + 1; });
    const uniqueCourses = new Set(slots.map(s => s.course_id)).size;
    const hoursPerWeek = slots.reduce((acc, s) => {
      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = s.end.split(':').map(Number);
      return acc + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    }, 0);
    return { totalSlots, byDay, uniqueCourses, hoursPerWeek: Math.round(hoursPerWeek) };
  }, [slots]);

  const courseStats = useMemo(() => {
    return courses.map(c => {
      const courseSlots = slots.filter(s => s.course_id === c.id);
      const hours = courseSlots.reduce((acc, s) => {
        const [sh, sm] = s.start.split(':').map(Number);
        const [eh, em] = s.end.split(':').map(Number);
        return acc + ((eh * 60 + em) - (sh * 60 + sm)) / 60;
      }, 0);
      return { ...c, slotCount: courseSlots.length, hours: Math.round(hours), color: c.color || COURSE_COLORS[courses.indexOf(c) % COURSE_COLORS.length] };
    });
  }, [courses, slots]);

  const filteredCourses = useMemo(() => {
    if (!q) return courseStats;
    return courseStats.filter(c =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.code.toLowerCase().includes(q.toLowerCase())
    );
  }, [courseStats, q]);

  const openCourse = (c: Course | null) => {
    setCEdit(c);
    setCf(c
      ? { code: c.code, name: c.name, credits: String(c.credits || 3), faculty_id: c.faculty_id || '' }
      : { code: '', name: '', credits: '3', faculty_id: '' });
    setCErr('');
    setCDel(false);
    setCModal(true);
  };

  const saveCourse = async () => {
    if (!cf.code.trim() || !cf.name.trim()) { setCErr('Code and name are required'); return; }
    setCErr('');
    try {
      const body = JSON.stringify({
        code: cf.code.trim(),
        name: cf.name.trim(),
        credits: parseInt(cf.credits, 10) || 3,
        faculty_id: cf.faculty_id || null,
      });
      if (cEdit) await saveCourseApi(`/courses/${cEdit.id}`, { method: 'PUT', body });
      else await saveCourseApi('/courses', { method: 'POST', body });
      setCModal(false);
      reloadAll();
    } catch (e: any) { setCErr(e.message); }
  };

  const deleteCourse = async () => {
    if (!cDel) { setCDel(true); return; }
    setCErr('');
    try {
      await deleteCourseApi(`/courses/${cEdit!.id}`, { method: 'DELETE' });
      setCModal(false);
      reloadAll();
    } catch (e: any) { setCErr(e.message); setCDel(false); }
  };

  const openSlot = (slot?: TimetableSlot) => {
    if (slot) {
      setEditSlot(slot);
      setSf({ day: slot.day, start: slot.start, end: slot.end, course_id: slot.course_id, room: slot.room || '' });
    } else {
      setEditSlot(null);
      setSf({ day, start: '09:00', end: '10:00', course_id: courses[0]?.id || '', room: '' });
    }
    setSErr('');
    setSModal(true);
  };

  const saveSlot = async () => {
    if (!sf.course_id) { setSErr('Pick a course'); return; }
    if (!/^\d{2}:\d{2}$/.test(sf.start) || !/^\d{2}:\d{2}$/.test(sf.end)) { setSErr('Time must be HH:MM (e.g. 09:00)'); return; }
    if (sf.start >= sf.end) { setSErr('End time must be after start time'); return; }
    setSErr('');
    try {
      const body = JSON.stringify({
        courseId: sf.course_id,
        dayOfWeek: sf.day,
        startTime: sf.start,
        endTime: sf.end,
        room: sf.room,
      });
      if (editSlot) {
        await saveSlotApi(`/timetable/${editSlot.id}`, { method: 'PUT', body });
      } else {
        await saveSlotApi('/timetable', { method: 'POST', body });
      }
      setSModal(false);
      reloadAll();
    } catch (e: any) { setSErr(e.message); }
  };

  const deleteSlot = async (id: string) => {
    if (confirmSlot !== id) { setConfirmSlot(id); return; }
    try { await deleteSlotApi(`/timetable/${id}`, { method: 'DELETE' }); setConfirmSlot(''); reloadAll(); }
    catch (e) { console.log(e); }
  };

  const duplicateDay = () => {
    if (!dupSource || !dupTarget) { Alert.alert('Error', 'Select source and target days'); return; }
    const sourceSlots = slots.filter(s => s.day === dupSource);
    if (sourceSlots.length === 0) { Alert.alert('No slots', `No slots found for ${dupSource}`); return; }
    Alert.alert(
      'Duplicate Schedule',
      `Copy ${sourceSlots.length} slot(s) from ${dupSource} to ${dupTarget}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Copy',
          onPress: async () => {
            try {
              for (const slot of sourceSlots) {
                await saveSlotApi('/timetable', {
                  method: 'POST',
                  body: JSON.stringify({
                    courseId: slot.course_id,
                    dayOfWeek: dupTarget,
                    startTime: slot.start,
                    endTime: slot.end,
                    room: slot.room,
                  }),
                });
              }
              setDupModal(false);
              reloadAll();
              Alert.alert('Done', `${sourceSlots.length} slot(s) copied to ${dupTarget}`);
            } catch (e: any) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  const daySlots = useMemo(() =>
    slots.filter(s => s.day === day).sort((a, b) => a.start.localeCompare(b.start)),
    [slots, day]
  );

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={{ padding: theme.spacing.lg, paddingBottom: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.h1}>Academics</Text>
              <Text style={styles.sub}>Manage courses & class schedule</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {tab === 'timetable' && (
                <Pressable onPress={() => setDupModal(true)} style={styles.iconBtn}>
                  <Copy color={theme.colors.brand} size={18} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statMini}>
              <Text style={styles.statMiniVal}>{courses.length}</Text>
              <Text style={styles.statMiniLabel}>Courses</Text>
            </View>
            <View style={styles.statMini}>
              <Text style={styles.statMiniVal}>{stats.totalSlots}</Text>
              <Text style={styles.statMiniLabel}>Slots</Text>
            </View>
            <View style={styles.statMini}>
              <Text style={styles.statMiniVal}>{stats.hoursPerWeek}h</Text>
              <Text style={styles.statMiniLabel}>Weekly</Text>
            </View>
            <View style={styles.statMini}>
              <Text style={styles.statMiniVal}>{faculty.length}</Text>
              <Text style={styles.statMiniLabel}>Faculty</Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <Pressable
              testID="tab-courses"
              onPress={() => setTab('courses')}
              style={[styles.tabBtn, tab === 'courses' && styles.tabActive]}
            >
              <BookOpen color={tab === 'courses' ? '#fff' : theme.colors.muted} size={15} />
              <Text style={[styles.tabTxt, tab === 'courses' && styles.tabTxtActive]}>Courses</Text>
            </Pressable>
            <Pressable
              testID="tab-timetable"
              onPress={() => setTab('timetable')}
              style={[styles.tabBtn, tab === 'timetable' && styles.tabActive]}
            >
              <Clock color={tab === 'timetable' ? '#fff' : theme.colors.muted} size={15} />
              <Text style={[styles.tabTxt, tab === 'timetable' && styles.tabTxtActive]}>Timetable</Text>
            </Pressable>
            <Pressable
              testID="tab-analytics"
              onPress={() => setTab('analytics')}
              style={[styles.tabBtn, tab === 'analytics' && styles.tabActive]}
            >
              <Zap color={tab === 'analytics' ? '#fff' : theme.colors.muted} size={15} />
              <Text style={[styles.tabTxt, tab === 'analytics' && styles.tabTxtActive]}>Analytics</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : tab === 'courses' ? (
          <>
            {/* Search */}
            <View style={styles.searchBox}>
              <Search color={theme.colors.muted} size={18} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search courses..."
                placeholderTextColor={theme.colors.muted}
                style={styles.searchInput}
              />
              {q ? <Pressable onPress={() => setQ('')}><X color={theme.colors.muted} size={16} /></Pressable> : null}
            </View>
            <ScrollView
              contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 120 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
            >
              {filteredCourses.length === 0 && <EmptyState title="No courses" sub="Tap + to add your first course" />}
              {filteredCourses.map(c => (
                <Pressable
                  key={c.id}
                  testID={`course-${c.code}`}
                  onPress={() => openCourse(c)}
                  style={styles.courseCard}
                >
                  <View style={[styles.courseBar, { backgroundColor: c.color || theme.colors.brandPrimary }]} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.courseName}>{c.name}</Text>
                      <View style={[styles.slotBadge, { backgroundColor: (c.color || theme.colors.brandPrimary) + '15' }]}>
                        <Text style={[styles.slotBadgeTxt, { color: c.color || theme.colors.brandPrimary }]}>{c.slotCount} slots</Text>
                      </View>
                    </View>
                    <Text style={styles.meta}>
                      {c.code} · {c.credits} credits · {c.hours}h/week
                    </Text>
                    <Text style={styles.meta}>
                      {c.faculty_name || 'No faculty assigned'}
                    </Text>
                  </View>
                  <ChevronRight color={theme.colors.muted} size={16} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : tab === 'timetable' ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 52, marginTop: 10 }}
              contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg, alignItems: 'center' }}
            >
              {DAYS.map(d => (
                <ChipBtn
                  key={d}
                  testID={`day-${d}`}
                  label={`${d} (${stats.byDay[d] || 0})`}
                  active={day === d}
                  onPress={() => { setDay(d); setConfirmSlot(''); }}
                />
              ))}
            </ScrollView>
            <ScrollView
              contentContainerStyle={{ padding: theme.spacing.lg, gap: 8, paddingBottom: 120 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
            >
              {daySlots.length === 0 && <EmptyState title={`No classes on ${day}`} sub="Tap + to schedule a class" />}
              {daySlots.map(s => {
                const course = courses.find(c => c.id === s.course_id);
                const color = course?.color || COURSE_COLORS[0];
                return (
                  <Pressable key={s.id} onPress={() => openSlot(s)}>
                    <View key={s.id} style={styles.slotRow}>
                      <View style={[styles.timeBox, { backgroundColor: color + '10' }]}>
                        <Text style={[styles.timeTxt, { color }]}>{s.start}</Text>
                        <Text style={[styles.timeTxt, { color: theme.colors.muted, fontSize: 10 }]}>{s.end}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.courseName}>{s.course_name}</Text>
                        <Text style={styles.meta}>
                          {s.course_code} · {s.room || 'TBA'}{s.faculty_name ? ` · ${s.faculty_name}` : ''}
                        </Text>
                      </View>
                      <Pressable
                        testID={`slot-del-${s.id}`}
                        onPress={() => deleteSlot(s.id)}
                        style={[styles.slotDel, confirmSlot === s.id && { backgroundColor: theme.colors.error }]}
                      >
                        <Trash2 color={confirmSlot === s.id ? '#fff' : theme.colors.error} size={15} />
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          /* Analytics Tab */
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          >
            <SectionTitle title="Course Analytics" />
            {courseStats.map(c => (
              <Card key={c.id} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courseName}>{c.name}</Text>
                    <Text style={styles.meta}>{c.code} · {c.credits} credits</Text>
                  </View>
                  <View style={[styles.slotBadge, { backgroundColor: (c.color || theme.colors.brandPrimary) + '15' }]}>
                    <Text style={[styles.slotBadgeTxt, { color: c.color || theme.colors.brandPrimary }]}>{c.slotCount} slots</Text>
                  </View>
                </View>
                <ProgressBar
                  value={c.hours}
                  max={Math.max(...courseStats.map(cs => cs.hours), 1)}
                  label={`${c.hours}h/week`}
                  showPct
                  color={c.color || theme.colors.brandPrimary}
                  style={{ marginTop: 8 }}
                />
              </Card>
            ))}
            {courseStats.length === 0 && <EmptyState title="No course data" sub="Add courses to see analytics" />}

            <SectionTitle title="Weekly Overview" />
            <Card>
              {ALL_DAYS.filter(d => DAYS.includes(d)).map(d => (
                <View key={d} style={styles.weekRow}>
                  <Text style={styles.weekDay}>{d}</Text>
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <ProgressBar
                      value={stats.byDay[d] || 0}
                      max={Math.max(...Object.values(stats.byDay), 1)}
                      height={6}
                      color={d === day ? theme.colors.brandPrimary : theme.colors.muted}
                    />
                  </View>
                  <Text style={styles.weekCount}>{stats.byDay[d] || 0}</Text>
                </View>
              ))}
            </Card>
          </ScrollView>
        )}

        <Pressable
          testID="academics-fab"
          accessibilityLabel={tab === 'courses' ? 'Add course' : 'Schedule class'}
          onPress={() => (tab === 'courses' ? openCourse(null) : openSlot())}
          style={styles.fab}
        >
          <Plus color="#fff" size={26} />
        </Pressable>

        {/* Course Modal */}
        <Modal visible={cModal} transparent animationType="slide" onRequestClose={() => setCModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{cEdit ? 'Edit Course' : 'Add Course'}</Text>
                <Pressable testID="course-close" onPress={() => setCModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Code</Text>
                    <TextInput testID="course-code" value={cf.code} onChangeText={v => setCf(p => ({ ...p, code: v }))} placeholder="CS305" placeholderTextColor={theme.colors.muted} style={styles.input} autoCapitalize="characters" />
                  </View>
                  <View style={{ width: 100 }}>
                    <Text style={styles.label}>Credits</Text>
                    <TextInput testID="course-credits" value={cf.credits} onChangeText={v => setCf(p => ({ ...p, credits: v }))} placeholder="3" placeholderTextColor={theme.colors.muted} style={styles.input} keyboardType="number-pad" />
                  </View>
                </View>
                <Text style={styles.label}>Course Name</Text>
                <TextInput testID="course-name" value={cf.name} onChangeText={v => setCf(p => ({ ...p, name: v }))} placeholder="Computer Networks" placeholderTextColor={theme.colors.muted} style={styles.input} />
                <Text style={styles.label}>Assign Faculty</Text>
                <View style={styles.chipWrap}>
                  {faculty.map((fx: any) => (
                    <Pressable
                      key={fx.id}
                      testID={`course-fac-${fx.id}`}
                      onPress={() => setCf(p => ({ ...p, faculty_id: p.faculty_id === fx.id ? '' : fx.id }))}
                      style={[styles.chip, cf.faculty_id === fx.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipTxt, cf.faculty_id === fx.id && styles.chipTxtActive]}>{fx.name}</Text>
                    </Pressable>
                  ))}
                  {faculty.length === 0 && <Text style={styles.meta}>No faculty accounts yet</Text>}
                </View>
                {cErr ? <Text style={styles.err}>{cErr}</Text> : null}
                <Pressable testID="course-save" onPress={saveCourse} disabled={cBusy} style={styles.cta}>
                  {cBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{cEdit ? 'Save Changes' : 'Create Course'}</Text>}
                </Pressable>
                {cEdit && (
                  <Pressable
                    testID="course-delete"
                    onPress={deleteCourse}
                    disabled={cBusy}
                    style={[styles.delBtn, cDel && { backgroundColor: theme.colors.error }]}
                  >
                    <Trash2 color={cDel ? '#fff' : theme.colors.error} size={16} />
                    <Text style={[styles.delTxt, cDel && { color: '#fff' }]}>{cDel ? 'Tap again to confirm delete' : 'Delete course'}</Text>
                  </Pressable>
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Schedule Modal */}
        <Modal visible={sModal} transparent animationType="slide" onRequestClose={() => setSModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{editSlot ? 'Edit Schedule' : 'Schedule a Class'}</Text>
                <Pressable testID="slot-close" onPress={() => setSModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.label}>Day</Text>
                <View style={styles.chipWrap}>
                  {DAYS.map(d => (
                    <Pressable
                      key={d}
                      testID={`slot-day-${d}`}
                      onPress={() => setSf(p => ({ ...p, day: d }))}
                      style={[styles.chip, sf.day === d && styles.chipActive]}
                    >
                      <Text style={[styles.chipTxt, sf.day === d && styles.chipTxtActive]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Start (HH:MM)</Text>
                    <TextInput testID="slot-start" value={sf.start} onChangeText={v => setSf(p => ({ ...p, start: v }))} placeholder="09:00" placeholderTextColor={theme.colors.muted} style={styles.input} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>End (HH:MM)</Text>
                    <TextInput testID="slot-end" value={sf.end} onChangeText={v => setSf(p => ({ ...p, end: v }))} placeholder="10:00" placeholderTextColor={theme.colors.muted} style={styles.input} />
                  </View>
                </View>
                <Text style={styles.label}>Course</Text>
                <View style={styles.chipWrap}>
                  {courses.map(c => (
                    <Pressable
                      key={c.id}
                      testID={`slot-course-${c.code}`}
                      onPress={() => setSf(p => ({ ...p, course_id: c.id }))}
                      style={[styles.chip, sf.course_id === c.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipTxt, sf.course_id === c.id && styles.chipTxtActive]}>{c.code}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.label}>Room</Text>
                <TextInput testID="slot-room" value={sf.room} onChangeText={v => setSf(p => ({ ...p, room: v }))} placeholder="Room 204" placeholderTextColor={theme.colors.muted} style={styles.input} />
                {sErr ? <Text style={styles.err}>{sErr}</Text> : null}
                <Pressable testID="slot-save" onPress={saveSlot} disabled={sBusy} style={styles.cta}>
                  {sBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{editSlot ? 'Save Changes' : 'Add to Timetable'}</Text>}
                </Pressable>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Duplicate Modal */}
        <Modal visible={dupModal} transparent animationType="slide" onRequestClose={() => setDupModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Duplicate Schedule</Text>
                <Pressable onPress={() => setDupModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <Text style={styles.label}>Copy from</Text>
              <View style={styles.chipWrap}>
                {DAYS.map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setDupSource(d)}
                    style={[styles.chip, dupSource === d && styles.chipActive]}
                  >
                    <Text style={[styles.chipTxt, dupSource === d && styles.chipTxtActive]}>{d}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Copy to</Text>
              <View style={styles.chipWrap}>
                {DAYS.map(d => (
                  <Pressable
                    key={d}
                    onPress={() => setDupTarget(d)}
                    style={[styles.chip, dupTarget === d && styles.chipActive]}
                  >
                    <Text style={[styles.chipTxt, dupTarget === d && styles.chipTxtActive]}>{d}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={duplicateDay} style={styles.cta}>
                <Text style={styles.ctaTxt}>Duplicate Schedule</Text>
              </Pressable>
              <View style={{ height: 20 }} />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={{ marginBottom: theme.spacing.md }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.onSurface }}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  statMini: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  statMiniVal: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  statMiniLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, marginTop: theme.spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brand },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 13 },
  tabTxtActive: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, margin: theme.spacing.lg, marginBottom: 0, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.onSurface },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  courseBar: { width: 5, height: 40, borderRadius: 3 },
  courseName: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 14 },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  slotBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  slotBadgeTxt: { fontSize: 10, fontWeight: '700' },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  timeBox: { alignItems: 'center', width: 48, paddingVertical: 4, borderRadius: theme.radius.sm },
  timeTxt: { fontSize: 12, fontWeight: '800', color: theme.colors.brand },
  slotDel: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: theme.colors.error, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  weekDay: { width: 30, fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  weekCount: { width: 24, fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, textAlign: 'right' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '85%' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 13, fontSize: 15, color: theme.colors.onSurface },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brandPrimary },
  chipTxt: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  chipTxtActive: { color: theme.colors.brand },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  delBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.error, marginTop: theme.spacing.md },
  delTxt: { color: theme.colors.error, fontWeight: '700', fontSize: 13 },
});
