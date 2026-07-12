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
  Lock, Star, CreditCard,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Print from '@/src/native/print';
import * as Sharing from '@/src/native/sharing';
import { useAuth } from '@/src/providers/AuthContext';
import { theme } from '@/src/theme';
import { ErrorBoundary } from '@/src/ErrorBoundary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_HEIGHT = CARD_WIDTH / 1.586;

function formatCardNumber(id: string | undefined): string {
  if (!id) return '•••• •••• •••• ••••';
  const clean = id.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.replace(/(.{4})/g, '$1  ').trim();
}

function generateBarcodeLines(id: string): { width: number; opacity: number }[] {
  const seed = id || 'VU2024001CS';
  const lines: { width: number; opacity: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const charCode = seed.charCodeAt(i % seed.length);
    lines.push({
      width: (charCode + i) % 3 === 0 ? 2.5 : (charCode + i) % 2 === 0 ? 1.5 : 1,
      opacity: (charCode + i) % 4 === 0 ? 1 : (charCode + i) % 3 === 0 ? 0.8 : 0.6,
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
        style={[
          holoStyles.shimmer,
          { transform: [{ translateX }] },
        ]}
      />
      <View style={holoStyles.borderOverlay} />
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
    borderWidth: 0,
    transform: [{ skewX: '-20deg' }],
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 40,
    elevation: 0,
  },
  borderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});

// ─── EMV Chip ────────────────────────────────────
function EMVChip() {
  return (
    <View style={chipStyles.container}>
      <View style={chipStyles.chip}>
        <View style={chipStyles.chipLine} />
        <View style={[chipStyles.chipLine, { width: '60%' }]} />
        <View style={[chipStyles.chipLine, { width: '80%' }]} />
      </View>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: { marginRight: 10 },
  chip: {
    width: 36,
    height: 28,
    borderRadius: 5,
    backgroundColor: '#D4AF37',
    borderWidth: 1,
    borderColor: '#B8960F',
    padding: 3,
    justifyContent: 'space-evenly',
    overflow: 'hidden',
  },
  chipLine: {
    height: 1.5,
    backgroundColor: '#B8960F',
    borderRadius: 1,
    width: '100%',
  },
});

// ─── Front Card ──────────────────────────────────
function FrontCard({ user, cardRef }: { user: any; cardRef: React.RefObject<View | null> }) {
  return (
    <View ref={cardRef} style={styles.card}>
      <LinearGradient
        colors={['#022C22', '#064E3B', '#047857', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        <HolographicOverlay />

        {/* ── Top Section: University branding ── */}
        <View style={styles.cardTop}>
          <View style={styles.universityRow}>
            <View style={styles.universityCrest}>
              <GraduationCap size={18} color="#D4AF37" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.universityName}>VISHVA</Text>
              <Text style={styles.universitySub}>UNIVERSITY</Text>
            </View>
            <View style={styles.nfcIcon}>
              <Wifi size={14} color="rgba(212,175,55,0.6)" />
            </View>
          </View>
          <View style={styles.goldLine} />
        </View>

        {/* ── Middle: Photo + Info ── */}
        <View style={styles.cardMiddle}>
          <View style={styles.photoSection}>
            <View style={styles.photoFrame}>
              <View style={styles.photoInner}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.photoImage} contentFit="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoInitial}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
                  </View>
                )}
              </View>
            </View>
            <EMVChip />
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.cardHolderLabel}>CARDHOLDER NAME</Text>
            <Text style={styles.cardHolderName} numberOfLines={1}>
              {(user?.name || 'STUDENT NAME').toUpperCase()}
            </Text>

            <View style={styles.idRow}>
              <View>
                <Text style={styles.fieldLabel}>ID NUMBER</Text>
                <Text style={styles.idNumber}>{user?.student_id || '••••••••'}</Text>
              </View>
              <View style={styles.roleBadgeContainer}>
                <LinearGradient
                  colors={getRoleColors(user?.role)}
                  style={styles.roleBadge}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Shield size={8} color="#fff" />
                  <Text style={styles.roleBadgeText}>
                    {(user?.role || 'student').replace('_', ' ').toUpperCase()}
                  </Text>
                </LinearGradient>
              </View>
            </View>

            {user?.department && (
              <View style={styles.detailChip}>
                <Building2 size={10} color="rgba(212,175,55,0.8)" />
                <Text style={styles.detailChipText}>{user.department}</Text>
                {user?.year && (
                  <>
                    <View style={styles.detailDot} />
                    <Calendar size={10} color="rgba(212,175,55,0.8)" />
                    <Text style={styles.detailChipText}>YR {user.year}</Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── Bottom: QR + Validity ── */}
        <View style={styles.cardBottom}>
          <View style={styles.validityInfo}>
            <Text style={styles.validityLabel}>VALID</Text>
            <Text style={styles.validityDates}>08/2024 — 07/2028</Text>
          </View>
          <View style={styles.qrFrame}>
            <QRCode
              value={JSON.stringify({
                v: 'VU',
                id: user?.id,
                n: user?.name,
                s: user?.student_id,
                e: user?.email,
                r: user?.role,
                t: Date.now(),
              })}
              size={50}
              backgroundColor="transparent"
              color="#D4AF37"
              logoSize={0}
              quietZone={0}
            />
          </View>
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>TAP TO FLIP</Text>
            <View style={styles.flipArrowWrap}>
              <Text style={styles.flipArrow}>↻</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function getRoleColors(role?: string): [string, string] {
  const map: Record<string, [string, string]> = {
    student: ['#047857', '#10B981'],
    faculty: ['#6D28D9', '#A78BFA'],
    college_admin: ['#B45309', '#F59E0B'],
    super_admin: ['#B91C1C', '#F87171'],
    parent: ['#1D4ED8', '#60A5FA'],
  };
  return map[role || 'student'] || ['#047857', '#10B981'];
}

// ─── Back Card ───────────────────────────────────
function BackCard({ user }: { user: any }) {
  const barcodeLines = generateBarcodeLines(user?.student_id || '');

  return (
    <View style={styles.card}>
      <View style={styles.backContainer}>
        {/* Magnetic Stripe */}
        <View style={styles.magneticStripe}>
          <Text style={styles.magneticText}>VISHVA UNIVERSITY • CAMPUS ERP • DIGITAL ID</Text>
        </View>

        {/* Signature Strip */}
        <View style={styles.signatureSection}>
          <View style={styles.signatureStrip}>
            <Text style={styles.signaturePattern}>
              {'/// '.repeat(20)}
            </Text>
          </View>
          <View style={styles.cvvBox}>
            <Text style={styles.cvvLabel}>CVV</Text>
            <Text style={styles.cvvValue}>•••</Text>
          </View>
        </View>

        {/* Barcode */}
        <View style={styles.barcodeArea}>
          <View style={styles.barcodeLines}>
            {barcodeLines.map((line, i) => (
              <View
                key={i}
                style={[
                  styles.barcodeLine,
                  { width: line.width, opacity: line.opacity },
                ]}
              />
            ))}
          </View>
          <Text style={styles.barcodeNumber}>{formatCardNumber(user?.student_id)}</Text>
        </View>

        {/* University Info */}
        <View style={styles.backInfo}>
          <View style={styles.backInfoRow}>
            <Text style={styles.backInfoLabel}>EMERGENCY</Text>
            <Text style={styles.backInfoValue}>{user?.phone || '+91 123 456 7890'}</Text>
          </View>
          <View style={styles.backInfoRow}>
            <Text style={styles.backInfoLabel}>WEB</Text>
            <Text style={styles.backInfoValue}>www.vishvauniversity.edu</Text>
          </View>
          <View style={styles.backInfoRow}>
            <Text style={styles.backInfoLabel}>ADDR</Text>
            <Text style={styles.backInfoValue} numberOfLines={1}>Vishva University Campus, India</Text>
          </View>
        </View>

        {/* Terms */}
        <View style={styles.backFooter}>
          <Lock size={8} color="#94A3B8" />
          <Text style={styles.termsText}>
            This card is property of Vishva University. If found, return to admin office.
            Non-transferable. Must present upon request. Unauthorized use prohibited.
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
            .footer strong { color:#047857; }
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

  return (
    <ErrorBoundary>
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" />

        {/* ── Header ── */}
        <LinearGradient
          colors={['#022C22', '#064E3B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <Pressable
            testID="id-card-back-btn"
            accessibilityLabel="Go back to profile"
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color="#D4AF37" />
          </Pressable>
          <View style={styles.headerCenter}>
            <CreditCard size={16} color="#D4AF37" />
            <Text style={styles.headerTitle}>Digital ID</Text>
          </View>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Card ── */}
          <Animated.View style={[styles.cardShadow, { transform: [{ scale: glowScale }] }]}>
            <Pressable
              testID="id-card-flip"
              accessibilityLabel="Tap to flip card between front and back"
              onPress={flipCard}
            >
              <View style={[styles.cardContainer, { height: CARD_HEIGHT }]}>
                <Animated.View style={[styles.cardWrapper, { opacity: frontOpacity, transform: [{ rotateY: frontInterpolate }] }]}>
                  <FrontCard user={user} cardRef={cardFrontRef} />
                </Animated.View>
                <Animated.View style={[styles.cardWrapper, styles.cardBackWrapper, { opacity: backOpacity, transform: [{ rotateY: backInterpolate }] }]}>
                  <BackCard user={user} />
                </Animated.View>
              </View>
            </Pressable>
          </Animated.View>

          <Text style={styles.hintText}>
            {flipped ? '← Tap to see front' : 'Tap to see back →'}
          </Text>

          {/* ── Actions ── */}
          <View style={styles.actions}>
            <Pressable
              testID="id-card-share"
              accessibilityLabel="Share ID card as image"
              style={({ pressed }) => [styles.actionBtn, styles.shareBtn, pressed && styles.btnPressed]}
              onPress={shareCard}
              disabled={sharing}
            >
              <Share2 size={16} color="#D4AF37" />
              <Text style={styles.shareBtnText}>{sharing ? 'Sharing...' : 'Share'}</Text>
            </Pressable>

            <Pressable
              testID="id-card-download"
              accessibilityLabel="Download ID card as PDF"
              style={({ pressed }) => [styles.actionBtn, styles.downloadBtn, pressed && styles.btnPressed]}
              onPress={downloadPDF}
              disabled={downloading}
            >
              <Download size={16} color="#fff" />
              <Text style={styles.downloadBtnText}>{downloading ? 'Generating...' : 'PDF'}</Text>
            </Pressable>

            <Pressable
              testID="id-card-verify"
              accessibilityLabel="Verify ID card"
              style={({ pressed }) => [styles.actionBtn, styles.verifyBtn, pressed && styles.btnPressed]}
              onPress={() => setShowVerify(true)}
            >
              <Fingerprint size={16} color="#D4AF37" />
              <Text style={styles.verifyBtnText}>Verify</Text>
            </Pressable>
          </View>

          {/* ── Card Details ── */}
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Star size={14} color="#D4AF37" />
              <Text style={styles.detailsTitle}>Card Details</Text>
            </View>
            {[
              { label: 'Full Name', value: user?.name },
              { label: 'ID Number', value: user?.student_id },
              { label: 'Email', value: user?.email },
              { label: 'Department', value: user?.department },
              { label: 'Year of Study', value: user?.year ? `Year ${user.year}` : undefined },
              { label: 'College', value: user?.college },
              { label: 'Role', value: user?.role?.replace(/_/g, ' ') },
              { label: 'CGPA', value: user?.cgpa?.toString() },
            ].filter(i => i.value).map((item, idx, arr) => (
              <View key={idx} style={[styles.detailRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* ── Security Features ── */}
          <View style={styles.securityCard}>
            <View style={styles.securityHeader}>
              <Lock size={14} color="#047857" />
              <Text style={styles.securityTitle}>Security Features</Text>
            </View>
            <View style={styles.securityGrid}>
              {[
                { icon: <QrCode size={16} color="#047857" />, label: 'QR Verification' },
                { icon: <Fingerprint size={16} color="#047857" />, label: 'Unique Identity' },
                { icon: <Shield size={16} color="#047857" />, label: 'University Seal' },
                { icon: <Wifi size={16} color="#047857" />, label: 'NFC Ready' },
              ].map((f, i) => (
                <View key={i} style={styles.securityItem}>
                  {f.icon}
                  <Text style={styles.securityLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* ── Verify Modal ── */}
        {showVerify && (
          <Pressable
            testID="id-card-verify-overlay"
            accessibilityLabel="Close verification view"
            style={styles.verifyOverlay}
            onPress={() => setShowVerify(false)}
          >
            <Pressable style={styles.verifyModal} onPress={(e) => e.stopPropagation()}>
              <LinearGradient
                colors={['#022C22', '#064E3B']}
                style={styles.verifyModalHeader}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Shield size={24} color="#D4AF37" />
                <Text style={styles.verifyModalTitle}>Identity Verification</Text>
                <Text style={styles.verifyModalSub}>Scan QR code to verify identity</Text>
              </LinearGradient>

              <View style={styles.verifyQrContainer}>
                <View style={styles.verifyQrBorder}>
                  <QRCode
                    value={JSON.stringify({
                      v: 'VU',
                      id: user?.id,
                      n: user?.name,
                      s: user?.student_id,
                      e: user?.email,
                      r: user?.role,
                      t: Date.now(),
                    })}
                    size={200}
                    backgroundColor="#fff"
                    color="#022C22"
                  />
                </View>
                <View style={styles.verifyCorners}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
              </View>

              <Text style={styles.verifyUserName}>{(user?.name || '').toUpperCase()}</Text>
              <Text style={styles.verifyUserId}>{user?.student_id}</Text>

              <View style={styles.verifyBadgeRow}>
                <View style={styles.verifiedBadge}>
                  <Check size={14} color="#fff" />
                  <Text style={styles.verifiedBadgeText}>VISHVA VERIFIED</Text>
                </View>
              </View>

              <Pressable
                testID="id-card-verify-close"
                accessibilityLabel="Close verification"
                style={({ pressed }) => [styles.verifyCloseBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowVerify(false)}
              >
                <Text style={styles.verifyCloseTxt}>Close</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}
      </View>
    </ErrorBoundary>
  );
}

// ─── Styles ──────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0F0D' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#D4AF37', fontSize: 18, fontWeight: '800', letterSpacing: 1 },

  scrollContent: { padding: 20, paddingBottom: 40 },

  // Card
  cardContainer: { width: CARD_WIDTH, alignSelf: 'center' },
  cardWrapper: { position: 'absolute', width: CARD_WIDTH, backfaceVisibility: 'hidden' },
  cardBackWrapper: { transform: [{ rotateY: '180deg' }] },
  cardShadow: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardGradient: { flex: 1, justifyContent: 'space-between' },

  // Front - Top
  cardTop: { padding: 16, paddingBottom: 0 },
  universityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  universityCrest: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  universityName: { color: '#D4AF37', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  universitySub: { color: 'rgba(212,175,55,0.6)', fontSize: 8, fontWeight: '700', letterSpacing: 4, marginTop: 1 },
  nfcIcon: { padding: 4 },
  goldLine: { height: 1, backgroundColor: 'rgba(212,175,55,0.3)', marginTop: 12, borderRadius: 1 },

  // Front - Middle
  cardMiddle: { flexDirection: 'row', paddingHorizontal: 16, gap: 14, flex: 1, alignItems: 'center' },
  photoSection: { alignItems: 'center', gap: 10 },
  photoFrame: {
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4AF37',
    padding: 2,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  photoInner: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  photoInitial: { color: '#D4AF37', fontSize: 28, fontWeight: '900' },

  // Front - Info
  infoSection: { flex: 1 },
  cardHolderLabel: { color: 'rgba(212,175,55,0.5)', fontSize: 8, fontWeight: '700', letterSpacing: 1.5 },
  cardHolderName: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  fieldLabel: { color: 'rgba(212,175,55,0.5)', fontSize: 7, fontWeight: '700', letterSpacing: 1.5 },
  idNumber: { color: '#D4AF37', fontSize: 13, fontWeight: '800', letterSpacing: 2, marginTop: 2 },
  roleBadgeContainer: { alignItems: 'flex-end' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  roleBadgeText: { color: '#fff', fontSize: 7, fontWeight: '800', letterSpacing: 0.5 },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  detailChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '600' },
  detailDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(212,175,55,0.4)', marginHorizontal: 2 },

  // Front - Bottom
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  validityInfo: {},
  validityLabel: { color: 'rgba(212,175,55,0.4)', fontSize: 7, fontWeight: '700', letterSpacing: 1.5 },
  validityDates: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '600', letterSpacing: 1, marginTop: 2 },
  qrFrame: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  tapHint: { alignItems: 'center' },
  tapHintText: { color: 'rgba(212,175,55,0.3)', fontSize: 6, fontWeight: '700', letterSpacing: 1 },
  flipArrowWrap: { alignItems: 'center', justifyContent: 'center' },
  flipArrow: { color: 'rgba(212,175,55,0.3)', fontSize: 14, marginTop: 2 },

  hintText: { color: 'rgba(212,175,55,0.3)', fontSize: 11, textAlign: 'center', marginTop: 14, marginBottom: 8, letterSpacing: 0.5 },

  // Back Card
  backContainer: { flex: 1, backgroundColor: '#F8FAFC', padding: 16 },
  magneticStripe: {
    backgroundColor: '#1E293B',
    height: 36,
    marginHorizontal: -16,
    marginTop: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  magneticText: { color: 'rgba(255,255,255,0.15)', fontSize: 7, fontWeight: '600', letterSpacing: 3 },
  signatureSection: { flexDirection: 'row', gap: 8, marginBottom: 12, alignItems: 'center' },
  signatureStrip: {
    flex: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  signaturePattern: { color: '#94A3B8', fontSize: 8, letterSpacing: 1 },
  cvvBox: {
    width: 40,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cvvLabel: { color: '#94A3B8', fontSize: 6, fontWeight: '700' },
  cvvValue: { color: '#1E293B', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  barcodeArea: { alignItems: 'center', marginBottom: 10 },
  barcodeLines: { flexDirection: 'row', gap: 1.5, alignItems: 'flex-end', height: 32 },
  barcodeLine: { backgroundColor: '#1E293B', height: 32, borderRadius: 0.5 },
  barcodeNumber: { color: '#1E293B', fontSize: 11, fontWeight: '700', letterSpacing: 3, marginTop: 6 },
  backInfo: { gap: 4, marginBottom: 8 },
  backInfoRow: { flexDirection: 'row', gap: 8 },
  backInfoLabel: { color: '#94A3B8', fontSize: 8, fontWeight: '700', width: 60, letterSpacing: 0.5 },
  backInfoValue: { color: '#334155', fontSize: 8, fontWeight: '600', flex: 1 },
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
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  shareBtn: { backgroundColor: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.25)' },
  shareBtnText: { color: '#D4AF37', fontWeight: '700', fontSize: 12 },
  downloadBtn: { backgroundColor: '#047857', borderColor: '#047857' },
  downloadBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  verifyBtn: { backgroundColor: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.25)' },
  verifyBtnText: { color: '#D4AF37', fontWeight: '700', fontSize: 12 },

  // Details Card
  detailsCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    paddingBottom: 8,
  },
  detailsTitle: { color: '#D4AF37', fontSize: 14, fontWeight: '800' },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detailLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },
  detailValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', textTransform: 'capitalize', flex: 1, textAlign: 'right', marginLeft: 12 },

  // Security Card
  securityCard: {
    backgroundColor: 'rgba(4,120,87,0.08)',
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(4,120,87,0.15)',
    padding: 16,
  },
  securityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  securityTitle: { color: '#10B981', fontSize: 14, fontWeight: '800' },
  securityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(4,120,87,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  securityLabel: { color: '#10B981', fontSize: 10, fontWeight: '700' },

  // Verify Modal
  verifyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  verifyModal: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0A0F0D',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  verifyModalHeader: {
    padding: 24,
    alignItems: 'center',
  },
  verifyModalTitle: { color: '#D4AF37', fontSize: 20, fontWeight: '900', marginTop: 10 },
  verifyModalSub: { color: 'rgba(212,175,55,0.5)', fontSize: 12, marginTop: 4 },
  verifyQrContainer: {
    alignSelf: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginVertical: 20,
    borderWidth: 3,
    borderColor: '#D4AF37',
  },
  verifyQrBorder: {
    overflow: 'hidden',
  },
  verifyCorners: { ...StyleSheet.absoluteFillObject },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: '#047857' },
  cornerTL: { top: 8, left: 8, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 3, borderRightWidth: 3 },
  verifyUserName: { color: '#F8FAFC', fontSize: 18, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  verifyUserId: { color: '#D4AF37', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 4, letterSpacing: 2 },
  verifyBadgeRow: { alignItems: 'center', marginTop: 16 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  verifiedBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  verifyCloseBtn: {
    margin: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  verifyCloseTxt: { color: '#94A3B8', fontWeight: '700', fontSize: 14 },
});
