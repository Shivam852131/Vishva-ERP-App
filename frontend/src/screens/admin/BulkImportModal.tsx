import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Modal, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { X, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';

const SAMPLE = `name,email,role,password,department,parent_name,parent_email
John Doe,john.doe@campus.edu,student,pass123,Computer Science,Mary Doe,mary.doe@mail.com
Jane Roe,jane.roe@campus.edu,student,pass123,Mathematics,,
Dr. Ada Lovelace,ada@campus.edu,faculty,pass123,Mathematics,,`;

interface BulkImportModalProps {
  visible: boolean;
  onClose: () => void;
  onDone: () => void;
}

export default function BulkImportModal({ visible, onClose, onDone }: BulkImportModalProps) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState('');
  const { mutate: runImport, loading: busy } = useMutate<any>();

  useEffect(() => {
    if (visible) { setText(''); setResult(null); setErr(''); }
  }, [visible]);

  const previewRows = text.trim()
    ? text.trim().split('\n').slice(0, 5)
    : [];
  const totalRows = text.trim() ? text.trim().split('\n').length - 1 : 0;

  const run = async () => {
    if (!text.trim()) { setErr('Paste CSV data first'); return; }
    setErr('');
    try {
      const r = await runImport('/admin/users/bulk-import', {
        method: 'POST',
        body: JSON.stringify({ csv_text: text }),
      });
      setResult(r);
      onDone();
    } catch (e: any) { setErr(e.message); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <FileSpreadsheet color={theme.colors.brand} size={20} />
              <Text style={styles.title}>Bulk Import (CSV)</Text>
            </View>
            <Pressable testID="import-close" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
              <X color={theme.colors.muted} size={22} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!result ? (
              <>
                <Text style={styles.hint}>
                  Required columns: <Text style={styles.mono}>name, email, role</Text>{'\n'}
                  Optional: <Text style={styles.mono}>password, phone, department, student_id, year, parent_name, parent_email, parent_phone</Text>{'\n'}
                  Students with a parent_email get a linked parent account automatically.
                </Text>
                <Pressable
                  testID="import-sample"
                  accessibilityLabel="Fill with sample data"
                  onPress={() => setText(SAMPLE)}
                  style={styles.sampleBtn}
                >
                  <Text style={styles.sampleTxt}>Fill with sample data</Text>
                </Pressable>
                <TextInput
                  testID="import-csv-input"
                  value={text}
                  onChangeText={setText}
                  placeholder={'name,email,role\nJohn Doe,john@campus.edu,student'}
                  placeholderTextColor={theme.colors.muted}
                  style={styles.csvInput}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="CSV data input"
                />
                {totalRows > 0 && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>Preview ({totalRows} row{totalRows !== 1 ? 's' : ''})</Text>
                    {previewRows.map((row, i) => (
                      <Text key={i} style={styles.previewRow} numberOfLines={1}>
                        {i === 0 ? `Header: ${row}` : `Row ${i}: ${row}`}
                      </Text>
                    ))}
                    {totalRows > 5 && (
                      <Text style={styles.previewMore}>...and {totalRows - 5} more rows</Text>
                    )}
                  </View>
                )}
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <Pressable
                  testID="import-run"
                  accessibilityLabel="Run import"
                  onPress={run}
                  disabled={busy || !text.trim()}
                  style={[styles.cta, !text.trim() && { opacity: 0.5 }]}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>Import {totalRows} User{totalRows !== 1 ? 's' : ''}</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.resultBox}>
                  <CheckCircle color={theme.colors.success} size={40} />
                  <Text style={styles.resultBig}>{result.created}</Text>
                  <Text style={styles.resultLbl}>users created</Text>
                  {result.parents_created > 0 && (
                    <Text style={styles.resultSub}>
                      + {result.parents_created} linked parent account{result.parents_created > 1 ? 's' : ''} auto-created
                    </Text>
                  )}
                </View>
                {result.skipped?.length > 0 && (
                  <View style={styles.skipBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <AlertTriangle color="#92400E" size={14} />
                      <Text style={styles.skipTitle}>{result.skipped.length} row(s) skipped</Text>
                    </View>
                    {result.skipped.map((s: any, i: number) => (
                      <Text key={i} style={styles.skipRow}>Line {s.line} ({s.email}): {s.reason}</Text>
                    ))}
                  </View>
                )}
                <Pressable testID="import-done" accessibilityLabel="Done" onPress={onClose} style={styles.cta}>
                  <Text style={styles.ctaTxt}>Done</Text>
                </Pressable>
              </>
            )}
            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '88%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  hint: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11, color: theme.colors.brand },
  sampleBtn: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brandTertiary },
  sampleTxt: { fontSize: 12, color: theme.colors.brand, fontWeight: '700' },
  csvInput: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 13, fontSize: 12, color: theme.colors.onSurface, height: 160, textAlignVertical: 'top', marginTop: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  previewBox: { marginTop: 12, backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.md, padding: theme.spacing.md },
  previewTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 6 },
  previewRow: { fontSize: 11, color: theme.colors.muted, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 2 },
  previewMore: { fontSize: 11, color: theme.colors.brand, fontWeight: '600', marginTop: 4 },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultBox: { alignItems: 'center', padding: theme.spacing.xl, backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.lg },
  resultBig: { fontSize: 34, fontWeight: '800', color: theme.colors.brand, marginTop: 8 },
  resultLbl: { fontSize: 13, color: theme.colors.brand, fontWeight: '600' },
  resultSub: { fontSize: 12, color: theme.colors.brand, marginTop: 6 },
  skipBox: { marginTop: theme.spacing.md, backgroundColor: '#FEF3C7', borderRadius: theme.radius.md, padding: theme.spacing.md },
  skipTitle: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  skipRow: { fontSize: 12, color: '#92400E', marginTop: 4 },
});
