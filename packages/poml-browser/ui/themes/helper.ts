import { useMantineTheme, useMantineColorScheme } from '@mantine/core';

export function computedThemeVariables() {
  // Theme variables related to theme and color scheme
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const scale = isDark ? [...theme.colors.gray].slice(0, 10).reverse() : [...theme.colors.gray].slice(0, 10);
  theme.primaryColor;
  return {
    colors: {
      scale: scale,
      border: {
        inactive: scale[2],
        active: scale[6],
        opacity: isDark ? 0.6 : 0.3,
      },
      poml: {
        // The accent color for our app
        primary: theme.colors.pomlPrimary[theme.colors.pomlPrimary.length - 1],
        secondary: theme.colors.pomlSecondary[theme.colors.pomlSecondary.length - 1],
      },
    },
  };
}
