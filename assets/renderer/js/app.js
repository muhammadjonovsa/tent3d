/* ============================================================================
   TENT 3D :: app.js  —  scene orchestration, camera, animation, bridge
   ========================================================================== */
'use strict';

let R = null;                 // renderer
let TEX = null;
let SPEC = null;
let TRUCK = null;
let ENVD = null;
let ENV_CX = 0;
let DIMS = null;
let FK = null;
let SCENE_ON = false;

/* cargo state */
let CARGO_PARTS = [];
let CARGO_PLAN = null;
let LOAD_T0 = 0;
let LOADING = false;
let LOAD_PAUSED = false;
let LOAD_DUR = 0;
let LOAD_TOTAL = 0;
let LOAD_MODE = '';
let LOAD_INDEX = 0;

/* forklift */
let FK_ACTIVE = false;
let FK_T0 = 0;
let FK_PLAN = [];
let FK_DELIVERED = 0;

/* tent state */
const TENT = { left: 0, right: 0, rear: 0, tLeft: 0, tRight: 0, tRear: 0, open: false, anim: 0 };

/* camera
 * Orbit convention (see docs/ARCHITECTURE_AUDIT.md): yaw is measured around
 * +Y starting at the truck's forward axis, turning toward the right-hand side.
 *   yaw = 0        camera in front of the truck (+X), looking back
 *   yaw = +PI/2    camera at the truck's right side (+Z)
 *   yaw = -PI/2    camera at the truck's left side (-Z)
 *   yaw = PI       camera behind the trailer (-X)
 * pitch > 0 lifts the camera above the target.
 */
const CAM = {
  mode: 'orbit',
  pos: [12.5, 4.6, 11.0],
  target: [-1.4, 1.9, 0],
  fov: 40, near: 0.05, far: 220,
  yaw: 0, pitch: 0, dist: 16,
  anim: null,
  preset: 'overview',
  saved: null,
};

let INPUT = { down: 0, active: false, lx: 0, ly: 0, wheel: 0, keys: {} };
let ready = false;
let msgQueue = [];
let lastLabelSend = 0;

/* Damped orbit state. The mouse and the wheel only ever move the *target*;
 * `smoothOrbit()` chases it every frame, which removes the jitter of applying
 * raw pointer deltas straight to the camera. */
const MIN_PITCH = -1.40;          // ~ -80 deg
const MAX_PITCH = 1.40;           // ~ +80 deg
const MIN_DIST = 3.0;
const MAX_DIST = 52.0;
const orbitTarget = { yaw: 0.85, pitch: 0.26, dist: 17.0, tx: -1.6, ty: 2.2, tz: 0 };

/* the renderer consumes a plain {position,target,fov,near,far} view object */
const CAM_VIEW = { position: [0, 0, 0], target: [0, 0, 0], fov: 40, near: 0.05, far: 220 };

/**
 * Frame-rate independent exponential smoothing. `rate` is roughly "how much
 * of the remaining gap is closed per second"; higher is snappier.
 */
function damp(current, goal, rate, dt) {
  return goal + (current - goal) * Math.exp(-rate * dt);
}

function smoothOrbit(dt) {
  const r = 14;
  CAM.yaw = damp(CAM.yaw, orbitTarget.yaw, r, dt);
  CAM.pitch = damp(CAM.pitch, orbitTarget.pitch, r, dt);
  CAM.dist = damp(CAM.dist, orbitTarget.dist, r, dt);
  CAM.target[0] = damp(CAM.target[0], orbitTarget.tx, r, dt);
  CAM.target[1] = damp(CAM.target[1], orbitTarget.ty, r, dt);
  CAM.target[2] = damp(CAM.target[2], orbitTarget.tz, r, dt);
}

/** Called when a mouse drag interrupts a running transition. */
function syncOrbitFromAnim() {
  orbitTarget.yaw = CAM.yaw;
  orbitTarget.pitch = clamp(CAM.pitch, MIN_PITCH, MAX_PITCH);
  orbitTarget.dist = clamp(CAM.dist, MIN_DIST, MAX_DIST);
  orbitTarget.tx = CAM.target[0];
  orbitTarget.ty = CAM.target[1];
  orbitTarget.tz = CAM.target[2];
}

/** Points the damped orbit at a preset and, when requested, snaps to it. */
function setOrbitGoal(p, instant) {
  orbitTarget.yaw = p.yaw;
  orbitTarget.pitch = clamp(p.pitch, MIN_PITCH, MAX_PITCH);
  orbitTarget.dist = clamp(p.dist, MIN_DIST, MAX_DIST);
  orbitTarget.tx = p.target[0];
  orbitTarget.ty = p.target[1];
  orbitTarget.tz = p.target[2];
  if (instant) {
    CAM.yaw = orbitTarget.yaw;
    CAM.pitch = orbitTarget.pitch;
    CAM.dist = orbitTarget.dist;
    CAM.target[0] = orbitTarget.tx;
    CAM.target[1] = orbitTarget.ty;
    CAM.target[2] = orbitTarget.tz;
  }
}

function post(msg) {
  msgQueue.push(msg);
  // Deliver straight away when possible. The frame loop also flushes, but any
  // failure that happens before the first frame (bad spec, missing texture)
  // must still reach the host instead of dying silently in the queue.
  flushMessages();
}

/* ============================================================ bridge ==== */
function flushMessages() {
  if (!msgQueue.length) return;
  const payload = JSON.stringify(msgQueue);
  msgQueue = [];
  try {
    if (window.flutter_inappwebview && window.flutter_inappwebview.callHandler) {
      window.flutter_inappwebview.callHandler('TENT3D', payload);
    } else if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage(payload);
    }
  } catch (e) { /* ignore */ }
}

