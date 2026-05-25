import { useState, useEffect, ReactNode } from 'react';
import {
  LayoutDashboard,
  Activity,
  Gift,
  Store,
  Users,
  QrCode,
  ShieldCheck,
  KeyRound,
  LogOut,
  Menu,
  X,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Sparkles,
  Heart,
  Layers,
} from 'lucide-react';

// ============================================
// AppShell — Sidebar layout estilo Linear
// Mobile: drawer overlay con backdrop
// Desktop: sidebar fijo, opcionalmente colapsable
// ============================================

export type NavId =
  | 'dashboard'
  | 'verificaciones'
  | 'beneficios'
  | 'comercios'
  | 'beneficiarios'
  | 'qrcodes'
  | 'autorizaciones'
  | 'permisos'
  | 'talento'
  | 'familiares'
  | 'jerarquias';

interface NavItem {
  id: NavId;
  label: string;
  icon: typeof LayoutDashboard;
  section: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard, section: 'Analítica' },
  { id: 'verificaciones', label: 'Movimiento', icon: Activity, section: 'Analítica' },

  { id: 'beneficios', label: 'Beneficios', icon: Gift, section: 'Catálogo' },
  { id: 'comercios', label: 'Comercios', icon: Store, section: 'Catálogo' },
  { id: 'qrcodes', label: 'Códigos QR', icon: QrCode, section: 'Catálogo' },
  { id: 'jerarquias', label: 'Jerarquías', icon: Layers, section: 'Catálogo' },

  { id: 'beneficiarios', label: 'Colaboradores', icon: Users, section: 'Personas' },
  { id: 'familiares', label: 'Familiares', icon: Heart, section: 'Personas' },
  { id: 'talento', label: 'Talento Popper', icon: Sparkles, section: 'Personas' },
  { id: 'autorizaciones', label: 'Autorizaciones', icon: ShieldCheck, section: 'Personas' },
  { id: 'permisos', label: 'Permisos', icon: KeyRound, section: 'Personas' },
];

interface AppShellProps {
  activeTab: NavId;
  onTabChange: (id: NavId) => void;
  user: any;
  onLogout: () => void;
  children: ReactNode;
}

