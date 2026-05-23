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
// Chart — wrappers recharts, paleta neutra
// ============================================

const brand = '#d4a017';
const brandLight = '#e0ad22';

interface SeriesProps {
  data: any[];
  dataKey?: string;
  xKey?: string;
  height?: number;
}

export function AreaChartCard({ data, dataKey = 'value', xKey = 'label', height = 200 }: SeriesProps) {
  if (!data || data.length === 0) return <EmptyChart height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="areaBrandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brand} stopOpacity={0.20} />
            <stop offset="100%" stopColor={brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(237,237,238,0.40)', fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(237,237,238,0.30)', fontSize: 11 }}
          width={36}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(212,160,23,0.25)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={brand}
          strokeWidth={1.5}
          fill="url(#areaBrandGrad)"
          activeDot={{ r: 4, fill: brandLight, stroke: '#08090a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarChartCard({ data, dataKey = 'value', xKey = 'label', height = 220 }: SeriesProps) {
  if (!data || data.length === 0) return <EmptyChart height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(237,237,238,0.30)', fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey={xKey}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'rgba(237,237,238,0.70)', fontSize: 12 }}
          width={130}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(212,160,23,0.05)' }} />
        <Bar dataKey={dataKey} radius={[0, 3, 3, 0]} barSize={16}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={brand} opacity={1 - (idx / data.length) * 0.5} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-4)',
        fontSize: '12px',
      }}
    >
      Sin datos para mostrar
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: '6px',
        padding: '8px 10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        fontSize: '12px',
      }}
    >
      {label && (
        <p
          style={{
            color: 'var(--text-3)',
            fontSize: '11px',
            marginBottom: 4,
            fontWeight: 500,
          }}
        >
          {label}
        </p>
      )}
      {payload.map((p: any, i: number) => (
        <p
          key={i}
          style={{
            color: 'var(--text-1)',
            fontSize: '13px',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {p.value.toLocaleString('es-AR')}
        </p>
      ))}
    </div>
  );
}

// Backwards compat exports
export const PremiumAreaChart = AreaChartCard;
export const PremiumBarChart = BarChartCard;

export default AreaChartCard;