/* ======================================================== tent driving == */
function applyTent(dt) {
  const k = 1 - Math.pow(0.001, dt);
  TENT.tLeft += (TENT.left - TENT.tLeft) * k;
  TENT.tRight += (TENT.right - TENT.tRight) * k;
  TENT.tRear += (TENT.rear - TENT.tRear) * k;
  if (Math.abs(TENT.tLeft - TENT.left) < 0.002) TENT.tLeft = TENT.left;
  if (Math.abs(TENT.tRight - TENT.right) < 0.002) TENT.tRight = TENT.right;
  if (Math.abs(TENT.tRear - TENT.rear) < 0.002) TENT.tRear = TENT.rear;

  const frontX = SPEC.frontX;
  const HW = TRUCK.HW;
  const y0 = TRUCK.curtainY0;

  for (let side = 0; side < 2; side++) {
    const panels = side === 0 ? TRUCK.curtain.left : TRUCK.curtain.right;
    const s = side === 0 ? -1 : 1;
    const t = side === 0 ? TENT.tLeft : TENT.tRight;
    const n = panels.length;
    for (let i = 0; i < n; i++) {
      const p = panels[i];
      // staggered so the curtain ripples from front to back
      const delay = i * (0.62 / n);
      const ti = clamp((t - delay) / (1 - 0.62), 0, 1);
      const e = easeInOut(ti);
      const xOpen = frontX - 0.62 - i * 0.042;
      const x = lerp(p.x0, xOpen, e);
      const wob = (i % 2 ? 1 : -1) * 0.017 * e;
      const yaw = (i % 2 ? 1 : -1) * 0.085 * e;
      M.compose(p.model, x, y0, s * (HW + 0.012) + s * wob, yaw, 0, 0, 1, 1, 1);
    }
  }
  // Each door is modelled with its hinge at the local origin and the leaf
  // extending along local +x, so the closed pose (baseYaw = side * PI/2) lays
  // it across the rear opening. Opening rotates the leaf out towards -X by up
  // to 90 degrees, mirrored for the two sides (delta = side * PI/2 * t).
  for (const d of TRUCK.doors) {
    const yaw = d.baseYaw + d.side * (PI / 2) * TENT.tRear;
    M.compose(
      d.model,
      d.hingeX !== undefined ? d.hingeX : TRUCK.L.tr + 0.05,
      d.hingeY !== undefined ? d.hingeY : TRUCK.L.floorY,
      d.hingeZ !== undefined ? d.hingeZ : d.side * (HW - 0.01),
      yaw, 0, 0, 1, 1, 1,
    );
  }
  // interior lights fade in with the open curtains
  const openness = Math.max(TENT.tLeft, TENT.tRight);
  const lights = [];
  if (openness > 0.02) {
    const lit = 0.35 + 2.3 * openness;
    const warm = [1.0, 0.93, 0.82];
    for (let i = 0; i < 3; i++) {
      const x = lerp(SPEC.frontX - 1.6, SPEC.frontX - SPEC.trailerLength + 1.8, i / 2);
      lights.push({ pos: [x, SPEC.floorY + SPEC.trailerHeight - 0.30, 0], color: warm, intensity: lit * 2.2 });
    }
  }
  R.points = lights;
}

/* ========================================================= camera rig === */
function truckBounds() {
  return {
    x0: SPEC.frontX - SPEC.trailerLength - 0.5,
    x1: SPEC.frontX + 6.6,
    cx: (SPEC.frontX + SPEC.frontX - SPEC.trailerLength) / 2 - 0.1,
  };
}

/* Presets are derived from the live trailer geometry so they stay correct when
 * the user resizes the trailer (the old values were hard-coded for 13.6 m). */
function presetFrame() {
  const front = SPEC.frontX;
  const rear = front - SPEC.trailerLength;
  const cx = (front + rear) * 0.5;
  const span = SPEC.trailerLength;
  return { front, rear, cx, span };
}

const PRESETS = {
  overview: () => { const f = presetFrame(); return { yaw: 0.85, pitch: 0.26, dist: f.span + 3.6, target: [f.cx, 2.20, 0], fov: 38 }; },
  front: () => { const f = presetFrame(); return { yaw: 0.0, pitch: 0.11, dist: 11.5, target: [f.front + 0.75, 1.60, 0], fov: 34 }; },
  rear: () => { const f = presetFrame(); return { yaw: PI, pitch: 0.15, dist: f.span * 0.85 + 4.0, target: [f.rear - 0.60, 1.90, 0], fov: 34 }; },
  left: () => { const f = presetFrame(); return { yaw: -PI / 2, pitch: 0.09, dist: f.span + 2.0, target: [f.cx, 2.10, 0], fov: 36 }; },
  right: () => { const f = presetFrame(); return { yaw: PI / 2, pitch: 0.09, dist: f.span + 2.0, target: [f.cx, 2.10, 0], fov: 36 }; },
  top: () => { const f = presetFrame(); return { yaw: 0.55, pitch: 1.24, dist: f.span + 6.0, target: [f.cx, 1.20, 0], fov: 38 }; },
  corner: () => { const f = presetFrame(); return { yaw: -0.85, pitch: 0.22, dist: f.span + 1.5, target: [f.cx, 2.10, 0], fov: 38 }; },
};

function orbitPos(yaw, pitch, dist, target) {
  const cp = Math.cos(pitch);
  return [
    target[0] + Math.cos(yaw) * cp * dist,
    target[1] + Math.sin(pitch) * dist,
    target[2] + Math.sin(yaw) * cp * dist,
  ];
}

