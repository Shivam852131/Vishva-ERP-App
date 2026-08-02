import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from '@/src/navigation/router';
import { MapPin, Calendar, Users, BarChart3, Bell, ChevronRight, Plus, X, Radio, Wifi, Navigation, Clock, CheckCircle, AlertTriangle, Send, Settings, Download, Eye, FileText } from 'lucide-react-native';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Classroom, ClassSchedule, LiveClass, AttendanceReport } from '@/src/types';
import { subscribeRealtime } from '@/src/realtime/socket';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AttendanceManagement() {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'classrooms' | 'schedules' | 'live' | 'reports'>('overview');
  const [showClassroomModal, setShowClassroomModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);

  const { data: classrooms, loading: classroomsLoading, refresh: refreshClassrooms } = useFetch<Classroom[]>('/classrooms');
  const { data: schedules, loading: schedulesLoading, refresh: refreshSchedules } = useFetch<ClassSchedule[]>('/schedules');
  const { data: liveData, loading: liveLoading, refresh: refreshLive } = useFetch<any>('/attendance/live');
  const { data: dailyReport, refresh: refreshDaily } = useFetch<any>('/attendance/daily');
  const { data: reports, loading: reportsLoading, refresh: refreshReports } = useFetch<AttendanceReport>('/attendance/reports?days=30');
  const { data: courses } = useFetch<any[]>('/courses');
  const { data: facultyList } = useFetch<any[]>('/admin/users?role=faculty');
  const { mutate: _createClassroom } = useMutate('/classrooms');
  const { mutate: _createSchedule } = useMutate('/schedules');
  const { mutate: sendAbsentNotifications } = useMutate('/admin/notifications/absentees');

  const createClassroom = useCallback(async (data: any) => {
    const res = await _createClassroom(data);
    refreshClassrooms();
    return res;
  }, [_createClassroom, refreshClassrooms]);

  const createSchedule = useCallback(async (data: any) => {
    const res = await _createSchedule({
      courseId: data.course_id,
      classroomId: data.classroom_id,
      facultyId: data.faculty_id,
      dayOfWeek: data.day,
      startTime: data.start_time,
      endTime: data.end_time,
      attendanceMethod: data.attendance_method,
      gracePeriodMinutes: data.grace_period_minutes,
      autoNotifyAbsent: data.auto_notify_absent,
    });
    refreshSchedules();
    return res;
  }, [_createSchedule, refreshSchedules]);

  const onRefresh = useCallback(() => {
    refreshClassrooms();
    refreshSchedules();
    refreshLive();
    refreshDaily();
    refreshReports();
  }, []);

  React.useEffect(() => subscribeRealtime('attendance:live:update', () => {
    refreshLive();
    refreshDaily();
    refreshReports();
  }), [refreshDaily, refreshLive, refreshReports]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'classrooms', label: 'Rooms', icon: MapPin },
    { key: 'schedules', label: 'Schedule', icon: Calendar },
    { key: 'live', label: 'Live', icon: Radio },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
  ] as const;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance Management</Text>
        <TouchableOpacity onPress={() => router.push('/leave-management')} style={styles.headerBtn}>
          <FileText size={20} color={theme.colors.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowReportModal(true)} style={styles.headerBtn}>
          <Settings size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tabItem, tab === t.key && styles.tabItemActive]} onPress={() => setTab(t.key)}>
            <t.icon size={18} color={tab === t.key ? theme.colors.brand : theme.colors.muted} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={classroomsLoading || liveLoading} onRefresh={onRefresh} tintColor={theme.colors.brand} />}>
        {tab === 'overview' && <OverviewTab liveData={liveData} dailyReport={dailyReport} reports={reports} classrooms={classrooms} schedules={schedules} router={router} setTab={setTab} />}
        {tab === 'classrooms' && <ClassroomsTab classrooms={classrooms} onAdd={() => setShowClassroomModal(true)} />}
        {tab === 'schedules' && <SchedulesTab schedules={schedules} days={DAYS} dayLabels={DAY_LABELS} selectedDay={selectedDay} onSelectDay={setSelectedDay} onAdd={() => setShowScheduleModal(true)} />}
        {tab === 'live' && <LiveTab liveData={liveData} router={router} onRefresh={refreshLive} />}
        {tab === 'reports' && <ReportsTab reports={reports} />}
      </ScrollView>

      {showClassroomModal && <ClassroomModal onClose={() => setShowClassroomModal(false)} onSubmit={createClassroom} />}
      {showScheduleModal && <ScheduleModal onClose={() => setShowScheduleModal(false)} onSubmit={createSchedule} courses={courses} facultyList={facultyList} classrooms={classrooms} />}
      {showReportModal && <NotificationModal onClose={() => setShowReportModal(false)} onSend={sendAbsentNotifications} />}
    </SafeAreaView>
  );
}

