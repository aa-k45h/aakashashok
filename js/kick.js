// Penalty kick. A seal patrols a rusted goal and noses away anything it can reach.

export function initKick({ calm, sfx, flash }) {
  const box = document.querySelector('.kick');
  if (!box) return;
  const $ = (q) => box.querySelector(q);
  const ballEl = $('.ball'), sealEl = $('.seal'), tally = document.querySelector('.tally');
  const START = { x: 50, y: 104 }, GOAL_Y = 32, POST_L = 20, POST_R = 80, R = 9.5;
  const REACH = 15;       // half the seal, nose to tail
  const SEAL_SPEED = 54;  // quick, but a hard flick to the far side is quicker
  const ball = { x: START.x, y: START.y, vx: 0, vy: 0, s: 1 };
  const seal = { x: 50, y: 45, vx: 0, t: Math.random() * 6 };
  const score = { you: 0, seal: 0 };
  let held = false, state = 'live', raf = 0, last = 0, U = 1, lastP = null, seen = false;

  const measure = () => { U = box.clientWidth / 100; };
  function draw() {
    ballEl.style.transform = `translate(${(ball.x * U).toFixed(1)}px, ${(ball.y * U).toFixed(1)}px) rotate(${(ball.x * 7 + ball.y * 5).toFixed(0)}deg) scale(${ball.s.toFixed(2)})`;
    const tilt = Math.max(-14, Math.min(14, seal.vx * 0.22)) * (sealEl.classList.contains('left') ? -1 : 1);
    sealEl.style.transform = `translate(${(seal.x * U).toFixed(1)}px, ${(seal.y * U).toFixed(1)}px) rotate(${(Math.sin(seal.t * 1.3) * 3 + Math.abs(tilt) * 0.2).toFixed(1)}deg)`;
  }
  function mark(side) {
    score[side]++;
    if (!tally) return;
    tally.setAttribute('aria-label', `Score. You ${score.you}, seal ${score.seal}.`);
    const b = tally.querySelector(`b[data-side="${side}"]`);
    b.textContent = String(score[side] % 100);
    b.classList.remove('tick');
    void b.offsetWidth;
    b.classList.add('tick');
  }
  function reset() {
    ball.x = START.x + (Math.random() * 16 - 8); ball.y = START.y; ball.vx = ball.vy = 0; ball.s = 1;
    state = 'live';
    box.classList.remove('scored');
    sfx('bubble');
    run();
  }
  function goal() {
    // light pours down from the surface
    held = false;
    state = 'scored';
    ball.vx = ball.vy = 0;
    box.classList.add('scored');
    flash('sun'); sfx('sun');
    mark('you');
    setTimeout(reset, 2100);
  }
  function saved() {
    // nosed away, and the water darkens for a moment
    held = false;
    state = 'saved';
    ball.vx = (ball.x - seal.x) * 4 + (Math.random() * 2 - 1) * 30; ball.vy = 120;
    sealEl.classList.remove('roll');
    void sealEl.offsetWidth;
    if (!calm) sealEl.classList.add('roll');
    flash('dusk'); sfx('thud');
    mark('seal');
    setTimeout(() => { state = 'live'; }, 900);
  }
  function step(now) {
    raf = 0;
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    if (state === 'scored') {
      ball.y += (22 - ball.y) * Math.min(1, dt * 9);
      ball.s += (0.74 - ball.s) * Math.min(1, dt * 9);
    } else if (!held) {
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      // water drags harder than air
      const f = Math.exp(-1.8 * dt);
      ball.vx *= f; ball.vy *= f;
      if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx) * 0.5; }
      if (ball.x > 100 - R) { ball.x = 100 - R; ball.vx = -Math.abs(ball.vx) * 0.5; }
      if (ball.y > 125 - R) { ball.y = 125 - R; ball.vy = -Math.abs(ball.vy) * 0.5; }
    }

    // the seal: a lazy patrol across the goal mouth, and a dart at the ball when it comes close
    seal.t += dt;
    const patrol = 50 + Math.sin(seal.t * 0.7) * 24;
    const chasing = state === 'live' && ball.y < 92;
    const want = chasing ? Math.max(24, Math.min(76, ball.x)) : patrol;
    const dx = want - seal.x;
    const maxV = chasing ? SEAL_SPEED : 20;
    const v = Math.sign(dx) * Math.min(maxV, Math.abs(dx) * 3);
    seal.vx += (v - seal.vx) * Math.min(1, dt * 6);
    seal.x += seal.vx * dt;
    seal.y = 45 + Math.sin(seal.t * 1.1) * 2.2;
    if (Math.abs(seal.vx) > 3) sealEl.classList.toggle('left', seal.vx < 0);

    if (state === 'live' && ball.y < seal.y + 9 && ball.y > GOAL_Y - 2 && Math.abs(ball.x - seal.x) < REACH) saved();
    const inPosts = ball.x > POST_L + 4 && ball.x < POST_R - 4;
    if (state !== 'scored' && ball.y < GOAL_Y) {
      if (state === 'live' && inPosts) goal();
      else { ball.y = GOAL_Y; ball.vy = Math.abs(ball.vy) * 0.5; }
    }
    draw();
    // the seal never stops swimming while it is on screen
    if (seen || held || state !== 'live') raf = requestAnimationFrame(step);
  }
  function run() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } }

  const point = (e) => {
    const r = box.getBoundingClientRect();
    return { x: (e.clientX - r.left) / U, y: (e.clientY - r.top) / U, t: performance.now() };
  };
  ballEl.addEventListener('pointerdown', (e) => {
    if (state !== 'live') return;
    measure();
    held = true;
    lastP = point(e);
    ball.vx = ball.vy = 0;
    ballEl.setPointerCapture(e.pointerId);
    e.preventDefault();
    run();
  });
  ballEl.addEventListener('pointermove', (e) => {
    if (!held) return;
    const p = point(e);
    const dt = Math.max(0.008, (p.t - lastP.t) / 1000);
    const nx = Math.max(R, Math.min(100 - R, p.x)), ny = Math.max(10, Math.min(125 - R, p.y));
    ball.vx = ball.vx * 0.5 + ((nx - ball.x) / dt) * 0.5;
    ball.vy = ball.vy * 0.5 + ((ny - ball.y) / dt) * 0.5;
    ball.x = nx; ball.y = ny;
    lastP = p;
  });
  const release = () => {
    if (!held) return;
    held = false;
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 320) { ball.vx *= 320 / sp; ball.vy *= 320 / sp; }
    if (performance.now() - lastP.t > 90) ball.vx = ball.vy = 0;
  };
  ballEl.addEventListener('pointerup', release);
  ballEl.addEventListener('pointercancel', release);
  ballEl.addEventListener('keydown', (e) => {
    if (state !== 'live' || held) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      ball.x = Math.max(26, Math.min(74, ball.x + (e.key === 'ArrowLeft' ? -6 : 6)));
      ball.vx = ball.vy = 0;
    } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp') {
      ball.vx = 0; ball.vy = -300;
    } else return;
    e.preventDefault();
    measure(); run();
  });
  window.addEventListener('resize', () => { measure(); draw(); });
  measure(); draw();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      seen = entries.some((en) => en.isIntersecting);
      if (seen) { measure(); run(); }
    }, { rootMargin: '10% 0px' }).observe(box);
  } else {
    seen = true; run();
  }
}
