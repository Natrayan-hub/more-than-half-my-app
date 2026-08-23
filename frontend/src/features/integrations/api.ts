// Integrations & Connected Accounts (IA S26) — shared between the Settings
// screen's Integrations section and the Social Stats screen's Instagram
// connect/disconnect (same backend record, same source of truth).
import { api } from "@/src/api/client";
import type { IntegrationCatalogItem, Provider } from "@/src/types/models";

export async function fetchIntegrations(): Promise<IntegrationCatalogItem[]> {
  const res = await api.get<{ items: IntegrationCatalogItem[] }>("/integrations");
  return res.items;
}

export async function connectIntegration(provider: Provider, externalAccount?: string): Promise<IntegrationCatalogItem> {
  return api.post<IntegrationCatalogItem>(`/integrations/${provider}/connect`, {
    external_account: externalAccount,
  });
}

export async function disconnectIntegration(provider: Provider): Promise<void> {
  await api.post(`/integrations/${provider}/disconnect`);
}
