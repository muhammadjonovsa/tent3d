/* ============================================================================
   TENT 3D :: cargo.js  —  cargo catalogue, procedural meshes, load planner
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------- catalog --- */
const CARGO_TYPES = [
  {
    id: 'wood', name: 'Wooden Boards', nameTr: 'Tahta', short: 'WOOD', mode: 'WOOD',
    dims: [2.40, 0.78, 1.16], weight: 470, qty: 14, mode6: false,
    tint: [1, 1, 1], desc: 'Kilim tahta / sazlam kereste demeti',
  },
  {
    id: 'lumber', name: 'Lumber Pack', nameTr: 'Kereste', short: 'LUMBER', mode: 'WOOD',
    dims: [6.00, 0.95, 1.10], weight: 1650, qty: 4, mode6: false,
    tint: [1, 1, 1], desc: '6 metre uzunluğunda kütük demeti',
  },
  {
    id: 'boxes', name: 'Carton Boxes', nameTr: 'Koli', short: 'BOXES', mode: 'BOXES',
    dims: [0.62, 0.42, 0.42], weight: 14, qty: 120, mode6: false,
    tint: [1, 1, 1], desc: 'Mühürlü karton koli',
  },
  {
    id: 'pallets', name: 'Euro Pallets', nameTr: 'Palet', short: 'PALLETS', mode: 'PALLETS',
    dims: [1.20, 1.45, 0.80], weight: 520, qty: 18, mode6: false,
    tint: [1, 1, 1], desc: 'Üzeri yükü ile euro palet',
  },
  {
    id: 'bags', name: 'Cargo Bags', nameTr: 'Çuval', short: 'BAGS', mode: 'BAGS',
    dims: [0.72, 0.26, 0.46], weight: 28, qty: 130, mode6: false,
    tint: [1, 1, 1], desc: 'Dokuma polipropilen çuval',
  },
  {
    id: 'grainBags', name: 'Grain Bags', nameTr: 'Tahıl Çuvalları', short: 'GRAIN', mode: 'BAGS',
    dims: [0.56, 0.20, 0.36], weight: 52, qty: 150, mode6: false,
    tint: [1, 1, 1], desc: 'Buğday / mısır çuvalları',
  },
  {
    id: 'construction', name: 'Concrete Blocks', nameTr: 'İnşaat Malzemesi', short: 'BUILD', mode: 'GENERAL',
    dims: [1.20, 0.52, 0.58], weight: 1180, qty: 12, mode6: false,
    tint: [1, 1, 1], desc: 'Beton blok / harç torbası',
  },
  {
    id: 'pipes', name: 'Steel Pipes', nameTr: 'Boru', short: 'PIPES', mode: 'PIPES',
    dims: [6.00, 0.52, 0.52], weight: 430, qty: 6, mode6: false,
    tint: [1, 1, 1], desc: '6 metre çelik boru demeti',
  },
  {
    id: 'metal', name: 'Metal Sheets', nameTr: 'Metal Levha', short: 'METAL', mode: 'GENERAL',
    dims: [2.05, 0.42, 1.02], weight: 380, qty: 26, mode6: false,
    tint: [1, 1, 1], desc: 'Sac levha istifi',
  },
  {
    id: 'insulation', name: 'Insulation Rolls', nameTr: 'Yalıtım', short: 'INSUL', mode: 'GENERAL',
    dims: [1.22, 0.62, 0.62], weight: 24, qty: 40, mode6: false,
    tint: [1, 1, 1], desc: 'Cam yünü rulo yalıtım',
  },
  {
    id: 'machinery', name: 'Machinery Crate', nameTr: 'Makine Kasası', short: 'MACHINE', mode: 'GENERAL',
    dims: [1.85, 1.45, 1.15], weight: 2250, qty: 4, mode6: false,
    tint: [1, 1, 1], desc: 'Ağır makine nakliye kasası',
  },
  {
    id: 'agri', name: 'Produce Crates', nameTr: 'Sebze / Meyve', short: 'AGRI', mode: 'GENERAL',
    dims: [1.20, 0.38, 0.60], weight: 265, qty: 30, mode6: false,
    tint: [1, 1, 1], desc: 'Mahsul kasa istifi',
  },
  {
    id: 'general', name: 'General Cargo', nameTr: 'Genel Yük', short: 'GENERAL', mode: 'GENERAL',
    dims: [1.05, 0.95, 0.82], weight: 330, qty: 26, mode6: true,
    tint: [1, 1, 1], desc: 'Özel ölçülü genel yük kasası',
  },
];
const CARGO_BY_ID = {};
for (const t of CARGO_TYPES) CARGO_BY_ID[t.id] = t;

