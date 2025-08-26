/**
 * Top Notifications Component
 * Fixed overlay notifications at the top of the screen
 */

import React from 'react';
import { Box, Alert, Text, Group, ActionIcon, Stack, Portal, Transition } from '@mantine/core';
import { IconX, IconCheck, IconExclamationCircle, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { useNotifications, Notification, NotificationType } from '../contexts/NotificationContext';

// Icon and color mapping using Mantine theme colors
const getNotificationConfig = (type: NotificationType) => {
  const configs = {
    success: {
      icon: IconCheck,
      color: 'green',
      variant: 'outline' as const,
    },
    error: {
      icon: IconAlertCircle,
      color: 'red',
      variant: 'outline' as const,
    },
    warning: {
      icon: IconExclamationCircle,
      color: 'yellow',
      variant: 'outline' as const,
    },
    info: {
      icon: IconInfoCircle,
      color: 'blue',
      variant: 'outline' as const,
    },
  };

  return configs[type];
};

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onRemove }) => {
  const config = getNotificationConfig(notification.type);
  const IconComponent = config.icon;

  return (
    <Alert
      variant={config.variant}
      color={config.color}
      icon={<IconComponent size={16} />}
      withCloseButton={false}
      mb='sm'
      style={{
        wordBreak: 'break-word',
        overflow: 'hidden',
        backdropFilter: 'blur(12px)',
      }}>
      <Group justify='space-between' align='flex-start' wrap='nowrap'>
        <Box style={{ flex: 1, minWidth: 0 }}>
          {notification.title && (
            <Text
              fw={600}
              size='sm'
              mb={2}
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              {notification.title}
            </Text>
          )}
          <Text
            size='sm'
            style={{
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              overflow: 'hidden',
            }}>
            {notification.message}
          </Text>
          <Text size='xs' c='dimmed' mt={4}>
            {notification.timestamp.toLocaleTimeString()}
          </Text>
        </Box>

        <ActionIcon
          variant='subtle'
          color='gray'
          size='sm'
          onClick={() => onRemove(notification.id)}
          ml='xs'
          style={{ flexShrink: 0 }}>
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </Alert>
  );
};

export const TopNotifications: React.FC = () => {
  const { topNotifications, removeNotification, clearAllNotifications } = useNotifications();

  if (topNotifications.length === 0) {
    return null;
  }

  return (
    <Portal>
      <Box
        pos='fixed'
        top={16}
        left='50%'
        style={{
          zIndex: 10000,
          maxWidth: '400px',
          width: 'calc(100% - 32px)',
          maxHeight: '60vh',
          overflowY: 'auto',
          pointerEvents: 'none',
          transform: 'translateX(-50%)',
        }}>
        <Box style={{ pointerEvents: 'auto' }}>
          {/* Header with clear all button if more than 2 notifications */}
          {topNotifications.length > 2 && (
            <Alert variant='outline' color='gray' mb='sm'>
              <Group justify='space-between' align='center'>
                <Text size='sm' fw={500}>
                  Notifications ({topNotifications.length})
                </Text>
                <ActionIcon variant='subtle' size='sm' color='gray' onClick={() => clearAllNotifications('top')}>
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            </Alert>
          )}

          {/* Notification list with transitions */}
          <Stack gap='xs'>
            {topNotifications.slice(0, 8).map((notification) => (
              <NotificationItem key={notification.id} notification={notification} onRemove={removeNotification} />
            ))}

            {/* Show indicator if there are more than 8 notifications */}
            {topNotifications.length > 8 && (
              <Alert variant='outline' color='gray'>
                <Text size='xs' ta='center'>
                  ... and {topNotifications.length - 8} more notifications
                </Text>
              </Alert>
            )}
          </Stack>
        </Box>
      </Box>
    </Portal>
  );
};

export default TopNotifications;
