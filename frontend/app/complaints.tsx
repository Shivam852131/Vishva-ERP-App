import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  AlertTriangle, Clock, CheckCircle, ChevronRight, Plus,
  Wrench, Wifi, Droplets, Zap, Shield, MessageSquare, X,
} from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';

const CATEGORIES = [
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, color: '#F59E0B' },
  { key: 'network', label: 'Network', icon: Wifi, color: '#3B82F6' },
  { key: 'plumbing', label: 'Plumbing', icon: Droplets, color: '#06B6D4' },
  { key: 'electrical', label: 'Electrical', icon: Zap, color: '#8B5CF6' },
  { key: 'security', label: 'Security', icon: Shield, color: '#EF4444' },
  { key: 'other', label: 'Other', icon: MessageSquare, color: '#64748B' },
];

export default function ComplaintManagement() {
  const [activeTab, setActiveTab] = useState<'list' | 'new' | 'detail'>('list');
  const [selectedComplaint, setSelectedComplaint] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [newComplaint, setNewComplaint] = useState({ title: '', category: 'maintenance', priority: 'medium', description: '' });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { data: complaints, loading, refresh, setData } = useFetch<any[]>('/grievances');
  const { mutate } = useMutate('/grievances');

  const stats = useMemo(() => {
    const items = complaints || [];
    return {
      total: items.length,
      pending: items.filter((c: any) => c.status === 'pending').length,
      inProgress: items.filter((c: any) => c.status === 'in_progress').length,
      resolved: items.filter((c: any) => c.status === 'resolved').length,
    };
  }, [complaints]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleSubmit = async () => {
    if (!newComplaint.title.trim()) return Alert.alert('Error', 'Enter complaint title');
    try {
      await mutate(newComplaint);
      Alert.alert('Complaint Filed', 'Your complaint has been submitted.');
      setNewComplaint({ title: '', category: 'maintenance', priority: 'medium', description: '' });
      setActiveTab('list');
      refresh();
    } catch {
      Alert.alert('Error', 'Failed to submit complaint.');
    }
  };

  const filteredComplaints = (complaints || []).filter((c: any) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const detail = (complaints || []).find((c: any) => c.id === selectedComplaint);

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <Pressable onPress={() => activeTab === 'detail' ? setActiveTab('list') : router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><AlertTriangle size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>Complaint Management</Text>
                  <Text style={styles.heroSub}>Raise, track & resolve issues</Text>
                </View>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{stats.total}</Text><Text style={styles.heroStatLabel}>Total</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={[styles.heroStatVal, { color: '#F59E0B' }]}>{stats.pending}</Text><Text style={styles.heroStatLabel}>Pending</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={[styles.heroStatVal, { color: '#3B82F6' }]}>{stats.inProgress}</Text><Text style={styles.heroStatLabel}>In Progress</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={[styles.heroStatVal, { color: '#10B981' }]}>{stats.resolved}</Text><Text style={styles.heroStatLabel}>Resolved</Text></View>
              </View>
            </LinearGradient>
          </View>

          {activeTab !== 'detail' && (
            <View style={styles.tabs}>
              {(['list', 'new'] as const).map(t => (
                <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabActive]}>
                  <Text style={[styles.tabTxt, activeTab === t && { color: '#fff' }]}>{t === 'list' ? 'My Complaints' : 'New Complaint'}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {activeTab === 'list' && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {['all', 'pending', 'in_progress', 'resolved'].map(f => (
                    <Pressable key={f} onPress={() => setFilter(f)}
                      style={[styles.filterChip, filter === f && styles.filterActive]}>
                      <Text style={[styles.filterText, filter === f && { color: '#fff' }]}>{f === 'all' ? 'All' : f.replace('_', ' ')}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {filteredComplaints.length === 0 ? (
                  <Card style={{ padding: 40, alignItems: 'center' }}>
                    <AlertTriangle size={32} color={theme.colors.muted} />
                    <Text style={{ fontSize: 14, color: theme.colors.muted, marginTop: 12 }}>No complaints filed yet</Text>
                  </Card>
                ) : (
                  filteredComplaints.map((c: any) => {
                    const cat = CATEGORIES.find(ct => ct.key === c.category);
                    const Icon = cat?.icon || AlertTriangle;
                    return (
                      <Pressable key={c.id} onPress={() => { setSelectedComplaint(c.id); setActiveTab('detail'); }}>
                        <Card style={{ padding: 14, gap: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={[styles.catIcon, { backgroundColor: (cat?.color || '#64748B') + '15' }]}>
                              <Icon size={18} color={cat?.color || '#64748B'} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 13 }}>{c.title}</Text>
                              <Text style={{ fontSize: 11, color: theme.colors.muted }}>{c.ticketId} · {c.date}</Text>
                            </View>
                            <View style={[styles.statusBadge, c.status === 'resolved' ? styles.statusResolved : c.status === 'in_progress' ? styles.statusProgress : styles.statusPending]}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: c.status === 'resolved' ? '#10B981' : c.status === 'in_progress' ? '#3B82F6' : '#F59E0B' }}>{c.status.replace('_', ' ')}</Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8, marginLeft: 44 }}>
                            <View style={[styles.priorityBadge, c.priority === 'high' ? styles.priHigh : c.priority === 'medium' ? styles.priMed : styles.priLow]}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: c.priority === 'high' ? '#EF4444' : c.priority === 'medium' ? '#F59E0B' : '#10B981' }}>{c.priority}</Text>
                            </View>
                            <Text style={{ fontSize: 11, color: theme.colors.muted }}>{c.updates?.length || 0} updates</Text>
                          </View>
                        </Card>
                      </Pressable>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'new' && (
              <>
                <SectionTitle>Category</SectionTitle>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <Pressable key={cat.key} onPress={() => setNewComplaint(p => ({ ...p, category: cat.key }))}
                        style={[styles.catCard, newComplaint.category === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '08' }]}>
                        <Icon size={18} color={cat.color} />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text }}>{cat.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <SectionTitle>Priority</SectionTitle>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['low', 'medium', 'high'].map(p => (
                    <Pressable key={p} onPress={() => setNewComplaint(prev => ({ ...prev, priority: p }))}
                      style={[styles.priorityBtn, newComplaint.priority === p && (p === 'high' ? styles.priBtnHigh : p === 'medium' ? styles.priBtnMed : styles.priBtnLow)]}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: newComplaint.priority === p ? '#fff' : theme.colors.muted }}>{p}</Text>
                    </Pressable>
                  ))}
                </View>

                <Card style={{ padding: 16, gap: 10 }}>
                  <TextInput style={styles.input} value={newComplaint.title} onChangeText={v => setNewComplaint(p => ({ ...p, title: v }))}
                    placeholder="Complaint Title" placeholderTextColor={theme.colors.muted} />
                  <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]} value={newComplaint.description} onChangeText={v => setNewComplaint(p => ({ ...p, description: v }))}
                    placeholder="Describe the issue in detail..." placeholderTextColor={theme.colors.muted} multiline />
                  <GradientButton label="Submit Complaint" onPress={handleSubmit} />
                </Card>
              </>
            )}

            {activeTab === 'detail' && detail && (
              <>
                <Card style={{ padding: 16, gap: 10 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>{detail.title}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>{detail.ticketId}</Text>
                    <View style={[styles.statusBadge, detail.status === 'resolved' ? styles.statusResolved : detail.status === 'in_progress' ? styles.statusProgress : styles.statusPending]}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: detail.status === 'resolved' ? '#10B981' : detail.status === 'in_progress' ? '#3B82F6' : '#F59E0B' }}>{detail.status.replace('_', ' ')}</Text>
                    </View>
                  </View>
                </Card>

                <SectionTitle>Updates Timeline</SectionTitle>
                {(detail.updates || []).map((u: any, i: number) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ width: 20, alignItems: 'center' }}>
                      <View style={[styles.timelineDot, u.type === 'success' ? { backgroundColor: '#10B981' } : u.type === 'warning' ? { backgroundColor: '#F59E0B' } : { backgroundColor: theme.colors.brand }]} />
                      {i < (detail.updates || []).length - 1 && <View style={styles.timelineLine} />}
                    </View>
                    <Card style={{ flex: 1, padding: 12, gap: 4 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>{u.time}</Text>
                      <Text style={{ fontSize: 13, color: theme.colors.text }}>{u.text}</Text>
                    </Card>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, gap: 10 },
  heroIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  heroStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 12, marginTop: 4 },
  heroStat: { alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 },
  heroStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
  backBtn: { position: 'absolute', top: 16, left: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginVertical: 12 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brand },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  filterActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted, textTransform: 'capitalize' },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  catCard: { width: '30%', alignItems: 'center', gap: 4, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary },
  statusResolved: { backgroundColor: '#10B98115' },
  statusProgress: { backgroundColor: '#3B82F615' },
  statusPending: { backgroundColor: '#F59E0B15' },
  priorityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: theme.colors.surfaceTertiary },
  priHigh: { backgroundColor: '#EF444415' },
  priMed: { backgroundColor: '#F59E0B15' },
  priLow: { backgroundColor: '#10B98115' },
  priorityBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  priBtnHigh: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  priBtnMed: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  priBtnLow: { backgroundColor: '#10B981', borderColor: '#10B981' },
  input: { backgroundColor: theme.colors.surface, borderRadius: 10, padding: 12, fontSize: 14, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: theme.colors.border, marginTop: 4 },
});
