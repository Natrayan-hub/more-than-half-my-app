// Add Document/Photo (lightweight S19): pick an image from the library,
// title it (+ category for documents), save. No camera edge-detection/OCR
// pipeline in this MVP — that's a larger feature for later.
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createDocument } from "@/src/features/documents/api";
import { useTheme } from "@/src/theme";
import type { Document, DocumentCategory } from "@/src/types/models";

const CATEGORIES: { key: DocumentCategory; label: string }[] = [
  { key: "id", label: "ID" },
  { key: "finance", label: "Finance" },
  { key: "medical", label: "Medical" },
  { key: "warranty", label: "Warranty" },
  { key: "travel", label: "Travel" },
  { key: "other", label: "Other" },
];

interface PickedImage { base64: string; sizeBytes: number }

interface AddSheetProps {
  visible: boolean;
  kind: "document" | "photo";
  onClose: () => void;
  onSaved: (doc: Document) => void;
}

export function AddSheet({ visible, kind, onClose, onSaved }: AddSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("other");
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle("");
    setCategory("other");
    setPicked(null);
    setError(null);
  }, [visible]);

  const handlePick = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(`Photo library access is needed to add a ${kind === "photo" ? "photo" : "scan"}.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.5,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    const base64 = `data:image/jpeg;base64,${asset.base64}`;
    setPicked({ base64, sizeBytes: Math.round((asset.base64.length * 3) / 4) });
    if (!title.trim()) setTitle(kind === "photo" ? "Photo" : "Scanned document");
  };

  const canSave = !!picked && title.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving || !picked) return;
    setSaving(true);
    setError(null);
    try {
      const doc = await createDocument({
        title: title.trim(),
        category: kind === "document" ? category : "other",
        kind,
        content_base64: picked.base64,
        thumb_base64: picked.base64,
        size_bytes: picked.sizeBytes,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSaved(doc);
      onClose();
    } catch {
      setError("Couldn't save — please try again.");
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
            {
              backgroundColor: theme.colors.surface.raised,
              borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg,
              paddingBottom: insets.bottom + theme.space.md,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border.strong }]} />
          <Text style={[theme.type.h2, { color: theme.colors.text.primary, marginBottom: theme.space.md }]}>
            {kind === "photo" ? "Add photo" : "Add document"}
          </Text>

          <ScrollView contentContainerStyle={{ gap: theme.space.md }}>
            <TouchableOpacity
              onPress={handlePick}
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
              style={[
                styles.picker,
                { borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface.sunken },
              ]}
            >
              {picked ? (
                <Image source={{ uri: picked.base64 }} style={styles.preview} contentFit="cover" />
              ) : (
                <>
                  <Feather name="image" size={24} color={theme.colors.text.secondary} />
                  <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Choose from library</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ gap: theme.space["2xs"] }}>
              <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={kind === "photo" ? "Photo title" : "e.g. Passport scan"}
                placeholderTextColor={theme.colors.text.tertiary}
                accessibilityLabel="Title"
                style={[
                  styles.input, theme.type.body,
                  { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm },
                ]}
              />
            </View>

            {kind === "document" ? (
              <View style={{ gap: theme.space["2xs"] }}>
                <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Category</Text>
                <View style={styles.chipRow}>
                  {CATEGORIES.map((c) => {
                    const active = category === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        onPress={() => setCategory(c.key)}
                        accessibilityRole="button"
                        accessibilityLabel={c.label}
                        accessibilityState={{ selected: active }}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? theme.colors.surface.primarySubtle : theme.colors.surface.sunken,
                            borderRadius: theme.radius.full,
                          },
                        ]}
                      >
                        <Text style={[theme.type.labelSm, { color: active ? theme.colors.primary.subtleText : theme.colors.text.secondary }]}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {error ? <Text style={[theme.type.bodySm, { color: theme.colors.error.text }]}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave || saving}
              accessibilityRole="button"
              accessibilityLabel="Save"
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
  sheet: { paddingHorizontal: 16, paddingTop: 8, maxHeight: "88%" },
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 999, marginBottom: 12 },
  picker: {
    height: 140, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden",
  },
  preview: { width: "100%", height: "100%" },
  input: { height: 52, borderWidth: 1.5, paddingHorizontal: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, height: 32, alignItems: "center", justifyContent: "center" },
  saveButton: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 4 },
});
