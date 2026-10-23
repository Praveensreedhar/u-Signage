import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

test('legacy schedules migrate; playlist and per-item schedules persist and control every assigned display',async t=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'usignal-content-'));
 // Real pre-upgrade schema and data, including an existing display-group rule.
 const db=new DatabaseSync(path.join(data,'signage.sqlite'));
 db.exec(`PRAGMA foreign_keys=OFF;
 CREATE TABLE playlists(id TEXT PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,playlist_id TEXT REFERENCES playlists(id) ON DELETE SET NULL);
 CREATE TABLE schedules(id TEXT PRIMARY KEY,name TEXT NOT NULL,playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,display_id TEXT REFERENCES displays(id) ON DELETE CASCADE,group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,timezone TEXT NOT NULL,days TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,start_date TEXT,end_date TEXT,priority INTEGER NOT NULL,enabled INTEGER NOT NULL);
 INSERT INTO playlists VALUES('p','Existing playlist');
 INSERT INTO groups VALUES('g','Existing group','p');
 INSERT INTO schedules VALUES('legacy','Existing rule','p',NULL,'g','UTC','0,1,2,3,4,5,6','00:00','00:00',NULL,NULL,0,1);`);
 db.close();
 let child,cookie='';
 const stop=async()=>{if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});};
 t.after(async()=>{await stop();await rm(data,{recursive:true,force:true});});
 async function start(){
  child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,DATA_DIR:data,HOST:'127.0.0.1',PORT:'0',SECURE_COOKIE:'0'},stdio:['ignore','pipe','pipe']});
  return await new Promise((resolve,reject)=>{let out='',err='';const timer=setTimeout(()=>{child.kill();reject(Error('Startup timed out: '+err));},10000);child.stderr.on('data',b=>err+=b);child.stdout.on('data',b=>{out+=b;const m=out.match(/localhost:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code+': '+err));});});
 }
 let base=await start();
 async function api(route,method='GET',body,token){const response=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const value=await response.json();return {status:response.status,value,response};}
 async function save(route,body,method='POST'){const result=await api(route,method,body);assert.ok(result.status<300,JSON.stringify(result.value));return result.value.id;}
 await save('/api/setup',{password:'content-integration-password'});
 const login=await api('/api/login','POST',{password:'content-integration-password'});cookie=login.response.headers.get('set-cookie').split(';')[0];
 const tokens=[];
 for(let i=0;i<2;i++){const pairing=(await api('/api/player/enroll','POST',{})).value;tokens.push(pairing.token);await save('/api/displays',{name:'Display '+i,group_id:'g',code:pairing.code});}
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8b8AAAAASUVORK5CYII=','base64');
 const upload=await fetch(base+'/api/media',{method:'POST',headers:{Cookie:cookie,'X-File-Name':'schedule.png'},body:png});assert.equal(upload.status,201);const media=(await upload.json()).id;
 const first=await save('/api/items',{playlist_id:'p',media_id:media,duration:10,position:0});
 const second=await save('/api/items',{playlist_id:'p',media_id:media,duration:10,position:1});
 const sync=async(token=tokens[0])=>(await api('/api/player/sync','POST',{},token)).value;
 const before=await sync();assert.equal(before.schedule,'Existing rule');assert.deepEqual(before.items.map(i=>i.id),[first,second]);
 const open={name:'Content window',playlist_id:'p',timezone:'UTC',days:'0,1,2,3,4,5,6',start_time:'00:00',end_time:'00:00',priority:0,enabled:1};
 const closed={...open,start_date:'2099-01-01'};
 const window=await save('/api/schedules',{...closed,scope:'item',item_id:first});
 for(const token of tokens){const result=await sync(token);assert.deepEqual(result.items.map(i=>i.id),[second]);assert.notEqual(result.revision,before.revision);assert.equal(result.schedule,'Existing rule');}
 assert.equal((await api('/api/schedules','POST',{...open,scope:'item',item_id:second,display_id:'missing'})).status,400);
 assert.equal((await api('/api/schedules','POST',{...open,scope:'item'})).status,400);
 assert.equal((await api('/api/schedules','POST',{...open,scope:'unknown'})).status,400);
 const playlistWindow=await save('/api/schedules',{...closed,scope:'playlist'});
 assert.equal((await sync()).schedule_blocked,'playlist');assert.deepEqual((await sync()).items,[]);
 const extraWindow=await save('/api/schedules',{...open,scope:'playlist'});
 assert.deepEqual((await sync()).items.map(i=>i.id),[second]);
 await api('/api/schedules/'+extraWindow,'DELETE');
 await save('/api/schedules/'+playlistWindow,{...closed,scope:'playlist',enabled:0},'PUT');
 assert.deepEqual((await sync()).items.map(i=>i.id),[second]);
 await save('/api/schedules/'+window,{...closed,scope:'item',item_id:first,enabled:0},'PUT');
 assert.deepEqual((await sync()).items.map(i=>i.id),[first,second]);
 await save('/api/schedules/'+window,{...closed,scope:'item',item_id:first},'PUT');
 await save('/api/schedules',{...closed,scope:'item',item_id:second});
 assert.equal((await sync()).schedule_blocked,'items');
 await stop();base=await start();assert.equal((await sync()).schedule_blocked,'items');
 assert.equal((await api('/api/state')).value.schedules.find(s=>s.id==='legacy').scope,'assignment');
 const other=await save('/api/playlists',{name:'Other playlist'});
 assert.equal((await api('/api/schedules','POST',{...open,playlist_id:other,scope:'item',item_id:first})).status,400);
 await save('/api/items/'+first,{playlist_id:other,media_id:media,duration:10,position:0},'PUT');
 assert.equal((await api('/api/state')).value.schedules.find(s=>s.id===window).playlist_id,other);
 await api('/api/items/'+first,'DELETE');assert.ok(!(await api('/api/state')).value.schedules.some(s=>s.id===window));
});
