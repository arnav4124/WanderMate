import { Platform } from 'react-native';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#356934',
    primaryContainer: '#E5EFE6',
    secondary: '#C67D55',
    secondaryContainer: '#F2DFD3',
    tertiary: '#F2F4F2',
    tertiaryContainer: '#E2E6E2',
    surface: '#FFFFFF',
    surfaceVariant: '#F7F9F7',
    background: '#F8F9FA',
    error: '#BA1A1A',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#1A1C1E',
    onSurfaceVariant: '#44474E',
    outline: '#C4C6D0',
    elevation: {
      level0: 'transparent',
      level1: '#F0F4F0',
      level2: '#E8EFE8',
      level3: '#E0EAE0',
      level4: '#D8E5D8',
      level5: '#D0E0D0',
    },
  },
};

export const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#356934',
    primaryContainer: '#E5EFE6',
    secondary: '#C67D55',
    secondaryContainer: '#F2DFD3',
    tertiary: '#F2F4F2',
    tertiaryContainer: '#E2E6E2',
    surface: '#1A1C1E',
    surfaceVariant: '#2A2D35',
    background: '#0E1117',
    error: '#FFB4AB',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#E2E2E6',
    onSurfaceVariant: '#C4C6D0',
    outline: '#8E9099',
    elevation: {
      level0: 'transparent',
      level1: '#1A1D24',
      level2: '#20232B',
      level3: '#252832',
      level4: '#2A2D38',
      level5: '#2F323E',
    },
  },
};

export const Colors = {
  light: {
    text: '#1A1C1E',
    background: '#F8F9FA',
    tint: '#356934',
    icon: '#44474E',
    tabIconDefault: '#C4C6D0',
    tabIconSelected: '#356934',
  },
  dark: {
    text: '#E2E2E6',
    background: '#0E1117',
    tint: '#9ECA9A',
    icon: '#C4C6D0',
    tabIconDefault: '#8E9099',
    tabIconSelected: '#9ECA9A',
  },
};

export const CategoryColors: Record<string, string> = {
  accommodation: '#6C63FF',
  food: '#FF6B6B',
  transport: '#4ECDC4',
  activities: '#FFD93D',
  other: '#95E1D3',
  hotel: '#6C63FF',
  restaurant: '#FF6B6B',
  landmark: '#FFD93D',
  activity: '#4ECDC4',
};

export const CategoryIcons: Record<string, string> = {
  accommodation: 'bed',
  food: 'food',
  transport: 'car',
  activities: 'hiking',
  other: 'dots-horizontal',
  hotel: 'bed',
  restaurant: 'food',
  landmark: 'map-marker-star',
  activity: 'run',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
