import { StyleSheet } from 'react-native';

export const navigationControlStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  title: { flex: 1 },
  close: {
    flexShrink: 0, minWidth: 48, minHeight: 48, borderRadius: 16, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', padding: 10,
  },
  action: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