/* ============================================================== meshes ==== */
const meshCache = {};

function palletMesh(L, W, m) {
  // euro pallet: 3 blocks, 3 bottom boards, 5 top boards
  const h = 0.145;
  for (let i = 0; i < 3; i++) {
    const x = -L / 2 + 0.075 + i * (L - 0.15) / 2;
    m.box(x, h * 0.5, 0, 0.10, h, W - 0.02, { color: [0.86, 0.80, 0.68], uvScale: 3 });
  }
  for (let i = 0; i < 3; i++) {
    const z = -W / 2 + 0.07 + i * (W - 0.14) / 2;
    m.box(0, 0.018, z, L, 0.022, 0.10, { color: [0.82, 0.76, 0.64], uvScale: 3 });
  }
  for (let i = 0; i < 3; i++) {
    const z = -W / 2 + 0.07 + i * (W - 0.14) / 2;
    m.box(0, 0.052, z, L, 0.020, 0.10, { color: [0.84, 0.78, 0.66], uvScale: 3 });
  }
  const nb = 5;
  for (let i = 0; i < nb; i++) {
    const z = -W / 2 + 0.055 + i * (W - 0.11) / (nb - 1);
    m.box(0, h - 0.011, z, L, 0.022, 0.095, { color: [0.90, 0.84, 0.72], uvScale: 3 });
  }
  // chamfered blocks
  for (let i = 0; i < 3; i++) {
    const x = -L / 2 + 0.075 + i * (L - 0.15) / 2;
    for (const z of [-W / 2 + 0.055, W / 2 - 0.055]) {
      m.box(x, 0.032, z, 0.105, 0.05, 0.075, { color: [0.80, 0.74, 0.62] });
    }
  }
  return m;
}

