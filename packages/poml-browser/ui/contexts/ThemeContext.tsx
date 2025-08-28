/// <reference types="chrome-types" />
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMantineColorScheme } from '@mantine/core';
import { getSettings, setSettings } from '@common/settings';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: ThemeMode | undefined;
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode | undefined>(undefined);
  const { setColorScheme } = useMantineColorScheme();

  // Load theme from background worker on mount
  useEffect(() => {
    async function fetchTheme() {
      const settings = await getSettings();
      if (settings.theme && ['light', 'dark', 'auto'].includes(settings.theme)) {
        setThemeState(settings.theme);
        setColorScheme(settings.theme);
      } else {
        setThemeState('auto');
        setColorScheme('auto');
      }
    }
    fetchTheme().catch(console.error);
  }, [setColorScheme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    setColorScheme(newTheme);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
