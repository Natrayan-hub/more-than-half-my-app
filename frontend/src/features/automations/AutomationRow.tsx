// Automation list row (S28) — trigger→action summary, enable switch,
// test-run, delete. Presets are seeded disabled (trust guardrail) — the
// switch is the only way any automation ever turns on.
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { describeAction, describeTrigger } from "@/src/features/automations/api";
import { useTheme } from "@/src/theme";
import type { Automation } from "@/src/types/models";

const ACTION_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  notification: "bell",
  focus_mode: "moon",
  open_feature: "external-link",
};

interface AutomationRowProps {
  automation: Automation;
  onToggle: (enabled: boolean) => void;
  onTestRun: () => Promise<void>;
  onDelete: () => void;
}

export function AutomationRow({ automation, onToggle, onTestRun, onDelete }: AutomationRowProps) {
  const { theme } = useTheme();
  const [testing, setTesting] = useState(false);

  const handleTestRun = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTesting(true);
    try {
      await onTestRun();
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border.default }]}>
      <View style={[styles.iconBox, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}>
        <Feather name={ACTION_ICON[automation.action.type] ?? "zap"} size={18} color={theme.colors.text.secondary} />
      </View>
      <View style={styles.flex}>
        <Text style={[theme.type.body, { color: theme.colors.text.primary }]} numberOfLines={1}>{automation.name}</Text>
        <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]} numberOfLines={1}>
          {describeTrigger(automation.trigger)} → {describeAction(automation.action)}
        </Text>
        {automation.last_run_at ? (
          <View style={styles.lastRunRow}>
            <Feather
              name={automation.last_run_status === "success" ? "check-circle" : "alert-circle"}
              size={11}
              color={automation.last_run_status === "success" ? theme.colors.success.text : theme.colors.error.text}
            />
            <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
              Last run {new Date(automation.last_run_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        {testing ? (
          <ActivityIndicator size="small" color={theme.colors.text.tertiary} />
        ) : (
          <TouchableOpacity onPress={handleTestRun} accessibilityRole="button" accessibilityLabel={`Test run ${automation.name}`} style={styles.iconButton}>
            <Feather name="play-circle" size={18} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onDelete} accessibilityRole="button" accessibilityLabel={`Delete ${automation.name}`} style={styles.iconButton}>
          <Feather name="trash-2" size={16} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
        <Switch
          value={automation.enabled}
          onValueChange={onToggle}
          trackColor={{ false: theme.colors.border.strong, true: theme.colors.primary.default }}
          thumbColor="#FFFFFF"
          accessibilityLabel={`Enable ${automation.name}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  iconBox: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginTop: 2 },
  flex: { flex: 1, gap: 2 },
  lastRunRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  iconButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
});
