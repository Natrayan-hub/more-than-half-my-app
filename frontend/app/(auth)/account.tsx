// S2 — Account setup: sign up / sign in (JWT auth per security spec).
// Sign-up continues the flow; sign-in (returning account) goes straight in.
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

import { ApiError } from "@/src/api/client";
import { startGoogleAuth } from "@/src/features/auth/google";
import { OnboardingScaffold } from "@/src/features/onboarding/OnboardingScaffold";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTheme } from "@/src/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "EMAIL_TAKEN") return "That email is already registered — try signing in.";
    if (e.code === "AUTH_INVALID_CREDENTIALS") return "Wrong email or password.";
    if (e.code === "GOOGLE_AUTH_FAILED") return "Google sign-in failed — please try again.";
    if (e.code === "NETWORK_ERROR") return "You're offline — check your connection and try again.";
    return e.message;
  }
  return "Something went wrong — please try again.";
}

export default function AccountScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { signUp, signIn, continueWithGoogle } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<"signup" | "signin">(
    params.mode === "signin" ? "signin" : "signup",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = password.length >= 8;
  const formValid = emailValid && passwordValid;
  const busy = loading || googleLoading;

  const fieldErrors = useMemo(() => {
    if (!touched) return { email: null, password: null };
    return {
      email: email && !emailValid ? "Enter a valid email address" : null,
      password: password && !passwordValid ? "At least 8 characters" : null,
    };
  }, [touched, email, emailValid, password, passwordValid]);

  const submit = async () => {
    setTouched(true);
    if (!formValid || busy) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), password);
        router.push("/(auth)/privacy");
      } else {
        await signIn(email.trim(), password);
        // Root guard redirects returning users to Today.
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (busy) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const sessionId = await startGoogleAuth();
      if (Platform.OS === "web") return; // navigating away; resumes on reload
      if (!sessionId) return; // user cancelled — no error to show
      const isNewUser = await continueWithGoogle(sessionId);
      if (isNewUser) {
        router.push("/(auth)/privacy");
      }
      // Returning account → root guard redirects to Today.
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  const inputStyle = (hasError: boolean) => [
    styles.input,
    theme.type.body,
    {
      color: theme.colors.text.primary,
      backgroundColor: theme.colors.surface.default,
      borderColor: hasError ? theme.colors.error.default : theme.colors.border.strong,
      borderRadius: theme.radius.sm,
    },
  ];

  return (
    <OnboardingScaffold
      step={1}
      title={mode === "signup" ? "Create your account" : "Welcome back"}
      subtitle={
        mode === "signup"
          ? "Your account keeps your data encrypted and recoverable."
          : "Sign in to pick up where you left off."
      }
      primaryLabel={mode === "signup" ? "Create account" : "Sign in"}
      onPrimary={submit}
      primaryDisabled={!formValid || googleLoading}
      loading={loading}
      skipLabel={mode === "signup" ? "I already have an account" : "New here? Create an account"}
      onSkip={() => {
        setError(null);
        setMode(mode === "signup" ? "signin" : "signup");
      }}
    >
      <View style={{ gap: theme.space.md }}>
        {error ? (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: theme.colors.error.subtleBg, borderRadius: theme.radius.sm },
            ]}
          >
            <Feather name="alert-circle" size={16} color={theme.colors.error.text} />
            <Text style={[theme.type.bodySm, styles.flex, { color: theme.colors.error.text }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleGoogle}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityState={{ disabled: busy }}
          style={[
            styles.googleButton,
            {
              borderColor: theme.colors.border.strong,
              backgroundColor: theme.colors.surface.default,
              borderRadius: theme.radius.sm,
              opacity: busy && !googleLoading ? 0.6 : 1,
            },
          ]}
        >
          {googleLoading ? (
            <ActivityIndicator color={theme.colors.text.primary} />
          ) : (
            <>
              <MaterialCommunityIcons name="google" size={18} color="#4285F4" />
              <Text style={[theme.type.label, { color: theme.colors.text.primary, fontSize: 16 }]}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border.default }]} />
          <Text style={[theme.type.caption, { color: theme.colors.text.tertiary }]}>
            or continue with email
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: theme.colors.border.default }]} />
        </View>

        <View style={{ gap: theme.space["2xs"] }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            onBlur={() => setTouched(true)}
            placeholder="you@example.com"
            placeholderTextColor={theme.colors.text.tertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            accessibilityLabel="Email address"
            editable={!busy}
            style={inputStyle(!!fieldErrors.email)}
          />
          {fieldErrors.email ? (
            <Text style={[theme.type.caption, { color: theme.colors.error.text }]}>
              {fieldErrors.email}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: theme.space["2xs"] }}>
          <Text style={[theme.type.label, { color: theme.colors.text.secondary }]}>Password</Text>
          <View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched(true)}
              placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              placeholderTextColor={theme.colors.text.tertiary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              accessibilityLabel="Password"
              editable={!busy}
              style={inputStyle(!!fieldErrors.password)}
              onSubmitEditing={submit}
            />
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              style={styles.eyeButton}
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={20}
                color={theme.colors.text.secondary}
              />
            </TouchableOpacity>
          </View>
          {fieldErrors.password ? (
            <Text style={[theme.type.caption, { color: theme.colors.error.text }]}>
              {fieldErrors.password}
            </Text>
          ) : null}
        </View>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  eyeButton: {
    position: "absolute",
    right: 4,
    top: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
  },
  flex: { flex: 1 },
  googleButton: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
  },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1 },
});
