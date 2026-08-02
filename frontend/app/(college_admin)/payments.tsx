import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from '@/src/navigation/router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wallet, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, AlertTriangle,
  Send, Plus, X, Search, Filter, Download, Bell, Settings, TrendingUp,
  CreditCard, Users, Calendar, ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../../src/providers/AuthContext';
import { useFetch, useMutate } from '../../src/hooks/useFetch';
import { subscribeRealtime } from '@/src/realtime/socket';
import { theme } from '@/src/theme';
import { StatCard, Card, SectionTitle, ProgressBar, EmptyState } from '@/src/ui';

type Receipt = {
  id: string; type: string; amount: number; currency: string;
  payment_id: string; order_id: string; status: string; created_at: string;
  plan_id?: string; student_id?: string; fee_id?: string;
};

type Fee = {
  id: string; student_id: string; type: string; amount: number;
  currency: string; due_date: string; semester: string; status: string;
};

const FEE_TYPES = ['Tuition Fee', 'Exam Fee', 'Library Fee', 'Hostel Fee', 'Lab Fee', 'Placement Fee'];

export default function PaymentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'college_admin' || user?.role === 'super_admin';
  const [tab, setTab] = useState<'overview' | 'receipts' | 'fees' | 'settings'>('overview');
  const { data: receipts, refresh: refreshReceipts } = useFetch<Receipt[]>('/fees/receipts');
  const { data: fees, refresh: refreshF } = useFetch<Fee[]>(isAdmin ? '/fees/all' : null);
  const { data: dash } = useFetch<any>('/dashboard/admin');
  const { data: users = [] } = useFetch<any[]>('/admin/users');
  const { mutate } = useMutate();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateFee, setShowCreateFee] = useState(false);
  const [newFee, setNewFee] = useState({ student_id: '', type: 'Tuition Fee', amount: '', due_date: '', semester: '' });
  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sendingReminders, setSendingReminders] = useState<Set<string>>(new Set());

  React.useEffect(() => subscribeRealtime('payments:update', () => refreshReceipts()), [refreshReceipts]);
  React.useEffect(() => subscribeRealtime('fees:update', () => refreshF()), [refreshF]);

  const stats = useMemo(() => {
    const allFees = fees || [];
    const allReceipts = receipts || [];
    const totalPaid = allReceipts.filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
    const totalPending = allFees.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);
    const totalCollected = allFees.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
    const totalRevenue = totalPaid + totalCollected;
    const pendingCount = allFees.filter(f => f.status === 'pending').length;
    const paidCount = allFees.filter(f => f.status === 'paid').length;
    const overdueCount = allFees.filter(f => f.status === 'pending' && f.due_date && new Date(f.due_date) < new Date()).length;
    const collectionRate = totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0;
    return { totalPaid, totalPending, totalCollected, totalRevenue, pendingCount, paidCount, overdueCount, collectionRate };
  }, [fees, receipts]);

  const filteredFees = useMemo(() => {
    let list = fees || [];
    if (statusFilter !== 'all') list = list.filter((f: any) => f.status === statusFilter);
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter((f: any) =>
        f.student_id?.toLowerCase().includes(q) ||
        f.type?.toLowerCase().includes(q) ||
        f.semester?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [fees, statusFilter, searchQ]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshReceipts();
    refreshF();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const handleRemind = async (feeId: string) => {
    setSendingReminders(prev => new Set(prev).add(feeId));
    try {
      await mutate(`/fees/${feeId}/remind`, { method: 'POST' });
      Alert.alert('Sent', 'Payment reminder sent to student!');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally {
      setSendingReminders(prev => { const next = new Set(prev); next.delete(feeId); return next; });
    }
  };

  const handleBulkRemind = async () => {
    const pendingFees = (fees || []).filter((f: any) => f.status === 'pending');
    if (pendingFees.length === 0) { Alert.alert('No pending fees', 'All fees are paid'); return; }
    Alert.alert('Bulk Remind', `Send reminders to ${pendingFees.length} students?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send All',
        onPress: async () => {
          try {
            for (const f of pendingFees) {
              await mutate(`/fees/${f.id}/remind`, { method: 'POST' });
            }
            Alert.alert('Done', `Reminders sent to ${pendingFees.length} students`);
          } catch (e: any) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const handleCreateFee = async () => {
    if (!newFee.student_id || !newFee.amount) return Alert.alert('Error', 'Fill all required fields');
    try {
      await mutate('/fees/create', {
        method: 'POST',
        body: JSON.stringify({ ...newFee, amount: Number(newFee.amount) }),
      });
      Alert.alert('Created', 'Fee record created');
      setShowCreateFee(false);
      setNewFee({ student_id: '', type: 'Tuition Fee', amount: '', due_date: '', semester: '' });
      refreshF();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const exportFees = () => {
    const header = 'Student ID,Type,Amount,Status,Due Date,Semester\n';
    const rows = filteredFees.map((f: any) =>
      `${f.student_id || ''},${f.type || ''},${f.amount || 0},${f.status || ''},${f.due_date || ''},${f.semester || ''}`
    ).join('\n');
    Alert.alert('Export', `Would export ${filteredFees.length} fee records as CSV`);
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <Wallet size={14} /> },
    { key: 'receipts', label: 'Receipts', icon: <CheckCircle size={14} /> },
    { key: 'fees', label: 'Fee Records', icon: <CreditCard size={14} /> },
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>Payments & Fees</Text>
            <Text style={styles.sub}>Manage fees, receipts and payments</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={exportFees} style={styles.iconBtn}>
              <Download size={16} color={theme.colors.brand} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(college_admin)/payment-settings' as any)} style={styles.iconBtn}>
              <Settings size={16} color={theme.colors.brand} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Gateway Banner */}
        <View style={styles.gatewayBanner}>
          <CheckCircle size={14} color="#10B981" />
          <Text style={styles.gatewayText}>Payments via Razorpay (College Account)</Text>
          <TouchableOpacity onPress={() => router.push('/(college_admin)/payment-settings' as any)}>
            <Text style={styles.gatewayLink}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
              onPress={() => setTab(t.key as any)}
            >
              {t.icon}
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview Tab */}
        {tab === 'overview' && (
          <View style={{ padding: theme.spacing.lg }}>
            <View style={styles.statsRow}>
              <StatCard label="Total Collected" value={`₹${(stats.totalPaid / 100).toLocaleString()}`} color="#10B981" icon={<ArrowUpRight size={18} color="#10B981" />} />
              <StatCard label="Pending" value={`₹${(stats.totalPending / 100).toLocaleString()}`} color="#F59E0B" icon={<Clock size={18} color="#F59E0B" />} />
            </View>
            <View style={styles.statsRow}>
              <StatCard label="Collection Rate" value={`${stats.collectionRate}%`} color="#3B82F6" icon={<TrendingUp size={18} color="#3B82F6" />} />
              <StatCard label="Overdue" value={stats.overdueCount} color="#EF4444" icon={<AlertTriangle size={18} color="#EF4444" />} />
            </View>

            <SectionTitle title="Collection Progress" />
            <Card>
              <ProgressBar value={stats.collectionRate} max={100} label="Overall Collection" showPct height={10} />
              <View style={styles.breakdown}>
                <View style={styles.breakItem}>
                  <View style={[styles.breakDot, { backgroundColor: '#10B981' }]} />
                  <Text style={styles.breakLabel}>Collected</Text>
                  <Text style={styles.breakVal}>₹{(stats.totalPaid / 100).toLocaleString()}</Text>
                </View>
                <View style={styles.breakItem}>
                  <View style={[styles.breakDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={styles.breakLabel}>Pending</Text>
                  <Text style={styles.breakVal}>₹{(stats.totalPending / 100).toLocaleString()}</Text>
                </View>
              </View>
            </Card>

            <SectionTitle title="Quick Actions" />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionCard} onPress={() => setShowCreateFee(true)}>
                <View style={[styles.actionIcon, { backgroundColor: '#10B98115' }]}>
                  <Plus size={20} color="#10B981" />
                </View>
                <Text style={styles.actionTitle}>Create Fee</Text>
                <Text style={styles.actionSub}>Add new record</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={handleBulkRemind}>
                <View style={[styles.actionIcon, { backgroundColor: '#F59E0B15' }]}>
                  <Bell size={20} color="#F59E0B" />
                </View>
                <Text style={styles.actionTitle}>Bulk Remind</Text>
                <Text style={styles.actionSub}>{stats.pendingCount} pending</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionCard} onPress={exportFees}>
                <View style={[styles.actionIcon, { backgroundColor: '#3B82F615' }]}>
                  <Download size={20} color="#3B82F6" />
                </View>
                <Text style={styles.actionTitle}>Export</Text>
                <Text style={styles.actionSub}>CSV report</Text>
              </TouchableOpacity>
            </View>

            <SectionTitle title="Recent Transactions" />
            {(receipts || []).slice(0, 5).map((r) => (
              <Card key={r.id} style={{ marginBottom: 8 }}>
                <View style={styles.receiptRow}>
                  <View style={[styles.statusDot, { backgroundColor: r.status === 'paid' ? '#10B981' : '#F59E0B' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptType}>{r.type === 'subscription' ? 'Subscription' : 'Fee Payment'}</Text>
                    <Text style={styles.receiptDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.receiptAmount}>₹{(r.amount / 100).toLocaleString()}</Text>
                </View>
              </Card>
            ))}
            {(!receipts || receipts.length === 0) && <EmptyState title="No transactions" sub="Payment history will appear here" />}
          </View>
        )}

        {/* Receipts Tab */}
        {tab === 'receipts' && (
          <View style={{ padding: theme.spacing.lg }}>
            {(receipts || []).map((r) => (
              <Card key={r.id} style={{ marginBottom: 8 }}>
                <View style={styles.receiptRow}>
                  <View style={[styles.statusDot, { backgroundColor: r.status === 'paid' ? '#10B981' : '#F59E0B' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receiptType}>{r.type === 'subscription' ? 'Subscription' : 'Fee Payment'}</Text>
                    <Text style={styles.receiptDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.receiptAmount}>₹{(r.amount / 100).toLocaleString()}</Text>
                </View>
                <View style={styles.receiptFooter}>
                  <View style={{ flex: 1 }}>
                    {r.payment_id ? <Text style={styles.receiptId} numberOfLines={1}>Pay: {r.payment_id.slice(0, 20)}...</Text> : null}
                    {r.order_id ? <Text style={styles.receiptId} numberOfLines={1}>Order: {r.order_id.slice(0, 22)}...</Text> : null}
                  </View>
                  <Text style={[styles.receiptStatus, { color: r.status === 'paid' ? '#10B981' : '#F59E0B' }]}>{r.status}</Text>
                </View>
              </Card>
            ))}
            {(!receipts || receipts.length === 0) && <EmptyState title="No receipts" sub="Payment receipts will appear here" />}
          </View>
        )}

        {/* Fee Records Tab */}
        {tab === 'fees' && isAdmin && (
          <View style={{ padding: theme.spacing.lg }}>
            <View style={styles.feeActionBar}>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateFee(true)}>
                <Plus size={16} color="#fff" />
                <Text style={styles.createBtnText}>Create Fee</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bulkRemindBtn} onPress={handleBulkRemind}>
                <Send size={14} color="#F59E0B" />
                <Text style={styles.bulkRemindTxt}>Remind All ({stats.pendingCount})</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Search size={16} color={theme.colors.muted} />
              <TextInput
                value={searchQ}
                onChangeText={setSearchQ}
                placeholder="Search by student, type, semester..."
                placeholderTextColor={theme.colors.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.filterRow}>
              {['all', 'pending', 'paid'].map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setStatusFilter(s)}
                  style={[styles.filterBtn, statusFilter === s && styles.filterBtnActive]}
                >
                  <Text style={[styles.filterBtnTxt, statusFilter === s && styles.filterBtnTxtActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredFees.map((f: any) => (
              <Card key={f.id} style={{ marginBottom: 8 }}>
                <View style={styles.feeHeader}>
                  <View style={[styles.feeTypeBadge, { backgroundColor: f.status === 'paid' ? '#DCFCE7' : '#FEF3C7' }]}>
                    <Text style={[styles.feeTypeText, { color: f.status === 'paid' ? '#10B981' : '#F59E0B' }]}>{f.type}</Text>
                  </View>
                  <Text style={styles.feeAmount}>₹{(f.amount / 100).toLocaleString()}</Text>
                </View>
                <View style={styles.feeMeta}>
                  <Text style={styles.feeMetaText}>Student: {f.student_id.slice(0, 12)}...</Text>
                  <Text style={styles.feeMetaText}>Due: {f.due_date || 'N/A'}</Text>
                  <Text style={styles.feeMetaText}>Sem: {f.semester || 'N/A'}</Text>
                </View>
                <View style={styles.feeFooter}>
                  <Text style={[styles.feeStatus, { color: f.status === 'paid' ? '#10B981' : '#F59E0B' }]}>{f.status}</Text>
                  {f.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.remindBtn}
                      onPress={() => handleRemind(f.id)}
                      disabled={sendingReminders.has(f.id)}
                    >
                      {sendingReminders.has(f.id)
                        ? <ActivityIndicator size={12} color="#F59E0B" />
                        : <Send size={12} color="#F59E0B" />}
                      <Text style={styles.remindBtnText}>Remind</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            ))}
            {filteredFees.length === 0 && <EmptyState title="No fee records" sub="Create fee records for students" />}
          </View>
        )}
      </ScrollView>

      {/* Create Fee Modal */}
      <Modal visible={showCreateFee} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Fee Record</Text>
              <TouchableOpacity onPress={() => setShowCreateFee(false)}>
                <X size={22} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Student ID *</Text>
              <TextInput style={styles.input} value={newFee.student_id} onChangeText={(t) => setNewFee({ ...newFee, student_id: t })} placeholder="Student ID" placeholderTextColor={theme.colors.muted} />
              <Text style={styles.label}>Fee Type</Text>
              <View style={styles.typeRow}>
                {FEE_TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, newFee.type === t && styles.typeBtnActive]} onPress={() => setNewFee({ ...newFee, type: t })}>
                    <Text style={[styles.typeBtnText, newFee.type === t && styles.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Amount (paise) *</Text>
              <TextInput style={styles.input} value={newFee.amount} onChangeText={(t) => setNewFee({ ...newFee, amount: t })} keyboardType="numeric" placeholder="50000" placeholderTextColor={theme.colors.muted} />
              <Text style={styles.label}>Due Date</Text>
              <TextInput style={styles.input} value={newFee.due_date} onChangeText={(t) => setNewFee({ ...newFee, due_date: t })} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.muted} />
              <Text style={styles.label}>Semester</Text>
              <TextInput style={styles.input} value={newFee.semester} onChangeText={(t) => setNewFee({ ...newFee, semester: t })} placeholder="e.g. 2026-S1" placeholderTextColor={theme.colors.muted} />
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreateFee}>
                <Text style={styles.saveBtnText}>Create Fee Record</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 24, fontWeight: '800', color: theme.colors.onSurface },
  sub: { color: theme.colors.muted, marginTop: 3, fontSize: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.lg, paddingBottom: 0 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  gatewayBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  gatewayText: { color: '#065F46', fontSize: 11, fontWeight: '700', flex: 1 },
  gatewayLink: { color: '#3B82F6', fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', paddingHorizontal: theme.spacing.lg, gap: 8, marginTop: theme.spacing.md },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  tabBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  tabText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  breakdown: { flexDirection: 'row', justifyContent: 'space-around', marginTop: theme.spacing.md },
  breakItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakDot: { width: 8, height: 8, borderRadius: 4 },
  breakLabel: { fontSize: 12, color: theme.colors.muted },
  breakVal: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, padding: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  actionSub: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  receiptRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  receiptType: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '600' },
  receiptDate: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  receiptAmount: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700' },
  receiptFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  receiptId: { color: theme.colors.muted, fontSize: 10 },
  receiptStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  feeActionBar: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  createBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 10 },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bulkRemindBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A' },
  bulkRemindTxt: { color: '#92400E', fontSize: 12, fontWeight: '700' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, height: 44, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.onSurface },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  filterBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  filterBtnTxt: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  filterBtnTxtActive: { color: '#fff' },
  feeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  feeTypeText: { fontSize: 11, fontWeight: '700' },
  feeAmount: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700' },
  feeMeta: { flexDirection: 'row', gap: 12, marginTop: 10 },
  feeMetaText: { color: theme.colors.muted, fontSize: 11 },
  feeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  feeStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  remindBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  remindBtnText: { color: '#92400E', fontSize: 11, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', padding: theme.spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: theme.colors.onSurface, fontSize: 18, fontWeight: '700' },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, color: theme.colors.onSurface, fontSize: 14, borderWidth: 1, borderColor: theme.colors.border },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  typeBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  typeBtnText: { color: theme.colors.muted, fontSize: 11, fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
