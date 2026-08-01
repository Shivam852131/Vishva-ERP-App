import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  RefreshControl, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { router } from '@/src/navigation/router';
import type { Hostel, HostelAllocation } from '@/src/types';
import {
  ArrowLeft, Building2, Bed, Users, DoorOpen, Search, Plus, Pencil,
  Trash2, X, CheckCircle2, UserCircle, Phone, ChevronDown,
  ChevronUp, Calendar, Star, UserPlus, BarChart3,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';

const AMENITIES_LIST = ['WiFi', 'Power Backup', 'AC', 'Mess', 'Laundry', 'Gym', 'Common Room', 'Hot Water', 'Parking', 'CCTV'];

type Tab = 'overview' | 'hostels' | 'allocations';

type HostelStats = {
  total_hostels: number;
  total_rooms: number;
  total_occupied: number;
  occupancy_rate: number;
  active_allocations: number;
  boys_hostels: number;
  girls_hostels: number;
  boys_occupied: number;
  girls_occupied: number;
};

const EMPTY_FORM = {
  name: '',
  type: 'Boys',
  total_rooms: '',
  warden_name: '',
  contact: '',
  description: '',
  amenities: [] as string[],
};

export default function HostelAdminScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedHostel, setExpandedHostel] = useState<string | null>(null);
  const [allocSearch, setAllocSearch] = useState('');
  const [allocFilter, setAllocFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignHostelId, setAssignHostelId] = useState('');
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignRoom, setAssignRoom] = useState('');
  const [assignBed, setAssignBed] = useState('');

  const { data: stats, loading: statsLoading, refresh: refreshStats } = useFetch<HostelStats>('/hostel/stats');
  const { data: hostels, loading: hostelsLoading, refresh: refreshHostels } = useFetch<Hostel[]>('/hostels');
  const { data: allocations, loading: allocsLoading, refresh: refreshAllocs } = useFetch<HostelAllocation[]>('/hostel/allocations');
  const { mutate: saveApi, loading: saving } = useMutate();
  const { mutate: deleteApi, loading: deleting } = useMutate();
  const { mutate: deallocateApi, loading: deallocating } = useMutate();
  const { mutate: assignApi, loading: assigning } = useMutate();

  const hostelsSafe = hostels || [];
  const allocsSafe = allocations || [];

  const filteredHostels = hostelsSafe.filter(h => {
    if (!search) return true;
    const q = search.toLowerCase();
    return h.name.toLowerCase().includes(q) || h.type.toLowerCase().includes(q) || h.warden_name.toLowerCase().includes(q);
  });

  const filteredAllocs = allocsSafe.filter(a => {
    if (allocFilter === 'active' && !a.active) return false;
    if (allocFilter === 'inactive' && a.active) return false;
    if (!allocSearch) return true;
    const q = allocSearch.toLowerCase();
    return a.student_name.toLowerCase().includes(q) || a.hostel_name.toLowerCase().includes(q) || a.room_number.toLowerCase().includes(q);
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshStats();
    refreshHostels();
    refreshAllocs();
    setTimeout(() => setRefreshing(false), 800);
  }, [refreshStats, refreshHostels, refreshAllocs]);

  const openCreate = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (h: Hostel) => {
    setEditId(h.id);
    setForm({
      name: h.name,
      type: h.type,
      total_rooms: String(h.total_rooms || ''),
      warden_name: h.warden_name,
      contact: h.contact,
      description: h.description || '',
      amenities: h.amenities || [],
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Required', 'Hostel name is required');
      return;
    }
    try {
      const body = {
        name: form.name.trim(),
        type: form.type,
        total_rooms: Number(form.total_rooms || 0),
        warden_name: form.warden_name.trim(),
        contact: form.contact.trim(),
        description: form.description.trim(),
        amenities: form.amenities,
      };
      if (editId) {
        await saveApi(`/hostels/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await saveApi('/hostels', { method: 'POST', body: JSON.stringify(body) });
      }
      setShowForm(false);
      refreshHostels();
      refreshStats();
      Alert.alert('Success', editId ? 'Hostel updated' : 'Hostel created');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmDelete !== id) {
      setConfirmDelete(id);
      return;
    }
    try {
      await deleteApi(`/hostels/${id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      refreshHostels();
      refreshStats();
      Alert.alert('Deleted', 'Hostel removed');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not delete');
    }
  };

  const handleDeallocate = async (allocId: string) => {
    Alert.alert('Deallocate', 'Remove this student allocation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deallocate',
        style: 'destructive',
        onPress: async () => {
          try {
            await deallocateApi(`/hostel/allocations/${allocId}/deallocate`, { method: 'POST' });
            refreshAllocs();
            refreshStats();
            Alert.alert('Done', 'Allocation removed');
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Could not deallocate');
          }
        },
      },
    ]);
  };

  const handleAssign = async () => {
    if (!assignHostelId || !assignStudentId) {
      Alert.alert('Required', 'Hostel and Student ID are required');
      return;
    }
    try {
      await assignApi('/hostel/allocations/admin-assign', {
        method: 'POST',
        body: JSON.stringify({
          hostel_id: assignHostelId,
          student_id: assignStudentId,
          room: assignRoom.trim() || 'Auto-assigned',
          bed: assignBed.trim() || 'Auto-assigned',
        }),
      });
      setShowAssignModal(false);
      setAssignHostelId('');
      setAssignStudentId('');
      setAssignRoom('');
      setAssignBed('');
      refreshAllocs();
      refreshStats();
      Alert.alert('Success', 'Student allocated to hostel');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not assign');
    }
  };

  const toggleAmenity = (a: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a) ? prev.amenities.filter(x => x !== a) : [...prev.amenities, a],
    }));
  };

  const totalRooms = hostelsSafe.reduce((s, h) => s + (h.total_rooms || 0), 0);
  const totalOccupied = hostelsSafe.reduce((s, h) => s + (h.occupied || 0), 0);
  const activeAlloc = allocsSafe.filter(a => a.active).length;

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={20} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Hostel Administration</Text>
          </View>
          <Pressable onPress={openCreate} hitSlop={10} style={styles.headerAddBtn}>
            <Plus size={20} color="#FFF" />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Hostels', value: stats?.total_hostels ?? hostelsSafe.length, color: '#6366F1', icon: <Building2 size={14} color="#6366F1" /> },
            { label: 'Rooms', value: stats?.total_rooms ?? totalRooms, color: '#10B981', icon: <DoorOpen size={14} color="#10B981" /> },
            { label: 'Occupied', value: stats?.total_occupied ?? totalOccupied, color: '#F59E0B', icon: <Bed size={14} color="#F59E0B" /> },
            { label: 'Allocations', value: stats?.active_allocations ?? activeAlloc, color: '#EC4899', icon: <Users size={14} color="#EC4899" /> },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <View style={styles.statRow}>{s.icon}<Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text></View>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tabs}>
          {([
            { key: 'overview', label: 'Overview' },
            { key: 'hostels', label: `Hostels (${hostelsSafe.length})` },
            { key: 'allocations', label: `Allocations (${activeAlloc})` },
          ] as const).map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabBtn, tab === t.key && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab === t.key && styles.tabTxtActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          {(hostelsLoading && !refreshing) || statsLoading ? (
            <View style={styles.loadingWrap}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /><Text style={styles.loadingTxt}>Loading...</Text></View>
          ) : tab === 'overview' ? (
            <Animated.View entering={FadeInDown}>
              <View style={styles.overviewCard}>
                <BarChart3 size={20} color={theme.colors.brandPrimary} />
                <Text style={styles.overviewTitle}>Occupancy Overview</Text>
              </View>

              <View style={styles.occupancyBar}>
                <View style={styles.occupancyHeader}>
                  <Text style={styles.occupancyLabel}>Overall Occupancy</Text>
                  <Text style={styles.occupancyPct}>{stats?.occupancy_rate ?? (totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0)}%</Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${stats?.occupancy_rate ?? (totalRooms > 0 ? Math.round((totalOccupied / totalRooms) * 100) : 0)}%` }]} />
                </View>
                <View style={styles.occupancyMeta}>
                  <Text style={styles.occupancyMetaTxt}>{stats?.total_occupied ?? totalOccupied} occupied</Text>
                  <Text style={styles.occupancyMetaTxt}>{(stats?.total_rooms ?? totalRooms) - (stats?.total_occupied ?? totalOccupied)} vacant</Text>
                </View>
              </View>

              <View style={styles.typeGrid}>
                <View style={[styles.typeCard, { borderColor: 'rgba(99,102,241,0.3)' }]}>
                  <Building2 size={18} color="#6366F1" />
                  <Text style={styles.typeVal}>{stats?.boys_hostels ?? 0}</Text>
                  <Text style={styles.typeLabel}>Boys Hostels</Text>
                  <Text style={styles.typeSub}>{stats?.boys_occupied ?? 0} occupied</Text>
                </View>
                <View style={[styles.typeCard, { borderColor: 'rgba(236,72,153,0.3)' }]}>
                  <Building2 size={18} color="#EC4899" />
                  <Text style={styles.typeVal}>{stats?.girls_hostels ?? 0}</Text>
                  <Text style={styles.typeLabel}>Girls Hostels</Text>
                  <Text style={styles.typeSub}>{stats?.girls_occupied ?? 0} occupied</Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>All Hostels</Text>
              {hostelsSafe.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}><Building2 size={40} color={theme.colors.muted} /></View>
                  <Text style={styles.emptyTitle}>No hostels yet</Text>
                  <Text style={styles.emptySub}>Create your first hostel to get started</Text>
                </View>
              ) : (
                hostelsSafe.map((h, idx) => {
                  const occ = h.total_rooms > 0 ? Math.round(((h.occupied || 0) / h.total_rooms) * 100) : 0;
                  return (
                    <Animated.View key={h.id} entering={SlideInRight.delay(idx * 30)}>
                      <View style={styles.hostelCard}>
                        <View style={styles.hostelCardTop}>
                          <View style={[styles.hostelIconWrap, { backgroundColor: h.type === 'Boys' ? 'rgba(99,102,241,0.1)' : 'rgba(236,72,153,0.1)' }]}>
                            <Building2 size={22} color={h.type === 'Boys' ? '#6366F1' : '#EC4899'} />
                          </View>
                          <View style={styles.hostelInfo}>
                            <Text style={styles.hostelName} numberOfLines={1} ellipsizeMode="tail">{h.name}</Text>
                            <View style={styles.hostelMetaRow}>
                              <View style={[styles.hostelTypeBadge, { backgroundColor: h.type === 'Boys' ? 'rgba(99,102,241,0.1)' : 'rgba(236,72,153,0.1)' }]}>
                                <Text style={[styles.hostelTypeTxt, { color: h.type === 'Boys' ? '#6366F1' : '#EC4899' }]}>{h.type}</Text>
                              </View>
                              <Text style={styles.hostelMetaTxt}>{h.total_rooms} rooms · {h.occupied || 0} occupied</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.hostelOccBar}>
                          <View style={[styles.hostelOccFill, { width: `${occ}%`, backgroundColor: occ > 90 ? '#EF4444' : occ > 70 ? '#F59E0B' : '#10B981' }]} />
                        </View>
                      </View>
                    </Animated.View>
                  );
                })
              )}

              {allocsSafe.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Recent Allocations</Text>
                  {allocsSafe.slice(0, 3).map((a, idx) => (
                    <Animated.View key={a.id} entering={SlideInRight.delay(idx * 30)}>
                      <View style={styles.allocCard}>
                        <View style={styles.allocLeft}>
                          <View style={[styles.allocAvatar, { backgroundColor: a.active ? '#10B981' : '#9CA3AF' }]}>
                            <UserCircle size={16} color="#FFF" />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.allocStudent} numberOfLines={1} ellipsizeMode="tail">{a.student_name}</Text>
                            <Text style={styles.allocMeta} numberOfLines={1} ellipsizeMode="tail">{a.hostel_name} · Room {a.room_number}</Text>
                          </View>
                        </View>
                        <View style={[styles.allocStatus, { backgroundColor: a.active ? 'rgba(16,185,129,0.1)' : 'rgba(156,163,175,0.1)' }]}>
                          <Text style={[styles.allocStatusTxt, { color: a.active ? '#10B981' : '#9CA3AF' }]}>{a.active ? 'Active' : 'Inactive'}</Text>
                        </View>
                      </View>
                    </Animated.View>
                  ))}
                </>
              )}
            </Animated.View>
          ) : tab === 'hostels' ? (
            <Animated.View entering={FadeInDown}>
              <View style={styles.searchWrap}>
                <Search size={16} color={theme.colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search hostels, warden..."
                  placeholderTextColor={theme.colors.muted}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')}>
                    <X size={14} color={theme.colors.muted} />
                  </Pressable>
                )}
              </View>

              {filteredHostels.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}><Building2 size={40} color={theme.colors.muted} /></View>
                  <Text style={styles.emptyTitle}>{search ? 'No hostels found' : 'No hostels yet'}</Text>
                  <Text style={styles.emptySub}>{search ? 'Try a different search' : 'Tap + to create a hostel'}</Text>
                </View>
              ) : (
                filteredHostels.map((h, idx) => {
                  const isExpanded = expandedHostel === h.id;
                  const occ = h.total_rooms > 0 ? Math.round(((h.occupied || 0) / h.total_rooms) * 100) : 0;
                  return (
                    <Animated.View key={h.id} entering={SlideInRight.delay(idx * 30)}>
                      <View style={styles.hostelAdminCard}>
                        <Pressable onPress={() => setExpandedHostel(isExpanded ? null : h.id)}>
                          <View style={styles.hostelCardTop}>
                            <View style={[styles.hostelIconWrap, { backgroundColor: h.type === 'Boys' ? 'rgba(99,102,241,0.1)' : 'rgba(236,72,153,0.1)' }]}>
                              <Building2 size={22} color={h.type === 'Boys' ? '#6366F1' : '#EC4899'} />
                            </View>
                            <View style={styles.hostelInfo}>
                              <Text style={styles.hostelName} numberOfLines={1} ellipsizeMode="tail">{h.name}</Text>
                              <View style={styles.hostelMetaRow}>
                                <View style={[styles.hostelTypeBadge, { backgroundColor: h.type === 'Boys' ? 'rgba(99,102,241,0.1)' : 'rgba(236,72,153,0.1)' }]}>
                                  <Text style={[styles.hostelTypeTxt, { color: h.type === 'Boys' ? '#6366F1' : '#EC4899' }]}>{h.type}</Text>
                                </View>
                                <Text style={styles.hostelMetaTxt}>{h.total_rooms} rooms</Text>
                              </View>
                            </View>
                            {isExpanded ? <ChevronUp size={16} color={theme.colors.muted} /> : <ChevronDown size={16} color={theme.colors.muted} />}
                          </View>
                        </Pressable>

                        {isExpanded && (
                          <Animated.View entering={FadeInDown} style={styles.hostelExpanded}>
                            <View style={styles.hostelOccBar}>
                              <View style={[styles.hostelOccFill, { width: `${occ}%`, backgroundColor: occ > 90 ? '#EF4444' : occ > 70 ? '#F59E0B' : '#10B981' }]} />
                            </View>
                            <Text style={styles.hostelOccTxt}>{h.occupied || 0}/{h.total_rooms} rooms occupied ({occ}%)</Text>

                            <View style={styles.hostelDetailRow}>
                              <UserCircle size={14} color={theme.colors.muted} />
                              <Text style={styles.hostelDetailTxt}>Warden: {h.warden_name || 'Not assigned'}</Text>
                            </View>
                            <View style={styles.hostelDetailRow}>
                              <Phone size={14} color={theme.colors.muted} />
                              <Text style={styles.hostelDetailTxt}>Contact: {h.contact || 'N/A'}</Text>
                            </View>
                            {h.amenities && h.amenities.length > 0 && (
                              <View style={styles.hostelDetailRow}>
                                <Star size={14} color={theme.colors.muted} />
                                <Text style={styles.hostelDetailTxt}>Amenities: {h.amenities.join(', ')}</Text>
                              </View>
                            )}

                            <View style={styles.hostelActions}>
                              <Pressable style={styles.editBtn} onPress={() => openEdit(h)}>
                                <Pencil size={14} color="#FFF" />
                                <Text style={styles.editBtnTxt}>Edit</Text>
                              </Pressable>
                              <Pressable
                                style={[styles.deleteBtn, confirmDelete === h.id && styles.deleteBtnConfirm]}
                                onPress={() => handleDelete(h.id)}
                                disabled={deleting}
                              >
                                <Trash2 size={14} color="#FFF" />
                                <Text style={styles.deleteBtnTxt}>{confirmDelete === h.id ? 'Tap again' : 'Delete'}</Text>
                              </Pressable>
                            </View>
                          </Animated.View>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown}>
              <View style={styles.searchWrap}>
                <Search size={16} color={theme.colors.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by student, hostel, room..."
                  placeholderTextColor={theme.colors.muted}
                  value={allocSearch}
                  onChangeText={setAllocSearch}
                />
                {allocSearch.length > 0 && (
                  <Pressable onPress={() => setAllocSearch('')}>
                    <X size={14} color={theme.colors.muted} />
                  </Pressable>
                )}
              </View>

              <View style={styles.filterRow}>
                {(['all', 'active', 'inactive'] as const).map(f => (
                  <Pressable key={f} onPress={() => setAllocFilter(f)} style={[styles.filterBtn, allocFilter === f && styles.filterBtnActive]}>
                    <Text style={[styles.filterTxt, allocFilter === f && styles.filterTxtActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                  </Pressable>
                ))}
                <View style={{ flex: 1 }} />
                <Pressable style={styles.assignBtn} onPress={() => setShowAssignModal(true)}>
                  <UserPlus size={14} color="#FFF" />
                  <Text style={styles.assignBtnTxt}>Assign</Text>
                </Pressable>
              </View>

              {allocsLoading && !refreshing ? (
                <View style={styles.loadingWrap}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /></View>
              ) : filteredAllocs.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}><Users size={40} color={theme.colors.muted} /></View>
                  <Text style={styles.emptyTitle}>{allocSearch || allocFilter !== 'all' ? 'No allocations found' : 'No allocations yet'}</Text>
                  <Text style={styles.emptySub}>{allocSearch ? 'Try a different search' : 'Assign students to hostels'}</Text>
                </View>
              ) : (
                filteredAllocs.map((a, idx) => (
                  <Animated.View key={a.id} entering={SlideInRight.delay(idx * 30)}>
                    <View style={[styles.allocAdminCard, !a.active && styles.allocCardInactive]}>
                      <View style={styles.allocAdminTop}>
                        <View style={[styles.allocAvatar, { backgroundColor: a.active ? '#6366F1' : '#9CA3AF' }]}>
                          <UserCircle size={18} color="#FFF" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.allocStudent} numberOfLines={1} ellipsizeMode="tail">{a.student_name}</Text>
                          {a.student_email ? <Text style={styles.allocEmail} numberOfLines={1} ellipsizeMode="tail">{a.student_email}</Text> : null}
                        </View>
                        <View style={[styles.allocStatus, { backgroundColor: a.active ? 'rgba(16,185,129,0.1)' : 'rgba(156,163,175,0.1)' }]}>
                          <Text style={[styles.allocStatusTxt, { color: a.active ? '#10B981' : '#9CA3AF' }]}>{a.active ? 'Active' : 'Inactive'}</Text>
                        </View>
                      </View>
                      <View style={styles.allocDetails}>
                        <View style={styles.allocDetailItem}>
                          <Building2 size={12} color={theme.colors.muted} />
                          <Text style={styles.allocDetailTxt} numberOfLines={1} ellipsizeMode="tail">{a.hostel_name}</Text>
                        </View>
                        <View style={styles.allocDetailItem}>
                          <DoorOpen size={12} color={theme.colors.muted} />
                          <Text style={styles.allocDetailTxt}>Room {a.room_number || 'N/A'}</Text>
                        </View>
                        <View style={styles.allocDetailItem}>
                          <Calendar size={12} color={theme.colors.muted} />
                          <Text style={styles.allocDetailTxt}>{a.allocated_at || 'N/A'}</Text>
                        </View>
                      </View>
                      {a.active && (
                        <Pressable style={styles.deallocBtn} onPress={() => handleDeallocate(a.id)} disabled={deallocating}>
                          {deallocating ? (
                            <ActivityIndicator color="#EF4444" size={12} />
                          ) : (
                            <>
                              <X size={12} color="#EF4444" />
                              <Text style={styles.deallocBtnTxt}>Deallocate</Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  </Animated.View>
                ))
              )}
            </Animated.View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Create / Edit Hostel Modal */}
        <Modal visible={showForm} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Animated.View entering={FadeInUp} style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{editId ? 'Edit Hostel' : 'Create Hostel'}</Text>
                  <Pressable onPress={() => setShowForm(false)} hitSlop={8}>
                    <X size={20} color={theme.colors.muted} />
                  </Pressable>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.fieldLabel}>Hostel Name *</Text>
                  <TextInput style={styles.input} placeholder="e.g. Nalanda Block" placeholderTextColor={theme.colors.muted} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} />

                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.typePickerRow}>
                    {['Boys', 'Girls'].map(t => (
                      <Pressable key={t} onPress={() => setForm(p => ({ ...p, type: t }))} style={[styles.typePickerBtn, form.type === t && styles.typePickerActive]}>
                        <Text style={[styles.typePickerTxt, form.type === t && styles.typePickerTxtActive]}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Total Rooms</Text>
                  <TextInput style={styles.input} placeholder="e.g. 120" placeholderTextColor={theme.colors.muted} value={form.total_rooms} onChangeText={v => setForm(p => ({ ...p, total_rooms: v }))} keyboardType="numeric" />

                  <Text style={styles.fieldLabel}>Warden Name</Text>
                  <TextInput style={styles.input} placeholder="e.g. Mr. Ramesh Nair" placeholderTextColor={theme.colors.muted} value={form.warden_name} onChangeText={v => setForm(p => ({ ...p, warden_name: v }))} />

                  <Text style={styles.fieldLabel}>Contact</Text>
                  <TextInput style={styles.input} placeholder="e.g. +91 98765 00010" placeholderTextColor={theme.colors.muted} value={form.contact} onChangeText={v => setForm(p => ({ ...p, contact: v }))} />

                  <Text style={styles.fieldLabel}>Description</Text>
                  <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Brief description..." placeholderTextColor={theme.colors.muted} value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} multiline />

                  <Text style={styles.fieldLabel}>Amenities</Text>
                  <View style={styles.amenitiesGrid}>
                    {AMENITIES_LIST.map(a => (
                      <Pressable key={a} onPress={() => toggleAmenity(a)} style={[styles.amenityChip, form.amenities.includes(a) && styles.amenityActive]}>
                        {form.amenities.includes(a) && <CheckCircle2 size={12} color="#FFF" />}
                        <Text style={[styles.amenityTxt, form.amenities.includes(a) && styles.amenityTxtActive]}>{a}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#FFF" size={16} /> : <Text style={styles.saveBtnTxt}>{editId ? 'Update Hostel' : 'Create Hostel'}</Text>}
                  </Pressable>
                </ScrollView>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* Admin Assign Modal */}
        <Modal visible={showAssignModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
              <Animated.View entering={FadeInUp} style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Assign Student to Hostel</Text>
                  <Pressable onPress={() => setShowAssignModal(false)} hitSlop={8}>
                    <X size={20} color={theme.colors.muted} />
                  </Pressable>
                </View>

                <Text style={styles.fieldLabel}>Hostel *</Text>
                <View style={styles.pickerScroll}>
                  {hostelsSafe.map(h => (
                    <Pressable key={h.id} onPress={() => setAssignHostelId(h.id)} style={[styles.pickerOption, assignHostelId === h.id && styles.pickerActive]}>
                      <Building2 size={14} color={assignHostelId === h.id ? '#FFF' : theme.colors.muted} />
                      <Text style={[styles.pickerTxt, assignHostelId === h.id && styles.pickerTxtActive]}>{h.name} ({h.type})</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Student ID *</Text>
                <TextInput style={styles.input} placeholder="Enter student ID" placeholderTextColor={theme.colors.muted} value={assignStudentId} onChangeText={setAssignStudentId} />

                <Text style={styles.fieldLabel}>Room Number</Text>
                <TextInput style={styles.input} placeholder="e.g. 302 (optional)" placeholderTextColor={theme.colors.muted} value={assignRoom} onChangeText={setAssignRoom} />

                <Text style={styles.fieldLabel}>Bed</Text>
                <TextInput style={styles.input} placeholder="e.g. Bed 1 (optional)" placeholderTextColor={theme.colors.muted} value={assignBed} onChangeText={setAssignBed} />

                <Pressable style={[styles.saveBtn, (assigning || !assignHostelId || !assignStudentId) && { opacity: 0.6 }]} onPress={handleAssign} disabled={assigning || !assignHostelId || !assignStudentId}>
                  {assigning ? <ActivityIndicator color="#FFF" size={16} /> : <Text style={styles.saveBtnTxt}>Assign Student</Text>}
                </Pressable>
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  headerAddBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },

  statsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  statCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 8, borderWidth: 1, borderColor: theme.colors.border },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  statVal: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 9, color: theme.colors.muted, fontWeight: '600' },

  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: 16, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brandPrimary },
  tabTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 10 },
  tabTxtActive: { color: '#FFF' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.text, padding: 0 },

  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  loadingWrap: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  loadingTxt: { fontSize: 13, color: theme.colors.muted },

  emptyWrap: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptySub: { fontSize: 12, color: theme.colors.muted, textAlign: 'center', paddingHorizontal: 20 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 8, marginTop: 8 },

  overviewCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  overviewTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text },

  occupancyBar: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  occupancyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  occupancyLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  occupancyPct: { fontSize: 13, fontWeight: '800', color: theme.colors.brandPrimary },
  barBg: { height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.brandPrimary },
  occupancyMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  occupancyMetaTxt: { fontSize: 11, color: theme.colors.muted },

  typeGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeCard: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, borderWidth: 1, alignItems: 'center' },
  typeVal: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  typeLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.muted, marginTop: 2 },
  typeSub: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },

  hostelCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  hostelCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostelIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hostelInfo: { flex: 1, minWidth: 0 },
  hostelName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  hostelMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  hostelTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hostelTypeTxt: { fontSize: 10, fontWeight: '700' },
  hostelMetaTxt: { fontSize: 10, color: theme.colors.muted },
  hostelOccBar: { height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceTertiary, overflow: 'hidden', marginTop: 8 },
  hostelOccFill: { height: 4, borderRadius: 2 },
  hostelOccTxt: { fontSize: 11, color: theme.colors.muted, marginTop: 4 },

  hostelAdminCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  hostelExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  hostelDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  hostelDetailTxt: { fontSize: 12, color: theme.colors.muted, flex: 1 },
  hostelActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.brandPrimary, paddingVertical: 10, borderRadius: 8 },
  editBtnTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EF4444', paddingVertical: 10, borderRadius: 8 },
  deleteBtnConfirm: { backgroundColor: '#DC2626' },
  deleteBtnTxt: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  allocCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  allocLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  allocAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  allocStudent: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  allocMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  allocStatus: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, flexShrink: 0 },
  allocStatusTxt: { fontSize: 10, fontWeight: '700' },

  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  filterBtnActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  filterTxt: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  filterTxtActive: { color: '#FFF' },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  assignBtnTxt: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  allocAdminCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  allocCardInactive: { opacity: 0.6 },
  allocAdminTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  allocEmail: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  allocDetails: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  allocDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  allocDetailTxt: { fontSize: 11, color: theme.colors.muted },
  deallocBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 10, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.05)' },
  deallocBtnTxt: { fontSize: 11, fontWeight: '700', color: '#EF4444' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.muted, marginBottom: 4, marginTop: 10, textTransform: 'uppercase' },
  input: { backgroundColor: theme.colors.bg, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.text, marginBottom: 4 },

  typePickerRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  typePickerBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border },
  typePickerActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  typePickerTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.muted },
  typePickerTxtActive: { color: '#FFF' },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: theme.colors.surfaceTertiary, borderWidth: 1, borderColor: theme.colors.border },
  amenityActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  amenityTxt: { fontSize: 11, fontWeight: '600', color: theme.colors.muted },
  amenityTxtActive: { color: '#FFF' },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.brandPrimary, paddingVertical: 14, borderRadius: 10, marginTop: 16 },
  saveBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  pickerScroll: { gap: 6, marginBottom: 4 },
  pickerOption: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg },
  pickerActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  pickerTxt: { fontSize: 13, fontWeight: '600', color: theme.colors.text },
  pickerTxtActive: { color: '#FFF' },
});
