import { StyleSheet } from 'react-native';

const TRACK_WIDTH = 320;
const TRACK_HEIGHT = 58;
const THUMB_SIZE = 50;

export const styles = StyleSheet.create({
  wrapper: {
    width: TRACK_WIDTH,
    alignSelf: 'center',

    // Réserve vraiment de la place pour éviter que
    // le bouton du dessous remonte sur le slider
    minHeight: 110,
    paddingTop: 6,
    paddingBottom: 28,

    position: 'relative',
    overflow: 'visible',
    zIndex: 20,
    elevation: 20,
  },

  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#27F587',

    justifyContent: 'center',
    overflow: 'hidden',

    position: 'relative',
    zIndex: 2,
    elevation: 2,
  },

  trackDisabled: {
    opacity: 0.55,
  },

  trackFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#5DDE9F',
      opacity: 0.5,
  },

  trackLabel: {
    position: 'absolute',
    left: 60,
    right: 20,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: '#035E33',

    // Le texte ne doit pas bloquer le slider
    zIndex: 1,
  },

  trackLabelDone: {
    color: '#035E33',
  },

  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#39C47D',

    justifyContent: 'center',
    alignItems: 'center',

    position: 'absolute',
    left: 4,
    top: 4,

    zIndex: 3,
    elevation: 3,
  },

  thumbDisabled: {
    backgroundColor: '#9CA3AF',
  },

  thumbText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
});
