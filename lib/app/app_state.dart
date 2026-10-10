/// TENT 3D :: app_state.dart — single source of truth for the whole UI.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart' show IconData, Icons;
import 'package:shared_preferences/shared_preferences.dart';

import '../model/cargo_plan.dart';
import '../model/cargo_type.dart';
import '../model/truck_spec.dart';

enum CameraView { overview, corner, front, rear, left, right, top, interior, free }

extension CameraViewLabel on CameraView {
  String get id => switch (this) {
        CameraView.overview => 'overview',
        CameraView.corner => 'corner',
        CameraView.front => 'front',
        CameraView.rear => 'rear',
        CameraView.left => 'left',
        CameraView.right => 'right',
        CameraView.top => 'top',
        CameraView.interior => 'interior',
        CameraView.free => 'free',
      };

  String get label => switch (this) {
        CameraView.overview => 'Overview',
        CameraView.corner => 'Corner',
        CameraView.front => 'Front',
        CameraView.rear => 'Rear',
        CameraView.left => 'Left',
        CameraView.right => 'Right',
        CameraView.top => 'Top',
        CameraView.interior => 'Interior',
        CameraView.free => 'Free',
      };

  IconData get icon => switch (this) {
        CameraView.overview => Icons.threesixty_rounded,
        CameraView.corner => Icons.view_in_ar_rounded,
        CameraView.front => Icons.arrow_forward_rounded,
        CameraView.rear => Icons.arrow_back_rounded,
        CameraView.left => Icons.turn_left_rounded,
        CameraView.right => Icons.turn_right_rounded,
        CameraView.top => Icons.vertical_align_top_rounded,
        CameraView.interior => Icons.door_front_door_outlined,
        CameraView.free => Icons.explore_rounded,
      };
}

enum LoadStage { idle, planning, loading, done, failed }

class AppState extends ChangeNotifier {
  AppState();

  SharedPreferences? _prefs;

  TruckSpec spec = TruckSpec();

  /// Selected cargo quantities, keyed by cargo id.
  final Map<String, int> quantities = <String, int>{};

  CargoPlan plan = CargoPlan.empty;
  CargoMode activeMode = CargoMode.wood;
  String? activeCargoId;

  CameraView camera = CameraView.overview;
  bool tentLeftOpen = false;
  bool tentRightOpen = false;
  bool rearDoorsOpen = false;
  bool dimensions = false;
  bool interiorMode = false;

  /// True when at least one side is open — the interior is only reachable then.
  bool get tentOpen => tentLeftOpen || tentRightOpen;

  LoadStage stage = LoadStage.idle;
  double loadProgress = 0;
  int placed = 0;
  int total = 0;

  bool rendererReady = false;
  String? fatalError;
  String hint = '';
  Timer? _hintTimer;

  double get placedWeight => plan.totalWeight;
  double get weightRatio =>
      spec.payload <= 0 ? 0 : (placedWeight / spec.payload).clamp(0.0, 1.0);
  double get volumeRatio =>
      spec.cargoVolume <= 0 ? 0 : (plan.totalVolume / spec.cargoVolume).clamp(0.0, 1.0);
  double get fillHeight {
    if (plan.placements.isEmpty) return 0;
    final double top = plan.placements
        .map<double>((Placement p) => p.y + p.dims[1] / 2)
        .reduce(math.max);
    return ((top - spec.floorY) / spec.innerHeight).clamp(0.0, 1.0);
  }

  double get frontFree {
    if (plan.placements.isEmpty) return 1.0;
    final double deepest = plan.placements
        .map<double>((Placement p) => p.x + p.dims[0] / 2)
        .reduce(math.max);
    return ((deepest - spec.rearX) / spec.trailerLength).clamp(0.0, 1.0);
  }

  int quantityOf(String id) => quantities[id] ?? 0;

  int get itemCount =>
      quantities.values.fold<int>(0, (int s, int v) => s + v);

  double get requestedWeight {
    double w = 0;
    for (final CargoType t in kCargoTypes) {
      w += quantityOf(t.id) * t.weight;
    }
    return w;
  }

  // --------------------------------------------------------------- lifecycle
  Future<void> load() async {
    try {
      _prefs = await SharedPreferences.getInstance();
      final String? specJson = _prefs!.getString('spec');
      if (specJson != null && specJson.isNotEmpty) {
        spec = TruckSpec.fromJson(jsonDecode(specJson) as Map<String, dynamic>);
      }
      final String? q = _prefs!.getString('quantities');
      if (q != null && q.isNotEmpty) {
        final Map<String, dynamic> m = jsonDecode(q) as Map<String, dynamic>;
        m.forEach((String k, dynamic v) {
          quantities[k] = (v as num).toInt();
        });
      }
      activeCargoId = _prefs!.getString('activeCargo');
      if (activeCargoId != null && !kCargoById.containsKey(activeCargoId)) {
        activeCargoId = null;
      }
    } catch (e) {
      debugPrint('settings load failed: $e');
    }
    replan(silent: true);
  }

  Future<void> _persist() async {
    final SharedPreferences? p = _prefs;
    if (p == null) return;
    try {
      await p.setString('spec', spec.encode());
      await p.setString('quantities', jsonEncode(quantities));
      final String? cargo = activeCargoId;
      if (cargo != null) {
        await p.setString('activeCargo', cargo);
      }
    } catch (e) {
      debugPrint('settings save failed: $e');
    }
  }

