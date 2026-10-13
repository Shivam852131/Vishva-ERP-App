export const WEBRTC_BRIDGE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
<script>
(function(){
  var pc = null;
  var dc = null;
  var pendingCandidates = [];
  var isTeacher = false;

  function sendToRN(data) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  }

  function init(role) {
    isTeacher = role === 'teacher';
    pc = new RTCPeerConnection({ iceServers: [] });
    pendingCandidates = [];

    pc.onicecandidate = function(e) {
      if (e.candidate) {
        sendToRN({ type: 'ice-candidate', candidate: e.candidate.toJSON() });
      }
    };

    pc.onconnectionstatechange = function() {
      sendToRN({ type: 'connection-state', state: pc.connectionState });
    };

    pc.ondatachannel = function(e) {
      setupDataChannel(e.channel);
    };

    if (isTeacher) {
      dc = pc.createDataChannel('localshare-files', { ordered: true });
      setupDataChannel(dc);
    }

    sendToRN({ type: 'initialized', role: role });
  }

  function setupDataChannel(channel) {
    dc = channel;
    dc.binaryType = 'arraybuffer';

    dc.onopen = function() {
      sendToRN({ type: 'dc-open' });
    };

    dc.onclose = function() {
      sendToRN({ type: 'dc-closed' });
    };

    dc.onmessage = function(e) {
      try {
        var msg = JSON.parse(e.data);
        sendToRN(msg);
      } catch(err) {
        sendToRN({ type: 'raw-data', data: e.data });
      }
    };

    dc.onerror = function(e) {
      sendToRN({ type: 'dc-error', error: e.error?.message || 'DataChannel error' });
    };
  }

  async function createOffer() {
    if (!pc) return;
    var offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendToRN({ type: 'offer', sdp: pc.localDescription.toJSON() });
  }

  async function handleOffer(sdp) {
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    for (var i = 0; i < pendingCandidates.length; i++) {
      await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates[i]));
    }
    pendingCandidates = [];
    var answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sendToRN({ type: 'answer', sdp: pc.localDescription.toJSON() });
  }

  async function handleAnswer(sdp) {
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    for (var i = 0; i < pendingCandidates.length; i++) {
      await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates[i]));
    }
    pendingCandidates = [];
  }

  async function addIceCandidate(candidate) {
    if (!pc) return;
    if (pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      pendingCandidates.push(candidate);
    }
  }

  function sendData(data) {
    if (dc && dc.readyState === 'open') {
      dc.send(typeof data === 'string' ? data : JSON.stringify(data));
      return true;
    }
    return false;
  }

  function sendBinary(base64Chunk) {
    if (dc && dc.readyState === 'open') {
      var binary = atob(base64Chunk);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      dc.send(bytes.buffer);
      return true;
    }
    return false;
  }

  function disconnect() {
    if (dc) { try { dc.close(); } catch(e){} dc = null; }
    if (pc) { try { pc.close(); } catch(e){} pc = null; }
    pendingCandidates = [];
    sendToRN({ type: 'disconnected' });
  }

  window.handleRNMessage = function(data) {
    switch(data.type) {
      case 'init': init(data.role); break;
      case 'create-offer': createOffer(); break;
      case 'handle-offer': handleOffer(data.sdp); break;
      case 'handle-answer': handleAnswer(data.sdp); break;
      case 'add-ice-candidate': addIceCandidate(data.candidate); break;
      case 'send-data': sendData(data.payload); break;
      case 'send-binary': sendBinary(data.base64); break;
      case 'disconnect': disconnect(); break;
    }
  };

  sendToRN({ type: 'bridge-ready' });
})();
</script>
</body>
</html>`;