function cargoMesh(typeId, d) {
  const key = typeId + '|' + d.map((v) => v.toFixed(3)).join(',');
  if (meshCache[key]) return meshCache[key];
  const [L, H, W] = d;
  const m = new Mesh();
  // deterministic per-type geometry, independent of call order
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = (h * 16777619) >>> 0; }
  resetSeed(h || 1337);
  switch (typeId) {
    case 'wood': {
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const y = 0.055 + r * ((H - 0.11) / (rows - 1));
        const n = 5 - (r > 2 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const z = -W / 2 + 0.085 + i * (W - 0.17) / Math.max(1, n - 1);
          const l = L * (0.94 + ((r + i) % 3) * 0.03);
          const jitter = ((i * 7 + r * 13) % 5) * 0.006;
          m.push();
          m.load(M.compose(M.create(), (rnd() - 0.5) * 0.05, y, z, 0, 0, 0, 1, 1, 1));
          m.rbox(0, 0, 0, l, (H - 0.11) / rows * 0.86, W / n * 0.90, 0.012, 1, { color: [0.92, 0.86, 0.74], jitter });
          m.pop();
        }
      }
      // banding straps
      for (const x of [-L * 0.28, L * 0.28]) {
        m.box(x, H / 2, 0, 0.035, H + 0.02, W + 0.02, { color: [0.20, 0.21, 0.24] });
      }
      // end cross boards
      for (const s of [-1, 1]) {
        m.box(s * (L / 2 + 0.03), H / 2, 0, 0.05, H + 0.06, 0.10, { color: [0.86, 0.80, 0.68] });
      }
      break;
    }
    case 'lumber': {
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        const y = 0.06 + r * ((H - 0.12) / (rows - 1));
        const n = 7 - r;
        for (let i = 0; i < n; i++) {
          const z = -W / 2 + 0.07 + i * (W - 0.14) / Math.max(1, n - 1);
          m.push();
          m.load(M.compose(M.create(), 0, y, z, 0, 0, 0, 1, 1, 1));
          m.box(0, 0, 0, L * 0.99, (H - 0.12) / rows * 0.8, 0.075, { color: [0.90, 0.83, 0.70], jitter: 0.07 });
          m.pop();
        }
      }
      for (const x of [-L * 0.3, 0, L * 0.3]) m.box(x, H / 2, 0, 0.03, H + 0.01, W + 0.01, { color: [0.18, 0.19, 0.22] });
      break;
    }
    case 'boxes': {
      m.rbox(0, H / 2, 0, L, H, W, 0.022, 2, { color: [1, 1, 1], uvScale: 1.0, jitter: 0.03 });
      // flap seam
      m.box(0, H + 0.002, 0, 0.012, 0.004, W * 0.98, { color: [0.82, 0.72, 0.56] });
      m.box(0, H / 2, 0, 0.006, H * 0.9, W * 0.98, { color: [0.86, 0.76, 0.60] });
      break;
    }
    case 'pallets': {
      const pm = new Mesh();
      palletMesh(L, W, pm);
      const py = 0.145;
      // shrink-wrapped carton stack
      const rows = 4, cols = 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bw = L / cols * 0.94, bd = W / cols * 0.94;
          const bx = -L / 2 + L / cols * (c + 0.5);
          const bz = -W / 2 + W / cols * (r + 0.5);
          const bh = (H - py) / rows * 0.93;
          m.rbox(bx, py + bh / 2 + r * ((H - py) / rows), bz, bd, bh, bw, 0.020, 2,
            { color: [0.96, 0.93, 0.86], jitter: 0.03 });
        }
      }
      // wrap film sheen
      m.box(0, (H + py) / 2, 0, L + 0.012, H - py + 0.01, W + 0.012, { color: [0.88, 0.90, 0.92] });
      // merge the pallet (built separately) into the main mesh
      pm.build();
      const base = m.count;
      for (let i = 0; i < pm.v.length; i++) m.v.push(pm.v[i]);
      for (let i = 0; i < pm.idx.length; i++) m.idx.push(base + pm.idx[i]);
      break;
    }
    case 'bags':
    case 'grainBags': {
      const rows = 2, cols = 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = -L / 2 + L / cols * (c + 0.5);
          const bz = -W / 2 + W / cols * (r + 0.5);
          const bw = L / cols * 0.95, bd = W / cols * 0.95;
          const by = H * (r + 0.5) / rows;
          m.push();
          m.load(M.compose(M.create(), bx, by, bz, 0, 0, 0, 1, 1, 1));
          m.rbox(0, 0, 0, bw, H / rows * 0.94, bd, Math.min(bw, bd, H) * 0.46, 4, { color: [1, 1, 1], jitter: 0.03 });
          // stitched seam
          m.box(0, H / rows * 0.47, 0, bw * 0.92, 0.006, bd * 0.92, { color: [0.80, 0.78, 0.72] });
          m.pop();
        }
      }
      break;
    }
    case 'construction': {
      const rows = 3;
      for (let r = 0; r < rows; r++) {
        for (let l = 0; l < 2; l++) {
          const bx = -L / 2 + L / 2 * (l + 0.5);
          const by = (H / rows) * (r + 0.5);
          m.push();
          m.load(M.compose(M.create(), bx, by, 0, 0, 0, 0, 1, 1, 1));
          m.rbox(0, 0, 0, L / 2 * 0.96, H / rows * 0.94, W * 0.96, 0.02, 1, { color: [0.80, 0.78, 0.74], jitter: 0.04 });
          // hollow cores
          for (const z of [-W * 0.22, W * 0.22]) {
            m.box(0, H / rows * 0.47, z, L / 2 * 0.42, 0.02, W * 0.20, { color: [0.42, 0.41, 0.39] });
          }
          m.pop();
        }
      }
      break;
    }
    case 'pipes': {
      const rows = 3, cols = 3;
      const pr = Math.min(L, W) * 0.16;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const by = pr + r * pr * 1.85;
          const bz = -W / 2 + pr + c * pr * 1.85;
          if (by > H - pr * 0.5) continue;
          m.push();
          m.load(M.compose(M.create(), 0, by, bz, 0, 0, 0, 1, 1, 1));
          m.rz(PI / 2);
          m.cyl(0, 0, 0, pr, pr, L * 0.995, 16, { color: [0.86, 0.87, 0.89], caps: false });
          m.pop();
          // bore
          m.push();
          m.load(M.compose(M.create(), L / 2 * 0.995, by, bz, 0, 0, 0, 1, 1, 1));
          m.rz(PI / 2);
          m.cyl(0, 0, 0, pr * 0.72, pr * 0.72, 0.02, 14, { color: [0.10, 0.105, 0.11] });
          m.pop();
        }
      }
      for (const x of [-L * 0.32, L * 0.32]) m.box(x, H / 2, 0, 0.03, H + 0.01, W + 0.01, { color: [0.18, 0.19, 0.22] });
      break;
    }
    case 'metal': {
      const n = 6;
      for (let i = 0; i < n; i++) {
        const y = 0.012 + i * (H - 0.02) / n;
        m.push();
        m.load(M.compose(M.create(), ((i % 3) - 1) * 0.012, y, ((i % 2) - 0.5) * 0.014, 0, 0, 0, 1, 1, 1));
        m.box(0, 0, 0, L, (H - 0.02) / n * 0.9, W, { color: [0.90, 0.92, 0.94], jitter: 0.05 });
        m.pop();
      }
      for (const x of [-L * 0.3, L * 0.3]) m.box(x, H / 2, 0, 0.028, H + 0.008, W + 0.008, { color: [0.16, 0.17, 0.20] });
      break;
    }
    case 'insulation': {
      // bundle of rolls: length along X, 2x2 cross-section in Y/Z
      const dia = Math.min(H, W) * 0.46;
      const ys = [dia * 0.52, H - dia * 0.52];
      const zs = [-W / 2 + dia * 0.52, W / 2 - dia * 0.52];
      for (const y of ys) {
        for (const z of zs) {
          m.push();
          m.load(M.compose(M.create(), 0, y, z, 0, 0, 0, 1, 1, 1));
          m.rz(PI / 2);
          m.cyl(0, 0, 0, dia, dia, L * 0.98, 20, { color: [1, 1, 1] });
          m.pop();
        }
      }
      // banding straps
      for (const sx of [-L * 0.28, L * 0.28]) {
        m.box(sx, H / 2, 0, 0.035, H * 0.99, W * 0.99, { color: [0.30, 0.34, 0.42] });
      }
      break;
    }
    case 'machinery': {
      const t = 0.05;
      // slatted crate walls
      for (const s of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          m.box(0, t / 2 + i * (H - t) / 4, s * (W / 2 - t / 2), L, (H - t) / 5.2, t, { color: [0.88, 0.82, 0.70], jitter: 0.05 });
        }
        for (let i = 0; i < 4; i++) {
          m.box(s * (L / 2 - t / 2), t / 2 + i * (H - t) / 3, 0, t, (H - t) / 4.2, W, { color: [0.86, 0.80, 0.68], jitter: 0.05 });
        }
      }
      // lid
      for (let i = 0; i < 5; i++) {
        m.box(0, H - t / 2, -W / 2 + t / 2 + i * (W - t) / 4, L, t, (W - t) / 5, { color: [0.90, 0.84, 0.72], jitter: 0.05 });
      }
      // steel corner brackets
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        m.box(sx * (L / 2 - 0.06), 0.06, sz * (W / 2 - 0.06), 0.12, 0.12, 0.12, { color: [0.45, 0.46, 0.48] });
        m.box(sx * (L / 2 - 0.06), H - 0.06, sz * (W / 2 - 0.06), 0.12, 0.12, 0.12, { color: [0.45, 0.46, 0.48] });
      }
      // machine visible through the crate top
      m.push();
      m.load(M.compose(M.create(), 0, H * 0.42, 0, 0, 0, 0, 1, 1, 1));
      m.rbox(0, 0, 0, L * 0.62, H * 0.55, W * 0.62, 0.04, 2, { color: [0.24, 0.26, 0.30] });
      m.cyl(L * 0.20, H * 0.30, 0, 0.10, 0.09, 0.30, 12, { color: [0.36, 0.38, 0.42] });
      m.pop();
      break;
    }
    case 'agri': {
      // slatted crate
      for (let i = 0; i < 3; i++) {
        m.box(0, 0.04 + i * (H - 0.08) / 2, W / 2 - 0.012, L, (H - 0.08) / 3.4, 0.024, { color: [0.86, 0.80, 0.66] });
        m.box(0, 0.04 + i * (H - 0.08) / 2, -W / 2 + 0.012, L, (H - 0.08) / 3.4, 0.024, { color: [0.86, 0.80, 0.66] });
      }
      for (let i = 0; i < 4; i++) {
        m.box(L / 2 - 0.012, 0.04 + i * (H - 0.08) / 2, 0, 0.024, (H - 0.08) / 4.4, W, { color: [0.84, 0.78, 0.64] });
        m.box(-L / 2 + 0.012, 0.04 + i * (H - 0.08) / 2, 0, 0.024, (H - 0.08) / 4.4, W, { color: [0.84, 0.78, 0.64] });
      }
      // produce
      for (let i = 0; i < 26; i++) {
        const px = ((i * 37) % 11) / 11 * L * 0.82 - L * 0.41;
        const pz = ((i * 53) % 7) / 7 * W * 0.74 - W * 0.37;
        const py = H * 0.62 + ((i * 17) % 5) * 0.016;
        const c = i % 3;
        const col = c === 0 ? [0.85, 0.62, 0.18] : c === 1 ? [0.72, 0.24, 0.16] : [0.40, 0.58, 0.22];
        m.push();
        m.load(M.compose(M.create(), px, py, pz, 0, 0, 0, 1, 1, 1));
        m.sphere(0, 0, 0, 0.055, 7, 5, { color: col });
        m.pop();
      }
      break;
    }
    default: {
      // general cargo crate
      const t = 0.045;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          m.box(0, t / 2 + i * (H - t) / 3, s * (W / 2 - t / 2), L, (H - t) / 4.4, t, { color: [0.85, 0.79, 0.66], jitter: 0.05 });
        }
        m.box(s * (L / 2 - t / 2), H / 2, 0, t, H, W, { color: [0.83, 0.77, 0.64], jitter: 0.05 });
      }
      for (let i = 0; i < 5; i++) {
        m.box(0, H - t / 2, -W / 2 + t / 2 + i * (W - t) / 4, L, t, (W - t) / 5, { color: [0.88, 0.82, 0.70], jitter: 0.05 });
      }
      m.box(0, H * 0.55, W / 2 + 0.002, L * 0.55, H * 0.30, 0.004, { color: [0.95, 0.95, 0.95] });
      break;
    }
  }
  const out = m.build();
  meshCache[key] = out;
  return out;
}

