/**
 * HOW THE APP READS A STREAMED COACH ANSWER (R-399).
 *
 * React Native's `fetch` cannot read a body progressively, but its
 * `XMLHttpRequest` delivers incremental `responseText` once a `progress`
 * listener is attached (RN 0.81, `didReceiveNetworkIncrementalData`). Node
 * (the smoke script, tests) has a streaming `fetch` body instead. Both are
 * behind one shape: the transport calls `onText` with the WHOLE body so far
 * each time more arrives, and resolves with the final status and text.
 */

export interface CoachChatTransportInit {
  readonly method: 'POST';
  readonly headers: Record<string, string>;
  readonly body: string;
  readonly signal?: AbortSignal;
}

export interface CoachChatTransportResult {
  readonly status: number;
  readonly contentType: string | null;
  readonly text: string;
}

export type CoachChatTransport = (
  url: string,
  init: CoachChatTransportInit,
  onText: (textSoFar: string) => void,
) => Promise<CoachChatTransportResult>;

const xhrTransport: CoachChatTransport = (url, init, onText) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open(init.method, url);
  for (const [name, value] of Object.entries(init.headers)) xhr.setRequestHeader(name, value);
  xhr.responseType = 'text';
  xhr.onprogress = () => {
    try { onText(xhr.responseText); } catch { /* the reader decides what to do with a torn line */ }
  };
  xhr.onload = () => resolve({
    status: xhr.status,
    contentType: xhr.getResponseHeader('Content-Type'),
    text: xhr.responseText,
  });
  xhr.onerror = () => reject(new Error('coach-chat transport failed'));
  xhr.onabort = () => reject(new Error('coach-chat transport aborted'));
  if (init.signal) {
    if (init.signal.aborted) xhr.abort();
    else init.signal.addEventListener('abort', () => xhr.abort());
  }
  xhr.send(init.body);
});

const fetchTransport: CoachChatTransport = async (url, init, onText) => {
  const response = await fetch(url, init);
  const contentType = response.headers.get('Content-Type');
  const body = (response as { body?: { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } }).body;
  if (!body?.getReader) {
    const text = await response.text();
    onText(text);
    return { status: response.status, contentType, text };
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    onText(text);
  }
  return { status: response.status, contentType, text };
};

export function defaultCoachChatTransport(): CoachChatTransport {
  return typeof XMLHttpRequest === 'undefined' ? fetchTransport : xhrTransport;
}