function gotoPreset(name, dur) {
  const p = (PRESETS[name] || PRESETS.overview)();
  CAM.mode = 'orbit';
  CAM.preset = PRESETS[name] ? name : 'overview';
  setOrbitGoal(p, !dur || dur <= 0.002);
  CAM.anim = {
    t: 0, dur: dur === undefined ? 1.15 : dur,
    p0: CAM.pos.slice(), p1: orbitPos(p.yaw, p.pitch, p.dist, p.target),
    t0: CAM.target.slice(), t1: p.target.slice(),
    f0: CAM.fov, f1: p.fov,
    y0: CAM.yaw, y1: p.yaw, pi0: CAM.pitch, pi1: p.pitch, d0: CAM.dist, d1: p.dist,
  };
  post({ t: 'cameraMode', mode: 'orbit', preset: name });
}

function flyTo(pos, target, dur, fov, onDone) {
  CAM.anim = {
    t: 0, dur: dur || 1.4,
    p0: CAM.pos.slice(), p1: pos.slice(),
    t0: CAM.target.slice(), t1: target.slice(),
    f0: CAM.fov, f1: fov || CAM.fov,
    y0: CAM.yaw, y1: CAM.yaw, pi0: CAM.pitch, pi1: CAM.pitch, d0: CAM.dist, d1: CAM.dist,
    onDone: onDone || null,
  };
}

/* Interior walk volume: eye height above the floor, head clearance under the
 * roof, and a wall inset so the camera never clips through the lining. */
function interiorBox() {
  return {
    x0: SPEC.frontX - SPEC.trailerLength + 0.45,
    x1: SPEC.frontX - 0.95,
    y0: SPEC.floorY + 1.62,
    y1: SPEC.floorY + SPEC.trailerHeight - 0.32,
    z0: -TRUCK.IHW + 0.34,
    z1: TRUCK.IHW - 0.34,
  };
}

function enterTrailer() {
  const inside = CAM.mode === 'interior';
  // Opening the curtains / doors here must publish the new state, otherwise the
  // host keeps showing the trailer as closed.
  if (!TENT.open) setTent(true, false);
  if (TENT.rear < 0.9) { TENT.rear = 1; TENT.open = true; postTentState(); }

  const box = interiorBox();
  const finalPos = [box.x0 + 0.45, box.y0, 0.0];
  const finalTgt = [box.x1 - 0.4, box.y0 - 0.17, 0.0];

  if (inside) {
    CAM.mode = 'interior';
    CAM.pos = finalPos.slice();
    updateLookTarget();
    return;
  }

  // Remember the exterior view so exiting the trailer can restore it exactly.
  if (CAM.mode === 'orbit' || CAM.mode === 'free') {
    CAM.saved = {
      yaw: CAM.yaw, pitch: CAM.pitch, dist: CAM.dist,
      target: CAM.target.slice(), fov: CAM.fov, preset: CAM.preset || 'overview',
    };
  }

  // cinematic route: rise up, sweep over the open roof, dive through the rear
  const p1 = [SPEC.frontX - SPEC.trailerLength - 4.6, SPEC.floorY + 3.9, 1.6];
  const p2 = [SPEC.frontX - SPEC.trailerLength - 1.9, SPEC.floorY + 2.6, 0.4];
  CAM.mode = 'free';
  CAM.anim = {
    t: 0, dur: 2.35, curve: true,
    pts: [CAM.pos.slice(), p1, p2, finalPos.slice()],
    t0: CAM.target.slice(), t1: finalTgt.slice(),
    f0: CAM.fov, f1: 62,
    onDone: () => {
      CAM.mode = 'interior';
      CAM.pos = finalPos.slice();
      CAM.fov = 62;
      CAM.dist = 0.9;
      // Interior look direction: down the trailer towards the bulkhead.
      CAM.yaw = Math.PI / 2; CAM.pitch = 0;
      updateLookTarget();
      post({ t: 'cameraMode', mode: 'interior', preset: 'interior' });
    },
  };
  post({ t: 'cameraMode', mode: 'entering' });
}

function exitTrailer() {
  if (CAM.mode !== 'interior') return;
  const startPos = CAM.pos.slice();
  const startTgt = CAM.target.slice();

  // Restore whatever exterior view the user had before walking in. Falling back
  // to the overview preset only happens if no orbit state was ever captured.
  const restore = CAM.saved
    ? { yaw: CAM.saved.yaw, pitch: CAM.saved.pitch, dist: CAM.saved.dist,
        target: CAM.saved.target.slice(), fov: CAM.saved.fov }
    : PRESETS.overview();
  const savedPreset = CAM.saved ? CAM.saved.preset : 'overview';

  const p1 = [restore.target[0] - restore.dist * 0.45, restore.target[1] + 2.6, restore.target[2] + 2.2];
  const p2 = orbitPos(restore.yaw, restore.pitch, restore.dist, restore.target);

  CAM.mode = 'free';
  CAM.anim = {
    t: 0, dur: 1.5, curve: true,
    pts: [startPos, p1, p2],
    t0: startTgt, t1: restore.target.slice(),
    f0: CAM.fov, f1: restore.fov,
    onDone: () => {
      CAM.mode = 'orbit';
      CAM.preset = savedPreset;
      setOrbitGoal(restore, true);
      applyOrbit();
      post({ t: 'cameraMode', mode: 'orbit', preset: savedPreset });
    },
  };
  post({ t: 'cameraMode', mode: 'exiting' });
}

function applyOrbit() {
  if (CAM.anim) return;
  if (CAM.mode === 'orbit' || CAM.mode === 'free') {
    CAM.pos = orbitPos(CAM.yaw, CAM.pitch, CAM.dist, CAM.target);
  }
}

