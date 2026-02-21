import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { theme } from './theme';

interface SoundWaveProps {
  isPlaying: boolean;
  barCount?: number;
  color?: string;
  height?: number;
  barWidth?: number;
}

export const SoundWave: React.FC<SoundWaveProps> = ({
  isPlaying,
  barCount = 5,
  color = theme.colors.hotCoral,
  height = 24,
  barWidth = 4,
}) => {
  // Create animated values for each bar
  const animations = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isPlaying) {
      // Start animations with different speeds and delays for each bar
      const animationConfigs = [
        { duration: 300, delay: 0 },
        { duration: 450, delay: 100 },
        { duration: 350, delay: 50 },
        { duration: 400, delay: 150 },
        { duration: 320, delay: 80 },
      ];

      const runAnimations = animations.map((anim, index) => {
        const config = animationConfigs[index % animationConfigs.length];

        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: config.duration,
              useNativeDriver: true,
              delay: config.delay,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: config.duration,
              useNativeDriver: true,
            }),
          ])
        );
      });

      Animated.parallel(runAnimations).start();

      return () => {
        animations.forEach(anim => anim.stopAnimation());
      };
    } else {
      // Reset to idle state
      animations.forEach(anim => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isPlaying, animations]);

  return (
    <View style={[styles.container, { height }]}>
      {animations.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              width: barWidth,
              height: height,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
  },
  bar: {
    borderRadius: 2,
  },
});

export default SoundWave;
