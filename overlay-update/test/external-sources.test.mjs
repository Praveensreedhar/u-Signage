import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {gzipSync} from 'node:zlib';
import {youtubeId,isPublicAddress,feedUrl,parseFeed,fetchFeedDocument,createFeedReader} from '../external-sources.mjs';

const rss='<?xml version="1.0"?><rss version="2.0"><channel><title>Daily &amp; News</title><item><title>First headline</title><description><![CDATA[<b>Hello</b> readers]]></description><pubDate>Fri, 23 Oct 2026 10:00:00 GMT</pubDate></item></channel></rss>';
test('RSS and Atom normalize headlines to plain text and reject document declarations',()=>{
 const feed=parseFeed(rss);assert.equal(feed.title,'Daily & News');assert.deepEqual(feed.entries,[{title:'First headline',summary:'Hello readers',published:'2026-10-23T10:00:00.000Z'}]);
 const atom=parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><entry><title>Second</title><summary type="html">&lt;p&gt;Safe text&lt;/p&gt;</summary><updated>2026-10-23T12:00:00Z</updated></entry></feed>');assert.equal(atom.entries[0].summary,'Safe text');
 for(const xml of ['<html><body>No feed</body></html>','<rss><channel></channel></rss>','<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>','<rss><broken></rss>'])assert.throws(()=>parseFeed(xml),{status:400});
 assert.throws(()=>parseFeed('a'.repeat(1024*1024+1)),{status:400});
});
test('YouTube accepts video URLs and rejects foreign hosts, credentials and non-video links',()=>{
 for(const url of ['https://www.youtube.com/watch?v=M7lc1UVf-VE','https://youtu.be/M7lc1UVf-VE?t=30','https://www.youtube.com/shorts/M7lc1UVf-VE','https://www.youtube.com/live/M7lc1UVf-VE','https://www.youtube-nocookie.com/embed/M7lc1UVf-VE'])assert.equal(youtubeId(url),'M7lc1UVf-VE');
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=M7lc1UVf-VE','https://user:secret@youtube.com/watch?v=M7lc1UVf-VE','https://youtube.com/playlist?list=123','https://youtu.be/bad'])assert.throws(()=>youtubeId(url),{status:400});
});
test('feed URLs and resolved addresses reject local, metadata, reserved, and mapped addresses',()=>{
 for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','192.168.1.1','169.254.169.254','100.100.100.200','0.0.0.0','224.0.0.1','192.0.2.1','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::'])assert.equal(isPublicAddress(ip),false,ip);
 for(const ip of ['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])assert.equal(isPublicAddress(ip),true,ip);
 for(const url of ['file:///etc/passwd','http://localhost/feed','http://127.1/feed','http://[::1]/feed','http://169.254.169.254/latest/meta-data','https://example.com:8443/feed','https://user:secret@example.com/feed'])assert.throws(()=>feedUrl(url),{status:400});
 assert.equal(feedUrl('https://example.com/feed#fragment').href,'https://example.com/feed');
});
function transport(responses,observed){return (url,options,callback)=>{
 const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{
  observed.push({url:url.href,options});const spec=responses.shift();const res=new PassThrough();res.statusCode=spec.status||200;res.headers=spec.headers||{};callback(res);res.end(spec.body||'');req.emit('close');
 });req.destroy=error=>{req.emit('error',error);req.emit('close');};return req;
};}
test('feed transport pins public DNS and rejects redirects or mixed DNS into private networks',async()=>{
 const observed=[];const options={lookup:async()=>[{address:'8.8.8.8',family:4}],request:transport([{body:rss}],observed)};
 assert.equal((await fetchFeedDocument('https://example.com/feed',options)).xml,rss);
 await new Promise((resolve,reject)=>observed[0].options.lookup('example.com',{},(error,address,family)=>{try{assert.equal(error,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);resolve();}catch(e){reject(e);}}));
 await assert.rejects(fetchFeedDocument('https://example.com/feed',{lookup:async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}],request:()=>{throw Error('Must not connect');}}),{status:400});
 const redirected=[];
 await assert.rejects(fetchFeedDocument('https://example.com/feed',{lookup:options.lookup,request:transport([{status:302,headers:{location:'http://169.254.169.254/latest/meta-data'}}],redirected)}),{status:400});assert.equal(redirected.length,1);
 await assert.rejects(fetchFeedDocument('https://example.com/feed',{lookup:options.lookup,request:transport([{headers:{'content-length':String(2*1024*1024)}}],[])}),/1 MB/);
 assert.equal((await fetchFeedDocument('https://example.com/feed',{lookup:options.lookup,request:transport([{headers:{'content-encoding':'gzip'},body:gzipSync(rss)}],[])})).xml,rss);
 await assert.rejects(fetchFeedDocument('https://example.com/feed',{lookup:options.lookup,request:transport([{headers:{'content-encoding':'gzip'},body:gzipSync('x'.repeat(1024*1024+1))}],[])}),/1 MB/);
});
test('RSS cache coalesces requests, refreshes, and retains bounded stale data on outage',async()=>{
 let now=0,calls=0,offline=false;
 const reader=createFeedReader({clock:()=>now,fetchDocument:async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,1));if(offline)throw Error('Offline');return {xml:rss};}});
 const [a,b]=await Promise.all([reader('https://example.com/feed'),reader('https://example.com/feed')]);assert.deepEqual(a,b);assert.equal(calls,1);
 now=10000;await reader('https://example.com/feed');assert.equal(calls,1);
 now=300001;offline=true;assert.equal((await reader('https://example.com/feed')).stale,true);
 now=86400001;await assert.rejects(reader('https://example.com/feed'),{status:400});
});
