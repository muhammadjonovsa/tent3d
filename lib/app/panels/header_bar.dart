/// TENT 3D :: header_bar.dart
library;

import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';

class HeaderBar extends StatelessWidget {
  const HeaderBar({
    super.key,
    required this.state,
    required this.onResetCamera,
    required this.onResetScene,
    required this.onResetAll,
    required this.onPause,
    required this.paused,
  });

  final AppState state;
  final Future<void> Function() onResetCamera;
  final Future<void> Function() onResetScene;
  final Future<void> Function() onResetAll;
  final Future<void> Function() onPause;
  final bool paused;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 54,
      decoration: const BoxDecoration(
        color: T3.bgAlt,
        border: Border(bottom: BorderSide(color: T3.stroke)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: <Widget>[
          const _BrandMark(),
          const SizedBox(width: 14),
          Container(width: 1, height: 22, color: T3.strokeHi),
          const SizedBox(width: 14),
          _StatusChip(state: state),
          const Spacer(),
          if (state.stage == LoadStage.loading) ...<Widget>[
            _MiniProgress(progress: state.loadProgress),
            const SizedBox(width: 14),
          ],
          GhostButton(
            label: paused ? 'Resume' : 'Pause',
            icon: paused
                ? Icons.play_arrow_rounded
                : Icons.pause_rounded,
            dense: true,
            active: paused,
            onPressed: state.stage == LoadStage.loading ? () => onPause() : null,
          ),
          const SizedBox(width: 8),
          GlowButton(
            label: 'Reset Camera',
            icon: Icons.videocam_outlined,
            dense: true,
            color: T3.cyan,
            onPressed: () => onResetCamera(),
          ),
          const SizedBox(width: 8),
          GhostButton(
            label: 'Reset Scene',
            icon: Icons.cleaning_services_rounded,
            dense: true,
            onPressed: () => onResetScene(),
          ),
          const SizedBox(width: 8),
          GhostButton(
            label: 'Reset All',
            icon: Icons.restart_alt_rounded,
            dense: true,
            onPressed: () => onResetAll(),
          ),
          const SizedBox(width: 14),
          _RendererBadge(state: state),
        ],
      ),
    );
  }
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(6),
            gradient: T3.accentGrad,
          ),
          child: const Icon(Icons.local_shipping_rounded,
              size: 15, color: Colors.white),
        ),
        const SizedBox(width: 10),
        const Text(
          'TENT 3D',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            letterSpacing: 3.4,
            color: T3.text,
          ),
        ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final (String label, Color color) = switch (state.stage) {
      LoadStage.loading => ('LOADING ${state.placed}/${state.total}', T3.amber),
      LoadStage.done => ('LOAD COMPLETE', T3.green),
      LoadStage.failed => ('FAILED', T3.red),
      LoadStage.planning => ('PLANNING', T3.cyan),
      LoadStage.idle => (
          state.tentOpen ? 'TENT OPEN' : 'SEALED',
          state.tentOpen ? T3.green : T3.textMute),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Text(label,
              style: TextStyle(
                  fontSize: 9.6,
                  letterSpacing: 1.5,
                  fontWeight: FontWeight.w700,
                  color: color)),
        ],
      ),
    );
  }
}

class _MiniProgress extends StatelessWidget {
  const _MiniProgress({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        SizedBox(
          width: 150,
          child: MeterBar(value: progress, color: T3.amber, height: 5),
        ),
        const SizedBox(width: 9),
        Text('${(progress * 100).toStringAsFixed(0)}%',
            style: T3.monoStyle(11, color: T3.textDim)),
      ],
    );
  }
}

class _RendererBadge extends StatelessWidget {
  const _RendererBadge({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    final bool ok = state.rendererReady;
    return Tooltip(
      message: ok
          ? 'WebGL2 renderer online'
          : (state.fatalError ?? 'Renderer starting…'),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: T3.stroke),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(ok ? Icons.bolt_rounded : Icons.hourglass_top_rounded,
                size: 12, color: ok ? T3.green : T3.amber),
            const SizedBox(width: 6),
            Text('WEBGL2',
                style: TextStyle(
                    fontSize: 9.6,
                    letterSpacing: 1.4,
                    fontWeight: FontWeight.w700,
                    color: ok ? T3.textDim : T3.textMute)),
          ],
        ),
      ),
    );
  }
}
