// Shared icon renderer for health metrics — keeps the icon-set choice (some
// metrics only have a good glyph in MaterialCommunityIcons) out of the data
// module (metrics.ts) and out of every screen that needs a metric icon.
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

import type { IconSpec } from "@/src/features/health/metrics";

interface MetricIconProps {
  spec: IconSpec;
  size: number;
  color: string;
}

export function MetricIcon({ spec, size, color }: MetricIconProps) {
  if (spec.set === "mci") {
    return <MaterialCommunityIcons name={spec.name as never} size={size} color={color} />;
  }
  return <Feather name={spec.name as never} size={size} color={color} />;
}
