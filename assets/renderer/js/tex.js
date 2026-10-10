/* ============================================================================
   TENT 3D :: tex.js  —  procedural textures (canvas 2D, generated at runtime)
   ========================================================================== */
'use strict';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
let _s = 99991;
function sr() { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; }
function sseed(v) { _s = v; }

function noiseOverlay(ctx, w, h, amount, scale) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = Math.max(2, Math.floor(Math.min(w, h) / (scale || 4)));
  const grid = new Float32Array(n * n);
  for (let i = 0; i < grid.length; i++) grid[i] = sr();
  const at = (x, y) => grid[(y % n) * n + (x % n)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / w * n, gy = y / h * n;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), dd = at(x0 + 1, y0 + 1);
      const v = (a + (b - a) * sx) * (1 - sy) + (c + (dd - c) * sx) * sy;
      const k = (v - 0.5) * amount * 255;
      const i = (y * w + x) * 4;
      d[i] = Math.max(0, Math.min(255, d[i] + k));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k));
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ------------------------------------------------------- environment map --- */
function makeEnv() {
  const w = 1024, h = 512;
  const c = cv(w, h), x = c.getContext('2d');
  sseed(7);
  // sky gradient (v = 0 top)
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.00, '#0a0d14');
  g.addColorStop(0.34, '#141a26');
  g.addColorStop(0.48, '#2a3444');
  g.addColorStop(0.52, '#1d232e');
  g.addColorStop(0.72, '#0d1016');
  g.addColorStop(1.00, '#07090c');
  x.fillStyle = g; x.fillRect(0, 0, w, h);

  // sun / key softbox: a long horizontal strip high up
  const sg = x.createRadialGradient(w * 0.16, h * 0.24, 0, w * 0.16, h * 0.24, h * 0.42);
  sg.addColorStop(0, 'rgba(255,246,226,1.0)');
  sg.addColorStop(0.25, 'rgba(226,214,196,0.55)');
  sg.addColorStop(1, 'rgba(120,132,150,0)');
  x.fillStyle = sg; x.fillRect(0, 0, w, h);

  // secondary cool softbox opposite
  const sg2 = x.createRadialGradient(w * 0.68, h * 0.20, 0, w * 0.68, h * 0.20, h * 0.5);
  sg2.addColorStop(0, 'rgba(196,214,240,0.55)');
  sg2.addColorStop(1, 'rgba(90,110,140,0)');
  x.fillStyle = sg2; x.fillRect(0, 0, w, h);

  // studio strip lights: bright horizontal bars (great metal highlights)
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const y = h * (0.10 + i * 0.055);
    const gg = x.createLinearGradient(0, y - 8, 0, y + 8);
    gg.addColorStop(0, 'rgba(0,0,0,0)');
    gg.addColorStop(0.5, 'rgba(255,252,244,0.5)');
    gg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gg;
    x.fillRect(w * (0.02 + i * 0.02), y - 9, w * (0.30 + i * 0.03), 18);
  }
  x.globalCompositeOperation = 'source-over';

  // horizon light band (ground bounce)
  const hb = x.createLinearGradient(0, h * 0.46, 0, h * 0.56);
  hb.addColorStop(0, 'rgba(90,100,116,0)');
  hb.addColorStop(0.5, 'rgba(120,132,150,0.35)');
  hb.addColorStop(1, 'rgba(60,66,78,0)');
  x.fillStyle = hb; x.fillRect(0, h * 0.46, w, h * 0.1);

  return c;
}

/* ---------------------------------------------------------------- floor --- */
function makeFloor() {
  const s = 1024, c = cv(s, s), x = c.getContext('2d');
  sseed(31);
  x.fillStyle = '#1a1c20'; x.fillRect(0, 0, s, s);
  // aggregate
  for (let i = 0; i < 26000; i++) {
    const r = 1 + sr() * 4;
    const g = 22 + sr() * 46;
    x.fillStyle = 'rgba(' + (g + 8) + ',' + (g + 9) + ',' + (g + 12) + ',' + (0.10 + sr() * 0.30) + ')';
    x.beginPath(); x.arc(sr() * s, sr() * s, r, 0, TAU); x.fill();
  }
  // large mottling
  for (let i = 0; i < 120; i++) {
    const g = 18 + sr() * 26;
    x.fillStyle = 'rgba(' + g + ',' + (g + 2) + ',' + (g + 5) + ',0.10)';
    x.beginPath(); x.arc(sr() * s, sr() * s, 30 + sr() * 130, 0, TAU); x.fill();
  }
  // expansion joints
  x.strokeStyle = 'rgba(6,7,9,0.85)'; x.lineWidth = 4;
  for (let i = 0; i <= 2; i++) {
    x.beginPath(); x.moveTo(i * s / 2, 0); x.lineTo(i * s / 2, s); x.stroke();
    x.beginPath(); x.moveTo(0, i * s / 2); x.lineTo(s, i * s / 2); x.stroke();
  }
  x.strokeStyle = 'rgba(90,96,108,0.18)'; x.lineWidth = 1.5;
  for (let i = 0; i <= 2; i++) {
    x.beginPath(); x.moveTo(i * s / 2 + 3, 0); x.lineTo(i * s / 2 + 3, s); x.stroke();
    x.beginPath(); x.moveTo(0, i * s / 2 + 3); x.lineTo(s, i * s / 2 + 3); x.stroke();
  }
  noiseOverlay(x, s, s, 0.16, 3);
  return c;
}

