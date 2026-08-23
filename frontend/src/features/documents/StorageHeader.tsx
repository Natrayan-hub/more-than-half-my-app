// Storage status header (S18 top section): usage bar, last backup, Backup
// Now action. Quota is illustrative (see backend/routes/documents.py); the
// used-bytes number moves for real as documents are added.
import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { formatBytes, formatRelativeTime, type StorageSummary } from "@/src/features/documents/api";
import { useTheme } from "@/src/theme";

interface StorageHeaderProps {
  summary: StorageSummary | null;
  loading: boolean;
  backingUp: boolean;
  onBackup: () => void;
  onOpenSettings: () => void;
}

export function StorageHeader({ summary, loading, backingUp, onBackup, onOpenSettings }: StorageHeaderProps) {
  const { theme } = useTheme();
  const pct = summary ? Math.min(1, summary.used_bytes / summary.quota_bytes) : 0;

  return (
    <View
      style={[
        styles.card, theme.elevation.e1,
        { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.flex}>
          <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>
            {loading || !summary
              ? "Loading storage…"
              : `${formatBytes(summary.used_bytes)} of ${formatBytes(summary.quota_bytes)} used`}
          </Text>
          <Text style={[theme.type.caption, { color: theme.colors.text.secondary, marginTop: 2 }]}>
            {summary ? `Last backup: ${formatRelativeTime(summary.last_backup_at)}` : " "}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onBackup}
          disabled={backingUp}
          accessibilityRole="button"
          accessibilityLabel="Backup now"
          style={[styles.backupButton, { backgroundColor: theme.colors.primary.default, borderRadius: theme.radius.sm }]}
        >
          {backingUp ? (
            <ActivityIndicator color={theme.colors.text.onPrimary} size="small" />
          ) : (
            <>
              <Feather name="upload-cloud" size={14} color={theme.colors.text.onPrimary} />
              <Text style={[theme.type.labelSm, { color: theme.colors.text.onPrimary }]}>Backup now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.track, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.full }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: theme.colors.secondary.default, borderRadius: theme.radius.full },
          ]}
        />
      </View>

      <TouchableOpacity onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Backup settings" style={styles.settingsLink}>
        <Text style={[theme.type.labelSm, { color: theme.colors.primary.default }]}>Backup settings</Text>
        <Feather name="chevron-right" size={14} color={theme.colors.primary.default} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  backupButton: {
    flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, minWidth: 116, justifyContent: "center",
  },
  track: { height: 8, overflow: "hidden" },
  fill: { height: 8 },
  settingsLink: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
});
