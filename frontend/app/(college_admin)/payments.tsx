import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from '@/src/navigation/router';
import { Ionicons } from '@/src/components/Ionicons';
import { useAuth } from '../../src/providers/AuthContext';
import { useFetch, useMutate } from '../../src/hooks/useFetch';
import { RAZORPAY_KEY_ID } from '../../src/razorpay';
import { subscribeRealtime } from '@/src/realtime/socket';

type Receipt = {
  id: string; type: string; amount: number; currency: string;
  payment_id: string; order_id: string; status: string; created_at: string;
  plan_id?: string; student_id?: string; fee_id?: string;
};

type Fee = {
  id: string; student_id: string; type: string; amount: number;
  currency: string; due_date: string; semester: string; status: string;
};

export default function PaymentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'college_admin' || user?.role === 'super_admin';
  const [tab, setTab] = useState<'receipts' | 'fees'>('receipts');
  const { data: receipts, refresh: refreshReceipts } = useFetch<Receipt[]>('/fees/receipts');
  const { data: fees, refresh: refreshF } = useFetch<Fee[]>(isAdmin ? '/fees/all' : null);
  const { mutate } = useMutate();
  const [showCreateFee, setShowCreateFee] = useState(false);
  const [newFee, setNewFee] = useState({ student_id: '', type: 'Tuition Fee', amount: '', due_date: '', semester: '' });

  React.useEffect(() => subscribeRealtime('payments:update', () => refreshReceipts()), [refreshReceipts]);
  React.useEffect(() => subscribeRealtime('fees:update', () => refreshF()), [refreshF]);

  const handleRemind = async (feeId: string) => {
    try {
      await mutate(`/fees/${feeId}/remind`, {
        method: 'POST',
      });
      Alert.alert('Sent', 'Payment reminder sent to student!');
    } catch (e: any) { Alert.alert('Error', e.message); }
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

  const totalPaid = (receipts || []).filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const totalPending = (fees || []).filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payments & Receipts</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderColor: '#10b981' }]}>
          <Ionicons name="checkmark-circle" size={22} color="#10b981" />
          <Text style={styles.summaryAmount}>₹{(totalPaid / 100).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Collected</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#f59e0b' }]}>
          <Ionicons name="time" size={22} color="#f59e0b" />
          <Text style={[styles.summaryAmount, { color: '#f59e0b' }]}>₹{(totalPending / 100).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.gatewayBanner}>
        <Ionicons name="shield-checkmark" size={16} color="#10b981" />
        <Text style={styles.gatewayText}>Payments via Razorpay (College Account)</Text>
        <TouchableOpacity onPress={() => router.push('/(college_admin)/payment-settings' as any)} style={styles.settingsLink}>
          <Ionicons name="settings" size={14} color="#6366f1" />
          <Text style={styles.settingsLinkText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'receipts' && styles.tabBtnActive]} onPress={() => setTab('receipts')}>
          <Ionicons name="receipt" size={18} color={tab === 'receipts' ? '#6366f1' : '#64748b'} />
          <Text style={[styles.tabText, tab === 'receipts' && styles.tabTextActive]}>Receipts</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity style={[styles.tabBtn, tab === 'fees' && styles.tabBtnActive]} onPress={() => setTab('fees')}>
            <Ionicons name="cash" size={18} color={tab === 'fees' ? '#6366f1' : '#64748b'} />
            <Text style={[styles.tabText, tab === 'fees' && styles.tabTextActive]}>Fee Records</Text>
          </TouchableOpacity>
        )}
      </View>

      {tab === 'receipts' && (
        <ScrollView style={{ flex: 1, padding: 16 }}>
          {(receipts || []).map((r) => (
            <View key={r.id} style={styles.receiptCard}>
              <View style={styles.receiptRow}>
                <View style={[styles.statusDot, { backgroundColor: r.status === 'paid' ? '#10b981' : '#f59e0b' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.receiptType}>{r.type === 'subscription' ? 'Subscription' : 'Fee Payment'}</Text>
                  <Text style={styles.receiptDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.receiptAmount}>₹{(r.amount / 100).toLocaleString()}</Text>
              </View>
              <View style={styles.receiptFooter}>
                <View style={styles.receiptMetaCol}>
                  <Text style={styles.receiptId} numberOfLines={1}>Pay: {r.payment_id?.slice(0, 20)}...</Text>
                  {r.order_id ? <Text style={styles.receiptId} numberOfLines={1}>Order: {r.order_id.slice(0, 22)}...</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
                  <Text style={[styles.receiptStatus, { color: r.status === 'paid' ? '#10b981' : '#f59e0b' }]} numberOfLines={1}>{r.status}</Text>
                  {r.fee_id ? <Text style={styles.receiptFeeId} numberOfLines={1}>Fee: {String(r.fee_id).slice(0, 12)}</Text> : null}
                  {r.plan_id ? <Text style={styles.receiptFeeId} numberOfLines={1}>Plan: {String(r.plan_id).slice(0, 12)}</Text> : null}
                </View>
              </View>
            </View>
          ))}
          {(!receipts || receipts.length === 0) && <Text style={styles.emptyText}>No receipts found</Text>}
        </ScrollView>
      )}

      {tab === 'fees' && isAdmin && (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateFee(true)}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Create Fee Record</Text>
          </TouchableOpacity>
          <ScrollView style={{ flex: 1, padding: 16, paddingTop: 0 }}>
            {(fees || []).map((f) => (
              <View key={f.id} style={styles.feeCard}>
                <View style={styles.feeHeader}>
                  <View style={[styles.feeTypeBadge, { backgroundColor: f.status === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)' }]}>
                    <Text style={[styles.feeTypeText, { color: f.status === 'paid' ? '#10b981' : '#f59e0b' }]}>{f.type}</Text>
                  </View>
                  <Text style={styles.feeAmount}>₹{(f.amount / 100).toLocaleString()}</Text>
                </View>
                <View style={styles.feeMeta}>
                  <Text style={styles.feeMetaText}>Student: {f.student_id.slice(0, 8)}...</Text>
                  <Text style={styles.feeMetaText}>Due: {f.due_date || 'N/A'}</Text>
                  <Text style={styles.feeMetaText}>Sem: {f.semester || 'N/A'}</Text>
                </View>
                <View style={styles.feeFooter}>
                  <Text style={[styles.feeStatus, { color: f.status === 'paid' ? '#10b981' : '#f59e0b' }]}>{f.status}</Text>
                  {f.status === 'pending' && (
                    <TouchableOpacity style={styles.remindBtn} onPress={() => handleRemind(f.id)}>
                      <Ionicons name="notifications" size={14} color="#f59e0b" />
                      <Text style={styles.remindBtnText}>Remind</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            {(!fees || fees.length === 0) && <Text style={styles.emptyText}>No fee records</Text>}
          </ScrollView>
        </View>
      )}

      <Modal visible={showCreateFee} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Fee Record</Text>
              <TouchableOpacity onPress={() => setShowCreateFee(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.label}>Student ID *</Text>
            <TextInput style={styles.input} value={newFee.student_id} onChangeText={(t) => setNewFee({ ...newFee, student_id: t })} placeholder="Student ID" placeholderTextColor="#475569" />
            <Text style={styles.label}>Fee Type</Text>
            <View style={styles.typeRow}>
              {['Tuition Fee', 'Exam Fee', 'Library Fee', 'Hostel Fee', 'Lab Fee'].map((t) => (
                <TouchableOpacity key={t} style={[styles.typeBtn, newFee.type === t && styles.typeBtnActive]} onPress={() => setNewFee({ ...newFee, type: t })}>
                  <Text style={[styles.typeBtnText, newFee.type === t && styles.typeBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Amount (paise) *</Text>
            <TextInput style={styles.input} value={newFee.amount} onChangeText={(t) => setNewFee({ ...newFee, amount: t })} keyboardType="numeric" placeholder="50000" placeholderTextColor="#475569" />
            <Text style={styles.label}>Due Date</Text>
            <TextInput style={styles.input} value={newFee.due_date} onChangeText={(t) => setNewFee({ ...newFee, due_date: t })} placeholder="YYYY-MM-DD" placeholderTextColor="#475569" />
            <Text style={styles.label}>Semester</Text>
            <TextInput style={styles.input} value={newFee.semester} onChangeText={(t) => setNewFee({ ...newFee, semester: t })} placeholder="e.g. 2026-S1" placeholderTextColor="#475569" />
            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateFee}>
              <Text style={styles.saveBtnText}>Create Fee Record</Text>
            </TouchableOpacity>
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
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: '#1e293b', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  summaryAmount: { color: '#10b981', fontSize: 18, fontWeight: '800', marginTop: 4 },
  summaryLabel: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  gatewayBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', marginHorizontal: 16, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)' },
  gatewayText: { color: '#10b981', fontSize: 11, fontWeight: '700', flex: 1 },
  settingsLink: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(99,102,241,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  settingsLinkText: { color: '#6366f1', fontSize: 11, fontWeight: '700' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1e293b' },
  tabBtnActive: { backgroundColor: '#1e1b4b', borderWidth: 1, borderColor: '#6366f1' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#6366f1' },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981', marginHorizontal: 16, marginTop: 8, paddingVertical: 12, borderRadius: 10, gap: 8 },
  createBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  receiptCard: { backgroundColor: '#1e293b', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  receiptRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  receiptType: { color: '#fff', fontSize: 14, fontWeight: '600' },
  receiptDate: { color: '#64748b', fontSize: 11, marginTop: 2 },
  receiptAmount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  receiptFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  receiptId: { color: '#64748b', fontSize: 10 },
  receiptMetaCol: { gap: 2 },
  receiptFeeId: { color: '#64748b', fontSize: 9, marginTop: 2 },
  receiptStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  feeCard: { backgroundColor: '#1e293b', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  feeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  feeTypeText: { fontSize: 11, fontWeight: '700' },
  feeAmount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  feeMeta: { flexDirection: 'row', gap: 12, marginTop: 10 },
  feeMetaText: { color: '#94a3b8', fontSize: 11 },
  feeFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  feeStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  remindBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  remindBtnText: { color: '#f59e0b', fontSize: 11, fontWeight: '600' },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 40 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#0f172a', borderRadius: 10, padding: 12, color: '#e2e8f0', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#0f172a' },
  typeBtnActive: { backgroundColor: '#6366f1' },
  typeBtnText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  typeBtnTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: '#6366f1', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 30 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
