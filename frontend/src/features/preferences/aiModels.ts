// Mirrors backend/core/ai_models.py AI_MODEL_CATALOG — keep both in sync if
// this list changes. Powers the AI Model picker (Settings > AI Model),
// which currently drives the Today Suggestion engine's model choice.
export interface AiModelOption {
  key: string;
  label: string;
  provider: "OpenAI" | "Anthropic";
  description: string;
}

export const AI_MODEL_CATALOG: AiModelOption[] = [
  { key: "gpt-5.4", label: "GPT-5.4", provider: "OpenAI", description: "Balanced, general-purpose (default)" },
  { key: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "Anthropic", description: "Latest, most capable" },
  { key: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic", description: "Strong reasoning, recommended" },
  { key: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic", description: "Fastest, lightweight" },
];

export const DEFAULT_AI_MODEL_KEY = "gpt-5.4";
