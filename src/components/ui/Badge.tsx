// ============================================
// GRUPO POPPER - Componente Badge Premium
// ============================================

import React from 'react';
import { cn } from '../../utils/cn';
import { BenefitLevel, TransactionStatus, UserRole } from '../../types';
import { BENEFIT_LEVELS, STATUS_LABELS, ROLE_LABELS } from '../../types';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  dot = false,
  className,
}) => {
  const variantStyles = {
    primary: 'bg-[#1e3a5f]/10 text-[#1e3a5f] border-[#1e3a5f]/20',
    secondary: 'bg-gray-100 text-gray-700 border-gray-200',
    accent: 'bg-[#ffd700]/20 text-amber-700 border-[#ffd700]/30',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    danger: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const dotStyles = {
    primary: 'bg-[#1e3a5f]',
    secondary: 'bg-gray-500',
    accent: 'bg-amber-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold border rounded-full',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'w-2 h-2 rounded-full mr-1.5 animate-pulse',
            dotStyles[variant]
          )}
        />
      )}
      {children}
    </span>
  );
};

// ============================================
// Badge de Nivel de Beneficio
// ============================================
export interface BenefitLevelBadgeProps {
  level: BenefitLevel;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const BenefitLevelBadge: React.FC<BenefitLevelBadgeProps> = ({
  level,
  size = 'md',
  showIcon = true,
}) => {
  const levelConfig = BENEFIT_LEVELS.find((l) => l.value === level);
  if (!levelConfig) return null;

  const variantMap: Record<BenefitLevel, BadgeProps['variant']> = {
    bronce: 'warning',
    plata: 'secondary',
    oro: 'accent',
    platinum: 'info',
  };

  return (
    <Badge variant={variantMap[level]} size={size}>
      {showIcon && <span className="mr-1">{levelConfig.icon}</span>}
      {levelConfig.label}
    </Badge>
  );
};

// ============================================
// Badge de Estado de Transacción
// ============================================
export interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export const TransactionStatusBadge: React.FC<TransactionStatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
}) => {
  const statusConfig = STATUS_LABELS[status];

  const variantMap: Record<TransactionStatus, BadgeProps['variant']> = {
    exitoso: 'success',
    fallido: 'danger',
    pendiente: 'warning',
    cancelado: 'secondary',
  };

  return (
    <Badge variant={variantMap[status]} size={size} dot={showDot}>
      {statusConfig.label}
    </Badge>
  );
};

// ============================================
// Badge de Rol de Usuario
// ============================================
export interface UserRoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
}

export const UserRoleBadge: React.FC<UserRoleBadgeProps> = ({
  role,
  size = 'md',
}) => {
  const variantMap: Record<UserRole, BadgeProps['variant']> = {
    admin: 'danger',
    supervisor: 'accent',
    employee: 'primary',
    auditor: 'info',
  };

  return (
    <Badge variant={variantMap[role]} size={size}>
      {ROLE_LABELS[role]}
    </Badge>
  );
};

export default Badge;
