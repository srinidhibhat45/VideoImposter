import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { makeApp } from '../server/index.js';
import { pairs } from '../server/catalog.js';
const emit=(socket,event,data={})=>new Promise((resolve,reject)=>socket.timeout(3000).emit(event,data,(e,r)=>e||r?.error?reject(new Error(r?.error||String(e))):resolve(r)));
const connectClient=url=>new Promise((resolve,reject)=>{const s=connect(url,{transports:['websocket'],forceNew:true});s.on('connect',()=>resolve(s));s.on('connect_error',reject);});
const stateAfter=(s,action)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No room update')),3000);s.once('room:state',state=>{clearTimeout(timer);resolve(state);});action().catch(reject);});
test('three independent online clients play a full private round, reconnect, and hand over host',async()=>{
 const game=makeApp({testing:true});await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${game.server.address().port}`;const clients=[];
 try{
  const host=await connectClient(url);clients.push(host);const created=await emit(host,'room:create',{name:'Host'});const guest=await connectClient(url);clients.push(guest);const joined=await emit(guest,'room:join',{name:'Guest',code:created.code});const third=await connectClient(url);clients.push(third);await emit(third,'room:join',{name:'Third',code:created.code});
  await assert.rejects(emit(guest,'game:start'),/host/);await emit(guest,'player:ready',{ready:true});await emit(third,'player:ready',{ready:true});
  const states=[[],[],[]];clients.forEach((s,i)=>s.on('room:state',v=>states[i].push(v)));await emit(host,'game:start');await new Promise(r=>setTimeout(r,30));
  const watch=states.map(v=>v.at(-1));assert.ok(watch.every(v=>v.phase==='watch'&&v.video&&!v.reveal));const ids=watch.map(v=>v.video.id);assert.equal(new Set(ids).size,2);watch.forEach(v=>assert.ok(v.players.every(p=>!p.token&&!p.socketId)));
  await assert.rejects(emit(guest,'chat:send',{text:'spoiler'}),/Chat opens/);
  await Promise.all(clients.map(s=>emit(s,'game:watched')));await emit(host,'game:clue',{word:'hello'});await new Promise(r=>setTimeout(r,30));assert.equal(states[1].at(-1).players[0].clue,null);
  await emit(guest,'game:clue',{word:'world'});await emit(third,'game:clue',{word:'maybe'});await new Promise(r=>setTimeout(r,30));assert.equal(states[2].at(-1).phase,'discuss');assert.equal(states[2].at(-1).players[0].clue,'hello');
  const before=game.rooms.get(created.code).players.find(p=>p.token===joined.token);guest.disconnect();const rejoined=await connectClient(url);clients.push(rejoined);const resumedState=await stateAfter(rejoined,()=>emit(rejoined,'room:resume',{code:created.code,token:joined.token}));assert.equal(resumedState.myId,before.id);assert.equal(resumedState.myClue,'world');
  await emit(host,'game:discuss-end');const room=game.rooms.get(created.code);const imp=room.current.imposterId;const participants=[host,rejoined,third];const players=[room.players[0],room.players[1],room.players[2]];for(let i=0;i<3;i++){const target=players[i].id===imp?players.find(p=>p.id!==imp).id:imp;await emit(participants[i],'game:vote',{targetId:target});}
  assert.equal(room.phase,'reveal');assert.equal(room.reveal.caught,true);const final=await stateAfter(third,()=>emit(host,'room:settings',{pack:'wild'}));assert.ok(final.reveal.videos.length===2);assert.ok(final.reveal.votes.length===3);
  await emit(host,'room:leave');assert.equal(game.rooms.get(created.code).hostId,joined.playerId);await emit(rejoined,'room:settings',{pack:'mind'});await assert.rejects(emit(host,'room:settings',{pack:'food'}),/Join a room/);
 }finally{clients.forEach(s=>s.disconnect());await game.close();}
});
test('unrelated rooms cannot exchange call signals or join an in-progress round',async()=>{
 const game=makeApp({testing:true});await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${game.server.address().port}`;const clients=[];
 try{const a=await connectClient(url);const b=await connectClient(url);clients.push(a,b);const ra=await emit(a,'room:create',{name:'A',practice:true});const rb=await emit(b,'room:create',{name:'B'});await emit(a,'player:media',{inCall:true,mic:true});await emit(b,'player:media',{inCall:true,mic:true});const result=await emit(a,'rtc:signal',{targetId:rb.playerId,signal:{description:{type:'offer',sdp:'test'}}});assert.equal(result.ok,false);await emit(a,'game:start');await emit(b,'room:leave');await assert.rejects(emit(b,'room:join',{code:ra.code,name:'B'}),/practice/);}finally{clients.forEach(s=>s.disconnect());await game.close();}
});

test('a room accounts for joining players history and preserves selection history after a reset',async()=>{
 const game=makeApp({testing:true});await new Promise(resolve=>game.server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${game.server.address().port}`;const clients=[];
 try{
  const host=await connectClient(url);const guest=await connectClient(url);const third=await connectClient(url);clients.push(host,guest,third);
  const created=await emit(host,'room:create',{name:'Host',recentVideos:pairs.slice(0,4).flatMap(p=>p.videos.map(v=>v.id))});
  await emit(guest,'room:join',{name:'Guest',code:created.code,recentVideos:pairs.slice(4,-1).flatMap(p=>p.videos.map(v=>v.id))});
  await emit(third,'room:join',{name:'Third',code:created.code,recentVideos:{invalid:true}});
  await emit(guest,'player:ready',{ready:true});await emit(third,'player:ready',{ready:true});
  const watch=await stateAfter(host,()=>emit(host,'game:start'));
  const room=game.rooms.get(created.code);
  assert.equal(room.current.id,pairs.at(-1).id);
  assert.equal(watch.videoHistory,undefined);
  assert.equal(watch.lastVideoIds,undefined);
  assert.equal(JSON.stringify(watch).includes('recentVideos'),false);
  const firstId=room.current.id;const firstPlayback=watch.video.playbackId;
  await emit(host,'game:reset');
  const next=await stateAfter(host,()=>emit(host,'game:start'));
  assert.notEqual(room.current.id,firstId);
  assert.notEqual(next.video.playbackId,firstPlayback);
  assert.equal(next.video.start,15);
 }finally{clients.forEach(s=>s.disconnect());await game.close();}
});
