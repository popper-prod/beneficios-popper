// ============================================
// Empty - estado vacío elegante (no "no hay datos" feo)
// ============================================

interface EmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Empty({ icon, title, description, action }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fadeIn">
      {icon && (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-5 animate-floatGentle"
          style={{
            background: 'rgba(191,163,99,0.04)',
            border: '1px solid rgba(191,163,99,0.12)',
            color: '#bfa363',
          }}
        >
          {icon}
        </div>
      )}
      <h3
        className="mb-2"
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: '20px',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
        }}
      >
        {title}
      </h3>
      {description && (
        <p className="text-[13px] max-w-md mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default Empty;
