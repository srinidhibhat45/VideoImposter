import { randomInt, randomUUID, randomBytes } from 'node:crypto';
import { pairs, publicPacks } from './catalog.js';
export const PHASES = ['lobby', 'watch', 'clue', 'discuss', 'vote', 'reveal'];
export function createRoom(name, practice = false) {
  const host = createPlayer(name);
  const room = { code: randomBytes(4).toString('hex').slice(0, 6).toUpperCase(), hostId: host.id, players: [host], phase: 'lobby', round: 0, totalRounds: 5, pack: 'mix', discussionSeconds: 90, clipSeconds: 45, practice, used: [], messages: [], updatedAt: Date.now(), deadline: null, current: null, reveal: null, custom: [] };
  addMessage(room, 'system', practice ? 'Welcome to your practice room. These four players are simulated. Try a round, then invite your real suspects.' : `${host.name} opened the room. Let the suspicions begin.`);
  if (practice) ['Alex', 'Maya', 'Jamie', 'Charlie'].forEach((n, i) => room.players.push({ ...createPlayer(n), bot: true, ready: true, color: i + 1 }));
  return { room, player: host };
}
export function createPlayer(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 20) throw new Error('Choose a name between 1 and 20 characters.');
  return { id: randomUUID(), token: randomBytes(24).toString('hex'), name: name.trim(), color: 0, ready: false, online: true, mic: false, camera: false, inCall: false, watched: false, clue: null, vote: null, score: 0, bot: false };
}
export function addMessage(room, type, text, player = null) {
  room.messages.push({ id: randomUUID(), type, text, name: player?.name || 'Alibi', playerId: player?.id || null, at: Date.now() });
  room.messages = room.messages.slice(-100); room.updatedAt = Date.now();
}
export function setSettings(room, input) {
  if (!['lobby', 'reveal'].includes(room.phase)) throw new Error('Settings can change between rounds.');
  if (input.pack !== undefined) {
    if (![...publicPacks().map(p => p.id), ...(room.custom.length ? ['custom'] : [])].includes(input.pack)) throw new Error('Choose an available collection.');
    room.pack = input.pack;
  }
  if (input.totalRounds !== undefined) {
    if (![3, 5, 8, 10].includes(input.totalRounds)) throw new Error('Choose 3, 5, 8, or 10 rounds.');
    room.totalRounds = input.totalRounds;
  }
  if (input.discussionSeconds !== undefined) {
    if (![60, 90, 120, 180].includes(input.discussionSeconds)) throw new Error('Choose a discussion time from the list.');
    room.discussionSeconds = input.discussionSeconds;
  }
  if (input.clipSeconds !== undefined) {
    if (![30, 45, 60].includes(input.clipSeconds)) throw new Error('Choose a clip length from the list.');
    room.clipSeconds = input.clipSeconds;
  }
}
export function startRound(room) {
  if (!['lobby', 'reveal'].includes(room.phase)) throw new Error('Finish the current round first.');
  if (room.players.filter(p => p.online).length < 3) throw new Error('Bring at least 3 players into the room.');
  if (room.players.some(p => !p.online || !p.ready && p.id !== room.hostId)) throw new Error('Everyone needs to be online and ready.');
  const pool = room.pack === 'custom' ? room.custom : pairs.filter(p => room.pack === 'mix' || p.pack === room.pack);
  let available = pool.filter(p => !room.used.includes(p.id));
  if (!available.length) { room.used = room.used.filter(id => !pool.some(p => p.id === id)); available = pool; }
  if (!available.length) throw new Error('Add a video pair first.');
  const selected = available[randomInt(available.length)];
  room.used.push(selected.id);
  const swap = randomInt(2);
  const imposter = room.players[randomInt(room.players.length)];
  room.current = { ...selected, videos: swap ? [...selected.videos].reverse() : selected.videos, imposterId: imposter.id, participantIds: room.players.map(p => p.id) };
  if (room.round >= room.totalRounds) { room.round = 0; room.players.forEach(p => p.score = 0); }
  room.round++; room.phase = 'watch'; room.reveal = null; room.deadline = Date.now() + (room.clipSeconds + 90) * 1000;
  room.players.forEach(p => { p.watched = false; p.clue = null; p.vote = null; });
  addMessage(room, 'system', `Round ${room.round}. Your video is private. Headphones on, poker faces ready.`);
}
export function changePhase(room, phase) {
  room.phase = phase;
  room.deadline = phase === 'discuss' ? Date.now() + room.discussionSeconds * 1000 : phase === 'clue' ? Date.now() + 60000 : phase === 'vote' ? Date.now() + 45000 : null;
  const text = { clue: 'One word. No names, no sentences. Your clue stays secret until everyone locks theirs in.', discuss: 'All clues are in. Compare notes, question everything. Who saw something different?', vote: 'Time to choose. Votes stay private until everyone has voted.' }[phase];
  if (text) addMessage(room, 'system', text);
}
export function markWatched(room, player) {
  if (room.phase !== 'watch') throw new Error('There is no video to finish right now.');
  player.watched = true;
  if (room.players.every(p => p.watched)) changePhase(room, 'clue');
}
export function submitClue(room, player, clue) {
  if (room.phase !== 'clue') throw new Error('Clues are not open yet.');
  if (player.clue) throw new Error('Your clue is already locked in.');
  if (typeof clue !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}\p{M}'’-]{0,23}$/u.test(clue.trim())) throw new Error('Use one word, up to 24 characters.');
  player.clue = clue.trim();
  if (room.players.every(p => p.clue)) changePhase(room, 'discuss');
}
export function submitVote(room, player, targetId) {
  if (room.phase !== 'vote') throw new Error('Voting is not open yet.');
  if (player.vote) throw new Error('Your vote is already locked in.');
  if (!room.players.some(p => p.id === targetId) || player.id === targetId) throw new Error('Choose another player in this room.');
  player.vote = targetId;
  if (room.players.every(p => p.vote)) finishRound(room);
}
export function finishRound(room) {
  if (!room.current || room.phase === 'reveal') return;
  const tally = Object.fromEntries(room.players.map(p => [p.id, 0]));
  room.players.forEach(p => { if (p.vote && tally[p.vote] !== undefined) tally[p.vote]++; });
  const max = Math.max(0, ...Object.values(tally));
  const leaders = Object.keys(tally).filter(id => tally[id] === max);
  const caught = max > 0 && leaders.length === 1 && leaders[0] === room.current.imposterId;
  room.players.forEach(p => { if (p.id === room.current.imposterId && !caught) p.score += 2; else if (p.id !== room.current.imposterId && p.vote === room.current.imposterId) p.score++; });
  room.reveal = { imposterId: room.current.imposterId, caught, tied: leaders.length !== 1, tally, videos: room.current.videos.map(({clue, ...v}) => v), votes: room.players.map(p => ({ playerId: p.id, targetId: p.vote })) };
  room.phase = 'reveal'; room.deadline = null;
  addMessage(room, 'system', caught ? 'Busted. The room found the imposter!' : leaders.length !== 1 ? 'A split decision. The imposter slips away with 2 points.' : 'A convincing alibi. The imposter gets away with 2 points.');
}
export function tickRoom(room, now = Date.now()) {
  if (!room.deadline || now < room.deadline) return false;
  if (room.phase === 'watch') changePhase(room, 'clue');
  else if (room.phase === 'clue') { room.players.forEach(p => { if (!p.clue) p.clue = '—'; }); changePhase(room, 'discuss'); }
  else if (room.phase === 'discuss') changePhase(room, 'vote');
  else if (room.phase === 'vote') finishRound(room);
  return true;
}
export function publicRoom(room, playerId) {
  const me = room.players.find(p => p.id === playerId);
  const showClues = ['discuss', 'vote', 'reveal'].includes(room.phase);
  return {
    code: room.code, hostId: room.hostId, practice: room.practice, phase: room.phase, round: room.round, totalRounds: room.totalRounds, pack: room.pack, clipSeconds: room.clipSeconds, discussionSeconds: room.discussionSeconds, deadline: room.deadline, serverNow: Date.now(), messages: room.messages, reveal: room.phase === 'reveal' ? room.reveal : null, customCount: room.custom.length,
    players: room.players.map(({token, vote, clue, socketId, disconnectedAt, ...p}) => ({ ...p, hasClue: Boolean(clue), hasVoted: Boolean(vote), clue: showClues || p.id === playerId ? clue : null, vote: room.phase === 'reveal' ? vote : null })),
    myId: playerId, myClue: me?.clue, myVote: me?.vote,
    video: room.phase === 'watch' && room.current ? { id: room.current.videos[room.current.imposterId === playerId ? 1 : 0].id, start: room.current.videos[room.current.imposterId === playerId ? 1 : 0].start, seconds: room.clipSeconds } : null,
  };
}
