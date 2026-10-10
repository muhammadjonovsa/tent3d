/// TENT 3D :: app_shell.dart
///
/// Layout: header Â· [ truck | cargo ] Â· viewport Â· [ load plan ] Â· camera bar.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:flutter/material.dart';

import '../engine/renderer_host.dart';
import 'app_state.dart';
import 'log.dart';
import 'panels/camera_bar.dart';
import 'panels/cargo_panel.dart';
import 'panels/header_bar.dart';
import 'panels/load_panel.dart';
import 'panels/truck_panel.dart';
import 'panels/viewport_overlay.dart';
import 'theme.dart';

class T3App extends StatefulWidget {
  const T3App({super.key});

  @override
  State<T3App> createState() => _T3AppState();
}

class _T3AppState extends State<T3App> with TickerProviderStateMixin {
  late final AppState _state;
  final RendererBridge _bridge = RendererBridge();
  bool _loaded = false;
  bool _loadPaused = false;
  Timer? _geometryTimer;

  // live dimension anchors, filled by the renderer
  final List<Map<String, dynamic>> _anchors = <Map<String, dynamic>>[];
  Timer? _anchorTimer;

  @override
  void initState() {
    super.initState();
    _state = AppState();
    _state.load();
    _state.addListener(_onStateChanged);
  }

  @override
  void dispose() {
    _anchorTimer?.cancel();
    _geometryTimer?.cancel();
    _state.removeListener(_onStateChanged);
    _state.dispose();
    super.dispose();
  }

  void _onStateChanged() {
    if (mounted) setState(() {});
  }

  /// Coalesces rapid control changes (slider drags) into a single push.
  /// Without this a drag emits one command per tick, which used to mean a
  /// complete scene rebuild per tick.
  Future<void> _scheduleGeometryPush() async {
    _geometryTimer?.cancel();
    final Completer<void> done = Completer<void>();
    _geometryTimer = Timer(const Duration(milliseconds: 140), () async {
      await _applySpec();
      if (!done.isCompleted) done.complete();
    });
    return done.future;
  }

  // ------------------------------------------------------------- bridge in
  void _onDocumentLoaded() {
    if (_loaded) return;
    _loaded = true;
    T3Log.write('document loaded; spec=${_state.spec.encode()}');
    _bridge.init(_state.spec);
    Timer(const Duration(seconds: 4), _diagnoseRenderer);
  }

  /// One-shot check that the inlined scene actually booted inside WebView2.
  Future<void> _diagnoseRenderer() async {
    if (_state.rendererReady) return;
    for (final String q in const <String>[
      'typeof window.TENT3D',
      'window.TENT3D && window.TENT3D.stats ? JSON.stringify(window.TENT3D.stats()) : "no-stats"',
      'document.getElementById("boot") ? document.getElementById("boot").className : "no-boot"',
      'document.getElementById("err") ? document.getElementById("err").textContent : "no-err"',
    ]) {
      final dynamic r = await _bridge.eval(q);
      T3Log.write('probe [$q] => $r');
    }
  }

