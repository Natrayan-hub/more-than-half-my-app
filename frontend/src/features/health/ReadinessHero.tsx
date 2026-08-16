// Readiness hero (IA S14 item 2 + Design System E.6 "Rings"): teal progress
// ring, score + label. Tap -> Readiness explainer sheet (S17-lite).
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import type { Readiness } from "@/src/features/health/metrics";
import { useTheme } from "@/src/theme";

function ReadinessRing({
  score, size, strokeWidth, color, trackColor,
}: { score: number; size: number; strokeWidth: number; color: string; trackColor: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, score / 100));
  const dashoffset = circumference * (1 - progress);
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={center} cy={center} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashoffset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${center}, ${center}`}
      />
    </Svg>
  );
}

interface ReadinessHeroProps {
  readiness: Readiness;
  onPress: () => void;
}

export function ReadinessHero({ readiness, onPress }: ReadinessHeroProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Readiness ${readiness.score}, ${readiness.label}. Tap for details`}
      style={[
        styles.card,
        theme.elevation.e1,
        { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
      ]}
    >
      <View style={styles.ringWrap}>
        <ReadinessRing
          score={readiness.score}
          size={72}
          strokeWidth={8}
          color={theme.colors.secondary.default}
          trackColor={theme.colors.surface.sunken}
        />
        <View style={styles.ringLabel} pointerEvents="none">
          <Text style={[theme.type.h3, { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] }]}>
            {readiness.score}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={[theme.type.labelSm, { color: theme.colors.text.secondary, textTransform: "uppercase" }]}>
          Readiness
        </Text>
        <Text style={[theme.type.h3, { color: theme.colors.text.primary }]}>{readiness.label}</Text>
        <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
          Based on sleep, resting HR &amp; yesterday&apos;s activity · tap for details
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color={theme.colors.text.tertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center", gap: 16, padding: 16,
  },
  ringWrap: { width: 72, height: 72, alignItems: "center", justifyContent: "center" },
  ringLabel: { position: "absolute", alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 2 },
});
