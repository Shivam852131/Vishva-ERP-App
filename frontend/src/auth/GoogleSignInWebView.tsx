import React, { useCallback, useState } from 'react';
import { Modal, View, StyleSheet, ActivityIndicator, Text, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { BASE_URL } from '@/src/config/env';
import { theme } from '@/src/theme';

/**
 * Google Sign-In for the mobile app.
 *
 * We run Google's real OAuth 2.0 authorization-code flow (with PKCE) inside a
 * WebView pointed at our own backend:
 *
 *   1. WebView opens  GET /api/auth/google/start
 *   2. Backend builds the Google consent URL (with a CSRF `state` + PKCE
 *      challenge) and redirects the WebView to accounts.google.com
 *   3. The user picks an account / approves, Google redirects back to the
 *      backend, which exchanges the code for tokens, verifies the ID token,
 *      upserts the ERP user and issues a normal ERP JWT
 *   4. Backend redirects to vishvaerp://auth?token=<ERP JWT>
 *   5. We intercept that deep link, pull the token out and complete sign-in
 *
 * This keeps every Google secret on the server — nothing sensitive ships in
 * the app bundle — while still being the genuine Google consent screen.
 */

const APP_REDIRECT = 'vishvaerp://auth';

interface GoogleSignInProps {
  onSuccess: (erpToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
  children?: React.ReactNode;
}

export function GoogleSignInWebView({ onSuccess, onError, children }: GoogleSignInProps) {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startUrl = `${BASE_URL}/api/auth/google/start?redirect=${encodeURIComponent(APP_REDIRECT)}`;

  const handleDeepLink = useCallback(
    (url: string): boolean => {
      if (!url || !url.startsWith(`${APP_REDIRECT}`)) return false;
      try {
        const query = url.slice(url.indexOf('?') + 1);
        const params = new URLSearchParams(query);
        const token = params.get('token');
        const errMsg = params.get('error');
        setVisible(false);
        setBusy(false);
        if (errMsg) {
          setError(errMsg);
          onError?.(errMsg);
        } else if (token) {
          setError(null);
          onSuccess(token);
        }
      } catch (e: any) {
        setVisible(false);
        setBusy(false);
        const msg = e?.message || 'Could not complete Google sign-in.';
        setError(msg);
        onError?.(msg);
      }
      return true;
    },
    [onError, onSuccess],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (req: ShouldStartLoadRequest) => {
      // Intercept our own deep link the backend redirects to at the end.
      if (req.url.startsWith(APP_REDIRECT)) {
        handleDeepLink(req.url);
        return false;
      }
      // Otherwise let the WebView follow Google's flow normally.
      return true;
    },
    [handleDeepLink],
  );

  const onNavigationStateChange = useCallback(
    (navState: { url: string }) => {
      // Fallback for WebViews that don't fire shouldStartLoad for custom schemes.
      if (navState?.url?.startsWith(APP_REDIRECT)) handleDeepLink(navState.url);
    },
    [handleDeepLink],
  );

  return (
    <>
      <Pressable
        onPress={() => {
          setError(null);
          setVisible(true);
        }}
        testID="google-signin-button"
        accessibilityLabel="Sign in with Google"
      >
        {children}
      </Pressable>

      <Modal visible={visible} animationType="slide" onRequestClose={() => { setVisible(false); setBusy(false); }}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              onPress={() => { setVisible(false); setBusy(false); }}
              style={styles.closeBtn}
              accessibilityLabel="Close Google sign-in"
            >
              <Text style={styles.closeTxt}>✕</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Sign in with Google</Text>
            <View style={{ width: 32, alignItems: 'flex-end' }}>
              {busy ? (
                <ActivityIndicator size="small" color={theme.colors.brandPrimary} />
              ) : null}
            </View>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <WebView
            source={{ uri: startUrl }}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={onNavigationStateChange}
            onLoadStart={() => setBusy(true)}
            onLoadEnd={() => setBusy(false)}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
                <Text style={styles.loadingTxt}>Contacting Google…</Text>
              </View>
            )}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  closeTxt: { fontSize: 14, color: '#475569', fontWeight: '700' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 10,
  },
  loadingTxt: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