  /// End-to-end command check. Opt-in via TENT3D_SMOKE=1 so shipped builds
  /// never touch the scene on their own.
  Future<void> _smokeTest() async {
    _state.setQuantity('pallets', 6);
    _state.setQuantity('boxes', 14);
    _state.setTentSide('left', true);
    _state.setTentSide('right', true);
    _state.setRearDoors(true);
    _state.setDimensions(true);
    await _bridge.tentSide('left', true);
    await _bridge.tentSide('right', true);
    await _bridge.rearDoors(true);
    await _bridge.loadCargo(_state.plan);

    const List<List<dynamic>> steps = <List<dynamic>>[
      <dynamic>['dimensions', <String, dynamic>{'visible': true}],
      <dynamic>['camera', <String, dynamic>{'preset': 'rear', 'instant': true}],
      <dynamic>['enterTrailer', <String, dynamic>{}],
      <dynamic>['resetCamera', <String, dynamic>{}],
    ];
    for (final List<dynamic> step in steps) {
      final String js = 'window.TENT3D.receive(${jsonEncode(jsonEncode(<String, dynamic>{'t': step[0], ...(step[1] as Map<String, dynamic>)}))})';
      await _bridge.eval(js);
      await Future<void>.delayed(const Duration(milliseconds: 600));
    }
    await Future<void>.delayed(const Duration(seconds: 3));
    for (final String q in const <String>[
      'JSON.stringify(window.TENT3D.stats())',
      'JSON.stringify(window.TENT3D.state().tent)',
      'JSON.stringify(window.TENT3D.state().camera)',
      'JSON.stringify(window.TENT3D.state().dims)',
      'JSON.stringify(window.TENT3D.state().load)',
      'JSON.stringify(window.TENT3D.state().forklift)',
    ]) {
      T3Log.write('smoke $q => ${await _bridge.eval(q)}');
    }
    for (int i = 0; i < 20; i++) {
      await Future<void>.delayed(const Duration(seconds: 1));
      if (_state.loadProgress >= 1 || _state.stage != LoadStage.loading) break;
    }
    T3Log.write('smoke host => placed=${_state.placed}/${_state.total} '
        'progress=${_state.loadProgress.toStringAsFixed(2)} '
        'stage=${_state.stage.name} anchors=${_anchors.length} '
        'interior=${_state.interiorMode} dims=${_state.dimensions} '
        'tent=${_state.tentOpen} plan=${_state.plan.placements.length}');
    T3Log.write('smoke load => ${await _bridge.eval('JSON.stringify(window.TENT3D.state().load)')}');
  }

  void _onRendererMessage(Map<String, dynamic> m) {
    final String type = (m['t'] ?? '') as String;
    switch (type) {
      case 'ready':
        T3Log.write(
            'renderer ready: ${m['parts']} parts / ${m['tris']} tris');
        _state.onRendererReady();
        if (_state.plan.placements.isNotEmpty) {
          _bridge.loadCargo(_state.plan);
        }
        if (Platform.environment['TENT3D_SMOKE'] == '1') {
          Future<void>.delayed(const Duration(seconds: 1), _smokeTest);
        }
      case 'error':
        T3Log.write('renderer error: ${m['message']}');
        _state.onFatal('${m['message']}');
      case 'loadStart':
        _state.onLoadStart((m['total'] as num?)?.toInt() ?? 0);
      case 'loadProgress':
        _state.onLoadProgress(
          (m['placed'] as num?)?.toInt() ?? 0,
          (m['total'] as num?)?.toInt() ?? 0,
          (m['progress'] as num?)?.toDouble() ?? 0,
        );
      case 'loadComplete':
        _state.onLoadComplete();
      case 'cameraMode':
        _state.onCameraMode(
          (m['mode'] ?? '') as String,
          (m['preset'] ?? '') as String,
        );
      case 'tent':
        _state.setTentState(
          left: ((m['left'] as num?) ?? 0) > 0.5,
          right: ((m['right'] as num?) ?? 0) > 0.5,
          rear: ((m['rear'] as num?) ?? 0) > 0.5,
        );
      case 'anchors':
        _anchorTimer?.cancel();
        final List<dynamic> items = (m['items'] as List<dynamic>?) ?? <dynamic>[];
        _anchors
          ..clear()
          ..addAll(items.whereType<Map<dynamic, dynamic>>().map(
              (Map<dynamic, dynamic> e) =>
                  Map<String, dynamic>.from(e.cast<String, dynamic>())));
        if (mounted) setState(() {});
      default:
        if (type.isNotEmpty && type != 'cameraMode') {
          T3Log.write('event $type ${m.length > 1 ? m.entries.skip(1).map((MapEntry<String, dynamic> e) => '${e.key}=${e.value}').join(' ') : ''}');
        }
    }
  }

