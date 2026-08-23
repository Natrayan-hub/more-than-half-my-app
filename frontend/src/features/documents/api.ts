// Documents & Photo Backup (IA S18 + S22, condensed) — real CRUD against
// the existing Document model. Storage quota is illustrative (see backend
// comment); everything else here is genuine data.
import { api } from "@/src/api/client";
import type { Document, DocumentCategory } from "@/src/types/models";

export interface StorageSummary {
  used_bytes: number;
  quota_bytes: number;
  last_backup_at?: string | null;
  backup_frequency: "manual" | "daily" | "weekly";
}

export async function fetchDocuments(kind: "document" | "photo"): Promise<Document[]> {
  const res = await api.get<{ items: Document[] }>("/documents", { kind });
  return res.items;
}

export interface CreateDocumentInput {
  title: string;
  category?: DocumentCategory;
  kind: "document" | "photo";
  content_base64?: string;
  thumb_base64?: string;
  size_bytes?: number;
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  return api.post<Document>("/documents", input);
}

export async function deleteDocument(id: string): Promise<void> {
  await api.del(`/documents/${id}`);
}

export async function fetchStorageSummary(): Promise<StorageSummary> {
  return api.get<StorageSummary>("/documents/storage/summary");
}

export async function backupNow(): Promise<StorageSummary> {
  return api.post<StorageSummary>("/documents/backup");
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  const gb = bytes / 1_000_000_000;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1_000_000;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
