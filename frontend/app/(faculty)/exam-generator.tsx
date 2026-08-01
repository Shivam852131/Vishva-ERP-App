import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from '@/src/navigation/router';
import { Ionicons } from '@/src/components/Ionicons';
import * as ImagePicker from '@/src/native/image-picker';
import { useFetch, useMutate } from '../../src/hooks/useFetch';

type Question = {
  id: string; subject: string; unit: string; chapter: string;
  question_text: string; question_type: string; options: string[];
  correct_answer: string; difficulty: string; marks: number; image_url?: string;
};

type GeneratedExam = {
  id: string; title: string; subject: string; total_questions: number;
  total_marks: number; difficulty: string; created_at: string; created_by_name: string;
};

export default function ExamGeneratorScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'bank' | 'generate' | 'generated'>('bank');
  const { data: subjects } = useFetch<string[]>('/question-bank/subjects');
  const { data: questions, refresh: refreshQ } = useFetch<Question[]>('/question-bank');
  const { data: exams, refresh: refreshE } = useFetch<GeneratedExam[]>('/generated-exams');
  const { data: stats } = useFetch<any>('/question-bank/stats');
  const { mutate } = useMutate<any>();

  const [addModal, setAddModal] = useState(false);
  const [newQ, setNewQ] = useState({ subject: '', unit: 'Unit 1', chapter: 'Chapter 1', question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', difficulty: 'medium', marks: 1, image_base64: '' });
  const [genForm, setGenForm] = useState({ subject: '', units: [] as string[], chapters: [] as string[], difficulty: 'mixed', total_questions: 50, total_marks: 100, title: '', instructions: '' });
  const [generating, setGenerating] = useState(false);
  const [generatedExam, setGeneratedExam] = useState<any>(null);
  const [filterSubject, setFilterSubject] = useState('');

  const filteredQuestions = (questions || []).filter((q) => {
    if (filterSubject && q.subject !== filterSubject) return false;
    return true;
  });

  const handleAddQuestion = async () => {
    if (!newQ.question_text.trim() && !newQ.image_base64) return Alert.alert('Error', 'Enter question text or attach a photo');
    if (!newQ.subject.trim()) return Alert.alert('Error', 'Enter subject');
    try {
      await mutate('/question-bank', {
        method: 'POST',
        body: JSON.stringify({
          ...newQ,
          question_text: newQ.question_text.trim() || '[Photo Question - Edit to add text]',
          question_type: newQ.image_base64 && !newQ.question_text.trim() ? 'subjective' : newQ.question_type,
        }),
      });
      Alert.alert('Added!', 'Question added to bank');
      setAddModal(false);
      setNewQ({ subject: '', unit: 'Unit 1', chapter: 'Chapter 1', question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', difficulty: 'medium', marks: 1, image_base64: '' });
      refreshQ();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const pickQuestionPhoto = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return Alert.alert('Permission required', 'Camera access is needed to capture a question photo.');
      }
      const res = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.5, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.5, allowsEditing: true });
      const asset = res.assets?.[0];
      if (!res.canceled && asset?.base64) {
        setNewQ((q) => ({ ...q, image_base64: asset.base64 || '', question_type: 'subjective', marks: q.marks || 5 }));
        Alert.alert('Photo attached', 'The image will be saved with this question. Add/edit the text if needed.');
      }
    } catch (e: any) {
      Alert.alert('Photo failed', e.message || 'Could not attach photo');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    Alert.alert('Delete', 'Remove this question?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await mutate(`/question-bank/${id}`, { method: 'DELETE' });
          refreshQ();
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'Could not delete question');
        }
      }},
    ]);
  };

  const handleGenerate = async () => {
    if (!genForm.subject) return Alert.alert('Error', 'Select a subject');
    setGenerating(true);
    try {
      const exam = await mutate('/exams/generate', {
        method: 'POST',
        body: JSON.stringify(genForm),
      });
      setGeneratedExam(exam);
      Alert.alert('Generated!', `Exam with ${exam.total_questions} questions (${exam.total_marks} marks)`);
      refreshE();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setGenerating(false); }
  };

  const getDiffColor = (d: string) => d === 'easy' ? '#10b981' : d === 'hard' ? '#ef4444' : '#f59e0b';
  const getTypeIcon = (t: string) => t === 'mcq' ? 'radio-button-on' : t === 'true_false' ? 'checkmark-circle' : 'create';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exam Generator</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{stats?.total || 0}</Text>
          <Text style={styles.statLabel}>Questions</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{stats?.subjects?.length || 0}</Text>
          <Text style={styles.statLabel}>Subjects</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{exams?.length || 0}</Text>
          <Text style={styles.statLabel}>Generated</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {[{ key: 'bank' as const, icon: 'library', label: 'Question Bank' },
          { key: 'generate' as const, icon: 'document-text', label: 'Generate' },
          { key: 'generated' as const, icon: 'list', label: 'Generated' }].map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={t.icon as any} size={18} color={tab === t.key ? '#6366f1' : '#64748b'} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'bank' && (
        <View style={{ flex: 1 }}>
          <View style={styles.filterRow}>
            <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterSubject('')}>
              <Text style={[styles.filterText, !filterSubject && styles.filterTextActive]}>All</Text>
            </TouchableOpacity>
            {(subjects || []).map((s) => (
              <TouchableOpacity key={s} style={[styles.filterBtn, filterSubject === s && styles.filterBtnActive]} onPress={() => setFilterSubject(s)}>
                <Text style={[styles.filterText, filterSubject === s && styles.filterTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
              <Ionicons name="add-circle" size={32} color="#6366f1" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }}>
            {filteredQuestions.map((q) => (
              <View key={q.id} style={styles.qCard}>
                <View style={styles.qHeader}>
                  <View style={[styles.diffBadge, { backgroundColor: getDiffColor(q.difficulty) + '20' }]}>
                    <Text style={[styles.diffText, { color: getDiffColor(q.difficulty) }]}>{q.difficulty.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.qMarks}>{q.marks} marks</Text>
                  <TouchableOpacity onPress={() => handleDeleteQuestion(q.id)}>
                    <Ionicons name="trash" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.qText} numberOfLines={3}>{q.question_text}</Text>
                <View style={styles.qMeta}>
                  <Text style={styles.qMetaText}>{q.subject}</Text>
                  <Text style={styles.qDot}>·</Text>
                  <Text style={styles.qMetaText}>{q.unit}</Text>
                  <Text style={styles.qDot}>·</Text>
                  <Ionicons name={getTypeIcon(q.question_type) as any} size={12} color="#94a3b8" />
                <Text style={styles.qMetaText}>{q.question_type}</Text>
                  {q.image_url ? <Text style={styles.qMetaText}>· photo</Text> : null}
                </View>
                {q.options?.length > 0 && (
                  <View style={styles.optionsPreview}>
                    {q.options.slice(0, 4).map((opt, i) => (
                      <Text key={i} style={styles.optionText}>{String.fromCharCode(65 + i)}. {opt}</Text>
                    ))}
                  </View>
                )}
              </View>
            ))}
            {filteredQuestions.length === 0 && <Text style={styles.emptyText}>No questions yet. Tap + to add.</Text>}
          </ScrollView>
        </View>
      )}

      {tab === 'generate' && (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          <Text style={styles.sectionTitle}>Generate Exam Paper</Text>
          <Text style={styles.sectionSub}>Select parameters and generate a PDF-ready exam</Text>

          <Text style={styles.label}>Subject *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {(subjects || []).map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, genForm.subject === s && styles.chipActive]} onPress={() => setGenForm({ ...genForm, subject: s })}>
                <Text style={[styles.chipText, genForm.subject === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.diffRow}>
            {['mixed', 'easy', 'medium', 'hard'].map((d) => (
              <TouchableOpacity key={d} style={[styles.diffBtn, genForm.difficulty === d && styles.diffBtnActive]} onPress={() => setGenForm({ ...genForm, difficulty: d })}>
                <Text style={[styles.diffBtnText, genForm.difficulty === d && styles.diffBtnTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Number of Questions</Text>
          <TextInput style={styles.input} value={String(genForm.total_questions)} onChangeText={(t) => setGenForm({ ...genForm, total_questions: parseInt(t) || 0 })} keyboardType="numeric" placeholder="50" placeholderTextColor="#475569" />

          <Text style={styles.label}>Total Marks</Text>
          <TextInput style={styles.input} value={String(genForm.total_marks)} onChangeText={(t) => setGenForm({ ...genForm, total_marks: parseInt(t) || 0 })} keyboardType="numeric" placeholder="100" placeholderTextColor="#475569" />

          <Text style={styles.label}>Exam Title</Text>
          <TextInput style={styles.input} value={genForm.title} onChangeText={(t) => setGenForm({ ...genForm, title: t })} placeholder="e.g. Mid-Term Examination" placeholderTextColor="#475569" />

          <Text style={styles.label}>Instructions</Text>
          <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={genForm.instructions} onChangeText={(t) => setGenForm({ ...genForm, instructions: t })} multiline placeholder="Answer all questions..." placeholderTextColor="#475569" />

          <TouchableOpacity style={[styles.generateBtn, generating && { opacity: 0.6 }]} onPress={handleGenerate} disabled={generating}>
            {generating ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="document-text" size={20} color="#fff" />
                <Text style={styles.generateBtnText}>Generate Exam Paper</Text>
              </>
            )}
          </TouchableOpacity>

          {generatedExam && (
            <View style={styles.resultCard}>
              <Ionicons name="checkmark-circle" size={32} color="#10b981" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.resultTitle}>{generatedExam.title}</Text>
                <Text style={styles.resultMeta}>{generatedExam.total_questions} questions · {generatedExam.total_marks} marks · {generatedExam.difficulty}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'generated' && (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {(exams || []).map((exam) => (
            <View key={exam.id} style={styles.examCard}>
              <View style={styles.examHeader}>
                <Ionicons name="document-text" size={24} color="#6366f1" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.examTitle}>{exam.title}</Text>
                  <Text style={styles.examMeta}>{exam.subject} · {exam.total_questions} Q · {exam.total_marks} marks</Text>
                </View>
              </View>
              <View style={styles.examFooter}>
                <Text style={styles.examDate}>By {exam.created_by_name}</Text>
                <Text style={styles.examDate}>{new Date(exam.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
          {(!exams || exams.length === 0) && <Text style={styles.emptyText}>No exams generated yet</Text>}
        </ScrollView>
      )}

      <Modal visible={addModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Question</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={styles.label}>Subject *</Text>
              <TextInput style={styles.input} value={newQ.subject} onChangeText={(t) => setNewQ({ ...newQ, subject: t })} placeholder="e.g. Mathematics" placeholderTextColor="#475569" />

              <Text style={styles.label}>Unit</Text>
              <TextInput style={styles.input} value={newQ.unit} onChangeText={(t) => setNewQ({ ...newQ, unit: t })} placeholder="Unit 1" placeholderTextColor="#475569" />

              <Text style={styles.label}>Chapter</Text>
              <TextInput style={styles.input} value={newQ.chapter} onChangeText={(t) => setNewQ({ ...newQ, chapter: t })} placeholder="Chapter 1" placeholderTextColor="#475569" />

              <Text style={styles.label}>Question Type</Text>
              <View style={styles.typeRow}>
                {['mcq', 'true_false', 'short_answer', 'long_answer'].map((t) => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, newQ.question_type === t && styles.typeBtnActive]} onPress={() => setNewQ({ ...newQ, question_type: t })}>
                    <Text style={[styles.typeBtnText, newQ.question_type === t && styles.typeBtnTextActive]}>{t.replace('_', ' ')}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Question Text *</Text>
              <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={newQ.question_text} onChangeText={(t) => setNewQ({ ...newQ, question_text: t })} multiline placeholder="Enter the question..." placeholderTextColor="#475569" />

              <Text style={styles.label}>Attach Question Photo</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoBtn} onPress={() => pickQuestionPhoto('camera')}>
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.photoBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoBtn} onPress={() => pickQuestionPhoto('library')}>
                  <Ionicons name="image" size={18} color="#fff" />
                  <Text style={styles.photoBtnText}>Gallery</Text>
                </TouchableOpacity>
              </View>
              {newQ.image_base64 ? (
                <View style={styles.photoAttached}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.photoAttachedText}>Photo attached</Text>
                  <TouchableOpacity onPress={() => setNewQ({ ...newQ, image_base64: '' })}>
                    <Text style={styles.removePhotoText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {newQ.question_type === 'mcq' && (
                <>
                  <Text style={styles.label}>Options (4)</Text>
                  {newQ.options.map((opt, i) => (
                    <TextInput key={i} style={styles.input} value={opt} onChangeText={(t) => { const opts = [...newQ.options]; opts[i] = t; setNewQ({ ...newQ, options: opts }); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} placeholderTextColor="#475569" />
                  ))}
                  <Text style={styles.label}>Correct Answer</Text>
                  <TextInput style={styles.input} value={newQ.correct_answer} onChangeText={(t) => setNewQ({ ...newQ, correct_answer: t })} placeholder="e.g. A" placeholderTextColor="#475569" />
                </>
              )}

              <Text style={styles.label}>Difficulty</Text>
              <View style={styles.diffRow}>
                {['easy', 'medium', 'hard'].map((d) => (
                  <TouchableOpacity key={d} style={[styles.diffBtn, newQ.difficulty === d && styles.diffBtnActive]} onPress={() => setNewQ({ ...newQ, difficulty: d })}>
                    <Text style={[styles.diffBtnText, newQ.difficulty === d && styles.diffBtnTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Marks</Text>
              <TextInput style={styles.input} value={String(newQ.marks)} onChangeText={(t) => setNewQ({ ...newQ, marks: parseInt(t) || 1 })} keyboardType="numeric" placeholder="1" placeholderTextColor="#475569" />

              <TouchableOpacity style={styles.saveBtn} onPress={handleAddQuestion}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Add to Question Bank</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 16, marginBottom: 12 },
  statBox: { alignItems: 'center', backgroundColor: '#1e293b', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  statNum: { color: '#6366f1', fontSize: 22, fontWeight: '800' },
  statLabel: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  tabBar: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 8, gap: 6 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e293b' },
  tabBtnActive: { backgroundColor: '#1e1b4b', borderWidth: 1, borderColor: '#6366f1' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#6366f1' },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1e293b' },
  filterBtnActive: { backgroundColor: '#6366f1' },
  filterText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  addBtn: { marginLeft: 'auto' },
  qCard: { backgroundColor: '#1e293b', marginHorizontal: 12, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  qHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  diffText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  qMarks: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  qText: { color: '#e2e8f0', fontSize: 13, lineHeight: 18 },
  qMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  qMetaText: { color: '#64748b', fontSize: 11 },
  qDot: { color: '#475569', fontSize: 11 },
  optionsPreview: { marginTop: 8, gap: 2 },
  optionText: { color: '#94a3b8', fontSize: 11, paddingLeft: 4 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 40 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  sectionSub: { color: '#94a3b8', fontSize: 12, marginBottom: 20 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, color: '#e2e8f0', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1e293b', marginRight: 8 },
  chipActive: { backgroundColor: '#6366f1' },
  chipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  diffRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  diffBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e293b', alignItems: 'center' },
  diffBtnActive: { backgroundColor: '#6366f1' },
  diffBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  diffBtnTextActive: { color: '#fff' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b' },
  typeBtnActive: { backgroundColor: '#6366f1' },
  typeBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  typeBtnTextActive: { color: '#fff' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', paddingVertical: 16, borderRadius: 12, marginTop: 20, gap: 8 },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', padding: 16, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  resultTitle: { color: '#10b981', fontSize: 15, fontWeight: '700' },
  resultMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  examCard: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  examHeader: { flexDirection: 'row', alignItems: 'center' },
  examTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  examMeta: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  examFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  examDate: { color: '#64748b', fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981', paddingVertical: 14, borderRadius: 12, marginTop: 16, gap: 8, marginBottom: 40 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155', borderRadius: 10, paddingVertical: 12 },
  photoBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoAttached: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.12)', padding: 10, borderRadius: 10, marginTop: 8 },
  photoAttachedText: { color: '#10b981', fontSize: 12, fontWeight: '700', flex: 1 },
  removePhotoText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
});
