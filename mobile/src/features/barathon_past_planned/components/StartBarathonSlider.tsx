import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  View,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/startBarathonSlider.styles';

type StartBarathonSliderProps = {
  disabled?: boolean;
  onComplete: () => void;
};

const DEFAULT_TRACK_WIDTH = 320;
const THUMB_SIZE = 50;

export default function StartBarathonSlider({
  disabled = false,
  onComplete,
}: StartBarathonSliderProps) {
  const [trackWidth, setTrackWidth] = useState(DEFAULT_TRACK_WIDTH);
  const maxTranslate = Math.max(1, trackWidth - THUMB_SIZE - 8);

  const translateX = useRef(new Animated.Value(0)).current;
  const [completed, setCompleted] = useState(false);
  const currentOffsetRef = useRef(0);

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - trackWidth) > 1) {
      setTrackWidth(width);
    }
  }

  function animateBack() {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      bounciness: 4,
      speed: 16,
    }).start(() => {
      currentOffsetRef.current = 0;
    });
  }

  function resetSlider() {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
      easing: Easing.out(Easing.ease),
    }).start(() => {
      currentOffsetRef.current = 0;
      setCompleted(false);
    });
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (disabled || completed) return false;
          return (
            Math.abs(gestureState.dx) > 6 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
          );
        },
        onPanResponderGrant: () => {
          currentOffsetRef.current = (translateX as any)._value || 0;
        },
        onPanResponderMove: (_, gestureState) => {
          const next = Math.max(0, Math.min(maxTranslate, gestureState.dx));
          translateX.setValue(next);
          currentOffsetRef.current = next;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gestureState) => {
          const completionRatio = currentOffsetRef.current / maxTranslate;
          const isFastFling = gestureState.vx > 0.4 && completionRatio >= 0.45;
          const isFarEnough = completionRatio >= 0.75;

          if (isFarEnough || isFastFling) {
            Animated.timing(translateX, {
              toValue: maxTranslate,
              duration: 120,
              useNativeDriver: false,
              easing: Easing.out(Easing.ease),
            }).start(() => {
              setCompleted(true);
              onComplete();

              setTimeout(() => {
                resetSlider();
              }, 1600);
            });
          } else {
            animateBack();
          }
        },
        onPanResponderTerminate: () => {
          animateBack();
        },
      }),
    [disabled, completed, maxTranslate]
  );

  const fillWidth = translateX.interpolate({
    inputRange: [0, maxTranslate],
    outputRange: [THUMB_SIZE + 8, trackWidth],
    extrapolate: 'clamp',
  });

  const textOpacity = translateX.interpolate({
    inputRange: [0, maxTranslate * 0.6],
    outputRange: [1, 0.1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.wrapper}>
      <View
        onLayout={handleLayout}
        style={[
          styles.track,
          disabled && styles.trackDisabled,
          completed && styles.trackCompleted,
        ]}
      >
        <Animated.View
          style={[
            styles.trackFill,
            { width: fillWidth },
            completed && styles.trackFillCompleted,
          ]}
        />

        <Animated.Text
          style={[
            styles.trackLabel,
            { opacity: textOpacity },
            completed && styles.trackLabelDone,
          ]}
          numberOfLines={1}
        >
          {completed ? 'Barathon lancé !' : 'Glisser pour lancer le barathon'}
        </Animated.Text>

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            disabled && styles.thumbDisabled,
            completed && styles.thumbCompleted,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <Ionicons
            name={completed ? 'checkmark' : 'arrow-forward'}
            size={24}
            color={completed ? '#FFFFFF' : '#065F46'}
          />
        </Animated.View>
      </View>
    </View>
  );
}