// ======================== OVERVIEW ========================
function OverviewTab({ liveData, dailyReport, reports, classrooms, schedules, router, setTab }: any) {
  const liveClasses = liveData?.active_classes || [];
  const totalEnrolled = liveData?.total_enrolled || 0;
  const totalPresent = liveData?.total_present || 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{"Today's Live Classes"}</Text>
      {liveClasses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Clock size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No classes in session right now</Text>
          <Text style={styles.emptySubtext}>Classes will appear here during scheduled hours</Text>
        </View>
      ) : (
          liveClasses.map((cls: any, i: number) => (
          <TouchableOpacity key={i} style={styles.liveCard} onPress={() => router.push(`/attendance-live-advanced?sid=${cls.session_id || cls.schedule.id}`)}>
            <View style={styles.liveCardHeader}>
              <View style={styles.liveDot} />
              <Text style={styles.liveCourseName}>{cls.schedule.course_name}</Text>
              <Text style={styles.livePercentage}>{cls.percentage}%</Text>
            </View>
            <Text style={styles.liveDetails}>{cls.schedule.classroom_name} • {cls.schedule.start_time} - {cls.schedule.end_time}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${cls.percentage}%` }]} />
            </View>
            <Text style={styles.liveStats}>{cls.checked_in}/{cls.enrolled} present • {cls.schedule.faculty_name}</Text>
          </TouchableOpacity>
        ))
      )}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MapPin size={20} color={theme.colors.brand} />
          <Text style={styles.statValue}>{classrooms?.length || 0}</Text>
          <Text style={styles.statLabel}>Classrooms</Text>
        </View>
        <View style={styles.statCard}>
          <Calendar size={20} color={theme.colors.brand} />
          <Text style={styles.statValue}>{schedules?.length || 0}</Text>
          <Text style={styles.statLabel}>Schedules</Text>
        </View>
        <View style={styles.statCard}>
          <Users size={20} color={theme.colors.brand} />
          <Text style={styles.statValue}>{totalPresent}/{totalEnrolled}</Text>
          <Text style={styles.statLabel}>Present Now</Text>
        </View>
      </View>

      {dailyReport && (
        <View style={styles.reportCard}>
          <Text style={styles.reportTitle}>Daily Summary ({dailyReport.date})</Text>
          <Text style={styles.reportBigNumber}>{dailyReport.overall_percentage}%</Text>
          <Text style={styles.reportSubtext}>Overall Attendance</Text>
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>Present: {dailyReport.total_present}</Text>
            <Text style={styles.reportLabel}>Absent: {dailyReport.total_absent}</Text>
            <Text style={styles.reportLabel}>Total: {dailyReport.total_enrolled}</Text>
          </View>
        </View>
      )}

      {reports?.patterns?.length > 0 && (
        <View style={styles.patternsCard}>
          <Text style={styles.patternsTitle}>Attendance Patterns Detected</Text>
          {reports.patterns.map((p: any, i: number) => (
            <View key={i} style={[styles.patternItem, { borderLeftColor: p.severity === 'high' ? '#EF4444' : p.severity === 'medium' ? '#F59E0B' : '#10B981' }]}>
              <AlertTriangle size={16} color={p.severity === 'high' ? '#EF4444' : '#F59E0B'} />
              <Text style={styles.patternText}>{p.description}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.actionCard} onPress={() => setTab('classrooms')}>
        <MapPin size={20} color={theme.colors.brand} />
        <Text style={styles.actionText}>Manage Classrooms</Text>
        <ChevronRight size={18} color={theme.colors.muted} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionCard} onPress={() => setTab('schedules')}>
        <Calendar size={20} color={theme.colors.brand} />
        <Text style={styles.actionText}>Manage Schedules</Text>
        <ChevronRight size={18} color={theme.colors.muted} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionCard} onPress={() => setTab('live')}>
        <Radio size={20} color="#EF4444" />
        <Text style={styles.actionText}>Live Tracking</Text>
        <ChevronRight size={18} color={theme.colors.muted} />
      </TouchableOpacity>
    </View>
  );
}

// ======================== CLASSROOMS ========================
function ClassroomsTab({ classrooms, onAdd }: any) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Classrooms ({classrooms?.length || 0})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Plus size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add Room</Text>
        </TouchableOpacity>
      </View>
      {classrooms?.map((room: Classroom) => (
        <View key={room.id} style={styles.roomCard}>
          <View style={styles.roomHeader}>
            <View style={styles.roomIcon}>
              <MapPin size={18} color={theme.colors.brand} />
            </View>
            <View style={styles.roomInfo}>
              <Text style={styles.roomName}>{room.name}</Text>
              <Text style={styles.roomSub}>{room.building}, Floor {room.floor} • Capacity: {room.capacity}</Text>
            </View>
          </View>
          <View style={styles.roomTags}>
            <View style={styles.tag}>
              <Navigation size={12} color={theme.colors.brand} />
              <Text style={styles.tagText}>GPS ({room.radius_m}m)</Text>
            </View>
            <View style={styles.tag}>
              <Radio size={12} color={theme.colors.brand} />
              <Text style={styles.tagText}>{room.beacon_count || 0} Beacon(s)</Text>
            </View>
            <View style={styles.tag}>
              <Wifi size={12} color={theme.colors.brand} />
              <Text style={styles.tagText}>{room.wifi_count || 0} WiFi</Text>
            </View>
            <View style={styles.tag}>
              <Calendar size={12} color={theme.colors.brand} />
              <Text style={styles.tagText}>{room.schedule_count || 0} Classes</Text>
            </View>
          </View>
          <Text style={styles.roomCoords}>📍 {room.lat?.toFixed(4)}, {room.lng?.toFixed(4)}</Text>
        </View>
      ))}
    </View>
  );
}

// ======================== SCHEDULES ========================
function SchedulesTab({ schedules, days, dayLabels, selectedDay, onSelectDay, onAdd }: any) {
  const filtered = schedules?.filter((s: ClassSchedule) => s.day === days[selectedDay]) || [];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Class Schedules</Text>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Plus size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add Class</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroller}>
        {dayLabels.map((d: string, i: number) => (
          <TouchableOpacity key={i} style={[styles.dayChip, selectedDay === i && styles.dayChipActive]} onPress={() => onSelectDay(i)}>
            <Text style={[styles.dayChipText, selectedDay === i && styles.dayChipTextActive]}>{d}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Calendar size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No classes scheduled</Text>
        </View>
      ) : (
        filtered.map((sched: ClassSchedule) => (
          <View key={sched.id} style={styles.scheduleCard}>
            <View style={styles.scheduleTime}>
              <Text style={styles.timeText}>{sched.start_time}</Text>
              <View style={styles.timeLine} />
              <Text style={styles.timeText}>{sched.end_time}</Text>
            </View>
            <View style={styles.scheduleInfo}>
              <Text style={styles.scheduleCourse}>{sched.course_code} - {sched.course_name}</Text>
              <Text style={styles.scheduleSub}>{sched.faculty_name}</Text>
              <Text style={styles.scheduleSub}>📍 {sched.classroom_name}</Text>
              <View style={styles.scheduleTags}>
                <View style={[styles.methodTag, sched.attendance_method === 'auto' && styles.methodTagAuto]}>
                  <Text style={styles.methodTagText}>{sched.attendance_method === 'auto' ? '🤖 Auto' : sched.attendance_method === 'qr' ? '📱 QR' : '📍 GPS'}</Text>
                </View>
                <View style={styles.graceTag}>
                  <Clock size={10} color={theme.colors.muted} />
                  <Text style={styles.graceText}>Grace: {sched.grace_period_minutes}min</Text>
                </View>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ======================== LIVE TRACKING ========================
function LiveTab({ liveData, router, onRefresh }: any) {
  const liveClasses = liveData?.active_classes || [];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Live Classes ({liveClasses.length})</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {liveClasses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Radio size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No live classes right now</Text>
          <Text style={styles.emptySubtext}>Live tracking will activate during class hours</Text>
        </View>
      ) : (
        liveClasses.map((cls: any, i: number) => (
          <TouchableOpacity key={i} style={styles.liveDetailCard} onPress={() => router.push(`/attendance-live-advanced?sid=${cls.session_id || cls.schedule.id}`)}>
            <View style={styles.liveDetailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.liveDetailCourse} numberOfLines={1}>{cls.schedule.course_name}</Text>
                <Text style={styles.liveDetailSub} numberOfLines={1}>{cls.schedule.classroom_name} • {cls.schedule.faculty_name}</Text>
              </View>
              <View style={styles.liveDetailPercent}>
                <Text style={styles.livePercentValue}>{cls.percentage}%</Text>
              </View>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${cls.percentage}%` }]} />
            </View>
            <View style={styles.liveDetailStats}>
              <View style={styles.liveStat}>
                <CheckCircle size={14} color="#10B981" />
                <Text style={styles.liveStatText}>{cls.checked_in} present</Text>
              </View>
              <View style={styles.liveStat}>
                <Users size={14} color={theme.colors.muted} />
                <Text style={styles.liveStatText}>{cls.enrolled} enrolled</Text>
              </View>
              <TouchableOpacity style={styles.viewBtn} onPress={() => router.push(`/attendance-live-advanced?sid=${cls.session_id || cls.schedule.id}`)}>
                <Eye size={14} color={theme.colors.brand} />
                <Text style={styles.viewBtnText}>View Roll</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

// ======================== REPORTS ========================
function ReportsTab({ reports }: any) {
  if (!reports) return <ActivityIndicator size="large" color={theme.colors.brand} style={{ marginTop: 40 }} />;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Attendance Analytics (Last {reports.period_days} days)</Text>
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsBigNumber}>{reports.overall_percentage}%</Text>
        <Text style={styles.analyticsSubtext}>Overall Attendance Rate</Text>
        <Text style={styles.analyticsDetail}>{reports.total_sessions} total sessions • {reports.total_students} students</Text>
      </View>

      {reports.low_attendance?.length > 0 && (
        <View style={styles.lowAttCard}>
          <Text style={styles.lowAttTitle}>⚠️ Low Attendance Alert ({reports.low_attendance.length} students below 75%)</Text>
          {reports.low_attendance.slice(0, 5).map((s: any, i: number) => (
            <View key={i} style={styles.lowAttRow}>
              <Text style={styles.lowAttName}>{s.student_name}</Text>
              <Text style={styles.lowAttPct}>{s.percentage}%</Text>
            </View>
          ))}
          {reports.low_attendance.length > 5 && (
            <Text style={styles.lowAttMore}>+{reports.low_attendance.length - 5} more students</Text>
          )}
        </View>
      )}

      {reports.by_course?.length > 0 && (
        <View style={styles.courseReportCard}>
          <Text style={styles.courseReportTitle}>Course-wise Attendance</Text>
          {reports.by_course.map((c: any, i: number) => (
            <View key={i} style={styles.courseReportRow}>
              <View style={styles.courseReportInfo}>
                <View style={[styles.courseDot, { backgroundColor: c.color || theme.colors.brand }]} />
                <Text style={styles.courseReportName} numberOfLines={1}>{c.course_code}</Text>
              </View>
              <View style={styles.courseReportBar}>
                <View style={[styles.courseReportFill, { width: `${c.percentage}%`, backgroundColor: c.color || theme.colors.brand }]} />
              </View>
              <Text style={styles.courseReportPct}>{c.percentage}%</Text>
            </View>
          ))}
        </View>
      )}

      {reports.patterns?.length > 0 && (
        <View style={styles.patternCard}>
          <Text style={styles.patternTitle}>📊 Patterns Detected</Text>
          {reports.patterns.map((p: any, i: number) => (
            <View key={i} style={styles.patternItem}>
              <Text style={[styles.patternBadge, { backgroundColor: p.severity === 'high' ? '#FEE2E2' : '#FEF3C7', color: p.severity === 'high' ? '#DC2626' : '#D97706' }]}>{p.severity.toUpperCase()}</Text>
              <Text style={styles.patternDesc}>{p.description}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ======================== CLASSROOM MODAL ========================
function ClassroomModal({ onClose, onSubmit }: any) {
  const [form, setForm] = useState({ name: '', building: '', floor: '0', capacity: '60', lat: '28.6139', lng: '77.2090', radius_m: '30' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Name is required');
    setLoading(true);
    try {
      await onSubmit({
        name: form.name, building: form.building, floor: parseInt(form.floor),
        capacity: parseInt(form.capacity), lat: parseFloat(form.lat), lng: parseFloat(form.lng),
        radius_m: parseInt(form.radius_m), beacons: [], wifi_bssids: [], wifi_ssid_pattern: 'Campus-WiFi',
      });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create classroom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Classroom</Text>
          <TouchableOpacity onPress={onClose}><X size={24} color={theme.colors.text} /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.inputLabel}>Room Name *</Text>
          <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Room 201" />
          <Text style={styles.inputLabel}>Building</Text>
          <TextInput style={styles.input} value={form.building} onChangeText={v => setForm(p => ({ ...p, building: v }))} placeholder="e.g. CS Block" />
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Floor</Text>
              <TextInput style={styles.input} value={form.floor} onChangeText={v => setForm(p => ({ ...p, floor: v }))} keyboardType="numeric" />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Capacity</Text>
              <TextInput style={styles.input} value={form.capacity} onChangeText={v => setForm(p => ({ ...p, capacity: v }))} keyboardType="numeric" />
            </View>
          </View>
          <Text style={styles.inputLabel}>Latitude *</Text>
          <TextInput style={styles.input} value={form.lat} onChangeText={v => setForm(p => ({ ...p, lat: v }))} keyboardType="decimal-pad" />
          <Text style={styles.inputLabel}>Longitude *</Text>
          <TextInput style={styles.input} value={form.lng} onChangeText={v => setForm(p => ({ ...p, lng: v }))} keyboardType="decimal-pad" />
          <Text style={styles.inputLabel}>Radius (meters)</Text>
          <TextInput style={styles.input} value={form.radius_m} onChangeText={v => setForm(p => ({ ...p, radius_m: v }))} keyboardType="numeric" />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Create Classroom</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ======================== SCHEDULE MODAL ========================
function ScheduleModal({ onClose, onSubmit, courses, facultyList, classrooms }: any) {
  const [form, setForm] = useState({
    course_id: '', faculty_id: '', classroom_id: '', day: 'monday',
    start_time: '09:00', end_time: '10:00', attendance_method: 'auto',
    grace_period_minutes: '10', auto_notify_absent: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.course_id || !form.faculty_id || !form.classroom_id) return Alert.alert('Error', 'All fields required');
    setLoading(true);
    try {
      await onSubmit({
        ...form, grace_period_minutes: parseInt(form.grace_period_minutes),
      });
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Class Schedule</Text>
          <TouchableOpacity onPress={onClose}><X size={24} color={theme.colors.text} /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.inputLabel}>Course *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {courses?.map((c: any) => (
              <TouchableOpacity key={c.id} style={[styles.chipBtn, form.course_id === c.id && styles.chipBtnActive]} onPress={() => setForm(p => ({ ...p, course_id: c.id }))}>
                <Text style={[styles.chipBtnText, form.course_id === c.id && styles.chipBtnTextActive]}>{c.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.inputLabel}>Faculty *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {facultyList?.map((f: any) => (
              <TouchableOpacity key={f.id} style={[styles.chipBtn, form.faculty_id === f.id && styles.chipBtnActive]} onPress={() => setForm(p => ({ ...p, faculty_id: f.id }))}>
                <Text style={[styles.chipBtnText, form.faculty_id === f.id && styles.chipBtnTextActive]}>{f.name.split(' ')[0]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.inputLabel}>Classroom *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {classrooms?.map((r: any) => (
              <TouchableOpacity key={r.id} style={[styles.chipBtn, form.classroom_id === r.id && styles.chipBtnActive]} onPress={() => setForm(p => ({ ...p, classroom_id: r.id }))}>
                <Text style={[styles.chipBtnText, form.classroom_id === r.id && styles.chipBtnTextActive]}>{r.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.inputLabel}>Day *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {DAYS.map((d, i) => (
              <TouchableOpacity key={d} style={[styles.chipBtn, form.day === d && styles.chipBtnActive]} onPress={() => setForm(p => ({ ...p, day: d }))}>
                <Text style={[styles.chipBtnText, form.day === d && styles.chipBtnTextActive]}>{DAY_LABELS[i]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Start Time *</Text>
              <TextInput style={styles.input} value={form.start_time} onChangeText={v => setForm(p => ({ ...p, start_time: v }))} placeholder="09:00" />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>End Time *</Text>
              <TextInput style={styles.input} value={form.end_time} onChangeText={v => setForm(p => ({ ...p, end_time: v }))} placeholder="10:00" />
            </View>
          </View>
          <Text style={styles.inputLabel}>Attendance Method</Text>
          <View style={styles.methodRow}>
            {[{ key: 'auto', label: '🤖 Auto', desc: 'GPS+Beacon+WiFi' }, { key: 'qr', label: '📱 QR', desc: 'QR Code Scan' }, { key: 'gps', label: '📍 GPS', desc: 'Location Only' }].map(m => (
              <TouchableOpacity key={m.key} style={[styles.methodOption, form.attendance_method === m.key && styles.methodOptionActive]} onPress={() => setForm(p => ({ ...p, attendance_method: m.key }))}>
                <Text style={styles.methodOptionLabel}>{m.label}</Text>
                <Text style={styles.methodOptionDesc}>{m.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.inputLabel}>Grace Period (minutes)</Text>
          <TextInput style={styles.input} value={form.grace_period_minutes} onChangeText={v => setForm(p => ({ ...p, grace_period_minutes: v }))} keyboardType="numeric" />
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Create Schedule</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ======================== NOTIFICATION MODAL ========================
function NotificationModal({ onClose, onSend }: any) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await onSend({});
      setResult(res);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Send Absent Notifications</Text>
          <TouchableOpacity onPress={onClose}><X size={24} color={theme.colors.text} /></TouchableOpacity>
        </View>
        <View style={styles.modalContent}>
          <View style={styles.notifInfoCard}>
            <Bell size={24} color={theme.colors.brand} />
            <Text style={styles.notifInfoTitle}>Absentee Alert System</Text>
            <Text style={styles.notifInfoDesc}>{"Send notifications to students and parents for today's absentees via:"}</Text>
            <View style={styles.notifChannels}>
              <Text style={styles.notifChannel}>📱 In-App</Text>
              <Text style={styles.notifChannel}>🔔 Push (FCM)</Text>
              <Text style={styles.notifChannel}>📧 Email</Text>
              <Text style={styles.notifChannel}>💬 SMS</Text>
            </View>
          </View>
          {result && (
            <View style={styles.notifResultCard}>
              <CheckCircle size={24} color="#10B981" />
              <Text style={styles.notifResultText}>Sent {result.notifications_sent} notifications for {result.date}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSend} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Send size={18} color="#FFF" />}
            <Text style={styles.submitBtnText}>{loading ? 'Sending...' : 'Send Notifications Now'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerTitle: { fontSize: 20, fontWeight: '700', color: theme.colors.text },
  headerBtn: { padding: 8 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surfaceSecondary },
  tabItem: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.brand },
  tabLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  tabLabelActive: { color: theme.colors.brand },
  content: { flex: 1 },
  section: { padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brand, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  emptyCard: { alignItems: 'center', padding: 40, backgroundColor: theme.colors.surface, borderRadius: 16, marginBottom: 12 },
  emptyText: { fontSize: 15, fontWeight: '600', color: theme.colors.text, marginTop: 12 },
  emptySubtext: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
  liveCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#10B981' },
  liveCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  liveCourseName: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.colors.text },
  livePercentage: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  liveDetails: { fontSize: 13, color: theme.colors.muted, marginTop: 4, marginLeft: 16 },
  progressBar: { height: 6, backgroundColor: theme.colors.border, borderRadius: 3, marginTop: 8 },
  progressFill: { height: 6, backgroundColor: theme.colors.brand, borderRadius: 3 },
  liveStats: { fontSize: 12, color: theme.colors.muted, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.muted },
  reportCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center' },
  reportTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.muted },
  reportBigNumber: { fontSize: 48, fontWeight: '800', color: theme.colors.brand, marginTop: 4 },
  reportSubtext: { fontSize: 13, color: theme.colors.muted },
  reportRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  reportLabel: { fontSize: 13, color: theme.colors.text },
  patternsCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  patternsTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  patternItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderLeftWidth: 3, paddingLeft: 8, marginBottom: 4 },
  patternText: { fontSize: 13, color: theme.colors.text, flex: 1 },
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, marginBottom: 8 },
  actionText: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.text },

  roomCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roomIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: `${theme.colors.brand}15`, alignItems: 'center', justifyContent: 'center' },
  roomInfo: { flex: 1 },
  roomName: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  roomSub: { fontSize: 13, color: theme.colors.muted },
  roomTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${theme.colors.brand}10`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: theme.colors.brand, fontWeight: '600' },
  roomCoords: { fontSize: 12, color: theme.colors.muted, marginTop: 8 },

  dayScroller: { marginBottom: 12 },
  dayChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surface, marginRight: 8 },
  dayChipActive: { backgroundColor: theme.colors.brand },
  dayChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  dayChipTextActive: { color: '#FFF' },
  scheduleCard: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 10 },
  scheduleTime: { alignItems: 'center', marginRight: 12, width: 50 },
  timeText: { fontSize: 12, fontWeight: '700', color: theme.colors.brand },
  timeLine: { flex: 1, width: 2, backgroundColor: theme.colors.border, marginVertical: 4 },
  scheduleInfo: { flex: 1 },
  scheduleCourse: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  scheduleSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  scheduleTags: { flexDirection: 'row', gap: 8, marginTop: 8 },
  methodTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: theme.colors.surfaceSecondary },
  methodTagAuto: { backgroundColor: '#D1FAE5' },
  methodTagText: { fontSize: 11, fontWeight: '600' },
  graceTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  graceText: { fontSize: 11, color: theme.colors.muted },

  liveDetailCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 12 },
  liveDetailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveDetailCourse: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  liveDetailSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  liveDetailPercent: { backgroundColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  livePercentValue: { fontSize: 16, fontWeight: '700', color: '#059669' },
  liveDetailStats: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  liveStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveStatText: { fontSize: 12, color: theme.colors.muted },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  viewBtnText: { fontSize: 12, color: theme.colors.brand, fontWeight: '600' },
  refreshBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.brand },
  refreshText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  analyticsCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  analyticsBigNumber: { fontSize: 56, fontWeight: '800', color: theme.colors.brand },
  analyticsSubtext: { fontSize: 15, fontWeight: '600', color: theme.colors.text, marginTop: 4 },
  analyticsDetail: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  lowAttCard: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  lowAttTitle: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginBottom: 8 },
  lowAttRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  lowAttName: { fontSize: 14, color: '#991B1B' },
  lowAttPct: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
  lowAttMore: { fontSize: 12, color: '#DC2626', marginTop: 4, textAlign: 'center' },
  courseReportCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  courseReportTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  courseReportRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  courseReportInfo: { flexDirection: 'row', alignItems: 'center', width: 72 },
  courseDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  courseReportName: { fontSize: 12, fontWeight: '600', color: theme.colors.text, flexShrink: 1 },
  courseReportBar: { flex: 1, height: 8, backgroundColor: theme.colors.border, borderRadius: 4, marginHorizontal: 8 },
  courseReportFill: { height: 8, borderRadius: 4 },
  courseReportPct: { fontSize: 13, fontWeight: '700', color: theme.colors.text, width: 45, textAlign: 'right' },
  patternCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  patternTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 12 },
  patternBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden', marginRight: 8 },
  patternDesc: { fontSize: 13, color: theme.colors.text, flex: 1 },

  modalContainer: { flex: 1, backgroundColor: theme.colors.bg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  modalContent: { flex: 1, padding: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, fontSize: 15, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  chipScroller: { marginBottom: 8 },
  chipBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surface, marginRight: 8, borderWidth: 1, borderColor: theme.colors.border },
  chipBtnActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  chipBtnTextActive: { color: '#FFF' },
  methodRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  methodOption: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 2, borderColor: theme.colors.border },
  methodOptionActive: { borderColor: theme.colors.brand, backgroundColor: `${theme.colors.brand}10` },
  methodOptionLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  methodOptionDesc: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 12, padding: 14, marginTop: 20 },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  notifInfoCard: { backgroundColor: theme.colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  notifInfoTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text, marginTop: 12 },
  notifInfoDesc: { fontSize: 14, color: theme.colors.muted, marginTop: 8, textAlign: 'center' },
  notifChannels: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, justifyContent: 'center' },
  notifChannel: { fontSize: 13, color: theme.colors.brand, backgroundColor: `${theme.colors.brand}10`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  notifResultCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#D1FAE5', borderRadius: 12, padding: 16, marginBottom: 16 },
  notifResultText: { fontSize: 14, fontWeight: '600', color: '#065F46' },
});
