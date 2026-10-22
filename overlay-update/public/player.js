import { PlaybackClock } from '/playback-clock.js';
import { slideFrames } from '/transitions.js';
import { createTextOverlay } from '/text-overlay.js';
import { AudioMixer } from '/audio-mixer.js';
const $=s=>document.querySelector(s);
const playbackClock=new PlaybackClock();let paused=false;
let token=localStorage.getItem('signal-player-token'), current=null, index=0, timer, watchdog, error='', busy=false, generation=0;
function message(title,description,detail=''){ $('#message').hidden=false;$('#title').textContent=title;$('#description').textContent=description;$('#detail').textContent=detail; }
const mixer=new AudioMixer(()=>$('#enable-audio').hidden=false, text=>{error=text;});
const sceneAudio=new Audio();sceneAudio.preload='auto';
function stopAudio(){sceneAudio.pause();sceneAudio.removeAttribute('src');sceneAudio.load();$('#enable-audio').hidden=true;}
function startAudio(item){stopAudio();if(!item.audio_url)return;sceneAudio.src=item.audio_url;sceneAudio.volume=(item.audio_volume??100)/100;sceneAudio.loop=!!item.audio_loop;if(!paused)sceneAudio.play().catch(e=>{if(e.name==='NotAllowedError')$('#enable-audio').hidden=false;else if(e.name!=='AbortError')error='Scene audio could not play.';});}
function applyPlaybackPaused(value){
 const wasPaused=paused;paused=value;playbackClock.setPaused(value);mixer.setPaused(value);
 const videos=$('#stage').querySelectorAll('video');
 if(value){videos.forEach(v=>{v.autoplay=false;v.pause();});sceneAudio.pause();$('#stage').getAnimations({subtree:true}).forEach(a=>a.pause());$('#enable-audio').hidden=true;}
 else if(wasPaused){$('#stage').getAnimations({subtree:true}).forEach(a=>a.play());videos.forEach(v=>{if(!v.ended)v.play().catch(e=>{if(e.name!=='AbortError')error='Unable to resume video.';});});if(sceneAudio.getAttribute('src')&&!sceneAudio.ended)sceneAudio.play().catch(()=>$('#enable-audio').hidden=false);}
}
function stop(){mixer.reset();stopAudio();generation++;playbackClock.clearTimeout(timer);playbackClock.clearTimeout(watchdog);for(const child of [...$('#stage').children])dispose(child);}
async function request(url,body={}){const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const result=await res.json();if(!res.ok)throw Object.assign(new Error(result.error),{status:res.status});return result;}
async function enroll(){const result=await request('/api/player/enroll');token=result.token;localStorage.setItem('signal-player-token',token);}
function dispose(el){for(const video of el.tagName==='VIDEO'?[el]:el.querySelectorAll('video')){video.pause();video.removeAttribute('src');video.load();}el.remove();}
function play(){
  stopAudio();generation++; playbackClock.clearTimeout(timer); playbackClock.clearTimeout(watchdog);
  if(!current?.items.length)return;
  const item=current.items[index%current.items.length], thisGeneration=generation;
  const outgoing=$('#stage').lastElementChild;
  for(const child of [...$('#stage').children])if(child!==outgoing)dispose(child);
  const scene=document.createElement('div');scene.className='signage-scene';scene.hidden=true;
  let ready=false, failedOnce=false;
  const next=()=>{if(thisGeneration!==generation)return;index=(index+1)%current.items.length;if(index===0)mixer.reset();play();};
  const el=document.createElement(item.type.startsWith('video/')?'video':'img');
  const failed=reason=>{if(thisGeneration!==generation||failedOnce)return;failedOnce=true;stopAudio();playbackClock.clearTimeout(timer);playbackClock.clearTimeout(watchdog);error='Cannot play '+item.name+': '+reason;dispose(scene);if(outgoing)dispose(outgoing);timer=playbackClock.setTimeout(next,5000);};
  const reveal=()=>{
    if(thisGeneration!==generation||ready||failedOnce)return;ready=true;playbackClock.clearTimeout(watchdog);error='';el.hidden=false;scene.hidden=false;const overlay=createTextOverlay(item.text_overlay,item.type.startsWith('video/')&&item.video_mode==='full'?el.duration:item.duration);if(overlay)scene.append(overlay);$('#message').hidden=true;startAudio(item);mixer.enter(current.audio_tracks||[],index,current.items.length,item.duration,el.tagName==='VIDEO'&&item.video_mode==='full'?el:null);
    const frames=slideFrames;
    if(outgoing&&frames[item.transition]){const animation=scene.animate(frames[item.transition],{duration:Math.min((item.transition_duration ?? 0.6)*1000,item.video_mode==='full'&&item.type.startsWith('video/') ? (Number.isFinite(el.duration)?el.duration*1000:10000) : item.duration*1000),easing:'ease-in-out'});animation.finished.then(()=>{if(outgoing.isConnected)dispose(outgoing);}).catch(()=>{});}else if(outgoing)dispose(outgoing);
    if(el.tagName!=='VIDEO'||item.video_mode==='timed')timer=playbackClock.setTimeout(next,item.duration*1000);
    if(paused)applyPlaybackPaused(true);
  };
  el.hidden=true;el.onerror=()=>failed('unsupported format or unavailable file');
  if(el.tagName==='VIDEO'){
    el.muted=true;el.autoplay=!paused;el.playsInline=true;el.loop=item.video_mode==='timed';el.onended=()=>{if(item.video_mode!=='timed')next();};
    el.onloadeddata=()=>{if(paused)reveal();else el.play().catch(()=>failed('autoplay blocked'));};
    const watch=()=>{if(thisGeneration!==generation)return;playbackClock.clearTimeout(watchdog);watchdog=playbackClock.setTimeout(()=>failed('playback stalled'),30000);};
    el.onplaying=()=>{reveal();watch();};el.ontimeupdate=watch;
  }else{el.alt=item.name;el.onload=reveal;}
  watchdog=playbackClock.setTimeout(()=>failed('loading timed out'),30000);scene.append(el);$('#stage').append(scene);el.src=item.url;
}
async function sync(){if(busy)return;busy=true;try{if(!token)await enroll();const result=await request('/api/player/sync',{error});$('#connection').hidden=true;$('#retry').hidden=true;if(result.pending){stop();current=null;message('Let’s connect this display.','In your U Signal dashboard, choose Add display and enter this code.','Pairing codes expire after 15 minutes.');$('#code').hidden=false;$('#code').textContent=result.code.slice(0,4)+' '+result.code.slice(4);return;}$('#code').hidden=true;document.title=result.name+' · U Signal';applyPlaybackPaused(!!result.paused);if(!result.items.length){stop();current=result;message(result.name,result.playlist?'This playlist is empty.':'Your display is connected.','Assign a playlist and add media in the dashboard. Playback will start automatically.');return;}if(current?.revision!==result.revision){mixer.reset();current=result;index=0;layoutStage();play();}}catch(e){if(e.status===401){stop();current=null;token=null;localStorage.removeItem('signal-player-token');$('#code').hidden=true;message('Pair this display again.',e.message);$('#retry').hidden=false;}else{$('#connection').hidden=false;if(!current?.items.length)message('Waiting for the server.','Check the network connection. We’ll retry automatically.');}}finally{busy=false;}}
$('#retry').onclick=()=>sync();$('#fullscreen').onclick=()=>document.documentElement.requestFullscreen().catch(()=>{});
document.addEventListener('dblclick',()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen().catch(()=>{});});
$('#enable-audio').onclick=async()=>{if(paused)return;try{await Promise.all([mixer.enable(),...(sceneAudio.getAttribute('src')?[sceneAudio.play()]:[])]);$('#enable-audio').hidden=true;}catch{error='Audio could not play. Try Enable audio again.';}};
sync();setInterval(sync,3000);

function layoutStage(){if(!current)return;const stage=$('#stage'),rotation=current.rotation||0,turn=rotation===90||rotation===270;const availableWidth=turn?innerHeight:innerWidth,availableHeight=turn?innerWidth:innerHeight;const profile=current.profile;const ratio=profile?profile.width/profile.height:availableWidth/availableHeight;const width=Math.min(availableWidth,availableHeight*ratio),height=width/ratio;stage.className='';Object.assign(stage.style,{inset:'auto',left:'50%',top:'50%',width:width+'px',height:height+'px',transform:`translate(-50%,-50%) rotate(${rotation}deg)`});}
addEventListener('resize',layoutStage);
