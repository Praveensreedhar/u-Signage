export function attachBoxEditor(host, initial, onChange) {
  let box={...initial}, drag;
  const frame=document.createElement('div');
  frame.className='overlay-box-editor';frame.tabIndex=0;
  frame.setAttribute('aria-label','Text box. Drag to move. Arrow keys move; Shift and arrows resize.');
  for(const direction of ['n','s','e','w','ne','nw','se','sw']){
    const handle=document.createElement('span');handle.className='box-handle handle-'+direction;handle.dataset.direction=direction;frame.append(handle);
  }
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const draw=()=>{Object.assign(frame.style,{left:box.x+'%',top:box.y+'%',width:box.width+'%',height:box.height+'%'});};
  const update=()=>{draw();onChange({...box});};
  frame.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();frame.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,box:{...box},rect:host.getBoundingClientRect(),direction:e.target.dataset.direction||''};frame.setPointerCapture(e.pointerId);};
  frame.onpointermove=e=>{
    if(!drag)return;
    const dx=(e.clientX-drag.x)/drag.rect.width*100,dy=(e.clientY-drag.y)/drag.rect.height*100,b=drag.box,d=drag.direction;
    box={...b};
    if(!d){box.x=clamp(b.x+dx,0,100-b.width);box.y=clamp(b.y+dy,0,100-b.height);}
    if(d.includes('e'))box.width=clamp(b.width+dx,5,100-b.x);
    if(d.includes('s'))box.height=clamp(b.height+dy,5,100-b.y);
    if(d.includes('w')){box.x=clamp(b.x+dx,0,b.x+b.width-5);box.width=b.width+b.x-box.x;}
    if(d.includes('n')){box.y=clamp(b.y+dy,0,b.y+b.height-5);box.height=b.height+b.y-box.y;}
    update();
  };
  frame.onpointerup=frame.onpointercancel=frame.onlostpointercapture=()=>{drag=null;};
  frame.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();if(e.shiftKey){box.width=clamp(box.width+delta[0],5,100-box.x);box.height=clamp(box.height+delta[1],5,100-box.y);}else{box.x=clamp(box.x+delta[0],0,100-box.width);box.y=clamp(box.y+delta[1],0,100-box.height);}update();};
  host.append(frame);draw();
}