function camBounds() {
  const b = truckBounds();
  return {
    x: [b.x0 - 6, b.x1 + 6],
    y: [0.35, 26],
    z: [-9, 9],
  };
}

/* ========================================================== input ======= */
function bindInput(canvas) {
  const onDown = (e) => {
    /* MouseEvent.button is 0 for the primary button, so it cannot double as a
     * "is dragging" flag - store the active button separately and keep -1 as
     * the idle sentinel. Getting this wrong silently disables left-drag. */
    INPUT.down = e.button;
    INPUT.active = true;
    INPUT.lx = e.clientX; INPUT.ly = e.clientY;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!INPUT.active) return;
    const dx = e.clientX - INPUT.lx, dy = e.clientY - INPUT.ly;
    INPUT.lx = e.clientX; INPUT.ly = e.clientY;
    // Grabbing the mouse takes over from a running transition, but it adopts
    // the destination of that transition instead of snapping back to the
    // stale start values.
    if (CAM.anim) { CAM.anim = null; syncOrbitFromAnim(); }
    if (INPUT.down === 0) {
      if (CAM.mode === 'interior') {
        CAM.yaw -= dx * 0.004;
        CAM.pitch = clamp(CAM.pitch - dy * 0.004, -1.35, 1.35);
        updateLookTarget();
      } else {
        // yaw is measured from the truck's forward axis toward its right side,
        // so dragging right swings the camera toward the right of the truck.
        orbitTarget.yaw += dx * 0.005;
        orbitTarget.pitch = clamp(orbitTarget.pitch + dy * 0.004, MIN_PITCH, MAX_PITCH);
        CAM.preset = null;
      }
    } else if (INPUT.down === 2) {
      panCamera(-dx * 0.012 * (CAM.dist * 0.16 + 0.4), -dy * 0.012 * (CAM.dist * 0.16 + 0.4));
    } else if (INPUT.down === 1) {
      if (CAM.mode === 'interior') CAM.dist = clamp(CAM.dist + dy * 0.02, 0.2, 14);
      else orbitTarget.dist = clamp(orbitTarget.dist * (1 + dy * 0.008), MIN_DIST, MAX_DIST);
    }
  };
  const onUp = (e) => { INPUT.active = false; INPUT.down = 0; };
  const onWheel = (e) => {
    e.preventDefault();
    if (CAM.mode === 'interior') {
      if (CAM.anim) { CAM.anim = null; }
      moveForward(-e.deltaY * 0.0016);
      return;
    }
    const s = Math.exp(clamp(e.deltaY, -160, 160) * 0.0014);
    orbitTarget.dist = clamp(orbitTarget.dist * s, MIN_DIST, MAX_DIST);
    CAM.preset = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => { INPUT.keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { INPUT.keys[e.code] = false; });
}

/**
 * Rebuilds the look target from yaw/pitch using the shared orbit convention
 * (yaw 0 = truck forward / +X, positive yaw turns toward the right / +Z).
 * Both the orbit and the interior camera use it, so the two never disagree
 * about which way "forward" is.
 */
function updateLookTarget() {
  const cp = Math.cos(CAM.pitch);
  CAM.target = [
    CAM.pos[0] + Math.cos(CAM.yaw) * cp,
    CAM.pos[1] + Math.sin(CAM.pitch),
    CAM.pos[2] + Math.sin(CAM.yaw) * cp,
  ];
}

function panCamera(dx, dy) {
  if (CAM.mode === 'interior') {
    const cp = Math.cos(CAM.pitch);
    const right = [Math.sin(CAM.yaw), 0, -Math.cos(CAM.yaw)];
    CAM.pos[0] += right[0] * dx; CAM.pos[2] += right[2] * dx;
    clampInterior();
    updateLookTarget();
    return;
  }
  // Exterior pan moves the orbit *target* on the ground plane, which keeps the
  // camera height and the view angle stable while the user drags with RMB.
  const right = [Math.cos(CAM.yaw), 0, -Math.sin(CAM.yaw)];
  orbitTarget.tx += right[0] * dx;
  orbitTarget.tz += right[2] * dx;
  orbitTarget.ty = clamp(orbitTarget.ty + dy, 0.2, 8);
  const b = camBounds();
  orbitTarget.tx = clamp(orbitTarget.tx, b.x[0], b.x[1]);
  orbitTarget.tz = clamp(orbitTarget.tz, b.z[0], b.z[1]);
  CAM.preset = null;
}

/**
 * Keeps the walking camera inside the trailer: walls, floor and roof are hard
 * limits, and the eye height is pinned so looking up or down cannot push the
 * camera through the floor or the bows.
 */
function clampInterior() {
  const b = interiorBox();
  const eye = SPEC.floorY + 1.62;
  CAM.pos[0] = clamp(CAM.pos[0], b.x0, b.x1);
  CAM.pos[1] = clamp(CAM.pos[1], eye - 0.55, eye + 0.30);
  CAM.pos[2] = clamp(CAM.pos[2], b.z0, b.z1);
}

function moveForward(amount) {
  // Walk along the horizontal view direction. Deriving it from pos -> target
  // keeps WASD correct in every mode and independent of the orbit convention.
  let dx = CAM.target[0] - CAM.pos[0];
  let dz = CAM.target[2] - CAM.pos[2];
  const h = Math.hypot(dx, dz);
  if (h > 1e-5) { dx /= h; dz /= h; } else { dx = 1; dz = 0; }
  CAM.pos[0] += dx * amount;
  CAM.pos[2] += dz * amount;
  clampInterior();
  updateLookTarget();
}

