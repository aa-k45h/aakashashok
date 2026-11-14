// The 3D pond: water, lily pads, koi and the duck.
// Loaded lazily by main.js so the text paints first.
import * as THREE from '../vendor/three.module.min.js';

const NOISE = /* glsl */ `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return s;
}`;

const VERT = /* glsl */ `
varying vec2 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Pond floor: pale sand seen through clear water, with moving light lines.
const FLOOR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vW;
uniform float uTime;
uniform float uDark;
uniform float uNight;
uniform vec2 uSunPos;
${NOISE}
void main(){
  vec2 p = vW;
  float n = fbm(p * 0.16 + 2.0);
  vec3 shallow = vec3(0.722, 0.937, 0.871);
  vec3 deep = vec3(0.345, 0.792, 0.776);
  vec3 col = mix(shallow, deep, smoothstep(0.32, 0.68, n));
  vec2 q = p * 0.85 + vec2(fbm(p * 0.45 + uTime * 0.06), fbm(p * 0.45 - uTime * 0.05 + 4.0)) * 1.7;
  float ca = smoothstep(0.055, 0.0, abs(noise(q) - 0.5));
  col += ca * 0.085;
  // a few stones on the floor
  vec2 g = p * 0.55; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float h = hash(id);
  vec2 o = (vec2(hash(id + 1.7), hash(id + 5.3)) - 0.5) * 0.6;
  float stone = smoothstep(0.16 * h + 0.05, 0.16 * h + 0.03, length((f - o) * vec2(1.0, 1.35))) * step(0.62, h);
  col = mix(col, vec3(0.27, 0.66, 0.66), stone * 0.5);
  float sd = length((p - uSunPos) * vec2(1.0, 0.8));
  col = mix(col, vec3(1.0, 0.975, 0.84), smoothstep(13.0, 1.0, sd) * 0.55);
  // night: deep water, a little moonlight where the sun was
  vec3 ncol = mix(vec3(0.07, 0.215, 0.3), vec3(0.03, 0.105, 0.19), smoothstep(0.32, 0.68, n));
  ncol += ca * 0.035;
  ncol = mix(ncol, vec3(0.03, 0.12, 0.17), stone * 0.5);
  ncol = mix(ncol, vec3(0.5, 0.64, 0.82), smoothstep(13.0, 1.0, sd) * 0.3);
  col = mix(col, ncol, uNight);
  col *= 1.0 - uDark * 0.45;
  gl_FragColor = vec4(col, 1.0);
}`;

