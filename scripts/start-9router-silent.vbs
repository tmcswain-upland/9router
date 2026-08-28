Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & "C:\repos\ryo_claude\ryo-9router\9router\scripts\start-9router.bat" & """", 0, False
