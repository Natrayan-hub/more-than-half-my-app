// S23 — More hub (stub) + theme mode control so light/dark theming is
// verifiable now; this control graduates to General Settings (S25) later.
import React, { useState } from "react";
import { StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { api } from "@/src/api/client";
import { useToast } from "@/src/components/Toast";
import { StubScreen } from "@/src/components/StubScreen";
import { useAuth } from "@/src/providers/AuthProvider";
import { ThemeMode, useTheme } from "@/src/theme";
import type { Profile } from "@/src/types/models";

const MODES: ThemeMode[] = ["system", "light", "dark"];

export default function MoreScreen() {
  const { theme, mode, setMode } = useTheme();
  const { user, profile, setProfile, signOut } = useAuth();
  const toast = useToast();
  const [aiSaving, setAiSaving] = useState(false);

  const handleToggleAi = async (value: boolean) => {
    setAiSaving(true);
    try {
      const updated = await api.patch<Profile>("/me/profile", { ai_enabled: value });
      setProfile(updated);
    } catch {
      toast.show({ message: "Couldn't update — try again" });
    } finally {
      setAiSaving(false);
    }
  };

  return (
    <StubScreen
      title="More"
      icon="grid"
      description="Profile, integrations, privacy center, backup, and settings live here."
    >
      <View
        style={[
          styles.aiRow,
          {
            backgroundColor: theme.colors.surface.aiSubtle,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: `${theme.colors.ai.default}66`,
            marginTop: theme.space.lg,
          },
        ]}
      >
        <View style={styles.aiText}>
          <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>
            Smart suggestions
          </Text>
          <Text style={[theme.type.caption, { color: theme.colors.ai.onSubtle }]}>
            ChatGPT-powered nudges on Today — always explainable, never automatic.
          </Text>
        </View>
        <Switch
          value={profile?.ai_enabled ?? false}
          onValueChange={handleToggleAi}
          disabled={aiSaving}
          trackColor={{ false: theme.colors.border.strong, true: theme.colors.ai.default }}
          thumbColor="#FFFFFF"
          accessibilityLabel="Enable smart suggestions"
        />
      </View>

      <View
        style={[
          styles.segmented,
          {
            backgroundColor: theme.colors.surface.sunken,
            borderRadius: theme.radius.sm,
            marginTop: theme.space.lg,
          },
        ]}
      >
        {MODES.map((m) => {
          const active = mode === m;
          return (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              accessibilityRole="button"
              accessibilityLabel={`${m} theme`}
              accessibilityState={{ selected: active }}
              style={[
                styles.segment,
                active && [
                  theme.elevation.e1,
                  {
                    backgroundColor: theme.colors.surface.default,
                    borderRadius: theme.radius.sm - 2,
                  },
                ],
              ]}
            >
              <Text
                style={[
                  theme.type.label,
                  {
                    color: active
                      ? theme.colors.text.primary
                      : theme.colors.text.secondary,
                    textTransform: "capitalize",
                  },
                ]}
              >
                {m}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ marginTop: theme.space.lg, alignItems: "center", gap: theme.space.xs }}>
        {user ? (
          <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
            Signed in as {user.email}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={signOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={styles.signOut}
        >
          <Text style={[theme.type.label, { color: theme.colors.error.text }]}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </StubScreen>
  );
}

const styles = StyleSheet.create({
  aiRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    alignSelf: "stretch",
  },
  aiText: { flex: 1, gap: 4 },
  segmented: {
    flexDirection: "row",
    padding: 3,
    height: 40,
    alignSelf: "stretch",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  signOut: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});
