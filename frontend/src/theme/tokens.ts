// LifeOS design tokens — single source of truth (Design System v1.0).
// RULE: components never use raw hex — import tokens via useTheme().
// Light & dark themes share an identical shape (`Theme`).

export const space = {
  "2xs": 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, "2xl": 48, "3xl": 64,
} as const;

export const radius = {
  xs: 6, sm: 10, md: 14, lg: 20, full: 999,
} as const;

export const layout = {
  margin: 16,
  gutter: 12,
  maxContentWidth: 640,
  tabBarHeight: 64,
  topBarHeight: 56,
  minTouch: 44,
} as const;

export const motion = {
  duration: { instant: 100, fast: 150, base: 200, slow: 300, deliberate: 450 },
} as const;

// Typography — Inter (loaded via expo-font in root layout), tabular numerals
// for stats via fontVariant on `mono`.
export const fonts = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
} as const;

export const type = {
  display: { fontSize: 34, lineHeight: 40, fontFamily: fonts.bold, letterSpacing: -0.4 },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: fonts.bold, letterSpacing: -0.3 },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: fonts.semibold, letterSpacing: -0.2 },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fonts.semibold, letterSpacing: -0.1 },
  h4: { fontSize: 16, lineHeight: 22, fontFamily: fonts.semibold, letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.regular, letterSpacing: 0 },
  bodySm: { fontSize: 14, lineHeight: 20, fontFamily: fonts.regular, letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 18, fontFamily: fonts.medium, letterSpacing: 0.1 },
  labelSm: { fontSize: 12, lineHeight: 16, fontFamily: fonts.medium, letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.regular, letterSpacing: 0.1 },
  mono: {
    fontSize: 14, lineHeight: 20, fontFamily: fonts.medium, letterSpacing: 0,
    fontVariant: ["tabular-nums"] as const,
  },
} as const;

// Widened shape (string/number, not literal hex types) so light & dark
// palettes — which share this exact shape but differ in every value — both
// type-check cleanly against one interface instead of against each other's
// literal types.
export interface Colors {
  bg: { canvas: string };
  surface: {
    default: string;
    raised: string;
    sunken: string;
    inverse: string;
    primarySubtle: string;
    aiSubtle: string;
  };
  overlay: { scrim: string };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    onPrimary: string;
    onInverse: string;
    link: string;
  };
  primary: { default: string; pressed: string; subtleText: string };
  secondary: { default: string };
  ai: { default: string; onSubtle: string };
  success: { default: string; text: string; subtleBg: string };
  warning: { default: string; text: string; subtleBg: string };
  error: { default: string; text: string; subtleBg: string };
  info: { default: string; subtleBg: string };
  border: { default: string; strong: string; focus: string };
  chart: { grid: string; series: string[] };
  privacy: { local: string; cloud: string };
}

const lightColors: Colors = {
  bg: { canvas: "#F7F7F5" },
  surface: {
    default: "#FFFFFF",
    raised: "#FFFFFF",
    sunken: "#EFEFEC",
    inverse: "#22252C",
    primarySubtle: "#EEF0FE",
    aiSubtle: "#F3EFFE",
  },
  overlay: { scrim: "rgba(15, 16, 19, 0.4)" },
  text: {
    primary: "#1B1D22",
    secondary: "#565B66",
    tertiary: "#71767F",
    disabled: "#A3A7AE",
    onPrimary: "#FFFFFF",
    onInverse: "#F2F2F0",
    link: "#3F4BD1",
  },
  primary: { default: "#4F5DE8", pressed: "#3F4BD1", subtleText: "#3239A8" },
  secondary: { default: "#0FA396" },
  ai: { default: "#7C5CE8", onSubtle: "#5439A8" },
  success: { default: "#1B9C57", text: "#12663A", subtleBg: "#E9F7EE" },
  warning: { default: "#D97E06", text: "#8F5304", subtleBg: "#FEF5E7" },
  error: { default: "#D93F3F", text: "#B93030", subtleBg: "#FDEEEE" },
  info: { default: "#1E74D9", subtleBg: "#EAF3FE" },
  border: { default: "#E3E3DF", strong: "#C8C9C4", focus: "#4F5DE8" },
  chart: {
    grid: "#ECECE9",
    series: ["#4F5DE8", "#0FA396", "#7C5CE8", "#D97E06", "#1E74D9"],
  },
  privacy: { local: "#565B66", cloud: "#1E74D9" },
};

const darkColors: Colors = {
  bg: { canvas: "#0F1013" },
  surface: {
    default: "#1A1C21",
    raised: "#22252C",
    sunken: "#141519",
    inverse: "#F2F2F0",
    primarySubtle: "#232649",
    aiSubtle: "#2A2347",
  },
  overlay: { scrim: "rgba(0, 0, 0, 0.6)" },
  text: {
    primary: "#F2F2F0",
    secondary: "#A7ACB8",
    tertiary: "#828792",
    disabled: "#5A5E68",
    onPrimary: "#FFFFFF",
    onInverse: "#1B1D22",
    link: "#9AA5F4",
  },
  primary: { default: "#7A86F0", pressed: "#8F99F3", subtleText: "#B6BDF8" },
  secondary: { default: "#3FBFB2" },
  ai: { default: "#A18BF2", onSubtle: "#CBBDF8" },
  success: { default: "#4EC583", text: "#7ADCA4", subtleBg: "#12331F" },
  warning: { default: "#F0A93C", text: "#F5C165", subtleBg: "#3A2A0D" },
  error: { default: "#F07575", text: "#F09393", subtleBg: "#3A1414" },
  info: { default: "#5CA3EE", subtleBg: "#0E2A47" },
  border: { default: "#2E323B", strong: "#454A56", focus: "#7A86F0" },
  chart: {
    grid: "#262A31",
    series: ["#9AA5F4", "#5FCEC2", "#B49AF4", "#F5C165", "#7FB5F5"],
  },
  privacy: { local: "#A7ACB8", cloud: "#5CA3EE" },
};

// Elevation — "quiet depth": light uses soft shadows, dark raises via surface
// lightness (shadows near-disabled).
interface ElevationSpec {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}
interface ElevationSet {
  e1: ElevationSpec;
  e2: ElevationSpec;
  e3: ElevationSpec;
}

const lightElevation: ElevationSet = {
  e1: {
    shadowColor: "#1B1D22", shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  e2: {
    shadowColor: "#1B1D22", shadowOpacity: 0.1, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  e3: {
    shadowColor: "#1B1D22", shadowOpacity: 0.14, shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
};

const darkElevation: ElevationSet = {
  e1: {
    shadowColor: "#000000", shadowOpacity: 0, shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 }, elevation: 0,
  },
  e2: {
    shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  e3: {
    shadowColor: "#000000", shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
};

export const light = {
  scheme: "light" as const,
  colors: lightColors,
  elevation: lightElevation,
  space, radius, layout, motion, type, fonts,
};

export const dark: typeof light = {
  scheme: "dark" as unknown as typeof light.scheme,
  colors: darkColors,
  elevation: darkElevation,
  space, radius, layout, motion, type, fonts,
};

export type Theme = typeof light;
