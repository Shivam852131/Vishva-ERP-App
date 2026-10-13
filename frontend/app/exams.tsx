import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  Alert, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Calendar, Clock, MapPin, Download,
  Sparkles, Brain, BookOpen, Bookmark, Award, Play, Plus,
  ChevronRight, Zap, Target, BarChart3,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch } from '@/src/hooks/useFetch';
import type { Exam, ExamPrepQuiz } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, Badge, AsyncView } from '@/src/ui';
import RNFS from 'react-native-fs';

const { width } = Dimensions.get('window');

interface HallTicket {
  id: string;
  student_id: string;
  student_name: string;
  exams: { exam_id: string; course_name: string; venue: string; date: string }[];
}

export default function Exams() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'schedule' | 'prep'>('schedule');

  const isFaculty = user?.role === 'faculty' || user?.role === 'college_admin' || user?.role === 'super_admin';

  // Schedule & Hallticket
  const { data: exams, loading: examsLoading, error: examsError, refresh: refreshExams } = useFetch<Exam[]>('/exams');
  const { data: hallTicket, refresh: refreshTicket } = useFetch<HallTicket>(
    user?.role === 'student' ? '/exams/my-hallticket' : null
  );

  // Exam Prep quizzes
  const { data: quizzes, loading: quizzesLoading, refresh: refreshQuizzes } = useFetch<ExamPrepQuiz[]>('/exam-prep/quizzes');

  const examsSafe = exams || [];
  const quizzesSafe = quizzes || [];
  const publishedQuizzes = isFaculty
    ? quizzesSafe
    : quizzesSafe.filter(q => q.status === 'published');

  const handleRefresh = useCallback(() => {
    if (activeTab === 'schedule') {
      refreshExams();
      if (user?.role === 'student') refreshTicket();
    } else {
      refreshQuizzes();
    }
  }, [activeTab, refreshExams, refreshTicket, refreshQuizzes, user?.role]);

  const handleDownloadHallTicket = useCallback(async () => {
    if (!hallTicket) return;
    try {
      const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const examsHTML = (hallTicket.exams || []).map(e =>
        `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(e.course_name)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(e.date)}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0">${esc(e.venue)}</td></tr>`
      ).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Hall Ticket</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;padding:32px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #4F46E5;padding-bottom:12px;margin-bottom:20px}.name{font-size:22px;font-weight:800}.label{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px}table{width:100%;border-collapse:collapse;margin-top:16px}th{text-align:left;padding:8px;border-bottom:2px solid #4F46E5;font-size:12px;font-weight:700;color:#4F46E5}</style></head><body>
<div class="header"><div class="label">Hall Ticket</div><div class="name" style="margin-top:8px">${esc(hallTicket.student_name)}</div><div style="font-size:12px;color:#64748b;margin-top:4px">${(hallTicket.exams || []).length} exam(s) scheduled</div></div>
<table><tr><th>Subject</th><th>Date</th><th>Venue</th></tr>${examsHTML}</table></body></html>`;

      const fileName = `HallTicket_${Date.now()}`;
      const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      await RNFS.writeFile(`${dir}/${fileName}.html`, html, 'utf8');
      Alert.alert('Saved', `${fileName}.html saved to Downloads. Open and print to PDF.`);
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not save hall ticket.');
    }
  }, [hallTicket]);

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back" accessibilityRole="button" style={styles.iconBtn}>
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>Examinations</Text>
            <Text style={styles.subTitle}>Schedules, hall tickets & AI prep</Text>
          </View>
          <Pressable
            onPress={() => router.push('/exam-prep-dashboard' as any)}
            style={styles.prepBadgeBtn}
            accessibilityRole="button"
            accessibilityLabel="AI Prep Hub"
          >
            <Sparkles size={16} color="#6366F1" />
            <Text style={styles.prepBadgeTxt}>Prep Hub</Text>
          </Pressable>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab('schedule')}
            style={[styles.tabItem, activeTab === 'schedule' && styles.tabItemActive]}
          >
            <Calendar size={16} color={activeTab === 'schedule' ? theme.colors.brand : theme.colors.onSurfaceTertiary} />
            <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>
              Schedule & Ticket
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('prep')}
            style={[styles.tabItem, activeTab === 'prep' && styles.tabItemActive]}
          >
            <Brain size={16} color={activeTab === 'prep' ? theme.colors.brand : theme.colors.onSurfaceTertiary} />
            <Text style={[styles.tabText, activeTab === 'prep' && styles.tabTextActive]}>
              Smart Exam Prep
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100, gap: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={activeTab === 'schedule' ? examsLoading : quizzesLoading}
              onRefresh={handleRefresh}
              tintColor={theme.colors.brandPrimary}
            />
          }
        >
          {activeTab === 'schedule' ? (
            <>
              {/* Exam Prep Banner */}
              <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroPromo}>
                <View style={{ flex: 1 }}>
                  <View style={styles.heroBadgeRow}>
                    <Sparkles size={14} color="#FDE047" />
                    <Text style={styles.heroBadgeTxt}>AI-POWERED PREPARATION</Text>
                  </View>
                  <Text style={styles.heroPromoTitle}>Practice with Smart MCQs</Text>
                  <Text style={styles.heroPromoDesc}>
                    Adaptive tests, chapter-wise questions & AI recommendations.
                  </Text>
                  <Pressable
                    onPress={() => setActiveTab('prep')}
                    style={styles.heroPromoBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.heroPromoBtnTxt}>Explore Prep Hub</Text>
                    <ChevronRight size={14} color="#4F46E5" />
                  </Pressable>
                </View>
              </LinearGradient>

              {/* Hall Ticket Card */}
              {hallTicket && (
                <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.ticketCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.ticketLabel}>Official Hall Ticket</Text>
                    <Pressable
                      onPress={handleDownloadHallTicket}
                      style={styles.ticketDownloadBtn}
                      accessibilityLabel="Download Hall Ticket"
                      accessibilityRole="button"
                    >
                      <Download color="#fff" size={16} />
                      <Text style={styles.ticketDownloadTxt}>Download</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.ticketName}>{hallTicket.student_name}</Text>
                  <Text style={styles.ticketExams}>{hallTicket.exams?.length || 0} examination(s) registered</Text>
                  <View style={styles.ticketBadge}>
                    <Text style={styles.ticketBadgeTxt}>VERIFIED & ACTIVE</Text>
                  </View>
                </LinearGradient>
              )}

              {/* Exam Schedule */}
              <Text style={styles.h2}>University & College Schedule</Text>
              <AsyncView
                loading={examsLoading && !exams}
                error={examsError}
                onRetry={refreshExams}
                empty={!examsLoading && examsSafe.length === 0}
                emptyTitle="No exams scheduled"
                emptySub="Your official exam timetable will appear here"
              >
                {examsSafe.map(ex => (
                  <Card key={ex.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.examTypeRow}>
                          <Badge count={ex.exam_type} color={theme.colors.brandPrimary} />
                          <Text style={styles.examCode}>{ex.course_code || ''}</Text>
                        </View>
                        <Text style={styles.examName}>{ex.course_name}</Text>
                      </View>
                      <View style={styles.marksBadge}>
                        <Text style={styles.marksTxt}>{ex.max_marks}</Text>
                        <Text style={styles.marksLbl}>marks</Text>
                      </View>
                    </View>

                    <View style={styles.examMeta}>
                      <View style={styles.examMetaRow}>
                        <Calendar size={14} color={theme.colors.muted} />
                        <Text style={styles.examMetaTxt}>
                          {new Date(ex.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                      <View style={styles.examMetaRow}>
                        <Clock size={14} color={theme.colors.muted} />
                        <Text style={styles.examMetaTxt}>{ex.start_time} – {ex.end_time}</Text>
                      </View>
                      <View style={styles.examMetaRow}>
                        <MapPin size={14} color={theme.colors.muted} />
                        <Text style={styles.examMetaTxt}>{ex.venue}</Text>
                      </View>
                    </View>

                    <Pressable
                      style={styles.quickPracticeBtn}
                      onPress={() => router.push('/exam-prep-practice' as any, { subject: ex.course_name } as any)}
                    >
                      <Zap size={14} color={theme.colors.brand} />
                      <Text style={styles.quickPracticeTxt}>Practice MCQs for {ex.course_name}</Text>
                    </Pressable>
                  </Card>
                ))}
              </AsyncView>
            </>
          ) : (
            <>
              {/* SMART EXAM PREP TAB */}
              {/* Quick Actions Grid */}
              <Text style={styles.h2}>Exam Prep Modules</Text>
              <View style={styles.gridContainer}>
                {/* 1. Dashboard */}
                <Pressable
                  style={styles.gridCard}
                  onPress={() => router.push('/exam-prep-dashboard' as any)}
                >
                  <View style={[styles.gridIconWrap, { backgroundColor: '#EEF2FF' }]}>
                    <Brain size={22} color="#4F46E5" />
                  </View>
                  <Text style={styles.gridTitle}>AI Dashboard</Text>
                  <Text style={styles.gridDesc}>Mastery, stats & advice</Text>
                </Pressable>

                {/* 2. Practice */}
                <Pressable
                  style={styles.gridCard}
                  onPress={() => router.push('/exam-prep-practice' as any)}
                >
                  <View style={[styles.gridIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    <Zap size={22} color="#10B981" />
                  </View>
                  <Text style={styles.gridTitle}>Practice Mode</Text>
                  <Text style={styles.gridDesc}>Untimed MCQ training</Text>
                </Pressable>

                {/* 3. Question Bank */}
                <Pressable
                  style={styles.gridCard}
                  onPress={() => router.push('/exam-prep-question-bank' as any)}
                >
                  <View style={[styles.gridIconWrap, { backgroundColor: '#FEF3C7' }]}>
                    <BookOpen size={22} color="#D97706" />
                  </View>
                  <Text style={styles.gridTitle}>Question Bank</Text>
                  <Text style={styles.gridDesc}>Explore all subjects</Text>
                </Pressable>

                {/* 4. Bookmarks */}
                <Pressable
                  style={styles.gridCard}
                  onPress={() => router.push('/exam-prep-bookmarks' as any)}
                >
                  <View style={[styles.gridIconWrap, { backgroundColor: '#FDF2F8' }]}>
                    <Bookmark size={22} color="#DB2777" />
                  </View>
                  <Text style={styles.gridTitle}>Bookmarks</Text>
                  <Text style={styles.gridDesc}>Saved review items</Text>
                </Pressable>
              </View>

              {/* Faculty Admin Controls */}
              {isFaculty && (
                <View style={styles.facultyBox}>
                  <View style={styles.facultyBoxHeader}>
                    <View style={styles.facultyPill}>
                      <Text style={styles.facultyPillTxt}>FACULTY & ADMIN SUITE</Text>
                    </View>
                  </View>
                  <Text style={styles.facultyTitle}>Question & Quiz Management</Text>
                  <Text style={styles.facultyDesc}>
                    Generate questions with AI, extract from PDFs/Images, bulk import Excel, and create timed scheduled exams.
                  </Text>
                  <View style={styles.facultyBtnRow}>
                    <Pressable
                      style={styles.facultyBtnPrimary}
                      onPress={() => router.push('/exam-prep-question-manager' as any)}
                    >
                      <Plus size={16} color="#fff" />
                      <Text style={styles.facultyBtnPrimaryTxt}>Question Manager</Text>
                    </Pressable>
                    <Pressable
                      style={styles.facultyBtnSecondary}
                      onPress={() => router.push('/exam-prep-quiz-builder' as any)}
                    >
                      <BarChart3 size={16} color={theme.colors.brand} />
                      <Text style={styles.facultyBtnSecondaryTxt}>Quiz Builder</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Published Mock Exams / Timed Tests */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.h2}>Active Quizzes & Mock Exams</Text>
                <Text style={styles.countBadge}>{publishedQuizzes.length}</Text>
              </View>

              {publishedQuizzes.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Award size={36} color={theme.colors.muted} />
                  <Text style={styles.emptyTitle}>No Quizzes Available Right Now</Text>
                  <Text style={styles.emptySub}>
                    {isFaculty
                      ? 'Create your first quiz using the Quiz Builder above.'
                      : 'You can start self-paced adaptive practice in the meantime.'}
                  </Text>
                  <Pressable
                    style={styles.emptyActionBtn}
                    onPress={() => router.push(isFaculty ? '/exam-prep-quiz-builder' as any : '/exam-prep-practice' as any)}
                  >
                    <Text style={styles.emptyActionTxt}>
                      {isFaculty ? 'Build a Quiz' : 'Start Practice Session'}
                    </Text>
                  </Pressable>
                </Card>
              ) : (
                publishedQuizzes.map(quiz => {
                  const now = new Date();
                  const winStart = quiz.window_start ? new Date(quiz.window_start) : null;
                  const winEnd = quiz.window_end ? new Date(quiz.window_end) : null;
                  const isAvailable = (!winStart || now >= winStart) && (!winEnd || now <= winEnd);

                  return (
                    <Card key={quiz.id} style={{ marginBottom: 12 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Badge
                              count={quiz.is_practice ? 'PRACTICE' : 'TIMED EXAM'}
                              color={quiz.is_practice ? '#2563EB' : '#D97706'}
                            />
                            <Badge
                              count={(quiz.difficulty || 'medium').toUpperCase()}
                              color={theme.colors.onSurfaceSecondary}
                            />
                          </View>
                          <Text style={styles.quizTitle}>{quiz.title}</Text>
                          {quiz.subject ? (
                            <Text style={styles.quizSubject}>
                              {quiz.subject} {quiz.topic ? `• ${quiz.topic}` : ''}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.quizMetaRow}>
                        <View style={styles.quizMetaItem}>
                          <Clock size={13} color={theme.colors.onSurfaceTertiary} />
                          <Text style={styles.quizMetaTxt}>{quiz.duration_minutes} mins</Text>
                        </View>
                        <View style={styles.quizMetaItem}>
                          <BookOpen size={13} color={theme.colors.onSurfaceTertiary} />
                          <Text style={styles.quizMetaTxt}>{quiz.total_questions} Questions</Text>
                        </View>
                        <View style={styles.quizMetaItem}>
                          <Target size={13} color={theme.colors.onSurfaceTertiary} />
                          <Text style={styles.quizMetaTxt}>Pass {quiz.pass_score}%</Text>
                        </View>
                      </View>

                      {quiz.window_start || quiz.window_end ? (
                        <View style={styles.windowInfoRow}>
                          <Calendar size={12} color="#64748B" />
                          <Text style={styles.windowInfoTxt}>
                            {winStart && now < winStart
                              ? `Opens on ${winStart.toLocaleDateString()}`
                              : winEnd
                              ? `Closes ${winEnd.toLocaleDateString()}`
                              : 'Window active'}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.quizActionsRow}>
                        {isFaculty ? (
                          <Pressable
                            style={styles.quizSecondaryBtn}
                            onPress={() => router.push('/exam-prep-quiz-builder' as any, { quizId: quiz.id } as any)}
                          >
                            <BarChart3 size={15} color={theme.colors.brand} />
                            <Text style={styles.quizSecondaryBtnTxt}>Analytics & Edit</Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          style={[styles.quizPrimaryBtn, !isAvailable && styles.quizBtnDisabled]}
                          onPress={() => {
                            if (!isAvailable) {
                              return Alert.alert('Unavailable', 'This quiz window is not currently open.');
                            }
                            router.push('/exam-prep-attempt' as any, { quizId: quiz.id } as any);
                          }}
                        >
                          <Play size={15} color="#fff" />
                          <Text style={styles.quizPrimaryBtnTxt}>
                            {quiz.is_practice ? 'Start Practice' : 'Start Exam'}
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  iconBtn: {
    padding: 6,
    borderRadius: theme.radius.pill,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  subTitle: {
    fontSize: 12,
    color: theme.colors.onSurfaceTertiary,
    marginTop: 2,
  },
  prepBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  prepBadgeTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceVariant || '#F1F5F9',
    borderRadius: theme.radius.pill,
    padding: 4,
    marginBottom: theme.spacing.sm,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    gap: 6,
  },
  tabItemActive: {
    backgroundColor: '#fff',
    ...theme.shadow.sm,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.onSurfaceTertiary,
  },
  tabTextActive: {
    color: theme.colors.brand,
    fontWeight: '700',
  },
  heroPromo: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    ...theme.shadow.md,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  heroBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FDE047',
    letterSpacing: 0.5,
  },
  heroPromoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  heroPromoDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  heroPromoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    marginTop: 12,
    gap: 4,
  },
  heroPromoBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
  },
  ticketCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    ...theme.shadow.lg,
  },
  ticketLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ticketDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  ticketDownloadTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  ticketName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  ticketExams: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  ticketBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  ticketBadgeTxt: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  h2: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.onSurface,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.brand,
    backgroundColor: theme.colors.brandTertiary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  examTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  examCode: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.brand,
    textTransform: 'uppercase',
  },
  examName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.onSurface,
    marginTop: 4,
  },
  marksBadge: {
    alignItems: 'center',
    backgroundColor: theme.colors.brandTertiary,
    padding: 8,
    borderRadius: theme.radius.md,
    minWidth: 52,
  },
  marksTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.brand,
  },
  marksLbl: {
    fontSize: 9,
    color: theme.colors.brand,
    fontWeight: '600',
  },
  examMeta: {
    marginTop: theme.spacing.sm,
    gap: 4,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  examMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  examMetaTxt: {
    color: theme.colors.onSurfaceTertiary,
    fontSize: 12,
  },
  quickPracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    marginTop: 10,
    justifyContent: 'center',
  },
  quickPracticeTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.brand,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCard: {
    width: (width - theme.spacing.lg * 2 - 10) / 2,
    backgroundColor: '#fff',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...theme.shadow.sm,
  },
  gridIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  gridDesc: {
    fontSize: 11,
    color: theme.colors.onSurfaceTertiary,
    marginTop: 2,
  },
  facultyBox: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  facultyBoxHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  facultyPill: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
  },
  facultyPillTxt: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  facultyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#581C87',
  },
  facultyDesc: {
    fontSize: 12,
    color: '#7E22CE',
    marginTop: 2,
    lineHeight: 16,
  },
  facultyBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  facultyBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  facultyBtnPrimaryTxt: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  facultyBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C084FC',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  facultyBtnSecondaryTxt: {
    color: '#6B21A8',
    fontSize: 12,
    fontWeight: '700',
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  quizSubject: {
    fontSize: 12,
    color: theme.colors.brand,
    fontWeight: '600',
    marginTop: 2,
  },
  quizMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: theme.colors.divider,
  },
  quizMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quizMetaTxt: {
    fontSize: 11,
    color: theme.colors.onSurfaceSecondary,
  },
  windowInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  windowInfoTxt: {
    fontSize: 11,
    color: '#64748B',
  },
  quizActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  quizPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.brand,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  quizPrimaryBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  quizSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  quizSecondaryBtnTxt: {
    color: theme.colors.brand,
    fontSize: 13,
    fontWeight: '700',
  },
  quizBtnDisabled: {
    opacity: 0.5,
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.onSurface,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.onSurfaceTertiary,
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyActionBtn: {
    backgroundColor: theme.colors.brand,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    marginTop: 6,
  },
  emptyActionTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
