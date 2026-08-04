import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Building2, Trash2, GraduationCap, UserCheck, Shield } from 'lucide-react-native';
import type { College } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { AsyncView, Button, Card } from '@/src/ui';

export default function Colleges() {
  const { data, loading, error, refresh: load } = useFetch<College[]>('/colleges');
  const colleges = data || [];
  const { mutate: saveMutation, loading: saving } = useMutate();
  const { mutate: deleteMutation } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [edit, setEdit] = useState<College | null>(null);
  const [f, setF] = useState({ name: '', code: '', address: '', contact_email: '' });
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 1500);
  }, [load]);

  const open = (c: College | null) => {
    setEdit(c);
    setF(c
      ? { name: c.name, code: c.code, address: (c as any).address || '', contact_email: (c as any).contact_email || '' }
      : { name: '', code: '', address: '', contact_email: '' });
    setErr('');
    setConfirmDel(false);
    setModal(true);
  };

  const save = async () => {
    if (!f.name.trim() || !f.code.trim()) { setErr('Name and code are required'); return; }
    setErr('');
    try {
      const body: any = { name: f.name.trim(), code: f.code.trim() };
      if (f.address.trim()) body.address = f.address.trim();
      if (f.contact_email.trim()) body.contact_email = f.contact_email.trim();
      if (edit) await saveMutation(`/colleges/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await saveMutation('/colleges', { method: 'POST', body: JSON.stringify(body) });
      setModal(false);
      load();
    } catch (e: any) { setErr(e.message); }
  };

  const doDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setErr('');
    try {
      await deleteMutation(`/colleges/${edit!.id}`, { method: 'DELETE' });
      setModal(false);
      load();
    } catch (e: any) { setErr(e.message); setConfirmDel(false); }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={{ padding: theme.spacing.lg }}>
          <Text style={styles.h1}>Colleges</Text>
          <Text style={styles.sub}>{colleges.length} institution{colleges.length !== 1 ? 's' : ''} on the platform</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 10, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <AsyncView
            loading={loading && !data}
            error={error}
            onRetry={load}
            empty={!loading && colleges.length === 0}
            emptyTitle="No colleges yet"
            emptySub="Tap + to add the first college"
          >
            {colleges.map(c => (
              <Pressable
                key={c.id}
                testID={`college-${c.code}`}
                accessibilityLabel={`Edit ${c.name}`}
                accessibilityRole="button"
                onPress={() => open(c)}
              >
                <Card style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.iconWrap}>
                      <Building2 color={theme.colors.brand} size={22} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{c.name}</Text>
                      <Text style={styles.meta}>Code: {c.code}{(c as any).address ? ` · ${(c as any).address}` : ''}</Text>
                    </View>
                  </View>
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <GraduationCap color={theme.colors.muted} size={14} />
                      <Text style={styles.statTxt}>{c.students || 0} students</Text>
                    </View>
                    <View style={styles.statItem}>
                      <UserCheck color={theme.colors.muted} size={14} />
                      <Text style={styles.statTxt}>{c.faculty || 0} faculty</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Shield color={theme.colors.muted} size={14} />
                      <Text style={styles.statTxt}>{c.admins || 0} admins</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            ))}
          </AsyncView>
        </ScrollView>

        <Pressable
          testID="add-college-fab"
          accessibilityLabel="Add college"
          accessibilityRole="button"
          onPress={() => open(null)}
          style={styles.fab}
        >
          <Plus color="#fff" size={26} />
        </Pressable>

        <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{edit ? 'Edit College' : 'Add College'}</Text>
                <Pressable testID="college-close" accessibilityLabel="Close" accessibilityRole="button" onPress={() => setModal(false)} hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <Text style={styles.label}>Name</Text>
              <TextInput
                testID="college-name"
                value={f.name}
                onChangeText={v => setF(p => ({ ...p, name: v }))}
                placeholder="College name"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                accessibilityLabel="College name"
              />
              <Text style={styles.label}>Code</Text>
              <TextInput
                testID="college-code"
                value={f.code}
                onChangeText={v => setF(p => ({ ...p, code: v }))}
                placeholder="VU"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                autoCapitalize="characters"
                accessibilityLabel="College code"
              />
              <Text style={styles.label}>Address</Text>
              <TextInput
                testID="college-address"
                value={f.address}
                onChangeText={v => setF(p => ({ ...p, address: v }))}
                placeholder="City, Country"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                accessibilityLabel="College address"
              />
              <Text style={styles.label}>Contact Email</Text>
              <TextInput
                testID="college-email"
                value={f.contact_email}
                onChangeText={v => setF(p => ({ ...p, contact_email: v }))}
                placeholder="admin@college.edu"
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                accessibilityLabel="Contact email"
              />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <Button
                testID="college-save"
                accessibilityLabel="Save college"
                onPress={save}
                disabled={saving}
                loading={saving}
                label={edit ? 'Save Changes' : 'Create College'}
                style={{ marginTop: theme.spacing.lg }}
              />
              {edit && (
                <Pressable
                  testID="college-delete"
                  accessibilityLabel="Delete college"
                  accessibilityRole="button"
                  onPress={doDelete}
                  disabled={saving}
                  style={[styles.delBtn, confirmDel && { backgroundColor: theme.colors.error }]}
                >
                  <Trash2 color={confirmDel ? '#fff' : theme.colors.error} size={16} />
                  <Text style={[styles.delTxt, confirmDel && { color: '#fff' }]}>{confirmDel ? 'Tap again to confirm delete' : 'Delete college'}</Text>
                </Pressable>
              )}
              <View style={{ height: 20 }} />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  card: { marginBottom: 0 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.colors.onSurface, fontWeight: '800', fontSize: 15 },
  meta: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderColor: theme.colors.divider },
  statItem: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  statTxt: { fontSize: 12, color: theme.colors.muted, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, paddingBottom: 40, maxHeight: '85%', overflow: 'hidden' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 13, fontSize: 15, color: theme.colors.onSurface },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  delBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.error, marginTop: theme.spacing.md },
  delTxt: { color: theme.colors.error, fontWeight: '700', fontSize: 13 },
});
