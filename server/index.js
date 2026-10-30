import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomInt, createHmac } from 'node:crypto';
import { publicPacks } from './catalog.js';
import { mergeVideoHistory } from '../shared/videoHistory.js';
import { createRoom, createPlayer, publicRoom, addMessage, startRound, setSettings, markWatched, submitClue, changePhase, submitVote, tickRoom } from './game.js';

export function makeApp({ testing = false } = {}) {
  const app = express();
  const server = createServer(app);
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((req, res, next) => { res.set('Referrer-Policy', 'strict-origin-when-cross-origin'); res.set('X-Content-Type-Options', 'nosniff'); next(); });
  const io = new Server(server, { maxHttpBufferSize: 20_000, pingTimeout: 20000, allowRequest: (req, done) => {
    const origin = req.headers.origin;
    if (!origin) return done(null, true);
    try { done(null, new URL(origin).host === req.headers.host || origin === process.env.ALLOWED_ORIGIN); } catch { done(null, false); }
  }});
  const rooms = new Map();
  app.get('/api/health', (req, res) => res.json({ ok: true, service: 'alibi', rooms: rooms.size }));
  app.get('/api/packs', (req, res) => res.json(publicPacks()));
  app.get('/api/config', (req, res) => {
    let username = process.env.TURN_USERNAME;
    let credential = process.env.TURN_CREDENTIAL;
    if (process.env.TURN_SECRET) {
      username = `${Math.floor(Date.now() / 1000) + 12 * 3600}:alibi`;
      credential = createHmac('sha1', process.env.TURN_SECRET).update(username).digest('base64');
    }
    const relay = Boolean(process.env.TURN_URL && username && credential);
    res.set('Cache-Control', 'no-store').json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...(relay ? [{ urls: process.env.TURN_URL.split(',').map(v => v.trim()).filter(Boolean), username, credential }] : [])], hasTurn: relay });
  });
  const broadcast = room => { room.updatedAt = Date.now(); for (const p of room.players) if (p.socketId) io.to(p.socketId).emit('room:state', publicRoom(room, p.id)); };
  const find = socket => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.find(p => p.id === socket.data.playerId && p.socketId === socket.id);
    if (!room || !player) throw new Error('Join a room to do that.');
    return { room, player };
  };
  const requireHost = (room, player) => { if (room.hostId !== player.id) throw new Error('Only the host can do that.'); };
  const remove = (room, player) => {
    room.players = room.players.filter(p => p.id !== player.id);
    if (!room.players.some(p => !p.bot)) { rooms.delete(room.code); return; }
    if (room.hostId === player.id) room.hostId = room.players.find(p => !p.bot && p.online)?.id || room.players.find(p => !p.bot)?.id;
    if (!['lobby', 'reveal'].includes(room.phase)) { room.phase = 'lobby'; room.current = null; room.deadline = null; room.players.forEach(p => { p.clue = null; p.vote = null; p.watched = false; }); addMessage(room, 'system', 'A player left during the round. Back to the lobby so everyone can play.'); }
    addMessage(room, 'system', `${player.name} left the room.`); broadcast(room);
  };
  io.on('connection', socket => {
    let limits = { at: Date.now(), count: 0, signals: 0 };
    const handle = (name, handler) => socket.on(name, async (input = {}, ack = () => {}) => {
      if (typeof ack !== 'function') ack = () => {};
      if (Date.now() - limits.at > 10000) limits = { at: Date.now(), count: 0, signals: 0 };
      // Seven cameras negotiate 21 peer connections. Keep ICE bursts from
      // consuming the budget for clues, votes, and other game actions.
      if (name === 'rtc:signal' ? ++limits.signals > 800 : ++limits.count > 150) return ack({ error: 'A little too fast. Try again in a moment.' });
      try { await handler(input || {}, ack); } catch (error) { ack({ error: error.message || 'Something went wrong. Please try again.' }); }
    });
    handle('room:create', ({ name, practice, recentVideos }, ack) => {
      if (socket.data.roomCode) throw new Error('Leave your current room first.');
      if (rooms.size >= 1000) throw new Error('The server is busy. Try again shortly.');
      const { room, player } = createRoom(name, Boolean(practice), recentVideos);
      while (rooms.has(room.code)) room.code = createRoom(name).room.code;
      player.socketId = socket.id; rooms.set(room.code, room); socket.join(room.code); socket.data.roomCode = room.code; socket.data.playerId = player.id;
      ack({ token: player.token, code: room.code, playerId: player.id }); broadcast(room);
    });
    handle('room:join', ({ code, name, token, recentVideos }, ack) => {
      if (typeof code !== 'string' || !/^[A-Z0-9]{6}$/i.test(code.trim())) throw new Error('Room codes have 6 letters or numbers.');
      const room = rooms.get(code.trim().toUpperCase());
      if (!room) throw new Error('That room does not exist. Double-check the code or create a new room.');
      if (room.practice) throw new Error('This is a solo practice room. Create a real room to invite friends.');
      if (socket.data.roomCode && socket.data.roomCode !== room.code) throw new Error('Leave your current room first.');
      let player = token && room.players.find(p => p.token === token && !p.bot);
      if (!player) {
        if (socket.data.roomCode) throw new Error('You are already in this room.');
        if (room.phase !== 'lobby' && room.phase !== 'reveal') throw new Error('A round is in progress. Join when the reveal is over.');
        if (room.players.length >= 8) throw new Error('This room is full. Alibi fits up to 8 players.');
        player = createPlayer(name);
        if (room.players.some(p => p.name.normalize('NFKC').toLowerCase() === player.name.normalize('NFKC').toLowerCase())) throw new Error('That name is already in the room. Add an initial or choose another name.');
        player.color = room.players.length % 6; room.players.push(player); addMessage(room, 'system', `${player.name} joined. Looking innocent. For now.`);
      } else if (player.socketId && player.socketId !== socket.id) { const old = io.sockets.sockets.get(player.socketId); if (old) { old.emit('session:replaced'); old.disconnect(true); } }
      room.videoHistory = mergeVideoHistory(recentVideos, room.videoHistory);
      player.socketId = socket.id; player.online = true; delete player.disconnectedAt;
      socket.join(room.code); socket.data.roomCode = room.code; socket.data.playerId = player.id;
      ack({ token: player.token, code: room.code, playerId: player.id }); broadcast(room);
    });
    handle('room:resume', ({ code, token }, ack) => {
      const room = rooms.get(code);
      const player = room?.players.find(p => p.token === token && !p.bot);
      if (!player) throw new Error('Your room has ended. Start a new one.');
      if (player.socketId && player.socketId !== socket.id) { const old = io.sockets.sockets.get(player.socketId); if (old) { old.emit('session:replaced'); old.disconnect(true); } }
      player.socketId = socket.id; player.online = true; player.inCall = false; player.mic = false; player.camera = false; delete player.disconnectedAt;
      socket.join(room.code); socket.data.roomCode = room.code; socket.data.playerId = player.id;
      ack({ token: player.token, code: room.code, playerId: player.id }); broadcast(room);
    });
    handle('room:leave', (_, ack) => { const { room, player } = find(socket); remove(room, player); socket.leave(room.code); socket.data.roomCode = null; socket.data.playerId = null; ack({ ok: true }); });
    handle('player:ready', ({ ready }, ack) => { const { room, player } = find(socket); if (!['lobby', 'reveal'].includes(room.phase)) throw new Error('Wait until the round ends.'); player.ready = Boolean(ready); broadcast(room); ack({ ok: true }); });
    handle('room:settings', (input, ack) => { const { room, player } = find(socket); requireHost(room, player); setSettings(room, input); broadcast(room); ack({ ok: true }); });
    handle('game:start', (_, ack) => { const { room, player } = find(socket); requireHost(room, player); startRound(room); broadcast(room); ack({ ok: true }); });
    handle('game:replace', (_, ack) => { const { room, player } = find(socket); requireHost(room, player); startRound(room, { replace: true }); broadcast(room); ack({ ok: true }); });
    handle('game:clip-problem', (_, ack) => { const { room, player } = find(socket); if (room.phase !== 'watch') throw new Error('Report a clip while the videos are open.'); if (!player.videoProblem) { player.videoProblem = true; addMessage(room, 'system', `${player.name} can’t play their clip. The host can replace both clips for everyone.`); } broadcast(room); ack({ ok: true }); });
    handle('game:watched', (_, ack) => { const { room, player } = find(socket); markWatched(room, player); broadcast(room); ack({ ok: true }); });
    handle('game:clue', ({ word }, ack) => { const { room, player } = find(socket); submitClue(room, player, word); broadcast(room); ack({ ok: true }); });
    handle('game:vote', ({ targetId }, ack) => { const { room, player } = find(socket); submitVote(room, player, targetId); broadcast(room); ack({ ok: true }); });
    handle('game:discuss-end', (_, ack) => { const { room, player } = find(socket); requireHost(room, player); if (room.phase !== 'discuss') throw new Error('Discussion has not started.'); changePhase(room, 'vote'); broadcast(room); ack({ ok: true }); });
    handle('game:reset', (_, ack) => { const { room, player } = find(socket); requireHost(room, player); room.phase = 'lobby'; room.deadline = null; room.current = null; room.reveal = null; room.players.forEach(p => { p.clue = null; p.vote = null; p.watched = false; }); addMessage(room, 'system', 'The host brought everyone back to the lobby.'); broadcast(room); ack({ ok: true }); });
    handle('chat:send', ({ text }, ack) => { const { room, player } = find(socket); if (!['lobby', 'discuss', 'vote', 'reveal'].includes(room.phase)) throw new Error('Chat opens after everyone submits their clue.'); if (typeof text !== 'string' || !text.trim() || text.length > 300) throw new Error('Write a message between 1 and 300 characters.'); if (player.lastChatAt && Date.now() - player.lastChatAt < 700) throw new Error('Give the room a moment.'); player.lastChatAt = Date.now(); addMessage(room, 'chat', text.trim(), player); broadcast(room); ack({ ok: true }); });
    handle('player:media', ({ mic, camera, inCall }, ack) => { const { room, player } = find(socket); player.mic = Boolean(mic); player.camera = Boolean(camera); player.inCall = Boolean(inCall); broadcast(room); ack({ ok: true }); });
    handle('rtc:signal', ({ targetId, signal }, ack) => { const { room, player } = find(socket); const target = room.players.find(p => p.id === targetId && p.id !== player.id); if (!target || !target.socketId || !player.inCall || !target.inCall) return ack({ ok: false }); if (!signal || typeof signal !== 'object' || JSON.stringify(signal).length > 16000) throw new Error('Invalid call signal.'); io.to(target.socketId).emit('rtc:signal', { fromId: player.id, signal }); ack({ ok: true }); });
    handle('room:custom-pair', async ({ first, second, theme }, ack) => {
      const { room, player } = find(socket); requireHost(room, player);
      if (!['lobby', 'reveal'].includes(room.phase)) throw new Error('Add pairs between rounds.');
      if (room.custom.length >= 20) throw new Error('You can add up to 20 pairs per room.');
      const parse = value => { try { const u = new URL(value); if (!['https:', 'http:'].includes(u.protocol)) return null; const host = u.hostname.toLowerCase().replace(/^www\./, ''); const id = host === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : ['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host) ? u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] : null; return /^[\w-]{11}$/.test(id || '') ? id : null; } catch { return null; } };
      const ids = [parse(first), parse(second)];
      if (ids.some(id => !id)) throw new Error('Paste two valid YouTube video links.');
      if (ids[0] === ids[1]) throw new Error('The imposter needs a different video. Choose two different clips.');
      const videos = await Promise.all(ids.map(async id => { const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, { signal: AbortSignal.timeout(8000) }); if (!response.ok) throw new Error('One video is unavailable or private. Try a different public YouTube link.'); const metadata = await response.json(); return { id, title: String(metadata.title).slice(0, 150), channel: String(metadata.author_name).slice(0, 80), start: 0, clue: 'interesting' }; }));
      if (!rooms.has(room.code)) throw new Error('The room has ended.');
      if (!['lobby', 'reveal'].includes(room.phase)) throw new Error('The round started. Add your pair after the reveal.');
      room.custom.push({ id: `custom-${Date.now()}-${randomInt(9999)}`, pack: 'custom', theme: typeof theme === 'string' ? theme.trim().slice(0, 50) || 'A private pairing' : 'A private pairing', videos }); room.pack = 'custom'; addMessage(room, 'system', 'A custom video pair was added to the collection.'); broadcast(room); ack({ ok: true });
    });
    socket.on('disconnect', () => { try { const { room, player } = find(socket); player.online = false; player.inCall = false; player.mic = false; player.camera = false; player.disconnectedAt = Date.now(); delete player.socketId; broadcast(room); } catch {} });
  });
  const interval = setInterval(() => {
    for (const room of rooms.values()) {
      for (const player of [...room.players]) if (!player.online && player.disconnectedAt && Date.now() - player.disconnectedAt > 90000) remove(room, player);
      if (!rooms.has(room.code)) continue;
      let dirty = tickRoom(room);
      if (room.practice && room.current) {
        const elapsed = Date.now() - room.updatedAt;
        const bots = room.players.filter(p => p.bot);
        if (room.phase === 'watch' && bots.some(p => !p.watched)) { bots.forEach(p => p.watched = true); dirty = true; }
        if (room.phase === 'clue' && elapsed > 1200) {
          for (let i = 0; i < bots.length; i++) if (!bots[i].clue) { const bot = bots[i]; const base = room.current.videos[bot.id === room.current.imposterId ? 1 : 0]; submitClue(room, bot, [base.clue, 'intense', 'memorable', 'movement'][i]); dirty = true; }
        }
        if (room.phase === 'vote' && elapsed > 1500) { for (const bot of bots) if (room.phase === 'vote' && !bot.vote) { const choices = room.players.filter(p => p.id !== bot.id); submitVote(room, bot, choices[randomInt(choices.length)].id); dirty = true; } }
      }
      if (dirty) broadcast(room);
      if (room.players.every(p => p.bot || !p.online) && Date.now() - room.updatedAt > 30 * 60 * 1000) rooms.delete(room.code);
    }
  }, testing ? 50 : 500);
  interval.unref();
  return { app, server, io, rooms, close: async () => { clearInterval(interval); await new Promise(resolve => io.close(resolve)); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app, server } = makeApp();
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(root, 'dist')));
    app.get('/{*path}', (req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => console.log(`Alibi is ready at http://localhost:${port}`));
}
