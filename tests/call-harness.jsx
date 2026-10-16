// Development-only browser test. Uses generated tracks, never the user's camera or mic.
import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import {useCall} from '../src/useCall.js';
const emitFor=s=>(event,data={})=>new Promise((resolve,reject)=>s.timeout(5000).emit(event,data,(e,r)=>e||r?.error?reject(new Error(r?.error||String(e))):resolve(r)));
const nodes=[];
navigator.mediaDevices.getUserMedia=async()=>{
 const ctx=new AudioContext();await ctx.resume();const osc=ctx.createOscillator();const output=ctx.createMediaStreamDestination();osc.connect(output);osc.start();
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const painter=canvas.getContext('2d');const timer=setInterval(()=>{painter.fillStyle=`hsl(${(Date.now()/20)%360} 50% 40%)`;painter.fillRect(0,0,160,90);painter.fillStyle='white';painter.fillText('Synthetic camera',10,45);},100);
 nodes.push({ctx,osc,timer});return new MediaStream([...output.stream.getTracks(),...canvas.captureStream(10).getTracks()]);
};
function Client({socket,label,setReport}){
 const ref=useRef(socket);const [room,setRoom]=useState(null);const [messages,setMessages]=useState([]);const emit=emitFor(socket);const call=useCall(ref,room,emit,m=>setMessages(prev=>[...prev,m]));
 useEffect(()=>{const receive=v=>setRoom(v);socket.on('room:state',receive);return()=>socket.off('room:state',receive);},[]);
 useEffect(()=>{setReport(label,{joined:Boolean(room),remoteCount:Object.keys(call.remote).length,connections:call.connections,localAudio:call.stream?.getAudioTracks().map(t=>({enabled:t.enabled,readyState:t.readyState})),localVideo:call.stream?.getVideoTracks().map(t=>({enabled:t.enabled,readyState:t.readyState})),quiet:call.quiet,mic:call.mic,camera:call.camera,messages});},[room,call.remote,call.connections,call.stream,call.quiet,call.mic,call.camera,messages]);
 return <section><h2>{label}</h2><button onClick={()=>call.start()}>Join generated call {label}</button><button onClick={call.toggleCamera}>Toggle camera {label}</button><button onClick={call.toggleMic}>Toggle mic {label}</button><button onClick={call.end}>Leave call {label}</button></section>;
}
function Harness(){
 const [a]=useState(()=>io());const [b]=useState(()=>io());const [third]=useState(()=>io());const [report,setReport]=useState({});const [status,setStatus]=useState('Ready');const reportUpdate=(label,value)=>setReport(prev=>({...prev,[label]:value}));
 const setup=async()=>{try{const created=await emitFor(a)('room:create',{name:'Synthetic A'});await emitFor(b)('room:join',{name:'Synthetic B',code:created.code});await emitFor(third)('room:join',{name:'Synthetic C',code:created.code});await emitFor(b)('player:ready',{ready:true});await emitFor(third)('player:ready',{ready:true});setStatus('Room created with 3 synthetic clients');}catch(e){setStatus(e.message);}};
 return <main><h1>Alibi synthetic call test</h1><p>No real camera or microphone access is requested.</p><button onClick={setup}>Set up test room</button><button onClick={()=>emitFor(a)('game:start')}>Start private round</button><button onClick={()=>emitFor(a)('game:reset')}>Return to lobby</button><Client socket={a} label="A" setReport={reportUpdate}/><Client socket={b} label="B" setReport={reportUpdate}/><p>{status}</p><pre id="report">{JSON.stringify(report,null,2)}</pre></main>;
}
createRoot(document.getElementById('root')).render(<Harness/>);
