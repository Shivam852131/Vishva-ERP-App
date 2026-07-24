import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  ScrollView, Dimensions, RefreshControl, StatusBar,
} from 'react-native';
import { LinearGradient } from '@/src/components/LinearGradient';
import { AppImage as Image } from '@/src/components/AppImage';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Download, Share2, QrCode, Shield, Calendar,
  Building2, GraduationCap, User, Check, Fingerprint, Wifi,
  Lock, Star, CreditCard, ChevronRight, BadgeCheck,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Print from '@/src/native/print';
import * as Sharing from '@/src/native/sharing';
import { useAuth } from '@/src/providers/AuthContext';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

function generateBarcodeLines(id: string): { width: number; opacity: number }[] {
  const seed = id || '5049199';
  const lines: { width: number; opacity: number }[] = [];
  for (let i = 0; i < 50; i++) {
    const charCode = seed.charCodeAt(i % seed.length);
    lines.push({
      width: (charCode + i) % 3 === 0 ? 2.5 : (charCode + i) % 2 === 0 ? 1.5 : 1,
      opacity: 1,
    });
  }
  return lines;
}

// ─── Holographic Shimmer ─────────────────────────
function HolographicOverlay() {
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: -1, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const translateX = shimmerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-CARD_WIDTH, CARD_WIDTH * 2],
  });

  return (
    <View style={holoStyles.container} pointerEvents="none">
      <Animated.View
        style={[holoStyles.shimmer, { transform: [{ translateX }] }]}
      />
    </View>
  );
}

const holoStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: -100,
    width: 120,
    height: CARD_HEIGHT + 200,
    backgroundColor: 'transparent',
    transform: [{ skewX: '-20deg' }],
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 0,
  },
});

// ─── Front Card (MIT-style vertical) ─────────────
function FrontCard({ user, cardRef }: { user: any; cardRef: React.RefObject<View | null> }) {
  return (
    <View ref={cardRef} style={s.card}>
      {/* White Header with MIT-style logo */}
      <View style={s.whiteHeader}>
        <View style={s.headerLogoRow}>
          <View style={s.mitLogo}>
            <Text style={s.mitLetter}>M</Text>
            <Text style={s.mitLetter}>I</Text>
            <Text style={s.mitLetter}>T</Text>
          </View>
          <Text style={s.universityHeaderText}>VISHVA UNIVERSITY</Text>
        </View>
      </View>

      {/* Green Teal Background Section */}
      <LinearGradient
        colors={['#0D7377', '#14919B', '#0D7377']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.tealSection}
      >
        <HolographicOverlay />
        {/* Geometric decorative elements */}
        <View style={s.geoDecor1} />
        <View style={s.geoDecor2} />
        <View style={s.geoDecor3} />

        {/* Profile Photo */}
        <View style={s.photoContainer}>
          <View style={s.photoRing}>
            <View style={s.photoInner}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={s.photoImage} contentFit="cover" />
              ) : (
                <View style={s.photoPlaceholder}>
                  <User size={40} color="#475569" />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Student Name */}
        <Text style={s.studentName}>{(user?.name || 'SHIVAM KUMAR').toUpperCase()}</Text>

        {/* Student ID Label */}
        <Text style={s.studentIdLabel}>Student ID</Text>
        <Text style={s.studentIdNumber}>{user?.student_id || '5049199'}</Text>
      </LinearGradient>

      {/* Details Section */}
      <View style={s.detailsSection}>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Branch :</Text>
          <Text style={s.detailValue}>{user?.department || 'COMPUTER SCIENCE AND ENGINEERING (DATA SCIENCE)'}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Semester :</Text>
          <Text style={s.detailValue}>{user?.semester || 'SEM 5'}</Text>
        </View>
        <View style={s.detailRow}>
          <Text style={s.detailLabel}>Session :</Text>
          <Text style={s.detailValue}>{user?.session || '2026-2027'}</Text>
        </View>
        <View style={[s.detailRow, { borderBottomWidth: 0 }]}>
          <Text style={s.detailLabel}>Roll No. :</Text>
          <Text style={s.detailValue}>{user?.roll_no || '2402921540027'}</Text>
        </View>
      </View>

      {/* Barcode Section */}
      <View style={s.barcodeSection}>
        <View style={s.barcodeLines}>
          {generateBarcodeLines(user?.student_id || '5049199').map((line, i) => (
            <View
              key={i}
              style={[s.barcodeLine, { width: line.width, opacity: line.opacity }]}
            />
          ))}
        </View>
        <Text style={s.barcodeNumber}>{user?.student_id || '5049199'}</Text>
      </View>
    </View>
  );
}

