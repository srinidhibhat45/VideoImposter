import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {limitCallBandwidth} from '../src/callQuality.js';
import {makeApp} from '../server/index.js';
test('video upload limits preserve browser encoding identifiers and leave audio alone',async()=>{
 let applied;const params={encodings:[{rid:'low',active:true}],transactionId:'keep'};
 await limitCallBandwidth({getSenders:()=>[{track:{kind:'audio'},getParameters(){throw new Error('audio should not be touched');}},{track:{kind:'video'},getParameters:()=>params,setParameters:async p=>applied=p}]});
 assert.deepEqual(applied,{encodings:[{rid:'low',active:true,maxBitrate:250000,maxFramerate:15}],transactionId:'keep'});
 await assert.doesNotReject(limitCallBandwidth({getSenders:()=>[{track:{kind:'video'},getParameters:()=>({encodings:[{}]}),setParameters:async()=>{throw new Error('unsupported');}}]}));
});
test('TURN shared secret stays server-side and produces expiring browser credentials',async()=>{
 const keys=['TURN_URL','TURN_USERNAME','TURN_CREDENTIAL','TURN_SECRET'];const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const game=makeApp({testing:true});await new Promise(r=>game.server.listen(0,'127.0.0.1',r));
 try{process.env.TURN_URL='turn:relay.example:3478';process.env.TURN_SECRET='test-only-shared-secret';const res=await fetch(`http://127.0.0.1:${game.server.address().port}/api/config`);const cfg=await res.json();assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(cfg.hasTurn,true);const relay=cfg.iceServers[1];assert.equal(relay.credential,createHmac('sha1',process.env.TURN_SECRET).update(relay.username).digest('base64'));assert.ok(Number(relay.username.split(':')[0])>Date.now()/1000);assert.equal(JSON.stringify(cfg).includes(process.env.TURN_SECRET),false);delete process.env.TURN_SECRET;delete process.env.TURN_USERNAME;delete process.env.TURN_CREDENTIAL;const missing=await (await fetch(`http://127.0.0.1:${game.server.address().port}/api/config`)).json();assert.equal(missing.hasTurn,false);}
 finally{keys.forEach(k=>before[k]===undefined?delete process.env[k]:process.env[k]=before[k]);await game.close();}
});
