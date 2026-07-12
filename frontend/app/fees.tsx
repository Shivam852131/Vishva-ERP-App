import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, CheckCircle2, X, CreditCard, AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Fee } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { GradientButton, EmptyState, Card } from '@/src/ui';
import { getRazorpayOrderId, openRazorpayCheckout, type RazorpayOrderResponse } from '@/src/razorpay';
import { subscribeRealtime } from '@/src/realtime/socket';

export default function Fees() {
  const { user } = useAuth();
  const { data: fees, loading, refresh } = useFetch<Fee[]>('/fees/me');
  const { mutate: doPay, loading: processing } = useMutate<any>();
  const [pay, setPay] = useState<Fee | null>(null);
  const [paymentError, setPaymentError] = useState('');

  React.useEffect(() => subscribeRealtime('fees:update', () => refresh()), [refresh]);

  const itemsSafe = fees || [];
  const totalPending = itemsSafe.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);
  const totalPaid = itemsSafe.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);

  const handlePay = async () => {
    if (!pay) return;
    setPaymentError('');
    try {
      const order = await doPay('/fees/pay', {
        method: 'POST',
        body: JSON.stringify({ fee_id: pay.id }),
      }) as RazorpayOrderResponse;

      const payment = await openRazorpayCheckout({
        order,
        name: 'Vishva ERP Fee Payment',
        description: `${pay.type}${pay.semester ? ` - ${pay.semester}` : ''}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      });

      if (payment.openedExternal) {
        Alert.alert('Razorpay opened', 'Complete the payment in the secure Razorpay page. Your receipt will update after backend confirmation.');
        setPay(null);
        refresh();
        return;
      }

      await doPay('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({
          purpose: 'fee',
          fee_id: pay.id,
          order_id: getRazorpayOrderId(order),
          ...payment,
        }),
      });

      setPay(null);
      refresh();
      Alert.alert('Payment successful', 'Your fee receipt has been generated successfully.');
    } catch (error: any) {
      const message = error?.message || 'Payment failed. Please try again.';
      setPaymentError(message);
      Alert.alert('Payment failed', message);
    }
  };

  const formatAmount = (amount: number, currency?: string) => {
    if (currency === 'INR' || (!currency && amount > 1000)) {
      return `\u20B9${(amount / 100).toFixed(2)}`;
    }
    return `$${(amount / 100).toFixed(2)}`;
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Fees & Payments</Text>
          <View style={{ width: 22 }} />
        </View>

        <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Pending</Text>
          <Text style={styles.summaryAmt}>{formatAmount(totalPending)}</Text>
          <Text style={styles.summarySub}>{itemsSafe.filter(f => f.status === 'pending').length} pending fee(s)</Text>
          <View style={styles.securePill}>
            <ShieldCheck color="#D1FAE5" size={14} />
            <Text style={styles.securePillText}>Live Razorpay checkout enabled</Text>
          </View>
        </LinearGradient>

        <View style={styles.summaryRow}>
          <View style={styles.summaryMiniCard}>
            <Text style={styles.miniLabel}>Paid</Text>
            <Text style={styles.miniValue}>{formatAmount(totalPaid)}</Text>
          </View>
          <View style={styles.summaryMiniCard}>
            <Text style={styles.miniLabel}>Gateway</Text>
            <Text style={styles.miniValue}>Razorpay</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 12, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={theme.colors.brandPrimary} />}
          >
            {itemsSafe.length === 0 && <EmptyState title="No fees" sub="Your fee records will appear here" />}
            {itemsSafe.map(f => (
              <Card key={f.id} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.type}>{f.type}</Text>
                    {f.semester ? <Text style={styles.sem}>{f.semester}</Text> : null}
                  </View>
                  {f.status === 'paid' ? (
                    <View style={styles.paidPill}>
                      <CheckCircle2 size={14} color={theme.colors.success} />
                      <Text style={styles.paidTxt}>Paid</Text>
                    </View>
                  ) : (
                    <View style={styles.duePill}>
                      <AlertTriangle size={14} color={theme.colors.warning} />
                      <Text style={styles.dueTxt}>Pending</Text>
                    </View>
                  )}
                </View>
                <View style={styles.amtRow}>
                  <View>
                    <Text style={styles.amtLabel}>Amount</Text>
                    <Text style={styles.amt}>{formatAmount(f.amount, f.currency)}</Text>
                  </View>
                  {f.status === 'pending' && (
                    <GradientButton
                      label="Pay Now"
                      onPress={() => setPay(f)}
                      icon={<CreditCard color="#fff" size={16} />}
                      style={{ minWidth: 120 }}
                    />
                  )}
                </View>
                <Text style={styles.due}>Due {new Date(f.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </Card>
            ))}
          </ScrollView>
        )}

        <Modal visible={!!pay} transparent animationType="slide" onRequestClose={() => setPay(null)}>
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>Confirm Payment</Text>
                <Pressable onPress={() => setPay(null)} accessibilityLabel="Close payment modal">
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>{pay?.type}</Text>
                <Text style={styles.summaryBoxAmt}>{formatAmount(pay?.amount || 0, pay?.currency)}</Text>
                {pay?.semester ? <Text style={styles.summaryBoxSem}>{pay.semester}</Text> : null}
              </View>
              <View style={styles.secureBox}>
                <ShieldCheck color={theme.colors.success} size={17} />
                <Text style={styles.secureText}>Secure live payment. Order is created and verified by backend before receipt update.</Text>
              </View>
              {paymentError ? <Text style={styles.errorText}>{paymentError}</Text> : null}
              <GradientButton
                label={`Pay ${formatAmount(pay?.amount || 0, pay?.currency)}`}
                onPress={handlePay}
                loading={processing}
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
  summaryCard: { marginHorizontal: theme.spacing.lg, padding: theme.spacing.xl, borderRadius: theme.radius.lg, ...theme.shadow.lg },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  summaryAmt: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  summarySub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  securePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 5, marginTop: 14 },
  securePillText: { color: '#D1FAE5', fontSize: 11, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md },
  summaryMiniCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm },
  miniLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  miniValue: { color: theme.colors.brand, fontSize: 17, fontWeight: '900', marginTop: 4 },
  type: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  sem: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  amtRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  amtLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  amt: { fontSize: 24, fontWeight: '800', color: theme.colors.brand, marginTop: 2 },
  due: { marginTop: 10, fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  paidPill: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  paidTxt: { color: theme.colors.success, fontSize: 11, fontWeight: '700' },
  duePill: { flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  dueTxt: { color: theme.colors.warning, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: theme.spacing.xl, paddingBottom: 40 },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  summaryBox: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  summaryBoxLabel: { color: theme.colors.muted, fontWeight: '600' },
  summaryBoxAmt: { fontSize: 44, fontWeight: '800', color: theme.colors.brand, marginTop: 4 },
  summaryBoxSem: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },
  secureBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#ECFDF5', borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  secureText: { flex: 1, color: theme.colors.brand, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  errorText: { color: theme.colors.error, fontSize: 12, fontWeight: '700', marginBottom: theme.spacing.md },
});
