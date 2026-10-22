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
 return schedules.filter(s=>(s.display_id===display.id||(s.group_id&&s.group_id===display.group_id))&&activeSchedule(s,instant)).sort((a,b)=>Number(!!b.display_id)-Number(!!a.display_id)||b.priority-a.priority||a.id.localeCompare(b.id))[0]||null;
}
