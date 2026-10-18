/**
 * exam-prep-question-bank.tsx
 * Shared — Question Bank Browser
 * Students: browse, bookmark, start practice from filtered set
 * Faculty+: browse, edit, delete, and navigate to the manager
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Search, Filter, Bookmark, BookmarkCheck, BookOpen,
  ChevronDown, ChevronUp, Check, X, Plus, Edit2, Trash2, AlertCircle,
  Brain, Lightbulb,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { QuestionBankItem, QuestionBankStats, AuthUser } from '@/src/types';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/providers/AuthContext';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

const DIFFICULTIES = ['all', 'easy', 'medium', 'hard'];

function diffColor(d: string) {
  return d === 'easy' ? '#10B981' : d === 'hard' ? '#EF4444' : '#F59E0B';
}

function QuestionItem({
  item,
  index,
  isBookmarked,
  onBookmark,
  canManage,
  onEdit,
  onDelete,
}: {
  item: QuestionBankItem;
  index: number;
  isBookmarked: boolean;
  onBookmark: (id: string) => void;
  canManage: boolean;
  onEdit?: (item: QuestionBankItem) => void;
  onDelete?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  const handleBookmark = async () => {
    setBookmarking(true);
    await onBookmark(item.id);
    setBookmarking(false);
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 30)} layout={Layout} style={styles.qCard}>
      <Pressable onPress={() => setExpanded(e => !e)}>
        <View style={styles.qHeader}>
          <View style={[styles.diffBadge, { backgroundColor: diffColor(item.difficulty) + '20' }]}>
            <Text style={[styles.diffText, { color: diffColor(item.difficulty) }]}>{item.difficulty}</Text>
          </View>
          {item.subject ? <Text style={styles.qSubject}>{item.subject}</Text> : null}
          {item.topic ? <Text style={styles.qTopic}>· {item.topic}</Text> : null}
          <View style={{ flex: 1 }} />
          <View style={[styles.sourceBadge, { backgroundColor: item.source === 'ai' ? '#EFF6FF' : '#F0FDF4' }]}>
            <Text style={[styles.sourceText, { color: item.source === 'ai' ? '#2563EB' : '#059669' }]}>
              {item.source}
            </Text>
          </View>
        </View>
        <Text style={styles.qText} numberOfLines={expanded ? undefined : 3}>{item.question}</Text>
        {!expanded && <Text style={styles.expandHint}>Tap to expand</Text>}
      </Pressable>

      {expanded && (
        <>
          {item.options.map((opt, i) => (
            <View key={i} style={styles.optRow}>
              <View style={styles.optLetter}>
                <Text style={styles.optLetterText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={styles.optText}>{opt}</Text>
              {/* For faculty, show answer marker */}
              {canManage && item.answer === i && (
                <Check size={14} color="#10B981" />
              )}
            </View>
          ))}

          {canManage && item.explanation ? (
            <View style={styles.explanationBox}>
              <Lightbulb size={12} color="#D97706" />
              <Text style={styles.explanationText}>{item.explanation}</Text>
            </View>
          ) : null}
        </>
      )}

      <View style={styles.qActions}>
        <Pressable
          style={styles.bookmarkBtn}
          onPress={handleBookmark}
          disabled={bookmarking}
        >
          {bookmarking
            ? <ActivityIndicator size="small" color={theme.colors.brand} />
            : isBookmarked
              ? <BookmarkCheck size={16} color={theme.colors.brand} />
              : <Bookmark size={16} color={theme.colors.textSecondary} />}
          <Text style={[styles.bookmarkBtnText, isBookmarked && { color: theme.colors.brand }]}>
            {isBookmarked ? 'Bookmarked' : 'Bookmark'}
          </Text>
        </Pressable>

        {canManage && (
          <>
            <Pressable style={styles.actionBtn} onPress={() => onEdit?.(item)}>
              <Edit2 size={14} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => onDelete?.(item.id)}>
              <Trash2 size={14} color="#EF4444" />
            </Pressable>
          </>
        )}
      </View>
    </Animated.View>
  );
}

