/// TENT 3D :: camera_bar.dart â€” preset rail plus the tent / dimension toggles.
library;

import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';

class CameraBar extends StatelessWidget {
  const CameraBar({
    super.key,
    required this.state,
    required this.onCamera,
    required this.onTent,
    required this.onTentSide,
    required this.onRearDoors,
    required this.onDimensions,
    required this.onExitInterior,
  });

  final AppState state;
  final Future<void> Function(CameraView) onCamera;
  final Future<void> Function() onTent;
  final Future<void> Function(String side) onTentSide;
  final Future<void> Function() onRearDoors;
  final Future<void> Function() onDimensions;
  final Future<void> Function() onExitInterior;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 58,
      decoration: const BoxDecoration(
        color: T3.bgAlt,
        border: Border(top: BorderSide(color: T3.stroke)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: <Widget>[
          GhostButton(
            label: 'Left',
            icon: Icons.west_rounded,
            dense: true,
            active: state.tentLeftOpen,
            color: T3.amber,
            onPressed: () => onTentSide('left'),
          ),
          const SizedBox(width: 6),
          GhostButton(
            label: 'Right',
            icon: Icons.east_rounded,
            dense: true,
            active: state.tentRightOpen,
            color: T3.amber,
            onPressed: () => onTentSide('right'),
          ),
          const SizedBox(width: 6),
          GhostButton(
            label: 'Rear Doors',
            icon: Icons.meeting_room_outlined,
            dense: true,
            active: state.rearDoorsOpen,
            color: T3.amber,
            onPressed: () => onRearDoors(),
          ),
          const SizedBox(width: 6),
          GlowButton(
            label: state.tentOpen ? 'Close Tent' : 'Open Tent',
            icon: state.tentOpen
                ? Icons.close_fullscreen_rounded
                : Icons.open_in_full_rounded,
            active: state.tentOpen,
            color: state.tentOpen ? T3.amber : T3.accent,
            onPressed: () => onTent(),
          ),
          const SizedBox(width: 10),
          GlowButton(
            label: 'Enter Trailer',
            icon: Icons.door_front_door_outlined,
            active: state.interiorMode,
            color: T3.cyan,
            onPressed: () => onCamera(CameraView.interior),
          ),
          const SizedBox(width: 10),
          GlowButton(
            label: 'Dimensions',
            icon: Icons.straighten_rounded,
            active: state.dimensions,
            color: T3.violet,
            onPressed: () => onDimensions(),
          ),
          const SizedBox(width: 18),
          Container(width: 1, height: 26, color: T3.stroke),
          const SizedBox(width: 18),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: <Widget>[
                  for (final CameraView v in _order) ...<Widget>[
                    GhostButton(
                      label: v.label,
                      icon: v.icon,
                      dense: true,
                      active: state.camera == v,
                      color: T3.accent,
                      onPressed: () => onCamera(v),
                    ),
                    const SizedBox(width: 6),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          const _HelpChip(),
          if (state.interiorMode) ...<Widget>[
            const SizedBox(width: 10),
            GhostButton(
              label: 'Exit',
              icon: Icons.logout_rounded,
              dense: true,
              active: true,
              color: T3.cyan,
              onPressed: () => onExitInterior(),
            ),
          ],
        ],
      ),
    );
  }

  static const List<CameraView> _order = <CameraView>[
    CameraView.overview,
    CameraView.corner,
    CameraView.front,
    CameraView.rear,
    CameraView.left,
    CameraView.right,
    CameraView.top,
    CameraView.interior,
    CameraView.free,
  ];
}

class _HelpChip extends StatefulWidget {
  const _HelpChip();

  @override
  State<_HelpChip> createState() => _HelpChipState();
}

class _HelpChipState extends State<_HelpChip> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: _open ? '' : 'Controls',
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: () => setState(() => _open = !_open),
          child: Container(
            height: 28,
            padding: const EdgeInsets.symmetric(horizontal: 9),
            decoration: BoxDecoration(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(T3.radiusSm),
              border: Border.all(color: T3.stroke),
            ),
            child: const Row(
              children: <Widget>[
                Icon(Icons.help_outline_rounded, size: 13, color: T3.textMute),
                SizedBox(width: 6),
                Text('Controls',
                    style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: T3.textMute)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
