import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Plus, X, CheckCircle2, Clock, AlertTriangle } from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Grievance } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, EmptyState, Badge, GradientButton } from '@/src/ui';

const CATEGORIES = ['academic', 'hostel', 'transport', 'library', 'other'];

export default function Grievances() {
  const { data: grievances, loading, refresh } = useFetch<Grievance[]>('/grievances');
  const { mutate: submitGrievance, loading: submitting } = useMutate();
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('academic');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const itemsSafe = grievances || [];

  const submit = async () => {
    if (!subject.trim() || !description.trim()) return;
    try {
      await submitGrievance('/grievances', {
        method: 'POST',
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          description: description.trim(),
          is_anonymous: anonymous,
        }),
      });
      setShowForm(false);
      setSubject('');
      setDescription('');
      setAnonymous(false);
      refresh();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'open': return theme.colors.warning;
      case 'in_progress': return theme.colors.info;
      case 'resolved': return theme.colors.success;
      case 'rejected': return theme.colors.error;
      default: return theme.colors.muted;
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'open': return <Clock size={14} color={theme.colors.warning} />;
      case 'in_progress': return <AlertTriangle size={14} color={theme.colors.info} />;
      case 'resolved': return <CheckCircle2 size={14} color={theme.colors.success} />;
      default: return <X size={14} color={theme.colors.error} />;
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Grievances</Text>
          <Pressable onPress={() => setShowForm(true)} style={styles.addBtn} testID="add-grievance" accessibilityLabel="Raise a grievance">
            <Plus color="#fff" size={18} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
          >
            {itemsSafe.length === 0 && <EmptyState title="No grievances" sub="Raise a complaint or request — it will be handled by the admin" />}
            {itemsSafe.map(g => (
              <Card key={g.id} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Badge count={g.category} color={theme.colors.brandPrimary} />
                  <View style={[styles.statusPill, { backgroundColor: statusColor(g.status) + '20' }]}>
                    {statusIcon(g.status)}
                    <Text style={[styles.statusTxt, { color: statusColor(g.status) }]}>{g.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.gSubject}>{g.subject}</Text>
                <Text style={styles.gDesc}>{g.description}</Text>
                <View style={styles.gMeta}>
                  <Text style={styles.gMetaTxt}>{g.is_anonymous ? 'Anonymous' : g.student_name}</Text>
                  <Text style={styles.gMetaTxt}>{new Date(g.created_at).toLocaleDateString()}</Text>
                </View>
                {g.response && (
                  <View style={styles.responseBox}>
                    <Text style={styles.responseLabel}>Admin Response:</Text>
                    <Text style={styles.responseTxt}>{g.response}</Text>
                  </View>
                )}
              </Card>
            ))}
          </ScrollView>
        )}

        <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Raise a Grievance</Text>
                <Pressable onPress={() => setShowForm(false)} accessibilityLabel="Close form">
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>

              <Text style={styles.label}>Category</Text>
              <View style={styles.catRow}>
                {CATEGORIES.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.catChip, category === c && styles.catActive]}
                    testID={`cat-${c}`}
                    accessibilityLabel={`Category ${c}`}
                  >
                    <Text style={[styles.catTxt, category === c && styles.catTxtActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Subject</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Brief subject line"
                style={styles.input}
                placeholderTextColor={theme.colors.muted}
                testID="grievance-subject"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your issue in detail..."
                style={[styles.input, styles.inputMultiline]}
                multiline
                placeholderTextColor={theme.colors.muted}
                testID="grievance-desc"
              />

              <Pressable
                onPress={() => setAnonymous(!anonymous)}
                style={styles.anonRow}
                testID="grievance-anon"
                accessibilityLabel="Toggle anonymous submission"
              >
                <View style={[styles.checkbox, anonymous && styles.checkboxActive]}>
                  {anonymous && <CheckCircle2 size={14} color="#fff" />}
                </View>
                <Text style={styles.anonTxt}>Submit anonymously</Text>
              </Pressable>

              <GradientButton
                label="Submit Grievance"
                onPress={submit}
                loading={submitting}
                style={{ marginTop: theme.spacing.md }}
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  statusTxt: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  gSubject: { fontSize: 15, fontWeight: '700', color: theme.colors.onSurface, marginTop: 8 },
  gDesc: { fontSize: 13, color: theme.colors.onSurfaceTertiary, marginTop: 6, lineHeight: 19 },
  gMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: theme.colors.divider },
  gMetaTxt: { fontSize: 11, color: theme.colors.muted },
  responseBox: { backgroundColor: theme.colors.brandTertiary, padding: theme.spacing.md, borderRadius: theme.radius.md, marginTop: 10 },
  responseLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.brand },
  responseTxt: { fontSize: 12, color: theme.colors.onBrandTertiary, marginTop: 4, lineHeight: 18 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: theme.spacing.xl, paddingBottom: 40, maxHeight: '90%' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: theme.spacing.md, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 14, fontSize: 15, color: theme.colors.onSurface },
  inputMultiline: { height: 100, textAlignVertical: 'top' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  catActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  catTxt: { fontSize: 12, color: theme.colors.muted, fontWeight: '600', textTransform: 'capitalize' },
  catTxtActive: { color: '#fff' },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  anonTxt: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600' },
});