  // ------------------------------------------------------------ bridge out
  /// Appearance-only update: cab colour and exposure are material/uniform
  /// changes, never geometry rebuilds.
  Future<void> _applyLook() async {
    _state.onLookChanged();
    await _bridge.setCabColor(_state.spec);
    await _bridge.setExposure(_state.spec.exposure);
  }

  Future<void> _applyCamera(CameraView v) async {
    switch (v) {
      case CameraView.overview:
        await _bridge.camera('overview');
      case CameraView.front:
        await _bridge.camera('front');
      case CameraView.rear:
        await _bridge.camera('rear');
      case CameraView.left:
        await _bridge.camera('left');
      case CameraView.right:
        await _bridge.camera('right');
      case CameraView.top:
        await _bridge.camera('top');
      case CameraView.corner:
        await _bridge.camera('corner');
      case CameraView.interior:
        if (_state.tentOpen) {
          await _bridge.enterTrailer();
        } else {
          _state.showHint('Open a curtain before walking inside');
        }
      case CameraView.free:
        await _bridge.look('orbit');
    }
    _state.setCameraLocal(v);
  }

  Future<void> _toggleTent() async {
    final bool next = !_state.tentOpen;
    if (next) {
      await _bridge.openTent();
      _state.showHint('Tent open â€” rear doors swung back');
    } else {
      await _bridge.closeTent();
    }
  }

  /// Curtains are driven per side so the left and right walls can be opened
  /// independently.
  Future<void> _toggleTentSide(String side) async {
    final bool next =
        side == 'left' ? !_state.tentLeftOpen : !_state.tentRightOpen;
    _state.setTentSide(side, next);
    await _bridge.tentSide(side, next);
  }

  Future<void> _toggleRearDoors() async {
    final bool next = !_state.rearDoorsOpen;
    _state.setRearDoors(next);
    await _bridge.rearDoors(next);
  }

  Future<void> _toggleDimensions() async {
    _state.setDimensions(!_state.dimensions);
    await _bridge.dimensions(_state.dimensions);
    if (_state.dimensions) {
      _state.showHint('Dimension lines on');
    }
  }

  Future<void> _load() async {
    if (_state.plan.placements.isEmpty) {
      _state.showHint('Pick a cargo type and set a quantity first');
      return;
    }
    if (!_state.tentOpen) await _toggleTent();
    setState(() => _loadPaused = false);
    _state.stage = LoadStage.loading;
    _bridge.pauseLoad(false);
    await _bridge.loadCargo(_state.plan);
    _state.showHint('Loading ${_state.plan.boxes} unitsâ€¦');
  }

  Future<void> _clear() async {
    _loadPaused = false;
    _state.clearCargoQuantities();
    await _bridge.clearCargo();
    _state.showHint('Trailer cleared');
  }

  Future<void> _pause() async {
    setState(() => _loadPaused = !_loadPaused);
    await _bridge.pauseLoad(_loadPaused);
    _state.showHint(_loadPaused ? 'Loading paused' : 'Loading resumed');
  }

  /// Camera reset only: restores the current view, keeps the scene as it is.
  Future<void> _resetCamera() async {
    await _bridge.resetCamera();
    _state.resetCamera();
    _state.showHint('Camera reset');
  }

  /// Scene reset only: clears the staged cargo, closes the tent and hides the
  /// dimensions, while the truck setup, cargo quantities and view are kept.
  Future<void> _resetScene() async {
    _loadPaused = false;
    _state.resetScene();
    _anchors.clear();
    await _bridge.resetScene();
    _state.showHint('Scene reset');
  }

  /// Full factory reset.
  Future<void> _resetAll() async {
    _loadPaused = false;
    _geometryTimer?.cancel();
    _state.resetAll();
    _anchors.clear();
    await _bridge.init(_state.spec);
    _state.showHint('All settings reset');
  }

