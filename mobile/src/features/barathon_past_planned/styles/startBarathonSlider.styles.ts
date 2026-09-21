import { StyleSheet } from 'react-native';

const TRACK_HEIGHT = 58;
const THUMB_SIZE = 50;

export const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    minHeight: 80,
    paddingTop: 8,
    paddingBottom: 16,
    position: 'relative',
    zIndex: 20,
  },

  track: {
    width: '100%',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#D1FAE5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  trackDisabled: {
    opacity: 0.55,
    backgroundColor: '#E5E7EB',
    borderColor: '#D1D5DB',
  },

  trackCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
  },

  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#10B981',
  },

  trackFillCompleted: {
    backgroundColor: '#059669',
  },

  trackLabel: {
    position: 'absolute',
    left: 56,
    right: 20,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
    letterSpacing: 0.2,
    zIndex: 1,
  },

  trackLabelDone: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 4,
    top: 2.5,
    zIndex: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  thumbDisabled: {
    backgroundColor: '#9CA3AF',
  },

  thumbCompleted: {
    backgroundColor: '#047857',
  },

  thumbText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#065F46',
  },
});

