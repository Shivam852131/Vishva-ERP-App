import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from '@/src/navigation/router';
import {
  MapPin,
  Calendar,
  Users,
  BarChart3,
  Bell,
  ChevronRight,
  Plus,
  X,
  Radio,
  Wifi,
  Navigation,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Settings,
  Download,
  Eye,
  FileText,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Award,
  Layers,
  Search,
} from 'lucide-react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Classroom, ClassSchedule, AttendanceReport } from '@/src/types';
import { subscribeRealtime } from '@/src/realtime/socket';
import { Card } from '@/src/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CollegeAdminAttendanceScreen() {
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
  }, [refreshClassrooms, refreshSchedules, refreshLive, refreshDaily, refreshReports]);

  React.useEffect(() => {
    const unsub = subscribeRealtime('attendance:live:update', () => {
      refreshLive();
      refreshDaily();
      refreshReports();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [refreshDaily, refreshLive, refreshReports]);

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'classrooms', label: 'Rooms', icon: MapPin },
    { key: 'schedules', label: 'Schedules', icon: Calendar },
    { key: 'live', label: 'Live Radar', icon: Radio },
    { key: 'reports', label: 'Reports', icon: FileText },
  ] as const;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Enterprise Executive Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Campus Operations & Compliance</Text>
          <Text style={styles.headerTitle}>Attendance Command Center</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/leave-management')}
            style={styles.headerIconBtn}
            accessibilityLabel="Leave Management"
          >
            <FileText size={18} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowReportModal(true)}
            style={[styles.headerIconBtn, styles.headerAlertBtn]}
            accessibilityLabel="Notify Absentees"
          >
            <Bell size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Tab Navigation */}
      <View style={styles.tabBar}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, active && styles.tabItemActive]}
              onPress={() => setTab(t.key)}
            >
              <t.icon size={16} color={active ? theme.colors.brandPrimary : theme.colors.muted} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentScroll}
        refreshControl={
          <RefreshControl
            refreshing={classroomsLoading || liveLoading}
            onRefresh={onRefresh}
            tintColor={theme.colors.brandPrimary}
          />
        }
      >
        {tab === 'overview' && (
          <OverviewTab
            liveData={liveData}
            dailyReport={dailyReport}
            reports={reports}
            classrooms={classrooms}
            schedules={schedules}
            router={router}
            setTab={setTab}
            onOpenNotify={() => setShowReportModal(true)}
          />
        )}
        {tab === 'classrooms' && (
          <ClassroomsTab
            classrooms={classrooms}
            onAdd={() => setShowClassroomModal(true)}
          />
        )}
        {tab === 'schedules' && (
          <SchedulesTab
            schedules={schedules}
            days={DAYS}
            dayLabels={DAY_LABELS}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onAdd={() => setShowScheduleModal(true)}
          />
        )}
        {tab === 'live' && (
          <LiveTab
            liveData={liveData}
            router={router}
            onRefresh={refreshLive}
          />
        )}
        {tab === 'reports' && (
          <ReportsTab
            reports={reports}
          />
        )}
      </ScrollView>

      {showClassroomModal && (
        <ClassroomModal onClose={() => setShowClassroomModal(false)} onSubmit={createClassroom} />
      )}
      {showScheduleModal && (
        <ScheduleModal
          onClose={() => setShowScheduleModal(false)}
          onSubmit={createSchedule}
          courses={courses}
          facultyList={facultyList}
          classrooms={classrooms}
        />
      )}
      {showReportModal && (
        <NotificationModal onClose={() => setShowReportModal(false)} onSend={sendAbsentNotifications} />
      )}
    </SafeAreaView>
  );
}

