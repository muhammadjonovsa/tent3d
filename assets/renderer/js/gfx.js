/* ============================================================================
   TENT 3D :: gfx.js  —  WebGL2 renderer
   Cook-Torrance (GGX) shading, procedural equirect environment for reflections,
   directional shadow map with PCF, ACES tonemapping, exposure control.
   ========================================================================== */
'use strict';

const ATTR = { POS: 0, NRM: 1, UV: 2, COL: 3, AO: 4, STRIDE: 12 };

const VS_MAIN = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec2 aUV;
layout(location=3) in vec3 aCol;
layout(location=4) in float aAO;
uniform mat4 uVP;
uniform mat4 uModel;
uniform mat3 uNrmMat;
uniform mat4 uLightVP;
uniform float uShadowNormalOffset;
out vec3 vW; out vec3 vN; out vec2 vUV; out vec3 vC; out float vAO; out vec4 vLP;
void main(){
  vec4 wp = uModel * vec4(aPos,1.0);
  vW = wp.xyz;
  vN = normalize(uNrmMat * aNrm);
  vUV = aUV; vC = aCol; vAO = aAO;
  vLP = uLightVP * vec4(wp.xyz + normalize(uNrmMat*aNrm) * uShadowNormalOffset, 1.0);
  gl_Position = uVP * wp;
}`;

const FS_MAIN = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec3 vW; in vec3 vN; in vec2 vUV; in vec3 vC; in float vAO; in vec4 vLP;
out vec4 fragColor;

uniform vec3 uAlbedo; uniform float uRough; uniform float uMetal;
uniform vec3 uEmis; uniform float uOpacity; uniform float uSheen;
uniform sampler2D uTex; uniform float uUseTex; uniform vec2 uTexScale; uniform vec2 uTexOffset;
uniform sampler2D uEnv; uniform sampler2D uShadow;
uniform vec3 uCamPos;
uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform vec3 uSkyCol; uniform vec3 uGroundCol;
uniform vec3 uPointPos[6]; uniform vec3 uPointCol[6]; uniform int uPointN;
uniform vec3 uFogCol; uniform float uFogDensity;
uniform float uExposure; uniform float uShadowStrength; uniform float uShadowTexel;
uniform int uTwoSided; uniform float uAlphaCut; uniform float uReflectance;

const float PI = 3.14159265359;

float D_GGX(float NoH, float a){ float a2=a*a; float d=(NoH*a2-NoH)*NoH+1.0; return a2/(PI*d*d); }
float V_Smith(float NoV,float NoL,float a){ float a2=a*a;
  float gv=NoL*sqrt(NoV*NoV*(1.0-a2)+a2); float gl=NoV*sqrt(NoL*NoL*(1.0-a2)+a2);
  return 0.5/max(gv+gl,1e-5); }
vec3 F_Schlick(vec3 f0,float u){ float f=pow(1.0-u,5.0); return f0 + (vec3(1.0)-f0)*f; }

vec2 dirToEquirect(vec3 d){
  return vec2(atan(d.z, d.x)/(2.0*PI) + 0.5, acos(clamp(d.y,-1.0,1.0))/PI);
}
vec3 sampleEnv(vec3 d, float rough){
  // heavier lod bias on rough surfaces keeps the procedural env from
  // sparkling on the big studio surfaces
  float lod = rough * rough * 11.0;
  return textureLod(uEnv, dirToEquirect(normalize(d)), lod).rgb;
}
float shadowFactor(vec3 N, vec3 L){
  vec3 p = vLP.xyz / vLP.w;
  p = p * 0.5 + 0.5;
  if (p.z > 1.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 1.0;
  float bias = max(0.0016 * (1.0 - dot(N,L)), 0.0004);
  float s = 0.0;
  for (int y=-1; y<=1; y++){
    for (int x=-1; x<=1; x++){
      float d = texture(uShadow, p.xy + vec2(float(x), float(y)) * uShadowTexel).r;
      s += (p.z - bias) > d ? 0.0 : 1.0;
    }
  }
  s /= 9.0;
  // soften with distance
  float fade = clamp(1.0 - (p.z*2.0 - 1.0), 0.0, 1.0);
  return mix(1.0, s, uShadowStrength);
}

void main(){
  vec3 N = normalize(vN);
  if (uTwoSided == 1 && !gl_FrontFacing) N = -N;
  vec3 Vv = normalize(uCamPos - vW);
  if (dot(N, Vv) < 0.0 && uTwoSided == 0) N = -N;

  vec3 albedo = uAlbedo * vC;
  float alpha = uOpacity;
  if (uUseTex > 0.5) {
    vec4 t = texture(uTex, vUV * uTexScale + uTexOffset);
    if (uAlphaCut > 0.0 && t.a < uAlphaCut) discard;
    albedo *= t.rgb;
    alpha *= t.a;
  }

  float rough = clamp(uRough * (0.82 + 0.36*vAO), 0.035, 1.0);
  float metal = uMetal;
  vec3 diffCol = albedo * (1.0 - metal);
  vec3 f0 = mix(vec3(uReflectance), albedo, metal);
  float NoV = clamp(dot(N,Vv), 1e-4, 1.0);
  float a = rough*rough;

  vec3 Lo = vec3(0.0);

  // ---- sun
  {
    vec3 L = normalize(uSunDir);
    vec3 H = normalize(L+Vv);
    float NoL = max(dot(N,L),0.0);
    if (NoL > 0.0){
      float NoH = max(dot(N,H),0.0);
      float VoH = max(dot(Vv,H),0.0);
      vec3 F = F_Schlick(f0, VoH);
      vec3 spec = F * D_GGX(NoH,a) * V_Smith(NoV,NoL,a);
      vec3 kd = (vec3(1.0)-F)*(1.0-metal);
      float sh = shadowFactor(N,L);
      Lo += (kd*diffCol/PI + spec) * uSunCol * NoL * sh;
    }
  }
  // ---- point / interior lights
  for (int i=0;i<6;i++){
    if (i >= uPointN) break;
    vec3 d = uPointPos[i]-vW;
    float dist2 = dot(d,d);
    vec3 L = d * inversesqrt(max(dist2,1e-4));
    float NoL = max(dot(N,L),0.0);
    if (NoL <= 0.0) continue;
    vec3 H = normalize(L+Vv);
    float NoH = max(dot(N,H),0.0);
    float VoH = max(dot(Vv,H),0.0);
    vec3 F = F_Schlick(f0, VoH);
    vec3 spec = F * D_GGX(NoH,a) * V_Smith(NoV,NoL,a);
    vec3 kd = (vec3(1.0)-F)*(1.0-metal);
    float att = 1.0/(1.0 + dist2*0.30);
    Lo += (kd*diffCol/PI + spec) * uPointCol[i] * NoL * att;
  }

  // ---- ambient : hemispheric irradiance + env specular
  float up = N.y*0.5 + 0.5;
  vec3 amb = mix(uGroundCol, uSkyCol, up) * vAO;
  Lo += diffCol * amb * (1.0 - metal*0.85);

  vec3 R = reflect(-Vv, N);
  vec3 envSpec = sampleEnv(R, rough);
  float fres = pow(1.0 - NoV, 4.0);
  vec3 specF = f0 + (max(vec3(1.0-rough), f0) - f0) * fres;
  float aoSpec = clamp(vAO*1.15, 0.0, 1.0);
  Lo += envSpec * specF * aoSpec * (1.0 - rough*0.80);

  // fabric / rubber sheen
  if (uSheen > 0.0){
    float rim = pow(1.0 - NoV, 3.0);
    Lo += uSkyCol * rim * uSheen * vAO;
  }

  Lo += uEmis;

  // fog
  float dist = length(uCamPos - vW);
  float fogAmt = 1.0 - exp(-uFogDensity * dist * dist * 0.0016);
  Lo = mix(Lo, uFogCol, clamp(fogAmt,0.0,0.85));

  // ACES tonemap
  vec3 c = Lo * uExposure;
  const float a1=2.51,b1=0.03,c1=2.43,d1=0.59,e1=0.14;
  c = clamp((c*(a1*c+b1))/(c*(c1*c+d1)+e1), 0.0, 1.0);
  // gamma
  c = pow(c, vec3(1.0/2.2));
  fragColor = vec4(c, alpha);
}`;

