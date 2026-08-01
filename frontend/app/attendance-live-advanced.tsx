import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, TextInput, ActivityIndicator, Dimensions, Animated as RNAnimated,
  Modal, Pressable, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from '@/src/navigation/router';
import {
  ArrowLeft, Users, CheckCircle, Clock, XCircle, Send, Filter, Search,
  ChevronDown, UserCheck, UserX, AlertTriangle, TrendingUp, BarChart3,
  Download, RefreshCw, Eye, MoreVertical, Zap, Target, Award, Flame,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, Bell, Settings
} from 'lucide-react-native';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { AsyncView, Card, StatCard, Skeleton, ProgressBar, GlassCard } from '@/src/ui';
import type { LiveStudentStatus } from '@/src/types';
import { subscribeRealtime } from '@/src/realtime/socket';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, FadeInDown, FadeInUp, SlideInRight, Layout
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Animated Stats Card ──────────────────────────────
function AnimatedStatCard({ value, label, color, icon, delay = 0 }: {
  value: string | number; label: string; color: string; icon: any; delay?: number;
}) {
  const scaleValue = useSharedValue(0.9);
  const opacityValue = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacityValue.value = withTiming(1, { duration: 500 });
      scaleValue.value = withSpring(1, { damping: 15, stiffness: 100 });
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
    opacity: opacityValue.value,
  }));

  return (
    <Animated.View style={[styles.statCard, animatedStyle]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── Progress Ring ────────────────────────────────────
function ProgressRing({ percentage, size = 80, strokeWidth = 8 }: {
  percentage: number; size?: number; strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const fill = Math.max(0, Math.min(100, percentage));
  const offset = circumference - (fill / 100) * circumference;

  const getColor = (pct: number) => {
    if (pct >= 90) return '#10B981';
    if (pct >= 75) return '#6366F1';
    if (pct >= 60) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={[styles.progressRing, { width: size, height: size }]}>
      <View style={[styles.ringBackground, {
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: theme.colors.surfaceTertiary
      }]} />
      <View style={[styles.ringProgress, {
        width: size, height: size, borderRadius: size / 2,
        borderWidth: strokeWidth, borderColor: getColor(fill),
        borderLeftColor: 'transparent', borderBottomColor: 'transparent',
        transform: [{ rotate: `${(fill / 100) * 360 - 90}deg` }],
      }]} />
      <View style={styles.ringCenter}>
        <Text style={[styles.ringValue, { color: getColor(fill) }]}>{fill}%</Text>
      </View>
    </View>
  );
}

// ─── Student Card ─────────────────────────────────────
function StudentCard({ student, index, onOverride }: {
  student: LiveStudentStatus; index: number; onOverride: (id: string, status: 'present' | 'absent') => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const scaleValue = useSharedValue(0.95);

  useEffect(() => {
    const timer = setTimeout(() => {
      scaleValue.value = withSpring(1, { damping: 15, stiffness: 200 });
    }, index * 50);
    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const statusColors: Record<string, string> = {
    present: '#10B981',
    late: '#F59E0B',
    absent: '#EF4444',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    present: <CheckCircle size={16} color="#10B981" />,
    late: <Clock size={16} color="#F59E0B" />,
    absent: <XCircle size={16} color="#EF4444" />,
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'present': return 'Present';
      case 'late': return 'Late';
      case 'absent': return 'Absent';
      default: return status;
    }
  };

  return (
    <Animated.View style={[animatedStyle]} layout={Layout.springify()}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={[styles.studentCard, { borderLeftColor: statusColors[student.status] }]}
      >
        <View style={styles.studentHeader}>
          <View style={styles.studentInfo}>
            {statusIcons[student.status]}
            <View style={styles.studentText}>
              <Text style={styles.studentName}>{student.student_name}</Text>
              <Text style={styles.studentCode}>{student.student_code}</Text>
            </View>
          </View>
          <View style={styles.studentMeta}>
            {student.check_in_time && (
              <Text style={styles.checkInTime}>
                {new Date(student.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
            <View style={[styles.statusBadge, { backgroundColor: `${statusColors[student.status]}20` }]}>
              <Text style={[styles.statusText, { color: statusColors[student.status] }]}>
                {getStatusLabel(student.status)}
              </Text>
            </View>
          </View>
        </View>

        {expanded && (
          <Animated.View entering={FadeInDown} style={styles.studentExpanded}>
            <View style={styles.studentDetails}>
              {student.method && (
                <View style={styles.detailRow}>
                  <Zap size={14} color={theme.colors.brandPrimary} />
                  <Text style={styles.detailText}>via {student.method.toUpperCase()}</Text>
                </View>
              )}
              {student.check_in_time && (
                <View style={styles.detailRow}>
                  <Clock size={14} color={theme.colors.muted} />
                  <Text style={styles.detailText}>
                    Checked in at {new Date(student.check_in_time).toLocaleTimeString()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.studentActions}>
              {student.status === 'absent' && (
                <TouchableOpacity
                  style={styles.presentButton}
                  onPress={() => onOverride(student.student_id, 'present')}
                >
                  <UserCheck size={14} color="#FFF" />
                  <Text style={styles.presentButtonText}>Mark Present</Text>
                </TouchableOpacity>
              )}
              {student.status === 'present' && (
                <TouchableOpacity
                  style={styles.absentButton}
                  onPress={() => onOverride(student.student_id, 'absent')}
                >
                  <UserX size={14} color="#EF4444" />
                  <Text style={styles.absentButtonText}>Mark Absent</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Component ────────────────────────────────────
export default function AdvancedLiveAttendance() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    if (!sid) return;
    try {
      const result = await api(`/admin/attendance/live/${sid}`);
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load live attendance');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh]);

  useEffect(() => subscribeRealtime<{ sessionId?: string; scheduleId?: string }>('attendance:live:update', (payload) => {
    if (payload?.sessionId === sid || payload?.scheduleId === sid) fetchData();
  }), [fetchData, sid]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleSendNotifications = async () => {
    Alert.alert(
      'Send Absent Notifications',
      `Send notifications to ${data?.absent || 0} absent students and their parents?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              const result = await api('/admin/notifications/absentees', {
                method: 'POST',
                body: JSON.stringify({ course_id: data?.schedule?.course_id }),
              });
              Alert.alert('Sent', `${result.notifications_sent} notifications sent`);
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setSending(false);
            }
          }
        }
      ]
    );
  };

  const handleManualOverride = async (studentId: string, status: 'present' | 'absent') => {
    Alert.alert(
      `Mark as ${status === 'present' ? 'Present' : 'Absent'}`,
      `Override attendance status?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await api(`/admin/attendance/override/${sid}`, {
                method: 'POST',
                body: JSON.stringify({ student_id: studentId, status, reason: 'Manual override by admin' }),
              });
              fetchData();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const filteredStudents = useMemo(() => {
    return (data?.students || [])
      .filter((s: LiveStudentStatus) => filter === 'all' || s.status === filter)
      .filter((s: LiveStudentStatus) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.student_name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q);
      });
  }, [data?.students, filter, search]);

  const statusColors: Record<string, string> = {
    present: '#10B981',
    late: theme.colors.warning,
    absent: theme.colors.error,
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.colors.brand} size="large" />
          <Text style={styles.loadingText}>Loading live attendance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <AsyncView error={error} onRetry={fetchData} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{data?.schedule?.course_name || 'Live Class'}</Text>
          <Text style={styles.headerSub}>
            {data?.schedule?.classroom_name} • {data?.schedule?.day} {data?.schedule?.start_time}-{data?.schedule?.end_time}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsBtn}>
          <Settings size={20} color={theme.colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <AnimatedStatCard
          value={data?.present || 0}
          label="Present"
          color="#10B981"
          icon={<CheckCircle size={18} color="#10B981" />}
          delay={0}
        />
        <AnimatedStatCard
          value={data?.late || 0}
          label="Late"
          color="#F59E0B"
          icon={<Clock size={18} color="#F59E0B" />}
          delay={100}
        />
        <AnimatedStatCard
          value={data?.absent || 0}
          label="Absent"
          color="#EF4444"
          icon={<XCircle size={18} color="#EF4444" />}
          delay={200}
        />
        <AnimatedStatCard
          value={`${data?.percentage || 0}%`}
          label="Attendance"
          color={theme.colors.brand}
          icon={<Target size={18} color={theme.colors.brand} />}
          delay={300}
        />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.presentBar, {
            width: `${((data?.present || 0) / (data?.total_enrolled || 1)) * 100}%`
          }]} />
          <View style={[styles.lateBar, {
            width: `${((data?.late || 0) / (data?.total_enrolled || 1)) * 100}%`
          }]} />
        </View>
        <View style={styles.progressLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendText}>Present ({data?.present || 0})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Late ({data?.late || 0})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Absent ({data?.absent || 0})</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.searchBar}>
          <Search size={16} color={theme.colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search students..."
            placeholderTextColor={theme.colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <XCircle size={16} color={theme.colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
          {(['all', 'present', 'late', 'absent'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && {
                backgroundColor: f === 'all' ? theme.colors.brand : statusColors[f]
              }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && { color: '#FFF' }]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({data?.[f === 'all' ? 'total_enrolled' : f] || 0})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Student List */}
      <ScrollView
        style={styles.studentList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
      >
        {filteredStudents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={40} color={theme.colors.muted} />
            <Text style={styles.emptyText}>No students found</Text>
            <Text style={styles.emptySubtext}>
              {search ? 'Try a different search term' : 'No students match the current filter'}
            </Text>
          </View>
        ) : (
          filteredStudents.map((student: LiveStudentStatus, index: number) => (
            <StudentCard
              key={student.student_id}
              student={student}
              index={index}
              onOverride={handleManualOverride}
            />
          ))
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => fetchData()}
        >
          <RefreshCw size={18} color={theme.colors.brand} />
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.notifyBtn, sending && styles.notifyBtnDisabled]}
          onPress={handleSendNotifications}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Send size={18} color="#FFF" />
          )}
          <Text style={styles.notifyBtnText}>
            {sending ? 'Sending...' : `Notify Absent (${data?.absent || 0})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Session Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <XCircle size={20} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto Refresh</Text>
                <Text style={styles.settingDescription}>Automatically refresh attendance data every 10 seconds</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, autoRefresh && styles.toggleActive]}
                onPress={() => setAutoRefresh(!autoRefresh)}
              >
                <View style={[styles.toggleDot, autoRefresh && styles.toggleDotActive]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.settingButton} onPress={() => {
              setShowSettings(false);
              fetchData();
            }}>
              <RefreshCw size={16} color={theme.colors.brandPrimary} />
              <Text style={styles.settingButtonText}>Force Refresh Now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingButton} onPress={() => {
              setShowSettings(false);
              Alert.alert('Export', 'Export feature coming soon!');
            }}>
              <Download size={16} color={theme.colors.brandPrimary} />
              <Text style={styles.settingButtonText}>Export Attendance</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15, color: theme.colors.muted },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  headerSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  settingsBtn: { padding: 8 },

  // Stats
  statsContainer: { flexDirection: 'row', padding: 12, gap: 8 },
  statCard: { flex: 1, alignItems: 'center', backgroundColor: theme.colors.surface, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.muted, marginTop: 2 },

  // Progress
  progressContainer: { paddingHorizontal: 12, marginBottom: 12 },
  progressBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#FEE2E2' },
  presentBar: { height: 8, backgroundColor: '#10B981' },
  lateBar: { height: 8, backgroundColor: '#F59E0B' },
  progressLegend: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: theme.colors.muted },

  // Controls
  controls: { paddingHorizontal: 12, paddingVertical: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text, padding: 0 },
  filterBar: { marginTop: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.colors.surface, marginRight: 8, borderWidth: 1, borderColor: theme.colors.border },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.text },

  // Student List
  studentList: { flex: 1, padding: 12 },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: theme.colors.text, marginTop: 12 },
  emptySubtext: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },

  // Student Card
  studentCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  studentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  studentText: { flex: 1 },
  studentName: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  studentCode: { fontSize: 12, color: theme.colors.muted },
  studentMeta: { alignItems: 'flex-end' },
  checkInTime: { fontSize: 11, color: theme.colors.muted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 10, fontWeight: '700' },

  // Student Expanded
  studentExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  studentDetails: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  detailText: { fontSize: 12, color: theme.colors.muted },
  studentActions: { flexDirection: 'row', gap: 8 },
  presentButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  presentButtonText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  absentButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
  absentButtonText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  // Progress Ring
  progressRing: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringBackground: { position: 'absolute' },
  ringProgress: { position: 'absolute', borderTopColor: 'transparent', borderRightColor: 'transparent' },
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 16, fontWeight: '800' },

  // Bottom Bar
  bottomBar: { flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  refreshBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  refreshBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.brand },
  notifyBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 12, padding: 14 },
  notifyBtnDisabled: { opacity: 0.6 },
  notifyBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  settingInfo: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text },
  settingDescription: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: theme.colors.border, padding: 2 },
  toggleActive: { backgroundColor: theme.colors.brand },
  toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF' },
  toggleDotActive: { alignSelf: 'flex-end' },
  settingButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  settingButtonText: { fontSize: 14, fontWeight: '600', color: theme.colors.brand },
});
