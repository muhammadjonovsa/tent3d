/* ============================================================================
   TENT 3D :: truck.js  —  procedural realistic TENT tractor + semi-trailer
   +===========  X = forward  |  Y = up  |  Z = lateral (right = +Z) =========
   ========================================================================== */
'use strict';

/* --------------------------------------------------------------- wheels --- */
function buildTyre(radius, width) {
  const m = new Mesh();
  const rimR = radius * 0.58;
  const hz = width / 2;
  // tread band
  m.push();
  m.rx(Math.PI / 2);                        // axis y -> axis z
  m.cyl(0, 0, 0, radius, radius, width, 40, { caps: false, color: [1, 1, 1] });
  m.pop();
  // sidewall rings
  for (let s = 0; s < 2; s++) {
    const zz = s ? hz : -hz;
    const seg = 40, rings = 4;
    const base = m.count;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const rr = rimR + (radius - rimR) * t;
      // slight bulge of the sidewall
      const bulge = Math.sin(t * PI) * 0.012;
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * TAU;
        const cx = Math.cos(a), cz = Math.sin(a);
        m.vert(cx * rr, cz * rr, zz + (s ? -1 : 1) * bulge, cx * 0.94, cz * 0.94, (s ? -1 : 1) * 0.34,
          (j / seg) * TAU * radius * 0.30, s ? 0.80 + t * 0.20 : 0.20 - t * 0.20, 1, 1, 1, lerp(0.82, 1.0, t));
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * (seg + 1) + j;
        if (s) m.quadIdx(a, a + 1, a + seg + 2, a + seg + 1);
        else m.quadIdx(a, a + seg + 1, a + seg + 2, a + 1);
      }
    }
  }
  return m.build();
}

function buildRim(radius, width) {
  const m = new Mesh();
  const rimR = radius * 0.58;
  const hz = width * 0.46;
  const hubR = rimR * 0.34;
  // barrel
  m.push(); m.rx(Math.PI / 2);
  m.cyl(0, 0, 0, rimR * 1.02, rimR * 1.02, width * 0.86, 30, { caps: false, color: [0.72, 0.74, 0.78] });
  m.pop();
  // dished face (outer side)
  const seg = 30, rings = 5;
  const base = m.count;
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    const rr = lerp(hubR, rimR, t);
    const zz = hz - Math.sin(t * PI * 0.5) * width * 0.14;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU;
      const cx = Math.cos(a), cz = Math.sin(a);
      m.vert(cx * rr, cz * rr, zz, cx * (1 - t * 0.5), cz * (1 - t * 0.5), 0.75,
        (j / seg) * 3, t * 3, lerp(0.80, 0.62, t), lerp(0.82, 0.64, t), lerp(0.86, 0.70, t), lerp(1.0, 0.86, t));
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = base + i * (seg + 1) + j;
      m.quadIdx(a, a + seg + 1, a + seg + 2, a + 1);
    }
  }
  // hub + centre bore
  m.push(); m.rx(Math.PI / 2);
  m.cyl(0, 0, hz - 0.01, hubR, hubR * 0.92, 0.09, 20, { color: [0.55, 0.57, 0.62], theta0: 0, theta1: TAU });
  m.pop();
  m.push(); m.rx(Math.PI / 2);
  m.cyl(0, 0, hz + 0.035, hubR * 0.42, hubR * 0.38, 0.05, 16, { color: [0.30, 0.31, 0.34] });
  m.pop();
  // wheel nuts
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    m.push(); m.rx(Math.PI / 2);
    m.cyl(Math.cos(a) * hubR * 0.68, Math.sin(a) * hubR * 0.68, hz + 0.028, 0.017, 0.015, 0.026, 6, { color: [0.66, 0.67, 0.70] });
    m.pop();
  }
  return m.build();
}

