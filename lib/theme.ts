// lib/theme.ts
import { MD3LightTheme } from 'react-native-paper';

export const AppTheme = {
  ...MD3LightTheme,
  roundness: 8,
  colors: {
    // IMPORTANT: spread the MD3 colors so we KEEP nested `elevation`
    ...MD3LightTheme.colors,
    // tweak brand colors without losing elevation
    primary: '#FF9800',       // your orange
    secondary: '#FF9800',
    // keep elevation intact
    elevation: { ...MD3LightTheme.colors.elevation },
  },
};