/* ===================================================== cargo animation == */
function clearCargo() {
  R.removeParts(CARGO_PARTS);
  CARGO_PARTS = [];
  CARGO_PLAN = null;
  LOADING = false;
  LOAD_INDEX = 0;
  FK_ACTIVE = false;
  if (FK) FK.setVisible(false);
}

function buildCargoPart(pl) {
  const data = cargoMesh(pl.typeId, pl.dims);
  const mat = cargoMaterial(pl.typeId, TEX);
  const p = R.add(data, mat, null, 'cargo');
  p.mat.castShadow = true;
  p.pl = pl;
  CARGO_PARTS.push(p);
  return p;
}

function startLoad(plan, opts) {
  clearCargo();
  opts = opts || {};
  CARGO_PLAN = plan;
  LOAD_MODE = plan.mode || '';
  LOAD_TOTAL = plan.placements.length;
  LOAD_INDEX = 0;
  LOAD_T0 = performance.now();
  LOADING = LOAD_TOTAL > 0;
  LOAD_PAUSED = false;

  for (const pl of plan.placements) buildCargoPart(pl);
  applyCargoAt(0);
  post({ t: 'loadStart', total: LOAD_TOTAL });
}

function staggerDelay(i, n) {
  const per = n > 26 ? 0.10 : n > 12 ? 0.16 : 0.26;
  return i * per;
}

function applyCargoAt(t) {
  if (!CARGO_PLAN) return;
  const n = CARGO_PLAN.placements.length;
  let placed = 0;
  for (let i = 0; i < n; i++) {
    const p = CARGO_PARTS[i];
    if (!p) continue;
    const pl = p.pl;
    const t0 = staggerDelay(i, n);
    const dur = 0.85;
    const u = clamp((t - t0) / dur, 0, 1);
    if (u <= 0) { p.visible = false; continue; }
    const e = easeInOut(u);
    p.visible = true;
    if (u >= 1) {
      M.compose(p.model, pl.x, pl.y, pl.z, pl.yaw, 0, 0, 1, 1, 1);
      placed++;
      continue;
    }
    const [L] = pl.dims;
    let sx, sy, sz;
    if (pl.entry === 'slide') {
      const startX = SPEC.frontX - SPEC.trailerLength - L * 0.9;
      sx = lerp(startX, pl.x, e);
      sy = pl.y;
      sz = pl.z;
    } else {
      const dir = pl.side;
      sx = lerp(pl.x + dir * 2.6, pl.x, easeInOut(clamp(u / 0.62, 0, 1)));
      sy = lerp(SPEC.floorY + SPEC.trailerHeight + 1.5, pl.y, easeInOut(clamp((u - 0.30) / 0.70, 0, 1)));
      sz = lerp(pl.z + dir * 1.1, pl.z, easeInOut(clamp(u / 0.62, 0, 1)));
    }
    M.compose(p.model, sx, sy, sz, pl.yaw + (1 - e) * 0.12, 0,
      (pl.entry === 'slide' ? 0 : (1 - e) * 0.07), 1, 1, 1);
  }
  const prog = n ? clamp((t - staggerDelay(n - 1, n)) / 0.85, 0, 1) : 1;
  post({ t: 'loadProgress', placed, total: n, progress: prog });
  return prog;
}

/* ====================================================== forklift cycle == */
function startForklift(plan, t0) {
  FK_ACTIVE = true;
  FK_T0 = t0;
  FK_PLAN = plan.filter((p) => p.typeId === 'pallets' || p.forklift);
  FK_DELIVERED = 0;
  if (FK) FK.setVisible(FK_PLAN.length > 0);
}

function forkliftState(t) {
  const floorY = SPEC.floorY;
  const box = { x0: SPEC.frontX - SPEC.trailerLength, x1: SPEC.frontX };
  const stage = [box.x0 - 4.4, 2.9];
  const door = [box.x0 + 0.55, 0.05];
  const perTrip = 7.6;
  const trip = Math.floor(t / perTrip);
  const u = (t % perTrip) / perTrip;
  const target = FK_PLAN[Math.min(trip, FK_PLAN.length - 1)] || { x: box.x1 - 2.5, z: 0, y: floorY + 0.8 };

  // keyframes of a delivery cycle
  const K = [
    { t: 0.00, p: [stage[0] - 1.6, stage[1] + 0.6], fork: 0.08 },
    { t: 0.13, p: stage, fork: 0.08 },
    { t: 0.22, p: [stage[0] + 0.55, stage[1] - 0.9], fork: 0.08 },
    { t: 0.30, p: [stage[0] + 0.55, stage[1] - 0.9], fork: 0.62 },
    { t: 0.44, p: [door[0] - 1.5, door[1] + 0.5], fork: 0.62 },
    { t: 0.56, p: [door[0], door[1]], fork: 0.62 },
    { t: 0.68, p: [target.x - 0.9, target.z], fork: 0.62 },
    { t: 0.76, p: [target.x - 0.9, target.z], fork: 0.10 },
    { t: 0.88, p: [door[0] - 1.2, door[1] + 0.3], fork: 0.10 },
    { t: 1.00, p: [stage[0] - 2.2, stage[1] + 1.0], fork: 0.10 },
  ];
  let a = K[0], b = K[K.length - 1];
  for (let i = 0; i < K.length - 1; i++) {
    if (u >= K[i].t && u <= K[i + 1].t) { a = K[i]; b = K[i + 1]; break; }
  }
  const span = Math.max(1e-5, b.t - a.t);
  const k = easeInOut(clamp((u - a.t) / span, 0, 1));
  const px = lerp(a.p[0], b.p[0], k);
  const pz = lerp(a.p[1], b.p[1], k);
  // ground height: yard outside, trailer deck inside, ramp in between
  const gy = floorY * sstep(box.x0 - 1.3, box.x0 + 0.5, px);
  const pos = [px, gy, pz];
  const fork = lerp(a.fork, b.fork, k);
  // heading from the path tangent
  const hx = b.p[0] - a.p[0], hz = b.p[1] - a.p[1];
  const yaw = (Math.hypot(hx, hz) < 1e-4) ? 0 : Math.atan2(-hz, hx) + (u < 0.02 || u > 0.985 ? Math.PI : 0);
  return { pos, yaw, fork, trip, target, carrying: u > 0.28 && u < 0.78, delivered: u > 0.76 };
}

