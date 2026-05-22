import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://beneficios-backend-jfpx.onrender.com/api';

interface DashboardData {
  stats: {
    verificacionesHoy: number;
    verificacionesSemana: number;
    verificacionesMes: number;
    totalBeneficiarios: number;
    totalComercios: number;
    totalBeneficios: number;
  };
  topBeneficios: { nombre: string; total_usos: string }[];
  topComercios: { nombre: string; total_usos: string }[];
  verificacionesPorDia: { fecha: string; total: string }[];
  ultimasVerificaciones: any[];
}

type Tab = 'dashboard' | 'verificaciones' | 'beneficios' | 'comercios' | 'qrcodes';

const gold = '#bfa363';

export default function AdminDashboard({ token, user, onLogout }: {
  token: string;
  user: any;
  onLogout: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<DashboardData | null>(null);
  const [verificaciones, setVerificaciones] = useState<any[]>([]);
  const [beneficios, setBeneficios] = useState<any[]>([]);
  const [comercios, setComercios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/dashboard`, { headers });
      if (res.ok) setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [token]);

  const fetchVerificaciones = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/verificaciones`, { headers });
      if (res.ok) { const d = await res.json(); setVerificaciones(d.verificaciones); }
    } catch (e) { console.error(e); }
  };

  const fetchBeneficios = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/beneficios`, { headers });
      if (res.ok) { const d = await res.json(); setBeneficios(d.beneficios); }
    } catch (e) { console.error(e); }
  };

  const fetchComercios = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/comercios`, { headers });
      if (res.ok) { const d = await res.json(); setComercios(d.comercios); }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (activeTab === 'verificaciones') fetchVerificaciones();
    if (activeTab === 'beneficios') fetchBeneficios();
    if (activeTab === 'comercios' || activeTab === 'qrcodes') fetchComercios();
  }, [activeTab]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'verificaciones', label: 'Movimiento', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'beneficios', label: 'Beneficios', icon: 'M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7' },
    { id: 'comercios', label: 'Comercios', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'qrcodes', label: 'QR Codes', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' },
  ];

  const formatDate = (d: string) => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : 'https://beneficios.recluta.com.ar/';

  return (
    <div className="min-h-screen" style={{ background: '#080e1a' }}>
      {/* Top bar */}
      <div className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(15,25,42,0.8)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ border: `1px solid rgba(191,163,99,0.25)` }}>
              <span className="text-[11px] font-bold" style={{ color: gold }}>GP</span>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">Panel RRHH</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Grupo Popper</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {user?.nombre} {user?.apellido}
            </p>
            <button onClick={onLogout} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
              style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
              Salir
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        <div className="max-w-7xl mx-auto px-4 flex gap-1">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-3 text-[12px] font-medium transition-all whitespace-nowrap"
              style={{
                color: activeTab === tab.id ? gold : 'rgba(255,255,255,0.35)',
                borderBottom: activeTab === tab.id ? `2px solid ${gold}` : '2px solid transparent',
              }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ====== DASHBOARD ====== */}
        {activeTab === 'dashboard' && (
          loading ? (
            <div className="flex justify-center py-20">
              <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(191,163,99,0.15)', borderTopColor: gold }} />
            </div>
          ) : data && (
            <div className="space-y-6">
              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Hoy', value: data.stats.verificacionesHoy, color: '#4ade80' },
                  { label: 'Semana', value: data.stats.verificacionesSemana, color: '#60a5fa' },
                  { label: 'Mes', value: data.stats.verificacionesMes, color: gold },
                  { label: 'Colaboradores', value: data.stats.totalBeneficiarios, color: '#a78bfa' },
                  { label: 'Comercios', value: data.stats.totalComercios, color: '#f472b6' },
                  { label: 'Beneficios', value: data.stats.totalBeneficios, color: '#fb923c' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
                    <p className="text-[28px] font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Top beneficios + Top comercios */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>Top beneficios (30 dias)</p>
                  {data.topBeneficios.length === 0 ? (
                    <p className="text-[13px] py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin datos aun</p>
                  ) : data.topBeneficios.map((b, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold w-5 text-center" style={{ color: gold }}>{i + 1}</span>
                        <span className="text-[13px] text-white">{b.nombre}</span>
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: '#4ade80' }}>{b.total_usos}</span>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>Top comercios (30 dias)</p>
                  {data.topComercios.length === 0 ? (
                    <p className="text-[13px] py-4" style={{ color: 'rgba(255,255,255,0.2)' }}>Sin datos aun</p>
                  ) : data.topComercios.map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold w-5 text-center" style={{ color: gold }}>{i + 1}</span>
                        <span className="text-[13px] text-white">{c.nombre}</span>
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: '#60a5fa' }}>{c.total_usos}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ultimas verificaciones */}
              <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-4" style={{ color: 'rgba(191,163,99,0.5)' }}>Ultimo movimiento</p>
                {data.ultimasVerificaciones.length === 0 ? (
                  <p className="text-[13px] py-8 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>No hay verificaciones registradas</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          {['Fecha', 'Colaborador', 'DNI', 'Beneficio', 'Comercio', 'Estado', 'Codigo'].map(h => (
                            <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.ultimasVerificaciones.map(v => (
                          <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatDate(v.fecha_verificacion)}</td>
                            <td className="py-2.5 px-2 text-white font-medium">{v.beneficiario_nombre} {v.beneficiario_apellido}</td>
                            <td className="py-2.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{v.dni}</td>
                            <td className="py-2.5 px-2" style={{ color: gold }}>{v.beneficio_nombre}</td>
                            <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{v.comercio_nombre}</td>
                            <td className="py-2.5 px-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{
                                  background: v.estado === 'exitoso' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                                  color: v.estado === 'exitoso' ? '#4ade80' : '#f87171',
                                }}>
                                {v.estado}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{v.codigo_referencia}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ====== VERIFICACIONES ====== */}
        {activeTab === 'verificaciones' && (
          <div className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>
                Historial completo ({verificaciones.length})
              </p>
              <button onClick={fetchVerificaciones} className="text-[11px] px-3 py-1.5 rounded-lg"
                style={{ color: gold, border: `1px solid rgba(191,163,99,0.2)` }}>
                Actualizar
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Fecha', 'Colaborador', 'DNI', 'Nivel', 'Beneficio', 'Comercio', 'Estado', 'Codigo'].map(h => (
                      <th key={h} className="text-left py-2 px-2 font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {verificaciones.map(v => (
                    <tr key={v.id} className="hover:bg-white/[0.02] transition-colors" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{formatDate(v.fecha_verificacion)}</td>
                      <td className="py-2.5 px-2 text-white font-medium">{v.beneficiario_nombre} {v.beneficiario_apellido}</td>
                      <td className="py-2.5 px-2 font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{v.dni}</td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase" style={{ background: 'rgba(191,163,99,0.1)', color: gold }}>
                          {v.nivel}
                        </span>
                      </td>
                      <td className="py-2.5 px-2" style={{ color: gold }}>{v.beneficio_nombre}</td>
                      <td className="py-2.5 px-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{v.comercio_nombre}</td>
                      <td className="py-2.5 px-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{ background: v.estado === 'exitoso' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: v.estado === 'exitoso' ? '#4ade80' : '#f87171' }}>
                          {v.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{v.codigo_referencia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {verificaciones.length === 0 && (
                <p className="text-center py-12 text-[13px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No hay verificaciones registradas</p>
              )}
            </div>
          </div>
        )}

        {/* ====== BENEFICIOS ====== */}
        {activeTab === 'beneficios' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {beneficios.map(b => (
              <div key={b.id} className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-[14px] font-semibold text-white pr-2">{b.nombre}</h3>
                  <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                    style={{ background: b.activo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: b.activo ? '#4ade80' : '#f87171' }}>
                    {b.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-[12px] mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{b.descripcion}</p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Nivel min.</span><span style={{ color: gold }}>{b.nivel_minimo}</span></div>
                  {b.descuento && <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Descuento</span><span className="font-bold" style={{ color: '#4ade80' }}>{b.descuento}%</span></div>}
                  <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Usos</span><span className="text-white font-medium">{b.uso_actual || 0}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'rgba(255,255,255,0.3)' }}>Horario</span><span style={{ color: 'rgba(255,255,255,0.5)' }}>{b.horario_inicio || '-'} a {b.horario_fin || '-'}</span></div>
                </div>
              </div>
            ))}
            {beneficios.length === 0 && (
              <p className="col-span-full text-center py-12 text-[13px]" style={{ color: 'rgba(255,255,255,0.2)' }}>No hay beneficios</p>
            )}
          </div>
        )}

        {/* ====== COMERCIOS ====== */}
        {activeTab === 'comercios' && (
          <div className="grid md:grid-cols-2 gap-4">
            {comercios.map(c => (
              <div key={c.id} className="p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-[14px] font-semibold text-white">{c.nombre}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                    style={{ background: c.activo ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: c.activo ? '#4ade80' : '#f87171' }}>
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="space-y-1 text-[11px] mb-3">
                  <p style={{ color: 'rgba(255,255,255,0.4)' }}>{c.direccion}, {c.ciudad}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)' }}>Responsable: {c.responsable}</p>
                  <p style={{ color: 'rgba(255,255,255,0.3)' }}>Horario: {c.horario_apertura} - {c.horario_cierre}</p>
                </div>
                <div className="p-2.5 rounded-lg" style={{ background: 'rgba(191,163,99,0.05)', border: '1px solid rgba(191,163,99,0.1)' }}>
                  <p className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(191,163,99,0.5)' }}>Codigo QR</p>
                  <p className="text-[12px] font-mono mt-0.5" style={{ color: gold }}>{c.qr_code}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ====== QR CODES ====== */}
        {activeTab === 'qrcodes' && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comercios.filter(c => c.activo).map(c => {
              const qrUrl = `${baseUrl}#/qr/${c.qr_code}`;
              return (
                <div key={c.id} className="p-6 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <h3 className="text-[14px] font-semibold text-white mb-1">{c.nombre}</h3>
                  <p className="text-[11px] mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>{c.direccion}</p>

                  {/* QR placeholder - usar qrcode.react */}
                  <div className="w-48 h-48 mx-auto bg-white rounded-xl p-3 mb-4 flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=0a0e14`}
                      alt={`QR ${c.nombre}`}
                      className="w-full h-full"
                    />
                  </div>

                  <p className="text-[10px] font-mono mb-3 break-all" style={{ color: 'rgba(255,255,255,0.25)' }}>{qrUrl}</p>

                  <button
                    onClick={() => { navigator.clipboard.writeText(qrUrl); }}
                    className="px-4 py-2 rounded-lg text-[11px] font-medium transition-all"
                    style={{ color: gold, border: `1px solid rgba(191,163,99,0.2)` }}>
                    Copiar URL
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
