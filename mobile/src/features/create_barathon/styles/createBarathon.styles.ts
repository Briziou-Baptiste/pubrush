//
//  createBarathon.styles.ts
//  
//
//  Created by Baptiste Briziou on 31/03/2026.
//

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  keyboardWrapper: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 24,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  inputMultiline: {
    minHeight: 96,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  addStopButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addStopButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  stopCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 18,
    backgroundColor: '#FCFCFD',
    padding: 14,
    marginBottom: 14,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stopTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  removeStopButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  removeStopButtonText: {
    color: '#991B1B',
    fontWeight: '700',
    fontSize: 13,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  typeChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  typeChipText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitButtonDisabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
    dateInputButton: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 14,
      paddingHorizontal: 14,
      alignItems: 'flex-start',
      justifyContent: 'center',
      backgroundColor: '#F9FAFB',
    },
    dateInputButtonText: {
      fontSize: 15,
      color: '#111827',
    },

    pickerModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(17,24,39,0.35)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    pickerModalCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 24,
      overflow: 'hidden',
    },
    pickerModalHeader: {
      minHeight: 56,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pickerModalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: '#111827',
    },
    pickerHeaderButton: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    pickerHeaderButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#111827',
    },
    pickerBody: {
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
});

