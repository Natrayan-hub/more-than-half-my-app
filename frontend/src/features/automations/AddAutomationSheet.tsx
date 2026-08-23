// Add custom automation (S28) — simplified MVP creation flow: a time
// trigger (optional days) → a notification message. Location/calendar/task/
// health-threshold triggers and focus-mode/open-feature actions exist in
// the model for presets but aren't exposed in this creation form yet.
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createAutomation } from "@/src/features/automations/api";
import { useTheme } from "@/src/theme";
import type { Automation } from "@/src/types/models";

const DAYS = [
  { key: "mon", label: "M" }, { key: "tue", label: "T" }, { key: "wed", label: "W" },
  { key: "thu", label: "T" }, { key: "fri", label: "F" }, { key: "sat", label: "S" }, { key: "sun", label: "S" },
];

interface AddAutomationSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (automation: Automation) => void;
}

export function AddAutomationSheet({ visible, onClose, onCreated }: AddAutomationSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(""); setTime("08:00"); setDays([]); setMessage(""); setError(null);
  }, [visible]);

  const toggleDay = (key: string) => {
    setDays((d) => (d.includes(key) ? d.filter((x) => x !== key) : [...d, key]));
  };

  const canSave = name.trim().length > 0 && /^\d{1,2}:\d{2}$/.test(time.trim()) && message.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError(null);
    try {
      const automation = await createAutomation({
        name: name.trim(),
        trigger: { type: "time", params: { time: time.trim(), ...(days.length ? { days } : {}) } },
        action: { type: "notification", params: { message: message.trim() } },
        enabled: false,
      });
      onCreated(automation);
      onClose();
    } catch {
      setError("Couldn't create — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: theme.colors.overlay.scrim }]} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View
          style={[
            styles.sheet, theme.elevation.e2,
            { backgroundColor: theme.colors.surface.raised, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, paddingBottom: insets.bottom + theme.space.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.strong }]} />
          <Text style={[theme.type.h2, { color: theme.colors.text.primary, marginBottom: theme.space.md }]}>New automation</Text>

          <ScrollView contentContainerStyle={{ gap: theme.space.md }}>
            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Evening wind-down"
                placeholderTextColor={theme.colors.text.tertiary}
                accessibilityLabel="Automation name"
                style={[styles.input, theme.type.body, { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm }]}
              />
            </View>

            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Trigger time (24h)</Text>
              <TextInput
                value={time}
                onChangeText={setTime}
                placeholder="18:30"
                placeholderTextColor={theme.colors.text.tertiary}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Trigger time"
                style={[styles.input, theme.type.body, { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm }]}
              />
            </View>

            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Repeat on (optional — leave blank for daily)</Text>
              <View style={styles.dayRow}>
                {DAYS.map((d) => {
                  const active = days.includes(d.key);
                  return (
                    <TouchableOpacity
                      key={d.key}
                      onPress={() => toggleDay(d.key)}
                      accessibilityRole="button"
                      accessibilityLabel={d.key}
                      accessibilityState={{ selected: active }}
                      style={[styles.dayChip, { backgroundColor: active ? theme.colors.primary.default : theme.colors.surface.sunken, borderRadius: theme.radius.full }]}
                    >
                      <Text style={[theme.type.labelSm, { color: active ? theme.colors.text.onPrimary : theme.colors.text.secondary }]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Notification message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="e.g. Time to wind down for bed"
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                accessibilityLabel="Notification message"
                style={[styles.input, styles.textArea, theme.type.body, { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm }]}
              />
            </View>

            {error ? <Text style={[theme.type.bodySm, { color: theme.colors.error.text }]}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave || saving}
              accessibilityRole="button"
              accessibilityLabel="Create automation"
              style={[styles.saveButton, { backgroundColor: canSave ? theme.colors.primary.default : theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.text.onPrimary} />
              ) : (
                <Text style={[theme.type.label, { color: canSave ? theme.colors.text.onPrimary : theme.colors.text.disabled, fontSize: 16 }]}>
                  Create (starts disabled)
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: { paddingHorizontal: 16, paddingTop: 8, maxHeight: "88%" },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, marginBottom: 12 },
  input: { height: 52, borderWidth: 1.5, paddingHorizontal: 16 },
  textArea: { height: 80, textAlignVertical: "top", paddingTop: 14 },
  dayRow: { flexDirection: "row", gap: 8 },
  dayChip: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  saveButton: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
