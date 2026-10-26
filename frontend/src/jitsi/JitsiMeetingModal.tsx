import React, { Component, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { confirmOpenInBrowser, getNativeSdk, meetingWebUrl } from './meeting';
import type { MeetingInfo } from './meeting';
import { theme } from '@/src/theme';

interface Props {
  visible: boolean;
  meeting: MeetingInfo | null;
  onClose: () => void;
}

interface ErrorBoundaryProps {
  url: string;
  onClose: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMsg: string;
}

interface FallbackProps {
  url: string;
  errorMsg: string;
  onClose: () => void;
}

/**
 * Consent-gated escape hatch, shared by the render crash boundary and the
 * WebView's own load failure. Only ever reachable from a visible button — the
 * app never silently hands the meeting to an external browser.
 */
function MeetingFallback({ url, errorMsg, onClose }: FallbackProps) {
  const openBrowser = () => {
    onClose();
    confirmOpenInBrowser(url, {
      title: 'Open in browser',
      message: 'Opening video meeting in web browser instead.',
    });
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Could not start video meeting</Text>
      {!!errorMsg && <Text style={styles.errorSubtitle}>{errorMsg}</Text>}
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.primaryBtn}
        onPress={openBrowser}
      >
        <Text style={styles.primaryBtnText}>Open in Browser</Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.secondaryBtn}
        onPress={onClose}
      >
        <Text style={styles.secondaryBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

class JitsiErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, errorMsg: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMsg: error?.message || 'Failed to render native video module',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[JitsiMeetingModal] Meeting surface crash:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <MeetingFallback
          url={this.props.url}
          errorMsg={this.state.errorMsg}
          onClose={this.props.onClose}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * The in-app meeting surface used whenever the native SDK is not linked: the
 * server-provided Jitsi room, loaded in a full-screen WebView.
 *
 * Camera and microphone need no JS-side prompt here. react-native-webview's
 * Android `RNCWebChromeClient.onPermissionRequest` maps the page's
 * `getUserMedia` request onto the app's own `CAMERA` / `RECORD_AUDIO` runtime
 * permissions and grants it — or asks Android first, then grants — which is
 * exactly why `openMeeting()` requests those permissions before this renders.
 */
function InAppMeetingWebView({ url, onFail }: { url: string; onFail: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.fill}>
      <WebView
        // Re-mount when the room changes so no state leaks between meetings.
        key={url}
        testID="in-app-meeting-webview"
        source={{ uri: url }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        // iOS: inline playback without an extra tap, video allowed to go full-screen.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Android: allow the in-page video controls to take over the screen.
        allowsFullscreenVideo
        setSupportMultipleWindows={false}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={e => {
          setLoading(false);
          onFail(e?.nativeEvent?.description || 'The meeting room could not be loaded.');
        }}
        style={styles.fill}
      />
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={theme.colors.brandPrimary} />
          <Text style={styles.loadingText}>Joining meeting…</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Full-screen meeting for a live class, rendered *inside* the app.
 *
 * Preference order: the official native Jitsi SDK when its runtime is linked,
 * otherwise the in-app WebView surface above. Neither ever navigates away from
 * the app by itself — the browser hand-off only happens behind an explicit
 * button press (see `MeetingFallback`), or for providers that cannot be
 * embedded at all (Google Meet, opened from the class room).
 *
 * Handles the Android hardware back button by returning to the ERP class room.
 */
export function JitsiMeetingModal({ visible, meeting, onClose }: Props) {
  const [webFailed, setWebFailed] = useState(false);
  const [webError, setWebError] = useState('');

  // Android back button closes the meeting and returns to the class room.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  // A failed load must not follow the user into the next meeting.
  useEffect(() => {
    if (visible && meeting) {
      setWebFailed(false);
      setWebError('');
    }
  }, [visible, meeting]);

  if (!visible || !meeting) return null;

  const sdk = getNativeSdk();
  const JitsiMeeting: React.ComponentType<any> | null =
    sdk && typeof sdk.JitsiMeeting === 'function' ? sdk.JitsiMeeting : null;
  const url = meetingWebUrl(meeting);

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      hardwareAccelerated
    >
      <View style={styles.fill}>
        {/* In-app chrome. The WebView ships no browser controls of its own and
            iOS has no hardware back button, so this bar is the guaranteed way
            out of the meeting. */}
        <View style={styles.bar}>
          <View style={styles.barLabels}>
            <Text numberOfLines={1} style={styles.barTitle}>
              {meeting.title || 'Live class'}
            </Text>
            <Text numberOfLines={1} style={styles.barSubtitle}>
              In-app meeting
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Leave meeting"
            style={styles.leaveBtn}
            onPress={onClose}
          >
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fill}>
          <JitsiErrorBoundary url={url} onClose={onClose}>
            {JitsiMeeting ? (
              <JitsiMeeting
                // A full URL (contains "://") is passed straight through as the room.
                room={meeting.room_url}
                token={meeting.token || undefined}
                userInfo={{
                  displayName: meeting.display_name || 'Guest',
                  email: meeting.email || '',
                  avatarURL: '',
                }}
                eventListeners={{
                  onReadyToClose: onClose,
                  onConferenceLeft: onClose,
                }}
                style={styles.fill}
              />
            ) : webFailed ? (
              <MeetingFallback url={url} errorMsg={webError} onClose={onClose} />
            ) : (
              <InAppMeetingWebView
                url={url}
                onFail={msg => {
                  setWebError(msg);
                  setWebFailed(true);
                }}
              />
            )}
          </JitsiErrorBoundary>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.surfaceInverse },

  // In-app chrome
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  barLabels: { flex: 1, marginRight: theme.spacing.md },
  barTitle: {
    fontSize: theme.font.size.base,
    fontWeight: theme.font.weight.semibold as any,
    color: theme.colors.text,
  },
  barSubtitle: {
    fontSize: theme.font.size.xs,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  leaveBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error,
  },
  leaveBtnText: {
    color: theme.colors.onError,
    fontSize: theme.font.size.sm,
    fontWeight: theme.font.weight.semibold as any,
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceInverse,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.font.size.sm,
    color: theme.colors.onSurfaceInverse,
  },

  errorContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  errorTitle: {
    fontSize: theme.font.size.lg,
    fontWeight: theme.font.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: theme.font.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  primaryBtn: {
    backgroundColor: theme.colors.brandPrimary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: theme.colors.onBrandPrimary,
    fontWeight: theme.font.weight.semibold,
  },
  secondaryBtn: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.colors.textSecondary,
    fontWeight: theme.font.weight.medium,
  },
});
