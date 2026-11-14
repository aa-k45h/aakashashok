// Navigation, input and the flat fallback pond. The 3D pond lives in pond.js and loads after first paint.

import { initExtras, sfx } from './extras.js';
import { initWeather } from './weather.js';

const root = document.documentElement;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('pond');
const padEls = [...document.querySelectorAll('.pad')];
const jumpEls = [...document.querySelectorAll('.jump a')];
const sections = ['intro', 'writing', 'about', 'contact'].map((id) => document.getElementById(id));
const duckEl = document.getElementById('duck');

const portrait = window.matchMedia('(orientation: portrait)');
let pond = null; // whichever pond is running: 3D or flat
let current = 0;
let busy = false;

// ---------- flat pond (no WebGL) ----------
// Same moves as the 3D one, done with a small SVG duck and CSS ripples.
function createFlatPond() {
  const pos = { x: window.innerWidth * 0.42, y: window.innerHeight * 0.78 };
  const target = { ...pos };
  let mode = 'idle', navDone = null, navT = 0, facing = 1, raf = 0;
  const center = (i) => {
    const r = padEls[i].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
  };
  function ripple(x, y) {
    if (calm) return;
    const el = document.createElement('span');
    el.className = 'flat-ripple';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
  let last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dx = target.x - pos.x, dy = target.y - pos.y;
    const dist = Math.hypot(dx, dy);
    const stop = mode === 'follow' ? 54 : 6;
    if (dist > stop) {
      const k = 1 - Math.exp(-dt * (mode === 'drag' ? 14 : 2.6));
      pos.x += dx * k; pos.y += dy * k;
      if (Math.abs(dx) > 4) facing = dx > 0 ? 1 : -1;
    }
    if (mode === 'nav') {
      if (dist < 14 || now - navT > 2400) {
        mode = 'idle';
        const done = navDone; navDone = null;
        ripple(pos.x, pos.y + 16);
        if (done) done();
      }
    }
    const bob = calm ? 0 : Math.sin(now / 420) * 2;
    duckEl.style.transform = `translate(${pos.x.toFixed(1)}px, ${(pos.y + bob).toFixed(1)}px) scaleX(${facing})`;
  }
  return {
    start() { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); },
    layout() {},
    setCurrent() {}, setHover() {}, setCompact() {},
    pointerMove(x, y) { if (mode !== 'nav' && mode !== 'drag') { target.x = x; target.y = y; mode = 'follow'; } },
    tap(x, y, callDuck) { ripple(x, y); if (callDuck && mode !== 'nav' && mode !== 'drag') { target.x = x; target.y = y; mode = 'idle'; } },
    goTo(i, done) {
      if (navDone) { const old = navDone; navDone = null; old(false); }
      const c = center(i);
      target.x = c.x; target.y = c.y - 8; mode = 'nav'; navT = performance.now(); navDone = done;
    },
    dragStart() { mode = 'drag'; },
    dragMove(x, y) { if (mode === 'drag') { target.x = x; target.y = y; } },
    dragEnd() {
      if (mode !== 'drag') return -1;
      mode = 'idle';
      ripple(target.x, target.y + 16);
      return padEls.findIndex((_, i) => { const c = center(i); return Math.hypot(c.x - target.x, c.y - target.y) < c.r * 1.2; });
    }
  };
}

// ---------- navigation ----------
function arrive(i, focus) {
  const sec = sections[i];
  if (focus) {
    const head = sec.querySelector('h1, h2');
    if (head) head.focus({ preventScroll: true });
  }
  sec.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  if (history.replaceState) history.replaceState(null, '', '#' + sec.id);
}

// The duck swims to the pad first. Then the page moves.
function go(i, focus) {
  if (i < 0 || i >= sections.length) return;
  // on a phone the pads are parked off screen once you scroll, so there is nowhere to swim
  const padsAway = root.classList.contains('compact') && portrait.matches;
  if (!pond || calm || padsAway) {
    if (pond && !padsAway) pond.goTo(i, null);
    arrive(i, focus);
    return;
  }
  busy = true;
  pond.goTo(i, (ok) => {
    busy = false;
    if (ok !== false) arrive(i, focus);
  });
}

padEls.forEach((el, i) => {
  el.addEventListener('click', (e) => go(i, e.detail === 0));
  const hover = (on) => () => pond && pond.setHover(i, on);
  el.addEventListener('pointerenter', hover(true));
  el.addEventListener('pointerleave', hover(false));
  el.addEventListener('focus', hover(true));
  el.addEventListener('blur', hover(false));
});
jumpEls.forEach((el, i) => {
  el.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(i, e.detail === 0);
  });
});
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key >= '1' && e.key <= '4') go(+e.key - 1, true);
});

