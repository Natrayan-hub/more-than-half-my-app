// Social snapshot card — SocialStat shape, MOCK until the Instagram Graph
// API integration (P1) connects. Honestly labeled with a "Sample" chip.
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/src/components/Card";
import { useTheme } from "@/src/theme";
import type { SocialSnapshot } from "@/src/features/today/mocks";

interface StatProps {
  label: string;
  value: string;
  delta?: string;
}

function Stat({ label, value, delta }: StatProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{label}</Text>
      <Text
        style={[
          theme.type.h3,
          { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] },
        ]}
      >
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

export function SocialCard({ snapshot, onOpen }: { snapshot: SocialSnapshot; onOpen: () => void }) {
  const { theme } = useTheme();

  return (
    <Card onPress={onOpen} accessibilityLabel="Social stats, open Instagram details">
      <View style={styles.headerRow}>
        <CardHeaderInline />
        <View
          style={[
            styles.sampleChip,
            { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.full },
          ]}
        >
          <Text style={[theme.type.labelSm, { color: theme.colors.text.secondary }]}>Sample</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <Stat
          label="Followers"
          value={snapshot.followers.toLocaleString()}
          delta={`+${snapshot.followers_delta} today`}
        />
        <Stat label="Reach" value={snapshot.reach.toLocaleString()} />
        <Stat label="Engagement" value={`${snapshot.engagement_rate}%`} />
      </View>
      <Text
        style={[
          theme.type.caption,
          { color: theme.colors.text.tertiary, marginTop: theme.space.sm },
        ]}
      >
        Tap for growth chart & connection status
      </Text>
    </Card>
  );
}

function CardHeaderInline() {
  const { theme } = useTheme();
  return (
    <View style={styles.headerLeft}>
      <Feather name="instagram" size={16} color={theme.colors.ai.default} />
      <Text
        style={[
          theme.type.labelSm,
          { color: theme.colors.text.secondary, textTransform: "uppercase" },
        ]}
      >
        Social
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sampleChip: { paddingHorizontal: 8, paddingVertical: 2 },
  stats: { flexDirection: "row", gap: 12 },
  stat: { flex: 1, gap: 2 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 2 },
});
