import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { router } from '@/src/navigation/router';
import type { Hostel, Grievance, HostelAllocation, GatePass, ParentDashboardData } from '@/src/types';
import {
  ArrowLeft,
  Building2,
  Bed,
  UtensilsCrossed,
  Wrench,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Shield,
  DoorOpen,
  Send,
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  GraduationCap,
  Sparkles,
  QrCode,
  Calendar,
} from 'lucide-react-native';
import Animated, { FadeInUp, SlideInRight } from 'react-native-reanimated';
import { EmptyState } from '@/src/ui';

const MESS_MENU: Record<string, { label: string; time: string; items: string[]; icon: string }> = {
  breakfast: { label: 'Breakfast', time: '7:30 - 9:00 AM', items: ['Poha & Hot Tea', 'Bread Butter Jam', 'Cornflakes & Milk', 'Idli Sambar', 'Boiled Eggs / Toast'], icon: '🌅' },
  lunch: { label: 'Lunch', time: '12:30 - 2:00 PM', items: ['Steamed Rice, Dal Tadka, Aloo Gobi', 'Warm Chapatis, Paneer Butter Masala', 'Curd Rice, Papad & Pickle', 'Seasonal Salad'], icon: '☀️' },
  snacks: { label: 'Snacks', time: '4:30 - 5:30 PM', items: ['Crispy Samosa & Mint Chutney', 'Biscuits & Filter Coffee/Tea', 'Assorted Pakoras'], icon: '🍵' },
  dinner: { label: 'Dinner', time: '7:30 - 9:00 PM', items: ['Jeera Rice, Punjabi Rajma', 'Tandoori Roti, Chicken Curry / Shahi Paneer', 'Veg Dum Biryani with Raita', 'Sweet: Gulab Jamun'], icon: '🌙' },
};

const COMPLAINT_CATEGORIES = ['Plumbing', 'Electrical', 'Furniture', 'Cleanliness', 'Network/WiFi', 'Security', 'Mess', 'Other'];
const AMENITIES_LIST = ['WiFi', 'Power Backup', 'AC', 'Mess', 'Laundry', 'Gym', 'Hot Water', 'CCTV', 'Common Room'];

