// Shared back-button header for stack sub-screens (Settings sections,
// Social Stats, metric detail, etc.) — consistent back affordance + title
// across the app, per the navigation-coherence requirement.
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";

interface ScreenHeaderProps {
  title: string;
  rightIcon?: keyof typeof Feather.glyphMap;
  onPressRight?: () => void;
  rightLabel?: string;
}

export function ScreenHeader({ title, rightIcon, onPressRight, rightLabel }: ScreenHeaderProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + theme.space.xs }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.iconButton}
      >
        <Feather name="chevron-left" size={24} color={theme.colors.text.secondary} />
      </TouchableOpacity>
      <Text style={[theme.type.h3, styles.title, { color: theme.colors.text.primary }]} numberOfLines={1}>
        {title}
      </Text>
      {rightIcon && onPressRight ? (
        <TouchableOpacity
          onPress={onPressRight}
          accessibilityRole="button"
          accessibilityLabel={rightLabel ?? title}
          style={styles.iconButton}
        >
          <Feather name={rightIcon} size={22} color={theme.colors.primary.default} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 8, paddingBottom: 8,
  },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center" },
});
