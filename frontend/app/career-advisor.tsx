import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Sparkles, Compass, Briefcase, GraduationCap, TrendingUp,
  Code, FlaskConical, Palette, BookOpen, ChevronRight, Star,
  ArrowRight, Check, Globe,
} from 'lucide-react-native';

const CAREER_PATHS = [
  { id: '1', title: 'Software Engineer', icon: Code, match: 94, salary: '₹8-25 LPA', growth: '+25%', skills: ['Programming', 'Problem Solving', 'System Design'], education: 'B.Tech CS/IT', desc: 'Design, develop, and maintain software systems. High demand across all industries.' },
  { id: '2', title: 'Data Scientist', icon: TrendingUp, match: 87, salary: '₹10-30 LPA', growth: '+35%', skills: ['Statistics', 'Python', 'Machine Learning'], education: 'B.Tech/BCA + Data Science', desc: 'Analyze complex data to help organizations make data-driven decisions.' },
  { id: '3', title: 'Research Scientist', icon: FlaskConical, match: 78, salary: '₹8-20 LPA', growth: '+18%', skills: ['Research', 'Analytical Thinking', 'Writing'], education: 'M.Sc./PhD', desc: 'Conduct research in universities, labs, or R&D departments of companies.' },
  { id: '4', title: 'UI/UX Designer', icon: Palette, match: 72, salary: '₹6-18 LPA', growth: '+20%', skills: ['Design Thinking', 'Prototyping', 'User Research'], education: 'B.Des/BCA', desc: 'Create intuitive and beautiful digital experiences for users.' },
  { id: '5', title: 'Management Consultant', icon: Briefcase, match: 68, salary: '₹10-35 LPA', growth: '+15%', skills: ['Strategy', 'Communication', 'Analytics'], education: 'MBA/B.Tech + MBA', desc: 'Help organizations solve complex business problems and improve performance.' },
  { id: '6', title: 'Professor / Academic', icon: GraduationCap, match: 65, salary: '₹6-15 LPA', growth: '+12%', skills: ['Teaching', 'Research', 'Mentoring'], education: 'PhD', desc: 'Teach and conduct research at universities. Shape future generations.' },
];

const SKILLS_ASSESSMENT = [
  { name: 'Programming', level: 85 },
  { name: 'Mathematics', level: 72 },
  { name: 'Communication', level: 68 },
  { name: 'Leadership', level: 60 },
  { name: 'Problem Solving', level: 78 },
  { name: 'Creativity', level: 55 },
];

export default function CareerAdvisor() {
  const [step, setStep] = useState<'assess' | 'results'>('assess');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const QUESTIONS = [
    { key: 'interest', q: 'What type of work interests you most?', options: ['Building things (code, systems)', 'Solving problems (analysis, research)', 'Creating designs (visual, UX)', 'Leading teams (management)'] },
    { key: 'style', q: 'Your preferred work style?', options: ['Independent deep work', 'Collaborative team projects', 'Mixed - depends on the task', 'Fast-paced, deadline-driven'] },
    { key: 'values', q: 'What matters most in your career?', options: ['High salary', 'Work-life balance', 'Impact on society', 'Learning & growth'] },
  ];

  const handleAnswer = (qKey: string, val: number) => {
    setAnswers(prev => ({ ...prev, [qKey]: val }));
  };

  const handleAnalyze = () => {
    if (Object.keys(answers).length < QUESTIONS.length) return;
    setAnalyzing(true);
    setTimeout(() => {
      setStep('results');
      setAnalyzing(false);
    }, 2000);
  };

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
                  <Text style={styles.heroTitle}>AI Career Advisor</Text>
                  <Text style={styles.heroSub}>Discover your ideal career path</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {step === 'assess' ? (
              <>
                <SectionTitle>Skills Snapshot</SectionTitle>
                {SKILLS_ASSESSMENT.map((s, i) => (
                  <Card key={i} style={{ padding: 12, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>{s.name}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.brand }}>{s.level}%</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${s.level}%`, backgroundColor: s.level >= 80 ? '#10B981' : s.level >= 60 ? '#4F46E5' : '#F59E0B' }]} />
                    </View>
                  </Card>
                ))}

                <SectionTitle>Quick Assessment</SectionTitle>
                {QUESTIONS.map((q, qi) => (
                  <Card key={q.key} style={{ padding: 16, gap: 10 }}>
                    <Text style={{ fontWeight: '700', color: theme.colors.text }}>{q.q}</Text>
                    {q.options.map((opt, oi) => (
                      <Pressable key={oi} onPress={() => handleAnswer(q.key, oi)}
                        style={[styles.optionBtn, answers[q.key] === oi && styles.optionActive]}>
                        {answers[q.key] === oi && <Check size={14} color="#fff" />}
                        <Text style={[styles.optionText, answers[q.key] === oi && { color: '#fff' }]}>{opt}</Text>
                      </Pressable>
                    ))}
                  </Card>
                ))}

                <GradientButton label={analyzing ? 'Analyzing...' : 'Get Career Recommendations'} onPress={handleAnalyze} loading={analyzing} />
              </>
            ) : (
              <>
                <Card style={{ padding: 16, alignItems: 'center', gap: 8 }}>
                  <Compass size={32} color={theme.colors.brand} />
                  <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>Top Career Matches</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.muted }}>Based on your skills, interests & preferences</Text>
                </Card>

                {CAREER_PATHS.map((career) => {
                  const Icon = career.icon;
                  return (
                    <Pressable key={career.id} onPress={() => setSelectedCareer(selectedCareer === career.id ? null : career.id)}>
                      <Card style={{ padding: 16, gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={styles.careerIcon}>
                            <Icon size={22} color={theme.colors.brand} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: theme.colors.text }}>{career.title}</Text>
                            <Text style={{ fontSize: 12, color: theme.colors.muted }}>{career.education}</Text>
                          </View>
                          <View style={styles.matchBadge}>
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{career.match}%</Text>
                          </View>
                        </View>

                        {selectedCareer === career.id && (
                          <View style={{ gap: 10, marginTop: 8 }}>
                            <Text style={{ fontSize: 13, color: theme.colors.muted, lineHeight: 18 }}>{career.desc}</Text>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                              <View style={styles.metaItem}>
                                <Briefcase size={12} color={theme.colors.brand} />
                                <Text style={styles.metaText}>{career.salary}</Text>
                              </View>
                              <View style={styles.metaItem}>
                                <TrendingUp size={12} color="#10B981" />
                                <Text style={styles.metaText}>{career.growth} growth</Text>
                              </View>
                            </View>
                            <View>
                              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, marginBottom: 4 }}>Key Skills Needed:</Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {career.skills.map((sk, si) => (
                                  <View key={si} style={styles.skillChip}>
                                    <Text style={{ fontSize: 11, color: theme.colors.brand, fontWeight: '600' }}>{sk}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          </View>
                        )}
                        <ChevronRight size={14} color={theme.colors.muted} style={{ alignSelf: 'flex-end' }} />
                      </Card>
                    </Pressable>
                  );
                })}

                <GradientButton label="Retake Assessment" onPress={() => { setStep('assess'); setAnswers({}); setSelectedCareer(null); }} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  optionActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  optionText: { fontSize: 13, color: theme.colors.text, fontWeight: '500', flex: 1 },
  careerIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  matchBadge: { backgroundColor: theme.colors.brand, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  skillChip: { backgroundColor: theme.colors.brandTertiary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: theme.colors.brand + '20' },
});
