import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  BookOpen, Search, Clock, AlertTriangle, CheckCircle,
  ChevronRight, Star, Bookmark, Filter, Calendar,
} from 'lucide-react-native';

const BOOKS = [
  { id: '1', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', category: 'Computer Science', available: true, shelf: 'CS-A3', rating: 4.8 },
  { id: '2', title: 'Data Structures Using C', author: 'Reema Thareja', category: 'Computer Science', available: false, shelf: 'CS-B1', dueDate: 'Jan 28', rating: 4.2 },
  { id: '3', title: 'University Physics', author: 'Young & Freedman', category: 'Physics', available: true, shelf: 'PH-C2', rating: 4.5 },
  { id: '4', title: 'Organic Chemistry', author: 'Morrison & Boyd', category: 'Chemistry', available: true, shelf: 'CH-D1', rating: 4.1 },
  { id: '5', title: 'Higher Engineering Mathematics', author: 'B.S. Grewal', category: 'Mathematics', available: false, shelf: 'MA-E4', dueDate: 'Feb 2', rating: 4.6 },
  { id: '6', title: 'Modern Digital Electronics', author: 'R.P. Jain', category: 'Electronics', available: true, shelf: 'EC-F2', rating: 4.3 },
];

const MY_ISSUES = [
  { id: '1', title: 'Data Structures Using C', author: 'Reema Thareja', issued: 'Jan 5', due: 'Jan 28', status: 'overdue', fine: '₹10' },
  { id: '2', title: 'Higher Engineering Mathematics', author: 'B.S. Grewal', issued: 'Jan 10', due: 'Feb 2', status: 'active', fine: null },
  { id: '3', title: 'Operating System Concepts', author: 'Silberschatz', issued: 'Dec 15', due: 'Jan 15', status: 'returned', fine: '₹5' },
];

const CATEGORIES = ['All', 'Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Electronics'];

export default function LibraryManagement() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'catalog' | 'mybooks' | 'history'>('catalog');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const filteredBooks = BOOKS.filter(b => {
    if (selectedCategory !== 'All' && b.category !== selectedCategory) return false;
    if (search && !b.title.toLowerCase().includes(search.toLowerCase()) && !b.author.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalFines = MY_ISSUES.filter(i => i.fine).reduce((s, i) => s + parseInt(i.fine?.replace('₹', '') || '0'), 0);

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
                <View style={styles.heroIcon}><BookOpen size={22} color="#fff" /></View>
                <View>
                  <Text style={styles.heroTitle}>Library Management</Text>
                  <Text style={styles.heroSub}>Search, borrow & manage your books</Text>
                </View>
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{MY_ISSUES.filter(i => i.status === 'active').length}</Text><Text style={styles.heroStatLabel}>Issued</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>{MY_ISSUES.filter(i => i.status === 'overdue').length}</Text><Text style={styles.heroStatLabel}>Overdue</Text></View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}><Text style={styles.heroStatVal}>₹{totalFines}</Text><Text style={styles.heroStatLabel}>Fines</Text></View>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.tabs}>
            {(['catalog', 'mybooks', 'history'] as const).map(t => (
              <Pressable key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabActive]}>
                <Text style={[styles.tabTxt, activeTab === t && { color: '#fff' }]}>{t === 'catalog' ? 'Catalog' : t === 'mybooks' ? 'My Books' : 'History'}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            {activeTab === 'catalog' && (
              <>
                <View style={styles.searchRow}>
                  <View style={styles.searchBox}>
                    <Search size={16} color={theme.colors.muted} />
                    <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
                      placeholder="Search books, authors..." placeholderTextColor={theme.colors.muted} />
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map(c => (
                    <Pressable key={c} onPress={() => setSelectedCategory(c)}
                      style={[styles.filterChip, selectedCategory === c && styles.filterActive]}>
                      <Text style={[styles.filterText, selectedCategory === c && { color: '#fff' }]}>{c}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {filteredBooks.map(book => (
                  <Card key={book.id} style={{ padding: 14, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: theme.colors.text, fontSize: 14 }}>{book.title}</Text>
                        <Text style={{ fontSize: 12, color: theme.colors.muted, marginTop: 2 }}>{book.author}</Text>
                      </View>
                      <View style={[styles.availBadge, book.available ? styles.availYes : styles.availNo]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: book.available ? '#10B981' : '#EF4444' }}>{book.available ? 'Available' : 'Issued'}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>📚 {book.shelf}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>⭐ {book.rating}</Text>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>📂 {book.category}</Text>
                    </View>
                    {book.available && (
                      <Pressable style={styles.reserveBtn}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.brand }}>Reserve →</Text>
                      </Pressable>
                    )}
                  </Card>
                ))}
              </>
            )}

            {activeTab === 'mybooks' && (
              <>
                {MY_ISSUES.filter(i => i.status !== 'returned').map(book => (
                  <Card key={book.id} style={{ padding: 16, gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>{book.title}</Text>
                      <View style={[styles.statusBadge, book.status === 'overdue' ? styles.statusOverdue : styles.statusActive]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: book.status === 'overdue' ? '#EF4444' : '#10B981' }}>{book.status}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>{book.author}</Text>
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <Text style={{ fontSize: 11, color: theme.colors.muted }}>Issued: {book.issued}</Text>
                      <Text style={{ fontSize: 11, color: book.status === 'overdue' ? '#EF4444' : theme.colors.muted }}>Due: {book.due}</Text>
                    </View>
                    {book.fine && <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Fine: {book.fine}</Text>}
                  </Card>
                ))}

                {MY_ISSUES.filter(i => i.status !== 'returned').length === 0 && (
                  <Card style={{ padding: 40, alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={40} color="#10B981" />
                    <Text style={{ fontWeight: '700', color: theme.colors.text }}>All clear!</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>No active book issues</Text>
                  </Card>
                )}
              </>
            )}

            {activeTab === 'history' && (
              <>
                {MY_ISSUES.filter(i => i.status === 'returned').map(book => (
                  <Card key={book.id} style={{ padding: 14, gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: theme.colors.text }}>{book.title}</Text>
                      <CheckCircle size={16} color="#10B981" />
                    </View>
                    <Text style={{ fontSize: 12, color: theme.colors.muted }}>{book.author}</Text>
                    <Text style={{ fontSize: 11, color: theme.colors.muted }}>Issued: {book.issued} · Returned: {book.due}</Text>
                  </Card>
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
  searchRow: { gap: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  filterActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  availBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  availYes: { backgroundColor: '#10B98115' },
  availNo: { backgroundColor: '#EF444415' },
  reserveBtn: { backgroundColor: theme.colors.brandTertiary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.colors.brand + '20' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: theme.colors.surfaceTertiary },
  statusOverdue: { backgroundColor: '#EF444415' },
  statusActive: { backgroundColor: '#10B98115' },
});
