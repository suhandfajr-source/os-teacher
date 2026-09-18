import React from 'react';

export interface KlassaLogoProps {
  variant?: 'horizontal' | 'vertical' | 'mark-only' | 'app-icon' | 'app-icon-dark' | 'app-icon-light';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  priority?: boolean;
}

const sizeMap = {
  xs: {
    horizontal: { width: 120, height: 36 },
    vertical: { width: 64, height: 76 },
    'mark-only': { width: 28, height: 28 },
    'app-icon': { width: 32, height: 32 },
    'app-icon-dark': { width: 32, height: 32 },
    'app-icon-light': { width: 32, height: 32 },
  },
  sm: {
    horizontal: { width: 150, height: 46 },
    vertical: { width: 90, height: 108 },
    'mark-only': { width: 36, height: 36 },
    'app-icon': { width: 44, height: 44 },
    'app-icon-dark': { width: 44, height: 44 },
    'app-icon-light': { width: 44, height: 44 },
  },
  md: {
    horizontal: { width: 190, height: 58 },
    vertical: { width: 130, height: 156 },
    'mark-only': { width: 48, height: 48 },
    'app-icon': { width: 56, height: 56 },
    'app-icon-dark': { width: 56, height: 56 },
    'app-icon-light': { width: 56, height: 56 },
  },
  lg: {
    horizontal: { width: 260, height: 80 },
    vertical: { width: 180, height: 216 },
    'mark-only': { width: 72, height: 72 },
    'app-icon': { width: 80, height: 80 },
    'app-icon-dark': { width: 80, height: 80 },
    'app-icon-light': { width: 80, height: 80 },
  },
  xl: {
    horizontal: { width: 340, height: 104 },
    vertical: { width: 260, height: 312 },
    'mark-only': { width: 100, height: 100 },
    'app-icon': { width: 120, height: 120 },
    'app-icon-dark': { width: 120, height: 120 },
    'app-icon-light': { width: 120, height: 120 },
  },
};

/**
 * KlassaLogo - Komponen Resmi Identitas Brand KLASSA
 * Menggunakan aset master resmi berformat Pure Vector SVG (Crisp 4K / Retina Ready)
 * Persis 100% dengan standar brand asset KLASSA.
 */
export const KlassaLogo: React.FC<KlassaLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  onClick,
  priority = false,
}) => {
  const currentSize = sizeMap[size] || sizeMap.md;
  const dims = currentSize[variant] || currentSize.horizontal;

  let src = '/brand/klassa-logo-horizontal.svg';
  let alt = 'KLASSA — Naik Kelas Bersama';

  if (variant === 'vertical') {
    src = '/brand/klassa-logo-vertical.svg';
    alt = 'KLASSA Vertical Logo';
  } else if (variant === 'mark-only') {
    src = '/brand/klassa-mark.svg';
    alt = 'KLASSA Mark';
  } else if (variant === 'app-icon' || variant === 'app-icon-dark') {
    src = '/brand/klassa-app-icon-dark.svg';
    alt = 'KLASSA App Icon Dark';
  } else if (variant === 'app-icon-light') {
    src = '/brand/klassa-app-icon-light.svg';
    alt = 'KLASSA App Icon Light';
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