/* --- fork lift part transforms (used from the frame loop) --- */
function placeForklift(st) {
  if (!FK) return;
  const f = FK.parts;
  const [x, y, z] = st.pos;
  // every forklift mesh already carries its own local offset, so the whole
  // rig only needs the chassis transform; the carriage additionally rides up.
  for (let i = 0; i < f.length; i++) {
    M.compose(f[i].model, x, y + (i === 1 ? st.fork : 0), z, st.yaw, 0, 0, 1, 1, 1);
  }
}

/* ====================================================== dimensions ===== */
function updateLabels(now) {
  if (!DIMS || !DIMS.part.visible) return;
  if (now - lastLabelSend < 90) return;
  lastLabelSend = now;
  const out = [];
  const o = [0, 0, 0];
  for (const a of DIMS.anchors) {
    if (R.project(a.p, o)) {
      out.push({ id: a.id, x: o[0], y: o[1], z: o[2] });
    }
  }
  post({ t: 'anchors', items: out });
}

/* ========================================================== boot ======== */
/**
 * Rebuilds only the parts whose shape depends on the trailer geometry.
 *
 * The camera rig, the tent animation targets and the environment are left
 * alone, so resizing the trailer no longer throws away the user's view or
 * re-opens/closes the curtains. The host re-sends the (re-planned) cargo
 * afterwards, so the stale cargo parts are dropped here.
 */
function rebuildGeometry() {
  const dimsVisible = !!(DIMS && DIMS.part.visible);
  const tentL = TENT.left, tentR = TENT.right, tentRear = TENT.rear;

  clearCargo();

  if (TRUCK) R.removeParts(TRUCK.parts);
  if (DIMS) R.removeParts([DIMS.part]);
  TRUCK = buildTruck(R, TEX, SPEC);
  DIMS = buildDimensions(R, SPEC);
  DIMS.part.visible = dimsVisible;

  // The studio floor and cyclorama are discs centred on the rig, so they can
  // simply slide with the new centre instead of rebuilding two large meshes.
  const cx = SPEC.frontX - SPEC.trailerLength * 0.5;
  if (ENVD) {
    const dx = cx - ENV_CX;
    if (dx !== 0) {
      for (const p of ENVD.parts) M.compose(p.model, dx, 0, 0, 0, 0, 0, 1, 1, 1);
      ENV_CX = cx;
    }
  }

  R.setLightCenter(cx, 1.7, 0, Math.max(11, SPEC.trailerLength * 0.95));

  // keep the animated state, drop the interpolation position so the new
  // curtain panels start from the current openness
  TENT.left = tentL; TENT.right = tentR; TENT.rear = tentRear;
  applyTent(1);

  lastLabelSend = 0;
  post({
    t: 'geometry',
    parts: R.parts.length,
    tris: R.parts.reduce((s, p) => s + (p.mesh ? p.mesh.tris : 0), 0),
  });
}

function boot(spec) {
  try {
    if (ready) {
      // Re-initialising a live scene would attach a second set of input
      // listeners (doubled / reversed sensitivity) and orphan GPU buffers.
      SPEC = spec;
      rebuildGeometry();
      if (spec.exposure !== undefined) R.exposure = spec.exposure;
      return;
    }
    SPEC = spec;
    const canvas = document.getElementById('gl');
    R = new Renderer(canvas);
    TEX = buildTextures(R);
    TRUCK = buildTruck(R, TEX, SPEC);
    ENVD = buildEnvironment(R, TEX, SPEC);
    ENV_CX = SPEC.frontX - SPEC.trailerLength * 0.5;
    DIMS = buildDimensions(R, SPEC);
    FK = buildForklift(R, TEX);
    R.setLightCenter(ENV_CX, 1.7, 0, Math.max(11, SPEC.trailerLength * 0.95));
    R.exposure = SPEC.exposure === undefined ? 1.14 : SPEC.exposure;

    const p = PRESETS.overview();
    CAM.yaw = p.yaw; CAM.pitch = p.pitch; CAM.dist = p.dist; CAM.target = p.target.slice();
    CAM.fov = p.fov;
    applyOrbit();

    bindInput(canvas);
    SCENE_ON = true;
    ready = true;
    post({
      t: 'ready',
      tris: R.parts.reduce((s, p) => s + (p.mesh ? p.mesh.tris : 0), 0),
      parts: R.parts.length,
      bbox: truckBounds(),
    });
    if (window.__tent3dBoot) window.__tent3dBoot();
  } catch (err) {
    SCENE_ON = false;
    const msg = String((err && err.message) || err);
    post({ t: 'error', fatal: true, message: 'boot failed: ' + msg });
    if (window.__tent3dFail) window.__tent3dFail('boot failed: ' + msg);
    throw err;
  }
  requestAnimationFrame(frame);
}

