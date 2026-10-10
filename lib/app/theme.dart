/// TENT 3D :: theme.dart â€” premium dark studio look.
library;

import 'dart:ui';

import 'package:flutter/material.dart';


class T3 {
  const T3._();

  // surfaces
  static const Color bg = Color(0xFF070A0E);
  static const Color bgAlt = Color(0xFF0B0F15);
  static const Color panel = Color(0xF00E131A);
  static const Color panelSolid = Color(0xFF0E131A);
  static const Color panelHi = Color(0xFF161C25);
  static const Color stroke = Color(0xFF1E2731);
  static const Color strokeHi = Color(0xFF2C3947);

  // text
  static const Color text = Color(0xFFE8EEF6);
  static const Color textDim = Color(0xFF94A3B4);
  static const Color textMute = Color(0xFF5D6B7C);

  // accents
  static const Color accent = Color(0xFF3B8BFF);
  static const Color accentDim = Color(0xFF1E4F94);
  static const Color cyan = Color(0xFF4FD1E0);
  static const Color green = Color(0xFF35C08A);
  static const Color amber = Color(0xFFE8A33D);
  static const Color red = Color(0xFFE05252);
  static const Color violet = Color(0xFF8C6FE8);

  static const LinearGradient accentGrad = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: <Color>[Color(0xFF4C9BFF), Color(0xFF2E6FE0)],
  );

  static const LinearGradient brandGrad = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: <Color>[Color(0xFFFFFFFF), Color(0xFFB9C7D8)],
  );

  static const double radius = 12;
  static const double radiusSm = 8;
  static const double gap = 12;

  static const String mono = 'Consolas';
  static const String ui = 'Segoe UI';

  static ThemeData theme() {
    const ColorScheme scheme = ColorScheme.dark(
      primary: accent,
      onPrimary: Colors.white,
      secondary: cyan,
      onSecondary: Color(0xFF04141A),
      surface: panelSolid,
      onSurface: text,
      error: red,
      onError: Colors.white,
      outline: stroke,
    );
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      canvasColor: bg,
      fontFamily: ui,
      dividerColor: stroke,
      splashFactory: InkSparkle.splashFactory,
      textTheme: const TextTheme(
        displaySmall: TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w300,
            letterSpacing: 8,
            color: text),
        titleMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: text),
        bodySmall: TextStyle(fontSize: 11.5, color: textDim, height: 1.45),
        labelSmall: TextStyle(
            fontSize: 10,
            color: textMute,
            letterSpacing: 1.6,
            fontWeight: FontWeight.w600),
      ),
      sliderTheme: const SliderThemeData(
        trackHeight: 3,
        overlayShape: RoundSliderOverlayShape(overlayRadius: 12),
        thumbShape: RoundSliderThumbShape(enabledThumbRadius: 7),
      ),
      tooltipTheme: TooltipThemeData(
        decoration: BoxDecoration(
            color: panelHi, borderRadius: BorderRadius.circular(6)),
        textStyle: const TextStyle(fontSize: 11, color: text),
      ),
    );
  }

  /// Frosted card used for every panel.
  static Widget glass({
    required Widget child,
    EdgeInsetsGeometry padding = const EdgeInsets.all(14),
    double radius = T3.radius,
    Color? tint,
    Color? border,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(radius),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: <Color>[
                tint ?? Colors.white.withValues(alpha: 0.045),
                Colors.white.withValues(alpha: 0.012),
              ],
            ),
            border: Border.all(color: border ?? stroke, width: 1),
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }

  static BoxDecoration cardDeco({double radius = T3.radius, Color? border}) =>
      BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        color: panelSolid,
        border: Border.all(color: border ?? stroke),
      );

  static TextStyle monoStyle(double size, {Color? color, FontWeight? w}) =>
      TextStyle(
          fontFamily: mono, fontSize: size, color: color ?? text, fontWeight: w);
}