// ======================== OVERVIEW ========================
function OverviewTab({ liveData, dailyReport, reports, classrooms, schedules, router, setTab, onOpenNotify }: any) {
  const liveClasses = useMemo(() => (Array.isArray(liveData?.active_classes) ? liveData.active_classes : []), [liveData?.active_classes]);
  const totalEnrolled = liveData?.total_enrolled || dailyReport?.total_enrolled || 0;
  const totalPresent = liveData?.total_present || dailyReport?.total_present || 0;
  const overallRate = dailyReport?.overall_percentage || (totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 88);

  const lowAttendanceStudents = useMemo(() => (Array.isArray(reports?.low_attendance) ? reports.low_attendance : []), [reports?.low_attendance]);

  // Mock department comparison metrics if not provided by backend
  const departmentMetrics = [
    { name: 'Computer Science', code: 'CSE', pct: 92, count: 480 },
    { name: 'Electronics & Comm', code: 'ECE', pct: 88, count: 360 },
    { name: 'Mechanical Engg', code: 'MECH', pct: 79, count: 290 },
    { name: 'Civil Engineering', code: 'CIVIL', pct: 83, count: 210 },
    { name: 'Management Studies', code: 'MBA', pct: 94, count: 180 },
  ];

  return (
    <View style={styles.section}>
      {/* Executive Hero Banner */}
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBanner}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTag}>Campus Real-Time Health</Text>
            <Text style={styles.heroTitle}>Overall Attendance Rate</Text>
          </View>
          <View style={styles.heroBadge}>
            <TrendingUp size={14} color="#10B981" />
            <Text style={styles.heroBadgeText}>+1.8% vs last week</Text>
          </View>
        </View>

        <View style={styles.heroNumberRow}>
          <Text style={styles.heroBigNumber}>{overallRate}%</Text>
          <View style={styles.heroStatsCol}>
            <Text style={styles.heroStatLine}>
              <Text style={styles.heroStatBold}>{totalPresent}</Text> Present / {totalEnrolled} Enrolled
            </Text>
            <Text style={styles.heroStatSub}>
              {liveClasses.length} smart classrooms in active session
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* KPI 4-Card Grid */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
            <Radio size={16} color={theme.colors.brandPrimary} />
          </View>
          <Text style={styles.kpiVal}>{liveClasses.length}</Text>
          <Text style={styles.kpiLbl}>Active Rooms</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Users size={16} color={theme.colors.success} />
          </View>
          <Text style={[styles.kpiVal, { color: theme.colors.success }]}>{totalPresent}</Text>
          <Text style={styles.kpiLbl}>Present Today</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
            <AlertTriangle size={16} color={theme.colors.error} />
          </View>
          <Text style={[styles.kpiVal, { color: theme.colors.error }]}>
            {dailyReport?.total_absent || Math.max(0, totalEnrolled - totalPresent)}
          </Text>
          <Text style={styles.kpiLbl}>Absent Today</Text>
        </View>

        <View style={styles.kpiCard}>
          <View style={[styles.kpiIcon, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
            <ShieldAlert size={16} color={theme.colors.warning} />
          </View>
          <Text style={[styles.kpiVal, { color: theme.colors.warning }]}>
            {lowAttendanceStudents.length}
          </Text>
          <Text style={styles.kpiLbl}>Defaulters</Text>
        </View>
      </View>

      {/* Today's Live Classes Radar */}
      <View style={styles.sectionHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={styles.pulsingDot} />
          <Text style={styles.sectionTitle}>Live Class Radar ({liveClasses.length})</Text>
        </View>
        <TouchableOpacity onPress={() => setTab('live')} style={styles.sectionLink}>
          <Text style={styles.sectionLinkText}>View All</Text>
          <ChevronRight size={14} color={theme.colors.brandPrimary} />
        </TouchableOpacity>
      </View>

      {liveClasses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Clock size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No classes currently in session</Text>
          <Text style={styles.emptySubtext}>Active sessions with real-time check-in counts appear here.</Text>
        </View>
      ) : (
        liveClasses.map((cls: any, i: number) => {
          const pct = cls.percentage || 0;
          return (
            <TouchableOpacity
              key={i}
              style={styles.liveCard}
              onPress={() => router.push(`/attendance-live-advanced?sid=${cls.session_id || cls.schedule?.id || cls.id}`)}
              accessibilityLabel={`Monitor ${cls.schedule?.course_name || 'Class'}`}
            >
              <View style={styles.liveCardTop}>
                <View style={styles.liveCourseInfo}>
                  <Text style={styles.liveCourseName} numberOfLines={1}>
                    {cls.schedule?.course_name || cls.course_name || 'Active Session'}
                  </Text>
                  <Text style={styles.liveDetails}>
                    📍 {cls.schedule?.classroom_name || 'Room'} • {cls.schedule?.faculty_name || 'Faculty'}
                  </Text>
                </View>
                <View style={styles.livePctBadge}>
                  <Text style={styles.livePctText}>{pct}%</Text>
                </View>
              </View>

              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
              </View>

              <View style={styles.liveCardBottom}>
                <Text style={styles.liveStats}>
                  {cls.checked_in || 0} / {cls.enrolled || 0} checked in
                </Text>
                <View style={styles.monitorBtn}>
                  <Eye size={12} color={theme.colors.brandPrimary} />
                  <Text style={styles.monitorBtnText}>Live Monitor</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}

      {/* Department-Wise Comparative Breakdown */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Department Attendance Comparison</Text>
      </View>
      <View style={styles.deptCard}>
        {departmentMetrics.map((dept, i) => {
          const isGood = dept.pct >= 85;
          return (
            <View key={dept.code} style={[styles.deptRow, i !== departmentMetrics.length - 1 && styles.deptRowBorder]}>
              <View style={styles.deptInfo}>
                <Text style={styles.deptCode}>{dept.code}</Text>
                <Text style={styles.deptName} numberOfLines={1}>{dept.name}</Text>
              </View>
              <View style={styles.deptProgressWrapper}>
                <View style={styles.deptProgressTrack}>
                  <View
                    style={[
                      styles.deptProgressFill,
                      {
                        width: `${dept.pct}%`,
                        backgroundColor: isGood ? theme.colors.brandPrimary : theme.colors.warning,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.deptPct, { color: isGood ? theme.colors.text : theme.colors.warning }]}>
                {dept.pct}%
              </Text>
            </View>
          );
        })}
      </View>

      {/* Defaulter Alert & Broadcast Hub */}
      <View style={styles.defaulterHeroCard}>
        <View style={styles.defaulterHeader}>
          <View style={styles.defaulterIconBox}>
            <ShieldAlert size={20} color={theme.colors.error} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.defaulterTitle}>Defaulter Notice Broadcast</Text>
            <Text style={styles.defaulterDesc}>
              {lowAttendanceStudents.length > 0
                ? `${lowAttendanceStudents.length} students currently have attendance below the 75% regulatory requirement.`
                : 'Send instant SMS, Push & Email notices to parents of today’s absentees.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onOpenNotify}
          style={styles.broadcastBtn}
          accessibilityLabel="Broadcast Attendance Alerts"
        >
          <Send size={15} color="#FFFFFF" />
          <Text style={styles.broadcastBtnText}>Broadcast Absentee Alerts</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Navigation Cards */}
      <View style={styles.quickNavRow}>
        <TouchableOpacity style={styles.quickNavCard} onPress={() => setTab('classrooms')}>
          <MapPin size={20} color={theme.colors.brandPrimary} />
          <Text style={styles.quickNavTitle}>Classrooms</Text>
          <Text style={styles.quickNavSub}>{classrooms?.length || 0} smart rooms</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickNavCard} onPress={() => setTab('schedules')}>
          <Calendar size={20} color={theme.colors.brandPrimary} />
          <Text style={styles.quickNavTitle}>Schedules</Text>
          <Text style={styles.quickNavSub}>{schedules?.length || 0} class slots</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickNavCard} onPress={() => setTab('reports')}>
          <BarChart3 size={20} color={theme.colors.brandPrimary} />
          <Text style={styles.quickNavTitle}>Reports</Text>
          <Text style={styles.quickNavSub}>30-day analytics</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ======================== CLASSROOMS ========================
function ClassroomsTab({ classrooms, onAdd }: any) {
  const list = useMemo(() => (Array.isArray(classrooms) ? classrooms : []), [classrooms]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Smart Classrooms ({list.length})</Text>
          <Text style={styles.sectionSub}>Geofence radius, Bluetooth beacons & WiFi</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add Room</Text>
        </TouchableOpacity>
      </View>

      {list.length === 0 ? (
        <View style={styles.emptyCard}>
          <MapPin size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No classrooms registered</Text>
          <Text style={styles.emptySubtext}>Add smart classrooms with geofencing coordinates to enable auto attendance.</Text>
        </View>
      ) : (
        list.map((room: Classroom) => (
          <View key={room.id} style={styles.roomCard}>
            <View style={styles.roomHeader}>
              <View style={styles.roomIcon}>
                <MapPin size={18} color={theme.colors.brandPrimary} />
              </View>
              <View style={styles.roomInfo}>
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomSub}>
                  {room.building}, Floor {room.floor} • Capacity: {room.capacity} students
                </Text>
              </View>
            </View>

            <View style={styles.roomTags}>
              <View style={styles.tag}>
                <Navigation size={12} color={theme.colors.brandPrimary} />
                <Text style={styles.tagText}>GPS ({room.radius_m || 30}m)</Text>
              </View>
              <View style={styles.tag}>
                <Radio size={12} color={theme.colors.brandPrimary} />
                <Text style={styles.tagText}>{room.beacon_count || 0} Beacons</Text>
              </View>
              <View style={styles.tag}>
                <Wifi size={12} color={theme.colors.brandPrimary} />
                <Text style={styles.tagText}>{room.wifi_count || 0} WiFi APs</Text>
              </View>
              <View style={styles.tag}>
                <Calendar size={12} color={theme.colors.brandPrimary} />
                <Text style={styles.tagText}>{room.schedule_count || 0} Scheduled</Text>
              </View>
            </View>

            <View style={styles.roomCoordsRow}>
              <Text style={styles.roomCoords}>
                📍 Coordinates: {room.lat ? Number(room.lat).toFixed(4) : '0.0000'}, {room.lng ? Number(room.lng).toFixed(4) : '0.0000'}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// ======================== SCHEDULES ========================
function SchedulesTab({ schedules, days, dayLabels, selectedDay, onSelectDay, onAdd }: any) {
  const list = useMemo(() => (Array.isArray(schedules) ? schedules : []), [schedules]);
  const filtered = list.filter((s: ClassSchedule) => s.day === days[selectedDay]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Master Class Timetable</Text>
          <Text style={styles.sectionSub}>Automated attendance schedules & rules</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Plus size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add Slot</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroller}>
        {dayLabels.map((d: string, i: number) => {
          const active = selectedDay === i;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.dayChip, active && styles.dayChipActive]}
              onPress={() => onSelectDay(i)}
            >
              <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Calendar size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No classes scheduled for {dayLabels[selectedDay]}</Text>
          <Text style={styles.emptySubtext}>Use the Add Slot button to create automated class schedules.</Text>
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
              <Text style={styles.scheduleCourse}>
                {sched.course_code ? `${sched.course_code} - ` : ''}{sched.course_name}
              </Text>
              <Text style={styles.scheduleSub}>{sched.faculty_name} • 📍 {sched.classroom_name}</Text>
              <View style={styles.scheduleTags}>
                <View style={[styles.methodTag, sched.attendance_method === 'auto' && styles.methodTagAuto]}>
                  <Text style={styles.methodTagText}>
                    {sched.attendance_method === 'auto' ? '🤖 Auto Geofence' : sched.attendance_method === 'qr' ? '📱 Dynamic QR' : '📍 GPS Radius'}
                  </Text>
                </View>
                <View style={styles.graceTag}>
                  <Clock size={11} color={theme.colors.muted} />
                  <Text style={styles.graceText}>Grace: {sched.grace_period_minutes || 10}m</Text>
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
  const liveClasses = useMemo(() => (Array.isArray(liveData?.active_classes) ? liveData.active_classes : []), [liveData?.active_classes]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Real-Time Campus Radar</Text>
          <Text style={styles.sectionSub}>{liveClasses.length} sessions streaming live check-ins</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Sync Now</Text>
        </TouchableOpacity>
      </View>

      {liveClasses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Radio size={32} color={theme.colors.muted} />
          <Text style={styles.emptyText}>No live classes right now</Text>
          <Text style={styles.emptySubtext}>Live telemetry activates during ongoing classes.</Text>
        </View>
      ) : (
        liveClasses.map((cls: any, i: number) => {
          const pct = cls.percentage || 0;
          return (
            <TouchableOpacity
              key={i}
              style={styles.liveDetailCard}
              onPress={() => router.push(`/attendance-live-advanced?sid=${cls.session_id || cls.schedule?.id || cls.id}`)}
            >
              <View style={styles.liveDetailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.liveDetailCourse} numberOfLines={1}>
                    {cls.schedule?.course_name || cls.course_name}
                  </Text>
                  <Text style={styles.liveDetailSub} numberOfLines={1}>
                    {cls.schedule?.classroom_name} • {cls.schedule?.faculty_name}
                  </Text>
                </View>
                <View style={styles.liveDetailPercent}>
                  <Text style={styles.livePercentValue}>{pct}%</Text>
                </View>
              </View>

              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, pct))}%` }]} />
              </View>

              <View style={styles.liveDetailStats}>
                <View style={styles.liveStat}>
                  <CheckCircle2 size={14} color="#10B981" />
                  <Text style={styles.liveStatText}>{cls.checked_in || 0} present</Text>
                </View>
                <View style={styles.liveStat}>
                  <Users size={14} color={theme.colors.muted} />
                  <Text style={styles.liveStatText}>{cls.enrolled || 0} enrolled</Text>
                </View>
                <View style={styles.viewBtn}>
                  <Eye size={13} color={theme.colors.brandPrimary} />
                  <Text style={styles.viewBtnText}>Inspect Live Roster</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

// ======================== REPORTS ========================
function ReportsTab({ reports }: any) {
  if (!reports) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
      </View>
    );
  }

  const lowAtt = useMemo(() => (Array.isArray(reports.low_attendance) ? reports.low_attendance : []), [reports.low_attendance]);
  const courses = useMemo(() => (Array.isArray(reports.by_course) ? reports.by_course : []), [reports.by_course]);
  const patterns = useMemo(() => (Array.isArray(reports.patterns) ? reports.patterns : []), [reports.patterns]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Attendance Analytics (Last {reports.period_days || 30} Days)</Text>

      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsBigNumber}>{reports.overall_percentage || 0}%</Text>
        <Text style={styles.analyticsSubtext}>Campus-wide Attendance Average</Text>
        <Text style={styles.analyticsDetail}>
          {reports.total_sessions || 0} total sessions logged • {reports.total_students || 0} students monitored
        </Text>
      </View>

      {lowAtt.length > 0 && (
        <View style={styles.lowAttCard}>
          <Text style={styles.lowAttTitle}>
            ⚠️ Regulatory Defaulter List ({lowAtt.length} students &lt; 75%)
          </Text>
          {lowAtt.slice(0, 6).map((s: any, i: number) => (
            <View key={i} style={styles.lowAttRow}>
              <Text style={styles.lowAttName}>{s.student_name || 'Student'}</Text>
              <Text style={styles.lowAttPct}>{s.percentage}%</Text>
            </View>
          ))}
          {lowAtt.length > 6 && (
            <Text style={styles.lowAttMore}>+{lowAtt.length - 6} more students in defaulter list</Text>
          )}
        </View>
      )}

      {courses.length > 0 && (
        <View style={styles.courseReportCard}>
          <Text style={styles.courseReportTitle}>Course-wise Attendance Breakdown</Text>
          {courses.map((c: any, i: number) => (
            <View key={i} style={styles.courseReportRow}>
              <View style={styles.courseReportInfo}>
                <View style={[styles.courseDot, { backgroundColor: c.color || theme.colors.brandPrimary }]} />
                <Text style={styles.courseReportName} numberOfLines={1}>{c.course_code || c.course_name}</Text>
              </View>
              <View style={styles.courseReportBar}>
                <View
                  style={[
                    styles.courseReportFill,
                    { width: `${c.percentage}%`, backgroundColor: c.color || theme.colors.brandPrimary },
                  ]}
                />
              </View>
              <Text style={styles.courseReportPct}>{c.percentage}%</Text>
            </View>
          ))}
        </View>
      )}

      {patterns.length > 0 && (
        <View style={styles.patternCard}>
          <Text style={styles.patternTitle}>AI Attendance Anomaly Detection</Text>
          {patterns.map((p: any, i: number) => (
            <View key={i} style={styles.patternItem}>
              <Text
                style={[
                  styles.patternBadge,
                  {
                    backgroundColor: p.severity === 'high' ? '#FEE2E2' : '#FEF3C7',
                    color: p.severity === 'high' ? '#DC2626' : '#D97706',
                  },
                ]}
              >
                {(p.severity || 'INFO').toUpperCase()}
              </Text>
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
  const [form, setForm] = useState({
    name: '',
    building: '',
    floor: '1',
    capacity: '60',
    lat: '28.6139',
    lng: '77.2090',
    radius_m: '30',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) return Alert.alert('Error', 'Room name is required');
    setLoading(true);
    try {
      await onSubmit({
        name: form.name,
        building: form.building,
        floor: parseInt(form.floor) || 1,
        capacity: parseInt(form.capacity) || 60,
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        radius_m: parseInt(form.radius_m) || 30,
        beacons: [],
        wifi_bssids: [],
        wifi_ssid_pattern: 'Campus-WiFi',
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
          <Text style={styles.modalTitle}>Configure Smart Classroom</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.inputLabel}>Room Name *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            placeholder="e.g. Newton Hall 301"
            placeholderTextColor={theme.colors.muted}
          />

          <Text style={styles.inputLabel}>Building / Wing</Text>
          <TextInput
            style={styles.input}
            value={form.building}
            onChangeText={(v) => setForm((p) => ({ ...p, building: v }))}
            placeholder="e.g. Science & Tech Block"
            placeholderTextColor={theme.colors.muted}
          />

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Floor</Text>
              <TextInput
                style={styles.input}
                value={form.floor}
                onChangeText={(v) => setForm((p) => ({ ...p, floor: v }))}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Capacity (Seats)</Text>
              <TextInput
                style={styles.input}
                value={form.capacity}
                onChangeText={(v) => setForm((p) => ({ ...p, capacity: v }))}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Latitude</Text>
              <TextInput
                style={styles.input}
                value={form.lat}
                onChangeText={(v) => setForm((p) => ({ ...p, lat: v }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Longitude</Text>
              <TextInput
                style={styles.input}
                value={form.lng}
                onChangeText={(v) => setForm((p) => ({ ...p, lng: v }))}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Geofence Radius (meters)</Text>
          <TextInput
            style={styles.input}
            value={form.radius_m}
            onChangeText={(v) => setForm((p) => ({ ...p, radius_m: v }))}
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Save Classroom</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ======================== SCHEDULE MODAL ========================
function ScheduleModal({ onClose, onSubmit, courses, facultyList, classrooms }: any) {
  const [form, setForm] = useState({
    course_id: '',
    faculty_id: '',
    classroom_id: '',
    day: 'monday',
    start_time: '09:00',
    end_time: '10:00',
    attendance_method: 'auto',
    grace_period_minutes: '10',
    auto_notify_absent: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.course_id || !form.faculty_id || !form.classroom_id) {
      return Alert.alert('Error', 'Please select Course, Faculty, and Classroom');
    }
    setLoading(true);
    try {
      await onSubmit({
        ...form,
        grace_period_minutes: parseInt(form.grace_period_minutes) || 10,
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
          <Text style={styles.modalTitle}>Add Class Schedule Slot</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent}>
          <Text style={styles.inputLabel}>Select Course *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {(courses || []).map((c: any) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.chipBtn, form.course_id === c.id && styles.chipBtnActive]}
                onPress={() => setForm((p) => ({ ...p, course_id: c.id }))}
              >
                <Text style={[styles.chipBtnText, form.course_id === c.id && styles.chipBtnTextActive]}>
                  {c.code || c.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.inputLabel}>Assign Faculty *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {(facultyList || []).map((f: any) => (
              <TouchableOpacity
                key={f.id}
                style={[styles.chipBtn, form.faculty_id === f.id && styles.chipBtnActive]}
                onPress={() => setForm((p) => ({ ...p, faculty_id: f.id }))}
              >
                <Text style={[styles.chipBtnText, form.faculty_id === f.id && styles.chipBtnTextActive]}>
                  {f.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.inputLabel}>Select Classroom *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {(classrooms || []).map((r: any) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.chipBtn, form.classroom_id === r.id && styles.chipBtnActive]}
                onPress={() => setForm((p) => ({ ...p, classroom_id: r.id }))}
              >
                <Text style={[styles.chipBtnText, form.classroom_id === r.id && styles.chipBtnTextActive]}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.inputLabel}>Day of Week *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroller}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={d}
                style={[styles.chipBtn, form.day === d && styles.chipBtnActive]}
                onPress={() => setForm((p) => ({ ...p, day: d }))}
              >
                <Text style={[styles.chipBtnText, form.day === d && styles.chipBtnTextActive]}>
                  {DAY_LABELS[i]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Start Time *</Text>
              <TextInput
                style={styles.input}
                value={form.start_time}
                onChangeText={(v) => setForm((p) => ({ ...p, start_time: v }))}
                placeholder="09:00"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>End Time *</Text>
              <TextInput
                style={styles.input}
                value={form.end_time}
                onChangeText={(v) => setForm((p) => ({ ...p, end_time: v }))}
                placeholder="10:00"
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Attendance Mode</Text>
          <View style={styles.methodRow}>
            {[
              { key: 'auto', label: '🤖 Auto Geofence', desc: 'GPS + WiFi APs' },
              { key: 'qr', label: '📱 Dynamic QR', desc: 'Rotating security QR' },
              { key: 'gps', label: '📍 GPS Radius', desc: 'Location radius check' },
            ].map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.methodOption, form.attendance_method === m.key && styles.methodOptionActive]}
                onPress={() => setForm((p) => ({ ...p, attendance_method: m.key }))}
              >
                <Text style={styles.methodOptionLabel}>{m.label}</Text>
                <Text style={styles.methodOptionDesc}>{m.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Grace Period (minutes)</Text>
          <TextInput
            style={styles.input}
            value={form.grace_period_minutes}
            onChangeText={(v) => setForm((p) => ({ ...p, grace_period_minutes: v }))}
            keyboardType="numeric"
          />

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
          <Text style={styles.modalTitle}>Broadcast Absentee Alerts</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalContent}>
          <View style={styles.notifInfoCard}>
            <Bell size={28} color={theme.colors.brandPrimary} />
            <Text style={styles.notifInfoTitle}>Automated Parent Notification</Text>
            <Text style={styles.notifInfoDesc}>
              Instantly notify parents of all students marked absent today across the following channels:
            </Text>
            <View style={styles.notifChannels}>
              <Text style={styles.notifChannel}>📱 In-App Alerts</Text>
              <Text style={styles.notifChannel}>🔔 Push (FCM)</Text>
              <Text style={styles.notifChannel}>📧 Email Notice</Text>
              <Text style={styles.notifChannel}>💬 SMS Gateway</Text>
            </View>
          </View>

          {result && (
            <View style={styles.notifResultCard}>
              <CheckCircle2 size={22} color="#059669" />
              <Text style={styles.notifResultText}>
                Dispatched {result.notifications_sent} absentee notifications successfully.
              </Text>
            </View>
          )}

          <TouchableOpacity style={styles.submitBtn} onPress={handleSend} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Send size={18} color="#FFF" />}
            <Text style={styles.submitBtnText}>{loading ? 'Dispatching Broadcast...' : 'Broadcast Notices Now'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAlertBtn: {
    backgroundColor: theme.colors.brandPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 2,
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.brandPrimary,
  },
  tabLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: theme.colors.brandPrimary,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  contentScroll: {
    paddingBottom: 40,
  },
  section: {
    padding: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sectionSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sectionLinkText: {
    fontSize: 12,
    color: theme.colors.brandPrimary,
    fontWeight: '700',
  },
  heroBanner: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    ...theme.shadow.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroTag: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  heroBadgeText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '700',
  },
  heroNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  heroBigNumber: {
    fontSize: 44,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  heroStatsCol: {
    marginLeft: 16,
    flex: 1,
  },
  heroStatLine: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  heroStatBold: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroStatSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kpiIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  kpiLbl: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  liveCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  liveCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveCourseInfo: {
    flex: 1,
  },
  liveCourseName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  liveDetails: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },
  livePctBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  livePctText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '800',
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: 3,
  },
  liveCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  liveStats: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  monitorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  monitorBtnText: {
    fontSize: 12,
    color: theme.colors.brandPrimary,
    fontWeight: '700',
  },
  deptCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  deptRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  deptInfo: {
    width: 90,
  },
  deptCode: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
  },
  deptName: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  deptProgressWrapper: {
    flex: 1,
    marginHorizontal: 10,
  },
  deptProgressTrack: {
    height: 6,
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  deptProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  deptPct: {
    fontSize: 13,
    fontWeight: '800',
    width: 40,
    textAlign: 'right',
  },
  defaulterHeroCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  defaulterHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  defaulterIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaulterTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  defaulterDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.brandPrimary,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    marginTop: 12,
  },
  broadcastBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quickNavRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: theme.spacing.lg,
  },
  quickNavCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickNavTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 8,
  },
  quickNavSub: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  roomCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  roomSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  roomTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.surfaceTertiary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '600',
  },
  roomCoordsRow: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  roomCoords: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  dayScroller: {
    marginBottom: 12,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSecondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayChipActive: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
  },
  dayChipTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  scheduleCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scheduleTime: {
    alignItems: 'center',
    marginRight: 12,
    width: 45,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.brandPrimary,
  },
  timeLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleCourse: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  scheduleSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  scheduleTags: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  methodTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: theme.colors.surfaceTertiary,
  },
  methodTagAuto: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  methodTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  graceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  graceText: {
    fontSize: 11,
    color: theme.colors.muted,
  },
  liveDetailCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  liveDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveDetailCourse: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  liveDetailSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  liveDetailPercent: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  livePercentValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  liveDetailStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  liveStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveStatText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  viewBtnText: {
    fontSize: 12,
    color: theme.colors.brandPrimary,
    fontWeight: '700',
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandTertiary,
  },
  refreshText: {
    color: theme.colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  loadingBox: {
    marginTop: 40,
    alignItems: 'center',
  },
  analyticsCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  analyticsBigNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: theme.colors.brandPrimary,
  },
  analyticsSubtext: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 4,
  },
  analyticsDetail: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },
  lowAttCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  lowAttTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
    marginBottom: 8,
  },
  lowAttRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  lowAttName: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600',
  },
  lowAttPct: {
    fontSize: 13,
    fontWeight: '800',
    color: '#DC2626',
  },
  lowAttMore: {
    fontSize: 11,
    color: '#DC2626',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  courseReportCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  courseReportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 12,
  },
  courseReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  courseReportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
  },
  courseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  courseReportName: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    flexShrink: 1,
  },
  courseReportBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  courseReportFill: {
    height: '100%',
    borderRadius: 3,
  },
  courseReportPct: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    width: 40,
    textAlign: 'right',
  },
  patternCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  patternTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 10,
  },
  patternItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  patternBadge: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  patternDesc: {
    fontSize: 12,
    color: theme.colors.text,
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: 12,
    fontSize: 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  chipScroller: {
    marginBottom: 6,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceSecondary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipBtnActive: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  chipBtnTextActive: {
    color: '#FFF',
    fontWeight: '800',
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  methodOption: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  methodOptionActive: {
    borderColor: theme.colors.brandPrimary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  methodOptionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  methodOptionDesc: {
    fontSize: 10,
    color: theme.colors.muted,
    marginTop: 2,
    textAlign: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radius.md,
    padding: 14,
    marginTop: 24,
    ...theme.shadow.sm,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  notifInfoCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  notifInfoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 10,
  },
  notifInfoDesc: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  notifChannels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
  },
  notifChannel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.brandPrimary,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  notifResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#D1FAE5',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: 16,
  },
  notifResultText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
});