/* ========================================================== loop ======== */
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!SCENE_ON) return;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;

  R.resize();

  // camera animation
  if (CAM.anim) {
    const a = CAM.anim;
    a.t += dt;
    const u = clamp(a.t / a.dur, 0, 1);
    const e = easeInOut(u);
    if (a.curve) {
      const pts = a.pts;
      const n = pts.length - 1;
      const s = e * n;
      const i = Math.min(n - 1, Math.floor(s));
      const f = s - i;
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
      for (let c = 0; c < 3; c++) {
        CAM.pos[c] = 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * f +
          (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * f * f +
          (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * f * f * f);
        CAM.target[c] = lerp(a.t0[c], a.t1[c], e);
      }
      CAM.fov = lerp(a.f0, a.f1, e);
    } else {
      for (let c = 0; c < 3; c++) {
        CAM.pos[c] = lerp(a.p0[c], a.p1[c], e);
        CAM.target[c] = lerp(a.t0[c], a.t1[c], e);
      }
      CAM.fov = lerp(a.f0, a.f1, e);
      CAM.yaw = lerp(a.y0, a.y1, e);
      CAM.pitch = lerp(a.pi0, a.pi1, e);
      CAM.dist = lerp(a.d0, a.d1, e);
    }
    if (u >= 1) {
      const done = a.onDone;
      CAM.anim = null;
      if (done) done();
    }
  } else if (CAM.mode === 'orbit' || CAM.mode === 'free') {
    smoothOrbit(dt);
    applyOrbit();
  }

  // Keyboard walk is an interior-mode control only. Running it in orbit mode
  // used to drag the exterior camera through clampInterior()/updateLookTarget()
  // and destroy the orbit rig.
  if (CAM.mode === 'interior') {
    const sp = (INPUT.keys['ShiftLeft'] ? 5.0 : 2.4) * dt;
    if (INPUT.keys['KeyW'] || INPUT.keys['ArrowUp']) moveForward(sp);
    if (INPUT.keys['KeyS'] || INPUT.keys['ArrowDown']) moveForward(-sp);
    if (INPUT.keys['KeyA'] || INPUT.keys['ArrowLeft']) panCamera(-sp, 0);
    if (INPUT.keys['KeyD'] || INPUT.keys['ArrowRight']) panCamera(sp, 0);
  }

  applyTent(dt);

  // cargo animation
  if (LOADING) {
    const t = LOAD_PAUSED ? (LOAD_DUR) : (now - LOAD_T0) / 1000;
    LOAD_DUR = Math.max(LOAD_DUR, t);
    const prog = applyCargoAt(t);
    const n = CARGO_PLAN.placements.length;
    if (prog >= 1) {
      LOADING = false;
      post({ t: 'loadComplete', total: n });
    }
  }  if (FK_ACTIVE && FK_PLAN.length) {
    const t = LOAD_PAUSED ? LOAD_DUR : (now - LOAD_T0) / 1000;
    const st = forkliftState(t);
    placeForklift(st);
    // carried pallet follows the forks
    const tripIdx = Math.min(st.trip, FK_PLAN.length - 1);
    const pl = FK_PLAN[tripIdx];
    const p = CARGO_PARTS.find((q) => q.pl === pl);
    if (p) {
      if (st.carrying) {
        const cy = Math.cos(st.yaw), sy = Math.sin(st.yaw);
        const lx = 1.55;
        const wx = st.pos[0] + lx * cy;
        const wz = st.pos[2] - lx * sy;
        M.compose(p.model, wx, SPEC.floorY + st.fork + pl.dims[1] * 0.5, wz, st.yaw, 0, 0, 1, 1, 1);
      } else if (st.delivered || st.trip > 0) {
        if (p.pl.done) { /* keep */ }
        else { p.pl.done = true; M.compose(p.model, pl.x, pl.y, pl.z, pl.yaw, 0, 0, 1, 1, 1); }
      }
    }
  }

  CAM_VIEW.position = CAM.pos;
  CAM_VIEW.target = CAM.target;
  CAM_VIEW.fov = CAM.fov;
  CAM_VIEW.near = CAM.near;
  CAM_VIEW.far = CAM.far;
  R.render(CAM_VIEW, {
    zenith: [0.028, 0.036, 0.052],
    horizon: [0.070, 0.086, 0.112],
    floorCol: [0.026, 0.029, 0.036],
    sunGlow: 0.85,
  });
  updateLabels(now);
  flushMessages();
}

/* ====================================================== command API ===== */
function postTentState() {
  post({ t: 'tent', left: TENT.left, right: TENT.right, rear: TENT.rear });
}

function setTent(open, all) {
  TENT.open = open;
  TENT.left = open ? 1 : 0;
  TENT.right = open ? 1 : 0;
  if (all) TENT.rear = open ? 1 : 0;
  TENT.open = TENT.left > 0.5 || TENT.right > 0.5;
  postTentState();
}

/** Drives one side at a time so the curtains can be operated independently. */
function setTentSide(side, open) {
  if (side === 'left' || side === 'l') TENT.left = open ? 1 : 0;
  else TENT.right = open ? 1 : 0;
  TENT.open = TENT.left > 0.5 || TENT.right > 0.5;
  postTentState();
}

function setRearDoors(open) {
  TENT.rear = open ? 1 : 0;
  TENT.open = TENT.open || TENT.rear > 0.5;
  postTentState();
}

