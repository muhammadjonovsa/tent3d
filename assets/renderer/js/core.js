/* ============================================================================
   TENT 3D :: core.js  —  math + procedural geometry toolkit
   Everything in the scene is generated procedurally; no external assets.
   ========================================================================== */
'use strict';

const TAU = Math.PI * 2;
const PI = Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const sstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ---------------------------------------------------------------- Vec3 --- */
const V = {
  of: (x, y, z) => new Float32Array([x || 0, y || 0, z || 0]),
  copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
  set: (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; },
  add: (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
  sub: (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
  mul: (o, a, b) => { o[0] = a[0] * b[0]; o[1] = a[1] * b[1]; o[2] = a[2] * b[2]; return o; },
  scale: (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
  addScaled: (o, a, b, s) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; },
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  cross: (o, a, b) => {
    const x = a[1] * b[2] - a[2] * b[1];
    const y = a[2] * b[0] - a[0] * b[2];
    const z = a[0] * b[1] - a[1] * b[0];
    o[0] = x; o[1] = y; o[2] = z; return o;
  },
  norm: (o, a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
  },
  lerp: (o, a, b, t) => { o[0] = lerp(a[0], b[0], t); o[1] = lerp(a[1], b[1], t); o[2] = lerp(a[2], b[2], t); return o; },
  withMat: (o, a, m) => {
    const x = a[0], y = a[1], z = a[2];
    o[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    o[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    o[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return o;
  },
  dirMat: (o, a, m) => {
    const x = a[0], y = a[1], z = a[2];
    o[0] = m[0] * x + m[4] * y + m[8] * z;
    o[1] = m[1] * x + m[5] * y + m[9] * z;
    o[2] = m[2] * x + m[6] * y + m[10] * z;
    return o;
  },
};

/* ---------------------------------------------------------------- Mat4 --- */
const M = {
  create: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  ident: (o) => { o.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); return o; },
  copy: (o, a) => { o.set(a); return o; },

  mul: (o, a, b) => {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
      o[i * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
      o[i * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
      o[i * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return o;
  },

  compose: (o, px, py, pz, yaw, pitch, roll, sx, sy, sz) => {
    const cy = Math.cos(yaw), sy_ = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    // R = Ry * Rx * Rz
    const m00 = cy * cr + sy_ * sp * sr, m01 = -cy * sr + sy_ * sp * cr, m02 = sy_ * cp;
    const m10 = cp * sr, m11 = cp * cr, m12 = -sp;
    const m20 = -sy_ * cr + cy * sp * sr, m21 = sy_ * sr + cy * sp * cr, m22 = cy * cp;
    o[0] = m00 * sx; o[1] = m10 * sx; o[2] = m20 * sx; o[3] = 0;
    o[4] = m01 * sy; o[5] = m11 * sy; o[6] = m21 * sy; o[7] = 0;
    o[8] = m02 * sz; o[9] = m12 * sz; o[10] = m22 * sz; o[11] = 0;
    o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
    return o;
  },

  translate: (o, x, y, z) => { M.ident(o); o[12] = x; o[13] = y; o[14] = z; return o; },
  scaleM: (o, x, y, z) => { M.ident(o); o[0] = x; o[5] = y; o[10] = z; return o; },
  rotX: (o, a) => { M.ident(o); const c = Math.cos(a), s = Math.sin(a); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  rotY: (o, a) => { M.ident(o); const c = Math.cos(a), s = Math.sin(a); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  rotZ: (o, a) => { M.ident(o); const c = Math.cos(a), s = Math.sin(a); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },

  persp: (o, fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = f / aspect; o[5] = f; o[11] = -1;
    o[10] = (far + near) / (near - far);
    o[14] = (2 * far * near) / (near - far);
    return o;
  },
  ortho: (o, l, r, b, t, n, f) => {
    o.fill(0);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
    o[15] = 1;
    return o;
  },
  lookAt: (o, eye, ctr, up) => {
    let zx = eye[0] - ctr[0], zy = eye[1] - ctr[1], zz = eye[2] - ctr[2];
    let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz);
    if (l < 1e-6) { xx = 1; xy = 0; xz = 0; } else { xx /= l; xy /= l; xz /= l; }
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    o[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    o[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    o[15] = 1;
    return o;
  },
  invert: (o, m) => {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M.ident(o);
    det = 1 / det;
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },
};

/* Normal matrix (transpose of inverse upper 3x3), written into a mat3 array */
function normalMat3(out, m) {
  const t = M.invert(new Float32Array(16), m);
  out[0] = t[0]; out[1] = t[4]; out[2] = t[8];
  out[3] = t[1]; out[4] = t[5]; out[5] = t[9];
  out[6] = t[2]; out[7] = t[6]; out[8] = t[10];
  return out;
}

/* ---------------------------------------------------------- MeshBuilder --- */
class Mesh {
  constructor() {
    this.v = [];            // interleaved: px py pz nx ny nz u v r g b ao
    this.idx = [];
    this.m = M.create();
    this.nm = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this.stack = [];
  }
  get count() { return this.v.length / 12; }

  push() { this.stack.push(new Float32Array(this.m)); return this; }
  pop() { this.m = this.stack.pop(); this._dirty(); return this; }
  _dirty() { normalMat3(this.nm, this.m); }
  load(m) { this.m.set(m); this._dirty(); return this; }
  reset() { M.ident(this.m); this._dirty(); return this; }
  t(x, y, z) { const t = M.create(); M.compose(t, x, y, z, 0, 0, 0, 1, 1, 1); M.mul(this.m, this.m, t); this._dirty(); return this; }
  rx(a) { const t = M.rotX(M.create(), a); M.mul(this.m, this.m, t); this._dirty(); return this; }
  ry(a) { const t = M.rotY(M.create(), a); M.mul(this.m, this.m, t); this._dirty(); return this; }
  rz(a) { const t = M.create(), c = Math.cos(a), s = Math.sin(a);
    M.ident(t); t[0] = c; t[1] = s; t[4] = -s; t[5] = c; M.mul(this.m, this.m, t); this._dirty(); return this; }
  s(x, y, z) { const t = M.scaleM(M.create(), x, y === undefined ? x : y, z === undefined ? x : z); M.mul(this.m, this.m, t); this._dirty(); return this; }

  /* raw vertex, local coordinates, normal & colour already local */
  vert(x, y, z, nx, ny, nz, u, v, r, g, b, ao) {
    const m = this.m, nm = this.nm;
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
    let ax = nm[0] * nx + nm[3] * ny + nm[6] * nz;
    let ay = nm[1] * nx + nm[4] * ny + nm[7] * nz;
    let az = nm[2] * nx + nm[5] * ny + nm[8] * nz;
    const l = Math.hypot(ax, ay, az) || 1; ax /= l; ay /= l; az /= l;
    this.v.push(wx, wy, wz, ax, ay, az, u, v, r, g, b, ao === undefined ? 1 : ao);
    return this.v.length / 12 - 1;
  }
  tri(a, b, c) { this.idx.push(a, b, c); return this; }
  quadIdx(a, b, c, d) { this.idx.push(a, b, c, a, c, d); return this; }

  /* Face colours / AO helpers ------------------------------------------------ */
  _col(o) {
    if (!o || !o.color) return [1, 1, 1];
    return o.color;
  }
  _aoAt(o, y, y0, y1) {
    let ao = o && o.ao !== undefined ? o.ao : 1;
    if (o && o.aoTop !== undefined) {
      const t = clamp((y - y0) / (y1 - y0 || 1), 0, 1);
      ao *= lerp(o.aoTop, o.aoBottom === undefined ? o.aoTop : o.aoBottom, t);
    }
    return ao;
  }
  _jit(o, u, v) {
    const j = o && o.jitter ? o.jitter : 0;
    if (!j) return 1;
    const s = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
    return 1 + (s - Math.floor(s) - 0.5) * 2 * j;
  }

  /* ------------------------------------------------------------ primitives */

  /* axis aligned box. o: {uvScale, color, ao, aoTop, aoBottom, jitter, skip, uv:true} */
  box(cx, cy, cz, sx, sy, sz, o) {
    o = o || {};
    if (o.skip) {
      const s = o.skip;
      if (s.indexOf('px') >= 0 || s === 'all') return this;
    }
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const uvs = o.uvScale === undefined ? 1 : o.uvScale;
    const c = this._col(o);
    const y0 = cy - hy, y1 = cy + hy;
    const jit = o.jitter || 0;
    const faces = [
      { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], w: hz, h: hy, off: [hx, 0, 0] },
      { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], w: hz, h: hy, off: [-hx, 0, 0] },
      { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1], w: hx, h: hz, off: [0, hy, 0] },
      { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1], w: hx, h: hz, off: [0, -hy, 0] },
      { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], w: hx, h: hy, off: [0, 0, hz] },
      { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], w: hx, h: hy, off: [0, 0, -hz] },
    ];
    for (let i = 0; i < 6; i++) {
      if (o.skip && o.skip.indexOf(['px', 'nx', 'py', 'ny', 'pz', 'nz'][i]) >= 0) continue;
      const f = faces[i];
      const base = this.count;
      for (let j = 0; j <= 1; j++) {
        for (let k = 0; k <= 1; k++) {
          const a = (k - 0.5) * 2 * f.w, b = (j - 0.5) * 2 * f.h;
          const px = cx + f.off[0] + f.u[0] * a + f.v[0] * b;
          const py = cy + f.off[1] + f.u[1] * a + f.v[1] * b;
          const pz = cz + f.off[2] + f.u[2] * a + f.v[2] * b;
          const jf = 1 + (jit ? (jit * 0.5 * ((i + k * 2 + j) % 2 ? 1 : -1)) : 0);
          this.vert(px, py, pz, f.n[0], f.n[1], f.n[2], (k + 0.5) * f.w * 2 * uvs, (j + 0.5) * f.h * 2 * uvs,
            c[0] * jf, c[1] * jf, c[2] * jf, this._aoAt(o, py, y0, y1));
        }
      }
      this.quadIdx(base, base + 1, base + 3, base + 2);
    }
    return this;
  }

  /* rounded box - the single most important primitive for a believable cab */
  rbox(cx, cy, cz, sx, sy, sz, r, seg, o) {
    o = o || {};
    seg = seg || 3;
    r = Math.min(r, sx / 2 - 1e-4, sy / 2 - 1e-4, sz / 2 - 1e-4);
    const hx = sx / 2 - r, hy = sy / 2 - r, hz = sz / 2 - r;
    const c = this._col(o);
    const uvs = o.uvScale === undefined ? 1 : o.uvScale;
    const jit = o.jitter || 0;
    // [normal, uAxis, vAxis, halfExtentAlongU, halfExtentAlongV, offsetAlongN]
    const dirs = [
      [[1, 0, 0], [0, 0, -1], [0, 1, 0], hz, hy, hx],
      [[-1, 0, 0], [0, 0, 1], [0, 1, 0], hz, hy, hx],
      [[0, 1, 0], [1, 0, 0], [0, 0, 1], hx, hz, hy],
      [[0, -1, 0], [1, 0, 0], [0, 0, -1], hx, hz, hy],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0], hx, hy, hz],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0], hx, hy, hz],
    ];
    for (let i = 0; i < 6; i++) {
      if (o.skip && o.skip.indexOf(['px', 'nx', 'py', 'ny', 'pz', 'nz'][i]) >= 0) continue;
      const d = dirs[i];
      const n3 = d[0], ua = d[1], va = d[2], du = d[3], dv = d[4], dn = d[5];
      const base = this.count;
      for (let j = 0; j <= seg; j++) {
        for (let k = 0; k <= seg; k++) {
          const a = (k / seg - 0.5) * 2, b = (j / seg - 0.5) * 2;
          const lx = n3[0] * dn + ua[0] * a * du + va[0] * b * dv;
          const ly = n3[1] * dn + ua[1] * a * du + va[1] * b * dv;
          const lz = n3[2] * dn + ua[2] * a * du + va[2] * b * dv;
          // corner rounding: push the clamped point out along the corner normal
          const qx = clamp(lx, -hx, hx), qy = clamp(ly, -hy, hy), qz = clamp(lz, -hz, hz);
          let nx = lx - qx, ny = ly - qy, nz = lz - qz;
          const l = Math.hypot(nx, ny, nz);
          if (l < 1e-6) { nx = n3[0]; ny = n3[1]; nz = n3[2]; }
          else { nx /= l; ny /= l; nz /= l; }
          const X = cx + qx + nx * r, Y = cy + qy + ny * r, Z = cz + qz + nz * r;
          const jf = 1 + (jit ? jit * 0.5 * (((i + j + k) % 2) ? 1 : -1) : 0);
          this.vert(X, Y, Z, nx, ny, nz, (k / seg) * du * 2 * uvs, (j / seg) * dv * 2 * uvs,
            c[0] * jf, c[1] * jf, c[2] * jf, this._aoAt(o, Y, cy - sy / 2, cy + sy / 2));
        }
      }
      for (let j = 0; j < seg; j++) {
        for (let k = 0; k < seg; k++) {
          const i0 = base + j * (seg + 1) + k;
          this.quadIdx(i0, i0 + 1, i0 + seg + 2, i0 + seg + 1);
        }
      }
    }
    return this;
  }

  /* cylinder / cone along an axis. axis: 'x'|'y'|'z', theta in radians */
  cyl(cx, cy, cz, r0, r1, len, radial, o) {
    o = o || {};
    o = Object.assign({ axis: 'y', theta0: 0, theta1: TAU, caps: true }, o);
    const c = this._col(o);
    const uvs = o.uvScale === undefined ? 1 : o.uvScale;
    const full = Math.abs(o.theta1 - o.theta0 - TAU) < 1e-6;
    const closed = full ? radial : radial;
    const h = len / 2;
    const map = (a, b, t) => {
      switch (o.axis) {
        case 'x': return [cx + t, cy + b, cz + a];
        case 'z': return [cx + a, cy + b, cz + t];
        default: return [cx + a, cy + t, cz + b];
      }
    };
    const nrmOf = (a, b) => {
      const l = Math.hypot(a, b) || 1;
      switch (o.axis) {
        case 'x': return [0, a / l, b / l];
        case 'z': return [a / l, 0, b / l];
        default: return [a / l, 0, b / l];
      }
    };
    // side
    const base = this.count;
    for (let i = 0; i <= closed; i++) {
      const t = o.theta0 + (o.theta1 - o.theta0) * (i / radial);
      const ca = Math.cos(t) * r0, sa = Math.sin(t) * r0;
      const cb = Math.cos(t) * r1, sb = Math.sin(t) * r1;
      const slope = (r0 - r1) / len;
      for (let j = 0; j <= 1; j++) {
        const p = map(ca, sa, j ? h : -h);
        const nn = nrmOf(Math.cos(t), Math.sin(t));
        // tilt normal by slope
        if (o.axis === 'y') { nn[1] = slope; const l = Math.hypot(nn[0], nn[1], nn[2]); nn[0] /= l; nn[1] /= l; nn[2] /= l; }
        else if (o.axis === 'x') { nn[0] = slope; const l = Math.hypot(nn[0], nn[1], nn[2]); nn[0] /= l; nn[1] /= l; nn[2] /= l; }
        else { nn[2] = slope; const l = Math.hypot(nn[0], nn[1], nn[2]); nn[0] /= l; nn[1] /= l; nn[2] /= l; }
        const r2 = j ? cb : ca, s2 = j ? sb : sa;
        this.vert(p[0], p[1], p[2], nn[0], nn[1], nn[2], t * r0 * uvs, (j ? h : -h) * 2 * uvs,
          c[0], c[1], c[2], this._aoAt(o, p[1], o.axis === 'y' ? cy - h : cy - h, o.axis === 'y' ? cy + h : cy + h));
        void r2; void s2;
      }
    }
    for (let i = 0; i < closed; i++) {
      const a = base + i * 2;
      this.quadIdx(a, a + 1, a + 3, a + 2);
    }
    // caps
    if (o.caps) {
      for (let e = 0; e < 2; e++) {
        const rr = e ? r1 : r0, tt = e ? h : -h;
        const sgn = e ? 1 : -1;
        if (rr <= 1e-6) continue;
        const cbase = this.count;
        const nm = o.axis === 'x' ? [sgn, 0, 0] : o.axis === 'z' ? [0, 0, sgn] : [0, sgn, 0];
        const cc = this.vert(map(0, 0, tt)[0], map(0, 0, tt)[1], map(0, 0, tt)[2], nm[0], nm[1], nm[2], 0.5, 0.5, c[0], c[1], c[2], this._aoAt(o, map(0, 0, tt)[1], cy - h, cy + h));
        for (let i = 0; i <= closed; i++) {
          const t = o.theta0 + (o.theta1 - o.theta0) * (i / radial);
          const p = map(Math.cos(t) * rr, Math.sin(t) * rr, tt);
          this.vert(p[0], p[1], p[2], nm[0], nm[1], nm[2], 0.5 + Math.cos(t) * 0.5, 0.5 + Math.sin(t) * 0.5,
            c[0], c[1], c[2], this._aoAt(o, p[1], cy - h, cy + h));
        }
        for (let i = 0; i < closed; i++) {
          if (sgn > 0) this.tri(cc, cbase + 1 + i, cbase + 2 + i);
          else this.tri(cc, cbase + 2 + i, cbase + 1 + i);
        }
      }
    }
    return this;
  }

  sphere(cx, cy, cz, r, seg, rings, o) {
    o = o || {};
    const c = this._col(o);
    const base = this.count;
    for (let i = 0; i <= rings; i++) {
      const v = i / rings, phi = v * PI;
      for (let j = 0; j <= seg; j++) {
        const u = j / seg, th = u * TAU;
        const nx = Math.sin(phi) * Math.cos(th), ny = Math.cos(phi), nz = Math.sin(phi) * Math.sin(th);
        this.vert(cx + nx * r, cy + ny * r, cz + nz * r, nx, ny, nz, u * 2 * r, v * r,
          c[0], c[1], c[2], this._aoAt(o, cy + ny * r, cy - r, cy + r));
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * (seg + 1) + j;
        this.quadIdx(a, a + 1, a + seg + 2, a + seg + 1);
      }
    }
    return this;
  }

  torus(cx, cy, cz, R, r, seg, tseg, o) {
    o = o || {};
    const c = this._col(o);
    const arc = o.arc === undefined ? TAU : o.arc;
    const a0 = o.arcStart === undefined ? 0 : o.arcStart;
    const base = this.count;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, a = a0 + arc * u;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let j = 0; j <= tseg; j++) {
        const v = j / tseg, b = v * TAU;
        const cb = Math.cos(b), sb = Math.sin(b);
        const nx = ca * cb, ny = sb, nz = sa * cb;
        this.vert(cx + ca * (R + r * cb), cy + r * sb, cz + sa * (R + r * cb), nx, ny, nz, u * R * 4, v * r * 4,
          c[0], c[1], c[2], 1);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < tseg; j++) {
        const a = base + i * (tseg + 1) + j;
        this.quadIdx(a, a + 1, a + tseg + 2, a + tseg + 1);
      }
    }
    return this;
  }

  /* generic quad from 4 world-space points */
  quad(p0, p1, p2, p3, o) {
    o = o || {};
    const c = this._col(o);
    const nx = o.n ? o.n : (() => {
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
      const vx = p3[0] - p0[0], vy = p3[1] - p0[1], vz = p3[2] - p0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    })();
    const uv = o.uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    const b = this.count;
    const ao = o.ao === undefined ? 1 : o.ao;
    const aos = o.aoVec || [ao, ao, ao, ao];
    this.vert(p0[0], p0[1], p0[2], nx[0], nx[1], nx[2], uv[0][0], uv[0][1], c[0], c[1], c[2], aos[0]);
    this.vert(p1[0], p1[1], p1[2], nx[0], nx[1], nx[2], uv[1][0], uv[1][1], c[0], c[1], c[2], aos[1]);
    this.vert(p2[0], p2[1], p2[2], nx[0], nx[1], nx[2], uv[2][0], uv[2][1], c[0], c[1], c[2], aos[2]);
    this.vert(p3[0], p3[1], p3[2], nx[0], nx[1], nx[2], uv[3][0], uv[3][1], c[0], c[1], c[2], aos[3]);
    this.quadIdx(b, b + 1, b + 2, b + 3);
    return this;
  }

  /* grid surface: fn(u,v) -> [x,y,z] */
  grid(x0, z0, w, d, nx, nz, fn, o) {
    o = o || {};
    const c = this._col(o);
    const base = this.count;
    for (let i = 0; i <= nz; i++) {
      for (let j = 0; j <= nx; j++) {
        const u = j / nx, v = i / nz;
        const p = fn(u, v);
        // normal from finite differences
        const e = 1e-3;
        const pu = fn(Math.min(u + e, 1), v), pv = fn(u, Math.min(v + e, 1));
        const ax = pu[0] - p[0], ay = pu[1] - p[1], az = pu[2] - p[2];
        const bx = pv[0] - p[0], by = pv[1] - p[1], bz = pv[2] - p[2];
        let nx2 = ay * bz - az * by, ny2 = az * bx - ax * bz, nz2 = ax * by - ay * bx;
        const l = Math.hypot(nx2, ny2, nz2) || 1;
        nx2 /= l; ny2 /= l; nz2 /= l;
        this.vert(p[0], p[1], p[2], nx2, ny2, nz2, u * (o.uvScale || 1) * w, v * (o.uvScale || 1) * d,
          c[0], c[1], c[2], this._aoAt(o, p[1], o.aoY0 === undefined ? 0 : o.aoY0, o.aoY1 === undefined ? 3 : o.aoY1));
      }
    }
    for (let i = 0; i < nz; i++) {
      for (let j = 0; j < nx; j++) {
        const a = base + i * (nx + 1) + j;
        this.quadIdx(a, a + 1, a + nx + 2, a + nx + 1);
      }
    }
    void x0; void z0; void w; void d;
    return this;
  }

  /* sweep a closed 2D profile (array of [a,b]) along a 3D polyline using
     parallel transport frames.  Great for chassis rails, bows, pipes, trim. */
  sweep(path, profile, o) {
    o = o || {};
    const c = this._col(o);
    const closed = !!o.closedProfile;
    const n = path.length, m = profile.length;
    if (n < 2) return this;
    // tangents
    const T = [];
    for (let i = 0; i < n; i++) {
      const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
      const l = Math.hypot(tx, ty, tz) || 1;
      T.push([tx / l, ty / l, tz / l]);
    }
    // initial normal
    let Nn;
    if (o.up) {
      const up = o.up;
      let d = T[0][0] * up[0] + T[0][1] * up[1] + T[0][2] * up[2];
      Nn = [up[0] - T[0][0] * d, up[1] - T[0][1] * d, up[2] - T[0][2] * d];
    } else {
      const t = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let d = T[0][0] * t[0] + T[0][1] * t[1] + T[0][2] * t[2];
      Nn = [t[0] - T[0][0] * d, t[1] - T[0][1] * d, t[2] - T[0][2] * d];
    }
    const nl = Math.hypot(Nn[0], Nn[1], Nn[2]) || 1;
    Nn = [Nn[0] / nl, Nn[1] / nl, Nn[2] / nl];
    const base = this.count;
    const B = [];
    let prevN = Nn;
    for (let i = 0; i < n; i++) {
      const t = T[i];
      let nx3 = prevN;
      // project previous normal onto plane perpendicular to t
      let d = t[0] * nx3[0] + t[1] * nx3[1] + t[2] * nx3[2];
      nx3 = [nx3[0] - t[0] * d, nx3[1] - t[1] * d, nx3[2] - t[2] * d];
      let l2 = Math.hypot(nx3[0], nx3[1], nx3[2]);
      if (l2 < 1e-5) { nx3 = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; d = t[0] * nx3[0] + t[1] * nx3[1] + t[2] * nx3[2]; nx3 = [nx3[0] - t[0] * d, nx3[1] - t[1] * d, nx3[2] - t[2] * d]; l2 = Math.hypot(nx3[0], nx3[1], nx3[2]) || 1; }
      nx3 = [nx3[0] / l2, nx3[1] / l2, nx3[2] / l2];
      prevN = nx3;
      const bx = t[1] * nx3[2] - t[2] * nx3[1], by = t[2] * nx3[0] - t[0] * nx3[2], bz = t[0] * nx3[1] - t[1] * nx3[0];
      B.push([bx, by, bz]);
      let acc = 0;
      for (let j = 0; j < m; j++) {
        const p = profile[j];
        const X = path[i][0] + nx3[0] * p[0] + bx * p[1];
        const Y = path[i][1] + nx3[1] * p[0] + by * p[1];
        const Z = path[i][2] + nx3[2] * p[0] + bz * p[1];
        if (j > 0) acc += Math.hypot(profile[j][0] - profile[j - 1][0], profile[j][1] - profile[j - 1][1]);
        this.vert(X, Y, Z, nx3[0], nx3[1], nx3[2], acc, i * 0.25, c[0], c[1], c[2],
          this._aoAt(o, Y, o.aoY0 === undefined ? -99 : o.aoY0, o.aoY1 === undefined ? 99 : o.aoY1));
      }
    }
    const lim = closed ? m : m - 1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < lim; j++) {
        const j2 = (j + 1) % m;
        const a = base + i * m + j, b = base + i * m + j2;
        const cc = base + (i + 1) * m + j2, d = base + (i + 1) * m + j;
        this.quadIdx(a, b, cc, d);
      }
    }
    if (o.caps) {
      // simple end caps using triangle fan (profiles here are convex)
      for (let e = 0; e < 2; e++) {
        const i = e ? n - 1 : 0;
        const t = T[e ? n - 1 : 0];
        const s = e ? 1 : -1;
        const cb = this.count;
        let cxp = 0, cyp = 0, czp = 0;
        for (let j = 0; j < m; j++) {
          cxp += path[i][0] + B[i][0] * 0; cyp += 0; czp += 0;
        }
        const px = [], py = [], pz = [];
        for (let j = 0; j < m; j++) {
          const vi = base + i * m + j;
          px.push(this.v[vi * 12]); py.push(this.v[vi * 12 + 1]); pz.push(this.v[vi * 12 + 2]);
        }
        let ccx = 0, ccy = 0, ccz = 0;
        for (let j = 0; j < m; j++) { ccx += px[j]; ccy += py[j]; ccz += pz[j]; }
        ccx /= m; ccy /= m; ccz /= m;
        const centre = this.vert(ccx, ccy, ccz, t[0] * s, t[1] * s, t[2] * s, 0.5, 0.5, c[0], c[1], c[2], 1);
        for (let j = 0; j < m; j++) {
          const vi = base + i * m + j;
          this.v[vi * 12 + 3] = t[0] * s; this.v[vi * 12 + 4] = t[1] * s; this.v[vi * 12 + 5] = t[2] * s;
          this.v[vi * 12 + 6] = 0.5 + Math.cos(j / m * TAU) * 0.5;
          this.v[vi * 12 + 7] = 0.5 + Math.sin(j / m * TAU) * 0.5;
        }
        for (let j = 0; j < m; j++) {
          const a0 = base + i * m + j, a1 = base + i * m + ((j + 1) % m);
          if (s > 0) this.tri(centre, a1, a0); else this.tri(centre, a0, a1);
        }
        void cb; void cxp; void cyp; void czp;
      }
    }
    return this;
  }

  /* extrude a closed CCW 2D polygon (in XY) along +Z */
  extrude(poly, depth, o) {
    o = o || {};
    const c = this._col(o);
    const hz = depth / 2;
    const m = poly.length;
    // side walls
    for (let i = 0; i < m; i++) {
      const a = poly[i], b = poly[(i + 1) % m];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const b0 = this.count;
      this.vert(a[0], a[1], -hz, nx, ny, 0, 0, 0, c[0], c[1], c[2], 1);
      this.vert(b[0], b[1], -hz, nx, ny, 0, len, 0, c[0], c[1], c[2], 1);
      this.vert(b[0], b[1], hz, nx, ny, 0, len, depth, c[0], c[1], c[2], 1);
      this.vert(a[0], a[1], hz, nx, ny, 0, 0, depth, c[0], c[1], c[2], 1);
      this.quadIdx(b0, b0 + 1, b0 + 2, b0 + 3);
    }
    // caps (fan, polygons used here are convex or near-convex)
    for (let e = 0; e < 2; e++) {
      const zz = e ? hz : -hz, s = e ? 1 : -1;
      let cxp = 0, cyp = 0;
      for (const p of poly) { cxp += p[0]; cyp += p[1]; }
      cxp /= m; cyp /= m;
      const cen = this.vert(cxp, cyp, zz, 0, 0, s, 0.5, 0.5, c[0], c[1], c[2], 1);
      const st = this.count;
      for (const p of poly) this.vert(p[0], p[1], zz, 0, 0, s, 0.5, 0.5, c[0], c[1], c[2], 1);
      for (let i = 0; i < m; i++) {
        const a = st + i, b = st + ((i + 1) % m);
        if (s > 0) this.tri(cen, a, b); else this.tri(cen, b, a);
      }
    }
    return this;
  }

  build() {
    return {
      verts: new Float32Array(this.v),
      index: (this.v.length / 12) > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
      u32: (this.v.length / 12) > 65535,
      count: this.idx.length,
      tris: this.idx.length / 3,
    };
  }
}

