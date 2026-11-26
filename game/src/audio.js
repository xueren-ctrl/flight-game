// Sky Courier — sound: everything is synthesised with WebAudio.
// No audio files, no network. Engine hum, wind, ring chimes, landing
// thuds and stall alarms are all oscillators and filtered noise.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let windSrc = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 55 * 1.01;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(lp);
      engineOsc2.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 500;
      bp.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(bp);
      bp.connect(windGain);
      windGain.connect(master);
      windSrc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.25, when = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    // Called every frame while flying: engine note follows throttle,
    // wind follows airspeed.
    update({ throttle, speed, maxSpeed }) {
      if (!ensure()) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.11, t, 0.1);
      if (engineOsc) engineOsc.frequency.setTargetAtTime(46 + throttle * 42 + speed * 0.4, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.22, (speed / maxSpeed) * 0.2), t, 0.15);
    },
    ring() {
      tone(880, 0.18, 'sine', 0.3);
      tone(1318, 0.28, 'sine', 0.22, 0.07);
    },
    waypoint() {
      tone(660, 0.15, 'triangle', 0.25);
      tone(990, 0.2, 'triangle', 0.2, 0.06);
    },
    land() {
      tone(180, 0.25, 'sine', 0.4);
      tone(90, 0.4, 'sine', 0.35, 0.05);
    },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.25, i * 0.11));
    },
    crash() {
      tone(70, 0.7, 'sawtooth', 0.4);
      tone(45, 0.9, 'sine', 0.4, 0.1);
    },
    alarm() {
      tone(980, 0.12, 'square', 0.12);
      tone(740, 0.12, 'square', 0.12, 0.14);
    },
    click() {
      tone(1200, 0.05, 'square', 0.08);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
  };
}
