// S14 — Health Summary Dashboard (Health Tab Root): readiness hero, metric
// grid (mock cache metrics + real weight), manual-log strip (real water/
// mood/weight), source footer. Cache metrics are MOCK-but-honestly-labeled
// until a real HealthKit/Health Connect source connects — see
// src/features/health/metrics.ts (same function Today's HealthCard reads,
// so the numbers never disagree).
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { Feather } from "@expo/vector-icons";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { TopBar } from "@/src/components/TopBar";
import { useToast } from "@/src/components/Toast";
import { fetchHealthEntries, fromIsoForRange } from "@/src/features/health/api";
import { ManualLogSheet } from "@/src/features/health/ManualLogSheet";
import { ManualQuickLogStrip } from "@/src/features/health/ManualQuickLogStrip";
import { MetricCard } from "@/src/features/health/MetricCard";
import {
  CACHE_METRICS, getMetricSeries, getMockReadiness, trendPct,
} from "@/src/features/health/metrics";
import { ReadinessHero } from "@/src/features/health/ReadinessHero";
import { ReadinessSheet } from "@/src/features/health/ReadinessSheet";
import { useCardData } from "@/src/features/today/useCardData";
import { useTheme } from "@/src/theme";
import type { HealthEntry, ManualHealthType } from "@/src/types/models";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function HealthScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [logSheet, setLogSheet] = useState<{ visible: boolean; type: ManualHealthType }>({
    visible: false, type: "water",
  });

  const waterData = useCardData<HealthEntry[]>("health.water.30d", () =>
    fetchHealthEntries({ type: "water", fromIso: fromIsoForRange("30d") }));
  const moodData = useCardData<HealthEntry[]>("health.mood.30d", () =>
    fetchHealthEntries({ type: "mood", fromIso: fromIsoForRange("30d") }));
  const weightData = useCardData<HealthEntry[]>("health.weight.30d", () =>
    fetchHealthEntries({ type: "weight", fromIso: fromIsoForRange("30d") }));

  const readiness = useMemo(() => getMockReadiness(), []);

  // Mock cache metrics — same generator Today's HealthCard uses.
  const cacheGrid = useMemo(
    () => CACHE_METRICS.map((metric) => {
      const series = getMetricSeries(metric, 8);
      return {
        metric,
        value: series[series.length - 1].value,
        sparkline: series.map((s) => s.value),
        trend: trendPct(series),
      };
    }),
    [],
  );

  const weightSeries = weightData.data ? weightData.data.slice(0, 8).reverse() : [];
  const weightGrid = {
    metric: "weight" as const,
    value: weightData.data?.length ? weightData.data[0].value : null,
    sparkline: weightSeries.map((e) => e.value),
    trend: weightSeries.length ? trendPct(weightSeries) : 0,
  };

  const waterToday = useMemo(() => {
    const todays = waterData.data?.filter((e) => e.logged_at.slice(0, 10) === todayKey());
    if (!todays || todays.length === 0) return null;
    return todays.reduce((s, e) => s + e.value, 0);
  }, [waterData.data]);

  const moodToday = useMemo(() => {
    const todays = moodData.data?.filter((e) => e.logged_at.slice(0, 10) === todayKey());
    return todays && todays.length ? todays[0].value : null;
  }, [moodData.data]);

  const weightLatest = weightData.data?.length ? weightData.data[0].value : null;

  const offline = waterData.offline || moodData.offline || weightData.offline;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([waterData.refetch(), moodData.refetch(), weightData.refetch()]);
    setRefreshing(false);
  }, [waterData, moodData, weightData]);

  const openDetail = useCallback((metric: string) => {
    router.push({ pathname: "/health/[metric]", params: { metric } });
  }, [router]);

  const dataForType = useMemo(
    () => ({ water: waterData, mood: moodData, weight: weightData }) as const,
    [waterData, moodData, weightData],
  );

  const handleSaved = useCallback((entry: HealthEntry) => {
    dataForType[entry.type].refetch();
    toast.show({ message: "Logged" });
  }, [toast, dataForType]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <TopBar title="Health" subtitle="Today" />

      {offline ? (
        <View style={[styles.offlineBanner, { backgroundColor: theme.colors.info.subtleBg }]}>
          <Feather name="cloud-off" size={14} color={theme.colors.info.default} />
          <Text style={[theme.type.labelSm, { color: theme.colors.info.default }]}>
            Offline — logs will sync when you&apos;re back
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary.default} />
        }
        showsVerticalScrollIndicator={false}
      >
        <ReadinessHero readiness={readiness} onPress={() => setReadinessOpen(true)} />

        <View style={styles.grid}>
          {cacheGrid.map((item) => (
            <MetricCard
              key={item.metric}
              metric={item.metric}
              value={item.value}
              trendPct={item.trend}
              sparklineValues={item.sparkline}
              onPress={() => openDetail(item.metric)}
            />
          ))}
          <MetricCard
            metric={weightGrid.metric}
            value={weightGrid.value}
            trendPct={weightGrid.trend}
            sparklineValues={weightGrid.sparkline}
            onPress={() => openDetail("weight")}
          />
        </View>

        <ManualQuickLogStrip
          rows={[
            { type: "water", todayValue: waterToday, loading: waterData.loading },
            { type: "mood", todayValue: moodToday, loading: moodData.loading },
            { type: "weight", todayValue: weightLatest, loading: weightData.loading },
          ]}
          onOpenDetail={openDetail}
          onQuickAdd={(type) => setLogSheet({ visible: true, type })}
        />

        <Text style={[theme.type.caption, styles.footer, { color: theme.colors.text.tertiary }]}>
          Sleep, steps, heart rate, active energy &amp; workouts are sample data — connect Apple Health
          or Health Connect to see yours. Water, mood &amp; weight are your real logs, synced to your account.
        </Text>
      </ScrollView>

      <ReadinessSheet
        visible={readinessOpen}
        readiness={readiness}
        onClose={() => setReadinessOpen(false)}
      />

      <ManualLogSheet
        visible={logSheet.visible}
        initialType={logSheet.type}
        onClose={() => setLogSheet((s) => ({ ...s, visible: false }))}
        onSaved={handleSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  footer: { textAlign: "center", marginTop: 4 },
});
