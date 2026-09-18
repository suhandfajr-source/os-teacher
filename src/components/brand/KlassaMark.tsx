import React from 'react';

export interface KlassaMarkProps {
  size?: number | string;
  className?: string;
  onClick?: () => void;
}

/**
 * KlassaMark - Komponen Simbol Tunggal Monogram K KLASSA
 * Menggunakan aset master resmi beresolusi tinggi (Transparent PNG)
 */
export const KlassaMark: React.FC<KlassaMarkProps> = ({
  size = 48,
  className = '',
  onClick,
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`inline-flex items-center justify-center flex-shrink-0 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
      onClick={onClick}
    >
      <img
        src="/brand/klassa-mark.png"
        alt="KLASSA Mark"
        className="w-full h-full object-contain drop-shadow-xs"
      />
    </div>
  );
};
