import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Sparkles, CalendarCheck, Check, Clock, Target, BookOpen,
  ChevronRight, Plus, Trash2, RotateCcw, CheckCircle,
} from 'lucide-react-native';

const PLAN_TYPES = [
  { id: 'weekly', title: 'Weekly Study Plan', icon: CalendarCheck, desc: 'Structured plan for the week' },
  { id: 'revision', title: 'Exam Revision Plan', icon: Target, desc: 'Intensive revision schedule' },
  { id: 'daily', title: 'Daily Focus Plan', icon: Clock, desc: 'Today\'s study roadmap' },
];

const MOCK_WEEKLY_PLAN = {
  title: 'Weekly Study Plan — Computer Science',
  goal: 'Master Data Structures & Algorithms',
  days: [
    { day: 'Monday', focus: 'Arrays & Linked Lists', tasks: [
      { time: '9:00 AM', task: 'Review array operations (insert, delete, search)', course: 'DSA', done: true },
      { time: '11:00 AM', task: 'Practice 3 LeetCode medium problems', course: 'DSA', done: true },
      { time: '2:00 PM', task: 'Study linked list types and implementations', course: 'DSA', done: false },
      { time: '4:00 PM', task: 'Mathematics homework — Calculus Ch.5', course: 'Mathematics', done: false },
    ]},
    { day: 'Tuesday', focus: 'Stacks & Queues', tasks: [
      { time: '9:00 AM', task: 'Stack implementation using arrays and linked lists', course: 'DSA', done: true },
      { time: '11:00 AM', task: 'Solve 5 stack/queue problems', course: 'DSA', done: false },
      { time: '2:00 PM', task: 'Physics lab report preparation', course: 'Physics', done: false },
      { time: '4:00 PM', task: 'Review lecture notes — Operating Systems', course: 'OS', done: false },
    ]},
    { day: 'Wednesday', focus: 'Trees & BST', tasks: [
      { time: '9:00 AM', task: 'Study binary tree traversal algorithms', course: 'DSA', done: false },
      { time: '11:00 AM', task: 'Implement BST with insert/delete/search', course: 'DSA', done: false },
      { time: '2:00 PM', task: 'English essay preparation', course: 'English', done: false },
      { time: '4:00 PM', task: 'CS assignment — Database normalization', course: 'DBMS', done: false },
    ]},
    { day: 'Thursday', focus: 'Graphs', tasks: [
      { time: '9:00 AM', task: 'Study BFS and DFS algorithms', course: 'DSA', done: false },
      { time: '11:00 AM', task: 'Practice graph problems', course: 'DSA', done: false },
      { time: '2:00 PM', task: 'Mathematics — Practice integration problems', course: 'Mathematics', done: false },
      { time: '4:00 PM', task: 'Physics theory — Electromagnetic waves', course: 'Physics', done: false },
    ]},
    { day: 'Friday', focus: 'Sorting & Searching', tasks: [
      { time: '9:00 AM', task: 'Study quicksort and mergesort complexity', course: 'DSA', done: false },
      { time: '11:00 AM', task: 'Implement sorting algorithms', course: 'DSA', done: false },
      { time: '2:00 PM', task: 'Weekly revision — all subjects', course: 'All', done: false },
      { time: '4:00 PM', task: 'Work on Campus ERP project', course: 'Project', done: false },
    ]},
  ],
  tips: [
    'Take 10-minute breaks every 50 minutes of study',
    'Review all completed tasks before sleeping',
    'Prioritize difficult topics when your energy is highest (morning)',
    'Use active recall instead of passive re-reading',
  ],
};

const MOCK_REVISION_PLAN = {
  title: 'Exam Revision — Mid-Term',
  goal: 'Score 85%+ in all subjects',
  days: [
    { day: 'Day 1', focus: 'Mathematics Revision', tasks: [
      { time: '8:00 AM', task: 'Revise Calculus — Limits, Derivatives, Integration', course: 'Mathematics', done: true },
      { time: '11:00 AM', task: 'Solve 20 practice problems', course: 'Mathematics', done: true },
      { time: '2:00 PM', task: 'Review Linear Algebra formulas', course: 'Mathematics', done: false },
      { time: '5:00 PM', task: 'Self-test — 30 min timed quiz', course: 'Mathematics', done: false },
    ]},
    { day: 'Day 2', focus: 'Physics Revision', tasks: [
      { time: '8:00 AM', task: 'Revise Electromagnetic Theory', course: 'Physics', done: false },
      { time: '11:00 AM', task: 'Practice numerical problems', course: 'Physics', done: false },
      { time: '2:00 PM', task: 'Review lab experiments and viva questions', course: 'Physics', done: false },
      { time: '5:00 PM', task: 'Solve previous year papers', course: 'Physics', done: false },
    ]},
    { day: 'Day 3', focus: 'CS Revision', tasks: [
      { time: '8:00 AM', task: 'Revise DBMS — Normalization, SQL queries', course: 'DBMS', done: false },
      { time: '11:00 AM', task: 'Practice SQL queries on sample database', course: 'DBMS', done: false },
      { time: '2:00 PM', task: 'Review OS concepts — Process scheduling', course: 'OS', done: false },
      { time: '5:00 PM', task: 'Solve CS previous year papers', course: 'CS', done: false },
    ]},
  ],
  tips: [
    'Start with your weakest subject when fresh',
    'Use spaced repetition for formula memorization',
    'Take mock tests under exam conditions',
    'Review mistakes from previous practice tests',
  ],
};

