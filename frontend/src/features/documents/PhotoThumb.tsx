// Photo grid thumbnail (S22): tap to view full-screen, long-press to delete.
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

import { useTheme } from "@/src/theme";
import type { Document } from "@/src/types/models";

interface PhotoThumbProps {
  photo: Document;
  size: number;
  onPress: () => void;
  onLongPress: () => void;
}

export function PhotoThumb({ photo, size, onPress, onLongPress }: PhotoThumbProps) {
  const { theme } = useTheme();

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLongPress();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${photo.title}, tap to view, long-press to delete`}
      style={[
        styles.thumb,
        { width: size, height: size, backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm },
      ]}
    >
      {photo.thumb_base64 ? (
        <Image source={{ uri: photo.thumb_base64 }} style={styles.image} contentFit="cover" />
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  thumb: { overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
