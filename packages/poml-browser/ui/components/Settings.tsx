import React, { useState, useEffect } from 'react';
import { Stack, Text, Select, Paper, Group, ActionIcon } from '@mantine/core';
import { IconArrowLeft, IconPalette, IconBell } from '@tabler/icons-react';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { NotificationLevel, SettingsBundle } from '@common/types';
import { getSettings, setSettings } from '@common/settings';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();
  const [uiNotificationLevel, setUiNotificationLevel] = useState<NotificationLevel>('warning');
  const [consoleNotificationLevel, setConsoleNotificationLevel] = useState<NotificationLevel>('warning');

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Follow System' },
  ];

  const notificationLevelOptions = [
    { value: 'important', label: 'Important (Error and Success)' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' },
    { value: 'debug', label: 'Debug' },
    { value: 'debug+', label: 'Debug Verbose' },
    { value: 'debug++', label: 'Debug More Verbose' },
  ];

  // Load all settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getSettings();
        if (settings.theme) {
          setTheme(settings.theme);
        }
        if (settings.uiNotificationLevel) {
          setUiNotificationLevel(settings.uiNotificationLevel);
        }
        if (settings.consoleNotificationLevel) {
          setConsoleNotificationLevel(settings.consoleNotificationLevel);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Use defaults if loading fails
      }
    };

    loadSettings();
  }, [setTheme]);

  const saveSettings = async (updatedSettings: Partial<SettingsBundle>) => {
    try {
      await setSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleThemeChange = (value: string | null) => {
    if (value && ['light', 'dark', 'auto'].includes(value)) {
      const newTheme = value as ThemeMode;
      setTheme(newTheme);
      saveSettings({ theme: newTheme });
    }
  };

  const handleUiNotificationLevelChange = (value: string | null) => {
    if (value && ['important', 'warning', 'info', 'debug', 'debug+', 'debug++'].includes(value)) {
      const level = value as NotificationLevel;
      setUiNotificationLevel(level);
      saveSettings({ uiNotificationLevel: level });
    }
  };

  const handleConsoleNotificationLevelChange = (value: string | null) => {
    if (value && ['important', 'warning', 'info', 'debug', 'debug+', 'debug++'].includes(value)) {
      const level = value as NotificationLevel;
      setConsoleNotificationLevel(level);
      saveSettings({ consoleNotificationLevel: level });
    }
  };

  return (
    <Stack gap='md' style={{ padding: '16px' }}>
      {/* Header */}
      <Group>
        <ActionIcon variant='subtle' size='sm' onClick={onBack} aria-label='Back'>
          <IconArrowLeft size={16} />
        </ActionIcon>
        <Text size='lg' fw={600}>
          Settings
        </Text>
      </Group>

      {/* Theme Settings */}
      <Paper p='md' withBorder>
        <Stack gap='sm'>
          <Group gap='xs'>
            <IconPalette size={20} />
            <Text fw={500}>Theme</Text>
          </Group>
          <Text size='sm' c='dimmed'>
            Choose how the extension should appear
          </Text>
          <Select
            value={theme}
            onChange={handleThemeChange}
            data={themeOptions}
            placeholder='Select theme'
            allowDeselect={false}
          />
        </Stack>
      </Paper>

      {/* Notification Settings */}
      <Paper p='md' withBorder>
        <Stack gap='sm'>
          <Group gap='xs'>
            <IconBell size={20} />
            <Text fw={500}>Notifications</Text>
          </Group>
          <Text size='sm' c='dimmed'>
            Configure notification levels for UI and console logging
          </Text>

          <Stack gap='sm'>
            <div>
              <Text size='sm' fw={500} mb='xs'>
                UI Notification Level
              </Text>
              <Select
                value={uiNotificationLevel}
                onChange={handleUiNotificationLevelChange}
                data={notificationLevelOptions}
                placeholder='Select UI notification level'
                allowDeselect={false}
              />
            </div>

            <div>
              <Text size='sm' fw={500} mb='xs'>
                Console Notification Level
              </Text>
              <Select
                value={consoleNotificationLevel}
                onChange={handleConsoleNotificationLevelChange}
                data={notificationLevelOptions}
                placeholder='Select console notification level'
                allowDeselect={false}
              />
            </div>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default Settings;
