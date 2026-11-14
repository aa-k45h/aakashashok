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
    const n = smooth(0.4, 0.66, window.scrollY / max);
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
  let dropT = 0, drops = 0;
  const MAX_DROPS = calm ? 6 : small ? 10 : 20;
  function addDrop() {
    if (drops >= MAX_DROPS) return;
    const el = document.createElement('span');
    el.className = 'drop';
    const w = 9 + Math.pow(Math.random(), 2) * 34;
    el.style.width = w.toFixed(0) + 'px';
    el.style.height = (w * (1.1 + Math.random() * 0.25)).toFixed(0) + 'px';
    const x = Math.random() * 100, y = Math.random() * 92;
    el.style.left = x.toFixed(1) + '%';
    el.style.top = y.toFixed(1) + '%';
    glass.appendChild(el);
    drops++;
    const done = () => { el.remove(); drops--; };
    const runs = !calm && w > 20 && Math.random() < 0.55;
    const sit = 1500 + Math.random() * 4500;
    el.animate([{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'ease-out' });
    if (!runs) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, delay: sit, fill: 'forwards' }).onfinish = done;
      return;
    }
    // a heavy drop gives way and runs down, wobbling, leaving a wet trail
    const fall = (30 + Math.random() * 45) * (H / 100);
    const wob = (Math.random() - 0.5) * 22;
    const dur = 1100 + Math.random() * 1300;
    const trail = document.createElement('span');
    trail.className = 'drop trail';
    trail.style.left = `calc(${x.toFixed(1)}% + ${(w / 2 - 2.5).toFixed(0)}px)`;
    trail.style.top = `calc(${y.toFixed(1)}% + ${(w / 2).toFixed(0)}px)`;
    trail.style.height = '0px';
    glass.appendChild(trail);
    trail.animate([{ height: '0px', opacity: 0.9 }, { height: fall.toFixed(0) + 'px', opacity: 0.9, offset: 0.7 }, { height: fall.toFixed(0) + 'px', opacity: 0 }],
      { duration: dur * 1.45, delay: sit, easing: 'ease-in', fill: 'forwards' }).onfinish = () => trail.remove();
    el.animate([
      { transform: 'translate(0, 0)' },
      { transform: `translate(${(wob * 0.4).toFixed(0)}px, ${(fall * 0.25).toFixed(0)}px) scale(0.98, 1.08)`, offset: 0.4 },
      { transform: `translate(${wob.toFixed(0)}px, ${fall.toFixed(0)}px) scale(0.85, 1.2)`, opacity: 1, offset: 0.92 },
      { transform: `translate(${wob.toFixed(0)}px, ${(fall + 10).toFixed(0)}px) scale(0.6)`, opacity: 0 }
    ], { duration: dur, delay: sit, easing: 'cubic-bezier(0.5, 0, 0.9, 0.6)', fill: 'forwards' }).onfinish = done;
  }

  // ---------- loop: only runs while there is something in the air ----------
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    rainAmt += ((rainOn ? 1 : 0) - rainAmt) * Math.min(1, dt * 1.6);
    ctx.clearRect(0, 0, W, H);
    if (night > 0.02) drawFlies(dt, t);
    if (rainAmt > 0.01) {
      drawRain(dt);
      dropT -= dt;
      if (rainOn && dropT <= 0) { dropT = 0.18 + Math.random() * 0.4; addDrop(); }
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
