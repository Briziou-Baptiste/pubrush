import { type ReactNode, useMemo, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { isSheetDrag, sheetCollapsedAfterDrag } from '../services/mapLayout.service';

type Props = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  count: number;
  children: ReactNode;
  attribution: ReactNode;
  style: StyleProp<ViewStyle>;
  onLayout: (event: LayoutChangeEvent) => void;
};

export default function RouteSummarySheet({ collapsed, onCollapsedChange, count, children, attribution, style, onLayout }: Props) {
  const offset = useRef(new Animated.Value(0)).current;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => isSheetDrag(gesture.dx, gesture.dy),
    onMoveShouldSetPanResponder: (_, gesture) => isSheetDrag(gesture.dx, gesture.dy),
    onPanResponderMove: (_, gesture) => offset.setValue(Math.max(0, Math.min(140, gesture.dy))),
    onPanResponderRelease: (_, gesture) => {
      onCollapsedChange(sheetCollapsedAfterDrag(collapsed, gesture.dy));
      Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start(),
  }), [collapsed, onCollapsedChange, offset]);
  return (
    <Animated.View style={[style, { transform: [{ translateY: offset }] }]} onLayout={onLayout}>
      <View {...pan.panHandlers}>
        <TouchableOpacity
          style={styles.header}
          accessibilityRole="button"
          accessibilityLabel={`${collapsed ? 'Déplier' : 'Replier'} le parcours, ${count} lieux sélectionnés`}
          accessibilityState={{ expanded: !collapsed }}
          onPress={() => onCollapsedChange(!collapsed)}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>{`Parcours (${count}) · ${collapsed ? 'Déplier ↑' : 'Replier ↓'}`}</Text>
        </TouchableOpacity>
      </View>
      {/* Keep the list/form mounted so collapsing never resets its local state. */}
      <View style={{ display: collapsed ? 'none' : 'flex', flexShrink: 1 }}>{children}</View>
      {attribution}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingBottom: 8, gap: 8 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1' },
  title: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
});
