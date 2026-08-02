import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  Package, Search, Wrench, CheckCircle, AlertTriangle, Clock,
  Monitor, Projector, Printer, Server, Cpu, Wifi, ChevronRight,
} from 'lucide-react-native';

const ASSETS = [
  { id: '1', name: 'Dell Monitor 24"', category: 'Electronics', location: 'CS Lab 1', status: 'active', assignee: 'Lab 1', icon: Monitor, condition: 'Good', lastMaint: 'Jan 5' },
  { id: '2', name: 'Epson Projector', category: 'AV Equipment', location: 'Seminar Hall', status: 'maintenance', assignee: 'Seminar Hall', icon: Projector, condition: 'Needs Repair', lastMaint: 'Dec 15' },
  { id: '3', name: 'HP LaserJet Pro', category: 'Printers', location: 'Admin Office', status: 'active', assignee: 'Admin', icon: Printer, condition: 'Excellent', lastMaint: 'Jan 18' },
  { id: '4', name: 'Dell PowerEdge Server', category: 'Servers', location: 'Server Room', status: 'active', assignee: 'IT Dept', icon: Server, condition: 'Good', lastMaint: 'Jan 10' },
  { id: '5', name: 'Cisco Router 2900', category: 'Networking', location: 'Server Room', status: 'active', assignee: 'IT Dept', icon: Wifi, condition: 'Good', lastMaint: 'Jan 8' },
  { id: '6', name: 'Workstation PC #12', category: 'Computers', location: 'CS Lab 2', status: 'retired', assignee: 'None', icon: Cpu, condition: 'Retired', lastMaint: 'Nov 20' },
  { id: '7', name: 'Dell Monitor 27"', category: 'Electronics', location: 'Faculty Room', status: 'active', assignee: 'Dr. Mehta', icon: Monitor, condition: 'Good', lastMaint: 'Jan 12' },
  { id: '8', name: 'Projector Screen 120"', category: 'AV Equipment', location: 'Seminar Hall', status: 'active', assignee: 'Seminar Hall', icon: Projector, condition: 'Good', lastMaint: 'Jan 2' },
];

const MAINTENANCE_LOG = [
  { id: '1', asset: 'Epson Projector', issue: 'Lamp flickering', date: 'Jan 20', status: 'pending', technician: 'Assigned' },
  { id: '2', asset: 'Workstation PC #12', issue: 'Motherboard failure', date: 'Dec 15', status: 'completed', technician: 'Ravi Kumar' },
  { id: '3', asset: 'HP LaserJet Pro', issue: 'Paper jam recurring', date: 'Jan 18', status: 'in_progress', technician: 'Suresh' },
];

const CATEGORIES = ['All', 'Electronics', 'Computers', 'Servers', 'Networking', 'AV Equipment', 'Printers'];
const STATUS_COLORS: Record<string, string> = { active: '#10B981', maintenance: '#F59E0B', retired: '#64748B' };

