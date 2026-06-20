import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 10,
  },
  currentText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 14,
  },
  pickerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    width: '100%',
  },
  timeSelectButton: {
    width: '100%',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 10,
    marginTop: 8,
  },
  timeSelectButtonText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  timeSelectHelperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },
  previewText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.65,
  },
});
