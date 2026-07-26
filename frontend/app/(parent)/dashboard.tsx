import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import {
  Bell,
  TrendingUp,
  BookOpen,
  Award,
  CreditCard,
  User,
  GraduationCap,
  CalendarDays,
  Sparkles,
  Mail,
  MessageCircle,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import type { ParentDashboardData, Fee, ExamResult } from '@/src/types';
import { theme } from '@/src/theme';
import {
  StatCard,
  SectionTitle,
  Card,
  EmptyState,
  DashboardSkeleton,
  AsyncView,
} from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function ParentDashboard() {
  const { user: parent } = useAuth();
  const { data, loading, error, refresh } =
    useFetch<ParentDashboardData>('/dashboard/parent');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!loading && refreshing) setRefreshing(false);
  }, [loading, refreshing]);

  const onRefresh = () => {
    setRefreshing(true);
    refresh();
  };

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
      >
        <AsyncView loading={false} error={error} onRetry={refresh} empty={false}>
          {null}
        </AsyncView>
      </SafeAreaView>
    );
  }

  const child = data?.child;
  const pendingFees = (data?.fees || []).filter(
    (f: Fee) => f.status === 'pending',
  );
  const totalDue = pendingFees.reduce((s: number, f: Fee) => s + f.amount, 0);

  return (
    <ErrorBoundary>
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: theme.colors.surface }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.brandPrimary}
            />
          }
        >
          {/* Header */}
          <View style={styles.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeTxt}>Welcome back</Text>
              <Text style={styles.nameTxt} numberOfLines={1}>{parent?.name || 'Parent'}</Text>
            </View>
            <Pressable
              testID="notif-btn"
              accessibilityLabel="Notifications"
              accessibilityRole="button"
              onPress={() => router.push('/notifications' as any)}
              style={styles.iconBtn}
            >
              <Bell color={theme.colors.onSurface} size={20} />
            </Pressable>
          </View>

          {/* Child Info Card */}
          {child ? (
            <LinearGradient
              colors={['#047857', '#059669', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.childCard}
            >
              <Text style={styles.childLabel}>Monitoring</Text>
              <View style={styles.childHeader}>
                <View style={styles.childAvatar}>
                  <Text style={styles.childAvatarTxt}>
                    {child.name?.[0] || 'C'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.childName}>{child.name}</Text>
                  <Text style={styles.childMeta}>
                    {child.department} · Year {child.year} · ID{' '}
                    {child.student_id}
                  </Text>
                </View>
                <User color="rgba(255,255,255,0.6)" size={20} />
              </View>

              <View style={styles.childStats}>
                <View style={styles.childStat}>
                  <GraduationCap color="rgba(255,255,255,0.7)" size={14} />
                  <Text style={styles.childStatVal}>
                    {data?.attendance || 0}%
                  </Text>
                  <Text style={styles.childStatLbl}>Attendance</Text>
                </View>
                <View style={styles.childStatDiv} />
                <View style={styles.childStat}>
                  <Award color="rgba(255,255,255,0.7)" size={14} />
                  <Text style={styles.childStatVal}>{data?.cgpa || 0}</Text>
                  <Text style={styles.childStatLbl}>CGPA</Text>
                </View>
                <View style={styles.childStatDiv} />
                <View style={styles.childStat}>
                  <CreditCard color="rgba(255,255,255,0.7)" size={14} />
                  <Text style={styles.childStatVal}>{pendingFees.length}</Text>
                  <Text style={styles.childStatLbl}>Fees Due</Text>
                </View>
              </View>

              {totalDue > 0 && (
                <View style={styles.dueBanner}>
                  <Text style={styles.dueTxt}>
                    ₹{(totalDue / 100).toFixed(2)} pending
                  </Text>
                </View>
              )}
            </LinearGradient>
          ) : (
            <Card style={{ marginHorizontal: theme.spacing.lg }}>
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <User color={theme.colors.muted} size={32} />
                <Text
                  style={{
                    textAlign: 'center',
                    color: theme.colors.muted,
                    fontSize: 14,
                    marginTop: 8,
                    fontWeight: '600',
                  }}
                >
                  No child linked to your account
                </Text>
                <Text
                  style={{
                    textAlign: 'center',
                    color: theme.colors.muted,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Contact admin to link your child
                </Text>
              </View>
            </Card>
          )}

          {/* Stat Cards */}
          <View style={styles.statRow}>
            <StatCard
              label="Attendance"
              value={`${data?.attendance || 0}%`}
              sub="Overall"
              color={
                (data?.attendance || 0) >= 75
                  ? theme.colors.success
                  : theme.colors.warning
              }
              icon={<TrendingUp color={theme.colors.brand} size={18} />}
              testID="stat-attendance"
            />
            <StatCard
              label="CGPA"
              value={String(data?.cgpa || 0)}
              sub="Current"
              color={theme.colors.brandPrimary}
              icon={<Award color={theme.colors.brand} size={18} />}
              testID="stat-cgpa"
            />
          </View>

          {/* Recent Results */}
          {(data?.results || []).length > 0 && (
            <>
              <SectionTitle title="Recent Results" />
              <View
                style={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}
              >
                {(data?.results || []).slice(0, 4).map((r: ExamResult) => (
                  <Card key={r.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{r.course_name}</Text>
                        <Text style={styles.resultMeta}>
                          {r.course_code} · {r.semester}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.resultGrade}>{r.grade}</Text>
                        <Text style={styles.resultMarks}>
                          {r.marks}/{r.max_marks}
                        </Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            </>
          )}

          {/* Pending Fees */}
          {pendingFees.length > 0 && (
            <>
              <SectionTitle title="Pending Fees" />
              <View
                style={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}
              >
                {pendingFees.slice(0, 3).map((f: Fee) => (
                  <Card key={f.id}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{f.type}</Text>
                        <Text style={styles.resultMeta}>
                          Due{' '}
                          {new Date(f.due_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={styles.feeAmt}>
                        ₹{(f.amount / 100).toFixed(2)}
                      </Text>
                    </View>
                  </Card>
                ))}
              </View>
            </>
          )}

          {/* Quick Actions */}
          <SectionTitle title="Quick Actions" />
          <View
            style={{
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: theme.spacing.lg,
            }}
          >
            <Pressable
              testID="qa-attendance"
              accessibilityLabel="View Attendance"
              accessibilityRole="button"
              onPress={() => router.push('/(parent)/attendance' as any)}
              style={styles.qa}
            >
              <View
                style={[
                  styles.qaIcon,
                  { backgroundColor: '#DCFCE7' },
                ]}
              >
                <TrendingUp size={20} color={theme.colors.brand} />
              </View>
              <Text style={styles.qaTxt}>Attendance</Text>
            </Pressable>

            <Pressable
              testID="qa-fees"
              accessibilityLabel="View Fees"
              accessibilityRole="button"
              onPress={() => router.push('/(parent)/fees' as any)}
              style={styles.qa}
            >
              <View
                style={[
                  styles.qaIcon,
                  { backgroundColor: '#FEF3C7' },
                ]}
              >
                <CreditCard size={20} color={theme.colors.warning} />
              </View>
              <Text style={styles.qaTxt}>Fees</Text>
            </Pressable>

            <Pressable
              testID="qa-results"
              accessibilityLabel="View Results"
              accessibilityRole="button"
              onPress={() => router.push('/results' as any)}
              style={styles.qa}
            >
              <View
                style={[
                  styles.qaIcon,
                  { backgroundColor: '#DBEAFE' },
                ]}
              >
                <BookOpen size={20} color={theme.colors.info} />
              </View>
              <Text style={styles.qaTxt}>Results</Text>
            </Pressable>

            <Pressable
              testID="qa-ai-assistant"
              accessibilityLabel="AI Assistant"
              accessibilityRole="button"
              onPress={() => router.push('/(parent)/ai' as any)}
              style={styles.qa}
            >
              <View
                style={[
                  styles.qaIcon,
                  { backgroundColor: '#EDE9FE' },
                ]}
              >
                <Sparkles size={20} color="#7C3AED" />
              </View>
              <Text style={styles.qaTxt}>AI Assist</Text>
            </Pressable>
          </View>

          <SectionTitle title="Communication" />
          <View style={{ paddingHorizontal: theme.spacing.lg, gap: 8 }}>
            {[
              { icon: Bell, label: 'Notifications', route: '/notifications', color: '#4F46E5', bg: '#EEF2FF' },
              { icon: Bell, label: 'Push Alerts', route: '/push-notifications', color: '#059669', bg: '#ECFDF5' },
              { icon: Mail, label: 'Email', route: '/email', color: '#7C3AED', bg: '#F5F3FF' },
              { icon: MessageCircle, label: 'WhatsApp', route: '/whatsapp', color: '#25D366', bg: '#F0FDF4' },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <Pressable key={i} onPress={() => router.push(item.route as any)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} color={item.color} />
                  </View>
                  <Text style={{ flex: 1, fontWeight: '700', color: theme.colors.text, fontSize: 13 }}>{item.label}</Text>
                  <Text style={{ color: theme.colors.muted, fontSize: 16 }}>›</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Empty state for no results/fees */}
          {(data?.results || []).length === 0 &&
            pendingFees.length === 0 &&
            child && (
              <View style={{ paddingHorizontal: theme.spacing.lg }}>
                <EmptyState
                  title="All caught up!"
                  sub="No pending results or fees for your child right now."
                  icon="✅"
                />
              </View>
            )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  welcomeTxt: { fontSize: 14, color: theme.colors.muted, fontWeight: '500' },
  nameTxt: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.onSurface,
    marginTop: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  childCard: {
    padding: theme.spacing.xl,
    marginHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    ...theme.shadow.lg,
  },
  childLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  childAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  childAvatarTxt: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  childName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  childMeta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  childStats: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  childStat: { flex: 1, alignItems: 'center', gap: 4 },
  childStatVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  childStatLbl: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
  },
  childStatDiv: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginVertical: 4,
  },
  dueBanner: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: theme.radius.sm,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    alignItems: 'center',
  },
  dueTxt: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  resultName: {
    fontWeight: '700',
    color: theme.colors.onSurface,
    fontSize: 14,
  },
  resultMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  resultGrade: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.brand,
  },
  resultMarks: { fontSize: 11, color: theme.colors.muted },
  feeAmt: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.error,
  },
  qa: {
    flex: 1,
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    ...theme.shadow.sm,
  },
  qaIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qaTxt: {
    fontWeight: '600',
    color: theme.colors.onSurface,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
});
