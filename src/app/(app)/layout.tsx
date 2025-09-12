
"use client";

import ProtectedRoute from "@/components/layout/protected-route";
import { usePathname } from "next/navigation";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // If we are on the presentation page, render the children directly
  // without the ProtectedRoute which includes the AppLayout.
  if (pathname === '/inventory/presentation') {
    return <>{children}</>;
  }
  
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
