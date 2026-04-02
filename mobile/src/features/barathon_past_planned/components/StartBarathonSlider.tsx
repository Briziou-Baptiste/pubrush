import React, { useMemo, useRef, useState } from 'react';
import { styles } from '../styles/startBarathonSlider.styles';
import {
  Animated,
  Easing,
  PanResponder,
  Text,
  View,
} from 'react-native';

type StartBarathonSliderProps = {
  disabled?: boolean;
  onComplete: () => void;
};

const TRACK_WIDTH = 320;
const TRACK_HEIGHT = 58;
const THUMB_SIZE = 50;
const MAX_TRANSLATE = TRACK_WIDTH - THUMB_SIZE - 8;

export default function StartBarathonSlider({
  disabled = false,
  onComplete,
}: StartBarathonSliderProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [completed, setCompleted] = useState(false);
  const currentOffsetRef = useRef(0);

  function animateBack() {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start(() => {
      currentOffsetRef.current = 0;
    });
  }

  function resetSlider() {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      currentOffsetRef.current = 0;
      setCompleted(false);
    });
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled && !completed,
        onMoveShouldSetPanResponder: () => !disabled && !completed,
        onPanResponderMove: (_, gestureState) => {
          const next = Math.max(0, Math.min(MAX_TRANSLATE, gestureState.dx));
          translateX.setValue(next);
          currentOffsetRef.current = next;
        },
        onPanResponderRelease: () => {
          const completionRatio = currentOffsetRef.current / MAX_TRANSLATE;

          if (completionRatio >= 0.92) {
            Animated.timing(translateX, {
              toValue: MAX_TRANSLATE,
              duration: 120,
              useNativeDriver: true,
            }).start(() => {
              setCompleted(true);
              console.log('Barathon lancé');
              onComplete();

              setTimeout(() => {
                resetSlider();
              }, 1400);
            });
          } else {
            animateBack();
          }
        },
        onPanResponderTerminate: () => {
          animateBack();
        },
      }),
    [disabled, completed]
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.track, disabled ? styles.trackDisabled : null]}>
        <View style={styles.trackFill} />

        <Text style={[styles.trackLabel, completed ? styles.trackLabelDone : null]}>
          {completed ? 'Barathon lancé' : 'Slide pour lancer le barathon'}
        </Text>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            disabled ? styles.thumbDisabled : null,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <Text style={styles.thumbText}>→</Text>
        </Animated.View>
      </View>
    </View>
  );
}
