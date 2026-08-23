// Integration list row (S26) — connect/disconnect a provider. Same
// Integration record the Social Stats screen reads for Instagram.
import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/src/theme";
import type { IntegrationCatalogItem } from "@/src/types/models";

const PROVIDER_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  apple_health: "heart",
  health_connect: "heart",
  garmin: "activity",
  google_calendar: "calendar",
  apple_calendar: "calendar",
  notion: "file-text",
  alexa: "mic",
  instagram: "instagram",
};

interface IntegrationRowProps {
  item: IntegrationCatalogItem;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function IntegrationRow({ item, onConnect, onDisconnect }: IntegrationRowProps) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const connected = item.status === "connected";

  const handlePress = async () => {
    setBusy(true);
    try {
      await (connected ? onDisconnect() : onConnect());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border.default }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}>
        <Feather name={PROVIDER_ICON[item.provider] ?? "grid"} size={18} color={theme.colors.text.secondary} />
      </View>
      <View style={styles.flex}>
        <Text style={[theme.type.body, { color: theme.colors.text.primary }]}>{item.label}</Text>
        <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]} numberOfLines={1}>
          {connected ? `Connected as ${item.external_account}` : item.blurb}
        </Text>
      </View>
      <TouchableOpacity
        onPress={handlePress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={connected ? `Disconnect ${item.label}` : `Connect ${item.label}`}
        style={[
          styles.button,
          { backgroundColor: connected ? theme.colors.surface.sunken : theme.colors.primary.default, borderRadius: theme.radius.sm },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={connected ? theme.colors.text.secondary : theme.colors.text.onPrimary} />
        ) : (
          <Text style={[theme.type.labelSm, { color: connected ? theme.colors.text.secondary : theme.colors.text.onPrimary }]}>
            {connected ? "Disconnect" : "Connect"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderBottomWidth: 1 },
  iconBox: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 2 },
  button: { height: 32, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", minWidth: 90 },
});
