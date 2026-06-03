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

  successText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 20,
  },
  debtorCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debtorText: {
    fontWeight: '700',
    color: '#B91C1C',
    fontSize: 14,
  },
  debtorAmount: {
    fontWeight: '900',
    color: '#B91C1C',
    fontSize: 16,
  },
  creditorCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creditorText: {
    fontWeight: '700',
    color: '#15803D',
    fontSize: 14,
  },
  creditorAmount: {
    fontWeight: '900',
    color: '#15803D',
    fontSize: 16,
  },
  neutralCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  neutralText: {
    fontWeight: '600',
    color: '#4B5563',
    fontSize: 14,
  },
  neutralAmount: {
    fontWeight: '800',
    color: '#4B5563',
    fontSize: 15,
  },
  expenseTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  expenseTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  expenseSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 3,
  },
  expenseAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#10B981',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  modalErrorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#111827',
  },
  modalButtonCancelText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 14,
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