export default function AssetManagement() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'assets' | 'maintenance' | 'report'>('assets');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const filteredAssets = ASSETS.filter(a => {
    if (selectedCategory !== 'All' && a.category !== selectedCategory) return false;
    if (search && !a.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: ASSETS.length,
    active: ASSETS.filter(a => a.status === 'active').length,
    maintenance: ASSETS.filter(a => a.status === 'maintenance').length,
    retired: ASSETS.filter(a => a.status === 'retired').length,
  };

  const assetDetail = ASSETS.find(a => a.id === selectedAsset);

  return (
    <ErrorBoundary>
      <Animated.View style={{ flex: 1, backgroundColor: theme.colors.surface, opacity: fadeAnim }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={styles.hero}>
            <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.heroGrad}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Text style={{ color: '#fff', fontSize: 18 }}>←</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={styles.heroIcon}><Package size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>Asset Management</Text>
                  <Text style={styles.heroSub}>Track campus equipment & inventory</Text>
                </View>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{stats.total}</Text><Text style={styles.heroStatLabel}>Total</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={[styles.heroStatVal, { color: '#10B981' }]}>{stats.active}</Text><Text style={styles.heroStatLabel}>Active</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={[styles.heroStatVal, { color: '#F59E0B' }]}>{stats.maintenance}</Text><Text style={styles.heroStatLabel}>Maint.</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={[styles.heroStatVal, { color: '#64748B' }]}>{stats.retired}</Text><Text style={styles.heroStatLabel}>Retired</Text></View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {(['assets', 'maintenance', 'report'] as const).map(t => (
              <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabActive]}>
                <Text style={[styles.tabTxt, activeTab === t && { color: '#fff' }]}>{t === 'assets' ? 'Assets' : t === 'maintenance' ? 'Maintenance' : 'Report'}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {activeTab === 'assets' && (
              <>
                <View style={styles.searchBox}>
                  <Search size={16} color={theme.colors.muted} />
                  <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
                    placeholder="Search assets..." placeholderTextColor={theme.colors.muted} />
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <Pressable key={c} onPress={() => setSelectedCategory(c)}
                      style={[styles.filterChip, selectedCategory === c && styles.filterActive]}>
                      <Text style={[styles.filterText, selectedCategory === c && { color: '#fff' }]}>{c}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {filteredAssets.map(asset => {
                  const Icon = asset.icon;
                  return (
                    <Pressable key={asset.id} onPress={() => setSelectedAsset(selectedAsset === asset.id ? null : asset.id)}>
                      <Card style={{ padding: 14, gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <View style={styles.assetIcon}><Icon size={20} color={theme.colors.brand} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '700', color: theme.colors.text }}>{asset.name}</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.muted }}>{asset.category} · {asset.location}</Text>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[asset.status] + '20' }]}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: STATUS_COLORS[asset.status] }}>{asset.status}</Text>
                          </View>
                        </View>

                        {selectedAsset === asset.id && (
                          <View style={{ gap: 8, marginTop: 4 }}>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Assigned To</Text>
                              <Text style={styles.detailValue}>{asset.assignee}</Text>
                            </View>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Condition</Text>
                              <Text style={styles.detailValue}>{asset.condition}</Text>
                            </View>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Last Maintenance</Text>
                              <Text style={styles.detailValue}>{asset.lastMaint}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <Pressable style={styles.actionBtn}><Wrench size={14} color={theme.colors.brand} /><Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.brand }}>Report Issue</Text></Pressable>
                              <Pressable style={styles.actionBtn}><CheckCircle size={14} color="#10B981" /><Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981' }}>Transfer</Text></Pressable>
                            </View>
                          </View>
                        )}
                      </Card>
                    </Pressable>
                  );
                })}
              </>
            )}

            {activeTab === 'maintenance' && (
              <>
                <SectionTitle>Maintenance Requests</SectionTitle>
                {MAINTENANCE_LOG.map(m => (
                  <Card key={m.id} style={{ padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>{m.asset}</Text>
                      <View style={[styles.statusBadge, m.status === 'completed' ? styles.statusResolved : m.status === 'in_progress' ? styles.statusProgress : styles.statusPending]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: m.status === 'completed' ? '#10B981' : m.status === 'in_progress' ? '#3B82F6' : '#F59E0B' }}>{m.status.replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>Issue: {m.issue}</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>📅 {m.date}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>👤 {m.technician}</Text>
                    </View>
                  </Card>
                ))}
              </>
            )}

            {activeTab === 'report' && (
              <>
                <Card style={{ padding: 16, gap: 12 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: theme.colors.text }}>Asset Summary</Text>
                  <View style={{ gap: 8 }}>
                    {Object.entries(stats).map(([key, val]) => (
                      <View key={key} style={styles.summaryRow}>
                        <Text style={{ fontSize: 13, color: theme.colors.muted, textTransform: 'capitalize' }}>{key}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.text }}>{val}</Text>
                      </View>
                    ))}
                  </View>
                </Card>

                <Card style={{ padding: 16, gap: 12 }}>
                  <Text style={{ fontWeight: '700', color: theme.colors.text }}>By Category</Text>
                  {CATEGORIES.filter(c => c !== 'All').map(c => {
                    const count = ASSETS.filter(a => a.category === c).length;
                    return (
                      <View key={c} style={styles.summaryRow}>
                        <Text style={{ fontSize: 13, color: theme.colors.muted, flexShrink: 1 }} numberOfLines={1}>{c}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.miniBar, { width: Math.min(count * 30, 120) }]} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>{count}</Text>
                        </View>
                      </View>
                    );
                  })}
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
  hero: { marginBottom: 0 },
  heroGrad: { paddingHorizontal: 16, paddingVertical: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', gap: 10 },
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
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  filterActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  assetIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: theme.colors.brandTertiary, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: theme.colors.muted },
  detailValue: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  statusResolved: { backgroundColor: '#10B98115' },
  statusProgress: { backgroundColor: '#3B82F615' },
  statusPending: { backgroundColor: '#F59E0B15' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  miniBar: { height: 8, borderRadius: 4, backgroundColor: theme.colors.brand + '30' },
});
