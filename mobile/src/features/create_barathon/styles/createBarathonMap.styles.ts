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
});
