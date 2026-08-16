// Manual Health Log (IA S16-lite): fast logging of water / mood / weight for
// users without wearables. Segmented type selector (locked in edit mode) ->
// type-specific input -> Save. Offline-friendly: caller decides retry/toast.
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logHealthEntry, updateHealthEntry } from "@/src/features/health/api";
import { useTheme } from "@/src/theme";
import type { HealthEntry, ManualHealthType } from "@/src/types/models";

const TYPES: { key: ManualHealthType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "water", label: "Water", icon: "droplet" },
  { key: "mood", label: "Mood", icon: "smile" },
  { key: "weight", label: "Weight", icon: "trending-up" },
];

const WATER_STEP = 250;
const MOOD_EMOJI = ["\u{1F61E}", "\u{1F641}", "\u{1F610}", "\u{1F642}", "\u{1F604}"]; // 1..5

interface ManualLogSheetProps {
  visible: boolean;
  initialType: ManualHealthType;
  editingEntry?: HealthEntry | null; // present -> edit mode, type locked
  onClose: () => void;
  onSaved: (entry: HealthEntry, wasEdit: boolean) => void;
}

export function ManualLogSheet({
  visible, initialType, editingEntry, onClose, onSaved,
}: ManualLogSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<ManualHealthType>(initialType);
  const [waterMl, setWaterMl] = useState(WATER_STEP);
  const [mood, setMood] = useState(4);
  const [note, setNote] = useState("");
  const [weightValue, setWeightValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form each time the sheet opens (fresh log vs. edit prefill).
  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSaving(false);
    if (editingEntry) {
      setType(editingEntry.type);
      if (editingEntry.type === "water") setWaterMl(editingEntry.value);
      if (editingEntry.type === "mood") setMood(editingEntry.value);
      if (editingEntry.type === "weight") setWeightValue(String(editingEntry.value));
      setNote(editingEntry.note ?? "");
    } else {
      setType(initialType);
      setWaterMl(WATER_STEP);
      setMood(4);
      setWeightValue("");
      setNote("");
    }
  }, [visible, initialType, editingEntry]);

  const weightNum = parseFloat(weightValue.replace(",", "."));
  const canSave = type === "weight" ? !Number.isNaN(weightNum) && weightNum > 0 : true;

  const handleSave = async () => {
    if (!canSave || saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    setError(null);
    const value = type === "water" ? waterMl : type === "mood" ? mood : weightNum;
    const trimmedNote = note.trim() || undefined;
    try {
      const entry = editingEntry
        ? await updateHealthEntry(editingEntry.id, { value, note: trimmedNote })
        : await logHealthEntry(type, value, trimmedNote);
      onSaved(entry, !!editingEntry);
      onClose();
    } catch {
      setError("Couldn't save \u2014 please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.overlay.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close health log"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.avoider}
      >
        <View
          style={[
            styles.sheet,
            theme.elevation.e2,
            {
              backgroundColor: theme.colors.surface.raised,
              borderTopLeftRadius: theme.radius.lg,
              borderTopRightRadius: theme.radius.lg,
              paddingBottom: insets.bottom + theme.space.md,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.strong }]} />
          <Text style={[theme.type.h2, { color: theme.colors.text.primary, marginBottom: theme.space.md }]}>
            {editingEntry ? `Edit ${TYPES.find((t) => t.key === type)?.label.toLowerCase()} entry` : "Log health"}
          </Text>

          {!editingEntry ? (
            <View
              style={[
                styles.segmented,
                { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm },
              ]}
            >
              {TYPES.map((t) => {
                const active = type === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => setType(t.key)}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.segment,
                      active && [
                        theme.elevation.e1,
                        { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.sm - 2 },
                      ],
                    ]}
                  >
                    <Feather
                      name={t.icon}
                      size={16}
                      color={active ? theme.colors.text.primary : theme.colors.text.secondary}
                    />
                    <Text
                      style={[
                        theme.type.label,
                        { color: active ? theme.colors.text.primary : theme.colors.text.secondary },
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
            {type === "water" ? (
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => setWaterMl((v) => Math.max(WATER_STEP, v - WATER_STEP))}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease amount"
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}
                >
                  <Feather name="minus" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={[theme.type.display, styles.flexCenter, { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] }]}>
                  {`${waterMl} ml`}
                </Text>
                <TouchableOpacity
                  onPress={() => setWaterMl((v) => Math.min(5000, v + WATER_STEP))}
                  accessibilityRole="button"
                  accessibilityLabel="Increase amount"
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}
                >
                  <Feather name="plus" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </View>
            ) : null}

            {type === "mood" ? (
              <View style={styles.moodRow}>
                {MOOD_EMOJI.map((emoji, i) => {
                  const value = i + 1;
                  const active = mood === value;
                  return (
                    <TouchableOpacity
                      key={value}
                      onPress={() => setMood(value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Mood ${value} of 5`}
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.moodButton,
                        {
                          backgroundColor: active ? theme.colors.surface.primarySubtle : theme.colors.surface.sunken,
                          borderRadius: theme.radius.full,
                        },
                      ]}
                    >
                      <Text style={styles.moodEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            {type === "weight" ? (
              <View style={{ gap: theme.space["2xs"] }}>
                <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Weight (kg)</Text>
                <TextInput
                  value={weightValue}
                  onChangeText={setWeightValue}
                  placeholder="e.g. 71.5"
                  placeholderTextColor={theme.colors.text.tertiary}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Weight in kilograms"
                  style={[
                    styles.input,
                    theme.type.h2,
                    {
                      color: theme.colors.text.primary,
                      backgroundColor: theme.colors.surface.default,
                      borderColor: theme.colors.border.strong,
                      borderRadius: theme.radius.sm,
                    },
                  ]}
                />
              </View>
            ) : null}

            {type === "mood" ? (
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={theme.colors.text.tertiary}
                accessibilityLabel="Note"
                style={[
                  styles.noteInput,
                  theme.type.body,
                  {
                    color: theme.colors.text.primary,
                    backgroundColor: theme.colors.surface.default,
                    borderColor: theme.colors.border.strong,
                    borderRadius: theme.radius.sm,
                  },
                ]}
              />
            ) : null}

            {error ? (
              <Text style={[theme.type.bodySm, { color: theme.colors.error.text }]}>{error}</Text>
            ) : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave || saving}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !canSave || saving }}
              style={[
                styles.saveButton,
                {
                  backgroundColor: canSave ? theme.colors.primary.default : theme.colors.surface.sunken,
                  borderRadius: theme.radius.sm,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.text.onPrimary} />
              ) : (
                <Text
                  style={[
                    theme.type.label,
                    { color: canSave ? theme.colors.text.onPrimary : theme.colors.text.disabled, fontSize: 16 },
                  ]}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  avoider: { justifyContent: "flex-end" },
  sheet: { paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, marginBottom: 12 },
  segmented: { flexDirection: "row", padding: 3, height: 40 },
  segment: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  stepperButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  flexCenter: { minWidth: 140, textAlign: "center" },
  moodRow: { flexDirection: "row", justifyContent: "space-between" },
  moodButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  moodEmoji: { fontSize: 24 },
  input: { height: 56, borderWidth: 1.5, paddingHorizontal: 16 },
  noteInput: { height: 44, borderWidth: 1.5, paddingHorizontal: 16 },
  saveButton: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
