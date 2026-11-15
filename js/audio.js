// All sound is synthesized here with the Web Audio API. There are no audio files.
// Above water it is clear. Below, a filter closes over everything.
// Loaded only after the visitor turns sound on.

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function createAudio({ calm }) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const LEVEL = calm ? 0.14 : 0.26;

  const master = ctx.createGain();
  master.gain.value = 0;
  // everything passes through this filter, which closes when you go under
  const under = ctx.createBiquadFilter();
  under.type = 'lowpass';
  under.frequency.value = 18000;
  under.Q.value = 0.6;
  master.connect(under);
  under.connect(ctx.destination);

  // a soft echo that everything dreamy is sent through
  const echo = ctx.createDelay(1.5);
  echo.delayTime.value = 0.43;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.36;
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2100;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  echo.connect(damp); damp.connect(feedback); feedback.connect(echo);
  damp.connect(wet); wet.connect(master);

  const music = ctx.createGain();
  music.gain.value = calm ? 0.55 : 0.8;
  music.connect(master); music.connect(echo);
  const fx = ctx.createGain();
  fx.gain.value = 1;
  fx.connect(master);

  // two seconds of white noise, reused for water, rain and rumble
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  {
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function tone(freq, { type = 'sine', attack = 0.01, decay = 0.5, gain = 0.2, to = fx, at = 0, slide = 0 } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + attack + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g); g.connect(to);
    o.start(t); o.stop(t + attack + decay + 0.05);
  }

  function hiss({ dur = 0.3, gain = 0.2, type = 'bandpass', from = 900, toF = 0, q = 1, attack = 0.01, to = fx, at = 0 } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    if (toF) f.frequency.exponentialRampToValueAtTime(toF, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(to);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  // ---------- music: slow chords and the odd chime ----------
  const chords = [[50, 57, 66, 73], [47, 54, 62, 69], [43, 50, 59, 66], [45, 52, 61, 66]];
  const bells = [74, 76, 78, 81, 83, 86];
  let chordI = 0, musicTimer = 0, bellTimer = 0, playing = false;

  function pad(note, len) {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + len * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + len * 1.25);
    g.connect(music);
    [0, 4].forEach((cents, i) => {
      const o = ctx.createOscillator();
      o.type = i ? 'triangle' : 'sine';
      o.frequency.value = midi(note);
      o.detune.value = cents;
      const v = ctx.createGain();
      v.gain.value = i ? 0.35 : 1;
      o.connect(v); v.connect(g);
      o.start(t); o.stop(t + len * 1.3);
    });
  }
  function nextChord() {
    if (!playing) return;
    const len = 9;
    chords[chordI % chords.length].forEach((n) => pad(n, len));
    chordI++;
    musicTimer = setTimeout(nextChord, len * 1000);
  }
  function nextBell() {
    if (!playing) return;
    const n = bells[Math.floor(Math.random() * bells.length)];
    tone(midi(n), { attack: 0.02, decay: 3.2, gain: 0.045, to: music });
    if (Math.random() < 0.35) tone(midi(n + 7), { attack: 0.02, decay: 2.6, gain: 0.025, to: music, at: 0.5 });
    bellTimer = setTimeout(nextBell, 2800 + Math.random() * 4200);
  }
  function startMusic() {
    if (playing) return;
    playing = true;
    nextChord();
    bellTimer = setTimeout(nextBell, 1500);
  }
  function stopMusic() {
    playing = false;
    clearTimeout(musicTimer); clearTimeout(bellTimer);
  }

  // ---------- rain on the desk window ----------
  let rainGain = null;
  function rain(on) {
    if (!rainGain) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
      rainGain = ctx.createGain(); rainGain.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(rainGain); rainGain.connect(fx);
      src.start();
    }
    const t = ctx.currentTime;
    rainGain.gain.cancelScheduledValues(t);
    rainGain.gain.setTargetAtTime(on ? 0.11 : 0, t, on ? 0.35 : 0.5);
  }

  const sounds = {
    // click on the water
    ripple() {
      tone(520 + Math.random() * 120, { decay: 0.22, gain: 0.1, slide: 0.55 });
      hiss({ dur: 0.25, gain: 0.05, from: 1400, toF: 500, q: 0.8 });
    },
    // the duck paddling
    paddle() {
      hiss({ dur: 0.3, gain: 0.035, from: 1100 + Math.random() * 500, toF: 420, q: 0.7, attack: 0.04 });
    },
    splash() {
      hiss({ dur: 0.45, gain: 0.13, from: 1800, toF: 380, q: 0.6 });
      tone(380, { decay: 0.3, gain: 0.1, slide: 0.4 });
    },
    // the ball dropping back into the pond
    plop() {
      tone(240, { decay: 0.28, gain: 0.2, slide: 0.35 });
      tone(700, { decay: 0.12, gain: 0.06, slide: 1.8, at: 0.09 });
      hiss({ dur: 0.4, gain: 0.07, from: 900, toF: 300, q: 0.7, at: 0.03 });
    },
    // goal: a warm shimmering swell with sparkles on top
    sun() {
      [62, 66, 69, 74, 78, 81].forEach((n, i) => {
        const t = ctx.currentTime + i * 0.07;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(n);
        const trem = ctx.createOscillator(); trem.frequency.value = 5 + i;
        const depth = ctx.createGain(); depth.gain.value = 0.02;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.7);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3);
        trem.connect(depth); depth.connect(g.gain);
        o.connect(g); g.connect(fx); g.connect(echo);
        o.start(t); trem.start(t); o.stop(t + 3.1); trem.stop(t + 3.1);
      });
      for (let i = 0; i < 9; i++) {
        tone(midi(86 + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)]), { attack: 0.005, decay: 0.5, gain: 0.03, at: 0.25 + Math.random() * 1.8, to: echo });
      }
    },
    // save: a low, soft rumble that fades back to calm
    rumble() {
      hiss({ dur: 1.9, gain: 0.5, type: 'lowpass', from: 130, toF: 70, q: 0.7, attack: 0.35 });
      tone(52, { attack: 0.3, decay: 1.5, gain: 0.16, slide: 0.8 });
    },
    // going through the surface
    dive() {
      hiss({ dur: 1.3, gain: 0.34, from: 2600, toF: 260, q: 0.5, attack: 0.02 });
      tone(130, { decay: 0.9, gain: 0.26, slide: 0.35 });
      for (let i = 0; i < 12; i++) tone(500 + Math.random() * 900, { attack: 0.01, decay: 0.12, gain: 0.05, slide: 1.6, at: 0.25 + Math.random() * 1.4 });
    },
    bubble() {
      tone(420 + Math.random() * 500, { attack: 0.01, decay: 0.1, gain: 0.05, slide: 1.7 });
    },
    // the ball coming off the seal
    thud() {
      tone(110, { decay: 0.2, gain: 0.22, slide: 0.5 });
      hiss({ dur: 0.12, gain: 0.06, from: 500, q: 1 });
    },
    // remote button
    click() {
      tone(1900, { type: 'square', decay: 0.03, gain: 0.04 });
      hiss({ dur: 0.04, gain: 0.05, type: 'highpass', from: 3000 });
    },
    // prompt jar
    clink() {
      [2093, 3136, 4435].forEach((f, i) => tone(f * (1 + Math.random() * 0.01), { attack: 0.003, decay: 0.6 - i * 0.12, gain: 0.06 - i * 0.015 }));
    },
    paper() {
      hiss({ dur: 0.22, gain: 0.05, type: 'highpass', from: 2500, attack: 0.05 });
    },
    knock() {
      [0, 0.32, 0.64].forEach((at) => {
        tone(150, { decay: 0.11, gain: 0.22, slide: 0.6, at });
        hiss({ dur: 0.06, gain: 0.06, from: 700, q: 1.5, at });
      });
    },
    toot() {
      tone(midi(58), { type: 'triangle', attack: 0.04, decay: 0.5, gain: 0.1 });
      tone(midi(65), { type: 'triangle', attack: 0.04, decay: 0.7, gain: 0.1, at: 0.22 });
    }
  };

  let on = false, hidden = false, sleepT = 0;
  return {
    play(name) { if (on && !hidden && sounds[name]) sounds[name](); },
    rain(v) { if (on || !v) rain(v && on); },
    setOn(v) {
      on = v;
      clearTimeout(sleepT);
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      if (v) {
        ctx.resume();
        master.gain.setTargetAtTime(LEVEL, t, 0.5);
        startMusic();
      } else {
        master.gain.setTargetAtTime(0, t, 0.25);
        stopMusic();
        if (rainGain) rain(false);
        sleepT = setTimeout(() => ctx.suspend(), 1400);
      }
    },
    // muffle everything once we are below the surface
    setUnder(v) {
      under.frequency.setTargetAtTime(v ? 1500 : 18000, ctx.currentTime, 0.35);
    },
    // pause while the tab is hidden
    setHidden(v) {
      hidden = v;
      if (v) { stopMusic(); ctx.suspend(); }
      else if (on) { ctx.resume(); startMusic(); }
    }
  };
}
