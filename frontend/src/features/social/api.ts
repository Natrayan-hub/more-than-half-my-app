// Social Stats screen data layer — MOCK Instagram metrics (see
// mockSocialData.ts) combined with the REAL Instagram connection record
// (same Integration used by Settings > Integrations), so "Connected as
// @handle" is genuine while the numbers stay honestly labeled Sample data
// until the real Graph API integration (P1) lands.
import { connectIntegration, disconnectIntegration, fetchIntegrations } from "@/src/features/integrations/api";
import type { IntegrationCatalogItem } from "@/src/types/models";

export async function fetchInstagramConnection(): Promise<IntegrationCatalogItem> {
  const items = await fetchIntegrations();
  const found = items.find((i) => i.provider === "instagram");
  if (!found) throw new Error("Instagram provider missing from catalog");
  return found;
}

export async function connectInstagram(handle: string): Promise<IntegrationCatalogItem> {
  return connectIntegration("instagram", handle.startsWith("@") ? handle : `@${handle}`);
}

export async function disconnectInstagram(): Promise<void> {
  await disconnectIntegration("instagram");
}
