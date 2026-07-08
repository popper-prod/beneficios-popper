@echo off
REM ============================================================
REM   TERMINAL DE BENEFICIOS - GRUPO POPPER
REM   Abre la terminal en pantalla completa (modo kiosco).
REM
REM   COMO USARLO:
REM   1) Reemplaza el codigo de abajo (QR_COMERCIO) por el codigo
REM      QR del comercio de esta terminal (lo saca RRHH del panel).
REM   2) Guarda una copia de este .bat por cada comercio.
REM   3) Doble clic para abrir. Para salir del kiosco: Alt+F4.
REM ============================================================

set "QR_COMERCIO=PEGAR-CODIGO-QR-DEL-COMERCIO"
REM ?terminal=1 activa modo terminal (kiosco + auto-reset + pantalla encendida).
REM No lo saques: distingue esta PC del QR que escanea la gente en su telefono.
set "URL=https://beneficios.recluta.com.ar/?terminal=1#/qr/%QR_COMERCIO%"

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROMEX86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

if exist "%EDGE%" (
  start "" "%EDGE%" --kiosk "%URL%" --edge-kiosk-type=fullscreen --no-first-run --disable-features=Translate --overscroll-history-navigation=0
) else if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk "%URL%" --no-first-run --disable-features=Translate --overscroll-history-navigation=0
) else if exist "%CHROMEX86%" (
  start "" "%CHROMEX86%" --kiosk "%URL%" --no-first-run --disable-features=Translate --overscroll-history-navigation=0
) else (
  echo No se encontro Microsoft Edge ni Google Chrome.
  echo Instala uno de los dos y volve a intentar.
  pause
)
