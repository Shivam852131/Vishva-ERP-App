import { useState, useCallback, useRef } from 'react';
import RNFS from 'react-native-fs';
import { Alert } from 'react-native';
import { FileAssembler } from '../utils/fileAssembler';
import { splitIntoChunks, formatFileSize } from '../utils/fileChunker';
import { BRIDGE_CHUNK_SIZE, MAX_FILE_SIZE } from '../utils/rtcConfig';

const MAX_CONCURRENT_TRANSFERS = 5;

export function useFileTransfer({ rtc, session }) {
  const [transfers, setTransfers] = useState({});
  const [receivedFiles, setReceivedFiles] = useState([]);
  const assemblerRef = useRef(new FileAssembler());
  const abortControllers = useRef({});
  const sendQueue = useRef([]);
  const activeSendCount = useRef(0);

  const updateTransfer = useCallback((fileId, update) => {
    setTransfers(prev => ({
      ...prev,
      [fileId]: { ...prev[fileId], ...update },
    }));
  }, []);

  const abortTransfer = useCallback((fileId) => {
    if (abortControllers.current[fileId]) {
      abortControllers.current[fileId].abort();
      delete abortControllers.current[fileId];
    }
    updateTransfer(fileId, { status: 'cancelled' });
    assemblerRef.current.cleanup(fileId);
  }, [updateTransfer]);

  const processQueue = useCallback(() => {
    if (activeSendCount.current >= MAX_CONCURRENT_TRANSFERS || sendQueue.current.length === 0) return;
    const next = sendQueue.current.shift();
    if (next) next();
  }, []);

  const sendFile = useCallback(async (file) => {
    if (!rtc?.isConnected) {
      Alert.alert('Not Connected', 'WebRTC connection is not established.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      Alert.alert('File Too Large', `"${file.name}" exceeds 50MB limit.`);
      return;
    }

    const fileId = file.fileId || `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const doSend = async () => {
      activeSendCount.current++;
      const controller = new AbortController();
      abortControllers.current[fileId] = controller;

      updateTransfer(fileId, {
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'sending',
        progress: 0,
        sent: 0,
        startedAt: Date.now(),
      });

      try {
        const base64 = await RNFS.readFile(file.uri, 'base64');
        if (controller.signal.aborted) { activeSendCount.current--; processQueue(); return; }

        const chunks = splitIntoChunks(base64, BRIDGE_CHUNK_SIZE);

        const sent = rtc.sendData(JSON.stringify({
          type: 'file-start',
          fileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          totalChunks: chunks.length,
        }));
        if (!sent) throw new Error('DataChannel not open');

        for (let i = 0; i < chunks.length; i++) {
          if (controller.signal.aborted) { activeSendCount.current--; processQueue(); return; }

          const chunkSent = rtc.sendData(JSON.stringify({
            type: 'file-chunk',
            fileId,
            index: i,
            total: chunks.length,
            data: chunks[i],
          }));
          if (!chunkSent) throw new Error('DataChannel closed during transfer');

          const progress = Math.round(((i + 1) / chunks.length) * 100);
          const elapsed = (Date.now() - (transfers[fileId]?.startedAt || Date.now())) / 1000;
          const speed = elapsed > 0 ? ((i + 1) * BRIDGE_CHUNK_SIZE / elapsed) : 0;

          updateTransfer(fileId, {
            progress,
            sent: (i + 1) * BRIDGE_CHUNK_SIZE,
            speed: formatFileSize(Math.round(speed)) + '/s',
          });

          await new Promise(r => setTimeout(r, 3));
        }

        if (controller.signal.aborted) { activeSendCount.current--; processQueue(); return; }

        rtc.sendData(JSON.stringify({ type: 'file-end', fileId }));
        const duration = (Date.now() - (transfers[fileId]?.startedAt || Date.now())) / 1000;

        updateTransfer(fileId, {
          status: 'completed',
          progress: 100,
          duration: duration.toFixed(1) + 's',
        });
        delete abortControllers.current[fileId];
      } catch (err) {
        if (controller.signal.aborted) { activeSendCount.current--; processQueue(); return; }
        updateTransfer(fileId, {
          status: 'failed',
          error: err.message || 'Transfer failed',
        });
        delete abortControllers.current[fileId];
      } finally {
        activeSendCount.current--;
        processQueue();
      }
    };

    if (activeSendCount.current >= MAX_CONCURRENT_TRANSFERS) {
      return new Promise(resolve => {
        sendQueue.current.push(() => { doSend().then(resolve); });
      });
    }
    await doSend();
  }, [rtc, updateTransfer, transfers, processQueue]);

  const sendFiles = useCallback(async (files) => {
    let completed = 0;
    let failed = 0;
    for (const file of files) {
      try {
        await sendFile(file);
        completed++;
      } catch {
        failed++;
      }
    }
    return { completed, failed, total: files.length };
  }, [sendFile]);

  const handleReceivedMessage = useCallback((msg) => {
    if (msg.type === 'file-start') {
      const { fileId, fileName, fileSize, mimeType, totalChunks } = msg;
      assemblerRef.current.addChunk(fileId, 0, totalChunks, '');
      setTransfers(prev => ({
        ...prev,
        [fileId]: {
          name: fileName,
          size: fileSize,
          type: mimeType,
          status: 'receiving',
          progress: 0,
          received: 0,
          totalChunks,
          startedAt: Date.now(),
        },
      }));
    }

    if (msg.type === 'file-chunk') {
      const { fileId, index, total, data } = msg;
      try {
        const complete = assemblerRef.current.addChunk(fileId, index, total, data);
        const progress = assemblerRef.current.getProgress(fileId);
        const pct = total > 0 ? Math.round((progress.received / progress.total) * 100) : 0;

        setTransfers(prev => ({
          ...prev,
          [fileId]: {
            ...prev[fileId],
            progress: pct,
            received: progress.received,
          },
        }));

        if (complete) {
          const bytes = assemblerRef.current.assemble(fileId);
          if (bytes) {
            const safeName = (msg.fileName || fileId).replace(/[^a-zA-Z0-9._-]/g, '_');
            const finalPath = `${RNFS.DocumentDirectoryPath}/localshare_${safeName}`;
            const tmpPath = `${finalPath}.tmp`;

            const chunkSize = 1024 * 1024;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const slice = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
              const binary = String.fromCharCode(...slice);
              const b64 = btoa(binary);
              if (i === 0) {
                await RNFS.writeFile(tmpPath, b64, 'base64');
              } else {
                await RNFS.appendFile(tmpPath, b64, 'base64');
              }
            }

            await RNFS.moveFile(tmpPath, finalPath);

            const duration = ((Date.now() - (transfers[fileId]?.startedAt || Date.now())) / 1000).toFixed(1);
            setReceivedFiles(prev => [...prev, {
              fileId,
              name: msg.fileName,
              size: msg.fileSize,
              type: msg.mimeType,
              path: finalPath,
              savedAt: new Date().toISOString(),
            }]);
            setTransfers(prev => ({
              ...prev,
              [fileId]: {
                ...prev[fileId],
                status: 'completed',
                progress: 100,
                duration: duration + 's',
              },
            }));
          }
          assemblerRef.current.cleanup(fileId);
        }
      } catch (err) {
        setTransfers(prev => ({
          ...prev,
          [msg.fileId]: {
            ...prev[msg.fileId],
            status: 'failed',
            error: 'Failed to process chunk: ' + err.message,
          },
        }));
      }
    }

    if (msg.type === 'file-end') {
      const fileId = msg.fileId;
      setTransfers(prev => {
        if (prev[fileId]?.status === 'receiving') {
          return { ...prev, [fileId]: { ...prev[fileId], status: 'completed', progress: 100 } };
        }
        return prev;
      });
    }

    if (msg.type === 'file-request') {
      setTransfers(prev => ({
        ...prev,
        [msg.fileId]: {
          ...prev[msg.fileId],
          status: 'requested',
          name: msg.fileName,
        },
      }));
    }
  }, [transfers]);

  const hasActiveTransfers = useCallback(() => {
    return Object.values(transfers).some(t => t.status === 'sending' || t.status === 'receiving');
  }, [transfers]);

  return {
    sendFiles,
    sendFile,
    abortTransfer,
    transfers,
    receivedFiles,
    handleReceivedMessage,
    formatFileSize,
    hasActiveTransfers,
  };
}
