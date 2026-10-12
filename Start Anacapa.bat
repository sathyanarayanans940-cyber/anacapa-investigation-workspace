@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0"
if errorlevel 1 (
 echo Could not open the Anacapa folder. Unzip it into a writable location and try again.
 pause
 exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js 22.13 or newer from nodejs.org, then open this file again.
 pause
 popd
 exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<13)){console.error('Anacapa needs Node.js 22.13 or newer. Update Node.js from nodejs.org.');process.exit(1)}"
if errorlevel 1 (
 pause
 popd
 exit /b 1
)
if not exist dist\index.html (
 call npm ci
 if errorlevel 1 goto failed
 call npm run build
 if errorlevel 1 goto failed
)
node runtime\server.mjs --open
set "anacapa_exit=%errorlevel%"
pause
popd
exit /b %anacapa_exit%
:failed
echo Anacapa could not be prepared. Check the error above and try again.
pause
popd
exit /b 1