  // ------------------------------------------------------------------ hints
  void showHint(String message, {int seconds = 4}) {
    hint = message;
    notifyListeners();
    _hintTimer?.cancel();
    _hintTimer = Timer(Duration(seconds: seconds), () {
      hint = '';
      notifyListeners();
    });
  }

  // --------------------------------------------------------------- planning
  void setQuantity(String id, int q) {
    final CargoType? t = kCargoById[id];
    if (t == null) return;
    final int v = q.clamp(0, t.maxQty);
    if (v == 0) {
      quantities.remove(id);
    } else {
      quantities[id] = v;
    }
    activeCargoId = id;
    replan();
  }

  void adjustQuantity(String id, int delta) {
    setQuantity(id, quantityOf(id) + delta);
  }

  void clearCargoQuantities() {
    quantities.clear();
    replan();
  }

  void setPreset(String id, int qty) {
    quantities.clear();
    quantities[id] = qty;
    activeCargoId = id;
    replan();
  }

  /// Recomputes the load plan with the current trailer geometry + quantities.
  void replan({bool silent = false}) {
    final List<CargoItem> items = buildItems(quantities);
    plan = planLoad(items, CargoBox.from(spec));
    if (!silent) notifyListeners();
    _persist();
  }

  /// Re-runs the packer after the trailer dimensions changed.
  void onSpecChanged() {
    replan(silent: true);
    notifyListeners();
    _persist();
  }

  /// Cab colour / exposure changed: nothing to re-plan, just persist.
  void onLookChanged() {
    _persist();
  }

  /// Max payload changed: this is a planning limit only, so the 3D scene is not
  /// rebuilt, but the packer must re-run or the manifest would keep the plan
  /// computed against the previous limit.
  void onPayloadChanged() {
    replan(silent: true);
    notifyListeners();
  }

  // ------------------------------------------------------------------ status
  void onRendererReady() {
    rendererReady = true;
    fatalError = null;
    notifyListeners();
  }

  void onFatal(String message) {
    fatalError = message;
    rendererReady = false;
    notifyListeners();
  }

  void onLoadStart(int count) {
    stage = LoadStage.loading;
    total = count;
    placed = 0;
    loadProgress = 0;
    notifyListeners();
  }

  void onLoadProgress(int placedCount, int totalCount, double progress) {
    placed = placedCount;
    total = totalCount;
    loadProgress = progress;
    if (stage == LoadStage.idle) stage = LoadStage.loading;
    notifyListeners();
  }

  void onLoadComplete() {
    stage = LoadStage.done;
    loadProgress = 1;
    placed = total;
    notifyListeners();
  }

  void onCameraMode(String mode, String preset) {
    interiorMode = mode == 'interior';
    if (mode == 'orbit' && preset.isNotEmpty) {
      final CameraView? v = CameraView.values
          .cast<CameraView?>()
          .firstWhere((CameraView? c) => c?.id == preset, orElse: () => null);
      if (v != null) camera = v;
    }
    if (mode == 'interior') {
      camera = CameraView.interior;
    } else if (interiorMode && mode == 'orbit') {
      camera = preset == 'exterior'
          ? CameraView.overview
          : CameraView.free;
    }
    notifyListeners();
  }

  void setCameraLocal(CameraView v) {
    camera = v;
    notifyListeners();
  }

  /// Mirrors the renderer tent state (per side plus the rear doors).
  void setTentState({
    required bool left,
    required bool right,
    required bool rear,
  }) {
    tentLeftOpen = left;
    tentRightOpen = right;
    rearDoorsOpen = rear;
    notifyListeners();
  }

  void setTentSide(String side, bool open) {
    if (side == 'left') {
      tentLeftOpen = open;
    } else {
      tentRightOpen = open;
    }
    notifyListeners();
  }

  void setRearDoors(bool open) {
    rearDoorsOpen = open;
    notifyListeners();
  }

  /// Camera-only reset: the selected view is kept, the renderer restores that
  /// preset. Scene contents (cargo, tent, dimensions) are untouched.
  void resetCamera() {
    notifyListeners();
  }

  /// Scene-only reset: clears what is staged in the 3D view while keeping the
  /// truck configuration, cargo quantities and the current camera view.
  void resetScene() {
    plan = CargoPlan.empty;
    total = 0;
    placed = 0;
    loadProgress = 0;
    stage = LoadStage.idle;
    tentLeftOpen = false;
    tentRightOpen = false;
    rearDoorsOpen = false;
    dimensions = false;
    interiorMode = false;
    notifyListeners();
  }

  void setDimensions(bool on) {
    dimensions = on;
    notifyListeners();
  }

  /// Full reset back to factory defaults. Kept separate from [resetCamera] and
  /// [resetScene] because it is the only one that discards the user's truck
  /// configuration and cargo selection.
  void resetAll() {
    quantities.clear();
    spec = TruckSpec();
    plan = CargoPlan.empty;
    total = 0;
    placed = 0;
    loadProgress = 0;
    stage = LoadStage.idle;
    camera = CameraView.overview;
    interiorMode = false;
    tentLeftOpen = false;
    tentRightOpen = false;
    rearDoorsOpen = false;
    dimensions = false;
    activeCargoId = null;
    notifyListeners();
    _persist();
  }
}
