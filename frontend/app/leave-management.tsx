import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable, TextInput,
  ActivityIndicator, RefreshControl, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from '@/src/navigation/router';
import {
  ArrowLeft, Plus, Calendar, Clock, CheckCircle2, XCircle, AlertTriangle,
  FileText, Send, Search, ChevronDown, ChevronRight,
  Stethoscope, User, GraduationCap, Heart, Briefcase,
  MessageSquare, X, Ban,
} from 'lucide-react-native';
import { theme } from '@/src/theme';
import { EmptyState } from '@/src/ui';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import Animated, { FadeInUp, SlideInRight, FadeIn } from 'react-native-reanimated';

type LeaveRequest = {
  id: string;
  student_name: string;
  student_email: string;
  date: string;
  reason: string;
  course_id: string | null;
  course_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  comment?: string;
};

type LeaveType = {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
};

const LEAVE_TYPES: LeaveType[] = [
  { key: 'sick', label: 'Sick Leave', icon: <Stethoscope size={16} color="#EF4444" />, color: '#EF4444', bgColor: 'rgba(239,68,68,0.1)' },
  { key: 'personal', label: 'Personal', icon: <User size={16} color="#6366F1" />, color: '#6366F1', bgColor: 'rgba(99,102,241,0.1)' },
  { key: 'medical', label: 'Medical', icon: <Heart size={16} color="#EC4899" />, color: '#EC4899', bgColor: 'rgba(236,72,153,0.1)' },
  { key: 'family', label: 'Family Emergency', icon: <Heart size={16} color="#F59E0B" />, color: '#F59E0B', bgColor: 'rgba(245,158,11,0.1)' },
  { key: 'academic', label: 'Academic', icon: <GraduationCap size={16} color="#10B981" />, color: '#10B981', bgColor: 'rgba(16,185,129,0.1)' },
  { key: 'official', label: 'Official Duty', icon: <Briefcase size={16} color="#3B82F6" />, color: '#3B82F6', bgColor: 'rgba(59,130,246,0.1)' },
];

