import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '@/src/api';
import { connectRealtime, subscribeRealtime } from '@/src/realtime/socket';
import { useWebRTC } from './useWebRTC';
import { useFileTransfer } from './useFileTransfer';

export function useLocalShare() {
  const [session, setSession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createSession = useCallback(async ({ title, description, files }) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api('/localshare/sessions', {
        method: 'POST',
        body: JSON.stringify({ title, description, files }),
      });
      setSession(result);
      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const query = new URLSearchParams(params).toString();
      const data = await api(`/localshare/sessions${query ? '?' + query : ''}`);
      setSessions(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSession = useCallback(async (id) => {
    setLoading(true);
    try {
      const data = await api(`/localshare/sessions/${id}`);
      setSession(data);
      return data;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const joinSession = useCallback(async (shareCode) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/localshare/join/${shareCode}`);
      setSession(data.session);
      return data;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const endSession = useCallback(async (id) => {
    setLoading(true);
    try {
      const data = await api(`/localshare/sessions/${id}/end`, { method: 'POST' });
      setSession(prev => prev?.id === id ? { ...prev, status: 'ended' } : prev);
      return data;
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSession = useCallback(async (id) => {
    try {
      await api(`/localshare/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const logDownload = useCallback(async (sessionId, fileInfo) => {
    try {
      await api(`/localshare/sessions/${sessionId}/downloads`, {
        method: 'POST',
        body: JSON.stringify(fileInfo),
      });
    } catch {}
  }, []);

  const submitFeedback = useCallback(async (sessionId, { rating, comment, issues }) => {
    try {
      await api(`/localshare/sessions/${sessionId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment, issues }),
      });
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  }, []);

  return {
    session, setSession,
    sessions,
    loading,
    error,
    createSession,
    fetchSessions,
    fetchSession,
    joinSession,
    endSession,
    deleteSession,
    logDownload,
    submitFeedback,
  };
}

export function useLocalShareRTC({ session, role, onFileReceived }) {
  const handleMessage = useCallback((msg) => {
    if (onFileReceived) onFileReceived(msg);
  }, [onFileReceived]);

  const rtc = useWebRTC({
    sessionId: session?.session_id,
    role,
    onMessage: handleMessage,
  });

  const fileTransfer = useFileTransfer({ rtc, session });
  const expiryTimer = useRef(null);

  useEffect(() => {
    if (!session?.session_id) return;
    const socket = connectRealtime();
    if (socket) socket.emit('localshare:join-room', session.session_id);

    const off1 = subscribeRealtime('localshare:rtc-offer', (data) => {
      if (data.session_id === session.session_id) {
        rtc.handleOffer(data.offer);
      }
    });

    const off2 = subscribeRealtime('localshare:rtc-answer', (data) => {
      if (data.session_id === session.session_id) {
        rtc.handleAnswer(data.answer);
      }
    });

    const off3 = subscribeRealtime('localshare:ice-candidate', (data) => {
      if (data.session_id === session.session_id) {
        rtc.addIceCandidate(data.candidate);
      }
    });

    const off4 = subscribeRealtime('localshare:session-ended', (data) => {
      if (data.session_id === session.session_id) {
        if (!fileTransfer.hasActiveTransfers()) {
          cleanupLocalFiles();
        }
        rtc.disconnect();
      }
    });

    const off5 = subscribeRealtime('localshare:teacher-disconnected', (data) => {
      if (data.session_id === session.session_id) {
        rtc.markPeerDisconnected();
      }
    });

    expiryTimer.current = setInterval(async () => {
      try {
        const status = await api(`/localshare/sessions/${session.id}/status`);
        if (status.status === 'ended') {
          rtc.disconnect();
        }
      } catch {}
    }, 30000);

    return () => {
      off1(); off2(); off3(); off4(); off5();
      if (expiryTimer.current) clearInterval(expiryTimer.current);
      if (socket) socket.emit('localshare:leave-room', session.session_id);
      rtc.disconnect();
    };
  }, [session?.session_id]);

  const cleanupLocalFiles = useCallback(async () => {
    try {
      const RNFS = require('react-native-fs').default;
      const dir = RNFS.DocumentDirectoryPath;
      const items = await RNFS.readDir(dir);
      for (const item of items) {
        if (item.name.startsWith('localshare_')) {
          await RNFS.unlink(item.path);
        }
      }
    } catch {}
  }, []);

  const initAsTeacher = useCallback(() => {
    rtc.init();
    rtc.createOffer();
  }, [rtc]);

  const initAsStudent = useCallback(() => {
    rtc.init();
  }, [rtc]);

  return {
    ...rtc,
    ...fileTransfer,
    initAsTeacher,
    initAsStudent,
    cleanupLocalFiles,
  };
}
