// Manual-log strip (IA S14 item 4): Water · Mood · Weight rows showing
// today's logged value + a fast "+" to open the log sheet. Row tap (outside
// the + button) opens that metric's detail (S15) — same interaction model
// as the metric grid ("tap card -> detail").
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { MetricIcon } from "@/src/features/health/MetricIcon";
import { formatMetricValue, MANUAL_META } from "@/src/features/health/metrics";
import { useTheme } from "@/src/theme";
import type { ManualHealthType } from "@/src/types/models";

interface StripRowValue {
  type: ManualHealthType;
  todayValue: number | null; // null -> "Nothing logged yet"
  loading: boolean;
}

interface ManualQuickLogStripProps {
  rows: StripRowValue[];
  onOpenDetail: (type: ManualHealthType) => void;
  onQuickAdd: (type: ManualHealthType) => void;
}

export function ManualQuickLogStrip({ rows, onOpenDetail, onQuickAdd }: ManualQuickLogStripProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        theme.elevation.e1,
        { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
      ]}
    >
      {rows.map((row, i) => {
        const meta = MANUAL_META[row.type];
        return (
          <TouchableOpacity
            key={row.type}
            onPress={() => onOpenDetail(row.type)}
            accessibilityRole="button"
            accessibilityLabel={`${meta.label}, open detail`}
            style={[
              styles.row,
              i < rows.length - 1 && {
                borderBottomWidth: 1, borderBottomColor: theme.colors.border.default,
              },
            ]}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.xs },
              ]}
            >
              <MetricIcon
                spec={{ set: "feather", name: meta.key === "water" ? "droplet" : meta.key === "mood" ? "smile" : "trending-up" }}
                size={18}
                color={theme.colors.primary.subtleText}
              />
            </View>
            <View style={styles.textCol}>
              <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>{meta.label}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
                {row.loading
                  ? "Loading\u2026"
                  : row.todayValue === null
                    ? "Nothing logged yet today"
                    : `${formatMetricValue(row.type, row.todayValue)} today`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onQuickAdd(row.type);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Log ${meta.label.toLowerCase()}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[
                styles.addButton,
                { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.full },
              ]}
            >
              <Feather name="plus" size={18} color={theme.colors.primary.subtleText} />
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingHorizontal: 14,
  },
  iconBox: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  textCol: { flex: 1, gap: 1 },
  addButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
