'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  Unsubscribe 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Notification } from '@/types';

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAllAsRead: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook to manage user notifications with real-time updates
 * 
 * Features:
 * - Real-time subscription to notifications via Firestore
 * - Unread count for badge display
 * - Functions to mark notifications as read
 */
export function useNotifications(): UseNotificationsReturn {
  const { user, isLoaded } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from API (for initial load and refetch)
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/notifications?limit=30');
      if (!response.ok) {
        // Log but don't throw - gracefully handle API errors
        console.warn('[useNotifications] API returned error:', response.status);
        // Keep existing state, just stop loading
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setError(null);
    } catch (err) {
      // Gracefully handle network/fetch errors - don't crash the UI
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn('[useNotifications] Fetch error (non-critical):', errorMessage);
      // Keep existing state, just clear loading
      setError(null); // Don't show error to user for background fetches
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Set up real-time listener for notifications
  useEffect(() => {
    if (!isLoaded || !user?.id) {
      setIsLoading(false);
      return;
    }

    // Guard: Firebase not initialized
    if (!db) {
      console.warn('[useNotifications] Firebase not initialized');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Query for user's notifications
    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', user.id),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    // Subscribe to real-time updates
    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notificationsList: Notification[] = [];
        let unread = 0;

        snapshot.forEach((doc) => {
          const notification = { id: doc.id, ...doc.data() } as Notification;
          notificationsList.push(notification);
          if (!notification.read) {
            unread++;
          }
        });

        setNotifications(notificationsList);
        setUnreadCount(unread);
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        // Handle Firestore permission/index errors gracefully
        console.warn('[useNotifications] Firestore subscription error (falling back to API):', err.message);
        // Fall back to API fetch if real-time fails (e.g., missing index)
        setIsLoading(false);
        fetchNotifications();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.id, isLoaded, fetchNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id || unreadCount === 0) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }

      // Optimistically update local state
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
      // Refetch to sync state
      await fetchNotifications();
    }
  }, [user?.id, unreadCount, fetchNotifications]);

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification || notification.read) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Optimistically update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [user?.id, notifications]);

  // Delete a notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user?.id) return;

    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification) return;

    // Optimistically remove from local state
    const wasUnread = !notification.read;
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
      // Revert optimistic update on error
      setNotifications((prev) => [...prev, notification].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
      if (wasUnread) {
        setUnreadCount((prev) => prev + 1);
      }
    }
  }, [user?.id, notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAllAsRead,
    markAsRead,
    deleteNotification,
    refetch: fetchNotifications,
  };
}

export default useNotifications;

