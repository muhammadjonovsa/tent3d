# TENT 3D — Architecture Audit & Refactor Plan

Status: audit complete, refactor in progress.
Scope: WebGL renderer (`assets/renderer/js/*`) + Flutter host (`lib/*`).

---

## 1. Coordinate system (single source of truth)

The whole application uses one **right-handed** system, documented here and in the
`truck.js` header:

| Axis | Meaning | Range / notes |
| --- | --- | --- |
| **+X** | forward (tractor nose, front of trailer) | front bumper `+X`, rear of trailer `-X` |
| **+Y** | up | ground `Y=0`, floor `spec.floorY`, roof `floorY + height` |
| **+Z** | right-hand side of the vehicle | trailer half width `±trailerWidth/2` |

Derived anchors (used by geometry, planner, dimensions and camera alike):

```
rearX    = frontX - trailerLength
halfW    = trailerWidth / 2
floorY   = spec.floorY
roofY    = floorY + trailerHeight
rigCX    = frontX - trailerLength / 2      // rig centre, env.js
```

**Decision:** the existing `X-forward / Y-up / Z-right` convention is kept as the
internal standard. It is already consistent across `truck.js`, `env.js`,
`cargo.js`, the Dart planner (`CargoBox`) and the dimension overlay. Renaming the
world axes to `Z-forward` would touch every mesh builder, the planner, the anchor
positions and the forklift path with no behavioural gain, which conflicts with the
"do not rewrite working parts unnecessarily" constraint. Instead:

* the convention is documented in one place (this file + `core.js` header),
* camera code uses **named helpers** (`forwardAxis`, `rightAxis`, `upAxis`) rather
  than raw components,
* all UI-facing text uses `length / width / height`, never axis letters.

If a `Z-forward` world is required later it must be a single mechanical pass over
`truck.js`, `env.js`, `cargo.js`, `CargoBox` and `buildDimensions`, followed by the
full regression suite — not an incremental edit.

---

## 2. Confirmed root causes

### 2.1 Freezes — every slider drag rebuilds the entire scene (CRITICAL)

`TruckPanel` calls `_push()` on **every** `Slider.onChanged` tick:

* `truck_panel.dart:70` length, `:81` width, `:92` height, `:108` max payload,
  `:157` cab colour, `:329` exposure
* `_push()` → `widget.onSpecChanged()` → `app_shell.dart:261 _applySpec()`
* `_applySpec()` → `_bridge.init(spec)` + `_bridge.loadCargo(plan)`

`init` is a **whole-scene rebuild** in JS: dispose + recreate tractor, trailer,
curtains, doors, environment floor (30×72 grid), cyclorama (64×10 grid), dimension
overlay, then re-stage every cargo item.

`trailerLength` has 84 divisions, so one full slider drag ≈ **84 complete scene
rebuilds**. With cargo re-staged each time this is the freeze the user feels.

The same path is used for **payload, cab colour and exposure**, none of which
change geometry at all — so moving the exposure slider rebuilds the truck. This is
exactly the reported "changing one setting unexpectedly changes another part of the
scene".

Amplifier: `app_shell.dart:129` (`case 'ready'`) re-sends `loadCargo` whenever the
renderer reports ready, so each rebuild re-stages the load as well.

**Fix (Phase 1):** split the protocol into targeted commands
(`setGeometry`, `setPayload`, `setCabColor`, `setExposure`), keep `init` for first
boot only, rebuild only affected parts, and debounce UI pushes (~140 ms).

### 2.2 Camera — presets 90° out, vertical drag inverted, mode leakage

In `app.js`:

* `orbitPos()` measures yaw from `+Z`, but `PRESETS` are named as if yaw were
  measured from the truck's `+X` forward axis → `front`, `rear`, `left`, `right`
  are each rotated by 90°.
* mouse: `CAM.yaw -= dx * 0.005`, `CAM.pitch += dy * 0.004` → vertical drag
  inverted; interior uses different sign conventions.
* `moveForward()` / `panCamera()` run in **both** modes; in orbit mode
  `moveForward()` calls `clampInterior()` and `updateLookTarget()`, which can
  teleport the exterior camera into the trailer and destroy the orbit state.
* `CAM.anim = null` on pointer move cancels a preset transition and snaps through
  `applyOrbit()` from stale values.
* `gotoPreset()` animates position and orbit parameters independently → jump at
  the end of the transition.
* no damping: raw deltas are applied directly, so motion is jittery.
* `CAM.saved` is declared but never used; `exitTrailer()` hardcodes angles instead
  of restoring the previous exterior view.
* `lookAt()` hardcodes up `[0,1,0]` with a degenerate fallback → flip/snap when
  looking straight up or down.

**Fix (Phase 2):** dedicated camera module, damped orbit (`yaw/pitch/dist` targets
with critically-damped smoothing), pitch clamp ±80°, wheel zoom with min/max,
stable up vector, dedicated orbit target, saved/restored exterior state, and a
separate interior walk camera with its own input mapping.

### 2.3 Tent state cannot be per-side (host side)

* `RendererBridge.setTent({left, right, rear})` (`renderer_host.dart:62`) already
  supports independent sides.
* `AppState.setTent(bool)` (`app_state.dart:277`) and `openTent()` /
  `closeTent()` are all-or-nothing.
* `app_shell.dart:157` collapses renderer events back into one boolean:
  `tentOpen = left != 0 || right != 0`.

So JS can already animate each side separately (one part per curtain panel, each
with its own `x0/side/panelIndex`), but the host throws that information away.

**Fix (Phase 4):** `tentLeft / tentRight / tentRear` in `AppState`, dedicated
commands, and UI toggles that drive one side at a time.

