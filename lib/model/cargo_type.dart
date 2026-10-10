/// TENT 3D :: cargo_type.dart
///
/// Mirrors assets/renderer/js/cargo.js :: CARGO_TYPES. Ids, dimensions, masses
/// and quantities must stay identical on both sides of the bridge.
library;

enum CargoMode { wood, boxes, pallets, bags, pipes, general }

extension CargoModeName on CargoMode {
  String get id => switch (this) {
        CargoMode.wood => 'WOOD',
        CargoMode.boxes => 'BOXES',
        CargoMode.pallets => 'PALLETS',
        CargoMode.bags => 'BAGS',
        CargoMode.pipes => 'PIPES',
        CargoMode.general => 'GENERAL',
      };

  String get hint => switch (this) {
        CargoMode.wood => 'Stacked from the front wall, boards on edge.',
        CargoMode.boxes => 'Layered cartons, heaviest at the bottom.',
        CargoMode.pallets => 'Euro pallets placed by the forklift.',
        CargoMode.bags => 'Soft bags stacked in double rows.',
        CargoMode.pipes => 'Steel pipes slid in along the trailer length.',
        CargoMode.general => 'Mixed industrial load, banded and strapped.',
      };
}

class CargoType {
  const CargoType({
    required this.id,
    required this.name,
    required this.nameTr,
    required this.short,
    required this.mode,
    required this.length,
    required this.height,
    required this.width,
    required this.weight,
    required this.maxQty,
    required this.desc,
  });

  final String id;
  final String name;
  final String nameTr;
  final String short;
  final CargoMode mode;

  /// metres — length along the trailer, then height, then width.
  final double length;
  final double height;
  final double width;

  /// kilograms per unit.
  final double weight;
  final int maxQty;
  final String desc;

  List<double> get dims => <double>[length, height, width];
  double get volume => length * height * width;
  String get dimsLabel =>
      '${length.toStringAsFixed(2)} x ${height.toStringAsFixed(2)} x ${width.toStringAsFixed(2)} m';
}

const List<CargoType> kCargoTypes = <CargoType>[
  CargoType(
    id: 'wood',
    name: 'Wooden Boards',
    nameTr: 'Tahta',
    short: 'WOOD',
    mode: CargoMode.wood,
    length: 2.40,
    height: 0.78,
    width: 1.16,
    weight: 470,
    maxQty: 14,
    desc: 'Kilim tahta / sazlam kereste demeti',
  ),
  CargoType(
    id: 'lumber',
    name: 'Lumber Pack',
    nameTr: 'Kereste',
    short: 'LUMBER',
    mode: CargoMode.wood,
    length: 6.00,
    height: 0.95,
    width: 1.10,
    weight: 1650,
    maxQty: 4,
    desc: '6 metre uzunluğunda kütük demeti',
  ),
  CargoType(
    id: 'boxes',
    name: 'Carton Boxes',
    nameTr: 'Koli',
    short: 'BOXES',
    mode: CargoMode.boxes,
    length: 0.62,
    height: 0.42,
    width: 0.42,
    weight: 14,
    maxQty: 120,
    desc: 'Mühürlü karton koli',
  ),
  CargoType(
    id: 'pallets',
    name: 'Euro Pallets',
    nameTr: 'Palet',
    short: 'PALLETS',
    mode: CargoMode.pallets,
    length: 1.20,
    height: 1.45,
    width: 0.80,
    weight: 520,
    maxQty: 18,
    desc: 'Üzeri yükü ile euro palet',
  ),
  CargoType(
    id: 'bags',
    name: 'Cargo Bags',
    nameTr: 'Çuval',
    short: 'BAGS',
    mode: CargoMode.bags,
    length: 0.72,
    height: 0.26,
    width: 0.46,
    weight: 28,
    maxQty: 130,
    desc: 'Dokuma polipropilen çuval',
  ),
  CargoType(
    id: 'grainBags',
    name: 'Grain Bags',
    nameTr: 'Tahıl Çuvalları',
    short: 'GRAIN',
    mode: CargoMode.bags,
    length: 0.56,
    height: 0.20,
    width: 0.36,
    weight: 52,
    maxQty: 150,
    desc: 'Buğday / mısır çuvalları',
  ),
  CargoType(
    id: 'construction',
    name: 'Concrete Blocks',
    nameTr: 'İnşaat Malzemesi',
    short: 'BUILD',
    mode: CargoMode.general,
    length: 1.20,
    height: 0.52,
    width: 0.58,
    weight: 1180,
    maxQty: 12,
    desc: 'Beton blok / harç torbası',
  ),
  CargoType(
    id: 'pipes',
    name: 'Steel Pipes',
    nameTr: 'Boru',
    short: 'PIPES',
    mode: CargoMode.pipes,
    length: 6.00,
    height: 0.52,
    width: 0.52,
    weight: 430,
    maxQty: 6,
    desc: '6 metre çelik boru demeti',
  ),
  CargoType(
    id: 'metal',
    name: 'Metal Sheets',
    nameTr: 'Metal Levha',
    short: 'METAL',
    mode: CargoMode.general,
    length: 2.05,
    height: 0.42,
    width: 1.02,
    weight: 380,
    maxQty: 26,
    desc: 'Sac levha istifi',
  ),
  CargoType(
    id: 'insulation',
    name: 'Insulation Rolls',
    nameTr: 'Yalıtım',
    short: 'INSUL',
    mode: CargoMode.general,
    length: 1.22,
    height: 0.62,
    width: 0.62,
    weight: 24,
    maxQty: 40,
    desc: 'Cam yünü rulo yalıtım',
  ),
  CargoType(
    id: 'machinery',
    name: 'Machinery Crate',
    nameTr: 'Makine Kasası',
    short: 'MACHINE',
    mode: CargoMode.general,
    length: 1.85,
    height: 1.45,
    width: 1.15,
    weight: 2250,
    maxQty: 4,
    desc: 'Ağır makine nakliye kasası',
  ),
  CargoType(
    id: 'agri',
    name: 'Produce Crates',
    nameTr: 'Sebze / Meyve',
    short: 'AGRI',
    mode: CargoMode.general,
    length: 1.20,
    height: 0.38,
    width: 0.60,
    weight: 265,
    maxQty: 30,
    desc: 'Mahsul kasa istifi',
  ),
  CargoType(
    id: 'general',
    name: 'General Cargo',
    nameTr: 'Genel Yük',
    short: 'GENERAL',
    mode: CargoMode.general,
    length: 1.05,
    height: 0.95,
    width: 0.82,
    weight: 330,
    maxQty: 26,
    desc: 'Özel ölçülü genel yük kasası',
  ),
];

final Map<String, CargoType> kCargoById = <String, CargoType>{
  for (final CargoType t in kCargoTypes) t.id: t,
};
