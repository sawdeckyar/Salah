import { type ReactNode, useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/**
 * A lightweight draggable bottom sheet — no extra native deps. Drag the handle
 * (or it snaps on release) between a collapsed "peek" and an expanded height.
 * Content scrolls independently of the drag gesture.
 */
export function BottomSheet({
  header,
  children,
  collapsedRatio = 0.34,
  expandedRatio = 0.82,
}: {
  header?: ReactNode;
  children: ReactNode;
  collapsedRatio?: number;
  expandedRatio?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const expandedH = Math.round(screenH * expandedRatio);
  const collapsedH = Math.round(screenH * collapsedRatio);
  const maxTranslate = expandedH - collapsedH; // collapsed = pushed down by this

  const translateY = useRef(new Animated.Value(maxTranslate)).current;
  const offset = useRef(maxTranslate);

  const snapTo = (to: number) => {
    offset.current = to;
    Animated.spring(translateY, {
      toValue: to,
      useNativeDriver: true,
      bounciness: 2,
      speed: 14,
    }).start();
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_e, g) => {
          const next = Math.min(
            maxTranslate,
            Math.max(0, offset.current + g.dy),
          );
          translateY.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          const current = Math.min(
            maxTranslate,
            Math.max(0, offset.current + g.dy),
          );
          // Snap by velocity, else by nearest half.
          if (g.vy < -0.5) snapTo(0);
          else if (g.vy > 0.5) snapTo(maxTranslate);
          else snapTo(current < maxTranslate / 2 ? 0 : maxTranslate);
        },
      }),
    [maxTranslate],
  );

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          height: expandedH,
          backgroundColor: theme.surface,
          borderColor: theme.border,
          transform: [{ translateY }],
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View {...pan.panHandlers} style={styles.handleArea}>
        <View style={[styles.grabber, { backgroundColor: theme.border }]} />
        {header}
      </View>
      <View style={styles.body}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 12,
  },
  handleArea: { paddingTop: 8, paddingHorizontal: 16, paddingBottom: 4 },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 8,
  },
  body: { flex: 1 },
});
