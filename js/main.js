// Navigation, the dive, the TV, sound. The sea itself lives in sea.js and loads after first paint.
import { MAIN, WILD } from './lines.js';
import { initKick } from './kick.js';

const root = document.documentElement;
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (q) => document.querySelector(q);
const canvas = $('#sea');
const navEls = [...document.querySelectorAll('.gauge a')];
const sections = ['intro', 'writing', 'about', 'contact'].map((id) => document.getElementById(id));
const depthEl = $('.depth'), depthText = $('.depth b');
const flashEl = $('#flash');
const tvEl = $('#tv'), remoteEl = $('#remote');

let sea = null;

// ---------- sound ----------
let audio = null, soundOn = false, lastBub = 0;
function sfx(name) {
  if (!audio || !soundOn) return;
  if (name === 'bubble') {
    const now = performance.now();
    if (now - lastBub < 180) return;
    lastBub = now;
  }
  audio.play(name);
}
const soundBtn = $('#sound');
async function setSound(on) {
  soundOn = on;
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  try { localStorage.setItem('pond-sound', on ? 'on' : 'off'); } catch (err) { /* private mode, fine */ }
  if (on && !audio) {
    try {
      const mod = await import('./audio.js');
      audio = mod.createAudio({ calm });
    } catch (err) {
      audio = null;
    }
  }
  if (audio) {
    audio.setOn(soundOn);
    audio.setUnder(!root.classList.contains('surface'));
  }
}
soundBtn.addEventListener('click', () => setSound(!soundOn));
// If sound was on last visit, it comes back with the first click anywhere. Never before a click.
// With reduced motion it always starts muted.
let remembered = false;
try { remembered = localStorage.getItem('pond-sound') === 'on'; } catch (err) { remembered = false; }
if (remembered && !calm) {
  const wake = (e) => {
    window.removeEventListener('click', wake, true);
    if (!soundOn && !(e.target.closest && e.target.closest('#sound'))) setSound(true);
  };
  window.addEventListener('click', wake, true);
}

function flash(kind) {
  flashEl.className = '';
  void flashEl.offsetWidth;
  flashEl.className = kind;
}

// ---------- depth: where the camera sits for each scroll position ----------
// Anchored to the page, so the TV is in view in the open water and the wreck is behind the right plates.
let stops = [];
function measureStops() {
  const vh = window.innerHeight;
  const mid = (el, f = 0.5) => el.offsetTop + el.offsetHeight * f - vh / 2;
  const max = Math.max(1, document.documentElement.scrollHeight - vh);
  const water = $('.open-water'), [, writing, about, contact] = sections;
  stops = [
    [0, 3],
    [mid(water, 0.48), 13],
    [writing.offsetTop - vh * 0.1, 18],
    [writing.offsetTop + writing.offsetHeight - vh * 1.1, 26],
    [mid(about, 0.35), 32],
    [contact.offsetTop - vh * 0.15, 40],
    [max, 41.6]
  ].sort((a, b) => a[0] - b[0]);
}
function depthAt(y) {
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (y <= stops[i][0]) {
      const [a, da] = stops[i - 1], [b, db] = stops[i];
      const f = b > a ? (y - a) / (b - a) : 1;
      return da + (db - da) * f;
    }
  }
  return stops[stops.length - 1][1];
}
function onScroll() {
  if (root.classList.contains('surface')) return;
  const dpt = depthAt(window.scrollY);
  if (sea) sea.setDepth(dpt);
  else showDepth(dpt);
}
function showDepth(m) {
  const under = !root.classList.contains('surface');
  const shown = under ? Math.max(0, m) : 0;
  depthText.textContent = Math.round(shown) + ' m';
  depthEl.style.setProperty('--at', Math.min(1, shown / 41.6).toFixed(3));
  // the interface turns pale once the water behind it is dark
  root.classList.toggle('deep', under && shown > 15);
}
window.addEventListener('scroll', onScroll, { passive: true });

// ---------- the dive ----------
let diving = false;
function goUnder(then) {
  root.classList.remove('surface');
  root.classList.add('under');
  if (audio) audio.setUnder(true);
  measureStops();
  onScroll();
  if (then) then();
}
function dive(then) {
  if (!root.classList.contains('surface')) { if (then) then(); return; }
  if (diving) return;
  diving = true;
  root.classList.add('diving');
  if (!sea) {
    flash('splash');
    goUnder(then);
    return;
  }
  sea.dive(() => goUnder(then));
}
$('#dive').addEventListener('click', () => dive(() => {
  // drift down a little, so the first thing you see is open water
  window.scrollTo({ top: window.innerHeight * 0.55, behavior: calm ? 'auto' : 'smooth' });
}));