function cargoMaterial(typeId, TEX) {
  const t = CARGO_BY_ID[typeId];
  switch (typeId) {
    case 'wood':
    case 'lumber':
    case 'agri':
    case 'general':
    case 'machinery':
      return { albedo: [1, 1, 1], rough: 0.72, metal: 0.0, tex: TEX.lumber, texScale: [0.45, 0.45] };
    case 'boxes':
      return { albedo: [1, 1, 1], rough: 0.80, metal: 0.0, tex: TEX.cardboard, texScale: [1, 1] };
    case 'pallets':
      return { albedo: [1, 1, 1], rough: 0.68, metal: 0.0, tex: TEX.cardboardPlain, texScale: [0.8, 0.8] };
    case 'bags':
      return { albedo: [1, 1, 1], rough: 0.84, metal: 0.0, tex: TEX.bag, texScale: [1, 1] };
    case 'grainBags':
      return { albedo: [1, 1, 1], rough: 0.84, metal: 0.0, tex: TEX.grainBag, texScale: [1, 1] };
    case 'construction':
      return { albedo: [0.88, 0.88, 0.86], rough: 0.86, metal: 0.0 };
    case 'pipes':
      return { albedo: [0.80, 0.82, 0.85], rough: 0.30, metal: 0.90, tex: TEX.metal, texScale: [0.6, 0.6] };
    case 'metal':
      return { albedo: [0.84, 0.87, 0.90], rough: 0.22, metal: 0.95, tex: TEX.metal, texScale: [0.5, 0.5] };
    case 'insulation':
      return { albedo: [1, 1, 1], rough: 0.92, metal: 0.0, tex: TEX.insulation, texScale: [1, 1] };
    default:
      return { albedo: t ? t.tint : [0.8, 0.8, 0.8], rough: 0.7, metal: 0.0 };
  }
}

