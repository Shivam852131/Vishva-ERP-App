import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { useRouter } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Sparkles, FileText, Download, Check, Clock, BookOpen,
  Layers, Hash, ChevronRight, X,
} from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { api } from '@/src/api';
import { useFetch } from '@/src/hooks/useFetch';

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const QUESTION_COUNTS = [10, 20, 30, 50];
const MARKS_OPTIONS = [50, 100, 150, 200];
const Q_TYPES = [
  { key: 'mcq', label: 'MCQ' },
  { key: 'short', label: 'Short Answer' },
  { key: 'long', label: 'Long Answer' },
  { key: 'truefalse', label: 'True/False' },
];

type GeneratedPaper = {
  id: string; subject: string; difficulty: string; totalMarks: number;
  questionCount: number; types: string[]; date: string; questions: any[];
};

export default function QuestionPaperGenerator() {
  const routerNav = useRouter();
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState(20);
  const [totalMarks, setTotalMarks] = useState(100);
  const [selectedTypes, setSelectedTypes] = useState(['mcq', 'short', 'long']);
  const [generating, setGenerating] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState<GeneratedPaper | null>(null);
  const { data: subjects } = useFetch<string[]>('/academics/question-bank/subjects');
  const [history, setHistory] = useState<GeneratedPaper[]>([]);
  const [showSubjects, setShowSubjects] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const toggleType = (key: string) => {
    setSelectedTypes(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key]);
  };

  const handleDownload = async () => {
    if (!generatedPaper) return;
    try {
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const qsHTML = generatedPaper.questions.map((q: any, i: number) => {
        let opts = '';
        if (q.options) {
          opts = q.options.map((o: string, j: number) => `<div style="margin-left:16px;color:#64748b">${String.fromCharCode(65 + j)}. ${esc(o)}</div>`).join('');
        }
        return `<div style="border-bottom:1px solid #e2e8f0;padding:10px 0"><div><strong>${q.id}.</strong> ${esc(q.q)}</div><div style="font-size:11px;color:#64748b;margin-top:4px">${q.type.toUpperCase()} &middot; ${q.marks} mark${q.marks > 1 ? 's' : ''}</div>${opts}</div>`;
      }).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Question Paper - ${esc(generatedPaper.subject)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;padding:32px;color:#1e293b}.header{text-align:center;border-bottom:3px solid #4F46E5;padding-bottom:12px;margin-bottom:20px}.title{font-size:22px;font-weight:800}.meta{font-size:12px;color:#64748b;margin-top:6px}</style></head><body>
<div class="header"><div class="title">${esc(generatedPaper.subject)} Question Paper</div><div class="meta">${generatedPaper.difficulty} &middot; ${generatedPaper.totalMarks} marks &middot; ${generatedPaper.questionCount} questions &middot; ${generatedPaper.date}</div></div>
${qsHTML}</body></html>`;

      const fileName = `QuestionPaper_${generatedPaper.subject.replace(/\s+/g, '_')}_${Date.now()}`;
      const dir = Platform.OS === 'android' ? RNFS.DownloadDirectoryPath : RNFS.DocumentDirectoryPath;
      await RNFS.writeFile(`${dir}/${fileName}.html`, html, 'utf8');
      Alert.alert('Saved', `${fileName}.html saved. Open and print to PDF.`);
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not save paper.');
    }
  };

  const handleGenerate = async () => {
    if (!subject) return Alert.alert('Select Subject', 'Please choose a subject');
    if (selectedTypes.length === 0) return Alert.alert('Select Types', 'Choose at least one question type');
    setGenerating(true);
    try {
      const data = await api('/academics/question-bank/generate', {
        method: 'POST',
        body: JSON.stringify({ subject, difficulty, questionCount, totalMarks, types: selectedTypes }),
      });
      const paper: GeneratedPaper = {
        id: Date.now().toString(), subject, difficulty, totalMarks, questionCount: data.questions?.length || 0,
        types: [...selectedTypes], date: new Date().toLocaleDateString(), questions: data.questions || [],
      };
      setGeneratedPaper(paper);
      setHistory(prev => [paper, ...prev]);
    } catch (err: any) {
      Alert.alert('Generation failed', err?.message || 'Could not generate paper. Make sure questions exist in the question bank for this subject.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={[theme.colors.brand, '#4338CA']} style={styles.heroGrad}>
              <Pressable onPress={() => routerNav.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><Sparkles size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>AI Question Paper Generator</Text>
                  <Text style={styles.heroSub}>Create exams with smart question selection</Text>
                </View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {(['generate', 'history'] as const).map(t => (
              <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabActive]}>
                <Text style={[styles.tabTxt, activeTab === t && { color: '#fff' }]}>{t === 'generate' ? 'Generate' : 'History'}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
            {activeTab === 'generate' ? (
              <>
                <SectionTitle>Select Subject</SectionTitle>
                <Pressable onPress={() => setShowSubjects(!showSubjects)} style={styles.picker}>
                  <Text style={{ color: subject ? theme.colors.text : theme.colors.muted, fontSize: 14 }}>
                    {subject || 'Choose a subject...'}
                  </Text>
                  <ChevronRight size={16} color={theme.colors.muted} />
                </Pressable>
                {showSubjects && (
                  <Card style={{ padding: 0 }}>
                    {(subjects || []).map(s => (
                      <Pressable key={s} onPress={() => { setSubject(s); setShowSubjects(false); }}
                        style={[styles.subjectItem, subject === s && styles.subjectActive]}>
                        <Text style={[styles.subjectText, subject === s && { color: '#fff', fontWeight: '700' }]}>{s}</Text>
                        {subject === s && <Check size={16} color="#fff" />}
                      </Pressable>
                    ))}
                  </Card>
                )}

                <SectionTitle>Difficulty</SectionTitle>
                <View style={styles.chipRow}>
                  {DIFFICULTIES.map(d => (
                    <Pressable key={d} onPress={() => setDifficulty(d)}
                      style={[styles.chip, difficulty === d && styles.chipActive]}>
                      <Text style={[styles.chipText, difficulty === d && { color: '#fff' }]}>{d}</Text>
                    </Pressable>
                  ))}
                </View>

                <SectionTitle>Questions</SectionTitle>
                <View style={styles.chipRow}>
                  {QUESTION_COUNTS.map(n => (
                    <Pressable key={n} onPress={() => setQuestionCount(n)}
                      style={[styles.chip, questionCount === n && styles.chipActive]}>
                      <Text style={[styles.chipText, questionCount === n && { color: '#fff' }]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>

                <SectionTitle>Total Marks</SectionTitle>
                <View style={styles.chipRow}>
                  {MARKS_OPTIONS.map(m => (
                    <Pressable key={m} onPress={() => setTotalMarks(m)}
                      style={[styles.chip, totalMarks === m && styles.chipActive]}>
                      <Text style={[styles.chipText, totalMarks === m && { color: '#fff' }]}>{m}</Text>
                    </Pressable>
                  ))}
                </View>

                <SectionTitle>Question Types</SectionTitle>
                <View style={styles.chipRow}>
                  {Q_TYPES.map(t => (
                    <Pressable key={t.key} onPress={() => toggleType(t.key)}
                      style={[styles.chip, selectedTypes.includes(t.key) && styles.chipActive]}>
                      <Text style={[styles.chipText, selectedTypes.includes(t.key) && { color: '#fff' }]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <GradientButton label={generating ? 'Generating...' : 'Generate Paper'} onPress={handleGenerate} loading={generating} />

                {generatedPaper && (
                  <Card style={{ padding: 16, gap: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>Generated Paper</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable style={styles.iconBtn} onPress={handleDownload}><Download size={16} color={theme.colors.brand} /></Pressable>
                        <Pressable onPress={() => setGeneratedPaper(null)} style={styles.iconBtn}><X size={16} color={theme.colors.error} /></Pressable>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <View style={styles.metaChip}><BookOpen size={12} color={theme.colors.brand} /><Text style={styles.metaText}>{generatedPaper.subject}</Text></View>
                      <View style={styles.metaChip}><Layers size={12} color={theme.colors.brand} /><Text style={styles.metaText}>{generatedPaper.difficulty}</Text></View>
                      <View style={styles.metaChip}><Hash size={12} color={theme.colors.brand} /><Text style={styles.metaText}>{generatedPaper.totalMarks} marks</Text></View>
                    </View>
                    {generatedPaper.questions.map((q: any, i: number) => (
                      <View key={i} style={styles.questionItem}>
                        <Text style={styles.qNum}>{q.id}.</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.qText}>{q.q}</Text>
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <Text style={styles.qType}>{q.type.toUpperCase()}</Text>
                            <Text style={styles.qMarks}>{q.marks} mark{q.marks > 1 ? 's' : ''}</Text>
                          </View>
                          {q.options && q.options.map((o: string, j: number) => (
                            <Text key={j} style={styles.qOption}>{String.fromCharCode(65 + j)}. {o}</Text>
                          ))}
                        </View>
                      </View>
                    ))}
                  </Card>
                )}
              </>
            ) : (
              <>
                {history.length === 0 ? (
                  <Card style={{ padding: 40, alignItems: 'center', gap: 8 }}>
                    <FileText size={40} color={theme.colors.muted} />
                    <Text style={{ color: theme.colors.muted }}>No papers generated yet</Text>
                  </Card>
                ) : history.map(p => (
                  <Card key={p.id} style={{ padding: 16, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>{p.subject}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{p.date}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{p.questionCount} Qs</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{p.totalMarks} marks</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.muted }}>{p.difficulty}</Text>
                    </View>
                  </Card>
                ))}
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
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brand },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 13 },
  picker: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  subjectItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  subjectActive: { backgroundColor: theme.colors.brand },
  subjectText: { fontSize: 14, color: theme.colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 13, color: theme.colors.text, fontWeight: '600' },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brandTertiary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  metaText: { fontSize: 11, fontWeight: '600', color: theme.colors.brand },
  questionItem: { flexDirection: 'row', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  qNum: { fontSize: 14, fontWeight: '800', color: theme.colors.brand, width: 28 },
  qText: { fontSize: 13, color: theme.colors.text, lineHeight: 18 },
  qType: { fontSize: 10, fontWeight: '700', color: theme.colors.muted, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  qMarks: { fontSize: 10, fontWeight: '600', color: theme.colors.brand },
  qOption: { fontSize: 12, color: theme.colors.muted, marginLeft: 8, marginTop: 2 },
});
