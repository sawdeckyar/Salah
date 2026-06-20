import { useColorScheme } from 'react-native';

/** Salah palette — a calm mosque-green primary with light/dark surfaces. */
export interface Theme {
  dark: boolean;
  primary: string;
  primaryMuted: string;
  accent: string;
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text2: string;
  text3: string;
  success: string;
  warning: string;
  danger: string;
}

const light: Theme = {
  dark: false,
  primary: '#0E7C66',
  primaryMuted: '#D7EFE9',
  accent: '#C9A227',
  bg: '#F6F7F5',
  surface: '#FFFFFF',
  surface2: '#EEF1EF',
  border: '#E2E6E3',
  text: '#13231F',
  text2: '#4B5A55',
  text3: '#8A968F',
  success: '#0E7C66',
  warning: '#B45309',
  danger: '#B91C1C',
};

const dark: Theme = {
  dark: true,
  primary: '#3CC9A7',
  primaryMuted: '#123A33',
  accent: '#E0B83A',
  bg: '#0C1411',
  surface: '#13201C',
  surface2: '#1B2A25',
  border: '#26352F',
  text: '#EAF2EF',
  text2: '#A9B8B2',
  text3: '#6E7E78',
  success: '#3CC9A7',
  warning: '#F59E0B',
  danger: '#F87171',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
