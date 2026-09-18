import React from 'react';
import Image from 'next/image';

export interface KlassaLogoProps {
  variant?: 'horizontal' | 'vertical' | 'mark-only' | 'app-icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  priority?: boolean;
}

const sizeMap = {
  xs: {
    horizontal: { width: 110, height: 32 },
    vertical: { width: 64, height: 72 },
    'mark-only': { width: 28, height: 28 },
    'app-icon': { width: 32, height: 32 },
  },
  sm: {
    horizontal: { width: 140, height: 42 },
    vertical: { width: 90, height: 102 },
    'mark-only': { width: 36, height: 36 },
    'app-icon': { width: 44, height: 44 },
  },
  md: {
    horizontal: { width: 180, height: 54 },
    vertical: { width: 130, height: 148 },
    'mark-only': { width: 48, height: 48 },
    'app-icon': { width: 56, height: 56 },
  },
  lg: {
    horizontal: { width: 240, height: 72 },
    vertical: { width: 180, height: 204 },
    'mark-only': { width: 72, height: 72 },
    'app-icon': { width: 80, height: 80 },
  },
  xl: {
    horizontal: { width: 320, height: 96 },
    vertical: { width: 260, height: 296 },
    'mark-only': { width: 100, height: 100 },
    'app-icon': { width: 120, height: 120 },
  },
};

/**
 * KlassaLogo - Komponen Resmi Identitas Brand KLASSA
 * Menggunakan aset master resmi beresolusi tinggi (Transparent PNG / Retina 4K Ready)
 * Persis 100% dengan dokumen acuan brand approved.
 */
export const KlassaLogo: React.FC<KlassaLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  onClick,
  priority = false,
}) => {
  const dims = sizeMap[size]?.[variant] || sizeMap.md[variant];

  // Map asset source
  let src = '/brand/klassa-logo-horizontal.png';
  let alt = 'KLASSA — Naik Kelas Bersama';

  if (variant === 'vertical') {
    src = '/brand/klassa-logo-vertical.png';
    alt = 'KLASSA Vertical Logo';
  } else if (variant === 'mark-only') {
    src = '/brand/klassa-mark.png';
    alt = 'KLASSA Mark';
  } else if (variant === 'app-icon') {
    src = '/brand/klassa-app-icon.png';
    alt = 'KLASSA App Icon';
  }

  return (
    <div
      className={`inline-flex items-center justify-center select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={onClick}
    >
      <img
        src={src}
        alt={alt}
        width={dims.width}
        height={dims.height}
        className="h-auto max-w-full object-contain drop-shadow-xs transition-transform active:scale-98"
        loading={priority ? 'eager' : 'lazy'}
      />
    </div>
  );
};
