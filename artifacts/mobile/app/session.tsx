import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { CIRCUITS, type CircuitExercise } from "@/constants/circuits";
import { speak, stopSpeech } from "@/utils/speech";
import { checkWorkoutValidity, type HealthCheckResult } from "@/lib/health";
import { useCreateWorkoutSession } from "@workspace/api-client-react";

type Phase = "intro" | "work" | "rest" | "done";

export default function SessionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { goal } = useApp();

  const circuit = goal ? CIRCUITS[goal] : null;
  const exercises: CircuitExercise[] = circuit?.exercises ?? [];

  const totalDurationSeconds = exercises.reduce(
    (sum, e) => sum + e.workSeconds + e.restSeconds,
    0,
  );

  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);

  const spokenRef = useRef<string>("");
  const sessionStartedAtRef = useRef<Date | null>(null);

  const current = exercises[index];
  const next = exercises[index + 1];

  const { mutate: saveSession, isPending: isSaving } = useCreateWorkoutSession();

  // Record session start time when the first work phase begins.
  useEffect(() => {
    if (phase === "work" && index === 0 && !sessionStartedAtRef.current) {
      sessionStartedAtRef.current = new Date();
    }
  }, [phase, index]);

  // When session finishes, query Health Connect (Android) or HealthKit (iOS)
  // for a workout that started within the session window and lasted ≥15 min.
  useEffect(() => {
    if (phase !== "done" || healthResult !== null || healthChecking) return;

    setHealthChecking(true);
    const startedAt = sessionStartedAtRef.current ?? new Date(Date.now() - 40 * 60 * 1000);

    checkWorkoutValidity(startedAt, 15 * 60 * 1000)
      .then((result) => {
        setHealthResult(result);
        setHealthChecking(false);
      })
      .catch(() => {
        setHealthResult({ isValid: false, healthSource: null });
        setHealthChecking(false);
      });
  }, [phase, healthResult, healthChecking]);

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  useEffect(() => {
    if (!current) return;

    const key = `${phase}-${index}-${secondsLeft}`;
    if (spokenRef.current === key) return;

    if (phase === "intro" && secondsLeft === 3) {
      spokenRef.current = key;
      speak(t("session.startingSoon"));
    }

    if (phase === "work" && secondsLeft === current.workSeconds) {
      spokenRef.current = key;
      speak(t(`exercises.${current.nameKey}`));
    }

    if (phase === "work" && secondsLeft === Math.floor(current.workSeconds / 2)) {
      spokenRef.current = key;
      const lines = t("session.encouragement", {
        returnObjects: true,
      }) as string[];
      const phrase = lines[index % lines.length];
      speak(phrase);
    }

    if (phase === "rest" && secondsLeft === current.restSeconds && current.restSeconds > 0) {
      spokenRef.current = key;
      if (next) {
        speak(`${t("session.rest")}. ${t("session.nextUp")}: ${t(`exercises.${next.nameKey}`)}`);
      }
    }

    if (phase === "done") {
      spokenRef.current = "done";
      speak(t("session.completeDesc"));
    }
  }, [phase, secondsLeft, index, current, next, t]);

  useEffect(() => {
    if (!current) return;
    if (phase === "done") return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev > 1) return prev - 1;

        if (phase === "intro") {
          setPhase("work");
          return current.workSeconds;
        }

        if (phase === "work") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (current.restSeconds > 0) {
            setPhase("rest");
            return current.restSeconds;
          }
          if (next) {
            setIndex((i) => i + 1);
            setPhase("work");
            return next.workSeconds;
          }
          setPhase("done");
          return 0;
        }

        if (phase === "rest") {
          if (next) {
            setIndex((i) => i + 1);
            setPhase("work");
            return next.workSeconds;
          }
          setPhase("done");
          return 0;
        }

        return 0;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, current, next]);

  const handleQuit = () => {
    Alert.alert(
      t("session.quitConfirmTitle"),
      t("session.quitConfirmDesc"),
      [
        { text: t("session.cancel"), style: "cancel" },
        {
          text: t("session.confirmQuit"),
          style: "destructive",
          onPress: () => {
            stopSpeech();
            router.back();
          },
        },
      ],
    );
  };

  const handleFinish = () => {
    stopSpeech();
    saveSession(
      {
        data: {
          trainingGoal: (goal ?? "muscle_tone") as "muscle_tone" | "posture" | "cardio_general" | "weight_loss",
          durationSeconds: totalDurationSeconds,
          isValid: healthResult?.isValid ?? false,
          healthSource: healthResult?.healthSource ?? null,
        },
      },
      {
        onSettled: () => router.replace("/(tabs)"),
      },
    );
  };

  if (!current) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  if (phase === "done") {
    return (
      <View
        style={[
          styles.container,
          styles.center,
          { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.doneIcon, { backgroundColor: colors.accent }]}>
          <Feather name="check" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.doneTitle, { color: colors.foreground }]}>
          {t("session.complete")}
        </Text>
        <Text style={[styles.doneDesc, { color: colors.mutedForeground }]}>
          {t("session.completeDesc")}
        </Text>

        {healthChecking ? (
          <View style={[styles.healthCard, { backgroundColor: colors.muted }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.healthText, { color: colors.mutedForeground }]}>
              Verifica allenamento in corso…
            </Text>
          </View>
        ) : healthResult !== null ? (
          <View style={[styles.healthCard, { backgroundColor: colors.muted }]}>
            <Feather
              name={healthResult.isValid ? "check-circle" : "alert-circle"}
              size={20}
              color={healthResult.isValid ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.healthText,
                { color: healthResult.isValid ? colors.primary : colors.mutedForeground },
              ]}
            >
              {healthResult.isValid
                ? "Sessione valida — allenamento rilevato"
                : healthResult.healthSource === null
                  ? "Validazione non disponibile su questo dispositivo"
                  : "Nessun allenamento di almeno 15 min rilevato"}
            </Text>
          </View>
        ) : null}

        <Pressable
          testID="finish-session"
          onPress={handleFinish}
          disabled={healthChecking || isSaving}
          style={[
            styles.finishButton,
            {
              backgroundColor: colors.primary,
              opacity: healthChecking || isSaving ? 0.6 : 1,
            },
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.finishText, { color: colors.primaryForeground }]}>
              {t("session.finish")}
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  const totalForPhase =
    phase === "rest" ? current.restSeconds : phase === "intro" ? 3 : current.workSeconds;
  const progress = totalForPhase > 0 ? 1 - secondsLeft / totalForPhase : 0;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 20 },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topRow}>
        <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
          {t("session.exercise")} {index + 1} {t("session.of")} {exercises.length}
        </Text>
        <Pressable testID="quit-session" onPress={handleQuit} hitSlop={12}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <Text
          style={[
            styles.phaseLabel,
            { color: phase === "rest" ? colors.mutedForeground : colors.primary },
          ]}
        >
          {phase === "intro"
            ? t("session.getReady")
            : phase === "rest"
              ? t("session.rest")
              : t(`exercises.${current.nameKey}`)}
        </Text>

        <Text style={[styles.timer, { color: colors.foreground }]}>{secondsLeft}</Text>

        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
              },
            ]}
          />
        </View>

        {phase !== "intro" && next && (
          <Text style={[styles.nextLabel, { color: colors.mutedForeground }]}>
            {t("session.nextUp")}: {t(`exercises.${next.nameKey}`)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  phaseLabel: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  timer: {
    fontSize: 72,
    fontWeight: "800",
  },
  progressTrack: {
    width: "80%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  nextLabel: {
    fontSize: 14,
    marginTop: 8,
  },
  doneIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: {
    fontSize: 24,
    fontWeight: "800",
  },
  doneDesc: {
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  healthCard: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  healthText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  finishButton: {
    height: 54,
    width: "100%",
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  finishText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
