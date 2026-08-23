// Shared settings list row (Design System-consistent): icon + title +
// optional subtitle/value, chevron or custom trailing control. Used across
// the More hub and every Settings sub-screen so grouped lists look uniform.
import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "@/src/theme";

interface SettingsRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

export function SettingsRow({
  icon, title, subtitle, value, onPress, trailing, danger, disabled,
}: SettingsRowProps) {
  const { theme } = useTheme();
  const iconColor = danger ? theme.colors.error.default : theme.colors.text.secondary;
  const titleColor = danger ? theme.colors.error.text : theme.colors.text.primary;

  const content = (
    <>
      <View
        style={[
          styles.iconBox,
          { backgroundColor: theme.colors.surface.sunken, borderRadius: theme.radius.sm },
        ]}
      >
        <Feather name={icon} size={17} color={iconColor} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[theme.type.body, { color: titleColor }]} numberOfLines={1}>{title}</Text>
        {subtitle ? (
          <Text style={[theme.type.caption, { color: theme.colors.text.secondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (
        <View style={styles.trailing}>
          {value ? (
            <Text style={[theme.type.bodySm, { color: theme.colors.text.secondary }]} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          {onPress ? (
            <Feather name="chevron-right" size={18} color={theme.colors.text.tertiary} />
          ) : null}
        </View>
      )}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, disabled && styles.disabled]}>{content}</View>;
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.row, disabled && styles.disabled]}
    >
      {content}
    </TouchableOpacity>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ gap: theme.space.xs }}>
      {title ? (
        <Text
          style={[
            theme.type.labelSm,
            { color: theme.colors.text.tertiary, textTransform: "uppercase", marginLeft: 4 },
          ]}
        >
          {title}
        </Text>
      ) : null}
      <View
        style={[
          styles.card, theme.elevation.e1,
          { backgroundColor: theme.colors.surface.default, borderRadius: theme.radius.md },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function SettingsDivider() {
  const { theme } = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.colors.border.default }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14,
  },
  iconBox: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  textBlock: { flex: 1, gap: 1 },
  trailing: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: 140 },
  disabled: { opacity: 0.5 },
  card: { paddingVertical: 2, overflow: "hidden" },
  divider: { height: 1, marginLeft: 60 },
});
