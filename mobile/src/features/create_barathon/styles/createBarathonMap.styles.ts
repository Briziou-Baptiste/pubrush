import { StyleSheet } from 'react-native';

export const createBarathonMapStyles = StyleSheet.create({
  metaText: {
    marginTop: 2,
    color: '#5E687A',
    fontSize: 12,
    fontWeight: '500',
  },

  bottomSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    maxHeight: 280,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 35,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 8,
  },

  sheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },

  pointsList: {
    maxHeight: 150,
  },

  pointsListContent: {
    gap: 8,
    paddingBottom: 6,
  },

  emptyCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
  },

  emptyTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },

  emptySubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },

  pointCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 19,
    padding: 10,
  },

  pointCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  pointIndex: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22C55E',
  },

  removeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },

  pointName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },

  pointCoords: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },

  createButton: {
    marginTop: 12,
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  createButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color: '#111827',
  },

  modalCoords: {
    marginBottom: 12,
    color: '#6B7280',
    fontSize: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
    color: '#111827',
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },

  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },

    confirmButton: {
      marginLeft: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#22C55E',
    },

  confirmButtonDisabled: {
    opacity: 0.5,
  },

  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
    backButton: {
      backgroundColor: '#111111',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },

    backButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
    travelBlock: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
    },

    travelArrow: {
      fontSize: 28,
      fontWeight: '800',
      color: '#111827',
      textAlign: 'center',
      marginBottom: 4,
      lineHeight: 30,
    },

    travelTextWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    travelLine: {
      textAlign: 'center',
    },

    travelLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: '#111827',
    },

    travelValue: {
      fontSize: 14,
      fontWeight: '800',
    },
    stopTypeSelector: {
      flexDirection: 'row',
      marginBottom: 14,
    },

    stopTypeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
        marginRight: 15,
    },

    stopTypeButtonActive: {
      backgroundColor: '#111111',
    },

    stopTypeButtonSpacing: {
      marginRight: 0,
    },

    stopTypeButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#111827',
    },

    stopTypeButtonTextActive: {
      color: '#FFFFFF',
    },

    pointType: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6B7280',
      marginTop: 2,
    },
    createButtonDisabled: {
      backgroundColor: '#9CA3AF',
      opacity: 0.7,
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    optimizeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEF3C7',
      borderColor: '#F59E0B',
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
      gap: 4,
    },
    optimizeButtonText: {
      color: '#B45309',
      fontSize: 12,
      fontWeight: '700',
    },
    stepOrderControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    orderButton: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#E5E7EB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    orderButtonDisabled: {
      opacity: 0.3,
    },
    // Stepper header
    stepperHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    stepperBarMini: {
      flex: 1,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: '#E2E8F0',
    },
    stepperBarMiniActive: {
      backgroundColor: '#2563EB',
    },
    // Custom Numbered Step Markers
    customStepMarker: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepPinBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    stepPinNumber: {
      color: '#FFFFFF',
      fontWeight: '900',
      fontSize: 13,
    },
    stepPinTail: {
      width: 0,
      height: 0,
      backgroundColor: 'transparent',
      borderStyle: 'solid',
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 6,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      marginTop: -1,
    },
    // Floating Suggestion Preview Card
    suggestionCard: {
      position: 'absolute',
      bottom: 295,
      left: 14,
      right: 14,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 7,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      zIndex: 900,
    },
    suggestionCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    suggestionCardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#111827',
      flex: 1,
      marginRight: 8,
    },
    suggestionCardSub: {
      fontSize: 13,
      color: '#4B5563',
      marginBottom: 10,
    },
    suggestionCardActions: {
      flexDirection: 'row',
      gap: 8,
    },
    suggestionAddBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#2563EB',
      borderRadius: 12,
      paddingVertical: 10,
      gap: 6,
    },
    suggestionAddBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    suggestionDismissBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: '#F3F4F6',
      alignItems: 'center',
      justifyContent: 'center',
    },
    suggestionDismissBtnText: {
      color: '#6B7280',
      fontWeight: '600',
      fontSize: 13,
    },
    // Magic Auto Generator Button
    magicButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#8B5CF6',
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 5,
      gap: 4,
      shadowColor: '#8B5CF6',
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    magicButtonText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '800',
    },
    // Guidance Banner
    guidanceCard: {
      backgroundColor: '#EFF6FF',
      borderColor: '#BFDBFE',
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    guidanceText: {
      fontSize: 12,
      color: '#1E40AF',
      fontWeight: '600',
      flex: 1,
    },
});