window.TENT3D = {
  stats() {
    const c = document.getElementById('gl');
    const b = document.getElementById('boot');
    return {
      ready: ready,
      parts: R ? R.parts.length : 0,
      glErr: R ? R.gl.getError() : -1,
      canvas: c ? c.width + 'x' + c.height : 'none',
      boot: b ? b.className : 'no-boot',
    };
  },
  /* Full scene snapshot — lets the host verify command round-trips. */
  state() {
    return {
      ready: ready,
      spec: SPEC,
      tent: { open: TENT.open, left: TENT.left, right: TENT.right, rear: TENT.rear },
      camera: {
        mode: CAM.mode, preset: CAM.preset, yaw: CAM.yaw, pitch: CAM.pitch,
        dist: CAM.dist, fov: CAM.fov, pos: CAM.pos, target: CAM.target,
        // Damped goals let the regression harness verify clamps without
        // waiting for the smoothing to settle.
        goal: {
          yaw: orbitTarget.yaw, pitch: orbitTarget.pitch, dist: orbitTarget.dist,
          target: [orbitTarget.tx, orbitTarget.ty, orbitTarget.tz],
        },
        limits: { minPitch: MIN_PITCH, maxPitch: MAX_PITCH, minDist: MIN_DIST, maxDist: MAX_DIST },
        saved: !!CAM.saved,
      },
      load: {
        active: LOADING, total: LOAD_TOTAL, index: LOAD_INDEX,
        progress: LOAD_TOTAL ? LOAD_INDEX / LOAD_TOTAL : 0,
        placed: CARGO_PARTS.filter((q) => q.visible).length,
        parts: CARGO_PARTS.length,
      },
      dims: !!(DIMS && DIMS.part.visible),
      forklift: FK_ACTIVE,
    };
  },
  receive(msg) {
    try {
      // Accepts either a JSON string or an already-decoded object literal:
      // the Windows evaluateJavascript path passes the object form.
      handle(typeof msg === 'string' ? JSON.parse(msg) : msg);
    } catch (e) {
      post({ t: 'error', message: String(e && e.message || e) });
    }
  },
};

function handle(m) {
  switch (m.t) {
    case 'init': boot(m.spec); break;
    case 'setGeometry': SPEC = m.spec; rebuildGeometry(); break;
    case 'setCabColor': {
      if (TRUCK && TRUCK.MAT) {
        if (m.cabColor) TRUCK.MAT.paint.albedo = m.cabColor;
        if (m.curtainColor) TRUCK.MAT.curtain.albedo = m.curtainColor;
        if (m.curtainInnerColor) TRUCK.MAT.curtainIn.albedo = m.curtainInnerColor;
        if (m.roofColor) TRUCK.MAT.paintWhite.albedo = m.roofColor;
      }
      break;
    }
    case 'setExposure': if (R) R.exposure = m.exposure; break;
    case 'tent':
      if (m.left !== undefined) TENT.left = m.left ? 1 : 0;
      if (m.right !== undefined) TENT.right = m.right ? 1 : 0;
      if (m.rear !== undefined) TENT.rear = m.rear ? 1 : 0;
      TENT.open = TENT.left > 0.5 || TENT.right > 0.5 || TENT.rear > 0.5;
      postTentState();
      break;
    case 'tentSide': setTentSide(m.side, !!m.open); break;
    case 'rearDoors': setRearDoors(!!m.open); break;
    case 'openTent': setTent(true, m.rear !== false); break;
    case 'closeTent': setTent(false, m.rear !== false); break;
    case 'camera': gotoPreset(m.preset, m.instant ? 0.001 : 1.15); break;
    case 'enterTrailer': enterTrailer(); break;
    case 'exitTrailer': exitTrailer(); break;
    case 'look': {
      CAM.anim = null;
      const d = m.dir || 'orbit';
      if (CAM.mode === 'interior' && (d === 'interior' || d === 'orbit')) {
        if (d === 'interior') {
          CAM.yaw = 0.0; CAM.pitch = 0.02;
          CAM.pos = [SPEC.frontX - SPEC.trailerLength + 0.9, SPEC.floorY + 1.62, 0];
          clampInterior(); updateLookTarget();
        } else {
          exitTrailer();
        }
      } else {
        gotoPreset(d, 1.1);
      }
      break;
    }
    case 'dimensions':
      if (DIMS) DIMS.part.visible = !!m.visible;
      break;
    case 'cargo': {
      const plan = m.plan || { placements: [] };
      plan.mode = plan.placements.length ? CARGO_BY_ID[plan.placements[0].typeId].mode : '';
      for (const p of plan.placements) {
        p.side = p.z >= 0 ? 1 : -1;
        p.entry = (p.typeId === 'pipes' || p.typeId === 'lumber') ? 'slide' : 'drop';
        p.done = false;
      }
      startLoad(plan);
      if (plan.mode === 'PALLETS' && FK) {
        startForklift(plan.placements, LOAD_T0);
      }
      break;
    }
    case 'cargoClear': clearCargo(); post({ t: 'loadComplete', total: 0 }); break;
    case 'loadPause': LOAD_PAUSED = !!m.paused; if (LOAD_PAUSED) LOAD_DUR = (performance.now() - LOAD_T0) / 1000; break;
    case 'lighting':
      R.exposure = m.exposure === undefined ? R.exposure : m.exposure;
      R.sunCol = m.sun || R.sunCol;
      if (m.dir) V.norm(R.sunDir, V.of(m.dir[0], m.dir[1], m.dir[2]));
      break;
    case 'resize': R.resize(); break;
    case 'resetCamera': {
      CAM.anim = null;
      setOrbitGoal((PRESETS[CAM.preset] || PRESETS.overview)(), false);
      CAM.anim = null;
      applyOrbit();
      break;
    }
    case 'resetScene':
    case 'reset': {
      CAM.anim = null;
      clearCargo();
      TENT.left = TENT.right = TENT.rear = 0; TENT.open = false;
      if (DIMS) DIMS.part.visible = false;
      if (m.t === 'reset') {
        CAM.preset = 'overview';
        setOrbitGoal(PRESETS.overview(), false);
        applyOrbit();
      }
      break;
    }
  }
}