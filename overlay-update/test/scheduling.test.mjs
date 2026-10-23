import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activeSchedule,selectSchedule,contentAvailable,scheduledContent} from '../public/scheduling.js';
import {scheduleSettings} from '../schedule-settings.mjs';
const base={id:'a',display_id:'d',group_id:null,enabled:1,priority:0,timezone:'Asia/Kolkata',days:'1',start_time:'22:00',end_time:'02:00',start_date:'2026-10-05',end_date:'2026-10-05'};
test('overnight windows use starting weekday/date; end is exclusive',()=>{
 for(const [time,expected] of [['2026-10-05T16:29Z',false],['2026-10-05T16:30Z',true],['2026-10-05T20:29Z',true],['2026-10-05T20:30Z',false],['2026-10-06T16:30Z',false]])assert.equal(activeSchedule(base,Date.parse(time)),expected,time);
 assert.equal(activeSchedule({...base,enabled:0},Date.parse('2026-10-05T17:00Z')),false);
});
test('DST follows local wall clock, including repeated hour',()=>{
 const s={...base,timezone:'America/New_York',days:'0',start_time:'01:00',end_time:'02:00',start_date:null,end_date:null};
 assert.ok(activeSchedule(s,Date.parse('2026-11-01T05:30Z')));
 assert.ok(activeSchedule(s,Date.parse('2026-11-01T06:30Z')));
 assert.equal(activeSchedule(s,Date.parse('2026-11-01T07:00Z')),false);
});
test('display precedence, priority, stable tie order and fallback',()=>{
 const instant=Date.parse('2026-10-05T17:00Z'),d={id:'d',group_id:'g'};
 const group={...base,id:'g',display_id:null,group_id:'g',priority:100};
 assert.equal(selectSchedule([group,base],d,instant).id,'a');
 assert.equal(selectSchedule([base,{...base,id:'b',priority:1}],d,instant).id,'b');
 assert.equal(selectSchedule([{...base,id:'b'},base],d,instant).id,'a');
 assert.equal(selectSchedule([base],d,Date.parse('2026-10-05T21:00Z')),null);
 assert.ok(activeSchedule({...base,days:'0,1,2,3,4,5,6',start_time:'00:00',end_time:'00:00'},instant));
});
test('reject malformed timezone, dates, days and times',()=>{
 for(const change of [{timezone:'Bad/Zone'},{start_date:'2026-02-30'},{end_date:'2026-01-01'},{days:''},{days:'7'},{start_time:'25:00'},{priority:101}])assert.throws(()=>scheduleSettings({...base,...change}),{status:400});
});

test('content windows combine by OR, remain independent of assignments, and intersect playlist/item availability',()=>{
 const instant=Date.parse('2026-10-05T17:00Z');
 const open={...base,scope:'playlist',playlist_id:'p',display_id:null,start_date:null,end_date:null};
 const closed={...open,id:'closed',start_date:'2099-01-01'};
 assert.equal(contentAvailable([],'playlist','p',instant),true);
 assert.equal(contentAvailable([{...closed,enabled:0}],'playlist','p',instant),true);
 assert.equal(contentAvailable([closed],'playlist','p',instant),false);
 assert.equal(contentAvailable([closed,open],'playlist','p',instant),true);
 assert.equal(contentAvailable([closed],'playlist','other',instant),true);
 assert.equal(selectSchedule([open],{id:'d'},instant),null);
 const items=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
 const itemWindow={...closed,scope:'item',item_id:'b'};
 const result=scheduledContent([open,itemWindow],'p',items,[],instant);
 assert.deepEqual(result.items.map(i=>i.id),['a','c','d']);
 assert.equal(result.schedule_blocked,null);
 assert.equal(scheduledContent([closed],'p',items,[],instant).schedule_blocked,'playlist');
 assert.equal(scheduledContent([{...itemWindow,item_id:'a'}],'p',[items[0]],[],instant).schedule_blocked,'items');
});

test('scheduled media keeps playlist audio ranges aligned with the original scenes',()=>{
 const instant=Date.parse('2026-10-05T17:00Z');
 const closed={...base,scope:'item',playlist_id:'p',display_id:null,start_date:'2099-01-01',end_date:null};
 const items=['a','b','c','d'].map(id=>({id}));
 const tracks=[{id:'all',first_scene:1,last_scene:null},{id:'middle',first_scene:2,last_scene:3},{id:'hidden',first_scene:2,last_scene:2},{id:'last',first_scene:4,last_scene:4}];
 const result=scheduledContent([{...closed,item_id:'b'}],'p',items,tracks,instant);
 assert.deepEqual(result.audio_tracks,[{id:'all',first_scene:1,last_scene:null},{id:'middle',first_scene:2,last_scene:2},{id:'last',first_scene:3,last_scene:3}]);
 assert.deepEqual(scheduledContent([],'p',items,tracks,instant).audio_tracks,tracks);
 assert.deepEqual(scheduledContent([{...closed,scope:'playlist'}],'p',items,tracks,instant).audio_tracks,[]);
});
