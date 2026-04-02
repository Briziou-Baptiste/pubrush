import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },

    headerLeft: {
      flex: 1,
      marginRight: 12,
    },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 12
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  roleBadgeCreator: {
    backgroundColor: '#DBEAFE',
  },
  roleBadgeParticipant: {
    backgroundColor: '#DCFCE7',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  roleBadgeTextCreator: {
    color: '#1D4ED8',
  },
  roleBadgeTextParticipant: {
    color: '#15803D',
  },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusBadgeSuccess: {
    backgroundColor: '#DCFCE7',
  },
  statusBadgeFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeSuccessText: {
    color: '#15803D',
  },
  statusBadgeFailedText: {
    color: '#B91C1C',
  },
    statusBadgeCancelled: {
      backgroundColor: '#E5E7EB',
    },

    statusBadgeCancelledText: {
      color: '#374151',
      fontWeight: '700',
    },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  infoBlock: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    secondaryActionButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#D1D5DB',
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryActionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#111827',
    },
    primaryActionButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: '#111827',
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryActionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },

    countdownBox: {
      marginTop: 16,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
    },
    countdownLabel: {
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 4,
    },
    countdownValue: {
      fontSize: 18,
      fontWeight: '800',
    },

    countdownNormal: {
      backgroundColor: '#EFF6FF',
      borderColor: '#BFDBFE',
    },
    countdownNormalText: {
      color: '#1D4ED8',
    },

    countdownWarning: {
      backgroundColor: '#FFF7ED',
      borderColor: '#FDBA74',
    },
    countdownWarningText: {
      color: '#C2410C',
    },

    countdownDanger: {
      backgroundColor: '#FEF2F2',
      borderColor: '#FCA5A5',
    },
    countdownDangerText: {
      color: '#B91C1C',
    },
    actionsColumn: {
      marginTop: 16,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    deleteActionButton: {

      minHeight: 46,
      borderRadius: 14,
      backgroundColor: '#FEE2E2',
      borderWidth: 1,
      borderColor: '#FCA5A5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteActionButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#B91C1C',
    },
    actionButtonDisabled: {
      opacity: 0.6,
    },
    deleteLoadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    infoButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#DBEAFE',
      alignItems: 'center',
      justifyContent: 'center',
    },

    infoButtonText: {
      color: '#2563EB',
      fontSize: 12,
      fontWeight: '700',
    },
});
