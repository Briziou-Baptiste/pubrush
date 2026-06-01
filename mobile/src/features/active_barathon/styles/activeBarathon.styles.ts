import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  container: {
    flex: 1,
  },

  map: {
    flex: 1,
  },

  topOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },

  headerCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },

  phaseText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },

  bottomOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    gap: 12,
  },

  panelCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  panelTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },

  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    marginTop: 6,
    backgroundColor: '#F9FAFB',
  },

  value: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 2,
  },

  timerCardValue: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },

  timerNormal: {
    color: '#22C55E',
  },

  timerWarning: {
    color: '#F59E0B',
  },

  timerDanger: {
    color: '#EF4444',
  },

  googleMapsButton: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleMapsButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  nextStepButton: {
    marginTop: 12,
    backgroundColor: '#2563EB',
    borderRadius: 16,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  nextStepButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  row: {
    marginBottom: 10,
  },
    headerTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },

    headerTextBlock: {
      flex: 1,
    },

    /* ===== BOUTON STOP ===== */

    stopButton: {
      backgroundColor: '#EF4444',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      shadowColor: '#EF4444',
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },

    stopButtonText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },

    /* ===== CHRONO ===== */

    timerContainer: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E7EB',
      alignItems: 'center',
    },

    timerLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: '#6B7280',
    },

    timerValue: {
      marginTop: 6,
      fontSize: 36,
      fontWeight: '900',
      letterSpacing: 1,
    },

    timerGreen: {
      color: '#22C55E',
    },

    timerOrange: {
      color: '#F59E0B',
    },

    timerRed: {
      color: '#EF4444',
    },
    stopModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },

    stopModalCard: {
      width: '100%',
      backgroundColor: '#FFFFFF',
      borderRadius: 22,
      padding: 20,
    },

    stopModalTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: '#111827',
    },

    stopModalText: {
      marginTop: 8,
      fontSize: 14,
      color: '#6B7280',
      lineHeight: 20,
    },

    stopModalButtonsRow: {
      flexDirection: 'row',
      marginTop: 18,
      gap: 10,
    },

    stopModalCancelButton: {
      flex: 1,
      backgroundColor: '#E5E7EB',
      borderRadius: 14,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },

    stopModalCancelButtonText: {
      color: '#374151',
      fontSize: 14,
      fontWeight: '800',
    },

    stopModalConfirmButton: {
      flex: 1,
      backgroundColor: '#EF4444',
      borderRadius: 14,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },

    stopModalConfirmButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

    expensesButton: {
      marginTop: 12,
      backgroundColor: '#10B981',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#10B981',
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    expensesButtonText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },

    expenseCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },

    expenseInfo: {
      flex: 1,
    },

    expenseTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#1F2937',
    },

    expenseSub: {
      fontSize: 12,
      color: '#6B7280',
      marginTop: 2,
    },

    expenseAmountText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#10B981',
    },

    balanceCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      marginBottom: 16,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
    },

    balanceName: {
      fontSize: 15,
      fontWeight: '600',
      color: '#374151',
    },

    balancePositive: {
      fontSize: 15,
      fontWeight: '800',
      color: '#10B981',
    },

    balanceNegative: {
      fontSize: 15,
      fontWeight: '800',
      color: '#EF4444',
    },

    balanceNeutral: {
      fontSize: 15,
      fontWeight: '800',
      color: '#6B7280',
    },
});
