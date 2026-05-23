import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

// ============================================
// Chart - wrappers premium sobre recharts
// Filosofía: gráficos discretos, dorado sutil, sin colores chillones
// ============================================

const gold = '#bfa363';
const goldLight = '#d4b978';

// ============================================
// AreaChart elegante para series temporales
// ============================================
export function PremiumAreaChart({
  data,
  dataKey = 'value',
  xKey = 'label',
  height = 220,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-[12px]" style={{ height, color: 'rgba(255,255,255,0.25)' }}>
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="goldFillGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={goldLight} stopOpacity={0.35} />
            <stop offset="50%" stopColor={gold} stopOpacity={0.15} />
            <stop offset="100%" stopColor={gold} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: "'Inter', sans-serif" }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11, fontFamily: "'Inter', sans-serif" }}
          width={40}
        />
        <Tooltip content={<PremiumTooltip />} cursor={{ stroke: 'rgba(191,163,99,0.25)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={gold}
          strokeWidth={2}
          fill="url(#goldFillGradient)"
          activeDot={{ r: 4, fill: goldLight, stroke: '#0a0e14', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============================================
// BarChart horizontal con gradiente
// ============================================
export function PremiumBarChart({
  data,
  dataKey = 'value',
  xKey = 'label',
  height = 220,
}: {
  data: any[];
  dataKey?: string;
  xKey?: string;
  height?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-[12px]" style={{ height, color: 'rgba(255,255,255,0.25)' }}>
        Sin datos para mostrar
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="goldBarGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={gold} stopOpacity={0.85} />
            <stop offset="100%" stopColor={goldLight} stopOpacity={0.95} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" horizontal={false} />
        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12, fontFamily: "'Inter', sans-serif" }}
          width={110}
        />
        <Tooltip content={<PremiumTooltip />} cursor={{ fill: 'rgba(191,163,99,0.05)' }} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((_, idx) => (
            <Cell key={idx} fill="url(#goldBarGradient)" opacity={1 - (idx / data.length) * 0.4} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================
// Tooltip personalizado
// ============================================
function PremiumTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg shadow-2xl"
      style={{
        background: 'linear-gradient(180deg, rgba(20,28,46,0.98), rgba(10,16,28,0.99))',
        border: '1px solid rgba(191,163,99,0.25)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      {label && (
        <p
          className="text-[10px] font-semibold mb-1"
          style={{
            color: 'rgba(191,163,99,0.6)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </p>
      )}
      {payload.map((p: any, i: number) => (
        <p
          key={i}
          className="text-[14px]"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            color: '#d4b978',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {p.value.toLocaleString('es-AR')}
        </p>
      ))}
    </div>
  );
}

export default PremiumAreaChart;