/// Small uppercase section header used inside panels.
class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: <Widget>[
          Container(width: 3, height: 11, color: T3.accent),
          const SizedBox(width: 7),
          Expanded(
            child: Text(text.toUpperCase(),
                style: const TextStyle(
                    fontSize: 10,
                    letterSpacing: 2.1,
                    fontWeight: FontWeight.w700,
                    color: T3.textDim)),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Primary gradient button.
class GlowButton extends StatefulWidget {
  const GlowButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onPressed,
    this.active = false,
    this.color,
    this.dense = false,
    this.busy = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool active;
  final Color? color;
  final bool dense;
  final bool busy;

  @override
  State<GlowButton> createState() => _GlowButtonState();
}

class _GlowButtonState extends State<GlowButton> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    final Color c = widget.color ?? T3.accent;
    final bool on = widget.onPressed != null;
    final double h = widget.dense ? 32 : 38;
    return MouseRegion(
      cursor: on ? SystemMouseCursors.click : SystemMouseCursors.basic,
      onEnter: (_) => setState(() => _hover = true),
      onExit: (_) => setState(() => _hover = false),
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 130),
        opacity: on ? 1 : 0.42,
        child: GestureDetector(
          onTap: on ? widget.onPressed : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            height: h,
            padding: EdgeInsets.symmetric(horizontal: widget.dense ? 10 : 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(T3.radiusSm),
              gradient: widget.active || _hover
                  ? LinearGradient(
                      colors: <Color>[
                        c.withValues(alpha: 0.95),
                        c.withValues(alpha: 0.62)
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : const LinearGradient(
                      colors: <Color>[T3.panelHi, T3.bgAlt],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
              border: Border.all(
                  color: widget.active || _hover
                      ? c.withValues(alpha: 0.9)
                      : T3.strokeHi),
              boxShadow: widget.active
                  ? <BoxShadow>[
                      BoxShadow(
                          color: c.withValues(alpha: 0.30),
                          blurRadius: 16,
                          spreadRadius: -2)
                    ]
                  : null,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                if (widget.busy)
                  SizedBox(
                      width: 13,
                      height: 13,
                      child: CircularProgressIndicator(
                          strokeWidth: 1.8,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(c)))
                else
                  Icon(widget.icon,
                      size: widget.dense ? 14 : 16,
                      color: widget.active ? Colors.white : T3.textDim),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    widget.label,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: widget.dense ? 11 : 12,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.4,
                      color: widget.active ? Colors.white : T3.text,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Ghost / secondary button.
class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    this.icon,
    required this.onPressed,
    this.active = false,
    this.color,
    this.dense = false,
    this.tooltip,
  });

  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool active;
  final Color? color;
  final bool dense;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final Color c = color ?? T3.textDim;
    final Widget b = MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: onPressed,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          height: dense ? 28 : 34,
          padding: EdgeInsets.symmetric(horizontal: dense ? 9 : 12),
          decoration: BoxDecoration(
            color: active ? c.withValues(alpha: 0.14) : Colors.transparent,
            borderRadius: BorderRadius.circular(T3.radiusSm),
            border: Border.all(
                color: active ? c.withValues(alpha: 0.65) : T3.stroke),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(icon, size: dense ? 13 : 15, color: active ? c : T3.textMute),
                const SizedBox(width: 7),
              ],
              Text(label,
                  style: TextStyle(
                      fontSize: dense ? 10.5 : 11.5,
                      fontWeight: FontWeight.w600,
                      color: active ? c : T3.textDim)),
            ],
          ),
        ),
      ),
    );
    return tooltip == null ? b : Tooltip(message: tooltip!, child: b);
  }
}

/// Numeric read-out tile.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    this.unit,
    this.color,
    this.icon,
    this.sub,
  });

  final String label;
  final String value;
  final String? unit;
  final Color? color;
  final IconData? icon;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(11, 9, 11, 9),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.022),
        borderRadius: BorderRadius.circular(T3.radiusSm),
        border: Border.all(color: T3.stroke),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            children: <Widget>[
              if (icon != null) ...<Widget>[
                Icon(icon, size: 11, color: color ?? T3.textMute),
                const SizedBox(width: 5),
              ],
              Expanded(
                child: Text(label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 8.6,
                        letterSpacing: 1.3,
                        fontWeight: FontWeight.w700,
                        color: T3.textMute)),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: <Widget>[
              Flexible(
                child: Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: T3.monoStyle(17,
                        color: color ?? T3.text, w: FontWeight.w600)),
              ),
              if (unit != null) ...<Widget>[
                const SizedBox(width: 3),
                Text(unit!,
                    style: const TextStyle(
                        fontSize: 10, color: T3.textMute, fontWeight: FontWeight.w600)),
              ],
            ],
          ),
          if (sub != null)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(sub!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 9.5, color: T3.textMute)),
            ),
        ],
      ),
    );
  }
}

/// Horizontal capacity / weight bar.
class MeterBar extends StatelessWidget {
  const MeterBar({
    super.key,
    required this.value,
    this.color = T3.accent,
    this.height = 7,
    this.marker,
    this.markerLabel,
  });

  final double value;
  final Color color;
  final double height;
  final double? marker;
  final String? markerLabel;

  @override
  Widget build(BuildContext context) {
    final double v = value.clamp(0.0, 1.0);
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints c) {
        return SizedBox(
          height: height + (markerLabel != null ? 13 : 0),
          child: Stack(
            clipBehavior: Clip.none,
            children: <Widget>[
              Container(
                height: height,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(height),
                  border: Border.all(color: T3.stroke),
                ),
              ),
              FractionallySizedBox(
                widthFactor: v == 0 ? 0.0001 : v,
                child: Container(
                  height: height,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(height),
                    gradient: LinearGradient(
                      colors: <Color>[
                        color.withValues(alpha: 0.55),
                        color,
                      ],
                    ),
                    boxShadow: <BoxShadow>[
                      BoxShadow(
                          color: color.withValues(alpha: 0.35), blurRadius: 8)
                    ],
                  ),
                ),
              ),
              if (marker != null)
                Positioned(
                  left: (c.maxWidth * marker!.clamp(0.0, 1.0)) - 1,
                  top: -3,
                  child: Container(
                    width: 2,
                    height: height + 6,
                    color: T3.amber.withValues(alpha: 0.9),
                  ),
                ),
              if (markerLabel != null)
                Positioned(
                  left: (c.maxWidth * (marker ?? 0).clamp(0.0, 1.0)) - 24,
                  bottom: -3,
                  child: Text(markerLabel!,
                      style: const TextStyle(
                          fontSize: 8.5,
                          color: T3.amber,
                          fontFamily: T3.mono,
                          fontWeight: FontWeight.w700)),
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Toast overlay shown at the bottom of the viewport.
class HintBar extends StatelessWidget {
  const HintBar({super.key, required this.text, this.icon});

  final String text;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 220),
        opacity: text.isEmpty ? 0 : 1,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            color: T3.panel.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: T3.strokeHi),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(icon ?? Icons.info_outline,
                  size: 13, color: T3.textDim),
              const SizedBox(width: 8),
              Text(text,
                  style: const TextStyle(
                      fontSize: 11, color: T3.textDim, letterSpacing: 0.2)),
            ],
          ),
        ),
      ),
    );
  }
}
