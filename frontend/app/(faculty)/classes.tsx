import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import {
  Radio,
  ChevronRight,
  QrCode,
  MapPin,
  ScanFace,
  Zap,
  X,
  CheckCircle,
  Users,
} from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Course } from '@/src/types';
import { theme } from '@/src/theme';
import {
  Card,
  SectionTitle,
  EmptyState,
  ChipBtn,
  StatCard,
  GradientButton,
} from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { subscribeRealtime } from '@/src/realtime/socket';

interface AttendanceSession {
  id: string;
  course_name: string;
  method: string;
  code: string;
  starts_at: string;
  expires_at: string;
  active: boolean;
  checkins: number;
}

const METHODS = [
  { key: 'qr', label: 'QR Code', icon: QrCode },
  { key: 'gps', label: 'GPS', icon: MapPin },
  { key: 'face', label: 'Face ID', icon: ScanFace },
  { key: 'auto', label: 'Auto', icon: Zap },
];

export default function FacultyClasses() {
  const { data: courses, loading: loadingCourses, refresh: refreshCourses } =
    useFetch<Course[]>('/courses');
  const {
    data: sessions,
    loading: loadingSessions,
    refresh: refreshSessions,
  } = useFetch<AttendanceSession[]>('/attendance/sessions/mine');
  const { mutate: startSession, loading: starting } = useMutate();
  const { mutate: closeSession, loading: closing } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<string>('qr');
  const [duration, setDuration] = useState<number>(15);
  const [closingId, setClosingId] = useState<string | null>(null);

  useEffect(() => {
    if ((!loadingCourses || !loadingSessions) && refreshing) setRefreshing(false);
  }, [loadingCourses, loadingSessions, refreshing]);

  useEffect(() => subscribeRealtime('attendance:session:update', () => refreshSessions()), [refreshSessions]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshCourses();
    refreshSessions();
  }, [refreshCourses, refreshSessions]);

  const handleStartSession = async () => {
    if (!selectedCourse) return;
    try {
      await startSession('/attendance/sessions', {
        method: 'POST',
        body: JSON.stringify({
          course_id: selectedCourse,
          method: selectedMethod,
          duration_min: duration,
        }),
      });
      setModalVisible(false);
      setSelectedCourse('');
      refreshSessions();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not start session');
    }
  };

  const handleCloseSession = async (sid: string) => {
    setClosingId(sid);
    try {
      await closeSession(`/attendance/sessions/${sid}/close`, {
        method: 'POST',
      });
      refreshSessions();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not close session');
    }
    setClosingId(null);
  };

  const activeSessions = (sessions || []).filter((s) => s.active);
  const endedSessions = (sessions || []).filter((s) => !s.active);

  return (
    <ErrorBoundary>
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>My Classes</Text>
            <Text style={styles.subtitle}>
              Courses & attendance sessions
            </Text>
          </View>
          <Pressable
            testID="take-attendance"
            accessibilityLabel="Start attendance session"
            onPress={() => setModalVisible(true)}
            style={styles.takeBtn}
          >
            <QrCode color="#fff" size={18} />
            <Text style={styles.takeTxt}>Take Attendance</Text>
          </Pressable>
        </View>

        {loadingCourses && !courses ? (
          <ActivityIndicator
            style={{ marginTop: 40 }}
            color={theme.colors.brandPrimary}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.colors.brandPrimary}
              />
            }
          >
            {activeSessions.length > 0 && (
              <>
                <SectionTitle title="Active Sessions" />
                <View style={styles.sessionsContainer}>
                  {activeSessions.map((s) => (
                    <Card key={s.id} style={styles.sessionCard}>
                      <View style={styles.sessionRow}>
                        <View
                          style={[
                            styles.liveDot,
                            { backgroundColor: theme.colors.success },
                          ]}
                        >
                          <Radio color="#fff" size={12} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sessionName}>
                            {s.course_name}
                          </Text>
                          <Text style={styles.sessionMeta}>
                            {s.method.toUpperCase()} · Code: {s.code}
                          </Text>
                          <View style={styles.sessionCheckins}>
                            <Users
                              size={12}
                              color={theme.colors.brandSecondary}
                            />
                            <Text style={styles.checkinText}>
                              {s.checkins} checked in · LIVE
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          testID={`close-session-${s.id}`}
                          accessibilityLabel={`Close ${s.course_name} session`}
                          onPress={() => handleCloseSession(s.id)}
                          disabled={closingId === s.id}
                          style={styles.closeBtn}
                        >
                          {closingId === s.id ? (
                            <ActivityIndicator
                              size="small"
                              color={theme.colors.error}
                            />
                          ) : (
                            <X
                              size={16}
                              color={theme.colors.error}
                            />
                          )}
                        </Pressable>
                      </View>
                    </Card>
                  ))}
                </View>
              </>
            )}

            {endedSessions.length > 0 && (
              <>
                <SectionTitle title="Past Sessions" />
                <View style={styles.sessionsContainer}>
                  {endedSessions.slice(0, 10).map((s) => (
                    <Card key={s.id} style={styles.sessionCard}>
                      <View style={styles.sessionRow}>
                        <View
                          style={[
                            styles.liveDot,
                            { backgroundColor: theme.colors.borderStrong },
                          ]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sessionName}>
                            {s.course_name}
                          </Text>
                          <Text style={styles.sessionMeta}>
                            {s.method.toUpperCase()} · {s.checkins} checked in
                          </Text>
                        </View>
                        <CheckCircle
                          size={16}
                          color={theme.colors.muted}
                        />
                      </View>
                    </Card>
                  ))}
                </View>
              </>
            )}

            <SectionTitle title="Your Courses" />
            {(courses || []).length === 0 ? (
              <EmptyState
                title="No courses"
                sub="No courses are assigned to you yet."
                icon="📚"
              />
            ) : (
              <View style={styles.coursesContainer}>
                {(courses || []).map((c) => (
                  <Card key={c.id} style={styles.courseCard}>
                    <View
                      style={[
                        styles.courseAccent,
                        {
                          backgroundColor:
                            c.color || theme.colors.brand,
                        },
                      ]}
                    />
                    <View style={styles.courseBody}>
                      <Text style={styles.courseCode}>{c.code}</Text>
                      <Text style={styles.courseName}>{c.name}</Text>
                      <Text style={styles.courseMeta}>
                        {c.credits} credits
                      </Text>
                    </View>
                    <ChevronRight
                      size={16}
                      color={theme.colors.muted}
                    />
                  </Card>
                ))}
              </View>
            )}
          </ScrollView>
        )}

        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>
                  Start Attendance Session
                </Text>
                <Pressable
                  testID="close-modal"
                  accessibilityLabel="Close modal"
                  onPress={() => setModalVisible(false)}
                >
                  <X color={theme.colors.onSurface} size={22} />
                </Pressable>
              </View>

              <Text style={styles.label}>Select Course</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {(courses || []).map((c) => (
                  <ChipBtn
                    key={c.id}
                    testID={`course-${c.id}`}
                    label={c.code}
                    active={selectedCourse === c.id}
                    onPress={() => setSelectedCourse(c.id)}
                  />
                ))}
              </ScrollView>

              <Text style={styles.label}>Attendance Method</Text>
              <View style={styles.methodRow}>
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = selectedMethod === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      testID={`method-${m.key}`}
                      accessibilityLabel={m.label}
                      onPress={() => setSelectedMethod(m.key)}
                      style={[
                        styles.methodBtn,
                        active && styles.methodBtnActive,
                      ]}
                    >
                      <Icon
                        size={18}
                        color={
                          active
                            ? '#fff'
                            : theme.colors.onSurfaceTertiary
                        }
                      />
                      <Text
                        style={[
                          styles.methodLabel,
                          active && { color: '#fff' },
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Duration (minutes)</Text>
              <View style={styles.durRow}>
                {[5, 10, 15, 30, 60].map((d) => (
                  <ChipBtn
                    key={d}
                    testID={`dur-${d}`}
                    label={`${d}m`}
                    active={duration === d}
                    onPress={() => setDuration(d)}
                  />
                ))}
              </View>

              <View style={{ marginTop: theme.spacing.xl }}>
                <GradientButton
                  testID="start-session"
                  accessibilityLabel="Start session"
                  label="Start Session"
                  onPress={handleStartSession}
                  loading={starting}
                  disabled={!selectedCourse || starting}
                  icon={
                    <QrCode size={18} color="#fff" />
                  }
                />
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: theme.spacing.lg,
    paddingBottom: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  subtitle: { color: theme.colors.muted, marginTop: 3 },
  takeBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.brandPrimary,
    paddingVertical: 14,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.md,
  },
  takeTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingTop: 0,
    paddingBottom: 100,
  },
  sessionsContainer: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
    marginTop: -theme.spacing.md,
  },
  sessionCard: {
    padding: theme.spacing.md,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionName: {
    fontWeight: '700',
    color: theme.colors.onSurface,
    fontSize: 14,
  },
  sessionMeta: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
  sessionCheckins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  checkinText: {
    fontSize: 11,
    color: theme.colors.brandSecondary,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coursesContainer: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
    marginTop: -theme.spacing.md,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  courseAccent: {
    width: 4,
    height: 44,
    borderRadius: 2,
    marginRight: 12,
  },
  courseBody: { flex: 1 },
  courseCode: {
    fontSize: 11,
    color: theme.colors.brand,
    fontWeight: '700',
  },
  courseName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginTop: 2,
  },
  courseMeta: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  label: {
    color: theme.colors.onSurfaceTertiary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: theme.spacing.md,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipRow: { gap: 8, paddingRight: 8 },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  methodBtnActive: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
  },
  methodLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceTertiary,
    fontWeight: '700',
  },
  durRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
