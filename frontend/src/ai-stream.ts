import { getToken, apiUrl } from './api';

/**
 * Real-time AI chat streaming.
 *
 * React Native's `fetch` cannot read a response body while it is still being
 * sent, so we use XMLHttpRequest's `onprogress` (which exposes the bytes
 * received so far via `responseText`) to consume the backend's
 * `POST /ai/chat/stream` Server-Sent Events endpoint token by token.
 */

export interface StreamChatParams {
  sessionId?: string | null;
  message: string;
  type?: string;
  /** Called for every text chunk as the AI generates it. */
  onToken?: (token: string) => void;
  /** Abort the stream (e.g. user navigated away). */
  signal?: { aborted: boolean };
}

export interface StreamChatResult {
  sessionId: string;
  response: string;
  source: string;
  model?: string | null;
}

interface SseEvent {
  event: string;
  data: any;
}

/** Parse the SSE wire format ("event: x\ndata: y\n\n") into discrete events. */
function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = '';
  return {
    push(chunk: string) {
      buffer += chunk;
      let sep: number;
      // Events are separated by a blank line.
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        let event = 'message';
        const dataLines: string[] = [];
        for (const line of block.split('\n')) {
          if (line.startsWith(':')) continue; // keep-alive comment
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (!dataLines.length) continue;
        const raw = dataLines.join('\n');
        let data: any = raw;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }
        onEvent({ event, data });
      }
    },
  };
}

export async function streamChat({
  sessionId,
  message,
  type = 'general',
  onToken,
  signal,
}: StreamChatParams): Promise<StreamChatResult> {
  const token = await getToken().catch(() => null);
  if (!token) {
    throw new Error('Not signed in.');
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    let full = '';
    let result: StreamChatResult | null = null;
    let serverError: string | null = null;
    let lastLength = 0;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const parser = createSseParser(({ event, data }) => {
      if (signal?.aborted) return;
      if (event === 'token' && data?.text) {
        full += data.text;
        onToken?.(data.text);
      } else if (event === 'done') {
        result = {
          sessionId: String(data?.sessionId || sessionId || ''),
          response: String(data?.response ?? full),
          source: String(data?.source || 'ai'),
          model: data?.model ?? null,
        };
      } else if (event === 'error') {
        serverError = String(data?.message || 'The AI service failed.');
      }
    });

    xhr.open('POST', apiUrl('/ai/chat/stream'));
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // SSE arrives as plain text chunks.
    xhr.responseType = 'text' as any;
    xhr.onprogress = () => {
      if (signal?.aborted) {
        try {
          xhr.abort();
        } catch {}
        return;
      }
      const text = xhr.responseText || '';
      if (text.length > lastLength) {
        parser.push(text.slice(lastLength));
        lastLength = text.length;
      }
    };
    xhr.onload = () => {
      // Flush any trailing bytes that never triggered onprogress.
      const text = xhr.responseText || '';
      if (text.length > lastLength) parser.push(text.slice(lastLength));
      if (xhr.status < 200 || xhr.status >= 300) {
        let msg = `HTTP ${xhr.status}`;
        try {
          const payload = JSON.parse(text);
          if (payload?.detail) msg = String(payload.detail);
        } catch {}
        finish(() => reject(new Error(msg)));
        return;
      }
      if (serverError && !full) {
        finish(() => reject(new Error(serverError!)));
        return;
      }
      finish(() =>
        resolve(
          result || {
            sessionId: String(sessionId || ''),
            response: full,
            source: 'ai',
          },
        ),
      );
    };
    xhr.onerror = () => {
      finish(() => reject(new Error('Could not reach the AI service.')));
    };
    xhr.onabort = () => {
      finish(() => reject(new Error('Request cancelled.')));
    };
    xhr.send(JSON.stringify({ sessionId: sessionId || undefined, message, type }));

    // Safety net: if the connection hangs, fail instead of spinning forever.
    const timeout = setTimeout(() => {
      if (!settled) {
        try {
          xhr.abort();
        } catch {}
        finish(() => reject(new Error('The AI service took too long to respond.')));
      }
    }, 120000);
    xhr.onloadend = () => clearTimeout(timeout);
  });
}
