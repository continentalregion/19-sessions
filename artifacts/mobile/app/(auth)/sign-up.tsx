import { useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export default function SignUpScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [googlePending, setGooglePending] = useState(false);

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress, password });
    if (error) return;
    await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          router.replace(decorateUrl("/") as never);
        },
      });
    }
  };

  const handleGoogle = useCallback(async () => {
    setGooglePending(true);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri({ scheme: "mobile" }),
      });

      if (createdSessionId) {
        await setActive?.({
          session: createdSessionId,
          navigate: async ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            router.replace(decorateUrl("/") as never);
          },
        });
      }
    } catch (err) {
      console.error("Google SSO error", err);
    } finally {
      setGooglePending(false);
    }
  }, [startSSOFlow, router]);

  const isPending = fetchStatus === "fetching" || googlePending;

  const needsVerification =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;

  if (needsVerification) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 40 },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Verify your email</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          We sent a code to {emailAddress}
        </Text>

        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border },
          ]}
          keyboardType="numeric"
          placeholder="Enter code"
          placeholderTextColor={colors.mutedForeground}
          value={code}
          onChangeText={setCode}
        />
        {errors.fields.code && (
          <Text style={[styles.error, { color: colors.destructive }]}>
            {errors.fields.code.message}
          </Text>
        )}

        <Pressable
          testID="sign-up-verify"
          disabled={!code || fetchStatus === "fetching"}
          onPress={handleVerify}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.accent, opacity: !code || fetchStatus === "fetching" ? 0.6 : 1 },
          ]}
        >
          {fetchStatus === "fetching" ? (
            <ActivityIndicator color={colors.accentForeground} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.accentForeground }]}>
              Verify
            </Text>
          )}
        </Pressable>

        <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.linkButton}>
          <Text style={{ color: colors.mutedForeground }}>I need a new code</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 40 },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Create your account</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Start your fixed 19 Sessions circuit
      </Text>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border },
        ]}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor={colors.mutedForeground}
        value={emailAddress}
        onChangeText={setEmailAddress}
      />
      {errors.fields.emailAddress && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {errors.fields.emailAddress.message}
        </Text>
      )}

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
      <TextInput
        style={[
          styles.input,
          { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border },
        ]}
        secureTextEntry
        placeholder="••••••••"
        placeholderTextColor={colors.mutedForeground}
        value={password}
        onChangeText={setPassword}
      />
      {errors.fields.password && (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {errors.fields.password.message}
        </Text>
      )}

      <Pressable
        testID="sign-up-submit"
        disabled={!emailAddress || !password || isPending}
        onPress={handleSubmit}
        style={[
          styles.primaryButton,
          {
            backgroundColor: colors.accent,
            opacity: !emailAddress || !password || isPending ? 0.6 : 1,
          },
        ]}
      >
        {fetchStatus === "fetching" ? (
          <ActivityIndicator color={colors.accentForeground} />
        ) : (
          <Text style={[styles.primaryButtonText, { color: colors.accentForeground }]}>
            Sign up
          </Text>
        )}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>

      <Pressable
        testID="sign-up-google"
        disabled={isPending}
        onPress={handleGoogle}
        style={[
          styles.secondaryButton,
          { borderColor: colors.border, opacity: isPending ? 0.6 : 1 },
        ]}
      >
        {googlePending ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
            Continue with Google
          </Text>
        )}
      </Pressable>

      <View style={styles.footerRow}>
        <Text style={{ color: colors.mutedForeground }}>Already have an account? </Text>
        <Link href="/(auth)/sign-in">
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Sign in</Text>
        </Link>
      </View>

      <View nativeID="clerk-captcha" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 16,
  },
  error: {
    fontSize: 13,
    marginTop: -12,
    marginBottom: 16,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
  },
  secondaryButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
});
