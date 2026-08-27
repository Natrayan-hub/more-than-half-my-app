// AI Model selection — user picks which model (GPT or one of several
// Claude models) powers the Today Suggestion engine. Real GET/PUT against
// Preference.ai_prefs.model (backend resolves unknown/legacy values to the
// default, so this can never brick the suggestion engine).
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import { AI_MODEL_CATALOG, DEFAULT_AI_MODEL_KEY } from "@/src/features/preferences/aiModels";
import { fetchPreferences, savePreferences } from "@/src/features/preferences/api";
import { useTheme } from "@/src/theme";
import type { Preference } from "@/src/types/models";

export default function AiModelScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const [pref, setPref] = useState<Preference | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences()
      .then(setPref)
      .catch(() => toast.show({ message: "Couldn't load AI model settings" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once
  }, []);

  const selectedKey = pref?.ai_prefs?.model || DEFAULT_AI_MODEL_KEY;

  const handleSelect = useCallback(async (key: string) => {
    if (!pref || key === selectedKey) return;
    const prevAiPrefs = pref.ai_prefs;
    setPref((p) => (p ? { ...p, ai_prefs: { model: key } } : p));
    setSavingKey(key);
    try {
      const saved = await savePreferences({ ...pref, ai_prefs: { model: key } });
      setPref(saved);
    } catch {
      setPref((p) => (p ? { ...p, ai_prefs: prevAiPrefs } : p));
      toast.show({ message: "Couldn't save — try again" });
    } finally {
      setSavingKey(null);
    }
  }, [pref, selectedKey, toast]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="AI Model" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary }]}>
          Choose which model powers Smart suggestions on your Today screen. Nothing about
          what data is sent changes — see Privacy Center for that.
        </Text>

        {loading ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={68} radius={theme.radius.md} />)}
          </View>
        ) : (
          <View
            style={[
              styles.listCard, theme.elevation.e1,
              { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
            ]}
          >
            {AI_MODEL_CATALOG.map((option, i) => {
              const selected = option.key === selectedKey;
              const saving = savingKey === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => handleSelect(option.key)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  style={[
                    styles.row,
                    i < AI_MODEL_CATALOG.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border.default },
                  ]}
                >
                  <View style={styles.flex}>
                    <View style={styles.labelRow}>
                      <Text style={[theme.type.body, { color: theme.colors.text.primary }]}>{option.label}</Text>
                      <View
                        style={[
                          styles.providerChip,
                          { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.full },
                        ]}
                      >
                        <Text style={[theme.type.labelSm, { color: theme.colors.text.tertiary }]}>{option.provider}</Text>
                      </View>
                    </View>
                    <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]}>{option.description}</Text>
                  </View>
                  {saving ? (
                    <Feather name="loader" size={18} color={theme.colors.text.tertiary} />
                  ) : selected ? (
                    <Feather name="check-circle" size={20} color={theme.colors.primary.default} />
                  ) : (
                    <Feather name="circle" size={20} color={theme.colors.border.strong} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  listCard: { paddingHorizontal: 14, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 10 },
  flex: { flex: 1, gap: 3 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  providerChip: { paddingHorizontal: 8, height: 20, alignItems: "center", justifyContent: "center" },
});
