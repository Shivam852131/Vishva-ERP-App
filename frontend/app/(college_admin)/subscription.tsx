import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from '@/src/navigation/router';
import { Ionicons } from '@/src/components/Ionicons';
import { useFetch, useMutate } from '../../src/hooks/useFetch';
import { useAuth } from '../../src/providers/AuthContext';
import { getRazorpayOrderId, openRazorpayCheckout, type RazorpayOrderResponse } from '../../src/razorpay';
import { subscribeRealtime } from '@/src/realtime/socket';

const PLANS = [
  { id: 'basic', name: 'Basic', price: 999, duration: '1 Month', features: ['Up to 200 students', 'Basic analytics', 'Attendance tracking', 'Fee management', 'Notifications'] },
  { id: 'pro', name: 'Professional', price: 2999, duration: '6 Months', features: ['Up to 1000 students', 'Advanced analytics', 'AI Hub access', 'Exam generator', 'Library management', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: 4999, duration: '12 Months', features: ['Unlimited students', 'All features', 'Custom integrations', 'Dedicated support', 'White-label branding', 'API access'] },
];

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { data: subData, refresh } = useFetch<any>('/subscription/current');
  const { mutate, loading } = useMutate<any>();

  React.useEffect(() => subscribeRealtime('subscription:update', () => refresh()), [refresh]);

  const isActive = subData?.active !== false;
  const currentPlan = subData?.plan;
  const expiresAt = subData?.expires_at;

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleRazorpay = async (planId: string) => {
    try {
      setSelectedPlan(planId);
      const order = await mutate('/subscription/create-order', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId }),
      }) as RazorpayOrderResponse;

      const plan = PLANS.find(p => p.id === planId);

      const payment = await openRazorpayCheckout({
        order,
        name: 'Vishva ERP Subscription',
        description: `${plan?.name || planId} Plan - ${plan?.duration || ''}`,
        prefill: { name: user?.name, email: user?.email, contact: user?.phone },
        themeColor: '#6366f1',
      });

      if (payment.openedExternal) {
        Alert.alert('Payment opened', 'Complete the payment in the Razorpay page. Your subscription will activate after confirmation.');
        refresh();
        return;
      }

      await mutate('/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'subscription', plan_id: planId, order_id: getRazorpayOrderId(order), ...payment }),
      });

      Alert.alert('Subscription active', `${plan?.name || planId} plan is now active!`, [{ text: 'OK', onPress: () => refresh() }]);
    } catch (error: any) {
      Alert.alert('Payment failed', error?.message || 'Please try again.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription</Text>
        <View style={{ width: 40 }} />
      </View>

      {isActive && (
        <View style={styles.activeBanner}>
          <Ionicons name="checkmark-circle" size={24} color="#10b981" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.activeText}>Active Subscription</Text>
            <Text style={styles.activeSubtext}>
              {currentPlan?.toUpperCase()} — expires {new Date(expiresAt!).toLocaleDateString()}
            </Text>
          </View>
          <Ionicons name="shield-checkmark" size={28} color="#10b981" />
        </View>
      )}

      <Text style={styles.sectionTitle}>Choose Your Plan</Text>
      <Text style={styles.sectionSub}>Unlock all features for your institution</Text>

      {PLANS.map((plan) => {
        const isSelected = selectedPlan === plan.id;
        const isCurrent = currentPlan === plan.id;
        return (
          <TouchableOpacity
            key={plan.id}
            style={[styles.planCard, isSelected && styles.planCardSelected, isCurrent && styles.planCardCurrent]}
            onPress={() => handleSelectPlan(plan.id)}
          >
            {plan.id === 'pro' && <View style={styles.popularBadge}><Text style={styles.popularText}>MOST POPULAR</Text></View>}
            <View style={styles.planHeader}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceCurrency}>₹</Text>
                <Text style={styles.priceAmount}>{plan.price.toLocaleString()}</Text>
                <Text style={styles.priceDuration}>/ {plan.duration}</Text>
              </View>
            </View>
            <View style={styles.planFeatures}>
              {plan.features.map((f, i) => (
                <View key={i} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
            {isCurrent ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Current Plan</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.subscribeBtn, loading && { opacity: 0.6 }]}
                onPress={() => handleRazorpay(plan.id)}
                disabled={loading}
              >
                {loading && selectedPlan === plan.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="card" size={18} color="#fff" />
                    <Text style={styles.subscribeText}>Subscribe with Razorpay</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#6366f1" />
        <Text style={styles.infoText}>
          All plans include a 7-day free trial. Payments are processed securely via Razorpay. Cancel anytime from your dashboard.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  activeBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16,185,129,0.15)', margin: 16, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  activeText: { color: '#10b981', fontSize: 16, fontWeight: '700' },
  activeSubtext: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 20, paddingHorizontal: 16 },
  sectionSub: { color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 16, marginBottom: 20 },
  planCard: { backgroundColor: '#1e293b', marginHorizontal: 16, marginBottom: 16, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  planCardSelected: { borderColor: '#6366f1', backgroundColor: '#1e1b4b' },
  planCardCurrent: { borderColor: '#10b981' },
  popularBadge: { backgroundColor: '#6366f1', paddingVertical: 4, alignItems: 'center' },
  popularText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  planHeader: { padding: 20 },
  planName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  priceCurrency: { color: '#94a3b8', fontSize: 18, fontWeight: '600' },
  priceAmount: { color: '#fff', fontSize: 32, fontWeight: '800', marginHorizontal: 2 },
  priceDuration: { color: '#94a3b8', fontSize: 14 },
  planFeatures: { paddingHorizontal: 20, paddingBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  featureText: { color: '#cbd5e1', fontSize: 13, marginLeft: 8 },
  subscribeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6366f1', marginHorizontal: 20, marginBottom: 20, paddingVertical: 14, borderRadius: 12, gap: 8 },
  subscribeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  currentBadge: { backgroundColor: 'rgba(16,185,129,0.2)', marginHorizontal: 20, marginBottom: 20, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  currentBadgeText: { color: '#10b981', fontSize: 14, fontWeight: '700' },
  infoCard: { flexDirection: 'row', backgroundColor: 'rgba(99,102,241,0.1)', margin: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  infoText: { color: '#94a3b8', fontSize: 12, marginLeft: 10, flex: 1, lineHeight: 18 },
});
