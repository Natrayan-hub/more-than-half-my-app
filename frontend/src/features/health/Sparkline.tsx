// Minimal sparkline (Design System E.6): 32h, no axes/grid, endpoint dot 4.
// Custom lightweight SVG polyline rather than the full chart library —
// gifted-charts is reserved for the real S15 detail chart; at 32px tall a
// plain <Path> is both truer to "data-ink first" and more reliable.
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color: string;
}

export function Sparkline({ values, width = 96, height = 32, color }: SparklineProps) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 4;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const [lastX, lastY] = points[points.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={lastX} cy={lastY} r={4} fill={color} />
    </Svg>
  );
}
