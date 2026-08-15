import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// ═══════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════

const CFG = {
  laneWidth: 1.8,
  laneLength: 18,
  laneY: 0,
  gutterWidth: 0.25,
  gutterDepth: 0.06,
  ballRadius: 0.14,
  ballMass: 6,
  pinHeight: 0.38,
  pinBottomR: 0.055,
  pinTopR: 0.03,
  pinMass: 1.5,
  pinSpacing: 0.30,
  pinZStart: -7.5,
  pinZOffset: 0.26,       // sqrt(3)/2 * pinSpacing
  ballStartX: 0,
  ballStartZ: 1.8,
  maxPower: 18,
  minPower: 4,
  dragPowerScale: 0.08,
  settleTimeout: 2500,     // ms to wait before counting pins
};

// ═══════════════════════════════════════════
//  THREE.JS SETUP
// ═══════════════════════════════════════════

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 20, 35);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.5, 3.5);
camera.lookAt(0, 0.1, -1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

// ── Lights ──
const ambient = new THREE.AmbientLight(0x404060, 0.5);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffeedd, 2.5);
dirLight.position.set(5, 12, 2);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 25;
dirLight.shadow.camera.left = -6;
dirLight.shadow.camera.right = 6;
dirLight.shadow.camera.top = 6;
dirLight.shadow.camera.bottom = -6;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
fillLight.position.set(-3, 4, -5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
rimLight.position.set(0, 1, 6);
scene.add(rimLight);

// ── Environment ──
// Simple procedurally generated wood texture
function makeWoodTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c4a265';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) {
    const y = Math.random() * h;
    ctx.strokeStyle = `rgba(139,90,43,${0.05 + Math.random() * 0.25})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(w * 0.5, y + (Math.random() - 0.5) * 15, w, y + (Math.random() - 0.5) * 15);
    ctx.stroke();
  }
  // subtle grain
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.01 + Math.random() * 0.03})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
  }
  return new THREE.CanvasTexture(c);
}

const woodTex = makeWoodTexture(512, 512);
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
woodTex.repeat.set(2, 6);

// ═══════════════════════════════════════════
//  PHYSICS WORLD
// ═══════════════════════════════════════════

const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.solver.iterations = 10;

const physicsMat = new CANNON.Material('default');
const contactMat = new CANNON.ContactMaterial(physicsMat, physicsMat, {
  friction: 0.4,
  restitution: 0.15,
});
world.addContactMaterial(contactMat);

// ═══════════════════════════════════════════
//  BUILD LANE
// ═══════════════════════════════════════════

const laneBody = new CANNON.Body({ mass: 0, material: physicsMat });
laneBody.addShape(new CANNON.Box(new CANNON.Vec3(CFG.laneWidth / 2, 0.05, CFG.laneLength / 2)));
laneBody.position.set(0, CFG.laneY - 0.05, -CFG.laneLength / 2 + 2);
world.addBody(laneBody);

// Visual lane
const laneGeo = new THREE.BoxGeometry(CFG.laneWidth, 0.03, CFG.laneLength);
const laneMat = new THREE.MeshStandardMaterial({
  map: woodTex,
  color: 0xd4a574,
  roughness: 0.6,
  metalness: 0.0,
});
const laneMesh = new THREE.Mesh(laneGeo, laneMat);
laneMesh.position.set(0, CFG.laneY, -CFG.laneLength / 2 + 2);
laneMesh.receiveShadow = true;
scene.add(laneMesh);

// Lane markings (arrows)
const arrowMat = new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.25 });
for (let i = -2; i <= 2; i++) {
  if (i === 0) continue;
  const x = i * 0.22;
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), arrowMat);
  arrow.position.set(x, CFG.laneY + 0.02, 1.0);
  arrow.rotation.x = -Math.PI / 2;
  scene.add(arrow);
}

// Lane dots
const dotMat = new THREE.MeshStandardMaterial({ color: 0x445566, transparent: true, opacity: 0.2 });
for (let i = -4; i <= 4; i++) {
  if (i === 0) continue;
  const x = i * 0.12;
  for (const z of [2.5, 2.8]) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), dotMat);
    dot.position.set(x, CFG.laneY + 0.015, z);
    dot.rotation.x = -Math.PI / 2;
    scene.add(dot);
  }
}

// Gutters
const gutterMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.9 });
for (const sign of [-1, 1]) {
  const gx = sign * (CFG.laneWidth / 2 + CFG.gutterWidth / 2);

  // Physics gutter
  const gutterBody = new CANNON.Body({ mass: 0, material: physicsMat });
  gutterBody.addShape(new CANNON.Box(new CANNON.Vec3(CFG.gutterWidth / 2, 0.03, CFG.laneLength / 2)));
  gutterBody.position.set(gx, CFG.laneY - CFG.gutterDepth, -CFG.laneLength / 2 + 2);
  world.addBody(gutterBody);

  // Visual gutter
  const gutterMesh = new THREE.Mesh(
    new THREE.BoxGeometry(CFG.gutterWidth, 0.04, CFG.laneLength),
    gutterMat
  );
  gutterMesh.position.set(gx, CFG.laneY - CFG.gutterDepth, -CFG.laneLength / 2 + 2);
  scene.add(gutterMesh);

  // Gutter wall
  const wallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.08, CFG.laneLength),
    new THREE.MeshStandardMaterial({ color: 0x225566 })
  );
  wallMesh.position.set(sign * (CFG.laneWidth / 2 + 0.015), CFG.laneY + 0.02, -CFG.laneLength / 2 + 2);
  scene.add(wallMesh);
}

// Back wall / pin deck area
const backWall = new THREE.Mesh(
  new THREE.BoxGeometry(CFG.laneWidth + 2 * CFG.gutterWidth, 0.5, 0.05),
  new THREE.MeshStandardMaterial({ color: 0x2a2a3e })
);
backWall.position.set(0, 0.25, -CFG.laneLength + 1.5);
scene.add(backWall);

// ═══════════════════════════════════════════
//  PINS
// ═══════════════════════════════════════════

const pinLayout = [
  { row: 0, col: 0 },       // 1  (front)
  { row: 1, col: -0.5 },    // 2
  { row: 1, col: 0.5 },     // 3
  { row: 2, col: -1 },      // 4
  { row: 2, col: 0 },       // 5
  { row: 2, col: 1 },       // 6
  { row: 3, col: -1.5 },    // 7
  { row: 3, col: -0.5 },    // 8
  { row: 3, col: 0.5 },     // 9
  { row: 3, col: 1.5 },     // 10
];

const PIN_NUMBERS = [null, '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

function createPinMesh() {
  const group = new THREE.Group();

  // Main body - use a lathe geometry for a nice pin shape
  const points = [];
  const segments = 16;
  const profile = [
    [0, 0],         // bottom
    [0.055, 0],
    [0.058, 0.01],
    [0.060, 0.03],
    [0.058, 0.05],
    [0.050, 0.08],
    [0.045, 0.12],
    [0.038, 0.18],
    [0.030, 0.25],
    [0.025, 0.30],
    [0.022, 0.34],
    [0.025, 0.36],
    [0.030, 0.38],
  ];

  for (const [r, y] of profile) {
    points.push(new THREE.Vector2(r, y));
  }
  const latheGeo = new THREE.LatheGeometry(points, segments);
  const pinMat = new THREE.MeshPhysicalMaterial({
    color: 0xeeeeff,
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.1,
  });
  const body = new THREE.Mesh(latheGeo, pinMat);
  body.castShadow = true;
  group.add(body);

  // Red stripe
  const stripeMat = new THREE.MeshPhysicalMaterial({
    color: 0xcc3333,
    roughness: 0.4,
    metalness: 0.0,
  });
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.050, 0.052, 0.025, segments),
    stripeMat
  );
  stripe.position.y = 0.12;
  group.add(stripe);

  return group;
}

function createPinBody() {
  const body = new CANNON.Body({ mass: CFG.pinMass, material: physicsMat });
  // Use a cylinder as approximation; offset COM upward
  body.addShape(
    new CANNON.Cylinder(CFG.pinTopR, CFG.pinBottomR, CFG.pinHeight, 12),
    new CANNON.Vec3(0, 0, 0)
  );
  // Raise center of mass slightly
  body.updateMassProperties();
  // Manually shift COM by adjusting inertia (approximate)
  // cannon-es doesn't easily let us shift COM; we'll just use the
  // cylinder shape and let physics handle it.
  body.sleepSpeedLimit = 0.1;
  return body;
}

let pins = []; // { mesh, body, fallen, id }
let activePins = [];

function initPins() {
  for (const p of activePins) {
    scene.remove(p.mesh);
    world.removeBody(p.body);
  }
  activePins = [];

  for (let i = 0; i < pinLayout.length; i++) {
    const pl = pinLayout[i];
    const x = pl.col * CFG.pinSpacing;
    const z = CFG.pinZStart + pl.row * CFG.pinZOffset;

    const mesh = createPinMesh();
    mesh.position.set(x, CFG.pinHeight / 2, z);
    scene.add(mesh);

    const body = createPinBody();
    body.position.set(x, CFG.pinHeight / 2, z);
    // Slight random quaternion for visual interest
    world.addBody(body);

    activePins.push({ mesh, body, fallen: false, id: i + 1 });
  }
}

// ═══════════════════════════════════════════
//  BALL
// ═══════════════════════════════════════════

const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(CFG.ballRadius, 32, 32),
  new THREE.MeshPhysicalMaterial({
    color: 0x4488cc,
    roughness: 0.10,
    metalness: 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.15,
    envMapIntensity: 0.8,
  })
);
ballMesh.castShadow = true;
scene.add(ballMesh);

// Three finger dots
const dotMatBall = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
for (const [dx, dy] of [[0.07, 0.04], [-0.04, 0.07], [-0.07, -0.02]]) {
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 8), dotMatBall);
  dot.position.set(dx, dy, CFG.ballRadius * 0.98);
  dot.rotation.y = 0;
  ballMesh.add(dot);
}

const ballBody = new CANNON.Body({ mass: CFG.ballMass, material: physicsMat });
ballBody.addShape(new CANNON.Sphere(CFG.ballRadius));
ballBody.sleepSpeedLimit = 0.05;
world.addBody(ballBody);

function resetBall() {
  ballBody.position.set(CFG.ballStartX, CFG.ballRadius + CFG.laneY, CFG.ballStartZ);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  ballBody.quaternion.set(0, 0, 0, 1);
}

resetBall();

// ═══════════════════════════════════════════
//  AUDIO (WebAudio synthesized, no external files)
// ═══════════════════════════════════════════

let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, dur, type = 'sine', vol = 0.3, delay = 0) {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime + delay;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) { /* ignore audio errors */ }
}
function playNoise(dur, vol = 0.3, delay = 0) {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime + delay;
    const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(g).connect(audioCtx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  } catch (e) { /* ignore audio errors */ }
}
const sfx = {
  throw: () => { initAudio(); playNoise(0.12, 0.25); playTone(90, 0.15, 'sine', 0.35); },
  hit:   () => { initAudio(); playTone(180, 0.09, 'triangle', 0.35); playTone(140, 0.09, 'triangle', 0.3, 0.04); },
  pinFall: () => { initAudio(); for (let i = 0; i < 6; i++) playNoise(0.06, 0.12, i * 0.035); },
  strike: () => { initAudio(); playTone(523, 0.16, 'sine', 0.3); playTone(659, 0.16, 'sine', 0.3, 0.11); playTone(784, 0.24, 'sine', 0.32, 0.22); },
  spare:  () => { initAudio(); playTone(440, 0.14, 'sine', 0.3); playTone(587, 0.2, 'sine', 0.3, 0.13); },
  over:   () => { initAudio(); playTone(392, 0.2, 'sine', 0.25); playTone(330, 0.25, 'sine', 0.25, 0.2); playTone(262, 0.4, 'sine', 0.25, 0.4); },
};

// ═══════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════

const State = {
  IDLE: 'idle',
  POWERING: 'powering',
  THROWING: 'throwing',
  SETTLING: 'settling',
  SCORING: 'scoring',
  GAME_OVER: 'game_over',
};

let state = State.IDLE;
let frame = 1;
let roll = 1;          // 1 or 2
let pinsFallen = 0;
let frameRoll1 = 0;    // pins down in first roll of current frame
let frameRoll2 = 0;    // pins down in second roll

// Scoring: standard 10 frames
const MAX_FRAMES = 10;
const frameScores = [];    // { roll1, roll2, score }
// We'll compute cumulative score after each frame

let power = 0;
let aimAngle = 0;
let mouseDownPos = null;
let isMouseDown = false;
let settleTimer = null;
let ballThrown = false;
let hitSoundPlayed = false;

// ═══════════════════════════════════════════
//  CONTROLS
// ═══════════════════════════════════════════

const el = renderer.domElement;
const powerMeter = document.getElementById('power-meter');
const powerFill = document.getElementById('power-fill');
const aimLine = document.getElementById('aim-line');

el.addEventListener('mousemove', (e) => {
  const rect = el.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1; // -1 to 1
  aimAngle = x * 0.8; // max aim angle ±46°

  if (state === State.IDLE || state === State.POWERING) {
    updateAimIndicators(aimAngle, state === State.POWERING ? power : 0);
  }

  if (state === State.POWERING && mouseDownPos) {
    const dy = e.clientY - mouseDownPos.y;
    power = Math.max(0, Math.min(1, dy * CFG.dragPowerScale));
    powerFill.style.height = `${power * 100}%`;
    // 满力时力量条变金红色提示
    powerFill.style.background = power > 0.95
      ? 'linear-gradient(to top, #ffd93d, #ff6b6b)'
      : 'linear-gradient(to top, #4ecdc4, #ff6b6b)';
  }
});

el.addEventListener('mousedown', (e) => {
  initAudio(); // unlock audio on user gesture
  if (state !== State.IDLE) return;
  if (e.button !== 0) return;
  isMouseDown = true;
  mouseDownPos = { x: e.clientX, y: e.clientY };
  state = State.POWERING;
  powerMeter.classList.add('visible');
  power = 0;
  powerFill.style.height = '0%';
});

el.addEventListener('mouseup', (e) => {
  if (state !== State.POWERING || !mouseDownPos) return;
  mouseDownPos = null;
  powerMeter.classList.remove('visible');

  if (power > 0.02) {
    throwBall();
  } else {
    state = State.IDLE;
  }
});

// Touch support
el.addEventListener('touchstart', (e) => {
  e.preventDefault();
  initAudio(); // unlock audio on user gesture
  const t = e.touches[0];
  if (state !== State.IDLE) return;
  isMouseDown = true;
  mouseDownPos = { x: t.clientX, y: t.clientY };
  state = State.POWERING;
  powerMeter.classList.add('visible');
  power = 0;
  powerFill.style.height = '0%';
}, { passive: false });

el.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (state !== State.POWERING || !mouseDownPos) return;
  const t = e.touches[0];
  const rect = el.getBoundingClientRect();
  const x = ((t.clientX - rect.left) / rect.width) * 2 - 1;
  aimAngle = x * 0.8;  // 与桌面端瞄准范围一致

  if (mouseDownPos) {
    const dy = t.clientY - mouseDownPos.y;
    power = Math.max(0, Math.min(1, dy * CFG.dragPowerScale));
    powerFill.style.height = `${power * 100}%`;
    powerFill.style.background = power > 0.95
      ? 'linear-gradient(to top, #ffd93d, #ff6b6b)'
      : 'linear-gradient(to top, #4ecdc4, #ff6b6b)';
    updateAimIndicators(aimAngle, power);
  }
}, { passive: false });

el.addEventListener('touchend', (e) => {
  e.preventDefault();
  if (state !== State.POWERING || !mouseDownPos) return;
  mouseDownPos = null;
  powerMeter.classList.remove('visible');
  if (power > 0.02) throwBall();
  else state = State.IDLE;
}, { passive: false });

// ── 落点指示环(3D,球道上的目标标记)──
const targetRing = new THREE.Mesh(
  new THREE.RingGeometry(0.16, 0.24, 32),
  new THREE.MeshBasicMaterial({ color: 0x4ecdc4, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
);
targetRing.rotation.x = -Math.PI / 2;
targetRing.position.y = CFG.laneY + 0.025;
targetRing.visible = false;
scene.add(targetRing);

function updateAimIndicators(angle, power) {
  // 落点环:球直线轨迹延长到瓶区前沿
  const targetZ = CFG.pinZStart + 1.5;
  const dz = CFG.ballStartZ - targetZ;
  let tx = CFG.ballStartX + Math.sin(angle) * dz;
  const maxX = CFG.laneWidth / 2 - 0.15;
  const clamped = Math.abs(tx) > maxX;
  tx = Math.max(-maxX, Math.min(maxX, tx));
  targetRing.position.set(tx, CFG.laneY + 0.025, targetZ);
  targetRing.visible = true;
  targetRing.material.color.set(clamped ? 0xff6b6b : 0x4ecdc4); // 会出界时变红预警
  targetRing.material.opacity = 0.35 + 0.65 * power;

  // 辅助线:长度与亮度随力度变化
  const len = 6 + power * 6;
  updateAimLine(CFG.ballStartX, CFG.ballStartZ, angle, len);
  aimLine.style.opacity = String(0.4 + 0.6 * power);
}

function updateAimLine(startX, startZ, angle, length) {
  const endX = startX + Math.sin(angle) * length;
  const endZ = startZ - Math.cos(angle) * length;

  // Ensure camera matrices are up-to-date for projection
  camera.updateMatrixWorld();

  const start3 = new THREE.Vector3(startX, CFG.laneY + 0.02, startZ);
  const end3 = new THREE.Vector3(endX, CFG.laneY + 0.02, endZ);
  start3.project(camera);
  end3.project(camera);

  const w = window.innerWidth;
  const h = window.innerHeight;
  const sx = (start3.x * 0.5 + 0.5) * w;
  const sy = (1 - (start3.y * 0.5 + 0.5)) * h;
  const ex = (end3.x * 0.5 + 0.5) * w;
  const ey = (1 - (end3.y * 0.5 + 0.5)) * h;

  // Skip if off-screen
  if (sx < 0 || sx > w || sy < 0 || sy > h) return;

  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.max(10, Math.sqrt(dx * dx + dy * dy));
  const angleDeg = Math.atan2(dx, -dy) * (180 / Math.PI);

  aimLine.style.cssText = `
    left:${sx}px;
    top:${sy}px;
    width:3px;
    height:${len}px;
    transform:rotate(${angleDeg}deg);
    transform-origin:0 0;
    opacity:1;
  `;
}

function hideAimLine() {
  aimLine.style.opacity = '0';
  targetRing.visible = false;
}

// ═══════════════════════════════════════════
//  THROW LOGIC
// ═══════════════════════════════════════════

function throwBall() {
  state = State.THROWING;
  hideAimLine();
  ballThrown = true;
  hitSoundPlayed = false;
  sfx.throw();

  const speed = CFG.minPower + power * (CFG.maxPower - CFG.minPower);
  const vx = Math.sin(aimAngle) * speed;
  const vz = -Math.cos(aimAngle) * speed;

  ballBody.velocity.set(vx, 0, vz);
  ballBody.angularVelocity.set(speed * 2, 0, 0);
  ballBody.wakeUp();

  updateHint('🎳 球出去了……');
}

// ═══════════════════════════════════════════
//  SETTLING & SCORING
// ═══════════════════════════════════════════

function startSettling() {
  state = State.SETTLING;
  updateHint('⏳ 等待中……');
  settleTimer = setTimeout(() => {
    countAndScore();
  }, CFG.settleTimeout);
}

function countAndScore() {
  // Count fallen pins
  let fallen = 0;
  for (const p of activePins) {
    if (isPinFallen(p)) {
      p.fallen = true;
      fallen++;
    }
  }

  pinsFallen = fallen;

  const isTenth = frame === MAX_FRAMES;

  if (roll === 1) {
    frameRoll1 = fallen;
    if (fallen === 10) {
      if (isTenth) {
        // 第 10 局全中:追加 2 球(重新摆满 10 瓶)
        frameScores[frame - 1] = { roll1: 'X', roll2: '', roll3: '', score: null, strike: true, spare: false };
        sfx.strike();
        updateScoreboard();
        updateHint('🔥 全中！STRIKE！追加投球 ×2');
        initPins();
        resetBall();
        roll = 2;
        state = State.IDLE;
        return;
      }
      // STRIKE! (1-9 局)
      frameScores[frame - 1] = { roll1: 'X', roll2: '', roll3: '', score: null, strike: true, spare: false };
      sfx.strike();
      updateScoreboard();
      updateHint('🔥 全中！STRIKE！');
      setTimeout(() => advanceFrame(), 1500);
      return;
    }
    // Set up for second roll
    roll = 2;
    removeFallenPins();
    resetBall();
    state = State.IDLE;
    if (fallen > 0) sfx.pinFall();
    updateHint(`🎳 还剩 ${10 - fallen} 个瓶 · 第二次投球`);
    updateScoreboard();
  } else if (roll === 2) {
    const f = frameScores[frame - 1];

    // 第 10 局 strike 后的追加球(满瓶 10 个)
    if (isTenth && f && f.strike) {
      f.roll2 = fallen === 10 ? 'X' : fallen;
      if (fallen > 0) sfx.pinFall();
      updateScoreboard();
      if (fallen === 10) {
        // 第二球也全中:第三球重新摆满
        updateHint('🔥 再全中！第三球');
        initPins();
        resetBall();
        roll = 3;
        state = State.IDLE;
      } else {
        // 第三球补剩余瓶
        updateHint(`🎳 还剩 ${10 - fallen} 个瓶 · 第三球`);
        removeFallenPins();
        resetBall();
        roll = 3;
        state = State.IDLE;
      }
      return;
    }

    // 第 10 局 spare 后的追加球(满瓶 10 个)
    if (isTenth && f && f.spare) {
      f.roll3 = fallen;
      f.score = 10 + fallen;
      if (fallen > 0) sfx.pinFall();
      updateScoreboard();
      calculateScores();
      updateHint(`🎳 追加球 ${fallen} 分 · 本局 ${f.score} 分`);
      setTimeout(() => advanceFrame(), 1500);
      return;
    }

    // Second roll (常规 + 第 10 局非特殊)
    const total = frameRoll1 + fallen;
    const fallenThisRoll = fallen;
    frameRoll2 = fallenThisRoll;

    if (total === 10) {
      if (isTenth) {
        // 第 10 局补中:追加 1 球(重新摆满 10 瓶)
        frameScores[frame - 1] = { roll1: frameRoll1, roll2: '/', roll3: '', score: null, strike: false, spare: true };
        sfx.spare();
        updateScoreboard();
        updateHint('✨ 补中！SPARE！追加投球');
        initPins();
        resetBall();
        roll = 3;
        state = State.IDLE;
        return;
      }
      // SPARE! (1-9 局)
      frameScores[frame - 1] = { roll1: frameRoll1 === 10 ? 'X' : frameRoll1, roll2: '/', roll3: '', score: null, strike: false, spare: true };
      sfx.spare();
      updateHint('✨ 补中！SPARE！');
    } else {
      frameScores[frame - 1] = { roll1: frameRoll1 === 10 ? 'X' : frameRoll1, roll2: fallenThisRoll, roll3: '', score: null, strike: false, spare: false };
      if (fallenThisRoll > 0) sfx.pinFall();
      updateHint(`💪 这局 ${total} 分`);
    }

    updateScoreboard();
    calculateScores();
    setTimeout(() => advanceFrame(), 1500);
  } else if (roll === 3) {
    // 第 10 局第三球(最终结算)
    const f = frameScores[frame - 1];
    f.roll3 = fallen;
    if (f.strike) {
      const r2 = typeof f.roll2 === 'number' ? f.roll2 : 10;
      f.score = 10 + r2 + fallen;
    } else {
      f.score = 10 + fallen;
    }
    if (fallen > 0) sfx.pinFall();
    updateScoreboard();
    calculateScores();
    updateHint(`🎳 本局 ${f.score} 分`);
    setTimeout(() => advanceFrame(), 1500);
  }
}

function isPinFallen(pin) {
  // Check if pin angle is > 20 degrees from vertical
  const up = new CANNON.Vec3(0, 1, 0);
  const pinUp = new CANNON.Vec3(0, 1, 0);
  pin.body.quaternion.vmult(pinUp, pinUp);
  const dot = Math.min(1, Math.max(-1, up.dot(pinUp)));
  const angle = Math.acos(dot);
  if (angle > 0.35) return true; // ~20 degrees

  // Also check if pin has moved far from its starting position (knocked off)
  const dx = pin.body.position.x - pin.mesh.position.x;
  const dz = pin.body.position.z - pin.mesh.position.z;
  if (Math.sqrt(dx * dx + dz * dz) > 0.3) return true;

  return false;
}

function removeFallenPins() {
  const standing = [];
  for (const p of activePins) {
    if (p.fallen) {
      scene.remove(p.mesh);
      world.removeBody(p.body);
    } else {
      standing.push(p);
    }
  }
  activePins = standing;

  // Rebuild remaining pins (reset their positions to original)
  // Since we kept the non-fallen pins, we just need to reset their positions
  // Actually they might have shifted slightly - reset them
  for (const p of activePins) {
    const pl = pinLayout[p.id - 1];
    const x = pl.col * CFG.pinSpacing;
    const z = CFG.pinZStart + pl.row * CFG.pinZOffset;
    p.body.position.set(x, CFG.pinHeight / 2, z);
    p.body.velocity.set(0, 0, 0);
    p.body.angularVelocity.set(0, 0, 0);
    p.body.quaternion.set(0, 0, 0, 1);
    p.body.wakeUp();
  }
}

function advanceFrame() {
  if (frame >= MAX_FRAMES) {
    // Game over
    state = State.GAME_OVER;
    showGameOver();
    return;
  }

  frame++;
  roll = 1;
  frameRoll1 = 0;
  frameRoll2 = 0;
  pinsFallen = 0;

  // Reset all pins
  initPins();
  resetBall();
  ballThrown = false;
  state = State.IDLE;

  updateHint(`🎳 第 ${frame} 局 · 第一次投球`);
  updateScoreboard();
}

// ═══════════════════════════════════════════
//  SCORING
// ═══════════════════════════════════════════

function calculateScores() {
  let cum = 0;
  for (let i = 0; i < MAX_FRAMES; i++) {
    const f = frameScores[i];
    if (!f) break;

    if (f.strike) {
      if (i === MAX_FRAMES - 1) {
        // 第 10 局全中:10 + 追加两球
        const r2 = typeof f.roll2 === 'number' ? f.roll2 : 10;
        const r3 = typeof f.roll3 === 'number' ? f.roll3 : 10;
        if (f.roll2 !== '' && f.roll3 !== '') f.score = 10 + r2 + r3;
      } else {
        const next1 = getRollValue(i, 0);
        const next2 = getRollValue(i, 1);
        if (next1 !== null && next2 !== null) {
          f.score = 10 + next1 + next2;
        }
      }
    } else if (f.spare) {
      if (i === MAX_FRAMES - 1) {
        // 第 10 局补中:10 + 追加一球
        if (f.roll3 !== '') f.score = 10 + (typeof f.roll3 === 'number' ? f.roll3 : 0);
      } else {
        const next = getRollValue(i, 0);
        if (next !== null) {
          f.score = 10 + next;
        }
      }
    } else {
      if (f.roll2 !== '') {
        const r1 = typeof f.roll1 === 'number' ? f.roll1 : 0;
        const r2 = typeof f.roll2 === 'number' ? f.roll2 : 0;
        f.score = r1 + r2;
      }
    }

    if (f.score !== null) cum += f.score;
    updateScoreboard();
  }
  document.getElementById('total-score').textContent = cum > 0 ? `总分: ${cum}` : '';
}

function getRollValue(frameIdx, offset) {
  // offset = 0: first roll after this frame
  // offset = 1: second roll
  const f = frameScores[frameIdx];
  if (!f) return null;

  if (f.strike) {
    if (offset === 0) {
      // Next frame's first roll
      const next = frameScores[frameIdx + 1];
      if (!next) return null;
      if (next.strike) return 10;
      return typeof next.roll1 === 'number' ? next.roll1 : 10;
    }
    if (offset === 1) {
      const next = frameScores[frameIdx + 1];
      if (!next) return null;
      if (next.strike) {
        // Two strikes in a row: need next frame's first and the following's first
        const next2 = frameScores[frameIdx + 2];
        if (!next2) return null;
        if (next2.strike) return 20;
        return 10 + (typeof next2.roll1 === 'number' ? next2.roll1 : 10);
      }
      return typeof next.roll2 === 'number' ? next.roll2 : 10;
    }
  }

  if (f.spare) {
    if (offset === 0) {
      const next = frameScores[frameIdx + 1];
      if (!next) return null;
      return typeof next.roll1 === 'number' ? next.roll1 : 10;
    }
    return null; // spare only needs one extra roll
  }

  // Open frame
  if (offset === 0) {
    const next = frameScores[frameIdx + 1];
    if (!next) return null;
    return typeof next.roll1 === 'number' ? next.roll1 : 10;
  }

  return null;
}

// ═══════════════════════════════════════════
//  UI UPDATES
// ═══════════════════════════════════════════

function updateHint(text) {
  const el = document.getElementById('hint');
  el.innerHTML = text;
}

function updateScoreboard() {
  const headerRow = document.getElementById('frame-headers');
  const rollsRow = document.getElementById('rolls-row');
  const scoresRow = document.getElementById('scores-row');

  headerRow.innerHTML = '';
  rollsRow.innerHTML = '';
  scoresRow.innerHTML = '';

  for (let i = 0; i < MAX_FRAMES; i++) {
    const isCurrent = i === frame - 1 && state !== State.GAME_OVER;
    const cls = `cell${isCurrent ? ' current-frame' : ''}`;

    const th = document.createElement('th');
    th.className = cls;
    th.textContent = i + 1;
    headerRow.appendChild(th);

    const tdRoll = document.createElement('td');
    tdRoll.className = cls + ' rolls';
    const tdScore = document.createElement('td');
    tdScore.className = cls + ' score-val';

    const f = frameScores[i];
    if (f) {
      if (f.strike) {
        tdRoll.textContent = 'X' + (f.roll2 !== '' ? '  ' + (f.roll2 === 'X' ? 'X' : f.roll2) : '') + (f.roll3 !== '' ? '  ' + (f.roll3 === 'X' ? 'X' : f.roll3) : '');
      } else if (f.spare) {
        tdRoll.textContent = f.roll1 + '  /' + (f.roll3 !== '' ? '  ' + f.roll3 : '');
      } else {
        tdRoll.textContent = f.roll1 + (f.roll2 !== '' ? '  ' + f.roll2 : '');
      }
      tdScore.textContent = f.score !== null ? f.score : '';
    } else if (isCurrent) {
      if (roll === 1) tdRoll.textContent = '●';
      else tdRoll.textContent = frameRoll1 + '  ●';
    }

    rollsRow.appendChild(tdRoll);
    scoresRow.appendChild(tdScore);
  }
}

function showGameOver() {
  document.getElementById('game-over').classList.add('visible');
  let total = 0;
  for (const f of frameScores) {
    if (f && f.score !== null) total += f.score;
  }
  document.getElementById('final-score').textContent = total;
  sfx.over();
  // 最高分记录
  const recordLine = document.getElementById('record-line');
  const best = parseInt(localStorage.getItem('bowling-best') || '0', 10);
  if (total > best) {
    localStorage.setItem('bowling-best', String(total));
    recordLine.textContent = '🏆 新纪录！';
    recordLine.style.color = '#ffd93d';
  } else {
    recordLine.textContent = '最高分 ' + best;
    recordLine.style.color = 'rgba(255,255,255,0.5)';
  }
}

document.getElementById('restart-btn').addEventListener('click', () => {
  resetGame();
});

function resetGame() {
  document.getElementById('game-over').classList.remove('visible');
  document.getElementById('total-score').textContent = '';

  frameScores.length = 0;
  frame = 1;
  roll = 1;
  frameRoll1 = 0;
  frameRoll2 = 0;
  pinsFallen = 0;
  power = 0;
  aimAngle = 0;
  ballThrown = false;

  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }

  state = State.IDLE;
  hitSoundPlayed = false;
  ballMesh.visible = true;
  initPins();
  resetBall();
  updateScoreboard();
  updateHint('🎳 <strong>左右移动</strong>瞄准 · 青环=落点 / 红环=出界 · 按住下拉蓄力 · 释放投球');
}

// ═══════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════

// Fixed camera - never follows the ball
function updateCamera() {
  const tx = 0;
  const tz = 3.5;
  camera.position.x += (tx - camera.position.x) * 0.03;
  camera.position.z += (tz - camera.position.z) * 0.03;
  camera.lookAt(0, 0.1, -1);
}

// ═══════════════════════════════════════════
//  RESIZE
// ═══════════════════════════════════════════

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ═══════════════════════════════════════════
//  GAME LOOP
// ═══════════════════════════════════════════

const clock = new THREE.Clock();
const fixedTimeStep = 1 / 60;
const maxSubSteps = 3;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  // Step physics
  world.step(fixedTimeStep, dt, maxSubSteps);

  // Update ball mesh from physics
  ballMesh.position.copy(ballBody.position);
  ballMesh.quaternion.copy(ballBody.quaternion);

  // Update pin meshes from physics
  for (const p of activePins) {
    p.mesh.position.copy(p.body.position);
    p.mesh.quaternion.copy(p.body.quaternion);
  }

  // Check if ball has gone off the lane (past the pins or into gutter far)
  if (state === State.THROWING && ballThrown) {
    // 球接近瓶区时播放撞击音效(一次)
    if (!hitSoundPlayed && ballBody.position.z < CFG.pinZStart + 0.8) {
      hitSoundPlayed = true;
      sfx.hit();
    }
    if (ballBody.position.z < -CFG.laneLength + 2 ||
        ballBody.position.z > CFG.ballStartZ + 2 ||
        Math.abs(ballBody.position.x) > 2.5 ||
        (ballBody.velocity.length() < 0.05 && ballBody.position.z < -2)) {
      // Ball has stopped or gone off
      state = State.THROWING; // keep state for the settle detection
      ballThrown = false;
      ballMesh.visible = false; // 出界后隐藏球,避免悬在画面外
      startSettling();
    }
  }

  // Settling: check if all physics has settled
  if (state === State.SETTLING) {
    let allSleeping = true;
    for (const p of activePins) {
      if (p.body.velocity.length() > 0.05 || p.body.angularVelocity.length() > 0.05) {
        allSleeping = false;
        break;
      }
    }
    if (allSleeping && ballBody.velocity.length() < 0.05) {
      if (settleTimer) {
        clearTimeout(settleTimer);
        settleTimer = null;
      }
      countAndScore();
    }
  }

  updateCamera();

  // Update aim line during POWERING
  if (state === State.POWERING) {
    updateAimIndicators(aimAngle, power);
  }

  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════

initPins();
resetBall();
updateScoreboard();
animate();

console.log('🎳 Bowling Game loaded!');
