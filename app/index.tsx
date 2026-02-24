import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SplashScreen() {
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const tapOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.5);

  useEffect(() => {
    // Animate logo
    logoOpacity.value = withTiming(1, { duration: 1000 });
    logoScale.value = withTiming(1, { duration: 1000 });

    // Animate text with delay
    textOpacity.value = withDelay(500, withTiming(1, { duration: 1000 }));

    // Animate tap prompt with more delay
    tapOpacity.value = withDelay(1500, withTiming(1, { duration: 1000 }));
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const tapAnimatedStyle = useAnimatedStyle(() => ({
    opacity: tapOpacity.value,
  }));

  const handleTap = () => {
    router.replace('/login');
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handleTap} activeOpacity={1}>
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <ThemedText style={styles.logo}>☀️🧭</ThemedText>
          <ThemedText type="title" style={styles.appName}>COHERA</ThemedText>
        </Animated.View>

        <Animated.View style={textAnimatedStyle}>
          <ThemedText style={styles.tagline}>Collaborate Better</ThemedText>
        </Animated.View>

        <Animated.View style={[styles.tapContainer, tapAnimatedStyle]}>
          <ThemedText style={styles.tapText}>Tap to Continue</ThemedText>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5C542', // Gold background
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 80,
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  tapContainer: {
    marginTop: 60,
  },
  tapText: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.8,
  },
});
