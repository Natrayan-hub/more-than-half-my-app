// S18 + S22 (condensed) — Documents & Photo Backup home: storage status,
// documents list, photo gallery. Tap to view, long-press to delete.
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";

import { CardError } from "@/src/components/Card";
import { Skeleton } from "@/src/components/Skeleton";
import { useToast } from "@/src/components/Toast";
import { AddSheet } from "@/src/features/documents/AddSheet";
import {
  backupNow, deleteDocument, fetchDocuments, fetchStorageSummary, type StorageSummary,
} from "@/src/features/documents/api";
import { DocumentRow } from "@/src/features/documents/DocumentRow";
import { PhotoThumb } from "@/src/features/documents/PhotoThumb";
import { StorageHeader } from "@/src/features/documents/StorageHeader";
import { ViewerModal } from "@/src/features/documents/ViewerModal";
import { useCardData } from "@/src/features/today/useCardData";
import { useTheme } from "@/src/theme";
import type { Document } from "@/src/types/models";

const GRID_GAP = 8;
const GRID_COLUMNS = 3;

export default function DocsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [addSheet, setAddSheet] = useState<{ visible: boolean; kind: "document" | "photo" }>({
    visible: false, kind: "document",
  });
  const [viewing, setViewing] = useState<Document | null>(null);

  const storageData = useCardData<StorageSummary>("documents.storage", fetchStorageSummary);
  const documentsData = useCardData<Document[]>("documents.list", () => fetchDocuments("document"));
  const photosData = useCardData<Document[]>("documents.photos", () => fetchDocuments("photo"));

  const offline = storageData.offline || documentsData.offline || photosData.offline;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([storageData.refetch(), documentsData.refetch(), photosData.refetch()]);
    setRefreshing(false);
  }, [storageData, documentsData, photosData]);

  const handleBackup = useCallback(async () => {
    setBackingUp(true);
    try {
      const summary = await backupNow();
      storageData.mutate(() => summary);
      toast.show({ message: "Backed up" });
    } catch {
      toast.show({ message: "Backup failed — try again" });
    } finally {
      setBackingUp(false);
    }
  }, [storageData, toast]);

  const handleDelete = useCallback((doc: Document) => {
    const source = doc.kind === "photo" ? photosData : documentsData;
    source.mutate((current) => (current ?? []).filter((d) => d.id !== doc.id));
    setViewing(null);
    deleteDocument(doc.id)
      .then(() => {
        toast.show({ message: `${doc.kind === "photo" ? "Photo" : "Document"} deleted` });
      })
      .catch(() => {
        toast.show({ message: "Couldn't delete — try again" });
        source.refetch();
      });
  }, [documentsData, photosData, toast]);

  const handleSaved = useCallback((doc: Document) => {
    const target = doc.kind === "photo" ? photosData : documentsData;
    target.mutate((current) => [doc, ...(current ?? [])]);
    storageData.refetch();
    toast.show({ message: `${doc.kind === "photo" ? "Photo" : "Document"} added` });
  }, [documentsData, photosData, storageData, toast]);

  const gridSize = useMemo(() => {
    // Screen padding 32 + inner gaps between columns.
    const available = 400 - 32 - GRID_GAP * (GRID_COLUMNS - 1);
    return available / GRID_COLUMNS;
  }, []);

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg.canvas }]}>
      <View style={styles.headerBar}>
        <Text style={[theme.type.h2, { color: theme.colors.text.primary }]}>Documents</Text>
      </View>

      {offline ? (
        <View style={[styles.offlineBanner, { backgroundColor: theme.colors.info.subtleBg }]}>
          <Feather name="cloud-off" size={14} color={theme.colors.info.default} />
          <Text style={[theme.type.labelSm, { color: theme.colors.info.default }]}>
            Offline — showing your last saved copy
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary.default} />}
      >
        <StorageHeader
          summary={storageData.data}
          loading={storageData.loading}
          backingUp={backingUp}
          onBackup={handleBackup}
          onOpenSettings={() => router.push("/more/backup")}
        />

        <View style={styles.sectionHeader}>
          <Text style={[theme.type.h3, { color: theme.colors.text.primary }]}>Documents</Text>
          <TouchableOpacity
            onPress={() => setAddSheet({ visible: true, kind: "document" })}
            accessibilityRole="button"
            accessibilityLabel="Add document"
            style={[styles.addButton, { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.full }]}
          >
            <Feather name="plus" size={16} color={theme.colors.primary.subtleText} />
          </TouchableOpacity>
        </View>

        {documentsData.loading ? (
          <View style={{ gap: 8 }}>
            <Skeleton height={60} radius={theme.radius.sm} />
            <Skeleton height={60} radius={theme.radius.sm} />
          </View>
        ) : documentsData.error ? (
          <CardError message={documentsData.error} onRetry={documentsData.refetch} />
        ) : (documentsData.data ?? []).length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="file-text" size={22} color={theme.colors.text.tertiary} />
            <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary, marginTop: 6 }]}>
              No documents yet — tap + to scan or import one.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.listCard, theme.elevation.e1,
              { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
            ]}
          >
            {(documentsData.data ?? []).map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                onPress={() => setViewing(doc)}
                onLongPress={() => handleDelete(doc)}
              />
            ))}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <Text style={[theme.type.h3, { color: theme.colors.text.primary }]}>Photos</Text>
          <TouchableOpacity
            onPress={() => setAddSheet({ visible: true, kind: "photo" })}
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            style={[styles.addButton, { backgroundColor: theme.colors.surface.primarySubtle, borderRadius: theme.radius.full }]}
          >
            <Feather name="plus" size={16} color={theme.colors.primary.subtleText} />
          </TouchableOpacity>
        </View>

        {photosData.loading ? (
          <View style={styles.grid}>
            {[0, 1, 2].map((i) => <Skeleton key={i} height={gridSize} width={gridSize} radius={theme.radius.sm} />)}
          </View>
        ) : photosData.error ? (
          <CardError message={photosData.error} onRetry={photosData.refetch} />
        ) : (photosData.data ?? []).length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="image" size={22} color={theme.colors.text.tertiary} />
            <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary, marginTop: 6 }]}>
              No photos backed up yet.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {(photosData.data ?? []).map((photo) => (
              <PhotoThumb
                key={photo.id}
                photo={photo}
                size={gridSize}
                onPress={() => setViewing(photo)}
                onLongPress={() => handleDelete(photo)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <AddSheet
        visible={addSheet.visible}
        kind={addSheet.kind}
        onClose={() => setAddSheet((s) => ({ ...s, visible: false }))}
        onSaved={handleSaved}
      />
      <ViewerModal document={viewing} onClose={() => setViewing(null)} onDelete={handleDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerBar: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  offlineBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 4, paddingVertical: 6, borderRadius: 10,
  },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8,
  },
  addButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  listCard: { paddingHorizontal: 14, overflow: "hidden" },
  emptyBlock: { alignItems: "center", paddingVertical: 24 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
});

