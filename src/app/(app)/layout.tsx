
"use client";

import ProtectedRoute from "@/components/layout/protected-route";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const THEME_STORAGE_KEY = 'vinyl_db_theme';

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Apply user's stored theme preference when entering the dashboard
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'black') {
      document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-black');
      document.documentElement.classList.add(`theme-${storedTheme}`);
    }
  }, []);

  // If we are on the presentation page, render the children directly
  // without the ProtectedRoute which includes the AppLayout.
  if (pathname === '/inventory/presentation') {
    return <>{children}</>;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
