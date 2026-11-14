// Stage 3 pieces: sound toggle, sitcom remote, prompt jar, writing desk, penalty kick and the hidden bits.

let audio = null;
let soundOn = false;
let lastPaddle = 0;

// Play a named sound. Does nothing until the visitor has turned sound on.
export function sfx(name) {
  if (!audio || !soundOn) return;
  if (name === 'paddle') {
    const now = performance.now();
    if (now - lastPaddle < 650) return;
    lastPaddle = now;
  }
  audio.play(name);
}

// Rain sound. Several things can ask for it: the desk window and the actual rain.
const rainWants = new Set();
export function rainSound(key, on) {
  if (on) rainWants.add(key); else rainWants.delete(key);
  if (audio) audio.rain(soundOn && rainWants.size > 0);
}

// ---------- sitcom remote: original lines about a writer's life ----------
const MAIN = [
  ['Brooklyn Nine-Nine', [
    'Your edit request has been noted. My face has not moved.',
    'Cool, cool, cool. The client wants it shorter and also wants everything added back. Cool.',
    'I solved the case of the missing word count. It was the intro. It is always the intro.',
    'Noice. Zero comments on the draft. Either it is perfect or nobody opened it.',
    'I have feelings about this deadline. I will be expressing none of them.',
    'Nine drafts in, I would like to speak to whoever approved draft one. It was me. I am in custody.'
  ]],
  ['The Office', [
    'The meeting about the blog could have been a blog.',
    'They said "just a few small changes" and I looked at the camera. The camera understood.',
    'World\'s best first draft. It says so on the mug. I bought the mug.',
    'I declared the article finished. Out loud. Apparently that is not how approvals work.',
    'Somebody replied all with "thoughts?" and now we all have thoughts.',
    'The brief was one line. The line was "make it pop."'
  ]],
  ['How I Met Your Mother', [
    'Kids, in the fall of that year I wrote a headline I still think about. It was fine. That is the story.',
    'This draft is going to be legen, wait for it, please wait, the doc is still loading.',
    'Challenge accepted. It is 600 words on shipping policies. I said what I said.',
    'True story: I once cut my favorite line and the piece got better. I have not forgiven it.',
    'Nothing good gets written after 2 a.m. I have tested this more than once.',
    'I will tell you how I met this deadline. It is a long story and I was late.'
  ]],
  ['The Big Bang Theory', [
    'Knock knock knock, editor. Knock knock knock, editor. Knock knock knock, editor. Did you read my draft?',
    'That is my spot. Second paragraph, third line. The joke goes there and nowhere else.',
    'I ran the numbers. Coffee in, words out. The correlation is not flattering.',
    'The headline works in theory. So did a lot of things.',
    'I told the client the copy was final. Bazinga. It is a draft.',
    'I do not need sleep. I need answers, mainly to the email I sent on Tuesday.'
  ]]
];
const WILD = [
  ['Friends', [
    'Pivot! The campaign changed again. Pivot!',
    'We were on a break. Me and the document. I came back and it was still bad.',
    'Could this intro be any longer?'
  ]],
  ['Modern Family', [
    'I told my family I write "content." They nodded the way people nod at a magician.',
    'My process has two steps. Step one is panic. Step two is also panic, but with a title.',
    'I gave the client three options. They picked a fourth. It was mine from last month.'
  ]],
  ['Parks and Recreation', [
    'Treat yo\' self. One finished draft, one very large coffee.',
    'This is literally the best paragraph I have ever written. I will feel differently by lunch.',
    'I made a binder for this blog post. There are tabs. The tabs have tabs.'
  ]]
];