const QUICK_REASONS = [
  'Not feeling well, need rest',
  'Family function / wedding',
  'Medical appointment',
  'Personal work',
  'Academic conference',
  'University exam preparation',
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function extractLeaveType(reason: string): LeaveType {
  for (const t of LEAVE_TYPES) {
    if (reason.includes(`[${t.label}]`)) return t;
  }
  return LEAVE_TYPES[0];
}

function cleanReason(reason: string): string {
  return reason.replace(/\[.*?\]\s*/, '');
}

function formatLeaveDate(dateStr: string): string {
  if (dateStr.includes(' to ')) {
    const [start, end] = dateStr.split(' to ');
    return `${start} → ${end}`;
  }
  return dateStr;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function validateDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isDateBefore(a: string, b: string): boolean {
  return new Date(a).getTime() < new Date(b).getTime();
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending': return '#F59E0B';
    case 'approved': return '#10B981';
    case 'rejected': return '#EF4444';
    default: return theme.colors.muted;
  }
}

function getStatusIcon(status: string, size = 14) {
  switch (status) {
    case 'pending': return <Clock size={size} color="#F59E0B" />;
    case 'approved': return <CheckCircle2 size={size} color="#10B981" />;
    case 'rejected': return <XCircle size={size} color="#EF4444" />;
    default: return <AlertTriangle size={size} color={theme.colors.muted} />;
  }
}

export default function LeaveManagement() {
  const { user } = useAuth();
  const router = useRouter();

  const { data: requests, loading, error, refresh: refetchRequests } = useFetch<LeaveRequest[]>('/attendance/leave-requests');
  const { data: courses } = useFetch<any[]>('/courses');
  const { mutate: submitLeave, loading: submitting } = useMutate('/attendance/leave-request');
  const { mutate: actOnRequest, loading: processingAction } = useMutate();

  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);

  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveType, setLeaveType] = useState('sick');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showQuickReasons, setShowQuickReasons] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [formErrors, setFormErrors] = useState<{ date?: string; endDate?: string; reason?: string }>({});

  const isFaculty = user?.role === 'faculty' || user?.role === 'college_admin';

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests
      .filter(r => filter === 'all' || r.status === filter)
      .filter(r => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          r.student_name.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q) ||
          (r.course_name && r.course_name.toLowerCase().includes(q))
        );
      });
  }, [requests, filter, search]);

  const stats = useMemo(() => {
    if (!requests) return { total: 0, pending: 0, approved: 0, rejected: 0 };
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
    };
  }, [requests]);

  const leaveBalance = useMemo(() => {
    if (!requests) return { sick: 5, personal: 3, medical: 4, family: 2, academic: 3, official: 2 };
    const approved = requests.filter(r => r.status === 'approved');
    const limits: Record<string, number> = { sick: 5, personal: 3, medical: 4, family: 2, academic: 3, official: 2 };
    const result: Record<string, number> = {};
    for (const [key, limit] of Object.entries(limits)) {
      const type = LEAVE_TYPES.find(t => t.key === key);
      const used = approved.filter(r => type && r.reason.includes(`[${type.label}]`)).length;
      result[key] = Math.max(0, limit - used);
    }
    return result;
  }, [requests]);

  const validateForm = useCallback((): boolean => {
    const errors: typeof formErrors = {};
    if (!leaveStartDate) {
      errors.date = 'Start date is required';
    } else if (!validateDate(leaveStartDate)) {
      errors.date = 'Use YYYY-MM-DD format';
    }
    if (leaveEndDate) {
      if (!validateDate(leaveEndDate)) {
        errors.endDate = 'Use YYYY-MM-DD format';
      } else if (leaveStartDate && validateDate(leaveStartDate) && !isDateBefore(leaveStartDate, leaveEndDate)) {
        errors.endDate = 'End date must be after start date';
      }
    }
    if (!leaveReason.trim()) {
      errors.reason = 'Reason is required';
    } else if (leaveReason.trim().length < 10) {
      errors.reason = 'Reason must be at least 10 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [leaveStartDate, leaveEndDate, leaveReason]);

  const resetForm = useCallback(() => {
    setLeaveStartDate('');
    setLeaveEndDate('');
    setLeaveReason('');
    setLeaveType('sick');
    setSelectedCourse('');
    setShowQuickReasons(false);
    setShowTypePicker(false);
    setFormErrors({});
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    resetForm();
  }, [resetForm]);

  const handleSubmitLeave = useCallback(async () => {
    if (!validateForm()) return;
    const typeLabel = LEAVE_TYPES.find(t => t.key === leaveType)?.label || 'Leave';
    const dateStr = leaveEndDate ? `${leaveStartDate} to ${leaveEndDate}` : leaveStartDate;
    const reasonStr = `[${typeLabel}] ${leaveReason.trim()}`;

    Alert.alert(
      'Confirm Submission',
      `Submit ${typeLabel} request for ${formatLeaveDate(dateStr)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await submitLeave({
                date: dateStr,
                reason: reasonStr,
                course_id: selectedCourse || undefined,
              });
              Alert.alert('Success', 'Leave request submitted successfully');
              setShowCreateModal(false);
              resetForm();
              refetchRequests();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to submit leave request');
            }
          },
        },
      ],
    );
  }, [validateForm, leaveType, leaveStartDate, leaveEndDate, leaveReason, selectedCourse, submitLeave, resetForm, refetchRequests]);

  const handleAction = useCallback(async (requestId: string, action: 'approved' | 'rejected') => {
    const label = action === 'approved' ? 'Approve' : 'Reject';
    Alert.alert(
      `${label} Request`,
      `Are you sure you want to ${label.toLowerCase()} this leave request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label,
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await actOnRequest(`/attendance/leave-request/${requestId}/action`, {
                method: 'POST',
                body: JSON.stringify({ action, comment: commentText || undefined }),
              });
              setCommentText('');
              setShowDetailModal(false);
              setSelectedRequest(null);
              refetchRequests();
            } catch (e: any) {
              Alert.alert('Error', e?.message || `Failed to ${action} request`);
            }
          },
        },
      ],
    );
  }, [actOnRequest, commentText, refetchRequests]);

  const handleWithdraw = useCallback(async (requestId: string) => {
    Alert.alert(
      'Withdraw Request',
      'Are you sure you want to withdraw this leave request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await actOnRequest(`/attendance/leave-request/${requestId}/action`, {
                method: 'POST',
                body: JSON.stringify({ action: 'rejected', comment: 'Withdrawn by student' }),
              });
              setShowDetailModal(false);
              setSelectedRequest(null);
              refetchRequests();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to withdraw request');
            }
          },
        },
      ],
    );
  }, [actOnRequest, refetchRequests]);

  const handleCardPress = useCallback((request: LeaveRequest) => {
    setSelectedRequest(request);
    setCommentText('');
    setShowDetailModal(true);
  }, []);

  const handleCloseDetailModal = useCallback(() => {
    setShowDetailModal(false);
    setSelectedRequest(null);
    setCommentText('');
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Leave Management</Text>
            <Text style={styles.headerSub}>Loading...</Text>
          </View>
        </View>
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map(i => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonTop}>
                <View style={styles.skeletonDot} />
                <View style={styles.skeletonLines}>
                  <View style={[styles.skeletonLine, { width: '60%' }]} />
                  <View style={[styles.skeletonLine, { width: '40%', height: 8 }]} />
                </View>
              </View>
              <View style={[styles.skeletonLine, { width: '80%', marginTop: 12 }]} />
              <View style={[styles.skeletonLine, { width: '50%', marginTop: 6, height: 8 }]} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (error && (!requests || requests.length === 0)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={22} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Leave Management</Text>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={theme.colors.error} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable onPress={() => refetchRequests()} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Leave Management</Text>
          <Text style={styles.headerSub}>{stats.total} requests · {stats.pending} pending</Text>
        </View>
        {!isFaculty && (
          <Pressable onPress={() => setShowCreateModal(true)} style={styles.addBtn}>
            <Plus size={20} color="#FFF" />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.balanceScroll} contentContainerStyle={styles.balanceContent}>
        {LEAVE_TYPES.map(t => (
          <View key={t.key} style={[styles.balanceCard, { borderColor: t.color + '30' }]}>
            <View style={[styles.balanceIconWrap, { backgroundColor: t.bgColor }]}>
              {t.icon}
            </View>
            <Text style={styles.balanceCount}>{leaveBalance[t.key] ?? 0}</Text>
            <Text style={styles.balanceLabel}>{t.label.replace(' Leave', '')}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.statsRow}>
        {[
          { label: 'Pending', value: stats.pending, color: '#F59E0B', icon: <Clock size={14} color="#F59E0B" /> },
          { label: 'Approved', value: stats.approved, color: '#10B981', icon: <CheckCircle2 size={14} color="#10B981" /> },
          { label: 'Rejected', value: stats.rejected, color: '#EF4444', icon: <XCircle size={14} color="#EF4444" /> },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <View style={styles.statRow}>
              {s.icon}
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            </View>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.controls}>
        <View style={styles.searchBar}>
          <Search size={16} color={theme.colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, reason, course..."
            placeholderTextColor={theme.colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <X size={14} color={theme.colors.muted} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
            <Pressable
              key={f}
              style={[styles.filterChip, filter === f && {
                backgroundColor: f === 'all' ? theme.colors.brandPrimary : getStatusColor(f),
              }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && { color: '#FFF' }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? stats.total : stats[f] || 0})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.listContainer}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetchRequests} tintColor={theme.colors.brandPrimary} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {!filteredRequests || filteredRequests.length === 0 ? (
          <EmptyState
            title="No leave requests"
            sub={search ? 'Try a different search' : filter !== 'all' ? `No ${filter} requests` : 'Submit your first leave request'}
            icon={<FileText size={48} color={theme.colors.muted} />}
          />
        ) : (
          filteredRequests.map((request, index) => {
            const typeInfo = extractLeaveType(request.reason);
            const cleanedReason = cleanReason(request.reason);
            const isMultiDay = request.date.includes(' to ');
            return (
              <Animated.View key={request.id} entering={SlideInRight.delay(index * 40)}>
                <Pressable
                  style={styles.requestCard}
                  onPress={() => handleCardPress(request)}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.typeDot, { backgroundColor: typeInfo.color }]} />
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{request.student_name}</Text>
                      <Text style={styles.cardCourse}>{request.course_name || 'General Leave'}</Text>
                    </View>
                    <View style={styles.cardRight}>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '18' }]}>
                        {getStatusIcon(request.status, 12)}
                        <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </Text>
                      </View>
                      <Text style={styles.timeAgo}>{getTimeAgo(request.created_at)}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBody}>
                    <View style={styles.dateRow}>
                      <View style={[styles.typeBadge, { backgroundColor: typeInfo.bgColor }]}>
                        {typeInfo.icon}
                        <Text style={[styles.typeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                      </View>
                      {isMultiDay && (
                        <View style={styles.multiDayBadge}>
                          <Calendar size={10} color="#6366F1" />
                          <Text style={styles.multiDayText}>Multi-day</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.dateInfo}>
                      <Calendar size={12} color={theme.colors.muted} />
                      <Text style={styles.dateText}>{formatLeaveDate(request.date)}</Text>
                    </View>
                    <Text style={styles.reasonText} numberOfLines={2}>{cleanedReason}</Text>
                  </View>

                  {request.comment && (
                    <View style={styles.commentPill}>
                      <MessageSquare size={10} color={theme.colors.muted} />
                      <Text style={styles.commentPillTxt} numberOfLines={1}>{request.comment}</Text>
                    </View>
                  )}

                  {isFaculty && request.status === 'pending' && (
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.approveBtn}
                        onPress={() => handleAction(request.id, 'approved')}
                        disabled={!!processingAction}
                      >
                        {processingAction ? (
                          <ActivityIndicator color="#FFF" size={12} />
                        ) : (
                          <CheckCircle2 size={14} color="#FFF" />
                        )}
                        <Text style={styles.approveBtnTxt}>Approve</Text>
                      </Pressable>
                      <Pressable
                        style={styles.rejectBtn}
                        onPress={() => handleAction(request.id, 'rejected')}
                        disabled={!!processingAction}
                      >
                        {processingAction ? (
                          <ActivityIndicator color="#EF4444" size={12} />
                        ) : (
                          <XCircle size={14} color="#EF4444" />
                        )}
                        <Text style={styles.rejectBtnTxt}>Reject</Text>
                      </Pressable>
                    </View>
                  )}

                  {!isFaculty && request.status === 'pending' && (
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.withdrawBtn}
                        onPress={() => handleWithdraw(request.id)}
                        disabled={!!processingAction}
                      >
                        <Ban size={14} color="#EF4444" />
                        <Text style={styles.withdrawBtnTxt}>Withdraw</Text>
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.footerTxt}>Submitted {getTimeAgo(request.created_at)}</Text>
                    <ChevronRight size={14} color={theme.colors.muted} />
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={handleCloseCreateModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleCloseCreateModal} />
          <Animated.View entering={FadeInUp} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Request Leave</Text>
                <Text style={styles.modalSub}>Fill in the details below</Text>
              </View>
              <Pressable onPress={handleCloseCreateModal} style={styles.modalClose}>
                <X size={20} color={theme.colors.muted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>
              <Text style={styles.formLabel}>Leave Type</Text>
              <Pressable style={styles.typePicker} onPress={() => setShowTypePicker(!showTypePicker)}>
                <View style={styles.typePickerLeft}>
                  {LEAVE_TYPES.find(t => t.key === leaveType)?.icon}
                  <Text style={styles.typePickerText}>{LEAVE_TYPES.find(t => t.key === leaveType)?.label}</Text>
                </View>
                <ChevronDown size={16} color={theme.colors.muted} style={showTypePicker ? { transform: [{ rotate: '180deg' }] } : {}} />
              </Pressable>

              {showTypePicker && (
                <View style={styles.typeDropdown}>
                  {LEAVE_TYPES.map(t => (
                    <Pressable
                      key={t.key}
                      style={[styles.typeOption, leaveType === t.key && { backgroundColor: t.bgColor }]}
                      onPress={() => { setLeaveType(t.key); setShowTypePicker(false); }}
                    >
                      <View style={styles.typeOptionLeft}>
                        {t.icon}
                        <Text style={[styles.typeOptionText, leaveType === t.key && { color: t.color }]}>{t.label}</Text>
                      </View>
                      {leaveType === t.key && <CheckCircle2 size={16} color={t.color} />}
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.formLabel}>Start Date *</Text>
              <TextInput
                style={[styles.formInput, formErrors.date && styles.formInputError]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.colors.muted}
                value={leaveStartDate}
                onChangeText={(text) => { setLeaveStartDate(text); if (formErrors.date) setFormErrors(prev => ({ ...prev, date: undefined })); }}
                keyboardType="default"
                maxLength={10}
              />
              {formErrors.date ? <Text style={styles.formError}>{formErrors.date}</Text> : null}

              <Text style={styles.formLabel}>End Date (optional)</Text>
              <TextInput
                style={[styles.formInput, formErrors.endDate && styles.formInputError]}
                placeholder="YYYY-MM-DD (for multi-day)"
                placeholderTextColor={theme.colors.muted}
                value={leaveEndDate}
                onChangeText={(text) => { setLeaveEndDate(text); if (formErrors.endDate) setFormErrors(prev => ({ ...prev, endDate: undefined })); }}
                keyboardType="default"
                maxLength={10}
              />
              {formErrors.endDate ? <Text style={styles.formError}>{formErrors.endDate}</Text> : null}
              {leaveEndDate && leaveStartDate && validateDate(leaveStartDate) && validateDate(leaveEndDate) && isDateBefore(leaveStartDate, leaveEndDate) && (
                <View style={styles.datePreview}>
                  <Calendar size={12} color="#6366F1" />
                  <Text style={styles.datePreviewTxt}>
                    {leaveStartDate} → {leaveEndDate}
                  </Text>
                </View>
              )}

              <Text style={styles.formLabel}>Reason *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea, formErrors.reason && styles.formInputError]}
                placeholder="Describe your reason for leave (min 10 characters)..."
                placeholderTextColor={theme.colors.muted}
                value={leaveReason}
                onChangeText={(text) => { setLeaveReason(text); if (formErrors.reason) setFormErrors(prev => ({ ...prev, reason: undefined })); }}
                multiline
                numberOfLines={3}
              />
              {formErrors.reason ? <Text style={styles.formError}>{formErrors.reason}</Text> : null}
              <Text style={styles.charCount}>{leaveReason.length} / 10 min</Text>
              <Pressable onPress={() => setShowQuickReasons(!showQuickReasons)} style={styles.quickToggle}>
                <Text style={styles.quickToggleTxt}>Quick reasons</Text>
                <ChevronDown size={14} color={theme.colors.brandPrimary} style={showQuickReasons ? { transform: [{ rotate: '180deg' }] } : {}} />
              </Pressable>
              {showQuickReasons && (
                <View style={styles.quickReasons}>
                  {QUICK_REASONS.map(r => (
                    <Pressable key={r} style={styles.quickChip} onPress={() => { setLeaveReason(r); setShowQuickReasons(false); if (formErrors.reason) setFormErrors(prev => ({ ...prev, reason: undefined })); }}>
                      <Text style={styles.quickChipTxt}>{r}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <Text style={styles.formLabel}>Course (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <Pressable
                  style={[styles.courseChip, !selectedCourse && styles.courseChipActive]}
                  onPress={() => setSelectedCourse('')}
                >
                  <Text style={[styles.courseChipText, !selectedCourse && styles.courseChipTextActive]}>General</Text>
                </Pressable>
                {(courses || []).map((c: any) => (
                  <Pressable
                    key={c.id || c._id}
                    style={[styles.courseChip, selectedCourse === (c.id || c._id) && styles.courseChipActive]}
                    onPress={() => setSelectedCourse(c.id || c._id)}
                  >
                    <Text style={[styles.courseChipText, selectedCourse === (c.id || c._id) && styles.courseChipTextActive]}>{c.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </ScrollView>

            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmitLeave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Send size={16} color="#FFF" />
                  <Text style={styles.submitBtnTxt}>Submit Request</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showDetailModal} transparent animationType="slide" onRequestClose={handleCloseDetailModal}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleCloseDetailModal} />
          <Animated.View entering={FadeIn} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave Details</Text>
              <Pressable onPress={handleCloseDetailModal} style={styles.modalClose}>
                <X size={20} color={theme.colors.muted} />
              </Pressable>
            </View>

            {selectedRequest && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '65%' }}>
                <View style={[styles.detailStatusBanner, { backgroundColor: getStatusColor(selectedRequest.status) + '15' }]}>
                  {getStatusIcon(selectedRequest.status, 24)}
                  <View>
                    <Text style={[styles.detailStatusTitle, { color: getStatusColor(selectedRequest.status) }]}>
                      {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                    </Text>
                    <Text style={styles.detailStatusSub}>Last updated {getTimeAgo(selectedRequest.updated_at)}</Text>
                  </View>
                </View>

                {(() => {
                  const typeInfo = extractLeaveType(selectedRequest.reason);
                  return (
                    <View style={[styles.detailTypeCard, { borderColor: typeInfo.color + '30' }]}>
                      <View style={[styles.detailTypeIcon, { backgroundColor: typeInfo.bgColor }]}>{typeInfo.icon}</View>
                      <View>
                        <Text style={[styles.detailTypeLabel, { color: typeInfo.color }]}>{typeInfo.label}</Text>
                        <Text style={styles.detailTypeSub}>{selectedRequest.course_name || 'General Leave'}</Text>
                      </View>
                    </View>
                  );
                })()}

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Student</Text>
                    <Text style={styles.detailItemValue}>{selectedRequest.student_name}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Email</Text>
                    <Text style={styles.detailItemValue}>{selectedRequest.student_email}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Date</Text>
                    <Text style={styles.detailItemValue}>{formatLeaveDate(selectedRequest.date)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailItemLabel}>Submitted</Text>
                    <Text style={styles.detailItemValue}>{new Date(selectedRequest.created_at).toLocaleString()}</Text>
                  </View>
                </View>

                <View style={styles.detailReasonSection}>
                  <Text style={styles.detailSectionTitle}>Reason</Text>
                  <Text style={styles.detailReasonText}>{cleanReason(selectedRequest.reason)}</Text>
                </View>

                {selectedRequest.comment && (
                  <View style={styles.detailCommentSection}>
                    <Text style={styles.detailSectionTitle}>Faculty Comment</Text>
                    <View style={styles.detailCommentBox}>
                      <MessageSquare size={14} color={theme.colors.muted} />
                      <Text style={styles.detailCommentText}>{selectedRequest.comment}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.timelineSection}>
                  <Text style={styles.detailSectionTitle}>Timeline</Text>
                  <View style={styles.timeline}>
                    <View style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: theme.colors.brandPrimary }]} />
                      <View style={styles.timelineLine} />
                      <View>
                        <Text style={styles.timelineTitle}>Request Submitted</Text>
                        <Text style={styles.timelineTime}>{new Date(selectedRequest.created_at).toLocaleString()}</Text>
                      </View>
                    </View>
                    {selectedRequest.status !== 'pending' && (
                      <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: getStatusColor(selectedRequest.status) }]} />
                        <View>
                          <Text style={styles.timelineTitle}>
                            {selectedRequest.status === 'approved' ? 'Approved' : 'Rejected'}
                          </Text>
                          <Text style={styles.timelineTime}>{new Date(selectedRequest.updated_at).toLocaleString()}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </View>

                {isFaculty && selectedRequest.status === 'pending' && (
                  <View style={styles.actionSection}>
                    <Text style={styles.detailSectionTitle}>Add Comment (optional)</Text>
                    <TextInput
                      style={styles.actionInput}
                      placeholder="Add a comment..."
                      placeholderTextColor={theme.colors.muted}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                    />
                    <View style={styles.actionBtns}>
                      <Pressable
                        style={styles.actionRejectBtn}
                        onPress={() => handleAction(selectedRequest.id, 'rejected')}
                        disabled={!!processingAction}
                      >
                        {processingAction ? (
                          <ActivityIndicator color="#EF4444" size={14} />
                        ) : (
                          <XCircle size={16} color="#EF4444" />
                        )}
                        <Text style={styles.actionRejectTxt}>Reject</Text>
                      </Pressable>
                      <Pressable
                        style={styles.actionApproveBtn}
                        onPress={() => handleAction(selectedRequest.id, 'approved')}
                        disabled={!!processingAction}
                      >
                        {processingAction ? (
                          <ActivityIndicator color="#FFF" size={14} />
                        ) : (
                          <CheckCircle2 size={16} color="#FFF" />
                        )}
                        <Text style={styles.actionApproveTxt}>Approve</Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {!isFaculty && selectedRequest.status === 'pending' && (
                  <View style={styles.actionSection}>
                    <Pressable
                      style={styles.actionWithdrawBtn}
                      onPress={() => handleWithdraw(selectedRequest.id)}
                      disabled={!!processingAction}
                    >
                      {processingAction ? (
                        <ActivityIndicator color="#EF4444" size={14} />
                      ) : (
                        <Ban size={16} color="#EF4444" />
                      )}
                      <Text style={styles.actionWithdrawTxt}>Withdraw Request</Text>
                    </Pressable>
                  </View>
                )}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  headerSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', ...theme.shadow.sm },

  skeletonContainer: { flex: 1, padding: 12 },
  skeletonCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  skeletonTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  skeletonDot: { width: 4, height: 36, borderRadius: 2, backgroundColor: theme.colors.surfaceTertiary },
  skeletonLines: { flex: 1, gap: 6 },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: theme.colors.surfaceTertiary },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  errorTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  errorSub: { fontSize: 13, color: theme.colors.muted, textAlign: 'center' },
  retryBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: theme.colors.brandPrimary, borderRadius: 8 },
  retryTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  balanceScroll: { maxHeight: 100 },
  balanceContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  balanceCard: { width: 80, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  balanceIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  balanceCount: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  balanceLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600', textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  statVal: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },

  controls: { paddingHorizontal: 12, paddingBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.text, padding: 0 },
  filterBar: { marginTop: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, marginRight: 8, borderWidth: 1, borderColor: theme.colors.border },
  filterText: { fontSize: 11, fontWeight: '600', color: theme.colors.text },

  listContainer: { flex: 1, padding: 12 },

  requestCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.xs },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  typeDot: { width: 4, height: 36, borderRadius: 2, marginRight: 10 },
  cardInfo: { flex: 1, marginRight: 8 },
  cardName: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  cardCourse: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '700' },
  timeAgo: { fontSize: 10, color: theme.colors.muted },

  cardBody: { marginBottom: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeText: { fontSize: 11, fontWeight: '600' },
  multiDayBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(99,102,241,0.08)' },
  multiDayText: { fontSize: 9, fontWeight: '600', color: '#6366F1' },
  dateInfo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  dateText: { fontSize: 12, color: theme.colors.muted },
  reasonText: { fontSize: 13, color: theme.colors.text, lineHeight: 18 },

  commentPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 6, marginBottom: 8 },
  commentPillTxt: { fontSize: 11, color: theme.colors.muted, flex: 1 },

  cardActions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8 },
  approveBtnTxt: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#EF4444' },
  rejectBtnTxt: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
  withdrawBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: '#EF4444', borderStyle: 'dashed' },
  withdrawBtnTxt: { fontSize: 12, fontWeight: '700', color: '#EF4444' },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  footerTxt: { fontSize: 10, color: theme.colors.muted },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1 },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  modalSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  modalClose: { padding: 4 },

  formLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  formInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.bg },
  formInputError: { borderColor: theme.colors.error },
  formTextArea: { height: 80, textAlignVertical: 'top' },
  formError: { fontSize: 11, color: theme.colors.error, marginTop: 4, fontWeight: '500' },
  charCount: { fontSize: 10, color: theme.colors.muted, textAlign: 'right', marginTop: 2 },

  typePicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: theme.colors.bg },
  typePickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typePickerText: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },

  typeDropdown: { marginTop: 4, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  typeOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  typeOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeOptionText: { fontSize: 13, color: theme.colors.text, fontWeight: '500' },

  datePreview: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 4 },
  datePreviewTxt: { fontSize: 12, color: '#6366F1', fontWeight: '600' },

  quickToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  quickToggleTxt: { fontSize: 12, color: theme.colors.brandPrimary, fontWeight: '600' },
  quickReasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  quickChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border },
  quickChipTxt: { fontSize: 11, color: theme.colors.text },

  courseChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8 },
  courseChipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  courseChipText: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
  courseChipTextActive: { color: '#FFF' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingVertical: 14, borderRadius: 10, marginTop: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnTxt: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  detailStatusBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, marginBottom: 12 },
  detailStatusTitle: { fontSize: 16, fontWeight: '800' },
  detailStatusSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  detailTypeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  detailTypeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  detailTypeLabel: { fontSize: 14, fontWeight: '700' },
  detailTypeSub: { fontSize: 11, color: theme.colors.muted },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  detailItem: { width: '48%', backgroundColor: theme.colors.bg, borderRadius: 8, padding: 10 },
  detailItemLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.muted, textTransform: 'uppercase', marginBottom: 2 },
  detailItemValue: { fontSize: 13, fontWeight: '600', color: theme.colors.text },

  detailSectionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.text, marginBottom: 6, textTransform: 'uppercase' },
  detailReasonSection: { marginBottom: 12 },
  detailReasonText: { fontSize: 14, color: theme.colors.text, lineHeight: 20, backgroundColor: theme.colors.bg, padding: 12, borderRadius: 8 },

  detailCommentSection: { marginBottom: 12 },
  detailCommentBox: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: theme.colors.bg, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  detailCommentText: { fontSize: 13, color: theme.colors.text, flex: 1 },

  timelineSection: { marginBottom: 16 },
  timeline: { paddingLeft: 8 },
  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { position: 'absolute', left: 4, top: 14, width: 2, height: 20, backgroundColor: theme.colors.border },
  timelineTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  timelineTime: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  actionSection: { marginTop: 4 },
  actionInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: theme.colors.text, backgroundColor: theme.colors.bg, marginBottom: 12, minHeight: 60, textAlignVertical: 'top' },
  actionBtns: { flexDirection: 'row', gap: 10 },
  actionRejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#EF4444' },
  actionRejectTxt: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  actionApproveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#10B981' },
  actionApproveTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  actionWithdrawBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#EF4444', borderStyle: 'dashed' },
  actionWithdrawTxt: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
});
