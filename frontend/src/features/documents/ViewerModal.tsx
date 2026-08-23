// Full-screen document/photo viewer (lightweight S20): image, metadata,
// delete. Delete is optimistic + Undo toast (no confirm dialog) so it works
// identically on web preview and native.
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatBytes } from "@/src/features/documents/api";
import { useTheme } from "@/src/theme";
import type { Document } from "@/src/types/models";

interface ViewerModalProps {
  document: Document | null;
  onClose: () => void;
  onDelete: (document: Document) => void;
}

export function ViewerModal({ document, onClose, onDelete }: ViewerModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  if (!document) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.colors.overlay.scrim }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.iconButton}>
            <Feather name="x" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onDelete(document)}
            accessibilityRole="button"
            accessibilityLabel="Delete"
            style={styles.iconButton}
          >
            <Feather name="trash-2" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageWrap}>
          {document.content_base64 ? (
            <Image source={{ uri: document.content_base64 }} style={styles.image} contentFit="contain" />
          ) : (
            <Feather name="file-text" size={48} color="#FFFFFF" />
          )}
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title} numberOfLines={1}>{document.title}</Text>
          <Text style={styles.meta}>
            {formatBytes(document.size_bytes)} · {new Date(document.created_at).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "numeric",
            })} · {document.storage_policy === "local_only" ? "On this device" : "Synced to cloud"}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8,
  },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  imageWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 4 },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
  meta: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
});