function setCurrent(i) {
  current = i;
  padEls.forEach((el, n) => el.setAttribute('aria-current', n === i ? 'true' : 'false'));
  jumpEls.forEach((el, n) => el.setAttribute('aria-current', n === i ? 'true' : 'false'));
  if (pond) pond.setCurrent(i);
}
setCurrent(0);
if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setCurrent(sections.indexOf(en.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach((s) => seen.observe(s));
}

// Past the hero, the pads park at the edge so the writing has room.
function checkCompact() {
  const on = window.scrollY > window.innerHeight * 0.45;
  if (on === root.classList.contains('compact')) return;
  root.classList.toggle('compact', on);
  if (pond) pond.setCompact(on);
}
window.addEventListener('scroll', checkCompact, { passive: true });
checkCompact();

// ---------- Medium lines: bottles, boats and a bird ----------
// Without JS every line is simply shown. With JS they start folded away.
document.querySelectorAll('.floater').forEach((li) => {
  const btn = li.querySelector('button');
  const note = li.querySelector('.note');
  const set = (open) => {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    note.hidden = !open;
    li.classList.toggle('open', open);
    note.classList.toggle('unfold', open);
  };
  set(false);
  btn.addEventListener('click', () => set(note.hidden));
});

// ---------- input ----------
const onWater = (t) => !(t.closest && t.closest('a, button, .sheet, .note, .kick, .desk, .telly, .jar-wrap, #duck'));

window.addEventListener('pointermove', (e) => {
  if (pond && e.pointerType === 'mouse') pond.pointerMove(e.clientX, e.clientY);
}, { passive: true });

window.addEventListener('click', (e) => {
  if (!pond || !onWater(e.target)) return;
  const touch = e.pointerType ? e.pointerType !== 'mouse' : window.matchMedia('(hover: none)').matches;
  pond.tap(e.clientX, e.clientY, touch);
  sfx('ripple');
});

// Touch: drag the duck, drop it on a lily pad.
let dragId = null;
duckEl.addEventListener('pointerdown', (e) => {
  if (!pond || e.pointerType === 'mouse') return;
  dragId = e.pointerId;
  duckEl.setPointerCapture(dragId);
  pond.dragStart();
  pond.dragMove(e.clientX, e.clientY);
  e.preventDefault();
});
duckEl.addEventListener('pointermove', (e) => {
  if (e.pointerId === dragId) pond.dragMove(e.clientX, e.clientY);
});
const drop = (e) => {
  if (e.pointerId !== dragId) return;
  dragId = null;
  const hit = pond.dragEnd();
  if (hit >= 0) arrive(hit, false);
};
duckEl.addEventListener('pointerup', drop);
duckEl.addEventListener('pointercancel', drop);

let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => pond && pond.layout(), 80);
});
document.addEventListener('visibilitychange', () => {
  if (!pond) return;
  if (document.hidden) pond.stop(); else pond.start();
});

initExtras({ getPond: () => pond, calm });
const weather = initWeather({ getPond: () => pond, calm });

// ---------- boot ----------
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (err) {
    return false;
  }
}

function useFlat() {
  root.classList.remove('pond-on');
  root.classList.add('pond-flat');
  padEls.forEach((el) => el.setAttribute('style', el.dataset.spot));
  pond = createFlatPond();
  pond.start();
}

// keep the hand-set pad spots so the flat pond can restore them
padEls.forEach((el) => { el.dataset.spot = el.getAttribute('style'); });

function boot() {
  if (!hasWebGL()) { useFlat(); return; }
  import('./pond.js').then(({ createPond }) => {
    const p = createPond({ canvas, padEls, calm, onWake: () => sfx('paddle') });
    pond = p;
    pond.setCurrent(current);
    pond.setCompact(root.classList.contains('compact'));
    pond.setNight(+getComputedStyle(root).getPropertyValue('--night') || 0);
    // in 3D the DOM duck is only a grab handle that tracks the real one
    const track = () => {
      if (pond !== p) return;
      duckEl.style.transform = `translate(${p.duckScreen.x.toFixed(1)}px, ${p.duckScreen.y.toFixed(1)}px)`;
      requestAnimationFrame(track);
    };
    pond.start();
    track();
    root.classList.add('pond-on');
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); p.stop(); useFlat(); });
  }).catch((err) => {
    console.warn('3D pond did not load, using the flat one.', err);
    useFlat();
  });
}

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot, { once: true });
