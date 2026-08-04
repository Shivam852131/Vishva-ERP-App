import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import {
  Sparkles, ClipboardCheck, Upload, CheckCircle, AlertTriangle,
  FileText, Star, TrendingUp, ChevronRight, X, Eye,
} from 'lucide-react-native';

type FeedbackResult = { score: number; breakdown: { label: string; score: number; color: string }[]; comments: { type: string; text: string }[]; suggestions: string[] };

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Computer Science', 'English', 'Biology'];

export default function AssignmentChecker() {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [uploaded, setUploaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [showSubjects, setShowSubjects] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);
  const { data: submissions } = useFetch<any[]>('/ai/submissions');

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (result) {
      Animated.timing(scoreAnim, { toValue: result.score / 100, duration: 1200, useNativeDriver: false }).start();
    }
  }, [result]);

  useEffect(() => {
    const id = scoreAnim.addListener(({ value }) => setDisplayScore(Math.round(value * 100)));
    return () => scoreAnim.removeListener(id);
  }, []);

  const handleCheck = async () => {
    if (!subject) return Alert.alert('Select Subject', 'Please choose a subject');
    if (!uploaded) return Alert.alert('Upload Required', 'Please upload your assignment');
    setChecking(true);
    try {
      const result = await api('/ai/check-assignment', {
        method: 'POST',
        body: JSON.stringify({ subject, topic, content: '...' }),
      });
      setResult(result);
    } catch {
      Alert.alert('Error', 'Could not check assignment. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleUpload = () => setUploaded(true);

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
                  <Text style={styles.heroTitle}>AI Assignment Checker</Text>
                  <Text style={styles.heroSub}>Get instant AI-powered feedback on your work</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {!result ? (
              <>
                <SectionTitle>Select Subject</SectionTitle>
                <Pressable onPress={() => setShowSubjects(!showSubjects)} style={styles.picker}>
                  <Text style={{ color: subject ? theme.colors.text : theme.colors.muted, fontSize: 14 }}>{subject || 'Choose a subject...'}</Text>
                  <ChevronRight size={16} color={theme.colors.muted} />
                </Pressable>
                {showSubjects && (
                  <Card style={{ padding: 0 }}>
                    {SUBJECTS.map(s => (
                      <Pressable key={s} onPress={() => { setSubject(s); setShowSubjects(false); }}
                        style={[styles.subjectItem, subject === s && styles.subjectActive]}>
                        <Text style={[styles.subjectText, subject === s && { color: '#fff', fontWeight: '700' }]}>{s}</Text>
                      </Pressable>
                    ))}
                  </Card>
                )}

                <SectionTitle>Assignment Topic</SectionTitle>
                <TextInput style={styles.input} value={topic} onChangeText={setTopic}
                  placeholder="e.g., Binary Search Trees" placeholderTextColor={theme.colors.muted} />

                <SectionTitle>Upload Assignment</SectionTitle>
                <Pressable onPress={handleUpload} style={[styles.uploadArea, uploaded && styles.uploadedArea]}>
                  {uploaded ? (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={32} color="#10B981" />
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>Assignment Uploaded</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>Tap to replace</Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', gap: 8 }}>
                      <Upload size={32} color={theme.colors.brand} />
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>Tap to Upload</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>PDF, DOCX, or TXT (max 10MB)</Text>
                    </View>
                  )}
                </Pressable>

                <GradientButton label={checking ? 'Checking Assignment...' : 'Check Assignment'} onPress={handleCheck} loading={checking} />
              </>
            ) : (
              <>
                <Card style={styles.scoreCard}>
                  <View style={styles.scoreRing}>
                    <Animated.Text style={[styles.scoreText, { opacity: scoreAnim }]}>
                      {displayScore}
                    </Animated.Text>
                    <Text style={styles.scoreLabel}>/ 100</Text>
                  </View>
                  <Text style={styles.scoreTitle}>Overall Score</Text>
                  <Text style={{ fontSize: 13, color: theme.colors.muted, textAlign: 'center' }}>{subject} - {topic}</Text>
                </Card>

                <SectionTitle>Score Breakdown</SectionTitle>
                {result.breakdown.map((b, i) => (
                  <Card key={i} style={{ padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.text }}>{b.label}</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: b.color }}>{b.score}%</Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${b.score}%`, backgroundColor: b.color }]} />
                    </View>
                  </Card>
                ))}

                <SectionTitle>AI Feedback</SectionTitle>
                {result.comments.map((c, i) => (
                  <Card key={i} style={{ padding: 12, gap: 6 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                      {c.type === 'good' ? <CheckCircle size={16} color="#10B981" /> : <AlertTriangle size={16} color="#F59E0B" />}
                      <Text style={{ fontSize: 13, color: theme.colors.text, flex: 1, lineHeight: 18 }}>{c.text}</Text>
                    </View>
                  </Card>
                ))}

                <SectionTitle>Improvement Suggestions</SectionTitle>
                <Card style={{ padding: 16, gap: 8 }}>
                  {result.suggestions.map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                      <Star size={14} color={theme.colors.brand} style={{ marginTop: 2 }} />
                      <Text style={{ fontSize: 13, color: theme.colors.text, flex: 1, lineHeight: 18 }}>{s}</Text>
                    </View>
                  ))}
                </Card>

                <GradientButton label="Check Another Assignment" onPress={() => { setResult(null); setUploaded(false); setSubject(''); setTopic(''); }} />
              </>
            )}

            <SectionTitle>Recent Submissions</SectionTitle>
            {submissions && submissions.length > 0 ? (
              submissions.map((s: any) => (
                <Card key={s.id} style={{ padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>{s.title}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{s.subject} · {s.date}</Text>
                    </View>
                    <View style={[styles.scoreBadge, s.score >= 80 ? styles.scoreGood : s.score >= 60 ? styles.scoreMid : styles.scoreLow]}>
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{s.score}</Text>
                    </View>
                  </View>
                </Card>
              ))
            ) : (
              <Card style={{ padding: 20, alignItems: 'center', gap: 8 }}>
                <FileText size={28} color={theme.colors.muted} />
                <Text style={{ color: theme.colors.muted, fontSize: 13 }}>No submissions yet</Text>
              </Card>
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
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  subjectItem: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  subjectActive: { backgroundColor: theme.colors.brand },
  subjectText: { fontSize: 14, color: theme.colors.text },
  input: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 16, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  uploadArea: { borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.border, borderRadius: 16, paddingVertical: 40, alignItems: 'center' },
  uploadedArea: { borderColor: '#10B981', backgroundColor: '#10B98108' },
  scoreCard: { padding: 24, alignItems: 'center', gap: 8 },
  scoreRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 36, fontWeight: '800', color: theme.colors.brand },
  scoreLabel: { fontSize: 12, color: theme.colors.muted },
  scoreTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  scoreBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scoreGood: { backgroundColor: '#10B981' },
  scoreMid: { backgroundColor: '#F59E0B' },
  scoreLow: { backgroundColor: '#EF4444' },
});
