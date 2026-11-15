// The sea: a boat on calm water, then everything under it.
// Sunlit shallows at the top, a rusted wreck on the seabed at the bottom.
// Loaded lazily by main.js so the text paints first.
import * as THREE from '../vendor/three.module.min.js';

const NOISE = /* glsl */ `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const WORLD_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const SEABED_Y = -44;
const SUN = new THREE.Vector3(-0.32, 0.42, -0.85).normalize();

// One shared sway for everything that hangs or drifts, so the whole scene moves to the same slow current.
const sway = (t, phase) => Math.sin(t * 0.55 + phase) * 0.6 + Math.sin(t * 0.23 + phase * 1.7) * 0.4;

function rng(seed) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

// ---------- painted textures: rust, soaked wood, sand ----------
function blotchTexture(size, base, blots, extra) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  const r = rng(blots.seed || 11);
  for (let i = 0; i < blots.n; i++) {
    const col = blots.colors[Math.floor(r() * blots.colors.length)];
    x.globalAlpha = blots.a[0] + r() * (blots.a[1] - blots.a[0]);
    x.fillStyle = col;
    x.beginPath();
    x.ellipse(r() * size, r() * size, blots.r[0] + r() * blots.r[1], blots.r[0] + r() * blots.r[1], r() * 3, 0, 6.3);
    x.fill();
  }
  x.globalAlpha = 1;
  if (extra) extra(x, r, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function rustCanvasTexture() {
  return blotchTexture(512, '#4b2a19', {
    n: 2600, seed: 5, a: [0.1, 0.42], r: [2, 13],
    colors: ['#8c4a20', '#b8632a', '#5d3215', '#3a1f10', '#2f514b', '#55766a', '#c9793a']
  }, (x, r, s) => {
    // runs of rust, pits and a few barnacle specks
    for (let i = 0; i < 220; i++) {
      x.globalAlpha = 0.14 + r() * 0.2;
      x.fillStyle = r() < 0.5 ? '#2a140a' : '#a2551f';
      const px = r() * s;
      x.fillRect(px, r() * s, 1 + r() * 2.5, 20 + r() * 70);
    }
    for (let i = 0; i < 1500; i++) {
      x.globalAlpha = 0.3 + r() * 0.5;
      x.fillStyle = r() < 0.3 ? '#d8d2bc' : '#1c0e07';
      x.beginPath(); x.arc(r() * s, r() * s, 0.6 + r() * 1.6, 0, 6.3); x.fill();
    }
    x.globalAlpha = 1;
  });
}
function woodTexture() {
  return blotchTexture(256, '#4a3b2a', {
    n: 160, seed: 9, a: [0.08, 0.3], r: [6, 26],
    colors: ['#2e2419', '#5d4a33', '#3c4a36', '#27382f', '#6b5740']
  }, (x, r, s) => {
    for (let y = 0; y < s; y += 32) {
      x.globalAlpha = 0.75; x.fillStyle = '#1b140d'; x.fillRect(0, y, s, 2.5);
      for (let i = 0; i < 16; i++) {
        x.globalAlpha = 0.14 + r() * 0.18;
        x.fillStyle = r() < 0.5 ? '#231a11' : '#7a654a';
        x.fillRect(r() * s, y + 4 + r() * 24, 30 + r() * 90, 1 + r() * 1.5);
      }
    }
    x.globalAlpha = 1;
  });
}
function sandTexture() {
  return blotchTexture(256, '#cdb98c', {
    n: 300, seed: 3, a: [0.08, 0.25], r: [2, 14],
    colors: ['#b9a273', '#e2d2a8', '#9f8c63', '#d8c59a', '#8f9a82']
  });
}
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function bubbleDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 4;
  x.beginPath(); x.arc(32, 32, 24, 0, 6.3); x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.14)'; x.fill();
  x.fillStyle = 'rgba(255,255,255,0.95)';
  x.beginPath(); x.arc(23, 22, 5, 0, 6.3); x.fill();
  return new THREE.CanvasTexture(c);
}

export function createSea({ canvas, calm, onTv, onRemote, onDuck, onSplash }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const fog = new THREE.FogExp2(0xf6dcc0, 0.004);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);

  const hemi = new THREE.HemisphereLight(0xdff6f4, 0x1d3f46, 1.5);
  const sun = new THREE.DirectionalLight(0xffe9c0, 2.2);
  sun.position.copy(SUN).multiplyScalar(40);
  scene.add(hemi, sun);

  const rust = rustCanvasTexture(), wood = woodTexture(), sand = sandTexture();
  const dot = softDot();
  const rustMat = new THREE.MeshLambertMaterial({ map: rust });
  const rustDark = new THREE.MeshLambertMaterial({ map: rust, color: 0x9a8f86 });
  const woodMat = new THREE.MeshLambertMaterial({ map: wood, side: THREE.DoubleSide });
  const woodLight = new THREE.MeshLambertMaterial({ map: wood, color: 0xe6c79a });
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x6f7f7c, flatShading: true });

  // shared by every hand-written shader, so they all sit in the same water
  const U = {
    uTime: { value: 0 },
    uFogColor: { value: new THREE.Color(0x49c2c6) },
    uFogDensity: { value: 0.03 },
    uLight: { value: 1 },
    uSun: { value: SUN }
  };
  const FOG = /* glsl */ `
    float fd = length(cameraPosition - vWorld) * uFogDensity;
    float fogF = 1.0 - exp(-fd * fd);`;

  // ---------- sky ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld; uniform vec3 uSun;
      void main(){
        vec3 d = normalize(vWorld - cameraPosition);
        float h = clamp(d.y, 0.0, 1.0);
        // warm at the horizon, soft blue overhead, a low sun
        vec3 col = mix(vec3(1.0, 0.86, 0.72), vec3(0.56, 0.8, 0.9), pow(h, 0.55));
        float s = max(dot(d, uSun), 0.0);
        col += vec3(1.0, 0.8, 0.55) * pow(s, 6.0) * 0.4 + vec3(1.0, 0.96, 0.85) * pow(s, 220.0) * 2.0;
        gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
        #include <colorspace_fragment>
      }`
  }));
  scene.add(sky);

  // ---------- the surface, seen from both sides ----------
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: false, uniforms: U,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorld;
      uniform float uTime; uniform vec3 uSun; uniform vec3 uFogColor;
      ${NOISE}
      void main(){
        vec2 p = vWorld.xz;
        vec3 col;
        if (cameraPosition.y > 0.0) {
          // from the boat: calm water, sky in it, a path of sun glitter
          vec3 V = normalize(cameraPosition - vWorld);
          float fr = pow(1.0 - max(V.y, 0.0), 3.5);
          float n = noise(p * 0.5 + uTime * 0.12) * 0.6 + noise(p * 1.6 - uTime * 0.18) * 0.4;
          col = mix(vec3(0.05, 0.36, 0.44), vec3(0.15, 0.58, 0.62), n);
          col = mix(col, vec3(1.0, 0.84, 0.7), fr * 0.82);
          vec3 N = normalize(vec3((noise(p * 2.2 + uTime * 0.35) - 0.5) * 0.55, 1.0, (noise(p * 2.2 + 7.0 - uTime * 0.3) - 0.5) * 0.55));
          float s = pow(max(dot(reflect(-V, N), uSun), 0.0), 70.0);
          col += vec3(1.0, 0.93, 0.78) * s * 1.6;
          float d = length(cameraPosition - vWorld);
          col = mix(col, vec3(1.0, 0.87, 0.74), 1.0 - exp(-d * 0.011));
          col = pow(col, vec3(2.2));
        } else {
          // from below: a bright shimmering window straight up, the water color further out
          float n = noise(p * 0.45 + uTime * 0.2) * 0.5 + noise(p * 1.2 - uTime * 0.26) * 0.5;
          float d = length(p - cameraPosition.xz);
          float window = smoothstep(46.0, 3.0, d);
          col = mix(uFogColor, vec3(0.72, 1.0, 0.94), window * (0.5 + n * 0.6));
          col += vec3(1.0, 0.92, 0.66) * pow(n, 5.0) * window * 1.3;
          col = mix(uFogColor, col, exp(cameraPosition.y * 0.07));
        }
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`
  }));
  scene.add(surface);

  // ---------- sunbeams ----------
  const rays = new THREE.Group();
  const rayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { ...U, uStrength: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vSeed;
      void main(){ vUv = uv; vSeed = modelMatrix[3][0] * 0.37 + modelMatrix[3][2] * 0.21; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; varying float vSeed; uniform float uTime; uniform float uStrength;
      void main(){
        float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float a = edge * edge * pow(vUv.y, 1.6) * smoothstep(1.0, 0.92, vUv.y);
        a *= 0.55 + 0.45 * sin(uTime * 0.5 + vSeed * 9.0);
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.78), a * 0.3 * uStrength);
      }`
  });
  {
    const r = rng(21);
    for (let i = 0; i < 11; i++) {
      const w = 1.6 + r() * 3.2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 46).translate(0, -23, 0), rayMat);
      m.position.set(-16 + r() * 30, 0, -12 + r() * 22);
      m.rotation.set(0.12 + r() * 0.1, r() * 0.6 - 0.3, 0.26 + r() * 0.12);
      rays.add(m);
    }
    scene.add(rays);
  }

  // ---------- seabed, light on the sand, rocks ----------
  const hill = (x, z) => Math.sin(x * 0.11) * 1.1 + Math.cos(z * 0.13 + 1.0) * 0.9 + Math.sin((x + z) * 0.31) * 0.35;
  const bedGeo = new THREE.PlaneGeometry(220, 220, 60, 60).rotateX(-Math.PI / 2);
  {
    const p = bedGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, hill(p.getX(i), p.getZ(i)));
    bedGeo.computeVertexNormals();
  }
  sand.repeat.set(26, 26);
  const bed = new THREE.Mesh(bedGeo, new THREE.MeshLambertMaterial({ map: sand }));
  bed.position.y = SEABED_Y;
  scene.add(bed);
  const caustics = new THREE.Mesh(bedGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: U,
    vertexShader: WORLD_VERT,
    fragmentShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorld; uniform float uTime; uniform float uFogDensity; uniform float uLight;
      ${NOISE}
      void main(){
        vec2 p = vWorld.xz * 0.34;
        vec2 q = p + vec2(noise(p + uTime * 0.1), noise(p + 3.1 - uTime * 0.085)) * 1.5;
        float c = smoothstep(0.075, 0.0, abs(noise(q * 1.5) - 0.5));
        ${FOG}
        gl_FragColor = vec4(vec3(0.75, 1.0, 0.92), c * 0.42 * (1.0 - fogF) * (0.35 + uLight * 0.65));
      }`
  }));
  caustics.position.y = SEABED_Y + 0.04;
  scene.add(caustics);
  const groundAt = (x, z) => SEABED_Y + hill(x, z);
  {
    const r = rng(33);
    const g = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(g, rockMat);
      const x = -26 + r() * 60, z = -22 + r() * 44, s = 0.4 + r() * r() * 3.2;
      m.scale.set(s * (0.8 + r() * 0.7), s * (0.5 + r() * 0.5), s * (0.8 + r() * 0.6));
      m.position.set(x, groundAt(x, z) + s * 0.15, z);
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      scene.add(m);
    }
  }

  // ---------- sea grass ----------
  {
    const blade = new THREE.PlaneGeometry(0.2, 2.2, 1, 7).translate(0, 1.1, 0);
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, fog: false, uniforms: U,
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying vec2 vUv; uniform float uTime;
        void main(){
          vUv = uv;
          vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
          float ph = instanceMatrix[3][0] * 0.7 + instanceMatrix[3][2] * 0.5;
          float bend = uv.y * uv.y;
          w.x += (sin(uTime * 0.55 + ph) * 0.6 + sin(uTime * 0.23 + ph * 1.7) * 0.4) * 0.55 * bend;
          w.z += sin(uTime * 0.4 + ph * 1.3) * 0.25 * bend;
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld; varying vec2 vUv; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uLight;
        void main(){
          if (abs(vUv.x - 0.5) > 0.5 * (1.0 - vUv.y * 0.92)) discard;
          vec3 col = pow(mix(vec3(0.1, 0.3, 0.2), vec3(0.42, 0.62, 0.3), vUv.y), vec3(2.2)) * (0.5 + uLight * 0.6);
          ${FOG}
          gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
          #include <colorspace_fragment>
        }`
    });
    const n = calm ? 120 : 340;
    const grass = new THREE.InstancedMesh(blade, mat, n);
    const r = rng(77), o = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
      // in clumps, thicker near the wreck
      const cx = -12 + r() * 40, cz = -10 + r() * 22;
      const x = cx + (r() - 0.5) * 2.4, z = cz + (r() - 0.5) * 2.4;
      o.position.set(x, groundAt(x, z) - 0.1, z);
      o.rotation.set(0, r() * 6.28, 0);
      const s = 0.5 + r() * 1.1;
      o.scale.set(s, s * (0.7 + r() * 0.8), s);
      o.updateMatrix();
      grass.setMatrixAt(i, o.matrix);
    }
    grass.frustumCulled = false;
    scene.add(grass);
  }

  // ---------- the wreck ----------
  const wreck = new THREE.Group();
  const sails = [];
  {
    const L = 30, B = 7.4, D = 5.2, NX = 30, NY = 10;
    const half = (t) => (B / 2) * Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * t)), 0.5);
    const keel = (t) => D * 0.3 * Math.pow(Math.abs(t - 0.5) * 2, 3);
    const section = (t, a, inset = 0) => {
      const c = Math.cos(a), s = Math.sin(a);
      const w = half(t) - inset;
      return new THREE.Vector3((t - 0.5) * L, D - s * (D - keel(t) - inset), Math.sign(c) * Math.pow(Math.abs(c), 0.62) * w);
    };
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NY; j++) {
      const v = section(i / NX, (j / NY) * Math.PI);
      pos.push(v.x, v.y, v.z);
      uv.push((i / NX) * 7, (j / NY) * 2.5);
    }
    const r = rng(101);
    const open = new Set();
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      // holes torn in the side that faces us, where the ribs show through
      const hole = i > 7 && i < 24 && j >= 1 && j <= 3 && r() > 0.63;
      if (hole) { open.add(i); continue; }
      const a = i * (NY + 1) + j, b = a + NY + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hg.setIndex(idx);
    hg.computeVertexNormals();
    wreck.add(new THREE.Mesh(hg, woodMat));
    // ribs
    for (let i = 6; i <= 25; i += 2) {
      const pts = [];
      for (let j = 0; j <= 10; j++) pts.push(section(i / NX, (j / 10) * Math.PI, 0.18));
      wreck.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.13, 5), woodMat));
    }
    // deck planks, some short, some gone
    for (let k = -3; k <= 3; k++) {
      if (k === 1) continue;
      const len = L * (0.5 + r() * 0.34), off = (r() - 0.5) * L * 0.2;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, 0.78), woodMat);
      plank.position.set(off, D - 1, k * 0.84);
      plank.rotation.z = (r() - 0.5) * 0.03;
      wreck.add(plank);
    }
    // masts, yards, rags of sail
    const sailAlpha = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#000';
      const q = rng(55);
      for (let i = 0; i < 26; i++) { x.beginPath(); x.ellipse(q() * 128, 40 + q() * 100, 4 + q() * 16, 6 + q() * 26, q() * 3, 0, 6.3); x.fill(); }
      for (let i = 0; i < 30; i++) { x.beginPath(); x.moveTo(q() * 128, 128); x.lineTo(q() * 128, 128 - q() * 60); x.lineTo(q() * 128, 128); x.fill(); }
      return new THREE.CanvasTexture(c);
    })();
    const sailMat = new THREE.MeshLambertMaterial({ color: 0xbfb69c, alphaMap: sailAlpha, alphaTest: 0.5, side: THREE.DoubleSide });
    const mast = (x, h, yards) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.44, h, 10), woodMat);
      m.position.set(x, D - 1 + h / 2, 0);
      wreck.add(m);
      yards.forEach(([y, len, sail]) => {
        const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, len, 8), woodMat);
        yard.rotation.x = Math.PI / 2;
        yard.rotation.y = 0.12;
        yard.position.set(x + 0.3, D - 1 + y, 0);
        wreck.add(yard);
        if (sail) {
          const g = new THREE.PlaneGeometry(len * 0.86, sail, 12, 8).translate(0, -sail / 2, 0);
          const s = new THREE.Mesh(g, sailMat);
          s.rotation.y = Math.PI / 2 + 0.12;
          s.position.set(x + 0.42, D - 1 + y - 0.1, 0);
          s.userData.base = g.attributes.position.array.slice();
          s.userData.h = sail;
          wreck.add(s);
          sails.push(s);
        }
      });
      return m;
    };
    mast(-3, 26, [[23.5, 8, 5], [16, 10.5, 6.5], [9, 9, 0]]);
    const stump = mast(7.5, 11, [[8.5, 7, 4.2]]);
    stump.rotation.z = -0.1;
    // crow's nest
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 0.9, 0.9, 12, 1, true), woodMat);
    nest.position.set(-3, D - 1 + 20, 0);
    wreck.add(nest);
    // bowsprit and rudder
    const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 9, 8), woodMat);
    sprit.rotation.z = Math.PI / 2 - 0.28;
    sprit.position.set(-L / 2 - 2.6, D + 0.9, 0);
    wreck.add(sprit);
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.6, 1.9), woodMat);
    rudder.position.set(L / 2 - 0.4, 2.6, 0);
    rudder.rotation.y = 0.5;
    wreck.add(rudder);
    // rigging that still holds
    const lines = [];
    const rig = (a, b) => lines.push(...a, ...b);
    const top = [-3, D + 25, 0];
    rig(top, [-L / 2 - 6, D + 2.2, 0]); rig(top, [L / 2 - 2, D, 0]);
    rig(top, [-1, D, B / 2 - 0.3]); rig(top, [-1, D, -B / 2 + 0.3]); rig(top, [-6, D, B / 2 - 0.6]);
    rig([-3, D + 15, 0], [7.5, D + 9.6, 0]); rig([7.5, D + 9.6, 0], [L / 2 - 2, D, 0]);
    const rigGeo = new THREE.BufferGeometry();
    rigGeo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    wreck.add(new THREE.LineSegments(rigGeo, new THREE.LineBasicMaterial({ color: 0x2c2a22 })));
    // iron: a cannon, hoops, a ship's wheel
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.8, 12), rustMat);
    cannon.rotation.x = Math.PI / 2 - 0.2;
    cannon.position.set(3, D - 0.5, B / 2 - 0.6);
    wreck.add(cannon);
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 8, 24), woodLight));
    for (let i = 0; i < 4; i++) {
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), woodLight);
      spoke.rotation.z = (i / 4) * Math.PI;
      wheel.add(spoke);
    }
    wheel.position.set(11, D + 0.4, 0);
    wheel.rotation.y = Math.PI / 2;
    wreck.add(wheel);

    wreck.rotation.set(0.05, -0.34, 0.15);
    scene.add(wreck);
  }

  // ---------- debris on the seabed, close to where we land ----------
  const debris = new THREE.Group();
  {
    const r = rng(404);
    const put = (m, x, z, lift, rx = 0, rz = 0) => {
      m.position.set(x, groundAt(x, z) + lift, z);
      m.rotation.set(rx, r() * 6.28, rz);
      debris.add(m);
      return m;
    };
    for (let i = 0; i < 5; i++) {
      const barrel = new THREE.Group();
      barrel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.25, 14), woodMat));
      [-0.4, 0.4].forEach((y) => { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.035, 6, 18), rustMat); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; barrel.add(hoop); });
      put(barrel, -4 + r() * 13, 9 + r() * 7, 0.45, r() < 0.5 ? Math.PI / 2 : 0.15, r() * 0.3);
    }
    for (let i = 0; i < 4; i++) {
      const s = 0.8 + r() * 0.5;
      put(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), woodLight), -5 + r() * 14, 8 + r() * 8, s * 0.42, r() * 0.25, r() * 0.25);
    }
    // a stove-in hull plate and a porthole ring, iron and orange
    const plate = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 2.2), rustMat);
    put(plate, 6.5, 12.5, 0.5, 0.5, 0.2);
    const port = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.11, 8, 20), rustMat);
    put(port, -1.5, 14.5, 0.14, Math.PI / 2 - 0.1, 0);
    const prop = new THREE.Group();
    prop.add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), rustMat));
    for (let i = 0; i < 3; i++) {
      const bl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6), rustMat);
      bl.scale.set(1, 0.14, 0.5);
      bl.position.set(Math.cos(i * 2.094) * 0.6, 0, Math.sin(i * 2.094) * 0.6);
      bl.rotation.y = -i * 2.094; bl.rotation.x = 0.4;
      prop.add(bl);
    }
    put(prop, 8.5, 9.5, 0.35, 1.1, 0.3);
    // a sea chest, lid ajar
    const chest = new THREE.Group();
    chest.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.95), woodLight));
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.5, 12, 1, false, 0, Math.PI), woodLight);
    lid.rotation.set(0, 0, Math.PI / 2); lid.rotation.y = Math.PI / 2;
    lid.position.set(0, 0.4, -0.2); lid.rotation.x = -0.5;
    chest.add(lid);
    [-0.5, 0.5].forEach((x) => { const band = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.84, 0.99), rustMat); band.position.x = x; chest.add(band); });
    put(chest, 2.2, 13.2, 0.38, 0, 0.06).rotation.y = -0.5;
    scene.add(debris);
  }

  // ---------- anchor line from the boat, with the TV tied into it ----------
  const TV = new THREE.Vector3(2.7, -13, 14.5);
  const anchorAt = new THREE.Vector3(5.2, groundAt(5.2, 8) + 1.1, 8);
  {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.95, 0.82, 23.5), new THREE.Vector3(1.05, 0.3, 23.1), new THREE.Vector3(1.3, -2.5, 21.6),
      new THREE.Vector3(2.3, -8, 17), new THREE.Vector3(TV.x + 0.1, TV.y + 2.5, TV.z - 0.2), new THREE.Vector3(TV.x + 0.5, TV.y - 2.5, TV.z - 0.9),
      new THREE.Vector3(3.8, -28, 11.5), new THREE.Vector3(4.8, -39, 9), anchorAt.clone().add(new THREE.Vector3(0, 1.5, 0))
    ]);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.055, 6), new THREE.MeshLambertMaterial({ color: 0xb59868 }));
    scene.add(rope);
    // anchor, half buried
    const a = new THREE.Group();
    a.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3, 8), rustMat));
    const arms = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.13, 8, 20, Math.PI), rustMat);
    arms.rotation.z = Math.PI; arms.position.y = -0.45;
    a.add(arms);
    [-1, 1].forEach((s) => { const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 4), rustMat); fluke.position.set(s * 1.0, -0.2, 0); a.add(fluke); });
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), rustMat);
    stock.rotation.x = Math.PI / 2; stock.position.y = 1.2;
    a.add(stock);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), rustMat);
    ring.position.y = 1.6;
    a.add(ring);
    a.position.copy(anchorAt);
    a.rotation.set(0.5, 0.4, 0.5);
    scene.add(a);
  }

  // ---------- the TV and its remote ----------
  const tv = new THREE.Group();
  const tvGlow = new THREE.PointLight(0x9ff2e6, 0, 9, 1.6);
  const tvMarks = { l: new THREE.Vector3(-1.02, 0.02, 0.86), r: new THREE.Vector3(1.02 - 0.42, 0.02, 0.86), t: new THREE.Vector3(-0.21, 0.76, 0.86), b: new THREE.Vector3(-0.21, -0.72, 0.86) };
  const remote = new THREE.Group();
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.05, 1.7), rustMat);
    tv.add(body);
    // screen: dark glass set into the front, pushed left to leave room for the dials
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(2.12, 1.62, 0.06), rustDark);
    bezel.position.set(-0.21, 0.02, 0.86);
    tv.add(bezel);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.38), new THREE.MeshBasicMaterial({ color: 0x06181c }));
    glass.position.set(-0.21, 0.02, 0.9);
    tv.add(glass);
    tv.userData.glass = glass;
    [0.45, -0.05].forEach((y) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12), rustDark); k.rotation.x = Math.PI / 2; k.position.set(1.08, y, 0.9); tv.add(k); });
    const ant = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 1.02, 0, -0.9, 2.0, 0.1, 0, 1.02, 0, 0.5, 1.6, -0.1, 0.5, 1.6, -0.1, 0.9, 1.45, 0], 3)), new THREE.LineBasicMaterial({ color: 0x3a2a20 }));
    tv.add(ant);
    // barnacles
    const r = rng(8), bg = new THREE.SphereGeometry(0.07, 6, 5), bm = new THREE.MeshLambertMaterial({ color: 0xcfc8b4 });
    for (let i = 0; i < 26; i++) {
      const b = new THREE.Mesh(bg, bm);
      const side = r();
      if (side < 0.5) b.position.set(-1.35 + r() * 2.7, 1.03, -0.8 + r() * 1.6);
      else b.position.set(r() < 0.5 ? -1.36 : 1.36, -1 + r() * 2, -0.8 + r() * 1.6);
      b.scale.setScalar(0.6 + r() * 1.2);
      tv.add(b);
    }
    // lashings up to the anchor line
    const lash = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-1.3, 1.02, 0.6, 0.1, 2.5, -0.2, 1.3, 1.02, 0.6, 0.1, 2.5, -0.2, -1.3, 1.02, -0.6, 0.1, 2.5, -0.2, 1.3, 1.02, -0.6, 0.1, 2.5, -0.2], 3)), new THREE.LineBasicMaterial({ color: 0x8a744e }));
    tv.add(lash);
    tvGlow.position.set(-0.2, 0, 1.6);
    tv.add(tvGlow);
    tv.position.copy(TV);
    scene.add(tv);

    remote.add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.95, 0.12), new THREE.MeshLambertMaterial({ color: 0x24353b })));
    const dots = [[0, 0.34, 0xe05a3a], [-0.08, 0.14, 0xd7e3df], [0.08, 0.14, 0xd7e3df], [-0.08, -0.02, 0xd7e3df], [0.08, -0.02, 0xd7e3df], [0, -0.24, 0xf0c04a]];
    dots.forEach(([x, y, c]) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 8), new THREE.MeshLambertMaterial({ color: c })); d.rotation.x = Math.PI / 2; d.position.set(x, y, 0.07); remote.add(d); });
    const cord = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0.47, 0, 0, 1.25, 0], 3)), new THREE.LineBasicMaterial({ color: 0x8a744e }));
    remote.add(cord);
    remote.position.set(2.0, -1.55, 0.5);
    tv.add(remote);
  }

  // ---------- fish that school in patterns ----------
  const fishGeo = (() => {
    const g = new THREE.BufferGeometry();
    const v = [0.5, 0, 0, 0, 0.17, 0, 0, -0.17, 0, 0, 0, 0.075, 0, 0, -0.075, -0.36, 0, 0, -0.62, 0.2, 0, -0.62, -0.2, 0];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setIndex([0, 1, 3, 0, 3, 2, 0, 4, 1, 0, 2, 4, 1, 5, 3, 3, 5, 2, 1, 4, 5, 4, 2, 5, 5, 6, 7, 5, 7, 6]);
    g.computeVertexNormals();
    return g;
  })();
  const shapes = [
    // a ball that turns on itself
    (u, v, t, o) => { const a = u * 6.283 + t * 0.6, r = 2.3 + 0.6 * Math.sin(v * 6.283 + t); return o.set(Math.cos(a) * r, Math.sin(v * 6.283 + t * 0.9) * 1.1, Math.sin(a) * r); },
    // a ribbon tied in a figure of eight
    (u, v, t, o) => { const s = u * 6.283 + t * 0.55; return o.set(Math.sin(s) * 5, Math.sin(2 * s) * 1.4 + (v - 0.5) * 1.1, Math.cos(s) * 1.8 + (v - 0.5) * 1.2); },
    // a spiral column
    (u, v, t, o) => { const a = u * 22 + t * 0.9; return o.set(Math.cos(a) * (1.1 + v * 1.1), (u - 0.5) * 7.5, Math.sin(a) * (1.1 + v * 1.1)); },
    // a travelling wave
    (u, v, t, o) => { const w = (u + t * 0.04) % 1; return o.set((w - 0.5) * 10, Math.sin(w * 7 + t * 1.1) * 1.2 + (v - 0.5) * 1.6, (v - 0.5) * 2.8 + Math.cos(w * 5 + t) * 0.7); }
  ];
  function school({ n, y, x, z, tint, scale, speed, seed }) {
    const mesh = new THREE.InstancedMesh(fishGeo, new THREE.MeshLambertMaterial({ flatShading: true }), n);
    mesh.frustumCulled = false;
    const r = rng(seed);
    const fish = [], col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      fish.push({ u: r(), v: r(), jx: (r() - 0.5) * 0.5, jy: (r() - 0.5) * 0.5, jz: (r() - 0.5) * 0.5, s: scale * (0.8 + r() * 0.5), p: new THREE.Vector3(), ready: false });
      col.set(tint[Math.floor(r() * tint.length)]);
      mesh.setColorAt(i, col);
    }
    scene.add(mesh);
    return { mesh, fish, y, x, z, speed, seed };
  }
  const schools = [
    school({ n: calm ? 90 : 230, y: -8.5, x: 0.5, z: 13, tint: [0xd9e6ea, 0xa9c8d6, 0xf2d27a, 0xbfd9de], scale: 0.42, speed: 1, seed: 12 }),
    school({ n: calm ? 50 : 120, y: -32, x: 4.5, z: 9, tint: [0xf08a4b, 0xf6b25e, 0xe8703a], scale: 0.34, speed: 0.8, seed: 40 })
  ];
  const fa = new THREE.Vector3(), fb = new THREE.Vector3(), fo = new THREE.Object3D(), fc = new THREE.Vector3();
  function updateSchool(S, t) {
    const T = t * S.speed + S.seed;
    // hold a pattern, then melt into the next
    const cycle = 13, k = Math.floor(T / cycle), f = (T % cycle) / cycle;
    const mix = f < 0.74 ? 0 : (f - 0.74) / 0.26;
    const e = mix * mix * (3 - 2 * mix);
    const A = shapes[k % shapes.length], Bn = shapes[(k + 1) % shapes.length];
    fc.set(S.x + Math.sin(T * 0.11) * 3.2, S.y + Math.sin(T * 0.07) * 1.6, S.z + Math.cos(T * 0.09) * 2.4);
    for (let i = 0; i < S.fish.length; i++) {
      const q = S.fish[i];
      A(q.u, q.v, T, fa); Bn(q.u, q.v, T, fb);
      fa.lerp(fb, e).add(fc);
      fa.x += q.jx; fa.y += q.jy; fa.z += q.jz;
      if (!q.ready) { q.p.copy(fa); q.ready = true; }
      fo.position.copy(fa);
      fb.subVectors(fa, q.p);
      if (fb.lengthSq() > 1e-7) {
        // the model's nose points along +x
        fo.rotation.set(0, Math.atan2(-fb.z, fb.x), Math.atan2(fb.y, Math.hypot(fb.x, fb.z)));
      }
      fo.scale.setScalar(q.s);
      fo.updateMatrix();
      S.mesh.setMatrixAt(i, fo.matrix);
      q.p.copy(fa);
    }
    S.mesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- jellyfish ----------
  const jellies = [];
  {
    const bell = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const r = rng(64);
    const tints = [0xffb3c8, 0xc9b6ff, 0x9fe8ff, 0xffd0a6];
    const n = calm ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const c = tints[i % tints.length];
      const outer = new THREE.Mesh(bell, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }));
      const inner = new THREE.Mesh(bell, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false }));
      inner.scale.setScalar(0.62);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: c, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(4.2);
      g.add(outer, inner, halo);
      const tent = [];
      for (let k = 0; k < 6; k++) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(11 * 3), 3));
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.7 }));
        line.userData = { a: (k / 6) * 6.283, len: 1.8 + r() * 1.6 };
        line.frustumCulled = false;
        g.add(line);
        tent.push(line);
      }
      const s = 0.38 + r() * 0.5;
      g.scale.setScalar(s);
      const home = new THREE.Vector3(-7 + r() * 16, -5 - (i / n) * 33 - r() * 3, 4 + r() * 11);
      g.position.copy(home);
      scene.add(g);
      jellies.push({ g, outer, inner, halo, tent, home, ph: r() * 6.28, rate: 0.7 + r() * 0.5 });
    }
  }

  // ---------- drifting specks and bubbles ----------
  const SNOW = calm ? 220 : 620;
  const snowGeo = new THREE.BufferGeometry();
  {
    const p = new Float32Array(SNOW * 3), r = rng(5);
    for (let i = 0; i < SNOW; i++) { p[i * 3] = (r() - 0.5) * 34; p[i * 3 + 1] = (r() - 0.5) * 22; p[i * 3 + 2] = r() * 26; }
    snowGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  }
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ map: dot, size: 0.09, transparent: true, opacity: 0.6, depthWrite: false, color: 0xeaffff }));
  snow.frustumCulled = false;
  scene.add(snow);

  const NB = 240;
  const bub = { p: new Float32Array(NB * 3), v: new Float32Array(NB), life: new Float32Array(NB), i: 0 };
  const bubGeo = new THREE.BufferGeometry();
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bub.p, 3));
  for (let i = 0; i < NB; i++) bub.p[i * 3 + 1] = 999;
  const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ map: bubbleDot(), size: 0.22, transparent: true, opacity: 0.85, depthWrite: false }));
  bubbles.frustumCulled = false;
  scene.add(bubbles);
  function bubble(x, y, z, speed) {
    const i = bub.i; bub.i = (i + 1) % NB;
    bub.p[i * 3] = x; bub.p[i * 3 + 1] = y; bub.p[i * 3 + 2] = z;
    bub.v[i] = speed; bub.life[i] = 1;
  }

  // ---------- the boat we start on ----------
  const boat = new THREE.Group();
  const BOAT = new THREE.Vector3(0, 0, 26.2);
  {
    const out = new THREE.Shape();
    out.moveTo(-1.7, 2.2); out.lineTo(1.7, 2.2); out.quadraticCurveTo(1.75, -0.6, 0, -3.3); out.quadraticCurveTo(-1.75, -0.6, -1.7, 2.2);
    const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(out, { depth: 0.16, bevelEnabled: false }).rotateX(Math.PI / 2), woodLight);
    deck.position.y = 0.62;
    boat.add(deck);
    const rimPts = out.getPoints(40).map((p) => new THREE.Vector3(p.x, 0.86, p.y));
    boat.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 80, 0.11, 6, true), new THREE.MeshLambertMaterial({ map: wood, color: 0xf0d2a8 })));
    // inner planking that rises to the rim
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(out, { depth: 0.3, bevelEnabled: false }).rotateX(Math.PI / 2), woodMat);
    wall.position.y = 0.9; wall.scale.set(1.03, 1, 1.02);
    wall.material = new THREE.MeshLambertMaterial({ map: wood, color: 0xc9a67a, side: THREE.BackSide });
    boat.add(wall);
    // the hull, seen from below once you are in the water
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5a4632, map: wood }));
    hull.scale.set(1.8, 1.1, 3.4);
    hull.position.set(0, 0.6, -0.4);
    boat.add(hull);
    // the diver's legs and fins stretched out toward the bow: this is your view
    const suit = new THREE.MeshLambertMaterial({ color: 0x2a3f47 });
    const finMat = new THREE.MeshLambertMaterial({ color: 0xf2b84b, side: THREE.DoubleSide });
    const finShape = new THREE.Shape();
    finShape.moveTo(-0.1, 0); finShape.lineTo(0.1, 0); finShape.lineTo(0.27, -0.95); finShape.quadraticCurveTo(0, -1.12, -0.27, -0.95); finShape.lineTo(-0.1, 0);
    [-1, 1].forEach((side) => {
      const x = side * 0.42;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.075, 2.6, 10), suit);
      leg.rotation.x = Math.PI / 2 - 0.03;
      leg.position.set(x, 0.9, 0.6);
      boat.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.13, 0.42), suit);
      foot.position.set(x, 0.9, -0.82);
      boat.add(foot);
      const fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.04, bevelEnabled: false }).rotateX(Math.PI / 2), finMat);
      fin.position.set(x, 0.9, -0.95);
      fin.rotation.set(-0.06, -side * 0.2, 0);
      boat.add(fin);
      // two ribs along each blade
      [-0.07, 0.07].forEach((o) => {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.9), suit);
        rib.position.set(x + o - side * 0.09, 0.925, -1.45);
        rib.rotation.y = -side * 0.2 + o * 1.4;
        boat.add(rib);
      });
    });
    boat.position.copy(BOAT);
    scene.add(boat);
  }

  // ---------- the duck ----------
  const duck = new THREE.Group();
  const duckBody = new THREE.Group();
  {
    const yellow = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.32, metalness: 0, emissive: 0x7a5a00, emissiveIntensity: 0.75 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), yellow);
    body.scale.set(1, 0.76, 1.24); body.position.y = 0.2;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 12), yellow);
    tail.position.set(0, 0.4, -0.47); tail.rotation.x = -0.9;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 22, 16), yellow);
    head.position.set(0, 0.66, 0.26);
    const beak = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf0652f, roughness: 0.4, emissive: 0x6a2408, emissiveIntensity: 0.6 }));
    beak.scale.set(1.05, 0.42, 1.1); beak.position.set(0, 0.6, 0.53);
    duckBody.add(body, tail, head, beak);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x10262b });
    [-1, 1].forEach((s) => {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), yellow);
      wing.scale.set(0.35, 0.6, 1.15); wing.position.set(s * 0.39, 0.27, -0.05);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.043, 10, 8), eyeMat);
      eye.position.set(s * 0.125, 0.75, 0.47);
      duckBody.add(wing, eye);
    });
    duckBody.position.y = -0.3;
    duck.add(duckBody);
    duck.scale.setScalar(0.9);
    scene.add(duck);
  }
  const d = { off: new THREE.Vector3(1.4, -0.4, 0), target: new THREE.Vector3(1.4, -0.4, 0), vel: new THREE.Vector3(), yaw: 0.4, pitch: 0, idle: 0, bubT: 0 };

  // ---------- camera ----------
  const START = new THREE.Vector3(0, 1.78, 28.1);
  const look = new THREE.Vector3(0, 0.9, 0);
  const lookWant = new THREE.Vector3();
  let W = 1, H = 1, portrait = false, camX = 0;
  let mode = 'surface', diveT = 0, diveDone = null, splashed = false;
  let depthWant = -3, depth = -3, mouseX = 0, mouseY = 0;
  const DIVE_Z = 21;
  const proj = new THREE.Vector3();
  const toScreen = (v, out) => { proj.copy(v).project(camera); out.x = (proj.x + 1) * 0.5 * W; out.y = (1 - proj.y) * 0.5 * H; out.z = proj.z; return out; };

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    portrait = W / H < 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = portrait ? 62 : 50;
    camera.updateProjectionMatrix();
    // on a phone the camera slides right, so the TV sits in the middle
    camX = portrait ? 2.5 : 0;
    wreck.position.set(portrait ? 7 : 10.5, SEABED_Y - 0.6, -3);
    // the remote hangs beside the TV on a wide screen and under it on a tall one
    remote.position.set(portrait ? 0.55 : 2.0, portrait ? -1.85 : -1.55, 0.5);
  }

  const shallow = new THREE.Color(0x56cfc4), mid = new THREE.Color(0x1f8a9c), deep = new THREE.Color(0x06293c), haze = new THREE.Color(0xf6dcc0);
  const tmpC = new THREE.Color();
  function water(y) {
    // warm and clear near the top, darker and bluer the further down you go
    const k = Math.min(1, Math.max(0, -y / 42));
    if (k < 0.5) tmpC.copy(shallow).lerp(mid, k * 2); else tmpC.copy(mid).lerp(deep, (k - 0.5) * 2);
    return k;
  }

  const sA = { x: 0, y: 0, z: 0 }, sB = { x: 0, y: 0, z: 0 }, sC = { x: 0, y: 0, z: 0 }, sD = { x: 0, y: 0, z: 0 };
  const wv = new THREE.Vector3(), ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let last = performance.now(), raf = 0, running = false, tvOn = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = Math.min(0.3, (now - last) / 1000);
    const dt = Math.min(0.05, real);
    last = now;
    const t = (U.uTime.value += dt * (calm ? 0.5 : 1));

    // ----- camera -----
    if (mode === 'surface') {
      const bob = Math.sin(t * 0.9) * 0.035;
      camera.position.set(START.x + camX * 0.0, START.y + bob, START.z);
      lookWant.set(mouseX * 1.2, 0.72 - mouseY * 0.35 + bob * 0.5, 0);
      look.lerp(lookWant, Math.min(1, dt * 3));
      camera.up.set(Math.sin(t * 0.7) * 0.012, 1, 0);
      boat.position.y = Math.sin(t * 0.9) * 0.03;
      boat.rotation.z = Math.sin(t * 0.7) * 0.012;
    } else if (mode === 'diving') {
      diveT += real / (calm ? 0.6 : 2.3);
      const k = Math.min(1, diveT);
      const e = k * k * (3 - 2 * k);
      // lean out, tip over the bow, through the surface, level off below
      const lean = Math.min(1, k / 0.3);
      const fall = Math.max(0, (k - 0.2) / 0.8);
      const fe = fall * fall * (3 - 2 * fall);
      camera.position.set(
        START.x + (camX - START.x) * fe,
        START.y + Math.sin(lean * Math.PI) * 0.15 + (-3 - START.y) * fe * fe,
        START.z + (DIVE_Z - START.z) * (0.25 * lean + 0.75 * fe)
      );
      lookWant.set(camX * e, 0.7 - 9 * Math.sin(Math.min(1, k / 0.75) * Math.PI) * 0.75 + (-3.6 - 0.7) * e, 0);
      look.lerp(lookWant, Math.min(1, real * 7));
      camera.up.set(0, 1, 0);
      if (!splashed && camera.position.y < 0.12) {
        splashed = true;
        for (let i = 0; i < 150; i++) bubble(camera.position.x + (Math.random() - 0.5) * 5, -0.4 - Math.random() * 3.5, camera.position.z - 1 - Math.random() * 5, 1.4 + Math.random() * 3);
        if (onSplash) onSplash();
      }
      if (k >= 1) {
        mode = 'under'; depth = -3;
        const done = diveDone; diveDone = null;
        if (done) done();
      }
    } else {
      depth += (depthWant - depth) * Math.min(1, dt * 4.5);
      camera.position.set(camX + sway(t, 1) * 0.14 + mouseX * 0.35, depth + sway(t, 3) * 0.07, DIVE_Z);
      lookWant.set(camX + (wreck.position.x - camX) * 0.1 + mouseX * 0.8, depth - 0.7 - mouseY * 0.5, 0);
      look.lerp(lookWant, Math.min(1, dt * 4));
      camera.up.set(sway(t, 5) * 0.008, 1, 0);
    }
    camera.lookAt(look);
    camera.updateMatrixWorld();

    // ----- water color, light and fog for this depth -----
    const cy = camera.position.y;
    const under = cy < 0;
    if (under) {
      const k = water(cy);
      fog.color.copy(tmpC); fog.density = 0.026 + k * 0.016;
      U.uLight.value = 1 - k * 0.72;
      hemi.intensity = 1.6 - k * 0.55; sun.intensity = 2.2 - k * 1.5;
      hemi.color.setRGB(0.8 - k * 0.3, 0.96 - k * 0.2, 0.95);
      rayMat.uniforms.uStrength.value = Math.max(0, 1 - k * 1.05);
    } else {
      fog.color.copy(haze); fog.density = 0.006;
      U.uLight.value = 1; hemi.intensity = 1.7; sun.intensity = 2.4; hemi.color.set(0xfff4e6);
      rayMat.uniforms.uStrength.value = 0;
    }
    U.uFogColor.value.copy(fog.color);
    U.uFogDensity.value = fog.density;
    renderer.setClearColor(fog.color);
    sky.position.copy(camera.position);
    sky.visible = !under;
    rays.position.set(camera.position.x, 0, camera.position.z - 14);
    rays.visible = under;
    snow.visible = bubbles.visible = under;

    // ----- everything that hangs sways to the one current -----
    tv.rotation.set(sway(t, 0.4) * 0.03, -0.18 + sway(t, 2.2) * 0.07, sway(t, 1.1) * 0.035);
    tv.position.x = TV.x + sway(t, 0.9) * 0.08;
    remote.rotation.set(0, sway(t, 3.1) * 0.35, sway(t, 2.4) * 0.16);
    tvGlow.intensity += (tvOn * (5 + Math.sin(t * 21) * 0.5) - tvGlow.intensity) * Math.min(1, dt * 6);
    tv.userData.glass.material.color.setRGB(0.024 + tvOn * 0.03, 0.094 + tvOn * 0.2, 0.11 + tvOn * 0.2);
    for (const s of sails) {
      const p = s.geometry.attributes.position, b = s.userData.base;
      for (let i = 0; i < p.count; i++) {
        const y = b[i * 3 + 1], hang = -y / s.userData.h;
        p.setZ(i, (sway(t, b[i * 3] * 0.5 + hang * 2) * 0.5 + Math.sin(t * 0.9 + b[i * 3] * 1.3 + y) * 0.12) * hang);
      }
      p.needsUpdate = true;
    }

    for (const S of schools) updateSchool(S, t);

    for (const j of jellies) {
      // one slow squeeze, then glide
      const beat = Math.sin(t * j.rate + j.ph);
      const squeeze = Math.max(0, beat);
      j.outer.scale.set(1 - squeeze * 0.16, 1 + squeeze * 0.14, 1 - squeeze * 0.16);
      j.inner.scale.set(0.62 - squeeze * 0.08, 0.62 + squeeze * 0.1, 0.62 - squeeze * 0.08);
      j.g.position.set(j.home.x + sway(t, j.ph) * 0.9, j.home.y + Math.sin(t * j.rate * 0.5 + j.ph) * 0.9 + squeeze * 0.12, j.home.z + sway(t, j.ph * 2) * 0.5);
      j.g.rotation.z = sway(t, j.ph * 1.3) * 0.12;
      j.halo.material.opacity = 0.12 + (1 - U.uLight.value) * 0.5;
      for (const line of j.tent) {
        const p = line.geometry.attributes.position, a = line.userData.a, len = line.userData.len;
        for (let k = 0; k <= 10; k++) {
          const f = k / 10;
          const wob = Math.sin(t * 1.3 - f * 4 + a * 2 + j.ph) * 0.22 * f;
          p.setXYZ(k, Math.cos(a) * (0.62 - f * 0.25) + wob, 0.25 - f * len - squeeze * 0.2 * f, Math.sin(a) * (0.62 - f * 0.25) + wob * 0.6);
        }
        p.needsUpdate = true;
      }
    }

    // specks drift down and wrap around the camera
    {
      const p = snowGeo.attributes.position.array;
      const cx = camera.position.x, cz = camera.position.z;
      for (let i = 0; i < SNOW; i++) {
        let y = p[i * 3 + 1] - dt * 0.12;
        const rel = y - cy;
        if (rel < -11) y += 22; else if (rel > 11) y -= 22;
        p[i * 3 + 1] = y;
        p[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.05;
        if (p[i * 3] - cx > 17) p[i * 3] -= 34; else if (p[i * 3] - cx < -17) p[i * 3] += 34;
        if (p[i * 3 + 2] > cz + 2) p[i * 3 + 2] -= 26;
      }
      snowGeo.attributes.position.needsUpdate = true;
    }
    // bubbles rise, wobble, and pop at the surface
    for (let i = 0; i < NB; i++) {
      if (bub.life[i] <= 0) continue;
      bub.p[i * 3 + 1] += bub.v[i] * dt;
      bub.p[i * 3] += Math.sin(t * 3 + i) * dt * 0.25;
      bub.life[i] -= dt * 0.16;
      if (bub.p[i * 3 + 1] > -0.1 || bub.life[i] <= 0) { bub.life[i] = 0; bub.p[i * 3 + 1] = 999; }
    }
    bubGeo.attributes.position.needsUpdate = true;
    if (under && !calm && Math.random() < dt * 1.5) bubble(-6 + Math.random() * 16, SEABED_Y + 0.5, 6 + Math.random() * 10, 0.9 + Math.random() * 0.8);

    // ----- the duck -----
    if (mode === 'surface') {
      duck.position.set(BOAT.x + 2.6 + sway(t, 2) * 0.2, -0.02 + Math.sin(t * 1.4) * 0.04, BOAT.z - 3.4);
      duck.rotation.set(Math.sin(t * 1.1) * 0.05, 0.9 + sway(t, 1) * 0.3, Math.sin(t * 1.4) * 0.06);
      duckBody.position.y = -0.08;
    } else {
      duckBody.position.y += (-0.3 - duckBody.position.y) * Math.min(1, dt * 3);
      d.idle += dt;
      if (d.idle > 4) {
        // left alone, it pootles about
        d.target.set(Math.sin(t * 0.21) * 2.4 + 0.6, Math.sin(t * 0.33) * 1.0 - 0.3, 0);
      }
      wv.subVectors(d.target, d.off);
      const dist = wv.length();
      const sp = dist > 0.5 ? Math.min(4.2, (dist - 0.5) * 2.2 + 0.2) : 0;
      if (dist > 0.001) wv.multiplyScalar(sp / dist);
      d.vel.lerp(wv, 1 - Math.exp(-dt * 2.6));
      d.off.addScaledVector(d.vel, dt);
      const speed = d.vel.length();
      if (speed > 0.1) {
        let dy = Math.atan2(d.vel.x, 0.9) - d.yaw;
        d.yaw += dy * Math.min(1, dt * 4);
        d.pitch += (Math.max(-0.6, Math.min(0.6, -d.vel.y * 0.3)) - d.pitch) * Math.min(1, dt * 4);
      } else {
        d.pitch *= Math.exp(-dt * 2);
      }
      const dz = mode === 'diving' ? 4.6 : 5.6;
      duck.position.set(camera.position.x + d.off.x, camera.position.y + d.off.y + sway(t, 4) * 0.06, camera.position.z - dz);
      duck.rotation.set(d.pitch, d.yaw, Math.sin(t * 1.3) * 0.08 - d.vel.x * 0.05);
      d.bubT -= dt;
      if (under && speed > 0.7 && d.bubT <= 0) { d.bubT = 0.22; bubble(duck.position.x, duck.position.y + 0.2, duck.position.z - 0.2, 1 + Math.random()); }
    }

    renderer.render(scene, camera);

    // ----- tell the page where the TV screen, the remote and the duck are -----
    if (onTv) {
      tv.updateMatrixWorld();
      toScreen(wv.copy(tvMarks.l).applyMatrix4(tv.matrixWorld), sA);
      toScreen(wv.copy(tvMarks.r).applyMatrix4(tv.matrixWorld), sB);
      toScreen(wv.copy(tvMarks.t).applyMatrix4(tv.matrixWorld), sC);
      toScreen(wv.copy(tvMarks.b).applyMatrix4(tv.matrixWorld), sD);
      const visible = under && sA.z < 1 && Math.abs(cy - TV.y) < 9;
      onTv({ x: (sA.x + sB.x) / 2, y: (sC.y + sD.y) / 2, w: Math.hypot(sB.x - sA.x, sB.y - sA.y), h: Math.hypot(sD.x - sC.x, sD.y - sC.y), rot: Math.atan2(sB.y - sA.y, sB.x - sA.x), visible });
      remote.getWorldPosition(wv);
      toScreen(wv, sA);
      wv.y += 0.5;
      toScreen(wv, sB);
      onRemote({ x: sA.x, y: sA.y, r: Math.abs(sB.y - sA.y) * 1.5, visible });
    }
    if (onDuck) onDuck(-cy);
  }

  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  layout();
  camera.position.copy(START);
  camera.lookAt(look);

  return {
    start, stop, layout,
    // depth in metres below the surface that the camera should settle at
    setDepth(y) { depthWant = -Math.max(3, y); },
    isUnder: () => mode === 'under',
    dive(done) {
      if (mode !== 'surface') { if (done) done(); return; }
      mode = 'diving'; diveT = 0; splashed = false; diveDone = done;
    },
    // skip the boat entirely (page reloaded half way down)
    plunge() { mode = 'under'; depth = depthWant; look.set(camX, depthWant - 0.7, 0); },
    setTv(on) { tvOn = on ? 1 : 0; },
    pointerMove(px, py) {
      mouseX = (px / W) * 2 - 1; mouseY = (py / H) * 2 - 1;
      if (mode === 'surface') return;
      ndc.set(mouseX, -mouseY);
      ray.setFromCamera(ndc, camera);
      const k = -5.6 / ray.ray.direction.z;
      d.target.set(ray.ray.direction.x * k, ray.ray.direction.y * k, 0);
      d.idle = 0;
    },
    tap(px, py) {
      if (mode !== 'under') return;
      ndc.set((px / W) * 2 - 1, -((py / H) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      const k = -5.6 / ray.ray.direction.z;
      d.target.set(ray.ray.direction.x * k, ray.ray.direction.y * k, 0);
      d.idle = 0;
      const o = ray.ray.origin, dir = ray.ray.direction;
      for (let i = 0; i < 7; i++) bubble(o.x + dir.x * 5 + (Math.random() - 0.5) * 0.5, o.y + dir.y * 5 + (Math.random() - 0.5) * 0.5, o.z + dir.z * 5, 1 + Math.random() * 1.6);
    },
    burst() {
      for (let i = 0; i < 40; i++) bubble(duck.position.x + (Math.random() - 0.5) * 1.5, duck.position.y + (Math.random() - 0.5), duck.position.z, 1.2 + Math.random() * 2);
    },
    // a small copy of the rust, for the page to use on its plates
    rustImage() { return rust.image.toDataURL('image/jpeg', 0.8); }
  };
}
