/// TENT 3D :: load_panel.dart â€” capacity, weight and the live load plan.
library;

import 'package:flutter/material.dart';

import '../../model/cargo_plan.dart';
import '../../model/cargo_type.dart';
import '../../model/truck_spec.dart';
import '../app_state.dart';
import '../theme.dart';

class LoadPanel extends StatelessWidget {
  const LoadPanel({
    super.key,
    required this.state,
    required this.onLoad,
    required this.onPause,
    required this.onClear,
    required this.paused,
  });

  final AppState state;
  final Future<void> Function() onLoad;
  final Future<void> Function() onPause;
  final Future<void> Function() onClear;
  final bool paused;

  @override
  Widget build(BuildContext context) {
    final TruckSpec spec = state.spec;
    final CargoPlan plan = state.plan;
    final double? drive = axleLoads(plan, spec);
    final bool overWeight = plan.totalWeight > spec.payload;

    return Container(
      decoration: const BoxDecoration(
        color: T3.bgAlt,
        border: Border(left: BorderSide(color: T3.stroke)),
      ),
      child: Column(
        children: <Widget>[
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
              children: <Widget>[
                T3.glass(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const SectionLabel('Load Summary'),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: StatTile(
                              label: 'Placed',
                              value: '${plan.boxes}',
                              unit: '/ ${plan.requested}',
                              icon: Icons.inventory_2_outlined,
                              color: T3.accent,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: StatTile(
                              label: 'Weight',
                              value: _mass(plan.totalWeight),
                              unit: 't',
                              icon: Icons.scale_outlined,
                              color: overWeight ? T3.red : T3.green,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: StatTile(
                              label: 'Volume',
                              value: plan.totalVolume.toStringAsFixed(1),
                              unit: 'mÂ³',
                              icon: Icons.view_in_ar_rounded,
                              color: T3.cyan,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: StatTile(
                              label: 'Rejected',
                              value: '${plan.rejected}',
                              unit: 'units',
                              icon: Icons.block_rounded,
                              color: plan.rejected > 0
                                  ? T3.amber
                                  : T3.textDim,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _Meter(
                        label: 'PAYLOAD',
                        value: state.weightRatio,
                        caption:
                            '${_mass(plan.totalWeight)} t of ${_mass(spec.payload)} t',
                        color: overWeight ? T3.red : T3.accent,
                      ),
                      const SizedBox(height: 10),
                      _Meter(
                        label: 'VOLUME',
                        value: state.volumeRatio,
                        caption:
                            '${plan.totalVolume.toStringAsFixed(1)} mÂ³ of ${spec.cargoVolume.toStringAsFixed(1)} mÂ³',
                        color: T3.cyan,
                      ),
                      const SizedBox(height: 10),
                      _Meter(
                        label: 'FILL HEIGHT',
                        value: state.fillHeight,
                        caption:
                            '${(state.fillHeight * spec.innerHeight).toStringAsFixed(2)} m',
                        color: T3.violet,
                      ),
                      const SizedBox(height: 10),
                      _Meter(
                        label: 'LENGTH USED',
                        value: state.frontFree,
                        caption:
                            '${(state.frontFree * spec.trailerLength).toStringAsFixed(2)} m of ${spec.trailerLength.toStringAsFixed(2)} m',
                        color: T3.green,
                      ),
                      if (drive != null) ...<Widget>[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.022),
                            borderRadius:
                                BorderRadius.circular(T3.radiusSm),
                            border: Border.all(color: T3.stroke),
                          ),
                          child: Row(
                            children: <Widget>[
                              const Icon(Icons.balance_rounded,
                                  size: 13, color: T3.textMute),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Drive-axle share',
                                  style:
                                      const TextStyle(
                                          fontSize: 10.5,
                                          color: T3.textDim),
                                ),
                              ),
                              Text(
                                '${_mass(drive)} t (${(drive / (plan.totalWeight == 0 ? 1 : plan.totalWeight) * 100).toStringAsFixed(0)}%)',
                                style: T3.monoStyle(11, color: T3.text),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                _PlanCard(state: state),
                const SizedBox(height: 12),
                if (state.itemCount > 0)
                  T3.glass(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        SectionLabel(
                          'Requested',
                          trailing: Text(
                            '${_mass(state.requestedWeight)} t',
                            style: T3.monoStyle(10, color: T3.textDim),
                          ),
                        ),
                        ...kCargoTypes
                            .where((CargoType t) => state.quantityOf(t.id) > 0)
                            .map((CargoType t) => Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 5),
                                  child: Row(
                                    children: <Widget>[
                                      Container(
                                        width: 5,
                                        height: 5,
                                        decoration: const BoxDecoration(
                                            color: T3.cyan,
                                            shape: BoxShape.circle),
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          t.name,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                              fontSize: 11,
                                              color: T3.textDim),
                                        ),
                                      ),
                                      Text(
                                        'Ã—${state.quantityOf(t.id)}',
                                        style: T3.monoStyle(10.5,
                                            color: T3.text),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        '${_mass(state.quantityOf(t.id) * t.weight)} t',
                                        style: T3.monoStyle(10.5,
                                            color: T3.textMute),
                                      ),
                                    ],
                                  ),
                                )),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 4, 14, 14),
            child: Column(
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: GlowButton(
                        label: state.stage == LoadStage.loading
                            ? (paused ? 'Resume' : 'Pause')
                            : 'Start Loading',
                        icon: state.stage == LoadStage.loading
                            ? (paused
                                ? Icons.play_arrow_rounded
                                : Icons.pause_rounded)
                            : Icons.play_arrow_rounded,
                        active: state.stage == LoadStage.loading && !paused,
                        color: T3.green,
                        busy: false,
                        onPressed: state.stage == LoadStage.loading
                            ? () => onPause()
                            : () => onLoad(),
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
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _mass(double kg) =>
      kg >= 1000 ? (kg / 1000).toStringAsFixed(2) : kg.toStringAsFixed(0);
}

class _Meter extends StatelessWidget {
  const _Meter({
    required this.label,
    required this.value,
    required this.caption,
    required this.color,
  });

  final String label;
  final double value;
  final String caption;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(label,
                style: const TextStyle(
                    fontSize: 9.4,
                    letterSpacing: 1.5,
                    fontWeight: FontWeight.w700,
                    color: T3.textMute)),
            const Spacer(),
            Text('${(value * 100).toStringAsFixed(0)}%',
                style: T3.monoStyle(10.5, color: color)),
          ],
        ),
        const SizedBox(height: 5),
        MeterBar(value: value, color: color),
        const SizedBox(height: 4),
        Text(caption,
            style: const TextStyle(fontSize: 9.8, color: T3.textMute)),
      ],
    );
  }
}

/// Per-type packing result: how many of the requested units actually fit.
class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final Map<String, int> placed = <String, int>{};
    for (final Placement p in state.plan.placements) {
      placed[p.typeId] = (placed[p.typeId] ?? 0) + 1;
    }
    final List<CargoType> used = kCargoTypes
        .where((CargoType t) => placed.containsKey(t.id))
        .toList();

    return T3.glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SectionLabel(
            'Packing Plan',
            trailing: Text('mode ${modeOf(state.plan).id}',
                style: T3.monoStyle(9.6, color: T3.textMute)),
          ),
          if (used.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 10),
              child: Text(
                'No cargo selected yet â€” pick a type on the left.',
                style: TextStyle(fontSize: 11, color: T3.textMute),
              ),
            )
          else
            ...used.map((CargoType t) {
              final int fit = placed[t.id] ?? 0;
              final int want = state.quantityOf(t.id);
              final double ratio = want == 0 ? 1 : fit / want;
              final Color c = ratio >= 1
                  ? T3.green
                  : ratio > 0
                      ? T3.amber
                      : T3.red;
              return Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(t.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 11, color: T3.textDim)),
                        ),
                        Text('$fit / $want',
                            style: T3.monoStyle(10.5, color: c)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    MeterBar(value: ratio, color: c, height: 4),
                  ],
                ),
              );
            }),
          if (state.plan.rejected > 0) ...<Widget>[
            const SizedBox(height: 4),
            Row(
              children: <Widget>[
                const Icon(Icons.warning_amber_rounded,
                    size: 12, color: T3.amber),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    '${state.plan.rejected} unit(s) do not fit â€” reduce the '
                    'quantity or enlarge the trailer.',
                    style: const TextStyle(
                        fontSize: 10.2, height: 1.4, color: T3.amber),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
