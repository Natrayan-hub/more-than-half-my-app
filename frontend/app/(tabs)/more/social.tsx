// Social Stats (IA S31, condensed) — Instagram snapshot: connection status
// (REAL, shared Integration record with Settings > Integrations),
// followers/reach/engagement stats + growth chart (MOCK, honestly labeled —
// see src/features/social/mockSocialData.ts), top post, secondary stats.
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, useWindowDimensions, View,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import {
  connectInstagram, disconnectInstagram, fetchInstagramConnection,
} from "@/src/features/social/api";
import {
  getEngagementSeries, getFollowerGrowthSeries, getMockSocialStats,
} from "@/src/features/social/mockSocialData";
import { useCardData } from "@/src/features/today/useCardData";
import { useTheme } from "@/src/theme";
import type { IntegrationCatalogItem } from "@/src/types/models";

type Range = "7d" | "30d" | "90d";
const RANGES: Range[] = ["7d", "30d", "90d"];
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diffDay = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diffDay <= 0) return "today";
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}

interface StatTileProps { label: string; value: string; delta?: string }
function StatTile({ label, value, delta }: StatTileProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.statTile}>
      <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{label}</Text>
      <Text style={[theme.type.h2, { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] }]}>
        {value}
      </Text>
      {delta ? (
        <View style={styles.deltaRow}>
          <Feather name="arrow-up-right" size={12} color={theme.colors.success.text} />
          <Text style={[theme.type.labelSm, { color: theme.colors.success.text }]}>{delta}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function SocialStatsScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>("30d");
  const [showHandleInput, setShowHandleInput] = useState(false);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  const connectionData = useCardData<IntegrationCatalogItem>("social.instagram.connection", fetchInstagramConnection);
  const stats = useMemo(() => getMockSocialStats(), []);
  const days = RANGE_DAYS[range];
  const followerSeries = useMemo(() => getFollowerGrowthSeries(days), [days]);
  const engagementSeries = useMemo(() => getEngagementSeries(days), [days]);

  const connected = connectionData.data?.status === "connected";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await connectionData.refetch();
    setRefreshing(false);
  }, [connectionData]);

  const handleConnect = useCallback(async () => {
    setBusy(true);
    try {
      const result = await connectInstagram(handle.trim());
      connectionData.mutate(() => result);
      setShowHandleInput(false);
      setHandle("");
      toast.show({ message: `Connected as ${result.external_account}` });
    } catch {
      toast.show({ message: "Couldn't connect — try again" });
    } finally {
      setBusy(false);
    }
  }, [handle, connectionData, toast]);

  const handleDisconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectInstagram();
      connectionData.mutate((current) => (current ? { ...current, status: "not_connected", external_account: null } : current));
      toast.show({ message: "Instagram disconnected" });
    } catch {
      toast.show({ message: "Couldn't disconnect — try again" });
    } finally {
      setBusy(false);
    }
  }, [connectionData, toast]);

  const chartWidth = width - 32 - 24;
  const teal = theme.colors.secondary.default;
  const purple = theme.colors.ai.default;

  const followerChartData = useMemo(
    () => followerSeries.map((p) => ({ value: p.value })),
    [followerSeries],
  );
  const engagementChartData = useMemo(
    () => engagementSeries.map((p) => ({ value: p.value })),
    [engagementSeries],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Social Stats" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary.default} />}
      >
        {/* Connection status — REAL Integration record */}
        <View
          style={[
            styles.connectionCard, theme.elevation.e1,
            { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
          ]}
        >
          <View style={styles.connectionRow}>
            <View
              style={[
                styles.igIcon,
                { backgroundColor: connected ? theme.colors.surface.aiSubtle : theme.colors.surface.sunken, borderRadius: theme.radius.full },
              ]}
            >
              <Feather name="instagram" size={20} color={connected ? purple : theme.colors.text.secondary} />
            </View>
            <View style={styles.flex}>
              {connectionData.loading ? (
                <Skeleton height={18} width="60%" />
              ) : connected ? (
                <>
                  <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>
                    Connected as {connectionData.data?.external_account}
                  </Text>
                  <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
                    Last synced {timeAgo(connectionData.data?.last_sync_at) || "just now"}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>Not connected</Text>
                  <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>
                    Connect your Instagram Business/Creator account
                  </Text>
                </>
              )}
            </View>
            {!connectionData.loading ? (
              <TouchableOpacity
                onPress={connected ? handleDisconnect : () => setShowHandleInput((s) => !s)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={connected ? "Disconnect Instagram" : "Connect Instagram"}
                style={[
                  styles.connectButton,
                  {
                    backgroundColor: connected ? theme.colors.surface.sunken : theme.colors.primary.default,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={connected ? theme.colors.text.secondary : theme.colors.text.onPrimary} />
                ) : (
                  <Text
                    style={[
                      theme.type.labelSm,
                      { color: connected ? theme.colors.text.secondary : theme.colors.text.onPrimary },
                    ]}
                  >
                    {connected ? "Disconnect" : "Connect"}
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          {showHandleInput && !connected ? (
            <View style={styles.handleRow}>
              <TextInput
                value={handle}
                onChangeText={setHandle}
                placeholder="@yourhandle (optional)"
                placeholderTextColor={theme.colors.text.tertiary}
                autoCapitalize="none"
                accessibilityLabel="Instagram handle"
                style={[
                  styles.handleInput, theme.type.bodySm,
                  { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm },
                ]}
              />
              <TouchableOpacity
                onPress={handleConnect}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Confirm connect"
                style={[styles.handleConfirm, { backgroundColor: theme.colors.primary.default, borderRadius: theme.radius.sm }]}
              >
                <Feather name="check" size={16} color={theme.colors.text.onPrimary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Range selector */}
        <View style={[styles.segmented, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}>
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

        {/* Headline stats */}
        <View style={styles.statsRow}>
          <StatTile label="Followers" value={stats.followers.toLocaleString()} delta={`+${stats.followers_delta} today`} />
          <StatTile label="Reach" value={stats.reach.toLocaleString()} />
          <StatTile label="Engagement" value={`${stats.engagement_rate}%`} />
        </View>

        {/* Follower growth chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md }]}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary, marginBottom: 8 }]}>Follower growth</Text>
          <LineChart
            data={followerChartData}
            width={chartWidth}
            height={110}
            color={teal}
            thickness={2.5}
            curved
            areaChart
            startFillColor={teal}
            startOpacity={0.14}
            endOpacity={0}
            hideDataPoints
            yAxisColor="transparent"
            xAxisColor="transparent"
            rulesColor={theme.colors.chart.grid}
            rulesType="solid"
            noOfSections={2}
            hideYAxisText
            hideRules={false}
            spacing={Math.max(2, chartWidth / followerChartData.length - 2)}
            initialSpacing={4}
            endSpacing={4}
          />
        </View>

        {/* Engagement rate chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md }]}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary, marginBottom: 8 }]}>Engagement rate</Text>
          <LineChart
            data={engagementChartData}
            width={chartWidth}
            height={90}
            color={purple}
            thickness={2.5}
            curved
            hideDataPoints
            yAxisColor="transparent"
            xAxisColor="transparent"
            rulesColor={theme.colors.chart.grid}
            noOfSections={2}
            hideYAxisText
            spacing={Math.max(2, chartWidth / engagementChartData.length - 2)}
            initialSpacing={4}
            endSpacing={4}
          />
        </View>

        {/* Secondary stats */}
        <View style={[styles.secondaryGrid, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md }]}>
          {([
            ["Following", stats.following.toLocaleString()],
            ["Posts", stats.posts.toLocaleString()],
            ["Avg likes", stats.avg_likes.toLocaleString()],
            ["Avg comments", stats.avg_comments.toLocaleString()],
          ] as const).map(([label, value]) => (
            <View key={label} style={styles.secondaryCol}>
              <Text style={[theme.type.h4, { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] }]}>{value}</Text>
              <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Top post */}
        <View style={{ gap: 8 }}>
          <Text style={[theme.type.h3, { color: theme.colors.text.primary }]}>Top post</Text>
          <View
            style={[
              styles.topPostCard, theme.elevation.e1,
              { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
            ]}
          >
            <View style={[styles.topPostEmoji, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}>
              <Text style={styles.emoji}>{stats.top_post.emoji}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={[theme.type.body, { color: theme.colors.text.primary }]} numberOfLines={2}>
                {stats.top_post.caption}
              </Text>
              <View style={styles.topPostMeta}>
                <Feather name="heart" size={12} color={theme.colors.text.tertiary} />
                <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{stats.top_post.likes.toLocaleString()}</Text>
                <Feather name="message-circle" size={12} color={theme.colors.text.tertiary} style={{ marginLeft: 8 }} />
                <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{stats.top_post.comments.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={[theme.type.caption, styles.footer, { color: theme.colors.text.tertiary }]}>
          Stats shown are sample data — real Instagram Graph API metrics are a planned upgrade.
          Connection status above is real.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  connectionCard: { padding: 14, gap: 10 },
  connectionRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  igIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  connectButton: { height: 34, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", minWidth: 88 },
  handleRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  handleInput: { flex: 1, height: 40, paddingHorizontal: 12 },
  handleConfirm: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  segmented: { flexDirection: "row", padding: 3, height: 40 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 12 },
  statTile: { flex: 1, gap: 2 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  chartCard: { padding: 14 },
  secondaryGrid: { flexDirection: "row", flexWrap: "wrap", padding: 14 },
  secondaryCol: { width: "50%", gap: 2, paddingVertical: 6 },
  topPostCard: { flexDirection: "row", padding: 14, gap: 12, alignItems: "center" },
  topPostEmoji: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 26 },
  topPostMeta: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  footer: { textAlign: "center", marginTop: 4 },
});
