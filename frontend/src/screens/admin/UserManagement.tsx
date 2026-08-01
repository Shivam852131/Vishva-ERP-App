import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Upload, X, Ban, CheckCircle2, Pencil, Trash2, Users } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { AuthUser } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { ChipBtn, EmptyState, Card } from '@/src/ui';
import UserFormModal from '@/src/screens/admin/UserFormModal';
import BulkImportModal from '@/src/screens/admin/BulkImportModal';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  parent: 'Parent',
  college_admin: 'Admin',
  super_admin: 'Super Admin',
};

export default function UserManagement() {
  const { user: me } = useAuth();
  const { data: users = [], loading, refresh: load } = useFetch<any[]>('/admin/users');
  const { mutate: updateStatus } = useMutate();
  const { mutate: deleteUser } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formUser, setFormUser] = useState<any>(null);
  const [importVisible, setImportVisible] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 1500);
  }, [load]);

  const filters = me?.role === 'super_admin'
    ? ['all', 'student', 'faculty', 'parent', 'college_admin']
    : ['all', 'student', 'faculty', 'parent'];

  const list = users.filter((u: any) =>
    (filter === 'all' || u.role === filter) &&
    (!q || (u.name || '').toLowerCase().includes(q.toLowerCase()) || (u.email || '').toLowerCase().includes(q.toLowerCase()))
  );

  const openDetail = (u: any) => { setSelected(u); setConfirmDel(false); setMsg(''); };

  const doStatus = async () => {
    if (!selected) return;
    setBusy(true);
    setMsg('');
    try {
      const next = selected.status === 'suspended' ? 'active' : 'suspended';
      await updateStatus(`/admin/users/${selected.id}/toggle-status`, {
        method: 'POST',
        body: JSON.stringify({ status: next }),
      });
      setSelected({ ...selected, status: next });
      setMsg(next === 'suspended' ? 'User suspended — login is now blocked' : 'User re-activated');
      load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const doDelete = async () => {
    if (!selected) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    setBusy(true);
    try {
      await deleteUser(`/admin/users/${selected.id}`, { method: 'DELETE' });
      setSelected(null);
      load();
    } catch (e: any) { setMsg(e.message); setConfirmDel(false); } finally { setBusy(false); }
  };

  const openEdit = () => {
    const u = selected;
    setSelected(null);
    setFormUser(u);
    setFormVisible(true);
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.h1}>Users</Text>
              <Text style={styles.sub}>
                {users.length} accounts · {me?.role === 'super_admin' ? 'all colleges' : me?.college || 'your college'}
              </Text>
            </View>
            <Pressable
              testID="bulk-import-btn"
              accessibilityLabel="Bulk import users"
              onPress={() => setImportVisible(true)}
              style={styles.iconBtn}
            >
              <Upload color={theme.colors.brand} size={20} />
            </Pressable>
          </View>
          <View style={styles.searchBox}>
            <Search color={theme.colors.muted} size={18} />
            <TextInput
              testID="user-search"
              value={q}
              onChangeText={setQ}
              placeholder="Search name or email..."
              placeholderTextColor={theme.colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              accessibilityLabel="Search users"
            />
            {q ? (
              <Pressable testID="clear-search" accessibilityLabel="Clear search" onPress={() => setQ('')} hitSlop={8}>
                <X color={theme.colors.muted} size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 52, marginTop: 10 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg, alignItems: 'center' }}
        >
          {filters.map(f => (
            <ChipBtn
              key={f}
              testID={`filter-${f}`}
              label={f === 'college_admin' ? 'admins' : f}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 8, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          >
            {list.length === 0 && <EmptyState title="No users found" sub="Try a different filter or add a new user" />}
            {list.map((u: any) => (
              <Pressable
                key={u.id}
                testID={`user-row-${u.email}`}
                accessibilityLabel={`View ${u.name}`}
                onPress={() => openDetail(u)}
              >
                <Card style={styles.row}>
                  <View style={[styles.avatar, u.status === 'suspended' && { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.avatarTxt, u.status === 'suspended' && { color: theme.colors.error }]}>
                      {u.name?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.meta}>
                      {u.email}{u.department ? ` · ${u.department}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={styles.rolePill}>
                      <Text style={styles.roleTxt}>{ROLE_LABEL[u.role] || u.role}</Text>
                    </View>
                    {u.status === 'suspended' && (
                      <View style={styles.suspPill}>
                        <Text style={styles.suspTxt}>Suspended</Text>
                      </View>
                    )}
                  </View>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Pressable
          testID="add-user-fab"
          accessibilityLabel="Add user"
          onPress={() => { setFormUser(null); setFormVisible(true); }}
          style={styles.fab}
        >
          <Plus color="#fff" size={26} />
        </Pressable>

        {/* Detail / Actions Modal */}
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
          <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
            <Pressable style={styles.sheet} onPress={() => {}}>
              {selected && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.detailHeader}>
                    <View style={[styles.avatarLg, selected.status === 'suspended' && { backgroundColor: '#FEE2E2' }]}>
                      <Text style={[styles.avatarLgTxt, selected.status === 'suspended' && { color: theme.colors.error }]}>
                        {selected.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{selected.name}</Text>
                      <Text style={styles.meta}>{selected.email}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <View style={styles.rolePill}>
                          <Text style={styles.roleTxt}>{ROLE_LABEL[selected.role]}</Text>
                        </View>
                        <View style={[styles.rolePill, selected.status === 'suspended' ? { backgroundColor: '#FEE2E2' } : { backgroundColor: '#DCFCE7' }]}>
                          <Text style={[styles.roleTxt, { color: selected.status === 'suspended' ? theme.colors.error : theme.colors.success }]}>
                            {selected.status === 'suspended' ? 'Suspended' : 'Active'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Pressable testID="detail-close" accessibilityLabel="Close" onPress={() => setSelected(null)} hitSlop={10}>
                      <X color={theme.colors.muted} size={22} />
                    </Pressable>
                  </View>

                  <View style={styles.metaBox}>
                    {[
                      ['College', selected.college],
                      ['Department', selected.department],
                      ['Phone', selected.phone],
                      ['Student ID', selected.student_id],
                      ['Year', selected.year],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <View key={String(k)} style={styles.metaRow}>
                        <Text style={styles.metaKey}>{k}</Text>
                        <Text style={styles.metaVal}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>

                  {msg ? <Text style={[styles.msg, { color: msg.includes('suspend') || msg.includes('delete') ? theme.colors.error : theme.colors.success }]}>{msg}</Text> : null}

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: theme.spacing.md }}>
                    <Pressable
                      testID="action-edit"
                      accessibilityLabel="Edit user"
                      onPress={openEdit}
                      style={[styles.actBtn, { borderColor: theme.colors.brandPrimary }]}
                    >
                      <Pencil color={theme.colors.brandPrimary} size={16} />
                      <Text style={[styles.actTxt, { color: theme.colors.brandPrimary }]}>Edit</Text>
                    </Pressable>
                    <Pressable
                      testID="action-status"
                      accessibilityLabel={selected.status === 'suspended' ? 'Activate user' : 'Suspend user'}
                      onPress={doStatus}
                      disabled={busy}
                      style={[styles.actBtn, { borderColor: selected.status === 'suspended' ? theme.colors.success : theme.colors.warning }]}
                    >
                      {selected.status === 'suspended'
                        ? <CheckCircle2 color={theme.colors.success} size={16} />
                        : <Ban color={theme.colors.warning} size={16} />}
                      <Text style={[styles.actTxt, { color: selected.status === 'suspended' ? theme.colors.success : theme.colors.warning }]}>
                        {selected.status === 'suspended' ? 'Activate' : 'Suspend'}
                      </Text>
                    </Pressable>
                  </View>

                  <Pressable
                    testID="action-delete"
                    accessibilityLabel="Delete user"
                    onPress={doDelete}
                    disabled={busy}
                    style={[styles.delBtn, confirmDel && { backgroundColor: theme.colors.error }]}
                  >
                    <Trash2 color={confirmDel ? '#fff' : theme.colors.error} size={16} />
                    <Text style={[styles.delTxt, confirmDel && { color: '#fff' }]}>
                      {confirmDel ? 'Tap again to confirm delete' : 'Delete user'}
                    </Text>
                  </Pressable>
                  <View style={{ height: 30 }} />
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </Modal>

        <UserFormModal
          visible={formVisible}
          onClose={() => setFormVisible(false)}
          onSaved={load}
          editUser={formUser}
          meRole={me?.role}
        />
        <BulkImportModal
          visible={importVisible}
          onClose={() => setImportVisible(false)}
          onDone={load}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, marginTop: theme.spacing.md, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: theme.spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: theme.colors.brand, fontWeight: '800' },
  name: { color: theme.colors.onSurface, fontWeight: '700' },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  rolePill: { backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  roleTxt: { color: theme.colors.brand, fontSize: 10, fontWeight: '700' },
  suspPill: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  suspTxt: { color: theme.colors.error, fontSize: 10, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '85%' },
  detailHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarLg: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  avatarLgTxt: { color: theme.colors.brand, fontWeight: '800', fontSize: 20 },
  detailName: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  metaBox: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginTop: theme.spacing.lg },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  metaKey: { color: theme.colors.muted, fontSize: 13, flexShrink: 0 },
  metaVal: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  msg: { marginTop: theme.spacing.md, backgroundColor: theme.colors.brandTertiary, padding: 10, borderRadius: theme.radius.sm, fontSize: 13, overflow: 'hidden' },
  actBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: theme.radius.md, borderWidth: 1.5 },
  actTxt: { fontWeight: '700', fontSize: 13 },
  delBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.error, marginTop: theme.spacing.lg },
  delTxt: { color: theme.colors.error, fontWeight: '700', fontSize: 13 },
});