/* ============================================================== planner === */
/* Greedy 3D shelf packer: stacks low, loads from the front, balances sides. */
function planLoad(items, box) {
  // box: {x0,x1,y0,y1,z0,z1}
  const placed = [];
  const candidates = [
    { x: box.x1, z: box.z1 },
    { x: box.x1, z: box.z0 },
  ];
  const GAP = 0.012;
  const out = [];
  let totalW = 0;
  for (const it of items) {
    const [L, H, W] = it.dims;
    let best = null, bestScore = -Infinity;
    for (let ci = 0; ci < candidates.length; ci++) {
      const c = candidates[ci];
      const x0 = c.x - L, z0 = c.z - W;
      if (x0 < box.x0 - 1e-6 || z0 < box.z0 - 1e-6 || z0 + W > box.z1 + 1e-6 || x0 + L > box.x1 + 1e-6) continue;
      // support height
      let y = box.y0;
      let overlap = 0;
      for (const p of placed) {
        if (x0 + L <= p.x0 + GAP || x0 >= p.x1 - GAP || z0 + W <= p.z0 + GAP || z0 >= p.z1 - GAP) continue;
        overlap++;
        y = Math.max(y, p.y1 + GAP);
      }
      if (y + H > box.y1 + 1e-6) continue;
      const centreZ = z0 + W / 2;
      const score = -y * 3 + (x0 + L) * 1.2 - Math.abs(centreZ) * 0.35 - overlap * 0.05;
      if (score > bestScore) { bestScore = score; best = { x0, y0: y, z0 }; }
    }
    if (!best) break;                                  // no room left
    const p = {
      id: it.id, typeId: it.typeId, index: it.index,
      dims: it.dims, weight: it.weight,
      x: best.x0 + L / 2, y: best.y0 + H / 2, z: best.z0 + W / 2,
      yaw: it.yaw || 0,
    };
    placed.push({ x0: best.x0, x1: best.x0 + L, y0: best.y0, y1: best.y0 + H, z0: best.z0, z1: best.z0 + W });
    out.push(p);
    totalW += it.weight;
    // new anchors
    const nx = [
      { x: best.x0, z: best.z0 }, { x: best.x0, z: best.z0 + W },
      { x: best.x0 + L, z: best.z0 }, { x: best.x0 + L, z: best.z0 + W },
      { x: best.x0, z: best.z0 - W }, { x: best.x0, z: best.z0 + 2 * W },
      { x: best.x0 - L, z: best.z0 }, { x: best.x0 - L, z: best.z0 + W },
    ];
    for (const n of nx) candidates.push(n);
    if (candidates.length > 180) candidates.splice(2, candidates.length - 176);
  }
  return { placements: out, totalWeight: totalW };
}