const VS_DEPTH = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
uniform mat4 uLightVP; uniform mat4 uModel;
void main(){ gl_Position = uLightVP * uModel * vec4(aPos,1.0); }`;

const FS_DEPTH = `#version 300 es
precision highp float;
void main(){}`;

const VS_SKY = `#version 300 es
precision highp float;
layout(location=0) in vec2 aP;
out vec2 vUV;
void main(){ vUV = aP; gl_Position = vec4(aP,0.9999,1.0); }`;

const FS_SKY = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 fragColor;
uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec3 uSunDir;
uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uFloorCol;
uniform float uSunGlow;
void main(){
  vec4 p = uInvVP * vec4(vUV, 1.0, 1.0);
  vec3 dir = normalize(p.xyz/p.w - uCamPos);
  float h = dir.y;
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(h,0.0,1.0), 0.65));
  vec3 below = mix(uHorizon, uFloorCol, pow(clamp(-h,0.0,1.0), 0.5));
  vec3 col = h > 0.0 ? sky : below;
  float s = max(dot(dir, normalize(uSunDir)),0.0);
  col += vec3(1.0,0.86,0.68) * pow(s, 220.0) * uSunGlow;
  col += vec3(0.55,0.62,0.75) * pow(s, 6.0) * uSunGlow * 0.30;
  // subtle studio vignette
  vec2 q = vUV;
  col *= 1.0 - 0.32*dot(q,q);
  fragColor = vec4(col, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    throw new Error('Shader compile error:\n' + log);
  }
  return s;
}
function makeProgram(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('Program link error:\n' + gl.getProgramInfoLog(p));
  }
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, name);
  }
  return { prog: p, u };
}

class GLMesh {
  constructor(gl, data) {
    this.gl = gl;
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.verts, gl.STATIC_DRAW);
    const S = ATTR.STRIDE * 4;
    gl.enableVertexAttribArray(ATTR.POS); gl.vertexAttribPointer(ATTR.POS, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(ATTR.NRM); gl.vertexAttribPointer(ATTR.NRM, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(ATTR.UV); gl.vertexAttribPointer(ATTR.UV, 2, gl.FLOAT, false, S, 24);
    gl.enableVertexAttribArray(ATTR.COL); gl.vertexAttribPointer(ATTR.COL, 3, gl.FLOAT, false, S, 32);
    gl.enableVertexAttribArray(ATTR.AO); gl.vertexAttribPointer(ATTR.AO, 1, gl.FLOAT, false, S, 44);
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.index, gl.STATIC_DRAW);
    this.count = data.count;
    this.type = data.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    this.tris = data.tris;
    gl.bindVertexArray(null);
  }
  draw(gl) {
    gl.bindVertexArray(this.vao);
    gl.drawElements(gl.TRIANGLES, this.count, this.type, 0);
  }
  dispose() {
    const gl = this.gl;
    if (!gl || this.disposed) return;
    this.disposed = true;
    if (this.vbo) gl.deleteBuffer(this.vbo);
    if (this.ibo) gl.deleteBuffer(this.ibo);
    if (this.vao) gl.deleteVertexArray(this.vao);
    this.vbo = null; this.ibo = null; this.vao = null;
  }
}

const DEFAULT_MAT = () => ({
  albedo: [0.7, 0.7, 0.7], rough: 0.6, metal: 0.0, emis: [0, 0, 0],
  opacity: 1, twoSided: false, alphaCut: 0, sheen: 0, reflectance: 0.045,
  tex: null, texScale: [1, 1], texOffset: [0, 0], castShadow: true,
});

class Renderer {
  constructor(canvas) {
    const opts = {
      alpha: false, antialias: true, depth: true, stencil: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false,
      desynchronized: true,
    };
    const gl = canvas.getContext('webgl2', opts);
    if (!gl) throw new Error('WebGL2 is not available on this system.');
    this.gl = gl;
    this.canvas = canvas;
    this.main = makeProgram(gl, VS_MAIN, FS_MAIN);
    this.depth = makeProgram(gl, VS_DEPTH, FS_DEPTH);
    this.sky = makeProgram(gl, VS_SKY, FS_SKY);
    /* Shadow map size is the single biggest fill-rate cost. Allow a host or a
     * test harness to scale it down (software rasterisers and low-end iGPUs). */
    const q = (typeof window !== 'undefined' && window.TENT3D_QUALITY) || {};
    this.shadowSize = q.shadowSize || 2048;
    this.antialias = q.antialias !== false;
    this._initShadow();
    this._initSky();
    this.parts = [];
    this.stats = { drawCalls: 0, tris: 0 };
    this.exposure = 1.0;
    this.sunDir = V.norm(V.of(), V.of(0.52, 0.72, -0.46));
    this.sunCol = [2.75, 2.58, 2.32];
    this.skyCol = [0.265, 0.305, 0.385];
    this.groundCol = [0.082, 0.086, 0.094];
    this.fogCol = [0.062, 0.072, 0.092];
    this.fogDensity = 0.055;
    this.shadowStrength = 0.92;
    this.points = [];
    this.env = null;
    this.lightVP = M.create();
    this._m = M.create();
    this._vp = M.create();
    this._invVP = M.create();
    this._nm = new Float32Array(9);
    this._tmp = M.create();
    this.sortKey = new Float32Array(0);
    this.pickables = [];
  }

  _initShadow() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _initSky() {
    const gl = this.gl;
    this.skyVao = gl.createVertexArray();
    gl.bindVertexArray(this.skyVao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  setEnv(canvas) {
    const gl = this.gl;
    if (this.env) gl.deleteTexture(this.env);
    this.env = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.env);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const mx = Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, mx);
    }
  }

  makeTexture(canvas, mips) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    if (mips) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const mx = Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, mx);
    }
    return t;
  }

  add(meshData, mat, model) {
    const m = Object.assign(DEFAULT_MAT(), mat || {});
    const part = {
      mesh: new GLMesh(this.gl, meshData),
      mat: m, model: model ? M.copy(M.create(), model) : M.create(),
      visible: true, blend: m.opacity < 0.999 || m.twoSided,
      depthWrite: m.opacity > 0.999, sortKey: 0, tag: null,
    };
    this.parts.push(part);
    return part;
  }

  /**
   * Drops parts from the scene and frees the GPU buffers of any mesh that no
   * longer has a user. Meshes shared between parts (wheels, curtain panels,
   * doors) survive until the last part referencing them is gone.
   */
  removeParts(list) {
    if (!list || !list.length) return 0;
    const doomed = new Set(list);
    const meshes = new Set();
    const kept = [];
    for (const p of this.parts) {
      if (doomed.has(p)) {
        if (p.mesh) meshes.add(p.mesh);
      } else {
        kept.push(p);
      }
    }
    this.parts = kept;
    for (const m of meshes) {
      let stillUsed = false;
      for (const p of kept) {
        if (p.mesh === m) { stillUsed = true; break; }
      }
      if (!stillUsed) m.dispose();
    }
    return doomed.size;
  }

  resize() {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.max(2, Math.round(c.clientWidth * dpr));
    const h = Math.max(2, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; return true; }
    return false;
  }

  setLightCenter(cx, cy, cz, radius) {
    this.lightCenter = [cx, cy, cz];
    this.lightRadius = radius;
  }

  computeLightMatrix() {
    const L = this.lightCenter || [0, 1.5, 0];
    const R = this.lightRadius || 12;
    const dir = this.sunDir;
    const eye = [L[0] + dir[0] * 40, L[1] + dir[1] * 40, L[2] + dir[2] * 40];
    const view = M.lookAt(M.create(), eye, L, [0, 1, 0]);
    const proj = M.ortho(M.create(), -R, R, -R * 0.72, R * 0.72, 1, 80);
    M.mul(this.lightVP, proj, view);
  }

  render(camera, opts) {
    const gl = this.gl;
    opts = opts || {};
    this.stats.drawCalls = 0; this.stats.tris = 0;
    this.computeLightMatrix();

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    M.persp(this._vp, camera.fov, aspect, camera.near, camera.far);
    const view = M.lookAt(this._tmp, camera.position, camera.target, [0, 1, 0]);
    M.mul(this._vp, this._vp, view);
    M.invert(this._invVP, this._vp);

    const all = [];
    for (const p of this.parts) if (p.visible) all.push(p);

    /* ---------------- shadow pass ---------------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.viewport(0, 0, this.shadowSize, this.shadowSize);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.useProgram(this.depth.prog);
    gl.uniformMatrix4fv(this.depth.u.uLightVP, false, this.lightVP);
    for (const p of all) {
      if (!p.mat.castShadow) continue;
      gl.uniformMatrix4fv(this.depth.u.uModel, false, p.model);
      p.mesh.draw(gl);
    }

    /* ---------------- main pass ---------------- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // sky
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(this.sky.prog);
    gl.uniformMatrix4fv(this.sky.u.uInvVP, false, this._invVP);
    gl.uniform3fv(this.sky.u.uCamPos, camera.position);
    gl.uniform3fv(this.sky.u.uSunDir, this.sunDir);
    gl.uniform3fv(this.sky.u.uZenith, opts.zenith || [0.030, 0.040, 0.058]);
    gl.uniform3fv(this.sky.u.uHorizon, opts.horizon || [0.075, 0.090, 0.115]);
    gl.uniform3fv(this.sky.u.uFloorCol, opts.floorCol || [0.030, 0.033, 0.040]);
    gl.uniform1f(this.sky.u.uSunGlow, opts.sunGlow === undefined ? 1.0 : opts.sunGlow);
    gl.bindVertexArray(this.skyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    // main program uniforms
    const u = this.main.u;
    gl.useProgram(this.main.prog);
    gl.uniformMatrix4fv(u.uVP, false, this._vp);
    gl.uniformMatrix4fv(u.uLightVP, false, this.lightVP);
    gl.uniform3fv(u.uCamPos, camera.position);
    gl.uniform3fv(u.uSunDir, this.sunDir);
    gl.uniform3fv(u.uSunCol, this.sunCol);
    gl.uniform3fv(u.uSkyCol, this.skyCol);
    gl.uniform3fv(u.uGroundCol, this.groundCol);
    gl.uniform3fv(u.uFogCol, this.fogCol);
    gl.uniform1f(u.uFogDensity, this.fogDensity);
    gl.uniform1f(u.uExposure, this.exposure * (opts.exposure === undefined ? 1 : opts.exposure));
    gl.uniform1f(u.uShadowStrength, this.shadowStrength);
    gl.uniform1f(u.uShadowTexel, 1 / this.shadowSize);
    gl.uniform1f(u.uShadowNormalOffset, this.shadowSize > 1024 ? 0.020 : 0.035);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.uShadow, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.env);
    gl.uniform1i(u.uEnv, 2);

    // point lights
    const pp = new Float32Array(18), pc = new Float32Array(18);
    const n = Math.min(6, this.points.length);
    for (let i = 0; i < n; i++) {
      pp[i * 3] = this.points[i].pos[0]; pp[i * 3 + 1] = this.points[i].pos[1]; pp[i * 3 + 2] = this.points[i].pos[2];
      const g = this.points[i].color || [1, 1, 1], k = this.points[i].intensity || 1;
      pc[i * 3] = g[0] * k; pc[i * 3 + 1] = g[1] * k; pc[i * 3 + 2] = g[2] * k;
    }
    gl.uniform3fv(u.uPointPos, pp);
    gl.uniform3fv(u.uPointCol, pc);
    gl.uniform1i(u.uPointN, n);

    const opaque = [], trans = [];
    for (const p of all) (p.depthWrite ? opaque : trans).push(p);

    // opaque
    gl.disable(gl.BLEND);
    for (const p of opaque) this._drawPart(p, false);

    // transparent : sort back to front by view distance
    for (const p of trans) {
      const dx = p.model[12] - camera.position[0];
      const dy = p.model[13] - camera.position[1];
      const dz = p.model[14] - camera.position[2];
      p.sortKey = dx * dx + dy * dy + dz * dz;
    }
    trans.sort((a, b) => b.sortKey - a.sortKey);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    for (const p of trans) this._drawPart(p, true);

    gl.bindVertexArray(null);
  }

  _drawPart(p, blended) {
    const gl = this.gl;
    const u = this.main.u, m = p.mat;
    if (m.twoSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
    gl.depthMask(blended ? m.opacity > 0.98 : true);
    normalMat3(this._nm, p.model);
    gl.uniformMatrix4fv(u.uModel, false, p.model);
    gl.uniformMatrix3fv(u.uNrmMat, false, this._nm);
    gl.uniform3fv(u.uAlbedo, m.albedo);
    gl.uniform1f(u.uRough, m.rough);
    gl.uniform1f(u.uMetal, m.metal);
    gl.uniform3fv(u.uEmis, m.emis);
    gl.uniform1f(u.uOpacity, m.opacity);
    gl.uniform1f(u.uSheen, m.sheen);
    gl.uniform1i(u.uTwoSided, m.twoSided ? 1 : 0);
    gl.uniform1f(u.uAlphaCut, m.alphaCut || 0);
    gl.uniform1f(u.uReflectance, m.reflectance === undefined ? 0.045 : m.reflectance);
    gl.uniform2fv(u.uTexScale, m.texScale);
    gl.uniform2fv(u.uTexOffset, m.texOffset || [0, 0]);
    if (m.tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, m.tex);
      gl.uniform1i(u.uTex, 0);
      gl.uniform1f(u.uUseTex, 1);
    } else {
      gl.uniform1f(u.uUseTex, 0);
    }
    p.mesh.draw(gl);
    this.stats.drawCalls++;
    this.stats.tris += p.mesh.tris;
  }

  /* project a world point to normalised screen coords (0..1) */
  project(p, out) {
    const v = this._vp;
    const x = p[0], y = p[1], z = p[2];
    const cx = v[0] * x + v[4] * y + v[8] * z + v[12];
    const cy = v[1] * x + v[5] * y + v[9] * z + v[13];
    const cz = v[2] * x + v[6] * y + v[10] * z + v[14];
    const cw = v[3] * x + v[7] * y + v[11] * z + v[15];
    if (cw <= 0.0001) { out[0] = -1; out[1] = -1; out[2] = -1; return false; }
    out[0] = (cx / cw) * 0.5 + 0.5;
    out[1] = 0.5 - (cy / cw) * 0.5;
    out[2] = cw;
    return true;
  }
}