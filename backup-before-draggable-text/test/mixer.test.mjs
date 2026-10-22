import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioMixer, envelope } from '../public/audio-mixer.js';

test('fade envelope supports fades, overlaps, and mute', () => {
  assert.equal(envelope(80,1,20,2,3),0.4);
  assert.equal(envelope(80,10,1.5,2,3),0.4);
  assert.equal(envelope(80,1,1,4,4),0.2);
  assert.equal(envelope(0,10,10,0,0),0);
  assert.equal(envelope(100,10,0,0,2),0);
});

test('overlapping tracks survive scene changes and stop at their range or reset', async () => {
  const oldAudio=globalThis.Audio, oldContext=globalThis.AudioContext;
  class Node { constructor(){this.gain={value:0,setTargetAtTime(v){this.value=v;}};this.frequency={value:0};this.Q={value:0};}connect(){return arguments[0];}disconnect(){} }
  globalThis.Audio=class { constructor(url){this.src=url;this.currentTime=1;this.paused=true;} play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){this.src='';}load(){} };
  globalThis.AudioContext=class { constructor(){this.state='running';this.currentTime=1;this.destination={};}createDynamicsCompressor(){return new Node();}createMediaElementSource(){return new Node();}createBiquadFilter(){return new Node();}createGain(){return new Node();}resume(){return Promise.resolve();} };
  const mixer=new AudioMixer(()=>{},()=>{});
  try {
    const tracks=[{id:'a',name:'Music',url:'/a',first_scene:1,last_scene:null,volume:70,loop:1,fade_in:0,fade_out:2,effect:'bass'},{id:'b',name:'Voice',url:'/b',first_scene:1,last_scene:1,volume:50,loop:0,fade_in:0,fade_out:0,effect:'voice'}];
    mixer.enter(tracks,0,3,10,null);assert.equal(mixer.entries.size,2);
    const continuous=mixer.entries.get('a').audio, short=mixer.entries.get('b').audio;
    mixer.enter(tracks,1,3,10,null);assert.equal(mixer.entries.size,1);assert.equal(mixer.entries.get('a').audio,continuous);assert.equal(short.paused,true);assert.equal(continuous.paused,false);
    mixer.enter(tracks,2,3,10,{currentTime:9,duration:10});assert.equal(mixer.entries.get('a').gain.gain.value,0.35);
    mixer.reset();assert.equal(mixer.entries.size,0);assert.equal(continuous.paused,true);
  } finally { clearInterval(mixer.interval);mixer.reset();globalThis.Audio=oldAudio;globalThis.AudioContext=oldContext; }
});
