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

  backButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },

  helperText: {
    marginTop: 8,
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  roleCounter: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    fontWeight: '600',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  secondaryButtonText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  neutralButton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
    borderRadius: 16,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  neutralButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  participantName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  participantEmail: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },

  selectedRoleBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  selectedRoleBadgeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
  },

  rolesList: {
    marginTop: 12,
    gap: 8,
  },

  roleButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F9FAFB',
  },

  roleButtonSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },

  roleName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },

  roleDescription: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },

  roleNameSelected: {
    color: '#1D4ED8',
  },

  roleDescriptionSelected: {
    color: '#2563EB',
  },

  footerActions: {
    marginTop: 8,
    gap: 12,
  },

  primaryButton: {
    backgroundColor: '#22C55E',
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  primaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  emptyText: {
    fontSize: 13,
    color: '#6B7280',
  },

  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
