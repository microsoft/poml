/**
 * Bottom Notifications Component
 * Inline notifications appended to the bottom of the content area
 */

import React from 'react';
import { Box, Text, Group, ActionIcon, Stack, Alert, Transition, useMantineColorScheme } from '@mantine/core';
import { IconX, IconCheck, IconExclamationCircle, IconAlertCircle, IconInfoCircle } from '@tabler/icons-react';
import { useNotifications, Notification, NotificationType } from '../contexts/NotificationContext';

// Icon and color mapping using Mantine theme colors
const getNotificationConfig = (type: NotificationType) => {
  const configs = {
    success: {
      icon: IconCheck,
      color: 'green',
      variant: 'light' as const,
    },
    error: {
      icon: IconAlertCircle,
      color: 'red',
      variant: 'light' as const,
    },
    warning: {
      icon: IconExclamationCircle,
      color: 'yellow',
      variant: 'light' as const,
    },
    info: {
      icon: IconInfoCircle,
      color: 'blue',
      variant: 'light' as const,
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
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Alert
      variant={config.variant}
      color={config.color}
      icon={<IconComponent size={16} />}
      withCloseButton={false}
      mb='sm'
      style={{
        backdropFilter: 'blur(8px)',
        backgroundColor: isDark ? 'rgba(26, 27, 30, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(0, 0, 0, 0.05)',
      }}>
      <Group justify='space-between' align='flex-start'>
        <Box style={{ flex: 1 }}>
          {notification.title && (
            <Text fw={600} size='sm' mb={4}>
              {notification.title}
            </Text>
          )}
          <Text size='sm'>{notification.message}</Text>
          <Text size='xs' c='dimmed' mt={4}>
            {notification.timestamp.toLocaleTimeString()}
          </Text>
        </Box>

        <ActionIcon variant='subtle' color='gray' size='sm' onClick={() => onRemove(notification.id)} ml='xs'>
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </Alert>
  );
};

export const BottomNotifications: React.FC = () => {
  const { bottomNotifications, removeNotification, clearAllNotifications } = useNotifications();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  if (bottomNotifications.length === 0) {
    return null;
  }

  const glassStyle = {
    backdropFilter: 'blur(8px)',
    backgroundColor: isDark ? 'rgba(26, 27, 30, 0.65)' : 'rgba(255, 255, 255, 0.65)',
    border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.15)' : '0 4px 16px rgba(0, 0, 0, 0.05)',
  };

  return (
    <Box mt='lg'>
      {/* Header with clear all button if more than 3 notifications */}
      {bottomNotifications.length > 3 && (
        <Alert variant='light' color='gray' mb='sm' style={glassStyle}>
          <Group justify='space-between' align='center'>
            <Text size='sm' fw={500}>
              Status Messages ({bottomNotifications.length})
            </Text>
            <ActionIcon variant='subtle' size='sm' color='gray' onClick={() => clearAllNotifications('bottom')}>
              <IconX size={14} />
            </ActionIcon>
          </Group>
        </Alert>
      )}

      {/* Notification list with transitions */}
      <Stack gap='xs'>
        {bottomNotifications.map((notification) => (
          <Transition
            key={notification.id}
            mounted={true}
            transition='slide-up'
            duration={300}
            timingFunction='ease-out'>
            {(styles) => (
              <div style={styles}>
                <NotificationItem notification={notification} onRemove={removeNotification} />
              </div>
            )}
          </Transition>
        ))}
      </Stack>
    </Box>
  );
};

export default BottomNotifications;
