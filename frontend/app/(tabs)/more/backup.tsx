// Backup & Storage (S32) — storage usage (real, same summary as Docs tab),
// manual "Back up now", and backup frequency (illustrative — no real
// scheduler yet, same honesty note as the Documents screen).
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { SettingsGroup } from "@/src/components/SettingsRow";
import { useToast } from "@/src/components/Toast";
import {
  backupNow, fetchStorageSummary, formatBytes, formatRelativeTime, type StorageSummary,
} from "@/src/features/documents/api";
import { fetchPreferences, savePreferences } from "@/src/features/preferences/api";
import { useTheme } from "@/src/theme";

const FREQUENCIES = [
  { key: "manual", label: "Manual", desc: "Back up only when you tap the button" },
  { key: "daily", label: "Daily", desc: "Back up automatically every day" },
  { key: "weekly", label: "Weekly", desc: "Back up automatically every week" },
] as const;

export default function BackupScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [savingFreq, setSavingFreq] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await fetchStorageSummary();
      setSummary(s);
    } catch {
      toast.show({ message: "Couldn't load storage summary" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleBackup = useCallback(async () => {
    setBackingUp(true);
    try {
      const s = await backupNow();
      setSummary(s);
      toast.show({ message: "Backed up" });
    } catch {
      toast.show({ message: "Backup failed — try again" });
    } finally {
      setBackingUp(false);
    }
  }, [toast]);

  const setFrequency = useCallback(async (frequency: "manual" | "daily" | "weekly") => {
    setSavingFreq(true);
    try {
      const pref = await fetchPreferences();
      const saved = await savePreferences({
        ...pref,
        backup_prefs: { ...pref.backup_prefs, frequency },
      });
      setSummary((s) => (s ? { ...s, backup_frequency: saved.backup_prefs.frequency } : s));
      toast.show({ message: `Backup frequency set to ${frequency}` });
    } catch {
      toast.show({ message: "Couldn't save — try again" });
    } finally {
      setSavingFreq(false);
    }
  }, [toast]);

  const pct = summary ? Math.min(1, summary.used_bytes / summary.quota_bytes) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Backup & Storage" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Skeleton height={130} radius={theme.radius.md} />
        ) : (
          <View style={[styles.card, theme.elevation.e1, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md }]}>
            <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>
              {summary ? `${formatBytes(summary.used_bytes)} of ${formatBytes(summary.quota_bytes)} used` : "—"}
            </Text>
            <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
              Last backup: {formatRelativeTime(summary?.last_backup_at)}
            </Text>
            <View style={[styles.track, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.full }]}>
              <View style={[styles.fill, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: theme.colors.secondary.default, borderRadius: theme.radius.full }]} />
            </View>
            <TouchableOpacity
              onPress={handleBackup}
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
        )}

        <SettingsGroup title="Backup frequency">
          <View style={{ padding: 4 }}>
            {FREQUENCIES.map((f, i) => {
              const active = summary?.backup_frequency === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFrequency(f.key)}
                  disabled={savingFreq}
                  accessibilityRole="button"
                  accessibilityLabel={f.label}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.freqRow,
                    i < FREQUENCIES.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border.default },
                  ]}
                >
                  <View style={styles.flex}>
                    <Text style={[theme.type.body, { color: theme.colors.text.primary }]}>{f.label}</Text>
                    <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{f.desc}</Text>
                  </View>
                  {active ? <Feather name="check-circle" size={18} color={theme.colors.primary.default} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsGroup>

        <Text style={[theme.type.caption, { color: theme.colors.text.tertiary, textAlign: "center" }]}>
          Automatic backup scheduling is illustrative in this build — &quot;Backup now&quot; performs a real backup.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  card: { padding: 16, gap: 12 },
  track: { height: 8, overflow: "hidden" },
  fill: { height: 8 },
  backupButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, alignSelf: "flex-start", paddingHorizontal: 16,
  },
  freqRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 10 },
  flex: { flex: 1 },
});
