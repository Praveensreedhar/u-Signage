export const isOnlineMedia=media=>['application/rss+xml','video/youtube'].includes(media?.type);
let youtubeReady;
function loadYouTube(){
 if(globalThis.YT?.Player)return Promise.resolve(globalThis.YT);
 if(youtubeReady)return youtubeReady;
 youtubeReady=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
  const timer=setTimeout(()=>{youtubeReady=null;reject(Error('YouTube could not load. Check the Internet connection.'));},20000);
  const previous=globalThis.onYouTubeIframeAPIReady;
  globalThis.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);previous?.();resolve(globalThis.YT);};
  script.onerror=()=>{clearTimeout(timer);youtubeReady=null;script.remove();reject(Error('YouTube could not load.'));};
  document.head.append(script);
 });
 return youtubeReady;
}
const node=(tag,className,text)=>{const el=document.createElement(tag);el.className=className;if(text!==undefined)el.textContent=text;return el;};

// Shared lifecycle for the display and editor: no online source can supply HTML.
export function mountOnlineMedia(host,item,{playing=true,onReady=()=>{},onEnded=()=>{},onError=()=>{}}={}){
 let disposed=false,active=playing,player,rotation,refresh,watch,requestController,ready=false,lastTime=0,lastProgress=performance.now();
 const root=node('div','online-media');host.append(root);
 const controller={
  pause(){active=false;player?.pauseVideo?.();},
  play(){active=true;lastProgress=performance.now();player?.playVideo?.();},
  get currentTime(){return player?.getCurrentTime?.()||0;},
  get duration(){return player?.getDuration?.()||0;},
  destroy(){disposed=true;clearInterval(rotation);clearInterval(refresh);clearInterval(watch);requestController?.abort();player?.destroy?.();root.remove();}
 };
 const fail=message=>{if(!disposed)onError(message);};
 if(item.type==='application/rss+xml'){
  root.classList.add('rss-slide');
  const brand=node('div','rss-brand','RSS / HEADLINES'),feedTitle=node('div','rss-feed-title',item.name),headline=node('h2','rss-headline','Loading headlines…'),summary=node('p','rss-summary'),date=node('div','rss-date'),footer=node('div','rss-footer'),counter=node('span','rss-counter'),status=node('span','rss-status');
  footer.append(counter,status);root.append(brand,feedTitle,headline,summary,date,footer);
  let entries=[],index=0;
  const show=()=>{const entry=entries[index];if(!entry)return;headline.textContent=entry.title;summary.textContent=entry.summary;date.textContent=entry.published?new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(entry.published)):'';counter.textContent=(index+1)+' / '+entries.length;};
  const update=async()=>{
   if(disposed)return;
   requestController=new AbortController();
   const timeout=setTimeout(()=>requestController?.abort(),15000);
   try{
    const response=await fetch(item.url,{signal:requestController.signal});const data=await response.json();
    if(!response.ok)throw Error(data.error||'Feed is unavailable.');
    if(disposed)return;
    entries=data.entries;index=0;feedTitle.textContent=data.title||item.name;status.textContent=data.stale?'Showing cached headlines':'Updates every 5 minutes';show();
    if(!ready){ready=true;onReady();}
   }catch(error){if(!disposed){if(ready)status.textContent='Feed temporarily unavailable · showing last headlines';else fail(error.message);}}
   finally{clearTimeout(timeout);}
  };
  rotation=setInterval(()=>{if(active&&entries.length){index=(index+1)%entries.length;show();}},8000);
  refresh=setInterval(update,300000);update();
 }else{
  root.classList.add('youtube-slide');
  let videoId;try{videoId=new URL(item.source_url||item.url).searchParams.get('v');}catch{}
  if(!/^[\w-]{11}$/.test(videoId||'')){queueMicrotask(()=>fail('Invalid YouTube video link.'));return controller;}
  const iframe=document.createElement('iframe');iframe.title=item.name||'YouTube video';iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';
  const params=new URLSearchParams({enablejsapi:'1',origin:location.origin,autoplay:active?'1':'0',mute:'1',playsinline:'1',rel:'0',controls:'1'});
  iframe.src='https://www.youtube-nocookie.com/embed/'+videoId+'?'+params;root.append(iframe);
  loadYouTube().then(YT=>{
   if(disposed)return;
   player=new YT.Player(iframe,{events:{
    onReady(event){if(disposed)return;event.target.mute();if(active)event.target.playVideo();else{event.target.pauseVideo();ready=true;onReady();}},
    onStateChange(event){if(disposed)return;if(event.data===1){if(!active){event.target.pauseVideo();return;}if(!ready){ready=true;onReady();}}if(event.data===0&&active)onEnded();},
    onError(event){const messages={2:'Invalid YouTube video.',5:'YouTube cannot play in this browser.',100:'This YouTube video is private or unavailable.',101:'The video owner has disabled embedding.',150:'The video owner has disabled embedding.',153:'YouTube requires a valid site origin. Reload the player from its HTTPS address.'};fail(messages[event.data]||'YouTube playback failed.');},
    onAutoplayBlocked(){fail('YouTube autoplay was blocked by the browser.');}
   }});
   watch=setInterval(()=>{if(!active||!ready)return;const time=player.getCurrentTime?.()||0;if(time!==lastTime){lastTime=time;lastProgress=performance.now();}else if(performance.now()-lastProgress>45000){clearInterval(watch);fail('YouTube playback stalled.');}},5000);
  }).catch(error=>fail(error.message));
 }
 return controller;
}
