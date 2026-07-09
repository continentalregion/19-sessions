import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import {
  CIRCUITS,
  getCircuitCategories,
  getCircuitTotalMinutes,
} from "@/constants/circuits";

export default function HomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { goal } = useApp();

  if (!goal) return null;

  const circuit = CIRCUITS[goal];
  const minutes = getCircuitTotalMinutes(circuit);
  const categories = getCircuitCategories(circuit);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
        {t("home.circuitFor")}
      </Text>
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t(`onboarding.goals.${goal}.title`)}
      </Text>

      <View style={[styles.statsRow]}>
        <View style={[styles.statPill, { backgroundColor: colors.card }]}>
          <Feather name="list" size={14} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.foreground }]}>
            {circuit.exercises.length} {t("home.exercises")}
          </Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: colors.card }]}>
          <Feather name="clock" size={14} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.foreground }]}>
            {minutes} {t("home.minutes")}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t("home.categories")}
      </Text>
      <View style={styles.categoryRow}>
        {categories.map((cat) => (
          <View
            key={cat}
            style={[styles.categoryChip, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.categoryText, { color: colors.accentForeground }]}>
              {t(`categories.${cat}`)}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.exerciseList, { backgroundColor: colors.card }]}>
        {circuit.exercises.map((ex, index) => (
          <View
            key={`${ex.id}-${index}`}
            style={[
              styles.exerciseRow,
              index !== circuit.exercises.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.exerciseIndex, { color: colors.mutedForeground }]}>
              {index + 1}
            </Text>
            <Text style={[styles.exerciseName, { color: colors.foreground }]}>
              {t(`exercises.${ex.nameKey}`)}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        testID="start-session"
        onPress={() => router.push("/session")}
        style={[styles.startButton, { backgroundColor: colors.primary }]}
      >
        <Feather name="play" size={18} color={colors.primaryForeground} />
        <Text style={[styles.startText, { color: colors.primaryForeground }]}>
          {t("home.startSession")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 140,
    gap: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: -6,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  statText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  exerciseList: {
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  exerciseIndex: {
    fontSize: 13,
    fontWeight: "700",
    width: 20,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 28,
    marginTop: 8,
  },
  startText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
