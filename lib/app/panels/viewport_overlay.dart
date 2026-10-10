/// TENT 3D :: viewport_overlay.dart
///
/// Non-interactive layer drawn on top of the WebGL canvas: dimension labels,
/// progress bar, mode hint and the keyboard legend.
library;

import 'package:flutter/material.dart';

import '../../model/truck_spec.dart';
import '../app_state.dart';
import '../theme.dart';

class ViewportOverlay extends StatelessWidget {
  const ViewportOverlay({
    super.key,
    required this.state,
    required this.anchors,
  });

  final AppState state;
  final List<Map<String, dynamic>> anchors;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints c) {
        return Stack(
          clipBehavior: Clip.none,
          children: <Widget>[
            if (state.dimensions)
              ...anchors.map((Map<String, dynamic> a) {
                final String id = (a['id'] ?? '') as String;
                final double x = ((a['x'] as num?)?.toDouble() ?? -1);
                final double y = ((a['y'] as num?)?.toDouble() ?? -1);
                if (x < 0 || y < 0 || x > 1 || y > 1) {
                  return const SizedBox.shrink();
                }
                final String text = _label(id, state.spec);
                if (text.isEmpty) return const SizedBox.shrink();
                return Positioned(
                  left: x * c.maxWidth - 46,
                  top: y * c.maxHeight - 13,
                  width: 92,
                  child: IgnorePointer(child: _DimChip(text: text)),
                );
              }),
            if (state.stage == LoadStage.loading || state.loadProgress > 0)
              Positioned(
                left: 0,
                right: 0,
                bottom: 62,
                child: Center(child: _ProgressStrip(state: state)),
              ),
            Positioned(
              left: 14,
              top: 14,
              child: _ModeChip(state: state),
            ),
            Positioned(
              right: 14,
              top: 14,
              child: _LegendChip(interior: state.interiorMode),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 18,
              child: Center(child: HintBar(text: state.hint)),
            ),
          ],
        );
      },
    );
  }

  static String _label(String id, TruckSpec s) => switch (id) {
        'length' => '${s.trailerLength.toStringAsFixed(2)} m',
        'width' => '${s.innerWidth.toStringAsFixed(2)} m',
        'height' => '${s.innerHeight.toStringAsFixed(2)} m',
        'volume' => '${s.cargoVolume.toStringAsFixed(1)} m³',
        'total' => '${s.trailerLength.toStringAsFixed(2)} m O.A.',
        _ => '',
      };
}

class _DimChip extends StatelessWidget {
  const _DimChip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: T3.violet.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: T3.violet.withValues(alpha: 0.55)),
      ),
      child: Text(
        text,
        textAlign: TextAlign.center,
        style: const TextStyle(
            fontFamily: T3.mono,
            fontSize: 10.5,
            fontWeight: FontWeight.w700,
            color: Color(0xFFCFC3FF)),
      ),
    );
  }
}

class _ProgressStrip extends StatelessWidget {
  const _ProgressStrip({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      padding: const EdgeInsets.fromLTRB(12, 9, 12, 11),
      decoration: BoxDecoration(
        color: T3.panel.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: T3.strokeHi),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text('LOADING CARGO',
                  style: const TextStyle(
                      fontSize: 9.4,
                      letterSpacing: 2,
                      fontWeight: FontWeight.w700,
                      color: T3.textDim)),
              const Spacer(),
              Text('${state.placed} / ${state.total}',
                  style: T3.monoStyle(10.5, color: T3.text)),
            ],
          ),
          const SizedBox(height: 8),
          MeterBar(value: state.loadProgress, color: T3.green, height: 5),
        ],
      ),
    );
  }
}

class _ModeChip extends StatelessWidget {
  const _ModeChip({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final bool loaded = state.plan.placements.isNotEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: T3.panel.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: T3.stroke),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(
            state.tentOpen
                ? Icons.door_front_door_outlined
                : Icons.lock_outline_rounded,
            size: 12,
            color: state.tentOpen ? T3.amber : T3.textMute,
          ),
          const SizedBox(width: 8),
          Text(
            state.interiorMode
                ? 'INTERIOR · WASD'
                : '${state.camera.label.toUpperCase()}'
                    '${loaded ? ' · ${state.plan.boxes} UNITS' : ''}',
            style: const TextStyle(
                fontSize: 9.6,
                letterSpacing: 1.6,
                fontWeight: FontWeight.w700,
                color: T3.textDim),
          ),
        ],
      ),
    );
  }
}

class _LegendChip extends StatelessWidget {
  const _LegendChip({required this.interior});

  final bool interior;

  @override
  Widget build(BuildContext context) {
    final String text = interior
        ? 'W A S D move · mouse look · Shift faster · Q/E up-down'
        : 'drag rotate · wheel zoom · right-drag pan';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: T3.panel.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: T3.stroke),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 9.6, color: T3.textMute),
      ),
    );
  }
}
