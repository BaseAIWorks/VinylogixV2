"use client";

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { logActivity } from '@/services/activity-service';
import type { ActivityAction, UserActivity } from '@/types';

type PendingActivity = {
  action: ActivityAction;
  details?: string;
  metadata?: UserActivity['metadata'];
};

/**
 * Hook that tracks user activity at session level.
 * - Generates a session ID
 * - Logs session_start on first render
 * - Tracks page navigations (batched)
 * - Exposes logAction for components to call
 * - Flushes pending events periodically and on unload
 */
export function useActivityTracker() {
  const { user } = useAuth();
  const pathname = usePathname();
  const sessionIdRef = useRef<string>('');
  const pendingRef = useRef<PendingActivity[]>([]);
  const lastPageRef = useRef<string>('');
  const sessionStartedRef = useRef(false);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Generate session ID once
  if (!sessionIdRef.current) {
    sessionIdRef.current = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  const flush = useCallback(async () => {
    if (!user || pendingRef.current.length === 0) return;

    const items = [...pendingRef.current];
    pendingRef.current = [];

    for (const item of items) {
      await logActivity({
        userId: user.uid,
        userEmail: user.email || '',
        userRole: user.role,
        sessionId: sessionIdRef.current,
        action: item.action,
        details: item.details,
        metadata: item.metadata,
      });
    }
  }, [user]);

  // Log session start once
  useEffect(() => {
    if (!user || sessionStartedRef.current) return;
    sessionStartedRef.current = true;

    logActivity({
      userId: user.uid,
      userEmail: user.email || '',
      userRole: user.role,
      sessionId: sessionIdRef.current,
      action: 'session_start',
      details: `Logged in as ${user.role}`,
    });
  }, [user]);

  // Track page navigations — batch similar pages
  useEffect(() => {
    if (!user || !pathname || pathname === lastPageRef.current) return;
    lastPageRef.current = pathname;

    // Don't track every page — only meaningful sections
    const section = pathname.split('/')[1] || 'home';
    const isStorefront = pathname.startsWith('/storefront/');

    if (isStorefront) {
      const slug = pathname.split('/')[2];
      pendingRef.current.push({
        action: 'collection_browse',
        details: `Browsed storefront: ${slug}`,
        metadata: { page: pathname },
      });
    }
    // Don't log every page navigation — only storefront visits are interesting
  }, [pathname, user]);

  // Flush timer — every 30 seconds
  useEffect(() => {
    flushTimerRef.current = setInterval(flush, 30_000);
    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [flush]);

  // Flush on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (pendingRef.current.length > 0 && user) {
        // Use sendBeacon for reliable delivery on unload
        const items = pendingRef.current;
        pendingRef.current = [];
        items.forEach(item => {
          logActivity({
            userId: user.uid,
            userEmail: user.email || '',
            userRole: user.role,
            sessionId: sessionIdRef.current,
            action: item.action,
            details: item.details,
            metadata: item.metadata,
          });
        });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [user]);

  /**
   * Log a specific action. Can be called from any component.
   * Events are batched and flushed periodically.
   */
  const logAction = useCallback((
    action: ActivityAction,
    details?: string,
    metadata?: UserActivity['metadata']
  ) => {
    if (!user) return;

    // For immediate actions (orders, invites), log directly
    const immediateActions: ActivityAction[] = ['order_placed', 'order_status_change', 'client_invited', 'import_completed'];
    if (immediateActions.includes(action)) {
      logActivity({
        userId: user.uid,
        userEmail: user.email || '',
        userRole: user.role,
        sessionId: sessionIdRef.current,
        action,
        details,
        metadata,
      });
      return;
    }

    // Otherwise batch it
    pendingRef.current.push({ action, details, metadata });
  }, [user]);

  return { logAction, sessionId: sessionIdRef.current };
}
