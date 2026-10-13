import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton, BadgePill, TabSelector, EmptyState } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Users, UserPlus, Clock, CheckCircle, AlertTriangle, Phone,
  ChevronRight, Shield, Car, BookOpen, Camera, ArrowLeft,
  Check, X, Building2,
} from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';

const VISITOR_TYPE_META = [
  { type: 'parent', label: 'Parent', icon: Users, color: '#4F46E5' },
  { type: 'guest', label: 'Guest', icon: BookOpen, color: '#10B981' },
  { type: 'vendor', label: 'Vendor', icon: Car, color: '#F59E0B' },
  { type: 'candidate', label: 'Candidate', icon: UserPlus, color: '#3B82F6' },
];

export default function VisitorManagement() {
  const [activeTab, setActiveTab] = useState<'log' | 'pending' | 'register'>('log');
  const [newVisitor, setNewVisitor] = useState({ name: '', purpose: '', who: '', phone: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { data: visitors, loading, refresh } = useFetch<any[]>('/visitors');
  const { mutate: registerVisitor, loading: registering } = useMutate('/visitors');

  const visitorList = useMemo(() => (Array.isArray(visitors) ? visitors : []), [visitors]);

  const visitorTypes = useMemo(() => {
    return VISITOR_TYPE_META.map(t => ({
      ...t,
      count: visitorList.filter((v: any) => v.type === t.type).length,
    }));
  }, [visitorList]);

  const visitorLog = useMemo(
    () => visitorList.filter((v: any) => v.status !== 'pending_approval'),
    [visitorList]
  );
  const pendingApproval = useMemo(
    () => visitorList.filter((v: any) => v.status === 'pending_approval'),
    [visitorList]
  );

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleRegister = async () => {
    if (!newVisitor.name.trim()) return Alert.alert('Error', 'Enter visitor name');
    try {
      await registerVisitor(newVisitor);
      Alert.alert('Visitor Registered', `${newVisitor.name} has been registered. Gate pass notification sent.`);
      setNewVisitor({ name: '', purpose: '', who: '', phone: '' });
      refresh();
      setActiveTab('log');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to register visitor.');
    }
  };

  const tabOptions = [
    { key: 'log', label: 'Visitor Log', badge: visitorLog.length },
    { key: 'pending', label: 'Approvals', badge: pendingApproval.length },
    { key: 'register', label: 'Register' },
  ];

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Hero Header */}
          <View style={styles.hero}>
            <LinearGradient colors={theme.gradients.brand} style={styles.heroGrad}>
              <View style={styles.heroHeaderRow}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={12}
                  style={styles.backBtn}
                  testID="back-btn"
                  accessibilityLabel="Back"
                >
                  <ArrowLeft size={18} color="#fff" />
                </Pressable>
                <View style={styles.heroTitles}>
                  <Text style={styles.heroTitle} numberOfLines={1}>Visitor Management</Text>
                  <Text style={styles.heroSub} numberOfLines={1}>Gate check-ins, security logs & approvals</Text>
                </View>
                <View style={styles.badgeWrap}>
                  <BadgePill label="Campus Live" variant="success" size="sm" dot />
                </View>
              </View>

              {/* Real-time Category Stats */}
              <View style={styles.heroStats}>
                {visitorTypes.map((vt, i) => {
                  const Icon = vt.icon;
                  return (
                    <View key={i} style={styles.heroStat}>
                      <View style={[styles.heroStatIconWrap, { backgroundColor: vt.color + '22' }]}>
                        <Icon size={14} color={vt.color} />
                      </View>
                      <Text style={styles.heroStatVal}>{vt.count}</Text>
                      <Text style={styles.heroStatLabel}>{vt.label}</Text>
                    </View>
                  );
                })}
              </View>
            </LinearGradient>
          </View>

          {/* Tab Selector */}
          <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: 14, paddingBottom: 6 }}>
            <TabSelector
              tabs={tabOptions}
              options={tabOptions}
              activeTab={activeTab}
              selected={activeTab}
              onSelect={(k: string) => setActiveTab(k as any)}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'log' && (
              <>
                {visitorLog.length === 0 ? (
                  <EmptyState
                    title="No Visitors Logged"
                    sub="Active visitors entering campus will be recorded here"
                    icon={<Users size={32} color={theme.colors.muted} />}
                  />
                ) : (
                  visitorLog.map((v: any) => {
                    const isIn = v.status === 'in_campus';
                    return (
                      <Card key={v.id} variant="elevated" style={styles.visitorCard}>
                        <View style={styles.cardTopRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                            <View style={[styles.avatar, isIn ? styles.avatarActive : styles.avatarLeft]}>
                              <Text style={styles.avatarText}>{v.name?.charAt(0) || 'V'}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.visitorName} numberOfLines={1}>{v.name}</Text>
                              <Text style={styles.visitorMeta} numberOfLines={1}>
                                {v.purpose || 'General Visit'} · {v.type || 'Guest'}
                              </Text>
                            </View>
                          </View>
                          <BadgePill
                            label={isIn ? 'In Campus' : 'Departed'}
                            variant={isIn ? 'success' : 'neutral'}
                            size="sm"
                            dot={isIn}
                          />
                        </View>

                        <View style={styles.hostRow}>
                          <Phone size={12} color={theme.colors.muted} />
                          <Text style={styles.hostText}>Host: {v.who || 'Administration'}</Text>
                        </View>

                        <View style={styles.timeRow}>
                          <View style={styles.timeChip}>
                            <Clock size={11} color={theme.colors.brand} />
                            <Text style={styles.timeText}>Entry: {v.inTime || 'Just now'}</Text>
                          </View>
                          {v.outTime ? (
                            <View style={styles.timeChip}>
                              <Clock size={11} color={theme.colors.muted} />
                              <Text style={styles.timeText}>Exit: {v.outTime}</Text>
                            </View>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'pending' && (
              <>
                {pendingApproval.length === 0 ? (
                  <EmptyState
                    title="All Approvals Cleared"
                    sub="No visitor entry passes currently awaiting clearance"
                    icon={<CheckCircle size={32} color={theme.colors.success} />}
                  />
                ) : (
                  pendingApproval.map((p: any) => (
                    <Card key={p.id} variant="elevated" style={styles.pendingCard}>
                      <View style={styles.cardTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                          <View style={[styles.avatar, styles.avatarPending]}>
                            <AlertTriangle size={16} color="#D97706" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.visitorName} numberOfLines={1}>{p.name}</Text>
                            <Text style={styles.visitorMeta} numberOfLines={1}>
                              {p.purpose} · {p.type || 'Visitor'}
                            </Text>
                          </View>
                        </View>
                        <BadgePill label="Pending Approval" variant="warning" size="sm" dot />
                      </View>

                      <View style={styles.pendingDetails}>
                        <Text style={styles.detailText}>Meeting With: <Text style={styles.detailBold}>{p.who}</Text></Text>
                        {p.expectedTime ? (
                          <Text style={styles.detailText}>Expected Arrival: <Text style={styles.detailBold}>{p.expectedTime}</Text></Text>
                        ) : null}
                      </View>

                      <View style={styles.approvalActions}>
                        <Pressable
                          style={styles.approveBtn}
                          onPress={() => Alert.alert('Approved', `${p.name} entrance pass has been authorized`)}
                        >
                          <Check size={14} color="#fff" />
                          <Text style={styles.approveBtnText}>Approve Pass</Text>
                        </Pressable>
                        <Pressable
                          style={styles.rejectBtn}
                          onPress={() => Alert.alert('Denied', `${p.name} entrance has been declined`)}
                        >
                          <X size={14} color={theme.colors.error} />
                          <Text style={styles.rejectBtnText}>Decline</Text>
                        </Pressable>
                      </View>
                    </Card>
                  ))
                )}
              </>
            )}

            {activeTab === 'register' && (
              <>
                <Card variant="elevated" style={styles.formCard}>
                  <Text style={styles.formTitle}>Register New Visitor</Text>
                  <Text style={styles.formSub}>Generate a digital gate pass for upcoming campus visitors</Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Visitor Full Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={newVisitor.name}
                      onChangeText={v => setNewVisitor(p => ({ ...p, name: v }))}
                      placeholder="e.g. Dr. Rajesh Sharma"
                      placeholderTextColor={theme.colors.muted}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Purpose of Visit *</Text>
                    <TextInput
                      style={styles.input}
                      value={newVisitor.purpose}
                      onChangeText={v => setNewVisitor(p => ({ ...p, purpose: v }))}
                      placeholder="e.g. Guest Lecture / Campus Tour"
                      placeholderTextColor={theme.colors.muted}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Whom to Meet *</Text>
                    <TextInput
                      style={styles.input}
                      value={newVisitor.who}
                      onChangeText={v => setNewVisitor(p => ({ ...p, who: v }))}
                      placeholder="e.g. Dean Office / Dept of CS"
                      placeholderTextColor={theme.colors.muted}
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      value={newVisitor.phone}
                      onChangeText={v => setNewVisitor(p => ({ ...p, phone: v }))}
                      placeholder="+91 98765 43210"
                      placeholderTextColor={theme.colors.muted}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={{ marginTop: 8 }}>
                    <GradientButton
                      label={registering ? 'Registering...' : 'Register & Issue Pass'}
                      onPress={handleRegister}
                      loading={registering}
                    />
                  </View>
                </Card>

                <Card style={styles.policyCard}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <View style={styles.shieldIconWrap}>
                      <Shield size={16} color={theme.colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.policyTitle}>Campus Security Guidelines</Text>
                      <Text style={styles.policyText}>
                        All visitors must carry valid government ID at the campus checkpoint. Passes are auto-notified to host departments and expire at standard campus closing hours.
                      </Text>
                    </View>
                  </View>
                </Card>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: 0,
  },
  heroGrad: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomLeftRadius: theme.radius.xl,
    borderBottomRightRadius: theme.radius.xl,
    gap: 14,
    ...theme.shadow.md,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroTitles: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  badgeWrap: {
    flexShrink: 0,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: theme.radius.lg,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroStatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatVal: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },
  scrollContent: {
    padding: theme.spacing.lg,
    paddingBottom: 100,
    gap: 12,
  },
  visitorCard: {
    padding: 14,
    gap: 10,
  },
  pendingCard: {
    padding: 14,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.xs,
  },
  avatarActive: {
    backgroundColor: theme.colors.success,
  },
  avatarLeft: {
    backgroundColor: theme.colors.muted,
  },
  avatarPending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  visitorName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  visitorMeta: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 1,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 50,
  },
  hostText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 50,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
  pendingDetails: {
    marginLeft: 50,
    gap: 3,
  },
  detailText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  detailBold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 50,
    marginTop: 4,
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...theme.shadow.xs,
  },
  approveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.error + '40',
    backgroundColor: theme.colors.error + '08',
  },
  rejectBtnText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: 12,
  },
  formCard: {
    padding: 18,
    gap: 14,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  formSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: -8,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  policyCard: {
    padding: 14,
    backgroundColor: theme.colors.brandTertiary,
    borderColor: theme.colors.brand + '30',
  },
  shieldIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.brand + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.brand,
    marginBottom: 2,
  },
  policyText: {
    fontSize: 11,
    color: theme.colors.text,
    lineHeight: 16,
  },
});

