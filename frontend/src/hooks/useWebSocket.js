import { useEffect, useRef, useCallback } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export function useWebSocket(roomHash, userId, userName, onMessage) {
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    if (!roomHash || !userId || !userName) return;
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(
      `${wsUrl}/api/ws/${roomHash}?user_id=${encodeURIComponent(userId)}&user_name=${encodeURIComponent(userName)}`
    );
    ws.onopen = () => {
      console.log('WS connected');
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
    ws.onmessage = (e) => {
      try { onMessageRef.current(JSON.parse(e.data)); } catch {}
    };
    ws.onclose = () => {
      reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [roomHash, userId, userName]);

  useEffect(() => {
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
    };
  }, [connect]);

  return wsRef;
}
