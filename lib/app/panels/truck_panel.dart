/// TENT 3D :: truck_panel.dart â€” live trailer geometry editor.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';
import '../../model/truck_spec.dart';

class TruckPanel extends StatefulWidget {
  const TruckPanel({
    super.key,
    required this.state,
    required this.onSpecChanged,
    required this.onLookChanged,
    required this.onPayloadChanged,
  });

  final AppState state;

  /// Trailer dimensions changed — needs a geometry rebuild (debounced by the
  /// host so a slider drag pushes a single command).
  final Future<void> Function() onSpecChanged;

  /// Cab colour / exposure changed — appearance only, must never rebuild
  /// geometry or reset the camera.
  final Future<void> Function() onLookChanged;

  /// Max payload changed — re-packs the manifest but sends nothing to the
  /// renderer, because payload is a planning limit and not geometry.
  final Future<void> Function() onPayloadChanged;

  @override
  State<TruckPanel> createState() => _TruckPanelState();
}

class _TruckPanelState extends State<TruckPanel> {
  bool _open = true;

  /// Geometry sliders: the host debounces this, so a drag pushes once.
  void _pushGeometry() {
    setState(() {});
    unawaited(widget.onSpecChanged());
  }

  /// Appearance-only changes: no geometry rebuild.
  void _pushLook() {
    setState(() {});
    unawaited(widget.onLookChanged());
  }

