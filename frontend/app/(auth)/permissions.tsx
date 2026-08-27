// S3 — Permissions: benefit-first cards. Per the permissions contract we
// record the user's intent here and trigger the actual OS prompt contextually
// on first use of each feature (never a wall of system dialogs up front).
// Denial never blocks — each card explains what's affected.
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { OnboardingScaffold } from "@/src/features/onboarding/OnboardingScaffold";
import { useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

export const PERMISSION_INTENTS_KEY = "lifeos.permissions.intents";

type Intent = "allowed" | "skipped" | undefined;

interface PermissionItem {
  key: string;
  icon: keyof typeof Feather.glyphMap;
  title: string;
  benefit: string;
  affected: string;
}

const PERMISSIONS: PermissionItem[] = [
  {
    key: "health",
    icon: "heart",
    title: "Health data",
    benefit: "See your sleep and steps on Today",
    affected: "Health cards will show sample data until connected.",
  },
  {
    key: "notifications",
    icon: "bell",
    title: "Notifications",
    benefit: "Reminders for tasks, at the right time",
    affected: "You won't get task reminders — everything else works.",
  },
  {
    key: "camera",
    icon: "camera",
    title: "Camera & photos",
    benefit: "Scan receipts and documents to file them",
    affected: "You can still import files instead of scanning.",
  },
];

export default function PermissionsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [intents, setIntents] = useState<Record<string, Intent>>({});

  const choose = (key: string, intent: Intent) => {
    const next = { ...intents, [key]: intent };
    setIntents(next);
    storage.setItem(PERMISSION_INTENTS_KEY, JSON.stringify(next));
  };

  return (
    <OnboardingScaffold
      step={3}
      title="Only what's needed"
      subtitle="Nannu asks for each permission with the system prompt the first time you use the feature — nothing up front, nothing hidden."
      primaryLabel="Continue"
      onPrimary={() => router.push("/(auth)/personalize")}
      skipLabel="Decide later"
      onSkip={() => router.push("/(auth)/personalize")}
    >
      <View style={{ gap: theme.space.sm }}>
        {PERMISSIONS.map((item) => {
          const intent = intents[item.key];
          return (
            <View
              key={item.key}
              style={[
                styles.card,
                theme.elevation.e1,
                { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
              ]}
            >
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.xs },
                  ]}
                >
                  <Feather name={item.icon} size={20} color={theme.colors.primary.subtleText} />
                </View>
                <View style={styles.cardText}>
                  <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>
                    {item.title}
                  </Text>
                  <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary }]}>
                    {item.benefit}
                  </Text>
                </View>
              </View>

              {intent ? (
                <View style={styles.statusRow}>
                  <Feather
                    name={intent === "allowed" ? "check-circle" : "minus-circle"}
                    size={14}
                    color={
                      intent === "allowed"
                        ? theme.colors.success.default
                        : theme.colors.text.tertiary
                    }
                  />
                  <Text
                    style={[
                      theme.type.caption,
                      styles.flex,
                      {
                        color:
                          intent === "allowed"
                            ? theme.colors.success.text
                            : theme.colors.text.tertiary,
                      },
                    ]}
                  >
                    {intent === "allowed"
                      ? "We'll ask with the system prompt on first use"
                      : item.affected}
                  </Text>
                  <TouchableOpacity
                    onPress={() => choose(item.key, undefined)}
                    accessibilityRole="button"
                    accessibilityLabel={`Change ${item.title} choice`}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={[theme.type.labelSm, { color: theme.colors.text.link }]}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    onPress={() => choose(item.key, "allowed")}
                    accessibilityRole="button"
                    accessibilityLabel={`Allow ${item.title}`}
                    style={[
                      styles.allowButton,
                      { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.sm },
                    ]}
                  >
                    <Text style={[theme.type.label, { color: theme.colors.primary.subtleText }]}>
                      Allow
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => choose(item.key, "skipped")}
                    accessibilityRole="button"
                    accessibilityLabel={`Not now: ${item.title}`}
                    style={styles.notNowButton}
                  >
                    <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>
                      Not now
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, gap: 2 },
  buttonRow: { flexDirection: "row", gap: 8 },
  allowButton: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  notNowButton: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flex: 1 },
});
