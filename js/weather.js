// Night, fireflies and rain.
// Night follows the scroll. Fireflies and rain streaks are drawn on a canvas that sits over the whole page.
// Raindrops on the "glass" are small elements with a backdrop blur, so they really do blur what is behind them.

import { rainSound } from './extras.js';

export function initWeather({ getPond, calm }) {
  const root = document.documentElement;
  const air = document.getElementById('air');
  const glass = document.getElementById('glass');
  const rainBtn = document.getElementById('rain');
  const ctx = air.getContext('2d');
  const small = window.matchMedia('(max-width: 760px)').matches;

  let W = 1, H = 1, night = 0, rainOn = false, rainAmt = 0, raf = 0, last = 0, lastScroll = window.scrollY;

  function size() {
    W = air.width = window.innerWidth;
    H = air.height = window.innerHeight;
  }
  size();
  window.addEventListener('resize', size);

  // ---------- night ----------
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function readNight() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    // day until the Writing section, a long twilight, full night by Contact
    const n = smooth(0.2, 0.9, window.scrollY / max);
    if (Math.abs(n - night) < 0.004 && n !== 0 && n !== 1) return;
    night = n;
    root.style.setProperty('--night', n.toFixed(3));
    root.classList.toggle('night', n > 0.5);
    const pond = getPond();
    if (pond && pond.setNight) pond.setNight(n);
    kick();
  }
  window.addEventListener('scroll', readNight, { passive: true });

  // ---------- fireflies ----------
  // z is depth: 0 is far and small, 1 is close to the glass, big and out of focus.
  const flies = Array.from({ length: calm ? 5 : small ? 9 : 16 }, (_, i) => ({
    x: Math.random(), y: Math.random(), z: Math.pow(Math.random(), 1.6),
    a: Math.random() * 6.28, turn: 0, sp: 0.012 + Math.random() * 0.02,
    ph: Math.random() * 6.28, rate: 0.7 + Math.random() * 1.3, seed: i * 7.3
  }));

  function drawFlies(dt, t) {
    const scrolled = window.scrollY - lastScroll;
    for (const f of flies) {
      // wander: the heading drifts, never a straight line
      f.turn += (Math.random() - 0.5) * 2.4 * dt;
      f.turn *= 0.97;
      f.a += f.turn * dt * 3 + Math.sin(t * 0.4 + f.seed) * dt * 0.5;
      const v = f.sp * (calm ? 0.4 : 1) * (0.6 + f.z);
      f.x += Math.cos(f.a) * v * dt * (H / W);
      f.y += Math.sin(f.a) * v * dt + Math.sin(t * 1.3 + f.seed) * 0.0006;
      // nearer ones slide past faster when the page scrolls
      f.y -= (scrolled / H) * (0.15 + f.z * 0.55);
      if (f.x < -0.08) f.x += 1.16; if (f.x > 1.08) f.x -= 1.16;
      if (f.y < -0.1) f.y += 1.2; if (f.y > 1.1) f.y -= 1.2;
    }
    // shadows first, falling on the page below each one
    ctx.globalCompositeOperation = 'source-over';
    for (const f of flies) {
      const px = f.x * W, py = f.y * H;
      const lift = 16 + f.z * 46;
      const r = 7 + f.z * 20;
      const g = ctx.createRadialGradient(px + lift * 0.45, py + lift, 0, px + lift * 0.45, py + lift, r);
      g.addColorStop(0, `rgba(2, 14, 24, ${(0.2 * night * (1 - f.z * 0.5)).toFixed(3)})`);
      g.addColorStop(1, 'rgba(2, 14, 24, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px + lift * 0.45 - r, py + lift - r, r * 2, r * 2);
    }
    // then the lights
    ctx.globalCompositeOperation = 'lighter';
    for (const f of flies) {
      const px = f.x * W, py = f.y * H;
      const blink = Math.pow(0.5 + 0.5 * Math.sin(t * f.rate + f.ph), 2.2);
      const focus = 1 - Math.abs(f.z - 0.35) * 1.3;        // sharpest a little way back
      const blur = Math.max(0, 1 - focus);
      const core = 1.6 + f.z * 3.2;
      const halo = core * (5 + blur * 9);
      const alpha = night * (0.25 + blink * 0.75) * (1 - blur * 0.45);
      const g = ctx.createRadialGradient(px, py, 0, px, py, halo);
      g.addColorStop(0, `rgba(248, 255, 190, ${alpha.toFixed(3)})`);
      g.addColorStop(Math.min(0.5, 0.12 + blur * 0.3), `rgba(214, 250, 120, ${(alpha * 0.55).toFixed(3)})`);
      g.addColorStop(1, 'rgba(180, 240, 90, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - halo, py - halo, halo * 2, halo * 2);
    }
  }

  // ---------- rain streaks ----------
  const streaks = Array.from({ length: calm ? 0 : small ? 60 : 130 }, () => ({
    x: Math.random(), y: Math.random(), z: Math.random(), l: 0.5 + Math.random() * 0.5
  }));
  function drawRain(dt) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    const slant = 0.16;
    for (const s of streaks) {
      const speed = 0.9 + s.z * 1.5;
      s.y += speed * dt;
      s.x -= speed * dt * slant * (H / W);
      if (s.y > 1.1) { s.y = -0.1; s.x = Math.random() * 1.2; }
      const len = (20 + s.z * 60) * s.l;
      const px = s.x * W, py = s.y * H;
      ctx.strokeStyle = `rgba(${night > 0.5 ? '190, 215, 240' : '236, 248, 255'}, ${(rainAmt * (0.1 + s.z * 0.3)).toFixed(3)})`;
      ctx.lineWidth = 0.8 + s.z * 1.1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + len * slant, py - len);
      ctx.stroke();
    }
  }

  // ---------- drops on the glass ----------
  // Most are fine spray. A few are fat enough to blur what is behind them, and the fattest run down.
  let dropT = 0, big = 0, beads = 0;
  const MAX_BIG = calm ? 5 : small ? 9 : 18;
  const MAX_BEADS = calm ? 10 : small ? 30 : 70;
  const rnd = (a, b) => a + Math.random() * (b - a);
  // no two drops are the same shape, and none is a clean oval
  const lumpy = () => `${rnd(36, 64).toFixed(0)}% ${rnd(36, 64).toFixed(0)}% ${rnd(40, 60).toFixed(0)}% ${rnd(40, 60).toFixed(0)}% / ${rnd(44, 66).toFixed(0)}% ${rnd(44, 66).toFixed(0)}% ${rnd(34, 56).toFixed(0)}% ${rnd(34, 56).toFixed(0)}%`;

  function bead(x, y, w, life) {
    if (beads >= MAX_BEADS) return;
    const el = document.createElement('span');
    el.className = 'drop bead';
    el.style.cssText = `left:${x};top:${y};width:${w.toFixed(1)}px;height:${(w * rnd(1, 1.25)).toFixed(1)}px;border-radius:${lumpy()}`;
    glass.appendChild(el);
    beads++;
    el.animate([{ opacity: 0, transform: 'scale(0.4)' }, { opacity: 1, transform: 'scale(1)', offset: 0.06 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
      { duration: life, fill: 'forwards' }).onfinish = () => { el.remove(); beads--; };
  }

  function addDrop() {
    // spray lands all the time
    for (let i = 0; i < (small ? 1 : 2); i++) bead(rnd(0, 100).toFixed(1) + '%', rnd(0, 96).toFixed(1) + '%', rnd(2, 6.5), rnd(2500, 8000));
    if (big >= MAX_BIG || Math.random() < 0.45) return;
    const el = document.createElement('span');
    el.className = 'drop';
    const w = 11 + Math.pow(Math.random(), 1.7) * 36;
    const h = w * rnd(1.02, 1.38);
    const x = rnd(0, 100), y = rnd(0, 90);
    el.style.cssText = `left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px;border-radius:${lumpy()};rotate:${rnd(-14, 14).toFixed(0)}deg`;
    glass.appendChild(el);
    big++;
    // a smaller drop fused to its side, as two drops that touched
    if (w > 22 && Math.random() < 0.4) {
      const kid = document.createElement('span');
      kid.className = 'drop';
      const kw = w * rnd(0.35, 0.55);
      kid.style.cssText = `left:${rnd(55, 80).toFixed(0)}%;top:${rnd(45, 75).toFixed(0)}%;width:${kw.toFixed(0)}px;height:${(kw * 1.15).toFixed(0)}px;border-radius:${lumpy()}`;
      el.appendChild(kid);
    }
    const done = () => { el.remove(); big--; };
    const runs = !calm && w > 21 && Math.random() < 0.6;
    const sit = rnd(1200, 5200);
    el.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'ease-out' });
    if (!runs) {
      el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.7)' }], { duration: 1400, delay: sit, fill: 'forwards' }).onfinish = done;
      return;
    }
    // a heavy drop gives way: it hesitates, runs, stalls, runs again, and leaves a wet track with beads in it
    const fall = rnd(28, 70) * (H / 100);
    const wob = rnd(-16, 16);
    const dur = rnd(1300, 2600);
    const trail = document.createElement('span');
    trail.className = 'drop trail';
    trail.style.left = `calc(${x.toFixed(1)}% + ${(w / 2 - 3).toFixed(0)}px)`;
    trail.style.top = `calc(${y.toFixed(1)}% + ${(h / 2).toFixed(0)}px)`;
    trail.style.height = '0px';
    glass.appendChild(trail);
    trail.animate([{ height: '0px', opacity: 0.9 }, { height: (fall * 0.3).toFixed(0) + 'px', opacity: 0.9, offset: 0.3 }, { height: (fall * 0.36).toFixed(0) + 'px', opacity: 0.9, offset: 0.42 }, { height: fall.toFixed(0) + 'px', opacity: 0.85, offset: 0.7 }, { height: fall.toFixed(0) + 'px', opacity: 0 }],
      { duration: dur * 1.5, delay: sit, fill: 'forwards' }).onfinish = () => trail.remove();
    setTimeout(() => {
      for (let i = 1; i <= 3; i++) bead(`calc(${x.toFixed(1)}% + ${(w / 2 - 2 + rnd(-2, 2)).toFixed(0)}px)`, `calc(${y.toFixed(1)}% + ${(h / 2 + fall * i * 0.24).toFixed(0)}px)`, rnd(2.5, 5), rnd(1800, 4000));
    }, sit + dur * 0.6);
    el.animate([
      { transform: 'translate(0, 0) scale(1)' },
      { transform: `translate(${(wob * 0.3).toFixed(0)}px, ${(fall * 0.3).toFixed(0)}px) scale(0.96, 1.12)`, offset: 0.3 },
      { transform: `translate(${(wob * 0.35).toFixed(0)}px, ${(fall * 0.36).toFixed(0)}px) scale(1.02, 1)`, offset: 0.42 },
      { transform: `translate(${wob.toFixed(0)}px, ${fall.toFixed(0)}px) scale(0.82, 1.25)`, opacity: 1, offset: 0.93 },
      { transform: `translate(${wob.toFixed(0)}px, ${(fall + 12).toFixed(0)}px) scale(0.5)`, opacity: 0 }
    ], { duration: dur, delay: sit, fill: 'forwards' }).onfinish = done;
  }

  // ---------- loop: only runs while there is something in the air ----------
  function frame(now) {
    raf = 0;
    const real = Math.min(1, (now - last) / 1000);
    const dt = Math.min(0.05, real);
    last = now;
    const t = now / 1000;
    rainAmt += ((rainOn ? 1 : 0) - rainAmt) * Math.min(1, dt * 1.6);
    ctx.clearRect(0, 0, W, H);
    if (night > 0.02) drawFlies(dt, t);
    if (rainAmt > 0.01) {
      drawRain(dt);
      dropT -= real;
      // catch up if frames are slow, so the rain is as heavy on a weak phone as on a fast laptop
      for (let i = 0; rainOn && dropT <= 0 && i < 10; i++) { dropT += 0.07 + Math.random() * 0.16; addDrop(); }
    }
    lastScroll = window.scrollY;
    if (!document.hidden && (night > 0.02 || rainAmt > 0.01 || rainOn)) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  function kick() { if (!raf && !document.hidden) { last = performance.now(); lastScroll = window.scrollY; raf = requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  // ---------- rain switch ----------
  let showerT = 0;
  function setRain(on) {
    rainOn = on;
    clearTimeout(showerT);
    rainBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const pond = getPond();
    if (pond && pond.setRain) pond.setRain(on);
    rainSound('weather', on);
    kick();
  }
  rainBtn.addEventListener('click', () => setRain(!rainOn));
  // One short shower the first time the Mazhaiyil line scrolls into view. Mazhaiyil means "in the rain".
  const writing = document.getElementById('writing');
  if (!calm && writing && 'IntersectionObserver' in window) {
    const once = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      once.disconnect();
      if (rainOn) return;
      setRain(true);
      showerT = setTimeout(() => setRain(false), 22000);
    }, { rootMargin: '-40% 0px -40% 0px' });
    once.observe(writing);
  }

  readNight();
  return { setRain, refresh: readNight };
}
