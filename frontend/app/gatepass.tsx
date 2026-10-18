import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton, BadgePill, TabSelector, EmptyState } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  ShieldCheck, FileText, Clock, CheckCircle2, AlertCircle, ArrowLeft,
  QrCode, Calendar, Send, UserCheck, Shield
} from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';

export default function GatePassScreen() {
  const [activeTab, setActiveTab] = useState<'passes' | 'request'>('passes');
  const [reason, setReason] = useState('');
  const [outTime, setOutTime] = useState('');
  const [inTime, setInTime] = useState('');

  const { data, loading, refresh } = useFetch<{ passes: any[] }>('/gatepass/my-passes');
  const { mutate: requestPass, loading: submitting } = useMutate('/gatepass/request');

  const passes = data?.passes || [];

  const handleRequestPass = async () => {
    if (!reason.trim()) {
      return Alert.alert('Missing Reason', 'Please enter a valid reason for out-pass.');
    }
    try {
      const now = new Date();
      const outIso = outTime ? new Date(outTime).toISOString() : new Date(now.getTime() + 3600000).toISOString();
      const inIso = inTime ? new Date(inTime).toISOString() : new Date(now.getTime() + 86400000).toISOString();

      await requestPass({
        reason: reason.trim(),
        outTime: outIso,
        inTime: inIso,
      });

      Alert.alert('Out-Pass Requested', 'Your out-pass request has been submitted for warden/parent approval.');
      setReason('');
      setOutTime('');
      setInTime('');
      refresh();
      setActiveTab('passes');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit out-pass request.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'active': return '#3B82F6';
      case 'pending': return '#F59E0B';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color="#FFFFFF" size={24} />
            </Pressable>
            <Text style={styles.headerTitle}>Digital Gate Pass</Text>
            <ShieldCheck color="#FFFFFF" size={24} />
          </View>
          <Text style={styles.headerSubtitle}>Hostel Out-Pass & Security QR Pass</Text>

          <TabSelector
            tabs={[
              { id: 'passes', label: 'My Out-Passes' },
              { id: 'request', label: 'New Request' },
            ]}
            activeTab={activeTab}
            onSelect={(tab: any) => setActiveTab(tab)}
          />
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {activeTab === 'passes' ? (
            <View>
              <SectionTitle title="Active & Recent Gate Passes" icon={FileText} />
              {loading ? (
                <Text style={styles.loadingText}>Loading gate passes...</Text>
              ) : passes.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No Out-Passes Found"
                  subtitle="Submit a new request when leaving campus."
                />
              ) : (
                passes.map((pass: any) => (
                  <Card key={pass._id || pass.id} style={styles.passCard}>
                    <View style={styles.passHeader}>
                      <View style={styles.passInfo}>
                        <Text style={styles.passReason}>{pass.reason}</Text>
                        <Text style={styles.passCode}>Token: {pass.qrCode}</Text>
                      </View>
                      <BadgePill
                        label={pass.status.toUpperCase()}
                        color={getStatusColor(pass.status)}
                      />
                    </View>

                    <View style={styles.passDivider} />

                    <View style={styles.timeRow}>
                      <View style={styles.timeCol}>
                        <Clock size={16} color="#6B7280" />
                        <Text style={styles.timeLabel}>Out:</Text>
                        <Text style={styles.timeVal}>
                          {new Date(pass.outTime).toLocaleDateString()} {new Date(pass.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <View style={styles.timeCol}>
                        <Clock size={16} color="#6B7280" />
                        <Text style={styles.timeLabel}>In:</Text>
                        <Text style={styles.timeVal}>
                          {new Date(pass.inTime).toLocaleDateString()} {new Date(pass.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>

                    {pass.status === 'approved' || pass.status === 'active' ? (
                      <View style={styles.qrContainer}>
                        <QrCode size={48} color="#4F46E5" />
                        <Text style={styles.qrHelpText}>Show this pass to campus security gate scanner</Text>
                      </View>
                    ) : null}

                    {pass.approvedBy ? (
                      <Text style={styles.approvedByText}>Approved by: {pass.approvedBy}</Text>
                    ) : null}
                  </Card>
                ))
              )}
            </View>
          ) : (
            <Card style={styles.formCard}>
              <SectionTitle title="Request Out-Pass" icon={Send} />

              <Text style={styles.inputLabel}>Reason for Leaving Campus *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Weekend Home Visit / Doctor Appointment"
                placeholderTextColor="#9CA3AF"
                value={reason}
                onChangeText={setReason}
              />

              <Text style={styles.inputLabel}>Expected Out-Time (YYYY-MM-DD HH:MM)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Leave blank for 1 hr from now"
                placeholderTextColor="#9CA3AF"
                value={outTime}
                onChangeText={setOutTime}
              />

              <Text style={styles.inputLabel}>Expected Return-Time (YYYY-MM-DD HH:MM)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Leave blank for tomorrow"
                placeholderTextColor="#9CA3AF"
                value={inTime}
                onChangeText={setInTime}
              />

              <View style={styles.infoBox}>
                <AlertCircle size={18} color="#4F46E5" />
                <Text style={styles.infoBoxText}>
                  Your request will be routed to your Hostel Warden and registered Parent phone for approval before gate pass generation.
                </Text>
              </View>

              <GradientButton
                title={submitting ? 'Submitting...' : 'Submit Out-Pass Request'}
                onPress={handleRequestPass}
                disabled={submitting}
              />
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#E0E7FF',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#6B7280',
    marginVertical: 20,
  },
  passCard: {
    marginBottom: 14,
    padding: 14,
  },
  passHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  passInfo: {
    flex: 1,
    paddingRight: 8,
  },
  passReason: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  passCode: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
    marginTop: 2,
  },
  passDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 10,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  timeVal: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  qrContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
    gap: 6,
  },
  qrHelpText: {
    fontSize: 12,
    color: '#6B7280',
  },
  approvedByText: {
    fontSize: 11,
    color: '#059669',
    marginTop: 8,
    fontStyle: 'italic',
  },
  formCard: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#3730A3',
    lineHeight: 16,
  },
});
