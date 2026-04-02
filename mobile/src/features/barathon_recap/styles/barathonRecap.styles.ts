import { StyleSheet } from 'react-native';

export const createBarathonRecapStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },

  backButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },

  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },

  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },

  row: {
    marginBottom: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 2,
  },

  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },

  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },

  searchInput: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 14,
    marginBottom: 12,
  },

  loadingWrapper: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchResultCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  searchResultUsername: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  searchResultEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },

  participantCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  participantUsername: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  participantEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },

  creatorBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22C55E',
  },

  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },

  mapWrapper: {
    overflow: 'hidden',
    borderRadius: 18,
    marginTop: 6,
  },

  mapPreview: {
    width: '100%',
    height: 240,
  },

  stopList: {
    marginTop: 14,
  },

  stopCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  stopIndex: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22C55E',
    marginBottom: 4,
  },

  stopName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },

  stopType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 3,
  },

  stopCoords: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },

  submitButton: {
    backgroundColor: '#22C55E',
    borderRadius: 18,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  submitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  helperText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
  },

  emptyText: {
    fontSize: 13,
    color: '#6B7280',
  },
});
