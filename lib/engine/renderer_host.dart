/// TENT 3D :: renderer_host.dart
///
/// Hosts the WebGL2 scene inside a WebView2 surface and owns the JSON bridge.
///
///   Dart to JS : evaluateJavascript("window.TENT3D.receive(json)")
///   JS to Dart : window.flutter_inappwebview.callHandler('TENT3D', json)
library;

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import '../app/app_state.dart';
import '../model/cargo_plan.dart';
import '../model/truck_spec.dart';

typedef BridgeListener = void Function(Map<String, dynamic> message);
typedef BatchListener = void Function(List<Map<String, dynamic>> messages);

class RendererBridge {
  InAppWebViewController? _controller;

  bool get connected => _controller != null;

  void attach(InAppWebViewController c) => _controller = c;

  void detach() => _controller = null;

  /// Runs a snippet inside the renderer and returns its JSON value.
  Future<dynamic> eval(String source) async {
    final InAppWebViewController? c = _controller;
    if (c == null) return null;
    try {
      return await c.evaluateJavascript(source: source);
    } catch (e) {
      return 'eval failed: $e';
    }
  }

  Future<void> _send(Map<String, dynamic> msg) async {
    final InAppWebViewController? c = _controller;
    if (c == null) return;
    try {
      final String json = jsonEncode(msg);
      await c.evaluateJavascript(
        source: 'window.TENT3D && window.TENT3D.receive($json);',
      );
    } catch (e) {
      debugPrint('bridge send failed: $e');
    }
  }

  /// Full (re)initialisation — only used for the first boot and for a factory
  /// reset. Geometry edits must use [setGeometry] so the camera and the tent
  /// state survive.
  Future<void> init(TruckSpec spec) =>
      _send(<String, dynamic>{'t': 'init', 'spec': spec.toRenderer()});

  Future<void> setGeometry(TruckSpec spec) =>
      _send(<String, dynamic>{'t': 'setGeometry', 'spec': spec.toRenderer()});

  Future<void> setCabColor(TruckSpec spec) =>
      _send(<String, dynamic>{
        't': 'setCabColor',
        'cabColor': spec.cabColor,
        'curtainColor': spec.curtainColor,
        'curtainInnerColor': spec.curtainInnerColor,
        'roofColor': spec.roofColor,
      });

  Future<void> setExposure(double exposure) =>
      _send(<String, dynamic>{'t': 'setExposure', 'exposure': exposure});

  Future<void> resetCamera() =>
      _send(const <String, dynamic>{'t': 'resetCamera'});

  Future<void> resetScene() =>
      _send(const <String, dynamic>{'t': 'resetScene'});

  Future<void> openTent() => _send(<String, dynamic>{'t': 'openTent'});

  Future<void> closeTent() => _send(<String, dynamic>{'t': 'closeTent'});

  Future<void> tentSide(String side, bool open) => _send(<String, dynamic>{
        't': 'tentSide',
        'side': side,
        'open': open,
      });

  Future<void> rearDoors(bool open) =>
      _send(<String, dynamic>{'t': 'rearDoors', 'open': open});

  Future<void> setTent({
    required bool left,
    required bool right,
    bool? rear,
  }) {
    final Map<String, dynamic> msg = <String, dynamic>{
      't': 'tent',
      'left': left ? 1.0 : 0.0,
      'right': right ? 1.0 : 0.0,
    };
    if (rear != null) msg['rear'] = rear ? 1.0 : 0.0;
    return _send(msg);
  }

  Future<void> camera(String preset, {bool instant = false}) =>
      _send(<String, dynamic>{
        't': 'camera',
        'preset': preset,
        'instant': instant,
      });

  Future<void> look(String dir) =>
      _send(<String, dynamic>{'t': 'look', 'dir': dir});

  Future<void> enterTrailer() =>
      _send(const <String, dynamic>{'t': 'enterTrailer'});

  Future<void> exitTrailer() =>
      _send(const <String, dynamic>{'t': 'exitTrailer'});

