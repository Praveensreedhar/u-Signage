export const textAnimations = {none:'None', fade:'Fade in', up:'Slide up', left:'Slide from left', zoom:'Zoom in'};
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
  const frames = {
    fade:[{opacity:0},{opacity:1}],
    up:[{opacity:0,transform:'translateY(50px)'},{opacity:1,transform:'translateY(0)'}],
    left:[{opacity:0,transform:'translateX(-100px)'},{opacity:1,transform:'translateX(0)'}],
    zoom:[{opacity:0,transform:'scale(0.6)'},{opacity:1,transform:'scale(1)'}]
  };
  if (frames[o.animation]) text.animate(frames[o.animation], {duration:Math.min(o.seconds, slideSeconds)*1000,easing:'ease-out',fill:'both'});
  return layer;
}
