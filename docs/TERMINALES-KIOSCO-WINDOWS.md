# Terminales de cajero — Guía de puesta a punto (Windows)

Cómo dejar cada PC táctil de cajero como una **terminal dedicada** de beneficios:
pantalla completa, anclada a su comercio, sin que se puedan salir de la app.

La app ya trae de fábrica: pantalla siempre encendida, auto-reset entre clientes,
bloqueo de menú contextual/zoom, y reconexión automática. Esta guía cubre el
**equipo** (la PC Windows).

> **Dos modos, una misma app.** El sistema se usa de dos formas:
> 1. **Terminal en PC** (esta guía): abre con `?terminal=1` en la URL → activa
>    kiosco + pantalla encendida + auto-reset entre clientes.
> 2. **QR en el teléfono de la persona**: escanea el QR simple (sin `?terminal=1`)
>    y le pasa el teléfono al boletero. Ahí **no** hay auto-reset, así no se le
>    borra el código. El `.bat` ya incluye `?terminal=1`; no lo saques.

---

## Opción A — Modo kiosco con el `.bat` (recomendado)

La más simple y robusta para una PC dedicada.

1. Pedile a RRHH el **código QR** del comercio de esta terminal (está en el panel
   admin, en cada comercio). Es el texto que va después de `/qr/` en la URL.
2. Copiá el archivo [`kiosco-terminal.bat`](kiosco-terminal.bat) al Escritorio de la PC.
   Hacé **una copia por comercio** (ej. `kiosco-cerro-castor.bat`).
3. Abrilo con clic derecho → *Editar* y reemplazá:
   ```
   set "QR_COMERCIO=PEGAR-CODIGO-QR-DEL-COMERCIO"
   ```
   por el código real, por ejemplo:
   ```
   set "QR_COMERCIO=cerro-castor-boleteria"
   ```
4. Guardá y hacé **doble clic**. Abre Edge/Chrome en pantalla completa, ya en la
   boletería correcta.
5. Para salir del kiosco (mantenimiento): **Alt + F4**.

### Que arranque solo al prender la PC
1. Tecla **Windows + R** → escribí `shell:startup` → Enter.
2. Copiá ahí un **acceso directo** al `.bat` del comercio.
   (clic derecho en el `.bat` → *Enviar a* → *Escritorio*, y movés el acceso directo
   a la carpeta de Inicio).
3. Listo: cada vez que se prenda la PC, abre sola la terminal en su comercio.

---

## Opción B — Instalar como app (PWA)

Si preferís un ícono de app en vez de kiosco total:

1. Abrí `https://beneficios.recluta.com.ar/?terminal=1#/qr/CODIGO-DEL-COMERCIO` en Edge o Chrome.
2. En la barra de direcciones, ícono **Instalar** (o menú ⋯ → *Aplicaciones → Instalar
   este sitio como aplicación*).
3. Queda un ícono "Grupo Popper · Beneficios" en el Escritorio; abre en su propia
   ventana, sin barra de navegador.
4. Para pantalla completa dentro de la app: **F11**.

> La PWA usa el logo y el ícono de la marca automáticamente (una vez cargado el logo).

---

## Recomendaciones de la PC (para que se vea de primer nivel)

- **Cuenta de Windows dedicada** para la terminal, sin permisos de administrador,
  sin otras apps ni accesos directos en el escritorio.
- **Suspensión y apagado de pantalla en “Nunca”**: Configuración → Sistema → Batería/
  Energía. (La app además fuerza *wake lock*, pero conviene reforzarlo en Windows).
- **Notificaciones en “No molestar”** para que no salten toasts arriba de la terminal.
- **Ocultar la barra de tareas** (clic derecho en la barra → Configuración → *Ocultar
  automáticamente*).
- **Conexión estable**: idealmente por cable; si es Wi-Fi, buena señal en el punto de venta.
- **Zoom del navegador al 100%** (Ctrl+0) la primera vez.

---

## Qué hace la terminal sola (no requiere configuración)

- **Pantalla siempre encendida** mientras la terminal está abierta.
- **Vuelve al inicio sola**: tras un canje (≈25 s) y tras inactividad en una ficha
  abierta (≈90 s), para no dejar los datos de una persona en pantalla.
- **Reconecta sola**: si el servidor estaba dormido, reintenta hasta conectar y
  muestra el estado, sin que el cajero tenga que hacer nada.
- **Anti-toqueteo**: sin menú de clic derecho, sin zoom por gesto, sin selección de
  texto (salvo los campos de DNI/PIN).

---

## Salir / cerrar la terminal

- Kiosco (Opción A): **Alt + F4**.
- App/PWA (Opción B): cerrar la ventana normalmente.
