import { useRef, useState, useCallback, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import { WEBRTC_BRIDGE_HTML } from '../webrtc-bridge';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export function useWebRTC({ sessionId, role, onMessage }) {
  const webViewRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('new');
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [peerDisconnected, setPeerDisconnected] = useState(false);
  const pendingMessages = useRef([]);
  const reconnectTimer = useRef(null);

  const flushPending = useCallback(() => {
    if (!webViewRef.current || !isReady) return;
    while (pendingMessages.current.length > 0) {
      const msg = pendingMessages.current.shift();
      try {
        webViewRef.current.injectJavaScript(
          `window.handleRNMessage(${JSON.stringify(msg)});true;`
        );
      } catch {}
    }
  }, [isReady]);

  const sendToWebView = useCallback((msg) => {
    if (webViewRef.current && isReady) {
      try {
        webViewRef.current.injectJavaScript(
          `window.handleRNMessage(${JSON.stringify(msg)});true;`
        );
      } catch (e) {
        pendingMessages.current.push(msg);
      }
    } else {
      pendingMessages.current.push(msg);
      if (pendingMessages.current.length > 50) {
        pendingMessages.current.splice(0, 25);
      }
    }
  }, [isReady]);

  useEffect(() => {
    if (isReady) flushPending();
  }, [isReady, flushPending]);

  useEffect(() => {
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (retryCount >= MAX_RECONNECT_ATTEMPTS) {
      setError('Connection lost. Please rejoin the session.');
      return;
    }
    setConnectionState('reconnecting');
    reconnectTimer.current = setTimeout(() => {
      setRetryCount(prev => prev + 1);
      sendToWebView({ type: 'init', role });
    }, RECONNECT_DELAY_MS * (retryCount + 1));
  }, [retryCount, role, sendToWebView]);

  const init = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setPeerDisconnected(false);
    sendToWebView({ type: 'init', role });
  }, [role, sendToWebView]);

  const createOffer = useCallback(() => {
    sendToWebView({ type: 'create-offer' });
  }, [sendToWebView]);

  const handleOffer = useCallback((sdp) => {
    sendToWebView({ type: 'handle-offer', sdp });
  }, [sendToWebView]);

  const handleAnswer = useCallback((sdp) => {
    sendToWebView({ type: 'handle-answer', sdp });
  }, [sendToWebView]);

  const addIceCandidate = useCallback((candidate) => {
    sendToWebView({ type: 'add-ice-candidate', candidate });
  }, [sendToWebView]);

  const sendData = useCallback((payload) => {
    if (!isConnected) return false;
    sendToWebView({ type: 'send-data', payload });
    return true;
  }, [isConnected, sendToWebView]);

  const sendBinary = useCallback((base64) => {
    if (!isConnected) return false;
    sendToWebView({ type: 'send-binary', base64 });
    return true;
  }, [isConnected, sendToWebView]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    sendToWebView({ type: 'disconnect' });
    setIsConnected(false);
    setConnectionState('closed');
    setError(null);
  }, [sendToWebView]);

  const markPeerDisconnected = useCallback(() => {
    setPeerDisconnected(true);
    setIsConnected(false);
    setConnectionState('peer-disconnected');
    setError('The other party has disconnected.');
  }, []);

  const onWebViewMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'bridge-ready':
          setIsReady(true);
          setError(null);
          break;
        case 'dc-open':
          setIsConnected(true);
          setConnectionState('connected');
          setRetryCount(0);
          setError(null);
          setPeerDisconnected(false);
          break;
        case 'dc-closed':
          setIsConnected(false);
          setConnectionState('disconnected');
          scheduleReconnect();
          break;
        case 'connection-state':
          setConnectionState(data.state);
          if (data.state === 'connected') {
            setIsConnected(true);
            setRetryCount(0);
            setError(null);
            setPeerDisconnected(false);
          }
          if (data.state === 'failed') {
            setIsConnected(false);
            setError('WebRTC connection failed. Check your network.');
            scheduleReconnect();
          }
          if (data.state === 'disconnected') {
            setIsConnected(false);
            scheduleReconnect();
          }
          break;
        case 'dc-error':
          setError(data.error || 'DataChannel error occurred.');
          break;
      }
      if (onMessage) onMessage(data);
    } catch {}
  }, [onMessage, scheduleReconnect]);

  const WebViewBridge = useCallback(() => (
    <WebView
      ref={webViewRef}
      source={{ html: WEBRTC_BRIDGE_HTML }}
      onMessage={onWebViewMessage}
      style={{ width: 0, height: 0, position: 'absolute' }}
      originWhitelist={['*']}
      javaScriptEnabled
      allowFileAccess
    />
  ), [onWebViewMessage]);

  return {
    WebViewBridge,
    isReady,
    isConnected,
    connectionState,
    error,
    retryCount,
    peerDisconnected,
    init,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    sendData,
    sendBinary,
    disconnect,
    markPeerDisconnected,
  };
}
