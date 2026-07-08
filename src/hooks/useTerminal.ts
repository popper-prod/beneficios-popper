import { useEffect, useRef } from 'react';

// Mantiene la pantalla de la terminal siempre encendida mientras la app está visible.
// Se re-solicita al volver de segundo plano (el lock se libera al minimizar/apagar).
// `enabled` permite activarlo solo en modo terminal (PC), no en el teléfono propio.
export function useWakeLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          sentinel = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* No soportado o denegado: silencioso, no es crítico. */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      try { sentinel?.release(); } catch { /* noop */ }
    };
  }, [enabled]);
}

// Ejecuta `onIdle` tras `ms` sin actividad (toque/click/tecla). Se reinicia con
// cualquier interacción. Útil para volver a la pantalla inicial entre clientes.
export function useIdleTimeout(onIdle: () => void, ms: number, enabled: boolean) {
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const reset = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => cb.current(), ms);
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [ms, enabled]);
}
