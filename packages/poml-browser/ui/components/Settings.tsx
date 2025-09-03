import React from 'react';
import { Stack, Text, Select, Paper, Group, ActionIcon } from '@mantine/core';
import { IconArrowLeft, IconPalette } from '@tabler/icons-react';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'auto', label: 'Follow System' },
  ];

  const handleThemeChange = (value: string | null) => {
    if (value && ['light', 'dark', 'auto'].includes(value)) {
      setTheme(value as ThemeMode);
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

      {/* Future settings can be added here */}
    </Stack>
  );
};

export default Settings;