/* ============================================================ forklift ==== */
function buildForklift(renderer, TEX) {
  const parts = [];
  const add = (data, mat, tag) => {
    const p = renderer.add(data, mat, null, tag);
    p.visible = false;
    parts.push(p);
    return p;
  };
  const yellow = { albedo: [0.86, 0.55, 0.05], rough: 0.35, metal: 0.15, reflectance: 0.06 };
  const yellowDark = { albedo: [0.62, 0.38, 0.03], rough: 0.40, metal: 0.15 };
  const dark = { albedo: [0.045, 0.048, 0.052], rough: 0.55, metal: 0.35 };
  const steel = { albedo: [0.60, 0.62, 0.65], rough: 0.30, metal: 0.9, tex: TEX.metal, texScale: [1, 1] };
  const rubber = { albedo: [0.020, 0.021, 0.023], rough: 0.85 };

  /* chassis */
  const chassis = new Mesh();
  chassis.rbox(0, 0.62, -0.10, 1.42, 0.62, 1.05, 0.06, 2, { color: [1, 1, 1] });
  chassis.box(0, 0.36, -0.10, 1.30, 0.14, 0.92, { color: [0.8, 0.8, 0.8] });
  // counterweight
  chassis.push();
  chassis.load(M.compose(M.create(), -0.66, 0.62, 0, 0, 0, 0, 1, 1, 1));
  chassis.rbox(0, 0, 0, 0.34, 0.78, 1.02, 0.10, 3, { color: [0.75, 0.48, 0.04] });
  chassis.pop();
  // operator compartment
  chassis.box(0.12, 1.06, -0.10, 0.62, 0.10, 0.70, { color: [0.30, 0.31, 0.33] });
  chassis.box(-0.22, 1.28, -0.10, 0.12, 0.46, 0.62, { color: [0.26, 0.27, 0.29] });
  chassis.push();
  chassis.load(M.compose(M.create(), 0.46, 1.22, -0.10, 0, 0, 0, 1, 1, 1));
  chassis.rz(PI / 2);
  chassis.cyl(0, 0, 0, 0.16, 0.16, 0.05, 16, { color: [0.05, 0.05, 0.06] });
  chassis.pop();
  /* overhead guard */
  for (const sx of [-0.34, 0.42]) for (const sz of [-0.44, 0.24]) {
    chassis.push();
    chassis.load(M.compose(M.create(), sx, 1.60, sz, 0, 0, 0, 1, 1, 1));
    chassis.box(0, 0, 0, 0.055, 0.90, 0.055, { color: [0.9, 0.6, 0.06] });
    chassis.pop();
  }
  for (let i = 0; i < 5; i++) {
    chassis.box(0.04, 2.06, -0.44 + i * 0.17, 0.86, 0.05, 0.07, { color: [0.9, 0.6, 0.06] });
  }
  /* mast rails (fixed part) */
  for (const sz of [-0.36, 0.16]) {
    chassis.push();
    chassis.load(M.compose(M.create(), 0.80, 1.35, sz, 0, 0, 0, 1, 1, 1));
    chassis.box(0, 0, 0, 0.10, 2.30, 0.09, { color: [0.35, 0.36, 0.38] });
    chassis.pop();
  }
  chassis.push();
  chassis.load(M.compose(M.create(), 0.86, 0.42, -0.10, 0, 0, 0, 1, 1, 1));
  chassis.box(0, 0, 0, 0.16, 0.16, 0.62, { color: [0.30, 0.31, 0.33] });
  chassis.pop();
  add(chassis.build(), yellow, 'fkChassis');

  /* carriage + forks (animated vertically) */
  const carriage = new Mesh();
  carriage.box(0, 0, -0.10, 0.07, 0.62, 0.66, { color: [0.42, 0.43, 0.46] });
  carriage.box(0.04, 0, -0.10, 0.05, 0.24, 0.66, { color: [0.36, 0.37, 0.40] });
  for (const sz of [-0.36, 0.16]) {
    carriage.push();
    carriage.load(M.compose(M.create(), 0.36, -0.03, sz, 0, 0, 0, 1, 1, 1));
    carriage.box(0, 0, 0, 0.70, 0.045, 0.12, { color: [0.55, 0.56, 0.58] });
    carriage.box(0.70, -0.03, 0, 0.05, 0.16, 0.12, { color: [0.55, 0.56, 0.58] });
    carriage.pop();
  }
  add(carriage.build(), steel, 'fkCarriage');

  /* wheels */
  const wFront = new Mesh(), wRear = new Mesh();
  for (const sz of [-0.42, 0.22]) {
    wFront.push();
    wFront.load(M.compose(M.create(), 0.50, 0.28, sz, 0, 0, 0, 1, 1, 1));
    wFront.rx(PI / 2);
    wFront.cyl(0, 0, 0, 0.28, 0.28, 0.18, 18, { color: [1, 1, 1], caps: false });
    wFront.pop();
  }
  for (const sz of [-0.36, 0.16]) {
    wRear.push();
    wRear.load(M.compose(M.create(), -0.58, 0.21, sz, 0, 0, 0, 1, 1, 1));
    wRear.rx(PI / 2);
    wRear.cyl(0, 0, 0, 0.21, 0.21, 0.16, 14, { color: [1, 1, 1], caps: false });
    wRear.pop();
  }
  add(wFront.build(), rubber, 'fkWheelF');
  add(wRear.build(), rubber, 'fkWheelR');
  const hubs = new Mesh();
  for (const sz of [-0.42, 0.22]) {
    hubs.push();
    hubs.load(M.compose(M.create(), 0.50, 0.28, sz + (sz < -0.2 ? -0.10 : 0.10), 0, 0, 0, 1, 1, 1));
    hubs.rx(PI / 2);
    hubs.cyl(0, 0, 0, 0.12, 0.12, 0.03, 12, { color: [0.75, 0.76, 0.78] });
    hubs.pop();
  }
  add(hubs.build(), steel, 'fkHubs');
  /* beacon */
  const beacon = new Mesh();
  beacon.cyl(-0.10, 2.14, -0.10, 0.055, 0.055, 0.09, 12, { color: [1, 0.5, 0.05] });
  add(beacon.build(), { albedo: [1, 0.5, 0.05], rough: 0.2, emis: [0.55, 0.24, 0.01], opacity: 0.9 }, 'fkBeacon');

  return { parts, setVisible(v) { for (const p of parts) p.visible = v; } };
}

/* Forklift motion path (relative to a trailer box). */
function forkliftPath(box) {
  const sideZ = box.z1 + 2.4;
  return [
    [box.x0 - 5.6, sideZ + 1.4],
    [box.x0 - 3.4, sideZ + 0.9],
    [box.x0 - 2.0, sideZ + 0.1],
    [box.x0 - 2.0, box.z1 + 0.55],
    [box.x0 + 1.4, box.z1 + 0.35],
    [box.x1 - 1.0, box.z1 + 0.30],
    [box.x1 - 1.0, box.z1 - 0.10],
    [box.x0 - 1.6, box.z1 + 0.35],
    [box.x0 - 3.2, sideZ + 1.2],
    [box.x0 - 6.4, sideZ + 2.2],
  ];
}