// ---------- navigation ----------
function arrive(i, focus) {
  const sec = sections[i];
  if (focus) {
    const head = sec.querySelector('h1, h2');
    if (head) head.focus({ preventScroll: true });
  }
  if (i === 0) window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  else sec.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  if (history.replaceState) history.replaceState(null, '', '#' + sec.id);
}
function go(i, focus) {
  if (i < 0 || i >= sections.length) return;
  if (root.classList.contains('surface')) {
    if (i === 0) return;
    dive(() => arrive(i, focus));
    return;
  }
  if (sea) sea.burst();
  arrive(i, focus);
}
navEls.forEach((el, i) => {
  el.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    go(i, e.detail === 0);
  });
});
let keys = '';
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (e.key >= '1' && e.key <= '4') go(+e.key - 1, true);
  // type 99
  if (e.key.length === 1) {
    keys = (keys + e.key).slice(-2);
    if (keys === '99') { keys = ''; showTv('Brooklyn Nine-Nine', 'Nine-Nine!'); if (sea) sea.burst(); }
  }
});
function setCurrent(i) {
  navEls.forEach((el, n) => el.setAttribute('aria-current', n === i ? 'true' : 'false'));
}
setCurrent(0);
if ('IntersectionObserver' in window) {
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setCurrent(sections.indexOf(en.target)); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach((s) => seen.observe(s));
}

// ---------- the TV and its remote ----------
let lastLine = '', tvIdle = 0;
function showTv(show, line) {
  tvEl.querySelector('.tv-show').textContent = show;
  tvEl.querySelector('.tv-line').textContent = line;
  tvEl.classList.add('lit');
  tvEl.classList.remove('blink');
  void tvEl.offsetWidth;
  tvEl.classList.add('blink');
  if (sea) sea.setTv(true);
  clearTimeout(tvIdle);
  // an old set left on under water does not stay on for long
  tvIdle = setTimeout(() => { tvEl.classList.remove('lit'); if (sea) sea.setTv(false); }, 14000);
}
remoteEl.addEventListener('click', () => {
  let show, line;
  do {
    const pool = Math.random() < 0.8 ? MAIN : WILD;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    show = pick[0];
    line = pick[1][Math.floor(Math.random() * pick[1].length)];
  } while (line === lastLine);
  lastLine = line;
  showTv(show, line);
  sfx('click');
});

// ---------- Medium lines, in bottles ----------
// Without JS every line is simply shown. With JS they start rolled up.
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
  btn.addEventListener('click', () => { set(note.hidden); sfx('paper'); });
});

initKick({ calm, sfx, flash });

// ---------- input ----------
const onWater = (t) => !(t.closest && t.closest('a, button, .plate, .note, .kick-wrap'));
window.addEventListener('pointermove', (e) => {
  if (sea && e.pointerType === 'mouse') sea.pointerMove(e.clientX, e.clientY);
}, { passive: true });
window.addEventListener('click', (e) => {
  if (!sea || !onWater(e.target)) return;
  sea.tap(e.clientX, e.clientY);
  sfx('bubble');
});
let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => { if (sea) sea.layout(); measureStops(); onScroll(); }, 80);
});
document.addEventListener('visibilitychange', () => {
  if (audio) audio.setHidden(document.hidden);
  if (!sea) return;
  if (document.hidden) sea.stop(); else sea.start();
});

// ---------- boot ----------
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (err) {
    return false;
  }
}
// arriving part way down the page (a reload, or a link to a section): skip the boat
const startUnder = window.scrollY > 40 || (location.hash && location.hash !== '#intro');
if (startUnder) { root.classList.remove('surface'); root.classList.add('under'); }

function boot() {
  measureStops();
  onScroll();
  if (!hasWebGL()) return;
  import('./sea.js').then(({ createSea }) => {
    sea = createSea({
      canvas, calm,
      onSplash: () => { flash('splash'); sfx('dive'); if (audio) audio.setUnder(true); },
      onDuck: showDepth,
      onTv: (r) => {
        const on = r.visible && tvEl.classList.contains('lit');
        tvEl.classList.toggle('on', on);
        if (on) {
          tvEl.style.width = r.w.toFixed(1) + 'px';
          tvEl.style.height = r.h.toFixed(1) + 'px';
          tvEl.style.transform = `translate(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px) rotate(${r.rot.toFixed(4)}rad) translate(-50%, -50%)`;
        }
      },
      onRemote: (r) => {
        remoteEl.classList.toggle('on', r.visible);
        if (!r.visible) return;
        const s = Math.max(44, r.r * 2);
        remoteEl.style.width = remoteEl.style.height = s.toFixed(0) + 'px';
        remoteEl.style.transform = `translate(${(r.x - s / 2).toFixed(1)}px, ${(r.y - s / 2).toFixed(1)}px)`;
      }
    });
    try { root.style.setProperty('--rust-img', `url(${sea.rustImage()})`); } catch (err) { /* the plain gradient stays */ }
    if (!root.classList.contains('surface')) { sea.setDepth(depthAt(window.scrollY)); sea.plunge(); }
    sea.start();
    root.classList.add('sea-on');
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); sea.stop(); sea = null; root.classList.remove('sea-on'); });
  }).catch((err) => {
    console.warn('The sea did not load. The page still works without it.', err);
  });
}
if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot, { once: true });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureStops(); onScroll(); });
