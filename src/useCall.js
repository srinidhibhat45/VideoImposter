import { useEffect, useRef, useState } from 'react';
export function useCall(socket, room, emit, notify) {
  const [stream, setStream] = useState(null);
  const [remote, setRemote] = useState({});
  const [connections, setConnections] = useState({});
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [pending, setPending] = useState(false);
  const peers = useRef(new Map());
  const streamRef = useRef(null);
  const ice = useRef([{ urls: 'stun:stun.l.google.com:19302' }]);
  const roomRef = useRef(room); roomRef.current = room;
  const quiet = room?.phase === 'watch' || room?.phase === 'clue';
  const quietRef = useRef(quiet); quietRef.current = quiet;
  const micRef = useRef(mic); micRef.current = mic;
  const media = useRef({ mic, camera }); media.current = { mic, camera };
  useEffect(() => { fetch('/api/config').then(r => r.json()).then(c => { ice.current = c.iceServers; }).catch(() => {}); }, []);
  const publish = (values) => emit('player:media', values).catch(() => {});
  const closePeers = () => { peers.current.forEach(p => p.pc.close()); peers.current.clear(); setRemote({}); setConnections({}); };
  const end = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setStream(null); setMic(false); setCamera(false); closePeers(); if (roomRef.current) publish({ mic: false, camera: false, inCall: false }); };
  const ensurePeer = (id) => {
    if (peers.current.has(id)) return peers.current.get(id);
    const pc = new RTCPeerConnection({ iceServers: ice.current });
    const record = { pc, makingOffer: false, ignoreOffer: false, settingAnswer: false, candidates: [], polite: (roomRef.current?.myId || '') > id };
    peers.current.set(id, record);
    streamRef.current?.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    const signal = value => socket.current?.emit('rtc:signal', { targetId: id, signal: value });
    pc.onicecandidate = ({ candidate }) => { if (candidate) signal({ candidate: candidate.toJSON() }); };
    pc.ontrack = event => { const incoming = event.streams[0]; if (incoming) setRemote(prev => ({ ...prev, [id]: incoming })); };
    pc.onnegotiationneeded = async () => { try { record.makingOffer = true; await pc.setLocalDescription(); signal({ description: pc.localDescription }); } catch (error) { if (pc.signalingState !== 'closed') console.warn('Call negotiation failed', error.name); } finally { record.makingOffer = false; } };
    pc.onconnectionstatechange = () => { if (peers.current.has(id)) setConnections(prev => ({ ...prev, [id]: pc.connectionState })); if (pc.connectionState === 'failed') notify('A call connection failed. Leave and rejoin the call to retry. A TURN relay may be needed on this network.'); };
    return record;
  };
  useEffect(() => {
    const client = socket.current;
    if (!client) return;
    const receive = async ({ fromId, signal }) => {
      if (!streamRef.current || !roomRef.current?.players.some(p => p.id === fromId && p.inCall)) return;
      const r = ensurePeer(fromId); const { pc } = r;
      try {
        if (signal.description) {
          const d = signal.description;
          const ready = !r.makingOffer && (pc.signalingState === 'stable' || r.settingAnswer);
          r.ignoreOffer = !r.polite && d.type === 'offer' && !ready;
          if (r.ignoreOffer) return;
          r.settingAnswer = d.type === 'answer';
          await pc.setRemoteDescription(d); r.settingAnswer = false;
          for (const candidate of r.candidates.splice(0)) await pc.addIceCandidate(candidate);
          if (d.type === 'offer') { await pc.setLocalDescription(); client.emit('rtc:signal', { targetId: fromId, signal: { description: pc.localDescription } }); }
        } else if (signal.candidate) {
          if (r.ignoreOffer) return;
          if (pc.remoteDescription) await pc.addIceCandidate(signal.candidate); else r.candidates.push(signal.candidate);
        }
      } catch (e) { if (pc.signalingState !== 'closed' && !r.ignoreOffer) console.warn('Call signal failed', e.name); }
    };
    client.on('rtc:signal', receive);
    const disconnect = () => end(); client.on('disconnect', disconnect);
    return () => { client.off('rtc:signal', receive); client.off('disconnect', disconnect); };
  }, [socket.current]);
  useEffect(() => {
    if (!room) { if (streamRef.current) end(); return; }
    if (!streamRef.current) return;
    const ids = room.players.filter(p => p.id !== room.myId && p.inCall && p.online && !p.bot).map(p => p.id);
    ids.forEach(ensurePeer);
    for (const [id, record] of peers.current) if (!ids.includes(id)) { record.pc.close(); peers.current.delete(id); setConnections(prev => { const next = { ...prev }; delete next[id]; return next; }); setRemote(prev => { const next = { ...prev }; delete next[id]; return next; }); }
  }, [room?.players.map(p => `${p.id}:${p.inCall}:${p.online}`).join(','), Boolean(stream), room?.code]);
  useEffect(() => { streamRef.current?.getAudioTracks().forEach(t => t.enabled = mic && !quiet); }, [mic, quiet]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()); peers.current.forEach(r => r.pc.close()); }, []);
  const start = async (withCamera = true) => {
    if (pending) return;
    if (!navigator.mediaDevices?.getUserMedia) { notify('Calls need a secure HTTPS connection or localhost. Open the secure app link to join.'); return; }
    setPending(true);
    try {
      let local;
      try { local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: withCamera ? { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' } : false }); }
      catch (error) { if (withCamera && ['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(error.name)) local = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false }); else throw error; }
      streamRef.current = local; setStream(local); setMic(true); const hasCamera = local.getVideoTracks().length > 0; setCamera(hasCamera);
      local.getAudioTracks().forEach(t => t.enabled = !quietRef.current);
      await emit('player:media', { mic: true, camera: hasCamera, inCall: true });
    } catch (error) { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; setStream(null); setMic(false); setCamera(false); notify(error.name === 'NotAllowedError' ? 'Microphone access is blocked. Allow it in your browser settings, then try joining the call again.' : error.name === 'NotFoundError' ? 'No microphone was found. Connect one and try again. You can still play using chat.' : 'Could not join the call. Check your camera and microphone, then try again.'); } finally { setPending(false); }
  };
  const toggleMic = () => { if (!streamRef.current) return start(false); const next = !mic; setMic(next); streamRef.current.getAudioTracks().forEach(t => t.enabled = next && !quietRef.current); publish({ mic: next, camera, inCall: true }); };
  const toggleCamera = async () => {
    if (!streamRef.current) return start(true);
    if (!streamRef.current.getVideoTracks().length) {
      try { const added = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 } } }); const track = added.getVideoTracks()[0]; streamRef.current.addTrack(track); peers.current.forEach(r => r.pc.addTrack(track, streamRef.current)); setCamera(true); setStream(new MediaStream(streamRef.current.getTracks())); publish({ mic, camera: true, inCall: true }); } catch { notify('Camera access is unavailable. Allow it in your browser settings to turn your camera on.'); }
      return;
    }
    const next = !camera; streamRef.current.getVideoTracks().forEach(t => t.enabled = next); setCamera(next); publish({ mic, camera: next, inCall: true });
  };
  return { stream, remote, connections, mic, camera, pending, start, end, toggleMic, toggleCamera, quiet };
}
