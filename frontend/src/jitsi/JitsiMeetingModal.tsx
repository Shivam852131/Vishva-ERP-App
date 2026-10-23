import React, { useEffect } from 'react';
import { BackHandler, Modal, StyleSheet, View } from 'react-native';
import { getNativeSdk } from './meeting';
import type { MeetingInfo } from './meeting';
import { theme } from '@/src/theme';

interface Props {
  visible: boolean;
  meeting: MeetingInfo | null;
  onClose: () => void;
}

/**
 * Full-screen native Jitsi meeting, rendered only when the native SDK is
 * installed (the caller gates on `isNativeMeetingAvailable`). Handles the
 * Android hardware back button by returning to the ERP class room.
 */
export function JitsiMeetingModal({ visible, meeting, onClose }: Props) {
  // Android back button closes the meeting and returns to the class room.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible || !meeting) return null;

  const sdk = getNativeSdk();
  const JitsiMeeting: React.ComponentType<any> | null =
    sdk && typeof sdk.JitsiMeeting === 'function' ? sdk.JitsiMeeting : null;
  if (!JitsiMeeting) return null;

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={styles.fill}>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.colors.surfaceInverse },
});
