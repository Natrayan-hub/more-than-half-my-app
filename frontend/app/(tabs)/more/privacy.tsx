// Privacy Center (S34, editable after onboarding) — per-domain local-vs-cloud
// data controls. Same Preference.data_controls model as onboarding's privacy
// step; this screen lets users change their mind any time.
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View,
} from "react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import { fetchPreferences, savePreferences } from "@/src/features/preferences/api";
import { useTheme } from "@/src/theme";
import type { DataControls, Preference } from "@/src/types/models";

interface DomainRow {
  key: keyof DataControls;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  cloudNote: string;
  localNote: string;
  offValue: "local" | "off";
}

const DOMAINS: DomainRow[] = [
  { key: "tasks", icon: "check-circle", title: "Tasks", cloudNote: "Synced — restore on a new device", localNote: "This device only — lost if you lose it", offValue: "local" },
  { key: "documents", icon: "file-text", title: "Documents", cloudNote: "Encrypted cloud backup + search", localNote: "This device only", offValue: "local" },
  { key: "health_cache", icon: "heart", title: "Health data", cloudNote: "Synced for cross-device insights", localNote: "Never leaves your device (recommended)", offValue: "local" },
  { key: "ai_memory", icon: "zap", title: "AI memory", cloudNote: "Synced — suggestions follow you", localNote: "This device only", offValue: "local" },
  { key: "photos", icon: "image", title: "Photo backup", cloudNote: "Backed up to encrypted cloud storage", localNote: "This device only — not backed up", offValue: "off" },
];

export default function PrivacyCenterScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [pref, setPref] = useState<Preference | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences()
      .then(setPref)
      .catch(() => toast.show({ message: "Couldn't load privacy settings" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once
  }, []);

  const toggle = useCallback(async (domain: DomainRow, isCloud: boolean) => {
    if (!pref) return;
    const nextValue = isCloud ? "cloud" : domain.offValue;
    const prevControls = pref.data_controls;
    const nextControls: DataControls = { ...pref.data_controls, [domain.key]: nextValue };
    setPref((p) => (p ? { ...p, data_controls: nextControls } : p));
    setSavingKey(domain.key);
    try {
      const saved = await savePreferences({ ...pref, data_controls: nextControls });
      setPref(saved);
    } catch {
      setPref((p) => (p ? { ...p, data_controls: prevControls } : p));
      toast.show({ message: "Couldn't save — try again" });
    } finally {
      setSavingKey(null);
    }
  }, [pref, toast]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Privacy Center" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary }]}>
          Choose what syncs to encrypted cloud and what stays only on this device.
        </Text>

        {loading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} height={68} radius={theme.radius.md} />)}
          </View>
        ) : (
          DOMAINS.map((domain) => {
            const isCloud = pref?.data_controls[domain.key] === "cloud";
            return (
              <View
                key={domain.key}
                style={[
                  styles.row, theme.elevation.e1,
                  { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.xs }]}>
                  <Feather name={domain.icon} size={20} color={theme.colors.primary.subtleText} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>{domain.title}</Text>
                  <View style={styles.noteRow}>
                    <Feather
                      name={isCloud ? "cloud" : "smartphone"}
                      size={12}
                      color={isCloud ? theme.colors.privacy.cloud : theme.colors.privacy.local}
                    />
                    <Text
                      style={[theme.type.caption, styles.flex, { color: isCloud ? theme.colors.privacy.cloud : theme.colors.privacy.local }]}
                    >
                      {isCloud ? domain.cloudNote : domain.localNote}
                    </Text>
                  </View>
                </View>
                {savingKey === domain.key ? (
                  <ActivityIndicator size="small" color={theme.colors.primary.default} />
                ) : (
                  <Switch
                    value={isCloud}
                    onValueChange={(v) => toggle(domain, v)}
                    trackColor={{ false: theme.colors.border.strong, true: theme.colors.primary.default }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel={`Sync ${domain.title} to cloud`}
                  />
                )}
              </View>
            );
          })
        )}

        <Text style={[theme.type.caption, { color: theme.colors.text.tertiary, marginTop: 4 }]}>
          Everything synced is encrypted in transit and at rest. We never sell data or show ads.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  rowIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1, gap: 2 },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  flex: { flex: 1 },
});
