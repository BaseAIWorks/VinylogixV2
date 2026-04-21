
"use client";

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AppLayout from './app-layout';
import { useActivityTracker } from '@/hooks/use-activity-tracker';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/** Wrapper that initializes the activity tracker when user is authenticated */
function ActivityTrackerProvider({ children }: { children: React.ReactNode }) {
  useActivityTracker();
  return <>{children}</>;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!loading && !user) {
      // Preserve the page the visitor was trying to reach so the login form
      // can send them back after a successful sign-in. Skip when we're
      // already on /login (redundant) or when the path is the root (nothing
      // worth preserving).
      const qs = searchParams?.toString();
      const fullPath = qs ? `${pathname}?${qs}` : pathname;
      const next = pathname && pathname !== '/' && pathname !== '/login'
        ? `?next=${encodeURIComponent(fullPath)}`
        : '';
      router.replace(`/login${next}`);
    }
  }, [user, loading, router, pathname, searchParams]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
       <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <ActivityTrackerProvider>
        {children}
      </ActivityTrackerProvider>
    </AppLayout>
  );
}