/* ================================================================ TRUCK === */
function buildTruck(renderer, TEX, spec) {
  const L = {
    cabFront: 6.05, cabRear: 3.10, cabHalfZ: 1.245,
    cabFloor: 1.12, cabRoof: 3.00, sleeperRoof: 3.28,
    frontAxle: 5.10, rearAxle: 2.25, wheelR: 0.525, trailerWheelR: 0.50,
    tw: spec.trailerWidth, hl: spec.trailerLength, th: spec.trailerHeight,
    tf: spec.frontX, tr: spec.frontX - spec.trailerLength,
    floorY: spec.floorY, roofY: spec.floorY + spec.trailerHeight,
    axles: [-6.95, -8.15, -9.35],
    gearX: -2.30,
  };
  const HW = L.tw / 2;          // exterior half width
  const IHW = HW - 0.052;       // interior half width

  /* ------------------------------------------------------ materials ------- */
  const MAT = {
    paint: { albedo: spec.cabColor, rough: 0.17, metal: 0.0, reflectance: 0.075 },
    paintDark: { albedo: spec.cabColor.map((v) => v * 0.55), rough: 0.22, metal: 0.0 },
    plastic: { albedo: [0.030, 0.032, 0.036], rough: 0.62, metal: 0.0 },
    chassis: { albedo: [0.055, 0.058, 0.064], rough: 0.42, metal: 0.75, reflectance: 0.32 },
    steel: { albedo: [0.52, 0.545, 0.575], rough: 0.30, metal: 0.92, tex: TEX.metal, texScale: [0.5, 0.5] },
    steelDark: { albedo: [0.20, 0.21, 0.225], rough: 0.38, metal: 0.90, tex: TEX.metal, texScale: [0.4, 0.4] },
    alu: { albedo: [0.60, 0.625, 0.65], rough: 0.34, metal: 0.88, tex: TEX.metal, texScale: [0.35, 0.35] },
    aluRib: { albedo: [0.52, 0.545, 0.57], rough: 0.40, metal: 0.85, tex: TEX.metal, texScale: [0.3, 0.3] },
    chrome: { albedo: [0.86, 0.88, 0.90], rough: 0.055, metal: 1.0 },
    glass: { albedo: [0.020, 0.028, 0.036], rough: 0.035, metal: 0.0, opacity: 0.40, reflectance: 0.09, twoSided: false, depthWrite: false },
    glassSide: { albedo: [0.028, 0.036, 0.046], rough: 0.05, opacity: 0.46 },
    mirror: { albedo: [0.72, 0.76, 0.82], rough: 0.03, metal: 1.0 },
    rubber: { albedo: [0.020, 0.021, 0.023], rough: 0.80, metal: 0.0, sheen: 0.10 },
    tyre: { albedo: [1, 1, 1], rough: 0.72, metal: 0.0, tex: TEX.tyre, texScale: [0.303, 1.94], texOffset: [0, 0.5], sheen: 0.06 },
    lampGlass: { albedo: [0.85, 0.87, 0.90], rough: 0.05, metal: 0.0, opacity: 0.55, emissiveBoost: 1 },
    headlight: { albedo: [0.55, 0.57, 0.60], rough: 0.06, metal: 0.0, emis: [0.85, 0.86, 0.90], opacity: 0.72 },
    indicator: { albedo: [0.60, 0.22, 0.03], rough: 0.10, metal: 0.0, emis: [0.55, 0.16, 0.01], opacity: 0.80 },
    tail: { albedo: [0.55, 0.04, 0.03], rough: 0.12, metal: 0.0, emis: [0.42, 0.02, 0.01], opacity: 0.82 },
    reverse: { albedo: [0.75, 0.76, 0.78], rough: 0.10, opacity: 0.62 },
    marker: { albedo: [0.70, 0.42, 0.05], rough: 0.10, emis: [0.50, 0.26, 0.02], opacity: 0.80 },
    curtain: { albedo: spec.curtainColor, rough: 0.78, metal: 0.0, tex: TEX.fabric, texScale: [0.55, 0.42], twoSided: true, sheen: 0.16 },
    curtainIn: { albedo: spec.curtainInnerColor, rough: 0.86, metal: 0.0, tex: TEX.fabric, texScale: [0.55, 0.42], twoSided: true, sheen: 0.05 },
    tarp: { albedo: spec.roofColor, rough: 0.62, metal: 0.0, tex: TEX.fabric, texScale: [0.5, 0.4], twoSided: true, sheen: 0.24 },
    floorWood: { albedo: [1, 1, 1], rough: 0.66, metal: 0.0, tex: TEX.plank, texScale: [0.5, 0.32] },
    ply: { albedo: [1, 1, 1], rough: 0.74, metal: 0.0, tex: TEX.ply, texScale: [0.3, 0.3] },
    paintWhite: { albedo: [0.88, 0.90, 0.92], rough: 0.30, metal: 0.0 },
  };

  const parts = [];
  const add = (meshData, mat, model, tag) => {
    const p = renderer.add(meshData, mat, model);
    if (tag) p.tag = tag;
    parts.push(p);
    return p;
  };
  const addShared = (meshData, mat, model, tag) => {
    if (!meshData.glmesh) meshData.glmesh = new GLMesh(renderer.gl, meshData);
    const m = Object.assign(DEFAULT_MAT(), mat);
    const p = {
      mesh: meshData.glmesh, mat: m, model: model ? M.copy(M.create(), model) : M.create(),
      visible: true, depthWrite: m.opacity > 0.999, sortKey: 0, tag: tag || null,
    };
    renderer.parts.push(p);
    parts.push(p);
    return p;
  };

  /* ==================================================== TRACTOR =========== */
  const cab = new Mesh();

  /* --- main cab shell (cab-over) --- */
  cab.rbox(L.cabFront - (L.cabFront - L.cabRear) / 2, (L.cabFloor + L.cabRoof) / 2, 0,
    L.cabFront - L.cabRear, L.cabRoof - L.cabFloor, L.cabHalfZ * 2, 0.11, 4,
    { color: [1, 1, 1], uvScale: 0.5 });

  /* --- roof deflector / sleeper fairing --- */
  cab.push();
  cab.load(M.compose(M.create(), 3.55, 0, 0, 0, 0, 0, 1, 1, 1));
  cab.extrude([
    [-0.62, 0], [0.72, 0], [0.66, 0.16], [0.10, 0.30], [-0.62, 0.30],
  ], L.cabHalfZ * 1.94, { color: [0.96, 0.97, 0.99] });
  cab.pop();
  /* side fairing wedges behind the cab */
  for (let s = -1; s <= 1; s += 2) {
    cab.push();
    cab.load(M.compose(M.create(), 3.32, 1.55, s * (L.cabHalfZ - 0.05), 0, 0, 0, 1, 1, 1));
    cab.extrude([[0, -0.55], [0.42, -0.62], [0.42, 0.62], [0, 0.55]], 0.06,
      { color: [0.72, 0.74, 0.78] });
    cab.pop();
  }

  /* --- windscreen aperture (recessed black frame) --- */
  const wsY0 = 2.06, wsY1 = 2.80;
  cab.push();
  cab.load(M.compose(M.create(), L.cabFront - 0.012, (wsY0 + wsY1) / 2, 0, 0, 0, 0, 1, 1, 1));
  cab.box(0, 0, 0, 0.03, wsY1 - wsY0 + 0.10, 2.30, { color: [0.045, 0.048, 0.052], uvScale: 1 });
  cab.pop();

  /* --- roof marker lights --- */
  for (let i = -2; i <= 2; i++) {
    cab.push();
    cab.load(M.compose(M.create(), L.cabFront - 0.06, L.cabRoof - 0.055, i * 0.42, 0, 0, 0, 1, 1, 1));
    cab.cyl(0, 0, 0, 0.045, 0.045, 0.05, 10, { color: [0.7, 0.45, 0.1], axis: 'z' });
    cab.pop();
  }

  /* --- door seams, handles, fuel filler --- */
  for (let s = -1; s <= 1; s += 2) {
    const z = s * (L.cabHalfZ + 0.006);
    // recessed door panel
    cab.push();
    cab.load(M.compose(M.create(), 5.05, 2.10, z, 0, 0, 0, 1, 1, 1));
    cab.box(0, 0, 0, 1.66, 1.62, 0.012, { color: [0.92, 0.93, 0.95] });
    cab.pop();
    // door handle
    cab.push();
    cab.load(M.compose(M.create(), 4.32, 1.98, z + s * 0.02, 0, 0, 0, 1, 1, 1));
    cab.box(0, 0, 0, 0.20, 0.045, 0.05, { color: [0.16, 0.17, 0.19] });
    cab.pop();
    // step / sill
    cab.push();
    cab.load(M.compose(M.create(), 5.05, 1.30, z, 0, 0, 0, 1, 1, 1));
    cab.box(0, 0, 0, 1.70, 0.055, 0.03, { color: [0.10, 0.105, 0.115] });
    cab.pop();
    // fuel filler cap
    cab.push();
    cab.load(M.compose(M.create(), 4.10, 1.62, z + s * 0.012, 0, 0, 0, 1, 1, 1));
    cab.cyl(0, 0, 0, 0.075, 0.075, 0.02, 14, { color: [0.30, 0.31, 0.33], axis: 'z' });
    cab.pop();
  }

  /* --- grille, bumper, headlights --- */
  const front = new Mesh();
  front.push();
  front.load(M.compose(M.create(), L.cabFront + 0.005, 1.66, 0, 0, 0, 0, 1, 1, 1));
  front.box(0, 0, 0, 0.05, 0.62, 1.86, { color: [0.055, 0.058, 0.062] });
  front.pop();
  // horizontal grille slats
  for (let i = 0; i < 5; i++) {
    front.push();
    front.load(M.compose(M.create(), L.cabFront + 0.035, 1.42 + i * 0.125, 0, 0, 0, 0, 1, 1, 1));
    front.box(0, 0, 0, 0.02, 0.055, 1.80, { color: [0.32, 0.335, 0.355] });
    front.pop();
  }
  // brand bar
  front.push();
  front.load(M.compose(M.create(), L.cabFront + 0.030, 2.03, 0, 0, 0, 0, 1, 1, 1));
  front.box(0, 0, 0, 0.025, 0.10, 1.30, { color: [0.70, 0.72, 0.76] });
  front.pop();
  // bumper
  front.push();
  front.load(M.compose(M.create(), L.cabFront + 0.14, 0.83, 0, 0, 0, 0, 1, 1, 1));
  front.rbox(0, 0, 0, 0.26, 0.46, 2.44, 0.07, 3, { color: [0.10, 0.105, 0.115], uvScale: 1 });
  front.pop();
  // number plate recess
  front.push();
  front.load(M.compose(M.create(), L.cabFront + 0.275, 0.80, 0, 0, 0, 0, 1, 1, 1));
  front.box(0, 0, 0, 0.012, 0.20, 0.56, { color: [0.02, 0.02, 0.02] });
  front.pop();

  /* --- headlight clusters --- */
  const lights = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    lights.push();
    lights.load(M.compose(M.create(), L.cabFront + 0.015, 1.44, s * 0.86, 0, 0, 0, 1, 1, 1));
    lights.box(0, 0, 0, 0.05, 0.30, 0.40, { color: [1, 1, 1] });
    lights.pop();
    // turn indicator
    lights.push();
    lights.load(M.compose(M.create(), L.cabFront + 0.015, 1.18, s * 1.06, 0, 0, 0, 1, 1, 1));
    lights.box(0, 0, 0, 0.045, 0.11, 0.16, { color: [1, 0.5, 0.15] });
    lights.pop();
    // fog lamp
    lights.push();
    lights.load(M.compose(M.create(), L.cabFront + 0.265, 0.70, s * 0.72, 0, 0, 0, 1, 1, 1));
    lights.cyl(0, 0, 0, 0.075, 0.075, 0.04, 14, { color: [0.9, 0.92, 0.95], axis: 'x' });
    lights.pop();
  }
  /* side marker lamps on the cab flanks */
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 3; i++) {
      lights.push();
      lights.load(M.compose(M.create(), 5.9 - i * 0.14, 1.62, s * (L.cabHalfZ + 0.01), 0, 0, 0, 1, 1, 1));
      lights.box(0, 0, 0, 0.07, 0.035, 0.015, { color: [1, 0.6, 0.2] });
      lights.pop();
    }
  }

  /* --- mirrors --- */
  const mirrors = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    // upper arm
    mirrors.push();
    mirrors.load(M.compose(M.create(), L.cabFront - 0.02, 2.62, s * 1.30, 0, 0, 0, 1, 1, 1));
    mirrors.cyl(0, 0, 0, 0.020, 0.020, 0.34, 8, { color: [0.09, 0.095, 0.10], axis: 'z' });
    mirrors.pop();
    // lower arm
    mirrors.push();
    mirrors.load(M.compose(M.create(), L.cabFront - 0.02, 2.10, s * 1.34, 0, 0, 0, 1, 1, 1));
    mirrors.cyl(0, 0, 0, 0.022, 0.022, 0.36, 8, { color: [0.09, 0.095, 0.10], axis: 'z' });
    mirrors.pop();
    // vertical stay
    mirrors.push();
    mirrors.load(M.compose(M.create(), L.cabFront - 0.02, 2.36, s * 1.50, 0, 0, 0, 1, 1, 1));
    mirrors.box(0, 0, 0, 0.022, 0.56, 0.022, { color: [0.09, 0.095, 0.10] });
    mirrors.pop();
  }
  const mirrorGlass = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    mirrorGlass.push();
    mirrorGlass.load(M.compose(M.create(), L.cabFront - 0.04, 2.42, s * 1.545, 0, 0, 0, 1, 1, 1));
    mirrorGlass.box(0, 0, 0, 0.10, 0.50, 0.022, { color: [1, 1, 1] });
    mirrorGlass.pop();
    mirrorGlass.push();
    mirrorGlass.load(M.compose(M.create(), L.cabFront - 0.04, 1.86, s * 1.545, 0, 0, 0, 1, 1, 1));
    mirrorGlass.box(0, 0, 0, 0.10, 0.26, 0.022, { color: [1, 1, 1] });
    mirrorGlass.pop();
  }

  /* --- chassis rails, catwalk, fifth wheel --- */
  const chassis = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    chassis.push();
    chassis.load(M.compose(M.create(), (0.45 + 6.18) / 2, 0.95, s * 0.42, 0, 0, 0, 1, 1, 1));
    chassis.box(0, 0, 0, 6.18 - 0.45, 0.075, 0.22, { color: [1, 1, 1] });   // top flange
    chassis.box(0, -0.10, 0, 6.18 - 0.45, 0.19, 0.045, { color: [0.85, 0.85, 0.85] }); // web
    chassis.box(0, -0.20, 0, 6.18 - 0.45, 0.075, 0.22, { color: [0.9, 0.9, 0.9] });  // bottom flange
    chassis.pop();
  }
  // cross members
  for (let i = 0; i < 9; i++) {
    const x = 0.8 + i * 0.62;
    if (x > 6.0) break;
    chassis.box(x, 0.86, 0, 0.09, 0.14, 0.80, { color: [0.75, 0.75, 0.75] });
  }
  // catwalk plate
  chassis.box(3.02, 1.14, 0, 0.55, 0.03, 1.30, { color: [0.42, 0.43, 0.45], uvScale: 3 });
  // fifth wheel plate
  chassis.push();
  chassis.load(M.compose(M.create(), 2.42, 1.20, 0, 0, 0, 0, 1, 1, 1));
  chassis.extrude([[-0.52, -0.16], [0.52, -0.16], [0.52, 0.16], [0.10, 0.16], [0.0, 0.02], [-0.10, 0.16], [-0.52, 0.16]],
    1.02, { color: [0.30, 0.31, 0.33] });
  chassis.pop();
  // access ramps
  for (let s = -1; s <= 1; s += 2) {
    chassis.push();
    chassis.load(M.compose(M.create(), 1.55, 1.16, s * 0.30, 0, 0, 0, 1, 1, 1));
    chassis.extrude([[-0.34, 0], [0.34, 0], [0.34, 0.055], [-0.34, 0.055]], 0.14, { color: [0.26, 0.27, 0.29] });
    chassis.pop();
  }
  // air tanks
  for (let s = -1; s <= 1; s += 2) {
    chassis.push();
    chassis.load(M.compose(M.create(), 1.35, 0.72, s * 0.62, 0, 0, 0, 1, 1, 1));
    chassis.rx(Math.PI / 2);
    chassis.cyl(0, 0, 0, 0.155, 0.155, 0.62, 16, { color: [0.62, 0.64, 0.67] });
    chassis.pop();
  }
  // battery box + air compressor
  chassis.box(1.75, 0.78, -0.60, 0.52, 0.30, 0.34, { color: [0.16, 0.165, 0.175] });
  chassis.push();
  chassis.load(M.compose(M.create(), 1.95, 0.82, 0.55, 0, 0, 0, 1, 1, 1));
  chassis.cyl(0, 0, 0, 0.17, 0.17, 0.30, 14, { color: [0.34, 0.35, 0.37] });
  chassis.pop();

  /* --- fuel tanks, exhaust, air horns --- */
  const extras = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    // fuel tank
    extras.push();
    extras.load(M.compose(M.create(), 4.05, 0.86, s * 1.10, 0, 0, 0, 1, 1, 1));
    extras.rx(Math.PI / 2);
    extras.cyl(0, 0, 0, 0.335, 0.335, 1.30, 22, { color: [0.70, 0.72, 0.75] });
    extras.pop();
    // straps
    for (let i = -1; i <= 1; i += 2) {
      extras.push();
      extras.load(M.compose(M.create(), 4.05 + i * 0.45, 0.86, s * 1.10, 0, 0, 0, 1, 1, 1));
      extras.rx(Math.PI / 2);
      extras.cyl(0, 0, 0, 0.352, 0.352, 0.055, 20, { color: [0.14, 0.145, 0.15], caps: false });
      extras.pop();
    }
    // steps
    for (let i = 0; i < 2; i++) {
      extras.push();
      extras.load(M.compose(M.create(), 4.35, 0.86 - i * 0.28, s * 1.20, 0, 0, 0, 1, 1, 1));
      extras.box(0, 0, 0, 0.52, 0.03, 0.16, { color: [0.16, 0.165, 0.175] });
      extras.pop();
    }
    // exhaust stack
    extras.push();
    extras.load(M.compose(M.create(), 3.24, 1.90, s * 1.21, 0, 0, 0, 1, 1, 1));
    extras.cyl(0, 0, 0, 0.062, 0.062, 2.70, 14, { color: [0.42, 0.43, 0.45] });
    extras.pop();
    extras.push();
    extras.load(M.compose(M.create(), 3.24, 3.32, s * 1.21, 0, 0, 0, 1, 1, 1));
    extras.cyl(0, 0, 0, 0.072, 0.072, 0.26, 14, { color: [0.30, 0.31, 0.33] });
    extras.pop();
    // mudflap behind the rear wheels
    extras.push();
    extras.load(M.compose(M.create(), 1.62, 0.30, s * 1.00, 0, 0, 0, 1, 1, 1));
    extras.box(0, 0, 0, 0.02, 0.56, 0.66, { color: [0.02, 0.02, 0.022] });
    extras.pop();
  }
  // air horns on the roof
  extras.push();
  extras.load(M.compose(M.create(), 4.05, L.cabRoof + 0.10, 0, 0, 0, 0, 1, 1, 1));
  extras.rx(Math.PI / 2);
  extras.cyl(0.10, 0, 0.11, 0.055, 0.075, 0.42, 14, { color: [0.78, 0.79, 0.82] });
  extras.cyl(-0.10, 0, 0.11, 0.055, 0.075, 0.42, 14, { color: [0.78, 0.79, 0.82] });
  extras.pop();
  // beacon lamps
  for (let s = -1; s <= 1; s += 2) {
    extras.push();
    extras.load(M.compose(M.create(), 4.55, L.cabRoof + 0.07, s * 0.62, 0, 0, 0, 1, 1, 1));
    extras.cyl(0, 0, 0, 0.052, 0.052, 0.10, 12, { color: [1, 0.55, 0.08] });
    extras.pop();
  }
  // antenna
  extras.push();
  extras.load(M.compose(M.create(), 5.95, 2.20, -1.10, 0, 0, 0.14, 1, 1, 1));
  extras.cyl(0, 0, 0, 0.012, 0.008, 1.30, 6, { color: [0.1, 0.1, 0.11] });
  extras.pop();

  /* --- windshield wipers --- */
  const wipers = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    wipers.push();
    wipers.load(M.compose(M.create(), L.cabFront + 0.02, 2.12, s * 0.52, 0, 0, 0, 1, 1, 1));
    wipers.box(0, 0, 0, 0.02, 0.02, 0.62, { color: [0.03, 0.03, 0.03] });
    wipers.pop();
    wipers.push();
    wipers.load(M.compose(M.create(), L.cabFront + 0.03, 2.20, s * 0.30, 0, 0, 0, 1, 1, 1));
    wipers.box(0, 0, 0, 0.016, 0.30, 0.02, { color: [0.03, 0.03, 0.03] });
    wipers.pop();
  }

  /* --- glass panes --- */
  const glass = new Mesh();
  glass.quad(
    [L.cabFront + 0.028, wsY1, -1.10], [L.cabFront + 0.028, wsY1, 1.10],
    [L.cabFront + 0.028, wsY0, 1.10], [L.cabFront + 0.028, wsY0, -1.10],
    { n: [1, 0, 0], color: [1, 1, 1] });
  for (let s = -1; s <= 1; s += 2) {
    glass.quad(
      [5.88, 2.78, s * (L.cabHalfZ + 0.004)], [4.32, 2.78, s * (L.cabHalfZ + 0.004)],
      [4.32, 2.10, s * (L.cabHalfZ + 0.004)], [5.88, 2.10, s * (L.cabHalfZ + 0.004)],
      { n: [0, 0, s], color: [1, 1, 1] });
    // quarter light
    glass.quad(
      [3.30, 2.72, s * (L.cabHalfZ + 0.004)], [3.16, 2.72, s * (L.cabHalfZ + 0.004)],
      [3.16, 2.14, s * (L.cabHalfZ + 0.004)], [3.30, 2.14, s * (L.cabHalfZ + 0.004)],
      { n: [0, 0, s], color: [1, 1, 1] });
  }

  add(cab.build(), MAT.paint, null, 'cab');
  add(front.build(), MAT.plastic, null, 'cabFront');
  add(lights.build(), Object.assign({}, MAT.headlight, { opacity: 0.80 }), null, 'lights');
  add(mirrors.build(), MAT.steelDark, null, 'mirrors');
  add(mirrorGlass.build(), MAT.mirror, null, 'mirrorGlass');
  add(chassis.build(), MAT.chassis, null, 'chassis');
  add(extras.build(), MAT.steel, null, 'extras');
  add(wipers.build(), MAT.plastic, null, 'wipers');
  const glassPart = add(glass.build(), MAT.glass, null, 'glass');
  glassPart.depthWrite = false;

  /* --- number plates --- */
  const plates = new Mesh();
  plates.quad([L.cabFront + 0.281, 0.72, -0.26], [L.cabFront + 0.281, 0.72, 0.26],
    [L.cabFront + 0.281, 0.88, 0.26], [L.cabFront + 0.281, 0.88, -0.26], { n: [1, 0, 0], color: [1, 1, 1] });
  add(plates.build(), { albedo: [1, 1, 1], rough: 0.32, metal: 0.0, tex: TEX.plateFront, texScale: [0.20, 0.40] }, null, 'plate');

  /* --- air / electrical lines between cab and trailer --- */
  const lines = new Mesh();
  for (let i = 0; i < 3; i++) {
    const z = -0.22 + i * 0.22;
    const path = [];
    for (let k = 0; k <= 26; k++) {
      const t = k / 26;
      const x = lerp(3.02, 3.42, t);
      const y = 1.72 - t * 0.30 + Math.sin(t * Math.PI * 7) * 0.045 * (1 - t * 0.3);
      const zz = z + Math.sin(t * Math.PI * 7 + i) * 0.030 * (1 - t * 0.2);
      path.push([x, y, zz]);
    }
    lines.sweep(path, [[-0.014, -0.014], [0.014, -0.014], [0.014, 0.014], [-0.014, 0.014]],
      { closedProfile: true, color: i === 0 ? [0.20, 0.20, 0.22] : i === 1 ? [0.35, 0.16, 0.05] : [0.12, 0.13, 0.15] });
  }

  /* ==================================================== TRAILER ========== */
  const body = new Mesh();
  const len = L.hl, midX = (L.tf + L.tr) / 2;

  /* --- underframe --- */
  for (let s = -1; s <= 1; s += 2) {
    body.push();
    body.load(M.compose(M.create(), midX, L.floorY - 0.14, s * 0.44, 0, 0, 0, 1, 1, 1));
    body.box(0, 0, 0, len, 0.06, 0.20, { color: [1, 1, 1] });
    body.box(0, -0.09, 0, len, 0.13, 0.04, { color: [0.7, 0.7, 0.7] });
    body.pop();
  }
  // cross members
  for (let i = 0; i < 24; i++) {
    const x = L.tr + 0.3 + i * (len - 0.6) / 23;
    body.box(x, L.floorY - 0.10, 0, 0.07, 0.11, HW * 2 - 0.06, { color: [0.62, 0.62, 0.62] });
  }
  // deck floor
  body.push();
  body.load(M.compose(M.create(), midX, L.floorY - 0.035, 0, 0, 0, 0, 1, 1, 1));
  body.box(0, 0, 0, len, 0.07, HW * 2, { color: [1, 1, 1], uvScale: 0.4 });
  body.pop();

  /* --- front wall (fixed) --- */
  const frontWall = new Mesh();
  frontWall.push();
  frontWall.load(M.compose(M.create(), L.tf - 0.05, (L.floorY + L.roofY) / 2, 0, 0, 0, 0, 1, 1, 1));
  frontWall.box(0, 0, 0, 0.09, L.th, HW * 2, { color: [1, 1, 1], uvScale: 0.6 });
  frontWall.pop();
  // front wall ribs
  for (let i = 0; i < 9; i++) {
    const z = -HW + 0.18 + i * (HW * 2 - 0.36) / 8;
    frontWall.push();
    frontWall.load(M.compose(M.create(), L.tf - 0.11, (L.floorY + L.roofY) / 2, z, 0, 0, 0, 1, 1, 1));
    frontWall.box(0, 0, 0, 0.05, L.th - 0.12, 0.05, { color: [0.82, 0.83, 0.85] });
    frontWall.pop();
  }
  // header board above the roof line
  frontWall.push();
  frontWall.load(M.compose(M.create(), L.tf - 0.10, L.roofY + 0.09, 0, 0, 0, 0, 1, 1, 1));
  frontWall.box(0, 0, 0, 0.14, 0.20, HW * 2 + 0.02, { color: [0.30, 0.32, 0.35] });
  frontWall.pop();
  // brand panel
  const brand = new Mesh();
  brand.quad([L.tf - 0.101, L.roofY - 0.44, -0.62], [L.tf - 0.101, L.roofY - 0.44, 0.62],
    [L.tf - 0.101, L.roofY - 0.10, 0.62], [L.tf - 0.101, L.roofY - 0.10, -0.62],
    { n: [-1, 0, 0], color: [1, 1, 1] });

  /* --- curtain rails --- */
  const rails = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    const z = s * HW;
    // top rail
    rails.push();
    rails.load(M.compose(M.create(), midX, L.roofY + 0.015, z, 0, 0, 0, 1, 1, 1));
    rails.box(0, 0, 0, len, 0.05, 0.05, { color: [0.78, 0.80, 0.83] });
    rails.pop();
    // bottom rail / kick plate
    rails.push();
    rails.load(M.compose(M.create(), midX, L.floorY + 0.035, z, 0, 0, 0, 1, 1, 1));
    rails.box(0, 0, 0, len, 0.07, 0.045, { color: [0.60, 0.62, 0.65] });
    rails.pop();
    // vertical posts
    const posts = Math.round(len / 1.55);
    for (let i = 1; i < posts; i++) {
      const x = L.tf - i * (len / posts);
      rails.push();
      rails.load(M.compose(M.create(), x, (L.floorY + L.roofY) / 2, z, 0, 0, 0, 1, 1, 1));
      rails.box(0, 0, 0, 0.05, L.th, 0.035, { color: [0.55, 0.565, 0.59] });
      rails.pop();
    }
  }
  // rear frame
  for (let s = -1; s <= 1; s += 2) {
    rails.push();
    rails.load(M.compose(M.create(), L.tr - 0.02, (L.floorY + L.roofY) / 2, s * HW, 0, 0, 0, 1, 1, 1));
    rails.box(0, 0, 0, 0.09, L.th + 0.10, 0.07, { color: [0.72, 0.74, 0.77] });
    rails.pop();
  }
  rails.push();
  rails.load(M.compose(M.create(), L.tr - 0.02, L.roofY + 0.02, 0, 0, 0, 0, 1, 1, 1));
  rails.box(0, 0, 0, 0.10, 0.06, HW * 2, { color: [0.72, 0.74, 0.77] });
  rails.pop();
  rails.push();
  rails.load(M.compose(M.create(), L.tr - 0.02, L.floorY - 0.01, 0, 0, 0, 0, 1, 1, 1));
  rails.box(0, 0, 0, 0.10, 0.07, HW * 2, { color: [0.72, 0.74, 0.77] });
  rails.pop();

  /* --- roof tarp with bow sag --- */
  const roofMesh = new Mesh();
  const crown = 0.045, sag = 0.018;
  gridColored(roofMesh, 44, 8,
    (u, v) => {
      const x = lerp(L.tf - 0.06, L.tr + 0.02, u);
      const z = (v - 0.5) * HW * 2;
      const across = Math.cos(z / HW * PI * 0.5);
      const bowPhase = (L.tf - x) / 0.62;
      const bow = Math.sin(bowPhase * PI) * sag;
      return [x, L.roofY + crown * across - bow, z];
    },
    (u, v) => {
      const across = Math.cos((v - 0.5) * PI);
      const s = lerp(0.80, 1.0, across);
      return [s, s, s, s];
    }, [len * 0.5, 1.0]);
  /* roof rear roll */
  roofMesh.push();
  roofMesh.load(M.compose(M.create(), L.tr + 0.06, L.roofY + 0.02, 0, 0, 0, 0, 1, 1, 1));
  roofMesh.rx(Math.PI / 2);
  roofMesh.cyl(0, 0, 0, 0.055, 0.055, HW * 2, 14, { color: [0.55, 0.57, 0.60], axis: 'z' });
  roofMesh.pop();

  /* --- interior: bows, side lining, front bulkhead --- */
  const interior = new Mesh();
  const bowStep = 0.62;
  const bowCount = Math.floor((L.tf - L.tr) / bowStep);
  for (let i = 0; i <= bowCount; i++) {
    const x = L.tf - 0.12 - i * bowStep;
    const path = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const z = (t - 0.5) * IHW * 2;
      path.push([x, L.roofY - 0.03 + crown * Math.cos(z / HW * PI * 0.5) - 0.006, z]);
    }
    interior.sweep(path, [[-0.030, -0.030], [0.030, -0.030], [0.030, 0.030], [-0.030, 0.030]],
      { closedProfile: true, up: [0, 1, 0], color: [0.62, 0.60, 0.56] });
  }
  // lashing rails along both walls
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 2; k++) {
      interior.push();
      interior.load(M.compose(M.create(), midX, L.floorY + 0.55 + k * 0.75, s * (IHW - 0.03), 0, 0, 0, 1, 1, 1));
      interior.box(0, 0, 0, len - 0.2, 0.035, 0.035, { color: [0.55, 0.56, 0.58] });
      interior.pop();
    }
  }
  // front bulkhead inner face + small window frame
  interior.push();
  interior.load(M.compose(M.create(), L.tf - 0.11, (L.floorY + L.roofY) / 2, 0, 0, 0, 0, 1, 1, 1));
  interior.box(0, 0, 0, 0.02, L.th - 0.06, IHW * 2, { color: [1, 1, 1], uvScale: 0.5 });
  interior.pop();

  /* --- landing gear --- */
  const gear = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    gear.push();
    gear.load(M.compose(M.create(), L.gearX, L.floorY - 0.16, s * 0.86, 0, 0, 0, 1, 1, 1));
    gear.box(0, 0, 0, 0.22, 0.22, 0.20, { color: [0.62, 0.64, 0.67] });
    gear.box(0.14, -0.20, 0, 0.30, 0.09, 0.16, { color: [0.55, 0.57, 0.60] });  // crank housing
    gear.pop();
  }

  /* --- rear underrun bar, lights, mudguards --- */
  const rear = new Mesh();
  rear.push();
  rear.load(M.compose(M.create(), L.tr - 0.18, 0.58, 0, 0, 0, 0, 1, 1, 1));
  rear.box(0, 0, 0, 0.07, 0.30, HW * 1.75, { color: [0.42, 0.44, 0.47] });
  rear.pop();
  for (let s = -1; s <= 1; s += 2) {
    rear.push();
    rear.load(M.compose(M.create(), L.tr - 0.10, 0.80, s * 0.62, 0, 0, 0, 1, 1, 1));
    rear.box(0, 0, 0, 0.06, 0.42, 0.10, { color: [0.38, 0.40, 0.43] });
    rear.pop();
  }
  // rear light clusters
  const rearLights = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    rearLights.push();
    rearLights.load(M.compose(M.create(), L.tr - 0.055, 1.16, s * (HW - 0.20), 0, 0, 0, 1, 1, 1));
    rearLights.box(0, 0, 0, 0.035, 0.50, 0.16, { color: [0.9, 0.9, 0.9] });
    rearLights.pop();
    rearLights.push();
    rearLights.load(M.compose(M.create(), L.tr - 0.075, 1.30, s * (HW - 0.20), 0, 0, 0, 1, 1, 1));
    rearLights.box(0, 0, 0, 0.02, 0.14, 0.13, { color: [0.85, 0.10, 0.05] });
    rearLights.pop();
    rearLights.push();
    rearLights.load(M.compose(M.create(), L.tr - 0.075, 1.14, s * (HW - 0.20), 0, 0, 0, 1, 1, 1));
    rearLights.box(0, 0, 0, 0.02, 0.11, 0.13, { color: [0.75, 0.75, 0.78] });
    rearLights.pop();
    rearLights.push();
    rearLights.load(M.compose(M.create(), L.tr - 0.075, 0.99, s * (HW - 0.20), 0, 0, 0, 1, 1, 1));
    rearLights.box(0, 0, 0, 0.02, 0.10, 0.13, { color: [0.85, 0.45, 0.05] });
    rearLights.pop();
  }
  // side skirt / mudguard over the bogie
  for (let s = -1; s <= 1; s += 2) {
    rear.push();
    rear.load(M.compose(M.create(), -8.15, 1.16, s * (HW - 0.02), 0, 0, 0, 1, 1, 1));
    rear.box(0, 0, 0, 3.30, 0.34, 0.03, { color: [0.24, 0.25, 0.27] });
    rear.pop();
  }
  const rearPlate = new Mesh();
  rearPlate.quad([L.tr - 0.056, 0.98, -0.30], [L.tr - 0.056, 0.98, 0.30],
    [L.tr - 0.056, 1.14, 0.30], [L.tr - 0.056, 1.14, -0.30], { n: [-1, 0, 0], color: [1, 1, 1] });

  add(body.build(), MAT.steelDark, null, 'trailerFrame');
  add(frontWall.build(), MAT.aluRib, null, 'frontWall');
  add(brand.build(), { albedo: [1, 1, 1], rough: 0.42, metal: 0.0, tex: TEX.brandPanel, texScale: [0.16, 0.42] }, null, 'brand');
  add(rails.build(), MAT.alu, null, 'rails');
  add(roofMesh.build(), MAT.tarp, null, 'roof');
  add(interior.build(), MAT.ply, null, 'interior');
  add(gear.build(), MAT.steel, null, 'gear');
  add(rear.build(), MAT.steelDark, null, 'rearUnder');
  add(rearLights.build(), Object.assign({}, MAT.tail, { opacity: 0.85 }), null, 'rearLights');
  add(rearPlate.build(), { albedo: [1, 1, 1], rough: 0.32, metal: 0.0, tex: TEX.plateRear, texScale: [0.20, 0.50] }, null, 'rearPlate');
  add(lines.build(), MAT.plastic, null, 'lines');

  /* --- interior floor (wooden planks) --- */
  const floor = new Mesh();
  gridColored(floor, 26, 5,
    (u, v) => [lerp(L.tf - 0.10, L.tr + 0.09, u), L.floorY + 0.004, (v - 0.5) * IHW * 2],
    (u, v) => {
      const edge = Math.min(v, 1 - v) / 0.16;
      const end = Math.min(u, 1 - u) / 0.10;
      const ao = lerp(0.52, 1.0, sstep(0, 1, Math.min(edge, 1))) * lerp(0.72, 1.0, sstep(0, 1, Math.min(end, 1)));
      return [ao, ao, ao, ao];
    }, [len * 0.34, 1.6]);
  add(floor.build(), MAT.floorWood, null, 'floor');

  /* ================================================ CURTAIN PANELS ======= */
  const fixedFront = 0.55;          // fixed front section
  const rearGap = 0.14;
  const openLen = len - fixedFront - rearGap;
  const panelCount = Math.max(6, Math.round(openLen / 0.56));
  const pitch = openLen / panelCount;
  const curtainY0 = L.floorY + 0.07, curtainY1 = L.roofY - 0.01;
  const curtainH = curtainY1 - curtainY0;

  const panelMesh = (() => {
    const m = new Mesh();
    const w = pitch * 0.995;
    // bowed fabric panel
    gridColored(m, 3, 5,
      (u, v) => {
        const bulge = Math.sin(u * PI) * Math.sin(v * PI * 0.85 + 0.2) * 0.022;
        return [-w / 2 + u * w, curtainH * v, bulge];
      },
      (u, v) => {
        const s = lerp(1.0, 0.90, v) * lerp(0.94, 1.0, u);
        return [s, s, s, s];
      }, [w * 0.5, curtainH * 0.42]);
    // leading edge rod
    m.push();
    m.load(M.compose(M.create(), -w / 2, curtainH / 2, 0, 0, 0, 0, 1, 1, 1));
    m.cyl(0, 0, 0, 0.013, 0.013, curtainH, 8, { color: [0.80, 0.81, 0.83], axis: 'y' });
    m.pop();
    // bottom buckle / tensioner
    m.push();
    m.load(M.compose(M.create(), -w / 2 + 0.03, 0.10, 0.02, 0, 0, 0, 1, 1, 1));
    m.box(0, 0, 0, 0.07, 0.05, 0.055, { color: [0.62, 0.63, 0.65] });
    m.pop();
    // top hook
    m.push();
    m.load(M.compose(M.create(), -w / 2 + 0.02, curtainH - 0.03, 0, 0, 0, 0, 1, 1, 1));
    m.box(0, 0, 0, 0.06, 0.04, 0.04, { color: [0.62, 0.63, 0.65] });
    m.pop();
    return m.build();
  })();

  const curtain = { left: [], right: [] };
  for (let side = 0; side < 2; side++) {
    const s = side === 0 ? -1 : 1;
    for (let i = 0; i < panelCount; i++) {
      const x0 = L.tf - fixedFront - pitch * (i + 0.5);
      const model = M.create();
      M.compose(model, x0, curtainY0, s * (HW + 0.012), 0, 0, 0, 1, 1, 1);
      const p = addShared(panelMesh, MAT.curtain, model, 'curtain' + (side === 0 ? 'L' : 'R'));
      p.panelIndex = i;
      p.side = s;
      p.x0 = x0;
      curtain[side === 0 ? 'left' : 'right'].push(p);
    }
  }

  /* ==================================================== REAR DOORS ======== */
  const doorH = L.th;
  const doorMesh = (() => {
    const m = new Mesh();
    const w = HW - 0.015;
    // door skin (outer face) with ribs
    m.push();
    m.load(M.compose(M.create(), w / 2, doorH / 2, 0, 0, 0, 0, 1, 1, 1));
    m.box(0, 0, 0, w, doorH, 0.05, { color: [1, 1, 1], uvScale: 0.5 });
    m.pop();
    // inner lining
    m.push();
    m.load(M.compose(M.create(), w / 2, doorH / 2, -0.062, 0, 0, 0, 1, 1, 1));
    m.box(0, 0, 0, w - 0.06, doorH - 0.06, 0.012, { color: [1, 1, 1], uvScale: 0.5 });
    m.pop();
    // lock rods (2 per door) with handles
    for (let i = 0; i < 2; i++) {
      const x = w * (0.28 + i * 0.44);
      m.push();
      m.load(M.compose(M.create(), x, doorH / 2, -0.085, 0, 0, 0, 1, 1, 1));
      m.cyl(0, 0, 0, 0.017, 0.017, doorH - 0.10, 10, { color: [0.74, 0.76, 0.79], axis: 'y' });
      m.pop();
      m.push();
      m.load(M.compose(M.create(), x, doorH * 0.45, -0.10, 0, 0, 0, 1, 1, 1));
      m.box(0, 0, 0, 0.05, 0.20, 0.05, { color: [0.60, 0.62, 0.65] });
      m.pop();
    }
    // perimeter seal + hinges
    m.push();
    m.load(M.compose(M.create(), w / 2, doorH / 2, 0.03, 0, 0, 0, 1, 1, 1));
    m.box(0, 0, 0, w + 0.02, 0.05, 0.07, { color: [0.10, 0.105, 0.11] });
    m.pop();
    m.push();
    m.load(M.compose(M.create(), w / 2, doorH - 0.02, 0.03, 0, 0, 0, 1, 1, 1));
    m.box(0, 0, 0, w + 0.02, 0.05, 0.07, { color: [0.10, 0.105, 0.11] });
    m.pop();
    for (let i = 0; i < 3; i++) {
      m.push();
      m.load(M.compose(M.create(), 0.03, 0.22 + i * (doorH - 0.5) / 2, 0, 0, 0, 0, 1, 1, 1));
      m.cyl(0, 0, 0, 0.032, 0.032, 0.11, 10, { color: [0.55, 0.57, 0.60], axis: 'y' });
      m.pop();
    }
    return m.build();
  })();

  const doors = [];
  for (let s = -1; s <= 1; s += 2) {
    const hinge = s * (HW - 0.01);
    const model = M.create();
    const baseYaw = s * (PI / 2);
    M.compose(model, L.tr + 0.05, L.floorY, hinge, baseYaw, 0, 0, 1, 1, 1);
    const d = addShared(doorMesh, MAT.curtainIn, model, 'door');
    d.side = s;
    d.baseYaw = baseYaw;
    d.hingeX = L.tr + 0.05;
    d.hingeY = L.floorY;
    d.hingeZ = hinge;
    doors.push(d);
  }

  /* ====================================================== WHEELS ========= */
  const tyreData = buildTyre(L.wheelR, 0.31);
  const rimData = buildRim(L.wheelR, 0.31);
  const tyreTrailer = buildTyre(L.trailerWheelR, 0.27);
  const rimTrailer = buildRim(L.trailerWheelR, 0.27);
  const tMesh = new Mesh(), rMesh = new Mesh();
  const place = (x, z, r, dual) => {
    const zs = dual ? [z * 0.76, z] : [z];
    for (const zz of zs) {
      const p = (mesh, mat, yaw) => {
        const m = M.create();
        M.compose(m, x, r, zz, yaw, 0, 0, 1, 1, 1);
        addShared(mesh, mat, m, 'wheel');
      };
      p(r < 0.51 ? tyreTrailer : tyreData, MAT.tyre, 0);
      p(r < 0.51 ? rimTrailer : rimData, MAT.steelDark, zz > 0 ? 0 : PI);
    }
  };
  place(L.frontAxle, 1.03, L.wheelR, false);
  place(L.rearAxle, 1.03, L.wheelR, true);
  for (const ax of L.axles) place(ax, 1.05, L.trailerWheelR, true);

  /* hub detail: centre caps on the outer duals */
  const caps = new Mesh();
  for (let s = -1; s <= 1; s += 2) {
    for (const ax of L.axles) {
      caps.push();
      caps.load(M.compose(M.create(), ax, L.trailerWheelR, s * 1.07, 0, 0, 0, 1, 1, 1));
      caps.rx(Math.PI / 2);
      caps.cyl(0, 0, 0, 0.085, 0.075, 0.03, 14, { color: [0.70, 0.72, 0.75], axis: 'z' });
      caps.pop();
    }
  }
  add(caps.build(), MAT.steel, null, 'hubs');

  return {
    L, parts, curtain, doors, panelCount, pitch, curtainY0, curtainH, HW, IHW,
    MAT,
  };
}