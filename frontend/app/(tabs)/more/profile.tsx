// Edit Profile (S25 slice) — display name + avatar. Avatar picker follows
// the standard permission contract: check → contextual request → on denial
// with canAskAgain=false, show an inline "Open Settings" affordance instead
// of a dead end.
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

import { AvatarImage } from "@/src/components/AvatarImage";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { useToast } from "@/src/components/Toast";
import { updateDisplayName, uploadAvatar } from "@/src/features/profile/api";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/theme";

export default function EditProfileScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const { user, profile, setProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [permBlocked, setPermBlocked] = useState(false);

  const dirty = displayName.trim().length > 0 && displayName.trim() !== (profile?.display_name ?? "");

  const handleSaveName = async () => {
    if (!dirty || savingName) return;
    setSavingName(true);
    try {
      const updated = await updateDisplayName(displayName.trim());
      setProfile(updated);
      toast.show({ message: "Name updated" });
    } catch {
      toast.show({ message: "Couldn't save — try again" });
    } finally {
      setSavingName(false);
    }
  };

  const handlePickAvatar = async () => {
    let perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (perm.status === "denied" && !perm.canAskAgain) {
        setPermBlocked(true);
        return;
      }
      perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) setPermBlocked(true);
        return;
      }
    }
    setPermBlocked(false);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const name = asset.fileName || `avatar-${Date.now()}.jpg`;
      const mimeType = asset.mimeType || "image/jpeg";
      const updated = await uploadAvatar(asset.uri, name, mimeType);
      setProfile(updated);
      toast.show({ message: "Avatar updated" });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : "Couldn't upload avatar" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <ScreenHeader title="Edit Profile" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarBlock}>
          <TouchableOpacity
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.avatarWrap}
          >
            <AvatarImage avatarUrl={profile?.avatar_url} displayName={profile?.display_name} size={96} />
            <View style={[styles.editBadge, { backgroundColor: theme.colors.primary.default, borderColor: theme.colors.bg.canvas }]}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={theme.colors.text.onPrimary} />
              ) : (
                <Feather name="camera" size={14} color={theme.colors.text.onPrimary} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={[theme.type.caption, { color: theme.colors.text.secondary, marginTop: 10 }]}>
            Tap to change photo
          </Text>

          {permBlocked ? (
            <View style={[styles.permBanner, { backgroundColor: theme.colors.warning.subtleBg, borderRadius: theme.radius.sm }]}>
              <Feather name="alert-triangle" size={14} color={theme.colors.warning.text} />
              <Text style={[theme.type.caption, styles.flex, { color: theme.colors.warning.text }]}>
                Photo library access is off.
              </Text>
              <TouchableOpacity
                onPress={() => Linking.openSettings()}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
              >
                <Text style={[theme.type.labelSm, { color: theme.colors.warning.text, textDecorationLine: "underline" }]}>
                  Open Settings
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={{ gap: theme.space["2xs"] }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={theme.colors.text.tertiary}
            accessibilityLabel="Display name"
            style={[
              styles.input, theme.type.body,
              { color: theme.colors.text.primary, backgroundColor: theme.colors.surface.default, borderColor: theme.colors.border.strong, borderRadius: theme.radius.sm },
            ]}
          />
        </View>

        <View style={{ gap: theme.space["2xs"] }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Email</Text>
          <View style={[styles.input, styles.emailRow, { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm }]}>
            <Text style={[theme.type.body, { color: theme.colors.text.tertiary }]} numberOfLines={1}>
              {user?.email ?? "—"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSaveName}
          disabled={!dirty || savingName}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          style={[
            styles.saveButton,
            { backgroundColor: dirty ? theme.colors.primary.default : theme.colors.surface.sunken, borderRadius: theme.radius.sm },
          ]}
        >
          {savingName ? (
            <ActivityIndicator color={theme.colors.text.onPrimary} />
          ) : (
            <Text style={[theme.type.label, { color: dirty ? theme.colors.text.onPrimary : theme.colors.text.disabled, fontSize: 16 }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  avatarBlock: { alignItems: "center", paddingVertical: 12 },
  avatarWrap: { position: "relative" },
  editBadge: {
    position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center", borderWidth: 2,
  },
  permBanner: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: 10, marginTop: 12, alignSelf: "stretch",
  },
  flex: { flex: 1 },
  input: { height: 52, borderWidth: 1.5, paddingHorizontal: 16, justifyContent: "center" },
  emailRow: { borderWidth: 0 },
  saveButton: { height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
});
