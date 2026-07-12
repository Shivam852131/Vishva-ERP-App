import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Search, BookOpen, Calendar, CheckCircle2 } from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { LibraryBook, LibraryIssue } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { EmptyState, Badge, Card } from '@/src/ui';

export default function Library() {
  const { data: books, loading: booksLoading, refresh: refreshBooks } = useFetch<LibraryBook[]>('/library/books');
  const { data: issues, loading: issuesLoading, refresh: refreshIssues } = useFetch<LibraryIssue[]>('/library/issues?active_only=true');
  const [tab, setTab] = useState<'books' | 'issues'>('books');
  const [query, setQuery] = useState('');

  const loading = booksLoading || issuesLoading;
  const booksSafe = books || [];
  const issuesSafe = issues || [];

  const search = () => {
    refreshBooks();
  };

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back">
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Library</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search books by title, author or ISBN..."
            style={styles.searchInput}
            placeholderTextColor={theme.colors.muted}
            onSubmitEditing={search}
            returnKeyType="search"
            testID="search-input"
          />
          <Pressable onPress={search} style={styles.searchBtn} testID="search-btn" accessibilityLabel="Search books">
            <Search color="#fff" size={18} />
          </Pressable>
        </View>

        <View style={styles.tabs} accessibilityLabel="Library tabs">
          {(['books', 'issues'] as const).map(t => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
              testID={`tab-${t}`}
              accessibilityLabel={`${t} tab`}
            >
              <Text style={[styles.tabTxt, tab === t && styles.tabTxtActive]}>{t === 'books' ? 'Books' : 'My Issues'}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brandPrimary} />
        ) : tab === 'books' ? (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshBooks} tintColor={theme.colors.brandPrimary} />}
          >
            {booksSafe.length === 0 && <EmptyState title="No books found" sub="Try a different search term" />}
            {booksSafe.map(b => (
              <Card key={b.id} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={styles.bookIcon}>
                    <BookOpen color="#fff" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bookTitle}>{b.title}</Text>
                    <Text style={styles.bookAuthor}>{b.author}</Text>
                    <Text style={styles.bookMeta}>{b.category} · {b.isbn}</Text>
                    <View style={styles.availRow}>
                      <Text style={[styles.availTxt, { color: (b.total_copies || 0) > 0 ? theme.colors.success : theme.colors.error }]}>
                        {(b.total_copies || 0) > 0 ? `${b.total_copies} copies` : 'Unavailable'}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshIssues} tintColor={theme.colors.brandPrimary} />}
          >
            {issuesSafe.length === 0 && <EmptyState title="No books issued" sub="Visit the library to borrow books" />}
            {issuesSafe.map(i => (
              <Card key={i.id} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.issueTitle}>{i.book_title}</Text>
                  {i.returned_at ? (
                    <CheckCircle2 color={theme.colors.success} size={18} />
                  ) : (
                    <Badge count={i.fine > 0 ? `Rs.${i.fine}` : 'Active'} color={i.fine > 0 ? theme.colors.error : theme.colors.success} />
                  )}
                </View>
                <View style={styles.issueMeta}>
                  <View style={styles.issueMetaRow}>
                    <Calendar size={12} color={theme.colors.muted} />
                    <Text style={styles.issueMetaTxt}>Issued: {new Date(i.issued_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={styles.issueMetaRow}>
                    <Calendar size={12} color={theme.colors.muted} />
                    <Text style={styles.issueMetaTxt}>Due: {new Date(i.due_date).toLocaleDateString()}</Text>
                  </View>
                  {i.returned_at && (
                    <View style={styles.issueMetaRow}>
                      <CheckCircle2 size={12} color={theme.colors.success} />
                      <Text style={styles.issueMetaTxt}>Returned: {new Date(i.returned_at).toLocaleDateString()}</Text>
                    </View>
                  )}
                  {i.fine > 0 && !i.returned_at && (
                    <Text style={[styles.issueMetaTxt, { color: theme.colors.error }]}>Fine: Rs.{i.fine}</Text>
                  )}
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  searchInput: { flex: 1, backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, fontSize: 14, color: theme.colors.onSurface },
  searchBtn: { width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: theme.spacing.lg, backgroundColor: theme.colors.surfaceTertiary, borderRadius: theme.radius.pill, padding: 4, marginBottom: theme.spacing.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.surfaceSecondary, ...theme.shadow.sm },
  tabTxt: { color: theme.colors.muted, fontWeight: '600', fontSize: 13 },
  tabTxtActive: { color: theme.colors.brand },
  bookIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  bookTitle: { fontWeight: '700', color: theme.colors.onSurface, fontSize: 15 },
  bookAuthor: { fontSize: 12, color: theme.colors.onSurfaceTertiary, marginTop: 1 },
  bookMeta: { fontSize: 11, color: theme.colors.muted, marginTop: 2 },
  availRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  availTxt: { fontSize: 11, fontWeight: '700' },
  issueTitle: { fontWeight: '700', color: theme.colors.onSurface, fontSize: 14, flex: 1 },
  issueMeta: { marginTop: 8, gap: 4 },
  issueMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  issueMetaTxt: { fontSize: 12, color: theme.colors.muted },
});
