import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Modal, RefreshControl, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search, Plus, Upload, X, Ban, CheckCircle2, Pencil, Trash2, Users,
  GraduationCap, UserCheck, Baby, Shield, MoreVertical, Download,
  Filter, ArrowUpDown, Mail, Phone, Building, Calendar, ChevronRight,
  AlertTriangle, CheckCircle, Clock, Eye, UserX, Send,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { AuthUser } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { ChipBtn, EmptyState, Card, StatCard, ProgressBar } from '@/src/ui';
import UserFormModal from '@/src/screens/admin/UserFormModal';
import BulkImportModal from '@/src/screens/admin/BulkImportModal';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  parent: 'Parent',
  college_admin: 'Admin',
  super_admin: 'Super Admin',
};

const ROLE_COLORS: Record<string, string> = {
  student: '#3B82F6',
  faculty: '#8B5CF6',
  parent: '#F59E0B',
  college_admin: '#10B981',
  super_admin: '#EF4444',
};

const ROLE_ICONS: Record<string, string> = {
  student: '🎓',
  faculty: '👨‍🏫',
  parent: '👪',
  college_admin: '🏛️',
  super_admin: '👑',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#10B981',
  suspended: '#EF4444',
  pending: '#F59E0B',
};

export default function UserManagement() {
  const { user: me } = useAuth();
  const { data: users = [], loading, refresh: load } = useFetch<any[]>('/admin/users');
  const { mutate: updateStatus } = useMutate();
  const { mutate: deleteUser } = useMutate();
  const { mutate: sendMsg } = useMutate();
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
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'status'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailTab, setDetailTab] = useState<'info' | 'activity' | 'quick'>('info');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 1500);
  }, [load]);

  const filters = me?.role === 'super_admin'
    ? ['all', 'student', 'faculty', 'parent', 'college_admin']
    : ['all', 'student', 'faculty', 'parent'];

  const stats = useMemo(() => {
    const total = users.length;
    const byRole = {
      student: users.filter((u: any) => u.role === 'student').length,
      faculty: users.filter((u: any) => u.role === 'faculty').length,
      parent: users.filter((u: any) => u.role === 'parent').length,
      college_admin: users.filter((u: any) => u.role === 'college_admin').length,
    };
    const active = users.filter((u: any) => u.status !== 'suspended').length;
    const suspended = users.filter((u: any) => u.status === 'suspended').length;
    const recent = users.filter((u: any) => {
      const d = new Date(u.created_at || Date.now());
      const now = new Date();
      return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return { total, byRole, active, suspended, recent };
  }, [users]);

  const list = useMemo(() => {
    let filtered = users.filter((u: any) => {
      if (filter !== 'all' && u.role !== filter) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (q) {
        const query = q.toLowerCase();
        return (u.name || '').toLowerCase().includes(query) ||
               (u.email || '').toLowerCase().includes(query) ||
               (u.phone || '').toLowerCase().includes(query) ||
               (u.department || '').toLowerCase().includes(query) ||
               (u.student_id || '').toLowerCase().includes(query);
      }
      return true;
    });
    filtered.sort((a: any, b: any) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortBy === 'role') cmp = (a.role || '').localeCompare(b.role || '');
      else if (sortBy === 'status') cmp = (a.status || '').localeCompare(b.status || '');
      return sortAsc ? cmp : -cmp;
    });
    return filtered;
  }, [users, filter, statusFilter, q, sortBy, sortAsc]);

  const openDetail = (u: any) => { setSelected(u); setConfirmDel(false); setMsg(''); setDetailTab('info'); };

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

  const toggleBulkSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkAction = async (action: 'suspend' | 'activate' | 'delete') => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const label = action === 'delete' ? 'delete' : action;
    Alert.alert(
      `Bulk ${label}`,
      `Are you sure you want to ${label} ${count} user${count > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: label.charAt(0).toUpperCase() + label.slice(1),
          style: action === 'delete' ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            try {
              for (const id of selectedIds) {
                if (action === 'delete') {
                  await deleteUser(`/admin/users/${id}`, { method: 'DELETE' });
                } else {
                  await updateStatus(`/admin/users/${id}/toggle-status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: action === 'suspend' ? 'suspended' : 'active' }),
                  });
                }
              }
              setSelectedIds(new Set());
              setBulkMode(false);
              load();
            } catch (e: any) { Alert.alert('Error', e.message); }
            finally { setBusy(false); }
          },
        },
      ],
    );
  };

  const exportUsers = () => {
    const header = 'Name,Email,Role,Department,Status,Phone\n';
    const rows = list.map((u: any) =>
      `${u.name || ''},${u.email || ''},${u.role || ''},${u.department || ''},${u.status || 'active'},${u.phone || ''}`
    ).join('\n');
    Alert.alert('Export', `Would export ${list.length} users as CSV\n\nSample:\n${header}${rows.slice(0, 500)}`);
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        {/* Header */}
        <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={styles.h1}>User Management</Text>
              <Text style={styles.sub}>
                {stats.total} accounts · {stats.active} active · {stats.suspended} suspended
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable testID="export-btn" accessibilityLabel="Export users" onPress={exportUsers} style={styles.iconBtn}>
                <Download color={theme.colors.brand} size={18} />
              </Pressable>
              <Pressable testID="bulk-import-btn" accessibilityLabel="Bulk import users" onPress={() => setImportVisible(true)} style={styles.iconBtn}>
                <Upload color={theme.colors.brand} size={18} />
              </Pressable>
            </View>
          </View>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statMini, { borderLeftColor: '#3B82F6' }]}>
              <Text style={styles.statMiniVal}>{stats.byRole.student}</Text>
              <Text style={styles.statMiniLabel}>Students</Text>
            </View>
            <View style={[styles.statMini, { borderLeftColor: '#8B5CF6' }]}>
              <Text style={styles.statMiniVal}>{stats.byRole.faculty}</Text>
              <Text style={styles.statMiniLabel}>Faculty</Text>
            </View>
            <View style={[styles.statMini, { borderLeftColor: '#F59E0B' }]}>
              <Text style={styles.statMiniVal}>{stats.byRole.parent}</Text>
              <Text style={styles.statMiniLabel}>Parents</Text>
            </View>
            <View style={[styles.statMini, { borderLeftColor: '#10B981' }]}>
              <Text style={styles.statMiniVal}>{stats.recent}</Text>
              <Text style={styles.statMiniLabel}>This Week</Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchBox}>
            <Search color={theme.colors.muted} size={18} />
            <TextInput
              testID="user-search"
              value={q}
              onChangeText={setQ}
              placeholder="Search by name, email, phone, department..."
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

          {/* Action Bar */}
          <View style={styles.actionBar}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                testID="sort-btn"
                onPress={() => { setSortBy(sortBy === 'name' ? 'role' : sortBy === 'role' ? 'status' : 'name'); }}
                style={styles.actionBtn}
              >
                <ArrowUpDown color={theme.colors.muted} size={14} />
                <Text style={styles.actionBtnTxt}>{sortBy === 'name' ? 'Name' : sortBy === 'role' ? 'Role' : 'Status'}</Text>
              </Pressable>
              <Pressable
                testID="filter-btn"
                onPress={() => setShowFilters(!showFilters)}
                style={[styles.actionBtn, showFilters && styles.actionBtnActive]}
              >
                <Filter color={showFilters ? '#fff' : theme.colors.muted} size={14} />
                <Text style={[styles.actionBtnTxt, showFilters && { color: '#fff' }]}>Filter</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                testID="bulk-toggle"
                onPress={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                style={[styles.actionBtn, bulkMode && { backgroundColor: theme.colors.brandPrimary }]}
              >
                <Text style={[styles.actionBtnTxt, bulkMode && { color: '#fff' }]}>{bulkMode ? 'Cancel' : 'Select'}</Text>
              </Pressable>
              {bulkMode && selectedIds.size > 0 && (
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Pressable onPress={() => bulkAction('suspend')} style={[styles.actionBtn, { borderColor: '#F59E0B' }]}>
                    <Ban color="#F59E0B" size={12} />
                  </Pressable>
                  <Pressable onPress={() => bulkAction('activate')} style={[styles.actionBtn, { borderColor: '#10B981' }]}>
                    <CheckCircle2 color="#10B981" size={12} />
                  </Pressable>
                  <Pressable onPress={() => bulkAction('delete')} style={[styles.actionBtn, { borderColor: '#EF4444' }]}>
                    <Trash2 color="#EF4444" size={12} />
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          {/* Advanced Filters */}
          {showFilters && (
            <View style={styles.filterPanel}>
              <Text style={styles.filterLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['all', 'active', 'suspended'].map(s => (
                  <ChipBtn key={s} label={s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)} active={statusFilter === s} onPress={() => setStatusFilter(s)} />
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Role Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 52, marginTop: 10 }}
          contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.lg, alignItems: 'center' }}
        >
          {filters.map(f => {
            const count = f === 'all' ? users.length : users.filter((u: any) => u.role === f).length;
            return (
              <ChipBtn
                key={f}
                testID={`filter-${f}`}
                label={`${f === 'college_admin' ? 'admins' : f} (${count})`}
                active={filter === f}
                onPress={() => setFilter(f)}
              />
            );
          })}
        </ScrollView>

        {/* Bulk Mode Info */}
        {bulkMode && selectedIds.size > 0 && (
          <View style={styles.bulkInfo}>
            <Text style={styles.bulkInfoTxt}>{selectedIds.size} selected</Text>
            <Pressable onPress={() => setSelectedIds(new Set())}>
              <X color={theme.colors.muted} size={16} />
            </Pressable>
          </View>
        )}

        {/* User List */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 8, paddingBottom: 120 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          >
            {list.length === 0 && <EmptyState title="No users found" sub="Try a different filter or add a new user" />}
            {list.map((u: any) => {
              const isSelected = bulkMode && selectedIds.has(u.id);
              const roleColor = ROLE_COLORS[u.role] || theme.colors.brand;
              return (
                <Pressable
                  key={u.id}
                  testID={`user-row-${u.email}`}
                  accessibilityLabel={`View ${u.name}`}
                  onPress={() => bulkMode ? toggleBulkSelect(u.id) : openDetail(u)}
                  onLongPress={() => { setBulkMode(true); setSelectedIds(new Set([u.id])); }}
                >
                  <Card style={[styles.row, isSelected && styles.rowSelected]}>
                    {bulkMode && (
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <CheckCircle2 color="#fff" size={14} />}
                      </View>
                    )}
                    <View style={[styles.avatar, { backgroundColor: roleColor + '15' }]}>
                      <Text style={[styles.avatarTxt, { color: roleColor }]}>
                        {u.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.name} numberOfLines={1}>{u.name}</Text>
                        {u.status === 'suspended' && (
                          <View style={styles.suspPill}>
                            <Text style={styles.suspTxt}>Suspended</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.meta} numberOfLines={1}>
                        {u.email}{u.department ? ` · ${u.department}` : ''}
                      </Text>
                      <View style={styles.userTags}>
                        {u.phone ? (
                          <View style={styles.tag}>
                            <Phone size={9} color={theme.colors.muted} />
                            <Text style={styles.tagTxt}>{u.phone}</Text>
                          </View>
                        ) : null}
                        {u.student_id ? (
                          <View style={styles.tag}>
                            <Text style={styles.tagTxt}>{u.student_id}</Text>
                          </View>
                        ) : null}
                        {u.year ? (
                          <View style={styles.tag}>
                            <Calendar size={9} color={theme.colors.muted} />
                            <Text style={styles.tagTxt}>Yr {u.year}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[styles.rolePill, { backgroundColor: roleColor + '15' }]}>
                        <Text style={[styles.roleTxt, { color: roleColor }]}>{ROLE_LABEL[u.role] || u.role}</Text>
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* FAB */}
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
                  {/* Header */}
                  <View style={styles.detailHeader}>
                    <View style={[styles.avatarLg, { backgroundColor: (ROLE_COLORS[selected.role] || theme.colors.brand) + '15' }]}>
                      <Text style={[styles.avatarLgTxt, { color: ROLE_COLORS[selected.role] || theme.colors.brand }]}>
                        {selected.name?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailName}>{selected.name}</Text>
                      <Text style={styles.meta}>{selected.email}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                        <View style={[styles.rolePill, { backgroundColor: (ROLE_COLORS[selected.role] || theme.colors.brand) + '15' }]}>
                          <Text style={[styles.roleTxt, { color: ROLE_COLORS[selected.role] || theme.colors.brand }]}>
                            {ROLE_ICONS[selected.role]} {ROLE_LABEL[selected.role]}
                          </Text>
                        </View>
                        <View style={[styles.rolePill, { backgroundColor: (STATUS_COLORS[selected.status] || '#10B981') + '15' }]}>
                          <Text style={[styles.roleTxt, { color: STATUS_COLORS[selected.status] || '#10B981' }]}>
                            {selected.status === 'suspended' ? '⛔ Suspended' : '✅ Active'}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Pressable testID="detail-close" accessibilityLabel="Close" onPress={() => setSelected(null)} hitSlop={10}>
                      <X color={theme.colors.muted} size={22} />
                    </Pressable>
                  </View>

                  {/* Detail Tabs */}
                  <View style={styles.detailTabs}>
                    {(['info', 'activity', 'quick'] as const).map(tab => (
                      <Pressable
                        key={tab}
                        onPress={() => setDetailTab(tab)}
                        style={[styles.detailTab, detailTab === tab && styles.detailTabActive]}
                      >
                        <Text style={[styles.detailTabTxt, detailTab === tab && styles.detailTabTxtActive]}>
                          {tab === 'info' ? 'Info' : tab === 'activity' ? 'Activity' : 'Quick Actions'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Info Tab */}
                  {detailTab === 'info' && (
                    <View style={styles.metaBox}>
                      {[
                        ['Role', `${ROLE_ICONS[selected.role]} ${ROLE_LABEL[selected.role]}`],
                        ['Status', selected.status === 'suspended' ? '⛔ Suspended' : '✅ Active'],
                        ['College', selected.college],
                        ['Department', selected.department],
                        ['Phone', selected.phone],
                        ['Student ID', selected.student_id],
                        ['Year', selected.year ? `Year ${selected.year}` : null],
                        ['Created', selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'Unknown'],
                      ].filter(([, v]) => v).map(([k, v]) => (
                        <View key={String(k)} style={styles.metaRow}>
                          <Text style={styles.metaKey}>{k}</Text>
                          <Text style={styles.metaVal}>{String(v)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Activity Tab */}
                  {detailTab === 'activity' && (
                    <View style={styles.activityBox}>
                      <View style={styles.activityItem}>
                        <View style={[styles.activityDot, { backgroundColor: '#10B981' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activityTitle}>Account created</Text>
                          <Text style={styles.activityTime}>{selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'Unknown'}</Text>
                        </View>
                      </View>
                      {selected.last_login && (
                        <View style={styles.activityItem}>
                          <View style={[styles.activityDot, { backgroundColor: '#3B82F6' }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.activityTitle}>Last login</Text>
                            <Text style={styles.activityTime}>{new Date(selected.last_login).toLocaleString()}</Text>
                          </View>
                        </View>
                      )}
                      {selected.status === 'suspended' && (
                        <View style={styles.activityItem}>
                          <View style={[styles.activityDot, { backgroundColor: '#EF4444' }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.activityTitle}>Account suspended</Text>
                            <Text style={styles.activityTime}>Login access blocked</Text>
                          </View>
                        </View>
                      )}
                      <View style={styles.activityItem}>
                        <View style={[styles.activityDot, { backgroundColor: '#8B5CF6' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activityTitle}>Role: {ROLE_LABEL[selected.role]}</Text>
                          <Text style={styles.activityTime}>Department: {selected.department || 'N/A'}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Quick Actions Tab */}
                  {detailTab === 'quick' && (
                    <View style={styles.quickActions}>
                      <Pressable style={styles.quickBtn} onPress={() => { openEdit(); }}>
                        <View style={[styles.quickIcon, { backgroundColor: '#3B82F615' }]}>
                          <Pencil color="#3B82F6" size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.quickTitle}>Edit Profile</Text>
                          <Text style={styles.quickSub}>Update name, department, phone</Text>
                        </View>
                        <ChevronRight color={theme.colors.muted} size={16} />
                      </Pressable>
                      <Pressable style={styles.quickBtn} onPress={() => Alert.alert('Send Message', `Send a message to ${selected.name} via email`)}>
                        <View style={[styles.quickIcon, { backgroundColor: '#8B5CF615' }]}>
                          <Send color="#8B5CF6" size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.quickTitle}>Send Message</Text>
                          <Text style={styles.quickSub}>Email notification</Text>
                        </View>
                        <ChevronRight color={theme.colors.muted} size={16} />
                      </Pressable>
                      <Pressable style={styles.quickBtn} onPress={doStatus} disabled={busy}>
                        <View style={[styles.quickIcon, { backgroundColor: selected.status === 'suspended' ? '#10B98115' : '#F59E0B15' }]}>
                          {selected.status === 'suspended'
                            ? <CheckCircle2 color="#10B981" size={18} />
                            : <Ban color="#F59E0B" size={18} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.quickTitle}>{selected.status === 'suspended' ? 'Activate Account' : 'Suspend Account'}</Text>
                          <Text style={styles.quickSub}>{selected.status === 'suspended' ? 'Restore login access' : 'Block login access'}</Text>
                        </View>
                        <ChevronRight color={theme.colors.muted} size={16} />
                      </Pressable>
                      <Pressable style={styles.quickBtn} onPress={doDelete} disabled={busy}>
                        <View style={[styles.quickIcon, { backgroundColor: '#EF444415' }]}>
                          <Trash2 color="#EF4444" size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.quickTitle, { color: '#EF4444' }]}>Delete Account</Text>
                          <Text style={styles.quickSub}>{confirmDel ? 'Tap again to confirm' : 'Permanently remove'}</Text>
                        </View>
                        <ChevronRight color="#EF4444" size={16} />
                      </Pressable>
                    </View>
                  )}

                  {msg ? <Text style={[styles.msg, { color: msg.includes('suspend') || msg.includes('delete') ? theme.colors.error : theme.colors.success }]}>{msg}</Text> : null}

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
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.md },
  statMini: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, borderLeftWidth: 3 },
  statMiniVal: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  statMiniLabel: { fontSize: 10, color: theme.colors.muted, fontWeight: '600', marginTop: 2 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, marginTop: theme.spacing.md, height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.onSurface },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing.md },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  actionBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  actionBtnTxt: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  filterPanel: { marginTop: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  filterLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.muted, marginBottom: 6 },
  bulkInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.sm, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.brandTertiary, borderRadius: theme.radius.sm },
  bulkInfoTxt: { color: theme.colors.brand, fontSize: 12, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: theme.spacing.md },
  rowSelected: { borderColor: theme.colors.brandPrimary, borderWidth: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', fontSize: 16 },
  name: { color: theme.colors.onSurface, fontWeight: '700', fontSize: 14 },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  userTags: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.radius.xs },
  tagTxt: { fontSize: 9, color: theme.colors.muted, fontWeight: '600' },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  roleTxt: { fontSize: 10, fontWeight: '700' },
  suspPill: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill },
  suspTxt: { color: theme.colors.error, fontSize: 10, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing.xl, maxHeight: '88%' },
  detailHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avatarLg: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarLgTxt: { fontWeight: '800', fontSize: 22 },
  detailName: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  detailTabs: { flexDirection: 'row', marginTop: theme.spacing.lg, backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3 },
  detailTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.pill },
  detailTabActive: { backgroundColor: theme.colors.brandPrimary },
  detailTabTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  detailTabTxtActive: { color: '#fff' },
  metaBox: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginTop: theme.spacing.md },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  metaKey: { color: theme.colors.muted, fontSize: 13, flexShrink: 0 },
  metaVal: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  activityBox: { marginTop: theme.spacing.md, gap: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  activityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  activityTitle: { color: theme.colors.onSurface, fontSize: 13, fontWeight: '600' },
  activityTime: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  quickActions: { marginTop: theme.spacing.md, gap: 8 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  quickSub: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  msg: { marginTop: theme.spacing.md, backgroundColor: theme.colors.brandTertiary, padding: 10, borderRadius: theme.radius.sm, fontSize: 13, overflow: 'hidden' },
  actBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: theme.radius.md, borderWidth: 1.5 },
  actTxt: { fontWeight: '700', fontSize: 13 },
  delBtn: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: theme.radius.md, borderWidth: 1.5, borderColor: theme.colors.error, marginTop: theme.spacing.lg },
  delTxt: { color: theme.colors.error, fontWeight: '700', fontSize: 13 },
});
