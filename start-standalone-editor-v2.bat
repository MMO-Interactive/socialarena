@echo off
setlocal

cd /d "%~dp0"

if not "%~1"=="" (
  set "SOCIALARENA_STUDIO_ID=%~1"
)

node "%~dp0standalone-editor-v2\launch.js"

endlocal