// Water surface: cloud reflections, sun glare, sparkles, squiggly highlights and ripples.
const SURFACE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vW;
uniform float uTime;
uniform float uSun;
uniform float uDark;
uniform float uNight;
uniform vec2 uSunPos;
uniform vec4 uRip[16];
${NOISE}
void main(){
  vec2 p = vW;
  float rings = 0.0;
  vec2 disp = vec2(0.0);
  for (int i = 0; i < 16; i++) {
    vec4 r = uRip[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > 4.0) continue;
    vec2 d = p - r.xy;
    float dist = length(d);
    float ang = atan(d.y, d.x);
    // each ring gets its own wobble so no two are the same circle
    float wob = (noise(vec2(ang * 1.9 + r.z * 3.1, age * 0.7 + r.x)) - 0.5) * 0.3 * (0.35 + age * 0.5);
    float life = 1.0 - age / 4.0;
    float w = 0.03 + age * 0.014;
    float a = smoothstep(w, 0.0, abs(dist - age * 1.45 + wob));
    float b = smoothstep(w, 0.0, abs(dist - (age * 1.45 - 0.5) + wob * 0.7)) * step(0.34, age) * 0.6;
    float ring = (a + b) * life * life * r.w;
    rings += ring;
    disp += normalize(d + 0.0001) * ring * 0.3;
  }

  // sky: flat anime clouds, two tones
  vec2 cp = (p + disp) * vec2(0.05, 0.085) + vec2(uTime * 0.005, 0.0);
  cp += (noise(p * 1.4 + uTime * 0.25) - 0.5) * 0.012;
  float cl = fbm(cp + 3.0);
  float cloud = smoothstep(0.535, 0.56, cl);
  float cloudCore = smoothstep(0.6, 0.625, cl);

  // thin drifting highlight lines
  float wv = noise(p * vec2(0.65, 2.3) + vec2(uTime * 0.11, uTime * 0.045) + disp * 2.0);
  float line = smoothstep(0.011, 0.0, abs(wv - 0.5)) * smoothstep(0.42, 0.7, noise(p * 0.33 + uTime * 0.025));

  float sd = length((p - uSunPos) * vec2(1.0, 0.8));
  float glare = smoothstep(10.0, 0.0, sd);

  // four-point sparkles that blink at their own pace
  vec2 g = p * 1.5; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
  float h = hash(id);
  vec2 dd = f - (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
  float tw = pow(max(0.0, sin(uTime * (0.9 + h * 2.2) + h * 40.0)), 7.0);
  float star = smoothstep(0.035, 0.0, abs(dd.x)) * smoothstep(0.2, 0.0, abs(dd.y))
             + smoothstep(0.05, 0.0, abs(dd.y)) * smoothstep(0.16, 0.0, abs(dd.x))
             + smoothstep(0.07, 0.0, length(dd));
  float sp = star * tw * step(0.74 - glare * 0.3 - uSun * 0.3 - uNight * 0.1, h);

  // at night the clouds fade and the sparkles read as stars
  float white = (cloud * 0.42 + cloudCore * 0.2) * (1.0 - uNight * 0.8) + line * (0.5 - uNight * 0.25) + sp + rings * (0.85 - uNight * 0.3);
  float warm = glare * (0.42 + uSun * 0.5) * (1.0 - uNight * 0.45);
  float alpha = clamp(white + warm, 0.0, 1.0);
  vec3 col = mix(mix(vec3(1.0), vec3(0.85, 0.93, 1.0), uNight), mix(vec3(1.0, 0.965, 0.8), vec3(0.78, 0.87, 1.0), uNight * (1.0 - uSun)), warm / max(white + warm, 0.001));
  col *= 1.0 - uDark * 0.35;
  gl_FragColor = vec4(col, alpha * (1.0 - uDark * 0.4));
}`;

const INK = 0x0e3a40;

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function padTexture(seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const greens = [['#b4e879', '#63c25c'], ['#a2e07a', '#55b866'], ['#c0ea72', '#6fc552']][seed % 3];
  const g = x.createRadialGradient(118, 120, 10, 128, 128, 128);
  g.addColorStop(0, greens[0]);
  g.addColorStop(1, greens[1]);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(255,255,255,0.38)';
  x.lineCap = 'round';
  const veins = 9 + (seed % 4);
  for (let i = 0; i < veins; i++) {
    // hand-drawn veins: uneven spacing, uneven length, a slight bend
    const a = (i / veins) * Math.PI * 2 + Math.sin(seed * 3.3 + i * 1.7) * 0.16;
    const len = 92 + Math.sin(seed + i * 2.3) * 16;
    x.lineWidth = 2 + (i % 3) * 0.7;
    x.beginPath();
    x.moveTo(128, 128);
    x.quadraticCurveTo(128 + Math.cos(a + 0.12) * len * 0.5, 128 + Math.sin(a + 0.12) * len * 0.5, 128 + Math.cos(a) * len, 128 + Math.sin(a) * len);
    x.stroke();
  }
  x.strokeStyle = '#2f8f4e';
  x.lineWidth = 9;
  x.beginPath();
  x.arc(128, 128, 124, 0, Math.PI * 2);
  x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createPond({ canvas, padEls, calm, onWake }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xa9e8dc);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const camDir = new THREE.Vector3(0, 11, 6.5).normalize();

  const skyLight = new THREE.HemisphereLight(0xffffff, 0x8fd8cf, 1.9);
  scene.add(skyLight);
  const sunLight = new THREE.DirectionalLight(0xfff3c4, 1.6);
  sunLight.position.set(-6, 10, 2);
  scene.add(sunLight);

  const uniforms = {
    uTime: { value: 0 },
    uSun: { value: 0 },
    uDark: { value: 0 },
    uNight: { value: 0 },
    uSunPos: { value: new THREE.Vector2(-8, -9) },
    uRip: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, -99, 0)) }
  };

  const plane = new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(plane, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FLOOR_FRAG, uniforms }));
  floor.position.y = -0.7;
  scene.add(floor);
  const surface = new THREE.Mesh(plane, new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: SURFACE_FRAG, uniforms, transparent: true, depthWrite: false
  }));
  surface.renderOrder = 2;
  scene.add(surface);

  // toon shading in three steps
  const ramp = new THREE.DataTexture(new Uint8Array([165, 165, 165, 255, 225, 225, 225, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: ramp });
  const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x1f7f80, transparent: true, opacity: 0.2, depthWrite: false });
  const disc = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);

  function outlined(geo, mat, grow = 1.07) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    const o = new THREE.Mesh(geo, inkMat);
    o.scale.setScalar(grow);
    g.add(o);
    return g;
  }

  // ---------- lily pads ----------
  const pads = [];
  function addPad(def, i) {
    const group = new THREE.Group();
    const notch = 0.3 + (i % 3) * 0.09;
    const geo = new THREE.CircleGeometry(1, 44, notch * 0.5, Math.PI * 2 - notch).rotateX(-Math.PI / 2);
    const top = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: padTexture(i), side: THREE.DoubleSide }));
    top.position.y = 0.03;
    top.renderOrder = 3;
    group.add(top);
    const shadow = new THREE.Mesh(disc, shadowMat);
    shadow.position.set(0.28, -0.69, 0.36);
    group.add(shadow);
    group.rotation.y = def.turn;
    group.scale.set(def.r, 1, def.r);
    scene.add(group);
    const pad = { ...def, group, top, home: new THREE.Vector3(), r: def.r, press: 0, hover: 0, phase: i * 1.9 };
    pads.push(pad);
    return pad;
  }
  const navPads = padEls.map((el, i) => addPad({
    el, nav: true, r: 1,
    x: +el.style.getPropertyValue('--x'), y: +el.style.getPropertyValue('--y'),
    px: +el.style.getPropertyValue('--px'), py: +el.style.getPropertyValue('--py'),
    cx: +el.style.getPropertyValue('--cx'), cy: +el.style.getPropertyValue('--cy'),
    turn: [0.5, 2.4, -1.1, 3.6][i % 4]
  }, i));
  // loose pads, placed by hand so they do not line up
  [
    { x: 46, y: 91, px: 8, py: 70, r: 0.5, turn: 1.3 },
    { x: 66, y: 22, px: 90, py: 64, r: 0.42, turn: 4.0 },
    { x: 97, y: 30, px: 54, py: 72, r: 0.55, turn: 2.2 },
    { x: 88, y: 93, px: 60, py: 94, r: 0.47, turn: 5.1 },
    { x: 61, y: 43, px: 12, py: 92, r: 0.3, turn: 0.2 },
    { x: 37, y: 71, px: 93, py: 90, r: 0.36, turn: 3.0 },
    { x: 84, y: 12, px: 91, py: 46, r: 0.33, turn: 1.9 }
  ].forEach((d, i) => addPad(d, i + 4));

  // a lotus that sits on the pad for the section you are reading
  const lotus = new THREE.Group();
  {
    const petalGeo = new THREE.SphereGeometry(0.17, 10, 8);
    const pink = toon(0xff9db5), pale = toon(0xffd3dc);
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 5 : 8;
      for (let i = 0; i < n; i++) {
        const holder = new THREE.Group();
        const petal = new THREE.Mesh(petalGeo, ring ? pale : pink);
        petal.scale.set(0.5, 0.22, 1.05 - ring * 0.25);
        petal.position.set(0, 0.05, 0.15 - ring * 0.05);
        petal.rotation.x = -0.45 - ring * 0.5;
        holder.add(petal);
        holder.rotation.y = (i / n) * Math.PI * 2 + ring * 0.4 + Math.sin(i * 2.1) * 0.08;
        lotus.add(holder);
      }
    }
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), toon(0xffd338));
    heart.position.y = 0.16;
    lotus.add(heart);
    lotus.scale.setScalar(0);
    scene.add(lotus);
  }
  let current = 0;
  let lotusScale = 0;

  // ---------- koi ----------
  const kois = [];
  const waterTint = new THREE.Color(0x8ddcd2);
  function addKoi(spec, k) {
    const profile = [0.15, 0.21, 0.23, 0.2, 0.155, 0.11, 0.07];
    const segs = profile.map((r, i) => {
      const patch = Math.sin(spec.seed * 12.9 + i * spec.patch) > spec.cut;
      const color = new THREE.Color(patch ? spec.b : spec.a).lerp(waterTint, 0.16);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color }));
      m.scale.set(1, 0.55, 1.25);
      scene.add(m);
      return m;
    });
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.quadraticCurveTo(0.2, -0.16, 0.17, -0.42);
    finShape.quadraticCurveTo(0, -0.26, -0.17, -0.42);
    finShape.quadraticCurveTo(-0.2, -0.16, 0, 0);
    const finMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(spec.b).lerp(waterTint, 0.3), side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const tail = new THREE.Mesh(new THREE.ShapeGeometry(finShape).rotateX(Math.PI / 2), finMat);
    scene.add(tail);
    const side = new THREE.ShapeGeometry(finShape).rotateX(Math.PI / 2).scale(0.55, 1, 0.5);
    const finL = new THREE.Mesh(side, finMat), finR = new THREE.Mesh(side, finMat);
    scene.add(finL, finR);
    kois.push({ ...spec, segs, tail, finL, finR, size: spec.size || 1 });
  }
  addKoi({ seed: 1, a: 0xfffaf0, b: 0xf26a3d, patch: 1.7, cut: 0.1, cx: 2, cz: 0.5, A: 11, B: 4.2, w: 0.085, ph: 0.4, depth: -0.34, glow: 0xff8a4a }, 0);
  addKoi({ seed: 2, a: 0xf7a23b, b: 0xfffaf0, patch: 2.6, cut: 0.55, cx: -3, cz: 2.5, A: 13, B: 5, w: 0.062, ph: 2.9, depth: -0.42, size: 1.15, glow: 0xffc24a }, 1);
  addKoi({ seed: 3, a: 0xfffaf0, b: 0x24343a, patch: 2.1, cut: 0.35, cx: 5, cz: -2, A: 9, B: 6, w: 0.074, ph: 4.4, depth: -0.3, size: 0.85, glow: 0x7fe9ff }, 2);
  addKoi({ seed: 4, a: 0xf26a3d, b: 0xfffaf0, patch: 3.3, cut: 0.6, cx: 0, cz: 4, A: 15, B: 3.4, w: 0.05, ph: 1.3, depth: -0.46, glow: 0xff6f8f }, 3);

  // after dark the koi glow: soft additive halos that ride along the body
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  for (const k of kois) {
    k.base = k.segs.map((m) => m.material.color.clone());
    k.finBase = k.tail.material.color.clone();
    k.halos = [1, 3, 5].map((i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: k.glow, transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending
      }));
      sp.renderOrder = 1;
      sp.userData.seg = i;
      scene.add(sp);
      return sp;
    });
  }
  const lit = new THREE.Color(), lit2 = new THREE.Color();

  const kp = new THREE.Vector3(), kq = new THREE.Vector3();
  function koiAt(k, t, out) {
    return out.set(
      k.cx + k.A * Math.sin(k.w * t + k.ph) + 1.3 * Math.sin(k.w * 2.7 * t + k.seed),
      k.depth,
      k.cz + k.B * Math.sin(k.w * 1.63 * t + k.ph * 1.7) + 0.8 * Math.cos(k.w * 3.1 * t)
    );
  }
  function updateKoi(k, t) {
    const lag = 0.21 * k.size;
    let hx = 0, hz = 1;
    for (let i = 0; i < k.segs.length; i++) {
      koiAt(k, t - i * lag, kp);
      koiAt(k, t - i * lag + 0.1, kq);
      const dx = kq.x - kp.x, dz = kq.z - kp.z;
      const len = Math.hypot(dx, dz) || 1;
      hx = dx / len; hz = dz / len;
      const sway = Math.sin(t * 5.2 - i * 0.85 + k.seed) * 0.012 * i * i * 0.35;
      const s = k.segs[i];
      s.position.set(kp.x - hz * sway, kp.y, kp.z + hx * sway);
      s.rotation.y = Math.atan2(hx, hz);
      s.scale.set(k.size, 0.55 * k.size, 1.25 * k.size);
      if (i === 1) {
        const yaw = Math.atan2(hx, hz), flap = Math.sin(t * 3 + k.seed) * 0.25;
        k.finL.position.set(kp.x - hz * 0.2 * k.size, kp.y - 0.02, kp.z + hx * 0.2 * k.size);
        k.finR.position.set(kp.x + hz * 0.2 * k.size, kp.y - 0.02, kp.z - hx * 0.2 * k.size);
        k.finL.rotation.y = yaw - 1.0 - flap;
        k.finR.rotation.y = yaw + 1.0 + flap;
        k.finL.scale.setScalar(k.size); k.finR.scale.setScalar(k.size);
      }
    }
    const last = k.segs[k.segs.length - 1];
    k.tail.position.copy(last.position);
    k.tail.rotation.y = Math.atan2(hx, hz) + Math.sin(t * 5.2 - 6 + k.seed) * 0.5;
    k.tail.scale.setScalar(k.size);
  }

  // ---------- the duck ----------
  const duck = new THREE.Group();
  const duckBody = new THREE.Group();
  {
    const yellow = toon(0xffd338);
    const body = outlined(new THREE.SphereGeometry(0.42, 24, 16), yellow, 1.06);
    body.scale.set(1, 0.74, 1.24);
    body.position.y = 0.2;
    const tail = outlined(new THREE.ConeGeometry(0.15, 0.3, 12), yellow, 1.14);
    tail.position.set(0, 0.4, -0.47);
    tail.rotation.x = -0.9;
    const head = outlined(new THREE.SphereGeometry(0.28, 22, 16), yellow, 1.08);
    head.position.set(0, 0.66, 0.26);
    const beak = outlined(new THREE.SphereGeometry(0.15, 14, 10), toon(0xf26a3d), 1.13);
    beak.scale.set(1.05, 0.42, 1.1);
    beak.position.set(0, 0.6, 0.53);
    duckBody.add(body, tail, head, beak);
    const wingGeo = new THREE.SphereGeometry(0.2, 12, 10);
    const eyeGeo = new THREE.SphereGeometry(0.043, 10, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: INK });
    const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach((s) => {
      const wing = new THREE.Mesh(wingGeo, toon(0xf7c21f));
      wing.scale.set(0.35, 0.6, 1.15);
      wing.position.set(s * 0.39, 0.27, -0.05);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(s * 0.125, 0.75, 0.47);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), glint);
      dot.position.set(s * 0.125 - 0.012, 0.77, 0.505);
      duckBody.add(wing, eye, dot);
    });
    duck.add(duckBody);
    const shadow = new THREE.Mesh(disc, shadowMat);
    shadow.scale.set(0.5, 1, 0.6);
    shadow.position.set(0.24, -0.69, 0.32);
    duck.add(shadow);
    scene.add(duck);
  }
  const d = {
    pos: new THREE.Vector3(0, 0, 3), vel: new THREE.Vector3(), target: new THREE.Vector3(0, 0, 3),
    heading: 0.6, mode: 'idle', stopR: 0.9, maxSp: 4.6, wake: 0, navT: 0, navDone: null, hop: 0, roll: 0
  };

  // ---------- helpers ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  let W = 1, H = 1;

  function toWorld(px, py, out = new THREE.Vector3()) {
    ndc.set((px / W) * 2 - 1, -((py / H) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    return out.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t);
  }
  function toScreen(v, out) {
    tmp.copy(v).project(camera);
    out.x = (tmp.x + 1) * 0.5 * W;
    out.y = (1 - tmp.y) * 0.5 * H;
    return out;
  }

  let ripI = 0;
  function rippleAt(x, z, strength) {
    uniforms.uRip.value[ripI].set(x, z, uniforms.uTime.value, strength);
    ripI = (ripI + 1) % 16;
  }

  let placed = false;
  let compact = false;
  let lastNight = -1, raining = false, rainT = 0;
  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    const aspect = W / H;
    const portrait = aspect < 1;
    renderer.setSize(W, H, false);
    camera.aspect = aspect;
    const want = portrait ? 7.2 : 13;
    const dist = Math.max(12.8, (want * 0.5) / (Math.tan((camera.fov * Math.PI) / 360) * aspect));
    camera.position.copy(camDir).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const p of pads) {
      let fx = portrait ? p.px : p.x, fy = portrait ? p.py : p.y;
      if (p.nav && compact) {
        // parked: a column on the right edge, or off the bottom on a phone
        fx = portrait ? p.px : p.cx;
        fy = portrait ? 135 : p.cy;
      }
      toWorld((fx / 100) * W, (fy / 100) * H, p.home);
      if (p.nav) p.r = compact ? 0.5 : portrait ? 0.92 : 1;
      if (!placed) p.group.position.copy(p.home);
    }
    const s = toWorld(W * (portrait ? 0.2 : 0.1), -H * 0.06);
    uniforms.uSunPos.value.set(s.x, s.z);
    if (!placed) {
      toWorld(W * (portrait ? 0.5 : 0.42), H * (portrait ? 0.7 : 0.78), d.pos);
      d.target.copy(d.pos);
    }
    placed = true;
  }

  // ---------- frame ----------
  const scr = { x: 0, y: 0 }, scr2 = { x: 0, y: 0 };
  const speedScale = calm ? 0.35 : 1;
  let last = performance.now(), raf = 0, running = false;
  const duckScreen = { x: 0, y: 0 };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = (uniforms.uTime.value += dt * speedScale);

    // pads drift a little around home and dip when the duck arrives
    for (const p of pads) {
      const g = p.group;
      g.position.x += (p.home.x + Math.sin(t * 0.31 + p.phase) * 0.07 - g.position.x) * Math.min(1, dt * 3);
      g.position.z += (p.home.z + Math.cos(t * 0.23 + p.phase * 1.3) * 0.06 - g.position.z) * Math.min(1, dt * 3);
      p.press *= Math.exp(-dt * 3);
      const want = p.r * (1 + p.hover * 0.06);
      const sc = g.scale.x + (want - g.scale.x) * Math.min(1, dt * 8);
      g.scale.set(sc, 1, sc);
      g.rotation.y = p.turn + Math.sin(t * 0.17 + p.phase) * 0.05;
      p.top.position.y = 0.03 - p.press * 0.05;
      if (p.nav) {
        toScreen(g.position, scr);
        tmp.set(g.position.x + sc, 0, g.position.z);
        const rx = Math.abs(toScreen(tmp, scr2).x - scr.x);
        tmp.set(g.position.x, 0, g.position.z + sc);
        const ry = Math.abs(toScreen(tmp, scr2).y - scr.y);
        const st = p.el.style;
        st.left = scr.x.toFixed(1) + 'px';
        st.top = scr.y.toFixed(1) + 'px';
        st.width = (rx * 2).toFixed(1) + 'px';
        st.height = (ry * 2).toFixed(1) + 'px';
      }
    }

    const cur = navPads[current];
    lotusScale += ((cur ? 1 : 0) - lotusScale) * Math.min(1, dt * 4);
    if (cur) {
      lotus.position.set(cur.group.position.x - cur.group.scale.x * 0.52, 0.05 - cur.press * 0.05, cur.group.position.z - cur.group.scale.x * 0.3);
      lotus.scale.setScalar(lotusScale * cur.group.scale.x * (0.95 + Math.sin(t * 1.3) * 0.02));
      lotus.rotation.y = t * 0.05;
    }

    const night = uniforms.uNight.value;
    for (const k of kois) {
      updateKoi(k, t * 1.0 + 40);
      const pulse = 0.82 + Math.sin(t * 1.6 + k.seed * 2.1) * 0.18;
      k.segs.forEach((m, i) => {
        // brighter, cleaner color in the dark, as if lit from inside
        lit.copy(k.base[i]).multiplyScalar(1 + night * 0.5).lerp(lit2.set(k.glow), night * 0.18);
        m.material.color.copy(lit);
      });
      k.tail.material.color.copy(k.finBase).lerp(lit.set(k.glow), night * 0.5);
      k.halos.forEach((sp, j) => {
        const seg = k.segs[sp.userData.seg];
        sp.position.copy(seg.position);
        const sc = (j === 0 ? 2.5 : 2.0 - j * 0.3) * k.size * (0.9 + pulse * 0.25);
        sp.scale.set(sc, sc, 1);
        sp.material.opacity = night * (j === 0 ? 0.6 : 0.42) * pulse;
        sp.visible = night > 0.02;
      });
    }
    if (night !== lastNight) {
      lastNight = night;
      skyLight.intensity = 1.9 - night * 0.95;
      sunLight.intensity = 1.6 - night * 1.1;
      sunLight.color.setRGB(1 - night * 0.3, 0.95 - night * 0.12, 0.77 + night * 0.23);
      for (const p of pads) p.top.material.color.setRGB(1 - night * 0.5, 1 - night * 0.36, 1 - night * 0.26);
      renderer.setClearColor(lit.setRGB(0.66 - night * 0.6, 0.91 - night * 0.76, 0.86 - night * 0.6));
    }
    // rain dimples the pond
    if (raining) {
      rainT -= dt;
      if (rainT <= 0) {
        rainT = 0.2 + Math.random() * 0.22;
        toWorld(Math.random() * W, Math.random() * H, tmp);
        rippleAt(tmp.x, tmp.z, 0.22 + Math.random() * 0.3);
      }
    }

    // duck steering: head for the target, ease off near it
    tmp.subVectors(d.target, d.pos); tmp.y = 0;
    const dist = tmp.length();
    const sp = dist > d.stopR ? Math.min(d.maxSp, (dist - d.stopR) * 2.4 + 0.25) : 0;
    if (dist > 0.001) tmp.multiplyScalar(sp / dist);
    d.vel.lerp(tmp, 1 - Math.exp(-dt * (d.mode === 'drag' ? 9 : 3.2)));
    d.pos.addScaledVector(d.vel, dt);
    const speed = d.vel.length();
    if (speed > 0.12) {
      const next = lerpAngle(d.heading, Math.atan2(d.vel.x, d.vel.z), 1 - Math.exp(-dt * 6));
      d.roll += ((next - d.heading) * -4 - d.roll) * Math.min(1, dt * 5);
      d.heading = next;
    } else {
      d.roll *= Math.exp(-dt * 4);
    }
    d.hop = Math.max(0, d.hop - dt * 2.2);
    const hopY = Math.sin(d.hop * Math.PI) * 0.35;
    duck.position.set(d.pos.x, 0, d.pos.z);
    duck.rotation.y = d.heading;
    duckBody.position.y = Math.sin(t * 2.3) * 0.028 - 0.04 + hopY;
    duckBody.rotation.z = THREE.MathUtils.clamp(d.roll, -0.3, 0.3) + Math.sin(t * 1.7) * 0.03;
    duckBody.rotation.x = -Math.min(0.14, speed * 0.03) + Math.sin(t * 2.3 + 1) * 0.02;
    d.wake -= dt;
    if (speed > 0.9 && d.wake <= 0) {
      rippleAt(d.pos.x - Math.sin(d.heading) * 0.3, d.pos.z - Math.cos(d.heading) * 0.3, 0.3 + Math.min(0.25, speed * 0.05));
      d.wake = 0.34 + Math.sin(t * 7) * 0.08;
      if (onWake) onWake();
    }
    if (d.mode === 'nav') {
      // wall-clock limit, so a slow device never leaves the visitor waiting on the duck
      if (dist < d.stopR + 0.12 || now - d.navT > 2600) {
        const done = d.navDone;
        d.navDone = null;
        d.mode = 'idle';
        d.hop = 1;
        d.maxSp = 4.6;
        // if the clock ran out first, the duck still finishes the swim
        if (dist < d.stopR + 0.12) { d.stopR = 0.9; d.target.copy(d.pos); }
        const p = navPads[d.navTo];
        if (p) { p.press = 1; rippleAt(p.group.position.x, p.group.position.z, 0.8); }
        if (done) done();
      }
    }
    tmp.set(d.pos.x, 0.4, d.pos.z);
    toScreen(tmp, duckScreen);

    renderer.render(scene, camera);
  }

  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  layout();
  let lastMove = { x: -1, y: -1, t: 0 };
  const w3 = new THREE.Vector3();

  const api = {
    start, stop, layout,
    duckScreen,
    setCurrent(i) { current = i; },
    setCompact(on) { if (on !== compact) { compact = on; layout(); } },
    setHover(i, on) { if (navPads[i]) navPads[i].hover = on ? 1 : 0; },
    // mouse: the duck trails the cursor like a pet
    pointerMove(px, py) {
      if (d.mode === 'nav' || d.mode === 'drag') return;
      toWorld(px, py, d.target);
      d.mode = 'follow'; d.stopR = 0.9; d.maxSp = 4.6;
      if (calm) return;
      const now = performance.now();
      const moved = Math.hypot(px - lastMove.x, py - lastMove.y);
      if (moved > 70 && now - lastMove.t > 160) {
        rippleAt(d.target.x, d.target.z, 0.22 + Math.min(0.2, moved / 900));
        lastMove = { x: px, y: py, t: now };
      }
    },
    // a click or tap: one big ripple, and on touch the duck swims over
    tap(px, py, callDuck) {
      toWorld(px, py, w3);
      rippleAt(w3.x, w3.z, 1);
      if (callDuck && d.mode !== 'nav' && d.mode !== 'drag') {
        d.target.copy(w3); d.mode = 'follow'; d.stopR = 0.25; d.maxSp = 4.6;
      }
    },
    goTo(i, done) {
      const p = navPads[i];
      if (!p) { if (done) done(); return; }
      if (d.navDone) { const old = d.navDone; d.navDone = null; old(false); }
      d.mode = 'nav'; d.navTo = i; d.navT = performance.now(); d.navDone = done;
      d.target.copy(p.group.position);
      d.stopR = p.r + 0.42; d.maxSp = 7;
    },
    dragStart() { d.mode = 'drag'; d.stopR = 0.02; d.maxSp = 16; },
    dragMove(px, py) { if (d.mode === 'drag') toWorld(px, py, d.target); },
    // returns the pad index the duck was dropped on, or -1
    dragEnd() {
      if (d.mode !== 'drag') return -1;
      d.mode = 'idle'; d.stopR = 0.25; d.maxSp = 4.6;
      rippleAt(d.target.x, d.target.z, 0.9);
      let hit = -1;
      navPads.forEach((p, i) => {
        if (Math.hypot(p.group.position.x - d.target.x, p.group.position.z - d.target.z) < p.r * 1.25) hit = i;
      });
      return hit;
    },
    // the duck jumps, with a splash
    hop() {
      d.hop = 1;
      rippleAt(d.pos.x, d.pos.z, 1);
      rippleAt(d.pos.x + 0.4, d.pos.z - 0.3, 0.6);
    },
    // sun burst after a goal and dark sky after a save, both 0 to 1
    setSun(v) { uniforms.uSun.value = v; },
    // 0 is day, 1 is night
    setNight(v) { uniforms.uNight.value = v; },
    setRain(on) { raining = on; },
    setDark(v) { uniforms.uDark.value = v; }
  };
  return api;
}
