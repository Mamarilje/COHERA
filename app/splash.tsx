import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { auth } from "../src/Firebase/FirebaseConfig";

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handlePress = () => {
    if (auth.currentUser) {
      // @ts-ignore
      router.replace("(tabs)");
    } else {
      router.replace("/auth/login");
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={1}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logoContainer}>
          <Ionicons name="sunny" size={80} color={Colors.light.primaryForeground} />
        </View>
        <Text style={styles.brandName}>COHERA</Text>
        <Text style={styles.tagline}>Collaborate Better</Text>
        <View style={styles.spinner}>
          <Ionicons name="reload" size={24} color={Colors.light.primaryForeground} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  brandName: {
    fontSize: 48,
    fontWeight: 'bold',
    color: Colors.light.primaryForeground,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: Colors.light.primaryForeground + '80',
    marginBottom: 32,
  },
  spinner: {
    opacity: 0.7,
  },
});
