/**
 * exam-prep-question-manager.tsx
 * Faculty/Admin — Full Question Manager
 * Tabs: Manual Add, AI Generate, Excel/CSV Import, Bulk Preview
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Alert, ActivityIndicator, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Plus, Brain, Upload, FileText, Check, X,
  ChevronDown, RefreshCw, Save, Eye, Trash2, Zap, AlertCircle,
} from 'lucide-react-native';
import { api } from '@/src/api';
import type { QuestionBankItem, QuestionDifficulty, EducationLevel, AIGeneratedQuestion } from '@/src/types';
import { theme } from '@/src/theme';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as ImagePicker from '@/src/native/image-picker';
import * as DocumentPicker from 'react-native-document-picker';

type ImportResult = {
  inserted: number;
  skipped?: number;
  errors?: { row: number; reason: string; question?: string }[];
  sheets?: string[];
  unused_sheets?: string[];
  truncated?: boolean;
};

/** Derive a multipart MIME type — the picker can return null for these. */
function mimeFor(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'xlsx' || ext === 'xlsm') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === 'xls') return 'application/vnd.ms-excel';
  if (ext === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

const DIFFICULTIES: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
const EDUCATION_LEVELS: { key: EducationLevel; label: string }[] = [
  { key: 'school', label: 'School (Gr. 6–12)' },
  { key: 'college', label: 'College / University' },
  { key: 'competitive', label: 'Competitive Exams' },
];
const TABS = ['Manual', 'AI Generate', 'Import', 'Preview'] as const;
type Tab = typeof TABS[number];

function OptionInput({ label, value, onChange, isCorrect, onMarkCorrect }: {
  label: string; value: string; onChange: (v: string) => void;
  isCorrect: boolean; onMarkCorrect: () => void;
}) {
  return (
    <View style={styles.optionRow}>
      <Pressable style={[styles.optionBadge, isCorrect && styles.optionBadgeCorrect]} onPress={onMarkCorrect}>
        <Text style={[styles.optionBadgeText, isCorrect && { color: '#fff' }]}>{label}</Text>
      </Pressable>
      <TextInput
        style={[styles.optionInput, isCorrect && styles.optionInputCorrect]}
        value={value}
        onChangeText={onChange}
        placeholder={`Option ${label}`}
        placeholderTextColor={theme.colors.textSecondary}
      />
    </View>
  );
}

function ManualTab({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    subject: '', topic: '', subtopic: '', question: '', explanation: '',
    options: ['', '', '', ''], answer: 0,
    difficulty: 'medium' as QuestionDifficulty,
    educationLevel: 'college' as EducationLevel,
    tags: '',
  });
  const [saving, setSaving] = useState(false);

  const update = (key: keyof typeof form, val: any) => setForm(f => ({ ...f, [key]: val }));
  const updateOption = (i: number, val: string) => {
    const opts = [...form.options];
    opts[i] = val;
    update('options', opts);
  };

  const handleSave = async () => {
    if (!form.question.trim()) return Alert.alert('Error', 'Question text is required.');
    const filledOpts = form.options.filter(o => o.trim());
    if (filledOpts.length < 2) return Alert.alert('Error', 'At least 2 options are required.');

    setSaving(true);
    try {
      await api('/exam-prep/questions', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          options: form.options.filter(o => o.trim()),
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          education_level: form.educationLevel,
        }),
      });
      Alert.alert('Saved!', 'Question added to the bank.');
      setForm({
        subject: '', topic: '', subtopic: '', question: '', explanation: '',
        options: ['', '', '', ''], answer: 0, difficulty: 'medium',
        educationLevel: 'college', tags: '',
      });
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Basic Info</Text>
        <TextInput style={styles.input} placeholder="Subject *" value={form.subject} onChangeText={v => update('subject', v)} placeholderTextColor={theme.colors.textSecondary} />
        <TextInput style={styles.input} placeholder="Topic" value={form.topic} onChangeText={v => update('topic', v)} placeholderTextColor={theme.colors.textSecondary} />
        <TextInput style={styles.input} placeholder="Subtopic (optional)" value={form.subtopic} onChangeText={v => update('subtopic', v)} placeholderTextColor={theme.colors.textSecondary} />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Question *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Enter the question text…"
          value={form.question}
          onChangeText={v => update('question', v)}
          multiline
          numberOfLines={4}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Options — tap a letter to mark as correct</Text>
        {['A', 'B', 'C', 'D'].map((l, i) => (
          <OptionInput key={l} label={l} value={form.options[i]} onChange={v => updateOption(i, v)}
            isCorrect={form.answer === i} onMarkCorrect={() => update('answer', i)} />
        ))}
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Explanation (shown after answer)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Why is this the correct answer?"
          value={form.explanation}
          onChangeText={v => update('explanation', v)}
          multiline
          numberOfLines={3}
          placeholderTextColor={theme.colors.textSecondary}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map(d => (
            <Pressable key={d} style={[styles.chip, form.difficulty === d && styles.chipActive]} onPress={() => update('difficulty', d)}>
              <Text style={[styles.chipText, form.difficulty === d && styles.chipTextActive]}>{d}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Education Level</Text>
        <View style={styles.chipRow}>
          {EDUCATION_LEVELS.map(({ key, label }) => (
            <Pressable key={key} style={[styles.chip, form.educationLevel === key && styles.chipActive]} onPress={() => update('educationLevel', key)}>
              <Text style={[styles.chipText, form.educationLevel === key && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Tags (comma-separated)</Text>
        <TextInput style={styles.input} placeholder="e.g. algebra, quadratic, jee" value={form.tags} onChangeText={v => update('tags', v)} placeholderTextColor={theme.colors.textSecondary} />
      </View>

      <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <><Save size={16} color="#fff" /><Text style={styles.saveBtnText}>Save Question</Text></>}
      </Pressable>
    </ScrollView>
  );
}

function AIGenerateTab({ onSaved }: { onSaved: () => void }) {
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('medium');
  const [level, setLevel] = useState<EducationLevel>('college');
  const [count, setCount] = useState('5');
  const [generating, setGenerating] = useState(false);
  const [generatedQs, setGeneratedQs] = useState<AIGeneratedQuestion[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  // Image extraction mode
  const [ocrText, setOcrText] = useState('');
  const [mode, setMode] = useState<'topic' | 'image'>('topic');
  // Held so /extract-image can hand the actual pixels to the vision LLM
  // instead of only the pasted transcription.
  const [pickedImage, setPickedImage] = useState<{ base64: string; mime: string } | null>(null);

  const generate = async () => {
    if (!subject.trim()) return Alert.alert('Error', 'Subject is required.');

    if (mode === 'image') {
      const hasImage = Boolean(pickedImage?.base64);
      const hasText = Boolean(ocrText.trim());
      if (!hasImage && !hasText) {
        return Alert.alert('Nothing to read', 'Pick an image, or paste the text from it.');
      }

      setGenerating(true);
      try {
        const body: any = { subject, education_level: level };
        // Prefer the image itself — the server has a vision path that can read
        // marks and formatting a transcription loses. Fall back to pasted text.
        if (hasImage) body.image_base64 = `data:${pickedImage!.mime};base64,${pickedImage!.base64}`;
        else body.ocr_text = ocrText.trim();

        const result = await api('/exam-prep/extract-image', {
          method: 'POST',
          body: JSON.stringify(body),
          // Vision extraction is a real LLM round-trip, past the default 30s.
          timeoutMs: 180000,
        });
        setGeneratedQs(result.questions || []);
        setSelected(new Set((result.questions || []).map((_: any, i: number) => i)));
      } catch (e: any) {
        Alert.alert('Extraction failed', e.message || 'Could not read that image. Paste the text instead.');
      } finally {
        setGenerating(false);
      }
      return;
    }

    setGenerating(true);
    try {
      const result = await api('/exam-prep/generate-ai', {
        method: 'POST',
        body: JSON.stringify({ subject, topic, difficulty, count: parseInt(count, 10), education_level: level }),
      });
      setGeneratedQs(result.questions || []);
      setSelected(new Set((result.questions || []).map((_: any, i: number) => i)));
    } catch (e: any) {
      Alert.alert('AI Error', e.message || 'Generation failed. Check your AI provider config.');
    } finally {
      setGenerating(false);
    }
  };

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      const asset = res.assets?.[0];
      if (res.canceled || !asset) return;
      if (!asset.base64) {
        Alert.alert('Could not read image', 'That image returned no data. Try another, or paste the text instead.');
        return;
      }
      setPickedImage({ base64: asset.base64, mime: asset.type || 'image/jpeg' });
    } catch (e: any) {
      Alert.alert('Image error', e.message || 'Could not open the image picker.');
    }
  };

  const saveSelected = async () => {
    const toSave = generatedQs.filter((_, i) => selected.has(i)).map(q => ({
      ...q,
      subject,
      education_level: level,
    }));
    if (!toSave.length) return Alert.alert('Select at least one question to save.');
    setSaving(true);
    try {
      const result = await api('/exam-prep/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ questions: toSave, subject, education_level: level }),
      });
      Alert.alert('Saved!', `${result.inserted} question(s) added to bank.`);
      setGeneratedQs([]);
      setSelected(new Set());
      onSaved();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <Pressable style={[styles.modeBtn, mode === 'topic' && styles.modeBtnActive]} onPress={() => setMode('topic')}>
          <Brain size={14} color={mode === 'topic' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === 'topic' && { color: '#fff' }]}>From Topic</Text>
        </Pressable>
        <Pressable style={[styles.modeBtn, mode === 'image' && styles.modeBtnActive]} onPress={() => setMode('image')}>
          <FileText size={14} color={mode === 'image' ? '#fff' : theme.colors.textSecondary} />
          <Text style={[styles.modeBtnText, mode === 'image' && { color: '#fff' }]}>From Image/PDF</Text>
        </Pressable>
      </View>

      <View style={styles.formSection}>
        <TextInput style={styles.input} placeholder="Subject *" value={subject} onChangeText={setSubject} placeholderTextColor={theme.colors.textSecondary} />
        {mode === 'topic' && (
          <>
            <TextInput style={styles.input} placeholder="Topic (e.g. Thermodynamics)" value={topic} onChangeText={setTopic} placeholderTextColor={theme.colors.textSecondary} />
            <Text style={styles.sectionLabel}>Questions to generate</Text>
            <View style={styles.chipRow}>
              {['3', '5', '10', '15', '20'].map(n => (
                <Pressable key={n} style={[styles.chip, count === n && styles.chipActive]} onPress={() => setCount(n)}>
                  <Text style={[styles.chipText, count === n && styles.chipTextActive]}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Difficulty</Text>
            <View style={styles.chipRow}>
              {DIFFICULTIES.map(d => (
                <Pressable key={d} style={[styles.chip, difficulty === d && styles.chipActive]} onPress={() => setDifficulty(d)}>
                  <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>{d}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        {mode === 'image' && (
          <>
            <Pressable style={[styles.imagePickBtn, pickedImage && styles.imagePickBtnActive]} onPress={pickImage}>
              <Upload size={16} color={theme.colors.brand} />
              <Text style={styles.imagePickText}>
                {pickedImage ? 'Change image' : 'Select image'}
              </Text>
            </Pressable>

            {pickedImage && (
              <View style={styles.imageChosen}>
                <Check size={14} color="#059669" />
                <Text style={styles.imageChosenText} numberOfLines={1}>Image ready — it will be read directly.</Text>
                <Pressable onPress={() => setPickedImage(null)} hitSlop={8}>
                  <Text style={styles.imageClear}>Remove</Text>
                </Pressable>
              </View>
            )}

            <TextInput
              style={[styles.input, styles.textArea, { minHeight: 120 }]}
              placeholder={pickedImage ? 'Optional — add context (topic, chapter) to help extraction…' : 'Or paste text from the PDF / image here…'}
              value={ocrText}
              onChangeText={setOcrText}
              multiline
              placeholderTextColor={theme.colors.textSecondary}
            />
          </>
        )}
        <Text style={styles.sectionLabel}>Education Level</Text>
        <View style={styles.chipRow}>
          {EDUCATION_LEVELS.map(({ key, label }) => (
            <Pressable key={key} style={[styles.chip, level === key && styles.chipActive]} onPress={() => setLevel(key)}>
              <Text style={[styles.chipText, level === key && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={[styles.generateBtn, generating && { opacity: 0.6 }]} onPress={generate} disabled={generating}>
        {generating ? <ActivityIndicator color="#fff" /> : <><Zap size={16} color="#fff" /><Text style={styles.generateBtnText}>Generate with AI</Text></>}
      </Pressable>

      {generatedQs.length > 0 && (
        <>
          <View style={styles.generatedHeader}>
            <Text style={styles.generatedTitle}>{generatedQs.length} questions generated</Text>
            <Pressable onPress={() => setSelected(new Set(generatedQs.map((_, i) => i)))}>
              <Text style={styles.selectAll}>Select All</Text>
            </Pressable>
          </View>

          {generatedQs.map((q, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 40)} style={[styles.genCard, selected.has(i) && styles.genCardSelected]}>
              <Pressable style={styles.genCardHeader} onPress={() => setSelected(s => {
                const ns = new Set(s); ns.has(i) ? ns.delete(i) : ns.add(i); return ns;
              })}>
                <View style={[styles.checkbox, selected.has(i) && styles.checkboxChecked]}>
                  {selected.has(i) && <Check size={12} color="#fff" />}
                </View>
                <Text style={styles.genQ} numberOfLines={3}>{q.question}</Text>
              </Pressable>
              <View style={styles.genOptions}>
                {q.options.map((opt, j) => (
                  <Text key={j} style={[styles.genOpt, j === q.answer && styles.genOptCorrect]}>
                    {String.fromCharCode(65 + j)}. {opt}{j === q.answer ? ' ✓' : ''}
                  </Text>
                ))}
              </View>
              {q.explanation ? <Text style={styles.genExp}>{q.explanation}</Text> : null}
            </Animated.View>
          ))}

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveSelected} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <><Save size={16} color="#fff" /><Text style={styles.saveBtnText}>Save {selected.size} Selected to Bank</Text></>}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function ImportTab({ onSaved }: { onSaved: () => void }) {
  const [jsonText, setJsonText] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState<EducationLevel>('college');
  const [parsed, setParsed] = useState<any[]>([]);
  const [parseError, setParseError] = useState('');
  const [saving, setSaving] = useState(false);

  // File import state
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const TEMPLATE = `[
  {
    "question": "What is the capital of India?",
    "options": ["Mumbai", "New Delhi", "Kolkata", "Chennai"],
    "answer": 1,
    "difficulty": "easy",
    "explanation": "New Delhi is the capital of India.",
    "topic": "Geography"
  }
]`;

  const handleParse = () => {
    setParseError('');
    try {
      const data = JSON.parse(jsonText);
      if (!Array.isArray(data)) throw new Error('Must be a JSON array');
      setParsed(data);
      Alert.alert('Parsed!', `${data.length} question(s) ready to import.`);
    } catch (e: any) {
      setParseError(e.message);
      setParsed([]);
    }
  };

  const handleImport = async () => {
    if (!parsed.length) return Alert.alert('Parse first', 'Click Parse to validate JSON before importing.');
    setSaving(true);
    try {
      const result = await api('/exam-prep/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ questions: parsed, subject, education_level: level }),
      });
      Alert.alert('Imported!', `${result.inserted} question(s) added. ${result.skipped} skipped (invalid).`);
      setJsonText('');
      setParsed([]);
      onSaved();
    } catch (e: any) {
      Alert.alert('Import Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const pickAndUpload = async () => {
    try {
      setUploading(true);
      setResult(null);

      const res = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.xlsx, DocumentPicker.types.csv, DocumentPicker.types.pdf, DocumentPicker.types.plainText],
        copyTo: 'cachesDirectory',
      });
      if (!res) return;

      // copyTo gives a real file:// path that fetch can stream; the raw
      // content:// URI from Android's picker is not readable by fetch.
      const uri = res.fileCopyUri || res.uri;
      const name = res.name || 'questions.xlsx';

      const form = new FormData();
      form.append('file', { uri, name, type: mimeFor(name) } as any);
      form.append('subject', subject);
      form.append('education_level', level);

      // PDF imports call the LLM synchronously — well past the default 30s.
      const body = await api('/exam-prep/questions/upload', {
        method: 'POST',
        body: form,
        timeoutMs: 180000,
      });

      setResult(body);
      if (body.inserted > 0) onSaved();
      Alert.alert(
        'Imported',
        `${body.inserted} question(s) added.` +
          (body.errors?.length ? `\n${body.errors.length} row(s) rejected.` : '') +
          (body.unused_sheets?.length ? `\nIgnored sheet(s): ${body.unused_sheets.join(', ')}` : ''),
      );
    } catch (e: any) {
      // DocumentPicker throws a cancellation error — not a real failure.
      if (DocumentPicker.isCancel?.(e)) return;
      Alert.alert('Import failed', e.message || 'Could not read that file.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* ── File import ── */}
      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Import from file</Text>
        <View style={styles.infoBox}>
          <FileText size={14} color='#2563EB' />
          <Text style={styles.infoText}>
            Upload an .xlsx, .csv or .pdf. Columns are matched by header — question, option_a…option_d, answer, subject, topic, difficulty, explanation.
            The answer may be a 0-based index, a letter (A–D), or the option text itself.
          </Text>
        </View>
        <Pressable style={[styles.saveBtn, uploading && { opacity: 0.6 }]} onPress={pickAndUpload} disabled={uploading}>
          {uploading
            ? <ActivityIndicator color="#fff" />
            : <><Upload size={16} color="#fff" /><Text style={styles.saveBtnText}>Choose file to import</Text></>}
        </Pressable>

        {result && (
          <View style={[styles.infoBox, result.errors?.length ? styles.warnBox : styles.okBox]}>
            <Check size={14} color={result.errors?.length ? '#D97706' : '#059669'} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoText}>
                {result.inserted} imported
                {result.errors?.length ? `, ${result.errors.length} rejected` : ''}
                {result.sheets && result.sheets.length > 1 ? `, ${result.sheets.length} sheets found` : ''}
                {result.truncated ? ' — file was truncated at 500 rows' : ''}
              </Text>
              {result.errors?.slice(0, 5).map((err, i) => (
                <Text key={i} style={styles.rowError}>Row {err.row}: {err.reason}</Text>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* ── JSON paste ── */}
      <View style={styles.infoBox}>
        <AlertCircle size={14} color='#2563EB' />
        <Text style={styles.infoText}>
          Or paste a JSON array of questions below. Each question must have: question, options (array), answer (0-based index), difficulty.
        </Text>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Default Subject (if not in JSON)</Text>
        <TextInput style={styles.input} placeholder="e.g. Mathematics" value={subject} onChangeText={setSubject} placeholderTextColor={theme.colors.textSecondary} />
        <Text style={styles.sectionLabel}>Education Level</Text>
        <View style={styles.chipRow}>
          {EDUCATION_LEVELS.map(({ key, label }) => (
            <Pressable key={key} style={[styles.chip, level === key && styles.chipActive]} onPress={() => setLevel(key)}>
              <Text style={[styles.chipText, level === key && styles.chipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <View style={styles.templateHeader}>
          <Text style={styles.sectionLabel}>JSON Data</Text>
          <Pressable onPress={() => setJsonText(TEMPLATE)}>
            <Text style={styles.templateLink}>Use template</Text>
          </Pressable>
        </View>
        <TextInput
          style={[styles.input, styles.jsonArea]}
          placeholder={TEMPLATE}
          value={jsonText}
          onChangeText={setJsonText}
          multiline
          placeholderTextColor={theme.colors.textSecondary}
        />
        {parseError ? <Text style={styles.parseError}>{parseError}</Text> : null}
        {parsed.length > 0 ? <Text style={styles.parseSuccess}>{parsed.length} questions parsed ✓</Text> : null}
      </View>

      <View style={styles.importActions}>
        <Pressable style={styles.parseBtn} onPress={handleParse}>
          <Eye size={16} color={theme.colors.brand} />
          <Text style={styles.parseBtnText}>Parse & Validate</Text>
        </Pressable>
        <Pressable style={[styles.saveBtn, { flex: 1 }, (!parsed.length || saving) && { opacity: 0.5 }]} onPress={handleImport} disabled={!parsed.length || saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <><Upload size={16} color="#fff" /><Text style={styles.saveBtnText}>Import {parsed.length > 0 ? parsed.length : ''}</Text></>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function ExamPrepQuestionManagerScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('Manual');
  const [savedCount, setSavedCount] = useState(0);

  const handleSaved = () => setSavedCount(c => c + 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Question Manager</Text>
        {savedCount > 0 && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>+{savedCount} saved</Text>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(t => (
          <Pressable key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'Manual' && <ManualTab onSaved={handleSaved} />}
      {activeTab === 'AI Generate' && <AIGenerateTab onSaved={handleSaved} />}
      {activeTab === 'Import' && <ImportTab onSaved={handleSaved} />}
      {activeTab === 'Preview' && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <Text style={{ color: theme.colors.textSecondary }}>Navigate to Question Bank to preview</Text>
          <Pressable style={styles.saveBtn} onPress={() => router.push('/exam-prep-question-bank' as any)}>
            <Text style={styles.saveBtnText}>Open Question Bank</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.colors.text },
  savedBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  savedBadgeText: { fontSize: 11, fontWeight: '700', color: '#059669' },

  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: theme.colors.brand },
  tabText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.brand },

  tabContent: { padding: 16, gap: 14, paddingBottom: 32 },
  formSection: { gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 2 },

  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.surface },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  jsonArea: { minHeight: 200, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionBadge: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  optionBadgeCorrect: { backgroundColor: '#059669', borderColor: '#059669' },
  optionBadgeText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  optionInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: theme.colors.text, backgroundColor: theme.colors.surface },
  optionInputCorrect: { borderColor: '#059669', backgroundColor: '#F0FDF4' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },

  saveBtn: { backgroundColor: theme.colors.brand, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // AI Generate
  modeToggle: { flexDirection: 'row', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 4, gap: 4 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  modeBtnActive: { backgroundColor: theme.colors.brand },
  modeBtnText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  generateBtn: { backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  generateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  imagePickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.colors.brand, borderRadius: 10, paddingVertical: 12, justifyContent: 'center' },
  imagePickText: { color: theme.colors.brand, fontSize: 13, fontWeight: '600' },
  imagePickBtnActive: { borderStyle: 'solid', borderColor: '#059669', backgroundColor: '#F0FDF4' },
  imageChosen: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F0FDF4' },
  imageChosenText: { flex: 1, fontSize: 12, color: '#047857' },
  imageClear: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  generatedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  generatedTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  selectAll: { fontSize: 13, color: theme.colors.brand, fontWeight: '600' },
  genCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: theme.colors.border },
  genCardSelected: { borderColor: theme.colors.brand, backgroundColor: '#EFF6FF' },
  genCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  checkboxChecked: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  genQ: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.text, lineHeight: 19 },
  genOptions: { marginTop: 8, gap: 3, paddingLeft: 32 },
  genOpt: { fontSize: 12, color: theme.colors.textSecondary },
  genOptCorrect: { color: '#059669', fontWeight: '700' },
  genExp: { fontSize: 11, color: '#D97706', marginTop: 6, paddingLeft: 32, fontStyle: 'italic' },

  // Import tab
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 10, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 18 },
  okBox: { backgroundColor: '#F0FDF4' },
  warnBox: { backgroundColor: '#FFFBEB' },
  rowError: { fontSize: 11, color: '#B45309', lineHeight: 16, marginTop: 3 },
  templateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  templateLink: { fontSize: 12, color: theme.colors.brand, fontWeight: '600' },
  parseError: { fontSize: 12, color: '#DC2626', fontWeight: '500' },
  parseSuccess: { fontSize: 12, color: '#059669', fontWeight: '600' },
  importActions: { flexDirection: 'row', gap: 10 },
  parseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: theme.colors.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  parseBtnText: { color: theme.colors.brand, fontWeight: '700', fontSize: 14 },
});
