import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../theme';

export function Loading({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.primary} />
      {label ? (
        <Text style={[styles.msg, { color: theme.text3 }]}>{label}</Text>
      ) : null}
    </View>
  );
}

export function Message({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {detail ? (
        <Text style={[styles.msg, { color: theme.text3 }]}>{detail}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          style={[styles.btn, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.btnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  msg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