  Future<void> dimensions(bool on) =>
      _send(<String, dynamic>{'t': 'dimensions', 'visible': on});

  Future<void> lighting({double? exposure}) {
    final Map<String, dynamic> msg = <String, dynamic>{'t': 'lighting'};
    if (exposure != null) msg['exposure'] = exposure;
    return _send(msg);
  }

  Future<void> loadCargo(CargoPlan plan) => _send(<String, dynamic>{
        't': 'cargo',
        'plan': <String, dynamic>{'placements': plan.toJson()},
      });

  Future<void> clearCargo() =>
      _send(const <String, dynamic>{'t': 'cargoClear'});

  Future<void> pauseLoad(bool paused) =>
      _send(<String, dynamic>{'t': 'loadPause', 'paused': paused});

  Future<void> reset() => _send(const <String, dynamic>{'t': 'reset'});
}

/// Inlines every renderer script into the shell so the page never needs a
/// secondary request — the whole scene ships as one HTML document.
Future<String> buildRendererHtml() async {
  const List<String> scripts = <String>[
    'assets/renderer/js/core.js',
    'assets/renderer/js/gfx.js',
    'assets/renderer/js/tex.js',
    'assets/renderer/js/truck.js',
    'assets/renderer/js/env.js',
    'assets/renderer/js/cargo.js',
    'assets/renderer/js/app.js',
  ];
  String html = await rootBundle.loadString('assets/renderer/index.html');

  for (final String path in scripts) {
    final String code = await rootBundle.loadString(path);
    final String token = '<script src="js/${path.split('/').last}"></script>';
    if (!html.contains(token)) {
      throw StateError('renderer script tag missing: $token');
    }
    html = html.replaceFirst(token, '<script>\n$code\n</script>');
  }

  if (html.contains('<script src=')) {
    throw StateError('renderer shell still references external scripts');
  }
  return html;
}

class RendererViewport extends StatefulWidget {
  const RendererViewport({
    super.key,
    required this.state,
    required this.bridge,
    required this.onMessage,
    required this.onDocumentLoaded,
  });

  final AppState state;
  final RendererBridge bridge;
  final BridgeListener onMessage;

  /// Fired once the inlined document finished loading — the only moment the
  /// renderer is guaranteed to accept the `init` command.
  final VoidCallback onDocumentLoaded;

  @override
  State<RendererViewport> createState() => _RendererViewportState();
}

