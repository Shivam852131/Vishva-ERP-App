import React, { useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Search,
  Sparkles,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { useFetch, useMutate } from '@/src/hooks/useFetch';
import type { Note } from '@/src/types';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { theme } from '@/src/theme';
import { Card, EmptyState } from '@/src/ui';
import { downloadFile, openFile, type DownloadProgress } from '@/src/download';

type SharedNote = Note & {
  class_name?: string;
  subject?: string;
  description?: string;
  downloads?: number;
  helpful_count?: number;
};

type UploadForm = {
  title: string;
  class_name: string;
  subject: string;
  type: string;
  url: string;
  description: string;
};

const RESOURCE_TYPES = ['pdf', 'doc', 'slides', 'video', 'notes'];
const DEFAULT_CLASSES = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Faculty'];

const TYPE_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  pdf: { icon: FileText, color: '#EF4444' },
  doc: { icon: FileText, color: '#2563EB' },
  slides: { icon: BookOpen, color: '#7C3AED' },
  video: { icon: Video, color: '#3B82F6' },
  notes: { icon: BookOpen, color: '#10B981' },
};

function noteSubject(note: SharedNote) {
  return note.subject || note.course_name || 'General';
}

function noteClass(note: SharedNote) {
  return note.class_name || 'All Classes';
}

function createEmptyForm(userYear?: number): UploadForm {
  return {
    title: '',
    class_name: userYear ? `Year ${userYear}` : 'Year 3',
    subject: '',
    type: 'pdf',
    url: '',
    description: '',
  };
}

