/// TENT 3D :: cargo_panel.dart â€” catalogue with live quantity steppers.
library;

import 'package:flutter/material.dart';

import '../../model/cargo_type.dart';
import '../app_state.dart';
import '../theme.dart';

class CargoPanel extends StatefulWidget {
  const CargoPanel({super.key, required this.state});

  final AppState state;

  @override
  State<CargoPanel> createState() => _CargoPanelState();
}

class _CargoPanelState extends State<CargoPanel> {
  CargoMode? _filter;

  @override
  Widget build(BuildContext context) {
    final List<CargoType> items = _filter == null
        ? kCargoTypes
        : kCargoTypes.where((CargoType t) => t.mode == _filter).toList();

    return T3.glass(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SectionLabel(
            'Cargo Types',
            trailing: Text('${widget.state.itemCount} units',
                style: T3.monoStyle(10, color: T3.textMute)),
          ),
          SizedBox(
            height: 26,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: <Widget>[
                for (final CargoMode m in CargoMode.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 5),
                    child: GhostButton(
                      label: m.id,
                      dense: true,
                      active: _filter == m,
                      color: T3.cyan,
                      onPressed: () => setState(
                          () => _filter = _filter == m ? null : m),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          ...items.map((CargoType t) => _CargoRow(
                type: t,
                state: widget.state,
                onChanged: () => setState(() {}),
              )),
        ],
      ),
    );
  }
}

class _CargoRow extends StatelessWidget {
  const _CargoRow({
    required this.type,
    required this.state,
    required this.onChanged,
  });

  final CargoType type;
  final AppState state;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final int qty = state.quantityOf(type.id);
    final bool active = state.activeCargoId == type.id;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: () {
            state.setQuantity(type.id, qty == 0 ? 1 : qty);
            onChanged();
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            padding: const EdgeInsets.fromLTRB(10, 8, 8, 8),
            decoration: BoxDecoration(
              color: active
                  ? T3.accent.withValues(alpha: 0.09)
                  : Colors.white.withValues(alpha: 0.018),
              borderRadius: BorderRadius.circular(T3.radiusSm),
              border: Border.all(
                  color: active
                      ? T3.accent.withValues(alpha: 0.42)
                      : T3.stroke),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Flexible(
                            child: Text(
                              type.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: qty > 0 ? T3.text : T3.textDim,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          if (qty > 0)
                            Text(type.nameTr,
                                style: const TextStyle(
                                    fontSize: 10, color: T3.textMute)),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${type.dimsLabel}  Â·  ${type.weight.toStringAsFixed(0)} kg',
                        style: T3.monoStyle(9.6, color: T3.textMute),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _StepButton(
                  icon: Icons.remove_rounded,
                  onTap: qty > 0
                      ? () {
                          state.adjustQuantity(type.id, -1);
                          onChanged();
                        }
                      : null,
                ),
                SizedBox(
                  width: 30,
                  child: Text(
                    '$qty',
                    textAlign: TextAlign.center,
                    style: T3.monoStyle(13,
                        color: qty > 0 ? T3.text : T3.textMute,
                        w: FontWeight.w700),
                  ),
                ),
                _StepButton(
                  icon: Icons.add_rounded,
                  onTap: qty < type.maxQty
                      ? () {
                          state.adjustQuantity(type.id, 1);
                          onChanged();
                        }
                      : null,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final bool on = onTap != null;
    return MouseRegion(
      cursor: on ? SystemMouseCursors.click : SystemMouseCursors.basic,
      child: GestureDetector(
        onTap: onTap,
        child: Opacity(
          opacity: on ? 1 : 0.28,
          child: Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.045),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: T3.strokeHi),
            ),
            child: Icon(icon, size: 13, color: T3.text),
          ),
        ),
      ),
    );
  }
}
