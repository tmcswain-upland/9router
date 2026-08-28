@echo off
powershell -Command "Get-NetTCPConnection -LocalPort 20128 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }; Write-Host '9Router stopped.'"