// ─── Back Card ───────────────────────────────────
function BackCard({ user }: { user: any }) {
  return (
    <View style={s.card}>
      <View style={s.backContainer}>
        {/* Header */}
        <View style={s.backHeader}>
          <View style={s.backLogoRow}>
            <View style={s.mitLogo}>
              <Text style={s.mitLetter}>M</Text>
              <Text style={s.mitLetter}>I</Text>
              <Text style={s.mitLetter}>T</Text>
            </View>
            <Text style={s.backHeaderText}>VISHVA UNIVERSITY</Text>
          </View>
          <Text style={s.backSubText}>DIGITAL IDENTITY CARD</Text>
        </View>

        {/* QR Code */}
        <View style={s.backQrSection}>
          <View style={s.backQrBorder}>
            <QRCode
              value={JSON.stringify({
                v: 'VU',
                id: user?.id,
                n: user?.name,
                s: user?.student_id,
                e: user?.email,
                r: user?.role,
              })}
              size={120}
              backgroundColor="#fff"
              color="#0D7377"
            />
          </View>
        </View>

        {/* Info */}
        <View style={s.backInfo}>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>NAME</Text>
            <Text style={s.backInfoValue}>{(user?.name || 'SHIVAM KUMAR').toUpperCase()}</Text>
          </View>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>ID</Text>
            <Text style={s.backInfoValue}>{user?.student_id || '5049199'}</Text>
          </View>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>EMAIL</Text>
            <Text style={s.backInfoValue}>{user?.email || 'student@vishva.edu'}</Text>
          </View>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>PHONE</Text>
            <Text style={s.backInfoValue}>{user?.phone || '+91 9876543210'}</Text>
          </View>
        </View>

        {/* Magnetic Stripe */}
        <View style={s.magneticStripe}>
          <Text style={s.magneticText}>VISHVA UNIVERSITY • CAMPUS ERP • DIGITAL ID</Text>
        </View>

        {/* Terms */}
        <View style={s.backFooter}>
          <Lock size={8} color="#94A3B8" />
          <Text style={s.termsText}>
            This card is property of Vishva University. If found, return to admin office.
            Non-transferable. Must present upon request.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────
export default function IdCardScreen() {
  const { user } = useAuth();
  const [flipped, setFlipped] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const cardFrontRef = useRef<View>(null);

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 91, 180],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 90, 91, 180],
    outputRange: [0, 0, 1, 1],
  });
  const glowScale = glowAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.02, 1],
  });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const flipCard = () => {
    Animated.parallel([
      Animated.spring(flipAnim, {
        toValue: flipped ? 0 : 180,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.spring(glowAnim, { toValue: 1, friction: 3, tension: 50, useNativeDriver: true }),
        Animated.spring(glowAnim, { toValue: 0, friction: 8, tension: 10, useNativeDriver: true }),
      ]),
    ]).start();
    setFlipped(!flipped);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
  };

  const shareCard = async () => {
    if (!cardFrontRef.current) return;
    try {
      setSharing(true);
      const uri = await captureRef(cardFrontRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Vishva ID Card' });
      }
    } catch (err) {
      console.warn('Share failed:', err);
    } finally {
      setSharing(false);
    }
  };

  const downloadPDF = async () => {
    if (!cardFrontRef.current) return;
    try {
      setDownloading(true);
      const uri = await captureRef(cardFrontRef, { format: 'png', quality: 1 });
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        fetch(uri).then(res => res.blob()).then(blob => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }).catch(reject);
      });
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { size: A4; margin: 40mm; }
            body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#f0f0f0; font-family: -apple-system, sans-serif; }
            .card { max-width:100%; border-radius:16px; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
            .footer { text-align:center; margin-top:24px; color:#666; font-size:12px; }
            .footer strong { color:#0D7377; }
          </style>
        </head>
        <body>
          <div>
            <img class="card" src="${base64}" />
            <div class="footer">
              <strong>Vishva University</strong> — Digital Identity Card<br/>
              Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </body>
        </html>`;
      await Print.printAsync({ html });
    } catch (err) {
      console.warn('PDF failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const detailItems = [
    { label: 'Full Name', value: user?.name },
    { label: 'ID Number', value: user?.student_id },
    { label: 'Email', value: user?.email },
    { label: 'Department', value: user?.department },
    { label: 'Year of Study', value: user?.year ? `Year ${user.year}` : undefined },
    { label: 'College', value: user?.college },
    { label: 'Role', value: user?.role?.replace(/_/g, ' ') },
    { label: 'CGPA', value: user?.cgpa?.toString() },
  ].filter(i => i.value);

  return (
    <ErrorBoundary>
      <View style={s.screen}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={theme.colors.text} />
          </Pressable>
          <View style={s.headerCenter}>
            <CreditCard size={18} color="#0D7377" />
            <Text style={s.headerTitle}>Digital ID</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D7377" />}
          showsVerticalScrollIndicator={false}
        >
          {/* Card with flip */}
          <Animated.View style={[s.cardShadow, { transform: [{ scale: glowScale }] }]}>
            <Pressable onPress={flipCard}>
              <View style={[s.cardContainer, { height: CARD_HEIGHT }]}>
                <Animated.View style={[s.cardWrapper, { opacity: frontOpacity, transform: [{ rotateY: frontInterpolate }] }]}>
                  <FrontCard user={user} cardRef={cardFrontRef} />
                </Animated.View>
                <Animated.View style={[s.cardWrapper, s.cardBackWrapper, { opacity: backOpacity, transform: [{ rotateY: backInterpolate }] }]}>
                  <BackCard user={user} />
                </Animated.View>
              </View>
            </Pressable>
          </Animated.View>

          <Text style={s.hintText}>
            {flipped ? '\u2190 Tap to see front' : 'Tap to see back \u2192'}
          </Text>

          {/* Action buttons */}
          <View style={s.actions}>
            <Pressable style={({ pressed }) => [s.actionBtn, s.shareBtn, pressed && s.btnPressed]} onPress={shareCard} disabled={sharing}>
              <Share2 size={16} color="#0D7377" />
              <Text style={s.shareBtnText}>{sharing ? 'Sharing...' : 'Share'}</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [s.actionBtn, s.downloadBtn, pressed && s.btnPressed]} onPress={downloadPDF} disabled={downloading}>
              <Download size={16} color="#fff" />
              <Text style={s.downloadBtnText}>{downloading ? 'Generating...' : 'PDF'}</Text>
            </Pressable>

            <Pressable style={({ pressed }) => [s.actionBtn, s.verifyBtn, pressed && s.btnPressed]} onPress={() => setShowVerify(true)}>
              <Fingerprint size={16} color="#0D7377" />
              <Text style={s.verifyBtnText}>Verify</Text>
            </Pressable>
          </View>

          {/* Card Details */}
          <Card style={s.detailsCard}>
            <View style={s.detailsHeader}>
              <Star size={14} color="#0D7377" />
              <Text style={s.detailsTitle}>Card Details</Text>
            </View>
            {detailItems.map((item, idx, arr) => (
              <View key={idx} style={[s.detailInfoRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.detailInfoLabel}>{item.label}</Text>
                <Text style={s.detailInfoValue}>{item.value}</Text>
              </View>
            ))}
          </Card>

          {/* Security Features */}
          <Card style={s.securityCard}>
            <View style={s.securityHeader}>
              <Shield size={14} color="#0D7377" />
              <Text style={s.securityTitle}>Security Features</Text>
            </View>
            <View style={s.securityGrid}>
              {[
                { icon: <QrCode size={16} color="#0D7377" />, label: 'QR Verification' },
                { icon: <Fingerprint size={16} color="#0D7377" />, label: 'Unique Identity' },
                { icon: <BadgeCheck size={16} color="#0D7377" />, label: 'University Seal' },
                { icon: <Wifi size={16} color="#0D7377" />, label: 'NFC Ready' },
              ].map((f, i) => (
                <View key={i} style={s.securityItem}>
                  {f.icon}
                  <Text style={s.securityLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        </ScrollView>

        {/* Verify Modal */}
        {showVerify && (
          <Pressable style={s.verifyOverlay} onPress={() => setShowVerify(false)}>
            <Pressable style={s.verifyModal} onPress={(e) => e.stopPropagation()}>
              <View style={s.verifyModalHeader}>
                <View style={s.verifyIconWrap}>
                  <Shield size={28} color="#0D7377" />
                </View>
                <Text style={s.verifyModalTitle}>Identity Verification</Text>
                <Text style={s.verifyModalSub}>Scan QR code to verify identity</Text>
              </View>

              <View style={s.verifyQrContainer}>
                <View style={s.verifyQrBorder}>
                  <QRCode
                    value={JSON.stringify({ v: 'VU', id: user?.id, n: user?.name, s: user?.student_id })}
                    size={200}
                    backgroundColor="#fff"
                    color="#0D7377"
                  />
                </View>
              </View>

              <Text style={s.verifyUserName}>{(user?.name || '').toUpperCase()}</Text>
              <Text style={s.verifyUserId}>{user?.student_id}</Text>

              <View style={s.verifyBadgeRow}>
                <View style={s.verifiedBadge}>
                  <Check size={14} color="#fff" />
                  <Text style={s.verifiedBadgeText}>VISHVA VERIFIED</Text>
                </View>
              </View>

              <Pressable style={({ pressed }) => [s.verifyCloseBtn, pressed && { opacity: 0.7 }]} onPress={() => setShowVerify(false)}>
                <Text style={s.verifyCloseTxt}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
      </View>
    </ErrorBoundary>
  );
}

// ─── Styles ──────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.surface },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.surfaceSecondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: theme.colors.surfaceTertiary,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  cardContainer: { width: CARD_WIDTH, alignSelf: 'center' },
  cardWrapper: { position: 'absolute', width: CARD_WIDTH, backfaceVisibility: 'hidden' },
  cardBackWrapper: { transform: [{ rotateY: '180deg' }] },
  cardShadow: {
    shadowColor: '#0D7377',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },

  // White Header
  whiteHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mitLogo: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
  },
  mitLetter: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
    lineHeight: 12,
    letterSpacing: 0,
  },
  universityHeaderText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 1,
  },

  // Teal Section
  tealSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  geoDecor1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ rotate: '45deg' }],
  },
  geoDecor2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.04)',
    transform: [{ rotate: '45deg' }],
  },
  geoDecor3: {
    position: 'absolute',
    top: 20,
    left: 30,
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.03)',
    transform: [{ rotate: '45deg' }],
  },

  photoContainer: { alignItems: 'center', marginBottom: 14 },
  photoRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
    padding: 3,
  },
  photoInner: {
    flex: 1,
    borderRadius: 42,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CBD5E1',
  },

  studentName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  studentIdLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  studentIdNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
    textAlign: 'center',
    marginTop: 2,
  },

  // Details Section
  detailsSection: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    width: 90,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
    textTransform: 'uppercase',
  },

  // Barcode
  barcodeSection: {
    alignItems: 'center',
    marginTop: 16,
    paddingBottom: 16,
  },
  barcodeLines: {
    flexDirection: 'row',
    gap: 1.2,
    alignItems: 'flex-end',
    height: 36,
  },
  barcodeLine: {
    backgroundColor: '#1E293B',
    height: 36,
    borderRadius: 0.5,
  },
  barcodeNumber: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 6,
  },

  hintText: { color: theme.colors.muted, fontSize: 11, textAlign: 'center', marginTop: 14, marginBottom: 8, letterSpacing: 0.5 },

  // Back Card
  backContainer: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  backHeader: {
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 12,
  },
  backLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backHeaderText: { fontSize: 14, fontWeight: '900', color: '#1E293B', letterSpacing: 1 },
  backSubText: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 2, marginTop: 4 },
  backQrSection: { alignItems: 'center', marginVertical: 12 },
  backQrBorder: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0D7377',
  },
  backInfo: { gap: 6, marginBottom: 12 },
  backInfoRow: { flexDirection: 'row', gap: 8 },
  backInfoLabel: { color: '#64748B', fontSize: 9, fontWeight: '700', width: 50, letterSpacing: 0.5 },
  backInfoValue: { color: '#1E293B', fontSize: 9, fontWeight: '600', flex: 1 },
  magneticStripe: {
    backgroundColor: '#1E293B',
    height: 32,
    marginHorizontal: -16,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  magneticText: { color: 'rgba(255,255,255,0.15)', fontSize: 7, fontWeight: '600', letterSpacing: 3 },
  backFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  termsText: { color: '#94A3B8', fontSize: 7, lineHeight: 11, flex: 1 },

  // Actions
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
  },
  btnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  shareBtn: { backgroundColor: theme.colors.surfaceSecondary, borderColor: theme.colors.border },
  shareBtnText: { color: '#0D7377', fontWeight: '700', fontSize: 12 },
  downloadBtn: { backgroundColor: '#0D7377', borderColor: '#0D7377' },
  downloadBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  verifyBtn: { backgroundColor: theme.colors.surfaceSecondary, borderColor: theme.colors.border },
  verifyBtnText: { color: '#0D7377', fontWeight: '700', fontSize: 12 },

  // Details Card
  detailsCard: { marginTop: 20 },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  detailsTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  detailInfoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  detailInfoLabel: { color: theme.colors.muted, fontSize: 12, fontWeight: '500' },
  detailInfoValue: { color: theme.colors.text, fontSize: 12, fontWeight: '700', textTransform: 'capitalize', flex: 1, textAlign: 'right', marginLeft: 12 },

  // Security Card
  securityCard: { marginTop: 12, borderColor: '#CCFBF1', backgroundColor: '#F0FDFA' },
  securityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  securityTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  securityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  securityItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: theme.colors.surfaceSecondary,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  securityLabel: { color: theme.colors.text, fontSize: 10, fontWeight: '700' },

  // Verify Modal
  verifyOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.overlay,
    justifyContent: 'center', alignItems: 'center', zIndex: 999,
  },
  verifyModal: {
    width: SCREEN_WIDTH - 48, borderRadius: 24, overflow: 'hidden',
    backgroundColor: theme.colors.surfaceSecondary, borderWidth: 1, borderColor: theme.colors.border,
  },
  verifyModalHeader: { padding: 24, alignItems: 'center' },
  verifyIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  verifyModalTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900' },
  verifyModalSub: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  verifyQrContainer: {
    alignSelf: 'center', padding: 16, backgroundColor: '#fff',
    borderRadius: 16, marginVertical: 20, borderWidth: 3, borderColor: '#0D7377',
  },
  verifyQrBorder: { overflow: 'hidden' },
  verifyUserName: { color: theme.colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  verifyUserId: { color: '#0D7377', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 4, letterSpacing: 2 },
  verifyBadgeRow: { alignItems: 'center', marginTop: 16 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#0D7377', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  verifiedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  verifyCloseBtn: {
    margin: 20, paddingVertical: 12, borderRadius: 12,
    backgroundColor: theme.colors.surfaceTertiary, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center',
  },
  verifyCloseTxt: { color: theme.colors.muted, fontWeight: '700', fontSize: 14 },
});