export default function HostelManagementScreen() {
  const { user } = useAuth();
  const isAdmin = ['college_admin', 'super_admin'].includes(user?.role || '');
  const isParent = user?.role === 'parent';

  // Tabs
  // Admin: 'hostels' | 'allocations' | 'gatepasses' | 'maintenance' | 'mess'
  // Student: 'myroom' | 'overview' | 'gatepass' | 'complaints' | 'mess'
  // Parent: 'myroom' | 'gatepass' | 'mess'
  const defaultTab = isAdmin ? 'hostels' : 'myroom';
  const [tab, setTab] = useState<string>(defaultTab);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedHostel, setExpandedHostel] = useState<string | null>(null);

  // Student Gate Pass Form Modal
  const [showGatePassModal, setShowGatePassModal] = useState(false);
  const [gateReason, setGateReason] = useState('');
  const [gateDestination, setGateDestination] = useState('');
  const [gateOutTime, setGateOutTime] = useState('');
  const [gateReturn, setGateReturn] = useState('');

  // Student Complaint Modal
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [compTitle, setCompTitle] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compCategory, setCompCategory] = useState('Plumbing');
  const [compPriority, setCompPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Admin Hostel Create/Edit Modal
  const [showHostelModal, setShowHostelModal] = useState(false);
  const [editHostelId, setEditHostelId] = useState<string | null>(null);
  const [hostelName, setHostelName] = useState('');
  const [hostelType, setHostelType] = useState('Boys');
  const [hostelRooms, setHostelRooms] = useState('50');
  const [hostelWarden, setHostelWarden] = useState('');
  const [hostelContact, setHostelContact] = useState('');
  const [hostelAmenities, setHostelAmenities] = useState<string[]>(['WiFi', 'Power Backup', 'Mess', 'Hot Water']);

  // Admin Assign Bed Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignHostelId, setAssignHostelId] = useState('');
  const [assignStudentQuery, setAssignStudentQuery] = useState('');
  const [assignRoom, setAssignRoom] = useState('');
  const [assignBed, setAssignBed] = useState('Bed A');

  // API Data
  const { data: hostels, loading: hostelsLoading, refresh: refreshHostels } = useFetch<Hostel[]>('/hostels');
  const { data: allocations, loading: allocsLoading, refresh: refreshAllocs } = useFetch<HostelAllocation[]>('/hostel/allocations');
  const { data: gatePasses, loading: gateLoading, refresh: refreshGatePasses } = useFetch<GatePass[]>('/gate-passes');
  const { data: grievances, loading: grievLoading, refresh: refreshGrievances } = useFetch<Grievance[]>('/grievances');
  const { data: parentData, refresh: refreshParent } = useFetch<ParentDashboardData>(isParent ? '/parent/dashboard' : null);

  const { mutate: createHostelApi, loading: savingHostel } = useMutate();
  const { mutate: deleteHostelApi, loading: deletingHostel } = useMutate();
  const { mutate: assignBedApi, loading: assigningBed } = useMutate();
  const { mutate: deallocateApi, loading: deallocating } = useMutate();
  const { mutate: gatePassSubmitApi, loading: submittingGatePass } = useMutate();
  const { mutate: gatePassReviewApi, loading: reviewingGatePass } = useMutate();
  const { mutate: submitComplaintApi, loading: submittingComp } = useMutate();
  const { mutate: updateComplaintApi, loading: updatingComp } = useMutate();

  const hostelsSafe = useMemo(() => (Array.isArray(hostels) ? hostels : []), [hostels]);
  const allocsSafe = useMemo(() => (Array.isArray(allocations) ? allocations : []), [allocations]);
  const gatePassesSafe = useMemo(() => (Array.isArray(gatePasses) ? gatePasses : []), [gatePasses]);
  const grievancesSafe = useMemo(() => (Array.isArray(grievances) ? grievances : []), [grievances]);

  // Active student allocation
  const myAlloc = useMemo(() => {
    if (!allocsSafe.length) return null;
    return allocsSafe.find((a) => a.active) || allocsSafe[0];
  }, [allocsSafe]);

  const allocatedHostel = useMemo(() => {
    if (!myAlloc) return null;
    return hostelsSafe.find((h) => h.id === myAlloc.hostel_id || (h as any)._id === myAlloc.hostel_id) || null;
  }, [myAlloc, hostelsSafe]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshHostels(),
      refreshAllocs(),
      refreshGatePasses(),
      refreshGrievances(),
      isParent && refreshParent ? refreshParent() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [refreshHostels, refreshAllocs, refreshGatePasses, refreshGrievances, refreshParent, isParent]);

  // Filtered Hostels
  const filteredHostels = useMemo(() => {
    return hostelsSafe.filter((h) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        h.name.toLowerCase().includes(q) ||
        h.type.toLowerCase().includes(q) ||
        h.warden_name.toLowerCase().includes(q)
      );
    });
  }, [hostelsSafe, search]);

  // Overall Stats
  const totalHostels = hostelsSafe.length;
  const totalRooms = hostelsSafe.reduce((s, h) => s + (h.total_rooms || 0), 0);
  const occupiedBeds = allocsSafe.filter((a) => a.active).length;
  const pendingGatePasses = gatePassesSafe.filter((g) => g.status === 'pending');
  const openComplaints = grievancesSafe.filter((g) => g.status === 'open' || g.status === 'in_progress');

  // Handlers
  const handleOpenAddHostel = () => {
    setEditHostelId(null);
    setHostelName('');
    setHostelType('Boys');
    setHostelRooms('50');
    setHostelWarden('');
    setHostelContact('');
    setHostelAmenities(['WiFi', 'Power Backup', 'Mess', 'Hot Water']);
    setShowHostelModal(true);
  };

  const handleOpenEditHostel = (h: Hostel) => {
    setEditHostelId(h.id);
    setHostelName(h.name);
    setHostelType(h.type || 'Boys');
    setHostelRooms(String(h.total_rooms || 50));
    setHostelWarden(h.warden_name || '');
    setHostelContact(h.contact || '');
    setHostelAmenities(h.amenities || ['WiFi', 'Power Backup']);
    setShowHostelModal(true);
  };

  const handleSaveHostel = async () => {
    if (!hostelName.trim()) {
      Alert.alert('Missing Field', 'Hostel name is required.');
      return;
    }
    const payload = {
      name: hostelName.trim(),
      type: hostelType,
      total_rooms: parseInt(hostelRooms, 10) || 50,
      warden_name: hostelWarden.trim(),
      contact: hostelContact.trim(),
      amenities: hostelAmenities,
    };
    try {
      if (editHostelId) {
        await createHostelApi(`/hostels/${editHostelId}`, { method: 'PUT', body: JSON.stringify(payload) });
        Alert.alert('Updated', 'Hostel details updated.');
      } else {
        await createHostelApi('/hostels', { method: 'POST', body: JSON.stringify(payload) });
        Alert.alert('Created', 'New hostel block added.');
      }
      setShowHostelModal(false);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save hostel.');
    }
  };

  const handleDeleteHostel = (h: Hostel) => {
    Alert.alert('Delete Hostel', `Are you sure you want to remove "${h.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHostelApi(`/hostels/${h.id}`, { method: 'DELETE' });
            Alert.alert('Deleted', 'Hostel removed.');
            onRefresh();
          } catch (e: any) {
            Alert.alert('Cannot Delete', e?.message || 'Hostel has active resident allocations.');
          }
        },
      },
    ]);
  };

  const handleAdminAssignBed = async () => {
    if (!assignHostelId || !assignStudentQuery.trim() || !assignRoom.trim()) {
      Alert.alert('Missing Info', 'Please select hostel, enter student ID, and specify room number.');
      return;
    }
    try {
      await assignBedApi('/hostel/allocations/admin-assign', {
        method: 'POST',
        body: JSON.stringify({
          hostel_id: assignHostelId,
          student_id: assignStudentQuery.trim(),
          room: assignRoom.trim(),
          bed: assignBed,
        }),
      });
      setShowAssignModal(false);
      setAssignStudentQuery('');
      setAssignRoom('');
      Alert.alert('Success', 'Student allocated to room successfully.');
      onRefresh();
    } catch (e: any) {
      Alert.alert('Allocation Failed', e?.message || 'Could not allocate room.');
    }
  };

  const handleDeallocate = (alloc: HostelAllocation) => {
    Alert.alert('Deallocate Student', `Vacate room for ${alloc.student_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Vacate Bed',
        style: 'destructive',
        onPress: async () => {
          try {
            await deallocateApi(`/hostels/${alloc.hostel_id}/deallocate`, {
              method: 'POST',
              body: JSON.stringify({ student_id: alloc.student_id }),
            });
            Alert.alert('Vacated', 'Room deallocated successfully.');
            onRefresh();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not vacate bed.');
          }
        },
      },
    ]);
  };

  const handleApplyGatePass = async () => {
    if (!gateReason.trim() || !gateOutTime.trim()) {
      Alert.alert('Missing Info', 'Reason and Out Time are required.');
      return;
    }
    try {
      await gatePassSubmitApi('/gate-passes', {
        method: 'POST',
        body: JSON.stringify({
          hostel_id: myAlloc?.hostel_id || hostelsSafe[0]?.id || '',
          reason: gateReason.trim(),
          destination: gateDestination.trim(),
          out_time: gateOutTime.trim(),
          expected_return: gateReturn.trim(),
        }),
      });
      setShowGatePassModal(false);
      setGateReason('');
      setGateDestination('');
      setGateOutTime('');
      setGateReturn('');
      Alert.alert('Submitted', 'Gate pass request sent to Warden for authorization.');
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit gate pass.');
    }
  };

  const handleReviewGatePass = async (passId: string, approve: boolean) => {
    try {
      const endpoint = approve ? `/gate-passes/${passId}/approve` : `/gate-passes/${passId}/reject`;
      await gatePassReviewApi(endpoint, { method: 'POST', body: JSON.stringify({ review_note: approve ? 'Authorized' : 'Declined' }) });
      Alert.alert(approve ? 'Approved' : 'Rejected', `Gate pass request has been ${approve ? 'approved' : 'rejected'}.`);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Action Failed', e?.message || 'Could not update gate pass.');
    }
  };

  const handleSubmitComplaint = async () => {
    if (!compTitle.trim() || !compDesc.trim()) {
      Alert.alert('Missing Info', 'Please provide a title and description for maintenance.');
      return;
    }
    try {
      await submitComplaintApi('/grievances', {
        method: 'POST',
        body: JSON.stringify({
          category: 'hostel',
          subject: `[${compCategory}] ${compTitle.trim()}`,
          description: compDesc.trim(),
          priority: compPriority,
        }),
      });
      setShowComplaintModal(false);
      setCompTitle('');
      setCompDesc('');
      Alert.alert('Ticket Lodged', 'Maintenance ticket submitted. Campus staff has been notified.');
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not lodge ticket.');
    }
  };

  const handleResolveComplaint = async (c: Grievance) => {
    try {
      await updateComplaintApi(`/grievances/${c.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'resolved', note: 'Issue inspected and fixed.' }),
      });
      Alert.alert('Resolved', 'Maintenance ticket closed.');
      onRefresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not resolve ticket.');
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            testID="back-btn"
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {isAdmin ? 'Hostel Executive Center' : isParent ? 'Ward Residence' : 'Hostel & Residential Life'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isAdmin
                ? 'Hostels, allocations, gate pass approvals & repairs'
                : isParent
                ? 'Hostel room status, warden contact & gate pass history'
                : 'Room allocations, gate pass desk, maintenance & mess'}
            </Text>
          </View>
          {isAdmin && (
            <Pressable
              testID="admin-add-hostel-btn"
              onPress={handleOpenAddHostel}
              style={styles.headerActionBtn}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.headerActionText}>Add Hostel</Text>
            </Pressable>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          {/* 1. ADMIN HERO KPI GRID */}
          {isAdmin && (
            <Animated.View entering={FadeInUp.duration(350)}>
              <View style={styles.kpiGrid}>
                <View style={[styles.kpiCard, { borderColor: 'rgba(99, 102, 241, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
                    <Building2 size={18} color="#6366F1" />
                  </View>
                  <Text style={styles.kpiValue}>{totalHostels}</Text>
                  <Text style={styles.kpiLabel}>Hostel Blocks</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <Bed size={18} color="#10B981" />
                  </View>
                  <Text style={styles.kpiValue}>{occupiedBeds} / {totalRooms * 2}</Text>
                  <Text style={styles.kpiLabel}>Occupied Beds</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(245, 158, 11, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                    <DoorOpen size={18} color="#F59E0B" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#D97706' }]}>{pendingGatePasses.length}</Text>
                  <Text style={styles.kpiLabel}>Pending Gate Passes</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Wrench size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#EF4444' }]}>{openComplaints.length}</Text>
                  <Text style={styles.kpiLabel}>Open Repairs</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* 2. STUDENT / PARENT HERO RESIDENCE CARD */}
          {!isAdmin && (
            <Animated.View entering={FadeInUp.duration(350)}>
              <LinearGradient
                colors={['#0F766E', '#0D9488', '#14B8A6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.residenceHeroCard}
              >
                <View style={styles.residenceBadgePill}>
                  <Shield size={14} color="#CCFBF1" />
                  <Text style={styles.residenceBadgeText}>
                    {isParent ? "WARD'S RESIDENTIAL QUARTERS" : 'ACTIVE ALLOCATION'}
                  </Text>
                </View>

                <Text style={styles.residenceHostelName}>
                  {allocatedHostel?.name || myAlloc?.hostel_name || 'Campus Residence Block A'}
                </Text>
                <Text style={styles.residenceRoomSub}>
                  Room {myAlloc?.room_number || 'Room 304'} • Bed {myAlloc?.student_id?.slice(-1) || 'A'}
                </Text>

                <View style={styles.residenceFooterRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wardenNameText}>
                      Warden: {allocatedHostel?.warden_name || 'Dr. R. Sharma'}
                    </Text>
                    <Text style={styles.wardenContactText}>
                      Contact: {allocatedHostel?.contact || '+91 98765 43210'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => Linking.openURL(`tel:${allocatedHostel?.contact || '9876543210'}`)}
                    style={styles.callWardenBtn}
                  >
                    <Phone size={14} color="#0D9488" />
                    <Text style={styles.callWardenBtnText}>Call Warden</Text>
                  </Pressable>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {/* 3. SEGMENTED TABS */}
          <View style={styles.tabBar}>
            {isAdmin ? (
              <>
                <Pressable testID="tab-hostels" onPress={() => setTab('hostels')} style={[styles.tabItem, tab === 'hostels' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'hostels' && styles.tabItemTextActive]}>Hostels</Text>
                </Pressable>
                <Pressable testID="tab-allocations" onPress={() => setTab('allocations')} style={[styles.tabItem, tab === 'allocations' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'allocations' && styles.tabItemTextActive]}>Allocations</Text>
                </Pressable>
                <Pressable testID="tab-gatepasses" onPress={() => setTab('gatepasses')} style={[styles.tabItem, tab === 'gatepasses' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'gatepasses' && styles.tabItemTextActive]}>
                    Gate Passes ({pendingGatePasses.length})
                  </Text>
                </Pressable>
                <Pressable testID="tab-maintenance" onPress={() => setTab('maintenance')} style={[styles.tabItem, tab === 'maintenance' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'maintenance' && styles.tabItemTextActive]}>Repairs</Text>
                </Pressable>
                <Pressable testID="tab-mess" onPress={() => setTab('mess')} style={[styles.tabItem, tab === 'mess' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'mess' && styles.tabItemTextActive]}>Mess Menu</Text>
                </Pressable>
              </>
            ) : isParent ? (
              <>
                <Pressable testID="tab-myroom" onPress={() => setTab('myroom')} style={[styles.tabItem, tab === 'myroom' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'myroom' && styles.tabItemTextActive]}>Residence Info</Text>
                </Pressable>
                <Pressable testID="tab-gatepass" onPress={() => setTab('gatepass')} style={[styles.tabItem, tab === 'gatepass' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'gatepass' && styles.tabItemTextActive]}>Ward Gate Passes</Text>
                </Pressable>
                <Pressable testID="tab-mess" onPress={() => setTab('mess')} style={[styles.tabItem, tab === 'mess' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'mess' && styles.tabItemTextActive]}>Mess Menu</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable testID="tab-myroom" onPress={() => setTab('myroom')} style={[styles.tabItem, tab === 'myroom' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'myroom' && styles.tabItemTextActive]}>My Room</Text>
                </Pressable>
                <Pressable testID="tab-gatepass" onPress={() => setTab('gatepass')} style={[styles.tabItem, tab === 'gatepass' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'gatepass' && styles.tabItemTextActive]}>Gate Pass</Text>
                </Pressable>
                <Pressable testID="tab-complaints" onPress={() => setTab('complaints')} style={[styles.tabItem, tab === 'complaints' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'complaints' && styles.tabItemTextActive]}>Maintenance</Text>
                </Pressable>
                <Pressable testID="tab-mess" onPress={() => setTab('mess')} style={[styles.tabItem, tab === 'mess' && styles.tabItemActive]}>
                  <Text style={[styles.tabItemText, tab === 'mess' && styles.tabItemTextActive]}>Mess Menu</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ════════════════════════════════════════════════════════════
              TAB: HOSTELS & ROOMS (ADMIN)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'hostels' && isAdmin && (
            <View>
              {/* Search Bar */}
              <View style={styles.searchBox}>
                <Search size={18} color={theme.colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search hostels by name, warden, or type..."
                  placeholderTextColor={theme.colors.muted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>

              {hostelsLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : filteredHostels.length === 0 ? (
                <EmptyState icon={<Building2 size={48} color={theme.colors.muted} />} title="No Hostels Configured" sub="Tap Add Hostel to create residential blocks." />
              ) : (
                <View style={styles.cardList}>
                  {filteredHostels.map((h) => {
                    const isExpanded = expandedHostel === h.id;
                    const occupancy = h.occupied || 0;
                    const totalCap = (h.total_rooms || 0) * 2;
                    const pct = totalCap > 0 ? Math.min(100, Math.round((occupancy / totalCap) * 100)) : 0;
                    return (
                      <View key={h.id} style={styles.hostelCard}>
                        <Pressable onPress={() => setExpandedHostel(isExpanded ? null : h.id)}>
                          <View style={styles.hostelCardTop}>
                            <View style={styles.hostelIconWrap}>
                              <Building2 size={22} color="#0D9488" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.hostelName}>{h.name}</Text>
                              <Text style={styles.hostelWardenText}>Warden: {h.warden_name || 'Assigned Staff'} • {h.contact}</Text>
                              <View style={styles.hostelPillsRow}>
                                <View style={[styles.typeBadge, { backgroundColor: h.type === 'Boys' ? 'rgba(99,102,241,0.1)' : 'rgba(236,72,153,0.1)' }]}>
                                  <Text style={[styles.typeBadgeText, { color: h.type === 'Boys' ? '#6366F1' : '#EC4899' }]}>
                                    {h.type} Hostel
                                  </Text>
                                </View>
                                <Text style={styles.roomCountText}>{h.total_rooms} Rooms ({totalCap} Beds)</Text>
                              </View>
                            </View>

                            <View style={styles.hostelCardActions}>
                              <Pressable onPress={() => handleOpenEditHostel(h)} style={styles.iconActionBtn}>
                                <Pencil size={15} color={theme.colors.muted} />
                              </Pressable>
                              <Pressable onPress={() => handleDeleteHostel(h)} style={styles.iconActionBtn}>
                                <Trash2 size={15} color="#EF4444" />
                              </Pressable>
                            </View>
                          </View>

                          {/* Occupancy Progress Bar */}
                          <View style={styles.occupancyBarContainer}>
                            <View style={styles.occupancyBarHeader}>
                              <Text style={styles.occupancyLabel}>Occupancy Rate</Text>
                              <Text style={styles.occupancyPct}>{pct}% Filled</Text>
                            </View>
                            <View style={styles.occupancyTrack}>
                              <View style={[styles.occupancyFill, { width: `${pct}%` }]} />
                            </View>
                          </View>
                        </Pressable>

                        {isExpanded && (
                          <View style={styles.hostelAmenitiesBox}>
                            <Text style={styles.amenitiesTitle}>Amenities Provided:</Text>
                            <View style={styles.amenitiesGrid}>
                              {(h.amenities || AMENITIES_LIST.slice(0, 5)).map((item) => (
                                <View key={item} style={styles.amenityTag}>
                                  <CheckCircle2 size={12} color="#059669" />
                                  <Text style={styles.amenityTagText}>{item}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: ALLOCATIONS (ADMIN)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'allocations' && isAdmin && (
            <View>
              <View style={styles.circulationHeaderBar}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Resident Student Allocations</Text>
                  <Text style={styles.sectionHeaderSub}>
                    {allocsSafe.filter((a) => a.active).length} students actively staying in campus hostels
                  </Text>
                </View>
                <Pressable
                  testID="assign-bed-modal-trigger"
                  onPress={() => {
                    setAssignHostelId(hostelsSafe[0]?.id || '');
                    setAssignStudentQuery('');
                    setAssignRoom('');
                    setShowAssignModal(true);
                  }}
                  style={styles.adminIssueBtnSmall}
                >
                  <Plus size={14} color="#FFFFFF" />
                  <Text style={styles.adminIssueBtnTextSmall}>Assign Bed</Text>
                </Pressable>
              </View>

              {allocsLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : allocsSafe.length === 0 ? (
                <EmptyState icon={<Bed size={48} color={theme.colors.muted} />} title="No Active Allocations" sub="Assign students to rooms using the Assign Bed button." />
              ) : (
                <View style={styles.cardList}>
                  {allocsSafe.map((alloc) => (
                    <View key={alloc.id} style={styles.allocCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.allocStudentName}>{alloc.student_name}</Text>
                        <Text style={styles.allocMeta}>
                          {alloc.hostel_name} • Room {alloc.room_number} • Roll: {alloc.student_id}
                        </Text>
                        <Text style={styles.allocDate}>Allocated: {alloc.allocated_at || 'Current Term'}</Text>
                      </View>

                      <Pressable
                        onPress={() => handleDeallocate(alloc)}
                        style={styles.vacateBtn}
                      >
                        <DoorOpen size={14} color="#DC2626" />
                        <Text style={styles.vacateBtnText}>Vacate</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: GATE PASSES (ADMIN & STUDENT & PARENT)
             ════════════════════════════════════════════════════════════ */}
          {(tab === 'gatepasses' || tab === 'gatepass') && (
            <View>
              <View style={styles.circulationHeaderBar}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>
                    {isAdmin ? 'Campus Gate Pass Desk' : isParent ? "Ward's Gate Pass History" : 'Digital Outing & Gate Passes'}
                  </Text>
                  <Text style={styles.sectionHeaderSub}>
                    {isAdmin
                      ? `${pendingGatePasses.length} pending request(s) awaiting approval`
                      : 'Request night-out, day outings and campus exit permissions'}
                  </Text>
                </View>

                {!isAdmin && !isParent && (
                  <Pressable
                    testID="request-gate-pass-btn"
                    onPress={() => setShowGatePassModal(true)}
                    style={styles.adminIssueBtnSmall}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.adminIssueBtnTextSmall}>Request Pass</Text>
                  </Pressable>
                )}
              </View>

              {gateLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : gatePassesSafe.length === 0 ? (
                <EmptyState icon={<DoorOpen size={48} color={theme.colors.muted} />} title="No Gate Passes Found" sub="Submitted gate pass requests will be tracked here." />
              ) : (
                <View style={styles.cardList}>
                  {gatePassesSafe.map((gp) => {
                    const isPending = gp.status === 'pending';
                    const isApproved = gp.status === 'approved';
                    return (
                      <View key={gp.id} style={styles.gatePassCard}>
                        <View style={styles.gatePassCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.gatePassReason}>{gp.reason}</Text>
                            <Text style={styles.gatePassStudent}>
                              {isAdmin ? `Student: ${gp.student_name}` : `Destination: ${gp.destination || 'Home'}`}
                            </Text>
                            <Text style={styles.gatePassTime}>
                              Out: {gp.out_time} • Expected Return: {gp.expected_return || 'Same Day'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.gpStatusBadge,
                              {
                                backgroundColor: isApproved
                                  ? 'rgba(16, 185, 129, 0.1)'
                                  : isPending
                                  ? 'rgba(245, 158, 11, 0.1)'
                                  : 'rgba(239, 68, 68, 0.1)',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.gpStatusText,
                                {
                                  color: isApproved ? '#059669' : isPending ? '#D97706' : '#DC2626',
                                },
                              ]}
                            >
                              {gp.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {/* Admin Action Bar */}
                        {isAdmin && isPending && (
                          <View style={styles.adminGpActionRow}>
                            <Pressable
                              testID={`approve-gp-${gp.id}`}
                              onPress={() => handleReviewGatePass(gp.id, true)}
                              style={styles.approveBtn}
                            >
                              <CheckCircle2 size={14} color="#FFFFFF" />
                              <Text style={styles.approveBtnText}>Approve & Issue</Text>
                            </Pressable>

                            <Pressable
                              onPress={() => handleReviewGatePass(gp.id, false)}
                              style={styles.rejectBtn}
                            >
                              <X size={14} color="#DC2626" />
                              <Text style={styles.rejectBtnText}>Decline</Text>
                            </Pressable>
                          </View>
                        )}

                        {/* Student QR security verification pass */}
                        {!isAdmin && isApproved && (
                          <View style={styles.qrPassBanner}>
                            <QrCode size={16} color="#047857" />
                            <Text style={styles.qrPassText}>Digital Security Pass Active • Show to Security Guard at Main Gate</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: MAINTENANCE & REPAIRS (ADMIN & STUDENT)
             ════════════════════════════════════════════════════════════ */}
          {(tab === 'maintenance' || tab === 'complaints') && (
            <View>
              <View style={styles.circulationHeaderBar}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Facility Repairs & Maintenance</Text>
                  <Text style={styles.sectionHeaderSub}>
                    {isAdmin ? 'Resolve electrical, plumbing & infrastructure issues' : 'Lodge repair tickets for room or common areas'}
                  </Text>
                </View>

                {!isAdmin && (
                  <Pressable
                    testID="lodge-ticket-btn"
                    onPress={() => setShowComplaintModal(true)}
                    style={styles.adminIssueBtnSmall}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.adminIssueBtnTextSmall}>Lodge Ticket</Text>
                  </Pressable>
                )}
              </View>

              {grievLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : grievancesSafe.length === 0 ? (
                <EmptyState icon={<Wrench size={48} color={theme.colors.muted} />} title="No Maintenance Tickets" sub="All facilities in clean working order." />
              ) : (
                <View style={styles.cardList}>
                  {grievancesSafe.map((g) => {
                    const isResolved = g.status === 'resolved' || g.status === 'closed';
                    return (
                      <View key={g.id} style={styles.grievanceCard}>
                        <View style={styles.grievanceCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.grievanceSubject}>{g.subject}</Text>
                            <Text style={styles.grievanceDesc} numberOfLines={3}>{g.description}</Text>
                            <Text style={styles.grievanceMeta}>Priority: {(g.priority || 'medium').toUpperCase()} • Lodged: {(g.createdAt || g.created_at || '').slice(0, 10)}</Text>
                          </View>

                          <View style={[styles.priorityPill, { backgroundColor: isResolved ? '#ECFDF5' : '#FEF2F2' }]}>
                            <Text style={[styles.priorityText, { color: isResolved ? '#059669' : '#DC2626' }]}>
                              {g.status.toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        {isAdmin && !isResolved && (
                          <View style={styles.resolveActionRow}>
                            <Pressable
                              testID={`resolve-ticket-${g.id}`}
                              onPress={() => handleResolveComplaint(g)}
                              style={styles.resolveBtn}
                            >
                              <CheckCircle2 size={14} color="#047857" />
                              <Text style={styles.resolveBtnText}>Mark Resolved</Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: MY ROOM (STUDENT / PARENT)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'myroom' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>Room & Residence Details</Text>
                <Text style={styles.sectionHeaderSub}>Hostel amenities, roommates and safety protocol</Text>
              </View>

              <View style={styles.roommateCard}>
                <View style={styles.roommateCardHeader}>
                  <Users size={18} color="#0D9488" />
                  <Text style={styles.roommateCardTitle}>Roommates & Peers (Room {myAlloc?.room_number || '304'})</Text>
                </View>
                <View style={styles.roommateItem}>
                  <View style={styles.roommateAvatar}><Text style={styles.roommateAvatarText}>A</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roommateName}>{user?.name || 'Primary Resident'} (You)</Text>
                    <Text style={styles.roommateRole}>Bed A • {user?.department || 'Computer Science'}</Text>
                  </View>
                </View>
                <View style={styles.roommateItem}>
                  <View style={[styles.roommateAvatar, { backgroundColor: '#EEF2FF' }]}><Text style={[styles.roommateAvatarText, { color: '#6366F1' }]}>R</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roommateName}>Rahul Mehta</Text>
                    <Text style={styles.roommateRole}>Bed B • Electronics & Comm.</Text>
                  </View>
                </View>
              </View>

              {/* Quick SOS Contacts */}
              <View style={styles.sosCard}>
                <Text style={styles.sosTitle}>Campus Emergency Contacts</Text>
                <View style={styles.sosRow}>
                  <Pressable onPress={() => Linking.openURL('tel:100')} style={styles.sosBtn}>
                    <Phone size={14} color="#DC2626" />
                    <Text style={styles.sosBtnText}>Campus Security</Text>
                  </Pressable>
                  <Pressable onPress={() => Linking.openURL('tel:108')} style={styles.sosBtn}>
                    <Phone size={14} color="#047857" />
                    <Text style={styles.sosBtnText}>Health Clinic</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: MESS MENU (ALL ROLES)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'mess' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>Today's Dining & Mess Schedule</Text>
                <Text style={styles.sectionHeaderSub}>Nutrition standards certified by campus food committee</Text>
              </View>

              <View style={styles.messGrid}>
                {Object.entries(MESS_MENU).map(([key, item]) => (
                  <View key={key} style={styles.messCard}>
                    <View style={styles.messCardHeader}>
                      <Text style={styles.messIcon}>{item.icon}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.messMealLabel}>{item.label}</Text>
                        <Text style={styles.messMealTime}>{item.time}</Text>
                      </View>
                    </View>
                    <View style={styles.messDivider} />
                    <View style={styles.messItemList}>
                      {item.items.map((dish, i) => (
                        <View key={i} style={styles.messItemRow}>
                          <Text style={styles.messItemBullet}>•</Text>
                          <Text style={styles.messItemName}>{dish}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ════════════════════════════════════════════════════════════
            ADMIN: ADD / EDIT HOSTEL MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showHostelModal} transparent animationType="slide" onRequestClose={() => setShowHostelModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editHostelId ? 'Edit Hostel Details' : 'Add New Hostel Block'}</Text>
                <Pressable onPress={() => setShowHostelModal(false)} style={styles.closeBtn}><X size={20} color={theme.colors.muted} /></Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }}>
                <Text style={styles.inputLabel}>Hostel Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. Aryabhata Hall of Residence" placeholderTextColor={theme.colors.muted} value={hostelName} onChangeText={setHostelName} />

                <Text style={styles.inputLabel}>Hostel Type</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  {['Boys', 'Girls', 'Co-Ed'].map((t) => (
                    <Pressable key={t} onPress={() => setHostelType(t)} style={[styles.typeSelectBtn, hostelType === t && styles.typeSelectBtnActive]}>
                      <Text style={[styles.typeSelectText, hostelType === t && styles.typeSelectTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Total Rooms</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="50" placeholderTextColor={theme.colors.muted} value={hostelRooms} onChangeText={setHostelRooms} />

                <Text style={styles.inputLabel}>Warden Name</Text>
                <TextInput style={styles.input} placeholder="Dr. S. K. Verma" placeholderTextColor={theme.colors.muted} value={hostelWarden} onChangeText={setHostelWarden} />

                <Text style={styles.inputLabel}>Warden Emergency Phone</Text>
                <TextInput style={styles.input} keyboardType="phone-pad" placeholder="+91 98765 43210" placeholderTextColor={theme.colors.muted} value={hostelContact} onChangeText={setHostelContact} />
              </ScrollView>

              <Pressable testID="submit-hostel-form-btn" disabled={savingHostel} onPress={handleSaveHostel} style={styles.submitBtn}>
                {savingHostel ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{editHostelId ? 'Update Hostel' : 'Create Hostel'}</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════
            ADMIN: ASSIGN BED MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showAssignModal} transparent animationType="slide" onRequestClose={() => setShowAssignModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign Room & Bed to Student</Text>
                <Pressable onPress={() => setShowAssignModal(false)} style={styles.closeBtn}><X size={20} color={theme.colors.muted} /></Pressable>
              </View>

              <Text style={styles.inputLabel}>Select Hostel Block *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {hostelsSafe.map((h) => (
                  <Pressable key={h.id} onPress={() => setAssignHostelId(h.id)} style={[styles.modalChip, assignHostelId === h.id && styles.modalChipActive]}>
                    <Text style={[styles.modalChipText, assignHostelId === h.id && styles.modalChipTextActive]}>{h.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Student Roll Number or ID *</Text>
              <TextInput testID="assign-student-input" style={styles.input} placeholder="Enter student roll (e.g., CS-104)" placeholderTextColor={theme.colors.muted} value={assignStudentQuery} onChangeText={setAssignStudentQuery} />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Room Number *</Text>
                  <TextInput testID="assign-room-input" style={styles.input} placeholder="e.g. 204" placeholderTextColor={theme.colors.muted} value={assignRoom} onChangeText={setAssignRoom} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Bed</Text>
                  <TextInput style={styles.input} placeholder="Bed A" placeholderTextColor={theme.colors.muted} value={assignBed} onChangeText={setAssignBed} />
                </View>
              </View>

              <Pressable testID="confirm-assign-bed-btn" disabled={assigningBed} onPress={handleAdminAssignBed} style={styles.submitBtn}>
                {assigningBed ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Confirm Allocation</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════
            STUDENT: APPLY GATE PASS MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showGatePassModal} transparent animationType="slide" onRequestClose={() => setShowGatePassModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Request Campus Outing / Gate Pass</Text>
                <Pressable onPress={() => setShowGatePassModal(false)} style={styles.closeBtn}><X size={20} color={theme.colors.muted} /></Pressable>
              </View>

              <Text style={styles.inputLabel}>Reason for Outing *</Text>
              <TextInput testID="gate-reason-input" style={styles.input} placeholder="e.g., Weekend home visit, medical appointment" placeholderTextColor={theme.colors.muted} value={gateReason} onChangeText={setGateReason} />

              <Text style={styles.inputLabel}>Destination *</Text>
              <TextInput style={styles.input} placeholder="e.g., Home (Delhi) or City Hospital" placeholderTextColor={theme.colors.muted} value={gateDestination} onChangeText={setGateDestination} />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Out Time *</Text>
                  <TextInput style={styles.input} placeholder="05:00 PM Today" placeholderTextColor={theme.colors.muted} value={gateOutTime} onChangeText={setGateOutTime} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Expected Return *</Text>
                  <TextInput style={styles.input} placeholder="09:00 PM Tomorrow" placeholderTextColor={theme.colors.muted} value={gateReturn} onChangeText={setGateReturn} />
                </View>
              </View>

              <Pressable testID="submit-gatepass-request-btn" disabled={submittingGatePass} onPress={handleApplyGatePass} style={styles.submitBtn}>
                {submittingGatePass ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Submit to Warden</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════
            STUDENT: LODGE MAINTENANCE TICKET MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showComplaintModal} transparent animationType="slide" onRequestClose={() => setShowComplaintModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lodge Maintenance & Repair Ticket</Text>
                <Pressable onPress={() => setShowComplaintModal(false)} style={styles.closeBtn}><X size={20} color={theme.colors.muted} /></Pressable>
              </View>

              <Text style={styles.inputLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {COMPLAINT_CATEGORIES.map((c) => (
                  <Pressable key={c} onPress={() => setCompCategory(c)} style={[styles.modalChip, compCategory === c && styles.modalChipActive]}>
                    <Text style={[styles.modalChipText, compCategory === c && styles.modalChipTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Issue Summary *</Text>
              <TextInput testID="comp-title-input" style={styles.input} placeholder="e.g. Geyser not heating in Room 304" placeholderTextColor={theme.colors.muted} value={compTitle} onChangeText={setCompTitle} />

              <Text style={styles.inputLabel}>Detailed Description *</Text>
              <TextInput style={[styles.input, { height: 75, textAlignVertical: 'top' }]} multiline placeholder="Describe the fault clearly for the maintenance team" placeholderTextColor={theme.colors.muted} value={compDesc} onChangeText={setCompDesc} />

              <Pressable testID="submit-maintenance-ticket-btn" disabled={submittingComp} onPress={handleSubmitComplaint} style={styles.submitBtn}>
                {submittingComp ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitBtnText}>Dispatch Maintenance Ticket</Text>}
              </Pressable>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceSecondary,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.onSurface },
  headerSubtitle: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D9488',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
  },
  headerActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 48 },

  // Admin KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  kpiCard: {
    width: '48%',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    ...theme.shadow.xs,
  },
  kpiIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  kpiValue: { fontSize: 18, fontWeight: '900', color: theme.colors.onSurface },
  kpiLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  // Student/Parent Residence Hero Card
  residenceHeroCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: 16,
    ...theme.shadow.md,
  },
  residenceBadgePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, marginBottom: 10 },
  residenceBadgeText: { color: '#F0FDFA', fontSize: 10, fontWeight: '800' },
  residenceHostelName: { fontSize: 20, fontWeight: '900', color: '#FFFFFF' },
  residenceRoomSub: { fontSize: 13, color: '#CCFBF1', marginTop: 2, fontWeight: '600' },
  residenceFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  wardenNameText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  wardenContactText: { color: '#CCFBF1', fontSize: 11, marginTop: 1 },
  callWardenBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill },
  callWardenBtnText: { color: '#0D9488', fontSize: 11, fontWeight: '800' },

  // Segmented Tabs
  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, marginBottom: 16 },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.pill },
  tabItemActive: { backgroundColor: theme.colors.surfaceSecondary, ...theme.shadow.xs },
  tabItemText: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  tabItemTextActive: { fontWeight: '800', color: '#0D9488' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface, padding: 0 },

  cardList: { gap: 12 },
  hostelCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  hostelCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hostelIconWrap: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(13, 148, 136, 0.08)', alignItems: 'center', justifyContent: 'center' },
  hostelName: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  hostelWardenText: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  hostelPillsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeBadgeText: { fontSize: 10, fontWeight: '700' },
  roomCountText: { fontSize: 11, color: theme.colors.muted },
  hostelCardActions: { flexDirection: 'row', gap: 6 },
  iconActionBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },

  occupancyBarContainer: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  occupancyBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  occupancyLabel: { fontSize: 10, color: theme.colors.muted },
  occupancyPct: { fontSize: 10, fontWeight: '700', color: '#0D9488' },
  occupancyTrack: { height: 6, backgroundColor: theme.colors.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
  occupancyFill: { height: 6, backgroundColor: '#0D9488', borderRadius: 3 },

  hostelAmenitiesBox: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  amenitiesTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 6 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amenityTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  amenityTagText: { fontSize: 10, color: theme.colors.onSurface },

  // Allocation Card
  circulationHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionHeader: { marginBottom: 14 },
  sectionHeaderTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  sectionHeaderSub: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  adminIssueBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0D9488', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  adminIssueBtnTextSmall: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  allocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  allocStudentName: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  allocMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  allocDate: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  vacateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm },
  vacateBtnText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },

  // Gate Pass Card
  gatePassCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  gatePassCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  gatePassReason: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  gatePassStudent: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  gatePassTime: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  gpStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.pill },
  gpStatusText: { fontSize: 10, fontWeight: '800' },
  adminGpActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  approveBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm },
  rejectBtnText: { color: '#DC2626', fontSize: 11, fontWeight: '700' },
  qrPassBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm, marginTop: 10 },
  qrPassText: { fontSize: 11, color: '#047857', fontWeight: '700', flex: 1 },

  // Grievance / Maintenance
  grievanceCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  grievanceCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  grievanceSubject: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  grievanceDesc: { fontSize: 12, color: theme.colors.muted, marginTop: 3 },
  grievanceMeta: { fontSize: 10, color: theme.colors.muted, marginTop: 4 },
  priorityPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  priorityText: { fontSize: 10, fontWeight: '800' },
  resolveActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm },
  resolveBtnText: { color: '#047857', fontSize: 11, fontWeight: '700' },

  // Roommate Card
  roommateCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  roommateCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  roommateCardTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.onSurface },
  roommateItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  roommateAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  roommateAvatarText: { color: '#0F766E', fontSize: 12, fontWeight: '800' },
  roommateName: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface },
  roommateRole: { fontSize: 10, color: theme.colors.muted },

  // Emergency SOS Card
  sosCard: { backgroundColor: '#FEF2F2', borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: '#FCA5A5' },
  sosTitle: { fontSize: 12, fontWeight: '800', color: '#991B1B', marginBottom: 8 },
  sosRow: { flexDirection: 'row', gap: 10 },
  sosBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingVertical: 8, borderRadius: theme.radius.md, borderWidth: 1, borderColor: '#FCA5A5' },
  sosBtnText: { fontSize: 11, fontWeight: '700', color: '#991B1B' },

  // Mess Grid
  messGrid: { gap: 12 },
  messCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  messCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  messIcon: { fontSize: 24 },
  messMealLabel: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  messMealTime: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  messDivider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 10 },
  messItemList: { gap: 4 },
  messItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  messItemBullet: { color: '#0D9488', fontSize: 12, fontWeight: '800' },
  messItemName: { fontSize: 12, color: theme.colors.onSurface, flex: 1 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.onSurface },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.onSurface, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  typeSelectBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceTertiary },
  typeSelectBtnActive: { backgroundColor: '#0D9488' },
  typeSelectText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  typeSelectTextActive: { color: '#FFFFFF', fontWeight: '800' },
  modalChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceTertiary, marginRight: 8, borderWidth: 1, borderColor: theme.colors.border },
  modalChipActive: { backgroundColor: '#CCFBF1', borderColor: '#0D9488' },
  modalChipText: { fontSize: 11, color: theme.colors.onSurface },
  modalChipTextActive: { color: '#0F766E', fontWeight: '700' },
  submitBtn: { backgroundColor: '#0D9488', paddingVertical: 12, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
