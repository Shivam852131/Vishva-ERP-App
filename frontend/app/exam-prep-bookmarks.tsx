/**
 * exam-prep-bookmarks.tsx
 * Student — Saved / Bookmarked Questions
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Bookmark, BookmarkCheck, Trash2, ChevronRight,
  Check, Lightbulb, BookOpen,
} from 'lucide-react-native';
import { useFetch } from '@/src/hooks/useFetch';
import { api } from '@/src/api';
import type { Bookmark as BookmarkType } from '@/src/types';
import { theme } from '@/src/theme';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

function diffColor(d: string) {
  return d === 'easy' ? '#10B981' : d === 'hard' ? '#EF4444' : '#F59E0B';
}

function BookmarkCard({ item, index, onRemove }: {
  item: BookmarkType; index: number; onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const q = item.question;

  return (
    <Animated.View entering={FadeInDown.delay(index * 40)} layout={Layout} style={styles.card}>
      <Pressable onPress={() => setExpanded(e => !e)}>
        <View style={styles.cardHeader}>
          <BookmarkCheck size={14} color={theme.colors.brand} />
          {q ? (
            <View style={[styles.diffBadge, { backgroundColor: diffColor(q.difficulty) + '20' }]}>
              <Text style={[styles.diffText, { color: diffColor(q.difficulty) }]}>{q.difficulty}</Text>
            </View>
          ) : null}
          {q?.subject ? <Text style={styles.subject}>{q.subject}</Text> : null}
          <View style={{ flex: 1 }} />
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>

        {q ? (
          <Text style={styles.question} numberOfLines={expanded ? undefined : 2}>{q.question}</Text>
        ) : (
          <Text style={[styles.question, { color: theme.colors.textSecondary }]}>Question no longer available</Text>
        )}
      </Pressable>

      {expanded && q && (
        <>
          {q.options.map((opt, i) => (
            <View key={i} style={styles.optRow}>
              <View style={styles.optLetter}>
                <Text style={styles.optLetterText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={[styles.optText, q.answer === i && { color: '#059669', fontWeight: '700' }]}>{opt}</Text>
              {q.answer === i && <Check size={12} color="#059669" />}
            </View>
          ))}
          {q.explanation ? (
            <View style={styles.expBox}>
              <Lightbulb size={12} color="#D97706" />
              <Text style={styles.expText}>{q.explanation}</Text>
            </View>
          ) : null}
        </>
      )}

      {item.note ? (
        <Text style={styles.note}>📝 {item.note}</Text>
      ) : null}

      <View style={styles.cardActions}>
        <Pressable style={styles.removeBtn} onPress={() => onRemove(item.question_id)}>
          <Trash2 size={14} color="#EF4444" />
          <Text style={styles.removeBtnText}>Remove</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

export default function ExamPrepBookmarksScreen() {
  const { data, loading, refresh } = useFetch<BookmarkType[]>('/exam-prep/bookmarks');
  const [removing, setRemoving] = useState<string | null>(null);

  const handleRemove = async (questionId: string) => {
    Alert.alert('Remove Bookmark?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setRemoving(questionId);
          try {
            await api(`/exam-prep/bookmarks/${questionId}`, { method: 'DELETE' });
            await refresh();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          } finally {
            setRemoving(null);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Bookmarked Questions</Text>
        {data && <Text style={styles.headerCount}>{data.length}</Text>}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.brand} />
        </View>
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <BookmarkCard item={item} index={index} onRemove={handleRemove} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Bookmark size={48} color={theme.colors.textSecondary} />
              <Text style={styles.emptyTitle}>No bookmarks yet</Text>
              <Text style={styles.emptyBody}>
                While practicing or browsing the Question Bank, tap the Bookmark icon to save questions here.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={() => router.push('/exam-prep-question-bank' as any)}>
                <BookOpen size={14} color="#fff" />
                <Text style={styles.emptyBtnText}>Browse Question Bank</Text>
              </Pressable>
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
  headerCount: { fontSize: 13, fontWeight: '700', color: theme.colors.brand, backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 12, gap: 10 },

  card: { backgroundColor: theme.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  diffBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  diffText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  subject: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },
  date: { fontSize: 11, color: theme.colors.textSecondary },
  question: { fontSize: 14, fontWeight: '500', color: theme.colors.text, lineHeight: 20 },

  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3, marginTop: 6 },
  optLetter: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  optLetterText: { fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary },
  optText: { flex: 1, fontSize: 13, color: theme.colors.text },
  expBox: { flexDirection: 'row', gap: 6, marginTop: 8, alignItems: 'flex-start', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8 },
  expText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },
  note: { fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic', marginTop: 8, backgroundColor: theme.colors.surfaceSecondary, padding: 8, borderRadius: 8 },

  cardActions: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removeBtnText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },

  empty: { alignItems: 'center', paddingVertical: 60, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  emptyBody: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.brand, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
