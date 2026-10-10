// TENT 3D — widget + logic tests that do not need a WebView surface.
//
// The renderer itself is verified headlessly (tool/devtest); these tests lock
// down the pure Dart side: model maths, planner behaviour and shell wiring.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tent3d/app/app_state.dart';
import 'package:tent3d/main.dart';
import 'package:tent3d/model/cargo_plan.dart';
import 'package:tent3d/model/cargo_type.dart';
import 'package:tent3d/model/truck_spec.dart';

void main() {
  group('TruckSpec', () {
    test('derives the geometry the renderer expects', () {
      final TruckSpec s = TruckSpec();
      expect(s.trailerLength, 13.60);
      expect(s.innerWidth, closeTo(2.446, 1e-9));
      expect(s.rearX, closeTo(-10.18, 1e-9));
      expect(s.roofY, closeTo(4.045, 1e-9));
      expect(s.payload, closeTo(16600, 1e-9));
      expect(s.cargoVolume, closeTo(13.60 * 2.446 * 2.645 * 0.96, 1e-6));
    });

    test('round-trips through json', () {
      final TruckSpec a = TruckSpec()
        ..trailerLength = 16.0
        ..cabColor = <double>[0.1, 0.2, 0.3]
        ..exposure = 1.42;
      final TruckSpec b = TruckSpec.fromJson(a.toJson());
      expect(b.trailerLength, 16.0);
      expect(b.cabColor, <double>[0.1, 0.2, 0.3]);
      expect(b.exposure, closeTo(1.42, 1e-9));
    });
  });

  group('cargo catalogue', () {
    test('has 13 unique types with sane numbers', () {
      expect(kCargoTypes.length, 13);
      expect(kCargoById.length, 13);
      for (final CargoType t in kCargoTypes) {
        expect(t.length, greaterThan(0));
        expect(t.height, greaterThan(0));
        expect(t.width, greaterThan(0));
        expect(t.weight, greaterThan(0));
        expect(t.maxQty, greaterThan(0));
      }
    });
  });

  group('planLoad', () {
    test('packs wood inside the trailer bounds', () {
      final TruckSpec s = TruckSpec();
      final CargoPlan plan = planLoad(
        buildItems(<String, int>{'wood': 14}),
        CargoBox.from(s),
      );
      expect(plan.placements.length, greaterThan(0));
      final CargoBox box = CargoBox.from(s);
      for (final Placement p in plan.placements) {
        final double x0 = p.x - p.dims[0] / 2;
        final double y0 = p.y - p.dims[1] / 2;
        final double z0 = p.z - p.dims[2] / 2;
        expect(x0, greaterThanOrEqualTo(box.x0 - 1e-6));
        expect(x0 + p.dims[0], lessThanOrEqualTo(box.x1 + 1e-6));
        expect(y0, greaterThanOrEqualTo(box.y0 - 1e-6));
        expect(y0 + p.dims[1], lessThanOrEqualTo(box.y1 + 1e-6));
        expect(z0, greaterThanOrEqualTo(box.z0 - 1e-6));
        expect(z0 + p.dims[2], lessThanOrEqualTo(box.z1 + 1e-6));
      }
    });

    test('never stacks two boxes into the same volume', () {
      final CargoPlan plan = planLoad(
        buildItems(<String, int>{'boxes': 40}),
        CargoBox.from(TruckSpec()),
      );
      final List<Placement> ps = plan.placements;
      for (int i = 0; i < ps.length; i++) {
        for (int j = i + 1; j < ps.length; j++) {
          final Placement a = ps[i], b = ps[j];
          final bool disjoint =
              a.x + a.dims[0] / 2 <= b.x - b.dims[0] / 2 + 1e-6 ||
              a.x - a.dims[0] / 2 >= b.x + b.dims[0] / 2 - 1e-6 ||
              a.y + a.dims[1] / 2 <= b.y - b.dims[1] / 2 + 1e-6 ||
              a.y - a.dims[1] / 2 >= b.y + b.dims[1] / 2 - 1e-6 ||
              a.z + a.dims[2] / 2 <= b.z - b.dims[2] / 2 + 1e-6 ||
              a.z - a.dims[2] / 2 >= b.z + b.dims[2] / 2 - 1e-6;
          expect(disjoint, isTrue,
              reason: 'overlap between ${a.id} and ${b.id}');
        }
      }
    });

    test('reports rejected units and totals weight', () {
      final CargoPlan plan = planLoad(
        buildItems(<String, int>{'machinery': 4, 'wood': 14}),
        CargoBox.from(TruckSpec()),
      );
      expect(plan.requested, 18);
      expect(plan.boxes + plan.rejected, 18);
      expect(plan.boxes, lessThanOrEqualTo(18));
      final double requestedWeight = 4 * 2250.0 + 14 * 470.0;
      expect(plan.totalWeight, greaterThan(0));
      expect(plan.totalWeight, lessThanOrEqualTo(requestedWeight + 1e-9));
      expect(
        plan.totalWeight,
        closeTo(
          plan.placements.fold<double>(
              0, (double s, Placement p) => s + p.weight),
          1e-9,
        ),
      );
    });

    test('serialises placements for the bridge', () {
      final CargoPlan plan = planLoad(
        buildItems(<String, int>{'boxes': 3}),
        CargoBox.from(TruckSpec()),
      );
      final List<Map<String, dynamic>> json = plan.toJson();
      expect(json.length, plan.placements.length);
      expect(json.first.keys,
          containsAll(<String>['id', 'typeId', 'dims', 'x', 'y', 'z', 'yaw']));
    });

    test('empty plan is stable', () {
      final CargoPlan plan = planLoad(<CargoItem>[], CargoBox.from(TruckSpec()));
      expect(plan.placements, isEmpty);
      expect(plan.totalWeight, 0);
      expect(CargoPlan.empty.placements, isEmpty);
    });
  });

  group('AppState', () {
    test('quantity changes trigger a replan and clear removes them', () {
      final AppState s = AppState();
      s.setQuantity('wood', 4);
      expect(s.quantityOf('wood'), 4);
      expect(s.itemCount, 4);
      expect(s.plan.placements, isNotEmpty);
      expect(s.requestedWeight, closeTo(4 * 470, 1e-9));

      s.clearCargoQuantities();
      expect(s.itemCount, 0);
      expect(s.plan.placements, isEmpty);
    });

    test('clamps to the catalogue maximum', () {
      final AppState s = AppState();
      s.setQuantity('boxes', 9999);
      expect(s.quantityOf('boxes'), kCargoById['boxes']!.maxQty);
    });

    test('derived ratios stay inside 0..1', () {
      final AppState s = AppState();
      s.setQuantity('machinery', 4);
      for (final double v in <double>[
        s.weightRatio,
        s.volumeRatio,
        s.fillHeight,
        s.frontFree,
      ]) {
        expect(v, inInclusiveRange(0.0, 1.0));
      }
    });

    test('payload change re-packs without touching geometry', () {
      final AppState s = AppState();
      // A tighter limit must reject units that the loose one accepted.
      s.setQuantity('machinery', 8);
      final int roomyCount = s.plan.placements.length;
      final double roomyWeight = s.plan.totalWeight;
      expect(roomyCount, greaterThan(0));

      final TruckSpec geometryBefore = TruckSpec.fromJson(s.spec.toJson());
      s.spec.maxWeight = 12000;
      s.onPayloadChanged();

      expect(s.plan.totalWeight, lessThanOrEqualTo(12000));
      // Rejected units must shrink the plan rather than only being reported.
      expect(s.plan.placements.length, lessThan(roomyCount));
      expect(s.plan.totalWeight, lessThan(roomyWeight));
      expect(s.spec.toJson()['trailerLength'],
          geometryBefore.toJson()['trailerLength']);
      // Quantities are the user's intent and must survive a re-pack.
      expect(s.itemCount, 8);
    });

    test('appearance changes do not re-plan the manifest', () {
      final AppState s = AppState();
      s.setQuantity('boxes', 6);
      final String before = s.plan.toJson().toString();

      s.spec.exposure = 1.4;
      s.spec.cabColor = const <double>[0.1, 0.4, 0.9];
      s.onLookChanged();

      expect(s.plan.toJson().toString(), before);
    });
  });

  testWidgets('shell renders header, panels and camera rail',
      (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1600, 950);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const T3Root());
    await tester.pump(const Duration(milliseconds: 400));

    // "TENT 3D" appears in the header and in the boot overlay.
    expect(find.text('TENT 3D'), findsWidgets);
    expect(find.text('TRUCK CONFIGURATION'), findsOneWidget);
    expect(find.text('CARGO TYPES'), findsOneWidget);
    expect(find.text('LOAD SUMMARY'), findsOneWidget);
    expect(find.text('Open Tent'), findsOneWidget);
    expect(find.text('Wooden Boards'), findsOneWidget);
  });

  testWidgets('stepper buttons drive the plan', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1600, 950);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const T3Root());
    await tester.pump(const Duration(milliseconds: 400));

    // tap the wooden boards row -> selects one unit
    await tester.tap(find.text('Wooden Boards'));
    await tester.pump();
    expect(find.text('PACKING PLAN'), findsOneWidget);
  });
}