/* ------------------------------------------------------------ wood plank --- */
function makeWood(base, dark, plankRows, alongV) {
  const w = 512, h = 512, c = cv(w, h), x = c.getContext('2d');
  sseed(4242);
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  const rows = plankRows || 6;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const tone = 0.82 + sr() * 0.34;
    const y0 = r * rh;
    x.save();
    x.beginPath(); x.rect(0, y0, w, rh); x.clip();
    // plank base tint
    x.globalAlpha = 0.55;
    x.fillStyle = dark;
    x.fillRect(0, y0, w, rh);
    x.globalAlpha = 1;
    // grain lines
    const lines = 46;
    for (let i = 0; i < lines; i++) {
      const gy = y0 + (i / lines) * rh;
      x.strokeStyle = 'rgba(' + Math.round(60 * tone) + ',' + Math.round(38 * tone) + ',' + Math.round(20 * tone) + ',' + (0.05 + sr() * 0.22) + ')';
      x.lineWidth = 0.6 + sr() * 2.1;
      x.beginPath();
      x.moveTo(0, gy);
      for (let sx2 = 0; sx2 <= w; sx2 += 32) {
        x.lineTo(sx2, gy + Math.sin(sx2 * 0.02 + i * 1.7) * 2.6 + Math.sin(sx2 * 0.005 + i) * 4.5);
      }
      x.stroke();
    }
    // knot
    if (sr() < 0.45) {
      const kx = sr() * w, ky = y0 + rh * (0.3 + sr() * 0.4);
      for (let i = 8; i > 0; i--) {
        x.strokeStyle = 'rgba(48,30,16,' + (0.06 + i * 0.035) + ')';
        x.lineWidth = 1.4;
        x.beginPath(); x.ellipse(kx, ky, i * 3.4, i * 2.1, 0.4, 0, TAU); x.stroke();
      }
    }
    x.restore();
    // plank seam
    x.strokeStyle = 'rgba(28,17,9,0.72)'; x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(0, y0); x.lineTo(w, y0); x.stroke();
    x.strokeStyle = 'rgba(190,168,140,0.16)'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(0, y0 + 2.2); x.lineTo(w, y0 + 2.2); x.stroke();
    // occasional nail heads
    for (let n = 0; n < 3; n++) {
      const nx = (n + 0.5) * w / 3 + (sr() - 0.5) * 40;
      x.fillStyle = 'rgba(60,58,55,0.75)';
      x.beginPath(); x.arc(nx, y0 + 6, 2.4, 0, TAU); x.fill();
    }
  }
  noiseOverlay(x, w, h, 0.10, 3);
  void alongV;
  return c;
}

/* ---------------------------------------------------------- tent fabric --- */
function makeFabric(base, weave) {
  const s = 512, c = cv(s, s), x = c.getContext('2d');
  sseed(777);
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  // woven weave
  const step = 4;
  for (let y = 0; y < s; y += step) {
    x.fillStyle = 'rgba(255,255,255,0.035)';
    x.fillRect(0, y, s, step / 2);
    x.fillStyle = 'rgba(0,0,0,0.055)';
    x.fillRect(0, y + step / 2, s, step / 2);
  }
  for (let xx = 0; xx < s; xx += step) {
    x.fillStyle = 'rgba(255,255,255,0.022)';
    x.fillRect(xx, 0, step / 2, s);
    x.fillStyle = 'rgba(0,0,0,0.03)';
    x.fillRect(xx + step / 2, 0, step / 2, s);
  }
  if (weave) {
    // subtle rip-stop grid
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 2;
    for (let i = 0; i <= s; i += 64) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke();
    }
  }
  // dirt / wear streaks
  for (let i = 0; i < 60; i++) {
    x.fillStyle = 'rgba(0,0,0,' + (0.02 + sr() * 0.05) + ')';
    x.fillRect(0, sr() * s, s, 3 + sr() * 26);
  }
  noiseOverlay(x, s, s, 0.09, 3);
  return c;
}

