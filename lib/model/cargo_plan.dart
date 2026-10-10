/// TENT 3D :: cargo_plan.dart
///
/// Dart mirror of `planLoad` in assets/renderer/js/cargo.js. Keeping an exact
/// copy here means the capacity read-outs react instantly while the slider
/// moves, while the renderer still owns the animated placement.
library;

import 'dart:math' as math;

import 'cargo_type.dart';
import 'truck_spec.dart';

class CargoItem {
  CargoItem({
    required this.id,
    required this.typeId,
    required this.index,
    required this.dims,
    required this.weight,
    this.yaw = 0,
  });

  final String id;
  final String typeId;
  final int index;
  final List<double> dims;
  final double weight;
  final double yaw;

  double get l => dims[0];
  double get h => dims[1];
  double get w => dims[2];
}

class Placement {
  Placement({
    required this.id,
    required this.typeId,
    required this.index,
    required this.dims,
    required this.weight,
    required this.x,
    required this.y,
    required this.z,
    this.yaw = 0,
  });

  final String id;
  final String typeId;
  final int index;
  final List<double> dims;
  final double weight;
  final double x;
  final double y;
  final double z;
  final double yaw;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'typeId': typeId,
        'index': index,
        'dims': dims,
        'weight': weight,
        'x': x,
        'y': y,
        'z': z,
        'yaw': yaw,
      };
}

class CargoPlan {
  CargoPlan({
    required this.placements,
    required this.requested,
    required this.boxes,
    required this.rejected,
  });

  final List<Placement> placements;

  /// How many units the user asked for in total.
  final int requested;

  /// How many actually fit.
  final int boxes;

  /// Units that did not fit inside the trailer.
  final int rejected;

  double get totalWeight =>
      placements.fold(0.0, (double s, Placement p) => s + p.weight);
  double get totalVolume => placements.fold(
      0.0, (double s, Placement p) => s + p.dims[0] * p.dims[1] * p.dims[2]);

  List<Map<String, dynamic>> toJson() =>
      placements.map((Placement p) => p.toJson()).toList();

  static final CargoPlan empty = CargoPlan(
      placements: <Placement>[], requested: 0, boxes: 0, rejected: 0);
}

class _Box {
  _Box(this.x0, this.x1, this.y0, this.y1, this.z0, this.z1);
  final double x0, x1, y0, y1, z0, z1;
}

/// Greedy 3D shelf packer — must stay byte-for-byte equivalent in behaviour
/// with the JavaScript version.
CargoPlan planLoad(List<CargoItem> items, CargoBox box) {
  final List<_Box> placed = <_Box>[];
  final List<Placement> out = <Placement>[];
  final List<List<double>> candidates = <List<double>>[
    <double>[box.x1, box.z1],
    <double>[box.x1, box.z0],
  ];
  const double gap = 0.012;
  const double eps = 1e-6;
  int index = 0;

  for (final CargoItem it in items) {
    final double L = it.dims[0];
    final double H = it.dims[1];
    final double W = it.dims[2];
    double bx0 = 0, by0 = 0, bz0 = 0;
    bool found = false;
    double bestScore = -double.infinity;

    for (final List<double> c in candidates) {
      final double x0 = c[0] - L;
      final double z0 = c[1] - W;
      if (x0 < box.x0 - eps ||
          z0 < box.z0 - eps ||
          z0 + W > box.z1 + eps ||
          x0 + L > box.x1 + eps) {
        continue;
      }
      double y = box.y0;
      int overlap = 0;
      for (final _Box p in placed) {
        if (x0 + L <= p.x0 + gap ||
            x0 >= p.x1 - gap ||
            z0 + W <= p.z0 + gap ||
            z0 >= p.z1 - gap) {
          continue;
        }
        overlap++;
        if (p.y1 + gap > y) y = p.y1 + gap;
      }
      if (y + H > box.y1 + eps) continue;
      final double centreZ = z0 + W / 2.0;
      final double score =
          -y * 3.0 + (x0 + L) * 1.2 - centreZ.abs() * 0.35 - overlap * 0.05;
      if (score > bestScore) {
        bestScore = score;
        bx0 = x0;
        by0 = y;
        bz0 = z0;
        found = true;
      }
    }

    if (!found) break;
    index++;

    out.add(Placement(
      id: it.id,
      typeId: it.typeId,
      index: index - 1,
      dims: it.dims,
      weight: it.weight,
      x: bx0 + L / 2.0,
      y: by0 + H / 2.0,
      z: bz0 + W / 2.0,
      yaw: it.yaw,
    ));
    placed.add(_Box(bx0, bx0 + L, by0, by0 + H, bz0, bz0 + W));

    candidates
      ..add(<double>[bx0, bz0])
      ..add(<double>[bx0, bz0 + W])
      ..add(<double>[bx0 + L, bz0])
      ..add(<double>[bx0 + L, bz0 + W])
      ..add(<double>[bx0, bz0 - W])
      ..add(<double>[bx0, bz0 + 2 * W])
      ..add(<double>[bx0 - L, bz0])
      ..add(<double>[bx0 - L, bz0 + W]);
    if (candidates.length > 180) {
      candidates.removeRange(2, 2 + (candidates.length - 176));
    }
  }

  return CargoPlan(
    placements: out,
    requested: items.length,
    boxes: out.length,
    rejected: items.length - out.length,
  );
}

/// Builds the item list the renderer expects, honouring the per-mode quantity
/// the user picked.
List<CargoItem> buildItems(Map<String, int> quantities) {
  final List<CargoItem> items = <CargoItem>[];
  int n = 0;
  for (final CargoType t in kCargoTypes) {
    final int q = quantities[t.id] ?? 0;
    for (int i = 0; i < q; i++) {
      items.add(CargoItem(
        id: '${t.id}_$i',
        typeId: t.id,
        index: n++,
        dims: t.dims,
        weight: t.weight,
      ));
    }
  }
  return items;
}

/// Dominant load mode of a plan, used to pick the loading animation.
CargoMode modeOf(CargoPlan plan) {
  if (plan.placements.isEmpty) return CargoMode.general;
  final Map<String, int> counts = <String, int>{};
  for (final Placement p in plan.placements) {
    counts[p.typeId] = (counts[p.typeId] ?? 0) + 1;
  }
  String? topId;
  int top = -1;
  counts.forEach((String k, int v) {
    if (v > top) {
      top = v;
      topId = k;
    }
  });
  return kCargoById[topId]?.mode ?? CargoMode.general;
}

/// Axle load estimate, used by the weight panel.
double? axleLoads(CargoPlan plan, TruckSpec spec) {
  if (plan.placements.isEmpty) return null;
  final double len = math.max(0.001, spec.trailerLength);
  double moment = 0.0;
  double mass = 0.0;
  for (final Placement p in plan.placements) {
    final double frac = ((p.x - spec.rearX) / len).clamp(0.0, 1.0);
    moment += p.weight * frac;
    mass += p.weight;
  }
  if (mass <= 0) return null;
  final double driveShare = (moment / mass).clamp(0.0, 1.0);
  return driveShare * mass;
}
