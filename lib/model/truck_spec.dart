/// TENT 3D :: truck_spec.dart
///
/// Editable trailer geometry. Everything the renderer needs is derived here so
/// the Dart UI and the WebGL scene always agree on one set of numbers.
library;

import 'dart:convert';

class TruckSpec {
  TruckSpec({
    this.trailerLength = 13.60,
    this.trailerWidth = 2.55,
    this.trailerHeight = 2.72,
    this.frontX = 3.42,
    this.floorY = 1.325,
    this.maxWeight = 24000,
    this.cabColor = const [0.74, 0.085, 0.060],
    this.curtainColor = const [0.80, 0.815, 0.835],
    this.curtainInnerColor = const [0.62, 0.635, 0.660],
    this.roofColor = const [0.155, 0.165, 0.185],
    this.exposure = 1.14,
  });

  /// Internal clear width (m) — what a driver actually has to work with.
  double trailerLength;
  double trailerWidth;
  double trailerHeight;
  double frontX;
  double floorY;
  double maxWeight;

  List<double> cabColor;
  List<double> curtainColor;
  List<double> curtainInnerColor;
  List<double> roofColor;
  double exposure;

  static const sideWall = 0.052;

  double get halfWidth => trailerWidth / 2.0;
  double get innerHalfWidth => halfWidth - sideWall;
  double get innerWidth => trailerWidth - sideWall * 2.0;
  double get innerHeight => trailerHeight - 0.075;
  double get roofY => floorY + trailerHeight;
  double get rearX => frontX - trailerLength;
  double get volume => trailerLength * innerWidth * innerHeight;

  double get payload => maxWeight - 7400.0;

  /// Cubic metres available to cargo.
  double get cargoVolume => trailerLength * innerWidth * innerHeight * 0.96;

  Map<String, dynamic> toRenderer() => <String, dynamic>{
        'trailerLength': trailerLength,
        'trailerWidth': trailerWidth,
        'trailerHeight': trailerHeight,
        'frontX': frontX,
        'floorY': floorY,
        'cabColor': cabColor,
        'curtainColor': curtainColor,
        'curtainInnerColor': curtainInnerColor,
        'roofColor': roofColor,
        'exposure': exposure,
      };

  Map<String, dynamic> toJson() => <String, dynamic>{
        'trailerLength': trailerLength,
        'trailerWidth': trailerWidth,
        'trailerHeight': trailerHeight,
        'frontX': frontX,
        'floorY': floorY,
        'maxWeight': maxWeight,
        'cabColor': cabColor,
        'curtainColor': curtainColor,
        'curtainInnerColor': curtainInnerColor,
        'roofColor': roofColor,
        'exposure': exposure,
      };

  factory TruckSpec.fromJson(Map<String, dynamic> j) => TruckSpec(
        trailerLength: (j['trailerLength'] as num?)?.toDouble() ?? 13.60,
        trailerWidth: (j['trailerWidth'] as num?)?.toDouble() ?? 2.55,
        trailerHeight: (j['trailerHeight'] as num?)?.toDouble() ?? 2.72,
        frontX: (j['frontX'] as num?)?.toDouble() ?? 3.42,
        floorY: (j['floorY'] as num?)?.toDouble() ?? 1.325,
        maxWeight: (j['maxWeight'] as num?)?.toDouble() ?? 24000.0,
        cabColor: _list(j['cabColor'], const [0.74, 0.085, 0.060]),
        curtainColor: _list(j['curtainColor'], const [0.80, 0.815, 0.835]),
        curtainInnerColor:
            _list(j['curtainInnerColor'], const [0.62, 0.635, 0.660]),
        roofColor: _list(j['roofColor'], const [0.155, 0.165, 0.185]),
        exposure: (j['exposure'] as num?)?.toDouble() ?? 1.14,
      );

  static List<double> _list(dynamic v, List<double> d) {
    if (v is List && v.length >= 3) {
      return <double>[
        (v[0] as num).toDouble(),
        (v[1] as num).toDouble(),
        (v[2] as num).toDouble(),
      ];
    }
    return d;
  }

  String encode() => jsonEncode(toJson());
}

/// The blue load-space rectangle handed to the packer.
class CargoBox {
  CargoBox(this.x0, this.x1, this.y0, this.y1, this.z0, this.z1);

  factory CargoBox.from(TruckSpec s) => CargoBox(
        s.rearX + 0.08,
        s.frontX - 0.12,
        s.floorY + 0.02,
        s.floorY + s.innerHeight,
        -s.innerHalfWidth,
        s.innerHalfWidth,
      );

  final double x0, x1, y0, y1, z0, z1;

  Map<String, dynamic> toJson() =>
      <String, dynamic>{'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'z0': z0, 'z1': z1};
}
