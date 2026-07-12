import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from '@/src/navigation/router';
import { Ionicons } from '@/src/components/Ionicons';
import { useFetch, useMutate } from '../../src/hooks/useFetch';
import { useAuth } from '../../src/providers/AuthContext';
import { getRazorpayOrderId, openRazorpayCheckout, type RazorpayOrderResponse } from '../../src/razorpay';
import { subscribeRealtime } from '@/src/realtime/socket';

type Fee = {
  id: string; type: string; amount: number; currency: string;
  due_date: string; semester: string; status: string; created_at: string;
};

type Receipt = {
  id: string; type: string; amount: number; status: string; created_at: string;
  payment_id?: string; order_id?: string; currency?: string;
};

const fmt = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

export default function StudentFeesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: fees, refresh } = useFetch<Fee[]>('/fees/my');
  const { data: receipts, loading, refresh: refreshReceipts } = useFetch<Receipt[]>('/payments/receipts');
  const { mutate: doPay, loading: processing } = useMutate<any>();
  const [payingId, setPayingId] = useState<string | null>(null);

  React.useEffect(() => subscribeRealtime('fees:update', () => refresh()), [refresh]);
  React.useEffect(() => subscribeRealtime('payments:update', () => refreshReceipts()), [refreshReceipts]);

  const totalPaid = (receipts || []).filter(r => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const totalPending = (fees || []).filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);

  const handlePay = async (fee: Fee) => {
    try {
      setPayingId(fee.id);
      const order = await doPay('/fees/pay', {
        method: 'POST',
        body: JSON.stringify({ fee_id: fee.id }),
      }) as RazorpayOrderResponse;

      const payment = await openRazorpayCheckout({
        order,
        name: 'Vishva ERP Fee Payment',
        description: `${fee.type}${fee.semester ? ` - ${fee.semester}` : ''}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      });

      if (payment.openedExternal) {
        Alert.alert('Payment opened', 'Complete payment in the Razorpay page. Your receipt will update automatically.');
        setPayingId(null);
        refresh();
        return;
      }

      await doPay('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'fee', fee_id: fee.id, order_id: getRazorpayOrderId(order), ...payment }),
      });

      Alert.alert('Payment successful', 'Your receipt has been updated.');
      setPayingId(null);
      refresh();
    } catch (error: any) {
      setPayingId(null);
      Alert.alert('Payment failed', error?.message || 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Fees</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summaryCard}>
        <Ionicons name="wallet" size={32} color="#10b981" />
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.summaryLabel}>Total Paid</Text>
          <Text style={styles.summaryAmount}>{fmt(totalPaid)}</Text>
        </View>
      </View>

      <View style={[styles.summaryCard, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }]}>
        <Ionicons name="time" size={32} color="#f59e0b" />
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.summaryLabel}>Pending Fees</Text>
          <Text style={[styles.summaryAmount, { color: '#f59e0b' }]}>{fmt(totalPending)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Current Fee Records</Text>
      {(fees || []).map((fee) => {
        const isPaying = payingId === fee.id;
        return (
          <View key={fee.id} style={styles.receiptCard}>
            <View style={styles.receiptRow}>
              <View style={[styles.dot, { backgroundColor: fee.status === 'paid' ? '#10b981' : '#f59e0b' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.receiptType}>{fee.type}</Text>
                <Text style={styles.receiptDate}>Due {fee.due_date || 'N/A'} · {fee.semester || 'No semester'}</Text>
              </View>
              <Text style={styles.receiptAmount}>{fmt(fee.amount)}</Text>
            </View>
            {fee.status === 'pending' && (
              <TouchableOpacity
                style={[styles.payBtn, (processing && isPaying) && { opacity: 0.6 }]}
                onPress={() => handlePay(fee)}
                disabled={processing}
              >
                {isPaying && processing ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="card" size={16} color="#fff" />
                    <Text style={styles.payBtnText}>Pay with Razorpay</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Payment History</Text>
      {(receipts || []).map((r) => (
        <View key={r.id} style={styles.receiptCard}>
          <View style={styles.receiptRow}>
            <View style={[styles.dot, { backgroundColor: r.status === 'paid' ? '#10b981' : '#f59e0b' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.receiptType}>{r.type === 'subscription' ? 'Subscription' : 'Fee Payment'}</Text>
              <Text style={styles.receiptDate}>{new Date(r.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.receiptAmount}>{fmt(r.amount)}</Text>
          </View>
          {r.payment_id ? (
            <View style={styles.receiptFooter}>
              <Text style={styles.receiptId}>ID: {r.payment_id.slice(0, 18)}...</Text>
              <Text style={[styles.receiptStatus, { color: r.status === 'paid' ? '#10b981' : '#f59e0b' }]}>{r.status}</Text>
            </View>
          ) : null}
        </View>
      ))}
      {(!receipts || receipts.length === 0) && !loading && (
        <Text style={styles.emptyText}>No payment history yet</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  summaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.12)', margin: 16, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)' },
  summaryLabel: { color: '#94a3b8', fontSize: 12 },
  summaryAmount: { color: '#10b981', fontSize: 24, fontWeight: '800', marginTop: 2 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700', paddingHorizontal: 16, marginTop: 8, marginBottom: 12 },
  receiptCard: { backgroundColor: '#1e293b', marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  receiptRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  receiptType: { color: '#fff', fontSize: 14, fontWeight: '600' },
  receiptDate: { color: '#64748b', fontSize: 11, marginTop: 2 },
  receiptAmount: { color: '#fff', fontSize: 16, fontWeight: '700' },
  receiptFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  receiptId: { color: '#64748b', fontSize: 10 },
  receiptStatus: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' as const },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', marginTop: 12, paddingVertical: 10, borderRadius: 10, gap: 6 },
  payBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 40 },
});
