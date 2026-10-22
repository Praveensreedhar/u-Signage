import {createTextOverlay,textLayers} from './text-overlay.js';

// A local visual preview: never enrolls a display or changes playlist data.
export function mountEditorPreview(host,{items,media,selectedId,onScene,onStatus}){
 let index=Math.max(0,items.findIndex(i=>i.id===selectedId)),playing=false,disposed=false,generation=0,frame,elapsed=0,started=0,scene,element,ready=false,limit=0;
 const time=value=>`${String(Math.floor(value/60)).padStart(2,'0')}:${(value%60).toFixed(1).padStart(4,'0')}`;
 const status=text=>onStatus?.(text);
 const clearScene=node=>{node?.querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});node?.remove();};
 function progress(){
   if(disposed)return;
   if(playing&&ready){elapsed=(performance.now()-started)/1000;if(element.tagName==='VIDEO'&&items[index].video_mode!=='timed')elapsed=element.currentTime;}
   const label=document.querySelector('#preview-time');if(label)label.textContent=time(Math.max(0,elapsed));
   document.querySelectorAll('.studio-playhead').forEach(line=>{const active=line.parentElement.dataset.clip===items[index]?.id;line.hidden=!active;line.style.left=Math.min(99,limit?elapsed/limit*100:0)+'%';});
   if(playing&&ready&&elapsed>=limit&&!(element.tagName==='VIDEO'&&items[index].video_mode!=='timed'))advance();
   frame=requestAnimationFrame(progress);
 }
 function render(animate=false){
   generation++;const own=generation;ready=false;elapsed=0;
   const previous=scene;
   host.querySelectorAll('.signage-scene').forEach(node=>{if(node!==previous)clearScene(node);});
   const item=items[index],m=item&&media.find(m=>m.id===item.media_id);
   if(!m){host.innerHTML='<div class="studio-empty">Your canvas is ready.<br>Add media from the library to begin.</div>';return;}
   onScene?.(item,index);
   const isVideo=m.type.startsWith('video/');
   scene=document.createElement('div');scene.className='signage-scene';scene.hidden=true;
   const activeScene=scene;
   element=document.createElement(isVideo?'video':'img');const visual=element;
   visual.muted=true;visual.draggable=false;visual.alt=m.name;
   activeScene.append(visual);host.append(activeScene);
   const failed=()=>{if(own!==generation||disposed)return;playing=false;status('Unable to preview this media. Check the file format.');updateButton();clearScene(previous);};
   const reveal=()=>{
     if(own!==generation||disposed||ready)return;
     ready=true;limit=isVideo&&item.video_mode!=='timed'&&Number.isFinite(visual.duration)?visual.duration:item.duration;
     activeScene.hidden=false;
     const overlays=textLayers(item.text_overlay).map(o=>animate?o:{...o,animation:'none'});
     activeScene.append(createTextOverlay(overlays,limit));
     const frames={fade:[{opacity:0},{opacity:1}],slide:[{transform:'translateX(100%)'},{transform:'translateX(0)'}],zoom:[{opacity:0,transform:'scale(1.15)'},{opacity:1,transform:'scale(1)'}]};
     if(animate&&frames[item.transition]){
       const animation=activeScene.animate(frames[item.transition],{duration:Math.min(item.transition_duration??0.6,limit)*1000,easing:'ease-in-out'});
       animation.finished.then(()=>clearScene(previous)).catch(()=>{});
     }else clearScene(previous);
     started=performance.now();status('Visual preview · audio is muted');
     if(isVideo&&playing)visual.play().catch(failed);
   };
   visual.onerror=failed;
   if(isVideo){visual.playsInline=true;visual.loop=item.video_mode==='timed';visual.onloadeddata=reveal;visual.onended=()=>{if(playing&&own===generation)advance();};}
   else visual.onload=reveal;
   visual.src='/media/'+m.file;
 }
 function updateButton(){const b=document.querySelector('#preview-play');if(b){b.textContent=playing?'Ⅱ Pause':'▶ Play';b.setAttribute('aria-pressed',String(playing));}}
 function advance(){if(index+1>=items.length){playing=false;elapsed=limit;element?.pause?.();scene?.getAnimations({subtree:true}).forEach(a=>a.finish());status('Preview complete · replay or choose a slide');updateButton();return;}index++;render(true);}
 render();progress();updateButton();
 return {
   pause(){if(playing){playing=false;element?.pause?.();scene?.getAnimations({subtree:true}).forEach(a=>a.pause());updateButton();}},
   toggle(){if(!items.length)return;if(playing){playing=false;element?.pause?.();scene?.getAnimations({subtree:true}).forEach(a=>a.pause());}else{playing=true;if(elapsed>=limit||!elapsed){render(true);}else{started=performance.now()-elapsed*1000;scene?.getAnimations({subtree:true}).forEach(a=>a.play());if(element?.tagName==='VIDEO')element.play().catch(()=>{playing=false;updateButton();status('Video playback was blocked.');});}}updateButton();},
   step(delta){if(!items.length)return;playing=false;index=(index+delta+items.length)%items.length;render();updateButton();},
   replay(){if(!items.length)return;playing=true;render(true);updateButton();},
   destroy(){disposed=true;generation++;cancelAnimationFrame(frame);host.querySelectorAll('.signage-scene').forEach(clearScene);}
 };
}
