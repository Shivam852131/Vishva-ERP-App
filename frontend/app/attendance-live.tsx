import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from '@/src/navigation/router';
import { ArrowLeft, Users, CheckCircle, Clock, XCircle, Send, Filter, Search, ChevronDown, UserCheck, UserX, AlertTriangle } from 'lucide-react-native';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import type { LiveStudentStatus } from '@/src/types';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function LiveAttendanceScreen() {
  const { sid } = useLocalSearchParams<{ sid: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'present' | 'late' | 'absent'>('all');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  const fetchData = useCallback(async () => {
    if (!sid) return;
    try {
      const result = await api(`/admin/attendance/live/${sid}`);
      setData(result);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const filteredStudents = (data?.students || [])
    .filter((s: LiveStudentStatus) => filter === 'all' || s.status === filter)
    .filter((s: LiveStudentStatus) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.student_name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q);
    });

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading live attendance...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{data?.schedule?.course_name || 'Live Class'}</Text>
          <Text style={styles.headerSub}>{data?.schedule?.classroom_name} • {data?.schedule?.day} {data?.schedule?.start_time}-{data?.schedule?.end_time}</Text>
        </View>
      </View>

      <View style={styles.statsBar}>
        <View style={[styles.statsItem, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[styles.statsValue, { color: '#059669' }]}>{data?.present || 0}</Text>
          <Text style={styles.statsLabel}>Present</Text>
        </View>
        <View style={[styles.statsItem, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[styles.statsValue, { color: '#D97706' }]}>{data?.late || 0}</Text>
          <Text style={styles.statsLabel}>Late</Text>
        </View>
        <View style={[styles.statsItem, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statsValue, { color: '#DC2626' }]}>{data?.absent || 0}</Text>
          <Text style={styles.statsLabel}>Absent</Text>
        </View>
        <View style={[styles.statsItem, { backgroundColor: `${theme.colors.brand}15` }]}>
          <Text style={[styles.statsValue, { color: theme.colors.brand }]}>{data?.percentage || 0}%</Text>
          <Text style={styles.statsLabel}>Attendance</Text>
        </View>
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.presentBar, { width: `${((data?.present || 0) / (data?.total_enrolled || 1)) * 100}%` }]} />
        <View style={[styles.lateBar, { width: `${((data?.late || 0) / (data?.total_enrolled || 1)) * 100}%` }]} />
      </View>

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
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
          {(['all', 'present', 'late', 'absent'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && { backgroundColor: f === 'all' ? theme.colors.brand : statusColors[f] }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && { color: '#FFF' }]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({data?.[f === 'all' ? 'total_enrolled' : f] || 0})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={styles.studentList} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}>
        {filteredStudents.map((student: LiveStudentStatus) => (
          <View key={student.student_id} style={[styles.studentCard, { borderLeftColor: statusColors[student.status] }]}>
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
                    In: {new Date(student.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
                <View style={[styles.statusBadge, { backgroundColor: `${statusColors[student.status]}20` }]}>
                  <Text style={[styles.statusText, { color: statusColors[student.status] }]}>
                    {student.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
            {student.method && (
              <Text style={styles.methodText}>via {student.method.toUpperCase()}</Text>
            )}
            <View style={styles.studentActions}>
              {student.status === 'absent' && (
                <TouchableOpacity style={styles.markPresentBtn} onPress={() => handleManualOverride(student.student_id, 'present')}>
                  <UserCheck size={14} color="#FFF" />
                  <Text style={styles.markPresentText}>Mark Present</Text>
                </TouchableOpacity>
              )}
              {student.status === 'present' && (
                <TouchableOpacity style={styles.markAbsentBtn} onPress={() => handleManualOverride(student.student_id, 'absent')}>
                  <UserX size={14} color="#EF4444" />
                  <Text style={styles.markAbsentText}>Mark Absent</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.notifyBtn} onPress={handleSendNotifications} disabled={sending}>
          <Send size={18} color="#FFF" />
          <Text style={styles.notifyBtnText}>{sending ? 'Sending...' : `Notify Absent (${data?.absent || 0})`}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 15, color: theme.colors.muted },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.colors.text },
  headerSub: { fontSize: 13, color: theme.colors.muted, marginTop: 2 },
  statsBar: { flexDirection: 'row', padding: 12, gap: 8 },
  statsItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  statsValue: { fontSize: 20, fontWeight: '800' },
  statsLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.muted, marginTop: 2 },
  progressBar: { flexDirection: 'row', height: 6, marginHorizontal: 12, borderRadius: 3, overflow: 'hidden', backgroundColor: '#FEE2E2' },
  presentBar: { height: 6, backgroundColor: '#10B981' },
  lateBar: { height: 6, backgroundColor: '#F59E0B' },
  controls: { paddingHorizontal: 12, paddingVertical: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text, padding: 0 },
  filterBar: { marginTop: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.colors.surface, marginRight: 8, borderWidth: 1, borderColor: theme.colors.border },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
  studentList: { flex: 1, padding: 12 },
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
  methodText: { fontSize: 11, color: theme.colors.muted, marginTop: 4, marginLeft: 26 },
  studentActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  markPresentBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  markPresentText: { fontSize: 12, fontWeight: '600', color: '#FFF' },
  markAbsentBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#EF4444' },
  markAbsentText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  bottomBar: { padding: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  notifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 12, padding: 14 },
  notifyBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
