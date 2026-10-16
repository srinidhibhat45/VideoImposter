import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
export function useRoom(notify) {
  const socket = useRef(null);
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const notifyRef = useRef(notify); notifyRef.current = notify;
  useEffect(() => {
    const client = io({ autoConnect: true, reconnectionAttempts: Infinity }); socket.current = client;
    client.on('connect', () => {
      setConnected(true);
      let saved = sessionStorage.getItem('alibi-session');
      const inviteCode = new URLSearchParams(location.search).get('room')?.toUpperCase();
      if (saved && inviteCode) { try { if (JSON.parse(saved).code !== inviteCode) { saved = null; sessionStorage.removeItem('alibi-session'); } } catch { saved = null; } }
      if (saved) { try { const credentials = JSON.parse(saved); client.emit('room:resume', credentials, result => { if (result.error) { sessionStorage.removeItem('alibi-session'); setRoom(null); notifyRef.current(result.error); } }); } catch { sessionStorage.removeItem('alibi-session'); } }
    });
    client.on('disconnect', () => setConnected(false));
    client.on('room:state', value => setRoom(value));
    client.on('session:replaced', () => { sessionStorage.removeItem('alibi-session'); setRoom(null); notifyRef.current('This room was opened in another tab.'); });
    return () => { client.removeAllListeners(); client.disconnect(); socket.current = null; };
  }, []);
  const emit = useCallback((event, data = {}) => new Promise((resolve, reject) => {
    if (!socket.current?.connected) { const error = 'Reconnecting to the room. Please try again in a moment.'; notifyRef.current(error); return reject(new Error(error)); }
    socket.current.timeout(12000).emit(event, data, (timeout, result) => {
      if (timeout || result?.error) { const error = result?.error || 'The room took too long to respond. Please try again.'; notifyRef.current(error); reject(new Error(error)); }
      else resolve(result);
    });
  }), []);
  const enter = async (mode, data) => {
    setBusy(true);
    try { const result = await emit(mode === 'join' ? 'room:join' : 'room:create', { ...data, practice: mode === 'practice' }); sessionStorage.setItem('alibi-session', JSON.stringify({ code: result.code, token: result.token })); const url = new URL(location.href); if (mode !== 'practice') url.searchParams.set('room', result.code); else url.searchParams.delete('room'); history.replaceState(null, '', url); return true; } catch { return false; } finally { setBusy(false); }
  };
  const leave = async () => { try { await emit('room:leave'); } catch {} sessionStorage.removeItem('alibi-session'); setRoom(null); const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url); };
  return { socket, room, connected, busy, enter, leave, emit };
}
