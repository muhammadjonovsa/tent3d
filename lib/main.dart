/// TENT 3D â€” Professional TENT truck visualization & cargo loading studio.
///
/// Entry point: full-screen dark studio shell around the WebGL2 renderer.
/// Window size, centring and the dark title bar are handled by the native
/// Windows runner, so no extra window plugin is required.
library;

import 'package:flutter/material.dart';

import 'app/app_shell.dart';
import 'app/theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const T3Root());
}

class T3Root extends StatelessWidget {
  const T3Root({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TENT 3D',
      debugShowCheckedModeBanner: false,
      theme: T3.theme(),
      home: const T3App(),
      builder: (BuildContext context, Widget? child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.noScaling),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
