// Gym log (strength training) — weekly summary, "Log a set" CTA, history
// grouped by day. Simple by design: exercise name + weight + reps per set,
// no multi-set/superset structure (per explicit user scope).
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

import { CardError } from "@/src/components/Card";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import { AddGymSetSheet } from "@/src/features/gym/AddGymSetSheet";
import {
  deleteGymSet, fetchExerciseNames, fetchGymSets, fetchGymSummary,
} from "@/src/features/gym/api";
import { useCardData } from "@/src/features/today/useCardData";
import { useTheme } from "@/src/theme";
import type { GymSet } from "@/src/types/models";

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function GymScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<{ visible: boolean; editing: GymSet | null }>({
    visible: false, editing: null,
  });

  const setsData = useCardData<GymSet[]>("gym.sets.90d", () => fetchGymSets({ limit: 300 }));
  const summaryData = useCardData("gym.summary", fetchGymSummary);
  const exercisesData = useCardData<string[]>("gym.exercises", fetchExerciseNames);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([setsData.refetch(), summaryData.refetch(), exercisesData.refetch()]);
    setRefreshing(false);
  }, [setsData, summaryData, exercisesData]);

  const grouped = useMemo(() => {
    const groups: { day: string; sets: GymSet[] }[] = [];
    for (const set of setsData.data ?? []) {
      const key = set.logged_at.slice(0, 10);
      const existing = groups.find((g) => g.day === key);
      if (existing) existing.sets.push(set);
      else groups.push({ day: key, sets: [set] });
    }
    return groups;
  }, [setsData.data]);

  const handleSaved = useCallback((set: GymSet, wasEdit: boolean) => {
    setsData.refetch();
    summaryData.refetch();
    exercisesData.refetch();
    toast.show({ message: wasEdit ? "Set updated" : "Set logged" });
  }, [setsData, summaryData, exercisesData, toast]);

  const handleDelete = useCallback((set: GymSet) => {
    setsData.mutate((current) => (current ?? []).filter((s) => s.id !== set.id));
    deleteGymSet(set.id)
      .then(() => summaryData.refetch())
      .catch(() => {
        toast.show({ message: "Couldn't delete — try again" });
        setsData.refetch();
      });
  }, [setsData, summaryData, toast]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Gym" rightIcon="plus" onPressRight={() => setSheet({ visible: true, editing: null })} rightLabel="Log a set" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary.default} />}
      >
        <View
          style={[
            styles.summaryCard, theme.elevation.e1,
            { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
          ]}
        >
          <View style={[styles.summaryIcon, { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.full }]}>
            <MaterialCommunityIcons name="dumbbell" size={22} color={theme.colors.primary.subtleText} />
          </View>
          {summaryData.loading ? (
            <Skeleton height={40} width="60%" />
          ) : (
            <View style={styles.flex}>
              <Text style={[theme.type.h3, { color: theme.colors.text.primary }]}>
                {summaryData.data?.sets_this_week ?? 0} set{summaryData.data?.sets_this_week === 1 ? "" : "s"} this week
              </Text>
              <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
                across {summaryData.data?.sessions_this_week ?? 0} session{summaryData.data?.sessions_this_week === 1 ? "" : "s"}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setSheet({ visible: true, editing: null })}
          accessibilityRole="button"
          accessibilityLabel="Log a set"
          style={[styles.logButton, { backgroundColor: theme.colors.primary.default, borderRadius: theme.radius.sm }]}
        >
          <Feather name="plus" size={16} color={theme.colors.text.onPrimary} />
          <Text style={[theme.type.label, { color: theme.colors.text.onPrimary }]}>Log a set</Text>
        </TouchableOpacity>

        <View style={{ gap: 4 }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>History</Text>

          {setsData.loading ? (
            <View style={{ gap: 8 }}>
              <Skeleton height={56} radius={theme.radius.sm} />
              <Skeleton height={56} radius={theme.radius.sm} />
            </View>
          ) : setsData.error ? (
            <CardError message={setsData.error} onRetry={setsData.refetch} />
          ) : grouped.length === 0 ? (
            <Text style={[theme.type.bodySm, { color: theme.colors.text.tertiary, paddingVertical: 8 }]}>
              No sets logged yet — tap &quot;Log a set&quot; to start.
            </Text>
          ) : (
            grouped.map((group) => (
              <View key={group.day} style={{ marginBottom: 8 }}>
                <Text style={[theme.type.caption, { color: theme.colors.text.tertiary, marginTop: 8, marginBottom: 2 }]}>
                  {dayLabel(group.sets[0].logged_at)}
                </Text>
                {group.sets.map((set) => (
                  <TouchableOpacity
                    key={set.id}
                    onPress={() => setSheet({ visible: true, editing: set })}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${set.exercise_name} set`}
                    style={[styles.historyRow, { borderBottomColor: theme.colors.border.default }]}
                  >
                    <View style={styles.flex}>
                      <Text style={[theme.type.body, { color: theme.colors.text.primary }]}>{set.exercise_name}</Text>
                      <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
                        {set.weight} {set.weight_unit} × {set.reps} reps
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); handleDelete(set); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${set.exercise_name} set`}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.deleteButton}
                    >
                      <Feather name="trash-2" size={16} color={theme.colors.text.tertiary} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <AddGymSetSheet
        visible={sheet.visible}
        editingSet={sheet.editing}
        recentExercises={exercisesData.data ?? []}
        onClose={() => setSheet({ visible: false, editing: null })}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  summaryCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  summaryIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  logButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 48, alignSelf: "stretch",
  },
  historyRow: {
    flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, gap: 8,
  },
  deleteButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
