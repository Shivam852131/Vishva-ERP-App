import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  RefreshControl, Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  ArrowLeft, BookOpen, Search, Clock, AlertTriangle, CheckCircle2,
  Star, Calendar, X, Bookmark, RotateCcw, CircleDot,
} from 'lucide-react-native';
import Animated, { FadeInUp, SlideInRight } from 'react-native-reanimated';
import { router } from '@/src/navigation/router';
import { EmptyState, Card, Skeleton, ChipBtn } from '@/src/ui';

interface Book {
  _id: string;
  title: string;
  author: string;
  department?: string;
  available: number;
  total?: number;
  isbn?: string;
  shelf?: string;
  rating?: number;
  cover?: string;
}

interface BookIssue {
  _id: string;
  bookId: string;
  userId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  fine: number;
  status: 'issued' | 'returned';
  book?: Book;
}

type Tab = 'catalog' | 'mybooks' | 'history';

const DEPARTMENTS = ['All', 'Computer Science', 'Physics', 'Chemistry', 'Mathematics', 'Electronics', 'Mechanical', 'General'];

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function LibraryScreen() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const { data: books, loading: booksLoading, refresh: refreshBooks } = useFetch<Book[]>('/library/books');
  const { data: issues, loading: issuesLoading, refresh: refreshIssues } = useFetch<BookIssue[]>('/library/my-issues');
  const { mutate: reserveBook, loading: reserving } = useMutate<any>();
  const { mutate: returnBook, loading: returning } = useMutate<any>();

  const allIssues = issues || [];
  const activeIssues = allIssues.filter(i => i.status === 'issued');
  const returnedIssues = allIssues.filter(i => i.status === 'returned');
  const overdueIssues = activeIssues.filter(i => daysUntil(i.dueDate) < 0);
  const totalFines = allIssues.reduce((s, i) => s + (i.fine || 0), 0);

  const filteredBooks = useMemo(() => {
    return (books || []).filter(b => {
      if (department !== 'All' && b.department !== department) return false;
      if (search) {
        const q = search.toLowerCase();
        return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
      }
      return true;
    });
  }, [books, department, search]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshBooks();
    refreshIssues();
    setTimeout(() => setRefreshing(false), 800);
  }, [refreshBooks, refreshIssues]);

  const handleReserve = async (bookId: string) => {
    try {
      await reserveBook('/library/issue', {
        method: 'POST',
        body: JSON.stringify({ bookId }),
      });
      Alert.alert('Reserved', 'Book reserved successfully');
      refreshIssues();
      refreshBooks();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not reserve book');
    }
  };

  const handleReturn = async (issueId: string) => {
    try {
      const result = await returnBook(`/library/return/${issueId}`, { method: 'POST' });
      if (result?.fine > 0) {
        Alert.alert('Returned', `Book returned. Fine: ₹${result.fine}`);
      } else {
        Alert.alert('Returned', 'Book returned successfully');
      }
      refreshIssues();
      refreshBooks();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not return book');
    }
  };

  const isLoading = tab === 'catalog' ? booksLoading && !refreshing : tab === 'mybooks' ? issuesLoading && !refreshing : false;

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <ArrowLeft size={20} color={theme.colors.onSurface} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Library</Text>
            <Text style={styles.headerSub}>Browse & manage books</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <LinearGradient
          colors={[theme.colors.brandPrimary, theme.colors.brand, theme.colors.brandSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <View style={styles.heroStatIconWrap}>
                <BookOpen size={16} color="#FFF" />
              </View>
              <Text style={styles.heroStatVal}>{activeIssues.length}</Text>
              <Text style={styles.heroStatLabel}>Active</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <View style={styles.heroStatIconWrap}>
                <AlertTriangle size={16} color="#FFF" />
              </View>
              <Text style={styles.heroStatVal}>{overdueIssues.length}</Text>
              <Text style={styles.heroStatLabel}>Overdue</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <View style={styles.heroStatIconWrap}>
                <CheckCircle2 size={16} color="#FFF" />
              </View>
              <Text style={styles.heroStatVal}>{returnedIssues.length}</Text>
              <Text style={styles.heroStatLabel}>Returned</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <View style={styles.heroStatIconWrap}>
                <CircleDot size={16} color="#FFF" />
              </View>
              <Text style={styles.heroStatVal}>{totalFines > 0 ? `₹${totalFines}` : '₹0'}</Text>
              <Text style={styles.heroStatLabel}>Fines</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.tabs}>
          {(['catalog', 'mybooks', 'history'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tabBtn, tab === t && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
            >
              <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>
                {t === 'catalog' ? 'Catalog' : t === 'mybooks' ? `My Books (${activeIssues.length})` : `History (${returnedIssues.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'catalog' && (
          <View style={styles.searchWrap}>
            <Search size={16} color={theme.colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search books, authors..."
              placeholderTextColor={theme.colors.muted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')} hitSlop={6}>
                <X size={14} color={theme.colors.muted} />
              </Pressable>
            )}
          </View>
        )}

        {tab === 'catalog' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            {DEPARTMENTS.map(d => (
              <ChipBtn
                key={d}
                label={d}
                active={department === d}
                onPress={() => setDepartment(d)}
              />
            ))}
          </ScrollView>
        )}

        <ScrollView
          style={styles.listScroll}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingWrap}>
              {[1, 2, 3, 4].map(i => (
                <View key={i} style={{ gap: 8, marginBottom: 12 }}>
                  <Skeleton height={80} radius={theme.radius.lg} />
                </View>
              ))}
            </View>
          ) : (
            <>
              {tab === 'catalog' && (
                filteredBooks.length === 0 ? (
                  <EmptyState
                    title={search ? 'No results' : 'No books found'}
                    sub={search ? 'Try a different search or filter' : 'Library catalog is currently empty'}
                    icon={<BookOpen size={48} color={theme.colors.muted} strokeWidth={1.5} />}
                  />
                ) : (
                  filteredBooks.map((book, idx) => {
                    const isAvailable = book.available > 0;
                    const issuedCount = (book.total || book.available + 1) - book.available;
                    return (
                      <Animated.View key={book._id} entering={SlideInRight.delay(idx * 30)}>
                        <Card
                          style={styles.bookCard}
                          onPress={() => { setSelectedBook(book); setShowDetail(true); }}
                        >
                          <View style={styles.bookRow}>
                            <View style={[styles.bookIconWrap, { backgroundColor: isAvailable ? '#DCFCE7' : '#FEE2E2' }]}>
                              <BookOpen size={20} color={isAvailable ? theme.colors.success : theme.colors.error} />
                            </View>
                            <View style={styles.bookContent}>
                              <Text style={styles.bookTitle} numberOfLines={1} ellipsizeMode="tail">{book.title}</Text>
                              <Text style={styles.bookAuthor} numberOfLines={1} ellipsizeMode="tail">{book.author}</Text>
                              <View style={styles.bookMeta}>
                                {book.shelf && (
                                  <View style={styles.metaItem}>
                                    <Bookmark size={10} color={theme.colors.muted} />
                                    <Text style={styles.metaTxt}>{book.shelf}</Text>
                                  </View>
                                )}
                                {book.department && (
                                  <View style={styles.metaItem}>
                                    <Text style={styles.metaTxt}>{book.department}</Text>
                                  </View>
                                )}
                                {book.rating != null && book.rating > 0 && (
                                  <View style={styles.metaItem}>
                                    <Star size={10} color={theme.colors.warning} />
                                    <Text style={[styles.metaTxt, { color: theme.colors.warning }]}>{book.rating}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <View style={styles.bookRight}>
                              <View style={[styles.availBadge, { backgroundColor: isAvailable ? '#DCFCE7' : '#FEE2E2' }]}>
                                <Text style={[styles.availTxt, { color: isAvailable ? theme.colors.success : theme.colors.error }]}>
                                  {isAvailable ? `${book.available} avail` : `${issuedCount} issued`}
                                </Text>
                              </View>
                              {isAvailable && (
                                <Pressable
                                  onPress={() => handleReserve(book._id)}
                                  style={styles.reserveBtn}
                                  disabled={reserving}
                                  accessibilityRole="button"
                                  accessibilityLabel="Reserve this book"
                                >
                                  {reserving ? (
                                    <ActivityIndicator color="#FFF" size={12} />
                                  ) : (
                                    <Text style={styles.reserveTxt}>Reserve</Text>
                                  )}
                                </Pressable>
                              )}
                            </View>
                          </View>
                        </Card>
                      </Animated.View>
                    );
                  })
                )
              )}

              {tab === 'mybooks' && (
                activeIssues.length === 0 ? (
                  <EmptyState
                    title="All clear!"
                    sub="You have no active book issues"
                    icon={<CheckCircle2 size={48} color={theme.colors.success} strokeWidth={1.5} />}
                  />
                ) : (
                  activeIssues.map((issue, idx) => {
                    const book = issue.book;
                    const remaining = daysUntil(issue.dueDate);
                    const isOverdue = remaining < 0;
                    return (
                      <Animated.View key={issue._id} entering={SlideInRight.delay(idx * 30)}>
                        <Card style={[styles.issueCard, isOverdue && styles.issueOverdue]}>
                          <View style={styles.issueTop}>
                            <View style={styles.issueInfo}>
                              <Text style={styles.issueTitle} numberOfLines={1} ellipsizeMode="tail">{book?.title || 'Unknown Book'}</Text>
                              <Text style={styles.issueAuthor} numberOfLines={1} ellipsizeMode="tail">{book?.author || 'Unknown Author'}</Text>
                            </View>
                            <View style={[styles.issueBadge, { backgroundColor: isOverdue ? '#FEE2E2' : '#DCFCE7' }]}>
                              {isOverdue ? <AlertTriangle size={12} color={theme.colors.error} /> : <Clock size={12} color={theme.colors.success} />}
                              <Text style={[styles.issueBadgeTxt, { color: isOverdue ? theme.colors.error : theme.colors.success }]}>
                                {isOverdue ? `${Math.abs(remaining)}d overdue` : `${remaining}d left`}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.issueDates}>
                            <View style={styles.dateItem}>
                              <Calendar size={10} color={theme.colors.muted} />
                              <Text style={styles.dateTxt}>Issued: {formatDate(issue.issueDate)}</Text>
                            </View>
                            <View style={styles.dateItem}>
                              <Clock size={10} color={isOverdue ? theme.colors.error : theme.colors.muted} />
                              <Text style={[styles.dateTxt, isOverdue && { color: theme.colors.error, fontWeight: '700' }]}>
                                Due: {formatDate(issue.dueDate)}
                              </Text>
                            </View>
                          </View>

                          {issue.fine > 0 && (
                            <View style={styles.fineRow}>
                              <AlertTriangle size={12} color={theme.colors.error} />
                              <Text style={styles.fineTxt}>Fine: ₹{issue.fine}</Text>
                            </View>
                          )}

                          <Pressable
                            style={styles.returnBtn}
                            onPress={() => handleReturn(issue._id)}
                            disabled={returning}
                            accessibilityRole="button"
                            accessibilityLabel="Return this book"
                          >
                            {returning ? (
                              <ActivityIndicator color="#FFF" size={14} />
                            ) : (
                              <View style={styles.returnBtnInner}>
                                <RotateCcw size={14} color="#FFF" />
                                <Text style={styles.returnBtnTxt}>Return Book</Text>
                              </View>
                            )}
                          </Pressable>
                        </Card>
                      </Animated.View>
                    );
                  })
                )
              )}

              {tab === 'history' && (
                returnedIssues.length === 0 ? (
                  <EmptyState
                    title="No history"
                    sub="Your returned books will appear here"
                    icon={<BookOpen size={48} color={theme.colors.muted} strokeWidth={1.5} />}
                  />
                ) : (
                  returnedIssues.map((issue, idx) => (
                    <Animated.View key={issue._id} entering={SlideInRight.delay(idx * 30)}>
                      <Card style={styles.historyCard}>
                        <View style={styles.historyLeft}>
                          <View style={styles.historyIconWrap}>
                            <CheckCircle2 size={16} color={theme.colors.success} />
                          </View>
                          <View style={styles.historyContent}>
                            <Text style={styles.historyTitle} numberOfLines={1} ellipsizeMode="tail">{issue.book?.title || 'Unknown Book'}</Text>
                            <Text style={styles.historyAuthor} numberOfLines={1} ellipsizeMode="tail">{issue.book?.author || 'Unknown Author'}</Text>
                            <View style={styles.historyMeta}>
                              <Calendar size={10} color={theme.colors.muted} />
                              <Text style={styles.historyDateTxt}>Issued: {formatDate(issue.issueDate)}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={styles.historyRight}>
                          <View style={styles.historyReturnBadge}>
                            <Text style={styles.historyReturnTxt}>Returned</Text>
                          </View>
                          <Text style={styles.historyDate}>{formatDate(issue.returnDate || '')}</Text>
                          {issue.fine > 0 && <Text style={styles.historyFine}>₹{issue.fine} fine</Text>}
                        </View>
                      </Card>
                    </Animated.View>
                  ))
                )
              )}
            </>
          )}
        </ScrollView>

        <Modal visible={showDetail} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Animated.View entering={FadeInUp} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Book Details</Text>
                <Pressable
                  onPress={() => { setShowDetail(false); setSelectedBook(null); }}
                  hitSlop={8}
                  style={styles.modalCloseBtn}
                >
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>
              {selectedBook && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={[styles.modalIconWrap, { backgroundColor: selectedBook.available > 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                    <BookOpen size={40} color={selectedBook.available > 0 ? theme.colors.success : theme.colors.error} />
                  </View>
                  <Text style={styles.detailTitle}>{selectedBook.title}</Text>
                  <Text style={styles.detailAuthor}>{selectedBook.author}</Text>

                  {selectedBook.isbn && (
                    <View style={styles.isbnRow}>
                      <Text style={styles.isbnLabel}>ISBN</Text>
                      <Text style={styles.isbnValue}>{selectedBook.isbn}</Text>
                    </View>
                  )}

                  <View style={styles.detailGrid}>
                    {[
                      { label: 'Department', value: selectedBook.department || 'General' },
                      { label: 'Shelf', value: selectedBook.shelf || 'N/A' },
                      { label: 'Copies', value: `${selectedBook.available} available` },
                      { label: 'Rating', value: selectedBook.rating ? `${selectedBook.rating} / 5` : 'N/A' },
                    ].map(item => (
                      <View key={item.label} style={styles.detailItem}>
                        <Text style={styles.detailItemLabel}>{item.label}</Text>
                        <Text style={styles.detailItemValue}>{item.value}</Text>
                      </View>
                    ))}
                  </View>

                  {selectedBook.available > 0 && (
                    <Pressable
                      style={styles.detailReserveBtn}
                      onPress={() => { setShowDetail(false); handleReserve(selectedBook._id); }}
                      disabled={reserving}
                      accessibilityRole="button"
                      accessibilityLabel="Reserve this book"
                    >
                      {reserving ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <View style={styles.detailReserveBtnInner}>
                          <Bookmark size={16} color="#FFF" />
                          <Text style={styles.detailReserveTxt}>Reserve This Book</Text>
                        </View>
                      )}
                    </Pressable>
                  )}

                  {selectedBook.available === 0 && (
                    <View style={styles.detailUnavailableWrap}>
                      <AlertTriangle size={16} color={theme.colors.error} />
                      <Text style={styles.detailUnavailableTxt}>Currently unavailable</Text>
                    </View>
                  )}
                </ScrollView>
              )}
            </Animated.View>
          </View>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  backBtn: { width: 36, height: 36, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.extrabold, color: theme.colors.onSurface },
  headerSub: { fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: 1 },

  heroCard: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, borderRadius: theme.radius.xl, padding: theme.spacing.lg, ...theme.shadow.md },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroStat: { alignItems: 'center', flex: 1 },
  heroStatIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  heroStatVal: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.extrabold, color: '#FFF' },
  heroStatLabel: { fontSize: theme.font.size.xs, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  heroStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 3, marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.brandPrimary, ...theme.shadow.sm },
  tabTxt: { color: theme.colors.muted, fontWeight: theme.font.weight.bold, fontSize: theme.font.size.sm },
  tabTxtActive: { color: theme.colors.onBrandPrimary },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: theme.font.size.base, color: theme.colors.onSurface, padding: 0 },

  chipScroll: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md, gap: 6 },

  listScroll: { flex: 1 },
  listContent: { paddingHorizontal: theme.spacing.lg, paddingBottom: 32 },

  loadingWrap: { paddingVertical: theme.spacing.xl },

  bookCard: { marginBottom: theme.spacing.sm },
  bookRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  bookIconWrap: { width: 44, height: 44, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bookContent: { flex: 1, minWidth: 0 },
  bookTitle: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.colors.onSurface },
  bookAuthor: { fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: 2 },
  bookMeta: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  bookRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  availBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm },
  availTxt: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold },
  reserveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandPrimary },
  reserveTxt: { color: '#FFF', fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold },

  issueCard: { marginBottom: theme.spacing.sm },
  issueOverdue: { borderLeftWidth: 3, borderLeftColor: theme.colors.error },
  issueTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm, gap: 8 },
  issueInfo: { flex: 1, minWidth: 0 },
  issueTitle: { fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold, color: theme.colors.onSurface },
  issueAuthor: { fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: 2 },
  issueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm, flexShrink: 0 },
  issueBadgeTxt: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold },
  issueDates: { flexDirection: 'row', gap: theme.spacing.lg, marginBottom: theme.spacing.sm },
  dateItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateTxt: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  fineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: theme.spacing.sm },
  fineTxt: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.bold, color: theme.colors.error },
  returnBtn: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', ...theme.shadow.sm },
  returnBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  returnBtnTxt: { color: '#FFF', fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold },

  historyCard: { marginBottom: theme.spacing.sm },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  historyIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  historyContent: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.colors.onSurface },
  historyAuthor: { fontSize: theme.font.size.xs, color: theme.colors.muted, marginTop: 2 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  historyDateTxt: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  historyRight: { alignItems: 'flex-end', flexShrink: 0 },
  historyReturnBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, backgroundColor: '#DCFCE7', marginBottom: 4 },
  historyReturnTxt: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, color: theme.colors.success },
  historyDate: { fontSize: theme.font.size.xs, color: theme.colors.muted },
  historyFine: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, color: theme.colors.error, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, padding: theme.spacing.xl, paddingBottom: 40, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg },
  modalTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.extrabold, color: theme.colors.onSurface },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  modalIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: theme.spacing.lg },
  detailTitle: { fontSize: theme.font.size.xl, fontWeight: theme.font.weight.extrabold, color: theme.colors.onSurface, textAlign: 'center', marginBottom: 4 },
  detailAuthor: { fontSize: theme.font.size.base, color: theme.colors.muted, textAlign: 'center', marginBottom: theme.spacing.sm },
  isbnRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: theme.spacing.lg },
  isbnLabel: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.bold, color: theme.colors.muted, textTransform: 'uppercase' },
  isbnValue: { fontSize: theme.font.size.sm, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface, backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.xs },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.lg },
  detailItem: { width: '47%', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.md, padding: theme.spacing.md },
  detailItemLabel: { fontSize: theme.font.size.xs, fontWeight: theme.font.weight.semibold, color: theme.colors.muted, textTransform: 'uppercase', marginBottom: 4 },
  detailItemValue: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.semibold, color: theme.colors.onSurface },
  detailReserveBtn: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 14, borderRadius: theme.radius.lg, alignItems: 'center', justifyContent: 'center', ...theme.shadow.sm },
  detailReserveBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailReserveTxt: { color: '#FFF', fontSize: theme.font.size.lg, fontWeight: theme.font.weight.bold },
  detailUnavailableWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: theme.radius.lg, backgroundColor: '#FEE2E2' },
  detailUnavailableTxt: { fontSize: theme.font.size.base, fontWeight: theme.font.weight.bold, color: theme.colors.error },
});
