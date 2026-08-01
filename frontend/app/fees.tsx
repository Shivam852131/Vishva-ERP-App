import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Modal, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, CheckCircle2, X, CreditCard, AlertTriangle,
  ShieldCheck, Receipt, Wallet, Clock,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Fee } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { GradientButton, EmptyState, Card, SectionTitle, Skeleton } from '@/src/ui';
import { getRazorpayOrderId, openRazorpayCheckout, type RazorpayOrderResponse } from '@/src/razorpay';
import { subscribeRealtime } from '@/src/realtime/socket';

type Receipt = {
  _id: string;
  feeId: string;
  userId: string;
  amount: number;
  razorpayPaymentId?: string;
  date?: string;
  createdAt: string;
};

const fmt = (paise: number) => `\u20B9${(paise / 100).toLocaleString('en-IN')}`;

export default function Fees() {
  const { user } = useAuth();
  const { data: fees, loading, error, refresh } = useFetch<Fee[]>('/fees/me');
  const { data: receipts, loading: receiptsLoading, refresh: refreshReceipts } = useFetch<Receipt[]>('/fees/receipts');
  const { mutate: doPay, loading: processing } = useMutate<any>();
  const [pay, setPay] = useState<Fee | null>(null);
  const [paymentError, setPaymentError] = useState('');

  React.useEffect(() => subscribeRealtime('fees:update', () => refresh()), [refresh]);
  React.useEffect(() => subscribeRealtime('payments:update', () => refreshReceipts()), [refreshReceipts]);

  const itemsSafe = fees || [];
  const receiptsSafe = receipts || [];
  const totalPending = itemsSafe.filter(f => f.status === 'pending').reduce((s, f) => s + f.amount, 0);
  const totalPaid = itemsSafe.filter(f => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
  const pendingCount = itemsSafe.filter(f => f.status === 'pending').length;

  const handlePay = useCallback(async () => {
    if (!pay) return;
    setPaymentError('');
    try {
      const order = await doPay('/fees/pay', {
        method: 'POST',
        body: JSON.stringify({ feeId: pay.id }),
      }) as RazorpayOrderResponse;

      const payment = await openRazorpayCheckout({
        order,
        name: 'Vishva ERP Fee Payment',
        description: `${pay.type}${pay.semester ? ` - ${pay.semester}` : ''}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
      });

      if (payment.openedExternal) {
        Alert.alert(
          'Razorpay opened',
          'Complete the payment in the secure Razorpay page. Your receipt will update after backend confirmation.',
        );
        setPay(null);
        refresh();
        refreshReceipts();
        return;
      }

      await doPay('/fees/verify', {
        method: 'POST',
        body: JSON.stringify({
          feeId: pay.id,
          razorpayOrderId: getRazorpayOrderId(order),
          razorpayPaymentId: payment.razorpay_payment_id,
          razorpaySignature: payment.razorpay_signature,
        }),
      });

      setPay(null);
      refresh();
      refreshReceipts();
      Alert.alert('Payment successful', 'Your fee receipt has been generated successfully.');
    } catch (err: any) {
      const message = err?.message || 'Payment failed. Please try again.';
      setPaymentError(message);
      Alert.alert('Payment failed', message);
    }
  }, [pay, doPay, user, refresh, refreshReceipts]);

  const formatAmount = (amount: number, currency?: string) => {
    if (currency === 'INR' || (!currency && amount > 1000)) {
      return fmt(amount);
    }
    return `\u20B9${(amount / 100).toFixed(2)}`;
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Fees & Payments</Text>
          <View style={{ width: 22 }} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <Skeleton height={180} radius={theme.radius.lg} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Skeleton height={70} width="48%" radius={theme.radius.md} />
              <Skeleton height={70} width="48%" radius={theme.radius.md} />
            </View>
            <Skeleton height={90} radius={theme.radius.lg} style={{ marginTop: 16 }} />
            <Skeleton height={90} radius={theme.radius.lg} style={{ marginTop: 12 }} />
            <Skeleton height={90} radius={theme.radius.lg} style={{ marginTop: 12 }} />
          </View>
        ) : error ? (
          <View style={styles.errorWrap}>
            <AlertTriangle color={theme.colors.error} size={32} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={refresh} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => { refresh(); refreshReceipts(); }}
                tintColor={theme.colors.brandPrimary}
              />
            }
          >
            <LinearGradient
              colors={[theme.colors.brand, theme.colors.brandPrimary]}
              style={styles.summaryCard}
            >
              <Text style={styles.summaryLabel}>Total Pending</Text>
              <Text style={styles.summaryAmt}>{formatAmount(totalPending)}</Text>
              <Text style={styles.summarySub}>
                {pendingCount} pending fee{pendingCount !== 1 ? 's' : ''}
              </Text>
              <View style={styles.securePill}>
                <ShieldCheck color="#D1FAE5" size={14} />
                <Text style={styles.securePillText}>Live Razorpay checkout enabled</Text>
              </View>
            </LinearGradient>

            <View style={styles.miniRow}>
              <View style={styles.miniCard}>
                <View style={styles.miniIconWrap}>
                  <CheckCircle2 size={18} color={theme.colors.success} />
                </View>
                <Text style={styles.miniLabel}>Paid</Text>
                <Text style={styles.miniValue}>{formatAmount(totalPaid)}</Text>
              </View>
              <View style={styles.miniCard}>
                <View style={[styles.miniIconWrap, { backgroundColor: theme.colors.brandTertiary }]}>
                  <CreditCard size={18} color={theme.colors.brandPrimary} />
                </View>
                <Text style={styles.miniLabel}>Gateway</Text>
                <Text style={styles.miniValue}>Razorpay</Text>
              </View>
            </View>

            <SectionTitle title="Fee Records" />

            {itemsSafe.length === 0 ? (
              <EmptyState
                title="No fees"
                sub="Your fee records will appear here"
                icon={<Wallet size={48} color={theme.colors.muted} />}
              />
            ) : (
              itemsSafe.map(f => (
                <Card key={f.id} style={styles.feeCard}>
                  <View style={styles.feeTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feeType}>{f.type}</Text>
                      {f.semester ? <Text style={styles.feeSem}>{f.semester}</Text> : null}
                    </View>
                    {f.status === 'paid' ? (
                      <View style={styles.paidPill}>
                        <CheckCircle2 size={14} color={theme.colors.success} />
                        <Text style={styles.paidTxt}>Paid</Text>
                      </View>
                    ) : (
                      <View style={styles.duePill}>
                        <Clock size={14} color={theme.colors.warning} />
                        <Text style={styles.dueTxt}>Pending</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.feeAmtRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feeAmtLabel}>Amount</Text>
                      <Text style={styles.feeAmt} numberOfLines={1}>
                        {formatAmount(f.amount, f.currency)}
                      </Text>
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

                  <Text style={styles.feeDue}>
                    Due{' '}
                    {new Date(f.due_date || f.paid_at || '').toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </Text>
                </Card>
              ))
            )}

            <SectionTitle title="Payment History" />

            {receiptsLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.brandPrimary} />
            ) : receiptsSafe.length === 0 ? (
              <EmptyState
                title="No payments yet"
                sub="Your payment receipts will appear here"
                icon={<Receipt size={48} color={theme.colors.muted} />}
              />
            ) : (
              receiptsSafe.map(r => (
                <Card key={r._id} style={styles.receiptCard}>
                  <View style={styles.receiptRow}>
                    <View style={[styles.receiptDot, { backgroundColor: theme.colors.success }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.receiptType}>Fee Payment</Text>
                      <Text style={styles.receiptDate}>
                        {new Date(r.createdAt || r.date || '').toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.receiptAmt}>{fmt(r.amount)}</Text>
                  </View>
                  {r.razorpayPaymentId ? (
                    <View style={styles.receiptFooter}>
                      <Text style={styles.receiptId} numberOfLines={1}>
                        ID: {r.razorpayPaymentId.slice(0, 20)}...
                      </Text>
                      <Text style={styles.receiptStatus}>Paid</Text>
                    </View>
                  ) : null}
                </Card>
              ))
            )}
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

              <View style={styles.sheetSummary}>
                <Text style={styles.sheetSummaryLabel}>{pay?.type}</Text>
                <Text style={styles.sheetSummaryAmt}>
                  {formatAmount(pay?.amount || 0, pay?.currency)}
                </Text>
                {pay?.semester ? <Text style={styles.sheetSummarySem}>{pay.semester}</Text> : null}
              </View>

              <View style={styles.secureBox}>
                <ShieldCheck color={theme.colors.success} size={17} />
                <Text style={styles.secureBoxText}>
                  Secure live payment. Order is created and verified by backend before receipt update.
                </Text>
              </View>

              {paymentError ? <Text style={styles.paymentError}>{paymentError}</Text> : null}

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
  safe: { flex: 1, backgroundColor: theme.colors.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: theme.spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  scroll: { padding: theme.spacing.lg, gap: 0, paddingBottom: 100 },

  loadingWrap: { padding: theme.spacing.lg },
  errorWrap: { padding: 40, alignItems: 'center', gap: 12 },
  errorText: { color: theme.colors.error, fontSize: 14, textAlign: 'center', fontWeight: '600' },
  retryBtn: {
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandPrimary, ...theme.shadow.sm,
  },
  retryText: { color: theme.colors.onBrandPrimary, fontWeight: '700', fontSize: 14 },

  summaryCard: {
    padding: theme.spacing.xl, borderRadius: theme.radius.lg, ...theme.shadow.lg,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  summaryAmt: { color: '#fff', fontSize: 36, fontWeight: '800', marginTop: 4 },
  summarySub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  securePill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: theme.radius.pill,
    paddingHorizontal: 10, paddingVertical: 5, marginTop: 14,
  },
  securePillText: { color: '#D1FAE5', fontSize: 11, fontWeight: '800' },

  miniRow: { flexDirection: 'row', gap: 10, marginTop: theme.spacing.md },
  miniCard: {
    flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.md,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm,
  },
  miniIconWrap: {
    width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#DCFCE7', marginBottom: 8,
  },
  miniLabel: { color: theme.colors.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  miniValue: { color: theme.colors.brand, fontSize: 17, fontWeight: '900', marginTop: 4 },

  feeCard: { marginBottom: 4 },
  feeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeType: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  feeSem: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  feeAmtRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  feeAmtLabel: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  feeAmt: { fontSize: 24, fontWeight: '800', color: theme.colors.brand, marginTop: 2 },
  feeDue: { marginTop: 10, fontSize: 11, color: theme.colors.muted, fontWeight: '600' },

  paidPill: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  paidTxt: { color: theme.colors.success, fontSize: 11, fontWeight: '700' },
  duePill: {
    flexDirection: 'row', gap: 4, alignItems: 'center',
    backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: theme.radius.pill,
  },
  dueTxt: { color: theme.colors.warning, fontSize: 11, fontWeight: '700' },

  receiptCard: { marginBottom: 4 },
  receiptRow: { flexDirection: 'row', alignItems: 'center' },
  receiptDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  receiptType: { color: theme.colors.onSurface, fontSize: 14, fontWeight: '600' },
  receiptDate: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  receiptAmt: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '700' },
  receiptFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.divider,
  },
  receiptId: { color: theme.colors.muted, fontSize: 10, flex: 1 },
  receiptStatus: { color: theme.colors.success, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  backdrop: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.xl, paddingBottom: 40,
  },
  sheetHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  sheetSummary: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  sheetSummaryLabel: { color: theme.colors.muted, fontWeight: '600' },
  sheetSummaryAmt: { fontSize: 44, fontWeight: '800', color: theme.colors.brand, marginTop: 4 },
  sheetSummarySem: { fontSize: 12, color: theme.colors.muted, marginTop: 4 },

  secureBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#ECFDF5', borderRadius: theme.radius.md,
    padding: theme.spacing.md, marginBottom: theme.spacing.md,
  },
  secureBoxText: { flex: 1, color: theme.colors.brand, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  paymentError: { color: theme.colors.error, fontSize: 12, fontWeight: '700', marginBottom: theme.spacing.md },
});
