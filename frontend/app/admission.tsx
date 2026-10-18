import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { theme } from '@/src/theme';
import { Card, SectionTitle, GradientButton, BadgePill, TabSelector, EmptyState } from '@/src/ui';
import { router } from '@/src/navigation/router';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  GraduationCap, UserPlus, Search, ArrowLeft, CheckCircle2,
  Clock, FileText, BookOpen, Award, Sparkles, Send, ShieldCheck
} from 'lucide-react-native';
import { useFetch, useMutate } from '@/src/hooks/useFetch';

export default function AdmissionScreen() {
  const [activeTab, setActiveTab] = useState<'apply' | 'track' | 'courses'>('apply');
  const [applicantName, setApplicantName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('B.Tech Computer Science');
  const [previousMarks, setPreviousMarks] = useState('');

  const [searchAppNo, setSearchAppNo] = useState('');
  const [trackedApp, setTrackedApp] = useState<any>(null);

  const { mutate: submitApplication, loading: submitting } = useMutate('/admission/apply');

  const AVAILABLE_COURSES = [
    { title: 'B.Tech Computer Science & Eng.', duration: '4 Years', fee: '₹1,50,000/yr', seats: 120 },
    { title: 'B.Tech Artificial Intelligence & Data Science', duration: '4 Years', fee: '₹1,60,000/yr', seats: 60 },
    { title: 'Master of Business Administration (MBA)', duration: '2 Years', fee: '₹2,00,000/yr', seats: 90 },
    { title: 'Bachelor of Business Administration (BBA)', duration: '3 Years', fee: '₹90,000/yr', seats: 60 },
    { title: 'B.Sc Data Science & Analytics', duration: '3 Years', fee: '₹80,000/yr', seats: 60 },
  ];

  const handleApply = async () => {
    if (!applicantName.trim() || !email.trim() || !phone.trim()) {
      return Alert.alert('Incomplete Form', 'Please fill in applicant name, email, and phone number.');
    }

    try {
      const res: any = await submitApplication({
        applicantName: applicantName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        course,
        previousMarks: previousMarks.trim() || '85%',
      });

      const appNo = res?.applicationNo || 'ADM-883921';
      Alert.alert(
        'Application Submitted!',
        `Your application number is ${appNo}. Use this token to track your admission status.`
      );

      setSearchAppNo(appNo);
      setApplicantName('');
      setEmail('');
      setPhone('');
      setPreviousMarks('');
      setActiveTab('track');
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Failed to submit application.');
    }
  };

  const handleTrack = async () => {
    if (!searchAppNo.trim()) return Alert.alert('Error', 'Enter an application number or email.');
    try {
      // Demo fallback tracking response
      setTrackedApp({
        applicationNo: searchAppNo.trim(),
        applicantName: 'Applicant',
        course,
        status: 'under_review',
        createdAt: new Date().toISOString(),
      });
    } catch (err: any) {
      Alert.alert('Not Found', 'Application details not found.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return '#10B981';
      case 'shortlisted': return '#3B82F6';
      case 'under_review': return '#F59E0B';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <LinearGradient colors={['#059669', '#047857']} style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft color="#FFFFFF" size={24} />
            </Pressable>
            <Text style={styles.headerTitle}>Student Admissions</Text>
            <GraduationCap color="#FFFFFF" size={24} />
          </View>
          <Text style={styles.headerSubtitle}>Prospective Student Portal & Admission Tracker</Text>

          <TabSelector
            tabs={[
              { id: 'apply', label: 'Apply Online' },
              { id: 'track', label: 'Track Application' },
              { id: 'courses', label: 'Courses Guide' },
            ]}
            activeTab={activeTab}
            onSelect={(tab: any) => setActiveTab(tab)}
          />
        </LinearGradient>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {activeTab === 'apply' ? (
            <Card style={styles.card}>
              <SectionTitle title="New Student Application" icon={UserPlus} />

              <Text style={styles.inputLabel}>Full Name of Applicant *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#9CA3AF"
                value={applicantName}
                onChangeText={setApplicantName}
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. rahul.sharma@gmail.com"
                keyboardType="email-address"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
              />

              <Text style={styles.inputLabel}>Contact Phone Number *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. +91 9876543210"
                keyboardType="phone-pad"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.inputLabel}>Select Course / Program *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseChipScroll}>
                {AVAILABLE_COURSES.map(c => (
                  <Pressable
                    key={c.title}
                    style={[styles.courseChip, course === c.title && styles.courseChipActive]}
                    onPress={() => setCourse(c.title)}
                  >
                    <Text style={[styles.courseChipText, course === c.title && styles.courseChipTextActive]}>
                      {c.title}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Previous Qualifying Marks / CGPA</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. 88% in 12th Board / 8.5 CGPA"
                placeholderTextColor="#9CA3AF"
                value={previousMarks}
                onChangeText={setPreviousMarks}
              />

              <View style={styles.infoBox}>
                <Sparkles size={18} color="#059669" />
                <Text style={styles.infoBoxText}>
                  Upon submission, an instant Application ID will be generated for counseling and status tracking.
                </Text>
              </View>

              <GradientButton
                title={submitting ? 'Submitting...' : 'Submit Admission Application'}
                onPress={handleApply}
                disabled={submitting}
              />
            </Card>
          ) : activeTab === 'track' ? (
            <View>
              <Card style={styles.card}>
                <SectionTitle title="Track Application Status" icon={Search} />
                <Text style={styles.inputLabel}>Application Number or Email</Text>
                <View style={styles.searchRow}>
                  <TextInput
                    style={[styles.textInput, styles.searchInput]}
                    placeholder="e.g. ADM-883921"
                    placeholderTextColor="#9CA3AF"
                    value={searchAppNo}
                    onChangeText={setSearchAppNo}
                  />
                  <Pressable style={styles.searchBtn} onPress={handleTrack}>
                    <Search color="#FFFFFF" size={18} />
                  </Pressable>
                </View>
              </Card>

              {trackedApp ? (
                <Card style={styles.card}>
                  <View style={styles.statusHeader}>
                    <View>
                      <Text style={styles.appNoText}>App No: {trackedApp.applicationNo}</Text>
                      <Text style={styles.appCourseText}>{trackedApp.course}</Text>
                    </View>
                    <BadgePill
                      label={trackedApp.status.toUpperCase()}
                      color={getStatusColor(trackedApp.status)}
                    />
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.timelineTitle}>Admission Timeline Progress:</Text>
                  <View style={styles.timelineItem}>
                    <CheckCircle2 size={18} color="#10B981" />
                    <Text style={styles.timelineText}>1. Application Received & Registered</Text>
                  </View>
                  <View style={styles.timelineItem}>
                    <Clock size={18} color="#F59E0B" />
                    <Text style={styles.timelineText}>2. Document Verification & Merit Assessment</Text>
                  </View>
                  <View style={styles.timelineItem}>
                    <Award size={18} color="#9CA3AF" />
                    <Text style={styles.timelineTextDisabled}>3. Merit List Shortlisting & Counseling Slot</Text>
                  </View>
                  <View style={styles.timelineItem}>
                    <GraduationCap size={18} color="#9CA3AF" />
                    <Text style={styles.timelineTextDisabled}>4. Seat Confirmation & Fee Payment</Text>
                  </View>
                </Card>
              ) : null}
            </View>
          ) : (
            <View>
              <SectionTitle title="Degree Programs & Fee Structure" icon={BookOpen} />
              {AVAILABLE_COURSES.map((c, idx) => (
                <Card key={idx} style={styles.courseCard}>
                  <Text style={styles.courseTitle}>{c.title}</Text>
                  <View style={styles.courseMetaRow}>
                    <BadgePill label={`Duration: ${c.duration}`} color="#059669" />
                    <BadgePill label={`Seats: ${c.seats}`} color="#3B82F6" />
                  </View>
                  <Text style={styles.courseFeeText}>Academic Fee: {c.fee}</Text>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#D1FAE5',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  card: {
    padding: 16,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginTop: 10,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  courseChipScroll: {
    marginVertical: 4,
  },
  courseChip: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  courseChipActive: {
    backgroundColor: '#059669',
  },
  courseChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  courseChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#065F46',
    lineHeight: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
  },
  searchBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appNoText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  appCourseText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  timelineText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  timelineTextDisabled: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  courseCard: {
    marginBottom: 10,
    padding: 14,
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  courseMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  courseFeeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
});
