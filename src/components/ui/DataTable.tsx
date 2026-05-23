import { useState, useMemo, ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Inbox } from 'lucide-react';

// ============================================
// DataTable — tabla densa con sort, filter, search
// Inspirada en Linear / Vercel tables
// ============================================

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: number | string;
  mono?: boolean;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => any; // valor para sort/search
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchPlaceholder?: string;
  empty?: {
    title: string;
    description?: string;
    icon?: ReactNode;
  };
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  initialSort?: { key: string; direction: 'asc' | 'desc' };
  filters?: ReactNode; // slot para filtros custom
}

export function DataTable<T>({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Buscar…',
  empty,
  rowKey,
  onRowClick,
  pageSize = 25,
  initialSort,
  filters,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(initialSort || null);
  const [page, setPage] = useState(0);

  // Filtrar
  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(row => {
      return columns.some(col => {
        const value = col.accessor ? col.accessor(row) : (row as any)[col.key];
        if (value == null) return false;
        return String(value).toLowerCase().includes(q);
      });
    });
  }, [data, search, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find(c => c.key === sort.key);
    if (!col) return filtered;
    const sortedArr = [...filtered].sort((a, b) => {
      const av = col.accessor ? col.accessor(a) : (a as any)[col.key];
      const bv = col.accessor ? col.accessor(b) : (b as any)[col.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sort.direction === 'asc' ? av - bv : bv - av;
      }
      const aStr = String(av).toLowerCase();
      const bStr = String(bv).toLowerCase();
      if (aStr < bStr) return sort.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedArr;
  }, [filtered, sort, columns]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginated = sorted.slice(page * pageSize, page * pageSize + pageSize);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  if (safePage !== page) setPage(safePage);

  const toggleSort = (key: string) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  };

  return (
    <div>
      {/* Toolbar: search + filters */}
      {(searchable || filters) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            borderTopLeftRadius: '8px',
            borderTopRightRadius: '8px',
          }}
        >
          {searchable && (
            <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-3)',
                }}
              />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                style={{
                  width: '100%',
                  height: 30,
                  padding: '0 10px 0 30px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-1)',
                  fontSize: '12.5px',
                  outline: 'none',
                  transition: 'all 120ms var(--ease-in-out)',
                }}
                onFocus={e => {
                  e.target.style.borderColor = 'var(--brand)';
                  e.target.style.boxShadow = '0 0 0 3px var(--brand-subtle)';
                }}
                onBlur={e => {
                  e.target.style.borderColor = 'var(--border-subtle)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          )}
          {filters && <div style={{ display: 'flex', gap: 6 }}>{filters}</div>}
          <div style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--text-3)' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{sorted.length}</span>{' '}
            {sorted.length === 1 ? 'registro' : 'registros'}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
          <thead>
            <tr>
              {columns.map(col => {
                const isSorted = sort?.key === col.key;
                const align = col.align || (col.mono ? 'right' : 'left');
                return (
                  <th
                    key={String(col.key)}
                    onClick={col.sortable ? () => toggleSort(String(col.key)) : undefined}
                    style={{
                      padding: '10px 12px',
                      textAlign: align,
                      fontWeight: 500,
                      fontSize: '11px',
                      color: 'var(--text-3)',
                      borderBottom: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface)',
                      cursor: col.sortable ? 'pointer' : 'default',
                      whiteSpace: 'nowrap',
                      width: col.width,
                      userSelect: 'none',
                      position: 'sticky',
                      top: 0,
                      letterSpacing: '0.02em',
                    }}
                    onMouseEnter={e => {
                      if (col.sortable) e.currentTarget.style.color = 'var(--text-1)';
                    }}
                    onMouseLeave={e => {
                      if (col.sortable) e.currentTarget.style.color = 'var(--text-3)';
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      {col.sortable && (
                        <span style={{ color: isSorted ? 'var(--brand)' : 'var(--text-5)' }}>
                          {isSorted ? (
                            sort.direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
                          ) : (
                            <ArrowUpDown size={11} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 0 }}>
                  <div
                    style={{
                      padding: '48px 24px',
                      textAlign: 'center',
                      color: 'var(--text-3)',
                    }}
                  >
                    {empty?.icon || <Inbox size={24} style={{ margin: '0 auto 12px', color: 'var(--text-4)' }} />}
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>
                      {empty?.title || 'Sin registros'}
                    </p>
                    {empty?.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', maxWidth: 360, margin: '0 auto' }}>
                        {empty.description}
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, ri) => (
                <tr
                  key={rowKey(row) || ri}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    cursor: onRowClick ? 'pointer' : undefined,
                    transition: 'background 80ms var(--ease-in-out)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {columns.map(col => {
                    const align = col.align || (col.mono ? 'right' : 'left');
                    const content = col.render ? col.render(row) : (row as any)[col.key];
                    return (
                      <td
                        key={String(col.key)}
                        style={{
                          padding: '10px 12px',
                          color: 'var(--text-2)',
                          textAlign: align,
                          fontFamily: col.mono ? 'var(--font-geist-mono)' : undefined,
                          fontVariantNumeric: col.mono ? 'tabular-nums' : undefined,
                          fontSize: col.mono ? '12px' : '12.5px',
                          whiteSpace: 'nowrap',
                          maxWidth: col.width || 280,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={typeof content === 'string' ? content : undefined}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '11.5px',
            color: 'var(--text-3)',
            background: 'var(--bg-surface)',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
          }}
        >
          <div style={{ fontVariantNumeric: 'tabular-nums' }}>
            Página {safePage + 1} de {totalPages}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={safePage === 0}
              style={pagBtn(safePage === 0)}
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              style={pagBtn(safePage >= totalPages - 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function pagBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '4px',
    color: disabled ? 'var(--text-4)' : 'var(--text-2)',
    fontSize: '11.5px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 120ms var(--ease-in-out)',
  };
}

export default DataTable;
