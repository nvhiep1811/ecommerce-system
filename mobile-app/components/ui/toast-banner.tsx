import React, { useEffect, useRef } from "react";
import { StyleSheet, Text, View, Animated } from "react-native";
import { Colors } from "@/constants/theme";

type ToastBannerProps = {
  message?: string | null;
  type?: "success" | "error" | "info";
  duration?: number;
  onDismiss?: () => void;
};

export default function ToastBanner({
  message,
  type = "info",
  duration = 3000,
  onDismiss,
}: ToastBannerProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) {
      opacity.setValue(0);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      timeoutId = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onDismiss && onDismiss());
      }, duration);
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      opacity.stopAnimation();
    };
  }, [duration, message, onDismiss, opacity]);

  if (!message) return null;

  const backgroundColor =
    type === "success"
      ? "#16a34a"
      : type === "error"
        ? "#dc2626"
        : Colors.light.tint;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <View style={[styles.banner, { backgroundColor }]}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: "60%",
    maxWidth: "96%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  text: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "600",
  },
});
