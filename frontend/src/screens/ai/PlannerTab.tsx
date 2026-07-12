import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Trash2,
  Calendar,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
  Plus,
  Zap,
} from 'lucide-react-native';
import type { StudyPlan, PlanDay, PlanTask } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { ChipBtn, Card, EmptyState, GradientButton } from '@/src/ui';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function PlannerTab() {
  const {
    data: plans = [],
    loading,
    refresh: loadPlans,
  } = useFetch<StudyPlan[]>('/ai/study-plans');
  const { mutate: generatePlan, loading: generating } = useMutate();
  const { mutate: toggleMutation } = useMutate();
  const { mutate: deleteMutation } = useMutate();

  const [planType, setPlanType] = useState<'study' | 'revision'>('study');
  const [goal, setGoal] = useState('');
  const [days, setDays] = useState(7);
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => subscribeRealtime('study-plans:update', () => loadPlans()), [loadPlans]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPlans();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadPlans]);

  const generate = async () => {
    try {
      await generatePlan('/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify({
          plan_type: planType,
          goal: goal.trim() || `${planType} plan for ${days} days`,
          days,
          hours_per_day: hoursPerDay,
        }),
      });
      setGoal('');
      loadPlans();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to generate plan');
    }
  };

  const toggleTask = async (planId: string, dayIdx: number, taskIdx: number) => {
    try {
      await toggleMutation(`/ai/study-plans/${planId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ day_index: dayIdx, task_index: taskIdx }),
      });
      loadPlans();
    } catch {
      // silent
    }
  };

  const deletePlan = async (planId: string) => {
    Alert.alert('Delete Plan', 'Are you sure you want to delete this plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation(`/ai/study-plans/${planId}`, {
              method: 'DELETE',
            });
            loadPlans();
          } catch {
            // silent
          }
        },
      },
    ]);
  };

  const toggleExpand = (planId: string) => {
    setExpandedPlan((prev) => (prev === planId ? null : planId));
  };

  const getProgress = (plan: StudyPlan) => {
    const days = plan.plan?.days || [];
    const totalTasks = days.reduce(
      (s: number, d: PlanDay) => s + (d.tasks?.length || 0),
      0,
    );
    const doneTasks = days.reduce(
      (s: number, d: PlanDay) =>
        s + (d.tasks?.filter((t: PlanTask) => t.done).length || 0),
      0,
    );
    return { totalTasks, doneTasks, pct: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0 };
  };

  if (loading && plans.length === 0) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={theme.colors.brandPrimary} size="large" />
        <Text style={styles.loadingTxt}>Loading plans...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brandPrimary}
          />
        }
      >
        {/* Create Plan Section */}
        <View style={styles.createCard}>
          <View style={styles.createHeader}>
            <Sparkles color={theme.colors.brandSecondary} size={22} />
            <Text style={styles.createTitle}>AI Study Planner</Text>
          </View>
          <Text style={styles.createSub}>
            Generate a personalized study plan tailored to your goals.
          </Text>

          <TextInput
            testID="plan-goal-input"
            accessibilityLabel="Study goal"
            value={goal}
            onChangeText={setGoal}
            placeholder="e.g. Prepare for semester exams"
            style={styles.goalInput}
            placeholderTextColor={theme.colors.muted}
          />

          <View style={styles.typeRow}>
            <ChipBtn
              label="Study Plan"
              active={planType === 'study'}
              onPress={() => setPlanType('study')}
              testID="type-study"
            />
            <ChipBtn
              label="Revision Plan"
              active={planType === 'revision'}
              onPress={() => setPlanType('revision')}
              testID="type-revision"
            />
          </View>

          <View style={styles.sliderRow}>
            <View style={styles.sliderCol}>
              <Text style={styles.sliderLabel}>Days: {days}</Text>
              <View style={styles.stepper}>
                <Pressable
                  testID="days-dec"
                  accessibilityLabel="Decrease days"
                  onPress={() => setDays((d) => Math.max(1, d - 1))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepTxt}>−</Text>
                </Pressable>
                <Text style={styles.stepVal}>{days}</Text>
                <Pressable
                  testID="days-inc"
                  accessibilityLabel="Increase days"
                  onPress={() => setDays((d) => Math.min(30, d + 1))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepTxt}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.sliderCol}>
              <Text style={styles.sliderLabel}>Hours/Day: {hoursPerDay}</Text>
              <View style={styles.stepper}>
                <Pressable
                  testID="hours-dec"
                  accessibilityLabel="Decrease hours"
                  onPress={() => setHoursPerDay((h) => Math.max(1, h - 1))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepTxt}>−</Text>
                </Pressable>
                <Text style={styles.stepVal}>{hoursPerDay}</Text>
                <Pressable
                  testID="hours-inc"
                  accessibilityLabel="Increase hours"
                  onPress={() => setHoursPerDay((h) => Math.min(12, h + 1))}
                  style={styles.stepBtn}
                >
                  <Text style={styles.stepTxt}>+</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <GradientButton
            label={generating ? 'Generating...' : 'Generate My Plan'}
            onPress={generate}
            loading={generating}
            icon={<Sparkles size={16} color="#fff" />}
          />
        </View>

        {/* Plans List */}
        {plans.length === 0 && !loading ? (
          <EmptyState
            title="No study plans yet"
            sub="Generate your first AI-powered study plan above"
            icon="📋"
          />
        ) : (
          plans.map((plan, pi) => {
            const { totalTasks, doneTasks, pct } = getProgress(plan);
            const days = plan.plan?.days || [];
            const isExpanded = expandedPlan === plan.id;
            const isLatest = pi === 0;

            return (
              <View
                key={plan.id}
                style={[styles.planCard, isLatest && styles.latestCard]}
                testID={`plan-${plan.id}`}
              >
                {/* Plan Header */}
                <Pressable
                  testID={`expand-plan-${plan.id}`}
                  accessibilityLabel={`Expand ${plan.plan?.title || 'plan'}`}
                  onPress={() => toggleExpand(plan.id)}
                  style={styles.planHeader}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>
                      {plan.plan?.title || 'Study Plan'}
                    </Text>
                    <Text style={styles.planMeta}>
                      {plan.plan_type} · {days.length} days · {doneTasks}/{totalTasks} tasks
                    </Text>
                  </View>
                  <View style={styles.planActions}>
                    <Pressable
                      testID={`delete-plan-${plan.id}`}
                      accessibilityLabel="Delete plan"
                      onPress={() => deletePlan(plan.id)}
                      hitSlop={10}
                    >
                      <Trash2 color={theme.colors.error} size={18} />
                    </Pressable>
                    {isExpanded ? (
                      <ChevronUp color={theme.colors.muted} size={18} />
                    ) : (
                      <ChevronDown color={theme.colors.muted} size={18} />
                    )}
                  </View>
                </Pressable>

                {/* Progress Bar */}
                <View style={styles.progressRow}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${pct}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressTxt}>{pct}%</Text>
                </View>

                {/* Expanded Day View */}
                {isExpanded && days.length > 0 && (
                  <View style={styles.daysContainer}>
                    {days.map((day: PlanDay, di: number) => {
                      const dayDone = day.tasks?.every(
                        (t: PlanTask) => t.done,
                      );
                      const isToday =
                        day.date === new Date().toISOString().slice(0, 10);
                      return (
                        <View key={di} style={styles.daySection}>
                          <View
                            style={[
                              styles.dayHeader,
                              isToday && styles.dayHeaderToday,
                            ]}
                          >
                            <Calendar
                              size={14}
                              color={
                                isToday
                                  ? '#fff'
                                  : theme.colors.brand
                              }
                            />
                            <Text
                              style={[
                                styles.dayLabel,
                                isToday && { color: '#fff' },
                              ]}
                            >
                              {day.day}
                            </Text>
                            <Text
                              style={[
                                styles.dayDate,
                                isToday && { color: 'rgba(255,255,255,0.8)' },
                              ]}
                            >
                              {new Date(day.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                            {dayDone && (
                              <CheckCircle2
                                color={theme.colors.success}
                                size={16}
                              />
                            )}
                          </View>

                          {day.tasks?.map((task: PlanTask, ti: number) => (
                            <Pressable
                              key={ti}
                              testID={`plan-task-${plan.id}-${di}-${ti}`}
                              accessibilityLabel={`Toggle task: ${task.task}`}
                              style={styles.taskRow}
                              onPress={() => toggleTask(plan.id, di, ti)}
                            >
                              {task.done ? (
                                <CheckCircle2
                                  color={theme.colors.success}
                                  size={18}
                                />
                              ) : (
                                <Circle
                                  color={theme.colors.muted}
                                  size={18}
                                />
                              )}
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    styles.taskTxt,
                                    task.done && styles.taskDone,
                                  ]}
                                >
                                  {task.task}
                                </Text>
                                {task.time && (
                                  <View style={styles.taskTimeRow}>
                                    <Clock size={10} color={theme.colors.muted} />
                                    <Text style={styles.taskTime}>
                                      {task.time}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              {task.course && (
                                <View style={styles.courseChip}>
                                  <Text style={styles.courseChipTxt}>
                                    {task.course}
                                  </Text>
                                </View>
                              )}
                            </Pressable>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Tips */}
                {isExpanded && plan.plan?.tips?.length > 0 && (
                  <View style={styles.tipsBox}>
                    <View style={styles.tipsHeader}>
                      <Zap size={14} color={theme.colors.warning} />
                      <Text style={styles.tipsTitle}>Tips</Text>
                    </View>
                    {plan.plan.tips.map((tip: string, ti: number) => (
                      <Text key={ti} style={styles.tipTxt}>
                        • {tip}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingTxt: { color: theme.colors.muted, fontSize: 13 },
  createCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.brandTertiary,
    gap: 12,
    ...theme.shadow.md,
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  createSub: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  goalInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 12,
    color: theme.colors.onSurface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontSize: 14,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    gap: 16,
  },
  sliderCol: {
    flex: 1,
    gap: 6,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.brand,
  },
  stepVal: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.onSurface,
    minWidth: 24,
    textAlign: 'center',
  },
  planCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  latestCard: {
    borderColor: theme.colors.brandPrimary,
    borderWidth: 1.5,
    ...theme.shadow.md,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  planMeta: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  planActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: 3,
  },
  progressTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.brand,
    minWidth: 32,
    textAlign: 'right',
  },
  daysContainer: {
    marginTop: 12,
    gap: 12,
  },
  daySection: {
    gap: 4,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    padding: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayHeaderToday: {
    backgroundColor: theme.colors.brandPrimary,
    borderColor: theme.colors.brandPrimary,
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  dayDate: {
    fontSize: 11,
    color: theme.colors.muted,
    flex: 1,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  taskTxt: {
    color: theme.colors.onSurface,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  taskDone: {
    textDecorationLine: 'line-through',
    color: theme.colors.muted,
  },
  taskTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  taskTime: {
    fontSize: 10,
    color: theme.colors.muted,
  },
  courseChip: {
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
  },
  courseChipTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.brand,
  },
  tipsBox: {
    marginTop: 12,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: theme.radius.md,
    gap: 4,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tipsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.warning,
  },
  tipTxt: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});
