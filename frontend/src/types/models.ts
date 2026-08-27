// LifeOS entity types — mirrors backend/models (Technical Foundation Part A).
// Keep field names/enums in lockstep with the Pydantic models.

export type UUID = string;
export type ISODate = string;

// ---- Sync base --------------------------------------------------------------

export interface Syncable {
  id: UUID;
  user_id: UUID;
  version: number;
  device_id?: UUID | null;
  created_at: ISODate;
  updated_at: ISODate;
  deleted_at?: ISODate | null;
}

// Client-only sync bookkeeping
export type SyncState = "synced" | "pending" | "conflict";

// ---- User & profile ---------------------------------------------------------

export type Plan = "free" | "plus";

export interface User {
  id: UUID;
  email: string;
  auth_provider: "password" | "google";
  email_verified: boolean;
  plan: Plan;
  status: "active" | "deletion_pending" | "deleted";
  mfa_enabled: boolean;
}

export type FocusArea = "fitness" | "tasks" | "documents" | "family" | "creator";

export interface Profile {
  id: UUID;
  user_id: UUID;
  display_name: string;
  avatar_url?: string | null;
  wake_time: string; // "HH:MM"
  focus_areas: FocusArea[];
  units: "metric" | "imperial";
  theme: "system" | "light" | "dark";
  ai_enabled: boolean;
  timezone: string;
}

// ---- Tasks ------------------------------------------------------------------

export type TaskBucket = "today" | "upcoming" | "someday";

export interface Project extends Syncable {
  name: string;
  color: string;
  sort_order: number;
  archived: boolean;
}

export interface Task extends Syncable {
  project_id?: UUID | null;
  parent_task_id?: UUID | null;
  title: string;
  notes?: string | null;
  due_at?: ISODate | null;
  all_day: boolean;
  reminder_at?: ISODate | null;
  recurrence?: string | null; // RRULE
  priority: 0 | 1 | 2 | 3;
  tags: string[];
  bucket: TaskBucket;
  sort_order: number;
  completed_at?: ISODate | null;
  source: "user" | "automation" | "suggestion";
  source_ref_id?: UUID | null;
}

// ---- Health -----------------------------------------------------------------

export type ManualHealthType = "water" | "mood" | "weight";

export interface HealthEntry extends Syncable {
  type: ManualHealthType;
  value: number;
  note?: string | null;
  logged_at: ISODate;
}

export type HealthMetric =
  | "steps" | "sleep" | "heart_rate" | "active_energy"
  | "workout" | "weight" | "recovery" | "stress";

// LOCAL-ONLY by default (S34) — uploaded only after explicit opt-in.
export interface HealthCacheSample {
  id: UUID;
  user_id: UUID;
  metric: HealthMetric;
  value: number;
  unit: string;
  start_at: ISODate;
  end_at: ISODate;
  source: "apple_health" | "health_connect" | "garmin";
  readiness_input: boolean;
}

// ---- Documents --------------------------------------------------------------

export type DocumentCategory = "id" | "finance" | "medical" | "warranty" | "travel" | "other";

export interface DetectedFields {
  date?: ISODate;
  amount?: number;
  currency?: string;
  vendor?: string;
  expiry_date?: ISODate;
}

export interface Document extends Syncable {
  title: string;
  category: DocumentCategory;
  kind: "document" | "photo";
  tags: string[];
  detected_fields: DetectedFields;
  ocr_text?: string | null;
  expiry_reminder_task_id?: UUID | null;
  storage_policy: "cloud" | "local_only";
  size_bytes: number;
  content_base64?: string | null;
  thumb_base64?: string | null;
}

export interface DocumentPage {
  id: UUID;
  document_id: UUID;
  page_number: number;
  object_key: string;
  thumb_object_key: string;
  ocr_status: "pending" | "done" | "failed";
}

// ---- Integrations -----------------------------------------------------------

export type Provider =
  | "apple_health" | "health_connect" | "google_calendar" | "apple_calendar"
  | "garmin" | "instagram" | "notion" | "alexa";

export interface Integration {
  id: UUID;
  user_id: UUID;
  provider: Provider;
  status: "connected" | "error" | "expired" | "disconnected";
  scopes: string[];
  direction: "read" | "write" | "two_way";
  last_sync_at?: ISODate | null;
  last_error?: string | null;
  external_account?: string | null;
}

