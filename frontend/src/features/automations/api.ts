// Automations (IA S28/S29) — real CRUD + test-run against the existing
// Automation model/routes.
import { api } from "@/src/api/client";
import type { Automation, AutomationAction, AutomationTrigger } from "@/src/types/models";

export async function fetchAutomations(): Promise<Automation[]> {
  const res = await api.get<{ items: Automation[] }>("/automations");
  return res.items;
}

export interface CreateAutomationInput {
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  enabled?: boolean;
}

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
  return api.post<Automation>("/automations", input);
}

export async function patchAutomation(
  id: string,
  patch: Partial<Pick<Automation, "name" | "trigger" | "action" | "enabled">>,
): Promise<Automation> {
  return api.patch<Automation>(`/automations/${id}`, patch);
}

export async function testRunAutomation(id: string): Promise<Automation> {
  return api.post<Automation>(`/automations/${id}/test-run`);
}

export async function deleteAutomation(id: string): Promise<void> {
  await api.del(`/automations/${id}`);
}

export function describeTrigger(trigger: AutomationTrigger): string {
  switch (trigger.type) {
    case "time": {
      const time = (trigger.params.time as string) ?? "";
      const days = trigger.params.days as string[] | undefined;
      return days?.length ? `At ${time} on ${days.map((d) => d.slice(0, 3)).join(", ")}` : `Daily at ${time}`;
    }
    case "location":
      return "When you arrive/leave a place";
    case "calendar":
      return `Calendar event matches "${trigger.params.event_keyword ?? ""}"`;
    case "task":
      return "When a task is completed";
    case "health_threshold":
      return "When a health metric crosses a threshold";
    default:
      return "Custom trigger";
  }
}

export function describeAction(action: AutomationAction): string {
  switch (action.type) {
    case "notification":
      return (action.params.message as string) || "Send a notification";
    case "focus_mode":
      return "Turn on focus mode";
    case "open_feature":
      return "Open a feature in the app";
    default:
      return "Custom action";
  }
}
