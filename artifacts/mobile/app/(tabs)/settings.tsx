import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/constants/translations";

function formatDate(date: Date, lang: SupportedLanguage) {
  const localeMap: Record<SupportedLanguage, string> = {
    it: "it-IT",
    en: "en-US",
    es: "es-ES",
    zh: "zh-CN",
  };
  return date.toLocaleDateString(localeMap[lang], {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function SettingsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const {
    goal,
    canChangeGoal,
    nextGoalChangeDate,
    language,
    setLanguage,
  } = useApp();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        {t("settings.language")}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        {SUPPORTED_LANGUAGES.map((lang, i) => {
          const isSelected = lang === language;
          return (
            <Pressable
              key={lang}
              testID={`language-${lang}`}
              onPress={async () => {
                await Haptics.selectionAsync();
                await setLanguage(lang);
              }}
              style={[
                styles.row,
                i !== SUPPORTED_LANGUAGES.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                {LANGUAGE_LABELS[lang]}
              </Text>
              {isSelected && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 24 }]}>
        {t("settings.goal")}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.foreground }]}>
            {t("settings.current")}
          </Text>
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
            {goal ? t(`onboarding.goals.${goal}.title`) : "-"}
          </Text>
        </View>
      </View>

      {canChangeGoal ? (
        <Pressable
          testID="change-goal"
          onPress={() => router.push("/onboarding")}
          style={[styles.changeGoalButton, { backgroundColor: colors.accent }]}
        >
          <Text style={[styles.changeGoalText, { color: colors.accentForeground }]}>
            {t("settings.changeGoal")}
          </Text>
        </Pressable>
      ) : (
        nextGoalChangeDate && (
          <Text style={[styles.lockedText, { color: colors.mutedForeground }]}>
            {t("settings.lockedMessage", {
              date: formatDate(nextGoalChangeDate, language),
            })}
          </Text>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 140,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  rowValue: {
    fontSize: 14,
  },
  changeGoalButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  changeGoalText: {
    fontSize: 15,
    fontWeight: "700",
  },
  lockedText: {
    marginTop: 16,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