/* ------------------------------------------------------------- cardboard --- */
function makeCardboard(label) {
  const s = 512, c = cv(s, s), x = c.getContext('2d');
  sseed(2024);
  x.fillStyle = '#a98155'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 7000; i++) {
    const g = 120 + sr() * 90;
    x.fillStyle = 'rgba(' + g + ',' + (g * 0.82) + ',' + (g * 0.6) + ',' + (0.06 + sr() * 0.2) + ')';
    x.fillRect(sr() * s, sr() * s, 1 + sr() * 10, 1 + sr() * 3);
  }
  // flute lines
  x.strokeStyle = 'rgba(90,68,44,0.10)'; x.lineWidth = 1;
  for (let i = 0; i < s; i += 7) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, s); x.stroke(); }
  // packing tape
  x.fillStyle = 'rgba(226,222,210,0.55)';
  x.fillRect(0, s * 0.46, s, s * 0.085);
  x.fillStyle = 'rgba(255,255,255,0.16)';
  x.fillRect(0, s * 0.46, s, 5);
  x.strokeStyle = 'rgba(120,110,95,0.4)'; x.lineWidth = 1.4;
  x.beginPath(); x.moveTo(0, s * 0.46); x.lineTo(s, s * 0.46); x.stroke();
  x.beginPath(); x.moveTo(0, s * 0.545); x.lineTo(s, s * 0.545); x.stroke();
  if (label) {
    x.fillStyle = 'rgba(245,242,232,0.94)';
    x.fillRect(s * 0.08, s * 0.62, s * 0.42, s * 0.2);
    x.strokeStyle = 'rgba(70,66,58,0.55)'; x.lineWidth = 2;
    x.strokeRect(s * 0.08, s * 0.62, s * 0.42, s * 0.2);
    x.fillStyle = '#2a2a2a';
    x.font = 'bold ' + Math.floor(s * 0.045) + 'px sans-serif';
    x.fillText('CARGO', s * 0.105, s * 0.69);
    x.font = Math.floor(s * 0.032) + 'px sans-serif';
    x.fillText('HANDLE WITH CARE', s * 0.105, s * 0.735);
    x.fillText('NET 480 kg', s * 0.105, s * 0.775);
    // barcode
    x.fillStyle = '#1b1b1b';
    let bx = s * 0.105;
    for (let i = 0; i < 34; i++) {
      const w = 1 + sr() * 4;
      x.fillRect(bx, s * 0.80, w, s * 0.035);
      bx += w + 2 + sr() * 3;
    }
  }
  noiseOverlay(x, s, s, 0.07, 3);
  return c;
}

/* ------------------------------------------------------------------- bags --- */
function makeBag(base, stripe) {
  const s = 256, c = cv(s, s), x = c.getContext('2d');
  sseed(9090);
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 3) {
    x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(0, y, s, 1.5);
    x.fillStyle = 'rgba(0,0,0,0.05)'; x.fillRect(0, y + 1.5, s, 1.5);
  }
  for (let xx = 0; xx < s; xx += 3) {
    x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(xx, 0, 1.4, s);
    x.fillStyle = 'rgba(0,0,0,0.035)'; x.fillRect(xx + 1.4, 0, 1.4, s);
  }
  if (stripe) {
    x.fillStyle = stripe;
    x.fillRect(0, s * 0.42, s, s * 0.06);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.fillRect(0, s * 0.48, s, 3);
  }
  // stencil
  x.save();
  x.globalAlpha = 0.30;
  x.fillStyle = '#1b1b1b';
  x.font = 'bold 22px sans-serif';
  x.fillText('NET 50 KG', 18, s * 0.30);
  x.restore();
  noiseOverlay(x, s, s, 0.10, 3);
  return c;
}

