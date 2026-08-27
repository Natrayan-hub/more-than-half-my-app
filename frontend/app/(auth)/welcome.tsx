// S1 — Welcome: calm intro to the command-center promise.
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { OnboardingScaffold } from "@/src/features/onboarding/OnboardingScaffold";
import { useTheme } from "@/src/theme";

const VALUES: { icon: keyof typeof Feather.glyphMap; title: string; body: string }[] = [
  {
    icon: "sun",
    title: "One glance, one answer",
    body: "Tasks, health, documents, and your day — together on a single Today screen.",
  },
  {
    icon: "lock",
    title: "Private by design",
    body: "Your data stays on your device unless you choose to sync it. No ads, ever.",
  },
  {
    icon: "zap",
    title: "A quiet assistant",
    body: "Helpful suggestions that always explain themselves — and never act without you.",
  },
];

export default function WelcomeScreen() {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <OnboardingScaffold
      title="Your life, in one calm place"
      subtitle="Nannu brings the pieces of your day together — privately."
      primaryLabel="Get started"
      onPrimary={() => router.push("/(auth)/account?mode=signup")}
      skipLabel="I already have an account"
      onSkip={() => router.push("/(auth)/account?mode=signin")}
      showBack={false}
    >
      <View style={{ gap: theme.space.lg }}>
        {VALUES.map((item) => (
          <View key={item.title} style={styles.row}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: theme.colors.surface.primarySubtle },
              ]}
            >
              <Feather name={item.icon} size={20} color={theme.colors.primary.subtleText} />
            </View>
            <View style={styles.rowText}>
              <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>
                {item.title}
              </Text>
              <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary }]}>
                {item.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, gap: 2 },
});
