import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from '@/src/components/LinearGradient';
import { router } from '@/src/navigation/router';
import { ArrowLeft, Camera, Check } from 'lucide-react-native';
import { useAuth } from '@/src/providers/AuthContext';
import { theme } from '@/src/theme';
import { Input, GradientButton } from '@/src/ui';
import { api } from '@/src/api';
import { uploadImage } from '@/src/upload';
import { launchImageLibraryAsync } from '@/src/native/image-picker';
import { ErrorBoundary } from '@/src/ErrorBoundary';

export default function EditProfile() {
  const { user, refresh } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickImage = async () => {
    try {
      const result = await launchImageLibraryAsync({ quality: 0.5 });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setUploading(true);
      const base64 = result.assets[0].base64;
      const uploaded = await uploadImage(base64, 'avatars');
      setAvatar(uploaded.url);
    } catch {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await api('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          department: department.trim() || null,
          avatar: avatar || null,
        }),
      });
      await refresh();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (name || user?.name || 'U').charAt(0).toUpperCase();

  return (
    <ErrorBoundary>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
            <LinearGradient colors={[theme.colors.brand, theme.colors.brandPrimary]} style={styles.header}>
              <Pressable
                testID="back-btn"
                accessibilityLabel="Go back"
                accessibilityRole="button"
                onPress={() => router.back()}
                style={styles.backBtn}
              >
                <ArrowLeft size={20} color="#fff" />
              </Pressable>
              <Text style={styles.headerTitle}>Edit Profile</Text>
            </LinearGradient>

            <View style={styles.body}>
              <View style={styles.avatarSection}>
                <Pressable
                  testID="avatar-btn"
                  accessibilityLabel="Change profile photo"
                  accessibilityRole="button"
                  onPress={pickImage}
                  style={styles.avatarWrap}
                >
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.cameraBadge}>
                    {uploading ? (
                      <ActivityIndicator size={12} color="#fff" />
                    ) : (
                      <Camera size={14} color="#fff" />
                    )}
                  </View>
                </Pressable>
                <Text style={styles.avatarHint}>Tap to change photo</Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="Full Name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your name"
                  error={errors.name}
                  autoCapitalize="words"
                />
                <Input
                  label="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                />
                <Input
                  label="Department"
                  value={department}
                  onChangeText={setDepartment}
                  placeholder="Enter your department"
                />

                <GradientButton
                  label="Save Changes"
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                  icon={<Check size={18} color="#fff" />}
                  style={{ marginTop: theme.spacing.lg }}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    padding: theme.spacing.lg,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    ...theme.shadow.lg,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.brandTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.brand,
    ...theme.shadow.lg,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: theme.colors.brand,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surfaceSecondary,
    ...theme.shadow.sm,
  },
  avatarHint: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.muted,
  },
  form: {
    gap: theme.spacing.md,
  },
});
