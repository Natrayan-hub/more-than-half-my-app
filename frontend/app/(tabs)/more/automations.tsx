// Automations (IA S28/S29) — list of preset + custom recipes, enable
// toggle, test-run, delete, add custom. Real CRUD against the existing
// Automation model/routes; presets auto-seed once per user, disabled.
import { Feather } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { CardError } from "@/src/components/Card";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import { AddAutomationSheet } from "@/src/features/automations/AddAutomationSheet";
import {
  deleteAutomation, fetchAutomations, patchAutomation, testRunAutomation,
} from "@/src/features/automations/api";
import { AutomationRow } from "@/src/features/automations/AutomationRow";
import { useCardData } from "@/src/features/today/useCardData";
import { useTheme } from "@/src/theme";
import type { Automation } from "@/src/types/models";

export default function AutomationsScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [refreshing, setRefreshing] = React.useState(false);
  const [addVisible, setAddVisible] = React.useState(false);

  const automationsData = useCardData<Automation[]>("automations.list", fetchAutomations);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await automationsData.refetch();
    setRefreshing(false);
  }, [automationsData]);

  const handleToggle = useCallback((automation: Automation, enabled: boolean) => {
    automationsData.mutate((current) =>
      (current ?? []).map((a) => (a.id === automation.id ? { ...a, enabled } : a)));
    patchAutomation(automation.id, { enabled }).catch(() => {
      automationsData.mutate((current) =>
        (current ?? []).map((a) => (a.id === automation.id ? { ...a, enabled: !enabled } : a)));
      toast.show({ message: "Couldn't update — try again" });
    });
  }, [automationsData, toast]);

  const handleTestRun = useCallback(async (automation: Automation) => {
    try {
      const updated = await testRunAutomation(automation.id);
      automationsData.mutate((current) =>
        (current ?? []).map((a) => (a.id === automation.id ? updated : a)));
      toast.show({ message: `${automation.name} ran successfully` });
    } catch {
      toast.show({ message: "Test run failed — try again" });
    }
  }, [automationsData, toast]);

  const handleDelete = useCallback((automation: Automation) => {
    automationsData.mutate((current) => (current ?? []).filter((a) => a.id !== automation.id));
    deleteAutomation(automation.id)
      .then(() => toast.show({ message: `${automation.name} deleted` }))
      .catch(() => {
        toast.show({ message: "Couldn't delete — try again" });
        automationsData.refetch();
      });
  }, [automationsData, toast]);

  const handleCreated = useCallback((automation: Automation) => {
    automationsData.mutate((current) => [...(current ?? []), automation]);
    toast.show({ message: "Automation created — disabled until you turn it on" });
  }, [automationsData, toast]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Automations" rightIcon="plus" onPressRight={() => setAddVisible(true)} rightLabel="Add automation" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary.default} />}
      >
        <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary }]}>
          Automations never turn themselves on — you flip the switch.
        </Text>

        {automationsData.loading ? (
          <View style={{ gap: 8 }}>
            <Skeleton height={64} radius={theme.radius.sm} />
            <Skeleton height={64} radius={theme.radius.sm} />
            <Skeleton height={64} radius={theme.radius.sm} />
          </View>
        ) : automationsData.error ? (
          <CardError message={automationsData.error} onRetry={automationsData.refetch} />
        ) : (automationsData.data ?? []).length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="zap" size={22} color={theme.colors.text.tertiary} />
            <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary, marginTop: 6 }]}>
              No automations yet — tap + to create one.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.listCard, theme.elevation.e1,
              { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
            ]}
          >
            {(automationsData.data ?? []).map((automation) => (
              <AutomationRow
                key={automation.id}
                automation={automation}
                onToggle={(enabled) => handleToggle(automation, enabled)}
                onTestRun={() => handleTestRun(automation)}
                onDelete={() => handleDelete(automation)}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={() => setAddVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Add automation"
          style={[styles.addButton, { borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm }]}
        >
          <Feather name="plus" size={16} color={theme.colors.primary.default} />
          <Text style={[theme.type.label, { color: theme.colors.primary.default }]}>New automation</Text>
        </TouchableOpacity>
      </ScrollView>

      <AddAutomationSheet visible={addVisible} onClose={() => setAddVisible(false)} onCreated={handleCreated} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  emptyBlock: { alignItems: "center", paddingVertical: 24 },
  listCard: { paddingHorizontal: 14, overflow: "hidden" },
  addButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 48, borderWidth: 1.5, marginTop: 4,
  },
});
