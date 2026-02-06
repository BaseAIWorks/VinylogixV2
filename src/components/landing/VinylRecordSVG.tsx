'use client';

import { cn } from '@/lib/utils';

interface VinylRecordSVGProps {
  className?: string;
  size?: number;
  color?: string;
  glowColor?: string;
  spinning?: boolean;
}

export function VinylRecordSVG({
  className,
  size = 200,
  color = 'currentColor',
  glowColor = 'rgba(124, 58, 237, 0.3)',
  spinning = false,
}: VinylRecordSVGProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={cn(spinning && 'animate-spin-slow', className)}
      style={{
        filter: `drop-shadow(0 0 20px ${glowColor})`,
      }}
    >
      {/* Outer ring */}
      <circle
        cx="100"
        cy="100"
        r="98"
        fill="none"
        stroke={color}
        strokeWidth="2"
        opacity="0.3"
      />

      {/* Main vinyl body */}
      <circle
        cx="100"
        cy="100"
        r="95"
        fill="url(#vinylGradient)"
      />

      {/* Groove rings */}
      {[85, 75, 65, 55, 45].map((r, i) => (
        <circle
          key={r}
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="0.5"
        />
      ))}

      {/* Label area */}
      <circle
        cx="100"
        cy="100"
        r="35"
        fill="url(#labelGradient)"
      />

      {/* Center hole */}
      <circle
        cx="100"
        cy="100"
        r="8"
        fill="#1a1a2e"
      />

      {/* Shine effect */}
      <ellipse
        cx="70"
        cy="70"
        rx="40"
        ry="20"
        fill="url(#shineGradient)"
        transform="rotate(-45 70 70)"
      />

      {/* Gradients */}
      <defs>
        <radialGradient id="vinylGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2a2a3e" />
          <stop offset="40%" stopColor="#1a1a2e" />
          <stop offset="100%" stopColor="#0a0a14" />
        </radialGradient>

        <radialGradient id="labelGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(262, 52%, 55%)" />
          <stop offset="100%" stopColor="hsl(262, 52%, 35%)" />
        </radialGradient>

        <linearGradient id="shineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function VinylStack({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* Background records */}
      <div className="absolute -left-4 -top-4 opacity-40 blur-[1px]">
        <VinylRecordSVG size={180} />
      </div>
      <div className="absolute -right-2 -top-2 opacity-60 blur-[0.5px]">
        <VinylRecordSVG size={190} />
      </div>
      {/* Front record */}
      <div className="relative z-10">
        <VinylRecordSVG size={200} spinning />
      </div>
    </div>
  );
}