class _RendererViewportState extends State<RendererViewport> {
  String _html = '';
  String? _buildError;
  bool _preparing = true;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    try {
      final String html = await buildRendererHtml();
      if (!mounted) return;
      setState(() {
        _html = html;
        _preparing = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _buildError = '$e';
        _preparing = false;
      });
    }
  }

  /// The renderer flushes a JSON array of events per handler call.
  void _handlePayload(Object? raw) {
    Object? decoded = raw;
    if (raw is String) {
      try {
        decoded = jsonDecode(raw);
      } catch (e) {
        debugPrint('bridge payload decode failed: $e');
        return;
      }
    }
    if (decoded is List) {
      for (final Object? item in decoded) {
        if (item is Map) {
          widget.onMessage(Map<String, dynamic>.from(item));
        }
      }
    } else if (decoded is Map) {
      widget.onMessage(Map<String, dynamic>.from(decoded));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_preparing) {
      return const _BootOverlay(progress: 0.15, text: 'PREPARING RENDERER');
    }
    if (_buildError != null) {
      return _ErrorOverlay(message: 'Renderer bundle failed:\n$_buildError');
    }

    final bool ready = widget.state.rendererReady;
    return Stack(
      children: <Widget>[
        Positioned.fill(child: ColoredBox(color: const Color(0xFF0B0F15), child: _webView())),
        Positioned.fill(
          child: _BootOverlay(
            progress: ready ? 0 : 0.7,
            text: ready ? '' : 'BUILDING TRUCK GEOMETRY',
          ),
        ),
        if (widget.state.fatalError != null)
          Positioned.fill(
            child: _ErrorOverlay(message: widget.state.fatalError!),
          ),
      ],
    );
  }

  /// The platform view can be unavailable (unit tests, hosts without the
  /// WebView2 plugin); degrade to a static plate instead of throwing.
  Widget _webView() {
    try {
      return InAppWebView(
        initialData: InAppWebViewInitialData(
          data: _html,
          baseUrl: WebUri('about:blank'),
          encoding: 'utf8',
          mimeType: 'text/html',
        ),
        initialSettings: InAppWebViewSettings(
          javaScriptEnabled: true,
          transparentBackground: true,
          disableDefaultErrorPage: true,
          supportZoom: false,
          builtInZoomControls: false,
          displayZoomControls: false,
          allowFileAccess: true,
          allowFileAccessFromFileURLs: true,
          allowUniversalAccessFromFileURLs: true,
          useShouldOverrideUrlLoading: false,
          disableVerticalScroll: true,
          disableHorizontalScroll: true,
          userAgent: 'TENT3D/1.0 (Windows; WebGL2)',
        ),
        onWebViewCreated: (InAppWebViewController c) {
          widget.bridge.attach(c);
          c.addJavaScriptHandler(
            handlerName: 'TENT3D',
            callback: (List<dynamic> args) {
              try {
                _handlePayload(args.isEmpty ? null : args.first);
              } catch (e) {
                debugPrint('bridge handler failed: $e');
              }
              return null;
            },
          );
        },
        onLoadStop: (InAppWebViewController c, WebUri? url) async {
          try {
            await c.evaluateJavascript(
              source:
                  'var s=document.documentElement.style;'
                  's.overflow="hidden";s.background="#070A0E";',
            );
          } catch (e) {
            debugPrint('post-load style failed: $e');
          }
          widget.onDocumentLoaded();
        },
      );
    } catch (e) {
      debugPrint('webview unavailable: $e');
      return const ColoredBox(
        color: Color(0xFF0B0F15),
        child: Center(
          child: Text(
            'WebView2 surface unavailable',
            style: TextStyle(
                fontFamily: 'Consolas', fontSize: 12, color: Color(0xFF5D6B7C)),
          ),
        ),
      );
    }
  }
}

class _BootOverlay extends StatelessWidget {
  const _BootOverlay({required this.progress, required this.text});

  final double progress;
  final String text;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 320),
        opacity: progress <= 0.001 ? 0 : 1,
        child: ColoredBox(
          color: const Color(0xF0070A0E),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Text(
                  'TENT 3D',
                  style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w300,
                      letterSpacing: 11,
                      color: Color(0xFFE8EEF6)),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: 220,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: progress >= 1 ? null : progress,
                      minHeight: 3,
                      backgroundColor: const Color(0xFF161C25),
                      valueColor:
                          const AlwaysStoppedAnimation<Color>(Color(0xFF3B8BFF)),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  text,
                  style: const TextStyle(
                      fontSize: 10,
                      letterSpacing: 3,
                      color: Color(0xFF5D6B7C)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorOverlay extends StatelessWidget {
  const _ErrorOverlay({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xE6070A0E),
      child: Center(
        child: Container(
          constraints: const BoxConstraints(maxWidth: 640),
          margin: const EdgeInsets.all(28),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF150E12),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF3E1E27)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Row(
                children: <Widget>[
                  Icon(Icons.error_outline, size: 16, color: Color(0xFFE05252)),
                  SizedBox(width: 8),
                  Text(
                    'RENDERER UNAVAILABLE',
                    style: TextStyle(
                        fontSize: 11,
                        letterSpacing: 2.4,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFE05252)),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SelectableText(
                message,
                style: const TextStyle(
                    fontFamily: 'Consolas',
                    fontSize: 11.5,
                    height: 1.55,
                    color: Color(0xFF94A3B4)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
