import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import {
  User,
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Plus,
  Send,
  X,
  Phone,
  MessageCircle,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Award,
  BookOpen,
  ArrowUpRight,
  Download,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { ParentDashboardData, AttendanceData, AttendanceByCourse } from '@/src/types';
import { theme } from '@/src/theme';
import { Card, StatCard, EmptyState, AsyncView } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { subscribeRealtime } from '@/src/realtime/socket';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LeaveRequestItem {
  id: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  course_name?: string;
  created_at?: string;
}

export default function ParentAttendanceScreen() {
  const { user: parent } = useAuth();

  // 1. Fetch parent dashboard to get ward profile
  const {
    data: parentData,
    loading: parentLoading,
    refresh: refreshParent,
  } = useFetch<ParentDashboardData>('/dashboard/parent');

  // 2. Fetch ward's attendance details
  const {
    data: attData,
    loading: attLoading,
    refresh: refreshAtt,
  } = useFetch<AttendanceData>('/attendance/me');

  // 3. Fetch leave requests
  const {
    data: leaveRequests,
    loading: leavesLoading,
    refresh: refreshLeaves,
  } = useFetch<LeaveRequestItem[]>('/attendance/leave-requests');

  const { mutate: submitLeave, loading: submittingLeave } = useMutate<any>();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'timeline' | 'leaves'>('overview');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  // Socket real-time updates
  useEffect(() => {
    const unsub1 = subscribeRealtime('attendance:session:update', () => {
      refreshAtt();
      refreshParent();
    });
    const unsub2 = subscribeRealtime('attendance:live:update', () => {
      refreshAtt();
      refreshParent();
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, [refreshAtt, refreshParent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshParent(), refreshAtt(), refreshLeaves()]);
    setRefreshing(false);
  }, [refreshParent, refreshAtt, refreshLeaves]);

  const child = parentData?.child;
  const records = useMemo(() => (Array.isArray(attData?.records) ? attData.records : []), [attData?.records]);
  const byCourse = useMemo(() => (Array.isArray(attData?.by_course) ? attData.by_course : []), [attData?.by_course]);

  // Aggregate stats
  const totalClasses = records.length;
  const attendedClasses = records.filter((r) => r.status === 'present' || r.status === 'late').length;
  const absentClasses = records.filter((r) => r.status === 'absent').length;
  const overallPercentage = totalClasses > 0
    ? Math.round((attendedClasses / totalClasses) * 100)
    : (parentData?.attendance || 0);

  const isEligible = overallPercentage >= 75;

  // Filter today's records
  const todayStr = new Date().toISOString().split('T')[0];
  const todayRecords = records.filter((r) => r.date === todayStr);

  const handleApplyLeave = async () => {
    if (!leaveDate.trim() || !leaveReason.trim()) {
      Alert.alert('Missing Fields', 'Please specify both the date and reason for leave.');
      return;
    }
    try {
      await submitLeave('/attendance/leave-request', {
        method: 'POST',
        body: JSON.stringify({
          date: leaveDate.trim(),
          reason: leaveReason.trim(),
          course_id: selectedCourseId || undefined,
          student_id: child?.id,
        }),
      });
      Alert.alert('Success', 'Leave excuse request submitted to the department.');
      setShowLeaveModal(false);
      setLeaveDate('');
      setLeaveReason('');
      setSelectedCourseId('');
      refreshLeaves();
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Failed to submit leave request');
    }
  };

  const contactFaculty = (contactType: 'call' | 'msg') => {
    if (contactType === 'call') {
      Linking.openURL('tel:9876543210').catch(() =>
        Alert.alert('Contact', 'Advisor Hotline: +91 98765 43210')
      );
    } else {
      Linking.openURL('sms:9876543210').catch(() =>
        Alert.alert('Contact', 'Advisor SMS: +91 98765 43210')
      );
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.headerSubtitle}>Parental Oversight</Text>
            <Text style={styles.headerTitle}>Ward Attendance</Text>
          </View>
          <Pressable
            onPress={() => setShowLeaveModal(true)}
            style={styles.applyLeaveBtn}
            accessibilityLabel="Apply Leave for Ward"
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.applyLeaveBtnText}>Apply Leave</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.brandPrimary}
            />
          }
        >
          {/* Ward Identification Banner */}
          <LinearGradient
            colors={isEligible ? ['#065F46', '#047857', '#10B981'] : ['#991B1B', '#B91C1C', '#EF4444']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.wardCard}
          >
            <View style={styles.wardCardTop}>
              <View style={styles.wardAvatar}>
                <Text style={styles.wardAvatarText}>
                  {child?.name ? child.name[0].toUpperCase() : 'S'}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.wardName} numberOfLines={1}>
                  {child?.name || 'Enrolled Student'}
                </Text>
                <Text style={styles.wardMeta}>
                  {child?.department || 'Department of Engg'} · Year {child?.year || 1} · {child?.student_id || 'ID: Active'}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: isEligible ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)' }]}>
                <ShieldCheck size={14} color="#FFFFFF" />
                <Text style={styles.statusBadgeText}>
                  {isEligible ? 'Eligible' : 'Defaulter'}
                </Text>
              </View>
            </View>

            {/* Attendance Circular Dial & Health Metrics */}
            <View style={styles.wardGaugeRow}>
              <View style={styles.dialContainer}>
                <View style={[styles.dialOuter, { borderColor: isEligible ? '#34D399' : '#FCA5A5' }]}>
                  <Text style={styles.dialValue}>{overallPercentage}%</Text>
                  <Text style={styles.dialLabel}>Aggregate</Text>
                </View>
              </View>

              <View style={styles.metricsCol}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Total Sessions</Text>
                  <Text style={styles.metricValue}>{totalClasses}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Present</Text>
                  <Text style={[styles.metricValue, { color: '#D1FAE5' }]}>{attendedClasses}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>Missed</Text>
                  <Text style={[styles.metricValue, { color: '#FEE2E2' }]}>{absentClasses}</Text>
                </View>
              </View>
            </View>

            {/* University 75% Regulatory Status */}
            <View style={styles.thresholdBanner}>
              {isEligible ? (
                <View style={styles.thresholdRow}>
                  <CheckCircle2 size={16} color="#A7F3D0" />
                  <Text style={styles.thresholdText}>
                    Exceeds minimum 75% university examination criteria.
                  </Text>
                </View>
              ) : (
                <View style={styles.thresholdRow}>
                  <AlertTriangle size={16} color="#FEF08A" />
                  <Text style={[styles.thresholdText, { color: '#FEF08A' }]}>
                    Attention: Ward attendance is below the 75% mandatory threshold.
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>

          {/* Quick Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              onPress={() => setActiveTab('overview')}
              style={[styles.tabBtn, activeTab === 'overview' && styles.tabBtnActive]}
            >
              <Award size={16} color={activeTab === 'overview' ? theme.colors.brand : theme.colors.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'overview' && styles.tabBtnTextActive]}>
                Summary
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('courses')}
              style={[styles.tabBtn, activeTab === 'courses' && styles.tabBtnActive]}
            >
              <BookOpen size={16} color={activeTab === 'courses' ? theme.colors.brand : theme.colors.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'courses' && styles.tabBtnTextActive]}>
                Courses ({byCourse.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('timeline')}
              style={[styles.tabBtn, activeTab === 'timeline' && styles.tabBtnActive]}
            >
              <Clock size={16} color={activeTab === 'timeline' ? theme.colors.brand : theme.colors.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'timeline' && styles.tabBtnTextActive]}>
                Recent ({records.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('leaves')}
              style={[styles.tabBtn, activeTab === 'leaves' && styles.tabBtnActive]}
            >
              <FileText size={16} color={activeTab === 'leaves' ? theme.colors.brand : theme.colors.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'leaves' && styles.tabBtnTextActive]}>
                Leaves ({(leaveRequests || []).length})
              </Text>
            </Pressable>
          </View>

          {/* TAB 1: OVERVIEW & TODAY'S TIMELINE */}
          {activeTab === 'overview' && (
            <View style={styles.tabContent}>
              {/* Today's Schedule Card */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Today's Classes</Text>
                <Text style={styles.sectionDate}>
                  {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>

              {todayRecords.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Calendar size={28} color={theme.colors.muted} />
                  <Text style={styles.emptyCardTitle}>No Attendance Records Today</Text>
                  <Text style={styles.emptyCardSub}>
                    Classes in session will automatically log presence here in real-time.
                  </Text>
                </View>
              ) : (
                todayRecords.map((r, i) => {
                  const isPresent = r.status === 'present' || r.status === 'late';
                  return (
                    <View key={r.id || i} style={styles.timelineItem}>
                      <View
                        style={[
                          styles.timelineIndicator,
                          { backgroundColor: isPresent ? theme.colors.success : theme.colors.error },
                        ]}
                      >
                        {isPresent ? (
                          <CheckCircle2 size={16} color="#FFFFFF" />
                        ) : (
                          <XCircle size={16} color="#FFFFFF" />
                        )}
                      </View>
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineCourse}>{r.courseName || r.course_name || 'Class Session'}</Text>
                        <Text style={styles.timelineStatus}>
                          Status: <Text style={{ color: isPresent ? theme.colors.success : theme.colors.error, fontWeight: '700' }}>
                            {(r.status || (r.present ? 'present' : 'absent')).toUpperCase()}
                          </Text>
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              {/* Faculty Advisor Connect */}
              <View style={styles.advisorCard}>
                <View style={styles.advisorHeader}>
                  <View style={styles.advisorAvatar}>
                    <User size={20} color={theme.colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.advisorTitle}>Class Advisor Support</Text>
                    <Text style={styles.advisorSub}>
                      Have concerns about your child's attendance or academic progress?
                    </Text>
                  </View>
                </View>
                <View style={styles.advisorActions}>
                  <Pressable
                    onPress={() => contactFaculty('call')}
                    style={styles.advisorCallBtn}
                    accessibilityLabel="Call Class Advisor"
                  >
                    <Phone size={14} color={theme.colors.brandPrimary} />
                    <Text style={styles.advisorCallBtnText}>Call Advisor</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => contactFaculty('msg')}
                    style={styles.advisorMsgBtn}
                    accessibilityLabel="Message Class Advisor"
                  >
                    <MessageCircle size={14} color="#FFFFFF" />
                    <Text style={styles.advisorMsgBtnText}>Send Message</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* TAB 2: COURSE BREAKDOWN */}
          {activeTab === 'courses' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Course-by-Course Attendance</Text>
              {byCourse.length === 0 ? (
                <View style={styles.emptyCard}>
                  <BookOpen size={28} color={theme.colors.muted} />
                  <Text style={styles.emptyCardTitle}>No Enrolled Courses Found</Text>
                  <Text style={styles.emptyCardSub}>Course statistics will appear once attendance is logged.</Text>
                </View>
              ) : (
                byCourse.map((c, i) => {
                  const safe = c.percentage >= 75;
                  return (
                    <View key={c.course_id || i} style={styles.courseItemCard}>
                      <View style={styles.courseHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.courseName}>{c.course_name}</Text>
                          <Text style={styles.courseSub}>
                            {c.present} attended of {c.total} classes
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.coursePctBadge,
                            { backgroundColor: safe ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.coursePctText,
                              { color: safe ? theme.colors.success : theme.colors.error },
                            ]}
                          >
                            {c.percentage}%
                          </Text>
                        </View>
                      </View>

                      {/* Progress Track */}
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(100, Math.max(0, c.percentage))}%`,
                              backgroundColor: safe ? theme.colors.success : theme.colors.error,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.courseFooter}>
                        <Text style={[styles.courseEligibility, { color: safe ? theme.colors.success : theme.colors.error }]}>
                          {safe ? '✓ Exam Eligible' : '⚠ Shortage Warning'}
                        </Text>
                        <Pressable
                          onPress={() => {
                            setSelectedCourseId(c.course_id);
                            setShowLeaveModal(true);
                          }}
                          style={styles.courseExcuseBtn}
                        >
                          <Text style={styles.courseExcuseBtnText}>Submit Excuse</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 3: RECENT TIMELINE */}
          {activeTab === 'timeline' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Historical Class Attendance Log</Text>
              {records.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Clock size={28} color={theme.colors.muted} />
                  <Text style={styles.emptyCardTitle}>No Attendance Records</Text>
                  <Text style={styles.emptyCardSub}>Past attendance sessions will appear here.</Text>
                </View>
              ) : (
                records.slice(0, 30).map((r, i) => {
                  const isPresent = r.status === 'present' || r.status === 'late';
                  return (
                    <View key={r.id || i} style={styles.recordRow}>
                      <View
                        style={[
                          styles.recordIconBox,
                          { backgroundColor: isPresent ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)' },
                        ]}
                      >
                        {isPresent ? (
                          <CheckCircle2 size={16} color={theme.colors.success} />
                        ) : (
                          <XCircle size={16} color={theme.colors.error} />
                        )}
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.recordCourse}>{r.courseName || r.course_name || 'Class Lecture'}</Text>
                        <Text style={styles.recordDate}>{r.date}</Text>
                      </View>
                      <View
                        style={[
                          styles.recordStatusBadge,
                          { backgroundColor: isPresent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.recordStatusText,
                            { color: isPresent ? theme.colors.success : theme.colors.error },
                          ]}
                        >
                          {(r.status || (r.present ? 'present' : 'absent')).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 4: LEAVE REQUESTS */}
          {activeTab === 'leaves' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Submitted Leave Requests</Text>
                <Pressable
                  onPress={() => setShowLeaveModal(true)}
                  style={styles.smallAddBtn}
                >
                  <Plus size={14} color={theme.colors.brand} />
                  <Text style={styles.smallAddBtnText}>New Request</Text>
                </Pressable>
              </View>

              {(!leaveRequests || leaveRequests.length === 0) ? (
                <View style={styles.emptyCard}>
                  <FileText size={28} color={theme.colors.muted} />
                  <Text style={styles.emptyCardTitle}>No Leave Requests</Text>
                  <Text style={styles.emptyCardSub}>
                    Submit a formal medical or personal leave request for your ward to notify faculty.
                  </Text>
                </View>
              ) : (
                leaveRequests.map((l, i) => (
                  <View key={l.id || i} style={styles.leaveCard}>
                    <View style={styles.leaveCardTop}>
                      <Text style={styles.leaveDate}>For Date: {l.date}</Text>
                      <View
                        style={[
                          styles.leaveStatusPill,
                          {
                            backgroundColor:
                              l.status === 'approved'
                                ? 'rgba(16, 185, 129, 0.15)'
                                : l.status === 'rejected'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.leaveStatusPillText,
                            {
                              color:
                                l.status === 'approved'
                                  ? theme.colors.success
                                  : l.status === 'rejected'
                                  ? theme.colors.error
                                  : theme.colors.warning,
                            },
                          ]}
                        >
                          {l.status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.leaveReason}>{l.reason}</Text>
                    {l.course_name ? (
                      <Text style={styles.leaveCourseMeta}>Course: {l.course_name}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* APPLY LEAVE / EXCUSE NOTE MODAL */}
        <Modal
          visible={showLeaveModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLeaveModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Submit Leave Note</Text>
                  <Text style={styles.modalSubtitle}>Excuse request for {child?.name || 'your ward'}</Text>
                </View>
                <Pressable onPress={() => setShowLeaveModal(false)} style={styles.modalCloseBtn}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>

              <View style={styles.modalForm}>
                <Text style={styles.inputLabel}>Date of Absence (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder={todayStr}
                  placeholderTextColor={theme.colors.muted}
                  value={leaveDate}
                  onChangeText={setLeaveDate}
                />

                <Text style={styles.inputLabel}>Reason / Medical Note</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="E.g. Medical illness (fever), family function..."
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  numberOfLines={4}
                  value={leaveReason}
                  onChangeText={setLeaveReason}
                />

                {byCourse.length > 0 && (
                  <>
                    <Text style={styles.inputLabel}>Course (Optional - Leave blank for full day)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.coursePickerScroll}>
                      <Pressable
                        onPress={() => setSelectedCourseId('')}
                        style={[styles.courseChip, !selectedCourseId && styles.courseChipActive]}
                      >
                        <Text style={[styles.courseChipText, !selectedCourseId && styles.courseChipTextActive]}>
                          Full Day
                        </Text>
                      </Pressable>
                      {byCourse.map((c) => (
                        <Pressable
                          key={c.course_id}
                          onPress={() => setSelectedCourseId(c.course_id)}
                          style={[styles.courseChip, selectedCourseId === c.course_id && styles.courseChipActive]}
                        >
                          <Text
                            style={[
                              styles.courseChipText,
                              selectedCourseId === c.course_id && styles.courseChipTextActive,
                            ]}
                          >
                            {c.course_name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </>
                )}

                <Pressable
                  onPress={handleApplyLeave}
                  disabled={submittingLeave}
                  style={styles.submitBtn}
                >
                  {submittingLeave ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Send size={16} color="#FFFFFF" />
                      <Text style={styles.submitBtnText}>Submit to Faculty Advisor</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  applyLeaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.brandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    ...theme.shadow.sm,
  },
  applyLeaveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
  },
  wardCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    ...theme.shadow.md,
  },
  wardCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wardAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  wardName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  wardMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  wardGaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  dialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialOuter: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dialValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  dialLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  metricsCol: {
    flex: 1,
    marginLeft: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 4,
  },
  thresholdBanner: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thresholdText: {
    fontSize: 12,
    color: '#A7F3D0',
    fontWeight: '600',
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: 4,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.brandTertiary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  tabBtnTextActive: {
    color: theme.colors.brand,
    fontWeight: '700',
  },
  tabContent: {
    marginTop: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  sectionDate: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 8,
  },
  emptyCardSub: {
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timelineIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineBody: {
    flex: 1,
    marginLeft: 12,
  },
  timelineCourse: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  timelineStatus: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  advisorCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  advisorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  advisorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advisorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  advisorSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  advisorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: theme.spacing.md,
  },
  advisorCallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.brandTertiary,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  advisorCallBtnText: {
    color: theme.colors.brandPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  advisorMsgBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.brandPrimary,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  advisorMsgBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  courseItemCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  courseSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  coursePctBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  coursePctText: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressTrack: {
    height: 6,
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  courseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  courseEligibility: {
    fontSize: 12,
    fontWeight: '700',
  },
  courseExcuseBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  courseExcuseBtnText: {
    color: theme.colors.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recordIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCourse: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  recordDate: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  recordStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  recordStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  smallAddBtnText: {
    color: theme.colors.brand,
    fontSize: 12,
    fontWeight: '700',
  },
  leaveCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  leaveCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaveDate: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
  },
  leaveStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  leaveStatusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  leaveReason: {
    fontSize: 13,
    color: theme.colors.text,
    marginTop: 6,
  },
  leaveCourseMeta: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    ...theme.shadow.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalForm: {
    marginTop: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  coursePickerScroll: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  courseChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceTertiary,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  courseChipActive: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
  },
  courseChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  courseChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.xl,
    ...theme.shadow.md,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
