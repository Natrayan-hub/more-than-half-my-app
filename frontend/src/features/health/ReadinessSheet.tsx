// Readiness explainer (S17-lite): factor breakdown + explainability
// guardrail disclaimer. Bottom sheet, same Modal pattern as QuickAddSheet.
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Readiness } from "@/src/features/health/metrics";
import { useTheme } from "@/src/theme";

interface ReadinessSheetProps {
  visible: boolean;
  readiness: Readiness | null;
  onClose: () => void;
}

function weightIcon(weight: "up" | "down" | "flat"): keyof typeof Feather.glyphMap {
  return weight === "up" ? "arrow-up-right" : weight === "down" ? "arrow-down-right" : "minus";
}

export function ReadinessSheet({ visible, readiness, onClose }: ReadinessSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (!readiness) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.overlay.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close readiness details"
      />
      <View
        style={[
          styles.sheet,
          theme.elevation.e2,
          {
            backgroundColor: theme.colors.surface.raised,
            borderTopLeftRadius: theme.radius.lg,
            borderTopRightRadius: theme.radius.lg,
            paddingBottom: insets.bottom + theme.space.md,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.colors.border.strong }]} />
        <Text style={[theme.type.h2, { color: theme.colors.text.primary }]}>{readiness.score} · {readiness.label}</Text>
        <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary, marginTop: 4, marginBottom: theme.space.md }]}>
          How today&apos;s readiness was computed
        </Text>

        {readiness.factors.map((f) => (
          <View key={f.key} style={styles.row}>
            <Feather name={weightIcon(f.weight)} size={16} color={theme.colors.text.secondary} />
            <Text style={[theme.type.body, styles.flex, { color: theme.colors.text.primary }]}>{f.label}</Text>
            <Text
              style={[
                theme.type.label,
                { color: theme.colors.text.secondary, fontVariant: ["tabular-nums"] },
              ]}
            >
              {f.value}
            </Text>
          </View>
        ))}

        <View
          style={[
            styles.disclaimer,
            { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm },
          ]}
        >
          <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
            Wellbeing guidance only — not medical advice.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, marginBottom: 12 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10,
    minHeight: 44,
  },
  flex: { flex: 1 },
  disclaimer: { padding: 12, marginTop: 8 },
});
