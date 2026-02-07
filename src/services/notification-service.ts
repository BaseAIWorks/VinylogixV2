
"use client";

import type { AppNotification, VinylRecord, User, Distributor } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, Timestamp } from 'firebase/firestore';
import { getDistributorById } from './distributor-service';

const NOTIFICATIONS_COLLECTION = 'notifications';

const processNotificationTimestamps = (notificationData: any): AppNotification => {
  const processed = { ...notificationData };
  if (processed.createdAt && processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  return processed as AppNotification;
};

export async function handleLowStockNotification(record: VinylRecord, actingUser: User): Promise<void> {
    if (!actingUser.distributorId || !record.isInventoryItem) return;

    const distributor = await getDistributorById(actingUser.distributorId);
    if (!distributor || !distributor.lowStockNotificationsEnabled || typeof distributor.lowStockThreshold !== 'number') {
        return; // Notifications disabled or not configured for this distributor
    }

    const totalStock = (record.stock_shelves || 0) + (record.stock_storage || 0);
    const notificationsCollectionRef = collection(db, NOTIFICATIONS_COLLECTION);

    const q = query(
        notificationsCollectionRef,
        where("distributorId", "==", actingUser.distributorId),
        where("recordId", "==", record.id),
        where("isRead", "==", false),
        where("type", "==", "low_stock")
    );
    const existingNotifications = await getDocs(q);

    if (totalStock <= distributor.lowStockThreshold) {
        // Stock is low. Create a notification if an unread one doesn't already exist.
        if (existingNotifications.empty) {
            const newNotificationData = {
                distributorId: actingUser.distributorId,
                type: 'low_stock' as const,
                message: `Stock for "${record.title}" is low.`,
                recordId: record.id,
                recordTitle: record.title,
                remainingStock: totalStock,
                createdAt: Timestamp.now(),
                isRead: false,
            };
            await addDoc(notificationsCollectionRef, newNotificationData);
        }
    } else {
        // Stock is NOT low. Resolve any existing unread notifications for this record by marking them as read.
        if (!existingNotifications.empty) {
            const updates = existingNotifications.docs.map(docSnap => 
                updateDoc(doc(db, NOTIFICATIONS_COLLECTION, docSnap.id), { isRead: true })
            );
            await Promise.all(updates);
        }
    }
}

export async function getNotifications(user: User): Promise<AppNotification[]> {
    if (!user.distributorId) return [];
    
    const notificationsCollectionRef = collection(db, NOTIFICATIONS_COLLECTION);
    const q = query(
        notificationsCollectionRef,
        where("distributorId", "==", user.distributorId)
    );
    
    const querySnapshot = await getDocs(q);
    const notifications = querySnapshot.docs.map(docSnap => processNotificationTimestamps({ ...docSnap.data(), id: docSnap.id }));
    
    return notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
    // In a real app, you would also check if the user has permission to read this notification (i.e., same distributorId)
    const notificationDocRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    try {
        await updateDoc(notificationDocRef, { isRead: true });
        return true;
    } catch (error) {
        console.error(`NotificationService: Failed to mark notification ${notificationId} as read.`, error);
        return false;
    }
}

export async function markAllNotificationsAsRead(user: User): Promise<boolean> {
    if (!user.distributorId) return false;

    const notificationsCollectionRef = collection(db, NOTIFICATIONS_COLLECTION);
    const q = query(
        notificationsCollectionRef,
        where("distributorId", "==", user.distributorId),
        where("isRead", "==", false)
    );

    try {
        const querySnapshot = await getDocs(q);
        const updates = querySnapshot.docs.map(docSnap =>
            updateDoc(doc(db, NOTIFICATIONS_COLLECTION, docSnap.id), { isRead: true })
        );
        await Promise.all(updates);
        return true;
    } catch (error) {
        console.error("NotificationService: Failed to mark all notifications as read.", error);
        return false;
    }
}

export async function deleteNotification(notificationId: string): Promise<boolean> {
    const notificationDocRef = doc(db, NOTIFICATIONS_COLLECTION, notificationId);
    try {
        const { deleteDoc: deleteDocFn } = await import('firebase/firestore');
        await deleteDocFn(notificationDocRef);
        return true;
    } catch (error) {
        console.error(`NotificationService: Failed to delete notification ${notificationId}.`, error);
        return false;
    }
}
