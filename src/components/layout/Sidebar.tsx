// ============================================
// GRUPO POPPER - Sidebar de Navegación Premium
// ============================================

import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { User, UserRole } from '../../types';
import { UserRoleBadge } from '../ui/Badge';

export type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  roles?: UserRole[];
  children?: NavItem[];
};

interface SidebarProps {
  user: User;
  items: NavItem[];
  activeItem: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  items,
  activeItem,
  onNavigate,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredItems = items.filter(
    (item) => !item.roles || item.roles.includes(user.rol)
  );

  const isActive = (id: string) => activeItem === id;
  const isExpanded = (id: string) => expandedItems.includes(id);

  return (
    <div
      className={cn(
        'h-screen bg-gradient-to-b from-[#1e3a5f] to-[#152c48] text-white flex flex-col transition-all duration-300',
        collapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Header del Sidebar */}
      <div className="p-4 border-b border-white/10">
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
            <div className="text-center">
              <span className="text-lg font-black text-[#1e3a5f]">GP</span>
              <div className="h-0.5 w-6 bg-[#ffd700] mx-auto rounded-full" />
            </div>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-white truncate">GRUPO POPPER</h1>
              <p className="text-xs text-white/60 truncate">Sistema de Beneficios</p>
            </div>
          )}
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {filteredItems.map((item) => (
            <li key={item.id}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                      'hover:bg-white/10',
                      collapsed && 'justify-center'
                    )}
                  >
                    <span className="flex-shrink-0 text-lg">{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span className="px-2 py-0.5 bg-[#ffd700] text-[#1e3a5f] text-xs font-bold rounded-full">
                            {item.badge}
                          </span>
                        )}
                        <svg
                          className={cn(
                            'w-4 h-4 transition-transform duration-200',
                            isExpanded(item.id) && 'rotate-180'
                          )}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                  {!collapsed && isExpanded(item.id) && (
                    <ul className="mt-1 ml-4 space-y-1 animate-slideDown">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <button
                            onClick={() => onNavigate(child.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                              isActive(child.id)
                                ? 'bg-white/20 text-white font-semibold'
                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                            )}
                          >
                            <span className="text-base">{child.icon}</span>
                            <span>{child.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive(item.id)
                      ? 'bg-white/20 text-white shadow-lg'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                    collapsed && 'justify-center'
                  )}
                >
                  <span className="flex-shrink-0 text-lg">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* Perfil del usuario */}
      <div className={cn('p-4 border-t border-white/10', collapsed && 'px-2')}>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#ffd700] flex items-center justify-center text-[#1e3a5f] font-bold">
            {user.nombre[0]}{user.apellido[0]}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.nombre} {user.apellido}
              </p>
              <UserRoleBadge role={user.rol} size="sm" />
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Cerrar sesión"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Botón de colapsar */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="absolute -right-3 top-20 w-6 h-6 bg-[#1e3a5f] border-2 border-white rounded-full flex items-center justify-center text-white hover:bg-[#2d5a87] transition-colors shadow-lg"
        >
          <svg
            className={cn('w-3 h-3 transition-transform duration-200', collapsed && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
