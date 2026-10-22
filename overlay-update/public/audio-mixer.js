export function envelope(volume, elapsed, remaining, fadeIn, fadeOut) {
  return volume / 100 * Math.max(0, Math.min(1, fadeIn > 0 ? elapsed / fadeIn : 1, fadeOut > 0 ? remaining / fadeOut : 1));
}

export class AudioMixer {
  constructor(onBlocked, onError) {
    this.onBlocked = onBlocked; this.onError = onError; this.entries = new Map();
    this.interval = setInterval(() => this.tick(), 50);
  }
  context() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createDynamicsCompressor();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
  reset() {
    for (const entry of this.entries.values()) {
      entry.audio.pause(); entry.audio.removeAttribute('src'); entry.audio.load();
      entry.nodes.forEach(node => node.disconnect());
    }
    this.entries.clear(); this.scene = null;
  }
  enter(tracks, sceneIndex, sceneCount, duration, video) {
    this.scene = { index: sceneIndex, count: sceneCount, duration, video, started: this.paused ? this.pauseStarted : performance.now() };
    const active = tracks.filter(t => sceneIndex + 1 >= t.first_scene && sceneIndex + 1 <= (t.last_scene ?? sceneCount));
    const wanted = new Set(active.map(t => t.id));
    for (const [id, entry] of this.entries) if (!wanted.has(id)) {
      entry.audio.pause(); entry.audio.removeAttribute('src'); entry.audio.load();
      entry.nodes.forEach(node => node.disconnect()); this.entries.delete(id);
    }
    for (const track of active) if (!this.entries.has(track.id)) {
      const ctx = this.context(), audio = new Audio(track.url);
      audio.loop = !!track.loop;
      const source = ctx.createMediaElementSource(audio), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      filter.type = 'allpass';
      if (track.effect === 'bass') { filter.type = 'lowshelf'; filter.frequency.value = 180; filter.gain.value = 6; }
      if (track.effect === 'voice') { filter.type = 'peaking'; filter.frequency.value = 2200; filter.Q.value = 0.8; filter.gain.value = 4; }
      if (track.effect === 'telephone') { filter.type = 'bandpass'; filter.frequency.value = 1400; filter.Q.value = 0.7; }
      source.connect(filter).connect(gain).connect(this.master); gain.gain.value = 0;
      const entry = { track, audio, gain, nodes: [source, filter, gain] };
      this.entries.set(track.id, entry);
      audio.onerror = () => { if (this.entries.get(track.id) === entry) this.onError('Cannot play audio track: ' + track.name); };
      if (ctx.state !== 'running') this.onBlocked();
      if(!this.paused)audio.play().catch(e => { if (this.entries.get(track.id) !== entry) return; if (e.name === 'NotAllowedError') this.onBlocked(); else if (e.name !== 'AbortError') this.onError('Cannot play audio track: ' + track.name); });
    }
    if (this.entries.size && this.ctx?.state !== 'running') this.onBlocked();
    this.tick();
  }
  setPaused(value) {
    if(!!this.paused===value)return;
    if(value){this.paused=true;this.pauseStarted=performance.now();this.pauseContextTime=this.ctx?.currentTime??0;for(const entry of this.entries.values())entry.audio.pause();}
    else{if(this.scene)this.scene.started+=performance.now()-this.pauseStarted;for(const entry of this.entries.values()){if(entry.startedAt!==undefined)entry.startedAt+=(this.ctx?.currentTime??0)-this.pauseContextTime;}this.paused=false;this.enable().catch(()=>this.onBlocked());}
  }
  tick() {
    if (this.paused || !this.scene || !this.ctx) return;
    const scene = this.scene;
    const position = scene.video ? scene.video.currentTime : (performance.now() - scene.started) / 1000;
    const duration = scene.video && Number.isFinite(scene.video.duration) ? scene.video.duration : scene.duration;
    for (const { track, audio, gain } of this.entries.values()) {
      // Fade-out is bounded to the final scene, including full-length video scenes.
      const remaining = scene.index + 1 >= Math.min(track.last_scene ?? scene.count, scene.count) ? Math.max(0, duration - position) : Infinity;
      const elapsed = audio.loop ? (this.ctx.currentTime - (this.entries.get(track.id).startedAt ?? this.ctx.currentTime)) : audio.currentTime;
      const entry = this.entries.get(track.id);
      if (entry.startedAt === undefined && !audio.paused && this.ctx.state === 'running') entry.startedAt = this.ctx.currentTime;
      const level = envelope(track.volume, elapsed, remaining, track.fade_in, Math.min(track.fade_out, duration));
      gain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.025);
    }
  }
  async enable() {
    if(this.paused)return;
    if (this.ctx) await this.ctx.resume();
    await Promise.all([...this.entries.values()].filter(e => !e.audio.ended).map(e => e.audio.play()));
  }
}
