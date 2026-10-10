#include <dwmapi.h>
#include <flutter/dart_project.h>
#include <flutter/flutter_view_controller.h>
#include <windows.h>

#include "flutter_window.h"
#include "utils.h"

namespace {

// Centres a window on the primary display.
void CenterOnPrimary(Win32Window::Point* origin, Win32Window::Size size) {
  MONITORINFO mi = {};
  mi.cbSize = sizeof(mi);
  if (::GetMonitorInfoW(::MonitorFromPoint({0, 0}, MONITOR_DEFAULTTOPRIMARY),
                        &mi)) {
    const int w = size.width, h = size.height;
    const int x = mi.rcWork.left + (mi.rcWork.right - mi.rcWork.left - w) / 2;
    const int y = mi.rcWork.top + (mi.rcWork.bottom - mi.rcWork.top - h) / 2;
    *origin = Win32Window::Point(x, y);
  }
}

}  // namespace

int APIENTRY wWinMain(_In_ HINSTANCE instance, _In_opt_ HINSTANCE prev,
                      _In_ wchar_t *command_line, _In_ int show_command) {
  // Attach to console when present (e.g., 'flutter run') or create a
  // new console when running with a debugger.
  if (!::AttachConsole(ATTACH_PARENT_PROCESS) && ::IsDebuggerPresent()) {
    CreateAndAttachConsole();
  }

  // Initialize COM, so that it is available for use in the library and/or
  // plugins.
  ::CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);

  flutter::DartProject project(L"data");

  std::vector<std::string> command_line_arguments =
      GetCommandLineArguments();

  project.set_dart_entrypoint_arguments(std::move(command_line_arguments));

  FlutterWindow window(project);
  Win32Window::Size size(1480, 920);
  Win32Window::Point origin(10, 10);
  CenterOnPrimary(&origin, size);
  if (!window.Create(L"TENT 3D", origin, size)) {
    return EXIT_FAILURE;
  }
  window.SetQuitOnClose(true);

  // Dark title bar so the chrome matches the studio UI.
  HWND hwnd = window.GetHandle();
  if (hwnd != nullptr) {
    BOOL dark = TRUE;
    ::DwmSetWindowAttribute(hwnd, 20, &dark, sizeof(dark));
  }

  // Respect the work area (taskbar / DPI scaling) as the minimum footprint.
  RECT wr;
  if (::GetWindowRect(hwnd, &wr)) {
    const int w = wr.right - wr.left, h = wr.bottom - wr.top;
    HMONITOR mon = ::MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    MONITORINFO mi = {};
    mi.cbSize = sizeof(mi);
    if (::GetMonitorInfoW(mon, &mi)) {
      const int avail_w = mi.rcWork.right - mi.rcWork.left;
      const int avail_h = mi.rcWork.bottom - mi.rcWork.top;
      if (w > avail_w || h > avail_h) {
        const int nw = w > avail_w ? avail_w : w;
        const int nh = h > avail_h ? avail_h : h;
        ::SetWindowPos(hwnd, nullptr, mi.rcWork.left, mi.rcWork.top, nw, nh,
                       SWP_NOZORDER | SWP_NOACTIVATE);
      }
    }
  }

  ::MSG msg;
  while (::GetMessage(&msg, nullptr, 0, 0)) {
    ::TranslateMessage(&msg);
    ::DispatchMessage(&msg);
  }

  ::CoUninitialize();
  return EXIT_SUCCESS;
}
