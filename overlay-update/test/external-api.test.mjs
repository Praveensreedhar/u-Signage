import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('online media API preserves legacy media, validates sources, and plays through normal playlist/schedule manifests',async t=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'usignal-online-api-'));
 const db=new DatabaseSync(path.join(data,'signage.sqlite'));db.exec("CREATE TABLE media(id TEXT PRIMARY KEY,name TEXT NOT NULL,file TEXT NOT NULL,type TEXT NOT NULL,size INTEGER NOT NULL); INSERT INTO media VALUES('legacy','Existing image','legacy.png','image/png',100)");db.close();
 const child=spawn(process.execPath,['server.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{...process.env,DATA_DIR:data,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});await rm(data,{recursive:true,force:true});});
 const base=await new Promise((resolve,reject)=>{let out='',err='';const timer=setTimeout(()=>reject(Error('Server startup timed out: '+err)),10000);child.stderr.on('data',b=>err+=b);child.stdout.on('data',b=>{out+=b;const m=out.match(/localhost:(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code+': '+err));});});
 let cookie='';
 async function call(route,method='GET',body,token){const response=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {response,status:response.status,value:await response.json()};}
 assert.equal((await call('/api/external-media','POST',{kind:'youtube',name:'Video',url:'https://youtu.be/M7lc1UVf-VE'})).status,401);
 assert.equal((await call('/api/feeds/'+'a'.repeat(32))).status,401);
 await call('/api/setup','POST',{password:'online-api-test-password'});const login=await call('/api/login','POST',{password:'online-api-test-password'});cookie=login.response.headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/api/state')).value.media[0].source_url,'');
 assert.equal((await call('/api/external-media','POST',{kind:'rss',name:'Private',url:'http://169.254.169.254/latest/meta-data'})).status,400);
 assert.equal((await call('/api/external-media','POST',{kind:'youtube',name:'Bad',url:'https://youtube.com.evil.test/watch?v=M7lc1UVf-VE'})).status,400);
 const source=await call('/api/external-media','POST',{kind:'youtube',name:'YouTube demo',url:'https://youtu.be/M7lc1UVf-VE'});assert.equal(source.status,201);
 const id=source.value.id,playlist=(await call('/api/playlists','POST',{name:'Online sources'})).value.id;
 const item=await call('/api/items','POST',{playlist_id:playlist,media_id:id,duration:60,position:0,video_mode:'timed',text_overlay:{enabled:true,text:'Not over YouTube'}});assert.equal(item.status,201);
 const pairing=(await call('/api/player/enroll','POST',{})).value;await call('/api/displays','POST',{name:'Online display',code:pairing.code,playlist_id:playlist});
 const sync=await call('/api/player/sync','POST',{},pairing.token);assert.equal(sync.value.items[0].type,'video/youtube');assert.equal(sync.value.items[0].url,'https://www.youtube.com/watch?v=M7lc1UVf-VE');assert.equal(sync.value.items[0].text_overlay,'{}');
 assert.equal((await call('/api/media/'+id,'DELETE')).status,409);
 assert.equal((await call('/api/external-media/'+id,'PUT',{kind:'rss',name:'Wrong kind',url:'https://example.com/feed'})).status,400);
 const edited=await call('/api/external-media/'+id,'PUT',{kind:'youtube',name:'Updated demo',url:'https://www.youtube.com/watch?v=aqz-KE-bpKQ'});assert.equal(edited.status,200);
 assert.equal((await call('/api/player/sync','POST',{},pairing.token)).value.items[0].source_url,'https://www.youtube.com/watch?v=aqz-KE-bpKQ');
 await call('/api/schedules','POST',{scope:'item',name:'Future video',playlist_id:playlist,item_id:item.value.id,timezone:'UTC',days:'0,1,2,3,4,5,6',start_time:'00:00',end_time:'00:00',start_date:'2099-01-01',enabled:1});
 assert.equal((await call('/api/player/sync','POST',{},pairing.token)).value.schedule_blocked,'items');
 const headers=await fetch(base+'/player');assert.ok(headers.headers.get('content-security-policy').includes('frame-src https://www.youtube.com https://www.youtube-nocookie.com'));assert.equal(headers.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
 for(const asset of ['/online-media.js','/online-media.css'])assert.equal((await fetch(base+asset)).status,200);
 await call('/api/items/'+item.value.id,'DELETE');assert.equal((await call('/api/media/'+id,'DELETE')).status,200);assert.equal((await call('/api/state')).value.media.length,1);
});
