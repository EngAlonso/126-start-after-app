/**
 * Real-time event delivery for the Fnashha Expo app.
 *
 * On web:    native EventSource connected to /api/events?token=...
 * On native: XHR-based streaming SSE (XMLHttpRequest + onprogress).
 *            React Native has no built-in EventSource, but XHR with
 *            onprogress fires as each SSE chunk arrives — giving true
 *            real-time delivery without polling.
 *
 * Both paths parse the SSE event stream and invalidate the relevant
 * React Query cache keys when an event arrives.
 *
 * Reconnection strategy (both paths):
 *   - First retry: 5 s
 *   - Each subsequent failure doubles the delay (max 60 s)
 *   - After MAX_CONSECUTIVE_ERRORS failures in a row, stop retrying
 *     (prevents rate-limit flooding on invalid tokens)
 *
 * AppState: connection is paused when the app goes to background and
 * resumed (with a full cache refresh) when it returns to foreground.
 */

import { useEffect, useRef } from 'react';
import { Platform, AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getApiBase, apiFetch } from '@/hooks/useApi';

const RECONNECT_BASE_MS      = 5_000;
const RECONNECT_MAX_MS       = 60_000;
const MAX_CONSECUTIVE_ERRORS = 6; // give up after ~5 min of failures

export function useSse() {
  const { accessToken, user } = useAuth();
  const qc = useQueryClient();

  // Shared state refs — used by both web and native paths
  const destroyedRef   = useRef(false);
  const errCountRef    = useRef(0);
  const timerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef    = useRef<AppStateStatus>(AppState.currentState);

  // Native path only
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Web path only
  const esRef = useRef<EventSource | null>(null);

  // Always-fresh token ref — lets handleSseEvent call deliver-all without
  // becoming stale inside a long-lived useEffect closure.
  const accessTokenRef = useRef(accessToken);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  // ── Shared: invalidate cache for a given SSE event type ─────────────────
  const handleSseEvent = (eventType: string, data?: unknown) => {
    errCountRef.current = 0; // any successful event resets the error counter

    switch (eventType) {
      case 'new_message':
        qc.invalidateQueries({ queryKey: ['messages'] });
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['notifications-screen'] });
        // As soon as the recipient's device receives a new message via SSE,
        // immediately call deliver-all so the sender's tick advances to ✓✓
        // gray — even before the recipient opens the chat.  When the
        // recipient does open the chat the deliver-all becomes a no-op
        // (0 undelivered rows) and only read-all fires, producing the
        // correct ✓ → ✓✓ gray → ✓✓ blue sequence.
        {
          const rid = (data as Record<string, unknown> | null)?.requestId;
          const tok = accessTokenRef.current;
          if (rid && tok) {
            apiFetch(`/api/requests/${rid}/messages/deliver-all`, {
              method: 'PATCH',
              token: tok,
            }).catch(() => null);
          }
        }
        break;
      case 'messages_read':
        // The sender's ticks need to turn blue — refresh the message list.
        qc.invalidateQueries({ queryKey: ['messages'] });
        qc.invalidateQueries({ queryKey: ['conversations'] });
        break;
      case 'messages_delivered':
        // The sender's ticks need to turn double — refresh the message list.
        qc.invalidateQueries({ queryKey: ['messages'] });
        qc.invalidateQueries({ queryKey: ['conversations'] });
        break;
      case 'notification':
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['notifications-screen'] });
        break;
      case 'offer':
        qc.invalidateQueries({ queryKey: ['requests'] });
        break;
      case 'request':
        qc.invalidateQueries({ queryKey: ['requests'] });
        break;
      case 'platform_credit_updated':
        qc.invalidateQueries({ queryKey: ['platform-credits'] });
        break;
      default:
        // Generic / unknown event — full cache refresh (safe fallback)
        qc.invalidateQueries();
        break;
    }
  };

  // ── Shared: full refresh (used on foreground resume) ─────────────────────
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notifications-screen'] });
    qc.invalidateQueries({ queryKey: ['requests'] });
    qc.invalidateQueries({ queryKey: ['conversations'] });
    qc.invalidateQueries({ queryKey: ['messages'] });
    qc.invalidateQueries({ queryKey: ['wallet'] });
    qc.invalidateQueries({ queryKey: ['points-balance'] });
  };

  useEffect(() => {
    if (!accessToken || !user) return;

    destroyedRef.current = false;
    errCountRef.current  = 0;

    const sseUrl = () =>
      `${getApiBase()}/api/events?token=${encodeURIComponent(accessToken)}`;

    // ── Schedule a reconnect after a delay ──────────────────────────────────
    const scheduleReconnect = (connect: () => void) => {
      if (destroyedRef.current) return;
      errCountRef.current += 1;
      if (errCountRef.current > MAX_CONSECUTIVE_ERRORS) return; // give up
      const delay = Math.min(
        RECONNECT_BASE_MS * Math.pow(2, errCountRef.current - 1),
        RECONNECT_MAX_MS,
      );
      timerRef.current = setTimeout(connect, delay);
    };

    if (Platform.OS !== 'web') {
      // ── Native: XHR streaming SSE ──────────────────────────────────────────
      // XMLHttpRequest.onprogress fires for every received chunk, giving true
      // real-time delivery. React Native's XHR has supported this since RN 0.62.
      //
      // We keep the full responseText and track how much we've processed so
      // we can extract only the new bytes each time onprogress fires.
      const connect = () => {
        if (destroyedRef.current) return;

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        let processedLen = 0;
        let buffer       = '';

        xhr.open('GET', sseUrl(), true);
        xhr.setRequestHeader('Accept', 'text/event-stream');
        xhr.setRequestHeader('Cache-Control', 'no-cache');

        xhr.onprogress = () => {
          if (destroyedRef.current) { xhr.abort(); return; }

          // Extract only the bytes received since last onprogress
          const newText   = xhr.responseText.slice(processedLen);
          processedLen    = xhr.responseText.length;
          buffer         += newText;

          // SSE events are separated by double newlines
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? ''; // keep incomplete trailing chunk

          for (const block of events) {
            if (!block.trim()) continue;

            let eventType = 'message';
            let dataLine  = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event:')) eventType = line.slice(6).trim();
              if (line.startsWith('data:'))  dataLine  = line.slice(5).trim();
            }
            let parsedData: unknown = null;
            try { if (dataLine) parsedData = JSON.parse(dataLine); } catch {}
            handleSseEvent(eventType, parsedData);
          }
        };

        xhr.onerror = () => {
          xhrRef.current = null;
          scheduleReconnect(connect);
        };

        // onload fires when the server closes the connection (e.g. timeout /
        // restart). Treat it as a signal to reconnect.
        xhr.onload = () => {
          xhrRef.current = null;
          if (!destroyedRef.current) scheduleReconnect(connect);
        };

        xhr.send();
      };

      connect();

      // Pause when app goes to background; resume + full refresh on foreground
      const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
        if (appStateRef.current === 'active' && next !== 'active') {
          // Going to background — abort the XHR to save battery
          xhrRef.current?.abort();
          xhrRef.current = null;
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        } else if (appStateRef.current !== 'active' && next === 'active') {
          // Returning to foreground — full refresh then reconnect
          errCountRef.current = 0;
          invalidateAll();
          connect();
        }
        appStateRef.current = next;
      });

      return () => {
        destroyedRef.current = true;
        xhrRef.current?.abort();
        xhrRef.current = null;
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        sub.remove();
      };
    }

    // ── Web: native EventSource with exponential back-off ────────────────────
    const connect = () => {
      if (destroyedRef.current) return;

      const es = new EventSource(sseUrl());
      esRef.current = es;

      // Parse the JSON data field from an EventSource MessageEvent
      const parseEvt = (e: MessageEvent): unknown => {
        try { return e.data ? JSON.parse(e.data) : null; } catch { return null; }
      };

      // Generic message fallback
      es.addEventListener('message', () => handleSseEvent('message'));

      // Named events that the API broadcasts
      es.addEventListener('new_message',       (e) => handleSseEvent('new_message',       parseEvt(e)));
      es.addEventListener('messages_read',     (e) => handleSseEvent('messages_read',     parseEvt(e)));
      es.addEventListener('messages_delivered',(e) => handleSseEvent('messages_delivered', parseEvt(e)));
      es.addEventListener('notification',      (e) => handleSseEvent('notification',      parseEvt(e)));
      es.addEventListener('offer',             (e) => handleSseEvent('offer',             parseEvt(e)));
      es.addEventListener('request',           (e) => handleSseEvent('request',           parseEvt(e)));
      es.addEventListener('platform_credit_updated', (e) => handleSseEvent('platform_credit_updated', parseEvt(e)));
      es.addEventListener('open', () => { errCountRef.current = 0; });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        scheduleReconnect(connect);
      };
    };

    connect();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current !== 'active' && next === 'active') {
        // Returning to foreground — reconnect + refresh
        errCountRef.current = 0;
        esRef.current?.close();
        esRef.current = null;
        invalidateAll();
        connect();
      }
      appStateRef.current = next;
    });

    return () => {
      destroyedRef.current = true;
      esRef.current?.close();
      esRef.current = null;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user?.id]);
}