  @override
  Widget build(BuildContext context) {
    final TruckSpec s = widget.state.spec;
    return T3.glass(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          GestureDetector(
            onTap: () => setState(() => _open = !_open),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 10, 8),
              child: SectionLabel(
                'Truck Configuration',
                trailing: Icon(
                  _open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                  size: 16,
                  color: T3.textMute,
                ),
              ),
            ),
          ),
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 180),
            crossFadeState:
                _open ? CrossFadeState.showFirst : CrossFadeState.showSecond,
            firstChild: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  _Slider(
                    label: 'Trailer Length',
                    unit: 'm',
                    value: s.trailerLength,
                    min: 7.6,
                    max: 16.0,
                    step: 0.10,
                    onChanged: (double v) {
                      setState(() => s.trailerLength = v);
                      _pushGeometry();
                    },
                  ),
                  _Slider(
                    label: 'Trailer Width',
                    unit: 'm',
                    value: s.trailerWidth,
                    min: 2.30,
                    max: 2.75,
                    step: 0.01,
                    onChanged: (double v) {
                      setState(() => s.trailerWidth = v);
                      _pushGeometry();
                    },
                  ),
                  _Slider(
                    label: 'Trailer Height',
                    unit: 'm',
                    value: s.trailerHeight,
                    min: 2.55,
                    max: 3.05,
                    step: 0.01,
                    onChanged: (double v) {
                      setState(() => s.trailerHeight = v);
                      _pushGeometry();
                    },
                  ),
                  _Slider(
                    label: 'Max Payload',
                    unit: 't',
                    display: s.maxWeight / 1000.0,
                    value: s.maxWeight,
                    min: 12000,
                    max: 40000,
                    step: 500,
                    decimals: 1,
                    onChanged: (double v) {
                      // Payload is a planning limit only; the 3D scene is not
                      // affected, so this must not rebuild anything, but the
                      // manifest does have to be re-packed against the new cap.
                      setState(() => s.maxWeight = v);
                      unawaited(widget.onPayloadChanged());
                    },
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: StatTile(
                          label: 'Load Space',
                          value: s.innerWidth.toStringAsFixed(2),
                          unit: 'm w',
                          icon: Icons.swap_horiz_rounded,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: StatTile(
                          label: 'Clear H',
                          value: s.innerHeight.toStringAsFixed(2),
                          unit: 'm',
                          icon: Icons.height_rounded,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: StatTile(
                          label: 'Volume',
                          value: s.cargoVolume.toStringAsFixed(1),
                          unit: 'mÂ³',
                          icon: Icons.view_in_ar_rounded,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: <Widget>[
                      Text('CAB COLOUR',
                          style: Theme.of(context).textTheme.labelSmall),
                      const Spacer(),
                      _Swatch(
                        color: Color.fromARGB(
                          255,
                          (s.cabColor[0] * 255).round(),
                          (s.cabColor[1] * 255).round(),
                          (s.cabColor[2] * 255).round(),
                        ),
                        onPick: (Color c) {
                          setState(() => s.cabColor = <double>[
                                c.r,
                                c.g,
                                c.b,
                              ]);
                          _pushLook();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _ExposureRow(state: widget.state, onPush: _pushLook),
                ],
              ),
            ),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Row(
                children: <Widget>[
                  const Icon(Icons.straighten_rounded,
                      size: 13, color: T3.textMute),
                  const SizedBox(width: 8),
                  Text(
                    '${s.trailerLength.toStringAsFixed(2)} Ã— ${s.trailerWidth.toStringAsFixed(2)} Ã— ${s.trailerHeight.toStringAsFixed(2)} m',
                    style: T3.monoStyle(11, color: T3.textDim),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Slider extends StatelessWidget {
  const _Slider({
    required this.label,
    required this.unit,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.onChanged,
    this.display,
    this.decimals = 2,
  });

  final String label;
  final String unit;
  final double value;
  final double min;
  final double max;
  final double step;
  final double? display;
  final int decimals;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 11, color: T3.textDim, letterSpacing: 0.2)),
            ),
            Text(
              '${(display ?? value).toStringAsFixed(decimals)} $unit',
              style: T3.monoStyle(11.5, color: T3.text),
            ),
          ],
        ),
        SizedBox(
          height: 24,
          child: SliderTheme(
            data: T3.theme().sliderTheme.copyWith(
              activeTrackColor: T3.accent,
              inactiveTrackColor: T3.stroke,
              thumbColor: Colors.white,
              overlayColor: T3.accent.withValues(alpha: 0.14),
            ),
            child: Slider(
              value: value.clamp(min, max),
              min: min,
              max: max,
              divisions: ((max - min) / step).round().clamp(1, 4000),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.color, required this.onPick});

  final Color color;
  final ValueChanged<Color> onPick;

  static const List<Color> _palette = <Color>[
    Color(0xFFBD1610),
    Color(0xFF1F4E9C),
    Color(0xFF0F7A4A),
    Color(0xFF2B2F36),
    Color(0xFFF2F4F7),
    Color(0xFFE0A21B),
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        for (final Color c in _palette)
          Padding(
            padding: const EdgeInsets.only(left: 5),
            child: MouseRegion(
              cursor: SystemMouseCursors.click,
              child: GestureDetector(
                onTap: () => onPick(c),
                child: Container(
                  width: 17,
                  height: 17,
                  decoration: BoxDecoration(
                    color: c,
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: color.toARGB32() == c.toARGB32()
                          ? Colors.white
                          : T3.strokeHi,
                      width: color.toARGB32() == c.toARGB32() ? 2 : 1,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _ExposureRow extends StatelessWidget {
  const _ExposureRow({required this.state, required this.onPush});

  final AppState state;
  final VoidCallback onPush;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        const Icon(Icons.brightness_6_rounded, size: 13, color: T3.textMute),
        Expanded(
          child: SliderTheme(
            data: T3.theme().sliderTheme.copyWith(
              activeTrackColor: T3.cyan,
              inactiveTrackColor: T3.stroke,
              thumbColor: Colors.white,
            ),
            child: Slider(
              value: state.spec.exposure.clamp(0.6, 1.8),
              min: 0.6,
              max: 1.8,
              divisions: 48,
              onChanged: (double v) {
                state.spec.exposure = v;
                onPush();
              },
            ),
          ),
        ),
        Text(state.spec.exposure.toStringAsFixed(2),
            style: T3.monoStyle(11, color: T3.textDim)),
      ],
    );
  }
}
