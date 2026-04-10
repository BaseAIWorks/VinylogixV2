'use server';

import type { SystemLog, SystemLogType, SystemLogSource, SystemLogStatus } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const SYSTEM_LOGS_COLLECTION = 'systemLogs';

const processLogTimestamps = (data: any): SystemLog => {
  const processed = { ...data };
  if (processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  if (processed.resolvedAt instanceof Timestamp) {
    processed.resolvedAt = processed.resolvedAt.toDate().toISOString();
  }
  return processed as SystemLog;
};

/**
 * Log a system event (API call, webhook, error, alert).
 * Designed to be fire-and-forget — never throws.
 */
export async function logSystemEvent(event: {
  type: SystemLogType;
  source: SystemLogSource;
  status: SystemLogStatus;
  message: string;
  metadata?: SystemLog['metadata'];
}): Promise<void> {
  try {
    const adminDb = getAdminDb();
    if (!adminDb) return;
    await adminDb.collection(SYSTEM_LOGS_COLLECTION).add({
      ...event,
      createdAt: Timestamp.now(),
      isResolved: false,
    });
  } catch (error) {
    // Silent fail — system logging should never block API routes
    console.error('Failed to log system event:', error);
  }
}

/**
 * Get recent system logs with optional filtering.
 */
export async function getRecentSystemLogs(
  count: number = 100,
  typeFilter?: SystemLogType
): Promise<SystemLog[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];

  try {
    let ref = adminDb.collection(SYSTEM_LOGS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(count);

    if (typeFilter) {
      ref = adminDb.collection(SYSTEM_LOGS_COLLECTION)
        .where('type', '==', typeFilter)
        .orderBy('createdAt', 'desc')
        .limit(count);
    }

    const snapshot = await ref.get();
    return snapshot.docs.map(doc => processLogTimestamps({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error('Failed to fetch system logs:', error);
    return [];
  }
}

/**
 * Get active (unresolved) alerts.
 */
export async function getActiveAlerts(): Promise<SystemLog[]> {
  const adminDb = getAdminDb();
  if (!adminDb) return [];

  try {
    const snapshot = await adminDb.collection(SYSTEM_LOGS_COLLECTION)
      .where('type', '==', 'system_alert')
      .where('isResolved', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(doc => processLogTimestamps({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error('Failed to fetch active alerts:', error);
    return [];
  }
}

/**
 * Resolve an alert.
 */
export async function resolveAlert(logId: string): Promise<void> {
  const adminDb = getAdminDb();
  if (!adminDb) return;

  try {
    await adminDb.collection(SYSTEM_LOGS_COLLECTION).doc(logId).update({
      isResolved: true,
      resolvedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Failed to resolve alert:', error);
  }
}

/**
 * Get system health summary (last 24 hours).
 */
export async function getSystemHealth(): Promise<{
  totalEvents: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  bySource: Record<string, { success: number; error: number }>;
  activeAlertCount: number;
}> {
  const adminDb = getAdminDb();
  if (!adminDb) return { totalEvents: 0, successCount: 0, errorCount: 0, warningCount: 0, bySource: {}, activeAlertCount: 0 };

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snapshot = await adminDb.collection(SYSTEM_LOGS_COLLECTION)
      .where('createdAt', '>=', Timestamp.fromDate(oneDayAgo))
      .get();

    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    let activeAlertCount = 0;
    const bySource: Record<string, { success: number; error: number }> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'success') successCount++;
      else if (data.status === 'error') errorCount++;
      else if (data.status === 'warning') warningCount++;

      if (data.type === 'system_alert' && !data.isResolved) activeAlertCount++;

      const source = data.source || 'unknown';
      if (!bySource[source]) bySource[source] = { success: 0, error: 0 };
      if (data.status === 'success') bySource[source].success++;
      else if (data.status === 'error') bySource[source].error++;
    });

    return {
      totalEvents: snapshot.docs.length,
      successCount,
      errorCount,
      warningCount,
      bySource,
      activeAlertCount,
    };
  } catch (error) {
    console.error('Failed to get system health:', error);
    return { totalEvents: 0, successCount: 0, errorCount: 0, warningCount: 0, bySource: {}, activeAlertCount: 0 };
  }
}
