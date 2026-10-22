export const textAnimations = {none:'None', fade:'Fade in', up:'Slide up', left:'Slide from left', zoom:'Zoom in',lines:'Line by line',words:'Word by word',letters:'Letter by letter'};
export const textPositions = {top:'Top', center:'Center', bottom:'Bottom'};
export function createTextOverlay(value, slideSeconds = Infinity) {
  const o = typeof value === 'string' ? JSON.parse(value) : value;
  if (!o?.enabled || !o.text?.trim()) return null;
  const layer = document.createElement('div');
  layer.className = 'text-overlay text-overlay-' + o.position;
  if(o.box){layer.classList.add('text-overlay-free');Object.assign(layer.style,{left:o.box.x+'%',top:o.box.y+'%',width:o.box.width+'%',height:o.box.height+'%',right:'auto',bottom:'auto'});}
  const text = document.createElement('div');
  text.className = 'text-overlay-content';
  text.textContent = o.text;
  text.style.textAlign = o.align || 'center';
  text.style.color = o.color;
  text.style.fontSize = o.size + 'cqw';
  text.style.backgroundColor = o.background ? '#000000b3' : 'transparent';
  layer.append(text);
  if (['lines','words','letters'].includes(o.animation)) {
    text.textContent='';
    const parts=o.animation==='lines'?o.text.split(/\r?\n/):o.animation==='words'?o.text.split(/(\s+)/):Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(o.text),part=>part.segment);
    const units=[];
    parts.forEach((part,index)=>{
      if(o.animation!=='lines'&&/^\s+$/.test(part)){text.append(document.createTextNode(part));return;}
      const unit=document.createElement('span');unit.className='text-reveal-unit';unit.textContent=part;
      if(o.animation==='lines'){unit.style.display='block';if(!part)unit.append(document.createElement('br'));}
      text.append(unit);units.push(unit);
    });
    const total=Math.min(o.seconds,slideSeconds)*1000;
    const duration=total/Math.max(1,units.length);
    units.forEach((unit,index)=>unit.animate([{opacity:0},{opacity:1}],{delay:index*duration,duration,easing:'ease-out',fill:'both'}));
  }
  const frames = {
    fade:[{opacity:0},{opacity:1}],
    up:[{opacity:0,transform:'translateY(50px)'},{opacity:1,transform:'translateY(0)'}],
    left:[{opacity:0,transform:'translateX(-100px)'},{opacity:1,transform:'translateX(0)'}],
    zoom:[{opacity:0,transform:'scale(0.6)'},{opacity:1,transform:'scale(1)'}]
  };
  if (frames[o.animation]) text.animate(frames[o.animation], {duration:Math.min(o.seconds, slideSeconds)*1000,easing:'ease-out',fill:'both'});
  return layer;
}