/* ------------------------------------------------------------ metal / steel --- */
function makeMetal(kind) {
  const s = 512, c = cv(s, s), x = c.getContext('2d');
  sseed(555);
  if (kind === 'diamond') {
    x.fillStyle = '#7d8288'; x.fillRect(0, 0, s, s);
    const draw = (ox, oy) => {
      x.save(); x.translate(ox, oy); x.rotate(PI / 4);
      x.fillStyle = 'rgba(190,196,204,0.85)'; x.fillRect(-26, -6, 52, 12);
      x.fillStyle = 'rgba(50,54,58,0.55)'; x.fillRect(-26, 4, 52, 5);
      x.restore();
    };
    for (let i = 0; i < s; i += 64) for (let j = 0; j < s; j += 64) { draw(i + 16, j + 16); draw(i + 48, j + 48); }
  } else if (kind === 'rust') {
    x.fillStyle = '#6b6259'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 2400; i++) {
      const r = 4 + sr() * 60;
      x.fillStyle = 'rgba(' + (100 + sr() * 70) + ',' + (60 + sr() * 40) + ',' + (30 + sr() * 26) + ',' + (0.03 + sr() * 0.14) + ')';
      x.beginPath(); x.arc(sr() * s, sr() * s, r, 0, TAU); x.fill();
    }
    for (let i = 0; i < 5000; i++) {
      x.fillStyle = 'rgba(30,22,16,' + (0.05 + sr() * 0.25) + ')';
      x.fillRect(sr() * s, sr() * s, 1 + sr() * 5, 1 + sr() * 5);
    }
  } else {
    x.fillStyle = '#9aa0a8'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i++) {
      const y = sr() * s;
      x.strokeStyle = 'rgba(255,255,255,' + (0.02 + sr() * 0.06) + ')';
      x.lineWidth = 0.7 + sr() * 1.1;
      x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + (sr() - 0.5) * 3); x.stroke();
    }
    for (let i = 0; i < 900; i++) {
      const y = sr() * s;
      x.strokeStyle = 'rgba(40,44,50,' + (0.02 + sr() * 0.07) + ')';
      x.lineWidth = 0.7 + sr();
      x.beginPath(); x.moveTo(0, y); x.lineTo(s, y + (sr() - 0.5) * 4); x.stroke();
    }
  }
  noiseOverlay(x, s, s, 0.10, 4);
  return c;
}

/* ------------------------------------------------------------- tyre tread --- */
function makeTyre() {
  const w = 512, h = 256, c = cv(w, h), x = c.getContext('2d');
  sseed(1212);
  x.fillStyle = '#17181a'; x.fillRect(0, 0, w, h);
  // the U axis runs around the circumference, V across the tread
  // sidewalls (top and bottom of the texture)
  const wall = h * 0.19;
  for (const [y0, dir] of [[0, 1], [h - wall, -1]]) {
    const g = x.createLinearGradient(0, y0, 0, y0 + wall * dir);
    g.addColorStop(0, dir > 0 ? '#0d0e10' : '#0d0e10');
    g.addColorStop(1, dir > 0 ? '#25272b' : '#25272b');
    x.fillStyle = g; x.fillRect(0, y0, w, wall);
    // sidewall lettering
    x.save();
    x.globalAlpha = 0.32;
    x.fillStyle = '#cfd3d8';
    x.font = 'bold 17px sans-serif';
    for (let i = 0; i < 8; i++) x.fillText('385/65 R22.5  TENT3D', i * 64 + 4, dir > 0 ? y0 + wall * 0.72 : y0 + wall * 0.34);
    x.restore();
    x.strokeStyle = 'rgba(0,0,0,0.7)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, y0 + wall * dir); x.lineTo(w, y0 + wall * dir); x.stroke();
  }
  // tread band
  x.fillStyle = '#1b1d20'; x.fillRect(0, wall, w, h - wall * 2);
  // circumferential grooves
  x.fillStyle = '#0a0b0c';
  const bands = [wall + (h - wall * 2) * 0.30, wall + (h - wall * 2) * 0.70];
  for (const by of bands) x.fillRect(0, by - 6, w, 12);
  // tread blocks
  const pitch = 42;
  for (let i = 0; i < w; i += pitch) {
    // shoulder blocks
    x.fillStyle = '#2a2d31';
    x.fillRect(i, wall, pitch * 0.42, (h - wall * 2) * 0.26);
    x.fillRect(i + pitch * 0.5, h - wall - (h - wall * 2) * 0.26, pitch * 0.42, (h - wall * 2) * 0.26);
    // centre blocks
    x.fillStyle = '#26292d';
    x.fillRect(i + 6, bands[0] + 8, pitch * 0.5, bands[1] - bands[0] - 16);
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.fillRect(i + 6 + pitch * 0.5, bands[0] + 8, 2, bands[1] - bands[0] - 16);
  }
  noiseOverlay(x, w, h, 0.14, 3);
  return c;
}

