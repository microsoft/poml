/// <reference types="chrome-types" />
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMantineColorScheme } from '@mantine/core';

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
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime
        .sendMessage({ action: 'getTheme' })
        .then((response: any) => {
          if (response && response.success && response.theme) {
            const savedTheme = response.theme as ThemeMode;
            if (['light', 'dark', 'auto'].includes(savedTheme)) {
              setThemeState(savedTheme);
              setColorScheme(savedTheme);
            }
          } else {
            // Set default theme if none is saved
            setThemeState('auto');
            setColorScheme('auto');
          }
        })
        .catch(() => {
          // Fallback if message fails
          setThemeState('auto');
          setColorScheme('auto');
        });
    } else {
      // Fallback for non-extension environments
      setThemeState('auto');
      setColorScheme('auto');
    }
  }, [setColorScheme]);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    setColorScheme(newTheme);

    // Save to storage via background worker
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime
        .sendMessage({ action: 'setTheme', theme: newTheme })
        .then((response: any) => {
          if (!response || !response.success) {
            console.error('Failed to save theme:', response?.error);
          }
        })
        .catch((error) => {
          console.error('Failed to send theme message:', error);
        });
    }
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
