import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },

  content: {
    padding: 16,
    paddingBottom: 48,
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 14,
  },

  statusBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },

  statusBadgeCompleted: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },

  statusTextCompleted: {
    color: '#15803D',
    fontWeight: '800',
    fontSize: 13,
  },

  statusBadgeStopped: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },

  statusTextStopped: {
    color: '#B45309',
    fontWeight: '800',
    fontSize: 13,
  },

  statusBadgePlanned: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },

  statusTextPlanned: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 13,
  },

  statusBadgeStarted: {
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },

  statusTextStarted: {
    color: '#7E22CE',
    fontWeight: '800',
    fontSize: 13,
  },

  statusBadgeFailed: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },

  statusTextFailed: {
    color: '#B91C1C',
    fontWeight: '800',
    fontSize: 13,
  },

  statusBadgeDefault: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  statusTextDefault: {
    color: '#4B5563',
    fontWeight: '800',
    fontSize: 13,
  },

  progressionSection: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  progressionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  progressionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  progressTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 10,
  },

  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  targetText: {
    fontSize: 13,
    fontWeight: '700',
  },

  targetTextSuccess: {
    color: '#059669',
  },

  targetTextMissed: {
    color: '#D97706',
  },

  targetTextUnknown: {
    color: '#6B7280',
  },

  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },

  warningText: {
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 14,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  countBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },

  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
  },

  summaryGrid: {
    gap: 12,
  },

  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  summaryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryTextGroup: {
    flex: 1,
  },

  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },

  summaryValue: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '800',
    marginTop: 2,
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

  greenText: {
    color: '#16A34A',
  },

  orangeText: {
    color: '#F59E0B',
  },

  redText: {
    color: '#DC2626',
  },

  emptyStopsText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
    paddingVertical: 8,
  },

  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },

  stopNumberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  stopNumberBadgeDone: {
    backgroundColor: '#DCFCE7',
  },

  stopNumberBadgeNotDone: {
    backgroundColor: '#FEE2E2',
  },

  stopNumberBadgeUnknown: {
    backgroundColor: '#F3F4F6',
  },

  stopTextBlock: {
    flex: 1,
  },

  stopName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  stopType: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },

  stopStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },

  stopStatusBadgeDone: {
    backgroundColor: '#DCFCE7',
  },

  stopStatusBadgeNotDone: {
    backgroundColor: '#FEE2E2',
  },

  stopStatusBadgeUnknown: {
    backgroundColor: '#F3F4F6',
  },

  stopStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  stopStatusTextDone: {
    color: '#15803D',
  },

  stopStatusTextNotDone: {
    color: '#DC2626',
  },

  stopStatusTextUnknown: {
    color: '#6B7280',
  },

  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
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
