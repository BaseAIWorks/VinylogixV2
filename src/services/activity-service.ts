"use client";

import type { UserActivity, ActivityAction } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, limit as firestoreLimit, Timestamp } from 'firebase/firestore';

const ACTIVITY_COLLECTION = 'userActivity';

const processActivityTimestamps = (data: any): UserActivity => {
  const processed = { ...data };
  if (processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  return processed as UserActivity;
};

/**
 * Log a user activity event.
 */
export async function logActivity(activity: {
  userId: string;
  userEmail: string;
  userRole: string;
  sessionId: string;
  action: ActivityAction;
  details?: string;
  metadata?: UserActivity['metadata'];
}): Promise<void> {
  try {
    await addDoc(collection(db, ACTIVITY_COLLECTION), {
      ...activity,
      createdAt: Timestamp.now(),
    });
  } catch (error) {
    // Silent fail — activity logging should never block the user
    console.error('Failed to log activity:', error);
  }
}

/**
 * Get recent activities for a specific user.
 */
export async function getUserActivities(userId: string, count: number = 50): Promise<UserActivity[]> {
  try {
    const q = query(
      collection(db, ACTIVITY_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      firestoreLimit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => processActivityTimestamps({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error('Failed to fetch user activities:', error);
    return [];
  }
}

/**
 * Get recent platform-wide activity.
 */
export async function getRecentPlatformActivity(count: number = 100): Promise<UserActivity[]> {
  try {
    const q = query(
      collection(db, ACTIVITY_COLLECTION),
      orderBy('createdAt', 'desc'),
      firestoreLimit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => processActivityTimestamps({ ...doc.data(), id: doc.id }));
  } catch (error) {
    console.error('Failed to fetch platform activity:', error);
    return [];
  }
}
