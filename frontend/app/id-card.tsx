import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  ScrollView, Dimensions, RefreshControl, StatusBar,
  Alert, Platform, Linking, ActivityIndicator,
} from 'react-native';
import RNFS from 'react-native-fs';
import { LinearGradient } from '@/src/components/LinearGradient';
import { AppImage as Image } from '@/src/components/AppImage';
import { router } from '@/src/navigation/router';
import {
  ArrowLeft, Download, Share2, QrCode, Shield,
  Building2, GraduationCap, User, Check, Fingerprint, Wifi,
  Lock, Star, CreditCard, BadgeCheck, BookOpen, Users, Crown,
  FileText, X,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from '@/src/native/sharing';
import { useAuth } from '@/src/providers/AuthContext';
import { theme } from '@/src/theme';
import { Card, SectionTitle } from '@/src/ui';
import { ErrorBoundary } from '@/src/ErrorBoundary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
// Stacked card content needs ~545pt. A pure ratio height clips the barcode on
// narrow devices (CARD_WIDTH * 1.5 is only 420pt on a 320pt-wide screen).
const CARD_HEIGHT = Math.max(CARD_WIDTH * 1.5, 560);

type RoleTheme = {
  label: string;
  idLabel: string;
  accent: string;
  gradient: [string, string, string];
  Icon: React.ElementType;
};

const ROLE_THEMES: Record<string, RoleTheme> = {
  student: {
    label: 'STUDENT',
    idLabel: 'Student ID',
    accent: '#0D7377',
    gradient: ['#0D7377', '#14919B', '#0D7377'],
    Icon: GraduationCap,
  },
  faculty: {
    label: 'FACULTY',
    idLabel: 'Faculty ID',
    accent: '#1D4ED8',
    gradient: ['#1E3A8A', '#2563EB', '#1E3A8A'],
    Icon: BookOpen,
  },
  parent: {
    label: 'PARENT / GUARDIAN',
    idLabel: 'Guardian ID',
    accent: '#6D28D9',
    gradient: ['#5B21B6', '#7C3AED', '#5B21B6'],
    Icon: Users,
  },
  college_admin: {
    label: 'COLLEGE ADMIN',
    idLabel: 'Staff ID',
    accent: '#B45309',
    gradient: ['#92400E', '#D97706', '#92400E'],
    Icon: Building2,
  },
  super_admin: {
    label: 'SUPER ADMIN',
    idLabel: 'Admin ID',
    accent: '#BE123C',
    gradient: ['#9F1239', '#E11D48', '#9F1239'],
    Icon: Crown,
  },
};

function themeForRole(role?: string): RoleTheme {
  return ROLE_THEMES[role || 'student'] || ROLE_THEMES.student;
}

// The backend only issues student_id for students, so derive a stable code from
// the user id for every other role instead of rendering a blank field.
function displayIdFor(user: any): string {
  if (user?.student_id) return String(user.student_id);
  const raw = String(user?.id || '');
  if (!raw) return '—';
  const initials = String(user?.role || 'user')
    .split('_')
    .map(part => part[0])
    .join('')
    .toUpperCase();
  return `${initials}-${raw.slice(-6).toUpperCase()}`;
}

function collegeNameFor(user: any): string {
  return user?.collegeName || user?.college || 'College not assigned';
}

function detailRowsFor(user: any): { label: string; value: string }[] {
  const role = user?.role;
  const rows: { label: string; value: string }[] = [];

  if (role === 'student') {
    if (user?.department) rows.push({ label: 'Branch', value: user.department });
    if (user?.year) rows.push({ label: 'Year', value: `Year ${user.year}` });
    if (user?.cgpa != null) rows.push({ label: 'CGPA', value: String(user.cgpa) });
  } else if (role === 'faculty') {
    if (user?.department) rows.push({ label: 'Department', value: user.department });
    rows.push({ label: 'Designation', value: 'Faculty Member' });
  } else if (role === 'parent') {
    rows.push({ label: 'Relation', value: 'Parent / Guardian' });
    if (user?.phone) rows.push({ label: 'Contact', value: user.phone });
  } else {
    rows.push({ label: 'Designation', value: themeForRole(role).label });
    if (user?.department) rows.push({ label: 'Department', value: user.department });
  }

  rows.push({ label: 'Institute', value: collegeNameFor(user) });
  return rows.slice(0, 4);
}

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

// ─── Front Card (vertical badge) ─────────────────
function FrontCard({
  user,
  cardRef,
  hideHolo = false,
}: {
  user: any;
  cardRef?: React.RefObject<View | null>;
  hideHolo?: boolean;
}) {
  const roleTheme = themeForRole(user?.role);
  const RoleIcon = roleTheme.Icon;
  const displayId = displayIdFor(user);
  const rows = detailRowsFor(user);
  const collegeName = collegeNameFor(user);

  return (
    <View ref={cardRef} collapsable={false} style={s.card}>
      {/* White header with institute mark */}
      <View style={s.whiteHeader}>
        <View style={s.headerLogoRow}>
          <View style={[s.instituteMark, { backgroundColor: roleTheme.accent }]}>
            <RoleIcon size={16} color="#fff" />
          </View>
          <Text style={s.universityHeaderText} numberOfLines={1}>{collegeName.toUpperCase()}</Text>
        </View>
      </View>

      {/* Role-coloured identity section */}
      <LinearGradient
        colors={roleTheme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.tealSection}
      >
        {!hideHolo && <HolographicOverlay />}
        <View style={s.geoDecor1} />
        <View style={s.geoDecor2} />
        <View style={s.geoDecor3} />

        <View style={s.roleBadge}>
          <Text style={s.roleBadgeText} numberOfLines={1}>{roleTheme.label}</Text>
        </View>

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

        <Text style={s.studentName} numberOfLines={2}>
          {(user?.name || 'Unknown User').toUpperCase()}
        </Text>

        <Text style={s.studentIdLabel}>{roleTheme.idLabel}</Text>
        <Text style={s.studentIdNumber} numberOfLines={1}>{displayId}</Text>
      </LinearGradient>

      {/* Role-specific details */}
      <View style={s.detailsSection}>
        {rows.map((row, idx) => (
          <View
            key={row.label}
            style={[s.detailRow, idx === rows.length - 1 && { borderBottomWidth: 0 }]}
          >
            <Text style={s.detailLabel}>{row.label} :</Text>
            <Text style={s.detailValue} numberOfLines={2}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Barcode */}
      <View style={s.barcodeSection}>
        <View style={s.barcodeLines}>
          {generateBarcodeLines(displayId).map((line, i) => (
            <View
              key={i}
              style={[s.barcodeLine, { width: line.width, opacity: line.opacity }]}
            />
          ))}
        </View>
        <Text style={s.barcodeNumber} numberOfLines={1}>{displayId}</Text>
      </View>
    </View>
  );
}

// ─── Back Card ───────────────────────────────────
function BackCard({
  user,
  cardRef,
}: {
  user: any;
  cardRef?: React.RefObject<View | null>;
}) {
  const roleTheme = themeForRole(user?.role);
  const RoleIcon = roleTheme.Icon;
  const displayId = displayIdFor(user);
  const collegeName = collegeNameFor(user);

  return (
    <View ref={cardRef} collapsable={false} style={s.card}>
      <View style={s.backContainer}>
        {/* Header */}
        <View style={s.backHeader}>
          <View style={s.backLogoRow}>
            <View style={[s.instituteMarkSmall, { backgroundColor: roleTheme.accent }]}>
              <RoleIcon size={12} color="#fff" />
            </View>
            <Text style={s.backHeaderText} numberOfLines={1}>{collegeName.toUpperCase()}</Text>
          </View>
          <Text style={s.backSubText}>DIGITAL IDENTITY CARD</Text>
        </View>

        {/* QR Code */}
        <View style={s.backQrSection}>
          <View style={[s.backQrBorder, { borderColor: roleTheme.accent }]}>
            <QRCode
              value={JSON.stringify({
                v: user?.collegeCode || user?.collegeId || 'ID',
                id: user?.id,
                n: user?.name,
                s: displayId,
                e: user?.email,
                r: user?.role,
                c: collegeName,
              })}
              size={120}
              backgroundColor="#fff"
              color={roleTheme.accent}
            />
          </View>
        </View>

        {/* Info */}
        <View style={s.backInfo}>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>NAME</Text>
            <Text style={s.backInfoValue} numberOfLines={1}>
              {(user?.name || '—').toUpperCase()}
            </Text>
          </View>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>ID</Text>
            <Text style={s.backInfoValue} numberOfLines={1}>{displayId}</Text>
          </View>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>ROLE</Text>
            <Text style={s.backInfoValue} numberOfLines={1}>{roleTheme.label}</Text>
          </View>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>EMAIL</Text>
            <Text style={s.backInfoValue} numberOfLines={1}>{user?.email || '—'}</Text>
          </View>
          <View style={s.backInfoRow}>
            <Text style={s.backInfoLabel}>PHONE</Text>
            <Text style={s.backInfoValue} numberOfLines={1}>{user?.phone || '—'}</Text>
          </View>
        </View>

        {/* Magnetic Stripe */}
        <View style={s.magneticStripe}>
          <Text style={s.magneticText} numberOfLines={1}>
            {collegeName.toUpperCase()} • CAMPUS ERP • DIGITAL ID
          </Text>
        </View>

        {/* Terms */}
        <View style={s.backFooter}>
          <Lock size={8} color="#94A3B8" />
          <Text style={s.termsText}>
            This card is property of {collegeName}. If found, return to admin office.
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
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgressText, setDownloadProgressText] = useState('');
  const flipAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Refs for interactive cards and clean offscreen capture cards
  const cardFrontRef = useRef<View>(null);
  const cardBackRef = useRef<View>(null);
  const staticFrontRef = useRef<View>(null);
  const staticBackRef = useRef<View>(null);

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

  const roleTheme = themeForRole(user?.role);
  const accent = roleTheme.accent;
  const displayId = displayIdFor(user);
  const collegeName = collegeNameFor(user);

  const getDownloadDir = () => {
    if (Platform.OS === 'android') {
      return RNFS.DownloadDirectoryPath || RNFS.ExternalDirectoryPath || RNFS.DocumentDirectoryPath;
    }
    return RNFS.DocumentDirectoryPath;
  };

  // Share visible card side cleanly
  const shareCard = async () => {
    try {
      setSharing(true);
      const targetRef = flipped
        ? (staticBackRef.current ? staticBackRef : cardBackRef)
        : (staticFrontRef.current ? staticFrontRef : cardFrontRef);

      if (!targetRef.current) {
        throw new Error('Card is not ready yet. Please wait a moment and try again.');
      }

      const side = flipped ? 'Back' : 'Front';
      const uri = await captureRef(targetRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: `Share Digital ID Card (${side})`,
        });
      }
    } catch (err: any) {
      console.warn('Share failed:', err);
      Alert.alert('Share Error', err?.message || 'Could not share digital ID card.');
    } finally {
      setSharing(false);
    }
  };

  // Download high-resolution PNG of front or back
  const downloadCardImage = async (side: 'front' | 'back') => {
    try {
      setDownloading(true);
      setDownloadProgressText(`Exporting ${side === 'front' ? 'Front' : 'Back'} Card...`);

      const targetRef = side === 'front'
        ? (staticFrontRef.current ? staticFrontRef : cardFrontRef)
        : (staticBackRef.current ? staticBackRef : cardBackRef);

      if (!targetRef.current) {
        throw new Error('Card view is not ready yet. Please try again.');
      }

      const base64 = await captureRef(targetRef, {
        format: 'png',
        quality: 1,
        result: 'base64',
      });

      const dir = getDownloadDir();
      const safeId = displayId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `ID_Card_${safeId}_${side.toUpperCase()}_${Date.now()}.png`;
      const filePath = `${dir}/${fileName}`;

      await RNFS.writeFile(filePath, base64, 'base64');
      if (Platform.OS === 'android' && RNFS.scanFile) {
        await RNFS.scanFile(filePath);
      }

      setShowDownloadModal(false);
      Alert.alert(
        'Card Downloaded Successfully',
        `Saved ${side.toUpperCase()} card to Downloads folder:\n\n${fileName}`,
        [
          { text: 'OK' },
          {
            text: 'Open File',
            onPress: () => {
              const fileUrl = Platform.OS === 'android' ? `file://${filePath}` : filePath;
              Linking.openURL(fileUrl).catch(() => {
                Alert.alert('Notice', `File is saved at:\n${filePath}`);
              });
            },
          },
        ],
      );
    } catch (err: any) {
      console.error('ID Card download image failed:', err);
      Alert.alert(
        'Download Failed',
        err?.message || 'Could not save ID Card image. Please check storage permissions.',
      );
    } finally {
      setDownloading(false);
      setDownloadProgressText('');
    }
  };

  // Download combined Printable document (HTML / PDF)
  const downloadPrintablePDF = async () => {
    try {
      setDownloading(true);
      setDownloadProgressText('Generating Printable ID Document...');

      const frontRef = staticFrontRef.current ? staticFrontRef : cardFrontRef;
      const backRef = staticBackRef.current ? staticBackRef : cardBackRef;

      if (!frontRef.current || !backRef.current) {
        throw new Error('Card views are not ready yet. Please try again.');
      }

      const [frontBase64, backBase64] = await Promise.all([
        captureRef(frontRef, { format: 'png', quality: 1, result: 'base64' }),
        captureRef(backRef, { format: 'png', quality: 1, result: 'base64' }),
      ]);

      const dateStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Digital ID Card - ${user?.name || displayId}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc; color: #0f172a; padding: 24px;
      display: flex; flex-direction: column; align-items: center; min-height: 100vh;
    }
    .page-container {
      max-width: 780px; width: 100%; background: #ffffff;
      border-radius: 20px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.08);
    }
    .header-banner {
      text-align: center; padding-bottom: 16px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px;
    }
    .inst-name {
      font-size: 20px; font-weight: 900; color: ${accent}; letter-spacing: 1px; text-transform: uppercase;
    }
    .doc-title {
      font-size: 11px; color: #64748b; margin-top: 4px; letter-spacing: 2px; font-weight: 700;
    }
    .cards-wrapper {
      display: flex; flex-direction: row; justify-content: center; align-items: flex-start;
      gap: 28px; flex-wrap: wrap; margin: 20px 0;
    }
    .card-box { text-align: center; }
    .card-side-label {
      font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
    }
    .card-image {
      width: 300px; height: auto; border-radius: 16px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;
    }
    .meta-box {
      margin-top: 24px; background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 12px; padding: 16px 20px;
    }
    .meta-row {
      display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px;
      border-bottom: 1px dashed #e2e8f0;
    }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { font-weight: 600; color: #64748b; }
    .meta-val { font-weight: 700; color: #0f172a; }
    .print-notes {
      margin-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;
    }
    .actions-bar {
      margin-bottom: 20px; display: flex; gap: 12px; justify-content: center;
    }
    .print-btn {
      background: ${accent}; color: #ffffff; border: none; padding: 12px 24px;
      border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer;
      box-shadow: 0 4px 12px ${accent}40;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .page-container { box-shadow: none; padding: 0; }
      .actions-bar { display: none !important; }
      .card-image { box-shadow: none; border: 1px solid #cbd5e1; }
    }
  </style>
</head>
<body>
  <div class="actions-bar">
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>
  <div class="page-container">
    <div class="header-banner">
      <div class="inst-name">${collegeName}</div>
      <div class="doc-title">OFFICIAL DIGITAL IDENTITY CARD</div>
    </div>
    <div class="cards-wrapper">
      <div class="card-box">
        <div class="card-side-label">Front Side</div>
        <img class="card-image" src="data:image/png;base64,${frontBase64}" alt="Front Card" />
      </div>
      <div class="card-box">
        <div class="card-side-label">Back Side</div>
        <img class="card-image" src="data:image/png;base64,${backBase64}" alt="Back Card" />
      </div>
    </div>
    <div class="meta-box">
      <div class="meta-row">
        <span class="meta-label">Card Holder</span>
        <span class="meta-val">${(user?.name || '—').toUpperCase()}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">ID Number</span>
        <span class="meta-val">${displayId}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Role</span>
        <span class="meta-val">${roleTheme.label}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Generated On</span>
        <span class="meta-val">${dateStr}</span>
      </div>
    </div>
    <div class="print-notes">
      Official verification document generated by Vishva Campus ERP.<br/>
      Can be printed on standard PVC card printer or A4 paper stock.
    </div>
  </div>
</body>
</html>`;

      const dir = getDownloadDir();
      const safeId = displayId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `ID_Card_${safeId}_Printable_${Date.now()}.html`;
      const filePath = `${dir}/${fileName}`;

      await RNFS.writeFile(filePath, html, 'utf8');
      if (Platform.OS === 'android' && RNFS.scanFile) {
        await RNFS.scanFile(filePath);
      }

      setShowDownloadModal(false);
      Alert.alert(
        'Printable Card Saved',
        `Document saved to Downloads:\n\n${fileName}\n\nOpen it to print or save as PDF.`,
        [
          { text: 'OK' },
          {
            text: 'Open Document',
            onPress: () => {
              const fileUrl = Platform.OS === 'android' ? `file://${filePath}` : filePath;
              Linking.openURL(fileUrl).catch(() => {
                Alert.alert('Notice', `File saved at:\n${filePath}`);
              });
            },
          },
        ],
      );
    } catch (err: any) {
      console.error('Download printable card error:', err);
      Alert.alert('Export Error', err?.message || 'Failed to generate printable ID document.');
    } finally {
      setDownloading(false);
      setDownloadProgressText('');
    }
  };

  const detailItems = [
    { label: 'Full Name', value: user?.name },
    { label: 'ID Number', value: displayId },
    { label: 'Email', value: user?.email },
    { label: 'Phone', value: user?.phone },
    { label: 'Department', value: user?.department },
    { label: 'Year of Study', value: user?.year ? `Year ${user.year}` : undefined },
    { label: 'College', value: collegeName },
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
            <CreditCard size={18} color={accent} />
            <Text style={s.headerTitle}>Digital ID</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accent} />}
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
                  <BackCard user={user} cardRef={cardBackRef} />
                </Animated.View>
              </View>
            </Pressable>
          </Animated.View>

          <Text style={s.hintText}>
            {flipped ? '\u2190 Tap to see front' : 'Tap to see back \u2192'}
          </Text>

          {/* Action buttons */}
          <View style={s.actions}>
            <Pressable
              style={({ pressed }) => [s.actionBtn, s.shareBtn, pressed && s.btnPressed]}
              onPress={shareCard}
              disabled={sharing}
              accessibilityLabel="Share digital ID card"
            >
              {sharing ? (
                <ActivityIndicator size="small" color={accent} />
              ) : (
                <Share2 size={16} color={accent} />
              )}
              <Text style={[s.shareBtnText, { color: accent }]} numberOfLines={1}>
                {sharing ? 'Sharing...' : 'Share'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                s.actionBtn,
                s.downloadBtn,
                { backgroundColor: accent, borderColor: accent },
                pressed && s.btnPressed,
              ]}
              onPress={() => setShowDownloadModal(true)}
              disabled={downloading}
              accessibilityLabel="Download ID card"
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Download size={16} color="#fff" />
              )}
              <Text style={s.downloadBtnText} numberOfLines={1}>
                {downloading ? 'Saving...' : 'Download'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [s.actionBtn, s.verifyBtn, pressed && s.btnPressed]}
              onPress={() => setShowVerify(true)}
              accessibilityLabel="Verify ID card"
            >
              <Fingerprint size={16} color={accent} />
              <Text style={[s.verifyBtnText, { color: accent }]} numberOfLines={1}>Verify</Text>
            </Pressable>
          </View>

          {/* Card Details */}
          <Card style={s.detailsCard}>
            <View style={s.detailsHeader}>
              <Star size={14} color={accent} />
              <Text style={s.detailsTitle}>Card Details</Text>
            </View>
            {detailItems.map((item, idx, arr) => (
              <View key={item.label} style={[s.detailInfoRow, idx === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={s.detailInfoLabel}>{item.label}</Text>
                <Text style={s.detailInfoValue} numberOfLines={2}>{item.value}</Text>
              </View>
            ))}
          </Card>

          {/* Security Features */}
          <Card style={s.securityCard}>
            <View style={s.securityHeader}>
              <Shield size={14} color={accent} />
              <Text style={s.securityTitle}>Security Features</Text>
            </View>
            <View style={s.securityGrid}>
              {[
                { icon: <QrCode size={16} color={accent} />, label: 'QR Verification' },
                { icon: <Fingerprint size={16} color={accent} />, label: 'Unique Identity' },
                { icon: <BadgeCheck size={16} color={accent} />, label: 'University Seal' },
                { icon: <Wifi size={16} color={accent} />, label: 'NFC Ready' },
              ].map(f => (
                <View key={f.label} style={s.securityItem}>
                  {f.icon}
                  <Text style={s.securityLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
          </Card>
        </ScrollView>

        {/* Download Format Modal */}
        {showDownloadModal && (
          <Pressable
            style={s.modalOverlay}
            onPress={() => !downloading && setShowDownloadModal(false)}
          >
            <Pressable style={s.downloadModal} onPress={e => e.stopPropagation()}>
              <View style={s.downloadModalHeader}>
                <View style={[s.downloadIconWrap, { backgroundColor: accent + '18' }]}>
                  <Download size={24} color={accent} />
                </View>
                <Text style={s.downloadModalTitle}>Download ID Card</Text>
                <Text style={s.downloadModalSub}>Choose format to save to your device storage</Text>
              </View>

              {downloading ? (
                <View style={s.downloadLoadingWrap}>
                  <ActivityIndicator size="large" color={accent} />
                  <Text style={s.downloadLoadingText}>
                    {downloadProgressText || 'Saving to Downloads...'}
                  </Text>
                </View>
              ) : (
                <View style={s.downloadOptionsList}>
                  <Pressable
                    style={({ pressed }) => [s.downloadOptionItem, pressed && s.btnPressed]}
                    onPress={() => downloadCardImage('front')}
                  >
                    <View style={[s.optionIconBox, { backgroundColor: accent + '15' }]}>
                      <CreditCard size={20} color={accent} />
                    </View>
                    <View style={s.optionTextBox}>
                      <Text style={s.optionTitle}>Front Card (PNG)</Text>
                      <Text style={s.optionDesc}>High-resolution front ID badge image</Text>
                    </View>
                    <Download size={16} color={theme.colors.muted} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [s.downloadOptionItem, pressed && s.btnPressed]}
                    onPress={() => downloadCardImage('back')}
                  >
                    <View style={[s.optionIconBox, { backgroundColor: accent + '15' }]}>
                      <QrCode size={20} color={accent} />
                    </View>
                    <View style={s.optionTextBox}>
                      <Text style={s.optionTitle}>Back Card (PNG)</Text>
                      <Text style={s.optionDesc}>Back badge with QR code and contact details</Text>
                    </View>
                    <Download size={16} color={theme.colors.muted} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [s.downloadOptionItem, pressed && s.btnPressed]}
                    onPress={downloadPrintablePDF}
                  >
                    <View style={[s.optionIconBox, { backgroundColor: accent + '15' }]}>
                      <FileText size={20} color={accent} />
                    </View>
                    <View style={s.optionTextBox}>
                      <Text style={s.optionTitle}>Printable Document (PDF / HTML)</Text>
                      <Text style={s.optionDesc}>Front & Back combined on A4 for printing</Text>
                    </View>
                    <Download size={16} color={theme.colors.muted} />
                  </Pressable>
                </View>
              )}

              <Pressable
                style={({ pressed }) => [s.downloadCancelBtn, pressed && { opacity: 0.7 }]}
                onPress={() => setShowDownloadModal(false)}
                disabled={downloading}
              >
                <Text style={s.downloadCancelTxt}>Cancel</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        )}

        {/* Offscreen un-animated capture targets */}
        <View style={s.offscreenCapture} pointerEvents="none" collapsable={false}>
          <FrontCard user={user} cardRef={staticFrontRef} hideHolo />
          <View style={{ height: 20 }} />
          <BackCard user={user} cardRef={staticBackRef} />
        </View>

        {/* Verify Modal */}
        {showVerify && (
          <Pressable style={s.verifyOverlay} onPress={() => setShowVerify(false)}>
            <Pressable style={s.verifyModal} onPress={(e) => e.stopPropagation()}>
              <View style={s.verifyModalHeader}>
                <View style={[s.verifyIconWrap, { backgroundColor: accent + '22' }]}>
                  <Shield size={28} color={accent} />
                </View>
                <Text style={s.verifyModalTitle}>Identity Verification</Text>
                <Text style={s.verifyModalSub}>Scan QR code to verify identity</Text>
              </View>

              <View style={[s.verifyQrContainer, { borderColor: accent }]}>
                <View style={s.verifyQrBorder}>
                  <QRCode
                    value={JSON.stringify({ v: user?.collegeCode || user?.collegeId || 'ID', id: user?.id, n: user?.name, s: displayId, r: user?.role, c: collegeName })}
                    size={200}
                    backgroundColor="#fff"
                    color={accent}
                  />
                </View>
              </View>

              <Text style={s.verifyUserName} numberOfLines={2}>{(user?.name || '').toUpperCase()}</Text>
              <Text style={[s.verifyUserId, { color: accent }]} numberOfLines={1}>{displayId}</Text>

              <View style={s.verifyBadgeRow}>
                <View style={[s.verifiedBadge, { backgroundColor: accent }]}>
                  <Check size={14} color="#fff" />
                  <Text style={s.verifiedBadgeText}>ID VERIFIED</Text>
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
  instituteMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instituteMarkSmall: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  universityHeaderText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 1,
  },
  roleBadge: {
    alignSelf: 'center',
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
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

  // Download Modal
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  downloadModal: {
    width: SCREEN_WIDTH - 40,
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
  },
  downloadModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  downloadModalTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  downloadModalSub: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  downloadLoadingWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  downloadLoadingText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  downloadOptionsList: {
    gap: 10,
    marginVertical: 6,
  },
  downloadOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceTertiary,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  optionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextBox: {
    flex: 1,
  },
  optionTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  optionDesc: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  downloadCancelBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  downloadCancelTxt: {
    color: theme.colors.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  offscreenCapture: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: CARD_WIDTH,
    opacity: 1,
  },
});
