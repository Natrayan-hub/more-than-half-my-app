// Notification preferences (S25 slice) — real GET/PUT against
// Preference.notif_prefs. Quiet hours are shown read-only for now (editing
// them is a small follow-up — time-range picker, not in this pass).
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { SettingsGroup, SettingsRow } from "@/src/components/SettingsRow";
import { useToast } from "@/src/components/Toast";
import { fetchPreferences, savePreferences } from "@/src/features/preferences/api";
import { useTheme } from "@/src/theme";
import type { Preference } from "@/src/types/models";

type NotifPrefs = Preference["notif_prefs"];

const DEFAULT_NOTIF: NotifPrefs = {
  task_reminders: true,
  ai_suggestions: true,
  suggestions_per_day: 3,
  health_nudges: true,
  backup_alerts: "failures_only",
  weekly_recap: "in_app",
  quiet_hours: { start: "22:00", end: "07:00" },
  automation_alerts: true,
  email_digests: false,
};

const BACKUP_ALERT_OPTIONS = [
  { key: "failures_only", label: "Failures only" },
  { key: "all", label: "All" },
  { key: "off", label: "Off" },
] as const;

const RECAP_OPTIONS = [
  { key: "in_app", label: "In-app" },
  { key: "push", label: "Push" },
  { key: "email", label: "Email" },
] as const;

function ChipRow<T extends string>({
  options, value, onChange,
}: { options: readonly { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const { theme } = useTheme();
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: active }}
            style={[
              styles.chip,
              { backgroundColor: active ? theme.colors.primary.default : theme.colors.surface.sunken, borderRadius: theme.radius.full },
            ]}
          >
            <Text style={[theme.type.labelSm, { color: active ? theme.colors.text.onPrimary : theme.colors.text.secondary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [pref, setPref] = useState<Preference | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferences()
      .then(setPref)
      .catch(() => toast.show({ message: "Couldn't load notification settings" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once
  }, []);

  const patch = useCallback(async (updates: Partial<NotifPrefs>) => {
    if (!pref) return;
    const prevNotif = pref.notif_prefs;
    const nextNotif = { ...pref.notif_prefs, ...updates };
    setPref((p) => (p ? { ...p, notif_prefs: nextNotif } : p));
    try {
      const saved = await savePreferences({ ...pref, notif_prefs: nextNotif });
      setPref(saved);
    } catch {
      setPref((p) => (p ? { ...p, notif_prefs: prevNotif } : p));
      toast.show({ message: "Couldn't save — try again" });
    }
  }, [pref, toast]);

  const notif = pref?.notif_prefs ?? DEFAULT_NOTIF;
  const suggestionsPerDay: number = notif.suggestions_per_day;

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={180} radius={theme.radius.md} />
            <Skeleton height={120} radius={theme.radius.md} />
          </View>
        ) : (
          <>
            <SettingsGroup title="Alerts">
              <SettingsRow
                icon="check-square"
                title="Task reminders"
                trailing={
                  <Switch
                    value={!!notif.task_reminders}
                    onValueChange={(v) => patch({ task_reminders: v })}
                    trackColor={{ false: theme.colors.border.strong, true: theme.colors.primary.default }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Task reminders"
                  />
                }
              />
              <SettingsRow
                icon="zap"
                title="AI suggestions"
                subtitle={`Up to ${suggestionsPerDay} per day`}
                trailing={
                  <Switch
                    value={!!notif.ai_suggestions}
                    onValueChange={(v) => patch({ ai_suggestions: v })}
                    trackColor={{ false: theme.colors.border.strong, true: theme.colors.primary.default }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="AI suggestions"
                  />
                }
              />
              <SettingsRow
                icon="heart"
                title="Health nudges"
                trailing={
                  <Switch
                    value={!!notif.health_nudges}
                    onValueChange={(v) => patch({ health_nudges: v })}
                    trackColor={{ false: theme.colors.border.strong, true: theme.colors.primary.default }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Health nudges"
                  />
                }
              />
              <SettingsRow
                icon="zap"
                title="Automation alerts"
                trailing={
                  <Switch
                    value={!!notif.automation_alerts}
                    onValueChange={(v) => patch({ automation_alerts: v })}
                    trackColor={{ false: theme.colors.border.strong, true: theme.colors.primary.default }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Automation alerts"
                  />
                }
              />
              <SettingsRow
                icon="mail"
                title="Email digests"
                trailing={
                  <Switch
                    value={!!notif.email_digests}
                    onValueChange={(v) => patch({ email_digests: v })}
                    trackColor={{ false: theme.colors.border.strong, true: theme.colors.primary.default }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Email digests"
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup title="Suggestions per day">
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => patch({ suggestions_per_day: Math.max(1, suggestionsPerDay - 1) })}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease suggestions per day"
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.full }]}
                >
                  <Feather name="minus" size={16} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={[theme.type.h3, { color: theme.colors.text.primary, minWidth: 32, textAlign: "center" }]}>
                  {suggestionsPerDay}
                </Text>
                <TouchableOpacity
                  onPress={() => patch({ suggestions_per_day: Math.min(10, suggestionsPerDay + 1) })}
                  accessibilityRole="button"
                  accessibilityLabel="Increase suggestions per day"
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.full }]}
                >
                  <Feather name="plus" size={16} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </View>
            </SettingsGroup>

            <SettingsGroup title="Backup alerts">
              <View style={styles.chipWrap}>
                <ChipRow
                  options={BACKUP_ALERT_OPTIONS}
                  value={(notif.backup_alerts as typeof BACKUP_ALERT_OPTIONS[number]["key"]) ?? "failures_only"}
                  onChange={(v) => patch({ backup_alerts: v })}
                />
              </View>
            </SettingsGroup>

            <SettingsGroup title="Weekly recap delivery">
              <View style={styles.chipWrap}>
                <ChipRow
                  options={RECAP_OPTIONS}
                  value={(notif.weekly_recap as typeof RECAP_OPTIONS[number]["key"]) ?? "in_app"}
                  onChange={(v) => patch({ weekly_recap: v })}
                />
              </View>
            </SettingsGroup>

            <View style={styles.quietHours}>
              <Feather name="moon" size={14} color={theme.colors.text.tertiary} />
              <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
                Quiet hours: {(notif.quiet_hours as { start?: string })?.start ?? "22:00"} – {(notif.quiet_hours as { end?: string })?.end ?? "07:00"}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chipWrap: { paddingHorizontal: 14, paddingVertical: 12 },
  chip: { paddingHorizontal: 14, height: 32, alignItems: "center", justifyContent: "center" },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, paddingVertical: 16 },
  stepperButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  quietHours: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
});
