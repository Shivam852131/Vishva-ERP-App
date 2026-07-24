import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Modal, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { X, UserPlus, Save } from 'lucide-react-native';
import type { UserRole, College } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { theme } from '@/src/theme';
import { Button, Input } from '@/src/ui';

const ROLES_CA = ['student', 'faculty', 'parent'] as const;
const ROLES_SA = ['student', 'faculty', 'parent', 'college_admin'] as const;

function Field({ label, testID, ...props }: { label: string; testID: string; [key: string]: any }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput testID={testID} style={styles.input} placeholderTextColor={theme.colors.muted} {...props} />
    </View>
  );
}

interface UserFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  editUser: any;
  meRole?: string;
}

export default function UserFormModal({ visible, onClose, onSaved, editUser, meRole }: UserFormModalProps) {
  const isEdit = !!editUser;
  const [role, setRole] = useState<UserRole>('student');
  const [f, setF] = useState<any>({});
  const { data: colleges = [] } = useFetch<College[]>(meRole === 'super_admin' ? '/colleges' : null);
  const { mutate: saveUser, loading: saving } = useMutate();
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!visible) return;
    setErr('');
    setRole(editUser?.role || 'student');
    setF(editUser
      ? {
          name: editUser.name || '',
          phone: editUser.phone || '',
          department: editUser.department || '',
          student_id: editUser.student_id || '',
          year: editUser.year ? String(editUser.year) : '',
          college: editUser.college || '',
        }
      : {
          name: '', email: '', password: 'password123', phone: '',
          department: '', student_id: '', year: '', college: '',
          parent_name: '', parent_email: '', parent_phone: '',
        });
  }, [visible, editUser]);

  const set = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name?.trim()) { setErr('Name is required'); return; }
    if (!isEdit && !f.email?.trim()) { setErr('Email is required'); return; }
    setErr('');
    try {
      if (isEdit) {
        await saveUser(`/admin/users/${editUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: f.name.trim(),
            phone: f.phone || null,
            department: f.department || null,
            student_id: f.student_id || null,
            year: f.year ? parseInt(f.year, 10) : null,
            college: f.college || null,
          }),
        });
      } else {
        const body: any = {
          name: f.name.trim(),
          email: f.email.trim(),
          password: f.password || 'password123',
          role,
          phone: f.phone || null,
          department: f.department || null,
          college: f.college || null,
        };
        if (role === 'student') {
          body.student_id = f.student_id || null;
          body.year = f.year ? parseInt(f.year, 10) : null;
          if (f.parent_email?.trim()) {
            body.parent_email = f.parent_email.trim();
            body.parent_name = f.parent_name || null;
            body.parent_password = 'parent123';
          }
        }
        await saveUser('/admin/users', { method: 'POST', body: JSON.stringify(body) });
      }
      onSaved();
      onClose();
    } catch (e: any) { setErr(e.message); }
  };

  const roles = meRole === 'super_admin' ? ROLES_SA : ROLES_CA;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isEdit ? <Save color={theme.colors.brand} size={20} /> : <UserPlus color={theme.colors.brand} size={20} />}
              <Text style={styles.title}>{isEdit ? 'Edit User' : 'Add User'}</Text>
            </View>
            <Pressable testID="user-form-close" accessibilityLabel="Close" onPress={onClose} hitSlop={10}>
              <X color={theme.colors.muted} size={22} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!isEdit && (
              <>
                <Text style={styles.label}>Role</Text>
                <View style={styles.chipRow}>
                  {roles.map(r => (
                    <Pressable
                      key={r}
                      testID={`form-role-${r}`}
                      accessibilityLabel={`Select role ${r.replace('_', ' ')}`}
                      onPress={() => setRole(r as UserRole)}
                      style={[styles.chip, role === r && styles.chipActive]}
                    >
                      <Text style={[styles.chipTxt, role === r && styles.chipTxtActive]}>
                        {r.replace('_', ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Field label="Full Name" testID="form-name" value={f.name} onChangeText={(v: string) => set('name', v)} placeholder="Jane Doe" />
            {!isEdit && (
              <Field label="Email" testID="form-email" value={f.email} onChangeText={(v: string) => set('email', v)} placeholder="jane@campus.edu" autoCapitalize="none" keyboardType="email-address" />
            )}
            {!isEdit && (
              <Field label="Password" testID="form-password" value={f.password} onChangeText={(v: string) => set('password', v)} placeholder="password123" autoCapitalize="none" />
            )}
            <Field label="Phone" testID="form-phone" value={f.phone} onChangeText={(v: string) => set('phone', v)} placeholder="+1 555 0100" keyboardType="phone-pad" />
            {role !== 'parent' && (
              <Field label="Department" testID="form-department" value={f.department} onChangeText={(v: string) => set('department', v)} placeholder="Computer Science" />
            )}

            {meRole === 'super_admin' && colleges.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>College</Text>
                <View style={styles.chipRow}>
                  {colleges.map((c: College) => (
                    <Pressable
                      key={c.id}
                      testID={`form-college-${c.code}`}
                      accessibilityLabel={`Select college ${c.name}`}
                      onPress={() => set('college', f.college === c.name ? '' : c.name)}
                      style={[styles.chip, f.college === c.name && styles.chipActive]}
                    >
                      <Text style={[styles.chipTxt, f.college === c.name && styles.chipTxtActive]}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {role === 'student' && (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Student ID" testID="form-student-id" value={f.student_id} onChangeText={(v: string) => set('student_id', v)} placeholder="CS2026001" autoCapitalize="characters" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Year" testID="form-year" value={f.year} onChangeText={(v: string) => set('year', v)} placeholder="1" keyboardType="number-pad" />
                  </View>
                </View>
                {!isEdit && (
                  <View style={styles.parentBox}>
                    <Text style={styles.parentTitle}>Linked Parent (optional)</Text>
                    <Text style={styles.parentHint}>
                      A parent account is auto-created and linked to this student. Default password: parent123
                    </Text>
                    <Field label="Parent Name" testID="form-parent-name" value={f.parent_name} onChangeText={(v: string) => set('parent_name', v)} placeholder="Robert Doe" />
                    <Field label="Parent Email" testID="form-parent-email" value={f.parent_email} onChangeText={(v: string) => set('parent_email', v)} placeholder="parent@mail.com" autoCapitalize="none" keyboardType="email-address" />
                    <Field label="Parent Phone" testID="form-parent-phone" value={f.parent_phone} onChangeText={(v: string) => set('parent_phone', v)} placeholder="+1 555 0101" keyboardType="phone-pad" />
                  </View>
                )}
              </>
            )}

            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable testID="form-save" accessibilityLabel="Save user" onPress={save} disabled={saving} style={styles.cta}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaTxt}>{isEdit ? 'Save Changes' : 'Create User'}</Text>}
            </Pressable>
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
  label: { color: theme.colors.onSurfaceTertiary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 13, fontSize: 15, color: theme.colors.onSurface },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.brandTertiary, borderColor: theme.colors.brandPrimary },
  chipTxt: { fontSize: 12, color: theme.colors.muted, textTransform: 'capitalize', fontWeight: '600' },
  chipTxtActive: { color: theme.colors.brand },
  parentBox: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginTop: theme.spacing.lg },
  parentTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  parentHint: { fontSize: 11, color: theme.colors.muted, marginTop: 4, lineHeight: 16 },
  err: { color: theme.colors.error, marginTop: 12, fontSize: 13 },
  cta: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, marginTop: theme.spacing.lg, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
