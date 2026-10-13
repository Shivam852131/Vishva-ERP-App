import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from '@/src/navigation/router';
import { Ionicons } from '@/src/components/Ionicons';
import { useAuth } from '../../src/providers/AuthContext';
import { useFetch, useMutate } from '../../src/hooks/useFetch';

type PaymentConfig = {
  configured: boolean;
  configId?: string;
  mode?: string;
  keyId?: string;
  keySecretMasked?: string;
  webhookConfigured?: boolean;
  status?: string;
};

export default function PaymentSettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: config, loading: configLoading, refresh } = useFetch<PaymentConfig>('/payment-config');
  const { mutate, loading: saving } = useMutate();

  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const handleSave = async () => {
    if (!keyId.trim() || !keySecret.trim()) {
      return Alert.alert('Error', 'Please enter both Razorpay Key ID and Key Secret.');
    }
    if (!keyId.startsWith('rzp_')) {
      return Alert.alert('Error', 'Invalid Razorpay Key ID format. Must start with "rzp_".');
    }
    try {
      await mutate('/payment-config', {
        method: 'POST',
        body: JSON.stringify({ keyId: keyId.trim(), keySecret: keySecret.trim(), mode }),
      });
      Alert.alert('Success', 'Payment configuration saved successfully!');
      setKeySecret('');
      refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save configuration.');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await mutate('/payment-config/verify', { method: 'POST' }) as any;
      Alert.alert('Connection Successful', result?.message || 'Razorpay connection verified!');
      refresh();
    } catch (e: any) {
      Alert.alert('Connection Failed', e.message || 'Could not connect to Razorpay. Check your keys.');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Remove Configuration',
      'This will disconnect your Razorpay account. Students won\'t be able to pay fees until you reconfigure.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await mutate('/payment-config', { method: 'DELETE' });
              Alert.alert('Removed', 'Payment configuration removed.');
              setKeyId('');
              refresh();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
        {configLoading ? (
          <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 40 }} />
        ) : (
          <>
            {config?.configured && (
              <View style={[styles.statusCard, { borderColor: config.status === 'active' ? '#10b981' : '#f59e0b' }]}>
                <View style={styles.statusHeader}>
                  <Ionicons name={config.status === 'active' ? 'checkmark-circle' : 'alert-circle'} size={24} color={config.status === 'active' ? '#10b981' : '#f59e0b'} />
                  <Text style={[styles.statusText, { color: config.status === 'active' ? '#10b981' : '#f59e0b' }]}>
                    {config.status === 'active' ? 'Connected' : 'Needs Attention'}
                  </Text>
                </View>
                <View style={styles.statusDetails}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Mode:</Text>
                    <View style={[styles.modeBadge, { backgroundColor: config.mode === 'live' ? '#10b981' : '#f59e0b' }]}>
                      <Text style={styles.modeText}>{config.mode?.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Key ID:</Text>
                    <Text style={styles.statusValue}>{config.keyId}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Secret:</Text>
                    <Text style={styles.statusValue}>{config.keySecretMasked}</Text>
                  </View>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>Webhook:</Text>
                    <Text style={[styles.statusValue, { color: config.webhookConfigured ? '#10b981' : '#f59e0b' }]}>
                      {config.webhookConfigured ? 'Configured' : 'Not Set'}
                    </Text>
                  </View>
                </View>
                <View style={styles.statusActions}>
                  <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testing}>
                    {testing ? (
                      <ActivityIndicator color="#6366f1" size="small" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={16} color="#6366f1" />
                        <Text style={styles.testBtnText}>Test Connection</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Ionicons name="trash" size={16} color="#ef4444" />
                    <Text style={styles.deleteBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.infoCard}>
              <Ionicons name="information-circle" size={20} color="#6366f1" />
              <Text style={styles.infoText}>
                {config?.configured
                  ? 'Update your Razorpay credentials below. Keys are encrypted and stored securely.'
                  : 'Connect your Razorpay account to receive student fee payments directly into your bank account.'}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>
              {config?.configured ? 'Update Configuration' : 'Connect Razorpay Account'}
            </Text>

            <Text style={styles.label}>Payment Mode</Text>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'test' && styles.modeBtnActive]}
                onPress={() => setMode('test')}
              >
                <Text style={[styles.modeBtnText, mode === 'test' && styles.modeBtnTextActive]}>Test Mode</Text>
                <Text style={styles.modeDesc}>Sandbox environment</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'live' && styles.modeBtnActiveLive]}
                onPress={() => setMode('live')}
              >
                <Text style={[styles.modeBtnText, mode === 'live' && styles.modeBtnTextActive]}>Live Mode</Text>
                <Text style={styles.modeDesc}>Real payments</Text>
              </TouchableOpacity>
            </View>

            {mode === 'live' && (
              <View style={styles.warningCard}>
                <Ionicons name="warning" size={18} color="#f59e0b" />
                <Text style={styles.warningText}>
                  Live mode will process real payments. Ensure your Razorpay account is fully verified.
                </Text>
              </View>
            )}

            <Text style={styles.label}>Razorpay Key ID *</Text>
            <TextInput
              style={styles.input}
              value={keyId}
              onChangeText={setKeyId}
              placeholder="rzp_test_..."
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Razorpay Key Secret *</Text>
            <View style={styles.secretRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={keySecret}
                onChangeText={setKeySecret}
                placeholder={config?.configured ? 'Enter new secret or leave blank' : 'Enter your key secret'}
                placeholderTextColor="#475569"
                secureTextEntry={!showSecret}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowSecret(!showSecret)}>
                <Ionicons name={showSecret ? 'eye-off' : 'eye'} size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark" size={16} color="#10b981" />
              <Text style={styles.securityText}>
                Your Key Secret is encrypted with AES-256-GCM before storage. It is never sent to the frontend or any external service.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="save" size={18} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {config?.configured ? 'Update Configuration' : 'Save & Connect'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.helpCard}>
              <Text style={styles.helpTitle}>How to get your Razorpay keys?</Text>
              <Text style={styles.helpStep}>1. Log in to Razorpay Dashboard</Text>
              <Text style={styles.helpStep}>2. Go to Settings {'>'} API Keys</Text>
              <Text style={styles.helpStep}>3. Generate or copy your Key ID and Key Secret</Text>
              <Text style={styles.helpStep}>4. Paste them above and save</Text>
              <Text style={styles.helpNote}>
                Note: The Key Secret is shown only once when generated. If lost, you'll need to regenerate it.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingHorizontal: 16, paddingBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40 },
  statusCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusText: { fontSize: 16, fontWeight: '700' },
  statusDetails: { gap: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLabel: { color: '#94a3b8', fontSize: 13 },
  statusValue: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  modeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  modeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  statusActions: { flexDirection: 'row', gap: 10, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  testBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(99,102,241,0.15)', paddingVertical: 10, borderRadius: 10 },
  testBtnText: { color: '#6366f1', fontSize: 13, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(239,68,68,0.15)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10 },
  deleteBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(99,102,241,0.1)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', marginBottom: 20 },
  infoText: { color: '#94a3b8', fontSize: 12, flex: 1, lineHeight: 18 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#1e293b', borderRadius: 12, padding: 14, color: '#e2e8f0', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  secretRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  modeBtnActive: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' },
  modeBtnActiveLive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' },
  modeBtnText: { color: '#94a3b8', fontSize: 14, fontWeight: '700' },
  modeBtnTextActive: { color: '#fff' },
  modeDesc: { color: '#64748b', fontSize: 11, marginTop: 2 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(245,158,11,0.1)', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginTop: 12 },
  warningText: { color: '#f59e0b', fontSize: 12, flex: 1, lineHeight: 17 },
  securityNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 10, marginTop: 16 },
  securityText: { color: '#10b981', fontSize: 11, flex: 1, lineHeight: 16, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366f1', marginTop: 20, paddingVertical: 16, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  helpCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginTop: 20 },
  helpTitle: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  helpStep: { color: '#94a3b8', fontSize: 12, marginBottom: 4, lineHeight: 18 },
  helpNote: { color: '#64748b', fontSize: 11, marginTop: 8, fontStyle: 'italic' },
});
