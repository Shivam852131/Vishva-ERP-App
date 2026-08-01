import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Trash2, BookOpen, Clock } from 'lucide-react-native';
import type { Course, TimetableSlot } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { ChipBtn, EmptyState, AsyncView } from '@/src/ui';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Academics() {
  const [tab, setTab] = useState<'courses' | 'timetable'>('courses');
  const [refreshing, setRefreshing] = useState(false);
  const [day, setDay] = useState('Mon');
  const [confirmSlot, setConfirmSlot] = useState('');

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

  const openSlot = () => {
    setSf({ day, start: '09:00', end: '10:00', course_id: courses[0]?.id || '', room: '' });
    setSErr('');
    setSModal(true);
  };

  const saveSlot = async () => {
    if (!sf.course_id) { setSErr('Pick a course'); return; }
    if (!/^\d{2}:\d{2}$/.test(sf.start) || !/^\d{2}:\d{2}$/.test(sf.end)) { setSErr('Time must be HH:MM (e.g. 09:00)'); return; }
    setSErr('');
    try {
      await saveSlotApi('/timetable', { method: 'POST', body: JSON.stringify(sf) });
      setSModal(false);
      reloadAll();
    } catch (e: any) { setSErr(e.message); }
  };

  const deleteSlot = async (id: string) => {
    if (confirmSlot !== id) { setConfirmSlot(id); return; }
      try { await deleteSlotApi(`/timetable/${id}`, { method: 'DELETE' }); setConfirmSlot(''); reloadAll(); }
    catch (e) { console.log(e); }
  };

  const daySlots = slots.filter(s => s.day === day).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={{ padding: theme.spacing.lg, paddingBottom: 0 }}>
          <Text style={styles.h1}>Academics</Text>
          <Text style={styles.sub}>Manage courses & class schedule</Text>
          <View style={styles.tabs}>
            <Pressable
              testID="tab-courses"
              accessibilityLabel="Courses tab"
              onPress={() => setTab('courses')}
              style={[styles.tabBtn, tab === 'courses' && styles.tabActive]}
            >
              <BookOpen color={tab === 'courses' ? '#fff' : theme.colors.muted} size={15} />
              <Text style={[styles.tabTxt, tab === 'courses' && styles.tabTxtActive]}>Courses</Text>
            </Pressable>
            <Pressable
              testID="tab-timetable"
              accessibilityLabel="Timetable tab"
              onPress={() => setTab('timetable')}
              style={[styles.tabBtn, tab === 'timetable' && styles.tabActive]}
            >
              <Clock color={tab === 'timetable' ? '#fff' : theme.colors.muted} size={15} />
              <Text style={[styles.tabTxt, tab === 'timetable' && styles.tabTxtActive]}>Timetable</Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : tab === 'courses' ? (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          >
            {courses.length === 0 && <EmptyState title="No courses" sub="Tap + to add your first course" />}
            {courses.map(c => (
              <Pressable
                key={c.id}
                testID={`course-${c.code}`}
                accessibilityLabel={`Edit course ${c.name}`}
                onPress={() => openCourse(c)}
                style={styles.courseCard}
              >
                <View style={[styles.courseBar, { backgroundColor: c.color || theme.colors.brandPrimary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>{c.name}</Text>
                  <Text style={styles.meta}>
                    {c.code} · {c.credits} credits{c.faculty_name ? ` · ${c.faculty_name}` : ' · No faculty assigned'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
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
                  label={d}
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
              {daySlots.map(s => (
                <View key={s.id} style={styles.slotRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeTxt}>{s.start}</Text>
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
                    accessibilityLabel={`Delete slot ${s.course_name}`}
                    onPress={() => deleteSlot(s.id)}
                    style={[styles.slotDel, confirmSlot === s.id && { backgroundColor: theme.colors.error }]}
                  >
                    <Trash2 color={confirmSlot === s.id ? '#fff' : theme.colors.error} size={15} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Pressable
          testID="academics-fab"
          accessibilityLabel={tab === 'courses' ? 'Add course' : 'Schedule class'}
          onPress={() => (tab === 'courses' ? openCourse(null) : openSlot())}
          style={styles.fab}
        >
          <Plus color="#fff" size={26} />
        </Pressable>

        <Modal visible={cModal} transparent animationType="slide" onRequestClose={() => setCModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{cEdit ? 'Edit Course' : 'Add Course'}</Text>
                <Pressable testID="course-close" accessibilityLabel="Close" onPress={() => setCModal(false)} hitSlop={10}>
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
                      accessibilityLabel={`Select faculty ${fx.name}`}
                      onPress={() => setCf(p => ({ ...p, faculty_id: p.faculty_id === fx.id ? '' : fx.id }))}
                      style={[styles.chip, cf.faculty_id === fx.id && styles.chipActive]}
                    >
                      <Text style={[styles.chipTxt, cf.faculty_id === fx.id && styles.chipTxtActive]}>{fx.name}</Text>
                    </Pressable>
                  ))}
                  {faculty.length === 0 && <Text style={styles.meta}>No faculty accounts yet</Text>}
                </View>
                {cErr ? <Text style={styles.err}>{cErr}</Text> : null}
                <Pressable testID="course-save" accessibilityLabel="Save course" onPress={saveCourse} disabled={cBusy} style={styles.cta}>
                  {cBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{cEdit ? 'Save Changes' : 'Create Course'}</Text>}
                </Pressable>
                {cEdit && (
                  <Pressable
                    testID="course-delete"
                    accessibilityLabel="Delete course"
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

        <Modal visible={sModal} transparent animationType="slide" onRequestClose={() => setSModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Schedule a Class</Text>
                <Pressable testID="slot-close" accessibilityLabel="Close" onPress={() => setSModal(false)} hitSlop={10}>
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
                      accessibilityLabel={`Select day ${d}`}
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
                      accessibilityLabel={`Select course ${c.name}`}
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
                <Pressable testID="slot-save" accessibilityLabel="Save slot" onPress={saveSlot} disabled={sBusy} style={styles.cta}>
                  {sBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Add to Timetable</Text>}
                </Pressable>
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, marginTop: theme.spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brand },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 13 },
  tabTxtActive: { color: '#fff' },
  courseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  courseBar: { width: 5, height: 40, borderRadius: 3 },
  courseName: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 14 },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  timeBox: { alignItems: 'center', width: 48 },
  timeTxt: { fontSize: 12, fontWeight: '800', color: theme.colors.brand },
  slotDel: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: theme.colors.error, alignItems: 'center', justifyContent: 'center' },
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
