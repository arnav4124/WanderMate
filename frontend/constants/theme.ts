import { Platform } from 'react-native';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const LightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1B6EF3',
    primaryContainer: '#D6E3FF',
    secondary: '#00BFA6',
    secondaryContainer: '#C8FFF4',
    tertiary: '#FF6B6B',
    tertiaryContainer: '#FFE0E0',
    surface: '#FAFCFF',
    surfaceVariant: '#E8EFF9',
    background: '#F5F8FF',
    error: '#FF5252',
    onPrimary: '#FFFFFF',
    onSecondary: '#FFFFFF',
    onSurface: '#1A1C1E',
    onSurfaceVariant: '#44474E',
    outline: '#C4C6D0',
    elevation: {
      level0: 'transparent',
      level1: '#F0F4FF',
      level2: '#E8EEFF',
      level3: '#E0E8FF',
      level4: '#D8E2FF',
      level5: '#D0DCFF',
    },
  },
};

export const DarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#A8C7FF',
    primaryContainer: '#004494',
    secondary: '#00E5CC',
    secondaryContainer: '#005247',
    tertiary: '#FFB4AB',
    tertiaryContainer: '#93000A',
    surface: '#111318',
    surfaceVariant: '#2A2D35',
    background: '#0E1117',
    error: '#FFB4AB',
    onPrimary: '#002D6E',
    onSecondary: '#003731',
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
    background: '#F5F8FF',
    tint: '#1B6EF3',
    icon: '#44474E',
    tabIconDefault: '#C4C6D0',
    tabIconSelected: '#1B6EF3',
  },
  dark: {
    text: '#E2E2E6',
    background: '#0E1117',
    tint: '#A8C7FF',
    icon: '#C4C6D0',
    tabIconDefault: '#8E9099',
    tabIconSelected: '#A8C7FF',
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
