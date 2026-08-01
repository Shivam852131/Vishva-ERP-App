import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  RefreshControl, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { router } from '@/src/navigation/router';
import type { Hostel, Grievance, Announcement, HostelAllocation } from '@/src/types';
import {
  ArrowLeft, Building2, Bed, UtensilsCrossed, Wrench, Phone,
  CheckCircle2, AlertTriangle, Clock, MessageSquare,
  ChevronDown, ChevronUp, X, Shield, Calendar, DoorOpen,
  UserCircle, Bell, Send, Search, CircleDot, Home,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';

const MESS_MENU: Record<string, { label: string; time: string; items: string[]; icon: string }> = {
  breakfast: { label: 'Breakfast', time: '7:30 - 9:00 AM', items: ['Poha & Tea', 'Bread Butter Jam', 'Cornflakes & Milk', 'Idli Sambar', 'Omelette & Toast'], icon: '🌅' },
  lunch: { label: 'Lunch', time: '12:30 - 2:00 PM', items: ['Rice, Dal Fry, Aloo Gobi', 'Chapati, Paneer Butter Masala', 'Sambar Rice, Curd', 'Salad, Pickle, Papad'], icon: '☀️' },
  snacks: { label: 'Snacks', time: '4:30 - 5:30 PM', items: ['Samosa & Green Chutney', 'Biscuits & Coffee/Tea', 'Pakoras', 'Bread Pakora'], icon: '🍵' },
  dinner: { label: 'Dinner', time: '7:30 - 9:00 PM', items: ['Rice, Rajma, Jeera Aloo', 'Chapati, Chicken Curry', 'Veg Biryani, Raita', 'Gulab Jamun (Fri/Sat)'], icon: '🌙' },
};

const COMPLAINT_CATEGORIES = ['Plumbing', 'Electrical', 'Furniture', 'Cleanliness', 'Network/WiFi', 'Security', 'Mess', 'Other'];
const PRIORITIES = ['low', 'medium', 'high'] as const;

type Tab = 'overview' | 'myroom' | 'mess' | 'complaints' | 'notices';

export default function HostelManagementScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [complaintTitle, setComplaintTitle] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintCategory, setComplaintCategory] = useState('');
  const [complaintPriority, setComplaintPriority] = useState<typeof PRIORITIES[number]>('medium');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedHostel, setExpandedHostel] = useState<string | null>(null);

  const { data: hostels, loading, refresh: refreshHostels } = useFetch<Hostel[]>('/hostels');
  const { data: grievancesRaw, loading: grievancesLoading, refresh: refreshGrievances } = useFetch<Grievance[]>('/grievances');
  const { data: noticesRaw, refresh: refreshNotices } = useFetch<Announcement[]>('/announcements');
  const { data: myAllocation, loading: allocLoading, refresh: refreshMyAlloc } = useFetch<HostelAllocation>(
    user?.role === 'student' ? '/hostel/allocations' : null
  );
  const { mutate: allocateApi, loading: allocating } = useMutate();
  const { mutate: complaintApi, loading: submittingComplaint } = useMutate();

  const hostelsSafe = hostels || [];
  const grievances = grievancesRaw || [];
  const notices = noticesRaw || [];
  const myAlloc = myAllocation && Array.isArray(myAllocation) ? myAllocation.find((a: HostelAllocation) => a.active) : null;

  const filteredHostels = hostelsSafe.filter(h => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      h.name.toLowerCase().includes(q) ||
      h.type.toLowerCase().includes(q) ||
      h.warden_name.toLowerCase().includes(q)
    );
  });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshHostels();
    refreshGrievances();
    refreshNotices();
    refreshMyAlloc();
    setTimeout(() => setRefreshing(false), 800);
  }, [refreshHostels, refreshGrievances, refreshNotices, refreshMyAlloc]);

  const handleSubmitComplaint = async () => {
    if (!complaintTitle.trim() || !complaintDesc.trim() || !complaintCategory) {
      Alert.alert('Missing fields', 'Please fill in title, description, and category');
      return;
    }
    try {
      await complaintApi('/grievances', {
        method: 'POST',
        body: JSON.stringify({
          category: complaintCategory,
          subject: complaintTitle.trim(),
          description: complaintDesc.trim(),
          priority: complaintPriority,
        }),
      });
      Alert.alert('Submitted', 'Your complaint has been filed successfully');
      setComplaintTitle('');
      setComplaintDesc('');
      setComplaintCategory('');
      setComplaintPriority('medium');
      refreshGrievances();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit complaint');
    }
  };

  const handleAllocate = async (hostelId: string) => {
    try {
      await allocateApi(`/hostels/${hostelId}/allocate`, {
        method: 'POST',
        body: JSON.stringify({ room: 'Auto-assigned', bed: 'Auto-assigned' }),
      });
      Alert.alert('Success', 'Room allocated successfully');
      refreshHostels();
      refreshMyAlloc();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not allocate room');
    }
  };

  const totalRooms = hostelsSafe.reduce((s, h) => s + (h.total_rooms || 0), 0);
  const openComplaints = grievances.filter(g => g.status !== 'resolved').length;

  const hostedHostel = myAlloc ? hostelsSafe.find(h => h.id === myAlloc.hostel_id) : null;

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={20} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Hostel Management</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Hostels', value: hostelsSafe.length, color: '#6366F1', icon: <Building2 size={14} color="#6366F1" /> },
            { label: 'Rooms', value: totalRooms, color: '#10B981', icon: <DoorOpen size={14} color="#10B981" /> },
            { label: 'Wardens', value: hostelsSafe.length, color: '#F59E0B', icon: <UserCircle size={14} color="#F59E0B" /> },
            { label: 'Open', value: openComplaints, color: '#EF4444', icon: <AlertTriangle size={14} color="#EF4444" /> },
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
            { key: 'myroom', label: 'My Room' },
            { key: 'mess', label: 'Mess' },
            { key: 'complaints', label: `Complaints${openComplaints > 0 ? ` (${openComplaints})` : ''}` },
            { key: 'notices', label: `Notices (${notices.length})` },
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
          {(loading && !refreshing) || grievancesLoading ? (
            <View style={styles.loadingWrap}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /><Text style={styles.loadingTxt}>Loading hostels...</Text></View>
          ) : tab === 'overview' ? (
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
                  <Text style={styles.emptyTitle}>{search ? 'No hostels found' : 'No hostels available'}</Text>
                  <Text style={styles.emptySub}>{search ? 'Try a different search' : 'Hostel data will appear here'}</Text>
                </View>
              ) : (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Available Hostels</Text>
                  {filteredHostels.map((hostel, idx) => {
                    const isExpanded = expandedHostel === hostel.id;
                    return (
                      <Animated.View key={hostel.id} entering={SlideInRight.delay(idx * 30)}>
                        <View style={styles.hostelCard}>
                          <Pressable onPress={() => setExpandedHostel(isExpanded ? null : hostel.id)}>
                            <View style={styles.hostelCardTop}>
                              <View style={styles.hostelIconWrap}>
                                <Building2 size={22} color={theme.colors.brandPrimary} />
                              </View>
                              <View style={styles.hostelInfo}>
                                <Text style={styles.hostelName} numberOfLines={1} ellipsizeMode="tail">{hostel.name}</Text>
                                <View style={styles.hostelMetaRow}>
                                  <View style={[styles.hostelTypeBadge, { backgroundColor: hostel.type === 'Boys' ? 'rgba(99,102,241,0.1)' : 'rgba(236,72,153,0.1)' }]}>
                                    <Text style={[styles.hostelTypeTxt, { color: hostel.type === 'Boys' ? '#6366F1' : '#EC4899' }]}>{hostel.type}</Text>
                                  </View>
                                  <View style={styles.hostelMetaItem}>
                                    <DoorOpen size={10} color={theme.colors.muted} />
                                    <Text style={styles.hostelMetaTxt}>{hostel.total_rooms} rooms</Text>
                                  </View>
                                </View>
                              </View>
                              {isExpanded ? <ChevronUp size={16} color={theme.colors.muted} /> : <ChevronDown size={16} color={theme.colors.muted} />}
                            </View>
                          </Pressable>

                          {isExpanded && (
                            <Animated.View entering={FadeInDown} style={styles.hostelExpanded}>
                              <View style={styles.hostelWardenRow}>
                                <View style={styles.hostelWardenAvatar}>
                                  <UserCircle size={18} color="#FFF" />
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={styles.hostelWardenName} numberOfLines={1} ellipsizeMode="tail">{hostel.warden_name}</Text>
                                  <Text style={styles.hostelWardenRole} numberOfLines={1} ellipsizeMode="tail">Warden · {hostel.contact}</Text>
                                </View>
                                <Pressable style={styles.hostelCallBtn} onPress={() => Alert.alert('Call', `Calling ${hostel.warden_name}...`)}>
                                  <Phone size={14} color="#FFF" />
                                </Pressable>
                              </View>

                              <Pressable style={styles.allocateBtn} onPress={() => handleAllocate(hostel.id)} disabled={allocating}>
                                {allocating ? (
                                  <ActivityIndicator color="#FFF" size={14} />
                                ) : (
                                  <>
                                    <Bed size={14} color="#FFF" />
                                    <Text style={styles.allocateBtnTxt}>Request Allocation</Text>
                                  </>
                                )}
                              </Pressable>
                            </Animated.View>
                          )}
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsGrid}>
                  {[
                    { icon: <Wrench size={20} color="#F59E0B" />, label: 'Report Issue', color: '#F59E0B', onPress: () => setTab('complaints') },
                    { icon: <MessageSquare size={20} color="#6366F1" />, label: 'Message Warden', color: '#6366F1', onPress: () => Alert.alert('Warden', 'Messaging feature coming soon') },
                    { icon: <Clock size={20} color="#10B981" />, label: 'Gate Pass', color: '#10B981', onPress: () => Alert.alert('Gate Pass', 'Gate pass request feature coming soon') },
                    { icon: <Bell size={20} color="#EC4899" />, label: 'Notices', color: '#EC4899', onPress: () => setTab('notices') },
                  ].map((action, i) => (
                    <Pressable key={i} style={[styles.quickActionCard, { borderColor: action.color + '30' }]} onPress={action.onPress}>
                      <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>{action.icon}</View>
                      <Text style={styles.quickActionLabel} numberOfLines={1} ellipsizeMode="tail">{action.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {notices.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Latest Notices</Text>
                    <Pressable onPress={() => setTab('notices')}>
                      <Text style={styles.sectionLink}>View All</Text>
                    </Pressable>
                  </View>
                  {notices.slice(0, 2).map((n, idx) => (
                    <Animated.View key={n.id} entering={SlideInRight.delay(idx * 30)}>
                      <View style={styles.noticeCard}>
                        <View style={styles.noticeHeader}>
                          <View style={[styles.noticePriorityDot, { backgroundColor: '#6366F1' }]} />
                          <Text style={styles.noticeTitle} numberOfLines={1} ellipsizeMode="tail">{n.title}</Text>
                          <Text style={styles.noticeDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
                        </View>
                        <Text style={styles.noticeBody} numberOfLines={2} ellipsizeMode="tail">{n.body}</Text>
                      </View>
                    </Animated.View>
                  ))}
                </View>
              )}
            </Animated.View>
          ) : tab === 'myroom' ? (
            <Animated.View entering={FadeInDown}>
              {allocLoading ? (
                <View style={styles.loadingWrap}><ActivityIndicator color={theme.colors.brandPrimary} size="large" /></View>
              ) : !myAlloc ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}><Home size={40} color={theme.colors.muted} /></View>
                  <Text style={styles.emptyTitle}>No Room Allocated</Text>
                  <Text style={styles.emptySub}>Request allocation from the Overview tab</Text>
                  <Pressable style={styles.goToOverviewBtn} onPress={() => setTab('overview')}>
                    <Building2 size={16} color={theme.colors.brandPrimary} />
                    <Text style={styles.goToOverviewTxt}>Browse Hostels</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.myRoomBanner}>
                    <View style={styles.myRoomBannerRow}>
                      <Home size={22} color="#FFF" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.myRoomBannerTitle} numberOfLines={1} ellipsizeMode="tail">
                          {hostedHostel?.name || myAlloc.hostel_name} · Room {myAlloc.room_number}
                        </Text>
                        <Text style={styles.myRoomBannerSub}>Active Allocation</Text>
                      </View>
                      <View style={styles.myRoomStatusBadge}>
                        <CheckCircle2 size={12} color="#FFF" />
                        <Text style={styles.myRoomStatusTxt}>Active</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.roomInfoGrid}>
                    {[
                      { label: 'Hostel', value: myAlloc.hostel_name || 'N/A', icon: <Building2 size={16} color="#6366F1" /> },
                      { label: 'Room No', value: myAlloc.room_number || 'N/A', icon: <DoorOpen size={16} color="#10B981" /> },
                      { label: 'Allocated', value: myAlloc.allocated_at ? new Date(myAlloc.allocated_at).toLocaleDateString() : 'N/A', icon: <Calendar size={16} color="#F59E0B" /> },
                      { label: 'Type', value: hostedHostel?.type || 'N/A', icon: <Bed size={16} color="#EC4899" /> },
                    ].map(item => (
                      <View key={item.label} style={styles.roomInfoCard}>
                        {item.icon}
                        <Text style={styles.roomInfoLabel}>{item.label}</Text>
                        <Text style={styles.roomInfoValue} numberOfLines={1} ellipsizeMode="tail">{item.value}</Text>
                      </View>
                    ))}
                  </View>

                  {hostedHostel && (
                    <View style={styles.wardenSection}>
                      <Text style={styles.wardenTitle}>Block Warden</Text>
                      <View style={styles.wardenCard}>
                        <View style={styles.wardenAvatar}>
                          <Shield size={20} color="#FFF" />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.wardenName} numberOfLines={1} ellipsizeMode="tail">{hostedHostel.warden_name}</Text>
                          <Text style={styles.wardenPhone} numberOfLines={1} ellipsizeMode="tail">{hostedHostel.contact}</Text>
                        </View>
                        <Pressable style={styles.wardenCallBtn} onPress={() => Alert.alert('Call', `Calling ${hostedHostel.warden_name}...`)}>
                          <Phone size={16} color="#FFF" />
                        </Pressable>
                      </View>
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          ) : tab === 'mess' ? (
            <Animated.View entering={FadeInDown}>
              <View style={styles.messTimingsCard}>
                <UtensilsCrossed size={16} color={theme.colors.brandPrimary} />
                <Text style={styles.messTimingsTxt}>Breakfast 7:30-9 AM · Lunch 12:30-2 PM · Snacks 4:30-5:30 PM · Dinner 7:30-9 PM</Text>
              </View>

              {Object.entries(MESS_MENU).map(([key, meal], idx) => {
                const now = new Date();
                const hour = now.getHours();
                let isCurrent = false;
                if (key === 'breakfast' && hour >= 7 && hour < 9) isCurrent = true;
                if (key === 'lunch' && hour >= 12 && hour < 14) isCurrent = true;
                if (key === 'snacks' && hour >= 16 && hour < 17) isCurrent = true;
                if (key === 'dinner' && hour >= 19 && hour < 21) isCurrent = true;

                return (
                  <Animated.View key={key} entering={SlideInRight.delay(idx * 30)}>
                    <View style={[styles.messCard, isCurrent && styles.messCardCurrent]}>
                      <View style={styles.messCardHeader}>
                        <View style={styles.messCardLeft}>
                          <Text style={styles.messCardIcon}>{meal.icon}</Text>
                          <View>
                            <Text style={styles.messCardLabel} numberOfLines={1} ellipsizeMode="tail">{meal.label}</Text>
                            <Text style={styles.messCardTime} numberOfLines={1} ellipsizeMode="tail">{meal.time}</Text>
                          </View>
                        </View>
                        {isCurrent && (
                          <View style={styles.messCurrentBadge}>
                            <CircleDot size={10} color="#10B981" />
                            <Text style={styles.messCurrentTxt}>Now Serving</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.messItems}>
                        {meal.items.map((item, i) => (
                          <View key={i} style={styles.messItemRow}>
                            <View style={styles.messItemDot} />
                            <Text style={styles.messItemTxt} numberOfLines={1} ellipsizeMode="tail">{item}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>
          ) : tab === 'complaints' ? (
            <Animated.View entering={FadeInDown}>
              <View style={styles.newComplaintCard}>
                <Text style={styles.newComplaintTitle}>File a Complaint</Text>

                <TextInput
                  style={styles.complaintInput}
                  placeholder="Complaint title"
                  placeholderTextColor={theme.colors.muted}
                  value={complaintTitle}
                  onChangeText={setComplaintTitle}
                />

                <TextInput
                  style={[styles.complaintInput, styles.complaintTextArea]}
                  placeholder="Describe your issue in detail..."
                  placeholderTextColor={theme.colors.muted}
                  value={complaintDesc}
                  onChangeText={setComplaintDesc}
                  multiline
                  numberOfLines={4}
                />

                <Pressable style={styles.categoryPicker} onPress={() => setShowCategoryPicker(true)}>
                  <Wrench size={14} color={theme.colors.muted} />
                  <Text style={[styles.categoryPickerTxt, complaintCategory && { color: theme.colors.text }]}>
                    {complaintCategory || 'Select category'}
                  </Text>
                  <ChevronDown size={14} color={theme.colors.muted} />
                </Pressable>

                <View style={styles.priorityRow}>
                  {PRIORITIES.map(p => (
                    <Pressable
                      key={p}
                      onPress={() => setComplaintPriority(p)}
                      style={[
                        styles.priorityBtn,
                        complaintPriority === p && styles.priorityBtnActive,
                        p === 'high' && complaintPriority === p && { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#EF4444' },
                        p === 'medium' && complaintPriority === p && { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: '#F59E0B' },
                        p === 'low' && complaintPriority === p && { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: '#10B981' },
                      ]}
                    >
                      <Text style={[styles.priorityTxt, complaintPriority === p && (p === 'high' ? { color: '#EF4444' } : p === 'medium' ? { color: '#F59E0B' } : { color: '#10B981' })]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable style={[styles.submitBtn, submittingComplaint && { opacity: 0.6 }]} onPress={handleSubmitComplaint} disabled={submittingComplaint}>
                  {submittingComplaint ? <ActivityIndicator color="#FFF" size={14} /> : <Send size={14} color="#FFF" />}
                  <Text style={styles.submitBtnTxt}>{submittingComplaint ? 'Submitting...' : 'Submit Complaint'}</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionTitle}>My Complaints ({grievances.length})</Text>
              {grievances.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}><MessageSquare size={40} color={theme.colors.muted} /></View>
                  <Text style={styles.emptyTitle}>No complaints yet</Text>
                  <Text style={styles.emptySub}>File a complaint using the form above</Text>
                </View>
              ) : (
                grievances.map((g, idx) => {
                  const status = g.status === 'resolved' ? 'resolved' : g.status === 'in_progress' ? 'in_progress' : 'pending';
                  return (
                    <Animated.View key={g.id} entering={SlideInRight.delay(idx * 30)}>
                      <View style={[styles.complaintCard, status === 'resolved' && styles.complaintResolved, status === 'in_progress' && styles.complaintInProgress]}>
                        <View style={styles.complaintHeader}>
                          <Text style={styles.complaintCardTitle} numberOfLines={1} ellipsizeMode="tail">{g.subject}</Text>
                          <View style={[styles.statusBadge, status === 'resolved' ? styles.statusResolved : status === 'in_progress' ? styles.statusProgress : styles.statusPending]}>
                            <Text style={[styles.statusTxt, status === 'resolved' ? { color: '#10B981' } : status === 'in_progress' ? { color: '#F59E0B' } : { color: '#EF4444' }]}>
                              {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.complaintDesc} numberOfLines={2} ellipsizeMode="tail">{g.description}</Text>
                        <View style={styles.complaintMeta}>
                          <View style={styles.complaintMetaItem}>
                            <Text style={styles.complaintMetaTxt}>{g.category}</Text>
                          </View>
                          <View style={styles.complaintMetaItem}>
                            <Calendar size={10} color={theme.colors.muted} />
                            <Text style={styles.complaintMetaTxt}>{new Date(g.created_at).toLocaleDateString()}</Text>
                          </View>
                        </View>
                        {g.response ? (
                          <View style={styles.wardenNotes}>
                            <Text style={styles.wardenNotesLabel}>Response:</Text>
                            <Text style={styles.wardenNotesTxt} numberOfLines={2} ellipsizeMode="tail">{g.response}</Text>
                          </View>
                        ) : null}
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown}>
              {notices.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <View style={styles.emptyIconWrap}><Bell size={40} color={theme.colors.muted} /></View>
                  <Text style={styles.emptyTitle}>No notices</Text>
                  <Text style={styles.emptySub}>Hostel notices will appear here</Text>
                </View>
              ) : (
                notices.map((n, idx) => (
                  <Animated.View key={n.id} entering={SlideInRight.delay(idx * 30)}>
                    <View style={styles.noticeCardFull}>
                      <View style={styles.noticeFullHeader}>
                        <View style={[styles.noticePriorityDotLarge, { backgroundColor: '#6366F1' }]} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.noticeFullTitle} numberOfLines={1} ellipsizeMode="tail">{n.title}</Text>
                          <Text style={styles.noticeFullDate}>{new Date(n.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={[styles.noticeTypeBadge, { backgroundColor: 'rgba(99,102,241,0.1)' }]}>
                          <Text style={[styles.noticeTypeTxt, { color: '#6366F1' }]}>{n.audience || 'General'}</Text>
                        </View>
                      </View>
                      <Text style={styles.noticeFullBody}>{n.body}</Text>
                    </View>
                  </Animated.View>
                ))
              )}
            </Animated.View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>

        <Modal visible={showCategoryPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Animated.View entering={FadeInUp} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <Pressable onPress={() => setShowCategoryPicker(false)} hitSlop={8}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                {COMPLAINT_CATEGORIES.map(cat => (
                  <Pressable
                    key={cat}
                    style={[styles.categoryOption, complaintCategory === cat && styles.categoryOptionActive]}
                    onPress={() => { setComplaintCategory(cat); setShowCategoryPicker(false); }}
                  >
                    <Text style={[styles.categoryOptionTxt, complaintCategory === cat && styles.categoryOptionTxtActive]} numberOfLines={1} ellipsizeMode="tail">{cat}</Text>
                    {complaintCategory === cat && <CheckCircle2 size={16} color={theme.colors.brandPrimary} />}
                  </Pressable>
                ))}
              </ScrollView>
            </Animated.View>
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
  goToOverviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.pill, backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)' },
  goToOverviewTxt: { fontSize: 13, fontWeight: '700', color: theme.colors.brandPrimary },

  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 8 },
  sectionLink: { fontSize: 12, fontWeight: '600', color: theme.colors.brandPrimary },

  hostelCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  hostelCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hostelIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hostelInfo: { flex: 1, minWidth: 0 },
  hostelName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  hostelMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  hostelTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  hostelTypeTxt: { fontSize: 10, fontWeight: '700' },
  hostelMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hostelMetaTxt: { fontSize: 10, color: theme.colors.muted },

  hostelExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  hostelWardenRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.bg, borderRadius: 8, padding: 10, marginBottom: 10 },
  hostelWardenAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  hostelWardenName: { fontSize: 12, fontWeight: '700', color: theme.colors.text },
  hostelWardenRole: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  hostelCallBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  allocateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.brandPrimary, paddingVertical: 10, borderRadius: 8 },
  allocateBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickActionCard: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1 },
  quickActionIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  quickActionLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.text, flex: 1, minWidth: 0 },

  noticeCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  noticeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  noticePriorityDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  noticeTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.text, minWidth: 0 },
  noticeDate: { fontSize: 10, color: theme.colors.muted, flexShrink: 0 },
  noticeBody: { fontSize: 12, color: theme.colors.muted, lineHeight: 16 },

  myRoomBanner: { backgroundColor: theme.colors.brandPrimary, borderRadius: 12, padding: 16, marginBottom: 12 },
  myRoomBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  myRoomBannerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  myRoomBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  myRoomStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
  myRoomStatusTxt: { fontSize: 10, fontWeight: '700', color: '#FFF' },

  roomInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  roomInfoCard: { width: '48%', backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  roomInfoLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.muted, marginTop: 4, textTransform: 'uppercase' },
  roomInfoValue: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginTop: 2 },

  wardenSection: { marginBottom: 12 },
  wardenTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  wardenCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.colors.border },
  wardenAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  wardenName: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  wardenPhone: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  wardenCallBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  messTimingsCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  messTimingsTxt: { fontSize: 11, color: '#6366F1', fontWeight: '600', flex: 1 },

  messCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  messCardCurrent: { borderColor: '#10B981', borderLeftWidth: 3 },
  messCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  messCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  messCardIcon: { fontSize: 20 },
  messCardLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  messCardTime: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  messCurrentBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(16,185,129,0.1)', flexShrink: 0 },
  messCurrentTxt: { fontSize: 9, fontWeight: '700', color: '#10B981' },
  messItems: { paddingLeft: 4 },
  messItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  messItemDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.brandPrimary, flexShrink: 0 },
  messItemTxt: { fontSize: 12, color: theme.colors.muted, flex: 1, minWidth: 0 },

  newComplaintCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  newComplaintTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginBottom: 10 },
  complaintInput: { backgroundColor: theme.colors.bg, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: theme.colors.text, marginBottom: 8 },
  complaintTextArea: { minHeight: 80, textAlignVertical: 'top' },
  categoryPicker: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.bg, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  categoryPickerTxt: { flex: 1, fontSize: 13, color: theme.colors.muted },
  priorityRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  priorityBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  priorityBtnActive: {},
  priorityTxt: { fontSize: 11, fontWeight: '700', color: theme.colors.muted },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.brandPrimary, paddingVertical: 10, borderRadius: 8 },
  submitBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  complaintCard: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  complaintResolved: { opacity: 0.6 },
  complaintInProgress: { borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
  complaintHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 },
  complaintCardTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text, flex: 1, minWidth: 0 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexShrink: 0 },
  statusResolved: { backgroundColor: 'rgba(16,185,129,0.1)' },
  statusProgress: { backgroundColor: 'rgba(245,158,11,0.1)' },
  statusPending: { backgroundColor: 'rgba(239,68,68,0.1)' },
  statusTxt: { fontSize: 9, fontWeight: '700' },
  complaintDesc: { fontSize: 12, color: theme.colors.muted, marginBottom: 6, lineHeight: 16 },
  complaintMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  complaintMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  complaintMetaTxt: { fontSize: 10, color: theme.colors.muted },
  wardenNotes: { marginTop: 8, padding: 8, backgroundColor: theme.colors.bg, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  wardenNotesLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.muted, textTransform: 'uppercase', marginBottom: 2 },
  wardenNotesTxt: { fontSize: 11, color: theme.colors.text, lineHeight: 16 },

  noticeCardFull: { backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  noticeFullHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  noticePriorityDotLarge: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  noticeFullTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.text, flex: 1, minWidth: 0 },
  noticeFullDate: { fontSize: 10, color: theme.colors.muted, marginTop: 1 },
  noticeTypeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexShrink: 0 },
  noticeTypeTxt: { fontSize: 9, fontWeight: '700' },
  noticeFullBody: { fontSize: 12, color: theme.colors.muted, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  categoryOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  categoryOptionActive: { backgroundColor: 'rgba(99,102,241,0.05)' },
  categoryOptionTxt: { fontSize: 14, color: theme.colors.text, fontWeight: '600' },
  categoryOptionTxtActive: { color: theme.colors.brandPrimary },
});
