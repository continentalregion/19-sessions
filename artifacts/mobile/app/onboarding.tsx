import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import type { TrainingGoal } from "@/constants/circuits";

const GOALS: TrainingGoal[] = [
  "muscle_tone",
  "posture",
  "cardio_general",
  "weight_loss",
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setGoal } = useApp();
  const [selected, setSelected] = useState<TrainingGoal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setGoal(selected);
    router.replace("/(tabs)");
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top + 32 },
      ]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t("onboarding.title")}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {t("onboarding.subtitle")}
      </Text>

      <View style={styles.cards}>
        {GOALS.map((goalId) => {
          const isSelected = selected === goalId;
          return (
            <Pressable
              key={goalId}
              testID={`goal-${goalId}`}
              onPress={() => {
                Haptics.selectionAsync();
                setSelected(goalId);
              }}
              style={[
                styles.card,
                {
                  backgroundColor: isSelected ? colors.accent : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.cardTitle,
                  {
                    color: isSelected ? colors.primary : colors.foreground,
                  },
                ]}
              >
                {t(`onboarding.goals.${goalId}.title`)}
              </Text>
              <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>
                {t(`onboarding.goals.${goalId}.desc`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        testID="onboarding-continue"
        disabled={!selected || submitting}
        onPress={handleContinue}
        style={[
          styles.continueButton,
          {
            backgroundColor: selected ? colors.primary : colors.muted,
            marginBottom: insets.bottom + 24,
          },
        ]}
      >
        <Text
          style={[
            styles.continueText,
            { color: selected ? colors.primaryForeground : colors.mutedForeground },
          ]}
        >
          {t("onboarding.continue")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 28,
  },
  cards: {
    gap: 12,
    flex: 1,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  continueButton: {
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  continueText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
