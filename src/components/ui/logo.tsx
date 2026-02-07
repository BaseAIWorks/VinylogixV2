'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({ width = 140, height = 32, className = '', priority = false }: LogoProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme
    const checkTheme = () => {
      const html = document.documentElement;
      const hasDarkTheme = html.classList.contains('theme-dark') || html.classList.contains('theme-black');
      setIsDark(hasDarkTheme);
    };

    checkTheme();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  return (
    <Image
      src={isDark ? '/logo_v2_White.png' : '/logo_v2_Black.png'}
      alt="Vinylogix"
      width={width}
      height={height}
      className={`h-auto w-auto ${className}`}
      style={{ maxHeight: `${height}px` }}
      unoptimized
      priority={priority}
    />
  );
}