export function initExtras({ getPond, calm }) {
  const $ = (q, el = document) => el.querySelector(q);
  const root = document.documentElement;

  // ---------- sound toggle ----------
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
      audio.rain(soundOn && rainWants.size > 0);
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
  document.addEventListener('visibilitychange', () => { if (audio) audio.setHidden(document.hidden); });

  // ---------- sky: sun burst and dusk ----------
  const skyEl = $('#sky');
  function tween(set, up, down) {
    const t0 = performance.now();
    const tick = (now) => {
      const t = (now - t0) / 1000;
      const v = t < up ? t / up : Math.max(0, 1 - (t - up) / down);
      set(v);
      if (t < up + down) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function sky(kind) {
    skyEl.className = '';
    void skyEl.offsetWidth;
    skyEl.className = kind;
    const pond = getPond();
    if (!pond || !pond.setSun) return;
    if (kind === 'sun') tween((v) => pond.setSun(v), 0.45, 2.4);
    else tween((v) => pond.setDark(v), 0.35, 1.4);
  }

  // ---------- remote and TV ----------
  // The TV answers the remote with a line, and a cat wanders onto the screen.
  const remote = $('.remote'), tv = $('#tv');
  const CATS = ['cat-sit', 'cat-loaf', 'cat-peek', 'cat-stretch'];
  const FUR = ['#f7a23b', '#fff1c4', '#c9d6d4', '#f4b6a0'];
  let lastLine = '', catI = 0;
  function showTv(show, line) {
    $('.tv-show', tv).textContent = show;
    $('.tv-line', tv).textContent = line;
    catI = (catI + 1 + Math.floor(Math.random() * (CATS.length - 1))) % CATS.length;
    const cat = $('.cat', tv);
    $('use', cat).setAttribute('href', '#' + CATS[catI]);
    cat.style.setProperty('--fur', FUR[Math.floor(Math.random() * FUR.length)]);
    tv.classList.remove('idle', 'on');
    void tv.offsetWidth;
    tv.classList.add('on');
  }
  if (remote) {
    remote.addEventListener('click', () => {
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
  }

  // ---------- prompt jar ----------
  const jar = $('.jar'), slips = $('#slips');
  if (jar) {
    const setJar = (open) => {
      jar.setAttribute('aria-expanded', open ? 'true' : 'false');
      slips.hidden = !open;
      slips.classList.toggle('rise', open);
    };
    setJar(false);
    jar.addEventListener('click', () => { setJar(slips.hidden); sfx('clink'); });
  }

  // ---------- writing desk ----------
  const confession = $('.confession');
  let spotOn = null;
  document.querySelectorAll('.spot').forEach((spot) => {
    const show = () => {
      if (spotOn && spotOn !== spot) spotOn.classList.remove('on');
      spotOn = spot;
      spot.classList.add('on');
      confession.textContent = spot.dataset.note;
      confession.classList.add('on');
      if (spot.dataset.sound === 'rain') rainSound('desk', true);
    };
    const leave = () => { if (spot.dataset.sound === 'rain') rainSound('desk', false); };
    spot.addEventListener('pointerenter', show);
    spot.addEventListener('focus', show);
    spot.addEventListener('click', show);
    spot.addEventListener('pointerleave', leave);
    spot.addEventListener('blur', leave);
  });

  // ---------- penalty kick ----------
  // The frog never moves. Its tongue does the goalkeeping.
  const box = $('.kick');
  if (box) {
    const ballEl = $('.ball', box), frogEl = $('.frog', box), tongue = $('.tongue', box), tip = $('.tip', box);
    const START = { x: 50, y: 104 }, GOAL_Y = 32, POST_L = 20, POST_R = 80, R = 9.5;
    const FROG = { x: 50, y: 48 }, MOUTH = { x: 50, y: 46 };
    const ZONE = 66;        // the tongue goes once the ball is this close
    const TOO_FAST = 165;   // anything quicker than this beats the tongue, unless it is hit straight at the frog
    const ball = { x: START.x, y: START.y, vx: 0, vy: 0, s: 1 };
    let held = false, state = 'live', raf = 0, last = 0, U = 1, lick = null, tried = false, lastP = null;

    // the frog naps until someone shows up, then explains the game
    const say = $('.frog-say', box), board = $('.board'), otter = $('.otter');
    const score = { you: 0, frog: 0 };
    let sayT = 0, moodT = 0, awake = false, tipT = 0;
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    function mood(m, backIn) {
      clearTimeout(moodT);
      frogEl.dataset.mood = m;
      if (backIn) moodT = setTimeout(() => { frogEl.dataset.mood = awake ? 'awake' : 'asleep'; }, backIn);
    }
    function speak(text, ms = 4200) {
      clearTimeout(sayT);
      say.textContent = text;
      say.classList.add('on');
      sayT = setTimeout(() => say.classList.remove('on'), ms);
    }
    function wake() {
      if (awake) return;
      awake = true;
      mood('waking', 900);
      speak('Oh. Hello. Drag the ball into the net.', 4200);
      clearTimeout(tipT);
      tipT = setTimeout(() => { if (awake) speak('Slow shots are mine. Flick it fast.', 4500); }, 4700);
    }
    function nap() {
      awake = false;
      clearTimeout(tipT); clearTimeout(sayT);
      say.classList.remove('on');
      mood('asleep');
    }
    // the otter paddles over and flips the card by paw
    function scored(side) {
      score[side]++;
      if (side === 'you') { mood('shock', 1900); speak(pick(['Fine. That one counts.', 'I was blinking.', 'Okay, that was quick.', 'Lucky.']), 2600); }
      else { mood('smug', 1500); speak(pick(['Mine.', 'Too slow.', 'I barely moved.', 'Tongue beats ball.']), 2400); }
      if (!board) return;
      board.setAttribute('aria-label', `Score. You ${score.you}, frog ${score.frog}.`);
      const card = $(`.card[data-side="${side}"]`, board);
      const flip = () => {
        card.classList.remove('flip');
        void card.offsetWidth;
        card.classList.add('flip');
        setTimeout(() => { card.textContent = String(score[side] % 100); }, 250);
        sfx('paper');
      };
      if (!otter || calm) { flip(); return; }
      otter.classList.add('go');
      setTimeout(() => { otter.classList.add('tap'); flip(); }, 800);
      setTimeout(() => otter.classList.remove('tap'), 1150);
      setTimeout(() => otter.classList.remove('go'), 1900);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) wake(); else nap(); });
      }, { threshold: 0.45 }).observe(box);
    } else {
      wake();
    }

    const measure = () => { U = box.clientWidth / 100; };
    function draw() {
      ballEl.style.transform = `translate(${(ball.x * U).toFixed(1)}px, ${(ball.y * U).toFixed(1)}px) rotate(${(ball.x * 7 + ball.y * 5).toFixed(0)}deg) scale(${ball.s.toFixed(2)})`;
      frogEl.style.transform = `translate(${(FROG.x * U).toFixed(1)}px, ${(FROG.y * U).toFixed(1)}px)`;
      let ex = MOUTH.x, ey = MOUTH.y;
      if (lick) { ex += (lick.x - MOUTH.x) * lick.k; ey += (lick.y - MOUTH.y) * lick.k; }
      tongue.setAttribute('d', `M${MOUTH.x} ${MOUTH.y}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
      tip.setAttribute('cx', ex.toFixed(1));
      tip.setAttribute('cy', ey.toFixed(1));
      tip.setAttribute('r', lick && lick.k > 0.05 ? '2.3' : '0');
    }
    function reset() {
      ball.x = START.x + (Math.random() * 16 - 8); ball.y = START.y; ball.vx = ball.vy = 0; ball.s = 1;
      state = 'live'; tried = false;
      box.classList.remove('scored');
      sfx('plop');
      run();
    }
    function goal() {
      // the sun comes out
      held = false;
      state = 'scored';
      ball.vx = ball.vy = 0;
      box.classList.add('scored');
      sky('sun'); sfx('sun');
      scored('you');
      setTimeout(reset, 2100);
    }
    function stuck() {
      // the tongue has the ball, the sky goes dark for a moment
      held = false;
      state = 'saved';
      lick.stuck = true;
      lick.x = ball.x; lick.y = ball.y;
      ball.vx = ball.vy = 0;
      sky('dusk'); sfx('rumble');
      scored('frog');
    }
    function step(now) {
      raf = 0;
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      if (state === 'scored') {
        ball.y += (22 - ball.y) * Math.min(1, dt * 9);
        ball.s += (0.74 - ball.s) * Math.min(1, dt * 9);
      } else if (!held && !(lick && lick.stuck && !lick.let)) {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        const f = Math.exp(-1.5 * dt);
        ball.vx *= f; ball.vy *= f;
        if (ball.x < R) { ball.x = R; ball.vx = Math.abs(ball.vx) * 0.6; }
        if (ball.x > 100 - R) { ball.x = 100 - R; ball.vx = -Math.abs(ball.vx) * 0.6; }
        if (ball.y > 125 - R) { ball.y = 125 - R; ball.vy = -Math.abs(ball.vy) * 0.6; }
      }
      if (ball.y > 78) tried = false;

      // the frog decides once per attempt
      if (state === 'live' && !lick && !tried && ball.y < ZONE) {
        tried = true;
        const speed = Math.hypot(ball.vx, ball.vy);
        lick = { t: 0, k: 0, x: ball.x, y: ball.y, caught: speed < TOO_FAST || Math.abs(ball.x - FROG.x) < 10 };
      }
      if (lick) {
        lick.t += dt;
        const OUT = 0.13;
        if (lick.caught && !lick.stuck) { lick.x = ball.x; lick.y = ball.y; }
        if (lick.t < OUT) lick.k = lick.t / OUT;
        else if (lick.caught) {
          if (!lick.stuck) stuck();
          const h = (lick.t - OUT) / 0.26;
          if (h < 1) {
            // reel it in a little, ball stuck to the tip
            lick.k = 1 - 0.3 * h;
            ball.x = MOUTH.x + (lick.x - MOUTH.x) * lick.k;
            ball.y = MOUTH.y + (lick.y - MOUTH.y) * lick.k;
          } else {
            if (!lick.let) {
              lick.let = true;
              ball.vx = (Math.random() * 2 - 1) * 50; ball.vy = 115;
              setTimeout(() => { state = 'live'; sfx('plop'); }, 800);
            }
            lick.k = Math.max(0, 0.7 - (h - 1) * 1.6);
            if (lick.k <= 0) lick = null;
          }
        } else {
          lick.k = Math.max(0, 1 - (lick.t - OUT) / 0.22);
          if (lick.k <= 0) lick = null;
        }
        // a ball that reaches the line before the tongue does is still caught if the frog had it read
        if (lick && lick.caught && !lick.stuck && ball.y < GOAL_Y + 5) stuck();
      }

      const inPosts = ball.x > POST_L + 4 && ball.x < POST_R - 4;
      if (state !== 'scored' && ball.y < GOAL_Y && !(lick && lick.stuck && !lick.let)) {
        if (state === 'live' && inPosts) goal();
        else { ball.y = GOAL_Y; ball.vy = Math.abs(ball.vy) * 0.6; }
      }
      draw();
      const moving = held || state !== 'live' || lick || Math.hypot(ball.vx, ball.vy) > 1.5;
      if (moving) raf = requestAnimationFrame(step);
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
      if (sp > 300) { ball.vx *= 300 / sp; ball.vy *= 300 / sp; }
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
        ball.vx = 0; ball.vy = -270;
      } else return;
      e.preventDefault();
      measure(); run();
    });
    window.addEventListener('resize', () => { measure(); draw(); });
    measure(); draw();
    // the box can be laid out late, so measure again once it is on screen
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(() => { measure(); draw(); }).observe(box);
    }
  }

  // ---------- hidden bits ----------
  const flip = (btn, target, sound) => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      target.classList.toggle('out', on);
      if (on) sfx(sound);
    });
  };
  // the paperclip hides a stapler in jello, the umbrella hides a blue French horn
  flip($('.clip'), $('.jello'), 'paper');
  flip($('.umbrella'), $('.horn'), 'toot');
  // the atom knocks three times
  const atom = $('.atom');
  if (atom) {
    atom.addEventListener('click', () => {
      const sheet = atom.closest('.sheet');
      atom.classList.remove('spin'); sheet.classList.remove('knock');
      void atom.offsetWidth;
      atom.classList.add('spin'); sheet.classList.add('knock');
      sfx('knock');
    });
  }
  // type 99 anywhere
  let keys = '';
  window.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    keys = (keys + e.key).slice(-2);
    if (keys === '99') {
      keys = '';
      showTv('Brooklyn Nine-Nine', 'Nine-Nine!');
      const pond = getPond();
      if (pond && pond.hop) pond.hop();
      sfx('splash');
      if (window.scrollY > window.innerHeight * 0.5) window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
    }
  });
  // double-click the water and the duck jumps
  window.addEventListener('dblclick', (e) => {
    if (e.target.closest && e.target.closest('a, button, .sheet, .note, .kick-wrap, .desk, .telly, .jar-wrap')) return;
    const pond = getPond();
    if (pond && pond.hop) pond.hop();
    sfx('splash');
  });

  return { sky };
}
