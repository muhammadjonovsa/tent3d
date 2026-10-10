/// TENT 3D :: log.dart
///
/// Tiny append-only file log under %LOCALAPPDATA%\TENT3D\logs. The renderer
/// runs inside WebView2, so this is the only way to see what the scene is
/// doing without attaching a debugger.
library;

import 'dart:io';

import 'package:flutter/foundation.dart';

class T3Log {
  T3Log._();

  static bool enabled = true;
  static File? _file;
  static bool _failed = false;

  static File? _open() {
    if (!enabled || _failed) return _file;
    if (_file != null) return _file;
    try {
      final String base =
          Platform.environment['LOCALAPPDATA'] ?? Directory.systemTemp.path;
      final Directory dir = Directory('$base\\TENT3D\\logs');
      if (!dir.existsSync()) dir.createSync(recursive: true);
      _file = File(
          '${dir.path}\\tent3d-${DateTime.now().toIso8601String().replaceAll(':', '-')}.log');
    } catch (e) {
      _failed = true;
    }
    return _file;
  }

  static void write(String message) {
    debugPrint('[T3] $message');
    final File? f = _open();
    if (f == null) return;
    try {
      final String stamp = DateTime.now().toIso8601String().substring(11, 19);
      f.writeAsStringSync('$stamp  $message\n', mode: FileMode.append);
    } catch (_) {
      _failed = true;
    }
  }
}