  /// Only the trailer shape changed: rebuild the affected geometry, keep the
  /// camera and the open curtains, then re-stage the (re-planned) cargo.
  Future<void> _applySpec() async {
    _state.onSpecChanged();
    await _bridge.setGeometry(_state.spec);
    if (_state.plan.placements.isNotEmpty) {
      await _bridge.loadCargo(_state.plan);
    }
    _state.showHint('Trailer geometry updated');
  }

  Future<void> _exitInterior() async {
    await _bridge.exitTrailer();
  }

  /// Max payload changed: re-pack the manifest only. The renderer is never
  /// touched, because payload does not alter a single vertex.
  Future<void> _applyPayload() async {
    _state.onPayloadChanged();
  }

  // ------------------------------------------------------------------ build
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: T3.bg,
      body: Column(
        children: <Widget>[
          HeaderBar(
            state: _state,
            onResetCamera: _resetCamera,
            onResetScene: _resetScene,
            onResetAll: _resetAll,
            onPause: _pause,
            paused: _loadPaused,
          ),
          Expanded(
            child: Row(
              children: <Widget>[
                SizedBox(
                  width: 332,
                  child: LeftPanel(
                    state: _state,
                    onSpecChanged: _scheduleGeometryPush,
                    onLookChanged: _applyLook,
                    onPayloadChanged: _applyPayload,
                    onLoad: _load,
                    onClear: _clear,
                  ),
                ),
                Expanded(
                  child: Stack(
                    children: <Widget>[
                      Positioned.fill(
                        child: ColoredBox(
                          color: T3.bgAlt,
                          child: RendererViewport(
                            state: _state,
                            bridge: _bridge,
                            onMessage: _onRendererMessage,
                            onDocumentLoaded: _onDocumentLoaded,
                          ),
                        ),
                      ),
                      Positioned.fill(
                        child: IgnorePointer(
                          child: ViewportOverlay(
                            state: _state,
                            anchors: _anchors,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: 296,
                  child: LoadPanel(
                    state: _state,
                    onLoad: _load,
                    onPause: _pause,
                    onClear: _clear,
                    paused: _loadPaused,
                  ),
                ),
              ],
            ),
          ),
          CameraBar(
            state: _state,
            onCamera: _applyCamera,
            onTent: _toggleTent,
            onTentSide: _toggleTentSide,
            onRearDoors: _toggleRearDoors,
            onDimensions: _toggleDimensions,
            onExitInterior: _exitInterior,
          ),
        ],
      ),
    );
  }
}

/// Left column: vehicle geometry + cargo catalogue.
class LeftPanel extends StatelessWidget {
  const LeftPanel({
    super.key,
    required this.state,
    required this.onSpecChanged,
    required this.onLookChanged,
    required this.onPayloadChanged,
    required this.onLoad,
    required this.onClear,
  });

  final AppState state;
  final Future<void> Function() onSpecChanged;
  final Future<void> Function() onLookChanged;
  final Future<void> Function() onPayloadChanged;
  final Future<void> Function() onLoad;
  final Future<void> Function() onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: T3.bgAlt,
        border: Border(right: BorderSide(color: T3.stroke)),
      ),
      child: Column(
        children: <Widget>[
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
              children: <Widget>[
                TruckPanel(
                  state: state,
                  onSpecChanged: onSpecChanged,
                  onLookChanged: onLookChanged,
                  onPayloadChanged: onPayloadChanged,
                ),
                const SizedBox(height: 12),
                CargoPanel(state: state),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 14),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: GlowButton(
                    label: 'Load Cargo',
                    icon: Icons.local_shipping_rounded,
                    onPressed: () => onLoad(),
                  ),
                ),
                const SizedBox(width: 8),
                GhostButton(
                  label: 'Clear',
                  icon: Icons.delete_outline_rounded,
                  dense: true,
                  onPressed: () => onClear(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Formats a mass in kg or tonnes.
String fmtWeight(double kg) =>
    kg >= 1000 ? (kg / 1000).toStringAsFixed(2) : kg.toStringAsFixed(0);

String fmtVolume(double m3) => m3.toStringAsFixed(1);
