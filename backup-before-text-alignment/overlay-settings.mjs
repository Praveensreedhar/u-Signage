export function overlaySettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid text overlay.');
  const {enabled=false,text='',position='bottom',animation='fade',seconds=0.6,size=4,color='#ffffff',background=true} = value;
  if (typeof enabled !== 'boolean' || typeof background !== 'boolean' || typeof text !== 'string' || text.length>1000 || (enabled&&!text.trim())) throw new Error('Enter overlay text (up to 1000 characters), or turn the overlay off.');
  if (!['top','center','bottom'].includes(position) || !['none','fade','up','left','zoom'].includes(animation)) throw new Error('Choose a valid text position and animation.');
  if (!Number.isFinite(Number(seconds)) || Number(seconds)<0.1 || Number(seconds)>10 || !Number.isFinite(Number(size)) || Number(size)<1 || Number(size)>10 || typeof color!=='string' || !/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Use a text size of 1–10%, an animation duration of 0.1–10 seconds, and a valid color.');
  let box;
  if (value.box !== undefined) {
    const b=value.box;
    if (!b || typeof b!=='object' || !['x','y','width','height'].every(k=>typeof b[k]==='number'&&Number.isFinite(b[k])) || b.x<0 || b.y<0 || b.width<5 || b.height<5 || b.x+b.width>100.001 || b.y+b.height>100.001) throw new Error('Keep the text box within the screen, with width and height of at least 5%.');
    box={x:b.x,y:b.y,width:b.width,height:b.height};
  }
  return JSON.stringify({...(box?{box}:{}),enabled,text,position,animation,seconds:Number(seconds),size:Number(size),color,background});
}
