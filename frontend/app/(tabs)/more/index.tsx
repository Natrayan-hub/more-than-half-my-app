// S23 — More hub: real Settings home. Profile summary + grouped rows
// (Notifications, Privacy, Backup, Automations, Integrations) navigating
// to real sub-screens, plus in-place Smart suggestions toggle and
// system/light/dark theme control (both already fully real).
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { api } from "@/src/api/client";
import { AvatarImage } from "@/src/components/AvatarImage";
import { SettingsGroup, SettingsRow } from "@/src/components/SettingsRow";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/providers/AuthProvider";
import { ThemeMode, useTheme } from "@/src/theme";
import type { Profile } from "@/src/types/models";

const MODES: ThemeMode[] = ["system", "light", "dark"];

export default function MoreScreen() {
  const { theme, mode, setMode } = useTheme();
  const router = useRouter();
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
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[theme.type.h1, { color: theme.colors.text.primary, marginTop: theme.space.sm }]}>More</Text>

        <TouchableOpacity
          onPress={() => router.push("/more/profile")}
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          style={styles.profileRow}
        >
          <AvatarImage avatarUrl={profile?.avatar_url} displayName={profile?.display_name} size={52} />
          <View style={styles.flex}>
            <Text style={[theme.type.h4, { color: theme.colors.text.primary }]} numberOfLines={1}>
              {profile?.display_name || "Your account"}
            </Text>
            {user ? (
              <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={18} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        <View
          style={[
            styles.aiRow,
            {
              backgroundColor: theme.colors.surface.aiSubtle,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: `${theme.colors.ai.default}66`,
            },
          ]}
        >
          <View style={styles.aiText}>
            <Text style={[theme.type.h4, { color: theme.colors.text.primary }]}>Smart suggestions</Text>
            <Text style={[theme.type.caption, { color: theme.colors.ai.onSubtle }]}>
              AI-powered nudges on Today — always explainable, never automatic.
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

        <SettingsGroup title="AI">
          <SettingsRow icon="cpu" title="AI Model" subtitle="Choose GPT or Claude for Smart suggestions" onPress={() => router.push("/more/ai-model")} />
        </SettingsGroup>

        <SettingsGroup title="Data & privacy">
          <SettingsRow icon="shield" title="Privacy Center" subtitle="Local vs. cloud for each data type" onPress={() => router.push("/more/privacy")} />
          <SettingsRow icon="bell" title="Notifications" subtitle="Reminders, AI nudges, digests" onPress={() => router.push("/more/notifications")} />
          <SettingsRow icon="upload-cloud" title="Backup & storage" subtitle="Manual backup, frequency" onPress={() => router.push("/more/backup")} />
        </SettingsGroup>

        <SettingsGroup title="Automation & connections">
          <SettingsRow icon="zap" title="Automations" subtitle="Gym reminders, focus mode, routines" onPress={() => router.push("/more/automations")} />
          <SettingsRow icon="link" title="Integrations" subtitle="Health apps, calendar, Instagram" onPress={() => router.push("/more/integrations")} />
          <SettingsRow icon="instagram" title="Social Stats" subtitle="Followers, reach, engagement" onPress={() => router.push("/more/social")} />
        </SettingsGroup>

        <SettingsGroup title="Appearance">
          <View
            style={[styles.segmented, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm, margin: 10 }]}
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
                    active && [theme.elevation.e1, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.sm - 2 }],
                  ]}
                >
                  <Text
                    style={[
                      theme.type.label,
                      { color: active ? theme.colors.text.primary : theme.colors.text.secondary, textTransform: "capitalize" },
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon="log-out" title="Sign out" danger onPress={signOut} />
        </SettingsGroup>

        <Text style={[theme.type.caption, { color: theme.colors.text.tertiary, textAlign: "center", marginTop: 4 }]}>
          Nannu · v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 16 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  aiText: { flex: 1, gap: 4 },
  segmented: { flexDirection: "row", padding: 3, height: 40 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center" },
});