export default function ExamPrepQuestionBankScreen() {
  const { user } = useAuth() as { user: AuthUser | null };
  const isStudent = user?.role === 'student';
  const canManage = user?.role === 'faculty' || user?.role === 'college_admin' || user?.role === 'super_admin';

  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [skip, setSkip] = useState(0);
  const LIMIT = 20;

  const queryParams = new URLSearchParams();
  if (subject) queryParams.set('subject', subject);
  if (difficulty !== 'all') queryParams.set('difficulty', difficulty);
  if (search) queryParams.set('search', search);
  queryParams.set('limit', String(LIMIT));
  queryParams.set('skip', String(skip));

  const { data, loading, refresh } = useFetch<QuestionBankItem[]>(`/exam-prep/questions?${queryParams.toString()}`);
  const { data: stats } = useFetch<QuestionBankStats>('/exam-prep/questions/stats');

  // Load bookmarks
  const { data: bookmarkData } = useFetch<any[]>('/exam-prep/bookmarks');
  const bookmarkSet = useMemo(() => {
    const s = new Set<string>();
    (bookmarkData || []).forEach(b => s.add(b.question_id));
    return s;
  }, [bookmarkData]);

  const handleBookmark = async (questionId: string) => {
    if (bookmarkSet.has(questionId)) {
      try {
        await api(`/exam-prep/bookmarks/${questionId}`, { method: 'DELETE' });
        bookmarkSet.delete(questionId);
        setBookmarkedIds(new Set(bookmarkSet));
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    } else {
      try {
        await api('/exam-prep/bookmarks', {
          method: 'POST',
          body: JSON.stringify({ question_id: questionId }),
        });
        bookmarkSet.add(questionId);
        setBookmarkedIds(new Set(bookmarkSet));
        Alert.alert('Bookmarked!', 'Question saved to your bookmarks.');
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Question?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api(`/exam-prep/questions/${id}`, { method: 'DELETE' });
            refresh();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        }
      }
    ]);
  };

  const subjects = useMemo(() => {
    const set = new Set<string>();
    (stats?.by_subject || []).forEach(s => { if (s._id) set.add(s._id); });
    return ['', ...Array.from(set)];
  }, [stats]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Question Bank</Text>
        {canManage && (
          <Pressable
            style={styles.addBtn}
            onPress={() => router.push('/exam-prep-question-manager' as any)}
          >
            <Plus size={18} color={theme.colors.brand} />
          </Pressable>
        )}
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <Text style={styles.statsText}>{stats.total} questions</Text>
          {stats.by_difficulty.map(d => (
            <View key={d._id} style={styles.statChip}>
              <Text style={[styles.statChipText, { color: diffColor(d._id) }]}>{d.count} {d._id}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search questions…"
            placeholderTextColor={theme.colors.textSecondary}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <X size={14} color={theme.colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={[styles.filterBtn, showFilters && styles.filterBtnActive]} onPress={() => setShowFilters(f => !f)}>
          <Filter size={16} color={showFilters ? '#fff' : theme.colors.textSecondary} />
        </Pressable>
      </View>

      {/* Filters */}
      {showFilters && (
        <Animated.View entering={FadeInDown} style={styles.filtersPanel}>
          {/* Subject */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {subjects.map(s => (
              <Pressable
                key={s || 'all'}
                style={[styles.chip, subject === s && styles.chipActive]}
                onPress={() => setSubject(s)}
              >
                <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s || 'All Subjects'}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {/* Difficulty */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipScroll, { marginTop: 6 }]}>
            {DIFFICULTIES.map(d => (
              <Pressable
                key={d}
                style={[styles.chip, difficulty === d && styles.chipActive]}
                onPress={() => setDifficulty(d)}
              >
                <Text style={[styles.chipText, difficulty === d && styles.chipTextActive]}>
                  {d === 'all' ? 'All Difficulty' : d.charAt(0).toUpperCase() + d.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* List */}
      {loading && !data ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.brand} />
        </View>
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <QuestionItem
              item={item}
              index={index}
              isBookmarked={bookmarkSet.has(item.id) || bookmarkedIds.has(item.id)}
              onBookmark={handleBookmark}
              canManage={canManage}
              onDelete={handleDelete}
              onEdit={() => router.push('/exam-prep-question-manager' as any, { editId: item.id } as any)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <BookOpen size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No questions found</Text>
              <Text style={styles.emptyBody}>
                {canManage
                  ? 'Add questions manually, import from Excel/CSV, or generate with AI.'
                  : 'Your faculty hasn\'t added questions to the bank yet.'}
              </Text>
              {canManage && (
                <Pressable style={styles.addQuestionBtn} onPress={() => router.push('/exam-prep-question-manager' as any)}>
                  <Plus size={16} color="#fff" />
                  <Text style={styles.addQuestionBtnText}>Add Questions</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12 },
  backBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: theme.colors.text },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },

  statsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surfaceSecondary, gap: 8, flexWrap: 'wrap' },
  statsText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  statChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: theme.colors.surface },
  statChipText: { fontSize: 11, fontWeight: '600' },

  searchRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.text },
  filterBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  filterBtnActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },

  filtersPanel: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: theme.colors.surface, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  chipScroll: { height: 38, maxHeight: 38, paddingTop: 4 },
  chip: { paddingHorizontal: 12, height: 32, maxHeight: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, marginRight: 6, backgroundColor: theme.colors.bg },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, gap: 10 },

  qCard: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  qHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  diffText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  qSubject: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },
  qTopic: { fontSize: 11, color: theme.colors.textSecondary },
  sourceBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  sourceText: { fontSize: 10, fontWeight: '600' },
  qText: { fontSize: 14, color: theme.colors.text, lineHeight: 20, fontWeight: '500' },
  expandHint: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 4, fontStyle: 'italic' },

  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  optLetter: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  optLetterText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  optText: { flex: 1, fontSize: 13, color: theme.colors.text, lineHeight: 18 },

  explanationBox: { flexDirection: 'row', gap: 6, marginTop: 8, backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8, alignItems: 'flex-start' },
  explanationText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

  qActions: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 8 },
  bookmarkBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  bookmarkBtnText: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '500' },
  actionBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptyBody: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  addQuestionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  addQuestionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
