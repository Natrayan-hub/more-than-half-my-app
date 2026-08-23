// Integrations & Connected Accounts (S26) — real connect/disconnect (mock
// OAuth — no live third-party auth yet, wired so a real provider swap-in
// later needs no UI change).
import React, { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { CardError } from "@/src/components/Card";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import { connectIntegration, disconnectIntegration, fetchIntegrations } from "@/src/features/integrations/api";
import { IntegrationRow } from "@/src/features/integrations/IntegrationRow";
import { useCardData } from "@/src/features/today/useCardData";
import { useTheme } from "@/src/theme";
import type { IntegrationCatalogItem, Provider } from "@/src/types/models";

export default function IntegrationsScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [refreshing, setRefreshing] = React.useState(false);

  const integrationsData = useCardData<IntegrationCatalogItem[]>("integrations.list", fetchIntegrations);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await integrationsData.refetch();
    setRefreshing(false);
  }, [integrationsData]);

  const handleConnect = useCallback(async (provider: Provider) => {
    try {
      const updated = await connectIntegration(provider);
      integrationsData.mutate((current) =>
        (current ?? []).map((i) => (i.provider === provider ? updated : i)));
      toast.show({ message: `${updated.label} connected` });
    } catch {
      toast.show({ message: "Couldn't connect — try again" });
    }
  }, [integrationsData, toast]);

  const handleDisconnect = useCallback(async (item: IntegrationCatalogItem) => {
    try {
      await disconnectIntegration(item.provider);
      integrationsData.mutate((current) =>
        (current ?? []).map((i) => (i.provider === item.provider ? { ...i, status: "not_connected", external_account: null } : i)));
      toast.show({ message: `${item.label} disconnected` });
    } catch {
      toast.show({ message: "Couldn't disconnect — try again" });
    }
  }, [integrationsData, toast]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Integrations" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary.default} />}
      >
        <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary }]}>
          Connect apps and services LifeOS can read from (and, for two-way providers, write to).
        </Text>

        {integrationsData.loading ? (
          <View style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={64} radius={theme.radius.sm} />)}
          </View>
        ) : integrationsData.error ? (
          <CardError message={integrationsData.error} onRetry={integrationsData.refetch} />
        ) : (
          <View
            style={[
              styles.listCard, theme.elevation.e1,
              { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
            ]}
          >
            {(integrationsData.data ?? []).map((item) => (
              <IntegrationRow
                key={item.provider}
                item={item}
                onConnect={() => handleConnect(item.provider)}
                onDisconnect={() => handleDisconnect(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  listCard: { paddingHorizontal: 14, overflow: "hidden" },
});
