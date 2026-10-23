import {lookup as dnsLookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import http from 'node:http';
import https from 'node:https';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';
import {XMLParser,XMLValidator} from 'fast-xml-parser';

const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
export function youtubeId(value){
 let url;try{url=new URL(value);}catch{invalid('Enter a valid YouTube video URL.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)invalid('Enter a valid YouTube video URL.');
 const host=url.hostname.toLowerCase().replace(/^www\./,''),parts=url.pathname.split('/').filter(Boolean);
 let id;
 if(host==='youtu.be')id=parts[0];
 else if(['youtube.com','m.youtube.com','youtube-nocookie.com'].includes(host))id=parts[0]==='watch'?url.searchParams.get('v'):['embed','shorts','live'].includes(parts[0])?parts[1]:null;
 if(!/^[\w-]{11}$/.test(id||''))invalid('Use a YouTube video link, not a channel or playlist link.');
 return id;
}
export function isPublicAddress(address){
 const family=isIP(address);
 if(family===4){
  const [a,b,c]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
 }
 if(family===6){
  const s=address.toLowerCase();
  return /^[23][0-9a-f]{3}:/.test(s)&&!/^2001:(?:0*:|0*db8:|0*2:|0*1[0-9a-f]:)/.test(s)&&!s.startsWith('2002:')&&!s.startsWith('3fff:');
 }
 return false;
}
export function feedUrl(value){
 let url;try{url=new URL(value);}catch{invalid('Enter a valid public RSS or Atom URL.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port)||url.href.length>2048)invalid('Use a public HTTP or HTTPS feed URL without credentials or a custom port.');
 const host=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||(isIP(host)&&!isPublicAddress(host)))invalid('Feeds must use a public Internet address.');
 url.hash='';return url;
}

// Resolve and validate each redirect, then pin the chosen public address to the
// connection. A second DNS lookup cannot redirect a request into the LAN/metadata.
export async function fetchFeedDocument(value,{lookup=dnsLookup,request}={}){
 let url=feedUrl(value);
 const deadline=Date.now()+12000;
 for(let redirects=0;redirects<=3;redirects++){
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const remaining=()=>Math.max(1,deadline-Date.now());
  let timer;
  let addresses;
  try{addresses=await Promise.race([lookup(host,{all:true,verbatim:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Feed lookup timed out.')),remaining());})]);}finally{clearTimeout(timer);}
  if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))invalid('Feed address must resolve only to public Internet addresses.');
  if(Date.now()>=deadline)invalid('Feed request timed out.');
  const selected=addresses[0];
  const response=await new Promise((resolve,reject)=>{
   const transport=request||(url.protocol==='https:'?https.request:http.request);
   const req=transport(url,{method:'GET',family:selected.family,autoSelectFamily:false,lookup:(_host,_options,callback)=>callback(null,selected.address,selected.family),headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9','Accept-Encoding':'identity','User-Agent':'USignal-RSS/1.0'}},res=>{
    const status=res.statusCode||0;
    if(status>=300&&status<400){res.resume();resolve({location:res.headers.location});return;}
    if(status!==200){res.resume();reject(Error('Feed server returned HTTP '+status+'.'));return;}
    const encoding=res.headers['content-encoding']||'identity';
    if(!['identity','gzip','deflate','br'].includes(encoding)){res.resume();reject(Error('Feed uses an unsupported compression format.'));return;}
    if(Number(res.headers['content-length']||0)>1024*1024){res.resume();reject(Error('Feed exceeds the 1 MB limit.'));return;}
    const chunks=[];let size=0;
    res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024){req.destroy(Error('Feed exceeds the 1 MB limit.'));return;}chunks.push(chunk);});
    res.on('end',()=>{try{let bytes=Buffer.concat(chunks);const decoder={gzip:gunzipSync,deflate:inflateSync,br:brotliDecompressSync}[encoding];if(decoder)bytes=decoder(bytes,{maxOutputLength:1024*1024});resolve({xml:bytes.toString('utf8'),url:url.href});}catch{reject(Error('Feed compression is invalid or exceeds the 1 MB limit.'));}});res.on('error',reject);res.on('aborted',()=>reject(Error('Feed response was interrupted.')));
   });
   const timeout=setTimeout(()=>req.destroy(Error('Feed request timed out.')),remaining());
   req.on('close',()=>clearTimeout(timeout));req.on('error',reject);req.end();
  });
  if(response.xml!==undefined)return response;
  if(!response.location||redirects===3)invalid('Feed has too many redirects or an invalid redirect.');
  url=feedUrl(new URL(response.location,url).href);
 }
}

const array=value=>value==null?[]:Array.isArray(value)?value:[value];
const text=value=>{
 if(value&&typeof value==='object')value=value['#text']??'';
 return String(value??'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
};
export function parseFeed(xml){
 if(Buffer.byteLength(xml)>1024*1024||/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml))invalid('Feed XML is too large or contains unsupported document declarations.');
 if(XMLValidator.validate(xml)!==true)invalid('The URL did not return valid RSS or Atom XML.');
 let document;try{document=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:false,parseAttributeValue:false,processEntities:true}).parse(xml);}catch{invalid('Unable to read this feed.');}
 const channel=document.rss?.channel||document.feed||document.RDF;
 if(!channel)invalid('Use an RSS or Atom feed URL, not a website page.');
 const entries=array(channel.item||channel.entry).slice(0,20).map(entry=>{
  const title=text(entry.title).slice(0,280),summary=text(entry.description||entry.summary||entry.content||entry.encoded).slice(0,1000);
  const date=text(entry.pubDate||entry.published||entry.updated||entry.date);
  return {title,summary,published:Number.isFinite(Date.parse(date))?new Date(date).toISOString():null};
 }).filter(entry=>entry.title||entry.summary);
 if(!entries.length)invalid('This feed has no readable headlines.');
 return {title:text(channel.title).slice(0,200)||'RSS feed',entries};
}

export function createFeedReader({fetchDocument=fetchFeedDocument,clock=Date.now}={}){
 const cache=new Map(),pending=new Map();
 return async value=>{
  const url=feedUrl(value).href,existing=cache.get(url),now=clock();
  if(existing&&now-existing.time<300000)return {...existing.feed,stale:false};
  if(pending.has(url))return pending.get(url);
  const job=(async()=>{
   try{const {xml}=await fetchDocument(url);const feed={...parseFeed(xml),updated_at:new Date(clock()).toISOString()};cache.delete(url);cache.set(url,{feed,time:clock()});if(cache.size>100)cache.delete(cache.keys().next().value);return {...feed,stale:false};}
   catch(error){if(existing&&now-existing.time<86400000)return {...existing.feed,stale:true};throw Object.assign(new Error(error.status?error.message:'Unable to load feed. Check its URL or try again later.'),{status:400});}
   finally{pending.delete(url);}
  })();
  pending.set(url,job);return job;
 };
}
