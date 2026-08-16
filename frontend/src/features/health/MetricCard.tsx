// Health metric grid cell (Design System E.3 "Metric card"): big value +
// unit, teal sparkline 32h, trend delta chip. Tap -> Metric Detail (S15).
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { MetricIcon } from "@/src/features/health/MetricIcon";
import type { MetricKey } from "@/src/features/health/metrics";
import { formatMetricValue, metaFor, metricIconSpec } from "@/src/features/health/metrics";
import { Sparkline } from "@/src/features/health/Sparkline";
import { useTheme } from "@/src/theme";

interface MetricCardProps {
  metric: MetricKey;
  value: number | null; // null -> "no data yet" state
  trendPct: number;
  sparklineValues: number[];
  onPress: () => void;
}

export function MetricCard({ metric, value, trendPct, sparklineValues, onPress }: MetricCardProps) {
  const { theme } = useTheme();
  const meta = metaFor(metric);
  const teal = theme.colors.secondary.default;

  const trendColor = meta.goodDirection === "neutral"
    ? theme.colors.text.secondary
    : (meta.goodDirection === "up" ? trendPct >= 0 : trendPct <= 0)
      ? theme.colors.success.text
      : theme.colors.text.secondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${meta.label}, open detail`}
      style={[
        styles.card,
        theme.elevation.e1,
        { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
      ]}
    >
      <View style={styles.header}>
        <MetricIcon spec={metricIconSpec(metric)} size={16} color={teal} />
        <Text style={[theme.type.labelSm, { color: theme.colors.text.secondary }]}>
          {meta.label}
        </Text>
      </View>

      {value === null ? (
        <View style={styles.emptyBlock}>
          <Text style={[theme.type.bodySm, { color: theme.colors.text.tertiary }]}>
            No data yet
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.valueRow}>
            <Text
              style={[
                theme.type.h2,
                { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] },
              ]}
            >
              {formatMetricValue(metric, value)}
            </Text>
            {metric !== "sleep" && metric !== "water" ? (
              <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
                {` ${meta.unit}`}
              </Text>
            ) : null}
          </View>
          <View style={styles.sparkRow}>
            <Sparkline values={sparklineValues} color={teal} width={72} height={28} />
            <View style={styles.trendCol}>
              <Text style={[theme.type.labelSm, { color: trendColor }]}>
                {`${trendPct >= 0 ? "▲" : "▼"} ${Math.abs(trendPct)}%`}
              </Text>
            </View>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexBasis: "47%", flexGrow: 1, padding: 14, gap: 6 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 2 },
  sparkRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  trendCol: { alignItems: "flex-end" },
  emptyBlock: { minHeight: 44, justifyContent: "center" },
});
