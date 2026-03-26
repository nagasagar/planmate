import { useEffect, useRef, useCallback, useState } from 'react';
import { api } from '@/lib/api';

export function useWebSocket(roomHash, userId, userName, onMessage) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const pollRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  const [usePolling, setUsePolling] = useState(false);
  const lastDataRef = useRef(null);
  const failCountRef = useRef(0);

  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!roomHash || !userId || !userName) return;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(
        `${wsUrl}/api/ws/${roomHash}?user_id=${encodeURIComponent(userId)}&user_name=${encodeURIComponent(userName)}`
      );
      ws.onopen = () => {
        failCountRef.current = 0;
        setUsePolling(false);
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
      };
      ws.onmessage = (e) => {
        try { onMessageRef.current(JSON.parse(e.data)); } catch {}
      };
      ws.onclose = () => {
        failCountRef.current++;
        if (failCountRef.current >= 3) {
          setUsePolling(true);
        } else {
          reconnectRef.current = setTimeout(connect, 2000);
        }
      };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    } catch {
      setUsePolling(true);
    }
  }, [roomHash, userId, userName]);

  // Polling fallback
  useEffect(() => {
    if (!usePolling || !roomHash) return;
    const poll = async () => {
      try {
        const data = await api.getRoom(roomHash);
        const serialized = JSON.stringify(data);
        if (serialized !== lastDataRef.current) {
          lastDataRef.current = serialized;
          onMessageRef.current({ type: 'full_state', data });
        }
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [usePolling, roomHash]);

  // Start connection
  useEffect(() => {
    if (!roomHash || !userId || !userName) return;
    connect();
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) wsRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connect, roomHash, userId, userName]);

  return wsRef;
}