export function AppShell({ activeTab, onTabChange, user, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false
  );

  // Cerrar mobile drawer al cambiar de tab
  useEffect(() => {
    setMobileOpen(false);
  }, [activeTab]);

  // Resize listener
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ESC cierra drawer mobile
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prevent body scroll cuando el drawer está abierto en mobile
  useEffect(() => {
    if (isMobile && mobileOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = original; };
    }
  }, [isMobile, mobileOpen]);

  const sections = Array.from(new Set(navItems.map(n => n.section)));
  const currentItem = navItems.find(n => n.id === activeTab);

  // Desktop: sidebar fijo a la izquierda. Mobile: drawer overlay
  const sidebarWidth = collapsed ? 64 : 232;
  const desktopSidebarWidth = isMobile ? 0 : sidebarWidth;
  const mobileSidebarWidth = 264;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)' }}>
      {/* ====== Mobile backdrop ====== */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-overlay)',
            backdropFilter: 'blur(4px)',
            zIndex: 40,
            animation: 'fadeIn 160ms var(--ease-out)',
          }}
          className="md:hidden"
        />
      )}

      {/* ====== Sidebar ====== */}
      <aside
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          width: isMobile ? mobileSidebarWidth : sidebarWidth,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
          zIndex: 50,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
          transition: 'width 200ms var(--ease-out), transform 240ms var(--ease-out)',
          boxShadow: isMobile && mobileOpen ? '0 0 40px rgba(0,0,0,0.4)' : 'none',
        }}
      >

        {/* Brand */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0' : '0 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '7px',
                background: 'var(--brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-fg)',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '-0.02em',
                flexShrink: 0,
              }}
            >
              GP
            </div>
            {!collapsed && (
              <div className="overflow-hidden">
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.005em', lineHeight: 1.2 }}>
                  Grupo Popper
                </p>
                <p style={{ fontSize: '10.5px', color: 'var(--text-3)', lineHeight: 1.2, marginTop: 1 }}>
                  Beneficios
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden ml-auto p-1.5 rounded-md hover:bg-white/5"
            style={{ color: 'var(--text-3)' }}
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          {sections.map(section => (
            <div key={section} style={{ marginBottom: 8 }}>
              {!collapsed && (
                <div
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'var(--text-4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '8px 12px 6px',
                  }}
                >
                  {section}
                </div>
              )}
              {navItems
                .filter(n => n.section === section)
                .map(item => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: collapsed ? 0 : 10,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        width: '100%',
                        padding: collapsed ? '8px 0' : '7px 12px',
                        borderRadius: '6px',
                        background: active ? 'var(--bg-raised)' : 'transparent',
                        color: active ? 'var(--text-1)' : 'var(--text-3)',
                        fontSize: '13px',
                        fontWeight: active ? 500 : 400,
                        transition: 'all 120ms var(--ease-in-out)',
                        position: 'relative',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'var(--bg-elevated)';
                          e.currentTarget.style.color = 'var(--text-1)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = 'var(--text-3)';
                        }
                      }}
                    >
                      {active && !collapsed && (
                        <span
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 2,
                            height: 16,
                            background: 'var(--brand)',
                            borderRadius: '0 2px 2px 0',
                          }}
                        />
                      )}
                      <Icon size={16} strokeWidth={active ? 2 : 1.75} />
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* User + actions */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 10 }}>
          {/* Collapse toggle (desktop only) */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              display: isMobile ? 'none' : 'flex',
              width: '100%',
              padding: '7px 12px',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: 10,
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text-3)',
              fontSize: '12px',
              transition: 'all 120ms var(--ease-in-out)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-elevated)';
              e.currentTarget.style.color = 'var(--text-1)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-3)';
            }}
          >
            {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            {!collapsed && <span>Contraer</span>}
          </button>

          {/* User info + logout */}
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: collapsed ? '6px 0' : '8px 10px',
              borderRadius: '6px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <UserAvatar nombre={user?.nombre} apellido={user?.apellido} email={user?.email || user?.username} />
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p
                    style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: 'var(--text-1)',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user?.nombre || 'Admin'}
                  </p>
                  <p
                    style={{
                      fontSize: '10.5px',
                      color: 'var(--text-3)',
                      lineHeight: 1.2,
                      marginTop: 1,
                    }}
                  >
                    {user?.rol === 'super_admin' ? 'Super admin' : 'Admin'}
                  </p>
                </div>
                <button
                  onClick={onLogout}
                  title="Cerrar sesión"
                  style={{
                    color: 'var(--text-3)',
                    padding: 4,
                    borderRadius: '4px',
                    transition: 'all 120ms var(--ease-in-out)',
                    display: 'flex',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--danger-text)';
                    e.currentTarget.style.background = 'var(--danger-bg)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--text-3)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <LogOut size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ====== Main content ====== */}
      <main
        style={{
          marginLeft: desktopSidebarWidth,
          minHeight: '100vh',
          transition: 'margin-left 200ms var(--ease-out)',
        }}
      >
        {/* TopBar minimalista */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            height: 56,
            background: 'rgba(8, 9, 10, 0.75)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 12,
          }}
        >
          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              display: isMobile ? 'flex' : 'none',
              padding: 8,
              borderRadius: '6px',
              background: 'transparent',
              color: 'var(--text-2)',
              border: 'none',
              cursor: 'pointer',
              marginLeft: -8,
            }}
            aria-label="Abrir menú"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb / current page */}
          <div className="flex items-center gap-2 min-w-0">
            {currentItem && (
              <>
                <currentItem.icon size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} strokeWidth={1.75} />
                <h1
                  style={{
                    fontSize: '13.5px',
                    fontWeight: 500,
                    color: 'var(--text-1)',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {currentItem.label}
                </h1>
              </>
            )}
          </div>

          {/* Search global — desktop only */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              style={{
                height: 32,
                padding: isMobile ? 0 : '0 10px',
                width: isMobile ? 32 : undefined,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-3)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                transition: 'all 120ms var(--ease-in-out)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-raised)';
                e.currentTarget.style.borderColor = 'var(--border-default)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <Search size={13} />
              {!isMobile && <span>Buscar</span>}
              <kbd
                style={{
                  display: isMobile ? 'none' : 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 18,
                  padding: '0 4px',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '3px',
                  fontSize: '10px',
                  color: 'var(--text-3)',
                  fontFamily: 'inherit',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: isMobile ? '16px' : '24px', maxWidth: 1400, margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function UserAvatar({ nombre, apellido, email }: { nombre?: string; apellido?: string; email?: string }) {
  const initials = ((nombre?.[0] || email?.[0] || 'U') + (apellido?.[0] || '')).toUpperCase();
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--brand-muted)',
        border: '1px solid var(--brand-border)',
        color: 'var(--brand)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

export default AppShell;
