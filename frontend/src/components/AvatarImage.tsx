// Avatar display — every read of GET /me/avatar needs auth. Native attaches
// an Authorization header directly to the image source; web can't (a plain
// <img> under the hood), so it goes through a short-lived token query param
// instead (per Emergent Object Storage integration playbook). Falls back to
// an initials circle when there's no avatar yet or the token isn't loaded.
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { ACCESS_TOKEN_KEY } from "@/src/api/client";
import { useTheme } from "@/src/theme";
import { storage } from "@/src/utils/storage";

const BASE_URL = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

interface AvatarImageProps {
  avatarUrl?: string | null; // relative path from Profile, e.g. "/me/avatar?v=169..."
  displayName?: string | null;
  size?: number;
}

export function AvatarImage({ avatarUrl, displayName, size = 44 }: AvatarImageProps) {
  const { theme } = useTheme();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    storage.secureGet<string>(ACCESS_TOKEN_KEY, "").then((t) => setToken(t || null));
  }, [avatarUrl]);

  const initial = (displayName || "?").trim().charAt(0).toUpperCase() || "?";
  const radius = size / 2;

  if (!avatarUrl || !token) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: radius, backgroundColor: theme.colors.primary.default },
        ]}
      >
        <Text style={{ color: theme.colors.text.onPrimary, fontSize: size * 0.42, fontWeight: "600" }}>
          {initial}
        </Text>
      </View>
    );
  }

  const fullUrl = `${BASE_URL}${avatarUrl}`;
  const source = Platform.OS === "web"
    ? { uri: `${fullUrl}&token=${token}` }
    : { uri: fullUrl, headers: { Authorization: `Bearer ${token}` } };

  return (
    <Image
      source={source}
      style={{ width: size, height: size, borderRadius: radius }}
      contentFit="cover"
      transition={150}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
});