export default function Notes() {
  const { user } = useAuth();
  const { data: items, loading, refresh, setData } = useFetch<SharedNote[]>('/notes');
  const { mutate: uploadNote, loading: uploading } = useMutate<SharedNote>();
  const [query, setQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [form, setForm] = useState<UploadForm>(() => createEmptyForm(user?.year));
  const [formError, setFormError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  const itemsSafe = useMemo(() => items || [], [items]);

  const classFilters = useMemo(() => {
    const set = new Set([...DEFAULT_CLASSES, ...itemsSafe.map(noteClass)]);
    return ['All Classes', ...Array.from(set).filter(c => c !== 'All Classes')];
  }, [itemsSafe]);

  const subjectFilters = useMemo(() => {
    const set = new Set(itemsSafe.map(noteSubject));
    return ['All Subjects', ...Array.from(set).sort()];
  }, [itemsSafe]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return itemsSafe.filter((note) => {
      const subject = noteSubject(note);
      const className = noteClass(note);
      const matchesClass = selectedClass === 'All Classes' || className === selectedClass;
      const matchesSubject = selectedSubject === 'All Subjects' || subject === selectedSubject;
      const matchesSearch = !q || [
        note.title,
        subject,
        className,
        note.description,
        note.uploaded_by,
      ].some(value => String(value || '').toLowerCase().includes(q));

      return matchesClass && matchesSubject && matchesSearch;
    });
  }, [itemsSafe, query, selectedClass, selectedSubject]);

  const contributors = useMemo(() => new Set(itemsSafe.map(n => n.uploaded_by).filter(Boolean)).size, [itemsSafe]);
  const downloads = useMemo(() => itemsSafe.reduce((sum, n) => sum + (n.downloads || 0), 0), [itemsSafe]);

  const onRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 800);
  };

  const openUpload = () => {
    setForm(createEmptyForm(user?.year));
    setFormError('');
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!form.title.trim() || !form.subject.trim() || !form.class_name.trim() || !form.url.trim()) {
      setFormError('Title, class, subject, and downloadable link are required.');
      return;
    }

    setFormError('');
    const payload = {
      title: form.title.trim(),
      class_name: form.class_name.trim(),
      subject: form.subject.trim(),
      course_name: form.subject.trim(),
      type: form.type,
      url: form.url.trim(),
      description: form.description.trim(),
      uploaded_by: user?.name || 'Community Member',
    };

    try {
      const created = await uploadNote('/notes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const newNote: SharedNote = created || {
        ...payload,
        id: `local-${Date.now()}`,
        course_id: payload.subject.toLowerCase().replace(/\s+/g, '-'),
        created_at: new Date().toISOString(),
        downloads: 0,
        helpful_count: 0,
      };
      setData([newNote, ...itemsSafe.filter(n => n.id !== newNote.id)]);
      setUploadOpen(false);
    } catch (error: any) {
      setFormError(error?.message || 'Unable to upload this note.');
    }
  };

  const downloadNote = useCallback(async (note: SharedNote) => {
    if (!note.url) {
      Alert.alert('Download unavailable', 'This note does not have a downloadable link yet.');
      return;
    }
    const noteId = note.id || note.url;
    setDownloadingId(noteId);
    setDownloadProgress(null);
    try {
      const result = await downloadFile(
        note.url,
        note.title || 'download',
        (p) => setDownloadProgress(p),
      );
      Alert.alert(
        'Download Complete',
        `${result.fileName} saved. Open it now?`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open', onPress: () => openFile(result.path) },
        ],
      );
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not download this file. Try opening the link instead.');
    } finally {
      setDownloadingId(null);
      setDownloadProgress(null);
    }
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="back-btn" accessibilityLabel="Go back" style={styles.iconBtn}>
            <ArrowLeft color={theme.colors.onSurface} size={22} />
          </Pressable>
          <Text style={styles.title}>Community Notes</Text>
          <Pressable onPress={openUpload} testID="open-upload" accessibilityLabel="Upload notes" style={styles.uploadMiniBtn}>
            <Upload color="#fff" size={18} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brandPrimary} />}
        >
          <LinearGradient colors={['#022C22', '#047857', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroBadge}>
              <Sparkles color="#D1FAE5" size={14} />
              <Text style={styles.heroBadgeText}>Shared learning resources</Text>
            </View>
            <Text style={styles.heroTitle}>Learn together. Share better notes.</Text>
            <Text style={styles.heroSub}>
              Teachers and students can upload notes, guides, slides, videos, and solved papers for everyone to download.
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{itemsSafe.length}</Text>
                <Text style={styles.heroStatLabel}>Resources</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{contributors}</Text>
                <Text style={styles.heroStatLabel}>Contributors</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{downloads}</Text>
                <Text style={styles.heroStatLabel}>Downloads</Text>
              </View>
            </View>
          </LinearGradient>

          <Pressable style={styles.shareCard} onPress={openUpload} testID="share-note-card" accessibilityLabel="Share notes with community">
            <View style={styles.shareIcon}>
              <Users color={theme.colors.brandPrimary} size={22} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shareTitle}>Help your classmates</Text>
              <Text style={styles.shareSub}>Upload a link to your notes and make it visible to all students.</Text>
            </View>
            <Upload color={theme.colors.brandPrimary} size={20} />
          </Pressable>

          <View style={styles.filterCard}>
            <View style={styles.searchRow}>
              <Search color={theme.colors.muted} size={18} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search notes, class, subject, contributor..."
                placeholderTextColor={theme.colors.muted}
                style={styles.searchInput}
                testID="notes-search"
                returnKeyType="search"
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
                  <X color={theme.colors.muted} size={18} />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.filterLabel}>Filter by class</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {classFilters.map(item => (
                <Pressable key={item} onPress={() => setSelectedClass(item)} style={[styles.chip, selectedClass === item && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedClass === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>Filter by subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {subjectFilters.map(item => (
                <Pressable key={item} onPress={() => setSelectedSubject(item)} style={[styles.chip, selectedSubject === item && styles.chipActive]}>
                  <Text style={[styles.chipText, selectedSubject === item && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shared Notes</Text>
            <Text style={styles.sectionCount}>{filteredNotes.length} found</Text>
          </View>

          {loading && itemsSafe.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={theme.colors.brandPrimary} />
          ) : filteredNotes.length === 0 ? (
            <EmptyState title="No notes found" sub="Try another class or subject, or upload the first resource for your community." />
          ) : (
            <View style={styles.notesList}>
              {filteredNotes.map((note, index) => {
                const type = TYPE_ICONS[note.type] || TYPE_ICONS.notes;
                const Icon = type.icon;
                return (
                  <Card key={note.id || index} style={styles.noteCard}>
                    <View style={styles.noteTopRow}>
                      <View style={[styles.typeIcon, { backgroundColor: `${type.color}18` }]}>
                        <Icon color={type.color} size={22} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.metaRow}>
                          <Text style={styles.classBadge}>{noteClass(note)}</Text>
                          <Text style={styles.subjectBadge}>{noteSubject(note)}</Text>
                        </View>
                        <Text style={styles.noteTitle}>{note.title}</Text>
                        <Text style={styles.noteDesc} numberOfLines={2}>
                          {note.description || 'Community-shared learning material for quick revision and peer support.'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.noteFooter}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadedBy} numberOfLines={1}>Shared by {note.uploaded_by || 'Community Member'}</Text>
                        <Text style={styles.noteDate}>{new Date(note.created_at).toLocaleDateString()}</Text>
                      </View>
                      <View style={styles.footerStats}>
                        <CheckCircle2 color={theme.colors.success} size={14} />
                        <Text style={styles.footerStatText}>{note.helpful_count || 0}</Text>
                      </View>
                      <Pressable
                        onPress={() => downloadNote(note)}
                        disabled={downloadingId === (note.id || note.url)}
                        style={[
                          styles.downloadBtn,
                          downloadingId === (note.id || note.url) && styles.downloadBtnActive,
                        ]}
                        testID={`download-note-${note.id || index}`}
                        accessibilityLabel={`Download ${note.title}`}
                      >
                        {downloadingId === (note.id || note.url) ? (
                          <>
                            <ActivityIndicator color="#fff" size={14} />
                            <Text style={styles.downloadText}>
                              {downloadProgress ? `${downloadProgress.percentage}%` : 'Downloading...'}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Download color="#fff" size={15} />
                            <Text style={styles.downloadText}>Download</Text>
                          </>
                        )}
                      </Pressable>
                      {note.url ? <ExternalLink color={theme.colors.muted} size={15} /> : null}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </ScrollView>

        <Modal visible={uploadOpen} transparent animationType="slide" onRequestClose={() => setUploadOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Upload Notes</Text>
                  <Text style={styles.sheetSub}>Visible to all students after sharing</Text>
                </View>
                <Pressable onPress={() => setUploadOpen(false)} accessibilityLabel="Close upload form" hitSlop={10}>
                  <X color={theme.colors.muted} size={22} />
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Note title</Text>
                <TextInput
                  value={form.title}
                  onChangeText={title => setForm(prev => ({ ...prev, title }))}
                  placeholder="Example: DBMS normalization handwritten notes"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  testID="note-title"
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Class</Text>
                    <TextInput
                      value={form.class_name}
                      onChangeText={class_name => setForm(prev => ({ ...prev, class_name }))}
                      placeholder="Year 3 / CSE-A"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                      testID="note-class"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Subject</Text>
                    <TextInput
                      value={form.subject}
                      onChangeText={subject => setForm(prev => ({ ...prev, subject }))}
                      placeholder="Database Systems"
                      placeholderTextColor={theme.colors.muted}
                      style={styles.input}
                      testID="note-subject"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Resource type</Text>
                <View style={styles.typeRow}>
                  {RESOURCE_TYPES.map(type => (
                    <Pressable key={type} onPress={() => setForm(prev => ({ ...prev, type }))} style={[styles.typeChip, form.type === type && styles.typeChipActive]}>
                      <Text style={[styles.typeChipText, form.type === type && styles.typeChipTextActive]}>{type.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Downloadable file/link</Text>
                <TextInput
                  value={form.url}
                  onChangeText={url => setForm(prev => ({ ...prev, url }))}
                  placeholder="Paste PDF, Drive, video, or document URL"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="url"
                  testID="note-url"
                />

                <Text style={styles.inputLabel}>Short description</Text>
                <TextInput
                  value={form.description}
                  onChangeText={description => setForm(prev => ({ ...prev, description }))}
                  placeholder="Tell students what this resource helps with"
                  placeholderTextColor={theme.colors.muted}
                  style={[styles.input, styles.textArea]}
                  multiline
                  testID="note-description"
                />

                {formError ? <Text style={styles.formError}>{formError}</Text> : null}

                <Pressable onPress={submitUpload} disabled={uploading} style={[styles.submitBtn, uploading && { opacity: 0.7 }]} testID="submit-note">
                  {uploading ? <ActivityIndicator color="#fff" /> : <Upload color="#fff" size={18} />}
                  <Text style={styles.submitText}>{uploading ? 'Sharing...' : 'Share with Community'}</Text>
                </Pressable>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.lg, paddingBottom: theme.spacing.md },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border },
  uploadMiniBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.brandPrimary, ...theme.shadow.sm },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.onSurface },
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: 110 },
  hero: { borderRadius: 28, padding: theme.spacing.xl, overflow: 'hidden', ...theme.shadow.lg },
  heroBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', marginBottom: 14 },
  heroBadgeText: { color: '#D1FAE5', fontSize: 11, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.6 },
  heroSub: { color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 20, marginTop: 8 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.xl, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: theme.radius.lg, padding: theme.spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', marginTop: 2 },
  heroDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.2)' },
  shareCard: { marginTop: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12, padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm },
  shareIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.brandTertiary },
  shareTitle: { color: theme.colors.onSurface, fontSize: 15, fontWeight: '800' },
  shareSub: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: 2 },
  filterCard: { marginTop: theme.spacing.lg, backgroundColor: theme.colors.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 12, marginBottom: theme.spacing.md },
  searchInput: { flex: 1, paddingVertical: 12, color: theme.colors.onSurface, fontSize: 14 },
  filterLabel: { color: theme.colors.onSurfaceTertiary, fontSize: 12, fontWeight: '800', marginTop: 6, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  chipRow: { gap: 8, paddingRight: 8, paddingBottom: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  chipText: { color: theme.colors.onSurfaceTertiary, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  sectionTitle: { color: theme.colors.onSurface, fontSize: 17, fontWeight: '900' },
  sectionCount: { color: theme.colors.muted, fontSize: 12, fontWeight: '700' },
  notesList: { gap: 12 },
  noteCard: { marginBottom: 0 },
  noteTopRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  typeIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  classBadge: { color: theme.colors.brand, backgroundColor: theme.colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, fontSize: 10, fontWeight: '800' },
  subjectBadge: { color: theme.colors.onSurfaceTertiary, backgroundColor: theme.colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.pill, fontSize: 10, fontWeight: '800' },
  noteTitle: { color: theme.colors.onSurface, fontSize: 16, fontWeight: '900', lineHeight: 21 },
  noteDesc: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  noteFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderColor: theme.colors.divider },
  uploadedBy: { color: theme.colors.onSurfaceTertiary, fontSize: 12, fontWeight: '700' },
  noteDate: { color: theme.colors.muted, fontSize: 10, marginTop: 2 },
  footerStats: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerStatText: { color: theme.colors.success, fontSize: 11, fontWeight: '800' },
  downloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill },
  downloadBtnActive: { opacity: 0.7 },
  downloadText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: theme.colors.surfaceSecondary, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: theme.spacing.xl },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.md },
  sheetTitle: { color: theme.colors.onSurface, fontSize: 20, fontWeight: '900' },
  sheetSub: { color: theme.colors.muted, fontSize: 12, marginTop: 3 },
  inputLabel: { color: theme.colors.onSurfaceTertiary, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 13, paddingVertical: 12, color: theme.colors.onSurface, fontSize: 14 },
  formRow: { flexDirection: 'row', gap: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  typeChipActive: { backgroundColor: theme.colors.brandPrimary, borderColor: theme.colors.brandPrimary },
  typeChipText: { color: theme.colors.onSurfaceTertiary, fontSize: 11, fontWeight: '900' },
  typeChipTextActive: { color: '#fff' },
  textArea: { minHeight: 92, textAlignVertical: 'top' },
  formError: { color: theme.colors.error, fontSize: 12, fontWeight: '700', marginTop: 12 },
  submitBtn: { marginTop: theme.spacing.lg, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.brandPrimary, paddingVertical: 15, borderRadius: theme.radius.md, ...theme.shadow.md },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
