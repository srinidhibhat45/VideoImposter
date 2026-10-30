// Development-only: seven real WebRTC clients using generated media, never user devices.
import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import {useCall} from '../src/useCall.js';
const emitFor=s=>(event,data={})=>new Promise((resolve,reject)=>s.timeout(7000).emit(event,data,(e,r)=>e||r?.error?reject(new Error(r?.error||String(e))):resolve(r)));
navigator.mediaDevices.getUserMedia=async({audio,video})=>{
 const tracks=[];let ctx,osc,timer;
 if(audio){ctx=new AudioContext();await ctx.resume();osc=ctx.createOscillator();const output=ctx.createMediaStreamDestination();osc.connect(output);osc.start();tracks.push(...output.stream.getTracks());}
 if(video){const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const painter=canvas.getContext('2d');const draw=()=>{painter.fillStyle=`hsl(${(Date.now()/20)%360} 50% 40%)`;painter.fillRect(0,0,160,90);};draw();timer=setInterval(draw,100);tracks.push(...canvas.captureStream(10).getTracks());}
 let stopped=0;tracks.forEach(track=>{const stop=track.stop.bind(track);track.stop=()=>{if(track.readyState==='ended')return;stop();if(++stopped===tracks.length){clearInterval(timer);osc?.stop();void ctx?.close();}};});
 return new MediaStream(tracks);
};
function Client({socket,label,setReport,joinTick}){
 const ref=useRef(socket);const [room,setRoom]=useState(null);const [messages,setMessages]=useState([]);const emit=emitFor(socket);const call=useCall(ref,room,emit,m=>setMessages(prev=>[...prev,m]),{relayOnly:new URLSearchParams(location.search).has('relay')});
 useEffect(()=>{const receive=v=>setRoom(v);socket.on('room:state',receive);return()=>socket.off('room:state',receive);},[]);
 useEffect(()=>{if(joinTick)void call.start(true);},[joinTick]);
 useEffect(()=>{setReport(label,{joined:Boolean(room),remoteCount:Object.keys(call.remote).length,connections:call.connections,localAudio:call.stream?.getAudioTracks().map(t=>({enabled:t.enabled,readyState:t.readyState})),localVideo:call.stream?.getVideoTracks().map(t=>({enabled:t.enabled,readyState:t.readyState})),quiet:call.quiet,mic:call.mic,camera:call.camera,messages});},[room,call.remote,call.connections,call.stream,call.quiet,call.mic,call.camera,messages]);
 return <section><h2>{label}</h2><button onClick={()=>call.start(true)}>Join generated call {label}</button><button onClick={call.toggleCamera}>Toggle camera {label}</button><button onClick={call.toggleMic}>Toggle mic {label}</button><button onClick={call.end}>Leave call {label}</button></section>;
}
function Harness(){
 const [clients]=useState(()=>Array.from({length:7},()=>io()));const [report,setReport]=useState({});const [status,setStatus]=useState('Ready');const [joinTick,setJoinTick]=useState(0);const reportUpdate=(label,value)=>setReport(prev=>({...prev,[label]:value}));
 const setup=async()=>{try{const created=await emitFor(clients[0])('room:create',{name:'Synthetic A'});for(let i=1;i<clients.length;i++){await emitFor(clients[i])('room:join',{name:`Synthetic ${String.fromCharCode(65+i)}`,code:created.code});await emitFor(clients[i])('player:ready',{ready:true});}setStatus('Room created with 7 synthetic clients');}catch(e){setStatus(e.message);}};
 const allConnected=Object.keys(report).length===7&&Object.values(report).every(r=>r.remoteCount===6&&Object.values(r.connections).filter(s=>s==='connected').length===6);
 return <main><h1>Alibi seven-player call test</h1><p>Generated camera/audio. No access to your devices.</p><button onClick={setup}>Set up test room</button><button onClick={()=>setJoinTick(n=>n+1)}>Join all generated calls</button><button onClick={()=>emitFor(clients[0])('game:start')}>Start private round</button><button onClick={()=>emitFor(clients[0])('game:reset')}>Return to lobby</button>{clients.map((socket,i)=><Client key={i} socket={socket} label={String.fromCharCode(65+i)} setReport={reportUpdate} joinTick={joinTick}/>)}<p>{status}</p><h2 id="result">{allConnected?'PASS: 7 clients, 21 connected peer pairs':'Waiting for connections'}</h2><pre id="report">{JSON.stringify(report,null,2)}</pre></main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
