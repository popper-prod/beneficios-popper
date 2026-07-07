import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ============================================
// TVPage — Modo vitrina para plasmas (sin interacción)
//   #/tv/{QR_CODE} → vitrina de un comercio: QR gigante + carrusel de beneficios
//   #/tv           → cartelera general (oficinas): todos los beneficios vigentes
// Sin datos personales. Auto-refresh de datos + rotación automática.
// ============================================

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

const REFRESH_MS = 5 * 60 * 1000; // refetch de datos cada 5 min
const ROTATE_MS = 9000;           // rotación de página del carrusel

interface TVBeneficio {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: string | null;
  descuento: number | null;
  descuento_max: number | null;
  valor_fijo: number | null;
  categoria: string | null;
  origen: string | null;
  aplica_a: string | null;
  restricciones: string | null;
  comercios?: string[];
}

interface TVComercio {
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  logo: string | null;
}

const CARD_GRADIENT = 'linear-gradient(135deg, #1a2744 0%, #0f1829 55%, #0a1020 100%)';

function useReloj() {
  const [ahora, setAhora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

// Valor a destacar en la tarjeta: GRATIS / Hasta X% / X% / $X
function ValorBeneficio({ b, size = 1 }: { b: TVBeneficio; size?: number }) {
  if (b.tipo === 'gratuito') {
    return (
      <span style={{
        fontSize: `${26 * size}px`, fontWeight: 800, color: '#16a34a',
        background: '#dcfce7', padding: `${6 * size}px ${18 * size}px`, borderRadius: 999,
        letterSpacing: '0.02em', whiteSpace: 'nowrap',
      }}>
        GRATIS
      </span>
    );
  }
  const max = b.descuento_max ?? b.descuento;
  if (max != null && max > 0) {
    const esHasta = b.descuento_max != null && b.descuento != null && b.descuento_max > b.descuento;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap' }}>
        {esHasta && (
          <span style={{ fontSize: `${16 * size}px`, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Hasta
          </span>
        )}
        <span style={{ fontSize: `${46 * size}px`, fontWeight: 800, color: 'var(--brand)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {Math.round(max)}<span style={{ fontSize: `${26 * size}px`, fontWeight: 700 }}>%</span>
        </span>
      </span>
    );
  }
  if (b.valor_fijo != null && b.valor_fijo > 0) {
    return (
      <span style={{ fontSize: `${34 * size}px`, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        ${b.valor_fijo.toLocaleString('es-AR')}
      </span>
    );
  }
  return (
    <span style={{ fontSize: `${18 * size}px`, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
      Beneficio
    </span>
  );
}

function BadgeAplicaA({ aplica_a }: { aplica_a: string | null }) {
  if (aplica_a === 'talento') {
    return (
      <span style={{
        fontSize: 13, fontWeight: 700, color: '#d4a017', textTransform: 'uppercase', letterSpacing: '0.08em',
        padding: '3px 12px', borderRadius: 999, background: 'rgba(212,160,23,0.12)', border: '1px solid rgba(212,160,23,0.4)',
      }}>★ Talento Popper</span>
    );
  }
  if (aplica_a === 'familiar') {
    return (
      <span style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.08em',
        padding: '3px 12px', borderRadius: 999, background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)',
      }}>Familiares</span>
    );
  }
  return null;
}

function TarjetaBeneficio({ b, mostrarComercios }: { b: TVBeneficio; mostrarComercios: boolean }) {
  return (
    <div
      style={{
        padding: '26px 30px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        minHeight: 118,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
          <p style={{ fontSize: 27, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>
            {b.nombre}
          </p>
          <BadgeAplicaA aplica_a={b.aplica_a} />
        </div>
        {b.descripcion && (
          <p className="line-clamp-2" style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1.45 }}>
            {b.descripcion}
          </p>
        )}
        {mostrarComercios && b.comercios && b.comercios.length > 0 && (
          <p className="line-clamp-2" style={{ fontSize: 16, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.4 }}>
            📍 {b.comercios.join(' · ')}
          </p>
        )}
        {b.restricciones && (
          <p className="line-clamp-2" style={{ fontSize: 14.5, color: 'var(--text-3)', marginTop: 6, fontStyle: 'italic' }}>
            ⚠ {b.restricciones}
          </p>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>
        <ValorBeneficio b={b} />
      </div>
    </div>
  );
}

// Carrusel: pagina los beneficios y rota automáticamente
function usePaginado<T>(items: T[], porPagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    setPagina(0);
    if (totalPaginas <= 1) return;
    const t = setInterval(() => setPagina(p => (p + 1) % totalPaginas), ROTATE_MS);
    return () => clearInterval(t);
  }, [totalPaginas, items.length]);

  const visibles = items.slice(pagina * porPagina, pagina * porPagina + porPagina);
  return { visibles, pagina, totalPaginas };
}

function Dots({ pagina, total }: { pagina: number; total: number }) {
  if (total <= 1) return null;
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 22 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i === pagina ? 26 : 9, height: 9, borderRadius: 999,
            background: i === pagina ? 'var(--brand)' : 'var(--border-default)',
            transition: 'all 300ms var(--ease-out)',
          }}
        />
      ))}
    </div>
  );
}

export default function TVPage({ qrCode }: { qrCode: string | null }) {
  const [comercio, setComercio] = useState<TVComercio | null>(null);
  const [beneficios, setBeneficios] = useState<TVBeneficio[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const ahora = useReloj();

  const esComercio = !!qrCode;

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      try {
        const url = esComercio ? `${API_URL}/public/tv/${qrCode}` : `${API_URL}/public/tv`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelado) return;
        setComercio(data.comercio || null);
        setBeneficios(data.beneficios || []);
        setUltimaActualizacion(new Date());
        setEstado('ok');
      } catch {
        // Si ya teníamos datos, los conservamos (un refetch fallido no vacía el plasma)
        if (!cancelado) setEstado(prev => (prev === 'ok' ? 'ok' : 'error'));
      }
    };
    cargar();
    const t = setInterval(cargar, REFRESH_MS);
    return () => { cancelado = true; clearInterval(t); };
  }, [qrCode, esComercio]);

  const porPagina = esComercio ? 4 : 5;
  const { visibles, pagina, totalPaginas } = usePaginado(beneficios, porPagina);

  const horaStr = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const fechaStr = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (estado === 'cargando') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'none' }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'var(--brand)', animation: 'pulse 1s cubic-bezier(0.4,0,0.6,1) infinite' }} />
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'none' }}>
        <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-1)' }}>Grupo Popper · Beneficios</p>
        <p style={{ fontSize: 19, color: 'var(--text-3)' }}>No se pudo cargar el catálogo. Reintentando automáticamente…</p>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg-canvas)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'none',
      }}
    >
      {/* ===== Header ===== */}
      <header
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '22px 44px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 13, background: 'var(--brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 21, color: 'var(--brand-fg)', letterSpacing: '-0.02em',
          }}>GP</div>
          <div>
            <p style={{ fontSize: 23, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.15 }}>Grupo Popper</p>
            <p style={{ fontSize: 15.5, color: 'var(--text-3)' }}>
              {esComercio ? 'Beneficios en este punto de venta' : 'Programa de Beneficios'}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{horaStr}</p>
          <p style={{ fontSize: 15, color: 'var(--text-3)', textTransform: 'capitalize' }}>{fechaStr}</p>
        </div>
      </header>

      {/* ===== Cuerpo ===== */}
      {esComercio ? (
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '420px 1fr', gap: 44, padding: '38px 44px', minHeight: 0 }}>
          {/* Columna QR */}
          <div
            style={{
              background: CARD_GRADIENT,
              borderRadius: 24,
              borderTop: '2px solid rgba(191,163,99,0.35)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              padding: '38px 34px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
              textAlign: 'center',
            }}
          >
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>
                {comercio?.nombre}
              </p>
              <p style={{ fontSize: 31, fontWeight: 800, color: 'white', letterSpacing: '-0.015em', lineHeight: 1.2 }}>
                Canjeá tus beneficios
              </p>
            </div>
            <div style={{ background: 'white', padding: 22, borderRadius: 20, boxShadow: '0 8px 28px rgba(0,0,0,0.45)' }}>
              <QRCodeSVG
                value={`${window.location.origin}${window.location.pathname}#/qr/${qrCode}`}
                size={252}
                level="M"
                bgColor="#ffffff"
                fgColor="#0a1020"
              />
            </div>
            <div>
              <p style={{ fontSize: 21, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                Escaneá con tu celular
              </p>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.75)', lineHeight: 1.55 }}>
                1 · Apuntá la cámara al código<br />
                2 · Ingresá tu DNI<br />
                3 · Mostrale la pantalla al cajero
              </p>
            </div>
          </div>

          {/* Columna beneficios */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 25, fontWeight: 700, color: 'var(--text-1)' }}>Beneficios disponibles</h2>
              <span style={{ fontSize: 17, color: 'var(--text-3)' }}>
                {beneficios.length} {beneficios.length === 1 ? 'oferta' : 'ofertas'}
              </span>
            </div>
            {beneficios.length === 0 ? (
              <p style={{ fontSize: 19, color: 'var(--text-3)' }}>Por el momento no hay beneficios activos en este comercio.</p>
            ) : (
              <>
                <div key={pagina} style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeInUp 420ms var(--ease-out)' }}>
                  {visibles.map(b => <TarjetaBeneficio key={b.id} b={b} mostrarComercios={false} />)}
                </div>
                <Dots pagina={pagina} total={totalPaginas} />
              </>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, padding: '38px 44px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 27, fontWeight: 700, color: 'var(--text-1)' }}>Tus beneficios de este mes</h2>
            <span style={{ fontSize: 17, color: 'var(--text-3)' }}>
              {beneficios.length} {beneficios.length === 1 ? 'beneficio activo' : 'beneficios activos'}
            </span>
          </div>
          {beneficios.length === 0 ? (
            <p style={{ fontSize: 19, color: 'var(--text-3)' }}>Por el momento no hay beneficios activos.</p>
          ) : (
            <>
              <div key={pagina} style={{ display: 'flex', flexDirection: 'column', gap: 15, animation: 'fadeInUp 420ms var(--ease-out)' }}>
                {visibles.map(b => <TarjetaBeneficio key={b.id} b={b} mostrarComercios={true} />)}
              </div>
              <Dots pagina={pagina} total={totalPaginas} />
            </>
          )}
        </div>
      )}

      {/* ===== Footer ===== */}
      <footer
        style={{
          flexShrink: 0, padding: '14px 44px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <p style={{ fontSize: 13.5, color: 'var(--text-3)' }}>
          © {ahora.getFullYear()} Recluta · Programa de beneficios Grupo Popper
        </p>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)' }}>
          {ultimaActualizacion && `Actualizado ${ultimaActualizacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · se renueva automáticamente`}
        </p>
      </footer>
    </div>
  );
}
