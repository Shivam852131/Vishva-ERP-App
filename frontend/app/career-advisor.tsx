import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton, EmptyState } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import {
  Sparkles, Compass, Briefcase, GraduationCap, TrendingUp,
  Code, FlaskConical, Palette, BookOpen, ChevronRight, Star,
  ArrowRight, Check, Globe, AlertTriangle,
} from 'lucide-react-native';

export default function CareerAdvisor() {
  const [step, setStep] = useState<'assess' | 'results'>('assess');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selectedCareer, setSelectedCareer] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { data: profile } = useFetch<any>('/skills/profile');
  const { data: careerMatches = [] } = useFetch<any[]>('/skills/career-matches');

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

  const handleAnalyze = async () => {
    if (Object.keys(answers).length < QUESTIONS.length) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/skills/career-recommendations', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || data || []);
      }
    } catch {}
    setStep('results');
    setAnalyzing(false);
  };

  const skills = profile?.skills || [];
  const skillSnapshot = skills.length > 0 ? skills.slice(0, 6).map((s: any) => ({
    name: s.name,
    level: s.score || 0,
  })) : [
    { name: 'No skills added yet', level: 0 },
  ];

  const careerResults = recommendations.length > 0 ? recommendations : careerMatches;

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
                {skillSnapshot.map((s: any, i: number) => (
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
                {QUESTIONS.map((q) => (
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

                {careerResults.length === 0 ? (
                  <EmptyState title="No recommendations yet" sub="Complete your skill profile to get personalized career recommendations" />
                ) : (
                  careerResults.map((career: any, i: number) => {
                    const matchPct = career.match || career.match_percentage || Math.max(90 - i * 8, 50);
                    const title = career.title || career.name || career.career || `Career ${i + 1}`;
                    const salary = career.salary || career.salary_range || '';
                    const growth = career.growth || career.growth_rate || '';
                    const requiredSkills = career.skills || career.required_skills || [];
                    const education = career.education || '';

                    return (
                      <Pressable key={career.id || career.key || i} onPress={() => setSelectedCareer(selectedCareer === title ? null : title)}>
                        <Card style={{ padding: 16, gap: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={styles.careerIcon}>
                              <Briefcase size={22} color={theme.colors.brand} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: '700', color: theme.colors.text }}>{title}</Text>
                              {education ? <Text style={{ fontSize: 12, color: theme.colors.muted }}>{education}</Text> : null}
                            </View>
                            <View style={styles.matchBadge}>
                              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{matchPct}%</Text>
                            </View>
                          </View>

                          {selectedCareer === title && (
                            <View style={{ gap: 10, marginTop: 8 }}>
                              {career.desc && <Text style={{ fontSize: 13, color: theme.colors.muted, lineHeight: 18 }}>{career.desc}</Text>}
                              <View style={{ flexDirection: 'row', gap: 12 }}>
                                {salary && (
                                  <View style={styles.metaItem}>
                                    <Briefcase size={12} color={theme.colors.brand} />
                                    <Text style={styles.metaText}>{salary}</Text>
                                  </View>
                                )}
                                {growth && (
                                  <View style={styles.metaItem}>
                                    <TrendingUp size={12} color="#10B981" />
                                    <Text style={styles.metaText}>{growth} growth</Text>
                                  </View>
                                )}
                              </View>
                              {requiredSkills.length > 0 && (
                                <View>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.muted, marginBottom: 4 }}>Key Skills Needed:</Text>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                    {requiredSkills.map((sk: string, si: number) => (
                                      <View key={si} style={styles.skillChip}>
                                        <Text style={{ fontSize: 11, color: theme.colors.brand, fontWeight: '600' }}>{sk}</Text>
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              )}
                            </View>
                          )}
                          <ChevronRight size={14} color={theme.colors.muted} style={{ alignSelf: 'flex-end' }} />
                        </Card>
                      </Pressable>
                    );
                  })
                )}

                <GradientButton label="Retake Assessment" onPress={() => { setStep('assess'); setAnswers({}); setSelectedCareer(null); setRecommendations([]); }} />
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
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', gap: 12 },
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