### 2.4 Rear doors hinge incorrectly

In `applyTent()` each door rotates by `dir * 4.712` (270°) around its hinge. Both
doors therefore swing the **same** direction and finish pointing into the trailer
instead of mirroring outward. A real pair of rear doors must rotate in opposite
directions around their own hinges.

**Fix (Phase 4):** mirrored hinge rotation of ±90° about each door's own hinge
axis, with the door's local origin at the hinge.

### 2.5 RESET conflates camera, scene and configuration

`app_shell.dart:252 _reset()` → `AppState.resetAll()` (`app_state.dart:293`) →
clears cargo quantities, plan, stage, camera, tent, dimensions, active cargo; then
`_bridge.reset()` (JS also resets camera + cargo + tent). `resetAll()` forces
`camera = CameraView.overview`, so a reset also throws away the user's chosen view.
`RendererBridge` has **no** `resetCamera`.

**Fix (Phase 1):** `RESET CAMERA` (camera only, view selection preserved) and
`RESET SCENE` (cargo in trailer, tent, dimensions, load stage — but **keep** truck
spec and cargo quantities).

### 2.6 No scene hierarchy

Geometry is baked into world coordinates at build time (`Mesh` in `core.js`); each
part carries an optional `model` matrix used as a local offset. Cargo is added to
the renderer root in world coordinates. Everything currently works only because the
truck never moves. As soon as the truck can rotate, cargo will not follow the
trailer.

**Fix (Phase 3):** node hierarchy `TRUCK → TRAILER → CARGO` where each part
resolves `world = parent.matrix * local`, applied in both the colour and shadow
passes.

### 2.7 Performance

* `applyTent()` rebuilds matrices and light arrays every frame.
* `applyCargoAt()` posts `loadProgress` **every frame**; `post()` now flushes
  immediately, so up to ~60 bridge calls/second reach Dart and each one triggers
  `notifyListeners()` → full `setState` of the whole shell.
* `gfx.js` allocates render arrays and a point-light `Float32Array` per frame.
* Shadow map re-rendered every frame at 2048² for all parts; expensive PBR
  fragment shader with 6 point lights.
* `clearCargo()` splices arrays without disposing GL buffers → GPU memory grows on
  every reload.
* `CARGO_PARTS.find()` per item per frame during loading.
* No frustum culling, no per-part bounds.

**Fix (Phase 5):** throttle progress to ~10 Hz and only on change, dispose GL
resources on clear, hoist per-frame allocations, cache part lookups, add bounds +
frustum culling, render the shadow map only when the scene is dirty.

### 2.8 Robustness gaps

* `boot()` has no duplicate-init guard → a second init would attach duplicate
  input listeners (doubled / reversed input sensitivity).
* `enterTrailer()` mutates tent state directly in JS without posting a `tent`
  event → host state can desynchronise.
* `TruckSpec.fromJson` trusts persisted values; no validation of ranges.
* No save / load configuration file; camera view is not persisted.
* `app_shell.dart` switch cases rely on implicit non-fallthrough; add explicit
  `break;` for clarity.

---

## 3. Target architecture

```
Flutter host                          WebView2 renderer
-----------                          -----------------
AppState (single source of truth)  -> commands (targeted, never "sync everything")
  ├ truck spec      ── setGeometry ──> rebuild trailer + dims only
  ├ payload         ── setPayload  ──> host only, no 3D work
  ├ cab colour      ── setCabColor ──> material update only
  ├ exposure        ── setExposure ──> uniform update only
  ├ tent L/R/rear   ── tent       ──> per-side curtain/door targets
  ├ camera view     ── camera     ──> orbit target (damped)
  ├ interior toggle ── enter/exit ──> interior walk camera
  └ reset camera /  ── resetCamera/resetScene
    reset scene
        <──────────── events (throttled, batched)
```

Rules:

1. **No command may rebuild the scene unless geometry actually changed.**
2. **Camera state is owned by the renderer**, the host only stores the *view
   selection*; `resetCamera` never changes the selection.
3. **Every animated control has its own target and its own damped value**; nothing
   reads a global "open" flag.
4. **Events are throttled and batched**; the host must never be called per frame.
5. **All transforms are local**; world matrices are derived, never stored twice.

---

## 4. Migration order

| Phase | Scope | Risk |
| --- | --- | --- |
| 1 | protocol split, debounce, reset separation, per-side tent state | low |
| 2 | camera module (orbit + interior) | medium |
| 3 | transform hierarchy | medium |
| 4 | curtain / door controllers | low |
| 5 | performance | medium |
| 6 | panel layout + save/load | low |
| 7 | regression suite, build, install | low |

Each phase keeps the app runnable and is verified with
`flutter analyze`, `flutter test`, the headless renderer harness
(`tool/devtest/devtest.html`) and the packaged smoke run (`TENT3D_SMOKE=1`).

---

## 5. Regression checklist

* [ ] drag every slider: no full-scene rebuild, no stall, geometry only on geometry
* [ ] preset buttons land on the named side (front / rear / left / right / top)
* [ ] vertical drag up moves the camera up, in both orbit and interior mode
* [ ] pitch clamps at ±80°, zoom clamps at min/max, no roll at any angle
* [ ] exiting the trailer restores the exact exterior view
* [ ] interior walk collides with walls, floor and loaded cargo
* [ ] left / right curtains and rear doors animate independently and mirror correctly
* [ ] cargo follows the trailer when the truck is rotated
* [ ] RESET CAMERA keeps the selected view; RESET SCENE keeps spec and quantities
* [ ] load progress events ≤ ~10/s, GPU memory stable across repeated reloads
* [ ] 60 FPS at the default view with a full load, no per-frame allocation growth