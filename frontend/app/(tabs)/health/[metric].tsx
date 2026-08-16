// S15 — Metric Detail: 7/30/90d chart, stat row, history list. Works
// generically for BOTH mock cache metrics (sleep/steps/heart_rate/
// active_energy/workout — read-only) and real manual metrics (water/mood/
// weight — loggable, editable, deletable) so one screen covers all tap
// targets from the S14 grid + manual-log strip.
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LineChart } from "react-native-gifted-charts";

import { CardError } from "@/src/components/Card";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import {
  bucketEntriesByDay, computeStats, type Aggregate,
} from "@/src/features/health/dailySeries";
import {
  deleteHealthEntry, fetchHealthEntries, fromIsoForRange, logHealthEntry, rangeDays,
} from "@/src/features/health/api";
import { ManualLogSheet } from "@/src/features/health/ManualLogSheet";
import { MetricIcon } from "@/src/features/health/MetricIcon";
import {
  formatMetricValue, getMetricSeries, isCacheMetric, metaFor, metricIconSpec,
  type MetricKey,
} from "@/src/features/health/metrics";
import { useCardData } from "@/src/features/today/useCardData";
import { useTheme } from "@/src/theme";
import type { HealthEntry, ManualHealthType } from "@/src/types/models";

type Range = "7d" | "30d" | "90d";
const RANGES: Range[] = ["7d", "30d", "90d"];

const AGGREGATE_FOR: Record<ManualHealthType, Aggregate> = {
  water: "sum", mood: "avg", weight: "last",
};

