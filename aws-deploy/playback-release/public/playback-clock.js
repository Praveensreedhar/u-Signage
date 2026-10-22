export class PlaybackClock {
  constructor(){this.paused=false;this.timers=new Set();}
  setTimeout(callback,delay){const timer={callback,remaining:delay,started:0,id:null};this.timers.add(timer);if(!this.paused)this.arm(timer);return timer;}
  arm(timer){timer.started=performance.now();timer.id=setTimeout(()=>{this.timers.delete(timer);timer.id=null;timer.callback();},timer.remaining);}
  clearTimeout(timer){if(!timer)return;clearTimeout(timer.id);this.timers.delete(timer);}
  setPaused(value){if(value===this.paused)return;this.paused=value;for(const timer of this.timers){if(value){clearTimeout(timer.id);timer.remaining=Math.max(0,timer.remaining-(performance.now()-timer.started));timer.id=null;}else this.arm(timer);}}
}
