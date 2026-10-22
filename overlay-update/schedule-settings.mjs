export function scheduleSettings(b){
 const bad=message=>{throw Object.assign(new Error(message),{status:400});};
 if(typeof b.timezone!=='string')bad('Choose a timezone.');
 try{new Intl.DateTimeFormat('en',{timeZone:b.timezone});}catch{bad('Enter a valid timezone, such as Asia/Kolkata.');}
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.start_time)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.end_time))bad('Enter valid start and end times.');
 const date=v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
 if(!date(b.start_date)||!date(b.end_date)||(b.start_date&&b.end_date&&b.start_date>b.end_date))bad('Check the schedule date range.');
 if(typeof b.days!=='string'||!/^([0-6],)*[0-6]$/.test(b.days))bad('Choose at least one day.');
 const priority=Number(b.priority??0),enabled=Number(b.enabled??1);
 if(!Number.isInteger(priority)||priority<0||priority>100||![0,1].includes(enabled))bad('Priority must be 0–100; select enabled or disabled.');
 return [b.timezone,[...new Set(b.days.split(','))].sort().join(','),b.start_time,b.end_time,b.start_date||null,b.end_date||null,priority,enabled];
}
