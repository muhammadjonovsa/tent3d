/* ============================================================================
   TENT 3D :: env.js  —  studio environment: light-pool floor + cyclorama
   ========================================================================== */
'use strict';

function buildEnvironment(renderer, TEX, spec) {
  const cx = spec.frontX - spec.trailerLength * 0.5;   // centre of the rig
  const parts = [];

  /* ------------------------------------------------------------- floor --- */
  const g = new Mesh();
  const RINGS = 30, SEGS = 72, RMAX = 70;
  // non-linear radii so the light pool is dense near the truck
  const radii = [];
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    radii.push(0.35 + Math.pow(t, 1.9) * (RMAX - 0.35));
  }
  gridColored(g, SEGS, RINGS,
    (u, v) => {
      const i = Math.min(RINGS, Math.round(v * RINGS));
      const r = radii[i];
      const a = u * TAU;
      return [cx + Math.cos(a) * r, 0, Math.sin(a) * r];
    },
    (u, v) => {
      const i = Math.min(RINGS, Math.round(v * RINGS));
      const r = radii[i];
      const pool = 1.42 * (1 - sstep(3.0, 26.0, r)) + 0.44;
      const s = clamp(pool, 0.40, 1.50);
      return [s, s * 1.01, s * 1.04, clamp(s * 0.80, 0.32, 1.0)];
    },
    [8, 8]);

  const floorPart = renderer.add(g.build(), {
    albedo: [0.150, 0.158, 0.176], rough: 0.34, metal: 0.10,
    tex: TEX.floor, texScale: [1, 1], reflectance: 0.11,
  }, null, 'floor');
  parts.push(floorPart);

  /* ------------------------------------------- cyclorama (back wall) ------ */
  const w = new Mesh();
  const RAD = 62, H0 = -1.2, H1 = 30, SEGW = 64, SEGH = 10;
  gridColored(w, SEGW, SEGH,
    (u, v) => {
      const a = u * TAU;
      const y = lerp(H0, H1, v);
      // subtle inward curve near the floor
      const rr = RAD - Math.pow(1 - v, 3) * 2.4;
      return [cx + Math.cos(a) * rr, y, Math.sin(a) * rr];
    },
    (u, v) => {
      const g2 = lerp(0.36, 1.0, Math.pow(v, 1.25));
      const band = 0.86 + 0.14 * Math.sin(u * TAU * 3.0);
      const s = g2 * band;
      return [s * 0.86, s * 0.91, s * 1.06, 1.0];
    }, [26, 6]);
  // flip winding so we see the inside
  for (let i = 0; i < w.idx.length; i += 3) {
    const t = w.idx[i + 1]; w.idx[i + 1] = w.idx[i + 2]; w.idx[i + 2] = t;
  }
  const wallPart = renderer.add(w.build(), {
    albedo: [0.078, 0.086, 0.104], rough: 0.60, metal: 0.0, twoSided: true, castShadow: false,
  }, null, 'cyc');
  parts.push(wallPart);

  return { parts, floorPart, wallPart, center: [cx, 0, 0] };
}

/* ==================================================== dimension overlay === */
function buildDimensions(renderer, spec) {
  const parts = [];
  const L = {
    tf: spec.frontX, tr: spec.frontX - spec.trailerLength,
    hw: spec.trailerWidth / 2, roofY: spec.floorY + spec.trailerHeight,
  };
  const accent = [0.32, 0.72, 1.0];
  const dm = new Mesh();

  const seg = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const horiz = Math.hypot(dx, dz);
    const pitch = Math.acos(clamp(dy / len, -1, 1));
    const yaw = horiz < 1e-5 ? 0 : Math.atan2(dx, dz);
    dm.push();
    dm.load(M.compose(M.create(), mid[0], mid[1], mid[2], yaw, pitch, 0, 1, 1, 1));
    dm.cyl(0, 0, 0, 0.013, 0.013, len, 6, { color: accent });
    dm.pop();
  };
  const off = 0.85;
  // length (along -X below the trailer)
  const ly = L.floorY - 0.55, lz = L.hw + off;
  seg([L.tf, ly, lz], [L.tr, ly, lz]);
  for (const x of [L.tf, L.tr]) {
    seg([x, ly, lz - 0.16], [x, ly, lz + 0.16]);
    seg([x, L.floorY - 0.02, lz], [x, ly, lz]);
  }
  // width (across Z at the rear)
  const wx = L.tr - off, wy = L.floorY + 0.9;
  seg([wx, wy, -L.hw], [wx, wy, L.hw]);
  for (const z of [-L.hw, L.hw]) {
    seg([wx - 0.16, wy, z], [wx + 0.16, wy, z]);
    seg([wx, wy, z], [L.tr, wy, z]);
  }
  // height
  const hx = L.tr - 0.35, hz = -L.hw - off;
  seg([hx, L.floorY, hz], [hx, L.roofY, hz]);
  for (const y of [L.floorY, L.roofY]) {
    seg([hx - 0.16, y, hz], [hx + 0.16, y, hz]);
    seg([hx, y, hz], [hx, y, -L.hw]);
  }
  const dimPart = renderer.add(dm.build(), {
    albedo: accent, rough: 0.4, metal: 0.0, emis: [0.28, 0.62, 0.95], opacity: 0.92, castShadow: false,
  }, null, 'dimensions');
  dimPart.visible = false;
  parts.push(dimPart);

  const anchors = [
    { p: [(L.tf + L.tr) / 2, ly, lz], label: '', key: 'length', id: 'length' },
    { p: [wx, wy, 0], label: '', key: 'width', id: 'width' },
    { p: [hx, (L.floorY + L.roofY) / 2, hz], label: '', key: 'height', id: 'height' },
    { p: [wx, wy + 1.25, L.hw], label: '', key: 'volume', id: 'volume' },
    { p: [L.tf + 1.2, L.roofY + 0.55, L.hw + 0.2], label: '', key: 'length', id: 'total' },
  ];
  return { part: dimPart, anchors };
}