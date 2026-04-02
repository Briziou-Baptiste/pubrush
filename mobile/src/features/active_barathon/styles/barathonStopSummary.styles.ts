import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  content: {
    padding: 16,
    paddingBottom: 32,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },

  row: {
    marginBottom: 10,
  },

  label: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
  },

  value: {
    marginTop: 4,
    fontSize: 16,
    color: '#111827',
    fontWeight: '800',
  },

  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  stopStatus: {
    width: 70,
    fontSize: 13,
    fontWeight: '900',
  },

  stopTextBlock: {
    flex: 1,
  },

  stopName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },

  stopType: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },

  greenText: {
    color: '#16A34A',
  },

  orangeText: {
    color: '#F59E0B',
  },

  redText: {
    color: '#DC2626',
  },

  primaryButton: {
    backgroundColor: '#111827',
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
