' Jalankan bridge + hotkey controller secara hidden saat login
Set sh = CreateObject("WScript.Shell")
sh.Run "node ""C:\Users\PC WAHIDKU\Music\Ai Teacher Assistant\obs-bridge.js""", 0, False
WScript.Sleep 1500
sh.Run "pythonw ""C:\Users\PC WAHIDKU\Music\obs-studio-master\obs-hotkeys.py""", 0, False
