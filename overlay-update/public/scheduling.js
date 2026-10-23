const formatters=new Map();
export function activeSchedule(s, instant=Date.now()) {
 if(!s.enabled)return false;
 let fmt=formatters.get(s.timezone);
 if(!fmt){fmt=new Intl.DateTimeFormat('en-CA',{timeZone:s.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});formatters.set(s.timezone,fmt);}
 const p=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
 const date=`${p.year}-${p.month}-${p.day}`, time=`${p.hour}:${p.minute}`;
 let anchor=date;
 if(s.start_time<s.end_time){if(time<s.start_time||time>=s.end_time)return false;}
 else if(time<s.end_time){anchor=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
 else if(time<s.start_time)return false;
 return (!s.start_date||anchor>=s.start_date)&&(!s.end_date||anchor<=s.end_date)&&s.days.split(',').includes(String(new Date(anchor+'T00:00:00Z').getUTCDay()));
}
export function selectSchedule(schedules,display,instant=Date.now()) {
 return schedules.filter(s=>(!s.scope||s.scope==='assignment')&&(s.display_id===display.id||(s.group_id&&s.group_id===display.group_id))&&activeSchedule(s,instant)).sort((a,b)=>Number(!!b.display_id)-Number(!!a.display_id)||b.priority-a.priority||a.id.localeCompare(b.id))[0]||null;
}

// Enabled windows for a content target are combined with OR; no enabled windows
// means unrestricted. Playlist and item windows are evaluated independently.
export function contentAvailable(schedules,scope,id,instant=Date.now()) {
 const windows=schedules.filter(s=>s.scope===scope&&(scope==='item'?s.item_id:s.playlist_id)===id&&s.enabled);
 return !windows.length||windows.some(s=>activeSchedule(s,instant));
}

// Audio ranges refer to original scene numbers. Map them to the visible sequence
// so skipping a scene does not move narration onto the wrong scene.
export function scheduledContent(schedules,playlistId,items,tracks,instant=Date.now()) {
 if(!contentAvailable(schedules,'playlist',playlistId,instant))return {items:[],audio_tracks:[],schedule_blocked:'playlist'};
 const visible=items.map((item,index)=>({item,scene:index+1})).filter(({item})=>contentAvailable(schedules,'item',item.id,instant));
 const audio_tracks=tracks.flatMap(track=>{
  const indexes=visible.flatMap(({scene},index)=>scene>=track.first_scene&&scene<=(track.last_scene??items.length)?[index+1]:[]);
  return indexes.length?[{...track,first_scene:indexes[0],last_scene:track.last_scene==null?null:indexes.at(-1)}]:[];
 });
 return {items:visible.map(({item})=>item),audio_tracks,schedule_blocked:items.length&&!visible.length?'items':null};
}