/* Gridded surface with per-vertex colour + AO control.
   fn(u,v) -> [x,y,z] ; shade(u,v) -> [r,g,b,ao] */
function gridColored(mesh, nu, nv, fn, shade, uvs) {
  const base = mesh.count;
  const e = 1e-3;
  for (let i = 0; i <= nv; i++) {
    for (let j = 0; j <= nu; j++) {
      const u = j / nu, v = i / nv;
      const p = fn(u, v);
      const pu = fn(Math.min(u + e, 1), v), pv = fn(u, Math.min(v + e, 1));
      const ax = pu[0] - p[0], ay = pu[1] - p[1], az = pu[2] - p[2];
      const bx = pv[0] - p[0], by = pv[1] - p[1], bz = pv[2] - p[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const s = shade(u, v);
      mesh.vert(p[0], p[1], p[2], nx, ny, nz, uvs ? uvs[0] * u : u, uvs ? uvs[1] * v : v, s[0], s[1], s[2], s[3]);
    }
  }
  for (let i = 0; i < nv; i++) {
    for (let j = 0; j < nu; j++) {
      const a = base + i * (nu + 1) + j;
      mesh.quadIdx(a, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  return mesh;
}

/* deterministic pseudo random so the scene is identical every launch */
let _seed = 1337;
function rnd() {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function rndRange(a, b) { return a + rnd() * (b - a); }
function resetSeed(s) { _seed = s || 1337; }