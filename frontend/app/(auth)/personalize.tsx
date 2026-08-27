// S5 — Personalization: name, wake time, focus areas, AI opt-in.
// Saves to Profile and seeds AIMemoryEntry rows (visible/editable in S35
// later). Entirely skippable — defaults work.
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import { api, ApiError } from "@/src/api/client";
import { OnboardingScaffold } from "@/src/features/onboarding/OnboardingScaffold";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/theme";
import type { Profile } from "@/src/types/models";

const WAKE_TIMES = ["06:00", "06:30", "07:00", "08:00"];
const FOCUS_AREAS: { key: string; label: string }[] = [
  { key: "fitness", label: "Fitness & health" },
  { key: "tasks", label: "Focus & tasks" },
  { key: "documents", label: "Documents in order" },
  { key: "family", label: "Family schedule" },
  { key: "creator", label: "Creator growth" },
];

export default function PersonalizeScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { profile, setProfile, completeOnboarding } = useAuth();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [wakeTime, setWakeTime] = useState("06:30");
  const [focus, setFocus] = useState<string[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFocus = (key: string) =>
    setFocus((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const finish = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await api.patch<Profile>("/me/profile", {
        display_name: name.trim() || profile?.display_name,
        wake_time: wakeTime,
        focus_areas: focus,
        ai_enabled: aiEnabled,
      });
      setProfile(updated);
      if (aiEnabled) {
        // Seed AI memory (viewable/editable later in "What Nannu remembers").
        await api.post("/ai/memory", {
          domain: "routine",
          statement: `Usually starts the day around ${wakeTime}`,
          structured: { key: "wake_time", value: wakeTime, confidence: 1 },
          provenance: { source: "onboarding" },
          author: "user",
        });
        if (focus.length > 0) {
          await api.post("/ai/memory", {
            domain: "preference",
            statement: `Cares most about: ${focus.join(", ")}`,
            structured: { key: "focus_areas", value: focus.join(","), confidence: 1 },
            provenance: { source: "onboarding" },
            author: "user",
          });
        }
      }
      await completeOnboarding(); // root guard redirects to Today
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "NETWORK_ERROR"
          ? "You're offline — connect to finish, or skip for now."
          : "Couldn't save — please try again.",
      );
      setLoading(false);
    }
  };

  const skip = async () => {
    await completeOnboarding();
  };

  const chip = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected
        ? theme.colors.surface.primarySubtle
        : theme.colors.surface.sunken,
      borderRadius: theme.radius.full,
    },
  ];
  const chipText = (selected: boolean) => [
    theme.type.label,
    { color: selected ? theme.colors.primary.subtleText : theme.colors.text.secondary },
  ];

  return (
    <OnboardingScaffold
      step={4}
      title="Make it yours"
      subtitle="A couple of details so Today greets you right. All optional."
      primaryLabel="Take me to Today"
      onPrimary={finish}
      loading={loading}
      skipLabel="Skip for now"
      onSkip={skip}
    >
      <View style={{ gap: theme.space.lg }}>
        {error ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: theme.colors.error.subtleBg, borderRadius: theme.radius.sm },
            ]}
          >
            <Text style={[theme.type.bodySm, { color: theme.colors.error.text }]}>{error}</Text>
          </View>
        ) : null}

        <View style={{ gap: theme.space["2xs"] }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>
            What should we call you?
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={theme.colors.text.tertiary}
            accessibilityLabel="Your name"
            style={[
              styles.input,
              theme.type.body,
              {
                color: theme.colors.text.primary,
                backgroundColor: theme.colors.surface.default,
                borderColor: theme.colors.border.strong,
                borderRadius: theme.radius.sm,
              },
            ]}
          />
        </View>

        <View style={{ gap: theme.space.xs }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>
            When does your day usually start?
          </Text>
          <View style={styles.chipRow}>
            {WAKE_TIMES.map((time) => (
              <TouchableOpacity
                key={time}
                onPress={() => setWakeTime(time)}
                accessibilityRole="button"
                accessibilityLabel={`Wake time ${time}`}
                accessibilityState={{ selected: wakeTime === time }}
                style={chip(wakeTime === time)}
              >
                <Text style={chipText(wakeTime === time)}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ gap: theme.space.xs }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>
            What matters most right now?
          </Text>
          <View style={styles.chipRow}>
            {FOCUS_AREAS.map((area) => (
              <TouchableOpacity
                key={area.key}
                onPress={() => toggleFocus(area.key)}
                accessibilityRole="button"
                accessibilityLabel={area.label}
                accessibilityState={{ selected: focus.includes(area.key) }}
                style={chip(focus.includes(area.key))}
              >
                <Text style={chipText(focus.includes(area.key))}>{area.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View
          style={[
            styles.aiCard,
            {
              backgroundColor: theme.colors.surface.aiSubtle,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: `${theme.colors.ai.default}66`,
            },
          ]}
        >
          <View style={styles.aiText}>
            <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>
              Smart suggestions
            </Text>
            <Text style={[theme.type.caption, { color: theme.colors.ai.onSubtle }]}>
              Helpful nudges that always explain themselves. Off by default — you can
              change this anytime, and see everything Nannu remembers.
            </Text>
          </View>
          <Switch
            value={aiEnabled}
            onValueChange={setAiEnabled}
            trackColor={{ false: theme.colors.border.strong, true: theme.colors.ai.default }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Enable smart suggestions"
          />
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  aiCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  aiText: { flex: 1, gap: 4 },
  errorBanner: { padding: 12 },
});