export default function StudyPlanner() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [plan, setPlan] = useState(MOCK_WEEKLY_PLAN);
  const [fadeAnim] = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const toggleTask = (dayIndex: number, taskIndex: number) => {
    const newDays = [...plan.days];
    newDays[dayIndex] = {
      ...newDays[dayIndex],
      tasks: newDays[dayIndex].tasks.map((t, i) => i === taskIndex ? { ...t, done: !t.done } : t),
    };
    setPlan({ ...plan, days: newDays });
  };

  const totalTasks = plan.days.reduce((s, d) => s + d.tasks.length, 0);
  const doneTasks = plan.days.reduce((s, d) => s + d.tasks.filter(t => t.done).length, 0);
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (selectedPlan) {
    return (
      <ErrorBoundary>
        <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.hero}>
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
                <Pressable onPress={() => setSelectedPlan(null)} style={styles.backBtn}>
                  <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
                </Pressable>
                <Text style={styles.heroTitle}>{plan.title}</Text>
                <Text style={styles.heroSub}>Goal: {plan.goal}</Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{progress}%</Text>
                </View>
              </LinearGradient>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
              {plan.days.map((day, di) => (
                <Card key={di} style={{ padding: 16, gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{ fontWeight: '800', fontSize: 15, color: theme.colors.text }}>{day.day}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{day.focus}</Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: day.tasks.every(t => t.done) ? '#10B981' : theme.colors.brand }}>
                      {day.tasks.filter(t => t.done).length}/{day.tasks.length}
                    </Text>
                  </View>

                  {day.tasks.map((task, ti) => (
                    <Pressable key={ti} onPress={() => toggleTask(di, ti)}
                      style={[styles.taskItem, task.done && styles.taskDone]}>
                      <View style={[styles.checkbox, task.done && styles.checkboxDone]}>
                        {task.done && <Check size={10} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.taskText, task.done && styles.taskTextDone]}>{task.task}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 3 }}>
                          <Text style={styles.taskMeta}>{task.time}</Text>
                          <Text style={styles.taskMeta}>{task.course}</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </Card>
              ))}

              <Card style={{ padding: 16, gap: 8, backgroundColor: theme.colors.brandTertiary }}>
                <Text style={{ fontWeight: '700', color: theme.colors.brand }}>AI Study Tips</Text>
                {plan.tips.map((tip, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 6 }}>
                    <Sparkles size={12} color={theme.colors.brand} style={{ marginTop: 2 }} />
                    <Text style={{ fontSize: 12, color: theme.colors.text, flex: 1, lineHeight: 16 }}>{tip}</Text>
                  </View>
                ))}
              </Card>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><Sparkles size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>AI Study Planner</Text>
                  <Text style={styles.heroSub}>Organize your study schedule with AI</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {PLAN_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <Pressable key={type.id} onPress={() => {
                  setSelectedPlan(type.id);
                  if (type.id === 'revision') setPlan(MOCK_REVISION_PLAN);
                  else setPlan(MOCK_WEEKLY_PLAN);
                }}>
                  <Card style={{ padding: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.typeIcon}>
                        <Icon size={24} color={theme.colors.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.text }}>{type.title}</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{type.desc}</Text>
                      </View>
                      <ChevronRight size={16} color={theme.colors.muted} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}

            <SectionTitle>Quick Stats</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Card style={{ flex: 1, alignItems: 'center', padding: 14, gap: 4 }}>
                <CalendarCheck size={20} color={theme.colors.brand} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>5</Text>
                <Text style={{ fontSize: 10, color: theme.colors.muted, fontWeight: '600' }}>Active Plans</Text>
              </Card>
              <Card style={{ flex: 1, alignItems: 'center', padding: 14, gap: 4 }}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>23</Text>
                <Text style={{ fontSize: 10, color: theme.colors.muted, fontWeight: '600' }}>Tasks Done</Text>
              </Card>
              <Card style={{ flex: 1, alignItems: 'center', padding: 14, gap: 4 }}>
                <Target size={20} color="#F59E0B" />
                <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>78%</Text>
                <Text style={{ fontSize: 10, color: theme.colors.muted, fontWeight: '600' }}>Completion</Text>
              </Card>
            </View>

            <SectionTitle>Study Streak</SectionTitle>
            <Card style={{ padding: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
                  <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 10, color: theme.colors.muted }}>{d}</Text>
                    <View style={[styles.streakDot, i < 5 && styles.streakActive]}>
                      {i < 5 && <Check size={10} color="#fff" />}
                    </View>
                  </View>
                ))}
              </View>
              <Text style={{ textAlign: 'center', fontSize: 12, color: theme.colors.muted, marginTop: 4 }}>5-day streak! Keep it up!</Text>
            </Card>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 8 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  progressBg: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#fff' },
  typeIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  taskItem: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'flex-start' },
  taskDone: { backgroundColor: '#10B98110', borderColor: '#10B98130' },
  checkbox: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  taskText: { fontSize: 13, color: theme.colors.text, lineHeight: 18 },
  taskTextDone: { textDecorationLine: 'line-through', color: theme.colors.muted },
  taskMeta: { fontSize: 10, color: theme.colors.muted, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  streakDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  streakActive: { backgroundColor: '#10B981' },
});
