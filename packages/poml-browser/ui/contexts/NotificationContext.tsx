/**
 * Notification Context and Provider
 * Provides a global notification system for status messages
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { registerDirectUIHandler } from '@common/notification';
import { NotificationOptions } from '@common/types';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';
export type NotificationPosition = 'top' | 'bottom';

export interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
  timestamp: Date;
  autoHide?: boolean;
  position: NotificationPosition;
}

export interface NotificationContextType {
  notifications: Notification[];
  topNotifications: Notification[];
  bottomNotifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  removeNotification: (id: string) => void;
  clearAllNotifications: (position?: NotificationPosition) => void;
  // Convenience methods with positioning
  showSuccess: (message: string, title?: string, duration?: number, position?: NotificationPosition) => string;
  showError: (message: string, title?: string, duration?: number, position?: NotificationPosition) => string;
  showWarning: (message: string, title?: string, duration?: number, position?: NotificationPosition) => string;
  showInfo: (message: string, title?: string, duration?: number, position?: NotificationPosition) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Generate unique IDs for notifications
const generateNotificationId = (): string => {
  return `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = generateNotificationId();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      autoHide: notification.autoHide !== false, // Default to true
      duration: notification.duration ?? (notification.type === 'error' ? 0 : 4000), // Errors persist, others auto-hide
      position: notification.position ?? 'top', // Default to top
    };

    setNotifications((prev) => [newNotification, ...prev]);

    // Auto-hide notification if specified
    if (newNotification.autoHide && newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const clearAllNotifications = useCallback((position?: NotificationPosition) => {
    if (position) {
      setNotifications((prev) => prev.filter((notification) => notification.position !== position));
    } else {
      setNotifications([]);
    }
  }, []);

  // Computed properties for filtered notifications
  const topNotifications = notifications.filter((n) => n.position === 'top');
  const bottomNotifications = notifications.filter((n) => n.position === 'bottom');

  // Convenience methods
  const showSuccess = useCallback(
    (message: string, title?: string, duration?: number, position: NotificationPosition = 'top') => {
      return addNotification({
        type: 'success',
        message,
        title,
        duration,
        position,
      });
    },
    [addNotification],
  );

  const showError = useCallback(
    (message: string, title?: string, duration?: number, position: NotificationPosition = 'top') => {
      return addNotification({
        type: 'error',
        message,
        title,
        duration: duration ?? 0, // Errors don't auto-hide by default
        position,
      });
    },
    [addNotification],
  );

  const showWarning = useCallback(
    (message: string, title?: string, duration?: number, position: NotificationPosition = 'top') => {
      return addNotification({
        type: 'warning',
        message,
        title,
        duration,
        position,
      });
    },
    [addNotification],
  );

  const showInfo = useCallback(
    (message: string, title?: string, duration?: number, position: NotificationPosition = 'top') => {
      return addNotification({
        type: 'info',
        message,
        title,
        duration,
        position,
      });
    },
    [addNotification],
  );

  // Register the direct UI handler when provider mounts
  useEffect(() => {
    const serviceHandler = (
      type: import('@common/types').NotificationType,
      message: string,
      options?: NotificationOptions,
    ) => {
      // Map debug types to info for UI display since NotificationContext doesn't support debug
      const mappedType: NotificationType =
        type === 'debug' || type === 'debug+' || type === 'debug++' ? 'info' : (type as NotificationType);

      addNotification({
        type: mappedType,
        message,
        title: options?.title,
        duration: options?.duration,
        autoHide: options?.autoHide,
        position: options?.position ?? (type.startsWith('debug') ? 'bottom' : 'top'),
      });
    };

    registerDirectUIHandler(serviceHandler);

    return () => {
      // No cleanup needed with the new RPC system
    };
  }, [addNotification]);

  const contextValue: NotificationContextType = {
    notifications,
    topNotifications,
    bottomNotifications,
    addNotification,
    removeNotification,
    clearAllNotifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  return <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>;
};

// Hook to use the notification context
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
