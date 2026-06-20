import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
}

export function Screen({
  title,
  subtitle,
  children,
  onRefresh,
  refreshing,
  scroll = true,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const header = title ? (
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.text3 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  ) : null;

  const content = (
    <>
      {header}
      {children}
    </>
  );

  if (!scroll) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.bg, paddingTop: insets.top + 8 },
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + 8 },
      ]}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        ) : undefined
      }
    >
      {content}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 2 },
});
