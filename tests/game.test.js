import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, createPlayer, startRound, publicRoom, submitClue, markWatched, changePhase, submitVote, finishRound, tickRoom, setSettings } from '../server/game.js';
import { pairs } from '../server/catalog.js';
function fixture(count=5){const {room,player}=createRoom('Host');for(let i=1;i<count;i++){const p=createPlayer(`Player ${i}`);p.ready=true;p.color=i;room.players.push(p);}return {room,player};}
test('clips default to 30 seconds and longer clip settings are rejected',()=>{
  const {room}=fixture(3);
  assert.equal(room.clipSeconds,30);
  for(const seconds of [15,20,30]){setSettings(room,{clipSeconds:seconds});assert.equal(room.clipSeconds,seconds);}
  for(const seconds of [31,45,60,0,-1,'30'])assert.throws(()=>setSettings(room,{clipSeconds:seconds}),/15, 20, or 30/);
  startRound(room);
  for(const p of room.players){const video=publicRoom(room,p.id).video;assert.equal(video.seconds,30);assert.equal(video.start,15);}
  assert.ok(room.deadline-Date.now()<=45000);
  assert.equal(tickRoom(room,room.deadline-1),false);
  assert.equal(tickRoom(room,room.deadline),true);
  assert.equal(room.phase,'clue');
});
test('exactly one player gets the alternate clip, without exposing roles or other private data',()=>{const {room}=fixture();startRound(room);const views=room.players.map(p=>publicRoom(room,p.id));const counts=Object.values(views.reduce((a,v)=>(a[v.video.id]=(a[v.video.id]||0)+1,a),{})).sort();assert.deepEqual(counts,[1,4]);for(const v of views){assert.equal(v.reveal,null);assert.equal(JSON.stringify(v).includes('token'),false);assert.equal(JSON.stringify(v).includes('imposterId'),false);assert.equal(JSON.stringify(v).includes('participantIds'),false);assert.equal(v.video.title,undefined);assert.equal(v.current,undefined);}});
test('clues stay private and appear simultaneously when all players submit',()=>{const {room}=fixture(3);startRound(room);room.players.forEach(p=>markWatched(room,p));assert.equal(room.phase,'clue');submitClue(room,room.players[0],'lava');assert.equal(publicRoom(room,room.players[1].id).players[0].clue,null);assert.equal(publicRoom(room,room.players[0].id).players[0].clue,'lava');assert.throws(()=>submitClue(room,room.players[0],'again'));assert.throws(()=>submitClue(room,room.players[1],'two words'));assert.throws(()=>submitClue(room,room.players[1],'<script>'));submitClue(room,room.players[1],'warm');submitClue(room,room.players[2],'地球');assert.equal(room.phase,'discuss');assert.equal(publicRoom(room,room.players[2].id).players[0].clue,'lava');assert.equal(publicRoom(room,room.players[2].id).video,null);});
test('votes stay secret, cannot be changed, and cannot target self or unknown players',()=>{const {room}=fixture(3);startRound(room);changePhase(room,'vote');assert.throws(()=>submitVote(room,room.players[0],room.players[0].id));assert.throws(()=>submitVote(room,room.players[0],'unknown'));submitVote(room,room.players[0],room.players[1].id);assert.equal(publicRoom(room,room.players[2].id).players[0].vote,null);assert.throws(()=>submitVote(room,room.players[0],room.players[2].id));});
test('correct votes score one point each and catching the imposter denies escape points',()=>{const {room}=fixture(5);startRound(room);changePhase(room,'vote');const imp=room.players.find(p=>p.id===room.current.imposterId);const others=room.players.filter(p=>p!==imp);for(const p of others)submitVote(room,p,imp.id);submitVote(room,imp,others[0].id);assert.equal(room.phase,'reveal');assert.equal(room.reveal.caught,true);assert.equal(imp.score,0);others.forEach(p=>assert.equal(p.score,1));assert.equal(room.reveal.videos.length,2);});
test('ties let imposter escape; scoring and finish are idempotent',()=>{const {room}=fixture(3);startRound(room);changePhase(room,'vote');room.players.forEach((p,i)=>submitVote(room,p,room.players[(i+1)%3].id));assert.equal(room.reveal.tied,true);assert.equal(room.reveal.caught,false);const imp=room.players.find(p=>p.id===room.current.imposterId);assert.equal(imp.score,2);const scores=room.players.map(p=>p.score);finishRound(room);assert.deepEqual(room.players.map(p=>p.score),scores);});
test('pairs do not repeat until the selected collection is exhausted',()=>{const {room}=fixture(3);setSettings(room,{pack:'wild'});startRound(room);const first=room.current.id;changePhase(room,'vote');finishRound(room);startRound(room);assert.notEqual(room.current.id,first);changePhase(room,'vote');finishRound(room);startRound(room);assert.ok(room.current.id);});
test('pack reshuffles and new games never repeat the preceding pair when alternatives exist',()=>{
  const {room}=fixture(3);
  setSettings(room,{pack:'wild',totalRounds:3});
  let previous;
  for(let i=0;i<20;i++){
    startRound(room);
    assert.notEqual(room.current.id,previous);
    previous=room.current.id;
    changePhase(room,'vote');finishRound(room);
  }
  assert.ok(room.messages.some(m=>m.text.includes('every pair in this pack')));
});
test('new rooms prefer unseen videos from browser history without exposing that history',()=>{
  const unseen=pairs[3];
  const recent=pairs.filter(p=>p!==unseen).flatMap(p=>p.videos.map(v=>v.id));
  const {room}=createRoom('Host',true,recent);
  startRound(room);
  assert.equal(room.current.id,unseen.id);
  const view=publicRoom(room,room.hostId);
  assert.equal(view.videoHistory,undefined);
  assert.equal(view.lastVideoIds,undefined);
  assert.equal(view.used,undefined);
  assert.ok(view.video.playbackId);
  const other=room.current.videos.find(v=>v.id!==view.video.id);
  assert.equal(JSON.stringify(view).includes(other.id),false);
});
test('least recent pairs are preferred when the browser has seen the whole library',()=>{
  const recent=pairs.flatMap(p=>p.videos.map(v=>v.id));
  const {room}=createRoom('Host',true,recent);
  startRound(room);
  assert.equal(room.current.id,pairs[0].id);
});
test('each round has a fresh playback identity even when a one-pair pack must repeat',()=>{
  const {room}=fixture(3);
  setSettings(room,{pack:'rewind'});
  startRound(room);
  const first=publicRoom(room,room.hostId).video;
  changePhase(room,'vote');finishRound(room);
  startRound(room);
  const next=publicRoom(room,room.hostId).video;
  assert.notEqual(first.playbackId,next.playbackId);
  assert.equal(next.start,15);
  assert.equal(next.seconds,30);
});
test('timers progress stalled rounds and empty clues are revealed as dashes',()=>{const {room}=fixture(3);startRound(room);tickRoom(room,room.deadline+1);assert.equal(room.phase,'clue');tickRoom(room,room.deadline+1);assert.equal(room.phase,'discuss');assert.ok(room.players.every(p=>p.clue==='—'));tickRoom(room,room.deadline+1);assert.equal(room.phase,'vote');tickRoom(room,room.deadline+1);assert.equal(room.phase,'reveal');assert.equal(room.reveal.caught,false);});
test('starting requires at least 3 ready online players and only accepts known settings',()=>{let {room}=fixture(2);assert.throws(()=>startRound(room));({room}=fixture(3));room.players[1].ready=false;assert.throws(()=>startRound(room));room.players[1].ready=true;room.players[2].online=false;assert.throws(()=>startRound(room));assert.throws(()=>setSettings(room,{pack:'nonexistent'}));assert.throws(()=>setSettings(room,{clipSeconds:0}));});
test('reaching final round restarts score on another game',()=>{const {room}=fixture(3);room.totalRounds=3;room.round=3;room.players.forEach(p=>p.score=10);startRound(room);assert.equal(room.round,1);assert.ok(room.players.every(p=>p.score===0));});

test('the built-in library uses distinct, well-formed YouTube IDs across fresh pairs',async()=>{const {pairs}=await import('../server/catalog.js');const ids=pairs.flatMap(p=>p.videos.map(v=>v.id));assert.ok(ids.every(id=>/^[A-Za-z0-9_-]{11}$/.test(id)));assert.equal(new Set(ids).size,ids.length);});
