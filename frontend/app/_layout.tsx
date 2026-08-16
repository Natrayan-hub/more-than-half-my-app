import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { ToastProvider } from "@/src/components/Toast";
import { AuthProvider, useAuth } from "@/src/providers/AuthProvider";
import { SyncProvider } from "@/src/providers/SyncProvider";
import { ThemeProvider, useTheme } from "@/src/theme";
import { useFonts } from "expo-font";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { theme, resolvedScheme } = useTheme();
  const { status, onboardingComplete } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // New-vs-returning branching:
  // - no session → onboarding (welcome)
  // - session + onboarding done → main app (mid-flow signup stays in (auth))
  useEffect(() => {
    if (status === "loading") return;
    const inAuthGroup = segments[0] === "(auth)";
    if (status === "unauthenticated" && !inAuthGroup) {
      router.replace("/(auth)/welcome");
    } else if (status === "authenticated" && onboardingComplete && inAuthGroup) {
      router.replace("/");
    } else if (status === "authenticated" && !onboardingComplete && !inAuthGroup) {
      // Covers the Google web redirect landing back on "/" for a brand-new
      // account — same continuation point as post-signup on native.
      router.replace("/(auth)/privacy");
    }
  }, [status, onboardingComplete, segments, router]);

  return (
    <>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      {status === "loading" ? (
        <View style={{ flex: 1, backgroundColor: theme.colors.bg.canvas }} />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.bg.canvas },
          }}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  const [iconsLoaded, iconsError] = useIconFonts();
  const [interLoaded, interError] = useFonts({
    "Inter-Regular": require("../assets/fonts/Inter-Regular.ttf"),
    "Inter-Medium": require("../assets/fonts/Inter-Medium.ttf"),
    "Inter-SemiBold": require("../assets/fonts/Inter-SemiBold.ttf"),
    "Inter-Bold": require("../assets/fonts/Inter-Bold.ttf"),
  });

  const loaded = iconsLoaded && interLoaded;
  const error = iconsError || interError;

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  // If fonts are unreachable we fall through on error rather than wedging
  // the app — text falls back to system fonts, but the app still boots.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SyncProvider>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </SyncProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