/* ------------------------------------------------------------- plate/brand --- */
function makePlate(text, sub, bg, fg) {
  const w = 512, h = 256, c = cv(w, h), x = c.getContext('2d');
  sseed(3);
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.strokeStyle = fg; x.lineWidth = 8;
  x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = fg;
  x.font = 'bold 96px "Segoe UI", Arial, sans-serif';
  x.textAlign = 'center';
  x.fillText(text, w / 2, h / 2 + 8);
  x.font = 'bold 40px "Segoe UI", Arial, sans-serif';
  x.fillText(sub, w / 2, h - 34);
  x.globalAlpha = 0.12;
  x.fillStyle = '#000';
  for (let i = 0; i < 400; i++) x.fillRect(sr() * w, sr() * h, 2, 2);
  x.globalAlpha = 1;
  noiseOverlay(x, w, h, 0.07, 3);
  return c;
}

/* --------------------------------------------------------- trailer interior --- */
function makePly() {
  const s = 512, c = cv(s, s), x = c.getContext('2d');
  sseed(6161);
  x.fillStyle = '#b8ab90'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 140; i++) {
    const g = 150 + sr() * 70;
    x.fillStyle = 'rgba(' + g + ',' + (g * 0.92) + ',' + (g * 0.74) + ',' + (0.05 + sr() * 0.16) + ')';
    x.beginPath(); x.ellipse(sr() * s, sr() * s, 30 + sr() * 120, 8 + sr() * 22, sr() * 3, 0, TAU); x.fill();
  }
  x.strokeStyle = 'rgba(120,104,78,0.20)'; x.lineWidth = 1;
  for (let i = 0; i < s; i += 16) { x.beginPath(); x.moveTo(0, i); x.lineTo(s, i); x.stroke(); }
  noiseOverlay(x, s, s, 0.10, 4);
  return c;
}

/* ------------------------------------------------------------- insulation --- */
function makeInsulation() {
  const s = 256, c = cv(s, s), x = c.getContext('2d');
  sseed(808);
  x.fillStyle = '#d8b45c'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 6000; i++) {
    const l = 6 + sr() * 26;
    x.save();
    x.translate(sr() * s, sr() * s); x.rotate(sr() * TAU);
    x.strokeStyle = 'rgba(' + (200 + sr() * 55) + ',' + (170 + sr() * 50) + ',' + (80 + sr() * 40) + ',' + (0.16 + sr() * 0.4) + ')';
    x.lineWidth = 0.7 + sr() * 2.4;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(l, (sr() - 0.5) * 8); x.stroke();
    x.restore();
  }
  x.fillStyle = 'rgba(60,60,60,0.85)';
  x.fillRect(0, 0, s, 3); x.fillRect(0, s - 3, s, 3);
  x.fillRect(0, 0, 3, s); x.fillRect(s - 3, 0, 3, s);
  noiseOverlay(x, s, s, 0.14, 3);
  return c;
}

/* ------------------------------------------------------------------ build --- */
function buildTextures(renderer) {
  const t = {};
  t.env = makeEnv();
  renderer.setEnv(t.env);
  const reg = (name, canvas, mips) => { t[name] = renderer.makeTexture(canvas, mips === undefined ? true : mips); };
  reg('floor', makeFloor(), true);
  reg('plank', makeWood('#b99a68', '#7c5f3a', 7), true);
  reg('lumber', makeWood('#c39a63', '#8a6538', 3), true);
  reg('ply', makePly(), true);
  reg('fabric', makeFabric('#c8ccd2', true), true);
  reg('fabricDark', makeFabric('#4c5259', true), true);
  reg('cardboard', makeCardboard(true), true);
  reg('cardboardPlain', makeCardboard(false), true);
  reg('bag', makeBag('#e2ddcd', '#2e6fb0'), true);
  reg('grainBag', makeBag('#e8e2cf', '#c9963a'), true);
  reg('metal', makeMetal('plain'), true);
  reg('diamond', makeMetal('diamond'), true);
  reg('rust', makeMetal('rust'), true);
  reg('tyre', makeTyre(), true);
  reg('insulation', makeInsulation(), true);
  reg('plateFront', makePlate('34 TENT 3D', 'TURKIYE', '#ffffff', '#111111'), true);
  reg('plateRear', makePlate('34 ABC 342', 'TENT 3D', '#ffffff', '#111111'), true);
  reg('brandPanel', makePlate('TENT 3D', 'CURTAIN SIDER', '#1b1e23', '#e8ecf2'), true);
  return t;
}