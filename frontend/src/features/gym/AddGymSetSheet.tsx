// Log a gym set (exercise name + weight + reps) — "simple" by design, one
// set per save. Exercise name has autocomplete chips from the user's own
// history (GET /gym/exercises) so repeat lifts are a single tap.
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { logGymSet, updateGymSet } from "@/src/features/gym/api";
import { useTheme } from "@/src/theme";
import type { GymSet, WeightUnit } from "@/src/types/models";

interface AddGymSetSheetProps {
  visible: boolean;
  editingSet?: GymSet | null;
  recentExercises: string[];
  onClose: () => void;
  onSaved: (set: GymSet, wasEdit: boolean) => void;
}

export function AddGymSetSheet({
  visible, editingSet, recentExercises, onClose, onSaved,
}: AddGymSetSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [exerciseName, setExerciseName] = useState("");
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [reps, setReps] = useState(8);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setSaving(false);
    if (editingSet) {
      setExerciseName(editingSet.exercise_name);
      setWeight(String(editingSet.weight));
      setUnit(editingSet.weight_unit);
      setReps(editingSet.reps);
    } else {
      setExerciseName("");
      setWeight("");
      setUnit("kg");
      setReps(8);
    }
  }, [visible, editingSet]);

  const weightNum = parseFloat(weight.replace(",", "."));
  const canSave = exerciseName.trim().length > 0 && !Number.isNaN(weightNum) && weightNum >= 0 && reps > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    setError(null);
    const input = { exercise_name: exerciseName.trim(), weight: weightNum, weight_unit: unit, reps };
    try {
      const set = editingSet
        ? await updateGymSet(editingSet.id, input)
        : await logGymSet(input);
      onSaved(set, !!editingSet);
      onClose();
    } catch {
      setError("Couldn't save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.colors.overlay.scrim }]}
        onPress={onClose}
        accessibilityLabel="Close gym log"
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.avoider}>
        <View
          style={[
            styles.sheet, theme.elevation.e2,
            {
              backgroundColor: theme.colors.surface.raised,
              borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg,
              paddingBottom: insets.bottom + theme.space.md,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.strong }]} />
          <Text style={[theme.type.h2, { color: theme.colors.text.primary, marginBottom: theme.space.md }]}>
            {editingSet ? "Edit set" : "Log a set"}
          </Text>

          <ScrollView contentContainerStyle={{ gap: theme.space.md }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Exercise</Text>
              <TextInput
                value={exerciseName}
                onChangeText={setExerciseName}
                placeholder="e.g. Bench press"
                placeholderTextColor={theme.colors.text.tertiary}
                accessibilityLabel="Exercise name"
                style={[
                  styles.input, theme.type.body,
                  { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm },
                ]}
              />
              {recentExercises.length > 0 ? (
                <View style={styles.chipRow}>
                  {recentExercises.slice(0, 6).map((name) => (
                    <TouchableOpacity
                      key={name}
                      onPress={() => setExerciseName(name)}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${name}`}
                      style={[styles.chip, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.full }]}
                    >
                      <Text style={[theme.type.labelSm, { color: theme.colors.text.secondary }]}>{name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Weight</Text>
              <View style={styles.weightRow}>
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0"
                  placeholderTextColor={theme.colors.text.tertiary}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Weight"
                  style={[
                    styles.input, styles.weightInput, theme.type.h2,
                    { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm },
                  ]}
                />
                <View style={[styles.unitToggle, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}>
                  {(["kg", "lb"] as WeightUnit[]).map((u) => {
                    const active = unit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        onPress={() => setUnit(u)}
                        accessibilityRole="button"
                        accessibilityLabel={u}
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.unitButton,
                          active && [theme.elevation.e1, { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.sm - 2 }],
                        ]}
                      >
                        <Text style={[theme.type.label, { color: active ? theme.colors.text.primary : theme.colors.text.secondary }]}>{u}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Reps</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  onPress={() => setReps((v) => Math.max(1, v - 1))}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease reps"
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}
                >
                  <Feather name="minus" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
                <Text style={[theme.type.display, styles.flexCenter, { color: theme.colors.text.primary, fontVariant: ["tabular-nums"] }]}>
                  {reps}
                </Text>
                <TouchableOpacity
                  onPress={() => setReps((v) => Math.min(50, v + 1))}
                  accessibilityRole="button"
                  accessibilityLabel="Increase reps"
                  style={[styles.stepperButton, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}
                >
                  <Feather name="plus" size={20} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {error ? <Text style={[theme.type.bodySm, { color: theme.colors.error.text }]}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave || saving}
              accessibilityRole="button"
              accessibilityLabel="Save set"
              style={[
                styles.saveButton,
                { backgroundColor: canSave ? theme.colors.primary.default : theme.colors.surface.sunken, borderRadius: theme.radius.sm },
              ]}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.text.onPrimary} />
              ) : (
                <Text style={[theme.type.label, { color: canSave ? theme.colors.text.onPrimary : theme.colors.text.disabled, fontSize: 16 }]}>
                  Save
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
  avoider: { justifyContent: "flex-end" },
  sheet: { paddingHorizontal: 16, paddingTop: 8, maxHeight: "88%" },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, marginBottom: 12 },
  input: { height: 52, borderWidth: 1.5, paddingHorizontal: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, height: 30, alignItems: "center", justifyContent: "center" },
  weightRow: { flexDirection: "row", gap: 10 },
  weightInput: { flex: 1 },
  unitToggle: { flexDirection: "row", padding: 3, height: 52 },
  unitButton: { width: 44, alignItems: "center", justifyContent: "center" },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  stepperButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  flexCenter: { minWidth: 60, textAlign: "center" },
  saveButton: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
