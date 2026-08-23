// Document list row (S18): title, size, date, category icon. Tap to view,
// long-press to delete (per spec) — delete is optimistic + Undo toast
// rather than a confirm dialog (reversible-action pattern, Design System E.7).
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { formatBytes } from "@/src/features/documents/api";
import { useTheme } from "@/src/theme";
import type { Document, DocumentCategory } from "@/src/types/models";

const CATEGORY_ICON: Record<DocumentCategory, keyof typeof Feather.glyphMap> = {
  id: "credit-card",
  finance: "dollar-sign",
  medical: "heart",
  warranty: "shield",
  travel: "map-pin",
  other: "file-text",
};

interface DocumentRowProps {
  document: Document;
  onPress: () => void;
  onLongPress: () => void;
}

export function DocumentRow({ document, onPress, onLongPress }: DocumentRowProps) {
  const { theme } = useTheme();

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${document.title}, tap to view, long-press to delete`}
      style={[styles.row, { borderBottomColor: theme.colors.border.default }]}
    >
      <View style={[styles.iconBox, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}>
        <Feather name={CATEGORY_ICON[document.category]} size={18} color={theme.colors.text.secondary} />
      </View>
      <View style={styles.flex}>
        <Text style={[theme.type.body, { color: theme.colors.text.primary }]} numberOfLines={1}>
          {document.title}
        </Text>
        <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
          {formatBytes(document.size_bytes)} · {new Date(document.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </Text>
      </View>
      {document.storage_policy === "local_only" ? (
        <Feather name="smartphone" size={14} color={theme.colors.text.tertiary} />
      ) : (
        <Feather name="cloud" size={14} color={theme.colors.text.tertiary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8, borderBottomWidth: 1,
  },
  iconBox: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 2 },
});
