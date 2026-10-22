export function overlaySettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid text overlay.');
  const {enabled=false,text='',position='bottom',animation='fade',seconds=0.6,size=4,color='#ffffff',background=true} = value;
  if (typeof enabled !== 'boolean' || typeof background !== 'boolean' || typeof text !== 'string' || text.length>1000 || (enabled&&!text.trim())) throw new Error('Enter overlay text (up to 1000 characters), or turn the overlay off.');
  if (!['top','center','bottom'].includes(position) || !['none','fade','up','left','zoom'].includes(animation)) throw new Error('Choose a valid text position and animation.');
  if (!Number.isFinite(Number(seconds)) || Number(seconds)<0.1 || Number(seconds)>10 || !Number.isFinite(Number(size)) || Number(size)<1 || Number(size)>10 || typeof color!=='string' || !/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Use a text size of 1–10%, an animation duration of 0.1–10 seconds, and a valid color.');
  return JSON.stringify({enabled,text,position,animation,seconds:Number(seconds),size:Number(size),color,background});
}