// GET /integrations — catalog merged with this user's connection state.
export interface IntegrationCatalogItem {
  provider: Provider;
  label: string;
  direction: "read" | "write" | "two_way";
  blurb: string;
  status: "connected" | "not_connected" | "error" | "expired" | "disconnected";
  external_account?: string | null;
  last_sync_at?: ISODate | null;
}

// ---- Automations --------------------------------------------------------------

export type AutomationTriggerType = "time" | "location" | "calendar" | "task" | "health_threshold";
export type AutomationActionType = "notification" | "focus_mode" | "open_feature";

export interface AutomationTrigger {
  type: AutomationTriggerType;
  params: Record<string, unknown>;
}

export interface AutomationAction {
  type: AutomationActionType;
  params: Record<string, unknown>;
}

export interface Automation extends Syncable {
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled: boolean;
  is_preset: boolean;
  last_run_at?: ISODate | null;
  last_run_status?: "success" | "failed" | null;
}

// ---- AI ---------------------------------------------------------------------

export interface AIMemoryEntry extends Syncable {
  domain: "routine" | "preference" | "dismissal";
  statement: string;
  structured: { key?: string; value?: string; confidence?: number };
  provenance: { source: "learned" | "onboarding" | "user_added"; evidence?: string };
  author: "system" | "user";
}

export interface SuggestionSource {
  type: string; // "health.sleep", "calendar.gap", ...
  value: string;
}

export interface Suggestion {
  id: UUID;
  user_id: UUID;
  kind: "reschedule_task" | "schedule_gap" | "reminder" | "recipe" | "insight";
  text: string;
  reason: string; // "based on…"
  sources: SuggestionSource[];
  proposed_action?: Record<string, unknown> | null;
  status: "pending" | "accepted" | "dismissed" | "expired";
  expires_at?: ISODate | null;
}

// ---- Notifications ----------------------------------------------------------

export interface NotificationItem {
  id: UUID;
  user_id: UUID;
  category: "suggestion" | "reminder" | "sync" | "system";
  title: string;
  body: string;
  deeplink: string;
  read_at?: ISODate | null;
  created_at: ISODate;
}

// ---- Preferences (settings singleton) ---------------------------------------

export interface DataControls {
  tasks: "cloud" | "local";
  documents: "cloud" | "local";
  health_cache: "cloud" | "local";
  ai_memory: "cloud" | "local" | "off";
  photos: "cloud" | "off";
}

export interface DisplayPrefs {
  font_scale: number;
  reduce_motion: boolean;
}

export interface BackupPrefs {
  frequency: "manual" | "daily" | "weekly";
  last_backup_at?: ISODate | null;
}

export interface Preference {
  id: UUID; // == user_id
  user_id: UUID;
  notif_prefs: {
    task_reminders: boolean;
    ai_suggestions: boolean;
    suggestions_per_day: number;
    health_nudges: boolean;
    backup_alerts: "failures_only" | "all" | "off";
    weekly_recap: "in_app" | "push" | "email";
    quiet_hours: { start: string; end: string };
    automation_alerts: boolean;
    email_digests: boolean;
  };
  sync_prefs: { wifi_only: boolean; background: boolean };
  data_controls: DataControls;
  display_prefs: DisplayPrefs;
  backup_prefs: BackupPrefs;
  ai_prefs: { model: string };
  app_lock: { enabled: boolean; scope: "vault" | "app"; auto_lock_min: number };
  today_cards: { key: string; visible: boolean; pinned: boolean }[];
}

// ---- Sync protocol (POST /sync) ----------------------------------------------

export interface SyncPushOp {
  entity_type: string;
  entity_id: UUID;
  op: "create" | "update" | "delete";
  version: number;
  data: Record<string, unknown>;
}

export interface SyncPullOp {
  server_seq: number;
  entity_type: string;
  op: "create" | "update" | "delete";
  data: Record<string, unknown>;
}

export interface SyncResponse {
  results: {
    entity_id: UUID;
    status: "applied" | "conflict" | "rejected_policy" | "invalid";
    new_version?: number;
    server_seq?: number;
  }[];
  pull: SyncPullOp[];
  next_cursor: number;
  has_more: boolean;
}
