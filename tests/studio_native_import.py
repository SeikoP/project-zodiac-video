"""Fill only the target Studio process's native file dialog; no backend bypass."""
import sys
import time
from pathlib import Path

import win32con
import win32gui
import win32process

archive = Path(sys.argv[1]).resolve(strict=True)
target_pid = int(sys.argv[2])
deadline = time.monotonic() + 25
while time.monotonic() < deadline:
    windows = []
    def collect(hwnd, _):
        if (win32gui.IsWindowVisible(hwnd) and win32gui.GetClassName(hwnd) == "#32770"
                and win32process.GetWindowThreadProcessId(hwnd)[1] == target_pid):
            windows.append(hwnd)
    win32gui.EnumWindows(collect, None)
    if windows:
        break
    time.sleep(.2)
else:
    raise RuntimeError("Target Studio file dialog did not open")
edits = []
win32gui.EnumChildWindows(windows[-1], lambda h, _: edits.append(h) if win32gui.GetClassName(h) == "Edit" else None, None)
if not edits:
    raise RuntimeError("Target file dialog has no filename field")
win32gui.SendMessage(edits[0], win32con.WM_SETTEXT, 0, str(archive))
win32gui.PostMessage(windows[-1], win32con.WM_COMMAND, 1, 0)
