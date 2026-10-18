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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import { useAuth } from '@/src/providers/AuthContext';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import type { LibraryBook, BookIssue, LibraryStats, ParentDashboardData } from '@/src/types';
import {
  ArrowLeft,
  BookOpen,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  Plus,
  Pencil,
  Trash2,
  UserCheck,
  Send,
  RotateCcw,
  Sparkles,
  Layers,
  GraduationCap,
  ShieldCheck,
  Phone,
  Bookmark,
} from 'lucide-react-native';
import Animated, { FadeInUp, SlideInRight } from 'react-native-reanimated';
import { router } from '@/src/navigation/router';
import { EmptyState, Card } from '@/src/ui';

const DEPARTMENTS = [
  'All',
  'Computer Science',
  'Electronics',
  'Mechanical',
  'Civil',
  'Physics',
  'Chemistry',
  'Mathematics',
  'Management',
  'General',
];

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(dateStr?: string): number {
  if (!dateStr) return 0;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function LibraryScreen() {
  const { user } = useAuth();
  const isAdmin = ['college_admin', 'super_admin'].includes(user?.role || '');
  const isParent = user?.role === 'parent';
  const isFaculty = user?.role === 'faculty';

  // Tabs
  // Admin: 'catalog' | 'circulation' | 'overdue' | 'history'
  // Student/Faculty: 'catalog' | 'mybooks' | 'history'
  // Parent: 'mybooks' | 'history'
  const defaultTab = isParent ? 'mybooks' : 'catalog';
  const [tab, setTab] = useState<string>(defaultTab);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [showDetail, setShowDetail] = useState(false);
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);

  // Admin Book Create/Edit Modal
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formDept, setFormDept] = useState('Computer Science');
  const [formIsbn, setFormIsbn] = useState('');
  const [formShelf, setFormShelf] = useState('');
  const [formTotal, setFormTotal] = useState('5');

  // Admin Issue Modal
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueBookId, setIssueBookId] = useState('');
  const [issueStudentQuery, setIssueStudentQuery] = useState('');
  const [issueDays, setIssueDays] = useState('14');

  // API Data
  const { data: stats, refresh: refreshStats } = useFetch<LibraryStats>(isAdmin ? '/library/stats' : null);
  const { data: books, loading: booksLoading, refresh: refreshBooks } = useFetch<LibraryBook[]>('/library/books');
  const { data: myIssues, loading: myIssuesLoading, refresh: refreshMyIssues } = useFetch<BookIssue[]>('/library/my-issues');
  const { data: allIssues, loading: allIssuesLoading, refresh: refreshAllIssues } = useFetch<BookIssue[]>(isAdmin ? '/library/all-issues' : null);
  const { data: parentData, refresh: refreshParent } = useFetch<ParentDashboardData>(isParent ? '/parent/dashboard' : null);

  const { mutate: saveBookApi, loading: savingBook } = useMutate<any>();
  const { mutate: deleteBookApi, loading: deletingBook } = useMutate<any>();
  const { mutate: adminIssueApi, loading: issuingBook } = useMutate<any>();
  const { mutate: reserveApi, loading: reservingBook } = useMutate<any>();
  const { mutate: returnApi, loading: returningBook } = useMutate<any>();

  const booksSafe = useMemo(() => (Array.isArray(books) ? books : []), [books]);
  const myIssuesSafe = useMemo(() => (Array.isArray(myIssues) ? myIssues : []), [myIssues]);
  const allIssuesSafe = useMemo(() => (Array.isArray(allIssues) ? allIssues : []), [allIssues]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshBooks(),
      refreshMyIssues(),
      isAdmin && refreshStats ? refreshStats() : Promise.resolve(),
      isAdmin && refreshAllIssues ? refreshAllIssues() : Promise.resolve(),
      isParent && refreshParent ? refreshParent() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [refreshBooks, refreshMyIssues, refreshStats, refreshAllIssues, refreshParent, isAdmin, isParent]);

  // Derived Stats
  const activeMyIssues = useMemo(() => myIssuesSafe.filter((i) => i.status === 'issued' || i.status === 'overdue'), [myIssuesSafe]);
  const returnedMyIssues = useMemo(() => myIssuesSafe.filter((i) => i.status === 'returned'), [myIssuesSafe]);
  const overdueMyIssues = useMemo(() => activeMyIssues.filter((i) => i.status === 'overdue' || i.isOverdue || daysUntil(i.dueDate || (i as any).due_date) < 0), [activeMyIssues]);
  const totalMyFines = useMemo(() => myIssuesSafe.reduce((sum, i) => sum + (Number(i.fine) || 0), 0), [myIssuesSafe]);

  const activeAllIssues = useMemo(() => allIssuesSafe.filter((i) => i.status === 'issued' || i.status === 'overdue'), [allIssuesSafe]);
  const overdueAllIssues = useMemo(() => allIssuesSafe.filter((i) => i.status === 'overdue' || i.isOverdue || daysUntil(i.dueDate || (i as any).due_date) < 0), [allIssuesSafe]);

  // Filtered books
  const filteredBooks = useMemo(() => {
    return booksSafe.filter((b) => {
      if (department !== 'All' && b.department !== department) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q) ||
          (b.isbn && b.isbn.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [booksSafe, department, search]);

  // Handlers
  const handleOpenAddBook = () => {
    setEditingBookId(null);
    setFormTitle('');
    setFormAuthor('');
    setFormDept('Computer Science');
    setFormIsbn('');
    setFormShelf('Rack A-12');
    setFormTotal('5');
    setShowBookForm(true);
  };

  const handleOpenEditBook = (book: LibraryBook) => {
    setEditingBookId(book._id || book.id || null);
    setFormTitle(book.title);
    setFormAuthor(book.author);
    setFormDept(book.department || 'General');
    setFormIsbn(book.isbn || '');
    setFormShelf(book.shelf || book.shelf_location || '');
    setFormTotal(String(book.total || book.total_copies || book.available || book.available_copies || 1));
    setShowBookForm(true);
  };

  const handleSaveBook = async () => {
    if (!formTitle.trim() || !formAuthor.trim()) {
      Alert.alert('Missing Info', 'Title and Author are mandatory fields.');
      return;
    }
    const copies = parseInt(formTotal, 10) || 1;
    try {
      if (editingBookId) {
        await saveBookApi(`/library/books/${editingBookId}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: formTitle.trim(),
            author: formAuthor.trim(),
            department: formDept,
            isbn: formIsbn.trim(),
            shelf: formShelf.trim(),
            total: copies,
            available: copies,
          }),
        });
        Alert.alert('Success', 'Book updated successfully.');
      } else {
        await saveBookApi('/library/books', {
          method: 'POST',
          body: JSON.stringify({
            title: formTitle.trim(),
            author: formAuthor.trim(),
            department: formDept,
            isbn: formIsbn.trim(),
            shelf: formShelf.trim(),
            total: copies,
            available: copies,
          }),
        });
        Alert.alert('Success', 'New book added to library catalog.');
      }
      setShowBookForm(false);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save book record.');
    }
  };

  const handleDeleteBook = (book: LibraryBook) => {
    Alert.alert('Delete Book', `Are you sure you want to remove "${book.title}" from the catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBookApi(`/library/books/${book._id}`, { method: 'DELETE' });
            Alert.alert('Deleted', 'Book removed from library.');
            onRefresh();
          } catch (e: any) {
            Alert.alert('Delete Failed', e?.message || 'Could not delete book.');
          }
        },
      },
    ]);
  };

  const handleAdminIssueBook = async () => {
    if (!issueBookId || !issueStudentQuery.trim()) {
      Alert.alert('Missing Fields', 'Please select a book and enter a student roll number or ID.');
      return;
    }
    const days = parseInt(issueDays, 10) || 14;
    const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    try {
      await adminIssueApi('/library/admin-issue', {
        method: 'POST',
        body: JSON.stringify({
          bookId: issueBookId,
          student_id: issueStudentQuery.trim(),
          dueDate: due,
        }),
      });
      setShowIssueModal(false);
      setIssueBookId('');
      setIssueStudentQuery('');
      Alert.alert('Success', 'Book successfully issued to student.');
      onRefresh();
    } catch (e: any) {
      Alert.alert('Issue Failed', e?.message || 'Could not issue book.');
    }
  };

  const handleProcessReturn = (issue: BookIssue, waiveFine: boolean = false) => {
    const isLate = daysUntil(issue.dueDate) < 0;
    const fineText = isLate && !waiveFine ? `\nCalculated Fine: ₹${Math.abs(daysUntil(issue.dueDate)) * 10}` : '';

    Alert.alert(
      'Process Book Return',
      `Confirm return of "${issue.book?.title || 'Book'}"?${fineText}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Return',
          onPress: async () => {
            try {
              await returnApi(`/library/return/${issue._id}`, {
                method: 'POST',
                body: JSON.stringify({ waiveFine }),
              });
              Alert.alert('Returned', 'Book returned and stock replenished.');
              onRefresh();
            } catch (e: any) {
              Alert.alert('Return Failed', e?.message || 'Could not process return.');
            }
          },
        },
      ]
    );
  };

  const handleSelfReserve = async (book: LibraryBook) => {
    try {
      await reserveApi('/library/issue', {
        method: 'POST',
        body: JSON.stringify({ bookId: book._id }),
      });
      Alert.alert('Reserved', `"${book.title}" is reserved for you. Please collect it from ${book.shelf || 'Library Desk'}.`);
      onRefresh();
    } catch (e: any) {
      Alert.alert('Reservation Failed', e?.message || 'Could not reserve book.');
    }
  };

  const handleSendReminder = (issue: BookIssue) => {
    Alert.alert(
      'Send Due Reminder',
      `Broadcast notification to ${issue.user?.name || 'Student'} for overdue book "${issue.book?.title || 'Book'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Alert',
          onPress: () => {
            Alert.alert('Alert Dispatched', `Reminder sent via Push & SMS to ${issue.user?.name || 'student'}.`);
          },
        },
      ]
    );
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* TOP HEADER */}
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
              {isAdmin ? 'Library Command Center' : isParent ? 'Ward Library Records' : 'Digital Library Hub'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isAdmin
                ? 'Catalog circulation, book inventory & overdue audits'
                : isParent
                ? 'Track borrowed books, due dates & fines'
                : 'Browse books, active loans & borrowing history'}
            </Text>
          </View>
          {isAdmin && (
            <Pressable
              testID="admin-add-book-btn"
              onPress={handleOpenAddBook}
              style={styles.headerActionBtn}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.headerActionText}>Add Book</Text>
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
                    <BookOpen size={18} color="#6366F1" />
                  </View>
                  <Text style={styles.kpiValue}>{stats?.total_titles ?? booksSafe.length}</Text>
                  <Text style={styles.kpiLabel}>Book Titles</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                    <Layers size={18} color="#10B981" />
                  </View>
                  <Text style={styles.kpiValue}>{stats?.available_copies ?? booksSafe.reduce((s, b) => s + (b.available ?? b.available_copies ?? 0), 0)}</Text>
                  <Text style={styles.kpiLabel}>Available Copies</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(59, 130, 246, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                    <UserCheck size={18} color="#3B82F6" />
                  </View>
                  <Text style={styles.kpiValue}>{stats?.issued_count ?? activeAllIssues.length}</Text>
                  <Text style={styles.kpiLabel}>Active Loans</Text>
                </View>

                <View style={[styles.kpiCard, { borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <AlertTriangle size={18} color="#EF4444" />
                  </View>
                  <Text style={[styles.kpiValue, { color: '#EF4444' }]}>{stats?.overdue_count ?? overdueAllIssues.length}</Text>
                  <Text style={styles.kpiLabel}>Overdue Defaulters</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* 2. STUDENT / FACULTY HERO DIGITAL CARD */}
          {!isAdmin && !isParent && (
            <Animated.View entering={FadeInUp.duration(350)}>
              <LinearGradient
                colors={['#1E1B4B', '#312E81', '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroDigitalCard}
              >
                <View style={styles.heroCardHeader}>
                  <View style={styles.libraryBadgePill}>
                    <ShieldCheck size={14} color="#A5B4FC" />
                    <Text style={styles.libraryBadgeText}>{isFaculty ? 'FACULTY PRIVILEGE' : 'STUDENT CARD'}</Text>
                  </View>
                  <Text style={styles.libraryCardId}>ID: {user?.student_id || user?.id?.slice(-6).toUpperCase() || 'LIB-2026'}</Text>
                </View>

                <Text style={styles.heroCardName}>{user?.name || 'Authorized Member'}</Text>
                <Text style={styles.heroCardDept}>{user?.department || 'General Academics'}</Text>

                <View style={styles.heroCardMetricsRow}>
                  <View style={styles.heroCardMetricItem}>
                    <Text style={styles.heroMetricVal}>{activeMyIssues.length}</Text>
                    <Text style={styles.heroMetricLbl}>Currently Borrowed</Text>
                  </View>
                  <View style={styles.heroCardMetricDivider} />
                  <View style={styles.heroCardMetricItem}>
                    <Text style={styles.heroMetricVal}>{isFaculty ? 8 : 4}</Text>
                    <Text style={styles.heroMetricLbl}>Max Loan Limit</Text>
                  </View>
                  <View style={styles.heroCardMetricDivider} />
                  <View style={styles.heroCardMetricItem}>
                    <Text style={[styles.heroMetricVal, { color: overdueMyIssues.length > 0 ? '#FCA5A5' : '#86EFAC' }]}>
                      {overdueMyIssues.length > 0 ? `${overdueMyIssues.length} Overdue` : 'Clear Standing'}
                    </Text>
                    <Text style={styles.heroMetricLbl}>Account Status</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          )}

          {/* 3. PARENT WARD HERO CARD */}
          {isParent && (
            <Animated.View entering={FadeInUp.duration(350)}>
              <View style={styles.parentWardCard}>
                <View style={styles.parentWardAvatar}>
                  <GraduationCap size={24} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.parentWardLabel}>Ward Library Profile</Text>
                  <Text style={styles.parentWardName}>{parentData?.child?.name || 'Student Ward'}</Text>
                  <Text style={styles.parentWardMeta}>
                    Roll: {parentData?.child?.roll_number || 'N/A'} • {parentData?.child?.department || 'Department'}
                  </Text>
                </View>
                <View style={styles.parentActiveLoansPill}>
                  <Text style={styles.parentActiveLoansVal}>{activeMyIssues.length}</Text>
                  <Text style={styles.parentActiveLoansTxt}>Books Issued</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* 4. OVERDUE FINE BANNER (IF ANY) */}
          {(overdueMyIssues.length > 0 || totalMyFines > 0) && (
            <View style={styles.overdueBanner}>
              <AlertTriangle size={18} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.overdueBannerTitle}>
                  {overdueMyIssues.length} Overdue Book(s) • Fine Due: ₹{totalMyFines}
                </Text>
                <Text style={styles.overdueBannerSub}>
                  Please return books to the library circulation desk to avoid suspension of borrowing privileges.
                </Text>
              </View>
            </View>
          )}

          {/* 5. SEGMENTED TABS */}
          <View style={styles.tabBar}>
            {isAdmin ? (
              <>
                <Pressable
                  testID="tab-catalog"
                  onPress={() => setTab('catalog')}
                  style={[styles.tabItem, tab === 'catalog' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'catalog' && styles.tabItemTextActive]}>Catalog</Text>
                </Pressable>
                <Pressable
                  testID="tab-circulation"
                  onPress={() => setTab('circulation')}
                  style={[styles.tabItem, tab === 'circulation' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'circulation' && styles.tabItemTextActive]}>Circulation Desk</Text>
                </Pressable>
                <Pressable
                  testID="tab-overdue"
                  onPress={() => setTab('overdue')}
                  style={[styles.tabItem, tab === 'overdue' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'overdue' && styles.tabItemTextActive]}>
                    Overdue ({overdueAllIssues.length})
                  </Text>
                </Pressable>
                <Pressable
                  testID="tab-history"
                  onPress={() => setTab('history')}
                  style={[styles.tabItem, tab === 'history' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'history' && styles.tabItemTextActive]}>History</Text>
                </Pressable>
              </>
            ) : isParent ? (
              <>
                <Pressable
                  testID="tab-mybooks"
                  onPress={() => setTab('mybooks')}
                  style={[styles.tabItem, tab === 'mybooks' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'mybooks' && styles.tabItemTextActive]}>Active Loans ({activeMyIssues.length})</Text>
                </Pressable>
                <Pressable
                  testID="tab-history"
                  onPress={() => setTab('history')}
                  style={[styles.tabItem, tab === 'history' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'history' && styles.tabItemTextActive]}>Reading History</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  testID="tab-catalog"
                  onPress={() => setTab('catalog')}
                  style={[styles.tabItem, tab === 'catalog' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'catalog' && styles.tabItemTextActive]}>Book Catalog</Text>
                </Pressable>
                <Pressable
                  testID="tab-mybooks"
                  onPress={() => setTab('mybooks')}
                  style={[styles.tabItem, tab === 'mybooks' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'mybooks' && styles.tabItemTextActive]}>
                    My Books ({activeMyIssues.length})
                  </Text>
                </Pressable>
                <Pressable
                  testID="tab-history"
                  onPress={() => setTab('history')}
                  style={[styles.tabItem, tab === 'history' && styles.tabItemActive]}
                >
                  <Text style={[styles.tabItemText, tab === 'history' && styles.tabItemTextActive]}>History</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ════════════════════════════════════════════════════════════
              TAB: CATALOG
             ════════════════════════════════════════════════════════════ */}
          {tab === 'catalog' && (
            <View>
              {/* Search and Dept Filter */}
              <View style={styles.searchBox}>
                <Search size={18} color={theme.colors.muted} />
                <TextInput
                  testID="search-input"
                  style={styles.searchInput}
                  placeholder="Search by title, author, or ISBN..."
                  placeholderTextColor={theme.colors.muted}
                  value={search}
                  onChangeText={setSearch}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')}>
                    <X size={16} color={theme.colors.muted} />
                  </Pressable>
                )}
              </View>

              {/* Department Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deptScroll}>
                {DEPARTMENTS.map((dept) => (
                  <Pressable
                    key={dept}
                    onPress={() => setDepartment(dept)}
                    style={[styles.deptChip, department === dept && styles.deptChipActive]}
                  >
                    <Text style={[styles.deptChipText, department === dept && styles.deptChipTextActive]}>{dept}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Quick Issue Bar for Admin */}
              {isAdmin && (
                <View style={styles.adminQuickBar}>
                  <Pressable
                    testID="admin-quick-issue-btn"
                    onPress={() => {
                      setIssueBookId('');
                      setIssueStudentQuery('');
                      setShowIssueModal(true);
                    }}
                    style={styles.adminIssueBtn}
                  >
                    <Bookmark size={16} color="#FFFFFF" />
                    <Text style={styles.adminIssueBtnText}>Issue Book to Student</Text>
                  </Pressable>
                </View>
              )}

              {/* Catalog Book List */}
              {booksLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : filteredBooks.length === 0 ? (
                <EmptyState
                  icon={<BookOpen size={48} color={theme.colors.muted} />}
                  title={search ? 'No Matching Books' : 'Catalog Empty'}
                  sub="Try adjusting your department filter or search keywords."
                />
              ) : (
                <View style={styles.bookList}>
                  {filteredBooks.map((book, idx) => {
                    const isAvailable = (book.available || 0) > 0;
                    return (
                      <Animated.View key={book._id} entering={SlideInRight.delay(idx * 25)}>
                        <View style={styles.bookCard}>
                          <View style={styles.bookCardContent}>
                            <View style={styles.bookIconWrap}>
                              <BookOpen size={22} color="#4F46E5" />
                            </View>

                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.bookTitle} numberOfLines={2}>
                                {book.title}
                              </Text>
                              <Text style={styles.bookAuthor}>by {book.author}</Text>
                              <View style={styles.bookMetaRow}>
                                <View style={styles.bookDeptBadge}>
                                  <Text style={styles.bookDeptText}>{book.department || 'General'}</Text>
                                </View>
                                {book.shelf ? (
                                  <Text style={styles.bookShelfText}>📍 {book.shelf}</Text>
                                ) : null}
                              </View>
                            </View>

                            {/* Stock Indicator */}
                            <View style={styles.stockBadgeColumn}>
                              <View
                                style={[
                                  styles.stockBadge,
                                  {
                                    backgroundColor: isAvailable ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.stockBadgeText,
                                    { color: isAvailable ? '#059669' : '#DC2626' },
                                  ]}
                                >
                                  {isAvailable ? `${book.available} in stock` : 'Checked Out'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Action Footer */}
                          <View style={styles.bookCardFooter}>
                            {isAdmin ? (
                              <View style={styles.adminActionRow}>
                                <Pressable
                                  testID={`issue-book-${book._id}`}
                                  disabled={!isAvailable}
                                  onPress={() => {
                                    setIssueBookId(book._id || book.id || '');
                                    setIssueStudentQuery('');
                                    setShowIssueModal(true);
                                  }}
                                  style={[styles.actionBtnOutline, !isAvailable && { opacity: 0.5 }]}
                                >
                                  <Bookmark size={14} color="#6366F1" />
                                  <Text style={styles.actionBtnOutlineText}>Issue</Text>
                                </Pressable>

                                <Pressable
                                  onPress={() => handleOpenEditBook(book)}
                                  style={styles.actionBtnIcon}
                                >
                                  <Pencil size={15} color={theme.colors.muted} />
                                </Pressable>

                                <Pressable
                                  onPress={() => handleDeleteBook(book)}
                                  style={styles.actionBtnIcon}
                                >
                                  <Trash2 size={15} color="#EF4444" />
                                </Pressable>
                              </View>
                            ) : (
                              <View style={styles.studentActionRow}>
                                <Pressable
                                  testID={`reserve-btn-${book._id}`}
                                  disabled={!isAvailable}
                                  onPress={() => handleSelfReserve(book)}
                                  style={[
                                    styles.reserveBtn,
                                    !isAvailable && { backgroundColor: theme.colors.surfaceTertiary },
                                  ]}
                                >
                                  <Sparkles size={14} color={isAvailable ? '#FFFFFF' : theme.colors.muted} />
                                  <Text style={[styles.reserveBtnText, !isAvailable && { color: theme.colors.muted }]}>
                                    {isAvailable ? 'Reserve Book' : 'Out of Stock'}
                                  </Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: CIRCULATION DESK (ADMIN)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'circulation' && isAdmin && (
            <View>
              <View style={styles.circulationHeaderBar}>
                <View>
                  <Text style={styles.sectionHeaderTitle}>Active Campus Borrowings</Text>
                  <Text style={styles.sectionHeaderSub}>
                    {activeAllIssues.length} books currently issued across campus
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setIssueBookId('');
                    setIssueStudentQuery('');
                    setShowIssueModal(true);
                  }}
                  style={styles.adminIssueBtnSmall}
                >
                  <Plus size={14} color="#FFFFFF" />
                  <Text style={styles.adminIssueBtnTextSmall}>New Issue</Text>
                </Pressable>
              </View>

              {allIssuesLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : activeAllIssues.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 size={48} color={theme.colors.muted} />}
                  title="All Books Accounted For"
                  sub="There are no books currently on loan."
                />
              ) : (
                <View style={styles.issueList}>
                  {activeAllIssues.map((issue) => {
                    const days = daysUntil(issue.dueDate);
                    const isLate = days < 0;
                    return (
                      <View key={issue._id} style={styles.issueCard}>
                        <View style={styles.issueCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.issueBookTitle}>{issue.book?.title || 'Book'}</Text>
                            <Text style={styles.issueStudentName}>
                              Borrower: <Text style={{ fontWeight: '700', color: theme.colors.onSurface }}>{issue.user?.name || 'Student'}</Text> ({issue.user?.student_id || 'ID'})
                            </Text>
                            <Text style={styles.issueDatesText}>
                              Issued: {formatDate(issue.issueDate)} • Due: {formatDate(issue.dueDate)}
                            </Text>
                          </View>

                          <View style={[styles.dueBadge, { backgroundColor: isLate ? '#FEF2F2' : '#F0FDF4' }]}>
                            <Clock size={12} color={isLate ? '#DC2626' : '#16A34A'} />
                            <Text style={[styles.dueBadgeText, { color: isLate ? '#DC2626' : '#16A34A' }]}>
                              {isLate ? `${Math.abs(days)}d Overdue` : `${days}d left`}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.issueCardFooter}>
                          <Pressable
                            onPress={() => handleProcessReturn(issue, false)}
                            style={styles.returnBtn}
                          >
                            <RotateCcw size={14} color="#047857" />
                            <Text style={styles.returnBtnText}>Process Return</Text>
                          </Pressable>

                          {isLate && (
                            <Pressable
                              onPress={() => handleProcessReturn(issue, true)}
                              style={styles.waiveBtn}
                            >
                              <Text style={styles.waiveBtnText}>Waive Fine</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: OVERDUE WATCHLIST (ADMIN)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'overdue' && isAdmin && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>Defaulter Watchlist</Text>
                <Text style={styles.sectionHeaderSub}>
                  Students with past-due library loans requiring immediate retrieval
                </Text>
              </View>

              {overdueAllIssues.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 size={48} color={theme.colors.muted} />}
                  title="Zero Overdue Loans"
                  sub="All library books are returned on time or within due date."
                />
              ) : (
                <View style={styles.issueList}>
                  {overdueAllIssues.map((issue) => {
                    const dDate = issue.dueDate || (issue as any).due_date;
                    const daysLate = Math.abs(daysUntil(dDate));
                    const fine = daysLate * 10;
                    const bTitle = issue.book?.title || (issue as any).book_title || 'Book';
                    const uName = issue.user?.name || (issue as any).student_name || 'Student';
                    const uId = issue.user?.student_id || (issue as any).student_id || 'ID';
                    const uContact = issue.user?.email || (issue as any).student_phone || 'N/A';
                    return (
                      <View key={issue._id} style={styles.overdueDefaulterCard}>
                        <View style={styles.overdueCardTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.overdueBookTitle}>{bTitle}</Text>
                            <Text style={styles.overdueStudentName}>
                              Student: {uName} ({uId})
                            </Text>
                            <Text style={styles.overdueContactText}>{uContact}</Text>
                          </View>
                          <View style={styles.fineBox}>
                            <Text style={styles.fineBoxAmt}>₹{fine}</Text>
                            <Text style={styles.fineBoxLbl}>{daysLate}d Overdue</Text>
                          </View>
                        </View>

                        <View style={styles.overdueCardActions}>
                          <Pressable
                            testID={`remind-btn-${issue._id}`}
                            onPress={() => handleSendReminder(issue)}
                            style={styles.remindBtn}
                          >
                            <Send size={13} color="#FFFFFF" />
                            <Text style={styles.remindBtnText}>Send Due Alert</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => handleProcessReturn(issue, false)}
                            style={styles.quickReturnBtn}
                          >
                            <RotateCcw size={13} color="#047857" />
                            <Text style={styles.quickReturnBtnText}>Return Now</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ════════════════════════════════════════════════════════════
              TAB: MY BOOKS (STUDENT / PARENT)
             ════════════════════════════════════════════════════════════ */}
          {tab === 'mybooks' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>
                  {isParent ? "Ward's Borrowed Books" : 'My Active Library Books'}
                </Text>
                <Text style={styles.sectionHeaderSub}>
                  {activeMyIssues.length === 0
                    ? 'No books currently issued'
                    : `Currently in possession of ${activeMyIssues.length} book(s)`}
                </Text>
              </View>

              {myIssuesLoading ? (
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} style={{ marginVertical: 32 }} />
              ) : activeMyIssues.length === 0 ? (
                <EmptyState
                  icon={<BookOpen size={48} color={theme.colors.muted} />}
                  title="No Active Loans"
                  sub="Explore the book catalog and reserve titles for your coursework."
                />
              ) : (
                <View style={styles.issueList}>
                  {activeMyIssues.map((issue) => {
                    const dDate = issue.dueDate || (issue as any).due_date;
                    const iDate = issue.issueDate || (issue as any).issue_date;
                    const days = daysUntil(dDate);
                    const isLate = days < 0;
                    const bTitle = issue.book?.title || (issue as any).book_title || 'Book';
                    const bAuthor = issue.book?.author || (issue as any).book_author || 'Author';
                    const bShelf = issue.book?.shelf || (issue as any).shelf_location || 'Main Section';
                    return (
                      <View key={issue._id} style={styles.myBookCard}>
                        <View style={styles.myBookTop}>
                          <View style={styles.myBookIconWrap}>
                            <BookOpen size={20} color="#4F46E5" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.myBookTitle}>{bTitle}</Text>
                            <Text style={styles.myBookAuthor}>by {bAuthor}</Text>
                            <Text style={styles.myBookShelf}>Shelf: {bShelf}</Text>
                          </View>

                          <View style={[styles.dueCountdownBadge, { backgroundColor: isLate ? '#FEF2F2' : '#EFF6FF' }]}>
                            <Clock size={12} color={isLate ? '#DC2626' : '#2563EB'} />
                            <Text style={[styles.dueCountdownText, { color: isLate ? '#DC2626' : '#2563EB' }]}>
                              {isLate ? `${Math.abs(days)}d OVERDUE` : `${days} days left`}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.myBookDatesBar}>
                          <Text style={styles.dateLabel}>Issued: {formatDate(iDate)}</Text>
                          <Text style={styles.dateLabel}>Due: {formatDate(dDate)}</Text>
                        </View>

                        {/* Fine accrued pill */}
                        {isLate && (
                          <View style={styles.fineWarningPill}>
                            <AlertTriangle size={13} color="#DC2626" />
                            <Text style={styles.fineWarningText}>
                              Late Penalty: ₹{Math.abs(days) * 10} accrued (₹10/day)
                            </Text>
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
              TAB: HISTORY
             ════════════════════════════════════════════════════════════ */}
          {tab === 'history' && (
            <View>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>Circulation History</Text>
                <Text style={styles.sectionHeaderSub}>Past completed returns and records</Text>
              </View>

              {isAdmin ? (
                allIssuesSafe.filter((i) => i.status === 'returned').length === 0 ? (
                  <EmptyState icon={<Clock size={48} color={theme.colors.muted} />} title="No History Records" sub="Returned book records will appear here." />
                ) : (
                  <View style={styles.issueList}>
                    {allIssuesSafe
                      .filter((i) => i.status === 'returned')
                      .map((item) => (
                        <View key={item._id} style={styles.historyCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyBookTitle}>{item.book?.title || 'Book'}</Text>
                            <Text style={styles.historyBorrower}>Borrower: {item.user?.name || 'Student'}</Text>
                            <Text style={styles.historyDateText}>
                              Returned: {formatDate(item.returnDate || item.issueDate)}
                            </Text>
                          </View>
                          <View style={styles.historyStatusPill}>
                            <CheckCircle2 size={13} color="#059669" />
                            <Text style={styles.historyStatusText}>Returned</Text>
                          </View>
                        </View>
                      ))}
                  </View>
                )
              ) : (
                returnedMyIssues.length === 0 ? (
                  <EmptyState icon={<Clock size={48} color={theme.colors.muted} />} title="No Reading History" sub="Books you return will be logged here." />
                ) : (
                  <View style={styles.issueList}>
                    {returnedMyIssues.map((item) => (
                      <View key={item._id} style={styles.historyCard}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.historyBookTitle}>{item.book?.title || 'Book'}</Text>
                          <Text style={styles.historyBorrower}>Author: {item.book?.author || 'Unknown'}</Text>
                          <Text style={styles.historyDateText}>
                            Returned on {formatDate(item.returnDate || item.issueDate)}
                          </Text>
                        </View>
                        <View style={styles.historyStatusPill}>
                          <CheckCircle2 size={13} color="#059669" />
                          <Text style={styles.historyStatusText}>Completed</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )
              )}
            </View>
          )}
        </ScrollView>

        {/* ════════════════════════════════════════════════════════════
            ADMIN: ADD / EDIT BOOK MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showBookForm} transparent animationType="slide" onRequestClose={() => setShowBookForm(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingBookId ? 'Edit Book Catalog' : 'Add New Book to Library'}</Text>
                <Pressable onPress={() => setShowBookForm(false)} style={styles.closeBtn}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 400 }}>
                <Text style={styles.inputLabel}>Book Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Introduction to Algorithms"
                  placeholderTextColor={theme.colors.muted}
                  value={formTitle}
                  onChangeText={setFormTitle}
                />

                <Text style={styles.inputLabel}>Author(s) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Cormen, Leiserson, Rivest"
                  placeholderTextColor={theme.colors.muted}
                  value={formAuthor}
                  onChangeText={setFormAuthor}
                />

                <Text style={styles.inputLabel}>Department</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {DEPARTMENTS.filter((d) => d !== 'All').map((d) => (
                    <Pressable
                      key={d}
                      onPress={() => setFormDept(d)}
                      style={[styles.modalDeptChip, formDept === d && styles.modalDeptChipActive]}
                    >
                      <Text style={[styles.modalDeptChipText, formDept === d && styles.modalDeptChipTextActive]}>
                        {d}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>ISBN Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="978-0262033848"
                      placeholderTextColor={theme.colors.muted}
                      value={formIsbn}
                      onChangeText={setFormIsbn}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Shelf / Rack</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Rack CS-04"
                      placeholderTextColor={theme.colors.muted}
                      value={formShelf}
                      onChangeText={setFormShelf}
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Total Physical Copies</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="5"
                  placeholderTextColor={theme.colors.muted}
                  value={formTotal}
                  onChangeText={setFormTotal}
                />
              </ScrollView>

              <Pressable
                testID="submit-book-form-btn"
                disabled={savingBook}
                onPress={handleSaveBook}
                style={styles.submitBtn}
              >
                {savingBook ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>{editingBookId ? 'Save Changes' : 'Publish Book'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* ════════════════════════════════════════════════════════════
            ADMIN: QUICK ISSUE MODAL
           ════════════════════════════════════════════════════════════ */}
        <Modal visible={showIssueModal} transparent animationType="slide" onRequestClose={() => setShowIssueModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Circulation: Issue Book</Text>
                <Pressable onPress={() => setShowIssueModal(false)} style={styles.closeBtn}>
                  <X size={20} color={theme.colors.muted} />
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Select Book *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {booksSafe.map((b) => {
                  const bId = b._id || b.id || '';
                  return (
                    <Pressable
                      key={bId || b.title}
                      onPress={() => setIssueBookId(bId)}
                      style={[styles.modalBookChip, issueBookId === bId && styles.modalBookChipActive]}
                    >
                      <Text style={[styles.modalBookChipText, issueBookId === bId && styles.modalBookChipTextActive]}>
                        {b.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Student Roll Number or ID *</Text>
              <TextInput
                testID="issue-student-input"
                style={styles.input}
                placeholder="Enter roll number (e.g. CS2026-042) or email"
                placeholderTextColor={theme.colors.muted}
                value={issueStudentQuery}
                onChangeText={setIssueStudentQuery}
              />

              <Text style={styles.inputLabel}>Loan Duration (Days)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="14"
                placeholderTextColor={theme.colors.muted}
                value={issueDays}
                onChangeText={setIssueDays}
              />

              <Pressable
                testID="confirm-admin-issue-btn"
                disabled={issuingBook}
                onPress={handleAdminIssueBook}
                style={styles.submitBtn}
              >
                {issuingBook ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Confirm Loan & Handover</Text>
                )}
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
    backgroundColor: theme.colors.brandPrimary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
  },
  headerActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  scrollContent: { padding: theme.spacing.lg, paddingBottom: 48 },

  // KPI Grid (Admin)
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
  kpiValue: { fontSize: 20, fontWeight: '900', color: theme.colors.onSurface },
  kpiLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },

  // Digital Library Card (Student / Faculty)
  heroDigitalCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: 16,
    ...theme.shadow.md,
  },
  heroCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  libraryBadgePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill },
  libraryBadgeText: { color: '#C7D2FE', fontSize: 10, fontWeight: '800' },
  libraryCardId: { color: '#A5B4FC', fontSize: 12, fontWeight: '700' },
  heroCardName: { fontSize: 20, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 },
  heroCardDept: { fontSize: 12, color: '#C7D2FE', marginTop: 2 },
  heroCardMetricsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)' },
  heroCardMetricItem: { alignItems: 'center', flex: 1 },
  heroMetricVal: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  heroMetricLbl: { fontSize: 10, color: '#C7D2FE', marginTop: 2 },
  heroCardMetricDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Parent Ward Card
  parentWardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  parentWardAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center' },
  parentWardLabel: { fontSize: 10, color: theme.colors.muted, textTransform: 'uppercase', fontWeight: '700' },
  parentWardName: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  parentWardMeta: { fontSize: 12, color: theme.colors.muted, marginTop: 1 },
  parentActiveLoansPill: { alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.md },
  parentActiveLoansVal: { fontSize: 16, fontWeight: '900', color: '#4F46E5' },
  parentActiveLoansTxt: { fontSize: 9, color: '#4F46E5', fontWeight: '700' },

  // Overdue Banner
  overdueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: 16,
  },
  overdueBannerTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  overdueBannerSub: { fontSize: 11, color: '#B91C1C', marginTop: 1 },

  // Segmented Tabs
  tabBar: { flexDirection: 'row', backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, marginBottom: 16 },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.pill },
  tabItemActive: { backgroundColor: theme.colors.surfaceSecondary, ...theme.shadow.xs },
  tabItemText: { fontSize: 12, fontWeight: '600', color: theme.colors.muted },
  tabItemTextActive: { fontWeight: '800', color: theme.colors.brandPrimary },

  // Catalog Section
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
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, color: theme.colors.onSurface, padding: 0 },
  deptScroll: { height: 38, maxHeight: 38, marginBottom: 14 },
  deptChip: { paddingHorizontal: 14, height: 32, maxHeight: 32, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8 },
  deptChipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  deptChipText: { fontSize: 11, color: theme.colors.muted, fontWeight: '600' },
  deptChipTextActive: { color: '#FFFFFF', fontWeight: '800' },

  adminQuickBar: { marginBottom: 14 },
  adminIssueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.brandPrimary, paddingVertical: 10, borderRadius: theme.radius.md },
  adminIssueBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  bookList: { gap: 12 },
  bookCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  bookCardContent: { flexDirection: 'row', alignItems: 'flex-start' },
  bookIconWrap: { width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(79, 70, 229, 0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bookTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface, lineHeight: 18 },
  bookAuthor: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  bookMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bookDeptBadge: { backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bookDeptText: { fontSize: 10, color: theme.colors.muted, fontWeight: '600' },
  bookShelfText: { fontSize: 10, color: theme.colors.muted },
  stockBadgeColumn: { alignItems: 'flex-end' },
  stockBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.pill },
  stockBadgeText: { fontSize: 10, fontWeight: '700' },

  bookCardFooter: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  adminActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  actionBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#6366F1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  actionBtnOutlineText: { color: '#6366F1', fontSize: 12, fontWeight: '700' },
  actionBtnIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  studentActionRow: { alignItems: 'flex-end' },
  reserveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill },
  reserveBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Circulation Desk (Admin)
  circulationHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionHeader: { marginBottom: 14 },
  sectionHeaderTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.onSurface },
  sectionHeaderSub: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  adminIssueBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.pill },
  adminIssueBtnTextSmall: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  issueList: { gap: 12 },
  issueCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  issueCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  issueBookTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  issueStudentName: { fontSize: 12, color: theme.colors.muted, marginTop: 3 },
  issueDatesText: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  dueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm },
  dueBadgeText: { fontSize: 11, fontWeight: '700' },
  issueCardFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  returnBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  returnBtnText: { color: '#047857', fontSize: 12, fontWeight: '700' },
  waiveBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  waiveBtnText: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' },

  // Overdue Defaulter Card (Admin)
  overdueDefaulterCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    ...theme.shadow.xs,
  },
  overdueCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  overdueBookTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  overdueStudentName: { fontSize: 12, fontWeight: '600', color: '#B91C1C', marginTop: 3 },
  overdueContactText: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  fineBox: { alignItems: 'center', backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.md },
  fineBoxAmt: { fontSize: 16, fontWeight: '900', color: '#DC2626' },
  fineBoxLbl: { fontSize: 9, color: '#DC2626', fontWeight: '700' },
  overdueCardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  remindBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  remindBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  quickReturnBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm },
  quickReturnBtnText: { color: '#047857', fontSize: 11, fontWeight: '700' },

  // My Books (Student / Parent)
  myBookCard: {
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.xs,
  },
  myBookTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  myBookIconWrap: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(79, 70, 229, 0.08)', alignItems: 'center', justifyContent: 'center' },
  myBookTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.onSurface },
  myBookAuthor: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  myBookShelf: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  dueCountdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.pill },
  dueCountdownText: { fontSize: 10, fontWeight: '800' },
  myBookDatesBar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.colors.border },
  dateLabel: { fontSize: 11, color: theme.colors.muted },
  fineWarningPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.sm, marginTop: 8 },
  fineWarningText: { fontSize: 11, color: '#DC2626', fontWeight: '700' },

  // History Card
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  historyBookTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.onSurface },
  historyBorrower: { fontSize: 11, color: theme.colors.muted, marginTop: 1 },
  historyDateText: { fontSize: 10, color: theme.colors.muted, marginTop: 2 },
  historyStatusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.pill },
  historyStatusText: { fontSize: 10, color: '#059669', fontWeight: '700' },

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
  modalDeptChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceTertiary, marginRight: 6 },
  modalDeptChipActive: { backgroundColor: theme.colors.brandPrimary },
  modalDeptChipText: { fontSize: 11, color: theme.colors.muted },
  modalDeptChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  modalBookChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceTertiary, marginRight: 8, borderWidth: 1, borderColor: theme.colors.border },
  modalBookChipActive: { backgroundColor: '#EEF2FF', borderColor: theme.colors.brandPrimary },
  modalBookChipText: { fontSize: 11, color: theme.colors.onSurface },
  modalBookChipTextActive: { color: theme.colors.brandPrimary, fontWeight: '700' },
  submitBtn: { backgroundColor: theme.colors.brandPrimary, paddingVertical: 12, borderRadius: theme.radius.pill, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