function xLabel(dateStr: string, range: Range): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (range === "7d") return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function MetricDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ metric: string }>();
  const metric = params.metric as MetricKey;
  const meta = metaFor(metric);
  const isManual = !isCacheMetric(metric);

  const [range, setRange] = useState<Range>("7d");
  const [insightDismissed, setInsightDismissed] = useState(false);
  const [logSheet, setLogSheet] = useState<{ visible: boolean; entry: HealthEntry | null }>({
    visible: false, entry: null,
  });

  const days = rangeDays(range);

  const manualData = useCardData<HealthEntry[]>(
    `health.detail.${metric}.${range}`,
    () => fetchHealthEntries({ type: metric as ManualHealthType, fromIso: fromIsoForRange(range) }),
  );

  // Cache metrics are synchronous mock data — no loading/error states apply.
  const cacheSeries = useMemo(
    () => (isCacheMetric(metric) ? getMetricSeries(metric, days) : []),
    [metric, days],
  );

  const dailyPoints = useMemo(() => {
    if (isCacheMetric(metric)) {
      return cacheSeries.map((s) => ({ date: s.start_at.slice(0, 10), value: s.value, hasData: true }));
    }
    return bucketEntriesByDay(manualData.data ?? [], days, AGGREGATE_FOR[metric as ManualHealthType]);
  }, [metric, cacheSeries, manualData.data, days]);

  const stats = useMemo(
    () => computeStats(dailyPoints.map((p) => p.value), meta.goodDirection),
    [dailyPoints, meta.goodDirection],
  );

  const hasAnyData = isCacheMetric(metric) ? true : dailyPoints.some((p) => p.hasData);

  const chartData = useMemo(
    () => dailyPoints.map((p, i) => ({
      value: p.value,
      label: i % Math.max(1, Math.ceil(dailyPoints.length / (range === "7d" ? 7 : 6))) === 0
        ? xLabel(p.date, range) : "",
      dataPointText: "",
    })),
    [dailyPoints, range],
  );

  const insight = useMemo(() => {
    if (Math.abs(stats.trendPct) < 5 || stats.avg === 0) return null;
    const dir = stats.trendPct >= 0 ? "up" : "down";
    const window = range === "7d" ? "7-day" : range === "30d" ? "30-day" : "90-day";
    return `Your ${meta.label.toLowerCase()} is trending ${dir} ${Math.abs(stats.trendPct)}% vs your ${window} average.`;
  }, [stats, meta.label, range]);

  const handleDelete = useCallback((entry: HealthEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    manualData.mutate((current) => (current ?? []).filter((e) => e.id !== entry.id));
    deleteHealthEntry(entry.id)
      .then(() => {
        toast.show({
          message: "Entry deleted",
          actionLabel: "Undo",
          onAction: () => {
            logHealthEntry(entry.type, entry.value, entry.note ?? undefined)
              .then(() => manualData.refetch())
              .catch(() => manualData.refetch());
          },
        });
      })
      .catch(() => {
        toast.show({ message: "Couldn't delete — try again" });
        manualData.refetch();
      });
  }, [manualData, toast]);

  const handleSaved = useCallback((entry: HealthEntry) => {
    manualData.refetch();
    toast.show({ message: "Logged" });
  }, [manualData, toast]);

  const teal = theme.colors.secondary.default;
  const chartWidth = width - 32 - 16; // screen padding + a little breathing room

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <View style={[styles.header, { paddingTop: insets.top + theme.space.xs }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
        >
          <Feather name="chevron-left" size={24} color={theme.colors.text.secondary} />
        </TouchableOpacity>
        <View style={styles.titleRow}>
          <MetricIcon spec={metricIconSpec(metric)} size={18} color={teal} />
          <Text style={[theme.type.h3, { color: theme.colors.text.primary }]}>{meta.label}</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View
          style={[styles.segmented, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}
        >
          {RANGES.map((r) => {
            const active = range === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRange(r)}
                accessibilityRole="button"
                accessibilityLabel={`${r} range`}
                accessibilityState={{ selected: active }}
                style={[
                  styles.segment,
                  active && [theme.elevation.e1, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.sm - 2 }],
                ]}
              >
                <Text style={[theme.type.label, { color: active ? theme.colors.text.primary : theme.colors.text.secondary }]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {insight && !insightDismissed ? (
          <View
            style={[
              styles.insightCard,
              { backgroundColor: theme.colors.surface.aiSubtle, borderColor: `${theme.colors.ai.default}66`, borderRadius: theme.radius.md },
            ]}
          >
            <Feather name="zap" size={16} color={theme.colors.ai.onSubtle} />
            <Text style={[theme.type.bodySm, styles.flex, { color: theme.colors.text.primary }]}>{insight}</Text>
            <TouchableOpacity onPress={() => setInsightDismissed(true)} accessibilityRole="button" accessibilityLabel="Dismiss insight">
              <Feather name="x" size={16} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {isManual && manualData.loading ? (
          <Skeleton height={200} radius={theme.radius.md} />
        ) : isManual && manualData.error ? (
          <View style={[styles.chartCard, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md }]}>
            <CardError message={manualData.error} onRetry={manualData.refetch} />
          </View>
        ) : !hasAnyData ? (
          <View
            style={[
              styles.emptyChart,
              { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
            ]}
          >
            <Feather name="bar-chart-2" size={28} color={theme.colors.text.tertiary} />
            <Text style={[theme.type.body, { color: theme.colors.text.secondary, marginTop: 8 }]}>
              {`No ${meta.label.toLowerCase()} data yet`}
            </Text>
          </View>
        ) : (
          <View style={[styles.chartCard, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md }]}>
            <LineChart
              data={chartData}
              width={chartWidth}
              height={180}
              color={teal}
              thickness={2.5}
              curved
              areaChart
              startFillColor={teal}
              startOpacity={0.14}
              endOpacity={0}
              dataPointsColor={teal}
              dataPointsRadius={3}
              hideDataPoints={days > 30}
              yAxisColor="transparent"
              xAxisColor={theme.colors.chart.grid}
              rulesColor={theme.colors.chart.grid}
              rulesType="solid"
              noOfSections={3}
              yAxisTextStyle={{ color: theme.colors.text.tertiary, fontSize: 11 }}
              xAxisLabelTextStyle={{ color: theme.colors.text.tertiary, fontSize: 11 }}
              spacing={days <= 8 ? 40 : days <= 31 ? 11 : 3.5}
              initialSpacing={12}
              endSpacing={12}
              showReferenceLine1={stats.avg > 0}
              referenceLine1Position={stats.avg}
              referenceLine1Config={{
                color: theme.colors.text.tertiary, dashWidth: 4, dashGap: 4, thickness: 1,
              }}
              pointerConfig={{
                pointerColor: teal,
                radius: 5,
                pointerStripHeight: 140,
                pointerStripColor: theme.colors.border.strong,
                pointerLabelWidth: 90,
                pointerLabelHeight: 36,
                activatePointersOnLongPress: false,
                autoAdjustPointerLabelPosition: true,
                pointerLabelComponent: (items: { value: number }[]) => (
                  <View style={[styles.pointerLabel, { backgroundColor: theme.colors.surface.inverse, borderRadius: theme.radius.xs }]}>
                    <Text
                      style={[
                        theme.type.label,
                        { color: theme.colors.text.onInverse, fontSize: 12, fontVariant: ["tabular-nums"] },
                      ]}
                    >
                      {formatMetricValue(metric, items[0]?.value ?? 0)}
                    </Text>
                  </View>
                ),
              }}
            />
          </View>
        )}

        {hasAnyData ? (
          <View style={styles.statRow}>
            {([
              ["Average", stats.avg], ["Best", stats.best], ["Worst", stats.worst],
            ] as const).map(([label, value]) => (
              <View key={label} style={styles.statCol}>
                <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{label}</Text>
                <Text style={[theme.type.h4, { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] }]}>
                  {formatMetricValue(metric, value)}
                </Text>
              </View>
            ))}
            <View style={styles.statCol}>
              <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>Trend</Text>
              <Text
                style={[
                  theme.type.h4,
                  {
                    color: meta.goodDirection === "neutral"
                      ? theme.colors.text.primary
                      : (meta.goodDirection === "up" ? stats.trendPct >= 0 : stats.trendPct <= 0)
                        ? theme.colors.success.text : theme.colors.text.secondary,
                  },
                ]}
              >
                {`${stats.trendPct >= 0 ? "▲" : "▼"} ${Math.abs(stats.trendPct)}%`}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
          {isManual ? "Logged manually by you — synced to your account." : "Sample data — connect Apple Health or Health Connect to see yours."}
        </Text>

        {isManual ? (
          <TouchableOpacity
            onPress={() => setLogSheet({ visible: true, entry: null })}
            accessibilityRole="button"
            accessibilityLabel={`Log ${meta.label.toLowerCase()} entry`}
            style={[styles.logButton, { borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm }]}
          >
            <Feather name="plus" size={16} color={theme.colors.primary.default} />
            <Text style={[theme.type.label, { color: theme.colors.primary.default }]}>Log entry</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{ gap: 4 }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>History</Text>

          {isManual ? (
            (manualData.data ?? []).length === 0 && !manualData.loading ? (
              <Text style={[theme.type.bodySm, { color: theme.colors.text.tertiary, paddingVertical: 8 }]}>
                No entries in this range yet.
              </Text>
            ) : (
              (manualData.data ?? []).map((entry) => (
                <TouchableOpacity
                  key={entry.id}
                  onPress={() => setLogSheet({ visible: true, entry })}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit entry from ${dayLabel(entry.logged_at.slice(0, 10))}`}
                  style={[styles.historyRow, { borderBottomColor: theme.colors.border.default }]}
                >
                  <View style={styles.flex}>
                    <Text style={[theme.type.body, { color: theme.colors.text.primary }]}>
                      {formatMetricValue(metric, entry.value)}
                    </Text>
                    <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
                      {new Date(entry.logged_at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); handleDelete(entry); }}
                    accessibilityRole="button"
                    accessibilityLabel="Delete entry"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.deleteButton}
                  >
                    <Feather name="trash-2" size={16} color={theme.colors.text.tertiary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )
          ) : (
            [...cacheSeries].reverse().map((s) => (
              <View key={s.id} style={[styles.historyRow, { borderBottomColor: theme.colors.border.default }]}>
                <View style={styles.flex}>
                  <Text style={[theme.type.body, { color: theme.colors.text.primary }]}>
                    {formatMetricValue(metric, s.value)}
                  </Text>
                  <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
                    {dayLabel(s.start_at.slice(0, 10))}
                  </Text>
                </View>
                <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>Apple Health</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {isManual ? (
        <ManualLogSheet
          visible={logSheet.visible}
          initialType={metric as ManualHealthType}
          editingEntry={logSheet.entry}
          onClose={() => setLogSheet({ visible: false, entry: null })}
          onSaved={handleSaved}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 8, paddingBottom: 8,
  },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  segmented: { flexDirection: "row", padding: 3, height: 40 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  insightCard: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderWidth: 1,
  },
  flex: { flex: 1 },
  chartCard: { padding: 12, alignItems: "center" },
  emptyChart: { height: 180, alignItems: "center", justifyContent: "center" },
  pointerLabel: { paddingHorizontal: 8, paddingVertical: 4 },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statCol: { alignItems: "flex-start", gap: 2 },
  logButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    height: 44, borderWidth: 1.5, alignSelf: "flex-start", paddingHorizontal: 16,
  },
  historyRow: {
    flexDirection: "row", alignItems: "center", minHeight: 52, borderBottomWidth: 1, gap: 8,
  },
  deleteButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
